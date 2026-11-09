import { describe, expect, it } from 'vitest';
import { ATTACK, CLUSTER_GAP, CLUSTER_TOP, clusterBoxes, coolSeconds, DASH_STAMINA, EDGE_GAP, FAR_TOP, MOVE_RING, RIGHT_COLUMN, RIGHT_TOP, SKILL_RING, spotStyle, TOUCH_LAYOUT, touchMeters, type ClusterButton } from '../src/input/touchLayout';
import { STICK_SHARE, TOUCH_BUTTONS } from '../src/input/touch';
import { SPORT_FAR_TOP, SPORT_LAYOUT, SPORT_REACH, SUPER_CHARGING, type SportSlot } from '../src/input/sportTouch';
import type { Spot } from '../src/input/touchLayout';
import { touchLabel, type PromptAction } from '../src/ui/prompts';
import type { PlayerState } from '../src/game/types';

const spots = Object.entries(TOUCH_LAYOUT) as [ClusterButton, (typeof TOUCH_LAYOUT)['light']][];
const SCREENS = [
  { name: 'iPhone 14', w: 844, h: 390, k: 1, l: 47, r: 47, b: 21 },
  { name: 'Pixel 7', w: 915, h: 412, k: 1, l: 0, r: 0, b: 0 },
  { name: 'iPhone SE', w: 667, h: 375, k: 1, l: 0, r: 0, b: 0 },
  { name: 'iPhone in Safari', w: 734, h: 343, k: .88, l: 0, r: 0, b: 0 },
  { name: 'tablet', w: 1180, h: 820, k: 1.3, l: 0, r: 0, b: 20 },
] as const;
const phones = SCREENS.filter(s => s.h < 600);
type Box = readonly [number, number, number, number];
const overlap = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

describe('the touch fan (input/touchLayout.ts)', () => {
  it('places every button on screen but PAUSE and the emote, which go along the top (placeTop)', () => {
    const fan = TOUCH_BUTTONS.map(([id]) => id).filter(id => id !== 'pause' && id !== 'emote');
    expect(Object.keys(TOUCH_LAYOUT).sort()).toEqual([...fan].sort());
  });
  it('keeps every button clear of every other, by CLUSTER_GAP', () => {
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
      const [a, s] = spots[i], [b, t] = spots[j];
      const gap = Math.hypot(s.x - t.x, s.y - t.y) - (s.d + t.d) / 2;
      expect(gap, `${a} - ${b}`).toBeGreaterThanOrEqual(CLUSTER_GAP);
    }
  });
  it('keeps every button inside the safe area, EDGE_GAP from its right and bottom', () => {
    for (const [id, s] of spots) {
      expect(s.x - s.d / 2, id).toBeGreaterThanOrEqual(EDGE_GAP);
      expect(s.y - s.d / 2, id).toBeGreaterThanOrEqual(EDGE_GAP);
    }
  });
  it('is sized for a thumb: 44 px or more even at a short phone\'s scale, LIGHT the largest', () => {
    for (const [id, s] of spots) expect(s.d * .88, id).toBeGreaterThanOrEqual(44);
    for (const [id, s] of spots) if (id !== 'light') expect(s.d, id).toBeLessThan(ATTACK.d);
  });
  it('rings LIGHT: the skills on the first ring, DASH, GUARD and JUMP on the second, the rest further out', () => {
    const from = (s: { x: number; y: number }) => Math.hypot(s.x - ATTACK.x, s.y - ATTACK.y);
    for (const id of ['heavy', 'special', 'area', 'ultimate'] as const) expect(from(TOUCH_LAYOUT[id])).toBeCloseTo(SKILL_RING, 0);
    for (const id of ['dash', 'guard', 'jump'] as const) expect(from(TOUCH_LAYOUT[id])).toBeCloseTo(MOVE_RING, 0);
    for (const id of ['awaken', 'target'] as const) expect(from(TOUCH_LAYOUT[id])).toBeGreaterThan(MOVE_RING + 50);
    // A quarter ring: the skills run from left of LIGHT, round over its top.
    const angle = (s: { x: number; y: number }) => Math.atan2(s.y - ATTACK.y, ATTACK.x - s.x) * 180 / Math.PI;
    const skills = (['heavy', 'special', 'area', 'ultimate'] as const).map(id => (angle(TOUCH_LAYOUT[id]) + 360) % 360);
    expect(skills[0]).toBeGreaterThan(180); expect(skills[3]).toBeLessThan(90);
    for (let i = 1; i < skills.length; i++) expect(skills[i]).toBeLessThan(skills[i - 1]);
  });
  it('keeps every button in the right thumb\'s reach, the moves nearest', () => {
    for (const [id, s] of spots) expect(Math.hypot(s.x, s.y), id).toBeLessThan(300);
    const reach = (id: ClusterButton) => Math.hypot(TOUCH_LAYOUT[id].x, TOUCH_LAYOUT[id].y);
    for (const id of ['heavy', 'special', 'dash', 'guard'] as const) expect(reach(id)).toBeLessThan(reach('awaken'));
  });
  it('stays low: under CLUSTER_TOP, under RIGHT_TOP in the right-most column, AWAKEN and LOCK under the prompt lane', () => {
    for (const [id, s] of spots) {
      expect(s.y + s.d / 2, id).toBeLessThanOrEqual(CLUSTER_TOP);
      if (s.x - s.d / 2 < RIGHT_COLUMN) expect(s.y + s.d / 2, id).toBeLessThanOrEqual(RIGHT_TOP);
    }
    for (const id of ['awaken', 'target'] as const) expect(TOUCH_LAYOUT[id].y + TOUCH_LAYOUT[id].d / 2).toBeLessThanOrEqual(FAR_TOP);
  });
  it('is placed by its right and bottom edges (handheld.css .tc-btn)', () => {
    expect(spotStyle({ d: 50, x: 100, y: 40 })).toEqual({ '--d': '50px', '--x': '75px', '--y': '15px' });
    expect(spotStyle(ATTACK)['--d']).toBe(`${ATTACK.d}px`);
  });
});

describe('the fan on real screens', () => {
  for (const s of SCREENS) it(`${s.name} (${s.w}x${s.h})`, () => {
    const boxes = Object.entries(clusterBoxes(s.w, s.h, s.k, { right: s.r, bottom: s.b })) as [ClusterButton, Box][];
    // The stick's resting ring (handheld.css .tc-stick-home: 40 px in, 34 up, 116 across, all times --tc-k).
    const home: Box = [40 * s.k + s.l, s.h - s.b - (34 + 116) * s.k, (40 + 116) * s.k + s.l, s.h - s.b - 34 * s.k];
    for (const [id, box] of boxes) {
      expect(box[0], id).toBeGreaterThanOrEqual(s.l);
      expect(box[2], id).toBeLessThanOrEqual(s.w - s.r);
      expect(box[3], id).toBeLessThanOrEqual(s.h - s.b);
      expect(box[1], id).toBeGreaterThan(s.h * .4);
      // The left of the screen is the stick's (a touch there starts it), and its ring stays clear.
      expect(box[0], id).toBeGreaterThan(s.w * STICK_SHARE);
      expect(overlap(box, home), id).toBe(false);
      // Hit boxes: 44 px or more.
      expect(box[2] - box[0], id).toBeGreaterThanOrEqual(44);
    }
  });
  it('leaves the prompt lane its room on a phone: a long prompt centred at 40% of the width, its foot at 38% of the height', () => {
    for (const s of phones) {
      // handheld.css: zone 6 at left 40%, --mh-lane 38% (from the screen's foot), drawn .86 of its size; a long prompt
      // ("LOCK ON · TAP AGAIN TO SWITCH TARGET") measured 315 px wide and 37 tall on a 667 px phone.
      const foot = s.h * (1 - .38), lane: Box = [s.w * .4 - 158, foot - 37, s.w * .4 + 158, foot];
      for (const [id, box] of Object.entries(clusterBoxes(s.w, s.h, s.k, { right: s.r, bottom: s.b })) as [ClusterButton, Box][]) expect(overlap(box, lane), `${s.name} ${id}`).toBe(false);
    }
  });
  it('leaves Training\'s FORGE tab its corner above ULT on a phone (handheld.css: 22vh down, 87 px tall)', () => {
    for (const s of phones) {
      const tab: Box = [s.w - s.r - 30, s.h * .22, s.w - s.r, s.h * .22 + 87];
      const boxes = clusterBoxes(s.w, s.h, s.k, { right: s.r, bottom: s.b });
      for (const [id, box] of Object.entries(boxes)) expect(overlap(box, tab), `${s.name} ${id}`).toBe(false);
    }
  });
});

describe('what the buttons show (touchMeters, ten times a second)', () => {
  const self = (over: Partial<PlayerState> = {}) => ({ fighter: 'konta', stamina: 100, ultimate: 0, awakening: 0, alive: true, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...over }) as PlayerState;
  it('reads each cooldown\'s seconds left from the server clock', () => {
    const m = touchMeters(self({ cooldowns: { light: 10.2, heavy: 12, special: 14.5, ultimate: 0, area: 9 } }), 10);
    expect(m.cool.light).toBeCloseTo(.2); expect(m.cool.heavy).toBeCloseTo(2); expect(m.cool.special).toBeCloseTo(4.5); expect(m.cool.area).toBe(0);
    expect(touchMeters(self({ cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } }), 10).cool.area).toBe(0);
  });
  it('prints whole seconds, rounded up, and nothing once ready', () => {
    expect(coolSeconds(0)).toBe(''); expect(coolSeconds(.04)).toBe('');
    expect(coolSeconds(.3)).toBe('1'); expect(coolSeconds(1)).toBe('1'); expect(coolSeconds(4.2)).toBe('5'); expect(coolSeconds(11.6)).toBe('12');
  });
  it('fills ULT and AWAKEN to their costs, and drains AWAKEN while the form lasts', () => {
    expect(touchMeters(self({ ultimate: 50 }), 0).ultimate).toBeCloseTo(.5);
    expect(touchMeters(self({ ultimate: 140 }), 0).ultimate).toBe(1);
    expect(touchMeters(self({ awakening: 25 }), 0)).toMatchObject({ awakening: .25, awake: false });
    const awake = touchMeters(self({ awakened: true, awakenedUntil: 19, awakening: 0 }), 10);
    expect(awake.awake).toBe(true); expect(awake.awakening).toBeCloseTo(9 / 18);
    expect(touchMeters(self({ ultimate: NaN }), 0).ultimate).toBe(0);
  });
  it('counts the dashes in hand: one per DASH_STAMINA, out of what the bar holds', () => {
    expect(touchMeters(self({ stamina: 100 }), 0)).toMatchObject({ dashes: 5, dashMax: 5 });
    expect(touchMeters(self({ stamina: DASH_STAMINA - .1 }), 0).dashes).toBe(0);
    expect(touchMeters(self({ stamina: 45 }), 0).dashes).toBe(2);
    expect(touchMeters(self({ stamina: 60, maxStamina: 160 }), 0)).toMatchObject({ dashes: 3, dashMax: 8 });
  });
});

describe('the buttons keep the names the prompts give them (prompts.ts touchKey)', () => {
  it('LIGHT, HEAVY, SPECIAL, ULT, AREA, AWAKEN, JUMP, DASH, GUARD and LOCK', () => {
    const action: Record<string, PromptAction> = { light: 'light', heavy: 'heavy', special: 'special', ultimate: 'ultimate', area: 'area', awaken: 'awaken', jump: 'jump', dash: 'dash', guard: 'guard', target: 'target', pause: 'menu' };
    for (const [id, label] of TOUCH_BUTTONS) if (action[id]) expect(touchLabel(action[id]), id).toBe(label);
  });
});

describe('the ball modes\' own set (input/sportTouch.ts)', () => {
  const slots = Object.entries(SPORT_LAYOUT) as [SportSlot, Spot][];
  const charging: Spot = { ...SPORT_LAYOUT.super, d: SUPER_CHARGING };
  it('is six buttons at most, every one clear of every other by CLUSTER_GAP and inside the safe area', () => {
    expect(slots).toHaveLength(6);
    for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
      const [a, s] = slots[i], [b, t] = slots[j];
      expect(Math.hypot(s.x - t.x, s.y - t.y) - (s.d + t.d) / 2, `${a} - ${b}`).toBeGreaterThanOrEqual(CLUSTER_GAP);
    }
    for (const [id, s] of [...slots, ['super', charging] as const]) { expect(s.x - s.d / 2, id).toBeGreaterThanOrEqual(EDGE_GAP); expect(s.y - s.d / 2, id).toBeGreaterThanOrEqual(EDGE_GAP); }
  });
  it('is sized for a thumb, the shot the largest and in the corner', () => {
    for (const [id, s] of slots) expect(s.d * .88, id).toBeGreaterThanOrEqual(44);
    for (const [id, s] of slots) if (id !== 'main') { expect(s.d, id).toBeLessThan(SPORT_LAYOUT.main.d); expect(Math.hypot(s.x, s.y), id).toBeGreaterThan(Math.hypot(SPORT_LAYOUT.main.x, SPORT_LAYOUT.main.y)); }
    // The pass beside the shot, the jump over it: the nearest two.
    const reach = (id: SportSlot) => Math.hypot(SPORT_LAYOUT[id].x - SPORT_LAYOUT.main.x, SPORT_LAYOUT[id].y - SPORT_LAYOUT.main.y);
    for (const id of ['run', 'side', 'super'] as const) { expect(reach('pass')).toBeLessThan(reach(id)); expect(reach('jump')).toBeLessThan(reach(id)); }
  });
  it('stays low and near: under CLUSTER_TOP, the right-most column under RIGHT_TOP, the far column under the prompt lane, all within SPORT_REACH', () => {
    for (const [id, s] of slots) {
      expect(s.y + s.d / 2, id).toBeLessThanOrEqual(CLUSTER_TOP);
      if (s.x - s.d / 2 < RIGHT_COLUMN) expect(s.y + s.d / 2, id).toBeLessThanOrEqual(RIGHT_TOP);
      expect(s.x + s.d / 2, id).toBeLessThanOrEqual(SPORT_REACH);
    }
    for (const id of ['run', 'super'] as const) expect(SPORT_LAYOUT[id].y + SPORT_LAYOUT[id].d / 2, id).toBeLessThanOrEqual(SPORT_FAR_TOP);
  });
  for (const s of SCREENS) it(`fits ${s.name} (${s.w}x${s.h}): clear of the stick, the prompt lane and the sports HUD's meter`, () => {
    const right = s.w - s.r, bottom = s.h - s.b;
    const box = (p: Spot): Box => [right - (p.x + p.d / 2) * s.k, bottom - (p.y + p.d / 2) * s.k, right - (p.x - p.d / 2) * s.k, bottom - (p.y - p.d / 2) * s.k];
    const home: Box = [40 * s.k + s.l, s.h - s.b - (34 + 116) * s.k, (40 + 116) * s.k + s.l, s.h - s.b - 34 * s.k];
    const foot = s.h * (1 - .38), lane: Box = [s.w * .4 - 158, foot - 37, s.w * .4 + 158, foot];
    // ballHud.css: on a touch phone the meter and its stance badge stand at 40% of the width (zone 9), 14vh + 26 px up,
    // 210 px wide, the badge over it (about 50 px in all).
    const meterFoot = s.h - (s.h * .14 + 26), meter: Box = [s.w * .4 - 105, meterFoot - 50, s.w * .4 + 105, meterFoot];
    for (const [id, p] of [...slots, ['super', charging] as const]) {
      const b = box(p);
      expect(b[0], id).toBeGreaterThan(s.w * STICK_SHARE);
      expect(b[2], id).toBeLessThanOrEqual(s.w - s.r); expect(b[3], id).toBeLessThanOrEqual(s.h - s.b);
      expect(overlap(b, home), id).toBe(false);
      if (s.h < 600) { expect(overlap(b, lane), `${id} - the prompt lane`).toBe(false); expect(overlap(b, meter), `${id} - the meter`).toBe(false); }
    }
  });
});
