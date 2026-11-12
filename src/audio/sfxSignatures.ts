import type { AttackSlot, FighterId } from '../game/types';
import type { AudioCue } from './cueTypes';
import { applyOriginalSignatures } from '../originals/sfx';

export interface Signature {
  readonly what: string;
  readonly cast?: readonly (readonly [cue: AudioCue, gain: number, when: 'contact' | 'vanish' | 'appear' | number, rate?: number])[];
  readonly hit?: readonly (readonly [cue: AudioCue, gain: number])[];
  /** The unawakened body's alone: awakened, the slot is another body's move (Hawser's YUGE wears no gear). */
  readonly base?: true;
}

const SUNPALM_CANNON = 'ki gathered between two hands: a hum that pulses, each pulse quicker and higher than the last, sparks crowding in as it tightens';
const BURNING_LEG = 'a leg spun until it burns: a whirr that climbs turn after turn and catches with a flare; and where the kick lands, the hiss of scorched air';
const UNSEEN_CUT = 'a cut with no blade: two thin slices a twentieth of a second apart, cold and dry';
const GEAR = 'the gear firing: a burst of gas and the cable paying out, a thin whir that climbs as the reel spins up';

export const SIGNATURES: Readonly<Partial<Record<FighterId, Partial<Record<AttackSlot, Signature>>>>> = {
  // ----- the original sixteen who had nothing of their own
  taisei: {
    heavy: { what: 'Cloudstep\'s snap - a quick high note falling, a breath, the same note rising - as he vanishes, and again where he is', cast: [['fx-sig-taisei-it', .42, 'vanish'], ['fx-sig-taisei-it', .36, 'appear', 1.1]] },
    special: { what: SUNPALM_CANNON, cast: [['fx-sig-sunpalm-charge', .4, 'contact']] },
  },
  ouga: {
    special: { what: 'the Throne Wave charging: rougher than a Golden\'s blue, a saw-edged growl that buzzes as it climbs', cast: [['fx-sig-ouga-throne-wave', .44, 'contact']] },
    ultimate: { what: 'Royal Aurora: electricity tearing wider and wider between his hands, then the flash - a crack and a wide roar', cast: [['fx-sig-ouga-flash', .46, 'contact']] },
  },
  kosho: {
    special: { what: BURNING_LEG, cast: [['fx-sig-kosho-flambe', .42, 'contact']], hit: [['fx-sig-kosho-sear', .4]] },
    ultimate: { what: BURNING_LEG, cast: [['fx-sig-kosho-flambe', .42, 'contact']], hit: [['fx-sig-kosho-sear', .44]] },
  },
  // (Kagari had one: Hinoko's embers.)
  kagari: { special: { what: 'Taimatsu, the TAIMATSU: a deep whoomp as the column of fire leaves his arm, and a jet\'s roar behind it', cast: [['fx-sig-kagari-taimatsu', .46, 'contact']] } },
  // ----- and of the rest of the roster, the best known
  'wuming': { special: { what: SUNPALM_CANNON + ' (his, darker: played slower)', cast: [['fx-sig-sunpalm-charge', .38, 'contact', .86]] } },
  magatsu: {
    heavy: { what: UNSEEN_CUT, cast: [['fx-sig-magatsu-flay', .38, 'contact']], hit: [['fx-sig-magatsu-flay', .42]] },
    special: { what: UNSEEN_CUT, cast: [['fx-sig-magatsu-flay', .4, 'contact']], hit: [['fx-sig-magatsu-flay', .44]] },
  },
  levin: { special: { what: GEAR, cast: [['fx-sig-grapple', .42, .05]] }, ultimate: { what: GEAR, cast: [['fx-sig-grapple', .4, .05]] } },
  mizuhiki: { special: { what: GEAR, cast: [['fx-sig-grapple', .42, .05, 1.06]] }, ultimate: { what: GEAR, cast: [['fx-sig-grapple', .4, .05, 1.06]] } },
  // (Scout Hawser, 13 October: the same gear on the Snap Line and Slipped Moorings, a touch lower.)
  hawser: { special: { what: GEAR, cast: [['fx-sig-grapple', .42, .05, .96]], base: true }, ultimate: { what: GEAR, cast: [['fx-sig-grapple', .4, .05, .96]], base: true } },
  gaku: { ultimate: { what: 'The Landslide: aura drawn into one fist - a hum swelling under a heavy double beat, like a heart, that comes quicker each time', cast: [['fx-sig-gaku-landslide', .44, 'contact']] } },
};

applyOriginalSignatures(SIGNATURES);

/** Every signature cue `fighter`'s moves play. */
export function signatureCues(fighter: FighterId): AudioCue[] {
  const rows = Object.values(SIGNATURES[fighter] ?? {});
  return [...new Set(rows.flatMap(row => [...(row.cast ?? []), ...(row.hit ?? [])].map(([cue]) => cue)))];
}
