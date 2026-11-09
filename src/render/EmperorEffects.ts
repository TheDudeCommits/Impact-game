import * as THREE from 'three';
import { armoryDraws } from './vfx/armory/drawn';
import type {CombatEvent, FighterId} from '../game/types';
import type {Fighter} from './Fighter';
import {MOVES} from '../game/moves';
import {rushMove} from '../game/awakening';
import {comboMove, type ComboKey, isEnderKey } from '../game/combos';
import type {MoveDefinition} from '../game/moves';
import {ElectricKit} from './signature/ElectricKit';
import {GLOW, RING, STAR} from './signature/GlowBatch';
import {slashWaveMaterial, applySlashStyle, ENERGY, DARK, SLASH, type SlashStyle} from './signature/SlashWave';
import {ABYSS, BLACK, BLOOD, FIRE as FLAME_FIRE, flamePalette, flameSpriteGeometry, flameSpriteMaterial} from './signature/FlameSprites';
import {SIGNATURE, involvesLocal} from './signature/context';
import {COMBO_KEYS} from '../game/combos';
import {DIZZY_SECONDS} from '../game/moves';
import {GhostShell} from './signature/GhostShell';
import {whiffGone} from './signature/ultimateClock';
import {MirrorMereDomain} from './shop/MirrorMere';
import {EncoreDecoy} from './shop/FalseEncore';
import {BladeWhirl} from './shop/BladeWhirl';
import {CrowFlock} from './shop/CrowFlock';
import {VfxKit, DUST_LIT, DUST_SHADE, DREAM_IMPACT } from './vfx/VfxKit';
import {MARK} from './vfx/GroundMarks';
import {SPRITE, ORIENT} from './vfx/SparkField';
import {ghostTint, enderElement, type Element} from './vfx/palette';
import {ORIGINALS} from '../originals/roster';
import {akaganeFan} from '../originals/akaganeFan';
import {applyOriginalGuardianTint} from '../originals/guardianLook';
import {applyOriginalRising} from '../originals/akaganeBurst';
import {EmperorFinales, FINALES} from '../originals/emperorFinales';

/** Tobari's and Akagane's Guardian (3 October): the shell each wears is drawn as Shiden's and Shirokane's are
 *  (NinjaEffects.guardian) - a rim-lit ghost over the worn form, gone as the lens comes in on him. Without it the
 *  form's own tint faded to nothing at fighting range, and the blind critic saw no Guardian at all. Akagane's is blue,
 *  as his is: in indigo the critics read Shiden's purple. */
const GUARDIAN_TINT: Partial<Record<FighterId, { body: number; rim: number }>> = {
  tobari: { body: 0xc8341e, rim: 0xff9a6a }, akagane: { body: 0x2a52d8, rim: 0x8cc8ff } };
applyOriginalGuardianTint(GUARDIAN_TINT);

/** The shop's fighters (economy/fighters.ts), named for the first of them,
 *  the Emperors: what their own power looks like, over the moves the
 *  roster's shared effects already draw.
 *
 *  Gorai: the mast-breaker cuts violet, Grog Gale goes out as a wall of wind, and
 *  TIMBER: The Forest Falls is lightning - it crawls down the club through the charge,
 *  and comes out of the sky onto whoever the club comes down on.
 *  Haldor: the quake. A white bubble gathers on the fist for
 *  Faultline Fist and the air in front of it cracks like glass; World Tilt
 *  breaks the air round him at every tremor, and the ground rings out.
 *  Sorrel: Crimson Command - a dark dome that goes out from him with crimson
 *  lightning running over the floor - and Horizon Sunder, the will
 *  crawling up his sabre before it comes down.
 *  Dorado: the same black lightning in gold. Will gathers on the flintlock
 *  before Sovereign Shot and goes out with the ball; HORIZON SUNDER climbs Kagari and
 *  comes down as one cut so wide it splits the air behind it, the gold
 *  running out over the floor. He wakes under a dome of it.
 *  Shiun: pale seraph's violet over black. False Encore cuts where his
 *  blade goes, and its heavy breaks the air like glass - the illusion
 *  shattering - as the winged form's palm blows do; GLASS LANCES
 *  gathers light at his back and goes out as a volley of arrows; BLACK CONFESSIONAL's
 *  coffin closes round them and holds until the spears break it open. He
 *  wakes under a dome of it.
 *  Magatsu: crimson cuts in the air - Flaying Cut leaves several where one hand
 *  went - and Rend throws a flurry of them down the line. Mirror Mere,
 *  his dome, replaces the room as PLANETARIUM does: a crimson sky over a
 *  sea of blood, its cuts flashing through it and falling on whoever it holds,
 *  until Calamity Pyre, the fire gathered between his hands, bursts on the one it held.
 *  He wakes into his true form under a dome of crimson.
 *  Vesper: the sabre cuts white. Raven Dive leaves its cut where he went
 *  through them; the offering closes the dark round whoever the thrust held,
 *  a black sun over them, and the last cut burns the Offering Mark into
 *  them in crimson. He wakes as Black Vespers under a dome of the dark.
 *  Imago: jade. His claw leaves three marks where one hand went; Stinger Storm
 *  rings out round him at each sweep of the tail; the final molt cracks the
 *  air at each blow, and the slam rocks the floor. He wakes under a jade dome.
 *  Wuming: rose over black. The Petalfall Blade is a
 *  vanishing step: a glint at the two fingers on his forehead, gone in a flash -
 *  the body hidden, as Taisei's is (GoldenTechniques) - and back in another
 *  behind them, a blade of ki out of his hand until the cut. The Black
 *  Sunpalm Cannon gathers in the hand drawn back to his hip (the beam is the
 *  shared one, in rose). Rose's scythe is drawn up out of his raised hands and
 *  brought down through whoever the kick held. He goes Rose under a dome of it.
 *  Jirenga: red. His fists break the air where they land; the Uprooting Fist cuts
 *  up through it. Vermilion Seal gathers in the palm drawn back to his shoulder
 *  (the sphere it throws is the shared one, in red). The Mountain-Felling Fist
 *  burns in the fist he raises through the leap, and the dive through them
 *  splits the air and rocks the floor. He goes to full power under a red dome.
 *  'Emperor Jinlin': gold, and his needle rays magenta. The Pearl Needle goes off
 *  his fingertip accent; the Whirlpool Tail rings round him; the barrage is
 *  a volley of beams out of both hands, one after another; the Drowned Sun
 *  (the shared bomb, held over his raised hand) gathers at the fingertip under
 *  it. He flares gold as he wakes.
 *  Gohaku: white, the Beast's red-violet in it. His fists break the air
 *  where they land, the Rising Kick cuts up through it and the Mountain Hammer
 *  rocks the floor. The Star-Shifting Beam gathers between the hands raised over his brow
 *  (the beam is the shared one, in yellow); the Sun-Seizing Spiral draws to a
 *  point at the two fingers on his forehead, and its spiral winds violet round
 *  the beam while it bores through whoever it held. He goes Beast under a white
 *  dome rimmed in red-violet.
 *  Ippon: white into yellow. Each fist breaks the air where it lands; the
 *  Double Shift land more fists than the eye can follow, all
 *  over the front of them; the Clean Slate is drawn back to his hip and
 *  thrown, and everything in front of him goes - the air split, rings out
 *  over the floor, a wall of wind on ahead. He gets serious under a dome
 *  rimmed in red.
 *  Sekka: Gravedigger in pink, the frost stance in ice-blue. Frost
 *  Gale's shock goes on ahead of the fist; Avalanche lands more fists than one;
 *  the Icefall Hammer rocks the floor. The frost stance's snowflake opens on
 *  the floor round him as he settles, and the strike goes out to its edge.
 *  Shatter Art: Black Blizzard splits the air and rings out over the floor. He wakes
 *  under an ice-blue dome.
 *  Tobari: the Red Eye's red over black. The kunai cuts black, edged in crimson. The Murder of Crows is a
 *  vanishing step as Wuming's is - the body hidden - gone in a burst of crows where he stood and back in another
 *  behind them. 'Black Pyre': his red eye's glow at his eye, and the black flames catch where he is looking and burn
 *  there, as Shiden's do (FlameSprites). Red Moon Reverie turns the world red round whoever the kunai caught, a red moon over
 *  them, until it breaks them. He wakes under a dome of the Guardian's red-orange.
 *  Akagane: the Crow Clan's red. The war fan's swing cuts black edged in red. The Cinder Art: Burning Sea pours out of
 *  him in a stream of fire and burns over the ground it lands on. 'Heaven\'s Anvil': a meteor comes down out of the
 *  sky onto whoever the fan caught, and craters the floor. He wakes under the WRATHFUL KING's blue.
 *  Asahi: Tide Breath's blue cuts; the Ashfall Waltz's water ribbon round him at each cut; Lantern Rite: First Light's
 *  blade burns through the leap and comes down in a crescent of fire. He wakes under the Sun's fire.
 *  Levin: steel, both blades - every cut is two. The Grapple Rig's lines fire out ahead as he crouches, and the cut is
 *  left where he went through them; the SOJI: Clean Sweep whirls cuts round whoever the slash caught. He wakes under
 *  the Slipped Moorings's green.
 *  Rook: the shadows' violet, his daggers' cuts black edged in it. Grave Grip lifts the ground where he
 *  looks and slams it down; Black Rookery calls the shadows of the fallen up out of the floor behind him, and they fall on
 *  whoever the cut held. He wakes the HOLLOW CROWN, under a dome of violet.
 *  Gaku: the Landslide's gold. His fist goes off where it lands; his two-finger cut draws the aura out of his two fingers into a
 *  blade swept through them; Paper gathers in his palm before it is thrown. Landslide floods the fist he
 *  raises with aura until the Rock is brought down through them. He wakes as KOMAINU, under a dome of gold.
 *  Each of them crackles in their own colour while awakened, and bursts as
 *  they wake. Bounded like WardEffects: pooled cuts, cracks, rings, domes and
 *  flashes, the shared electric kit, nothing allocated per frame. The kit is
 *  drawn afresh each frame, so what a blow starts goes in a pool and is drawn
 *  from there for as long as it lasts. */
type Emperor = 'gorai' | 'haldor' | 'sorrel' | 'dorado' | 'shiun' | 'magatsu' | 'vesper' | 'imago' | 'wuming' | 'jirenga' | 'jinlin'
  | 'gohaku' | 'ippon' | 'sekka' | 'tobari' | 'akagane' | 'asahi' | 'levin' | 'rook' | 'gaku';
const EMPERORS: ReadonlySet<FighterId> = new Set<FighterId>(['gorai', 'haldor', 'sorrel', 'dorado', 'shiun', 'magatsu', 'vesper', 'imago', 'wuming', 'jirenga', 'jinlin',
  'gohaku', 'ippon', 'sekka', 'tobari', 'akagane', 'asahi', 'levin', 'rook', 'gaku']);
const COLOR: Record<Emperor, {glow: THREE.Color; light: THREE.Color}> = {
  gorai: {glow: new THREE.Color(1.35, .42, 2.7), light: new THREE.Color(.9, .4, 1.6)},
  haldor: {glow: new THREE.Color(2.3, 2.7, 3.1), light: new THREE.Color(1.2, 1.5, 1.9)},
  sorrel: {glow: new THREE.Color(3.0, .22, .32), light: new THREE.Color(1.5, .2, .25)},
  dorado: {glow: new THREE.Color(3.0, 1.9, .42), light: new THREE.Color(1.6, 1.0, .25)},
  shiun: {glow: new THREE.Color(1.9, .9, 3.4), light: new THREE.Color(1.0, .5, 1.9)},
  magatsu: {glow: new THREE.Color(3.3, .35, .42), light: new THREE.Color(1.7, .2, .25)},
  vesper: {glow: new THREE.Color(2.5, 2.8, 3.4), light: new THREE.Color(1.3, 1.45, 1.9)},
  imago: {glow: new THREE.Color(.55, 3.2, 1.5), light: new THREE.Color(.3, 1.7, .8)},
  'wuming': {glow: new THREE.Color(3.2, .9, 2.4), light: new THREE.Color(1.7, .5, 1.3)},
  jirenga: {glow: new THREE.Color(3.3, .45, .38), light: new THREE.Color(1.8, .25, .2)},
  'jinlin': {glow: new THREE.Color(3.3, 2.3, .55), light: new THREE.Color(1.8, 1.2, .3)},
  'gohaku': {glow: new THREE.Color(2.9, 2.3, 3.3), light: new THREE.Color(1.5, 1.15, 1.8)},
  ippon: {glow: new THREE.Color(3.3, 3.0, 2.0), light: new THREE.Color(1.8, 1.6, 1.0)},
  sekka: {glow: new THREE.Color(3.3, 1.2, 2.2), light: new THREE.Color(1.8, .6, 1.2)},
  tobari: {glow: new THREE.Color(3.2, .25, .32), light: new THREE.Color(1.7, .15, .2)},
  akagane: {glow: new THREE.Color(3.2, .35, .4), light: new THREE.Color(1.7, .2, .25)},
  asahi: {glow: new THREE.Color(1.0, 2.4, 3.4), light: new THREE.Color(.5, 1.3, 1.9)},
  levin: {glow: new THREE.Color(2.6, 3.2, 2.8), light: new THREE.Color(1.3, 1.7, 1.4)},
  'rook': {glow: new THREE.Color(1.9, .9, 3.4), light: new THREE.Color(1.0, .45, 1.9)},
  gaku: {glow: new THREE.Color(3.4, 2.3, .55), light: new THREE.Color(1.9, 1.25, .3)},
};
/** Emperor Jinlin's needle rays, and the Drowned Sun's red. */
const RAY = new THREE.Color(3.2, .7, 2.8), RAY_LIGHT = new THREE.Color(1.7, .35, 1.5), DROWNED_SUN_RED = new THREE.Color(3.4, .9, .3);
/** Gohaku: the Beast's red-violet; the Star-Shifting Beam's yellow (and the Sun-Seizing Spiral's point), and its spiral. */
const BEAST_RIM = new THREE.Color(2.9, .55, 1.7), STAR_BEAM_GOLD = new THREE.Color(3.4, 2.8, .7), STAR_BEAM_LIGHT = new THREE.Color(1.9, 1.5, .35);
const SPIRAL = new THREE.Color(2.1, .7, 3.3);
/** The Clean Slate's red. */
const SERIOUS = new THREE.Color(3.4, .7, .35);
/** The frost stance's ice-blue. */
const COMPASS = new THREE.Color(1.6, 2.4, 3.4);
/** Tobari: his red eye's glow; Red Moon Reverie's world, a darker red; Black Pyre's violet edge; the Guardian's red-orange. */
const RED_EYE = new THREE.Color(3.3, .2, .26), RED_MOON = new THREE.Color(2.4, .1, .14), BLACK_PYRE = new THREE.Color(1.1, .3, 1.6);
const GUARDIAN = new THREE.Color(3.3, 1.1, .45);
/** Akagane's WRATHFUL KING, blue; Asahi's water and the Sun's fire; Levin's green; Rook's shadows. */
const WRATHFUL_KING = new THREE.Color(1.1, 1.9, 3.4), WATER_RIM = new THREE.Color(1.0, 2.4, 3.4), SUN = new THREE.Color(3.4, 1.5, .4);
applyOriginalRising(WRATHFUL_KING);
const WINGS = new THREE.Color(1.4, 3.0, 2.0), SHADOW = new THREE.Color(1.5, .55, 3.2);
/** Calamity Pyre's fire. */
const FIRE = new THREE.Color(3.4, 1.3, .35), FIRE_LIGHT = new THREE.Color(1.8, .7, .2);
/** GLASS LANCES's points of light behind base Shiun, who has no wings to loose it from. */
const HALO = 9;
/** Mirror Mere's cuts, white-hot red. */
const CUT_RED = new THREE.Color(3.2, 1.05, .95);
/** Each one's cut: the mast-breaker's violet, the bisento's white, Sorrel's sabre black edged in crimson, Kagari's in gold,
 *  Shiun's wing blades black edged in lilac. */
const CUT: Record<Emperor, SlashStyle> = {
  gorai: {mode: ENERGY, edge: new THREE.Color(2.4, 1.6, 3.2), body: new THREE.Color(.55, .2, 1.1), glow: new THREE.Color(.35, .1, .8)},
  haldor: {mode: ENERGY, edge: new THREE.Color(2.6, 3.0, 3.3), body: new THREE.Color(.6, .85, 1.3), glow: new THREE.Color(.25, .45, .9)},
  sorrel: {mode: DARK, edge: new THREE.Color(3.2, .35, .4), body: new THREE.Color(.03, .004, .008), glow: new THREE.Color(1.0, .06, .08)},
  dorado: {mode: DARK, edge: new THREE.Color(3.2, 2.2, .55), body: new THREE.Color(.03, .02, .004), glow: new THREE.Color(1.0, .62, .1)},
  shiun: {mode: DARK, edge: new THREE.Color(2.7, 2.1, 3.4), body: new THREE.Color(.04, .01, .07), glow: new THREE.Color(.6, .25, 1.1)},
  magatsu: {mode: ENERGY, edge: new THREE.Color(3.4, .9, .9), body: new THREE.Color(1.2, .1, .15), glow: new THREE.Color(.9, .05, .1)},
  vesper: {mode: ENERGY, edge: new THREE.Color(3.1, 3.2, 3.5), body: new THREE.Color(.75, .82, 1.3), glow: new THREE.Color(.3, .38, .95)},
  imago: {mode: ENERGY, edge: new THREE.Color(2.4, 3.4, 2.8), body: new THREE.Color(.2, 1.1, .55), glow: new THREE.Color(.08, .85, .35)},
  'wuming': {mode: ENERGY, edge: new THREE.Color(3.4, 1.8, 3.0), body: new THREE.Color(1.2, .25, .9), glow: new THREE.Color(.9, .1, .6)},
  jirenga: {mode: ENERGY, edge: new THREE.Color(3.4, 1.1, .9), body: new THREE.Color(1.2, .12, .1), glow: new THREE.Color(.95, .05, .04)},
  'jinlin': {mode: ENERGY, edge: new THREE.Color(3.4, 2.8, 1.4), body: new THREE.Color(1.3, .8, .12), glow: new THREE.Color(.9, .5, .05)},
  'gohaku': {mode: ENERGY, edge: new THREE.Color(3.3, 3.0, 3.4), body: new THREE.Color(1.0, .45, 1.1), glow: new THREE.Color(.7, .15, .6)},
  ippon: {mode: ENERGY, edge: new THREE.Color(3.4, 3.2, 2.6), body: new THREE.Color(1.2, .9, .4), glow: new THREE.Color(.8, .5, .1)},
  sekka: {mode: ENERGY, edge: new THREE.Color(3.4, 2.4, 3.0), body: new THREE.Color(1.2, .3, .7), glow: new THREE.Color(.8, .1, .45)},
  tobari: {mode: DARK, edge: new THREE.Color(3.3, .3, .36), body: new THREE.Color(.02, .003, .005), glow: new THREE.Color(.95, .04, .06)},
  akagane: {mode: DARK, edge: new THREE.Color(3.3, .35, .4), body: new THREE.Color(.03, .004, .006), glow: new THREE.Color(1.0, .06, .08)},
  asahi: {mode: ENERGY, edge: new THREE.Color(2.6, 3.2, 3.4), body: new THREE.Color(.3, .9, 1.6), glow: new THREE.Color(.1, .5, 1.1)},
  levin: {mode: ENERGY, edge: new THREE.Color(3.2, 3.4, 3.3), body: new THREE.Color(.8, 1.1, .95), glow: new THREE.Color(.3, .6, .45)},
  'rook': {mode: DARK, edge: new THREE.Color(2.4, 1.6, 3.4), body: new THREE.Color(.03, .01, .06), glow: new THREE.Color(.6, .25, 1.2)},
  gaku: {mode: ENERGY, edge: new THREE.Color(3.4, 3.1, 1.8), body: new THREE.Color(1.5, .95, .25), glow: new THREE.Color(.95, .55, .08)},
};
/** Lantern Rite: First Light's crescent of fire. */
const SUN_CUT: SlashStyle = {mode: ENERGY, edge: new THREE.Color(3.4, 2.6, 1.2), body: new THREE.Color(1.6, .5, .1), glow: new THREE.Color(1.1, .25, .04)};
/** 'The Offering': the dark round them and the black sun over them, rimmed in Black Vespers's violet; the Offering Mark
 *  is crimson. */
const ECLIPSE = new THREE.Color(.95, .32, 1.7), BRAND = new THREE.Color(3.2, .2, .3);
/** Grog Gale's wind: white over violet. */
const WIND: SlashStyle = {mode: ENERGY, edge: new THREE.Color(2.8, 2.9, 3.2), body: new THREE.Color(.75, .7, 1.3), glow: new THREE.Color(.3, .25, .7)};
const CUTS = 10, CUT_SECONDS = .22;
const CRACKS = 8, CRACK_SECONDS = .7;
const RINGS = 6, RING_SECONDS = .6;
const DOMES = 4, DOME_OPEN = .3, DOME_SECONDS = .9;
const STRIKES = 4, STRIKE_SECONDS = .45;
const FLASHES = 6, FLASH_SECONDS = .3;
const BEAMS = 24, BEAM_SECONDS = .16;

interface Cut {mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; since: number; seconds: number; active: boolean}
/** Glass broken in the air: static jagged lines out from a point, in the plane facing `normal`. */
interface Crack {center: THREE.Vector3; normal: THREE.Vector3; since: number; seconds: number; seed: number; reach: number; count: number; active: boolean; color: THREE.Color}
interface Ring {mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; since: number; radius: number; active: boolean}
interface Dome {mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>; actorId: string; since: number; radius: number; seconds: number; lift: number; active: boolean}
/** Lightning out of the sky onto a point (Gorai's finisher), or along the floor out from one (Sorrel' crimson, Dorado's gold). */
interface Strike {center: THREE.Vector3; targetId: string; since: number; seed: number; kind: 'sky' | 'floor'; active: boolean; color: THREE.Color}
/** A discharge where a finisher lands, fading. */
interface Flash {center: THREE.Vector3; since: number; seed: number; strength: number; reach: number; active: boolean; color: THREE.Color; soft?: boolean}
/** A thin beam of ki between two points, fading: Emperor Jinlin's needle rays. One may be set to start later. */
interface Beam {from: THREE.Vector3; to: THREE.Vector3; since: number; seconds: number; seed: number; width: number; active: boolean; color: THREE.Color}
/** Cloudstep's hold: the body stays hidden this long past the return, while a remote copy's timeline may
 *  still be interpolating across the jump (GoldenTechniques' APPEAR_HOLD). */
const APPEAR_HOLD = .04;
/** The red in his crows' eyes: the Red Eye's, lit. */
const CROW_EYE = new THREE.Color(3.2, .25, .2);
/** How long before he vanishes his crows start to leave him. */
const CROW_LEAD = .05;
/** How long the clone he leaves stands before it comes apart into crows, and how long it takes to. */
const CLONE_STANDS = .08, CLONE_BREAK = .1;
/** The clone's joints the crows come out of, all at once, the whole of its outline (the roster's names, as his body
 *  has them). */
const CLONE_JOINTS = ['Head', 'Neck', 'Spine2', 'Spine1', 'Spine', 'Hips', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm',
  'LeftHand', 'RightHand', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot'];
/** Tobari formed out of his crows as they come back (`form`): the whole of him grown out of nothing about his hips over
 *  FORMED s from just after he is back, his crows reaching him as he does. (He was there all at once, "back fully
 *  formed mid-kick", the kick's light drawn along the floor before him with no body to it; grown a joint at a time,
 *  he was "an unreadable tangle": the blind critics.) */
const FORMED = .11;
/** Cloudstep's timings, by whose heavy it is: Wuming's Petalfall Blade, Tobari's Murder of Crows, Shiun's
 *  False Encore. */
const BLINKS: Partial<Record<FighterId, {vanish: number; appear: number}>> = {'wuming': MOVES['wuming'].heavy.teleport!, tobari: MOVES.tobari.heavy.teleport!,
  shiun: MOVES.shiun.heavy.teleport!};
const BLINK = BLINKS['wuming']!;
/** False Encore's copy breaks this far into the heavy: before he is back (BLINKS.shiun.appear), while it is still the
 *  thing the lens looks at. */
const ILLUSION_BREAKS = .27;
/** Black Pyre's black flames at most, as Shiden's are drawn (NinjaEffects). */
const FLAMES = 700;
const METEORS = 2;
/** How long an awakening's own mark is held (`drawSignatures`), from the awakening's start. */
const SIGNATURE_SECONDS = 2.8;
/** Ippon's gust over the floor. */
const SERIOUS_WIND = new THREE.Color(2.6, 2.6, 2.4);
/** How strongly the shop's techniques light what is round them, against the kit's own. Its light volumes multiply
 *  every surface inside them and stack, and a blow's flash reached seven metres at an ultimate's: the blind critics
 *  saw the ultimates wash their fighter "into a white blob at the key hit" (3 October). The glows and bolts
 *  themselves are as bright as before. */
const LIGHT_SCALE = .35;

/** Heaven's Anvil's rock: an icosphere pushed in and out by a few fixed waves into crags, and a `heat` at each
 *  corner - burning along the cracks where the waves cross, dark stone elsewhere - for its material to glow by. The
 *  blind critic, 3 October, saw the old one (a plain icosphere lit evenly orange) as "a flat salmon disc". */
function meteorRock(): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, 3);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const heat = new Float32Array(position.count), v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).normalize();
    const crag = Math.sin(v.x * 5.1 + 1.3) * Math.sin(v.y * 4.3 + .7) * Math.sin(v.z * 4.7 + 2.1);
    const r = 1 + .13 * Math.sin(v.x * 2.2 + v.y * 1.7) + .09 * Math.sin(v.z * 3.1 - v.x * 2.4) + .12 * crag;
    position.setXYZ(i, v.x * r, v.y * r, v.z * r);
    heat[i] = 1 - THREE.MathUtils.smoothstep(Math.abs(crag), .015, .1);
  }
  geometry.setAttribute('heat', new THREE.BufferAttribute(heat, 1));
  geometry.computeVertexNormals();
  return geometry;
}

/** Crimson Command's red, and the black of its lightning (InkStrokes, over the red glow). */
const WILL_RED = new THREE.Color(3.0, .12, .2);

/** Crimson Command's black: strokes of ink laid over the lightning's red glow, since the bolts blend by MAX and
 *  cannot darken (BoltBatch). Camera-facing segments between two points, as SignatureBolt's are, each a near-black
 *  core with a soft edge; drawn after the glow. One draw call a frame; fixed capacity; no allocation. */
class InkStrokes {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private data: Float32Array;
  private buffer: THREE.InstancedInterleavedBuffer;
  count = 0;
  constructor(readonly capacity: number) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0], 3));
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    this.data = new Float32Array(capacity * 8);
    this.buffer = new THREE.InstancedInterleavedBuffer(this.data, 8, 1);
    this.buffer.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aA', new THREE.InterleavedBufferAttribute(this.buffer, 4, 0));
    geometry.setAttribute('aB', new THREE.InterleavedBufferAttribute(this.buffer, 4, 4));
    geometry.instanceCount = 0;
    const material = new THREE.ShaderMaterial({
      name: 'WillInk', transparent: true, depthWrite: false,
      vertexShader: `attribute vec4 aA;attribute vec4 aB;varying vec3 vShape;varying float vAlpha;
        void main(){vec4 a=modelViewMatrix*vec4(aA.xyz,1.);vec4 b=modelViewMatrix*vec4(aB.xyz,1.);
          vec2 d=b.xy-a.xy;float len=length(d);vec2 dir=len>1e-6?d/len:vec2(1.,0.);vec2 perp=vec2(-dir.y,dir.x);
          vec4 p=mix(a,b,position.x);float w=aA.w;p.xy+=perp*position.y*w+dir*(position.x*2.-1.)*w;
          gl_Position=projectionMatrix*p;float L=len/w;vShape=vec3(-1.+position.x*(L+2.),position.y,L);vAlpha=aB.w;}`,
      fragmentShader: `varying vec3 vShape;varying float vAlpha;
        void main(){float ax=max(0.,max(-vShape.x,vShape.x-vShape.z));float r=length(vec2(ax,vShape.y));if(r>=1.)discard;
          gl_FragColor=vec4(.035,.0,.012,(1.-r*r)*vAlpha);}`,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'will-ink'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
  }
  begin() { this.count = 0; }
  segment(a: THREE.Vector3, b: THREE.Vector3, width: number, alpha: number) {
    if (this.count >= this.capacity || alpha <= .01) return;
    const o = this.count++ * 8, d = this.data;
    d[o] = a.x; d[o + 1] = a.y; d[o + 2] = a.z; d[o + 3] = width; d[o + 4] = b.x; d[o + 5] = b.y; d[o + 6] = b.z; d[o + 7] = alpha;
  }
  end() {
    this.mesh.geometry.instanceCount = this.count; this.mesh.visible = this.count > 0;
    if (this.count > 0) { this.buffer.clearUpdateRanges(); this.buffer.addUpdateRange(0, this.count * 8); this.buffer.needsUpdate = true; }
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

/** BLACK CONFESSIONAL's coffin: a slab of black, its edges lit violet (`uRim`), fading with `uOpacity`. */
/** BLACK CONFESSIONAL's slabs: black lacquer, a sheen toward their edges as they turn from the lens and slow violet streaks of
 *  pressure running up them, edged in a thin violet line. As a near-black face and a broad glowing edge, under the
 *  ultimate's violet grade, the faces vanished into the room: "a purple neon frame, not a black coffin" (the blind
 *  critic, 3 October). Shut, it is solid and hides who is inside, as the spell does. */
function coffinMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'BLACK CONFESSIONAL', transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: {uOpacity: {value: 0}, uTime: {value: 0}, uRim: {value: new THREE.Color(1.6, .55, 3.0)}},
    vertexShader: `varying vec2 vUv;varying vec3 vN;varying vec3 vV;
      void main(){vUv=uv;vN=normalMatrix*normal;vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec2 vUv;varying vec3 vN;varying vec3 vV;uniform float uOpacity;uniform float uTime;uniform vec3 uRim;
      void main(){float e=max(abs(vUv.x-.5),abs(vUv.y-.5))*2.;float edge=smoothstep(.94,.995,e);
        float sheen=pow(1.-abs(dot(normalize(vN),normalize(vV))),3.);
        float streak=smoothstep(.96,1.,sin(vUv.x*41.+sin(vUv.y*5.+uTime*1.4)*1.8))*(1.-vUv.y*.55);
        vec3 c=vec3(.008,.003,.012)+uRim*(.05*sheen+.16*streak);
        c=mix(c,uRim*.75,edge);gl_FragColor=vec4(c,uOpacity);}`,
  });
}
/** The coffin's five slabs round a body (four walls and the lid), each as [width, height, depth] and where it sits. */
const COFFIN_SLABS: [number, number, number, number, number, number][] = [
  [1.3, 2.5, .07, 0, 0, .65], [1.3, 2.5, .07, 0, 0, -.65], [.07, 2.5, 1.3, .65, 0, 0], [.07, 2.5, 1.3, -.65, 0, 0], [1.37, .07, 1.37, 0, 1.25, 0]];

/** Akagane's war-fan, the Crow Clan war fan, in its own frame: the handle up +y from the grip at the origin, the fan's
 *  round face beyond it square to z - cream, rimmed in black, its three tomoe in black, as his move card draws it. */
function warFan(): THREE.Group {
  if (ORIGINALS.akagane) return akaganeFan();
  const group = new THREE.Group(), face = new THREE.MeshStandardMaterial({color: 0xe4d8c2, roughness: .7}),
    black = new THREE.MeshStandardMaterial({color: 0x0b0808, roughness: .55}), wood = new THREE.MeshStandardMaterial({color: 0x3a2214, roughness: .8});
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(.33, .33, .035, 40), face);
  disc.rotation.x = Math.PI / 2; disc.position.y = .72; group.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.33, .022, 6, 40), black);
  rim.position.y = .72; group.add(rim);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + Math.PI / 2;
    for (const side of [1, -1]) {
      const tomoe = new THREE.Mesh(new THREE.CircleGeometry(.055, 16), black);
      tomoe.position.set(Math.cos(a) * .13, .72 + Math.sin(a) * .13, side * .019); tomoe.rotation.y = side < 0 ? Math.PI : 0;
      group.add(tomoe);
    }
  }
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.022, .026, .52, 10), wood);
  handle.position.y = .14; group.add(handle);
  group.name = 'akagane-war-fan'; group.visible = false;
  group.traverse(o => { o.frustumCulled = false; });
  return group;
}

/** Heaven's Harvest's blade, in its own frame: x the way the blade reaches out from the haft, y up the haft, the haft's
 *  head at the origin. Its back edge curves out and down to the point; its inner edge leaves the haft a little below
 *  the head, so the blade is broadest at the haft and comes to a point, as a scythe's does. */
/** Heaven's Harvest's blade, how far it reaches from the haft's head: at 1.15 m and a hand wide it read from the cinematic's
 *  lens as "a thin pink blade trail" (the blind critic, 3 October). */
const SCYTHE_REACH = 1.6;
function scytheBlade(): THREE.BufferGeometry {
  const N = 18, reach = SCYTHE_REACH, drop = .62 * reach, bend = 1.45, root = .38, points: number[] = [], index: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = reach * Math.sin(bend * t), y = -drop * (1 - Math.cos(bend * t));
    points.push(x, y, 0, x * (1 - .18 * Math.sin(Math.PI * t)), y - root * (1 - t), 0);
  }
  for (let i = 0; i < N; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setIndex(index);
  return geometry;
}

/** The rock's stone: dark, lit by the stage, burning only along its cracks and on the face it falls on (`fall`, the
 *  way it is going, in the world). Within a few metres of the lens it dissolves: a cinematic camera beside the one it
 *  falls on was otherwise inside a wall of it. */
function meteorMaterial(fall: THREE.Vector3): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({color: 0x2c1e16, emissive: 0xff6a18, emissiveIntensity: 2.4, roughness: .95, flatShading: true});
  material.onBeforeCompile = shader => {
    shader.uniforms.uFall = {value: fall};
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float heat;\nuniform vec3 uFall;\nvarying float vHeat;\nvarying float vLead;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvHeat = heat;\nvLead = dot(normalize(mat3(modelMatrix) * objectNormal), uFall);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHeat;\nvarying float vLead;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (length(vViewPosition) < 2.2 + 1.6 * fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453)) discard;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= max(vHeat, .7 * smoothstep(.6, .95, vLead));');
  };
  return material;
}

/** The combo enders (game/combos.ts) made of a series' element, drawn with it (`ender`): lightning on the stuns and
 *  blows of will, ki and Storm Bolt Hex, fire on the ones that burn - and for the main game's sixteen Black Pyre's black
 *  flames, the NIGHTFALL burn's crimson-licked black and Gaunt' blood (FlameSprites' palettes). */
type Accent = 'bolt' | 'fire' | 'black' | 'abyss' | 'blood';
const FLAME_OF: Record<Exclude<Accent, 'bolt'>, number> = {fire: FLAME_FIRE, black: BLACK, abyss: ABYSS, blood: BLOOD};
const ENDER_ACCENTS: Partial<Record<FighterId, Partial<Record<ComboKey, Accent>>>> = {
  gorai: { lllh: 'bolt', airHeavy: 'bolt' }, sorrel: { lllh: 'bolt', llls: 'bolt' }, dorado: { lllh: 'bolt', llls: 'bolt' },
  magatsu: { llls: 'bolt' }, 'wuming': { llls: 'bolt' }, jirenga: { llls: 'bolt' }, 'jinlin': { llls: 'bolt' },
  tobari: { airHeavy: 'fire', airSpecial: 'fire' }, akagane: { airSpecial: 'fire' }, asahi: { lllh: 'fire' }, 'gohaku': { lh: 'bolt' },
  // The main game's sixteen (COMBOS-DATA's rows): lightning down out of the sky - Purple Electricity, Speed of
  // Lightning and the Icefall, Shrike Current, Thunder Hawk - and the floor burning under Noboribi, Kagaribi's pillar,
  // Kosho's Reception and Salamandre, Sunstroke's cut, Gummy's burning fist and the cannon; Nigo's pressure; Gaunt' blood.
  shirokane: { airSpecial: 'bolt' }, setsu: { llh: 'bolt', airSpecial: 'bolt' }, shiden: { llls: 'bolt', airSpecial: 'bolt' },
  kagari: { llh: 'fire', airSpecial: 'fire' }, kosho: { lllh: 'fire', airSpecial: 'fire' }, kenzo: { airHeavy: 'fire' }, gummy: { airSpecial: 'fire' },
  nigo: { lllh: 'abyss', airSpecial: 'abyss' }, gaunt: { lllh: 'blood', airSpecial: 'fire' },
};

/** And the awakened forms' own (combosShop.ts `awakened`): Gorai's half-wyrm breathes Wyrm Breath's fire. */
const AWAKENED_ACCENTS: Partial<Record<FighterId, Partial<Record<ComboKey, Accent>>>> = { gorai: { llls: 'fire' } };
/** How tall an accent's fire stands, where it is more than the floor burning: Kagaribi is a pillar. */
const FLAME_TALL: Partial<Record<FighterId, Partial<Record<ComboKey, number>>>> = { kagari: { airSpecial: 2.6 }, gaunt: { airSpecial: 1.6 } };

/** What an ender's decorations (`ender`) are drawn in: its glow (the cracks, the flash, the bolts) and its cut, whether
 *  it breaks the air like glass (`cracks`) and discharges in lightning or without it (`soft`), and the colour of its
 *  rings. The shop's twenty draw in their own glow and cut, as they did; the main game's sixteen add their ender's
 *  element (palette ENDER_ELEMENTS) for the sprites, and how that element reads (`flavour`, `mainAccent`). */
interface EnderLook { glow: THREE.Color; cut: SlashStyle; cracks: boolean; soft: boolean; ring?: THREE.Color; el?: Element; flavour?: Flavour; move?: MoveDefinition }
const SHOP_LOOK = Object.fromEntries((Object.keys(COLOR) as Emperor[]).map(who => [who, {glow: COLOR[who].glow, cut: CUT[who], cracks: true, soft: false} satisfies EnderLook])) as Record<Emperor, EnderLook>;
/** The rings' white-blue (the pool's own colour, which the shop's enders keep). */
const RING_WHITE = new THREE.Color(2, 2.4, 2.8);
/** How each of the main game's sixteen's element reads on an ender (`flavour`): Konta's chi and his clones' smoke,
 *  Taisei's and Ouga's ki, Gummy's will, Kenzo's three swords, Kosho's and Kagari's fire, Ward's ROOM, Kuon's hex energy,
 *  the spirits' fists, Nigo's pressure, Gaunt' steel and blood, and Shirokane's, Setsu's and Shiden's lightning. Fire,
 *  steel, swords, chi, ROOM and the spirits' fists discharge without lightning; the shock of ki, will, hex energy,
 *  the spirits and lightning breaks the air like glass. */
type Flavour = 'chi' | 'ki' | 'will' | 'slash' | 'fire' | 'room' | 'cursed' | 'spirit' | 'pressure' | 'steel' | 'bolt'
  | 'flash' | 'explosion' | 'water' | 'earth' | 'plain' | 'darkSpark' | 'infinity' | 'frost' | 'claw' | 'inhale' | 'fireflies' | 'knives' | 'spark' | 'flurry';
/** LANCET's cut inside ROOM (WardEffects' own). */
const ROOM_CUT: SlashStyle = {mode: ENERGY, edge: new THREE.Color(1.7, 2.6, 3.2), body: new THREE.Color(.22, .75, 1.5), glow: new THREE.Color(.08, .45, 1.0)};
const MAIN: Partial<Record<FighterId, {flavour: Flavour; cut?: SlashStyle}>> = {
  konta: {flavour: 'chi'}, taisei: {flavour: 'ki'}, ouga: {flavour: 'ki'}, gummy: {flavour: 'will'}, kenzo: {flavour: 'slash', cut: SLASH.kenzo},
  kosho: {flavour: 'fire'}, kagari: {flavour: 'fire'}, ward: {flavour: 'room', cut: ROOM_CUT}, kuon: {flavour: 'cursed'}, koko: {flavour: 'spirit'},
  oro: {flavour: 'spirit'}, nigo: {flavour: 'pressure', cut: SLASH.nightfang}, gaunt: {flavour: 'steel', cut: SLASH.gravedigger},
  setsu: {flavour: 'bolt'}, shirokane: {flavour: 'bolt'}, shiden: {flavour: 'bolt'},
};
/** The enders whose element reads otherwise than their fighter's (COMBOS-DATA's names): the Blackout Flash's flash, Dirty
 *  Fireworks and the bomb going off, the Water Dragon, the Headhunter and the hounds out of the earth, a poke, Black
 *  Flash, Infinity, LORD ORO's freezing touch, the Silent Claw, Iron Spirit's inhale, Tourou's fireflies, Checkmate's
 *  knives, the yo-yo's steel. */
const MAIN_KEYS: Partial<Record<FighterId, Partial<Record<ComboKey, Flavour>>>> = {
  taisei: { llls: 'flash' }, ouga: { llh: 'explosion' }, shirokane: { lh: 'water', llh: 'plain', lllh: 'earth', llls: 'earth' },
  shiden: { lllh: 'fire' }, kuon: { lh: 'darkSpark', llls: 'infinity' }, oro: { llls: 'frost', airSpecial: 'knives' },
  gaunt: { llls: 'explosion', airSpecial: 'explosion' }, setsu: { lh: 'spark', lllh: 'claw' }, koko: { llls: 'inhale' },
  kagari: { llls: 'fireflies' }, gummy: { llh: 'flurry', airSpecial: 'fire' }, kosho: { llls: 'flurry' },
  // Cardiac Palm and Biopsy Strike release a shock inside the THEATRE: they land as his Flatline Shock sounds (sfxPlan ENDER_LANDS).
  ward: { lllh: 'bolt', airSpecial: 'bolt' },
};
const SOFT: ReadonlySet<Flavour> = new Set<Flavour>(['chi', 'slash', 'fire', 'room', 'spirit', 'pressure', 'steel', 'flash', 'explosion', 'water', 'earth',
  'plain', 'infinity', 'frost', 'claw', 'inhale', 'fireflies', 'knives', 'spark', 'flurry']);
const CRACKED: ReadonlySet<Flavour> = new Set<Flavour>(['ki', 'will', 'cursed', 'spirit', 'bolt', 'darkSpark']);
const MAIN_LOOKS = new Map<number, EnderLook>();
const MAIN_ORDER: readonly FighterId[] = ['taisei', 'konta', 'gummy', 'kosho', 'ouga', 'shirokane', 'shiden', 'kenzo', 'koko', 'nigo', 'kagari', 'ward', 'kuon', 'oro', 'gaunt', 'setsu'];
/** A main-game fighter's look for one ender, built the first time it is drawn and kept. */
function mainLook(fighter: FighterId, key: ComboKey, awakened: boolean): EnderLook | undefined {
  if (!isEnderKey(key)) return undefined;
  const row = MAIN[fighter], index = MAIN_ORDER.indexOf(fighter) * 16 + COMBO_KEYS.indexOf(key) * 2 + (awakened ? 1 : 0);
  if (!row || index < 0) return undefined;
  let look = MAIN_LOOKS.get(index);
  if (look) return look;
  const el = enderElement(fighter, key, awakened), move = comboMove(fighter, key, awakened);
  if (!el || !move) return undefined;
  const rim = new THREE.Color(el.rim), spike = new THREE.Color(el.spike), flavour = MAIN_KEYS[fighter]?.[key] ?? row.flavour;
  // Shiden's black flame is lit by its violet edge: its glow is the edge's, brighter.
  const glow = rim.clone().multiplyScalar(el.rim === 0x3a0a4a ? 5 : 2.4);
  // (The dream loop, round 24: an ender breaks the air like glass and discharges lightning only where lightning is its
  // element - Setsu's, Shirokane's, Shiden's. Taisei's ki cracked the air pink round a launched Ouga and the floor blue
  // under a slammed one - the critics' "jagged pink lightning" and "cyan crackle" - where the ender throws shards,
  // rings and rock instead.)
  const struck = !DREAM_IMPACT || flavour === 'bolt';
  look = {glow, el, move, flavour, cracks: CRACKED.has(flavour) && struck, soft: SOFT.has(flavour) || !struck,
    ring: spike.clone().multiplyScalar(.5).add(rim.clone().multiplyScalar(1.7)),
    cut: row.cut ?? {mode: ENERGY, edge: spike.clone().multiplyScalar(3.2), body: rim.clone().multiplyScalar(1.1), glow: rim.clone().multiplyScalar(.6)}};
  MAIN_LOOKS.set(index, look);
  return look;
}
/** A string's stun (Light x3, Special) read over the head it dazed, for as long as it holds: the element's stars
 *  circling it (`dazes`). */
interface Daze {targetId: string; since: number; active: boolean; glow: THREE.Color; electric: boolean; seed: number}
const DAZES = 6;
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
/** Gaunt': sparks off the steel, and blood. */
const STEEL_SPARK: Element = {spike: 0xffffff, rim: 0xffd9a0, light: 0xfff0d0, ink: 0x10141a};
const BLOOD_SPRAY: Element = {spike: 0xd0242a, rim: 0x6a0408, light: 0xff4a40, ink: 0x0a0002};

export class EmperorEffects {
  private kit: ElectricKit;
  private cutGeometry = new THREE.PlaneGeometry(1, 1);
  private ringGeometry = new THREE.RingGeometry(.86, 1, 64, 1);
  private sphere = new THREE.SphereGeometry(1, 40, 24);
  private cuts: Cut[] = [];
  private cracks: Crack[] = [];
  private rings: Ring[] = [];
  private domes: Dome[] = [];
  private strikes: Strike[] = [];
  private flashes: Flash[] = [];
  private beams: Beam[] = [];
  /** The bodies hidden through Cloudstep. */
  private hidden = new Set<Fighter>();
  /** Tobari's hips while he forms out of his crows, and the scale they had (`form`). */
  private formed = new Map<Fighter, Map<THREE.Object3D, THREE.Vector3>>();
  private susanoos = new WeakMap<Fighter, GhostShell | null>();
  private allShells: GhostShell[] = [];
  /** The worn Guardian's ghost, made once a fighter first wakes in it (NinjaEffects.guardian's, in their colours). */
  private guardian(f: Fighter, tint: { body: number; rim: number }) {
    if (this.susanoos.has(f)) return;
    const form = f.group.children.find(c => c !== f.model && c.name.startsWith('fighter-'));
    if (!form) return;
    let model: THREE.Object3D | undefined; form.traverse(o => { if (!model && (o as THREE.SkinnedMesh).isSkinnedMesh) model = o.parent ?? undefined; });
    if (!model) { this.susanoos.set(f, null); return; }
    const shell = new GhostShell(form, tint.body, tint.rim, .9, 0x020818, 2, true); shell.enabled = true;
    shell.fadeNear(f.group, 3.2, 6.8);
    this.susanoos.set(f, shell); this.allShells.push(shell);
  }
  /** Where each Tobari's Black Pyre was cast at (its cast's endpoint), and when. */
  private fields = new Map<string, {at: THREE.Vector3; since: number}>();
  /** Heaven's Anvil's meteors: a craggy rock, burning along its cracks and on the face it falls on, one a Akagane;
   *  `fall` is the way it is going. */
  private meteors: {mesh: THREE.Mesh; owner: string; fall: THREE.Vector3}[] = [];
  /** When each Guardian's wearer last woke into it: it is seen rising for two seconds after. */
  private risen = new Map<string, number>();
  /** The awakenings' own marks, each held through its beat (`drawSignatures`). */
  private signatures: {who: Emperor; actorId: string; since: number; seed: number}[] = [];
  /** Mirror Mere, Magatsu's dome (src/render/shop/MirrorMere.ts): the room replaced while it stands, and
   *  where each one opened (it stays there while he crosses it). */
  private domain: MirrorMereDomain;
  private lens = new THREE.Vector3();
  private seeing = false;
  private domainAt = new Map<string, {key: number; at: THREE.Vector3; flashed: boolean}>();
  /** False Encore's illusion, one a fighter (src/render/shop/FalseEncore.ts), and the heavy it was left by. */
  private decoys = new Map<string, {decoy: EncoreDecoy; key: number}>();
  /** SOJI: Clean Sweep's whirl of blade-light round Levin as he turns (src/render/shop/BladeWhirl.ts), one a Levin. */
  private whirls = new Map<string, BladeWhirl>();
  /** The Murder of Crows's crows (src/render/shop/CrowFlock.ts), every Tobari's, and the frame time they are stepped by; and
   *  the clone each Tobari leaves (a still copy of him, as False Encore's illusion is). The flock is built with a room
   *  that has an Tobari (`load`), not at the first 'Murder of Crows': built there, its program was linked by the draw of a
   *  fight's first clone, 37 to 110 ms of a royale's frame (launch day 15, scripts/night/late_sweep.mjs). */
  private crows?: CrowFlock;
  private clones = new Map<string, EncoreDecoy>();
  /** An illusion never shown, made with a room that has an Shiun or an Tobari (`load`): its shards (instanced, a colour a
   *  shard, drawn both sides) are drawn with the programs every Shiun's illusion and every Tobari's clone uses, so the
   *  room's compile links them behind the loading screen. Made at the first heavy, they were linked in that frame (two
   *  programs: launch day 15's sweep). */
  private warmDecoy?: EncoreDecoy;
  /** A whirl never shown, made with a room that has a Levin (`load`): its trail's two programs (coloured by vertex, drawn
   *  both sides) linked by the room's compile; made at his first SOJI: Clean Sweep, they were linked in that frame. */
  private warmWhirl?: BladeWhirl;
  private crowsAt = NaN;
  private crackWhite = new THREE.Color(2.2, 2.0, 2.6);
  /** Four-armed Magatsu's lower hands and weapons, for the four-handed sign's glow (`fourHandedSign`), by the body that has them. */
  private signs = new WeakMap<Fighter, {left?: THREE.Object3D; right?: THREE.Object3D; spear?: THREE.Object3D; dagger?: THREE.Object3D}>();
  /** Akagane's war-fan, one a Akagane, through his War Fan Sweep. */
  private gunbais: {fan: THREE.Group; owner: string}[] = [];
  private elbow = new THREE.Vector3();
  /** BLACK CONFESSIONAL's coffins, one an Shiun: five slabs each, sharing a material. */
  private coffins: {slabs: THREE.Mesh[]; material: THREE.ShaderMaterial; owner: string}[] = [];
  /** Where each Magatsu's Calamity Pyre landed: the fire burns there while they are thrown. */
  private 'calamity-pyre' = new Map<string, THREE.Vector3>();
  /** Crimson Command's black, over its red (willBolt). */
  private ink = new InkStrokes(900);
  private jag = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private across = new THREE.Vector3();
  /** Heaven's Harvest's haft and blade, one a Wuming: lit Rose, drawn through the cinematic from his grip. */
  private scythes: {haft: THREE.Mesh; blade: THREE.Mesh; owner: string}[] = [];
  private flameMaterial = flameSpriteMaterial();
  private flames = new THREE.InstancedMesh(flameSpriteGeometry(), this.flameMaterial, FLAMES);
  private flameCount = 0;
  private transform = new THREE.Object3D();
  private tint = new THREE.Color();
  private flameAxis = new THREE.Vector3();
  private seen = new Set<number>();
  /** What each fighter's swing last drew, by the move's start: one effect a swing. */
  private drawn = new Map<string, number>();
  /** And which ender each last decorated, by the move's start (`ender`), and which throw's hit (`mainEvent`). */
  private enderDrawn = new Map<string, number>();
  private enderHit = new Map<string, number>();
  /** The main game's sixteen: the shared sprite kit their enders' weight is drawn with (fetched the first time one is),
   *  where each one's field ender was cast at, and the stuns' dazes. */
  private vfx?: VfxKit;
  private enderAt = new Map<string, {at: THREE.Vector3; since: number}>();
  private dazes: Daze[] = Array.from({length: DAZES}, () => ({targetId: '', since: 0, active: false, glow: RING_WHITE, electric: false, seed: 0}));
  private m1 = new THREE.Vector3();
  private m2 = new THREE.Vector3();
  private m3 = new THREE.Vector3();
  private m4 = new THREE.Vector3();
  private dust = new THREE.Color();
  private dust2 = new THREE.Color();
  private softTint = new THREE.Color();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private c = new THREE.Vector3();
  private tip = new THREE.Vector3();
  private side = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private forward = new THREE.Vector3();
  private axis = new THREE.Vector3();

  private finales?: EmperorFinales;
  constructor(private scene: THREE.Scene) {
    if (Object.keys(FINALES).length) this.finales = new EmperorFinales(scene);
    this.kit = new ElectricKit(scene, 'emperor-bolts', 1600);
    for (let i = 0; i < CUTS; i++) {
      const mesh = new THREE.Mesh(this.cutGeometry, slashWaveMaterial()); mesh.name = 'emperor-cut'; mesh.frustumCulled = false; mesh.renderOrder = 4;
      applySlashStyle(mesh.material, CUT.gorai, i * 13, 1.25, .18); mesh.scale.setScalar(.001); mesh.position.set(0, -50, 0); scene.add(mesh);
      const cut: Cut = {mesh, since: 0, seconds: CUT_SECONDS, active: false}; mesh.onAfterRender = () => { if (!cut.active) mesh.visible = false; }; this.cuts.push(cut);
    }
    for (let i = 0; i < CRACKS; i++) this.cracks.push({center: new THREE.Vector3(), normal: new THREE.Vector3(), since: 0, seconds: CRACK_SECONDS, seed: 0, reach: 1, count: 8, active: false, color: COLOR.haldor.glow});
    for (let i = 0; i < RINGS; i++) {
      const material = new THREE.MeshBasicMaterial({color: new THREE.Color(2, 2.4, 2.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false});
      const mesh = new THREE.Mesh(this.ringGeometry, material); mesh.name = 'emperor-ring'; mesh.rotation.x = -Math.PI / 2; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 3;
      scene.add(mesh); this.rings.push({mesh, since: 0, radius: 1, active: false});
    }
    for (let i = 0; i < DOMES; i++) {
      // Crimson Command as a dome of dark will: near-black where it faces the
      // lens, crimson at the rim (gold, Dorado's), with a slow shudder of lines up it.
      const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
        uniforms: {uTime: {value: 0}, uOpacity: {value: 0}, uRim: {value: new THREE.Color(3.0, .18, .24)}},
        vertexShader: 'varying vec3 vNormal;varying vec3 vView;varying vec3 vLocal;void main(){vLocal=position;vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}',
        fragmentShader: `varying vec3 vNormal;varying vec3 vView;varying vec3 vLocal;uniform float uTime;uniform float uOpacity;uniform vec3 uRim;
          void main(){float facing=abs(dot(normalize(vNormal),normalize(vView)));float rim=pow(1.0-facing,2.4);
          float lines=smoothstep(.9,1.0,sin(vLocal.y*18.0+uTime*6.0+sin(vLocal.x*9.0)*1.5))*.5;
          vec3 colour=mix(vec3(.05,.0,.01),uRim,rim*.85+lines*.6);
          gl_FragColor=vec4(colour,(.32+rim*.55+lines*.3)*uOpacity);}`,
      });
      const mesh = new THREE.Mesh(this.sphere, material); mesh.name = 'sorrel-will-dome'; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 3;
      scene.add(mesh); this.domes.push({mesh, actorId: '', since: 0, radius: 1, seconds: DOME_SECONDS, lift: .9, active: false});
    }
    for (let i = 0; i < STRIKES; i++) this.strikes.push({center: new THREE.Vector3(), targetId: '', since: 0, seed: 0, kind: 'sky', active: false, color: COLOR.gorai.glow});
    for (let i = 0; i < FLASHES; i++) this.flashes.push({center: new THREE.Vector3(), since: 0, seed: 0, strength: 1, reach: 1, active: false, color: COLOR.gorai.glow});
    for (let i = 0; i < BEAMS; i++) this.beams.push({from: new THREE.Vector3(), to: new THREE.Vector3(), since: 0, seconds: BEAM_SECONDS, seed: 0, width: .03, active: false, color: RAY});
    this.flames.count = 0; this.flames.setColorAt(0, new THREE.Color(0, 0, flamePalette(BLACK))); this.flames.frustumCulled = false;
    this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.flames.name = 'emperor-flames'; scene.add(this.flames);
    scene.add(this.ink.mesh);
    const rock = meteorRock();
    for (let i = 0; i < METEORS; i++) {
      const fall = new THREE.Vector3(0, -1, 0), mesh = new THREE.Mesh(rock, meteorMaterial(fall));
      mesh.name = 'akagane-meteor'; mesh.visible = false; mesh.frustumCulled = false; scene.add(mesh); this.meteors.push({mesh, owner: '', fall});
    }
    const blade = scytheBlade(), shaft = new THREE.CylinderGeometry(.045, .045, 1, 8, 1).translate(0, .5, 0);
    for (let i = 0; i < METEORS; i++) {
      const lit = () => new THREE.MeshBasicMaterial({color: new THREE.Color(3.2, 1.2, 2.6), transparent: true, opacity: .9, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false});
      const haft = new THREE.Mesh(shaft, lit()), edge = new THREE.Mesh(blade, lit());
      for (const mesh of [haft, edge]) { mesh.name = 'wuming-scythe'; mesh.visible = false; mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 4; scene.add(mesh); }
      this.scythes.push({haft, blade: edge, owner: ''});
    }
    for (let i = 0; i < METEORS; i++) {
      const material = coffinMaterial();
      const slabs = COFFIN_SLABS.map(([w, h, d]) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.name = 'shiun-black-confessional'; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 3; scene.add(mesh);
        return mesh;
      });
      this.coffins.push({slabs, material, owner: ''});
    }
    for (let i = 0; i < METEORS; i++) { const fan = warFan(); scene.add(fan); this.gunbais.push({fan, owner: ''}); }
    this.domain = new MirrorMereDomain(scene);
  }

  /** What a room's fighters will draw that is otherwise first made in the fight (main.ts roomExtras, before the room's
   *  compile): the crows and an illusion's shards for an Tobari, the shards for an Shiun, a whirl's trail for a Levin.
   *  Hidden until used; kept. */
  load(fighters: Iterable<string>) {
    const ids = new Set(fighters);
    if (ids.has('tobari')) this.crows ??= new CrowFlock(this.scene, CROW_EYE);
    if (ids.has('tobari') || ids.has('shiun')) this.warmDecoy ??= new EncoreDecoy(this.scene, COLOR.shiun.glow);
    if (ids.has('levin')) this.warmWhirl ??= new BladeWhirl(this.scene);
  }

  // ---- what an event starts ------------------------------------------------------------------
  handle(events: readonly CombatEvent[], fighters: ReadonlyMap<string, Fighter>) {
    for (const event of events) {
      this.finales?.handle(event, fighters);
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!);
      const fighter = event.fighter;
      if (fighter && !EMPERORS.has(fighter) && MAIN[fighter] && event.branch) this.mainEvent(event, fighter, fighters);
      if (!fighter || !EMPERORS.has(fighter)) continue;
      const who = fighter as Emperor, actor = fighters.get(event.actorId);
      if (event.kind === 'awaken' && actor) this.awaken(who, actor, event.serverTime, event.id, fighters);
      // Black Pyre burns where it was cast at, as Shiden's does.
      if (event.kind === 'cast' && (who === 'tobari' || who === 'akagane' || who === 'rook') && event.slot === 'special' && event.endpoint) {
        const field = this.fields.get(event.actorId) ?? {at: new THREE.Vector3(), since: 0};
        field.at.set(event.endpoint.x, event.endpoint.y, event.endpoint.z); field.since = event.serverTime; this.fields.set(event.actorId, field);
      }
      if (event.kind !== 'hit' || event.slot !== 'ultimate') continue;
      // The ultimate's blows: the opener is the first contact, the finisher the last, and some have blows between
      // (the spears, the stabs, the spin's cuts, the shadows: moves.ts).
      const last = (event.contactIndex ?? 0) >= MOVES[who].ultimate.contacts.length - 1, opener = (event.contactIndex ?? 0) === 0;
      const between = !last && !opener, index = event.contactIndex ?? 0;
      const victim = event.targetId ? fighters.get(event.targetId) : undefined;
      if (victim) this.a.copy(victim.group.position).setY(victim.group.position.y + 1.1);
      else if (event.endpoint) this.a.set(event.endpoint.x, event.endpoint.y, event.endpoint.z);
      else continue;
      const seed = event.seed ?? event.id;
      if (who === 'gorai' && last) { this.strike(this.a, event.targetId ?? '', event.serverTime, seed, 'sky', COLOR.gorai.glow); this.ring(this.b.copy(this.a).setY(this.a.y - 1.05), event.serverTime, 4.2); }
      if (who === 'haldor' && actor) {
        // Every tremor breaks the air round him; the last throws them and rings the ground out.
        this.facing(actor);
        this.crack(this.b.copy(actor.handL).addScaledVector(this.forward, .4), this.forward, event.serverTime, seed, last ? 3.2 : 2.2, last ? 14 : 9, COLOR.haldor.glow);
        this.crack(this.c.copy(actor.handR).addScaledVector(this.forward, .4), this.forward, event.serverTime, seed + 7, last ? 3 : 2, last ? 12 : 8, COLOR.haldor.glow);
        this.ring(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), event.serverTime, last ? 5.2 : 3.6);
      }
      if (who === 'sorrel' && last) {
        this.strike(this.a, event.targetId ?? '', event.serverTime, seed, 'floor', WILL_RED);
        if (actor) { this.facing(actor); this.cut('sorrel', this.a, actor.state.yaw, 5.2, -.35, event.serverTime, .4, seed); }
      }
      if (who === 'magatsu' && actor) {
        this.facing(actor);
        // Calamity Pyre's blow is its fire (`ultimate`): a flash of it, and the burning floor, not lightning.
        if (last) { this.flash(this.a, 2.4, seed, 2.8, FIRE, event.serverTime); this.ring(this.b.copy(this.a).setY(this.a.y - 1.05), event.serverTime, 3.4); }
        else {
          for (let i = 0; i < 3; i++) {
            const r = this.kit.painter.rng.seed(seed * 3 + i);
            this.b.copy(this.a).setY(this.a.y + r.signed() * .4);
            this.cut('magatsu', this.b, actor.state.yaw + (i - 1) * 1.1 + r.signed() * .3, 2.6 + r.next(), r.signed() * 1.4, event.serverTime + i * .03, .26, seed + i * 17);
          }
          this.flash(this.a, .7, seed, 1.2, COLOR.magatsu.glow, event.serverTime);
        }
      }
      if (who === 'shiun') {
        // The coffin is black: only its edges catch the violet. The coffin itself is drawn through the cinematic
        // (`ultimate`); its spears come through it between (a dark blade, lilac-edged, each from another side).
        if (between && actor) {
          this.facing(actor);
          this.cut('shiun', this.a, actor.state.yaw + index * 1.9, 2.8, (index % 2 ? 1 : -1) * 1.25, event.serverTime, .3, seed);
          this.flash(this.a, .6, seed, 1.1, COLOR.shiun.glow, event.serverTime);
        }
        if (last) {
          if (actor) this.facing(actor);
          this.crack(this.a, this.forward, event.serverTime, seed, 3.2, 18, COLOR.shiun.glow);
          this.strike(this.b.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', COLOR.shiun.glow);
          this.flash(this.a, 1.4, seed, 2.2, COLOR.shiun.glow, event.serverTime);
        }
      }
      if (who === 'vesper') {
        const held = MOVES.vesper.ultimate.contacts[1] - MOVES.vesper.ultimate.contacts[0] + .15;
        if (!last) {
          // The Offering: the dark closes round whoever the thrust held, and the sun goes black over them.
          this.dome(event.targetId ?? '', event.serverTime, 1.35, ECLIPSE, held);
          this.dome(event.targetId ?? '', event.serverTime, .85, BRAND, held, 4.6);
        } else if (actor) {
          // The sabre down out of the dark, and the Offering Mark burnt into them.
          this.facing(actor);
          this.cut('vesper', this.a, actor.state.yaw, 5.6, .62, event.serverTime, .45, seed);
          this.crack(this.b.copy(this.a).setY(this.a.y + .25), this.forward, event.serverTime, seed, 2.8, 14, BRAND);
          this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', ECLIPSE);
          this.flash(this.a, 1.5, seed, 2.4, COLOR.vesper.glow, event.serverTime);
        }
      }
      if (who === 'wuming' && actor) {
        // Heaven's Harvest: the kick's blow, and then the scythe down through them - a cut wider than the room, the air
        // split along it, and rose over the floor.
        this.facing(actor);
        if (last) {
          this.cut('wuming', this.a, actor.state.yaw, 6.6, 1.15, event.serverTime, .5, seed);
          this.crack(this.b.copy(this.a).setY(this.a.y + .4), this.forward, event.serverTime, seed, 3.6, 16, COLOR['wuming'].glow);
          this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', COLOR['wuming'].glow);
          this.flash(this.a, 1.6, seed, 2.6, COLOR['wuming'].glow, event.serverTime);
        } else if (between) {
          // The scythe sweeps them once as it forms.
          this.cut('wuming', this.a, actor.state.yaw, 4.4, -.9, event.serverTime, .35, seed);
          this.flash(this.a, .9, seed, 1.4, COLOR['wuming'].glow, event.serverTime);
        } else this.flash(this.a, .8, seed, 1.3, COLOR['wuming'].glow, event.serverTime);
      }
      if (who === 'jirenga' && actor) {
        // The Mountain-Felling Fist: the hook's blow, and then the dive through them - the air split behind the fist, and
        // the floor rocked under them.
        this.facing(actor);
        if (last) {
          this.cut('jirenga', this.a, actor.state.yaw, 6.4, .2, event.serverTime, .5, seed);
          this.crack(this.a, this.forward, event.serverTime, seed, 3.8, 18, COLOR.jirenga.glow);
          this.strike(this.b.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', COLOR.jirenga.glow);
          this.ring(this.c.copy(this.a).setY(this.a.y - 1.05), event.serverTime, 5);
          this.flash(this.a, 1.7, seed, 2.8, COLOR.jirenga.glow, event.serverTime);
        } else {
          this.crack(this.a, this.forward, event.serverTime, seed, 1.8, 10, COLOR.jirenga.glow);
          this.flash(this.a, .8, seed, 1.3, COLOR.jirenga.glow, event.serverTime);
        }
      }
      if (who === 'gohaku' && actor) {
        // The Sun-Seizing Spiral: the beam's blow, and then it bores out through them - the air broken behind them
        // in its violet, and the floor rocked.
        this.facing(actor);
        if (last) {
          this.crack(this.b.copy(this.a).addScaledVector(this.forward, .45), this.forward, event.serverTime, seed, 3.4, 16, SPIRAL);
          this.flash(this.a, 1.6, seed, 2.6, STAR_BEAM_GOLD, event.serverTime);
          this.ring(this.c.copy(this.a).setY(this.a.y - 1.05), event.serverTime, 3.4);
        } else this.flash(this.a, .9, seed, 1.4, STAR_BEAM_GOLD, event.serverTime);
      }
      if (who === 'sekka' && actor) {
        // Shatter Art: Black Blizzard: the one-two's blow, and then the dash and the blow at its end - the air split, rings out over
        // the floor, the ice-blue of the needle under it.
        this.facing(actor);
        if (last) {
          this.crack(this.a, this.forward, event.serverTime, seed, 4, 20, COLOR.sekka.glow);
          this.flash(this.a, 1.8, seed, 2.8, COLOR.sekka.glow, event.serverTime);
          for (let i = 0; i < 2; i++) this.ring(this.c.copy(this.a).setY(this.a.y - 1.05), event.serverTime + i * .07, 3 + i * 1.6);
          this.strike(this.b.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', COMPASS);
        } else {
          this.crack(this.a, this.forward, event.serverTime, seed, 1.5, 9, COLOR.sekka.glow);
          this.flash(this.a, .8, seed, 1.3, COLOR.sekka.glow, event.serverTime);
        }
      }
      if (who === 'akagane' && last) {
        // The meteor comes down through them: the floor craters, rings out and burns.
        this.crack(this.b.copy(this.a).setY(this.a.y + .3), this.up, event.serverTime, seed, 4, 20, FIRE);
        for (let i = 0; i < 3; i++) this.ring(this.c.copy(this.a).setY(this.a.y - 1.05), event.serverTime + i * .07, 3 + i * 1.7);
        this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', FIRE);
        this.flash(this.a, 2.2, seed, 3.4, FIRE, event.serverTime);
      }
      if (who === 'asahi' && actor && between) {
        // The dance's turning cut: a crescent of the Sun's fire round through them.
        this.facing(actor);
        this.cut('sun', this.a, actor.state.yaw + .4, 4.4, -.7, event.serverTime, .4, seed);
        this.flash(this.a, 1, seed, 1.6, SUN, event.serverTime);
      }
      if (who === 'asahi' && actor && last) {
        // Lantern Rite: First Light comes down through them in a crescent of fire.
        this.facing(actor);
        this.cut('sun', this.a, actor.state.yaw, 5.8, 1.1, event.serverTime, .5, seed);
        this.cut('sun', this.b.copy(this.a).setY(this.a.y + .2), actor.state.yaw, 4.2, .9, event.serverTime + .04, .45, seed + 3);
        this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', FIRE);
        this.flash(this.a, 1.8, seed, 2.8, SUN, event.serverTime);
      }
      if (who === 'levin' && actor && between) {
        // A cut of the spin landing: brighter than the whirl's, from the side the spin has come round to.
        this.cut('levin', this.b.copy(this.a).setY(this.a.y + (index % 2 ? .3 : -.15)), actor.state.yaw + index * 1.26, 3.2, index % 2 ? .7 : -.7, event.serverTime, .3, seed);
        this.flash(this.a, .6, seed, 1.1, COLOR.levin.glow, event.serverTime);
      }
      if (who === 'levin' && actor && last) {
        // The spin's last pass: cuts all round them, and the air rings out.
        for (let i = 0; i < 5; i++) {
          const yaw = actor.state.yaw + i * Math.PI * 2 / 5;
          this.cut('levin', this.b.copy(this.a).setY(this.a.y + (i % 2 ? .25 : -.2)), yaw, 3.6, i % 2 ? .6 : -.6, event.serverTime + i * .03, .42, seed + i * 7);
        }
        this.ring(this.c.copy(this.a).setY(this.a.y - 1.05), event.serverTime, 3.8);
        this.flash(this.a, 1.6, seed, 2.6, COLOR.levin.glow, event.serverTime);
      }
      if (who === 'rook' && actor && between) {
        // A shadow soldier falls on them: its blade through them, out of the dark.
        this.cut('rook', this.a, actor.state.yaw + (index - 2) * .9, 3.6, (index % 2 ? 1 : -1) * .9, event.serverTime, .35, seed);
        this.flash(this.a, .8, seed, 1.3, SHADOW, event.serverTime);
      }
      if (who === 'rook' && actor && last) {
        // The shadows fall on them: their blades cross through them, and the dark runs out over the floor.
        for (let i = 0; i < 4; i++) this.cut('rook', this.a, actor.state.yaw + (i - 1.5) * .5, 4.2, (i % 2 ? 1 : -1) * .8, event.serverTime + i * .05, .45, seed + i * 5);
        this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', SHADOW);
        this.flash(this.a, 1.7, seed, 2.6, SHADOW, event.serverTime);
      }
      if (who === 'tobari') {
        const contacts = MOVES.tobari.ultimate.contacts, held = contacts[contacts.length - 1] - contacts[0] + .15;
        if (opener) {
          // Red Moon Reverie: the world goes red round whoever the kunai caught, and the moon over them red, until it breaks.
          this.dome(event.targetId ?? '', event.serverTime, 1.5, RED_MOON, held);
          this.dome(event.targetId ?? '', event.serverTime, .9, RED_EYE, held, 4.4);
        } else if (between && actor) {
          // Stabbed in the illusion, again and again: a crimson cut through them from another side each time.
          this.facing(actor);
          this.cut('tobari', this.a, actor.state.yaw + index * 2.1, 2.4, (index % 2 ? 1 : -1) * 1.1, event.serverTime, .26, seed);
          this.flash(this.a, .5, seed, .9, RED_EYE, event.serverTime);
        } else if (actor) {
          // And it breaks them: the air split in crimson, and the dark out over the floor.
          this.facing(actor);
          this.cut('tobari', this.a, actor.state.yaw, 4.8, .55, event.serverTime, .45, seed);
          this.crack(this.b.copy(this.a).setY(this.a.y + .2), this.forward, event.serverTime, seed, 3.2, 16, RED_EYE);
          this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', RED_MOON);
          this.flash(this.a, 1.5, seed, 2.4, RED_EYE, event.serverTime);
        }
      }
      if (who === 'ippon' && actor) {
        // The Clean Slate: one punch - the fist landing, held, and then going off through them: the air split in
        // front of him, rings out over the floor, and a wall of wind on ahead of it.
        this.facing(actor);
        if (last) {
          this.crack(this.a, this.forward, event.serverTime, seed, 4.6, 22, SERIOUS);
          this.flash(this.a, 2, seed, 3.2, COLOR.ippon.glow, event.serverTime);
          for (let i = 0; i < 3; i++) this.ring(this.c.copy(this.a).setY(this.a.y - 1.05).addScaledVector(this.forward, i * 1.6), event.serverTime + i * .06, 3.2 + i * 1.8);
          for (let i = 0; i < 3; i++) {
            this.b.copy(this.a).addScaledVector(this.forward, 1.2 + i * 1.8);
            this.cut('wind', this.b, actor.state.yaw, 4.2 + i * 1.4, .1 - i * .2, event.serverTime + i * .05, .45, seed + i * 11);
          }
          // And the sky splits ahead of him, as it does over the Clean Slate: one punch, and the clouds torn open far
          // beyond the one it hit (the blind critic, 3 October: "no single world-splitting punch").
          // The blast goes on ahead of the fist in a cone, as his card draws it: streaks of it out from the fist, rock
          // torn out of the floor under them and thrown on, the dust after it.
          this.side.set(this.forward.z, 0, -this.forward.x);
          for (let i = 0; i < 14; i++) {
            const r = this.kit.painter.rng.seed(seed * 17 + i), spread = r.signed() * .42, rise = r.signed() * .28;
            this.c.copy(this.forward).addScaledVector(this.side, spread).addScaledVector(this.up, rise).normalize();
            this.b.copy(actor.handR).addScaledVector(this.c, .3);
            this.tip.copy(this.b).addScaledVector(this.c, 5 + r.next() * 7);
            this.beam(this.b, this.tip, event.serverTime + i * .008, seed + i * 3, .05 + r.next() * .05, i % 3 ? SERIOUS : COLOR.ippon.glow, .38);
          }
          const vfx = VfxKit.for(this.scene), floor = actor.group.position.y;
          vfx.debris.burst(12, this.a.x, floor + .05, this.a.z, this.forward.x, .55, this.forward.z, 11, .5, .16, floor, 2);
          vfx.dustSpray(this.a.x, floor, this.a.z, this.forward.x, this.forward.z, 8, 5, .8, event.serverTime, .55, .6);
          // The wave going out along the line of the punch over half a second - ring after ring, wider as it goes - and a
          // trench torn in the floor under it.
          for (let i = 0; i < 7; i++) {
            this.b.copy(actor.handR).addScaledVector(this.forward, .8 + i * 1.4);
            vfx.ring(this.b.x, this.b.y, this.b.z, .3 + i * .25, 1.4 + i * .55, event.serverTime + i * .07, .34, 0xffffff, 0xffb070, .12, 'plane', this.forward.x, 0, this.forward.z);
            this.c.copy(actor.group.position).addScaledVector(this.forward, 1.6 + i * 1.3);
            vfx.marks.mark(MARK.crack, this.c.x, floor, this.c.z, 0, 1, 0, 1.7 + i * .25, event.serverTime + i * .07, 3, 0x000000, 0);
          }
          this.b.copy(this.a).addScaledVector(this.forward, 9).setY(this.a.y + 6.5);
          this.crack(this.b, this.forward, event.serverTime + .08, seed + 31, 9, 34, SERIOUS);
          this.flash(this.b, 1.4, seed + 37, 6, COLOR.ippon.glow, event.serverTime + .08);
          this.ring(this.c.copy(this.a).setY(this.a.y - 1.05).addScaledVector(this.forward, 7), event.serverTime + .16, 9);
        } else {
          // He plants into his stance and gets serious: the floor cracks under him and the dust goes out round his feet.
          // No blow lands here - the one punch is the finisher (a burst here took its thunder, the blind critics).
          const vfx = VfxKit.for(this.scene), floor = actor.group.position.y, at = actor.group.position;
          vfx.marks.mark(MARK.crack, at.x, floor, at.z, 0, 1, 0, 2, event.serverTime, 2.6, 0x000000, 0);
          vfx.dustRing(at.x, floor, at.z, 5, .35, 2.2, .5, event.serverTime);
          // The pressure of it goes out from him and over them: what stops them is his getting serious, not a fist.
          vfx.ring(at.x, floor + 1.1, at.z, .4, 2.8, event.serverTime, .38, 0xffffff, 0xffc870, .1, 'camera');
        }
      }
      if (who === 'gaku' && actor) {
        // Landslide: the straight, and then the Rock - the aura it was holding goes off through them in gold, rings
        // out over the floor, and the air splits on ahead.
        this.facing(actor);
        if (last) {
          this.crack(this.a, this.forward, event.serverTime, seed, 4.4, 22, COLOR.gaku.glow);
          this.flash(this.a, 2, seed, 3.2, COLOR.gaku.glow, event.serverTime);
          this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', COLOR.gaku.glow);
          for (let i = 0; i < 3; i++) this.ring(this.c.copy(this.a).setY(this.a.y - 1.05).addScaledVector(this.forward, i * 1.4), event.serverTime + i * .06, 3 + i * 1.6);
        } else {
          this.crack(this.a, this.forward, event.serverTime, seed, 1.5, 9, COLOR.gaku.glow);
          this.flash(this.a, .8, seed, 1.3, COLOR.gaku.glow, event.serverTime);
        }
      }
      // The Drowned Sun going off on whoever it caught: the air over them breaks, red.
      if (who === 'jinlin') {
        this.crack(this.b.copy(this.a).setY(this.a.y + .4), this.up, event.serverTime, seed, 2.6, 12, DROWNED_SUN_RED);
        this.flash(this.a, 1.3, seed, 2.2, DROWNED_SUN_RED, event.serverTime);
      }
      if (who === 'imago' && actor) {
        this.facing(actor);
        if (last) {
          // The Final Molt: both fists down through them, and the floor rocks.
          this.ring(this.b.copy(this.a).setY(this.a.y - 1.05), event.serverTime, 4.6);
          this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', COLOR.imago.glow);
          this.crack(this.a, this.up, event.serverTime, seed, 3.2, 16, COLOR.imago.glow);
          this.flash(this.a, 1.5, seed, 2.4, COLOR.imago.glow, event.serverTime);
        } else {
          // Each blow before it breaks the air where it lands.
          this.crack(this.a, this.forward, event.serverTime, seed, 1.8, 10, COLOR.imago.glow);
          this.flash(this.a, .8, seed, 1.2, COLOR.imago.glow, event.serverTime);
        }
      }
      if (who === 'dorado' && actor) {
        this.facing(actor);
        if (last) {
          // HORIZON SUNDER: one cut, wider than the room, the air behind it split, and gold out over the floor.
          this.cut('dorado', this.a, actor.state.yaw, 6.2, .62, event.serverTime, .5, seed);
          this.crack(this.b.copy(this.a).setY(this.a.y + .7).addScaledVector(this.forward, .6), this.forward, event.serverTime, seed, 4.2, 18, WILL_RED);
          this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', WILL_RED);
        } else this.cut('dorado', this.a, actor.state.yaw, 3.6, -.5, event.serverTime, .3, seed);
      }
    }
  }

  private awaken(who: Emperor, actor: Fighter, time: number, seed: number, fighters?: ReadonlyMap<string, Fighter>) {
    const head = this.a.copy(actor.group.position).setY(actor.group.position.y + 2.2);
    if (who === 'sekka' || who === 'haldor' || who === 'levin' || who === 'ippon' || who === 'asahi') {
      this.signatures = this.signatures.filter(m => m.actorId !== actor.state.id);
      this.signatures.push({who, actorId: actor.state.id, since: time, seed});
    }
    if (who === 'gorai') { this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + 1.2), actor.state.id, time, seed, 'sky', COLOR.gorai.glow); this.ring(this.c.copy(actor.group.position).setY(actor.group.position.y + .05), time, 4.6); }
    if (who === 'haldor') { this.crack(head.setY(head.y + .6), this.up, time, seed, 3.4, 16, COLOR.haldor.glow); this.ring(this.c.copy(actor.group.position).setY(actor.group.position.y + .05), time, 5); }
    if (who === 'sorrel') { this.dome(actor.state.id, time, 3.6, WILL_RED); this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', WILL_RED); }
    if (who === 'magatsu') {
      this.dome(actor.state.id, time, 5, new THREE.Color(1.4, .1, .14), 1.4);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COLOR.magatsu.glow);
    }
    if (who === 'shiun') {
      // Beyond pale seraph: the wings spread, and his pressure goes out round him.
      this.dome(actor.state.id, time, 4, COLOR.shiun.glow);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COLOR.shiun.glow);
      this.crack(head.setY(head.y + .5), this.up, time, seed, 2.6, 12, COLOR.shiun.glow);
    }
    if (who === 'vesper') {
      // Black Vespers, the Wing of Darkness: the sabre raised, the dark comes up round him and runs out over the floor.
      this.dome(actor.state.id, time, 4.4, ECLIPSE, 1.2);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', ECLIPSE);
      this.crack(head.setY(head.y + .9), this.up, time, seed, 2.8, 12, COLOR.vesper.glow);
    }
    if (who === 'wuming') {
      // LOTUS IN FLAME: the aura out round him in rose, and over the floor.
      this.dome(actor.state.id, time, 4, COLOR['wuming'].glow, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COLOR['wuming'].glow);
    }
    if (who === 'jirenga') {
      // WRATHFUL GUARDIAN: red out round him and over the floor, and the air over him breaking.
      this.dome(actor.state.id, time, 4.2, COLOR.jirenga.glow, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COLOR.jirenga.glow);
      this.crack(head.setY(head.y + .3), this.up, time, seed, 3, 14, COLOR.jirenga.glow);
    }
    if (who === 'jinlin') {
      // The gold flares round him and over the floor.
      this.dome(actor.state.id, time, 3.8, COLOR['jinlin'].glow, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COLOR['jinlin'].glow);
      this.flash(this.c.copy(actor.group.position).setY(actor.group.position.y + 1.2), 1.4, seed, 2.2, COLOR['jinlin'].glow, time);
    }
    if (who === 'gohaku') {
      // The Beast: the roar, white light out round him with its red-violet, over the floor, and the air over him breaking.
      this.dome(actor.state.id, time, 4.2, BEAST_RIM, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', BEAST_RIM);
      this.crack(head.setY(head.y + .4), this.up, time, seed, 3, 14, COLOR['gohaku'].glow);
    }
    if (who === 'sekka') {
      // WHITEOUT: his roar, the ice-blue of the needle round him and over the floor.
      this.dome(actor.state.id, time, 4.2, COMPASS, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COMPASS);
      this.crack(head.setY(head.y + .3), this.up, time, seed, 2.8, 12, COLOR.sekka.glow);
    }
    if (who === 'tobari') {
      // The Guardian: its red-orange rising round him, out over the floor, and the air over him breaking.
      this.dome(actor.state.id, time, 4.2, GUARDIAN, 1.2);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', GUARDIAN);
      this.crack(head.setY(head.y + .5), this.up, time, seed, 2.8, 12, GUARDIAN);
    }
    if (who === 'akagane') {
      // The WRATHFUL KING rises round him, blue-violet, and the air over him breaks.
      this.dome(actor.state.id, time, 4.6, WRATHFUL_KING, 1.3);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', WRATHFUL_KING);
      this.crack(head.setY(head.y + .6), this.up, time, seed, 3.2, 14, WRATHFUL_KING);
    }
    if (who === 'asahi') {
      // The Sun's breath: fire round him and out over the floor.
      this.dome(actor.state.id, time, 4, SUN, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', FIRE);
      this.flash(this.c.copy(actor.group.position).setY(actor.group.position.y + 1.1), 1.4, seed, 2.2, SUN, time);
    }
    if (who === 'levin') {
      // Spotless: the green round him, and the air rings.
      this.dome(actor.state.id, time, 3.8, WINGS, 1);
      this.ring(this.c.copy(actor.group.position).setY(actor.group.position.y + .05), time, 4.2);
    }
    if (who === 'rook') {
      // The HOLLOW CROWN: the violet dark round him and over the floor.
      this.dome(actor.state.id, time, 4.4, SHADOW, 1.2);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', SHADOW);
      this.crack(head.setY(head.y + .4), this.up, time, seed, 2.8, 12, SHADOW);
    }
    if (who === 'gaku') {
      // KOMAINU: his rage and his aura poured into one body - gold round him, over the floor, and up.
      this.dome(actor.state.id, time, 4.4, COLOR.gaku.glow, 1.2);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COLOR.gaku.glow);
      this.crack(head.setY(head.y + .6), this.up, time, seed, 3, 14, COLOR.gaku.glow);
    }
    if (who === 'ippon') {
      // ALL-NIGHTER: the air round him presses down, white into red, and over the floor.
      this.dome(actor.state.id, time, 4, SERIOUS, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', SERIOUS);
      this.ring(this.c.copy(actor.group.position).setY(actor.group.position.y + .05), time, 4.4);
    }
    if (who === 'imago') {
      // The King reborn: his aura out round him in jade, over the floor and up.
      this.dome(actor.state.id, time, 4.2, COLOR.imago.glow, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COLOR.imago.glow);
      this.crack(head.setY(head.y + .6), this.up, time, seed, 2.6, 12, COLOR.imago.glow);
    }
    if (who === 'dorado') {
      // The LAST HORIZON: Kagari up, and his Crimson Command out round him, black lightning edged in red over the
      // floor (in gold it read as no will at all: the blind critics, 3 October).
      this.dome(actor.state.id, time, 4, WILL_RED);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', WILL_RED);
      this.crack(head.setY(head.y + .7), this.up, time, seed, 3, 14, WILL_RED);
    }
  }

  // ---- the pools -----------------------------------------------------------------------------
  private cut(who: Emperor | 'wind' | 'sun', at: THREE.Vector3, yaw: number, scale: number, roll: number, time: number, seconds: number, seed: number) {
    this.cutWith(who === 'wind' ? WIND : who === 'sun' ? SUN_CUT : CUT[who], who === 'wind' ? .3 : .18, at, yaw, scale, roll, time, seconds, seed);
  }
  /** A cut in any style: an ender's in its look's (`ender`). */
  private cutWith(style: SlashStyle, thick: number, at: THREE.Vector3, yaw: number, scale: number, roll: number, time: number, seconds: number, seed: number) {
    const cut = this.cuts.find(c => !c.active) ?? this.cuts.reduce((x, y) => x.since <= y.since ? x : y);
    cut.active = true; cut.since = time; cut.seconds = seconds; cut.mesh.visible = true;
    applySlashStyle(cut.mesh.material, style, seed, 1.25, thick);
    cut.mesh.position.copy(at); cut.mesh.rotation.set(0, yaw, roll); cut.mesh.scale.setScalar(scale);
  }
  /** `seconds`: how long its lines take to go dark. */
  private crack(center: THREE.Vector3, normal: THREE.Vector3, time: number, seed: number, reach: number, count: number, color: THREE.Color, seconds = CRACK_SECONDS) {
    const crack = this.cracks.find(c => !c.active) ?? this.cracks.reduce((x, y) => x.since <= y.since ? x : y);
    crack.center.copy(center); crack.normal.copy(normal).normalize(); crack.since = time; crack.seconds = seconds; crack.seed = seed % 997; crack.reach = reach; crack.count = count; crack.color = color; crack.active = true;
  }
  /** `color`: the ring's own (the main game's enders' element); the pool's white-blue otherwise. */
  private ring(center: THREE.Vector3, time: number, radius: number, color = RING_WHITE) {
    const ring = this.rings.find(r => !r.active) ?? this.rings.reduce((x, y) => x.since <= y.since ? x : y);
    ring.mesh.position.copy(center); ring.since = time; ring.radius = radius; ring.active = true; ring.mesh.visible = true;
    ring.mesh.material.color.copy(color);
  }
  /** `lift`: how far above the body's feet the dome's centre sits - round the body, or (the offering's sun) over it. */
  private dome(actorId: string, time: number, radius: number, rim: THREE.Color, seconds = DOME_SECONDS, lift = .9) {
    const dome = this.domes.find(d => !d.active) ?? this.domes.reduce((x, y) => x.since <= y.since ? x : y);
    dome.actorId = actorId; dome.since = time; dome.radius = radius; dome.seconds = seconds; dome.lift = lift; dome.active = true; dome.mesh.visible = true;
    dome.mesh.material.uniforms.uRim.value.copy(rim);
  }
  /** `soft`: a discharge without lightning in it (fire, steel, a sword's): the glare, its ring and its light alone. */
  private flash(center: THREE.Vector3, strength: number, seed: number, reach: number, color: THREE.Color, time: number, soft = false) {
    const flash = this.flashes.find(f => !f.active) ?? this.flashes.reduce((x, y) => x.since <= y.since ? x : y);
    // The dream loop (22 October 2026): the ender's own glow is the colour of the blow under its burst - the burst
    // (VfxKit's, the finisher class) is the hit now; at full size this ball hid the victim for three frames.
    const dream = DREAM_IMPACT ? (soft ? .2 : .3) : 1, wide = DREAM_IMPACT ? .7 : 1;
    flash.center.copy(center); flash.since = time; flash.seed = seed % 97; flash.strength = strength * dream; flash.reach = reach * wide; flash.color = color; flash.active = true;
    flash.soft = soft;
  }
  private beam(from: THREE.Vector3, to: THREE.Vector3, time: number, seed: number, width: number, color: THREE.Color, seconds = BEAM_SECONDS) {
    const beam = this.beams.find(b => !b.active) ?? this.beams.reduce((x, y) => x.since <= y.since ? x : y);
    beam.from.copy(from); beam.to.copy(to); beam.since = time; beam.seconds = seconds; beam.seed = seed % 997; beam.width = width; beam.color = color; beam.active = true;
  }
  private strike(center: THREE.Vector3, targetId: string, time: number, seed: number, kind: Strike['kind'], color: THREE.Color) {
    const strike = this.strikes.find(s => !s.active) ?? this.strikes.reduce((x, y) => x.since <= y.since ? x : y);
    strike.center.copy(center); strike.targetId = targetId; strike.since = time; strike.seed = seed % 997; strike.kind = kind; strike.color = color; strike.active = true;
  }
  /** `forward` set to where the fighter faces, flat. */
  private facing(actor: Fighter) { this.forward.set(Math.sin(actor.state.yaw), 0, Math.cos(actor.state.yaw)); }

  // ---- the frame -----------------------------------------------------------------------------
  update(time: number, fighters: ReadonlyMap<string, Fighter>, density: number, camera?: THREE.Camera) {
    const kit = this.kit; kit.begin(time, density); this.ink.begin();
    this.finales?.update(time, fighters);
    this.domain.begin();
    if (camera) { camera.getWorldPosition(this.lens); this.seeing = true; }
    this.flameCount = 0; this.flameMaterial.uniforms.uTime.value = time;
    for (const f of this.hidden) { let present = false; for (const g of fighters.values()) if (g === f) { present = true; break; } if (!present) this.hidden.delete(f); }
    for (const f of this.formed.keys()) { let present = false; for (const g of fighters.values()) if (g === f) { present = true; break; } if (!present) this.formed.delete(f); }
    for (const [id, actor] of fighters) {
      const s = actor.state;
      const worn = GUARDIAN_TINT[s.fighter];
      if (worn && s.awakened) this.guardian(actor, worn);
      // Through the awakening and the two seconds after it the Guardian is seen rising round him: it fades only right
      // at the lens then. At a fight's distance it clears from 3.2 m, so the fighter inside it reads (the blind
      // critics, 3 October: "no Guardian forms").
      if (worn && s.action === 'awaken') this.risen.set(id, time);
      const shell = worn ? this.susanoos.get(actor) : undefined;
      if (shell) { if (time - (this.risen.get(id) ?? -9) < 2) shell.fadeRange(.8, 2.2); else shell.fadeRange(3.2, 6.8); }
      // Wuming's Cloudstep and Tobari's Murder of Crows: gone from the vanish until just past the return, and
      // back for anything else.
      // (A combo ender thrown from the heavy is not the heavy: no vanish, no crows, no copy - game/combos.ts.)
      const elapsedNow = s.actionTime * s.actionDuration, blink = s.action === 'heavy' && !s.branch ? BLINKS[s.fighter] : undefined;
      const gone = s.alive && !!blink && elapsedNow >= blink.vanish && elapsedNow < blink.appear + APPEAR_HOLD;
      if (gone !== this.hidden.has(actor)) {
        actor.group.visible = !gone;
        if (gone) this.hidden.add(actor); else this.hidden.delete(actor);
      }
      // Tobari back out of his crows, grown from nothing (after the fighter's own pose this frame: the frame loop poses
      // the fighters first).
      const forming = s.alive && s.fighter === 'tobari' && s.action === 'heavy' && !s.branch ? elapsedNow - BLINKS.tobari!.appear - APPEAR_HOLD : NaN;
      if (forming >= 0 && forming < FORMED) this.form(actor, forming); else if (this.formed.has(actor)) this.unform(actor);
      if (!EMPERORS.has(s.fighter)) { if (s.alive) this.mainEnder(id, actor, time, fighters); continue; }
      if (!s.alive) continue;
      const who = s.fighter as Emperor, colour = COLOR[who];
      const elapsed = s.actionTime * s.actionDuration, key = Math.round(s.actionStarted * 1000);
      this.facing(actor);
      // A combo ender (game/combos.ts) thrown from the heavy or the special: drawn as its own (`ender`), never as the
      // move of the slot it came from.
      const ender = s.branch && (s.action === 'heavy' || s.action === 'special') ? s.branch : undefined;
      const enderMove = ender ? comboMove(who, ender, !!s.awakened) : undefined;
      // A swing's cut where the weapon goes through: the light and every stage of its string, and the heavy, bigger.
      // (Sekka's Avalanche lands four fists, each its own: `avalanche`.) An ender that is a blow is cut the same way.
      // (A heavy that is thrown or fired - Ippon's sneeze, Levin's fuse lance, Asahi's sword - is no swing.)
      if (s.action === 'light' || s.action === 'heavy' && (ender ? enderMove?.style === 'melee' && ender !== 'airSpecial' : who !== 'sekka' && MOVES[who].heavy.style === 'melee')) {
        const move = s.action === 'light' ? rushMove(who, s.chain ?? 0, !!s.awakened) : enderMove ?? MOVES[who].heavy;
        const contact = move.contacts[0];
        if (elapsed >= contact && elapsed < contact + .1 && this.drawn.get(id) !== key) {
          this.drawn.set(id, key);
          const big = s.action === 'heavy';
          this.a.copy(actor.group.position).addScaledVector(this.forward, big ? 1.5 : 1.3).setY(actor.group.position.y + (big ? 1.0 : 1.15));
          // Across whoever it lands on, when they stand in reach ahead: drawn a fixed step ahead, Magatsu's Cleave fell
          // "a body-width beside" the one it hit (the blind critic, 3 October).
          let yaw = s.yaw;
          const struck = s.target ? fighters.get(s.target) : undefined;
          if (struck && struck !== actor && struck.state.alive) {
            const dx = struck.group.position.x - actor.group.position.x, dz = struck.group.position.z - actor.group.position.z, d = Math.hypot(dx, dz);
            if (d > .3 && d < 4.5 && (dx * this.forward.x + dz * this.forward.z) / d > .5) {
              this.a.copy(struck.group.position).setY(struck.group.position.y + (big ? 1.0 : 1.15));
              yaw = Math.atan2(dx, dz);
            }
          }
          if (who === 'shiun' && !s.awakened && s.action === 'light' && s.chain === 2) {
            // Cinder Step: base Shiun is beside them in an instant - a flash of violet where the cut lands, and a ring
            // on the floor under him (the blind critic, 3 October: "no blink").
            this.flash(this.b.copy(actor.group.position).setY(actor.group.position.y + 1.1), .8, key + 3, 1.2, colour.glow, time);
            this.ring(this.c.copy(actor.group.position).setY(actor.group.position.y + .05), time, 1.6);
          }
          if (who === 'shiun' && s.awakened && !big && !(s.action === 'light' && s.chain === 2)) {
            // The winged form's open palm: the air breaks like glass where the blow lands. (False Encore's breaking is
            // the copy's now, before the blow: `illusion`.)
            this.crack(this.a, this.forward, time, key, big ? 2.2 : 1.1, big ? 12 : 7, colour.glow);
            this.flash(this.a, big ? .9 : .5, key, big ? 1.4 : .9, colour.glow, time);
          }
          // (Wuming's heavy is the Petalfall Blade, its cut his own: `transmission`. Jirenga's fists, Golden
          // Jinlin's beams and tail, Gohaku's fists and feet, Ippon's, Sekka's and Gaku's are theirs: `prideBlow`,
          // `emperorBlow`, `beastBlow`, `heroBlow`, `demonBlow`, `hunterBlow`.)
          if (who === 'jirenga') this.prideBlow(actor, big, s.chain ?? 0, key, time);
          else if (who === 'jinlin') this.emperorBlow(actor, big, s.chain ?? 0, key, time);
          else if (who === 'gohaku') this.beastBlow(actor, big, s.chain ?? 0, key, time);
          else if (who === 'ippon') this.heroBlow(actor, big, s.chain ?? 0, key, time);
          else if (who === 'sekka') this.demonBlow(actor, s.chain ?? 0, key, time);
          else if (who === 'gaku') this.hunterBlow(actor, big, s.chain ?? 0, key, time);
          else if ((who !== 'shiun' || !s.awakened || big || s.chain === 2) && !(who === 'wuming' && big))
            this.cut(who, this.a, yaw, big ? 3.4 : 2.7, (s.chain ?? 0) % 2 ? -.5 : .5, time, big ? .3 : CUT_SECONDS, key);
          if (who === 'levin')
            // Both blades: every cut is two.
            this.cut('levin', this.b.copy(this.a).setY(this.a.y - .25), yaw, big ? 3 : 2.4, (s.chain ?? 0) % 2 ? .5 : -.5, time + .03, CUT_SECONDS, key + 9);
          if (who === 'imago' && s.action === 'light' && !s.chain)
            // The Swarm Claw: three marks where one hand went.
            for (let i = 0; i < 2; i++) {
              this.b.copy(this.a).setY(this.a.y + (i ? -.22 : .22));
              this.cut('imago', this.b, yaw, 2.4, .5, time + .02 * (i + 1), CUT_SECONDS, key + 11 * (i + 1));
            }
          if (who === 'magatsu' && !big)
            for (let i = 0; i < 2; i++) {
              const r = kit.painter.rng.seed(key * 3 + i);
              this.b.copy(this.a).addScaledVector(this.forward, .3 + r.next() * .5).setY(this.a.y + r.signed() * .35);
              this.cut('magatsu', this.b, s.yaw + r.signed() * .3, 1.6 + r.next() * .6, r.signed() * 1.3, time + .03 * (i + 1), CUT_SECONDS, key + 17 * (i + 1));
            }
          // (Not under Jirenga's uppercut, which goes up, nor Tobari's kick out of his crows: the same white ring under every
          // heavy, the blind critics.)
          if (big && who !== 'sorrel' && who !== 'dorado' && who !== 'shiun' && who !== 'magatsu' && who !== 'jinlin' && who !== 'jirenga' && who !== 'tobari') this.ring(this.b.copy(actor.group.position).addScaledVector(this.forward, 1.6).setY(actor.group.position.y + .05), time, 2.2);
        }
      }
      if (who === 'wuming' && s.action === 'heavy' && !ender) this.transmission(id, actor, elapsed, key, time);
      if (who === 'tobari' && s.action === 'heavy' && !ender) this.murderOfCrows(id, actor, elapsed, key, time, fighters);
      if (who === 'tobari' && !(s.action === 'heavy' && !ender && s.alive)) this.clones.get(id)?.release();
      if (who === 'sekka' && s.action === 'heavy' && !ender) this.avalanche(id, actor, elapsed, key, time, fighters);
      if (who === 'jirenga' && s.action === 'heavy' && !ender) this.uprootingFist(id, actor, elapsed, key, time);
      if (who === 'ippon' && s.action === 'heavy' && !ender) this.sneeze(id, actor, elapsed, key, time);
      if (who === 'shiun') this.illusion(id, actor, elapsed, key, time);
      if (who === 'magatsu' && s.action === 'ultimate') this.fourHandedSign(actor, elapsed);
      if (who === 'akagane' && !(s.action === 'ultimate' && s.alive)) this.hideMeteor(id);
      if (who === 'levin' && !(s.action === 'ultimate' && s.alive)) this.whirls.get(id)?.hide();
      if (who === 'wuming' && !(s.action === 'ultimate' && s.alive)) this.hideScythe(id);
      if (who === 'shiun' && !(s.action === 'ultimate' && s.alive)) this.hideCoffin(id);
      if (who === 'akagane') {
        const forearm = actor.bones.get('rightforearm');
        if (s.alive && s.action === 'light' && (s.chain ?? 0) === 0 && forearm) {
          let slot = this.gunbais.find(m => m.owner === id);
          slot ??= this.gunbais.find(m => !m.owner) ?? this.gunbais[0];
          slot.owner = id;
          forearm.getWorldPosition(this.elbow);
          this.axis.subVectors(actor.handR, this.elbow);
          if (this.axis.lengthSq() < 1e-4) this.axis.copy(this.up); else this.axis.normalize();
          this.side.crossVectors(this.axis, this.up);
          if (this.side.lengthSq() < 1e-4) this.side.copy(this.forward);
          this.side.normalize();
          this.tip.crossVectors(this.side, this.axis).normalize();
          const fan = slot.fan;
          fan.matrix.makeBasis(this.side, this.axis, this.tip).setPosition(this.a.copy(actor.handR).addScaledVector(this.axis, -.1));
          fan.matrixAutoUpdate = false; fan.matrixWorldNeedsUpdate = true; fan.visible = true;
        } else this.hideWarFan(id);
      }
      if (s.action === 'special' && !ender) this.special(who, id, actor, elapsed, key, time, fighters);
      if (ender && enderMove && s.alive) this.ender(who, SHOP_LOOK[who], id, actor, ender, enderMove, elapsed, key, time, fighters);
      if (s.action === 'ultimate') this.ultimate(who, id, actor, elapsed, key, time, fighters);
      // Awakened: a crackle in their colour, a few arcs a tick about the body and the weapon. Crimson Command runs
      // over Sorrel and Dorado twice as often, two arcs a tick (the blind critic saw no will in any frame).
      const will = who === 'sorrel' || who === 'dorado';
      if (s.awakened && kit.ticked && density > .2) for (let pass = 0; pass < (will ? 2 : 1); pass++) {
        const r = kit.painter.rng.seed(kit.tick * 31 + key + pass * 977);
        if (r.next() < (who === 'haldor' ? .25 : will ? .9 : .55)) {
          actor.strikePoint(this.tip);
          const from = r.next() < .5 ? actor.handR : actor.handL;
          this.a.set(r.signed() * .5, r.signed() * .6 + .3, r.signed() * .5).add(from);
          // Haldor's: the air crazed where his hand closes, lines alone (as a crack, its glare a white wheel every
          // tick: "white spoked wheels cover him", the blind critic, 3 October).
          if (who === 'haldor') for (let i = 0; i < 5; i++) {
            const angle = i / 5 * Math.PI * 2 + r.signed() * .4;
            this.b.copy(this.a).addScaledVector(this.forward, .05).y += Math.sin(angle) * .45;
            this.b.addScaledVector(this.c.set(this.forward.z, 0, -this.forward.x), Math.cos(angle) * .45);
            kit.arc(this.a, this.b, kit.tick * 7 + i + key, .014, colour.glow, .8, 1, 2, .5);
          }
          else if (will) this.willBolt(from, r.next() < .5 ? this.tip : this.a, kit.tick * 7 + 3 + pass * 131, .05, .95);
          else kit.arc(from, r.next() < .5 ? this.tip : this.a, kit.tick * 7 + 3, .03, colour.glow, .9, 1, 3, .34);
        }
      }
    }
    if (this.crows) {
      const dt = Number.isFinite(this.crowsAt) ? THREE.MathUtils.clamp(time - this.crowsAt, 0, .1) : 0;
      this.crowsAt = time;
      this.crows.update(time, dt, this.seeing ? this.lens : undefined);
    }
    this.draw(time, fighters, density);
    this.drawSignatures(time, fighters);
    // What these techniques light round them, at a third (LIGHT_SCALE), just before the frame's lights go up.
    const lights = kit.lights, lit = lights.mesh.instanceColor!.array as Float32Array;
    for (let i = 0; i < lights.count * 3; i++) lit[i] *= LIGHT_SCALE;
    kit.end(COLOR.gorai.glow); this.ink.end();
    this.domain.end();
    this.flames.count = this.flameCount; this.flames.instanceMatrix.needsUpdate = true;
    if (this.flames.instanceColor) this.flames.instanceColor.needsUpdate = true;
  }

  /** Jirenga's fists, at the blow (`a`): the air breaks where they land; the Uprooting Fist, an uppercut, cuts up through
   *  it and breaks the air over them, and the Crushing Heel rocks the floor. */
  private prideBlow(actor: Fighter, heavy: boolean, chain: number, key: number, time: number) {
    const colour = COLOR.jirenga;
    if (heavy) {
      // The uppercut goes on up: streaks of its light off the fist, rising with it (drawn at the one it hit, under the
      // burst, they read as "thin red sticks", the blind critics). (Its crescent, laid as a swing's is, was a bowl on
      // the floor under them; it is Ippon's heavy's still.)
      this.side.set(this.forward.z, 0, -this.forward.x);
      for (let i = 0; i < 5; i++) {
        const out = i - 2;
        this.b.copy(actor.handR).addScaledVector(this.side, out * .13).addScaledVector(this.up, -.35 + Math.abs(out) * .1);
        this.c.copy(this.b).addScaledVector(this.side, out * .08).setY(this.b.y + 2.3 - Math.abs(out) * .45);
        this.beam(this.b, this.c, time + Math.abs(out) * .025, key + i, .045 - Math.abs(out) * .006, colour.glow, .26);
      }
      // A flash under their chin, where the fist goes through, and no starburst: its lightning ran out sideways over
      // them, "against the upward motion", and lit at his fist it sat on his own head (the blind critics).
      this.flash(this.c.copy(this.a).setY(this.a.y + .5), .6, key, 1.1, colour.glow, time);
      return;
    }
    const heel = chain === 3;
    this.crack(this.a, this.forward, time, key, heel ? 1.7 : 1, heel ? 10 : 6, colour.glow);
    this.flash(this.a, heel ? .9 : .55, key, heel ? 1.4 : .9, colour.glow, time);
    if (heel) this.ring(this.b.copy(actor.group.position).addScaledVector(this.forward, 1.4).setY(actor.group.position.y + .05), time, 2.6);
  }

  /** Gohaku's fists and feet, at the blow (`a`): the air breaks where they land; the Rising Kick cuts up
   *  through it, and the Mountain Hammer - both fists brought down - rocks the floor. */
  private beastBlow(actor: Fighter, heavy: boolean, chain: number, key: number, time: number) {
    const colour = COLOR['gohaku'];
    if (heavy) {
      this.cut('gohaku', this.b.copy(this.a).setY(this.a.y + .3), actor.state.yaw, 3.2, -1.3, time, .3, key);
      this.crack(this.c.copy(this.a).setY(this.a.y + .5), this.forward, time, key, 2, 11, colour.glow);
      this.flash(this.c, .9, key, 1.5, colour.glow, time);
      return;
    }
    const hammer = chain === 3;
    this.crack(this.a, this.forward, time, key, hammer ? 1.7 : 1, hammer ? 10 : 6, colour.glow);
    this.flash(this.a, hammer ? .9 : .5, key, hammer ? 1.4 : .85, colour.glow, time);
    if (hammer) this.ring(this.b.copy(actor.group.position).addScaledVector(this.forward, 1.4).setY(actor.group.position.y + .05), time, 2.6);
  }

  /** Ippon's fists, at the blow (`a`): the air breaks where they land; the Clock-Out Uppercut cuts up through it, and
   *  the Clock-In Kick that ends his string rings out over the floor. */
  private heroBlow(actor: Fighter, heavy: boolean, chain: number, key: number, time: number) {
    const colour = COLOR.ippon;
    if (heavy) {
      this.cut('ippon', this.b.copy(this.a).setY(this.a.y + .35), actor.state.yaw, 3.2, 1.4, time, .3, key);
      this.crack(this.c.copy(this.a).setY(this.a.y + .6), this.up, time, key, 2.2, 12, colour.glow);
      this.flash(this.c, 1, key, 1.6, colour.glow, time);
      return;
    }
    const kick = chain === 3;
    this.crack(this.a, this.forward, time, key, kick ? 1.8 : 1, kick ? 11 : 6, colour.glow);
    this.flash(this.a, kick ? .95 : .5, key, kick ? 1.5 : .85, colour.glow, time);
    if (kick) this.ring(this.b.copy(actor.group.position).addScaledVector(this.forward, 1.4).setY(actor.group.position.y + .05), time, 2.8);
  }

  /** Gaku's blows, at the blow (`a`): the Landslide's fist goes off in gold where it lands; the two-finger cut draws the aura out of
   *  his two fingers into a blade swept through them; the rising paw that ends his string goes off up through them. */
  private hunterBlow(actor: Fighter, heavy: boolean, chain: number, key: number, time: number) {
    const colour = COLOR.gaku;
    if (heavy) {
      this.cut('gaku', this.b.copy(this.a).setY(this.a.y + .1), actor.state.yaw, 3.8, -.35, time, .32, key);
      this.flash(this.b, .8, key, 1.3, colour.glow, time);
      return;
    }
    const rising = chain === 3;
    this.crack(this.a, rising ? this.up : this.forward, time, key, rising ? 1.6 : 1, rising ? 10 : 6, colour.glow);
    this.flash(this.a, rising ? .9 : .55, key, rising ? 1.4 : .9, colour.glow, time);
  }

  /** Sekka's string, at the blow (`a`): Frost Gale's shock goes on ahead of the fist; the Icefall Hammer, the axe kick
   *  that ends his string, rocks the floor. (Avalanche's fists are `avalanche`'s, one at each of its four blows.) */
  private demonBlow(actor: Fighter, chain: number, key: number, time: number) {
    const colour = COLOR.sekka;
    this.crack(this.a, this.forward, time, key, chain === 3 ? 1.7 : 1, chain === 3 ? 10 : 6, colour.glow);
    this.flash(this.a, chain === 3 ? .9 : .5, key, chain === 3 ? 1.4 : .85, colour.glow, time);
    // Frost Gale: the struck air carries on past them.
    if (chain === 0) this.cut('wind', this.b.copy(this.a).addScaledVector(this.forward, 1.1), actor.state.yaw, 2.2, .1, time + .03, .3, key + 5);
    if (chain === 3) this.ring(this.b.copy(actor.group.position).addScaledVector(this.forward, 1.4).setY(actor.group.position.y + .05), time, 2.6);
  }

  /** Jirenga's Uprooting Fist, his heavy: his power gathers in the right fist as he sinks; the floor cracks under him as he
   *  drives up out of the crouch; and as the fist goes through them and he leaves the floor, the floor he drove off
   *  erupts - rock thrown up from under his feet along the line of the punch, as his card draws it (the streaks of
   *  light rising off the fist are `prideBlow`'s). (Thrown up from under the one he hit, the rock "rose with them,
   *  not the ground erupting under Jirenga": the blind critics.) */
  private uprootingFist(id: string, actor: Fighter, elapsed: number, key: number, time: number) {
    const move = MOVES.jirenga.heavy, contact = move.contacts[0], colour = COLOR.jirenga, vfx = VfxKit.for(this.scene);
    const gather = THREE.MathUtils.smoothstep(elapsed, .04, contact - .08) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .08));
    if (gather > .03) this.kit.ball(actor.handR, gather * .5, 71, NaN, colour.glow, colour.light, .38);
    const floor = actor.group.position.y;
    if (elapsed >= contact * .6 && this.drawn.get(`${id}:rise`) !== key) {
      this.drawn.set(`${id}:rise`, key);
      // Dark cracks, not a glow: lit red the decal read as a pool of blood (the blind critics), and the dust ring as
      // cotton balls.
      vfx.marks.mark(MARK.crack, actor.group.position.x, floor, actor.group.position.z, 0, 1, 0, 1.9, time, 2.2, 0x000000, 0);
    }
    if (elapsed >= contact && this.drawn.get(`${id}:erupt`) !== key) {
      this.drawn.set(`${id}:erupt`, key);
      // Out of the cracks round where he sprang, thrown up and outward and left behind him (thrown straight up in a
      // tight cone, the rock rose with him, "a sack strapped to his leg": the blind critics).
      this.side.set(this.forward.z, 0, -this.forward.x);
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + .4, x = Math.sin(angle), z = Math.cos(angle);
        this.a.copy(actor.group.position).addScaledVector(this.forward, .35 + z * .5).addScaledVector(this.side, x * .5);
        vfx.debris.burst(4, this.a.x, floor + .05, this.a.z, (this.forward.x * z + this.side.x * x) * .8, 1, (this.forward.z * z + this.side.z * x) * .8, 6.5, .4, .14, floor, 1.4);
      }
    }
  }

  private avalanche(id: string, actor: Fighter, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const move = MOVES.sekka.heavy, colour = COLOR.sekka, kit = this.kit, contacts = move.contacts, last = contacts.length - 1;
    const first = contacts[0], end = contacts[last];
    if (elapsed < first || elapsed > end + .1) return;
    this.a.copy(actor.group.position).addScaledVector(this.forward, 1.3).setY(actor.group.position.y + 1.15);
    const struck = actor.state.target ? fighters.get(actor.state.target) : undefined;
    if (struck && struck !== actor && struck.state.alive) {
      const dx = struck.group.position.x - actor.group.position.x, dz = struck.group.position.z - actor.group.position.z, d = Math.hypot(dx, dz);
      if (d > .3 && d < 3.5 && (dx * this.forward.x + dz * this.forward.z) / d > .5)
        this.a.copy(struck.group.position).addScaledVector(this.forward, -.3).setY(struck.group.position.y + 1.15);
    }
    this.side.set(this.forward.z, 0, -this.forward.x);
    const vfx = VfxKit.for(this.scene);
    // The fists the eye misses: one every sixteenth of a second from the first blow to the last.
    const beat = Math.floor((elapsed - first) / .0625), mark = key * 64 + beat;
    if (this.drawn.get(`${id}:flurry`) !== mark) {
      this.drawn.set(`${id}:flurry`, mark);
      const r = kit.painter.rng.seed(mark);
      this.b.copy(this.a).addScaledVector(this.side, r.signed() * .38).addScaledVector(this.up, r.signed() * .32);
      this.flash(this.b, .2, mark, .4, colour.glow, time);
      vfx.ring(this.b.x, this.b.y, this.b.z, .08, .42, time, .12, 0xffffff, 0xff9ad0, .1, 'plane', this.forward.x, 0, this.forward.z);
    }
    contacts.forEach((at, blow) => {
      const hit = key * 8 + blow;
      if (elapsed < at || elapsed > at + .1 || this.drawn.get(`${id}:avalanche`) === hit) return;
      this.drawn.set(`${id}:avalanche`, hit);
      const final = blow === last;
      // The last one's burst goes off past them, smaller, the fist and the one it hits in front of it: over them, at
      // 1.4 m, it "swallowed both Akagane and the fist" (the blind critics).
      const burst = final ? this.b.copy(this.a).addScaledVector(this.forward, .5) : this.a;
      // Gone as quickly as the one he hit: lasting, the last one's lines hung on at his fist after they had flown
      // metres away ("lightning stuck to his fist", the blind critics).
      this.crack(burst, this.forward, time, hit, final ? 1 : .55, final ? 9 : 5, colour.glow, final ? .3 : .22);
      // Ghosts of him close behind and to either side, faint and quick: the speed of it, more of him than one (a ghost a
      // body-length back "read as a second pink fighter", the blind critics).
      for (const hand of [-1, 1]) {
        this.c.copy(this.side).multiplyScalar(hand * .26).addScaledVector(this.forward, -.18);
        vfx.ghosts.spawn(actor, ghostTint('sekka'), time + (hand > 0 ? .03 : 0), .13, .3, this.c);
      }
      if (final) {
        this.flash(burst, .6, hit, .9, colour.glow, time);
        vfx.ring(burst.x, burst.y, burst.z, .2, 1.2, time, .3, 0xffffff, 0xff9ad0, .14, 'plane', this.forward.x, 0, this.forward.z);
        const floor = actor.group.position.y;
        vfx.debris.burst(7, this.a.x + this.forward.x * .3, floor + .05, this.a.z + this.forward.z * .3, this.forward.x, .9, this.forward.z, 6.5, .55, .12, floor, 1.5);
      }
    });
  }

  /** Emperor Jinlin's light, its string and the Whirlpool Tail, at the blow (`a`): the doom ray off his fingertip
   *  (and the finger driven in), the tail's gold cuts, and the ring round him where the tail went. */
  private emperorBlow(actor: Fighter, heavy: boolean, chain: number, key: number, time: number) {
    const colour = COLOR['jinlin'];
    if (heavy) {
      this.cut('jinlin', this.a.setY(actor.group.position.y + .7), actor.state.yaw, 4, .12, time, .32, key);
      this.ring(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), time, 2.8);
      this.flash(this.a, .8, key, 1.3, colour.glow, time);
      return;
    }
    if (chain === 0 || chain === 2) {
      const tip = this.b.copy(actor.handR).addScaledVector(this.forward, .12);
      this.beam(tip, this.c.copy(tip).addScaledVector(this.forward, chain ? 2.2 : 3.4), time, key, chain ? .035 : .045, RAY);
      this.flash(tip, .5, key, .8, RAY, time);
      return;
    }
    this.cut('jinlin', this.a, actor.state.yaw, 2.8, chain === 1 ? -.35 : .2, time, CUT_SECONDS, key);
  }

  /** Where a fighter aims: the body it has targeted, chest high, while it is in front of them and in reach;
   *  otherwise straight ahead. */
  private aimOf(actor: Fighter, fighters: ReadonlyMap<string, Fighter>, out: THREE.Vector3, reach: number) {
    const target = actor.state.target ? fighters.get(actor.state.target) : undefined;
    if (target?.state.alive) {
      out.copy(target.group.position).setY(target.group.position.y + 1.1);
      const dx = out.x - actor.group.position.x, dz = out.z - actor.group.position.z;
      if (Math.hypot(dx, dz) < reach && dx * this.forward.x + dz * this.forward.z > 0) return out;
    }
    return out.copy(actor.group.position).addScaledVector(this.forward, 14).setY(actor.group.position.y + 1.2);
  }

  /** The frost stance's snowflake opening on the floor round Sekka as he settles - six arms out from his feet, each
   *  branched twice - and the strike going out to its edge at `contact` (his stun, Blue Silver Chaotic Afterglow). */
  private compassNeedle(actor: Fighter, elapsed: number, contact: number, key: number, time: number, reach: number) {
    const kit = this.kit;
    const open = THREE.MathUtils.smoothstep(elapsed, .05, contact * .8) * (1 - THREE.MathUtils.smoothstep(elapsed, contact + .25, contact + .55));
    if (open > .02) {
      const radius = reach * open, y = actor.group.position.y + .04;
      for (let arm = 0; arm < 6; arm++) {
        const yaw = actor.state.yaw + arm * Math.PI / 3, dx = Math.sin(yaw), dz = Math.cos(yaw);
        this.a.copy(actor.group.position).setY(y);
        this.b.set(this.a.x + dx * radius, y, this.a.z + dz * radius);
        kit.arc(this.a, this.b, key + arm * 5, .03 * open, COMPASS, 1.1 * open, 0, 1, .02);
        for (const at of [.45, .72]) {
          this.c.set(this.a.x + dx * radius * at, y, this.a.z + dz * radius * at);
          for (const side of [-1, 1]) {
            const branch = yaw + side * .7;
            this.tip.set(this.c.x + Math.sin(branch) * radius * .22, y, this.c.z + Math.cos(branch) * radius * .22);
            kit.arc(this.c, this.tip, key + arm * 11 + (side > 0 ? 1 : 2) + Math.round(at * 10), .02 * open, COMPASS, .9 * open, 0, 1, .02);
          }
        }
      }
    }
  }

  /** 'Stinger Storm': a sweep of Imago's tail ringing out round him and cutting the air at his sides (his ground smash). */
  /** Ippon's Dust Allergy (moves.ts): no ki and no beam - he sneezes, and the air in front of him goes. A gust torn
   *  out along the line from his face in white, rings of it travelling on, and the dust off the floor thrown ahead. */
  private sneeze(id: string, actor: Fighter, elapsed: number, key: number, time: number) {
    const contact = MOVES.ippon.heavy.contacts[0];
    if (elapsed < contact || elapsed > contact + .1 || this.drawn.get(`${id}:sneeze`) === key) return;
    this.drawn.set(`${id}:sneeze`, key);
    const vfx = VfxKit.for(this.scene), floor = actor.group.position.y, face = this.eye(actor, this.a);
    for (let i = 0; i < 4; i++) {
      this.b.copy(face).addScaledVector(this.forward, 1.1 + i * 2.6).setY(face.y - i * .12);
      this.cut('wind', this.b, actor.state.yaw, 2.4 + i * 1.1, i % 2 ? .45 : -.45, time + i * .05, .4, key + i * 7);
    }
    for (let i = 0; i < 6; i++) {
      this.b.copy(face).addScaledVector(this.forward, .7 + i * 2.3).setY(face.y - i * .1);
      vfx.ring(this.b.x, this.b.y, this.b.z, .25 + i * .2, 1 + i * .45, time + i * .05, .3, 0xffffff, 0xdfe8ff, .1, 'plane', this.forward.x, 0, this.forward.z);
    }
    vfx.dustSpray(actor.group.position.x + this.forward.x * 1.6, floor, actor.group.position.z + this.forward.z * 1.6, this.forward.x, this.forward.z, 8, 5, .8, time, .55, .6);
  }

  private stingerStorm(actor: Fighter, mark: number, time: number, radius: number) {
    this.ring(this.a.copy(actor.group.position).setY(actor.group.position.y + .05), time, radius);
    for (let i = 0; i < 3; i++) {
      const yaw = actor.state.yaw + i * Math.PI * 2 / 3;
      this.b.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(1.6).add(actor.group.position).setY(actor.group.position.y + .5);
      this.cut('imago', this.b, yaw + Math.PI / 2, 3.2, .25, time + i * .03, .32, mark * 7 + i);
    }
    this.flash(this.a.setY(actor.group.position.y + .8), .9, mark, 1.6, COLOR.imago.glow, time);
  }

  /** A combo ender (game/combos.ts), at its blow, in its look (`EnderLook`): the blowback's shock, the launcher's column
   *  up, the knockdown's crater, the stun's ring round the head, the air strike's cut down, and the ground smash's ring
   *  out to its radius where the feet came down. Sekka's stun is the frost stance's snowflake, as his special was.
   *  The shop's twenty in their own glow and cut; the main game's sixteen in their ender's element, with its weight and
   *  what the element adds on top (`mainAccent`). */
  private ender(who: FighterId, look: EnderLook, id: string, actor: Fighter, ender: ComboKey, move: MoveDefinition, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const s = actor.state, contact = move.contacts[0];
    if (who === 'sekka' && ender === 'llls') { this.compassNeedle(actor, elapsed, contact, key, time, move.radius); }
    // The fighter's own element on the moves that are made of it (ENDER_ACCENTS): lightning brought down on the one it
    // stuns (Storm Bolt Hex's bolt, the Sovereign's black lightning), fire over the floor where it lands.
    const accent = (s.awakened ? AWAKENED_ACCENTS[who]?.[ender] : undefined) ?? ENDER_ACCENTS[who]?.[ender];
    if (accent && !(ender === 'airSpecial' && !s.grounded) && !(look.el && move.style === 'projectile')) {
      const target = s.target ? fighters.get(s.target) : undefined, point = this.tip;
      if (ender === 'airSpecial' || !target?.state.alive) point.copy(actor.group.position).addScaledVector(this.forward, ender === 'airSpecial' ? 0 : 1.4);
      else point.copy(target.group.position);
      if (accent === 'bolt' && elapsed >= contact - .06 && elapsed < contact + .22) for (let i = 0; i < 3; i++) {
        this.c.set(point.x + Math.sin(i * 2.1 + key) * .6, point.y + 4.5, point.z + Math.cos(i * 2.1 + key) * .6);
        this.b.copy(point).setY(point.y + 1.2);
        this.kit.arc(this.c, this.b, key * 5 + i + this.kit.tick, .03, look.glow, 1, 2, 3, .32);
      }
      if (accent !== 'bolt' && elapsed >= contact && elapsed < contact + .9) {
        const ignite = THREE.MathUtils.smoothstep(elapsed, contact, contact + .2), fade = 1 - THREE.MathUtils.smoothstep(elapsed, contact + .5, contact + .9);
        this.flameField(this.c.copy(point).setY(actor.group.position.y), ender === 'airSpecial' ? move.radius * .8 : 1.4, ignite, fade, time, FLAME_OF[accent], Math.round(70 * Math.min(1, this.kit.density)), FLAME_TALL[who]?.[ender] ?? 1.1);
      }
    }
    // (A main-game ground smash lands on the frame its feet do, however late the drawn clock has run on past the
    // contact; the shop's keeps the contact's window.)
    if (elapsed < contact || elapsed > contact + .12 && !(look.el && ender === 'airSpecial') || this.enderDrawn.get(id) === key) return;
    // The ground smash strikes as it lands (its clock is set on the landing): wait for the floor.
    if (ender === 'airSpecial' && !s.grounded) return;
    this.enderDrawn.set(id, key);
    // A main-game ender thrown at range is decorated where it lands (`mainEvent`): here it only leaves the hand.
    if (look.el && move.style === 'projectile') { this.enderMuzzle(look, actor, key, time); return; }
    const target = s.target ? fighters.get(s.target) : undefined, reach = Math.max(move.range, 2.2) + 1.2;
    const dx = target ? target.group.position.x - actor.group.position.x : 0, dz = target ? target.group.position.z - actor.group.position.z : 0;
    const onTarget = !!target?.state.alive && Math.hypot(dx, dz) < reach && dx * this.forward.x + dz * this.forward.z > 0;
    // Round 5 (GUARD): an ender that meets a raised guard is drawn on the guard's orb (vfx/GuardFx), not at the body -
    // the shock in the plane of the blow, the crack in the air and the flash there read as a flat shield of their own.
    // A slam's floor and a ground smash still take theirs; a guard breaker shatters the orb and lands.
    if (onTarget && (target!.state.guarding || target!.state.action === 'guard') && !move.guardBreak && ender !== 'lllh' && ender !== 'airSpecial') return;
    const at = onTarget
      ? this.a.copy(target!.group.position).setY(target!.group.position.y + 1.1) : this.a.copy(actor.group.position).addScaledVector(this.forward, 1.4).setY(actor.group.position.y + 1.1);
    // A main-game snare cast out at range lands where it was cast at (its cast's endpoint), whoever is there.
    const field = look.el && move.style === 'field' && ender !== 'airSpecial' ? this.enderAt.get(id) : undefined;
    if (field && Math.abs(field.since - s.actionStarted) < .3) at.set(field.at.x, actor.group.position.y + 1.1, field.at.z);
    this.decorate(who, look, ender, move, at, actor.group.position.y, key, time, actor);
  }
  /** The decorations themselves, at `at` over `floor` (`ender`, or a thrown ender's hit). */
  private decorate(who: FighterId, look: EnderLook, ender: ComboKey, move: MoveDefinition, at: THREE.Vector3, floor: number, key: number, time: number, actor: Fighter) {
    const s = actor.state;
    switch (ender) {
      case 'lh':
        this.a.setY(floor + 1.05);
        if (look.cracks) this.crack(this.a, this.forward, time, key, 1.8, 10, look.glow);
        this.flash(this.a, .9, key, 1.5, look.glow, time, look.soft);
        break;
      case 'llh':
        this.a.setY(floor + .9);
        if (look.cracks) this.crack(this.a, this.up, time, key, 2.2, 9, look.glow);
        this.flash(this.a, .9, key, 1.5, look.glow, time, look.soft);
        this.ring(this.b.copy(at).setY(floor + .05), time, 1.5, look.ring);
        break;
      case 'lllh':
        this.ring(this.b.copy(at).setY(floor + .05), time, 2.2, look.ring);
        if (look.cracks) this.crack(this.c.copy(at).setY(floor + .08), this.up, time, key, 2.4, 12, look.glow);
        this.flash(this.a.setY(floor + .6), 1, key, 1.7, look.glow, time, look.soft);
        VfxKit.for(this.scene).groundImpact(at.x, floor, at.z, 0, 1, 0, 2, time, undefined, floor);
        break;
      case 'llls':
        this.a.setY(floor + 1.5);
        this.flash(this.a, .8, key, 1.3, look.glow, time, look.soft);
        this.ring(this.b.copy(at).setY(floor + 1.75), time, .7, look.ring);
        break;
      case 'airHeavy':
        this.cutWith(look.cut, .18, this.a.setY(Math.max(floor + .8, this.a.y + .9)), s.yaw, 3, 1.45, time, .3, key);
        this.flash(this.a, .8, key, 1.4, look.glow, time, look.soft);
        break;
      case 'airSpecial': {
        if (who === 'imago' && !s.awakened) this.stingerStorm(actor, key, time, move.radius);
        const ground = this.b.copy(actor.group.position).setY(floor + .05);
        this.ring(ground, time, move.radius, look.ring);
        this.ring(this.c.copy(ground), time + .06, move.radius * .6, look.ring);
        if (look.cracks) this.crack(this.c.copy(ground).setY(floor + .1), this.up, time, key, move.radius * .7, 14, look.glow);
        this.flash(this.a.copy(ground).setY(floor + .8), 1.1, key, 2, look.glow, time, look.soft);
        VfxKit.for(this.scene).groundImpact(ground.x, floor, ground.z, 0, 1, 0, 3, time, undefined, floor);
        VfxKit.for(this.scene).pulse(ground.x, floor + 1.4, ground.z, look.glow.getHex(), 7, move.radius * 2, time, .3);
        break;
      }
    }
    if (look.el) this.mainAccent(look, ender, move, at, floor, key, time, actor);
  }

  // ---- the main game's sixteen ---------------------------------------------------------------
  /** A main-game fighter in a combo ender (COMBOS-DATA's rows): the shared decorations in its own look. */
  private mainEnder(id: string, actor: Fighter, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const s = actor.state, branch = s.branch && (s.action === 'heavy' || s.action === 'special') ? s.branch : undefined;
    if (!branch) return;
    const look = mainLook(s.fighter, branch, !!s.awakened), move = look?.move;
    if (!look || !move) return;
    this.facing(actor);
    this.ender(s.fighter, look, id, actor, branch, move, s.actionTime * s.actionDuration, Math.round(s.actionStarted * 1000), time, fighters);
  }
  /** A main-game ender thrown at range leaving the hand: a burst of its element there (its flight is CombatEffects',
   *  its hit `mainEvent`'s). */
  private enderMuzzle(look: EnderLook, actor: Fighter, key: number, time: number) {
    const v = this.vfx ??= VfxKit.for(this.scene), el = look.el!, hand = this.m1.copy(actor.handR).addScaledVector(this.forward, .25);
    this.flash(hand, .55, key, .9, look.glow, time, true);
    v.ring(hand.x, hand.y, hand.z, .1, .9, time, .2, 0xffffff, el.rim, .1, 'plane', this.forward.x, 0, this.forward.z);
    v.streaks(hand.x, hand.y, hand.z, el, v.n(6, 3), 10, .02, time, this.forward, 1.4, 2);
  }
  /** What a main-game ender's events say: where a field ender was cast at (it lands there), whom a stun dazed, and where
   *  a thrown one landed - decorated there, once a throw, as a blow is where it lands. */
  private mainEvent(event: CombatEvent, fighter: FighterId, fighters: ReadonlyMap<string, Fighter>) {
    if (event.kind === 'hit' && event.endpoint && event.branch) {
      const actor = fighters.get(event.actorId), awakened = !!actor?.state.awakened, found = mainLook(fighter, event.branch, awakened), move = found?.move;
      const look = move?.style === 'projectile' ? found : undefined;
      const throwKey = event.actionSeq ?? Math.round(event.serverTime * 4);
      if (actor && move && look && this.enderHit.get(event.actorId) !== throwKey) {
        this.enderHit.set(event.actorId, throwKey);
        const victim = event.targetId ? fighters.get(event.targetId) : undefined;
        if (event.origin) { this.forward.set(event.endpoint.x - event.origin.x, 0, event.endpoint.z - event.origin.z); if (this.forward.lengthSq() < 1e-6) this.facing(actor); else this.forward.normalize(); }
        else this.facing(actor);
        const at = victim ? this.a.copy(victim.group.position).setY(victim.group.position.y + 1.1) : this.a.set(event.endpoint.x, event.endpoint.y, event.endpoint.z);
        this.decorate(fighter, look, event.branch, move, at, victim ? victim.group.position.y : event.endpoint.y - 1.05, throwKey, event.serverTime, actor);
      }
    }
    if (event.kind === 'cast' && event.endpoint) {
      const held = this.enderAt.get(event.actorId) ?? {at: new THREE.Vector3(), since: 0};
      held.at.set(event.endpoint.x, event.endpoint.y, event.endpoint.z); held.since = event.serverTime; this.enderAt.set(event.actorId, held);
    }
    if (event.kind === 'hit' && event.outcome === 'dizzy' && event.targetId) {
      const look = mainLook(fighter, event.branch!, !!fighters.get(event.actorId)?.state.awakened);
      if (!look) return;
      const daze = this.dazes.find(d => !d.active) ?? this.dazes.reduce((x, y) => x.since <= y.since ? x : y);
      daze.targetId = event.targetId; daze.since = event.serverTime; daze.active = true; daze.glow = look.glow; daze.electric = look.flavour === 'bolt' || look.flavour === 'darkSpark'; daze.seed = event.id % 97;
    }
  }
  /** The weight of a main-game ender, over the shared decorations, in its element: the blowback's shock in the plane of
   *  the blow, the launcher's column of rings climbing out of the floor under them, the knockdown's crater, the stun's
   *  burst at the head (the daze rides the hit: `dazes`), the spike's blow down, and the ground smash's crater, ring
   *  out to its radius, rubble and dust lit in the element - then what the element itself adds (`flavour`). Sprites of
   *  the shared kit and this layer's pools; nothing allocated. */
  private mainAccent(look: EnderLook, ender: ComboKey, move: MoveDefinition, at: THREE.Vector3, floor: number, key: number, time: number, actor: Fighter) {
    const v = this.vfx ??= VfxKit.for(this.scene), el = look.el!, f = this.forward, sp = v.sparks.spec, p = this.m1.copy(at);
    switch (ender) {
      case 'lh':
        v.ring(p.x, p.y, p.z, .2, 2.8, time, .32, 0xffffff, el.rim, .12, 'plane', f.x, 0, f.z);
        v.ring(p.x, p.y, p.z, .3, 1.5, time + .04, .24, el.spike, el.rim, .1);
        v.streaks(p.x, p.y, p.z, el, v.n(14, 5), 15, .03, time, f, 1.6, 2);
        this.flavour(look, 0, p, floor, 1, key, time);
        break;
      case 'llh':
        for (let i = 0; i < 4; i++) v.ring(p.x, floor + .2 + i * .55, p.z, .3, 1.1 + i * .22, time + i * .04, .3, 0xffffff, el.rim, .1, 'flat');
        v.streaks(p.x, floor + .3, p.z, el, v.n(16, 6), 13, .028, time, UP, 1.8, -3);
        sp.reset(SPRITE.glow, time, .3).pos(p.x, floor + 1.6, p.z).sized(DREAM_IMPACT ? .14 : .32, DREAM_IMPACT ? .2 : .45, .3).hot(el.rim, DREAM_IMPACT ? .8 : 1.3); sp.orient = ORIENT.axial; sp.axis(0, 1, 0); sp.stretch = 6; v.sparks.emit();
        this.flavour(look, 1, p, floor, 1, key, time);
        break;
      case 'lllh':
        // (The shared decoration has broken the floor already: the crack glows in the element, and a little more of it
        // comes up.)
        if (v.quality !== 'low') v.marks.mark(MARK.crack, p.x, floor, p.z, 0, 1, 0, 2.6, time, 2.6, el.light, .6);
        v.debris.burst(v.n(5, 2), p.x, floor, p.z, 0, 1, 0, 7, .9, .12, floor, 2);
        v.ring(p.x, floor + .06, p.z, .5, 3.6, time, .42, 0xffffff, el.rim, .18, 'flat');
        v.streaks(p.x, p.y + .4, p.z, el, v.n(10, 4), 11, .026, time, DOWN, 1.3, 9);
        this.flavour(look, 2, p, floor, 1.6, key, time);
        break;
      case 'llls': {
        // Infinity stills everything round Kuon himself; Iron Spirit's inhale draws the target in to KoKo.
        if (look.flavour === 'inhale') this.inhale(el, p, actor, floor, time);
        const h = look.flavour === 'infinity' ? this.m2.copy(actor.group.position).setY(floor + 1.2) : this.m2.copy(p).setY(floor + 1.65);
        sp.reset(SPRITE.star, time, .24).pos(h.x, h.y, h.z).sized(.4, 1.3, .25).hot(0xffffff, 1.4).cool(el.rim, .4); sp.rotation = key % 6; v.sparks.emit();
        v.ring(h.x, h.y + .15, h.z, .25, 1.1, time, .36, el.spike, el.rim, .12, 'flat');
        this.flavour(look, 3, h, floor, .8, key, time);
        break;
      }
      case 'airHeavy':
        v.streaks(p.x, p.y, p.z, el, v.n(12, 5), 14, .03, time, DOWN, 1.6, 12);
        v.ring(p.x, p.y, p.z, .2, 2.2, time, .26, 0xffffff, el.rim, .1, 'flat');
        this.flavour(look, 0, p, floor, 1, key, time);
        break;
      case 'airSpecial': {
        const R = move.radius, g = this.m2.copy(actor.group.position);
        // (The shared decoration has cratered the floor and thrown its rubble: the crater glows in the element, its ring
        // runs out to the smash's radius, and the dust off it is lit by it.)
        if (v.quality !== 'low') v.marks.mark(MARK.crack, g.x, floor, g.z, 0, 1, 0, Math.min(4.5, R * 1.1), time, 3, el.light, .7);
        v.ring(g.x, floor + .07, g.z, .6, R / .86, time, .55, 0xffffff, el.rim, .2, 'flat');
        v.ring(g.x, floor + 1, g.z, .4, R * .9, time + .03, .3, el.spike, el.rim, .08);
        if (look.flavour !== 'steel' && look.flavour !== 'slash') v.scorch(g.x, floor, g.z, 0, 1, 0, R * .85, time, el.light);
        const lit = this.dust.setHex(DUST_LIT).lerp(this.dust2.setHex(el.light), .45).getHex();
        for (let i = 0, n = v.n(8, 4); i < n; i++) {
          const a = i / n * Math.PI * 2 + key, c = Math.cos(a), sn = Math.sin(a);
          v.smoke(g.x + c * R * .55, floor + .3, g.z + sn * R * .55, c * 3.6, .5, sn * 3.6, .75, time + (i % 3) * .02, .5, lit, DUST_SHADE);
        }
        v.streaks(g.x, floor + .3, g.z, el, v.n(16, 6), 13, .03, time, UP, 1.3, 6);
        v.pulse(g.x, floor + 1.4, g.z, el.light, 12, R * 2.4, time, .4, 2);
        this.flavour(look, 2, g, floor, R, key, time);
        if (involvesLocal(actor.state.id, actor.state.target ?? undefined)) SIGNATURE.screen?.chromaticPulse?.(.6);
        break;
      }
    }
  }
  /** What a main-game ender's element adds where it lands (`shape`: 0 a blow, 1 a launch, 2 the floor, 3 the head a stun
   *  rings; `size` scales it, the ground smash's radius on the floor). */
  private flavour(look: EnderLook, shape: 0 | 1 | 2 | 3, p: THREE.Vector3, floor: number, size: number, key: number, time: number) {
    const v = this.vfx!, el = look.el!, f = this.forward, sp = v.sparks.spec, low = shape === 2 ? floor + .45 : p.y;
    switch (look.flavour) {
      case 'chi':
        // Konta's: the clones that threw it pop in small puffs of smoke beside it (on the floor round a smash; never
        // over the head a stun rings), and the chi swirls out - up through a launch.
        if (shape === 0 || shape === 2) for (let i = 0; i < 3; i++) {
          const a = i * 2.094 + key * .7, c = Math.cos(a), sn = Math.sin(a), r = shape === 2 ? .4 * Math.min(size, 3) + .5 : .75;
          v.smoke(p.x + c * r, shape === 2 ? floor + .25 : p.y - .5 + (i % 2) * .3, p.z + sn * r, c * 1.4, .7, sn * 1.4, .5, time + .05 + i * .03, .4, 0xffffff, 0xc4d0e4);
        }
        for (let i = 0; i < 3; i++) {
          if (shape === 2) v.ring(p.x, floor + .1 + i * .3, p.z, .2, (1 + i * .5) * Math.min(size, 3), time + i * .05, .32, 0xffffff, el.rim, .1, 'flat');
          else if (shape === 1) v.ring(p.x, floor + .6 + i * .6, p.z, .2, .9 - i * .15, time + .05 + i * .05, .3, 0xffffff, el.rim, .1, 'flat');
          else v.ring(p.x + f.x * i * .3, p.y, p.z + f.z * i * .3, .15, .8 + i * .35, time + i * .04, .24, 0xffffff, el.rim, .1, 'plane', f.x, 0, f.z);
        }
        break;
      case 'ki':
        // Taisei's and Ouga's: a sphere of ki bursting, white at the heart. (The dream loop: the hit's own heart and burst
        // are the blow now - the white sphere over the victim's chest hid them through a launch; a smaller flare stays.)
        if (!DREAM_IMPACT) { sp.reset(SPRITE.core, time, .12).pos(p.x, low, p.z).sized(.35, .9 * Math.min(size, 2), .3).hot(0xffffff, 2.2).cool(el.rim); v.sparks.emit(); }
        sp.reset(SPRITE.flare, time, .2).pos(p.x, low, p.z).sized(.7 * (DREAM_IMPACT ? .5 : 1), 1.8 * Math.min(size, 2) * (DREAM_IMPACT ? .5 : 1), .2).hot(el.spike, DREAM_IMPACT ? .9 : 1.2).cool(el.rim); sp.rotation = key; v.sparks.emit();
        v.ring(p.x, low, p.z, .3, 2.2 * Math.min(size, 2), time, .3, el.spike, el.rim, .08);
        break;
      case 'will':
        // Gummy's: will's black lightning edged in red, out from the blow - over the floor on a smash - and dark smoke.
        if (shape !== 1) this.strike(this.m3.copy(p).setY(shape === 2 ? floor + .05 : p.y), '', time, key, 'floor', WILL_RED);
        for (let i = 0; i < 3; i++) v.smoke(p.x + (i - 1) * .3 * f.z, low, p.z - (i - 1) * .3 * f.x, f.x * 2 + (i - 1) * .4, .6, f.z * 2, .55, time + i * .02, .38, 0x3a0c10, 0x0c0204);
        break;
      case 'slash':
        // Kenzo's: three swords, three cuts - two more across the first.
        for (let i = 0; i < 2; i++) this.cutWith(look.cut, .18, this.m3.copy(p).setY((shape === 2 ? floor + .9 : p.y) + (i ? -.18 : .18)), this.facingYaw() + (i ? .5 : -.5), shape === 2 ? 3.6 : 2.8, i ? -.9 : .9, time + .03 * (i + 1), .26, key + 11 * (i + 1));
        break;
      case 'fire':
        // Kosho's and Kagari's: fire thrown out of the blow, and up off the floor.
        for (let i = 0, n = v.n(7, 3); i < n; i++) {
          const a = i / n * Math.PI * 2 + key, c = Math.cos(a), sn = Math.sin(a), r = shape === 2 ? Math.min(size, 3.5) * .45 : .25;
          v.smoke(p.x + c * r, low, p.z + sn * r, c * (shape === 2 ? 2.6 : 1.4) + (shape === 0 ? f.x * 2 : 0), shape === 1 ? 4.5 : 1.6, sn * (shape === 2 ? 2.6 : 1.4) + (shape === 0 ? f.z * 2 : 0), shape === 2 ? .75 : .5, time + i * .015, .42, 0xffb347, 0xd9481e);
        }
        break;
      case 'room':
        // Ward's: ROOM's edge rung out on the floor round it.
        v.ring(p.x, floor + .05, p.z, .5, shape === 2 ? size / .86 : 2.6, time, .5, 0xffffff, el.rim, .14, 'flat');
        v.ring(p.x, floor + .05, p.z, .4, shape === 2 ? size * .7 : 1.8, time + .08, .4, el.spike, el.rim, .1, 'flat');
        break;
      case 'cursed':
        // Kuon's: Red throws everything out of the blow, Blue pulls it in, Purple does both.
        sp.reset(SPRITE.core, time, .12).pos(p.x, low, p.z).sized(.35, .9, .3).hot(0xffffff, 2.2).cool(el.rim); v.sparks.emit();
        if (el.rim !== 0x2ec4ff) v.streaks(p.x, low, p.z, el, v.n(14, 5), 13, .03, time, undefined, .5, 1);
        if (el.rim !== 0xff2a1e) for (let i = 0, n = v.n(10, 4); i < n; i++) {
          const a = i * 2.399 + key, c = Math.cos(a), sn = Math.sin(a), r = 1.6, up = (i % 3 - 1) * .5;
          sp.reset(SPRITE.streak, time, .22).pos(p.x + c * r, low + up, p.z + sn * r).velocity(-c * r / .22, -up / .22, -sn * r / .22); sp.orient = ORIENT.velocity;
          sp.sized(.03, .012, .8); sp.stretch = 2.2; sp.trail = .05; sp.hot(el.spike, 1.4).cool(el.rim, 0); v.sparks.emit();
        }
        v.ring(p.x, low, p.z, .25, 2 * Math.min(size, 2), time, .3, 0xffffff, el.rim, .08);
        break;
      case 'spirit': case 'flurry':
        // Iron Spirit's and HUSH's fists - and Waterspout's, and Mirepoix' kicks: more blows than the eye can
        // follow, all landing round the one that lands.
        for (let i = 0, n = v.n(7, 3); i < n; i++) {
          const r = this.kit.painter.rng.seed(key * 13 + i);
          v.hitSpark(p.x + r.signed() * .55, (shape === 2 ? floor + .3 : p.y) + r.signed() * .5, p.z + r.signed() * .55, el, 0, time + i * .028, f, 1);
        }
        break;
      case 'pressure':
        // Nigo's: a black crescent edged in crimson, and the pressure's dark smoke off it.
        this.cutWith(look.cut, .22, this.m3.copy(p).setY(shape === 2 ? floor + .9 : p.y), this.facingYaw(), shape === 2 ? 4 : 3, shape === 1 ? -1.3 : .4, time, .3, key + 5);
        for (let i = 0; i < 3; i++) v.smoke(p.x - f.x * .3 * i, low, p.z - f.z * .3 * i, f.x * 2, .5, f.z * 2, .65, time + i * .03, .42, 0x3a0b12, 0x120306);
        break;
      case 'steel':
        // Gaunt': steel - white-hot sparks off the blade - and blood.
        v.streaks(p.x, low, p.z, STEEL_SPARK, v.n(12, 5), 12, .022, time, f, 1.2, 8);
        v.streaks(p.x, low, p.z, BLOOD_SPRAY, v.n(10, 4), 6, .04, time, f, 1, 10);
        if (shape === 2) v.debris.burst(v.n(10, 4), p.x, floor, p.z, 0, 1, 0, 7, .9, .2, floor, 2.4);
        break;
      case 'bolt':
        // Shirokane's, Setsu's and Shiden's: lightning crackling off the blow - out over the floor on a smash.
        v.crackle(this.m3.copy(p).setY(low - .6), this.m4.copy(p).setY(low + .6), .3, el, v.n(10, 4), time);
        if (shape === 2) this.strike(this.m3.copy(p).setY(floor + .05), '', time, key, 'floor', look.glow);
        break;
      case 'flash':
        // The Blackout Flash: a blinding white flash where it goes off.
        sp.reset(SPRITE.flare, time, .34).pos(p.x, low, p.z).sized(1.2, 3.4, .2).hot(0xffffff, 2.2).cool(el.rim); sp.rotation = key; v.sparks.emit();
        sp.reset(SPRITE.core, time, .2).pos(p.x, low, p.z).sized(.8, 1.9, .3).hot(0xffffff, 2.6).cool(el.spike); v.sparks.emit();
        v.ring(p.x, low, p.z, .4, 3.2, time, .32, 0xffffff, el.rim, .06);
        v.pulse(p.x, low + .5, p.z, el.light, 22, 10, time, .35, 2);
        break;
      case 'explosion': {
        // Coronation, the bomb, the cannon: it goes off - fire, then smoke rolling up off it.
        const k = shape === 2 ? Math.min(size, 4) / 2.5 : 1;
        sp.reset(SPRITE.core, time, .14).pos(p.x, low, p.z).sized(.5, 1.4 * k, .3).hot(0xffffff, 2.4).cool(0xffb347); v.sparks.emit();
        sp.reset(SPRITE.burst, time, .3).pos(p.x, low, p.z).sized(.6, 2.2 * k, .2).hot(0xfff1b0, 1.2).cool(0xff4a1e, .9); sp.rotation = key; v.sparks.emit();
        for (let i = 0, n = v.n(8, 3); i < n; i++) {
          const a = i / n * Math.PI * 2 + key, c = Math.cos(a), sn = Math.sin(a);
          v.smoke(p.x + c * .3 * k, low, p.z + sn * .3 * k, c * 2.4 * k, 1.4, sn * 2.4 * k, .6 * k, time + i * .01, .32, 0xffb347, 0xd9481e);
          v.smoke(p.x + c * .5 * k, low + .3, p.z + sn * .5 * k, c * .9, 1.6, sn * .9, .7 * k, time + .12 + i * .02, .6, 0x6a5c52, 0x2a221e);
        }
        v.streaks(p.x, low, p.z, el, v.n(14, 5), 14, .03, time, undefined, .5, 6);
        v.pulse(p.x, low + .5, p.z, 0xff8a3a, 16, 9, time, .35, 2);
        break;
      }
      case 'water':
        // The Water Dragon crashing on them: spray thrown on along it, falling back as rain.
        for (let i = 0, n = v.n(8, 3); i < n; i++) {
          const a = i / n * Math.PI * 2 + key, c = Math.cos(a), sn = Math.sin(a);
          v.smoke(p.x + c * .3, low, p.z + sn * .3, c * 2.2 + f.x * 2.4, 1.4, sn * 2.2 + f.z * 2.4, .55, time + i * .012, .45, 0xeaf8ff, 0x5aa8e8);
        }
        v.streaks(p.x, low, p.z, el, v.n(16, 6), 9, .025, time, f, .9, 14);
        v.ring(p.x, low, p.z, .3, 2.2, time, .3, 0xffffff, el.rim, .1);
        break;
      case 'earth':
        // The Headhunter and the hounds: up out of the ground under them.
        v.debris.burst(v.n(9, 4), p.x, floor, p.z, 0, 1, 0, 6, .9, .13, floor, 2.2);
        v.dustRing(p.x, floor, p.z, 9, .4, 3.4, .8, time);
        for (let i = 0; i < 4; i++) v.smoke(p.x + Math.cos(i * 1.57 + key) * .4, floor + .3, p.z + Math.sin(i * 1.57 + key) * .4, 0, 2.4, 0, .55, time + i * .03, .5, 0xe8d8b8, 0x9a8468);
        if (v.quality !== 'low') v.marks.mark(MARK.crack, p.x, floor, p.z, 0, 1, 0, 2, time, 2.6, el.light, .3);
        break;
      case 'darkSpark':
        // Dark Spark: black lightning edged in crimson out of the point of impact, the air distorted round it.
        this.strike(this.m3.copy(p).setY(low), '', time, key, 'floor', WILL_RED);
        sp.reset(SPRITE.core, time, .1).pos(p.x, low, p.z).sized(.3, .8, .3).hot(0xffffff, 2).cool(el.rim); v.sparks.emit();
        v.ring(p.x, low, p.z, .2, 2.4, time, .26, 0xff6a5a, el.rim, .08, 'plane', f.x, 0, f.z);
        break;
      case 'infinity':
        // Event Horizon: still rings standing out round him, slow.
        for (let i = 0; i < 4; i++) v.ring(p.x, floor + .1 + i * .45, p.z, .3, 2.4 + i * .3, time + i * .06, .75, 0xffffff, el.rim, .08, 'flat');
        v.ring(p.x, low, p.z, .5, 2.8, time, .8, el.spike, el.rim, .05);
        break;
      case 'frost':
        // The freezing touch: frost mist off the body, and ice breaking away.
        for (let i = 0, n = v.n(6, 3); i < n; i++) { const a = i * 1.05 + key, c = Math.cos(a), sn = Math.sin(a); v.smoke(p.x + c * .25, low + (i % 3 - 1) * .3, p.z + sn * .25, c * .8, .3, sn * .8, .5, time + i * .02, .6, 0xf6fdff, 0x9ad8f0); }
        for (let i = 0, n = v.n(10, 4); i < n; i++) {
          const r = this.kit.painter.rng.seed(key * 17 + i);
          sp.reset(SPRITE.shard, time, .5 + r.next() * .2).pos(p.x, low, p.z).velocity(r.signed() * 3, 1.5 + r.next() * 2, r.signed() * 3);
          sp.sized(.06 + r.next() * .05, .05, .5).hot(0xffffff, 1.2).cool(el.rim, .3); sp.gravity = 7; sp.spin = r.signed() * 14; sp.rotation = r.next() * 6.28; v.sparks.emit();
        }
        break;
      case 'claw':
        // The Silent Claw: three marks where one hand went.
        for (let i = 0; i < 3; i++) this.cutWith(look.cut, .1, this.m3.copy(p).setY(p.y + (i - 1) * .2), this.facingYaw(), 2.4, .9, time + i * .02, .24, key + i * 13);
        break;
      case 'fireflies':
        // Tourou: Hinoko's fireflies all flying in on them at once, and going up as they land.
        for (let i = 0, n = v.n(14, 5); i < n; i++) {
          const a = i * 2.399 + key, c = Math.cos(a), sn = Math.sin(a), r = 2.2, up = (i % 3 - 1) * .6;
          sp.reset(SPRITE.glow, time, .3).pos(p.x + c * r, low + up, p.z + sn * r).velocity(-c * r / .28, -up / .28, -sn * r / .28).sized(.05, .09, .5).hot(0xffd070, 1.6); v.sparks.emit();
        }
        sp.reset(SPRITE.core, time + .28, .16).pos(p.x, low, p.z).sized(.4, 1.1, .3).hot(0xffffff, 2.2).cool(0xff7a2a); v.sparks.emit();
        for (let i = 0; i < 5; i++) v.smoke(p.x, low, p.z, Math.cos(i * 1.26) * 1.6, 1.4, Math.sin(i * 1.26) * 1.6, .5, time + .28 + i * .01, .4, 0xffb347, 0xd9481e);
        break;
      case 'knives':
        // Checkmate: the knives thrown in stopped time closing in on where he lands from every side.
        for (let i = 0, n = v.n(14, 6); i < n; i++) {
          const a = i / n * Math.PI * 2 + key, c = Math.cos(a), sn = Math.sin(a), r0 = Math.min(size, 4) + 2.2, y = floor + .6 + (i % 3) * .4;
          sp.reset(SPRITE.streak, time + (i % 4) * .03, .22).pos(p.x + c * r0, y, p.z + sn * r0).velocity(-c * (r0 - .6) / .2, -.4, -sn * (r0 - .6) / .2);
          sp.orient = ORIENT.velocity; sp.sized(.035, .02, .6); sp.stretch = 5; sp.trail = .06; sp.hot(0xffffff, 1.6).cool(0xc8d4e0, .2); v.sparks.emit();
        }
        break;
      case 'spark':
        // Steel on them: white-hot sparks off it.
        v.streaks(p.x, low, p.z, STEEL_SPARK, v.n(12, 5), 12, .022, time, f, 1.2, 8);
        break;
    }
  }
  /** Iron Spirit's inhale: the air, and the one in it, drawn in to KoKo from where they stand. */
  private inhale(el: Element, from: THREE.Vector3, actor: Fighter, floor: number, time: number) {
    const v = this.vfx!, sp = v.sparks.spec, to = this.m4.copy(actor.group.position).setY(floor + 1.5);
    for (let i = 0, n = v.n(16, 6); i < n; i++) {
      const a = i * 2.399, r = .9, ox = Math.cos(a) * r, oy = Math.sin(a) * r * .7, oz = Math.sin(a * 1.7) * r;
      const x = from.x + ox, y = from.y + oy, z = from.z + oz, life = .26 + (i % 3) * .05;
      sp.reset(SPRITE.streak, time + (i % 5) * .03, life).pos(x, y, z).velocity((to.x - x) / life, (to.y - y) / life, (to.z - z) / life);
      sp.orient = ORIENT.velocity; sp.sized(.03, .012, .7); sp.stretch = 3; sp.trail = .08; sp.hot(0xffffff, 1.2).cool(el.rim, .1); v.sparks.emit();
    }
  }
  /** The facing's yaw, from `forward`. */
  private facingYaw() { return Math.atan2(this.forward.x, this.forward.z); }

  private special(who: Emperor, id: string, actor: Fighter, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const kit = this.kit, colour = COLOR[who], contact = MOVES[who].special.contacts[0];
    // (Tobari's Black Pyre is the Armory's black flames when his casting draws it: render/vfx/armory/drawn.ts.)
    if (who === 'tobari') { if (!armoryDraws('tobari', 'special', undefined, id)) this.blackPyre(id, actor, elapsed, key, time, fighters); return; }
    if (who === 'akagane') { this.majesticFlame(id, actor, elapsed, key, time, fighters); return; }
    if (who === 'rook') { this.rooksGrip(id, actor, elapsed, key, time, fighters); return; }
    if (who === 'asahi') {
      // The Ashfall Waltz: at every cut the water ribbon turns round him, three cuts at his sides.
      MOVES.asahi.special.contacts.forEach((at, step) => {
        const mark = key * 3 + step;
        if (elapsed < at || elapsed > at + .15 || this.drawn.get(`${id}:dance`) === mark) return;
        this.drawn.set(`${id}:dance`, mark);
        for (let i = 0; i < 3; i++) {
          const yaw = actor.state.yaw + step * .9 + i * Math.PI * 2 / 3;
          this.b.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(1.3).add(actor.group.position).setY(actor.group.position.y + .7 + step * .25);
          this.cut('asahi', this.b, yaw + Math.PI / 2, 2.8, step % 2 ? -.3 : .3, time + i * .03, .34, mark * 7 + i);
        }
        this.flash(this.a.copy(actor.group.position).setY(actor.group.position.y + .9), .7, mark, 1.3, WATER_RIM, time);
      });
      return;
    }
    if (who === 'levin') {
      // The Grapple Rig: the lines fire out ahead and up as he crouches, and draw him through them.
      const line = THREE.MathUtils.smoothstep(elapsed, .1, contact * .6) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .15));
      if (line > .03) {
        this.side.set(this.forward.z, 0, -this.forward.x);
        for (const sideSign of [-1, 1]) {
          this.b.copy(actor.group.position).addScaledVector(this.side, sideSign * .25).setY(actor.group.position.y + .95);
          this.c.copy(actor.group.position).addScaledVector(this.forward, 7 * line).addScaledVector(this.side, sideSign * 1.6).setY(actor.group.position.y + 3.4);
          kit.arc(this.b, this.c, key + (sideSign > 0 ? 3 : 4), .012, colour.light, line, 0, 1, .02);
        }
      }
      if (elapsed >= contact && this.drawn.get(id) !== key) {
        this.drawn.set(id, key);
        // The cut left where he went through them, two blades, and a second after.
        this.a.copy(actor.group.position).addScaledVector(this.forward, -1.4).setY(actor.group.position.y + 1.05);
        this.cut('levin', this.a, actor.state.yaw, 4.4, .15, time, .4, key);
        this.cut('levin', this.b.copy(this.a).setY(this.a.y - .25), actor.state.yaw, 3.6, -.55, time + .04, .36, key + 7);
        this.flash(this.a, 1, key, 1.5, colour.glow, time);
      }
      return;
    }
    if (who === 'imago') {
      // Hive Burst: the jade aura gathered in his hand, and blown out of it (the blast itself is CombatEffects').
      this.a.copy(actor.handR).addScaledVector(this.forward, .25);
      if (elapsed < contact) this.flash(this.a, .35 * THREE.MathUtils.smoothstep(elapsed, 0, contact), key + 1, .8, colour.glow, time);
      else if (this.drawn.get(id) !== key) { this.drawn.set(id, key); this.flash(this.a, 1, key, 1.6, colour.glow, time); }
      return;
    }
    if (who === 'sekka') {
      // Shatter Art: Frost Gale - a straight thrown at the empty air, and the air carries it on: the shock breaks
      // ahead of his fist as it goes (the shot itself is CombatEffects'). The frost stance's snowflake is his stun's
      // now (`ender`, Last Art: Aurora Shards).
      if (elapsed >= contact && this.drawn.get(id) !== key) {
        this.drawn.set(id, key);
        this.a.copy(actor.group.position).addScaledVector(this.forward, 1.2).setY(actor.group.position.y + 1.25);
        this.crack(this.a, this.forward, time, key, 1.7, 10, COLOR.sekka.glow);
        this.flash(this.a, .85, key, 1.4, COLOR.sekka.glow, time);
      }
      return;
    }
    if (who === 'ippon') {
      // Double Shift: at every blow, more fists than the eye can follow land all over the front of them.
      MOVES.ippon.special.contacts.forEach((at, blow) => {
        const mark = key * 9 + blow;
        if (elapsed < at || elapsed > at + .1 || this.drawn.get(`${id}:flurry`) === mark) return;
        this.drawn.set(`${id}:flurry`, mark);
        const r = kit.painter.rng.seed(mark);
        this.side.set(this.forward.z, 0, -this.forward.x);
        for (let i = 0; i < 3; i++) {
          this.a.copy(actor.group.position).addScaledVector(this.forward, 1.2 + r.next() * .4).addScaledVector(this.side, r.signed() * .45)
            .setY(actor.group.position.y + .9 + r.next() * .55);
          this.flash(this.a, .45, mark + i, .7, colour.glow, time + i * .03);
        }
        this.crack(this.a, this.forward, time, mark, blow === MOVES.ippon.special.contacts.length - 1 ? 2 : .9, 6, colour.glow);
      });
      return;
    }
    if (who === 'haldor') {
      // Faultline Fist: the bubble gathers on the fist, and the air cracks ahead of it.
      const gather = THREE.MathUtils.smoothstep(elapsed, .15, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact + .05, contact + .3));
      if (gather > .02) kit.ball(actor.handL, gather * 1.1, 13, NaN, colour.glow, colour.light, .42);
    }
    if (who === 'shiun') {
      // GLASS LANCES: light gathers between the wings at his back - and behind base Shiun, who has none, in a fan of
      // points of light as his sword goes up to the sky (3 October).
      const gather = THREE.MathUtils.smoothstep(elapsed, .15, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .1));
      if (gather > .02) {
        if (actor.state.awakened) kit.ball(this.back(actor, this.b), gather * 1.1, 31, NaN, colour.glow, colour.light, .44);
        else for (let i = 0; i < HALO; i++) kit.ball(this.halo(actor, i, this.b), gather * .3 * THREE.MathUtils.smoothstep(gather, i / HALO * .6, i / HALO * .6 + .4), 31 + i, NaN, colour.glow, colour.light, .4);
      }
    }
    if (who === 'wuming') {
      // The Lightless Cannon: the ki gathers in the hand drawn back to his hip, and goes out with the beam.
      const gather = THREE.MathUtils.smoothstep(elapsed, .15, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .12));
      if (gather > .02) kit.ball(actor.handR, gather * 1.1, 59, NaN, colour.glow, colour.light, .5);
    }
    if (who === 'jirenga') {
      // Vermilion Seal: his ki gathers in the palm drawn back to his shoulder, and goes with the thrust.
      const gather = THREE.MathUtils.smoothstep(elapsed, .2, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .1));
      if (gather > .02) kit.ball(actor.handR, gather * 1.2, 67, NaN, colour.glow, colour.light, .5);
    }
    if (who === 'jinlin') {
      // The barrage: ki at his fingertips as the hands come down to aim, and on them while they fire.
      const gather = THREE.MathUtils.smoothstep(elapsed, .25, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact + .4, contact + .55));
      if (gather > .02) {
        kit.ball(actor.handR, gather * .45, 73, NaN, RAY, RAY_LIGHT, .3);
        kit.ball(actor.handL, gather * .45, 79, NaN, RAY, RAY_LIGHT, .3);
      }
    }
    if (who === 'gohaku') {
      // The Star-Shifting Beam: the ki gathers between the hands raised over his brow, and goes out with the beam.
      const gather = THREE.MathUtils.smoothstep(elapsed, .15, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .12));
      if (gather > .02) kit.ball(this.b.copy(actor.handL).add(actor.handR).multiplyScalar(.5), gather * 1.15, 97, NaN, STAR_BEAM_GOLD, STAR_BEAM_LIGHT, .5);
    }
    if (who === 'dorado') {
      // Sovereign Shot: his will gathers on the flintlock as he aims it.
      const gather = THREE.MathUtils.smoothstep(elapsed, .2, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .12));
      if (gather > .02) kit.ball(this.muzzle(actor, this.b), gather * .7, 23, NaN, colour.glow, colour.light, .46);
    }
    if (who === 'gaku') {
      // Roar Palm - the aura gathers in the palm he draws back, and goes with it when he thrusts it out.
      const gather = THREE.MathUtils.smoothstep(elapsed, .15, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .1));
      if (gather > .02) kit.ball(actor.handR, gather * 1.05, 131, NaN, colour.glow, colour.light, .5);
    }
    if (elapsed < contact || this.drawn.get(id) === key) return;
    this.drawn.set(id, key);
    const yaw = actor.state.yaw;
    if (who === 'gaku') this.flash(this.a.copy(actor.handR), 1, key, 1.5, colour.glow, time);
    if (who === 'gorai') {
      // Grog Gale: the wind the swing throws, three crescents deep.
      for (let i = 0; i < 3; i++) {
        this.a.copy(actor.group.position).addScaledVector(this.forward, 1.6 + i * 1.3).setY(actor.group.position.y + 1.1);
        this.cut('wind', this.a, yaw, 3.6 + i * .9, .25 - i * .25, time + i * .05, .38, key + i * 11);
      }
    }
    if (who === 'haldor') {
      this.a.copy(actor.handL).addScaledVector(this.forward, .55);
      this.crack(this.a, this.forward, time, key, 2.6, 14, colour.glow);
      this.flash(this.a, 1.2, key, 1.8, colour.glow, time);
    }
    if (who === 'sorrel') {
      // Crimson Command: the dome goes out, and crimson lightning runs out over the floor.
      this.dome(id, time, MOVES.sorrel.special.radius, WILL_RED);
      this.strike(this.a.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, key, 'floor', WILL_RED);
    }
    if (who === 'magatsu') {
      // Rend: Thousand Cuts - the cuts it throws, one after another down the line.
      for (let i = 0; i < 5; i++) {
        const r = kit.painter.rng.seed(key * 5 + i);
        this.a.copy(actor.group.position).addScaledVector(this.forward, 1.4 + i * 1.1).setY(actor.group.position.y + .7 + r.next() * .8);
        this.cut('magatsu', this.a, actor.state.yaw + r.signed() * .25, 2.4 + r.next(), r.signed() * 1.4, time + i * .045, .3, key + i * 13);
      }
    }
    if (who === 'shiun') {
      // The volley: arrows of light out of his back - out of the fan of light behind base Shiun - and on ahead of him.
      const winged = !!actor.state.awakened, from = this.back(actor, this.a);
      this.flash(from, 1, key, 1.6, colour.glow, time);
      for (let i = 0, n = winged ? 7 : HALO; i < n; i++) {
        const r = kit.painter.rng.seed(key * 7 + i);
        this.side.set(this.forward.z, 0, -this.forward.x);
        if (winged) this.b.copy(from).addScaledVector(this.side, r.signed() * .9).addScaledVector(this.up, r.signed() * .5);
        else this.halo(actor, i, this.b);
        this.c.copy(this.b).addScaledVector(this.forward, 6 + r.next() * 3).addScaledVector(this.side, r.signed() * 1.4);
        kit.arc(this.b, this.c, key + i * 3, .035, colour.glow, 1.1, 2, 3, .28);
      }
    }
    if (who === 'vesper') {
      // Pale Lance: a white flash off his hand as the spear leaves it (the spear itself is CombatEffects'). His left:
      // the sabre stays in his right as he throws (7 October 2026, scripts/fanim/vesper.py). Black Vespers hurls it with his
      // right (he has no sabre, and his LeftHand joint stands in his wing, 32 cm off the wrist).
      this.a.copy(actor.state.awakened ? actor.handR : actor.handL).addScaledVector(this.forward, .3);
      this.flash(this.a, .7, key, 1.1, colour.glow, time);
    }
    if (who === 'wuming') {
      // The beam let go: the flash at his palm.
      this.flash(this.a.copy(actor.handR), 1.1, key, 1.6, colour.glow, time);
    }
    if (who === 'gohaku') {
      // The beam let go: the flash between his hands.
      this.flash(this.a.copy(actor.handL).add(actor.handR).multiplyScalar(.5), 1.2, key, 1.7, STAR_BEAM_GOLD, time);
    }
    if (who === 'jirenga') {
      // The sphere let go: the flash at his palm, and the air ahead of it breaking.
      this.flash(this.a.copy(actor.handR), 1.2, key, 1.7, colour.glow, time);
      this.crack(this.b.copy(actor.handR).addScaledVector(this.forward, .5), this.forward, time, key, 1.8, 10, colour.glow);
    }
    if (who === 'jinlin') {
      // The volley: six beams out of his fingertips, a hand at a time, at whoever he aims at - pinpoints, a few
      // hands' breadth apart round them.
      const aim = this.aimOf(actor, fighters, this.c, MOVES['jinlin'].special.range);
      for (let i = 0; i < 6; i++) {
        const r = kit.painter.rng.seed(key * 6 + i);
        this.a.copy(i % 2 ? actor.handL : actor.handR).addScaledVector(this.forward, .12);
        this.b.set(r.signed() * .5, r.signed() * .45, r.signed() * .5).add(aim);
        this.beam(this.a, this.b, time + i * .065, key + i * 7, .04, RAY, .14);
      }
      this.flash(this.a.copy(actor.handR), .9, key, 1.3, RAY, time);
    }
    if (who === 'dorado') {
      // The shot: the flash at the muzzle, and the will round the ball going out with it.
      const muzzle = this.muzzle(actor, this.a);
      this.flash(muzzle, 1.1, key, 1.6, colour.glow, time);
      this.b.copy(muzzle).addScaledVector(this.forward, 4.5);
      kit.arc(muzzle, this.b, key, .05, colour.glow, 1.2, 3, 4, .3);
      kit.arc(muzzle, this.b, key + 1, .03, colour.glow, .9, 2, 3, .36);
    }
  }

  /** Mirror Mere thrown in his true form: the lower hands make their sign under the upper pair's, the spear and
   *  the dagger let go and hanging beside him (magatsu_four_arms.py) - and from behind him, where the lens is, the sign
   *  was hidden by his own back and the weapons read as still in his hands (the blind critics, after release 33: "no
   *  four-handed sign"). So his hex energy gathers in the lower hands' sign, a crimson glow either side of his hips,
   *  and burns round each weapon while it hangs, from the cast to Calamity Pyre's draw. */
  private fourHandedSign(actor: Fighter, elapsed: number) {
    const body = actor.shownBody;
    if (body === actor) return;
    let bones = this.signs.get(body);
    if (!bones) {
      const joint = (name: string) => body.model.getObjectByName(name) ?? undefined;
      bones = {left: joint('LowerLeftHand'), right: joint('LowerRightHand'), spear: joint('Spear'), dagger: joint('Dagger')};
      this.signs.set(body, bones);
    }
    const held = THREE.MathUtils.smoothstep(elapsed, .45, .7) * (1 - THREE.MathUtils.smoothstep(elapsed, 1.5, 1.75));
    if (held < .02 || !bones.left || !bones.right) return;
    const glow = COLOR.magatsu.glow, kit = this.kit, pulse = .85 + .15 * Math.sin(elapsed * 17);
    bones.left.getWorldPosition(this.a); bones.right.getWorldPosition(this.b);
    this.c.copy(this.a).lerp(this.b, .5);
    kit.glows.add(this.c, .55 * held, glow, 1.2 * held * pulse, GLOW, .3, 31);
    kit.glows.add(this.c, .9 * held, glow, .5 * held, RING, .08, 32, .4);
    for (const [i, weapon] of [bones.spear, bones.dagger].entries()) {
      if (!weapon) continue;
      weapon.getWorldPosition(this.a);
      kit.glows.add(this.a, (i ? .45 : .7) * held, glow, .9 * held * pulse, GLOW, .2, 33 + i);
    }
  }

  /** Shiun's False Encore, his heavy: as he goes, the copy of him they were watching is left standing; fine cracks
   *  run out over it from his chest, and it breaks like a mirror - before he is back behind them, while the lens still
   *  has it before it: once he is back, the lens looks at the one he went for from behind him, and where he stood is
   *  behind them (the blind critics, after release 33: the copy "never on screen", the cracking "a purple flash over
   *  Shiun himself"). Anything that ends the heavy early breaks it there and then. */
  private illusion(id: string, actor: Fighter, elapsed: number, key: number, time: number) {
    const s = actor.state, blink = BLINKS.shiun!, colour = COLOR.shiun, kit = this.kit;
    let held = this.decoys.get(id);
    const heavy = s.action === 'heavy' && !s.branch && s.alive;
    if (held && held.decoy.standing && (!heavy || held.key !== key)) held.decoy.shatter(time);
    if (!heavy) return;
    if (elapsed >= blink.vanish && elapsed < ILLUSION_BREAKS && (!held || held.key !== key)) {
      if (!held) { held = {decoy: new EncoreDecoy(this.scene, colour.glow), key}; this.decoys.set(id, held); }
      held.key = key;
      held.decoy.show(actor.shownBody);
    }
    if (!held || held.key !== key || !held.decoy.standing) return;
    const decoy = held.decoy;
    // The cracks: thin and white, out from his chest over his head, shoulders, arms and coat, longer each frame.
    const grown = THREE.MathUtils.smoothstep(elapsed, blink.vanish + .03, ILLUSION_BREAKS);
    if (grown > 0) {
      this.side.set(decoy.facing.z, 0, -decoy.facing.x);
      for (let i = 0; i < 11; i++) {
        const r = kit.painter.rng.seed(key * 13 + i), angle = (i / 11) * Math.PI * 2 + r.signed() * .3, reach = (.45 + .5 * r.next()) * grown;
        this.a.copy(decoy.chest).addScaledVector(this.side, Math.cos(angle) * reach).addScaledVector(this.up, Math.sin(angle) * reach * 1.4)
          .addScaledVector(decoy.facing, -.08);
        kit.arc(decoy.chest, this.a, key * 7 + i, .012 + .006 * grown, this.crackWhite, .9 + grown, 2, 3, .45);
      }
    }
    if (elapsed >= ILLUSION_BREAKS) {
      decoy.shatter(time);
      this.flash(this.a.copy(decoy.chest), .45, key + 9, .9, colour.glow, time);
    }
  }

  /** Wuming's Petalfall Blade, his heavy: the sign, gone and back behind them, the blade, the cut. */
  private transmission(id: string, actor: Fighter, elapsed: number, key: number, time: number) {
    const kit = this.kit, colour = COLOR['wuming'], contact = MOVES['wuming'].heavy.contacts[0];
    // The sign: a glint at the two fingers on his forehead, sharpening until he is gone.
    if (elapsed < BLINK.vanish) {
      const k = THREE.MathUtils.smoothstep(elapsed, .02, BLINK.vanish - .01);
      if (k > .02) kit.ball(this.a.copy(actor.handR).addScaledVector(this.up, .08), .3 * k, 61, NaN, colour.glow, colour.light, .25);
    }
    // Gone in a flash where he stood, and back in another behind them.
    const mark = key * 2;
    if (elapsed >= BLINK.vanish && this.drawn.get(`${id}:gone`) !== mark) {
      this.drawn.set(`${id}:gone`, mark);
      this.flash(this.a.copy(actor.group.position).setY(actor.group.position.y + 1.1), .9, key, 1.4, colour.glow, time);
      this.ring(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), time, 1.6);
    }
    if (elapsed >= BLINK.appear + APPEAR_HOLD && this.drawn.get(`${id}:back`) !== mark) {
      this.drawn.set(`${id}:back`, mark);
      this.flash(this.a.copy(actor.group.position).setY(actor.group.position.y + 1.1), 1.1, key + 1, 1.6, colour.glow, time);
    }
    // The blade of ki out of his hand, from the return to the cut.
    const blade = THREE.MathUtils.smoothstep(elapsed, BLINK.appear, BLINK.appear + .08) * (1 - THREE.MathUtils.smoothstep(elapsed, contact + .08, contact + .3));
    if (blade > .03) {
      this.b.copy(actor.handR).sub(actor.handL).normalize();
      this.c.copy(this.forward).multiplyScalar(.7).add(this.b.multiplyScalar(.3)).normalize();
      this.a.copy(actor.handR).addScaledVector(this.c, 1.5 * blade);
      kit.arc(actor.handR, this.a, kit.tick * 3 + 5, .05 * blade + .015, colour.glow, 1.3 * blade, 0, 2, .06);
      kit.ball(actor.handR, .35 * blade, 53, NaN, colour.glow, colour.light, .4);
    }
    // The cut: the blade's arc where it goes through them, and the flash.
    if (elapsed >= contact && this.drawn.get(`${id}:cut`) !== mark) {
      this.drawn.set(`${id}:cut`, mark);
      this.a.copy(actor.group.position).addScaledVector(this.forward, 1.5).setY(actor.group.position.y + 1.05);
      this.cut('wuming', this.a, actor.state.yaw, 4, .5, time, .36, key);
      this.flash(this.a, 1, key, 1.5, colour.glow, time);
    }
  }

  private murderOfCrows(id: string, actor: Fighter, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const blink = BLINKS.tobari!, mark = key * 2;
    this.crows ??= new CrowFlock(this.scene, CROW_EYE);
    let clone = this.clones.get(id);
    if (!clone) { clone = new EncoreDecoy(this.scene, COLOR.tobari.glow); this.clones.set(id, clone); }
    if (elapsed >= blink.vanish - CROW_LEAD && this.drawn.get(`${id}:gone`) !== mark) {
      this.drawn.set(`${id}:gone`, mark);
      this.crows.burst(actor, time, 5);
      clone.show(actor);
    }
    const target = actor.state.target ? fighters.get(actor.state.target) : undefined;
    const struck = target && target !== actor && target.state.alive ? this.c.copy(target.group.position).setY(target.group.position.y + 1.2) : undefined;
    const breaking = elapsed - blink.vanish - CLONE_STANDS;
    if (clone.standing && breaking >= 0) {
      if (this.drawn.get(`${id}:break`) !== mark) {
        this.drawn.set(`${id}:break`, mark);
        const points = clone.joints(CLONE_JOINTS);
        this.crows.burstFrom(points, clone.chest, time, CLONE_JOINTS.length, struck, CLONE_BREAK * .6);
      }
      if (breaking >= CLONE_BREAK) clone.release(); else clone.crumble(breaking / CLONE_BREAK);
    }
    if (elapsed >= blink.appear + APPEAR_HOLD * .5 && this.drawn.get(`${id}:back`) !== mark) {
      this.drawn.set(`${id}:back`, mark);
      // The birds reach him as he grows (from APPEAR_HOLD past the return, over FORMED), the last as he is whole.
      this.crows.gather(actor, time, struck, joint => APPEAR_HOLD * .5 + FORMED * (.35 + .55 * ((joint.charCodeAt(0) + joint.length) % 5) / 4));
    }
  }

  /** Tobari, `since` seconds into forming out of his crows: the whole of him grown from nothing to his own size about
   *  his hips (the hips joint scaled, which carries all of him), the scale it had kept to give back (`unform`). */
  private form(actor: Fighter, since: number) {
    let rest = this.formed.get(actor);
    if (!rest) { rest = new Map(); this.formed.set(actor, rest); }
    const bone = actor.bones.get('hips');
    if (!bone) return;
    let scale = rest.get(bone);
    if (!scale) { scale = bone.scale.clone(); rest.set(bone, scale); }
    const u = THREE.MathUtils.clamp(since / FORMED, 0, 1);
    bone.scale.copy(scale).multiplyScalar(Math.max(.02, u * u * (3 - 2 * u)));
  }

  /** His joints given back their own scale: formed, or the heavy cut short. */
  private unform(actor: Fighter) {
    const rest = this.formed.get(actor);
    if (!rest) return;
    for (const [bone, scale] of rest) bone.scale.copy(scale);
    this.formed.delete(actor);
  }

  /** Tobari's Black Pyre: his red eye's glow at his eye as he looks, and the black flames catch where he is looking -
   *  where the cast was aimed (its endpoint, as Shiden's) - and burn there, licking upward, until the move ends. */
  private blackPyre(id: string, actor: Fighter, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const move = MOVES.tobari.special, contact = move.contacts[0];
    const look = THREE.MathUtils.smoothstep(elapsed, .05, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .3));
    if (look > .03) this.kit.ball(this.eye(actor, this.a), .22 * look, 109, NaN, RED_EYE, COLOR.tobari.light, .2);
    if (elapsed < contact) return;
    const field = this.fields.get(id), floor = actor.state.grounded ? actor.group.position.y : 0;
    const center = field && Math.abs(field.since - actor.state.actionStarted) < .25 ? this.c.copy(field.at) : this.aimOf(actor, fighters, this.c, move.range);
    center.y = floor;
    if (this.drawn.get(`${id}:ignite`) !== key) {
      this.drawn.set(`${id}:ignite`, key);
      this.flash(this.b.copy(center).setY(floor + .9), 1, key, 1.6, BLACK_PYRE, time);
    }
    const fade = 1 - THREE.MathUtils.smoothstep(elapsed, move.duration - .6, move.duration), ignite = THREE.MathUtils.smoothstep(elapsed, contact, contact + .25);
    // On the one it caught, as Black Pyre burns: black flames clinging to their body and going with them, and a little
    // black fire at their feet. As a fence of flames over the floor it was "the Cinder Art: Burning Sea in purple"
    // (the blind critics, 3 October), and Akagane's is a wall of fire now.
    const victim = actor.state.target ? fighters.get(actor.state.target) : undefined;
    if (victim && victim.state.alive && Math.hypot(victim.group.position.x - center.x, victim.group.position.z - center.z) < move.radius + 1.5) {
      const at = victim.group.position, count = Math.round(80 * Math.min(1, this.kit.density) * ignite);
      for (let j = 0; j < count && this.flameCount < FLAMES; j++) {
        const a = j * 2.399963, h = .15 + ((j * .618) % 1) * 1.55, girth = .22 + .14 * Math.sin(h * 2.2), phase = (time * (1.3 + (j % 4) * .2) + j * .37) % 1;
        this.a.set(at.x + Math.cos(a + time * .7) * girth, at.y + h, at.z + Math.sin(a + time * .7) * girth);
        this.flame(this.a, a, time + j, (.6 + .25 * (j % 3)) * fade, (.85 + phase * .8) * fade, 1 - phase * .5, (j * .137) % 1, BLACK);
      }
      this.flameField(this.b.copy(at).setY(floor), .8, ignite, fade, time, BLACK, Math.round(36 * Math.min(1, this.kit.density)), .6);
    } else this.flameField(center, move.radius * .7, ignite, fade, time, BLACK, Math.round(70 * Math.min(1, this.kit.density)), .8);
  }

  /** A field of flames rooted on the floor round `center`, out to `radius`: the cards licking upward on their own clocks,
   *  in a flame palette - Black Pyre's black, the Cinder Art: Burning Sea's fire. */
  private flameField(center: THREE.Vector3, radius: number, ignite: number, fade: number, time: number, palette: number, count: number, tallness = 1) {
    for (let j = 0; j < count && this.flameCount < FLAMES; j++) {
      const a = j * 2.4, r = Math.sqrt((j + .5) / count) * radius * (.35 + .65 * ignite), phase = (time * (1.1 + (j % 3) * .25) + j * .618) % 1;
      // Rooted on the floor, so no card shows a straight cut where it would pass into it.
      const grow = (1 - phase * .4) * fade, tall = (1.5 + phase * (1.4 + (j % 5) * .3)) * grow * tallness;
      this.flame(this.a.set(center.x + Math.cos(a) * r, center.y + tall * .25 * .92 + .02, center.z + Math.sin(a) * r), a, time + j, (1.6 + .5 * (j % 3)) * grow, tall, 1 - phase * .6, (j * .137) % 1, palette);
    }
  }

  /** One flame card at `at`, licking up (swaying about the axis round `angle`). */
  private flame(at: THREE.Vector3, angle: number, clock: number, width: number, tall: number, heat: number, seed: number, palette: number) {
    if (this.flameCount >= FLAMES) return;
    this.transform.position.copy(at);
    this.transform.quaternion.setFromAxisAngle(this.flameAxis.set(Math.cos(angle + 1.6), 0, Math.sin(angle + 1.6)), Math.sin(clock * 2.3) * .14);
    this.transform.scale.set(width, tall, 1); this.transform.updateMatrix();
    this.flames.setMatrixAt(this.flameCount, this.transform.matrix);
    this.flames.setColorAt(this.flameCount++, this.tint.setRGB(heat, seed, flamePalette(palette)));
  }

  /** Where a field special was cast at (its cast's endpoint), or where the fighter aims now. */
  private fieldAt(id: string, actor: Fighter, fighters: ReadonlyMap<string, Fighter>, range: number, out: THREE.Vector3) {
    const field = this.fields.get(id);
    return field && Math.abs(field.since - actor.state.actionStarted) < .25 ? out.copy(field.at) : this.aimOf(actor, fighters, out, range);
  }

  /** Akagane's Cinder Art: Burning Sea: the fire pours out of him in a stream at each burn, and burns over the ground
   *  where it lands (the cast's endpoint), out to the move's reach. */
  private majesticFlame(id: string, actor: Fighter, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const move = MOVES.akagane.special, contact = move.contacts[0], last = move.contacts[move.contacts.length - 1];
    if (elapsed < contact - .1) return;
    const floor = actor.state.grounded ? actor.group.position.y : 0;
    const center = this.fieldAt(id, actor, fighters, move.range, this.c); center.y = floor;
    const fade = 1 - THREE.MathUtils.smoothstep(elapsed, move.duration - .5, move.duration), ignite = THREE.MathUtils.smoothstep(elapsed, contact, contact + .3);
    // The stream: from his mouth out to the field, while he breathes.
    const breath = THREE.MathUtils.smoothstep(elapsed, contact - .1, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, last, last + .25));
    if (breath > .03) {
      // A torrent, widening from his mouth until it is wider than a man is tall: the Cinder Art: Burning Sea is a sea
      // of fire, and drawn as a stream into a fence over the floor it was "Tobari's Black Pyre in orange" (the blind
      // critics, 3 October).
      const mouth = this.eye(actor, this.axis), landing = this.tip.set(center.x, floor + 1.1, center.z);
      for (let j = 0; j < 64 && this.flameCount < FLAMES; j++) {
        const u = ((j / 64) + time * 1.6) % 1, spread = .3 + u * 3.4;
        this.b.copy(mouth).lerp(landing, u);
        this.b.x += Math.sin(j * 2.1 + time * 5) * spread * .45; this.b.z += Math.cos(j * 1.7 + time * 4) * spread * .45; this.b.y += Math.sin(j * 1.3) * spread * .3;
        this.flame(this.b, j * 2.4, time + j, (.9 + u * 2.9) * breath, (1 + u * 2.4) * breath, .98 - u * .35, (j * .137) % 1, FLAME_FIRE);
      }
    }
    if (elapsed >= contact && this.drawn.get(`${id}:ignite`) !== key) {
      this.drawn.set(`${id}:ignite`, key);
      this.flash(this.b.copy(center).setY(floor + .9), 1.3, key, 2.2, FIRE, time);
      this.ring(this.b.copy(center).setY(floor + .05), time, move.radius);
    }
    // Where it lands, a wall of fire taller than they are, rolling out past them.
    if (elapsed >= contact) this.flameField(center, move.radius * 1.35, ignite, fade, time, FLAME_FIRE, Math.round(170 * Math.min(1, this.kit.density)), 1.8);
  }

  /** Rook's Grave Grip: where he looks, the ground is lifted - violet arcs drawn up off the floor - and
   *  slammed down at each blow, ringing out. */
  private rooksGrip(id: string, actor: Fighter, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const kit = this.kit, move = MOVES['rook'].special, contact = move.contacts[0];
    const floor = actor.state.grounded ? actor.group.position.y : 0;
    const center = this.fieldAt(id, actor, fighters, move.range, this.c); center.y = floor;
    const lift = THREE.MathUtils.smoothstep(elapsed, .15, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, move.duration - .3, move.duration));
    if (lift > .03 && kit.ticked) {
      for (let i = 0; i < 6; i++) {
        const r = kit.painter.rng.seed(kit.tick * 7 + i + key), a = r.next() * Math.PI * 2, d = r.next() * move.radius;
        this.a.set(center.x + Math.cos(a) * d, floor + .05, center.z + Math.sin(a) * d);
        this.b.copy(this.a).setY(floor + .4 + 1.6 * lift * r.next());
        kit.arc(this.a, this.b, kit.tick * 11 + i, .02, SHADOW, lift, 0, 2, .2);
      }
    }
    move.contacts.forEach((at, blow) => {
      const mark = key * 2 + blow;
      if (elapsed < at || elapsed > at + .15 || this.drawn.get(`${id}:slam`) === mark) return;
      this.drawn.set(`${id}:slam`, mark);
      this.ring(this.a.copy(center).setY(floor + .05), time, move.radius * (blow ? 1.4 : 1));
      this.crack(this.b.copy(center).setY(floor + .3), this.up, time, mark, 2.4 + blow, 12, SHADOW);
      this.flash(this.b.copy(center).setY(floor + 1), 1 + blow * .3, mark, 1.8, SHADOW, time);
    });
  }

  /** Heaven's Anvil's meteor: once the fan's slash has held them, the rock comes down out of the sky onto them,
   *  faster as it falls, burning behind; gone when it lands (the crater is `handle`'s). It streaks in low from far
   *  beyond them, so the cinematic's camera sees it come; near the lens it dissolves (`meteorMaterial`): from Akagane's
   *  side it crossed the camera and filled the frame (the blind critic, 3 October: "a flat salmon disc"), and dropped
   *  straight down it stayed over the top of the frame until it landed. */
  private meteor(id: string, actor: Fighter, elapsed: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const move = MOVES.akagane.ultimate, open = move.contacts[0], finish = move.contacts[move.contacts.length - 1];
    const victim = actor.state.target ? fighters.get(actor.state.target) : undefined;
    let slot = this.meteors.find(m => m.owner === id);
    if (!victim || actor.state.confirmedAt === undefined || elapsed < open || elapsed > finish) { if (slot) { slot.mesh.visible = false; slot.owner = ''; } return; }
    slot ??= this.meteors.find(m => !m.owner) ?? this.meteors[0];
    slot.owner = id;
    const u = THREE.MathUtils.clamp((elapsed - open) / (finish - open), 0, 1), fall = u * u;
    const target = this.a.copy(victim.group.position).setY(victim.group.position.y + 1.1);
    this.b.set(this.forward.x * 6, 8, this.forward.z * 6);
    slot.fall.copy(this.b).negate().normalize();
    slot.mesh.position.copy(target).addScaledVector(this.b, 1 - fall);
    slot.mesh.scale.setScalar(1.25 + .35 * u); slot.mesh.rotation.set(time * .7, time * .4, 0); slot.mesh.visible = true;
    // The fire it drags down behind it.
    for (let j = 0; j < 22 && this.flameCount < FLAMES; j++) {
      const k = j / 22;
      this.c.copy(slot.mesh.position).addScaledVector(slot.fall, -(.8 + k * 2.6));
      this.c.x += Math.sin(j * 2.3 + time * 6) * .5 * k; this.c.z += Math.cos(j * 1.9 + time * 5) * .5 * k;
      this.flame(this.c, j * 2.4, time + j, 1.6 + 1.4 * (1 - k), 1.8 + 1.6 * (1 - k), .95 - k * .5, (j * .137) % 1, FLAME_FIRE);
    }
    this.kit.lights.add(slot.mesh.position, 6, FIRE_LIGHT, .9 / LIGHT_SCALE);
  }
  /** Each awakening's own mark over the shared beat (the lightning, the ink panel, the ribbons are the whole game's;
   *  the blind critics, 3 October: "every awakening is one sequence recoloured"), drawn a frame at a time through
   *  SIGNATURE_SECONDS: Sekka's frost stance opened on the floor round him, the air round Haldor cracked like
   *  glass where he took hold of it, a whirl of Levin's cuts, Ippon's gust flattening out round him, a ring of the
   *  Sun's fire round Asahi. */
  private drawSignatures(time: number, fighters: ReadonlyMap<string, Fighter>) {
    const kit = this.kit;
    this.signatures = this.signatures.filter(m => time - m.since < SIGNATURE_SECONDS);
    for (const mark of this.signatures) {
      const actor = fighters.get(mark.actorId), age = time - mark.since;
      if (!actor || !actor.state.alive || age < 0) continue;
      const base = actor.group.position, on = THREE.MathUtils.smoothstep(age, .2, .7) * (1 - THREE.MathUtils.smoothstep(age, SIGNATURE_SECONDS - .6, SIGNATURE_SECONDS));
      if (on < .02) continue;
      if (mark.who === 'sekka') {
        // The snowflake, wider than the special's, its arms branched twice, turning slowly under him.
        const radius = 4.6 * Math.min(1, age * 2.2), y = base.y + .04, turn = actor.state.yaw + age * .25;
        for (let arm = 0; arm < 6; arm++) {
          const yaw = turn + arm * Math.PI / 3, dx = Math.sin(yaw), dz = Math.cos(yaw);
          this.a.copy(base).setY(y); this.b.set(base.x + dx * radius, y, base.z + dz * radius);
          kit.arc(this.a, this.b, mark.seed + arm * 5, .035 * on, COMPASS, 1.2 * on, 0, 1, .02);
          for (const at of [.4, .7]) {
            this.c.set(base.x + dx * radius * at, y, base.z + dz * radius * at);
            for (const side of [-1, 1]) {
              const branch = yaw + side * .7;
              this.tip.set(this.c.x + Math.sin(branch) * radius * .22, y, this.c.z + Math.cos(branch) * radius * .22);
              kit.arc(this.c, this.tip, mark.seed + arm * 11 + side + Math.round(at * 10), .022 * on, COMPASS, on, 0, 1, .02);
            }
          }
        }
      } else if (mark.who === 'haldor') {
        // The air breaks like glass at six points round him, one after another, and stays broken.
        for (let k = 0; k < 6; k++) {
          const show = THREE.MathUtils.smoothstep(age, .15 + k * .14, .25 + k * .14) * on;
          if (show < .02) continue;
          const yaw = actor.state.yaw + k * Math.PI / 3 + .4, reach = 1.6 + (k % 2) * .5;
          this.c.set(base.x + Math.sin(yaw) * reach, base.y + 1.3 + (k % 3) * .45, base.z + Math.cos(yaw) * reach);
          this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
          for (let i = 0; i < 9; i++) {
            const r = kit.painter.rng.seed(mark.seed * 31 + k * 97 + i * 13), angle = i / 9 * Math.PI * 2 + r.signed() * .3, length = (.5 + .6 * r.next()) * 1.1;
            this.a.copy(this.c).addScaledVector(this.side, Math.cos(angle) * length).y += Math.sin(angle) * length;
            kit.arc(this.c, this.a, mark.seed * 7 + k * 31 + i, .02 * show + .005, COLOR.haldor.glow, show, 2, 3, .5);
          }
        }
      } else if (mark.who === 'levin') {
        // A whirl of blade-light round him at three heights, turning fast, his own.
        for (let k = 0; k < 3; k++) {
          const spin = age * (9 + k * 2) + k * 2.1, y = base.y + .6 + k * .55, radius = 1.15 + k * .2;
          this.c.set(base.x + Math.sin(spin) * radius, y, base.z + Math.cos(spin) * radius);
          for (let i = 1; i <= 5; i++) {
            const a = spin - i * .28;
            this.a.set(base.x + Math.sin(a) * radius, y + Math.sin(i + k) * .06, base.z + Math.cos(a) * radius);
            kit.arc(this.c, this.a, mark.seed + k * 7 + i, (.05 - i * .007) * on, COLOR.levin.glow, (1.3 - i * .18) * on, 0, 1, .02);
            this.c.copy(this.a);
          }
        }
      } else if (mark.who === 'ippon') {
        // A gust out from him over the floor, two waves of it, flattening everything round.
        for (let wave = 0; wave < 2; wave++) {
          const t = THREE.MathUtils.clamp((age - .25 - wave * .35) / .7, 0, 1);
          if (t <= 0 || t >= 1) continue;
          const radius = 1 + t * 7.5, fade = (1 - t) * on, y = base.y + .08;
          for (let i = 0; i < 24; i++) {
            const a = i / 24 * Math.PI * 2, b = (i + 1) / 24 * Math.PI * 2;
            this.a.set(base.x + Math.sin(a) * radius, y, base.z + Math.cos(a) * radius);
            this.b.set(base.x + Math.sin(b) * radius, y, base.z + Math.cos(b) * radius);
            kit.arc(this.a, this.b, mark.seed + wave * 97 + i, .05 * fade, SERIOUS_WIND, fade, 0, 1, .05);
          }
        }
      } else if (mark.who === 'asahi') {
        // The Sun's fire up round him in a ring on the floor.
        for (let i = 0; i < 26 && this.flameCount < FLAMES; i++) {
          const a = i / 26 * Math.PI * 2 + age * .4, r = 2.1 + Math.sin(i * 1.7) * .15;
          this.flame(this.a.set(base.x + Math.sin(a) * r, base.y + .45 * on, base.z + Math.cos(a) * r), a, time + i, .7 * on, (1.1 + (i % 3) * .3) * on, .95, (i * .137) % 1, FLAME_FIRE);
        }
        kit.lights.add(this.a.copy(base).setY(base.y + 1), 4, FIRE_LIGHT, .6 * on / LIGHT_SCALE * .5);
      }
    }
  }
  /** Crimson Command's lightning, from `a` to `b`: a jagged stroke, black at its core and red round it, with a
   *  branch or two off it (the blind critics, 3 October: Dorado's will "gold lightning instead of black-red", Sorrel'
   *  "red glare"). `width` is the red's half-width in metres. */
  private willBolt(a: THREE.Vector3, b: THREE.Vector3, seed: number, width: number, strength: number, branches = 1) {
    const r = this.kit.painter.rng.seed(seed), points = this.jag, n = points.length - 1, span = a.distanceTo(b);
    this.across.subVectors(b, a).cross(this.up);
    if (this.across.lengthSq() < 1e-6) this.across.set(1, 0, 0);
    this.across.normalize();
    for (let i = 0; i <= n; i++) {
      const t = i / n, off = i === 0 || i === n ? 0 : r.signed() * span * .16;
      points[i].copy(a).lerp(b, t).addScaledVector(this.across, off).y += i === 0 || i === n ? 0 : r.signed() * span * .1;
    }
    for (let i = 0; i < n; i++) {
      this.kit.bolts.segment(points[i], points[i + 1], width, WILL_RED, strength, 0);
      this.ink.segment(points[i], points[i + 1], width * .42, Math.min(1, strength * 1.2));
    }
    for (let k = 0; k < branches; k++) {
      const from = points[1 + Math.floor(r.next() * (n - 1))];
      this.b.copy(from).addScaledVector(this.across, r.signed() * span * .35).y += r.signed() * span * .2;
      this.kit.bolts.segment(from, this.b, width * .7, WILL_RED, strength * .8, 0);
      this.ink.segment(from, this.b, width * .3, Math.min(1, strength));
    }
  }
  private hideMeteor(id: string) { const slot = this.meteors.find(m => m.owner === id); if (slot) { slot.mesh.visible = false; slot.owner = ''; } }
  private hideWarFan(id: string) { const slot = this.gunbais.find(m => m.owner === id); if (slot) { slot.fan.visible = false; slot.owner = ''; } }
  private hideCoffin(id: string) { const slot = this.coffins.find(m => m.owner === id); if (slot) { for (const m of slot.slabs) m.visible = false; slot.owner = ''; } }
  private hideScythe(id: string) { const slot = this.scythes.find(m => m.owner === id); if (slot) { slot.haft.visible = slot.blade.visible = false; slot.owner = ''; } }

  /** Tobari's eyes: a little ahead of the head bone, or where a head would be. */
  private eye(actor: Fighter, out: THREE.Vector3) {
    const head = actor.bones.get('head');
    if (head) head.getWorldPosition(out).addScaledVector(this.forward, .1).setY(out.y + .06);
    else out.copy(actor.group.position).addScaledVector(this.forward, .1).setY(actor.group.position.y + 1.65);
    return out;
  }

  /** Between Shiun's wings: behind his shoulders, a little above them. */
  private back(actor: Fighter, out: THREE.Vector3) {
    return out.copy(actor.group.position).addScaledVector(this.forward, -.35).setY(actor.group.position.y + 1.55);
  }
  /** Point `i` of HALO in the fan of light behind base Shiun through 'GLASS LANCES': a half ring over his shoulders
   *  and head, square to where he faces. */
  private halo(actor: Fighter, i: number, out: THREE.Vector3) {
    const yaw = actor.state.yaw, angle = (i / (HALO - 1) - .5) * Math.PI * .9;
    return out.copy(actor.group.position).addScaledVector(this.forward.set(Math.sin(yaw), 0, Math.cos(yaw)), -.45)
      .addScaledVector(this.across.set(Math.cos(yaw), 0, -Math.sin(yaw)), Math.sin(angle) * 1.25).setY(actor.group.position.y + 1.45 + Math.cos(angle) * .95);
  }

  /** Where Dorado's flintlock points from: the pistol's own joints (a pose off the pelvis that his
   *  clips put in his hand to fire it), or the left hand if the rig has none. */
  private muzzle(actor: Fighter, out: THREE.Vector3) {
    const gun = actor.bones.get('qiangbone410106') ?? actor.bones.get('qiangbone340105');
    if (gun) gun.getWorldPosition(out); else out.copy(actor.handL);
    return out.addScaledVector(this.forward, .18);
  }

  private ultimate(who: Emperor, id: string, actor: Fighter, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const kit = this.kit, colour = COLOR[who], move = MOVES[who].ultimate;
    const finish = move.contacts[move.contacts.length - 1];
    if (who === 'gohaku') {
      // The Sun-Seizing Spiral: the ki drawn to a point at the two fingers on his forehead, sharper and sharper
      // until the arm is thrown out; and while the beam bores through them, its spiral winds round it in violet.
      const open = move.contacts[0];
      const point = THREE.MathUtils.smoothstep(elapsed, .05, open) * (1 - THREE.MathUtils.smoothstep(elapsed, open, open + .08));
      if (point > .03) {
        kit.ball(this.a.copy(actor.handR).addScaledVector(this.up, .05), .4 * point, 101, NaN, STAR_BEAM_GOLD, STAR_BEAM_LIGHT, .3);
        if (kit.ticked) {
          const r = kit.painter.rng.seed(kit.tick * 13 + key);
          this.b.set(r.signed() * .3, r.signed() * .3, r.signed() * .3).add(this.a);
          kit.arc(this.a, this.b, kit.tick * 5 + 9, .02, SPIRAL, point, 0, 2, .3);
        }
      }
      if (elapsed >= open && elapsed < finish + .12) {
        const from = actor.handR, to = this.aimOf(actor, fighters, this.c, move.range);
        this.axis.copy(to).sub(from);
        const span = this.axis.length();
        if (span > .3) {
          this.axis.divideScalar(span);
          this.side.crossVectors(this.axis, this.up);
          if (this.side.lengthSq() < 1e-4) this.side.set(1, 0, 0);
          this.side.normalize();
          this.tip.crossVectors(this.side, this.axis);
          // It goes through them: the cinematic holds them at arm's length, and a beam that stopped at their chest was
          // "a spark at his fingertip" and a few dim violet frames between the two (the blind critic, 3 October). The
          // gold core runs on through them and out behind, the spiral wound round all of it.
          const reach = Math.max(span + 9, 14), turns = 56, fade = 1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .12);
          const bore = THREE.MathUtils.smoothstep(elapsed, open, open + .06) * fade;
          this.b.copy(from).addScaledVector(this.axis, reach);
          kit.arc(from, this.b, key + 701, .03, STAR_BEAM_GOLD, 2.2 * bore, 0, 1, .012);
          kit.arc(from, this.b, key + 709, .075, SPIRAL, .55 * bore, 0, 1, .02);
          this.a.copy(from);
          for (let i = 1; i <= turns; i++) {
            const along = i / turns, phase = along * reach * 2.6 - time * 20, radius = .16 + .05 * Math.sin(along * 21);
            this.b.copy(from).addScaledVector(this.axis, along * reach)
              .addScaledVector(this.side, Math.cos(phase) * radius).addScaledVector(this.tip, Math.sin(phase) * radius);
            kit.arc(this.a, this.b, key + i * 3, .028, SPIRAL, 1.2 * fade, 0, 1, .04);
            this.a.copy(this.b);
          }
          // Where it comes out of them, and where it ends.
          if (bore > .05) {
            kit.glows.add(this.b.copy(from).addScaledVector(this.axis, span + .35), .45 * bore, STAR_BEAM_GOLD, bore, STAR, .2, key % 97);
            kit.glows.add(this.b.copy(from).addScaledVector(this.axis, reach), .3 * bore, SPIRAL, bore, STAR, .2, (key + 7) % 97);
          }
        }
      }
      if (elapsed >= open && this.drawn.get(`${id}:cannon`) !== key) {
        this.drawn.set(`${id}:cannon`, key);
        this.flash(this.a.copy(actor.handR), 1.2, key, 1.8, STAR_BEAM_GOLD, time);
      }
    }
    if (who === 'akagane') this.meteor(id, actor, elapsed, time, fighters);
    if (who === 'asahi') {
      // Lantern Rite: First Light: once it has held them, the blade burns through the leap until it comes down.
      const burn = THREE.MathUtils.smoothstep(elapsed, move.contacts[0] + .1, move.contacts[0] + .4) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .2));
      if (burn > .03 && actor.state.confirmedAt !== undefined) {
        actor.strikePoint(this.tip);
        for (let j = 0; j < 10 && this.flameCount < FLAMES; j++) {
          this.b.copy(actor.handR).lerp(this.tip, (j + .5) / 10);
          this.flame(this.b, j * 2.4, time + j, .7 * burn, (.9 + (j % 3) * .25) * burn, .95, (j * .137) % 1, FLAME_FIRE);
        }
        kit.arc(actor.handR, this.tip, kit.tick * 3 + 13, .03 * burn, SUN, burn, 1, 2, .2);
      }
    }
    if (who === 'levin') {
      let whirl = this.whirls.get(id);
      if (!whirl) { whirl = new BladeWhirl(this.scene); this.whirls.set(id, whirl); }
      const spin = move.contacts[1] - .12;
      const spinning = actor.state.confirmedAt === undefined ? 0
        : THREE.MathUtils.smoothstep(elapsed, spin, spin + .1) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .15));
      whirl.update(actor, spinning, this.seeing ? this.lens : undefined);
      // The Grapple Rig holds him up there: its two lines out from his hips to anchors high either side beyond them.
      if (spinning > .03) {
        const victim = actor.state.target ? fighters.get(actor.state.target) : undefined;
        this.side.set(this.forward.z, 0, -this.forward.x);
        this.c.copy(victim?.state.alive ? victim.group.position : this.a.copy(actor.group.position).addScaledVector(this.forward, 1.5));
        for (const sideSign of [-1, 1]) {
          this.b.copy(actor.group.position).setY(actor.group.position.y + .95);
          const hips = actor.bones.get('hips');
          if (hips) hips.getWorldPosition(this.b);
          this.tip.copy(this.c).addScaledVector(this.forward, 1.6).addScaledVector(this.side, sideSign * 2.6).setY(this.c.y + 4.6);
          kit.arc(this.b, this.tip, key + (sideSign > 0 ? 7 : 8), .012, colour.light, spinning, 0, 1, .02);
        }
      }
    }
    if (who === 'rook' && actor.state.confirmedAt !== undefined) {
      // Black Rookery: the shadows of the fallen come up out of the floor behind him, a line of them, and stand until they fall
      // on whoever the cut held.
      const rise = THREE.MathUtils.smoothstep(elapsed, move.contacts[0] + .1, finish - .2) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .25));
      if (rise > .03) {
        this.side.set(this.forward.z, 0, -this.forward.x);
        for (let soldier = 0; soldier < 5; soldier++) {
          const across = (soldier - 2) * 1.1, back = 1.6 + Math.abs(soldier - 2) * .5;
          this.c.copy(actor.group.position).addScaledVector(this.side, across).addScaledVector(this.forward, -back).setY(actor.group.position.y);
          for (let j = 0; j < 14 && this.flameCount < FLAMES; j++) {
            const h = (j / 14) * 1.9 * rise;
            this.b.copy(this.c).setY(this.c.y + h + .1);
            this.b.x += Math.sin(j * 2.1 + soldier) * .14; this.b.z += Math.cos(j * 1.7 + soldier) * .14;
            this.flame(this.b, soldier * 1.3 + j * 2.4, time + j + soldier * 3, .9 * rise, 1.3 * rise, .7, ((j + soldier * 5) * .137) % 1, BLACK);
          }
          kit.glows.add(this.b.copy(this.c).setY(this.c.y + 1.75 * rise), .25 * rise, SHADOW, rise, STAR, .2, soldier + key);
        }
      }
    }
    if (who === 'gaku' && actor.state.confirmedAt !== undefined) {
      // Landslide: once the straight has held them, the aura floods into the fist he raises over his head - "saisho
      // wa gū" - until the Rock is brought down through them.
      const charge = THREE.MathUtils.smoothstep(elapsed, move.contacts[0] + .1, finish - .15) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .15));
      // (Its light lit KOMAINU and the one he holds alike: "the glow merged the two bodies", the blind critic.)
      if (charge > .03) kit.ball(actor.handR, .2 + charge * .65, 137, NaN, colour.glow, colour.light, .6);
    }
    if (who === 'tobari') {
      // Red Moon Reverie: his red eye's glow at his eye from the cast, held through the illusion until it breaks them.
      const look = THREE.MathUtils.smoothstep(elapsed, .05, move.contacts[0]) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .2));
      if (look > .03) kit.ball(this.eye(actor, this.a), .24 * look, 113, NaN, RED_EYE, colour.light, .2);
    }
    if (who === 'ippon' && actor.state.confirmedAt !== undefined) {
      // The Clean Slate held: the fist stays where it landed and the force behind it builds until it goes off - rings
      // of air going out round the fist, quicker and wider as it comes, and the light gathering where it went in. (Its
      // lightning, a ball of ki at his hand, read as a ki blast: one punch is a fist.)
      const open = move.contacts[0];
      const build = THREE.MathUtils.smoothstep(elapsed, open + .05, finish) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .08));
      if (build > .02) {
        // Streaks of it drawn in to the fist from all round, quicker as it builds, and the air ringing in toward it -
        // a glowing ball there read as a light bulb (the blind critics).
        if (kit.ticked) {
          const r = kit.painter.rng.seed(kit.tick * 11 + key);
          // Short, close to the fist: at a metre and a half long they crossed the screen as "red laser-like rays
          // shooting from his fist", and he looked shot rather than powering up (the blind critics).
          for (let i = 0; i < 2; i++) {
            this.c.set(r.signed(), r.signed() * .7, r.signed()).normalize();
            this.b.copy(actor.handR).addScaledVector(this.c, .38 + r.next() * .3);
            this.tip.copy(actor.handR).addScaledVector(this.c, .1);
            this.beam(this.b, this.tip, time, kit.tick * 3 + i + key, .012 + build * .014, SERIOUS, .1);
          }
        }
        const period = .3 - .14 * build, phase = Math.max(0, elapsed - open) / period;
        for (let i = 0; i < 2; i++) {
          const u = (phase + i * .5) % 1;
          kit.glows.add(actor.handR, .9 - u * .75, SERIOUS, u * (.35 + build * .6), RING, .25, (key + i) % 97);
        }
        kit.glows.add(actor.handR, .08 + build * .12, SERIOUS, .4 + build * .6, GLOW, .3, key % 97);
        // And the dust over the floor is drawn in toward him, quicker as it builds.
        if (kit.ticked && kit.tick % 2 === 0) {
          const r = kit.painter.rng.seed(kit.tick * 7 + key), angle = r.next() * Math.PI * 2, out = 1.8 + r.next() * 1.2, floor = actor.group.position.y;
          const x = actor.group.position.x + Math.sin(angle) * out, z = actor.group.position.z + Math.cos(angle) * out, pull = 2 + build * 4;
          VfxKit.for(this.scene).puff(x, floor + .1, z, -Math.sin(angle) * pull, .1, -Math.cos(angle) * pull, .5 + r.next() * .3, time, .45, .5);
        }
      }
    }
    if (who === 'jirenga') {
      // The Mountain-Felling Fist: his power burns in the fist he raises through the leap, until it comes down through them.
      // (At 1.3 its light, a hand's breadth from his chest, lit the whole of him white: "the ultimate erases his
      // model", the blind critic, 3 October.)
      const charge = THREE.MathUtils.smoothstep(elapsed, move.contacts[0] + .25, finish - .15) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .2));
      if (charge > .03) kit.ball(actor.handR, charge * .75, 83, NaN, colour.glow, colour.light, .6);
    }
    if (who === 'jinlin') {
      // The Drowned Sun (the shared bomb, held over his raised hand): it gathers off his fingertip, up into it, until
      // it is thrown; a flash at the hand as it goes.
      const gather = THREE.MathUtils.smoothstep(elapsed, .3, finish) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .1));
      if (gather > .03) {
        kit.ball(actor.handL, gather * .5, 89, NaN, DROWNED_SUN_RED, colour.light, .35);
        this.b.copy(actor.handL).addScaledVector(this.up, .12 + 1.5 * (.14 + .86 * Math.pow(Math.min(1, elapsed / finish), .8)) * .4);
        kit.arc(actor.handL, this.b, kit.tick * 3 + 7, .03 * gather + .01, DROWNED_SUN_RED, gather, 1, 3, .3);
      }
      if (elapsed >= finish && this.drawn.get(`${id}:thrown`) !== key) {
        this.drawn.set(`${id}:thrown`, key);
        this.flash(this.a.copy(actor.handL), 1.2, key, 1.8, DROWNED_SUN_RED, time);
      }
    }
    if (who === 'wuming') {
      // Heaven's Harvest: Rose's ki drawn out of his raised hand into a scythe through the cinematic, and swung down with
      // it into the blow - a haft out along his arm from his grip, and at its far end the blade, hooked forward and
      // back down toward him. Solid, lit Rose: round the hand as arcs it read as a halo over his body, and as arcs on
      // a haft as "only thin pink lines" (the blind critics, 3 October, three times: "no scythe in Heaven's Harvest").
      const draw = THREE.MathUtils.smoothstep(elapsed, move.contacts[0] + .3, finish - .35) * (1 - THREE.MathUtils.smoothstep(elapsed, finish + .05, finish + .3));
      if (draw > .03) {
        const grip = actor.handR;
        let slot = this.scythes.find(m => m.owner === id);
        slot ??= this.scythes.find(m => !m.owner) ?? this.scythes[0];
        slot.owner = id;
        // The haft runs on from the shoulder through the hand: up when the hands are raised, out when they swing down.
        this.axis.copy(grip).sub(this.c.copy(actor.group.position).setY(actor.group.position.y + 1.4));
        if (this.axis.lengthSq() < .01) this.axis.copy(this.up); else this.axis.normalize();
        // The blade's way out: where he faces, square to the haft (or up, if the haft points where he faces).
        this.side.copy(this.forward).addScaledVector(this.axis, -this.forward.dot(this.axis));
        if (this.side.lengthSq() < .01) this.side.copy(this.up).addScaledVector(this.axis, -this.up.dot(this.axis));
        this.side.normalize();
        this.tip.crossVectors(this.side, this.axis).normalize();
        // Held near its head, the long end below his fist, so the blade hooks forward and down just over his hand: on a
        // man's-height haft it stood over his head, out of the cinematic's close frame, and the critics saw only the
        // haft, "a straight pink blade" (seen in Chrome, 3 October).
        const length = 1.15 * draw, butt = this.b.copy(grip).addScaledVector(this.axis, -.9 * draw);
        slot.haft.matrix.makeBasis(this.tip, this.axis, this.side).scale(this.c.set(1, length, 1)).setPosition(butt);
        slot.haft.matrixWorldNeedsUpdate = true;
        const head = this.a.copy(butt).addScaledVector(this.axis, length);
        slot.blade.matrix.makeBasis(this.side, this.axis, this.tip).scale(this.c.setScalar(draw)).setPosition(head);
        slot.blade.matrixWorldNeedsUpdate = true;
        slot.haft.visible = slot.blade.visible = true;
        // Its edge crackles, and the grip burns.
        this.c.copy(head);
        for (let i = 1; i <= 6; i++) {
          const t = i / 6, bend = 1.45 * t, reach = SCYTHE_REACH * draw;
          this.b.copy(head).addScaledVector(this.side, reach * Math.sin(bend)).addScaledVector(this.axis, -.62 * reach * (1 - Math.cos(bend)));
          kit.arc(this.c, this.b, kit.tick * 5 + i * 13, .03 * draw, colour.glow, 1.4 * draw, 0, 1, .05);
          this.c.copy(this.b);
        }
        kit.ball(grip, .3 * draw, 71, NaN, colour.glow, colour.light, .3);
      } else this.hideScythe(id);
    }
    if (who === 'magatsu') {
      const s = actor.state, stop = move.timeStop!, from = move.contacts[stop.contact], to = Math.min(finish + .45, whiffGone(s));
      if (elapsed >= from - .05 && elapsed < to) {
        const inside = elapsed - from, left = to - elapsed;
        const grow = inside < 0 ? .02 : 1 - Math.pow(1 - THREE.MathUtils.clamp(inside / .35, 0, 1), 3), close = THREE.MathUtils.smoothstep(left, 0, .28);
        let anchor = this.domainAt.get(id);
        if (!anchor) { anchor = {key: NaN, at: new THREE.Vector3(), flashed: false}; this.domainAt.set(id, anchor); }
        if (anchor.key !== s.actionStarted) { anchor.key = s.actionStarted; anchor.at.copy(actor.group.position); anchor.flashed = false; }
        const at = anchor.at, open = Math.max(.02, grow * close);
        this.domain.show(id, this.a.set(at.x, at.y + 1, at.z), at.y, stop.radius, open, time, .6 + .4 * close);
        // The opening: one crimson flash out of him as the hall goes.
        if (inside >= 0 && !anchor.flashed) { anchor.flashed = true; this.flash(this.a, 2.2, key, 1.3, COLOR.magatsu.glow, time); }
        // Its cuts, everywhere in it at once: strokes of white-hot red a few at a time, each gone in a sixth of a
        // second - two kinds of cut falling on everything the dome holds.
        const strokes = Math.round(9 * Math.min(1, kit.density) * open);
        for (let i = 0; i < strokes; i++) {
          const clock = time * 6 + i * .37, slot = Math.floor(clock), age = clock - slot, r = kit.painter.rng.seed(slot * 31 + i * 7 + key);
          const yaw = r.next() * Math.PI * 2, out = Math.sqrt(r.next()) * stop.radius * .9 * open, tilt = r.signed() * 1.2, long = .7 + r.next() * 1.3;
          this.b.set(at.x + Math.sin(yaw) * out, at.y + .3 + r.next() * 2.4, at.z + Math.cos(yaw) * out);
          this.side.set(Math.cos(yaw + tilt), Math.sin(tilt) * .8, -Math.sin(yaw + tilt)).normalize();
          this.tip.copy(this.b).addScaledVector(this.side, long);
          // (Fading within a couple of metres of the lens: one swept across the camera blurs half the frame.)
          const near = this.seeing ? THREE.MathUtils.smoothstep(this.b.distanceTo(this.lens), 1.2, 2.6) : 1;
          if (near > .02) kit.arc(this.b.addScaledVector(this.side, -long), this.tip, slot * 13 + i, .032, CUT_RED, 1.9 * (1 - age) * near, 0, 1, .02);
        }
        // (Its red on the bodies inside it kept low: at a third of this it still drew Imago as one flat cream figure.)
        kit.lights.add(this.a, stop.radius * 1.1, COLOR.magatsu.light, .1 * open);
      } else this.domainAt.delete(id);
      const victim = actor.state.target ? fighters.get(actor.state.target) : undefined;
      const hands = this.b.copy(actor.handL).lerp(actor.handR, .5);
      const aim = victim ? this.c.copy(victim.group.position).setY(victim.group.position.y + 1.1) : this.c.copy(hands).addScaledVector(this.forward, 4);
      this.axis.subVectors(aim, hands);
      const span = this.axis.length();
      if (span > 1e-3) this.axis.divideScalar(span); else this.axis.copy(this.forward);
      const draw = THREE.MathUtils.smoothstep(elapsed, move.contacts[move.contacts.length - 2] + .05, finish - .2) * (1 - THREE.MathUtils.smoothstep(elapsed, finish - .15, finish - .12));
      if (draw > .03) {
        kit.ball(hands, draw * .8, 41, NaN, FIRE, FIRE_LIGHT, .5);
        // The arrow nocked: a shaft of fire along the aim, from behind his drawing hand to its head past the bow hand.
        this.tip.copy(hands).addScaledVector(this.axis, -.5);
        this.side.copy(hands).addScaledVector(this.axis, 1.1);
        kit.arc(this.tip, this.side, kit.tick * 3 + 41, .05 * draw, FIRE, 1.6 * draw, 0, 1, .02);
        for (let j = 0; j < 10 && this.flameCount < FLAMES; j++) {
          const t = j / 9;
          this.flame(this.tip.copy(hands).addScaledVector(this.axis, -.5 + t * 1.6), j * 1.7, time + j, .18 * draw, (.3 + .25 * (1 - Math.abs(t - .5) * 2)) * draw, .95, (j * .137) % 1, FLAME_FIRE);
        }
      }
      const fly = (elapsed - (finish - .14)) / .14;
      if (fly > 0 && fly < 1) {
        const head = this.tip.copy(hands).lerp(aim, fly);
        this.side.copy(head).addScaledVector(this.axis, -1.8);
        kit.arc(this.side, head, kit.tick * 3 + 43, .16, FIRE, 2.6, 0, 1, .03);
        for (let j = 0; j < 20 && this.flameCount < FLAMES; j++) {
          const t = j / 19;
          this.flame(this.side.copy(head).addScaledVector(this.axis, -t * 2.8), j * 1.3, time + j, .5 * (1 - t * .6), .75 * (1 - t * .5), .95 - t * .4, (j * .17) % 1, FLAME_FIRE);
        }
        kit.ball(head, .6, 43, NaN, FIRE, FIRE_LIGHT, .45);
        kit.lights.add(head, 4, FIRE_LIGHT, .8);
      }
      // Where it lands, the floor burns round where they stood, held there while they are thrown.
      if (elapsed < finish) this['calamity-pyre'].delete(id);
      else if (elapsed < finish + 1.1) {
        let at = this['calamity-pyre'].get(id);
        if (!at && victim) { at = victim.group.position.clone(); this['calamity-pyre'].set(id, at); }
        if (at) {
          const burn = 1 - (elapsed - finish) / 1.1;
          this.flameField(at, 3, Math.min(1, (elapsed - finish) * 6), burn, time, FLAME_FIRE, Math.round(110 * Math.min(1, kit.density)), 1.6);
          kit.lights.add(this.side.copy(at).setY(at.y + 1), 5, FIRE_LIGHT, .9 * burn);
        }
      }
    }
    if (who === 'shiun') {
      // BLACK CONFESSIONAL: the pressure gathers in the hand he points with until the coffin closes.
      const cast = THREE.MathUtils.smoothstep(elapsed, .05, move.contacts[0]) * (1 - THREE.MathUtils.smoothstep(elapsed, move.contacts[0], move.contacts[0] + .25));
      if (cast > .03) kit.ball(actor.handR, cast * .7, 37, NaN, colour.glow, colour.light, .5);
      // The coffin: once the opener holds them, its black walls come in round them and the lid down on them, shut
      // until the blow, which bursts it outward. (A see-through dome before - "BLACK CONFESSIONAL's black coffin is a faint
      // see-through bubble", the blind critic, 3 October.)
      const victim = actor.state.target ? fighters.get(actor.state.target) : undefined;
      const shut = THREE.MathUtils.smoothstep(elapsed, move.contacts[0], move.contacts[0] + .45), burst = THREE.MathUtils.clamp((elapsed - finish) / .3, 0, 1);
      if (victim && actor.state.confirmedAt !== undefined && elapsed >= move.contacts[0] && burst < 1) {
        let slot = this.coffins.find(m => m.owner === id);
        slot ??= this.coffins.find(m => !m.owner) ?? this.coffins[0];
        slot.owner = id;
        const centre = this.c.copy(victim.group.position).setY(victim.group.position.y + 1.25), yaw = actor.state.yaw;
        const out = 1 + (1 - shut) * 2.4 + burst * 1.6, cos = Math.cos(yaw), sin = Math.sin(yaw);
        slot.slabs.forEach((slab, i) => {
          const [, , , x, y, z] = COFFIN_SLABS[i];
          // The lid comes down from above; the walls in from round them.
          const lift = i === 4 ? (1 - shut) * 2.2 + burst * 1.2 : 0;
          slab.position.set(centre.x + (x * cos + z * sin) * out, centre.y + y + lift, centre.z + (z * cos - x * sin) * out);
          slab.rotation.set(0, yaw, 0); slab.visible = true;
        });
        const opacity = Math.min(1, shut * 1.4) * (1 - burst);
        slot.material.uniforms.uOpacity.value = opacity; slot.material.uniforms.uTime.value = time;
        // Solid once shut: it writes depth, so the walls hide who is inside and each other's far sides.
        slot.material.depthWrite = opacity > .98;
      } else this.hideCoffin(id);
    }
    if (who === 'gorai' || who === 'sorrel' || who === 'dorado' || who === 'vesper') {
      // The charge crawls along the weapon from the hand to its end, building to the blow.
      const charge = THREE.MathUtils.smoothstep(elapsed, .2, finish - .1) * (1 - THREE.MathUtils.smoothstep(elapsed, finish + .05, finish + .35));
      if (charge > .03) {
        actor.strikePoint(this.tip);
        kit.arc(actor.handR, this.tip, kit.tick * 5 + 1, .045 * charge + .01, colour.glow, charge, 2, 3, .3);
        kit.arc(actor.handR, this.tip, kit.tick * 5 + 2, .03 * charge + .008, colour.glow, charge * .8, 1, 3, .38);
        kit.ball(this.tip, charge * .9, who === 'gorai' ? 17 : who === 'sorrel' ? 19 : who === 'vesper' ? 43 : 29, NaN, colour.glow, colour.light, .5);
      }
    }
  }

  /** The pools, aged and drawn. */
  private draw(time: number, fighters: ReadonlyMap<string, Fighter>, density: number) {
    const kit = this.kit;
    for (const [id, held] of this.decoys) { held.decoy.update(time); if (!fighters.has(id)) { held.decoy.dispose(); this.decoys.delete(id); } }
    for (const cut of this.cuts) {
      if (!cut.active) continue;
      const age = time - cut.since;
      if (age > cut.seconds) { cut.active = false; cut.mesh.visible = false; continue; }
      cut.mesh.material.uniforms.uFade.value = age < 0 ? 0 : 1 - THREE.MathUtils.smoothstep(age, .05, cut.seconds);
      cut.mesh.material.uniforms.uClock.value = time;
    }
    for (const crack of this.cracks) {
      if (!crack.active) continue;
      const age = time - crack.since;
      if (age > crack.seconds) { crack.active = false; continue; }
      // The glass breaks at once and goes dark slowly: the lines hold their shape (a fixed seed), only fading.
      const life = Math.max(0, age) / crack.seconds, strength = (1 - life) * (age < .06 ? 1.6 : 1);
      this.side.crossVectors(crack.normal, Math.abs(crack.normal.y) > .9 ? this.axis.set(1, 0, 0) : this.up).normalize();
      this.c.crossVectors(this.side, crack.normal).normalize();
      const n = Math.max(4, Math.round(crack.count * Math.min(1, density)));
      for (let i = 0; i < n; i++) {
        const r = kit.painter.rng.seed(crack.seed * 131 + i * 17);
        const angle = (i / n) * Math.PI * 2 + r.signed() * .35, length = crack.reach * (.45 + .55 * r.next()) * (.75 + .25 * Math.min(1, age * 12));
        this.a.copy(crack.center).addScaledVector(this.side, Math.cos(angle) * length).addScaledVector(this.c, Math.sin(angle) * length);
        kit.arc(crack.center, this.a, crack.seed * 7 + i, .022 * strength + .006, crack.color, strength, 2, 3, .5);
      }
      // Its star and ring sized with it: the same 0.9 m star and 1.4 m ring at every crack, a blow's small one too, sat
      // over whoever was hit - "a starburst the size of his torso ... you never see fist meet body" (the blind critics).
      // (The dream loop, 22 October 2026: the hit's own burst is the star now - VfxKit.szImpact, at the contact - and this
      // one, a pink-white orb ringed over the victim's chest, hid the launch under it. The cracks' lightning stays.)
      const size = Math.min(1, crack.reach / 2.2);
      if (!DREAM_IMPACT) {
        kit.glows.add(crack.center, .9 * strength * size, crack.color, strength, STAR, .2, crack.seed);
        if (age < .25) kit.glows.add(crack.center, 1.4 * (1 - age * 3) * size, crack.color, .8, RING, .06, crack.seed, .35 + age * 2);
      }
    }
    for (const ring of this.rings) {
      if (!ring.active) continue;
      const age = time - ring.since;
      if (age > RING_SECONDS) { ring.active = false; ring.mesh.visible = false; continue; }
      const life = Math.max(0, age) / RING_SECONDS;
      ring.mesh.scale.setScalar(.2 + ring.radius * (1 - (1 - life) * (1 - life)));
      ring.mesh.material.opacity = (1 - life) * .9 * Math.min(1, density + .3);
    }
    for (const dome of this.domes) {
      if (!dome.active) continue;
      const age = time - dome.since;
      if (age > dome.seconds) { dome.active = false; dome.mesh.visible = false; continue; }
      const actor = fighters.get(dome.actorId);
      if (actor) dome.mesh.position.copy(actor.group.position).setY(actor.group.position.y + dome.lift);
      const open = THREE.MathUtils.smoothstep(age, 0, DOME_OPEN), close = 1 - THREE.MathUtils.smoothstep(age, dome.seconds * .55, dome.seconds);
      dome.mesh.scale.setScalar(Math.max(.05, dome.radius * open));
      dome.mesh.material.uniforms.uTime.value = time; dome.mesh.material.uniforms.uOpacity.value = .55 * close;
    }
    for (const strike of this.strikes) {
      if (!strike.active) continue;
      const age = time - strike.since;
      if (age > STRIKE_SECONDS) { strike.active = false; continue; }
      const life = Math.max(0, age) / STRIKE_SECONDS, strength = (1 - life) * (1 - life);
      const victim = strike.targetId ? fighters.get(strike.targetId) : undefined;
      if (victim && strike.kind === 'sky') strike.center.copy(victim.group.position).setY(victim.group.position.y + 1.1);
      if (strike.kind === 'sky') {
        // TIMBER: The Forest Falls: three bolts out of the sky onto the body, and the discharge.
        const colour = COLOR.gorai;
        for (let i = 0; i < 3; i++) {
          const r = kit.painter.rng.seed(strike.seed * 11 + i * 29 + kit.tick);
          this.a.set(r.signed() * 1.6, 7 + r.next() * 3, r.signed() * 1.6).add(strike.center);
          kit.arc(this.a, strike.center, strike.seed + i * 3 + kit.tick, .08 * strength + .02, colour.glow, strength * 1.4, 3, 4, .32);
        }
        kit.flash(strike.center, Math.min(1.4, strength * 1.6), strike.seed % 97, 2.2 + life, colour.glow);
      } else {
        // The lightning over the floor, out from the point: Crimson Command's black and red (Sorrel, Dorado), or the
        // strike's own colour.
        const colour = strike.color, n = Math.max(6, Math.round(12 * Math.min(1, density))), will = colour === WILL_RED;
        for (let i = 0; i < n; i++) {
          const r = kit.painter.rng.seed(strike.seed * 13 + i * 37);
          const angle = (i / n) * Math.PI * 2 + r.signed() * .3, reach = (2.2 + r.next() * 2.4) * (.4 + .6 * Math.min(1, age * 8));
          this.a.set(Math.cos(angle) * reach, .05 + r.next() * .4, Math.sin(angle) * reach).add(strike.center);
          if (will) this.willBolt(strike.center, this.a, strike.seed + i * 5 + kit.tick, .06 * strength + .015, strength * 1.2, 1);
          else kit.arc(strike.center, this.a, strike.seed + i * 5 + kit.tick, .03 * strength + .008, colour, strength * 1.2, 2, 3, .42);
        }
        kit.flash(strike.center, Math.min(1.2, strength * 1.3), strike.seed % 97, 1.6, colour);
      }
    }
    for (const flash of this.flashes) {
      if (!flash.active) continue;
      const age = time - flash.since;
      if (age > FLASH_SECONDS) { flash.active = false; continue; }
      const life = Math.max(0, age) / FLASH_SECONDS;
      if (flash.soft) this.softFlash(flash.center, flash.strength * (1 - life) * (1 - life), flash.seed, flash.reach, flash.color);
      else kit.flash(flash.center, flash.strength * (1 - life) * (1 - life), flash.seed, flash.reach, flash.color);
    }
    this.drawDazes(time, fighters);
    for (const beam of this.beams) {
      if (!beam.active) continue;
      const age = time - beam.since;
      if (age < 0) continue;
      if (age > beam.seconds) { beam.active = false; continue; }
      // Straight and thin, at full strength the moment it fires, and gone as quick: a pinpoint, not a stream.
      const strength = 1 - age / beam.seconds;
      kit.arc(beam.from, beam.to, beam.seed, beam.width * (.45 + .55 * strength), beam.color, 1.7 * strength, 0, 1, .015);
      kit.glows.add(beam.from, .16 * strength, beam.color, strength, STAR, .2, beam.seed % 97);
      kit.glows.add(beam.to, .32 * strength, beam.color, strength, STAR, .2, (beam.seed + 5) % 97);
    }
  }

  /** A discharge without lightning (`flash`'s `soft`): the electric kit's glare, its ring and its light, no bolts. */
  private softFlash(center: THREE.Vector3, strength: number, seed: number, reach: number, color: THREE.Color) {
    if (strength < .02) return;
    const kit = this.kit;
    kit.glows.add(center, .75 * strength, color, 1, STAR, .2, seed);
    kit.glows.add(center, .55 * reach * strength, color, .8, RING, .06, seed, .35 + .5 * (1 - strength));
    kit.halos.add(center, 1.2 * strength, this.softTint.copy(color).multiplyScalar(.45), .55 * strength, GLOW, .1);
    kit.lights.add(center, 3.4 * strength, this.softTint.copy(color).multiplyScalar(.5), .7 * strength);
  }
  /** The stuns' dazes: three stars of the element circling the head of whoever a string's stun holds, for as long as
   *  it holds them (DIZZY_SECONDS), and lightning's crawling over them; gone the moment they are out of it. */
  private drawDazes(time: number, fighters: ReadonlyMap<string, Fighter>) {
    const kit = this.kit;
    for (const d of this.dazes) {
      if (!d.active) continue;
      const victim = fighters.get(d.targetId), age = time - d.since;
      if (age < -.05) continue;
      if (!victim || !victim.state.alive || age > DIZZY_SECONDS + .1 || age > .3 && victim.state.action !== 'stun') { d.active = false; continue; }
      const head = victim.joints.get('Head');
      if (head) head.getWorldPosition(this.m4); else this.m4.copy(victim.group.position).setY(victim.group.position.y + 1.7);
      this.m4.y += .3;
      const fade = Math.min(1, Math.max(0, age) / .12) * (1 - THREE.MathUtils.smoothstep(age, DIZZY_SECONDS - .25, DIZZY_SECONDS + .1));
      for (let i = 0; i < 3; i++) {
        const a = time * 5.5 + i * 2.094;
        this.m3.set(this.m4.x + Math.cos(a) * .32, this.m4.y + Math.sin(a * 2 + i) * .05, this.m4.z + Math.sin(a) * .32);
        kit.glows.add(this.m3, .14, d.glow, fade, STAR, .25, (d.seed + i * 7 + kit.tick) % 97);
      }
      kit.glows.add(this.m4, .42, d.glow, .3 * fade, RING, .05, d.seed, .55);
      if (d.electric && kit.ticked && (kit.tick + d.seed) % 3 === 0) {
        const r = kit.painter.rng.seed(kit.tick * 17 + d.seed);
        this.m3.set(this.m4.x + r.signed() * .3, this.m4.y - .2 - r.next() * 1.2, this.m4.z + r.signed() * .3);
        this.m1.set(this.m4.x + r.signed() * .3, this.m4.y - .1 - r.next() * .6, this.m4.z + r.signed() * .3);
        kit.arc(this.m3, this.m1, kit.tick + d.seed, .02 * fade, d.glow, fade, 1, 3, .35);
      }
    }
  }

  reset() {
    this.seen.clear(); this.drawn.clear(); this.enderDrawn.clear(); this.enderHit.clear(); this.enderAt.clear();
    for (const d of this.dazes) d.active = false;
    for (const cut of this.cuts) { cut.active = false; cut.mesh.visible = false; }
    for (const crack of this.cracks) crack.active = false;
    for (const ring of this.rings) { ring.active = false; ring.mesh.visible = false; }
    for (const dome of this.domes) { dome.active = false; dome.mesh.visible = false; }
    for (const strike of this.strikes) strike.active = false;
    for (const flash of this.flashes) flash.active = false;
    for (const beam of this.beams) beam.active = false;
    this.fields.clear(); this.flames.count = 0;
    for (const m of this.meteors) { m.mesh.visible = false; m.owner = ''; }
    for (const m of this.scythes) { m.haft.visible = m.blade.visible = false; m.owner = ''; }
    for (const m of this.coffins) { for (const slab of m.slabs) slab.visible = false; m.owner = ''; }
    for (const m of this.gunbais) { m.fan.visible = false; m.owner = ''; }
    this.domain.reset(); this.domainAt.clear();
    for (const held of this.decoys.values()) held.decoy.reset();
    for (const whirl of this.whirls.values()) whirl.hide();
    this.crows?.reset(); this.crowsAt = NaN;
    for (const clone of this.clones.values()) clone.reset();
    for (const actor of [...this.formed.keys()]) this.unform(actor);
    this.signatures = [];
    this['calamity-pyre'].clear();
    for (const f of this.hidden) f.group.visible = true;
    this.hidden.clear();
    this.kit.reset();
    this.finales?.reset();
  }

  dispose() {
    this.reset();
    this.finales?.dispose();
    for (const cut of this.cuts) { cut.mesh.removeFromParent(); cut.mesh.material.dispose(); }
    for (const ring of this.rings) { ring.mesh.removeFromParent(); ring.mesh.material.dispose(); }
    for (const dome of this.domes) { dome.mesh.removeFromParent(); dome.mesh.material.dispose(); }
    this.flames.removeFromParent(); this.flames.geometry.dispose(); this.flameMaterial.dispose();
    for (const m of this.meteors) { m.mesh.removeFromParent(); (m.mesh.material as THREE.Material).dispose(); }
    this.meteors[0]?.mesh.geometry.dispose();
    for (const m of this.scythes) for (const mesh of [m.haft, m.blade]) { mesh.removeFromParent(); (mesh.material as THREE.Material).dispose(); }
    this.ink.dispose();
    for (const m of this.coffins) { for (const slab of m.slabs) { slab.removeFromParent(); slab.geometry.dispose(); } m.material.dispose(); }
    this.domain.dispose();
    for (const held of this.decoys.values()) held.decoy.dispose(); this.decoys.clear();
    for (const whirl of this.whirls.values()) whirl.dispose(); this.whirls.clear();
    this.crows?.dispose(); this.crows = undefined;
    for (const clone of this.clones.values()) clone.dispose(); this.clones.clear(); this.warmDecoy?.dispose(); this.warmDecoy = undefined; this.warmWhirl?.dispose(); this.warmWhirl = undefined;
    for (const m of this.gunbais) { m.fan.removeFromParent(); m.fan.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); } }); }
    this.scythes[0]?.haft.geometry.dispose(); this.scythes[0]?.blade.geometry.dispose();
    this.cutGeometry.dispose(); this.ringGeometry.dispose(); this.sphere.dispose();
    for (const shell of this.allShells) shell.dispose(); this.allShells = [];
    this.vfx?.release(); this.vfx = undefined;
    this.kit.dispose();
  }
}
