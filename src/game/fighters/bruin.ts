import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

export const BRUIN_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Bearpaw Cut',duration:.47,contacts:[.168],damage:22,range:3.0,radius:.80,stamina:9,cooldown:.47,stun:.32,knockback:3.2,lunge:3.7,style:'melee'},
 heavy:{name:'Grizzly Thrust',duration:.93,contacts:[.56],damage:66,range:3.2,radius:.92,stamina:26,cooldown:1.22,stun:.72,knockback:9.4,lunge:4.2,style:'melee',outcome:'knockdown'},
 special:{name:'Night Prowl',duration:1.24,contacts:[.66],damage:116,range:26,radius:1.05,stamina:32,cooldown:4.9,stun:.82,knockback:9.6,speed:28,style:'projectile',outcome:'wallBounce',aimOnRelease:true},
 ultimate:{name:'Starless Cut',duration:3.5,contacts:[.52,1.22,1.94,2.78],schedule:[30,30,30,285],damage:30,finisherDamage:200,range:3.2,radius:1.08,stamina:0,cooldown:23,stun:.62,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.6,style:'melee',guardBreak:true,confirm:{recovery:.65}},
};
export const BRUIN_COMBOS:ComboRow={
 lh:{name:'Back-Blade Thump',range:3.0,radius:.84},llh:{name:'Back-Blade Sweep',range:3.05,radius:.9},lllh:{name:'Deep Woods Cut',range:3.15,radius:1.0},llls:{name:'Prowl Frenzy',range:3.2,radius:.86},airHeavy:{name:'Falling Bearpaw',range:3.05,radius:.95},airSpecial:{name:'Den Drop',radius:3.1},
};
export const BRUIN_AWAKENING={name:'WIDE AWAKE',clip:'WIDE AWAKE',duration:1.8,beats:{shoulder:.23,resolve:.46,draw:.69},manualOnly:true,formSwap:false}as const;
