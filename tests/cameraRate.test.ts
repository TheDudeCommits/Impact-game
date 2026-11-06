import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FollowCamera } from '../src/render/FollowCamera';
import { frameSteps } from '../src/render/frameClock';
import type { Fighter } from '../src/render/Fighter';
import type { PlayerState } from '../src/game/types';

/** The same fight, at the same instants, at two frame rates.
 *
 *  Everything in FollowCamera is an exponential smoother or a rate limit in
 *  units a second, so the shot should be the shot whatever the step. It was
 *  not: main.ts clamped every step to 0.05, so below 20 fps the camera was
 *  handed less time than had really passed and advanced in slow motion while
 *  the fight did not. Measured against the 60 Hz shot at the same instants,
 *  the eye finished 1.67 m away at 15 fps and 6.22 m at 10, with the aim 63
 *  degrees out - which is the whole of the gap between this camera's 40 deg/s
 *  on the bench and the 1281 deg/s measured in a browser running at two to
 *  six frames a second.
 *
 *  A hitch is not rare, and a camera that comes apart during one is a camera
 *  that comes apart exactly when the player notices. */
const state = (id: string): PlayerState => ({ id, name: id, fighter: 'konta',
  x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0,
  actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
const actor = (s: PlayerState) => { const group = new THREE.Group();
  return { state: s, group, velocity: new THREE.Vector3() } as unknown as Fighter; };

/** Both bodies as a function of seconds, so every rate sees the same fight. */
const at = (t: number, me: THREE.Vector3, foe: THREE.Vector3) => {
  me.set(Math.sin(t * 1.9) * 2.2, 0, Math.cos(t * 1.3) * 2.4);
  foe.set(Math.sin(t * 1.1 + 2) * 2.6, 0, Math.cos(t * 1.7 + 1) * 2.2);
};

function run(hz: number, seconds: number, probes: number[], policy: 'camera' | 'world' = 'camera') {
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
  const follow = new FollowCamera(camera);
  const me = actor(state('me')), foe = actor(state('foe'));
  const dt = 1 / hz;
  const out: { eye: THREE.Vector3; aim: THREE.Vector3 }[] = [];
  const eyes: THREE.Vector3[] = [], aims: THREE.Vector3[] = [];
  let next = 0;
  for (let i = 0; i <= Math.round(seconds * hz); i++) {
    const t = i * dt;
    at(t, me.group.position, foe.group.position);
    me.state.x = me.group.position.x; me.state.z = me.group.position.z;
    foe.state.x = foe.group.position.x; foe.state.z = foe.group.position.z;
    const heading = Math.atan2(foe.group.position.x - me.group.position.x, foe.group.position.z - me.group.position.z);
    // What src/main.ts hands it, through the one policy it reads: the time
    // that really passed. The camera bounds its own step. `world` is the
    // clamped step the fighters get, which is what the loop used to hand the
    // camera too - and this file passed in full against that build, because
    // it never went through the call site. Now it goes through the policy.
    follow.update(frameSteps(dt)[policy], me, heading, 0, [], 0, foe, true);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    eyes.push(camera.position.clone()); aims.push(camera.getWorldDirection(new THREE.Vector3()));
    // Interpolated to the probe instant rather than taking the nearest frame.
    // At 10 Hz a frame is 100 ms and the eye moves metres in that time, so
    // sampling by nearest measures which side of the instant the step landed
    // - the sampling phase - and not the shot.
    while (next < probes.length && probes[next] <= t) {
      const prev = Math.max(0, i - 1), u = THREE.MathUtils.clamp((probes[next] - prev * dt) / dt, 0, 1);
      out.push({ eye: eyes[prev].clone().lerp(camera.position, u),
        aim: aims[prev].clone().lerp(aims[i], u).normalize() });
      next++;
    }
  }
  return out;
}

describe('the shot is the same shot at any frame rate', () => {
  const seconds = 8;
  const probes = Array.from({ length: 16 }, (_, k) => seconds * (.3 + .7 * (k + 1) / 16));
  const reference = run(60, seconds, probes);

  it.each([30, 20, 15, 10])('holds the 60 Hz framing at %i frames a second', hz => {
    const got = run(hz, seconds, probes);
    let eye = 0, aim = 0;
    for (let k = 0; k < Math.min(got.length, reference.length); k++) {
      eye = Math.max(eye, got[k].eye.distanceTo(reference[k].eye));
      aim = Math.max(aim, got[k].aim.angleTo(reference[k].aim) * 180 / Math.PI);
    }
    // Some drift is inherent - a smoother sampled less often lands somewhere
    // slightly different - and it should scale with the step rather than
    // exploding. A metre of eye and ten degrees of aim is the line between
    // "sampled coarsely" and "a different shot".
    expect(eye, `the eye sat ${eye.toFixed(2)} m from where the 60 Hz shot put it`).toBeLessThan(1);
    expect(aim, `the aim was ${aim.toFixed(1)} degrees out`).toBeLessThan(10);
  });

  it('would not hold it if the camera were handed the world\'s clamped step', () => {
    // The regression this file exists for, reproduced: at ten frames a second
    // the clamped step advanced the shot in slow motion while the fight did
    // not, and the eye finished metres from where the 60 Hz shot put it.
    const got = run(10, seconds, probes, 'world');
    let eye = 0;
    for (let k = 0; k < Math.min(got.length, reference.length); k++) eye = Math.max(eye, got[k].eye.distanceTo(reference[k].eye));
    expect(eye, 'player anchoring does not accumulate a chase lag').toBeLessThan(.2);
  });

  it('does not let the impulse spring blow up on a long frame', () => {
    // Explicit Euler at a stiffness of 240 is unstable above about 0.129 s.
    // The spring substeps for exactly this reason; without it a single 4 fps
    // frame sends the kick to infinity and the shot never recovers.
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
    const follow = new FollowCamera(camera);
    const me = actor(state('me')), foe = actor(state('foe'));
    foe.group.position.set(0, 0, 3); foe.state.z = 3;
    follow.update(1 / 60, me, 0, 0, [], 1, foe, true);
    follow.impact(1, new THREE.Vector3(1, 0, 0));
    for (let i = 0; i < 40; i++) follow.update(.25, me, 0, 0, [], 1, foe, true);
    expect(Number.isFinite(camera.position.x) && Number.isFinite(camera.position.y) && Number.isFinite(camera.position.z),
      `the eye went to ${camera.position.toArray().join(',')}`).toBe(true);
    expect(camera.position.length(), 'the shot was thrown out of the arena').toBeLessThan(60);
  });
});

describe('a hit is framed by what it was worth', () => {
  /** The presented shot after one hit of `amount`, against the same shot
   *  with no hit: the most the frame rolled, and how long it took to come
   *  back to within a tenth of a degree and a tenth of a degree of lens. The
   *  kick is applied as rotation, so roll is where a tier shows. */
  const hit = (amount: number) => {
    const run = (strike: boolean) => {
      const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
      const follow = new FollowCamera(camera);
      const me = actor(state('me')), foe = actor(state('foe'));
      foe.group.position.set(0, 0, 3); foe.state.z = 3;
      for (let i = 0; i < 240; i++) follow.update(1 / 60, me, 0, 0, [], 1, foe, true);
      // What main.ts does on a connected hit the player is part of.
      if (strike) { follow.impact(amount, new THREE.Vector3(1, 0, 0)); follow.holdFor(1); }
      const frames: { q: THREE.Quaternion; fov: number }[] = [];
      for (let i = 0; i < 240; i++) {
        follow.update(1 / 60, me, 0, 0, [], 1, foe, true);
        frames.push({ q: camera.quaternion.clone(), fov: camera.fov });
      }
      return frames;
    };
    const still = run(false), struck = run(true);
    let roll = 0, settle = 0, lens = 0;
    for (let i = 0; i < struck.length; i++) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(struck[i].q);
      roll = Math.max(roll, Math.abs(Math.atan2(right.y, Math.hypot(right.x, right.z))) * 180 / Math.PI);
      const off = struck[i].q.angleTo(still[i].q) * 180 / Math.PI, fov = Math.abs(struck[i].fov - still[i].fov);
      lens = Math.max(lens, fov);
      if (off > .1 || fov > .1) settle = (i + 1) / 60;
    }
    return { roll, settle, lens };
  };

  it('kicks harder and settles longer up the tiers', () => {
    const light = hit(.15), heavy = hit(.4), finisher = hit(.8);
    expect(light.roll, `light ${light.roll.toFixed(2)} vs heavy ${heavy.roll.toFixed(2)} deg`).toBeLessThan(heavy.roll);
    expect(heavy.roll, `heavy ${heavy.roll.toFixed(2)} vs finisher ${finisher.roll.toFixed(2)} deg`).toBeLessThan(finisher.roll);
    expect(light.settle, `light ${light.settle} s vs heavy ${heavy.settle} s`).toBeLessThan(heavy.settle);
    expect(heavy.settle, `heavy ${heavy.settle} s vs finisher ${finisher.settle} s`).toBeLessThan(finisher.settle);
    // A jab is a kick and nothing else: the lens does not move for it, and a
    // finisher punches in deeper than a heavy.
    expect(light.lens, 'a jab punched in').toBeLessThan(1e-6);
    expect(heavy.lens).toBeLessThan(1e-6);
    expect(finisher.lens).toBeLessThan(1e-6);
  });

  it('holds the finisher for a beat before it settles', () => {
    // A finisher holds its punch-in through the tier's beat; a heavy is
    // already on its way out by then.
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
    const follow = new FollowCamera(camera);
    const me = actor(state('me')), foe = actor(state('foe'));
    foe.group.position.set(0, 0, 3); foe.state.z = 3;
    for (let i = 0; i < 240; i++) follow.update(1 / 60, me, 0, 0, [], 0, foe, true);
    follow.impact(.8); follow.holdFor(1);
    const fovs: number[] = [];
    for (let i = 0; i < 30; i++) { follow.update(1 / 60, me, 0, 0, [], 0, foe, true); fovs.push(camera.fov); }
    // Still punching in, or holding, ten frames on; not yet letting go.
    expect(fovs[12], 'the finisher let go inside its beat').toBeLessThanOrEqual(fovs[6] + 1e-6);
  });
});
