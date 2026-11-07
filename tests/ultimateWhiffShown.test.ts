import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MOVES } from '../src/game/moves';
import { CombatEffects } from '../src/render/CombatEffects';
import { KuonEffects } from '../src/render/KuonEffects';
import { SwordSpiritEffects } from '../src/render/SwordSpiritEffects';
import { SIGNATURE } from '../src/render/signature/context';
import { OPENER_FEED, WHIFF_CLEAR, whiffGone } from '../src/render/signature/ultimateClock';
import { MangaImpact } from '../src/ui/MangaImpact';
import type { Fighter } from '../src/render/Fighter';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';

/**
 * Round 3e (ULTFIX): a whiffed ultimate is shown as one, at once.
 *
 * The third critic: "the tint plays, nothing lands, no whiff is reported, and
 * the meter is spent" - MIDNIGHT's stopped world and SETSUNA's blue held
 * for a second and more over nothing. Whatever the opener raised over the
 * world goes WHIFF_CLEAR after the verdict is known, and the miss is
 * lettered beside the thrower for them and for whoever it was thrown at.
 */
const player = (props: Partial<PlayerState>): PlayerState => ({ id: 'a', name: 'A', fighter: 'taisei', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000,
  stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true,
  guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
function body(state: PlayerState): Fighter {
  const group = new THREE.Group(); group.position.set(state.x, state.y, state.z);
  return { state, group, handR: new THREE.Vector3(.3, 1.3, .4), handL: new THREE.Vector3(-.3, 1.3, .4), bones: new Map(), joints: new Map(),
    chargePosition(out: THREE.Vector3) { return out.set(0, 1.3, .5); }, meleeContactPoint() { return false; }, strikePoint(out: THREE.Vector3) { return out.set(.3, 1.3, .9); } } as unknown as Fighter;
}
/** The thrower `t` seconds into its ultimate (started at 1), whiffed on the
 *  server `whiff` seconds in and known here `known` seconds in. */
const moment = (s: PlayerState, t: number, whiff: number, known: number) => {
  s.action = 'ultimate'; s.actionTime = Math.min(1, t / s.actionDuration);
  s.whiffedAt = t >= known ? 1 + whiff : undefined;
};

describe('the time stop and the Domain that caught nobody clear at once', () => {
  let stops: number[] = [];
  beforeEach(() => { stops = []; SIGNATURE.screen = { timeStop: (amount: number) => { stops.push(amount); } } as typeof SIGNATURE.screen; });
  afterEach(() => { SIGNATURE.screen = undefined; });

  it.each([['oro', .1], ['koko', .1], ['oro', .35]] as [FighterId, number][])('%s: the stopped world is gone with the whiff (known %s s after it)', (fighter, lag) => {
    const scene = new THREE.Scene(), spirit = new SwordSpiritEffects(scene), move = MOVES[fighter].ultimate;
    const s = player({ id: 'd', fighter, actionStarted: 1, actionDuration: move.duration }), fighters = new Map([['d', body(s)]]);
    SIGNATURE.localId = 'd';
    const stopAt = move.contacts[move.timeStop!.contact], whiff = stopAt + 1 / 60, known = whiff + lag;
    let shownAfter = -1;
    try {
      for (let t = 0; t < 1.6; t += 1 / 60) {
        moment(s, t, whiff, known);
        spirit.update(1 + t, 1 / 60, fighters);
        let dome = false; scene.traverse(o => { if (o.name === 'dead-stop-time-stop' && o.visible) dome = true; });
        if (t > stopAt + .02 && t < known) expect(dome || stops.at(-1)! > 0, `the stop shows at ${t.toFixed(2)} until the whiff is known`).toBe(true);
        if (dome || stops.at(-1)! > 0) shownAfter = t;
      }
      expect(shownAfter, 'gone by the whiff and a clearing').toBeLessThanOrEqual(Math.max(known, whiffGone(s)) + 1 / 60 + 1e-9);
      expect(stops.at(-1), 'the world handed back').toBe(0);
    } finally { spirit.dispose(); SIGNATURE.localId = undefined; }
  });

});

describe('the technique grade holds while the verdict is out, and not after a whiff', () => {
  it.each(['setsu', 'oro', 'gummy', 'shirokane'] as FighterId[])('%s', fighter => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene), move = MOVES[fighter].ultimate;
    const grades: { at: number; seconds: number }[] = [];
    let clock = 0;
    fx.screen = { impactFrame() {}, chromaticPulse() {}, speedLines() {}, techniqueGrade: (_c: number, _s: number, seconds: number) => { grades.push({ at: clock, seconds }); } };
    fx.localId = 'a';
    const s = player({ fighter, actionStarted: 1, actionDuration: move.duration }), fighters = new Map([['a', body(s)]]);
    const whiff = move.contacts[0] + .08, known = whiff + .25;
    try {
      clock = 1;
      fx.handle([{ id: 1, kind: 'cast', serverTime: 1, actorId: 'a', fighter, slot: 'ultimate', origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: 3 } }], fighters);
      for (let t = 0; t < 1.5; t += 1 / 60) {
        clock = 1 + t;
        moment(s, t, whiff, known);
        if (t > whiff + .5) s.action = 'idle';
        fx.update(clock, 1 / 60, fighters);
      }
      const holds = grades.map(g => g.at + g.seconds);
      expect(Math.max(...holds) - 1, 'nothing holds the frame past the moment the whiff was known').toBeLessThanOrEqual(known + OPENER_FEED + 1 / 60 + 1e-9);
      expect(Math.max(...holds) - 1, 'but it held through the verdict').toBeGreaterThanOrEqual(known - 1 / 60);
    } finally { fx.dispose(); }
  });
});

describe('the whiff is lettered beside the thrower', () => {
  /** Just enough of a document for the lettering to build its elements on. */
  class Element {
    style: Record<string, unknown> = { setProperty(this: Record<string, unknown>, k: string, v: string) { this[k] = v; } };
    children: Element[] = []; className = ''; textContent = ''; parent?: Element;
    setAttribute() {}
    append(...kids: Element[]) { for (const k of kids) { k.parent = this; this.children.push(k); } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
    text(): string { return this.textContent + this.children.map(c => c.text()).join(''); }
  }
  const saved = { document: globalThis.document, matchMedia: (globalThis as { matchMedia?: unknown }).matchMedia };
  beforeEach(() => {
    (globalThis as unknown as { document: unknown }).document = { createElement: () => new Element() };
    (globalThis as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: false });
  });
  afterEach(() => {
    (globalThis as unknown as { document: unknown }).document = saved.document;
    (globalThis as unknown as { matchMedia: unknown }).matchMedia = saved.matchMedia;
  });
  const whiff: CombatEvent = { id: 5, kind: 'whiff', serverTime: 2, actorId: 'thrower', targetId: 'target', fighter: 'oro', slot: 'ultimate', origin: { x: 0, y: 0, z: 0 } };
  it.each([['thrower', true], ['target', true], ['bystander', false]] as [string, boolean][])('seen by the %s: %s', (self, seen) => {
    const root = new Element(), manga = new MangaImpact(root as unknown as HTMLElement);
    manga.handle([whiff], self, [player({ id: 'thrower', fighter: 'oro' }), player({ id: 'target' }), player({ id: 'bystander' })]);
    const printed = root.children.filter(c => c.className.includes('whiff'));
    expect(printed.length).toBe(seen ? 1 : 0);
    if (seen) { expect(printed[0].text()).toContain('スカッ'); expect(printed[0].text()).toContain('MISS'); }
  });
  it('carries whom it was thrown at', async () => {
    const { ArenaSimulation } = await import('../src/game/simulation');
    const sim = new ArenaSimulation({ trainingBot: false, seed: 1 });
    sim.addPlayer('me', 'oro', 'Me', false, { x: 0, y: 0, z: 0 }); sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: 12 });
    sim.actors.get('me')!.state.ultimate = 100;
    const events: CombatEvent[] = [];
    for (let i = 0; i < 90; i++) { sim.submitInput('me', { seq: i + 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', lock: true, attack: i === 0 ? 'ultimate' : undefined }); sim.step(); events.push(...sim.drainEvents()); }
    expect(events.find(e => e.kind === 'whiff')?.targetId).toBe('b');
    expect(WHIFF_CLEAR).toBeLessThanOrEqual(.2);
    sim.dispose();
  });
});
