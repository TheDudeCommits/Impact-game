import { describe, expect, it } from 'vitest';
import { PadPresence, reseat, seatablePads, UNPLUG_GRACE, type SeatDevice } from '../src/couch/seats';
import { Couch } from '../src/couch/couch';
import { SCREENS, SCREEN_WORDS, screenFor } from '../src/couch/split';
import { partnerChoices, partnerShown, stepPartner } from '../src/ui/modes/partnerPick';
import { MODE_ORDER } from '../src/ui/modes/catalogue';
import type { FighterId } from '../src/game/types';

const keys = (layout: 'left' | 'right' | 'full'): SeatDevice => ({ kind: 'keys', layout });
const pad = (index: number): SeatDevice => ({ kind: 'pad', index });
const padState = (index: number, mapping = 'standard') => ({ index, id: `Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e) ${index}`, mapping, connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });

describe('couch seats as controllers come and go (couch/seats.ts reseat)', () => {
  it('gives a new pad to Player 2 off the keyboard, and the whole keyboard to Player 1', () => {
    expect(reseat([keys('left'), keys('right')], [0])).toEqual([keys('full'), pad(0)]);
    // Swapped halves (SWAP P1 / P2): the same.
    expect(reseat([keys('right'), keys('left')], [3])).toEqual([keys('full'), pad(3)]);
  });
  it('gives a new pad to Player 1 when Player 2 already has one', () => {
    expect(reseat([keys('full'), pad(0)], [0, 1])).toEqual([pad(1), pad(0)]);
  });
  it('seats two pads that arrive together in order, Player 1 the first', () => {
    expect(reseat([keys('left'), keys('right')], [2, 0])).toEqual([pad(0), pad(2)]);
  });
  it('leaves a third pad waiting, and changes nothing when nothing changed (the same array back)', () => {
    const both = [pad(0), pad(1)];
    expect(reseat(both, [0, 1, 2])).toBe(both);
    const halves = [keys('right'), keys('left')];
    expect(reseat(halves, [])).toBe(halves);
    const mixed = [pad(1), keys('full')];
    expect(reseat(mixed, [1])).toBe(mixed);
  });
  it('hands an unplugged pad\'s seat back to the keyboard: split in two if both are on it, whole if one is', () => {
    expect(reseat([keys('full'), pad(0)], [])).toEqual([keys('left'), keys('right')]);
    expect(reseat([pad(0), keys('full')], [])).toEqual([keys('left'), keys('right')]);
    expect(reseat([pad(1), pad(0)], [0])).toEqual([keys('full'), pad(0)]);
    expect(reseat([pad(0), pad(1)], [])).toEqual([keys('left'), keys('right')]);
  });
  it('seats only connected pads with the standard mapping', () => {
    expect(seatablePads([padState(0), null, padState(2, ''), { ...padState(3), connected: false }])).toEqual([0]);
  });
  it('gives a seated pad a moment\'s grace before its seat is moved', () => {
    const presence = new PadPresence(), seats = [keys('full'), pad(0)];
    expect(presence.present([], seats, 1000)).toEqual([0]);
    expect(presence.present([], seats, 1000 + UNPLUG_GRACE - 1)).toEqual([0]);
    expect(presence.present([], seats, 1000 + UNPLUG_GRACE)).toEqual([]);
    // Back within the grace, the clock starts again the next time it goes.
    const again = new PadPresence();
    again.present([], seats, 0); again.present([0], seats, 500);
    expect(again.present([], seats, 600)).toEqual([0]);
  });
  it('moves the seats mid-fight and says so for each player, letting go of the keys held', () => {
    let pads: unknown[] = [];
    const told: string[] = [];
    const couch = new Couch();
    couch.onReseat = notices => told.push(...notices.map(n => `${n.seat}:${n.text}`));
    // (The couch's own seats, driven by hand.)
    couch.seats.pads = () => pads as never;
    couch.begin('versus', [keys('left'), keys('right')], { screen: 'split-h' });
    couch.seats.held.add('ArrowUp');
    pads = [padState(0)];
    couch.seats.poll(10);
    expect(couch.seats.seats.map(s => s.device)).toEqual([keys('full'), pad(0)]);
    expect(told).toEqual(['0:PLAYER 1 · KEYBOARD', '1:PLAYER 2 · XBOX PAD 1']);
    expect(couch.seats.held.size).toBe(0);
    // Unplugged: still seated through the grace, then back on the keyboard's halves.
    pads = [];
    couch.seats.poll(20);
    expect(couch.seats.seats[1].device).toEqual(pad(0));
    couch.seats.poll(20 + UNPLUG_GRACE);
    expect(couch.seats.seats.map(s => s.device)).toEqual([keys('left'), keys('right')]);
    expect(told.slice(2)).toEqual(['0:PLAYER 1 · KEYBOARD · LEFT', '1:PLAYER 2 · KEYBOARD · RIGHT']);
    couch.end();
  });
});

describe('the couch\'s SCREEN (couch/split.ts)', () => {
  it('opens a one-on-one on one screen and every other mode on one player over the other, unless another was chosen', () => {
    const oneOnOne = new Set(['duel', 'training']);
    for (const mode of MODE_ORDER) { const first = oneOnOne.has(mode) ? 'shared' : 'split-h'; expect(SCREENS[mode][0]).toBe(first); expect(screenFor(mode)).toBe(first); expect(screenFor(mode, 'split-v')).toBe('split-v'); }
    expect(SCREENS.training).toEqual(['shared', 'split-h', 'split-v']);
    expect(screenFor('duel', 'split-h')).toBe('split-h');
    expect(screenFor('royale', 'shared')).toBe('split-h');
  });
  it('names each way in plain words, with no arrows', () => {
    expect(Object.values(SCREEN_WORDS).map(w => w.label)).toEqual(['TOP / BOTTOM', 'SIDE BY SIDE', 'ONE SCREEN']);
    for (const words of Object.values(SCREEN_WORDS)) expect(words.label + words.note).not.toMatch(/[⟷↕↔]/);
  });
  it('splits a field fight top and bottom when the shared lens is asked for', () => {
    const couch = new Couch();
    couch.begin('field', [keys('left'), keys('right')], { screen: 'shared' });
    expect(couch.screen).toBe('split-h');
    couch.end();
  });
});

describe('Player 2\'s pick on the sheet (ui/modes/partnerPick.ts)', () => {
  const order = ['taisei', 'gummy', 'konta', 'nigo', 'kuon'] as FighterId[];
  const open = (p1: FighterId, locked: FighterId[] = []) => (id: FighterId) => id !== p1 && !locked.includes(id);
  it('shows the one saved while it is open, else the next after Player 1\'s, else RANDOM', () => {
    expect(partnerShown('konta', 'taisei', order, open('taisei'))).toBe('konta');
    expect(partnerShown(undefined, 'taisei', order, open('taisei'))).toBe('gummy');
    expect(partnerShown('random', 'taisei', order, open('taisei'))).toBe('random');
    // Saved as Player 1's own fighter, or a locked one: the next open one after Player 1's.
    expect(partnerShown('taisei', 'taisei', order, open('taisei'))).toBe('gummy');
    expect(partnerShown('konta', 'kuon', order, open('kuon', ['konta']))).toBe('taisei');
    expect(partnerShown(undefined, 'taisei', order, () => false)).toBe('random');
  });
  it('steps along RANDOM and the open fighters, round the ends', () => {
    const choices = partnerChoices(order, open('konta', ['kuon']));
    expect(choices).toEqual(['random', 'taisei', 'gummy', 'nigo']);
    expect(stepPartner(choices, 'gummy', 1)).toBe('nigo');
    expect(stepPartner(choices, 'nigo', 1)).toBe('random');
    expect(stepPartner(choices, 'random', -1)).toBe('nigo');
    expect(stepPartner(choices, 'kuon', 1)).toBe('random');
  });
});
