import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameSnapshot } from '../src/game/types';
import { TITLE } from '../src/originals/brand';
import { FIGHTERS } from '../src/config';
import { GAME_URL } from '../src/social/invite';

type Calls = { presence: [string | null, unknown][]; invites: Record<string, string>[] };
function sdk(calls: Calls) {
  const api = {
    identity: async () => 'a.b.c', params: null,
    presence: { set: async (text: string | null, options?: { join?: Record<string, string> }) => { calls.presence.push([text, options?.join ?? null]); } },
    invite: async (p: Record<string, string>) => { calls.invites.push(p); return `https://playertwo.lol/game/impact?join=${Buffer.from(JSON.stringify(p)).toString('base64url')}`; },
  };
  const p2 = { env: 'disabled', init: async () => { p2.env = 'p2'; return api; } };
  return p2;
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const inP2 = async () => {
  const calls: Calls = { presence: [], invites: [] };
  (globalThis as { PlayerTwo?: unknown }).PlayerTwo = sdk(calls);
  vi.stubGlobal('location', new URL('https://impact.playertwo.cc/'));
  vi.resetModules();
  const presence = await import('../src/social/presence'), invite = await import('../src/social/invite'), boot = await import('../src/boot/playerTwo');
  await boot.playerTwo();
  return { calls, presence, invite };
};
afterEach(() => { delete (globalThis as { PlayerTwo?: unknown }).PlayerTwo; vi.unstubAllGlobals(); });

const player = (id: string, isBot = false) => ({ id, isBot, fighter: 'konta', name: id }) as unknown as GameSnapshot['players'][number];
const room = (lobby: Partial<NonNullable<GameSnapshot['lobby']>>, players = 1, extra: Record<string, unknown> = {}) =>
  ({ status: 'waiting', players: Array.from({ length: players }, (_, i) => player(`p${i}`)), lobby: { visibility: 'private', hostId: 'p0', canStart: true, startsAt: null, expiresAt: null, code: '518389', ...lobby }, ...extra }) as unknown as GameSnapshot;
const operation = (view: Record<string, unknown>) => ({ status: 'waiting', players: [], objective: { kind: 'last-stand', phase: 'lobby', access: 'host', code: '222333', capacity: 4, seats: [{ bot: false }], ...view } }) as unknown as GameSnapshot;

describe('Player Two presence: the line, and a Join while a friend can come in (src/social/presence.ts)', () => {
  it('reads which rooms friends can join from a match snapshot', async () => {
    const { matchPresence } = await import('../src/social/presence');
    expect(matchPresence(room({ duel: true }), 'Duel')).toEqual({ room: { params: { room: '518389', kind: 'duel' }, line: 'Duel room · waiting for a friend' } });
    expect(matchPresence(room({ size: 8 }, 3), 'Private Royale')?.room).toEqual({ params: { room: '518389', kind: 'private' }, line: 'Private match · 3/8 · join me' });
    expect(matchPresence(room({}, 2, { survival: {} }), 'Co-op Survival')?.room?.params).toEqual({ room: '518389', kind: 'coop' });
    // Full, a party's own room (the party has its own invite), started: nothing to join.
    expect(matchPresence(room({ duel: true }, 2), 'Duel')).toBeUndefined();
    expect(matchPresence(room({ party: true }), 'Duel')).toBeUndefined();
    expect(matchPresence({ ...room({}), status: 'active' } as GameSnapshot, 'Duel')).toBeUndefined();
    // Matchmaking says it is looking, with nothing to join.
    expect(matchPresence(room({ visibility: 'public', duel: true, code: undefined }), 'Duel')).toEqual({ line: 'Duel · finding an opponent' });
    expect(matchPresence(room({ visibility: 'public', code: undefined }), 'BR vs Players')).toEqual({ line: 'BR vs Players · finding players' });
    // A bot Duel on this device counts down as a public room with its bot in it: no search to speak of.
    expect(matchPresence({ ...room({ visibility: 'public', duel: true, code: undefined }), players: [player('me'), player('bot', true)] } as GameSnapshot, 'Duel')).toBeUndefined();
    // A hosted operation's lobby, with a seat open; not once it deploys, not a party's, not a full one.
    expect(matchPresence(operation({}), 'Last Stand')?.room).toEqual({ params: { mode: 'last-stand', room: '222333' }, line: 'Last Stand · 1/4 · join me' });
    expect(matchPresence(operation({ kind: 'bad-blood', access: 'join', capacity: 6 }), 'Bad Blood')?.room?.params).toEqual({ mode: 'bad-blood', room: '222333' });
    expect(matchPresence(operation({ phase: 'countdown' }), 'Last Stand')).toBeUndefined();
    expect(matchPresence(operation({ party: true }), 'Last Stand')).toBeUndefined();
    expect(matchPresence(operation({ seats: Array(4).fill({ bot: false }) }), 'Last Stand')).toBeUndefined();
    expect(matchPresence(operation({ access: 'quick' }), 'Last Stand')).toEqual({ line: 'Last Stand · finding a squad' });
    const rift = { status: 'waiting', players: [], rift: { kind: 'rift-war', phase: 'lobby', access: 'host', code: '777888', capacity: 10, seats: [{ bot: false }, { bot: true }] } } as unknown as GameSnapshot;
    expect(matchPresence(rift, 'Rift War')?.room).toEqual({ params: { mode: 'rift-war', room: '777888' }, line: 'Rift War · 1/10 · join me' });
  });

  it('puts the room first, then the match, then the party at home, then nothing', async () => {
    const { compose } = await import('../src/social/presence');
    const party = { code: '654321', members: 3, mode: 'Rift War' };
    const open = { room: { params: { room: '518389', kind: 'duel' as const }, line: 'Duel room · waiting for a friend' } };
    expect(compose('Duel', open, party)).toEqual({ text: 'Duel room · waiting for a friend', join: { room: '518389', kind: 'duel' } });
    expect(compose('Duel', undefined, party)).toEqual({ text: 'Duel', join: { party: '654321' } });
    expect(compose('Duel', { line: 'Duel · finding an opponent' }, undefined)).toEqual({ text: 'Duel · finding an opponent', join: undefined });
    expect(compose(null, undefined, party)).toEqual({ text: 'In a party · 3 players · Rift War', join: { party: '654321' } });
    expect(compose(null, undefined, { ...party, members: 12 })).toEqual({ text: 'In a party · 12 players · Rift War', join: undefined });
    expect(compose(null, undefined, undefined)).toEqual({ text: null });
  });

  it('tells Player Two the line with the join payload, asks for its invite link ahead, and clears to null at home', async () => {
    const { calls, presence, invite } = await inP2();
    presence.setActivity('Duel');
    presence.setMatch(room({ duel: true }));
    presence.setMatch(room({ duel: true })); // the same snapshot again: not told twice
    await settle(); await settle();
    expect(calls.presence).toEqual([['Duel', null], ['Duel room · waiting for a friend', { room: '518389', kind: 'duel' }]]);
    // The join payload goes through the game's own reading of a Join (boot/playerTwo.ts joinHash) to the same room.
    const { joinHash } = await import('../src/boot/playerTwo');
    expect(joinHash(calls.presence[1][1])).toBe('#room=518389&kind=duel');
    // Player Two's invite link for the room was asked for already: a press has it at once.
    expect(calls.invites).toEqual([{ room: '518389', kind: 'duel' }]);
    expect(invite.inviteNow({ room: '518389', kind: 'duel' })).toMatch(/^https:\/\/playertwo\.lol\/game\/impact\?join=/);
    expect(presence.joinableNow()).toEqual({ room: '518389', kind: 'duel' });
    presence.setMatch({ ...room({ duel: true }, 2), status: 'active' } as GameSnapshot);
    presence.setActivity(null);
    await settle();
    expect(calls.presence.slice(2)).toEqual([['Duel', null], [null, null]]);
    // A party, at home and in its match.
    presence.setParty({ code: '654321', leader: 'a', mode: 'duel', members: [{}, {}], rules: {}, votes: {}, launching: false } as never);
    presence.setActivity('Duel');
    presence.setParty(undefined); presence.setActivity(null);
    await settle();
    expect(calls.presence.slice(4)).toEqual([['In a party · 2 players · Duel', { party: '654321' }], ['Duel', { party: '654321' }], ['Duel', null], [null, null]]);
  });

  it('cuts a line to Player Two\'s 80 characters', async () => {
    const { calls } = await inP2();
    const { presence } = await import('../src/boot/playerTwo');
    presence('x'.repeat(100)); await settle();
    expect(calls.presence[0][0]).toHaveLength(80);
  });
});

describe('Invite links (src/social/invite.ts)', () => {
  const ALL = [{ room: '518389', kind: 'duel' }, { room: '518389', kind: 'private' }, { room: '518389', kind: 'coop' }, { party: '518389' }, { mode: 'last-stand', room: '518389' }, { mode: 'bad-blood', room: '518389' }, { mode: 'rift-war', room: '518389' }] as const;

  it('makes the # link on the page\'s own address', async () => {
    vi.resetModules();
    const { ownInvite, JOIN_HOSTS } = await import('../src/social/invite');
    expect(ownInvite({ room: '518389', kind: 'duel' }, 'https://game.example.com/?x=1#old')).toBe('https://game.example.com/#room=518389&kind=duel');
    expect(ownInvite({ mode: 'rift-war', room: '111222' }, 'http://127.0.0.1:5403/?local-training')).toBe('http://127.0.0.1:5403/#mode=rift-war&room=111222');
    expect(JOIN_HOSTS.test('game.example.com')).toBe(false);
  });

  it('says what the invite is beside its link', async () => {
    const { inviteWords } = await import('../src/social/invite');
    expect(inviteWords({ room: '518389', kind: 'duel' })).toEqual({ title: `Join my Duel · ${TITLE}`, text: `Join my Duel in ${TITLE}. Room code 518389.` });
    expect(inviteWords({ party: '654321' }).text).toBe(`Join my party in ${TITLE}. Party code 654321.`);
  });
});

describe('One SHARE (src/social/share.ts)', () => {
  it('opens the share sheet or starts the copy inside the press, before anything is awaited', async () => {
    vi.resetModules();
    const { shareOrCopy, shareInvite } = await import('../src/social/share');
    const shared: unknown[] = [], copied: string[] = [];
    vi.stubGlobal('navigator', { share: async (data: unknown) => { shared.push(data); }, clipboard: { writeText: async (text: string) => { copied.push(text); } } });
    vi.stubGlobal('document', {});
    const data = { title: 't', text: 'x', url: 'https://game.example.com/join/518389?kind=duel' };
    const pending = shareOrCopy(data, true);
    expect(shared).toEqual([data]); // called synchronously, inside the press
    expect(await pending).toBe('shared');
    const copying = shareOrCopy(data, false);
    expect(copied).toEqual([data.url]);
    expect(await copying).toBe('copied');
    // An invite outside Player Two: its link is made at once, so the copy starts inside the press too.
    vi.stubGlobal('location', new URL('https://game.example.com/'));
    const invited = shareInvite({ party: '654321' }, false);
    expect(copied.at(-1)).toBe('https://game.example.com/#party=654321');
    expect(await invited).toEqual({ result: 'copied', url: 'https://game.example.com/#party=654321' });
  });

  it('copies when the sheet is closed by refusal, and says nothing when the player cancels it', async () => {
    vi.resetModules();
    const { shareOrCopy } = await import('../src/social/share');
    const copied: string[] = [];
    vi.stubGlobal('document', {});
    vi.stubGlobal('navigator', { share: async () => { throw new DOMException('no', 'NotAllowedError'); }, clipboard: { writeText: async (text: string) => { copied.push(text); } } });
    expect(await shareOrCopy({ title: '', text: '', url: 'u' }, true)).toBe('copied');
    vi.stubGlobal('navigator', { share: async () => { throw new DOMException('cancel', 'AbortError'); }, clipboard: { writeText: async (text: string) => { copied.push(text); } } });
    expect(await shareOrCopy({ title: '', text: '', url: 'v' }, true)).toBe('aborted');
    expect(copied).toEqual(['u']);
  });
});

describe('Result cards (src/ui/results/shareResult.ts)', () => {
  it('lays Rift War\'s result on the card, and words it with the game\'s link', async () => {
    const { riftResultCard, cardSpec, resultWords } = await import('../src/ui/results/shareResult');
    const view = { kind: 'rift-war', phase: 'over', access: 'host', winner: 'heroes', reason: 'The Villains\' core has fallen.', startedAt: 10, endsAt: 742 } as never;
    const seat = { name: 'Amir', fighter: 'konta', team: 'heroes', kills: 7, deaths: 2, assists: 5, lastHits: 41, structures: 3, level: 11 } as never;
    const card = riftResultCard(view, seat);
    expect(card).toMatchObject({ mode: 'RIFT WAR', way: 'FRIENDS', outcome: 'VICTORY', tone: 'win', key: { value: '7/2/5', label: 'K / D / A' }, where: 'THE TORN PLAIN · 12:12' });
    const spec = cardSpec(card);
    expect(spec).toMatchObject({ corner: ['RIFT WAR', 'FRIENDS'], title: 'VICTORY', stats: [['41', 'LAST HITS'], ['3', 'STRUCTURES'], ['11', 'FINAL LEVEL']] });
    expect(cardSpec({ ...card, key: { value: '#1', label: 'OF 12 FIGHTERS' } }).key.label).toBe('PLACE · OF 12 FIGHTERS');
    expect(resultWords(card)).toEqual({ title: `VICTORY · Rift War · ${TITLE}`, text: `Victory in Rift War as ${FIGHTERS.konta.name} (7/2/5, 41 last hits). Play ${TITLE} free in your browser.` });
    const { resultLink } = await import('../src/ui/results/resultLink');
    expect(resultLink()).toBe(GAME_URL);
  });
});
