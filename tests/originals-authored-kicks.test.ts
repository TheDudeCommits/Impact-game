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
  it('name shown originals and clips in their body or rush file', () => {
    const entries = Object.entries(ORIGINAL_AUTHORED_KICKS);
    expect(entries.length).toBeGreaterThan(0);
    for (const [slot, clips] of entries) {
      const original = (ORIGINALS as Record<string, { model?: string; rushModel?: string; extraModels?: string[] }>)[slot];
      expect(original, `${slot} is an original`).toBeDefined();
      expect((clipsJson as Record<string, unknown>)[slot], `${slot} has a clip map`).toBeDefined();
      const files = [original.model, original.rushModel, ...(original.extraModels ?? [])].filter((f): f is string => !!f);
      const carried = new Set(files.flatMap(names));
      for (const clip of clips) expect(carried.has(clip), `${slot}: ${clip} in ${files.join(', ')}`).toBe(true);
    }
  });

  it('match only the clip named, on its own slot', () => {
    expect(originalAuthoredKick('setsu', 'Rush 2')).toBe(true);
    expect(originalAuthoredKick('setsu', 'Rush 1')).toBe(false);
    expect(originalAuthoredKick('strix', 'Rush 2')).toBe(false);
    expect(originalAuthoredKick('setsu', undefined)).toBe(false);
  });
});
