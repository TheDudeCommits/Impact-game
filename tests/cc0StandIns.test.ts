import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import SFX from '../src/originals/sfx.json';
import PIXEL_SFX from '../src/originals/pixelSfx.json';
import MANIFEST from '../public/assets/audio/v2/cc0/manifest.json';
import { SURVIVAL_STAND_INS, standIn, survivalStandIn } from '../src/audio/standIns';
import { everyTake } from '../src/audio/survivalBank';
import { objectiveTakes } from '../src/audio/ObjectiveAudio';

/** The CC0 stand-ins (src/audio/standIns.ts, public/assets/audio/v2/cc0/manifest.json) for the sounds held back from this
 *  repository (README.md). When a held-back file comes back, its stand-in and its manifest entry go. */
const BANK = 'public/assets/audio/v2';
const CC0 = `${BANK}/cc0`;
type Entry = { file: string; standsIn: string; seconds: number; licence: string; sources: string[]; sha256: string };
const FILES = MANIFEST.files as Entry[];
const SOURCES = MANIFEST.sources as Record<string, { licence: string; page: string; sha256: string }>;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
/** A WAV's header numbers and its length in seconds. */
function wavInfo(file: string) {
  const b = fs.readFileSync(file);
  let at = 12, rate = 0, channels = 0, bits = 0, data = 0;
  while (at + 8 <= b.length) {
    const id = b.toString('ascii', at, at + 4), size = b.readUInt32LE(at + 4);
    if (id === 'fmt ') { channels = b.readUInt16LE(at + 10); rate = b.readUInt32LE(at + 12); bits = b.readUInt16LE(at + 22); }
    if (id === 'data') { data = size; break; }
    at += 8 + size + (size & 1);
  }
  return { rate, channels, bits, seconds: data / (bits / 8) / channels / rate };
}
const sha256 = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

describe('the CC0 stand-ins for the held-back sounds', () => {
  it('give every sound-effect cue whose own file is not here a stand-in of its length, as the bank expects (48 kHz mono 16-bit)', () => {
    const cues = { ...(SFX as Record<string, { file: string; seconds: number }>), ...(PIXEL_SFX.cues as Record<string, { file: string; seconds: number }>) };
    for (const [cue, row] of Object.entries(cues)) {
      if (fs.existsSync(`${BANK}/${row.file}`)) continue;
      const at = `${BANK}/${standIn(row.file)}`;
      expect(fs.existsSync(at), `${cue}: ${at}`).toBe(true);
      const info = wavInfo(at);
      expect([info.rate, info.channels, info.bits], cue).toEqual([48000, 1, 16]);
      expect(Math.abs(info.seconds - row.seconds), cue).toBeLessThan(.001);
    }
  });

  it('give every Arcade Survival take the game asks for a file: its own or its stand-in', () => {
    for (const url of [...everyTake(), ...objectiveTakes()]) expect(fs.existsSync(`public${survivalStandIn(url)}`), url).toBe(true);
    for (const name of SURVIVAL_STAND_INS) expect(fs.existsSync(`${CC0}/survival/${name}.m4a`), name).toBe(true);
  });

  it('list every stand-in in the manifest with its hash, CC0, and only CC0 sources with their pages and hashes', () => {
    const onDisk = walk(CC0).map(file => path.relative(BANK, file).split(path.sep).join('/')).filter(file => file !== 'cc0/manifest.json');
    expect(FILES.map(entry => entry.file).sort()).toEqual(onDisk.sort());
    for (const entry of FILES) {
      expect(entry.licence, entry.file).toBe('cc0-1.0');
      expect(sha256(`${BANK}/${entry.file}`), entry.file).toBe(entry.sha256);
      for (const source of entry.sources) {
        expect(SOURCES[source]?.licence, `${entry.file}: ${source}`).toBe('CC0 1.0');
        expect(SOURCES[source].page, source).toMatch(/^https:\/\/(kenney\.nl|freesound\.org)\//);
      }
    }
  });

  it('sit under cc0/, never at a held-back path, each where the resolver looks for it and standing in for a file this checkout lacks', () => {
    for (const entry of FILES) {
      expect(entry.file.startsWith('cc0/'), entry.file).toBe(true);
      if (entry.standsIn.startsWith('survival/')) {
        expect(fs.existsSync(`public/assets/audio/${entry.standsIn}`), entry.standsIn).toBe(false);
        expect(survivalStandIn(`/assets/audio/${entry.standsIn}`)).toBe(`/assets/audio/v2/${entry.file}`);
      } else {
        expect(fs.existsSync(`${BANK}/${entry.standsIn}`), entry.standsIn).toBe(false);
        expect(standIn(entry.standsIn)).toBe(entry.file);
      }
    }
  });
});
