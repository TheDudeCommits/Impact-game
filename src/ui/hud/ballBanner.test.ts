import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BANNER_RANK, BANNER_RULES, LINE_RANK, LINE_RULES, Slot, type Shown } from './ballBanner';
import { SpikeCam } from '../../render/ball/SpikeCam';
import { BallChase, type ChaseFrame } from '../../render/ball/BallChase';
import { freshBall } from '../../game/ball/physics';
import { GOAL_RULES, SPIKE_RULES, type BallView } from '../../game/ball/model';
import type { FollowCamera } from '../../render/FollowCamera';

interface Banner extends Shown { title: string }
const banner = (title: string, priority: number, ms = 1600, urgent = false): Banner => ({ title, priority, ms, urgent });
const R = BANNER_RANK;

describe("the ball HUD's one banner (ballBanner.ts)", () => {
  it('shows one at a time, each for its own time', () => {
    const slot = new Slot<Banner>(BANNER_RULES);
    expect(slot.frame(0)).toBeNull();
    expect(slot.offer(banner('SAVE!', R.stop, 1600), 0)).toBe(true);
    expect(slot.frame(1599)?.title).toBe('SAVE!');
    expect(slot.frame(1600)).toBeNull();
  });
  it('a GOAL beats a PERFECT STRIKE: the greater moment takes the slot at once, and the lesser is dropped, not put back', () => {
    const slot = new Slot<Banner>(BANNER_RULES);
    slot.offer(banner('PERFECT VOLLEY!', R.skill, 1000), 0);
    expect(slot.offer(banner('GOOOAL!!', R.score, 3600), 200)).toBe(true);
    expect(slot.frame(200)?.title).toBe('GOOOAL!!');
    expect(slot.frame(3799)?.title).toBe('GOOOAL!!');
    // The strike's banner does not come back when the goal's ends.
    expect(slot.frame(3800)).toBeNull();
  });
  it('a lesser moment waits its turn, is shown briefly if it is still news, and is dropped if it is not', () => {
    const slot = new Slot<Banner>(BANNER_RULES);
    slot.offer(banner('STUFF BLOCK!', R.stop, 1400), 0);
    // A PERFECT STRIKE while the block's banner is up: it waits, and comes once the block's has gone - briefly.
    expect(slot.offer(banner('PERFECT VOLLEY!', R.skill, 2000), 600)).toBe(false);
    expect(slot.frame(1399)?.title).toBe('STUFF BLOCK!');
    expect(slot.frame(1400)?.title).toBe('PERFECT VOLLEY!');
    expect(slot.frame(1400 + BANNER_RULES.brief! - 1)?.title).toBe('PERFECT VOLLEY!');
    expect(slot.frame(1400 + BANNER_RULES.brief!)).toBeNull();
    // Behind a goal's long banner it would be stale by the time the slot frees: dropped.
    slot.offer(banner('GOOOAL!!', R.score, 3600), 10000);
    slot.offer(banner('TACKLE!', R.fight, 1000), 10100);
    expect(slot.frame(13599)?.title).toBe('GOOOAL!!');
    expect(slot.frame(13600)).toBeNull();
  });
  it('never stacks: of those that come while one is up only the best waits (the newest of equals), and one at most', () => {
    const slot = new Slot<Banner>(BANNER_RULES);
    slot.offer(banner('OVERTIME', R.turn, 1000), 0);
    slot.offer(banner('PERFECT VOLLEY!', R.skill), 100);
    slot.offer(banner('SAVE!', R.stop), 200);
    slot.offer(banner('TACKLE!', R.fight), 300);
    slot.offer(banner('DIVING SAVE!', R.stop), 400);
    expect(slot.frame(999)?.title).toBe('OVERTIME');
    expect(slot.frame(1000)?.title).toBe('DIVING SAVE!');
    // After it, nothing: the other three were dropped.
    expect(slot.frame(1000 + BANNER_RULES.brief!)).toBeNull();
    expect(slot.frame(9000)).toBeNull();
  });
  it('one worth as much replaces the one up (a save after a save, the count ticking down)', () => {
    const slot = new Slot<Banner>(BANNER_RULES);
    slot.offer(banner('3', R.count, 1000, true), 0);
    expect(slot.offer(banner('2', R.count, 1000, true), 1000)).toBe(true);
    expect(slot.offer(banner('1', R.count, 1000, true), 1990)).toBe(true);
    expect(slot.frame(2000)?.title).toBe('1');
  });
  it("the kickoff's count is on its beat or not at all: over a goal's banner still up, never waiting behind the match's end", () => {
    const slot = new Slot<Banner>(BANNER_RULES);
    slot.offer(banner('GOOOAL!!', R.score, 3600), 0);
    expect(slot.offer(banner('1', R.count, 1000, true), 2400)).toBe(true);
    expect(slot.frame(2400)?.title).toBe('1');
    const end = new Slot<Banner>(BANNER_RULES);
    end.offer(banner('CRIMSON WIN', R.win, 4200), 0);
    expect(end.offer(banner('3', R.count, 1000, true), 100)).toBe(false);
    expect(end.frame(4200)).toBeNull();
  });
  it('lets go of everything when a replay begins', () => {
    const slot = new Slot<Banner>(BANNER_RULES);
    slot.offer(banner('GOOOAL!!', R.score, 3600), 0); slot.offer(banner('SAVE!', R.stop), 100);
    slot.clear();
    expect(slot.frame(200)).toBeNull(); expect(slot.frame(3600)).toBeNull();
  });
  it('ranks the moments: the end, the count, a score, the turns of a match, the duels, the stops, the fights, the skills', () => {
    const order = [R.win, R.count, R.score, R.turn, R.duel, R.stop, R.fight, R.skill];
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeLessThan(order[i - 1]);
  });
});

describe('the one line under the score (ballBanner.ts LINE_RULES)', () => {
  const line = (title: string, priority: number): Banner => ({ title, priority, ms: 2600 });
  it('is one line, never a feed: the newest takes the place of the last, and nothing waits', () => {
    const slot = new Slot<Banner>(LINE_RULES);
    slot.offer(line('KONTA · BLAST · 119 KM/H', LINE_RANK.strike), 0);
    expect(slot.offer(line('NIGO · VOLLEY · 101 KM/H', LINE_RANK.strike), 300)).toBe(true);
    expect(slot.frame(300)?.title).toBe('NIGO · VOLLEY · 101 KM/H');
    expect(slot.frame(2900)).toBeNull();
  });
  it('a named moment keeps its first second from a strike, then gives way', () => {
    const slot = new Slot<Banner>(LINE_RULES);
    slot.offer(line('HAT TRICK! · KONTA', LINE_RANK.named), 0);
    expect(slot.offer(line('NIGO · VOLLEY · 101 KM/H', LINE_RANK.strike), 400)).toBe(false);
    expect(slot.frame(999)?.title).toBe('HAT TRICK! · KONTA');
    expect(slot.offer(line('GOSU · BLAST · 90 KM/H', LINE_RANK.strike), LINE_RULES.yieldAfter!)).toBe(true);
    // The strike that could not have the line is gone for good.
    expect(slot.frame(LINE_RULES.yieldAfter! + 2600)).toBeNull();
  });
});

// ─── Where the banner stands: ballHud.css's own numbers against the net and the goal mouths ───────────────────────────
const css = readFileSync(new URL('./ballHud.css', import.meta.url), 'utf8');
/** The top stack as ballHud.css lays it (its first rule and the phone's media rule): each piece's height in the HUD's
 *  unit, and the most a unit can be of the view's height. */
function stack(rule: string) {
  const n = (name: string) => { const m = new RegExp(`--bh-${name}:([\\d.]+)[;}]`).exec(rule); return m ? Number(m[1]) : NaN; };
  const unit = /--bh-u:min\(([^)]+)\)/.exec(rule)![1], vh = /([\d.]+)vh/.exec(unit)![1];
  return { edge: n('edge'), bug: n('bug'), lineGap: n('line-gap'), line: n('line'), bannerGap: n('banner-gap'), banner: n('banner'), perHeight: Number(vh) / 100 };
}
const wideRule = css.slice(css.indexOf('{--bh-red'), css.indexOf('@supports'));
const phoneRule = css.slice(css.indexOf('@media(max-height:520px)'), css.indexOf('/* Nobody'));
/** A phone on its side: while a banner is up it stands in the line's place (the line hidden), but for the kickoff's count. */
const phoneMedia = css.slice(css.lastIndexOf('@media(max-height:520px)'));
const overLine = phoneMedia.includes('.bh-line:has(+.bh-banner.on:not([data-kind="count"])){display:none}');
const wide = { ...stack(wideRule), overLine: false }, phone = { ...wide, ...Object.fromEntries(Object.entries(stack(phoneRule)).filter(([, v]) => Number.isFinite(v))), overLine };
/** The banner's place as shares of the view's height, at the most a unit can be (a view as wide as it is tall or wider). */
const band = (s: typeof wide) => { const top = (s.edge + s.bug + (s.overLine ? 0 : s.lineGap + s.line) + s.bannerGap) * s.perHeight; return { top, foot: top + s.banner * s.perHeight }; };

const view = (o: Partial<BallView> = {}): BallView => ({
  kind: 'ball', mode: 'sky-spike', phase: 'live', access: 'bots', round: 1, hostId: null, capacity: 6, fillBots: true, startsAt: null, startedAt: 0, endsAt: 0, phaseUntil: 0,
  seats: [], score: { red: 0, blue: 0 }, ball: { ...freshBall(), held: false }, clock: 0, overtime: false, touchTeam: null, touches: 0, rally: 1, servingTeam: 'red', serverId: null,
  target: 11, fever: false, winner: null, reason: '', mvp: null, events: [], replay: null, rumble: false, charms: [], effects: [], practice: false, best: 0, aim: null, hits: 0, streak: 0, bestStreak: 0, ...o } as BallView);
/** The highest a set of points stands in a lens's frame, as a share of its height from the top. */
function highest(lens: THREE.PerspectiveCamera, points: THREE.Vector3[]) {
  lens.updateMatrixWorld(); lens.updateProjectionMatrix();
  let top = Infinity;
  for (const p of points) { const v = p.clone().project(lens); if (v.z < 1) top = Math.min(top, (1 - v.y) / 2); }
  return top;
}
/** The views the HUD is drawn in: a 16:9 screen, a phone on its side, and a split screen's halves (side by side, one over
 *  the other) at 1080p. */
const VIEWS = [{ name: '1920 x 1080', aspect: 16 / 9, s: wide }, { name: 'a phone, 844 x 390', aspect: 844 / 390, s: phone }, { name: 'a half, side by side', aspect: 957 / 1080, s: wide }, { name: 'a half, top and bottom', aspect: 1920 / 537, s: wide }];

describe("the banner's place (ballHud.css) against the net and the goal mouths, as the default cameras frame them", () => {
  it('reads the stack from the stylesheet: the score bug half again as big, the line, the banner, each under the last', () => {
    expect(wide).toMatchObject({ edge: 8, bug: 76, line: 34, banner: 120 });
    // The bug was 42 px tall at 1080p: half again as big is 63 or more.
    expect(wide.bug).toBeGreaterThanOrEqual(63);
    expect(wide.perHeight).toBeCloseTo(1 / 1080, 5);
    // Under a quarter of the view on a screen; on a phone, where the banner stands in the line's place, about a fifth.
    expect(band(wide).foot).toBeLessThan(.235); expect(phone.overLine).toBe(true); expect(band(phone).foot).toBeLessThan(.215);
    expect(band(phone).top).toBeGreaterThan(.1);
  });
  it("Sky Spike: the banner's foot is over the net's top, wherever the rally takes the broadcast camera", () => {
    const S = SPIKE_RULES, net: THREE.Vector3[] = [];
    // The net's band and the tops of its posts, across the court.
    for (const x of [-S.courtHalfX, -S.courtHalfX / 2, 0, S.courtHalfX / 2, S.courtHalfX]) for (const y of [S.netHeight - 1, S.netHeight, S.netHeight + S.netPost - 1]) net.push(new THREE.Vector3(x, y, 0));
    for (const { name, aspect, s } of VIEWS) for (const team of ['red', 'blue'] as const) {
      const side = team === 'red' ? -1 : 1;
      // A ball at the net, a high set, a deep one, a serve from their end, a dig at the baseline.
      for (const [bx, by, bz, sz] of [[0, 3, 0, 5], [0, 9, 0, 5], [0, 12, 4, 8], [3, 2, -6, 2], [0, 6, 8, 9], [-6, 1, 9, 10]] as const) {
        const cam = new SpikeCam(), rig = { mode: 'dynamic', keepInView: null, sportFov: 14, movementYaw: 0 } as unknown as FollowCamera, lens = new THREE.PerspectiveCamera(50, aspect, .1, 500);
        for (let i = 0; i < 240; i++) { cam.steer(rig, 1 / 60, 0, 0, true, { x: 0, y: 0, z: side * sz }, new THREE.Vector3(bx, by, bz * side), view(), team, aspect); cam.aim(rig, lens, 0); }
        expect(highest(lens, net), `${name}, ${team}, ball ${bx},${by},${bz}`).toBeGreaterThan(band(s).foot + .03);
      }
    }
  });
  it("Sky Spike: and over it when the lens closes in - a long rally, match point, the point a perfect spike wins - as a banner says so", () => {
    // (The broadcast camera pushes in and narrows for these, render/ball/SpikeCam.ts TENSE, CRESCENDO and POINT, and they are
    // the moments a banner is up for: FEVER RALLY, MATCH POINT, KILL. Measured live at 844 x 390 before this test, the
    // rally's lens lifted the net to 93 px from the top.)
    const S = SPIKE_RULES, net: THREE.Vector3[] = [];
    for (const x of [-S.courtHalfX, -S.courtHalfX / 2, 0, S.courtHalfX / 2, S.courtHalfX]) for (const y of [S.netHeight - 1, S.netHeight, S.netHeight + S.netPost - 1]) net.push(new THREE.Vector3(x, y, 0));
    for (const { name, aspect, s } of VIEWS) for (const team of ['red', 'blue'] as const) {
      const side = team === 'red' ? -1 : 1, foe = team === 'red' ? 'blue' : 'red';
      const cases: [string, Partial<BallView>[]][] = [
        ['a fever rally', [{ rally: 12, fever: true }]],
        ['match point, live', [{ score: { red: 10, blue: 10 }, rally: 8 }]],
        // A perfect spike into their court, then its point: the lens follows, punches in and pushes toward where it landed.
        ['the point of a perfect spike', [{ events: [{ id: 1, at: 0, kind: 'strike', perfect: true, shot: 'spike', x: 0, y: 3, z: 0 }] as BallView['events'] },
          { phase: 'scored', rally: 9, score: { red: 10, blue: 10 }, events: [{ id: 1, at: 0, kind: 'strike', perfect: true, shot: 'spike', x: 0, y: 3, z: 0 }, { id: 2, at: 0, kind: 'kill', team, x: 1.5, y: 0, z: -side * 6 }] as BallView['events'] }]],
        // (Not here, and not the HUD's to mend: a point THEY win on your side. The lens pushes toward where it landed, down
        // and nearer, and the net climbs to 14-15% of the frame from the top (11% in a half, one over the other), under the
        // score bug's line but over the banner's foot - so their ACE! or KILL! stands on the net's top while the ball is
        // dead. Live play, above, never.)
      ];
      for (const [what, steps] of cases) {
        const cam = new SpikeCam(), rig = { mode: 'dynamic', keepInView: null, sportFov: 14, movementYaw: 0 } as unknown as FollowCamera, lens = new THREE.PerspectiveCamera(50, aspect, .1, 500);
        let top = Infinity;
        // Placed first on a plain rally, then each step held two seconds; the highest the net stands at any frame counts.
        for (const step of [{}, ...steps]) for (let i = 0; i < 120; i++) {
          cam.steer(rig, 1 / 60, 0, 0, true, { x: 0, y: 0, z: side * 4 }, new THREE.Vector3(0, 2.5, -side * 5), view({ servingTeam: foe, ...step }), team, aspect); cam.aim(rig, lens, 0);
          top = Math.min(top, highest(lens, net));
        }
        expect(top, `${name}, ${team}, ${what}`).toBeGreaterThan(band(s).foot + .01);
      }
    }
  });
  it("Goal Rush: the banner's foot is over the far goal's bar from the kickoff to five metres out from its line", () => {
    const G = GOAL_RULES, mouth = [-G.goalHalfWidth, 0, G.goalHalfWidth].flatMap(x => [0, G.goalHeight].map(y => new THREE.Vector3(x, y, G.halfZ)));
    for (const { name, aspect, s } of VIEWS) {
      // From your own end to five metres out from their line, a ball on the floor ahead of you and a high one.
      for (const z of [-G.halfZ + 4, -10, 0, 8, 14, 18, G.halfZ - 5]) for (const by of [.8, 6]) {
        const lens = new THREE.PerspectiveCamera(64, aspect, .1, 500), rig = new BallChase();
        const frame: ChaseFrame = { self: new THREE.Vector3(0, 0, z), heading: 0, ball: new THREE.Vector3(0, by, Math.min(G.halfZ - 1, z + 8)), fight: false, mode: 'goal-rush', boosting: false, shake: 0 };
        for (let i = 0; i < 180; i++) rig.aim(lens, 1 / 60, true, frame);
        expect(highest(lens, mouth), `${name}, ${G.halfZ - z} m out, ball ${by} m up`).toBeGreaterThan(band(s).foot + .01);
      }
    }
  });
});
