import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { liveQuality, setLiveQuality } from '../src/render/liveQuality';
import { GROUND_TIERS, QualityWatch, readQuality } from '../src/render/ground/quality';
import { nearShare } from '../src/render/stages/near';

/** A phone left on AUTO (nothing saved: the player never opened OPTIONS) is drawn on LOW, and its ground and near
 *  scenery must be LOW too: they read the saved settings, which say nothing, and drew the High tier. */
describe('the ground and the near scenery follow the quality drawn, not the one saved', () => {
  afterEach(() => { vi.unstubAllGlobals(); setLiveQuality(undefined); });
  const saved = (value: object) => vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(value), setItem: () => {} });

  it('reads the saved quality only until the renderer has applied one', () => {
    saved({});
    expect(liveQuality()).toBe('high');   // loadSettings' default, as before
    setLiveQuality('low');
    expect(liveQuality()).toBe('low');
    expect(readQuality()).toBe('low');
    expect(nearShare()).toBe(nearShare('low'));
    expect(GROUND_TIERS[readQuality()].blades).toBe(0);
  });

  it('a place up when the quality changes (AUTO picking LOW, the watch stepping down) rebuilds within its poll', () => {
    saved({ quality: 'high' });
    setLiveQuality('high');
    const watch = new QualityWatch(3);
    expect(watch.current).toBe('high');
    setLiveQuality('low');
    const changed = [watch.poll(), watch.poll(), watch.poll()];
    expect(changed).toEqual([false, false, true]);
    expect(watch.current).toBe('low');
  });

  it('GameRenderer hands every quality it applies to them on a phone or a tablet; a desktop keeps the saved one', () => {
    const source = readFileSync(new URL('../src/render/GameRenderer.ts', import.meta.url), 'utf8');
    const apply = source.slice(source.indexOf('applySettings(settings:Settings){'), source.indexOf('private readonly focus='));
    expect(apply).toContain('if(this.handheld)setLiveQuality(q)');
  });
});
