import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FollowCamera } from '../src/render/FollowCamera';
import { sightClearance } from '../src/render/CameraDirector';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES } from '../src/game/moves';
import { moveFor } from '../src/game/awakening';
import { rollerAt, ROLLER_TIMING } from '../src/render/signature/HourOfRuin';
import type { Fighter } from '../src/render/Fighter';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';

/**
 * Round 3b (CAMERA): the blind critic's ultimate framing - "cameras often sit
 * behind the victim or inside geometry", Ikazuchi Arrow "camera inside the
 * Guardian", Spring Tide "the giant fist hides the target for about 4 s",
 * Royal Aurora "a bot's torso fills about 40% of the frame", the main victim
 * leaving a multi-victim time stop's frame on the resume, the Hour of Ruin
 * hanging above the top of LORD ORO's shot - played through the real simulation
 * and the camera, frame by frame, the way main.ts drives them.
 */
type Body = Fighter & { state: PlayerState; model: { visible: boolean }; handR: THREE.Vector3 };
function body(state: PlayerState): Body {
  const group = new THREE.Group(); group.position.set(state.x, state.y, state.z);
  return { state: { ...state }, group, velocity: new THREE.Vector3(), model: { visible: true }, handR: new THREE.Vector3() } as unknown as Body;
}
/** What the client draws for a body this frame, as far as the camera cares:
 *  Spring Tide is thrown as Full Swell (Fighter shows the form for the
 *  middle of the ultimate, so drawnBulk sizes the shots for it), its fist
 *  raised off a hand 2.3 m up. Round 3d (ULTS): the form is the cinematic's,
 *  from the confirm - the opener is Gummy's own Bazooka. */
function drawn(b: Body) {
  const s = b.state, elapsed = s.actionTime * s.actionDuration, p = b.group.position;
  const form = s.fighter === 'gummy' && s.action === 'ultimate' && s.confirmedAt !== undefined && elapsed < s.actionDuration - .23;
  b.model.visible = !form;
  b.handR.set(p.x + Math.sin(s.yaw) * .4, p.y + (form ? 2.3 : 1.4), p.z + Math.cos(s.yaw) * .4);
}
type Frame = { phase: string; weight: number; eye: THREE.Vector3; t: number; bodies: Map<string, THREE.Vector3>; yaw: number; camera: THREE.PerspectiveCamera; hand: THREE.Vector3 };
/** `user` casts the ultimate at frame 30 locked on `v0`; the others stand at
 *  `spots` ([x, z] from the user at the origin facing +z). */
function film(user: FighterId, spots: [number, number][], seconds = 7, lockOn = 'v0') {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 5 });
  sim.addPlayer('me', user, 'Me', false, { x: 0, y: 0, z: 0 });
  spots.forEach(([x, z], i) => sim.addPlayer('v' + i, 'taisei', 'V', false, { x, y: 0, z }));
  sim.actors.get('me')!.state.ultimate = 100;
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), follow = new FollowCamera(camera);
  follow.mode = 'lockon'; follow.cinematics = true;
  const bodies = new Map<string, Body>(sim.playerStates().map(p => [p.id, body(p)]));
  follow.director.crowd = bodies;
  let input = 0, seq = 0;
  const frames: Frame[] = [];
  for (let i = 0; i < 60 * seconds; i++) {
    sim.submitInput('me', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'v0', attack: i === 30 ? 'ultimate' : undefined });
    sim.step();
    const events: CombatEvent[] = sim.drainEvents();
    for (const p of sim.playerStates()) { const b = bodies.get(p.id)!; Object.assign(b.state, p); b.group.position.set(p.x, p.y, p.z); b.group.rotation.y = p.yaw; drawn(b); }
    follow.director.handle(events, 'me', id => bodies.get(id));
    follow.update(1 / 60, bodies.get('me')!, input, 0, [], 0, bodies.get(lockOn)!, true); input = follow.inputYaw; camera.updateMatrixWorld();
    frames.push({ phase: follow.director.phase, weight: follow.director.weight, eye: camera.position.clone(), t: sim.serverTime,
      bodies: new Map([...bodies].map(([id, b]) => [id, b.group.position.clone()])), yaw: bodies.get('me')!.state.yaw, camera: camera.clone(), hand: bodies.get('me')!.handR.clone() });
  }
  sim.dispose();
  return { frames, cast: 31 / 60 };
}
const chest = (p: THREE.Vector3) => new THREE.Vector3(p.x, p.y + 1.1, p.z);
const onScreen = (camera: THREE.PerspectiveCamera, p: THREE.Vector3) => { const v = p.clone().project(camera); return v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1; };

describe('ultimate shots keep what the move summons out of the way', () => {
  it('Spring Tide: the release shot sees the victim past the inflating fist', () => {
    const { frames, cast } = film('gummy', [[.2, 2.4], [3.4, 3.4], [-2.4, 5.4]], 8);
    // Round 3d (ULTS): Spring Tide is the finisher of a hit-confirm
    // ultimate: the fist is blown up over the held victim from just after the
    // opener and driven in over the last 0.3 s (GummyEffects).
    const kong = MOVES.gummy.ultimate, blow = kong.contacts[kong.contacts.length - 1], from = kong.contacts[0] + .12, full = blow - .35, drive = blow - .3;
    const release = frames.filter(f => f.phase === 'release' && f.weight > .99 && f.t - cast > from && f.t - cast < drive);
    expect(release.length, 'the release shot is taken').toBeGreaterThan(20);
    let hidden = 0;
    for (const f of release) {
      // The fist as GummyEffects hangs it off the raised hand, up and toward
      // the victim.
      const h = f.hand, v = f.bodies.get('v0')!, age = f.t - cast;
      const size = .45 + 1.75 * THREE.MathUtils.smoothstep(age, from, full), n = Math.hypot(1, 1.1), reach = size * .95;
      const ax = v.x - h.x, az = v.z - h.z, l = Math.hypot(ax, az) || 1;
      const cx = h.x + ax / l / n * reach, cz = h.z + az / l / n * reach, cy = h.y + 1.1 / n * reach, radius = size * .8;
      if (sightClearance(f.eye, chest(v), cx, cz, cy, cy) < radius) hidden++;
    }
    expect(hidden / release.length, 'frames with the victim behind the fist').toBeLessThan(.05);
  });

  it('Ikazuchi Arrow: no lens inside the Guardian, and the victim seen past it', () => {
    const { frames, cast } = film('shiden', [[0, 2.2], [3.2, 2.9], [-2.1, 5]], 6);
    const shot = frames.filter(f => f.weight > .5 && f.t - cast < 4.5);
    expect(shot.some(f => f.phase === 'release')).toBe(true);
    for (const f of shot) {
      const me = f.bodies.get('me')!, x = me.x - Math.sin(f.yaw) * .35, z = me.z - Math.cos(f.yaw) * .35;
      if (f.eye.y > me.y + 4.3 + .3) continue;
      expect(Math.hypot(f.eye.x - x, f.eye.z - z), `lens out of the Guardian at ${(f.t - cast).toFixed(2)} (${f.phase})`).toBeGreaterThan(1.35);
    }
    let hidden = 0;
    const release = shot.filter(f => f.phase === 'release' && f.weight > .99);
    for (const f of release) {
      const me = f.bodies.get('me')!, x = me.x - Math.sin(f.yaw) * .35, z = me.z - Math.cos(f.yaw) * .35;
      if (sightClearance(f.eye, chest(f.bodies.get('v0')!), x, z, me.y + 1.35, me.y + 2.95) < 1.35) hidden++;
    }
    expect(hidden / Math.max(1, release.length), 'release frames with the victim behind the Guardian').toBeLessThan(.05);
  });

  it('a bystander where the shot would stand: the lens keeps off them and sees the victim past them', () => {
    // Royal Aurora on a victim 3 m ahead, a bystander standing right behind
    // the caster's shoulder - where the release shot stands by default.
    const { frames, cast } = film('ouga', [[.3, 3], [-1.3, -1.4]], 6);
    const release = frames.filter(f => f.phase === 'release' && f.weight > .99 && f.t - cast < 3.2);
    expect(release.length).toBeGreaterThan(20);
    for (const f of release) {
      const by = f.bodies.get('v1')!;
      expect(Math.hypot(f.eye.x - by.x, f.eye.z - by.z), 'lens off the bystander').toBeGreaterThan(1.1);
      expect(sightClearance(f.eye, chest(f.bodies.get('v0')!), by.x, by.z, by.y + .42, by.y + 1.43), 'victim clear of them').toBeGreaterThan(.42);
    }
  });
});

describe('the shot is about whoever the move is aimed at', () => {
  it('frames the fighter the ultimate goes to, not the one the lock-on had at the cast', () => {
    // TARGET's pick: the move goes to v0 in front while the lock-on camera
    // was still on v1 off to the side.
    const { frames, cast } = film('ouga', [[.3, 3], [3.5, 1.5]], 6, 'v1');
    const release = frames.filter(f => f.phase === 'release' && f.weight > .99 && f.t - cast < 3);
    expect(release.length).toBeGreaterThan(20);
    const framed = release.filter(f => onScreen(f.camera, chest(f.bodies.get('v0')!))).length;
    expect(framed / release.length, 'release frames holding the victim').toBeGreaterThan(.95);
  });

  it('swings from the close-up to the release round the side nobody stands on', () => {
    for (const [user, spots] of [['ouga', [[.2, 1.4]]], ['taisei', [[.3, 1.6], [-1.2, 2.6]]], ['nigo', [[-.3, 1.5]]]] as [FighterId, [number, number][]][]) {
      const { frames } = film(user, spots, 5);
      for (const f of frames.filter(x => x.phase === 'swing' && x.weight > .99)) for (const [id, p] of f.bodies) {
        if (id === 'me' || f.eye.y > p.y + 2.2) continue;
        expect(Math.hypot(f.eye.x - p.x, f.eye.z - p.z), `${user}: the lens past ${id}`).toBeGreaterThan(.8);
      }
    }
  });
});

describe('the time stops keep their people in the frame', () => {
  it.each(['koko', 'oro'] as FighterId[])('%s: the main victim stays in the field through the resume blast', user => {
    const { frames, cast } = film(user, [[.1, 2], [1.7 * Math.sin(1.7), 4 * Math.cos(1.7)], [-4.8 * Math.sin(2.3), 4.8 * Math.cos(2.3)]], 7);
    const move = moveFor(user, 'ultimate', false), finish = cast + move.contacts[move.contacts.length - 1];
    const resume = frames.filter(f => f.phase === 'field' && f.weight > .99 && f.t >= finish);
    expect(resume.length, 'the field holds through the resume').toBeGreaterThan(10);
    for (const f of resume) expect(onScreen(f.camera, chest(f.bodies.get('v0')!)), `v0 at ${(f.t - finish).toFixed(2)} after the finisher`).toBe(true);
  });

  it('LORD ORO: the hour of ruin is in the field before it slams down', () => {
    const { frames, cast } = film('oro', [[.1, 2], [1.7 * Math.sin(1.7), 4 * Math.cos(1.7)], [-4.8 * Math.sin(2.3), 4.8 * Math.cos(2.3)]], 7);
    const finisher = MOVES.oro.ultimate.contacts[MOVES.oro.ultimate.contacts.length - 1];
    const hang = frames.filter(f => f.phase === 'field' && f.weight > .99 && f.t - cast > finisher - ROLLER_TIMING.hold + .1 && f.t - cast < finisher - ROLLER_TIMING.slam);
    expect(hang.length).toBeGreaterThan(10);
    for (const f of hang) {
      const pose = rollerAt(f.t - cast, finisher)!, v = f.bodies.get('v0')!;
      const top = new THREE.Vector3(v.x, v.y + pose.height + 3.25 * .9, v.z);
      expect(onScreen(f.camera, top), `the roller's top at ${(f.t - cast - finisher).toFixed(2)}`).toBe(true);
    }
  });
});
