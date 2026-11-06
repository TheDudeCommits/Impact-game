import { describe, expect, it } from 'vitest';
import { MoveSheet, moveSheetOf, moveSheetsFor } from '../src/ui/moveSheet';
import { FIGHTERS } from '../src/config';
import type { FighterId } from '../src/game/types';

/** Round 3c (CAM3): the second blind critic's "move cards go blank for about
 *  1 s during a transformation" (h1/konta, sheet-13-awaken). The cards keep
 *  the art they have until the form's sheet can be drawn, and the form's sheet
 *  is fetched as the match starts. */
function harness() {
  const applied: string[] = [], waiting = new Map<string, () => void>();
  const sheet = new MoveSheet(s => applied.push(s), s => new Promise<void>(done => waiting.set(s, done)));
  const finish = async (s: string) => { waiting.get(s)?.(); await new Promise(r => setTimeout(r, 0)); };
  return { sheet, applied, waiting, finish };
}

describe('the move cards never go blank', () => {
  it('knows which sheets a fighter can need: only Konta and Hawser, whose forms throw kits of their own, transform their cards', () => {
    for (const id of Object.keys(FIGHTERS) as FighterId[]) {
      expect(moveSheetOf(id, false)).toBe(id);
      expect(moveSheetsFor(id)).toEqual(id === 'konta' ? ['konta', 'konta-kurobi'] : id === 'hawser' ? ['hawser', 'hawser-colossus'] : [id]);
    }
    expect(moveSheetOf('konta', true)).toBe('konta-kurobi');
    expect(moveSheetOf('hawser', true)).toBe('hawser-colossus');
  });

  it('keeps the old art until the new sheet has decoded, then swaps', async () => {
    const { sheet, applied, finish } = harness();
    sheet.now('konta');
    expect(applied).toEqual(['konta']);
    await finish('konta');
    // The transformation: nothing changes on the cards until Kurobi's sheet can be drawn.
    sheet.want('konta-kurobi');
    expect(sheet.shown).toBe('konta');expect(applied).toEqual(['konta']);
    await finish('konta-kurobi');
    expect(sheet.shown).toBe('konta-kurobi');expect(applied).toEqual(['konta', 'konta-kurobi']);
  });

  it('swaps at once for a sheet warmed as the match started', async () => {
    const { sheet, applied, finish } = harness();
    sheet.now('konta');sheet.warm('konta-kurobi');
    await finish('konta');await finish('konta-kurobi');
    sheet.want('konta-kurobi');
    expect(applied, 'the form\'s cards on the frame it arrives').toEqual(['konta', 'konta-kurobi']);
    sheet.want('konta');
    expect(applied, 'and back as it ends').toEqual(['konta', 'konta-kurobi', 'konta']);
  });

  it('drops a decode that is no longer wanted', async () => {
    const { sheet, applied, finish } = harness();
    sheet.now('konta');await finish('konta');
    sheet.want('konta-kurobi');sheet.want('konta');
    await finish('konta-kurobi');
    expect(sheet.shown).toBe('konta');expect(applied).toEqual(['konta']);
  });

  it('puts a new match\'s sheet on at once rather than keeping the last match\'s', () => {
    const { sheet, applied } = harness();
    sheet.now('konta');sheet.now('gaunt');
    expect(sheet.shown).toBe('gaunt');expect(applied).toEqual(['konta', 'gaunt']);
  });
});
