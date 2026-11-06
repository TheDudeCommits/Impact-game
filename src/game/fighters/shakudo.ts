import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

/** Alchemy is manually commanded; constructs never attack independently. */
export const SHAKUDO_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Rivet',duration:.45,contacts:[.168],damage:22,range:2.65,radius:.79,stamina:12,cooldown:.45,stun:.36,knockback:3.5,lunge:4.6,style:'melee'},
 heavy:{name:'Hot Edge',duration:1,contacts:[.55],damage:65,range:2.95,radius:.94,stamina:28,cooldown:1.21,stun:.83,knockback:8,lunge:4.5,style:'melee',outcome:'knockdown'},
 special:{name:'Bedrock Pike',duration:1.4,contacts:[.72],damage:118,range:27,radius:1.06,stamina:36,cooldown:5,stun:.84,knockback:9,speed:27,style:'projectile',aimOnRelease:true},
 ultimate:{name:'TANREN: White Heat',duration:4.08,contacts:[.56,1.63,3.3],schedule:[45,72,231],damage:45,finisherDamage:210,range:3.05,radius:1.1,stamina:0,cooldown:24,stun:1.1,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.6,close:6,style:'melee',guardBreak:true,confirm:{recovery:.58}},
};
export const SHAKUDO_COMBOS:ComboRow={lh:{name:'Swage',range:2.8,radius:.86},llh:{name:'Upset',range:2.9,radius:.92},lllh:{name:'Drop Forge',range:3.05,radius:1.02},llls:{name:'Stone Breaker',range:3.1,radius:1.05},airHeavy:{name:'Anvil Drop',range:2.9,radius:.94},airSpecial:{name:'Slag Fall',radius:3.5}};
export const SHAKUDO_AWAKENING={name:'KUROGANE',clip:'KUROGANE',duration:1.8,entryDuration:.9,beats:{wristCheck:.20,clap:.43,transmute:.64,bladeRevealStart:.70,bladeReady:.84},manualOnly:true,canonScope:'An authored resolve and forearm-blade transmutation sequence, not a new transformation.'}as const;
/** Native blade retracts for fist/clap/ground-palms, and emerges only for authored cuts. */
export function shakudoBladeVisible(clip:string,time:number,awakened=false):boolean{
 if(clip==='KUROGANE')return time>=1.8*.70;
 if(clip==='TANREN: White Heat')return time>.88&&time<2.04;
 if(clip==='Hot Edge'||clip==='Drop Forge')return true;
 if(clip==='Bedrock Pike'||clip==='Stone Breaker'||clip==='Slag Fall')return false;
 return awakened&&(clip==='_Idle'||clip==='Walk'||clip==='Run'||clip==='Dash'||clip==='Shakudo Victory');
}
