import { MIN_MATCH_FIELD, MAX_PLAYERS } from '../../game/moves';
import type { UiAction } from '../../input/gamepad';
import type { ModeHudFrame, HudLayoutId } from '../hud/modeHud';
import { promptKey } from '../prompts';
import { nearest, type Direction } from '../spatialFocus';
import './waitingDock.css';
import { population } from '../../social/population';
import { dockLine } from '../social/socialPlay';

const LOADING_ROOM = "LOADING EVERYONE'S FIGHTERS…";
export const BOT_OFFER_SECONDS = 30;
const time = (seconds: number) => { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** What the dock says while a main-game room waits: a queue, a public room filling, or a friends room. `offerAt`: the
 *  wait after which a lone Duel queue offers a bot (`bot`, the button's words). */
export function dockText(frame: ModeHudFrame, waitedSeconds: number, offerAt = BOT_OFFER_SECONDS): { title: string; detail: string; cancel?: string; bot?: string } | undefined {
  if(frame.snapshot.duel?.phase==='interval'){
    const d=frame.snapshot.duel,own=d.scores[frame.self.id]??0,rival=frame.snapshot.players.find(p=>p.id!==frame.self.id),other=d.scores[rival?.id??'']??0;
    return {title:d.round===1?'RUNBACK · FIRST TO TWO':`ROUND ${d.round} · ${own}–${other}`,detail:`GET READY · ${Math.max(0,Math.ceil((d.nextRoundAt??0)-frame.snapshot.serverTime))}s`};
  }
  const { snapshot, self } = frame, lobby = snapshot.lobby;
  if (frame.phase !== 'waiting' || !lobby || snapshot.roomMode !== 'match') return undefined;
  const others = snapshot.players.filter(p => p.id !== self.id), humans = 1 + others.filter(p => !p.isBot).length;
  const left = lobby.startsAt !== null ? Math.max(0, Math.ceil(lobby.startsAt - snapshot.serverTime)) : null;
  // The countdown is over but the room has not started: it waits for every player's page to load the final roster
  // (the bots chosen at kickoff, the stage; server AssetGate). Say so, never "STARTING IN 0s".
  const loading = left === 0;
  if (lobby.visibility === 'private') {
    const size = lobby.duel ? 2 : lobby.size ?? MAX_PLAYERS, bots = lobby.duel ? 0 : Math.max(0, size - snapshot.players.length);
    // The host's own room is YOUR ROOM; a guest is in somebody else's.
    const own = lobby.hostId === self.id;
    // A party's own room (lobby.party) has no code to share: the party has its own invite.
    return { title: lobby.party ? (lobby.duel ? 'PARTY DUEL' : 'PARTY MATCH') : `${lobby.duel ? 'DUEL ROOM' : own ? 'YOUR ROOM' : 'PRIVATE ROOM'} · ${lobby.code ?? ''}`, detail: loading ? LOADING_ROOM : left !== null ? `STARTING IN ${left}s` : `${snapshot.players.length} / ${size} JOINED${bots ? ` · ${bots} BOT${bots === 1 ? '' : 'S'} AT START` : ''}` };
  }
  if (lobby.duel) return snapshot.players.length < 2
    ? waitedSeconds >= offerAt
      ? { title: `FINDING AN OPPONENT · ${time(waitedSeconds)}`, detail: "NOBODY'S QUEUED · TRY A BOT ON THIS DEVICE?", bot: 'FIGHT A BOT', cancel: 'CANCEL' }
      : { title: `FINDING AN OPPONENT · ${time(waitedSeconds)}`, detail: 'REAL PLAYERS ONLY · NEVER A BOT', cancel: 'CANCEL' }
    : { title: others.every(p => p.isBot) ? 'YOUR BOT RIVAL' : 'OPPONENT FOUND', detail: left !== null && !loading ? `GET READY · ${left}s` : 'LOADING THE ARENA', cancel: undefined };
  // A field of bots (one human): the countdown runs while the arena loads.
  if (others.length && humans === 1 && others.every(p => p.isBot)) return { title: 'GET READY', detail: left !== null && !loading ? `THE FIGHT STARTS IN ${left}s` : 'LOADING THE ARENA' };
  const fill = Math.max(0, MIN_MATCH_FIELD - snapshot.players.length);
  if (loading) return { title: 'GET READY', detail: LOADING_ROOM };
  return { title: `FINDING PLAYERS · ${time(waitedSeconds)}`, detail: `${humans} / ${MAX_PLAYERS} JOINED${left !== null ? ` · ${fill ? `BOTS FILL TO ${MIN_MATCH_FIELD} IN ${left}s` : `STARTING IN ${left}s`}` : ''}`, cancel: 'CANCEL' };
}

export class WaitingDock {
  private readonly el = document.createElement('div');
  private since = 0;
  private shown = '';
  /** The wait after which this queue offers a bot: later once a pad has said KEEP WAITING. */
  private offerAt = BOT_OFFER_SECONDS;
  private waited = 0;
  /** The bot is on offer now, since this time (frame.now). */
  private offering = false;
  private offeredAt = 0;
  constructor(private readonly root: HTMLElement, private readonly leave: () => void, private readonly fightBot: () => void = () => {}) {
    this.el.className = 'waiting-dock hidden';
    this.el.setAttribute('role', 'status');
    this.el.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-dock-cancel]')) this.leave();
      else if (target.closest('[data-dock-bot]')) this.fightBot();
    });
  }
  frame(frame: ModeHudFrame, layout: HudLayoutId) {
    if (!this.el.isConnected) this.root.querySelector('.combat-hud')?.append(this.el);
    const waiting = (layout === 'royale' || layout === 'duel') && frame.phase === 'waiting' && frame.snapshot.duel?.phase !== 'interval';
    if (!waiting) { this.since = 0; this.hide(); return; }
    if (!this.since) this.since = frame.now;
    this.waited = (frame.now - this.since) / 1000;
    const text = dockText(frame, this.waited, this.offerAt);
    if (!text) { this.hide(); return; }
    const lobby = frame.snapshot.lobby, queue = lobby?.visibility === 'public' ? lobby.duel ? 'duel' as const : 'royale' as const : undefined;
    population.dock = !!queue;
    if (!!text.bot !== this.offering) { this.offering = !!text.bot; this.offeredAt = frame.now; }
    // The offer is a second row (waitingDock.css), so the dock grows no wider over the plates; a pad holding it (main.ts
    // idles the fighter meanwhile, see `padChoice`) is told its keys.
    const pad = this.offering && this.root.dataset.input === 'controller' ? `<small class="dock-pad">${promptKey('confirm')} CHOOSE · ${promptKey('back')} KEEP WAITING</small>` : '';
    const buttons = `${this.offering ? '<i class="dock-break"></i>' : ''}${pad}${text.bot ? `<button type="button" data-dock-bot data-focus="dock-bot">${text.bot}</button>` : ''}${text.cancel ? `<button type="button" data-dock-cancel data-focus="dock-cancel">${text.cancel}</button>` : ''}`;
    // The buttons are drawn again only when they change (the clock ticks every second): one being pressed, or the
    // pad's focus on it, survives the tick; a change keeps the focus on the same button (data-focus).
    if (buttons !== this.shown || !this.el.firstChild) {
      const focus = this.el.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.focus : undefined;
      this.shown = buttons; this.el.innerHTML = `<strong></strong><span></span><em class="dock-pop"></em>${buttons}`;
      if (focus) this.el.querySelector<HTMLElement>(`[data-focus="${focus}"]`)?.focus({ preventScroll: true });
    }
    const title = this.el.querySelector('strong')!, detail = this.el.querySelector('span')!;
    if (title.textContent !== text.title) title.textContent = text.title;
    if (detail.textContent !== text.detail) detail.textContent = text.detail;
    const pop = this.el.querySelector('.dock-pop'), counts = queue ? dockLine(population.view, queue) : '';
    if (pop && pop.textContent !== counts) pop.textContent = counts;
    // The room drawer's own line (Hud's #private-hint) says the same, after Hud has written it this tick.
    const hint = this.root.querySelector<HTMLElement>('#private-hint');
    if (hint && text.detail === LOADING_ROOM && hint.textContent !== LOADING_ROOM && /STARTING IN 0s/.test(hint.textContent ?? '')) hint.textContent = LOADING_ROOM;
    this.el.classList.remove('hidden'); this.root.dataset.waiting = '';
  }
  /** A pad on the offer (the fighter idle meanwhile, main.ts): its D-pad moves between the buttons the way every menu's
   *  does (spatialFocus), its confirm presses the one focused - FIGHT A BOT first - and its back keeps waiting, the
   *  fighter the pad's again and the offer back in another half minute. */
  controller(action: UiAction): boolean {
    if (!this.padChoice) return false;
    // A jump pressed as the offer came up is not a choice: the pad's presses count after a second, and the first only
    // shows where the focus is (as on every menu).
    if (performance.now() - this.offeredAt < 1000) return true;
    const buttons = [...this.el.querySelectorAll<HTMLElement>('button')], active = document.activeElement as HTMLElement;
    if (action === 'back') { this.offerAt = this.waited + BOT_OFFER_SECONDS; this.offering = false; active?.blur?.(); return true; }
    if (!buttons.includes(active)) { this.el.querySelector<HTMLElement>('[data-dock-bot]')?.focus({ preventScroll: true }); return true; }
    if (action === 'confirm') { active.click(); return true; }
    const direction = ({ previous: 'up', next: 'down', left: 'left', right: 'right' } as Partial<Record<UiAction, Direction>>)[action];
    const to = direction ? nearest(active.getBoundingClientRect(), buttons.map(b => b.getBoundingClientRect()), direction) : -1;
    if (to >= 0) buttons[to].focus({ preventScroll: true });
    return true;
  }
  /** The bot is on offer and the dock speaks for a pad: main.ts gives it the pad's presses, not the fighter. */
  get padChoice() { return this.offering && !this.el.classList.contains('hidden') && this.root.dataset.input === 'controller'; }
  clear() { this.since = 0; this.hide(); }
  private hide() { population.dock = false; this.offerAt = BOT_OFFER_SECONDS; this.offering = false; if (!this.el.classList.contains('hidden')) this.el.classList.add('hidden'); delete this.root.dataset.waiting; }
}
