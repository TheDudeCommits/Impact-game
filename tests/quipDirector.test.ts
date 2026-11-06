import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { QuipDirector } from '../src/audio/QuipDirector';
import { FIGHTER_QUIPS, QUIP_CUES } from '../src/audio/quipCues';
import { FIGHTERS } from '../src/config';
import { cueFighter } from '../src/audio/CombatAudio';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import manifest from '../public/assets/audio/v2/voice/manifest.json';

const self = (fighter: FighterId = 'taisei', hp = 25) => ({ id: 'me', fighter, hp, maxHp: 100, alive: true }) as PlayerState;
const event = (kind: CombatEvent['kind'], time = 10, actorId = 'foe', targetId = 'me'): CombatEvent =>
  ({ id: time * 100, kind, serverTime: time, actorId, targetId });
const quiet = () => true;

describe('contextual fighter quips', () => {
  it('says the advantage line when the local fighter breaks a guard, and when a body they broke staggers', () => {
    expect(new QuipDirector().plan(event('guard-break', 10, 'me', 'foe'), self(), quiet)?.cue).toBe(FIGHTER_QUIPS.taisei.advantage);
    expect(new QuipDirector().plan(event('guard-break'), self(), quiet)).toBeUndefined();
    expect(new QuipDirector().plan(event('poise-break'), self(), quiet)?.cue).toBe(FIGHTER_QUIPS.taisei.advantage);
    expect(new QuipDirector().plan(event('poise-break', 10, 'me', 'foe'), self(), quiet)).toBeUndefined();
    expect(new QuipDirector().plan(event('guard-break', 10, 'me', 'foe'), self(), quiet)).toMatchObject({ bus: 'voice', phase: 'impact', voicePriority: 0 });
  });
  it('leaves the knockout, the perfect guard and low health to the situations, which plan them for everyone', () => {
    expect(new QuipDirector().plan(event('eliminated', 10, 'me', 'foe'), self(), quiet)).toBeUndefined();
    expect(new QuipDirector().plan({ ...event('just-guard'), fighter: 'oro' }, self('konta'), quiet)).toBeUndefined();
    expect(new QuipDirector().plan(event('hit'), self('kenzo', 30), quiet)).toBeUndefined();
  });
  it('never speaks for a dead fighter', () => {
    expect(new QuipDirector().plan(event('guard-break', 10, 'me', 'foe'), self('kenzo', 0), quiet)).toBeUndefined();
    expect(new QuipDirector().plan(event('guard-break', 10, 'me', 'foe'), { ...self(), alive: false }, quiet)).toBeUndefined();
  });
  it('never adds chatter to normal attacks, named moves, bosses, remote kills, or a self kill', () => {
    for (const kind of ['cast', 'release', 'confirm', 'whiff', 'awaken', 'winner', 'respawn', 'blocked', 'land'] as const)
      expect(new QuipDirector().plan(event(kind, 10, 'me', 'foe'), self(), quiet)).toBeUndefined();
    expect(new QuipDirector().plan(event('guard-break', 10, 'foe', 'other'), self(), quiet)).toBeUndefined();
    expect(new QuipDirector().plan(event('guard-break', 10, 'me', 'me'), self(), quiet)).toBeUndefined();
  });
  it('spaces all speech by 28 seconds and each repeated line by 90 seconds', () => {
    const director = new QuipDirector();
    expect(director.plan(event('guard-break', 10, 'me', 'foe'), self(), quiet)).toBeDefined();
    expect(director.plan(event('poise-break', 37), self(), quiet)).toBeUndefined();
    expect(director.plan(event('poise-break', 99), self(), quiet)).toBeUndefined();
    expect(director.plan(event('guard-break', 100, 'me', 'foe'), self(), quiet)).toBeDefined();
  });
  it('drops busy or unloaded opportunities without spending the next opportunity', () => {
    const director = new QuipDirector();
    expect(director.plan(event('guard-break', 10, 'me', 'foe'), self(), () => false)).toBeUndefined();
    expect(director.plan(event('guard-break', 11, 'me', 'foe'), self(), quiet)).toBeDefined();
    expect(director.plan(event('guard-break', 11, 'me', 'foe'), self(), quiet)).toBeUndefined();
  });
  it('resets for a new match and does not scan the mixer on ordinary attacks', () => {
    const director = new QuipDirector();
    expect(director.plan(event('guard-break', 100, 'me', 'foe'), self(), quiet)).toBeDefined();
    expect(director.plan(event('guard-break', 1, 'me', 'foe'), self(), quiet)).toBeDefined();
    director.reset();
    expect(director.plan(event('guard-break', 1.5, 'me', 'foe'), self(), quiet)).toBeDefined();
    new QuipDirector().plan(event('cast'), self(), () => { throw new Error('unnecessary mixer work'); });
  });
});
