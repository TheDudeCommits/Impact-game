import { afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { setAbOff, type AbName } from '../src/render/look/abSwitch';
import { drawings, drawnOnOnes, freshDrawing, holdDrawings } from '../src/render/look/filmDrawings';
import { DREAM_IMPACT } from '../src/render/dreamFlag';
import { Fighter, zoneHurt } from '../src/render/Fighter';
import { SecondaryMotion } from '../src/render/SecondaryMotion';
import { setVfxLevel } from '../src/render/vfxLevel';
import type { PlayerState } from '../src/game/types';
import { popBase } from './popHarness';
import { allPops, buildBody, victimRun, type Press } from './reactHarness';

/** The second feel batch (19 November 2026; look/abSwitch.ts `onones`, `hitflash`, `posesnap`, `hitzone`, `settle`,
 *  `hairhit`): each change, and each switch giving back the game as it was. */
const MINE: AbName[] = ['onones', 'hitflash', 'posesnap', 'hitzone', 'settle', 'hairhit'];
const only = (off: AbName[]) => { for (const name of MINE) setAbOff(name, off.includes(name)); };
afterAll(() => only([]));
type Private = Record<string, unknown>;

describe('onones: a body in a move or a reaction posed on every frame, the rest on the film look\'s twelve', () => {
  const body = (name: string) => { const group = new THREE.Group(); group.name = name; const bone = new THREE.Bone(); group.add(bone); return { group, bone }; };
  it('the fighting body every frame, the neutral one held on the grid, and back in neutral never a step back', () => {
    only([]);
    expect(drawings.cadence).toBe(12);
    const scene = new THREE.Scene(), fighting = body('fighter-a'), standing = body('fighter-b');
    scene.add(fighting.group, standing.group);
    let t = 10;
    const frame = (angle: number) => { fighting.bone.rotation.z = standing.bone.rotation.z = angle; holdDrawings(scene, t); t += 1 / 60; return [fighting.bone.rotation.z, standing.bone.rotation.z]; };
    freshDrawing();
    drawnOnOnes(fighting.group, true);
    const shown = Array.from({ length: 10 }, (_, i) => frame(i / 10));
    // Five frames a drawing at sixty: the standing body shows the drawing's first frame until the next.
    for (let i = 0; i < 10; i++) { expect(shown[i][0]).toBeCloseTo(i / 10, 6); expect(shown[i][1]).toBeCloseTo(i < 5 ? 0 : .5, 6); }
    // Back in neutral mid-drawing (frame 12 of the grid): posed as it stands until the next drawing, held from there.
    shown.push(frame(1), frame(1.1));
    drawnOnOnes(fighting.group, false);
    const back = Array.from({ length: 6 }, (_, i) => frame(1.2 + i / 10));
    expect(back.map(r => +r[0].toFixed(3))).toEqual([1.2, 1.3, 1.4, 1.5, 1.5, 1.5]);
    // `?ab=onones`: on the grid, as before.
    setAbOff('onones', true);
    drawnOnOnes(fighting.group, true);
    freshDrawing();
    const old = Array.from({ length: 6 }, (_, i) => frame(2 + i / 10));
    expect(old.map(r => +r[0].toFixed(3))).toEqual([2, 2, 2, 2, 2, 2.5]);
    drawnOnOnes(fighting.group, false);
    only([]);
  });
});

/** A body taking one blow, drawn frame by frame at sixty: what `read` says on each frame. */
async function struckFrames<T>(id: Parameters<typeof buildBody>[0], detail: Record<string, unknown>, frames: number, read: (body: Fighter) => T) {
  const body = await buildBody(id, 'b');
  try {
    const idle = popBase(id, 'b');
    for (let i = 0; i < 20; i++) body.update(1 / 60, idle, true, 1 / 60);
    body.impact(true, 'heavy', 'melee', 0, new THREE.Vector3(0, 0, 1), 90, 1.05, { reaction: 'hurt', chain: 0, ...detail });
    const out: T[] = [];
    for (let i = 0; i < frames; i++) {
      const hurt: PlayerState = { ...idle, action: 'hurt', actionStarted: 0, actionDuration: .5, actionTime: (i + 1) / 60 / .5, hitstop: i < 3 };
      body.update(1 / 60, hurt, true, 1 / 60);
      out.push(read(body));
    }
    return out;
  } finally { body.dispose(); }
}

describe('hitflash: the flash two frames whole, then let go fast; a counter or a punish drawn in ink', () => {
  it('whole on the first two frames, under half on the third, gone by the eighth; the old flash held longer', async () => {
    only([]);
    const w = await struckFrames('taisei', {}, 10, body => body.flash.value.w);
    expect(w[0]).toBeGreaterThan(.05);
    expect(w[1]).toBeCloseTo(w[0], 6);
    expect(w[2] / w[0]).toBeGreaterThan(.3);
    expect(w[2] / w[0]).toBeLessThan(.45);
    expect(w[4] / w[0]).toBeLessThan(.1);
    expect(w[8]).toBe(0);
    only(['hitflash']);
    const old = await struckFrames('taisei', {}, 10, body => body.flash.value.w);
    expect(old[2] / old[0]).toBeGreaterThan(.7);
    only([]);
  }, 120_000);

  it('a counter or a punish: the fill near black and the line light for two frames, both let go after', async () => {
    only([]);
    const rows = await struckFrames('taisei', { reward: true }, 10, body => ({ fill: body.flash.value.clone(), line: body.inkFlash.value.clone() }));
    for (const r of rows.slice(0, 2)) {
      expect(Math.max(r.fill.x, r.fill.y, r.fill.z)).toBeLessThan(.06);
      expect(r.fill.w).toBeGreaterThan(.8);
      expect(Math.min(r.line.x, r.line.y, r.line.z)).toBeGreaterThan(.85);
      expect(r.line.w).toBeGreaterThan(.8);
    }
    expect(rows[2].fill.w / rows[0].fill.w).toBeLessThan(.45);
    expect(rows[8].fill.w).toBe(0);
    expect(rows[8].line.w).toBe(0);
    // The VISUAL EFFECTS levels still cut it.
    setVfxLevel('minimal');
    try {
      const minimal = await struckFrames('taisei', { reward: true }, 2, body => body.flash.value.w);
      expect(minimal[0]).toBeLessThan(rows[0].fill.w);
    } finally { setVfxLevel('full'); }
    // The switch off: a counter flashes white, as every blow did.
    only(['hitflash']);
    const old = await struckFrames('taisei', { reward: true }, 2, body => ({ fill: body.flash.value.clone(), line: body.inkFlash.value.w }));
    expect(Math.max(old[0].fill.x, old[0].fill.y, old[0].fill.z)).toBeGreaterThan(.5);
    expect(old[0].line).toBe(0);
    only([]);
  }, 120_000);
});

describe('hitzone: a standing body\'s reaction picked by where the blow lands as it is drawn', () => {
  it('the take for each place: back for the head, the fold for the body, a spin off a leg', () => {
    expect(zoneHurt('high', 1)).toBe('dream back');
    expect(zoneHurt('middle', -1)).toBe('dream fold');
    expect(zoneHurt('low', 1)).toBe('dream spin L');
    expect(zoneHurt('low', -1)).toBe('dream spin R');
  });

  it('a point at the head, the chest, the waist and the knee is high, middle, middle and low; far off, no part', async () => {
    const body = await buildBody('ouga', 'b');
    try {
      const idle = popBase('ouga', 'b');
      for (let i = 0; i < 20; i++) body.update(1 / 60, idle, true, 1 / 60);
      body.group.updateMatrixWorld(true);
      const zoneAt = (p: THREE.Vector3) => (body as unknown as { zoneAt(p: THREE.Vector3, out: { zone: string; gap: number }): { zone: string; gap: number } }).zoneAt(p, { zone: '', gap: 0 });
      const at = (name: string) => body.joints.get(name)!.getWorldPosition(new THREE.Vector3());
      const front = (p: THREE.Vector3, by = .12) => p.add(new THREE.Vector3(0, 0, by));
      expect(zoneAt(front(at('Head').add(new THREE.Vector3(0, .08, 0)), .12)).zone).toBe('high');
      expect(zoneAt(front(at('Spine2'))).zone).toBe('middle');
      expect(zoneAt(front(at('Hips').add(new THREE.Vector3(0, .05, 0)))).zone).toBe('middle');
      expect(zoneAt(front(at('LeftLeg'), .06)).zone).toBe('low');
      expect(zoneAt(at('Head').add(new THREE.Vector3(0, 0, 3))).gap).toBeGreaterThan(.6);
    } finally { body.dispose(); }
  }, 120_000);

  it.runIf(DREAM_IMPACT)('a string drawn by where its blows land: more than one take, and never a jump of a frame', async () => {
    only([]);
    const STRING: Press[] = [0, 9, 18, 27].map(t => ({ tick: 30 + t, attack: 'light' }));
    const victim = await buildBody('ouga', 'b'), attacker = await buildBody('taisei', 'a');
    try {
      const { samples } = victimRun(victim, attacker, STRING, 230, { seed: 7 });
      expect(allPops(samples).map(p => `${p.key} ${p.cm} cm ${p.action} ${p.clip}`)).toEqual([]);
      const zones = ((victim as unknown as Private).hits as { zone?: string }[]).map(h => h.zone).filter(Boolean);
      expect(zones.length).toBeGreaterThan(1);
      const takes = new Set(samples.filter(s => s.action === 'hurt').map(s => s.clip));
      expect(takes.size).toBeGreaterThan(1);
    } finally { victim.dispose(); attacker.dispose(); }
  }, 180_000);
});

describe('posesnap: a big blow struck over three frames, and a body thrown off the floor starts as it lay', () => {
  it('a big blow on a body on its feet: a crisp first key, three frames long; the switch off, one frame', async () => {
    const first = async (off: AbName[]) => {
      only(off);
      return (await struckFrames('ouga', { big: true }, 1, body => ({ blend: body.motionEvidence().blend, out: (body as unknown as Private).blendOut })))[0];
    };
    const now = await first([]);
    expect(now.blend).toBeCloseTo(1 / 3, 2);
    expect(now.out).toBe(true);
    const before = await first(['posesnap']);
    expect(before.blend).toBe(1);
    only([]);
  }, 120_000);

  /** A body lying on the floor, then a big blow throws it up: its hips-to-neck pitch (radians off upright) on the frame
   *  before the blow and each frame after it, and what the launch layer took for its start. */
  async function relaunch() {
    const body = await buildBody('ouga', 'b');
    try {
      const idle = popBase('ouga', 'b'), v = body as unknown as Private;
      const pitch = () => { const hips = body.joints.get('Hips')!.getWorldPosition(new THREE.Vector3()), neck = body.joints.get('Neck')!.getWorldPosition(new THREE.Vector3()).sub(hips); return Math.atan2(Math.hypot(neck.x, neck.z), neck.y); };
      for (let i = 0; i < 20; i++) body.update(1 / 60, idle, true, 1 / 60);
      const down: PlayerState = { ...idle, action: 'knockdown', actionDuration: 1.5, grounded: true };
      for (let i = 0; i < 50; i++) body.update(1 / 60, { ...down, actionTime: i / 60 / 1.5 }, true, 1 / 60);
      const pitches = [pitch()];
      body.impact(true, 'heavy', 'melee', 0, new THREE.Vector3(0, .4, 1), 90, .3, { reaction: 'launched', chain: 0, big: true, downed: true });
      const start = { drawn: v.launchFromDrawn as number, turns: v.launchTurns as number };
      for (let i = 0; i < 12; i++) {
        const up: PlayerState = { ...idle, action: 'launched', actionDuration: 1, actionTime: (i + 1) / 60, grounded: false, y: .05 + i * .06, hitstop: i < 2 };
        body.update(1 / 60, up, true, 1 / 60);
        pitches.push(pitch());
      }
      return { pitches, ...start };
    } finally { body.dispose(); }
  }
  it('lying flat when the blow lands, it flies as it lay; the switch off, it was turned over on its way', async () => {
    only([]);
    const now = await relaunch();
    const step = (p: number[]) => Math.max(...p.slice(1).map((v, i) => Math.abs(v - p[i])));
    expect(now.pitches[0]).toBeGreaterThan(1.1);
    expect(Math.abs(now.drawn)).toBeGreaterThan(1.1);
    expect(now.turns).toBe(0);
    // Never more than a fifth of a turn in a frame, and still lying a fifth of a second on.
    expect(step(now.pitches)).toBeLessThan(.35);
    expect(Math.abs(now.pitches[12] - now.pitches[0])).toBeLessThan(.3);
    only(['posesnap']);
    const before = await relaunch();
    expect(Number.isNaN(before.drawn)).toBe(true);
    expect(before.turns).toBe(1);
    expect(Math.abs(before.pitches[12] - before.pitches[0])).toBeGreaterThan(Math.abs(now.pitches[12] - now.pitches[0]) + .3);
    only([]);
  }, 180_000);
});

describe('settle: a knocked-down body settles onto the floor', () => {
  const HEAVY: Press[] = [{ tick: 30, attack: 'heavy' }];
  it.runIf(DREAM_IMPACT)('a small rebound, limbs held up as they fall, never a jump of a frame', async () => {
    const run = async (off: AbName[]) => {
      only(off);
      const victim = await buildBody('ouga', 'b'), attacker = await buildBody('taisei', 'a');
      const v = victim as unknown as Private;
      let bounce = 0, held = 0;
      const update = victim.update.bind(victim);
      victim.update = (dt, state, interpolated, real) => {
        update(dt, state, interpolated, real);
        bounce = Math.max(bounce, v.bounceDrawn as number);
        if ((v.settleAt as number) >= 0) held++;
      };
      try {
        const { samples } = victimRun(victim, attacker, HEAVY, 360, { seed: 7 });
        return { bounce, held, pops: allPops(samples).map(p => `${p.key} ${p.cm} cm ${p.action} ${p.clip}`), lay: samples.some(s => s.action === 'knockdown' && s.grounded) };
      } finally { victim.dispose(); attacker.dispose(); }
    };
    const now = await run([]);
    expect(now.lay).toBe(true);
    expect(now.pops).toEqual([]);
    expect(now.bounce).toBeLessThanOrEqual(.08 + 1e-6);
    expect(now.held).toBeGreaterThan(10);
    const before = await run(['settle']);
    expect(before.bounce).toBeGreaterThan(.1);
    expect(before.held).toBe(0);
    only([]);
  }, 240_000);
});

describe('hairhit: hair and cloth pushed along the blow, and settling', () => {
  it('a push swings the chains and they come back to rest; a huge one stays finite, inside its cone', async () => {
    const body = await buildBody('ouga', 'b');
    try {
      const springs = (body as unknown as Private).secondary as SecondaryMotion;
      expect(springs.boneCount).toBeGreaterThan(0);
      const idle = popBase('ouga', 'b');
      for (let i = 0; i < 90; i++) body.update(1 / 60, idle, true, 1 / 60);
      const rest = springs.swingDegrees;
      springs.kick(new THREE.Vector3(0, .3, 2.4));
      let most = rest;
      for (let i = 0; i < 20; i++) { body.update(1 / 60, idle, true, 1 / 60); most = Math.max(most, springs.swingDegrees); }
      expect(most).toBeGreaterThan(rest + 3);
      for (let i = 0; i < 120; i++) body.update(1 / 60, idle, true, 1 / 60);
      expect(springs.swingDegrees).toBeLessThan(rest + 2);
      springs.kick(new THREE.Vector3(0, 0, 500));
      for (let i = 0; i < 30; i++) { body.update(1 / 60, idle, true, 1 / 60); expect(Number.isFinite(springs.swingDegrees)).toBe(true); expect(springs.swingDegrees).toBeLessThan(90); }
    } finally { body.dispose(); }
  }, 120_000);

  it('a struck body\'s springs run through its blow\'s freeze, held in their cones; the switch off, they held still', async () => {
    const swing = async (off: AbName[]) => {
      only(off);
      return struckFrames('ouga', {}, 3, body => { const springs = (body as unknown as Private).secondary as SecondaryMotion; return { swing: springs.swingDegrees, kicked: ((springs as unknown as Private).kicked as THREE.Vector3).length() }; });
    };
    const now = await swing([]), before = await swing(['hairhit']);
    // The push spent on the first frame of the freeze, the chains moving and inside their cones throughout.
    expect(now.every(r => r.kicked === 0)).toBe(true);
    expect(Math.max(...now.map(r => r.swing))).toBeLessThan(40);
    expect(Math.max(...now.map(r => r.swing)) - Math.min(...now.map(r => r.swing))).toBeGreaterThan(.5);
    // The switch off: no push, and the frozen chains left where they were in the world while the body moved under them.
    expect(before.every(r => r.kicked === 0)).toBe(true);
    only([]);
  }, 120_000);
});
