import type { StageId } from '../game/stages';

export interface Space {
  /** Seconds to fall 60 dB. */
  seconds: number;
  /** Seconds of silence before the reverb answers (the distance to the walls). */
  predelay: number;
  /** The send's level into the reverb, for the effects; voices take `VOICE_SHARE` of it. */
  wet: number;
  /** 0..1: how quickly the tail darkens (1 = the highs gone well before the tail is). */
  damping: number;
  /** Early reflections in the first 60 ms: how close and hard the walls are (0 = open air). */
  early: number;
}

/** Voices are kept drier than the blows, so a line is never smeared. */
export const VOICE_SHARE = .45;

const SPACES = {
  /** A stone hall with a roof: the training hall. */
  hall: { seconds: 1.25, predelay: .012, wet: .17, damping: .55, early: .8 },
  /** A big interior: a citadel's halls. */
  keep: { seconds: 1.9, predelay: .025, wet: .14, damping: .5, early: .6 },
  /** An open arena ringed by stands: the answer comes late off the far side. */
  stadium: { seconds: 1.7, predelay: .035, wet: .1, damping: .6, early: .3 },
  /** Rock walls either side: the valley throws a blow back. */
  canyon: { seconds: 2.4, predelay: .045, wet: .15, damping: .55, early: .5 },
  /** Open air over a town, a harbour or a lookout: a short, light answer. */
  open: { seconds: .8, predelay: .02, wet: .07, damping: .7, early: .2 },
  /** A void, open sky or night: long and dark, no walls to speak of. */
  void: { seconds: 2.8, predelay: .05, wet: .16, damping: .72, early: 0 },
} as const satisfies Record<string, Space>;
export type SpaceName = keyof typeof SPACES;

/** Each main-game stage's space. Arcade survival's rift stages and the objective modes keep the dry mix their own
 *  agents tuned (main.ts passes no stage there); a stage not listed is dry too. */
export const STAGE_SPACES: Partial<Record<StageId, SpaceName>> = {
  'proving-hall': 'hall',
  'blood-citadel': 'keep',
  'ash-colosseum': 'stadium',
  'sunfall-arena': 'stadium',
  'zenith-coliseum': 'stadium',
  'ashfall-weir': 'canyon',
  harbor: 'open',
  'wreckers-causeway': 'open',
  'hidden-ash': 'open',
  'sunward-summit': 'open',
  'cinder-flats': 'open',
  'warlords-roof': 'open',
  'hollowmere-quarry': 'open',
  'mirror-mere': 'void',
  'drifting-isle': 'void',
  'dry-harbour': 'open',
  'thornwood-ward': 'open',
  'kuroyuki-hall': 'open',
  'starfall-crater': 'canyon',
  'scrap-pit': 'keep',
};

export function spaceFor(stage: StageId | undefined): Space | undefined {
  const name = stage ? STAGE_SPACES[stage] : undefined;
  return name ? SPACES[name] : undefined;
}
export function spaceName(stage: StageId | undefined): SpaceName | undefined { return stage ? STAGE_SPACES[stage] : undefined; }

/** A small fast generator, so a space's impulse response is the same on every load. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The impulse response of `space` at `rate`: one Float32Array per channel (two), energy-normalised to one. */
export function impulseResponse(space: Space, rate: number, seed = 1): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const length = Math.max(1, Math.ceil(rate * (space.predelay + space.seconds)));
  const out: [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] = [new Float32Array(length), new Float32Array(length)];
  const start = Math.round(space.predelay * rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = out[channel], next = random(seed * 7919 + channel * 104729 + Math.round(space.seconds * 1000));
    // The diffuse tail: noise under the decay, through a one-pole low-pass that closes as the tail ages.
    let low = 0;
    for (let i = start; i < length; i++) {
      const t = (i - start) / rate, age = t / space.seconds;
      const envelope = Math.pow(10, -3 * age);
      const close = Math.min(.96, space.damping * age * 1.4);
      low = low * close + (next() * 2 - 1) * (1 - close);
      // A soft onset over the first 4 ms, so the tail does not open with a click.
      data[i] = low * envelope * Math.min(1, (t + 1e-4) / .004);
    }
    // Early reflections: a handful of hard taps off the near walls, a little different in each ear.
    const taps = Math.round(space.early * 9);
    for (let k = 0; k < taps; k++) {
      const at = start + Math.round((.004 + next() * .055) * rate);
      if (at < length) data[at] += (next() < .5 ? -1 : 1) * (.55 + next() * .45) * space.early * Math.pow(10, -3 * ((at - start) / rate) / space.seconds);
    }
  }
  let energy = 0;
  for (const data of out) for (let i = 0; i < data.length; i++) energy += data[i] * data[i];
  const scale = energy > 0 ? 1 / Math.sqrt(energy) : 0;
  for (const data of out) for (let i = 0; i < data.length; i++) data[i] *= scale;
  return out;
}
