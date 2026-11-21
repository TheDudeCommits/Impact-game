import { describe, expect, it } from 'vitest';
import { pulseFor, Rumble } from '../src/input/rumble';
import { GAP, TouchHaptics } from '../src/input/haptics';
import { LOCK_ESCAPE_WINDOW } from '../src/game/lockCombat';
import type { CombatEvent } from '../src/game/types';

/** the escape's moments in the hands - on a pad, and on a phone's own buzz (input/haptics.ts,
 *  Android) through the same events. The lock gap's tick is the one that matters: the cue to press GUARD. */
const event = (kind: CombatEvent['kind'], more: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind, actorId: 'them', targetId: 'me', serverTime: 10, ...more });

describe('the escape felt', () => {
  it('the lock gap ticks on the defender as its window opens, and cuts through what is still playing', () => {
    // The round's last blow froze the body 0.09 s: the window opens as the freeze lets go.
    const gap = pulseFor(event('lock-gap', { due: 10.09 + LOCK_ESCAPE_WINDOW }), 'me')!;
    expect(gap.delay).toBeCloseTo(90, 5); expect(gap.urgent).toBe(true);
    expect(gap.weak).toBeGreaterThan(gap.strong);
    // Not on the attacker, and not when a press made during the round shut it.
    expect(pulseFor(event('lock-gap', { due: 10.3 }), 'them')).toBeUndefined();
    expect(pulseFor(event('lock-gap', { due: 10.3, reason: 'early' }), 'me')).toBeUndefined();
  });
  it('a vanish, a failed escape, a break and a counter stance each have their own', () => {
    const vanish = pulseFor(event('vanish', { actorId: 'me', targetId: 'them' }), 'me')!, failed = pulseFor(event('lock-escape', { actorId: 'me', targetId: 'them', reason: 'late' }), 'me')!;
    const broke = pulseFor(event('break', { actorId: 'me', targetId: 'them' }), 'me')!, broken = pulseFor(event('break'), 'me')!;
    const counter = pulseFor(event('counter', { actorId: 'me', targetId: 'them' }), 'me')!;
    for (const pulse of [vanish, failed, broke, broken, counter]) expect(pulse.ms).toBeGreaterThan(0);
    expect(failed.weak, 'a failed try is a dull bump').toBe(0);
    expect(broke.strong).toBeGreaterThan(broken.strong);
    expect(new Set([vanish, failed, broke, counter].map(p => `${p.strong}/${p.weak}/${p.ms}`)).size).toBe(4);
    // A clean escape's vanish is felt through its 'vanish'; its 'lock-escape' adds nothing over it.
    expect(pulseFor(event('lock-escape', { actorId: 'me', targetId: 'them' }), 'me')).toBeUndefined();
  });
  it('the pad holds a delayed pulse until it is due, then sends it through a blow still shaking', () => {
    const sent: { duration: number; weakMagnitude: number }[] = [];
    const actuator = { playEffect: (_type: string, params: { duration: number; weakMagnitude: number }) => { sent.push(params); return Promise.resolve(); } };
    const rumble = new Rumble();
    rumble.add({ strong: .5, weak: .5, ms: 200 }, 1000); rumble.flush(1000, actuator);
    rumble.add({ strong: .12, weak: .85, ms: 55, urgent: true, delay: 90 }, 1000);
    expect(rumble.flush(1050, actuator)).toBeUndefined();
    expect(rumble.flush(1092, actuator)?.weak).toBeCloseTo(.85, 5);
    expect(sent).toHaveLength(2);
  });
  it('the phone buzzes the gap\'s tick when it is due, through a blow\'s buzz and its gap', () => {
    const buzzed: number[] = [], haptics = new TouchHaptics(ms => { buzzed.push(ms); return true; });
    haptics.add({ strong: .4, weak: .5, ms: 120 }, 1000); const first = haptics.flush(1000);
    haptics.add({ strong: .12, weak: .85, ms: 55, urgent: true, delay: 90 }, 1000);
    expect(haptics.flush(1050)).toBe(0);
    expect(1092 < 1000 + first + GAP).toBe(true);
    expect(haptics.flush(1092)).toBeGreaterThan(0);
    expect(buzzed).toHaveLength(2);
  });
});
