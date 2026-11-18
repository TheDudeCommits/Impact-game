/** Adaptive difficulty: every bot set against a player plays a little better than they do, in a body exactly like
 *  theirs - its health, stamina and every blow, both ways, are a player's. A bot's STRENGTH (what it trades: a bot of
 *  strength 1.5 deals one and a half times the damage it takes from a bot of strength 1, the plain bot at skill one
 *  half) is carried by its play alone, its LEVEL: EASE below level 1, SKILL above (levelParts); PLAY is the strength
 *  measured at each level. A player's SKILL is in the same units, read off their exchange with the bots
 *  (SkillEvidence), and every bot set against them stands AHEAD of them in its play. The page keeps its player's skill
 *  (boot/skill.ts) and hands it to every room it joins; the room hands it back in the player's snapshot
 *  (PlayerState.skill). Data and arithmetic only. */

/** The top of a bot's level: no ease, skill 1. */
export const LEVEL_TOP = 2;
/** A level's two dials: its ease (1 at level 0, falling to none at level 1) and its skill (0 up to level 1, rising to 1
 *  at LEVEL_TOP). */
export function levelParts(level: number) {
  const l = Math.max(0, Math.min(LEVEL_TOP, Number.isFinite(level) ? level : 1));
  return { ease: Math.max(0, 1 - l), skill: Math.max(0, l - 1) };
}
/** What a bot's play is worth at levels 0, 0.25, 0.5 ... LEVEL_TOP, in STRENGTH units: its exchange with the level-1.5
 *  bot (strength 1 by definition), bodies equal, lock combat on (768 seat-swapped mirror duels a level over the
 *  released roster, from two seeds; the two agreed within 2.5%). Rising all the way: a level up is never a weaker bot.
 *  The ease carries most of it (a level-0 bot wins none of its duels against the plain bot, a level-0.75 bot three in
 *  ten); the skill, bot against bot, about 5% (a bot seldom whiffs or jumps in, which the better bot punishes and
 *  meets). */
export const PLAY = [0.324, 0.46, 0.634, 0.874, 0.977, 0.982, 1, 1.006, 1.023] as const;
const STEP = LEVEL_TOP / (PLAY.length - 1);
/** The strength of a bot's play at a level (PLAY, between its measures in ratio). */
export function playAt(level: number) {
  const l = Math.max(0, Math.min(LEVEL_TOP, Number.isFinite(level) ? level : 1)), i = Math.min(PLAY.length - 2, Math.floor(l / STEP));
  const t = (l - i * STEP) / STEP;
  return Math.exp(Math.log(PLAY[i]) + (Math.log(PLAY[i + 1]) - Math.log(PLAY[i])) * t);
}
/** The level whose play is worth `strength`: below the weakest level, the weakest; above the best, the best. */
export function levelFor(strength: number) {
  if (!(strength > PLAY[0])) return 0;
  if (strength >= PLAY[PLAY.length - 1]) return LEVEL_TOP;
  let i = 0;
  while (i < PLAY.length - 2 && strength > PLAY[i + 1]) i++;
  return (i + (Math.log(strength) - Math.log(PLAY[i])) / (Math.log(PLAY[i + 1]) - Math.log(PLAY[i]))) * STEP;
}
/** How far ahead of a player the bots stand, in their play: 5%. */
export const AHEAD = 1.05;
/** A new player's skill: a little under a strength-1 player, so their first bot is the plain bot with a touch of ease
 *  (level 0.93) - at 1 it would be the best there is, the levels above the plain bot being worth so little bot against
 *  bot. The match finds them out from there (PRIOR): a fight lost 0-1500 takes them to about .25 and their bot to
 *  level 0, one won 1500-0 to the best level. A page keeps the skill it learnt (boot/skill.ts). */
export const START_SKILL = .9;
/** The strength a new player's bots stand at. */
export const BASE_STRENGTH = START_SKILL * AHEAD;
/** The skill the game believes, at most and at least (a page's word is clamped to it). */
export const SKILL_RANGE = [.25, 8] as const;
/** How much damage of the skill a player came in with stands behind it, on each side: about two fifths of a Duel's
 *  health bar, so a match's first exchange moves it a little and a whole fight moves it most of the way. */
export const PRIOR = 600;
/** How often a match looks again at its players and sets its bots, in seconds of play. */
export const RETUNE_SECONDS = 2;
import type { Difficulty } from './social/custom';
export type { Difficulty };
/** A custom room's or a party's difficulty, as a step from the adaptive aim: Normal is the aim itself. */
export const DIFFICULTY_STEP: Readonly<Record<Difficulty, number>> = { easy: .8, normal: 1, hard: 1.3 };

const clamp = (value: number, [low, high]: readonly [number, number]) => Math.min(high, Math.max(low, value));
/** A page's word for its skill, or the start. */
export const skillFrom = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? clamp(value, SKILL_RANGE) : START_SKILL;
/** What one side of an exchange is brought back by to strength-1 terms: the square root of the strength of the play it
 *  met, on each side, so the whole exchange is brought back by that strength. */
export const half = (strength: number) => Math.sqrt(Math.max(.01, strength));
/** The strength a bot is set to against a player of `skill`. */
export const strengthFor = (skill: number, step = 1) => clamp(skill * AHEAD * step, [SKILL_RANGE[0] * AHEAD * .8, SKILL_RANGE[1] * AHEAD * 1.3]);
/** Geometric mean: skills multiply, so a room of two players is the middle of them in ratio. */
export const meanSkill = (skills: readonly number[]) => skills.length ? Math.exp(skills.reduce((sum, s) => sum + Math.log(s), 0) / skills.length) : START_SKILL;

/** One human's evidence in one match. */
export class SkillEvidence {
  /** The damage they dealt to bots, as a strength-1 bot would have taken it. */
  dealt = 0;
  /** The damage bots dealt them, as a strength-1 bot would have dealt it. */
  taken = 0;
  /** The same, as it landed (for the measuring script). */
  rawDealt = 0;
  rawTaken = 0;
  constructor(readonly start: number) {}
  /** A blow between this human and a bot whose play is worth `play`: `applied` is what it took off. */
  record(applied: number, play: number, humanDealt: boolean) {
    if (!(applied > 0)) return;
    if (humanDealt) { this.dealt += applied * half(play); this.rawDealt += applied; }
    else { this.taken += applied / half(play); this.rawTaken += applied; }
  }
  /** Their skill now: their exchange with strength-1 bots, held towards the start by PRIOR of it. */
  get skill() { return clamp((this.dealt + PRIOR * this.start) / (this.taken + PRIOR), SKILL_RANGE); }
  /** How much they have exchanged with bots this match (normalized). */
  get exchanged() { return this.dealt + this.taken; }
}

/** What a match needs of its simulation: who is in it, who fights whom, and where each bot's strength goes. */
export interface AdaptiveField {
  humans(): readonly string[];
  bots(): readonly string[];
  hostile(a: string, b: string): boolean;
}

/** One match's adaptive difficulty. Off in Training; with no human in the field (a bots-only royale, the golden
 *  replays) no bot is set and every bot plays as it was drawn. */
export class AdaptiveDirector {
  private readonly evidence = new Map<string, SkillEvidence>();
  private readonly strengths = new Map<string, number>();
  /** Bots the director never sets: held at a strength (fix) or at the play they were given (pin). */
  private readonly fixed = new Set<string>();
  private step = 1;
  private nextLook = 0;
  constructor(readonly enabled = true) {}
  /** Where a strength set on a bot goes (undefined: it is let go, back to its own play): the simulation turns it into
   *  the bot's level (simulation.ts setLevel). */
  apply: (id: string, strength: number | undefined) => void = () => {};
  /** What a bot's play is worth now (playAt its level; the simulation says, 1 for anyone else). */
  playOf: (id: string) => number = () => 1;
  /** A custom room's or a party's difficulty. */
  setDifficulty(difficulty: Difficulty | undefined) { this.step = DIFFICULTY_STEP[difficulty ?? 'normal'] ?? 1; }
  /** How many times the field has been looked at (the simulation writes the humans' skills after each). */
  looked = 0;
  /** A human's skill as their page knows it (unknown: the start). Joining again keeps the evidence of this match; a
   *  human seen before their page said (looked at first) takes the page's word while nothing has been exchanged. */
  join(id: string, skill: unknown) {
    const had = this.evidence.get(id);
    if (!had || had.exchanged === 0) this.evidence.set(id, new SkillEvidence(skillFrom(skill)));
  }
  leave(id: string) { this.evidence.delete(id); this.strengths.delete(id); this.fixed.delete(id); }
  /** A bot held at one strength whatever the field (the measuring script, the tests). */
  fix(id: string, strength: number) { const s = Math.max(.05, strength); this.strengths.set(id, s); this.fixed.add(id); this.apply(id, s); }
  /** A bot left at the play it was given whatever the field (simulation.ts setBotSkill, setBotLevel). */
  pin(id: string) { this.strengths.delete(id); this.fixed.add(id); }
  /** A bot that plays the part of a human (the measuring script's player of known skill): its blows are
   *  evidence as a human's are, and the bots are set against it. Never set by the game. */
  readonly standIns = new Set<string>();
  /** A human's skill now, or undefined for anyone else. */
  skillOf(id: string) { return this.evidence.get(id)?.skill; }
  evidenceOf(id: string): Readonly<SkillEvidence> | undefined { return this.evidence.get(id); }
  /** The strength a bot is set to, or undefined where it plays as it was drawn. */
  strengthOf(id: string | undefined) { return id === undefined ? undefined : this.strengths.get(id); }
  private set(bot: string, strength: number | undefined) {
    if (strength === undefined) { if (this.strengths.delete(bot)) this.apply(bot, undefined); return; }
    if (this.strengths.get(bot) === strength) return;
    this.strengths.set(bot, strength); this.apply(bot, strength);
  }
  /** A blow landed: the evidence of the human in it, if it was between a human and a bot. */
  tally(attacker: string | undefined, target: string, applied: number) {
    if (!this.enabled || attacker === undefined || attacker === target) return;
    const dealer = this.evidence.get(attacker), victim = this.evidence.get(target);
    if (dealer && !victim && this.isBot(target)) dealer.record(applied, this.playOf(target), true);
    else if (victim && !dealer && this.isBot(attacker)) victim.record(applied, this.playOf(attacker), false);
  }
  private botIds = new Set<string>();
  private isBot(id: string) { return this.botIds.has(id); }
  /** A bot that has picked a human to fight stands ahead of that human. */
  engage(bot: string, human: string) {
    if (!this.enabled || this.fixed.has(bot)) return;
    const skill = this.evidence.get(human)?.skill;
    if (skill !== undefined) this.set(bot, strengthFor(skill, this.step));
  }
  /** Whether it is time to look again (the simulation asks before it gathers the field, every step). */
  due(now: number) { return this.enabled && now >= this.nextLook; }
  /** Every RETUNE_SECONDS: each bot against a human stands ahead of the humans it is set against (in ratio, their
   *  middle). A bot on the humans' side (a Bad Blood or Rift War teammate, Last Stand's defenders) is let go: the
   *  difficulty is the opponents'. */
  look(now: number, field: AdaptiveField, force = false) {
    if (!this.enabled || (!force && now < this.nextLook)) return;
    this.nextLook = now + RETUNE_SECONDS; this.looked++;
    // A human no page has spoken for (a test, a seat taken before its options were read) starts where a new player does.
    const humans = field.humans();
    for (const id of humans) if (!this.evidence.has(id)) this.evidence.set(id, new SkillEvidence(START_SKILL));
    for (const id of [...this.evidence.keys()]) if (!humans.includes(id)) this.evidence.delete(id);
    this.botIds = new Set(field.bots());
    for (const bot of this.botIds) {
      if (this.fixed.has(bot)) continue;
      const against = humans.filter(h => field.hostile(bot, h));
      this.set(bot, against.length ? strengthFor(meanSkill(against.map(h => this.evidence.get(h)!.skill)), this.step) : undefined);
    }
  }
}
