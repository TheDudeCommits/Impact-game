/** The rift's bosses by rank. Every round of a run opens with one of them,
 *  escorted by the rank and file of its own universe; the rank climbs with
 *  the rounds, F to S, and past S the rift mixes the top ranks and sends them
 *  two at a time. Data only (the match server reads it too).
 *
 *  A boss here is a champion model from enemies.ts - its moves, clips and
 *  brain - given a rank, which sets its health and the weight of its blows,
 *  an escort, and the lines its entrance card prints. */
import { ENEMIES } from './enemies';

export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
export type Rank = (typeof RANKS)[number];

/** Health and blow weight by rank (a party of one; see partyScale). */
/** The top ranks are events, not speed bumps: a strong run melted rank S in
 *  half a minute, as fast as the rank-F opener. */
/** A boss's health by rank. A boss is its round's set piece: at 2,400-9,000
 *  a built fighter killed F-B bosses 17-42 s after they arrived (median 24 s,
 *  enraged for 5-19 s) - cameos, not fights. Now 30-45 s early, a minute and
 *  more at A and S. */
export const RANK_HP: Record<Rank, number> = { F: 2400, E: 3900, D: 5100, C: 6500, B: 8300, A: 13200, S: 21500 };
/** (C and B a little softer since their fights grew longer: the middle of the
 *  road was the wall, not S.) */
/** (Eased E to B when the bosses stopped waiting between moves and the arts
 *  stopped holding them in a hit-stop: the same blows, more of them.) */
export const RANK_DAMAGE: Record<Rank, number> = { F: .7, E: .77, D: .94, C: 1.01, B: 1.18, A: 1.54, S: 2.1 };
/** The grunts a rank's round fields, as a multiple of the round's base. */
/** (A grown build wiped S's crowd to the thinnest of the road, a median of 43; the top two ranks come thicker.) */
export const RANK_HORDE: Record<Rank, number> = { F: 1, E: 1.12, D: 1.25, C: 1.4, B: 1.55, A: 1.95, S: 2.2 };

/** A boss's own universe, and the grunt kinds that come through the rift with it. */
export interface Escort { fodder: readonly (readonly [string, number])[]; gunners: readonly (readonly [string, number])[]; brutes: readonly (readonly [string, number])[];
  /** Its ways of fighting beyond swinging and shooting (the fifth list): shields, healers, summoners, snipers, divers. */
  specials?: readonly (readonly [string, number])[] }
// The armies, keyed by name. Internal: no save or message holds an army's key.
export const ESCORTS = {
  tribunal: { fodder: [['tribunal-guard', 1]], gunners: [['tribunal-guard-rifle', 1]], brutes: [['automaton', 1]], specials: [['tribunal-guard-shield', 1], ['tribunal-guard-sniper', .7]] },
  // (A table's weights share its own role only: a lone entry at .0001 is still
  // the whole of it - the captains' gunners were navy riflemen, "the Navy is
  // their enemy, not their escort", and the Last Sun's and Konta's brutes Grave
  // Hound's apostles. A crew with no one for a role fills it with its own.)
  grafters: { fodder: [['graft-raider', 1]], gunners: [['graft-raider', 1]], brutes: [['graft-brute', 1]], specials: [['graft-leaper', 1], ['graft-doctor', .6]] },
  // Mirabel's own: her chess soldiers, pikes forward.
  wardens: { fodder: [['iron-warden', 1]], gunners: [['iron-warden', 1]], brutes: [['iron-warden', 1]], specials: [['iron-bulwark', 1], ['iron-chaplain', .6]] },
  wraiths: { fodder: [['ash-wraith', 1]], gunners: [['ash-caster', 1]], brutes: [['great-wraith', 1]], specials: [['bat-wraith', 1], ['wraith-caller', .45]] },
  legion: { fodder: [['cinder-imp', 1], ['brood-spawn', .8]], gunners: [['jinlin-soldier', 1]], brutes: [['brood-spawn', 1]], specials: [['jinlin-sniper', .8], ['cinder-imp-diver', 1]] },
  cutthroats: { fodder: [['pale-sapling', 1]], gunners: [['cutthroat', 1]], brutes: [['pale-sapling', 1]], specials: [['cutthroat-mender', .6], ['cutthroat-caller', .5]] },
  damned: { fodder: [['husk', 1]], gunners: [['ash-caster', .4]], brutes: [['rift-spawn', 1]], specials: [['husk-diver', 1], ['husk-priest', .45]] },
} as const satisfies Record<string, Escort>;
export type EscortId = keyof typeof ESCORTS;

export interface BossEntry {
  /** An enemies.ts definition. */
  id: string;
  rank: Rank;
  escort: EscortId;
  /** The line the entrance card prints under the name. */
  epithet: string;
  /** Short line for the card's bottom strip: where it came from. */
  universe: string;
}

export const BOSSES: readonly BossEntry[] = [
  // F - the rift's first wave: agents and enforcers.
  { id: 'takane', rank: 'F', escort: 'tribunal', epithet: 'THE KNIFE BRIDE · SHE DANCES IN STEEL', universe: 'THE DUST SEA' },
  { id: 'harrow', rank: 'F', escort: 'tribunal', epithet: 'THE GRAVEHOUND MONK · HE PRAYS WITH HIS FISTS', universe: 'THE DUST SEA' },
  { id: 'kanuki', rank: 'F', escort: 'tribunal', epithet: 'THE LOCKWARDEN · EVERY KEY OF THE PRISON', universe: 'THE DUST SEA' },
  { id: 'gantry', rank: 'E', escort: 'tribunal', epithet: 'THE CHAIN ABBOT · WARDEN OF THE IRON CHOIR', universe: 'THE DUST SEA' },
  { id: 'zarek', rank: 'E', escort: 'wraiths', epithet: 'THE OBSIDIAN PANTHER · GLASS THAT HUNTS', universe: 'CINDER REQUIEM' },
  { id: 'nightfall', rank: 'E', escort: 'wraiths', epithet: 'THE STARLESS EDGE', universe: 'CINDER REQUIEM' },
  { id: 'kade', rank: 'D', escort: 'tribunal', epithet: 'THE SILK STALKER · NO FACE, NO SOUND', universe: 'THE DUST SEA' },
  { id: 'nihil', rank: 'D', escort: 'wraiths', epithet: 'THE FACELESS SERAPH · SIX WINGS, NO FACE', universe: 'CINDER REQUIEM' },
  { id: 'ashwing', rank: 'D', escort: 'grafters', epithet: 'THE PYRE KNIGHT · HIS ARMOUR IS STILL BURNING', universe: 'THE DUST SEA' },
  { id: 'rakshasa', rank: 'C', escort: 'wraiths', epithet: 'THE ONI UNCHAINED', universe: 'THE DUST SEA' },
  { id: 'kuromitsu', rank: 'C', escort: 'wardens', epithet: 'THE TAR ORACLE · TWELVE EYES, NO MOUTH', universe: 'THE DUST SEA' },
  { id: 'rime', rank: 'C', escort: 'tribunal', epithet: 'THE GLACIER HERMIT · THE COLD THAT WALKS', universe: 'THE DUST SEA' },
  { id: 'lumen', rank: 'C', escort: 'tribunal', epithet: 'THE GLARE WIDOW · DO NOT LOOK AT HER', universe: 'THE DUST SEA' },
  { id: 'caldera', rank: 'B', escort: 'tribunal', epithet: 'THE MOLTEN MONK · HE WEEPS FIRE', universe: 'THE DUST SEA' },
  { id: 'mirabel', rank: 'B', escort: 'wardens', epithet: 'THE STORM DOWAGER · SHE KEEPS YOUR SOUL IN A LOCKET', universe: 'THE DUST SEA' },
  { id: 'wuming', rank: 'B', escort: 'legion', epithet: 'THE LIGHTLESS SAGE', universe: 'THE LAST SUN' },
  { id: 'jinlin', rank: 'B', escort: 'legion', epithet: 'THE DRAGON-GATE TYRANT', universe: 'THE LAST SUN' },
  // A
  { id: 'shiun', rank: 'A', escort: 'wraiths', epithet: 'CONDUCTOR OF THE CINDER REQUIEM', universe: 'CINDER REQUIEM' },
  { id: 'kurobi', rank: 'A', escort: 'cutthroats', epithet: 'THE EMBER IN THE ASH', universe: 'HIDDEN ASH' },
  { id: 'barrow', rank: 'A', escort: 'grafters', epithet: 'THE MAN WHO SWALLOWS THE DARK', universe: 'THE DUST SEA' },
  { id: 'akagane', rank: 'A', escort: 'cutthroats', epithet: 'THE COPPER TYRANT · RISEN FROM THE EMBER TOMB', universe: 'HIDDEN ASH' },
  { id: 'oro', rank: 'A', escort: 'damned', epithet: 'THE GILDED HOUR · LORD OF THE CLOCK TOWER', universe: 'GILDED RUIN' },
  { id: 'vesper', rank: 'A', escort: 'damned', epithet: 'THE UNCROWNED OF THE GRAVE ROADS', universe: 'GRAVE HOUND' },
  { id: 'jirenga', rank: 'S', escort: 'legion', epithet: 'THE STONE GUARDIAN', universe: 'THE LAST SUN' },
  { id: 'gorai', rank: 'S', escort: 'grafters', epithet: 'THE THUNDERHEAD OF THE DUST SEA', universe: 'THE DUST SEA' },
  { id: 'haldor', rank: 'S', escort: 'grafters', epithet: 'THE OLD QUAKE OF THE DUST SEA', universe: 'THE DUST SEA' },
  { id: 'magatsu', rank: 'S', escort: 'wraiths', epithet: 'THE CALAMITY OF HEX FALLOUT', universe: 'HEX FALLOUT' },
  { id: 'imago', rank: 'S', escort: 'grafters', epithet: 'THE SWARM SOVEREIGN', universe: 'THE SALVAGE WILDS' },
];

export const bossEntry = (id: string) => BOSSES.find(entry => entry.id === id);

/** The rank a round's boss is drawn from: two rounds a rank, F to S. Past S
 *  the rift draws from A and S. */
export function rankFor(round: number): Rank {
  const index = Math.floor((round - 1) / 2);
  return index < RANKS.length ? RANKS[index] : 'S';
}
/** How deep into the Rift a round is: 0 until the ranks are through. */
export const loopOf = (round: number) => Math.max(0, Math.floor((round - 1) / 2) - RANKS.length + 1);

/** A boss for `round`, drawn from its rank's pool without repeating one the
 *  run has already met until the pool is spent. Past the ranks: A or S,
 *  weighted to S as the Rift deepens. */
/** Bosses kept out of the draw for now: Kurobi's tails dwarf his body at the
 *  play camera (he read as "a pink pile that growls", headless) and he has
 *  no voice of his own; Gorm the Glutted, round two's comic slug among the
 *  villains, "undercuts the GraveHound-dark mood at the exact moment
 *  first impressions form". The entries and models stay. */
export const RESTING: ReadonlySet<string> = new Set(['kurobi']);

/** The first boss a new player meets, from rank F's two whose models hold
 *  up at the play camera: Takane's face and Gorm the Glutted's sack read as placeholders
 *  at a first look (they come later on the road, and as champions). And,
 *  since the overhaul ("a different opening every run": every run opened on
 *  LANTERN_GUARD and the Navy), rank E's two Blade-class Cinder Requiem bosses, met at rank
 *  F's strength - a run opens on Dust Sea or on Cinder Requiem. */
export const OPENERS: ReadonlySet<string> = new Set(['harrow', 'kanuki', 'zarek', 'nightfall']);

export function drawBoss(round: number, met: readonly string[], random: () => number, avoid: ReadonlySet<string> = new Set()): BossEntry {
  const loop = loopOf(round);
  const rank: Rank = loop > 0 ? (random() < Math.min(.8, .45 + loop * .1) ? 'S' : 'A') : rankFor(round);
  const all = round === 1 && loop === 0
    ? BOSSES.filter(entry => OPENERS.has(entry.id) && ENEMIES[entry.id] && !RESTING.has(entry.id)).map(entry => ({ ...entry, rank }))
    : BOSSES.filter(entry => entry.rank === rank && ENEMIES[entry.id] && !RESTING.has(entry.id));
  // (Never the fighter's own partner, unless the rank has no one else.)
  const pool = all.filter(entry => !avoid.has(entry.id)).length ? all.filter(entry => !avoid.has(entry.id)) : all;
  const fresh = pool.filter(entry => !met.includes(entry.id));
  const from = fresh.length ? fresh : pool;
  // Villains of every universe: a universe the run has already met is drawn
  // less (the roster is half Dust Sea, and an even draw made the road a
  // Dust Sea gauntlet with a few guests).
  const seen = (universe: string) => met.reduce((n, id) => n + (BOSSES.find(entry => entry.id === id)?.universe === universe ? 1 : 0), 0);
  const weights = from.map(entry => 1 / (1 + seen(entry.universe) * 1.5));
  let roll = random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < from.length; i++) { roll -= weights[i]; if (roll <= 0) return from[i]; }
  return from[from.length - 1];
}

/** A round's army: its boss's own - but through ranks F and E never the one
 *  the round before fielded (the overhaul's "a different opening every run":
 *  a run's first rounds were the Navy, round after round). Then an army the
 *  run has not met comes through the rift with the boss instead, one no
 *  harder than the Navy those ranks were tuned on: Cinder Requiem's, Konta's or
 *  Mirabel's chess. (Across twelve seeds, letting in the Last Sun's exploders, the
 *  damned's apostles and the Gifters took rank D's lowest health from 42% to
 *  28%. Gorm's own come with Gorm the Glutted, who is resting.) */
export const EARLY_ARMIES: readonly EscortId[] = ['wraiths', 'cutthroats', 'wardens'];
export function armyFor(boss: BossEntry, round: number, fielded: readonly EscortId[], random: () => number): EscortId {
  const early = !loopOf(round) && RANKS.indexOf(rankFor(round)) <= RANKS.indexOf('E');
  if (!early || boss.escort !== fielded[fielded.length - 1]) return boss.escort;
  const fresh = EARLY_ARMIES.filter(id => !fielded.includes(id));
  return fresh.length ? fresh[Math.floor(random() * fresh.length)] : boss.escort;
}

/** Whether a round in the Rift sends two bosses at once. */
export const doubleBoss = (round: number, random: () => number) => loopOf(round) > 0 && random() < Math.min(.7, .25 + loopOf(round) * .15);
