import type { FighterId, RoomMode } from '../../game/types';
import { FIGHTERS } from '../../config';
import { isLaboratoryPreviewFighter } from '../../fighterLab';
import type { NetworkAccess } from '../../network';
import { isObjectiveKind } from '../../game/objectives/model';
import type { UiAction } from '../../input/gamepad';
import type { HomeMode } from '../MangaHome';
import type { Hud } from '../Hud';
import { readInvite } from '../roomInvite';
import { LAUNCH } from '../../originals/launch';
import { MODES, MODE_OF_HOME, type ModeId, type VariantId } from './catalogue';
import { ModeSheet } from './ModeSheet';
import { GameMenu } from '../menu/GameMenu';
import { ResultsShell } from '../results/ResultsShell';
import { WaitingDock } from './WaitingDock';
import { Coach } from './Coach';
import { HudPrompts } from './HudPrompts';
import { LookHint } from './LookHint';
import { CouchPrompt } from './CouchPrompt';
import { explainerSeen, modePrefs, setTrainingDummy, trainingDummy } from './prefs';
import { LearnOffer } from '../../tutorial/LearnOffer';
import './homeShell.css';

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** Home statuses that are progress, not a failure (Hud.loading / ready). */
const PROGRESS = /^(ARENA READY|Loading|Preparing|Summoning|Connecting|Entering|Readying)/i;

export class HomeShell {
  readonly sheet: ModeSheet;
  readonly menu: GameMenu;
  readonly results: ResultsShell;
  /** The last match the sheet started: the menu names its way to play. */
  private started?: { mode: ModeId; variant: VariantId };
  /** An invite this page was opened with: kept until it is used, so choosing a fighter first does not lose the code. */
  private invited?: { mode: ModeId; code: string };
  private readonly root: HTMLElement;
  /** The waiting dock: its bot offer takes a pad's presses (`dockChoice`). */
  private readonly dock: WaitingDock;
  private line?: HTMLElement;
  private sub?: HTMLElement;
  private shown?: string;
  private lastLabel = '';
  /** LEARN TO FIGHT (src/tutorial): the first visit's offer in the bottom bar, then YOU'RE READY over PLAY. */
  private readonly offer: LearnOffer;

  constructor(private readonly hud: Hud, private readonly deps: { story?: () => void; /** The pad the page's menus read (input.ts padIndex): the sheet's couch way gives Player 2's its pick. */ menuPad?: () => number | null } = {}) {
    this.root = document.querySelector<HTMLElement>('#interface')!;
    this.sheet = new ModeSheet({
      root: this.root,
      fighter: () => hud.selected,
      name: () => hud.playerName(),
      setName: name => { const input = this.root.querySelector<HTMLInputElement>('#player-name'); if (input) { input.value = name; input.dispatchEvent(new Event('change')); } },
      busy: () => !!this.root.querySelector<HTMLButtonElement>('#home-play')?.disabled,
      start: (fighter: FighterId, mode: RoomMode, access?: NetworkAccess) => { this.started = this.sheet.pending && { mode: this.sheet.pending.mode, variant: this.sheet.pending.variant }; this.invited = undefined; hud.onPreviewStop(); void hud.onStart(fighter, mode, hud.playerName(), access); this.refresh(); },
      changeFighter: () => { this.root.querySelector<HTMLElement>('.home-fighter[aria-pressed="true"]')?.focus(); },
      story: deps.story,
      menuPad: deps.menuPad,
      learn: mode => this.learn(mode),
    });
    this.offer = new LearnOffer(this.root, () => this.learn());
    this.menu = new GameMenu(this.root, hud.modes);
    this.menu.variant = () => this.started && this.started.mode === hud.modes.layout ? this.started.variant : undefined;
    this.results = new ResultsShell(this.root, hud);
    this.results.started = () => this.started;
    this.results.openSheet = mode => this.sheet.show(mode);
    // The waiting dock and the coach ride on the mode HUD host's frames and events.
    const dock = this.dock = new WaitingDock(this.root, () => hud.onLeave(), () => hud.onFightBot()), coach = new Coach(this.root), prompts = new HudPrompts(this.root), look = new LookHint(this.root);
    hud.modes.listeners.push({ frame: (f, layout) => prompts.frame(f, layout), clear: () => prompts.clear() }, { frame: (f, layout) => look.frame(f, layout), clear: () => look.clear() });
    hud.modes.listeners.push({ frame: (f, layout) => dock.frame(f, layout), clear: () => dock.clear() }, { frame: (f, layout) => coach.frame(f, layout), event: (e, s, layout) => coach.event(e, s, layout), clear: () => coach.clear() });
    // A second controller on the home: "Player 2 detected", offering the selected mode's COUCH way (CouchPrompt; never a phone).
    new CouchPrompt(this.root, () => this.selected().mode, mode => { hud.onPreviewStop(); this.sheet.show(mode, { variant: 'couch' }); }, () => this.sheet.open, deps.menuPad);
    this.home();
    this.invites();
    this.failures();
    // Training starts fresh - full health, empty meters, whatever came before (the critic came from a BR results card
    // to 825 / 1000 and 24% awakening) - with the dummy as the player left it (passive, the first time).
    hud.modes.onLayout = layout => { this.results.reset(); if (layout === 'training') { hud.onTraining('reset'); hud.onTraining(trainingDummy()); } };
    // The online match's old start notice ("Match started in … – one life per fighter") says what RoaN's FIGHT! card
    // says, in another voice: FIGHT! alone.
    const notify = hud.notify.bind(hud);
    hud.notify = (text: string, duration?: number) => { if (/^Match started in /i.test(text)) return; notify(text, duration); };
    // The menu's own Passive / Fighting buttons are a choice too: remembered like the [1] DUMMY key (WP2's tools bar).
    this.root.addEventListener('click', event => { const b = (event.target as HTMLElement).closest<HTMLElement>('[data-training="passive"],[data-training="combat"]'); if (b) setTrainingDummy(b.dataset.training as 'passive' | 'combat'); });
  }

  /** The card the home has selected (Hud's own aria-pressed), as the catalogue's mode and way to play. */
  selected(): { card: HomeMode; mode: ModeId; variant?: VariantId } {
    const card = (this.root.querySelector<HTMLElement>('.home-mode[aria-pressed="true"]')?.dataset.mode ?? 'bots') as HomeMode;
    return { card, ...MODE_OF_HOME[card] };
  }
  /** PLAY: the selected mode's sheet, on the way to play used last. */
  play(variant?: VariantId) {
    if (isLaboratoryPreviewFighter(this.hud.selected)) {
      this.hud.onPreviewStop(); this.hud.onLaboratoryReview(this.hud.selected); return;
    }
    const { mode, variant: cardVariant } = this.selected();
    this.hud.onPreviewStop();
    if (this.invited?.mode === mode && (!variant || variant === 'friends')) { this.showInvite(); return; }
    this.sheet.show(mode, { variant: variant ?? cardVariant });
  }
  private showInvite() {
    const { mode, code } = this.invited!;
    this.sheet.show(mode, { variant: 'friends', code, invited: true, status: `YOU'RE INVITED · ${MODES[mode].name} · ${code}. Choose your fighter, then JOIN.` });
  }
  /** Escape (or the pad's OPTIONS) before anything else has it: the sheet closes; the skill tree opened over the menu
   *  closes back to it; on a page of the menu, Escape goes back to its first page (only from there does it resume);
   *  and over any results card the menu never opens - Escape there is HOME, as it is on the main results. */
  back(source: 'keyboard' | 'controller' = 'keyboard') {
    if (this.sheet.open) { this.sheet.back(); return true; }
    // A result's picture (results/shareResult.ts) shuts before the results under it go home.
    if (this.results.share.close()) return true;
    if (this.closeTree()) return true;
    if (this.menu.open && this.menu.current !== 'home' && source === 'keyboard') { this.menu.home(); return true; }
    const arcade = this.root.querySelector<HTMLElement>('#sv-results:not(.hidden)');
    if (arcade && !this.menu.open) { arcade.querySelector<HTMLElement>('#sv-leave')?.click(); return true; }
    return false;
  }
  /** A pad: ○ on a page of the menu (or in the tree over it) steps back the same way; the rest is the sheet's. */
  controller(action: UiAction) {
    if (!this.hud.settingsOpen && this.dock.controller(action)) return true;
    if (this.results.swallow(action)) return true;
    if (action === 'back') {
      if (this.closeTree()) return true;
      if (this.menu.open && this.menu.current !== 'home') { this.menu.home(); return true; }
    }
    // LB / RB in the game menu: its pages (GameMenu.turn).
    if ((action === 'tabPrevious' || action === 'tabNext') && this.menu.open && !this.sheet.open) return this.menu.turn(action === 'tabNext' ? 1 : -1);
    return this.sheet.controller(action);
  }
  /** A lone Duel queue offers a bot to a pad (WaitingDock): main.ts idles the fighter so the pad can choose. */
  get dockChoice() { return this.dock.padChoice; }
  private closeTree() {
    const tree = this.root.querySelector<HTMLElement>('#sv-tree:not(.hidden)');
    if (!tree) return false;
    this.root.querySelector<HTMLElement>('#sv-tree-ready')?.click();
    return true;
  }

  private home() {
    const play = this.root.querySelector<HTMLButtonElement>('#home-play');
    const heading = this.root.querySelector<HTMLElement>('.home-heading');
    if (!play || !heading) return;
    play.onclick = () => { if (!play.disabled) this.play(); };
    // The card words: choose the card, and open its sheet on that way to play.
    for (const word of this.root.querySelectorAll<HTMLButtonElement>('[data-variant]')) word.onclick = event => {
      event.stopPropagation();
      const card = word.closest<HTMLElement>('[data-panel]')?.querySelector<HTMLButtonElement>('[data-mode]');
      if (card && card.getAttribute('aria-pressed') !== 'true') card.click();
      if (!play.disabled) this.play(word.dataset.variant as VariantId);
    };
    const join = this.root.querySelector<HTMLButtonElement>('#choose-join');
    if (join) join.onclick = () => this.sheet.show('royale', { variant: 'friends' });
    this.line = document.createElement('div');
    this.line.className = 'home-mode-line';
    heading.before(this.line);
    this.sub = document.createElement('small');
    this.sub.className = 'home-play-sub';
    play.append(this.sub);
    this.offer.mount(play);
    this.line.addEventListener('click', event => { if ((event.target as HTMLElement).closest('[data-howto]')) { this.hud.onPreviewStop(); this.sheet.show(this.selected().mode, { showPanels: true }); } });
    const cards = this.root.querySelectorAll<HTMLElement>('.home-mode');
    for (const card of cards) {
      card.addEventListener('pointerenter', () => this.describe(card.dataset.mode as HomeMode));
      card.addEventListener('focus', () => this.describe(card.dataset.mode as HomeMode));
      card.addEventListener('pointerleave', () => this.describe());
      card.addEventListener('blur', () => this.describe());
    }
    // After Hud's own handlers (a card, a fighter): PLAY keeps one label, and the lines follow.
    this.root.querySelector('.manga-home')?.addEventListener('click', () => queueMicrotask(() => this.refresh()));
    // Every time the home comes back (after a match, a leave, a failed start), PLAY's line is current.
    const lobby = this.root.querySelector<HTMLElement>('.lobby');
    // Overnight UX (9 October 2026): <html> says when the home is up (style.css html.at-home): a phone on its side
    // letterboxes the page beside its notch in the page's own background - the old theme's navy, framing the white
    // home - and the home's paper belongs there; a fight keeps the dark one.
    const atHome = () => document.documentElement.classList.toggle('at-home', !!lobby && !lobby.classList.contains('hidden'));
    atHome();
    if (lobby) new MutationObserver(() => { atHome(); if (!lobby.classList.contains('hidden')) this.refresh(); }).observe(lobby, { attributes: true, attributeFilter: ['class'] });
    this.refresh();
  }
  /** The mode line for a card (the hovered or focused one; else the selected one), and PLAY's line. A card under the
   *  pointer that is not the selected one is a preview, and reads as one: PREVIEW, dimmed, no HOW TO PLAY (that opens the
   *  selected mode's sheet) - so the line, the red card and PLAY never name three modes at once. */
  private describe(card?: HomeMode) {
    if (isLaboratoryPreviewFighter(this.hud.selected) && !card) {
      if (this.line && this.shown !== 'laboratory') {
        this.shown = 'laboratory'; this.line.title = 'Review this fighter in offline Training.';
        this.line.classList.remove('previewing');
        this.line.innerHTML = '<b>FIGHTER LABORATORY</b><em>Try the new fighter</em><i>OFFLINE TRAINING</i><i>IN REVIEW</i>';
      }
      return;
    }
    const selected = this.selected().card, id = card ?? selected, mode = MODES[MODE_OF_HOME[id].mode];
    const preview = MODE_OF_HOME[id].mode !== MODE_OF_HOME[selected].mode;
    const key = `${id}|${preview}`;
    if (!this.line || this.shown === key) return;
    this.shown = key;
    this.line.title = mode.goal;
    this.line.classList.toggle('previewing', preview);
    this.line.innerHTML = `${preview ? '<span class="home-mode-preview">PREVIEW</span>' : ''}<b>${escape(mode.name)}</b><em>${escape(mode.tagline)}</em>${[mode.facts.players, mode.facts.length, mode.facts.lives].map(f => `<i>${escape(f)}</i>`).join('')}${preview ? '' : '<button type="button" data-howto>ⓘ HOW TO PLAY</button>'}`;
  }
  refresh() {
    const play = this.root.querySelector<HTMLButtonElement>('#home-play');
    if (!play) return;
    this.offer.refresh();
    const label = play.querySelector('span');
    if (isLaboratoryPreviewFighter(this.hud.selected)) {
      if (label) label.textContent = 'TEST FIGHTER';
      this.lastLabel = 'OFFLINE TRAINING · PREVIEW';
      if (this.sub) this.sub.textContent = this.lastLabel;
      play.setAttribute('aria-label', `Review ${FIGHTERS[this.hud.selected].name} in offline Training`);
      this.shown = undefined; this.describe(); return;
    }
    if (label && label.textContent !== 'PLAY') label.textContent = 'PLAY';
    const { mode, variant: cardVariant } = this.selected(), info = MODES[mode];
    const variant = this.sheet.variantFor(mode, cardVariant), prefs = modePrefs(mode);
    const way = info.variants[variant]!.label + (mode === 'royale' && variant === 'offline' ? ` · ${prefs.fighters ?? 8}` : '');
    const text = `${info.name} · ${explainerSeen(mode) ? way : 'FIRST TIME'}`;
    if (this.sub && text !== this.lastLabel) { this.lastLabel = text; this.sub.textContent = text; }
    // (The fighter's name, not its id: "as wuming" was read out.)
    play.setAttribute('aria-label', `Play ${info.name}, ${info.variants[variant]!.label}, as ${FIGHTERS[this.hud.selected]?.name ?? this.hud.selected}`);
    this.shown = undefined; this.describe();
  }

  /** LEARN TO FIGHT: the guided first fight (src/tutorial), in offline Training with the home's fighter. A ball mode's
   *  is LEARN TO PLAY (game/ball/lesson.ts), its guided first game in FREE PLAY on this device. */
  learn(mode?: ModeId) {
    this.sheet.close(); this.hud.onPreviewStop();
    if (mode === 'goal-rush' || mode === 'sky-spike') { void this.hud.onStart(this.hud.selected, 'match', this.hud.playerName(), { kind: 'ball', mode, access: 'bots', practice: true, lesson: true }); return; }
    void this.hud.onStart(this.hud.selected, 'training', this.hud.playerName(), { kind: 'training', tutorial: true });
  }

  /** An invite link opens its mode's sheet, on FRIENDS with the code in (Hud and ObjectiveUI opened their old pages). */
  private invites() {
    if (!LAUNCH.online) return;
    const invite = readInvite(location.href);
    const hash = new URLSearchParams(location.hash.slice(1)), objective = hash.get('mode'), code = hash.get('room');
    const open = (mode: ModeId, room: string) => queueMicrotask(() => {
      (this.root.querySelector('#home-dialog') as HTMLDialogElement | null)?.close();
      this.hud.objectives.closeSetup();
      // The invite's card is the selected one, so PLAY comes back to it with the code.
      const card = this.root.querySelector<HTMLButtonElement>(`[data-mode="${mode === 'royale' ? 'bots' : mode}"]`);
      if (card && card.getAttribute('aria-pressed') !== 'true') card.click();
      this.invited = { mode, code: room };
      this.showInvite();
    });
    if (invite) open(invite.kind === 'duel' ? 'duel' : invite.kind === 'coop' ? 'arcade' : 'royale', invite.code);
    else if ((isObjectiveKind(objective)||objective==='rift-war') && code && /^\d{6}$/.test(code)) open(objective, code);
  }

  /** A start that failed puts the player back on the sheet, with the reason and the same button to try again. */
  private failures() {
    const label = this.root.querySelector<HTMLElement>('#load-label'), menu = this.root.querySelector<HTMLElement>('.lobby');
    if (!label || !menu) return;
    new MutationObserver(() => {
      const pending = this.sheet.pending;
      if (!pending || performance.now() - pending.at > 120000) { this.sheet.pending = undefined; return; }
      if (menu.classList.contains('hidden')) return;                       // the match is loading or on
      const text = label.textContent?.trim() ?? '';
      if (!text || PROGRESS.test(text)) return;
      this.sheet.pending = undefined;
      this.sheet.show(pending.mode, { variant: pending.variant, status: /try again/i.test(text) ? text : `${text.replace(/\.$/, '')}. Try again, or choose another way to play.` });
    }).observe(label, { childList: true, characterData: true, subtree: true });
    // A start that got through: nothing to come back to.
    new MutationObserver(() => { if (menu.classList.contains('hidden')) this.sheet.pending = undefined; }).observe(menu, { attributes: true, attributeFilter: ['class'] });
  }
}
