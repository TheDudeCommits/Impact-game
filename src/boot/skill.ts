/** The player's skill, kept by this browser from one match to the next (src/game/adaptive.ts, 28 October 2026: the bots
 *  stand 10-20% ahead of each player). Every room the page joins is told it (the join's `skill`), the offline modes
 *  hand it to their own simulation, and the player's snapshot hands it back as the match learns more (PlayerState.skill),
 *  which keepSkill writes down. Nothing here throws: a private window keeps no skill, and every match starts new. */
const KEY = 'impact-skill';
let kept: number | undefined;

export function keptSkill(): number | undefined {
  if (kept !== undefined) return kept;
  try { const value = Number(localStorage.getItem(KEY)); if (Number.isFinite(value) && value > 0) kept = value; } catch { /* none kept */ }
  return kept;
}

/** The skill a match says the player has now (written when it changes). */
export function keepSkill(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value === kept) return;
  kept = value;
  try { localStorage.setItem(KEY, String(value)); } catch { /* kept for this page only */ }
}
