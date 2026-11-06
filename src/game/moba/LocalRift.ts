import {keptSkill} from '../../boot/skill';
import {requireReleasedFighter} from '../rosterAvailability';
import type {FighterId,GameSnapshot,PlayerInput} from '../types';
import {RIFT_STAGE} from './model';
import {snapshotFor,teamVision} from './vision';
import {RiftMatch} from './RiftMatch';
import {lockCombatOn} from '../lockMode';
import {SECOND} from '../couchSeat';
import {DeviceMatch} from '../economy/device';
/** Offline matches remain entirely on device, including economy and bots. A war played pays the account as other
 *  on-device matches do (economy/device.ts; 2 November 2026: Rift War pays): at the practice rate with bots, in full
 *  with a friend on the couch. */
export class LocalRift {
  readonly local=true;
  room:{send(type:string,payload?:unknown):void}|null=null;
  snapshot:GameSnapshot|null=null;
  receivedAt=0;
  predictionReady=false;
  paused=false;
  match:RiftMatch|null=null;
  onSnapshot:(snapshot:GameSnapshot)=>void=()=>{};
  onControlReset:()=>void=()=>{};
  onDisconnect:(message:string)=>void=()=>{};
  onNotice:(message:string)=>void=()=>{};
  /** Couch (couch/couch.ts): Player 2's seat, on their fighter's side - with Player 1 or against them - and their command
   *  for each tick (main.ts sets it). Player 2 shops for themself, in their own half of the split screen (couch/CouchHud.ts
   *  through `act`), as Player 1 does. */
  partner?:FighterId;
  second:()=>PlayerInput|undefined=()=>undefined;
  private generation=0;
  private rewards=new DeviceMatch();
  get id(){return this.match?'local-rift-fighter':'';}
  async connect(fighter:FighterId,name:string,round=1,partner?:FighterId){
    requireReleasedFighter(fighter);
    if(partner!==undefined)requireReleasedFighter(partner);
    await this.leave();this.partner=partner;const generation=this.generation,{createRapierCollision}=await import('../rapierCollision'),collision=await createRapierCollision(RIFT_STAGE);
    if(generation!==this.generation){collision.dispose?.();return;}
    this.match=new RiftMatch({collision,seed:Math.random()*0x7fffffff|0||1,access:'bots',round,lockCombat:lockCombatOn()});
    this.match.add(this.id,fighter,name);this.match.sim.setPlayerSkill(this.id,keptSkill());
    if(partner)this.match.add(SECOND,partner,'Player 2');
    this.match.start();this.paused=false;
    this.room={send:(type,payload)=>{const error=this.act(this.id,type,payload);if(error)this.onNotice(error);}};
    this.predictionReady=true;this.publish();
  }
  startPrivateMatch(){}
  send(input:PlayerInput){
    if(!this.match||this.paused)return;
    this.match.submit(this.id,input);this.rewards.input(input);
    if(this.partner){const other=this.second();if(other){this.match.submit(SECOND,other);this.rewards.partnerInput(other);}}
    this.match.step(1/60);this.publish();
  }
  /** One person's shop, recall, buyback or lane call: Player 1's through the room, Player 2's from their own half of a
   *  split screen (couch/CouchHud.ts). The refusal, if the match refused. */
  act(id:string,type:string,payload?:unknown):string|undefined{
    const match=this.match;if(!match)return undefined;let error:unknown;
    if(type==='rift-buy')error=match.buy(id,payload);else if(type==='rift-buyback')error=match.buyback(id);else if(type==='rift-recall')error=match.recall(id);else if(type==='rift-ping')error=match.ping(id,payload);
    this.publish();return typeof error==='string'?error:undefined;
  }
  private publish(){
    if(!this.match)return;
    const full=this.match.snapshot(true),mine=full.rift.seats.find(s=>s.id===this.id),theirs=full.rift.seats.find(s=>s.id===SECOND);
    this.rewards.observe(full,this.id,this.partner?SECOND:undefined);
    // Couch rivals on the two sides share one screen, each half looking at the other's army: the fog would hide each
    // from the other's half, so the battlefield is drawn whole; the minimap keeps Player 1's side's sight.
    this.snapshot=mine&&theirs&&mine.team!==theirs.team&&full.rift.phase==='active'?{...full,rift:{...full.rift,vision:{team:mine.team,circles:teamVision(full,mine.team)}}}:snapshotFor(full,this.id);
    this.receivedAt=performance.now();this.onSnapshot(this.snapshot);
  }
  async leave(){this.generation++;this.rewards.reset();this.partner=undefined;this.second=()=>undefined;this.match?.dispose();this.match=null;this.room=null;this.snapshot=null;this.receivedAt=0;this.predictionReady=false;this.paused=false;}
}
