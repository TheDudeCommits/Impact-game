import {afterEach,describe,it,expect}from'vitest';
import fs from'node:fs';
import {FIGHTERS}from'../src/config';
import {MOVES}from'../src/game/moves';
import {AWAKENINGS}from'../src/game/awakening';
import {LABORATORY_FIGHTERS,RELEASED_FIGHTERS,isReleasedFighter}from'../src/game/rosterAvailability';
import {mayPlay}from'../src/game/economy/fighters';
import {ArenaSimulation}from'../src/game/simulation';
import {hasRosterSignature}from'../src/render/signature/RosterSignatureSet';
import {planVoice,resetVoiceMemory}from'../src/audio/voicePlan';
import {HOME_VOICES}from'../src/audio/HomeVoice';
import type {CombatEvent,FighterId}from'../src/game/types';
import { fighterShown } from '../src/originals/launch';
const fighters=['oyashio','adad']as const;
import { ORIGINALS } from '../src/originals/roster';
afterEach(resetVoiceMemory);
function match(fighter:FighterId,whiff=false){const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,seed:91});sim.addPlayer('a',fighter,'A',false,{x:0,y:0,z:0});sim.addPlayer('b','taisei','B',false,{x:0,y:0,z:whiff?18:2});sim.actors.get('a')!.state.ultimate=100;const events:CombatEvent[]=[];try{for(let i=0;i<300;i++){sim.submitInput('a',{seq:i+1,moveX:0,moveZ:0,yaw:0,targetId:whiff?null:'b',attack:i===0?'ultimate':undefined});sim.step(1/60);events.push(...sim.drainEvents());}return events;}finally{sim.dispose();}}
describe('Oyashio and Adad laboratory integration',()=>{
 it.skipIf(!!ORIGINALS.adad)('admits both reviewed fighters',()=>{expect(RELEASED_FIGHTERS).toHaveLength(84);expect(LABORATORY_FIGHTERS).not.toContain('oyashio');expect(isReleasedFighter('oyashio')).toBe(true);expect(mayPlay('oyashio',undefined)).toBe(true);expect(LABORATORY_FIGHTERS).not.toContain('adad');expect(isReleasedFighter('adad')).toBe(true);expect(mayPlay('adad',undefined)).toBe(true);for(const id of fighters)expect(hasRosterSignature(id)).toBe(true);});
 it.each(fighters)('%s has exact runtime, homepage and awakening resources',id=>{const f=FIGHTERS[id];for(const path of[f.model,f.portrait,`/assets/ui/moves/${id}.webp`,`/assets/home/fighters/${id}.webp`,`/assets/home/sprites/${id}.webp`,`/assets/home/sprites/${id}-poster.webp`,...(fighterShown(id) ? [HOME_VOICES[id]!] : [])])expect(fs.existsSync('public'+path),path).toBe(true);expect(f.moves).toHaveLength(4);expect(f.clips).toHaveLength(4);expect((AWAKENINGS[id].clips??[]).length).toBeGreaterThan(0);expect(MOVES[id].ultimate.confirm).toBeDefined();});
 it.each(fighters)('%s confirms only the manual ultimate and preserves its nominal budget',id=>{const hits=match(id).filter(e=>e.actorId==='a'&&e.kind==='hit'&&e.targetId==='b');expect(hits.map(e=>e.contactIndex)).toEqual([0,1,2]);expect(hits.reduce((n,e)=>n+(e.damage??0),0)).toBe(id==='oyashio'?300:290);expect(match(id,true).filter(e=>e.actorId==='a'&&(e.kind==='hit'||e.kind==='confirm'))).toHaveLength(0);});
 it('does not relabel Adad dialogue as rapid-fire efforts',()=>{const cues:string[]=[];for(let i=0;i<100;i++){const event={id:i+1,kind:'cast',fighter:'adad',actorId:'adad',slot:'light',serverTime:10+i*.6,actionSeq:i+1,rushIndex:0}as CombatEvent;cues.push(...planVoice(event).map(x=>x.cue));}expect(cues.every(c=>c==='vo-adad-enough')).toBe(true);expect(cues.length).toBeLessThan(8);});
});
