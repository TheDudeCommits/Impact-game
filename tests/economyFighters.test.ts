import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from 'colyseus';
import { ITEM, ITEMS, priceOf } from '../src/game/economy/catalog';
import { HELD, LOCKED, lockedOut, mayPlay } from '../src/game/economy/fighters';
import { buy, cannotBuy, newAccount, owns, wear } from '../src/game/economy/account';
import { xpAt } from '../src/game/economy/earn';
import { BANDS } from '../src/game/economy/unlocks';
import { FIGHTERS } from '../src/config';
import { HOME_FIGHTERS, HOME_FIGHTERS_2 } from '../src/ui/MangaHome';
import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import fs from 'node:fs';
import { hasPoseSheet } from '../src/ui/HomePreview';
import { ArenaRoom, draftBots } from '../src/server/ArenaRoom';
import { ArenaSimulation } from '../src/game/simulation';
import { SurvivalRoom } from '../src/server/SurvivalRoom';
import { mountEconomy } from '../src/server/economy/api';
import type { FighterId } from '../src/game/types';
import { fighterShown } from '../src/originals/launch';

afterEach(() => vi.restoreAllMocks());
const client = (sessionId: string) => ({ sessionId, send: vi.fn() } as unknown as Client);

const shown = (...ids: FighterId[]) => ids.every(fighterShown);
describe('fighters to unlock', () => {
  it('locks each fighter with an item on sale, and only those', () => {
    const sold = ITEMS.filter(item => item.kind === 'fighter' && item.stage === 'live');
    expect(sold.map(item => item.fighter).sort()).toEqual([...LOCKED.keys()].sort());
    for (const item of sold) {
      expect(FIGHTERS[item.fighter!], item.id).toBeDefined();
      // Never one of the first volume's sixteen: those are everyone's.
      expect(HOME_FIGHTERS).not.toContain(item.fighter);
      expect(item.id).toBe(`fighter-${item.fighter}`);
    }
    for (const id of HOME_FIGHTERS) expect(mayPlay(id, { items: {} }), id).toBe(true);
    expect(HOME_FIGHTERS).toHaveLength(16);
    for (const id of RELEASED_FIGHTERS.filter(each => !HOME_FIGHTERS.includes(each) && fighterShown(each))) {
      expect(LOCKED.get(id), id).toBe(`fighter-${id}`);
      expect(mayPlay(id, { items: {} }), id).toBe(false);
    }
    for (const id of HOME_FIGHTERS_2) expect(LOCKED.has(id), id).toBe(true);
    // Each fighter to unlock has its home art: a portrait and a poster (the shop's cards and its weekly cover), a
    // full-body page, and a sheet of cels where the home-screen agent's sprite manifest lists one.
    for (const id of LOCKED.keys()) {
      expect(fs.existsSync(`public/assets/home/fighters/${id}.webp`), id).toBe(true);
      for (const file of [`public/assets/home/portraits/${id}.webp`, `public/assets/home/sprites/${id}-poster.webp`])
        expect(fs.existsSync(file), file).toBe(true);
      if (hasPoseSheet(id)) expect(fs.existsSync(`public/assets/home/sprites/${id}.webp`), id).toBe(true);
    }
  });

  // A fighter built before his home-screen art has landed waits with his item at `next` (Magatsu did, 1 October):
  // until it is live he is not sold, not on the home screen, never anyone's bot, and plays only in the Training
  // Ground. Held is exactly the fighters whose item is not live, and whoever is held now is checked.
  it('holds a fighter back until his item is on sale', () => {
    const waiting = ITEMS.filter(item => item.kind === 'fighter' && item.stage !== 'live').map(item => item.fighter!);
    for (const id of waiting) expect(HELD.has(id), id).toBe(true);
    for (const id of HELD) expect(waiting.includes(id) || !fighterShown(id), id).toBe(true);
    for (const id of HELD) {
      expect(FIGHTERS[id], id).toBeDefined();
      expect(LOCKED.has(id), id).toBe(false);
      expect(HOME_FIGHTERS_2, id).not.toContain(id);
      expect(mayPlay(id, { items: {} }), id).toBe(false);
      expect(lockedOut(id, { items: {} }), id).toMatch(/not out yet|not available/);
      expect(draftBots([], 400, items => [...items]), id).not.toContain(id);
      for (let seed = 1; seed <= 60; seed++) {
        const sim = new ArenaSimulation({ roomMode: 'training', seed });
        sim.addPlayer('human', 'kenzo', 'Human');
        expect(sim.getPlayer('sparring-bot')?.fighter, `seed ${seed}`).not.toBe(id);
        sim.dispose?.();
      }
    }
  });

  it.skipIf(!shown(...ITEMS.filter(item => item.kind === 'fighter').map(item => item.fighter!)))("prices every one by its ranks, at half the old bands", () => {
    expect(BANDS).toEqual({ fighterCrown: 1200, fighterFirst: 1000, fighterSecond: 800, fighterThird: 600 });
    for (const [, id] of LOCKED) {
      const item = ITEM.get(id)!;
      expect(item.stage, id).toBe('live');                         // every one can be bought, the road's too
      expect(Object.values(BANDS), id).toContain(item.price);
      expect(priceOf(item)).toBe(item.price);
    }
    for (const id of RELEASED_FIGHTERS.filter(each => !HOME_FIGHTERS.includes(each) && !HOME_FIGHTERS_2.includes(each)))
      expect(priceOf(ITEM.get(`fighter-${id}`)!), id).toBe(BANDS.fighterThird);
    expect(priceOf(ITEM.get('fighter-dorado')!)).toBe(Math.max(...[...LOCKED.values()].map(id => priceOf(ITEM.get(id)!))));
    expect(priceOf(ITEM.get('fighter-gorai')!)).toBe(BANDS.fighterFirst);
  });

  it.skipIf(!shown('asahi', 'levin'))('gives the road\'s fighters free at their level, or sooner for Sumi', () => {
    const climber = newAccount('climber', 0);
    expect(mayPlay('asahi', climber)).toBe(false);
    climber.xp = xpAt(5) - 1; expect(mayPlay('asahi', climber)).toBe(false); expect(lockedOut('asahi', climber)).toMatch(/locked/);
    climber.xp = xpAt(5); expect(mayPlay('asahi', climber)).toBe(true); expect(owns(climber, 'fighter-asahi')).toBe(true);
    expect(cannotBuy(climber, 'fighter-asahi', 0)).toBe('You already own it.');
    expect(climber.items['fighter-asahi']).toBeUndefined();     // computed from the level: nothing to grant, nothing to lose
    const saver = newAccount('saver', 0); saver.balance = BANDS.fighterThird;
    expect(buy(saver, 'fighter-levin', 0, 1)).toMatchObject({ price: BANDS.fighterThird });
    expect(mayPlay('levin', saver)).toBe(true); expect(saver.balance).toBe(0);
  });

  it.skipIf(!shown('gorai', 'haldor', 'sorrel'))('lets the owner of the item play them, and says why to anyone else', () => {
    expect(mayPlay('gorai', undefined)).toBe(false);
    expect(mayPlay('gorai', { items: { 'fighter-haldor': { at: 0 } } })).toBe(false);
    expect(mayPlay('gorai', { items: { 'fighter-gorai': { at: 0 } } })).toBe(true);
    expect(lockedOut('sorrel', { items: {} })).toMatch(new RegExp(`^${FIGHTERS.sorrel.name} is locked`));
    expect(lockedOut('sorrel', { items: { 'fighter-sorrel': { at: 0 } } })).toBeUndefined();
    expect(lockedOut('taisei', { items: {} })).toBeUndefined();
  });

  it.skipIf(!shown('gorai'))('sells one for its price alone - no level, no feat - and never wears it', () => {
    const account = newAccount('k', 0);
    expect(cannotBuy(account, 'fighter-gorai', 0)).toMatch(/costs 1,000/);
    account.balance = 999;
    expect(cannotBuy(account, 'fighter-gorai', 0)).toMatch(/1,000/);
    account.balance = 1000;
    expect(cannotBuy(account, 'fighter-gorai', 0)).toBeUndefined();
    buy(account, 'fighter-gorai', 0, 1);
    expect(account.balance).toBe(0);
    expect(mayPlay('gorai', account)).toBe(true);
    expect(wear(account, 'fighter', 'fighter-gorai')).toEqual({ refused: 'A fighter is played, not worn.' });
  });
});

describe('the match server keeps them to their owners', () => {
  async function arena(mode: 'match' | 'training') {
    const room = new ArenaRoom();
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(room, 'broadcast').mockImplementation(() => {}); vi.spyOn(room, 'lock').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(() => {});
    await room.onCreate({rosterProtocol:ROSTER_PROTOCOL, mode });
    return room;
  }
  it.skipIf(!shown('gorai', 'haldor', 'asahi'))('refuses a locked fighter in a match without the account that owns them, and lets them into training', async () => {
    const economy = mountEconomy({ use: () => undefined, post: () => undefined }, { dir: false, adminToken: 'owner' });
    const match = await arena('match'), training = await arena('training');
    try {
      const hello = economy.hello(undefined) as unknown as { token: string; account: { pk: string } };
      const join = (room: ArenaRoom, fighter: FighterId, account?: string) => room.onAuth(client('a'), {rosterProtocol:ROSTER_PROTOCOL, fighter, account, mode: 'match' });
      expect(() => join(match, 'gorai')).toThrow(`${FIGHTERS.gorai.name} is locked`);
      expect(() => join(match, 'gorai', hello.token)).toThrow(`${FIGHTERS.gorai.name} is locked`);
      expect(join(match, 'taisei')).toBe(true);
      expect(join(training, 'gorai')).toBe(true);
      economy.grant('Bearer owner', hello.account.pk, 0, 'fighter-gorai');
      expect(join(match, 'gorai', hello.token)).toBe(true);
      expect(() => join(match, 'haldor', hello.token)).toThrow(`${FIGHTERS.haldor.name} is locked`);
      expect(() => join(match, 'asahi', hello.token)).toThrow(new RegExp(`${ITEMS.find(i => i.id === 'fighter-asahi')!.name} is locked`));
      economy.book.accounts.get(hello.account.pk)!.xp = xpAt(5);
      expect(join(match, 'asahi', hello.token)).toBe(true);
    } finally { match.onDispose(); training.onDispose(); economy.close(); }
  });

  it.skipIf(!shown('sorrel'))('refuses one in a co-op run the same way', async () => {
    const economy = mountEconomy({ use: () => undefined, post: () => undefined }, { dir: false, adminToken: 'owner' });
    const room = new SurvivalRoom();
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(room, 'broadcast').mockImplementation(() => {}); vi.spyOn(room, 'lock').mockResolvedValue(undefined); vi.spyOn(room, 'unlock').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(() => {});
    await room.onCreate({rosterProtocol:ROSTER_PROTOCOL, creationToken: '01234567-89ab-cdef-0123-456789abcdef' });
    try {
      const code = room.roomId.replace('coop-', '');
      const hello = economy.hello(undefined) as unknown as { token: string; account: { pk: string } };
      expect(() => room.onAuth(client('a'), {rosterProtocol:ROSTER_PROTOCOL, code, fighter: 'sorrel', account: hello.token })).toThrow(`${FIGHTERS.sorrel.name} is locked`);
      economy.grant('Bearer owner', hello.account.pk, 0, 'fighter-sorrel');
      expect(room.onAuth(client('a'), {rosterProtocol:ROSTER_PROTOCOL, code, fighter: 'sorrel', account: hello.token })).toBe(true);
    } finally { room.onDispose(); economy.close(); }
  });
});
