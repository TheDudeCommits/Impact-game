import type { Pulse } from './rumble';

/**
 * A phone's own buzz for the blows a pad would rumble for (the phone pass, November 2026), while the touch controls are
 * the controller: a blow landed or taken, a guard broken, a fall. A phone motor has one strength, so a pulse's is its
 * length - a light hit landed about 15 ms, a heavy one taken about 25, a fall 40: a tick, never a buzz. At most one every
 * GAP ms (a combo's string is felt, a horde's crowd is not a drone), and the pad's own VIBRATION setting scales it (0:
 * off). navigator.vibrate is Android's: an iPhone has none, and nothing is asked of it.
 */
export const GAP = 90, LONGEST = 40;
/** The length of a pulse at full strength, ms (0: nothing worth a buzz). */
export function buzzFor(pulse: Pulse, scale = 1): number {
  const strength = Math.max(pulse.strong, pulse.weak) * Math.max(0, Math.min(1, scale));
  if (strength < .15) return 0;
  return Math.round(Math.min(LONGEST, 6 + strength * 34));
}

export class TouchHaptics {
  /** The player's vibration setting, 0-1 (Settings.vibration, as the pad's Rumble.scale). */
  scale = 1;
  private pending = 0;
  private until = -Infinity;
  constructor(private readonly vibrate = (ms: number) => { try { return (navigator as Navigator & { vibrate?: (ms: number) => boolean }).vibrate?.(ms) ?? false; } catch { return false; } }) {}
  /** True where the device can buzz at all. */
  static available() { return typeof navigator === 'object' && typeof (navigator as Navigator & { vibrate?: unknown }).vibrate === 'function'; }
  add(pulse: Pulse) { this.pending = Math.max(this.pending, buzzFor(pulse, this.scale)); }
  /** Once a frame: the strongest pulse gathered, if the last buzz is over and a gap behind it. Answers the ms sent. */
  flush(now: number): number {
    const ms = this.pending; this.pending = 0;
    if (!ms || now < this.until) return 0;
    this.until = now + ms + GAP;
    this.vibrate(ms);
    return ms;
  }
  stop() { this.pending = 0; if (this.until > -Infinity) this.vibrate(0); this.until = -Infinity; }
}
