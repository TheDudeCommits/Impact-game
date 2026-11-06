import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
/** Player-commanded pressure gestures. No autonomous controlled units, passive
 * contract retaliation or field ticks; the renderer never owns damage. */
export const KUBIWA_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Baton Flick',duration:.47,contacts:[.168],damage:21,range:2.6,radius:.8,stamina:9,cooldown:.47,stun:.32,knockback:3.3,lunge:3.3,style:'melee'},
 heavy:{name:'Crescendo',duration:1.01,contacts:[.61],damage:65,range:2.85,radius:.95,stamina:26,cooldown:1.49,stun:.88,knockback:5.4,lunge:2.3,style:'melee',outcome:'stagger'},
 special:{name:'Cue',duration:1.15,contacts:[.52],damage:112,range:25,radius:.82,stamina:34,cooldown:5.5,stun:.91,knockback:10.5,speed:38,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Final Bar',duration:3.55,contacts:[.58,1.24,2.03,2.82],schedule:[30,50,70,215],damage:30,finisherDamage:200,range:2.95,radius:1.05,stamina:0,cooldown:25,stun:.8,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.3,close:5.0,style:'melee',guardBreak:true,confirm:{recovery:.7}},
};
export const KUBIWA_COMBOS:ComboRow={lh:{name:'Hold',range:2.8,radius:.9},llh:{name:'Beckon',range:2.85,radius:.9},lllh:{name:'Diminuendo',range:2.95,radius:1.05},llls:{name:'Accent',range:3.05,radius:1.02},airHeavy:{name:'Descending Scale',range:2.85,radius:.95},airSpecial:{name:'Pianissimo',radius:3.1}};
export const KUBIWA_CONTACTS={light:.24/.54,heavy:.63/1.08,special:.52/1.15,ultimate:[.58,1.24,2.03,2.82].map(t=>t/3.55),rush:[.24/.54,.53,.59],combos:{lh:.59,llh:.53,lllh:.63/1.08,llls:.52/1.15,airHeavy:.59,airSpecial:.63/1.08}}as const;
export const KUBIWA_AWAKENING={name:'CONDUCTOR',clip:'The CONDUCTOR',duration:2.2,beats:{tie:.17,clasp:.4,reveal:.63,command:.84},manualOnly:true,formSwap:false}as const;
