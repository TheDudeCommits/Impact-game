import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import clipsJson from '../src/engine/client/clips.json';
import { ORIGINALS } from '../src/originals/roster';
import { ORIGINAL_AUTHORED_KICKS, originalAuthoredKick } from '../src/originals/authoredKicks';

const names = (url: string) => {
  const raw = fs.readFileSync(`public${url}`), length = raw.readUInt32LE(12);
  return (JSON.parse(raw.subarray(20, 20 + length).toString()).animations ?? []).map((a: { name: string }) => a.name) as string[];
};

describe('the originals\' authored kicks', () => {

  it('match only the clip named, on its own slot', () => {
    expect(originalAuthoredKick('setsu', 'Rush 2')).toBe(true);
    expect(originalAuthoredKick('setsu', 'Rush 1')).toBe(false);
    expect(originalAuthoredKick('strix', 'Rush 2')).toBe(false);
    expect(originalAuthoredKick('setsu', undefined)).toBe(false);
  });
});
