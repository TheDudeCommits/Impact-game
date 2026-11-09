import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { MODES, MODE_ORDER, MODE_OF_HOME, VARIANT_ORDER, modeHere, modeOfSnapshot } from './catalogue';
import { HOME_MODES } from '../MangaHome';
import { PROMPT_ACTIONS } from '../prompts';
import type { GameSnapshot } from '../../game/types';
import { LAUNCH } from '../../originals/launch';

const snap = (extra: Partial<GameSnapshot> & Record<string, unknown> = {}) => ({ players: [], events: [], serverTime: 0, roomMode: 'match', status: 'active', winnerId: null, ...extra }) as unknown as GameSnapshot;

describe('the mode catalogue', () => {
  it('describes every mode the same way: a goal, a win line, three facts, three bullets', () => {
    expect(MODE_ORDER).toHaveLength(9);
    for (const id of MODE_ORDER) {
      const mode = MODES[id];
      expect(mode.id).toBe(id);
      for (const text of [mode.name, mode.goal, mode.tagline, mode.win, mode.facts.players, mode.facts.length, mode.facts.lives]) expect(text.trim().length).toBeGreaterThan(1);
      expect(mode.tagline.length).toBeLessThanOrEqual(34);
      expect(mode.panels).toHaveLength(3);
      expect(mode.howTo).toHaveLength(3);
      expect(mode.rulesVersion).toBeGreaterThanOrEqual(1);
    }
    expect(new Set(MODE_ORDER.map(id => MODES[id].name)).size).toBe(9);
  });
  it('offers its ways to play in one order, each with a label, a tag, a note and a button', () => {
    for (const id of MODE_ORDER) {
      const keys = Object.keys(MODES[id].variants);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys).toEqual(VARIANT_ORDER.filter(v => keys.includes(v)));
      for (const variant of Object.values(MODES[id].variants)) { for (const text of [variant!.label, variant!.card, variant!.tag, variant!.note, variant!.go]) expect(text.length).toBeGreaterThan(1); expect(variant!.card.length).toBeLessThanOrEqual(8); }
    }
    expect(Object.keys(MODES.training.variants)).toEqual(['offline', 'couch']);
    expect(Object.keys(MODES.royale.variants)).toEqual(LAUNCH.online ? ['offline', 'couch', 'online', 'friends'] : ['offline', 'couch']);
    for (const id of MODE_ORDER) expect(MODES[id].variants.couch?.onDevice, id).toBe(true);
  });
  it('writes keys only as placeholders a prompt can draw', () => {
    for (const id of MODE_ORDER) for (const line of MODES[id].howTo) {
      for (const [, name] of line.matchAll(/\{([a-z0-9]+)\}/g)) expect(PROMPT_ACTIONS).toContain(name);
      expect(line).not.toMatch(/\bPRESS\b|\[ ?[A-Z] ?\]/);
    }
  });
  it('keeps the removed ring out of every rule', () => {
    const all = JSON.stringify(MODES).toLowerCase();
    expect(all).not.toMatch(/\bring\b|\bstorm\b|zone closes/);
  });
  it('folds every home card into a mode, the three battle royale cards into one', () => {
    for (const card of HOME_MODES) expect(MODE_ORDER).toContain(MODE_OF_HOME[card.id].mode);
    expect(new Set(['players', 'bots', 'private'].map(c => MODE_OF_HOME[c as 'bots'].mode))).toEqual(new Set(['royale']));
  });
  it('has art for every mode card', () => {
    for (const id of MODE_ORDER) expect(existsSync(new URL(`../../../public/assets/home/modes/${MODES[id].art}.webp`, import.meta.url))).toBe(true);
  });
  it('names the mode a running match is', () => {
    expect(modeOfSnapshot(snap(), true)).toBe('arcade');
    expect(modeOfSnapshot(snap({ objective: { kind: 'last-stand' } }), false)).toBe('last-stand');
    expect(modeOfSnapshot(snap({ objective: { kind: 'bad-blood' } }), false)).toBe('bad-blood');
    expect(modeOfSnapshot(snap({ roomMode: 'training' }), false)).toBe('training');
    expect(modeOfSnapshot(snap({ lobby: { duel: true } as GameSnapshot['lobby'] }), false)).toBe('duel');
    expect(modeOfSnapshot(snap(), false)).toBe('royale');
  });
});

describe('round 5 corrections: one vocabulary, honest pausing', () => {
  it('names every way to play BOTS, ONLINE or FRIENDS (SOLO when there are no bots), the same on the card, with a subtitle', () => {
    for (const id of MODE_ORDER) for (const v of VARIANT_ORDER) {
      const way = MODES[id].variants[v];
      if (!way) continue;
      expect(['BOTS', 'COUCH', 'ONLINE', 'FRIENDS', 'SOLO'], `${id} ${v}`).toContain(way.label);
      expect(way.card).toBe(way.label);
      if (v !== 'offline') expect(way.label).toBe(v === 'online' ? 'ONLINE' : v === 'couch' ? 'COUCH' : 'FRIENDS');
      expect(way.tag.length).toBeGreaterThan(3);
      expect(way.tag).not.toMatch(/OFFLINE/);
    }
  });
  it('promises a pause only where the match runs on this device', () => {
    for (const id of MODE_ORDER) for (const v of VARIANT_ORDER) {
      const way = MODES[id].variants[v];
      if (way && /pause any time/i.test(way.note)) expect(way.onDevice, `${id} ${v}`).toBe(true);
    }
    // Every standalone bot mode runs on this device.
    expect(MODES.royale.variants.offline!.onDevice).toBe(true);
  });
  it('gives Training facts that say three different things', () => {
    const f = MODES.training.facts;
    expect(new Set([f.players, f.length, f.lives]).size).toBe(3);
  });
});

describe('the ways a device offers', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const device = (agent: string, width: number, height: number) => {
    vi.stubGlobal('navigator', { userAgent: agent, maxTouchPoints: 5 });
    vi.stubGlobal('screen', { width, height });
  };
  it('leaves couch play off a phone', () => {
    device('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile', 390, 844);
    for (const id of MODE_ORDER) {
      expect(modeHere(id).variants.couch, id).toBeUndefined();
      expect(Object.keys(modeHere(id).variants), id).toEqual(Object.keys(MODES[id].variants).filter(v => v !== 'couch'));
    }
  });
  it('keeps it on a tablet and a computer', () => {
    device('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile', 820, 1180);
    for (const id of MODE_ORDER) expect(modeHere(id).variants.couch, id).toBeDefined();
    device('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)', 1440, 900);
    for (const id of MODE_ORDER) expect(modeHere(id)).toBe(MODES[id]);
  });
});
