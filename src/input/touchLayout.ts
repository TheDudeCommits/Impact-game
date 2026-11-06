import type { PlayerState } from '../game/types';
import { ULTIMATE_COST } from '../game/moves';
import { AWAKENING_COST, AWAKENING_SECONDS } from '../game/awakening';

export type ClusterButton = 'light' | 'heavy' | 'special' | 'ultimate' | 'area' | 'awaken' | 'jump' | 'dash' | 'guard' | 'target';
/** A button: its diameter and its centre, phone CSS pixels (a tablet's are --tc-k larger), `x` in from the safe area's
 *  right edge and `y` up from its bottom edge. */
export type Spot = { d: number; x: number; y: number };

/** LIGHT, the attack button, in the corner. */
export const ATTACK: Spot = { d: 82, x: 66, y: 66 };
/** The rings round LIGHT's centre, from its centre to theirs. */
export const SKILL_RING = 86, MOVE_RING = 146, FAR_RING = 207;
/** A spot on a ring round LIGHT: `degrees` counter-clockwise from straight right, as on a clock face read the usual way
 *  (90 is straight up, 180 straight left). */
export function around(radius: number, degrees: number, d: number): Spot {
  const a = degrees * Math.PI / 180, x = ATTACK.x - radius * Math.cos(a), y = ATTACK.y + radius * Math.sin(a);
  return { d, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}
export const TOUCH_LAYOUT: Readonly<Record<ClusterButton, Spot>> = {
  light: ATTACK,
  // The skills, a quarter ring: HEAVY nearest the thumb's rest, ULT at the top of the corner. AREA (drag to aim) sits
  // where a finger has room to drag out every way but straight down.
  heavy: around(SKILL_RING, 200, 54), special: around(SKILL_RING, 157, 54), area: around(SKILL_RING, 114, 54), ultimate: around(SKILL_RING, 71, 54),
  // Moving: DASH along the bottom (below-left of the attack), GUARD (held) beside the skills, JUMP
  // (held: fly) above them.
  dash: around(MOVE_RING, 192, 52), guard: around(MOVE_RING, 166, 52), jump: around(MOVE_RING, 140, 52),
  // The fan's far end, low: AWAKEN (a portrait, once a match) over LOCK.
  awaken: around(FAR_RING, 168, 52), target: around(FAR_RING - 1, 188, 50),
};
/** The fan's pieces never come closer than this to each other (CSS px, phone scale), nor to the safe area's edges. */
export const CLUSTER_GAP = 7, EDGE_GAP = 8;
/** The fan's height over the safe area's bottom where it meets the pieces on the right of the HUD (the right-most
 *  `RIGHT_COLUMN` px), and anywhere: what the pieces above it are kept clear of (handheld.css). */
export const RIGHT_COLUMN = 150, RIGHT_TOP = 176, CLUSTER_TOP = 188;
/** Where the fan's far column (AWAKEN, LOCK) ends: under the prompt lane (handheld.css, zone 6 at 38% of the height). */
export const FAR_TOP = 136;

/** Each button's box, CSS px from the page's top left, on a page `width` x `height` with the safe-area insets and the
 *  controls' scale `k` (a tablet's 1.3): [left, top, right, bottom]. */
export function clusterBoxes(width: number, height: number, k = 1, insets: { right?: number; bottom?: number } = {}) {
  const right = width - (insets.right ?? 0), bottom = height - (insets.bottom ?? 0);
  const out = {} as Record<ClusterButton, [number, number, number, number]>;
  for (const [id, s] of Object.entries(TOUCH_LAYOUT) as [ClusterButton, Spot][]) {
    const cx = right - s.x * k, cy = bottom - s.y * k, r = s.d * k / 2;
    out[id] = [cx - r, cy - r, cx + r, cy + r];
  }
  return out;
}
/** The CSS a button is placed with (handheld.css .tc-btn reads them): its diameter and its right and bottom edges'
 *  offsets from the safe area, phone px. */
export function spotStyle(s: Spot) { return { '--d': `${s.d}px`, '--x': `${Math.round((s.x - s.d / 2) * 10) / 10}px`, '--y': `${Math.round((s.y - s.d / 2) * 10) / 10}px` }; }

/** A dash costs this much stamina and needs it in hand (simulation.ts: `p.stamina >= 20`, then `- 20`). */
export const DASH_STAMINA = 20;
/** The seconds a cooling button prints: whole seconds, rounded up (a 0.3 s wait reads 1). */
export const coolSeconds = (left: number) => left > 0.05 ? String(Math.ceil(left - 0.05)) : '';
/** What the buttons show, from the player's own state: each move's cooldown (seconds left), the ultimate's and the
 *  awakening's charge (0..1, the awakening's draining while it is on), and the dashes in hand. */
export type TouchMeters = { cool: Record<'light' | 'heavy' | 'special' | 'area', number>; ultimate: number; awakening: number; awake: boolean; dashes: number; dashMax: number };
export function touchMeters(self: PlayerState, serverTime: number): TouchMeters {
  const left = (slot: 'light' | 'heavy' | 'special' | 'area') => Math.max(0, (self.cooldowns?.[slot] ?? 0) - serverTime);
  const awake = !!self.awakened;
  const awakening = awake ? Math.max(0, (self.awakenedUntil ?? 0) - serverTime) / AWAKENING_SECONDS : (self.awakening ?? 0) / AWAKENING_COST;
  const most = Math.max(DASH_STAMINA, self.maxStamina ?? 100);
  return {
    cool: { light: left('light'), heavy: left('heavy'), special: left('special'), area: left('area') },
    ultimate: clamp01(self.ultimate / ULTIMATE_COST), awakening: clamp01(awakening), awake,
    dashes: Math.max(0, Math.floor((self.stamina ?? 0) / DASH_STAMINA + 1e-6)), dashMax: Math.floor(most / DASH_STAMINA + 1e-6),
  };
}
const clamp01 = (v: number) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
/** How often the buttons' meters are written (Hz): the cooldowns' wipes and numbers, the charge rings, the dash pips. */
export const METER_HZ = 10;
