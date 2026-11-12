import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RENAMED_IDS, currentAccount, currentId, currentSaved, currentStorage } from '../src/game/savedIds';
import { newAccount, owns, type Account } from '../src/game/economy/account';
import { ITEMS } from '../src/game/economy/catalog';
import { FIGHTERS } from '../src/config';
import { STAGES } from '../src/game/stages';
import { ENEMIES } from '../src/survival/enemies';
import { LOCATIONS } from '../src/survival/locations';
import { Book } from '../src/server/economy/book';
import { ProgressStore } from '../src/server/progress/ProgressStore';
import { emptyState } from '../src/game/progress/rules';
import { decodeForge, encodeForge, ownKit } from '../src/engine/sim/forge';
import { sha256 } from '../src/engine/sim/hash';
import type { FighterId } from '../src/game/types';

/** Ids renamed so that none carries a name from another work; whatever a player saved under one
 *  is read as it is now, through one table that spells none of the old ids (src/game/savedIds.ts).
 *
 *  The old ids, base64'd so this file spells none of them either, each with the id it is now. */
const RENAMES: readonly (readonly [string, string])[] = [
  ['amlyZW5nYQ==', 'banjaku'], ['ZmlnaHRlci1qaXJlbmdh', 'fighter-banjaku'], ['ZW1vdGUtbWVuYWNpbmc=', 'emote-rumble'],
  ['b3V0Zml0LW91Z2EtZ29sZGVuLXByaWRl', 'outfit-ouga-crownfire'], ['b3V0Zml0LW91Z2EtYXp1cmUtcHJpZGU=', 'outfit-ouga-azure-crown'],
  ['aGlkZGVuLWFzaA==', 'ashwood'], ['cmFrc2hhc2E=', 'dune-oni'], ['dGhlLW9mZmVyaW5n', 'fallen-star'],
];
const was = (now: string) => Buffer.from(RENAMES.find(([, id]) => id === now)![0], 'base64').toString('utf8');
const FIGHTER = 'banjaku' as FighterId;

/** A profile as it was saved before the renames: the fighter bought, an emote on the wheel, both outfits owned and one
 *  worn, the fighter played and sealed with, a refund under an old item. */
function oldProfile(): Account {
  const account = newAccount('player01', 1);
  for (const id of ['fighter-banjaku', 'emote-rumble', 'outfit-ouga-crownfire', 'outfit-ouga-azure-crown']) account.items[was(id)] = { at: 2 };
  account.worn = { ...account.worn, emotes: ['emote-interrobang', was('emote-rumble')], outfits: { ouga: was('outfit-ouga-crownfire') } };
  account.stats.sealedWith = [was('banjaku'), 'konta'];
  account.day = { ...account.day, fighters: [was('banjaku')] };
  account.refunded = { [was('outfit-ouga-azure-crown')]: 120 };
  return account;
}
function expectCurrent(account: Account) {
  for (const id of ['fighter-banjaku', 'emote-rumble', 'outfit-ouga-crownfire', 'outfit-ouga-azure-crown']) {
    expect(account.items[id], id).toEqual({ at: 2 });
    expect(owns(account, id), id).toBe(true);
  }
  for (const [old] of RENAMES) expect(Object.keys(account.items)).not.toContain(Buffer.from(old, 'base64').toString('utf8'));
  expect(account.worn.emotes).toEqual(['emote-interrobang', 'emote-rumble']);
  expect(account.worn.outfits).toEqual({ ouga: 'outfit-ouga-crownfire' });
  expect(account.stats.sealedWith).toEqual(['banjaku', 'konta']);
  expect(account.day.fighters).toEqual(['banjaku']);
  expect(account.refunded).toEqual({ 'outfit-ouga-azure-crown': 120 });
}

describe('ids renamed so that none carries another work\'s name', () => {
  it('keeps one table of hashes, each old id\'s and none spelled, and every id it names is the game\'s', () => {
    expect(Object.keys(RENAMED_IDS)).toHaveLength(RENAMES.length);
    for (const [old, now] of RENAMES) {
      const id = Buffer.from(old, 'base64').toString('utf8');
      expect(RENAMED_IDS[sha256(id).slice(0, 12)], now).toBe(now);
      expect(currentId(id)).toBe(now);
      expect(currentId(now)).toBe(now);
    }
    for (const key of Object.keys(RENAMED_IDS)) expect(key).toMatch(/^[0-9a-f]{12}$/);
    const items = new Set(ITEMS.map(item => item.id));
    for (const now of Object.values(RENAMED_IDS)) {
      const known = items.has(now) || now in FIGHTERS || now in STAGES || now in ENEMIES || LOCATIONS.some(l => l.id === now);
      expect(known, now).toBe(true);
    }
  });

  it('loads a profile saved with the old ids and finds every unlock and loadout under the new ones', () => {
    const account = oldProfile();
    expect(currentAccount(account)).toBe(true);
    expectCurrent(account);
    expect(currentAccount(account)).toBe(false);   // read again: nothing left to rename
  });

  it('reads the server\'s book and ledger written with the old ids as they are now', () => {
    const dir = mkdtempSync(join(tmpdir(), 'saved-ids-book-'));
    try {
      const token = '0123456789abcdef0123456789abcdef', hash = crypto.createHash('sha256').update(token).digest('hex');
      const saved = oldProfile(), later = { ...oldProfile(), pk: 'player02' };
      writeFileSync(join(dir, 'accounts.json'), JSON.stringify({ seq: 1, accounts: [saved], tokens: { [hash]: 'player01' }, dids: {}, sold: { [was('fighter-banjaku')]: 3 }, completions: [] }));
      writeFileSync(join(dir, 'ledger.jsonl'), `${JSON.stringify({ seq: 2, at: 3, t: 'buy', pk: 'player02', after: later, item: was('emote-rumble'), serial: 4 })}\n`);
      const book = new Book(dir);
      expectCurrent(book.find(token)!);
      expectCurrent(book.accounts.get('player02')!);
      expect(book.sold.get('fighter-banjaku')).toBe(3);
      expect(book.sold.get('emote-rumble')).toBe(4);
      expect([...book.sold.keys()].some(id => !Object.values(RENAMED_IDS).includes(id) && currentId(id) !== id)).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('reads Arcade progress kept under the old ids as it is now', () => {
    const dir = mkdtempSync(join(tmpdir(), 'saved-ids-progress-'));
    try {
      const state = emptyState();
      state.rift.mastery = { [was('banjaku')]: 500, konta: 20 } as typeof state.rift.mastery;
      mkdirSync(join(dir, 'progress'), { recursive: true });
      writeFileSync(join(dir, 'progress', 'player01.json'), JSON.stringify({ v: 1, pk: 'player01', state, base: emptyState(), ids: [], clock: { run: 0, match: 0 }, at: 0 }));
      expect(new ProgressStore(dir, () => 10_000).get('player01').rift.mastery).toEqual({ banjaku: 500, konta: 20 });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('plays a Forge code made with the old fighter id as the fighter it is now', () => {
    const kit = ownKit(FIGHTER);
    const old = JSON.parse(JSON.stringify(kit).split('"banjaku"').join(JSON.stringify(was('banjaku'))));
    const decoded = decodeForge(encodeForge(old));
    expect(decoded.body).toBe(FIGHTER);
    for (const pick of Object.values(decoded.slots)) if (pick) expect(pick.from).toBe(FIGHTER);
  });

  it('moves this browser\'s records saved under the old ids (keys and values), and leaves typed text alone', () => {
    const kept = new Map<string, string>([
      ['jump-account', JSON.stringify({ account: oldProfile(), signedIn: false })],
      ['rift-survival-records', JSON.stringify({ [was('banjaku')]: { score: 9, wave: 2, kills: 3, at: 1 }, best: { score: 9, wave: 2, kills: 3, at: 1 } })],
      [`forge-draft:${was('banjaku')}`, 'JF1.x.y'],
      ['rift-shop-goal', was('fighter-banjaku')],
      ['rift-player-name', was('banjaku')],
      ['rift-settings', JSON.stringify({ stage: was('ashwood'), musicEnabled: true })],
    ]);
    const store = { get length() { return kept.size; }, key: (i: number) => [...kept.keys()][i] ?? null, getItem: (k: string) => kept.get(k) ?? null,
      setItem: (k: string, v: string) => { kept.set(k, v); }, removeItem: (k: string) => { kept.delete(k); } };
    expect(currentStorage(store)).toBe(5);
    expectCurrent((JSON.parse(kept.get('jump-account')!) as { account: Account }).account);
    expect(Object.keys(JSON.parse(kept.get('rift-survival-records')!))).toEqual(['best', 'banjaku']);
    expect(kept.get('forge-draft:banjaku')).toBe('JF1.x.y');
    expect([...kept.keys()].some(k => k.startsWith('forge-draft:') && k !== 'forge-draft:banjaku')).toBe(false);
    expect(kept.get('rift-shop-goal')).toBe('fighter-banjaku');
    expect(kept.get('rift-player-name')).toBe(was('banjaku'));   // a name typed: never rewritten
    expect(JSON.parse(kept.get('rift-settings')!)).toEqual({ stage: 'ashwood', musicEnabled: true });
    expect(currentStorage(store)).toBe(0);
  });

  it('reads what an older page sends as it is now', () => {
    expect(currentSaved({ fighter: was('banjaku'), bossLog: [{ id: was('dune-oni'), finished: true }], place: was('fallen-star') }))
      .toEqual({ fighter: 'banjaku', bossLog: [{ id: 'dune-oni', finished: true }], place: 'fallen-star' });
  });
});
