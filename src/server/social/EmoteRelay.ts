import type {Client,Room} from 'colyseus';
import {ITEMS} from '../../game/economy/catalog';
import {sharedEconomy} from '../economy/api';
import type {RoomEconomy} from '../cluster/economyLink';

export const SOCIAL_PROTOCOL = 1;
/** One emote a second per player, as the co-op room has always allowed (SurvivalRoom). The page waits 1.1 s itself. */
export const EMOTE_GAP_MS = 1000;

export class EmoteRelay {
  private readonly listening=new Set<string>();
  private readonly tokens=new Map<string,unknown>();
  private readonly last=new Map<string,number>();
  constructor(private readonly room:Pick<Room,'onMessage'|'clients'>,private readonly economy:()=>RoomEconomy|undefined=sharedEconomy,private readonly now:()=>number=Date.now){
    room.onMessage('social',client=>{this.listening.add(client.sessionId);});
    room.onMessage('emote',(client,place:unknown)=>{this.relay(client,place);});
  }
  /** The account a seat plays as (the join's token, or the page's later `account` message). */
  bind(id:string,token:unknown){if(typeof token==='string')this.tokens.set(id,token);}
  leave(id:string){this.listening.delete(id);this.tokens.delete(id);this.last.delete(id);}
  /** Relayed (true) or refused: not an emote, not on the sender's wheel, or too soon after their last. */
  relay(client:Client,place:unknown):boolean{
    const id=client.sessionId,item=typeof place==='number'&&Number.isInteger(place)?ITEMS[place]:undefined,now=this.now();
    if(!item||item.kind!=='emote'||now-(this.last.get(id)??-Infinity)<EMOTE_GAP_MS)return false;
    const wheel=this.economy()?.book.find(this.tokens.get(id))?.worn.emotes;
    if(!wheel?.includes(item.id))return false;
    this.last.set(id,now);
    for(const other of this.room.clients)if(other.sessionId!==id&&this.listening.has(other.sessionId))other.send('emote',{id,place});
    return true;
  }
}
