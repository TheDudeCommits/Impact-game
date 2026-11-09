import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** What a first visit's page imports before it can draw the home screen: every module main.ts reaches by static imports (an
 *  `import(...)` is a chunk of its own, fetched when it is asked for). Read from the sources as the bundler reads them:
 *  `import ... from`, `import '...'` and `export ... from`, not `import type`. */
function staticClosure(entry: string) {
  const seen = new Set<string>(), queue = [path.resolve(entry)];
  const resolve = (from: string, spec: string) => {
    if (!spec.startsWith('.')) return spec;
    const base = path.resolve(path.dirname(from), spec);
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, path.join(base, 'index.ts')]) if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    return base;
  };
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.(ts|tsx|js|mjs)$/.test(file) || !fs.existsSync(file)) continue;
    const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    for (const m of code.matchAll(/(?:^|[;\n])\s*(import|export)\s+(type\s+)?(?:[\w${},*\s]+?\s+from\s+)?['"]([^'"]+)['"]/g)) {
      if (m[2]) continue;
      queue.push(resolve(file, m[3]));
    }
  }
  return seen;
}

describe('the first visit downloads only what the home screen needs', () => {
  const closure = [...staticClosure('src/main.ts')].map(f => path.relative(process.cwd(), f));

  it('finds the page and the fighter code it does need (the walk works)', () => {
    expect(closure).toContain('src/render/Fighter.ts');
    expect(closure).toContain('three');
  });

  it('leaves Rapier out of it', () => {
    expect(closure.filter(f => /rapier3d|game[\\/]rapierCollision/.test(f))).toEqual([]);
  });

  // The fighters' own effects modules that RosterSignatureSet loads as a room has them (its `lazy` entries): imported anywhere
  // else, one is back in every first visit (the sweep took twenty-nine out, about 700 KB before minifying).
  it("leaves the fighters' own effects modules to the rooms that have them", () => {
    const set = fs.readFileSync('src/render/signature/RosterSignatureSet.ts', 'utf8');
    const lazy = [...set.matchAll(/lazy\(\(\) => import\('([^']+)'\)/g)].map(m => path.relative(process.cwd(), path.resolve('src/render/signature', m[1])) + '.ts');
    expect(lazy.length).toBeGreaterThanOrEqual(29);
    expect(lazy.filter(file => closure.includes(file))).toEqual([]);
  });

  // The twenty-two RosterSignatureSet still imported (Fighter.ts and its sockets asked them for a
  // point: those are their <Module>Contact.ts now), the old cast's own effects (render/castEffects.ts, made when a room asks or at
  // idle on the home) and CombatEffects' own six layers (lazyLayer): about a third of what main.ts reached before.
  it("leaves the old cast's effects, the twenty-two roster layers and CombatEffects' six to the rooms that have them", () => {
    expect(fs.readFileSync('src/render/signature/RosterSignatureSet.ts', 'utf8').match(/lazy\(\(\) => import\('/g)?.length).toBeGreaterThanOrEqual(51);
    const away = ['render/castEffects', 'render/GummyEffects', 'render/NinjaEffects', 'render/SwordSpiritEffects', 'render/SetsuEffects', 'render/WardEffects',
      'render/EmperorEffects', 'render/KuonEffects', 'render/GauntEffects', 'render/signature/LastSun', 'originals/emperorFinales',
      ...['FullBeamPressure', 'PyroclastExplosions', 'AmpereSurge', 'KuzuChainsaw', 'ShakugoMagma', 'RoseEmpress', 'TorsionPsychic', 'BonshoBodhisattva', 'StrappadoStrings',
        'ChohanAllIn', 'KinuStoneThread', 'BunaOni', 'TempoDarkSpark'].map(id => `render/signature/${id}`)].map(file => `src/${file}.ts`);
    for (const file of away) expect(fs.existsSync(file), file).toBe(true);
    expect(away.filter(file => closure.includes(file))).toEqual([]);
    // (What the engine asks of them where a blow lands stays in: their contact modules.)
    expect(closure).toContain('src/render/signature/TorsionPsychicContact.ts');
    expect(closure).toContain('src/render/signature/RoseEmpressContact.ts');
  });
});
