import type { FighterDefinition } from '../src/config';

export function fighterAssetPaths(fighter: FighterDefinition) {
  const found = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === 'string') { if (value.startsWith('/assets/')) found.add(value.slice(1)); }
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(fighter);
  return [...found];
}
