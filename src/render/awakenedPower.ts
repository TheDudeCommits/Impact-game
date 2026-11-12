import { FIGHTERS } from '../config';
import { AWAKENINGS } from '../game/awakening';
import type { FighterId } from '../game/types';
import { homeSeries } from '../ui/HomeRosterOrder';
import { applyOriginalWorlds } from '../originals/apply';
import { applyOriginalPowers } from '../originals/akaganeBurst';
import type { CoatPart } from './vfx/LacquerCoat';
import { SHELL, type ShellLook } from './vfx/AuraShell';
import type { MoteKind } from './vfx/powerup/Motes';


/** How an awakening arrives and what the power does round the fighter while it lasts (PowerUp):
 *  ki      Last Sun's: the flame erupting from the floor through the transformation, its lightning, then the
 *          smaller aura;
 *  will    Dust Sea's: black lightning in a crimson or purple glow, the floor cracking under the pressure, a dark haze
 *          lifting off them, never a flame;
 *  pressure Cinder Requiem's: raw pressure - a pillar of it standing out of them on the release, then a weight that
 *          streams upward off them like smoke while the floor rings under it and its grit lifts;
 *  chi  Konta's: it winds up off the floor round them and its wind is flung out, then it is worn as a cloak that
 *          clings and boils - never a flame;
 *  cursed  Hex Fallout's hex energy: a dark flame, near black with its colour at the edge, and red-black sparks;
 *  aura     Salvage Wilds's: Lion\'s Roar swelling out of them smooth and even, then a dense still shroud;
 *  plain   the floor gives way and the room goes dark; the transformation itself is the rest. */
export type PowerKind = 'ki' | 'will' | 'pressure' | 'chi' | 'cursed' | 'aura' | 'plain';
/** What hugs the body for as long as the awakening lasts (AuraShell's looks): `flame` is the gold awakening's shell;
 *  `haze` is Will's dark, a pressure standing off the outline with no flame and no light in it; `smoke` is pressure,
 *  thin against the body and streaming up off the shoulders in long torn wisps; `cloak` is chi, clinging and boiling;
 *  `curse` is hex energy's dark flame; `shroud` is Aura, smooth, dense and even. */
export type ShellStyle = 'flame' | 'haze' | 'smoke' | 'cloak' | 'curse' | 'shroud';

export interface AwakenedPower {
  kind: PowerKind;
  /** The aura worn on the body while it lasts, where this world's power is worn as one. */
  shell?: ShellStyle;
  /** How strongly a standing shell's light and tint colour its own fighter, 0..1 (what `auraGlow` is to a definition
   *  that burns). The definition's own where it burns, else the shop's three tenths. Nothing where the power is not
   *  light (Will's haze). */
  glow?: number;
  /** The shell's two colours, core then rim, where they are the power's and not the fighter's aura's. */
  colours?: readonly [number, number];
  /** Where a fighter's shell is worn a little differently from its style's (AuraShell's `SHELL`). */
  look?: Partial<ShellLook>;
  /** The look stands on a transformation's own body as well (a form, a summon). Without it a body of its own is the
   *  transformation and nothing is worn over it: "a fox, a Guardian, six arms ... are each the transformation". */
  onForm?: boolean;
  /** ki: the flame crackles with lightning while it burns (the Last Sun pair's and their rivals'). */
  electric?: boolean;
  /** Lightning worn on the body itself for as long as it lasts, and its colour (sRGB hex): Ampere's full-body lightning. */
  arcs?: number;
  /** will: the glow round the black lightning (crimson unless said). */
  edge?: number;
  /** will: the commanding kind - the full crackle, the floor and the pressure. Without it the fighter has only the other two
   *  colours of Will (or none, in the story): it crackles thinner and more rarely, and the room is left alone. */
  sovereign?: boolean;
  /** will: lacquer, hardened - what the fighter strikes with gone lacquer black while it lasts (vfx/LacquerCoat.ts):
   *  the fists, the shins, the blade. Only where the story hardens it and the body shows it. */
  coat?: readonly CoatPart[];
  /** What comes off the body besides (vfx/powerup/Motes.ts) and the two colours it is drawn in: a fighter's own power's
   *  signature over the Will - light, magma, sand, darkness. */
  motes?: readonly [MoteKind, number, number];
  /** Awakened with no energy to show: nothing is drawn on the body, and the floor says it instead. */
  physical?: boolean;
}

const shade = (hex: number, k: number) => Math.round((hex >> 16 & 255) * k) << 16 | Math.round((hex >> 8 & 255) * k) << 8 | Math.round((hex & 255) * k);
const HAZE_CORE = 0x060206;
/** Will's edge colours: the crimson of Gummy's and Sorrel's, the violet Gorai's and Barrow's runs, the gold the
 *  game gives Dorado's, the green of Kenzo's King of Hell. */
export const WILL_EDGE = { crimson: 0xff1a2e, violet: 0xa838ff, gold: 0xffb020, green: 0x3fe07a, rose: 0xff3fa0 } as const;

/** The shop's strength (Ippon, Levin): the shell reads at a glance from the gameplay camera and its light does not
 *  cinder-requiem the body. */
export const SHOP_GLOW = .3;
/** The world a fighter falls back to where theirs has no row: the floor and the dark, and nothing worn. (The night
 *  before, it was the smaller aura in their own colour - Last Sun's shell on every world that had no look of its
 *  own. A world with no power to show shows none; what a fighter of it has is their own row's.) */
const ELSEWHERE: AwakenedPower = { kind: 'plain' };

/** Each world's power, by series (`homeSeries`). */
export const WORLDS: Readonly<Record<string, AwakenedPower>> = {
  // The aura itself: the flame through the transformation, then the shell. As it was.
  // (On a form's body as on a Golden's own: Shanxiao's gold awakening and ABYSSAL TIDE stood nothing once the flame
  // had come down, and the aura is this world's whole look.)
  'Last Sun': { kind: 'ki', shell: 'flame', electric: true, onForm: true },
  // Will, for all twenty-three, on a form's body too: no shell, no flame. The elemental powers keep their own signature
  // over it (their body castings and signature layers), but the awakened state itself is Will.
  'Dust Sea': { kind: 'will', shell: 'haze', glow: 0, onForm: true },
  // Pressure, on an Unsealed's or a release's body as on a swordsman's own, each in their own colour (`OWN`).
  'Cinder Requiem': { kind: 'pressure', shell: 'smoke', onForm: true },
  // Chi: a cloak that clings and boils, not a flame. The fox and the Guardian are each the whole transformation and
  // wear nothing over them; the sage form and the IRON BLOSSOM are worn on their fighter's own form (`OWN`).
  'Ashwood': { kind: 'chi', shell: 'cloak', motes: ['bubble', 0xbfe4ff, 0x3f8cff] },
  // Hex Energy: a dark flame licking up the body, near black, its colour at the edge, and red-black sparks.
  'Hex Fallout': { kind: 'cursed', shell: 'curse', colours: [0x0a1030, 0x3f8cff] },
  // Aura: a smooth dense shroud.
  'Salvage Wilds': { kind: 'aura', shell: 'shroud' },
  // A power is each hero's own, and none of them is an aura: nothing is worn by default (`OWN`).
  'Beacon Ward': { kind: 'plain' },
  // The breathing's element round the blade, and no aura on the body.
  'Black Snow': { kind: 'plain', motes: ['flame', 0xffb441, 0xe84b26] },
  // No powers and no auras: the steam of a Colossus's body, and the gas of the gear on a soldier's hips.
  'Ropewalk': { kind: 'plain', motes: ['steam', 0xffffff, 0xc4ccd4], onForm: true },
  // Alchemy: the blue lightning of a transmutation, on whoever is transmuting.
  'Slag Hill': { kind: 'plain', arcs: 0x6fd0ff },
  // An awakened Red Cradle unit: the halo over its head, its barrier field answering on the air round it, and its body alight -
  // a thin even glow, not a flame. (Filmed with the halo and the rings alone, neither unit read as awakened from the
  // gameplay camera, and Rotfalke's form is drawn like the unit she starts in.)
  'Red Cradle': { kind: 'plain', shell: 'shroud', glow: .2, colours: [0xff8a2a, 0xd8301a], look: { thick: .06, alpha: .6 },
    motes: ['ripple', 0xffb060, 0xff5a1a], onForm: true },
  // Mana: each mage's own magic standing off them (`OWN`); a world with no aura of its own.
  'Briar Crown': { kind: 'plain' },
};
applyOriginalWorlds(WORLDS as Record<string, AwakenedPower>);

/** Where a fighter's own awakening is more specific than their world's. */
const OWN: Readonly<Partial<Record<FighterId, Partial<AwakenedPower>>>> = {
  // ----- Last Sun
  // (Shanxiao's gold awakening's ki does not crackle: as it was.)
  shanxiao: { electric: false },
  cardo: { kind: 'cursed', shell: undefined, glow: 0, colours: [0x050506, 0x5a0a08], coat: ['arms'], motes: undefined },
  // (Round 7: WIDE AWAKE is a thin dark-violet outline round him, where the blind critic saw "a thick
  // smoky aura". Thin, and no gloom drifting off him.)
  // (Round 10, blind critic 3: the WIDE AWAKE "only a faint dark fringe ... lost against his dark clothes; target: a crisp, thin
  // violet rim that stays readable in play": the edge a brighter violet, the haze near opaque.)
  // (Round 11, blind critic 4: "a thick, saturated outline swells into a purple puff ... target: a thin dark-violet rim and
  // nothing more": between round 9's and round 10's.)
  bruin: { kind: 'plain', shell: 'haze', glow: 0, colours: [0x0a0414, 0x8a44e0], look: { thick: .015, alpha: .7 }, motes: undefined },
  // (No white glints: from behind they were "bright white orbs drift around him" - critic pass 5; the wing, the arm and
  // the crown carry WINDBORNE. Round 7: no Aura shroud either - the awakening changes only his left side, and the shroud
  // drew a green rim round the whole of him (the blind critic) - so a few of Sylph's mint specks on the wind instead.)
  aquilo: { kind: 'aura', shell: undefined, glow: .15, colours: [0x8ff0b4, 0x1c6b47], motes: ['glint', 0x6fe0a0, 0x1c6b47] },
  // (Round 13, blind critic 5: "a cyan rim glow that bleaches her face" over the Valkyrie armour: the shroud thin and faint,
  // so the armour itself is what reads.)
  svanhild: { kind: 'plain', shell: 'shroud', glow: .05, colours: [0x5ec8ff, 0x0b4a8c], look: { thick: .015, alpha: .3 }, motes: ['bubble', 0xbfe4ff, 0x3f8cff] },
  // ----- Dust Sea. The commanding ones, by the story: the rest crackle thinner. The edge is crimson unless said.
  // (Gummy keeps SUNRISE and his clouds: SUNRISE's white is not worn under a dark haze. The lightning is his still.)
  gummy: { sovereign: true, shell: undefined }, kenzo: { sovereign: true, edge: WILL_EDGE.green, coat: ['weapon'] },
  sorrel: { sovereign: true, coat: ['weapon'] }, dorado: { sovereign: true, edge: WILL_EDGE.gold, coat: ['weapon'] },
  haldor: { sovereign: true, coat: ['weapon'] }, gorai: { sovereign: true, edge: WILL_EDGE.violet, coat: ['weapon'] },
  buna: { sovereign: true, coat: ['weapon'] }, strappado: { sovereign: true, edge: WILL_EDGE.rose, coat: ['legs'] },
  'basilissa': { sovereign: true, edge: WILL_EDGE.rose, coat: ['legs'] }, kagari: { sovereign: true },
  barrow: { edge: WILL_EDGE.violet, coat: ['hands'], motes: ['gloom', 0x2a1838, 0x05020a] }, strix: { coat: ['weapon'] },
  // The elemental powers' and the sea-folk's own signatures, over the Will. (Tokan's frost, Adad's lightning and Sorayomi's
  // weather stand already: their body castings and her own layer. Kagari's fire and Kosho's are their limbs', Ward's his
  // ROOM, Haldor's the air cracking in his hand.)
  oyashio: { coat: ['hands'], motes: ['spray', 0xe8fdff, 0x42c4df] }, senko: { motes: ['glint', 0xfff3c0, 0xf9c238] },
  shakugo: { motes: ['ember', 0xffb040, 0xb01c08] }, aqrab: { motes: ['sand', 0xe9d3a0, 0xa57c45] },
  'psyche': { motes: ['petal', 0xffb8dc, 0xd0508c] },
  // ----- Konta. Chi is blue unless it is somebody's own: Amagoi's violet, Suzuran's lavender lions (their auras').
  amagoi: { motes: ['bubble', 0xd8c4ff, 0x7a4ad8] }, suzuran: { motes: ['bubble', 0xe8f0ff, 0xbaa9f0] },
  // the sage form and the IRON BLOSSOM are bodies of their own that look like the fighter's: the chi is worn
  // on them, thin, so the awakened state reads from behind as well as by the marks on the face.
  minase: { onForm: true, glow: .2, colours: [0xffd24a, 0xd88a10], motes: ['bubble', 0xfff0b0, 0xffb020] },
  hakushi: { onForm: true, glow: .2, colours: [0xffa24a, 0xc8501a], motes: ['bubble', 0xffd0a0, 0xe86a20] },
  ume: { onForm: true, glow: .2, colours: [0xff9ccc, 0xc24a8a], motes: ['bubble', 0xffd0e6, 0xf06aa8] },
  kusushi: { onForm: true, glow: .2, colours: [0x8ff0c0, 0x2aa86a], motes: ['bubble', 0xd8ffe8, 0x4ad890] },
  // EVERGREEN: not a cloak. The steam of a body burning itself, red at the EVERGREEN, streaming off him.
  'madake': { shell: 'smoke', onForm: true, colours: [0x7dffb0, 0x0f7a3c], motes: ['steam', 0xc8ffe0, 0x2fb86a] },
  akaito: { colours: [0x160c2c, 0xff9ee6] }, sashigane: { colours: [0x0a1030, 0x58b8ff] },
  // The CALAMITY RISEN' is red, on the four-armed body as it would be on Tempo's.
  magatsu: { onForm: true, colours: [0x16040a, 0xff2a3a] },
  // ----- Salvage Wilds. (Imago's and Bonsho's and Unari's shrouds are their auras' colours.)
  // ----- Beacon Ward: the power itself.
  // full-body lightning: green lightning over the whole body, on his hero suit.
  ampere: { arcs: 0x35ff8a },
  // furnace flame is worn: his body burns, and that is a flame.
  bellows: { shell: 'flame', motes: ['ember', 0xffc060, 0xe8421a] },
  // Explosion: sparks popping at the palms. Fire and frost: frost off him (his fire is his body casting's).
  pyroclast: { motes: ['pop', 0xffd27a, 0xff791e] }, tancho: { motes: ['frost', 0xf4ffff, 0x8fe0f5] },
  // Last Watch's embers: wind and steam off a body past its limit, and no aura.
  'full-beam': { motes: ['steam', 0xfffbee, 0xd8c890] },
  // ----- Black Snow. (Yodaka's flame and Asahi's sun are the row's; Sekka is a demon, with no breath: the
  // snow of his Aurora Shards drifts round him.)
  asahi: { motes: ['flame', 0xffa040, 0xff4a10] }, sekka: { motes: ['frost', 0xd8ecff, 0x6a9cff] },
  // ----- Everyone else, by the same rule: what their own story shows, and never Last Sun's flame for want of it.
  // Levin's and Mizuhiki's awakening is drawn as lightning through them: thin, pale, over the gear's gas.
  levin: { arcs: 0xd8ffe8 }, mizuhiki: { arcs: 0xffe0e0 },
  // Blast Radius. An esper's power is a green glow on her and the rubble she lifts; Ippon, serious, has no aura at
  // all - the air round him moves; Moonless Hagure is a body of stars.
  torsion: { shell: 'shroud', motes: ['rubble', 0xbfffe0, 0x5dffac] }, ippon: { motes: ['steam', 0xfff6e0, 0xd8b890] },
  hagure: { motes: ['glint', 0xdfe6ff, 0x8e87ff] },
  // Penance Road. AFTER HOURS is darkness worn on the body; Highsun at noon is the sun's own radiance.
  lanthorn: { shell: 'curse', onForm: true, colours: [0x0a0612, 0x8a3fd8] },
  highsun: { shell: 'shroud', onForm: true, colours: [0xffd870, 0xffa020] },
  // Scrap Pact. No aura in it: the CONDUCTOR's presence is a weight on the air (a haze, as Will's is, with no
  // lightning in it); a chainsaw revving throws sparks.
  kubiwa: { shell: 'haze', glow: 0, colours: [0x0a0406, 0x8a1c1c] }, kuzu: { motes: ['pop', 0xffe0a0, 0xff8a2a] },
  // Crimson Ledger. SCARLET BLOOM: Nightblade's curse on her own body, its markings and a red-black dark off them -
  // the body she wakes into is drawn like her own, and this is what says it is not. Hisame's is her ice.
  akayuri: { shell: 'curse', onForm: true, colours: [0x14040c, 0xdd2949] }, hisame: { motes: ['frost', 0xffffff, 0x9fe5ff] },
  // The GRAVE PLATE lets the Beast of Darkness out: a black dark off him, edged in the red of its eye.
  gaunt: { shell: 'curse', onForm: true, colours: [0x0a0508, 0xe0202a] },
  // The Unbound: Violet Balefire, absorbed: black fire on him, edged in the third eye's violet. (His form's body too
  // is drawn like his own.)
  hikui: { shell: 'curse', onForm: true, colours: [0x08050c, 0x9a55e0] },
  // The HOLLOW CROWN's shadow: black, edged in violet.
  'rook': { shell: 'curse', onForm: true, colours: [0x0a0614, 0x7a4df8] },
  // Ovid at full release: the light in the seams of his body arcing over it, and the steam off it.
  'ovid': { arcs: 0x57f0d0, motes: ['steam', 0xe8fff8, 0x8ad8c8] },
  // Lantern Ward has no powers: the White Yaksha is a man and a wooden sword. The floor says it, as it does for Chohan.
  wataame: { physical: true },
  nigo: { colours: [0x0b0a12, 0xe01a30], look: { band: .26, soft: .2, alpha: 1 } }, shiun: { colours: [0xb070ff, 0x3a1070] },
  onigawara: { colours: [0xffd42a, 0xa86a00] }, irbis: { colours: [0x58c8ff, 0x0b4ec2] },
  shidare: { colours: [0xff9ed2, 0xc23f86], motes: ['petal', 0xffc4e4, 0xe0559e] },
  // (Old Fire is fire: his pressure is the colour of it, and streams as fire does.)
  hinomoto: { colours: [0xffa53a, 0xd8361a] },
  // (WHITE SILENCE is white from hair to hem: a white pressure on it is one white glare, so hers is the ice's blue
  // edged in white, and half as bright on her.)
  shijima: { colours: [0x9fdcf2, 0xf4feff], glow: .15, motes: ['frost', 0xffffff, 0x9fdcf2] },
  // (HACKLES UP is a spell worn on the back and the shoulders: white, and it crackles.)
  mikage: { colours: [0xf6f0ff, 0xa663ee], electric: true },
  // ----- The originals whose own layer is the whole transformation, and stand no shell: Kuon's Infinity, Setsu's
  // SETSUNA. As they were.
  kuon: { kind: 'plain', shell: undefined, colours: undefined }, setsu: { kind: 'plain', shell: undefined },
  gaku: { kind: 'plain', shell: 'flame', onForm: true },
  // ALL IN: no hex energy at all (tests/roster96Availability.test.ts).
  chohan: { kind: 'plain', shell: undefined, colours: undefined, physical: true },
};
applyOriginalPowers<AwakenedPower>(OWN);

const resolved = new Map<FighterId, AwakenedPower>();
const looks = new Map<FighterId, ShellLook>();
/** How `fighter`'s shell is worn: its style's look with the fighter's own differences over it. Built once. */
export function shellLook(fighter: FighterId): ShellLook {
  let look = looks.get(fighter);
  if (!look) { const power = awakenedPower(fighter); looks.set(fighter, look = { ...SHELL[power.shell ?? 'flame'], ...power.look }); }
  return look;
}
/** Whether `fighter` wakes in their own body: no form to become, no shell to wear, no spirit to call. */
export const wakesInOwnBody = (fighter: FighterId) => AWAKENINGS[fighter].kind === 'aura' && !FIGHTERS[fighter].formModel;

/** `fighter`'s awakening: their world's row with their own over it. One object per fighter, built once. */
export function awakenedPower(fighter: FighterId): AwakenedPower {
  let power = resolved.get(fighter);
  if (!power) {
    const look = AWAKENINGS[fighter];
    power = { ...(WORLDS[homeSeries(fighter)] ?? ELSEWHERE), ...OWN[fighter] };
    // A body of its own is the transformation: nothing is worn over it unless the row says so - not its world's shell,
    // and not what comes off a body in that world either (no chi boils off the fox), only what is the fighter's own.
    if (!power.onForm && !wakesInOwnBody(fighter)) { power.shell = undefined; if (!OWN[fighter]?.motes) power.motes = undefined; }
    if (power.shell) power.glow ??= look.flames ? look.auraGlow ?? 1 : SHOP_GLOW;
    // Will's haze is near black against the body, thinning to a deep shade of its edge's colour.
    if (power.shell === 'haze') power.colours ??= [HAZE_CORE, shade(power.edge ?? WILL_EDGE.crimson, .62)];
    resolved.set(fighter, power);
  }
  return power;
}
