import type {Client,Room} from 'colyseus';
import type {AgainView} from '../../game/types';

export class RoomAgain {
  /** The room's matches so far: the first is 1. */
  match=1;
  private readonly ins=new Set<string>();
  constructor(room:Pick<Room,'onMessage'>,private readonly host:()=>string|null,private readonly over:()=>boolean,
    /** Starts the next match with these players (arena ids); a refusal's words, else nothing. */
    private readonly next:(players:string[])=>string|undefined,
    /** Someone said they are in: the finished room's wait starts again, so the host has the whole of it to answer. */
    private readonly heard:()=>void=()=>{}){
    room.onMessage('room-again',client=>this.press(client));
  }
  /** PLAY AGAIN on the results: in, and for the host, the next match. Refused (a notice to the presser) when it cannot be. */
  press(client:Client){
    if(!this.over())return;
    const id=client.sessionId;
    if(!this.ins.has(id)){this.ins.add(id);this.heard();}
    if(id!==this.host())return;
    if(this.ins.size<2){client.send('notice',{message:'Waiting for a friend to press NEXT MATCH.'});return;}
    const refused=this.next([...this.ins]);
    if(refused){client.send('notice',{message:refused});return;}
    this.ins.clear();this.match++;
  }
  leave(id:string){this.ins.delete(id);}
  view():AgainView{return {ids:this.over()?[...this.ins]:[],match:this.match};}
}
