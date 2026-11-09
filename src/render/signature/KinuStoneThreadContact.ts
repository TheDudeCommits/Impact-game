/** What the engine asks of KinuStoneThread.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). KinuStoneThread.ts re-exports it. */

export function kinuStrikeJoint(action: string, clip?: string, index = 0): 'RightHand' | 'LeftHand' {
  if ((action === 'ultimate' && (!clip || clip === 'Broken Shackles')) || (action === 'special' && (!clip || clip === 'BUCHI BUCHI Barrage'))) return index % 2 ? 'LeftHand' : 'RightHand';
  if (['Reeling Hook', 'Rush 3', 'Whip Stitch', 'Jailbreak Slam', 'Descending Spool', 'Shackle Crash'].includes(clip ?? '')) return 'LeftHand';
  return action === 'heavy' && !clip ? 'LeftHand' : 'RightHand';
}
