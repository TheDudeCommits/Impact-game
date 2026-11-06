import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matchResults } from '../MatchResults';
import type { GameSnapshot, PlayerState } from '../../game/types';
import { FallOrder } from './placement';
import { MatchWatcher } from '../shop/report';
import { resultsFrame, type ResultsModel } from './ResultsFrame';
import { objectiveResults } from './objectiveResults';
import { dockText } from '../modes/WaitingDock';
import { statusLine } from '../menu/GameMenu';
import type { ModeHudFrame } from '../hud/modeHud';

const player = (id: string, alive = true, extra: Partial<PlayerState> = {}) => ({ id, name: id, fighter: 'konta', alive, isBot: true, hp: 1000, maxHp: 1000, kills: 0, damageDealt: 0, damageTaken: 0, ...extra }) as unknown as PlayerState;
const snap = (players: PlayerState[], extra: Record<string, unknown> = {}) => ({ players, events: [], serverTime: 10, roomMode: 'match', status: 'active', winnerId: null, stage: 'harbor', ...extra }) as unknown as GameSnapshot;
const frame = (snapshot: GameSnapshot, self: PlayerState, extra: Partial<ModeHudFrame> = {}) => ({ snapshot, self, phase: 'active', input: 'keyboard', family: 'generic', now: 0, ...extra }) as ModeHudFrame;

describe('one ranking for the card and the payout', () => {
  it('places a fighter by when they fell, not by who was left a second later', () => {
    const order = new FallOrder();
    const a = player('a'), b = player('b'), me = player('me', true, { isBot: false }), c = player('c');
    order.observe(snap([a, b, me, c]));
    b.alive = false; order.observe(snap([a, b, me, c], { serverTime: 11 }));
    me.alive = false; order.observe(snap([a, b, me, c], { serverTime: 12 }));
    // A second later, a third fighter is down too: the player still placed third of four.
    c.alive = false;
    expect(order.place([a, b, me, c], null, 'me')).toBe(3);
    order.observe(snap([a, b, me, c], { serverTime: 12.5 }));
    expect(order.place([a, b, me, c], 'a', 'me')).toBe(3);
    expect(order.fallen).toEqual(['b', 'me', 'c']);
  });
  it('starts again while a room waits, and ignores training', () => {
    const order = new FallOrder(), down = player('x', false);
    order.observe(snap([down])); expect(order.fallen).toEqual(['x']);
    order.observe(snap([down], { status: 'waiting' })); expect(order.fallen).toEqual([]);
    order.observe(snap([down], { roomMode: 'training' })); expect(order.fallen).toEqual([]);
  });
  it("pays the shop's watcher the card's place", () => {
    const watcher = new MatchWatcher(() => 3), me = player('me', true, { isBot: false });
    expect(watcher.look({ status: 'active', roomMode: 'match', winnerId: null, players: [me, player('a'), player('b'), player('c')] }, 'me', 1)).toBeUndefined();
    me.alive = false;
    expect(watcher.look({ status: 'active', roomMode: 'match', winnerId: null, players: [me, player('a', false), player('b', false), player('c')] }, 'me', 2)).toMatchObject({ place: 3, players: 4 });
  });
});

describe('the one results frame', () => {
  it('draws every slot, and the actions in one order', () => {
    const html = resultsFrame({ mast: 'DUEL · VS BOT', where: 'ARENA · 0:39', fighter: 'konta', fighterName: 'Konta', kicker: 'KONTA', outcome: 'DEFEAT', line: 'X knocked you out.', key: { value: '0–1', label: 'KNOCKOUTS' }, stats: [['0', 'KOs'], ['0', 'DEALT'], ['1,000', 'TAKEN']], details: { summary: 'THE FIGHT', html: '<p>rows</p>' }, again: { label: 'PLAY AGAIN', sub: 'SAME', attrs: 'id="results-again"' }, training: 'id="results-practice"', home: 'id="results-leave"' });
    for (const slot of ['results-masthead', 'results-headline', 'results-key', 'results-stats', 'results-standings', 'data-results-rewards', 'results-actions']) expect(html).toContain(slot);
    const order = [...html.matchAll(/<button[^>]*>(?:<span>)?([A-Z ]+)/g)].map(m => m[1].trim());
    expect(order).toEqual(['PLAY AGAIN', 'CHANGE MODE', 'TRAINING', 'HOME']);
    expect(html).toContain('id="results-again"'); expect(html).toContain('data-results="change"'); expect(html).not.toMatch(/clip/i);
  });
  it("keeps an operation's own rematch and departure hooks", () => {
    const seat = (id: string, team: string) => ({ id, fighter: 'konta', name: id, team, bot: id !== 'me', revivesLeft: 0, rescue: 0, down: false, points: 0, spent: 0, repairs: 0, revives: 0, bosses: 0 });
    const v = { kind: 'bad-blood', phase: 'over', round: 1, hostId: 'me', access: 'bots', seats: [seat('me', 'heroes'), seat('v', 'villains')], capacity: 6, startsAt: null, endsAt: 75, startedAt: 0, winner: 'villains', reason: '', fillBots: true } as never;
    const html = objectiveResults(v, snap([player('me', false), player('v')]), 'me');
    expect(html).toContain('data-command="rematch"'); expect(html).toContain('data-leave'); expect(html).toContain('DEFEAT');
    expect(html).toContain('HEROES eliminated. VILLAINS win.'); expect(html).toContain('BAD BLOOD · WITH BOTS');
    const draw = objectiveResults({ ...(v as object), winner: 'draw' } as never, snap([player('me', false), player('v', false)]), 'me');
    expect(draw).toContain('is-draw'); expect(draw).toContain('>分<'); expect(draw).toContain('Both teams fell at the same time.');
  });
});

describe('waiting, and the menu', () => {
  it("says how long, who joined and when bots fill, for a public room", () => {
    const me = player('me', true, { isBot: false }), other = player('o', true, { isBot: false });
    const text = dockText(frame(snap([me, other], { status: 'waiting', serverTime: 5, lobby: { visibility: 'public', hostId: null, canStart: true, startsAt: 13, expiresAt: null } }), me, { phase: 'waiting' }), 12);
    expect(text).toEqual({ title: 'FINDING PLAYERS · 0:12', detail: '2 / 12 JOINED · BOTS FILL TO 6 IN 8s', cancel: 'CANCEL' });
  });
  it('makes the duel queue readable, and a friends room says its seats', () => {
    const me = player('me', true, { isBot: false });
    expect(dockText(frame(snap([me], { status: 'waiting', lobby: { duel: true, visibility: 'public', hostId: null, canStart: false, startsAt: null, expiresAt: null } }), me, { phase: 'waiting' }), 41)).toMatchObject({ title: 'FINDING AN OPPONENT · 0:41', cancel: 'CANCEL' });
    expect(dockText(frame(snap([me], { status: 'waiting', lobby: { visibility: 'private', code: '123456', size: 4, hostId: 'me', canStart: true, startsAt: null, expiresAt: 900 } }), me, { phase: 'waiting' }), 3)).toEqual({ title: 'YOUR ROOM · 123456', detail: '1 / 4 JOINED · 3 BOTS AT START' });
    expect(dockText(frame(snap([me]), me), 0)).toBeUndefined();
  });
  it("puts where the match stands in the menu's live line", () => {
    const me = player('me', true, { kills: 2 });
    expect(statusLine('royale', frame(snap([me, player('a'), player('b', false)]), me))).toBe('2 LEFT · YOUR KOs 2');
    expect(statusLine('bad-blood', frame(snap([player('h', true, { team: 'heroes' }), player('v', true, { team: 'villains' }), player('w', false, { team: 'villains' })]), me))).toBe('HEROES 1 · VILLAINS 1');
    expect(statusLine('duel', undefined)).toBe('');
  });
});

describe('a results card whose room is gone (19 October 2026)', () => {
  // (The match server closes a match room five minutes after its end, 4006: the card stays, and its buttons play on without it.)
  it("offers PLAY AGAIN's own way instead of a Duel's RUN IT BACK - never disabled - and keeps the rest of the card", () => {
    const me = player('me', true, { isBot: false, fighter: 'konta' }), rival = player('rival', false, { isBot: false });
    const duel = { set: 1, round: 2, firstTo: 2, scores: { me: 2 }, phase: 'complete', nextRoundAt: null, roundWinner: 'me', winner: 'me', runback: ['me'] };
    const finished = snap([me, rival], { status: 'finished', winnerId: 'me', lobby: { duel: true, visibility: 'public' }, duel });
    const live = matchResults(finished, me, ['rival'], 'FIND NEXT DUEL');
    expect(live).toContain('RUN IT BACK'); expect(live).toContain('WAITING FOR YOUR RIVAL'); expect(live).toMatch(/id="results-again"[^>]* disabled>/);
    const gone = matchResults(finished, me, ['rival'], 'FIND NEXT DUEL', true);
    expect(gone).not.toContain('RUN IT BACK'); expect(gone).not.toMatch(/ disabled>/);
    expect(gone).toMatch(/id="results-again"[^>]*><span>PLAY AGAIN<\/span><small>A NEW OPPONENT<\/small>/);
    expect(gone).toContain('VICTORY'); expect(gone).toContain('2–0'); expect(gone).toContain('id="results-leave"'); expect(gone).toContain('id="results-practice"');
    // A royale's card is the same with its room or without.
    const royale = snap([me, rival], { status: 'finished', winnerId: 'me', lobby: { visibility: 'public' } });
    expect(matchResults(royale, me, ['rival'], 'PLAY AGAIN', true)).toBe(matchResults(royale, me, ['rival'], 'PLAY AGAIN'));
  });
  it('is kept on screen by the page when its room is closed for being over: no RECONNECTING, no banner, the buttons free of the room', () => {
    const main = fs.readFileSync('src/main.ts', 'utf8'), network = fs.readFileSync('src/network.ts', 'utf8');
    expect(network).toContain('this.onDisconnect(closeMessage(code),code);');
    expect(main).toContain('each.onDisconnect=(reason,code)=>{\n  const over=code===4006;');
    expect(main).toContain('hud.roomGone=true;hud.update(shown,self,undefined,over);if(over)hud.link(undefined);riftUI.update(shown,finaleSelf);if(!over)hud.banner(reason);return;');
    // PLAY AGAIN asks the room for a runback only while the page still has its snapshot: a room gone has none.
    expect(main).toContain("hud.onPlayAgain=()=>{if(network.snapshot?.duel?.phase==='complete'");
  });
});

describe('a couch royale\'s card (couch/couch.ts, 2 November 2026)', () => {
  it('is the better placed of the two people, names both, and leaves the bots unnamed', () => {
    const one = player('you', false, { isBot: false, fighter: 'taisei', name: 'Fighter' }), two = player('p2', true, { isBot: false, fighter: 'konta', name: 'Player 2' });
    const bot = player('bot-1', true, { fighter: 'kenzo' }), other = player('bot-2', false, { fighter: 'gummy' });
    const won = matchResults(snap([one, two, bot, other], { status: 'finished', winnerId: 'p2', lobby: { visibility: 'public' } }), one, ['bot-2', 'you', 'bot-1'], 'PLAY AGAIN');
    expect(won).toContain('P2 WINS'); expect(won).toContain('COUCH'); expect(won).toContain('is the last one standing');
    expect(won).toMatch(/· P1<\/strong>/); expect(won).toMatch(/· P2<\/strong>/); expect(won).not.toContain('· YOU');
    // Neither of them won: the card is the one placed higher, with both places on its line.
    const lost = matchResults(snap([one, two, bot, other], { status: 'finished', winnerId: 'bot-1', lobby: { visibility: 'public' } }), one, ['bot-2', 'you', 'p2'], 'PLAY AGAIN');
    expect(lost).toContain('MATCH OVER'); expect(lost).toMatch(/P2 #2 · P1 #3 of 4\./);
  });
});
