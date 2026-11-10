import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BallChase, type ChaseFrame } from './BallChase';
import { GOAL_RULES } from '../../game/ball/model';

/** Goal Rush's ball cam rig: behind you along the heading, sprung, tilted after high balls, inside the walls,
 *  closer and lower on the opponent locked in the FIGHT stance. */
const camera = () => new THREE.PerspectiveCamera(64, 16 / 9, .1, 500);
const frame = (o: Partial<ChaseFrame> = {}): ChaseFrame => ({ self: new THREE.Vector3(), heading: 0, ball: new THREE.Vector3(0, .8, 10), fight: false, mode: 'goal-rush', boosting: false, shake: 0, ...o });
const run = (rig: BallChase, cam: THREE.PerspectiveCamera, f: ChaseFrame, frames: number, on = true) => { for (let i = 0; i < frames; i++) rig.aim(cam, 1 / 60, on, f); };
const look = (cam: THREE.PerspectiveCamera) => { const d = new THREE.Vector3(); cam.getWorldDirection(d); return { yaw: Math.atan2(d.x, d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }; };
/** Whether a point is inside the lens's frame (with a margin, as a share of the half-frame). */
function seen(cam: THREE.PerspectiveCamera, p: THREE.Vector3, margin = .95) {
  const v = p.clone().project(cam);
  return v.z < 1 && Math.abs(v.x) < margin && Math.abs(v.y) < margin;
}
const R = GOAL_RULES;
/** The share of the frame's centre line (bottom up) that is the pitch's floor, inside its walls and goal mouths. */
function floorShare(cam: THREE.PerspectiveCamera) {
  const v = new THREE.Vector3(), o = cam.position, deep = R.halfZ + R.goalDepth;
  let floor = 0;
  for (let i = 0; i < 30; i++) {
    v.set(0, -1 + (i + .5) / 15, .5).unproject(cam).sub(o).normalize();
    const tx = Math.abs(v.x) > 1e-6 ? ((v.x > 0 ? R.halfX : -R.halfX) - o.x) / v.x : Infinity, tz = Math.abs(v.z) > 1e-6 ? ((v.z > 0 ? deep : -deep) - o.z) / v.z : Infinity;
    if (v.y < 0 && -o.y / v.y < Math.min(tx, tz)) floor++;
  }
  return floor / 30;
}
const inside = (p: THREE.Vector3) => (Math.abs(p.z) <= R.halfZ - .5 || (Math.abs(p.x) < R.goalHalfWidth && p.y < R.goalHeight)) && Math.abs(p.x) <= R.halfX - .5
  && Math.abs(p.x) + Math.abs(p.z) <= R.halfX + R.halfZ - R.corner;

describe("Goal Rush's ball cam rig", () => {
  it('stands behind you along the heading, a little over the shoulder, and looks along it with you and the ball in frame', () => {
    const rig = new BallChase(), cam = camera(), f = frame();
    run(rig, cam, f, 90);
    expect(rig.active).toBe(true);
    expect(cam.position.z).toBeLessThan(-4.5);
    expect(cam.position.y).toBeGreaterThan(2.5);
    expect(Math.abs(look(cam).yaw)).toBeLessThan(.12);
    expect(look(cam).pitch).toBeLessThan(0);
    expect(seen(cam, new THREE.Vector3(0, 1.1, 0))).toBe(true);
    expect(seen(cam, f.ball as THREE.Vector3)).toBe(true);
    expect(rig.yaw).toBeCloseTo(look(cam).yaw, 1);
  });
  it('never jumps: a heading that turns, a body that runs at the boost, each moves the lens smoothly', () => {
    const rig = new BallChase(), cam = camera(), f = frame({ self: new THREE.Vector3(0, 0, 3), heading: Math.PI / 2, ball: new THREE.Vector3(10, .8, 3) });
    run(rig, cam, f, 60);
    let last = cam.position.clone(), worst = 0;
    // Round a ring of 9 m at the boost's speed, the heading turning after the ball ahead.
    for (let i = 0; i < 240; i++) {
      const a = i * 13.5 / 60 / 9;
      f.self.set(Math.sin(a) * 9, 0, Math.cos(a) * 9 - 6); f.heading = a + Math.PI / 2;
      (f.ball as THREE.Vector3).set(f.self.x + Math.sin(f.heading) * 10, .8, f.self.z + Math.cos(f.heading) * 10);
      rig.aim(cam, 1 / 60, true, f);
      worst = Math.max(worst, cam.position.distanceTo(last) - 13.5 / 60); last = cam.position.clone();
    }
    expect(worst).toBeLessThan(.45);
  });
  it('frames a high ball by standing back, up and wider - the ball, your chest and the pitch all in the frame', () => {
    const rig = new BallChase(), cam = camera(), f = frame({ ball: new THREE.Vector3(0, 1, 12) });
    run(rig, cam, f, 60);
    const flat = look(cam).pitch, rest = cam.position.clone(), restFov = cam.fov;
    (f.ball as THREE.Vector3).set(0, 14, 9);
    run(rig, cam, f, 90);
    expect(look(cam).pitch).toBeGreaterThan(flat);
    expect(seen(cam, f.ball as THREE.Vector3)).toBe(true);
    expect(seen(cam, new THREE.Vector3(0, 1.15, 0), 1)).toBe(true);
    // The lens stood back, a little up and opened, rather than tilting into the roof...
    expect(cam.position.z).toBeLessThan(rest.z - 2);
    expect(cam.position.y).toBeGreaterThan(rest.y);
    expect(cam.fov).toBeGreaterThan(restFov + 6);
    // ...so the pitch keeps a good share of the frame.
    expect(floorShare(cam)).toBeGreaterThan(.25);
  });
  it('keeps the pitch in the frame through a lob dropping over you, never mostly roof', () => {
    const rig = new BallChase(), cam = camera(), f = frame({ ball: new THREE.Vector3(0, .8, 6) });
    run(rig, cam, f, 60);
    const ball = f.ball as THREE.Vector3, v = new THREE.Vector3(0, 17, -5);
    let worst = 1, top = -1;
    for (let i = 0; i < 150; i++) {
      v.y -= 13 / 60; ball.addScaledVector(v, 1 / 60); if (ball.y < .8) { ball.y = .8; v.y = Math.abs(v.y) * .6; }
      if (Math.hypot(ball.x, ball.z) > 2.5) f.heading = Math.atan2(ball.x, ball.z);
      rig.aim(cam, 1 / 60, true, f);
      worst = Math.min(worst, floorShare(cam)); top = Math.max(top, look(cam).pitch);
    }
    // (A rig tilting 22 degrees up into the roof would leave none of the pitch at the lob's top.)
    expect(worst).toBeGreaterThan(.18);
    expect(top).toBeLessThan(.1);
  });
  it('keeps inside the walls wherever you stand and whichever way you face, and lets a keeper be filmed from the goal mouth, under the bar', () => {
    const rig = new BallChase(), cam = camera();
    for (const [x, z] of [[0, R.halfZ - .6], [R.halfX - .5, 0], [R.halfX - 1, R.halfZ - 4.5], [-R.halfX + .8, -R.halfZ + 5], [6, -R.halfZ + .5], [0, 0]])
      for (let k = 0; k < 8; k++) {
        const f = frame({ self: new THREE.Vector3(x, 0, z), heading: k * Math.PI / 4 });
        f.ball = new THREE.Vector3(x + Math.sin(f.heading) * 8, .8, z + Math.cos(f.heading) * 8);
        rig.cut(); run(rig, cam, f, 120);
        expect(Number.isFinite(cam.position.x + cam.position.y + cam.position.z)).toBe(true);
        expect(inside(cam.position), `at ${x},${z} facing ${k}: ${cam.position.toArray().map(n => n.toFixed(2))}`).toBe(true);
        // Never on top of you: there is a boom's worth of room between you and the lens along the floor.
        expect(Math.hypot(cam.position.x - x, cam.position.z - z), `at ${x},${z} facing ${k}`).toBeGreaterThan(2.4);
      }
    // A keeper on their own line, facing up the pitch: the lens in the goal's mouth behind them, under the bar.
    const f = frame({ self: new THREE.Vector3(0, 0, -R.halfZ + 1.2), heading: 0, ball: new THREE.Vector3(0, .8, -10) });
    rig.cut(); run(rig, cam, f, 120);
    expect(cam.position.z).toBeLessThan(-R.halfZ + .2);
    expect(cam.position.y).toBeLessThan(R.goalHeight);
    expect(Math.abs(look(cam).yaw)).toBeLessThan(.2);
  });
  it('never flips in and out of the goal mouth as a keeper steps along the line', () => {
    // (From a stride and a half outside one post to as far outside the other: the goal's width, whatever the pitch.)
    const out = R.goalHalfWidth + 1.4;
    const rig = new BallChase(), cam = camera(), f = frame({ self: new THREE.Vector3(-out, 0, -R.halfZ + 1.4), heading: 0, ball: new THREE.Vector3(0, .8, -8) });
    run(rig, cam, f, 60);
    let last = cam.position.clone(), worst = 0;
    for (let i = 0; i < 360; i++) {
      f.self.x = -out + 2 * out * i / 360; f.heading = Math.sin(i / 40) * .3;
      rig.aim(cam, 1 / 60, true, f);
      worst = Math.max(worst, cam.position.distanceTo(last)); last = cam.position.clone();
    }
    expect(worst).toBeLessThan(.25);
  });
  it('frames the FIGHT stance closer, lower and narrower than the ball', () => {
    const ball = new BallChase(), fight = new BallChase(), a = camera(), b = camera();
    run(ball, a, frame(), 120);
    run(fight, b, frame({ fight: true, ball: new THREE.Vector3(0, 0, 4) }), 120);
    expect(b.position.distanceTo(new THREE.Vector3())).toBeLessThan(a.position.distanceTo(new THREE.Vector3()));
    expect(b.position.y).toBeLessThan(a.position.y);
    expect(b.fov).toBeLessThan(a.fov);
    expect(seen(b, new THREE.Vector3(0, 1.5, 4))).toBe(true);
  });
  it('hands the view over with a blend, never a cut, when it lets go and takes it back', () => {
    const rig = new BallChase(), cam = camera(), f = frame();
    run(rig, cam, f, 60);
    const held = cam.position.clone();
    // Letting go: the follow camera's frame (here, somewhere else) is eased into.
    cam.position.set(20, 9, 20); rig.aim(cam, 1 / 60, false, f);
    expect(cam.position.distanceTo(held)).toBeLessThan(2);
    for (let i = 0; i < 40; i++) { cam.position.set(20, 9, 20); rig.aim(cam, 1 / 60, false, f); }
    expect(cam.position.distanceTo(new THREE.Vector3(20, 9, 20))).toBeLessThan(.01);
  });
  it('punches the lens a touch and shakes it on a moment, then settles back', () => {
    const rig = new BallChase(), cam = camera(), f = frame({ shake: 1 });
    run(rig, cam, f, 60);
    const fov = cam.fov;
    rig.impact(.8, undefined, 2); rig.aim(cam, 1 / 60, true, f);
    expect(cam.fov).toBeLessThan(fov - 1);
    run(rig, cam, f, 90);
    expect(cam.fov).toBeCloseTo(fov, 1);
  });
});

/**
 * The CLOSE lens, an option (ballCamChoice.ts; the classic rig's own numbers are held by
 * camDefaults.test.ts). What it must do: show every body larger from the same rig - a narrower lens, stood a little
 * higher - and give the classic frame back whenever that is what holds the ball, a high ball or the nearest goal.
 */
describe("Goal Rush's CLOSE lens (an option)", () => {
  const close = () => { const rig = new BallChase(); rig.style = 'close'; return rig; };
  const tall = (cam: THREE.PerspectiveCamera, p: THREE.Vector3, h = 1.8) => (p.clone().setY(p.y + h).project(cam).y - p.clone().project(cam).y) / 2 * 1080;
  /** A point's place across the frame (-1 left edge .. 1 right edge), or NaN behind the lens. */
  const across = (cam: THREE.PerspectiveCamera, p: THREE.Vector3) => { const v = p.clone().project(cam); return v.z < 1 ? v.x : NaN; };

  it('is the same rig on a lens seven degrees narrower, stood half a metre higher: every body about a seventh larger', () => {
    const a = camera(), b = camera(), f = frame();
    run(new BallChase(), a, f, 120); const rig = close(); run(rig, b, f, 120);
    expect(rig.tight).toBe(1);
    expect(b.fov).toBeCloseTo(a.fov - 7, 3);
    expect(b.position.y).toBeCloseTo(a.position.y + .5, 2);
    // The same boom, shoulder and heading.
    expect(b.position.x).toBeCloseTo(a.position.x, 2); expect(b.position.z).toBeCloseTo(a.position.z, 2);
    expect(look(b).yaw).toBeCloseTo(look(a).yaw, 3);
    // You, a team-mate a stride ahead, an opponent at mid-distance and one far off: each larger, none lost.
    for (const p of [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-3, 0, 5), new THREE.Vector3(4, 0, 12), new THREE.Vector3(-6, 0, 24)]) {
      expect(tall(b, p) / tall(a, p), `a body at ${p.toArray()}`).toBeGreaterThan(1.08);
      expect(seen(b, p.clone().setY(1.1), 1)).toBe(true);
    }
    expect(tall(b, new THREE.Vector3(4, 0, 12)) / tall(a, new THREE.Vector3(4, 0, 12))).toBeGreaterThan(1.13);
    // You and the ball share the frame, your whole body in it.
    expect(seen(b, f.ball as THREE.Vector3)).toBe(true);
    expect(seen(b, new THREE.Vector3(0, 0, 0), 1)).toBe(true); expect(seen(b, new THREE.Vector3(0, 1.9, 0), 1)).toBe(true);
  });

  it("keeps the high-ball frame: under a lofted ball it is the classic rig's own frame, to the millimetre", () => {
    const a = camera(), b = camera(), f = frame({ ball: new THREE.Vector3(0, 1, 12) }), rig = close();
    run(new BallChase(), a, f, 60); run(rig, b, f, 60);
    expect(rig.tight).toBe(1);
    (f.ball as THREE.Vector3).set(0, 14, 9);
    const classic = new BallChase(); run(classic, a, frame({ ball: new THREE.Vector3(0, 1, 12) }), 60); run(classic, a, f, 150); run(rig, b, f, 150);
    expect(rig.tight).toBe(0);
    expect(b.position.distanceTo(a.position)).toBeLessThan(.01); expect(b.fov).toBeCloseTo(a.fov, 2); expect(look(b).pitch).toBeCloseTo(look(a).pitch, 3);
    // The classic test's own demands, of this lens.
    expect(seen(b, f.ball as THREE.Vector3)).toBe(true);
    expect(seen(b, new THREE.Vector3(0, 1.15, 0), 1)).toBe(true);
    expect(floorShare(b)).toBeGreaterThan(.25);
  });

  it('never loses a ball the classic frame holds as it climbs, and keeps the pitch in the frame through a lob', () => {
    // A ball rising slowly ahead of you, from the floor to twelve metres: at every height the classic frame holds it, so does this one.
    const a = camera(), b = camera(), f = frame({ ball: new THREE.Vector3(0, .8, 10) }), classic = new BallChase(), rig = close();
    run(classic, a, f, 60); run(rig, b, f, 60);
    const ball = f.ball as THREE.Vector3;
    for (let i = 0; i < 600; i++) {
      ball.y = .8 + i / 600 * 11.2;
      classic.aim(a, 1 / 60, true, f); rig.aim(b, 1 / 60, true, f);
      if (seen(a, ball, .98)) expect(seen(b, ball, 1), `a ball at ${ball.y.toFixed(1)} m`).toBe(true);
    }
    // The classic rig's lob, through this lens: the pitch keeps its share and the view never tilts into the roof.
    const lob = close(), cam = camera(), g = frame({ ball: new THREE.Vector3(0, .8, 6) }), drop = g.ball as THREE.Vector3, v = new THREE.Vector3(0, 17, -5);
    run(lob, cam, g, 60);
    let worst = 1, top = -1;
    for (let i = 0; i < 150; i++) {
      v.y -= 13 / 60; drop.addScaledVector(v, 1 / 60); if (drop.y < .8) { drop.y = .8; v.y = Math.abs(v.y) * .6; }
      if (Math.hypot(drop.x, drop.z) > 2.5) g.heading = Math.atan2(drop.x, drop.z);
      lob.aim(cam, 1 / 60, true, g);
      worst = Math.min(worst, floorShare(cam)); top = Math.max(top, look(cam).pitch);
    }
    expect(worst).toBeGreaterThan(.18);
    expect(top).toBeLessThan(.1);
  });

  it('never loses a ball the classic frame holds as it runs across the frame or in toward your feet: its lens opens first', () => {
    for (const [what, step] of [['to the left', [3, 0]], ['to the right', [-3, 0]], ['in toward you', [0, -3.5]], ['across and in', [2.2, -2.2]]] as const) {
      const a = camera(), b = camera(), f = frame({ ball: new THREE.Vector3(0, .8, 9) }), classic = new BallChase(), rig = close(), ball = f.ball as THREE.Vector3;
      run(classic, a, f, 60); run(rig, b, f, 60);
      let held = 0, lost = 0, opened = 1;
      for (let i = 0; i < 360; i++) {
        ball.x += step[0] / 60; ball.z = Math.max(.4, ball.z + step[1] / 60);
        classic.aim(a, 1 / 60, true, f); rig.aim(b, 1 / 60, true, f);
        if (seen(a, ball, .97)) { held++; if (!seen(b, ball, 1)) lost++; }
        opened = Math.min(opened, rig.tight);
      }
      // (A ball the classic frame holds, this one holds too: running out of a side, by taking the classic lens back first;
      // coming in, the rig's own pull in and up keeps it in both.)
      expect(held, what).toBeGreaterThan(20); expect(lost, what).toBe(0);
      if (step[1] === 0) expect(opened, what).toBeLessThan(.5);
    }
  });

  it('never loses a goal the classic frame holds: its lens opens as a goal nears the frame\'s side', () => {
    const mouth = new THREE.Vector3(0, 1.5, R.halfZ);
    let opened = 0, held = 0;
    // From all over the attacking half, facing every way that has the goal somewhere in the classic frame.
    for (const x of [-10, -5, 0, 4, 9]) for (const z of [0, 6, 11, 15]) for (let k = -6; k <= 6; k++) {
      const heading = Math.atan2(-x, R.halfZ - z) + k * .15;
      const f = frame({ self: new THREE.Vector3(x, 0, z), heading }); f.ball = new THREE.Vector3(x + Math.sin(heading) * 7, .8, z + Math.cos(heading) * 7);
      const a = camera(), b = camera(), rig = close();
      run(new BallChase(), a, f, 100); run(rig, b, f, 100);
      const there = across(a, mouth);
      if (!(Math.abs(there) < .93)) continue;
      held++;
      expect(Math.abs(across(b, mouth)), `from ${x},${z} facing ${k}: the classic frame has the goal at ${there.toFixed(2)}`).toBeLessThan(1);
      if (rig.tight < .5) opened++;
    }
    // (Most of the time the goal is well inside and the lens stays close; near the frame's side it has opened.)
    expect(held).toBeGreaterThan(100); expect(opened).toBeGreaterThan(8); expect(opened).toBeLessThan(held * .4);
  });

  it("leaves the FIGHT stance's framing alone, and stays inside the walls as the classic rig does", () => {
    const a = camera(), b = camera(), fight = frame({ fight: true, ball: new THREE.Vector3(0, 0, 4) }), rig = close();
    run(new BallChase(), a, fight, 120); run(rig, b, fight, 120);
    expect(rig.tight).toBe(0);
    expect(b.position.distanceTo(a.position)).toBeLessThan(1e-9); expect(b.fov).toBe(a.fov);
    for (const [x, z] of [[0, R.halfZ - .6], [R.halfX - .5, 0], [R.halfX - 1, R.halfZ - 4.5], [-R.halfX + .8, -R.halfZ + 5], [6, -R.halfZ + .5]])
      for (let k = 0; k < 8; k++) {
        const f = frame({ self: new THREE.Vector3(x, 0, z), heading: k * Math.PI / 4 });
        f.ball = new THREE.Vector3(x + Math.sin(f.heading) * 8, .8, z + Math.cos(f.heading) * 8);
        rig.cut(); run(rig, b, f, 120);
        expect(inside(b.position), `at ${x},${z} facing ${k}: ${b.position.toArray().map(n => n.toFixed(2))}`).toBe(true);
        expect(Math.hypot(b.position.x - x, b.position.z - z), `at ${x},${z} facing ${k}`).toBeGreaterThan(2.4);
      }
  });

  it("keeps the far goal's bar under the banner's place (ui/hud/ballHud.css) and your feet over the stance badge, as the classic lens does", () => {
    // (The HUD's own test, ui/hud/ballBanner.test.ts, holds the classic lens to the banner: from the kickoff to five metres
    // out from their line, a ball on the floor ahead of you and a high one. A tighter lens tilted further put the bar in it.)
    const css = readFileSync(new URL('../../ui/hud/ballHud.css', import.meta.url), 'utf8'), rule = css.slice(css.indexOf('{--bh-red'), css.indexOf('@supports'));
    const n = (name: string) => Number(new RegExp(`--bh-${name}:([\\d.]+)[;}]`).exec(rule)![1]), vh = Number(/([\d.]+)vh/.exec(/--bh-u:min\(([^)]+)\)/.exec(rule)![1])![1]) / 100;
    const foot = (n('edge') + n('bug') + n('line-gap') + n('line') + n('banner-gap') + n('banner')) * vh;
    expect(foot).toBeGreaterThan(.2);
    const mouth = [-R.goalHalfWidth, 0, R.goalHalfWidth].flatMap(x => [0, R.goalHeight].map(y => new THREE.Vector3(x, y, R.halfZ)));
    const down = (cam: THREE.PerspectiveCamera, p: THREE.Vector3) => { const v = p.clone().project(cam); return v.z < 1 ? (1 - v.y) / 2 : Infinity; };
    for (const aspect of [16 / 9, 844 / 390, 957 / 1080, 1920 / 537]) for (const z of [-R.halfZ + 4, -10, 0, 8, 14, 18, R.halfZ - 5]) for (const by of [.8, 6]) {
      const lens = camera(), rig = close(), f = frame({ self: new THREE.Vector3(0, 0, z), ball: new THREE.Vector3(0, by, Math.min(R.halfZ - 1, z + 8)) });
      lens.aspect = aspect; lens.updateProjectionMatrix();
      run(rig, lens, f, 180);
      expect(Math.min(...mouth.map(p => down(lens, p))), `aspect ${aspect.toFixed(2)}, ${R.halfZ - z} m out, ball ${by} m up`).toBeGreaterThan(foot + .01);
      if (aspect > 1.5 && by < 1) expect(down(lens, f.self), `aspect ${aspect.toFixed(2)}, ${R.halfZ - z} m out: your feet`).toBeLessThan(.86);
    }
  });

  it('eases from one lens to the other when the option changes, never a jump', () => {
    const rig = new BallChase(), cam = camera(), f = frame();
    run(rig, cam, f, 90);
    const fov = cam.fov;
    let last = cam.position.clone(), lastFov = cam.fov, step = 0, turn = 0;
    rig.style = 'close';
    // (Taken over a second or so: a quarter of a second in, it has closed under a third of its seven degrees.)
    for (let i = 0; i < 360; i++) { rig.aim(cam, 1 / 60, true, f); step = Math.max(step, cam.position.distanceTo(last)); turn = Math.max(turn, Math.abs(cam.fov - lastFov)); last = cam.position.clone(); lastFov = cam.fov; if (i === 14) expect(fov - cam.fov).toBeLessThan(7 / 3); }
    expect(cam.fov).toBeCloseTo(fov - 7, 2);
    expect(step).toBeLessThan(.03); expect(turn).toBeLessThan(.5);
  });
});

