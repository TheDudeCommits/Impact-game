import {describe,it,expect} from 'vitest';
import {HAKUSHI_MOVES} from '../src/game/fighters/hakushi';

describe('Hakushi candidate model and manual kit',()=>{
 it('never creates passive damage or an autonomous summon',()=>{
  expect(HAKUSHI_MOVES.ultimate.confirm).toBeDefined();expect(HAKUSHI_MOVES.ultimate.contacts).toEqual([.52,1.82,2.6]);
  for(const move of Object.values(HAKUSHI_MOVES)){expect(move.contacts.every(t=>t>0&&t<move.duration)).toBe(true);expect(move.cooldown).toBeGreaterThan(0);expect(move.style).not.toBe('field');expect(move.detached).not.toBe(true);}
 });
});
