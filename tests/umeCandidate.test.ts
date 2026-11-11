import { describe,expect,it } from 'vitest';
import {UME_MOVES,UME_CONTACTS,umeStrikeSide}from '../src/game/fighters/ume';
// Ume fights in her own body; her kit's own tables are held here.
describe('Ume candidate kit',()=>{
 it('selects the authored hand at each manual contact',()=>{for(const[name,action,index,expected]of [['Rush 1','light',undefined,'Left'],['Magnolia Backfist','heavy',undefined,'Left'],['Rush 2','light',undefined,'Right'],['Magnolia Meteor','ultimate',0,'Right'],['Magnolia Meteor','ultimate',1,'Left'],['Magnolia Meteor','ultimate',2,'Both']]as const)expect(umeStrikeSide(action,0,name,index),name).toBe(expected)});
 it('confirms an authored290 ultimate in both combat paths',()=>{const m=UME_MOVES.ultimate;expect(m.damage*2+m.finisherDamage!).toBe(290);expect(m.schedule!.reduce((s,d,i)=>s+Math.round(d*(1-.09*i)),0)).toBe(290);expect(m.confirm).toBeDefined();m.contacts.forEach((c,i)=>expect(c).toBeCloseTo(UME_CONTACTS.ultimate[i]*m.duration))});
});
