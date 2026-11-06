import { AWAKENED_MOVES } from '../../game/awakening';
import type { MoveDefinition } from '../../game/moves';
import type { ActionKind, AttackSlot, FighterId } from '../../game/types';
import { decodeForge, forgeHash, forgeMoves, forgeProblems, type ForgeKit } from './forge';

/** How many hex digits of a kit's SHA-256 name it on the wire. */
export const FORGE_HASH_LENGTH = 16;
export const shortForgeHash = (kit: ForgeKit) => forgeHash(kit).slice(0, FORGE_HASH_LENGTH);

const kits = new Map<string, Record<AttackSlot, MoveDefinition>>(), wholeKits = new Map<string, ForgeKit>();
const SLOTS: ReadonlySet<string> = new Set(['light', 'heavy', 'special', 'ultimate', 'area']);

/** Takes a room's `{ hash: code }` map; keeps each kit whose code is valid and hashes to its name. Returns how many are new. */
export function rememberForgeKits(codes: unknown): number {
  if (!codes || typeof codes !== 'object') return 0;
  let added = 0;
  for (const [hash, code] of Object.entries(codes as Record<string, unknown>)) {
    if (kits.has(hash) || typeof code !== 'string' || code.length > 4096) continue;
    try {
      const kit = decodeForge(code);
      if (shortForgeHash(kit) !== hash || forgeProblems(kit).errors.length) continue;
      kits.set(hash, forgeMoves(kit)); wholeKits.set(hash, kit); added++;
    } catch { /* not a kit: ignored, and that player plays their body's own moves on this screen */ }
  }
  return added;
}
export const forgedMoves = (hash: string | undefined) => hash ? kits.get(hash) : undefined;
/** The whole kit a hash names (its sources and Armory effects, for the page's presentation). */
export const forgedKit = (hash: string | undefined) => hash ? wholeKits.get(hash) : undefined;
/** Forgets every kit (a room left). */
export const forgetForgeKits = () => { kits.clear(); wholeKits.clear(); };

/** A forged move awakened as moveFor awakens a roster fighter's: AWAKENED_MOVES over it. The same rule as the simulation's. */
export function awakenedForged(moves: Record<AttackSlot, MoveDefinition>, fighter: FighterId, slot: AttackSlot, awakened: boolean): MoveDefinition {
  const base = moves[slot], change = awakened ? AWAKENED_MOVES[fighter]?.[slot] : undefined;
  return change ? { ...base, ...change } : base;
}
/** The move a forged player's action plays, as the simulation chose it (moveOf): its kit's slot, the light only as the
 *  string's first blow. Undefined for anything else - a combo ender, a later rush stage, a player who isn't forged. */
export function forgedMoveFor(state: { fighter: FighterId; forge?: string; action: ActionKind; chain?: number; awakened?: boolean }): MoveDefinition | undefined {
  const moves = forgedMoves(state.forge);
  if (!moves || !SLOTS.has(state.action) || (state.action === 'light' && (state.chain ?? 0) > 0)) return undefined;
  return awakenedForged(moves, state.fighter, state.action as AttackSlot, !!state.awakened);
}
