import type { FighterId } from '../../../game/types';
import rollout from '../../../engine/vfx/rollout.json';

let built: unknown, devServer = false;
// Written out in full so Vite replaces them at build time; outside Vite (a Node script or test) they are undefined.
try { built = import.meta.env.VITE_ARMORY; devServer = import.meta.env.DEV === true; } catch { built = undefined; devServer = false; }

/** The build was made with the rollout on. */
export const ARMORY_BUILD: boolean = built === 'on' || built === '1' || built === 'true';
/** The preview rollout's castings can be drawn here: in a rollout build, or on a dev server (which may ask for them).
 *  The live list's are drawn in every build. */
export const ARMORY_ENABLED: boolean = ARMORY_BUILD || devServer;
/** The Armory's runtime may load in this page, in every build: a Forge kit's effects and the Forge itself fetch it (lazy
 *  chunks) the first time they ask for an effect; a page that never does, never fetches it. */
export const ARMORY_RUNTIME = true;

const lists = rollout as { live?: string[]; fighters: string[] };
/** The preview rollout: drawn in a `VITE_ARMORY=on` build (and on a dev server asked for it). */
export const ROLLOUT: readonly FighterId[] = Object.freeze([...lists.fighters] as FighterId[]);
/** Drawn from their casting in every build. */
export const LIVE: readonly FighterId[] = Object.freeze([...(lists.live ?? [])] as FighterId[]);
/** Every fighter a casting may draw in some build: the live list and the preview rollout. */
export const CAST: readonly FighterId[] = Object.freeze([...new Set([...LIVE, ...ROLLOUT])]);

/** The fighters drawn from their casting in this page: the live list, and the rollout in a rollout build. A dev server
 *  takes `?armory=on` (both) or `?armory=off` (nobody, the game as it was before the Armory). */
export function armoryRollout(search: string = typeof location === 'object' && location ? location.search : '', dev: boolean = devServer, build: boolean = ARMORY_BUILD): ReadonlySet<FighterId> {
  let on = build, off = false;
  if (dev) {
    let asked: string | null = null;
    try { asked = new URLSearchParams(search).get('armory'); } catch { asked = null; }
    if (asked === 'on') on = true; else if (asked === 'off') { on = false; off = true; }
  }
  return new Set(off ? [] : on ? CAST : LIVE);
}
