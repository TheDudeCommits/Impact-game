import type { FighterId } from '../../game/types';
import { decodeForge, forgeProblems } from '../sim/forge';

/** `?forge` opens the Forge studio when Training starts (the studio itself is in every offline Training session since
 *  the Forge Studio; share links are `?forge&kit=<hash>`). */
export const forgeWanted = () => typeof location === 'object' && new URLSearchParams(location.search).has('forge');

/** The Forge keeps one kit per body (the studio's draft). */
export const forgeDraftKey = (body: FighterId) => `jump-forge-draft:${body}`;
/** Whether the player takes this body's kit into private rooms (the studio's "Use in private rooms"): off until turned on. */
export const forgeOnlineKey = (body: FighterId) => `jump-forge-online:${body}`;

/** How a stored value is read (the page's localStorage; a test hands its own). */
export type ForgeRead = (key: string) => string | null;
const stored: ForgeRead = key => { try { return localStorage.getItem(key); } catch { return null; } };

export const forgeOnline = (body: FighterId, read: ForgeRead = stored) => read(forgeOnlineKey(body)) === '1';
export function setForgeOnline(body: FighterId, on: boolean) {
  try { if (on) localStorage.setItem(forgeOnlineKey(body), '1'); else localStorage.removeItem(forgeOnlineKey(body)); } catch { /* a private window keeps nothing */ }
}

/** `{ forge: code }` for a private room's create or join: the body's kept kit, only when "Use in private rooms" is on
 *  for this body and the kit is whole and within the online budget (forgeProblems without the sandbox); else nothing. */
export function forgeJoinOption(fighter: FighterId, read: ForgeRead = stored): { forge?: string } {
  if (!forgeOnline(fighter, read)) return {};
  try {
    const code = read(forgeDraftKey(fighter));
    if (!code) return {};
    const kit = decodeForge(code);
    return kit.body === fighter && !forgeProblems(kit, { availability: 'released' }).errors.length ? { forge: code } : {};
  } catch { return {}; }
}
