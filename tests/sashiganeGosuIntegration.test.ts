import { PINNED_RELEASED, PINNED_ROSTER_PROTOCOL } from './rosterPin';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {FIGHTERS} from '../src/config';
import {MOVES} from '../src/game/moves';
import {AWAKENINGS} from '../src/game/awakening';
import {LABORATORY_FIGHTERS,RELEASED_FIGHTERS} from '../src/game/rosterAvailability';
import {ROSTER_PROTOCOL} from '../src/game/rosterProtocol';
import {factionOf,isBadBloodFighter} from '../src/game/objectives/model';
import {mayPlay} from '../src/game/economy/fighters';
import {ArenaSimulation} from '../src/game/simulation';
import {hasRosterSignature} from '../src/render/signature/RosterSignatureSet';
import {HOME_VOICES} from '../src/audio/HomeVoice';
import type {CombatEvent,FighterId,AttackSlot} from '../src/game/types';
import { fighterShown } from '../src/originals/launch';
const fighters=['sashigane','gosu']as const;
function match(fighter:FighterId,slot:AttackSlot|undefined,distance=2){
 const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,seed:97});
 sim.addPlayer('a',fighter,'A',false,{x:0,y:0,z:0});sim.addPlayer('b','taisei','B',false,{x:0,y:0,z:distance});sim.actors.get('a')!.state.ultimate=100;
 const events:CombatEvent[]=[];
 try{for(let i=0;i<300;i++){sim.submitInput('a',{seq:i+1,moveX:0,moveZ:0,yaw:0,targetId:distance<9?'b':null,attack:i===0?slot:undefined});sim.step(1/60);events.push(...sim.drainEvents());}return{events:events.filter(e=>e.actorId==='a'),z:sim.actors.get('a')!.state.z};}finally{sim.dispose();}
}
describe('Sashigane and Gosu reviewed release integration',()=>{
 it('preserves 69 released fighters/protocol v9 and admits reviewed fighters',()=>{
  expect(RELEASED_FIGHTERS).toHaveLength(PINNED_RELEASED);expect(ROSTER_PROTOCOL).toBe(PINNED_ROSTER_PROTOCOL);
  for(const id of fighters){expect(LABORATORY_FIGHTERS).not.toContain(id);expect(RELEASED_FIGHTERS as readonly string[]).toContain(id);expect(mayPlay(id,{items:{[`fighter-${id}`]:{at:0}}})).toBe(fighterShown(id));expect(mayPlay(id,undefined)).toBe(false);expect(hasRosterSignature(id)).toBe(true);expect(factionOf(id)).toBe('heroes');expect(isBadBloodFighter(id)).toBe(true);}
 });
 it.each(fighters)('%s registers exact current art, rig, voice and unique entry',id=>{
  for(const p of[FIGHTERS[id].model,FIGHTERS[id].portrait,...(fighterShown(id) ? [HOME_VOICES[id]!] : []),`/assets/ui/moves/${id}.webp`,`/assets/home/fighters/${id}.webp`])expect(fs.existsSync('public'+p),p).toBe(true);
  const manifest=JSON.parse(fs.readFileSync('public/assets/home/sprites/manifest.json','utf8')),row=manifest.fighters.find((r:{id:string})=>r.id===id);
  for(const[file,hash]of[['file','sha256'],['poster','posterSha256']]as const)expect(createHash('sha256').update(fs.readFileSync('public/assets/home/sprites/'+row[file])).digest('hex')).toBe(row[hash]);
  expect(row.frames).toHaveLength(row.frameCount??16);expect(AWAKENINGS[id].clips?.length).toBeGreaterThan(0);expect(MOVES[id].ultimate.duration-MOVES[id].ultimate.contacts.at(-1)!).toBeGreaterThanOrEqual(.6);
 });
 it.each(fighters)('%s deals its authored manual ultimate only after confirmation',id=>{
  const events=match(id,'ultimate').events,hits=events.filter(e=>e.kind==='hit'&&e.targetId==='b');expect(hits.map(e=>e.contactIndex)).toEqual(Array.from({length:id==='sashigane'?4:8},(_,i)=>i));expect(hits.reduce((n,e)=>n+(e.damage??0),0)).toBe(id==='sashigane'?300:290);
  for(const es of[match(id,undefined).events,match(id,'ultimate',18).events])expect(es.filter(e=>e.kind==='hit'||e.kind==='confirm')).toHaveLength(0);
 });
});
