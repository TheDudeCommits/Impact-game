import { presence as tell } from '../boot/playerTwo';
import type { GameSnapshot } from '../game/types';
import { objectiveOf, type ObjectiveView } from '../game/objectives/model';
import { riftOf } from '../game/moba/model';
import { PARTY_MAX, type PartyView } from '../game/social/party';
import { TITLE } from '../originals/brand';
import { prefetchInvite, type InviteParams } from './invite';

/** A room the player can bring friends into, and how its line reads. */
export interface Joinable { params: InviteParams; line: string }
/** What a match's snapshot says to friends: a room to join, or only a line (matchmaking); undefined for neither. */
export interface MatchPresence { room?: Joinable; line?: string }
export interface PartyPresence { code: string; members: number; mode: string }

const OPERATIONS = { 'last-stand': 'Last Stand', 'bad-blood': 'Bad Blood', 'rift-war': 'Rift War' } as const;
const PARTY_NAMES: Record<PartyView['mode'], string> = { 'goal-rush': 'Goal Rush', 'sky-spike': 'Sky Spike', 'rift-war': 'Rift War', duel: 'Duel', royale: 'Battle Royale', 'bad-blood': 'Bad Blood', 'last-stand': 'Last Stand', survival: 'Co-op Survival' };
const code = (value: unknown): value is string => typeof value === 'string' && /^\d{6}$/.test(value);

/** A hosted operation (Last Stand, Bad Blood, Rift War) still in its lobby, with a seat open: its code is the invite's
 *  (the host's HOST FRIENDS, or a friend who joined it). A party's room has the party's own invite instead. */
function operation(view: Pick<ObjectiveView, 'phase' | 'code' | 'access' | 'party' | 'capacity'> & { seats: { bot: boolean }[] }, mode: keyof typeof OPERATIONS): MatchPresence | undefined {
  const humans = view.seats.filter(s => !s.bot).length;
  if (view.phase === 'lobby' && view.access === 'quick') return { line: `${OPERATIONS[mode]} · finding ${mode === 'last-stand' ? 'a squad' : 'players'}` };
  if (view.phase !== 'lobby' || view.party || (view.access !== 'host' && view.access !== 'join') || !code(view.code) || humans >= view.capacity) return undefined;
  return { room: { params: { mode, room: view.code }, line: `${OPERATIONS[mode]} · ${humans}/${view.capacity} · join me` } };
}

/** What this match's snapshot tells friends. `activity` is the mode's line main.ts gave (CAREER_MODES: "Duel"). */
export function matchPresence(snapshot: GameSnapshot, activity: string | null): MatchPresence | undefined {
  const rift = riftOf(snapshot);
  if (rift) return operation(rift, 'rift-war');
  const objective = objectiveOf(snapshot);
  if (objective) return operation(objective, objective.kind);
  const lobby = snapshot.lobby;
  if (!lobby || snapshot.status !== 'waiting') return undefined;
  const coop = 'survival' in snapshot, players = snapshot.players.filter(p => !p.isBot).length;
  // (A match on this device against bots counts down as a public room too: it has its bots already, as Hud's CANCEL SEARCH knows.)
  if (lobby.visibility === 'public') return snapshot.players.some(p => p.isBot) ? undefined : { line: lobby.duel ? 'Duel · finding an opponent' : `${activity ?? 'Battle Royale'} · finding players` };
  if (lobby.party || !code(lobby.code)) return undefined;
  const kind = lobby.duel ? 'duel' : coop ? 'coop' : 'private', size = lobby.duel ? 2 : coop ? 4 : lobby.size ?? 12;
  if (players >= size) return undefined;
  const line = kind === 'duel' ? 'Duel room · waiting for a friend' : `${coop ? 'Co-op Survival' : 'Private match'} · ${players}/${size} · join me`;
  return { room: { params: { room: lobby.code, kind }, line } };
}

/** The line and Join for these facts: a room friends can come into first, then the match's own line (with the party's
 *  Join, if there is one with room), then the party at home, then nothing. */
export function compose(activity: string | null, match: MatchPresence | undefined, party: PartyPresence | undefined): { text: string | null; join?: InviteParams } {
  const partyJoin = party && party.members < PARTY_MAX ? { party: party.code } : undefined;
  if (match?.room) return { text: match.room.line, join: match.room.params };
  if (activity !== null || match?.line) return { text: match?.line ?? activity, join: partyJoin };
  if (party) return { text: `In a party · ${party.members} ${party.members === 1 ? 'player' : 'players'} · ${party.mode}`, join: partyJoin };
  return { text: null };
}

let activity: string | null = null, match: MatchPresence | undefined, matchKey = '', party: PartyPresence | undefined, joinable: InviteParams | undefined;
function publish() {
  const { text, join } = compose(activity, match, party);
  joinable = join;
  tell(text, join as Record<string, string> | undefined);
  // Player Two's invite link for the same room, asked for now: COPY INVITE and SHARE then have it inside the press.
  // (Never in the way of the HUD that told it: a side channel.)
  if (join) try { prefetchInvite(join); } catch { /* the press asks again */ }
}
/** main.ts: the mode a match is (null back on the home screen, which also forgets the match's room). */
export function setActivity(text: string | null) {
  activity = text;
  if (text === null) { match = undefined; matchKey = ''; }
  publish();
}
/** Hud.update, with each snapshot of a match: told on only when what it says changes. */
export function setMatch(snapshot: GameSnapshot) {
  const next = matchPresence(snapshot, activity), k = JSON.stringify(next ?? null);
  if (k === matchKey) return;
  matchKey = k; match = next; publish();
}
/** PartyUI, whenever the party changes (undefined: not in one). */
export function setParty(view: PartyView | undefined) {
  const next = view && code(view.code) ? { code: view.code, members: view.members.length, mode: PARTY_NAMES[view.mode] ?? TITLE } : undefined;
  if (JSON.stringify(next) === JSON.stringify(party)) return;
  party = next; publish();
}
// A page loaded afresh (a reload mid-match, say) says nothing until it is somewhere: the last page's line and Join go.
if (typeof window === 'object') queueMicrotask(publish);
/** The room or party a friend could join right now, if any: a results card's link goes there (ui/results/shareResult.ts). */
export const joinableNow = () => joinable;
