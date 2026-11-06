import fs from 'node:fs';
import {createHash}from 'node:crypto';
import {describe,expect,it}from 'vitest';
import {planCombatAudio,cueDuration}from '../src/audio/cuePlan';
import {planSfx}from '../src/audio/sfxPlan';
import {moveFor,awakeningSwapAt}from '../src/game/awakening';
import {SFX_PEAKS}from '../src/audio/sfxCues';
import type{CombatEvent}from '../src/game/types';
const event=(kind:CombatEvent['kind'],slot?:CombatEvent['slot'],castAge?:number):CombatEvent=>({id:91,kind,fighter:'barrow',slot,actorId:'a',serverTime:1,castAge});
describe('Barrow recorded voice and conditional cinematic sound',()=>{
 it.each([false,true])('only a confirmed ultimate schedules subsequent quake contacts (awakened=%s)',awakened=>{
  const open=moveFor('barrow','ultimate',awakened).contacts[0];
  expect(planSfx(event('cast','ultimate'),awakened).every(l=>(l.delay??0)<=open+.05)).toBe(true);
  expect(planCombatAudio(event('cast','ultimate'),awakened).filter(l=>l.bus==='voice')).toHaveLength(0);
  expect(planSfx(event('confirm','ultimate',open+.02),awakened).some(l=>(l.delay??0)>1)).toBe(true);
  expect(planCombatAudio(event('confirm','ultimate',open+.02),awakened).filter(l=>l.bus==='voice').map(l=>l.cue)).toEqual(['vo-barrow-liberation']);
  expect(planCombatAudio(event('whiff','ultimate',open+.05),awakened)).toEqual([]);
 });
 it('keeps the original strongest line above a quiet authored entry',()=>{
  const layers=planCombatAudio(event('awaken')),hit=layers.find(l=>l.cue==='fx-energy-hit-1')!;
  expect(layers.filter(l=>l.bus==='voice').map(l=>l.cue)).toEqual(['vo-barrow-strongest']);expect(hit.gain).toBeLessThanOrEqual(.18);
  expect(Math.abs((hit.delay??0)+SFX_PEAKS['fx-energy-hit-1']/(hit.rate??1)-awakeningSwapAt('barrow'))).toBeLessThan(.02);
 });
});
