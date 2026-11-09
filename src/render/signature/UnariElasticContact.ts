/** What the engine asks of UnariElastic.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). UnariElastic.ts re-exports it. */

/** Use the displayed native clip: heavy/third rush are left palms, while
 * the confirmed montage alternates hands and ends with a left release. */
export function unariStrikeJoint(action:string,clip?:string,contactIndex=0):'LeftHand'|'RightHand'{
 if(action==='ultimate'&&(!clip||clip==='AYATORI: Cat\'s Cradle'))return contactIndex%2?'LeftHand':'RightHand';
 if(clip==='Snag'||clip==='Rush 3'||clip==='Nosedive'||clip==='Tripwire'||action==='heavy'&&!clip)return 'LeftHand';
 return 'RightHand';
}
