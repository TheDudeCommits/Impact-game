/** A parry's sting (its distinct sound: render/parryPayoff.ts). Made here, in code, so it is the game's own and the
 *  public repo carries it: no file, no library sound. Mono, about half a second:
 *  - a swell of bright air drawn in (STING_PEAK, 70 ms), so the sting lands on its peak - the parry's freeze letting go;
 *  - there, a crack (a bright burst a few ms long), a blade's "tsing" (one sine swept down from 6.5 to 2.7 kHz over about
 *    35 ms and gone within 0.2 s: a sweep, never a ringing tone), and a thump under it (110 Hz down to 45 over 60 ms);
 *  - and a short tail of soft air.
 *  Deterministic (its noise is seeded), so every parry sounds the same, and tests/parryPayoff.test.ts can hold it. */
export const STING_SECONDS = .48, STING_PEAK = .07;

export function parrySting(sampleRate = 48000, seed = 0x2545f491): Float32Array<ArrayBuffer> {
  const n = Math.max(1, Math.round(STING_SECONDS * sampleRate)), out = new Float32Array(new ArrayBuffer(n * 4)), dt = 1 / sampleRate;
  let s = seed >>> 0 || 1;
  const noise = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 * 2 - 1; };
  // One-pole filters: a high pass at ~2.4 kHz for the bright air and the crack, a low pass at ~3 kHz for the tail.
  const hpA = Math.exp(-2 * Math.PI * 2400 * dt), lpA = Math.exp(-2 * Math.PI * 3000 * dt);
  let hpOut = 0, hpIn = 0, lpOut = 0, tsing = 0, thump = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i * dt, u = t - STING_PEAK, w = noise();
    hpOut = hpA * (hpOut + w - hpIn); hpIn = w;
    lpOut = (1 - lpA) * w + lpA * lpOut;
    let v = 0;
    if (u < 0) {
      // The swell: air drawn in, rising to the peak.
      const k = t / STING_PEAK; v += hpOut * .5 * k * k * k;
    } else {
      const on = 1 - Math.exp(-u / .0015);
      v += hpOut * 1.1 * Math.exp(-u / .006) * on;                                        // the crack
      tsing += 2 * Math.PI * (2700 + 3800 * Math.exp(-u / .035)) * dt;
      v += Math.sin(tsing) * .55 * Math.exp(-u / .045) * on;                              // the tsing
      thump += 2 * Math.PI * (45 + 65 * Math.exp(-u / .06)) * dt;
      v += Math.sin(thump) * .8 * Math.exp(-u / .07) * on;                                // the thump
      v += lpOut * .22 * Math.exp(-u / .12) * on;                                         // the tail
      // The last 20 ms faded to nothing.
      v *= Math.min(1, (STING_SECONDS - t) / .02);
    }
    out[i] = v; peak = Math.max(peak, Math.abs(v));
  }
  const gain = peak > 0 ? .9 / peak : 1;
  for (let i = 0; i < n; i++) out[i] *= gain;
  return out;
}
