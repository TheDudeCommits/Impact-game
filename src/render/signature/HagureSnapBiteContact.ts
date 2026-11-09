/** What the engine asks of HagureSnapBite.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). HagureSnapBite.ts re-exports it. */

/** Explicit native strike side; selected combo clip overrides generic slot. */
export function hagureStrikeJoint(action:string,clip?:string,contactIndex=0):'LeftHand'|'RightHand'{
 if(action==='ultimate'&&(!clip||clip==='Pack of One'))return contactIndex%2?'LeftHand':'RightHand';
 if(['Mauling Palm','Rush 2','Turnaside Hand','Falling Maul'].includes(clip??''))return'LeftHand';
 if(action==='heavy'&&!clip)return'LeftHand';
 return'RightHand';
}
