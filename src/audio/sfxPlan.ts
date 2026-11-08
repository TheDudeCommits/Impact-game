import { comboMove, type ComboKey } from '../game/combos';
import { awakeningSwapAt, moveFor, rushMove } from '../game/awakening';
import { activeWindow, type MoveDefinition } from '../game/moves';
import { barrageWindow } from '../game/timeStopBarrage';
import type { AttackSlot, CombatEvent, FighterId } from '../game/types';
import type { AudioCue, CueLayer } from './cueTypes';
import SFX_LENGTHS_JSON from './data/sfxDurations.json';
import { SFX_PEAKS } from './sfxCues';
import { UNSEALED } from './unsealedTiming';
import { planVoice } from './voicePlan';
import { POWER_SOUNDS, arrivesHeard, powerVoice } from './powerSound';
import { FAMILIES, familyOf, type FamilySound } from './sfxFamilies';
import { SIGNATURES } from './sfxSignatures';
import { mixCues, originalAreaCast, originalAreaHit, originalAwakening, sfxNew, swapCues } from '../originals/sfx';
import { LUCY_TIDE } from '../originals/lucyTide';

export function planSfx(event: CombatEvent, awakened = false): CueLayer[] { return mixCues(event, swapCues(event.fighter, planSfxLayers(event, awakened), event.kind === 'awaken' ? 'awaken' : event.slot)); }
function planSfxLayers(event: CombatEvent, awakened = false): CueLayer[] {
  const fighter = event.fighter, slot = event.slot;
  switch (event.kind) {
    case 'cast': return fighter && slot ? castLayers(context(event, fighter, slot, awakened)) : [];
    // (The area slot's release is its circle announced: the element in flight to it. Its strikes are 'impact' events.)
    case 'release': return fighter && slot ? slot === 'area' ? areaRelease(event, fighter, awakened) : releaseLayers(context(event, fighter, slot, awakened)) : [];
    case 'impact': return fighter && slot === 'area' ? areaStrike(event, fighter, awakened) : [];
    // Round 3d (ULTS): a hit-confirm ultimate landed - its cinematic's layers.
    case 'confirm': return fighter && slot ? confirmLayers(context(event, fighter, slot, awakened)) : [];
    case 'hit': return impactLayers(event, awakened);
    // Round 5 (PARRY): the guard's own sounds (scripts/sfx/recipes.py): a guard break is a crunch and a shatter over
    // the blow that broke it; a Perfect Parry is steel ringing off the guard with a whoosh and a low hit.
    case 'guard-break': return [
      { cue: 'fx-guard-shatter', gain: .74, phase: 'impact' },
      ...impactLayers(event, awakened).map(layer => ({ ...layer, gain: round(layer.gain * .5) }))];
    case 'blocked': return blockedLayers(event, awakened);
    case 'just-guard': return parryLayers(event, awakened);
    // Techniques (game/techniques.ts): a counter stance meeting a blow rings as a parry does.
    case 'counter': return parryLayers(event, awakened);
    case 'vanish': return [{ cue: 'fx-vanish', gain: .55, phase: 'release' }];
    case 'chase': return [{ cue: 'fx-chase', gain: .55, phase: 'release' }];
    // A blow passing through a fighter who stepped out of it.
    case 'dodge': return [{ cue: pick(FAMILY.kick, seedOf(event)), gain: .3, rate: 1.12, phase: 'release' }];
    case 'tech': return [{ cue: 'fx-tech', gain: .45, phase: 'release' }];
    case 'land': return [{ cue: 'fx-land-heavy', gain: .62, phase: 'impact' }];
    case 'wall-splat': return [{ cue: 'fx-wall-splat', gain: .75, phase: 'impact' }];
    case 'ground-bounce': return [{ cue: 'fx-ground-bounce', gain: .66, phase: 'impact' }];
    case 'break': return [{ cue: 'fx-combo-break', gain: .62, phase: 'impact' }];
    case 'projectile-clash': return clashLayers(event);
    case 'awaken': return fighter ? awakenLayers(fighter) : [];
    case 'awaken-end': return [{ cue: 'fx-awaken-end', gain: .42, phase: 'release' }];
    default: return [];
  }
}

// ---------------------------------------------------------------- families

/** Interchangeable takes of one sound. */
export const FAMILY = {
  jab: ['fx-swing-jab-1', 'fx-swing-jab-2', 'fx-swing-jab-3', 'fx-swing-jab-4'],
  kick: ['fx-swing-kick-1', 'fx-swing-kick-2', 'fx-swing-kick-3'],
  heavy: ['fx-swing-heavy-1', 'fx-swing-heavy-2'],
  hitLight: ['fx-hit-light-1', 'fx-hit-light-2', 'fx-hit-light-3', 'fx-hit-light-4'],
  hitHeavy: ['fx-hit-heavy-1', 'fx-hit-heavy-2', 'fx-hit-heavy-3'],
  hitKick: ['fx-hit-kick-1', 'fx-hit-kick-2', 'fx-hit-kick-3'],
  finisher: ['fx-hit-finisher-1', 'fx-hit-finisher-2'],
  barrage: ['fx-hit-barrage-1', 'fx-hit-barrage-2', 'fx-hit-barrage-3', 'fx-hit-barrage-4'],
  katana: ['fx-slash-katana-1', 'fx-slash-katana-2', 'fx-slash-katana-3'],
  cleaver: ['fx-slash-cleaver-1', 'fx-slash-cleaver-2'],
  nodachi: ['fx-slash-nodachi-1', 'fx-slash-nodachi-2'],
  gravedigger: ['fx-slash-gravedigger-1', 'fx-slash-gravedigger-2'],
  kunai: ['fx-slash-kunai-1', 'fx-slash-kunai-2'],
  claw: ['fx-claw-1', 'fx-claw-2'],
  cut: ['fx-cut-1', 'fx-cut-2', 'fx-cut-3'],
  cutHeavy: ['fx-cut-heavy-1', 'fx-cut-heavy-2'],
  kiBlast: ['fx-ki-blast-1', 'fx-ki-blast-2', 'fx-ki-blast-3'],
  explosion: ['fx-explosion-1', 'fx-explosion-2'],
  energyHit: ['fx-energy-hit-1', 'fx-energy-hit-2'],
  fireWhoosh: ['fx-fire-whoosh-1', 'fx-fire-whoosh-2'],
  burn: ['fx-burn-tick-1', 'fx-burn-tick-2'],
  zap: ['fx-zap-1', 'fx-zap-2', 'fx-zap-3'],
  clockHandKnives: ['fx-clock-hand-knives-1', 'fx-clock-hand-knives-2'],
  knifeHit: ['fx-knife-hit-1', 'fx-knife-hit-2'],
  stretch: ['fx-stretch-1', 'fx-stretch-2'],
  snap: ['fx-snap-1', 'fx-snap-2'],
  armour: ['fx-armour-1', 'fx-armour-2'],
  beastSwipe: ['fx-beast-swipe-1', 'fx-beast-swipe-2'],
  block: ['fx-block-1', 'fx-block-2'],
  poof: ['fx-poof-1', 'fx-poof-2'],
  zip: ['fx-zip-1', 'fx-zip-2'],
} as const satisfies Record<string, readonly AudioCue[]>;
type Family = readonly AudioCue[];

// ---------------------------------------------------------------- the roster's blows

/** What a melee blow is, for its swing and its landing. */
type Blow = 'fist' | 'kick' | 'axe' | 'blade' | 'rubber' | 'spirit' | 'beast';
/** The blade each armed fighter swings. Shirokane's is a kunai; Setsu's claws
 *  are aura-sharpened nails and swing like a blade. */
const BLADE: Partial<Record<FighterId, Family>> = {
  chohan:FAMILY.kunai,
  aqrab:FAMILY.kunai,
  ume:FAMILY.jab,
  lanthorn:FAMILY.katana,
  highsun:FAMILY.cleaver,
  torsion:FAMILY.jab,
  kubiwa:FAMILY.jab,
  onigawara:FAMILY.cleaver,
  cardo:FAMILY.cleaver,
  minase:FAMILY.jab,
  aquilo:FAMILY.jab,
  'psyche':FAMILY.hitLight,
  'ovid':FAMILY.armour,
  hawser:FAMILY.katana,
  rotfalke:FAMILY.armour,
  bonsho:FAMILY.jab,
  murex:FAMILY.armour,
  kinu:FAMILY.jab,
  'madake':FAMILY.jab,
  akayuri:FAMILY.katana,
  hagure:FAMILY.jab,
  hisame:FAMILY.kunai,
  svanhild:FAMILY.kunai,
  mizuhiki:FAMILY.katana,
  'shibuichi':FAMILY.armour,
  'rakucho':FAMILY.beastSwipe,
  irbis:FAMILY.jab,
  shidare:FAMILY.katana,
  yodaka:FAMILY.katana,
  hinomoto:FAMILY.katana,
  amagoi:FAMILY.kunai,
  'shakudo':FAMILY.jab,
  hikui:FAMILY.katana,
  tokan:FAMILY.katana,
  strappado:FAMILY.kunai,
  unari:FAMILY.kunai,
  shijima:FAMILY.katana,
  akaito:FAMILY.katana,
  kuzu: ['fx-kuzu-saw-1','fx-kuzu-saw-2'],
  strix: FAMILY.gravedigger,
  kenzo: FAMILY.katana, shiden: FAMILY.katana, nigo: FAMILY.cleaver, ward: FAMILY.nodachi,
  gaunt: FAMILY.gravedigger, shirokane: FAMILY.kunai, setsu: FAMILY.claw,
  // The shop's fighters: the bisento swings like the GRAVEDIGGER, Sorrel's sabre and Kagari like katanas.
  haldor: FAMILY.gravedigger, sorrel: FAMILY.katana, dorado: FAMILY.katana,
  // Shiun's flash step cuts with the wing blades; Magatsu's hands cut as blades do; Vesper's sabre is a katana's weight.
  shiun: FAMILY.katana, magatsu: FAMILY.katana, vesper: FAMILY.katana,
  // Tobari's kunai, as Shirokane's.
  tobari: FAMILY.kunai,
  // Asahi's Sunsteel katana and Levin's blades swing as katanas; Rook's daggers as kunai.
  asahi: FAMILY.katana, levin: FAMILY.katana, 'rook': FAMILY.kunai,
};
/** A form that fights as another body (the YUGE, where Scout Hawser swings the regiment's blades): what its blows
 *  are. The Colossus's are adult Hawser's rows, as they were. */
const FORM_BLADE: Partial<Record<FighterId, Family>> = { hawser: FAMILY.armour };
const FORM_STAGES: Partial<Record<FighterId, readonly [Blow, Blow, Blow, Blow]>> = { hawser: ['fist', 'fist', 'fist', 'fist'] };
const bladeOf = (c: Ctx): Family | undefined => (c.awakened ? FORM_BLADE[c.fighter] : undefined) ?? BLADE[c.fighter];
/** The light (stage 0) and the three rush stages, as the clips throw them
 *  (scripts/rush_assemble.py): who kicks, who punches, who cuts. */
const STAGES: Record<FighterId, readonly [Blow, Blow, Blow, Blow]> = {
  chohan:['blade','kick','blade','blade'],
  tsubute:['fist','fist','kick','fist'],
  aqrab:['blade','blade','fist','blade'],
  ume:["fist","fist","fist","fist"],
  lanthorn:['blade','blade','fist','blade'],
  highsun:['axe','axe','fist','fist'],
  torsion:['fist','fist','fist','fist'],
  kubiwa:['fist','fist','fist','fist'],
  onigawara:['blade','blade','blade','blade'],
  cardo:['blade','blade','blade','blade'],
  minase:['blade','fist','blade','fist'],
  aquilo:['blade','fist','blade','fist'],
  'psyche':['fist','fist','fist','fist'],
  'ovid':['fist','fist','fist','fist'],
  hawser:['blade','blade','kick','blade'],
  rotfalke:['blade','fist','fist','blade'],
  bonsho:['fist','fist','fist','fist'],
  murex:['fist','fist','fist','fist'],
  kinu:['spirit','spirit','spirit','spirit'],
  'madake':['fist','kick','fist','kick'],
  akayuri:['blade','blade','blade','blade'],
  hagure:['fist','fist','fist','fist'],
  hisame:['blade','blade','fist','blade'],
  svanhild:['blade','blade','fist','blade'],
  mizuhiki:['blade','blade','blade','blade'],
  'shibuichi':['fist','fist','fist','fist'],
  'rakucho':['fist','beast','beast','beast'],
  irbis:['fist','beast','fist','beast'],
  shidare:['blade','blade','blade','blade'],
  yodaka:['blade','blade','blade','blade'],
  hinomoto:['blade','blade','blade','blade'],
  amagoi:['blade','blade','fist','blade'],
  'shakudo':['fist','blade','fist','fist'],
  hikui:["blade","blade","blade","blade"],
  tokan:['blade','kick','fist','fist'],
  strappado:['blade','kick','blade','blade'],
  unari:['blade','blade','blade','fist'],
  barrow:['fist','fist','fist','fist'],
  sashigane:['blade','blade','blade','blade'],gosu:['spirit','spirit','spirit','spirit'],
  kusushi:['fist','fist','fist','kick'],hakushi:['fist','fist','fist','fist'],
  suzuran:['fist','fist','fist','fist'],wataame:['axe','axe','axe','axe'],bruin:['axe','axe','axe','axe'],
  senko:['kick','kick','kick','kick'],buna:['axe','axe','axe','axe'],
  oyashio:['fist','fist','fist','fist'],adad:['axe','axe','axe','axe'],
  shijima:['blade','blade','blade','blade'],
  akaito:['blade','blade','blade','blade'],
  tempo:['fist','fist','fist','fist'],
  tancho:['fist','fist','fist','fist'],bellows:['fist','fist','fist','fist'],mikage:['fist','fist','fist','fist'],
  'full-beam': ['fist','fist','fist','axe'],
  pyroclast: ['fist','fist','fist','fist'],
  ampere: ['fist','kick','fist','fist'],
  shanxiao: ['fist','fist','fist','fist'],
  kuzu: ['blade','blade','blade','blade'],
  shakugo: ['fist','fist','fist','axe'],
  'basilissa': ['kick', 'kick', 'kick', 'kick'],
  sorayomi: ['axe','axe','axe','axe'],
  strix: ['blade','blade','blade','blade'],
  taisei: ['fist', 'fist', 'fist', 'axe'],
  // The feel pass: the re-posed rush stages land as what they are now (scripts/fanim/lights.py) - Ouga's
  // knee, Crown Elbow and Double Axe Handle; Taisei's Paper; Konta's Twin Clone Upper; Shiden's Hawk Combo heel drop;
  // Kagari's Rekka; Kuon's pointed Nova; Setsu's last kick.
  ouga: ['fist', 'kick', 'fist', 'axe'],
  konta: ['fist', 'fist', 'fist', 'kick'],
  shiden: ['blade', 'blade', 'blade', 'kick'],
  shirokane: ['blade', 'blade', 'kick', 'kick'],
  gummy: ['rubber', 'kick', 'rubber', 'rubber'],
  kenzo: ['blade', 'blade', 'blade', 'blade'],
  kosho: ['kick', 'kick', 'kick', 'kick'],
  kagari: ['fist', 'fist', 'fist', 'fist'],
  ward: ['blade', 'blade', 'blade', 'blade'],
  koko: ['spirit', 'spirit', 'spirit', 'spirit'],
  oro: ['spirit', 'spirit', 'kick', 'kick'],
  nigo: ['blade', 'blade', 'blade', 'blade'],
  kuon: ['fist', 'fist', 'kick', 'fist'],
  gaunt: ['blade', 'blade', 'blade', 'blade'],
  setsu: ['blade', 'blade', 'kick', 'kick'],
  // Gorai's mast-breaker is blunt: every blow lands like an axe handle.
  gorai: ['axe', 'axe', 'axe', 'axe'],
  haldor: ['blade', 'blade', 'blade', 'fist'],
  sorrel: ['blade', 'blade', 'blade', 'blade'],
  dorado: ['blade', 'blade', 'blade', 'blade'],
  shiun: ['fist', 'fist', 'blade', 'fist'],
  magatsu: ['blade', 'blade', 'blade', 'fist'],
  vesper: ['blade', 'blade', 'blade', 'blade'],
  imago: ['beast', 'fist', 'kick', 'beast'],
  // Wuming's string is a punch, a spinning kick and the flying kick that throws them up.
  'wuming': ['fist', 'fist', 'kick', 'kick'],
  // Jirenga's: the one-two, the hook, the flurry and the heel brought down. Jinlin's: the finger, then his tail and his hand.
  jirenga: ['fist', 'fist', 'fist', 'kick'],
  'jinlin': ['fist', 'beast', 'fist', 'beast'],
  // Gohaku's: the punch, the jab, the flying kick, and both fists brought down.
  'gohaku': ['fist', 'fist', 'kick', 'fist'],
  // Ippon's: the plain punch, the jab, the hook, and the knee into a kick.
  ippon: ['fist', 'fist', 'fist', 'kick'],
  // Sekka's: the air struck, the jab, and two kicks.
  sekka: ['fist', 'fist', 'kick', 'kick'],
  // Tobari's: the kunai drawn across, its cut, the flying kick, and the blow that lifts them.
  tobari: ['blade', 'blade', 'kick', 'fist'],
  // Akagane's: the war fan (blunt, as the mast-breaker), the jab, the kick, the rising blow. Asahi's: all the katana. Levin's:
  // the blades, and a kick. Rook's: the daggers, a kick, the rising blow.
  akagane: ['axe', 'fist', 'kick', 'fist'],
  asahi: ['blade', 'blade', 'blade', 'blade'],
  levin: ['blade', 'blade', 'kick', 'blade'],
  'rook': ['blade', 'blade', 'kick', 'fist'],
  // Gaku's: the Landslide's fist and his jab, the kick, the rising paw.
  gaku: ['fist', 'fist', 'kick', 'fist'],
};
/** The air normals the simulation announces as kicks (AIR_NORMAL_FIGHTERS). */
const AIR_KICKS = new Set(['Knee Hitch', 'Kick Loose', 'Drop Knot', 'Falling Kick']);
/** Round 3b: the seven fighters' own air strings (AIR_RUSH in moves.ts), by
 *  what Fighter's AIR_STRING_CLIPS draws for each stage - the rush stage table
 *  would have Konta's air kicks sound like punches and Taisei's punches like a
 *  kick. Stage 0 keeps the light's own name, and its own sound. */
export const AIR_BLOWS: Readonly<Record<string, string>> = {
  'Rising Tooth':'blade','Air Backtooth':'blade','Falling Dovetail':'blade',
  'Fissure Uppercut':'fist','Aerial Cinder Backfist':'fist','Slag Descent':'axe',
  'Thornrise Heel': 'kick', 'Petal Air Kick': 'kick', 'Crown Heel Drop': 'kick',
  'Rising Vane': 'axe', 'Aerial Staff Reverse Quill': 'axe', 'Descending Vane': 'axe',
  'Vigil Ascent': 'blade', 'Aerial Reverse Quill': 'blade', 'Descending Wing': 'blade',
  'Gust Strike': 'kick', 'Twin Knee': 'kick', 'Pack Flurry': 'kick',
  'Ghost Step Strike': 'fist', 'Wreckfall Crash': 'fist',
  'Shikou Palm': 'fist', 'Iron Sledge': 'axe',
  'Spindrift Jab': 'rubber', 'Whitecap Punch': 'rubber',
  'Fouette': 'kick', 'Mille-Feuille': 'kick',
  'Rivet Breaker': 'spirit', 'Gan Gan! Rush': 'spirit',
  'Kneel! Kneel!': 'spirit', 'Clockwork Kick': 'kick',
  // Round 4b (COMBAT): every Vol.1 fighter's air string, stage 0 included (its own blow now, never the jab's).
  'Flying Kick': 'kick', 'Sky Elbow': 'fist', 'Breakwater Slam': 'rubber', 'Emince': 'kick',
  'Flying Side Kick': 'kick', 'Snap Kick': 'kick', 'Somersault Kick': 'kick',
  // Shiden's third is the heel drop now (Rush 3's clip); 'Spinning Cut' is the name a server built before it sends.
  'Aerial Slash': 'blade', 'Falling Cut': 'blade', 'Rook\'s Heel': 'kick', 'Spinning Cut': 'kick',
  'Eagle Swoop': 'blade', 'Talon Cross': 'blade', 'Dune Leap': 'blade',
  'Rivet Hook': 'spirit', 'Falling Iron': 'spirit',
  // (Nigo's first air blow shares Gaunt's name, 'Aerial Cleave', since the clean pass: it sounds as his, below.)
  'Backhand Cleave': 'blade', 'Overhead Cleave': 'blade',
  'Rising Ember': 'fist', 'Ember Hook': 'fist', 'Falling Ember': 'fist',
  'Vaulting Lancet': 'blade', 'Lancet Sweep': 'blade', 'Lancet Drop': 'blade',
  'Sky Hex': 'fist', 'Zenith Kick': 'kick', 'Gravity Dive': 'fist',
  'Midnight Straight': 'spirit',
  'Aerial Cleave': 'axe', 'Rising Swing': 'axe', 'Falling Chop': 'axe',
  'Sleet Kick': 'kick', 'Snow Swipe': 'fist', 'Flurry Flip': 'kick',
};

interface Ctx {
  event: CombatEvent; fighter: FighterId; slot: AttackSlot; stage: number;
  move: MoveDefinition; awakened: boolean; seed: number; air: boolean;
}

function context(event: CombatEvent, fighter: FighterId, slot: AttackSlot, awakened: boolean): Ctx {
  const stage = slot === 'light' ? event.chain ?? 0 : 0;
  // A combo ender (game/combos.ts) is heard as the blow it is, never as its slot's signature move.
  const ender = event.branch ? comboMove(fighter, event.branch, awakened) : undefined;
  const move = ender ?? (slot === 'light' && stage > 0 ? rushMove(fighter, stage, awakened) : moveFor(fighter, slot, awakened));
  return { event, fighter, slot, stage, move, awakened, seed: seedOf(event), air: AIR_KICKS.has(event.move ?? '') };
}

// ---------------------------------------------------------------- casts

function castLayers(c: Ctx): CueLayer[] {
  // A ground smash is a rush of air as it drops; its landing is its release (releaseLayers).
  if (c.event.branch === 'airSpecial') return [{ cue: pick(FAMILY.heavy, c.seed), gain: .46, delay: .08, phase: 'cast', rate: .82 }];
  const special = c.event.branch ? ENDER_CASTS[c.fighter]?.[c.event.branch] : SIGNATURE_CASTS[c.fighter]?.[c.slot];
  // The area slot gathers in its own element (launch day 5); a cast authored for it (Yodaka's Fire Owl) is as it was.
  if (c.slot === 'area' && !special) return [...areaCast(c), ...originalAreaCast(c.fighter).map(([cue, gain]) => onBeat(cue as AudioCue, gain, c0(c) ?? 0, 'cast'))];
  const layers = special ? special(c) : c.move.style === 'melee' ? meleeSwings(c) : energyCast(c);
  return [...layers, ...awakenedCast(c), ...familyCast(c, layers), ...signatureCast(c), ...ultimateOpener(c)];
}

/** (15 October, the feel pass) What the 60 newer fighters' ultimates open with, over their own cast. Each opened on a
 *  single swing (one `fx-swing-heavy` or the slot's whoosh: -29 to -23 LUFS) where every one of the sixteen originals'
 *  layers two or three - a charge under it, the huge whoosh on the blow (-21 and up; s15 feel audit). The move's own
 *  layers stay its sound; these are its weight. On the cast phase: a cast cut short stops them. Not a combo ender. */
const hugeOn = (c: Ctx, gain = .4) => onBeat('fx-swing-huge', gain, c0(c) + .02);
const ULTIMATE_OPENERS: Partial<Record<FighterId, (c: Ctx) => CueLayer[]>> = {
  // The blast he rides in on, then the Supervolcano's spin.
  pyroclast: c => [onBeat('fx-fire-burst', .32, Math.max(.06, c0(c) - .12)), hugeOn(c, .36)],
  // The Legendary's ki surging up the arm before it lands.
  shanxiao: c => [bed('fx-ki-charge-big', .2, 0, c0(c)), hugeOn(c, .46)],
  // Lightning crackling up the arm, the smash, the air it moves.
  ampere: c => [bed('fx-electric-bed', .12, 0, c0(c)), hugeOn(c, .38), onBeat('fx-wind-blast', .26, c0(c) + .03)],
  'full-beam': c => [hugeOn(c, .38), onBeat('fx-wind-blast', .26, c0(c) + .03)],
  aqrab: c => [onBeat('fx-wind-blast', .34, c0(c)), hugeOn(c, .26)],
  kuzu: c => [onBeat('fx-kuzu-rev', .34, Math.max(.06, c0(c) - .15)), hugeOn(c, .3)],
  unari: c => [hugeOn(c, .34)],
  'psyche': c => [onBeat('fx-stretch-2', .26, Math.max(.06, c0(c) - .06)), onBeat('fx-snap-2', .3, c0(c)), hugeOn(c, .3)],
  ...Object.fromEntries((['rotfalke', 'madake', 'torsion', 'hagure', 'kinu', 'wataame', 'minase', 'ovid', 'hisame', 'akayuri', 'bonsho',
    'chohan', 'strappado', 'irbis', 'murex', 'kubiwa', 'onigawara'] as const).map(id => [id, (c: Ctx) => [hugeOn(c)]])),
};
function ultimateOpener(c: Ctx): CueLayer[] { return c.slot === 'ultimate' && !c.event.branch ? ULTIMATE_OPENERS[c.fighter]?.(c) ?? [] : []; }

/** A move's own sound, where it has one a fan would know it by (sfxSignatures.ts): over its layers and its family's, its
 *  loudest moment on the move's first contact, on its teleport's vanish or reappearance, or a set time from the cast. On
 *  the cast phase: an interrupted cast stops it. Not a combo ender. */
const signatureOf = (c: Ctx) => { const row = c.event.branch || (c.slot === 'light' && c.stage > 0) ? undefined : SIGNATURES[c.fighter]?.[c.slot]; return row?.base && c.awakened ? undefined : row; };
function signatureCast(c: Ctx): CueLayer[] {
  const signature = signatureOf(c), jump = teleportOf(c.move);
  return (signature?.cast ?? []).map(([cue, gain, when, rate = 1]) =>
    onBeat(cue, gain, when === 'contact' ? c0(c) ?? 0 : when === 'vanish' ? jump?.vanish ?? 0 : when === 'appear' ? jump?.appear ?? 0 : when, 'cast', rate));
}
/** And where that move's last blow lands. */
function signatureHit(c: Ctx, final: boolean): CueLayer[] {
  const signature = final ? signatureOf(c) : undefined;
  return (signature?.hit ?? []).map(([cue, gain]) => ({ cue, gain, rate: wobble(c.seed, .04), phase: 'impact' as const }));
}

// ---------------------------------------------------------------- the element families (launch day 5)

/** How loud a family's layers are over a move's own (its swings, its authored cast, its landing): they say what the move
 *  is made of, and the move's own layers are still its weight. The area slot has no layers of its own under them. */
const FAMILY_OVER = { cast: .8, hit: .75, tail: .8 };

const takeOf = (sound: FamilySound, seed: number): AudioCue => typeof sound.cue === 'string' ? sound.cue : pick(sound.cue, seed);
/** A family layer's sounds with their loudest moment on `time` (a cast, a rush: the element arriving on a beat). */
function onTheBeat(sounds: readonly FamilySound[], seed: number, time: number, phase: CueLayer['phase'], level = 1): CueLayer[] {
  return sounds.map((sound, i) => onBeat(takeOf(sound, seed + i), sound.gain * level, time + (sound.after ?? 0), phase, sound.rate ?? 1));
}
/** A family layer's sounds starting now, `after` seconds on (a hit, a tail: what happens where it lands). A little
 *  off pitch by the event, so a move's strikes are not one sample over and over. */
function fromNow(sounds: readonly FamilySound[], seed: number, level = 1, after = 0): CueLayer[] {
  return sounds.map((sound, i) => {
    const delay = round(after + (sound.after ?? 0));
    return { cue: takeOf(sound, seed + i), gain: round(sound.gain * level), rate: round((sound.rate ?? 1) * wobble(seed + i * 13, .05)), ...(delay > 0 ? { delay } : {}), phase: 'impact' as const };
  });
}
/** Which strikes of a move of `count` are voiced by its family: all of three or fewer; of a longer barrage the first,
 *  the last and every other between. Twelve fighters can each be landing one: every strike of every barrage, with the
 *  floor's own blow and the body's under it, is more voices than the effects have (twenty), and the ear reads a barrage
 *  by its first blow, its rhythm and its last. */
const strikeVoiced = (index: number, count: number) => count <= 3 || index === 0 || index >= count - 1 || index % 2 === 0;

/** A heavy's, a special's or an ultimate's element gathering, over its own cast: its loudest moment on the first contact,
 *  and - for a move that throws something - the element leaving with it. On the cast phase, so an interrupted cast stops
 *  it. A cue the move's own layers already play is not played twice. Not a light, not a combo ender (a blow), and not a
 *  move the table leaves to its own sound. */
function familyCast(c: Ctx, own: readonly CueLayer[]): CueLayer[] {
  if (c.slot === 'light' || c.slot === 'area' || c.event.branch) return [];
  const family = familyOf(c.fighter, c.slot, c.awakened);
  if (!family) return [];
  const sounds = FAMILIES[family], first = c0(c) ?? 0;
  const layers = [...onTheBeat(sounds.cast, c.seed, first, 'cast', FAMILY_OVER.cast),
    ...(c.move.style !== 'melee' ? onTheBeat(sounds.rush, c.seed + 5, first + .05, 'cast', FAMILY_OVER.cast) : [])];
  // (Where an element's flight is its gathering played quicker - rock, the dark - one of the two on a single cast.)
  return layers.filter((layer, i) => !own.some(mine => mine.cue === layer.cue) && layers.findIndex(other => other.cue === layer.cue) === i);
}

/** The element where a heavy, a special or an ultimate lands, over the blow's own landing; and after its last blow what
 *  the element leaves (not a heavy: one blow, no aftermath). */
function familyHit(c: Ctx, index: number, final: boolean, own: readonly CueLayer[]): CueLayer[] {
  if (c.slot === 'light' || c.slot === 'area' || c.event.branch) return [];
  const family = familyOf(c.fighter, c.slot, c.awakened);
  if (!family || !strikeVoiced(index, c.move.contacts.length)) return [];
  // (A hit-confirm ultimate's cinematic: the blow that catches them and the last one. The quick blows between are its
  // rhythm, and stay as the 8 October pass left them.)
  if (c.slot === 'ultimate' && c.move.confirm && index > 0 && !final) return [];
  const sounds = FAMILIES[family];
  const layers = [...fromNow(sounds.hit, c.seed, FAMILY_OVER.hit * (final ? 1 : .6)),
    ...(final && c.slot !== 'heavy' ? fromNow(sounds.tail, c.seed + 3, FAMILY_OVER.tail, .14) : [])];
  return layers.filter(layer => !own.some(mine => mine.cue === layer.cue));
}

/** The area move (G / R2), cast: the element gathering through the wind-up, its loudest moment on the release - where
 *  every fighter had the same ki charge and `fx-fire-ignite` (ice, water and lightning caught like fire). Ki keeps its
 *  charge, as does an explosion, which has nothing to gather. */
function areaCast(c: Ctx): CueLayer[] {
  const family = familyOf(c.fighter, 'area', c.awakened), release = c0(c) ?? 0;
  const gather = family ? FAMILIES[family].cast : [];
  return [...(gather.length ? [] : [bed('fx-ki-charge', .17, 0, release)]), ...onTheBeat(gather, c.seed, release, 'cast'),
    { cue: sfxNew.sealDraw, gain: .35, phase: 'cast' as const }];
}

/** The area move released: its circle is announced and its first strike is `due` (the telegraph's end, the moment the
 *  look laid over it is timed to strike: AreaTelegraph). The element is heard in flight to it, cresting as it lands. */
function areaRelease(event: CombatEvent, fighter: FighterId, awakened = false): CueLayer[] {
  const family = familyOf(fighter, 'area', awakened);
  if (!family) return [];
  const telegraph = Math.max(.1, (event.due ?? event.serverTime + .75) - event.serverTime);
  return [...onTheBeat(FAMILIES[family].rush, seedOf(event), telegraph, 'release', .9),
    { cue: family === 'dark' ? sfxNew.sealCastDark : sfxNew.sealCast, gain: .45, phase: 'release' as const }];
}

/** One of the area move's strikes landing on its circle (an 'impact': `contactIndex` of `strikes`): the element's hit,
 *  fuller on the last, and after the last what it leaves, with the floor's blow under it by the element's weight. The
 *  look's own Armory sounds play beside these (fxStage.ts zoneCast, `sound: 'full'`: the effect's cast as it is laid and
 *  its hits on the strikes it draws), under them at the effects' voice cap. */
function areaStrike(event: CombatEvent, fighter: FighterId, awakened = false): CueLayer[] {
  const family = familyOf(fighter, 'area', awakened);
  const index = event.contactIndex ?? 0, count = Math.max(1, event.strikes ?? 1), last = index >= count - 1;
  if (!family || !strikeVoiced(index, count)) return [];
  const sounds = FAMILIES[family], seed = seedOf(event);
  return [...fromNow(sounds.hit, seed, count > 1 && !last ? .7 : 1), ...(last ? fromNow(sounds.tail, seed + 3, 1, .14) : []), ...floorBlow(sounds.weight),
    ...(last ? originalAreaHit(fighter).map(([cue, gain]) => ({ cue: cue as AudioCue, gain, rate: wobble(seed, .04), phase: 'impact' as const })) : [])];
}
/** The floor under an area move's strike: a heavy blow and a low crack, by how much weight the element has. (The page
 *  played both at full under every strike of every fighter - main.ts `areaFx.onImpact` - whatever landed; none now
 *  under a strike the family does not voice, and only a soft thud under petals.) */
function floorBlow(weight: number): CueLayer[] {
  // (The feel pass: petals have a soft thud under them - with none they were 1.5 dB under every original's area move
  // below 150 Hz - and still no crack.)
  return weight > 0 ? [{ cue: 'fx-land-heavy', gain: round(.56 * weight), rate: .8, phase: 'impact' }, { cue: 'crack', gain: round(.3 * weight), rate: .55, phase: 'impact' }]
    : [{ cue: 'fx-land-heavy', gain: .2, rate: .8, phase: 'impact' }];
}

/** A body caught by an area move's strike: the body taking it. (It was a ki zap whatever struck; the strike itself says
 *  what did - areaStrike - and ki still zaps.) */
function areaBlow(c: Ctx): CueLayer[] {
  const family = familyOf(c.fighter, 'area', c.awakened);
  return !family || family === 'ki' ? [{ cue: pick(FAMILY.energyHit, c.seed), gain: .55, rate: wobble(c.seed, .05) }]
    : [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .44, rate: wobble(c.seed, .06) }];
}

/** The swings of a plain melee move, one per contact. */
function meleeSwings(c: Ctx): CueLayer[] {
  const blow = blowOf(c), heavy = c.slot !== 'light' || c.stage === 3;
  const layers: CueLayer[] = [];
  c.move.contacts.forEach((time, i) => {
    // Confirmed cinematics are scheduled by confirmLayers. Planning their
    // later swings at cast made a missed opener play the whole ultimate.
    if(c.slot==='ultimate'&&c.move.confirm&&!c.event.branch&&i>(c.move.timeStop?.contact??0))return;
    const last = i === c.move.contacts.length - 1;
    layers.push(...swing(c, blow, time, heavy && last, i));
  });
  // Rush-stage flourishes, from the clips and the stage names.
  if (c.slot === 'light') {
    if (c.fighter === 'konta' && !c.awakened && (c.stage === 1 || c.stage === 2)) {
      layers.push({ cue: pick(FAMILY.poof, c.seed), gain: .34, phase: 'cast' });
      if (c.stage === 2) layers.push({ cue: pick(FAMILY.poof, c.seed, 1), gain: .28, delay: .06, phase: 'cast' });
    }
    if (c.stage === 3 && c.fighter === 'kenzo') layers.push(onBeat('fx-wind-blast', .34, c.move.contacts[0] + .04));
    if (c.stage === 3 && c.fighter === 'kuon') layers.push(bed('fx-purple-charge', .16, .02, c.move.contacts[0]));
    if (c.stage === 3 && c.fighter === 'ward') layers.push({ cue: 'fx-crossmatch', gain: .4, delay: .05, phase: 'cast' });
    if (c.stage === 3 && c.fighter === 'nigo') layers.push(onBeat('fx-nightfang', .32, c.move.contacts[0]));
    if (c.stage === 3 && c.fighter === 'shirokane') layers.push(onBeat(pick(FAMILY.zap, c.seed), .3, c.move.contacts[0]));
  }
  return layers;
}

function blowOf(c: Ctx): Blow {
  if (c.fighter === 'konta' && c.awakened) return 'beast';
  if (c.air) return 'kick';
  const air = AIR_BLOWS[c.event.move ?? ''] as Blow | undefined;
  if (air) return air;
  if (c.slot === 'light') return ((c.awakened ? FORM_STAGES[c.fighter] : undefined) ?? STAGES[c.fighter])[Math.min(3, c.stage)];
  if (bladeOf(c)) return 'blade';
  if (c.fighter === 'kosho') return 'kick';
  if (c.fighter === 'gummy') return 'rubber';
  if (c.fighter === 'koko' || c.fighter === 'oro') return 'spirit';
  return 'axe';
}

/** One swing, its loudest moment on `time`. */
function swing(c: Ctx, blow: Blow, time: number, weight: boolean, index: number): CueLayer[] {
  const seed = c.seed + index * 7, rate = wobble(seed, .04);
  switch (blow) {
    case 'fist': case 'spirit':
      return [onBeat(weight ? pick(FAMILY.heavy, seed) : pick(FAMILY.jab, seed, index), weight ? .5 : .44, time, 'cast', rate)];
    case 'axe':
      return [onBeat(pick(FAMILY.heavy, seed, index), .52, time, 'cast', rate)];
    case 'kick':
      return [onBeat(weight ? pick(FAMILY.heavy, seed) : pick(FAMILY.kick, seed, index), weight ? .52 : .46, time, 'cast', rate)];
    case 'beast':
      return [onBeat(pick(FAMILY.beastSwipe, seed, index), .55, time, 'cast', rate * (weight ? .9 : 1))];
    case 'rubber':
      // The arm leaves .08 s before the contact and snaps back after it.
      return [
        onBeat(pick(FAMILY.stretch, seed), weight ? .4 : .34, Math.max(.06, time - .09), 'cast', weight ? .8 : 1),
        onBeat(weight ? pick(FAMILY.heavy, seed) : pick(FAMILY.jab, seed, index), weight ? .46 : .4, time, 'cast', rate),
        onBeat(pick(FAMILY.snap, seed), .3, time + .06, 'cast', wobble(seed, .06))];
    case 'blade': {
      const family = bladeOf(c) ?? FAMILY.katana;
      const big = family === FAMILY.gravedigger;
      const layers = [onBeat(pick(family, seed, index), big ? .6 : .46, time, 'cast', rate * (weight && big ? .9 : 1))];
      // Kenzo swings more than one sword at once: the others trail a hair behind.
      if (c.fighter === 'kenzo') layers.push(onBeat(pick(family, seed, index + 1), .34, time + .018, 'cast', rate * 1.04));
      if (c.fighter === 'kenzo' && (weight || c.awakened)) layers.push(onBeat(pick(family, seed, index + 2), .3, time + .034, 'cast', rate * .96));
      if (c.fighter === 'setsu') layers.push(onBeat(pick(FAMILY.zap, seed), .14, time));
      if (weight && !big && c.fighter !== 'setsu' && c.fighter !== 'shirokane') layers.push(onBeat(pick(FAMILY.heavy, seed), .3, time, 'cast', .92));
      return layers;
    }
  }
}

/** A move with no melee contact and no signature of its own: shaped by its style. */
function energyCast(c: Ctx): CueLayer[] {
  const first = c.move.contacts[0];
  const big = c.slot === 'ultimate';
  // (The ki charge, where something is charged: a family with a cast of its own gathers as itself - familyCast.)
  const own = familyOf(c.fighter, c.slot, c.awakened), gathers = !!own && FAMILIES[own].cast.length > 0 && !FAMILIES[own].explodes;
  const layers: CueLayer[] = gathers ? [] : [bed(big ? 'fx-ki-charge-big' : 'fx-ki-charge', big ? .22 : .17, 0, first)];
  if (c.move.style === 'projectile') c.move.contacts.forEach((time, i) => layers.push(onBeat(pick(FAMILY.kiBlast, c.seed, i), .48, time)));
  if (c.move.style === 'bomb') layers.push(onBeat('fx-ki-launch', .55, first), onBeat('fx-swing-huge', .36, first + .05));
  // (A field catching like fire, where it is fire: every other family's own cast says what it is - familyCast.)
  if (c.move.style === 'field' && (!own || own === 'fire' || own === 'magma')) layers.push(onBeat('fx-fire-ignite', .4, first));
  return layers;
}

/** What a transformation adds to every cast. */
function awakenedCast(c: Ctx): CueLayer[] {
  if (!c.awakened) return [];
  const first = c.move.contacts[0] ?? 0;
  switch (c.fighter) {
    // Round 4b (GUMMY): SUNRISE's cartoon - a puff of cloud on everything he throws (it was Full Swell's bounce).
    case 'gummy': return [{ cue: pick(FAMILY.poof, c.seed), gain: .2, phase: 'cast' }];
    case 'gaunt': return [{ cue: pick(FAMILY.armour, c.seed), gain: .32, phase: 'cast' }];
    case 'setsu': return [onBeat(pick(FAMILY.zap, c.seed, 1), .2, first)];
    case 'kuon': return [onBeat(pick(FAMILY.zap, c.seed, 2), .13, first), onBeat(pick(FAMILY.zip, c.seed), .2, Math.max(.05, first - .05))];
    case 'ward': return c.slot === 'ultimate' ? [] : [{ cue: 'fx-crossmatch', gain: .22, phase: 'cast' }];
    case 'kosho': case 'kagari':
      return c.move.style === 'melee' ? [onBeat(pick(FAMILY.fireWhoosh, c.seed), .24, first)] : [];
    case 'shiden': case 'shirokane':
      // The Guardian swings with them: a huge limb moving the air.
      return c.move.style === 'melee' ? [onBeat(pick(FAMILY.heavy, c.seed, 1), .26, first, 'cast', .78)] : [];
    case 'taisei': case 'ouga': case 'nigo': case 'kenzo':
      return c.move.style === 'melee' && c.slot !== 'ultimate' ? [onBeat(pick(FAMILY.heavy, c.seed, 1), .2, first, 'cast', .86)] : [];
    default: return [];
  }
}

// ---------------------------------------------------------------- signature moves

type Plan = (c: Ctx) => CueLayer[];
const c0 = (c: Ctx) => c.move.contacts[0];
const last = (c: Ctx) => c.move.contacts[c.move.contacts.length - 1];

/** Time stop: the reversed whoomph lands its 'DOON' on the stop, a clock
 *  ticks in the stillness (one-shots, one a second: nothing here loops, so
 *  the GAN/GILDED_PUNCH voice loop stays the move's only looped layer), a spirit's
 *  barrage bed covers barrageWindow - one continuous stretch through the
 *  glides between frozen victims (TIMESTOP) - and time resumes with a shock
 *  as the stop ends, 0.02 s before the finisher.
 *
 *  The finisher lands on every victim the stop caught in the same tick (the
 *  resume blast), one hit event each. So a hit plans only that victim's body
 *  blow; anything that happens once - the steamroller crashing down, drawn
 *  whether or not anybody is under it - is scheduled here, from the cast. */
function timeStop(c: Ctx, extra: CueLayer[] = []): CueLayer[] {
  const stop = c.move.timeStop!, at = c.move.contacts[stop.contact], resume = at + stop.duration;
  const layers: CueLayer[] = [onBeat('fx-timestop', .55, at)];
  for (let tick = at + .55; tick < resume - .35; tick += 1) layers.push({ cue: 'fx-timestop-tick', gain: .3, delay: round(tick), phase: 'cast' });
  const window = barrageWindow(c.move);
  if (window) layers.push(...barrageBed(window.start, window.end, .38));
  layers.push(onBeat('fx-timestop-resume', .6, resume), ...extra);
  return layers;
}
/** Round 3d (ULTS): a hit-confirm time stop is heard in two halves. The stop
 *  is the opener - its DOON goes out with the cast, caught or not; what
 *  happens inside a stop that caught somebody - the clock ticking, the
 *  barrage, time resuming, and `extra` - is its cinematic, laid out from the
 *  confirm (confirmLayers moves each layer onto the confirm's clock), so a
 *  stop that caught nobody is only its DOON. */
function timeStopCinematic(c: Ctx, extra: CueLayer[] = []): CueLayer[] {
  return timeStop(c, extra).slice(1);
}

/** The rapid-fire bed under an GAN/GILDED_PUNCH barrage, from `start` to `end`. The
 *  bed is a one-shot; a window longer than it is covered by overlapping takes. */
function barrageBed(start: number, end: number, gain: number): CueLayer[] {
  const layers: CueLayer[] = [], length = sfxLength('fx-barrage') - .1;
  for (let from = Math.max(0, start - .05); from < end; from += length - .15) {
    const duration = Math.min(length, end + .12 - from);
    if (duration < .15) break;
    layers.push({ cue: 'fx-barrage', gain, delay: round(from), duration: round(duration), phase: 'cast' });
  }
  return layers;
}

const SIGNATURE_CASTS: Partial<Record<FighterId, Partial<Record<AttackSlot, Plan>>>> = {
  chohan:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-cut-2',.18,c0(c))],special:c=>[onBeat('fx-dash',.13,.08),...meleeSwings(c),onBeat('fx-slash-kunai-1',.20,c0(c))],ultimate:c=>meleeSwings(c)},
  tsubute:{light:c=>[onBeat('fx-stretch-1',.32,Math.max(.04,c0(c)-.05)),onBeat('fx-snap-1',.42,c0(c)),...(c.stage===3?[onBeat(pick(FAMILY.heavy,c.seed),.34,c0(c)+.02)]:[])],heavy:c=>[onBeat('fx-stretch-2',.26,c0(c)),onBeat('fx-wind-blast',.3,c0(c))],special:c=>[onBeat('fx-snap-1',.12,c0(c)),onBeat('fx-fire-whoosh-1',.19,c0(c))],ultimate:c=>[onBeat('fx-stretch-2',.3,c0(c)-.06),onBeat('fx-snap-2',.4,c0(c)),onBeat('fx-swing-huge',.34,c0(c)+.03)]},
  aqrab:{light:c=>meleeSwings(c),heavy:c=>[onBeat('fx-wind-blast',.18,c0(c)),onBeat('fx-cut-2',.14,c0(c))],special:c=>[held('fx-wind-swirl',.13,.06,c0(c)),onBeat('fx-wind-blast',.19,c0(c))],ultimate:c=>[held('fx-wind-swirl',.11,.08,c0(c))]},
  ume:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-land-heavy',.2,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-hit-heavy-1',.22,c0(c))],ultimate:c=>meleeSwings(c)},
  lanthorn:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-cut-2',.2,c0(c))],special:c=>[onBeat('fx-fire-burst',.24,c0(c))],ultimate:c=>meleeSwings(c)},
  highsun:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-swing-huge',.2,c0(c))],special:c=>[onBeat('fx-fire-burst',.24,c0(c))],ultimate:c=>meleeSwings(c)},
  torsion:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.2,c0(c))],special:c=>[onBeat('fx-wind-blast',.24,c0(c))],ultimate:c=>meleeSwings(c)},
  kubiwa:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-energy-hit-1',.18,c0(c))],special:c=>[onBeat('fx-defib-shock',.24,c0(c))],ultimate:c=>meleeSwings(c)},
  onigawara:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-cut-2',.22,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-dash',.18,.08)],ultimate:c=>meleeSwings(c)},
  cardo:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-cut-2',.22,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-dash',.18,.08)],ultimate:c=>meleeSwings(c)},
  minase:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),held('fx-wind-swirl',.15,.08,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-dash',.22,.08)],ultimate:c=>meleeSwings(c)},
  aquilo:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),held('fx-wind-swirl',.15,.08,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-dash',.22,.08)],ultimate:c=>meleeSwings(c)},
  'psyche':{light:c=>[...meleeSwings(c),onBeat('fx-stretch-1',.08,c0(c))],heavy:c=>[onBeat('fx-stretch-2',.12,c0(c)),onBeat('fx-snap-1',.12,c0(c))],special:c=>[onBeat('fx-wind-blast',.16,c0(c))],ultimate:c=>[onBeat('fx-stretch-1',.11,c0(c))]},
  'ovid':{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-beast-swipe-1',.12,c0(c)),onBeat('fx-wind-blast',.14,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.32,c0(c))],ultimate:c=>meleeSwings(c)},
  // (13 October: the Scout's are Levin's - the Fuse Lance off the launcher, the lines fired out and the cut through
  // them, the one cut that opens the spin - with the gas he burns kicking in under his lunge, where Levin wastes none;
  // the YUGE's are what adult Hawser's were.)
  hawser:{light:c=>meleeSwings(c),
    heavy:c=>c.awakened?[...meleeSwings(c),onBeat('fx-wind-blast',.14,c0(c))]:[onBeat(pick(FAMILY.zip,c.seed),.42,c0(c)-.02),onBeat(pick(FAMILY.kiBlast,c.seed),.3,c0(c))],
    special:c=>c.awakened?[onBeat('fx-wind-blast',.18,c0(c))]:[onBeat('fx-dash',.16,.08),onBeat(pick(FAMILY.zip,c.seed),.4,c0(c)*.3),onBeat(pick(FAMILY.zip,c.seed,1),.36,c0(c)*.6),onBeat('fx-swing-huge',.46,c0(c)-.02),onBeat(pick(FAMILY.katana,c.seed),.42,c0(c))],
    ultimate:c=>c.awakened?meleeSwings(c):[onBeat(pick(FAMILY.katana,c.seed),.46,c0(c))]},
  rotfalke:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.14,c0(c))],special:c=>[onBeat('fx-ki-blast-2',.2,c0(c))],ultimate:c=>meleeSwings(c)},
  bonsho:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.14,c0(c))],special:c=>[onBeat('fx-ki-blast-2',.2,c0(c))],ultimate:c=>meleeSwings(c)},
  murex:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.14,c0(c))],special:c=>[onBeat('fx-ki-blast-2',.2,c0(c))],ultimate:c=>meleeSwings(c)},
  kinu:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-dash',.10,c0(c))],special:c=>meleeSwings(c),ultimate:c=>meleeSwings(c)},
  'madake':{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-dash',.12,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.18,c0(c))],ultimate:c=>meleeSwings(c)},
  akayuri:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-sword-ring',.10,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-dash',.10,c0(c))],ultimate:c=>meleeSwings(c)},
  hagure:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.10,c0(c))],special:c=>[...meleeSwings(c),held('fx-wind-swirl',.09,0,c0(c))],ultimate:c=>meleeSwings(c)},
  hisame:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-guard-shatter',.12,c0(c))],special:c=>[held('fx-wind-swirl',.09,0,c0(c)),onBeat('fx-wind-blast',.20,c0(c))],ultimate:c=>meleeSwings(c)},
  svanhild:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-guard-shatter',.12,c0(c))],special:c=>[held('fx-wind-swirl',.09,0,c0(c)),onBeat('fx-wind-blast',.20,c0(c))],ultimate:c=>meleeSwings(c)},
  mizuhiki:{light:c=>meleeSwings(c),heavy:c=>meleeSwings(c),special:c=>[held('fx-wind-swirl',.07,.12,c0(c)),onBeat('fx-slash-kunai-1',.19,c0(c))],ultimate:c=>meleeSwings(c)},
  'shibuichi':{light:c=>meleeSwings(c),heavy:c=>meleeSwings(c),special:c=>[onBeat('fx-armour-1',.12,.3),held('fx-gather',.10,.2,c0(c)),onBeat('fx-ground-bounce',.19,c0(c))],ultimate:c=>meleeSwings(c)},
  'rakucho':{light:c=>meleeSwings(c),heavy:c=>meleeSwings(c),special:c=>meleeSwings(c),ultimate:c=>meleeSwings(c)},
  irbis:{light:c=>meleeSwings(c),heavy:c=>meleeSwings(c),special:c=>[held('fx-gather',.13,.05,c0(c)),onBeat('fx-ki-launch',.21,c0(c))],ultimate:c=>meleeSwings(c)},
  shidare:{light:c=>meleeSwings(c),heavy:c=>meleeSwings(c),special:c=>[held('fx-wind-swirl',.10,.04,c0(c)),onBeat('fx-wind-blast',.18,c0(c))],ultimate:c=>meleeSwings(c)},
  yodaka:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-fire-whoosh-1',.20,c0(c))],special:c=>[held('fx-fire-bed',.12,.08,c0(c)),onBeat('fx-fire-burst',.24,c0(c))],area:c=>[...meleeSwings(c),onBeat('fx-fire-whoosh-1',.18,c0(c))],ultimate:c=>meleeSwings(c)},
  hinomoto:{light:c=>meleeSwings(c),heavy:c=>meleeSwings(c),special:c=>[held('fx-fire-bed',.13,.08,c0(c)),onBeat('fx-fire-burst',.24,c0(c))],ultimate:c=>meleeSwings(c)},
  amagoi:{light:c=>meleeSwings(c),heavy:c=>[held('fx-gather',.12,.08,c0(c)),onBeat('fx-wind-blast',.23,c0(c))],special:c=>[held('fx-gather',.14,.08,c0(c)),onBeat('fx-wind-swirl',.22,c0(c))],ultimate:c=>meleeSwings(c)},
  'shakudo':{light:c=>meleeSwings(c),heavy:c=>meleeSwings(c),special:c=>[held('fx-gather',.13,.08,c0(c)),onBeat('fx-land-heavy',.24,c0(c))],ultimate:c=>meleeSwings(c)},
  hikui:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-fire-whoosh-1',.2,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-cut-2',.22,c0(c))],ultimate:c=>meleeSwings(c)},
  tokan:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-guard-shatter',.2,c0(c))],special:c=>[onBeat('fx-wind-blast',.25,c0(c))],ultimate:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.14,c0(c))]},
  strappado:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-cut-2',.2,c0(c))],special:c=>[onBeat('fx-clock-hand-knives-2',.24,c0(c)),onBeat('fx-cut-2',.18,c0(c))],ultimate:c=>[...meleeSwings(c),onBeat('fx-stretch-2',.12,c0(c))]},
  unari:{heavy:c=>[...meleeSwings(c),onBeat('fx-snap-1',.21,c0(c))],special:c=>[onBeat('fx-clock-hand-knives-2',.27,c0(c))],ultimate:c=>[...meleeSwings(c),onBeat('fx-stretch-2',.12,c0(c))]},
  // Left-hand darkness draws inward; right-hand quake strikes with a dry fracture.
  barrow:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-defib-shock',.22,c0(c))],special:c=>[bed('fx-gather',.12,.04,c0(c)),onBeat('fx-room',.25,c0(c))],ultimate:c=>[...meleeSwings(c),onBeat('fx-room',.15,c0(c))]},
  kusushi:{heavy:c=>[...meleeSwings(c),onBeat('fx-hit-finisher-1',.22,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-energy-hit-1',.19,c0(c))]},
  hakushi:{heavy:c=>[bed('fx-gather',.12,.03,c0(c)),onBeat('fx-energy-hit-1',.22,c0(c))],special:c=>[bed('fx-fire-bed',.11,.16,c0(c)),onBeat('fx-fire-whoosh-2',.24,c0(c))]},
  suzuran:{heavy:c=>[...meleeSwings(c),onBeat('fx-energy-hit-1',.14,c0(c))],special:c=>[bed('fx-gather',.12,.03,c0(c)),onBeat('fx-wind-blast',.24,c0(c))]},
  wataame:{heavy:c=>meleeSwings(c),special:c=>[...meleeSwings(c),onBeat('fx-swing-huge',.2,c0(c))]},
  bruin:{heavy:c=>meleeSwings(c),special:c=>[...meleeSwings(c),onBeat('fx-swing-huge',.2,c0(c))]},
  senko:{heavy:c=>[...meleeSwings(c),onBeat('fx-energy-hit-2',.17,c0(c))],special:c=>[bed('fx-ki-charge',.12,.03,c0(c)),onBeat('fx-ki-launch',.28,c0(c))]},
  buna:{heavy:c=>[...meleeSwings(c),onBeat('fx-will',.19,c0(c))],special:c=>[bed('fx-gather',.12,.04,c0(c)),onBeat('fx-wind-blast',.32,c0(c))]},
  shijima:{heavy:c=>[...meleeSwings(c),onBeat('fx-guard-shatter',.18,c0(c))],special:c=>[bed('fx-wind-swirl',.12,0,c0(c)),onBeat('fx-wind-blast',.28,c0(c))]},
  akaito:{special:c=>[bed('fx-gather',.12,0,c0(c)),onBeat('fx-energy-hit-2',.23,c0(c))]},
  tempo:{heavy:c=>[...meleeSwings(c),onBeat('fx-energy-hit-1',.16,c0(c))],special:c=>[bed('fx-gather',.12,.05,c0(c)),onBeat('fx-swing-heavy-2',.27,c0(c))]},
  tancho:{heavy:c=>[...meleeSwings(c),onBeat('fx-fire-whoosh-1',.28,c0(c))],special:c=>[bed('fx-wind-swirl',.18,0,c0(c)),onBeat('fx-guard-shatter',.3,c0(c))]},
  oyashio:{heavy:c=>[...meleeSwings(c),onBeat('fx-wind-swirl',.19,c0(c))],special:c=>[bed('fx-gather',.11,.03,c0(c)),onBeat('fx-swing-heavy-2',.26,c0(c))]},
  adad:{heavy:c=>[...meleeSwings(c),onBeat('fx-electric-bed',.16,c0(c))],special:c=>[bed('fx-electric-bed',.13,.04,c0(c)),onBeat('fx-lightning',.48,c0(c))]},
  bellows:{heavy:c=>[...meleeSwings(c),onBeat('fx-fire-whoosh-2',.3,c0(c))],special:c=>[bed('fx-fire-bed',.14,0,c0(c)),onBeat('fx-fire-whoosh-1',.3,c0(c))]},
  mikage:{heavy:c=>[...meleeSwings(c),onBeat('fx-electric-bed',.16,c0(c))],special:c=>[bed('fx-electric-bed',.14,.05,c0(c)),onBeat('fx-dash',.28,c0(c))]},
  'full-beam':{light:meleeSwings,heavy:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.14,c0(c))],special:c=>[onBeat('fx-swing-heavy-2',.32,c0(c)),onBeat('fx-wind-blast',.42,c0(c))],ultimate:c=>[onBeat('fx-swing-heavy-2',.3,c0(c))]},
  pyroclast:{light:c=>[...meleeSwings(c),onBeat('fx-fire-burst',.14,c0(c))],heavy:c=>[...meleeSwings(c),onBeat('fx-fire-burst',.32,c0(c))],special:c=>[onBeat('fx-fire-burst',.3,c0(c)),onBeat('fx-wind-blast',.22,c0(c))],ultimate:c=>[onBeat('fx-swing-heavy-2',.25,c0(c))]},
  ampere:{heavy:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.15,c0(c))],special:c=>[onBeat('fx-wind-blast',.32,c0(c))],ultimate:c=>[onBeat('fx-swing-heavy-2',.25,c0(c))]},
  shanxiao:{heavy:c=>[...meleeSwings(c),onBeat('fx-land-heavy',.24,c0(c))],special:c=>[bed('fx-ki-charge',.16,.05,c0(c)),onBeat('fx-ki-launch',.42,c0(c))],ultimate:c=>[onBeat('fx-swing-heavy-2',.3,c0(c))]},
  kuzu:{heavy:c=>[onBeat('fx-kuzu-saw-2',.38,c0(c))],special:c=>[onBeat('fx-kuzu-rev',.34,c0(c)),onBeat('fx-kuzu-saw-1',.25,c0(c))],ultimate:c=>[onBeat('fx-kuzu-saw-2',.38,c0(c))]},
  shakugo:{heavy:c=>[...meleeSwings(c),onBeat('fx-fire-burst',.25,c0(c))],special:c=>[bed('fx-fire-roar',.12,.15,c0(c)),onBeat('fx-fire-burst',.45,c0(c))],ultimate:c=>[onBeat('fx-fire-burst',.32,c0(c))]},
  'basilissa': {
    light: c => c.move.style === 'melee' ? meleeSwings(c) : [onBeat('fx-zip-1', .5, c0(c), 'cast', 1.3)],
    heavy: c => meleeSwings(c),
    special: c => [bed('fx-wind-swirl', .12, 0, c0(c), 1.25), onBeat('fx-zip-2', .42, c0(c), 'cast', 1.25)],
    ultimate: c => [onBeat(pick(FAMILY.kick, c.seed), .5, c0(c))],
  },
  sorayomi: {
    special: c => [bed('fx-wind-swirl', .2, .08, c0(c)), onBeat('fx-wind-blast', .42, c0(c))],
    ultimate: c => [bed('fx-electric-bed', .2, .05, c0(c)), onBeat('fx-lightning', .5, c0(c))],
  },
  // The greatsword: steel displaces air; the crescent leaves on its authoritative contact. No gunshot or ki-blast stand-in.
  strix: {
    heavy: c => [...meleeSwings(c),onBeat('fx-sword-ring',.16,c0(c)+.035)],
    special: c => [{cue:'fx-sword-ring',gain:.18,phase:'cast'},onBeat(pick(FAMILY.gravedigger,c.seed),.55,c0(c)),onBeat('fx-slash-wave',.58,c0(c)+.025)],
    ultimate: c => [onBeat(pick(FAMILY.gravedigger,c.seed),.6,c0(c),'cast',.91),onBeat('fx-slash-wave',.38,c0(c)+.02,'cast',.92)],
  },
  taisei: {
    // Cloudstep Strike (round 3, MOVES): gone in a 'shun' at the
    // vanish, back behind them in a brighter zip and pop, and a crushing kick
    // to the back. The teleport happens hit or miss, so it is all scheduled
    // here. Any other heavy is swung like one.
    heavy: c => {
      const blink = teleportOf(c.move);
      if (!blink) return meleeSwings(c);
      return [onBeat(pick(FAMILY.zip, c.seed), .42, blink.vanish, 'cast', .92), onBeat('fx-vanish', .46, blink.appear),
        onBeat(pick(FAMILY.heavy, c.seed), .54, c0(c)), onBeat(pick(FAMILY.kick, c.seed), .3, c0(c) - .01, 'cast', .9)];
    },
    // Sunpalm Cannon: the voice carries the call; under it the ball of ki builds.
    special: c => [bed('fx-ki-charge', .15, 0, c0(c))],
    // LAST SUN: energy streams in from everywhere while the sphere grows.
    ultimate: c => [bed('fx-ki-charge-big', .22, 0, c0(c)), bed('fx-gather', .16, 0, c0(c)),
      onBeat('fx-ki-launch', .55, c0(c)), onBeat('fx-swing-huge', .38, c0(c) + .1)],
  },
  ouga: {
    // Crown Straight (round 3, MOVES): a straight with a thin ki fizz
    // off the fist, heard whether it lands or not. Before it, a volley.
    light: c => c.move.style !== 'melee' ? energyCast(c)
      : c.stage === 0 && !c.air ? [...meleeSwings(c), onBeat(pick(FAMILY.zap, c.seed), .16, c0(c))] : meleeSwings(c),
    heavy: c => [bed('fx-ki-charge', .16, 0, c0(c)), onBeat('fx-ki-launch', .52, c0(c))],
    special: c => [bed('fx-ki-charge', .18, 0, c0(c))],
    // Round 3d: the charge to the opener, and the beam is heard on its
    // release; the burn that holds them is the cinematic's (confirmLayers).
    ultimate: c => [bed('fx-ki-charge-big', .22, 0, c0(c))],
  },
  konta: {
    // Senpugan: the sphere whirs in the palm from .06, then he drives it in.
    heavy: c => c.awakened
      ? [onBeat(pick(FAMILY.beastSwipe, c.seed), .6, c0(c), 'cast', .86)]
      : [bed('fx-whirlsphere', .3, .06, c0(c) + .06), onBeat(pick(FAMILY.heavy, c.seed), .36, c0(c))],
    // Galewheel: its recorded sound is kept byte for byte on the voice
    // bus; this only adds the wind blades whirring under it and the throw.
    special: c => c.awakened
      ? [bed('fx-ki-charge', .16, 0, c0(c)), onBeat('fx-ki-launch', .5, c0(c))]
      : [bed('fx-whirlsphere', .14, .05, c0(c)), onBeat('fx-wind-blast', .3, c0(c) + .05)],
    ultimate: c => [bed('fx-ki-charge-big', .24, 0, c0(c)), onBeat('fx-ki-launch', .55, c0(c)), onBeat('fx-swing-huge', .34, c0(c) + .06),
      ...(c.awakened ? [{ cue: 'fx-beast-roar' as const, gain: .42, phase: 'cast' as const }] : [])],
  },
  shiden: {
    // Shrike Bolt: a shrieking bolt in the left hand from the first frame.
    heavy: c => [{ cue: pick(FAMILY.zap, c.seed), gain: .3, phase: 'cast' }, bed('fx-shrike-bolt', .26, .02, c0(c))],
    // Black Pyre: black flames catch on the target at .85 and burn until 3.0.
    special: c => [onBeat('fx-fire-ignite', .42, c0(c), 'cast', .7),
      { cue: 'fx-black-flame', gain: .34, delay: c0(c), duration: round(c.move.duration - c0(c)), loop: true, phase: 'cast' }],
    // Ikazuchi Arrow: the Guardian takes shape, lightning crackles on the bow,
    // and the arrow leaves on a crack of thunder. Round 3d: that is the
    // opener, let go at .5; what the arrow does to them is the cinematic.
    ultimate: c => [...(c.awakened ? [] : [{ cue: 'fx-guardian' as const, gain: .42, phase: 'cast' as const }]),
      bed('fx-electric-bed', .2, .1, c0(c)), onBeat('fx-lightning', .6, c0(c)), onBeat('fx-slash-wave', .35, c0(c) + .02)],
  },
  shirokane: {
    heavy: c => [{ cue: pick(FAMILY.zap, c.seed), gain: .3, phase: 'cast' }, bed('fx-shrike-bolt', .26, .02, c0(c))],
    // Static Scarecrow: the Lightning Cut swells, then a clone bolts out.
    special: c => [bed('fx-shrike-bolt', .28, 0, c0(c)), onBeat(pick(FAMILY.poof, c.seed), .34, c0(c)),
      onBeat(pick(FAMILY.zip, c.seed), .38, c0(c) + .05), onBeat(pick(FAMILY.zap, c.seed), .3, c0(c) + .06)],
    // VOID SICKLE: the spiral opens beside him; the blade crackles as he closes.
    // Round 3d: the Sickle Bolt driven in is the opener, at .48.
    ultimate: c => [{ cue: 'fx-void-sickle', gain: .45, delay: .05, phase: 'cast' }, bed('fx-shrike-bolt', .3, .02, c0(c)),
      onBeat(pick(FAMILY.kunai, c.seed), .46, c0(c))],
  },
  gummy: {
    heavy: c => [onBeat(pick(FAMILY.stretch, c.seed), .4, c0(c) - .12, 'cast', .82),
      onBeat(pick(FAMILY.heavy, c.seed), .5, c0(c)), onBeat(pick(FAMILY.snap, c.seed), .34, c0(c) + .07)],
    // Round 4b (GUMMY): the SUNSET BARRAGE - Will hardening both arms, then a wall of rubber fists from the first to
    // the last (the barrage bed), a stretch as they go and a snap on every one, and the last landing heavy.
    special: c => [{ cue: 'fx-will', gain: .4, delay: .08, phase: 'cast' }, ...barrageBed(c0(c), last(c), .3),
      onBeat(pick(FAMILY.stretch, c.seed), .32, c0(c) - .06, 'cast', 1.15),
      ...c.move.contacts.slice(0, -1).map((time, i) => onBeat(pick(FAMILY.snap, c.seed, i), .2, time, 'cast', 1.2)),
      onBeat(pick(FAMILY.heavy, c.seed), .46, last(c))],
    // The GRAND TIDE. The opener is a rubber Bazooka at .5; SUNRISE, the fist
    // blown up over the dazed victim and brought down are the cinematic
    // (confirmLayers).
    ultimate: c => [onBeat(pick(FAMILY.stretch, c.seed), .4, c0(c) - .1, 'cast', .7), onBeat('fx-swing-huge', .5, c0(c))],
  },
  kenzo: {
    // Fang Crossing: two crescents from crossed swords, and a ring as they part.
    light: c => c.stage === 0 && !c.air ? [...meleeSwings(c), onBeat('fx-sword-ring', .2, c0(c) + .05)] : meleeSwings(c),
    // Mirage Draw: an iai draw - hand to hilt, a dash straight through, the
    // cut, and the guard clicking home behind him.
    heavy: c => [{ cue: 'fx-draw', gain: .36, delay: round(Math.max(0, c0(c) - .42)), phase: 'cast' },
      onBeat(pick(FAMILY.zip, c.seed), .4, c0(c) - .08), onBeat(pick(FAMILY.katana, c.seed), .52, c0(c)),
      onBeat(pick(FAMILY.katana, c.seed, 1), .36, c0(c) + .02), { cue: 'fx-sheathe', gain: .5, delay: round(c0(c) + .38), phase: 'cast' }],
    // thousand mile eagle: wind wound around him, then the flying slash.
    special: c => [bed('fx-wind-swirl', .24, .05, c0(c)), onBeat('fx-slash-wave', .55, c0(c)),
      onBeat(pick(FAMILY.katana, c.seed), .36, c0(c) - .02)],
    // Dust Sea Sundered: nine blades sing, and cut. Round 3d: the RAKSHASA rising
    // behind him is the cinematic's (SIGNATURE_CONFIRMS), as it is drawn.
    ultimate: c => [{ cue: 'fx-sword-ring', gain: .3, delay: round(Math.max(0, c0(c) - .35)), phase: 'cast' },
      onBeat(pick(FAMILY.katana, c.seed), .46, c0(c)), onBeat(pick(FAMILY.katana, c.seed, 1), .4, c0(c) + .02),
      onBeat(pick(FAMILY.katana, c.seed, 2), .36, c0(c) + .04), onBeat('fx-swing-huge', .3, c0(c))],
  },
  kosho: {
    // Hachoir: a heel dropped like an axe.
    heavy: c => [onBeat(pick(FAMILY.heavy, c.seed), .54, c0(c)), onBeat(pick(FAMILY.kick, c.seed), .3, c0(c) - .02, 'cast', .9)],
    // Ember Leg: the leg ignites at .1, burns, and kicks its fire loose.
    special: c => [{ cue: 'fx-fire-ignite', gain: .46, delay: .1, phase: 'cast' }, bed('fx-fire-bed', .2, .4, c0(c)),
      onBeat(pick(FAMILY.kick, c.seed), .42, c0(c)), onBeat(pick(FAMILY.fireWhoosh, c.seed), .5, c0(c) + .03)],
    // Banquet Infernal: the leg burning from .1 and the opener's kick at .45
    // (round 3d); the kicks that follow and the blaze are the cinematic.
    ultimate: c => [{ cue: 'fx-fire-ignite', gain: .5, delay: .06, phase: 'cast' }, bed('fx-fire-bed', .26, .1, c0(c)),
      onBeat(pick(FAMILY.heavy, c.seed), .5, c0(c)), onBeat(pick(FAMILY.fireWhoosh, c.seed), .4, c0(c))],
  },
  kagari: {
    // Hinoko: fireflies scattered with the blow.
    light: c => c.stage === 0 ? [...meleeSwings(c), onBeat('fx-embers', .38, c0(c) + .1)]
      : [...meleeSwings(c), onBeat(pick(FAMILY.fireWhoosh, c.seed), .26, c0(c))],
    // Yuragi: a burst of flame thrown from the fist. Round 4b (FMOVES): from both palms - a jet of fire that roars
    // out of them (no fist's thump: nothing is struck with the hands).
    heavy: c => [{ cue: 'fx-fire-ignite', gain: .36, delay: round(Math.max(0, c0(c) - .3)), phase: 'cast' },
      onBeat('fx-fire-roar', .46, c0(c)), onBeat(pick(FAMILY.fireWhoosh, c.seed), .5, c0(c) + .02)],
    // Taimatsu: the fist burns from .12, and the flaming fist is thrown at 1.5.
    special: c => [{ cue: 'fx-fire-ignite', gain: .42, delay: .12, phase: 'cast' }, bed('fx-fire-bed', .22, .12, c0(c)),
      onBeat('fx-fire-roar', .56, c0(c) + .05)],
    // Taiyou-Dama: a sun overhead, grown from the first frame and thrown at 3.0.
    ultimate: c => [bed('fx-fire-bed', .24, 0, c0(c)), bed('fx-gather', .1, .3, c0(c)),
      { cue: 'fx-fire-ignite', gain: .42, delay: .3, phase: 'cast' }, onBeat('fx-fire-roar', .58, c0(c) + .06),
      onBeat('fx-swing-huge', .36, c0(c) + .1)],
  },
  ward: {
    // Stat Shot: a dash and a thrust.
    heavy: c => [onBeat(pick(FAMILY.zip, c.seed), .38, c0(c) - .2), onBeat(pick(FAMILY.nodachi, c.seed), .5, c0(c))],
    // Cautery Blade: a THEATRE, an energy blade held from .1, and a thrust.
    special: c => [{ cue: 'fx-room', gain: .4, phase: 'cast' }, bed('fx-electric-bed', .14, .1, c0(c)),
      onBeat(pick(FAMILY.zip, c.seed), .34, c0(c) - .06)],
    // THEATRE: Flatline. The THEATRE opens and Crossmatch puts his palm on the
    // target - the opener, at .45 (round 3d); the shock pulsing through them
    // and the full discharge are the cinematic.
    ultimate: c => [{ cue: 'fx-room', gain: .5, phase: 'cast' }, onBeat('fx-crossmatch', .46, c0(c) - .08),
      bed('fx-electric-bed', .2, .15, c0(c))],
  },
  koko: {
    // Needle Finger: the spirit, and a finger shot across the room.
    heavy: c => [{ cue: 'fx-spirit', gain: .34, phase: 'cast' }, onBeat(pick(FAMILY.zip, c.seed), .44, c0(c) + .02)],
    // Gan Gan!: the spirit's wall of fists from the first blow (or .8, where
    // that is later) to past the last, under the voice.
    special: c => [{ cue: 'fx-spirit', gain: .34, phase: 'cast' }, ...barrageBed(Math.min(.8, c0(c)), last(c) + .3, .36)],
    // Round 3d: the stop is the opener; the rest is the cinematic.
    ultimate: c => [{ cue: 'fx-spirit', gain: .3, phase: 'cast' }, timeStop(c)[0]],
  },
  oro: {
    // Clock-Hand Knives: a fan of three knives.
    heavy: c => [onBeat(pick(FAMILY.clockHandKnives, c.seed), .46, c0(c)), onBeat(pick(FAMILY.clockHandKnives, c.seed, 1), .34, c0(c) + .03, 'cast', 1.06)],
    special: c => [{ cue: 'fx-spirit', gain: .34, phase: 'cast' }, ...barrageBed(Math.min(.8, c0(c)), last(c) + .3, .36)],
    // MIDNIGHT: the stop is the opener (round 3d); the GILDED PUNCH, and the road
    // roller dropped out of the sky as time resumes, are the cinematic.
    ultimate: c => [{ cue: 'fx-spirit', gain: .3, phase: 'cast' }, timeStop(c)[0]],
  },
  nigo: {
    // ASHSTEP: a flash step, then the cut.
    heavy: c => [onBeat(pick(FAMILY.zip, c.seed), .42, c0(c) - .2), onBeat(pick(FAMILY.cleaver, c.seed), .52, c0(c)),
      onBeat(pick(FAMILY.heavy, c.seed), .3, c0(c), 'cast', .9)],
    // Scorched Earth: dark energy on the blade from .05, then the crescent.
    special: c => [bed('fx-ki-charge', .16, .05, c0(c), .8), { cue: 'fx-sword-ring', gain: .2, delay: .05, phase: 'cast' },
      onBeat('fx-nightfang', .6, c0(c))],
    // NIGHTFALL: the black wave leaves as the world clears - the opener, at
    // .5 (round 3d); the darkness that holds them and the cut are the
    // cinematic.
    ultimate: c => [bed('fx-ki-charge-big', .2, .05, c0(c), .8), { cue: 'fx-nightfall', gain: .62, delay: round(Math.max(0, c0(c) - .32)), phase: 'cast' }],
  },
  kuon: {
    // Gravity - drawn together in the hand, and thrown.
    heavy: c => [bed('fx-purple-charge', .14, 0, c0(c), .8), onBeat(pick(FAMILY.zip, c.seed), .36, c0(c) + .02)],
    // Singularity: Blue and Red held apart, merging from .73.
    special: c => [bed('fx-purple-charge', .24, 0, c0(c))],
    // PLANETARIUM: the dome opens on the stop - the opener (round 3d);
    // the strikes inside it, the dome closing inward and the Dark Spark
    // are the cinematic (confirmLayers).
    ultimate: c => [onBeat('fx-domain', .7, c.move.contacts[c.move.timeStop!.contact])],
  },
  gaunt: {
    // Round 4b (FMOVES): Cleave - the GRAVEDIGGER comes down, and the wave it sends tears off along the floor.
    heavy: c => [...meleeSwings(c), onBeat('fx-slash-wave', .44, c0(c) + .02), onBeat('fx-ground-bounce', .26, c0(c) + .03)],
    // Scrap Cannon Arm: iron latches, then gunpowder - no ki charge on a cannon.
    special: c => [{ cue: 'fx-cannon-prep', gain: .46, delay: .1, phase: 'cast' }, onBeat('fx-cannon', .72, c0(c))],
    // Hound Rampage: the armour closes and the overhead chop - the
    // opener (round 3d); the great blows after it and the slam are the
    // cinematic.
    ultimate: c => [{ cue: pick(FAMILY.armour, c.seed), gain: .44, delay: .06, phase: 'cast' },
      { cue: pick(FAMILY.armour, c.seed, 1), gain: .34, delay: .22, phase: 'cast' },
      onBeat(pick(FAMILY.gravedigger, c.seed), .48, c0(c), 'cast', wobble(c.seed, .05))],
  },
  setsu: {
    // Sekkou: the hands charge, then a bolt drops through them a tenth
    // of a second before the blow (round 3d: off the contact, not at .3/.32).
    heavy: c => [bed('fx-electric-bed', .2, 0, c0(c) - .12), onBeat('fx-lightning', .5, c0(c) - .1), onBeat(pick(FAMILY.claw, c.seed), .3, c0(c))],
    // Ikazuchi: lightning built between the hands and let go.
    special: c => [bed('fx-electric-bed', .22, .08, c0(c)), onBeat('fx-lightning', .56, c0(c))],
    // SETSUNA: the hands crackle; each flash is a strike. Round 3d: the
    // first is the opener, the blur after it the cinematic.
    ultimate: c => [bed('fx-electric-bed', .16, .1, c0(c) + .05), onBeat(pick(FAMILY.zip, c.seed), .3, c0(c), 'cast', wobble(c.seed, .06))],
  },
  // The shop's fighters.
  gorai: {
    // Grog Gale: the mast-breaker's whole swing, and the wind it throws.
    special: c => [onBeat('fx-swing-huge', .5, c0(c) - .05), onBeat('fx-wind-blast', .52, c0(c))],
    // TIMBER: The Forest Falls: his will up, then the charge's first blow - the opener;
    // the lightning down the mast-breaker and the strike itself are the cinematic.
    ultimate: c => [{ cue: 'fx-will', gain: .44, phase: 'cast' }, onBeat('fx-swing-huge', .5, c0(c))],
  },
  haldor: {
    // Faultline Fist: a fist driven into the air, and the air breaking ahead of it.
    special: c => [onBeat(pick(FAMILY.heavy, c.seed), .46, c0(c) - .03), onBeat('fx-explosion-huge', .44, c0(c) + .02)],
    // World Tilt: he sets the glaive down and punches the air, and the first tremor is the
    // opener; the world tilting is the cinematic.
    ultimate: c => [{ cue: 'fx-gather', gain: .34, phase: 'cast' }, onBeat('fx-land-heavy', .52, c0(c))],
  },
  sorrel: {
    // Crimson Command: the will goes out, and a guard does not stop it.
    special: c => [{ cue: 'fx-will', gain: .52, phase: 'cast' }, onBeat('fx-guard-break', .3, c0(c))],
    // Horizon Sunder: the sabre drawn back and the first cut let go - the
    // opener; the one that counts is the cinematic.
    ultimate: c => [{ cue: 'fx-will', gain: .4, phase: 'cast' }, onBeat('fx-draw', .36, Math.max(.05, c0(c) - .2)), onBeat('fx-slash-wave', .5, c0(c))],
  },
  dorado: {
    // Sovereign Shot: his will up, and the flintlock's shot with the lightning round the ball.
    special: c => [{ cue: 'fx-will', gain: .4, phase: 'cast' }, onBeat('fx-cannon', .6, c0(c)), onBeat('fx-lightning', .3, c0(c) + .02)],
    // HORIZON SUNDER: Kagari rings as it goes up in the cloak's turn - the opener; the
    // cut that splits the heavens is the cinematic.
    ultimate: c => [{ cue: 'fx-will', gain: .44, phase: 'cast' }, onBeat('fx-sword-ring', .4, Math.max(.05, c0(c) - .25)), onBeat('fx-swing-huge', .46, c0(c))],
  },
  shiun: {
    // GLASS LANCES: the light gathers, and the wing blades go out.
    special: c => [{ cue: 'fx-gather', gain: .4, phase: 'cast' }, onBeat('fx-clock-hand-knives-1', .5, c0(c)), onBeat('fx-zap-2', .36, c0(c) + .02)],
    // BLACK CONFESSIONAL: the coffin closing round them is the opener; the spears are the cinematic.
    ultimate: c => [{ cue: 'fx-domain', gain: .38, phase: 'cast' }, onBeat('fx-room', .5, c0(c))],
  },
  magatsu: {
    // Rend: Thousand Cuts: the sweep, and the slashes it throws.
    special: c => [onBeat('fx-swing-huge', .4, c0(c) - .04), onBeat('fx-slash-wave', .5, c0(c)), onBeat(pick(FAMILY.katana, c.seed), .4, c0(c) + .03)],
    // Open: Calamity Pyre: the quick cut is the opener; the fire the cinematic.
    ultimate: c => [{ cue: 'fx-fire-ignite', gain: .36, phase: 'cast' }, onBeat(pick(FAMILY.katana, c.seed), .46, c0(c))],
  },
  vesper: {
    // Pale Lance (4 October): the arm drawn back and the spear hurled - the air torn as it leaves his hand.
    special: c => [onBeat(pick(FAMILY.heavy, c.seed), .44, c0(c) - .04, 'cast', .85), onBeat(pick(FAMILY.zip, c.seed), .38, c0(c))],
    // The Offering: the thrust is the opener; the black sun and the sabre coming down out of it are the cinematic.
    ultimate: c => [{ cue: 'fx-domain', gain: .32, phase: 'cast' }, onBeat(pick(FAMILY.katana, c.seed), .46, c0(c))],
  },
  imago: {
    // Hive Burst (4 October): the aura gathered in his hand and blown out of it.
    special: c => [bed('fx-ki-charge', .18, 0, c0(c)), onBeat(pick(FAMILY.kiBlast, c.seed), .46, c0(c))],
    // The Final Molt: the punch is the opener; the blows after it are the cinematic.
    ultimate: c => [{ cue: 'fx-gather', gain: .3, phase: 'cast' }, onBeat(pick(FAMILY.heavy, c.seed), .46, c0(c))],
  },
  'wuming': {
    // The Petalfall Blade: Cloudstep as Taisei's heavy has it - gone in a 'shun' at the sign, back
    // behind them in a zip and pop - then the ki drawn out into a blade, and the cut. Any other heavy is swung.
    heavy: c => {
      const blink = teleportOf(c.move);
      if (!blink) return meleeSwings(c);
      return [onBeat(pick(FAMILY.zip, c.seed), .42, blink.vanish, 'cast', .92), onBeat('fx-vanish', .46, blink.appear),
        { cue: 'fx-purple-charge', gain: .2, delay: round(blink.appear), phase: 'cast' },
        onBeat('fx-slash-wave', .5, c0(c)), onBeat(pick(FAMILY.zap, c.seed), .3, c0(c) + .02)];
    },
    // Heaven's Harvest: the flying kick of his rush is the opener; the scythe drawn and brought down is the cinematic.
    ultimate: c => [onBeat(pick(FAMILY.kick, c.seed), .46, c0(c)), onBeat(pick(FAMILY.heavy, c.seed), .3, c0(c) - .02)],
  },
  jirenga: {
    // Mountain-Felling Fist: the hook out of his rush is the opener; the leap and the dive are the cinematic.
    ultimate: c => [onBeat(pick(FAMILY.heavy, c.seed), .46, c0(c) - .02), onBeat(pick(FAMILY.jab, c.seed), .36, c0(c) - .05)],
  },
  'jinlin': {
    // The Pearl Needle and the Pearl Thrust: the jab, and the beam off the fingertip as it lands.
    light: c => [...meleeSwings(c), ...(c.stage % 2 ? [] : [onBeat(pick(FAMILY.zap, c.seed), .24, c0(c))])],
    // Pearl Rain: the beams one after another out of his fingers.
    special: c => [bed('fx-ki-charge', .15, 0, c0(c)), ...Array.from({ length: 6 }, (_, i) => onBeat(pick(FAMILY.zap, c.seed, i), .3, c0(c) + i * .065)),
      onBeat(pick(FAMILY.kiBlast, c.seed), .3, c0(c))],
  },
  'gohaku': {
    // The Sun-Seizing Spiral: the ki drawn to a point at his forehead until the arm is thrown out (the beam is
    // heard on its release).
    ultimate: c => [bed('fx-ki-charge', .2, 0, c0(c))],
  },
  sekka: {
    // Avalanche: the fists one after another, and the last one heavy.
    heavy: c => [...barrageBed(Math.max(0, c0(c) - .3), c0(c), .3), onBeat(pick(FAMILY.heavy, c.seed), .46, c0(c))],
    // Shatter Art: Frost Gale (4 October): the straight thrown at the air, and the shock it sends on. (The Compass
    // Needle's sound is his stun's now: ENDER_CASTS.)
    special: c => [onBeat('fx-swing-huge', .44, c0(c) - .04), onBeat(pick(FAMILY.jab, c.seed), .42, c0(c)), onBeat('fx-wind-blast', .3, c0(c) + .02)],
    // Shatter Art: Black Blizzard: the one-two is the opener; the dash and the blow are the cinematic.
    ultimate: c => [onBeat(pick(FAMILY.jab, c.seed), .46, c0(c))],
  },
  ippon: {
    // Dust Allergy (4 October): the breath drawn in, and the sneeze (the gust is heard on its release).
    heavy: c => [bed('fx-wind-swirl', .14, .05, c0(c))],
    // The Clean Slate: the elbow out of his rush is the opener; the punch is the cinematic.
    ultimate: c => [onBeat(pick(FAMILY.jab, c.seed), .46, c0(c))],
    // Double Shift: a wall of fists from the first blow to the last, and the last one heavy.
    special: c => [...barrageBed(c0(c) - .05, last(c) + .15, .34), onBeat(pick(FAMILY.heavy, c.seed), .46, last(c))],
  },
  tobari: {
    // Murder of Crows: Cloudstep as Taisei's heavy has it - gone in a burst of crows at the seal, back behind them
    // in a zip and pop - and the kick to the back. Any other heavy is swung.
    heavy: c => {
      const blink = teleportOf(c.move);
      if (!blink) return meleeSwings(c);
      return [onBeat(pick(FAMILY.poof, c.seed), .4, blink.vanish), onBeat(pick(FAMILY.zip, c.seed), .36, blink.vanish + .02, 'cast', .92),
        onBeat('fx-vanish', .46, blink.appear), onBeat(pick(FAMILY.kick, c.seed), .32, c0(c) - .01, 'cast', .9)];
    },
    // Black Pyre: the black flames catch on the target as Shiden's do, and burn to the end of the move.
    special: c => [onBeat('fx-fire-ignite', .42, c0(c), 'cast', .7),
      { cue: 'fx-black-flame', gain: .34, delay: c0(c), duration: round(c.move.duration - c0(c)), loop: true, phase: 'cast' }],
    // Red Moon Reverie: the flick of the kunai is the opener; the illusion and what it does to them are the cinematic.
    ultimate: c => [onBeat(pick(FAMILY.kunai, c.seed), .46, c0(c))],
  },
  akagane: {
    // The Cinder Art: Burning Sea: the fire roaring out of him from the first burn to the last.
    special: c => [bed('fx-fire-bed', .22, Math.max(0, c0(c) - .15), last(c)), onBeat('fx-fire-roar', .5, c0(c))],
    // Heaven's Anvil: the fan's slash is the opener; the meteor is the cinematic.
    ultimate: c => [onBeat(pick(FAMILY.heavy, c.seed), .46, c0(c))],
  },
  asahi: {
    // Comet Throw (4 October): the katana hurled, spinning.
    heavy: c => [onBeat(pick(FAMILY.katana, c.seed), .44, c0(c) - .02), onBeat(pick(FAMILY.zip, c.seed), .34, c0(c))],
    // Lantern Rite: First Light: the thrust is the opener; the fire and the cut are the cinematic.
    ultimate: c => [onBeat(pick(FAMILY.katana, c.seed), .46, c0(c))],
  },
  levin: {
    // Fuse Lance (4 October): fired off the launcher on his forearm (its blast is heard where it lands).
    heavy: c => [onBeat(pick(FAMILY.zip, c.seed), .42, c0(c) - .02), onBeat(pick(FAMILY.kiBlast, c.seed), .3, c0(c))],
    // The Zipline: the lines fired out one after the other, and the cut as he goes through them.
    special: c => [onBeat(pick(FAMILY.zip, c.seed), .4, c0(c) * .3), onBeat(pick(FAMILY.zip, c.seed, 1), .36, c0(c) * .6),
      onBeat('fx-swing-huge', .46, c0(c) - .02), onBeat(pick(FAMILY.katana, c.seed), .42, c0(c))],
    // The SOJI: Clean Sweep: the slash is the opener; the spin is the cinematic.
    ultimate: c => [onBeat(pick(FAMILY.katana, c.seed), .46, c0(c))],
  },
  'rook': {
    // Grave Grip: the ground drawn up where he looks, and slammed down at each blow.
    special: c => [{ cue: 'fx-gather', gain: .3, phase: 'cast' }, ...c.move.contacts.map((time, i) => onBeat('fx-land-heavy', .5 + i * .06, time))],
    // Black Rookery: the dagger's cut is the opener; the shadows rising and falling on them are the cinematic.
    ultimate: c => [onBeat(pick(FAMILY.kunai, c.seed), .46, c0(c))],
  },
  gaku: {
    // Roar Palm - the aura gathering in the palm he draws back, and thrown off it.
    special: c => [{ cue: 'fx-gather', gain: .3, phase: 'cast' }, onBeat(pick(FAMILY.kiBlast, c.seed), .5, c0(c))],
    // Landslide: his straight is the opener; the fist raised and the Rock brought down are the cinematic.
    ultimate: c => [onBeat(pick(FAMILY.jab, c.seed), .46, c0(c))],
  },
};

// ---------------------------------------------------------------- cinematics

function confirmLayers(c: Ctx): CueLayer[] {
  if (!c.move.confirm || c.slot !== 'ultimate') return [];
  const plan = SIGNATURE_CONFIRMS[c.fighter];
  const layers = plan ? plan(c) : cinematicSwings(c);
  const age = c.event.castAge ?? c0(c), out: CueLayer[] = [];
  for (const layer of layers) {
    const moved = cinematicLayer(layer, age);
    if (moved) out.push(moved);
  }
  return out;
}
/** A layer planned `delay` seconds from the cast, heard from the confirm
 *  `age` seconds into the move instead: what was due before it is dropped
 *  (or, for a bed still running, joined part way), and nothing is 'charge'. */
function cinematicLayer(layer: CueLayer, age: number): CueLayer | undefined {
  const at = (layer.delay ?? 0) - age, end = layer.duration === undefined ? undefined : at + layer.duration;
  if (at < -.03 && !(layer.loop && end !== undefined && end > .15)) return undefined;
  const delay = Math.max(0, at);
  const { delay: _delay, duration, ...rest } = layer;
  return { ...rest, ...(delay > 0 ? { delay: round(delay) } : {}), ...(duration !== undefined ? { duration: round(end! - delay) } : {}),
    phase: layer.phase === 'charge' ? 'cast' : layer.phase };
}
/** A plain melee cinematic: a swing for every blow after the opener. */
function cinematicSwings(c: Ctx): CueLayer[] {
  const blow = blowOf(c), layers: CueLayer[] = [];
  c.move.contacts.forEach((time, i) => { if (i > 0) layers.push(...swing(c, blow, time, i === c.move.contacts.length - 1, i)); });
  return layers;
}
/** A looped bed on a cinematic, from `from` to `to` on the move's timeline. */
const held = (cue: AudioCue, gain: number, from: number, to: number, rate = 1): CueLayer =>
  ({ ...bed(cue, gain, from, to, rate), phase: 'cast' });
/** The blows of the cinematic between the opener and the finisher. */
const middle = (c: Ctx) => c.move.contacts.slice(1, -1);

const SIGNATURE_CONFIRMS: Partial<Record<FighterId, Plan>> = {
  chohan:c=>[onBeat('fx-slash-kunai-1',.14,c.move.contacts[1]),onBeat('fx-dash',.12,c.move.contacts[2]),onBeat('fx-cut-2',.18,c.move.contacts[3]),onBeat('fx-hit-finisher-1',.25,last(c))],
  tsubute:c=>[onBeat('fx-snap-2',.14,c.move.contacts[1]),onBeat('fx-wind-blast',.19,last(c)),onBeat('fx-hit-finisher-1',.23,last(c))],
  aqrab:c=>[held('fx-wind-swirl',.14,c0(c),last(c)),onBeat('fx-land-heavy',.22,last(c)),onBeat('fx-hit-finisher-1',.21,last(c))],
  ume:c=>[onBeat('fx-hit-heavy-1',.22,c.move.contacts[1]),held('fx-gather',.1,c.move.contacts[1],last(c)),onBeat('fx-land-heavy',.28,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  lanthorn:c=>[onBeat('fx-cut-2',.22,c.move.contacts[1]),onBeat('fx-fire-whoosh-1',.2,c.move.contacts[2]),onBeat('fx-fire-burst',.26,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  highsun:c=>[onBeat('fx-energy-hit-1',.22,c.move.contacts[1]),onBeat('fx-fire-burst',.26,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  torsion:c=>[onBeat('fx-wind-blast',.22,c.move.contacts[1]),held('fx-gather',.1,c.move.contacts[1],last(c)),onBeat('fx-land-heavy',.26,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  kubiwa:c=>[onBeat('fx-energy-hit-1',.18,c.move.contacts[1]),onBeat('fx-gather',.14,c.move.contacts[2]),onBeat('fx-defib-shock',.26,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  onigawara:c=>[held('fx-gather',.13,c0(c),last(c)),onBeat('fx-swing-huge',.27,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  cardo:c=>[held('fx-gather',.13,c0(c),last(c)),onBeat('fx-swing-huge',.27,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  minase:c=>[onBeat('fx-dash',.20,c.move.contacts[1]),held('fx-wind-swirl',.14,c.move.contacts[1],last(c)),onBeat('fx-energy-hit-1',.28,last(c)),onBeat('fx-hit-finisher-1',.24,last(c))],
  aquilo:c=>[onBeat('fx-dash',.20,c.move.contacts[1]),held('fx-wind-swirl',.14,c.move.contacts[1],last(c)),onBeat('fx-energy-hit-1',.28,last(c)),onBeat('fx-hit-finisher-1',.24,last(c))],
  'psyche':c=>[onBeat('fx-stretch-2',.14,c.move.contacts[1]),onBeat('fx-snap-2',.20,last(c)),onBeat('fx-hit-finisher-1',.19,last(c))],
  'ovid':c=>[onBeat('fx-wind-blast',.18,last(c)),onBeat('fx-hit-finisher-1',.24,last(c))],
  // (The Colossus's rampage, as adult Hawser's was; the Scout's Slipped Moorings is Levin's spin: both blades whirling through
  // them, and the last pass.)
  hawser:c=>c.awakened?[onBeat('fx-wind-blast',.18,last(c)),onBeat('fx-hit-finisher-1',.24,last(c))]
    :[...Array.from({length:8},(_,i)=>onBeat(pick(FAMILY.katana,c.seed,i),.3,c0(c)+.2+i*.14)),onBeat('fx-swing-huge',.46,last(c)-.05),onBeat(pick(FAMILY.cutHeavy,c.seed),.55,last(c))],
  rotfalke:c=>[onBeat('fx-wind-blast',.16,last(c)),onBeat('fx-hit-finisher-1',.22,last(c))],
  bonsho:c=>[onBeat('fx-wind-blast',.16,last(c)),onBeat('fx-hit-finisher-1',.22,last(c))],
  murex:c=>[onBeat('fx-wind-blast',.16,last(c)),onBeat('fx-hit-finisher-1',.22,last(c))],
  kinu:c=>[onBeat('fx-energy-hit-1',.14,last(c)),onBeat('fx-hit-finisher-1',.22,last(c))],
  'madake':c=>[onBeat('fx-dash',.16,c.move.contacts[1]),onBeat('fx-hit-finisher-1',.25,last(c))],
  akayuri:c=>[onBeat('fx-dash',.12,c.move.contacts[1]),onBeat('fx-sword-ring',.14,last(c)),onBeat('fx-hit-finisher-1',.22,last(c))],
  hagure:c=>[onBeat('fx-dash',.12,c.move.contacts[1]),onBeat('fx-snap-1',.13,c.move.contacts[2]),onBeat('fx-snap-2',.14,c.move.contacts[3]),onBeat('fx-wind-blast',.19,last(c)),onBeat('fx-hit-finisher-1',.23,last(c))],
  hisame:c=>[held('fx-wind-swirl',.09,c.move.contacts[0],last(c)),onBeat('fx-guard-shatter',.23,last(c)),onBeat('fx-sword-ring',.15,last(c))],
  svanhild:c=>[held('fx-wind-swirl',.09,c.move.contacts[0],last(c)),onBeat('fx-guard-shatter',.23,last(c)),onBeat('fx-sword-ring',.15,last(c))],
  mizuhiki:c=>[...c.move.contacts.slice(1,-1).map(t=>onBeat('fx-slash-kunai-1',.16,t)),onBeat('fx-sword-ring',.17,last(c)),onBeat('fx-hit-finisher-1',.26,last(c))],
  'shibuichi':c=>[onBeat('fx-armour-2',.14,c.move.contacts[1]),onBeat('fx-ground-bounce',.23,last(c)),onBeat('fx-hit-finisher-1',.26,last(c))],
  'rakucho':c=>[onBeat('fx-beast-swipe-1',.19,c.move.contacts[1]),onBeat('fx-beast-swipe-2',.20,c.move.contacts[2]),onBeat('fx-wind-blast',.16,last(c)),onBeat('fx-hit-finisher-1',.27,last(c))],
  irbis:c=>[held('fx-gather',.12,c0(c)+.1,last(c)),onBeat('fx-wind-blast',.22,last(c)),onBeat('fx-energy-hit-2',.24,last(c)),onBeat('fx-hit-finisher-1',.24,last(c))],
  shidare:c=>[onBeat('fx-slash-kunai-1',.18,c.move.contacts[1]),held('fx-wind-swirl',.08,1.7,last(c)),onBeat('fx-energy-hit-1',.20,last(c)),onBeat('fx-hit-finisher-1',.26,last(c))],
  yodaka:c=>[onBeat('fx-slash-kunai-1',.18,c.move.contacts[1]),onBeat('fx-fire-whoosh-1',.22,c.move.contacts[2]),held('fx-fire-bed',.10,c.move.contacts[2],last(c)),onBeat('fx-fire-burst',.29,last(c)),onBeat('fx-hit-finisher-1',.30,last(c))],
  hinomoto:c=>[onBeat('fx-slash-kunai-1',.19,c.move.contacts[1]),held('fx-fire-bed',.10,1.6,last(c)),onBeat('fx-fire-burst',.27,last(c)),onBeat('fx-hit-finisher-1',.30,last(c))],
  amagoi:c=>[held('fx-gather',.1,1.0,last(c)),onBeat('fx-land-heavy',.26,last(c)),onBeat('fx-hit-finisher-1',.3,last(c))],
  'shakudo':c=>[onBeat('fx-slash-kunai-1',.20,c.move.contacts[1]),held('fx-electric-bed',.08,2.35,last(c)),onBeat('fx-land-heavy',.28,last(c)),onBeat('fx-hit-finisher-1',.32,last(c))],
  hikui:c=>[onBeat('fx-fire-burst',.22,c.move.contacts[1]),held('fx-gather',.1,c.move.contacts[1],last(c)),onBeat('fx-wind-blast',.28,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  tokan:c=>[onBeat('fx-guard-shatter',.2,c.move.contacts[1]),held('fx-gather',.10,c.move.contacts[1],last(c)),onBeat('fx-wind-blast',.27,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  strappado:c=>[onBeat('fx-cut-2',.22,c.move.contacts[1]),held('fx-stretch-2',.12,c.move.contacts[1],last(c)),onBeat('fx-snap-2',.22,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  unari:c=>[...c.move.contacts.slice(1,-1).map((t,i)=>onBeat(i%2?'fx-snap-1':'fx-cut-2',.14,t)),onBeat('fx-stretch-2',.15,c.move.contacts[6]),onBeat('fx-snap-2',.23,last(c)),onBeat('fx-hit-finisher-1',.25,last(c))],
  barrow:c=>[onBeat('fx-defib-shock',.24,c.move.contacts[1]),held('fx-gather',.1,c.move.contacts[1],last(c)),onBeat('fx-guard-shatter',.27,last(c)),onBeat('fx-land-heavy',.3,last(c))],
  kusushi:c=>[...c.move.contacts.slice(1).map(t=>onBeat('fx-hit-finisher-1',.2,t)),onBeat('fx-wind-blast',.28,last(c))],
  hakushi:c=>[bed('fx-fire-bed',.11,c.move.contacts[1],last(c)),onBeat('fx-fire-ignite',.18,c.move.contacts[1]),onBeat('fx-fire-roar',.28,last(c))],
  suzuran:c=>[...c.move.contacts.slice(1).map(t=>onBeat('fx-energy-hit-1',.13,t)),onBeat('fx-wind-blast',.24,last(c))],
  wataame:c=>[...c.move.contacts.slice(1).map(t=>onBeat('fx-swing-huge',.15,t)),onBeat('fx-hit-finisher-1',.28,last(c))],
  bruin:c=>[...c.move.contacts.slice(1).map(t=>onBeat('fx-swing-huge',.15,t)),onBeat('fx-hit-finisher-1',.28,last(c))],
  senko:c=>[onBeat('fx-ki-launch',.19,c.move.contacts[1]),onBeat('fx-ki-launch',.19,c.move.contacts[2]),held('fx-beam-big',.24,last(c),last(c)+.2),onBeat('fx-energy-hit-2',.3,last(c))],
  buna:c=>[onBeat('fx-swing-huge',.25,c.move.contacts[1]),held('fx-will',.13,c.move.contacts[1],last(c)),onBeat('fx-defib-shock',.3,last(c)),onBeat('fx-land-heavy',.32,last(c))],
  shijima:c=>[bed('fx-wind-swirl',.13,c.move.contacts[1],last(c)),onBeat('fx-guard-shatter',.24,c.move.contacts[1]),onBeat('fx-wind-blast',.32,last(c))],
  akaito:c=>[bed('fx-gather',.14,c.move.contacts[1],last(c)),held('fx-beam-big',.28,last(c),last(c)+.3),onBeat('fx-energy-hit-2',.25,last(c))],
  tempo:c=>[...c.move.contacts.slice(1).map(t=>onBeat('fx-energy-hit-1',.16,t)),onBeat('fx-hit-finisher-1',.28,last(c))],
  tancho:c=>[onBeat('fx-fire-burst',.22,c.move.contacts[1]),bed('fx-wind-swirl',.17,c.move.contacts[1],last(c)),onBeat('fx-guard-shatter',.32,last(c)),onBeat('fx-wind-blast',.3,last(c))],
  oyashio:c=>[held('fx-wind-swirl',.14,c.move.contacts[1],last(c)),onBeat('fx-hit-finisher-1',.3,last(c))],
  adad:c=>[held('fx-electric-bed',.15,c.move.contacts[1],last(c)),onBeat('fx-lightning',.55,last(c)),onBeat('fx-defib-shock',.25,last(c))],
  bellows:c=>[onBeat('fx-fire-ignite',.24,c.move.contacts[1]),bed('fx-fire-bed',.18,c.move.contacts[1],last(c)),onBeat('fx-fire-roar',.32,last(c)),onBeat('fx-fire-burst',.3,last(c))],
  mikage:c=>[onBeat('fx-electric-bed',.17,c.move.contacts[1]),onBeat('fx-dash',.23,c.move.contacts[2]),onBeat('fx-defib-shock',.3,last(c))],
  'full-beam':c=>[onBeat('fx-swing-heavy-2',.28,c.move.contacts[1]),held('fx-wind-swirl',.22,c0(c)+.7,last(c)),onBeat('fx-wind-blast',.52,last(c)),onBeat('fx-land-heavy',.4,last(c))],
  pyroclast:c=>[held('fx-wind-swirl',.18,c0(c)+.15,last(c)),onBeat('fx-fire-burst',.28,c.move.contacts[1]),onBeat('fx-fire-burst',.55,last(c)),onBeat('fx-land-heavy',.35,last(c))],
  ampere:c=>[onBeat('fx-land-heavy',.2,c.move.contacts[1]),onBeat('fx-wind-blast',.38,last(c)),onBeat('fx-land-heavy',.35,last(c))],
  shanxiao:c=>[onBeat('fx-land-heavy',.36,c.move.contacts[1]),bed('fx-ki-charge',.18,1.96,last(c)),onBeat('fx-ki-launch',.48,last(c)),onBeat('fx-wind-blast',.32,last(c))],
  kuzu:c=>c.move.contacts.slice(1).map((time,i)=>onBeat(i===2?'fx-kuzu-rev':'fx-kuzu-saw-2',i===2?.42:.34,time)),
  shakugo:c=>[onBeat('fx-fire-burst',.4,c.move.contacts[1]),onBeat('fx-fire-burst',.6,last(c)),onBeat('fx-land-heavy',.45,last(c))],
  'basilissa': c => [held('fx-will', .12, c0(c) + .15, last(c), .9), onBeat(pick(FAMILY.kick, c.seed, 1), .58, last(c)), onBeat('fx-guard-shatter', .45, last(c) + .025)],
  sorayomi: c => [held('fx-wind-swirl', .14, c0(c), last(c)), held('fx-electric-bed', .19, c0(c) + .1, last(c)), onBeat('fx-lightning', .62, last(c))],
  // The dive cut belongs to a confirmed opener; a missed sweep never plays its finisher.
  strix:c=>[onBeat(pick(FAMILY.gravedigger,c.seed,1),.6,last(c),'cast',.91),onBeat('fx-slash-wave',.63,last(c)+.02,'cast',.92)],
  // The beam holds them and burns until the blast.
  ouga: c => [held('fx-beam-big', .5, c0(c) + .45, last(c) + .25)],
  // Held in the darkness; the NIGHTFALL cut is the finisher.
  nigo: c => [held('fx-ki-charge-big', .16, c0(c) + .1, last(c), .7), onBeat(pick(FAMILY.cleaver, c.seed), .5, last(c)),
    onBeat('fx-swing-huge', .46, last(c) + .02), onBeat('fx-nightfang', .4, last(c) + .03)],
  // The lightning surges through them; VOID SICKLE tears them away.
  shirokane: c => [held('fx-shrike-bolt', .24, c0(c) + .1, last(c)), ...middle(c).map((time, i) => onBeat(pick(FAMILY.zap, c.seed, i), .4, time)),
    { cue: 'fx-void-sickle', gain: .5, delay: round(last(c) - .45), phase: 'cast' }, onBeat('fx-lightning', .5, last(c))],
  // The arrow's lightning drives through them, and bursts.
  shiden: c => [held('fx-electric-bed', .2, c0(c) + .1, last(c)), ...middle(c).map((time, i) => onBeat(pick(FAMILY.zap, c.seed, i), .42, time)),
    onBeat('fx-lightning', .62, last(c) - .02)],
  // Two more Ember Leg kicks and the blaze.
  kosho: c => [held('fx-fire-bed', .24, c0(c) + .1, last(c)),
    ...middle(c).flatMap((time, i) => [onBeat(pick(FAMILY.kick, c.seed, i), .46, time), onBeat(pick(FAMILY.fireWhoosh, c.seed, i), .3, time)]),
    onBeat(pick(FAMILY.heavy, c.seed), .52, last(c)), onBeat('fx-fire-roar', .56, last(c) + .02)],
  // Round 4b (GUMMY): the GRAND TIDE - a puff of cloud as he goes SUNRISE, the fist blown up over the dazed victim
  // with Crimson Command crackling round it, brought down, and the floor going under it.
  gummy: c => [{ cue: 'fx-poof-1', gain: .4, delay: round(c0(c) + .05), phase: 'cast' },
    { cue: 'fx-gear4-inflate', gain: .46, delay: round(Math.max(c0(c) + .3, last(c) - 1.5)), phase: 'cast' },
    held('fx-electric-bed', .16, c0(c) + .4, last(c) - .05),
    onBeat(pick(FAMILY.stretch, c.seed), .42, last(c) - .22, 'cast', .6), onBeat('fx-swing-huge', .62, last(c)),
    onBeat('fx-explosion-huge', .55, last(c) + .02), { cue: 'fx-poof-2', gain: .32, delay: round(last(c) + .35), phase: 'cast' }],
  // The RAKSHASA rising behind him, two more cuts of the nine blades, and the pass-through.
  kenzo: c => [{ cue: 'fx-rakshasa', gain: .45, delay: round(c0(c) + .05), phase: 'cast' }, ...middle(c).flatMap((time, i) => swing(c, 'blade', time, true, i + 1)),
    onBeat('fx-swing-huge', .4, last(c)), onBeat(pick(FAMILY.katana, c.seed), .5, last(c)), onBeat(pick(FAMILY.katana, c.seed, 1), .42, last(c) + .02),
    onBeat(pick(FAMILY.katana, c.seed, 2), .38, last(c) + .04), { cue: 'fx-sheathe', gain: .46, delay: round(last(c) + .45), phase: 'cast' }],
  // The shock pulsing through them, and the full discharge.
  ward: c => [held('fx-electric-bed', .24, c0(c) + .1, last(c)), ...middle(c).map((time, i) => onBeat(pick(FAMILY.zap, c.seed, i), .42, time)),
    onBeat('fx-lightning', .48, last(c) - .02)],
  // The great blows and the slam.
  gaunt: c => [...middle(c).map((time, i) => onBeat(pick(FAMILY.gravedigger, c.seed, i + 1), .48, time, 'cast', wobble(c.seed + i + 1, .05))),
    onBeat('fx-swing-huge', .5, last(c)), onBeat(pick(FAMILY.gravedigger, c.seed, 1), .45, last(c), 'cast', .86)],
  // The blur of strikes, and the one that counts.
  setsu: c => [held('fx-electric-bed', .16, c0(c) + .05, last(c)),
    ...c.move.contacts.slice(1).map((time, i, rest) => onBeat(pick(FAMILY.zip, c.seed, i + 1), i === rest.length - 1 ? .45 : .22, time, 'cast', wobble(c.seed + i + 1, .06))),
    onBeat('fx-lightning', .4, last(c) + .02)],
  // Inside the stop: the clock ticking, the barrage, time resuming.
  koko: c => timeStopCinematic(c, [onBeat(pick(FAMILY.heavy, c.seed), .5, last(c)),
    // The overnight audio pass: Iron Spirit's last GAN breaks in the mids too, under the cry said on it.
    onBeat('fx-explosion-1', .46, last(c))]),
  // ... and the steamroller dropped out of the sky as time resumes: it
  // falls for the half second before the finisher and crashes on it.
  // (The overnight audio pass: the crash a little under the line said on it, which it covered.)
  oro: c => timeStopCinematic(c, [onBeat('fx-sig-lord-oro-death-knell-fall', .55, last(c) - .02), onBeat('fx-steamroller', .58, last(c))]),
  kuon: c => {
    const stop = c.move.timeStop!, close = c.move.contacts[stop.contact] + stop.duration;
    const tour = c.move.contacts.slice(stop.contact + 1, -1);
    return [onBeat('fx-blue', .42, close),
      ...tour.map((time, i) => onBeat(pick(FAMILY.zip, c.seed, i), .26, time - .1, 'cast', wobble(c.seed + i, .05))),
      onBeat(pick(FAMILY.heavy, c.seed), .5, last(c))];
  },
  // The shop's fighters' cinematics.
  // TIMBER: The Forest Falls: lightning gathers down the mast-breaker, and it comes down.
  gorai: c => [held('fx-electric-bed', .24, c0(c) + .1, last(c)), onBeat('fx-lightning', .58, last(c) - .04),
    onBeat('fx-swing-huge', .5, last(c) - .05), onBeat('fx-explosion-huge', .52, last(c) + .02)],
  // World Tilt: a tremor for every tilt of the world, and the last breaks it.
  haldor: c => [...middle(c).map((time, i) => onBeat(pick(FAMILY.explosion, c.seed, i), .4, time)),
    onBeat('fx-land-heavy', .5, last(c) - .02), onBeat('fx-explosion-huge', .62, last(c))],
  // Horizon Sunder: one cut, red lightning along it.
  sorrel: c => [onBeat('fx-swing-huge', .46, last(c) - .05), onBeat('fx-slash-wave', .6, last(c)), onBeat('fx-lightning', .42, last(c) + .02)],
  // HORIZON SUNDER: one cut, and the sky splitting along it.
  dorado: c => [onBeat('fx-swing-huge', .5, last(c) - .05), onBeat('fx-slash-wave', .62, last(c)), onBeat('fx-lightning', .46, last(c) + .02),
    onBeat('fx-explosion-huge', .4, last(c) + .06)],
  // BLACK CONFESSIONAL: the coffin humming shut, then the spears.
  shiun: c => [held('fx-electric-bed', .2, c0(c) + .1, last(c)), onBeat('fx-dark-spark', .55, last(c)), onBeat('fx-explosion-huge', .42, last(c) + .04)],
  // Open: Calamity Pyre: the fire drawn into a bow, and the arrow loosed.
  magatsu: c => [held('fx-fire-bed', .22, c0(c) + .1, last(c)), onBeat('fx-fire-roar', .5, last(c) - .08), onBeat('fx-fire-burst', .55, last(c)),
    onBeat('fx-explosion-huge', .45, last(c) + .05)],
  // The Offering: the dark humming round them as the sun goes out, then the sabre down out of it.
  vesper: c => [held('fx-electric-bed', .2, c0(c) + .1, last(c)), onBeat('fx-swing-huge', .5, last(c) - .05), onBeat('fx-dark-spark', .56, last(c)),
    onBeat('fx-explosion-huge', .42, last(c) + .05)],
  // The Final Molt: a blow out of the combo, and both fists down into the floor through them.
  imago: c => [...middle(c).map((time, i) => onBeat(pick(FAMILY.hitHeavy, c.seed, i), .46, time)), onBeat('fx-swing-huge', .46, last(c) - .06),
    onBeat('fx-land-heavy', .55, last(c)), onBeat('fx-explosion-huge', .5, last(c) + .03),
    // The overnight audio pass: the blow breaking out through them, in the mids (his call is said by then).
    onBeat('fx-ki-launch', .44, last(c)), onBeat('fx-wind-blast', .4, last(c) + .03)],
  // Heaven's Harvest: Rose's ki drawn up into the scythe, then the swing and the cut through them.
  'wuming': c => [held('fx-purple-charge', .24, c0(c) + .1, last(c)), onBeat('fx-swing-huge', .5, last(c) - .05), onBeat('fx-slash-wave', .6, last(c)),
    onBeat('fx-explosion-huge', .45, last(c) + .05)],
  // Mountain-Felling Fist: his power building in the raised fist through the leap, then the dive and the blow through them.
  jirenga: c => [held('fx-ki-charge-big', .22, c0(c) + .1, last(c)), onBeat('fx-swing-huge', .5, last(c) - .06), onBeat(pick(FAMILY.finisher, c.seed), .55, last(c)),
    onBeat('fx-explosion-huge', .5, last(c) + .04)],
  // The Sun-Seizing Spiral: the beam boring on through them, its spiral whistling round it, and the burst out behind.
  'gohaku': c => [held('fx-beam-big', .42, c0(c) + .3, last(c) + .1), held('fx-wind-swirl', .18, c0(c) + .3, last(c)),
    onBeat('fx-explosion-huge', .46, last(c) + .02)],
  // Shatter Art: Black Blizzard: the dash through them, and everything he has in one blow.
  sekka: c => [onBeat('fx-swing-huge', .5, last(c) - .06), onBeat(pick(FAMILY.finisher, c.seed), .6, last(c)), onBeat('fx-explosion-huge', .55, last(c) + .03)],
  // The Clean Slate: the air drawn in as he settles, then one punch, and everything in front of him goes.
  ippon: c => [held('fx-wind-swirl', .2, c0(c) + .25, last(c)), onBeat('fx-swing-huge', .52, last(c) - .06), onBeat(pick(FAMILY.finisher, c.seed), .6, last(c)),
    onBeat('fx-explosion-huge', .58, last(c) + .03)],
  // Heaven's Anvil: the meteor's rumble as it comes down, and the crater.
  akagane: c => [held('fx-ki-charge-big', .2, c0(c) + .1, last(c), .5), onBeat('fx-swing-huge', .4, last(c) - .1), onBeat('fx-explosion-huge', .64, last(c)),
    onBeat('fx-land-heavy', .5, last(c) + .02),
    // The overnight audio pass: the meteor's crash in the mids, and its burning (both under 5% in the speech band, under
    // the "dō suru" said on it).
    onBeat('fx-explosion-2', .4, last(c)), onBeat('fx-fire-burst', .44, last(c) + .02)],
  // Lantern Rite: First Light: the blade burning through the leap, and the cut of fire.
  asahi: c => [held('fx-fire-bed', .24, c0(c) + .1, last(c)), onBeat('fx-fire-roar', .5, last(c) - .05), onBeat(pick(FAMILY.katana, c.seed), .5, last(c)),
    onBeat('fx-explosion-huge', .42, last(c) + .04)],
  // The SOJI: Clean Sweep: both blades whirling through them, and the last pass.
  levin: c => [...Array.from({ length: 8 }, (_, i) => onBeat(pick(FAMILY.katana, c.seed, i), .3, c0(c) + .2 + i * .14)), onBeat('fx-swing-huge', .46, last(c) - .05),
    onBeat(pick(FAMILY.cutHeavy, c.seed), .55, last(c))],
  // Black Rookery: the shadows humming up out of the floor, and falling on them.
  'rook': c => [held('fx-ki-charge-big', .16, c0(c) + .1, last(c), .6), onBeat('fx-swing-huge', .46, last(c) - .05), onBeat('fx-dark-spark', .54, last(c)),
    onBeat('fx-explosion-huge', .4, last(c) + .05)],
  // Landslide: the aura flooding into the fist he raises, then the Rock, and everything in front of him goes.
  gaku: c => [held('fx-ki-charge-big', .2, c0(c) + .1, last(c), .5), onBeat('fx-swing-huge', .5, last(c) - .06), onBeat(pick(FAMILY.finisher, c.seed), .6, last(c)),
    onBeat('fx-explosion-huge', .58, last(c) + .03),
    // The overnight audio pass: the Rock's blast in the mids and the floor under it (under the "gū" said on it).
    onBeat('fx-explosion-2', .42, last(c) + .01), onBeat('fx-land-heavy', .5, last(c) + .02)],
  // Red Moon Reverie: the illusion humming low round them under the red moon, then it breaks them.
  tobari: c => [held('fx-ki-charge-big', .16, c0(c) + .1, last(c), .6), onBeat('fx-swing-huge', .44, last(c) - .05), onBeat('fx-dark-spark', .54, last(c)),
    onBeat('fx-explosion-huge', .42, last(c) + .05)],
};
if (LUCY_TIDE) SIGNATURE_CONFIRMS.gummy = c => [onBeat(pick(FAMILY.snap, c.seed), .34, c0(c) + .3), onBeat('fx-el-sand-cast', .42, c0(c) + .36),
  held('fx-wind-swirl', .2, c0(c) + .45, last(c) - .05), onBeat('fx-el-sand-rush', .4, last(c) - 1.1), onBeat('fx-gather', .34, last(c) - .9),
  onBeat(pick(FAMILY.stretch, c.seed), .44, last(c) - .5, 'cast', .7), onBeat(pick(FAMILY.stretch, c.seed, 1), .4, last(c) - .3, 'cast', .55),
  onBeat('fx-swing-huge', .62, last(c)), onBeat('fx-explosion-huge', .5, last(c) + .02), onBeat('fx-el-sand-hit', .62, last(c) + .03),
  onBeat('fx-el-sand-tail', .45, last(c) + .3)];

// ---------------------------------------------------------------- releases

/** Release events: beams are drawn on them, so beams are heard on them. */
/** Combo enders (game/combos.ts) with a sound of their own: Sekka's stun opens the Aurora Shards' snowflake.
 *  (5 October) The main game's sixteen (combosVol1.ts): every blast and snare is heard as what it is - a style's default
 *  is a ki charge, and a snare's a fire igniting, which neither a THEATRE nor a water dragon is - and the blows that carry
 *  their fighter's energy (a Shrike Bolt, a Senpugan, a Dark Spark, a THEATRE) carry its sound over the swing. Kurobi throws
 *  Konta's enders as the fox, and the NIGHTFALL's stun is a blow, not the mask's Void Ray. */
const swung = (extra: (c: Ctx) => CueLayer[]) => (c: Ctx) => [...meleeSwings(c), ...extra(c)];
// (15 October, the feel pass) Tsubute's enders are slingshot shots, Basilissa's stun a kiss shot: they were the default
// projectile's one ki blast (-28 LUFS, 3 to 4 dB under every original's ender). Psyche's are her blows with the
// limbs blooming on them.
const slingshot = (c: Ctx): CueLayer[] => [onBeat('fx-stretch-2', .3, Math.max(.04, c0(c) - .06)), onBeat('fx-snap-2', .38, c0(c)), onBeat(pick(FAMILY.kiBlast, c.seed), .4, c0(c) + .01)];
const bloom = swung(c => [onBeat('fx-stretch-1', .24, Math.max(.04, c0(c) - .05)), onBeat('fx-snap-1', .22, c0(c) + .02)]);
const ENDER_CASTS: Partial<Record<FighterId, Partial<Record<ComboKey, (c: Ctx) => CueLayer[]>>>> = {
  tsubute: { lh: slingshot, llh: slingshot, lllh: slingshot, llls: slingshot, airHeavy: slingshot },
  'basilissa': { llls: c => [onBeat('fx-zip-2', .44, c0(c), 'cast', 1.2), onBeat(pick(FAMILY.kiBlast, c.seed), .4, c0(c) + .01)] },
  'psyche': { lh: bloom, llh: bloom, lllh: bloom, llls: bloom },
  sekka: { llls: c => [bed('fx-wind-swirl', .2, .1, c0(c)), onBeat('fx-swing-huge', .42, c0(c) - .04), onBeat(pick(FAMILY.explosion, c.seed), .44, c0(c))] },
  taisei: {
    // The Monkey King Fist: a punch with the whole body's ki behind it.
    lh: swung(c => [bed('fx-ki-charge', .14, 0, c0(c)), onBeat('fx-ki-launch', .38, c0(c))]),
    // The Blackout Flash: a flash, not a fire.
    llls: c => [bed('fx-gather', .16, 0, c0(c)), onBeat('fx-sword-ring', .42, c0(c)), onBeat('fx-wind-blast', .26, c0(c) + .02)],
  },
  ouga: {
    // Coronation: two fingers raised, and the target goes up.
    llh: c => [bed('fx-ki-charge', .15, 0, c0(c)), onBeat(pick(FAMILY.explosion, c.seed), .52, c0(c))],
    // The Rage Volley: a volley, not one shot.
    llls: c => [bed('fx-ki-charge', .16, 0, c0(c)), ...[-.15, -.1, -.05, 0].map((dt, i) => onBeat(pick(FAMILY.kiBlast, c.seed, i), i === 3 ? .5 : .36, Math.max(.04, c0(c) + dt)))],
  },
  konta: {
    lh: c => c.awakened ? meleeSwings(c) : [...meleeSwings(c), onBeat('fx-wind-blast', .3, c0(c))],
    lllh: c => c.awakened ? meleeSwings(c) : [bed('fx-whirlsphere', .3, 0, c0(c) + .1), ...meleeSwings(c)],
    // The Mini Galewheel's whine as it leaves the fingertip; the fox's Great Roar.
    llls: c => c.awakened ? [onBeat('fx-beast-roar', .62, c0(c))] : [bed('fx-whirlsphere', .2, 0, c0(c)), onBeat('fx-wind-blast', .4, c0(c))],
    airHeavy: c => c.awakened ? meleeSwings(c) : [onBeat(pick(FAMILY.poof, c.seed), .26, .02), ...meleeSwings(c)],
  },
  gummy: {
    // The giant fist blown up before it lands.
    lh: swung(c => [onBeat('fx-gear4-inflate', .3, Math.max(.06, c0(c) - .12))]),
    // Waterspout: the barrage carries them up.
    llh: c => [...meleeSwings(c), ...[-.12, -.08, -.04].map((dt, i) => onBeat(pick(FAMILY.jab, c.seed, i), .3, Math.max(.04, c0(c) + dt)))],
  },
  kosho: {
    airHeavy: swung(c => [onBeat('fx-wind-swirl', .2, Math.max(.05, c0(c) - .1))]),
  },
  shirokane: {
    // The water dragon rushing out; the earth giving way under them; the hounds bursting out of the ground.
    lh: c => [bed('fx-wind-swirl', .18, 0, c0(c)), onBeat('fx-swing-huge', .44, c0(c)), onBeat('fx-wind-blast', .3, c0(c) + .03)],
    lllh: c => [onBeat('fx-land-heavy', .5, c0(c)), onBeat('fx-ground-bounce', .34, c0(c) + .04)],
    llls: c => [onBeat(pick(FAMILY.poof, c.seed), .3, Math.max(.05, c0(c) - .1)), onBeat('fx-land-heavy', .34, c0(c)), onBeat('fx-beast-bite', .44, c0(c) + .03)],
    // His lightning bolt thrown as a hound.
    airHeavy: c => [bed('fx-shrike-bolt', .24, 0, c0(c)), onBeat('fx-lightning', .42, c0(c))],
  },
  shiden: {
    lh: swung(c => [bed('fx-shrike-bolt', .3, 0, c0(c) + .08)]),
    llh: swung(c => [bed('fx-shrike-bolt', .26, 0, c0(c) + .06)]),
    lllh: c => [onBeat('fx-fire-ignite', .32, Math.max(.05, c0(c) - .08)), onBeat('fx-fire-roar', .5, c0(c))],
    // The Shrike Bolt let out through his whole body.
    llls: c => [bed('fx-electric-bed', .28, 0, c0(c) + .1), onBeat('fx-shrike-bolt-hit', .46, c0(c)), onBeat(pick(FAMILY.zap, c.seed), .3, c0(c) + .03)],
    airHeavy: c => [bed('fx-shrike-bolt', .22, 0, c0(c)), ...[-.04, 0, .04].map((dt, i) => onBeat(pick(FAMILY.zap, c.seed, i), .3, Math.max(.04, c0(c) + dt)))],
  },
  kenzo: {
    // The great dragon twister, its wind round the blades.
    llh: swung(c => [bed('fx-wind-swirl', .24, 0, c0(c) + .1)]),
    airHeavy: swung(c => [onBeat('fx-fire-ignite', .3, c0(c) + .03)]),
  },
  koko: {
    // The receipt is paid in a barrage; the inhale pulls the air in.
    llh: c => [...barrageBed(Math.max(0, c0(c) - .25), c0(c), .32), ...meleeSwings(c)],
    llls: c => [bed('fx-wind-swirl', .3, 0, c0(c) + .1), onBeat('fx-spirit', .3, .02)],
  },
  nigo: {
    // The mask's Void Ray, gathered at the mask; the NIGHTFALL's stun is a blow.
    llls: c => c.awakened ? meleeSwings(c) : [bed('fx-ki-charge', .18, 0, c0(c)), onBeat('fx-ki-launch', .5, c0(c)), onBeat('fx-black-flame', .24, c0(c) + .02)],
  },
  kagari: {
    lh: c => [onBeat('fx-fire-ignite', .26, Math.max(.04, c0(c) - .08)), onBeat(pick(FAMILY.fireWhoosh, c.seed), .4, c0(c)), onBeat(pick(FAMILY.fireWhoosh, c.seed, 1), .3, c0(c) + .06)],
    llh: swung(c => [onBeat('fx-fire-roar', .34, c0(c))]),
    lllh: c => [bed('fx-fire-bed', .16, 0, c0(c)), onBeat(pick(FAMILY.fireWhoosh, c.seed), .46, c0(c)), onBeat('fx-fire-burst', .3, c0(c) + .04)],
    // Hinoko's fireflies all flaring at once.
    llls: c => [onBeat('fx-embers', .3, Math.max(.05, c0(c) - .15)), onBeat('fx-fire-burst', .5, c0(c))],
    airHeavy: c => [onBeat('fx-fire-roar', .5, c0(c))],
  },
  ward: {
    // THEATRE opens, and the target is swapped away.
    lh: c => [onBeat('fx-room', .4, .02), onBeat('fx-crossmatch', .48, c0(c))],
    lllh: swung(c => [onBeat('fx-defib-shock', .42, c0(c) + .02)]),
    llls: swung(c => [onBeat('fx-room', .3, .02), onBeat(pick(FAMILY.snap, c.seed), .3, c0(c) + .03)]),
  },
  kuon: {
    lh: swung(c => [onBeat('fx-dark-spark', .54, c0(c))]),
    llh: c => [bed('fx-gather', .2, 0, c0(c)), onBeat('fx-blue', .54, c0(c))],
    // Everything that comes near him slowed to nothing.
    llls: c => [bed('fx-gather', .18, 0, c0(c) + .2), onBeat('fx-blue', .3, c0(c), 'cast', .7)],
  },
  oro: {
    lh: c => [onBeat(pick(FAMILY.zip, c.seed), .4, c0(c)), onBeat(pick(FAMILY.snap, c.seed), .28, c0(c) + .02)],
    // HUSH is gone and behind them.
    lllh: c => [onBeat('fx-vanish', .36, .04), onBeat('fx-spirit', .3, Math.max(.06, c0(c) - .1)), ...meleeSwings(c)],
    // The touch that freezes: a hiss of vapour.
    llls: swung(c => [onBeat('fx-steam', .4, c0(c) + .02)]),
  },
  gaunt: {
    // The crossbow cranked: three bolts.
    lh: c => [onBeat(pick(FAMILY.armour, c.seed), .28, .04), ...[-.08, -.04, 0].map((dt, i) => onBeat(pick(FAMILY.clockHandKnives, c.seed, i), .36, Math.max(.06, c0(c) + dt)))],
    llh: swung(c => [onBeat(pick(FAMILY.armour, c.seed), .3, c0(c))]),
    // The fuse lit and the bomb going off.
    llls: c => [onBeat('fx-fire-ignite', .26, .04), onBeat(pick(FAMILY.explosion, c.seed), .54, c0(c))],
  },
  setsu: {
    lh: c => [onBeat(pick(FAMILY.zip, c.seed), .4, Math.max(.05, c0(c) - .05)), onBeat(pick(FAMILY.heavy, c.seed), .4, c0(c))],
    llh: swung(c => [onBeat(pick(FAMILY.zip, c.seed), .3, Math.max(.04, c0(c) - .06)), onBeat(pick(FAMILY.zap, c.seed), .28, c0(c))]),
  },
};

/** (5 October) A ground smash lands in its fighter's element, over the thud every one of them makes: the main game's
 *  sixteen, each from their special or their signature energy (combosVol1.ts). */
const landed = (cue: AudioCue, gain: number, delay = 0): CueLayer => ({ cue, gain, ...(delay > 0 ? { delay } : {}), phase: 'impact' });
const ENDER_LANDS: Partial<Record<FighterId, (c: Ctx) => CueLayer[]>> = {
  taisei: () => [landed('fx-ki-launch', .5), landed('fx-explosion-huge', .42, .04)],
  ouga: () => [landed('fx-explosion-huge', .6)],
  konta: c => c.awakened ? [landed('fx-explosion-huge', .54)] : [landed('fx-whirlsphere-hit', .6)],
  gummy: () => [landed('fx-fire-burst', .5), landed(FAMILY.hitHeavy[0], .4, .02)],
  kosho: () => [landed('fx-fire-burst', .46)],
  shirokane: c => [landed('fx-lightning', .54), landed(pick(FAMILY.zap, c.seed), .3, .03)],
  shiden: () => [landed('fx-lightning', .62), landed(FAMILY.explosion[0], .36, .05)],
  kenzo: () => [landed('fx-slash-wave', .54)],
  koko: c => [landed(pick(FAMILY.barrage, c.seed), .44), landed(pick(FAMILY.barrage, c.seed, 1), .36, .06)],
  nigo: () => [landed('fx-nightfang', .56)],
  kagari: () => [landed('fx-fire-roar', .58)],
  ward: () => [landed('fx-defib-shock', .5)],
  kuon: () => [landed('fx-purple', .5)],
  oro: c => [landed(pick(FAMILY.knifeHit, c.seed), .42), landed(pick(FAMILY.knifeHit, c.seed, 1), .36, .05)],
  gaunt: () => [landed('fx-cannon', .58)],
  setsu: c => [landed('fx-lightning', .5), landed(pick(FAMILY.zap, c.seed), .3, .03)],
};

/** A ground smash of a fighter with no landing of their own above: their special's element where it lands (the feel pass). */
function elementLanding(c: Ctx): CueLayer[] {
  const family = familyOf(c.fighter, 'special', c.awakened);
  return family ? fromNow(FAMILIES[family].hit, c.seed, .7) : [];
}

function releaseLayers(c: Ctx): CueLayer[] {
  // A ground smash striking the floor (game/combos.ts).
  if (c.event.branch === 'airSpecial') return [{ cue: 'fx-land-heavy', gain: .7, phase: 'impact' }, { cue: 'fx-ground-bounce', gain: .5, delay: .03, phase: 'impact', rate: .8 },
    ...(ENDER_LANDS[c.fighter]?.(c) ?? elementLanding(c))];
  if (c.move.style !== 'beam') return [];
  // Round 3d (ULTS): a hit-confirm beam is released once, as its opener; the
  // cinematic's blows release too, and are heard as blows. The beam sounds
  // for as long as a whiff would last, and a landed one burns on from the
  // confirm (SIGNATURE_CONFIRMS).
  if (c.move.confirm && c.slot === 'ultimate') {
    if ((c.event.contactIndex ?? 0) !== 0) return [];
    const burst = activeWindow(c.move) + c.move.confirm.recovery + .05;
    return c.fighter === 'nigo' ? [] : [{ cue: 'fx-beam-big', gain: .54, duration: round(burst), phase: 'release' }];
  }
  const length = Math.max(.4, c.move.duration - c0(c));
  switch (c.fighter) {
    // Under the 'HAAA' of the recorded call, which stays in front.
    case 'taisei': return [{ cue: 'fx-beam', gain: .36, duration: round(length + .25), phase: 'release' }];
    case 'ouga': return c.slot === 'ultimate'
      ? [{ cue: 'fx-beam-big', gain: .54, duration: round(length + .2), phase: 'release' }]
      : [{ cue: 'fx-beam', gain: .5, duration: round(length + .25), phase: 'release' }];
    case 'kuon': return [{ cue: 'fx-purple', gain: .62, phase: 'release' }];
    // Ippon's Dust Allergy: a gust, not a beam of ki.
    case 'ippon': return [{ cue: 'fx-wind-blast', gain: .62, phase: 'release' }, { cue: 'fx-wind-swirl', gain: .3, delay: .05, phase: 'release' }];
    // NIGHTFALL's wave is scheduled from the cast (fx-nightfall), timed on the wipe.
    case 'nigo': return [];
    default: return [{ cue: c.slot === 'ultimate' ? 'fx-beam-big' : 'fx-beam', gain: .5, duration: round(length + .2), phase: 'release' }];
  }
}

// ---------------------------------------------------------------- impacts

function impactLayers(event: CombatEvent, awakened: boolean): CueLayer[] {
  const fighter = event.fighter, slot = event.slot, seed = seedOf(event);
  if (!fighter || !slot) {
    // A body with no roster fighter behind it (arcade survival's horde).
    const heavy = slot === 'heavy' || slot === 'special' || slot === 'ultimate';
    return [{ cue: pick(heavy ? FAMILY.hitHeavy : FAMILY.hitLight, seed), gain: heavy ? .7 : .6, rate: wobble(seed, .04), phase: 'impact' }];
  }
  const c = context(event, fighter, slot, awakened);
  const index = event.contactIndex ?? 0, final = index >= c.move.contacts.length - 1;
  // A combo ender lands as the blow it is (context reads its move), never as its slot's signature.
  const special = event.branch ? undefined : SIGNATURE_IMPACTS[fighter]?.[slot];
  // A hit-confirm ultimate with no landing of its own (SIGNATURE_IMPACTS): its opener catches them (catchBlow), and an
  // energy move's blows between are its energy striking, not each a detonation; its last keeps the detonation.
  const opened = !special && slot === 'ultimate' && !!c.move.confirm && !final;
  const layers = special ? special(c, index, final)
    : slot === 'area' ? areaBlow(c)
    : opened && index === 0 ? catchBlow(c)
    : opened && c.move.style !== 'melee' ? [{ cue: pick(FAMILY.energyHit, seed, index), gain: .46, rate: wobble(seed + index, .06) }]
    : c.move.style === 'melee' ? meleeImpact(c, index, final) : energyImpact(c);
  return [...layers, ...awakenedImpact(c), ...familyHit(c, index, final, layers), ...signatureHit(c, final), ...sentUp(event, c)].map(layer => ({ ...layer, phase: 'impact' as const }));
}

/** A blow that launches (the hit's `reaction`): the air the body takes with it as it goes up, over the blow itself. A
 *  launcher was heard as any blow of its weight. */
function sentUp(event: CombatEvent, c: Ctx): CueLayer[] {
  return event.reaction === 'launched' ? [sfxNew.launch(c.seed, c.fighter) ?? { cue: pick(FAMILY.heavy, c.seed, 1), gain: .2, rate: 1.22, delay: .02 }] : [];
}

/** The overnight audio pass (8 October 2026): the blow that catches them and opens a hit-confirm ultimate's cinematic.
 *  With no landing of its own it was a barrage tick (a melee move's first contact, weighed as one of many) or a full
 *  detonation (an energy move's: Horizon Sunder's and BLACK CONFESSIONAL's buried the call said over them). Now a heavy body
 *  blow with a burst of energy in the mids (fx-energy-hit, 55% of it at 200-1000 Hz): heard over the soundtrack on a
 *  laptop's speakers, and still under the finisher, which keeps the detonation. */
function catchBlow(c: Ctx): CueLayer[] {
  return c.move.style === 'melee'
    ? [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .66, rate: wobble(c.seed, .04) }, { cue: pick(FAMILY.energyHit, c.seed), gain: .34 }]
    : [{ cue: pick(FAMILY.explosion, c.seed), gain: .44 }, { cue: pick(FAMILY.energyHit, c.seed), gain: .3 }];
}

type Weight = 'light' | 'tick' | 'heavy' | 'finisher';
function weightOf(c: Ctx, final: boolean): Weight {
  if (c.slot === 'light') return c.stage === 3 ? 'finisher' : 'light';
  if (!final) return c.slot === 'heavy' ? 'light' : 'tick';
  return c.slot === 'heavy' && c.move.contacts.length === 1 ? 'heavy' : 'finisher';
}

/** A melee blow landing, by what it is and how hard it is. */
function meleeImpact(c: Ctx, index: number, final: boolean): CueLayer[] {
  const weight = weightOf(c, final), seed = c.seed, rate = wobble(seed, .05);
  const blow = blowOf(c), heavy = weight === 'heavy' || weight === 'finisher';
  const layers: CueLayer[] = [];
  if (weight === 'tick') {
    layers.push({ cue: pick(FAMILY.barrage, seed, index), gain: .5, rate: wobble(seed + index, .08) });
    if (blow === 'blade') layers.push({ cue: pick(FAMILY.cut, seed, index), gain: .3, rate: 1.1 });
    return layers;
  }
  switch (blow) {
    case 'blade': {
      const great = c.fighter === 'gaunt', small = c.fighter === 'shirokane' || c.fighter === 'setsu' || c.fighter === 'tobari';
      if (great || heavy) layers.push({ cue: pick(FAMILY.cutHeavy, seed), gain: great && !heavy ? .62 : .72, rate: round(rate * (great ? .92 : 1)) });
      else layers.push({ cue: pick(FAMILY.cut, seed, index), gain: small ? .52 : .62, rate: round(rate * (small ? 1.14 : 1)) });
      if (heavy && !small) layers.push({ cue: 'fx-sword-ring', gain: .16, delay: .02, rate: wobble(seed, .06) });
      if (weight === 'finisher' && great) layers.push({ cue: 'fx-land-heavy', gain: .42, delay: .02 });
      break;
    }
    case 'kick':
      layers.push({ cue: pick(FAMILY.hitKick, seed, index), gain: heavy ? .7 : .62, rate: heavy ? round(rate * .94) : rate });
      if (weight === 'finisher') layers.push({ cue: pick(FAMILY.finisher, seed), gain: .5 });
      else if (heavy) layers.push({ cue: pick(FAMILY.hitHeavy, seed), gain: .42 });
      break;
    case 'beast':
      layers.push({ cue: pick(FAMILY.hitHeavy, seed, index), gain: .62, rate: round(rate * .9) });
      if (heavy) layers.push({ cue: 'fx-beast-bite', gain: .5 });
      break;
    case 'rubber':
      layers.push({ cue: heavy ? pick(FAMILY.hitHeavy, seed) : pick(FAMILY.hitLight, seed, index), gain: heavy ? .7 : .62, rate });
      layers.push({ cue: pick(FAMILY.snap, seed, 1), gain: .22, delay: .02, rate: wobble(seed, .08) });
      if (weight === 'finisher') layers.push({ cue: pick(FAMILY.finisher, seed), gain: .45 });
      break;
    case 'spirit':
      // Iron Spirit and HUSH hit harder than a man does.
      layers.push({ cue: heavy ? pick(FAMILY.hitHeavy, seed) : pick(FAMILY.hitLight, seed, index), gain: heavy ? .72 : .64, rate });
      if (!heavy) layers.push({ cue: pick(FAMILY.hitHeavy, seed), gain: .3, rate: 1.08 });
      if (weight === 'finisher') layers.push({ cue: pick(FAMILY.finisher, seed), gain: .5 });
      break;
    default:
      if (weight === 'finisher') layers.push({ cue: pick(FAMILY.finisher, seed), gain: .72, rate: round(rate * .96) });
      else if (weight === 'heavy' || blow === 'axe') layers.push({ cue: pick(FAMILY.hitHeavy, seed, index), gain: .72, rate });
      else layers.push({ cue: pick(FAMILY.hitLight, seed, index), gain: .64, rate });
  }
  // Rush-finisher flourishes.
  if (c.slot === 'light' && c.stage === 3) {
    if (c.fighter === 'kuon') layers.push({ cue: 'fx-red', gain: .52 });
    if (c.fighter === 'setsu' || c.fighter === 'shirokane') layers.push({ cue: pick(FAMILY.zap, seed), gain: .36 });
    if (c.fighter === 'kagari') layers.push({ cue: 'fx-fire-burst', gain: .4 });
    if (c.fighter === 'nigo') layers.push({ cue: pick(FAMILY.energyHit, seed), gain: .38 });
  }
  if (c.fighter === 'kagari' && c.slot === 'light' && c.stage < 3) layers.push({ cue: pick(FAMILY.burn, seed), gain: .26 });
  return layers;
}

/** An energy move with no signature impact: sized by slot. A heavy or a special whose element does not go off where it
 *  lands (an ice lance, a current of water, a blade of sand: sfxFamilies.ts `explodes`) lands as a blow of its size, and
 *  the family's hit over it is what it sounds like (familyHit) - it was the same blast as a ki bomb's. */
function energyImpact(c: Ctx): CueLayer[] {
  // (An ultimate's last blow keeps its detonation whatever it is made of: the finisher the 8 October pass balanced.)
  if (c.slot === 'ultimate') return [{ cue: 'fx-explosion-huge', gain: .8 }];
  // (15 October, the feel pass) A ground smash lands as the originals' all do - a blast and the energy in it - whatever
  // its fighter's special is made of: 35 of the 60 newer fighters' landed as a body blow (-13.6 LUFS against -11), with
  // none of the blast's low end. What it is made of is heard over it at the landing (releaseLayers).
  if (c.event.branch === 'airSpecial') return [{ cue: pick(FAMILY.explosion, c.seed), gain: .66 }, { cue: pick(FAMILY.energyHit, c.seed), gain: .3 }];
  const family = familyOf(c.fighter, c.slot, c.awakened);
  // (A special's blow of its size is the body taking it and the floor under it: at .6 alone it was 2 dB under every
  // original's ranged special and thin under 150 Hz - the feel pass.)
  // (The floor's thud is pitched lower than the big blow's, CombatAudio.bigBlow, and laid on the blow: the same sample a
  // hair apart at one pitch cancelled its own low end.) A combo ender's shot is the string's last blow and lands as big.
  if (family && !FAMILIES[family].explodes) return c.slot === 'special' || c.event.branch
    ? [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .8, rate: wobble(c.seed, .05) }, { cue: 'fx-land-heavy', gain: .3, rate: .7 },
      ...(c.event.branch ? [{ cue: pick(FAMILY.finisher, c.seed), gain: .55 }] : [])]
    : [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .54, rate: wobble(c.seed, .05) }];
  if (c.slot === 'special') return [{ cue: pick(FAMILY.explosion, c.seed), gain: .66 }, { cue: pick(FAMILY.energyHit, c.seed), gain: .3 }];
  if (c.slot === 'heavy') return [{ cue: pick(FAMILY.explosion, c.seed), gain: .6 }];
  return [{ cue: pick(FAMILY.energyHit, c.seed), gain: .55, rate: wobble(c.seed, .05) }];
}

/** A transformation lands harder, and in its own way. */
function awakenedImpact(c: Ctx): CueLayer[] {
  if (!c.awakened) return [];
  switch (c.fighter) {
    case 'setsu': return [{ cue: pick(FAMILY.zap, c.seed, 2), gain: .24 }];
    case 'kosho': case 'kagari': return c.move.style === 'melee' ? [{ cue: pick(FAMILY.burn, c.seed), gain: .24 }] : [];
    case 'gummy': return c.move.style === 'melee' ? [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .32, rate: .86 }] : [];
    case 'gaunt': return [{ cue: pick(FAMILY.armour, c.seed, 1), gain: .2 }];
    case 'kuon': return c.slot === 'light' ? [{ cue: pick(FAMILY.zap, c.seed), gain: .12 }] : [];
    default: return c.move.style === 'melee' && c.slot !== 'ultimate' ? [{ cue: pick(FAMILY.hitHeavy, c.seed, 2), gain: .22, rate: .88 }] : [];
  }
}

type ImpactPlan = (c: Ctx, index: number, final: boolean) => CueLayer[];
/** An ultimate's detonation. */
const detonation = (seed: number): CueLayer[] => [{ cue: 'fx-explosion-huge', gain: .72 }, { cue: pick(FAMILY.finisher, seed), gain: .45 }];
/** Several finishers land in one tick (a time stop's resume blast), one hit
 *  event per victim with consecutive ids. Each is nudged by its id - another
 *  take, 11 ms later, a few cents off - so they sound as a volley of blows
 *  rather than one sample summed into a spike. */
function volley(c: Ctx, layers: CueLayer[]): CueLayer[] {
  const k = c.event.id % 4, delay = round(k * .011);
  return layers.map((layer, i) => ({ ...layer, rate: round((layer.rate ?? 1) * wobble(c.seed + i, .05)), ...(delay ? { delay: round((layer.delay ?? 0) + delay) } : {}) }));
}
/** A time stop's finisher on one victim. */
const resumeBlow = (c: Ctx): CueLayer[] => volley(c, [
  { cue: pick(FAMILY.finisher, c.event.id), gain: .64 }, { cue: pick(FAMILY.hitHeavy, c.event.id), gain: .42, rate: .92 }]);
const barrageTick = (c: Ctx, index: number): CueLayer[] => [{ cue: pick(FAMILY.barrage, c.seed, index), gain: .44, rate: wobble(c.seed + index, .08) }];
/** Round 3d (ULTS): a hit-confirm ultimate lands three ways - the opener
 *  that catches them, the cinematic's blows between, and the finisher, which
 *  keeps the signature sound it always had. Its opener used to be the whole
 *  move; now the finisher alone is the detonation. */
const confirmBlow = (opener: (c: Ctx) => CueLayer[], tick: (c: Ctx, index: number) => CueLayer[], finisher: (c: Ctx) => CueLayer[]): ImpactPlan =>
  (c, index, final) => final || !c.move.confirm ? finisher(c) : index === 0 ? opener(c) : tick(c, index);

const SIGNATURE_IMPACTS: Partial<Record<FighterId, Partial<Record<AttackSlot, ImpactPlan>>>> = {
  'full-beam':{heavy:meleeImpact,special:()=>[{cue:'fx-wind-blast',gain:.46},{cue:'fx-hit-heavy-1',gain:.62},{cue:'fx-hit-finisher-1',gain:.36},{cue:'fx-land-heavy',gain:.34,rate:.7}],ultimate:(c,i,final)=>[...meleeImpact(c,i,final),...(final?[{cue:'fx-wind-blast' as const,gain:.38}]:[])]},
  pyroclast:{heavy:(c,i,final)=>[...meleeImpact(c,i,final),{cue:'fx-fire-burst',gain:.18}],special:()=>[{cue:'fx-fire-burst',gain:.3},{cue:'fx-wind-blast',gain:.17}],ultimate:(c,i,final)=>[...meleeImpact(c,i,final),...(final?[{cue:'fx-fire-burst' as const,gain:.38}]:[])]},
  ampere:{heavy:(c,i,final)=>[...meleeImpact(c,i,final),{cue:'fx-wind-blast',gain:.16}],special:()=>[{cue:'fx-wind-blast',gain:.46},{cue:'fx-hit-heavy-1',gain:.6},{cue:'fx-hit-finisher-1',gain:.36},{cue:'fx-land-heavy',gain:.34,rate:.7}],ultimate:(c,i,final)=>[...meleeImpact(c,i,final),...(final?[{cue:'fx-wind-blast' as const,gain:.34}]:[])]},
  shanxiao:{special:()=>[{cue:'fx-ki-launch',gain:.28},{cue:'fx-land-heavy',gain:.2}],ultimate:(c,i,final)=>[...meleeImpact(c,i,final),...(final?[{cue:'fx-wind-blast' as const,gain:.4}]:[])]},
  kuzu:{special:(c,i,final)=>[...meleeImpact(c,i,final),{cue:'fx-kuzu-saw-2',gain:.24}],ultimate:(c,i,final)=>[...meleeImpact(c,i,final),{cue:'fx-kuzu-saw-1',gain:final?.3:.18}]},
  shakugo:{heavy:(c,i,final)=>[...meleeImpact(c,i,final),{cue:'fx-fire-burst',gain:.2}],special:()=>[{cue:'fx-fire-burst',gain:.5},{cue:'fx-land-heavy',gain:.25}],ultimate:(c,i,final)=>[...meleeImpact(c,i,final),{cue:'fx-fire-burst',gain:final?.52:.2}]},
  'basilissa': {
    light: (c, index, final) => c.move.style === 'melee' ? meleeImpact(c, index, final) : [{ cue: 'fx-energy-hit-1', gain: .24, rate: 1.3 }],
    heavy: (c, index, final) => [...meleeImpact(c, index, final), { cue: 'fx-guard-shatter', gain: final ? .3 : .12, rate: 1.1 }],
    special: () => [{ cue: 'fx-energy-hit-2', gain: .38, rate: 1.25 }, { cue: 'fx-guard-shatter', gain: .22 }, { cue: 'fx-land-heavy', gain: .3, rate: .7 }],
    ultimate: (c, index, final) => [...meleeImpact(c, index, final), { cue: 'fx-guard-shatter', gain: final ? .55 : .18 }],
  },
  sorayomi: {
    // (The feel pass: the gust lands as a blow of its size, with the ground under it; the last bolt shakes the floor.)
    special: c => [{ cue: 'fx-wind-blast', gain: .5 }, { cue: pick(FAMILY.hitHeavy, c.seed), gain: .62, rate: .94 }, { cue: 'fx-land-heavy', gain: .32, rate: .7 }],
    ultimate: (_c, _index, final) => [{ cue: 'fx-lightning', gain: final ? .7 : .3 }, ...(final ? [{ cue: 'fx-land-heavy' as const, gain: .36, rate: .7 }] : [])],
  },
  strix: {
    special:c=>[{cue:pick(FAMILY.cutHeavy,c.seed),gain:.68},{cue:'fx-wind-blast',gain:.25}],
    ultimate:(c,index,final)=>[{cue:pick(FAMILY.cutHeavy,c.seed,index),gain:final?.76:.6},{cue:pick(FAMILY.finisher,c.seed,index),gain:final?.35:.18}],
  },
  taisei: {
    // The kick to the back that launches: body, crack and a launch thump.
    heavy: (c, index, final) => teleportOf(c.move)
      ? [{ cue: pick(FAMILY.hitKick, c.seed), gain: .7, rate: .94 }, { cue: pick(FAMILY.hitHeavy, c.seed), gain: .45 }, { cue: pick(FAMILY.finisher, c.seed), gain: .38 }]
      : meleeImpact(c, index, final),
    special: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .6 }, { cue: pick(FAMILY.energyHit, c.seed), gain: .3 }],
    ultimate: c => detonation(c.seed),
  },
  ouga: {
    // The straight lands with a short ki pop on it.
    light: (c, index, final) => c.move.style !== 'melee' ? energyImpact(c)
      : c.stage === 0 && !c.air ? [...meleeImpact(c, index, final), { cue: pick(FAMILY.kiBlast, c.seed), gain: .3, rate: 1.25 }] : meleeImpact(c, index, final),
    heavy: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .64 }],
    special: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .64 }],
    ultimate: confirmBlow(c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .6 }, { cue: pick(FAMILY.energyHit, c.seed), gain: .36 }],
      (c, index) => [{ cue: pick(FAMILY.energyHit, c.seed, index), gain: .46, rate: wobble(c.seed + index, .06) }], c => detonation(c.seed)),
  },
  konta: {
    heavy: c => c.awakened ? [{ cue: 'fx-beast-bite', gain: .7 }, { cue: pick(FAMILY.hitHeavy, c.seed), gain: .5, rate: .9 }]
      : [{ cue: 'fx-whirlsphere-hit', gain: .78 }],
    special: c => c.awakened ? [{ cue: pick(FAMILY.explosion, c.seed), gain: .62 }]
      : [{ cue: 'fx-whirlsphere-hit', gain: .5, rate: 1.1 }, { cue: pick(FAMILY.explosion, c.seed), gain: .36 }],
    ultimate: c => detonation(c.seed),
  },
  shiden: {
    heavy: () => [{ cue: 'fx-shrike-bolt-hit', gain: .8 }],
    special: (c, index) => [{ cue: pick(FAMILY.burn, c.seed, index), gain: .42 }],
    ultimate: confirmBlow(c => [{ cue: 'fx-shrike-bolt-hit', gain: .6 }, { cue: pick(FAMILY.explosion, c.seed), gain: .4 }],
      (c, index) => [{ cue: pick(FAMILY.zap, c.seed, index), gain: .42 }, { cue: pick(FAMILY.energyHit, c.seed, index), gain: .32 }],
      () => [{ cue: 'fx-explosion-huge', gain: .68 }, { cue: 'fx-lightning', gain: .44 }]),
  },
  shirokane: {
    heavy: () => [{ cue: 'fx-shrike-bolt-hit', gain: .8 }],
    special: () => [{ cue: 'fx-shrike-bolt-hit', gain: .72 }],
    ultimate: confirmBlow(() => [{ cue: 'fx-shrike-bolt-hit', gain: .74 }],
      (c, index) => [{ cue: pick(FAMILY.zap, c.seed, index), gain: .44 }, { cue: pick(FAMILY.energyHit, c.seed, index), gain: .3 }],
      () => [{ cue: 'fx-shrike-bolt-hit', gain: .82 }, { cue: 'fx-lightning', gain: .4 }]),
  },
  gummy: {
    special: c => [{ cue: 'fx-fire-burst', gain: .7 }, { cue: pick(FAMILY.explosion, c.seed), gain: .34 }],
    ultimate: confirmBlow(c => [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .66, rate: .86 }, { cue: pick(FAMILY.snap, c.seed), gain: .26, delay: .02 }],
      c => [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .5 }],
      c => [{ cue: 'fx-explosion-huge', gain: .72 }, { cue: pick(FAMILY.hitHeavy, c.seed), gain: .62, rate: .8 }]),
  },
  kenzo: {
    special: c => [{ cue: pick(FAMILY.cutHeavy, c.seed), gain: .6 }, { cue: 'fx-wind-blast', gain: .36 }],
    ultimate: confirmBlow(c => [{ cue: pick(FAMILY.cutHeavy, c.seed), gain: .66 }, { cue: pick(FAMILY.cut, c.seed, 1), gain: .4, delay: .03 }],
      (c, index) => [{ cue: pick(FAMILY.cutHeavy, c.seed, index), gain: .56 }, { cue: pick(FAMILY.cut, c.seed, index + 1), gain: .34, delay: .025 }],
      () => [{ cue: 'fx-nine-cuts', gain: .86 }]),
  },
  kosho: {
    special: () => [{ cue: 'fx-fire-burst', gain: .74 }],
    ultimate: confirmBlow(c => [{ cue: pick(FAMILY.hitKick, c.seed), gain: .66, rate: .92 }, { cue: pick(FAMILY.burn, c.seed), gain: .34 }],
      (c, index) => [{ cue: pick(FAMILY.hitKick, c.seed, index), gain: .58 }, { cue: pick(FAMILY.burn, c.seed, index), gain: .3 }],
      c => [{ cue: 'fx-fire-burst', gain: .66 }, { cue: pick(FAMILY.explosion, c.seed), gain: .55 }, { cue: pick(FAMILY.hitKick, c.seed), gain: .5, rate: .9 }]),
  },
  kagari: {
    heavy: () => [{ cue: 'fx-fire-burst', gain: .72 }],
    special: c => [{ cue: 'fx-fire-burst', gain: .7 }, { cue: pick(FAMILY.explosion, c.seed), gain: .34 }],
    ultimate: () => [{ cue: 'fx-explosion-huge', gain: .72 }, { cue: 'fx-fire-roar', gain: .38 }],
  },
  ward: {
    heavy: c => [{ cue: pick(FAMILY.cutHeavy, c.seed), gain: .66 }],
    special: () => [{ cue: 'fx-gamma', gain: .72 }, { cue: 'fx-hit-heavy-1', gain: .34 }],
    ultimate: confirmBlow(c => [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .56 }, { cue: pick(FAMILY.zap, c.seed), gain: .4 }],
      (c, index) => [{ cue: pick(FAMILY.zap, c.seed, index), gain: .46 }, { cue: pick(FAMILY.energyHit, c.seed, index), gain: .3 }],
      () => [{ cue: 'fx-defib-shock', gain: .86 }]),
  },
  koko: {
    heavy: c => [{ cue: pick(FAMILY.hitKick, c.seed), gain: .6, rate: 1.1 }, { cue: pick(FAMILY.knifeHit, c.seed), gain: .3 }],
    special: (c, index, final) => final ? [{ cue: pick(FAMILY.finisher, c.seed), gain: .78 }] : barrageTick(c, index),
    // The finisher, on each victim of the resume blast.
    ultimate: (c, index, final) => final ? resumeBlow(c) : barrageTick(c, index),
  },
  oro: {
    heavy: c => [{ cue: pick(FAMILY.knifeHit, c.seed), gain: .58 }, { cue: pick(FAMILY.knifeHit, c.seed, 1), gain: .44, delay: .035, rate: 1.06 },
      { cue: pick(FAMILY.knifeHit, c.seed), gain: .38, delay: .07, rate: .95 }],
    special: (c, index, final) => final ? [{ cue: pick(FAMILY.finisher, c.seed), gain: .78 }] : barrageTick(c, index),
    ultimate: (c, index, final) => final ? resumeBlow(c) : barrageTick(c, index),
  },
  nigo: {
    special: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .6 }, { cue: pick(FAMILY.cutHeavy, c.seed), gain: .45 }],
    ultimate: confirmBlow(c => [{ cue: pick(FAMILY.energyHit, c.seed), gain: .58 }, { cue: pick(FAMILY.explosion, c.seed), gain: .4 }],
      (c, index) => [{ cue: pick(FAMILY.energyHit, c.seed, index), gain: .44, rate: .8 }],
      c => [{ cue: 'fx-explosion-huge', gain: .76 }, { cue: pick(FAMILY.cutHeavy, c.seed), gain: .42 }]),
  },
  kuon: {
    heavy: () => [{ cue: 'fx-blue', gain: .74 }],
    special: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .66 }],
    // PLANETARIUM: a strike on each trapped victim in turn (an Infinity
    // ring and a burst of hex energy), and the crimson Dark Spark as
    // the dome collapses - on every victim of the resume, one each.
    ultimate: (c, index, final) => final ? volley(c, [{ cue: 'fx-dark-spark', gain: .66 }])
      : [{ cue: pick(FAMILY.hitHeavy, c.seed, index), gain: .55 }, { cue: pick(FAMILY.energyHit, c.seed, index), gain: .24 }],
  },
  gaunt: {
    special: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .66 }],
    ultimate: (c, index, final) => final ? [{ cue: pick(FAMILY.cutHeavy, c.seed), gain: .72 }, { cue: 'fx-explosion-huge', gain: .52 }, { cue: 'fx-land-heavy', gain: .5 }]
      : [{ cue: pick(FAMILY.cutHeavy, c.seed, index), gain: .58, rate: wobble(c.seed + index, .05) }],
  },
  setsu: {
    heavy: c => [{ cue: 'fx-shrike-bolt-hit', gain: .66 }, { cue: pick(FAMILY.zap, c.seed), gain: .3 }],
    special: c => [{ cue: 'fx-shrike-bolt-hit', gain: .62 }, { cue: pick(FAMILY.zap, c.seed), gain: .34 }],
    ultimate: (c, index, final) => final ? [{ cue: 'fx-lightning', gain: .66 }, { cue: pick(FAMILY.finisher, c.seed), gain: .56 }, { cue: 'fx-explosion-huge', gain: .4 }]
      : [{ cue: pick(FAMILY.zap, c.seed, index), gain: .32 }, { cue: pick(FAMILY.barrage, c.seed, index), gain: .36 }],
  },
  tobari: {
    // The kick to the back after the Murder of Crows, as Taisei's after Cloudstep; Black Pyre's burns as Shiden's.
    heavy: (c, index, final) => teleportOf(c.move)
      ? [{ cue: pick(FAMILY.hitKick, c.seed), gain: .7, rate: .94 }, { cue: pick(FAMILY.hitHeavy, c.seed), gain: .45 }, { cue: pick(FAMILY.finisher, c.seed), gain: .38 }]
      : meleeImpact(c, index, final),
    special: (c, index) => [{ cue: pick(FAMILY.burn, c.seed, index), gain: .42 }],
  },
  // Akagane's flame burns where it lands, as Black Pyre does; Rook's slam goes off under them.
  akagane: { special: (c, index) => [{ cue: pick(FAMILY.burn, c.seed, index), gain: .44 }] },
  'rook': { special: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .5 }, { cue: pick(FAMILY.hitHeavy, c.seed), gain: .3, rate: .9 }] },
  // Roar Palm goes off on them.
  gaku: { special: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .46 }, { cue: pick(FAMILY.energyHit, c.seed), gain: .34 }] },
};

// ---------------------------------------------------------------- guard and transformation

/** The blow a guard took: its move, and whether steel rang on the guard. (Each fighter's own move, unawakened, as it
 *  always was; a form that fights as another body - FORM_STAGES - is that body's.) */
function guarded(event: CombatEvent, awakened: boolean) {
  const fighter = event.fighter, slot = event.slot, form = awakened && !!fighter && !!FORM_STAGES[fighter];
  const move = fighter && slot ? (slot === 'light' && (event.chain ?? 0) > 0 ? rushMove(fighter, event.chain!, form) : moveFor(fighter, slot, form)) : undefined;
  const blade = fighter ? (form ? FORM_BLADE[fighter] : undefined) ?? BLADE[fighter] : undefined;
  return { move, bladed: !!blade && move?.style === 'melee' && fighter !== 'setsu' };
}
function blockedLayers(event: CombatEvent, awakened = false): CueLayer[] {
  const seed = seedOf(event), fighter = event.fighter, slot = event.slot, { move, bladed } = guarded(event, awakened);
  const energy = !!move && move.style !== 'melee';
  // Round 5 (PARRY): the thud is weighted by the blow. A jab is the forearm's muffled thud (or a blade's clang over
  // it), as before; a string's last blow, a heavy, a special and an ultimate land as a braced body's heavy thud, the
  // clang laid over it quieter, and louder the bigger the blow.
  const heavy = slot === 'heavy' || slot === 'special' || slot === 'ultimate' || slot === 'light' && (event.chain ?? 0) >= 3;
  const weight = slot === 'ultimate' ? .82 : slot === 'special' ? .76 : .66;
  const thud: CueLayer = heavy ? { cue: 'fx-block-heavy', gain: weight, rate: wobble(seed, .04), phase: 'impact' }
    : bladed ? { cue: 'fx-block-blade', gain: .56, rate: wobble(seed, .05), phase: 'impact' } : { cue: pick(FAMILY.block, seed), gain: .6, rate: wobble(seed, .05), phase: 'impact' };
  return [thud,
    ...(heavy && bladed ? [{ cue: 'fx-block-blade' as const, gain: .34, rate: wobble(seed, .05), phase: 'impact' as const }, { cue: sfxNew.clash(seed), gain: .4, rate: wobble(seed + 1, .04), phase: 'impact' as const }] : []),
    ...(energy ? [{ cue: pick(FAMILY.energyHit, seed), gain: .26, phase: 'impact' as const }] : [])];
}

/** Round 5 (PARRY): the Perfect Parry - steel ringing bright off the guard, the air of the turned blow and a low hit
 *  (fx-parry, one layered cue) - and, for a shot destroyed at the guard, the shot bursting there.
 *
 *  Launch day 5 (12 October 2026): heard as an event, and by what was turned. The bank's bright 'ting' (fx-just-guard,
 *  shipped and played by nothing) rings over it; a blade rings off the guard a second time, higher; a fist or a foot is
 *  slapped aside. And for the player who made it or took it the rest of the effects step back for a fifth of a second
 *  so it stands alone (CombatAudio.hush). */
function parryLayers(event: CombatEvent, awakened = false): CueLayer[] {
  const seed = seedOf(event), { bladed } = guarded(event, awakened);
  const turned: CueLayer = event.reason === 'deflect' ? { cue: pick(FAMILY.energyHit, seed), gain: .3, rate: 1.15, phase: 'impact' }
    : bladed ? { cue: 'fx-sword-ring', gain: .28, rate: 1.16, delay: .015, phase: 'impact' }
    : { cue: pick(FAMILY.snap, seed), gain: .24, rate: 1.1, delay: .01, phase: 'impact' };
  return [{ cue: 'fx-parry', gain: .76, rate: wobble(seed, .02), phase: 'impact' }, { cue: 'fx-just-guard', gain: .34, phase: 'impact' }, turned,
    ...(bladed ? [{ cue: sfxNew.clash(seed), gain: .4, rate: wobble(seed + 1, .04), phase: 'impact' as const }] : [])];
}

/** Two shots meeting in the air: the crackling blast it always was, a burst where they cancel, and what the thrower's
 *  shot was made of going off with it (its family's hit: ice shattering, water breaking). Heard as an event, as the
 *  parry is. */
function clashLayers(event: CombatEvent): CueLayer[] {
  const seed = seedOf(event), family = event.fighter && event.slot ? familyOf(event.fighter, event.slot) : null;
  return [{ cue: 'fx-clash', gain: .72, phase: 'impact' }, { cue: pick(FAMILY.explosion, seed), gain: .3, rate: 1.12, delay: .02, phase: 'impact' },
    ...(family ? fromNow(FAMILIES[family].hit.slice(0, 1), seed, .7) : [])];
}

function awakenLayers(fighter: FighterId): CueLayer[] {
  const own = ownAwakening(fighter);
  return [...own, ...powerEntrance(fighter, own), ...originalAwakening(fighter).map(([cue, gain]) => onBeat(cue as AudioCue, gain, awakeningSwapAt(fighter), 'release'))];
}

/** Launch day 5 (12 October 2026): the fighter's own power arriving, on the swap (audio/powerSound.ts, from
 *  render/awakenedPower.ts) - Will's blow and its black lightning, the pillar of raw pressure, chi flung out,
 *  a dark flame catching, Lion's Roar swelling, a bolt, a vent of steam, a flash freeze - over whatever the fighter's own entry
 *  already plays, and after it in the list, so those layers stay where every earlier pass put them. A cue the entry
 *  already plays is not played twice (Setsu's bolt, Gorai's), and under an awakening line said over the burst it steps
 *  back (`underALine`): the line is the moment. None for the ki flame (its power-up is the entrance) or
 *  for the two with no energy; Chohan's and Sorayomi's arrivals are their own layers'. */
function powerEntrance(fighter: FighterId, own: readonly CueLayer[]): CueLayer[] {
  const voice = powerVoice(fighter);
  if (!voice || !arrivesHeard(fighter)) return [];
  const sound = POWER_SOUNDS[voice.kind], swap = awakeningSwapAt(fighter), level = voice.level * (spokenOver(fighter) ? sound.underALine : 1);
  return sound.entrance.filter(([cue]) => !own.some(layer => layer.cue === cue))
    .map(([cue, gain, after = 0]) => onBeat(cue, gain * level, swap + after, 'release'));
}

/** The layers `powerEntrance` adds for `fighter` (the tests', and the audition page's). */
export const powerArrival = (fighter: FighterId): CueLayer[] => powerEntrance(fighter, ownAwakening(fighter));

function ownAwakening(fighter: FighterId): CueLayer[] {
  const swap = awakeningSwapAt(fighter);
  const add = (cue: AudioCue, gain: number, delay = 0): CueLayer => ({ cue, gain, ...(delay ? { delay: round(delay) } : {}), phase: 'release' });
  const on = (cue: AudioCue, gain: number, time: number, rate = 1) => onBeat(cue, gain, time, 'release', rate);
  const held = (cue: AudioCue, gain: number, from: number, to: number, rate = 1): CueLayer => ({ ...bed(cue, gain, from, to, rate), phase: 'release' });
  const base: CueLayer[] = [{ cue: 'fx-awaken', gain: spokenOver(fighter) ? .4 : .5, phase: 'release' }, ...burst(fighter)];
  switch (fighter) {
    // Kurobi: the fox's roar answering him (a recorded monster roar, pitched; next to nothing in the speech band).
    case 'konta': return [...base, add('fx-beast-roar', .5, .5)];
    // Round 4b (GUMMY): SUNRISE - pressure building, the burst of cloud, and the cartoon's boing as he lands in it.
    case 'gummy': return [...base, add('fx-gear4-inflate', .36), add('fx-poof-1', .46, .34), add('fx-poof-2', .36, .48), add('fx-gear4-bounce', .42, .62)];
    // The gold awakening, Taisei's and Ouga's: the aura catching, ki drawn up, the burst on the swap, sparks (goldAwakening).
    case 'taisei': case 'ouga': return goldAwakening(fighter);
    // The spirit looming up behind them: its ghostly swell, and the pressure it puts on the air.
    case 'koko': case 'oro': return [...base, add('fx-spirit', .5, .1), on('fx-will', .46, swap + .06)];
    // The Guardian: the chi gathering into a giant - its swirl in the mids as the ribs rise. Akagane's Perfect one
    // stands up with a weight the ground feels.
    case 'shiden': case 'shirokane': case 'tobari': return [...base, add('fx-guardian', .52, .2), held('fx-purple-charge', .3, swap, swap + .9)];
    case 'akagane': return [...base, add('fx-guardian', .52, .2), on('fx-land-heavy', .5, swap + .3)];
    // The RAKSHASA: nine swords drawn - the ring of the blades and the demon's pressure.
    case 'shijima': return [held('fx-wind-swirl',.13,.08,swap),on('fx-guard-shatter',.2,swap)];
    case 'akaito': return [held('fx-gather',.12,.08,swap),on('fx-energy-hit-2',.19,swap)];
    case 'tancho': return [held('fx-wind-swirl',.13,.08,swap),on('fx-guard-shatter',.2,swap),on('fx-fire-ignite',.15,swap)];
    case 'oyashio': return [held('fx-wind-swirl',.12,.08,swap),on('fx-gather',.18,swap)];
    case 'ume': return [held('fx-gather',.08,.08,swap),on('fx-energy-hit-1',.16,swap)];
    case 'lanthorn': return [held('fx-gather',.08,.08,swap),on('fx-fire-burst',.16,swap)];
    case 'highsun': return [held('fx-gather',.08,.08,swap),on('fx-fire-burst',.16,swap)];
    case 'torsion': return [held('fx-gather',.08,.08,swap),on('fx-wind-blast',.16,swap)];
    case 'kubiwa': return [held('fx-gather',.07,.08,swap),on('fx-energy-hit-1',.14,swap)];
    case 'onigawara': return [held('fx-gather',.09,.08,swap),on('fx-will',.17,swap)];
    case 'cardo': return [held('fx-gather',.09,.08,swap),on('fx-will',.17,swap)];
    case 'minase': return [held('fx-gather',.08,.08,swap),on('fx-wind-blast',.16,swap)];
    case 'aquilo': return [held('fx-gather',.08,.08,swap),on('fx-wind-blast',.16,swap)];
    case 'psyche': return [held('fx-gather',.06,.12,swap),on('fx-stretch-1',.12,swap),on('fx-wind-blast',.12,swap)];
    case 'ovid': return [held('fx-gather',.07,.12,swap),on('fx-wind-blast',.18,swap),on('fx-snap-2',.10,swap)];
    // The YUGE (13 October): the hand bitten, the bolt out of the sky on the swap and the air it throws out, and
    // the giant's weight coming down in its own steam (the steam is his world's power arriving: powerSound.ts `steam`).
    // (Kept low, as his entry always was: "Ore wa motto motto tsuyoku natte yaru" is said over it.)
    case 'hawser': return [on('fx-snap-2',.1,swap*.52),held('fx-gather',.07,.12,swap),on('fx-lightning',.2,swap),on('fx-wind-blast',.18,swap),on('fx-land-heavy',.16,swap+.18,.8)];
    case 'rotfalke': return [held('fx-gather',.07,.12,swap),on('fx-wind-blast',.17,swap),on('fx-snap-2',.10,swap)];
    case 'bonsho': return [held('fx-gather',.07,.12,swap),on('fx-wind-blast',.17,swap),on('fx-snap-2',.10,swap)];
    case 'murex': return [held('fx-gather',.07,.12,swap),on('fx-wind-blast',.17,swap),on('fx-snap-2',.10,swap)];
    case 'kinu': return [held('fx-gather',.07,.12,swap),on('fx-energy-hit-1',.14,swap),on('fx-snap-2',.10,swap)];
    case 'madake': return [held('fx-gather',.07,.12,swap),on('fx-wind-blast',.16,swap),on('fx-snap-2',.12,swap)];
    case 'akayuri': return [held('fx-gather',.06,.18,swap),on('fx-sword-ring',.13,swap),on('fx-snap-2',.10,swap)];
    case 'hagure': return [held('fx-gather',.07,.12,swap),on('fx-snap-2',.11,.387),on('fx-wind-blast',.16,swap)];
    case 'hisame': return [on('fx-sword-ring',.10,.513),on('fx-wind-blast',.14,swap)];
    case 'svanhild': return [on('fx-sword-ring',.10,.513),on('fx-wind-blast',.14,swap)];
    case 'mizuhiki': return [on('fx-sword-ring',.12,.378),on('fx-wind-blast',.13,swap)];
    case 'shibuichi': return [on('fx-armour-1',.1,.18),on('fx-armour-2',.12,.567),on('fx-energy-hit-1',.14,swap)];
    case 'rakucho': return [held('fx-gather',.08,.08,swap),on('fx-snap-1',.12,.324),on('fx-energy-hit-1',.14,swap)];
    case 'irbis': return [held('fx-gather',.10,.08,swap),on('fx-energy-hit-1',.18,swap)];
    case 'shidare': return [held('fx-wind-swirl',.08,.08,swap),on('fx-sword-ring',.14,swap)];
    case 'chohan': return [on('fx-slash-kunai-1',.12,.12),held('fx-gather',.06,.08,swap),on('fx-wind-blast',.14,swap)];
    case 'tsubute': return [held('fx-gather',.07,.08,swap),on('fx-will',.16,swap),on('fx-snap-1',.08,swap)];
    case 'aqrab': return [held('fx-wind-swirl',.13,.08,swap),on('fx-wind-blast',.19,swap),on('fx-land-heavy',.10,swap)];
    case 'yodaka': return [held('fx-fire-bed',.10,.08,swap),on('fx-fire-ignite',.20,swap)];
    case 'hinomoto': return [held('fx-fire-bed',.09,.08,swap),on('fx-fire-ignite',.16,swap)];
    case 'amagoi': return [held('fx-gather',.08,.08,swap),on('fx-wind-blast',.16,swap)];
    case 'shakudo': return [held('fx-gather',.08,.08,swap),on('fx-energy-hit-1',.16,swap)];
    case 'hikui': return [held('fx-gather',.08,.08,swap),on('fx-fire-burst',.16,swap)];
    case 'tokan': return [held('fx-gather',.08,.08,swap),on('fx-wind-blast',.13,swap)];
    case 'strappado': return [held('fx-gather',.08,.08,swap),on('fx-stretch-2',.13,swap)];
    case 'unari': return [held('fx-gather',.08,.08,swap),on('fx-snap-2',.14,swap)];
    case 'barrow': return [held('fx-gather',.09,.08,swap),on('fx-energy-hit-1',.18,swap)];
    case 'sashigane': return [held('fx-gather',.08,.08,swap),on('fx-sword-ring',.14,swap)];
    case 'gosu': return [held('fx-gather',.09,.08,swap),on('fx-energy-hit-1',.18,swap)];
    case 'kusushi': return [held('fx-gather',.10,.08,swap),on('fx-energy-hit-1',.19,swap)];
    case 'hakushi': return [held('fx-gather',.10,.08,swap),on('fx-wind-blast',.19,swap)];
    case 'suzuran': return [held('fx-gather',.12,.08,swap),on('fx-energy-hit-1',.18,swap)];
    case 'wataame': return [held('fx-gather',.08,.08,swap),on('fx-swing-huge',.15,swap)];
    case 'bruin': return [held('fx-gather',.08,.08,swap),on('fx-swing-huge',.15,swap)];
    case 'senko': return [held('fx-gather',.1,.08,swap),on('fx-energy-hit-2',.19,swap)];
    case 'buna': return [held('fx-will',.13,.08,swap),on('fx-defib-shock',.23,swap)];
    case 'adad': return [held('fx-electric-bed',.12,.08,swap),on('fx-defib-shock',.22,swap)];
    case 'bellows': return [held('fx-fire-bed',.12,.08,swap),on('fx-fire-ignite',.26,swap),on('fx-fire-roar',.21,swap)];
    case 'mikage': return [held('fx-electric-bed',.13,.08,swap),on('fx-defib-shock',.23,swap)];
    case 'tempo': return [held('fx-gather',.12,.08,swap),on('fx-energy-hit-1',.2,swap)];
    case 'full-beam': return [held('fx-wind-swirl',.14,.12,swap),on('fx-wind-blast',.3,swap),on('fx-land-heavy',.16,swap)];
    case 'pyroclast': return [held('fx-fire-roar',.1,.12,swap),on('fx-fire-burst',.3,swap),on('fx-wind-blast',.17,swap)];
    case 'ampere': return [held('fx-lightning',.09,.12,swap),on('fx-wind-blast',.2,swap)];
    case 'shanxiao': return [held('fx-ki-charge',.1,0,swap),on('fx-swing-huge',.19,swap),on('fx-land-heavy',.2,swap)];
    case 'kuzu': return [on('fx-kuzu-ignition',.4,.63)];
    case 'shakugo': return [held('fx-fire-roar',.14,.08,.7),on('fx-fire-burst',.35,.38),on('fx-land-heavy',.22,.38)];
    case 'strix': return [...base,on('fx-sword-ring',.42,swap+.02),on('fx-slash-wave',.23,swap+.08)];
    case 'sorayomi': return [...base, held('fx-wind-swirl', .24, 0, .9), held('fx-electric-bed', .11, .15, swap), on('fx-wind-blast', .22, swap)];
    case 'basilissa': return [...base, held('fx-will', .18, .08, swap + .3), on('fx-guard-shatter', .17, swap, 1.3)];
    case 'kenzo': return [...base, add('fx-rakshasa', .5, .1), on('fx-sword-ring', .34, swap + .04), on('fx-will', .4, swap + .08)];
    // Round 3d: the UNSEALED moment. Pressure winds up round him from the flash
    // through "Ban...", the draw-up and release are moved so the release
    // breaks on "KAI" (unsealedTiming.ts), and the pressure burst peaks on it in
    // place of the Nightfang roar that stood in for it.
    case 'nigo': return [
      { ...bed('fx-wind-swirl', .2, 0, UNSEALED.kai + UNSEALED.burstAfterKai), phase: 'release' },
      // A little under the other fighters' release: the shout rides on top.
      { ...onBeat('fx-awaken', .38, UNSEALED.kai + UNSEALED.burstAfterKai, 'release'), phase: 'release' },
      { ...onBeat('fx-unsealed', .45, UNSEALED.kai + UNSEALED.burstAfterKai, 'release'), phase: 'release' }];
    // FEU BLEU, the KAGUTSUCHI, DAYBREAK: the flames catch and roar up round them.
    case 'kosho': return [...base, add('fx-fire-ignite', .5, .35), add('fx-fire-roar', .34, .45), on('fx-fire-whoosh-2', .44, swap + .04)];
    case 'kagari': return [...base, add('fx-fire-roar', .52, .4), on('fx-fire-whoosh-1', .44, swap + .02), on('fx-embers', .34, swap + .2)];
    case 'asahi': return [...base, on('fx-fire-ignite', .44, swap), add('fx-fire-roar', .44, .4), on('fx-fire-whoosh-1', .42, swap + .04)];
    // The operating theatre opening wide, and a Crossmatch blip in it.
    case 'ward': return [...base, add('fx-room', .54, .3), on('fx-crossmatch', .34, swap + .1)];
    // TENGAN: Blue drawn in, and the swirl of Infinity round him.
    case 'kuon': return [...base, add('fx-blue', .4), held('fx-purple-charge', .26, swap, swap + .8)];
    // The HOUND ARMOR closing on him (its clanks, kept under his scream) and the beast in it.
    case 'gaunt': return [...base, add('fx-armour-1', .24, .5), add('fx-armour-2', .2, .72), on('fx-beast-roar', .46, swap + .2)];
    // SETSUNA: lightning through him, and the crackle it leaves.
    case 'setsu': return [...base, add('fx-lightning', .44, .42), add('fx-zap-2', .26, .6), held('fx-electric-bed', .16, swap, swap + .8)];
    // The shop's fighters. Gorai's half-wyrm form: the dragon's roar and his thunder.
    case 'gorai': return [...base, on('fx-beast-roar', .5, swap + .1), on('fx-lightning', .34, swap + .02)];
    // The tremor: the air itself cracking like glass, and the ground giving.
    case 'haldor': return [...base, on('fx-guard-shatter', .5, swap + .02), on('fx-land-heavy', .5, swap + .04)];
    // Crimson Command: the will going out over everything - and the King's, with the black lightning of it.
    case 'sorrel': return [...base, on('fx-will', .56, swap + .02), on('fx-guard-break', .3, swap + .06)];
    case 'dorado': return [...base, on('fx-will', .56, swap + .02), on('fx-lightning', .34, swap + .04)];
    // PALE SERAPH's chrysalis: his pressure closing round him, ghostly.
    case 'shiun': return [...base, add('fx-domain', .44)];
    // The CALAMITY KING: a curse breaking the air, and his fire.
    case 'magatsu': return [...base, on('fx-dark-spark', .36, swap + .12), on('fx-fire-ignite', .3, swap + .16)];
    // Black Vespers: the eclipse closing over, and the space it cracks.
    case 'vesper': return [...base, add('fx-domain', .42), on('fx-dark-spark', .46, swap + .04)];
    // The King reborn: a roar and a blow to the air.
    case 'imago': return [...base, on('fx-beast-roar', .44, swap + .1), on('fx-dark-spark', .34, swap + .04)];
    // LOTUS IN FLAME: the aura's sparks (the burst carries its swirl).
    case 'wuming': return [...base, on('fx-zap-3', .22, swap + .4)];
    // Beast: a Golden's power-up with a roar in it.
    case 'gohaku': return [...base, on('fx-beast-roar', .44, swap + .1), held('fx-electric-bed', .18, swap, swap + 1), on('fx-zap-1', .24, swap + .06), on('fx-zap-3', .2, swap + .3)];
    // WRATHFUL GUARDIAN: his power welling up, and breaking out.
    case 'jirenga': return [...base, add('fx-ki-charge-big', .34), on('fx-explosion-huge', .34, swap + .1)];
    // BLACK TIDE: the space round him cracking, and a ghostly swell.
    case 'jinlin': return [...base, on('fx-dark-spark', .44, swap + .04), on('fx-spirit', .36, swap + .1)];
    // ALL-NIGHTER: one stamp of a foot.
    case 'ippon': return [...base, on('fx-land-heavy', .5, swap + .06)];
    // Gravedigger's snowflake opening under him: an implosion and a glint.
    case 'sekka': return [...base, add('fx-ki-charge-big', .3), on('fx-zap-2', .24, swap + .14)];
    // Levin: the blades ringing as he settles (after his line's first words).
    case 'levin': return [...base, on('fx-sword-ring', .3, swap + .5), on('fx-zip-1', .26, swap + .56)];
    // The HOLLOW CROWN: the dark closing round him and the shadows breaking out.
    case 'rook': return [...base, add('fx-domain', .4), on('fx-dark-spark', .46, swap + .04), held('fx-purple-charge', .24, swap, swap + .9)];
    // KOMAINU: rage welling up, and the beast in it.
    case 'gaku': return [...base, add('fx-ki-charge-big', .34), on('fx-beast-roar', .46, swap + .1)];
    default: return base;
  }
}

/** Whether the fighter's awakening line is said over the burst: laid from the event (the shop's lines, Kurobi's, Gaunt'
 *  scream), not after it as Taisei's and Ouga's are, or on it as Nigo's NIGHTFALL is. */
function spokenOver(fighter: FighterId) {
  const swap = awakeningSwapAt(fighter);
  return planVoice({ id: 0, kind: 'awaken', serverTime: 0, actorId: '', fighter }).some(l => (l.delay ?? 0) < swap - .1);
}

/** The transformation's release, heard where a laptop or a phone can play it, over fx-awaken's rumble, on the swap.
 *  Where nobody speaks over it: the column of power drawn in (a rising shimmer up top), the rush into the burst, the
 *  burst's crack in the mids and the shockwave's gale. Where the fighter's awakening line is said over the burst (laid
 *  from the event: the shop's lines, Kurobi's, Gaunt' scream), the line is the moment: the burst keeps out of the
 *  speech band (1-4 kHz, under 7% of each layer) - a body of air, the aura's swirl in the mids, sparks up top. */
function burst(fighter: FighterId): CueLayer[] {
  const swap = awakeningSwapAt(fighter);
  if (spokenOver(fighter)) return [
    onBeat('fx-swing-huge', .34, swap, 'release'),
    { ...bed('fx-purple-charge', .4, swap, swap + .6), phase: 'release' },
    onBeat('fx-zap-1', .3, swap, 'release'),
    onBeat('fx-zap-2', .22, swap + .12, 'release'),
  ];
  return [
    { ...bed('fx-gather', .2, 0, swap), phase: 'release' },
    onBeat('fx-chase', .32, swap, 'release'),
    onBeat('fx-ki-launch', .42, swap, 'release'),
    onBeat('fx-wind-blast', .46, swap + .02, 'release'),
  ];
}

/** The gold awakening transformation, Taisei's and Ouga's (goldAwakeningTiming.ts). The shared fx-awaken is mostly a rumble
 *  (85% of it under 80 Hz) that a laptop or a phone barely reproduces, and two small zaps were all Taisei and Ouga had over
 *  it: the transformation was heard as nothing. Laid on the entry's beat - the aura drawn in, the burst on the swap:
 *  - the aura catching: a burning whoosh as the gather starts (their aura burns as flames: AwakeningDefinition.flames);
 *  - ki drawn up through the gather: the searing charge bed and energy streaming in, and a rush rising into the burst;
 *  - the burst on the swap: fx-awaken's own release (its crest 0.36 s in) with the shockwave's gale, a ki blast and a
 *    crack of thunder, so the burst is heard in the mids where the rumble is not, and the aura roaring after it;
 *  - sparks crackling round the new form: the crackling bed and four zaps, thinning out as Taisei speaks - in the speech
 *    band they sit under his line (voicePlan.ts), whose "スー" starts as the blast's tail has fallen away.
 *  Over 200 Hz (what small speakers play) the burst is 8 dB louder than the old one - 6 dB under Taisei's line, which ducks
 *  the effects from the moment it is scheduled - and its peak meets the master's compressor at about -6 dBFS, the top of
 *  the bank's range. All on the release phase, as every awakening's layers: the entry cannot be interrupted, and the
 *  first cast after it must not cut the tail. */
function goldAwakening(fighter: FighterId): CueLayer[] {
  const burst = awakeningSwapAt(fighter);
  return [
    { cue: 'fx-awaken', gain: .5, phase: 'release' },
    { cue: 'fx-fire-whoosh-1', gain: .34, phase: 'release' },
    { ...bed('fx-ki-charge', .34, 0, burst + .05), phase: 'release' },
    { ...bed('fx-gather', .22, 0, burst), phase: 'release' },
    onBeat('fx-chase', .4, burst, 'release'),
    onBeat('fx-wind-blast', .52, burst, 'release'),
    onBeat('fx-ki-launch', .36, burst, 'release'),
    onBeat('fx-lightning', .3, burst, 'release'),
    { cue: 'fx-fire-roar', gain: .3, delay: burst, phase: 'release' },
    { ...bed('fx-electric-bed', .18, burst, burst + 1.1), phase: 'release' },
    onBeat('fx-zap-1', .28, burst + .04, 'release'),
    onBeat('fx-zap-3', .24, burst + .16, 'release'),
    onBeat('fx-zap-1', .16, burst + .5, 'release', 1.12),
    onBeat('fx-zap-2', .12, burst + .9, 'release'),
  ];
}

// ---------------------------------------------------------------- helpers

/** Cloudstep's timing, where the move has one (MoveDefinition.
 *  teleport, added by the MOVES stream in round 3). */
function teleportOf(move: MoveDefinition) {
  return (move as MoveDefinition & { teleport?: { vanish: number; appear: number } }).teleport;
}

const SFX_LENGTHS = SFX_LENGTHS_JSON as Record<string, number>;
function sfxLength(cue: AudioCue) { return SFX_LENGTHS[cue as string] ?? 1; }

function round(value: number) { return Math.round(value * 1000) / 1000; }

/** A one-shot whose loudest moment (SFX_PEAKS) lands `lead` ahead of `time`. */
function onBeat(cue: AudioCue, gain: number, time: number, phase: CueLayer['phase'] = 'cast', rate = 1, lead = .012): CueLayer {
  // Round 3d (PACE): a sample that peaks later than the beat it is for is
  // played a little faster - at most ONBEAT_HURRY - so the peak meets it. The
  // quicker moves put the rush finishers' blows at 0.19-0.22 s, and the heavy
  // whooshes crest 0.26-0.31 s in: at the cast they landed after the blow.
  const peak = SFX_PEAKS[cue] ?? 0, due = time - lead;
  if (due > 0 && peak / rate > due) rate = Math.min(rate * ONBEAT_HURRY, peak / due);
  const delay = Math.max(0, due - peak / rate);
  return { cue, gain: round(gain), ...(delay > 0 ? { delay: round(delay) } : {}), ...(rate !== 1 ? { rate: round(rate) } : {}), phase };
}

/** How much faster than asked onBeat may play a sample to put its peak on the beat. */
const ONBEAT_HURRY = 1.2;

/** A looped bed held from `from` to `to` seconds after the cast. Held until a
 *  release: the release event cancels it. */
function bed(cue: AudioCue, gain: number, from: number, to: number, rate = 1): CueLayer {
  const start = Math.max(0, from);
  return { cue, gain, ...(start > 0 ? { delay: round(start) } : {}), duration: round(Math.max(.12, to - start)), loop: true,
    ...(rate !== 1 ? { rate } : {}), phase: 'charge' };
}

/** A 32-bit mix of the event's identity: the id, the contact and the stage. */
function seedOf(event: CombatEvent) {
  let h = 2166136261;
  for (const x of [event.id, event.contactIndex ?? 0, event.chain ?? 0]) {
    h ^= (x | 0) + 0x9e3779b9;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
function pick<T>(family: readonly T[], seed: number, offset = 0): T { return family[(seed + offset) % family.length]; }
/** 1 +/- spread, from the seed. */
function wobble(seed: number, spread: number) { return round(1 + (((seed >>> 7) % 1001) / 1000 - .5) * 2 * spread); }
