import * as THREE from 'three';
import { ArenaSimulation } from '../src/game/simulation';
import { CombatTimeline } from '../src/render/CombatTimeline';
import { Fighter } from '../src/render/Fighter';
import { LANDED } from '../src/game/landedBlows';
import { MOVES } from '../src/game/moves';
import { rushMove } from '../src/game/awakening';
import { FIGHTERS } from '../src/config';
import { bigBlowOf, cinematicBlowOf } from '../src/render/bigBlowEvent';
import { rng, type Press } from './reactHarness';
import { assembleFighter, popBase } from './popHarness';
import { loadRig } from './rigHarness';
import { bindClips } from '../src/render/Fighter';
import { bindFormExtras } from '../src/render/gummy/sunrise';
import type { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CombatEvent, FighterId, PlayerInput, PlayerState } from '../src/game/types';

export const ROSTER = Object.keys(FIGHTERS) as FighterId[];
export const FORM_FIGHTERS = ROSTER.filter(id => !!FIGHTERS[id].formModel);
const TICK = 1 / 60;
const styleOf = (e: CombatEvent) => e.fighter && e.slot ? (e.slot === 'light' && (e.chain ?? 0) > 0 ? rushMove(e.fighter, e.chain!, false) : MOVES[e.fighter][e.slot]).style : undefined;
const sources = new Map<FighterId, Awaited<ReturnType<typeof assembleFighter>>>();
/** A body as FighterLibrary builds it: one parsed source per fighter, a fresh Fighter (a clone) each time. */
export async function body(id: FighterId, name: string) {
  let source = sources.get(id);
  if (!source) { source = await assembleFighter(id); sources.set(id, source); }
  const fighter = new Fighter(popBase(id, name), source.source, false, source.rush);
  fighter.prepareRush();
  return fighter;
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
type Probe = (victim: Fighter, shown: PlayerState, clock: number) => void;

/** tests/reactHarness.ts victimRun, with a probe on every drawn frame and the striker's meters filled. */
export function drive(victim: Fighter, striker: Fighter, presses: Press[], ticks: number, probe: Probe, seed = 7) {
  const latency = .05, random = rng(seed);
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 11 });
  sim.addPlayer('a', striker.state.fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', victim.state.fighter, 'B', false, { x: 0, y: 0, z: 1.6 });
  sim.startMatch();
  sim.trainingCommand('a', 'awakening');
  LANDED.reset();
  const timeline = new CombatTimeline({ delayMs: 60 });
  const inbox: { at: number; snapshot: ReturnType<ArenaSimulation['snapshot']> }[] = [];
  let tick = 0, seq = 0, clock = 0;
  const step = () => {
    const press = presses.find(p => p.tick === tick);
    const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
    const input: PlayerInput = { seq: ++seq, moveX: press?.move?.[0] ?? 0, moveZ: press?.move?.[1] ?? 0, yaw: Math.atan2(b.x - a.x, b.z - a.z), targetId: 'b', lock: true };
    if (press?.attack) input.attack = press.attack;
    sim.submitInput('a', input);
    sim.submitInput('b', { seq, moveX: 0, moveZ: 0, yaw: Math.atan2(a.x - b.x, a.z - b.z) });
    sim.step(); tick++;
    if (tick % 2 === 0) inbox.push({ at: tick * TICK + latency, snapshot: sim.snapshot(true) });
  };
  try {
    while (tick < ticks) {
      const frame = Math.max(.008, Math.min(.034, 1 / 60 + gauss(random) * 1.8 / 1000));
      clock += frame;
      while ((tick + 1) * TICK <= clock + 1e-9) step();
      while (inbox.length && inbox[0].at <= clock + 1e-9) { const { at, snapshot } = inbox.shift()!; LANDED.authoritative(snapshot, 'b'); timeline.push(snapshot, at * 1000); }
      const presented = timeline.sample(clock * 1000);
      if (!presented) continue;
      const shownA = presented.snapshot.players.find(p => p.id === 'a')!, shownB = presented.snapshot.players.find(p => p.id === 'b')!;
      for (const e of presented.events) {
        if ((e.kind !== 'hit' && e.kind !== 'blocked') || !e.endpoint || !e.damage) continue;
        const heading = e.origin ? new THREE.Vector3(e.endpoint.x - e.origin.x, e.endpoint.y - e.origin.y, e.endpoint.z - e.origin.z) : undefined;
        // As main.ts hands it over (impactDetail): the big blows snap and hold.
        const awakened = !!presented.snapshot.players.find(p => p.id === e.actorId)?.awakened, big = bigBlowOf(e, awakened) || cinematicBlowOf(e, awakened);
        const landed = e.kind === 'hit', detail = { chain: e.chain, fromBehind: e.fromBehind, reaction: e.reaction, ...(big ? { big } : {}), ...(e.downed ? { downed: true } : {}), ...(e.lift ? { lift: e.lift } : {}) };
        const struck = e.targetId === 'b' ? victim : e.targetId === 'a' ? striker : undefined, by = e.actorId === 'a' ? striker : victim;
        struck?.impact(true, e.slot, styleOf(e), e.contactIndex, heading, landed ? e.damage : e.damage * 2.2, e.endpoint.y - (e.targetId === 'b' ? shownB.y : shownA.y), detail);
        if (landed && (e.slot === 'light' || e.slot === 'heavy')) by.impact(false, e.slot, undefined, undefined, heading, e.damage, undefined, detail);
        if (!landed) by.impact(false, e.slot, undefined, undefined, heading, e.damage, undefined, detail);
      }
      LANDED.deliver(presented.events); LANDED.clock = presented.time;
      striker.targetDistance = victim.targetDistance = Math.hypot(shownB.x - shownA.x, shownB.z - shownA.z);
      striker.targetPoint = (striker.targetPoint ?? new THREE.Vector3()).set(shownB.x, shownB.y + 1.45, shownB.z);
      victim.targetPoint = (victim.targetPoint ?? new THREE.Vector3()).set(shownA.x, shownA.y + 1.45, shownA.z);
      striker.update(Math.min(frame, .05), shownA, true, frame);
      victim.update(Math.min(frame, .05), shownB, true, frame);
      (Fighter as unknown as { settleContacts(): void }).settleContacts();
      if (tick >= 30) probe(victim, shownB, clock);
    }
  } finally { sim.dispose(); }
}

const LIMBS = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'LeftLeg', 'RightLeg', 'LeftHand', 'RightHand', 'Head', 'Hips'];
type Internal = { lowestSupport(): number; launchArc: number; launchTurns: number; groundY: number };
/** The launches: Konta's heavy (the Senpugan, from the front), Taisei's (the Cloudstep Strike, from behind),
 *  Ouga's (a projectile), Taisei's string's finisher and his ultimate (the LAST SUN). */
export const LAUNCHES: Record<string, { by: FighterId; presses: Press[]; ticks: number }> = {
  heavy: { by: 'konta', presses: [{ tick: 30, attack: 'heavy' }], ticks: 30 + 150 },
  behind: { by: 'taisei', presses: [{ tick: 30, attack: 'heavy' }], ticks: 30 + 150 },
  blast: { by: 'ouga', presses: [{ tick: 30, attack: 'heavy' }], ticks: 30 + 150 },
  string: { by: 'taisei', presses: [30, 46, 62, 78].map(tick => ({ tick, attack: 'light' as const })), ticks: 30 + 200 },
  ultimate: { by: 'taisei', presses: [{ tick: 30, attack: 'ultimate' }], ticks: 30 + 330 },
};
export type LaunchRow = { fighter: FighterId; launch: string; flown: number; sole: number; bone: number; boneName: string; under: number; deep: number; clips: string };
/** One launch: the deepest the boot hull and the limbs go under the floor while the body is launched and over its
 *  first half second down, and how many frames a sole is more than 5 cm under it. */
export function measureLaunch(victim: Fighter, striker: Fighter, launch: string): LaunchRow {
  const { presses, ticks } = LAUNCHES[launch];
  const row: LaunchRow = { fighter: victim.state.fighter, launch, flown: 0, sole: 0, bone: 0, boneName: '', under: 0, deep: 0, clips: '' };
  const clips = new Set<string>(), v = new THREE.Vector3();
  let down = -1;
  drive(victim, striker, presses, ticks, (body, shown, clock) => {
    const flying = shown.action === 'launched' || shown.action === 'knockdown' && !shown.grounded;
    if (flying) { row.flown++; down = -1; }
    else if ((shown.action === 'knockdown' || shown.action === 'getup') && row.flown) { if (down < 0) down = clock; }
    if (!flying && !(down >= 0 && clock - down < .5)) return;
    const e = body.motionEvidence();
    if (e.clip) clips.add(`${shown.action}:${e.clip}`);
    body.group.updateMatrixWorld(true);
    const inner = body as unknown as Internal, floor = 0;
    const sole = inner.lowestSupport() - floor;
    let bone = Infinity, boneName = '';
    for (const name of LIMBS) { const j = body.joints.get(name); if (!j) continue; const y = j.getWorldPosition(v).y - floor; if (y < bone) { bone = y; boneName = name; } }
    if (Number.isFinite(sole) && sole < row.sole) row.sole = sole;
    if (bone < row.bone) { row.bone = bone; row.boneName = boneName; }
    if (Number.isFinite(sole) && sole < -.05) row.under++;
    if (Number.isFinite(sole) && sole < -.2) row.deep++;
  });
  row.clips = [...clips].join(' ');
  return row;
}

/** The daze: Ouga's Light x3 + Special (the Rage Volley), which the simulation ends with the get-up. */
export const DAZE: { by: FighterId; presses: Press[]; ticks: number } = { by: 'ouga', presses: [...[30, 46, 62].map(tick => ({ tick, attack: 'light' as const })), { tick: 78, attack: 'special' }], ticks: 330 };
export type StunRow = { fighter: FighterId; dazed: boolean; rose: number; clips: string; stand: number; hipsLow: number; headLow: number; drop: number; sole: number };
/** A daze and the get-up that ends it: the clips the get-up plays, the hips' and the head's lowest over it against
 *  where they stood through the daze, and the lowest sole. */
export function measureStun(victim: Fighter, striker: Fighter): StunRow {
  const row: StunRow = { fighter: victim.state.fighter, dazed: false, rose: 0, clips: '', stand: NaN, hipsLow: Infinity, headLow: Infinity, drop: 0, sole: 0 };
  const clips = new Set<string>(), v = new THREE.Vector3();
  let standing: number[] = [];
  drive(victim, striker, DAZE.presses, DAZE.ticks, (body, shown) => {
    if (shown.action === 'stun') {
      row.dazed = true; body.group.updateMatrixWorld(true);
      const hips = body.joints.get('Hips'); if (hips) standing.push(hips.getWorldPosition(v).y - shown.y);
    }
    if (shown.action !== 'getup' || !row.dazed) return;
    row.rose++;
    const e = body.motionEvidence(); if (e.clip) clips.add(e.clip);
    body.group.updateMatrixWorld(true);
    const hips = body.joints.get('Hips'), head = body.joints.get('Head');
    if (hips) row.hipsLow = Math.min(row.hipsLow, hips.getWorldPosition(v).y - shown.y);
    if (head) row.headLow = Math.min(row.headLow, head.getWorldPosition(v).y - shown.y);
    const sole = (body as unknown as Internal).lowestSupport() - shown.y;
    if (Number.isFinite(sole)) row.sole = Math.min(row.sole, sole);
  });
  standing = standing.sort((a, b) => a - b);
  row.stand = standing.length ? standing[Math.floor(standing.length / 2)] : NaN;
  row.drop = Number.isFinite(row.stand) && Number.isFinite(row.hipsLow) ? row.stand - row.hipsLow : NaN;
  row.clips = [...clips].join(' ');
  return row;
}


const forms = new Map<FighterId, GLTF>();
/** A fighter with its awakened body (`formModel`) attached, both as FighterLibrary assembles them: the form's own takes
 *  (`formExtraModels`) and the open hands bound to it (gummy/sunrise.ts bindFormExtras). */
export async function formFighter(id: FighterId, name: string) {
  const fighter = await body(id, name);
  let form = forms.get(id);
  if (!form) {
    form = await loadRig(FIGHTERS[id].formModel!);
    await bindFormExtras({ loadAsync: (url: string) => loadRig(url) } as unknown as GLTFLoader, FIGHTERS[id], sources.get(id)!.source, form, bindClips);
    forms.set(id, form);
  }
  fighter.attachForm(form);
  return fighter;
}
type FormView = { gear4?: { group: THREE.Group; joints: Map<string, THREE.Bone>; active?: THREE.AnimationAction; locomotionSpeed: number } };
export type FormRunRow = { fighter: FighterId; shown: number; clip: string; pace: number; speed: number; hands: number; reach: number; parentHands: number };
/** The awakened fighter running flat out (`speed` m/s along +z) for `seconds`: its form body's run clip and how fast it
 *  plays (clip seconds a second), the speed the form reads, and how far the form's hands travel in its own space - a
 *  frame's step on average (cm) and the most they span over the run (cm) - with the fighter's own hands for scale. */
export function measureFormRun(fighter: Fighter, seconds = 2, speed = 7.5): FormRunRow {
  const id = fighter.state.fighter, dt = 1 / 60, v = new THREE.Vector3();
  const row: FormRunRow = { fighter: id, shown: 0, clip: '', pace: 0, speed: 0, hands: 0, reach: 0, parentHands: 0 };
  const awake: PlayerState = { ...popBase(id, fighter.state.id), awakened: true };
  for (let f = 0; f < 90; f++) fighter.update(dt, awake, true, dt);
  const form = (fighter as unknown as FormView).gear4;
  if (!form) return row;
  const clips = new Map<string, number>();
  const hands: THREE.Vector3[][] = [[], []], own: THREE.Vector3[] = [];
  let paced = 0, frames = 0, last: { clip: string; time: number } | undefined, z = 0;
  for (let f = 0; f * dt < seconds; f++) {
    z += speed * dt;
    fighter.update(dt, { ...awake, action: 'run', z }, true, dt);
    if (f < 30 || !form.group.visible) continue;
    row.shown++;
    const clip = form.active?.getClip().name ?? '', time = form.active?.time ?? 0;
    clips.set(clip, (clips.get(clip) ?? 0) + 1);
    if (last && last.clip === clip) { const d = time - last.time, len = form.active!.getClip().duration; paced += ((d % len) + len) % len; frames++; }
    last = { clip, time };
    row.speed += form.locomotionSpeed;
    fighter.group.updateMatrixWorld(true);
    ['RightHand', 'LeftHand'].forEach((name, k) => { const hand = form.joints.get(name); if (hand) hands[k].push(form.group.worldToLocal(hand.getWorldPosition(v.clone()))); });
    const mine = fighter.joints.get('RightHand'); if (mine) own.push(fighter.group.worldToLocal(mine.getWorldPosition(v.clone())));
  }
  const step = (path: THREE.Vector3[]) => path.length > 1 ? path.slice(1).reduce((sum, p, i) => sum + p.distanceTo(path[i]), 0) / (path.length - 1) : 0;
  const span = (path: THREE.Vector3[]) => { let most = 0; for (const a of path) for (const b of path) most = Math.max(most, a.distanceTo(b)); return most; };
  row.clip = [...clips.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  row.pace = frames ? paced / (frames * dt) : 0;
  row.speed /= Math.max(1, row.shown);
  // In the form's own space: its group is scaled (formScale), so its hands are measured in its own units, times that.
  const scale = form.group.scale.x;
  row.hands = Math.max(step(hands[0]), step(hands[1])) * scale * 100;
  row.reach = Math.max(span(hands[0]), span(hands[1])) * scale * 100;
  row.parentHands = step(own) * 100;
  return row;
}

export type FormJumpRow = { fighter: FighterId; air: number; fell: number; clips: string };
/** The awakened fighter hopping (the simulation's own jump, from its own transformation): how many frames its form is
 *  in the air, on which of them it is first in its fall, and the clips it plays. */
export function measureFormJump(fighter: Fighter): FormJumpRow {
  const id = fighter.state.fighter, row: FormJumpRow = { fighter: id, air: 0, fell: -1, clips: '' };
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 11 });
  sim.addPlayer('a', id, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: 6 });
  sim.startMatch(); sim.trainingCommand('a', 'awakening');
  const form = (fighter as unknown as { gear4?: { group: THREE.Group; active?: THREE.AnimationAction; falling: boolean } }).gear4;
  const clips = new Set<string>();
  try {
    for (let tick = 0, seq = 0; tick < 260; tick++) {
      const input: PlayerInput = { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0 };
      if (tick === 30) input.awaken = true;
      if (tick === 180) input.jump = true;
      sim.submitInput('a', input); sim.submitInput('b', { seq, moveX: 0, moveZ: 0, yaw: Math.PI });
      sim.step();
      const a = sim.getPlayer('a')!;
      fighter.update(TICK, { ...a }, true, TICK);
      if (tick < 180 || a.grounded || !form?.group.visible) continue;
      if (form.falling && row.fell < 0) row.fell = row.air;
      row.air++;
      clips.add(form.active?.getClip().name ?? '');
    }
  } finally { sim.dispose(); }
  row.clips = [...clips].join(' ');
  return row;
}

/** tests/reactHarness.ts localRun - the fighter's own moves beside a standing opponent `gap` metres ahead, drawn from
 *  the newest tick of its own simulation - with a probe on every drawn frame. */
export function driveLocal(fighter: Fighter, other: Fighter, presses: Press[], ticks: number, probe: (body: Fighter, shown: PlayerState) => void, gap = 1.8, seed = 7) {
  const random = rng(seed);
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 11 });
  sim.addPlayer('a', fighter.state.fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', other.state.fighter, 'B', false, { x: 0, y: 0, z: gap });
  sim.startMatch();
  LANDED.reset();
  let tick = 0, seq = 0, clock = 0, previous = { ...sim.getPlayer('a')! };
  const step = () => {
    const press = presses.find(p => p.tick === tick);
    previous = { ...sim.getPlayer('a')! };
    const input: PlayerInput = { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', lock: true };
    if (press?.attack) input.attack = press.attack;
    sim.submitInput('a', input);
    sim.submitInput('b', { seq, moveX: 0, moveZ: 0, yaw: Math.PI });
    sim.step(); tick++;
  };
  try {
    while (tick < ticks) {
      const frame = Math.max(.008, Math.min(.034, 1 / 60 + gauss(random) * 1.8 / 1000));
      clock += frame;
      while ((tick + 1) * TICK <= clock + 1e-9) step();
      const alpha = THREE.MathUtils.clamp((clock - tick * TICK) / TICK, 0, 1);
      const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
      const shown: PlayerState = { ...a, x: previous.x + (a.x - previous.x) * alpha, y: previous.y + (a.y - previous.y) * alpha, z: previous.z + (a.z - previous.z) * alpha };
      fighter.targetDistance = other.targetDistance = Math.hypot(b.x - shown.x, b.z - shown.z);
      fighter.targetPoint = (fighter.targetPoint ?? new THREE.Vector3()).set(b.x, b.y + 1.45, b.z);
      other.targetPoint = (other.targetPoint ?? new THREE.Vector3()).set(shown.x, shown.y + 1.45, shown.z);
      Fighter.beginFrame(clock * 1000);
      fighter.update(Math.min(frame, .05), shown, true, frame);
      other.update(Math.min(frame, .05), { ...b }, true, frame);
      (Fighter as unknown as { settleContacts(): void }).settleContacts();
      if (tick >= 30) probe(fighter, shown);
    }
  } finally { sim.dispose(); }
}
const STRING: Press[] = [0, 9, 18, 27].map(t => ({ tick: 30 + t, attack: 'light' as const }));
/** The fighter's own melee: the light string, the heavy, and the enders thrown off the string (L-H, L-L-H, L-L-L-H). */
export const SWINGS: Record<string, { presses: Press[]; ticks: number }> = {
  string: { presses: STRING, ticks: 30 + 150 },
  heavy: { presses: [{ tick: 30, attack: 'heavy' }], ticks: 30 + 90 },
  lh: { presses: [{ tick: 30, attack: 'light' }, { tick: 46, attack: 'heavy' }], ticks: 30 + 130 },
  llh: { presses: [{ tick: 30, attack: 'light' }, { tick: 46, attack: 'light' }, { tick: 62, attack: 'heavy' }], ticks: 30 + 150 },
  lllh: { presses: [{ tick: 30, attack: 'light' }, { tick: 46, attack: 'light' }, { tick: 62, attack: 'light' }, { tick: 78, attack: 'heavy' }], ticks: 30 + 170 },
};
const LIMB_ROOTS = ['RightArm', 'LeftArm', 'RightUpLeg', 'LeftUpLeg'];
type SmearMesh = { mesh: THREE.SkinnedMesh; part: Int8Array; gate?: THREE.BufferAttribute };
export type SmearRow = { fighter: FighterId; frames: number; head: number; headCm: number; torso: number; torsoCm: number; limbCm: number; heads: number };
/** The smear frame on the fighter's own melee (AnimStyle 'twos'), against the body it is drawn on: on each frame it is
 *  on, how far each vertex is drawn back (the shader's own reach and limb weighting - the stretch's upper bound, its
 *  trailing-surface share taken as whole), and whose vertex it is: the head's (`lookHead`), the torso's (none of the
 *  four limbs'), or the striking limb's. Reported: the frames smeared, the most of the head's vertices and of the
 *  torso's moved over a centimetre on any one frame (shares), the furthest any of them moved (cm), and the furthest the
 *  striking limb's moved (cm), which is the smear itself. */
export function measureSmear(fighter: Fighter, other: Fighter, swing: string): SmearRow {
  const row: SmearRow = { fighter: fighter.state.fighter, frames: 0, head: 0, headCm: 0, torso: 0, torsoCm: 0, limbCm: 0, heads: 0 };
  const roots = LIMB_ROOTS.map(n => fighter.joints.get(n));
  const meshes: SmearMesh[] = [];
  fighter.model.traverse(o => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || /-ink$/.test(mesh.name)) return;
    const limbOf = (node: THREE.Object3D | null) => { for (let n = node; n; n = n.parent) { const k = roots.indexOf(n as THREE.Bone); if (k >= 0) return k; } return -1; };
    const limbs = mesh.skeleton.bones.map(limbOf), ids = mesh.geometry.attributes.skinIndex, w = mesh.geometry.attributes.skinWeight;
    const head = mesh.geometry.getAttribute('lookHead'), part = new Int8Array(ids.count);
    const named = `${mesh.name} ${mesh.geometry.name ?? ''}`, side = named.replace(/hand/gi, '');
    const held = !/weapon.*hand|equipment-held/i.test(named) ? -1 : /(^|[^a-z])(r|right)([^a-z]|$)/i.test(side) ? 0 : /(^|[^a-z])(l|left)([^a-z]|$)/i.test(side) ? 1 : -1;
    for (let i = 0; i < ids.count; i++) {
      if (held >= 0) { part[i] = held; continue; }
      // -2 the head, -1 the torso, 0-3 the limb carrying the most of it.
      if (head && head.getX(i) >= .5) { part[i] = -2; continue; }
      const share = [0, 0, 0, 0]; for (let j = 0; j < 4; j++) { const k = limbs[ids.getComponent(i, j)]; if (k >= 0) share[k] += w.getComponent(i, j); }
      const most = Math.max(...share); part[i] = most >= .5 ? share.indexOf(most) : -1;
    }
    meshes.push({ mesh, part, gate: mesh.geometry.getAttribute('smearLimb') as THREE.BufferAttribute | undefined });
  });
  row.heads = meshes.reduce((n, m) => n + m.part.filter(p => p === -2).length, 0);
  const torsos = meshes.reduce((n, m) => n + m.part.filter(p => p === -1).length, 0);
  const style = Fighter.animStyle; Fighter.animStyle = 'twos';
  const v = new THREE.Vector3(), point = new THREE.Vector3();
  try {
    driveLocal(fighter, other, SWINGS[swing].presses, SWINGS[swing].ticks, body => {
      const motion = body.smear.motion.value, at = body.smear.point.value, limb = (body.smear as { limb?: { value: THREE.Vector4 } }).limb?.value;
      if (motion.w <= 0) return;
      row.frames++;
      point.set(at.x, at.y, at.z);
      const struck = limb ? [limb.x, limb.y, limb.z, limb.w].indexOf(1) : -1;
      let head = 0, torso = 0;
      body.group.updateMatrixWorld(true);
      for (const { mesh, part, gate } of meshes) {
        for (let i = 0; i < part.length; i++) {
          mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
          const d = v.distanceTo(point);
          if (d >= at.w) continue;
          const near = 1 - THREE.MathUtils.smoothstep(d, at.w * .4, at.w);
          // The shader's own weighting (look/toonShading.ts applyLimbSmear), where the renderer has one.
          const g = limb && gate ? THREE.MathUtils.smoothstep(gate.getX(i) * limb.x + gate.getY(i) * limb.y + gate.getZ(i) * limb.z + gate.getW(i) * limb.w, .5, 1) : 1;
          const moved = motion.w * near * g * 100;
          if (part[i] === -2) { if (moved > 1) head++; row.headCm = Math.max(row.headCm, moved); }
          else if (part[i] === -1) { if (moved > 1) torso++; row.torsoCm = Math.max(row.torsoCm, moved); }
          else if (struck < 0 || part[i] === struck) row.limbCm = Math.max(row.limbCm, moved);
        }
      }
      row.head = Math.max(row.head, head / Math.max(1, row.heads));
      row.torso = Math.max(row.torso, torso / Math.max(1, torsos));
    });
  } finally { Fighter.animStyle = style; }
  return row;
}

export type FormLaunchRow = { fighter: FighterId; flown: number; sole: number; under: number; lift: number };
/** The fighter awakened (its form body drawn) and launched by `striker`'s heavy (Taisei's from behind, Konta's from in
 *  front): the form's lowest sole against the floor over the flight and the knockdown, the frames it is over 5 cm
 *  under, and the most FLOOR_GUARD lifted it (cm). */
export function measureFormLaunch(victim: Fighter, striker: Fighter): FormLaunchRow {
  const row: FormLaunchRow = { fighter: victim.state.fighter, flown: 0, sole: 0, under: 0, lift: 0 };
  const form = (victim as unknown as { gear4?: { group: THREE.Group; lowestSupport(): number } }).gear4, hover = () => (victim as unknown as { formHover: number }).formHover;
  driveBoth(victim, striker, [{ tick: 150, attack: 'heavy' }], [{ tick: 20, awaken: true }], 330, (body, shown) => {
    if (!/launched|knockdown/.test(shown.action) || !form?.group.visible) return;
    row.flown++;
    body.group.updateMatrixWorld(true);
    const sole = form.lowestSupport();
    if (Number.isFinite(sole)) { row.sole = Math.min(row.sole, sole); if (sole < -.05) row.under++; }
    row.lift = Math.max(row.lift, (form.group.position.y + hover()) * 100);
  });
  return row;
}
/** `drive`, with presses for the victim too (its awakening). */
function driveBoth(victim: Fighter, striker: Fighter, presses: Press[], own: (Press & { awaken?: boolean })[], ticks: number, probe: Probe) {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 11 });
  sim.addPlayer('a', striker.state.fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', victim.state.fighter, 'B', false, { x: 0, y: 0, z: 1.6 });
  sim.startMatch(); sim.trainingCommand('b', 'awakening');
  LANDED.reset();
  const timeline = new CombatTimeline({ delayMs: 60 });
  const inbox: { at: number; snapshot: ReturnType<ArenaSimulation['snapshot']> }[] = [];
  let tick = 0, seq = 0, clock = 0;
  const step = () => {
    const press = presses.find(p => p.tick === tick), mine = own.find(p => p.tick === tick);
    const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
    const input: PlayerInput = { seq: ++seq, moveX: 0, moveZ: 0, yaw: Math.atan2(b.x - a.x, b.z - a.z), targetId: 'b', lock: true };
    if (press?.attack) input.attack = press.attack;
    const theirs: PlayerInput = { seq, moveX: 0, moveZ: 0, yaw: Math.atan2(a.x - b.x, a.z - b.z) };
    if (mine?.awaken) theirs.awaken = true;
    sim.submitInput('a', input); sim.submitInput('b', theirs);
    sim.step(); tick++;
    if (tick % 2 === 0) inbox.push({ at: tick * TICK + .05, snapshot: sim.snapshot(true) });
  };
  try {
    while (tick < ticks) {
      clock += TICK;
      while ((tick + 1) * TICK <= clock + 1e-9) step();
      while (inbox.length && inbox[0].at <= clock + 1e-9) { const { at, snapshot } = inbox.shift()!; LANDED.authoritative(snapshot, 'b'); timeline.push(snapshot, at * 1000); }
      const presented = timeline.sample(clock * 1000);
      if (!presented) continue;
      const shownA = presented.snapshot.players.find(p => p.id === 'a')!, shownB = presented.snapshot.players.find(p => p.id === 'b')!;
      for (const e of presented.events) {
        if (e.kind !== 'hit' || !e.endpoint || !e.damage || e.targetId !== 'b') continue;
        const heading = e.origin ? new THREE.Vector3(e.endpoint.x - e.origin.x, e.endpoint.y - e.origin.y, e.endpoint.z - e.origin.z) : undefined;
        victim.impact(true, e.slot, styleOf(e), e.contactIndex, heading, e.damage, e.endpoint.y - shownB.y, { chain: e.chain, fromBehind: e.fromBehind, reaction: e.reaction });
      }
      LANDED.deliver(presented.events); LANDED.clock = presented.time;
      striker.targetDistance = victim.targetDistance = Math.hypot(shownB.x - shownA.x, shownB.z - shownA.z);
      victim.targetPoint = (victim.targetPoint ?? new THREE.Vector3()).set(shownA.x, shownA.y + 1.45, shownA.z);
      striker.update(TICK, shownA, true, TICK);
      victim.update(TICK, shownB, true, TICK);
      probe(victim, shownB, clock);
    }
  } finally { sim.dispose(); }
}
