import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOSS_LINES } from '../src/originals/bossLines';
import MANIFEST from '../public/assets/audio/survival/manifest.json';

const rows = new Map((MANIFEST as unknown as { assets: { id: string; text?: string; source?: string; file: string }[] }).assets.map(a => [a.file, a]));
const said = (boss: string) => Object.entries(BOSS_LINES[boss] ?? {}).filter(([moment]) => moment !== 'moves')
  .flatMap(([, urls]) => (urls as readonly string[]).map(url => rows.get(url)!));

describe('the redesigned bosses\' lines', () => {
  it('has a file and a row for every line of the seven', () => {
    for (const boss of ['takane', 'harrow', 'ashwing', 'rime', 'lumen', 'caldera', 'mirabel'])
      for (const row of said(boss)) { expect(row, boss).toBeTruthy(); expect(fs.existsSync(`public${row.file}`), row.file).toBe(true); }
  });
  it('says nothing of their old designs', () => {
    const text = (boss: string) => said(boss).map(r => r.text ?? '').join(' ');
    expect(text('takane')).not.toMatch(/脚|届|ワシ|じゃ/);        // the old long-legged old man
    expect(text('harrow')).not.toMatch(/狼|ガル|牙/);            // the grey wolf
    expect(text('ashwing')).not.toMatch(/王の右腕/);               // the king's right hand
    expect(text('rime')).not.toMatch(/白い沈黙|ふぁ/);        // the white silence, the yawn
    expect(text('lumen')).not.toMatch(/あらぁ|ほらほら|よぉ/); // the tease
    expect(text('caldera')).not.toMatch(/判決|罪人/);            // the judge's verdict
    expect(text('mirabel')).not.toMatch(/瓶/);                   // the bottled souls (lockets now)
  });
  it('voices Takane with a woman\'s preset, every line of hers taken again', () => {
    for (const row of said('takane')) expect(row.source, row.file).toMatch(/preset Vera .*fix-audio3/);
  });
});
