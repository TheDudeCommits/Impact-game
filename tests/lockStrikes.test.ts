import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { FighterId } from '../src/game/types';
import { LOCK_ROUND_BORROW } from '../src/game/lockRoundBorrow';
import { lockRoundName } from '../src/game/lockCombat';
import { rushMove } from '../src/game/awakening';
import { borrowedStrike, installBorrowedStrikes, resetBorrowedStrikes, strikeReport } from '../src/engine/client/borrowedStrikes';
import { decodeTakePack } from '../src/engine/client/takePacks';
import { loadRig } from './rigHarness';
import { assembleFighter } from './popHarness';
import type { LockBorrow } from '../src/game/lockRoundBorrow';

/** Lock combat's borrowed strikes (src/engine/client/borrowedStrikes.ts): the second rounds of the nine fighters whose
 *  files have no take to spare, and the empty stages of the eight with one or two - another fighter's strike fitted to each body. The donors read off the disk as the
 *  page fetches them: their take packs' rigs, their takes' small files. */
const fromDisk = async (borrow: LockBorrow) => {
  const bytes = fs.readFileSync(`public/assets/fighters/takes/${borrow.from}.bin`);
  const rig = decodeTakePack(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)).takes.light!.open.rig;
  const clip = (await loadRig(borrow.file)).animations.find(c => c.name === borrow.clip);
  return clip ? { rig, clip } : undefined;
};
const NINE = Object.keys(LOCK_ROUND_BORROW) as FighterId[];
beforeAll(async () => { await installBorrowedStrikes(fromDisk, NINE); });
afterAll(() => resetBorrowedStrikes());

describe('the borrowed strikes', () => {
  it('are for the nine with none to spare (all three stages) and the eight with one or two (the rest), named as moves of theirs', () => {
    const nine = ['shiun', 'gohaku', 'wuming', 'jinlin', 'gaku', 'tobari', 'banjaku', 'akagane', 'rook'];
    expect(NINE.slice().sort()).toEqual([...nine, 'sekka', 'hawser', 'vesper', 'shirokane', 'levin', 'imago', 'magatsu', 'asahi'].sort());
    for (const id of NINE) {
      const first = [0, 1, 2, 3].map(s => rushMove(id, s, false).name), names = [0, 1, 2].map(s => lockRoundName(id, s));
      if (nine.includes(id)) expect(LOCK_ROUND_BORROW[id]!.every(Boolean), id).toBe(true);
      expect(names.every(Boolean), `${id}: ${names.join(', ')}`).toBe(true);
      expect(new Set(names).size, id).toBe(3);
      for (const name of names) expect(first, `${id}: ${name}`).not.toContain(name);
    }
  });

  it('every one fits its body: keyed on the body\'s own joints, finite, never refused', async () => {
    const refused: string[] = [];
    for (const id of NINE) {
      const { source } = await assembleFighter(id);
      for (let stage = 0; stage < 3; stage++) {
        if (!LOCK_ROUND_BORROW[id]![stage]) continue;
        const clip = borrowedStrike(source.scene, source.animations, id, stage);
        if (!clip) { refused.push(`${id} ${stage}: ${JSON.stringify(strikeReport())}`); continue; }
        expect(clip.duration, `${id} ${stage}`).toBeGreaterThan(.2);
        for (const track of clip.tracks) {
          expect(THREE.PropertyBinding.findNode(source.scene, THREE.PropertyBinding.parseTrackName(track.name).nodeName), `${id} ${track.name}`).toBeTruthy();
          expect(Array.from(track.values).every(Number.isFinite), `${id} ${track.name}`).toBe(true);
        }
      }
    }
    expect(refused).toEqual([]);
    if (process.env.STRIKE_REPORT) fs.writeFileSync(process.env.STRIKE_REPORT, JSON.stringify(strikeReport(), null, 1));
  }, 120000);

});
