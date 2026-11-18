/** Where the resolution governor settled. A desktop that
 *  cannot draw its quality's whole resolution started every budget at the top and walked down a step a second through a
 *  fight's first seconds: the picture softening visibly at each step, and every step making the frame's targets again.
 *  Now the share a fight settled at is kept, per GPU, budget and window size, in this browser only, and the next
 *  session (or the next switch into that budget) starts there. The governor still climbs from it when there is room,
 *  and steps down from it when there is not. Phones and tablets keep their own start (powerBudget.ts phoneSharpness). */
import { abOff } from './look/abSwitch';

const STORE = 'rift-resolution-settled', MAX_ENTRIES = 12;
/** Seconds of fighting a share must hold before it is taken as where this machine settles. */
export const SETTLE_S = 10;

type Kept = Record<string, { s: number; t: number }>;
function read(): Kept {
  try {
    const kept = JSON.parse(localStorage.getItem(STORE) ?? '{}');
    return kept && typeof kept === 'object' && !Array.isArray(kept) ? kept as Kept : {};
  } catch { return {}; }
}

/** The key a settled share is kept under: the GPU, the budget (GameRenderer.applySettings's key) and the canvas's
 *  size in CSS pixels, in steps of 16. */
export function settledKey(gpu: string, budget: string, width: number, height: number) {
  return `${gpu}|${budget}|${Math.floor(width / 16) * 16}x${Math.floor(height / 16) * 16}`;
}

/** The share kept for `key`, if any (and the switch is on). */
export function recallSettled(key: string): number | undefined {
  if (abOff('resmemory')) return undefined;
  const s = read()[key]?.s;
  return typeof s === 'number' && Number.isFinite(s) && s > 0 && s <= 1 ? s : undefined;
}

/** Keeps `scale` for `key`; the dozen most recent keys are kept. */
export function rememberSettled(key: string, scale: number, now = Date.now()) {
  if (abOff('resmemory')) return;
  try {
    const kept = read();
    kept[key] = { s: scale, t: now }; // whole: the floor is 1/cap, and a rounded copy of it would be one more step
    for (const old of Object.keys(kept).sort((a, b) => kept[b].t - kept[a].t).slice(MAX_ENTRIES)) delete kept[old];
    localStorage.setItem(STORE, JSON.stringify(kept));
  } catch { /* this visit only */ }
}

/** Watches the governor's share through a fight and says when it has held long enough to keep. Time only counts while
 *  the fight is on (not `calm`: menus, intros and results draw lighter frames and let the share climb). */
export class SettleWatch {
  private scale = -1;
  private held = 0;
  private kept = -1;
  /** Called once a drawn frame: `dt` seconds since the last, the governor's share, whether the page is calm. Answers
   *  the share to keep, when it has just held SETTLE_S seconds of fighting and differs from the last one kept. */
  frame(dt: number, scale: number, calm: boolean): number | undefined {
    if (scale !== this.scale) { this.scale = scale; this.held = 0; return undefined; }
    if (calm || !(dt > 0)) return undefined;
    this.held += Math.min(dt, .25);
    if (this.held < SETTLE_S || Math.abs(scale - this.kept) < 1e-3) return undefined;
    this.kept = scale;
    return scale;
  }
  /** A new budget: what was held under the last one does not count. */
  reset(kept = -1) { this.scale = -1; this.held = 0; this.kept = kept; }
}
