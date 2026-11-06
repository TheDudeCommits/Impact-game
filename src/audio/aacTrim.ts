export const AAC_PRIMING = 2112, AAC_FRAME = 1024;

/** How long the stream is, in samples at the WAV's rate, where nothing is trimmed. */
export const untrimmedFrames = (frames: number) => Math.ceil((frames + AAC_PRIMING) / AAC_FRAME) * AAC_FRAME;

/** Two lengths in seconds that are the same sound: a resampled decode (the context at 44.1 kHz) is a sample out either way. */
const SAME = .002;

/** Where the WAV's sound lies in a decoded copy of `bank` = [frames, rate], in that buffer's own samples:
 *  `{ start: 0 }` where the browser already trimmed it, `{ start }` of the encoder delay where it did not,
 *  and undefined where the length is neither (a decoder this knows nothing about). */
export function aacWindow(length: number, sampleRate: number, [frames, rate]: readonly [number, number]): { start: number; length: number } | undefined {
  const seconds = length / sampleRate, want = frames / rate;
  if (Math.abs(seconds - want) <= SAME) return { start: 0, length };
  if (!(Math.abs(seconds - untrimmedFrames(frames) / rate) <= SAME)) return undefined;
  const start = Math.round(AAC_PRIMING * sampleRate / rate);
  return { start, length: Math.min(length - start, Math.round(want * sampleRate)) };
}

/** The copy as the WAV's sound: `buffer` itself where the browser trimmed it, else a new buffer without the encoder's delay
 *  and padding, or undefined (see aacWindow) where its length is not one this knows. */
export function trimAac(context: Pick<BaseAudioContext, 'createBuffer'>, buffer: AudioBuffer, bank: readonly [number, number]): AudioBuffer | undefined {
  const window = aacWindow(buffer.length, buffer.sampleRate, bank);
  if (!window) return undefined;
  if (window.start === 0) return buffer;
  const out = context.createBuffer(buffer.numberOfChannels, window.length, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++)
    out.copyToChannel(buffer.getChannelData(channel).subarray(window.start, window.start + window.length), channel);
  return out;
}
