import type * as THREE from 'three';
import type { CombatEvent } from '../../../game/types';
import type { Fighter } from '../../Fighter';
import type { Flight } from '../../CombatEffects';
import type { VfxKit } from '../VfxKit';
import type { ForgeFx, ForgeKit } from '../../../engine/sim/forge';
import { ForgeSession } from '../../../engine/client/forgeSession';
import { ARMORY_RUNTIME } from './rollout';
import { setFxDrawn } from './drawn';
import { auraFx, eventFx, kitSlots } from './fxLookup';
import { activeKit, armoryRuntime, registerArmory, setActiveKit, type ArmoryEffectInfo } from '../../../engine/client/forgeLive';
import { ARMORY_EFFECTS } from './vendor/forgeCatalog';
import { ESSENTIALS } from './macros';
import type { KitValues } from './fxStage';
import { UNSHIPPED_ARMORY } from '../../../originals/unshippedArmory'; // effects whose files' licences keep them out
import { forgeLabel } from '../../../originals/forgeLabels'; // originals fork: the effects' names as the fork shows them

/**
 * A Forge kit's Armory effects (kit v2 `fx`, src/engine/client/forgeLive.ts; docs/engine/armory/README.md, "The
 * Forge"): any fighter's slot drawn by any vendored Armory effect, from the very next throw, and its aura worn.
 *
 * RosterSignatureSet holds one per scene, beside the fighters' own signatures:
 *  - **What it draws** is read from the thrower's kit (`slotFx`: offline the body's active kit, online the forged kit
 *    its state names) on every event, so a pick in the Forge shows on the next attack with no reload.
 *  - **What it takes over.** For an event whose thrower's kit gives its slot an effect that is built, `covers` is true:
 *    the set leaves the event out of the thrower's own module (its flight, finisher and hit), and the slot is marked
 *    drawn (drawn.ts), so the common effects and GummyEffects leave it too. Until the effect is built the fighter's own
 *    look plays, as it does with no kit at all.
 *  - **The weight** (fxStage.ts: the Armory's runtime, the effect's chunk, its pool) loads the first time a kit or the
 *    Forge asks for an effect. A page that never does fetches nothing.
 */

type Stage = import('./fxStage').FxStage;

let current: ForgeFxDirector | undefined;
/** The live scene's director, for the Forge's runtime (forgeRuntime.ts). */
export const forgeFxDirector = () => current;

export class ForgeFxDirector {
  private stage?: Stage;
  private loading?: Promise<Stage | undefined>;
  private disposed = false;
  private fighters?: ReadonlyMap<string, Fighter>;

  constructor(private readonly scene: THREE.Scene, private readonly kit: VfxKit) { if (ARMORY_RUNTIME) current = this; }

  /** The Armory's runtime for this scene, loaded once. */
  load(): Promise<Stage | undefined> {
    if (!ARMORY_RUNTIME || this.disposed) return Promise.resolve(undefined);
    return this.loading ??= import('./fxStage').then(m => {
      if (this.disposed) return undefined;
      this.stage = new m.FxStage(this.scene, this.kit);
      return this.stage;
    }, error => { console.warn('armory: the Forge runtime could not load', error); this.loading = undefined; return undefined; });
  }

  /** Whether this event's move is drawn by its thrower's kit (the set leaves it out of the module of the fighter the
   *  event names: the body's own, or a borrowed move's). */
  covers(event: CombatEvent, fighters: ReadonlyMap<string, Fighter> | undefined = this.fighters): boolean {
    if (!this.stage || !event.slot) return false;
    const fx = eventFx(event, fighters ?? this.fighters);
    return !!fx && this.stage.ready(fx.effect);
  }

  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) { this.stage?.handle(event, fighters ?? this.fighters); }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    this.fighters = fighters;
    if (!ARMORY_RUNTIME || this.disposed) return;
    // The slots kits draw now (the marks), and whether anything needs the runtime.
    const drawn: { player: string; key: string }[] = [];
    let wanted = false;
    for (const [player, f] of fighters) {
      for (const { key, fx } of kitSlots(f)) {
        wanted = true;
        if (this.stage?.ready(fx.effect)) drawn.push({ player, key });
        else if (this.stage && !this.stage.broken(fx.effect)) void this.stage.ensure(fx.effect);
      }
      if (auraFx(f)) wanted = true;
    }
    setFxDrawn(drawn);
    if (wanted && !this.stage) void this.load();
    this.stage?.update(time, fighters, flights);
  }

  /** The Armory effects of rooms past let go, as a room is entered: all but `keep` (FxStage.retain). None before the runtime
   *  has loaded (nothing was built). Returns the ids dropped. */
  retain(keep: ReadonlySet<string>): string[] { return this.stage ? this.stage.retain(keep) : []; }
  /** Effekseer's runtime for this scene started and loaded before the fight (FxStage.effekseer). */
  async effekseer(renderer: THREE.WebGLRenderer, camera: THREE.Camera, cap?: number) { await this.stage?.effekseer(renderer, camera, cap); }
  /** Its runtime's files fetched ahead, and with a renderer and camera the runtime started (FxStage.prefetchEffekseer). */
  prefetchEffekseer(renderer?: THREE.WebGLRenderer, camera?: THREE.Camera) { this.stage?.prefetchEffekseer(renderer, camera); }
  /** What a load-time warm draw shows once of every Armory effect of this scene (GameRenderer.warmDraw): each one's warm
   *  cast and first pooled instance (FxStage.warmRoots), hidden between casts; none before the runtime has loaded. */
  roots(): THREE.Object3D[] { return this.stage ? this.stage.warmRoots() : []; }
  /** The Forge's `prepare`: the effect built in this scene, so its first try is instant. */
  async prepare(id: string) { const stage = await this.load(); return stage ? stage.ensure(id) : false; }
  /** A room's effects (roomFx.ts: its players' area looks and kit picks) built and warmed ahead of the room's compile
   *  and texture upload: their chunks fetched together, then each cast whole in hiding one after another, `between`
   *  each (a frame, so the loading screen and a fight in progress both keep moving). Resolves when all are ready or
   *  failed; one that cannot be built is left to the game's own look, as ever. */
  async warm(ids: Iterable<string>, opts: { cap?: number; between?: () => Promise<unknown>; current?: () => boolean; variants?: ReadonlyMap<string, readonly KitValues[]> } = {}) {
    const stage = await this.load();
    if (!stage) return;
    const wanted = [...new Set(ids)];
    // Their code and types arrive together (the network's latency once, not a dozen times).
    await Promise.all(wanted.map(id => stage.ensure(id)));
    for (const id of wanted) {
      if (this.disposed || opts.current?.() === false) return;
      await stage.warm(id, opts.cap, opts.variants?.get(id));
      await opts.between?.();
    }
  }
  /** The area slot (docs/engine/AREA.md): an effect laid at a circle's centre now, `preroll` seconds in (FxStage.zone). */
  async zone(casterId: string, fx: ForgeFx, at: THREE.Vector3, radius: number, preroll = 0) { const stage = await this.load(); return stage ? stage.zone(casterId, fx, at, radius, preroll) : false; }
  /** The area looks laid and the hits each made as it played (FxStage.laidLooks): none before the runtime loads. */
  get laidLooks(): Stage['laidLooks'] { return this.stage?.laidLooks ?? []; }
  /** The area slot's strike times for an effect (FxStage.measure). */
  async measure(id: string) { const stage = await this.load(); return stage ? stage.measure(id) : undefined; }
  /** The Forge's `preview`: the effect thrown from a player now. */
  async preview(playerId: string, fx: ForgeFx) { const stage = await this.load(); return stage ? stage.preview(playerId, fx) : false; }

  reset() { this.stage?.reset(); }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (current === this) current = undefined;
    this.stage?.dispose();
    setFxDrawn([]);
  }
}

/* ---------------------------------------------------------------- the Forge's runtime */

/** The engine's own effect types a kit may pick (the ICE kit's), listed after the Armory's. */
const NATIVE: readonly ArmoryEffectInfo[] = [
  ['ice/crystal-field', 'Crystal field'], ['ice/lance', 'Glacier Javelin'], ['ice/freeze', 'Freeze on hit'], ['ice/floor-freeze', 'Floor freeze'], ['ice/pheasant', 'Ice pheasant'],
].map(([id, label]) => ({ id, label: `ICE: ${label}`, school: 'ice', kit: 'ice', cast: 'line' as const, thumb: '', essentials: [] }));

let listed: readonly ArmoryEffectInfo[] | undefined;

/** The live Forge's Armory runtime (src/engine/client/forgeLive.ts): every effect the game carries, each loaded on
 *  demand, and a preview from any player. A kit's `fx.scale` is its Size (25-400%) and `fx.hue` its Colour (degrees);
 *  the Essentials here are the Armory inspector's other three dials, kept in `fx.settings` (macros.ts). */
registerArmory({
  effects: () => listed ??= [
    ...ARMORY_EFFECTS.filter(e => !UNSHIPPED_ARMORY.has(e.id)).map(e => ({ id: e.id, label: forgeLabel(e.id, e.label), school: e.school, kit: e.kit, cast: e.cast, thumb: e.thumb ?? '', essentials: ESSENTIALS })), // originals fork: less what may not ship (src/originals/credits.ts), named as the fork shows them (src/originals/forgeLabels.ts)
    ...NATIVE,
  ],
  async prepare(id: string) {
    const director = forgeFxDirector();
    if (director) { await director.prepare(id); return; }
    // No fight on yet: its code, fetched for when one is.
    const entry = (await import('./vendor/manifest')).ARMORY_MANIFEST[id];
    if (entry) await entry.load();
  },
  preview(playerId: string, fx: ForgeFx) { void forgeFxDirector()?.preview(playerId, fx); },
});

// scripts/area/measureStrikes.mjs's handle on it, on a page opened with `?area-strikes` only: each effect's hits, as
// the area slot lays it, from its start.
try {
  if (typeof location === 'object' && location && /[?&]area-strikes\b/.test(location.search))
    (window as unknown as { __areaStrikes?: unknown }).__areaStrikes = async (ids: readonly string[]) => {
      const out: Record<string, [number, number][] | null> = {};
      for (const id of ids) out[id] = (await forgeFxDirector()?.measure(id)) ?? null;
      return out;
    };
} catch { /* no page */ }

// The smoke tools' handle on it (scripts/engine/armory_forge_smoke.mjs), on a page opened with `?armory-smoke` only.
let smokeSession: ForgeSession | undefined;
try {
  if (typeof location === 'object' && location && /[?&]armory-smoke\b/.test(location.search))
    (window as unknown as { __armoryForge?: unknown }).__armoryForge = { runtime: armoryRuntime, setActiveKit, activeKit,
      // A kit's moves in play too (a borrowed move's), as the Forge's session puts them.
      applyKit: (kit: ForgeKit) => (smokeSession ??= new ForgeSession()).apply(kit) };
} catch { /* no page */ }
