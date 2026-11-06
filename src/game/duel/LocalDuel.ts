import {keptSkill} from '../../boot/skill';
import { isReleasedFighter, requireReleasedFighter } from '../rosterAvailability';
import {DuelSet} from './DuelSet';
import {ArenaSimulation} from '../simulation';
import {COMBO_HP,COMBO_STAMINA,MOVES,SIMULATION_HZ} from '../moves';
import {HELD} from '../economy/fighters';
import type {FighterId,GameSnapshot,PlayerInput,StageId} from '../types';
import {placeForStart} from '../stageChoice';
import {DeviceMatch} from '../economy/device';
import {lockCombatFor} from '../lockMode';
import {locks} from '../lockCombat';
import {SECOND} from '../couchSeat';

export const DUEL_STAGE:{id:StageId}={id:'sunfall-arena'};
/** Offline opponent using the same combat and bot AI as the server, with no round trip. A completed set is reported
 *  for pay (economy/device.ts), and the account's server pays it within its caps. */
export class LocalDuel {
  readonly local=true;
  set=new DuelSet();
  room:{send(type:string,payload?:unknown):void}|null=null;
  sim:ArenaSimulation|null=null;
  snapshot:GameSnapshot|null=null;
  receivedAt=0;predictionReady=false;paused=false;
  onSnapshot=(_snapshot:GameSnapshot)=>{};
  onControlReset=()=>{};
  onDisconnect=(_reason:string)=>{};
  onNotice=(_message:string)=>{};
  private startsAt=3;
  private rewards=new DeviceMatch();
  couch=false;
  second:()=>PlayerInput|undefined=()=>undefined;
  get id(){return this.sim?'you':'';}
  /** `rival`: the bot fighter to face (a rematch keeps it); otherwise one is drawn. `place`: the arena the player named
   *  on the sheet; none (RANDOM) deals one of the Duel's places, the tournament ring where nothing is dealt. */
  async connect(fighter:FighterId,name:string,rival?:FighterId,place?:StageId,couch=false){
    requireReleasedFighter(fighter);
    if (rival !== undefined) requireReleasedFighter(rival);
    await this.leave();this.set=new DuelSet();this.couch=couch&&rival!==undefined;
    const {createRapierCollision}=await import('../rapierCollision');
    const stage=placeForStart(place,'duel','offline')??DUEL_STAGE.id;
    // Lock combat (the experiment's preview, lockMode.ts): for its fighters, against one of them.
    const lock=lockCombatFor(fighter)||this.couch&&lockCombatFor(rival!);
    const sim=new ArenaSimulation({roomMode:'match',stage,collision:await createRapierCollision(stage),maxStamina:COMBO_STAMINA,maxHp:COMBO_HP,...(lock?{lockCombat:true}:{})});
    sim.addPlayer('you',fighter,name);
    if(this.couch){
      sim.addPlayer(SECOND,rival!,'Player 2');
      this.sim=sim;this.startsAt=sim.serverTime+3;
      this.room={send:type=>{if(type==='duel-runback'&&this.sim){this.set.request(this.sim,'you');this.set.request(this.sim,SECOND);this.onControlReset();this.publish();}}};this.predictionReady=true;this.publish();
      return;
    }
    sim.setPlayerSkill('you',keptSkill());
    const roster=(Object.keys(MOVES) as FighterId[]).filter(id=>id!==fighter&&isReleasedFighter(id)&&!HELD.has(id));
    // The featured rivalry is the first choice for these two; everyone else draws a live rival.
    const foe=rival&&isReleasedFighter(rival)&&!HELD.has(rival)?rival:fighter==='koko'?'oro':fighter==='oro'?'koko':sim.pick(lock?roster.filter(locks):roster);
    sim.addPlayer('duel-bot',foe,'Rival',true);
    this.sim=sim;this.startsAt=sim.serverTime+3;
    this.room={send:type=>{if(type==='duel-runback'){this.set.request(this.sim!,'you');this.onControlReset();this.publish();}}};this.predictionReady=true;this.publish();
  }
  send(input:PlayerInput){
    const sim=this.sim;if(!sim)return false;
    if(!this.paused){sim.submitInput('you',input);this.rewards.input(input);if(this.couch){const other=this.second();if(other){sim.submitInput(SECOND,other);this.rewards.partnerInput(other);}}sim.step(1/SIMULATION_HZ);if(sim.status==='waiting'&&sim.serverTime>=this.startsAt)sim.startMatch();}
    this.set.step(sim);this.publish();return true;
  }
  private publish(){
    if(!this.sim)return;
    const snapshot=this.sim.snapshot(true);
    snapshot.lobby={duel:true,visibility:'public',hostId:null,canStart:false,startsAt:snapshot.status==='waiting'?this.startsAt:null,expiresAt:null,size:2};
    this.set.snapshot(snapshot);this.snapshot=snapshot;this.receivedAt=performance.now();this.rewards.observe(snapshot,'you',this.couch?SECOND:undefined);this.onSnapshot(snapshot);
  }
  startPrivateMatch(){}
  async leave(){this.sim?.dispose();this.sim=null;this.room=null;this.snapshot=null;this.receivedAt=0;this.predictionReady=false;this.paused=false;this.rewards.reset();}
}
