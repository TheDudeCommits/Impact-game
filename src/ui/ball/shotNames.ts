import {GENERIC_SUPER, SIGNATURE_FIGHTERS, SIGNATURE_SHOTS} from '../../game/ball/superShots';

/** The signature shots' brushed names, drawn ahead of time into one atlas from an open-licence face (Dela Gothic One,
 *  CREDITS.md; no font ships, none is fetched). One row a name, in this
 *  order - the eight signature shots as game/ball/superShots.ts lists them, then SUPER SHOT - each row the letters' fill
 *  on the left and their ink outline and paper rim on the right, white with the mask in alpha (BallShow colours them
 *  with CSS masks). */
export const SHOT_NAMES_URL = '/assets/ui/ball/ball-shot-names.webp';
export const SHOT_NAMES: readonly string[] = [...SIGNATURE_FIGHTERS.map(f => SIGNATURE_SHOTS[f]!.name), GENERIC_SUPER];
/** The atlas's cell (px) and its size: two cells a row, a row a name. */
export const SHOT_NAME_CELL = {w: 1024, h: 200} as const;
export const SHOT_NAMES_SIZE = {w: SHOT_NAME_CELL.w * 2, h: SHOT_NAME_CELL.h * SHOT_NAMES.length} as const;
/** The row a shot's name is drawn in (SUPER SHOT's for a name the atlas does not hold). */
export const shotNameRow = (name: string) => { const i = SHOT_NAMES.indexOf(name); return i < 0 ? SHOT_NAMES.length - 1 : i; };
