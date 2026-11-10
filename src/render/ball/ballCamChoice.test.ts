import {afterEach, describe, expect, it, vi} from 'vitest';
import {CHASE_CAM_OPTIONS, SPIKE_CAM_OPTIONS, ballCamAsk, chaseCamChoice, chaseCamOf, netSheer, spikeCamChoice, spikeCamOf, teamTrimOn} from './ballCamChoice';
import {loadSettings} from '../../config';

/** The ball modes' camera options are off until the player picks one, kept on this device once picked, and
 *  named plainly in the menus; an address's switch works on this machine only. */
afterEach(() => vi.unstubAllGlobals());
const saved = (value: Record<string, unknown> | null) => {
  const store = new Map<string, string>(value ? [['rift-settings', JSON.stringify(value)]] : []);
  vi.stubGlobal('localStorage', {getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k)});
};

describe("the ball modes' camera options", () => {
  it('are the classic cameras for a new player, for a save from before the round, and for anything unknown', () => {
    for (const save of [null, {}, {cameraMode: 'dynamic', quality: 'high'}, {spikeCam: 'classic', chaseCam: 'classic'}, {spikeCam: 'low', chaseCam: 7}, {spikeCam: null, chaseCam: ['close']}]) {
      saved(save);
      const settings = loadSettings();
      expect(spikeCamChoice(settings), JSON.stringify(save)).toBe('classic'); expect(chaseCamChoice(settings), JSON.stringify(save)).toBe('classic');
      // (Nothing is written for the classic cameras: a save stays the save it was.)
      expect(settings.spikeCam).toBeUndefined(); expect(settings.chaseCam).toBeUndefined();
    }
    expect(spikeCamOf(undefined)).toBe('classic'); expect(chaseCamOf(undefined)).toBe('classic'); expect(spikeCamOf('close')).toBe('classic'); expect(chaseCamOf('side')).toBe('classic');
  });
  it('keep a pick, each on its own', () => {
    saved({spikeCam: 'side'}); expect(loadSettings().spikeCam).toBe('side'); expect(loadSettings().chaseCam).toBeUndefined();
    saved({chaseCam: 'close'}); expect(loadSettings().chaseCam).toBe('close'); expect(loadSettings().spikeCam).toBeUndefined();
    saved({spikeCam: 'side', chaseCam: 'close'});
    expect(spikeCamChoice(loadSettings())).toBe('side'); expect(chaseCamChoice(loadSettings())).toBe('close');
    // (And the round trip a menu's change makes: the settings written whole, read back.)
    const settings = loadSettings(); saved(JSON.parse(JSON.stringify(settings)));
    expect(loadSettings().spikeCam).toBe('side'); expect(loadSettings().chaseCam).toBe('close');
  });
  it('are offered with the classic camera first, named plainly', () => {
    expect(SPIKE_CAM_OPTIONS.map(o => o[0])).toEqual(['classic', 'side']); expect(CHASE_CAM_OPTIONS.map(o => o[0])).toEqual(['classic', 'close']);
    expect(SPIKE_CAM_OPTIONS.map(o => o[1])).toEqual(['Classic', 'Court-side']); expect(CHASE_CAM_OPTIONS.map(o => o[1])).toEqual(['Classic', 'Close']);
    expect(SPIKE_CAM_OPTIONS[0][2]).toBe('Default'); expect(CHASE_CAM_OPTIONS[0][2]).toBe('Default');
  });
  it("read an address's switches on this machine only", () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) expect(ballCamAsk('?spikecam=side&chasecam=close&trim=0', host)).toEqual({spike: 'side', chase: 'close', trim: false});
    expect(ballCamAsk('?ballpilot&spikecam=classic&chasecam=classic&trim=1', 'localhost')).toEqual({spike: 'classic', chase: 'classic', trim: true});
    expect(ballCamAsk('?spikecam=sideways&chasecam=&trim=maybe', 'localhost')).toEqual({spike: undefined, chase: undefined, trim: undefined});
    expect(ballCamAsk('', 'localhost')).toEqual({spike: undefined, chase: undefined, trim: undefined});
    // The game's own site, and any other host: an address changes nothing.
    for (const host of ['play.example.com', 'game.example.com', 'example.org']) expect(ballCamAsk('?spikecam=side&chasecam=close&trim=0', host)).toEqual({});
  });
  it('leave the trim on and the net as it is unless something asks', () => {
    expect(teamTrimOn()).toBe(true);
    expect(netSheer.value).toBe(0);
  });
});
