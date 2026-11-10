import { describe, expect, it } from 'vitest';
import { BallHints, HINT_GAP_MS, HINT_MS, HINTS, HINTS_A_MATCH, type BallHintId, type HintFrame } from './ballHints';
import type { BallView } from '../../game/ball/model';
import { freshBall } from '../../game/ball/physics';
import type { PlayerState } from '../../game/types';

/** A Goal Rush or Sky Spike match a little way in: 'me' on red with a team-mate, two of blue. */
function frame(over: { view?: Partial<BallView>; ball?: Partial<BallView['ball']>; me?: Partial<PlayerState>; players?: readonly Partial<PlayerState>[]; fight?: boolean; device?: HintFrame['device']; serverTime?: number } = {}): HintFrame {
  const view = {
    kind: 'ball', mode: 'goal-rush', phase: 'live', practice: false, replay: null, startedAt: 0, events: [], touches: 0, touchTeam: null,
    seats: [{ id: 'me', team: 'red' }, { id: 'mate', team: 'red' }, { id: 'foe', team: 'blue' }, { id: 'foe2', team: 'blue' }],
    ...over.view,
    ball: { ...freshBall(), x: 0, y: .8, z: 0, vx: 0, vy: 0, vz: 0, lastId: null, lastTeam: null, shot: null, ...over.ball },
  } as unknown as BallView;
  const me = { id: 'me', alive: true, x: 0, y: 0, z: -6, grounded: true, stamina: 100, maxStamina: 100, ...over.me } as PlayerState;
  const players = [me, ...(over.players ?? [{ id: 'mate', x: -6, z: -12 }, { id: 'foe', x: 0, z: 1 }, { id: 'foe2', x: 8, z: 10 }]).map(p => ({ alive: true, y: 0, grounded: true, ...p }) as PlayerState)];
  return { view, self: me, players, fight: !!over.fight, device: over.device ?? 'keyboard', family: 'generic', serverTime: over.serverTime ?? 20 };
}
/** A device's memory of its own (prefs.ts's, in the tests). */
function hints(busy = false, on = true) {
  const shown: string[] = [];
  return { shown, h: new BallHints(() => busy, () => shown, id => { shown.push(id); }, () => on) };
}
const fires = (id: BallHintId, f: HintFrame) => HINTS.find(h => h.id === id)!.fire({ ...f, seat: f.view.seats[0], team: 'red', ball: f.view.ball, me: f.self, at: (id: string) => f.players.find(p => p.id === id), since: f.fight ? 2 : 0, mine: () => false } as never);

describe('the ball modes\' first-time hints (ui/ball/ballHints.ts)', () => {
  it('Goal Rush: TO TACKLE when an opponent has the ball near you in the BALL stance, its key the device\'s own', () => {
    const f = frame({ ball: { x: 0, z: 2 } });
    expect(fires('gr-tackle', f)).toBe(true);
    expect(fires('gr-tackle', frame({ ball: { x: 0, z: 2 }, fight: true }))).toBe(false);
    // Too far from you, or the ball nowhere near them: no.
    expect(fires('gr-tackle', frame({ ball: { x: 0, z: 2 }, players: [{ id: 'foe', x: 0, z: 12 }] }))).toBe(false);
    expect(fires('gr-tackle', frame({ ball: { x: 9, z: 9 }, players: [{ id: 'foe', x: 0, z: 1 }] }))).toBe(false);
    // FREE PLAY has no stances.
    expect(fires('gr-tackle', frame({ view: { practice: true }, ball: { x: 0, z: 2 } }))).toBe(false);
    const { h } = hints();
    expect(h.frame(f, 1000)).toMatch(/<kbd>Tab<\/kbd><b>FIGHT TO TACKLE<\/b>/);
    const touch = hints().h.frame(frame({ ball: { x: 0, z: 2 }, device: 'touch' }), 1000);
    expect(touch).toContain('<b>TO TACKLE</b>');
  });
  it('Sky Spike: the PERFECT SPIKE\'s timing when a team-mate\'s set comes down to you', () => {
    const set = { view: { mode: 'sky-spike' }, ball: { x: 0, y: 3, z: -5, vx: 0, vy: 6, vz: 2.4, shot: 'set', lastTeam: 'red', lastId: 'mate' }, me: { z: -2.5 }, players: [{ id: 'mate', x: -4, z: -8 }, { id: 'foe', x: 0, z: 4 }, { id: 'foe2', x: 3, z: 8 }] } as const;
    expect(fires('ss-spike', frame(set))).toBe(true);
    // Your own set, the other side's, or a team-mate nearer where it comes down: no.
    expect(fires('ss-spike', frame({ ...set, ball: { ...set.ball, lastId: 'me' } }))).toBe(false);
    expect(fires('ss-spike', frame({ ...set, ball: { ...set.ball, lastTeam: 'blue' } }))).toBe(false);
    expect(fires('ss-spike', frame({ ...set, players: [{ id: 'mate', x: 0, z: -3 }] }))).toBe(false);
    const html = hints().h.frame(frame({ ...set, device: 'touch' }), 1000);
    expect(html).toContain('<kbd class="touch-key">JUMP</kbd><b>AS IT PEAKS</b><kbd class="touch-key">SPIKE</kbd><b>AT THE TOP</b>');
    // Their set: BLOCK at the net, DIVE in the back court.
    const theirs = { view: { mode: 'sky-spike' }, ball: { x: 0, y: 3, z: 3, vy: 6, shot: 'set', lastTeam: 'blue', lastId: 'foe' } } as const;
    expect(fires('ss-block', frame({ ...theirs, me: { z: -1.5 } }))).toBe(true);
    expect(fires('ss-dig', frame({ ...theirs, me: { z: -1.5 } }))).toBe(false);
    expect(fires('ss-dig', frame({ ...theirs, me: { z: -7 } }))).toBe(true);
  });
  it('shows each once per device, one at a time, for a few seconds or until it is done', () => {
    const { h, shown } = hints(), f = frame({ ball: { x: 0, z: 2 } });
    expect(h.frame(f, 1000)).not.toBe('');
    expect(shown).toEqual(['gr-tackle']);
    expect(h.frame(f, 2000)).toContain('TACKLE');
    // Done: the FIGHT stance taken.
    expect(h.frame(frame({ ball: { x: 0, z: 2 }, fight: true }), 2500)).toBe('');
    // Never again on this device, even in a new match.
    const again = frame({ ball: { x: 0, z: 2 }, view: { startedAt: 100 }, serverTime: 130 });
    expect(h.frame(again, 90_000)).not.toContain('TACKLE');
    // Unfinished, it goes after HINT_MS.
    const late = hints(), g = frame({ ball: { x: 0, z: 2 } });
    late.h.frame(g, 1000); expect(late.h.frame(g, 1000 + HINT_MS - 1)).not.toBe(''); expect(late.h.frame(g, 1000 + HINT_MS + 1)).toBe('');
  });
  it('keeps them rare: a long breath between two, a few a match, none in the first seconds, none over the coach, none with the coach off', () => {
    const { h } = hints();
    h.frame(frame({ ball: { x: 0, z: 2 } }), 1000);
    h.frame(frame({ ball: { x: 0, z: 2 }, fight: true }), 1100);
    // The BOOST hint's moment (a long run on a full bar), too soon after: nothing.
    const run = frame({ ball: { x: 0, z: 14 }, players: [{ id: 'foe', x: 9, z: 12 }] });
    expect(h.frame(run, 1100 + HINT_GAP_MS - 10)).toBe('');
    expect(h.frame(run, 1100 + HINT_GAP_MS + 10)).toContain('BOOST');
    expect(HINTS_A_MATCH).toBeLessThanOrEqual(3);
    expect(hints().h.frame(frame({ ball: { x: 0, z: 2 }, serverTime: 2 }), 1000)).toBe('');
    expect(hints(true).h.frame(frame({ ball: { x: 0, z: 2 } }), 1000)).toBe('');
    expect(hints(false, false).h.frame(frame({ ball: { x: 0, z: 2 } }), 1000)).toBe('');
    // Never in FREE PLAY, a replay, a stoppage, or while wiped out.
    for (const view of [{ practice: true }, { phase: 'scored' }, { replay: {} }] as Partial<BallView>[]) expect(hints().h.frame(frame({ view, ball: { x: 0, z: 2 } }), 1000)).toBe('');
  });
  it('leaves the keeper\'s SAVE off a touch screen, whose set has no guard', () => {
    const shot = { ball: { x: 0, z: -12, vz: -20, lastTeam: 'blue' }, me: { z: -18 }, players: [{ id: 'mate', x: 8, z: -2 }, { id: 'foe', x: 0, z: -4 }] } as const;
    expect(fires('gr-save', frame(shot))).toBe(true);
    expect(hints().h.frame(frame(shot), 1000)).toContain('SAVE');
    expect(hints().h.frame(frame({ ...shot, device: 'touch' }), 1000)).not.toContain('SAVE');
  });
  it('SCUFFED the moment your own strike came out of a flurry of presses (BallMatch MASHED), once', () => {
    const { h, shown } = hints(), f = frame({ ball: { x: 9, z: 9 }, me: { stamina: 10 }, players: [{ id: 'foe', x: 0, z: 14 }], serverTime: 20 });
    expect(h.frame(f, 1000)).toBe('');
    // Someone else's scuff, or a clean strike of yours: nothing.
    h.event({ id: 1, at: 20, kind: 'strike', actorId: 'foe', text: 'SCUFFED', x: 0, y: 0, z: 0 } as never, 'me');
    h.event({ id: 2, at: 20, kind: 'strike', actorId: 'me', text: 'PERFECT STRIKE', x: 0, y: 0, z: 0 } as never, 'me');
    expect(h.frame(f, 1100)).toBe('');
    h.event({ id: 3, at: 20, kind: 'strike', actorId: 'me', text: 'SCUFFED', x: 0, y: 0, z: 0 } as never, 'me');
    expect(h.frame(f, 1200)).toContain('<b>SCUFFED</b>');
    expect(shown).toEqual(['gr-scuff']);
    // Sky Spike's own, once a moment has passed it is gone.
    const s = hints(), spike = frame({ view: { mode: 'sky-spike' }, ball: { x: 0, z: 6 }, me: { stamina: 10 }, serverTime: 30 });
    expect(s.h.frame(spike, 900)).toBe('');
    s.h.event({ id: 4, at: 30, kind: 'strike', actorId: 'me', text: 'SCUFFED', x: 0, y: 0, z: 0 } as never, 'me');
    expect(s.h.frame(spike, 1000)).toContain('ONE PRESS, ON TIME');
    expect(s.shown).toEqual(['ss-scuff']);
    const late = hints();
    late.h.frame(spike, 900);
    late.h.event({ id: 5, at: 30, kind: 'strike', actorId: 'me', text: 'SCUFFED', x: 0, y: 0, z: 0 } as never, 'me');
    expect(late.h.frame({ ...spike, serverTime: 33 }, 1000)).toBe('');
  });
});
