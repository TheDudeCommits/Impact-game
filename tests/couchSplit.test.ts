import { describe, expect, it } from 'vitest';
import { DIVIDER, SCREENS, glRect, halves, screenFor } from '../src/couch/split';
import { Couch, softTarget, SOFT_RANGE, opponentOf } from '../src/couch/couch';
import { Seat, movementMaskOfSeat } from '../src/couch/seats';
import { SECOND } from '../src/game/couchSeat';
import { MODE_ORDER } from '../src/ui/modes/catalogue';
import type { PlayerState } from '../src/game/types';

const player = (id: string, x: number, z: number, extra: Partial<PlayerState> = {}) => ({ id, x, y: 0, z, yaw: 0, alive: true, fighter: 'taisei', name: id, hp: 100, maxHp: 100, ...extra }) as PlayerState;

describe('the split screen (couch/split.ts)', () => {
  it('cuts the screen into two halves with the divider between them', () => {
    const [a, b] = halves('split-v', 1280, 720);
    expect(a).toEqual({ x: 0, y: 0, w: 640 - DIVIDER / 2, h: 720 });
    expect(b.x).toBe(640 + DIVIDER / 2); expect(b.x + b.w).toBe(1280); expect(b.h).toBe(720);
    const [top, bottom] = halves('split-h', 1280, 721);
    expect(top.y).toBe(0); expect(top.w).toBe(1280); expect(bottom.y + bottom.h).toBe(721);
    expect(bottom.y - (top.y + top.h)).toBeLessThanOrEqual(DIVIDER);
    // WebGL's viewport counts from the bottom: the top half sits over the bottom one.
    expect(glRect(top, 721).y).toBeGreaterThan(glRect(bottom, 721).y);
    // Never a half of nothing, however small the window.
    for (const screen of ['split-v', 'split-h'] as const) for (const r of halves(screen, 3, 3)) { expect(r.w).toBeGreaterThan(0); expect(r.h).toBeGreaterThan(0); }
  });
  it('offers every mode a split both ways, and the shared lens only where one shot holds the fight', () => {
    for (const mode of MODE_ORDER) { expect(SCREENS[mode]).toContain('split-v'); expect(SCREENS[mode]).toContain('split-h'); }
    expect(SCREENS.duel).toContain('shared'); expect(SCREENS.arcade).toContain('shared'); expect(SCREENS.training).toContain('shared');
    expect(SCREENS.training).toEqual(['shared', 'split-h', 'split-v']); expect(screenFor('training')).toBe('shared'); expect(screenFor('training', 'shared')).toBe('shared');
    for (const mode of ['royale', 'last-stand', 'bad-blood', 'rift-war'] as const) { expect(SCREENS[mode]).not.toContain('shared'); expect(screenFor(mode)).toBe('split-h'); expect(screenFor(mode, 'shared')).toBe('split-h'); }
    expect(screenFor('duel')).toBe('shared'); expect(screenFor('duel', 'split-h')).toBe('split-h'); expect(screenFor('arcade')).toBe('split-h'); expect(screenFor('duel', 'split-v')).toBe('split-v');
  });
});

describe('a field seat\'s aim (couch/couch.ts)', () => {
  it('picks the nearest opponent ahead of its view, and keeps the one it has until another is clearly nearer', () => {
    const me = player('you', 0, 0);
    const ahead = player('a', 0, 6), behind = player('b', 0, -5);
    // Looking along +z: the one ahead, though the one behind is nearer.
    expect(softTarget(me, [me, ahead, behind], 0, null)).toBe('a');
    // Looking along -z: the one behind.
    expect(softTarget(me, [me, ahead, behind], Math.PI, null)).toBe('b');
    // Held: kept against one barely nearer, let go for one much nearer.
    const near = player('c', .5, 5.2);
    expect(softTarget(me, [me, ahead, near], 0, 'a')).toBe('a');
    expect(softTarget(me, [me, ahead, player('d', 0, 2)], 0, 'a')).toBe('d');
    expect(softTarget(me, [me, player('far', 0, SOFT_RANGE + 1)], 0, null)).toBeNull();
  });
  it('never aims at its own side, the fallen or itself', () => {
    const me = player('you', 0, 0, { team: 'heroes' });
    expect(opponentOf(me, player('ally', 0, 2, { team: 'heroes' }))).toBe(false);
    expect(opponentOf(me, player('foe', 0, 2, { team: 'villains' }))).toBe(true);
    expect(opponentOf(me, player('down', 0, 2, { team: 'villains', alive: false }))).toBe(false);
    expect(opponentOf(me, me)).toBe(false);
    // No teams (a royale, Training): everyone else.
    expect(opponentOf(player('you', 0, 0), player('bot-1', 0, 2))).toBe(true);
  });
  it('holds its TARGET\'s pick, and lets it go on the next press', () => {
    const couch = new Couch();
    couch.begin('field', [{ kind: 'keys', layout: 'left' }, { kind: 'keys', layout: 'right' }], { ids: ['local-defender', SECOND], screen: 'split-v' });
    const me = player('local-defender', 0, 0), a = player('a', 0, 6), b = player('b', 0, 9);
    couch.aimAt([me, a, b, player(SECOND, 20, 0)]);
    expect(couch.targetOf('local-defender')).toBe('a'); expect(couch.lockedOf('local-defender')).toBe(false);
    couch.seats.seats[0].press('Tab');
    couch.aimAt([me, a, b, player(SECOND, 20, 0)]);
    expect(couch.lockedOf('local-defender')).toBe(true);
    // Locked, a nearer one does not take it.
    couch.aimAt([me, a, b, player('c', 0, 1), player(SECOND, 20, 0)]);
    expect(couch.targetOf('local-defender')).toBe('a');
    couch.seats.seats[0].press('Tab');
    couch.aimAt([me, a, b, player('c', 0, 1), player(SECOND, 20, 0)]);
    expect(couch.lockedOf('local-defender')).toBe(false); expect(couch.targetOf('local-defender')).toBe('c');
    couch.end();
  });
});

describe('a split screen\'s seats (couch/couch.ts)', () => {
  it('splits a field fight even when asked for the shared lens, and seats Player 1 under the mode\'s own id', () => {
    const couch = new Couch();
    couch.begin('field', [{ kind: 'keys', layout: 'left' }, { kind: 'keys', layout: 'right' }], { ids: ['local-rift-fighter', SECOND], screen: 'shared' });
    expect(couch.split).toBe(true); expect(couch.screen).toBe('split-h');
    expect(couch.seats.seats.map(s => s.id)).toEqual(['local-rift-fighter', SECOND]);
    couch.end();
    couch.begin('versus', [{ kind: 'keys', layout: 'left' }, { kind: 'keys', layout: 'right' }], { screen: 'shared' });
    expect(couch.split).toBe(false);
    couch.end();
  });
  it('reads each seat\'s keys against its own half\'s heading', () => {
    const couch = new Couch();
    couch.begin('versus', [{ kind: 'keys', layout: 'left' }, { kind: 'keys', layout: 'right' }], { screen: 'split-h' });
    couch.live = true;
    couch.views[0].yaw = 0; couch.views[1].yaw = Math.PI / 2;
    couch.aimAt([player('you', 0, 0), player(SECOND, 0, 4)]);
    couch.seats.held.add('KeyW'); couch.seats.held.add('ArrowUp');
    const one = couch.command('you')!, two = couch.command(SECOND)!;
    // Forward is each half's own: Player 1's along +z, Player 2's along +x.
    expect(one.moveZ).toBeCloseTo(1, 5); expect(Math.abs(one.moveX)).toBeLessThan(1e-9);
    expect(two.moveX).toBeCloseTo(1, 5); expect(Math.abs(two.moveZ)).toBeLessThan(1e-9);
    // The follow camera's movement basis, where it holds one (the latch while the keys stay down), comes first.
    couch.views[1].basis = Math.PI;
    expect(couch.command(SECOND)!.moveZ).toBeCloseTo(-1, 5);
    couch.end();
  });
  it('turns a pad seat\'s own view with its right stick, and nobody else\'s', () => {
    const couch = new Couch();
    couch.begin('field', [{ kind: 'keys', layout: 'left' }, { kind: 'pad', index: 0 }], { screen: 'split-v', yaw: 1 });
    const pad = couch.seats.seats[1];
    (pad as unknown as { poll: () => void }).poll = () => {};
    couch.seats.poll = () => false;
    pad.lookX = 1; pad.lookY = 1;
    couch.turn(.1);
    expect(couch.views[0].yaw).toBe(1);
    expect(couch.views[1].yaw).toBeLessThan(1); expect(couch.views[1].pitch).toBeGreaterThan(.02);
    couch.end();
  });
  it('tells the follow camera which movement keys a keyboard seat holds, and no keys for a pad', () => {
    const held = new Set(['KeyW', 'KeyD', 'ArrowLeft']);
    expect(movementMaskOfSeat(new Seat('you', { kind: 'keys', layout: 'left' }), held)).toBe(1 | 8);
    expect(movementMaskOfSeat(new Seat('p2', { kind: 'keys', layout: 'right' }), held)).toBe(2);
    expect(movementMaskOfSeat(new Seat('p2', { kind: 'pad', index: 0 }), held)).toBe(0);
  });
});
