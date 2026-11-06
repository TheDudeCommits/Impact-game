import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
/** All ice damage originates in accepted manual attacks; no damaging ice field. */
export const TOKAN_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Frostbite Cut',duration:.46,contacts:[.168],damage:20,range:2.85,radius:.78,stamina:11,cooldown:.46,stun:.34,knockback:3.4,lunge:4.4,style:'melee'},
 heavy:{name:'Sleet Heel',duration:.89,contacts:[.37],damage:65,range:2.8,radius:.86,stamina:27,cooldown:1.24,stun:.8,knockback:8.4,lunge:4.6,style:'melee',outcome:'launch'},
 special:{name:'Frostplume Flight',duration:1.45,contacts:[.7],damage:110,range:27,radius:1.08,stamina:34,cooldown:4.9,stun:.85,knockback:8.0,speed:27,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Winter Sleep',duration:3.9,contacts:[.46,1.4,3.0],schedule:[50,60,238],damage:50,finisherDamage:200,range:3.1,radius:1.1,stamina:0,cooldown:24,stun:1.2,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.8,close:6,style:'melee',guardBreak:true,confirm:{recovery:.57}},
};
export const TOKAN_COMBOS:ComboRow={lh:{name:'Icicle Thrust',range:2.9,radius:.86},llh:{name:'Snowdrift Rise',range:2.8,radius:.84},lllh:{name:'Floe Cleave',range:3.05,radius:.91},llls:{name:'Plume Follow-up',range:3.15,radius:1.0},airHeavy:{name:'Aerial Frostbite',range:2.95,radius:.9},airSpecial:{name:'Floe Descent',radius:3.5}};
export const TOKAN_CONTACTS={light:19/32,heavy:12/36,special:44/80,ultimate:(.8*19/32)/3.9,rush1:19/32,rush2:12/36,rush3:8/32,combos:{lh:22/43,llh:12/36,lllh:8/32,llls:44/80,airHeavy:8/32,airSpecial:18/41}}as const;
export const TOKAN_CLIPS={light:'Frostbite Cut',heavy:'Sleet Heel',special:'Frostplume Flight',ultimate:'Winter Sleep',awaken:'DEAD OF WINTER',idle:'_Idle',walk:'Walk',run:'Run',guard:'Block',victory:'Tokan Victory'}as const;
export const TOKAN_AWAKENING={name:'DEAD OF WINTER',clip:'DEAD OF WINTER',duration:1.95,entryDuration:.9,beats:{mask:.31,release:.58,settle:.8},manualOnly:true,canonScope:'Gameplay concentration using own sleep-mask and saber acting; no new transformation.'}as const;
export const TOKAN_CINEMATIC={opener:{clip:'Winter Sleep',at:(.8*19/32)/3.9},cine:{from:(.8*19/32)/3.9,at:(2.3+1.6*18/41)/3.9,windows:[[(.8*19/32)/3.9,2.3/3.9,(1+.95*12/36)/3.9],[2.3/3.9,1,(2.3+1.6*18/41)/3.9]]}}as const;
export type TokanArmVariant='Open'|'Closed';
const SABER=Object.freeze({left:'Open',right:'Closed',saber:true}as const),KICK=Object.freeze({left:'Open',right:'Closed',saber:false}as const),CAST=Object.freeze({left:'Open',right:'Open',saber:false}as const);
/** Use displayed clip plus drawn action clock; cache meshes, never traverse per frame. */
export function tokanMeshState(action:string,elapsed=0,clip?:string):Readonly<{left:TokanArmVariant;right:TokanArmVariant;saber:boolean}>{
 if(clip==='Floe Descent'||clip==='Plume Follow-up'||action==='special'||action==='ultimate'&&elapsed>=2.15)return CAST;
 // The native held saber intersects the raised leg: dissolve it for manual kicks.
 if(tokanStrikeJoint(action,elapsed,clip)==='LeftFoot')return KICK;
 return SABER;
}
/** Native combo_b is a LEFT kick; projectiles and ground freeze use RIGHT palm. */
export function tokanStrikeJoint(action:string,elapsed=0,clip?:string):'LeftFoot'|'RightHand'{
 if(clip==='Sleet Heel'||clip==='Rush 2'||clip==='Snowdrift Rise'||action==='heavy'&&!clip||action==='ultimate'&&elapsed>=.9&&elapsed<2.15)return 'LeftFoot';
 return 'RightHand';
}

/** Actual animated child weapon joint: do not approximate from the wrist. */
export const TOKAN_SABER_SOCKET={bone:'RHand_Weapon1_040',jointAlias:'TokanSaber',base:[-4.6583154555968065e-08, -0.029348600081278597, 0.06094278752389837] as const,tip:[-2.359993817035999e-07, 2.8975778887385673e-08, 2.280358785851126] as const}as const;
