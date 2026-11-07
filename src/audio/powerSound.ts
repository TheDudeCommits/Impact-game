import { AWAKENINGS } from '../game/awakening';
import { OWN_ENTRANCES } from '../game/powerUp';
import type { FighterId } from '../game/types';
import { awakenedPower, type AwakenedPower } from '../render/awakenedPower';
import type { AudioCue } from './cueTypes';

export type PowerSound = 'flame' | 'will' | 'pressure' | 'chi' | 'cursed' | 'aura' | 'arcs' | 'steam' | 'frost';

interface Voice {
  /** Held on the fighter (scripts/sfx/recipes_n5.py; the flame's and the lightning's are the bank's own). */
  readonly loop: AudioCue;
  /** How loud the loop is at the entry's break and while it stands under the fight, for the fighter's own player (another
   *  fighter's is at 0.65 of these, CombatAudio). Every loop is finished to the same loudness (-19 LUFS over its loudest
   *  400 ms), so these are the mix: the bright ones (steam, frost, lightning: 26-80 % of their power at 1 kHz and over,
   *  where a line is said) stand lower than the dark ones, which a voice does not have to speak through. */
  readonly entry: number; readonly hold: number;
  /** On the swap: [cue, gain, seconds after the swap]. None for the flame: Taisei's and Ouga's power-up and each fire fighter's
   *  own layers are its entrance already. */
  readonly entrance: readonly (readonly [AudioCue, number, number?])[];
  /** How much of the entrance is left under an awakening line said over the burst (sfxPlan.ts spokenOver): the line is
   *  the moment. The six made for this are shaped round a voice's band (recipes_n5.py voice_gap: under 4 % of each at
   *  1-4 kHz) and keep six tenths; the bank's own bolt and steam are not (7 and 22 %), and keep less. */
  readonly underALine: number;
}
export const POWER_SOUNDS: Readonly<Record<PowerSound, Voice>> = {
  // The ki flame, as it was (the power-up pass): a deep roar, a power hum, the rush of the burn.
  flame: { loop: 'fx-aura-burn', entry: .3, hold: .13, entrance: [], underALine: 1 },
  // A will pressing on the room and black lightning cracking off the body. No flame in it.
  will: { loop: 'fx-aura-will', entry: .32, hold: .16, entrance: [['fx-enter-will', .5]], underALine: .6 },
  // Raw pressure streaming upward: a pillar on the release, then a roar that keeps climbing.
  pressure: { loop: 'fx-aura-pressure', entry: .32, hold: .15, entrance: [['fx-enter-pressure', .5]], underALine: .6 },
  // Chi's wind: it winds up round them, is flung out, and turns round the cloak after.
  chi: { loop: 'fx-aura-chi', entry: .28, hold: .12, entrance: [['fx-enter-chi', .46]], underALine: .6 },
  // A dark flame, heard low: hex energy, and every dark worn like it.
  cursed: { loop: 'fx-aura-cursed', entry: .32, hold: .15, entrance: [['fx-enter-cursed', .44]], underALine: .6 },
  // Lion's Roar: one even chord, swelling out and held.
  aura: { loop: 'fx-aura-aura', entry: .28, hold: .11, entrance: [['fx-enter-aura', .46]], underALine: .6 },
  // Lightning worn on a body: the crackle held in the hands is the bank's, and so is its bolt.
  arcs: { loop: 'fx-electric-bed', entry: .24, hold: .11, entrance: [['fx-lightning', .34], ['fx-zap-2', .2, .1]], underALine: .3 },
  // A body past its limit venting.
  steam: { loop: 'fx-aura-steam', entry: .22, hold: .09, entrance: [['fx-steam', .4]], underALine: .5 },
  // Cold air and ice setting in it.
  frost: { loop: 'fx-aura-frost', entry: .24, hold: .1, entrance: [['fx-enter-frost', .42]], underALine: .5 },
};

/** Will without Sovereign's (awakenedPower.ts: "it crackles thinner and more rarely, and the room is left alone"):
 *  quieter, and a little quicker so each crack is shorter and thinner. */
const THIN = { level: .6, rate: 1.1 };
/** A flame round a blade and not on the body (Black Snow's breathing): a burn, well under a body alight. */
const ROUND_A_BLADE = .55;

export interface PowerVoice {
  readonly kind: PowerSound;
  /** Whether the loop is held after the entry. A body of its own that wears nothing (the fox, a Guardian) arrives in its
   *  world's power and then stands silent: the transformation is the whole of it. */
  readonly stands: boolean;
  /** Against the kind's own levels (1 unless said), and the loop's playback rate. */
  readonly level: number; readonly rate: number;
}

/** Fighters whose own layer is the whole transformation and whose row therefore says nothing is worn (awakenedPower.ts
 *  `OWN`: "Kuon's Infinity, Setsu's SETSUNA"), where that layer is one of these
 *  sounds: SETSUNA is lightning on a body. */
const OWN_LAYER: Readonly<Partial<Record<FighterId, PowerSound>>> = { setsu: 'arcs' };

const voice = (kind: PowerSound, stands = true, level = 1, rate = 1): PowerVoice => ({ kind, stands, level, rate });

/** A row of the table, heard. Undefined: nothing sounds (no energy to show, or a transformation that is all body). */
export function heard(power: AwakenedPower): PowerVoice | undefined {
  if (power.physical) return undefined;
  const mote = power.motes?.[0];
  switch (power.kind) {
    case 'ki': return voice('flame');
    // Whatever stands over it (a cursed fruit's sand, its magma, its light), Dust Sea's awakened state is Will.
    case 'will': return power.sovereign ? voice('will') : voice('will', true, THIN.level, THIN.rate);
    case 'pressure': return voice('pressure', !!power.shell);
    // EVERGREEN: not a cloak, the steam of a body burning itself.
    case 'chi': return mote === 'steam' ? voice('steam') : voice('chi', !!power.shell);
    case 'cursed': return voice('cursed', !!power.shell);
    case 'aura': return voice('aura', !!power.shell);
    case 'plain': break;
  }
  // No world's power: what the row itself wears.
  switch (power.shell) {
    case 'flame': return voice('flame');
    // A dark worn on the body, and a weight on the air with no lightning in it (Kubiwa's haze): the dark flame's low burn.
    case 'curse': case 'haze': return voice('cursed');
    case 'smoke': return voice(mote === 'steam' ? 'steam' : 'pressure');
    case 'cloak': return voice('chi');
    case 'shroud': return voice('aura');
    case undefined: break;
  }
  if (power.arcs !== undefined) return voice('arcs');
  if (mote === 'frost') return voice('frost');
  if (mote === 'steam') return voice('steam');
  if (mote === 'flame' || mote === 'ember') return voice('flame', true, ROUND_A_BLADE);
  return undefined;
}

const voices = new Map<FighterId, PowerVoice | undefined>();
/** `fighter`'s awakening, heard: their row of awakenedPower.ts, or their own layer's sound where the row leaves it to
 *  that layer. Undefined: silence (Chohan and Wataame have no energy; the spirits, the TENGAN and the rest are their own
 *  layers' sounds). */
export function powerVoice(fighter: FighterId): PowerVoice | undefined {
  // (An id the roster does not know - a room's list can carry one - has no awakening and no sound.)
  if (!AWAKENINGS[fighter]) return undefined;
  if (!voices.has(fighter)) { const own = OWN_LAYER[fighter]; voices.set(fighter, own ? voice(own) : heard(awakenedPower(fighter))); }
  return voices.get(fighter);
}

/** Whose own entry already is their power arriving, a recorded moment the plan times to the frame: Nigo's UNSEALED
 *  (fx-unsealed, "raw pressure let go all at once on KAI!"). No second pillar is laid over it. */
const OWN_ARRIVAL: ReadonlySet<FighterId> = new Set<FighterId>(['nigo']);
/** Whether the power's entrance is played: not for the two whose arrival is their own layer's (game/powerUp.ts), nor
 *  over an entry that is that arrival already. */
export const arrivesHeard = (fighter: FighterId) => !OWN_ENTRANCES.has(fighter) && !OWN_ARRIVAL.has(fighter) && !!powerVoice(fighter);

/** The cues a room needs for its fighters' awakenings: each one's loop and entrance. */
export function powerCues(fighter: FighterId): AudioCue[] {
  const v = powerVoice(fighter);
  if (!v) return [];
  const sound = POWER_SOUNDS[v.kind];
  return [sound.loop, ...sound.entrance.map(([cue]) => cue)];
}
