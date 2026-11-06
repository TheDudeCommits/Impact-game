import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
/** Each bloom belongs to one manual action. No persistent limb actor, automatic
 * follow-up, passive summon damage, healing or independently attacking clone. */
export const PSYCHE_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Moth Palm',duration:.46,contacts:[.168],damage:21,range:2.7,radius:.70,stamina:10,cooldown:.43,stun:.32,knockback:3.4,lunge:2.8,style:'melee'},
 heavy:{name:'Clasping Wings',duration:1,contacts:[.571],damage:65,range:3.0,radius:.91,stamina:29,cooldown:1.39,stun:.82,knockback:7.7,lunge:2.6,style:'melee',outcome:'knockdown'},
 special:{name:'Ruin Palm',duration:1.18,contacts:[.6844],damage:116,range:20,radius:1.06,stamina:35,cooldown:4.9,stun:.8,knockback:10,speed:23,style:'projectile'},
 ultimate:{name:'Silk Cocoon',duration:3.75,contacts:[.52,1.6125,3.075],schedule:[35,66,238],damage:35,finisherDamage:220,range:3.15,radius:1.08,stamina:0,cooldown:24,stun:.92,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:3.6,close:5.2,style:'melee',guardBreak:true,confirm:{recovery:.60}},
};
export const PSYCHE_COMBOS:ComboRow={lh:{name:'Wing Twist',range:2.9,radius:.84},llh:{name:'Rising Swarm',range:2.85,radius:.87},lllh:{name:'Grasping Swarm',range:3.05,radius:.98},llls:{name:'Swarm Push',range:3.15,radius:1.0},airHeavy:{name:'Aerial Wing',range:2.95,radius:.92},airSpecial:{name:'Moth Descent',radius:3.5}};
export const PSYCHE_AWAKENING={name:'VIOLET SWARM',clip:'VIOLET SWARM',sourceDuration:2.3,entryDuration:.9,release:.486,manualOnly:true,kind:'aura'}as const;
/** The body gestures with crossed wrists; the manually grown limb owns the
 * physical endpoint. Casting from the body uses a stable wrist midpoint. */
export function psycheClutch(clip?:string):boolean{return !!clip&&/Clutch|Twist|Hold/.test(clip);}
