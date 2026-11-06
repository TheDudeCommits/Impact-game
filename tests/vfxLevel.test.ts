import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, VFX_DENSITY, VFX_LEVELS, VFX_OPTIONS, vfxFromDensity } from '../src/config';
import { homeOptions } from '../src/ui/HomePanels';
import { pauseMenu } from '../src/ui/PauseMenu';
import { LETTERING_CALM, MangaImpact } from '../src/ui/MangaImpact';
import { setVfxLevel, VFX, VFX_PROFILES } from '../src/render/vfxLevel';
import { CombatEffects } from '../src/render/CombatEffects';
import type { CombatEvent, PlayerState } from '../src/game/types';

describe('the visual effects setting', () => {
  afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage; setVfxLevel('full'); });
  const saved = (value: object) => { (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => JSON.stringify(value) }; };

  it('is Full by default, the game as it was, at full density', () => {
    const settings = loadSettings();
    expect(settings.vfx).toBe('full');
    expect(settings.effects).toBe(1);
    saved({});
    expect(loadSettings().vfx).toBe('full');
  });

  it('keeps a saved level, and the density goes with it', () => {
    for (const level of VFX_LEVELS) {
      saved({ vfx: level, effects: 1 });
      const settings = loadSettings();
      expect(settings.vfx).toBe(level);
      expect(settings.effects).toBe(VFX_DENSITY[level]);
    }
    saved({ vfx: 'ultra', effects: 1 });
    expect(loadSettings().vfx).toBe('full');
  });

  it('moves a saved EFFECT DENSITY to the nearest level, so a player who turned it down keeps it down', () => {
    const cases: [number, string][] = [[1, 'full'], [.9, 'full'], [.8, 'reduced'], [.6, 'reduced'], [.5, 'reduced'], [.4, 'minimal'], [.3, 'minimal']];
    for (const [effects, level] of cases) {
      saved({ effects });
      expect(loadSettings().vfx, `density ${effects}`).toBe(level);
      expect(vfxFromDensity(effects)).toBe(level);
    }
    // The levels' own densities read back as themselves.
    for (const level of VFX_LEVELS) expect(vfxFromDensity(VFX_DENSITY[level])).toBe(level);
    // A level already chosen wins over an old density beside it.
    saved({ vfx: 'full', effects: .3 });
    expect(loadSettings().vfx).toBe('full');
  });

  it('is one picker in the pause menu and the home OPTIONS, where the density slider stood', () => {
    expect(VFX_OPTIONS.map(([value]) => value)).toEqual([...VFX_LEVELS]);
    expect(VFX_OPTIONS[0][0]).toBe('full');
    for (const level of VFX_LEVELS) {
      saved({ vfx: level });
      const settings = loadSettings();
      for (const [markup, hook] of [[homeOptions(settings), 'data-home-setting="vfx"'], [pauseMenu(settings), 'data-setting="vfx"']] as const) {
        expect(markup).toContain(hook);
        const picker = markup.slice(markup.indexOf(hook), markup.indexOf('</ink-select>', markup.indexOf(hook)));
        for (const [value, text] of VFX_OPTIONS) { expect(picker).toContain(`<option value="${value}"`); expect(picker).toContain(`>${text}</option>`); }
        expect(picker).toContain(`<option value="${level}" data-tag="${VFX_OPTIONS.find(([v]) => v === level)![2]}" selected>`);
        // No second control for the same thing.
        expect(markup).not.toMatch(/data-(home-)?setting="effects"/);
        expect(markup).not.toMatch(/EFFECT DENSITY|Effect density/);
      }
      expect(homeOptions(settings)).toContain('VISUAL EFFECTS');
      expect(pauseMenu(settings)).toContain('Visual effects');
    }
  });

  it('leaves everything as it was at Full and only ever takes away below it', () => {
    const full = VFX_PROFILES.full, reduced = VFX_PROFILES.reduced, minimal = VFX_PROFILES.minimal;
    for (const [key, value] of Object.entries(full)) if (typeof value === 'number') expect(value, key).toBe(1);
    expect(full.lettering).toBe('all');
    for (const key of Object.keys(full) as (keyof typeof full)[]) {
      if (typeof full[key] !== 'number') continue;
      expect(reduced[key] as number, `reduced ${key}`).toBeLessThanOrEqual(full[key] as number);
      expect(minimal[key] as number, `minimal ${key}`).toBeLessThanOrEqual(reduced[key] as number);
      expect(minimal[key] as number, `minimal ${key}`).toBeGreaterThanOrEqual(0);
    }
    expect(VFX_DENSITY.full).toBeGreaterThan(VFX_DENSITY.reduced);
    expect(VFX_DENSITY.reduced).toBeGreaterThan(VFX_DENSITY.minimal);
    // The whole-screen white flash and the colour fringe are Full's alone; Minimal draws no speed lines or zoom blur.
    expect(reduced.impactFrame).toBe(0); expect(reduced.chroma).toBe(0);
    expect(minimal.speedLines).toBe(0); expect(minimal.blur).toBe(0);
    // A hit still shows: its sparks and the struck body's flash are softer, never gone.
    expect(minimal.spriteGain).toBeGreaterThanOrEqual(.5); expect(minimal.spriteSize).toBeGreaterThanOrEqual(.5); expect(minimal.bodyFlash).toBeGreaterThanOrEqual(.5);
  });

  it('puts a level in force at once, and an unknown one is Full', () => {
    setVfxLevel('minimal');
    expect(VFX.level).toBe('minimal'); expect(VFX.speedLines).toBe(0);
    setVfxLevel('reduced');
    expect(VFX.level).toBe('reduced'); expect(VFX.speedLines).toBe(VFX_PROFILES.reduced.speedLines);
    setVfxLevel('nonsense' as never);
    expect(VFX.level).toBe('full'); expect(VFX.impactFrame).toBe(1);
  });
});

const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 'a', name: 'X', fighter: 'taisei', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle', actionStarted: .5, actionTime: 0, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });

describe('the effects at each level', () => {
  afterEach(() => setVfxLevel('full'));

  it('draws the kit\'s sprites at the level\'s size and opacity, and its light at the level\'s share', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    const hit = (id: number, time: number): CombatEvent => ({ id, kind: 'hit', serverTime: time, actorId: 'a', targetId: 'b', fighter: 'kagari', slot: 'special', damage: 138, endpoint: { x: 0, y: 1, z: 0 } });
    try {
      const light = (level: 'full' | 'reduced' | 'minimal', id: number, time: number) => {
        setVfxLevel(level); fx.handle([hit(id, time)]); fx.update(time + .03, 1 / 60, new Map());
        return Math.max(...fx.kit.lights.lights.map(l => l.intensity));
      };
      const full = light('full', 1, 1), reduced = light('reduced', 2, 5), minimal = light('minimal', 3, 9);
      expect(full).toBeGreaterThan(0);
      expect(reduced).toBeCloseTo(full * VFX_PROFILES.reduced.lights, 5);
      expect(minimal).toBeCloseTo(full * VFX_PROFILES.minimal.lights, 5);
      const u = fx.kit.sparks.mesh.material.uniforms;
      expect(u.uFxSize.value).toBe(VFX_PROFILES.minimal.spriteSize); expect(u.uFxGain.value).toBe(VFX_PROFILES.minimal.spriteGain);
      setVfxLevel('full'); fx.update(10, 1 / 60, new Map());
      expect(u.uFxSize.value).toBe(1); expect(u.uFxGain.value).toBe(1);
      // The shaders read them: every sprite's size and its premultiplied colour.
      expect(fx.kit.sparks.mesh.material.vertexShader).toMatch(/\* uFxSize;/);
      expect(fx.kit.sparks.mesh.material.fragmentShader).toMatch(/gl_FragColor = o \* \(keep \* uFxGain\);/);
    } finally { fx.dispose(); }
  });
});

describe('the lettering at each level', () => {
  /** Just enough of a document for the lettering to build its elements on (as tests/ultimateWhiffShown.test.ts). */
  class Element {
    style: Record<string, unknown> = { setProperty(this: Record<string, unknown>, k: string, v: string) { this[k] = v; } };
    children: Element[] = []; className = ''; textContent = ''; parent?: Element;
    setAttribute() {}
    append(...kids: Element[]) { for (const k of kids) { k.parent = this; this.children.push(k); } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
    text(): string { return this.textContent + this.children.map(c => c.text()).join(''); }
  }
  const saved = { document: globalThis.document, matchMedia: (globalThis as { matchMedia?: unknown }).matchMedia };
  beforeEach(() => {
    (globalThis as unknown as { document: unknown }).document = { createElement: () => new Element() };
    (globalThis as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: false });
  });
  afterEach(() => {
    (globalThis as unknown as { document: unknown }).document = saved.document;
    (globalThis as unknown as { matchMedia: unknown }).matchMedia = saved.matchMedia;
    setVfxLevel('full');
  });
  const players = [player({ id: 'me' }), player({ id: 'foe', x: 2 })];
  const ultimate: CombatEvent = { id: 1, kind: 'hit', serverTime: 1, actorId: 'me', targetId: 'foe', fighter: 'taisei', slot: 'ultimate', damage: 285, endpoint: { x: 2, y: 1, z: 0 } };
  const parry: CombatEvent = { id: 2, kind: 'just-guard', serverTime: 2, actorId: 'foe', targetId: 'me', fighter: 'ouga', slot: 'heavy', endpoint: { x: 0, y: 1, z: 0 } };
  const print = (level: 'full' | 'reduced' | 'minimal') => {
    setVfxLevel(level);
    const root = new Element(), manga = new MangaImpact(root as unknown as HTMLElement);
    manga.handle([ultimate], 'me', players);
    const word = root.children.filter(c => c.className.startsWith('manga-hit')).map(c => c.text());
    // (Past the accent throttle, as a parry a beat later would be.)
    (manga as unknown as { lastAccent: number }).lastAccent = -100;
    manga.handle([parry], 'me', players);
    const all = root.children.filter(c => c.className.startsWith('manga-hit'));
    const sizes = (manga as unknown as { hits: { size: number }[] }).hits.map(h => h.size);
    const edge = root.children.find(c => c.className === 'manga-speed-frame')!;
    return { word, all: all.map(c => c.text()), sizes, edge: Number(edge.style.opacity ?? 0) };
  };

  it('letters every word at Full, the big moments smaller at Reduced, and only what a word tells at Minimal', () => {
    const full = print('full'), reduced = print('reduced'), minimal = print('minimal');
    expect(full.word.join('')).toContain('ドォン');
    expect(full.edge).toBeGreaterThan(0);
    expect(reduced.word.join('')).toContain('ドォン');
    expect(reduced.edge, 'no ink frame round the screen below Full').toBe(0);
    expect(reduced.sizes[0]).toBe(Math.round(full.sizes[0] * LETTERING_CALM));
    expect(minimal.word, 'an ultimate\'s word is not printed at Minimal').toEqual([]);
    // The parry is read at every level.
    for (const each of [full, reduced, minimal]) expect(each.all.join('')).toContain('PARRY');
  });
});
