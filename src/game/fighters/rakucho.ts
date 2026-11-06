import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
/** Body strikes and four Tendrils attacks are all deliberate player commands. */
export const RAKUCHO_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Torn Page',duration:.47,contacts:[.168],damage:20,range:2.25,radius:.77,stamina:10,cooldown:.47,stun:.35,knockback:3.4,lunge:11.5,style:'melee'},
 heavy:{name:'Ribbon Lash',duration:1.01,contacts:[.59],damage:65,range:3.6,radius:1.12,stamina:28,cooldown:1.87,stun:.85,knockback:7.8,lunge:2.6,style:'melee',outcome:'stagger'},
 special:{name:'Four Bookmarks',duration:1.24,contacts:[.62],damage:108,range:3.9,radius:1.18,stamina:34,cooldown:5.6,stun:1.02,knockback:8.4,lunge:5.2,style:'melee',guardBreak:true},
 ultimate:{name:'Last Chapter',duration:3.75,contacts:[.50,1.20,1.95,3.02],schedule:[24,57,84,199],damage:24,finisherDamage:218,range:2.8,radius:1.03,stamina:0,cooldown:26,stun:.8,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.4,close:5.1,style:'melee',guardBreak:true,confirm:{recovery:.7}},
};
export const RAKUCHO_COMBOS:ComboRow={lh:{name:'Ribbon Hook',range:3.5,radius:1.0},llh:{name:'Silverfish Cross',range:3.5,radius:1.05},lllh:{name:'Shredded Chapter',range:3.8,radius:1.12},llls:{name:'Hungry Lunge',range:3.8,radius:1.10},airHeavy:{name:'Ribbon Descent',range:3.4,radius:1.1},airSpecial:{name:'Red Ink Break',radius:3.3}};
export const RAKUCHO_CONTACTS={light:.28/.60,heavy:.59/1.08,special:.62/1.24,ultimate:[.50,1.20,1.95,3.02].map(t=>t/3.75),rush:[.28/.60,.59/1.08,.62/1.24],combos:{lh:.59/1.08,llh:.59/1.08,lllh:.62/1.24,llls:.62/1.24,airHeavy:.59/1.08,airSpecial:.62/1.24}}as const;
export const RAKUCHO_AWAKENING={name:'STARVING',clip:'STARVING',duration:2.3,beats:{handRise:.21,fingerCrack:.36,eyeReveal:.47,tendrilsFlare:.70},manualOnly:true,formSwap:true}as const;
