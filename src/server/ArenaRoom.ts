import { roomKit } from './forge/roomKit';
import { requireRosterProtocol, type RosterProtocolOptions } from '../game/rosterProtocol';
import { isReleasedFighter } from '../game/rosterAvailability';
import {draftBots} from '../game/matchmaking';
export {draftBots} from '../game/matchmaking';
import {RoomRewards} from './economy/RoomRewards';
import {DuelSet} from '../game/duel/DuelSet';
import {AssetGate} from './social/AssetGate';
import {EmoteRelay,SOCIAL_PROTOCOL} from './social/EmoteRelay';
import {RivalryWatch} from './social/RivalryWatch';
import {RoomAgain} from './social/RoomAgain';
import {QueueHold} from './social/QueueHold';
import {CustomLobby} from './social/CustomLobby';
import {PartyStart,PARTY_COUNTDOWN} from './social/PartyStart';
import {BOT_SKILL,customRules,duelStage,votedArena,type CustomLobby as CustomView} from '../game/social/custom';
import { MOVES } from '../game/moves';
import { Room, type Client, type FixedTimestepCallback } from 'colyseus';
import { ArenaSimulation, LAG_COMPENSATION } from '../game/simulation';
import { LOCK_ONLINE } from './lockOnline';
import { buildCollision, createRapierCollision } from '../game/rapierCollision';
import { STAGES, RoyaleDeck, DuelDeck, chooseStage, seriesStage, type StageId } from '../game/stages';
import { COMBO_HP, COMBO_STAMINA, KO_HEAL, MAX_PLAYERS, MIN_MATCH_FIELD, SIMULATION_HZ, SNAPSHOT_HZ } from '../game/moves';
import type { FighterId, GameSnapshot, RoomMode } from '../game/types';
import { privateCodes, PRIVATE_WAIT_SECONDS } from './privateCodes';
import {InputQueue} from './InputQueue';
import { roomName, sharedEconomy } from './economy/api';
import { freshAccount } from './cluster/economyLink';
import { outfitFor } from '../game/economy/outfits';
import { lockedOut } from '../game/economy/fighters';
import { owns } from '../game/economy/account';
import {StepClock} from './StepClock';
import {SoloPause} from './SoloPause';
import {ReadyGate,READY_SECONDS,LATE_HOLD_SECONDS} from './ReadyGate';
import {RoomFaults} from './RoomFaults';
import {ResyncGate} from './ResyncGate';
import {netStats} from './netStats';
import {capacity} from './capacity';
import type {RoomException,RoomMethodName} from 'colyseus';
import {movedStage,roomStage} from '../originals/server';

interface JoinOptions extends RosterProtocolOptions { mode?: RoomMode; fighter?: FighterId; name?: string; code?:string; creationToken?:string; players?:number;
  /** The page's account token (the shop's): a fighter bought in the shop plays only for the account that owns them. */
  account?: string; rules?:unknown;assetGate?:boolean;
  /** The player's skill as their page keeps it (src/game/adaptive.ts): the room's bots stand ahead of it. */
  skill?: unknown;
  /** A private Duel's place (a party's DUEL chooses it): one of DUEL_ARENAS, else the tournament ring (duelStage). */
  stage?:unknown;
  /** A party's launch (PartyRoom): the members it reserved seats for. The room starts by itself once they are all in
   *  and loaded (PartyStart). */
  party?:unknown;
  /** Round 5 (SOLOPAUSE): the page says `ready` once its fight is on screen (ReadyGate). */
  readyGate?:boolean;
  forge?:unknown }
export const RECONNECTION_SECONDS = 15;
/** Roster sizes offered for a battle royale against bots. Twelve is the arena's
 *  own ceiling; four is the smallest count that still reads as a royale rather
 *  than as a duel with witnesses. */
export const BOT_ROYALE_SIZES = [4, 6, 8, 10, 12] as const;
/** How many fighters a private room's host may ask for: a duel, or a royale of
 *  four, eight or twelve. The seats friends do not take are bots at kickoff. */
export const PRIVATE_ROOM_SIZES = [2, 4, 8, 12] as const;
/** Long enough to read the drop, short enough that a solo player is not kept
 *  waiting for an opponent who is already standing on the stage. */
const BOT_ROYALE_COUNTDOWN = 4;
/** Seconds of countdown a bot room keeps for a player who finished loading after it had run out. */
const LOADED_COUNTDOWN = 3;
/** A public match counts down from the moment anyone is in it. Two or more
 *  humans start on the shorter clock; a lone entrant waits a little longer
 *  for company, and gets bots at kickoff if none comes. */
export const MATCH_COUNTDOWN = 15;
export const SOLO_COUNTDOWN = 20;
export const FINISHED_ROOM_SECONDS = 300;
/** The close code the room ends with then. The page knows it (src/network.ts closeMessage): it keeps the results card on
 *  screen, says nothing, and every button on it starts the next thing without this room. Not a code the SDK reconnects on. */
export const FINISHED_ROOM_CLOSE = 4006;
/** Round 4 (STAGES): the famous place the last royale room on this server was
 *  dealt, so the next is dealt another ("avoiding the same map twice in a
 *  row"). Round 4b (MAPS): from a deck, so each comes up in turn (see
 *  RoyaleDeck). Server memory only; a restart forgets it. */
const royaleDeck = new RoyaleDeck();
/** 24 October 2026: an online Duel's ring, dealt in turn from the duelling rings (stages.ts ONLINE_DUEL_STAGES). */
const duelDeck = new DuelDeck();
const BOT_NAMES = ['Rival','Challenger','Contender','Duelist','Upstart','Veteran','Prospect','Outsider','Wildcard','Rogue','Drifter'];

export class ArenaRoom extends Room {
  private inputQueues=new Map<string,InputQueue>();
  /** Clients told their input was rejected and not yet resynchronised (see the 'input' handler). */
  private rejected=new Set<string>();
  /** When a bot room's player was first ready to play (see LOADED_COUNTDOWN). */
  private readyAt:number|null=null;
  /** Identifies the live fixed-step loop; bumped to retire it. */
  private loop=0;
  simulation!: ArenaSimulation;
  private duelSet?:DuelSet;
  private rewards=new RoomRewards();
  private startAt: number | null = null;
  private dropped = new Set<string>();
  protected privateRoom=false;
  /** Forged fighters' codes in this room, by kit hash (VOL.5). */
  private forgeCodes=new Map<string,string>();
  /** Dedicated Duel queues never fill with bots or accept a third fighter. */
  protected duelRoom=false;
  /** A solo room filled with bots: one human seat, no matchmaking, and the
   *  match starts on its own because there is nobody else to wait for. */
  protected botRoom=false;
  private botSeats=0;
  private code?:string;
  private creationToken?:string;
  private hostId:string|null=null;
  /** A party's room starts by itself (PartyStart); every other room is never armed. */
  private partyStart=new PartyStart(undefined,0);
  private expiring=false;
  /** When the room's match was last seen to stand over (its clock; null while it is not): see FINISHED_ROOM_SECONDS. */
  private overAt:number|null=null;
  /** A private room's fighters in all, as its host chose (PRIVATE_ROOM_SIZES):
   *  its seats, and the field bots fill to at kickoff. Unset (an older
   *  client's room), it seats twelve and fills nothing. */
  private roomSize?:number;
  private custom?:CustomLobby;
  private assets!:AssetGate;
  private rosterPrepared=false;
  /** A public match's bots, drafted while its countdown runs (planBots), and whose picks they were drafted around. */
  private plannedBots:FighterId[]=[];
  private planKey='';
  private activeAt:number|null=null;
  /** Round 5 (SOLOPAUSE): the pause a room with one human honours, and who has the fight on screen. (Optional, as the
   *  custom lobby is: the lifecycle tests' fixture builds a room without its onCreate.) */
  private pause?:SoloPause;
  private ready?:ReadyGate;
  /** A throw in the step is logged and contained, and a room that keeps faulting is closed (RoomFaults). */
  private faults=new RoomFaults(this);
  /** `resync-input`'s answers, rationed (ResyncGate; optional as the pause is). */
  private resync?:ResyncGate;
  /** Emotes passed to the other pages in the room (social/EmoteRelay; optional as the pause is). */
  private emotes?:EmoteRelay;
  /** A Duel's or a friends' room's head-to-head records (social/RivalryWatch): every other room has none. */
  private rivals?:RivalryWatch;
  /** A friends' royale's next match in the same room (social/RoomAgain): every other room has none. */
  private again?:RoomAgain;
  /** When a private room's lobby last opened - its first, or a next match's - on its clock: its fifteen minutes run from here. */
  private lobbyAt=0;
  /** A lone entrant's start, held while a player on standby is offered to join (social/QueueHold). */
  private hold=new QueueHold();

  async onCreate(options: JoinOptions = {}) {
    requireRosterProtocol(options.rosterProtocol);
    const mode: RoomMode = this.duelRoom || this.privateRoom || this.botRoom || options.mode === 'match' ? 'match' : 'training';
    if(this.botRoom){
      const asked=Number(options.players);
      // The client offers five sizes; anything else is a forged join, and the
      // smallest roster is the safe answer to one.
      this.botSeats=(BOT_ROYALE_SIZES as readonly number[]).includes(asked)?asked-1:BOT_ROYALE_SIZES[0]-1;
    }
    if(this.privateRoom){
      if(typeof options.creationToken!=='string'||!/^[-0-9a-f]{36}$/i.test(options.creationToken))throw new Error('Create a private room from the lobby.');
      capacity.admit(this); // Night cap: after the checks that can throw, before a code is dealt (ROOM_CAP / LOAD_SHED turn a NEW room away; src/server/capacity.ts)
      this.creationToken=options.creationToken;this.code=privateCodes.allocate();this.roomId=`${this.duelRoom?'duel':'private'}-${this.code}`;
      const asked=Number(options.players);
      if((PRIVATE_ROOM_SIZES as readonly number[]).includes(asked))this.roomSize=asked;
    }else capacity.admit(this);
    if(this.duelRoom){this.roomSize=2;this.duelSet=new DuelSet();}
    // Training is one player's own, like a bot room: one seat until its
    // player is in (see onJoin), and hidden from matchmaking below. Round 3b:
    // it used to offer eleven public seats, so a joinOrCreate found somebody
    // else's practice with a seat free - and two players pressing play at the
    // same moment were put together by the matchmaker's own concurrency
    // lock, which hands the room one of them is creating to the other.
    this.maxClients = this.botRoom || mode === 'training' ? 1 : this.roomSize ?? MAX_PLAYERS;
    // A private room needs two to start; a party's launch says how many it sent.
    if (this.privateRoom) this.partyStart = new PartyStart(options.party, this.maxClients, 2);
    this.maxMessagesPerSecond = 320;
    this.autoDispose = true;
    try {
      // Training is always the Proving Hall. Round 4 (STAGES): a match is dealt
      // its place now, off its own seeded stream, and keeps it - it used to
      // wait in the harbour and move at kickoff, so every royale player
      // downloaded and uploaded the harbour (23 MB, ~250 MB of GPU memory)
      // before the stage they fought on. The only later moves: a bot room's
      // field, read the moment its player joins and before that player's
      // first snapshot, can take its series' own place; a private room's vote
      // is counted at kickoff; a host who names an arena moves the room there.
      if (mode === 'training') {
        const stage = roomStage(chooseStage([], mode));
        this.simulation = new ArenaSimulation({ roomMode: mode, stage, collision: await createRapierCollision(stage), maxStamina: COMBO_STAMINA, maxHp: COMBO_HP, lockCombat: LOCK_ONLINE });
        this.simulation.rewind = LAG_COMPENSATION;
      } else {
        // A royale heals a knockout's scorer (KO_HEAL); a Duel does not.
        this.simulation = new ArenaSimulation({ roomMode: mode, maxStamina: COMBO_STAMINA, maxHp: COMBO_HP, koHeal: this.duelRoom ? 0 : KO_HEAL, lockCombat: LOCK_ONLINE });
        this.simulation.rewind = LAG_COMPENSATION;
        const named = this.privateRoom ? customRules('royale', options.rules).arena : 'auto';
        const stage = roomStage(this.duelRoom ? (this.privateRoom ? duelStage(options.stage) : duelDeck.deal(pool => this.simulation.pick(pool))) : named !== 'auto' && named !== 'vote' ? named : royaleDeck.deal(pool => this.simulation.pick(pool), this.botRoom ? this.botSeats + 1 : undefined), this.duelRoom);
        this.simulation.setStage(stage, await createRapierCollision(stage));
      }
      // A bot room is nobody else's to join, so it is hidden from matchmaking
      // for the same reason a private room is - and so is a training room.
      const own=this.privateRoom||this.botRoom||mode==='training';
      if(own)await this.setPrivate(true);
      await this.setMetadata({ mode, visibility:own?'private':'public', map: this.simulation.stage, humanCapacity: this.maxClients, botCount: this.botRoom ? this.botSeats : mode === 'training' ? 1 : 0 });
    } catch(error){if(this.code)privateCodes.release(this.code);capacity.release(this);this.simulation?.dispose();throw error;}
    if(this.privateRoom&&!this.duelRoom)this.custom=new CustomLobby(this,'royale',options.rules,()=>this.hostId,()=>this.simulation.status==='waiting'&&this.startAt===null&&!this.rosterPrepared);
    // (Someone in starts the finished room's wait again, as a Duel's runback does: the host has the whole of it to answer.)
    if(this.privateRoom&&!this.duelRoom)this.again=new RoomAgain(this,()=>this.hostId,()=>this.simulation.status==='finished'&&!this.expiring,players=>this.nextMatch(players),()=>{this.overAt=this.simulation.serverTime;});
    this.assets=new AssetGate(this);this.emotes=new EmoteRelay(this);if(this.duelRoom||this.privateRoom)this.rivals=new RivalryWatch(this.duelRoom?'duel':'private');
    // Round 5 (SOLOPAUSE): a room whose humans number one pauses for them, really (SoloPause: no tick, no bot, no
    // clock while frozen); a page that asks says when its fight is on screen (ReadyGate), for the READY hold below.
    this.ready=new ReadyGate(this,()=>this.simulation.serverTime);
    this.pause=new SoloPause({solo:()=>this.soloHuman(),open:()=>this.pauseOpen(),queued:id=>this.inputQueues.get(id)?.length??0,
      frozen:()=>{for(const queue of this.inputQueues.values())queue.clear();this.sendSnapshots();},thawed:ms=>{this.assets.shift(ms);this.sendSnapshots();},beat:()=>this.sendSnapshots()});
    this.onMessage('pause',(client,raw:unknown)=>this.pause?.request(client,raw,true));
    this.onMessage('resume',(client,raw:unknown)=>this.pause?.request(client,raw,false));
    this.onMessage('start-private-match',client=>this.requestPrivateStart(client));
    // (Every room that says `social` takes it, or its socket would be closed; only a public royale's lone wait is held.)
    this.onMessage('queue-hold',()=>{if(!this.privateRoom&&!this.duelRoom&&!this.botRoom&&this.simulation.roomMode==='match'&&this.simulation.status==='waiting'&&!this.rosterPrepared&&this.clients.length===1)this.hold.ask(this.simulation.serverTime,this.startAt);});
    this.onMessage('input', (client, raw: unknown) => {
      // No input while frozen (SoloPause): its page sends none, and nothing sent then is played later.
      if (this.pause?.frozen) return;
      // One rejection asks for one resync: commands bunched by a stall used to draw one each, sixty-eight of them
      // on top of the backlog the stall had left, to a client that ignores all but the first.
      if (this.inputQueues.get(client.sessionId)?.push(raw)) return;
      if (this.rejected.has(client.sessionId)) return;
      this.rejected.add(client.sessionId);
      client.send('input-rejected', { reason: 'Invalid, stale or excess input' });
    });
    // A whole snapshot for its client, at most one each RESYNC_MS; one asked for inside that is sent when it ends (ResyncGate).
    this.resync=new ResyncGate(this,client=>{
      this.rejected.delete(client.sessionId);
      this.inputQueues.get(client.sessionId)?.clear();
      this.simulation.clearPlayerInput(client.sessionId);
      client.send('input-resync',this.forOwner(this.snapshot(),client.sessionId));
    });
    // (The training tools live in the pause menu: a frozen room shows what they did at once.)
    this.onMessage('training', (client, command:unknown)=>{this.simulation.trainingCommand(client.sessionId,command);if(this.pause?.frozen)this.sendSnapshots();});
    // The page's account (the economy, on this server): the outfit the player wears for their fighter, if it is theirs.
    this.onMessage('account', (client, token: unknown) => freshAccount(token, () => this.dress(client, token), () => this.clients.includes(client)));
    // (One of the two asking for it starts the finished room's wait again: the other has the whole of it to answer.)
    this.onMessage('duel-runback',client=>{const asked=this.duelSet?.view.runback.length??0;if(this.duelSet?.request(this.simulation,client.sessionId)){for(const queue of this.inputQueues.values())queue.clear();}else if((this.duelSet?.view.runback.length??0)>asked)this.overAt=this.simulation.serverTime;this.sendSnapshots();});
    this.onMessage('ping', (client, raw: unknown) => {
      if (typeof raw === 'number' && Number.isFinite(raw)) client.send('pong', { clientTime: raw, serverTime: this.simulation.serverTime });
    });
    // (Guarded: a throw here used to end every room on the server - see RoomFaults.)
    this.setFixedTimestep(({ dt }) => this.faults.guard(() => {
      // Frozen: nothing is read, stepped, counted down or thought (SoloPause sends the unchanged snapshot meanwhile).
      if (this.pause?.hold()) return;
      const waiting=new Set<string>();
      for(const [id,queue] of this.inputQueues){
        const input=queue.take();
        if(input){this.simulation.submitInput(id,input);this.rewards.input(id,input);}else waiting.add(id);
      }
      // A fault in the rules is logged, not left to stop the room's clock (the snapshot still goes out).
      try { this.simulation.step(dt,waiting); } catch (error) { this.faults.fault(error); }
      this.customTimer();
      const human=this.botRoom&&this.simulation.status==='waiting'?this.soloHuman():undefined;
      if (human!==undefined&&this.ready?.gated(human)) {
        // Round 5 (SOLOPAUSE): READY -> FIGHT. A page that says when its fight is on screen gets the whole hold from
        // that moment - its models in (the asset barrier) and its loading screen gone (`ready`) - and then FIGHT, at
        // the server's word (MatchIntro plays the VS splash over the hold and FIGHT! on the status going active).
        // The countdown used to run from the join, and a load that ended inside half a second of it ran straight
        // into the fight with no hold at all.
        const now=this.simulation.serverTime;
        if (this.startAt === null) {
          if (this.assets.ready(this.simulation.snapshot()) && this.ready.ready([human])) { this.readyAt = now; this.startAt = now + READY_SECONDS; }
        } else if (now >= this.startAt && this.simulation.startMatch()) { this.startAt=null;void this.lock();
          this.broadcast('notice', { message: `Battle royale in ${STAGES[this.simulation.stage].name} — ${this.botSeats} rivals, one life each` }); }
      } else if (this.botRoom && this.simulation.status === 'waiting') {
        // One human and a field of bots: the only thing worth waiting for is
        // the countdown, and it only starts once the human is actually here.
        if (this.startAt !== null && this.simulation.serverTime >= this.startAt) {
          this.applyStage();
          if (this.assets.ready(this.simulation.snapshot())) {
            if (this.readyAt === null) {
              this.readyAt = this.simulation.serverTime;
              if (this.readyAt > this.startAt + .5) this.startAt = this.readyAt + LOADED_COUNTDOWN;
            }
            if (this.simulation.serverTime >= this.startAt && this.simulation.startMatch()) { this.startAt=null;void this.lock();
              this.broadcast('notice', { message: `Battle royale in ${STAGES[this.simulation.stage].name} — ${this.botSeats} rivals, one life each` }); }
          }
        }
      } else if (this.simulation.roomMode === 'match' && this.simulation.status === 'waiting') {
        // A public match counts down from one human; a private one still
        // waits for its host and at least one guest.
        const entrantsReady = this.clients.length >= (this.privateRoom || this.duelRoom ? 2 : 1) && this.dropped.size === 0;
        if (!entrantsReady) { this.startAt = null; this.hold.reset(); }
        if (!this.privateRoom && entrantsReady) {
          // A lone entrant waits the longer clock; the moment a second human
          // is in, the shorter one applies - never later than it already was.
          const at = this.simulation.serverTime + (this.duelRoom ? 3 : this.clients.length >= 2 ? MATCH_COUNTDOWN : SOLO_COUNTDOWN);
          this.startAt = this.startAt === null ? at : Math.min(this.startAt, at);
          // A lone entrant's start, held while a player on standby is asked to join (social/QueueHold).
          if (this.clients.length === 1) this.startAt = this.hold.apply(this.startAt);
        }
        if (!this.privateRoom && !this.duelRoom && this.startAt !== null && !this.rosterPrepared) this.planBots();
        // Round 4 (STAGES): a host who names an arena moves the waiting room
        // there at once, so its fighters load it while they wait (a vote is
        // only counted at kickoff: following it live would load every arena
        // the lead passed through).
        if(this.custom){const named=this.custom.view.rules.arena;if(named!=='auto'&&named!=='vote'&&named!==this.simulation.stage&&!this.rosterPrepared)this.applyStage();}
        // A party's room needs no START: everyone it sent in, loaded and on screen (the gates the host's START waits
        // for), then the same short count. A drop during the count stops it, and it runs again once they are back.
        if(this.partyStart.waiting&&this.startAt===null&&entrantsReady&&this.partyStart.complete(this.clients.length,this.dropped.size)){
          const present=this.clients.map(client=>client.sessionId);
          if(this.assets.ready(this.simulation.snapshot())&&(this.ready?.ready(present)??true)){
            this.startAt=this.simulation.serverTime+PARTY_COUNTDOWN;
            this.broadcast('notice',{message:`Everyone is here — the ${this.duelRoom?'duel':'match'} starts in ${PARTY_COUNTDOWN} seconds.`});
          }
        }
        if(this.privateRoom&&this.simulation.serverTime-this.lobbyAt>=PRIVATE_WAIT_SECONDS&&!this.expiring){
          this.expiring=true;this.broadcast('notice',{message:'Private room expired after 15 minutes in the lobby. Create a new room.'});
          void this.disconnect(4004);return;
        }
        if (this.startAt !== null && entrantsReady && (this.simulation.serverTime >= this.startAt || (!this.privateRoom&&this.clients.length === MAX_PLAYERS))) {
          // Bots fill the field at the kickoff instant and not before, so a
          // human who joins during the countdown never has to displace one.
          // Before the stage is chosen and the spawn pass runs: both read the
          // final roster.
          if(!this.rosterPrepared){
          if (!this.privateRoom&&!this.duelRoom) this.fillWithBots(Math.max(0, MIN_MATCH_FIELD - this.simulation.actors.size));
          else if (this.roomSize) this.fillWithBots(Math.max(0, this.roomSize - this.simulation.actors.size));
          // The stage has to be chosen and its collision installed before the
          // spawn pass, or fighters are placed against the previous arena.
          this.applyStage();this.rosterPrepared=true;void this.lock();
          }
          // Round 5 (SOLOPAUSE): and every page that asked has its fight on screen (ReadyGate, capped); one that came
          // up late is held LATE_HOLD_SECONDS before the kickoff, its clock shown to everyone - nobody is in the fight
          // before their own screen is.
          const present=this.clients.map(client=>client.sessionId);
          const loaded=this.assets.ready(this.simulation.snapshot())&&(this.ready?.ready(present)??true);
          const settled=loaded&&this.ready?this.ready.lastShown(present)+LATE_HOLD_SECONDS:-Infinity;
          if(settled>this.simulation.serverTime&&settled>this.startAt!)this.startAt=settled;
          if(this.duelRoom&&loaded&&this.readyAt===null){this.readyAt=this.simulation.serverTime;if(this.readyAt>this.startAt!+.5)this.startAt=this.readyAt+3;}
          if (loaded&&this.simulation.serverTime>=settled&&(!this.duelRoom||this.simulation.serverTime>=this.startAt!)&&this.simulation.startMatch()) {
            this.startAt=null;void this.lock();this.partyStart.started();
            const bots = this.botCount();
            this.broadcast('notice', { message: `Match started in ${STAGES[this.simulation.stage].name} — one life per fighter${bots ? `, ${bots} bot${bots === 1 ? '' : 's'} filling the field` : ''}` });
          }
        }
      }
      this.duelSet?.step(this.simulation);
      // Over, and nothing new begun in it since, for FINISHED_ROOM_SECONDS: the room ends, its people keeping their results.
      if(this.overFor()>=FINISHED_ROOM_SECONDS&&!this.expiring){this.expiring=true;void this.disconnect(FINISHED_ROOM_CLOSE);return;}
      if (this.simulation.tick % (SIMULATION_HZ / SNAPSHOT_HZ) === 0) this.sendSnapshots();
    }), SIMULATION_HZ);
  }

  /** Colyseus's room-level handler: a throw in a message handler, a clock event or a leave is logged and contained. */
  onUncaughtException(error:RoomException,method:RoomMethodName){this.faults.report(error,method);}

  /** Every client its own copy of the snapshot (forOwner), with the events since the last. */
  private sendSnapshots(){
    const began=performance.now();
    const snapshot=this.snapshot(true);if(this.simulation.roomMode==='match'){this.rewards.observe(snapshot);this.rivals?.observe(snapshot,this.rewards.matchId);}
    for(const client of this.clients)client.send('snapshot',this.forOwner(snapshot,client.sessionId));
    netStats.onSnapshots(performance.now()-began);
  }

  /** Seconds the room's match has stood over, on its own clock (0 while it has not): a match room's end, a Duel's once its
   *  set is decided (a round's end is only the three-second interval before the next). */
  private overFor(){
    const sim=this.simulation,over=sim.roomMode==='match'&&sim.status==='finished'&&(!this.duelSet||this.duelSet.view.phase==='complete');
    if(!over){this.overAt=null;return 0;}
    this.overAt??=sim.serverTime;return sim.serverTime-this.overAt;
  }

  /** Round 5 (SOLOPAUSE): the room's one human - bots never count, a dropped human holding a reconnection does - or
   *  undefined when it has none or several. */
  private soloHuman(){
    let id:string|undefined;
    for(const actor of this.simulation.actors.values())if(!actor.state.isBot){if(id!==undefined)return undefined;id=actor.state.id;}
    return id;
  }
  /** Round 5 (SOLOPAUSE): a pause is for a fight, or a bot room's READY hold - never a lobby gathering company, never
   *  the results. */
  private pauseOpen(){
    if(this.expiring)return false;
    return this.simulation.status==='active'||(this.botRoom&&this.simulation.status==='waiting');
  }

  /** The fixed step, on a clock that keeps what it owes (see StepClock).
   *
   *  Colyseus' own accumulator runs at most five steps per callback and then
   *  forgets the rest, so a server that stalls steps fewer than sixty times a
   *  second while every client sends sixty commands a second - one per step -
   *  and the difference stands in the input queue as delay. This one banks
   *  real time up to half a second and repays it at most four steps per timer
   *  callback. Every step runs from setImmediate, after the event loop has
   *  read the sockets, so after a stall the commands that arrived during it
   *  are queued before the catch-up steps consume them, rather than the
   *  catch-up starving a queue that is only waiting to be read.
   *
   *  Same contract as Room.setFixedTimestep (tests capture the step callback
   *  through it and drive it directly); sub-steps are not used here. */
  override setFixedTimestep(step:FixedTimestepCallback,tickRate=SIMULATION_HZ){
    const clock=new StepClock(tickRate),loop=++this.loop,dt=1/tickRate;
    let tick=0,budget=0,pending=false;
    clock.advance(performance.now());
    const run=()=>{
      pending=false;
      if(loop!==this.loop)return;
      if(budget>0&&clock.take()){budget--;const began=performance.now();step({dt,dtMs:dt*1000,tick:tick++,subSteps:1,subDt:dt,subDtMs:dt*1000});netStats.onTick(performance.now()-began);}
      if(budget>0&&clock.owed>0&&loop===this.loop){pending=true;setImmediate(run);}
    };
    this.setTimestep(()=>{
      if(loop!==this.loop)return;
      const writtenOff=clock.dropped;
      clock.advance(performance.now());
      netStats.onWrittenOff(clock.dropped-writtenOff);netStats.onOwed(clock.owed);
      budget=StepClock.PER_CALLBACK;
      if(!pending&&clock.owed>0){pending=true;setImmediate(run);}
    },1000/tickRate);
  }

  /** Round 4 (STAGES): the stage a match room was dealt stays; this moves it
   *  only where the room has learned something since. `field` - a bot room
   *  the moment its field is drafted, before its player's first snapshot -
   *  gives a dominant series its own place; a private room follows its vote
   *  (counted at kickoff) or the arena its host named. */
  private applyStage(field=false){
    if(this.simulation.roomMode!=='match')return;
    const current=this.simulation.stage;
    const stage=this.custom?votedArena(this.custom.view,current)
      :field?movedStage(seriesStage(this.simulation.snapshot().players.map(p=>p.fighter)),current):current;
    if(stage===this.simulation.stage)return;
    this.simulation.setStage(stage,buildCollision(stage));
    void this.setMetadata({ mode:this.simulation.roomMode, visibility:this.privateRoom||this.botRoom?'private':'public',
      map: stage, humanCapacity: this.maxClients, botCount: this.botCount() });
  }

  /** How many bots are standing in the simulation right now. Before a public
   *  match kicks off that is none: the fill happens at the kickoff instant. */
  botCount(){ return this.simulation.snapshot().players.filter(p=>p.isBot).length; }

  onAuth(_client:Client,options:JoinOptions={}){requireRosterProtocol(options.rosterProtocol);
    if(this.duelRoom&&this.simulation.status!=='waiting')throw new Error('This Duel has already started.');
    if(this.duelRoom&&this.simulation.actors.size>=2&&!this.simulation.actors.has(_client.sessionId))throw new Error('This Duel is full.');
    if (options.fighter !== undefined && !isReleasedFighter(options.fighter)) throw new Error('Fighter is not available');
    // A fighter from the shop (economy/fighters.ts) only for the account that bought them, but anyone's in training.
    const locked = options.fighter !== undefined && this.simulation.roomMode !== 'training' ? lockedOut(options.fighter, sharedEconomy()?.book.find(options.account)) : undefined;
    if (locked) throw new Error(locked);
    if(this.expiring)throw new Error('This private room has expired.');
    // A creation nonce prevents concurrent generic joinOrCreate calls from
    // reserving a different creator's freshly published private room.
    if(this.privateRoom&&options.code!==this.code&&options.creationToken!==this.creationToken)throw new Error('Enter the room code to join this private match.');
    if(options.forge!==undefined)roomKit(options.forge,options.fighter,this.privateRoom);
    return true;
  }

  /** The shop's outfit a player wears for their fighter (src/game/economy/outfits.ts), read from their account - never
   *  the browser's word - and put on their body, which every screen draws. */
  private dress(client: Client, token: unknown) {
    this.rewards.bind(client.sessionId,token);this.emotes?.bind(client.sessionId,token);this.rivals?.bind(client.sessionId,token);
    const account = sharedEconomy()?.book.find(token), state = this.simulation.actors.get(client.sessionId)?.state;
    if (!account || !state) return;
    const outfit = account.worn.outfits?.[state.fighter];
    if (outfit && owns(account, outfit) && outfitFor(outfit, state.fighter)) state.outfit = outfit; else delete state.outfit;
  }
  onJoin(client: Client, options: JoinOptions = {}) {
    this.onAuth(client,options);this.assets.add(client,options.assetGate);this.ready?.add(client,options.readyGate);
    if(this.hostId===null)this.hostId=client.sessionId;
    this.simulation.addPlayer(client.sessionId, options.fighter ?? 'taisei', roomName(options.account, typeof options.name === 'string' ? options.name : 'Fighter'));
    this.simulation.setPlayerSkill(client.sessionId, options.skill);
    // A forged fighter (VOL.5): its kit in play for this player, never paid (RoomRewards), and every page sent each kit once.
    if(options.forge!==undefined){const kit=roomKit(options.forge,options.fighter,this.privateRoom);this.simulation.forge(client.sessionId,kit.moves,kit.hash);this.forgeCodes.set(kit.hash,kit.code);this.broadcast('forge-kits',Object.fromEntries(this.forgeCodes));}
    else if(this.forgeCodes.size)client.send('forge-kits',Object.fromEntries(this.forgeCodes));
    this.inputQueues.set(client.sessionId,new InputQueue());
    this.rewards.bind(client.sessionId,options.account);this.emotes?.bind(client.sessionId,options.account);this.rivals?.bind(client.sessionId,options.account);
    // A solo royale is complete the moment its bots are standing, so its
    // countdown starts here. A public match drafts at kickoff instead.
    // (Round 5, SOLOPAUSE: a page that says when its fight is on screen starts its READY hold then, not now.)
    if(this.botRoom){this.fillWithBots(this.botSeats);this.startAt=this.ready?.gated(client.sessionId)?null:this.simulation.serverTime+BOT_ROYALE_COUNTDOWN;this.applyStage(true);}
    // Its player is in: the seats open, for a capture or probe tool that
    // brings sparring dummies in by the room's id. Matchmaking still never
    // sees the room (private), so no other player lands in it.
    if(this.simulation.roomMode==='training'&&!this.botRoom&&this.maxClients<MAX_PLAYERS-1)this.maxClients=MAX_PLAYERS-1;
    client.send('welcome', { playerId: client.sessionId, roomId: this.roomId, mode: this.simulation.roomMode,
      tickRate: SIMULATION_HZ, snapshotRate: SNAPSHOT_HZ, botCount: this.botCount(), social: SOCIAL_PROTOCOL });
    client.send('snapshot', this.forOwner(this.snapshot(),client.sessionId));
    if(this.plannedBots.length)client.send('planned-bots',this.plannedBots);
  }

  /** Draft `seats` bots onto the stage. Every human's own pick is skipped so
   *  the roster reads as a bracket rather than as a mirror match, the order is
   *  the simulation's own seeded shuffle, and no fighter repeats before every
   *  other one is standing. */
  /** A public match's bots, drafted while its countdown runs and sent to every page in it (`planned-bots`), so each fetches
   *  their files during the countdown, not after it behind the AssetGate; and a lone page that plays on its own device
   *  instead takes the same field along (ui/modes/loneQueue.ts). Drafted again only as the humans change, keeping every bot
   *  it can; the kickoff seats them (fillWithBots). (The performance sweep's first proposal, 24 October 2026: drafted at the
   *  kickoff, the bots' models came down after the 15-20 s countdown, with everyone waiting.) */
  private planBots(){
    let key='';const taken:FighterId[]=[];
    for(const actor of this.simulation.actors.values())if(!actor.state.isBot){taken.push(actor.state.fighter);key+=`${actor.state.fighter},`;}
    if(key===this.planKey)return;this.planKey=key;
    const seats=Math.max(0,MIN_MATCH_FIELD-taken.length),kept=this.plannedBots.filter(f=>!taken.includes(f)).slice(0,seats);
    this.plannedBots=[...kept,...draftBots([...taken,...kept],seats-kept.length,items=>this.simulation.shuffle(items))];
    this.broadcast('planned-bots',this.plannedBots);
  }

  private fillWithBots(seats:number){
    if(seats<=0)return;
    const players=this.simulation.snapshot().players;
    const taken=players.filter(p=>!p.isBot).map(p=>p.fighter);
    const existing=players.filter(p=>p.isBot).length;
    // The bots a public match planned (planBots), less any a human has picked since; any still wanted, drafted now.
    const planned=this.plannedBots.filter(f=>!taken.includes(f)).slice(0,seats);this.plannedBots=[];
    const draft=[...planned,...draftBots([...taken,...planned],seats-planned.length,items=>this.simulation.shuffle(items))];
    for(let seat=0;seat<seats;seat++){
      const n=existing+seat;
      this.simulation.addPlayer(`bot-${n + 1}`, draft[seat], BOT_NAMES[n % BOT_NAMES.length], true);
      if(this.custom)this.simulation.actors.get(`bot-${n + 1}`)!.botSkill=BOT_SKILL[this.custom.view.rules.difficulty];
    }
    // A custom room's difficulty is a step from the adaptive aim (adaptive.ts): Easy below it, Hard above.
    if(this.custom)this.simulation.setDifficulty(this.custom.view.rules.difficulty);
  }

  async onDrop(client: Client) {
    if (!this.simulation.getPlayer(client.sessionId)) return;
    this.dropped.add(client.sessionId);
    this.inputQueues.get(client.sessionId)?.clear();
    this.simulation.clearPlayerInput(client.sessionId);
    // Round 5 (SOLOPAUSE): a room's one human losing their link is held for, while they reconnect.
    this.pause?.drop(client.sessionId);
    try {
      // Colyseus 0.18 invokes onReconnect for a recovered reserved session.
      // Its actor remains in the simulation and can still be hit or eliminated.
      await this.allowReconnection(client, RECONNECTION_SECONDS);
    } catch {
      this.onLeave(client);
    }
  }

  onReconnect(client: Client) {
    this.dropped.delete(client.sessionId);this.rejected.delete(client.sessionId);this.resync?.forget(client.sessionId);
    this.inputQueues.get(client.sessionId)?.clear();
    this.simulation.clearPlayerInput(client.sessionId);
    client.send('snapshot', this.forOwner(this.snapshot(),client.sessionId));
    if(this.plannedBots.length)client.send('planned-bots',this.plannedBots);
  }

  onLeave(client: Client) {
    // (Optional as the custom lobby is: a room built without its onCreate - the lifecycle tests' fixture - has no gate.)
    this.custom?.remove(client.sessionId);this.assets?.remove(client.sessionId);this.ready?.remove(client.sessionId);
    this.dropped.delete(client.sessionId);this.rejected.delete(client.sessionId);this.resync?.forget(client.sessionId);
    this.inputQueues.delete(client.sessionId);
    this.rewards.leave(client.sessionId);this.emotes?.leave(client.sessionId);this.rivals?.leave(client.sessionId);this.again?.leave(client.sessionId);
    // Expiry may also reach Colyseus' final onLeave callback. Removal is idempotent.
    this.simulation.removePlayer(client.sessionId);
    if(this.duelRoom&&this.simulation.actors.size<2)this.duelSet?.forfeit(this.simulation,this.simulation.playerStates()[0]?.id??null);
    // A party member gone before the start: the room will not be complete, so the host starts it (PartyStart).
    if(this.partyStart.waiting)this.partyStart.left();
    if(this.rosterPrepared&&this.simulation.status==='waiting'){for(const p of this.simulation.playerStates())if(p.isBot)this.simulation.removePlayer(p.id);this.rosterPrepared=false;this.startAt=null;void this.unlock();}
    if(this.duelRoom&&this.simulation.status==='waiting'){this.readyAt=null;this.startAt=null;}
    if(this.hostId===client.sessionId){this.hostId=this.simulation.snapshot().players.find(p=>!p.isBot)?.id??null;this.startAt=null;}
  }
  snapshot(consumeEvents=false):GameSnapshot {
    const snapshot=this.simulation.snapshot(consumeEvents);
    snapshot.lobby={...(this.duelRoom?{duel:true}:{}),visibility:this.privateRoom?'private':'public',code:this.code,hostId:this.privateRoom?this.hostId:null,...(this.roomSize?{size:this.roomSize}:{}),
      canStart:this.privateRoom&&snapshot.status==='waiting'&&this.clients.length>=2&&this.dropped.size===0&&this.startAt===null&&!this.expiring,
      ...this.partyStart.view(snapshot.serverTime),
      startsAt:this.startAt,expiresAt:this.privateRoom&&snapshot.status==='waiting'?this.lobbyAt+PRIVATE_WAIT_SECONDS:null,...(this.again?{again:this.again.view()}:{})};
    this.duelSet?.snapshot(snapshot);
    if(this.custom)(snapshot as GameSnapshot&{custom:CustomView}).custom=this.custom.snapshot();
    if(this.pause)snapshot.pause=this.pause.view();
    return snapshot;
  }
  private customTimer(){
    const sim=this.simulation,custom=this.custom?.view;if(!custom||sim.status!=='active')return;
    this.activeAt??=sim.serverTime;
    if(!custom.rules.seconds)return;custom.endsAt=this.activeAt+custom.rules.seconds;
    if(sim.serverTime<custom.endsAt)return;
    const alive=sim.playerStates().filter(p=>p.alive).sort((a,b)=>b.hp/b.maxHp-a.hp/a.maxHp||(b.damageDealt??0)-(a.damageDealt??0));
    const first=alive[0],second=alive[1];
    const tied=first&&second&&Math.abs(first.hp/first.maxHp-second.hp/second.maxHp)<.0001&&(first.damageDealt??0)===(second.damageDealt??0);
    sim.status='finished';sim.winnerId=first&&!tied?first.id:null;
    for(const a of sim.actors.values()){sim.clearPlayerInput(a.state.id);a.cast=null;if(a.state.alive){a.state.action=a.state.id===sim.winnerId?'victory':'idle';a.state.actionStarted=sim.serverTime;a.state.actionDuration=0;}}
  }
  /** The recipient's own rollback checkpoint and input-queue low-water mark;
   *  nobody else's. */
  private forOwner(snapshot:GameSnapshot,id:string):GameSnapshot {
    snapshot=this.rewards.forOwner(snapshot,id);if(this.rivals)snapshot=this.rivals.forOwner(snapshot,id);
    const checkpoint=this.simulation.predictionCheckpoint(id,true); // (shared: it is encoded by client.send before the next step - see predictionCheckpoint)
    return checkpoint?{...snapshot,prediction:{[id]:checkpoint},queued:this.inputQueues.get(id)?.low}:snapshot;
  }
  requestPrivateStart(client:Client){
    if(!this.privateRoom||this.simulation.status!=='waiting')return;
    if(client.sessionId!==this.hostId){client.send('notice',{message:'Only the room host can start the match.'});return;}
    if(this.clients.length<2){client.send('notice',{message:'Invite at least one friend before starting.'});return;}
    if(this.dropped.size){client.send('notice',{message:'Waiting for a disconnected fighter to reconnect.'});return;}
    if(this.startAt!==null||this.expiring)return;
    this.startAt=this.simulation.serverTime+3;
    this.broadcast('notice',{message:'Get ready — the match starts in 3 seconds.'});
  }
  /** A friends' royale's next match in the same room (social/RoomAgain), on its host's word: whoever is not in leaves with
   *  their results (FINISHED_ROOM_CLOSE: their page keeps them and says nothing), the bots go, everyone in stands up where
   *  they are, a room on the dealt arenas is dealt the next, and the match counts down as the host's START does - the
   *  kickoff seats the bots and waits for every page to load, as the first match's did. */
  private nextMatch(players:readonly string[]):string|undefined{
    if(this.dropped.size)return 'Waiting for a disconnected fighter to reconnect.';
    // (Out of the room before its socket closes: a close the server sends is no consented leave, and would hold the seat.)
    for(const client of [...this.clients])if(!players.includes(client.sessionId)){this.onLeave(client);client.leave(FINISHED_ROOM_CLOSE);}
    for(const p of this.simulation.playerStates())if(p.isBot)this.simulation.removePlayer(p.id);
    const now=this.simulation.serverTime;
    for(const actor of this.simulation.actors.values())Object.assign(actor.state,{alive:true,hp:actor.state.maxHp,action:'idle',actionStarted:now,actionDuration:0});
    this.simulation.status='waiting';this.simulation.winnerId=null;
    this.rosterPrepared=false;this.activeAt=null;this.overAt=null;this.lobbyAt=now;if(this.custom)delete this.custom.view.endsAt;
    if(this.custom?.view.rules.arena==='auto'){const stage=royaleDeck.deal(pool=>this.simulation.pick(pool));if(stage!==this.simulation.stage){this.simulation.setStage(stage,buildCollision(stage));void this.setMetadata({mode:'match',visibility:'private',map:stage,humanCapacity:this.maxClients,botCount:0});}}
    this.startAt=now+3;void this.unlock();
    this.broadcast('notice',{message:'Next match — the same room. Starting in 3 seconds.'});
    return undefined;
  }
  onDispose() { this.loop++;this.inputQueues.clear();this.dropped.clear();this.resync?.clear(); if(this.code)privateCodes.release(this.code); capacity.release(this); this.simulation?.dispose(); }
}

/** A distinct room type makes privacy a server decision, never a client-supplied filter. */
export class PrivateArenaRoom extends ArenaRoom {
  protected override privateRoom=true;
}

/** One seat, a field of bots, and a battle royale that starts by itself. */
export class BotArenaRoom extends ArenaRoom {
  protected override botRoom=true;
}

/** Public matchmaking and code-only invitations have separate room types. */
export class DuelRoom extends ArenaRoom { protected override duelRoom=true; }
export class PrivateDuelRoom extends DuelRoom { protected override privateRoom=true; }
