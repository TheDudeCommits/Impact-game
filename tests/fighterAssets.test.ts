import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import { fighterAssetPaths } from '../scripts/fighterAssets';

describe('the package ships every file a fighter names', () => {
  it('finds the files under fields the packager never listed', () => {
    const gummy = fighterAssetPaths(FIGHTERS.gummy);
    for (const url of [...FIGHTERS.gummy.formExtraModels ?? [], FIGHTERS.gummy.openHandsModel ?? ''].filter(Boolean)) expect(gummy).toContain(url.slice(1));
    expect(gummy).toContain(FIGHTERS.gummy.model.slice(1));
    expect(gummy).toContain(FIGHTERS.gummy.portrait.slice(1));
  });
});
