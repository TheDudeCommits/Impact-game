import type { MoveDefinition } from '../game/moves';
import type { AttackSlot, PlayerState, Vec3 } from '../game/types';
import type { FeedItem } from './SurvivalGame';

export type SigElement = 'steel' | 'fire' | 'magma' | 'light' | 'ice' | 'lightning' | 'dark' | 'ki' | 'sound' | 'blood' | 'void-ray' | 'jade';

/** A boss's second form: what it is called, the colours its aura burns in
 *  (core, rim), and how the body changes - a tint over its own colours and a
 *  size. */
export interface BossAwakening { name: string; aura: readonly [number, number]; tint?: number; scale?: number }

export const AWAKENINGS: Record<string, BossAwakening> = {
  takane: { name: 'THE VEIL LIFTED', aura: [0xf4f0ff, 0x9a1428], scale: 1.1 },
  harrow: { name: 'GRAVEHOUND UNCHAINED', aura: [0xf0efe6, 0x5a6a80], scale: 1.1 },
  kanuki: { name: 'THE KEYS TURN', aura: [0xffd8a0, 0xd0601a], scale: 1.06 },
  gantry: { name: 'THE PRAYER WHEEL TURNS', aura: [0xffe0a0, 0xb07a20], scale: 1.08 },
  zarek: { name: 'MOLTEN HEART', aura: [0xffc890, 0xff4a0a], scale: 1.08 },
  'nightfall': { name: 'NIGHTFALL ETERNAL', aura: [0xff5a6a, 0x200008], tint: 0xe8e4ff, scale: 1.12 },
  kade: { name: 'THE SPOOL UNWINDS', aura: [0xffe490, 0xd07a10], scale: 1.1 },
  nihil: { name: 'SIX WINGS OPEN', aura: [0xe8e0ff, 0x1a1028], tint: 0x8a8a96, scale: 1.08 },
  ashwing: { name: 'THE PYRE ALIGHT', aura: [0xffc070, 0xff3a0a], scale: 1.06 },
  'dune-oni': { name: 'THE ONI UNBOUND', aura: [0xfff490, 0xd0a010], scale: 1.06 },
  kuromitsu: { name: 'THE TAR RISES', aura: [0xffd890, 0x1a1008], tint: 0xd8d2c8, scale: 1.08 },
  rime: { name: 'THE GLACIER WAKES', aura: [0xf0fcff, 0x3aa8ff], tint: 0xdcefff, scale: 1.06 },
  lumen: { name: 'EVERY MIRROR LIT', aura: [0xfffce8, 0xffd21e], tint: 0xfff4c8, scale: 1.05 },
  caldera: { name: 'THE CALDERA OPENS', aura: [0xffd090, 0xff3a0a], tint: 0xffc8b0, scale: 1.08 },
  mirabel: { name: 'THE STORM BREAKS', aura: [0xe0f0ff, 0x3a6aff], scale: 1.06 },
  'wuming': { name: 'JADE PYRE', aura: [0xffc0ec, 0xd03aa0], scale: 1.06 },
  // Jinlin's newest form over his golden one: black, not gold.
  'jinlin': { name: 'ABYSSAL TIDE', aura: [0xe8dcff, 0x2a1040], tint: 0x5a5068, scale: 1.04 },
  shiun: { name: 'PALE SERAPH', aura: [0xf4ecff, 0x7a3cff], tint: 0xf0ecff, scale: 1.12 },
  kurobi: { name: 'BLACK FLAME RAGE', aura: [0xffd890, 0xff5a0a], scale: 1.05 },
  barrow: { name: 'THE HOLD BURSTS', aura: [0xe0d0ff, 0x2a0a3a], scale: 1.06 },
  akagane: { name: 'WRATHFUL KING', aura: [0xffffff, 0x5a3cc0], tint: 0xeceaf4, scale: 1.08 },
  oro: { name: 'MIDNIGHT: OVER THE TOWER', aura: [0xfff6d0, 0xf2c94c], tint: 0xfff2d8, scale: 1.08 },
  magatsu: { name: 'CALAMITY RISEN', aura: [0xffe0e4, 0xd81f3a], tint: 0xffe8ea, scale: 1.1 },
  vesper: { name: 'BLACK VESPERS', aura: [0xe8e0ff, 0x4a2a8a], tint: 0xb8b0d0, scale: 1.12 },
  imago: { name: 'SWARM ASCENDANT', aura: [0xe8ffe8, 0x3ae88a], tint: 0xf0fff0, scale: 1.08 },
  banjaku: { name: 'WRATHFUL GUARDIAN', aura: [0xffc8c8, 0xe0142e], scale: 1.1 },
  haldor: { name: 'GROUNDSWELL', aura: [0xfffcf0, 0xe8dcb0], scale: 1.05 },
  'gorai-wyrm': { name: 'STORM WYRM · FULL FURY', aura: [0xb8d0ff, 0x3a6aff], scale: 1.04 },
};
/** Every boss awakens: one the table has no form for burns in its own colour. */
export function awakeningOf(id: string, color: number): BossAwakening {
  return AWAKENINGS[id] ?? { name: 'AWAKENED', aura: [0xffffff, color], scale: 1.06 };
}
/** Bosses whose second form is already a body of their own (enemies.ts
 *  `transform`): they rise again as it instead of awakening. */
export const FORMS_OF_THEIR_OWN: ReadonlySet<string> = new Set(['gorai']);

interface Base {
  /** Called out across the screen when it comes. */
  name: string;
  element: SigElement;
  /** Seconds between casts (awakened, about seventy per cent of it). */
  every: number;
  /** Seconds into the fight before the first. */
  first?: number;
  /** Only once it has awakened. */
  awakened?: boolean;
  /** The next signature in the list comes this many seconds after this one,
   *  whatever the gap between set pieces: a combination (LORD ORO's MIDNIGHT, then SLUMBER). */
  then?: number;
}
export type Signature = Base & (
  /** Ground that burns, freezes or eats: `count` pools, the first under the
   *  target (where they are going), ringed `lead` seconds ahead, lasting `life`. */
  | { kind: 'pool'; count: number; radius: number; lead: number; life: number; dps: number; spread: number }
  /** Lines torn along the ground: from the boss all round (radial), at the
   *  target one after another (aimed), side by side like claws (claws), a
   *  breath sweeping across (sweep), or crossing on the target (star). */
  | { kind: 'fissure'; pattern: 'radial' | 'aimed' | 'claws' | 'sweep' | 'star'; count: number; length: number; width: number; lead: number; damage: number; gap?: number }
  /** A ring rolling out along the floor from the boss: jump it, or dash
   *  through it. `freeze` holds what it catches that long. */
  | { kind: 'wave'; speed: number; reach: number; width: number; damage: number; lead: number; freeze?: number; count?: number; gap?: number }
  /** It stands and gathers something enormous for `seconds`: take
   *  `breakShare` of its health off it by then and it breaks; otherwise it
   *  lands on where the target stood (or round the boss). */
  | { kind: 'charge'; seconds: number; breakShare: number; radius: number; damage: number; at: 'self' | 'target' }
  /** Out of the sky, huge, long warned. */
  | { kind: 'meteor'; count: number; radius: number; lead: number; damage: number; spread: number; look?: 'meteor' | 'lance' }
  /** Gone, and there - `count` times, each spot flashing `lead` ahead. */
  | { kind: 'blinks'; count: number; gap: number; lead: number; radius: number; damage: number; pool?: number }
  /** Its own come through: grunt kinds by id (horde/kinds.ts). */
  | { kind: 'summon'; grunts: readonly string[]; count: number; hasted?: boolean }
  /** Copies of itself, one of them real. */
  | { kind: 'clones'; count: number; life: number }
  /** FUTURE SIGHT: a string of `hits` inside `window` seconds is seen coming,
   *  and answered from behind. IRON: a body blows glance off for `seconds`,
   *  then a shockwave. */
  | { kind: 'counter'; style: 'future' | 'iron'; hits: number; window: number; seconds?: number; damage: number }
  /** Mirabel's homies: Zeus's lightning and Prometheus's fire, by turns. */
  | { kind: 'orbiters'; damage: number; radius: number }
  /** Pressure: the air round it hurts, and the fight feeds it (`stack`: its
   *  blows grow this much every ten seconds, four times at most). */
  | { kind: 'aura'; radius: number; dps: number; stack: number }
  /** A black hole: everything within `radius` dragged in for `seconds`, then let go of, hard. */
  | { kind: 'pull'; radius: number; seconds: number; damage: number; release?: string }
);

export const SIGNATURES: Record<string, readonly Signature[]> = {
  takane: [{ kind: 'fissure', name: 'TRAIN OF KNIVES', element: 'steel', pattern: 'claws', count: 3, length: 13, width: .9, lead: 1, damage: 40, every: 10 }],
  harrow: [{ kind: 'wave', name: 'THE FUNERAL HOWL', element: 'sound', speed: 10, reach: 10, width: 1.2, damage: 40, lead: .9, every: 11 }],
  kanuki: [{ kind: 'blinks', name: "THE TURNKEY'S ROUNDS", element: 'dark', count: 2, gap: .95, lead: .75, radius: 1.9, damage: 52, every: 10 }],
  gantry: [
    { kind: 'wave', name: 'MILLSTONE PALM', element: 'sound', speed: 11, reach: 12, width: 1.2, damage: 56, lead: .9, every: 12 },
    { kind: 'summon', name: 'THE IRON CHOIR', element: 'light', grunts: ['automaton'], count: 2, every: 22, first: 14 },
  ],
  zarek: [{ kind: 'fissure', name: 'MOLTEN RAKE', element: 'fire', pattern: 'claws', count: 5, length: 15, width: .75, lead: .95, damage: 44, every: 9 }],
  'nightfall': [{ kind: 'fissure', name: 'CINDER WAVES', element: 'blood', pattern: 'aimed', count: 3, gap: .5, length: 17, width: 1.2, lead: .8, damage: 56, every: 9 }],
  kade: [{ kind: 'counter', name: 'SILK COCOON', element: 'sound', style: 'iron', hits: 0, window: 0, seconds: 2.4, damage: 44, every: 13, first: 8 }],
  nihil: [{ kind: 'meteor', name: 'THE BROKEN HALO', element: 'dark', count: 4, radius: 2.3, lead: 1.8, damage: 60, spread: 5, look: 'lance', every: 11 }],
  ashwing: [{ kind: 'blinks', name: 'THE FALLING PYRE', element: 'fire', count: 1, gap: 0, lead: 1.25, radius: 3.1, damage: 82, pool: 2.6, every: 12 }],
  // (Unleashed with his awakening - the eyepatch off - not from the first swing.)
  'dune-oni': [{ kind: 'aura', name: 'ONI PRESSURE', element: 'light', radius: 2.6, dps: 9, stack: .06, every: 10, first: 0, awakened: true }],
  kuromitsu: [{ kind: 'counter', name: 'THE TWELVE EYES SEE', element: 'steel', style: 'future', hits: 5, window: 1.6, damage: 0, every: 7, first: 5 }],
  rime: [{ kind: 'wave', name: 'THE LONG WINTER', element: 'ice', speed: 7, reach: 14, width: 1.4, damage: 46, lead: 1.1, freeze: 1.3, every: 11 }],
  lumen: [{ kind: 'blinks', name: "THE WIDOW'S MIRRORS", element: 'light', count: 3, gap: .55, lead: .62, radius: 2, damage: 54, every: 9 }],
  caldera: [{ kind: 'pool', name: 'THE WEEPING GROUND', element: 'magma', count: 3, radius: 2.5, lead: 1.1, life: 11, dps: 44, spread: 5.5, every: 8 }],
  mirabel: [{ kind: 'orbiters', name: 'SQUALL AND CINDER', element: 'lightning', damage: 50, radius: 1.8, every: 4.6, first: 4 }],
  'wuming': [{ kind: 'fissure', name: 'LOTUS EDGES', element: 'dark', pattern: 'star', count: 4, length: 14, width: .85, lead: 1.05, damage: 56, every: 9 }],
  'jinlin': [{ kind: 'charge', name: 'DROWNED SUN', element: 'fire', seconds: 4, breakShare: .06, radius: 9, damage: 170, at: 'target', every: 22, first: 12 }],
  shiun: [{ kind: 'clones', name: 'UNDERSTUDIES', element: 'dark', count: 3, life: 14, every: 22, first: 10 }],
  kurobi: [{ kind: 'charge', name: 'BLACK FLAME ORB', element: 'dark', seconds: 3.4, breakShare: .05, radius: 10, damage: 190, at: 'target', every: 20, first: 10 }],
  barrow: [{ kind: 'pull', name: 'TAR TIDE', element: 'dark', radius: 13, seconds: 2.4, damage: 92, every: 14, first: 7 }],
  oro: [
    { kind: 'wave', name: 'MIDNIGHT', element: 'light', speed: 26, reach: 34, width: 1.6, damage: 14, lead: 1, freeze: 1.4, every: 15, first: 7, then: 1.3 },
    { kind: 'blinks', name: 'THE GILDED HOUR', element: 'light', count: 3, gap: .5, lead: .7, radius: 2, damage: 50, every: 999, first: 999 },
    { kind: 'meteor', name: 'HOUR OF RUIN!', element: 'steel', count: 1, radius: 5.5, lead: 3, damage: 170, spread: 0, look: 'meteor', every: 20, first: 4, awakened: true },
  ],
  // Magatsu: Flaying Cut's slashes, and awakened his ground - every direction cut at
  // once - and Calamity Pyre's arrow (break it, or run).
  magatsu: [
    { kind: 'fissure', name: 'REND: THOUSAND CUTS', element: 'blood', pattern: 'claws', count: 4, length: 16, width: .7, lead: .8, damage: 50, every: 11 },
    { kind: 'fissure', name: 'CARRION FIELD', element: 'blood', pattern: 'radial', count: 10, length: 18, width: .8, lead: 1.2, damage: 72, every: 15, awakened: true },
    { kind: 'charge', name: 'CALAMITY PYRE', element: 'fire', seconds: 3.2, breakShare: .06, radius: 7, damage: 230, at: 'target', every: 24, first: 9, awakened: true },
  ],
  // Vesper: the Pale Raven strikes from where you are not; awakened as Black Vespers,
  // the Apostles come, and space itself pulls you in.
  vesper: [
    { kind: 'blinks', name: 'THE PALE RAVEN', element: 'light', count: 3, gap: .45, lead: .65, radius: 1.8, damage: 54, every: 10 },
    { kind: 'summon', name: 'THE WINGED HOST', element: 'dark', grunts: ['rift-spawn'], count: 2, every: 20, first: 6, awakened: true },
    { kind: 'pull', name: 'EVENSONG', element: 'dark', radius: 13, seconds: 2.4, damage: 96, every: 17, first: 12, awakened: true, release: 'THE BLACK WINGS FALL' },
  ],
  // Imago: his tail, and speed; awakened, the King learns - a string of blows is
  // seen coming and answered from behind.
  imago: [
    { kind: 'fissure', name: 'STINGER LASH', element: 'jade', pattern: 'aimed', count: 3, gap: .4, length: 12, width: 1, lead: .7, damage: 56, every: 9 },
    { kind: 'blinks', name: "THE SOVEREIGN'S SPEED", element: 'jade', count: 2, gap: .5, lead: .6, radius: 2, damage: 60, every: 12, first: 6 },
    { kind: 'counter', name: 'THE SOVEREIGN LEARNS', element: 'jade', style: 'future', hits: 4, window: 2.2, damage: 0, every: 8, first: 4, awakened: true },
  ],
  akagane: [{ kind: 'meteor', name: "COPPER STAR", element: 'fire', count: 1, radius: 7, lead: 3.2, damage: 190, spread: 0, look: 'meteor', every: 18, first: 8 }],
  banjaku: [{ kind: 'wave', name: 'MOUNTAIN-FELLING FIST', element: 'blood', speed: 16, reach: 16, width: 1.1, damage: 76, lead: .8, every: 10 }],
  haldor: [
    { kind: 'fissure', name: 'FAULTLINE', element: 'sound', pattern: 'radial', count: 6, length: 16, width: 1.1, lead: 1.1, damage: 70, every: 10 },
    { kind: 'wave', name: 'WORLD TILT', element: 'sound', speed: 12, reach: 15, width: 1.3, damage: 64, lead: 1, every: 14, awakened: true },
  ],
  gorai: [{ kind: 'fissure', name: 'AZURE BREATH', element: 'fire', pattern: 'sweep', count: 7, gap: .18, length: 18, width: 1.3, lead: .8, damage: 60, every: 12 }],
  'gorai-wyrm': [
    { kind: 'fissure', name: 'AZURE BREATH', element: 'fire', pattern: 'sweep', count: 9, gap: .16, length: 20, width: 1.4, lead: .8, damage: 66, every: 11 },
    { kind: 'pool', name: 'BURNING SKIES', element: 'fire', count: 3, radius: 2.4, lead: 1.1, life: 8, dps: 40, spread: 6, every: 13, awakened: true },
  ],
};

/** The moves the table's strikes are thrown as: blows from nowhere, with no
 *  impact freeze of their own (see SurvivalGame.procMove). */
export const sigMove = (name: string, damage: number, extra: Partial<MoveDefinition> = {}): MoveDefinition => ({
  name, duration: .1, contacts: [0], damage, range: 1, radius: 1, stamina: 0, cooldown: 0, stun: .35, knockback: 6, style: 'bomb', hitstop: 0, ...extra });

export interface SigHero { id: string; state: PlayerState; velocity: { x: number; z: number } }
export interface SigBoss { id: string; enemy: string; name: string; state: PlayerState; awakened: boolean; since: number; target?: string; size: number; height: number;
  /** Its rank: a signature lands softer on the early road (SIG_RANK). */
  rank?: string }
/** What a signature's blows are worth by the rank of the boss throwing it, on
 *  top of the boss's own weight: the early road's set pieces are lessons, the
 *  late road's are the fight. */
const SIG_RANK: Record<string, number> = { F: .7, E: .78, D: .86, C: .94, B: 1, A: 1.05, S: 1.1 };

/** What the run lends the signatures to act with. */
export interface SignatureHost {
  now(): number;
  random(): number;
  body(id: string): PlayerState | undefined;
  /** The fighters standing. */
  heroes(): readonly SigHero[];
  bounds(): { halfX: number; halfZ: number };
  push(item: Omit<FeedItem, 'id' | 'at'>): void;
  /** A blow on a fighter (guard, dodge and reactions apply), thrown by `source`. */
  strike(source: string, hero: string, move: MoveDefinition, from: Vec3): void;
  /** Health off a fighter with no blow behind it (ground that burns). */
  burn(source: string, hero: string, amount: number, name: string): void;
  /** A strike from the sky, warned on the floor (strikes and 'hazard'). */
  hazard(source: string, enemy: string, at: Vec3, lands: number, radius: number, move: MoveDefinition, element: string, look?: string): void;
  /** The horde under something falling. */
  crowd(x: number, z: number, radius: number, damage: number): void;
  /** Grunts of `kinds` out of a rift beside `around`. */
  summon(kinds: readonly string[], count: number, around: Vec3, hasted: boolean): number;
  /** The boss gone from where it was and at `at`, facing `face`. */
  place(id: string, at: Vec3, face: Vec3): boolean;
  clear(at: Vec3): Vec3 | undefined;
  /** Its brain held still (a cast), and the body in its roar if `taunt`. */
  hold(id: string, seconds: number): void;
  /** Its brain made to swing at once, from `slot`. */
  force(id: string, slot: AttackSlot): void;
  /** An illusion of the boss at `at`, gone after `life` seconds. */
  clone(id: string, at: Vec3, life: number): string | undefined;
  /** Its damage taken, multiplied (and put back by the inverse). */
  armour(id: string, factor: number): void;
  /** Its blows, multiplied. */
  empower(id: string, factor: number): void;
  damageOut(id: string): number;
  /** How many fighters there are. */
  party(): number;
  /** The run's own freeze for a stun: the boss held broken. */
  broken(id: string, seconds: number): void;
  /** Who broke it (their run's tally and style). */
  broke?(hero: string): void;
}

interface Pool { x: number; z: number; r: number; from: number; until: number; next: number; dps: number; source: string; name: string }
interface Wave { x: number; z: number; start: number; speed: number; reach: number; width: number; damage: number; freeze: number; source: string; name: string; hit: Set<string> }
interface Line { a: Vec3; b: Vec3; width: number; lands: number; damage: number; source: string; name: string }
interface Charge { until: number; taken: number; need: number; radius: number; damage: number; at: Vec3; name: string; element: SigElement }
interface Plan {
  next: number[]; last: number; busyUntil: number;
  charge?: Charge;
  /** Blows landed on it lately, by whom (FUTURE SIGHT). */
  hits: { at: number; hero: string }[];
  ironUntil: number; stacks: number; nextStack: number; tick: number; orbitTurn: number;
  pull?: { until: number; next: number; radius: number; damage: number; name: string; release: string };
  aura?: { radius: number; dps: number; name: string };
  /** A combination's next signature (its index), and when it is due. */
  chain?: number; chainAt?: number;
}

/** How much more often, and more, an awakened boss's signature comes. */
const AWAKENED_PACE = .72;
/** Nothing new from a boss inside this many seconds of the last: two set
 *  pieces on top of each other are noise, not a fight. */
const CAST_GAP = 3.2;

export class Signatures {
  /** Seconds between set pieces, multiplied (a deep Rift's RELENTLESS, depth.ts). */
  pace = 1;
  private plans = new Map<string, Plan>();
  private pools: Pool[] = [];
  private waves: Wave[] = [];
  private lines: Line[] = [];
  /** What a cast does a moment later, by the boss that cast it. */
  private later: { at: number; run: () => void; boss: string }[] = [];

  constructor(private readonly host: SignatureHost) {}

  /** A boss is out: its plan starts (the first cast after its entrance). */
  begin(boss: SigBoss) {
    const sigs = SIGNATURES[boss.enemy];
    if (!sigs) return;
    const now = this.host.now();
    this.weights.set(boss.id, SIG_RANK[boss.rank ?? 'C'] ?? 1);
    const plan: Plan = { next: sigs.map(sig => now + (sig.first ?? 6) + this.host.random() * 3), last: -99, busyUntil: 0, hits: [], ironUntil: 0,
      stacks: 0, nextStack: now + 10, tick: now, orbitTurn: 0 };
    this.plans.set(boss.id, plan);
    for (const sig of sigs) {
      if (sig.kind === 'aura' && !sig.awakened) this.startAura(boss, plan, sig, false);
      if (sig.kind === 'orbiters') this.host.push({ kind: 'orbit', actor: boss.id, enemy: boss.enemy, text: sig.name });
    }
  }

  /** It awakened: the aura grows, the rest comes sooner. */
  awaken(boss: SigBoss) {
    const plan = this.plans.get(boss.id), sigs = SIGNATURES[boss.enemy];
    if (!plan || !sigs) return;
    const now = this.host.now();
    sigs.forEach((sig, i) => {
      if (sig.kind === 'aura') { this.startAura(boss, plan, sig, true); plan.nextStack = now + 10; }
      // What only comes awakened starts now; the rest keeps its clock, a little sooner.
      plan.next[i] = sig.awakened ? now + 3 + this.host.random() * 2 : Math.min(plan.next[i], now + 4 + this.host.random() * 3);
    });
  }

  /** It is gone (fallen, or the run moved on): nothing of it lingers. */
  end(id: string) {
    const plan = this.plans.get(id);
    if (!plan) return;
    if (plan.ironUntil > this.host.now()) this.host.armour(id, 1 / .15);
    this.plans.delete(id);
    this.later = this.later.filter(job => job.boss !== id);
  }

  clear() { this.plans.clear(); this.weights.clear(); this.pools.length = 0; this.waves.length = 0; this.lines.length = 0; this.later.length = 0; }

  /** A blow landed on a boss: its charge takes it, and FUTURE SIGHT counts it. */
  struck(id: string, hero: string, damage: number) {
    const plan = this.plans.get(id);
    if (!plan) return;
    const now = this.host.now();
    plan.hits.push({ at: now, hero });
    if (plan.hits.length > 24) plan.hits.splice(0, plan.hits.length - 24);
    const charge = plan.charge;
    if (charge && now < charge.until) {
      charge.taken += damage;
      if (charge.taken >= charge.need) {
        plan.charge = undefined; plan.busyUntil = now + 2.4;
        this.host.broken(id, 2.4);
        this.host.broke?.(hero);
        this.host.push({ kind: 'charge-end', actor: id, value: 1, text: charge.name, hero, element: charge.element });
      }
    }
  }

  /** How far a charge has been broken (0-1), for its boss's bar. */
  chargeOf(id: string) { const c = this.plans.get(id)?.charge; return c ? Math.min(1, c.taken / c.need) : undefined; }
  /** Blows glance off it (an iron body). */
  iron(id: string) { return (this.plans.get(id)?.ironUntil ?? 0) > this.host.now(); }

  /** Every tick: each boss that can act casts what is due, and what was cast lands. */
  step(bosses: readonly SigBoss[], fighting: boolean) {
    // (Nothing moves while the fight is not on: what is due waits for it.)
    if (!fighting) return;
    const now = this.host.now();
    for (let i = this.later.length - 1; i >= 0; i--) {
      if (now < this.later[i].at) continue;
      const job = this.later[i]; this.later.splice(i, 1);
      job.run();
    }
    for (const boss of bosses) {
      const plan = this.plans.get(boss.id);
      if (!plan || !boss.state.alive) continue;
      this.ongoing(boss, plan, now);
      const sigs = SIGNATURES[boss.enemy]!;
      const idle = boss.state.action === 'idle' || boss.state.action === 'run';
      // FUTURE SIGHT watches all the time - through the gap between set pieces too
      // (after it, a boss with others to cast barely ever watched) - and answers
      // a string of blows while they land (staggered by them: waiting for it to
      // stand idle, it never answered once).
      const reeling = idle || boss.state.action === 'flinch' || boss.state.action === 'hurt' || boss.state.action === 'stun' || boss.state.action === 'guard';
      for (let i = 0; i < sigs.length; i++) {
        const sig = sigs[i];
        if (sig.kind !== 'counter' || sig.style !== 'future' || now < plan.next[i] || !reeling || (sig.awakened && !boss.awakened)) continue;
        const since = now - sig.window, recent = plan.hits.filter(hit => hit.at >= since);
        const hero = recent.length >= sig.hits ? recent[recent.length - 1].hero : undefined;
        if (!hero || !this.foresee(boss, sig, hero)) continue;
        plan.next[i] = now + sig.every * (boss.awakened ? AWAKENED_PACE : 1) * this.pace;
        plan.hits.length = 0;
      }
      // A combination's second half comes on its own clock, through the gap.
      const chained = plan.chain !== undefined && now >= (plan.chainAt ?? 0);
      if (plan.chain !== undefined && now - (plan.chainAt ?? 0) > 6) plan.chain = undefined;
      if (!chained && (now < plan.busyUntil || now - plan.last < CAST_GAP)) continue;
      for (let i = 0; i < sigs.length; i++) {
        const sig = sigs[i];
        if (chained ? i !== plan.chain : now < plan.next[i]) continue;
        if ((sig.awakened && !boss.awakened) || sig.kind === 'aura' || (sig.kind === 'counter' && sig.style === 'future')) continue;
        // What moves the body waits until it is free to move.
        const bodily = sig.kind === 'charge' || sig.kind === 'blinks' || sig.kind === 'pull' || sig.kind === 'clones' || sig.kind === 'counter';
        if (bodily && !idle) continue;
        plan.next[i] = now + sig.every * (boss.awakened ? AWAKENED_PACE : 1) * this.pace * (.85 + this.host.random() * .3);
        if (this.cast(boss, plan, sig)) {
          plan.last = now;
          if (chained) plan.chain = undefined;
          if (sig.then !== undefined && i + 1 < sigs.length) { plan.chain = i + 1; plan.chainAt = now + sig.then; }
          break;
        }
      }
    }
    this.land(now);
  }

  // ---- the casts ---------------------------------------------------------------------------------
  private cast(boss: SigBoss, plan: Plan, sig: Signature): boolean {
    const host = this.host, heroes = host.heroes();
    const target = heroes.find(hero => hero.id === boss.target) ?? heroes[Math.floor(host.random() * heroes.length)];
    if (!target && sig.kind !== 'summon') return false;
    const lvl = boss.awakened ? 1 : 0, now = host.now();
    const more = (n: number) => n + lvl + Math.floor(Math.max(0, host.party() - 1) / 2);
    const call = (extra?: Partial<FeedItem>) => host.push({ kind: 'signature', text: sig.name, sub: boss.name.toUpperCase(), enemy: boss.enemy, actor: boss.id, element: sig.element, ...extra });
    const at = (hero: SigHero, lead: number) => this.clamp({ x: hero.state.x + hero.velocity.x * lead * .6, y: hero.state.grounded ? hero.state.y : 0, z: hero.state.z + hero.velocity.z * lead * .6 });
    const b = boss.state;
    switch (sig.kind) {
      case 'pool': {
        call(); host.hold(boss.id, .7);
        const n = more(sig.count), radius = sig.radius * (lvl ? 1.12 : 1), life = sig.life * (lvl ? 1.25 : 1);
        for (let k = 0; k < n; k++) {
          const lands = now + sig.lead + k * .18;
          const centre = at(target!, sig.lead);
          const spot = k === 0 ? centre : this.scatter(centre, sig.spread);
          host.push({ kind: 'pool', x: spot.x, y: spot.y, z: spot.z, radius, value: lands, until: lands + life, element: sig.element, enemy: boss.enemy, text: sig.name });
          this.after(lands, boss.id, () => {
            // It erupts as it forms (thrown off), then burns (stood in).
            for (const hero of host.heroes()) if (Math.hypot(hero.state.x - spot.x, hero.state.z - spot.z) <= radius + .3) this.hit(boss.id, hero.id, sigMove(sig.name, sig.dps * 1.1, { knockback: 5, stun: .35 }), { x: spot.x, y: spot.y - .4, z: spot.z });
            this.pools.push({ x: spot.x, z: spot.z, r: radius, from: lands, until: lands + life, next: lands + .5, dps: sig.dps, source: boss.id, name: sig.name });
          });
        }
        return true;
      }
      case 'fissure': {
        call(); host.hold(boss.id, .8);
        const n = sig.pattern === 'sweep' ? sig.count + lvl * 2 : more(sig.count), length = sig.length * (lvl ? 1.1 : 1);
        const aimAt = (hero: SigHero, lead: number) => at(hero, lead);
        const toward = Math.atan2(target!.state.x - b.x, target!.state.z - b.z);
        for (let k = 0; k < n; k++) {
          const lands = now + sig.lead + k * (sig.gap ?? 0);
          let a: Vec3, dir: number;
          if (sig.pattern === 'radial') { dir = toward + (k / n) * Math.PI * 2; a = { x: b.x, y: 0, z: b.z }; }
          else if (sig.pattern === 'claws') { dir = toward; const side = (k - (n - 1) / 2) * 1.35; a = { x: b.x + Math.cos(toward) * side, y: 0, z: b.z - Math.sin(toward) * side }; }
          else if (sig.pattern === 'sweep') { dir = toward + (k / Math.max(1, n - 1) - .5) * 1.4; a = { x: b.x, y: 0, z: b.z }; }
          else if (sig.pattern === 'star') { dir = toward + (k / n) * Math.PI; const c = aimAt(target!, sig.lead); a = { x: c.x - Math.sin(dir) * length / 2, y: 0, z: c.z - Math.cos(dir) * length / 2 }; }
          else {
            // Aimed: each cut at where they are when it is thrown.
            const delay = k * (sig.gap ?? 0);
            this.after(now + delay, boss.id, () => {
              const self = host.body(boss.id), hero = host.heroes().find(each => each.id === target!.id) ?? host.heroes()[0];
              if (!self?.alive || !hero) return;
              const d = Math.atan2(hero.state.x - self.x, hero.state.z - self.z);
              this.line(boss, sig, { x: self.x, y: 0, z: self.z }, d, length, host.now() + sig.lead);
            });
            continue;
          }
          this.line(boss, sig, a, dir, length, lands);
        }
        return true;
      }
      case 'wave': {
        call(); host.hold(boss.id, .9);
        const n = (sig.count ?? 1) + lvl;
        for (let k = 0; k < n; k++) {
          const start = now + sig.lead + k * (sig.gap ?? .9);
          const reach = sig.reach * (lvl ? 1.12 : 1);
          host.push({ kind: 'wave', x: b.x, y: 0, z: b.z, radius: reach, value: start, until: start + reach / sig.speed, element: sig.element, enemy: boss.enemy, text: sig.name, sub: String(sig.speed) });
          this.after(start, boss.id, () => {
            const self = host.body(boss.id);
            this.waves.push({ x: self?.x ?? b.x, z: self?.z ?? b.z, start, speed: sig.speed, reach, width: sig.width, damage: sig.damage, freeze: sig.freeze ?? 0, source: boss.id, name: sig.name, hit: new Set() });
          });
        }
        return true;
      }
      case 'charge': {
        const seconds = sig.seconds * (lvl ? .9 : 1);
        const centre = sig.at === 'target' ? at(target!, 0) : { x: b.x, y: 0, z: b.z };
        const radius = sig.radius * (lvl ? 1.1 : 1);
        const need = (b.maxHp * sig.breakShare) * (lvl ? 1.15 : 1);
        plan.charge = { until: now + seconds, taken: 0, need, radius, damage: sig.damage, at: centre, name: sig.name, element: sig.element };
        plan.busyUntil = now + seconds + .6;
        host.hold(boss.id, seconds + .4);
        call({ value: now + seconds });
        host.push({ kind: 'charge', actor: boss.id, enemy: boss.enemy, x: centre.x, y: centre.y, z: centre.z, radius, value: now + seconds, element: sig.element, text: sig.name });
        this.after(now + seconds, boss.id, () => {
          const charge = this.plans.get(boss.id)?.charge;
          if (!charge || charge !== plan.charge) return;
          plan.charge = undefined;
          this.detonate(boss.id, boss.enemy, charge);
        });
        return true;
      }
      case 'meteor': {
        call(); host.hold(boss.id, .8);
        const n = more(sig.count), radius = sig.radius * (lvl ? 1.08 : 1);
        const centre = at(target!, sig.lead);
        for (let k = 0; k < n; k++) {
          // A ring of lances round them; a meteor on them.
          const angle = (k / n) * Math.PI * 2 + host.random() * .5;
          const spot = sig.spread && n > 1 ? this.clamp({ x: centre.x + Math.sin(angle) * sig.spread * .6, y: centre.y, z: centre.z + Math.cos(angle) * sig.spread * .6 }) : k === 0 ? centre : this.scatter(centre, 6);
          this.fall(boss.id, boss.enemy, spot, now + sig.lead + k * .22, radius, sigMove(sig.name, sig.damage, { knockback: 11, stun: .6, radius, guardBreak: radius > 5 }), sig.element, sig.look);
        }
        return true;
      }
      case 'blinks': {
        const n = more(sig.count) - (host.party() > 2 ? 1 : 0);
        plan.busyUntil = now + n * sig.gap + sig.lead + .8;
        host.hold(boss.id, n * sig.gap + sig.lead + .4);
        call();
        for (let k = 0; k < n; k++) {
          this.after(now + k * sig.gap, boss.id, () => {
            const hero = host.heroes().find(each => each.id === target!.id) ?? host.heroes()[0];
            if (!hero) return;
            const spot = this.clamp(at(hero, sig.lead));
            const lands = host.now() + sig.lead;
            this.fall(boss.id, boss.enemy, spot, lands, sig.radius, sigMove(sig.name, sig.damage, { knockback: 9, stun: .5, radius: sig.radius }), sig.element, 'blink');
            this.after(lands - .04, boss.id, () => {
              const now2 = host.now(), self = host.body(boss.id), foe = host.body(hero.id);
              if (!self?.alive) return;
              host.place(boss.id, spot, foe ? { x: foe.x, y: 0, z: foe.z } : { x: self.x, y: 0, z: self.z });
              if (sig.pool) {
                host.push({ kind: 'pool', x: spot.x, y: spot.y, z: spot.z, radius: sig.pool, value: now2, until: now2 + 4.5, element: sig.element, enemy: boss.enemy, text: sig.name });
                this.pools.push({ x: spot.x, z: spot.z, r: sig.pool, from: now2, until: now2 + 4.5, next: now2 + .5, dps: sig.damage * .2, source: boss.id, name: sig.name });
              }
              if (k === n - 1) host.force(boss.id, 'heavy');
            });
          });
        }
        return true;
      }
      case 'summon': {
        call();
        const placed = host.summon(sig.grunts, more(sig.count) + (lvl ? 1 : 0), { x: b.x, y: 0, z: b.z }, !!sig.hasted);
        return placed > 0;
      }
      case 'clones': {
        const n = more(sig.count);
        const life = sig.life;
        plan.busyUntil = now + 2;
        call();
        // Round the target: the real one takes one of the places, the copies the rest.
        const centre = { x: target!.state.x, y: 0, z: target!.state.z };
        const spots: Vec3[] = [];
        const turn = host.random() * Math.PI * 2;
        for (let k = 0; k <= n; k++) {
          const a = turn + (k / (n + 1)) * Math.PI * 2;
          const spot = host.clear(this.clamp({ x: centre.x + Math.sin(a) * 5.5, y: 0, z: centre.z + Math.cos(a) * 5.5 }));
          if (spot) spots.push(spot);
        }
        if (spots.length < 2) return false;
        const real = Math.floor(host.random() * spots.length);
        host.place(boss.id, spots[real], centre);
        spots.forEach((spot, k) => { if (k !== real) host.clone(boss.id, spot, life); });
        host.hold(boss.id, .6);
        return true;
      }
      case 'counter': {
        if (sig.style !== 'iron') return false;
        const seconds = (sig.seconds ?? 2.4) * (lvl ? 1.15 : 1);
        plan.ironUntil = now + seconds; plan.busyUntil = now + seconds + .4;
        // Iron body: blows glance off it, and it stands where it is.
        host.armour(boss.id, .15); host.hold(boss.id, seconds);
        call({ value: now + seconds });
        host.push({ kind: 'iron', actor: boss.id, enemy: boss.enemy, value: now + seconds, text: sig.name });
        this.after(now + seconds, boss.id, () => {
          if (plan.ironUntil <= 0) return;
          plan.ironUntil = 0;
          host.armour(boss.id, 1 / .15);
          const self = host.body(boss.id);
          if (!self?.alive) return;
          // The iron breaks outward.
          host.push({ kind: 'signature', text: 'THE COCOON BURSTS', sub: boss.name.toUpperCase(), enemy: boss.enemy, actor: boss.id, element: 'sound' });
          host.push({ kind: 'wave', x: self.x, y: 0, z: self.z, radius: 6.5, value: host.now() + .15, until: host.now() + .15 + 6.5 / 14, element: 'sound', enemy: boss.enemy, text: 'THE COCOON BURSTS', sub: '14' });
          this.waves.push({ x: self.x, z: self.z, start: host.now() + .15, speed: 14, reach: 6.5, width: 1.4, damage: sig.damage, freeze: 0, source: boss.id, name: 'Cocoon Burst', hit: new Set() });
        });
        return true;
      }
      case 'orbiters': {
        plan.orbitTurn++;
        const zeus = plan.orbitTurn % 2 === 1;
        const n = zeus ? more(2) : 1;
        for (let k = 0; k < n; k++) {
          const spot = k === 0 ? at(target!, 1) : this.scatter(at(target!, 1), 3.2);
          this.fall(boss.id, boss.enemy, spot, now + (zeus ? .95 : 1.2) + k * .2, zeus ? sig.radius : sig.radius * 1.4,
            sigMove(zeus ? 'Thunderhead' : 'Sunfire', sig.damage * (zeus ? 1 : 1.3), { knockback: zeus ? 5 : 8, stun: zeus ? .55 : .4 }), zeus ? 'lightning' : 'fire', zeus ? 'zeus' : 'prometheus');
          if (!zeus) this.after(now + 1.2, boss.id, () => {
            const t = host.now();
            host.push({ kind: 'pool', x: spot.x, y: spot.y, z: spot.z, radius: sig.radius * 1.3, value: t, until: t + 4, element: 'fire', enemy: boss.enemy, text: 'Sunfire' });
            this.pools.push({ x: spot.x, z: spot.z, r: sig.radius * 1.3, from: t, until: t + 4, next: t + .5, dps: sig.damage * .45, source: boss.id, name: 'Sunfire' });
          });
        }
        return true;
      }
      case 'pull': {
        const seconds = sig.seconds * (lvl ? 1.2 : 1), radius = sig.radius * (lvl ? 1.1 : 1);
        plan.pull = { until: now + seconds, next: now + .2, radius, damage: sig.damage, name: sig.name, release: sig.release ?? 'DISGORGE' };
        plan.busyUntil = now + seconds + 1;
        host.hold(boss.id, seconds + .6);
        call({ value: now + seconds });
        host.push({ kind: 'pull', actor: boss.id, enemy: boss.enemy, x: b.x, y: b.y, z: b.z, radius, value: now + seconds, element: sig.element, text: sig.name });
        return true;
      }
      default: return false;
    }
  }

  /** The pressure round Dune Oni, and what each awakening makes of it. */
  private startAura(boss: SigBoss, plan: Plan, sig: Extract<Signature, { kind: 'aura' }>, awakened: boolean) {
    plan.aura = { radius: sig.radius * (awakened ? 1.35 : 1), dps: sig.dps * (awakened ? 1.6 : 1), name: sig.name };
    this.host.push({ kind: 'aura', actor: boss.id, enemy: boss.enemy, radius: plan.aura.radius, value: awakened ? 2 : 1, element: sig.element, text: sig.name });
  }

  /** What runs every tick on a boss: its aura, its growing strength, its pull. */
  private ongoing(boss: SigBoss, plan: Plan, now: number) {
    const host = this.host, b = boss.state;
    if (plan.aura && now >= plan.tick) {
      plan.tick = now + .5;
      for (const hero of host.heroes()) if (Math.hypot(hero.state.x - b.x, hero.state.z - b.z) <= plan.aura.radius + .4) this.sear(boss.id, hero.id, plan.aura.dps * .5 * host.damageOut(boss.id), plan.aura.name);
    }
    const aura = plan.aura ? SIGNATURES[boss.enemy]?.find(sig => sig.kind === 'aura') as Extract<Signature, { kind: 'aura' }> | undefined : undefined;
    if (aura && now >= plan.nextStack && plan.stacks < 4) {
      plan.nextStack = now + 10; plan.stacks++;
      host.empower(boss.id, 1 + aura.stack);
      if (plan.stacks === 2 || plan.stacks === 4) host.push({ kind: 'signature', text: plan.stacks === 4 ? 'NO LIMIT' : 'THE FIGHT FEEDS HIM', sub: boss.name.toUpperCase(), enemy: boss.enemy, actor: boss.id, element: aura.element, value: plan.stacks });
    }
    const pull = plan.pull;
    if (pull) {
      if (now >= pull.until) {
        plan.pull = undefined;
        // LIBERATION (or the boss's own word for it): let go of, hard.
        const release = pull.release;
        host.push({ kind: 'signature', text: release, sub: boss.name.toUpperCase(), enemy: boss.enemy, actor: boss.id, element: 'dark' });
        host.push({ kind: 'wave', x: b.x, y: 0, z: b.z, radius: 5.5, value: now, until: now + .35, element: 'dark', enemy: boss.enemy, text: release, sub: '16' });
        for (const hero of host.heroes()) if (Math.hypot(hero.state.x - b.x, hero.state.z - b.z) <= 5.5) this.hit(boss.id, hero.id, sigMove('Disgorge', pull.damage, { knockback: 12, stun: .6 }), { x: b.x, y: b.y + .6, z: b.z });
        host.crowd(b.x, b.z, 5.5, pull.damage);
        host.force(boss.id, 'heavy');
      } else if (now >= pull.next) {
        pull.next = now + .3;
        for (const hero of host.heroes()) {
          const d = Math.hypot(hero.state.x - b.x, hero.state.z - b.z);
          if (d > pull.radius || d < 1.9) continue;
          this.hit(boss.id, hero.id, sigMove(pull.name, 6, { knockback: -5.5, stun: .22 }), { x: b.x, y: hero.state.y + 1, z: b.z });
        }
      }
    }
  }

  /** A line torn along the floor, landing at `lands`. */
  private line(boss: SigBoss, sig: Extract<Signature, { kind: 'fissure' }>, a: Vec3, dir: number, length: number, lands: number) {
    const b = this.clamp({ x: a.x + Math.sin(dir) * length, y: 0, z: a.z + Math.cos(dir) * length });
    const start = this.clamp(a);
    this.host.push({ kind: 'fissure', points: [start, b], radius: sig.width, value: lands, element: sig.element, enemy: boss.enemy, text: sig.name });
    this.lines.push({ a: start, b, width: sig.width, lands, damage: sig.damage * (boss.awakened ? 1.12 : 1), source: boss.id, name: sig.name });
  }

  /** FUTURE SIGHT: gone from in front of the string, and behind the one throwing it. */
  /** Gone, and at the fighter's back - or beside them, where their back is
   *  blocked (it gave up silently there, and the counter was spent for nothing). */
  private foresee(boss: SigBoss, sig: Signature, heroId: string) {
    const host = this.host, hero = host.body(heroId);
    if (!hero?.alive) return false;
    let spot: Vec3 | undefined;
    for (const turn of [Math.PI, Math.PI * .7, -Math.PI * .7, Math.PI / 2, -Math.PI / 2]) {
      const a = hero.yaw + turn + (host.random() - .5) * .4;
      spot = host.clear(this.clamp({ x: hero.x + Math.sin(a) * 2.1, y: 0, z: hero.z + Math.cos(a) * 2.1 }));
      if (spot) break;
    }
    if (!spot) return false;
    host.push({ kind: 'signature', text: sig.name, sub: boss.name.toUpperCase(), enemy: boss.enemy, actor: boss.id, element: sig.element });
    host.place(boss.id, spot, { x: hero.x, y: 0, z: hero.z });
    host.force(boss.id, 'heavy');
    return true;
  }

  /** A charge let go: everything under it is hit, the horde too, and the ground. */
  private detonate(id: string, enemy: string, charge: Charge) {
    const host = this.host, c = charge.at;
    host.push({ kind: 'charge-end', actor: id, enemy, value: 0, x: c.x, y: c.y, z: c.z, radius: charge.radius, text: charge.name, element: charge.element });
    const move = sigMove(charge.name, charge.damage, { knockback: 14, stun: .8, radius: charge.radius, guardBreak: true });
    for (const hero of host.heroes()) if (Math.hypot(hero.state.x - c.x, hero.state.z - c.z) <= charge.radius + .4) this.hit(id, hero.id, move, { x: c.x, y: c.y + .4, z: c.z });
    host.crowd(c.x, c.z, charge.radius, charge.damage * 2);
  }

  /** What was cast lands: pools burn, waves roll, lines tear. */
  private land(now: number) {
    const host = this.host;
    const heroes = host.heroes();
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const pool = this.pools[i];
      if (now >= pool.until) { this.pools.splice(i, 1); continue; }
      if (now < pool.next) continue;
      pool.next = now + .5;
      for (const hero of heroes) if (Math.hypot(hero.state.x - pool.x, hero.state.z - pool.z) <= pool.r && hero.state.y < .6) this.sear(pool.source, hero.id, pool.dps * .5 * host.damageOut(pool.source), pool.name);
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wave = this.waves[i];
      if (now < wave.start) continue;
      const r = (now - wave.start) * wave.speed;
      if (r > wave.reach + wave.width) { this.waves.splice(i, 1); continue; }
      for (const hero of heroes) {
        if (wave.hit.has(hero.id)) continue;
        const d = Math.hypot(hero.state.x - wave.x, hero.state.z - wave.z);
        // Along the floor: a fighter in the air as it passes is over it.
        if (Math.abs(d - r) > wave.width * .5 + .3 || hero.state.y > .55) continue;
        wave.hit.add(hero.id);
        this.hit(wave.source, hero.id, sigMove(wave.name, wave.damage, { knockback: wave.freeze ? 1.5 : 8, stun: wave.freeze || .5 }), { x: wave.x, y: hero.state.y + .6, z: wave.z });
      }
    }
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const line = this.lines[i];
      if (now < line.lands) continue;
      this.lines.splice(i, 1);
      const abx = line.b.x - line.a.x, abz = line.b.z - line.a.z, len = abx * abx + abz * abz || 1;
      for (const hero of host.heroes()) {
        const t = Math.max(0, Math.min(1, ((hero.state.x - line.a.x) * abx + (hero.state.z - line.a.z) * abz) / len));
        const px = line.a.x + abx * t, pz = line.a.z + abz * t;
        if (Math.hypot(hero.state.x - px, hero.state.z - pz) > line.width * .5 + .35 || hero.state.y > 1.2) continue;
        this.hit(line.source, hero.id, sigMove(line.name, line.damage, { knockback: 7, stun: .45 }), { x: px, y: hero.state.y - .3, z: pz });
      }
    }
  }

  private after(at: number, boss: string, run: () => void) { this.later.push({ at, run, boss }); }
  /** The run's hands, with each blow weighed by its boss's rank (SIG_RANK). */
  private readonly weights = new Map<string, number>();
  private weight(source: string) { return this.weights.get(source) ?? 1; }
  private hit(source: string, hero: string, move: MoveDefinition, from: Vec3) { this.host.strike(source, hero, { ...move, damage: move.damage * this.weight(source) }, from); }
  private sear(source: string, hero: string, amount: number, name: string) { this.host.burn(source, hero, amount * this.weight(source), name); }
  private fall(source: string, enemy: string, at: Vec3, lands: number, radius: number, move: MoveDefinition, element: string, look?: string) {
    this.host.hazard(source, enemy, at, lands, radius, { ...move, damage: move.damage * this.weight(source) }, element, look);
  }

  private clamp(at: Vec3): Vec3 {
    const { halfX, halfZ } = this.host.bounds();
    return { x: Math.max(-halfX + 1.2, Math.min(halfX - 1.2, at.x)), y: at.y, z: Math.max(-halfZ + 1.2, Math.min(halfZ - 1.2, at.z)) };
  }
  private scatter(centre: Vec3, spread: number): Vec3 {
    const a = this.host.random() * Math.PI * 2, r = spread * (.45 + this.host.random() * .55);
    return this.clamp({ x: centre.x + Math.sin(a) * r, y: centre.y, z: centre.z + Math.cos(a) * r });
  }
}
