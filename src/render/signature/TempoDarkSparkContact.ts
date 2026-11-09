/** What the engine asks of TempoDarkSpark.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). TempoDarkSpark.ts re-exports it. */

/** Base jab is left; authored rush/air/ender clips all strike with the right.
 * The confirmed Eightfold montage alternates R/L and finishes on the left. */
export function tempoStrikeJoint(action:string,clip?:string,contactIndex=0):'LeftHand'|'RightHand'{
 if(clip==='Street Jab'||action==='light'&&!clip)return 'LeftHand';
 if(action==='ultimate'&&(!clip||clip==='Perfect Timing'))return contactIndex%2?'LeftHand':'RightHand';
 return 'RightHand';
}
