import type { FighterId } from './types';
import type { ComboRow } from './combos';

export const blast = (range: number, speed = 32) => ({ style: 'projectile' as const, range, speed, radius: 1, lunge: 0 });
export const snare = (range: number, radius = 1.6) => ({ style: 'field' as const, range, radius, lunge: 0 });
export const smash = (radius: number) => ({ radius });

export const SHOP_COMBOS: Partial<Record<FighterId, ComboRow>> = {
  gorai: {
    lh: { name: 'Rivet Ram', range: 3.2 },
    // His human form fights with the club: Torsion and Wyrm Breath are his dragon's.
    // The launcher is Quake Stamp, the stamp and the club slammed down; the stun his roar.
    llh: { name: 'Quake Stamp', radius: 1.3 },
    lllh: { name: 'Thunderclap Spar', range: 3.2 },
    llls: { name: 'Great Roar', ...snare(5, 1.7) },
    airHeavy: { name: 'Drunken Skyfall', range: 3 },
    airSpecial: { name: 'Cloudbank Dive', ...smash(4.2) },
    // The half-wyrm he wakes into breathes fire (its own Grog Gale take throws it).
    awakened: { llls: { name: 'Wyrm Breath', ...snare(5, 1.7) } },
  },
  haldor: {
    lh: { name: 'Ivory Sweep', range: 3 },
    llh: { name: 'Glaive Gale', range: 3.2 },
    lllh: { name: 'Aftershock' },
    llls: { name: 'Crown Cracker' },
    airHeavy: { name: 'Leaping Glaive Chop', range: 3 },
    airSpecial: { name: 'Tremor Stomp', ...smash(4.4) },
  },
  sorrel: {
    lh: { name: 'Red Clash' },
    llh: { name: 'Maelstrom Edge' },
    lllh: { name: 'Storm-Edge Chop' },
    llls: { name: 'Dead Calm Glare', ...snare(5, 1.9) },
    airHeavy: { name: 'Falling Wake' },
    airSpecial: { name: 'Red Tide Ambush', ...smash(3.8) },
  },
  dorado: {
    lh: { name: 'Squall Cut' },
    llh: { name: 'Sunburst Blow', ...snare(4, 1.3) },
    lllh: { name: 'Bonfire Crown' },
    llls: { name: "Crown Clash" },
    airHeavy: { name: 'Diving Gilded Cut' },
    airSpecial: { name: 'Horizon Slam', ...smash(3.8) },
  },
  shiun: {
    lh: { name: 'Storm Psalm', ...blast(10, 34) },
    llh: { name: 'Wailing Choir', ...snare(6, 1.5) },
    lllh: { name: 'Rending Downbeat' },
    llls: { name: 'Crushing Presence', ...snare(4.5, 2.2) },
    airHeavy: { name: 'Falling Cadence' },
    airSpecial: { name: 'Fortissimo', ...smash(3.6) },
  },
  magatsu: {
    lh: { name: 'Dark Spark' },
    llh: { name: 'Heaven Toss' },
    lllh: { name: 'Palm-and-Heel Crush' },
    llls: { name: 'Storm Bolt Hex', ...snare(7, 1.6) },
    airHeavy: { name: 'Guillotine Kick' },
    airSpecial: { name: 'Ground Fracture', ...smash(3.8) },
  },
  vesper: {
    lh: { name: 'Feint and Return' },
    llh: { name: 'Climbing Cut' },
    lllh: { name: 'Wing Lock' },
    llls: { name: 'Pommel Peck' },
    airHeavy: { name: 'Perch Cut' },
    // The Hawk's own dive, from the special it was (the special is now his spear, thrown: moves.ts).
    airSpecial: { name: 'Raven Dive' },
    // Black Vespers's powers are Black Vespers's: the gravity that crushed Gaunt where he stood, the force that throws back without moving him.
    awakened: { llls: { name: 'Grave Pull', ...snare(6, 1.8) }, airSpecial: { name: 'Black Gust', ...smash(4.2) } },
  },
  imago: {
    lh: { name: 'Shell Splitter' },
    llh: { name: 'Barb Flick', range: 2.8 },
    lllh: { name: 'Reaping Chop' },
    llls: { name: 'Nape Sting', lunge: 9 },
    airHeavy: { name: 'Swarm Leap' },
    // His spinning leap, from the special it was (the special is now Hive Burst: moves.ts).
    airSpecial: { name: 'Stinger Storm' },
    // Reborn with wings.
    awakened: { airSpecial: { name: 'Elytra Dive', ...smash(4) } },
  },
  'wuming': {
    lh: { name: 'Seed Orb', ...blast(8, 30) },
    llh: { name: 'Lotus Breath', ...snare(5, 1.4) },
    lllh: { name: 'Judgment Slam' },
    llls: { name: 'Lotus Shackle', ...blast(12, 26) },
    airHeavy: { name: 'Heavenfall Kick', lunge: 6 },
    airSpecial: { name: 'Lotus Shockwave', ...smash(4) },
  },
  banjaku: {
    lh: { name: 'Boulder Charge', lunge: 9 },
    llh: { name: 'Stone Cyclone' },
    lllh: { name: 'Bedrock Smash' },
    llls: { name: 'Seal Counter', ...snare(5, 1.7) },
    airHeavy: { name: 'Pillar Punch' },
    airSpecial: { name: 'Seal Burst', ...smash(4.2) },
  },
  'jinlin': {
    lh: { name: 'Dragon-Gate Strike', lunge: 9 },
    llh: { name: 'Mire Pearl', ...snare(7, 1.4) },
    lllh: { name: 'Pearl Prison', ...snare(6, 1.4) },
    llls: { name: 'Tide Cage', ...snare(6, 1.6) },
    airHeavy: { name: 'Double Axe Handle' },
    airSpecial: { name: 'Seabed Breaker', ...smash(4) },
  },
  'gohaku': {
    lh: { name: 'Thunder Brush Kick' },
    llh: { name: 'White Ape Uppercut' },
    lllh: { name: 'Falling Kick Flurry' },
    llls: { name: 'Core Strike', lunge: 9 },
    airHeavy: { name: 'Star Pellet', ...blast(10, 28) },
    airSpecial: { name: 'Star-Shaking Wave', ...smash(4.2) },
  },
  ippon: {
    lh: { name: 'Nod-Off Headbutt' },
    llh: { name: 'Overtime Mop-Up', radius: 1.5 },
    lllh: { name: 'Pest Control' },
    llls: { name: 'Coffee-Run Shuffle', radius: 1.8 },
    airHeavy: { name: 'Lunch-Break Chop' },
    airSpecial: { name: 'Crater Drop', ...smash(4) },
  },
  sekka: {
    lh: { name: 'Hail Flurry' },
    llh: { name: 'Thousand Snowdrifts' },
    lllh: { name: 'Ten Thousand Icicles' },
    llls: { name: 'Aurora Shards', ...snare(5, 1.8) },
    airHeavy: { name: 'Diving Punch' },
    airSpecial: { name: 'Permafrost Stomp', ...smash(3.8) },
  },
  tobari: {
    lh: { name: 'Guardian Fist', range: 3 },
    llh: { name: 'Feather Clone Burst', ...snare(4, 1.6) },
    lllh: { name: 'Feather Feint' },
    llls: { name: 'Crimson Thorns', ...snare(6, 1.5) },
    airHeavy: { name: 'Ember Quills', ...blast(9, 30) },
    airSpecial: { name: 'Pyre Crow', ...smash(3.8) },
  },
  akagane: {
    lh: { name: 'War Fan Gale', range: 3 },
    llh: { name: 'Guardian Fist', range: 3.2 },
    lllh: { name: 'Grave Shade: Unseen Host', ...snare(4, 1.4) },
    llls: { name: 'Copper Thicket', ...snare(6, 2.2) },
    airHeavy: { name: 'War Fan Crash', range: 2.8 },
    airSpecial: { name: 'Ash Inferno', ...smash(4.2) },
  },
  asahi: {
    lh: { name: 'Wickpoint Thrust', lunge: 8 },
    llh: { name: 'Marigold Thrust' },
    lllh: { name: 'Ember Dance' },
    llls: { name: 'Stubborn Headbutt' },
    // His Water Wheel, from the heavy it was (the heavy is now the sword thrown: moves.ts) - a forward somersault cut.
    airHeavy: { name: 'Cartwheel Cut' },
    airSpecial: { name: 'Undertow Dive', ...smash(3.8) },
  },
  levin: {
    // His Crosshatch, from the heavy it was (the heavy is now the fuse lance: moves.ts).
    lh: { name: 'Crosshatch' },
    llh: { name: 'Cobweb' },
    lllh: { name: 'Baseboard' },
    llls: { name: 'Grit' },
    airHeavy: { name: 'Top Shelf' },
    airSpecial: { name: 'Plumb Line', ...smash(3.4) },
  },
  'rook': {
    lh: { name: 'Carrion Cut' },
    llh: { name: 'Pommel Uppercut' },
    lllh: { name: 'Rook\'s Heel' },
    llls: { name: 'Dread of the Dead', ...snare(5, 2) },
    airHeavy: { name: 'Talon Volley', ...blast(9, 34) },
    airSpecial: { name: "Gravefield", ...smash(4) },
  },
  gaku: {
    lh: { name: 'Big Shove' },
    llh: { name: 'Slab Flip', radius: 1.4 },
    lllh: { name: 'Stalemate Fist' },
    llls: { name: 'Chin Buster' },
    airHeavy: { name: 'Lure Lash', range: 3.2 },
    airSpecial: { name: 'Lion\'s Roar', ...smash(3.8) },
  },
};
