import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const HAWSER_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Fray',duration:.42,contacts:[.15],damage:16,range:2.6,radius:.55,stamina:8,cooldown:.4,stun:.23,knockback:3,lunge:5,style:'melee',reach:.978},
 heavy:{name:'Fuse Lance',duration:.95,contacts:[.42],damage:54,range:20,radius:1.1,stamina:24,cooldown:1.25,stun:.7,knockback:5,speed:38,style:'projectile',outcome:'hop'},
 special:{name:'Snap Line',duration:1.3,contacts:[.62],damage:106,range:3,radius:.8,stamina:30,cooldown:4.5,stun:1,knockback:6,lunge:9,guardBreak:true,style:'melee',chargeIn:2.8,dashThrough:true,outcome:'spin',reach:1.263},
 ultimate:{name:'Slipped Moorings',duration:2.2,contacts:[.42,.7,.82,.94,1.06,1.18,1.5],schedule:[41,14,14,14,14,14,363],damage:41,finisherDamage:85,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:.4,finisherKnockback:15,close:7,guardBreak:true,style:'melee',confirm:{recovery:.5},reach:1.085},
};
/** The Scout's light string after the first cut: Levin's reverse-quill, kick and rising blade (RUSH_SPECS, moves.ts). */
export const HAWSER_RUSH={names:['Twist Cut','Bootheel','Overhand Cut'],damage:[16,17,38],tempo:1,shape:'launch'}as const;
/** The YUGE's four: a straight, the uppercut that launches, the hardened fist driven through them into the wall,
 *  and the rampage (four blows, the last the hardest). Adult Hawser's Forward Will, Rising Rebellion, Freedom Drive and
 *  Advancing Rage, as they were. */
export const HAWSER_COLOSSUS_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Trunk Fist',duration:.44,contacts:[.168],damage:20,range:2.65,radius:.71,stamina:10,cooldown:.44,stun:.32,knockback:3,lunge:7,style:'melee'},
 heavy:{name:'Root Uppercut',duration:58/60,contacts:[58/60*.54],damage:65,range:2.8,radius:.84,stamina:26,cooldown:1.35,stun:.76,knockback:7.8,lunge:5.2,style:'melee',outcome:'launch',lift:4.7},
 special:{name:'Burl Fist',duration:1.25,contacts:[.725],damage:110,range:2.85,radius:.93,stamina:34,cooldown:4.8,stun:.83,knockback:9.6,lunge:8.5,close:5.6,style:'melee',outcome:'wallBounce'},
 ultimate:{name:'Timberfall',duration:4.2,contacts:[.56,1.38,2.32,3.46],schedule:[34,52,78,212],damage:34,finisherDamage:198,range:2.85,radius:1.02,stamina:0,cooldown:24,stun:1.14,finisherStun:1.4,knockback:0,finisherKnockback:14,lunge:6.3,close:6,style:'melee',guardBreak:true,confirm:{recovery:.6}},
};
/** The Colossus's light string after the first fist: every blow drives them back a stride, the last into the wall. */
export const HAWSER_COLOSSUS_RUSH={names:['Bough Hook','Timber Cross','Felling Blow'],damage:[24,34,48],tempo:1,shape:'carry'}as const;
/** The Colossus's area move, the uprooting, as the fighter's own was (src/engine/sim/areaMoves.json has the Scout's): the
 *  ground under the circle splits and the dust rides out over it (its look: `tectonic`, src/render/AreaTelegraph.ts). */
export const HAWSER_COLOSSUS_AREA={element:'earth',name:'The Uprooting',damage:224,radius:4.4,outcome:'knockdown',knockback:10,area:{telegraph:.85,look:'burst',anim:{clip:'Freedom Hammer'},voice:'vo-hawser-uprooting',ja:'地鳴らし'}}as const;
export const HAWSER_COLOSSUS_AREA_LOOK='tectonic';
/** That look in the uprooting's colours (client side: earth and dust, not the effect's own magma). */
export const HAWSER_COLOSSUS_AREA_FX={effect:HAWSER_COLOSSUS_AREA_LOOK,settings:{colorMagma:'#4a3a2c',colorEmber:'#d8b48a',colorHot:'#fff1dc'}}as const;
/** The six enders. The Scout's are Levin's (the template's moves, combos.ts) at nine tenths; the Colossus's are the fists'
 *  that were adult Hawser's, on the clock they had (the template's times his light's tempo then, .44 / .46). */
const T=.44/.46,colossus=(name:string,duration:number,contact:number,damage:number,own:Partial<MoveDefinition>)=>({name,duration:+(duration*T).toFixed(3),contacts:[+(contact*T).toFixed(3)],damage,...own});
export const HAWSER_COMBOS:ComboRow={
 lh:{name:'Cross Lay',damage:41},llh:{name:'Heave Cut',damage:36},lllh:{name:'Tripline',damage:58},llls:{name:'Lash Out',damage:49},airHeavy:{name:'Falling Fray',damage:43},airSpecial:{name:'Squib Burst',damage:63,radius:3.4},
 awakened:{lh:colossus('Knot Hook',.7,.28,46,{range:2.7,radius:.77}),llh:colossus('Root Launcher',.72,.27,40,{range:2.75,radius:.83}),lllh:colossus('Stump Hammer',.86,.36,64,{range:2.85,radius:.91}),llls:colossus('Windthrow',.9,.36,54,{range:2.9,radius:.96}),airHeavy:colossus('Falling Trunk',.62,.24,48,{range:2.8,radius:.91}),airSpecial:colossus('Root Stomp',.8,.22,70,{radius:3.35})},
};
/** How he wakes (client side): the hand bitten, lightning out of the sky, and the Colossus stands where he stood. */
export const HAWSER_AWAKENING={name:'YUGE',clip:'Freedom Awakens',duration:2.4,entryDuration:.9,beats:{handBite:.34,release:.66,settle:.91},formRevealFraction:.66,formClip:'YUGE Emergence',manualOnly:true,canonScope:'An arena-scaled 3.4 m YUGE body stands in place of the Scout. Only a manual awakening transforms; the Scout throws his own ultimate. No autonomous Colossus attacks or passive steam damage.'}as const;

/** Which blade lands each of the Scout's blows (the tip furthest ahead of him at the frame it lands, read off the fitted
 *  takes: scripts/roster-expansion/hawser_scout_kit.mts). */
const LEFT_BLADE:ReadonlySet<string>=new Set(['Fuse Lance','Rush 2']);
const WINGS=[.181,.406,.507,.608,.709,.81,.915]as const,WINGS_LEFT:ReadonlySet<number>=new Set([1,2,3]);
export function hawserBlade(clip:string,contactIndex?:number,sourceFraction=0):'LeftBlade'|'RightBlade'{
 if(clip==='Slipped Moorings'){let i=contactIndex;if(i===undefined){i=0;for(let k=1;k<WINGS.length;k++)if(sourceFraction>=(WINGS[k-1]+WINGS[k])/2)i=k;}return WINGS_LEFT.has(i)?'LeftBlade':'RightBlade';}
 return LEFT_BLADE.has(clip)?'LeftBlade':'RightBlade';
}
/** Which fist lands each of the Colossus's blows, by the clip its body plays (its file keeps adult Hawser's clip names). */
export function hawserTrunkFist(clip:string,contactIndex?:number,sourceFraction=0):'LeftHand'|'RightHand'{
 if(clip==='Advancing Rage'){const i=contactIndex??(sourceFraction<.23095238?0:sourceFraction<.44047619?1:sourceFraction<.68809524?2:3);return i===1?'LeftHand':'RightHand';}
 return clip==='Rising Rebellion'||clip==='Rush 1'||clip==='Rush 3'||clip==='Defiant Hook'||clip==='Rebel Uppercut'?'LeftHand':'RightHand';
}
/** Each blade's heel, tip and grip in its own joint's coordinates, metres (`LeftBlade`, `RightBlade`: the joints the blades
 *  are bound to, under his hands). The blades are Levin's two short swords, seated in his closed fists clip by clip: the grip is the
 *  joint's origin (the handle's middle), the heel where the blade leaves the guard, the tip its point, read off the blade
 *  meshes in the joints' frames. */
export const HAWSER_SWORD_SOCKETS={"LeftBlade":{"bone":"LeftBlade","tip":[-0.0315,0.7473,-0.0072],"heel":[-0.0065,0.095,-0.0016],"grip":[0,0,0]},"RightBlade":{"bone":"RightBlade","tip":[0.0256,0.7475,0.0064],"heel":[0.0052,0.095,0.0014],"grip":[0,0,0]}} as const;
/** The Colossus's knuckles: measured exact exported striking skin vertices in its native hand coordinates. */
export const HAWSER_COLOSSUS_KNUCKLES={"RightHand":[0.2155471577541368,0.0018955800906720888,-0.031404760125644415],"LeftHand":[0.20236690727864254,-0.023208751399481645,0.0354517831779454]} as const;
