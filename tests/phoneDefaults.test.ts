import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultVfx, loadSettings, VFX_DENSITY } from '../src/config';

/** The phone pass (November 2026): VISUAL EFFECTS start on Reduced on a phone; a saved choice wins. */
describe('a phone starts on Reduced visual effects', () => {
  afterEach(() => vi.unstubAllGlobals());
  const asPhone = () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', maxTouchPoints: 5 });
    vi.stubGlobal('screen', { width: 393, height: 852 });
  };
  const saved = (value: object) => vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(value), setItem: () => {} });

  it('Reduced on a phone, Full anywhere else, by default', () => {
    expect(defaultVfx(true)).toBe('reduced');
    expect(defaultVfx(false)).toBe('full');
    asPhone(); saved({});
    const settings = loadSettings();
    expect(settings.vfx).toBe('reduced');
    expect(settings.effects).toBe(VFX_DENSITY.reduced);
  });
  it('a level or a density the player saved wins on a phone', () => {
    asPhone();
    saved({ vfx: 'full' }); expect(loadSettings().vfx).toBe('full');
    saved({ vfx: 'minimal' }); expect(loadSettings().vfx).toBe('minimal');
    saved({ effects: 1 }); expect(loadSettings().vfx).toBe('full');
  });
  it('a desktop is unchanged', () => {
    saved({});
    expect(loadSettings().vfx).toBe('full');
    expect(loadSettings().effects).toBe(1);
  });
});
