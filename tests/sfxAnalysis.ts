import { readFileSync } from 'node:fs';
import { AUDIO_CUES, type AudioCue, type CueLayer } from '../src/audio/cuePlan';

export const RATE = 48000;

const files = new Map<string, Float64Array>();
/** A cue's samples (a 48 kHz mono 16-bit PCM WAV, as the bank ships them). */
export function samples(cue: AudioCue): Float64Array {
  const file = AUDIO_CUES[cue];
  let data = files.get(file);
  if (!data) {
    const b = readFileSync(new URL('../public/assets/audio/v2/' + file, import.meta.url));
    let at = 12;
    while (at + 8 <= b.length) {
      const id = b.toString('ascii', at, at + 4), size = b.readUInt32LE(at + 4);
      if (id === 'data') { const n = Math.floor(size / 2); data = new Float64Array(n); for (let i = 0; i < n; i++) data[i] = b.readInt16LE(at + 8 + i * 2) / 32768; break; }
      at += 8 + size + (size & 1);
    }
    if (!data) throw new Error(`${file}: no samples`);
    files.set(file, data);
  }
  return data;
}

/** In-place radix-2 FFT. */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const a = re[i]; re[i] = re[j]; re[j] = a; const b = im[i]; im[i] = im[j]; im[j] = b; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const w = -2 * Math.PI / len, wr = Math.cos(w), wi = Math.sin(w);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

export const BANDS = { sub: [0, 80], low: [80, 250], lowMid: [250, 1000], mid: [1000, 4000], high: [4000, 10000], air: [10000, RATE / 2] } as const;
export type Band = keyof typeof BANDS;
export interface Measure {
  seconds: number; peak: number; rmsDb: number;
  /** Peak over RMS, dB. */
  crestDb: number;
  /** The spectrum's centre of mass by power, Hz. */
  centroid: number;
  /** Each band's share of the power, 0-1. */
  bands: Record<Band, number>;
  /** The share of the power (80 Hz-12 kHz) in the twelve strongest 12 Hz-wide lines: a chord of pure tones is near 1. */
  tonal: number;
  /** Spectral flatness over the same lines, 0-1: noise is high, tones are near 0. */
  flatness: number;
  /** How far the 99th percentile of the 5 ms envelope over 2 kHz stands over its median, dB: cracks, pings and zaps
   *  against a steady hiss or nothing. */
  hfBurstDb: number;
  /** The 5 ms envelope's strongest wobble between 0.5 and 20 Hz, and its depth against the mean (a turning wind's turn). */
  amHz: number; amDepth: number;
}

const made = new Map<AudioCue, Measure>();
/** What a cue measures as. */
export function measure(cue: AudioCue): Measure {
  const known = made.get(cue);
  if (known) return known;
  const y = samples(cue), n = y.length;
  let size = 1; while (size < n) size <<= 1;
  const re = new Float64Array(size), im = new Float64Array(size);
  let peak = 0, sum = 0;
  for (let i = 0; i < n; i++) { const v = y[i]; peak = Math.max(peak, Math.abs(v)); sum += v * v; re[i] = v * (.5 - .5 * Math.cos(2 * Math.PI * i / (n - 1))); }
  fft(re, im);
  const half = size / 2, hz = RATE / size;
  const bands = { sub: 0, low: 0, lowMid: 0, mid: 0, high: 0, air: 0 } as Record<Band, number>;
  const lines = new Float64Array(Math.floor((12000 - 80) / 12));
  let total = 0, moment = 0;
  for (let k = 1; k < half; k++) {
    const p = re[k] ** 2 + im[k] ** 2, f = k * hz;
    total += p; moment += p * f;
    for (const name of Object.keys(BANDS) as Band[]) if (f >= BANDS[name][0] && f < BANDS[name][1]) { bands[name] += p; break; }
    const line = Math.floor((f - 80) / 12);
    if (line >= 0 && line < lines.length) lines[line] += p;
  }
  for (const name of Object.keys(bands) as Band[]) bands[name] /= total || 1;
  let lineSum = 0, logSum = 0;
  for (const p of lines) { lineSum += p; logSum += Math.log(p + 1e-30); }
  const top = [...lines].sort((a, b) => b - a).slice(0, 12).reduce((a, b) => a + b, 0);
  // The envelope, 5 ms a step: of the whole signal for the wobble, of what is over 2 kHz for the bursts.
  const hop = RATE / 200, steps = Math.floor(n / hop), high = highpass(y, 2000);
  const env = new Float64Array(steps), hf: number[] = [];
  for (let s = 0; s < steps; s++) {
    let a = 0, b = 0;
    for (let i = s * hop; i < (s + 1) * hop; i++) { a += y[i] ** 2; b += high[i] ** 2; }
    env[s] = Math.sqrt(a / hop); hf.push(Math.sqrt(b / hop));
  }
  hf.sort((a, b) => a - b);
  const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-9));
  let amHz = 0, amDepth = 0;
  if (steps >= 100) {
    const mean = env.reduce((a, b) => a + b, 0) / steps;
    for (let f = .5; f <= 20; f += .05) {
      let c = 0, s = 0;
      for (let i = 0; i < steps; i++) { const w = .5 - .5 * Math.cos(2 * Math.PI * i / (steps - 1)), ph = 2 * Math.PI * f * i / 200; c += (env[i] - mean) * w * Math.cos(ph); s += (env[i] - mean) * w * Math.sin(ph); }
      const depth = 4 * Math.hypot(c, s) / (steps * mean + 1e-12);
      if (depth > amDepth) { amDepth = depth; amHz = f; }
    }
  }
  const out: Measure = {
    seconds: n / RATE, peak, rmsDb: 10 * Math.log10(sum / n + 1e-20), crestDb: db(peak) - 10 * Math.log10(sum / n + 1e-20), centroid: moment / (total || 1), bands,
    tonal: top / (lineSum || 1), flatness: Math.exp(logSum / lines.length) / (lineSum / lines.length + 1e-30),
    hfBurstDb: db(hf[Math.floor(hf.length * .99)]) - db(hf[Math.floor(hf.length / 2)]), amHz, amDepth,
  };
  made.set(cue, out);
  return out;
}

/** A two-pass Butterworth biquad, as tests/sfxPalette.test.ts filters. */
function biquad(x: Float64Array, kind: 'highpass' | 'lowpass', f: number) {
  const w = 2 * Math.PI * f / RATE, cos = Math.cos(w), alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const b = kind === 'highpass' ? [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2] : [(1 - cos) / 2, 1 - cos, (1 - cos) / 2], a = [1 + alpha, -2 * cos, 1 - alpha];
  let y = x;
  for (let pass = 0; pass < 2; pass++) {
    const z = new Float64Array(y.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) { const v = (b[0] * y[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2) / a[0]; x2 = x1; x1 = y[i]; y2 = y1; y1 = v; z[i] = v; }
    y = z;
  }
  return y;
}
export const highpass = (x: Float64Array, f: number) => biquad(x, 'highpass', f);
export const lowpass = (x: Float64Array, f: number) => biquad(x, 'lowpass', f);
/** The band a voice line is understood in. */
export const speechBand = (x: Float64Array) => lowpass(highpass(x, 1000), 4000);

/** Layers mixed as CombatAudio plays them: gain, delay, rate, held length, loop points (no ducking, no fades). */
export function render(layers: readonly CueLayer[], seconds = 6): Float64Array {
  const out = new Float64Array(Math.round(seconds * RATE));
  for (const l of layers) {
    const data = samples(l.cue), rate = l.rate ?? 1, from = Math.round((l.delay ?? 0) * RATE);
    const length = data.length / RATE, held = l.duration ?? length / rate, loopStart = Math.min(.08, length * .1), loopEnd = Math.max(loopStart + .03, length - .08);
    for (let i = 0; i < Math.round(held * RATE) && from + i < out.length; i++) {
      let p = i / RATE * rate; if (l.loop && p >= loopEnd) p = loopStart + (p - loopStart) % (loopEnd - loopStart);
      const k = Math.floor(p * RATE), f = p * RATE - k; if (k + 1 >= data.length) break;
      out[from + i] += (data[k] * (1 - f) + data[k + 1] * f) * l.gain;
    }
  }
  return out;
}

/** The effects as played under a line: their bus ducked to 0.72 while it speaks - down in 40 ms from 80 ms ahead of its
 *  first sound, back in 180 ms after it ends (CombatAudio.updateVoiceActivity). */
export function ducked(fx: Float64Array, said: Float64Array): Float64Array {
  let first = -1, last = -1; said.forEach((x, i) => { if (x !== 0) { if (first < 0) first = i; last = i; } });
  let g = 1;
  return fx.map((x, i) => { const target = i >= first - .08 * RATE && i <= last ? .72 : 1; g += (target - g) * (1 - Math.exp(-1 / ((target < g ? .04 : .18) * RATE))); return x * g; });
}

/** Level in 100 ms frames, dB. */
export function frames(x: Float64Array): number[] {
  const hop = RATE / 10, out: number[] = [];
  for (let i = 0; i + hop <= x.length; i += hop) { let a = 0; for (let j = i; j < i + hop; j++) a += x[j] ** 2; out.push(10 * Math.log10(a / hop + 1e-20)); }
  return out;
}

/** The loudest 400 ms, dB. */
export function loudest(x: Float64Array): number {
  let best = -200;
  for (let i = 0; i + .4 * RATE <= x.length; i += RATE / 100) { let s = 0; for (let j = i; j < i + .4 * RATE; j++) s += x[j] ** 2; best = Math.max(best, 10 * Math.log10(s / (.4 * RATE) + 1e-20)); }
  return best;
}
