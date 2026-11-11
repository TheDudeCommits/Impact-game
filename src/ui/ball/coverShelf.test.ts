import { describe, expect, it } from 'vitest';
import type { BallSeat, BallView } from '../../game/ball/model';
import { SECOND } from '../../game/couchSeat';
import { FIGHTERS } from '../../config';
import { COVER, coverFace, coverHtml, winningMoment } from './BallCover';
import { SHELF, coverWorth, keepCover, keptFor, shelfCovers, shelfHtml, shelfOrder, shelfStill, volumeNext, type CoverFace, type CoverStore } from './coverShelf';

/** The final whistle's cover and the shelf of them: which frame is the winning one, what the
 *  cover says, which covers are kept and which go at twenty-one, and a browser that refuses to keep any. */
const ME = 'local-ball-fighter';
const seat = (id: string, team: 'red' | 'blue', more: Partial<BallSeat> = {}): BallSeat => ({ id, name: 'Fighter', fighter: 'konta', team, bot: id.startsWith('bot'),
  goals: 0, assists: 0, saves: 0, shots: 0, touches: 0, kills: 0, aces: 0, blocks: 0, digs: 0, points: 0, ...more });
const over = (more: Partial<BallView> = {}, seats: BallSeat[] = [seat(ME, 'red', { feats: ['HAT TRICK'] }), seat('bot-1', 'red'), seat('bot-2', 'red'), seat('bot-3', 'blue'), seat('bot-4', 'blue'), seat('bot-5', 'blue')]): BallView =>
  ({ mode: 'goal-rush', phase: 'over', practice: false, winner: 'red', mvp: 'bot-1', score: { red: 3, blue: 1 }, seats, arena: 'ink-bowl', clock: 0, overtime: false, target: 11,
    ball: { x: 0, y: .8, z: 0, vx: 0, vy: 0, vz: 0, size: 1 }, ...more } as unknown as BallView);

/** A browser's storage as a map, which can be told to refuse (full, or a private window's) and counts what is written. */
function store(refuse: { set?: boolean; get?: boolean } = {}) {
  const map = new Map<string, string>();
  const s: CoverStore & { map: Map<string, string> } = {
    map,
    getItem: k => { if (refuse.get) throw new Error('SecurityError'); return map.get(k) ?? null; },
    setItem: (k, v) => { if (refuse.set) throw new Error('QuotaExceededError'); map.set(k, v); },
    removeItem: k => { map.delete(k); },
  };
  return s;
}
const face = (vol = 1, more: Partial<CoverFace> = {}): CoverFace => ({ mode: 'goal-rush', vol, arena: 'ink-bowl', score: { red: 3, blue: 1 }, winner: 'red', mvp: { name: 'KONTA', fighter: 'konta', team: 'red' }, ...more });
const STILL = `data:image/webp;base64,${'A'.repeat(15_000)}`;

describe('which covers are kept (coverWorth)', () => {
  it('keeps a win on this device with an accolade, or as its MVP; never a loss, a win without one, or FREE PLAY', () => {
    expect(coverWorth(over(), [ME])).toBe(3 + 1 + 2); // HAT TRICK, NORMAL bots, a margin of two
    expect(coverWorth(over({ winner: 'blue', score: { red: 1, blue: 3 } }), [ME])).toBeNull();
    expect(coverWorth(over({}, [seat(ME, 'red'), seat('bot-3', 'blue', { feats: ['SAVIOR'] })]), [ME])).toBeNull();
    expect(coverWorth(over({ mvp: ME }, [seat(ME, 'red'), seat('bot-3', 'blue')]), [ME])).toBe(3 + 1 + 2);
    expect(coverWorth(over({ practice: true }), [ME])).toBeNull();
    expect(coverWorth(over({ phase: 'live' }), [ME])).toBeNull();
    expect(coverWorth(over({ winner: 'draw' }), [ME])).toBeNull();
    // Another page's accolade is not this one's.
    expect(coverWorth(over(), ['someone-else'])).toBeNull();
  });
  it('weighs each accolade, the MVP, people against, the bots\' level and the margin (at most three)', () => {
    const twice = [seat(ME, 'red', { feats: ['HAT TRICK', 'HAT TRICK', 'SAVIOR'] }), seat('bot-3', 'blue')];
    expect(coverWorth(over({ mvp: ME, score: { red: 9, blue: 0 } }, twice), [ME])).toBe(9 + 3 + 1 + 3);
    expect(coverWorth(over({ level: 'hard' }), [ME])).toBe(3 + 2 + 2);
    expect(coverWorth(over({ level: 'easy' }), [ME])).toBe(3 + 0 + 2);
    // A person on the other side (online, or a couch's rivals) is worth more than any level of bots.
    expect(coverWorth(over({}, [seat(ME, 'red', { feats: ['SAVIOR'] }), seat('them', 'blue')]), [ME])).toBe(3 + 3 + 2);
    // A couch's second person is on this device: their accolades count, on the winning side.
    expect(coverWorth(over({}, [seat(ME, 'red'), seat(SECOND, 'red', { feats: ['LONG GOAL'] }), seat('bot-3', 'blue')]), [ME, SECOND])).toBe(3 + 1 + 2);
    expect(coverWorth(over({}, [seat(ME, 'blue', { feats: ['LONG GOAL'] }), seat(SECOND, 'red', { feats: ['AERIAL GOAL'] })]), [ME, SECOND])).toBe(3 + 3 + 2);
  });
});

describe('the shelf (keepCover)', () => {
  it('keeps a cover - its face, worth and still - and reads it back; the results can say so', () => {
    const s = store();
    const kept = keepCover(face(4), 7, STILL, '10:1:goal-rush', s, 1_000);
    expect(kept).toMatchObject({ vol: 4, worth: 7, at: 1_000, mvp: { name: 'KONTA' } });
    expect(shelfCovers(s)).toHaveLength(1);
    expect(shelfStill(kept!.id, s)).toBe(STILL);
    expect(keptFor('10:1:goal-rush')).toBe(4);
    expect(keptFor('11:1:goal-rush')).toBe(0);
  });
  it('keeps the best twenty: a twenty-first better one takes the least\'s place, its still gone with it; a worse one is not kept', () => {
    const s = store();
    for (let i = 0; i < SHELF.keep; i++) expect(keepCover(face(i + 1), 5 + (i % 4), STILL, '', s, 1_000 + i)).not.toBeNull();
    expect(shelfCovers(s)).toHaveLength(SHELF.keep);
    expect([...s.map.keys()].filter(k => k.startsWith(SHELF.still))).toHaveLength(SHELF.keep);
    // The least: worth 5, and of those the oldest (vol 1).
    const least = shelfCovers(s).find(c => c.vol === 1)!;
    expect(keepCover(face(21), 4, STILL, '', s, 2_000)).toBeNull();
    expect(shelfCovers(s).map(c => c.vol)).not.toContain(21);
    expect([...s.map.keys()].filter(k => k.startsWith(SHELF.still))).toHaveLength(SHELF.keep);
    const better = keepCover(face(22), 6, STILL, '', s, 3_000)!;
    expect(better).not.toBeNull();
    const vols = shelfCovers(s).map(c => c.vol);
    expect(vols).toHaveLength(SHELF.keep);
    expect(vols).toContain(22);
    expect(vols).not.toContain(1);
    expect(s.map.has(SHELF.still + least.id)).toBe(false);
    expect(s.map.has(SHELF.still + better.id)).toBe(true);
    // An equal one replaces the older of the least.
    expect(keepCover(face(23), 5, STILL, '', s, 4_000)).not.toBeNull();
    expect(shelfCovers(s).map(c => c.vol)).not.toContain(5);
  });
  it('fails quietly where the browser refuses: nothing kept, nothing half-written, an empty shelf', () => {
    const full = store({ set: true });
    expect(keepCover(face(), 7, STILL, '', full)).toBeNull();
    expect(full.map.size).toBe(0);
    expect(() => volumeNext('goal-rush', full)).not.toThrow();
    const blocked = store({ get: true });
    expect(shelfCovers(blocked)).toEqual([]);
    expect(shelfHtml(coverHtml, blocked)).toBe('');
    expect(keepCover(face(), 7, STILL, '', null)).toBeNull();
    // The index refused after the still was written: the still is taken back.
    const s = store(), set = s.setItem;
    s.setItem = (k, v) => { if (k === SHELF.key) throw new Error('QuotaExceededError'); set(k, v); };
    expect(keepCover(face(), 7, STILL, '', s)).toBeNull();
    expect(s.map.size).toBe(0);
  });
  it('keeps no still past its budget, and nothing that is not a picture; reads a broken index as an empty shelf', () => {
    const s = store();
    expect(keepCover(face(), 7, `data:image/webp;base64,${'A'.repeat(SHELF.stillMost)}`, '', s)).toBeNull();
    expect(keepCover(face(), 7, 'javascript:alert(1)', '', s)).toBeNull();
    s.map.set(SHELF.key, '{"covers":[{"id":"x","mode":"chess"}],"vols":{"goal-rush":"many"}}');
    expect(shelfCovers(s)).toEqual([]);
    s.map.set(SHELF.key, 'not json');
    expect(shelfCovers(s)).toEqual([]);
    expect(keepCover(face(), 7, `data:image/svg+xml;base64,${'A'.repeat(100)}`, '', s)).toBeNull();
    expect(keepCover(face(), 7, `data:image/png;base64,${'A'.repeat(100)}`, '', s)).toBeNull();
    expect(keepCover(face(), 7, 'data:image/webp;base64,AAAA" onerror="alert(1)', '', s)).toBeNull();
    // Twenty stills at the budget: 800k characters, the shelf's whole.
    expect(SHELF.keep * SHELF.stillMost).toBe(800_000);
  });
  it('counts each mode\'s volumes on this device, and in memory where nothing is kept', () => {
    const s = store();
    expect(volumeNext('goal-rush', s)).toBe(1);
    expect(volumeNext('goal-rush', s)).toBe(2);
    expect(volumeNext('sky-spike', s)).toBe(1);
    // The count outlives the covers dropped from the shelf.
    keepCover(face(2), 7, STILL, '', s);
    expect(volumeNext('goal-rush', s)).toBe(3);
    const full = store({ set: true });
    const a = volumeNext('sky-spike', full), b = volumeNext('sky-spike', full);
    expect(b).toBe(a + 1);
  });
});

describe('the shelf in Account', () => {
  it('shows nothing at all while no cover is kept, and each kept cover over its still otherwise', () => {
    const s = store();
    expect(shelfHtml(coverHtml, s)).toBe('');
    keepCover(face(3), 7, STILL, '', s, 1_000);
    keepCover(face(1, { mode: 'sky-spike', arena: 'tide-court' }), 9, STILL, '', s, 2_000);
    const html = shelfHtml(coverHtml, s);
    expect(html).toContain('THE SHELF');
    expect(html).toContain('2 COVERS');
    expect(html.match(/class="bc-cover"/g)).toHaveLength(2);
    expect(html.match(/<img alt="" src="/g)).toHaveLength(2);
    // Goal Rush's volumes, then Sky Spike's.
    expect(html.indexOf('data-mode="goal-rush"')).toBeLessThan(html.indexOf('data-mode="sky-spike"'));
    expect(shelfOrder(shelfCovers(s)).map(c => c.mode)).toEqual(['goal-rush', 'sky-spike']);
  });
  it('leaves off a cover whose still was tampered with in storage, and the whole shelf when none is left', () => {
    const s = store();
    const a = keepCover(face(1), 7, STILL, '', s, 1_000)!, b = keepCover(face(2), 7, STILL, '', s, 2_000)!;
    const bad = ['" onerror="alert(1)', 'javascript:alert(1)', `data:image/svg+xml;base64,${'A'.repeat(40)}`, `data:image/webp;base64,${'A'.repeat(SHELF.stillMost)}`, 'data:image/jpeg;base64,AA AA'];
    for (const still of bad) {
      s.map.set(SHELF.still + a.id, still);
      expect(shelfStill(a.id, s)).toBeNull();
    }
    expect(shelfStill(b.id, s)).toBe(STILL);
    // (shelfHtml caches each still's address by id: fresh ids for the drawing below.)
    const t = store(), c = keepCover(face(5), 7, STILL, '', t, 5_000)!, d = keepCover(face(6), 7, STILL, '', t, 6_000)!;
    t.map.set(SHELF.still + c.id, '" onerror="alert(1)');
    const html = shelfHtml(coverHtml, t);
    expect(html).toContain('1 COVER ');
    expect(html).not.toContain('onerror');
    expect(html).toContain('VOL. 6');
    t.map.set(SHELF.still + d.id, 'javascript:alert(1)');
    // d's address was made already on this page; a fresh page reads the store again.
    expect(shelfStill(d.id, t)).toBeNull();
  });
});

describe('the cover (BallCover.ts)', () => {
  it('says the mode, the volume, the arena, the score, the winners and the MVP, escaped, without the tags the home restyles', () => {
    const html = coverHtml(face(12, { mvp: { name: '<B&D>', fighter: 'konta', team: 'red' } }), '<canvas></canvas>');
    expect(html).toContain('<b>GOAL</b><b>RUSH</b>');
    expect(html).toContain('VOL.<i>12</i>');
    expect(html).toContain('THE INK BOWL');
    expect(html).toContain('<i class="red">3</i>');
    expect(html).toContain('CRIMSON WIN');
    expect(html).toContain('&lt;B&amp;D&gt;');
    expect(html).toContain('MVP · ');
    expect(html).not.toMatch(/<(span|small)\b/);
    expect(coverHtml(face(1, { mode: 'sky-spike', winner: 'draw', mvp: null }), '')).toContain('<b>SKY</b><b>SPIKE</b>');
  });
  it('names the room\'s MVP (else the winners\' best), a bot or a default name by its fighter', () => {
    const v = over({ mvp: 'bot-3' }, [seat(ME, 'red', { name: 'amir', points: 90 }), seat('bot-3', 'blue', { fighter: 'oro', points: 120 })]);
    expect(coverFace(v, 5)).toMatchObject({ vol: 5, mode: 'goal-rush', winner: 'red', mvp: { name: FIGHTERS.oro.name.toUpperCase(), fighter: 'oro', team: 'blue' } });
    expect(coverFace({ ...v, mvp: null }, 5).mvp).toMatchObject({ name: 'AMIR', team: 'red' });
  });
});

describe('the winning frame (winningMoment)', () => {
  const live = (more: Partial<BallView>) => over({ phase: 'live', winner: null, ...more } as Partial<BallView>);
  it('Goal Rush: each frame as the clock runs out with the sides apart and the ball down; never with them level', () => {
    expect(winningMoment(live({ clock: .1 }))).toBe('live');
    expect(winningMoment(live({ clock: 0 }))).toBe('live');
    expect(winningMoment(live({ clock: COVER.lastLive + .5 }))).toBeNull();
    expect(winningMoment(live({ clock: .1, score: { red: 2, blue: 2 } }))).toBeNull();
    // The ball in the air when the clock runs out: the match ends as it comes down.
    expect(winningMoment(live({ clock: 0, ball: { y: 6, vy: 2, size: 1 } } as Partial<BallView>))).not.toBe('live');
    expect(winningMoment(live({ clock: 0, ball: { y: 1.4, vy: -8, size: 1 } } as Partial<BallView>))).toBe('live');
    expect(winningMoment(live({ clock: .1, practice: true }))).toBeNull();
  });
  it('keeps frames while the next goal or point may end it: Goal Rush in overtime or after time, Sky Spike at match point', () => {
    expect(winningMoment(live({ clock: .1, overtime: true }))).toBe('next');
    expect(winningMoment(live({ clock: 0, ball: { y: 6, vy: 2, size: 1 } } as Partial<BallView>))).toBe('next');
    expect(winningMoment(live({ clock: 0, score: { red: 1, blue: 1 } }))).toBe('next');
    expect(winningMoment(live({ clock: 40 }))).toBeNull();
    const spike = (red: number, blue: number, fever = false) => winningMoment(over({ mode: 'sky-spike', phase: 'live', winner: null, score: { red, blue }, target: 11, fever }));
    expect(spike(10, 8)).toBe('next');
    expect(spike(10, 10)).toBeNull();
    expect(spike(9, 6)).toBeNull();
    expect(spike(9, 6, true)).toBe('next');
    expect(spike(3, 14)).toBe('next');
  });
  it('the goal or point that ends it: a goal in overtime or after time; Sky Spike at its target two clear, or the cap', () => {
    expect(winningMoment(over({ phase: 'scored', overtime: true, clock: 0, winner: null }))).toBe('decided');
    expect(winningMoment(over({ phase: 'scored', clock: 30, winner: null }))).toBeNull();
    const spike = (red: number, blue: number) => winningMoment(over({ mode: 'sky-spike', phase: 'scored', winner: null, score: { red, blue }, target: 11 }));
    expect(spike(11, 9)).toBe('decided');
    expect(spike(11, 10)).toBeNull();
    expect(spike(13, 11)).toBe('decided');
    expect(spike(15, 14)).toBe('decided');
    expect(spike(7, 3)).toBeNull();
  });
});
