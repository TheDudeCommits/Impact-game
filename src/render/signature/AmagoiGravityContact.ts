/** What the engine asks of AmagoiGravity.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). AmagoiGravity.ts re-exports it. */

export function amagoiStrikeJoint(action:string,clip?:string,contactIndex=0):'LeftHand'|'RightHand'{
 if(action==='ultimate'&&(!clip||clip==='Ash Moon'))return contactIndex===0?'RightHand':'LeftHand';
 return ['Cloudburst','Calling Water','Rush 2','Rain Rebuff','Drawing Rain','Falling Sky'].includes(clip??'')||(!clip&&(action==='heavy'||action==='special'))?'LeftHand':'RightHand';
}
/** The receiver rod's point in the RightHand joint's frame: the apex of the drawn spike, the rod seated in his fist once, the
 *  same in every clip (weapon_rod_R's keyed local transform), the fist round the shaft above its pommel cap. Measured on the
 *  exported body (the rod's skinned vertices carried through weapon_rod_R's inverse bind and keyed transform): on the drawn
 *  rod's point on every frame of every clip. */
export const AMAGOI_RECEIVER_TIP=Object.freeze([0.6294815671028392,0.6985699232843519,0.05673595040530666]as const);
