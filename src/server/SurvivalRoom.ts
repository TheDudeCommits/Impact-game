import { requireRosterProtocol, type RosterProtocolOptions } from '../game/rosterProtocol';
import { isReleasedFighter } from '../game/rosterAvailability';
import {RoomRewards} from './economy/RoomRewards';
import { Room, type Client, type FixedTimestepCallback } from 'colyseus';
import { MOVES, SIMULATION_HZ, SNAPSHOT_HZ } from '../game/moves';
import { LOCK_ONLINE } from './lockOnline';
import { buildCollision, createRapierCollision } from '../game/rapierCollision';
import type { FighterId } from '../game/types';
import { HordeFrame } from '../survival/horde/frame';
import { SurvivalGame, MAX_PARTY, TREE_SECONDS } from '../survival/SurvivalGame';
import { dungeonFor } from '../survival/locations';
import { SURVIVAL_PROTOCOL, encode, slimView, DRAFT_SECONDS, TRAVEL_SECONDS, type CoopFrame } from '../survival/coopNet';
import { privateCodes, PRIVATE_WAIT_SECONDS } from './privateCodes';
import { InputQueue } from './InputQueue';
import { StepClock } from './StepClock';
import { SoloPause } from './SoloPause';
import { roomName, sharedEconomy } from './economy/api';
import { freshAccount } from './cluster/economyLink';
import { ITEMS, lookOf } from '../game/economy/catalog';
import { outfitFor } from '../game/economy/outfits';
import { lockedOut } from '../game/economy/fighters';
import { owns } from '../game/economy/account';
import { RoomFaults } from './RoomFaults';
import { ResyncGate } from './ResyncGate';
import { capacity } from './capacity';
import { PartyStart, PARTY_COUNTDOWN } from './social/PartyStart';
import type { RoomException, RoomMethodName } from 'colyseus';
import { closedMode } from '../originals/server';

interface JoinOptions extends RosterProtocolOptions { assetGate?: boolean; survivalProtocol?: number; fighter?: FighterId; name?: string; code?: string; creationToken?: string;
  /** Quick co-op: a public room anyone is matched into (joinOrCreate). */
  quick?: unknown;
  /** The fighter's rift progress (progressStore.carried): checked here, and again by SurvivalGame. */
  unlocked?: unknown; bonus?: unknown;
  /** The page's account token (the shop's): a fighter bought in the shop plays only for the account that owns them. */
  account?: string;
  /** A party's launch (PartyRoom): the members it reserved seats for. The run starts by itself once they are all in
   *  with their first world loaded (PartyStart). */
  party?: unknown }
type Seat = { fighter: FighterId; name: string; unlocked: string[]; bonus: number;
  look?: number[]; emotes?: string[]; emotedAt?: number;
  /** Their outfit for the fighter they play (economy/outfits.ts), from the same account. */
  outfit?: string };
export const COOP_RECONNECTION_SECONDS = 20;
/** A quick room's lobby starts its run this long after it opens (sooner when full, or when the host starts it). */
export const QUICK_LOBBY_SECONDS = 20;
/** A quick room's party goes back to the lobby this long after a run ends (the host can go sooner). */
export const QUICK_RESULTS_SECONDS = 25;

/** Arcade survival for a party: up to four fighters in one run, stepped here
 *  on the match server rather than in anyone's browser, so every one of them
 *  fights the same horde. A private room with a six-digit code, like a
 *  private match: the host creates it, friends join with the code while the
 *  party waits in the first act's world, and the host starts the run.
 *
 *  The run is SurvivalGame's, with a hero per client; the room adds what a
 *  shared run needs that a solo one does not - a clock for the upgrade draft
 *  (nobody waits forever on a friend who went to make tea), a wait at each
 *  act's end until every browser has loaded the next world, and a way back to
 *  the lobby for another run. Frames go out packed (see coopNet). */
export class SurvivalRoom extends Room {
  game!: SurvivalGame;
  private rewards = new RoomRewards();
  /** A throw in the tick is logged and contained, and a room that keeps faulting is closed (RoomFaults). */
  private faults = new RoomFaults(this);
  /** `resync-input`'s answers, rationed (ResyncGate). */
  private resync?: ResyncGate;
  /** Which run of the room this is: a new lobby is a new run. */
  private run = 0;
  private queues = new Map<string, InputQueue>();
  private seats = new Map<string, Seat>();
  private dropped = new Set<string>();
  private hostId: string | null = null;
  private code = '';
  private creationToken?: string;
  /** Quick co-op (the fifth list: "quick co-op matchmaking"): public, matched
   *  into by anyone, its lobby on a clock; fighters drop in between rounds. */
  private quick = false;
  /** A quick lobby's start, on the lobby's clock; when a quick run ended. */
  private quickStartAt = QUICK_LOBBY_SECONDS;
  private overSince = -1;
  /** Identifies the live fixed-step loop; bumped to retire it. */
  private loop = 0;
  private steps = 0;
  private draftSince = -1;
  /** When the party's pause for someone's skill tree began (see TREE_SECONDS). */
  private treeSince = -1;
  private travelSince = -1;
  private loaded = new Set<string>();
  private expiring = false;
  /** The horde as every fighter's browser draws it: one frame, packed once a
   *  broadcast and sent to all, with the horde's events since the last one. */
  private readonly hordeFrame = new HordeFrame();
  private hordeSeen = 0;
  /** Round 5 (SOLOPAUSE): a run with one fighter in it pauses for them (SoloPause): no tick, no horde, no clock. */
  private pause?: SoloPause;
  /** A party's room starts its first run by itself (PartyStart), at partyStartAt (lobby clock; -1: not counting). */
  private partyStart = new PartyStart(undefined, 0);
  private partyStartAt = -1;

  async onCreate(options: JoinOptions = {}) {
    requireRosterProtocol(options.rosterProtocol);
    { const closed = closedMode('arcade'); if (closed) throw new Error(closed); }
    this.quick = options.quick === true;
    if (!this.quick) {
      if (typeof options.creationToken !== 'string' || !/^[-0-9a-f]{36}$/i.test(options.creationToken)) throw new Error('Create a co-op room from the lobby.');
      capacity.admit(this); // Night cap: after the checks that can throw, before a code is dealt (src/server/capacity.ts)
      this.creationToken = options.creationToken;
      this.partyStart = new PartyStart(options.party, MAX_PARTY);
      this.code = privateCodes.allocate();
      this.roomId = `coop-${this.code}`;
    } else capacity.admit(this);
    this.maxClients = MAX_PARTY;
    // (140 dropped a fighter whose stalled browser's commands arrived bunched - two
    // seconds of them inside one - with close code 4002; the input queue bounds them anyway.)
    this.maxMessagesPerSecond = 320;
    this.autoDispose = true;
    try {
      // A private room is found by its code; a quick one by the matchmaker.
      if (!this.quick) await this.setPrivate(true);
      // The first run's world, with Rapier loaded for every one after it.
      const seed = SurvivalRoom.seed();
      this.game = this.lobby(seed, await createRapierCollision(dungeonFor(seed, 1).location.stage));
      await this.setMetadata({ mode: 'survival', visibility: this.quick ? 'public' : 'private', map: this.game.sim.stage, humanCapacity: MAX_PARTY });
    } catch (error) { if (this.code) privateCodes.release(this.code); capacity.release(this); this.game?.dispose(); throw error; }
    this.pause = new SoloPause({ solo: () => this.game.heroes.size === 1 ? this.game.heroes.keys().next().value : undefined,
      open: () => this.game.phase !== 'lobby' && this.game.phase !== 'over', queued: id => this.queues.get(id)?.length ?? 0,
      frozen: () => { for (const queue of this.queues.values()) queue.clear(); this.sendFrames(); },
      // The room's own wall-clock timers (a draft's, a tree's, a journey's, a quick room's results) skip the pause.
      thawed: ms => { for (const key of ['draftSince', 'treeSince', 'travelSince', 'overSince'] as const) if (this[key] >= 0) this[key] += ms; this.sendFrames(); },
      beat: () => this.sendFrames() });
    this.onMessage('pause', (client, raw: unknown) => this.pause?.request(client, raw, true));
    this.onMessage('resume', (client, raw: unknown) => this.pause?.request(client, raw, false));
    this.onMessage('input', (client, raw: unknown) => {
      if (this.pause?.frozen) return;
      if (!this.queues.get(client.sessionId)?.push(raw)) client.send('input-rejected', { reason: 'Invalid, stale or excess input' });
    });
    // A whole frame for its client, at most one each RESYNC_MS; one asked for inside that is sent when it ends (ResyncGate).
    this.resync = new ResyncGate(this, client => {
      this.queues.get(client.sessionId)?.clear();
      this.game.sim.clearPlayerInput(client.sessionId);
      client.sendBytes('resync', encode(this.frame(client.sessionId, this.game.snapshot(false))));
    });
    this.onMessage('start-private-match', client => this.start(client));
    this.onMessage('choose', (client, card: unknown) => this.choose(client, card));
    this.onMessage('reroll', client => { this.game.reroll(client.sessionId); });
    this.onMessage('loaded', (client, run: unknown) => this.loadedBy(client, run));
    this.onMessage('lobby', client => this.backToLobby(client));
    // What a fighter wears comes from their account on this server (the token opens it), and an emote only if it is on their wheel.
    this.onMessage('account', (client, token: unknown) => freshAccount(token, () => this.dress(client, token), () => this.clients.includes(client)));
    this.onMessage('emote', (client, place: unknown) => this.emote(client, place));
    this.onMessage('ping', (client, raw: unknown) => {
      if (typeof raw === 'number' && Number.isFinite(raw)) client.send('pong', { clientTime: raw, serverTime: this.game.sim.serverTime });
    });
    this.setFixedTimestep(() => this.faults.guard(() => this.tick()), SIMULATION_HZ);
  }

  private dress(client: Client, token: unknown) {
    this.rewards.bind(client.sessionId,token);
    const seat = this.seats.get(client.sessionId), account = sharedEconomy()?.book.find(token);
    if (!seat || !account) return;
    seat.look = lookOf(account.worn, seat.fighter); seat.emotes = [...(account.worn.emotes ?? [])];
    this.game.setLook(client.sessionId, seat.look);
    // Their outfit for the fighter they play, if it is theirs (owned, and that fighter's).
    const outfit = account.worn.outfits?.[seat.fighter];
    seat.outfit = outfit && owns(account, outfit) && outfitFor(outfit, seat.fighter) ? outfit : undefined;
    this.game.setOutfit(client.sessionId, seat.outfit);
  }
  private emote(client: Client, place: unknown) {
    const seat = this.seats.get(client.sessionId), item = typeof place === 'number' ? ITEMS[place] : undefined, now = Date.now();
    if (!seat || !item || !seat.emotes?.includes(item.id) || now - (seat.emotedAt ?? 0) < 1000) return;
    seat.emotedAt = now;
    this.game.emote(client.sessionId, place as number);
  }

  /** A run's seed: it draws the order of its dungeons. */
  private static seed() { return (Math.random() * 0x7fffffff | 0) || 1; }
  /** A fresh run waiting in its first dungeon, with everyone seated. */
  private lobby(seed = SurvivalRoom.seed(), collision = buildCollision(dungeonFor(seed, 1).location.stage)) {
    const game = new SurvivalGame({ heroes: [], lobby: true, slowMotion: false, collision, seed, lockCombat: LOCK_ONLINE });
    this.run++;this.rewards.next(this.run);
    for (const [id, seat] of this.seats) game.addHero({ id, ...seat });
    this.draftSince = this.travelSince = -1;
    this.hordeSeen = 0;
    this.loaded.clear();
    this.quickStartAt = QUICK_LOBBY_SECONDS; this.overSince = -1;
    return game;
  }

  private tick() {
    if (this.pause?.hold()) return;
    this.steps++;
    const game = this.game;
    // The end of an act: the fight moves to the next world once every
    // browser has it loaded, or once the slowest has had long enough.
    if (game.phase === 'travel' && game.travelTo) {
      if (this.travelSince < 0) { this.travelSince = Date.now(); this.loaded.clear(); }
      if (!this.loading() || Date.now() - this.travelSince > TRAVEL_SECONDS * 1000) {
        game.arrive(buildCollision(game.travelTo));
        this.travelSince = -1; this.loaded.clear();
      }
    }
    if (game.phase === 'draft' && game.drafting) {
      if (this.draftSince < 0) this.draftSince = Date.now();
      else if (Date.now() - this.draftSince > DRAFT_SECONDS * 1000) game.autoChoose();
    } else this.draftSince = -1;
    if (game.phase === 'draft' && game.upgradingNow) {
      if (this.treeSince < 0) this.treeSince = Date.now();
      else if (Date.now() - this.treeSince > TREE_SECONDS * 1000) { game.closeTrees(); this.treeSince = -1; }
    } else this.treeSince = -1;
    // A quick room's lobby starts on its clock (at once when full); its results go back to the lobby on theirs.
    if (this.quick && game.phase === 'lobby' && this.clients.length && !this.dropped.size && (game.sim.serverTime >= this.quickStartAt || game.heroes.size >= MAX_PARTY && game.sim.serverTime >= 3)) this.begin();
    // A party's room: every member it sent in, none reconnecting, each with the first world loaded (`loaded`), then the
    // lobby's own short count. A drop stops the count; it runs again once they are back.
    if (this.partyStart.waiting && game.phase === 'lobby') {
      if (this.partyStartAt < 0) { if (this.partyStart.complete(this.seats.size, this.dropped.size) && [...this.seats.keys()].every(id => this.loaded.has(id))) this.partyStartAt = game.sim.serverTime + PARTY_COUNTDOWN; }
      else if (this.dropped.size) this.partyStartAt = -1;
      else if (game.sim.serverTime >= this.partyStartAt) { this.partyStartAt = -1; this.partyStart.started(); this.begin(); }
    }
    if (this.quick && game.phase === 'over') {
      if (this.overSince < 0) { this.overSince = Date.now(); void this.lock(); }
      else if (Date.now() - this.overSince > QUICK_RESULTS_SECONDS * 1000) { this.again(); return; }
    }
    if (!this.quick && game.phase === 'lobby' && game.sim.serverTime >= PRIVATE_WAIT_SECONDS && !this.expiring) {
      this.expiring = true;
      this.broadcast('notice', { message: 'The co-op room expired after 15 minutes in the lobby. Create a new room.' });
      void this.disconnect(4004);
      return;
    }
    // One command a tick from each fighter, as in a match. While the run holds
    // its breath (a draft, a journey, the end) the commands are still taken,
    // and acknowledged, so nobody's queue fills up behind the pause.
    const waiting = new Set<string>();
    for (const [id, queue] of this.queues) {
      const input = queue.take();
      if (input) {game.submit(id, input);this.rewards.input(id,input);} else waiting.add(id);
    }
    // A fault in the run's rules is logged, not left to stop the room's clock.
    try { game.step(waiting); } catch (error) { this.faults.fault(error); }
    this.rewards.survival(game,this.run,!this.quick);
    if (this.steps % (SIMULATION_HZ / SNAPSHOT_HZ) === 0) this.sendFrames();
  }

  private sendFrames() {
    const game = this.game, snapshot = game.snapshot();
    const horde = this.packHorde(game);
    for (const client of this.clients) client.sendBytes('frame', encode({ ...this.frame(client.sessionId, snapshot), horde }));
  }

  /** This broadcast's horde, and what it did since the last (the newest, if
   *  a rout put more on the wire than a frame carries). */
  private packHorde(game: SurvivalGame) {
    this.hordeFrame.capture(game.horde, game.sim.serverTime);
    const events = game.horde.eventsSince(this.hordeSeen);
    this.hordeSeen = game.horde.lastEvent;
    return this.hordeFrame.pack(events.length > 255 ? events.slice(-255) : events);
  }

  /** Fighters whose browser has not loaded the next act yet. */
  private loading() {
    let n = 0;
    for (const id of this.queues.keys()) if (!this.loaded.has(id) && !this.dropped.has(id)) n++;
    return n;
  }

  private frame(id: string, snapshot: ReturnType<SurvivalGame['snapshot']>): CoopFrame {
    const game = this.game, checkpoint = game.sim.predictionCheckpoint(id);
    const lobby = game.phase === 'lobby';
    // The lobby reads as a private room still waiting: the client's own
    // waiting-room panel shows the code, the seats and the host's start.
    return { ...this.rewards.forOwner(snapshot,id), status: lobby ? 'waiting' : snapshot.status, ...(this.pause ? { pause: this.pause.view() } : {}),
      ...(checkpoint ? { prediction: { [id]: checkpoint }, queued: this.queues.get(id)?.low } : {}),
      // (A quick room waits in the same panel, its code QUICK and its clock running.)
      lobby: { visibility: 'private', code: this.quick ? 'QUICK' : this.code, hostId: this.hostId, canStart: lobby && this.dropped.size === 0 && !this.expiring,
        startsAt: this.quick && lobby ? this.quickStartAt : lobby && this.partyStartAt >= 0 ? this.partyStartAt : null, expiresAt: lobby && !this.quick ? PRIVATE_WAIT_SECONDS : null,
        ...(lobby ? this.partyStart.view(game.sim.serverTime) : {}) },
      survival: { ...slimView(game.view(id)), run: this.run, host: id === this.hostId, marked: game.marked(),
        draftLeft: game.phase === 'draft' && this.draftSince >= 0 ? Math.max(0, DRAFT_SECONDS - (Date.now() - this.draftSince) / 1000) : undefined,
        treeLeft: game.phase === 'draft' && this.treeSince >= 0 ? Math.max(0, TREE_SECONDS - (Date.now() - this.treeSince) / 1000) : undefined,
        loading: game.phase === 'travel' ? this.loading() : undefined } };
  }

  /** A fighter's card from the draft (or none). */
  choose(client: Client, card: unknown) { if (card === null || typeof card === 'string') this.game.choose(card ?? undefined, client.sessionId); }
  /** A fighter's browser has the next act's world loaded. */
  loadedBy(client: Client, run: unknown) { if (run === this.run && (this.game.phase === 'travel' || this.game.phase === 'lobby' && this.partyStart.waiting)) this.loaded.add(client.sessionId); }

  start(client: Client) {
    if (this.game.phase !== 'lobby') return;
    if (client.sessionId !== this.hostId) { client.send('notice', { message: 'Only the room host can start the run.' }); return; }
    if (this.dropped.size) { client.send('notice', { message: 'Waiting for a disconnected fighter to reconnect.' }); return; }
    this.partyStart.started(); this.partyStartAt = -1;
    this.begin();
  }
  /** The run begins. The room stays open: friends (or, in a quick room, anyone)
   *  drop in between rounds until it is full. */
  private begin() {
    this.game.begin();
    const n = this.game.heroes.size;
    this.broadcast('notice', { message: n > 1 ? `The rift opens — a party of ${n}. The horde grows to match.` : this.quick ? 'The rift opens — fighters who find this room drop in between rounds.' : 'The rift opens — friends with the code can drop in between rounds.' });
  }

  /** After a run: the host takes the party back to the lobby, where friends
   *  can join again before the next one starts. */
  backToLobby(client: Client) {
    if (this.game.phase !== 'over') return;
    if (client.sessionId !== this.hostId) { client.send('notice', { message: 'The host starts the next run.' }); return; }
    this.again();
  }
  private again() {
    const old = this.game;
    this.game = this.lobby();
    old.dispose();
    for (const queue of this.queues.values()) queue.clear();
    void this.unlock();
  }

  onAuth(_client: Client, options: JoinOptions = {}) {requireRosterProtocol(options.rosterProtocol);
    if(options.assetGate && options.survivalProtocol !== SURVIVAL_PROTOCOL) throw new Error('Refresh the page to load the updated Arcade skill tree.');
    if (options.fighter !== undefined && !isReleasedFighter(options.fighter)) throw new Error('Fighter is not available');
    // A fighter from the shop (economy/fighters.ts) only for the account that bought them.
    const locked = options.fighter !== undefined ? lockedOut(options.fighter, sharedEconomy()?.book.find(options.account)) : undefined;
    if (locked) throw new Error(locked);
    if (this.expiring) throw new Error('This co-op room has expired.');
    // A creation nonce prevents a concurrent create from claiming someone
    // else's freshly published room.
    if (!this.quick && options.code !== this.code && options.creationToken !== this.creationToken) throw new Error('Enter the room code to join this co-op run.');
    // A run under way takes a fighter in (between its rounds); one just ended does not.
    if (this.game.phase === 'over') throw new Error('That run has just ended. Join when the party is back in the lobby.');
    if (this.game.phase !== 'lobby' && this.game.heroes.size >= MAX_PARTY) throw new Error('This co-op room is full.');
    return true;
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    this.onAuth(client, options);
    const seat: Seat = { fighter: options.fighter ?? 'taisei', name: roomName(options.account, options.name, 18),
      unlocked: Array.isArray(options.unlocked) ? options.unlocked.filter((id): id is string => typeof id === 'string' && id.length < 40).slice(0, 12) : [],
      bonus: typeof options.bonus === 'number' && Number.isFinite(options.bonus) ? Math.max(0, Math.min(2, Math.floor(options.bonus))) : 0 };
    const midRun = this.game.phase !== 'lobby';
    if (!(midRun ? this.game.dropIn({ id: client.sessionId, ...seat }) : this.game.addHero({ id: client.sessionId, ...seat }))) throw new Error('This co-op room is full.');
    this.seats.set(client.sessionId, seat);this.rewards.bind(client.sessionId,options.account,true);
    if (midRun) this.broadcast('notice', { message: `${seat.name} joins the run — in when this round's boss falls.` }, { except: client });
    if (this.hostId === null) this.hostId = client.sessionId;
    this.queues.set(client.sessionId, new InputQueue());
    client.send('welcome', { playerId: client.sessionId, roomId: this.roomId, mode: 'survival', tickRate: SIMULATION_HZ, snapshotRate: SNAPSHOT_HZ, botCount: 0 });
    client.sendBytes('frame', encode(this.frame(client.sessionId, this.game.snapshot(false))));
  }

  async onDrop(client: Client) {
    if (!this.game.heroes.has(client.sessionId)) return;
    this.dropped.add(client.sessionId);
    this.queues.get(client.sessionId)?.clear();
    this.game.sim.clearPlayerInput(client.sessionId);
    this.pause?.drop(client.sessionId);
    try { await this.allowReconnection(client, COOP_RECONNECTION_SECONDS); }
    catch { this.onLeave(client); }
  }

  onReconnect(client: Client) {
    this.dropped.delete(client.sessionId);
    this.resync?.forget(client.sessionId);
    this.queues.get(client.sessionId)?.clear();
    this.game.sim.clearPlayerInput(client.sessionId);
    client.sendBytes('frame', encode(this.frame(client.sessionId, this.game.snapshot(false))));
  }

  onLeave(client: Client) {
    // A party member gone before the first run: the host starts it (PartyStart), and the party's count stops.
    if (this.partyStart.waiting && this.game?.phase === 'lobby') { this.partyStart.left(); this.partyStartAt = -1; }
    this.rewards.leave(client.sessionId);
    const id = client.sessionId;
    this.dropped.delete(id);
    this.resync?.forget(id);
    this.queues.delete(id);
    this.seats.delete(id);
    this.loaded.delete(id);
    this.game.removeHero(id);
    if (this.hostId === id) {
      this.hostId = this.clients.find(other => other.sessionId !== id)?.sessionId ?? null;
      if (this.hostId) this.broadcast('notice', { message: 'The host left — you are hosting now.' });
    }
  }

  /** The same clock as ArenaRoom's (see there): banks real time up to half a
   *  second and repays it at most four steps per timer callback, each from
   *  setImmediate so the sockets are read between them. */
  override setFixedTimestep(step: FixedTimestepCallback, tickRate = SIMULATION_HZ) {
    const clock = new StepClock(tickRate), loop = ++this.loop, dt = 1 / tickRate;
    let tick = 0, budget = 0, pending = false;
    clock.advance(performance.now());
    const run = () => {
      pending = false;
      if (loop !== this.loop) return;
      if (budget > 0 && clock.take()) { budget--; step({ dt, dtMs: dt * 1000, tick: tick++, subSteps: 1, subDt: dt, subDtMs: dt * 1000 }); }
      if (budget > 0 && clock.owed > 0 && loop === this.loop) { pending = true; setImmediate(run); }
    };
    this.setTimestep(() => {
      if (loop !== this.loop) return;
      clock.advance(performance.now());
      budget = StepClock.PER_CALLBACK;
      if (!pending && clock.owed > 0) { pending = true; setImmediate(run); }
    }, 1000 / tickRate);
  }

  /** Colyseus's room-level handler: a throw in a message handler, a clock event or a leave is logged and contained. */
  onUncaughtException(error: RoomException, method: RoomMethodName) { this.faults.report(error, method); }

  onDispose() { this.loop++; this.queues.clear(); this.dropped.clear(); this.resync?.clear(); if (this.code) privateCodes.release(this.code); capacity.release(this); this.game?.dispose(); }
}
