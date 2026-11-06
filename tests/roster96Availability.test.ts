import { describe, expect, it, vi } from 'vitest';
import { RELEASED_FIGHTERS, LABORATORY_FIGHTERS, isLaboratoryFighter, isReleasedFighter } from '../src/game/rosterAvailability';
import { mayPlay } from '../src/game/economy/fighters';
import { ownKit, forgeProblems } from '../src/engine/sim/forge';
import { libraryMoves } from '../src/ui/forge/studioLibrary';
import { HOME_ROSTER } from '../src/ui/MangaHome';
import { OWN_ENTRANCES } from '../src/game/powerUp';
import { AWAKENINGS } from '../src/game/awakening';
import { RUSH, MOVES } from '../src/game/moves';
import { comboMove } from '../src/game/combos';
import { fighterShown } from '../src/originals/launch';

const additions = ['tsubute', 'aqrab', 'chohan'] as const;
describe('roster96 admission', () => {
  it.each(additions)('%s is available through the normal game and homepage', id => {
    expect(LABORATORY_FIGHTERS).not.toContain(id);
    expect(isLaboratoryFighter(id)).toBe(false);
    expect(RELEASED_FIGHTERS).toContain(id);
    expect(isReleasedFighter(id)).toBe(true);
    // Sold since 28 October 2026 (every fighter past the first sixteen): played once owned.
    expect(mayPlay(id, { items: { [`fighter-${id}`]: { at: 0 } } })).toBe(fighterShown(id));
    expect(mayPlay(id, undefined)).toBe(false);
    expect((HOME_ROSTER as readonly string[]).includes(id)).toBe(fighterShown(id));
  });
  it('explicit laboratory Forge allows additions', async () => {
    vi.stubEnv('MODE', 'fighter-lab');
    try {
      for (const source of additions) {
        expect(libraryMoves('taisei').some(row => row.id === source)).toBe(fighterShown(source));
        expect(forgeProblems(ownKit(source), { sandbox: true, availability: 'laboratory' }).errors).toEqual([]);
      }
    } finally { vi.unstubAllEnvs(); }
  });
  it('keeps Chohan physical entry with no shared energy aura or flame shell', () => {
    expect(OWN_ENTRANCES.has('chohan')).toBe(true);
    expect(AWAKENINGS.chohan.auraGlow).toBe(0);
    expect(AWAKENINGS.chohan.flames).toBe(false);
    expect(AWAKENINGS.chohan.kind).toBe('aura');
  });
  it('keeps Tsubute native rush and ender releases ranged, with no lunge', () => {
    expect(MOVES.tsubute.light.style).toBe('projectile');
    for (const move of RUSH.tsubute) {
      expect(move.style).toBe('projectile');
      expect(move.lunge).toBe(0);
      expect(move.speed).toBeGreaterThan(0);
      expect(move.contacts).toHaveLength(1);
    }
    for (const branch of ['lh', 'llh', 'lllh', 'llls', 'airHeavy'] as const) {
      expect(comboMove('tsubute', branch)?.style).toBe('projectile');
      expect(comboMove('tsubute', branch)?.lunge).toBe(0);
    }
  });
});
