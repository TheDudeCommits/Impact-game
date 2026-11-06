import { inPlayerTwo, inviteLink, joinHash } from '../boot/playerTwo';
import { SITE_URL, TITLE } from '../originals/brand';

export const GAME_URL = SITE_URL;
export type RoomKind = 'private' | 'coop' | 'duel';
export type ObjectiveMode = 'last-stand' | 'bad-blood' | 'rift-war';
/** An invite's params, as Player Two's join payload and invite() take them and joinHash reads them back. */
export type InviteParams = { room: string; kind: RoomKind } | { party: string } | { mode: ObjectiveMode; room: string };

/** Hosts that serve a /join/<code> preview page for invites (none by default: a deployment that adds such a page names its
 *  host in VITE_JOIN_HOST). Anywhere else an invite is this page's address with the invite after #. */
const JOIN_HOST = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_JOIN_HOST ?? '').trim();
export const JOIN_HOSTS = { test: (host: string) => !!JOIN_HOST && host === JOIN_HOST };

const codeOf = (p: InviteParams) => 'party' in p ? p.party : p.room;
/** The /join/ page's kind for these params: the room's kind, `party`, or the operation. */
export const joinKind = (p: InviteParams) => 'party' in p ? 'party' : 'mode' in p ? p.mode : p.kind;
/** The path whose page previews this invite and opens it. */
export const joinPath = (p: InviteParams) => `/join/${codeOf(p)}?kind=${joinKind(p)}`;

/** The game's own link for an invite: the /join/ page where this deployment serves it, else this page's address with
 *  the invite after # (search dropped: a link carries only the invitation). */
export function ownInvite(p: InviteParams, href = location.href): string {
  const url = new URL(href);
  if (JOIN_HOSTS.test(url.hostname) && url.protocol === 'https:') return `${url.origin}${joinPath(p)}`;
  url.search = ''; url.hash = joinHash(p).slice(1);
  return url.href;
}

const key = (p: InviteParams) => JSON.stringify(p);
const made = new Map<string, string>(), asking = new Map<string, Promise<string>>();
/** Inside Player Two: ask it for this invite's link now, so a tap later has it at hand. Asked once per invite; one that
 *  failed is asked again by the next prefetch or tap. Nothing anywhere else (the game's own link is made at once). */
export function prefetchInvite(p: InviteParams) {
  if (!inPlayerTwo()) return;
  const k = key(p);
  if (made.has(k) || asking.has(k)) return;
  const own = ownInvite(p);
  asking.set(k, inviteLink(p, own).then(link => { asking.delete(k); if (link !== own) made.set(k, link); return link; }));
}
/** The invite's link now, without waiting: the game's own outside Player Two, Player Two's once it has answered, and
 *  undefined inside Player Two before then. */
export function inviteNow(p: InviteParams): string | undefined {
  return inPlayerTwo() ? made.get(key(p)) : ownInvite(p);
}
/** The invite's link, waiting for Player Two's where it must. */
export async function inviteFor(p: InviteParams): Promise<string> {
  const now = inviteNow(p);
  if (now) return now;
  prefetchInvite(p);
  return await asking.get(key(p)) ?? ownInvite(p);
}
/** (Tests: forget Player Two's links.) */
export function forgetInvites() { made.clear(); asking.clear(); }

/** What an invite says beside its link, in a share sheet: "Join my Duel", and the code to type in by hand. */
export function inviteWords(p: InviteParams): { title: string; text: string } {
  const code = codeOf(p), what = 'party' in p ? 'party' : 'mode' in p ? ({ 'last-stand': 'Last Stand', 'bad-blood': 'Bad Blood match', 'rift-war': 'Rift War' } as const)[p.mode]
    : ({ duel: 'Duel', coop: 'co-op run', private: 'private match' } as const)[p.kind];
  return { title: `Join my ${what} · ${TITLE}`, text: `Join my ${what} in ${TITLE}. ${'party' in p ? 'Party' : 'Room'} code ${code}.` };
}
