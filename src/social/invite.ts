import { inPlayerTwo, inviteLink } from '../boot/playerTwo';
import { PUBLIC_URL, TITLE } from '../originals/brand';

/** The game's address in anything shared: its public page, never the hosts behind it. */
export const GAME_URL = PUBLIC_URL;
export type RoomKind = 'private' | 'coop' | 'duel';
export type ObjectiveMode = 'last-stand' | 'bad-blood' | 'rift-war';
/** An invite's params, as Player Two's join payload and invite() take them and joinHash reads them back. */
export type InviteParams = { room: string; kind: RoomKind } | { party: string } | { mode: ObjectiveMode; room: string };

const codeOf = (p: InviteParams) => 'party' in p ? p.party : p.room;
/** The game's own link for an invite, where Player Two makes none: the public address. The room travels as its code, in
 *  the words beside the link (inviteWords) and in what is copied (social/share.ts shareInvite). */
export function ownInvite(_p?: InviteParams): string { return GAME_URL; }

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
