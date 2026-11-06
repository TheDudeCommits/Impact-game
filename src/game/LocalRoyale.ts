import {keptSkill} from '../boot/skill';
import { isReleasedFighter, requireReleasedFighter } from './rosterAvailability';
import { ArenaSimulation } from './simulation';
import { COMBO_HP, COMBO_STAMINA, KO_HEAL, SIMULATION_HZ } from './moves';
import { RoyaleDeck, type StageId } from './stages';
import { placeForStart } from './stageChoice';
import { draftBots } from './matchmaking';
import type { FighterId, GameSnapshot, PlayerInput } from './types';
import { DeviceMatch } from './economy/device';
import { lockCombatOn } from './lockMode';
import { SECOND } from './couchSeat';

/** Solo battle royale uses the same combat, drafting and collision as hosted
 * rooms, but needs no connection. Its result is reported for pay once decided
 * (economy/device.ts), and the account's server pays it within its caps. */
export class LocalRoyale {
  readonly local=true;
  room:{send(type:string,payload?:unknown):void}|null=null;
  sim:ArenaSimulation|null=null;
  snapshot:GameSnapshot|null=null;
  receivedAt=0;predictionReady=false;paused=false;
  onSnapshot=(_snapshot:GameSnapshot)=>{};
  onControlReset=()=>{};
  onDisconnect=(_reason:string)=>{};
  onNotice=(_message:string)=>{};
  private startsAt=3;
  private stages=new RoyaleDeck();
  private rewards=new DeviceMatch();
  get id(){return this.sim?'you':'';}
  /** Couch (couch/couch.ts): Player 2 in the field, a rival like every other fighter there, and their command for each
   *  tick (main.ts sets it). Player 1's place pays the device's account, as a match with a friend once Player 2 has
   *  played too (economy/device.ts), within the on-device caps. */
  partner?:FighterId;
  second:()=>PlayerInput|undefined=()=>undefined;
  /** `place`: the arena the player named on the sheet (it must hold the field); none (RANDOM) deals from the royale's deck.
   *  `field`: the bots, already drafted - a public room's, by a page that plays on its device instead (loneQueue), their
   *  files fetched while it waited; none, or not a whole field of released fighters, drafts here as ever. */
  async connect(fighter:FighterId,name:string,players=8,place?:StageId,field?:readonly FighterId[],partner?:FighterId){
    requireReleasedFighter(fighter);
    if(partner!==undefined)requireReleasedFighter(partner);
    await this.leave();this.partner=partner;
    const {createRapierCollision}=await import('./rapierCollision');
    // Lock combat (game/lockMode.ts): the royale against bots plays it as the Duel and Training do.
    const sim=new ArenaSimulation({roomMode:'match',maxStamina:COMBO_STAMINA,maxHp:COMBO_HP,koHeal:KO_HEAL,...(lockCombatOn()?{lockCombat:true}:{})}), size=[4,6,8,10,12].includes(players)?players:8;
    const stage=placeForStart(place,'royale','offline',size)??this.stages.deal(pool=>sim.pick(pool),size);
    try {sim.setStage(stage,await createRapierCollision(stage));} catch(error){sim.dispose();throw error;}
    sim.addPlayer('you',fighter,name);sim.setPlayerSkill('you',keptSkill());
    if(partner)sim.addPlayer(SECOND,partner,'Player 2');
    const bots=size-1-(partner?1:0);
    const drafted=field&&field.length>=bots&&field.every(isReleasedFighter)?field.slice(0,bots):draftBots(partner?[fighter,partner]:[fighter],bots,items=>sim.shuffle(items));
    for(const [i,foe] of drafted.entries())sim.addPlayer(`bot-${i+1}`,foe,foe.replaceAll('-',' '),true);
    this.sim=sim;this.startsAt=sim.serverTime+3;this.room={send:()=>{}};this.predictionReady=true;this.publish();
  }
  send(input:PlayerInput){
    const sim=this.sim;if(!sim)return false;
    if(!this.paused){sim.submitInput('you',input);this.rewards.input(input);if(this.partner){const other=this.second();if(other){sim.submitInput(SECOND,other);this.rewards.partnerInput(other);}}sim.step(1/SIMULATION_HZ);if(sim.status==='waiting'&&sim.serverTime>=this.startsAt)sim.startMatch();}
    this.publish();return true;
  }
  private publish(){
    if(!this.sim)return;
    const snapshot=this.sim.snapshot(true);
    snapshot.lobby={visibility:'public',hostId:null,canStart:false,startsAt:snapshot.status==='waiting'?this.startsAt:null,expiresAt:null,size:snapshot.players.length};
    this.snapshot=snapshot;this.receivedAt=performance.now();this.rewards.observe(snapshot,'you',this.partner?SECOND:undefined);this.onSnapshot(snapshot);
  }
  startPrivateMatch(){}
  async leave(){this.partner=undefined;this.second=()=>undefined;this.sim?.dispose();this.sim=null;this.room=null;this.snapshot=null;this.receivedAt=0;this.predictionReady=false;this.paused=false;this.rewards.reset();}
}
