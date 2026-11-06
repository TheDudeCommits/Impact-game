import {keptSkill} from '../../boot/skill';
import {requireReleasedFighter} from '../rosterAvailability';
import type {FighterId,GameSnapshot,PlayerInput,StageId} from '../types';
import {placeForStart} from '../stageChoice';
import {ObjectiveMatch} from './ObjectiveMatch';
import {OBJECTIVE_STAGE,type ObjectiveKind} from './model';
import {DeviceMatch} from '../economy/device';
import {lockCombatOn} from '../lockMode';
import {SECOND} from '../couchSeat';

/** Solo and bot operations use the same authority as rooms, without a socket. The finished operation is reported for
 *  pay (economy/device.ts), and the account's server pays it within its caps. */
export class LocalObjective {
  readonly local=true;
  room:{send(type:string,payload?:unknown):void}|null=null;
  snapshot:GameSnapshot|null=null;receivedAt=0;predictionReady=false;paused=false;
  match:ObjectiveMatch|null=null;
  onSnapshot=(_snapshot:GameSnapshot)=>{};onControlReset=()=>{};onDisconnect=(_reason:string)=>{};onNotice=(_message:string)=>{};
  private generation=0;
  private rewards=new DeviceMatch();
  get id(){return this.match?'local-defender':'';}
  /** Couch (couch/couch.ts): Player 2's seat - a defender beside Player 1 in Last Stand; in Bad Blood on their fighter's
   *  side, with Player 1 or against them - and their command for each tick (main.ts sets it). Player 1's result pays the
   *  device's account, as a match with a friend once Player 2 has played too (economy/device.ts). */
  partner?:FighterId;
  second:()=>PlayerInput|undefined=()=>undefined;
  /** `place`: Bad Blood's arena as the player named it on the sheet (none, RANDOM, deals one of its places; Last Stand's village is fixed). */
  async connect(fighter:FighterId,name:string,kind:ObjectiveKind,access:'solo'|'bots',round=1,place?:StageId,partner?:FighterId){
    requireReleasedFighter(fighter);
    if(partner!==undefined)requireReleasedFighter(partner);
    await this.leave();const generation=this.generation;this.partner=partner;
    // (As ObjectiveRoom's placeNamed does for a hosted room: the match is built, then moved to the arena named.)
    const stage=kind==='bad-blood'?placeForStart(place,'bad-blood','offline')??OBJECTIVE_STAGE[kind]:OBJECTIVE_STAGE[kind];
    const {createRapierCollision}=await import('../rapierCollision'),collision=await createRapierCollision(stage);
    if(generation!==this.generation){collision.dispose?.();return;}
    const match=new ObjectiveMatch(kind,collision,Math.floor(Math.random()*2147483646)+1,access,round,undefined,lockCombatOn());
    if(match.sim.stage!==stage)match.sim.setStage(stage);
    this.match=match;match.add(this.id,fighter,name);match.sim.setPlayerSkill(this.id,keptSkill());
    if(partner)match.add(SECOND,partner,'Player 2');
    match.start();
    this.room={send:(type,payload)=>{if(type==='objective-buy'){const error=this.buy(this.id,payload);if(error)this.onNotice(error);}}};
    this.predictionReady=true;this.publish();
  }
  /** A purchase at the quartermaster for one person: Player 1's through the room, Player 2's from their own half of a split
   *  screen (couch/CouchHud.ts). The refusal, if the match refused. */
  buy(id:string,item:unknown):string|undefined{const match=this.match;if(!match)return undefined;const error=match.buy(id,item);this.publish();return error||undefined;}
  send(input:PlayerInput){if(!this.match)return false;if(!this.paused){this.match.submit(this.id,input);this.rewards.input(input);if(this.partner){const other=this.second();if(other){this.match.submit(SECOND,other);this.rewards.partnerInput(other);}}this.match.step(1/60);this.publish();}return true;}
  private publish(){if(!this.match)return;this.snapshot=this.match.snapshot(true);this.receivedAt=performance.now();this.rewards.observe(this.snapshot,this.id,this.partner?SECOND:undefined);this.onSnapshot(this.snapshot);}
  startPrivateMatch(){}
  async leave(){this.generation++;this.partner=undefined;this.second=()=>undefined;this.match?.dispose();this.match=null;this.room=null;this.snapshot=null;this.receivedAt=0;this.predictionReady=false;this.paused=false;this.rewards.reset();}
}
