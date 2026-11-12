import { forgedMoves } from '../engine/sim/forgedKits';
import { MOVES, TECH_DELAY, TECH_STAMINA } from './moves';
import { ArenaSimulation, type ExternalTargets, type AimAssist } from './simulation';
import type { CollisionWorld, CombatEvent, GameSnapshot, PlayerInput, PlayerState, StageId } from './types';
import { LANDED } from './landedBlows';

/** Actions the server owns outright. Nothing local can predict being hit, so
 *  while one of these is running the authoritative body is what is drawn and
 *  the local copy is simply kept in step with it. */
const SERVER_OWNED = new Set(['hurt', 'flinch', 'launched', 'knockdown', 'getup', 'stun', 'splat', 'defeated', 'awaken', 'victory']);
/** How fast a correction is absorbed, as an exponential rate. Fast enough that
 *  a misprediction is gone within a few frames, slow enough that it is a drift
 *  rather than a jump. */
const CORRECTION_RATE = 18;
/** A correction bigger than this is not a misprediction - it is a spawn, a
 *  teleport or a stage change - and is taken immediately. */
const CORRECTION_SNAP = 3;
/** How far from the fighter a survival enemy is still copied into the local
 *  arena: past the longest melee lunge and a body's push. */
const PREDICTED_REACH = 10;
/** Server decisions that move the local body on purpose, which nothing local
 *  predicts: a vanish puts the fighter behind the attacker whose swing it read.
 *  A correction that size would otherwise be smoothed into a 2.5 m slide
 *  across the attacker, which is the one thing a vanish must not look like. */
const TELEPORTS = new Set(['vanish']);
/** Round 5 (PARRY): the longest a vanish waits for its parry to be drawn, in seconds (a stalled timeline). */
const VANISH_HOLD = .25;
/** Actions that mean the server has not decided anything about this fighter.
 *  A snapshot carrying one of these is not evidence against a move the local
 *  copy has already started - it is a snapshot from before it heard. */
const UNDECIDED = new Set(['idle', 'run', 'jump', 'dash', 'guard']);
const ATTACKS = new Set(['light', 'heavy', 'special', 'ultimate', 'area']);
export const impactKey=(event:CombatEvent)=>`${event.actorId}:${event.actionSeq}:${event.targetId}:${event.contactIndex??0}`;
const REACTIONS=new Set(['hurt','flinch','launched','knockdown','getup','stun','splat']);
type ContactView={age:number;confirmed:boolean;offset:{x:number;y:number;z:number};placed:boolean;action?:string;started:number;phase:number;
  /** Round 3e (REACT): the blow it previews, where it was last drawn, whether
   *  it is being let go of (see `letGo`), and the difference being let go of
   *  from where it was drawn to the server's body. */
  seq?:number;index?:number;last?:{x:number;y:number;z:number};leaving?:boolean;letGo?:{x:number;y:number;z:number;t:number}};
/** Round 3e (REACT): what the server last said about a remote body (see
 *  `trusted`), kept per body and rewritten in place. */
type Seen={action:string;speed:number;reaction:string|null;stunUntil:number;lastDamageAt:number;stamina:number;timeStopped:boolean;grounded:boolean};
/** Round 3e (REACT): a body the server has moving faster than this, in metres
 *  a second, is not where the local copy holds it a round trip later (it
 *  stands remote bodies still between snapshots): a blow the copy lands on it
 *  is a guess. A guarded walk is 2.2, a run 7.5. */
const TRUST_SPEED=1.2;
/** Round 3e (REACT): how long a preview the server turned away takes to be
 *  let go of, in seconds: the body eases from where the prediction drew it to
 *  where the server has it (a smoothstep, so it neither jumps off nor lands
 *  on its new place), rather than being moved there in a frame. */
const PREVIEW_LET_GO=.25;
/** Reactions a body can do nothing but sit out until the server's `stunUntil`
 *  (see `committed`); a launch it can recover from in the air (TECH_DELAY). */
const HELD_REACTIONS=new Set(['hurt','flinch','knockdown','stun','splat']);
/** Night net (12 October 2026): snapshots that reach the page closer together than this are a burst - a stalled connection
 *  letting go of what it held, thirty of them at once after a second - and only the newest is replayed (`receive`). A page
 *  on a good link hears one every 33 ms and replays each, as it always did. In milliseconds. */
const RECONCILE_GAP=8;
/** A replay costs the page its main thread: the commands the server has not acknowledged are stepped again, and on a
 *  220 ms link that is twenty-five of them thirty times a second. Past this cost (milliseconds, measured on the last
 *  one) the page replays at most once per COSTLY_GAP instead - the correction a snapshot carries waits for the next,
 *  which is never more than 50 ms older and is drawn through the same blend. */
const COSTLY_RECONCILE=3;
const COSTLY_GAP=50;

/** No walls at all. Handed to the local simulation on a stage change so it
 *  lets go of the previous stage's colliders. */
const EMPTY_WORLD: CollisionWorld = { move: (_id, _position, displacement) => ({ ...displacement }) };

export class Prediction {
  /** Which forged kit (its hash) each player's predicted body carries (VOL.5). */
  private forgedApplied = new Map<string, string>();
  private sim: ArenaSimulation | null = null;
  private id = '';
  private stage: StageId = 'harbor';
  private collision?: CollisionWorld;
  private pending: PlayerInput[] = [];
  private offset = { x: 0, y: 0, z: 0 };
  private previousPosition?:{x:number;y:number;z:number};
  private casts: CombatEvent[] = [];
  private impacts:CombatEvent[]=[];
  private reportedImpacts=new Set<string>();
  private presentedImpacts=new Set<string>();
  private confirmedImpacts=new Set<string>();
  private authoritativeImpacts=new Set<string>();
  private contacts=new Map<string,ContactView>();
  /** Round 3e (REACT): the server's word on each remote body (see `trusted`). */
  private seen=new Map<string,Seen>();
  private remotePrevious=new Map<string,{x:number;y:number;z:number}>();
  private playback?: {seq:number;slot:PlayerState['action'];age:number;duration:number;started:number};
  /** True while the local copy is the thing being drawn. */
  active = false;
  /** Draw the authoritative body until a collision world is installed. The
   *  world is loaded after the first snapshot and can fail to load at all,
   *  and a local copy with no walls walks the player straight through the
   *  harbour's castle until the next snapshot drags them back - which is what
   *  "fighters get inside buildings" looked like on the client. A round trip
   *  of latency for the first second beats that. Off by default so the
   *  simulation tests, which run without a world, are unaffected. */
  requireCollision = false;
  /** True while the server owns the body - a reaction, a death, stopped time.
   *  Kept so the frame the ownership changes can be made continuous. */
  private owned = false;
  /** Round 3e (REACT): the newest snapshot has the server owning the body (see
   *  `sample`), and where the body was drawn last frame. */
  private serverOwns = false;
  private lastDrawn?: { x: number; y: number; z: number };
  /** Round 5 (PARRY): the clock the timeline presents the fight on (main.ts hands it over every frame; NaN when nothing
   *  presents one). The local fighter's own vanish arrives with the snapshot a display delay before the parry it answers
   *  is drawn - the flash, the sound, the attacker's swing reaching the guard - and was drawn at once: the body jumped
   *  behind the attacker four or five frames before anything said why. It is held where it was drawn until the
   *  presented clock reaches the vanish (VANISH_HOLD at most), and snaps there with the flash. */
  visualTime = NaN;
  private vanishHold?: { at: number; x: number; y: number; z: number; until: number };
  /** Night net: the newest snapshot heard and not yet replayed (see `receive`), with the events of those it replaced. */
  private deferred?: GameSnapshot;
  private lastReconcile = -Infinity;
  private lastCost = 0;
  /** Snapshots heard and replayed, and heard and folded into a newer one - for the evidence probes. */
  replayed = 0;
  folded = 0;
  /** The stopwatch that prices a replay (milliseconds); the evidence probes read CPU time here, so a busy neighbour does not decide how often the page replays. */
  clock: () => number = () => performance.now();

  /** Lock combat (lockCombat.ts): whether the copy built on the next `start` plays it - as the fight it predicts does. */
  lockCombat = false;

  get enabled() { return this.sim !== null; }

  /** Build a local copy of the arena around the authoritative snapshot. */
  start(id: string, snapshot: GameSnapshot, collision?: CollisionWorld) {
    this.stop();
    this.id = id;
    this.stage = snapshot.stage ?? 'harbor';
    this.collision = collision;
    // Training, because a match room's simulation sits in `waiting` until the
    // server starts it and refuses every cast until then.
    // Room for a co-op survival frame's horde, though only the near part of it
    // is ever copied in (see `sync`).
    // resolveAreas: an area move's cast is predicted; where its circle lands, and on whom, is the server's word.
    // Lock combat (lockCombat.ts): the copy plays the rules the page's own fight plays, or the local fighter is drawn
    // throwing the live rules' string - the launcher where the experiment's second round goes, a blow in the beat.
    this.sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, stage: this.stage, collision, capacity: 48, resolveAreas: false, ...(this.lockCombat ? { lockCombat: true } : {}) });
    this.sim.serverTime = snapshot.serverTime;
    this.sync(snapshot);
  }

  /** Match-owned lightweight targets participate in local aiming without
   * becoming fighter actors or predicting their damage/economy. Install after
   * start and before reconcile so replay sees the same visible geometry. */
  setExternalTargets(external?:ExternalTargets,assist?:AimAssist){
    if(!this.sim)return;
    this.sim.external=external;this.sim.assist=assist;
  }

  stop() {
    this.sim?.dispose();
    this.sim = null;
    this.vanishHold = undefined; // Round 5 (PARRY)
    this.deferred = undefined; this.lastReconcile = -Infinity; this.lastCost = 0;
    this.pending.length = 0;
    this.casts.length = 0;
    this.impacts.length=0;this.reportedImpacts.clear();this.presentedImpacts.clear();this.confirmedImpacts.clear();this.authoritativeImpacts.clear();this.contacts.clear();this.remotePrevious.clear();this.seen.clear();
    this.offset.x = this.offset.y = this.offset.z = 0;
    this.active = false;
    this.playback=undefined;
    this.previousPosition=undefined;
    this.serverOwns=false;this.lastDrawn=undefined;
  }

  /** The stage owns collision, and the server can change it at kickoff.
   *
   *  A change of stage with no world yet is a change to NO world, not to the
   *  old one: the harbour's colliders used to stand, invisible, in the
   *  middle of the Proving Hall for the few hundred milliseconds the new world
   *  took to load, and the local copy walked into them while the server
   *  did not - a fight that opened with the body being dragged about. With
   *  `requireCollision` the gap is drawn from the authoritative body
   *  instead, and the simulation is handed an empty world so it drops the
   *  stale one (it keeps whatever it has when given nothing). */
  setStage(stage: StageId, collision?: CollisionWorld) {
    if (stage === this.stage && !collision) return;
    const changed = stage !== this.stage;
    this.stage = stage;
    this.collision = collision ?? (changed ? undefined : this.collision);
    this.sim?.setStage(stage, collision ?? (changed ? EMPTY_WORLD : undefined));
  }

  /** Apply an input the moment it is made, and advance the local copy by one
   *  server tick. Inputs are kept until the server acknowledges them. */
  submit(input: PlayerInput) {
    const sim = this.sim;
    if (!sim || !sim.actors.has(this.id)) return;
    const before=sim.actors.get(this.id)!.state;
    this.previousPosition={x:before.x,y:before.y,z:before.z};
    this.pending.push(input);
    if (this.pending.length > 240) this.pending.shift();
    sim.submitInput(this.id, input);
    this.rememberRemote();
    sim.step();
    const current=sim.actors.get(this.id)!.state;
    if(this.playback&&!current.hitstop&&!current.timeStopped)this.playback.age+=1/60;
    this.consumeEvents(sim.snapshot(true).events,true);
  }

  private consumeEvents(events:CombatEvent[],casts:boolean){
    LANDED.predict(events,this.id,this.pending.at(-1)?.seq??-1,casts?undefined:this.pending[0]?.seq,this.trust); // Round 3c (FEEDBACK): the blows the local copy lands, and a replay's second thoughts (landedBlows.ts).
    const current=this.sim!.actors.get(this.id)!.state;
    for (const event of events) {
      if (casts&&event.kind === 'cast' && event.actorId === this.id) {
        this.casts.push(event);
        // (The ball rooms' SHOOT: a quick strike whose key stayed down past SportFeel.strike's hold is turned
        // into the fighter's own heavy and announced again under the press's own number, on the press's clock - the drawn
        // swing keeps its age and its start and takes the heavy's clip and length. Restarted, the heavy was drawn from 0
        // at the split and its blow a fifth of a second after the ball had gone. Every other cast starts its own.)
        if(event.actionSeq!==undefined&&this.playback?.seq===event.actionSeq&&current.strike==='charge')this.playback={...this.playback,slot:current.action,duration:current.actionDuration};
        else if(event.actionSeq!==undefined)this.playback={seq:event.actionSeq,slot:current.action,age:0,duration:current.actionDuration,started:current.actionStarted};
      }
      // Round 3e (REACT): previewed only on a body that cannot get out of its
      // way (`committed`). On one free to move or guard, the local copy - which
      // stands it still where the last snapshot had it - lands a Kazeyose the
      // server does not: the third blind critic drew a fleeing Gummy launched
      // in 7 of 12 trials and a guarding one for 180 ms. Such a blow is drawn
      // when the server lands it, as every other move's is.
      if(event.kind==='hit'&&event.actorId===this.id&&event.fighter==='konta'&&event.slot==='heavy'&&!event.branch
          &&event.actionSeq!==undefined&&event.targetId&&!current.awakened&&current.grounded&&this.committed(event.targetId,event.serverTime)){
        const key=impactKey(event);if(this.reportedImpacts.has(key))continue;
        this.reportedImpacts.add(key);this.impacts.push(event);
        if(this.reportedImpacts.size>128)this.reportedImpacts.delete(this.reportedImpacts.values().next().value!);
      }
    }
  }
  private rememberRemote(){for(const [id,a]of this.sim!.actors)if(id!==this.id)this.remotePrevious.set(id,{x:a.state.x,y:a.state.y,z:a.state.z});}
  /** Round 3e (REACT): whether the body `id` cannot do anything but take what
   *  lands on it at `at` (the local copy's clock), as the server last had it:
   *  held in a reaction past then, or in stopped time. Nothing it presses can
   *  change a blow the local copy lands on it. */
  private committed(id:string,at:number){
    const seen=this.seen.get(id);
    if(!seen)return false;
    if(seen.timeStopped)return true;
    if(seen.reaction==='launched')return at<seen.lastDamageAt+TECH_DELAY||seen.stamina<TECH_STAMINA;
    return !!seen.reaction&&HELD_REACTIONS.has(seen.reaction)&&seen.stunUntil>at;
  }
  /** Round 3e (REACT): whether a blow the local copy lands on `id` can be
   *  answered before the server says so (LANDED's `trusted`): the body is
   *  committed, or it was standing still - not running, dashing, in the air
   *  or in a swing of its own, any of which could have taken it out of reach
   *  in the round trip the copy is ahead by. */
  readonly trust=(id:string,at:number,event?:CombatEvent)=>{
    const seen=this.seen.get(id);
    if(!seen)return true;
    if(this.committed(id,at))return true;
    // A charge-in (Kazeyose, Storm Talon, the Sickle Bolt) is thrown over half
    // a second of telegraph at a body free to answer it inside the round trip:
    // one standing still at the last snapshot was running by the blow in the
    // critic's late trials. Only a committed body is answered ahead of the
    // server for those.
    const thrown=event?.fighter&&event.slot?MOVES[event.fighter][event.slot]:undefined;
    if(thrown?.chargeIn&&(event!.move===undefined||event!.move===thrown.name))return false;
    return !seen.reaction&&(seen.action==='idle'||seen.action==='guard')&&seen.grounded&&seen.speed<TRUST_SPEED;
  };
  /** Round 3e (REACT): the server's word on a remote body, kept for `trusted`. */
  private see(player:PlayerState,reaction?:{mx:number;mz:number;reaction:string|null;stunUntil:number;lastDamageAt:number}){
    let seen=this.seen.get(player.id);
    if(!seen){seen={action:'idle',speed:0,reaction:null,stunUntil:-Infinity,lastDamageAt:-Infinity,stamina:0,timeStopped:false,grounded:true};this.seen.set(player.id,seen);}
    seen.action=player.action;seen.grounded=player.grounded;seen.timeStopped=!!player.timeStopped;seen.stamina=player.stamina;
    seen.speed=reaction?Math.hypot(reaction.mx,reaction.mz):0;seen.reaction=reaction?.reaction??null;
    seen.stunUntil=reaction?.stunUntil??-Infinity;seen.lastDamageAt=reaction?.lastDamageAt??-Infinity;
  }
  /** Cosmetic contacts from the same simulation, never authoritative damage. */
  takeImpacts(){
    const ready:CombatEvent[]=[];
    this.impacts=this.impacts.filter(event=>{
      if(this.authoritativeImpacts.has(impactKey(event)))return false;
      const playback=this.playback;
      if(!playback||playback.seq!==event.actionSeq)return false;
      if(event.branch)return false; // A combo ender is no Kazeyose: never presented ahead of the server (game/combos.ts).
      if(playback.age<MOVES.konta.heavy.contacts[0])return true; // Round 3d (PACE): the Kazeyose's own contact (was .94).
      ready.push(event);
      const key=impactKey(event);this.presentedImpacts.add(key);
      if(this.presentedImpacts.size>128)this.presentedImpacts.delete(this.presentedImpacts.values().next().value!);
      this.contacts.set(event.targetId!,{age:0,confirmed:this.confirmedImpacts.has(key),offset:{x:0,y:0,z:0},placed:false,started:0,phase:0,seq:event.actionSeq,index:event.contactIndex??0});
      return false;
    });return ready;
  }
  markAuthoritativeImpacts(events:CombatEvent[]){
    for(const event of events)if(event.kind==='hit'&&event.actorId===this.id&&event.actionSeq!==undefined){
      this.authoritativeImpacts.add(impactKey(event));
      if(this.authoritativeImpacts.size>128)this.authoritativeImpacts.delete(this.authoritativeImpacts.values().next().value!);
    }
  }
  impactWasPresented(event:CombatEvent){return event.kind==='hit'&&event.actionSeq!==undefined&&this.presentedImpacts.has(impactKey(event));}

  /** Casts the local copy started that the server has not answered for yet.
   *  They are what lets a swing make its noise on the frame it is thrown. */
  takeCasts() {
    const out = this.casts.slice();
    this.casts.length = 0;
    return out;
  }

  /** The snapshot the page has just heard. Replayed now - exactly `reconcile` - unless one was replayed a moment ago (a burst,
   *  or a replay so dear the page is sparing them: RECONCILE_GAP, COSTLY_GAP), in which case it waits for `flush`, which the
   *  input pump calls every tick, and a newer one replaces it. Nothing it carried is lost: the events of a snapshot folded
   *  into a newer one ride on the newer, in order. Returns whether a replay ran. */
  receive(snapshot: GameSnapshot, now = performance.now()) {
    const waiting = this.deferred;
    if (waiting) { this.folded++; this.deferred = waiting.events.length ? { ...snapshot, events: [...waiting.events, ...snapshot.events] } : snapshot; }
    else this.deferred = snapshot;
    return this.flush(now);
  }

  /** Replay the snapshot `receive` kept, if it is time (see RECONCILE_GAP). Called from the input pump. */
  flush(now = performance.now()) {
    const snapshot = this.deferred;
    if (!snapshot || !this.sim) return false;
    if (now - this.lastReconcile < (this.lastCost >= COSTLY_RECONCILE && !this.urgent(snapshot) ? COSTLY_GAP : RECONCILE_GAP)) return false;
    this.deferred = undefined;
    const began = this.clock();
    this.reconcile(snapshot);
    this.lastCost = this.clock() - began; this.lastReconcile = now; this.replayed++;
    return true;
  }

  /** A snapshot that is never spared, however dear a replay is: the server has taken the body (a reaction, a death, stopped
   *  time), or it carries a verdict on a blow this fighter threw or took - the hit confirmed, the guard that stopped it, the
   *  vanish. Those are what the blend in `sample` and the previews in `sampleRemote` are timed against, and they wait for
   *  nobody; the routine snapshot (nothing about this fighter but where it is) is the one that can wait for the next. */
  private urgent(snapshot: GameSnapshot) {
    const me = snapshot.players.find(p => p.id === this.id);
    if (!me || !me.alive || SERVER_OWNED.has(me.action) || me.timeStopped) return true;
    for (const event of snapshot.events) if (event.actorId === this.id || event.targetId === this.id) return true;
    return false;
  }

  /** Rewind to the authoritative state and replay whatever it has not seen. */
  reconcile(snapshot: GameSnapshot) {
    LANDED.authoritative(snapshot, this.id); // Round 3c (FEEDBACK): the server's verdicts, ahead of the timeline (landedBlows.ts).
    const sim = this.sim;
    const server = snapshot.players.find(p => p.id === this.id);
    if (!sim || !server) return;
    const before = sim.actors.get(this.id)?.state;
    for(const event of snapshot.events)if(event.kind==='hit'&&event.actorId===this.id&&event.actionSeq!==undefined){
      this.confirmedImpacts.add(impactKey(event));
      if(this.confirmedImpacts.size>128)this.confirmedImpacts.delete(this.confirmedImpacts.values().next().value!);
    }
    const previousTargets=new Map([...this.contacts.keys()].map(id=>{const p=sim.actors.get(id)?.state;return [id,p?{x:p.x,y:p.y,z:p.z}:undefined];}));
    const was = before ? { x: before.x, y: before.y, z: before.z } : null;
    const teleported = snapshot.events.some(event => TELEPORTS.has(event.kind) && event.actorId === this.id);
    // Round 5 (PARRY): held where it was drawn until the parry is (see `visualTime`).
    const vanish = Number.isFinite(this.visualTime) ? snapshot.events.find(event => event.kind === 'vanish' && event.actorId === this.id) : undefined;
    if (vanish && this.lastDrawn && vanish.serverTime > this.visualTime)
      this.vanishHold = { at: vanish.serverTime, x: this.lastDrawn.x, y: this.lastDrawn.y, z: this.lastDrawn.z, until: performance.now() + VANISH_HOLD * 1000 };
    sim.serverTime = snapshot.serverTime;
    this.sync(snapshot);
    const ack = server.ackSeq ?? -1;
    // While the server owns the body the local copy is not what is drawn, so
    // the difference between the two is not a misprediction to absorb - it is
    // the reaction. Accumulating it would leave the body a half-metre out by
    // the time control comes back.
    const held = SERVER_OWNED.has(server.action) || !server.alive;
    this.serverOwns = SERVER_OWNED.has(server.action) || !!server.timeStopped; // Round 3e (REACT): see `sample`.
    this.pending = this.pending.filter(input => input.seq > ack);
    this.replaying = true;
    try {
      for (const input of this.pending) {
        sim.submitInput(this.id, input);
        this.rememberRemote();
        sim.step();
      }
    } finally { this.replaying = false; }
    this.consumeEvents(sim.snapshot(true).events,false);
    for(const [id,contact]of this.contacts){
      const from=previousTargets.get(id),to=sim.actors.get(id)?.state;
      if(from&&to&&contact.placed){
        const dx=from.x-to.x,dy=from.y-to.y,dz=from.z-to.z;
        contact.offset.x+=dx;contact.offset.y+=dy;contact.offset.z+=dz;
        // Replay rebuilds both endpoints. With no pending command the previous
        // endpoint still belongs to the old state and must move with the new one.
        const previous=this.remotePrevious.get(id);
        if(!this.pending.length&&previous){previous.x-=dx;previous.y-=dy;previous.z-=dz;}
      }
      // Round 3e (REACT): a preview the server turns away - a guard, a dodge,
      // a parry, somebody else's blow, or the ledger giving up on it - is let
      // go of (`letGo`) rather than dropped: it used to stand the body back up
      // where the server had it in one frame.
      if(contact.letGo)continue;
      for(const event of snapshot.events)if(event.targetId===id){
        if(event.kind==='hit'&&event.actorId===this.id&&this.impactWasPresented(event))contact.confirmed=true;
        else if(event.kind==='hit'||event.actorId===this.id&&(event.kind==='blocked'||event.kind==='guard-break'||event.kind==='dodge'||event.kind==='just-guard'))contact.leaving=true;
      }
      if(!contact.confirmed&&contact.seq!==undefined&&LANDED.refused(LANDED.blow(this.id,contact.seq,id,contact.index??0)))contact.leaving=true;
    }
    const now = sim.actors.get(this.id)?.state;
    if (!was || !now || held) return;
    // Carry the difference as an offset that decays, so a correction is a
    // drift of a few frames rather than the body appearing somewhere else.
    const dx = was.x - now.x, dy = was.y - now.y, dz = was.z - now.z;
    if(this.previousPosition){this.previousPosition.x-=dx;this.previousPosition.y-=dy;this.previousPosition.z-=dz;}
    if (teleported || Math.hypot(dx, dy, dz) > CORRECTION_SNAP) { this.offset.x = this.offset.y = this.offset.z = 0; return; }
    this.offset.x += dx; this.offset.y += dy; this.offset.z += dz;
  }

  /** Bring the local copy's roster in line with the snapshot, so bodies still
   *  push each other apart between server frames. Only the local fighter is
   *  driven by input. Remote bodies retain public reaction physics, so replayed
   *  contact and hitstop use the same defender state as authority. */
  private sync(snapshot: GameSnapshot) {
    const sim = this.sim!;
    const seen = new Set<string>();
    // A survival horde can be forty strong. Only the bodies near enough to
    // push the fighter or take their swing matter to predicting it, so an
    // enemy further off is left to the snapshot. (A royale has no enemies.)
    const me = snapshot.players.find(p => p.id === this.id);
    for (const player of snapshot.players) {
      if (player.enemy && me && Math.hypot(player.x - me.x, player.z - me.z) > PREDICTED_REACH) continue;
      seen.add(player.id);
      let actor = sim.actors.get(player.id);
      if (!actor) {
        // Never as a bot: a predicted bot would think, swing and fire events of
        // its own, none of which the server asked for.
        sim.addPlayer(player.id, player.fighter, player.name, false, player);
        actor = sim.actors.get(player.id);
        if (!actor) continue;
      }
      const forged=forgedMoves(player.forge),applied=this.forgedApplied.get(player.id);
      if(forged?applied!==player.forge:applied!==undefined){sim.forge(player.id,forged,forged?player.forge:undefined);if(forged)this.forgedApplied.set(player.id,player.forge!);else this.forgedApplied.delete(player.id);}
      const checkpoint=player.id===this.id?snapshot.prediction?.[player.id]:undefined;
      if(checkpoint)this.sim!.restorePrediction(player.id,checkpoint);
      // A move the local copy is part way through is not given up for a
      // snapshot that has not got to it yet. Without this, an acknowledgement
      // that arrives in a frame generated before the cast resolved drops the
      // swing: the press has been consumed, so the replay has nothing to put
      // back, and the fighter stands still until the next one lands.
      // Also when the server agrees about the move: its copy started a round
      // trip later than ours, and taking its `actionStarted` mid-swing moves
      // the clip's clock by the latency, which the renderer reads as a new
      // move and restarts. Every attack visibly hitched and rewound about a
      // tenth of a second in. The clock the player saw the swing start on is
      // the right one to finish it on.
      const ours = !checkpoint && player.id === this.id && actor.state.actionDuration > 0
        && ATTACKS.has(actor.state.action) && actor.state.actionTime < .98
        && (UNDECIDED.has(player.action) || player.action === actor.state.action);
      // Not `actionTime`: that is recomputed from the clock on every step, and
      // holding it would freeze the move rather than preserve it, so the guard
      // would never expire.
      const held = ours ? { action: actor.state.action, actionStarted: actor.state.actionStarted,
        actionDuration: actor.state.actionDuration } : null;
      // `isBot` is deliberately not carried across. The local copy adds every
      // remote actor as a human for exactly this reason - a predicted bot
      // thinks, swings and fires events of its own that the server never asked
      // for - and assigning the snapshot's state straight over the top put the
      // flag back, which is how the sparring bot came to be fighting a second
      // copy of the match inside the client. With training's passive setting
      // living on the server, the local bot ignored it too: the player was
      // being launched by an opponent that, authoritatively, was standing
      // still. Twelve of thirty-five captured frames were a reaction the
      // server had never heard of.
      Object.assign(actor.state, player, { cooldowns: { ...player.cooldowns }, isBot: false }, held ?? {});
      // Replaying against the already-predicted lastSeq rejected every pending
      // input as stale, then stepped the most recent direction repeatedly.
      if(player.id===this.id&&!checkpoint){actor.lastSeq=player.ackSeq??-1;actor.input={seq:actor.lastSeq,moveX:0,moveZ:0,yaw:player.yaw};}
      if (player.id !== this.id) {
        const reaction=snapshot.reactions?.[player.id];
        if(reaction)Object.assign(actor,reaction);
        this.see(player,reaction); // Round 3e (REACT): the server's word on the body, for `trusted`.
        actor.input = { seq: actor.lastSeq, moveX: 0, moveZ: 0, yaw: player.yaw };
        // Round 3e (REACT): a guard the server has up stays up in the local
        // copy, which gave remote bodies no input at all - so it dropped every
        // guard a tick after the snapshot and landed the local fighter's blows
        // on it clean, a round trip before the server said "blocked". Held
        // long since (no just-guard window of the copy's own making), and
        // through blockstun, where the server has `guarding` down and the
        // action still 'guard' (and all of it 'guard': see the impact freeze
        // in simulation.ts).
        if(player.guarding||player.action==='guard'){actor.input.guard=true;actor.lastInputAt=sim.serverTime;actor.guardHeld=actor.wasGuarding=true;actor.guardAt=actor.guardPressedAt=-Infinity;}
        actor.mx = actor.mz = 0;
      }
    }
    for (const id of [...sim.actors.keys()]) if (!seen.has(id)) sim.removePlayer(id);
  }

  /** The remote bodies stay where the SERVER has them, not where they are
   *  drawn. Round 13 moved them to the presented positions every frame (sixty
   *  milliseconds and a snapshot behind the server's present) so the local
   *  copy would push off the body on screen. Measured with
   *  scripts/probe_push_sync.mts against a walking opponent, that roughened
   *  the player's own drawn path tenfold: the server separates the pair from
   *  where the opponent IS and the client from where they WERE, every
   *  snapshot reconciles the difference into the body, and at touching
   *  distance - which is all of melee - the largest one-frame change of
   *  velocity went from 223 to 1970 m/s^2 and the correction carried from
   *  0.17 to 1.18 m. Walking through a drawn body for a tenth of a second is
   *  the smaller wrong. */

  /** What the local copy believes it is doing, without touching anything.
   *  Read by the evidence probes: it is the clock a press is supposed to move,
   *  and the drawn frame is bounded by the render rate rather than by it. */
  get action() { return this.sim?.actors.get(this.id)?.state.action; }
  /** The ball modes' forecast of the page's own touch (game/ball/BallTargets): the local copy's own fighter -
   *  its body, its last command, its swing and guard - and its clock. Read-only: nothing here changes the copy. */
  get local() { return this.sim?.actors.get(this.id); }
  get localTime() { return this.sim?.serverTime ?? NaN; }
  /** True while a snapshot's unacknowledged commands are being stepped again (`reconcile`): what the copy meets then is
   *  already history, and the ball modes never forecast a touch from it. */
  replaying = false;

  /** Read-only transport diagnostics; never fed back into gameplay. */
  get diagnostics() {
    const actor=this.sim?.actors.get(this.id);
    return {time:this.sim?.serverTime,pending:this.pending.map(p=>p.seq),offset:{...this.offset},
      position:actor?{x:actor.state.x,y:actor.state.y,z:actor.state.z}:undefined,
      velocity:actor?{x:actor.mx,z:actor.mz}:undefined,input:actor?{...actor.input}:undefined};
  }

  /** Only a locally landed Kazeyose previews the defender's public reaction.
   * Health/resources remain from the authoritative snapshot. Its kinematics
   * roll back with the same command history, so impact and launch share a frame. */
  sampleRemote(dt:number,server:PlayerState,alpha=1):PlayerState {
    const contact=this.contacts.get(server.id),actor=this.sim?.actors.get(server.id);
    if(!contact)return server;
    if(contact.leaving||!actor||!server.alive||!actor.state.alive)return this.letGo(contact,server,dt);
    contact.age+=dt;
    const state=actor.state;
    if(contact.age>(contact.confirmed?2.5:1.2)||(contact.confirmed&&!REACTIONS.has(state.action)&&!REACTIONS.has(server.action)&&!state.hitstop)){
      contact.leaving=true;return this.letGo(contact,server,dt);
    }
    const previous=this.remotePrevious.get(server.id)??state,t=Math.max(0,Math.min(1,alpha));
    const position={x:previous.x+(state.x-previous.x)*t,y:previous.y+(state.y-previous.y)*t,z:previous.z+(state.z-previous.z)*t};
    if(!contact.placed){contact.offset={x:server.x-position.x,y:server.y-position.y,z:server.z-position.z};contact.placed=true;}
    else{const decay=Math.exp(-18*dt);contact.offset.x*=decay;contact.offset.y*=decay;contact.offset.z*=decay;}
    if(contact.action!==state.action){contact.action=state.action;contact.started=state.actionStarted;contact.phase=0;}
    contact.phase=Math.max(contact.phase,state.actionTime);
    const x=position.x+contact.offset.x,y=position.y+contact.offset.y,z=position.z+contact.offset.z;
    if(contact.last){contact.last.x=x;contact.last.y=y;contact.last.z=z;}else contact.last={x,y,z};
    return {...server,x,y,z,
      action:state.action,actionStarted:contact.started,actionTime:contact.phase,actionDuration:state.actionDuration,
      grounded:state.grounded,hitstop:state.hitstop,hitstopFrom:state.hitstopFrom,hitstopUntil:state.hitstopUntil,actionFrozen:state.actionFrozen};
  }
  /** Round 3e (REACT): a preview being let go of - turned away by the server,
   *  or over. The body is the server's again, action and all (the renderer
   *  blends the pose round), and where the preview drew it is let go of at
   *  PREVIEW_LET_GO rather than in the frame: a Gummy the local copy had
   *  launched and the server had running off was stood back up two metres
   *  away between two frames. */
  private letGo(contact:ContactView,server:PlayerState,dt:number):PlayerState{
    if(!contact.letGo){const last=contact.last;contact.letGo={x:last?last.x-server.x:0,y:last?last.y-server.y:0,z:last?last.z-server.z:0,t:0};}
    const carry=contact.letGo;carry.t+=dt;
    const u=Math.min(1,carry.t/PREVIEW_LET_GO),left=1-u*u*(3-2*u);
    if(!server.alive||left<=0||Math.hypot(carry.x,carry.y,carry.z)>CORRECTION_SNAP){this.contacts.delete(server.id);return server;}
    return {...server,x:server.x+carry.x*left,y:Math.max(server.y,server.y+carry.y*left),z:server.z+carry.z*left};
  }

  /** The local fighter as it should be drawn this frame.
   *
   *  While the server owns the body - a reaction, a knockdown, stopped time -
   *  what is drawn is the authoritative position, because nothing local
   *  predicts being hit. What is not allowed is the switch between the two
   *  being visible: the authoritative copy is a round trip and a display delay
   *  behind, so handing the body over on the frame a hit lands used to
   *  teleport it by up to a couple of metres, and back again on the way out.
   *  The gap is carried as an offset that decays, exactly as a misprediction
   *  is. */
  sample(dt: number, server: PlayerState, alpha=1): PlayerState | null {
    const state = this.sim?.actors.get(this.id)?.state;
    this.active = false;
    if (!state || !server.alive || (this.requireCollision && !this.collision)) { this.owned = false; this.lastDrawn = undefined; return null; }
    // Not `server.hitstop`: handing the body back for the length of every
    // impact freeze meant that on every connected hit the fighter popped back
    // to the lagged authoritative position, held there for the freeze, and
    // popped forward again - on the one moment that is supposed to be still.
    // The local copy runs the same deterministic code and freezes itself.
    // Round 3e (REACT): or as soon as the newest snapshot says so. That comes
    // a display delay before the timeline draws the blow, and the local copy
    // takes it in at once (the checkpoint puts the body on the knockback, and
    // the replay runs it on), while its correction was dropped as the
    // server's business: for those frames the local copy was drawn, jumped
    // along the knockback - a launched Taisei 0.9-1.2 m in one frame, his head
    // bent 90 degrees round the hips by the lean that followed it. Handed to
    // the server's body at once, it is drawn as the timeline has it, which is
    // the blow as the drawn attacker throws it.
    const owned = SERVER_OWNED.has(server.action) || !!server.timeStopped || this.serverOwns;
    // The correction holds through an impact freeze so it slides out under the
    // knockback rather than during the one moment everything is still.
    //
    // Decayed BEFORE the handover below is banked, and on the wall-clock
    // frame time. main.ts used to hand this the clamped step, so at five
    // frames a second the offset was banked at the real snapshot rate and
    // bled at a quarter of it: the fighter was drawn up to 0.6 m behind where
    // it was being steered, and the camera, anchored to the drawn body,
    // rubber-banded with it. And on a long frame the decay must not touch the
    // offset the handover adds this frame, or a 0.2 s frame deletes 97% of
    // the very difference it exists to carry.
    const decay = server.hitstop ? 1 : Math.exp(-CORRECTION_RATE * dt);
    this.offset.x *= decay; this.offset.y *= decay; this.offset.z *= decay;
    const blend=Math.max(0,Math.min(1,alpha)),previous=this.previousPosition??state;
    if (owned !== this.owned) {
      // Whatever was on screen last frame stays on screen this frame: add the
      // difference between the position the old base drew from and the new one.
      const from = this.owned ? server : state, to = this.owned ? state : server;
      this.offset.x += from.x - to.x; this.offset.y += from.y - to.y; this.offset.z += from.z - to.z;
      // Round 3e (REACT): from where it WAS drawn, where that is known - a
      // snapshot may have moved the old base since.
      const drawn=this.lastDrawn;
      if(drawn){
        const bx=owned?server.x:previous.x+(state.x-previous.x)*blend,by=owned?server.y:previous.y+(state.y-previous.y)*blend,bz=owned?server.z:previous.z+(state.z-previous.z)*blend;
        this.offset.x=drawn.x-bx;this.offset.y=drawn.y-by;this.offset.z=drawn.z-bz;
      }
      if (Math.hypot(this.offset.x, this.offset.y, this.offset.z) > CORRECTION_SNAP) this.offset.x = this.offset.y = this.offset.z = 0;
      this.owned = owned;
    }
    if (owned) return this.drew({ ...server, x: server.x + this.offset.x, y: server.y + this.offset.y, z: server.z + this.offset.z });
    this.active = true;
    // Network rollback owns physical state; it must not rewind the animation
    // already shown for this input edge or replay its tail after completion.
    const playback=this.playback?.seq===state.actionSeq&&ATTACKS.has(state.action)?this.playback:undefined;
    const finished=playback&&playback.age>=playback.duration;
    const moving=Math.hypot(this.sim!.actors.get(this.id)!.mx,this.sim!.actors.get(this.id)!.mz)>.15;
    // A swing whose drawn clip has run out while the reconciled copy is still
    // in it - the server started it later, typically because the stage before
    // it missed there and hit here - holds its last frame rather than
    // dropping to the idle stance: in a string the next stage follows within
    // moments, and idle between two stages is the one thing a mashed rush
    // must never show. Travel still owns the body: moving, it is the run (or
    // the jump), as before.
    const holding=finished&&!moving;
    const action=finished&&!holding?(!state.grounded?'jump':'run'):state.action;
    // Rendering and input callbacks do not share a phase. Interpolate the last
    // two fixed ticks so 90/120/144Hz frames (and timer jitter at 60Hz) do not
    // alternate between planted frames and double-sized movement steps (the
    // `blend` and `previous` above).
    // Position, facing and the fighter's own action are local. Health, meter,
    // the combo count and everything the server decides stay authoritative.
    return this.drew({
      ...server,
      x: previous.x+(state.x-previous.x)*blend+this.offset.x,
      y: previous.y+(state.y-previous.y)*blend+this.offset.y,
      z: previous.z+(state.z-previous.z)*blend+this.offset.z,
      yaw: state.yaw, grounded: state.grounded, guarding: state.guarding,
      // Which rush stage and which dash are the local copy's too: the
      // server's are a round trip old, and the renderer picks the stage's
      // clip and the dash's direction off them.
      chain: state.chain, dashKind: state.dashKind,
      // Lock combat: the round the stage is in, likewise (the renderer draws a second round's own blows off it).
      ...(state.lockRound !== undefined ? { lockRound: state.lockRound } : {}),
      // The combo ender (combos.ts) likewise: the renderer draws the ender's own clip off it.
      branch: state.branch,
      // Round 3d (ULTS): whether the local copy's ultimate has landed its
      // opener or missed with it - the camera's cinematic and the effects
      // start on it, and the server's word is a round trip old.
      confirmedAt: state.confirmedAt, whiffedAt: state.whiffedAt,
      action, actionSeq:state.actionSeq, actionStarted: playback?.started??state.actionStarted,
      actionDuration: holding?playback!.duration:finished?0:state.actionDuration,
      actionTime: holding?1:finished?0:playback?Math.min(1,playback.age/playback.duration):state.actionTime,
      actionFrozen: state.actionFrozen, hitstop: state.hitstop,
      // The freeze as a window as well as a flag. The authoritative window is
      // a round trip behind, so anything that reads it for the local fighter
      // has to get the local copy's - which is computed from the same code on
      // the frame the press was made.
      hitstopFrom: state.hitstopFrom, hitstopUntil: state.hitstopUntil,
    });
  }
  /** Round 3e (REACT): what `sample` draws, remembered for the next handover. */
  private drew(shown:PlayerState){
    // Round 5 (PARRY): a vanish waits for the parry it answers to be drawn (see `visualTime`).
    const hold=this.vanishHold;
    if(hold){if(this.visualTime<hold.at&&performance.now()<hold.until)shown={...shown,x:hold.x,y:hold.y,z:hold.z};else this.vanishHold=undefined;}
    if(this.lastDrawn){this.lastDrawn.x=shown.x;this.lastDrawn.y=shown.y;this.lastDrawn.z=shown.z;}else this.lastDrawn={x:shown.x,y:shown.y,z:shown.z};
    return shown;
  }
}
