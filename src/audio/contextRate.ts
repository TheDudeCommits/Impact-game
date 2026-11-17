import { phone } from '../input/device';
import { rt } from '../cartridge/runtime';

/**
 * The rate a phone's sound is decoded and mixed at (the phone pass, November 2026: "iOS memory"). Every sound the game
 * decodes is held as 32-bit floats at its context's rate, and the context's rate is the device's own unless asked: 48 kHz
 * on an iPhone. The bank ships at 48 kHz mono (2,261 clips, 570 MB decoded in all; a duel's room holds about 60 MB of
 * it), so at 32 kHz a phone holds two thirds of that - about 20 MB less a room - and every node in the mix (the panners,
 * the stage's convolution reverb) does two thirds of the work. 32 kHz keeps everything up to 16 kHz: past what a phone's
 * speaker plays, and past most adults' hearing. The browser resamples the mix to the speaker's rate on the way out.
 * Desktops and tablets are unchanged. A browser that refuses the rate (Safari before 14.5) gets its own.
 */
export const PHONE_SAMPLE_RATE = 32000;

export function audioContext(latencyHint: AudioContextLatencyCategory, small = phone()): AudioContext {
  // Inside dude-world (src/cartridge) the page's one context, the world's: never another.
  if (rt.host) return rt.host.audio.ctx;
  if (small) { try { return new AudioContext({ latencyHint, sampleRate: PHONE_SAMPLE_RATE }); } catch { /* its own rate */ } }
  return new AudioContext({ latencyHint });
}

/** Where a context's mix goes out: its speakers, or inside dude-world the host's output (src/cartridge), which the world
 *  fades in and out with the game. */
export function audioOut(ctx: BaseAudioContext): AudioNode {
  return rt.host && ctx === rt.host.audio.ctx ? rt.host.audio.out : ctx.destination;
}
/** A media element's sound inside dude-world: through the host's output too (on a page of its own it plays as it is). */
export function routeMedia(element: HTMLMediaElement): void {
  const host = rt.host; if (!host) return;
  try { host.audio.ctx.createMediaElementSource(element).connect(host.audio.out); } catch { /* already routed */ }
}
/** Whether the game may close or suspend this context: never the world's. */
export const ownContext = (ctx: BaseAudioContext | undefined) => !!ctx && !(rt.host && ctx === rt.host.audio.ctx);
