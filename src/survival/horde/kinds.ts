
/** (The fifth list's new ones: a SHIELD that only a heavy breaks, a HEALER
 *  mending its pack from the back, a SUMMONER opening rifts for more of its
 *  own, a SNIPER with a long sight line and one heavy shot, a DIVER that
 *  comes down out of the air.) */
export type GruntRole = 'fodder' | 'gunner' | 'brute' | 'charger' | 'exploder' | 'shield' | 'healer' | 'summoner' | 'sniper' | 'diver';
export type GruntElement = 'steel' | 'blood' | 'fire' | 'ki' | 'void-ray' | 'jade' | 'laser' | 'dark' | 'sound' | 'blaster';
/** What comes out of a grunt when it is cut: the colour of its insides. */
export type Ichor = 'red' | 'black' | 'white' | 'green' | 'oil' | 'purple';

export interface GruntMove {
  name: string;
  /** Clip in the motion library, played over `duration`. */
  clip: string;
  duration: number;
  /** When the blow lands (or the shot leaves), seconds into the move. */
  contact: number;
  /** Melee: reach from the grunt's centre to the target's edge. Shot: how far it flies. */
  range: number;
  /** Melee: how wide the swing is, as the cosine of its half-angle. */
  arc: number;
  damage: number;
  knockback: number;
  stun: number;
  kind: 'melee' | 'shot' | 'slam' | 'explode' | 'charge' | 'mend' | 'summon' | 'dive';
  /** Slam and explosion radius; a shot's thickness. */
  radius?: number;
  /** Shot speed, m/s. */
  speed?: number;
  /** Metres it steps into the blow during the wind-up. */
  lunge?: number;
  /** Seconds it rests before any move again. */
  cooldown: number;
  /** A heavy blow staggers a fighter even out of a move (see `minor` in sim.strike). */
  heavy?: boolean;
  /** Only picked from at least / at most this far away. */
  minRange?: number;
  maxRange?: number;
  weight?: number;
  element?: GruntElement;
}

export interface GruntKind {
  id: string;
  name: string;
  series: string;
  role: GruntRole;
  hp: number;
  /** Ground speed, m/s (a fighter runs 7.5). */
  speed: number;
  /** Body radius for the crowd and for blows, and standing height. */
  radius: number;
  height: number;
  /** How far a blow moves it, against a fodder's 1. */
  mass: number;
  /** Damage it absorbs from light blows before it reacts to them (brutes). */
  poise?: number;
  /** Damage taken against the move tables. */
  damageIn?: number;
  moves: GruntMove[];
  xp: number;
  score: number;
  /** What it costs the director's budget. */
  cost: number;
  ichor: Ichor;
  /** Hovers this far off the floor (fliers). */
  hover?: number;
  /** Carries a shield it blocks what comes at its front with (a heavy, a
   *  special or an ultimate breaks it). */
  shield?: boolean;
}

const melee = (name: string, clip: string, duration: number, contact: number, damage: number, extra: Partial<GruntMove> = {}): GruntMove =>
  ({ name, clip, duration, contact, damage, range: 1.7, arc: .35, knockback: 3.2, stun: .3, kind: 'melee', lunge: 1.4, cooldown: 1.1, ...extra });
const shot = (name: string, clip: string, duration: number, contact: number, damage: number, extra: Partial<GruntMove> = {}): GruntMove =>
  ({ name, clip, duration, contact, damage, range: 18, arc: .8, knockback: 3.5, stun: .3, kind: 'shot', radius: .35, speed: 24, cooldown: 3.4, minRange: 4.5, maxRange: 15, ...extra });

const CLAW = (damage: number, extra: Partial<GruntMove> = {}) => melee('Claw', 'claw', 1.2, .59, damage, extra);
const FRENZY = (damage: number, extra: Partial<GruntMove> = {}) => melee('Frenzy', 'combo', 1.6, .69, damage, { knockback: 5, stun: .45, cooldown: 2.2, weight: .45, ...extra });
const KICK = (damage: number, extra: Partial<GruntMove> = {}) => melee('Kick', 'kick', 1.2, .5, damage, { knockback: 4.5, ...extra });
const PUNCH = (damage: number, extra: Partial<GruntMove> = {}) => melee('Strike', 'punch', 1.2, .59, damage, extra);
const UPPERCUT = (damage: number, extra: Partial<GruntMove> = {}) => melee('Uppercut', 'uppercut', 1.2, .7, damage, { knockback: 6, stun: .45, cooldown: 2.2, weight: .4, ...extra });
const ROAR_SHOT = (name: string, damage: number, element: GruntElement, extra: Partial<GruntMove> = {}) => shot(name, 'roar', 2.2, 1.54, damage, { element, ...extra });

export const GRUNTS: readonly GruntKind[] = [
  // ---- Dust Sea -----------------------------------------------------------
  { id: 'tribunal-guard', name: 'Tribunal Guard', series: 'Dust Sea', role: 'fodder', hp: 110, speed: 5.2, radius: .42, height: 1.75, mass: 1,
    moves: [CLAW(18, { name: 'Cutlass Slash', element: 'steel', clip: 'slash' }), KICK(22, { weight: .5 })], xp: 1, score: 40, cost: 1, ichor: 'red' },
  { id: 'tribunal-guard-rifle', name: 'Tribunal Rifleman', series: 'Dust Sea', role: 'gunner', hp: 90, speed: 4.8, radius: .42, height: 1.75, mass: 1,
    moves: [ROAR_SHOT('Musket Volley', 20, 'steel', { speed: 34, radius: .25 }), PUNCH(16, { name: 'Bayonet', maxRange: 2.2, clip: 'thrust' })], xp: 2, score: 60, cost: 2, ichor: 'red' },
  { id: 'automaton', name: 'Tribunal Automaton', series: 'Dust Sea', role: 'brute', hp: 760, speed: 3.6, radius: .8, height: 3.1, mass: 3.2, poise: 170, damageIn: .9,
    moves: [
      { ...shot('Palm Laser', 'roar', 2.2, 1.54, 46, { element: 'laser', speed: 40, radius: .45, knockback: 8, heavy: true, cooldown: 4 }) },
      melee('Iron Palm', 'uppercut', 1.7, 1, 52, { range: 2.6, arc: .1, knockback: 9, stun: .6, heavy: true, lunge: 2.2, cooldown: 2.6 }),
    ], xp: 8, score: 320, cost: 5, ichor: 'oil' },
  { id: 'graft-raider', name: 'Graft Raider', series: 'Dust Sea', role: 'fodder', hp: 150, speed: 5, radius: .46, height: 1.9, mass: 1.2,
    moves: [KICK(22, { name: 'Iron Kick' }), UPPERCUT(30, { name: 'Horn Uppercut' })], xp: 1, score: 50, cost: 1, ichor: 'red' },
  { id: 'iron-warden', name: 'Iron Warden', series: 'Dust Sea', role: 'fodder', hp: 140, speed: 5, radius: .44, height: 1.95, mass: 1.1,
    moves: [CLAW(24, { name: 'Pike Thrust', element: 'steel', range: 2.3, lunge: 1.8, clip: 'thrust' }), KICK(20)], xp: 1, score: 50, cost: 1, ichor: 'red' },
  { id: 'graft-brute', name: 'Graft Brute', series: 'Dust Sea', role: 'brute', hp: 820, speed: 3.4, radius: .85, height: 3.1, mass: 3.4, poise: 200,
    moves: [
      melee('Crushing Knuckle', 'hammer', 1.8, 1.5, 56, { range: 2.7, arc: .1, knockback: 10, stun: .6, heavy: true, lunge: 2.4, cooldown: 2.6 }),
      { ...melee('Stomp', 'kick', 1.6, .8, 46, { knockback: 8, heavy: true, cooldown: 3.4 }), kind: 'slam', radius: 2.6, range: 1.2 },
    ], xp: 8, score: 320, cost: 5, ichor: 'red' },
  // ---- Cinder Requiem ------------------------------------------------------------
  { id: 'ash-wraith', name: 'Ash Wraith', series: 'Cinder Requiem', role: 'fodder', hp: 130, speed: 5.6, radius: .44, height: 1.95, mass: 1,
    moves: [CLAW(20, { element: 'blood' }), FRENZY(16, { element: 'blood' })], xp: 1, score: 45, cost: 1, ichor: 'black' },
  { id: 'ash-caster', name: 'Wraith Caster', series: 'Cinder Requiem', role: 'gunner', hp: 100, speed: 5, radius: .44, height: 1.95, mass: 1,
    moves: [ROAR_SHOT('Ash Lance', 24, 'void-ray', { speed: 30, radius: .5 }), CLAW(16, { maxRange: 2.2 })], xp: 2, score: 70, cost: 2, ichor: 'black' },
  { id: 'great-wraith', name: 'Great Wraith', series: 'Cinder Requiem', role: 'brute', hp: 900, speed: 3.2, radius: .95, height: 3.6, mass: 3.8, poise: 220,
    moves: [
      shot('Great Ash Lance', 'roar', 2.6, 1.82, 50, { element: 'void-ray', speed: 26, radius: .9, knockback: 9, heavy: true, cooldown: 4.5 }),
      melee('Crushing Claw', 'combo', 1.9, 1.1, 54, { range: 2.8, arc: .15, knockback: 9, stun: .6, heavy: true, lunge: 2.4, cooldown: 2.6 }),
    ], xp: 9, score: 340, cost: 5, ichor: 'black' },
  // ---- Last Sun ---------------------------------------------------------
  { id: 'cinder-imp', name: 'Cinder Imp', series: 'Last Sun', role: 'exploder', hp: 80, speed: 6.4, radius: .38, height: 1.35, mass: .8,
    moves: [
      CLAW(16, { name: 'Acid Claw' }),
      { ...melee('Self-Destruct', 'roar', 1.4, 1.2, 70, { knockback: 9, stun: .5, heavy: true, cooldown: 9, minRange: 0, maxRange: 1.8, weight: .6 }), kind: 'explode', radius: 2.6 },
    ], xp: 1, score: 55, cost: 1, ichor: 'green' },
  { id: 'jinlin-soldier', name: 'Tyrant Trooper', series: 'Last Sun', role: 'gunner', hp: 100, speed: 5, radius: .44, height: 1.85, mass: 1,
    moves: [ROAR_SHOT('Spirit Blast', 20, 'ki', { speed: 36, radius: .3 }), PUNCH(16, { maxRange: 2.2 })], xp: 2, score: 65, cost: 2, ichor: 'purple' },
  { id: 'brood-spawn', name: 'Brood Spawn', series: 'Last Sun', role: 'fodder', hp: 120, speed: 6.6, radius: .36, height: 1.4, mass: .8,
    moves: [PUNCH(18, { name: 'Rush' }), KICK(22, { name: 'Spin Kick' })], xp: 1, score: 55, cost: 1, ichor: 'purple' },
  // ---- Ashwood ----------------------------------------------------------
  { id: 'pale-sapling', name: 'Pale Sapling', series: 'Ashwood', role: 'fodder', hp: 115, speed: 5.4, radius: .42, height: 1.8, mass: 1,
    moves: [PUNCH(18, { name: 'Grasping Strike' }), KICK(22, { name: 'Wood Kick' })], xp: 1, score: 45, cost: 1, ichor: 'white' },
  { id: 'cutthroat', name: 'Cutthroat', series: 'Ashwood', role: 'gunner', hp: 95, speed: 6, radius: .42, height: 1.78, mass: .9,
    moves: [shot('Kunai Volley', 'claw', 1.2, .55, 16, { element: 'steel', speed: 38, radius: .2, cooldown: 1.9, minRange: 3.5 }), KICK(18, { maxRange: 2.2 })], xp: 2, score: 60, cost: 2, ichor: 'red' },
  // ---- The Rift's own: what Grave Hound would call the damned ----------------------
  { id: 'husk', name: 'Ash Husk', series: 'The Rift', role: 'fodder', hp: 100, speed: 6, radius: .42, height: 1.8, mass: .9,
    moves: [CLAW(18, { element: 'dark' }), FRENZY(14, { element: 'dark' })], xp: 1, score: 40, cost: 1, ichor: 'black' },
  { id: 'rift-spawn', name: 'Rift Spawn', series: 'The Rift', role: 'brute', hp: 980, speed: 3.6, radius: 1, height: 3.4, mass: 4, poise: 240,
    moves: [
      melee('Rending Claws', 'combo', 1.9, 1.1, 58, { range: 2.9, arc: .15, knockback: 10, stun: .6, heavy: true, lunge: 2.6, cooldown: 2.4, element: 'blood' }),
      { ...melee('Ground Slam', 'slam', 1.8, 1.05, 50, { knockback: 9, heavy: true, cooldown: 3.6 }), kind: 'slam', radius: 3 },
    ], xp: 10, score: 380, cost: 5, ichor: 'black' },
];

/** The fifth list's rank and file: new ways to fight, each worn over a body
 *  the horde already has (its model, retinted, its gear its own - see
 *  render/horde/modelLooks.ts and fleshLooks.ts ARMS). Two for each army.
 *  (Appended: a kind's number is its place in the table, on the wire too.) */
/** A mend's `damage` is the share of health it gives back to every one of its kind round it. */
const MEND = (damage: number, extra: Partial<GruntMove> = {}): GruntMove => ({ ...melee('Mend', 'cast', 2, 1.5, damage, { cooldown: 5.5, minRange: 0, maxRange: 40, weight: 1.6, lunge: 0 }), kind: 'mend', radius: 8, ...extra });
/** A rift call's `damage` is how many come through it. */
const SUMMON = (count: number, extra: Partial<GruntMove> = {}): GruntMove => ({ ...melee('Rift Call', 'cast', 2.4, 1.9, count, { cooldown: 9, minRange: 0, maxRange: 40, weight: 1.4, lunge: 0 }), kind: 'summon', ...extra });
const SNIPE = (name: string, damage: number, element: GruntElement, extra: Partial<GruntMove> = {}) => shot(name, 'roar', 2.6, 2.2, damage, { element, speed: 70, radius: .3, range: 34, maxRange: 30, minRange: 8, knockback: 8, stun: .5, heavy: true, cooldown: 5.5, ...extra });
const DIVE = (damage: number, extra: Partial<GruntMove> = {}): GruntMove => ({ ...melee('Dive', 'kick', 1.7, 1.45, damage, { knockback: 7, stun: .5, heavy: true, cooldown: 5.5, minRange: 3.5, maxRange: 13, weight: 1.5 }), kind: 'dive', radius: 2.3, ...extra });
const SHIELD_BASH = (damage: number, extra: Partial<GruntMove> = {}) => melee('Shield Bash', 'punch', 1.3, .62, damage, { knockback: 6, stun: .45, cooldown: 1.8, ...extra });

{
  const add = (kind: GruntKind) => (GRUNTS as GruntKind[]).push(kind);
  // ---- Dust Sea: the Salt Court, the Stitched Grafters, the Iron Wardens ----
  add({ id: 'tribunal-guard-shield', name: 'Tribunal Shieldbearer', series: 'Dust Sea', role: 'shield', hp: 170, speed: 4.4, radius: .48, height: 1.8, mass: 1.5, shield: true,
    moves: [SHIELD_BASH(20), CLAW(18, { name: 'Cutlass Slash', element: 'steel', clip: 'slash' })], xp: 2, score: 80, cost: 2, ichor: 'red' });
  add({ id: 'tribunal-guard-sniper', name: 'Tribunal Sharpshooter', series: 'Dust Sea', role: 'sniper', hp: 85, speed: 4.6, radius: .42, height: 1.75, mass: 1,
    moves: [SNIPE('Long Shot', 44, 'steel'), PUNCH(14, { name: 'Bayonet', maxRange: 2.2, clip: 'thrust' })], xp: 3, score: 90, cost: 2, ichor: 'red' });
  add({ id: 'graft-leaper', name: 'Graft Leaper', series: 'Dust Sea', role: 'diver', hp: 140, speed: 5.4, radius: .46, height: 1.9, mass: 1.2,
    moves: [DIVE(29, { name: 'Leaping Stomp' }), KICK(20, { name: 'Iron Kick' })], xp: 2, score: 80, cost: 2, ichor: 'red' });
  add({ id: 'graft-doctor', name: 'Graft Doctor', series: 'Dust Sea', role: 'healer', hp: 110, speed: 4.6, radius: .44, height: 1.9, mass: 1,
    moves: [MEND(.3), KICK(16, { maxRange: 2.2 })], xp: 3, score: 110, cost: 2, ichor: 'red' });
  add({ id: 'iron-bulwark', name: 'Iron Bulwark', series: 'Dust Sea', role: 'shield', hp: 200, speed: 4.2, radius: .5, height: 2, mass: 1.7, shield: true,
    moves: [SHIELD_BASH(22), CLAW(22, { name: 'Pike Thrust', element: 'steel', range: 2.3, lunge: 1.8, clip: 'thrust' })], xp: 2, score: 90, cost: 2, ichor: 'red' });
  add({ id: 'iron-chaplain', name: 'Iron Chaplain', series: 'Dust Sea', role: 'healer', hp: 120, speed: 4.4, radius: .44, height: 1.95, mass: 1,
    moves: [MEND(.32), KICK(16, { maxRange: 2.2 })], xp: 3, score: 110, cost: 2, ichor: 'red' });
  // ---- Cinder Requiem: wraiths that dive, and one that calls the rest -------------------
  add({ id: 'bat-wraith', name: 'Bat Wraith', series: 'Cinder Requiem', role: 'diver', hp: 120, speed: 6, radius: .44, height: 1.95, mass: 1,
    moves: [DIVE(30, { name: 'Dive', element: 'blood' }), CLAW(18, { element: 'blood' })], xp: 2, score: 80, cost: 2, ichor: 'black' });
  add({ id: 'wraith-caller', name: 'Wraith Caller', series: 'Cinder Requiem', role: 'summoner', hp: 130, speed: 4.6, radius: .44, height: 1.95, mass: 1,
    moves: [SUMMON(3), CLAW(16, { maxRange: 2.2 })], xp: 4, score: 130, cost: 3, ichor: 'black' });
  // ---- Last Sun: a sniper, and sprouts out of the sky ------------------------
  add({ id: 'jinlin-sniper', name: 'Tyrant Sniper', series: 'Last Sun', role: 'sniper', hp: 90, speed: 4.8, radius: .44, height: 1.85, mass: 1,
    moves: [SNIPE('Visor Shot', 46, 'ki'), PUNCH(14, { maxRange: 2.2 })], xp: 3, score: 95, cost: 2, ichor: 'purple' });
  add({ id: 'cinder-imp-diver', name: 'Leaping Cinder Imp', series: 'Last Sun', role: 'diver', hp: 80, speed: 6.6, radius: .38, height: 1.35, mass: .8,
    moves: [DIVE(27, { name: 'Foxfire Pounce' }), CLAW(16, { name: 'Acid Claw' })], xp: 2, score: 75, cost: 2, ichor: 'green' });
  // ---- Ashwood: a mender, and a caller of Pale Saplings ----------------------------
  add({ id: 'cutthroat-mender', name: 'Cutthroat Mender', series: 'Ashwood', role: 'healer', hp: 100, speed: 5.6, radius: .42, height: 1.78, mass: .9,
    moves: [MEND(.3), KICK(16, { maxRange: 2.2 })], xp: 3, score: 110, cost: 2, ichor: 'red' });
  add({ id: 'cutthroat-caller', name: 'Cutthroat Caller', series: 'Ashwood', role: 'summoner', hp: 110, speed: 5.2, radius: .42, height: 1.78, mass: .9,
    moves: [SUMMON(3), KICK(16, { maxRange: 2.2 })], xp: 4, score: 130, cost: 3, ichor: 'red' });
  // ---- The Rift's own: husks that fall on you, and a priest that calls them -----------
  add({ id: 'husk-diver', name: 'Falling Husk', series: 'The Rift', role: 'diver', hp: 95, speed: 6.2, radius: .42, height: 1.8, mass: .9,
    moves: [DIVE(29, { element: 'dark' }), CLAW(16, { element: 'dark' })], xp: 2, score: 70, cost: 2, ichor: 'black' });
  add({ id: 'husk-priest', name: 'Husk Priest', series: 'The Rift', role: 'summoner', hp: 120, speed: 4.6, radius: .42, height: 1.8, mass: .9,
    moves: [SUMMON(3), CLAW(14, { element: 'dark', maxRange: 2.2 })], xp: 4, score: 120, cost: 3, ichor: 'black' });
}

/** The kinds' old ids, renamed; old id -> new. No save holds a grunt id (progress keys the codex by boss, and the wire sends a
 *  kind's index), but an old id still reads through these: a `?kinds=` probe or link, an escort table of an older server, an
 *  event's enemy id from a server a deploy behind the client. */
export const GRUNT_ALIASES: Readonly<Record<string, string>> = {
  'beast-pirate': 'graft-raider', 'beast-graft-brute': 'graft-brute', 'beast-leaper': 'graft-leaper', 'beast-medic': 'graft-doctor',
  'chess-soldier': 'iron-warden', 'chess-rook': 'iron-bulwark', 'chess-bishop': 'iron-chaplain',
  saibaman: 'cinder-imp', 'saibaman-diver': 'cinder-imp-diver', 'white-pale-sapling': 'pale-sapling',
  'rogue-ninja': 'cutthroat', 'medic-ninja': 'cutthroat-mender', 'summoner-ninja': 'cutthroat-caller',
  'hollow-void-ray': 'ash-caster', 'hollow-diver': 'bat-wraith', 'hollow-caller': 'wraith-caller', 'apostle-spawn': 'rift-spawn',
};
export const canonicalGrunt = (id: string) => GRUNT_ALIASES[id] ?? id;
export const GRUNT_INDEX = new Map(GRUNTS.map((kind, i) => [kind.id, i] as const));
for (const [old, id] of Object.entries(GRUNT_ALIASES)) { const i = GRUNT_INDEX.get(id); if (i !== undefined) GRUNT_INDEX.set(old, i); }
/** Each new kind's body: whose model it wears. */
export const WEARS: Record<string, string> = {
  'tribunal-guard-shield': 'tribunal-guard', 'tribunal-guard-sniper': 'tribunal-guard-rifle', 'graft-leaper': 'graft-raider', 'graft-doctor': 'graft-raider', 'iron-bulwark': 'iron-warden', 'iron-chaplain': 'iron-warden',
  'bat-wraith': 'ash-wraith', 'wraith-caller': 'ash-caster', 'jinlin-sniper': 'jinlin-soldier', 'cinder-imp-diver': 'cinder-imp', 'cutthroat-mender': 'cutthroat', 'cutthroat-caller': 'cutthroat',
  'husk-diver': 'husk', 'husk-priest': 'husk',
};
export function gruntKind(id: string): GruntKind {
  const index = GRUNT_INDEX.get(canonicalGrunt(id));
  if (index === undefined) throw new Error(`Unknown grunt kind ${id}`);
  return GRUNTS[index];
}
