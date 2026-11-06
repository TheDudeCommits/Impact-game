import { afterEach, describe, expect, it, vi } from 'vitest';
import { Couch } from '../src/couch/couch';
import { cardKey, keyLabel } from '../src/couch/CouchHud';
import { CouchSeats, Seat, SHOP_KEYS } from '../src/couch/seats';
import { SECOND } from '../src/game/couchSeat';
import { pauseKey } from '../src/input/bindings';

/** The split screen's own HUD (couch/CouchHud.ts, 2 November 2026): each half's cards name its seat's own keys, and each
 *  seat works its own shop with its own device (seats.ts menuOpen, picks, interact). */
describe('a half\'s cards', () => {
  it('name the seat\'s own keys: the keyboard\'s left half, its right half', () => {
    const left = { kind: 'keys', layout: 'left' } as const, right = { kind: 'keys', layout: 'right' } as const;
    expect(['light', 'heavy', 'special', 'ultimate', 'area', 'awaken'].map(action => cardKey(left, action as 'light').text)).toEqual(['C', 'V', 'Q', 'R', 'G', 'E']);
    expect(['light', 'heavy', 'special', 'ultimate', 'area', 'awaken'].map(action => cardKey(right, action as 'light').text)).toEqual(['K', 'L', ';', 'O', 'P', '[']);
  });
  it('print key codes as a card shows them', () => {
    expect([keyLabel('KeyB'), keyLabel('Semicolon'), keyLabel('BracketLeft'), keyLabel('Numpad1'), keyLabel('NumpadEnter'), keyLabel(undefined)]).toEqual(['B', ';', '[', 'N1', 'N ENTER', '']);
  });
});

describe('a seat\'s own shop', () => {
  it('opens on its own key: B for the left half and the whole keyboard, M for the right', () => {
    expect(SHOP_KEYS.left).toContain('KeyB'); expect(SHOP_KEYS.full).toContain('KeyB'); expect(SHOP_KEYS.right).toContain('KeyM');
    const left = new Seat('you', { kind: 'keys', layout: 'left' }), right = new Seat(SECOND, { kind: 'keys', layout: 'right' });
    expect(left.press('KeyM')).toBe(false); expect(right.press('KeyB')).toBe(false);
    expect(left.press('KeyB')).toBe(true); expect(left.interact).toBe(true);
    expect(right.press('KeyM')).toBe(true); expect(right.interact).toBe(true);
  });
  it('turns the seat\'s keys to its cursor while open: move, choose, back - and never a blow', () => {
    const seat = new Seat('you', { kind: 'keys', layout: 'left' });
    seat.menuOpen = true;
    for (const code of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyC', 'Space', 'KeyF', 'KeyV', 'KeyB']) seat.press(code);
    expect(seat.picks).toEqual(['previous', 'next', 'left', 'right', 'confirm', 'confirm', 'back', 'back', 'back']);
    expect(seat.interact).toBe(false);
    const command = seat.command(new Set(), 0, 0, null);
    expect(command.attack).toBeUndefined(); expect(command.jump).toBeUndefined();
  });
  it('steps on while a direction is held, but never chooses twice from one held key', () => {
    const seat = new Seat(SECOND, { kind: 'keys', layout: 'right' });
    seat.menuOpen = true;
    seat.press('ArrowDown'); seat.press('ArrowDown', true); seat.press('ArrowDown', true);
    seat.press('KeyK'); seat.press('KeyK', true); seat.press('KeyK', true);
    expect(seat.picks).toEqual(['next', 'next', 'next', 'confirm']);
  });
  it('a held key\'s repeat throws nothing in the fight, as before', () => {
    const seat = new Seat('you', { kind: 'keys', layout: 'left' });
    seat.press('KeyC'); expect(seat.command(new Set(), 0, 0, null).attack).toBe('light');
    seat.press('KeyC', true); expect(seat.command(new Set(), 0, 0, null).attack).toBeUndefined();
  });
  it('holds the fighter still while its shop is open, and only that seat\'s', () => {
    const couch = new Couch();
    couch.seats.seat([{ kind: 'keys', layout: 'left' }, { kind: 'keys', layout: 'right' }], ['you', SECOND]);
    (couch as unknown as { kind: string }).kind = 'versus'; couch.live = true;
    const held = couch.seats.held; held.add('KeyW'); held.add('ArrowUp');
    couch.seats.seats[0].menuOpen = true;
    const one = couch.command('you')!, two = couch.command(SECOND)!;
    expect(Math.hypot(one.moveX, one.moveZ)).toBe(0);
    expect(Math.hypot(two.moveX, two.moveZ)).toBeGreaterThan(.9);
  });
  it('lets the seats share the keyboard: the shop keys are each half\'s own', () => {
    const seats = new CouchSeats();
    seats.seat([{ kind: 'keys', layout: 'full' }, { kind: 'keys', layout: 'full' }], ['you', SECOND]);
    const [left, right] = seats.seats;
    expect(left.owns('KeyB') && !left.owns('KeyM')).toBe(true);
    expect(right.owns('KeyM') && !right.owns('KeyB')).toBe(true);
  });
});

describe('the pause key in a couch fight', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('is Esc while the keyboard\'s right half casts its AREA on P, and P again after', () => {
    vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
    const seats = new CouchSeats();
    seats.seat([{ kind: 'keys', layout: 'left' }, { kind: 'keys', layout: 'right' }], ['you', SECOND]);
    expect(pauseKey()).toBe('KeyP');
    seats.attach();
    expect(pauseKey()).toBe('Escape');
    // A pad plugged in: Player 2 takes it, Player 1 the whole keyboard (P unbound) - P pauses again.
    seats.seats[1].use({ kind: 'pad', index: 0 }); seats.seats[0].use({ kind: 'keys', layout: 'full' });
    expect(pauseKey()).toBe('KeyP');
    seats.seats[1].use({ kind: 'keys', layout: 'right' }); seats.seats[0].use({ kind: 'keys', layout: 'left' });
    expect(pauseKey()).toBe('Escape');
    seats.detach();
    expect(pauseKey()).toBe('KeyP');
  });
});
