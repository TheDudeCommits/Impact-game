import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

export const AQUILO_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Swallow Darts',duration:.43,contacts:[.152],damage:19,range:2.4,radius:.70,stamina:10,cooldown:.41,stun:.30,knockback:3.2,lunge:4.4,style:'melee'},
 heavy:{name:'Forktail Gust',duration:.96,contacts:[.5376],damage:65,range:2.8,radius:.95,stamina:27,cooldown:1.33,stun:.73,knockback:8.6,lunge:3.8,style:'melee',outcome:'knockdown'},
 special:{name:'Skimming Swallow',duration:1.05,contacts:[.546],damage:114,range:27,radius:1.05,stamina:33,cooldown:4.7,stun:.78,knockback:9.0,speed:30,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Great Migration',duration:3.5,contacts:[.56,1.645,2.8],schedule:[38,54,247],damage:38,finisherDamage:214,range:2.9,radius:1.08,stamina:0,cooldown:23.5,stun:.88,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.0,close:5.2,style:'melee',guardBreak:true,confirm:{recovery:.56}},
};
export const AQUILO_COMBOS:ComboRow={lh:{name:'Swallowtail Cross',range:2.45,radius:.74},llh:{name:'Rising Swallow',range:2.6,radius:.84},lllh:{name:'Squall Breaker',range:2.7,radius:.9},llls:{name:'Darting Flock',range:2.7,radius:.9},airHeavy:{name:'Falling Swallow',range:2.7,radius:.88},airSpecial:{name:'Downdraft',radius:3.3}};
export const AQUILO_AWAKENING={name:'WINDBORNE',clip:'WINDBORNE',duration:2.15,beats:{seal:.162,stillness:.369,reveal:.522,resolve:.711},manualOnly:true,formSwap:false}as const;
/** Which hand a blow leaves from, as the carried set throws it (Minase's: the right leads, the palm moves the left). */
export function aquiloStrikeSide(action:string,clip?:string):'Right'|'Left'{
 if(clip)return ['Forktail Gust','Rush 2','Rush 3','Downdraft'].includes(clip)?'Left':'Right';
 return action==='heavy'?'Left':'Right';
}
