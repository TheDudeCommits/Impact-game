import type { CombatEvent } from '../game/types';

/** One burst of the pad's two motors: the heavy low one and the light high
 *  one, each 0-1, for so many milliseconds. */
export interface Pulse { strong: number; weak: number; ms: number }

const clamp = (value: number) => Math.max(0, Math.min(1, value));

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
      if (slot === 'ultimate') return { strong: .6, weak: .75 + extra, ms: 130 };
      if (slot === 'special') return { strong: .35, weak: .45 + extra, ms: 90 };
      if (slot === 'heavy') return { strong: .25, weak: .4 + extra, ms: 70 };
      return { strong: 0, weak: .22 + extra, ms: 40 };
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

  add(pulse: Pulse) {
    const p = this.pending;
    this.pending = p ? { strong: Math.max(p.strong, pulse.strong), weak: Math.max(p.weak, pulse.weak), ms: Math.max(p.ms, pulse.ms) } : { ...pulse };
  }

  /** Sends what has gathered, if the window allows. Returns the effect sent. */
  flush(now: number, actuator?: Actuator): Pulse | undefined {
    if (!this.pending || now - this.sentAt < Rumble.WINDOW) return undefined;
    const pulse = this.pending; this.pending = undefined;
    if (this.scale <= 0 || !actuator?.playEffect) return undefined;
    const live = now < this.playing.until, left = live ? this.playing.until - now : 0;
    if (live && pulse.strong <= this.playing.strong && pulse.weak <= this.playing.weak) return undefined;
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
    this.pending = undefined;
    if (this.playing.until > -Infinity) void actuator?.reset?.()?.catch?.(() => {});
    this.playing = { until: -Infinity, strong: 0, weak: 0 };
  }
}
