import { aqrabStrikeSide } from '../../game/fighters/aqrab';
import * as THREE from 'three';
import type { FighterId, PlayerState } from '../../game/types';
import { MOVES } from '../../game/moves';
import type { Fighter } from '../../render/Fighter';
import { psycheStrikePoint } from '../../render/signature/PsycheBloomPose';
import { ovidStrikeJoint, OVID_KNUCKLE_SOCKETS } from '../../game/fighters/ovid';
import { hawserBlade, hawserTrunkFist, HAWSER_SWORD_SOCKETS, HAWSER_COLOSSUS_KNUCKLES } from '../../game/fighters/hawser';
import { rotfalkeStrikeSocket } from '../../game/fighters/rotfalke';
import { ROTFALKE_KNIFE } from '../../render/signature/RotfalkeField';
import { rotfalkeSurfacePoint } from '../../render/signature/RotfalkeSurface';
import { murexStrikePoint } from '../../render/signature/MurexSurface';
import { bonshoSurfacePoint } from '../../render/signature/BonshoContactSurface';
import { bonshoDrawnPalmPoint } from '../../render/signature/BonshoBodhisattva';
import { bonshoStrikePoint } from '../../originals/bonshoStrike';
import { HIGHSUN_BLADE } from '../../originals/highsunBlade';
import { kinuStrikeJoint } from '../../render/signature/KinuStoneThread';
import { kinuSpiritSurfacePoint } from '../../render/signature/KinuSpiritSurface';
import { madakeStrikePoint } from '../../render/signature/MadakeGates';
import { AKAYURI_BLADE } from '../../render/signature/AkayuriNightblade';
import { hagureStrikeJoint } from '../../render/signature/HagureSnapBite';
import { hagureSurfacePoint } from '../../render/signature/HagureContactSurface';
import { hisameStrikeJoint, HISAME_RAPIER_TIP } from '../../game/fighters/hisame';
import { mizuhikiStrikeJoint, MIZUHIKI_SWORD_SOCKETS } from '../../game/fighters/mizuhiki';
import { shibuichiStrikePoint } from '../../render/signature/ShibuichiBastion';
import { rakuchoContactPoint } from '../../render/signature/RakuchoTendrils';
import { irbisStrikeJoint } from '../../game/fighters/irbis';
import { shidareStrikeSide } from '../../game/fighters/shidare';
import { SHIDARE_BLADE } from '../../render/signature/ShidareSteelPetalCut';
import { HINOMOTO_SWORD_SOCKET } from '../../game/fighters/hinomoto';
import { amagoiStrikeJoint, AMAGOI_RECEIVER_TIP } from '../../render/signature/AmagoiGravity';
import { shakudoStrikePoint } from '../../render/signature/ShakudoAlchemy';
import { minaseStrikeSide } from '../../game/fighters/minase';
import { aquiloStrikeSide } from '../../game/fighters/aquilo';
import { svanhildStrikeJoint } from '../../game/fighters/svanhild';
import { kubiwaStrikeJoint, kubiwaCommandPoint } from '../../render/signature/KubiwaControl';
import { torsionStrikePoint } from '../../render/signature/TorsionPsychic';
import { highsunStrikeJoint, highsunSunhammerVisible, HIGHSUN_SUNHAMMER_EDGE } from '../../game/fighters/highsun';
import { lanthornStrikeJoint, lanthornBladePoint } from '../../render/signature/LanthornLampblack';
import { umeStrikeSide } from '../../game/fighters/ume';
import { tokanStrikeJoint, TOKAN_SABER_SOCKET } from '../../game/fighters/tokan';
import { strappadoStrikePoint } from '../../render/signature/StrappadoStrings';
import { barrowStrikePoint } from '../../render/signature/BarrowEmperor';
import { unariStrikeJoint } from '../../render/signature/UnariBungeeGum';
import { hakushiStrikeSocket, HAKUSHI_MOUTH_OFFSET } from '../../game/fighters/hakushi';
import { kusushiStrikeSocket } from '../../game/fighters/kusushi';
import { suzuranStrikeSide } from '../../game/fighters/suzuran';
import { wataameBokkenPoint } from '../../render/signature/WataameSilverSoul';
import { senkoStrikeJoint } from '../../game/fighters/senko';
import { bunaMastBreakerPoint } from '../../render/signature/BunaOni';
import { senkoFingerPoint } from '../../render/signature/SenkoGlint';
import { oyashioStrikeSide } from '../../game/fighters/oyashio';
import { fullBeamContact } from '../../render/signature/FullBeamPressure';
import { tempoStrikeJoint } from '../../render/signature/TempoDarkSpark';
import { tanchoStrikesLeft } from '../../game/fighters/tancho';
import { pyroclastContact, pyroclastPalm } from '../../render/signature/PyroclastExplosions';
import { ampereContact, ampereSocket } from '../../render/signature/AmpereSurge';
import { kuzuSawContact } from '../../render/signature/KuzuChainsaw';
import { shakugoMagmaContact, shakugoMagmaSocket } from '../../render/signature/ShakugoMagma';
import { boaFingertip, boaHeelContact } from '../../render/signature/BoaEmpress';
import { CROSSMATCH_TAKE } from '../../render/ward/crossmatch';

export type SocketKind = 'strike' | 'contact' | 'charge';
type Vec3 = readonly [number, number, number];

/** What a declaration reads of the body it places a socket on (Fighter fills it for each ask). */
export interface SocketContext {
  /** The body asked, and the body drawn for it now (Fighter.shownBody: its form's while the form stands in). */
  readonly body: Fighter;
  readonly shown: Fighter;
  readonly state: PlayerState;
  /** Its own clip, that clip's time (undefined with none playing) and how far through it is (0 with none). */
  readonly clip: string | undefined;
  readonly time: number | undefined;
  readonly phase: number;
  /** The drawn body's clip, its time (0 with none) and how far through it is. */
  readonly shownClip: string | undefined;
  readonly shownTime: number;
  readonly shownPhase: number;
  /** Seconds into the action, on the simulation's clock. */
  readonly elapsed: number;
  /** Whether the body asked is an awakened form's, and whether the one drawn is. */
  readonly form: boolean;
  readonly shownForm: boolean;
  /** The awakened form's body while its group is shown (Gorai's man-beast, Konta's Kurobi). */
  readonly formBody: Fighter | undefined;
  /** The contact a melee contact is asked for; undefined for a strike or a charge. */
  readonly index: number | undefined;
  /** The current move's contacts (Fighter.moveFor), and the combo ender a state is thrown as (Fighter.ender). */
  contacts(): readonly number[];
  ender(state: PlayerState): string | undefined;
  /** The rig's head and right hand as the body found them (Fighter's headBone, rightBone). */
  readonly head: THREE.Object3D | undefined;
  readonly rightHand: THREE.Object3D | undefined;
}

/** A point on the body. */
export type SocketPoint =
  /** The drawn hands (Fighter.handR, handL); `handRL` and `handLR` halfway from the first toward the second. */
  | 'handR' | 'handL' | 'handRL' | 'handLR'
  /** Where the blow strikes (strikePoint); the form's strike while it is drawn in the body's place (not on the form). */
  | 'strike' | 'form strike'
  /** The body's root. */
  | 'root'
  /** A standard joint (Fighter.joints) of the body asked (`own`, the default), of the one drawn (`shown`), or of the
   *  drawn one where it has it and else the body asked (`drawn`, Fighter.drawnJoint); `at`, a point in its frame, read
   *  through its world matrix brought up to date (Object3D.localToWorld) or, `stale`, as it stands. */
  | { readonly joint: string; readonly of?: 'own' | 'shown' | 'drawn'; readonly at?: Vec3; readonly stale?: true }
  /** A rig bone by its name in letters and digits, lower case (Fighter.bones), of the body asked or the one drawn. */
  | { readonly bone: string; readonly of?: 'own' | 'shown'; readonly at?: Vec3; readonly stale?: true }
  /** Any node of the model by its name. */
  | { readonly node: string; readonly of?: 'own' | 'shown'; readonly at: Vec3; readonly stale?: true }
  /** A point measured by code: a mesh's surface, an arm's pose. False where it cannot be placed. */
  | { readonly solve: (ctx: SocketContext, out: THREE.Vector3) => boolean }
  /** The first of these that can be placed. */
  | { readonly first: readonly (SocketPoint | string)[] }
  /** Halfway from the first to the second. */
  | { readonly mid: readonly [SocketPoint | string, SocketPoint | string] }
  /** Placed where it can be, and answered whether or not (Kosho's foot, as before). */
  | { readonly always: SocketPoint | string };

/** A socket: one of the fighter's named points, a point, or which of them now (undefined: none). */
export type SocketRule = string | SocketPoint | ((ctx: SocketContext) => string | SocketPoint | undefined);

export interface FighterSockets {
  readonly points?: Readonly<Record<string, SocketPoint>>;
  /** Strike, contact and charge, where they are one; else each its own (one given wins over `socket`). */
  readonly socket?: SocketRule;
  readonly strike?: SocketRule;
  readonly contact?: SocketRule;
  readonly charge?: SocketRule;
  /** Its drawn hands, drawn `by` of the way toward this bone of each hand (the side's name before it: `righthand…`). */
  readonly hands?: { readonly toward: string; readonly by: number };
  /** Its form's drawn hands stand in for its own only while it is awakened. */
  readonly formHands?: 'awakened';
  /** The blade its rig holds is not what it strikes with. */
  readonly unarmed?: true;
}

const scratch = new THREE.Vector3(), forward = new THREE.Vector3(), across = new THREE.Vector3(), other = new THREE.Vector3(), scale = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const solve = (place: (ctx: SocketContext, out: THREE.Vector3) => boolean): SocketPoint => ({ solve: place });
/** A module's point that always places (its function returns the point). */
const always = (place: (ctx: SocketContext, out: THREE.Vector3) => unknown): SocketPoint => ({ solve: (ctx, out) => { place(ctx, out); return true; } });
/** The contact nearest the action's clock, where none was asked for (Tempo's and Unari's ultimate). */
const nearest = (ctx: SocketContext) => {
  const contacts = ctx.contacts();
  let index = 0;
  for (let i = 1; i < contacts.length; i++) if (Math.abs(contacts[i] - ctx.elapsed) < Math.abs(contacts[index] - ctx.elapsed)) index = i;
  return index;
};
/** A node of the model by name, kept once per model (a search of the whole rig is not done each frame). */
const nodes = new WeakMap<THREE.Object3D, Map<string, THREE.Object3D | null>>();
const named = (model: THREE.Object3D, name: string) => {
  let found = nodes.get(model);
  if (!found) nodes.set(model, found = new Map());
  if (!found.has(name)) found.set(name, model.getObjectByName(name) ?? null);
  return found.get(name) ?? undefined;
};

/** Bonsho: Bodhisattva's drawn palms on the ultimate's later contacts, else his skin where his blow lands. */
const bonshoPoint = solve((ctx, out) => {
  const state = ctx.state;
  if (state.action === 'ultimate' && !state.branch) {
    const contacts = MOVES.bonsho.ultimate.contacts, t = state.actionTime * state.actionDuration;
    let contact = ctx.index ?? 0;
    if (ctx.index === undefined) for (let i = 1; i < contacts.length; i++) if (t > (contacts[i - 1] + contacts[i]) * .5) contact = i;
    if (contact > 0) return bonshoDrawnPalmPoint(ctx.body, contact, out);
  }
  return bonshoSurfacePoint(ctx.shown.model, state.action, ctx.shownClip, out)
    || bonshoStrikePoint(ctx.shown.model, state.action, ctx.shownClip, out);
});
/** A spirit's armoured knuckle (Kinu's, Gosu's): the spirit drawn for its user. */
const standBody = (ctx: SocketContext) => {
  const stand = ctx.body.stand ? ctx.body : ctx.body.standSource;
  return stand?.stand && stand.group.visible && stand.group.parent ? stand : undefined;
};
const standContact = (ctx: SocketContext, stand: Fighter, fighter: 'kinu' | 'gosu') => {
  const state = stand.state, alternate = !ctx.ender(state) && (state.action === 'special' || state.action === 'ultimate');
  let contact = ctx.index ?? 0;
  if (ctx.index === undefined && alternate) {
    const times = MOVES[fighter][state.action as 'special' | 'ultimate'].contacts, t = state.actionTime * state.actionDuration;
    let distance = Infinity;
    for (let i = 0; i < times.length; i++) { const gap = Math.abs(t - times[i]); if (gap < distance) { distance = gap; contact = i; } }
  }
  return { state, contact, alternate };
};
/** Magatsu's form's lower arms strike with his spear and his dagger: the spear's lowest point at rest, the dagger's far
 *  end from the hand, each in its own joint's frame, measured once off the meshes. */
const lowerWeapons = new WeakMap<Fighter, { spear?: { bone: THREE.Bone; tip: THREE.Vector3 }; dagger?: { bone: THREE.Bone; tip: THREE.Vector3 } } | null>();
const magatsuWeapon = solve((ctx, out) => {
  const body = ctx.body;
  let weapons = lowerWeapons.get(body);
  if (weapons === undefined) {
    weapons = null;
    const find = (mesh: string, joint: string, pick: (p: THREE.Vector3, hand: THREE.Vector3) => number) => {
      const skinned = body.model.getObjectByName(mesh) as THREE.SkinnedMesh | undefined;
      const bone = body.model.getObjectByName(joint) as THREE.Bone | undefined;
      if (!skinned?.isSkinnedMesh || !bone) return undefined;
      const index = skinned.skeleton.bones.indexOf(bone);
      if (index < 0) return undefined;
      const inverse = skinned.skeleton.boneInverses[index], position = skinned.geometry.attributes.position, p = new THREE.Vector3(), best = new THREE.Vector3();
      const hand = new THREE.Vector3().applyMatrix4(inverse.clone().invert());
      let score = -Infinity;
      for (let i = 0; i < position.count; i++) { p.fromBufferAttribute(position, i).applyMatrix4(skinned.bindMatrix); const s = pick(p, hand); if (s > score) { score = s; best.copy(p); } }
      return { bone, tip: best.applyMatrix4(inverse) };
    };
    const spear = find('weapon_spear', 'Spear', p => -p.y), dagger = find('weapon_dagger', 'Dagger', (p, hand) => p.distanceTo(hand) - (p.y > hand.y ? 1 : 0));
    if (spear || dagger) weapons = { spear, dagger };
    lowerWeapons.set(body, weapons);
  }
  const s = ctx.state;
  if (!weapons || !ctx.form) return false;
  const lower = s.action === 'light' ? (s.chain ?? 0) === 1 ? weapons.dagger : weapons.spear : s.action === 'heavy' ? weapons.spear : undefined;
  if (!lower) return false;
  out.copy(lower.tip).applyMatrix4(lower.bone.matrixWorld);
  return true;
});

/** Mizuhiki's third light is Levin's Heel Tap since 13 October 2026 (scripts/night/anim/picks.json): the blow is her right
 *  foot while it is thrown, which is while it stands higher than six tenths of the way from the floor she is on to her
 *  hips (from five frames before the contact until it comes down); her blade's tip otherwise. Read off the pose drawn and
 *  not off the clip's name alone, because `Rush 2` is also her body file's own third light, a cut, which
 *  tests/mizuhikiSharedIntegration.test.ts holds to its blade (that body never lifts the foot); and so the kick's own
 *  wind-up, the foot still under her, stays the blade's as every other clip of hers is. */
const kickHips = new THREE.Vector3();
const mizuhikiKick = solve((ctx, out) => {
  if (ctx.shownClip !== 'Rush 2') return false;
  const hips = ctx.body.drawnJoint('Hips'), foot = ctx.body.drawnJoint('RightToeBase') ?? ctx.body.drawnJoint('RightFoot');
  if (!hips || !foot) return false;
  const floor = ctx.body.group.position.y;
  foot.getWorldPosition(out);
  return out.y - floor > .6 * (hips.getWorldPosition(kickHips).y - floor);
});

export const FIGHTER_SOCKETS: Readonly<Partial<Record<FighterId, FighterSockets>>> = {
  chohan: { socket: { node: 'ChohanBladeTip', of: 'shown', at: [0,0,0] } },
  tsubute: { socket: { joint: 'RightHand', of: 'drawn' } },
  aqrab: {
    points: { Left: { joint: 'LeftHand', of: 'drawn', at: [.7357524, -.0154704, -.0047152] }, Right: { joint: 'RightHand', of: 'drawn' } },
    socket: ctx => aqrabStrikeSide(ctx.state.action, ctx.time ?? 0, ctx.clip),
  },
  // --- Blades: the tip of the steel, in its joint's frame -----------------------------------------------------------
  yodaka: { socket: { node: 'YodakaBladeTip', of: 'shown', at: [0,0,0] } },
  akayuri: { socket: { bone: 'sword', of: 'shown', at: AKAYURI_BLADE.tip } },
  hinomoto: { socket: { joint: 'RightHand', of: 'drawn', at: HINOMOTO_SWORD_SOCKET.tip } },
  hisame: {
    points: { LeftHand: { joint: 'LeftHand', of: 'drawn' }, RightHand: { first: [{ joint: 'Sword', of: 'shown', at: HISAME_RAPIER_TIP }, { node: 'Sword', of: 'shown', at: HISAME_RAPIER_TIP }] } },
    socket: ctx => hisameStrikeJoint(ctx.state.action, ctx.clip),
  },
  mizuhiki: {
    points: { LeftHand: { joint: 'LeftHand', of: 'drawn', at: MIZUHIKI_SWORD_SOCKETS.LeftHand.tip }, RightHand: { joint: 'RightHand', of: 'drawn', at: MIZUHIKI_SWORD_SOCKETS.RightHand.tip }, kick: mizuhikiKick },
    socket: ctx => ({ first: ['kick', mizuhikiStrikeJoint(ctx.clip ?? '', ctx.index, ctx.phase)] }),
  },
  shidare: {
    points: { Left: { joint: 'LeftHand', of: 'drawn' }, Right: { node: 'Sword', of: 'shown', at: SHIDARE_BLADE.tip, stale: true } },
    socket: ctx => shidareStrikeSide(ctx.state.action, ctx.time ?? 0, ctx.clip, ctx.index),
  },
  tokan: {
    points: {
      LeftFoot: { joint: 'LeftFoot' },
      saber: { solve: (ctx, out) => !!named(ctx.body.model, 'Tokan_Frostbite_Cut')?.visible && placeIn(ctx, { joint: 'TokanSaber', at: TOKAN_SABER_SOCKET.tip, stale: true }, out) },
    },
    socket: ctx => ({ first: tokanStrikeJoint(ctx.state.action, ctx.time, ctx.clip) === 'LeftFoot' ? ['LeftFoot', 'saber', 'handR'] : ['saber', 'handR'] }),
  },
  highsun: {
    // Sunhammer's crescent, in his right hand while it is out, the base body's or the form's; else the hand that strikes.
    socket: ctx => {
      const action = ctx.shown.state.action, time = ctx.shownTime, clip = ctx.shownClip;
      const side = action === 'ultimate' && ctx.index !== undefined ? ctx.index === 1 ? 'LeftHand' : 'RightHand' : highsunStrikeJoint(action, time, clip);
      const edge = side === 'RightHand' && (action === 'light' || action === 'heavy') && highsunSunhammerVisible(action, time, clip);
      if (edge && HIGHSUN_BLADE) return { node: HIGHSUN_BLADE.node, of: 'shown', at: (ctx.shown === ctx.body ? HIGHSUN_BLADE.base : HIGHSUN_BLADE.form).middle, stale: true };
      return edge ? { joint: side, of: 'shown', at: (ctx.shown === ctx.body ? HIGHSUN_SUNHAMMER_EDGE.base : HIGHSUN_SUNHAMMER_EDGE.form).middle, stale: true } : { joint: side, of: 'shown' };
    },
  },
  rotfalke: {
    points: {
      RightFoot: solve((ctx, out) => rotfalkeSurfacePoint(ctx.body, 'rightHeel', out)),
      LeftHand: solve((ctx, out) => rotfalkeSurfacePoint(ctx.body, 'leftPalm', out)),
      RightHand: { bone: 'progressiveknife', of: 'shown', at: ROTFALKE_KNIFE.tip, stale: true },
    },
    socket: ctx => rotfalkeStrikeSocket(ctx.shown.state.action, ctx.shownClip ?? '', ctx.shownPhase, ctx.index),
  },
  // --- Knuckles and palms: the striking hand, the point of it that lands ---------------------------------------------
  'ovid': { socket: ctx => { const side = ovidStrikeJoint(ctx.shownClip ?? '', ctx.index, ctx.shownPhase); return { joint: side, of: 'shown', at: OVID_KNUCKLE_SOCKETS[side], stale: true }; } },
  // Hawser: the YUGE's knuckle while its body is drawn; the Scout's blade otherwise - the tip of the one that lands
  // the blow, on the blade's own joint under his hand (his blades turn in his fists as Levin's do, so a point in the
  // hand's frame would be wherever the blade was in his stance).
  hawser: { socket: ctx => {
    if (ctx.shownForm) { const side = hawserTrunkFist(ctx.shownClip ?? '', ctx.index, ctx.shownPhase); return { joint: side, of: 'shown', at: HAWSER_COLOSSUS_KNUCKLES[side], stale: true }; }
    const blade = hawserBlade(ctx.shownClip ?? '', ctx.index, ctx.shownPhase);
    return { bone: blade.toLowerCase(), of: 'shown', at: HAWSER_SWORD_SOCKETS[blade].tip };
  } },
  amagoi: {
    points: { RightHand: { joint: 'RightHand', of: 'drawn', at: AMAGOI_RECEIVER_TIP }, LeftHand: { joint: 'LeftHand', of: 'drawn' } },
    socket: ctx => amagoiStrikeJoint(ctx.state.action, ctx.clip, ctx.index ?? ((ctx.time ?? 0) < .955 ? 0 : 1)),
  },
  irbis: { unarmed: true, socket: ctx => ({ joint: irbisStrikeJoint(ctx.state.action, ctx.shownClip, ctx.index), of: 'drawn' }) },
  minase: { socket: ctx => ({ joint: `${minaseStrikeSide(ctx.shown.state.action, ctx.shownTime, ctx.shownClip, ctx.index)}Hand`, of: 'shown' }) },
  kusushi: { socket: ctx => ({ joint: kusushiStrikeSocket(ctx.shown.state.action, ctx.shownTime, ctx.shownClip, ctx.index), of: 'shown' }) },
  ume: {
    points: { Left: { joint: 'LeftHand', of: 'shown' }, Right: { joint: 'RightHand', of: 'shown' }, Both: { first: [{ mid: ['Right', 'Left'] }, 'Right'] } },
    socket: ctx => umeStrikeSide(ctx.shown.state.action, ctx.shownTime, ctx.shownClip, ctx.index),
  },
  hikui: { socket: { joint: 'RightHand', of: 'shown' } },
  onigawara: { socket: { joint: 'RightHand', of: 'shown' } },
  cardo: { socket: { node: 'CardoBladeTip', of: 'shown', at: [0, 0, 0] } },
  bruin: { socket: { node: 'BruinBladeTip', of: 'shown', at: [0, 0, 0] } },
  aquilo: { socket: ctx => ({ joint: `${aquiloStrikeSide(ctx.shown.state.action, ctx.shownClip)}Hand`, of: 'shown' }) },
  svanhild: { socket: ctx => ({ joint: svanhildStrikeJoint(ctx.state.action, ctx.clip), of: 'shown' }) },
  hakushi: {
    points: {
      // His toad oil from the mouth: ahead of and above his head, at his scale.
      Mouth: solve((ctx, out) => {
        const head = ctx.shown.joints.get('Head');
        if (!head) return false;
        head.getWorldPosition(out);
        const size = ctx.shown.group.getWorldScale(scale).x;
        forward.set(0, 0, 1).transformDirection(ctx.shown.group.matrixWorld);
        out.addScaledVector(forward, HAKUSHI_MOUTH_OFFSET.forward * size).addScaledVector(UP, HAKUSHI_MOUTH_OFFSET.up * size);
        return true;
      }),
    },
    socket: ctx => { const socket = hakushiStrikeSocket(ctx.shown.state.action, ctx.shownTime, ctx.shownClip, ctx.index); return socket === 'Mouth' ? 'Mouth' : { joint: socket, of: 'shown' }; },
  },
  suzuran: { points: { Both: 'handLR', Left: 'handL', Right: 'handR' }, socket: ctx => suzuranStrikeSide(ctx.state.action, ctx.elapsed, ctx.clip, ctx.index) },
  // 15 October 2026 ("rxc"): his first and fourth lights are baked takes thrown with the RIGHT hand (Jirenga's Bedrock Jab under
  // Tide Palm, Sekka's Air Type under Rush 3: scripts/night/anim/picks.json), where the native clips struck with the left:
  // the blow's effect leaves the hand that throws it. The rest strike with the hand oyashioStrikeSide names.
  oyashio: { points: { Both: 'handLR', Left: 'handL', Right: 'handR' }, socket: ctx => ctx.state.action === 'light' && (ctx.clip === 'Tide Palm' || ctx.clip === 'Rush 3') ? 'Right' : oyashioStrikeSide(ctx.state.action, ctx.elapsed, ctx.clip) },
  // --- Hands and feet by clip ------------------------------------------------------------------------------------------
  mikage: { socket: ctx => {
    const joint = ({ 'Pounce Heel': 'RightFoot', 'Aerial Pounce Heel': 'RightFoot', 'Tailwhip Heel': 'LeftFoot', 'Rush 3': 'LeftFoot', 'Rush 1': 'LeftHand', 'Velvet Elbow': 'RightForeArm' } as Record<string, string>)[ctx.clip ?? ''];
    return joint ? { joint } : undefined;
  } },
  senko: {
    points: { finger: always((ctx, out) => senkoFingerPoint(ctx.body, out)) },
    socket: ctx => ctx.clip === 'Fingertip Glare' ? 'finger' : { joint: senkoStrikeJoint(ctx.clip, ctx.time ?? 0, ctx.index ?? 0) },
  },
  // Launch night (12 October 2026): only his strike, and only where it is not the default's right hand - Scarlet Wing, the
  // heavy, is his left's (tanchoStrikesLeft). Its contact and charge stay undeclared, as every other move of his.
  tancho: { strike: ctx => tanchoStrikesLeft(ctx.state.action, ctx.ender(ctx.state)) ? 'handL' : undefined },
  // 13 October 2026 ("ol2"): only his strike, and only in his second light, which is a left since his lights became the
  // Last Sun trio's (scripts/night/anim/picks.json: Wuming's second): the ki on the fist (ShanxiaoRampage) and the smear behind it
  // (StrikeTrails) were drawn on his right while his left landed. By the clip drawn, so the air string's second stage
  // (Mauler Backfist, a right) keeps the default. Contact and charge stay undeclared, as every other move of his.
  shanxiao: { strike: ctx => ctx.shownClip === 'Rush 1' ? 'handL' : undefined },
  tempo: { socket: ctx => ({ joint: tempoStrikeJoint(ctx.state.action, ctx.clip, ctx.index === undefined && ctx.state.action === 'ultimate' ? nearest(ctx) : ctx.index) }) },
  unari: { socket: ctx => ({ joint: unariStrikeJoint(ctx.state.action, ctx.clip, ctx.index === undefined && ctx.state.action === 'ultimate' ? nearest(ctx) : ctx.index) }) },
  lanthorn: {
    points: { LeftHand: { first: [solve((ctx, out) => lanthornBladePoint(ctx.body, out)), { joint: 'LeftHand', of: 'shown' }] }, RightHand: { joint: 'RightHand', of: 'shown' } },
    socket: ctx => lanthornStrikeJoint(ctx.shown.state.action, ctx.shownClip),
  },
  // --- Measured by its own module: a surface, an arm pose, a weapon's far end ------------------------------------------
  bonsho: { socket: bonshoPoint, strike: { first: [bonshoPoint, 'root'] }, charge: { first: [bonshoPoint, 'root'] } },
  hagure: { socket: solve((ctx, out) => {
    const body = ctx.shown, t = ctx.shownTime;
    // Receipt index wins; intermediate coatings follow actual source contacts.
    const contact = ctx.index ?? (t < .74 ? 0 : t < 1.335 ? 1 : t < 1.93 ? 2 : t < 2.625 ? 3 : 4);
    const hand = body.joints.get(hagureStrikeJoint(body.state.action, ctx.shownClip, contact));
    if (!hand) return false;
    hagureSurfacePoint(hand, ctx.shownForm, body.state.action, ctx.shownClip, contact, out);
    return true;
  }) },
  'rakucho': { socket: solve((ctx, out) => {
    const t = ctx.shownTime, contact = ctx.index ?? (t < .85 ? 0 : t < 1.575 ? 1 : t < 2.485 ? 2 : 3);
    return rakuchoContactPoint(ctx.body, ctx.state.action, ctx.shownClip, contact, out);
  }) },
  kubiwa: { socket: solve((ctx, out) => {
    const t = ctx.time ?? 0, contact = ctx.index ?? (t < .91 ? 0 : t < 1.635 ? 1 : t < 2.425 ? 2 : 3);
    return kubiwaCommandPoint(ctx.body, out, kubiwaStrikeJoint(ctx.state.action, ctx.clip, contact) === 'LeftHand' ? 'Left' : 'Right');
  }) },
  murex: { socket: solve((ctx, out) => {
    const state = ctx.shown.state, moves = MOVES.murex.ultimate.contacts;
    const contact = ctx.index ?? (state.action === 'ultimate' && state.actionTime * state.actionDuration > (moves[0] + moves[1]) * .5 ? 1 : 0);
    return murexStrikePoint(ctx.body, out, ctx.shownClip, contact);
  }) },
  'psyche': { socket: solve((ctx, out) => psycheStrikePoint(ctx.body, out, ctx.body.displayedClipName, ctx.body.displayedClipTime, ctx.index)) },
  // (The receipt's contact index owns which hand; between receipts the drawn clip's clock does, the left beckon too.)
  'madake': { socket: always((ctx, out) => madakeStrikePoint(ctx.shown, out, ctx.shownClip, ctx.shownTime, ctx.index)) },
  strappado: { socket: always((ctx, out) => strappadoStrikePoint(ctx.body, out, ctx.clip, ctx.time, ctx.index)) },
  barrow: { socket: always((ctx, out) => barrowStrikePoint(ctx.body, out, ctx.clip, ctx.time, ctx.index)) },
  torsion: { socket: always((ctx, out) => torsionStrikePoint(ctx.body, out, ctx.clip, ctx.time, ctx.index)) },
  'shibuichi': { socket: always((ctx, out) => shibuichiStrikePoint(ctx.body, out, ctx.clip, ctx.time, ctx.index)) },
  'shakudo': { socket: always((ctx, out) => shakudoStrikePoint(ctx.body, out, ctx.clip, ctx.time, ctx.index)) },
  wataame: { socket: solve((ctx, out) => wataameBokkenPoint(ctx.body, out)) },
  buna: { socket: always((ctx, out) => bunaMastBreakerPoint(ctx.body, out)) },
  kinu: { socket: solve((ctx, out) => {
    const stand = standBody(ctx);
    if (!stand) return false;
    const { state, contact } = standContact(ctx, stand, 'kinu'), clip = stand.displayedClipName;
    const joint = stand.joints.get(kinuStrikeJoint(state.action, clip, contact));
    if (!joint) return false;
    kinuSpiritSurfacePoint(joint, clip, contact, out);
    return true;
  }) },
  gosu: { socket: solve((ctx, out) => {
    const stand = standBody(ctx);
    if (!stand) return false;
    const { contact, alternate } = standContact(ctx, stand, 'gosu');
    const joint = stand.joints.get(alternate && contact % 2 === 1 ? 'LeftHand' : 'RightHand');
    if (!joint) return false;
    joint.getWorldPosition(out);
    return true;
  }) },
  // --- Contacts and charges of their own ---------------------------------------------------------------------------------
  'full-beam': { contact: solve((ctx, out) => fullBeamContact(ctx.body, ctx.index ?? 0, out, ctx.clip)) },
  pyroclast: { charge: always((ctx, out) => pyroclastPalm(ctx.body, 'Right', out)), contact: solve((ctx, out) => pyroclastContact(ctx.body, ctx.index ?? 0, out, ctx.clip)) },
  ampere: { charge: always((ctx, out) => ampereSocket(ctx.body, 'RightHandIndex3', out)), contact: solve((ctx, out) => ampereContact(ctx.body, ctx.index ?? 0, out, ctx.clip)) },
  shakugo: { charge: always((ctx, out) => shakugoMagmaSocket(ctx.body, 'Left', out)), contact: solve((ctx, out) => shakugoMagmaContact(ctx.body, out, ctx.clip)) },
  kuzu: { charge: solve((ctx, out) => kuzuSawContact(ctx.body, 0, out, ctx.clip)), contact: solve((ctx, out) => kuzuSawContact(ctx.body, ctx.index ?? 0, out, ctx.clip)) },
  'basilissa': { charge: always((ctx, out) => boaFingertip(ctx.body, out)), contact: solve((ctx, out) => boaHeelContact(ctx.body, ctx.index ?? 0, out)) },
  // Sashigane's blade: his charge and his contacts are where it strikes.
  sashigane: { charge: 'strike', contact: 'strike' },
  // Kosho's kicks land with his right foot; Tobari's Murder of Crows heavy with his left (its trail was drawn off the kunai).
  kosho: { contact: { always: { joint: 'RightFoot' } } },
  tobari: { contact: ctx => ctx.state.action === 'heavy' ? { always: { joint: 'LeftFoot' } } : undefined },
  ward: { contact: ctx => (ctx.state.action === 'special' || ctx.state.action === 'ultimate') && ctx.body.slotClip(ctx.state, ['Cautery Blade', 'Counter Shock', CROSSMATCH_TAKE.open.clip]) ? 'handL' : undefined },
  // Yuragi's fire leaves both palms; Gaunt' Cleave wave his GRAVEDIGGER's edge and his cannon his iron left arm; Dorado's
  // Sovereign Shot his flintlock; Shiun's GLASS LANCES gathers between his wings; Taisei's ki in both hands, and
  // Ouga's for his Shikou-Ha and Kyokko-Ho - drawn toward his knuckles, where his fists are.
  kagari: { charge: ctx => ctx.state.action === 'heavy' && !ctx.state.branch ? 'handRL' : undefined },
  gaunt: { charge: ctx => ctx.state.action === 'heavy' && !ctx.state.branch ? 'strike' : 'handL' },
  dorado: { charge: ctx => ctx.state.action === 'special' ? 'handL' : undefined },
  shiun: { charge: ctx => ctx.state.action === 'special' ? solve((c, out) => {
    const group = c.body.group;
    out.set(group.position.x - Math.sin(group.rotation.y) * .35, group.position.y + 1.55, group.position.z - Math.cos(group.rotation.y) * .35);
    return true;
  }) : undefined },
  taisei: { charge: 'handRL' },
  ouga: { charge: ctx => ctx.state.action === 'special' || ctx.state.action === 'ultimate' ? 'handRL' : undefined, hands: { toward: 'handmiddle1', by: .65 } },
  // Konta: Kurobi's beast bomb at his jaws; the Senpugan in his palm, the Galewheel held up over it, the Bushin's
  // between both hands - a combo ender from his hand wherever its own take holds it.
  konta: {
    formHands: 'awakened',
    charge: always((ctx, out) => {
      const body = ctx.body, state = ctx.state;
      if (ctx.formBody && state.awakened) return ctx.formBody.chargePosition(out);
      if (ctx.form && ctx.head) {
        ctx.head.getWorldPosition(out);
        const size = body.group.getWorldScale(scale).x;
        return out.addScaledVector(forward.set(0, 0, 1).transformDirection(body.group.matrixWorld), .3 * size);
      }
      out.copy(body.handR);
      if (state.action === 'ultimate') return out.lerp(body.handL, .5);
      const own = !body.slotClip(state);
      if (state.action === 'special' && !own) return out.addScaledVector(UP, .15);
      if (state.action === 'heavy' && !own && ctx.rightHand) {
        // Finger bones are present in the rig but intentionally absent from the canonical body-joint map.
        const index = body.bones.get('righthandindex1'), pinky = body.bones.get('righthandpinky1'), middle = body.bones.get('righthandmiddle1');
        if (index && pinky && middle) {
          ctx.rightHand.getWorldPosition(out);
          const fingers = middle.getWorldPosition(forward).sub(out).normalize();
          const normal = index.getWorldPosition(across).sub(pinky.getWorldPosition(other)).cross(fingers).normalize();
          return out.addScaledVector(fingers, .07).addScaledVector(normal, .14);
        }
      }
      return out.addScaledVector(forward.set(Math.sin(body.group.rotation.y), 0, Math.cos(body.group.rotation.y)), .08).addScaledVector(UP, .04);
    }),
  },
  // Gorai's man-beast and Magatsu's Heian form carry weapons of their own: while the form is drawn in the body's place,
  // the form's strike; on the form, Magatsu's lower arms strike with spear and dagger.
  gorai: { strike: 'form strike' },
  magatsu: { strike: { first: ['form strike', magatsuWeapon] } },
};

/** The context a body fills for each ask (Fighter.socket), kept and filled again. */
export type SocketAsk = { -readonly [K in keyof SocketContext]: SocketContext[K] };
export function socketAsk(body: Fighter, contacts: () => readonly number[], ender: (state: PlayerState) => string | undefined): SocketAsk {
  return { body, shown: body, state: body.state, clip: undefined, time: undefined, phase: 0, shownClip: undefined, shownTime: 0, shownPhase: 0,
    elapsed: 0, form: false, shownForm: false, formBody: undefined, index: undefined, contacts, ender, head: undefined, rightHand: undefined };
}

/** A joint, bone or node of the body asked or the one drawn. */
function nodeOf(ctx: SocketContext, point: { joint?: string; bone?: string; node?: string; of?: 'own' | 'shown' | 'drawn' }) {
  const body = point.of === 'shown' ? ctx.shown : ctx.body;
  if (point.joint !== undefined) return point.of === 'drawn' ? ctx.body.drawnJoint(point.joint) : body.joints.get(point.joint);
  if (point.bone !== undefined) return body.bones.get(point.bone);
  return named(body.model, point.node!);
}

/** Places a point (a fighter's named point or a point) in `out`: false where it cannot be. */
function placeIn(ctx: SocketContext, point: SocketPoint | string, out: THREE.Vector3, points?: Readonly<Record<string, SocketPoint>>): boolean {
  if (typeof point === 'string') {
    switch (point) {
      case 'handR': out.copy(ctx.body.handR); return true;
      case 'handL': out.copy(ctx.body.handL); return true;
      case 'handRL': out.copy(ctx.body.handR).lerp(ctx.body.handL, .5); return true;
      case 'handLR': out.copy(ctx.body.handL).lerp(ctx.body.handR, .5); return true;
      case 'strike': ctx.body.strikePoint(out); return true;
      case 'form strike': if (!ctx.formBody || ctx.form) return false; ctx.formBody.strikePoint(out); return true;
      case 'root': out.copy(ctx.body.group.position); return true;
    }
    const own = points?.[point];
    return own !== undefined && placeIn(ctx, own, out, points);
  }
  if ('solve' in point) return point.solve(ctx, out);
  if ('first' in point) { for (const each of point.first) if (placeIn(ctx, each, out, points)) return true; return false; }
  if ('mid' in point) {
    if (!placeIn(ctx, point.mid[0], out, points)) return false;
    const second = new THREE.Vector3();
    if (!placeIn(ctx, point.mid[1], second, points)) return false;
    out.lerp(second, .5);
    return true;
  }
  if ('always' in point) { placeIn(ctx, point.always, out, points); return true; }
  const node = nodeOf(ctx, point);
  if (!node) return false;
  if (!point.at) node.getWorldPosition(out);
  else if (point.stale) out.set(point.at[0], point.at[1], point.at[2]).applyMatrix4(node.matrixWorld);
  else node.localToWorld(out.set(point.at[0], point.at[1], point.at[2]));
  return true;
}

/** Where a fighter's socket is now, as its declaration places it, in `out`; false where it declares none for `kind` or
 *  its point cannot be placed (Fighter then falls back: a strike to its blade's reach or its right hand, a charge to its
 *  right hand, a contact to no answer). */
export function placeSocket(kind: SocketKind, ctx: SocketContext, out: THREE.Vector3): boolean {
  const sockets = FIGHTER_SOCKETS[ctx.state.fighter];
  const rule = sockets?.[kind] ?? sockets?.socket;
  if (rule === undefined) return false;
  const point = typeof rule === 'function' ? rule(ctx) : rule;
  return point !== undefined && placeIn(ctx, point, out, sockets!.points);
}

/** A joint, bone or node a declaration names. */
export interface DeclaredNode { readonly kind: 'joint' | 'bone' | 'node'; readonly name: string }
/** Every joint, bone and node a fighter's declared points name - each as the alternatives it may be found as (a `first`
 *  chain's), one of which must be on the body or its form - for the tests (tests/fighterSockets.test.ts): the ones whose
 *  names are written here, not those a selector or a measuring module chooses as it goes. */
export function declaredNodes(fighter: FighterId): DeclaredNode[][] {
  const out: DeclaredNode[][] = [], sockets = FIGHTER_SOCKETS[fighter];
  const named = (point: SocketPoint | string | undefined): DeclaredNode[] => {
    if (point === undefined || typeof point === 'string') return [];
    if ('first' in point) return point.first.flatMap(named);
    if ('mid' in point || 'always' in point || 'solve' in point) return [];
    if ('joint' in point && point.joint !== undefined) return [{ kind: 'joint', name: point.joint }];
    if ('bone' in point && point.bone !== undefined) return [{ kind: 'bone', name: point.bone }];
    return 'node' in point ? [{ kind: 'node', name: point.node }] : [];
  };
  const walk = (point: SocketPoint | string | undefined): void => {
    if (point === undefined || typeof point === 'string') return;
    if ('mid' in point) { point.mid.forEach(walk); return; }
    if ('always' in point) { walk(point.always); return; }
    if ('first' in point) { const any = named(point); if (any.length) out.push(any); point.first.forEach(each => { if (typeof each !== 'string' && ('mid' in each || 'always' in each)) walk(each); }); return; }
    const one = named(point);
    if (one.length) out.push(one);
  };
  for (const point of Object.values(sockets?.points ?? {})) walk(point);
  for (const rule of [sockets?.socket, sockets?.strike, sockets?.contact, sockets?.charge]) if (rule !== undefined && typeof rule !== 'function') walk(rule);
  return out;
}
