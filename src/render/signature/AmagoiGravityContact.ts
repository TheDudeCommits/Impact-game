/** What the engine asks of AmagoiGravity.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). AmagoiGravity.ts re-exports it. */

export function amagoiStrikeJoint(action:string,clip?:string,contactIndex=0):'LeftHand'|'RightHand'{
 if(action==='ultimate'&&(!clip||clip==='Ash Moon'))return contactIndex===0?'RightHand':'LeftHand';
 return ['Cloudburst','Calling Water','Rush 2','Rain Rebuff','Drawing Rain','Falling Sky'].includes(clip??'')||(!clip&&(action==='heavy'||action==='special'))?'LeftHand':'RightHand';
}
/** Frozen final-r12 receiver tip, measured in the actual exported RightHand frame. */
export const AMAGOI_RECEIVER_TIP=Object.freeze([-0.6008820533752441,-0.01629497855901718,0.40872931480407715]as const);
