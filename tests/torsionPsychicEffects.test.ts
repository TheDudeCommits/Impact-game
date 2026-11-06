import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { TorsionPsychic, TORSION_PSYCHIC_LIMITS, torsionStrikePoint } from '../src/render/signature/TorsionPsychic';
const id = 'torsion' as FighterId;
function harness() {
  const scene = new THREE.Scene(), fx = new TorsionPsychic(scene, { budget: 1 });
  function fighter(name: string) {
    const group = new THREE.Group(); return { group, model: new THREE.Group(), bones: new Map(), handR: new THREE.Vector3(.3, 1.3, .2), handL: new THREE.Vector3(-.3, 1.3, .2), strikePoint: (out: THREE.Vector3) => out.set(.3, 1.7, 2),
      state: { id: name, fighter: name === 'torsion' ? id : 'taisei', alive: true, action: 'idle', yaw: 0, actionTime: 0, actionDuration: 3.92, actionSeq: 4 } as PlayerState } as unknown as Fighter;
  }
  const actor = fighter('torsion'), foe = fighter('foe'); foe.group.position.z = 2;
  return { scene, fx, actor, foe, fighters: new Map([['torsion', actor], ['foe', foe]]), flights: new Map<string, Flight>(), mesh: (n: string) => scene.getObjectByName('torsion-psychic-' + n) as THREE.InstancedMesh };
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: id, actorId: 'torsion', targetId: 'foe', slot: 'ultimate', actionSeq: 4, serverTime: 10.5, ...patch });
function groundRings(mesh:THREE.InstancedMesh){
 const m=new THREE.Matrix4(),rows:THREE.Vector3[]=[];
 for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);const p=new THREE.Vector3().setFromMatrixPosition(m);if(p.y<.1)rows.push(p);}
 return rows;
}
describe('Torsion bounded manual threads and Full Torque presentation', () => {
  it('uses native finger and dual-hand contact without recursive strike queries', () => {
    const h = harness(); try {
      h.actor.strikePoint = () => { throw new Error('Recursive strike query'); };
      h.actor.state.action = 'light'; expect(torsionStrikePoint(h.actor, new THREE.Vector3()).equals(h.actor.handR)).toBe(true);
      h.actor.state.action = 'heavy'; expect(torsionStrikePoint(h.actor, new THREE.Vector3()).equals(h.actor.handL)).toBe(true);
      h.actor.state.action = 'ultimate'; h.actor.state.actionTime = 3.14 / 3.92;
      expect(torsionStrikePoint(h.actor, new THREE.Vector3()).equals(h.actor.handL.clone().lerp(h.actor.handR, .5))).toBe(true);
    } finally { h.fx.dispose(); }
  });
  it('does not mutate simulation state or generate effects from idle awakened state', () => {
    const h = harness(); try { h.actor.state.awakened = true; const before = JSON.stringify(h.actor.state); h.fx.update(10, h.fighters, h.flights);
      expect(h.mesh('pressure').count).toBe(0); expect(JSON.stringify(h.actor.state)).toBe(before);
      Object.assign(h.actor.state, { action: 'awaken', actionTime: .7, actionDuration: .9 }); h.fx.update(10.6, h.fighters, h.flights); expect(h.mesh('pressure').count).toBeGreaterThan(0);
    } finally { h.fx.dispose(); }
  });
  it('draws only released authoritative shockwaves and removes their geometry on expiry', () => {
    const h = harness(); try {
      const flight = { fighter: id, slot: 'special', released: false, position: new THREE.Vector3(0, 1, 3), heading: new THREE.Vector3(0, 0, 1) } as Flight;
      h.flights.set('arrow', flight); h.fx.update(10, h.fighters, h.flights); expect(h.mesh('pressure').count).toBe(0);
      flight.released = true; h.fx.update(10.1, h.fighters, h.flights); expect(h.mesh('pressure').count).toBeGreaterThan(0);
      h.flights.clear(); h.fx.update(10.2, h.fighters, h.flights); expect(h.mesh('pressure').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('prefers the authoritative impact endpoint while retaining the captured floor', () => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: 3.4 / 3.92, confirmedAt: 10.5 });
      h.fx.handle(event(), h.fighters);
      h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 2, serverTime: 13.14, endpoint: { x: 7, y: 1.5, z: 8 } }), h.fighters);
      h.fx.update(13.4, h.fighters, h.flights); const point = groundRings(h.mesh('rings'))[0];
      expect(point.x).toBeCloseTo(7); expect(point.z).toBeCloseTo(8); expect(point.y).toBeCloseTo(.035);
    } finally { h.fx.dispose(); }
  });
  it.each(['whiff', 'interrupt', 'new action', 'target removed', 'reset'])('requires confirmed final contact and cancels ultimate presentation on %s', why => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: 3.2 / 3.92, confirmedAt: 10.5 });
      h.fx.handle(event(), h.fighters); h.fx.update(13.2, h.fighters, h.flights); expect(groundRings(h.mesh('rings')).length).toBe(0); expect(h.mesh('debris').count).toBeGreaterThan(0);
      if (why === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (why === 'interrupt') h.actor.state.action = 'hurt';
      if (why === 'new action') h.actor.state.actionSeq = 5;
      if (why === 'target removed') h.fighters.delete('foe');
      if (why === 'reset') h.fx.reset();
      h.fx.update(13.2, h.fighters, h.flights); h.fx.handle(event({ id: 3, kind: 'hit', contactIndex: 2, serverTime: 13.14, endpoint: { x: 0, y: 1, z: 2 } }), h.fighters);
      h.fx.update(13.21, h.fighters, h.flights); expect(groundRings(h.mesh('rings')).length).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('keeps the final ground ring fixed while a living target launches and bounds crowded effects', () => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: 3.2 / 3.92, confirmedAt: 10.5 }); h.fx.handle(event(), h.fighters);
      h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 2, serverTime: 13.14 }), h.fighters); h.fx.update(13.2, h.fighters, h.flights);
      const p = new THREE.Vector3(); p.copy(groundRings(h.mesh('rings'))[0]);
      h.foe.group.position.set(8, 4, 5); h.actor.state.actionTime = 3.45 / 3.92; h.fx.update(13.45, h.fighters, h.flights);
      expect(groundRings(h.mesh('rings'))[0].distanceTo(p)).toBeLessThan(1e-6);
      for (let i = 3; i < 250; i++) h.fx.handle(event({ id: i, kind: 'hit', slot: 'heavy', serverTime: 13.45 }), h.fighters);
      h.fx.update(13.5, h.fighters, h.flights);
      for (const [name, limit] of [['pressure', TORSION_PSYCHIC_LIMITS.threads], ['debris', TORSION_PSYCHIC_LIMITS.needles], ['rings', TORSION_PSYCHIC_LIMITS.rings]] as const) {
        expect(h.mesh(name).count).toBeLessThanOrEqual(limit); expect(Array.from(h.mesh(name).instanceMatrix.array).every(Number.isFinite)).toBe(true);
      }
      h.fx.dispose(); expect(h.scene.children).toHaveLength(0); h.fx.dispose();
    } finally { h.fx.dispose(); }
  });
});
