import type * as THREE from 'three';
import type { FighterId, PlayerState } from '../../../game/types';
import { MOVES } from '../../../game/moves';
import { AWAKENED_MOVES } from '../../../game/awakening';
import { forgedMoves } from '../../../engine/sim/forgedKits';
import { presentationKit } from '../../../engine/client/forgeLive';
import areaLooks from '../../../engine/sim/areaLooks.json';
import { MOVE_SLOTS } from './fxLookup';
import { forgeFxDirector } from './forgeFx';
import { ARMORY_CASTINGS } from './vendor/castings';
import { armoryRollout } from './rollout';
import { splitSettings } from './macros';
import type { ForgeFx } from '../../../engine/sim/forge';
import type { KitValues } from './fxStage';

/**
 * Every Armory effect a room's players can throw through the Forge/area stage (fxStage.ts), read from the data - never a
 * list kept by hand, so the castings and house kits another team switches on tomorrow are warmed with no change here.
 *
 * The casting rollout's own effects (castingSignature.ts) are built and compiled with the room's signatures; these are
 * the rest: a house kit's area move (src/engine/sim/houseKits.json: every fighter has one, an Armory look of its own - a
 * Dragon, a Cyclone, a Hemolance), a forged kit's picks and its aura. They were built in the fight's first frames and
 * compiled on their first draw, which in a twelve-fighter match was a freeze of 100 ms to 3 s each time a fighter
 * first threw its R2 (scripts/night/load_hitches.mjs). Here the room's load builds them (fxStage.ts `warm`) before its
 * programs are compiled and its images uploaded.
 */
type RoomPlayer = Pick<PlayerState, 'fighter'> & Partial<Pick<PlayerState, 'forge' | 'enemy'>>;
const LOOKS = areaLooks as Readonly<Record<string, readonly string[]>>;

/** The Armory effects one player's moves and body can ask the stage for: its kit's pick for each slot (house kit over
 *  its own, forgeLive.presentationKit), its aura, and its area move's look as the simulation names it (areaDamage.ts
 *  `onLook`: the kit's or house kit's, else the matcher's first, areaLooks.json). */
export function playerFx(player: RoomPlayer): string[] {
  const out = new Set<string>();
  const kit = presentationKit(player);
  if (kit) {
    for (const slot of MOVE_SLOTS) { const effect = kit.slots[slot as keyof typeof kit.slots]?.fx?.effect; if (effect) out.add(effect); }
    if (kit.aura?.effect) out.add(kit.aura.effect);
  }
  const move = forgedMoves(player.forge)?.area ?? MOVES[player.fighter as FighterId]?.area;
  const look = move?.area?.fx ?? LOOKS[player.fighter]?.[0];
  if (look) out.add(look);
  // (And the look of the area move its awakened form casts, where that is another: the YUGE's Rumbling.)
  const awake = AWAKENED_MOVES[player.fighter as FighterId]?.area?.area?.fx;
  if (awake) out.add(awake);
  return [...out];
}

/** The Armory effects a fighter's casting draws in this page: each slot's pick and the body's aura, for a fighter whose
 *  casting is live here - `rollout`, by default the page's own (rollout.json's `live` list, and its preview list in a
 *  rollout build: rollout.ts `armoryRollout`) - read from the generated castings (vendor/castings.ts, which
 *  scripts/engine/armory/vendor.mts writes from casting.json). Nothing here names a fighter: the fighters switched on
 *  tomorrow are in these lists the moment they are. The castings' own types are built by their signatures
 *  (castingSignature.ts); this is what a room's load fetches ahead of them, and what the tests hold the room's warm-up to. */
export function castingFx(fighter: string, rollout: ReadonlySet<string> = armoryRollout()): string[] {
  if (!rollout.has(fighter)) return [];
  const slots = ARMORY_CASTINGS[fighter]?.slots;
  if (!slots) return [];
  const out = new Set<string>();
  for (const [slot, cast] of Object.entries(slots)) {
    if (!cast?.pick || cast.pick.includes('/')) continue;
    if (slot === 'body' && (cast as { when?: string }).when === 'never') continue;
    out.add(cast.pick);
  }
  return [...out];
}

/** What a room's kits cast each of its effects with besides the effect's own values (a house kit's `settings`: Gohaku
 *  Beast's Barrage Rush plain and violet, not the vendored fire), each set once an effect: the room's warm-up casts each
 *  set whole in hiding (FxStage.warm), so what only that cast builds is built and compiled with the room. */
export function roomFxValues(players: readonly RoomPlayer[]): Map<string, KitValues[]> {
  const out = new Map<string, KitValues[]>(), seen = new Set<string>();
  const add = (fx: ForgeFx | undefined) => {
    if (!fx?.effect || !fx.settings) return;
    const values = splitSettings(fx.settings), key = fx.effect + JSON.stringify(values);
    if (seen.has(key) || (!Object.keys(values.own).length && !Object.keys(values.macros).length)) return;
    seen.add(key); out.set(fx.effect, [...(out.get(fx.effect) ?? []), values]);
  };
  for (const player of players) {
    if (player.enemy) continue;
    const kit = presentationKit(player);
    if (!kit) continue;
    for (const slot of MOVE_SLOTS) add(kit.slots[slot as keyof typeof kit.slots]?.fx);
    add(kit.aura);
  }
  return out;
}

/** The effects a room's players (never an arcade enemy) can ask the stage for, each once. */
export function roomFxIds(players: readonly RoomPlayer[]): string[] {
  const out = new Set<string>();
  for (const player of players) if (!player.enemy) for (const id of playerFx(player)) out.add(id);
  return [...out];
}

/** Every Armory effect a room's players can draw, by any road - a casting's, a house kit's, a kit's - each once: the chunks
 *  a room's load fetches ahead, all at once (a casting builds its effects one after another, each a request). */
export function roomChunkIds(players: readonly RoomPlayer[], rollout: ReadonlySet<string> = armoryRollout()): string[] {
  const out = new Set<string>(roomFxIds(players));
  for (const player of players) if (!player.enemy) for (const id of castingFx(player.fighter, rollout)) out.add(id);
  return [...out];
}

/** A room's effects built and warmed in this scene (ForgeFxDirector.warm), resolving when they are ready or could not
 *  be built. A page without a director (a test) resolves at once. */
export function warmRoomFx(players: readonly RoomPlayer[], opts: { cap?: number; between?: () => Promise<unknown>; current?: () => boolean } = {}): Promise<void> {
  const director = forgeFxDirector();
  const ids = roomFxIds(players);
  return director && ids.length ? director.warm(ids, { ...opts, variants: roomFxValues(players) }) : Promise.resolve();
}

/** The scene objects the room's Armory effects live under, for the load-time warm draw (GameRenderer.warmDraw). */
export const warmRoots = (): THREE.Object3D[] => forgeFxDirector()?.roots() ?? [];

/** Effekseer's runtime started and its files loaded for the room (the `efk_*` effects), before the fight. */
export const warmEffekseer = (renderer: THREE.WebGLRenderer, camera: THREE.Camera, cap?: number): Promise<void> => forgeFxDirector()?.effekseer(renderer, camera, cap) ?? Promise.resolve();
/** Effekseer's runtime started ahead, once the room's effects are built: its files load beside the room's (warmEffekseer waits). */
export const prefetchEffekseer = (renderer?: THREE.WebGLRenderer, camera?: THREE.Camera): void => forgeFxDirector()?.prefetchEffekseer(renderer, camera);
