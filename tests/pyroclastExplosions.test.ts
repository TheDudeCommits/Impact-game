import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { PyroclastExplosions, pyroclastPalm, pyroclastContact, PYROCLAST_EXPLOSION_LIMITS } from '../src/render/signature/PyroclastExplosions';
const PYROCLAST = 'pyroclast' as FighterId;
function actor(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group(), model = new THREE.Group(), left = new THREE.Bone(), right = new THREE.Bone();
  left.position.set(-.4, 1.35, .4); right.position.set(.4, 1.35, .4); model.add(left, right); group.add(model); group.updateMatrixWorld(true);
  return { group, model, handL: left.position.clone(), handR: right.position.clone(), joints: new Map([['LeftHand', left], ['RightHand', right]]), state: { id, fighter: id === 'pyroclast' ? PYROCLAST : 'taisei', alive: true, action: 'idle', actionSeq: 1, actionTime: 0, actionDuration: 3.4, ...patch } as PlayerState } as unknown as Fighter;
}
function harness(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), fx = new PyroclastExplosions(scene, { budget }), pyroclast = actor('pyroclast', patch), target = actor('foe');
  target.group.position.set(0, 0, 3); target.group.updateMatrixWorld(true);
  const fighters = new Map([['pyroclast', pyroclast], ['foe', target]]), flights = new Map<string, Flight>();
  return { scene, fx, pyroclast, target, fighters, flights, mesh: (name: string) => scene.getObjectByName(`pyroclast-explosions-${name}`) as THREE.InstancedMesh };
}
const receipt = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: PYROCLAST, actorId: 'pyroclast', targetId: 'foe', actionSeq: 1, slot: 'ultimate', serverTime: 10.544, ...patch });
describe('Pyroclast manual explosion presentation', () => {
  it('follows the displayed hand socket, preserving the palm past the gauntlet', () => {
    const base = actor('pyroclast'), shown = actor('pyroclast'); shown.group.position.y = .25; shown.group.updateMatrixWorld(true);
    Object.defineProperty(base, 'shownBody', { get: () => shown });
    expect(pyroclastPalm(base, 'Right', new THREE.Vector3()).toArray()).toEqual([.4, 1.6, .4]);
  });
  it('matches the authored left palm and twin-palm finisher contacts', () => {
    const f = actor('pyroclast'), p = new THREE.Vector3();
    expect(pyroclastContact(f, 0, p, 'Spitfire Cross')).toBe(true); expect(p.x).toBe(-.4);
    pyroclastContact(f, 0, p, 'Lava Bomb'); expect(p.x).toBe(0);
    f.state.action = 'ultimate'; pyroclastContact(f, 2, p, 'Supervolcano'); expect(p.x).toBe(0);
    pyroclastContact(f, 0, p, 'Supervolcano'); expect(p.x).toBe(.4);
  });
  it('keeps idle free of attacks and Cluster release presentation free of gameplay writes', () => {
    const h = harness();
    try {
      h.fx.update(10, h.fighters, h.flights); expect(h.mesh('blasts').count).toBe(0); expect(h.mesh('streaks').count).toBe(0);
      Object.assign(h.pyroclast.state, { action: 'awaken', actionDuration: .9, actionTime: .59 / .9, awakened: true }); const before = JSON.stringify(h.pyroclast.state);
      h.fx.update(10.59, h.fighters, h.flights); expect(h.mesh('blasts').count).toBe(2); expect(JSON.stringify(h.pyroclast.state)).toBe(before);
      h.pyroclast.state.actionTime = .5 / .9; h.fx.update(10.5, h.fighters, h.flights); expect(h.mesh('blasts').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('shows Vent Shot only from a released authoritative projectile and cleans up when it ends', () => {
    const h = harness(), flight = { fighter: PYROCLAST, slot: 'special', released: false, position: new THREE.Vector3(1, 2, 3), heading: new THREE.Vector3(0, 0, 1), since: 10 } as Flight;
    try {
      h.flights.set('shot', flight); h.fx.update(10, h.fighters, h.flights); expect(h.mesh('streaks').count).toBe(0);
      flight.released = true; h.fx.update(10.1, h.fighters, h.flights); expect(h.mesh('streaks').count).toBe(2); expect(h.mesh('rings').count).toBe(3);
      const m = new THREE.Matrix4(); h.mesh('streaks').getMatrixAt(0, m); expect(new THREE.Vector3().setFromMatrixPosition(m).distanceTo(flight.position)).toBeLessThan(1e-6);
      h.flights.clear(); h.fx.update(10.2, h.fighters, h.flights); expect(h.mesh('streaks').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('never starts a Howitzer spiral from elapsed time or a cast without confirmation', () => {
    const h = harness({ action: 'ultimate', actionTime: 1.4 / 3.4 });
    try {
      h.fx.handle(receipt({ kind: 'cast' }), h.fighters); h.fx.update(11.4, h.fighters, h.flights); expect(h.mesh('smoke').count).toBe(0);
      h.fx.handle(receipt({ id: 2 }), h.fighters); h.fx.update(11.4, h.fighters, h.flights); expect(h.mesh('smoke').count).toBe(14);
    } finally { h.fx.dispose(); }
  });
  it.each(['hurt', 'sequence', 'whiff', 'target dead', 'reset'])('cancels the confirmed spiral on %s', reason => {
    const h = harness({ action: 'ultimate', actionTime: 1.4 / 3.4 });
    try {
      h.fx.handle(receipt(), h.fighters); h.fx.update(11.4, h.fighters, h.flights); expect(h.mesh('smoke').count).toBe(14);
      if (reason === 'hurt') h.pyroclast.state.action = 'hurt';
      if (reason === 'sequence') h.pyroclast.state.actionSeq = (h.pyroclast.state.actionSeq ?? 0) + 1;
      if (reason === 'whiff') h.fx.handle(receipt({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target dead') h.target.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(11.41, h.fighters, h.flights); expect(h.mesh('smoke').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('retains an actual lethal final blast after target removal and deduplicates its hit', () => {
    const h = harness({ action: 'ultimate', actionTime: 2.7 / 3.4 });
    try {
      const hit = receipt({ kind: 'hit', contactIndex: 2, serverTime: 12.652, endpoint: { x: 0, y: 1.1, z: 3 } });
      h.fx.handle(hit, h.fighters); h.fx.handle(hit, h.fighters); h.target.state.alive = false;
      h.fx.handle(receipt({ id: 2, kind: 'eliminated', actorId: 'foe' }), h.fighters); h.fighters.delete('foe');
      h.fx.update(12.68, h.fighters, h.flights); expect(h.mesh('blasts').count).toBe(1); expect(h.mesh('rings').count).toBe(1);
      h.fx.update(13.34, h.fighters, h.flights); expect(h.mesh('blasts').count).toBe(0); expect(h.mesh('smoke').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('keeps mass simultaneous effects within fixed pools, resets and disposes every owned draw', () => {
    const h = harness({}, .3);
    for (let i = 0; i < 100; i++) h.fx.handle(receipt({ id: i, kind: 'hit', slot: 'special', serverTime: 12 }), h.fighters);
    h.fx.update(12.08, h.fighters, h.flights);
    for (const name of ['blasts', 'smoke', 'rings', 'streaks'] as const) expect(h.mesh(name).count).toBeLessThanOrEqual(PYROCLAST_EXPLOSION_LIMITS[name]);
    h.fx.reset(); for (const name of ['blasts', 'smoke', 'rings', 'streaks']) expect(h.mesh(name).count).toBe(0);
    h.fx.dispose(); h.fx.dispose(); expect(h.scene.children).toHaveLength(0);
  });
});
