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
  'konta-form': { run: .0992, shared: false },
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
