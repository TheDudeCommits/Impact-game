import { isReleasedFighter } from '../../game/rosterAvailability';
import { FIGHTERS } from '../../config';
import type { FighterId, RoomMode } from '../../game/types';
import type { NetworkAccess } from '../../network';
import { factionOf, HEROES, isBadBloodFighter, RULES, VILLAINS } from '../../game/objectives/model';
import { GamepadControls, UI_DIRECTION, type PadState, type UiAction } from '../../input/gamepad';
import { enterDigit, entryHint, showEntry } from '../padEntry';
import { fighterCaption, HOME_VOLUMES, HOME_ROSTER, mangaPortrait } from '../MangaHome';
import { HELD, mayPlay } from '../../game/economy/fighters';
import { account } from '../shop/account';
import { goLabel } from './lockedGo';
import '../inkSelect';
import { moveSheetOf, moveSheetUrl } from '../moveSheet';
import { currentDevice, promptKey, promptText } from '../prompts';
import { padKey } from '../../input/glyphs';
import { preloadLoadingArt, type LoadingMode } from '../LoadingScreen';
import { readInvite } from '../roomInvite';
import { modeOpen } from '../../originals/launch';
import { nearest, type Direction } from '../spatialFocus';
import { MODES, VARIANT_ORDER, modeHere, type ModeId, type Panel, type VariantId } from './catalogue';
import { defenceBasics } from './defence';
import { tutorialState } from '../../tutorial/guidedFight';
import { explainerSeen, markExplainerSeen, modePrefs, namedPlaceFor, saveModePrefs } from './prefs';
import { placePicture, placeRow, placeShown } from './place';
import { pictures } from '../hud/protos/proto';
import type { StageChoice } from '../../game/stageChoice';
import { defaultRoyaleFighters } from '../../loading/backgroundPolicy';
import { KEY_HELP, plannedSeats, seatsLine } from '../../couch/couch';
import { keysOf, PadPresence, reseat, seatablePads, type SeatDevice } from '../../couch/seats';
import { partnerChoices, partnerShown, stepPartner, type PartnerPick } from './partnerPick';
import { SCREENS, SCREEN_WORDS, screenFor } from '../../couch/split';
import type { CouchScreen, CouchStart } from '../../network';
import { touchFirst } from '../../input/device';
import './modeSheet.css';

/** What the sheet needs from the home: the fighter, the name, and the one way a match starts (Hud.onStart). */
export interface SheetHost {
  root: HTMLElement;
  fighter(): FighterId;
  name(): string;
  setName(name: string): void;
  /** The home is busy (loading fighters, or a start already under way): GO waits. */
  busy(): boolean;
  start(fighter: FighterId, mode: RoomMode, access?: NetworkAccess): void;
  /** CHANGE: back to the roster. */
  changeFighter(): void;
  /** Arcade: the story again (RiftIntro). */
  story?(): void;
  /** The pad the page's menus read (input.ts padIndex), if any: on the couch way, Player 2's pad moves Player 2's pick. */
  menuPad?(): number | null;
  /** LEARN TO FIGHT (src/tutorial), offered first in HOW TO PLAY: the guided first fight. */
  learn?(): void;
}
export interface SheetOpen { variant?: VariantId; code?: string; invited?: boolean; status?: string; showPanels?: boolean }

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const FIGHTER_COUNTS = [4, 6, 8, 10, 12], ROOM_SIZES = [2, 4, 8, 12];
const MOVE_X: Record<'special' | 'ultimate' | 'awakening', string> = { special: '50%', ultimate: '75%', awakening: '100%' };
/** The place a mode with no choice of place stands on in the sheet (its own, authored): the rest show their art. */
const HOME_PLACE: Partial<Record<ModeId, string>> = { 'last-stand': 'hidden-ash', 'rift-war': 'rift-war' };
/** The way to play after `current` going `step` (+1 → right, -1 ← left), round the mode's own ways: the arrows on the
 *  keyboard, and since the overnight UX pass (8 October 2026) the pad's D-pad on the tab row too. */
export function nextWay(ways: readonly VariantId[], current: VariantId, step: 1 | -1): VariantId {
  const at = Math.max(0, ways.indexOf(current));
  return ways[(at + step + ways.length) % ways.length];
}

/** The browser can draw the game (WebGL 2): the game's own canvas has its context, or the browser knows the API. */
function drawable() {
  const canvas = typeof document === 'object' ? document.querySelector<HTMLCanvasElement>('#game-canvas') : null;
  try { return canvas ? !!canvas.getContext('webgl2') : typeof WebGL2RenderingContext !== 'undefined'; } catch { return false; }
}

/** A key's cap on Player 2's card (ModeSheet deviceTag): the arrows as arrows. */
const KEY_CAPS: Readonly<Record<string, string>> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
/** A face's picture, held back in data-href until it is near the view (MangaHome mangaPortrait's `deferred`). */
function showPortraits(scope: ParentNode) {
  for (const image of scope.querySelectorAll<SVGImageElement>('image[data-href]')) { image.setAttribute('href', image.getAttribute('data-href')!); image.removeAttribute('data-href'); }
}
export function screenIcon(screen: CouchScreen): string {
  const text = (x: number, y: number, label: string, size = 11) => `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-weight="900" font-family="'Barlow Condensed',Impact,sans-serif" fill="currentColor">${label}</text>`;
  const halves = screen === 'split-h'
    ? `<rect x="3" y="3" width="58" height="16" fill="currentColor" opacity=".24"/><path d="M2 20.5H62" stroke="currentColor" stroke-width="2.5"/>${text(32, 11.5, 'P1')}${text(32, 30, 'P2')}`
    : screen === 'split-v'
      ? `<rect x="3" y="3" width="27.5" height="35" fill="currentColor" opacity=".24"/><path d="M32 2V39" stroke="currentColor" stroke-width="2.5"/>${text(17, 20.5, 'P1')}${text(47, 20.5, 'P2')}`
      : `<rect x="3" y="3" width="58" height="35" fill="currentColor" opacity=".12"/>${text(32, 20.5, 'P1 + P2', 10.5)}`;
  return `<svg class="ms-screen-icon" viewBox="0 0 64 41" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="61" height="38" rx="3" fill="none" stroke="currentColor" stroke-width="2.5"/>${halves}</svg>`;
}

function learnButton() {
  const done = tutorialState() === 'done';
  return `<button type="button" class="ms-learn" data-ms-learn><i aria-hidden="true">▶</i><span><b>LEARN TO FIGHT · 60 s</b><small>A GUIDED FIRST FIGHT: GUARD, PARRY, A TECHNIQUE, YOUR ULTIMATE</small></span>${done ? '<em>DONE ✓ · AGAIN</em>' : ''}</button>`;
}

export class ModeSheet {
  readonly dialog = document.createElement('dialog');
  private mode: ModeId = 'royale';
  private variant: VariantId = 'offline';
  private code = '';
  private status = '';
  private panels = false;
  /** HOW TO PLAY, open over the sheet: the rules, the tips and the defence basics (the first time a mode is opened, and
   *  whenever asked for). */
  private rules = false;
  private invited = false;
  private side: 'heroes' | 'villains' = 'heroes';
  private bbFighter: FighterId = 'taisei';
  /** Bad Blood: the fighter chosen on each side, so going over to the other side and back keeps them (the home's own
   *  fighter on their own side). */
  private picks: Partial<Record<'heroes' | 'villains', FighterId>> = {};
  /** The pad editing the room code a digit at a time (as ObjectiveUI did). */
  private editing = false;
  private digit = 0;
  /** A start this sheet made, until the match is on or the home reports why not. */
  pending?: { mode: ModeId; variant: VariantId; at: number };
  /** Couch: the seats the sheet shows and the start uses (Player 1's device, Player 2's) - planned as the way opens
   *  (plannedSeats), then moved as pads come and go (couch/seats.ts reseat, as a fight does) or SWAP P1 / P2 is pressed. */
  private seats?: SeatDevice[];
  /** The seatable pads (seatablePads, a seat's own pad given a moment's grace: PadPresence) when the seats were last
   *  looked at, as a key. */
  private padsKey = '';
  private readonly presence = new PadPresence();
  /** Each seat's pad, read here while it is not the one the page's menus read (input.ts reads that one): Player 2's
   *  moves Player 2's pick, Player 1's the sheet's focus. */
  private readonly seatPads = [new GamepadControls(), new GamepadControls()] as const;
  private watching = 0;
  private device = '';

  constructor(private readonly host: SheetHost) {
    this.dialog.className = 'mode-sheet ms-select';
    this.dialog.setAttribute('aria-labelledby', 'ms-title');
    host.root.append(this.dialog);
    this.dialog.addEventListener('click', event => this.click(event));
    this.dialog.addEventListener('keydown', event => this.key(event));
    // The rival (Duel) or the dummy (Training) picked, remembered for that mode.
    this.dialog.addEventListener('change', event=>{const pick=event.target as HTMLElement&{value:string};if(pick.hasAttribute('data-ms-rival'))saveModePrefs(this.mode,{rival:pick.value as FighterId||undefined});});
    // Couch: a controller plugged in or taken out while the sheet is up moves the seats (and the sheet polls the pads too:
    // a browser shows a pad only once a button on it is pressed, with or without an event - `watch`).
    for(const type of ['gamepadconnected','gamepaddisconnected'])window.addEventListener(type,()=>{if(this.dialog.open&&this.variant==='couch')this.checkPads();});
    this.dialog.addEventListener('input', event => this.input(event));
    this.dialog.addEventListener('paste', event => this.paste(event));
    this.dialog.addEventListener('close', () => { if (this.editing) { const code = this.dialog.querySelector<HTMLInputElement>('.ms-join input'); if (code) showEntry(code, undefined); } this.editing = false; });
    // Esc: the game's own back (HomeShell.back) has usually had it already this press; the dialog's own cancel only
    // stands in when it has not, so HOW TO PLAY closes before the sheet does.
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); if (performance.now() - this.backAt > 120) this.back(); });
    // The join row is a form for Enter's sake; it must never submit the page.
    this.dialog.addEventListener('submit', event => event.preventDefault());
  }
  /** A browser without WebGL 2 cannot draw the fight, so GO waits and says why. Phones and tablets play on the touch
   *  controls (input/touch.ts). */
  private get unsupported() { return !drawable(); }
  get open() { return this.dialog.open; }
  get current() { return { mode: this.mode, variant: this.variant }; }
  /** Opened by an invite link, on FRIENDS: the primary button joins the room in the code field (go(true) checks it). */
  private get joining() { return this.invited && this.variant === 'friends'; }

  /** The variant a mode opens on: the one asked for, else the one used last, else the first. */
  variantFor(mode: ModeId, asked?: VariantId): VariantId {
    const variants = modeHere(mode).variants, last = modePrefs(mode).variant;
    return asked && variants[asked] ? asked : last && variants[last] ? last : VARIANT_ORDER.find(v => variants[v])!;
  }
  show(mode: ModeId, options: SheetOpen = {}) {
    if (!modeOpen(mode)) return;
    this.mode = mode; this.variant = this.variantFor(mode, options.variant);
    this.code = options.code ?? ''; this.status = options.status ?? ''; this.invited = !!options.invited; this.editing = false;
    this.panels = options.showPanels ?? !explainerSeen(mode);
    this.rules = this.panels;
    const fighter = this.host.fighter();
    this.side = factionOf(fighter); this.bbFighter = isBadBloodFighter(fighter) ? fighter : this.side === 'villains' ? 'oro' : 'taisei';
    this.picks = { [this.side]: this.bbFighter };
    this.seats = undefined;
    this.draw();
    this.preload();
    if (!this.dialog.open) this.dialog.showModal();
    this.watch();
    // (An invite's GO joins: it takes the focus, rather than the code field - on a phone that raised the keyboard.)
    this.focus(this.code && this.variant === 'friends' && !this.invited ? '.ms-join input' : '.ms-go');
    this.showStatus();
  }
  close() { if (this.dialog.open) this.dialog.close(); }
  /** Esc or ○: HOW TO PLAY, if it is open, goes first; then the sheet. */
  back() { this.backAt = performance.now(); if (this.rules) this.closeRules(); else this.close(); }
  private backAt = -Infinity;

  private get info() { return modeHere(this.mode); }
  private fighter(): FighterId { return (this.mode === 'bad-blood' || this.mode === 'rift-war') ? this.bbFighter : this.host.fighter(); }
  private prefs() { return modePrefs(this.mode); }

  private draw() {
    const info = this.info, v = info.variants[this.variant]!, fighter = this.fighter(), seen = explainerSeen(this.mode);
    const go = goLabel(this.mode, v.go, fighterCaption(fighter), this.locked(fighter), this.joining ? this.code : undefined);
    const art = info.cover ?? `/assets/home/modes/${info.art}.webp`;
    const facts = [info.facts.players, info.facts.length, info.facts.lives].map(f => `<span>${escape(f)}</span>`).join('');
    const howTo = this.panels
      ? `<div class="ms-panels">${info.howTo.map((line, i) => `<figure class="ms-panel"><span class="ms-pic" style="${this.panelArt(info.panels[i], fighter)}"><b>${i + 1}</b></span><figcaption class="ux-keys">${promptText(line)}</figcaption></figure>`).join('')}</div>`
      : `<ol class="ms-bullets ux-keys">${info.howTo.map(line => `<li><span>${promptText(line)}</span></li>`).join('')}</ol>`;
    // Every mode's blows can be blocked and parried, the horde's too: the PARRY stream's three lessons (defence.ts).
    const defence = `<details class="ms-defence" open><summary>DEFENCE BASICS</summary><ul class="ux-keys ux-defence">${defenceBasics()}</ul></details>`;
    const tabs = VARIANT_ORDER.filter(id => info.variants[id]).map(id => { const each = info.variants[id]!; return `<button type="button" role="tab" data-ms-variant="${id}" aria-selected="${id === this.variant}" tabindex="${id === this.variant ? 0 : -1}">${escape(each.label)}<small>${escape(each.tag)}</small></button>`; }).join('');
    this.dialog.dataset.mode = this.mode; this.dialog.dataset.variant = this.variant;
    const prefs = this.prefs(), shown = this.joining ? undefined : placeShown(this.mode, this.variant, prefs.stage, this.field());
    const home = HOME_PLACE[this.mode], place = shown?.id ?? (shown ? undefined : home);
    const stage = place ? `url('${placePicture(place)}'),url('${placePicture(place, true)}')` : `url('${art}')`;
    this.dialog.classList.toggle('ms-on-art', !place);
    const shots = pictures(fighter, false), couch = this.variant === 'couch';
    if (couch && !this.seats) { this.seats = [...plannedSeats(!!prefs.couchSwap)]; this.padsKey = this.presence.present(seatablePads(this.pads()), this.seats, performance.now()).join(','); }
    const fight = `<button type="button" class="ms-go" data-ms-go${this.host.busy() || this.unsupported ? ' disabled' : ''}><span>${escape(go.label)}<small>${escape(go.note ?? this.goNote())}</small></span><i aria-hidden="true">▶</i></button>
        <p class="ms-hint ux-keys">${this.hint(go.label)}</p>`;
    const play = couch
      ? `<div class="ms-right"><section class="ms-play ms-duo"><div class="ms-pair">${this.card(1, fighter)}${this.card(2, this.p2())}</div>${fight}</section>${this.p2Grid()}</div>`
      : `<section class="ms-play">
        <div class="ms-bust" aria-hidden="true"><img alt="" src="${shots[0]}" data-pics="${shots.join(' ')}"></div>
        ${this.you(fighter)}
        ${fight}
      </section>`;
    this.dialog.innerHTML = `
      <div class="ms-stage" style="background-image:${stage}" aria-hidden="true"></div>
      <button type="button" class="ms-close" data-ms-close aria-label="Back to home">×</button>
      <section class="ms-mode">
        ${info.kicker ? `<small class="ms-kicker">${escape(info.kicker)}</small>` : ''}
        <h2 id="ms-title">${escape(info.name)}</h2>
        <p class="ms-goal">${escape(info.goal)}</p>
        <p class="ms-links"><button type="button" class="ms-link" data-ms-howto>HOW TO PLAY</button>${this.mode === 'arcade' && this.host.story ? '<button type="button" class="ms-link" data-ms-story>WATCH THE STORY ▶</button>' : ''}</p>
        <div class="ms-tabs" role="tablist" aria-label="Ways to play">${tabs}</div>
        <p class="ms-note">${escape(this.joining ? "You're joining a friend's room: they choose the rules." : v.note)}</p>
        ${this.modeOptions()}
        ${this.variant === 'online' || this.variant === 'friends' ? `<label class="ms-name"><span>YOUR NAME</span><input maxlength="18" autocomplete="nickname" value="${escape(this.host.name())}"></label>` : ''}
        ${this.variant === 'friends' ? `<form class="ms-join"><input inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="6-DIGIT CODE" aria-label="Room code" autocomplete="off" value="${escape(this.code)}"><button type="submit">JOIN</button></form>` : ''}
        <p class="ms-status" role="status" aria-live="polite">${escape(this.status)}</p>
      </section>
      ${shown ? `<section class="ms-where" aria-live="polite"><small>LOCATION · ${shown.at} / ${shown.of}</small><b>${escape(shown.name)}</b><em>${escape(shown.scene)}</em></section>` : ''}
      ${this.joining ? '' : placeRow(this.mode, this.variant, prefs.stage, this.field())}
      ${play}
      <section class="ms-rules" role="group" aria-label="How to play"${this.rules ? '' : ' hidden'}>
        <header><h3>HOW TO PLAY</h3>${!seen ? '<span class="ms-stamp">FIRST TIME</span>' : ''}<button type="button" class="ms-rules-close" data-ms-rules-close>${seen ? 'CLOSE ✕' : 'GOT IT ✓'}</button></header>
        ${this.host.learn ? learnButton() : ''}
        <h4>HOW YOU WIN</h4>
        <p class="ms-win">${escape(info.win)}</p>
        <div class="ms-facts">${facts}</div>
        <h4>THE BASICS <button type="button" class="ms-link" data-ms-panels>${this.panels ? 'SHORT VERSION' : 'SHOW ME THE PICTURES'}</button></h4>
        ${howTo}
        ${defence}
      </section>`;
    this.busts();
    this.dialog.querySelector('.ms-place-tile[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    if (couch) this.showP2Faces(true);
  }
  /** A fighter with no bust yet shows the next picture they have (proto.ts pictures: their bust, then their portrait). */
  private busts() {
    for (const bust of this.dialog.querySelectorAll<HTMLImageElement>('.ms-bust img:not([data-watched])')) {
      bust.dataset.watched = '';
      bust.addEventListener('error', () => { const pics = bust.dataset.pics!.split(' '), next = pics[pics.indexOf(bust.getAttribute('src')!) + 1]; if (next) bust.src = next; else bust.remove(); });
    }
  }
  private panelArt(panel: Panel, fighter: FighterId) {
    if ('move' in panel) return `background-image:url('${moveSheetUrl(moveSheetOf(fighter, false))}');background-size:500% auto;background-position:${MOVE_X[panel.move]} center;background-color:#0d1825`;
    return `background-image:url('${panel.src}');background-position:${panel.at ?? 'center'}`;
  }
  /** The fighters in the field, for the ways that have one: the royale's bots, or the room a host opens. */
  private field(): number | undefined {
    if (this.mode !== 'royale') return undefined;
    return this.variant === 'offline' || this.variant === 'couch' ? this.prefs().fighters ?? defaultRoyaleFighters() : this.variant === 'friends' ? this.prefs().roomSize ?? 8 : undefined;
  }
  /** The mode's own options; the LOCATION's film strip stands at the sheet's foot (draw), where the way can choose a
   *  place (not when joining a friend's room: they choose it). */
  private modeOptions() {
    const prefs = this.prefs();
    const row = (label: string, attr: string, values: number[], on: number, name = (n: number) => String(n)) => `<div class="ms-option" role="group" aria-label="${label}"><b>${label}</b>${values.map(n => `<button type="button" ${attr}="${n}" aria-pressed="${n === on}">${name(n)}</button>`).join('')}</div>`;
    const rival = (label: string, random: string) => { const face = (id: FighterId) => `<option value="${id}" data-face="${id}" data-short="${escape(fighterCaption(id))}"${prefs.rival === id ? ' selected' : ''}>${escape(FIGHTERS[id].name)}</option>`, out = (ids: readonly FighterId[]) => ids.filter(id => isReleasedFighter(id) && !HELD.has(id)).map(face).join('');
      return `<label class="ms-option ms-rival"><b>${label.toUpperCase()}</b><ink-select layout="faces" data-ms-rival label="${label}"><option value="" data-short="RANDOM"${prefs.rival && HOME_ROSTER.includes(prefs.rival) ? '' : ' selected'}>${random}</option>${HOME_VOLUMES.map((ids,i)=>`<optgroup label="VOL.${i+1}">${out(ids)}</optgroup>`).join('')}</ink-select></label>`; };
    // Couch: Player 2's options - with the royale's field size, and Bad Blood's and the Rift's sides and Player 1's own pick.
    if (this.variant === 'couch') return `${this.mode === 'royale' ? row('FIGHTERS', 'data-ms-fighters', FIGHTER_COUNTS, prefs.fighters ?? defaultRoyaleFighters()) : ''}${this.mode === 'bad-blood' || this.mode === 'rift-war' ? this.sideOptions() : ''}${this.couchOptions()}`;
    if (this.mode === 'duel' && this.variant === 'offline') return rival('Bot opponent', 'Random rival');
    if (this.mode === 'training') return rival('Opponent', 'Random opponent');
    if (this.mode === 'royale' && this.variant === 'offline') return row('FIGHTERS', 'data-ms-fighters', FIGHTER_COUNTS, prefs.fighters ?? defaultRoyaleFighters());
    if (this.mode === 'royale' && this.variant === 'friends' && !this.joining) return row('ROOM SIZE', 'data-ms-room', ROOM_SIZES, prefs.roomSize ?? 8, n => n === 2 ? '1V1' : String(n));
    if (this.mode === 'last-stand' && this.variant === 'offline') return `<div class="ms-option" role="group" aria-label="Defenders"><b>DEFENDERS</b><button type="button" data-ms-lone="false" aria-pressed="${!prefs.lone}">WITH 3 BOTS</button><button type="button" data-ms-lone="true" aria-pressed="${!!prefs.lone}">LONE DEFENDER</button></div>${prefs.lone ? '<p class="ms-note ms-warn">Just you. Nobody can revive you.</p>' : ''}`;
    if ((this.mode === 'bad-blood' || this.mode === 'rift-war')) return this.sideOptions();
    return '';
  }
  /** Bad Blood's and the Rift's own pick: the side, and the fighter on it. */
  private sideOptions() {
    const pool = (this.side === 'heroes' ? HEROES : VILLAINS).filter(id => HOME_ROSTER.includes(id));
    return `<div class="ms-option" role="group" aria-label="Your side"><b>YOUR SIDE</b><button type="button" data-ms-side="heroes" aria-pressed="${this.side === 'heroes'}">HEROES <small>↻ ${this.mode === 'rift-war' ? 'DAWN ALLIANCE' : RULES.heroReviveSeconds + 's RETURN'}</small></button><button type="button" data-ms-side="villains" aria-pressed="${this.side === 'villains'}">VILLAINS <small>${this.mode === 'rift-war' ? 'ECLIPSE LEGION' : RULES.villainMultiplier + '× POWER'}</small></button></div>
        <div class="ms-faces" role="group" aria-label="${this.side === 'heroes' ? 'Heroes' : 'Villains'}">${pool.map(id => `<button type="button" data-ms-pick="${id}" aria-pressed="${id === this.bbFighter}" aria-label="${escape(FIGHTERS[id].name)}"><span class="ms-face-art">${mangaPortrait(id)}</span><span class="ms-face-name">${escape(FIGHTERS[id].name.split(' ')[0])}</span></button>`).join('')}</div>`;
  }
  /** Couch: Bad Blood's and the Rift's side for Player 2, the SCREEN (each way drawn, with its name under it), and who
   *  sits where - the seats the start will use, swappable - with each keyboard half's keys when the keyboard is shared.
   *  Player 2's fighter is picked beside the busts (p2Grid). */
  private couchOptions() {
    const prefs = this.prefs();
    // Bad Blood and the Rift pick their teams by faction: Player 2 stands on Player 1's side or the other, and picks from it.
    const sides = this.mode === 'bad-blood' || this.mode === 'rift-war' ? `<div class="ms-option" role="group" aria-label="Player 2's side"><b>P2 SIDE</b><button type="button" data-ms-sides="same" aria-pressed="${this.sides() === 'same'}">WITH YOU</button><button type="button" data-ms-sides="rivals" aria-pressed="${this.sides() === 'rivals'}">AGAINST YOU</button></div>` : '';
    const screen = screenFor(this.mode, prefs.couchScreen), ways = SCREENS[this.mode];
    const screens = `<div class="ms-option ms-screens" role="group" aria-label="Screen"><b>SCREEN</b>${ways.map(way => `<button type="button" data-ms-screen="${way}" aria-pressed="${way === screen}" title="${escape(SCREEN_WORDS[way].note)}" aria-label="${escape(SCREEN_WORDS[way].label)}: ${escape(SCREEN_WORDS[way].note)}">${screenIcon(way)}<span>${escape(SCREEN_WORDS[way].label)}</span></button>`).join('')}</div>`;
    return `${sides}${screens}<div class="ms-option ms-couch" role="group" aria-label="Controls">${this.seatsHtml()}</div>`;
  }
  /** Bad Blood's and the Rift's couch: whether Player 2 stands with Player 1 or against them. */
  private sides(): 'same' | 'rivals' { return this.prefs().couchSides ?? 'rivals'; }
  private pads(): (PadState | null)[] { return typeof navigator === 'object' && typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()) as unknown as (PadState | null)[] : []; }
  private seatsHtml() {
    const seats = this.seats ?? plannedSeats(!!this.prefs().couchSwap), lines = seatsLine(seats);
    // A phone or a tablet has no keyboard to split: couch play there is two controllers (Bluetooth pads work in the browser).
    const pads = seats.filter(seat => seat.kind === 'pad').length;
    if (touchFirst() && pads < 2) return `<b>CONTROLS</b><span class="ms-couch-seats"><span>CONNECT ${pads ? 'ONE MORE CONTROLLER' : 'TWO CONTROLLERS'}</span></span><small class="ms-couch-keys">On a phone or a tablet, each player needs a controller (Bluetooth pads work): press a button on each to wake it.</small>`;
    const keys = seats.flatMap(seat => seat.kind === 'keys' ? [seat.layout] : []).map(layout => `<small class="ms-couch-keys">${escape(layout.toUpperCase())}: ${escape(KEY_HELP[layout])}</small>`).join('');
    return `<b>CONTROLS</b><span class="ms-couch-seats">${lines.map(line => `<span>${escape(line)}</span>`).join('')}</span><button type="button" data-ms-swap>SWAP P1 / P2</button>${keys}`;
  }
  /** The seats changed (a pad came or went, or SWAP): the CONTROLS line, each player's device and how Player 2 picks. */
  private redrawSeats() {
    const box = this.dialog.querySelector('.ms-couch'); if (box) box.innerHTML = this.seatsHtml();
    for (const player of [1, 2] as const) { const tag = this.dialog.querySelector(`.ms-card[data-player="${player}"] .ms-device`); if (tag) tag.innerHTML = this.deviceTag(player); }
    const hint = this.dialog.querySelector('.ms-play .ms-hint'); if (hint) hint.innerHTML = this.hint(this.dialog.querySelector('.ms-go span')?.firstChild?.textContent ?? '');
  }
  /** Every fighter Player 2 may be shown, in the roster's order (its volumes): released and not held back, as on the home;
   *  in Bad Blood and the Rift, from the side Player 2 stands on. Locked ones are shown, as they are to Player 1, but are
   *  not Player 2's to take (partnerOpen). */
  private couchPool(): FighterId[] {
    const shown = HOME_VOLUMES.flat().filter(id => HOME_ROSTER.includes(id) && isReleasedFighter(id) && !HELD.has(id));
    if (this.mode !== 'bad-blood' && this.mode !== 'rift-war') return shown;
    // Bad Blood's and the Rift's: the side Player 2 stands on, against Player 1's.
    const side = this.sides() === 'same' ? this.side : this.side === 'heroes' ? 'villains' : 'heroes';
    return shown.filter(id => isBadBloodFighter(id) && factionOf(id) === side);
  }
  /** Player 2 can take this fighter: not Player 1's own, and not locked (Training takes every fighter, for both). */
  private readonly partnerOpen = (id: FighterId) => id !== this.fighter() && !this.locked(id);
  /** Player 2's pick as shown: the one saved for this mode while it is open to them, else the next after Player 1's. */
  private p2(): PartnerPick { return partnerShown(this.prefs().partner, this.fighter(), this.couchPool(), this.partnerOpen); }
  /** A player's card in the couch's pair: the bust, PLAYER 1 / PLAYER 2 and the device, and the fighter's name - with
   *  Player 1's CHANGE (back to the roster), or Player 2's arrows (a step along their picks). */
  private card(player: 1 | 2, pick: PartnerPick) {
    const random = pick === 'random', shots = random ? [] : pictures(pick, false);
    const bust = random ? '<div class="ms-bust ms-bust-random" aria-hidden="true"><b>?</b></div>' : `<div class="ms-bust" aria-hidden="true"><img alt="" src="${shots[0]}" data-pics="${shots.join(' ')}"></div>`;
    const name = random ? 'RANDOM' : FIGHTERS[pick].name;
    const face = random ? '<span class="ms-face ms-face-random" aria-hidden="true">?</span>' : `<span class="ms-face">${mangaPortrait(pick)}</span>`;
    const own = this.mode === 'bad-blood' || this.mode === 'rift-war';
    const tools = player === 1 ? (own ? '' : '<button type="button" class="ms-link" data-ms-change>CHANGE</button>')
      : '<span class="ms-steps"><button type="button" data-ms-p2-step="-1" aria-label="Player 2: the fighter before">◀</button><button type="button" data-ms-p2-step="1" aria-label="Player 2: the next fighter">▶</button></span>';
    const locked = player === 1 && !random && this.locked(pick) ? ' · <b class="ms-locked">LOCKED</b>' : '';
    return `<div class="ms-card" data-player="${player}">${bust}<div class="ms-you">${face}<div><small>PLAYER ${player}${locked}</small><strong>${escape(name)}</strong><span class="ms-device">${this.deviceTag(player)}</span></div>${tools}</div></div>`;
  }
  /** A player's device under their name, and for Player 2 how they pick: their stick or D-pad, or their keys. */
  private deviceTag(player: 1 | 2) {
    const seat = this.seats?.[player - 1];
    if (!seat) return '';
    // A phone or a tablet: no keyboard to sit at (the CONTROLS line asks for the controllers).
    if (seat.kind === 'keys' && touchFirst()) return 'CONNECT A CONTROLLER';
    const name = seatsLine([seat])[0].replace(/^P1 · /, '');
    if (player === 1) return escape(name);
    if (seat.kind === 'pad') return `${escape(name)} · ${padKey(currentDevice().family, 'left')}${padKey(currentDevice().family, 'right')} PICK`;
    // The keys Player 2 picks with (p2Keys): the arrows, or W A S D on the keyboard's left half.
    const cap = (code: string) => `<kbd>${escape(KEY_CAPS[code] ?? code.replace(/^Key/, ''))}</kbd>`, arrows = seat.layout !== 'left';
    return `${escape(name)} · ${(arrows ? ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] : ['KeyA', 'KeyD', 'KeyW', 'KeyS']).map(cap).join('')} PICK`;
  }
  /** Player 2's faces: RANDOM, then every fighter shown to them (couchPool), Player 1's own marked P1 and a locked one
   *  LOCKED. The portraits load as they scroll into view (showP2Faces). */
  private p2Grid() {
    const p1 = this.fighter(), shown = this.p2();
    const tile = (id: FighterId) => {
      const mine = id === p1, locked = !mine && this.locked(id), off = mine || locked;
      return `<button type="button" data-ms-p2pick="${id}" aria-pressed="${id === shown}" aria-label="${escape(FIGHTERS[id].name)}${mine ? ', Player 1' : locked ? ', locked' : ''}"${off ? ' disabled' : ''}><span class="ms-face-art">${mangaPortrait(id, true)}</span><span class="ms-face-name">${escape(fighterCaption(id))}</span>${mine ? '<i class="ms-tag">P1</i>' : locked ? '<i class="ms-tag ms-tag-locked">LOCKED</i>' : ''}</button>`;
    };
    const random = `<button type="button" data-ms-p2pick="random" aria-pressed="${shown === 'random'}" aria-label="Random fighter"><span class="ms-face-art ms-face-random" aria-hidden="true">?</span><span class="ms-face-name">RANDOM</span></button>`;
    return `<section class="ms-p2" aria-label="Player 2's fighter"><h4><b>PLAYER 2</b> CHOOSE YOUR FIGHTER</h4><div class="ms-faces ms-p2-faces" role="group" aria-label="Player 2's fighter">${random}${this.couchPool().map(tile).join('')}</div></section>`;
  }
  /** Player 2's pick, from a click, their arrows or their device: saved for the mode, and shown at once - the bust, the
   *  name, the face pressed - without redrawing the sheet (the focus stays where it is). */
  private setP2(pick: PartnerPick) {
    if (pick === this.p2()) return;
    saveModePrefs(this.mode, { partner: pick });
    const card = this.dialog.querySelector('.ms-card[data-player="2"]');
    if (card) { card.outerHTML = this.card(2, this.p2()); this.busts(); }
    const now = this.p2();
    for (const tile of this.dialog.querySelectorAll<HTMLElement>('[data-ms-p2pick]')) tile.setAttribute('aria-pressed', String(tile.dataset.msP2pick === now));
    this.showP2Faces(false);
  }
  /** Player 2's grid: the face picked kept in view inside it (scrolled within the grid alone: the sheet does not move),
   *  and the portraits near the view given their pictures. */
  private showP2Faces(first: boolean) {
    const grid = this.dialog.querySelector<HTMLElement>('.ms-p2-faces');
    if (!grid) return;
    const picked = grid.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (picked && grid.clientHeight) {
      // (Down the grid on a desktop; along it on a phone, whose faces run in two rows to swipe.)
      const view = grid.getBoundingClientRect(), r = picked.getBoundingClientRect();
      if (r.top < view.top) grid.scrollTop -= view.top - r.top + 4; else if (r.bottom > view.bottom) grid.scrollTop += r.bottom - view.bottom + 4;
      if (r.left < view.left) grid.scrollLeft -= view.left - r.left + 4; else if (r.right > view.right) grid.scrollLeft += r.right - view.right + 4;
    }
    const near = () => { const view = grid.getBoundingClientRect(); for (const tile of grid.querySelectorAll<HTMLElement>('[data-ms-p2pick]')) { const r = tile.getBoundingClientRect(); if (r.bottom >= view.top - r.height * 2 && r.top <= view.bottom + r.height * 2 && r.right >= view.left - r.width * 3 && r.left <= view.right + r.width * 3) showPortraits(tile); } };
    near();
    if (first) grid.addEventListener('scroll', near, { passive: true });
  }
  /** Player 2's step: left and right along their picks (round the ends), up and down to the face above or below. */
  private stepP2(direction: Direction) {
    const current = this.p2();
    if (direction === 'left' || direction === 'right') { this.setP2(stepPartner(partnerChoices(this.couchPool(), this.partnerOpen), current, direction === 'right' ? 1 : -1)); return; }
    const tiles = [...this.dialog.querySelectorAll<HTMLButtonElement>('[data-ms-p2pick]:not(:disabled)')], at = tiles.findIndex(t => t.dataset.msP2pick === current);
    const rects = tiles.map(t => t.getBoundingClientRect());
    if (at < 0 || !rects[at].width) return;
    const i = nearest(rects[at], rects, direction);
    if (i >= 0) this.setP2(tiles[i].dataset.msP2pick as PartnerPick);
  }
  /** Which seat (0, 1) a pad is on, or -1. */
  private seatOfPad(index: number | null | undefined) { return index === null || index === undefined || !this.seats ? -1 : this.seats.findIndex(d => d.kind === 'pad' && d.index === index); }
  /** The couch's seats against the pads now: a pad that came or went moves them, as it does mid-fight (reseat). */
  private checkPads() {
    if (!this.seats || document.hidden) return;
    const seatable = this.presence.present(seatablePads(this.pads()), this.seats, performance.now()), key = seatable.join(',');
    if (key === this.padsKey) return;
    this.padsKey = key;
    const next = reseat(this.seats, seatable);
    if (next !== this.seats) this.seats = [...next];
    this.redrawSeats();
  }
  /** While the couch way is up: the pads looked at every frame (a pad a browser has only just shown arrives without an
   *  event), and each seat's pad that the page's menus do not read is read here - Player 2's steps their pick, Player 1's
   *  moves the sheet's focus. */
  private watch() {
    if (this.watching || typeof requestAnimationFrame !== 'function') return;
    const tick = (now: number) => {
      this.watching = 0;
      if (!this.dialog.open || this.variant !== 'couch') return;
      this.checkPads();
      // The prompts follow the device last touched (a pad's glyphs once a pad is used, the keys' after a key).
      const device = currentDevice().device;
      if (device !== this.device) { this.device = device; this.redrawSeats(); }
      const pads = this.pads(), menu = this.host.menuPad?.() ?? null;
      this.seats?.forEach((device, seat) => {
        if (device.kind !== 'pad' || device.index === menu) return;
        for (const action of this.seatPads[seat].read(pads[device.index] ?? undefined, false, now).ui) {
          const direction = UI_DIRECTION[action];
          if (seat === 1) { if (direction && !this.rules) this.stepP2(direction); }
          else this.controller(action, 0);
        }
      });
      this.watching = requestAnimationFrame(tick);
    };
    this.watching = requestAnimationFrame(tick);
  }
  private you(fighter: FighterId) {
    const swapped = (this.mode === 'bad-blood' || this.mode === 'rift-war') && fighter !== this.host.fighter();
    return `<div class="ms-you"><span class="ms-face">${mangaPortrait(fighter)}</span><div><small>YOUR FIGHTER${swapped ? ' · FOR THIS MODE' : ''}${this.locked(fighter) ? ' · <b class="ms-locked">LOCKED</b>' : ''}</small><strong>${escape(FIGHTERS[fighter].name)}</strong></div>${(this.mode === 'bad-blood' || this.mode === 'rift-war') ? '' : '<button type="button" class="ms-link" data-ms-change>CHANGE</button>'}</div>`;
  }
  /** The fighter is not this account's to play here (economy/fighters.ts): the start would open the shop on them
   *  (shop/boot.ts lockedStart). Training takes every fighter. */
  private locked(fighter: FighterId) { return this.mode !== 'training' && !mayPlay(fighter, account.account); }
  private goNote() {
    if (this.unsupported) return 'NEEDS WEBGL 2';
    if (this.variant === 'friends') return "YOU'LL GET A 6-DIGIT CODE";
    if (this.variant === 'couch') return '2 PLAYERS · ON THIS DEVICE';
    if (this.variant === 'online') return this.mode === 'duel' ? 'REAL PLAYERS ONLY' : 'MATCHMAKING';
    // Hosted rooms use their own ready gate; local modes can pause on this device.
    if (!this.info.variants[this.variant]?.onDevice) return 'STARTS AT ONCE';
    return this.mode === 'training' ? 'NO STAKES' : 'ON THIS DEVICE';
  }
  private hint(go: string) {
    const { device, family } = currentDevice();
    // Couch: the arrows are Player 2's to pick with (their card says so), so a pad's shoulder buttons turn the ways.
    const couchKeys = this.variant === 'couch' && this.seats?.[1]?.kind === 'keys';
    const arrows = device === 'controller' ? (this.variant === 'couch' ? `${padKey(family, 'l1')}${padKey(family, 'r1')}` : `${padKey(family, 'left')}${padKey(family, 'right')}`) : couchKeys ? '' : '<kbd>←</kbd><kbd>→</kbd>';
    return `${arrows ? `${arrows} WAY TO PLAY · ` : ''}${promptKey('confirm')} ${escape(go)} · ${promptKey('back')} BACK`;
  }
  /** The loading screen's art for the way chosen, fetched now so it never comes in blank (LoadingScreen). */
  private preload() {
    const mode: LoadingMode = this.mode === 'royale' ? (this.variant === 'offline' ? 'bots' : this.variant === 'online' ? 'players' : 'private') : this.mode;
    preloadLoadingArt(mode, this.fighter());
  }

  /** GO: the chosen way, as the access the start code already understands. */
  go(join = false) {
    if (this.host.busy()) { this.say('Preparing your match…'); return; }
    if (this.unsupported) { this.say("This browser can't draw the game: it needs WebGL 2. Try the latest Chrome, Safari, Edge or Firefox."); return; }
    const fighter = this.fighter(), prefs = this.prefs(), mode = this.mode;
    if (join && !/^\d{6}$/.test(this.code)) { this.say('Enter the 6-digit room code.'); this.focus('.ms-join input'); return; }
    // The place named for this way (undefined: RANDOM, or a way with no choice - online, or a joined room): the start deals it.
    const place = join ? undefined : namedPlaceFor(mode, this.variant, this.field());
    const objective = (access: 'quick' | 'bots' | 'solo' | 'host' | 'join'): Extract<NetworkAccess, { kind: 'objective' }> => ({ kind: 'objective', objective: mode as 'last-stand' | 'bad-blood', access, role: mode === 'bad-blood' ? factionOf(fighter) : 'defenders', fighter, code: join ? this.code : undefined, place });
    let room: RoomMode = 'match', access: NetworkAccess | undefined;
    const couch: CouchStart | undefined = this.variant === 'couch' && !join ? { partner: this.partnerOf(fighter), screen: screenFor(mode, prefs.couchScreen), ...(mode === 'bad-blood' || mode === 'rift-war' ? { sides: this.sides() } : {}), ...(this.seats ? { seats: [...this.seats] } : {}) } : undefined;
    switch (mode) {
      case 'rift-war': access = couch ? { kind: 'rift-war', access: 'bots', couch } : {kind:'rift-war',access:join?'join':this.variant==='offline'?'bots':this.variant==='online'?'quick':'host',code:join?this.code:undefined}; break;
      case 'duel': access = couch ? { kind: 'duel', access: 'couch', rival: couch.partner, place, couch } : { kind: 'duel', access: join ? 'join' : this.variant === 'offline' ? 'bot' : this.variant === 'online' ? 'online' : 'host', code: join ? this.code : undefined, rival: prefs.rival, place }; break;
      case 'royale': access = join ? { kind: 'join-private', code: this.code } : couch ? { kind: 'bots', players: prefs.fighters ?? defaultRoyaleFighters(), place, couch } : this.variant === 'offline' ? { kind: 'bots', players: prefs.fighters ?? defaultRoyaleFighters(), place } : this.variant === 'online' ? { kind: 'public' } : { kind: 'create-private', players: prefs.roomSize ?? 8, place }; break;
      case 'training': room = 'training'; if (couch) access = { kind: 'training', couch }; break;
      case 'arcade': access = join ? { kind: 'coop-join', code: this.code } : couch ? { kind: 'survival', partner: couch.partner, couch } : this.variant === 'offline' ? { kind: 'survival' } : this.variant === 'online' ? { kind: 'coop-join', code: '', quick: true } : { kind: 'coop-create' }; break;
      case 'last-stand': access = couch ? { ...objective('bots'), couch } : objective(join ? 'join' : this.variant === 'offline' ? (prefs.lone ? 'solo' : 'bots') : this.variant === 'online' ? 'quick' : 'host'); break;
      case 'bad-blood': access = couch ? { ...objective('bots'), couch } : objective(join ? 'join' : this.variant === 'offline' ? 'bots' : this.variant === 'online' ? 'quick' : 'host'); break;
    }
    saveModePrefs(mode, { variant: this.variant });
    markExplainerSeen(mode);
    this.pending = { mode, variant: this.variant, at: performance.now() };
    this.close();
    this.host.start(fighter, room, access);
  }
  /** Player 2's fighter for a couch start: the one on their card, or for RANDOM any fighter open to them. */
  private partnerOf(fighter: FighterId): FighterId {
    const pick = this.p2();
    if (pick !== 'random') return pick;
    const open = this.couchPool().filter(this.partnerOpen);
    return open.length ? open[Math.floor(Math.random() * open.length)] : fighter;
  }
  say(text: string) { this.status = text; const el = this.dialog.querySelector('.ms-status'); if (el) el.textContent = text; this.showStatus(); }
  /** The sheet's answer in view (overnight UX, 9 October 2026): on a phone it sits under GO and the JOIN row, below
   *  the fold - "The servers are restarting. Try again in a minute." was never seen. A desktop's is already in view. */
  private showStatus() { if (this.status) this.dialog.querySelector('.ms-status')?.scrollIntoView({ block: 'nearest' }); }

  private setVariant(variant: VariantId) {
    if (!this.info.variants[variant] || variant === this.variant) return;
    this.variant = variant; this.status = ''; saveModePrefs(this.mode, { variant });
    this.draw(); this.focus(`[data-ms-variant="${variant}"]`); this.preload(); this.watch();
  }
  private click(event: Event) {
    const target = event.target as HTMLElement;
    if (target === this.dialog) { this.close(); return; }   // the backdrop
    const b = target.closest<HTMLButtonElement>('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.msClose !== undefined) this.close();
    else if (d.msVariant) this.setVariant(d.msVariant as VariantId);
    else if (d.msGo !== undefined) this.go(this.joining);
    else if (b.closest('.ms-join') && b.type === 'submit') { event.preventDefault(); this.code = this.dialog.querySelector<HTMLInputElement>('.ms-join input')!.value.replace(/\D/g, ''); this.go(true); }
    else if (d.msPanels !== undefined) { this.panels = !this.panels; this.draw(); this.focus('[data-ms-panels]'); }
    else if (d.msHowto !== undefined) { this.rules = true; this.draw(); this.focus('[data-ms-rules-close]'); }
    else if (d.msRulesClose !== undefined) this.closeRules();
    // The LOCATION: remembered for the mode ('random' until a place is named), whichever way it was picked on.
    else if (d.msPlace !== undefined) { saveModePrefs(this.mode, { stage: (d.msPlace || 'random') as StageChoice }); this.redrawKeeping(b); }
    else if (d.msChange !== undefined) { this.close(); this.host.changeFighter(); }
    else if (d.msStory !== undefined) { this.close(); this.host.story?.(); }
    else if (d.msLearn !== undefined) { this.close(); this.host.learn?.(); }
    else if (d.msFighters) { saveModePrefs(this.mode, { fighters: Number(d.msFighters) }); this.redrawKeeping(b); }
    else if (d.msRoom) { saveModePrefs(this.mode, { roomSize: Number(d.msRoom) }); this.redrawKeeping(b); }
    else if (d.msLone) { saveModePrefs(this.mode, { lone: d.msLone === 'true' }); this.redrawKeeping(b); }
    else if (d.msSwap !== undefined) { saveModePrefs(this.mode, { couchSwap: !this.prefs().couchSwap }); if (this.seats) this.seats = [this.seats[1], this.seats[0]]; this.redrawSeats(); this.focus('[data-ms-swap]'); }
    // Couch: Player 2's face, or a step along their picks with the arrows on their card.
    else if (d.msP2pick) this.setP2(d.msP2pick as PartnerPick);
    else if (d.msP2Step) this.stepP2(Number(d.msP2Step) > 0 ? 'right' : 'left');
    else if (d.msScreen) { saveModePrefs(this.mode, { couchScreen: d.msScreen as CouchStart['screen'] }); this.redrawKeeping(b); }
    else if (d.msSides) { saveModePrefs(this.mode, { couchSides: d.msSides as 'same' | 'rivals' }); this.redrawKeeping(b); }
    else if (d.msSide) {
      // Over to a side: the fighter last chosen there, else the home's own fighter if they belong there, else its first.
      this.side = d.msSide as 'heroes' | 'villains';
      const home = this.host.fighter(), own = isBadBloodFighter(home) && factionOf(home) === this.side ? home : undefined;
      this.bbFighter = this.picks[this.side] ?? own ?? (this.side === 'heroes' ? 'taisei' : 'oro');
      this.picks[this.side] = this.bbFighter; this.redrawKeeping(b);
    }
    else if (d.msPick) { this.bbFighter = d.msPick as FighterId; this.picks[this.side] = this.bbFighter; this.redrawKeeping(b); }
  }
  /** HOW TO PLAY put away: the mode's rules count as seen from now on (the old GOT IT), and the sheet keeps the focus. */
  private closeRules() { markExplainerSeen(this.mode); this.rules = false; this.panels = false; this.draw(); this.focus('[data-ms-howto]'); }
  /** The film strip's next place to the left or right of the one chosen (skipping those that cannot hold the field). */
  private stepPlace(step: 1 | -1) {
    const tiles = [...this.dialog.querySelectorAll<HTMLButtonElement>('.ms-place-tile:not(:disabled)')];
    const at = tiles.findIndex(t => t.getAttribute('aria-selected') === 'true'), next = tiles[(Math.max(0, at) + step + tiles.length) % tiles.length];
    next?.click();
  }
  /** Redraw after an option, keeping focus on the same control. */
  private redrawKeeping(b: HTMLElement) {
    const attr = Object.keys(b.dataset).find(k => k.startsWith('ms'));
    const value = attr ? b.dataset[attr] : undefined;
    this.draw();
    if (attr) this.focus(`[data-${attr.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${value}"]`);
  }
  private key(event: KeyboardEvent) {
    const tab = (event.target as HTMLElement).closest<HTMLElement>('[data-ms-variant]');
    if (tab && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault(); this.setVariant(nextWay(VARIANT_ORDER.filter(v => this.info.variants[v]), this.variant, event.key === 'ArrowRight' ? 1 : -1));
    }
    // ← → on the film strip pick the next place, as a stage select does.
    if ((event.target as HTMLElement).closest('.ms-place-tile') && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); this.stepPlace(event.key === 'ArrowRight' ? 1 : -1); return; }
    // Couch: Player 2's keys (the arrows, or W A S D on the keyboard's left half) step Player 2's pick - anywhere but the
    // ways' tabs and the film strip, whose arrows turn them, and a field being typed in.
    const p2 = this.variant === 'couch' && !this.rules ? this.seats?.[1] : undefined;
    if (p2?.kind === 'keys' && !tab && !(event.target as HTMLElement).closest('input,textarea,select,ink-select') && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const k = keysOf(p2.layout), code = event.code;
      const direction: Direction | undefined = k.left.includes(code) ? 'left' : k.right.includes(code) ? 'right' : k.forward.includes(code) ? 'up' : k.backward.includes(code) ? 'down' : undefined;
      if (direction) { event.preventDefault(); event.stopPropagation(); this.stepP2(direction); return; }
    }
    // Enter on a way's tab (after ← → or a click on it) starts that way, as the hint says.
    if (tab && event.key === 'Enter') { event.preventDefault(); this.go(this.joining); return; }
    if (event.key === 'Enter' && (event.target as HTMLElement).closest('.ms-join input')) { event.preventDefault(); this.code = (event.target as HTMLInputElement).value.replace(/\D/g, ''); this.go(true); }
  }
  private input(event: Event) {
    const el = event.target as HTMLInputElement;
    if (el.closest('.ms-join')) { el.value = el.value.replace(/\D/g, '').slice(0, 6); this.code = el.value; }
    else if (el.closest('.ms-name')) this.host.setName(el.value);
  }
  private paste(event: ClipboardEvent) {
    const invite = readInvite(event.clipboardData?.getData('text') ?? '');
    if (!invite || !(event.target as HTMLElement).closest('.ms-join')) return;
    event.preventDefault();
    const mode: ModeId = invite.kind === 'duel' ? 'duel' : invite.kind === 'coop' ? 'arcade' : 'royale';
    this.show(mode, { variant: 'friends', code: invite.code, status: `Invite ready · ${MODES[mode].name}. Press JOIN when ready.` });
  }
  private focus(selector: string) { this.dialog.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true }); }

  /** A pad on the sheet: the D-pad moves between controls by where they sit, ✕ presses, ○ closes. On the couch way,
   *  Player 2's pad (`seat` 1: the pad the page's menus read is Player 2's) steps Player 2's pick with its directions. */
  controller(action: UiAction, seat = this.seatOfPad(this.host.menuPad?.())): boolean {
    if (!this.dialog.open) return false;
    const step = UI_DIRECTION[action];
    if (this.variant === 'couch' && seat === 1 && step && !this.rules && !this.editing) { this.stepP2(step); return true; }
    // With HOW TO PLAY open, the pad moves only over it, and ○ puts it away.
    const scope = this.rules ? this.dialog.querySelector<HTMLElement>('.ms-rules') ?? this.dialog : this.dialog;
    if (this.rules && action === 'back') { this.closeRules(); return true; }
    const items = [...scope.querySelectorAll<HTMLElement>('button:not(:disabled), input, summary')].filter(el => el.getClientRects().length > 0 && !(el as HTMLButtonElement).hidden);
    const active = document.activeElement as HTMLElement;
    const code = this.dialog.querySelector<HTMLInputElement>('.ms-join input');
    // The code typed with the D-pad (padEntry.ts); A ends it on JOIN, B where it is.
    if (this.editing && code) {
      const entry = enterDigit({ value: code.value, digit: this.digit }, action);
      this.digit = entry.digit;
      if (entry.done) { this.editing = false; showEntry(code, undefined); this.code = code.value; this.say(''); if (action === 'confirm') this.focus('.ms-join button[type="submit"]'); return true; }
      showEntry(code, entry); this.code = code.value; return true;
    }
    // LB / RB: the ways to play (OFFLINE / ONLINE / FRIENDS), as D← D→ on their row.
    if (action === 'tabPrevious' || action === 'tabNext') {
      if (!this.rules) this.setVariant(nextWay(VARIANT_ORDER.filter(v => this.info.variants[v]), this.variant, action === 'tabNext' ? 1 : -1));
      return true;
    }
    if (action === 'back') { this.close(); return true; }
    if (!items.includes(active)) { (this.rules ? scope.querySelector<HTMLElement>('[data-ms-rules-close]') : this.dialog.querySelector<HTMLElement>('.ms-go'))?.focus(); return true; }
    if (action === 'confirm') {
      if (active === code) { this.editing = true; this.digit = 0; showEntry(code, { value: code.value.replace(/\D/g, '').padEnd(6, '0').slice(0, 6), digit: 0 }); this.code = code.value; this.say(entryHint()); }
      // ✕ on a way's tab starts that way, as Enter does.
      else if (active.matches('[data-ms-variant]')) this.go(this.joining);
      else active.click();
      return true;
    }
    // Overnight UX (8 October 2026): the ways' tabs are one control for a pad, as for the arrows - D← D→ on the row
    // choose the way (the hint's WAY TO PLAY), and moving onto the row from elsewhere lands on the chosen one. Focus
    // used to walk the tabs without choosing, and ✕ on a tab then started the way still chosen, not the one focused.
    // The film strip, as the ways: D← D→ on it pick the next place.
    if (active.matches('.ms-place-tile') && (action === 'left' || action === 'right')) { this.stepPlace(action === 'right' ? 1 : -1); return true; }
    if (active.matches('[data-ms-variant]') && (action === 'left' || action === 'right')) {
      this.setVariant(nextWay(VARIANT_ORDER.filter(v => this.info.variants[v]), this.variant, action === 'right' ? 1 : -1));
      return true;
    }
    const direction: Direction | undefined = UI_DIRECTION[action];
    if (!direction) return true;
    // The film strip is a row of its own, come to by up and down: left and right from the faces or the options above it
    // went down into it, past GO (a tile there was nearer than GO by a few pixels), and in it left and right turn the place.
    const pool = (direction === 'left' || direction === 'right') && !active.matches('.ms-place-tile') ? items.filter(el => !el.matches('.ms-place-tile')) : items;
    const i = nearest(active.getBoundingClientRect(), pool.map(el => el.getBoundingClientRect()), direction);
    if (i >= 0) (pool[i].matches('[data-ms-variant]') ? this.dialog.querySelector<HTMLElement>('[data-ms-variant][aria-selected="true"]') ?? pool[i] : pool[i]).focus();
    return true;
  }
}
