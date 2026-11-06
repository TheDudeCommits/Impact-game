/** What the signature layers may ask of the frame beyond their own meshes.
 *
 *  The layers do not hold the renderer: main.ts sets `screen` to it and
 *  `localId` to the player's id once, here, and every layer reads them. The
 *  post calls are optional - the look stream adds `techniqueGrade` and
 *  `timeStop` in parallel - so every call site checks for the method first
 *  and the layers draw correctly with or without them. */
export interface SignatureScreen {
  impactFrame?(strength: number, at?: unknown): void;
  chromaticPulse?(amount: number): void;
  speedLines?(amount: number): void;
  /** A whole-frame grade toward `color` at `strength` for `seconds`; with
   *  `at` and `reach` (metres) a pool round that point instead (round 3c). */
  techniqueGrade?(color: number, strength: number, seconds: number, at?: { x: number; y: number; z: number }, reach?: number): void;
  /** THE HOUR's two-tone world, 0..1; fed every frame it holds. */
  timeStop?(amount: number): void;
  /** The power-up pass: a power-up's night over the place (not the fighters or the effects), 0..1; fed every frame it holds. */
  powerDim?(amount: number): void;
}
export const SIGNATURE: { screen?: SignatureScreen; localId?: string;
  /** The room's floor under a point, from the room's own collision (main.ts sets it): the height of the first fixed
   *  surface from half a metre over `y` to six under it, or undefined where there is none in that reach, the ray
   *  begins inside something, or no room is loaded. What lies on the floor asks it through blowFloor.ts
   *  (`floorUnder`, `blowFloor`), which MoveStage's floor-laid verbs do for every caller. */
  floor?: (x: number, y: number, z: number) => number | undefined } = {};

export function involvesLocal(...ids: (string | undefined)[]) {
  const me = SIGNATURE.localId;
  return me === undefined || ids.includes(me);
}

/** The renderer's technique grade (the room drained and pushed toward the
 *  technique's hue so it is the brightest thing on screen), asked for once per
 *  cast: `owner` and `key` name it (an event id, or the action's start time),
 *  so a caller may ask every frame without building a string. Only for a move
 *  the player is part of. */
const graded = new Map<string, number>();
export function gradeOnce(owner: string, key: number, color: number, strength: number, seconds: number, ...ids: (string | undefined)[]) {
  if (graded.get(owner) === key) return;
  graded.set(owner, key); if (graded.size > 64) graded.delete(graded.keys().next().value!);
  if (involvesLocal(...ids)) SIGNATURE.screen?.techniqueGrade?.(color, strength, seconds);
}
/** Round 3c: an ordinary special's grade - local to a pool round `at` and
 *  lighter than an ultimate's, so a crowd keeps its own colours ("the whole
 *  crowd flattened into one hue"). Ultimates keep `gradeOnce`'s whole frame. */
export function gradeLocal(owner: string, key: number, color: number, strength: number, seconds: number, at: { x: number; y: number; z: number } | undefined, ...ids: (string | undefined)[]) {
  if (graded.get(owner) === key) return;
  graded.set(owner, key); if (graded.size > 64) graded.delete(graded.keys().next().value!);
  if (involvesLocal(...ids)) SIGNATURE.screen?.techniqueGrade?.(color, strength * SPECIAL_GRADE.strength, Math.min(seconds, SPECIAL_GRADE.hold), at, SPECIAL_GRADE.reach);
}
/** How much of its asked strength a special's local grade keeps, the longest
 *  it holds (seconds) and the pool's reach (metres round `at`). */
export const SPECIAL_GRADE = { strength: .8, hold: 1.4, reach: 2.6 } as const;
/** The hues the renderer's grade is tuned for (sRGB). */
export const GRADE = { ki: 0x3a8cff, void: 0x8a4dff, nightfang: 0xd0203a, fire: 0xff7a1a, wind: 0x3ad070 } as const;
