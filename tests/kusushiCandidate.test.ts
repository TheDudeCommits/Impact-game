import { describe,expect,it } from 'vitest';
import {KUSUSHI_MOVES,KUSUSHI_CONTACTS,kusushiStrikeSocket,kusushiAuthoredKick}from '../src/game/fighters/kusushi';
// Kusushi fights in his own bodies (kusushi-tr1.glb, kusushi-form-tr1.glb); his kit's own tables are held here.
describe('Kusushi candidate kit',()=>{
 it('selects the authored limb for the rush, the branches and the ultimate\'s last contact',()=>{expect(kusushiStrikeSocket('ultimate',0,'Bet the Purse',2)).toBe('RightFoot');expect(kusushiAuthoredKick('heavy',.4,'Rib Breaker')).toBe(false);expect(kusushiAuthoredKick('light',.3,'Crushing Heel')).toBe(true);expect(kusushiAuthoredKick('ultimate',2,'Bet the Purse')).toBe(true);expect(kusushiAuthoredKick('ultimate',.5,'Bet the Purse')).toBe(false)});
 it('confirms an authored290 ultimate in both combat paths',()=>{const m=KUSUSHI_MOVES.ultimate;expect(m.damage*2+m.finisherDamage!).toBe(290);expect(m.schedule!.reduce((s,d,i)=>s+Math.round(d*(1-.09*i)),0)).toBe(290);expect(m.confirm).toBeDefined();m.contacts.forEach((c,i)=>expect(c).toBeCloseTo(KUSUSHI_CONTACTS.ultimate[i]*m.duration))});
});
