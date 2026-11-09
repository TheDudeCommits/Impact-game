import { afterEach, describe, expect, it, vi } from 'vitest';
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
import { yodakaFireOwlReady } from '../src/render/signature/YodakaFireOwl';
import { lookLead } from '../src/engine/sim/areaDamage';
import looks from '../src/engine/sim/areaLooks.json';
import { ORIGINALS } from '../src/originals/roster'; // Yodaka's slot keeps the default area look; the old area drawing never loads

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const clean of cleanups.splice(0)) clean();
  setActiveKit(undefined, 'yodaka'); vi.restoreAllMocks();
  expect(yodakaFireOwlReady()).toBe(false);
});
const event = (kind: CombatEvent['kind'], serverTime: number, id: number): CombatEvent => ({
  id, kind, serverTime, actorId: 'r', fighter: 'yodaka', slot: 'area',
  endpoint: { x: 2, y: 0, z: 5 }, radius: 3.5, due: 2.57, contactIndex: 0, strikes: 1,
});
function harness() {
  let ready: ((texture: T.Texture<HTMLImageElement>) => void) | undefined, fail: ((error: unknown) => void) | undefined;
  vi.spyOn(T.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad, _progress, onError) => {
    ready = onLoad; fail = onError; return new T.Texture<HTMLImageElement>();
  });
  const zone = vi.spyOn(ForgeFxDirector.prototype, 'zone').mockResolvedValue(true);
  const prepare = vi.spyOn(ForgeFxDirector.prototype, 'prepare').mockResolvedValue(true);
  const forgeEvents = vi.spyOn(ForgeFxDirector.prototype, 'handle');
  const scene = new T.Scene(), signatures = new RosterSignatureSet(scene, { budget: 1 } as VfxKit);
  const area = new AreaTelegraph(scene), loaded = signatures.load(['yodaka']);
  const state = { id: 'r', fighter: 'yodaka', alive: true, action: 'idle', yaw: 0, x: 0, y: 0, z: 0 } as PlayerState;
  const body = { state, group: new T.Group() } as Fighter, bodies = new Map([['r', body]]);
  // Exercise the actual bridge without constructing unrelated CombatEffects pools.
  const effects = { rosterSignatures: signatures } as unknown as CombatEffects;
  const authored = vi.fn((e: CombatEvent) => CombatEffects.prototype.handleAuthoredAreas.call(effects, [e], bodies));
  const send = (...events: CombatEvent[]) => area.handle(events, 'other', [state], authored);
  const update = (time: number) => { area.update(time, undefined, undefined, () => 0); signatures.update(time, bodies, new Map()); };
  const owl = () => (scene.getObjectByName('yodaka-fire-owl') as T.InstancedMesh).count;
  cleanups.push(() => { area.dispose(); signatures.dispose(); });
  return { scene, signatures, area, effects, bodies, loaded, send, update, owl, authored, zone, prepare, forgeEvents,
    ready: () => ready!(new T.Texture<HTMLImageElement>()), fail: () => fail!(new Error('texture unavailable')) };
}

describe.skipIf(!!ORIGINALS.yodaka)('Yodaka area presentation selection', () => {
  it.each(['before release', 'after release'] as const)('selects only Owl when its texture arrives %s', async when => {
    const h = harness(); h.send(event('cast', 0, 1));
    if (when === 'before release') { h.ready(); await h.loaded; }
    h.send(event('release', .72, 2)); h.update(1.4);
    if (when === 'after release') { h.ready(); await h.loaded; }
    h.update(2.56);
    expect(h.zone).not.toHaveBeenCalled(); expect(h.owl()).toBe(0);
    const stamp = h.scene.getObjectByName('area-telegraph')!.children.find(o => o.visible && (o as T.Mesh<T.PlaneGeometry, T.ShaderMaterial>).material?.uniforms?.uThreat) as T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
    expect(stamp.material.uniforms.uThreat.value).toBe(1); expect(stamp.material.uniforms.uFill.value).toBeGreaterThan(.9);
    const impact = event('impact', 2.57, 3); h.send(impact, impact); h.update(2.67);
    expect(h.authored).toHaveBeenCalledExactlyOnceWith(impact); expect(h.owl()).toBe(1);
    expect(h.zone).not.toHaveBeenCalled(); expect(h.forgeEvents).not.toHaveBeenCalled();
    h.update(3.3); expect(h.owl()).toBe(0);
  });
  it('keeps the impact fallback when a texture arrives afterward, then permits Owl on the next cast', async () => {
    const h = harness(); h.send(event('cast', 0, 1), event('release', .72, 2)); h.update(2.56);
    expect(h.zone).not.toHaveBeenCalled();
    const impact = event('impact', 2.57, 3); h.send(impact); h.update(2.6);
    expect(h.zone).toHaveBeenCalledTimes(1); expect(h.zone.mock.calls[0][1].effect).toBe(looks.yodaka[0]);
    expect(h.zone.mock.calls[0][4]).toBeCloseTo(lookLead(looks.yodaka[0])); expect(h.authored).not.toHaveBeenCalled();
    h.ready(); await h.loaded; h.send(impact); h.update(2.67);
    expect(h.owl()).toBe(0); expect(h.zone).toHaveBeenCalledTimes(1);
    h.update(3.3); h.send(event('cast', 5, 4), { ...event('release', 5.72, 5), due: 7.57 });
    h.send({ ...event('impact', 7.57, 6), due: 7.57 }); h.update(7.67);
    expect(h.owl()).toBe(1); expect(h.zone).toHaveBeenCalledTimes(1);
  });
  it('retains a failed-load fallback and handles a missed cast/release with one impact', async () => {
    const h = harness(); h.fail(); await h.loaded;
    const impact = event('impact', 2.57, 3); h.send(impact, impact); h.update(2.67);
    expect(h.zone).toHaveBeenCalledTimes(1); expect(h.authored).not.toHaveBeenCalled(); expect(h.owl()).toBe(0);
  });
  it('keeps a Forge area override exclusively in the area-zone path', async () => {
    const h = harness(); h.ready(); await h.loaded;
    setActiveKit({ forge: 1, name: 'area test', body: 'yodaka', slots: {
      light: { from: 'yodaka' }, heavy: { from: 'yodaka' }, special: { from: 'yodaka' }, ultimate: { from: 'yodaka' },
      area: { from: 'yodaka', fx: { effect: 'wildfire', scale: .8 } },
    } } as ForgeKit);
    h.send(event('cast', 0, 1), event('release', .72, 2)); h.update(2.56);
    h.send(event('impact', 2.57, 3)); h.update(2.67);
    expect(h.zone).toHaveBeenCalledTimes(1); expect(h.zone.mock.calls[0][1]).toEqual({ effect: 'wildfire', scale: .8 });
    expect(h.authored).not.toHaveBeenCalled(); expect(h.owl()).toBe(0); expect(h.forgeEvents).not.toHaveBeenCalled();
  });
  it('forwards only selected impacts to the own signature, never the Forge cue director', async () => {
    const h = harness(); h.ready(); await h.loaded;
    CombatEffects.prototype.handleAuthoredAreas.call(h.effects, [event('cast', 0, 1), event('release', .72, 2), event('hit', 2.57, 4)], h.bodies);
    h.update(2.6); expect(h.owl()).toBe(0); expect(h.forgeEvents).not.toHaveBeenCalled();
    const impact = event('impact', 2.57, 3);
    CombatEffects.prototype.handleAuthoredAreas.call(h.effects, [impact, impact], h.bodies); h.update(2.67);
    expect(h.owl()).toBe(1); expect(h.forgeEvents).not.toHaveBeenCalled();
    h.signatures.reset(); h.area.reset(); h.update(2.7); expect(h.owl()).toBe(0);
  });
});
