import {matchMaker} from 'colyseus';
/** Public lobby discovery exposes only available public room ids and faction
 * counts. Private codes, identities and account information never leave here. */
export async function riftQueue(){
 const rooms=await matchMaker.query({name:'rift_war',private:false,locked:false});
 return rooms.filter(r=>r.metadata?.access==='quick').slice(0,100).map(r=>({roomId:r.roomId,heroes:Math.max(0,Math.min(5,r.metadata?.heroes??0)),villains:Math.max(0,Math.min(5,r.metadata?.villains??0))}));
}
