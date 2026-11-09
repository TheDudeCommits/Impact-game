import { keptSkill } from './boot/skill';
import {BALL_PROTOCOL,type BallModeId} from './game/ball/model';
import { ROSTER_PROTOCOL, ROSTER_REFRESH_MESSAGE } from './game/rosterProtocol';
import { ARENAS_FULL_MESSAGE, isArenasFull } from './game/arenasFull';
import { isReleasedFighter, requireReleasedFighter } from './game/rosterAvailability';
import { laboratoryFighter } from './fighterLab';
import { forgeJoinOption, forgeWanted } from './engine/client/forgeJoin';
import { forgetForgeKits, rememberForgeKits } from './engine/sim/forgedKits';
import {joinRiftPublic} from './network/riftQueue';
import {account as playerAccount} from './ui/shop/account';
import type {PartyTravel} from './social/PartyClient';
import {RIFT_PROTOCOL} from './game/moba/model';
import {OBJECTIVE_PROTOCOL,type ObjectiveKind,type ObjectiveAccess,type RolePreference} from './game/objectives/model';
import { Client, type Room } from '@colyseus/sdk';
import { LinkQuality } from './network/linkQuality';
import { errorReports } from './boot/errorReports';
import { REJOIN_FAILED, REJOIN_WINDOW } from './boot/rejoin';
import type { AttackSlot, FighterId, GameSnapshot, PlayerInput, RoomMode } from './game/types';
import { COOP_LINK, COOP_ROOM, SURVIVAL_PROTOCOL, decode, type CoopFrame } from './survival/coopNet';
import { HordeFrames } from './survival/horde/frame';
import { carried } from './survival/progressStore';
import type { HordeEvent } from './survival/horde/Horde';
import { ArenaSimulation } from './game/simulation';
import { chooseStage, STAGES, type StageId } from './game/stages';
import { placeForStart, royaleRules } from './game/stageChoice';
import { launchStage } from './originals/launch';
import { BODY_SIZE, COMBO_HP, COMBO_STAMINA, MOVES, SIMULATION_HZ } from './game/moves';
import { HELD } from './game/economy/fighters';
import { trainingPlace, trainingRival } from './ui/modes/prefs';
import { activePack, activePackRoster } from './engine/packs/active';
import { lockCombatOn } from './game/lockMode';
import { SECOND } from './game/couchSeat';
import type { SeatDevice } from './couch/seats';
import { roomEmote, socialLeft, socialWelcome } from './social/roomSocial';

export interface CouchStart { partner: FighterId; screen: CouchScreen; sides?: 'same' | 'rivals'; /** The seats the mode sheet showed (P1's device, P2's), pads that came and went while it was up already counted (couch/seats.ts reseat); none: the start seats them (couch.ts plannedSeats). */ seats?: readonly SeatDevice[] }
export type CouchScreen = 'shared' | 'split-v' | 'split-h';
export type NetworkAccess={kind:'rift-war';access:'quick'|'bots'|'host'|'join';code?:string;couch?:CouchStart}
  /** The ball modes (game/ball): Goal Rush and Sky Spike, on this device against bots or in a ball room. */
  |{kind:'ball';mode:BallModeId;access:'quick'|'bots'|'host'|'join';code?:string;couch?:CouchStart;/** RUMBLE's charms (on this device, or a room the page opens). */rumble?:boolean;/** FREE PLAY: alone with the ball, on this device. */practice?:boolean}|{kind:'duel';access:'online'|'bot'|'host'|'join'|'couch';code?:string;couch?:CouchStart;/** A bot duel's rival, kept for PLAY AGAIN (Round 5 UX); a couch duel's, Player 2's fighter. */rival?:FighterId;/** The place the player named on the sheet (a bot Duel's, or the one a friends' room is opened on); none: dealt. */place?:StageId}|{kind:'party';travel:PartyTravel}|{kind:'objective';objective:ObjectiveKind;access:ObjectiveAccess;role?:RolePreference;fighter?:FighterId;code?:string;couch?:CouchStart;/** Bad Blood's place, when the player named one (bots, or a room the host opens). */place?:StageId}|{kind:'public'}|{kind:'create-private';players?:number;/** The place the host named for the room; none: the room deals it. */place?:StageId}|{kind:'join-private';code:string}|{kind:'bots';players:number;couch?:CouchStart;/** The place the player named; none: the royale's deck deals it. */place?:StageId;/** The bots, when a public room the page left had drafted them (loneQueue: their files already fetched); none: drafted here. */field?:FighterId[];/** Played on the device because nobody else queued (loneQueue): its place and field are that room's, not kept for PLAY AGAIN. */lone?:true}
  /** Arcade survival: no room at all - the arena runs in the browser (LocalArena). */
  |{kind:'survival';/** Couch co-op (couch/seats.ts): the second person's hero, beside the first. */partner?:FighterId;couch?:CouchStart}
  /** Training on this device with a second person in the ground (couch): none, it is the solo Training it always was. */
  |{kind:'training';couch?:CouchStart;/** LEARN TO FIGHT (src/tutorial): the guided first fight, always on this device. */tutorial?:true}
  /** Co-op arcade survival: a party's run on the match server (SurvivalRoom). */
  |{kind:'coop-create'}|{kind:'coop-join';code:string;
  /** Quick co-op: matched into any open public room (or a new one), no code. */
  quick?:boolean};

export function closeMessage(code:number){
  if(code===4001)return 'The server was updated. Press PLAY to jump back in.';
  if(code===4004)return 'This room expired. Press PLAY to start a new one.';
  if(code===4006)return 'Your match ended while you were away. Press PLAY for another.';
  if(code===4008)return 'Loading took too long. Press PLAY to try again.';
  return 'Lost connection to the match. Press PLAY to find a new one.';
}
export function joinFailure(error:unknown,online=typeof navigator!=='object'||navigator.onLine!==false):string|undefined{
  if(!error||typeof error!=='object')return undefined;
  const {message,code}=error as {message?:unknown;code?:unknown},text=typeof message==='string'?message:'';
  // (A server from before 12 October 2026 still says the game's old name in this message: the page answers in today's.)
  if(text.includes(ROSTER_REFRESH_MESSAGE)||text.includes(ROSTER_REFRESH_MESSAGE.replace('Refresh ','Refresh Jump ')))return ROSTER_REFRESH_MESSAGE;
  // Night cap: the server turned a NEW room away (ROOM_CAP / LOAD_SHED, src/server/capacity.ts). Its words, as they are, before any
  // path below rewrites them (a quick co-op's, a private join's) and before a status code is read as "restarting".
  if(isArenasFull(error))return ARENAS_FULL_MESSAGE;
  const unreachable=/Failed to fetch|NetworkError when attempting|^Load failed$|fetch failed|ECONNREFUSED|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED/i.test(text)||code==='ECONNREFUSED';
  if(unreachable&&!online)return "You're offline. Check your connection, then try again.";
  if(unreachable||code===502||code===503||code===504||code===1005||code===1006||/Bad Gateway|Service Unavailable|Gateway Time-?out|Application failed to respond|no processId available|shutting.down/i.test(text))return 'The servers are restarting. Try again in a minute.';
  return undefined;
}

export class Network {
  constructor(private readonly endpoint?:string){}
  room:Room|null=null;
  snapshot:GameSnapshot|null=null;
  receivedAt=0;
  predictionReady=false;
  /** Night net: the round trip and the stalls of this page's link to the room (src/network/linkQuality.ts). */
  readonly link=new LinkQuality();
  private pingTimer:ReturnType<typeof setInterval>|undefined;
  private awaitingInputResync=false;
  private generation=0;
  private resyncTimer:ReturnType<typeof setTimeout>|undefined;
  private askResync(room:Room){
    clearTimeout(this.resyncTimer);
    if(room.connection.isOpen)room.send('resync-input');
    this.resyncTimer=setTimeout(()=>{if(this.room===room&&this.awaitingInputResync)this.askResync(room);},1000);
  }
  onSnapshot=(_snapshot:GameSnapshot)=>{};
  onControlReset=()=>{};
  /** The room closed for good: what to tell the player (closeMessage), and its close code, when the server sent one. */
  onDisconnect=(_reason:string,_code?:number)=>{};
  onNotice=(_message:string)=>{};
  /** The bots a public match will seat at its kickoff, as the room sends them while its countdown runs (`planned-bots`,
   *  ArenaRoom.planBots): main.ts fetches their files meanwhile, and a lone page that plays on its device takes them along. */
  plannedBots:FighterId[]=[];
  onPlannedBots=(_bots:readonly FighterId[])=>{};
  get id(){return this.room?.sessionId??'';}
  /** A co-op survival room, whose frames carry the run (`coop`). */
  coop=false;
  /** The run as this fighter sees it, from the last co-op frame. */
  get run(){return this.coop?(this.snapshot as CoopFrame|null)?.survival:undefined;}
  /** Co-op: the horde as the room sends it, a packed frame at a time, and
   *  the crowd's events (spawns, wind-ups, deaths) that came with them. */
  readonly hordeFrames=new HordeFrames();
  hordeEvents:HordeEvent[]=[];
  private hordeFrame(snapshot:CoopFrame){if(snapshot.horde){const events=this.hordeFrames.next().unpack(snapshot.horde);if(events.length)this.hordeEvents.push(...events);if(this.hordeEvents.length>256)this.hordeEvents.splice(0,this.hordeEvents.length-256);}}
  /** A room's reconnection token for the next connect to take its seat back with, instead of joining (boot/rejoin.ts: the
   *  page reloaded under a lost graphics context). */
  private resume:{token:string;until:number}|undefined;
  resumeWith(token:string){this.resume={token,until:Date.now()+REJOIN_WINDOW};}
  /** The room this page keeps for its reload: `leave` lets it drop instead of leaving it, so the room holds the seat. */
  private kept:Room|null=null;
  /** The room's reconnection token, the room kept (undefined: no open room). */
  keepForRejoin(){const room=this.room;if(!room?.connection.isOpen||!room.reconnectionToken)return undefined;this.kept=room;return room.reconnectionToken;}
  async connect(fighter:FighterId,mode:RoomMode,name:string,access:NetworkAccess={kind:'public'}){
    requireReleasedFighter(fighter);
    const resume=this.resume&&Date.now()<this.resume.until?this.resume.token:undefined;this.resume=undefined;
    const generation=++this.generation;
    const url=this.endpoint || import.meta.env.VITE_MATCH_SERVER || `${location.protocol==='https:'?'https':'http'}://${location.hostname}:2567`;
    const client=new Client(url);
    let activeRoom:Room;
    // (The account the page plays as: a room lets a fighter bought in the shop in only for the account that owns them.)
    // Bind even a first-time guest before the authoritative room starts.
    if(mode!=='training')await playerAccount.open().catch(()=>undefined);
    const account=playerAccount.secret()??COOP_LINK.token;
    // (The player's skill, for the room's bots to stand ahead of: adaptive.ts.)
    const skill=keptSkill();
    try {
      if(resume)activeRoom=await client.reconnect(resume);
      else if(access.kind==='duel'){
        const options={rosterProtocol:ROSTER_PROTOCOL,assetGate:true,readyGate:true,fighter,account,skill,name,mode:'match'};
        if(access.access==='online')activeRoom=await client.joinOrCreate('duel_arena',options);
        else if(access.access==='host'){const stage=placeForStart(access.place,'duel','friends');activeRoom=await client.create('private_duel',{...options,...forgeJoinOption(fighter),creationToken:crypto.randomUUID(),...(stage?{stage}:{})});}
        else if(access.access==='join'){const code=access.code?.trim();if(!code||!/^\d{6}$/.test(code))throw new Error('Enter the six-digit Duel code.');activeRoom=await client.joinById(`duel-${code}`,{...options,...forgeJoinOption(fighter),code});}
        else throw new Error('Bot Duel runs locally.');
      }else if(access.kind==='party')activeRoom=await client.consumeSeatReservation(access.travel.reservation);
      else if(access.kind==='rift-war'){
        const options={rosterProtocol:ROSTER_PROTOCOL,assetGate:true,riftProtocol:RIFT_PROTOCOL,fighter,account,skill,name,access:access.access};
        if(access.access==='join'){const code=access.code?.trim();if(!code||!/^\d{6}$/.test(code))throw new Error('Enter the 6-digit room code.');activeRoom=await client.joinById(`rift-${code}`,{...options,code});}
        else if(access.access==='quick')activeRoom=await joinRiftPublic(client,url,options);
        else activeRoom=await client.create('rift_war',{...options,creationToken:crypto.randomUUID()});
      }
      else if(access.kind==='ball'){
        const options={rosterProtocol:ROSTER_PROTOCOL,assetGate:true,ballProtocol:BALL_PROTOCOL,fighter,account,skill,name,ball:access.mode,access:access.access};
        if(access.access==='join'){const code=access.code?.trim();if(!code||!/^\d{6}$/.test(code))throw new Error('Enter the 6-digit room code.');activeRoom=await client.joinById(`ball-${code}`,{...options,code});}
        else if(access.access==='quick')activeRoom=await client.joinOrCreate('ball_arena',options);
        else if(access.access==='host')activeRoom=await client.create('ball_arena',{...options,creationToken:crypto.randomUUID(),rumble:!!access.rumble});
        else throw new Error('A match against bots runs on this device.');
      }
      else if(access.kind==='objective'){
        const options={rosterProtocol:ROSTER_PROTOCOL,assetGate:true,readyGate:true,objectiveProtocol:OBJECTIVE_PROTOCOL,fighter,account,skill,name,objective:access.objective,access:access.access,role:access.role};
        if(access.access==='join'){const code=access.code?.trim();if(!code||!/^\d{6}$/.test(code))throw new Error('Enter the 6-digit room code.');activeRoom=await client.joinById(`objective-${code}`,{...options,code});}
        else if(access.access==='quick'){try{activeRoom=await client.joinOrCreate('objective_arena',options);}catch(error){if(error instanceof Error&&error.message.includes('faction is full'))activeRoom=await client.create('objective_arena',options);else throw error;}}
        else{
          // (A Bad Blood host's place, from the sheet: the same `rules.arena` a party's launch sends. Last Stand's village is fixed.)
          const arena=access.objective==='bad-blood'&&access.access==='host'?placeForStart(access.place,'bad-blood','friends'):undefined;
          activeRoom=await client.create('objective_arena',{...options,creationToken:crypto.randomUUID(),...(arena?{rules:{arena}}:{})});
        }
      }else if(access.kind==='bots')activeRoom=await client.create('bot_arena',{rosterProtocol:ROSTER_PROTOCOL,assetGate:true,readyGate:true,fighter,account,skill,mode:'match',name,players:access.players});
      // (A co-op fighter brings their rift progress: the nodes bought with shards, their mastery's skill points.)
      else if(access.kind==='coop-create'){const {unlocked,bonus}=carried(fighter);activeRoom=await client.create(COOP_ROOM,{rosterProtocol:ROSTER_PROTOCOL,survivalProtocol:SURVIVAL_PROTOCOL,assetGate:true,readyGate:true,fighter,account,skill,name,creationToken:crypto.randomUUID(),unlocked,bonus});}
      else if(access.kind==='coop-join'&&access.quick){const {unlocked,bonus}=carried(fighter);activeRoom=await client.joinOrCreate(COOP_ROOM,{rosterProtocol:ROSTER_PROTOCOL,survivalProtocol:SURVIVAL_PROTOCOL,assetGate:true,readyGate:true,fighter,account,skill,name,quick:true,unlocked,bonus});}
      else if(access.kind==='coop-join'){
        const code=access.code.trim();
        if(!/^\d{6}$/.test(code))throw new Error('Enter the 6-digit room code from your friend.');
        const {unlocked,bonus}=carried(fighter);
        activeRoom=await client.joinById(`coop-${code}`,{rosterProtocol:ROSTER_PROTOCOL,survivalProtocol:SURVIVAL_PROTOCOL,assetGate:true,readyGate:true,fighter,account,skill,name,code,unlocked,bonus});
      }
      else if(access.kind==='create-private'){
        // (The host's place, if one was named: the same `rules` a party's launch sends. None: the room deals it, as it always has.)
        const rules=royaleRules(access.place,access.players);
        activeRoom=await client.create('private_arena',{rosterProtocol:ROSTER_PROTOCOL,assetGate:true,readyGate:true,fighter,account,skill,mode:'match',name,creationToken:crypto.randomUUID(),...(access.players?{players:access.players}:{}),...(rules?{rules}:{}),...forgeJoinOption(fighter)});
      }
      else if(access.kind==='join-private'){
        const code=access.code.trim();
        if(!/^\d{6}$/.test(code))throw new Error('Enter the 6-digit room code from your friend.');
        activeRoom=await client.joinById(`private-${code}`,{rosterProtocol:ROSTER_PROTOCOL,assetGate:true,readyGate:true,fighter,account,skill,mode:'match',name,code,...forgeJoinOption(fighter)});
      }else activeRoom=await client.joinOrCreate('arena',{rosterProtocol:ROSTER_PROTOCOL,assetGate:true,readyGate:true,fighter,account,skill,mode,name});
    }catch(error){
      if(resume)throw new Error(REJOIN_FAILED);
      const down=joinFailure(error);if(down)throw new Error(down);
      if(access.kind==='duel'&&access.access==='join'&&error instanceof Error&&!error.message.startsWith('Enter the six-digit'))throw new Error('This Duel is unavailable. Check the code — it may be full, started, or expired.');
      if(access.kind==='objective'&&access.access==='join'&&error instanceof Error)throw new Error('This team room is unavailable. Check the mode and code — it may be full or already started.');
      if(access.kind==='join-private'&&error instanceof Error&&!error.message.startsWith('Enter the 6-digit'))throw new Error('This room is unavailable. Check the code — it may be full, started, or expired.');
      if(access.kind==='coop-join'&&access.quick&&error instanceof Error)throw new Error('Quick co-op is unavailable right now — try again, or host a room.');
      if(access.kind==='coop-join'&&error instanceof Error&&!error.message.startsWith('Enter the 6-digit'))throw new Error(/just ended/i.test(error.message)?'That run has just ended — join when the party is back in the lobby.':'This co-op room is unavailable. Check the code — it may be full or expired.');
      throw error;
    }
    if(generation!==this.generation){activeRoom.reconnection.enabled=false;await activeRoom.leave();throw new Error('Connection cancelled.');}
    this.room=activeRoom;this.snapshot=null;this.receivedAt=0;this.predictionReady=false;this.awaitingInputResync=false;this.coop=access.kind==='coop-create'||access.kind==='coop-join'||access.kind==='party'&&access.travel.mode==='survival';
    // Training on the match server (a capture tool's, or ?online-training): the dummy chosen on the mode sheet, as
    // LocalTraining's, through the LABORATORY's own command (the room checks it).
    const rival=mode==='training'?trainingRival():undefined;if(rival)activeRoom.send('training',{lab:'opponent',value:rival});
    COOP_LINK.room=this.coop?activeRoom:undefined;COOP_LINK.match=this.coop?undefined:activeRoom;
    // A fully joined session may reconnect even if its first drop is within 5s.
    activeRoom.reconnection.minUptime=0;
    let lastError:string|undefined;
    // A room that says `social` in its welcome (server/social/EmoteRelay.ts) passes the others' emotes to this page.
    activeRoom.onMessage('welcome',(welcome:unknown)=>{if(this.room===activeRoom&&!this.coop)socialWelcome(activeRoom,welcome,()=>this.room===activeRoom?this.snapshot?.players??[]:[]);});
    activeRoom.onMessage('emote',(emote:unknown)=>{if(this.room===activeRoom)roomEmote(emote);});
    this.plannedBots=[];
    activeRoom.onMessage('planned-bots',(bots:unknown)=>{
      if(this.room!==activeRoom||!Array.isArray(bots))return;
      this.plannedBots=bots.filter(isReleasedFighter).slice(0,12);this.onPlannedBots(this.plannedBots);
    });
    // Night net: a ping every two seconds - every room answers it with a pong - so the HUD can say when the lag is the link's.
    this.link.reset();clearInterval(this.pingTimer);
    this.pingTimer=setInterval(()=>{if(this.room===activeRoom&&activeRoom.connection.isOpen)activeRoom.send('ping',this.link.ping(performance.now()));},2000);
    activeRoom.onMessage('pong',(pong:unknown)=>{if(this.room===activeRoom&&typeof pong==='object'&&pong!==null)this.link.pong((pong as {clientTime?:unknown}).clientTime,performance.now());});
    // Forged fighters' kits, each sent once by the room (VOL.5): every screen plays them by the hash in PlayerState.forge.
    forgetForgeKits();activeRoom.onMessage('forge-kits',(codes:unknown)=>{rememberForgeKits(codes);});
    activeRoom.onMessage('snapshot',(snapshot:GameSnapshot)=>{
      if(this.room!==activeRoom)return;
      if(!this.awaitingInputResync)this.predictionReady=true;
      this.snapshot=snapshot;this.receivedAt=performance.now();this.link.heard(this.receivedAt);this.onSnapshot(snapshot);
    });
    activeRoom.onMessage('input-resync',(snapshot:GameSnapshot)=>{
      if(this.room!==activeRoom)return;
      clearTimeout(this.resyncTimer);
      this.awaitingInputResync=false;this.predictionReady=true;
      this.snapshot=snapshot;this.receivedAt=performance.now();this.link.heard(this.receivedAt);this.onSnapshot(snapshot);
    });
    // A co-op room sends the same two, packed (see coopNet).
    activeRoom.onMessage('frame',(bytes:Uint8Array)=>{
      if(this.room!==activeRoom)return;
      if(!this.awaitingInputResync)this.predictionReady=true;
      const snapshot=decode(bytes);this.hordeFrame(snapshot);this.snapshot=snapshot;this.receivedAt=performance.now();this.link.heard(this.receivedAt);this.onSnapshot(snapshot);
    });
    activeRoom.onMessage('resync',(bytes:Uint8Array)=>{
      if(this.room!==activeRoom)return;
      this.awaitingInputResync=false;this.predictionReady=true;
      const snapshot=decode(bytes);this.hordeFrame(snapshot);this.snapshot=snapshot;this.receivedAt=performance.now();this.link.heard(this.receivedAt);this.onSnapshot(snapshot);
    });
    activeRoom.onDrop(()=>{if(this.room===activeRoom){this.receivedAt=-Infinity;this.predictionReady=false;this.awaitingInputResync=true;this.onControlReset();}});
    activeRoom.onReconnect(()=>{
      // The SDK may already have queued a retry when the player leaves.
      // Close that late connection instead of reviving an abandoned actor.
      if(this.room!==activeRoom){queueMicrotask(()=>{if(activeRoom.connection.isOpen)void activeRoom.leave();});return;}
      lastError=undefined;
      // Keep the existing HUD in RECONNECTING until a fresh snapshot arrives.
      this.receivedAt=-Infinity;
      this.askResync(activeRoom);
    });
    activeRoom.onLeave(code=>{
      socialLeft(activeRoom);
      if(this.room!==activeRoom)return;
      clearInterval(this.pingTimer);
      this.room=null;this.snapshot=null;this.receivedAt=0;this.predictionReady=false;
      // The SDK's last transport error is the server's own wording ("seat reservation expired."): logged, not shown.
      if(lastError)console.warn(`Room closed (${code}): ${lastError}`);
      // A room that gave up on this page's loading (AssetGate, 90 s) is an error report: a stall (boot/errorReports.ts).
      if(code===4008)errorReports.report('stall','the match did not load within 90 s, and the server closed the room (4008)');
      this.onDisconnect(closeMessage(code),code);
    });
    // SDK transport errors can precede its recoverable onDrop. Only terminal
    // onLeave ends the game session; individual retry errors do not open the lobby.
    activeRoom.onError((_code,message)=>{if(this.room===activeRoom)lastError=message;});
    activeRoom.onMessage('input-rejected',()=>{
      if(this.room!==activeRoom||this.awaitingInputResync)return;
      this.predictionReady=false;this.awaitingInputResync=true;this.onControlReset();
      this.askResync(activeRoom);
    });
    activeRoom.onMessage('notice',(notice:unknown)=>{
      if(this.room!==activeRoom||typeof notice!=='object'||notice===null)return;
      const message=(notice as {message?:unknown}).message;if(typeof message==='string')this.onNotice(message);
    });
  }
  /** Round 5 (SOLOPAUSE): a pause or resume request for a room that pauses for its one human (PauseLink), and this
   *  page's word that its fight is on screen (`ready`, ReadyGate) - a versus room's only: the co-op and team rooms
   *  have their own start. */
  control(request:{type:'pause'|'resume';n:number}){if(this.room?.connection.isOpen)this.room.send(request.type,{n:request.n});}
  ready(){if(!this.coop&&this.room?.connection.isOpen&&!(this.snapshot&&('objective' in this.snapshot||'rift' in this.snapshot||'ball' in this.snapshot)))this.room.send('ready');}
  objectiveCommand(action:'start'|'role'|'rematch',role?:RolePreference){if(this.room?.connection.isOpen)this.room.send('objective-'+action,role);}
  startPrivateMatch(){if(this.room?.connection.isOpen)this.room.send('start-private-match');}
  /** Co-op: take a card (or none), say the next act is loaded, take the party back to the lobby. */
  choose(card?:string){if(this.coop&&this.room?.connection.isOpen)this.room.send('choose',card??null);}
  reroll(){if(this.coop&&this.room?.connection.isOpen)this.room.send('reroll',null);}
  loaded(run:number){if(this.coop&&this.room?.connection.isOpen)this.room.send('loaded',run);}
  backToLobby(){if(this.coop&&this.room?.connection.isOpen)this.room.send('lobby');}
  send(input:PlayerInput){if(!this.predictionReady||!this.room?.connection.isOpen)return false;this.room.send('input',input);return true;}
  async leave(){
    clearTimeout(this.resyncTimer);clearInterval(this.pingTimer);
    this.generation++;const room=this.room;this.room=null;this.snapshot=null;this.plannedBots=[];this.receivedAt=0;this.predictionReady=false;this.awaitingInputResync=false;this.coop=false;this.hordeFrames.clear();this.hordeEvents=[];
    if(COOP_LINK.room===room)COOP_LINK.room=undefined;if(COOP_LINK.match===room)COOP_LINK.match=undefined;socialLeft(room);
    if(!room)return;
    room.reconnection.enabled=false;
    room.reconnection.enqueuedMessages=[];
    // (Kept for the reload: the page closing drops the socket, and the room holds the seat for the page that comes back.)
    if(room===this.kept){this.kept=null;return;}
    if(room.connection.isOpen)await room.leave();
  }
}

export class LocalTraining {
  readonly local = true;
  room: { send(type: string, payload?: unknown): void } | null = null;
  snapshot: GameSnapshot | null = null;
  receivedAt = 0;
  predictionReady = false;
  sim: ArenaSimulation | null = null;
  onSnapshot = (_snapshot: GameSnapshot) => {};
  onControlReset = () => {};
  onDisconnect = (_reason: string) => {};
  onNotice = (_message: string) => {};
  /** Held while settings are open or the tab is hidden. */
  paused = false;
  private forge?: { dispose(): void; readonly carried: { open: boolean; dummyWas?: string } };
  private makeForge?: (body: FighterId, carried: { open?: boolean; dummyWas?: string }) => NonNullable<LocalTraining['forge']>;
  /** A slot pressed for the local player by the Forge studio (press). */
  private pressed?: AttackSlot;
  /** A content pack's kits in play for this session (src/engine/packs/session.ts), when a pack is on the page. */
  private packKits?: { restore(): void };
  get id() { return this.sim ? LocalTraining.PLAYER : ''; }
  static readonly PLAYER = 'you';
  partner?: FighterId;
  second: () => PlayerInput | undefined = () => undefined;
  /** Whether training should run here rather than in a room on the match server. */
  static wanted() {
    const query = new URLSearchParams(typeof location === 'object' ? location.search : '');
    if (laboratoryFighter()) return true;
    if (query.has('online-training')) return false;
    if (query.has('local-training')) return true;
    return !(typeof navigator === 'object' && navigator.webdriver);
  }
  /** `tutorial`: LEARN TO FIGHT (src/tutorial/GuidedFightRun.ts drives its dummy): the Proving Hall, whatever place the
   *  sheet named, and no Forge studio. */
  async connect(fighter: FighterId, name: string, playerTwo?: FighterId, options: { tutorial?: boolean } = {}) {
    const laboratory = laboratoryFighter();
    if (!laboratory || fighter !== laboratory) requireReleasedFighter(fighter);
    if (playerTwo !== undefined) requireReleasedFighter(playerTwo);
    await this.leave();
    this.partner = playerTwo;
    const pack = activePack();
    if (pack) {
      const { PackSession } = await import('./engine/packs/session');
      const session = new PackSession(), applied = session.apply(pack);
      if (applied.ok) this.packKits = session; else console.warn(`[packs] ${pack.id}: kits not applied`, applied.errors);
    }
    // Training is the Proving Hall unless the player chose a place on its sheet (LOCATION: a place, or RANDOM - the default - which
    // deals one; trainingPlace; the fighter laboratory keeps the hall), as the server's training room always is. A dev build can be asked for another place
    // to look at and listen to (?training-stage=mirror-mere); a release build ignores it.
    const asked = import.meta.env.DEV && typeof location === 'object' ? new URLSearchParams(location.search).get('training-stage') : null;
    const stage = launchStage(asked && asked in STAGES ? asked as StageId : (laboratory || options.tutorial ? undefined : trainingPlace()) ?? chooseStage([], 'training'));
    const { createRapierCollision } = await import('./game/rapierCollision');
    // Lock combat (the experiment's preview, game/lockMode.ts): the offline Training Ground plays it for its fighters.
    const sim = new ArenaSimulation({ roomMode: 'training', stage, collision: await createRapierCollision(stage), maxStamina: COMBO_STAMINA, maxHp: COMBO_HP,
      ...(lockCombatOn() ? { lockCombat: true } : {}), ...(this.partner ? { trainingBot: false } : {}) });
    sim.addPlayer(LocalTraining.PLAYER, fighter, name);
    // Couch: the two people, face to face, and nobody else.
    if (this.partner) { sim.addPlayer(SECOND, this.partner, 'Player 2'); sim.seatPair(LocalTraining.PLAYER, SECOND); }
    const roster = activePackRoster(), rival = trainingRival();
    const packed = roster && (rival && roster.includes(rival as FighterId) ? rival : roster[(roster.indexOf(fighter) + 1) % roster.length]);
    const partner = (import.meta.env.DEV && typeof location === 'object' ? new URLSearchParams(location.search).get('training-bot') : null) ?? packed ?? rival;
    const sparring = sim.actors.get('sparring-bot');
    if (sparring && partner && isReleasedFighter(partner) && !HELD.has(partner as FighterId)) { sparring.state.fighter = partner as FighterId; sparring.state.size = BODY_SIZE[partner as FighterId]; }
    this.sim = sim;
    // The training panel's commands (reset, the bot's mode, the meters) go straight to the arena, as the room's
    // 'training' message hands them to it; nothing else a room is sent means anything here.
    this.room = { send: (type: string, payload?: unknown) => { if (type === 'training') this.command(payload); } };
    // A dev build can end the practice as the player's win (`window.trainingVictory()`, scripts/roan/capture.mjs's
    // `victory` step): the winner's pose and the camera's victory shot, which training never otherwise reaches.
    if (import.meta.env.DEV && typeof window === 'object') (window as unknown as { trainingVictory?: () => void }).trainingVictory = () => {
      if (this.sim) { this.sim.status = 'finished'; this.sim.winnerId = LocalTraining.PLAYER; }
    };
    this.predictionReady = true;
    this.publish();
    if (typeof document === 'object' && !this.partner && !options.tutorial) void import('./ui/forge/ForgeStudio').then(({ ForgeStudio }) => {
      if (this.sim !== sim) return;
      this.makeForge = (body, carried) => new ForgeStudio({ body, playerId: LocalTraining.PLAYER, dummyId: 'sparring-bot', ...carried,
        command: command => this.sim?.trainingCommand(LocalTraining.PLAYER, command), press: slot => this.press(slot), snapshot: () => this.snapshot, paused: () => this.paused });
      // (For the body the player is in now: a switch made while this chunk was on its way is not lost.)
      this.forge = this.makeForge(sim.actors.get(LocalTraining.PLAYER)?.state.fighter ?? fighter, { open: forgeWanted() });
    }, error => console.warn('[forge] the studio could not load', error));
  }
  /** A training command, straight to the arena. One that changes the player's own fighter (the switch: TrainingLab's
   *  `swap-self`) takes the Forge studio with it: the old body's own moves are put back, exactly, before anything is
   *  stepped (a forged move never outlives its body), and the studio is made again for the new body - open if it was
   *  open, the dummy still held as it was, the new body's kept draft back in play as when Training starts with it. */
  private command(payload: unknown) {
    const sim = this.sim;
    if (!sim) return;
    const body = () => sim.actors.get(LocalTraining.PLAYER)?.state.fighter, before = body();
    sim.trainingCommand(LocalTraining.PLAYER, payload);
    const now = body();
    if (!now || now === before || !this.forge || !this.makeForge) return;
    const carried = this.forge.carried;
    this.forge.dispose();
    this.forge = this.makeForge(now, carried);
  }
  /** One press of a slot for the local player, aimed at the sparring dummy (the Forge studio's tries), sent once with
   *  the next command. Input only: the arena plays it as it plays any press. */
  press(slot: AttackSlot) { this.pressed = slot; }
  /** One command, one tick of the arena - or none while paused. */
  send(input: PlayerInput) {
    const sim = this.sim;
    if (!sim) return false;
    if (!this.paused) {
      const pressed = this.pressed; this.pressed = undefined;
      sim.submitInput(LocalTraining.PLAYER, pressed ? { ...input, attack: pressed, targetId: 'sparring-bot', lock: true } : input);
      if (this.partner) { const other = this.second(); if (other) sim.submitInput(SECOND, other); }
      sim.step(1 / SIMULATION_HZ);
    }
    this.publish();
    return true;
  }
  private publish() {
    if (!this.sim) return;
    const snapshot = this.sim.snapshot(true);
    this.snapshot = snapshot; this.receivedAt = performance.now();
    this.onSnapshot(snapshot);
  }
  /** No private match to start in training. */
  startPrivateMatch() {}
  async leave() {
    this.forge?.dispose(); this.forge = undefined; this.makeForge = undefined; this.pressed = undefined; this.partner = undefined; this.second = () => undefined;
    this.packKits?.restore(); this.packKits = undefined;
    this.sim?.dispose(); this.sim = null; this.room = null;
    this.snapshot = null; this.receivedAt = 0; this.predictionReady = false; this.paused = false;
  }
}
