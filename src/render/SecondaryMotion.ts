import * as THREE from 'three';
import type { FighterId } from '../game/types';
import { LegCapsules, type GarmentCollide } from './look/garmentCollide';
import { HemDrape } from './look/hemDrape';
import { applyOriginalSprings } from '../originals/apply';

export interface SpringProfile {
  /** How fast the tail is pulled back onto its authored direction (1/s). */
  stiffness:number;
  /** Fraction of the previous frame's motion carried forward. 0..1. */
  drag:number;
  /** Downward bias in metres per second squared. */
  gravity:number;
  /** Largest angle the bone may bend away from its authored direction, degrees. */
  maxAngle:number;
  /** The stiffness a chain's last link keeps, as a share of its first's; the
   *  links between are graded. Below 1 the tip trails and curls behind a root
   *  that follows the body, where one stiffness for the whole chain bent it
   *  as one plank from the shoulder. Default 1. */
  tipLoose?:number;
  /** Chains of one garment answer a little apart: each chain's stiffness is
   *  scaled by 1 +/- this, fixed per chain. A cape whose chains all lag alike
   *  swings as one rigid sheet. Default 0. */
  spread?:number;
  authored?:number;
  /** Round 5b (RIG): where the cone turns soft, as a share of maxAngle. Past it a swing is eased toward the cone (tanh)
   *  instead of stopped flat on it, so a garment thrown hard keeps moving inside the last part of its cone rather than
   *  pinning on the edge as a board; it still never reaches maxAngle. 1 is the old hard stop. Default SOFT. */
  soft?:number;
  /** Round 5b (RIG): the air on cloth - the share of its own motion a link loses each 60 Hz frame. Set, the step is
   *  predict-then-pull: the link carries its motion (less the air, and with its motion RELATIVE to its target's damped
   *  by `drag`), and the pull then closes `stiffness` of the gap left. At a steady run it hangs back by
   *  (1 - pull) × trail × the distance a frame covers / pull, and a body's bounce reaches it scaled by drag × (1 - pull).
   *  Unset, the old step, which pulled toward this frame's target from where the link was before it moved: at a run
   *  that bias held hair and short tails the same distance off the clip whatever their length, pinned on their cones,
   *  and its only damping was the air. */
  trail?:number;
  /** Round 5b (RIG): a ripple down each chain while the body travels, as a share of the cone at a run's speed (none
   *  standing): cloth flapping in the wind of a run, so a cape trailing at speed does not ride as one still sheet.
   *  Default 0. */
  flutter?:number;
  /** Round 5b (NIGO2): a body whose garments differ - a long coat, short
   *  hair, sash ties - gives each its own settings: the first entry whose
   *  pattern matches a bone's name overrides the profile for that bone. */
  chains?:{match:RegExp;profile:Partial<Omit<SpringProfile,'chains'>>}[];
  /** Keep these links out of the legs and off the floor (look/garmentCollide.ts). */
  legs?:GarmentCollide;
  /** How much of a chain's first link hangs from the fighter's root - its
   *  direction as handed over, turning only with his heading - rather than
   *  from the bone it hangs off, 0..1. A long coat hung off the pelvis stood
   *  out behind a lunge like a plate; cloth hangs toward the floor. */
  hang?:number;
  /** The furthest any link of the chain may rise from straight down, degrees, wherever its parent points: a long
   *  coat swings and trails, it does not spin out into a disc. Legs and the floor may still push it past. */
  droop?:number;
  /** Not sprung at all (a rig's own chains that carry nothing on this body). */
  off?:boolean;
  bones?:RegExp;
  launched?:LaunchedChain;
}
export interface LaunchedChain {stiffness?:number;gravity?:number;maxAngle?:number;hang?:number;droop?:number;trail?:number;flutter?:number;tipLoose?:number;
  /** How far each link turns toward the way the air sweeps it - behind the body's flight, and a little toward the floor - as a
   *  share of its cone. Link on link it adds up, so a chain curls into an arc that trails the flight rather than riding the
   *  hips as one straight plank; the springs are too stiff for a force to bend it (see the aura's lift). */
  sweep?:number;
  /** More of the same turn, as a share of the cone, for a link its clip has turned upside down (an upturned body's coat). */
  curl?:number}
const LAUNCH_IN=14,LAUNCH_OUT=6,LAUNCH_SAG=6;
const LAUNCH_UPSIDE=.15,LAUNCH_UPRIGHT=.75;
const _sweepAxis=new THREE.Vector3(),_sweepTurn=new THREE.Quaternion();
/** Round 5b (RIG): the default soft start of every cone (see `soft`). */
const SOFT=.6;
/** Round 5b (RIG): the run speed the flutter is measured against (the simulation's 7.5 m/s), and its rate there. */
const FLUTTER_SPEED=7.5,FLUTTER_HZ=2.6;

// Low stiffness is the point: the tail has to fall several frames behind the
// body for the lag to be visible at all.
const DEFAULT_PROFILE:SpringProfile={stiffness:16,drag:.86,gravity:3,maxAngle:34};

// Heavy cloth swings wider and settles slower; hair and ties are lighter and
// stiffer. These are per fighter because the garments differ that much.
export const SPRING_PROFILES:Partial<Record<FighterId|'nightfall',Partial<SpringProfile>>>={
  // Aqrab's reviewed native clips already pose the cape and hair. Added springs
  // reopen its corrected coat panels; preserve that authored silhouette exactly.
  aqrab:{authored:1,chains:[{match:/.*/,profile:{off:true}}]},
  // Both native Barrow costumes already key their coats; keep added lag bounded.
  ume:{stiffness:32,drag:.65,gravity:2.4,maxAngle:10,tipLoose:.6,spread:.22,authored:.82,trail:.04,flutter:.07},
  lanthorn:{stiffness:32,drag:.65,gravity:2.4,maxAngle:10,tipLoose:.6,spread:.22,authored:.82,trail:.04,flutter:.07},
  highsun:{stiffness:32,drag:.65,gravity:2.4,maxAngle:10,tipLoose:.6,spread:.22,authored:.82,trail:.04,flutter:.07},
  torsion:{stiffness:34,drag:.7,gravity:1.4,maxAngle:7,tipLoose:.4,spread:.12,authored:.94,trail:.02,flutter:.03},
  kubiwa:{stiffness:34,drag:.7,gravity:1.4,maxAngle:7,tipLoose:.4,spread:.12,authored:.94,trail:.02,flutter:.03},
  onigawara:{stiffness:32,drag:.7,gravity:1.4,maxAngle:7,tipLoose:.4,spread:.12,authored:.94,trail:.02,flutter:.03},
  cardo:{stiffness:32,drag:.7,gravity:1.4,maxAngle:7,tipLoose:.4,spread:.12,authored:.94,trail:.02,flutter:.03},
  minase:{stiffness:34,drag:.7,gravity:1.4,maxAngle:7,tipLoose:.4,spread:.12,authored:.94,trail:.02,flutter:.03,bones:/^(Left|Right)Coat(Back|Front|Side)[12]$/,chains:[
    {match:/Coat(Back|Front|Side)[12]$/,profile:{stiffness:28,drag:.62,gravity:2.4,maxAngle:14,tipLoose:.7,spread:.2,hang:.35,trail:.05,flutter:.14,legs:{thigh:.13,shin:.11,floor:.015},droop:80}},
  ]},
  shanxiao:{stiffness:30,drag:.7,gravity:1.6,maxAngle:8,tipLoose:.5,spread:.1,trail:.02,flutter:.02,bones:/^Pelt_\d+_\d+$/,chains:[
    {match:/^Pelt_/,profile:{stiffness:24,drag:.6,gravity:2.6,maxAngle:14,tipLoose:.6,spread:.35,hang:.8,trail:.03,flutter:.06,legs:{thigh:.2,shin:.14,floor:.02},droop:34}},
  ]},
  ampere:{stiffness:30,drag:.7,gravity:1.6,maxAngle:8,tipLoose:.5,spread:.1,trail:.02,flutter:.02,bones:/^Cape_\d_\d$/,chains:[
    {match:/^Cape_/,profile:{stiffness:24,drag:.6,gravity:2.6,maxAngle:16,tipLoose:.6,spread:.2,hang:.8,trail:.05,flutter:.1,legs:{thigh:.13,shin:.11,floor:.015},droop:35}},
  ]},
  'psyche':{stiffness:40,drag:.9,gravity:0,maxAngle:.015,tipLoose:0,spread:0,authored:.99,trail:0,flutter:0},
  'ovid':{stiffness:45,drag:.88,gravity:0,maxAngle:.02,tipLoose:0,spread:0,authored:.99,trail:0,flutter:0},
  hawser:{stiffness:42,drag:.86,gravity:.02,maxAngle:.03,tipLoose:.01,spread:0,authored:.98,trail:0,flutter:0},
  rotfalke:{stiffness:48,drag:.86,gravity:0,maxAngle:0,tipLoose:0,spread:0,authored:1,trail:0,flutter:0},
  bonsho:{stiffness:38,drag:.83,gravity:.04,maxAngle:.04,tipLoose:.02,spread:.01,authored:.95,trail:.01,flutter:0},
  murex:{stiffness:48,drag:.86,gravity:0,maxAngle:0,tipLoose:0,spread:0,authored:1,trail:0,flutter:0},
  kinu:{stiffness:48,drag:.86,gravity:0,maxAngle:0,tipLoose:0,spread:0,authored:1,trail:0,flutter:0},
  'madake':{stiffness:48,drag:.86,gravity:0,maxAngle:0,tipLoose:0,spread:0,authored:1,trail:0,flutter:0},
  akayuri:{stiffness:30,drag:.8,gravity:1.5,maxAngle:14,tipLoose:.5,spread:.12,authored:0,trail:.02,flutter:.02,bones:/^head0(0[4-9]|[1-7]\d)$/},
  hagure:{stiffness:42,drag:.82,gravity:1,maxAngle:4,tipLoose:.18,spread:.04,authored:.98,trail:.01,flutter:0},
  // 15 October 2026 ("rxa", CLOTH-BOARD): her hair hangs on a chain under the head (head003_14 > head005_13 > head007_12, then
  // left and right strands: names DYNAMIC does not know, so nothing sprang them), and her clips key its root out behind as
  // a flag (17 degrees standing, 30 running, 60 in the walk and the dash, 116 struck, 176 launched): a rigid sheet standing
  // out horizontally. The clips' turn is dropped (`authored`, read off the profile: the hair is all that is sprung) and the
  // chain hangs as modelled off the head, sprung within a small cone. 16 October ("rxp2", the re-audit: CLOTH-BOARD, from
  // behind one rigid tent in every frame, and a flat banner standing out with the head in the hit and the launch): the trunk
  // of the chain hangs mostly from her root, not her head (`hang`), so a head thrown back does not throw the panel out with
  // it, and no link rises past 40 degrees off straight down; the left and right strands are looser and lag apart (`spread`,
  // a softer tip, a little flutter at a run), so the panel bends and swings as hair instead of standing as one board.
  // 16 October ("rmodel", still one tent from behind: the mesh is one panel): below the nape the panel is cut into four
  // strands, each on a three-link chain off the head (Strand_<strand>_<link>, scripts/night/rmodel/hisame_hair.py), each
  // sprung on its own (`spread` tells them apart: they hang off the head, not off one chain); the old fans carry nothing.
  hisame:{stiffness:30,drag:.8,gravity:1.5,maxAngle:14,tipLoose:.5,spread:.12,authored:0,trail:.02,flutter:.02,bones:/^(head00\d_|Strand_\d_\d$)/,chains:[
    {match:/^head00[357]_1\d$/,profile:{stiffness:32,maxAngle:12,hang:.6,droop:40}},
    {match:/^head007_[LR]/,profile:{off:true}},
    {match:/^Strand_/,profile:{stiffness:22,drag:.66,gravity:2.2,maxAngle:22,tipLoose:.75,spread:.35,hang:.6,trail:.04,flutter:.1,droop:40}},
  ]},
  mizuhiki:{stiffness:42,drag:.78,gravity:1.2,maxAngle:6,tipLoose:.30,spread:.08,authored:.95,trail:.02,flutter:.01},
  'shibuichi':{stiffness:42,drag:.78,gravity:1.2,maxAngle:8,tipLoose:.30,spread:.08,authored:.9,trail:.02,flutter:.01},
  'rakucho':{stiffness:38,drag:.76,gravity:.8,maxAngle:5,tipLoose:.30,spread:.08,authored:.98,trail:.02,flutter:.01},
  irbis:{stiffness:35,drag:.74,gravity:1.1,maxAngle:7,tipLoose:.36,spread:.1,authored:.95,trail:.03,flutter:.02},
  shidare:{stiffness:38,drag:.72,gravity:1.2,maxAngle:6,tipLoose:.35,spread:.1,authored:.95,trail:.02,flutter:.02},
  // Native Yodaka haori and hair already have authored secondary motion.
  yodaka:{stiffness:44,drag:.84,gravity:.8,maxAngle:3,tipLoose:.12,spread:.03,authored:1,trail:.01,flutter:0},
  hinomoto:{stiffness:38,drag:.72,gravity:1.2,maxAngle:6,tipLoose:.35,spread:.1,authored:.95,trail:.02,flutter:.02},
  amagoi:{stiffness:38,drag:.72,gravity:1.2,maxAngle:6,tipLoose:.35,spread:.1,authored:.95,trail:.02,flutter:.02},
  'shakudo':{stiffness:38,drag:.72,gravity:1.2,maxAngle:6,tipLoose:.35,spread:.1,authored:.95,trail:.02,flutter:.02},
  hikui:{stiffness:32,drag:.65,gravity:2.4,maxAngle:10,tipLoose:.6,spread:.22,authored:.82,trail:.04,flutter:.07},
  tokan:{stiffness:32,drag:.65,gravity:2.4,maxAngle:10,tipLoose:.6,spread:.22,authored:.82,trail:.04,flutter:.07},
  strappado:{stiffness:32,drag:.65,gravity:2.4,maxAngle:10,tipLoose:.6,spread:.22,authored:.82,trail:.04,flutter:.07},
  barrow:{stiffness:32,drag:.65,gravity:2.4,maxAngle:12,tipLoose:.6,spread:.25,authored:.8,trail:.05,flutter:.08},
  hakushi:{stiffness:44,drag:.48,gravity:1.8,maxAngle:12,chains:[{match:/^Hemline_/,profile:{off:true}}]},
  // Retuned for the replacement rigs: these carry long
  // hair off the head and hakama chains off the legs, which sway far more than
  // the old robe panels did.
  // Nigo: the first body's own hair and coat-tail chains (keyed by its clips) are left to the clips.
  nigo:{stiffness:42,drag:.8,gravity:3,maxAngle:32,chains:[
    {match:/^Detail_CLOTH_Bone/,profile:{off:true}},
  ]},
  nightfall:{stiffness:38,drag:.81,gravity:3.2,maxAngle:32},
  kosho:{stiffness:20,drag:.4,gravity:2.6,maxAngle:28,trail:.1},
  konta:{stiffness:11,drag:.55,gravity:6,maxAngle:80,trail:.16,tipLoose:.7,spread:.15,droop:95,flutter:.3,chains:[
    {match:/^hair_|^acce\d|_sleeve$|^Detail_CLOTH_ponytail01$/,profile:{off:true}},
    {match:/_wear$/,profile:{stiffness:28,drag:.6,gravity:2,maxAngle:10,trail:.06,flutter:.1,droop:180}},
  ]},
  // Shirokane's chains are his hair: four two-link chains of 8 cm growing up
  // from the hairline (scripts/roster_cloth.py, hair recipe). Hair spikes bob,
  // they do not swing, so the cone is tight and the pull is fast.
  shirokane:{stiffness:40,drag:.4,gravity:1.5,maxAngle:8,trail:.04},
  // KoKo's chains are the coat skirt under the belt, hung off the pelvis
  // instead of the thighs. The panels sit a few centimetres off the trousers,
  // so the cone is tighter than the default to keep them out of the legs.
  koko:{stiffness:40,drag:.85,gravity:3,maxAngle:22,trail:.3},
  // LORD ORO's chain is one hair controller; HUSH, drawn off the same id,
  // adds a back skirt and a mantle. Single-link controllers, so stiff and
  // tight: they bob with the body rather than swing.
  oro:{stiffness:40,drag:.65,gravity:2,maxAngle:12,trail:.02},
  ward:{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.12},
  // The native coat already carries its swing (keyed in its clips); keep the added spring
  // tight so recovering from the greatsword cut does not raise the tail into a rigid sail.
  strix:{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.12},
  // Shakugo also carries native coat motion; the default spring
  // fought the keyed mantle and raised both sleeves above his head on attacks.
  shakugo:{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.12},
  // Engine VOL.7 (src/engine/client/fighterCheck.ts): the other bodies whose clips key their own coats,
  // skirts and hair stood on the default spring, which held their garments at its 34 degree cone even standing still
  // (Basilissa: 30 degrees off the clip at idle, 34 running). They take Strix's and Shakugo's line.
  senko:{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.12},
  buna:{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.12},
  oyashio:{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.3,bones:/^([clr]_(coat|arm)|[lr]i_coat)0\d_\d+$/,chains:[
    {match:/^(coat_root|[lr]_coat_kata|([clr]|[lr]i)_coat_end)_/,profile:{off:true}},
    {match:/^([clr]_(coat|arm)|[lr]i_coat)01_/,profile:{stiffness:24,drag:.58,gravity:2.6,maxAngle:20,tipLoose:.6,spread:.5,authored:.5,hang:.4,trail:.09,flutter:.3,legs:{thigh:.2,shin:.12,floor:.02}}},
    {match:/^([clr]_(coat|arm)|[lr]i_coat)02_/,profile:{stiffness:24,drag:.58,gravity:2.6,maxAngle:20,tipLoose:.6,spread:.5,authored:.5,trail:.09,flutter:.3}},
  ]},
  'basilissa':{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.12},
  sorayomi:{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.12},
  kuon:{stiffness:40,drag:.4,gravity:1.6,maxAngle:11,trail:.03},
  // Gaunt's cloak: three four-link chains of ~0.4 m off the shoulders and the
  // neck, keyed by his own clips and left at rest by the donated ones. Heavy
  // wool over armour hangs straight and does not ring: at 14 and a carry of
  // .88 a Cleave threw it out to its 30 degree cone as a flat sail over both
  // fighters and it had not settled a second and a half later. Now it trails
  // a swing by half the angle and settles in a fifth of a second, the hem
  // trailing the shoulders and the three chains apart - and his own clips,
  // which fling the cape out by themselves, keep half of that (round 3b).
  gaunt:{stiffness:12,drag:.4,gravity:2.6,maxAngle:18,tipLoose:.6,spread:.25,authored:.5,trail:.06,flutter:.15},
  // Imago's tail (round 5): five links of 0.36 m behind his hips (scripts/economy/imago_tail.py), which his clips
  // key to droop and to lie along the floor. A heavy tail: it trails a dash and a turn and settles in about a third of
  // a second, the tip looser than the root, the cone tight enough that no link swings it into the floor the clips keep
  // it 4 cm over.
  imago:{stiffness:12,drag:.65,gravity:1,maxAngle:12,tipLoose:.6,trail:.2},
  gorai:{stiffness:28,drag:.58,gravity:2.4,maxAngle:18,tipLoose:.6,spread:.25,authored:.7,bones:/^[clr]_coat0\d_\d+$/,chains:[
    {match:/^(coat_root|[lr]_coat_kata)_/,profile:{off:true}},
    {match:/^[clr]_coat0\d_/,profile:{stiffness:22,drag:.55,gravity:2.8,maxAngle:18,tipLoose:.6,spread:.25,authored:.5,hang:.5,trail:.07,flutter:.12,legs:{thigh:.3,shin:.13,floor:.02}}},
  ]},
  shiun:{stiffness:28,drag:.58,gravity:2.4,maxAngle:18,tipLoose:.6,spread:.25,authored:.7},
  haldor:{stiffness:24,drag:.4,gravity:2.4,maxAngle:18,tipLoose:.6,spread:.25,authored:.7,trail:.12},
  // Round 5b (RIG3): Asahi's haori, waist to mid-thigh and open in front, hangs on the rig's own five three-link chains
  // off his spine (Bone_Skirt*), and his hair on its own 38 (Bone_Hair*): none keyed, none sprung until now - the haori
  // rode his back as a shell and his hair was carved. The haori swings, trails and hangs partly from his root, kept out
  // of his legs; the hair bobs as spikes do. The four single front-edge bones up the chest stay with it.
  asahi:{stiffness:20,drag:.55,gravity:2.6,maxAngle:20,tipLoose:.65,spread:.25,trail:.07,flutter:.14,bones:/^Bone_(Skirt|Hair)\d+_\d+$/,chains:[
    {match:/^Bone_Skirt(19|2[0-2])_/,profile:{off:true}},
    {match:/^Bone_Skirt/,profile:{maxAngle:30,trail:.12,hang:.3,legs:{thigh:.11,shin:.09,floor:.015}}},
    {match:/^Bone_Hair/,profile:{stiffness:40,drag:.4,gravity:1.6,maxAngle:12,tipLoose:.8,spread:.15,trail:.03,flutter:.05}},
  ]},
  sorrel:{stiffness:28,drag:.6,gravity:2.6,maxAngle:16,tipLoose:.6,spread:.25,authored:.45,hang:.5,trail:.06,flutter:.14,bones:/^[CFLR]_Cort0\d_\d+$/,legs:{thigh:.12,shin:.1,floor:.015}},
  dorado:{stiffness:55,drag:.4,gravity:2.4,maxAngle:18,tipLoose:.6,spread:.25,authored:.35,trail:.02,flutter:.15},
  levin:{stiffness:55,drag:.4,gravity:2.6,maxAngle:18,tipLoose:.6,spread:.25,authored:.25,trail:.02,flutter:.2},
  ippon:{stiffness:40,drag:.4,gravity:3,maxAngle:10,authored:.5,trail:.06,flutter:.2},
  // Round 5b (RIG): the default's bodies, given lines of their own under the soft cone and the air (`trail`).
  kenzo:{stiffness:12,drag:.4,gravity:3,maxAngle:24,trail:.09,flutter:.12},
  gummy:{stiffness:24,drag:.4,gravity:3,maxAngle:24,trail:.12},
  'wuming':{stiffness:40,drag:.4,gravity:3,maxAngle:8,trail:.02},
  // Vesper (7 October 2026, vesper-mx2.glb, and vesper-mx3's re-hung cape, 8 October; scripts/rig/vesper_rig.py):
  // the cape's hem chains swing on look/hemDrape.ts's vesper spec. His long hair hangs on chains of its own off the
  // head - five down his back, one in each lock over his chest - light: it lags a dash and a turn, trails a run and
  // settles in a few tenths of a second, never lifting past level. His cape and Black Vespers's hang from the pelvis, so a
  // crouch (the offering's landing on one knee) would sink their hems into it: their links are kept off the floor and out
  // of the legs as Nigo's coat's are (look/garmentCollide.ts), under look/hemDrape.ts's own push.
  vesper:{chains:[
    // vesper-mx3's cape hangs on chains 6-18; mx2's six (0-5) are kept in the skeleton carrying nothing.
    {match:/^Detail_CLOTH_vesper_hem_[0-5]_\d$/,profile:{off:true}},
    {match:/^Detail_CLOTH_vesper(-blackVespers)?_hem_/,profile:{legs:{thigh:.1,shin:.085,floor:.015,foot:.12}}},
    {match:/^Detail_CLOTH_vesper_hair_/,profile:{stiffness:26,drag:.5,gravity:2.2,maxAngle:16,tipLoose:.75,spread:.2,trail:.08,flutter:.12,droop:80}},
    {match:/^Detail_CLOTH_vesper_lock/,profile:{stiffness:30,drag:.5,gravity:2.2,maxAngle:20,tipLoose:.7,spread:.15,trail:.06,flutter:.1,droop:80}},
  ]},
};
applyOriginalSprings(SPRING_PROFILES);
const DYNAMIC=/^detail_(cloth|bone)|(^|_)(hem|wear|sleeve|skirt|coat|cape|scarf|ribbon|tassel|cloth|hair)(_|$)|^acce|_suso_|_tie_/i;
const EXCLUDED=/equipment|cigarette|prop|weapon|katana|sword|haizan|kunai/i;

export function isDynamicBoneName(name:string){
  return DYNAMIC.test(name)&&!EXCLUDED.test(name);
}

// The shortest run of cloth worth a spring, in world metres. A rig whose chains
// hang under a scale-compensation bone carries helper bones with arms of a
// micrometre; a spring on one of those saturates its cone on any motion at all
// and reads as a permanent, flickering deformation.
const MIN_ARM=.02;
/** The furthest a leg or the floor may push a garment link off its rest direction (cos 100 degrees). */
const COLLIDE_MOST=Math.cos(THREE.MathUtils.degToRad(100));

interface SpringNode {
  bone:THREE.Bone;
  parent:THREE.Object3D;
  /** Unit direction from the bone's head to its tail, in the bone's own
   *  world-rotation frame: resolve() turns it by the bone's world quaternion. */
  axis:THREE.Vector3;
  /** Head-to-tail distance in world metres. The Verlet state is world space and
   *  the forcing terms are world distances, so the arm has to be too. */
  length:number;
  /** The clip's local rotation for this frame, taken before the substeps run.
   *  Each slice measures its rest against this, not the swing the last slice
   *  wrote into the live quaternion. */
  authored:THREE.Quaternion;
  /** The swing this solver wrote into the live quaternion last frame. A chain
   *  with no track in the clip is never rewritten by the pose pipeline, so if
   *  the live value still equals this, the clip did not speak and `authored`
   *  must stand; reading it back as the clip's rotation re-based the cone on
   *  the previous swing every frame and let an unkeyed chain wind up without
   *  limit (Shirokane's hair drifted 5 cm at idle inside an 8 degree cone). */
  written:THREE.Quaternion;
  /** The live value read as the clip's this frame (before `authored`'s share of it is taken), which `unswing` hands
   *  back to the bone before the next frame's pose is drawn. */
  clip:THREE.Quaternion;
  /** Verlet state, world space. */
  tail:THREE.Vector3;
  previous:THREE.Vector3;
  /** This link's share of the profile's stiffness (tipLoose, spread). */
  stiff:number;
  /** The local rotation the rig was handed over with: what `authored` of
   *  the clip's garment motion is measured from. */
  rest:THREE.Quaternion;
  /** Round 5b (RIG): where this link's target was on the last step, for its travel (`trail`). */
  goal:THREE.Vector3;
  /** Its own settings, where the profile's `chains` gives it some (else the profile's). */
  own:SpringProfile;
  /** A chain's first link with `hang`: its share, and its handed-over direction in the root's frame. */
  hang:number;
  hangAxis:THREE.Vector3;
  stiffLaunched?:number;
}

const _head=new THREE.Vector3();
const _scratch=new THREE.Vector3();
const _scale=new THREE.Vector3();
const _rest=new THREE.Vector3();
const _authored=new THREE.Vector3();
const _rootQ=new THREE.Quaternion();
const _target=new THREE.Vector3();
const _next=new THREE.Vector3();
const _delta=new THREE.Vector3();
const _direction=new THREE.Vector3();
const _side=new THREE.Vector3();
const _world=new THREE.Quaternion();
const _parent=new THREE.Quaternion();
const _inverse=new THREE.Quaternion();
const _swing=new THREE.Quaternion();
const _local=new THREE.Quaternion();
const DOWN=new THREE.Vector3(0,-1,0);
const _auraAxis=new THREE.Vector3(),_auraTurn=new THREE.Quaternion(),_auraRest=new THREE.Vector3();
const UP=new THREE.Vector3(0,1,0);
/** A charging aura's updraft: it lifts hair and cloth and flutters them,
 *  which is what a power-up looks like in every one of these series. The
 *  springs here are stiff by design (a pull of a quarter to three quarters of
 *  the way home every frame), so a force barely moves them; instead the
 *  direction each chain is pulled toward is turned up and set wavering. As
 *  shares of the profile's own cone, which the solve still clamps to - a
 *  chain can never be blown through the body. The flutter is two slow waves
 *  per chain, phased along it, so a garment ripples rather than buzzing. */
const AURA_LIFT=.55,AURA_FLUTTER=.3,AURA_RATES:[number,number]=[1.1,2.9];

export class SecondaryMotion {
  private nodes:SpringNode[]=[];
  private profile:SpringProfile;
  private root:THREE.Object3D;
  private anchor=new THREE.Vector3();
  private settled=false;
  private swing=0;
  private shortest=Infinity;
  /** 0..1: how much of an aura's updraft the garments are in. */
  private auraStrength=0;
  private auraClock=0;
  /** Round 5b (RIG): the body's smoothed ground speed and heading, for the running flutter. */
  private speed=0;
  private heading=new THREE.Vector3(0,0,1);
  private flutterClock=0;
  /** Round 5b (RIG2): a long garment's hem chains, hung and kept out of the legs (look/hemDrape.ts). */
  private drape?:HemDrape;
  private launchy=false;
  private launchShare=0;
  private launchWanted=0;
  private ground?:number;
  private velocity=new THREE.Vector3();
  private sweepDir=new THREE.Vector3(0,-1,0);

  constructor(root:THREE.Object3D,fighter:FighterId|'nightfall'){
    this.root=root;
    this.profile={...DEFAULT_PROFILE,...SPRING_PROFILES[fighter]};
    this.drape=HemDrape.find(root);
    if(this.drape)this.profile={...this.profile,...this.drape.spec.profile};
    const bones:THREE.Bone[]=[];
    const own=this.profile.bones;
    root.traverse(o=>{if((o as THREE.Bone).isBone&&(isDynamicBoneName(o.name)||!!own?.test(o.name)&&!EXCLUDED.test(o.name)))bones.push(o as THREE.Bone);});
    // Root-first ordering lets a chain's parent settle before its child reads
    // the parent's world matrix on the same frame.
    bones.sort((a,b)=>depth(a)-depth(b));
    // Arms are measured in world space on the pose the rig was handed over in.
    // A child's local offset is a distance in the parent's units, and on a
    // chain scaled by a compensation bone those units are not metres.
    root.updateMatrixWorld(true);
    const head=new THREE.Vector3(),tail=new THREE.Vector3(),rotation=new THREE.Quaternion();
    for(const bone of bones){
      const parent=bone.parent;
      if(!parent)continue;
      const child=bone.children.find(c=>(c as THREE.Bone).isBone);
      bone.getWorldPosition(head);
      if(child)child.getWorldPosition(tail);
      else{
        // A leaf continues along its own offset from its parent; that is the
        // direction the artist gave the chain.
        parent.getWorldPosition(tail);
        tail.sub(head).multiplyScalar(-.6).add(head);
      }
      const length=head.distanceTo(tail);
      if(!(length>=MIN_ARM))continue;
      // Head and tail come from the same frame, so the axis is the tail
      // direction as the bone's own world rotation sees it, whatever scale or
      // local rotation sits between the bone and its parent.
      bone.getWorldQuaternion(rotation);
      const hangAxis=tail.clone().sub(head).divideScalar(length).applyQuaternion(root.getWorldQuaternion(_rootQ).invert());
      const chain=this.profile.chains?.find(c=>c.match.test(bone.name));
      if(chain?.profile.off)continue;
      // Round 5b (NIGO2): `tail` is this loop's scratch vector, so an axis taken as `tail` itself is shared by every
      // node and ends as whatever the loop left in it - each spring pulled toward one other bone's rest direction
      // (measured: 30-130 degrees off on most of the roster's rigs; a long coat bulged into a ball on that).
      // A body whose profile gives its chains settings of their own (`chains`) takes each bone's own axis; the
      // roster's tuned garments are left as they were until their own pass re-tunes them on the fix.
      const axis=(this.profile.chains?tail.clone():tail).sub(head).divideScalar(length).applyQuaternion(rotation.invert());
      this.nodes.push({bone,parent,axis,length,authored:bone.quaternion.clone(),clip:bone.quaternion.clone(),
        written:new THREE.Quaternion(NaN,NaN,NaN,NaN),tail:new THREE.Vector3(),previous:new THREE.Vector3(),stiff:1,rest:bone.quaternion.clone(),goal:new THREE.Vector3(),
        own:chain?{...this.profile,...chain.profile}:this.profile,hang:0,hangAxis});
      this.shortest=Math.min(this.shortest,length);
    }
    this.launchy=this.nodes.some(node=>!!node.own.launched);
    if(this.nodes.some(node=>(node.own.tipLoose??1)!==1||(node.own.spread??0)!==0||node.own.launched?.tipLoose!==undefined)){
      const sprung=new Set(this.nodes.map(node=>node.bone));
      const rootOf=(bone:THREE.Object3D)=>{let top=bone,steps=0;for(let at=bone.parent;at&&sprung.has(at as THREE.Bone);at=at.parent){top=at;steps++;}return {top,steps};};
      const deepest=new Map<THREE.Object3D,number>();
      for(const node of this.nodes){const {top,steps}=rootOf(node.bone);deepest.set(top,Math.max(deepest.get(top)??0,steps));}
      for(const node of this.nodes){
        const {top,steps}=rootOf(node.bone),span=deepest.get(top)??0;
        const grade=span>0?steps/span:0,{tipLoose=1,spread=0}=node.own;
        node.stiff=THREE.MathUtils.lerp(1,tipLoose,grade)*(1+spread*(hash(top.name)*2-1));
        const aloft=node.own.launched?.tipLoose;
        if(aloft!==undefined)node.stiffLaunched=THREE.MathUtils.lerp(1,aloft,grade)*(1+spread*(hash(top.name)*2-1));
      }
    }
    // `hang` acts on each chain's first link only; the links below hang off it.
    {const sprung=new Set(this.nodes.map(node=>node.bone as THREE.Object3D));for(const node of this.nodes)if(node.own.hang&&!sprung.has(node.parent))node.hang=node.own.hang;}
    if(this.nodes.some(node=>node.own.legs)){
      const spec=this.nodes.find(node=>node.own.legs)!.own.legs!;
      const capsules=new LegCapsules(root,spec);
      if(capsules.ok)this.capsules=capsules;
    }
  }
  private capsules?:LegCapsules;
  private readonly rootQuat=new THREE.Quaternion();

  get boneCount(){return this.nodes.length;}
  /** Shortest world arm among the solved chains, in metres. Infinity if none. */
  get minArm(){return this.shortest;}
  /** Largest angle, in degrees, any chain is currently bent away from its
   *  authored direction. This is the deflection the solver actually added. */
  get swingDegrees(){return this.swing;}

  /** Drop all accumulated velocity; the next update re-seats every chain. */
  reset(){this.settled=false;}
  unswing(){for(const node of this.nodes)node.bone.quaternion.copy(node.clip);}
  /** Put the garments in a charging aura's updraft, 0..1. Eased by the
   *  caller; see Fighter's held-pose layer. */
  aura(strength:number){this.auraStrength=THREE.MathUtils.clamp(strength,0,1);}
  /** How much of a long garment's hang toward the floor holds, 0..1 (look/hemDrape.ts `hangScale`); 1 by default. */
  hang(share:number){if(this.drape)this.drape.hangScale=THREE.MathUtils.clamp(share,0,1);}
  launch(wanted:number,ground?:number){if(!this.launchy)return;this.launchWanted=THREE.MathUtils.clamp(wanted,0,1);this.ground=ground;}

  update(dt:number){
    if(!this.nodes.length)return;
    this.drape?.before();
    // The pose pipeline has just written this frame's clip rotation into every
    // bone. Take it now: the substeps below overwrite the live quaternion with
    // the solved swing, and a slice that read its rest from that would be
    // chasing the previous slice rather than the clip, with nothing pulling
    // the garment back toward the authored pose.
    // Unless the live value is exactly the swing written last frame: then no
    // track touched this bone and the authored rotation is the one already
    // held. NaN never equals anything, so the first frame always reads.
    const kept=this.profile.authored??1;
    for(const node of this.nodes)if(!node.bone.quaternion.equals(node.written)){
      node.clip.copy(node.bone.quaternion);
      if(kept<1)node.authored.copy(node.rest).slerp(node.bone.quaternion,kept);
      else node.authored.copy(node.bone.quaternion);
    }
    this.root.getWorldPosition(_scratch);
    this.root.getWorldQuaternion(this.rootQuat);
    // A respawn or a snapshot jump moves the whole rig instantly. Integrating
    // that as velocity would fling every garment across the arena.
    if(this.settled&&_scratch.distanceToSquared(this.anchor)>4)this.settled=false;
    if(this.launchy&&dt>0){
      const rate=this.launchWanted>this.launchShare?LAUNCH_IN:LAUNCH_OUT;
      this.launchShare+=(this.launchWanted-this.launchShare)*(1-Math.exp(-dt*rate));
      if(Math.abs(this.launchWanted-this.launchShare)<1e-3)this.launchShare=this.launchWanted;
    }
    if(this.settled&&dt>0&&(this.profile.flutter||this.launchy)){
      // The ground speed the flutter answers, eased over about a tenth of a second.
      _delta.subVectors(_scratch,this.anchor).setY(0);
      const moved=_delta.length(),ease=1-Math.exp(-dt*10);
      this.speed+=(moved/dt-this.speed)*ease;
      if(moved>1e-5)this.heading.lerp(_delta.divideScalar(moved),ease).normalize();
    }
    if(this.launchy&&this.settled&&dt>0){
      _side.subVectors(_scratch,this.anchor).divideScalar(dt);this.velocity.lerp(_side,1-Math.exp(-dt*12));
      this.sweepDir.copy(this.velocity).negate().addScaledVector(DOWN,LAUNCH_SAG);
      if(this.sweepDir.lengthSq()>1e-8)this.sweepDir.normalize();else this.sweepDir.copy(DOWN);
    }
    this.anchor.copy(_scratch);
    if(!this.settled){this.place();return;}
    this.capsules?.update(this.launchShare>0?this.ground:undefined);
    const clamped=Math.min(Math.max(dt,0),1/20);
    const steps=clamped>0?Math.max(1,Math.ceil(clamped*45)):1;
    for(let i=0;i<steps;i++)this.solve(clamped/steps);
  }

  /** Snap every tail onto its authored direction, with no lag. */
  private place(){
    for(const node of this.nodes){
      this.resolve(node);
      node.tail.copy(_head).addScaledVector(_rest,node.length);
      node.previous.copy(node.tail);
      node.goal.copy(node.tail);
    }
    this.settled=true;
    this.speed=0;
  }

  /** Rebuild the bone's world matrix from its authored rotation and write its
   *  head into _head and its authored tail direction into _rest. */
  private resolve(node:SpringNode){
    const bone=node.bone;
    bone.matrix.compose(bone.position,node.authored,bone.scale);
    bone.matrixWorld.multiplyMatrices(node.parent.matrixWorld,bone.matrix);
    bone.matrixWorld.decompose(_head,_world,_scale);
    _rest.copy(node.axis).applyQuaternion(_world).normalize();
    _authored.copy(_rest);
    const aloft=node.hang>0&&this.launchShare>0?node.own.launched?.hang:undefined;
    const hang=aloft===undefined?node.hang:THREE.MathUtils.lerp(node.hang,THREE.MathUtils.lerp(aloft,node.hang,THREE.MathUtils.smoothstep(-_authored.y,LAUNCH_UPSIDE,LAUNCH_UPRIGHT)),this.launchShare);
    if(hang>0)_rest.lerp(_scratch.copy(node.hangAxis).applyQuaternion(this.rootQuat),hang).normalize();
  }

  private solve(dt:number){
    const base=this.profile;
    let {stiffness,drag,gravity,maxAngle,trail}=base;
    const flutter=base.flutter??0;
    let limit=Math.cos(THREE.MathUtils.degToRad(maxAngle));
    // The soft cone (Round 5b): past `knee` a swing is eased toward the cone, never onto it.
    let soft=THREE.MathUtils.clamp(base.soft??SOFT,0,1);
    // The air (`trail`): a link keeps this share of its own motion each step.
    let air=trail===undefined?0:1-Math.pow(1-THREE.MathUtils.clamp(trail,0,1),dt*60);
    const wave=flutter>0?flutter*Math.min(1.5,this.speed/FLUTTER_SPEED):0;
    if(dt>0&&(wave>0||this.launchShare>0))this.flutterClock+=dt*FLUTTER_HZ*(.6+.4*Math.min(2,this.speed/FLUTTER_SPEED));
    let ripple=wave,sweep=0,curl=0;
    let keep=Math.pow(drag,dt*60);
    let pull=stiffness*dt;
    const aura=this.auraStrength;let cone=THREE.MathUtils.degToRad(maxAngle),knee=cone*soft;
    if(dt>0)this.auraClock+=dt;
    let widest=1,index=0,current:SpringProfile=base,droop=base.droop!==undefined?Math.cos(THREE.MathUtils.degToRad(base.droop)):-2;
    for(const node of this.nodes){
      // A chain with settings of its own (the profile's `chains`); the others keep the profile's, unchanged.
      if(node.own!==current){
        current=node.own;({stiffness,drag,gravity,maxAngle,trail}=current);
        limit=Math.cos(THREE.MathUtils.degToRad(maxAngle));keep=Math.pow(drag,dt*60);pull=stiffness*dt;cone=THREE.MathUtils.degToRad(maxAngle);
        soft=THREE.MathUtils.clamp(current.soft??SOFT,0,1);knee=cone*soft;air=trail===undefined?0:1-Math.pow(1-THREE.MathUtils.clamp(trail,0,1),dt*60);
        droop=current.droop!==undefined?Math.cos(THREE.MathUtils.degToRad(current.droop)):-2;
        ripple=wave;sweep=0;curl=0;
        const up=current.launched,k=this.launchShare;
        if(up&&k>0){
          const mix=(own:number,aloft:number|undefined)=>aloft===undefined?own:own+(aloft-own)*k;
          stiffness=mix(stiffness,up.stiffness);gravity=mix(gravity,up.gravity);maxAngle=mix(maxAngle,up.maxAngle);
          limit=Math.cos(THREE.MathUtils.degToRad(maxAngle));pull=stiffness*dt;cone=THREE.MathUtils.degToRad(maxAngle);knee=cone*soft;
          if(up.trail!==undefined&&trail!==undefined){trail=mix(trail,up.trail);air=1-Math.pow(1-THREE.MathUtils.clamp(trail,0,1),dt*60);}
          if(up.droop!==undefined)droop=Math.cos(THREE.MathUtils.degToRad(mix(current.droop??180,up.droop)));
          if(up.flutter!==undefined)ripple=mix(flutter,up.flutter)*Math.min(1.5,this.speed/FLUTTER_SPEED);
          sweep=(up.sweep??0)*k;curl=(up.curl??0)*k;
        }
      }
      this.resolve(node);
      if(dt>0){
        _auraRest.copy(_rest);
        if(aura>1e-3){
          const c=this.auraClock*Math.PI*2,phase=index*.9;
          // Up, about the axis that turns this chain toward the sky. A chain
          // already standing up (hair spikes) has none, and only wavers.
          _auraAxis.crossVectors(_rest,UP);
          const across=_auraAxis.length();
          if(across>1e-3)_auraRest.applyQuaternion(_auraTurn.setFromAxisAngle(_auraAxis.divideScalar(across),aura*AURA_LIFT*cone));
          _auraAxis.set(Math.cos(c*AURA_RATES[0]+phase),0,Math.sin(c*AURA_RATES[0]+phase));
          _auraRest.applyQuaternion(_auraTurn.setFromAxisAngle(_auraAxis,aura*AURA_FLUTTER*cone*Math.sin(c*AURA_RATES[1]+phase*1.7)));
        }
        if(sweep>0){
          const upside=curl>0?THREE.MathUtils.smoothstep(_authored.y,0,.7):0;
          const along=THREE.MathUtils.clamp(_auraRest.dot(this.sweepDir),-1,1),turn=Math.min(Math.acos(along),(sweep+curl*upside)*cone);
          _sweepAxis.crossVectors(_auraRest,this.sweepDir);const across=_sweepAxis.length();
          if(across>1e-3&&turn>1e-4)_auraRest.applyQuaternion(_sweepTurn.setFromAxisAngle(_sweepAxis.divideScalar(across),turn));
        }
        if(ripple>1e-4){
          // Round 5b: the running flutter, about the axis across the chain and the travel, phased down the chain.
          _auraAxis.crossVectors(_auraRest,this.heading);
          const across=_auraAxis.length();
          if(across>1e-3)_auraRest.applyQuaternion(_auraTurn.setFromAxisAngle(_auraAxis.divideScalar(across),ripple*cone*Math.sin(this.flutterClock*Math.PI*2-index*.8)));
        }
        _target.copy(_head).addScaledVector(_auraRest,node.length);
        const stiff=node.stiffLaunched!==undefined&&this.launchShare>0?node.stiff+(node.stiffLaunched-node.stiff)*this.launchShare:node.stiff;
        _next.copy(node.tail);
        if(trail===undefined){
          _next.addScaledVector(_delta.subVectors(node.tail,node.previous),keep)
            .addScaledVector(_scratch.subVectors(_target,node.tail),Math.min(1,pull*stiff));
        }else{
          // Round 5b: predict - the link's inertia less the air, its motion relative to its target's (whose travel this
          // step stands in for its velocity) damped by `drag` - then pull, closing a share of the gap that is left.
          _side.subVectors(_target,node.goal);
          _next.addScaledVector(_delta.subVectors(node.tail,node.previous),Math.max(0,keep-air)).addScaledVector(_side,1-keep);
          _next.addScaledVector(_scratch.subVectors(_target,_next),Math.min(1,pull*stiff));
        }
        node.goal.copy(_target);
        _next.addScaledVector(DOWN,gravity*dt*dt);

        node.previous.copy(node.tail);
        node.tail.copy(_next);
      }
      // A bone cannot stretch: project the tail back onto its arc.
      _direction.subVectors(node.tail,_head);
      const length=_direction.length();
      if(length>1e-6)_direction.divideScalar(length);else _direction.copy(_rest);
      const alignment=_direction.dot(_rest);
      // A paused frame re-applies a collided link's solved tail as it is: the legs may have pushed it past the cone.
      const held=dt===0&&!!node.own.legs;
      if(!held&&soft<1&&alignment<Math.cos(knee)){
        // Round 5b: past the knee the swing is eased into the rest of the cone (tanh): it slows as it nears the edge
        // and never reaches it, so a hard throw still reads as cloth moving, not as a board pinned on its limit.
        const angle=Math.acos(THREE.MathUtils.clamp(alignment,-1,1)),room=Math.max(1e-6,cone-knee);
        const eased=knee+room*Math.tanh((angle-knee)/room);
        _side.copy(_direction).addScaledVector(_rest,-alignment);
        const spread=_side.length();
        if(spread>1e-6)_direction.copy(_rest).multiplyScalar(Math.cos(eased)).addScaledVector(_side.divideScalar(spread),Math.sin(eased)).normalize();
        else _direction.copy(_rest);
      }else if(!held&&alignment<limit){
        // Clamp the swing into the allowed cone so cloth never inverts through
        // the body or reads as a broken joint.
        _side.copy(_direction).addScaledVector(_rest,-alignment);
        const spread=_side.length();
        if(spread>1e-6)_direction.copy(_rest).multiplyScalar(limit)
          .addScaledVector(_side.divideScalar(spread),Math.sqrt(Math.max(0,1-limit*limit))).normalize();
        else _direction.copy(_rest);
      }
      // The spring's own deflection, before anything below moves the link.
      widest=Math.min(widest,_direction.dot(_rest));
      // No higher than `droop` off straight down: turned down about the horizontal, keeping its way round.
      // Only as time moves: a paused frame re-applies the pose already solved, which already holds both.
      if(dt>0&&-_direction.y<droop){
        _side.set(_direction.x,0,_direction.z);const flat=_side.length();
        if(flat>1e-6)_direction.copy(DOWN).multiplyScalar(droop).addScaledVector(_side.divideScalar(flat),Math.sqrt(1-droop*droop));
      }
      // Out of the legs and off the floor (look/garmentCollide.ts): where a leg or the floor is in the way the
      // collision wins over the cone - cloth is moved by the leg it meets - but never past COLLIDE_MOST off the rest,
      // so nothing can turn inside out.
      if(dt>0&&this.capsules&&node.own.legs){
        _next.copy(_head).addScaledVector(_direction,node.length);
        _target.copy(_next);
        if(this.capsules.pushLink(_head,_next,node.length)){
          // The push is a move, not a throw: the Verlet history moves with it, so the link does not sail on outward.
          node.previous.add(_scratch.subVectors(_next,_target));
          _next.sub(_head).divideScalar(node.length);
          const along=_next.dot(_rest);
          if(along<COLLIDE_MOST){_side.copy(_next).addScaledVector(_rest,-along);const s=_side.length();if(s>1e-6)_next.copy(_rest).multiplyScalar(COLLIDE_MOST).addScaledVector(_side.divideScalar(s),Math.sqrt(1-COLLIDE_MOST*COLLIDE_MOST));}
          if(_next.lengthSq()>1e-10)_direction.copy(_next).normalize();
        }
      }
      if(!Number.isFinite(_direction.x)||!Number.isFinite(_direction.y)||!Number.isFinite(_direction.z)){
        _direction.copy(_rest);node.previous.copy(_head).addScaledVector(_rest,node.length);
      }
      this.drape?.collide(node.bone,_head,_direction);
      node.tail.copy(_head).addScaledVector(_direction,node.length);
      // Rotate the bone about its own head so its tail reaches the solved
      // point, then rebuild its world matrix for the rest of the chain.
      _swing.setFromUnitVectors(_authored,_direction);
      node.parent.matrixWorld.decompose(_scratch,_parent,_scale);
      _inverse.copy(_parent).invert();
      _local.copy(_inverse).multiply(_swing).multiply(_parent).multiply(node.authored);
      node.bone.quaternion.copy(_local);
      node.written.copy(_local);
      node.bone.updateMatrix();
      node.bone.matrixWorld.multiplyMatrices(node.parent.matrixWorld,node.bone.matrix);
      index++;
    }
    this.swing=THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(widest,-1,1)));
  }
}

function depth(bone:THREE.Object3D){let d=0,o:THREE.Object3D|null=bone;while(o){d++;o=o.parent;}return d;}
/** A fixed 0..1 per name, so a chain answers the same way every match. */
function hash(name:string){let h=2166136261;for(let i=0;i<name.length;i++){h^=name.charCodeAt(i);h=Math.imul(h,16777619);}return ((h>>>0)%10007)/10006;}
