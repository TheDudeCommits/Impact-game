import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetDeal, placesFor } from '../../game/stageChoice';
import { PREFS_KEY, modePrefs, namedPlaceFor, saveModePrefs, trainingPlace } from './prefs';
import { placePicture, placeRow, placeShown } from './place';
import { shownStage } from '../../originals/stages';
const WEIR = shownStage('ashfall-weir')!;

const store = new Map<string, string>();
beforeEach(() => { store.clear(); forgetDeal(); (globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => void store.set(k, String(v)), removeItem: k => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 } as Storage; });
afterEach(() => vi.unstubAllGlobals());

describe("the mode sheet's LOCATION, as the device remembers it", () => {
  it('is RANDOM until a place is named', () => {
    expect(modePrefs('duel').stage).toBeUndefined();
    for (const [mode, way] of [['duel', 'offline'], ['duel', 'friends'], ['royale', 'offline'], ['royale', 'friends'], ['training', 'offline'], ['bad-blood', 'offline'], ['bad-blood', 'friends']] as const)
      expect(namedPlaceFor(mode, way), `${mode} ${way}`).toBeUndefined();
  });
  it('remembers the place named, one per mode, for the bots and the friends way alike', () => {
    saveModePrefs('duel', { stage: 'sunward-summit' }); saveModePrefs('bad-blood', { stage: 'warlords-roof' });
    expect(namedPlaceFor('duel', 'offline')).toBe('sunward-summit');
    expect(namedPlaceFor('duel', 'friends')).toBe('sunward-summit');
    expect(namedPlaceFor('bad-blood', 'offline')).toBe('warlords-roof');
    expect(namedPlaceFor('training', 'offline')).toBeUndefined();
    saveModePrefs('duel', { stage: 'random' });
    expect(namedPlaceFor('duel', 'offline')).toBeUndefined();
  });
  it('is never remembered for the online way: public matches stay random', () => {
    saveModePrefs('royale', { stage: 'sunward-summit' }); saveModePrefs('duel', { stage: 'sunward-summit' });
    expect(namedPlaceFor('royale', 'online')).toBeUndefined();
    expect(namedPlaceFor('duel', 'online')).toBeUndefined();
    expect(placeRow('royale', 'online', 'sunward-summit')).toBe('');
  });
  it('sits beside the other options without disturbing them', () => {
    saveModePrefs('royale', { variant: 'offline', fighters: 10 }); saveModePrefs('royale', { stage: 'hollowmere-quarry' }); saveModePrefs('royale', { roomSize: 4 });
    expect(modePrefs('royale')).toEqual({ variant: 'offline', fighters: 10, stage: 'hollowmere-quarry', roomSize: 4 });
  });
  it('falls back to RANDOM for a value this build does not offer, or a ring the field does not fit', () => {
    store.set(PREFS_KEY, JSON.stringify({ duel: { stage: 'nonsense' }, royale: { stage: 'zenith-coliseum' } }));
    expect(namedPlaceFor('duel', 'offline')).toBeUndefined();
    expect(namedPlaceFor('royale', 'offline', 4)).toBe('zenith-coliseum');
    expect(namedPlaceFor('royale', 'offline', 12)).toBeUndefined();
  });
  it('survives storage that refuses (private browsing)', () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(namedPlaceFor('duel', 'offline')).toBeUndefined();
    expect(() => saveModePrefs('duel', { stage: 'sunward-summit' })).not.toThrow();
  });
});

describe("Training's place", () => {
  it('is dealt from the Duel\'s places when nothing is named (RANDOM, the default)', () => {
    vi.stubGlobal('navigator', { webdriver: false });
    const place = trainingPlace();
    expect(place && placesFor('training', 'offline')).toContain(place);
  });
  it('is the place named', () => {
    vi.stubGlobal('navigator', { webdriver: false });
    saveModePrefs('training', { stage: 'zenith-coliseum' });
    expect(trainingPlace()).toBe('zenith-coliseum');
  });
  it("stays the Proving Hall for a browser driven by a tool, unless a place is named (evidence scripts frame Training by it)", () => {
    vi.stubGlobal('navigator', { webdriver: true });
    expect(trainingPlace()).toBeUndefined();
    saveModePrefs('training', { stage: 'hollowmere-quarry' });
    expect(trainingPlace()).toBe('hollowmere-quarry');
  });
});

describe('the LOCATION row', () => {
  it('is there for BOTS and FRIENDS in the modes that can choose, and not for ONLINE or the authored modes', () => {
    for (const [mode, way] of [['duel', 'offline'], ['duel', 'friends'], ['training', 'offline'], ['royale', 'offline'], ['royale', 'friends'], ['bad-blood', 'offline'], ['bad-blood', 'friends']] as const)
      expect(placeRow(mode, way, undefined), `${mode} ${way}`).toContain('data-ms-place');
    for (const [mode, way] of [['duel', 'online'], ['royale', 'online'], ['bad-blood', 'online'], ['last-stand', 'offline'], ['last-stand', 'friends'], ['rift-war', 'offline'], ['arcade', 'offline'], ['arcade', 'friends']] as const)
      expect(placeRow(mode, way, 'sunward-summit'), `${mode} ${way}`).toBe('');
  });
  // A film strip of the places' own pictures: a button each.
  const tiles = (html: string) => [...html.matchAll(/<button [^>]*data-ms-place="([^"]*)"[^>]*>/g)];
  const tile = (html: string, id: string) => tiles(html).find(m => m[1] === id)?.[0] ?? '';
  it('lists RANDOM first and selected by default, then each place by its picture, its name and its scene line', () => {
    const html = placeRow('duel', 'offline', undefined);
    expect(tiles(html)).toHaveLength(1 + placesFor('duel', 'offline').length);
    expect(tiles(html)[0][1]).toBe('');
    expect(tile(html, '')).toContain('aria-selected="true"');
    expect(html).toContain(`>${WEIR.name}</span>`);
    expect(tile(html, 'ashfall-weir')).toContain(`aria-label="${WEIR.name}: ${WEIR.scene}"`);
    expect(tile(html, 'ashfall-weir')).toContain(`url('${placePicture('ashfall-weir', true)}')`);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
  });
  it('shows the place remembered as the one selected', () => {
    const html = placeRow('duel', 'offline', 'ashfall-weir');
    expect(tile(html, 'ashfall-weir')).toContain('aria-selected="true"');
    expect(tile(html, '')).toContain('aria-selected="false"');
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(placeShown('duel', 'offline', 'ashfall-weir')).toMatchObject({ id: 'ashfall-weir', name: WEIR.name, at: placesFor('duel', 'offline').indexOf('ashfall-weir') + 2 });
    expect(placeShown('duel', 'offline', undefined)).toMatchObject({ id: undefined, name: 'Random', at: 1 });
    expect(placeShown('royale', 'online', 'sunward-summit')).toBeUndefined();
  });
  it('says when RANDOM is dealt: against bots each time, for friends when the room opens', () => {
    expect(placeRow('royale', 'offline', undefined, 8)).toContain('A different place each time');
    expect(placeRow('royale', 'friends', undefined, 8)).toContain('Dealt when your room opens');
  });
  it('lists the small rings a big royale cannot use as unavailable, with how many each holds', () => {
    const big = placeRow('royale', 'offline', 'zenith-coliseum', 12);
    expect(tile(big, 'zenith-coliseum')).toMatch(/ disabled data-tag="UP TO 4"/);
    expect(tile(big, 'drifting-isle')).toMatch(/ disabled data-tag="UP TO 8"/);
    expect(tile(big, '')).toContain('aria-selected="true"');   // the ring named no longer fits: RANDOM shows
    const small = placeRow('royale', 'offline', 'zenith-coliseum', 4);
    expect(small).not.toContain('disabled');
    expect(tile(small, 'zenith-coliseum')).toContain('aria-selected="true"');
  });
  it('escapes the names it draws', () => {
    const named = placesFor('royale', 'friends').map(id => shownStage(id)!.name).find(name => name.includes("'"))!;
    expect(placeRow('royale', 'friends', undefined, 8)).toContain(`>${named.replace(/'/g, '&#39;')}</span>`);
  });
});

