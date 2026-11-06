import * as THREE from 'three';
import type { CoreSlot, FighterId } from '../../game/types';
import type { Canonical } from '../../render/skeleton';
import { rigData, rigFromData, type Rig } from './retarget';

export const TAKE_PACK_VERSION = 1;
const MAGIC = 0x314b544a; // 'JTK1'
/** Where a fighter's pack is. */
export const takePackUrl = (id: FighterId) => `/assets/fighters/takes/${id}.bin`;

interface PackRig { names: string[]; parents: number[]; joints: Partial<Record<Canonical, number>>; reference: number }
interface PackTake { rig: number; name: string; duration: number; linear?: 1; tracks: [number, 0 | 1 | 2, number, number, number][] }
export interface PackJson {
  v: typeof TAKE_PACK_VERSION;
  fighter: FighterId;
  /** How many floats there are before the integers. */
  floats: number;
  /** The files it was read from, each with the start of its content's hash: a pack goes stale when one changes. */
  files: Record<string, string>;
  rigs: PackRig[];
  /** The four core slots' takes (an area move is drawn with one of them: transplantTakes.ts takeSlotOf). */
  takes: Partial<Record<CoreSlot, { open: PackTake; cine?: PackTake; form?: PackTake }>>;
}
/** A take as the transplant holds it: the clip, the rig it is drawn on, and whether it is played straight through. */
export interface PackedTake { readonly clip: THREE.AnimationClip; readonly rig: Rig; readonly linear: boolean }
export type PackedTakes = Record<CoreSlot, { readonly open: PackedTake; readonly cine?: PackedTake; readonly form?: PackedTake }>;

const PROPERTIES = ['position', 'quaternion', 'scale'] as const;
const SIZE = [3, 4, 3] as const;
/** How far a dropped key may be from the line through the keys either side: a tenth of a degree of turn; for a
 *  position or a scale, a five-thousandth of the largest value the track holds. A track that never changes keeps one key. */
const TURN = .2 * Math.PI / 180, SPAN = 2e-4;
/** Rotations are kept as 16-bit integers (a quaternion's parts, times 32767): a fiftieth of a degree at worst. */
const Q = 32767;

/** The keys of a linear track that matter: its first and last, and every key the line between the keys kept either side
 *  of it would miss by more than the tolerance (greedy, left to right). */
function reduce(times: ArrayLike<number>, values: ArrayLike<number>, size: number, quaternion: boolean): { times: number[]; values: number[] } {
  const count = times.length, at = (i: number) => Array.from({ length: size }, (_, k) => values[i * size + k]);
  let largest = 0; for (let i = 0; i < values.length; i++) largest = Math.max(largest, Math.abs(values[i]));
  const tolerance = SPAN * Math.max(largest, 1e-6);
  const a = new THREE.Quaternion(), b = new THREE.Quaternion(), c = new THREE.Quaternion();
  const off = (i: number, from: number, to: number) => {
    const u = (times[i] - times[from]) / Math.max(1e-9, times[to] - times[from]);
    if (quaternion) {
      a.fromArray(values as number[], from * 4); b.fromArray(values as number[], to * 4); c.fromArray(values as number[], i * 4);
      return a.slerp(b, u).angleTo(c) > TURN;
    }
    for (let k = 0; k < size; k++) { const line = values[from * size + k] + (values[to * size + k] - values[from * size + k]) * u; if (Math.abs(line - values[i * size + k]) > tolerance) return true; }
    return false;
  };
  const kept = [0];
  let from = 0;
  for (let to = 2; to < count; to++) {
    for (let i = from + 1; i < to; i++) if (off(i, from, to)) { kept.push(to - 1); from = to - 1; break; }
  }
  if (count > 1) kept.push(count - 1);
  // A track that never changes: one key.
  if (kept.length === 2 && !off(count - 1, 0, 0) && Array.from({ length: count }, (_, i) => i).every(i => !off(i, 0, count - 1))) {
    const first = at(0), same = at(count - 1).every((v, k) => Math.abs(v - first[k]) <= (quaternion ? 1e-6 : tolerance));
    if (same) return { times: [0], values: first };
  }
  return { times: kept.map(i => times[i]), values: kept.flatMap(at) };
}

/** A pack's bytes, from a fighter's takes (the script's half). */
export function encodeTakePack(fighter: FighterId, takes: PackedTakes, files: Record<string, string>): Uint8Array {
  const numbers: number[] = [], shorts: number[] = [], rigs: Rig[] = [], packRigs: PackRig[] = [], kept: number[][] = [];
  const timesAt = new Map<string, number>();
  const put = (values: ArrayLike<number>) => { const at = numbers.length; for (let i = 0; i < values.length; i++) numbers.push(values[i]); return at; };
  const rigIndex = (rig: Rig) => {
    let i = rigs.indexOf(rig);
    if (i < 0) {
      const data = rigData(rig);
      i = rigs.push(rig) - 1; kept.push([...data.kept]);
      packRigs.push({ names: [...data.names], parents: Array.from(data.parents), joints: { ...data.joints }, reference: put(data.reference) });
    }
    return i;
  };
  const take = (source: PackedTake): PackTake => {
    const rig = rigIndex(source.rig), map = new Map(kept[rig].map((index, i) => [index, i])), tracks: PackTake['tracks'] = [];
    for (const track of source.clip.tracks) {
      const parsed = THREE.PropertyBinding.parseTrackName(track.name), property = PROPERTIES.indexOf(parsed.propertyName as typeof PROPERTIES[number]);
      const index = source.rig.byName.get(parsed.nodeName), node = index === undefined ? undefined : map.get(index);
      if (property < 0 || node === undefined) continue;
      // A track the file keys with a curve or in steps is sampled at 60 Hz: the pack's tracks are all linear.
      const factory = (track as unknown as { createInterpolant?: { isInterpolantFactoryMethodGLTFCubicSpline?: boolean } }).createInterpolant;
      const linear = track.getInterpolation() === THREE.InterpolateLinear && !factory?.isInterpolantFactoryMethodGLTFCubicSpline;
      let times: ArrayLike<number> = track.times, values: ArrayLike<number> = track.values;
      if (!linear) {
        const frames = Math.max(2, Math.ceil(source.clip.duration * 60) + 1), interpolant = (track as THREE.KeyframeTrack & { createInterpolant(): THREE.Interpolant }).createInterpolant();
        const t = new Float32Array(frames), v = new Float32Array(frames * SIZE[property]);
        for (let f = 0; f < frames; f++) { t[f] = Math.min(source.clip.duration, f / 60); v.set(interpolant.evaluate(t[f]) as unknown as ArrayLike<number>, f * SIZE[property]); }
        times = t; values = v;
      }
      ({ times, values } = reduce(times, values, SIZE[property], property === 1));
      const key = Array.from(times).join(',');
      let at = timesAt.get(key);
      if (at === undefined) { at = put(times); timesAt.set(key, at); }
      let offset: number;
      if (property === 1) { offset = shorts.length; for (let i = 0; i < values.length; i++) shorts.push(Math.max(-Q, Math.min(Q, Math.round(values[i] * Q)))); }
      else offset = put(values);
      tracks.push([node, property as 0 | 1 | 2, at, times.length, offset]);
    }
    return { rig, name: source.clip.name, duration: +source.clip.duration.toFixed(6), ...(source.linear ? { linear: 1 as const } : {}), tracks };
  };
  const out: PackJson = { v: TAKE_PACK_VERSION, fighter, floats: 0, files, rigs: packRigs, takes: {} };
  const written = new Map<THREE.AnimationClip, Map<Rig, PackTake>>();
  const once = (source: PackedTake) => {
    let byRig = written.get(source.clip);
    if (!byRig) written.set(source.clip, byRig = new Map());
    let made = byRig.get(source.rig);
    if (!made) byRig.set(source.rig, made = take(source));
    return made;
  };
  for (const slot of Object.keys(takes) as CoreSlot[]) {
    const own = takes[slot];
    out.takes[slot] = { open: once(own.open), ...(own.cine ? { cine: once(own.cine) } : {}), ...(own.form ? { form: once(own.form) } : {}) };
  }
  out.rigs = packRigs; out.floats = numbers.length;
  const json = new TextEncoder().encode(JSON.stringify(out)), head = 8 + json.length, pad = (4 - head % 4) % 4;
  const bytes = new Uint8Array(head + pad + numbers.length * 4 + shorts.length * 2), view = new DataView(bytes.buffer);
  view.setUint32(0, MAGIC, true); view.setUint32(4, json.length, true); bytes.set(json, 8);
  new Float32Array(bytes.buffer, head + pad, numbers.length).set(numbers);
  new Int16Array(bytes.buffer, head + pad + numbers.length * 4, shorts.length).set(shorts);
  return bytes;
}

/** A pack's JSON, from its bytes. */
export function readTakePackJson(bytes: ArrayBuffer): { json: PackJson; floats: Float32Array; shorts: Int16Array } {
  const view = new DataView(bytes);
  if (bytes.byteLength < 8 || view.getUint32(0, true) !== MAGIC) throw new Error('not a take pack');
  const length = view.getUint32(4, true), head = 8 + length, pad = (4 - head % 4) % 4;
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 8, length))) as PackJson;
  if (json.v !== TAKE_PACK_VERSION) throw new Error(`take pack version ${json.v}, not ${TAKE_PACK_VERSION}`);
  const floats = new Float32Array(bytes, head + pad, json.floats), at = head + pad + json.floats * 4;
  return { json, floats, shorts: new Int16Array(bytes, at, (bytes.byteLength - at) >> 1) };
}

/** A fighter's takes, from its pack's bytes. */
export function decodeTakePack(bytes: ArrayBuffer): { fighter: FighterId; takes: Partial<PackedTakes> } {
  const { json, floats, shorts } = readTakePackJson(bytes);
  const rigs = json.rigs.map(rig => rigFromData({ names: rig.names, parents: rig.parents, joints: rig.joints, reference: floats.subarray(rig.reference, rig.reference + rig.names.length * 10) }));
  const take = (source: PackTake): PackedTake => {
    const names = json.rigs[source.rig].names;
    const tracks = source.tracks.map(([node, property, times, count, values]) => {
      const name = `${names[node]}.${PROPERTIES[property]}`, t = floats.subarray(times, times + count);
      if (property !== 1) return new THREE.VectorKeyframeTrack(name, t as unknown as number[], floats.subarray(values, values + count * 3) as unknown as number[]);
      const q = new Float32Array(count * 4);
      for (let i = 0; i < q.length; i++) q[i] = shorts[values + i] / Q;
      for (let i = 0; i < count; i++) { const n = Math.hypot(q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]) || 1; for (let k = 0; k < 4; k++) q[i * 4 + k] /= n; }
      return new THREE.QuaternionKeyframeTrack(name, t as unknown as number[], q as unknown as number[]);
    });
    return { clip: new THREE.AnimationClip(source.name, source.duration, tracks), rig: rigs[source.rig], linear: !!source.linear };
  };
  const takes: Partial<PackedTakes> = {};
  for (const [slot, own] of Object.entries(json.takes) as [CoreSlot, NonNullable<PackJson['takes'][CoreSlot]>][])
    takes[slot] = { open: take(own.open), ...(own.cine ? { cine: take(own.cine) } : {}), ...(own.form ? { form: take(own.form) } : {}) };
  return { fighter: json.fighter, takes };
}

const viteEnv = (typeof import.meta.env === 'object' ? import.meta.env : {}) as Record<string, string | undefined>;
/** Whether this build carries the fighters' take packs (assets/fighters/takes/). */
export const TAKE_PACKS_SHIPPED = viteEnv.VITE_TAKE_PACKS === '1';
/** Packs being fetched or fetched, by fighter: one request each, ever. */
const fetched = new Map<FighterId, Promise<Partial<PackedTakes> | undefined>>();
/** A fighter's takes from its pack, fetched once; undefined when it has none (or it could not be read). */
export function loadTakePack(id: FighterId): Promise<Partial<PackedTakes> | undefined> {
  let pending = fetched.get(id);
  // No packs ship in this repository (they are caches made from the clip files, and some of those are held back:
  // README.md), so none is asked for unless a build says it carries them (VITE_TAKE_PACKS=1).
  if (!pending && !TAKE_PACKS_SHIPPED) { pending = Promise.resolve(undefined); fetched.set(id, pending); }
  if (!pending) {
    // Ahead of whatever else the pick sets loading (the move's art, an effect's model): the throw waits on this alone.
    pending = fetch(takePackUrl(id), { priority: 'high' } as RequestInit)
      .then(response => response.ok && !/text\/html/.test(response.headers.get('content-type') ?? '') ? response.arrayBuffer() : undefined)
      .then(bytes => bytes ? decodeTakePack(bytes).takes : undefined)
      .catch(error => { console.info(`Transplant: no take pack for ${id} (${(error as Error).message}); its files are read instead.`); return undefined; });
    fetched.set(id, pending);
  }
  return pending;
}
/** For tests: forget what was fetched. */
export const forgetTakePacks = () => fetched.clear();
