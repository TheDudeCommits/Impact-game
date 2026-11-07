import { ARMORY_SOUND_NAMES, ARMORY_SOUND_PROFILES, loadRecipes } from './vendor/sounds';
import type { ArmorySoundLayer, ArmorySoundName, ArmorySoundProfile } from './types';
import { armorySoundOut, type ArmorySoundOut, type SoundAt } from './soundOut';

/**
 * The Armory's sound in the game (docs/engine/armory/README.md, "Sound").
 *
 * Each cast of an Armory effect plays the effect's cue profile (the Armory's src/audio, as data in
 * src/engine/vfx/armory/sounds.json, vendored to ./vendor/sounds.ts) the way the Armory's own director plays it (its
 * src/audio/index.js): the cast and charge layers at the cast; the loop from its `at` (the cast, the first hit, the
 * impact phase) to its `until` (the impact phase, the fade, the end) or for `max` seconds; a hit's layers at its
 * intensity (gain × (0.45 + 0.55 I), a layer skipped outside its min and max), hits merged per frame and at least `gap`
 * apart, the first one playing the `first` layers; the tail as the effect fades, or a while after its last hit.
 *
 * **Never doubled.** The game voices every move it draws already: the cast, the swings, the hits and, for the fire
 * fighters, a fire bed under them (audio/sfxPlan.ts). So unless a slot's casting says otherwise (`sound`, casting.ts),
 * an Armory effect plays only what those don't cover, its *bed*: the loop (the fire burning on for as long as the
 * effect does, past the move's own sounds) and the tail (dying down), quietly (`LEVEL.bed`). `sound: true` plays the
 * whole profile (`full`, for a slot the game leaves silent); `false`, nothing.
 *
 * **Through the game's one-shot path** (soundOut.ts), as CombatAudio exposes no bus:
 *  - a synth recipe is rendered once a page, in OfflineAudioContexts, by the Armory's own recipes.js
 *    (./vendor/audio/recipes.js), a few variants a layer (each recipe detunes itself a little), into WAV files held as
 *    blob URLs, which the game loads and plays like any sample;
 *  - **never long** (launch day 7, 13 October 2026: 140-440 ms hitches 2-48 s into a twelve-fighter match, and 200-400
 *    files decoded in one frame, both from this bank finishing after FIGHT). A render costs more than its length - every node
 *    still to start is visited on every quantum - so a room's 262 s of synth in ONE context took 26-49 s to come back, long
 *    after the load's 3 s wait, and its callback cut and encoded all of it at once; in contexts of `CHUNK` s the same takes
 *    1.1-1.6 s. Every step on the page (a context's graph, a piece's cut and encode) runs in slices of a few ms with the
 *    page's idle time between (`Slices`), and the files are handed to the game's audio a few at a time (`pump`), so what is
 *    still being made when the fight begins costs it no frame it can see;
 *  - a loop plays as overlapping segments of itself, cross-faded at equal power and laid while it should run, so it
 *    stops within one segment of its `until`. A noise-like loop (fire, wind, static, the tuned packs' surf, hiss and
 *    rustle, a sample bank's loop) hides the seams; a pitched one (a beam's hum, an aura's partials, the chainsaw's
 *    engine, the shield's hum, the black hole's and the magma's sub sines, a pad) would phase at them, so it is left
 *    out.
 */

export type SoundMode = 'bed' | 'full';

/** The Armory's level in the game: its effects bus runs at 0.85 of a 0.5 master where the Armory's runs at 0.8 of a
 *  0.7 volume, so ×1.3 is the Armory's own loudness; each mode's level is against that. */
export const ARMORY_TO_GAME = 1.3;
export const LEVEL: Readonly<Record<SoundMode, number>> = Object.freeze({ bed: .5, full: .7 });
/** A sample's playback rate is jittered by this much either way, as the Armory does. */
const JITTER = .06;
/** Under every sound of the game's: at the effects' voice cap the game drops the Armory's, never its own. */
const PRIORITY = -1;
const OWNER = 'armory';
/** A loop's segments: their length, how much each overlaps the next (the cross-fade), and how far ahead one is laid. */
export const SEGMENT = .9, OVERLAP = .2;
const LOOKAHEAD = .12;
const SEGMENTABLE = new Set(['fire', 'wind', 'static', 'surf', 'hiss', 'rustle']);
/** Renders a one-shot synth layer gets, and segments a loop. */
const VARIANTS = 3, LOOP_VARIANTS = 3;
const RATE = 48000;
/** The longest timeline, in seconds, one offline render holds (a layer's variants stay in one; see the header). Measured
 *  on a busy Mac (scripts/night/audiohitch, a room's 144 pieces, 262 s): one context 26 s, 100 s of it 9 s, 50 s 3.8 s,
 *  25 s 2.1 s, 12 s 1.5 s, 8 s 1.25 s, 6 s 1.1 s. */
export const CHUNK = 8;
/** Where a render's first piece starts, and the silence after each. */
const START = .05, GAP = .25;
/** How long a slice of the bank's work runs before it gives the thread back (ms): in the fight, and while a room loads. */
const SLICE_MS = 4, RUSH_SLICE_MS = 12;
/** Samples an encoding loop writes between looks at the clock. */
const BLOCK = 16384;
/** Files handed to the game's audio to decode per pump, and how soon the next pump may be (seconds); while a room loads, more.
 *  A frame that runs long (a first draw's shaders) delivers the decodes of the last two pumps at once: 2 × PACE stays a few ms. */
export const PACE = 4, RUSH_PACE = 24, PACE_GAP = .03;
/** How long a file the game's audio has not answered for waits before it is asked for again (seconds). */
export const RETRY = 2;
const clock = () => (typeof performance === 'object' ? performance.now() : Date.now()) / 1000;
const ms = () => (typeof performance === 'object' ? performance.now() : Date.now());
const soon = () => new Promise<void>(resolve => setTimeout(resolve, 0));
export const idle = () => new Promise<void>(resolve => {
  const ric = (globalThis as { requestIdleCallback?: (done: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === 'function') { ric(() => resolve(), { timeout: 120 }); return; }
  // Safari has no requestIdleCallback. A plain 16 ms timer put the slices anywhere in a frame, the frame's own work
  // included; just after a frame has been handed over is the nearest thing to idle (its work is done, the next is a
  // frame away). At the latest 120 ms on, as above, so a page drawing no frames (hidden) still gets there.
  let done = false;
  const go = () => { if (!done) { done = true; resolve(); } };
  const raf = (globalThis as { requestAnimationFrame?: (fn: () => void) => number }).requestAnimationFrame;
  if (typeof raf === 'function') raf(() => setTimeout(go, 0));
  setTimeout(go, 120);
});

/** The bank's work in slices: `tick` costs nothing until a slice has run for `SLICE_MS`, then gives the thread back - at
 *  once while a room loads (the loading screen's other work goes on between), at the page's next idle moment in the fight
 *  (at the latest 120 ms on) - so no step of the bank is ever a frame's wait. */
export class Slices {
  private since = ms();
  constructor(private readonly rushing: () => boolean = () => false, private readonly pause?: () => Promise<void>) {}
  async tick() {
    const rush = this.rushing();
    if (ms() - this.since < (rush ? RUSH_SLICE_MS : SLICE_MS)) return;
    await (this.pause ? this.pause() : rush ? soon() : idle());
    this.since = ms();
  }
}

/** Whether a loop layer can play as segments (see the header). */
export const segmentable = (name: ArmorySoundName | undefined) => !!name && name.loop && (name.type === 'sample' || SEGMENTABLE.has(name.recipe));

/** The layers a cast of `profile` voices in `mode` (a loop's and the impacts' are among them; see CastSound for when). */
export function voicedLayers(profile: ArmorySoundProfile, mode: SoundMode, names: Readonly<Record<string, ArmorySoundName>> = ARMORY_SOUND_NAMES): ArmorySoundLayer[] {
  const loop = (profile.loop?.layers ?? []).filter(l => segmentable(names[l.sound]));
  if (mode === 'bed') return [...loop, ...(profile.tail ?? [])];
  return [...(profile.cast ?? []), ...(profile.charge ?? []), ...loop, ...(profile.impacts ?? []).flatMap(i => i.layers), ...(profile.tail ?? [])];
}

/** A rendered or sampled layer's key: a synth layer by everything its render bakes in (its gain is its recipe's level
 *  too, as the Armory passes it), a sample bank by name. */
const keyOf = (layer: ArmorySoundLayer, name: ArmorySoundName) => name.type === 'synth' ? JSON.stringify([layer.sound, layer.gain, layer.pitch ?? 1, layer.params ?? {}]) : layer.sound;

interface Variants { readonly urls: readonly string[]; readonly gains: readonly number[]; last: number }

type Recipes = Awaited<ReturnType<NonNullable<typeof loadRecipes>>>;
type Kit = ReturnType<Recipes['makeKit']>;
type SynthJob = [string, ArmorySoundLayer, Extract<ArmorySoundName, { type: 'synth' }>];
/** One variant of a synth layer (or a loop's stretch to cut segments from), placed on a render's timeline. */
interface Piece { readonly key: string; readonly layer: ArmorySoundLayer; readonly recipe: string; readonly loop: boolean; readonly at: number; readonly length: number }

/** Every synth layer asked for laid out on render timelines of at most `limit` seconds: a layer's pieces (a one-shot's
 *  variants, a loop's one stretch) together on one, and a layer longer than the limit alone on its own. */
export function planRenders(jobs: readonly SynthJob[], recipes: Pick<Recipes, 'RECIPES' | 'RECIPE_INFO'>, limit = CHUNK): Piece[][] {
  const plan: Piece[][] = [];
  let chunk: Piece[] = [], t = START;
  for (const [key, layer, name] of jobs) {
    if (!recipes.RECIPES[name.recipe]) continue;
    const dur = Number(layer.params?.dur ?? name.params.dur ?? recipes.RECIPE_INFO[name.recipe]?.params.dur ?? 1);
    const length = name.loop ? LOOP_VARIANTS * SEGMENT + .4 : dur * 1.25 + .35, variants = name.loop ? 1 : VARIANTS;
    if (chunk.length && t + variants * (length + GAP) > limit) { plan.push(chunk); chunk = []; t = START; }
    for (let v = 0; v < variants; v++) { chunk.push({ key, layer, recipe: name.recipe, loop: name.loop, at: t, length }); t += length + GAP; }
  }
  if (chunk.length) plan.push(chunk);
  return plan;
}

/** What the game plays a layer as: its variants' URLs (and a gain to put back what a render's normalising took). */
export class SoundBank {
  private readonly made = new Map<string, Variants>();
  private readonly asked = new Map<string, { layer: ArmorySoundLayer; name: ArmorySoundName }>();
  private work: Promise<void> = Promise.resolve();
  private format?: Promise<'ogg' | 'mp3'>;
  private readonly urls = new Set<string>();
  private pumpedAt = -Infinity;
  private loaded = false;
  /** The Armory's noise and impulse buffers (recipes.js `makeKit`: 20-70 ms to make), made once a page and lent to every context. */
  private kit?: Kit;
  /** When each file was last handed to the game's audio to decode (seconds), and whether some still wait their turn (`pump`). */
  private readonly handed = new Map<string, number>();
  private backlog = false;
  /** How many room loads wait on the bank just now (`readySound`): while any, its work runs in longer slices and the game's
   *  audio is handed more files at a time, behind the loading screen. */
  rushing = 0;

  /** `pause`: how the bank's slices wait for the page between themselves (tests); by default the page's idle time. */
  constructor(private readonly options: { readonly pause?: () => Promise<void> } = {}) {}

  /** Ask for the layers `mode` voices of `effectId`. */
  need(effectId: string, mode: SoundMode) {
    const profile = ARMORY_SOUND_PROFILES[effectId];
    if (!profile) return;
    for (const layer of voicedLayers(profile, mode)) {
      const name = ARMORY_SOUND_NAMES[layer.sound];
      if (!name) continue;
      const key = keyOf(layer, name);
      if (!this.made.has(key)) this.asked.set(key, { layer, name });
    }
  }

  /** Make what was asked (renders, segments, file addresses). Serialised; a page without Web Audio makes nothing. */
  prepare() {
    this.work = this.work.then(() => this.make()).catch(error => console.warn('armory sound: could not prepare', error));
    return this.work;
  }

  private async make() {
    const jobs = [...this.asked]; this.asked.clear();
    if (!jobs.length || typeof OfflineAudioContext !== 'function') return;
    const slices = new Slices(() => this.rushing > 0, this.options.pause);
    const synth: SynthJob[] = [];
    for (const [key, { layer, name }] of jobs) {
      if (this.made.has(key)) continue;
      if (name.type === 'synth') { synth.push([key, layer, name]); continue; }
      const format = await (this.format ??= probeFormat(name));
      if (!name.loop) { this.add(key, name.files.map(f => `${f}.${format}`), name.files.map(() => 1)); continue; }
      const data = await decode(`${name.files[0]}.${format}`);
      if (data) this.add(key, ...await encode(segments(data, true), slices));
    }
    if (synth.length && loadRecipes) await this.renderSynth(synth, await loadRecipes(), slices);
  }

  /** Every synth layer asked for, rendered by the Armory's recipes a chunk at a time (`planRenders`): a chunk's graph built,
   *  rendered, and its layers cut out and encoded, each the bank's the moment it is whole (a one-shot's variants, a loop's
   *  segments, each cut out of the render). */
  private async renderSynth(jobs: readonly SynthJob[], recipes: Recipes, slices: Slices) {
    for (const chunk of planRenders(jobs, recipes)) {
      const last = chunk[chunk.length - 1];
      const ctx = new OfflineAudioContext(1, Math.ceil((last.at + last.length + GAP) * RATE), RATE);
      const base = (this.kit ??= recipes.makeKit(ctx)), kit = base.ac === ctx ? base : { ...base, ac: ctx };
      await slices.tick();
      for (const piece of chunk) {
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        // As the Armory's engine calls a recipe: the layer's gain is the recipe's own level too (`g`).
        const voice = recipes.RECIPES[piece.recipe](kit, gain, piece.at, { ...piece.layer.params, g: piece.layer.gain, pitch: piece.layer.pitch ?? 1, ...(piece.loop ? { fadeIn: .01 } : {}) });
        voice.stop?.(piece.at + piece.length, .02);
        await slices.tick();
      }
      const data = (await ctx.startRendering()).getChannelData(0);
      const out = new Map<string, Float32Array[]>();
      for (const piece of chunk) {
        const a = Math.round(piece.at * RATE), list = out.get(piece.key) ?? [];
        if (piece.loop) list.push(...segments(data, false, a + Math.round(.3 * RATE)));
        else {
          let end = a + Math.round(piece.length * RATE);
          while (end > a + 1 && Math.abs(data[end - 1]) < 1e-4) end--;
          const one = data.slice(a, Math.min(end + Math.round(.01 * RATE), data.length));
          const tail = Math.min(one.length, Math.round(.005 * RATE));
          for (let i = 0; i < tail; i++) one[one.length - 1 - i] *= i / tail;
          list.push(one);
        }
        out.set(piece.key, list);
        await slices.tick();
      }
      for (const [key, pieces] of out) this.add(key, ...await encode(pieces, slices));
    }
  }

  /** A layer's variants made elsewhere (tests, tools): its addresses and their gains. */
  provide(layer: ArmorySoundLayer, urls: readonly string[], gains: readonly number[] = urls.map(() => 1)) {
    const name = ARMORY_SOUND_NAMES[layer.sound];
    if (name) this.add(keyOf(layer, name), urls, gains);
  }

  private add(key: string, urls: readonly string[], gains: readonly number[]) {
    if (!urls.length) return;
    this.made.set(key, { urls, gains, last: -1 });
    for (const url of urls) this.urls.add(url);
    this.loaded = false;
  }

  /** Hand the game what to load, and again until it has: it loads once the player has entered the arena (its context is
   *  made then), not before. A few files at a time - `PACE` a pump, a pump every other frame or so while some wait, `RUSH_PACE` while
   *  a room loads - for each is a fetch and a decode landing on the page as it finishes: two hundred of them handed over at
   *  once were a frame of 80-150 ms (scripts/night/load_hitches.mjs, `audio` hitches). Whole every half second when idle. */
  pump(out: ArmorySoundOut, now = clock()) {
    if (this.loaded || now - this.pumpedAt < (this.backlog ? PACE_GAP : .5)) return;
    this.pumpedAt = now;
    const missing = [...this.urls].filter(url => out.sampleSeconds(url) === undefined);
    if (!missing.length) { this.loaded = this.urls.size > 0; this.backlog = false; return; }
    // (One the game's audio has not answered for is asked again after RETRY: it had no context yet, or it failed.)
    const waiting = missing.filter(url => now - (this.handed.get(url) ?? -Infinity) >= RETRY), give = waiting.slice(0, this.rushing > 0 ? RUSH_PACE : PACE);
    for (const url of give) this.handed.set(url, now);
    if (give.length) out.preload(give);
    this.backlog = give.length < waiting.length;
  }

  /** The files made for effects no longer built let go: every layer's variants that no effect in `keep` voices (in either mode)
   *  - what stays is a superset of what a kept effect plays - out of the bank, their blob addresses revoked. Returns the
   *  addresses, for the game's audio to drop the decoded samples (`ArmorySoundOut.release`). Called as a room is entered
   *  (fxStage.ts `retain`): each room's effects made and decoded their sound and kept it for the page's life (190 buffers, 30 MB
   *  of decoded sound, a room: scripts/night/load_hitches.mjs `chain --gc`). A later effect asks again with `need`. */
  retain(keep: Iterable<string>): string[] {
    const wanted = new Set<string>();
    for (const id of keep) {
      const profile = ARMORY_SOUND_PROFILES[id];
      if (!profile) continue;
      for (const mode of ['bed', 'full'] as const) for (const layer of voicedLayers(profile, mode)) { const name = ARMORY_SOUND_NAMES[layer.sound]; if (name) wanted.add(keyOf(layer, name)); }
    }
    const released: string[] = [];
    for (const [key, variants] of [...this.made]) {
      if (wanted.has(key)) continue;
      this.made.delete(key);
      for (const url of variants.urls) { this.urls.delete(url); this.handed.delete(url); released.push(url); if (url.startsWith('blob:')) { try { URL.revokeObjectURL(url); } catch { /* no object URLs here */ } } }
    }
    for (const key of [...this.asked.keys()]) if (!wanted.has(key)) this.asked.delete(key);
    return released;
  }

  /** Whether the game's audio holds every file made so far (or there are none): what `pump` is waiting for. */
  settled(out: ArmorySoundOut) { return !this.asked.size && [...this.urls].every(url => out.sampleSeconds(url) !== undefined); }

  /** A variant of the layer the game has loaded, not the last one played; none until one has. */
  pick(layer: ArmorySoundLayer, out: ArmorySoundOut): { url: string; gain: number } | undefined {
    const name = ARMORY_SOUND_NAMES[layer.sound];
    const v = name && this.made.get(keyOf(layer, name));
    if (!v) return undefined;
    const n = v.urls.length;
    let i = Math.floor(Math.random() * n);
    if (n > 1 && i === v.last) i = (i + 1) % n;
    for (let k = 0; k < n; k++, i = (i + 1) % n) {
      if (out.sampleSeconds(v.urls[i]) === undefined) continue;
      v.last = i;
      return { url: v.urls[i], gain: v.gains[i] };
    }
    return undefined;
  }

  /** Every address made (tests, the capture tools). */
  get addresses(): readonly string[] { return [...this.urls]; }
  get pending() { return this.asked.size; }
}

/** The page's bank. */
let bank: SoundBank | undefined;
export const soundBank = () => (bank ??= new SoundBank());

/** Ogg (Opus) where the browser decodes it, else mp3 (Safari): tried on the smallest file of the first bank. */
async function probeFormat(name: Extract<ArmorySoundName, { type: 'sample' }>): Promise<'ogg' | 'mp3'> {
  if (!name.formats.includes('ogg')) return 'mp3';
  if (!name.formats.includes('mp3')) return 'ogg';
  return (await decode(`${name.files[0]}.ogg`)) ? 'ogg' : 'mp3';
}

async function decode(url: string): Promise<Float32Array | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const buffer = await new OfflineAudioContext(1, 1, RATE).decodeAudioData(await response.arrayBuffer());
    return buffer.getChannelData(0).slice();
  } catch { return undefined; }
}

/** `LOOP_VARIANTS` stretches of a loop, each `SEGMENT` long with equal-power fades over `OVERLAP` at both ends: from
 *  random places of a seamless loop (`wrap`), else one after another from the start of a render. */
export function segments(data: Float32Array, wrap: boolean, from = 0): Float32Array[] {
  const n = Math.round(SEGMENT * RATE), fade = Math.round(OVERLAP * RATE), out: Float32Array[] = [];
  for (let v = 0; v < LOOP_VARIANTS; v++) {
    const start = wrap ? Math.floor(Math.random() * data.length) : from + v * n;
    const piece = new Float32Array(n);
    for (let i = 0; i < n; i++) piece[i] = data[(start + i) % data.length] ?? 0;
    for (let i = 0; i < fade; i++) {
      const k = Math.sin(Math.PI / 2 * i / fade);
      piece[i] *= k; piece[n - 1 - i] *= k;
    }
    out.push(piece);
  }
  return out;
}

/** Each piece as a 16-bit WAV blob URL, normalised to -0.2 dBFS, with the gain that puts its level back; in slices if given. */
async function encode(pieces: readonly Float32Array[], slices?: Slices): Promise<[string[], number[]]> {
  const urls: string[] = [], gains: number[] = [];
  for (const piece of pieces) {
    let peak = 0;
    for (let from = 0; from < piece.length; from += BLOCK) {
      for (let i = from, to = Math.min(piece.length, from + BLOCK); i < to; i++) { const x = Math.abs(piece[i]); if (x > peak) peak = x; }
      await slices?.tick();
    }
    if (peak < 1e-5) continue;
    const k = .98 / peak;
    urls.push(URL.createObjectURL(await wavSliced(piece, RATE, k, slices)));
    gains.push(1 / k);
  }
  return [urls, gains];
}

const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

/** A mono 16-bit PCM WAV's 44 bytes of header and room for `n` samples after them (`pcm`: those as 16-bit words, where the
 *  machine writes them as WAV does; else the samples are written through the view). */
function wavFrame(n: number, rate: number) {
  const buffer = new ArrayBuffer(44 + n * 2), v = new DataView(buffer);
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  text(36, 'data'); v.setUint32(40, n * 2, true);
  return { buffer, v, pcm: LITTLE_ENDIAN ? new Int16Array(buffer, 44, n) : undefined };
}

/** Samples `from` to `to` of `data × k` written into a frame. (A typed array's store is several times a DataView's.) */
function wavFill({ v, pcm }: ReturnType<typeof wavFrame>, data: Float32Array, k: number, from: number, to: number) {
  if (pcm) for (let i = from; i < to; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, data[i] * k)) * 0x7fff);
  else for (let i = from; i < to; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, data[i] * k)) * 0x7fff), true);
}

/** A mono 16-bit PCM WAV of `data × k`. */
export function wav(data: Float32Array, rate: number, k = 1) {
  const frame = wavFrame(data.length, rate);
  wavFill(frame, data, k, 0, data.length);
  return new Blob([frame.buffer], { type: 'audio/wav' });
}

/** The same, written `BLOCK` samples at a time with a look at the clock between (`wav` is the one-go form for tools). */
async function wavSliced(data: Float32Array, rate: number, k: number, slices?: Slices) {
  const frame = wavFrame(data.length, rate);
  for (let from = 0; from < data.length; from += BLOCK) { wavFill(frame, data, k, from, Math.min(data.length, from + BLOCK)); await slices?.tick(); }
  return new Blob([frame.buffer], { type: 'audio/wav' });
}

/** The capture tools' window on it: what was sent to the game, newest last. */
interface Sent { t: number; effect: string; sound: string; url: string; gain: number; rate: number; delay: number }
const SENT_CAP = 600;

/** One cast's sound, driven by its effect instance (effect.ts): `phase` on each of the ability's phase changes, `event`
 *  for each hit the ability makes (a burst, a flash, a shake, the blade pack's sparks), `tick` every frame, `end` once. */
export class CastSound {
  private loops: { layer: ArmorySoundLayer; next: number }[] | null = null;
  private loopAt = 0;
  private lastImpact = -Infinity;
  private fired = 0;
  private pending = 0;
  private released = false;
  private tailDone = false;
  private phaseImpactAt = 0;
  private ended = false;

  constructor(private readonly player: ArmorySound, readonly effectId: string, readonly profile: ArmorySoundProfile, readonly mode: SoundMode, private at: SoundAt, now = clock()) {
    if (mode === 'full') { this.cue(profile.cast, 1); this.cue(profile.charge, 1); }
    if (profile.loop?.at === 'cast') this.startLoop(now);
  }

  phase(phase: string, now = clock()) {
    const loop = this.profile.loop;
    if (phase === 'impact') {
      this.phaseImpactAt = now;
      if (loop?.at === 'impact') this.startLoop(now);
      if (loop?.until === 'impact') this.stopLoop(now);
    } else if (phase === 'fade') {
      if (loop?.until === 'fade' || loop?.until === 'impact') this.stopLoop(now);
      this.tail();
    }
  }

  /** A hit the ability made this frame, at intensity 0 to 1 (and a bit over): merged into one per frame. */
  event(intensity: number) { if (intensity > this.pending) this.pending = intensity; }

  tick(at: SoundAt, now = clock()) {
    if (this.ended) return;
    this.at = at;
    const P = this.profile;
    if (this.pending > 0) {
      const hit = P.impacts?.find(i => i.on === 'hit'), gap = hit?.gap ?? .09;
      if ((now - this.lastImpact >= gap || this.pending > .85) && this.pending >= (hit?.min ?? .06)) this.impact(this.pending, now);
      this.pending = 0;
    }
    // An impact phase with no hit of its own is one, unless a hit just was.
    if (this.phaseImpactAt && now - this.phaseImpactAt > .07) {
      if (now - this.lastImpact > .3) this.impact(.6, now);
      this.phaseImpactAt = 0;
    }
    // Many effects never fade as such: the tail follows the last hit instead.
    if (P.tail && !this.tailDone && this.fired > 0 && now - this.lastImpact > .9) this.tail();
    if (this.loops?.length && P.loop && now - this.loopAt > P.loop.max) this.stopLoop(now);
    this.lay(now);
  }

  /** The effect is over: its loop stops (what is laid plays out, within a segment, or over its `fade`). */
  end(now = clock()) { this.stopLoop(now); this.ended = true; }

  get looping() { return !!this.loops?.length; }
  get hits() { return this.fired; }

  private impact(intensity: number, now: number) {
    this.lastImpact = now; this.fired++;
    const P = this.profile, first = P.impacts?.find(i => i.on === 'first'), hit = P.impacts?.find(i => i.on === 'hit');
    if (!this.released) {
      this.released = true;
      if (P.loop?.at === 'release') this.startLoop(now);
      if (first) { if (this.mode === 'full') this.cue(first.layers, Math.max(.6, intensity)); return; }
    }
    // A long barrage thins out: after a dozen hits, only every other soft one is voiced.
    if (this.fired > 12 && this.fired % 2 === 1 && intensity < .7) return;
    if (this.mode === 'full' && hit) this.cue(hit.layers, intensity);
  }

  private tail() {
    if (this.tailDone) return;
    this.tailDone = true;
    this.cue(this.profile.tail, 1);
  }

  private cue(layers: readonly ArmorySoundLayer[] | undefined, intensity: number) {
    const scale = .45 + .55 * Math.min(1.1, intensity);
    for (const layer of layers ?? []) {
      if (layer.minIntensity && intensity < layer.minIntensity) continue;
      if (layer.maxIntensity && intensity > layer.maxIntensity) continue;
      this.player.play(this.effectId, layer, scale * LEVEL[this.mode], this.at);
    }
  }

  private startLoop(now: number) {
    if (this.loops || this.ended) return;
    this.loopAt = now;
    this.loops = (this.profile.loop?.layers ?? []).filter(l => segmentable(ARMORY_SOUND_NAMES[l.sound])).map(layer => ({ layer, next: now + (layer.delay ?? 0) }));
    this.lay(now);
  }

  /** Once stopped, a loop never starts again. What is laid plays out, which takes the segment playing; a `fade` longer
   *  than that lays the segments to come now, each quieter, until it has died down (the game's one-shots take no fade
   *  of their own, so it falls in steps a segment apart, smoothed by their cross-fades). */
  private stopLoop(now = clock()) {
    const loops = this.loops, fade = this.profile.loop?.fade ?? 0;
    this.loops = [];
    if (!loops?.length || fade <= SEGMENT - OVERLAP) return;
    for (const loop of loops) {
      for (let at = Math.max(loop.next, now); at < now + fade; at += SEGMENT - OVERLAP) {
        const k = 1 - (at - now) / fade;
        if (k < .08) break;
        this.player.segment(this.effectId, loop.layer, LEVEL[this.mode] * k, this.at, Math.max(0, at - now));
      }
    }
  }

  /** Lay each loop's next segment once it is due within the look-ahead, one starting `OVERLAP` before the last ends. */
  private lay(now: number) {
    for (const loop of this.loops ?? []) {
      // After a stall (a hidden tab), start again now rather than catch up in a burst.
      if (loop.next < now - SEGMENT) loop.next = now;
      while (loop.next - now < LOOKAHEAD) {
        this.player.segment(this.effectId, loop.layer, LEVEL[this.mode], this.at, Math.max(0, loop.next - now));
        loop.next += SEGMENT - OVERLAP;
      }
    }
  }
}

/** The page's player: casts begun, and what they send to the game. */
export class ArmorySound {
  readonly sent: Sent[] = [];
  constructor(readonly out: ArmorySoundOut, readonly bank: SoundBank = soundBank()) {}

  /** A cast's sound, or none (no profile, or the page asked for none). */
  begin(effectId: string, mode: SoundMode, at: SoundAt, now = clock()): CastSound | undefined {
    const profile = ARMORY_SOUND_PROFILES[effectId];
    if (!profile || !soundWanted()) return undefined;
    this.bank.pump(this.out, now);
    return new CastSound(this, effectId, profile, mode, at, now);
  }

  play(effectId: string, layer: ArmorySoundLayer, level: number, at: SoundAt) {
    const voice = this.bank.pick(layer, this.out);
    if (!voice) return;
    const sample = ARMORY_SOUND_NAMES[layer.sound]?.type === 'sample';
    const rate = sample ? (layer.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * JITTER) : 1;
    this.send(effectId, layer.sound, voice.url, at, layer.gain * level * voice.gain * ARMORY_TO_GAME, rate, layer.delay ?? 0);
  }

  segment(effectId: string, layer: ArmorySoundLayer, level: number, at: SoundAt, delay: number) {
    const voice = this.bank.pick(layer, this.out);
    if (!voice) return;
    const sample = ARMORY_SOUND_NAMES[layer.sound]?.type === 'sample';
    this.send(effectId, layer.sound, voice.url, at, layer.gain * level * voice.gain * ARMORY_TO_GAME, sample ? layer.pitch ?? 1 : 1, delay);
  }

  private send(effect: string, sound: string, url: string, at: SoundAt, gain: number, rate: number, delay: number) {
    this.out.sample(url, at, gain, rate, OWNER, PRIORITY, delay);
    this.sent.push({ t: clock(), effect, sound, url, gain, rate, delay });
    if (this.sent.length > SENT_CAP) this.sent.splice(0, this.sent.length - SENT_CAP);
  }
}

let player: ArmorySound | undefined;
/** The page's player, once main.ts has connected the game's audio; none before (or in a build without the Armory). */
export function armorySound(): ArmorySound | undefined {
  const out = armorySoundOut();
  if (!out) return undefined;
  if (!player || player.out !== out) {
    player = new ArmorySound(out);
    if (typeof window === 'object' && window) (window as unknown as { __armorySound?: unknown }).__armorySound = player;
  }
  return player;
}

/** A dev server's `?armory-sound=off` (the capture tools' A/B); a built page always plays it. */
function soundWanted() {
  let dev = false;
  try { dev = import.meta.env.DEV === true; } catch { dev = false; }
  if (!dev || typeof location !== 'object' || !location) return true;
  try { return new URLSearchParams(location.search).get('armory-sound') !== 'off'; } catch { return true; }
}
