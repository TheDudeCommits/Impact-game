import type { Plugin } from 'vite';
import { gateFighterManifest } from '../../src/originals/launch.ts';

/** The per-fighter manifests the client imports from public/. */
export const BUNDLED_MANIFESTS = [/[\\/]public[\\/]assets[\\/]home[\\/]sprites[\\/]manifest\.json$/];

/** A manifest's text as the client bundles it, or null where it holds no hidden fighter's entry. */
export function gatedManifestText(text: string): string | null {
  let manifest: unknown;
  try { manifest = JSON.parse(text); } catch { return null; }
  const gated = gateFighterManifest(manifest);
  return gated === manifest ? null : JSON.stringify(gated);
}

export const PROSE_FILES = { houseKits: /[\\/]src[\\/]engine[\\/]sim[\\/]houseKits\.json$/, signatures: /[\\/]src[\\/]audio[\\/]sfxSignatures\.ts$/ };
/** houseKits.json's text without its `why` notes, or null where it has none. */
export function strippedHouseKits(text: string): string | null {
  let kits: unknown;
  try { kits = JSON.parse(text); } catch { return null; }
  let changed = false;
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== 'object') return value;
    const out: Record<string, unknown> = {};
    for (const [key, each] of Object.entries(value)) { if (key === 'why' && typeof each === 'string') { changed = true; continue; } out[key] = strip(each); }
    return out;
  };
  const stripped = strip(kits);
  return changed ? JSON.stringify(stripped) : null;
}
/** sfxSignatures.ts's source with every description emptied (a row's `what`, and the shared descriptions it names), or null
 *  where there is none. */
export function strippedSignatures(code: string): string | null {
  const literal = "'(?:[^'\\\\\\n]|\\\\.)*'";
  const out = code.replace(new RegExp(`(\\bwhat:\\s*)${literal}`, 'g'), "$1''").replace(new RegExp(`(\\bconst [A-Z_]+ = )${literal}(;)`, 'g'), "$1''$2");
  return out === code ? null : out;
}

export default function originalsLaunch(): Plugin {
  return {
    name: 'originals-launch',
    // The build and the dev server; not the tests, which read the manifests as the repo has them (each team's test
    // checks its own entry's hashes, shown or not yet).
    apply: (_config, { command }) => command === 'build' || !process.env.VITEST,
    // Before Vite's JSON plugin turns the file into a module: this sees, and returns, the JSON itself.
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?', 1)[0];
      if (PROSE_FILES.houseKits.test(file)) { const text = strippedHouseKits(code); return text === null ? null : { code: text, map: null }; }
      if (PROSE_FILES.signatures.test(file)) { const text = strippedSignatures(code); return text === null ? null : { code: text, map: null }; }
      if (!BUNDLED_MANIFESTS.some(pattern => pattern.test(file))) return null;
      const gated = gatedManifestText(code);
      return gated === null ? null : { code: gated, map: null };
    },
  };
}
