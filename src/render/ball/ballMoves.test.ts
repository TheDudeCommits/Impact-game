import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {FighterId, PlayerState} from '../../game/types';
import {Fighter, FighterLibrary} from '../Fighter';
import {clipKey} from '../clipMatch';
import {rigOf} from '../../engine/client/retarget';
import {base, loadRig} from '../../../tests/rigHarness';
import {BALL_KIT_DEFAULT, BALL_MOVES, READY_WAIT, ballMovesReady, ballMovesWanted, chosen, fitBallMove, forceBallMove, heldOn, installBallMoves, loadBallMovesFrom, noteBallStick, readPack, resetBallMoves, retimed, takeOf} from './ballMoves';
import {CELEBRATIONS, chooseBallMove, type BallMoveAsk, type BallMoveKey} from './ballMoveChoice';
import {BallMatch} from '../../game/ball/BallMatch';
import {SHOOT} from '../../game/ball/model';
import {goalZ} from '../../game/ball/physics';
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

  // The sport kit: with the kit on, the whole kit; without it, the prototype's choices as
  // SHOOT's quick strike ships them (above).
  const kit: [string, Partial<BallMoveAsk>, BallMoveKey | null][] = [
    ['a light at a rolling ball passes', {}, 'GR.pass'],
    ['SHOOT\'s tap keeps the quick strike\'s kick', {action: 'heavy', strike: 'tap'}, 'GR.power'],
    ['SHOOT\'s charge is the DRIVE', {action: 'heavy', strike: 'charge'}, 'GR.drive'],
    ['a ball above and behind, from the air, is kicked overhead', {grounded: false, ball: {ahead: .2, left: 0, up: 2.3, radius: .8}}, 'GR.bicycle'],
    ['a ball above and ahead, from the air, is headed', {grounded: false, ball: {ahead: 1.2, left: 0, up: 1.9, radius: .8}}, 'GR.headAir'],
    ['a guard as a ball comes to the body is the TRAP', {action: 'guard', arriving: true}, 'GR.trap'],
    ['a guard with no ball coming keeps its own', {action: 'guard'}, null],
    ['the keeper dives left at a shot crossing wide on the left', {action: 'guard', fromGoal: 3, incoming: true, shot: {left: 1.6, eta: .5}}, 'GR.diveL'],
    ['and right on the right', {action: 'guard', fromGoal: 3, incoming: true, shot: {left: -1.4, eta: .5}}, 'GR.diveR'],
    ['a shot about to arrive at the keeper is parried', {action: 'guard', fromGoal: 3, incoming: true, shot: {left: .2, eta: .3}}, 'GR.parry'],
    ['one still far off is the keeper\'s set', {action: 'guard', fromGoal: 3, incoming: true, shot: {left: .2, eta: .9}}, 'GR.keeper'],
    ['the carrier\'s run is the carry', {action: 'run', carrying: true}, 'GR.carry'],
    ['anyone else\'s run keeps its own', {action: 'run'}, null],
    ['the FIGHT stance\'s blow at the one on the ball, close, is a shoulder charge', {lock: 'foe', foe: {distance: 1.4, onBall: true}}, 'GR.shoulder'],
    ['further off, a slide', {lock: 'foe', action: 'heavy', foe: {distance: 2.8, onBall: true}}, 'GR.slide'],
    ['at one off the ball, the fighter\'s own', {lock: 'foe', foe: {distance: 1.4, onBall: false}}, null],
    ['a barrage in the FIGHT stance keeps its own', {lock: 'foe', blows: 3, foe: {distance: 1.4, onBall: true}}, null],
    ['Sky Spike: the DIVE at a ball coming over is the diving dig', {mode: 'sky-spike', action: 'dash', diving: true}, 'SS.pancake'],
    ['Sky Spike: a dash to get somewhere keeps its own', {mode: 'sky-spike', action: 'dash'}, null],
    ['Goal Rush\'s dash keeps its own', {action: 'dash'}, null],
    ['Sky Spike: a set the stick sends across the court is the BACK SET', {mode: 'sky-spike', touch: 2, backSet: true}, 'SS.backSet'],
    ['Sky Spike: a spike placed short is the roll shot', {mode: 'sky-spike', action: 'heavy', grounded: false, place: {a: .3, f: -1}}, 'SS.spikeRoll'],
    ['placed across, the cut', {mode: 'sky-spike', action: 'heavy', grounded: false, place: {a: 1, f: 0}}, 'SS.spikeCut'],
    ['placed deep or not at all, the straight arm', {mode: 'sky-spike', action: 'heavy', grounded: false, place: {a: 0, f: 1}}, 'SS.spike'],
    ['Sky Spike: a TIP', {mode: 'sky-spike', grounded: false, tip: true}, 'SS.tip'],
    ['Sky Spike: a serve from the floor floats', {mode: 'sky-spike', serve: true}, 'SS.float'],
    ['from the air, the JUMP SERVE', {mode: 'sky-spike', action: 'heavy', grounded: false, serve: true}, 'SS.jumpServe'],
    ['a goal\'s scorer celebrates', {action: 'victory', celebrate: 'goal', seed: 4}, CELEBRATIONS.goal[1]],
    ['the victory pose with no moment keeps its own', {action: 'victory'}, null],
    ['the ultimate keeps its own', {action: 'ultimate'}, null],
  ];
  for (const [name, over, want] of kit) it(`kit: ${name}`, () => expect(chooseBallMove(ask(over), true)).toBe(want));
  it('six celebrations, each moment dealing three', () => {
    const all = new Set(Object.values(CELEBRATIONS).flat());
    expect(all.size).toBe(6);
    for (const moment of ['goal', 'point', 'podium'] as const) for (let seed = 0; seed < 3; seed++) expect(chooseBallMove(ask({action: 'victory', celebrate: moment, seed}), true)).toBe(CELEBRATIONS[moment][seed]);
  });
  it('the kit is not the default', () => expect(BALL_KIT_DEFAULT).toBe(false));
});

const FILE = '/assets/fighters/ball-moves.glb';
describe('the shared file', () => {
  it('carries every row\'s take with its contact, the reference, and no candidates or names a body could mistake', async () => {
    const file = await loadRig(FILE), pack = readPack(file);
    expect(pack.rig.problem).toBeUndefined();
    expect(pack.takes.has('Stance')).toBe(true);
    for (const row of Object.values(BALL_MOVES)) for (const name of new Set([takeOf(row, false), takeOf(row, true)])) {
      const take = pack.takes.get(name);
      expect(take, name).toBeDefined();
      expect(take!.contact).toBeGreaterThan(.1);
      expect(take!.contact).toBeLessThan(.9);
      // (The sport kit: Meshy's text to motion, each take's task named.)
      expect((take!.clip.userData as {provenance?: string}).provenance, name).toMatch(/Quaternius|techniques\.glb|Meshy text to motion \(prime\), task [0-9a-f-]{36}/);
    }
    // Every take in the file is one a row draws (nothing shipped that nobody plays) but the reference.
    const drawn = new Set(Object.values(BALL_MOVES).flatMap(row => [takeOf(row, false), takeOf(row, true)]));
    for (const clip of file.animations) if (clip.name !== 'Stance') expect(drawn.has(clip.name), `${clip.name} is drawn by no row`).toBe(true);
    for (const clip of file.animations) {
      expect(clip.name.startsWith('cand '), clip.name).toBe(false);
      // (clipMatch finds a body's clips by substring: none of these may answer to a body's own conventions.)
      for (const word of ['run', 'jump', 'hit', 'block', 'idle']) expect(clipKey(clip.name).includes(word), `${clip.name} holds ${word}`).toBe(false);
    }
  });
  it('is under its size: fetched as every ball room loads (about 650 KB with the kit, under 1 MB)', async () => {
    const {statSync} = await import('node:fs');
    expect(statSync(new URL('../../../public/assets/fighters/ball-moves.glb', import.meta.url)).size).toBeLessThan(1024 * 1024);
  });

  it('holds a take played through on its last frame, so a guard or a victory pose looping it never comes round', () => {
    const clip = new THREE.AnimationClip('t', 1, [new THREE.NumberKeyframeTrack('x.value', [0, .5, 1], [0, 1, 2])]);
    const out = heldOn(clip, 2);
    expect(out.duration).toBeGreaterThan(20);
    expect(Array.from(out.tracks[0].times.slice(0, 3))).toEqual([0, .25, .5]);
    expect(out.tracks[0].values.at(-1)).toBe(2);
    expect(heldOn(clip, 2)).toBe(out);
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
      for (const key of Object.keys(BALL_MOVES) as BallMoveKey[]) for (const kit of [false, true]) {
        const fit = fitBallMove(read.scene, read.clips, key, id, kit);
        expect(fit, `${id} ${key} ${kit ? 'kit' : 'prototype'}`).toBeTruthy();
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

// The sport kit: with the kit on, the hook draws the kit's actions besides the swings.
describe('the kit through the hook', () => {
  const library = new FighterLibrary();
  const before = Fighter.transplant;
  beforeAll(async () => { resetBallMoves(); Fighter.transplant = undefined; await loadBallMovesFrom(async () => readPack(await loadRig(FILE))); await library.ensure(['kosho']); }, 60000);
  afterAll(() => resetBallMoves(before));

  it('Sky Spike: the DIVE and its get-up, a celebration held, a spike\'s arm by the page\'s own stick', () => {
    const m = new BallMatch('sky-spike', {seed: 3, access: 'bots', practice: true});
    m.add('k', 'kosho', 'K', false, 'red');
    installBallMoves(() => ({view: m.view, ball: null}), true);
    const body = library.create({...base('kosho'), id: 'k'}), st: PlayerState = {...base('kosho'), id: 'k'};
    // A dash at a ball the other side sent is the diving dig, laid across the dash; the idle straight after it gets up off
    // the floor, held at its end. (A dash with no such ball is the body's own.)
    expect(Fighter.transplant!(body, {...st, action: 'dash', actionStarted: .5, actionDuration: .22, actionTime: .2})).toBeUndefined();
    Object.assign(m.view.ball, {x: 1, y: 1, z: 2, held: false, lastTeam: 'blue'});
    expect(Fighter.transplant!(body, {...st, action: 'dash', actionStarted: 1, actionDuration: .22, actionTime: .2})?.phase).toBe('-ball-SS.pancake');
    const up = Fighter.transplant!(body, {...st, action: 'idle', actionStarted: 1.22});
    expect(up?.phase).toBe('-ball-SS.pancakeUp');
    expect(up!.clip.duration).toBeGreaterThan(20);
    // The victory pose: a point's celebration, played once and held.
    const win = Fighter.transplant!(body, {...st, action: 'victory', actionStarted: 2, actionDuration: 0});
    expect(win?.phase).toMatch(/^-ball-C\./);
    expect(win!.clip.duration).toBeGreaterThan(20);
    // An air heavy: the straight arm with nobody's stick known, the cut with the page's own stick across.
    const air: PlayerState = {...st, action: 'heavy', actionStarted: 3, actionSeq: 9, actionDuration: .6, actionTime: 0, grounded: false, y: 2};
    m.view.ball.y = 3.4; m.view.ball.z = 1;
    expect(Fighter.transplant!(body, air)?.phase).toBe('-ball-SS.spike');
    noteBallStick('k', 1, 0);
    expect(Fighter.transplant!(body, {...air, actionSeq: 10})?.phase).toBe('-ball-SS.spikeCut');
    body.dispose();
    resetBallMoves(); Fighter.transplant = undefined;
  }, 60000);

  it('Goal Rush: the TRAP, the keeper\'s dive, the carry, the TACKLE', async () => {
    await loadBallMovesFrom(async () => readPack(await loadRig(FILE)));
    const m = new BallMatch('goal-rush', {seed: 3, access: 'bots', practice: true});
    m.add('k', 'kosho', 'K', false, 'red');
    installBallMoves(() => ({view: m.view, ball: null}), true);
    const body = library.create({...base('kosho'), id: 'k'}), st: PlayerState = {...base('kosho'), id: 'k'}, b = m.view.ball;
    // A guard as a free ball rolls in: the TRAP, played once and held.
    Object.assign(b, {x: 0, y: .8, z: 2.5, vx: 0, vy: 0, vz: -6, held: false, lastTeam: null});
    delete b.carry;
    const trap = Fighter.transplant!(body, {...st, action: 'guard', actionStarted: 1, actionSeq: 1});
    expect(trap?.phase).toBe('-ball-GR.trap');
    expect(trap!.clip.duration).toBeGreaterThan(20);
    // By its own goal, a shot from the other side crossing two metres to its left: the dive that way.
    const goal = goalZ('red'), into = -Math.sign(goal), keeper: PlayerState = {...st, z: goal + into * 2, yaw: into > 0 ? 0 : Math.PI};
    Object.assign(b, {x: into > 0 ? 2.2 : -2.2, y: 1, z: keeper.z + into * 6, vx: 0, vz: -into * 16, lastTeam: 'blue'});
    expect(Fighter.transplant!(body, {...keeper, action: 'guard', actionStarted: 2, actionSeq: 2})?.phase).toBe('-ball-GR.diveL');
    // The carrier's run is the carry, laid on the body's own run; a run without the ball is the body's own.
    Object.assign(b, {x: 0, y: .8, z: 1, vx: 0, vz: 0, lastTeam: 'red'});
    expect(Fighter.transplant!(body, {...st, action: 'run', actionStarted: 3})).toBeUndefined();
    b.carry = 'k';
    const carry = Fighter.transplant!(body, {...st, action: 'run', actionStarted: 3});
    expect(carry?.phase).toBe('-ball-GR.carry');
    expect(carry!.clip.duration).toBeCloseTo(body.take({...st, action: 'run'}).clip!.duration, 3);
    // The FIGHT stance's one blow at the carrier, close: the shoulder charge.
    delete b.carry;
    m.view.seats.find(s => s.id === 'k')!.lock = 'foe'; b.carry = 'foe';
    body.targetPoint = new THREE.Vector3(0, 1.45, 1.2); body.targetDistance = 1.2;
    expect(Fighter.transplant!(body, {...st, action: 'light', actionStarted: 4, actionSeq: 4, actionDuration: .4, actionTime: 0})?.phase).toBe('-ball-GR.shoulder');
    body.dispose();
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
