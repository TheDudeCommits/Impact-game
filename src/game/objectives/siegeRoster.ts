import {ENEMIES} from '../../survival/enemies';
import {siegeChapter} from './siegeChapters';

/** Mode-local variants use the actor renderer and the shared combat kernel. */
const family=(id:string,name:string)=>({name,fodder:`siege-${id}-fodder`,gunner:`siege-${id}-gunner`,brute:`siege-${id}-brute`,specialists:{captain:`siege-${id}-captain`,medic:`siege-${id}-medic`,sapper:`siege-${id}-sapper`}});
export const SIEGE_ARMIES=[
 {name:'THE TRIBUNAL',fodder:'tribunal-guard',gunner:'tribunal-rifleman',brute:'tribunal-lieutenant',specialists:{captain:'tribunal-lieutenant',medic:'tribunal-guard',sapper:'tribunal-guard'}},
 family('raider','ASH RAIDERS'),family('wraith','CINDER WRAITHS'),family('imp','GLARE IMPS'),family('corsair','DUNE CORSAIRS'),family('lantern','LANTERN AGENTS'),family('sentinel','COURT SENTINELS'),family('puppet','HEX PUPPETS'),family('ghoul','SCRAP GHOULS'),family('knight','BARROW KNIGHTS'),family('thrall','GILDED THRALLS'),
];

export function siegeArmy(wave:number,seed=1){
  return SIEGE_ARMIES[siegeChapter(wave,seed).definition.army];
}

// Fail at startup if a shared kit changes, instead of silently dropping slots.
for(const army of SIEGE_ARMIES)for(const id of [army.fodder,army.gunner,army.brute]){
  if(!ENEMIES[id]?.model||!ENEMIES[id]?.moves.length)throw new Error(`Last Stand army has no playable kit: ${id}`);
}
