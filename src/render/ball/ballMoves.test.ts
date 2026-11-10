import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {FighterId, PlayerState} from '../../game/types';
import {Fighter, FighterLibrary} from '../Fighter';
import {clipKey} from '../clipMatch';
import {rigOf} from '../../engine/client/retarget';
import {base, loadRig} from '../../../tests/rigHarness';
import {BALL_MOVES, READY_WAIT, ballMovesReady, ballMovesWanted, chosen, fitBallMove, forceBallMove, installBallMoves, loadBallMovesFrom, readPack, resetBallMoves, retimed} from './ballMoves';
import {chooseBallMove, type BallMoveAsk, type BallMoveKey} from './ballMoveChoice';
import {BallMatch} from '../../game/ball/BallMatch';
import {SHOOT} from '../../game/ball/model';
import {MOVES} from '../../game/moves';

/** Ball modes, sports moves (render/ball/ballMoves.ts): the switch, the chooser, the shared file and
 *  its fits on the awkward bodies (the smallest, the biggest, a long coat, a cape, a two-handed weapon, a tail), through
 *  the real FighterLibrary and Fighter. */
const load = GLTFLoader.prototype.loadAsync;
beforeAll(() => { GLTFLoader.prototype.loadAsync = function (url: string) { return loadRig(url.split('?')[0]); }; });
afterAll(() => { GLTFLoader.prototype.loadAsync = load; resetBallMoves(); });

describe('the switch', () => {
  it('is off unless ?ballmoves is asked for on this machine', () => {
    expect(ballMovesWanted(undefined)).toBe(false);
    expect(ballMovesWanted({hostname: 'play.example.com', search: '?ballmoves'})).toBe(true);
    expect(ballMovesWanted({hostname: 'play.example.com', search: ''})).toBe(false);
    expect(ballMovesWanted({hostname: 'localhost', search: '?ballpilot'})).toBe(false);
    expect(ballMovesWanted({hostname: 'localhost', search: '?ballpilot&ballmoves'})).toBe(true);
    expect(ballMovesWanted({hostname: '127.0.0.1', search: '?ballmoves'})).toBe(true);
  });
});

describe('the chooser', () => {
  const ask = (over: Partial<BallMoveAsk>): BallMoveAsk => ({mode: 'goal-rush', action: 'light', grounded: true, style: 'melee', blows: 1, height: 1.75,
    ball: {ahead: 1.3, left: 0, up: .8, radius: .8}, touch: 1, fromGoal: 15, incoming: false, fromNet: 5, ...over});
  const cases: [string, Partial<BallMoveAsk>, BallMoveKey | null][] = [
    ['a light at a rolling ball passes', {}, 'GR.pass'],
    ['a heavy at it shoots', {action: 'heavy'}, 'GR.power'],
    ['a light at a ball over the shoulders heads it', {ball: {ahead: 1, left: 0, up: 2.1, radius: .8}}, 'GR.head'],
    ['a swing from the air at a low ball volleys', {grounded: false, ball: {ahead: 1.2, left: 0, up: .4, radius: .8}}, 'GR.volley'],
    ['a swing from the air at a ball by the head heads it', {grounded: false, ball: {ahead: .9, left: 0, up: 1.8, radius: .8}}, 'GR.headAir'],
    ['a swing at nothing near is drawn as its slot on the floor', {action: 'heavy', ball: {ahead: 12, left: 3, up: 3, radius: .8}}, 'GR.power'],
    ['the FIGHT stance keeps its own', {lock: 'foe'}, null],
    ['the ultimate keeps its own', {action: 'ultimate'}, null],
    ['a barrage keeps its own', {blows: 4}, null],
    ['a beam keeps its own', {style: 'beam'}, null],
    ['a keeper guarding a shot by the goal sets', {action: 'guard', fromGoal: 3, incoming: true}, 'GR.keeper'],
    ['a guard upfield keeps its own', {action: 'guard', fromGoal: 15, incoming: true}, null],
    ['Sky Spike: a first touch digs', {mode: 'sky-spike', ball: {ahead: 1, left: 0, up: .8, radius: .5}}, 'SS.dig'],
    ['Sky Spike: a second touch sets', {mode: 'sky-spike', touch: 2, ball: {ahead: 1, left: 0, up: 1, radius: .5}}, 'SS.set'],
    ['Sky Spike: a high ball is set', {mode: 'sky-spike', ball: {ahead: 1, left: 0, up: 2.4, radius: .5}}, 'SS.set'],
    ['Sky Spike: an air heavy spikes', {mode: 'sky-spike', action: 'heavy', grounded: false, ball: {ahead: 1, left: 0, up: 1.6, radius: .5}}, 'SS.spike'],
    ['Sky Spike: an air light sets', {mode: 'sky-spike', grounded: false}, 'SS.setAir'],
    ['Sky Spike: a guard in the air at the net blocks', {mode: 'sky-spike', action: 'guard', grounded: false, fromNet: 1.2}, 'SS.wall'],
    ['Sky Spike: a guard on the floor keeps its own', {mode: 'sky-spike', action: 'guard', fromNet: 1.2}, null],
    ['a dash keeps its own', {action: 'dash'}, null],
  ];
  for (const [name, over, want] of cases) it(name, () => expect(chooseBallMove(ask(over))).toBe(want));
});

const FILE = '/assets/fighters/ball-moves.glb';
describe('the shared file', () => {
  it('carries every row\'s take with its contact, the reference, and no candidates or names a body could mistake', async () => {
    const file = await loadRig(FILE), pack = readPack(file);
    expect(pack.rig.problem).toBeUndefined();
    expect(pack.takes.has('Stance')).toBe(true);
    for (const row of Object.values(BALL_MOVES)) {
      const take = pack.takes.get(row.take);
      expect(take, row.take).toBeDefined();
      expect(take!.contact).toBeGreaterThan(.1);
      expect(take!.contact).toBeLessThan(.9);
      expect((take!.clip.userData as {provenance?: string}).provenance, row.take).toMatch(/Quaternius|techniques\.glb/);
    }
    for (const clip of file.animations) {
      expect(clip.name.startsWith('cand '), clip.name).toBe(false);
      // (clipMatch finds a body's clips by substring: none of these may answer to a body's own conventions.)
      for (const word of ['run', 'jump', 'hit', 'block', 'idle']) expect(clipKey(clip.name).includes(word), `${clip.name} holds ${word}`).toBe(false);
    }
  });
  it('lands a take\'s contact on the move\'s by moving its keys', () => {
    const clip = new THREE.AnimationClip('t', 1, [new THREE.NumberKeyframeTrack('x.value', [0, .38, 1], [0, 1, 2])]);
    const out = retimed(clip, .38, .5);
    expect(out.duration).toBe(1);
    expect(out.tracks[0].times[1]).toBeCloseTo(.5, 5);
    expect(retimed(clip, .38, .5)).toBe(out);
  });
});

const AWKWARD: FighterId[] = ['kosho', 'torsion', 'gorai', 'kenzo', 'levin', 'strix', 'imago'];
describe('fitted to the bodies', () => {
  const library = new FighterLibrary();
  beforeAll(async () => { resetBallMoves(); await loadBallMovesFrom(async () => readPack(await loadRig(FILE))); }, 60000);

  it('every take fits the awkward bodies in place, none refused', async () => {
    await library.ensure(AWKWARD);
    for (const id of AWKWARD) {
      const body = library.create({...base(id), id});
      const read = body.take({...body.state, action: 'idle'});
      for (const key of Object.keys(BALL_MOVES) as BallMoveKey[]) {
        const fit = fitBallMove(read.scene, read.clips, key, id);
        expect(fit, `${id} ${key}`).toBeTruthy();
        // In place: the hips stray no more than a stride's share along the floor (the game moves the body).
        const rig = rigOf(read.scene), named = rig.nodes[rig.joints.get('Hips')!].name, hips = fit!.clip.tracks.find(t => t.name === `${named}.position`)!;
        let most = 0;
        for (let i = 3; i < hips.values.length; i += 3) most = Math.max(most, Math.hypot(hips.values[i] - hips.values[0], hips.values[i + 2] - hips.values[2]));
        expect(most / rig.hipsHeight, `${id} ${key} travels`).toBeLessThan(.45);
      }
      body.dispose();
    }
  }, 120000);

  it('a swing is handed its take through the transplant hook, the hook before it asked otherwise', async () => {
    await library.ensure(['kosho']);
    const before = Fighter.transplant, asked: string[] = [];
    Fighter.transplant = (_body, state) => { asked.push(state.action); return undefined; };
    installBallMoves(() => undefined);
    try {
      const body = library.create({...base('kosho'), id: 'k'});
      const light: PlayerState = {...base('kosho'), id: 'k', action: 'light', actionStarted: 1, actionSeq: 3, actionDuration: .44, actionTime: .1, chain: 0};
      // No ball match on the page: the body's own clip (the hook before it is asked).
      expect(Fighter.transplant!(body, light)).toBeUndefined();
      expect(asked).toEqual(['light']);
      forceBallMove('GR.pass');
      const swap = Fighter.transplant!(body, {...light, actionSeq: 4});
      expect(swap?.clip.name).toBe('ball GR.pass');
      expect(swap?.phase).toBe('-ball-GR.pass');
      expect(chosen.at(-1)?.key).toBe('GR.pass');
      // Drawn by the body: the take is what it plays.
      body.update(1 / 60, {...light, actionSeq: 5}, true);
      expect(body.motionEvidence().clip).toBe('ball GR.pass');
      body.dispose();
    } finally { forceBallMove(null); resetBallMoves(before); }
  }, 60000);

  // SHOOT's quick strike (model.ts SHOOT) is nobody's own clip, so it is drawn with a take on every page.
  it('SHOOT\'s quick strike is drawn with a take without ?ballmoves - its contact on the quick strike\'s - and nothing else is', async () => {
    await library.ensure(['kosho']);
    const before = Fighter.transplant;
    Fighter.transplant = undefined;
    // (The tests before this one put the takes away: in hand again, as a ball room's loading has them - ballMovesReady.)
    await loadBallMovesFrom(async () => readPack(await loadRig(FILE)));
    const m = new BallMatch('goal-rush', {seed: 3, access: 'bots', practice: true});
    m.add('k', 'kosho', 'K', false, 'red');
    installBallMoves(() => ({view: m.view, ball: null}), false);
    try {
      const body = library.create({...base('kosho'), id: 'k'});
      const swing: PlayerState = {...base('kosho'), id: 'k', action: 'heavy', actionStarted: 1, actionSeq: 3, actionDuration: SHOOT.duration, actionTime: 0, grounded: true};
      // A light, and a heavy that is not SHOOT's tap (the FIGHT stance's, or one wound up): the body's own clip.
      expect(Fighter.transplant!(body, {...swing, action: 'light', actionSeq: 1})).toBeUndefined();
      expect(Fighter.transplant!(body, {...swing, actionSeq: 2})).toBeUndefined();
      expect(Fighter.transplant!(body, {...swing, actionSeq: 2, strike: 'charge', charge: .4})).toBeUndefined();
      // The tap, on the floor: the kick, timed by the quick strike - its blow's frame where the simulation's blow lands.
      const kick = Fighter.transplant!(body, {...swing, strike: 'tap'});
      expect(kick?.phase).toBe('-ball-GR.power');
      expect(kick?.move.contacts[0]).toBe(SHOOT.contact);
      const read = body.take({...swing, action: 'idle'}), fit = fitBallMove(read.scene, read.clips, 'GR.power', 'kosho')!;
      expect(kick?.clip).toBe(retimed(fit.clip, fit.take.contact, SHOOT.contact / SHOOT.duration));
      // (The take's own contact, moved: within a hundredth of the clip - 4 ms of the swing - of the simulation's.)
      expect(Math.abs(Math.round(SHOOT.contact / SHOOT.duration * 100) / 100 * SHOOT.duration - SHOOT.contact)).toBeLessThan(.004);
      // In the air: the volley. The key held on turns the same swing into the fighter's own move: their own clip again.
      expect(Fighter.transplant!(body, {...swing, actionSeq: 4, strike: 'tap', grounded: false, y: 2, branch: 'airHeavy'})?.phase).toBe('-ball-GR.volley');
      expect(Fighter.transplant!(body, {...swing, actionSeq: 4, strike: 'charge', grounded: false, y: 2, branch: 'airHeavy'})).toBeUndefined();
      // Under the renderer's feel pass ('snap', the game's default) a melee swing is drawn on
      // a clock warped round the move it reads for the body - its own air strike here, whose blow falls inside the quick
      // strike's 0.4 s - so the take is laid where that clock stands at the quick strike's blow (filmed: the volley's foot
      // had been fastest 36-44 ms after the ball left).
      const style = Fighter.animStyle;
      Fighter.animStyle = 'snap';
      try {
        const air: PlayerState = {...swing, actionSeq: 5, strike: 'tap', grounded: false, y: 2, branch: 'airHeavy'};
        const volley = Fighter.transplant!(body, air), own = body.movePlayed(air), fitAir = fitBallMove(read.scene, read.clips, 'GR.volley', 'kosho')!;
        const drawn = Fighter.animeWarp(SHOOT.contact, own.contacts, SHOOT.duration, .05) / SHOOT.duration;
        expect(own.contacts[0]).toBeLessThan(SHOOT.duration - .1);
        expect(drawn).toBeLessThan(SHOOT.contact / SHOOT.duration - .02);
        expect(volley?.clip).toBe(retimed(fitAir.clip, fitAir.take.contact, drawn));
        // (On the floor Kosho's heavy lands its blow past the swing's end: no warp, the take as it was.)
        expect(Fighter.transplant!(body, {...swing, actionSeq: 6, strike: 'tap'})?.clip).toBe(retimed(fit.clip, fit.take.contact, SHOOT.contact / SHOOT.duration));
      } finally { Fighter.animStyle = style; }
      body.dispose();
    } finally { resetBallMoves(before); }
  }, 60000);
  it('with no take to draw it (the file missing), the quick strike is the fighter\'s own heavy, its blow moved onto the quick strike\'s', async () => {
    await library.ensure(['kosho']);
    const before = Fighter.transplant;
    Fighter.transplant = undefined;
    resetBallMoves(undefined);
    await loadBallMovesFrom(async () => { throw new Error('no file'); });
    const m = new BallMatch('sky-spike', {seed: 3, access: 'bots', practice: true});
    m.add('k', 'kosho', 'K', false, 'red');
    installBallMoves(() => ({view: m.view, ball: null}), false);
    try {
      const body = library.create({...base('kosho'), id: 'k'});
      const swing: PlayerState = {...base('kosho'), id: 'k', action: 'heavy', strike: 'tap', actionStarted: 1, actionSeq: 3, actionDuration: SHOOT.duration, actionTime: 0, grounded: true};
      const own = Fighter.transplant!(body, swing), made = MOVES.kosho.heavy, clip = body.take({...swing, strike: undefined}).clip!;
      expect(own?.phase).toBe('-ball-own');
      expect(own?.move.contacts[0]).toBe(SHOOT.contact);
      expect(own?.clip).toBe(retimed(clip, made.contacts[0] / made.duration, SHOOT.contact / SHOOT.duration));
      expect(own?.clip.duration).toBe(clip.duration);
      body.dispose();
    } finally { resetBallMoves(before); await loadBallMovesFrom(async () => readPack(await loadRig(FILE))); }
  }, 60000);
});

// Every ball room now fetches the file for SHOOT's quick strike; a slow one must not hold its loading.
describe('the loading', () => {
  it('a file that never comes holds a ball room\'s loading READY_WAIT at the most, when only the quick strike wants it', async () => {
    const before = Fighter.transplant;
    resetBallMoves(before);
    void loadBallMovesFrom(() => new Promise(() => {}));
    installBallMoves(() => undefined, false);
    vi.useFakeTimers();
    try {
      let done = false;
      void ballMovesReady().then(() => { done = true; });
      await vi.advanceTimersByTimeAsync(READY_WAIT - 50);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(100);
      expect(done).toBe(true);
    } finally { vi.useRealTimers(); resetBallMoves(before); }
  });
});
