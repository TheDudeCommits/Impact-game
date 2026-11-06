import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
/** The player issues every receiver/gravity attack. No autonomous Six Paths,
 * damage aura, passive counter or lingering gravity-field damage. */
export const AMAGOI_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Rainrod Thrust',duration:.47,contacts:[.168],damage:20,range:2.75,radius:.80,stamina:10,cooldown:.47,stun:.35,knockback:3.2,lunge:3.2,style:'melee'},
 heavy:{name:'Cloudburst',duration:1,contacts:[.6],damage:65,range:3.35,radius:1.45,stamina:28,cooldown:1.84,stun:.85,knockback:9.5,lunge:1.4,style:'melee',outcome:'stagger'},
 special:{name:'Calling Water',duration:1.10,contacts:[.53],damage:106,range:19,radius:.88,stamina:33,cooldown:5.6,stun:.94,knockback:-8,speed:29,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Ash Moon',duration:3.8,contacts:[.54,1.37,2.10,3.08],schedule:[32,48,72,212],damage:32,finisherDamage:194,range:3.0,radius:1.08,stamina:0,cooldown:26,stun:.8,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.3,close:5.2,style:'melee',guardBreak:true,confirm:{recovery:.7}},
};
export const AMAGOI_COMBOS:ComboRow={lh:{name:'Rod Sweep',range:2.9,radius:.9},llh:{name:'Rain Rebuff',range:3.2,radius:1.2},lllh:{name:'Iron Rod Judgment',range:3.0,radius:1.05},llls:{name:'Drawing Rain',range:3.05,radius:1.0},airHeavy:{name:'Descending Rod',range:2.95,radius:.95},airSpecial:{name:'Falling Sky',radius:3.25}};
export const AMAGOI_CONTACTS={light:.30/.62,heavy:.61/1.12,special:.53/1.10,ultimate:[.54,1.37,2.10,3.08].map(t=>t/3.8),rush:[.30/.62,.61/1.12,.57],combos:{lh:.57,llh:.61/1.12,lllh:.57,llls:.53/1.10,airHeavy:.57,airSpecial:.61/1.12}}as const;
export const AMAGOI_AWAKENING={name:'IRON HALO',clip:'IRON HALO',duration:2.5,beats:{seal:.16,focus:.37,reveal:.60,judgement:.81},manualOnly:true,formSwap:false}as const;
