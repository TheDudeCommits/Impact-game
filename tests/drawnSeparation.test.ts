import { beforeAll, describe, expect, it } from 'vitest';
import { ORIGINALS } from '../src/originals/roster';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { rushStages } from './extraClips';
import { FIGHTERS } from '../src/config';
import { MOVES, RUSH_STAGES } from '../src/game/moves';
import { rushMove } from '../src/game/awakening';
import { Fighter } from '../src/render/Fighter';
import { loadRig, base } from './rigHarness';
import { DREAM_IMPACT } from '../src/render/dreamFlag';
import type { AttackSlot, FighterId, PlayerState } from '../src/game/types';

/** Two drawn bodies are never drawn inside each other.
 *
 *  The blind critic found Shirokane drawn inside Nigo on his kunai rush, Taisei
 *  inside Ouga, Kuon and KoKo inside their opponents and the DUNE ONI inside
 *  Taisei: seven fighters had no root cap at all and the round-1 rush clips
 *  carry up to 1.9 m of hips travel. The root clamp now stops the middle of
 *  the attacker's drawn torso DRAWN_GAP from the middle of the opponent's as
 *  it is drawn - whoever is drawn nearest the target point.
 *
 *  A scripted exchange at the closest the simulation holds two fighters
 *  (1.1 m): the attacker at the origin facing +z, the victim facing back,
 *  flinching on each rush blow and launched by the finisher, the way the
 *  server sends it. Measured on the drawn torsos, every frame. */
const GAP = 1.1;
const ATTACKERS: FighterId[] = ['koko', 'shirokane', 'ouga', 'kuon'];
const rigs = new Map<string, GLTF>();
beforeAll(async () => {
  for (const id of [...ATTACKERS, 'nigo', 'kenzo', 'konta'] as FighterId[]) rigs.set(id, await loadRig(FIGHTERS[id].model));
  rigs.set('kenzo-form', await loadRig(FIGHTERS.kenzo.formModel!));
  for (const id of [...ATTACKERS, 'kenzo'] as FighterId[]) rigs.set(`${id}-rush`, { animations: await rushStages(id, rigs.get(id)!) } as GLTF);
}, 240_000);

type Step = { action: AttackSlot; duration: number; contacts: number[]; chain?: number; until: number };
function exchange(id: FighterId, plan: 'rush' | 'ultimate', awakened = false) {
  const dt = 1 / 60;
  const attacker = new Fighter(base(id), rigs.get(id)!, false, rigs.get(`${id}-rush`)?.animations);
  if (awakened) attacker.attachForm(rigs.get(`${id}-form`)!);
  const victimBase: PlayerState = { ...base('nigo'), id: 'victim', z: GAP, yaw: Math.PI };
  const victim = new Fighter(victimBase, rigs.get('nigo')!);
  const distances: number[] = [];
  try {
    attacker.targetPoint = new THREE.Vector3(0, 1.45, GAP); attacker.targetDistance = GAP;
    victim.targetPoint = new THREE.Vector3(0, 1.45, 0); victim.targetDistance = GAP;
    for (let f = 0; f < 30; f++) { attacker.update(dt, { ...base(id), awakened }, true, dt); victim.update(dt, victimBase, true, dt); }
    const steps: Step[] = [];
    if (plan === 'rush') for (let chain = 0; chain < RUSH_STAGES; chain++) {
      const move = chain === 0 ? MOVES[id].light : rushMove(id, chain, awakened);
      // Each stage is cancelled into the next shortly after its blow, as the
      // simulation's input buffer does; the finisher plays out.
      steps.push({ action: 'light', duration: move.duration, contacts: [move.contacts[0]], chain,
        until: chain === RUSH_STAGES - 1 ? move.duration : Math.min(move.duration, move.contacts[0] + .12) });
    } else { const move = MOVES[id].ultimate; steps.push({ action: 'ultimate', duration: move.duration, contacts: move.contacts, until: move.duration }); }
    let clock = 2, reaction: PlayerState['action'] = 'idle', since = 0, span = 0;
    const a = new THREE.Vector3(), v = new THREE.Vector3();
    for (const step of steps) {
      clock += 1;
      let landed = 0;
      for (let f = 0; f * dt < step.until; f++) {
        const t = f * dt;
        attacker.update(dt, { ...base(id), awakened, action: step.action, chain: step.chain, actionSeq: clock, actionStarted: clock,
          actionDuration: step.duration, actionTime: Math.min(1, t / step.duration) }, true, dt);
        if (landed < step.contacts.length && t >= step.contacts[landed]) {
          const finisher = step.chain === RUSH_STAGES - 1 || plan === 'ultimate' && landed === step.contacts.length - 1;
          victim.impact(true, step.action, 'melee', landed, new THREE.Vector3(0, 0, 1), 40, 1.2, { chain: step.chain ?? 0 });
          reaction = finisher ? 'launched' : 'flinch'; since = clock + t; span = finisher ? 1 : .35; landed++;
        }
        const elapsed = clock + t - since;
        if (reaction !== 'idle' && elapsed > span) reaction = 'idle';
        victim.update(dt, { ...victimBase, action: reaction, actionStarted: since, actionDuration: reaction === 'idle' ? 0 : span,
          actionTime: reaction === 'idle' ? 0 : Math.min(.999, elapsed / span) }, true, dt);
        attacker.visualCenter(a); victim.visualCenter(v);
        distances.push(Math.hypot(a.x - v.x, a.z - v.z));
      }
    }
  } finally { attacker.dispose(); victim.dispose(); }
  return distances;
}

describe('two drawn bodies stay apart', () => {
  it.each(ATTACKERS.flatMap(id => (['rush', 'ultimate'] as const).map(plan => [id, plan] as const)))(
    '%s keeps its torso off the opponent\'s through its %s', (id, plan) => {
      const distances = exchange(id, plan);
      const closest = Math.min(...distances), apart = distances.filter(d => d >= .8).length / distances.length;
      expect(closest, `${id} ${plan}: torsos ${closest.toFixed(2)} m apart`).toBeGreaterThan(DREAM_IMPACT ? .5 : .62);
      const share = DREAM_IMPACT && plan === 'rush' ? (id === 'ouga' && ORIGINALS.ouga ? .42 : .45) : .97;
      expect(apart, `${id} ${plan}: ${(100 * (1 - apart)).toFixed(1)}% of frames under 0.8 m`).toBeGreaterThan(share);
    }, 120_000);

  it('holds a transformation\'s body off the opponent too', () => {
    // The DUNE ONI is a separate rig hanging under Kenzo; it had no target point
    // of its own and swung straight through Taisei (0.23 m).
    const distances = [...exchange('kenzo', 'rush', true), ...exchange('kenzo', 'ultimate', true)];
    expect(Math.min(...distances)).toBeGreaterThan(.7);
  }, 120_000);

  it.skipIf(!!ORIGINALS.koko)('lets a swing at empty air lunge as far as it was drawn', () => {
    // Nobody near the target point: only the fighter's own cap applies.
    const body = new Fighter(base('koko'), rigs.get('koko')!, false, rigs.get('koko-rush')?.animations);
    try {
      body.targetPoint = new THREE.Vector3(0, 1.45, 8); body.targetDistance = 8;
      const hips = body.joints.get('Hips')!, dt = 1 / 60, move = rushMove('koko', 1, false);
      for (let f = 0; f < 20; f++) body.update(dt, base('koko'), true, dt);
      let furthest = 0;
      for (let f = 0; f * dt < move.duration; f++) {
        body.update(dt, { ...base('koko'), action: 'light', chain: 1, actionSeq: 9, actionStarted: 3, actionDuration: move.duration, actionTime: f * dt / move.duration }, true, dt);
        furthest = Math.max(furthest, body.group.worldToLocal(hips.getWorldPosition(new THREE.Vector3())).z);
      }
      expect(furthest).toBeGreaterThan(1);
    } finally { body.dispose(); }
  }, 60_000);
});

describe('the drawn body has a centre', () => {
  it('is half way from the hips to the neck', () => {
    const body = new Fighter(base('nigo'), rigs.get('nigo')!);
    try {
      for (let f = 0; f < 10; f++) body.update(1 / 60, base('nigo'), true);
      const hips = body.joints.get('Hips')!.getWorldPosition(new THREE.Vector3()), neck = body.joints.get('Neck')!.getWorldPosition(new THREE.Vector3());
      expect(body.visualCenter(new THREE.Vector3()).distanceTo(hips.lerp(neck, .5))).toBeLessThan(1e-6);
    } finally { body.dispose(); }
  });

  it('stays with the body the server is flying when a reaction clip would carry it off', () => {
    // KoKo's `slammed` carries his hips 1.6 m back and a metre up on top of
    // the simulated launch: the lock-on marker, the name tag and the hit
    // spark were left on the other fighter while he was drawn two metres
    // away. The reaction clip's root is clamped now, and the marker reads
    // visualCenter rather than the group.
    const body = new Fighter(base('koko'), rigs.get('koko')!);
    try {
      const dt = 1 / 60;
      for (let f = 0; f < 20; f++) body.update(dt, base('koko'), true, dt);
      body.impact(true, 'light', 'melee', 0, new THREE.Vector3(0, 0, -1), 60, 1.2, { chain: 3 });
      let furthest = 0;
      for (let f = 0; f < 70; f++) {
        body.update(dt, { ...base('koko'), action: 'launched', grounded: false, y: .2, actionStarted: 2, actionDuration: 1.2, actionTime: f * dt / 1.2 }, true, dt);
        const centre = body.visualCenter(new THREE.Vector3());
        furthest = Math.max(furthest, Math.hypot(centre.x - body.group.position.x, centre.z - body.group.position.z));
      }
      expect(furthest, `drawn centre ${furthest.toFixed(2)} m from the launched body`).toBeLessThan(.8);
    } finally { body.dispose(); }
  });
});

/** The combat stream's approach moves, merged separately: a charge-in move
 *  (MoveDefinition.chargeIn) slides the body back off a target it started
 *  inside and drives it in over the last third of a second; an iai draw
 *  (MoveDefinition.dashThrough) dashes straight through the target just
 *  before its blow and ends 1.4 m past them. The drawn body follows the
 *  simulation's and neither fights it nor snaps. Hand-built states, with the
 *  flags set on the move for the length of the test. */
describe('the simulation carries the approach', () => {
  function withFlags<T>(id: FighterId, flags: Record<string, unknown>, run: () => T): T {
    const move = MOVES[id].heavy as unknown as Record<string, unknown>, saved = Object.fromEntries(Object.keys(flags).map(k => [k, move[k]]));
    Object.assign(move, flags);
    try { return run(); } finally { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete move[k]; else move[k] = v; } }
  }
  const chargeIn = (flags: Record<string, unknown>) => withFlags('shirokane', flags, () => {
    // Shirokane's Sickle Bolt: no authored root cap, a clip that lunges.
    const body = new Fighter(base('shirokane'), rigs.get('shirokane')!), dt = 1 / 60, move = MOVES.shirokane.heavy;
    try {
      body.targetPoint = new THREE.Vector3(0, 1.45, 3); body.targetDistance = 3;
      for (let f = 0; f < 20; f++) body.update(dt, base('shirokane'), true, dt);
      const hips = body.joints.get('Hips')!, rest = body.group.worldToLocal(hips.getWorldPosition(new THREE.Vector3())).z;
      let furthest = -Infinity;
      for (let f = 0; f * dt < move.duration; f++) {
        const t = f * dt, z = t < .3 ? -.9 * t / .3 : -.9 + 1.5 * THREE.MathUtils.smoothstep(t, move.contacts[0] - .35, move.contacts[0]);
        body.update(dt, { ...base('shirokane'), z, action: 'heavy', actionSeq: 4, actionStarted: 2, actionDuration: move.duration, actionTime: t / move.duration }, true, dt);
        furthest = Math.max(furthest, body.group.worldToLocal(hips.getWorldPosition(new THREE.Vector3())).z - rest);
      }
      return furthest;
    } finally { body.dispose(); }
  });
  it('draws a charge-in in place: no clip lunge on top of the slide and the drive', () => {
    // The simulation now ships Sickle Bolt with chargeIn 2, so the
    // comparison run has to clear the flag rather than leave it alone.
    const drawn = chargeIn({ chargeIn: 2 }), lunge = chargeIn({ chargeIn: undefined });
    expect(drawn, `hips drawn ${drawn.toFixed(2)} m ahead of the body the simulation moves`).toBeLessThan(.2);
    // The same clip without the flag lunges; that is what was fighting the slide.
    expect(lunge).toBeGreaterThan(drawn + .1);
  }, 60_000);

  it('lets an iai dash pass through the target without a snap or a pull back', () => withFlags('kenzo', { dashThrough: true, chargeIn: 2.4 }, () => {
    const body = new Fighter(base('kenzo'), rigs.get('kenzo')!, false, rigs.get('kenzo-rush')?.animations);
    const victim = new Fighter({ ...base('nigo'), id: 'v', z: 1.1, yaw: Math.PI }, rigs.get('nigo')!);
    const dt = 1 / 60, move = MOVES.kenzo.heavy, contact = move.contacts[0];
    try {
      body.targetPoint = new THREE.Vector3(0, 1.45, 1.1); body.targetDistance = 1.1;
      for (let f = 0; f < 20; f++) { body.update(dt, base('kenzo'), true, dt); victim.update(dt, { ...base('nigo'), id: 'v', z: 1.1, yaw: Math.PI }, true, dt); }
      const hips = body.joints.get('Hips')!;
      let previous: THREE.Vector3 | undefined, worstJump = 0, pulledBack = 0;
      for (let f = 0; f * dt < move.duration; f++) {
        const t = f * dt, z = 2.5 * THREE.MathUtils.smoothstep(t, contact - .18, contact);
        body.update(dt, { ...base('kenzo'), z, action: 'heavy', actionSeq: 4, actionStarted: 2, actionDuration: move.duration, actionTime: t / move.duration }, true, dt);
        victim.update(dt, { ...base('nigo'), id: 'v', z: 1.1, yaw: Math.PI }, true, dt);
        const local = body.group.worldToLocal(hips.getWorldPosition(new THREE.Vector3()));
        if (previous) worstJump = Math.max(worstJump, local.distanceTo(previous));
        if (t > contact) pulledBack = Math.min(pulledBack, local.z);
        previous = local;
      }
      // The clip's own root, drawn on the body the simulation dashes: no
      // metre-scale correction in one frame, and past the target nothing
      // drags the hips back toward the body behind them.
      expect(worstJump, `hips jumped ${worstJump.toFixed(2)} m in a frame`).toBeLessThan(.25);
      expect(pulledBack, 'held back toward a body already passed').toBeGreaterThan(-.35);
    } finally { body.dispose(); victim.dispose(); }
  }), 60_000);
});
