import type { FighterId } from '../game/types';
import { LOCK_ROUND_BORROW } from '../game/lockRoundBorrow';
import { LOCK_ROUND_FILL, type LockFill } from '../game/lockRoundFill';

const F = '/assets/fighters/';
/** A lock file: the copies it holds, each `source file: clips` (one body's files). */
export const LOCK_TAKE_FILES: Readonly<Record<string, readonly (readonly [string, readonly string[]])[]>> = {
  [F + 'wukong-lock1.glb']: [[F + 'wukong-tr1.glb', ['DZ Rush 1', 'DZ Rush 2']], [F + 'wukong-enders1.glb', ['Straight Palm']]],
  [F + 'ampere-lock1.glb']: [[F + 'ampere-tr1.glb', ['Live Line Jab', 'Live Line Cross']]],
  [F + 'shirokane-lock1.glb']: [[F + 'shirokane-tr1.glb', ['Scrap Kunai']], [F + 'shirokane-enders1.glb', ['Rising Slash']]],
  [F + 'shidare-lock1.glb']: [[F + 'shidare-tr1.glb', ['Crossing Petals']]],
  [F + 'levin-lock1.glb']: [[F + 'levin-tr1.glb', ['Shave', 'Lift Off', 'Nick']]],
};

/** Each borrowed take (`donor:clip`) to the original's own file that holds it: a lock file above, or one of the donor's own
 *  small files (Ouga's, Taisei's, Lucy's, Shiden's and Kenzo's base body's enders, each well under a megabyte). */
export const ORIGINAL_LOCK_TAKES: Readonly<Record<string, string>> = {
  'ouga:Elbow Palm': F + 'ouga-pxenders1.glb', 'ouga:Rising Kick': F + 'ouga-pxenders1.glb',
  'taisei:DZ Rush 1': F + 'wukong-lock1.glb', 'taisei:DZ Rush 2': F + 'wukong-lock1.glb', 'taisei:Straight Palm': F + 'wukong-lock1.glb',
  'taisei:Flare Hammer': F + 'wukong-enders2.glb',
  'gummy:Sickle Sweep': F + 'lucy-pxenders2.glb',
  'ampere:Live Line Jab': F + 'ampere-lock1.glb', 'ampere:Live Line Cross': F + 'ampere-lock1.glb',
  'shirokane:Scrap Kunai': F + 'shirokane-lock1.glb', 'shirokane:Rising Slash': F + 'shirokane-lock1.glb',
  'shiden:Slash Palm': F + 'shiden-enders1.glb', 'shiden:Rising Slash': F + 'shiden-enders1.glb',
  'shidare:Crossing Petals': F + 'shidare-lock1.glb',
  'kenzo:Rising Cross': F + 'kenzo-enders1.glb',
  'levin:Shave': F + 'levin-lock1.glb', 'levin:Lift Off': F + 'levin-lock1.glb', 'levin:Nick': F + 'levin-lock1.glb',
};
export const LOCK_TAKE_SHIPPED: readonly string[] = Object.keys(LOCK_TAKE_FILES);

export function applyOriginalLockTakes(table: Partial<Record<FighterId, readonly (({ from: FighterId; clip: string; file: string }) | null)[]>> = LOCK_ROUND_BORROW) {
  for (const stages of Object.values(table)) for (const borrow of stages ?? []) {
    const own = borrow && ORIGINAL_LOCK_TAKES[`${borrow.from}:${borrow.clip}`];
    if (borrow && own) borrow.file = own;
  }
  applyOriginalLockRounds();
}

/** Second-round stages an original throws with a take authored on its own body, in place of the borrowed one (the stage's
 *  name, and so the simulation's move, unchanged): drawn as lockRoundFill.ts's rows are (src/render/Fighter.ts lockTake).
 *  - Levin (levin), stage 2 SPIN CYCLE (remake-misc, 6 November 2026): Kenzo's Rising Cross fitted to his body read as a hop
 *    backwards with both arms behind his head (moves-b's reel, part-1 #2); his own `Spinning Blade Cut` is one tight turn
 *    to his right in a small hop, both swords out together on his right side leading it
 *    (scripts/originals/clips/author_levin.py), played whole: 0.3 s before its blow, as lock combat plays a take. */
export const ORIGINAL_LOCK_ROUNDS: Partial<Record<FighterId, readonly (LockFill | undefined)[]>> = {
  levin: [undefined, { name: 'Spinning Blade Cut', clip: 'Spinning Blade Cut', from: 0, to: .6, contact: .5, span: .6 }],
};
/** Applied with the borrows (and as often: it changes nothing the second time): each own take in, its borrow out. */
export function applyOriginalLockRounds(fill: Partial<Record<FighterId, readonly (LockFill | null)[]>> = LOCK_ROUND_FILL,
  borrow: Partial<Record<FighterId, readonly (({ name: string }) | null)[]>> = LOCK_ROUND_BORROW) {
  for (const [id, stages] of Object.entries(ORIGINAL_LOCK_ROUNDS) as [FighterId, readonly (LockFill | undefined)[]][]) stages.forEach((own, stage) => {
    if (!own) return;
    const rows = [...(fill[id] ?? [null, null, null])];
    rows[stage] = own;
    fill[id] = rows;
    const borrowed = borrow[id];
    if (borrowed?.[stage]?.name === own.name) { const left = [...borrowed]; left[stage] = null; borrow[id] = left; }
  });
}
