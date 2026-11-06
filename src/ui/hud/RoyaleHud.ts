import type { CombatEvent, GameSnapshot } from '../../game/types';
import { pulseClass } from '../pulse';
import { viewHeight, viewWidth } from '../viewport';
import { customOf } from '../../game/social/custom';
import { castThreat, THREAT_HEX } from '../../render/ThreatOutline';
import { prompt } from '../prompts';
import type { ModeHud, ModeHudFrame, ModeHudMount } from './modeHud';
import { EdgeMarkers, type EdgeSubject } from './EdgeMarkers';
import { hudView } from './hudView';
import { attr, callName, centreBusy, el, flag, KO_SECONDS, PromptWatch, setHtml, setText, show } from './mainHudKit';
import { FallOrder, feedLine, fighterName, finalCall, KillFeed } from './royaleField';
import { hull } from './inked';
import './royaleHud.css';

export function createRoyaleHud(): ModeHud { return new RoyaleHud(); }

/** Blows traded with a fighter keep their plate up this long, ms. */
const TRADE_MS = 5000;
/** The FINAL banner's time on screen, ms. */
const BANNER_MS = 2200;
/** After going down, RESULTS waits this long for its key, so a button still being mashed does not skip the fall. */
const RESULTS_GRACE_MS = 1200;
/** An Enter this soon after the spectator bar went (the results card opening under it) is swallowed, ms. */
const SWALLOW_MS = 1000;
interface Candidate extends EdgeSubject { d: number }

class RoyaleHud implements ModeHud {
  private root!: HTMLElement;
  private plaque!: HTMLElement; private count!: HTMLElement; private word!: HTMLElement; private detail!: HTMLElement;
  private kills!: HTMLElement; private kosWord!: Text;
  private feed!: KillFeed;
  private markers!: EdgeMarkers;
  private banner!: HTMLElement; private bannerCount!: HTMLElement;
  private bar!: HTMLElement; private place!: HTMLElement; private watching!: HTMLElement; private next!: HTMLElement; private results!: HTMLButtonElement;
  private readonly watch = new PromptWatch();
  private readonly fall = new FallOrder();
  private readonly trades = new Map<string, number>();
  private readonly pool: Candidate[] = [];
  /** Call names by player id: a name never changes in a match, so it is worked out once. */
  private readonly names = new Map<string, string>();
  private selfId = '';
  private started = 0;
  /** The last FINAL called (3, then 2); 9 before either. */
  private called = 9;
  private pending: 0 | 2 | 3 = 0; private pendingAt = 0; private bannerUntil = 0;
  /** When the player last dealt or took a knockout (MangaImpact's K.O. plays then), ms. */
  private koMineAt = -Infinity;
  private downAt = 0;
  private placeKey = -1;
  private detailKey = -1;
  private padHeld = true;
  /** When the spectator bar was last up, ms: an Enter meant for RESULTS that lands just after the match ended (and the
   *  results card opened with PLAY AGAIN focused) must not start another match. */
  private barSeen = -Infinity;
  private readonly onKey = (event: KeyboardEvent) => {
    if (event.code !== 'Enter' || event.repeat) return;
    const now = performance.now();
    if (this.bar.hidden && now - this.barSeen < SWALLOW_MS && this.root.querySelector('#results:not(.hidden)')) { event.preventDefault(); return; }
    // Typing, or a menu's or dialog's own button, keeps its Enter; the HUD's (the menu button the pause menu hands focus
    // back to, or RESULTS itself) does not.
    const target = event.target as HTMLElement | null;
    if (!this.canAskResults(now) || target?.matches?.('input,select,textarea') || target?.closest?.('.settings-scrim,#results,dialog')) return;
    event.preventDefault(); this.askResults();
  };

  mount(m: ModeHudMount) {
    this.root = m.root;
    // Round 5 (HUDIMPL): Inked Plates v2's tag - N LEFT and your KOs on one ink hull (inked.css); a timed private room's
    // clock hangs under it.
    this.plaque = el('div', 'royale-plaque ik-tag', hull(186, 44, 'M7 2 L186 0 L178 42 L0 44 Z', 'ik-tag-hull'));
    this.count = el('b'); this.word = el('span', 'ik-left', 'LEFT');
    const kos = el('span', 'ik-kos'); this.kills = el('em'); this.kosWord = document.createTextNode(' KOs'); kos.append(this.kills, this.kosWord);
    this.detail = el('small');
    this.plaque.append(this.count, this.word, kos, this.detail); this.plaque.hidden = true;
    m.zone('2').append(this.plaque);
    this.feed = new KillFeed(m.zone('3b'));
    this.markers = new EdgeMarkers(m.zone('8'), 3, 30);
    this.banner = el('div', 'royale-banner'); this.banner.setAttribute('role', 'status'); this.banner.hidden = true;
    this.bannerCount = el('strong'); this.banner.append(el('b', '', 'FINAL'), this.bannerCount);
    m.zone('7').append(this.banner);
    this.bar = el('div', 'royale-spectate'); this.bar.hidden = true; this.bar.setAttribute('role', 'status');
    const out = el('span', 'royale-out'); this.place = el('small'); out.append(el('b', '', 'KNOCKED OUT'), this.place);
    const watching = el('span', 'royale-watching'); this.watching = el('b'); watching.append(el('small', '', 'WATCHING'), this.watching);
    this.next = el('span', 'royale-next'); this.results = el('button', 'royale-results'); this.results.type = 'button';
    this.results.addEventListener('click', () => this.askResults());
    this.bar.append(out, watching, this.next, this.results);
    m.zone('5').append(this.bar);
    // Capture: ahead of the focused results button's own Enter.
    window.addEventListener('keydown', this.onKey, true);
  }

  update(f: ModeHudFrame) {
    const { snapshot: s, self, target, phase, now } = f, root = this.root;
    this.selfId = self.id;
    this.fall.update(s);
    if (this.watch.changed(f)) this.drawPrompts(f);
    let left = 0; for (const p of s.players) if (p.alive) left++;
    if (phase === 'active') this.started = Math.max(this.started, s.players.length);
    if (phase === 'waiting') { this.started = 0; this.called = 9; this.pending = 0; this.trades.clear(); this.feed.clear(); this.names.clear(); }
    const down = phase === 'active' && !self.alive;
    if (down && !this.downAt) { this.downAt = now; this.padHeld = true; }
    if (!down) this.downAt = 0;
    flag(root, 'royaleDown', down);
    this.drawPlaque(s, self.kills ?? 0, left, phase);

    // The target plate: the fighter the player is locked on or trading blows with; anyone being watched once down.
    const traded = target ? this.trades.get(target.id) ?? -Infinity : -Infinity;
    const foe = !!target && (down || hudView.locked() || now - traded < TRADE_MS);
    attr(root, 'royaleFoe', foe ? undefined : 'off');

    // Edge markers: the nearest off the screen, from the player's own position, while they are in the fight.
    if (phase === 'active' && self.alive && hudView.camera) {
      let n = 0;
      for (const p of s.players) {
        if (!p.alive || p.id === self.id || p.id === target?.id || p.enemy) continue;
        const c = this.pool[n] ??= { id: '', x: 0, y: 0, z: 0, fighter: p.fighter, name: '', colour: '', d: 0 };
        c.id = p.id; c.x = p.x; c.y = p.y + 1.2; c.z = p.z; c.fighter = p.fighter;
        c.name = this.nameOf(p, self.id); c.colour = THREAT_HEX[castThreat(p).level];
        c.d = Math.hypot(p.x - self.x, p.z - self.z); n++;
      }
      // Nearest first (insertion sort: a dozen at most, and no allocation).
      for (let i = 1; i < n; i++) { const c = this.pool[i]; let j = i - 1; while (j >= 0 && this.pool[j].d > c.d) { this.pool[j + 1] = this.pool[j]; j--; } this.pool[j + 1] = c; }
      this.markers.update(hudView.camera, self, this.pool, n, viewWidth(), viewHeight());
    } else this.markers.hide();

    this.feed.update(now);
    this.drawBanner(left, phase, now);
    this.drawSpectator(f, down, left);
    // A knocked-out player who asked for the results keeps them; a new match (alive again) starts clean.
    if (!down && 'resultsNow' in root.dataset && phase !== 'over') delete root.dataset.resultsNow;
  }

  event(event: CombatEvent, snapshot: GameSnapshot) {
    const now = performance.now(), self = this.selfId;
    if (event.kind === 'eliminated') {
      const line = feedLine(event, snapshot.players, self);
      if (line) this.feed.push(line, now);
      if (event.actorId === self || event.targetId === self) this.koMineAt = now;
      return;
    }
    // Blows traded, either way and whether or not they were blocked.
    if (event.kind === 'hit' || event.kind === 'blocked' || event.kind === 'just-guard' || event.kind === 'guard-break') {
      if (event.actorId === self && event.targetId) this.trades.set(event.targetId, now);
      else if (event.targetId === self) this.trades.set(event.actorId, now);
    }
  }

  unmount() {
    window.removeEventListener('keydown', this.onKey, true);
    this.markers?.destroy();
    for (const node of [this.plaque, this.banner, this.bar]) node?.remove();
    this.root?.querySelector('.royale-feed')?.remove();
    if (this.root) { attr(this.root, 'royaleFoe', undefined); flag(this.root, 'royaleDown', false); delete this.root.dataset.resultsNow; }
  }

  private drawPlaque(s: GameSnapshot, kills: number, left: number, phase: ModeHudFrame['phase']) {
    // Before the fight the top centre is WP1's waiting dock (the queue, the countdown, the bots that fill): no plaque.
    show(this.plaque, phase !== 'waiting');
    if (phase === 'waiting') return;
    setText(this.count, String(left));
    const custom = customOf(s), clock = custom?.endsAt ? Math.max(0, Math.ceil(custom.endsAt - s.serverTime)) : -1;
    const key = kills * 1e6 + this.started * 1e4 + clock;
    if (key === this.detailKey) return;
    this.detailKey = key;
    setText(this.kills, String(kills));
    const word = kills === 1 ? ' KO' : ' KOs';
    if (this.kosWord.data !== word) this.kosWord.data = word;
    // A private room with a time limit shows its clock under the tag.
    setText(this.detail, clock >= 0 ? `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, '0')} LEFT` : '');
  }

  private drawBanner(left: number, phase: ModeHudFrame['phase'], now: number) {
    if (phase === 'active') {
      const call = finalCall(left, this.started, this.called);
      if (call) { this.called = call; this.pending = call; this.pendingAt = Math.max(now + 250, this.koMineAt + KO_SECONDS * 1000); }
    } else this.pending = 0;
    if (this.pending && now >= this.pendingAt && !centreBusy(this.root)) {
      setText(this.bannerCount, String(this.pending)); this.pending = 0; this.bannerUntil = now + BANNER_MS;
      show(this.banner, true); pulseClass(this.banner, 'go');
    }
    if (!this.banner.hidden && (now > this.bannerUntil || phase !== 'active')) show(this.banner, false);
  }

  private drawSpectator(f: ModeHudFrame, down: boolean, left: number) {
    show(this.bar, down);
    if (!down) return;
    this.barSeen = f.now;
    const { snapshot: s, self, target } = f;
    // The placing moves only as the field does.
    const key = s.players.length * 100 + left;
    if (key !== this.placeKey) { this.placeKey = key; const { place, of } = this.fall.place(s, self.id); setText(this.place, `#${place} OF ${of}`); }
    setText(this.watching, target ? this.nameOf(target, self.id) : '—');
    // The pad's confirm (✕ / A) asks for the results, once released from whatever it was doing as the player fell.
    if (f.input === 'controller') {
      const pad = firstPad(), pressed = !!pad?.buttons[0]?.pressed;
      if (pressed && !this.padHeld && this.canAskResults(f.now)) this.askResults();
      this.padHeld = pressed;
    }
  }

  private drawPrompts(f: Pick<ModeHudFrame, 'input' | 'family'>) {
    const device = { device: f.input, family: f.family };
    setHtml(this.next, prompt('target', 'NEXT', device));
    setHtml(this.results, prompt('confirm', 'RESULTS', device));
  }
  private nameOf(p: { id: string; name: string; isBot: boolean; fighter: string }, selfId: string) {
    let name = this.names.get(p.id);
    if (name === undefined) { name = callName(p, selfId, fighterName); this.names.set(p.id, name); }
    return name;
  }
  private canAskResults(now: number) { return !this.bar.hidden && !!this.downAt && now - this.downAt > RESULTS_GRACE_MS && !('resultsNow' in this.root.dataset); }
  /** RESULTS now: Hud opens the results card for a knocked-out player before the match ends (#interface[data-results-now],
   *  one condition in Hud.update; WP1's results frame reads the same attribute). */
  private askResults() { if (!('resultsNow' in this.root.dataset)) this.root.dataset.resultsNow = ''; }
}

/** The first standard-mapped pad, as input.ts picks it. */
function firstPad() {
  if (typeof navigator !== 'object' || typeof navigator.getGamepads !== 'function') return undefined;
  for (const pad of navigator.getGamepads()) if (pad?.connected && pad.mapping === 'standard') return pad;
  return undefined;
}
