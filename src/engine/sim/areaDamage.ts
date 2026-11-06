import type { MoveDefinition } from '../../game/moves';
import strikeData from './areaStrikes.json';
import lookData from './areaLooks.json';

/** Each vendored Armory effect's strikes, seconds from its start, as laid for an area move. */
export const AREA_STRIKES = strikeData as Readonly<Record<string, readonly number[]>>;
/** Each fighter's area looks, best first (scripts/engine/areaLooks.mts): the first is its area move's look. */
export const AREA_LOOKS = lookData as Readonly<Record<string, readonly string[]>>;

/** The most an area move deals with every strike dead centre: under every ultimate (the least, Konta's, is 270). */
export const AREA_DAMAGE_CEILING = 240;
/** Inside this share of the radius a strike is a bullseye: all of its damage, and the page marks it. */
export const AREA_BULLSEYE = .25;
/** What a strike deals at the rim, against its centre. */
export const AREA_RIM = .5;

/** A strike's share of its damage at `distance` metres from the centre of a circle `radius` across: all of it inside the
 *  bullseye, then down in a straight line to AREA_RIM at the rim (and no less past it, where a body's edge is caught). */
export function areaFalloff(distance: number, radius: number): number {
  const u = radius > 0 ? Math.max(0, distance) / radius : 0;
  if (u <= AREA_BULLSEYE) return 1;
  return Math.max(AREA_RIM, 1 - (1 - AREA_RIM) * (u - AREA_BULLSEYE) / (1 - AREA_BULLSEYE));
}
export const isBullseye = (distance: number, radius: number) => distance <= radius * AREA_BULLSEYE;

/** How long after it starts a look first strikes (0: at once, or never measured). The page lays it this long before
 *  the circle's first strike is due. */
export const lookLead = (effect: string | undefined): number => (effect ? AREA_STRIKES[effect]?.[0] : undefined) ?? 0;
/** A look's strikes, seconds after its first: [0] for one that strikes once or was never measured. */
export function lookStrikes(effect: string | undefined): number[] {
  const at = effect ? AREA_STRIKES[effect] : undefined;
  return at?.length ? at.map(t => +(t - at[0]).toFixed(2)) : [0];
}

/** Whether an area move keeps a schedule of its own (`hits` every `interval`) rather than its look's. */
export const pinnedSchedule = (move: MoveDefinition): boolean => move.area?.hits !== undefined || move.area?.interval !== undefined;
/** When an area move's strikes land, seconds after its first: its look's, else `hits` every `interval`. */
export function strikeOffsets(move: MoveDefinition): number[] {
  const area = move.area;
  if (!area) return [0];
  if (area.strikes?.length) return [...area.strikes];
  const hits = Math.max(1, area.hits ?? 1), every = area.interval ?? .2;
  return Array.from({ length: hits }, (_, k) => +(k * every).toFixed(3));
}
/** All an area move deals if every strike lands dead centre. */
export function areaTotal(move: MoveDefinition): number {
  const n = strikeOffsets(move).length;
  return move.damage * (n - 1) + (move.finisherDamage ?? move.damage);
}

/** `total` laid over a move's `n` strikes: even shares, the last (the finisher) what rounding leaves. */
function lay(move: MoveDefinition, total: number, n: number) {
  const each = Math.max(1, Math.round(total / n));
  move.damage = each;
  if (n > 1) move.finisherDamage = Math.max(1, total - each * (n - 1)); else delete move.finisherDamage;
}
/** Holds an area move to the ceiling, in place: its strikes scaled down together. */
export function capArea(move: MoveDefinition): MoveDefinition {
  const total = areaTotal(move);
  if (!move.area || total <= AREA_DAMAGE_CEILING) return move;
  if (pinnedSchedule(move)) {
    const k = AREA_DAMAGE_CEILING / total;
    move.damage = Math.max(1, Math.floor(move.damage * k));
    if (move.finisherDamage !== undefined) move.finisherDamage = Math.max(1, Math.floor(move.finisherDamage * k));
  } else lay(move, AREA_DAMAGE_CEILING, strikeOffsets(move).length);
  return move;
}

/** Times an area move to a look, in place: `fx` names it, and unless the move pins its own schedule its total is laid
 *  across the look's strikes (`strikes`, kept only for a look that strikes more than once). Called as every area move
 *  is built - a fighter's own from its first area look (areaMoveOf), a kit's or house kit's from the `fx` its pick gives
 *  (tuneMove) - so the server, which never plays a look, times each strike to the look every screen plays. */
export function onLook(move: MoveDefinition, effect: string | undefined): MoveDefinition {
  const area = move.area;
  if (!area) return move;
  const total = areaTotal(move);
  if (effect) area.fx = effect; else delete area.fx;
  if (!pinnedSchedule(move)) {
    const at = lookStrikes(effect);
    if (at.length > 1) area.strikes = at; else delete area.strikes;
    lay(move, total, at.length);
  } else delete area.strikes;
  return capArea(move);
}
