/** The style meter: a letter grade for how the fighting looks, not only how
 *  much of it there is. Variety climbs it - a different slot than the last
 *  two, a body in the air, a launch, a parry, several kills in one breath -
 *  and repetition climbs it barely at all. It drains on its own, faster the
 *  higher it stands, and a hit taken knocks it down a rank and a half. The
 *  grade multiplies the score: fighting well is worth more than fighting long. */

export const RANKS = [
  { letter: 'D', word: 'DULL', at: 0, score: 1 },
  { letter: 'C', word: 'CRISP', at: 90, score: 1.2 },
  { letter: 'B', word: 'BRUTAL', at: 200, score: 1.45 },
  { letter: 'A', word: 'AWAKENED', at: 340, score: 1.75 },
  { letter: 'S', word: 'SAVAGE', at: 520, score: 2.1 },
  { letter: 'SS', word: 'SUPREME', at: 740, score: 2.5 },
  { letter: 'SSS', word: 'SHŌNEN LEGEND', at: 1000, score: 3 },
] as const;
const CAP = 1250;
/** Style points a second that passive damage can add at most: an S-rank
 *  build tearing through a crowd holds a grade up to B on its own, never A
 *  (at 20 it read D DULL through the climax); the fighter's own blows take it higher. */
const PASSIVE_RATE = 24;
/** The grade a running KO chain holds up whatever else (kills with no
 *  three-second gap, the arts' too, as the HUD counts it): the massacre is
 *  style - the meter read "D DULL" through chains of a thousand. SS and SSS
 *  are still the fighter's own blows'. By chain length, the points held. */
const CHAIN_FLOOR = [[400, 520], [150, 340], [60, 200], [20, 90]] as const;
const CHAIN_GAP = 3;

export type StyleAction = 'light' | 'heavy' | 'special' | 'ultimate' | 'orbital' | 'proc';

export class StyleMeter {
  points = 0;
  /** What style is worth on this stretch of the road (set by the run, 0.6 at
   *  F to 1.3 at S): a handful of grunts at F fed the grade to SSS in the first
   *  minute and a hundred at S held it at C - the meter ran backwards. */
  worth = 1;
  /** Highest rank reached this run, by index. */
  best = 0;
  private recent: StyleAction[] = [];
  private lastGain = -10;
  private lastHurt = -10;
  /** When the fighter's own blows last landed (not their upgrades'). */
  private lastOwn = -99;
  private kills: number[] = [];
  private chain = 0;
  private chainAt = -99;

  get rank() { let i = 0; while (i + 1 < RANKS.length && this.points >= RANKS[i + 1].at) i++; return i; }
  get multiplier() { return RANKS[this.rank].score; }
  /** How far into the current rank the meter is, 0-1, for the gauge. */
  get fill() {
    const i = this.rank, from = RANKS[i].at, to = i + 1 < RANKS.length ? RANKS[i + 1].at : CAP;
    return Math.max(0, Math.min(1, (this.points - from) / (to - from)));
  }

  /** What passive damage - arts, blades, chains, burns - may still add, refilled over time:
   *  the grade is for how the fighter fights, not for what their upgrades do on their own. */
  private passive = PASSIVE_RATE;
  private passiveAt = 0;

  private gain(amount: number, now: number) {
    this.points = Math.min(CAP, this.points + amount * this.worth);
    this.lastGain = now;
    this.best = Math.max(this.best, this.rank);
  }
  /** A little for passive work, from a small budget, and it does not hold off the drain. */
  private trickle(amount: number, now: number) {
    this.passive = Math.min(PASSIVE_RATE, this.passive + (now - this.passiveAt) * PASSIVE_RATE);
    this.passiveAt = now;
    const take = Math.min(this.passive, amount);
    this.passive -= take;
    this.points = Math.min(CAP, this.points + take * this.worth);
    this.best = Math.max(this.best, this.rank);
  }

  /** A landed blow. `airborne` is the target off the floor, `launch` a blow
   *  that put them there, `crit` a critical. */
  hit(action: StyleAction, now: number, airborne: boolean, launch: boolean, crit: boolean) {
    if (action === 'orbital' || action === 'proc') { this.trickle(.6, now); return; }
    this.lastOwn = now;
    const base = { light: 5, heavy: 9, special: 12, ultimate: 10 }[action];
    const fresh = this.recent.includes(action) ? (this.recent[this.recent.length - 1] === action ? .55 : .8) : 1.6;
    this.recent.push(action); if (this.recent.length > 2) this.recent.shift();
    this.gain(base * fresh + (airborne ? 6 : 0) + (launch ? 5 : 0) + (crit ? 3 : 0), now);
  }
  /** A kill; several of the fighter's own inside a breath are worth more
   *  each (up to six deep). One the upgrades made on their own is a trickle. */
  kill(now: number, elite = false, passive = false) {
    if (now - this.chainAt > CHAIN_GAP) this.chain = 0;
    this.chain++; this.chainAt = now;
    if (passive) { this.trickle(elite ? 10 : 3, now); this.hold(now); return; }
    this.lastOwn = now;
    this.kills = this.kills.filter(t => now - t < .6); this.kills.push(now);
    this.gain(10 + Math.min(6, this.kills.length - 1) * 8 + (elite ? 30 : 0), now);
  }
  bonus(amount: number, now: number) { this.gain(amount, now); }
  /** What the fight achieved - a boss broken, a boss felled: all of it to a
   *  fighter whose own blows were in it, a trickle to one whose upgrades did
   *  it while they stood by. */
  earned(amount: number, now: number) { if (now - this.lastOwn < 6) this.gain(amount, now); else this.trickle(amount * .1, now); }
  /** Hurt: knocked back down the grade - a rank and a half for a real blow,
   *  a fraction of that for a grunt's chip, and once a second at most: a
   *  crowd's swings landing in one breath are one mistake, not ten. `chip`:
   *  a grunt's swing - at S they land every second whatever the fighter does,
   *  and weighed as blows they held the grade at D through the whole climax:
   *  under 6% of `maxHp` one costs nothing; a brute's slam still does. */
  hurt(damage: number, now = 0, chip = false, maxHp = 1000) {
    if (chip && damage < maxHp * .06) return;
    if (now - this.lastHurt < 1) return;
    this.lastHurt = now;
    const i = this.rank;
    const weight = chip ? Math.min(.25, damage / 240 + .04) : Math.min(1, damage / 80 + .15);
    const drop = Math.max(24, (RANKS[Math.min(RANKS.length - 1, i + 1)].at - RANKS[Math.max(0, i - 1)].at) * .75) * weight;
    this.points = Math.max(0, this.points - drop);
  }
  /** Drain: nothing for a moment after a gain, then faster the higher it is -
   *  never under what a running KO chain holds up. */
  update(dt: number, now: number) {
    if (now - this.lastGain >= 1.1) this.points = Math.max(0, this.points - dt * (9 + this.points * .055));
    this.hold(now);
  }
  private hold(now: number) {
    if (now - this.chainAt > CHAIN_GAP) return;
    const floor = CHAIN_FLOOR.find(([n]) => this.chain >= n)?.[1] ?? 0;
    if (this.points < floor) { this.points = floor; this.best = Math.max(this.best, this.rank); }
  }
}
