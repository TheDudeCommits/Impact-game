import type { CombatEvent } from '../game/types';
import { LOCK_ESCAPE_WINDOW } from '../game/lockCombat';

/** One burst of the pad's two motors: the heavy low one and the light high
 *  one, each 0-1, for so many milliseconds. `delay`: milliseconds from now it
 *  starts (the lock gap's waits for its window to open). `urgent`: a cue to act
 *  on, sent through whatever is still playing (a phone's GAP included). */
export interface Pulse { strong: number; weak: number; ms: number; delay?: number; urgent?: boolean }

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const clock = () => typeof performance === 'object' ? performance.now() : 0;

/** What a combat event feels like in the hands of the fighter `self`, if
 *  anything. Blows taken shake by what they were worth; blows landed tick,
 *  harder the bigger the move; the rest are the moments a fight turns on. */
export function pulseFor(event: CombatEvent, self: string, enemy?: (id: string) => boolean): Pulse | undefined {
  const mine = event.actorId === self, onMe = event.targetId === self;
  switch (event.kind) {
    case 'hit': {
      const damage = event.damage ?? 30;
      if (onMe) return { strong: clamp(.25 + damage / 250), weak: clamp(.35 + damage / 400), ms: Math.min(260, 80 + damage * .9) };
      if (!mine) return undefined;
      const slot = event.slot ?? 'light', extra = event.critical ? .15 : 0;
      const pulse = slot === 'ultimate' ? { strong: .6, weak: .75 + extra, ms: 130 } : slot === 'special' ? { strong: .35, weak: .45 + extra, ms: 90 }
        : slot === 'heavy' ? { strong: .25, weak: .4 + extra, ms: 70 } : { strong: 0, weak: .22 + extra, ms: 40 };
      // A COUNTER or a PUNISH (held longer: simulation.ts REWARD_HITSTOP) kicks harder and longer than the blow alone.
      return event.counter || event.punish ? { strong: Math.max(pulse.strong, .35), weak: clamp(pulse.weak + .3), ms: Math.max(pulse.ms, 95) } : pulse;
    }
    case 'blocked': return onMe ? { strong: .1, weak: .28, ms: 50 } : mine ? { strong: 0, weak: .12, ms: 35 } : undefined;
    case 'just-guard': return onMe ? { strong: .45, weak: .7, ms: 110 } : undefined;
    case 'guard-break': return onMe ? { strong: .85, weak: .5, ms: 240 } : mine ? { strong: .45, weak: .55, ms: 140 } : undefined;
    case 'dodge': return onMe ? { strong: 0, weak: .25, ms: 50 } : undefined;
    case 'chase': return mine ? { strong: 0, weak: .3, ms: 70 } : undefined;
    case 'wall-splat': case 'ground-bounce': return mine ? { strong: .5, weak: .3, ms: 130 } : undefined;
    case 'awaken': return mine ? { strong: .6, weak: .85, ms: 450 } : undefined;
    case 'cast': return mine && event.slot === 'ultimate' ? { strong: .4, weak: .75, ms: 320 } : undefined;
    case 'poise-break': return onMe ? { strong: .55, weak: .45, ms: 160 } : undefined;
    // the escape's moments, felt as sharp as they are seen. The gap a round of a lock string
    // leaves its body (lockCombat.ts): a crisp tick of the light motor as the escape window opens - when the blow's
    // freeze lets go (`due` less the window) - the cue to press GUARD; nothing when a press made during the round has
    // already shut it. The defender's own vanish out of it, or out of a parry, a whoosh; a failed try a dull bump; a
    // string broken (BREAK) a shove for the one breaking out and a jolt for the one broken; a counter stance meeting a
    // blow (techniques.ts), a parry's kick.
    case 'lock-gap': return onMe && !event.reason ? { strong: .12, weak: .85, ms: 55, urgent: true, delay: Math.max(0, ((event.due ?? event.serverTime + LOCK_ESCAPE_WINDOW) - LOCK_ESCAPE_WINDOW - event.serverTime) * 1000) } : undefined;
    case 'vanish': return mine ? { strong: .08, weak: .55, ms: 75 } : onMe ? { strong: 0, weak: .3, ms: 45 } : undefined;
    case 'lock-escape': return mine && event.reason && event.reason !== 'counter' ? { strong: .3, weak: 0, ms: 45 } : undefined;
    case 'break': return mine ? { strong: .45, weak: .6, ms: 120 } : onMe ? { strong: .3, weak: .25, ms: 80 } : undefined;
    case 'counter': return mine ? { strong: .45, weak: .75, ms: 110 } : onMe ? { strong: .35, weak: .3, ms: 90 } : undefined;
    // Falling is the biggest thing a run has to say; a horde's every death
    // would be a buzz that never stops, so only a fighter's fall is felt.
    case 'eliminated':
      if (onMe) return { strong: 1, weak: 1, ms: 700 };
      return mine && event.targetId && !enemy?.(event.targetId) ? { strong: .5, weak: .6, ms: 200 } : undefined;
    default: return undefined;
  }
}

/** The part of a Gamepad's vibrationActuator the game uses. */
export interface Actuator {
  playEffect?(type: 'dual-rumble', params: { startDelay: number; duration: number; strongMagnitude: number; weakMagnitude: number }): Promise<unknown>;
  reset?(): Promise<unknown>;
}

/** Mixes the pulses of a frame into one effect and sends at most one every
 *  `WINDOW` ms. A horde lands a dozen blows at once, and each playEffect
 *  replaces the last, so sending them one by one would cut the big ones short:
 *  a pulse weaker than what is still playing is left to it, and a stronger one
 *  carries on for as long as the one it replaces had left. */
export class Rumble {
  static readonly WINDOW = 45;
  /** The player's vibration setting, 0-1. */
  scale = 1;
  private pending?: Pulse;
  private playing = { until: -Infinity, strong: 0, weak: 0 };
  private sentAt = -Infinity;
  /** Pulses waiting on their `delay`, with when they are due. */
  private later: { at: number; pulse: Pulse }[] = [];

  add(pulse: Pulse, now = clock()) {
    if (pulse.delay && pulse.delay > 0) { this.later.push({ at: now + pulse.delay, pulse: { ...pulse, delay: 0 } }); return; }
    const p = this.pending;
    this.pending = p ? { strong: Math.max(p.strong, pulse.strong), weak: Math.max(p.weak, pulse.weak), ms: Math.max(p.ms, pulse.ms), urgent: p.urgent || pulse.urgent } : { ...pulse };
  }

  /** Sends what has gathered, if the window allows. Returns the effect sent. */
  flush(now: number, actuator?: Actuator): Pulse | undefined {
    if (this.later.length) this.later = this.later.filter(wait => { if (wait.at > now) return true; this.add(wait.pulse, now); return false; });
    if (!this.pending || now - this.sentAt < Rumble.WINDOW && !this.pending.urgent) return undefined;
    const pulse = this.pending; this.pending = undefined;
    if (this.scale <= 0 || !actuator?.playEffect) return undefined;
    const live = now < this.playing.until, left = live ? this.playing.until - now : 0;
    if (live && pulse.strong <= this.playing.strong && pulse.weak <= this.playing.weak && !pulse.urgent) return undefined;
    const effect = {
      strong: Math.max(pulse.strong, live ? this.playing.strong : 0),
      weak: Math.max(pulse.weak, live ? this.playing.weak : 0),
      ms: Math.max(pulse.ms, left),
    };
    this.sentAt = now; this.playing = { until: now + effect.ms, strong: effect.strong, weak: effect.weak };
    void actuator.playEffect('dual-rumble', {
      startDelay: 0, duration: Math.round(effect.ms), strongMagnitude: clamp(effect.strong * this.scale), weakMagnitude: clamp(effect.weak * this.scale),
    })?.catch?.(() => {});
    return effect;
  }

  /** Silences the pad, for a blur, a pause or a disconnect. */
  stop(actuator?: Actuator) {
    this.pending = undefined; this.later.length = 0;
    if (this.playing.until > -Infinity) void actuator?.reset?.()?.catch?.(() => {});
    this.playing = { until: -Infinity, strong: 0, weak: 0 };
  }
}
