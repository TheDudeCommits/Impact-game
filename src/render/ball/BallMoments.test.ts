import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {BallMoments, MAY_PRINT, printCause} from './BallMoments';
import {freshBall} from '../../game/ball/physics';
import type {BallEvent, BallModeId, BallView} from '../../game/ball/model';
import type {FollowCamera} from '../FollowCamera';
import type {GameSnapshot} from '../../game/types';

// The peaks land on the screen (the screen punch), Sky Spike's lens is never shaken,
// a SKY SPIKE struck is no impact frame, and a wipe-out is felt only by a viewer near it.
// The quiet rule: only a goal, a point that decides or saves the match, a SUPER SHOT struck and a
// TECHNIQUE DUEL's end print the whole screen, and no more often than one print in 20 s of live play.
const view = (mode: BallModeId, events: BallEvent[], more: Partial<BallView> = {}): BallView => ({
  kind: 'ball', mode, phase: 'live', access: 'bots', round: 1, hostId: null, capacity: 6, fillBots: true, startsAt: null, startedAt: 0, endsAt: 240, phaseUntil: 0,
  seats: [], score: {red: 0, blue: 0}, ball: {...freshBall(), held: false}, clock: 200, overtime: false, touchTeam: null, touches: 0, rally: 0, servingTeam: 'red', serverId: null,
  target: 0, fever: false, winner: null, reason: '', mvp: null, events, replay: null, rumble: false, charms: [], effects: [], practice: false, best: 0, aim: null, hits: 0, streak: 0, bestStreak: 0, ...more});
const setup = (body = new THREE.Vector3(0, 0, 0)) => {
  const calls: string[] = [], shakes: number[] = [], punches: number[] = [];
  const frame = {impactFrame: () => calls.push('impact'), chromaticPulse: () => calls.push('chroma'), speedLines: () => calls.push('lines'), inkFlash: () => calls.push('ink'), inkKeep: () => {},
    screenPunch: (amount: number) => punches.push(amount)};
  const lens = {impact: (w: number) => shakes.push(w)} as unknown as FollowCamera;
  const moments = new BallMoments(frame, () => [[lens, body]], () => null);
  let id = 0, clock = 10;
  const handle = (mode: BallModeId, events: Partial<BallEvent>[], t = clock, more: Partial<BallView> = {}) => {
    clock = t;
    moments.handle({serverTime: t, players: [], ball: view(mode, events.map(e => ({id: ++id, at: t, kind: 'strike', x: 0, y: 1, z: 0, ...e}) as BallEvent), more)} as unknown as GameSnapshot);
  };
  /** `seconds` of the match with nothing happening, a frame at a time: live play fills the page's well. */
  const play = (mode: BallModeId, seconds: number, more: Partial<BallView> = {}) => { for (let left = seconds; left > 1e-6; left -= .1) handle(mode, [], clock + .1, more); };
  /** The full-screen prints thrown so far (each an impact frame, a colour fringe or an INK FLASH). */
  const printed = () => calls.filter(c => c !== 'lines').length;
  return {calls, shakes, punches, handle, play, printed, moments, now: () => clock};
};
/** Every kind of event a match publishes (the compiler keeps the list whole), with the texts that pick a peak. */
const KINDS: Record<BallEvent['kind'], readonly (string | undefined)[]> = {
  goal: [undefined, 'SUPER GOAL'], 'own-goal': [undefined], save: ['SAVE', 'PERFECT SAVE', 'DIVING SAVE', 'OFF THE LINE'], shot: [undefined], post: [undefined], kickoff: [undefined], overtime: [undefined],
  point: [undefined], ace: [undefined], kill: [undefined, 'SUPER SHOT'], block: [undefined], fault: [undefined], out: ['OUT'], net: [undefined], touches: ['FOUR TOUCHES'], rally: [undefined], fever: [undefined],
  super: [undefined], bowled: [undefined], perfect: ['PERFECT GUARD', 'STUFF BLOCK'], serve: [undefined], 'side-out': [undefined], 'match-point': ['MATCH POINT'], demo: [undefined],
  strike: [undefined, 'SKY SPIKE', 'ROLL SPIKE', 'LINK SHOT', 'PERFECT STRIKE', 'BICYCLE KICK', 'HEADER'], win: [undefined], accolade: ['HAT TRICK'], chat: [undefined], charm: [undefined], shield: [undefined],
  clash: [undefined], target: [undefined], duel: ['TECHNIQUE DUEL'], 'duel-won': ['SHOT STOPPED', 'BREAKS THROUGH'], wipeout: ['BUMP'], dig: ['DIG'], touch: ['SET · PERFECT', 'SPIKE · FLUBBED'], tackle: ['TACKLE'], reversal: ['REVERSAL'], set: ['QUICK SET'], deuce: ['DEUCE'], comeback: ['COMEBACK'], pass: ['PASS', 'LOFTED'], steal: ['POKE', 'SLIDE', 'SLIDING', 'POKING', 'MISSED', 'BEATEN', 'TRICK'],
};

describe('the ball moments on the screen', () => {
  it('never shakes Sky Spike\'s lens, and lands its moments on the screen instead', () => {
    const {calls, shakes, punches, handle, play} = setup();
    handle('sky-spike', [{kind: 'strike', text: 'SKY SPIKE', value: 24}]);
    expect(calls).not.toContain('impact');
    expect(punches).toHaveLength(1);
    play('sky-spike', 21);
    handle('sky-spike', [{kind: 'kill', team: 'red', value: 1}, {kind: 'super'}, {kind: 'clash'}, {kind: 'perfect', text: 'STUFF BLOCK'}]);
    play('sky-spike', 1);
    expect(shakes).toHaveLength(0);
    // (The SUPER SHOT struck is the one of the four that prints.)
    expect(calls).toEqual(expect.arrayContaining(['impact', 'ink']));
    expect(calls.filter(c => c === 'impact')).toHaveLength(1);
    expect(punches.length).toBeGreaterThanOrEqual(4);
  });
  it('still shakes Goal Rush\'s lens for a goal, and prints a screamer longer', () => {
    const {shakes, punches, handle} = setup();
    handle('goal-rush', [{kind: 'goal', value: 140}]);
    expect(shakes).toHaveLength(1);
    expect(punches[0]).toBeCloseTo(1, 5);
  });
  it('lands a wipe-out on the screen only for a viewer near it, and prints it for nobody', () => {
    const near = setup(new THREE.Vector3(3, 0, 0)), far = setup(new THREE.Vector3(0, 0, 40));
    near.handle('goal-rush', [{kind: 'wipeout', x: 0, y: 1, z: 0}]);
    far.handle('goal-rush', [{kind: 'wipeout', x: 0, y: 1, z: 0}]);
    expect(near.punches).toHaveLength(1);
    expect(near.printed()).toBe(0);
    expect(far.punches).toHaveLength(0);
    expect(far.calls).toHaveLength(0);
  });
  it('punches a power shot but not a pass', () => {
    const {punches, calls, handle} = setup();
    handle('goal-rush', [{kind: 'strike', value: 14}]);
    expect(punches).toHaveLength(0);
    handle('goal-rush', [{kind: 'strike', value: 34}], 11);
    expect(punches).toHaveLength(1);
    expect(calls).not.toContain('impact');
  });
});

describe('the quiet rule', () => {
  it('prints the whole screen only for the kinds on the list, whatever the event says', () => {
    expect([...MAY_PRINT].sort()).toEqual(['ace', 'duel-won', 'goal', 'kill', 'out', 'own-goal', 'point', 'super', 'touches', 'win']);
    for (const mode of ['goal-rush', 'sky-spike'] as const) for (const kind of Object.keys(KINDS) as BallEvent['kind'][]) for (const text of KINDS[kind]) for (const perfect of [false, true]) {
      // A full well, a viewer beside the moment, a shot at a screamer's pace, the score at match point: everything that
      // could make a moment as big as it gets.
      const {handle, play, printed, shakes} = setup(new THREE.Vector3(1, 0, 1));
      const score = {red: 10, blue: 10};
      play(mode, 21, {score});
      handle(mode, [{kind, text, perfect, team: 'red', value: mode === 'sky-spike' && kind !== 'strike' ? 1 : 140}], undefined, {score: {red: 11, blue: 10}});
      play(mode, 1, {score: {red: 11, blue: 10}});
      const label = `${mode} ${kind} ${text ?? ''} ${perfect ? 'perfect' : ''}`;
      if (!MAY_PRINT.has(kind)) {
        expect(printed(), label).toBe(0);
        // Nor is a lens moved for it (a duel's start is the one beat that still shakes Goal Rush's).
        if (kind !== 'duel') expect(shakes, label).toHaveLength(0);
      }
    }
  });
  it('names what prints: a goal, a SUPER SHOT struck, a duel\'s end, the point that decides or saves the match', () => {
    const e = (kind: BallEvent['kind'], more: Partial<BallEvent> = {}) => ({id: 1, at: 0, kind, x: 0, y: 0, z: 0, ...more}) as BallEvent;
    const at = (mode: BallModeId, red: number, blue: number, practice = false) => ({mode, score: {red, blue}, target: 11, practice});
    expect(printCause(e('goal'), at('goal-rush', 1, 0))).toBe('goal');
    expect(printCause(e('own-goal'), at('goal-rush', 1, 0))).toBe('goal');
    expect(printCause(e('super'), at('sky-spike', 0, 0))).toBe('super');
    expect(printCause(e('duel-won', {text: 'SHOT STOPPED'}), at('goal-rush', 0, 0))).toBe('duel');
    // Sky Spike to 11, two clear: 11-9 is the match, 10-10 from 9-10 saved a match point, 5-3 is a point.
    expect(printCause(e('kill', {team: 'red', value: 1}), at('sky-spike', 11, 9))).toBe('decider');
    expect(printCause(e('out', {team: 'red', value: 1}), at('sky-spike', 11, 9))).toBe('decider');
    expect(printCause(e('kill', {team: 'red', value: 1}), at('sky-spike', 10, 10))).toBe('decider');
    expect(printCause(e('ace', {team: 'blue', value: 2}), at('sky-spike', 12, 12))).toBe('decider');
    expect(printCause(e('kill', {team: 'red', value: 1}), at('sky-spike', 5, 3))).toBeNull();
    expect(printCause(e('kill', {team: 'red', value: 1}), at('sky-spike', 11, 10))).toBeNull();
    // FREE PLAY keeps no match; a kill in Goal Rush is nothing; the final whistle may print by the rule and does not yet.
    expect(printCause(e('kill', {team: 'red', value: 1}), at('sky-spike', 11, 9, true))).toBeNull();
    expect(printCause(e('kill', {team: 'red', value: 1}), at('goal-rush', 11, 9))).toBeNull();
    expect(printCause(e('win'), at('goal-rush', 3, 1))).toBeNull();
    for (const kind of ['clash', 'perfect', 'save', 'strike', 'wipeout', 'demo', 'duel', 'post', 'fever'] as const) expect(printCause(e(kind, {text: 'PERFECT SAVE', perfect: true}), at('goal-rush', 0, 0))).toBeNull();
  });
  it('prints Sky Spike\'s deciding point and its match point saved, and no other kill', () => {
    const {handle, play, printed, moments} = setup();
    play('sky-spike', 5);
    handle('sky-spike', [{kind: 'kill', team: 'red', value: 1}], undefined, {score: {red: 5, blue: 3}});
    expect(printed()).toBe(0);
    play('sky-spike', 3);
    handle('sky-spike', [{kind: 'kill', team: 'blue', value: 1}], undefined, {score: {red: 10, blue: 10}});
    expect(moments.prints).toBe(1);
    play('sky-spike', 3);
    handle('sky-spike', [{kind: 'ace', team: 'red', value: 1}], undefined, {score: {red: 12, blue: 10}});
    expect(moments.prints).toBe(2);
  });
  it('owes only the first match point saved its print, as the room shows only that one again', () => {
    const {handle, play, moments} = setup();
    play('sky-spike', 3);
    // Red, 3-10 down, saves match point after match point (a bot match did seven in a row).
    for (let red = 4; red <= 7; red++) { handle('sky-spike', [{kind: 'kill', team: 'red', value: 1}], undefined, {score: {red, blue: 10}}); play('sky-spike', 4); }
    expect(moments.prints).toBe(1);
    // With twenty seconds of play in the well (the first save owed it back), the next save prints; the winning point is
    // printed whatever is in it.
    play('sky-spike', 22);
    handle('sky-spike', [{kind: 'ace', team: 'red', value: 1}], undefined, {score: {red: 8, blue: 10}});
    expect(moments.prints).toBe(2);
    play('sky-spike', 3);
    handle('sky-spike', [{kind: 'kill', team: 'red', value: 1}], undefined, {score: {red: 12, blue: 10}});
    expect(moments.prints).toBe(3);
    // A new match owes its own first save again.
    play('sky-spike', 2, {startedAt: 900});
    handle('sky-spike', [{kind: 'kill', team: 'blue', value: 1}], undefined, {startedAt: 900, score: {red: 10, blue: 10}});
    expect(moments.prints).toBe(4);
  });
  it('keeps to the budget: a SUPER SHOT or a duel\'s end prints only when 20 s of live play have filled the well', () => {
    const {handle, play, calls, moments} = setup();
    // A match's first seconds: the well is dry. The shot is felt (the lines) and not printed.
    play('goal-rush', 5);
    handle('goal-rush', [{kind: 'super'}]);
    expect(moments.prints).toBe(0);
    expect(calls).toContain('lines');
    expect(calls).not.toContain('impact');
    // Stoppage fills nothing; live play does.
    play('goal-rush', 30, {phase: 'scored'});
    handle('goal-rush', [{kind: 'super'}]);
    expect(moments.prints).toBe(0);
    play('goal-rush', 20.5);
    handle('goal-rush', [{kind: 'super'}]);
    expect(moments.prints).toBe(1);
    play('goal-rush', 8);
    handle('goal-rush', [{kind: 'duel-won', text: 'SHOT STOPPED'}]);
    handle('goal-rush', [{kind: 'super'}]);
    expect(moments.prints).toBe(1);
    play('goal-rush', 20.5);
    handle('goal-rush', [{kind: 'duel-won', text: 'SHOT STOPPED'}]);
    expect(moments.prints).toBe(2);
  });
  it('always prints a goal, and owes it back to the budget', () => {
    const {handle, play, moments} = setup();
    play('goal-rush', 2);
    handle('goal-rush', [{kind: 'goal', value: 60}]);
    play('goal-rush', 4);
    handle('goal-rush', [{kind: 'own-goal', value: 60}]);
    expect(moments.prints).toBe(2);
    // Two goals in six seconds: 20 s of live play pay back one of them, and a SUPER SHOT still finds the well dry. It
    // takes the rest of the minute before the page has a print to spend on one.
    play('goal-rush', 21);
    handle('goal-rush', [{kind: 'super'}]);
    expect(moments.prints).toBe(2);
    play('goal-rush', 34);
    handle('goal-rush', [{kind: 'super'}]);
    expect(moments.prints).toBe(3);
    // Over a whole match of bots' pace (a goal every 25 s, a SUPER SHOT between each): never more than one print in 20 s.
    const long = setup();
    for (let i = 0; i < 12; i++) { long.play('goal-rush', 12.5); long.handle('goal-rush', [{kind: 'super'}]); long.play('goal-rush', 12.5); long.handle('goal-rush', [{kind: 'goal', value: 60}]); }
    expect(long.moments.prints).toBeGreaterThanOrEqual(12);
    expect(long.moments.prints).toBeLessThanOrEqual(300 / 20);
  });
  it('budgets FREE PLAY\'s goals too', () => {
    const {handle, play, moments} = setup();
    play('goal-rush', 21, {practice: true});
    for (let i = 0; i < 4; i++) { handle('goal-rush', [{kind: 'goal', value: 60}], undefined, {practice: true}); play('goal-rush', 3, {practice: true}); }
    expect(moments.prints).toBe(1);
  });
  it('holds one print for a duel broken through and the goal it scores a moment later', () => {
    const {handle, play, calls, moments} = setup();
    play('goal-rush', 21);
    handle('goal-rush', [{kind: 'duel-won', text: 'BREAKS THROUGH'}]);
    play('goal-rush', .2);
    handle('goal-rush', [{kind: 'goal', text: 'SUPER GOAL', value: 120}]);
    expect(moments.prints).toBe(1);
    expect(calls.filter(c => c === 'impact')).toHaveLength(1);
    expect(calls.filter(c => c === 'chroma')).toHaveLength(1);
    // (The goal's INK FLASH holds the page the duel's end put up.)
    expect(calls.filter(c => c === 'ink')).toHaveLength(2);
    // A goal after the page has let go, still inside the same second, strikes nothing new.
    const late = setup();
    late.play('goal-rush', 21);
    late.handle('goal-rush', [{kind: 'super'}]);
    late.play('goal-rush', .8);
    late.handle('goal-rush', [{kind: 'goal', value: 60}]);
    expect(late.moments.prints).toBe(1);
    expect(late.calls.filter(c => c === 'ink')).toHaveLength(1);
    expect(late.calls.filter(c => c === 'impact')).toHaveLength(1);
  });
  it('starts each match with a dry well', () => {
    const {handle, play, moments} = setup();
    play('goal-rush', 25);
    play('goal-rush', 2, {startedAt: 500});
    handle('goal-rush', [{kind: 'super'}], undefined, {startedAt: 500});
    expect(moments.prints).toBe(0);
  });
});
