
/** mulberry32. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A normal deviate (Box-Muller). */
function gauss(random: () => number) { return Math.sqrt(-2 * Math.log(Math.max(1e-12, random()))) * Math.cos(2 * Math.PI * random()); }

export function white(n: number, seed: number) {
  const r = rng(seed), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = r() * 2 - 1;
  return out;
}
/** Pink noise (Paul Kellet's refined filter), about unit RMS / 3. */
export function pink(n: number, seed: number) {
  const r = rng(seed), out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
    b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
  }
  return out;
}
/** Brown noise: leaky-integrated white. */
export function brown(n: number, seed: number) {
  const r = rng(seed), out = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) { y = y * .996 + (r() * 2 - 1) * .06; out[i] = y; }
  return out;
}

/** An RBJ biquad, applied in place. */
export function biquad(x: Float32Array, type: 'lowpass' | 'highpass' | 'bandpass', freq: number, q: number, rate: number) {
  const w = 2 * Math.PI * Math.min(freq, rate * .45) / rate, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; }
  else if (type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; }
  else { b0 = alpha; b1 = 0; b2 = -alpha; }
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  const c0 = b0 / a0, c1 = b1 / a0, c2 = b2 / a0, d1 = a1 / a0, d2 = a2 / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i], y = c0 * v + c1 * x1 + c2 * x2 - d1 * y1 - d2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}
/** A one-pole lowpass whose cutoff follows `cutoff(i)` sample by sample, in place. */
export function sweptLowpass(x: Float32Array, cutoff: (i: number) => number, rate: number) {
  let y = 0;
  for (let i = 0; i < x.length; i++) { const k = 1 - Math.exp(-2 * Math.PI * cutoff(i) / rate); y += (x[i] - y) * k; x[i] = y; }
  return x;
}
export function rms(x: Float32Array) { let e = 0; for (let i = 0; i < x.length; i++) e += x[i] * x[i]; return Math.sqrt(e / Math.max(1, x.length)); }
export function scaleTo(x: Float32Array, target: number) { const k = target / Math.max(1e-9, rms(x)); for (let i = 0; i < x.length; i++) x[i] *= k; return x; }
function mixInto(into: Float32Array, add: Float32Array, gain: number) { for (let i = 0; i < into.length; i++) into[i] += add[i] * gain; return into; }

/** `n` samples that loop without a seam: `x` holds `n + fade` samples, and its last `fade` are crossfaded (equal power)
 *  into its first, so sample n-1 runs on into sample 0 as the recording ran on. */
export function seamless(x: Float32Array, n: number, fade: number) {
  if (x.length < n + fade) throw new Error(`seamless: ${x.length} samples for a loop of ${n} with a ${fade} fade`);
  const out = x.slice(0, n);
  for (let i = 0; i < fade; i++) {
    const u = (i + .5) / fade, inn = Math.sin(u * Math.PI / 2), was = Math.cos(u * Math.PI / 2);
    out[i] = x[i] * inn + x[n + i] * was;
  }
  return out;
}

/** A stone hall's air: a low, soft rumble of the building and a breath of the room, drifting slowly. */
export function room(rate: number, seconds: number, seed: number) {
  const fade = Math.round(rate * 1.5), n = Math.round(rate * seconds), total = n + fade;
  const low = biquad(biquad(brown(total, seed), 'lowpass', 220, .7, rate), 'highpass', 35, .7, rate);
  const air = biquad(pink(total, seed + 1), 'bandpass', 900, .5, rate);
  scaleTo(low, 1); scaleTo(air, .22); mixInto(low, air, 1);
  for (let i = 0; i < total; i++) { const t = i / rate; low[i] *= 1 + .14 * Math.sin(2 * Math.PI * t / 9.7) + .08 * Math.sin(2 * Math.PI * t / 4.3 + 1); }
  return seamless(low, n, fade);
}

/** A waterfall into a river: the fall's broad roar and rumble, and the river's babble - hundreds of small bubbles a
 *  second, each a damped sine rising in pitch as it rings, which is what running water is. */
export function water(rate: number, seconds: number, seed: number) {
  const fade = Math.round(rate * 1.5), n = Math.round(rate * seconds), total = n + fade, r = rng(seed + 7);
  const roar = biquad(biquad(pink(total, seed), 'lowpass', 1900, .6, rate), 'highpass', 70, .7, rate);
  const rumble = biquad(brown(total, seed + 1), 'lowpass', 280, .7, rate);
  const babble = new Float32Array(total);
  const perSecond = 140;
  for (let t = 0; t < total;) {
    t += Math.max(1, Math.round(-Math.log(Math.max(1e-9, r())) * rate / perSecond));
    const f0 = 450 * Math.pow(2200 / 450, r()), tau = (.006 + r() * .016) * rate, amp = Math.exp(gauss(r) * .6) * .05;
    const length = Math.min(Math.round(tau * 4), total - t);
    let phase = 0;
    for (let k = 0; k < length; k++) {
      const f = f0 * (1 + .9 * k / (3 * tau));
      phase += 2 * Math.PI * f / rate;
      babble[t + k] += amp * Math.sin(phase) * Math.exp(-k / tau);
    }
  }
  const fizz = biquad(white(total, seed + 2), 'highpass', 4200, .7, rate);
  scaleTo(roar, 1); scaleTo(rumble, .45); scaleTo(babble, .55); scaleTo(fizz, .06);
  mixInto(mixInto(mixInto(roar, rumble, 1), babble, 1), fizz, 1);
  for (let i = 0; i < total; i++) { const t = i / rate; roar[i] *= 1 + .07 * Math.sin(2 * Math.PI * t / 6.1) + .05 * Math.sin(2 * Math.PI * t / 2.7 + 2); }
  return seamless(roar, n, fade);
}

/** Surf: `waves` waves a loop, each a swell that darkly gathers, breaks bright, and washes back up the sand in a long
 *  fizzing hiss that fades into the next - over the sea's own hiss and rumble, which never stop between waves. The wave
 *  before the loop and the one after it are drawn too, so the loop's two ends hold the same sea. */
export function surf(rate: number, seconds: number, seed: number, waves = 2) {
  const fade = Math.round(rate * 1.5), n = Math.round(rate * seconds), total = n + fade, r = rng(seed + 11);
  const out = scaleTo(biquad(pink(total, seed), 'lowpass', 900, .6, rate), .2);
  mixInto(out, scaleTo(biquad(brown(total, seed + 1), 'lowpass', 200, .7, rate), .16), 1);
  const period = seconds / waves, swell = 2.2 * rate, tail = 7 * rate, length = Math.round(swell + tail), out1 = 1.2 * rate;
  for (let w = -1; w <= waves; w++) {
    const start = Math.round((w * period + (r() - .5) * .5) * rate), size = .75 + r() * .5;
    const noise = pink(length, seed + 100 + w + waves), hiss = biquad(white(length, seed + 200 + w + waves), 'highpass', 2600, .7, rate);
    const cutoff = (i: number) => i < swell ? 300 + 600 * (i / swell) ** 2 : 3800 * Math.exp(-(i - swell) / (1.4 * rate)) + 700;
    sweptLowpass(noise, cutoff, rate); scaleTo(noise, 1); scaleTo(hiss, .5);
    for (let i = 0; i < length; i++) {
      const at = start + i;
      if (at < 0 || at >= total) continue;
      const since = i - swell;
      const body = since < 0 ? .55 * (i / swell) ** 2.2 : Math.exp(-since / (1.6 * rate)) * Math.min(1, .55 + since / (.2 * rate));
      // The wash's fizz: it rises with the break and outlasts the body, crackling as the foam bursts.
      const crackle = .6 + .4 * Math.sin(i * .0137 + w) * Math.sin(i * .0031);
      const foam = since < 0 ? 0 : Math.exp(-since / (2.2 * rate)) * Math.min(1, since / (.3 * rate)) * crackle;
      // Whatever is left of the wave at the end of its draw fades out rather than stopping.
      const end = Math.min(1, (length - i) / out1), fadeOut = Math.sin(end * Math.PI / 2) ** 2;
      out[at] += size * fadeOut * (noise[i] * body * .9 + hiss[i] * foam * .55);
    }
  }
  return seamless(out, n, fade);
}

export function drone(rate: number, seconds: number, seed: number) {
  const fade = Math.round(rate * 1.5), n = Math.round(rate * seconds), total = n + fade;
  const whole = (f: number) => Math.round(f * seconds) / seconds;
  // The fifths' upper octaves too, quieter and beating slower: a phone or a laptop plays nothing under ~150 Hz, and
  // a domain must not go silent on one.
  const tones: [number, number][] = [[41.2, .5], [41.2 + .15, .32], [61.74, .3], [61.74 + .1, .2], [82.41, .22], [82.41 + .2, .14], [123.47, .06],
    [164.81, .075], [164.81 + .11, .05], [246.94, .05], [246.94 + .07, .035], [329.63, .028]];
  const out = new Float32Array(total);
  for (const [f, a] of tones) { const w = 2 * Math.PI * whole(f) / rate; for (let i = 0; i < total; i++) out[i] += a * Math.sin(w * i); }
  const breath = biquad(brown(total, seed), 'lowpass', 160, .7, rate);
  scaleTo(breath, .35);
  const lfo = (t: number) => .6 + .4 * Math.sin(2 * Math.PI * t * whole(1 / 6.3)) * Math.sin(2 * Math.PI * t * whole(1 / 9.1) + 1.3);
  for (let i = 0; i < total; i++) out[i] += breath[i] * lfo(i / rate);
  const whistle = biquad(white(total, seed + 3), 'bandpass', 2600, 9, rate);
  scaleTo(whistle, .018);
  for (let i = 0; i < total; i++) { const t = i / rate, swell = Math.max(0, Math.sin(2 * Math.PI * t * whole(1 / 7.7))) ** 3; out[i] += whistle[i] * swell; }
  return seamless(out, n, fade);
}

/** A banner in the wind: a gust that fills it and a run of flaps, each a short bright burst of cloth with a soft low
 *  thump on the strong ones. One-shot, `seconds` long. */
export function flag(rate: number, seconds: number, seed: number) {
  const n = Math.round(rate * seconds), r = rng(seed + 31), out = new Float32Array(n);
  const cloth = biquad(biquad(white(n, seed), 'bandpass', 1700 + r() * 700, 1.1, rate), 'highpass', 400, .7, rate);
  const thump = biquad(white(n, seed + 1), 'lowpass', 240, .7, rate);
  scaleTo(cloth, 1); scaleTo(thump, 1);
  const gust = (t: number) => Math.min(1, t / .45) * Math.min(1, (seconds - t) / .7);
  let t = .05 * rate;
  while (t < n) {
    const strength = gust(t / rate) * (.55 + r() * .45), decay = (.025 + r() * .03) * rate;
    for (let k = 0; k < decay * 4 && t + k < n; k++) {
      const e = Math.exp(-k / decay) * Math.min(1, k / (.003 * rate));
      out[Math.round(t) + k] += strength * e * (cloth[Math.round(t) + k] * .8 + (strength > .7 ? thump[Math.round(t) + k] * .5 : 0));
    }
    t += rate / (9 + r() * 5);
  }
  return out;
}

/** A distant bird's call, one of three kinds of phrase: a few rising chirps, a quick trill, or a slow sliding whistle
 *  with a flutter in it. Each note a sine with a quiet octave, shaped and swept; then softened by distance and given a
 *  little air (three faint, darker echoes). */
export function bird(rate: number, seed: number) {
  const r = rng(seed + 47), kind = seed % 3, notes: { at: number; length: number; from: number; to: number; vibrato: number }[] = [];
  if (kind === 0) {
    const count = 2 + Math.floor(r() * 3), base = 2800 + r() * 900;
    for (let k = 0, at = 0; k < count; k++) { const length = .045 + r() * .03; notes.push({ at, length, from: base, to: base * (1.3 + r() * .25), vibrato: 0 }); at += length + .06 + r() * .05; }
  } else if (kind === 1) {
    const count = 8 + Math.floor(r() * 7), base = 4200 + r() * 700;
    for (let k = 0, at = 0; k < count; k++) { notes.push({ at, length: .02, from: base * (1 - k * .006), to: base * (.93 - k * .006), vibrato: 0 }); at += .045; }
  } else {
    const count = 1 + Math.floor(r() * 2), base = 2100 + r() * 500;
    for (let k = 0, at = 0; k < count; k++) { const length = .18 + r() * .14; notes.push({ at, length, from: base, to: base * (1.25 + r() * .2), vibrato: 60 }); at += length + .09; }
  }
  const end = notes[notes.length - 1], n = Math.round(rate * (end.at + end.length + .35)), dry = new Float32Array(n);
  for (const note of notes) {
    const start = Math.round(note.at * rate), length = Math.round(note.length * rate);
    let phase = 0;
    for (let k = 0; k < length && start + k < n; k++) {
      const u = k / length, f = note.from + (note.to - note.from) * u + note.vibrato * Math.sin(2 * Math.PI * 24 * k / rate);
      phase += 2 * Math.PI * f / rate;
      const envelope = Math.min(1, k / (.006 * rate)) * Math.sin(Math.PI * Math.min(1, u * 1.05)) ** .6;
      dry[start + k] += envelope * (Math.sin(phase) + .12 * Math.sin(2 * phase));
    }
  }
  biquad(dry, 'lowpass', 6500, .7, rate);
  const out = dry.slice();
  for (const [delay, gain, dark] of [[.035, .2, 4200], [.071, .12, 3200], [.118, .07, 2400]] as const) {
    const echo = biquad(dry.slice(), 'lowpass', dark, .7, rate), shift = Math.round(delay * rate);
    for (let i = shift; i < n; i++) out[i] += echo[i - shift] * gain;
  }
  return out;
}

/** A foot in water (the Rise of a Ninja pass, iteration ten: game/footing.ts): the slap of the sole on the surface, the
 *  low plop of the pocket it opens, a few bubbles ringing up as it closes, and the drops it threw pattering back. `big`
 *  is a body or a blow landing in it: a heavier slap and thump, a crowd of bubbles, a long patter and a wash. */
export function splash(rate: number, seed: number, big = false) {
  const r = rng(seed + 59), seconds = big ? .95 : .4, n = Math.round(rate * seconds), out = new Float32Array(n);
  const slap = biquad(biquad(white(n, seed), 'bandpass', big ? 900 : 1800, big ? .6 : .8, rate), 'highpass', 250, .7, rate);
  const slapTau = (big ? .07 : .022) * rate;
  for (let i = 0; i < n; i++) out[i] += slap[i] * Math.min(1, i / (.002 * rate)) * Math.exp(-i / slapTau) * (big ? 1.4 : 1);
  // The pocket: a short low glide.
  let phase = 0;
  for (let i = 0, length = Math.round((big ? .32 : .09) * rate); i < length && i < n; i++) {
    const u = i / length, f = (big ? 120 : 190) * (1 - .5 * u);
    phase += 2 * Math.PI * f / rate;
    out[i] += (big ? .9 : .45) * Math.sin(phase) * Math.min(1, i / (.004 * rate)) * Math.exp(-i / ((big ? .12 : .035) * rate));
  }
  // Bubbles: damped sines rising as they ring.
  for (let k = 0, count = big ? 30 + Math.floor(r() * 12) : 4 + Math.floor(r() * 5); k < count; k++) {
    const at = Math.round((.012 + r() * (big ? .42 : .17)) * rate), f0 = 650 * Math.pow(2600 / 650, r()), tau = (.006 + r() * .014) * rate, amp = (.12 + r() * .2) * (big ? .7 : 1);
    let p = 0;
    for (let i = 0; i < tau * 4 && at + i < n; i++) { p += 2 * Math.PI * f0 * (1 + .8 * i / (3 * tau)) / rate; out[at + i] += amp * Math.sin(p) * Math.exp(-i / tau); }
  }
  // The drops falling back: tiny bright ticks.
  const ticks = biquad(white(n, seed + 1), 'bandpass', 4200, 1.2, rate);
  for (let k = 0, count = big ? 18 + Math.floor(r() * 10) : 3 + Math.floor(r() * 4); k < count; k++) {
    const at = Math.round(((big ? .2 : .11) + r() * (big ? .6 : .2)) * rate), amp = (.15 + r() * .25) * (big ? .8 : 1);
    for (let i = 0; i < .006 * rate && at + i < n; i++) out[at + i] += amp * ticks[at + i] * Math.exp(-i / (.0015 * rate)) * 3;
  }
  if (big) {
    // The wash of it settling.
    const wash = biquad(pink(n, seed + 2), 'lowpass', 1500, .6, rate);
    for (let i = 0; i < n; i++) out[i] += wash[i] * .9 * Math.min(1, i / (.04 * rate)) * Math.exp(-i / (.25 * rate));
  }
  biquad(out, 'lowpass', 9000, .7, rate);
  // Faded to nothing at the end.
  for (let i = Math.round(n * .85); i < n; i++) out[i] *= (n - i) / (n * .15);
  return out;
}
