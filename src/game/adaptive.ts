
/** A bot facing a player the game knows nothing of yet: half again today's bot. */
export const BASE_STRENGTH = 1.5;
export const AHEAD = 1.15;
export const AHEAD_BAND = [1.1, 1.2] as const;
/** A new player's skill: what puts the bots at BASE_STRENGTH. */
export const START_SKILL = BASE_STRENGTH / AHEAD;
/** The skill the game believes, at most and at least (a page's word is clamped to it). */
export const SKILL_RANGE = [.25, 8] as const;
/** How much damage of the skill a player came in with stands behind it, on each side: about a third of a Duel's health
 *  bar, so a match's first exchange moves it a little and a whole fight moves it most of the way. */
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
/** What a bot's blows are multiplied by, and what blows on it are divided by. */
export const power = (strength: number) => Math.sqrt(Math.max(.01, strength));
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
  /** A blow between this human and a bot of `strength`: `applied` is what it took off, after the bot's power. */
  record(applied: number, strength: number, humanDealt: boolean) {
    if (!(applied > 0)) return;
    if (humanDealt) { this.dealt += applied * power(strength); this.rawDealt += applied; }
    else { this.taken += applied / power(strength); this.rawTaken += applied; }
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
 *  replays) every bot stays at strength 1 and nothing differs from before. */
export class AdaptiveDirector {
  private readonly evidence = new Map<string, SkillEvidence>();
  private readonly strengths = new Map<string, number>();
  private readonly fixed = new Set<string>();
  private step = 1;
  private nextLook = 0;
  constructor(readonly enabled = true) {}
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
  fix(id: string, strength: number) { this.strengths.set(id, Math.max(.05, strength)); this.fixed.add(id); }
  /** A bot that plays the part of a human (scripts/engine/bot_strength.mts's player of known skill): its blows are
   *  evidence as a human's are, and the bots are set against it. Never set by the game. */
  readonly standIns = new Set<string>();
  /** A human's skill now, or undefined for anyone else. */
  skillOf(id: string) { return this.evidence.get(id)?.skill; }
  evidenceOf(id: string): Readonly<SkillEvidence> | undefined { return this.evidence.get(id); }
  /** A bot's strength now (1: today's bot). */
  strengthOf(id: string | undefined) { return id === undefined ? 1 : this.strengths.get(id) ?? 1; }
  /** What a blow from `attacker` on `target` is multiplied by. */
  factor(attacker: string | undefined, target: string) { return power(this.strengthOf(attacker)) / power(this.strengthOf(target)); }
  /** A blow landed: the evidence of the human in it, if it was between a human and a bot. */
  tally(attacker: string | undefined, target: string, applied: number) {
    if (!this.enabled || attacker === undefined || attacker === target) return;
    const dealer = this.evidence.get(attacker), victim = this.evidence.get(target);
    if (dealer && !victim && this.isBot(target)) dealer.record(applied, this.strengthOf(target), true);
    else if (victim && !dealer && this.isBot(attacker)) victim.record(applied, this.strengthOf(attacker), false);
  }
  private botIds = new Set<string>();
  private isBot(id: string) { return this.botIds.has(id); }
  /** A bot that has picked a human to fight stands ahead of that human. */
  engage(bot: string, human: string) {
    if (!this.enabled || this.fixed.has(bot)) return;
    const skill = this.evidence.get(human)?.skill;
    if (skill !== undefined) this.strengths.set(bot, strengthFor(skill, this.step));
  }
  /** Every RETUNE_SECONDS: each bot against a human stands ahead of the humans it is set against (in ratio, their
   *  middle). A bot on the humans' side (a Bad Blood or Rift War teammate, Last Stand's defenders) stays today's bot: the
   *  difficulty is the opponents'. */
  /** Whether it is time to look again (the simulation asks before it gathers the field, every step). */
  due(now: number) { return this.enabled && now >= this.nextLook; }
  look(now: number, field: AdaptiveField, force = false) {
    if (!this.enabled || (!force && now < this.nextLook)) return;
    this.nextLook = now + RETUNE_SECONDS; this.looked++;
    // A human no page has spoken for (a test, a seat taken before its options were read) starts where a new player does.
    const humans = field.humans();
    for (const id of humans) if (!this.evidence.has(id)) this.evidence.set(id, new SkillEvidence(START_SKILL));
    for (const id of [...this.evidence.keys()]) if (!humans.includes(id)) this.evidence.delete(id);
    this.botIds = new Set(field.bots());
    if (!humans.length) { for (const bot of this.botIds) if (!this.fixed.has(bot)) this.strengths.delete(bot); return; }
    for (const bot of this.botIds) {
      if (this.fixed.has(bot)) continue;
      const against = humans.filter(h => field.hostile(bot, h));
      if (against.length) this.strengths.set(bot, strengthFor(meanSkill(against.map(h => this.evidence.get(h)!.skill)), this.step));
      else this.strengths.delete(bot);
    }
  }
}
