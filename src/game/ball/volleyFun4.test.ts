import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { SPIKE_RULES } from './model';
import { VOLLEY_BOT } from './volleyBrain';

// On the volleyball rules every point counts one and nothing says FEVER; the person's side keeps its shape (no two of
// it on one spot unless both play the ball). Nothing here reaches a classic match.

/** A match of bots with a piloted person ('me', red) for `seconds`, each step handed to `look`. */
function play(volleyball: boolean, seconds: number, look: (m: BallMatch) => void, seed = 11) {
  const m = new BallMatch('sky-spike', { seed, access: 'bots', replays: false, volleyball, difficulty: 'normal' });
  m.add('me', 'konta', 'Me', false, 'red');
  expect(m.start()).toBe(true);
  m.pilot('me');
  for (let i = 0; i < Math.round(seconds * 60) && m.view.phase !== 'over'; i++) { m.step(1 / 60); look(m); }
  return m;
}

describe('no FEVER on the volleyball rules', () => {
  it('never turns FEVER on, never says it, never counts a point two - however long the rally', () => {
    let fever = false, said = false, jump = 0;
    const seen = new Set<number>();
    play(true, 200, m => {
      // (Every rally long enough for FEVER on the classic rules: the count pushed past it.)
      if (m.view.phase === 'live' && m.view.rally < SPIKE_RULES.fever + 1) m.view.rally = SPIKE_RULES.fever + 1;
      fever ||= m.view.fever;
      for (const e of m.view.events) { if (seen.has(e.id)) continue; seen.add(e.id); if (e.kind === 'fever' || /FEVER/.test(e.text ?? '')) said = true; if ((e.value ?? 1) > 1 && (e.kind === 'kill' || e.kind === 'ace' || e.kind === 'point')) jump++; }
    });
    expect(fever).toBe(false); expect(said).toBe(false); expect(jump).toBe(0);
  }, 40000);
  it('keeps the classic rules\' FEVER rally', () => {
    let fever = false;
    play(false, 120, m => { if (m.view.phase === 'live' && m.view.rally < SPIKE_RULES.fever) m.view.rally = SPIKE_RULES.fever - 1; fever ||= m.view.fever; });
    expect(fever).toBe(true);
  }, 40000);
});

describe('the person\'s side keeps its shape', () => {
  it('has no two bots of a side within two metres of each other unless one is on the ball, nearly all the time', () => {
    let live = 0, bunched = 0;
    play(true, 150, m => {
      if (m.view.phase !== 'live') return;
      live++;
      const v = m.volley!, b = m.ball;
      for (const team of ['red', 'blue'] as const) {
        const bots = [...m.seats.values()].filter(s => s.team === team && s.bot && s.id !== v.owner).map(s => m.sim.actors.get(s.id)!.state);
        // (A bot on the ball, or going up to block - at the net as the other side attacks - plays it.)
        const block = v.plan?.team !== team && v.plan?.touch === SPIKE_RULES.touches;
        const free = bots.filter(p => p.grounded && Math.hypot(p.x - b.x, p.z - b.z) > 2.5 && !(block && Math.abs(p.z) < 1.6));
        for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) if (Math.hypot(free[i].x - free[j].x, free[i].z - free[j].z) < 2) bunched++;
      }
    });
    expect(live).toBeGreaterThan(60 * 40);
    // (Unspaced bots: 6% of the match, half of it two rivals on one spot for one block.)
    expect(bunched / live).toBeLessThan(.03);
    expect(VOLLEY_BOT.spacing.apart).toBeGreaterThanOrEqual(2.4);
  }, 40000);
});
