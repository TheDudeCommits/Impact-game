import type { FighterId } from '../game/types';

export const LOCK_NAMES: Partial<Record<FighterId, Record<string, string>>> = {
  // VOL.1's hand-picked second rounds (LOCK_ROUND_TWO).
  taisei: { 'Meteor Elbow': 'Skyfall Elbow', 'Cross Strike': 'Rooftop Cross', 'Straight Palm': 'Riot Straight' },
  konta: { 'Clone Hook': 'Twin Clone Hook', 'Whirlwind Kick': 'Pinwheel Kick' },
  gummy: { 'Rubber Jab': 'Whitecap Jab', 'Rubber Hook': 'Crosscurrent Hook' },
  nigo: { 'Rising HAIZAN': 'Rising Haizan', 'Return Cut': 'Return Cleave', 'HAIZAN Cleave': 'Haizan Cleave' },
  ouga: { 'Elbow Palm': 'Crown Palm', 'Rising Kick': 'Royal Rising Kick', 'Ki Volley': 'Crown Volley' },
  shiden: { 'Slash Palm': 'Talon Palm', 'Rising Slash': 'Rising Habakiri', 'Plunging Cut': 'Stooping Cut' },
  // The nine with no take to spare: strikes borrowed from another fighter (LOCK_ROUND_BORROW).
  jirenga: { 'Pride Elbow': 'Bedrock Elbow', 'Power Palm': 'Pillar Palm', 'Justice Backfist': 'Guardian Backfist' },
  'gohaku': { 'Beast Straight': 'Long-Arm Straight', 'Beast Hook': 'Long-Arm Hook', 'Beast Rising Kick': 'White Ape Rising Kick' },
  'jinlin': { 'Golden Elbow': "Emperor's Elbow", 'Golden Tail Sweep': 'Carp Tail Sweep', 'Golden Hammer': 'Dragon-Gate Hammer' },
  'wuming': { 'Black Cross': 'Dusk Cross', 'Black Rising Kick': 'Dusk Rising Kick', 'Black Palm': 'Lotus Palm' },
  gaku: { 'Stray Cross': 'Scav Cross', 'Hunter Sweep': 'Scav Sweep' },
  tobari: { 'Crow Scrap Kunai': 'Crow Quill Strike', 'Crow Clan Rising Slash': 'Rookwing Rising Slash', 'Kunai Palm': 'Quill Palm' },
  akagane: { 'WAR FAN Rising Swing': 'War Fan Rising Swing', 'Crow Clan Elbow': 'Warlord Elbow', 'Crow Clan Sweep': 'Warlord Sweep' },
  shiun: { 'Crossing Cadence': 'Crossing Cadence', 'ASHSTEP Rising Reap': 'Rising Crescendo', 'Hymn Palm Cut': 'Hymn Palm Cut' },
  'rook': { 'Shadow Slash': 'Raven Slash', 'Shadow Reverse Quill': 'Raven Reverse Quill' },
  // The eight with one or two to spare: the stages lockRoundFill.ts leaves empty.
  hawser: { 'Rising Billet': 'Rising Fray' },
  shirokane: { 'Hailstone Palm': 'Static Palm' },
  vesper: { 'Hawk Rising Cross': 'Raven Rising Cross', 'Falcon Crossing Cut': 'Quill Crossing Cut' },
  imago: { 'Royal Tail Sweep': 'Stinger Sweep', 'Royal Elbow': 'Chitin Elbow' },
  sekka: { 'Destructive Cross': 'Shatter Cross', 'Rising Leg Strike': 'Sleet Rising Kick' },
  levin: { 'Spinning Blade Cut': 'Spin Cycle', 'Scout Cross Cut': 'Corner Cut' },
  // The roster's own rounds (lockRoundFill.ts) that its table had no row for.
  gaunt: { 'Aerial Cleave': 'Aerial Hack', 'Rising Swing': 'Rising Slab' },
};
