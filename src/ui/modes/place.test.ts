import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetDeal, placesFor } from '../../game/stageChoice';
import { PREFS_KEY, modePrefs, namedPlaceFor, saveModePrefs, trainingPlace } from './prefs';
import { placePicture, placeRow, placeShown } from './place';
import { shownStage } from '../../originals/stages';
const VALLEY = shownStage('mirror-mere')!;

const store = new Map<string, string>();
beforeEach(() => { store.clear(); forgetDeal(); (globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => void store.set(k, String(v)), removeItem: k => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 } as Storage; });
afterEach(() => vi.unstubAllGlobals());

describe("the mode sheet's LOCATION, as the device remembers it", () => {
  it('is RANDOM until a place is named', () => {
    expect(modePrefs('duel').stage).toBeUndefined();
    for (const [mode, way] of [['duel', 'offline'], ['duel', 'friends'], ['royale', 'offline'], ['royale', 'friends'], ['training', 'offline'], ['bad-blood', 'offline'], ['bad-blood', 'friends']] as const)
      expect(namedPlaceFor(mode, way), `${mode} ${way}`).toBeUndefined();
  });
  it('is never remembered for the online way: public matches stay random', () => {
    saveModePrefs('royale', { stage: 'mirror-mere' }); saveModePrefs('duel', { stage: 'mirror-mere' });
    expect(namedPlaceFor('royale', 'online')).toBeUndefined();
    expect(namedPlaceFor('duel', 'online')).toBeUndefined();
    expect(placeRow('royale', 'online', 'mirror-mere')).toBe('');
  });
  it('sits beside the other options without disturbing them', () => {
    saveModePrefs('royale', { variant: 'offline', fighters: 10 }); saveModePrefs('royale', { stage: 'kuroyuki-hall' }); saveModePrefs('royale', { roomSize: 4 });
    expect(modePrefs('royale')).toEqual({ variant: 'offline', fighters: 10, stage: 'kuroyuki-hall', roomSize: 4 });
  });
  it('survives storage that refuses (private browsing)', () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(namedPlaceFor('duel', 'offline')).toBeUndefined();
    expect(() => saveModePrefs('duel', { stage: 'mirror-mere' })).not.toThrow();
  });
});

describe("Training's place", () => {
  it('is dealt from the Duel\'s places when nothing is named (RANDOM, the default)', () => {
    vi.stubGlobal('navigator', { webdriver: false });
    const place = trainingPlace();
    expect(place && placesFor('training', 'offline')).toContain(place);
  });
});

describe('the LOCATION row', () => {
  it('is there for BOTS and FRIENDS in the modes that can choose, and not for ONLINE or the authored modes', () => {
    for (const [mode, way] of [['duel', 'offline'], ['duel', 'friends'], ['training', 'offline'], ['royale', 'offline'], ['royale', 'friends'], ['bad-blood', 'offline'], ['bad-blood', 'friends']] as const)
      expect(placeRow(mode, way, undefined), `${mode} ${way}`).toContain('data-ms-place');
    for (const [mode, way] of [['duel', 'online'], ['royale', 'online'], ['bad-blood', 'online'], ['last-stand', 'offline'], ['last-stand', 'friends'], ['rift-war', 'offline'], ['arcade', 'offline'], ['arcade', 'friends']] as const)
      expect(placeRow(mode, way, 'mirror-mere'), `${mode} ${way}`).toBe('');
  });
  const tiles = (html: string) => [...html.matchAll(/<button [^>]*data-ms-place="([^"]*)"[^>]*>/g)];
  const tile = (html: string, id: string) => tiles(html).find(m => m[1] === id)?.[0] ?? '';
  it('says when RANDOM is dealt: against bots each time, for friends when the room opens', () => {
    expect(placeRow('royale', 'offline', undefined, 8)).toContain('A different place each time');
    expect(placeRow('royale', 'friends', undefined, 8)).toContain('Dealt when your room opens');
  });
  it('escapes the names it draws', () => {
    const named = placesFor('royale', 'friends').map(id => shownStage(id)!.name).find(name => name.includes("'"))!;
    expect(placeRow('royale', 'friends', undefined, 8)).toContain(`>${named.replace(/'/g, '&#39;')}</span>`);
  });
});

