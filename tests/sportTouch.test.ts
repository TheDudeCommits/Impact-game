import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPIKE_BACK, SPORT_GLYPHS, SPORT_SLOTS, TRAP_CUE, TrapCue, sportSet, sportTouchName, spikeLight, spikeMoment, trapComing, type SportFace, type SportSet } from '../src/input/sportTouch';
import { TouchControls } from '../src/input/touch';
import { Input } from '../src/input';
import { BallMatch } from '../src/game/ball/BallMatch';
import { BALL_ID, GOAL_RULES, type BallState } from '../src/game/ball/model';
import { currentSport, promptKey, promptText, touchKey } from '../src/ui/prompts';
import { MODES } from '../src/ui/modes/catalogue';
import type { BallView } from '../src/game/ball/model';

/** A ball match as the touch set reads it: the page's own seat 'me' on red, a team-mate and two of blue. */
const view = (over: Partial<BallView> = {}) => ({
  kind: 'ball', mode: 'goal-rush', phase: 'live', practice: false, serverId: null, touchTeam: null, touches: 0, drill: null,
  seats: [{ id: 'me', team: 'red' }, { id: 'mate', team: 'red' }, { id: 'foe', team: 'blue' }, { id: 'foe2', team: 'blue' }],
  ...over,
}) as unknown as BallView;
const shown = (set: SportSet) => SPORT_SLOTS.filter(slot => set[slot]);
const labels = (set: SportSet) => Object.fromEntries(SPORT_SLOTS.map(slot => [slot, set[slot]?.label ?? null]));

describe('the ball modes\' touch set (input/sportTouch.ts)', () => {
  it('Goal Rush, BALL stance: SHOOT, PASS, JUMP, BOOST (held), FIGHT and SUPER once charged', () => {
    const set = sportSet(view(), 'me', false, true);
    expect(labels(set)).toEqual({ main: 'SHOOT', pass: 'PASS', jump: 'JUMP', run: 'BOOST', side: 'FIGHT', super: 'SUPER' });
    expect(set.main!.action).toBe('heavy'); expect(set.pass!.action).toBe('light'); expect(set.run).toMatchObject({ action: 'dash', hold: true });
    expect(set.side!.action).toBe('target'); expect(set.super!.action).toBe('ultimate');
    // Short of its charge SUPER is no button at all - the HUD's bar is its charge: five on screen.
    const early = sportSet(view(), 'me', false, false);
    expect(early.super).toBeNull();
    expect(shown(early)).toHaveLength(5);
    // The shot alone is held as its key is (a rule may read how long).
    expect(SPORT_SLOTS.filter(slot => set[slot]!.held)).toEqual(['main']);
  });
  it('Goal Rush, FIGHT stance: the same buttons as fight moves, and BALL to go back', () => {
    const set = sportSet(view(), 'me', true, true);
    expect(labels(set)).toEqual({ main: 'HEAVY', pass: 'LIGHT', jump: 'JUMP', run: 'DASH', side: 'BALL', super: 'ULT' });
    expect(set.main!.glyph).toBe('art'); expect(set.pass!.glyph).toBe('fist');
    // Each slot presses the same action in both stances: the thumb's memory holds.
    const ball = sportSet(view(), 'me', false, true);
    for (const slot of SPORT_SLOTS) expect(set[slot]!.action, slot).toBe(ball[slot]!.action);
  });
  it('FREE PLAY has no stances, so no FIGHT button; Sky Spike never fights', () => {
    expect(sportSet(view({ practice: true }), 'me', false, false).side).toBeNull();
    expect(sportSet(view({ practice: true }), 'me', true, false).main!.label).toBe('SHOOT');
    expect(sportSet(view({ mode: 'sky-spike' }), 'me', true, true).main!.label).toBe('SPIKE');
  });
  it('Sky Spike: SPIKE, the light named for the touch it will be, JUMP, BOOST, BLOCK and SUPER', () => {
    const set = sportSet(view({ mode: 'sky-spike' }), 'me', false, true);
    expect(labels(set)).toEqual({ main: 'SPIKE', pass: 'BUMP', jump: 'JUMP', run: 'BOOST', side: 'BLOCK', super: 'SUPER' });
    expect(set.side!.action).toBe('guard'); expect(set.run).toMatchObject({ action: 'dash', hold: true }); expect(set.main!.held).toBe(true);
    const at = (over: Partial<BallView>) => spikeLight(view({ mode: 'sky-spike', ...over }), 'me').label;
    expect(at({ touchTeam: 'red', touches: 0 })).toBe('BUMP');
    expect(at({ touchTeam: 'red', touches: 1 })).toBe('SET');
    expect(at({ touchTeam: 'red', touches: 2 })).toBe('TIP');
    expect(at({ touchTeam: 'red', touches: 3 })).toBe('BUMP');
    expect(at({ touchTeam: 'blue', touches: 1 })).toBe('BUMP');
    const serving = sportSet(view({ mode: 'sky-spike', phase: 'kickoff', serverId: 'me' }), 'me', false, false);
    expect([serving.main!.label, serving.pass!.label]).toEqual(['SERVE', 'LOB']);
    expect(sportSet(view({ mode: 'sky-spike', phase: 'kickoff', serverId: 'foe' }), 'me', false, false).main!.label).toBe('SPIKE');
  });
  it("Sky Spike's button of the moment: BLOCK at the net, DIVE in the back court while the ball is the other side's", () => {
    const ball = (lastTeam: 'red' | 'blue' | undefined) => ({ lastTeam }) as unknown as BallView['ball'];
    const at = (over: Partial<BallView>, z?: number) => spikeMoment(view({ mode: 'sky-spike', ...over }), 'me', z === undefined ? undefined : { z });
    // Their ball, and you deep on your own side (red's is z < 0; the distance from the net is what counts): DIVE, the dash.
    expect(at({ ball: ball('blue') }, -(SPIKE_BACK + 2))).toMatchObject({ action: 'dash', label: 'DIVE', glyph: 'dive' });
    expect(at({ ball: ball('blue') }, SPIKE_BACK)).toMatchObject({ label: 'DIVE' });
    // At the net it is a block: the guard, held.
    expect(at({ ball: ball('blue') }, -(SPIKE_BACK - .5))).toMatchObject({ action: 'guard', label: 'BLOCK', glyph: 'block' });
    // Your own side's ball, nobody's, a serve's walk-up, or a body the set was not given: BLOCK.
    expect(at({ ball: ball('red') }, -8).label).toBe('BLOCK');
    expect(at({ ball: ball(undefined) }, -8).label).toBe('BLOCK');
    expect(at({ ball: ball('blue'), phase: 'kickoff' }, -8).label).toBe('BLOCK');
    expect(at({ ball: ball('blue') }).label).toBe('BLOCK');
    // The set shows it in the moment's slot; the other four stay what they are.
    const deep = sportSet(view({ mode: 'sky-spike', ball: ball('blue') }), 'me', false, false, { z: -8 });
    expect(labels(deep)).toEqual({ main: 'SPIKE', pass: 'BUMP', jump: 'JUMP', run: 'BOOST', side: 'DIVE', super: null });
  });
  it('never shows more than six, each pressing an action the input has, each with a face', () => {
    for (const v of [view(), view({ practice: true }), view({ mode: 'sky-spike' })]) for (const fight of [false, true]) for (const ready of [false, true]) for (const trap of [false, true]) {
      const set = sportSet(v, 'me', fight, ready, undefined, trap);
      expect(shown(set).length).toBeLessThanOrEqual(6);
      for (const slot of SPORT_SLOTS) {
        const face = set[slot]; if (!face) continue;
        expect(['light', 'heavy', 'jump', 'dash', 'guard', 'ultimate', 'target']).toContain(face.action);
        if (face.glyph !== 'art') expect(SPORT_GLYPHS[face.glyph]).toMatch(/^<(path|circle|g|rect)/);
      }
    }
  });
});

describe('prompts name the touch set\'s buttons in a ball match (prompts.ts)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const touch = { device: 'touch', family: 'generic' } as const;
  it('names each action by the set\'s own label, and an action it has no button for not at all', () => {
    expect(promptKey('heavy', { ...touch, sport: { mode: 'goal-rush' } })).toBe('<kbd class="touch-key">SHOOT</kbd>');
    expect(promptKey('dash', { ...touch, sport: { mode: 'goal-rush' } })).toBe('<kbd class="touch-key">BOOST</kbd>');
    expect(promptKey('target', { ...touch, sport: { mode: 'goal-rush' } })).toBe('<kbd class="touch-key">FIGHT</kbd>');
    expect(promptKey('target', { ...touch, sport: { mode: 'goal-rush', fight: true } })).toBe('<kbd class="touch-key">BALL</kbd>');
    // (The BALL stance's guard is TRAP, the moment's button as a ball comes at you; a fight's has none.)
    expect(promptKey('guard', { ...touch, sport: { mode: 'goal-rush' } })).toBe('<kbd class="touch-key">TRAP</kbd>');
    expect(promptKey('guard', { ...touch, sport: { mode: 'goal-rush', fight: true } })).toBe('');
    expect(promptKey('guard', { ...touch, sport: { mode: 'sky-spike' } })).toBe('<kbd class="touch-key">BLOCK</kbd>');
    // (Sky Spike's dash is BOOST, the button that is always there; the moment's DIVE is the same press.)
    expect(promptKey('dash', { ...touch, sport: { mode: 'sky-spike' } })).toBe('<kbd class="touch-key">BOOST</kbd>');
    expect(promptKey('special', { ...touch, sport: { mode: 'sky-spike' } })).toBe('');
    expect(touchKey('forward', { mode: 'sky-spike' })).toBe('<kbd class="touch-key">STICK</kbd>');
    // Outside one, the fight's fan.
    expect(promptKey('heavy', { ...touch, sport: null })).toBe('<kbd class="touch-key">HEAVY</kbd>');
    expect(sportTouchName('goal-rush', false, 'special')).toBeUndefined();
  });
  it('reads the match on screen from the HUD (#interface[data-hud], [data-ball-stance])', () => {
    const root = { dataset: { hud: 'goal-rush', ballStance: 'fight', input: 'touch' } };
    vi.stubGlobal('document', { querySelector: () => root });
    expect(currentSport()).toEqual({ mode: 'goal-rush', fight: true });
    expect(promptKey('light')).toBe('<kbd class="touch-key">LIGHT</kbd>');
    root.dataset.ballStance = 'ball';
    expect(promptKey('light')).toBe('<kbd class="touch-key">PASS</kbd>');
    root.dataset.hud = 'duel';
    expect(currentSport()).toBeNull();
    expect(promptKey('light')).toBe('<kbd class="touch-key">LIGHT</kbd>');
  });
  it('teaches the ball modes\' skills in the how-to-play, keyed for every device', () => {
    const goal = MODES['goal-rush'].howTo.join(' '), spike = MODES['sky-spike'].howTo.join(' ');
    for (const word of ['{target}', 'BALL', 'FIGHT', 'TACKLE', '{dash}', 'BOOST']) expect(goal).toContain(word);
    for (const word of ['{jump}', 'peaks', 'top of your jump', 'PERFECT SPIKE', 'DIVE', '{guard}']) expect(spike).toContain(word);
    const onTouch = promptText(MODES['goal-rush'].howTo[0], { ...touch, sport: { mode: 'goal-rush' } });
    expect(onTouch).toContain('PASS'); expect(onTouch).toContain('SHOOT'); expect(onTouch).toContain('BOOST');
    expect(promptText(MODES['sky-spike'].howTo[2], { ...touch, sport: { mode: 'sky-spike' } })).toContain('>BOOST<');
    expect(MODES['goal-rush'].rulesVersion).toBeGreaterThanOrEqual(2); expect(MODES['sky-spike'].rulesVersion).toBeGreaterThanOrEqual(2);
  });
});

// (BallMatch TRAP) Goal Rush's touch set had no guard, so a phone could not trap. The moment's button is TRAP
// while a ball you could trap is on its way to you, FIGHT again once it is not.
describe("Goal Rush's TRAP on the touch set (input/sportTouch.ts)", () => {
  const r = GOAL_RULES.ballRadius;
  /** A team-mate's pass along the floor at 'me' (red, standing at z -6): from 9 m up the pitch at 11 m/s. */
  const pass = (over: Partial<BallState> = {}) => ({ x: 0, y: r, z: 3, vx: 0, vy: 0, vz: -11, sx: 0, sy: 0, sz: 0, heat: 0, lastId: 'mate', lastTeam: 'red',
    shot: 'tap', held: false, frozenUntil: 0, super: false, size: 1, grav: 1, wall: null, clash: 0, ...over }) as BallState;
  const me = { x: 0, y: 0, z: -6, grounded: true };
  const coming = (ball: Partial<BallState>, over: Partial<BallView> = {}, at: Partial<typeof me> = {}) => trapComing(view({ ball: pass(ball), ...over }), 'me', { ...me, ...at });
  it('shows TRAP - the guard, held - while a ball you could trap comes at you; the other four stay what they are', () => {
    expect(coming({})).toBe(true);
    const set = sportSet(view({ ball: pass() }), 'me', false, false, me, true);
    expect(set.side).toEqual({ action: 'guard', label: 'TRAP', glyph: 'trap' });
    expect(labels(set)).toEqual({ main: 'SHOOT', pass: 'PASS', jump: 'JUMP', run: 'BOOST', side: 'TRAP', super: null });
    expect(SPORT_GLYPHS.trap).toMatch(/^<circle/);
    // The other side's pass is an interception's to trap, and FREE PLAY shows it in the slot it leaves empty.
    expect(coming({ lastId: 'foe', lastTeam: 'blue' })).toBe(true);
    expect(sportSet(view({ practice: true }), 'me', false, false, me, true).side!.label).toBe('TRAP');
    // Never in the FIGHT stance: there it is BALL, the way back.
    expect(sportSet(view(), 'me', true, false, me, true).side!.label).toBe('BALL');
  });
  it('never for a shot of theirs at your goal, a ball somebody carries, a ball going by or away, or off your feet', () => {
    // Their shot at your goal (red's is at -z) is a save, as ever; your own side's ball heading back there can be trapped.
    const shot = { x: 0, z: -9, vz: -16 }, near = { z: -15 };
    expect(coming({ ...shot, lastId: 'foe', lastTeam: 'blue' }, {}, near)).toBe(false);
    expect(coming({ ...shot }, {}, near)).toBe(true);
    expect(coming({ carry: 'foe', vz: -6 })).toBe(false);
    expect(coming({ carry: 'mate', vz: -6 })).toBe(false);
    expect(coming({ held: true })).toBe(false);
    expect(coming({ super: true })).toBe(false);
    expect(coming({ vz: 11 })).toBe(false);
    expect(coming({ x: 5, vz: -11 })).toBe(false);
    expect(coming({ y: 6, vy: 6 })).toBe(false);
    expect(coming({ z: -4.4 })).toBe(false);
    expect(coming({}, {}, { grounded: false })).toBe(false);
    expect(coming({}, { phase: 'kickoff' })).toBe(false);
    expect(coming({}, { drill: { id: 'gr-strike' } as unknown as BallView['drill'] })).toBe(false);
    expect(coming({}, { mode: 'sky-spike' })).toBe(false);
    // One of theirs on the ball (within 3.2 m of it, low): FIGHT is how that ball is won - never TRAP.
    const onIt = trapComing(view({ ball: pass() }), 'me', me, [{ id: 'foe', x: 1, z: 4.5, alive: true }]), off = trapComing(view({ ball: pass() }), 'me', me, [{ id: 'foe', x: 6, z: 4.5, alive: true }]);
    expect([onIt, off]).toEqual([false, true]);
    expect(trapComing(view({ ball: pass() }), 'me', me, [{ id: 'mate', x: 1, z: 4.5, alive: true }])).toBe(true);
    const cue = new TrapCue();
    expect(cue.update(view({ ball: pass() }), 'me', me, false, 0)).toBe(true);
    expect(cue.update(view({ ball: pass() }), 'me', me, false, 100, [{ id: 'foe', x: 1, z: 4.5, alive: true }])).toBe(false);
  });
  it('keeps TRAP a moment past the ball\'s coming, then FIGHT - at once when anybody has the ball at their feet', () => {
    const cue = new TrapCue(), v = (ball: Partial<BallState>) => view({ ball: pass(ball) });
    expect(cue.update(v({}), 'me', me, false, 1000)).toBe(true);
    const gone = v({ vz: 11 });
    expect(cue.update(gone, 'me', me, false, 1000 + TRAP_CUE.keep - 50)).toBe(true);
    expect(cue.update(gone, 'me', me, false, 1000 + TRAP_CUE.keep + 50)).toBe(false);
    expect(cue.update(v({}), 'me', me, false, 3000)).toBe(true);
    expect(cue.update(v({ carry: 'me', vz: 0 }), 'me', me, false, 3020)).toBe(false);
    expect(cue.update(v({}), 'me', me, false, 4000)).toBe(true);
    expect(cue.update(v({}), 'me', me, true, 4010)).toBe(false);
  });
  it("never changes a button under a finger: the moment's button keeps its face until the finger lifts", () => {
    const node = { hidden: false, dataset: { tc: 'target', face: 'fist' } as Record<string, string>, setAttribute() {}, querySelector: () => ({ innerHTML: '', textContent: '' }) };
    const c = { sport: new Map([['side', node]]), sportFaces: new Map([['side', 'target|FIGHT|fist|0|0']]), fingers: new Map<number, unknown>() };
    const face = (f: SportFace) => (TouchControls.prototype as unknown as { sportFace: (slot: string, f: SportFace) => void }).sportFace.call(c, 'side', f);
    const trap: SportFace = { action: 'guard', label: 'TRAP', glyph: 'trap' };
    c.fingers.set(1, { role: 'target', node });
    face(trap);
    expect([node.dataset.tc, node.dataset.face]).toEqual(['target', 'fist']);
    c.fingers.clear(); face(trap);
    expect([node.dataset.tc, node.dataset.face]).toEqual(['guard', 'trap']);
  });
  it('pressed as the pass arrives - shown in time to - the touch set\'s guard traps it in the room, and FIGHT comes back', () => {
    const win = new EventTarget(), canvas = Object.assign(new EventTarget(), { requestPointerLock: vi.fn() });
    vi.stubGlobal('window', win); vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false, pointerLockElement: canvas })); vi.stubGlobal('navigator', { getGamepads: () => [] });
    const input = new Input(canvas as unknown as HTMLCanvasElement); input.enabled = true; input.update(1 / 60);
    const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false, replays: false });
    m.add('me', 'taisei', 'Me', false, 'red'); m.add('foe', 'konta', 'Foe', false, 'blue');
    expect(m.start()).toBe(true);
    for (let i = 0; i < 600 && m.view.phase !== 'live'; i++) m.step(1 / 60);
    m.sim.place('me', { x: 0, y: 0, z: -6 }, 0); m.sim.place('foe', { x: 11, y: 0, z: 16 }, Math.PI);
    for (let i = 0; i < 30; i++) { m.submit('me', { ...input.command(BALL_ID, 0), seq: i + 1, yaw: 0 }); m.step(1 / 60); }
    Object.assign(m.ball, pass());
    const cue = new TrapCue(), reach = r + .45 + .7;
    let shownAt = -1, pressedAt = -1, seq = 100;
    for (let i = 0; i < 90; i++) {
      const p = m.sim.actors.get('me')!.state, trap = cue.update(m.view, 'me', p, false, i * 1000 / 60);
      if (trap && shownAt < 0) shownAt = i;
      // The thumb goes down on TRAP as the ball is a tenth of a second off the guard's reach (TouchControls: a finger on
      // the 'guard' slot is Input.touchHold's guard).
      const eta = (Math.hypot(m.ball.x - p.x, m.ball.z - p.z) - reach) / Math.max(1, Math.hypot(m.ball.vx, m.ball.vz));
      if (trap && pressedAt < 0 && eta <= .1) pressedAt = i;
      input.touchHold(0, 0, pressedAt >= 0, false);
      m.submit('me', { ...input.command(BALL_ID, 0), seq: ++seq, yaw: 0 }); m.step(1 / 60);
      if (m.view.events.some(e => e.kind === 'perfect')) break;
    }
    expect(shownAt).toBeGreaterThanOrEqual(0);
    // Up for a third of a second or more before the press: time for a thumb to find it.
    expect((pressedAt - shownAt) / 60).toBeGreaterThan(.3);
    expect(m.view.events.filter(e => e.kind === 'perfect' && e.actorId === 'me').map(e => e.text)).toEqual(['TRAP']);
    expect(m.ball.carry).toBe('me');
    expect(sportSet(m.view, 'me', false, false, m.sim.actors.get('me')!.state, cue.update(m.view, 'me', m.sim.actors.get('me')!.state, false, 2000)).side!.label).toBe('FIGHT');
  });
});

describe('the TECHNIQUE DUEL on the touch set', () => {
  it('the shot\'s button reads DUEL for the beat of a duel of yours, and is SHOOT again after', async () => {
    const { sportSet } = await import('../src/input/sportTouch');
    const { DUEL } = await import('../src/game/ball/superShots');
    const duel = { id: 9, at: 10, kind: 'duel' as const, actorId: 'me', targetId: 'them', x: 0, y: 1, z: 0, value: DUEL.hold };
    const view = (events: unknown[], clash: number) => ({ mode: 'goal-rush', phase: 'live', seats: [{ id: 'me', team: 'red' }, { id: 'them', team: 'blue' }, { id: 'mate', team: 'red' }],
      events, ball: { clash, lastTeam: 'blue' }, drill: null, practice: false }) as never;
    expect(sportSet(view([duel], 10 + DUEL.hold), 'me', false, false).main).toMatchObject({ action: 'heavy', label: 'DUEL' });
    expect(sportSet(view([duel], 10 + DUEL.hold), 'them', false, false).main?.label).toBe('DUEL');
    expect(sportSet(view([duel], 10 + DUEL.hold), 'mate', false, false).main?.label).toBe('SHOOT');
    expect(sportSet(view([duel, { ...duel, id: 10, kind: 'duel-won' }], 10 + DUEL.hold), 'me', false, false).main?.label).toBe('SHOOT');
    expect(sportSet(view([duel], 0), 'me', false, false).main?.label).toBe('SHOOT');
  });
});
