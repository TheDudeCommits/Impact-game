import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GENERIC_SUPER, SIGNATURE_FIGHTERS, SIGNATURE_SHOTS } from '../../game/ball/superShots';
import { SHOT_NAMES, SHOT_NAMES_SIZE, SHOT_NAMES_URL, shotNameRow } from './shotNames';

describe('the signature shots\' brushed names', () => {
  it('holds every signature shot\'s name as superShots.ts has it, in its order, then SUPER SHOT', () => {
    expect(SHOT_NAMES).toEqual([...SIGNATURE_FIGHTERS.map(f => SIGNATURE_SHOTS[f]!.name), GENERIC_SUPER]);
    expect(shotNameRow('SHIRANSEN')).toBe(7);
    expect(shotNameRow('ANYTHING ELSE')).toBe(SHOT_NAMES.length - 1);
  });
  it('is a lossless WebP of the atlas\'s size', () => {
    const bytes = fs.readFileSync(`public${SHOT_NAMES_URL}`);
    expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    expect(bytes.subarray(12, 16).toString()).toBe('VP8L');
    // (VP8L: 14 bits each of width and height, less one, after the signature byte.)
    const b = bytes.subarray(21, 25), w = 1 + (b[0] | (b[1] & 0x3f) << 8), h = 1 + ((b[1] >> 6) | b[2] << 2 | (b[3] & 0xf) << 10);
    expect({ w, h }).toEqual(SHOT_NAMES_SIZE);
    expect(bytes.length).toBeLessThan(450_000);
  });
});
