import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ballChoice, ballLevelRow, ballPlayRow, ballRulesRow, ballStart, traitBadge } from '../ball/ballSheet';
import { drillBest, drillMedal, recordDrill, DRILLS_KEY } from '../ball/drillMedals';
import { stampHtml, seasonLine } from '../ball/ranks';
import { weeklyMutator, MUTATOR_NAMES } from '../../game/ball/mutators';
import { MODE_DRILLS } from '../../game/ball/drills';
import { RANKED } from '../../game/ball/ranked';

const store = new Map<string, string>();
beforeEach(() => { store.clear(); (globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => void store.set(k, String(v)), removeItem: k => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 }; });

describe('the ball modes\' rows on the mode sheet', () => {
  it('offers CLASSIC, RUMBLE and every mutator as one RULES choice, and starts with the one chosen', () => {
    const row = ballRulesRow('goal-rush', 'offline', {});
    for (const name of ['CLASSIC', 'RUMBLE', 'HEAT RUSH', 'LOW GRAVITY', 'GIANT BALL', 'SUDDEN DEATH']) expect(row).toContain(name);
    expect(ballChoice('rules:low-gravity')).toEqual({ rumble: false, mutator: 'low-gravity' });
    expect(ballChoice('rules:rumble')).toEqual({ rumble: true, mutator: null });
    expect(ballChoice('rules:two-balls')).toEqual({ rumble: false, mutator: null });
    expect(ballStart('goal-rush', 'offline', { mutator: 'giant-ball' }, false, '')).toMatchObject({ access: 'bots', mutator: 'giant-ball', rumble: false });
    expect(ballStart('sky-spike', 'friends', { rumble: true }, false, '')).toMatchObject({ access: 'host', rumble: true, mutator: undefined });
  });
  it('offers ONLINE three queues - classic, this week\'s playlist, ranked - and no rules of its own', () => {
    const now = Date.UTC(2026, 10, 10), row = ballRulesRow('goal-rush', 'online', { queue: 'playlist' }, now);
    expect(row).toContain(MUTATOR_NAMES[weeklyMutator(now)]); expect(row).toContain('RANKED'); expect(row).not.toContain('RUMBLE');
    expect(ballStart('goal-rush', 'online', { queue: 'ranked', mutator: 'heat-rush' }, false, '')).toEqual({ kind: 'ball', mode: 'goal-rush', access: 'quick', queue: 'ranked' });
    expect(ballStart('goal-rush', 'online', {}, false, '')).toMatchObject({ queue: 'classic' });
    expect(ballChoice('queue:ranked')).toEqual({ queue: 'ranked' });
  });
  it('lists the mode\'s five drills under DRILLS with their best medal, and starts the chosen one as FREE PLAY', () => {
    expect(ballPlayRow('sky-spike', { drills: true })).toContain('DIG A SERVE');
    recordDrill('ss-block', 6);
    expect(ballPlayRow('sky-spike', { drills: true })).toMatch(/bs-medal gold/);
    expect(ballChoice('drill:ss-roll')).toEqual({ drill: 'ss-roll', drills: true, practice: false });
    expect(ballStart('sky-spike', 'offline', { drills: true, drill: 'ss-roll' }, false, '')).toMatchObject({ access: 'bots', practice: true, drill: 'ss-roll' });
    // A drill of the other mode is not this one's: its first drill instead.
    expect(ballStart('goal-rush', 'offline', { drills: true, drill: 'ss-roll' }, false, '')).toMatchObject({ drill: MODE_DRILLS['goal-rush'][0] });
  });
  it('keeps each drill\'s best in this browser, and the medal it earns', () => {
    expect(drillBest('gr-keeper')).toBe(0); expect(drillMedal('gr-keeper')).toBeNull();
    expect(recordDrill('gr-keeper', 5)).toMatchObject({ improved: true, best: 5, medal: 'bronze' });
    expect(recordDrill('gr-keeper', 3)).toMatchObject({ improved: false, best: 5 });
    expect(drillMedal('gr-keeper')).toBe('bronze');
    store.set(DRILLS_KEY, '{"gr-keeper": 99}'); expect(drillBest('gr-keeper')).toBe(10);
    store.set(DRILLS_KEY, 'not json'); expect(drillBest('gr-keeper')).toBe(0);
  });
  it('shows the ball gear in Account only where the ball modes show (never on Player Two while they are "site")', async () => {
    const { GEAR, gearShelf, gearShown, gearDetail } = await import('../shop/ballGear');
    expect(GEAR.map(item => item.kind)).toEqual([...Array(5).fill('ball'), ...Array(4).fill('balltrail'), ...Array(4).fill('goalburst'), ...Array(3).fill('celebration')]);
    for (const item of GEAR) { expect(item.stage, item.id).toBe('live'); expect(item.price! % 100, item.id).toBe(0); }
    expect(gearShown()).toBe(true); expect(gearShelf(undefined, undefined)).toContain('BALL SKINS');
    expect(gearDetail(GEAR[0], undefined, 0, false)).toMatch(/UNLOCK ·|disabled/); expect(gearDetail(GEAR[0], undefined, 0, false)).not.toMatch(/\bBUY\b|\bPRICE\b/);
    try {
      vi.stubGlobal('location', new URL('https://impact.playertwo.cc/~b1/index.html'));
      expect(gearShown()).toBe(false); expect(gearShelf(undefined, undefined)).toBe('');
    } finally { vi.unstubAllGlobals(); }
  });
  it('draws a standing as its ink stamp, the placements first, and names the fighter\'s trait', () => {
    expect(stampHtml({ rating: 1200, games: 2 })).toContain('PLACING');
    expect(stampHtml({ rating: 1200, games: RANKED.placements })).toContain('TONED');
    expect(stampHtml({ rating: 1460, games: 9 }, 18)).toMatch(/COVER[\s\S]*\+18/);
    expect(seasonLine(Date.UTC(2026, 10, 9, 12))).toMatch(/^SEASON 1 · 56 DAYS LEFT$/);
    expect(traitBadge('taisei')).toContain('AERIALIST');
  });
  it('offers the bots\' level: EASY, NORMAL, HARD, NORMAL first, kept and sent with a match against bots', () => {
    const row = ballLevelRow({});
    for (const name of ['EASY', 'NORMAL', 'HARD']) expect(row).toContain(`>${name}</button>`);
    expect(row).toMatch(/data-ms-ball="level:normal" aria-pressed="true"/);
    expect(row).not.toContain('ms-note');
    expect(ballLevelRow({ difficulty: 'easy' })).toMatch(/data-ms-ball="level:easy" aria-pressed="true"[\s\S]*ms-note/);
    expect(ballChoice('level:hard')).toEqual({ difficulty: 'hard' });
    expect(ballChoice('level:brutal')).toBeUndefined();
    expect(ballStart('sky-spike', 'offline', { difficulty: 'hard' }, false, '')).toMatchObject({ access: 'bots', difficulty: 'hard' });
    expect(ballStart('goal-rush', 'offline', {}, false, '')).toMatchObject({ difficulty: 'normal' });
    expect(ballStart('sky-spike', 'couch', { difficulty: 'easy' }, false, '', { partner: 'konta', screen: 'split-v' })).toMatchObject({ couch: { partner: 'konta' }, difficulty: 'easy' });
    // FREE PLAY and the drills have no bots to beat; online rooms none to choose.
    expect(ballStart('sky-spike', 'offline', { difficulty: 'hard', practice: true }, false, '')).not.toHaveProperty('difficulty');
    expect(ballStart('sky-spike', 'offline', { difficulty: 'hard', drills: true }, false, '')).not.toHaveProperty('difficulty');
    expect(ballStart('sky-spike', 'online', { difficulty: 'hard' }, false, '')).not.toHaveProperty('difficulty');
    // A private room's host picks its bots' level as the room is opened (NORMAL is left off); a joiner's page
    // sends none (the room has the host's).
    expect(ballStart('sky-spike', 'friends', { difficulty: 'hard' }, false, '')).toMatchObject({ access: 'host', difficulty: 'hard' });
    expect(ballStart('sky-spike', 'friends', {}, false, '')).not.toHaveProperty('difficulty');
    expect(ballStart('sky-spike', 'friends', { difficulty: 'hard' }, true, '123456')).not.toHaveProperty('difficulty');
  });
});
