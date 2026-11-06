import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import type { CombatEvent, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { VfxKit } from '../src/render/vfx/VfxKit';
import type { ForgeKit } from '../src/engine/sim/forge';
import { setActiveKit } from '../src/engine/client/forgeLive';
import { AreaTelegraph } from '../src/render/AreaTelegraph';
import { CombatEffects } from '../src/render/CombatEffects';
import { RosterSignatureSet } from '../src/render/signature/RosterSignatureSet';
import { ForgeFxDirector } from '../src/render/vfx/armory/forgeFx';
import { MOVES } from '../src/game/moves';
import { HOUSE_KITS } from '../src/engine/sim/houseKits';
import { slotFx } from '../src/engine/client/forgeLive';
import { chohanPhysicalArea } from '../src/render/signature/ChohanAllIn';

const cleanups: (() => void)[] = [];
afterEach(() => { for (const clean of cleanups.splice(0)) clean(); setActiveKit(undefined, 'chohan'); vi.restoreAllMocks(); });
/** Launch night (12 October 2026): Chohan's shipped G is an aimed area move like everyone's (areaMoves.json, range 14,
 *  with a house look: houseKits.json), so the physical bridge below - a sweep on his own feet, drawn by his signature
 *  instead of the seal's look - no longer runs by default (chohanPhysicalArea asks for a G with no Armory look, and his
 *  own G now wears the house one under any kit). The bridge stays, and stays covered: these tests put the sweep back
 *  for their own length - no house look, range 0, a kit that picks his own G. The last tests are the shipped move, on
 *  the generic path. */
const HOUSE = HOUSE_KITS.chohan!.slots!, HOUSE_AREA = HOUSE.area!, SHIPPED_RANGE = MOVES.chohan.area.range;
const sweep = (on: boolean) => {
  (MOVES.chohan.area as { range: number }).range = on ? 0 : SHIPPED_RANGE;
  if (on) { delete HOUSE.area; customArea('chohan'); } else HOUSE.area = HOUSE_AREA;
};
const event = (kind: CombatEvent['kind'], time: number, id: number): CombatEvent => ({
  id, kind, serverTime: time, actorId: 't', fighter: 'chohan', slot: 'area', look: 'blade_iaido',
  endpoint: { x: 2, y: .04, z: -3 }, radius: 2, due: .702, contactIndex: 0, strikes: 1,
});
function harness() {
  const scene = new T.Scene(), signatures = new RosterSignatureSet(scene, { budget: 1 } as VfxKit), area = new AreaTelegraph(scene);
  const zone = vi.spyOn(ForgeFxDirector.prototype, 'zone').mockResolvedValue(true);
  const prepare = vi.spyOn(ForgeFxDirector.prototype, 'prepare').mockResolvedValue(true);
  const forgeEvents = vi.spyOn(ForgeFxDirector.prototype, 'handle');
  const loaded = signatures.load(['chohan']);
  const state = { id: 't', fighter: 'chohan', alive: true, action: 'idle', actionTime: 0, actionDuration: 1.3, yaw: 0, x: 2, y: .04, z: -3, grounded: true } as PlayerState;
  const group = new T.Group(); group.position.set(2, .04, -3);
  const body = { state, group, handR: new T.Vector3(2.2, 1.3, -2.7), strikePoint: (out: T.Vector3) => out.set(2.4, 1.2, -2) } as unknown as Fighter;
  const bodies = new Map([['t', body]]), effects = { rosterSignatures: signatures } as unknown as CombatEffects;
  const authored = vi.fn((e: CombatEvent) => CombatEffects.prototype.handleAuthoredAreas.call(effects, [e], bodies));
  const send = (...events: CombatEvent[]) => area.handle(events, 'other', [state], authored);
  const update = (time: number) => { area.update(time, undefined, undefined, () => .04); signatures.update(time, bodies, new Map()); };
  const stamps = () => scene.getObjectByName('area-telegraph')!.children.filter(o => o.visible && (o as T.Mesh<T.BufferGeometry,T.ShaderMaterial>).material?.uniforms?.uSimpleRing) as T.Mesh<T.BufferGeometry,T.ShaderMaterial>[];
  cleanups.push(() => { area.dispose(); signatures.dispose(); });
  return { scene, area, signatures, loaded, state, bodies, authored, send, update, zone, prepare, forgeEvents, stamps };
}
function customArea(from: 'chohan' | 'taisei', effect?: string) {
  setActiveKit({ forge: 1, name: 'explicit G', body: 'chohan', slots: {
    light: { from: 'chohan' }, heavy: { from: 'chohan' }, special: { from: 'chohan' }, ultimate: { from: 'chohan' },
    area: { from, ...(effect ? { fx: { effect, scale: .8 } } : {}) },
  } } as ForgeKit);
}

describe('Chohan physical area bridge (a sweep on his own feet, range 0)', () => {
  beforeEach(() => sweep(true)); afterEach(() => sweep(false));
  it('forwards own cast/release/impact exactly once at impact, never preparing or laying the generic blade zone', async () => {
    const h = harness(); await h.loaded; const slam = vi.fn(), genericImpact = vi.fn(); h.area.onSlam = slam; h.area.onImpact = genericImpact;
    const cast = event('cast', 0, 1), release = event('release', .702, 2), impact = event('impact', .702, 3);
    expect(h.send(cast)).toEqual([]); h.update(.2);
    const stamp = h.stamps()[0]; expect(stamp.material.uniforms.uSimpleRing.value).toBe(0); expect(stamp.material.uniforms.uMask.value).not.toBeNull();
    expect(stamp.material.uniforms.uThreat.value).toBe(1); expect(stamp.position.y).toBeLessThan(.11);
    h.send(release); h.update(.71); expect(stamp.position.y).toBeCloseTo(.085);
    h.send(impact, impact); h.update(.78);
    expect(h.authored.mock.calls.map(([e]) => e.kind)).toEqual(['cast', 'release', 'impact']);
    expect(h.zone).not.toHaveBeenCalled(); expect(h.prepare).not.toHaveBeenCalled(); expect(h.forgeEvents).not.toHaveBeenCalled();
    expect(slam).not.toHaveBeenCalled(); expect(genericImpact).not.toHaveBeenCalled();
    expect((h.scene.getObjectByName('chohan-contact-chips') as T.InstancedMesh).count).toBe(10);
    expect(stamp.material.uniforms.uFill.value).toBe(0); expect(stamp.material.uniforms.uFlash.value).toBe(0);
    h.update(1.1); expect(h.stamps()).toHaveLength(0); expect((h.scene.getObjectByName('chohan-contact-chips') as T.InstancedMesh).count).toBe(0);
  });
  it('stamps his seal in stone-grey ink, stationary while aiming, and the usual stamp for a different fighter', async () => {
    const h = harness(); await h.loaded;
    const aim = { active: true, x: 2, z: -3, fromX: 2, fromZ: -3, range: 0, radius: 2, valid: true };
    h.area.update(0, aim, h.state, () => .04);
    const stamp = h.stamps()[0]; expect(stamp.material.uniforms.uSimpleRing.value).toBe(0); expect(stamp.material.uniforms.uMask.value).not.toBeNull();
    expect(stamp.position.y).toBeLessThan(.12); const scale = stamp.scale.x;
    h.area.update(.1, aim, h.state, () => .04); expect(stamp.scale.x).toBe(scale);
    Object.assign(h.state, { y: 6, grounded: false }); h.area.update(.15, aim, h.state, () => .04);
    expect(stamp.position.y).toBeCloseTo(6.0675);
    h.area.update(.2, aim, { ...h.state, fighter: 'taisei' }, () => .04);
    expect(stamp.material.uniforms.uSimpleRing.value).toBe(0); expect(stamp.material.uniforms.uMask.value).not.toBeNull();
  });
  it.each(['wildfire', 'blade_iaido'])('preserves an explicit Forge %s area override and its original stamp', async effect => {
    const h = harness(); await h.loaded; customArea('chohan', effect);
    const cast = { ...event('cast', 0, 1), look: effect }, release = { ...event('release', .702, 2), look: effect };
    h.send(cast, release); h.update(.71); h.send({ ...event('impact', .702, 3), look: effect }); h.update(.78);
    expect(h.authored).not.toHaveBeenCalled(); expect(h.zone).toHaveBeenCalledTimes(1);
    expect(h.zone.mock.calls[0][1]).toEqual({ effect, scale: .8 }); expect(h.stamps()[0].material.uniforms.uSimpleRing.value).toBe(0);
    expect((h.scene.getObjectByName('chohan-contact-chips') as T.InstancedMesh).count).toBe(0);
  });
  it('preserves borrowed G and all other fighters in the generic area path', async () => {
    const h = harness(); await h.loaded; customArea('taisei');
    const release = { ...event('release', .702, 2), fighter: 'taisei' as const, body: 'chohan' as const, look: 'wildfire' };
    h.send(release); h.update(.78);
    expect(h.zone).toHaveBeenCalledTimes(1); expect(h.authored).not.toHaveBeenCalled();
    expect(h.stamps()[0].material.uniforms.uSimpleRing.value).toBe(0);
    h.area.reset(); setActiveKit(undefined, 'chohan'); h.state.fighter = 'taisei';
    h.send({ ...release, id: 4, serverTime: 3, due: 3, body: undefined }); h.update(3.1);
    expect(h.zone).toHaveBeenCalledTimes(2); expect(h.authored).not.toHaveBeenCalled();
    expect(h.stamps()[0].material.uniforms.uSimpleRing.value).toBe(0);
  });
  it('tracks a moving self-centered caster during wind-up and reuses the same circle at the release endpoint', async () => {
    const h = harness(); await h.loaded; h.send(event('cast', 0, 1)); h.update(.2);
    const original = h.stamps()[0], poolSize = h.scene.getObjectByName('area-telegraph')!.children.length;
    Object.assign(h.state, { x: 3.2, y: .18, z: -1.5 }); h.send(); h.update(.5);
    expect(original.position.x).toBeCloseTo(3.2); expect(original.position.z).toBeCloseTo(-1.5);
    const endpoint = { x: 3.4, y: .2, z: -1.2 };
    h.send({ ...event('release', .702, 2), endpoint }, { ...event('impact', .702, 3), endpoint }); h.update(.78);
    expect(h.stamps()).toEqual([original]); expect(original.position.toArray()).toEqual([3.4, .245, -1.2]);
    expect(h.scene.getObjectByName('area-telegraph')!.children.length).toBe(poolSize);
  });
  it('handles a missed cast/release with one native impact and preserves ordinary area-hit delivery', async () => {
    const h = harness(); await h.loaded; const impact = event('impact', .702, 3), blow = event('hit', .702, 4);
    expect(h.send(impact, impact, blow)).toEqual([blow]); h.update(.78);
    expect(h.authored).toHaveBeenCalledExactlyOnceWith(impact); expect(h.zone).not.toHaveBeenCalled();
    h.signatures.reset(); h.area.reset(); h.update(.80); expect(h.stamps()).toHaveLength(0);
    expect((h.scene.getObjectByName('chohan-contact-chips') as T.InstancedMesh).count).toBe(0);
  });
});

describe('Chohan shipped area move (aimed, like everyone else)', () => {
  // What keeps it off the physical bridge: his house kit gives his own G a look. Take that entry away and an aimed
  // circle would be drawn following his feet with nothing at the place it strikes.
  it('wears its house look under no kit and under a kit that picks his own G, so it never takes the physical bridge', () => {
    expect(slotFx({ fighter: 'chohan' }, 'area')?.effect).toBe('blade_iaido'); expect(chohanPhysicalArea({ fighter: 'chohan' })).toBe(false);
    customArea('chohan');
    expect(slotFx({ fighter: 'chohan' }, 'area')?.effect).toBe('blade_iaido'); expect(chohanPhysicalArea({ fighter: 'chohan' })).toBe(false);
  });
  it('is drawn by the generic area path: his seal slams and fills, and the house look is laid at the aimed circle', async () => {
    expect(SHIPPED_RANGE).toBeGreaterThanOrEqual(3);
    const h = harness(); await h.loaded; const slam = vi.fn(); h.area.onSlam = slam;
    const far = { x: 2, y: .04, z: 6 }, due = MOVES.chohan.area.contacts[0] + MOVES.chohan.area.area!.telegraph;
    const cast = { ...event('cast', 0, 1), endpoint: far, radius: MOVES.chohan.area.radius };
    const release = { ...event('release', MOVES.chohan.area.contacts[0], 2), endpoint: far, radius: MOVES.chohan.area.radius, due };
    h.send(cast); h.update(.2);
    const stamp = h.stamps()[0];
    // Where the player put it, not round his feet, and it stays there when he moves.
    expect(stamp.position.x).toBeCloseTo(2); expect(stamp.position.z).toBeCloseTo(6);
    Object.assign(h.state, { x: 3.2, z: -1.5 }); h.send(); h.update(.3);
    expect(stamp.position.x).toBeCloseTo(2); expect(stamp.position.z).toBeCloseTo(6);
    h.send(release); h.update(release.serverTime + .05);
    h.send({ ...event('impact', due, 3), endpoint: far, radius: MOVES.chohan.area.radius }); h.update(due + .02);
    expect(h.authored).not.toHaveBeenCalled(); expect(slam).toHaveBeenCalledTimes(1);
    expect(h.zone).toHaveBeenCalledTimes(1); expect(h.zone.mock.calls[0][1]).toMatchObject({ effect: 'blade_iaido' });
    expect((h.scene.getObjectByName('chohan-contact-chips') as T.InstancedMesh).count).toBe(0);
  });
});
