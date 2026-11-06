import * as THREE from 'three';

/** Launch day 10 (13 October 2026, perf4): the clips a fighter loads hold far more tracks than they move. The shared kit
 *  (`<id>-night*.glb`) and the body's own files key every bone's position, rotation and scale in every clip, and most of
 *  those channels never change: 65 % of the 82,183 channels in the 78 kit files are one value from the first key to the last
 *  (a bone's position and scale in a clip that only turns it, a finger the clip leaves at its rest). GLTFLoader gives each
 *  such channel its own two typed arrays and its own name string, in every clip: Kuzu's 32 clips were 10,372 tracks with
 *  7,561 distinct values arrays.
 *
 *  So once a fighter's files are all in (FighterLibrary.ensure), the tracks of one fighter that hold one value are given the
 *  same arrays when their keys are the same numbers, and the same name string when their names are. Nothing else changes: every
 *  track keeps its object, its keys, its place in its clip, so every reader - the sampler every pose is read through, the
 *  mixer, `clipMotionTable`'s count of keys, the hands layer's `held()` - sees the numbers it saw, bit for bit.
 *
 *  (A first version collapsed a held channel to one key and pooled the track itself. It saved a little more and moved
 *  poses by a rounding error: the mixer blends two equal keys as `v*(1-w) + v*w` in doubles, which is `v` only to 1e-16,
 *  and 38 of the 23.5 million values the rig bar's measure writes for the roster changed in their last float32 bit, all on
 *  near-zero angles that `acos` magnifies. Held here means bit-for-bit equal keys (`Object.is`: a -0 against a 0 is a
 *  movement), and a track's keys are never touched.) */

export interface ShareStats {
  /** Tracks looked at. */
  tracks: number;
  /** Of those, vector or rotation tracks whose keys are all one value. */
  held: number;
  /** Arrays of held tracks that were another track's already (so their own was let go). */
  reused: number;
}

const bytes = (array: Float32Array) => {
  // The exact bits of a small typed array as a string (a key for the pool): numbers print as the same text for 0 and -0, bytes do not.
  const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  let text = '';
  for (let i = 0; i < view.length; i++) text += String.fromCharCode(view[i]);
  return text;
};

/** What the clips of one fighter share: the typed arrays of held tracks, and the track names. Made once a fighter and
 *  dropped when its files are in (nothing else holds the pool). */
export class ClipPool {
  private readonly arrays = new Map<string, Float32Array>();
  private readonly names = new Map<string, string>();

  private name(name: string) {
    const known = this.names.get(name);
    if (known !== undefined) return known;
    this.names.set(name, name);
    return name;
  }
  private array(array: Float32Array, stats: ShareStats) {
    const key = bytes(array), known = this.arrays.get(key);
    if (known) { if (known !== array) stats.reused++; return known; }
    this.arrays.set(key, array);
    return array;
  }

  /** `track` shared as far as it can be (see the header), in place. */
  share(track: THREE.KeyframeTrack, stats: ShareStats) {
    stats.tracks++;
    // (Every clip of a fighter names the same few hundred bones: one string a name, not one a track.)
    track.name = this.name(track.name);
    const quaternion = track instanceof THREE.QuaternionKeyframeTrack;
    if (!quaternion && !(track instanceof THREE.VectorKeyframeTrack)) return;
    const size = quaternion ? 4 : 3, keys = track.times.length, values = track.values, times = track.times;
    // A spline's output holds three values a key (GLTFLoader gives its tracks their own interpolant); a track of any other
    // shape is not looked into.
    const interpolation = track.getInterpolation();
    if (keys === 0 || values.length !== keys * size || interpolation === undefined || interpolation === THREE.InterpolateSmooth || !(values instanceof Float32Array) || !(times instanceof Float32Array)) return;
    for (let key = 1; key < keys; key++) for (let part = 0; part < size; part++) if (!Object.is(values[key * size + part], values[part])) return;
    stats.held++;
    track.times = this.array(times, stats);
    track.values = this.array(values, stats);
  }
}

/** Every held channel of `clips` shared (see the header), in place: each clip keeps its object, its name, its duration and
 *  its tracks. Returns what it found. Safe to run twice. */
export function shareClips(clips: readonly THREE.AnimationClip[] | undefined, pool: ClipPool = new ClipPool(), stats: ShareStats = { tracks: 0, held: 0, reused: 0 }): ShareStats {
  for (const clip of clips ?? []) for (const track of clip.tracks) pool.share(track, stats);
  return stats;
}
