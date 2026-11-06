import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

/** Hisame's fencing and ice commands require deliberate player input.
 * WHITEOUT: Glass Coffin is one confirmed cinematic attack, never a passive freeze field. */
export const HISAME_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Rime Thrust',duration:.43,contacts:[.152],damage:19,range:2.55,radius:.57,stamina:9,cooldown:.43,stun:.30,knockback:3.1,lunge:3.9,style:'melee'},
 heavy:{name:'Black Ice',duration:.94,contacts:[.4606],damage:62,range:2.75,radius:.78,stamina:24,cooldown:1.40,stun:.76,knockback:7.8,lunge:3.5,style:'melee',outcome:'launch',lift:5.6},
 special:{name:'Glacier Javelin',duration:1.24,contacts:[.7564],damage:114,range:28,radius:.86,stamina:33,cooldown:4.9,stun:.82,knockback:9.2,speed:30,style:'projectile',aimOnRelease:true},
 ultimate:{name:'WHITEOUT: Glass Coffin',duration:3.90,contacts:[.58,2.89],schedule:[59,254],damage:59,finisherDamage:231,range:2.9,radius:.95,stamina:0,cooldown:25,stun:1.35,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.8,close:5.9,style:'melee',guardBreak:true,confirm:{recovery:.52}},
};
export const HISAME_COMBOS:ComboRow={
 lh:{name:'Sleet Cut',range:2.6,radius:.64},
 llh:{name:'Borealis',range:2.7,radius:.77},
 lllh:{name:'Coup de Glace',range:2.8,radius:.66},
 llls:{name:'Hoarfrost',range:2.8,radius:.83},
 airHeavy:{name:'Crevasse',range:2.65,radius:.76},
 airSpecial:{name:'Chandelier',radius:3.0},
};
export const HISAME_CONTACTS={light:.44,heavy:.46,special:.61,ultimate:[.18,.80],rush:[.44,.44,.49],combos:{lh:.44,llh:.49,lllh:.44,llls:.61,airHeavy:.49,airSpecial:.53}}as const;
export const HISAME_AWAKENING={name:"POLAR NIGHT",clip:"POLAR NIGHT",sourceDuration:2.30,runtimeDuration:.9,beats:{mark:.31,cap:.57,coronation:.76,settle:.91},sameBody:true,manualOnly:true}as const;
/** Actual displayed native hand, not a generic right-hand caster fallback. */
export function hisameStrikeJoint(action:string,clip?:string):'LeftHand'|'RightHand'{if(clip)return clip==='Glacier Javelin'||clip==='Hoarfrost'?'LeftHand':'RightHand';return action==='special'?'LeftHand':'RightHand';}

/** Exact native Sword-local blade endpoint from the approved r11 deformed mesh. */
export const HISAME_RAPIER_TIP=[0.018809661860686555,0.9308132923244248,0.02438467202563288]as const;
