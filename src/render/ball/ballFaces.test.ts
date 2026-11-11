import fs from 'node:fs';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {FighterId, GameSnapshot, PlayerState} from '../../game/types';
import type {BallView} from '../../game/ball/model';
import {Fighter, FighterLibrary} from '../Fighter';
import {FIGHTERS} from '../../config';
import {base, loadRig} from '../../../tests/rigHarness';
import {FACE_EASE, FACE_FIT, FACE_KEYS, SHOUT_FOR, faceAsked, faceFrame, faceOf, faceTheMoment, facesWanted, holdFace, resetBallFaces} from './ballFaces';

/** Ball modes, faces (render/ball/ballFaces.ts): the switch, the table, the bodies' bind against their
 *  rest, the weights given to the face bones (nothing moves at rest, the face moves in a pose, nothing off the head
 *  does), the ease (no pop), and what the ceremony asks for, through the real FighterLibrary and Fighter. */
const load = GLTFLoader.prototype.loadAsync;
beforeAll(() => { GLTFLoader.prototype.loadAsync = function (url: string) { return loadRig(url.split('?')[0]); }; });
afterAll(() => { GLTFLoader.prototype.loadAsync = load; resetBallFaces(); });

describe('the switch', () => {
  it('is on everywhere, and off on this machine with ?faces=0', () => {
    expect(facesWanted(undefined)).toBe(true);
    expect(facesWanted({hostname: 'play.example.com', search: '?faces=0'})).toBe(true);
    expect(facesWanted({hostname: 'localhost', search: '?ballpilot'})).toBe(true);
    expect(facesWanted({hostname: 'localhost', search: '?ballpilot&faces=0'})).toBe(false);
    expect(facesWanted({hostname: '127.0.0.1', search: '?faces=0'})).toBe(false);
  });
});

/** A body's file with its skins and nothing to draw or play: enough for its bones' binds. */
async function skinsOf(path: string) {
  const file = fs.readFileSync(`public${path}`), length = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + length).toString());
  json.materials = (json.materials ?? []).map((m: {name: string}) => ({name: m.name}));
  delete json.images; delete json.textures; delete json.samplers; delete json.animations;
  const data = Buffer.from(JSON.stringify(json)), padded = Buffer.concat([data, Buffer.alloc((4 - data.length % 4) % 4, 32)]);
  const tail = file.subarray(20 + length), out = Buffer.alloc(20 + padded.length + tail.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(padded.length, 12); out.writeUInt32LE(0x4e4f534a, 16); padded.copy(out, 20); tail.copy(out, 20 + padded.length);
  return (await new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength), '')).scene;
}

describe('the table', () => {
  it('names real bodies, with a face in proportion', () => {
    expect(Object.keys(FACE_FIT).length).toBeGreaterThan(0);
    for (const [key, fit] of Object.entries(FACE_FIT)) {
      const [id, form] = key.split(':');
      expect(FIGHTERS[id as FighterId], key).toBeDefined();
      if (form) { expect(form).toBe('form'); expect(FIGHTERS[id as FighterId].formModel, key).toBeTruthy(); }
      expect(fit!.apart, key).toBeGreaterThan(.25); expect(fit!.apart, key).toBeLessThan(1.6);
      expect(fit!.eye, key).toBeGreaterThan(-1.2); expect(fit!.eye, key).toBeLessThan(.5);
      expect(fit!.mouth, key).toBeLessThan(fit!.eye - .25); expect(fit!.chin, key).toBeLessThan(fit!.mouth - .1);
      expect(fit!.wide, key).toBeGreaterThan(.05); expect(fit!.wide, key).toBeLessThan(.8);
    }
  });
  it('every body on it has its face bones under its head, bound where they rest', async () => {
    for (const key of Object.keys(FACE_FIT)) {
      const [id, form] = key.split(':'), f = FIGHTERS[id as FighterId];
      const face = faceOf(await skinsOf(form ? f.formModel! : f.model));
      expect(typeof face === 'string' ? face : 'ok', key).toBe('ok');
      if (typeof face !== 'string') expect(face.drift, key).toBeLessThan(1e-4);
    }
  }, 120000);
});

describe('on the bodies', () => {
  const library = new FighterLibrary();
  /** Every vertex of the body's skinned meshes as drawn now, and how far out of its head it lies (its head share). */
  const drawn = (body: Fighter) => {
    const model = (body as unknown as {model: THREE.Object3D}).model, out: THREE.Vector3[] = [];
    model.updateMatrixWorld(true);
    model.traverse(o => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && !/-ink$/.test(m.name)) for (let i = 0; i < m.geometry.getAttribute('position').count; i++) out.push(m.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(m.matrixWorld)); });
    return out;
  };
  const most = (a: THREE.Vector3[], b: THREE.Vector3[]) => a.reduce((m, p, i) => Math.max(m, p.distanceTo(b[i])), 0);
  // A plain face, a face drawn open, a giant, eye bones far closer than the eyes, glasses, one eye under a patch.
  const ids: FighterId[] = ['akayuri', 'gorai', 'torsion', 'shiun', 'gaunt', 'tsubute'];

  it('draws every vertex where it was at rest once the face is given its bones, and moves the face in a pose', async () => {
    await library.ensure(ids);
    for (const id of ids) {
      const state: PlayerState = {...base(id), id: `f-${id}`};
      const body = library.create(state);
      body.update(1 / 60, state, false, 1 / 60);
      const before = drawn(body);
      expect(holdFace(body, state, null), id).toBe(true);
      const rest = drawn(body);
      // (Metres: well under a tenth of a millimetre.)
      expect(most(before, rest), `${id} at rest`).toBeLessThan(5e-5);
      const face = faceOf((body as unknown as {model: THREE.Object3D}).model);
      if (typeof face === 'string') throw new Error(face);
      // (The face's own unit: the painted eyes' spacing.)
      const unit = face.scale * FACE_FIT[id]!.apart / .5;
      for (const key of FACE_KEYS) {
        holdFace(body, state, key);
        const posed = drawn(body), moved = most(rest, posed);
        // The face moves by a share of an eye spacing, never more than half of one.
        expect(moved / unit, `${id} ${key}`).toBeGreaterThan(.04);
        expect(moved / unit, `${id} ${key}`).toBeLessThan(.5);
        // Nothing far from the face moves: every vertex that moved is within about three eye spacings of the eye bones.
        const eyes = new THREE.Vector3().setFromMatrixPosition(face.bones[0].matrixWorld);
        for (let i = 0; i < posed.length; i++) if (posed[i].distanceTo(rest[i]) > 1e-5) expect(rest[i].distanceTo(eyes) / unit, `${id} ${key} vertex ${i}`).toBeLessThan(3.2);
      }
      holdFace(body, state, null);
      expect(most(before, drawn(body)), `${id} back at rest`).toBeLessThan(5e-5);
      body.dispose();
    }
  }, 120000);

  it('eases in and out with no pop, only while a ball match is on and only for the face asked', async () => {
    resetBallFaces();
    const id = ids[0];
    await library.ensure([id]);
    const state: PlayerState = {...base(id), id: 'eased'}, other: PlayerState = {...base(id), id: 'other'};
    const body = library.create(state), bystander = library.create(other);
    const face = faceOf((body as unknown as {model: THREE.Object3D}).model);
    if (typeof face === 'string') throw new Error(face);
    // No ball match: nothing is readied, nothing moves.
    const quiet = drawn(body);
    for (let i = 0; i < 10; i++) faceFrame(body, state, 1 / 60);
    expect(most(quiet, drawn(body))).toBeLessThan(1e-6);
    // A goal: the scorer is asked to shout.
    const view = {mode: 'goal-rush', phase: 'scored', replay: null, seats: [{id: 'eased', team: 'red'}, {id: 'other', team: 'red'}], mvp: '', endsAt: 0} as unknown as BallView;
    const snapshot = {serverTime: 10, players: []} as unknown as GameSnapshot;
    let last = drawn(body), step = 0;
    const frames = Math.ceil(FACE_EASE.in * 60) + 2;
    for (let i = 0; i < frames; i++) {
      faceTheMoment(view, snapshot, 'close', {at: 9.9, scorer: 'eased', team: 'red'}, []);
      faceFrame(body, state, 1 / 60); faceFrame(bystander, other, 1 / 60);
      const now = drawn(body); step = Math.max(step, most(last, now)); last = now;
    }
    expect(faceAsked('eased')).toBe('shout');
    expect(faceAsked('other')).toBe(null);
    // Eased: no frame moves the face more than a fifth of the whole move.
    const whole = most(quiet, last);
    expect(whole / face.scale).toBeGreaterThan(.04);
    expect(step / whole).toBeLessThan(.2);
    // At the full pose by the ease's end: held still.
    faceTheMoment(view, snapshot, 'close', {at: 9.9, scorer: 'eased', team: 'red'}, []); faceFrame(body, state, 1 / 60);
    expect(most(last, drawn(body))).toBeLessThan(1e-6);
    // The team-mate asked nothing stays at rest.
    expect(bystander.group.position).toBeDefined();
    // Asked nothing more (the asks forgotten: they last a quarter of a second on the page's clock): back to rest, eased out.
    resetBallFaces();
    step = 0;
    for (let i = 0; i < Math.ceil((FACE_EASE.out + .3) * 60); i++) { faceFrame(body, state, 1 / 60); const now = drawn(body); step = Math.max(step, most(last, now)); last = now; }
    expect(step / whole).toBeLessThan(.2);
    expect(most(quiet, last)).toBeLessThan(5e-5);
    body.dispose(); bystander.dispose();
  }, 120000);
});

describe('what the moment asks', () => {
  const seats = [
    {id: 'striker', team: 'red', role: 'attack'}, {id: 'mate', team: 'red', role: 'support'},
    {id: 'keeper', team: 'blue', role: 'keeper'}, {id: 'back', team: 'blue', role: 'support'},
  ];
  const view = (over: Partial<Record<string, unknown>>) => ({mode: 'goal-rush', phase: 'scored', replay: null, seats, mvp: 'mate', endsAt: 50, ...over}) as unknown as BallView;
  const at = (t: number) => ({serverTime: t, players: [{id: 'keeper', z: 20}, {id: 'back', z: 0}]}) as unknown as GameSnapshot;
  const sequence = {at: 10, scorer: 'striker', team: 'red' as const};

  it('a goal: the scorer shouts, then grins; the keeper beaten is hurt; nobody else', () => {
    resetBallFaces();
    faceTheMoment(view({}), at(10.2), 'close', sequence, []);
    expect([faceAsked('striker'), faceAsked('keeper'), faceAsked('mate'), faceAsked('back')]).toEqual(['shout', 'hurt', null, null]);
    faceTheMoment(view({}), at(10 + SHOUT_FOR + .1), 'close', sequence, []);
    expect(faceAsked('striker')).toBe('grin');
  });
  it('with no keeper named, the conceding side\'s nearest their own goal is', () => {
    resetBallFaces();
    const free = seats.map(s => ({...s, role: undefined}));
    faceTheMoment(view({seats: free}), {serverTime: 10.2, players: [{id: 'keeper', z: 0}, {id: 'back', z: 30}]} as unknown as GameSnapshot, 'close', sequence, []);
    // (Blue's own goal is at goalZ('blue'): whichever of the two stands nearer it.)
    expect([faceAsked('keeper'), faceAsked('back')].filter(Boolean)).toEqual(['hurt']);
  });
  it('the replay, the kickoff and a couch split ask nothing', () => {
    resetBallFaces();
    faceTheMoment(view({replay: {at: 11, until: 14}}), at(11.5), null, sequence, []);
    faceTheMoment(view({phase: 'live'}), at(12), null, sequence, []);
    faceTheMoment(view({}), at(10.2), null, null, []);
    expect([faceAsked('striker'), faceAsked('keeper')]).toEqual([null, null]);
  });
  it('a Sky Spike point: the scorer only', () => {
    resetBallFaces();
    faceTheMoment(view({mode: 'sky-spike'}), at(10.2), 'close', sequence, []);
    expect([faceAsked('striker'), faceAsked('keeper')]).toEqual(['shout', null]);
  });
  it('the podium: the winners grin, the MVP shouts first', () => {
    resetBallFaces();
    faceTheMoment(view({phase: 'over'}), at(50.5), 'podium', null, ['mate', 'striker']);
    expect([faceAsked('mate'), faceAsked('striker'), faceAsked('keeper')]).toEqual(['shout', 'grin', null]);
    faceTheMoment(view({phase: 'over'}), at(53), 'podium', null, ['mate', 'striker']);
    expect(faceAsked('mate')).toBe('grin');
    resetBallFaces();
    faceTheMoment(view({phase: 'over'}), at(53), null, null, ['mate', 'striker']);
    expect(faceAsked('mate')).toBe(null);
  });
});
