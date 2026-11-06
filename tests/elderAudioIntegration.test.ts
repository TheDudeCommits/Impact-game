import fs from 'node:fs';
import {createHash}from 'node:crypto';
import {describe,expect,it}from 'vitest';
import {planCombatAudio,cueDuration}from '../src/audio/cuePlan';
import {planSfx}from '../src/audio/sfxPlan';
import {moveFor,awakeningSwapAt}from '../src/game/awakening';
import {WHIFF_RECOVERY}from '../src/game/moves';
import {SFX_PEAKS}from '../src/audio/sfxCues';
import type{CombatEvent,FighterId}from '../src/game/types';
const ids=['kusushi','hakushi']as const;
const event=(fighter:FighterId,kind:CombatEvent['kind'],slot?:CombatEvent['slot'],castAge?:number):CombatEvent=>({id:91,kind,fighter,slot,actorId:'a',serverTime:1,castAge});
describe('Elder recorded voice and confirmed audio contracts',()=>{
 it.each(ids)('%s schedules no cinematic audio from an unconfirmed cast/whiff',id=>{
  for(const awakened of[false,true]){
   const m=moveFor(id,'ultimate',awakened),open=m.contacts[0];
   for(const l of planCombatAudio(event(id,'cast','ultimate'),awakened).filter(l=>l.bus!=='voice')){
    if((l.delay??0)<=open+.05)continue;
    expect((l.delay??0)+(l.duration??cueDuration(l.cue)/(l.rate??1)),l.cue).toBeLessThanOrEqual(open+WHIFF_RECOVERY+.35+.000001);
   }
   expect(planCombatAudio(event(id,'whiff','ultimate',open+.05),awakened)).toHaveLength(0);
   expect(planCombatAudio(event(id,'confirm','ultimate',open+.02),awakened).filter(l=>l.bus==='voice')).toHaveLength(1);
  }
 });
 it.each(['akaito','kusushi','hakushi']as const)('%s schedules later ultimate sounds only on confirmation',id=>{
  const open=moveFor(id,'ultimate',false).contacts[0],cast=planSfx(event(id,'cast','ultimate'));
  expect(cast.length).toBeGreaterThan(0);expect(cast.every(l=>(l.delay??0)<=open+.05)).toBe(true);
  const confirmed=planSfx(event(id,'confirm','ultimate',open+.02));
  expect(confirmed.some(l=>(l.delay??0)>.3)).toBe(true);
  expect(planSfx(event(id,'whiff','ultimate',open+.05))).toEqual([]);
 });
 it.each(ids)('%s places its own chi release on the visible form swap',id=>{
  const layers=planCombatAudio(event(id,'awaken')),cue=id==='kusushi'?'fx-energy-hit-1':'fx-wind-blast',hit=layers.find(l=>l.cue===cue)!;
  expect(hit).toBeDefined();expect(Math.abs((hit.delay??0)+SFX_PEAKS[cue]/(hit.rate??1)-awakeningSwapAt(id))).toBeLessThan(.02);
  expect(layers.filter(l=>l.bus==='voice')).toHaveLength(1);expect(layers.every(l=>l.phase==='release')).toBe(true);
 });
});
