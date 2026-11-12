import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {FIGHTERS} from '../src/config';
import {MOVES} from '../src/game/moves';
import {AWAKENINGS} from '../src/game/awakening';
import {ArenaSimulation} from '../src/game/simulation';
import type {CombatEvent,PlayerInput} from '../src/game/types';
import {RELEASED_FIGHTERS,LABORATORY_FIGHTERS} from '../src/game/rosterAvailability';
import {mayPlay} from '../src/game/economy/fighters';
import {factionOf,isBadBloodFighter} from '../src/game/objectives/model';
import {planVoice} from '../src/audio/voicePlan';
import {homeRosterPages} from '../src/ui/HomeRosterOrder';

function run(command:Partial<PlayerInput>,z=2,awakened=false){
 const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,seed:94});
 sim.addPlayer('a','yodaka','A',false,{x:0,y:0,z:0});sim.addPlayer('b','minase','B',false,{x:0,y:0,z});
 const a=sim.actors.get('a')!.state;a.ultimate=100;if(awakened){a.awakened=true;a.awakenedUntil=100;}
 const events:CombatEvent[]=[];
 try {for(let i=0;i<360;i++){sim.submitInput('a',{seq:i+1,moveX:0,moveZ:0,yaw:0,...(i===0?command:{})});sim.step(1/60);events.push(...sim.drainEvents());}return{events,hits:events.filter(e=>e.kind==='hit'&&e.actorId==='a')};}finally{sim.dispose();}
}
describe('Yodaka reviewed manual kit',()=>{
 it('admits the reviewed flame swordsman in the ordinary homepage and Heroes modes',()=>{
  expect(RELEASED_FIGHTERS).toContain('yodaka');expect(LABORATORY_FIGHTERS).not.toContain('yodaka');
  expect(mayPlay('yodaka',{items:{'fighter-yodaka':{at:0}}})).toBe(true);expect(mayPlay('yodaka',undefined)).toBe(false);expect(isBadBloodFighter('yodaka')).toBe(true);expect(factionOf('yodaka')).toBe('heroes');
  expect(homeRosterPages(RELEASED_FIGHTERS).flatMap(p=>p.fighters)).toContain('yodaka');
  expect(homeRosterPages([...RELEASED_FIGHTERS,...LABORATORY_FIGHTERS]).flatMap(p=>p.fighters)).toContain('yodaka');
  expect(FIGHTERS.yodaka.formModel).toBeUndefined();expect(AWAKENINGS.yodaka.name).toBe('BURNING STAR');
 });
 it('has no aura, status or autonomous damage and missed Nighthawk Star never confirms',()=>{
  for(const move of Object.values(MOVES.yodaka))expect(move.status).toBeUndefined();
  expect(run({},2,true).hits).toHaveLength(0);
  const miss=run({attack:'ultimate'},24);expect(miss.hits).toHaveLength(0);expect(miss.events.some(e=>e.kind==='confirm')).toBe(false);
 });
 it('lands its own confirmed four-contact290 schedule',()=>{
  expect(run({attack:'ultimate',targetId:'b'}).hits.map(e=>e.damage)).toEqual([41,52,60,137]);
 });
 it('manual Fire Owl warns then strikes exactly once at the aimed point',()=>{
  const {events,hits}=run({attack:'area',aim:{x:0,z:8}},8);
  const release=events.find(e=>e.kind==='release'&&e.slot==='area')!;
  const impacts=events.filter(e=>e.kind==='impact'&&e.slot==='area');
  expect(release.endpoint).toMatchObject({x:0,z:8});expect(impacts).toHaveLength(1);
  expect(impacts[0].serverTime-release.serverTime).toBeGreaterThanOrEqual(1.85-1/60);
  expect(hits.map(e=>e.damage)).toEqual([204]);
  expect(run({attack:'area',aim:{x:8,z:8}},8).hits).toHaveLength(0);
 });
});
