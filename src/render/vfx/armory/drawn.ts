/**
 * Which plain moves the Armory casting draws in this page (castingSignature.ts marks them as it loads).
 *
 * The layers that draw a move today (a fighter's signature module, GummyEffects for Kagari) ask this before drawing a
 * plain move's flight, finisher or hit, and leave a move the casting draws to it; they keep drawing its wind-up (a
 * burning fist, a glowing blade), its combo enders and everything of a fighter outside the rollout. A Forge kit's
 * effect on a slot (forgeFx.ts) marks it the same way, for any fighter. Nothing is marked in a build without the
 * Armory, so every layer draws as it always has.
 */
const DRAWN = new Set<string>();
/** The same for Forge kits' Armory effects, which are a player's, not a fighter's (forgeFx.ts sets them every frame
 *  from the kits in play): `player|fighter:slot`, and `fighter:slot` for a reader that doesn't know who threw. */
const FX = new Set<string>(), FX_ANY = new Set<string>();

/** Whether the Armory draws `fighter`'s plain `slot` move, from its casting or (thrown by `player`, when given) a Forge
 *  kit; never a combo ender (`branch` set). */
export function armoryDraws(fighter: string | undefined, slot: string | undefined, branch?: string, player?: string): boolean {
  if (branch !== undefined || fighter === undefined || slot === undefined || (DRAWN.size === 0 && FX.size === 0)) return false;
  const key = `${fighter}:${slot}`;
  return DRAWN.has(key) || (player !== undefined ? FX.has(`${player}|${key}`) : FX_ANY.has(key));
}

/** Whether a Forge kit's effect draws `fighter`'s plain `slot` move (thrown by `player`, when given) (RosterSignatureSet:
 *  the common effects stand aside for it whether or not the fighter has a module of its own). */
export function fxDraws(fighter: string | undefined, slot: string | undefined, branch?: string, player?: string): boolean {
  if (FX.size === 0 || branch !== undefined || fighter === undefined || slot === undefined) return false;
  return player !== undefined ? FX.has(`${player}|${fighter}:${slot}`) : FX_ANY.has(`${fighter}:${slot}`);
}
/** The slots Forge kits draw now: each player's, as the events name the move (`fighter:slot`) (forgeFx.ts, once a
 *  frame). */
export function setFxDrawn(keys: Iterable<{ readonly player: string; readonly key: string }>) {
  FX.clear(); FX_ANY.clear();
  for (const { player, key } of keys) { FX.add(`${player}|${key}`); FX_ANY.add(key); }
}

/** Fighters whose only signature is their casting (no module of their own, like Kagari): what their casting does not
 *  draw, CombatEffects' common effects still do (`signatureCovers`). */
const ONLY = new Set<string>();
export function markArmoryOnly(fighter: string) { ONLY.add(fighter); }

/** Whether a fighter's signature draws its `slot` move, so the common effects stand aside (RosterSignatureSet
 *  `hasRosterSignature`): a module of its own draws them all; a casting alone only the moves it draws. With no slot,
 *  whether the fighter has a signature at all. */
export function signatureCovers(fighter: string, slot?: string, branch?: string) {
  return slot === undefined || !ONLY.has(fighter) || armoryDraws(fighter, slot, branch);
}

export function markArmoryDrawn(fighter: string, slots: Iterable<string>) { for (const slot of slots) DRAWN.add(`${fighter}:${slot}`); }
export function clearArmoryDrawn(fighter: string) {
  for (const set of [DRAWN, HIT]) for (const key of [...set]) if (key.startsWith(`${fighter}:`)) set.delete(key);
}

/** The drawn moves of a fighter whose only signature is his casting (an original, drawn by CombatEffects) whose casting
 *  starts at the hit (`on: 'hit'`): the casting draws what happens where it lands, and the game keeps the move's wind-up
 *  and flight (the approved Galewheel carried to its victim, then the Armory's sphere of cuts). */
const HIT = new Set<string>();
export function markArmoryHit(fighter: string, slots: Iterable<string>) { for (const slot of slots) HIT.add(`${fighter}:${slot}`); }
/** Whether the game still draws the wind-up and the flight of `fighter`'s plain `slot` move that his casting draws from
 *  the hit on (never one a Forge kit's effect draws: that is all the kit's). */
export function flightKept(fighter: string | undefined, slot: string | undefined, branch?: string, player?: string): boolean {
  if (HIT.size === 0 || branch !== undefined || fighter === undefined || slot === undefined) return false;
  const key = `${fighter}:${slot}`;
  return HIT.has(key) && !fxDraws(fighter, slot, branch, player);
}
