import { describe, expect, it } from 'vitest';
import locomotion from '../src/game/data/locomotion.json';

type Row = { step: number; steps: number; duration: number; phase?: number };
const ROWS = locomotion as unknown as Record<string, Partial<Record<'run' | 'walk' | 'dash', Row>>>;

/** Slot -> the run step that lands on Impact's cadence on the original's body; `shared`: its walk is on the run's clock. */
const SPRINTS: Record<string, { run: number; shared: boolean }> = {
  tobari: { run: .2222, shared: true },   // Tobari: 4.00 steps a second against Impact's 4.25 (was 3.25)
  jirenga: { run: .2222, shared: true },    // Jirenga: 3.50 against 3.50 (was 2.50)
  levin: { run: .2222, shared: true },     // Levin (was Kirigane): 4.75 against 5.00 (was 3.75)
  akagane: { run: .2222, shared: true },
  konta: { run: .2, shared: false },     // Konta: 5.00 against 5.00 (was 3.75)
  setsu: { run: .2667, shared: false },  // Setsu: 5.75 against 6.00 (was 4.75)
  // Shiden: 4.00 against 5.75 (was 3.50). His run plants long: faster, its slide passes footContact.test.ts's half.
  shiden: { run: .2, shared: false },
  'gaunt-form': { run: .2222, shared: false },
  'nigo-form': { run: .141, shared: false },
  // (fixes-hawser-fox, 8 November 2026) Homura's run is no longer the leap its Dash is (that row read 8.4 steps off it and
  // the cadence's floor played it at a walk): it is an authored trot with a four-beat walk on its clock, two hind footfalls
  // a cycle, each step carrying the body the renderer's stride (scripts/originals/clips/author_fox.py GAITS), so its legs
  // keep pace with its travel at any speed: 4.45 steps a second at the form's full 8.6 m/s.
  'konta-form': { run: .4167, shared: true },
  // Kuzu's run is a clean sprint: three steps a cycle, as Kuon's and Jirenga's clean sprints, 4.0-4.3 steps a second at
  // 7.5 m/s; its planted foot slides 0.33-0.42 of travel there, 0.16-0.19 at 4.5 m/s and 0.07 at 2.4. With no row (two
  // steps a cycle) it slid 0.43 and, where the walk mixes in at 4.5 m/s, 0.50. His walk keeps no row (not on the run's clock).
  // At his own stride, 1.15 times the roster's (Fighter.ts STRIDE_SCALE), it slides 0.36-0.37 at 7.5 m/s on this row.
  kuzu: { run: .1667, shared: false },
};

describe('the originals\' sprint keeps Impact\'s cadence', () => {
  for (const [slot, want] of Object.entries(SPRINTS)) {
    it(`${slot}: its run row plays the legs at Impact's pace`, () => {
      const run = ROWS[slot]?.run, walk = ROWS[slot]?.walk;
      expect(run, `${slot} has a run row`).toBeDefined();
      expect(run!.step, `${slot} run step`).toBeCloseTo(want.run, 3);
      expect(run!.steps * run!.step, `${slot} run row's steps cover its clip`).toBeCloseTo(run!.duration, 1);
      if (want.shared) {
        expect(walk, `${slot} has a walk row`).toBeDefined();
        expect(walk!.step / walk!.duration, `${slot} walk on the run's clock`).toBeCloseTo(run!.step / run!.duration, 3);
        expect(walk!.phase, `${slot} walk phase measured`).toBeDefined();
      }
    });
  }
});
