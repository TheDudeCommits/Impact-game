import { ROSTER_PROTOCOL, ROSTER_REFRESH_MESSAGE, requireRosterProtocol, type RosterProtocolOptions } from '../../game/rosterProtocol';
import { isReleasedFighter } from '../../game/rosterAvailability';
import { ARENAS_FULL_MESSAGE, isArenasFull } from '../../game/arenasFull';
import {RIFT_PROTOCOL} from '../../game/moba/model';
import {BALL_PROTOCOL} from '../../game/ball/model';
import {SURVIVAL_PROTOCOL} from '../../survival/coopNet';
import {OBJECTIVE_PROTOCOL,isRole} from '../../game/objectives/model';
import {Room,generateId,matchMaker,type Client} from 'colyseus';
import {randomInt,randomUUID} from 'node:crypto';
import type {SeatReservation} from '@colyseus/sdk';
import {MOVES} from '../../game/moves';
import {privateCodes} from '../privateCodes';
import {roomName,sharedEconomy} from '../economy/api';
import {lockedOut} from '../../game/economy/fighters';
import {PARTY_ARENAS,PARTY_MAX,defaultPartyRules,isPartyMode,launchArena,modeBlocked,partyCapacity,partyRules,roomRules,startCheck,type PartyView} from '../../game/social/party';
import type {FighterId,StageId} from '../../game/types';
import {RoomFaults} from '../RoomFaults';
import type {RoomException,RoomMethodName} from 'colyseus';
import {partyModeAllowed} from '../../originals/server';
/** A fighter id, as a page must send one: a string that names a fighter (`''` used to slip past a truthy check and break
 *  every member's party screen on FIGHTERS['']). */
const fighterOk=(fighter:unknown)=>fighter===undefined||isReleasedFighter(fighter);
interface Options extends RosterProtocolOptions {riftProtocol?:number;ballProtocol?:number;objectiveProtocol?:number;survivalProtocol?:number;code?:string;creationToken?:string;fighter?:FighterId;name?:string;account?:string;unlocked?:unknown;bonus?:unknown;skill?:unknown;}
/** How long a party's seats in its match are held: each member loads the match before taking one (Colyseus holds 15 s). */
export const PARTY_SEAT_SECONDS=90;
/** One member's seat in the party's match, held PARTY_SEAT_SECONDS: matchMaker.reserveSeatFor, with the time given to the
 *  seat itself (the fourth argument of Colyseus's `_reserveSeat`, which reserveSeatFor leaves out). The room's
 *  `setSeatReservationTime(90)` used to be asked first, and it answers with the room itself: one process hands that back
 *  as it is, but a room on another of the cluster's processes (ROOM_WORKERS) must send a copy, a room cannot be copied,
 *  so no answer came - after 2 s the launch failed and the party was sent home ("Could not open the match"). Every
 *  answer asked for here is true or false, and crosses. */
async function partySeat(room:{roomId:string},options:Record<string,unknown>):Promise<SeatReservation>{
  const sessionId=generateId();
  if(!await matchMaker.remoteRoomCall(room.roomId,'_reserveSeat',[sessionId,options,undefined,PARTY_SEAT_SECONDS]))throw new Error(`${room.roomId} is already full.`);
  return matchMaker.buildSeatReservation(room as never,sessionId) as SeatReservation;
}
/** This room outlives game rooms. Seat reservations are delivered privately to each member. */
export class PartyRoom extends Room {
  view!:PartyView;
  private nonce='';
  private credentials=new Map<string,Options>();
  private tickets=new Map<string,SeatReservation>();
  private launchId='';
  private matchId='';
  private deadline?:ReturnType<typeof setTimeout>;
  /** A throw in a handler is logged and contained (RoomFaults). */
  private faults=new RoomFaults(this);
  onCreate(options:Options={}){
    requireRosterProtocol(options.rosterProtocol);
    if(typeof options.creationToken!=='string'||!/^[-0-9a-f]{36}$/i.test(options.creationToken))throw new Error('Create a party from the home screen.');
    this.nonce=options.creationToken;const code=privateCodes.allocate();this.roomId='party-'+code;this.maxClients=PARTY_MAX;this.maxMessagesPerSecond=30;this.autoDispose=true;void this.setPrivate(true);
    this.view={code,leader:'',mode:'royale',members:[],rules:defaultPartyRules('royale'),votes:{},launching:false};
    this.onMessage('party-sync',c=>this.sendView(c));
    // A member's own fighter (or name): only a new fighter takes back their READY - the leader's party screen reopening
    // sends the same profile again, and used to unready its member every time.
    this.onMessage('party-profile',(c,raw:unknown)=>{
      const m=this.member(c);if(!m||m.status!=='home'||this.view.launching||!raw||typeof raw!=='object')return;
      const o=raw as Options;if(o.rosterProtocol!==ROSTER_PROTOCOL){this.notice(c,ROSTER_REFRESH_MESSAGE);return;}if(!fighterOk(o.fighter))return;
      const fighter=o.fighter??m.fighter;if(fighter!==m.fighter)m.ready=false;
      m.fighter=fighter;m.name=roomName(typeof o.account==='string'?o.account:this.credentials.get(c.sessionId)?.account,typeof o.name==='string'?o.name:m.name,18);
      this.credentials.set(c.sessionId,{...this.credentials.get(c.sessionId),...o,fighter:m.fighter,name:m.name});this.publish();
    });
    this.onMessage('party-ready',(c,value:unknown)=>{const m=this.member(c);if(!m||m.status!=='home'||this.view.launching||typeof value!=='boolean')return;
      const error=lockedOut(m.fighter,sharedEconomy()?.book.find(this.credentials.get(m.id)?.account));if(value&&error){this.notice(c,error);return;}m.ready=value;this.publish();});
    // The mode changes the match for everyone (its seats, its rules, the fighters it takes): every READY is taken back.
    this.onMessage('party-mode',(c,mode:unknown)=>{if(!this.edit(c)||!isPartyMode(mode)||mode===this.view.mode)return;
      if(!partyModeAllowed(mode)){this.notice(c,'That mode is not open yet.');return;}
      const blocked=modeBlocked(mode,this.view.members.length);if(blocked){this.notice(c,mode==='duel'?'A Duel is for exactly two players.':`This mode seats ${blocked.replace('UP TO ','up to ').toLowerCase()}.`);return;}
      this.view.mode=mode;this.view.rules=defaultPartyRules(mode,this.view.rules);this.view.votes={};this.unready();});
    // The place, the bots and the clock change the match, not who is in it: READY stands, and every page says what changed.
    // Only the seats take it back (a different field to fight in).
    this.onMessage('party-rules',(c,data:unknown)=>{if(!this.edit(c)||!data||typeof data!=='object')return;
      const before=this.view.rules,rules=partyRules(this.view.mode,data,before);
      if(partyCapacity(this.view.mode,rules)<this.view.members.length){this.notice(c,'Choose enough seats for everyone in the party.');return;}
      if(rules.arena!=='vote')this.view.votes={};
      this.view.rules=rules;if(rules.players!==before.players)this.unready();else this.publish();});
    this.onMessage('party-vote',(c,value:unknown)=>{const m=this.member(c);if(!m||m.status!=='home'||this.view.launching||this.view.rules.arena!=='vote'||typeof value!=='string'||!PARTY_ARENAS[this.view.mode].includes(value as StageId))return;this.view.votes[c.sessionId]=value as StageId;this.publish();});
    this.onMessage('party-role',(c,value:unknown)=>{const m=this.member(c);if(!m||m.status!=='home'||this.view.launching||!isRole(value))return;m.role=value;m.ready=false;this.publish();});
    // The leader's START is their ready: the old leader joins the others unready, and everyone else's READY stands.
    this.onMessage('party-leader',(c,id:unknown)=>{if(!this.edit(c)||typeof id!=='string'||id===c.sessionId)return;const next=this.view.members.find(m=>m.id===id&&m.connected);if(!next)return;
      this.view.leader=id;next.ready=false;const old=this.member(c);if(old)old.ready=false;this.publish();});
    this.onMessage('party-kick',(c,id:unknown)=>{if(!this.edit(c)||typeof id!=='string'||id===c.sessionId)return;this.clients.find(peer=>peer.sessionId===id)?.leave(4005);});
    this.onMessage('party-launch',c=>{const pending=this.launch(c),id=this.launchId;void pending.catch(error=>{if(this.launchId===id)void this.abort(isArenasFull(error)?ARENAS_FULL_MESSAGE:'Could not open the match. Your party is still together.');});});
    this.onMessage('party-arrived',(c,id:unknown)=>{
      if(id!==this.launchId)return;const m=this.member(c);if(!m||m.status!=='travelling')return;m.status='playing';
      // Leader consumes first, so the existing game lobby grants that person host controls.
      if(c.sessionId===this.view.leader)for(const peer of this.clients)if(peer!==c)this.sendTicket(peer);
      if(this.view.members.every(p=>p.status==='playing')){this.view.launching=false;clearTimeout(this.deadline);this.tickets.clear();}this.publish();
    });
    this.onMessage('party-failed',(c,id:unknown)=>{if(id===this.launchId&&this.member(c))void this.abort('A teammate could not join. Ready up to try again.');});
    this.onMessage('party-home',c=>{const m=this.member(c);if(!m)return;if(this.view.launching){void this.abort('The launch was cancelled.');return;}m.status='home';m.ready=false;this.publish();});
    this.onMessage('party-return',c=>{if(c.sessionId===this.view.leader)void this.abort('Party returned home. Choose a mode and ready up.');});
  }
  onAuth(_c:Client,o:Options={}){requireRosterProtocol(o.rosterProtocol);if(o.code!==this.view.code&&o.creationToken!==this.nonce)throw new Error('Enter the party code.');if(this.view.launching)throw new Error('This party is travelling to a match. Try again in a moment.');if(this.view.members.length>=PARTY_MAX)throw new Error('This party is full.');if(!fighterOk(o.fighter))throw new Error('Choose a fighter.');return true;}
  /** A friend joining keeps everyone else's READY: they arrive unready themselves, and START waits for them. */
  onJoin(c:Client,o:Options={}){this.onAuth(c,o);this.credentials.set(c.sessionId,o);this.view.members.push({id:c.sessionId,name:roomName(o.account,o.name,18),fighter:o.fighter??'konta',ready:false,connected:true,status:'home',role:'auto'});this.view.leader||=c.sessionId;this.publish();}
  private member(c:Client){return this.view.members.find(m=>m.id===c.sessionId);}
  private notice(c:Client,message:string){c.send('notice',{message});}
  private edit(c:Client){if(c.sessionId!==this.view.leader||this.view.launching||this.view.members.some(m=>m.status!=='home')){this.notice(c,'The leader can change the party once everyone is home.');return false;}return true;}
  private unready(){for(const m of this.view.members)m.ready=false;this.publish();}
  private sendView(c:Client){c.send('party',this.view);}
  private publish(){this.broadcast('party',this.view);}
  private sendTicket(c:Client){const reservation=this.tickets.get(c.sessionId);if(reservation)c.send('party-travel',{id:this.launchId,mode:this.view.mode,reservation});}
  async launch(c:Client){
    if(!this.edit(c))return;
    if(!partyModeAllowed(this.view.mode)){this.notice(c,'That mode is not open yet.');return;}
    if(this.view.members.some(m=>this.credentials.get(m.id)?.rosterProtocol!==ROSTER_PROTOCOL)){this.notice(c,ROSTER_REFRESH_MESSAGE);return;}
    const check=startCheck(this.view);if(check.reason){this.notice(c,check.reason+'.');return;}
    for(const m of this.view.members){const error=lockedOut(m.fighter,sharedEconomy()?.book.find(this.credentials.get(m.id)?.account));if(error){this.notice(c,`${m.name}: ${error}`);return;}}
    if((this.view.mode==='bad-blood'||this.view.mode==='last-stand')&&this.view.members.some(m=>this.credentials.get(m.id)?.objectiveProtocol!==OBJECTIVE_PROTOCOL)){this.notice(c,'Everyone must refresh the page before entering the updated team modes.');return;}
    if((this.view.mode==='goal-rush'||this.view.mode==='sky-spike')&&this.view.members.some(m=>this.credentials.get(m.id)?.ballProtocol!==BALL_PROTOCOL)){this.notice(c,'Everyone must refresh the page before entering the ball modes.');return;}
    if(this.view.mode==='rift-war'&&this.view.members.some(m=>this.credentials.get(m.id)?.riftProtocol!==RIFT_PROTOCOL)){this.notice(c,'Everyone must refresh the page before entering Rift War.');return;}
    if(this.view.mode==='survival'&&this.view.members.some(m=>this.credentials.get(m.id)?.survivalProtocol!==SURVIVAL_PROTOCOL)){this.notice(c,'Everyone must refresh the page before entering the updated Arcade.');return;}
    this.view.launching=true;this.launchId=randomUUID();this.publish();const generation=this.launchId;
    // The place: the one chosen, the vote's winner, or one dealt now (RANDOM); the royale's RANDOM is its room's own deal.
    const mode=this.view.mode,creationToken=randomUUID(),arena=launchArena(this.view,pool=>pool[randomInt(pool.length)]);
    const rules=roomRules(this.view.rules,arena);
    const roomName=mode==='goal-rush'||mode==='sky-spike'?'ball_arena':mode==='rift-war'?'rift_war':mode==='duel'?'private_duel':mode==='royale'?'private_arena':mode==='survival'?'survival_arena':'objective_arena';
    // A Duel is the private Duel's own room (rounds, results, the runback), on the place chosen (PrivateDuelRoom checks it).
    // `party`: the members sent, so the room starts by itself once they are all in and loaded (PartyStart); `fill`: Last
    // Stand's bot allies as the party chose them (no lobby to choose them in any more).
    const party=this.view.members.length;
    const options=mode==='duel'?{rosterProtocol:ROSTER_PROTOCOL,creationToken,assetGate:true,readyGate:true,mode:'match',stage:arena,party}
      :{rosterProtocol:ROSTER_PROTOCOL,creationToken,assetGate:true,readyGate:true,riftProtocol:RIFT_PROTOCOL,survivalProtocol:SURVIVAL_PROTOCOL,objectiveProtocol:OBJECTIVE_PROTOCOL,ballProtocol:BALL_PROTOCOL,...(mode==='goal-rush'||mode==='sky-spike'?{ball:mode}:{}),mode:'match',objective:mode,access:'host',players:rules.players,rules,party,...(mode==='last-stand'?{fill:this.view.rules.fill}:{})};
    const room=await matchMaker.createRoom(roomName,options);if(generation!==this.launchId){await matchMaker.remoteRoomCall(room.roomId,'disconnect').catch(()=>{});return;}this.matchId=room.roomId;
    for(const m of [...this.view.members]){if(generation!==this.launchId)break;const reservation=await partySeat(room,{...this.credentials.get(m.id),...options,fighter:m.fighter,name:m.name,role:m.role});if(generation===this.launchId)this.tickets.set(m.id,reservation);}
    if(generation!==this.launchId){await matchMaker.remoteRoomCall(room.roomId,'disconnect').catch(()=>{});return;}
    for(const m of this.view.members){m.status='travelling';m.ready=false;}this.publish();this.sendTicket(c);
    this.deadline=setTimeout(()=>{void this.abort('The party took too long to connect. Ready up to retry.');},90000);this.deadline.unref?.();
  }
  private async abort(message:string){const room=this.matchId;this.matchId='';this.launchId='';this.tickets.clear();clearTimeout(this.deadline);this.view.launching=false;for(const m of this.view.members){m.ready=false;m.status='home';}this.broadcast('party-return',{message});this.publish();if(room)await matchMaker.remoteRoomCall(room,'disconnect').catch(()=>{});}
  async onDrop(c:Client){const m=this.member(c);if(!m)return;m.connected=false;m.ready=false;this.publish();try{await this.allowReconnection(c,30);}catch{this.onLeave(c);}}
  onReconnect(c:Client){const m=this.member(c);if(m){m.connected=true;this.publish();if(m.status==='travelling'&&(c.sessionId===this.view.leader||this.view.members.find(p=>p.id===this.view.leader)?.status==='playing'))this.sendTicket(c);}}
  /** A friend leaving keeps everyone else's READY (START says if the mode no longer fits the party). */
  onLeave(c:Client){if(!this.member(c))return;this.credentials.delete(c.sessionId);delete this.view.votes[c.sessionId];this.view.members=this.view.members.filter(m=>m.id!==c.sessionId);if(this.view.leader===c.sessionId){this.view.leader=this.view.members.find(m=>m.connected)?.id??this.view.members[0]?.id??'';const next=this.view.members.find(m=>m.id===this.view.leader);if(next)next.ready=false;}if(this.view.launching)void this.abort('A teammate left during launch.');else this.publish();}
  /** Colyseus's room-level handler: a throw in a message handler or a leave is logged and contained. */
  onUncaughtException(error:RoomException,method:RoomMethodName){this.faults.report(error,method);}
  onDispose(){clearTimeout(this.deadline);this.credentials.clear();this.tickets.clear();if(this.view)privateCodes.release(this.view.code);}
}
