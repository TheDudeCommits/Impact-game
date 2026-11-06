import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANIM_VERSION, loadSettings } from '../src/config';

afterEach(() => vi.unstubAllGlobals());
const saved = (value: Record<string, unknown> | null) => {
  const store = new Map<string, string>(value ? [['rift-settings', JSON.stringify(value)]] : []);
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
};

describe('the animation default', () => {
  it('is Anime (smooth) for a new player, and saves its version', () => {
    saved(null);
    const settings = loadSettings();
    expect(settings.animStyle).toBe('snap');
    expect(settings.animVersion).toBe(ANIM_VERSION);
  });
  it('moves a save holding the old default, Anime (on twos), to Anime (smooth) once', () => {
    saved({ animStyle: 'twos' });
    expect(loadSettings().animStyle).toBe('snap');
  });
  it('keeps a choice made since, and every other choice', () => {
    saved({ animStyle: 'twos', animVersion: ANIM_VERSION }); expect(loadSettings().animStyle).toBe('twos');
    saved({ animStyle: 'classic' }); expect(loadSettings().animStyle).toBe('classic');
    saved({ animStyle: 'snap' }); expect(loadSettings().animStyle).toBe('snap');
  });
});
