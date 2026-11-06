import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GRUNTS } from '../src/survival/horde/kinds';
import { ENEMIES } from '../src/survival/enemies';

/** The clips a motion library holds, by name (public/assets/survival/motion/<library>.json). */
const clipsOf = (library: string) => new Set((JSON.parse(readFileSync(new URL(`../public/assets/survival/motion/${library}.json`, import.meta.url), 'utf8')) as { clips: { name: string }[] }).clips.map(clip => clip.name));

describe('the horde and its bosses play clips that exist', () => {
  const horde = clipsOf('humanoid'), boss = clipsOf('humanoid-boss');

  it('every grunt move names a clip of the horde library (a missing one would stand idle)', () => {
    const missing = GRUNTS.flatMap(kind => kind.moves.filter(move => !horde.has(move.clip)).map(move => `${kind.id}: ${move.name} (${move.clip})`));
    expect(missing).toEqual([]);
  });

  it("the grunt renderer's own clips are there: the gaits, the reactions, a throw and the deaths", () => {
    for (const name of ['idle', 'walk', 'run', 'hit', 'knockdown', 'getup', 'die', 'roar2', 'run-charge', 'launched', 'die-blown', 'die-fall']) expect(horde.has(name), name).toBe(true);
  });

  it("a boss on the horde's skeleton finds every move's clip, and its idle, in the two libraries", () => {
    const has = (name: string) => horde.has(name) || boss.has(name);
    const humanoid = Object.values(ENEMIES).filter(def => def.motion === 'humanoid');
    for (const def of humanoid) expect(['vesper', 'imago', 'magatsu'].includes(def.id) || def.model.startsWith('/assets/survival/motion/grunt-'), def.id).toBe(true);
    const missing = humanoid.flatMap(def => [...def.moves.map(move => move.clip[0]), def.clips.idle[0]].filter(name => !has(name)).map(name => `${def.id}: ${name}`));
    expect(missing).toEqual([]);
  });

  it('the clips only bosses play stay out of the horde library, which every grunt kind bakes', () => {
    for (const name of boss) expect(horde.has(name), name).toBe(false);
  });
});
