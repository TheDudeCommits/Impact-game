
export interface PlayerTwoApi {
  /** Who is playing, signed by Player Two for this game (ten minutes): for the game's own server to check. */
  identity(): Promise<string>;
  /** The Player Two player, as their profile shows them. */
  player?: { handle?: string; name?: string } | null;
  /** The line friends see beside "Playing Impact" (null: none). */
  presence?: { set(text: string | null, options?: { join?: Record<string, string> }): Promise<unknown> };
  /** A link to the game on Player Two that opens it, in Player Two's player, with these params for whoever follows it. */
  invite?(params: Record<string, string>): Promise<string>;
  /** The params the player came with: a join link's, or a friend's Join (null: none). */
  params?: Record<string, string> | null;
}
interface Sdk { env?: string; init?: () => Promise<PlayerTwoApi> }
const sdk = (): Sdk | undefined => (globalThis as { PlayerTwo?: Sdk }).PlayerTwo;

let found: Promise<PlayerTwoApi | undefined> | undefined;
/** Player Two's calls inside its player, once it has answered; undefined anywhere else, and when its page had no
 *  session to give. Never rejects. */
export function playerTwo(): Promise<PlayerTwoApi | undefined> {
  return found ??= (async () => {
    const p2 = sdk();
    if (typeof p2?.init !== 'function') return undefined;
    try { const api = await p2.init(); return p2.env === 'p2' && api ? api : undefined; } catch { return undefined; }
  })();
}
/** Whether the game is in Player Two's player (its SDK says so once it has looked; before, and anywhere else, false):
 *  signed in there or not, Privy's sign-in can't work in its frame. */
export const inPlayerTwo = () => sdk()?.env === 'p2';

/** The player an identity names (its `sub`), read without checking it: only to tell whether this browser is signed in
 *  as them already. The server checks every identity it is sent. */
export function identityPlayer(token: string): string | undefined {
  try { const sub = (JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: unknown }).sub; return typeof sub === 'string' ? sub : undefined; } catch { return undefined; }
}

let shown: string | undefined;
/** What the player is doing, for their Player Two friends ("Duel", "BR vs Players"; null back on the home screen), and
 *  `join`, the params a friend's Join opens the game with (Player Two's own: `presence.set(text, { join })`, which gives
 *  friends the Join button; the game reads them back through playerTwoJoin.ts, joinHash). Told only when either changes,
 *  never waited on, and nothing at all outside Player Two. Player Two shows up to 80 characters. */
export function presence(text: string | null, join?: Record<string, string>) {
  const line = text === null ? null : text.length > 80 ? `${text.slice(0, 79)}…` : text, key = JSON.stringify([line, join ?? null]);
  if (key === shown) return;
  shown = key;
  void playerTwo().then(p2 => join ? p2?.presence?.set(line, { join }) : p2?.presence?.set(line)).catch(() => { /* Friends see the last line, or none. */ });
}

/** A link that brings a friend in: Player Two's, inside its player (it opens the game in Player Two's player, with these
 *  params); `own`, the game's own address, anywhere else, or when Player Two can't make one just now. */
export async function inviteLink(params: Record<string, string>, own: string): Promise<string> {
  if (!inPlayerTwo()) return own;
  try { return (await (await playerTwo())?.invite?.(params)) ?? own; } catch { return own; }
}

/** The params a Player Two link brought, as the game's own invite links carry them in the address: a room
 *  (#room=&kind=, ui/roomInvite.ts), a party (#party=, social/PartyUI.ts), or a Last Stand, Bad Blood or Rift War room
 *  (#mode=&room=, objectives/ObjectiveUI.ts, modes/HomeShell.ts); '' for anything else. Anyone can make a link: read as
 *  the address's own are, six-digit codes and known kinds only. */
export function joinHash(params: unknown): string {
  if (!params || typeof params !== 'object') return '';
  const p = params as Record<string, unknown>, code = (value: unknown) => typeof value === 'string' && /^\d{6}$/.test(value) ? value : undefined;
  const room = code(p.room), party = code(p.party);
  if (party) return `#party=${party}`;
  if (room && (p.kind === 'private' || p.kind === 'coop' || p.kind === 'duel')) return `#${new URLSearchParams({ room, kind: p.kind })}`;
  if (room && (p.mode === 'last-stand' || p.mode === 'bad-blood' || p.mode === 'rift-war')) return `#${new URLSearchParams({ mode: p.mode, room })}`;
  return '';
}
