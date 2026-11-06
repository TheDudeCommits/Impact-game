import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FollowCamera } from '../src/render/FollowCamera';
import type { Fighter } from '../src/render/Fighter';
import type { PlayerState } from '../src/game/types';

// Target selection and attack choreography must never take control of azimuth.
const state = (id: string, x = 0, z = 0): PlayerState => ({ id, name: id, fighter: 'konta',
  x, y: 0, z, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0,
  actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
const actor = (id: string, x = 0, z = 0) => {
  const s = state(id, x, z), group = new THREE.Group();
  group.position.set(x, 0, z);
  return { state: s, group, velocity: new THREE.Vector3() } as unknown as Fighter;
};

/** Run a fixed script, switching opponent at frame 150, and report the worst
 *  single-frame aim rate in the ten frames that follow. */
function switchTo(x: number, z: number, alternate = false) {
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
  const follow = new FollowCamera(camera);
  const me = actor('me');
  const first = actor('foe', 0, 3.2), second = actor('other', x, z);
  let worst = 0, aim: THREE.Vector3 | null = null;
  for (let i = 0; i < 200; i++) {
    // `alternate` flips back and forth every three frames, which is the
    // measured worst case for dwell - the hand-off has to stay continuous
    // through a switch that lands mid hand-off.
    const foe = i < 150 ? first : alternate && Math.floor((i - 150) / 3) % 2 === 1 ? first : second;
    follow.update(1 / 60, me, 0, 0, [], 0, foe, true);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const now = camera.getWorldDirection(new THREE.Vector3());
    if (aim && i >= 150 && i < 165) worst = Math.max(worst, now.angleTo(aim) * 60 * 180 / Math.PI);
    aim = now;
  }
  return worst;
}

describe('the end of a showpiece is not a cut', () => {
  it('unwinds Full Swell\'s side-on framing rather than dropping it', () => {
    // `wantShoulder -= form*12; wantForward += form*12` was gated on the
    // action string, so on the frame the ultimate ended both offsets went to
    // zero together: measured, a 12.07 m single-frame move of the eye on the
    // beat the player was watching for the payoff.
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
    const follow = new FollowCamera(camera);
    const me = actor('me'), foe = actor('foe', 0, 3);
    me.state.fighter = 'gummy';
    const duration = 7.8;
    let worst = 0, previous: THREE.Vector3 | null = null;
    for (let i = 0; i < 60 * 11; i++) {
      const t = i / 60;
      const inside = t > 1 && t < 1 + duration;
      me.state.action = inside ? 'ultimate' : 'idle';
      me.state.actionDuration = inside ? duration : 0;
      me.state.actionTime = inside ? (t - 1) / duration : 0;
      follow.update(1 / 60, me, 0, 0, [], 0, foe, true);
      if (previous && i > 30) worst = Math.max(worst, camera.position.distanceTo(previous));
      previous = camera.position.clone();
    }
    expect(worst, `the eye moved ${worst.toFixed(2)} m in one frame`).toBeLessThan(.5);
  });
});

describe('changing target is a move, not a cut', () => {
  it('keeps player azimuth when selection changes nearby', () => {
    const rate = switchTo(4, 3);
    // 706 deg/s before the hand-off. The locked yaw's own cap is 149 deg/s and
    // the rest is the aim point travelling, so this is not asking for the
    // camera to crawl - only for the frame not to be a cut.
    expect(rate, `the aim turned ${Math.round(rate)} deg/s in one frame`).toBeLessThan(.01);
  });

  it('keeps player azimuth when selection moves behind', () => {
    const rate = switchTo(-14, -6);
    expect(rate, `the aim turned ${Math.round(rate)} deg/s in one frame`).toBeLessThan(.01);
  });

  it('keeps the player view stable through rapid target switches', () => {
    // Carrying the outgoing fighter rather than the blended point would
    // restart the ease from a body the aim is no longer near, and each flip
    // would be a fresh discontinuity.
    const rate = switchTo(-14, -6, true);
    expect(rate, `the aim turned ${Math.round(rate)} deg/s in one frame`).toBeLessThan(.01);
  });

  it('will not whip the aim when the room pulls the shot in', () => {
    // The aim point is rebuilt every frame as the camera's own position plus a
    // direction, and the eye is placed exactly - so every metre the eye moves
    // near geometry becomes aim rotation one for one. Measured in the Proving
    // Hall with the walls the physics uses, the aim reached 1185 deg/s and its
    // worst single-frame reversal was 19.65 degrees. This drives the same
    // shape without a stage: an eye whose distance is yanked in and out, which
    // is what a wall does to it.
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
    const follow = new FollowCamera(camera);
    const me = actor('me'), foe = actor('foe', 0, 2.2);
    // A wall that comes and goes: a box the shot keeps finding behind it.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 12, 1), new THREE.MeshBasicMaterial());
    let worst = 0, aim: THREE.Vector3 | null = null;
    for (let i = 0; i < 400; i++) {
      // Slide the wall through the boom so the clear distance swings hard.
      wall.position.set(0, 6, -1.2 - 3.4 * (.5 + .5 * Math.sin(i / 14)));
      wall.updateMatrixWorld(true);
      const t = i / 60;
      foe.group.position.set(Math.sin(t * 2.2) * 1.8, 0, 2.2 + Math.cos(t * 2.2) * .8);
      foe.state.x = foe.group.position.x; foe.state.z = foe.group.position.z;
      const heading = Math.atan2(foe.group.position.x, foe.group.position.z);
      follow.update(1 / 60, me, heading, 0, [wall], 0, foe, true);
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      const now = camera.getWorldDirection(new THREE.Vector3());
      if (aim && i > 60) worst = Math.max(worst, now.angleTo(aim) * 60 * 180 / Math.PI);
      aim = now;
    }
    expect(worst, `the aim turned ${Math.round(worst)} deg/s in one frame against a moving wall`).toBeLessThan(500);
  });

  it('leaves ordinary tracking exact', () => {
    // The hand-off must cost nothing while the target is unchanged: its floor
    // speed is above anything a fighter can travel at, so the eased point is
    // the live one every frame.
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
    const follow = new FollowCamera(camera);
    const me = actor('me'), foe = actor('foe', 0, 3.2);
    let worst = 0, aim: THREE.Vector3 | null = null;
    for (let i = 0; i < 300; i++) {
      // Circling at the game's own top speed of 7.5 m/s, which is the fastest
      // an opponent can travel outside a dash.
      const t = i / 60, w = 7.5 / 3.5;
      foe.group.position.set(Math.sin(t * w) * 3.5, 0, 4 + Math.cos(t * w) * 2);
      foe.state.x = foe.group.position.x; foe.state.z = foe.group.position.z;
      const heading = Math.atan2(foe.group.position.x, foe.group.position.z);
      follow.update(1 / 60, me, 0, 0, [], 0, foe, true);
      camera.updateMatrixWorld();
      const now = camera.getWorldDirection(new THREE.Vector3());
      if (aim && i > 60) worst = Math.max(worst, now.angleTo(aim) * 60 * 180 / Math.PI);
      aim = now;
    }
    expect(worst, `tracking peaked at ${Math.round(worst)} deg/s`).toBeLessThan(200);
  });
});

/** A scripted countdown: the pair shuffle a little, so the chase shot is
 *  alive underneath whatever is presented over it. */
function countdown(seconds: number, stopAfter = 0, frames = 300) {
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
  const follow = new FollowCamera(camera);
  const me = actor('me'), foe = actor('foe', .4, 3.4);
  if (seconds > 0) follow.intro(seconds);
  const out: { eye: THREE.Vector3; aim: THREE.Vector3 }[] = [];
  for (let i = 0; i < frames; i++) {
    if (stopAfter && i === stopAfter) follow.intro(0);
    const t = i / 60;
    foe.group.position.set(.4 + Math.sin(t * .8) * .3, 0, 3.4);
    foe.state.x = foe.group.position.x;
    follow.update(1 / 60, me, Math.atan2(foe.group.position.x, foe.group.position.z), 0, [], 0, foe, true);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    out.push({ eye: camera.position.clone(), aim: camera.getWorldDirection(new THREE.Vector3()) });
  }
  return out;
}

describe('the round-start intro', () => {
  it('ends on the chase shot on the countdown\'s last frame, without a cut', () => {
    const seconds = 3, chase = countdown(0), intro = countdown(seconds);
    // The countdown's last frame is the one on which the intro's clock
    // reaches zero: `seconds` of updates, so the index is one less.
    const last = Math.round(seconds * 60) - 1;
    for (let i = last; i < chase.length; i++) {
      const eye = intro[i].eye.distanceTo(chase[i].eye), aim = intro[i].aim.angleTo(chase[i].aim) * 180 / Math.PI;
      expect(eye, `frame ${i}: the eye sat ${eye.toFixed(3)} m from the chase shot`).toBeLessThan(.15);
      expect(aim, `frame ${i}: the aim was ${aim.toFixed(2)} degrees off the chase shot`).toBeLessThan(2);
    }
    // And it opened low, and in front: the fighter faces +z, toward the
    // opponent, and the eye-height origin is 1.3 m up.
    expect(intro[0].eye.distanceTo(chase[0].eye), 'countdown keeps player view').toBeLessThan(1e-6);
    expect(intro[0].eye.z, 'camera remains behind player').toBeLessThan(0);

    let worst = 0;
    for (let i = 1; i < intro.length; i++) worst = Math.max(worst, intro[i].eye.distanceTo(intro[i - 1].eye));
    expect(worst, `the eye moved ${worst.toFixed(2)} m in one frame`).toBeLessThan(.5);
  });

  it('can be cut short, and eases back rather than cutting', () => {
    const chase = countdown(0), cut = countdown(3, 60);
    let worst = 0;
    for (let i = 1; i < cut.length; i++) worst = Math.max(worst, cut[i].eye.distanceTo(cut[i - 1].eye));
    expect(worst, `the eye moved ${worst.toFixed(2)} m in one frame`).toBeLessThan(.5);
    // Back on the chase shot within a couple of seconds of the interruption.
    const eye = cut[180].eye.distanceTo(chase[180].eye);
    expect(eye, `two seconds on, the eye was still ${eye.toFixed(2)} m off the chase shot`).toBeLessThan(.15);
  });
});

describe('player ownership through round transitions', () => {
  it('keeps the player framed and clear of walls when another fighter wins', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
    const follow = new FollowCamera(camera);
    const me = actor('me'), winner = actor('foe', 0, 3);
    const mat = new THREE.MeshBasicMaterial();
    const walls = [2.4, -2.4].map(x => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 12, 30), mat);
      wall.position.set(x + Math.sign(x) * .5, 6, 3); wall.updateMatrixWorld(true); return wall;
    });
    for (let i = 0; i < 120; i++) follow.update(1 / 60, me, 0, 0, walls, 0, winner, true);
    const before = camera.position.clone();
    follow.victory(winner, 4);
    for (let i = 0; i < 240; i++) {
      follow.update(1 / 60, me, 0, 0, walls, 0, winner, true);
      for (const y of [.05, 1.05, 1.85]) {
        const point = new THREE.Vector3(me.group.position.x, y, me.group.position.z).project(camera);
        expect(Math.abs(point.x)).toBeLessThan(.9);
        expect(Math.abs(point.y)).toBeLessThan(.9);
      }
      expect(camera.position.distanceTo(before)).toBeLessThan(.001);
      expect(Math.abs(camera.position.x)).toBeLessThan(2.4);
      expect(follow.yaw).toBe(0);
      expect(camera.fov).toBeCloseTo(50, 5);
    }
  });

  it('hands back to ordinary tracking through the smoothers when the window ends', () => {
    const run = (orbit: boolean) => {
      const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
      const follow = new FollowCamera(camera);
      const me = actor('me'), foe = actor('foe', .3, 3.2);
      foe.group.rotation.y = Math.PI;
      for (let i = 0; i < 120; i++) follow.update(1 / 60, me, 0, 0, [], 0, foe, true);
      if (orbit) follow.victory(foe, 2);
      const eyes: THREE.Vector3[] = [];
      for (let i = 0; i < 360; i++) { follow.update(1 / 60, me, 0, 0, [], 0, foe, true); eyes.push(camera.position.clone()); }
      return eyes;
    };
    const chase = run(false), victory = run(true);
    // The orbit is somewhere else entirely, and the way back is not a cut.
    expect(victory[60].distanceTo(chase[60])).toBeLessThan(1e-6);
    let worst = 0;
    for (let i = 121; i < victory.length; i++) worst = Math.max(worst, victory[i].distanceTo(victory[i - 1]));
    expect(worst, `the eye moved ${worst.toFixed(2)} m in one frame on the way back`).toBeLessThan(.6);
    const eye = victory[300].distanceTo(chase[300]);
    expect(eye, `three seconds on, the eye was still ${eye.toFixed(2)} m off the chase shot`).toBeLessThan(.15);
  });
});
