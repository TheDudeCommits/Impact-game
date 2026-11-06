import { ALL_FIGHTERS, fighterShown } from '../src/originals/launch';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { FIGHTERS } from '../src/config';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import { LOCK_ROUND_BORROW } from '../src/game/lockRoundBorrow';
import '../src/engine/client/borrowedStrikes';
import { decodeTakePack, takePackUrl } from '../src/engine/client/takePacks';
import { LOCK_TAKE_FILES, LOCK_TAKE_SHIPPED, ORIGINAL_LOCK_TAKES } from '../src/originals/lockStrikes';
import { launchUnshipped, takePackOwner } from '../src/originals/launchShip';
import { ORIGINALS } from '../src/originals/roster';
import type { FighterId } from '../src/game/types';

const glb = (url: string) => {
  const raw = fs.readFileSync(`public${url}`), length = raw.readUInt32LE(12);
  return JSON.parse(raw.subarray(20, 20 + length).toString()) as { animations?: { name: string; channels: { target: { node: number } }[] }[]; nodes: { name?: string }[]; meshes?: unknown[] };
};
/** The files a fighter's body loads (as scripts/engine/takePacks.mts reads them). */
const bodyFiles = (id: FighterId) => { const def = FIGHTERS[id]; return new Set([def.model, def.rushModel, ...def.extraModels ?? [], IDLE_PROFILES[id]?.model, def.formModel, ...def.formExtraModels ?? []].filter((url): url is string => !!url)); };
const borrows = Object.entries(LOCK_ROUND_BORROW).flatMap(([id, stages]) => (stages ?? []).flatMap((borrow, stage) => borrow ? [{ id: id as FighterId, stage, ...borrow }] : []));

describe('the take packs', () => {
  it('ship: the gate leaves out only a pack that is not the original\'s own', () => {
    const packs = ALL_FIGHTERS.map(id => takePackUrl(id).slice(1));
    const away = new Set(launchUnshipped(packs));
    for (const id of ALL_FIGHTERS) expect(away.has(takePackUrl(id).slice(1)), id).toBe(takePackOwner(id) !== 'own');
  });
});

describe("lock combat's borrowed strikes", () => {
  it("name only the originals' own files, never the earlier donors'", () => {
    expect(borrows.length).toBeGreaterThan(30);
    for (const borrow of borrows) {
      const label = `${borrow.id} ${borrow.stage}: ${borrow.from} ${borrow.clip}`;
      expect(ORIGINAL_LOCK_TAKES[`${borrow.from}:${borrow.clip}`], label).toBe(borrow.file);
      const own = bodyFiles(borrow.from), copy = LOCK_TAKE_FILES[borrow.file];
      // One of the donor original's own files, or a copy made from them.
      expect(own.has(borrow.file) || (!!copy && copy.every(([source]) => own.has(source))), `${label}: ${borrow.file}`).toBe(true);
      expect(ORIGINALS[borrow.from], label).toBeTruthy();
    }
  });
});
