import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { FIGHTERS, HUD_SKINS, HUD_SKIN_OPTIONS, HUD_VERSION, loadSettings } from '../../../config';
import { PROTOS, PROTO_IDS } from './index';
import { firstPicture, pictures, plateSwapped, tones } from './proto';

describe('the drawn HUD looks', () => {
  it('make Halo the HUD everyone gets, with Inked still offered in the menus', () => {
    expect(PROTO_IDS).toEqual(['halo']);
    expect(loadSettings().hudSkin).toBe('halo');
    expect(HUD_SKIN_OPTIONS[0][0]).toBe('halo');
    expect(HUD_SKINS).toContain('inked');
    for (const id of PROTO_IDS) {
      expect(HUD_SKINS).toContain(id);
      expect(HUD_SKIN_OPTIONS.some(([value]) => value === id)).toBe(true);
    }
  });

  it('move a save from before Halo was the default onto Halo once, and keep a later choice of Inked', () => {
    const was = (globalThis as { localStorage?: unknown }).localStorage;
    const store = (saved: object) => { (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => JSON.stringify(saved), setItem: () => {} }; };
    try {
      store({ hudSkin: 'inked' });
      expect(loadSettings().hudSkin).toBe('halo');
      store({ hudSkin: 'inked', hudVersion: HUD_VERSION });
      expect(loadSettings().hudSkin).toBe('inked');
      store({ hudSkin: 'halo' });
      expect(loadSettings().hudSkin).toBe('halo');
      expect(loadSettings().hudVersion).toBe(HUD_VERSION);
    } finally { (globalThis as { localStorage?: unknown }).localStorage = was; }
  });

  it('build both plates and a clock with the hooks the shared driver writes', () => {
    for (const skin of PROTOS) for (const side of ['own', 'foe'] as const) {
      const html = skin.plate(side);
      expect(html, skin.id).toContain(`hd-skin hd-${skin.id} hd-${side}`);
      for (const text of ['name', 'hp', 'hpmax']) expect(html, `${skin.id} ${text}`).toContain(`data-hd="${text}"`);
      expect(html, skin.id).toContain(skin.portrait === 'bust' ? 'data-hd-bust' : 'data-hd-ink');
      expect(skin.clock(), skin.id).toContain('data-hd-time');
      // Ids are per side: the mirrored plate never draws with the other's filters or gradients.
      for (const [, id] of html.matchAll(/id="([^"]+)"/g)) expect(id, skin.id).toContain(side);
    }
  });

  it('tunes every fighter\'s colour so it glows on night and prints under black ink', () => {
    const lightness = (css: string) => +/(\d+)%\)$/.exec(css)![1];
    for (const id of Object.keys(FIGHTERS) as (keyof typeof FIGHTERS)[]) {
      const tone = tones(FIGHTERS[id].color);
      expect(lightness(tone.accent), id).toBeGreaterThanOrEqual(60);
      expect(lightness(tone.flood), id).toBeGreaterThanOrEqual(52);
      expect(lightness(tone.flood), id).toBeLessThanOrEqual(62);
      expect(lightness(tone.deep), id).toBe(26);
    }
    // A colour without a hue (bone, silver) becomes a cool steel rather than a muddy grey.
    expect(tones('#e9e2cf').accent).toMatch(/^hsl\(215 /);
  });
});

describe('a plate whose player becomes another fighter (Training\'s switch)', () => {
  it('plays its entrance for the change alone: not for its first fighter, the same fighter, or while the fight\'s own entrance is due', () => {
    expect(plateSwapped('taisei', 'kuon', false)).toBe(true);
    expect(plateSwapped('taisei', 'taisei', false)).toBe(false);
    expect(plateSwapped('', 'taisei', false)).toBe(false);
    expect(plateSwapped('taisei', 'kuon', true)).toBe(false);
  });
});

describe('the pictures the plates draw', () => {

  it('has a bust, or at least a manga portrait to fall back on, for every fighter', () => {
    const missing = (Object.keys(FIGHTERS) as (keyof typeof FIGHTERS)[]).filter(id =>
      !fs.existsSync(`public/assets/hud/busts/${id}.webp`) && !fs.existsSync(`public/assets/home/portraits/${id}.webp`));
    expect(missing).toEqual([]);
  });

});

describe('Halo\'s stylesheet', () => {
  const css = fs.readFileSync('src/ui/hud/protos/halo.css', 'utf8') + fs.readFileSync('src/ui/hud/protos/proto.css', 'utf8');
  const frames = new Map([...css.matchAll(/@keyframes ([\w-]+)\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map(([, name, body]) => [name, body]));

  it('names each motion once (a second @keyframes of a name replaces the first everywhere it plays)', () => {
    const names = [...css.matchAll(/@keyframes ([\w-]+)\{/g)].map(([, name]) => name);
    expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([]);
  });

  it('keeps no motion it never plays, and plays none it lacks', () => {
    const played = new Set([...css.matchAll(/animation(?:-name)?:([^;}]+)/g)].flatMap(([, value]) => value.match(/(?<![\w-])hl-[\w-]+/g) ?? []));
    expect([...frames.keys()].filter(name => !played.has(name))).toEqual([]);
    expect([...played].filter(name => !frames.has(name))).toEqual([]);
  });

  it('never animates `scale` on a word (the target\'s words are turned back with it)', () => {
    const words = /\.(hl-name|hl-hpnum|hl-hp-v|hl-awktag|hl-form|hd-txt)\b(?![\w-])/;
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*animation:[^{}]*)\}/g)) {
      if (!words.test(selector.split(',').map(s => s.trim().split(/\s+/).pop()).join(' '))) continue;
      for (const name of body.match(/(?<![\w-])hl-[\w-]+/g) ?? []) expect(frames.get(name) ?? '', `${name} on ${selector.trim()}`).not.toMatch(/(^|[{;])\s*scale\s*:/);
    }
  });
});
