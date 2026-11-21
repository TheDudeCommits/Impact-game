/* What a page and Impact's PlayerTwo room (room.ts) agree on, beside the rooms' own messages: shared by both. */

/** The room kinds that run on PlayerTwo (their Colyseus names on the match server). */
export const P2_KINDS = ['arena', 'bot_arena', 'private_arena', 'duel_arena', 'private_duel', 'ball_arena', 'rift_war', 'objective_arena', 'survival_arena', 'party'] as const;
export type P2Kind = typeof P2_KINDS[number];

/** The messages that go packed and deflated (`$z`): their place here is the first byte of each. */
export const P2_COMPRESSED = ['snapshot', 'input-resync'] as const;
/** How much of the previous packed message is the next one's deflate dictionary (DEFLATE's window: 32 KB). */
export const P2_DICTIONARY = 32 * 1024;

/** The protocol of this pair: a room's mode name carries it, so PlayerTwo never matches pages of two versions (a new
 *  build's pages are only ever seated with that build's anyway). */
export const P2_ROOM_PROTOCOL = 1;

/** Each kind's short name in PlayerTwo's mode names. */
const SHORT: Record<P2Kind, string> = { arena: 'royale', bot_arena: 'bots', private_arena: 'private', duel_arena: 'duel', private_duel: 'pduel', ball_arena: 'ball', rift_war: 'rift', objective_arena: 'obj', survival_arena: 'coop', party: 'party' };
/** PlayerTwo's matching mode for a kind (its rule: letters, digits, - and _, up to 32): the protocol, the kind, and for a
 *  ball queue the values Colyseus matched it by (BallRoom's filterBy: ball, access, queue, mutator, band), so a match
 *  only ever seats pages of one version, one kind and one queue together. */
export function p2Mode(kind: P2Kind, filter: readonly unknown[] = []): string {
  const parts = filter.map(v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 8));
  return [`i${P2_ROOM_PROTOCOL}`, SHORT[kind], ...parts].join('-').slice(0, 32);
}
