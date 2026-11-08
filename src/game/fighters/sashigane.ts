import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
/** Precision, manual ratio marks. Marks are contact presentation only. */
export const SASHIGANE_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Measured Cut',duration:.44,contacts:[.168],damage:20,range:2.55,radius:.62,stamina:10,cooldown:.46,stun:.31,knockback:3.1,lunge:4.3,style:'melee'},
 heavy:{name:'Golden Section',duration:.9,contacts:[.504],damage:65,range:2.9,radius:.76,stamina:27,cooldown:1.17,stun:.78,knockback:8.6,lunge:4.7,style:'melee',outcome:'wallBounce'},
 special:{name:'Condemned',duration:71/60,contacts:[71/60*.59],damage:112,range:3.3,radius:1.05,stamina:33,cooldown:4.5,stun:.85,knockback:9.2,lunge:4.2,style:'melee',guardBreak:true,outcome:'groundBounce'},
 ultimate:{name:'Final Inspection',duration:3.8,contacts:[.45,1.2,2.05,3.1],schedule:[37,45,55,242],damage:37,finisherDamage:189,range:2.9,radius:.95,stamina:0,cooldown:24,stun:1.1,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.8,close:6,style:'melee',guardBreak:true,confirm:{recovery:.6}},
};
export const SASHIGANE_COMBOS:ComboRow={lh:{name:'Cross Section',range:2.6,radius:.7},llh:{name:'Rising Section',range:2.65,radius:.76},lllh:{name:'Critical Load',range:2.9,radius:.82},llls:{name:'Load Failure',range:3.15,radius:1},airHeavy:{name:'Aerial Section',range:2.85,radius:.86},airSpecial:{name:'Dead Load Drop',radius:3.2}};
export const SASHIGANE_AWAKENING={name:'ZERO TOLERANCE',clip:'ZERO TOLERANCE Release',duration:1.7,entryDuration:.9,beats:{tie:.18,release:.378,settle:.603},manualOnly:true,canonScope:'Overtime release and deliberate tie gesture; same body, no new transformation.'}as const;
