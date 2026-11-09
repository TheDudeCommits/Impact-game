import {BALL_ARENAS, isBallArena, type BallArenaId} from '../../game/ball/arenas';
import {LAG_COMPENSATION} from '../../game/simulation';
import {LOCK_ONLINE} from '../lockOnline';
import {requireRosterProtocol, type RosterProtocolOptions} from '../../game/rosterProtocol';
import {isReleasedFighter} from '../../game/rosterAvailability';
import {PartyStart, PARTY_COUNTDOWN} from '../social/PartyStart';
import {Room, type Client, type FixedTimestepCallback, type RoomException, type RoomMethodName} from 'colyseus';
import {SIMULATION_HZ} from '../../game/moves';
import type {FighterId} from '../../game/types';
import {buildCollision, createRapierCollision} from '../../game/rapierCollision';
import {BallMatch} from '../../game/ball/BallMatch';
import {BALL_MODES, BALL_PROTOCOL, BALL_RULES, BALL_STAGE, type BallModeId, type BallSnapshot} from '../../game/ball/model';
import {InputQueue} from '../InputQueue';
import {StepClock} from '../StepClock';
import {SoloPause} from '../SoloPause';
import {AssetGate} from '../social/AssetGate';
import {EmoteRelay, SOCIAL_PROTOCOL} from '../social/EmoteRelay';
import {RoomFaults} from '../RoomFaults';
import {capacity} from '../capacity';
import {privateCodes, PRIVATE_WAIT_SECONDS} from '../privateCodes';
import {roomName, sharedEconomy} from '../economy/api';
import {freshAccount} from '../cluster/economyLink';
import {lockedOut} from '../../game/economy/fighters';
import {owns} from '../../game/economy/account';
import {outfitFor} from '../../game/economy/outfits';
import {RoomRewards} from '../economy/RoomRewards';
import {isMutator, weeklyMutator, type BallMutator} from '../../game/ball/mutators';
import {lookOfWorn} from '../../game/ball/look';
import {RANKED, bandOf, rankedStart, rate, type RankedSeat} from '../../game/ball/ranked';
import {ranked} from './ranked';
import {otherTeam} from '../../game/ball/model';

interface Options extends RosterProtocolOptions {party?: unknown; ballProtocol?: unknown; ball?: unknown; access?: unknown; fighter?: unknown; name?: unknown; code?: unknown; creationToken?: unknown; rumble?: unknown; arena?: unknown; account?: string; assetGate?: boolean; skill?: unknown;
  /** Matchmaking's queues: CLASSIC, the weekly PLAYLIST (its mutator: this week's), RANKED. */ queue?: unknown; mutator?: unknown; band?: unknown;}
/** Matchmaking's three queues, kept apart by the matchmaker's filter (src/server/index.ts filterBy). */
export type BallQueue = 'classic' | 'playlist' | 'ranked';
const QUEUES: readonly BallQueue[] = ['classic', 'playlist', 'ranked'];
/** Seconds a quick match waits for more people before bots fill the empty seats and it kicks off. */
const QUICK_WAIT = 15;
/** Seconds a finished match's room stays open for its results and a rematch. */
const AFTER_MATCH = 300;

/** A Goal Rush or Sky Spike room (game/ball): its own authoritative simulation, the ball in it, three a side. Public
 *  matchmaking (`quick`) fills with bots after a short wait; a private room (`host`) starts when its host says, with a
 *  six-digit code for friends. Modelled on Rift War's room (moba/RiftRoom.ts): the same input queue, step clock, pause,
 *  asset gate, emotes and rewards. */
export class BallRoom extends Room {
  game!: BallMatch;
  private mode: BallModeId = 'goal-rush';
  private partyStart = new PartyStart(undefined, 0);
  private access: 'quick' | 'host' = 'quick';
  /** RUMBLE's charms (a private room's host chooses; matchmaking is always classic). */
  private rumble = false;
  /** The host's arena (game/ball/arenas.ts); none: each match the mode's arenas in turn by its seed. */
  private arena: BallArenaId | undefined;
  /** A mutator: the host's choice, or the weekly playlist's (mutators.ts). */
  private mutator: BallMutator | null = null;
  /** Which matchmaking queue a public room is (a private room's is 'classic'). */
  private queue: BallQueue = 'classic';
  /** RANKED (game/ball/ranked.ts): each person's account, the people who started the match (rated against each other at
   *  its end), and those already rated (a leaver's forfeit, or the end). */
  private readonly accounts = new Map<string, string>();
  private started: RankedSeat[] = [];
  private readonly rated = new Set<string>();
  private code?: string;
  private nonce?: string;
  private queues = new Map<string, InputQueue>();
  private dropped = new Set<string>();
  private rejected = new Set<string>();
  private commandsAt = new Map<string, number>();
  private resyncAt = new Map<string, number>();
  private assets!: AssetGate;
  private emotes?: EmoteRelay;
  private pause?: SoloPause;
  private autoStartAt = Infinity;
  private expired = false;
  private overAt = Infinity;
  private loop = 0;
  private faults = new RoomFaults(this);
  private rewards = new RoomRewards();
  async onCreate(options: Options = {}) {
    requireRosterProtocol(options.rosterProtocol);
    if (options.ballProtocol !== BALL_PROTOCOL) throw new Error('Refresh the page to load the ball modes.');
    if (!BALL_MODES.includes(options.ball as BallModeId)) throw new Error('Choose Goal Rush or Sky Spike.');
    if (options.access !== 'quick' && options.access !== 'host') throw new Error('Choose online matchmaking or a private room.');
    this.mode = options.ball as BallModeId; this.access = options.access; this.rumble = this.access === 'host' && options.rumble === true;
    if (this.access === 'quick') {
      const queue = options.queue ?? 'classic';
      if (!QUEUES.includes(queue as BallQueue)) throw new Error('Choose a queue: classic, the weekly playlist or ranked.');
      this.queue = queue as BallQueue;
      // The weekly playlist plays this week's mutator, the same for everyone (a page from last week is told to look again).
      if (this.queue === 'playlist') { const week = weeklyMutator(Date.now()); if (options.mutator !== week) throw new Error("This week's playlist has changed. Open the mode again."); this.mutator = week; }
    } else if (isMutator(options.mutator)) { this.mutator = options.mutator; this.rumble = false; }
    if (this.access === 'host' && isBallArena(options.arena) && BALL_ARENAS[options.arena].mode === options.ball) this.arena = options.arena;
    if (this.access === 'host') {
      if (typeof options.creationToken !== 'string' || !/^[-0-9a-f]{36}$/i.test(options.creationToken)) throw new Error('Create this room from the mode menu.');
      this.nonce = options.creationToken;
    }
    capacity.admit(this);
    this.code = privateCodes.allocate(); this.roomId = 'ball-' + this.code; this.maxClients = BALL_RULES.capacity; this.maxMessagesPerSecond = 320; this.autoDispose = true;
    try {
      this.game = this.fresh(await createRapierCollision(BALL_STAGE[this.mode]), 1);
      this.partyStart = new PartyStart(options.party, 6);
      if (this.access === 'host') await this.setPrivate(true);
      await this.setMetadata(this.listing(0));
    } catch (error) { privateCodes.release(this.code); capacity.release(this); this.game?.dispose(); throw error; }
    this.assets = new AssetGate(this); this.emotes = new EmoteRelay(this);
    this.pause = new SoloPause({solo: () => { const humans = [...this.game.seats.values()].filter(s => !s.bot); return humans.length === 1 ? humans[0].id : undefined; },
      open: () => this.game.view.phase !== 'lobby' && this.game.view.phase !== 'over', queued: id => this.queues.get(id)?.length ?? 0,
      frozen: () => { for (const q of this.queues.values()) q.clear(); this.sendSnapshots(); }, thawed: ms => { this.assets.shift(ms); this.sendSnapshots(); }, beat: () => this.sendSnapshots()});
    this.onMessage('pause', (c, data: unknown) => this.pause?.request(c, data, true));
    this.onMessage('resume', (c, data: unknown) => this.pause?.request(c, data, false));
    this.onMessage('input', (c, data: unknown) => { if (this.pause?.frozen) return; if (this.queues.get(c.sessionId)?.push(data) || this.rejected.has(c.sessionId)) return; this.rejected.add(c.sessionId); c.send('input-rejected', {reason: 'Invalid, stale or excess input'}); });
    this.onMessage('resync-input', c => { const now = performance.now(); if (now < (this.resyncAt.get(c.sessionId) ?? 0)) return; this.resyncAt.set(c.sessionId, now + 500); this.rejected.delete(c.sessionId); this.queues.get(c.sessionId)?.clear(); this.game.sim.clearPlayerInput(c.sessionId); c.send('input-resync', this.forOwner(this.game.snapshot(), c.sessionId)); });
    this.onMessage('ball-start', (c, payload: unknown) => { if (this.access !== 'host' || c.sessionId !== this.game.view.hostId) return; if (payload && typeof payload === 'object' && 'fillBots' in payload) this.game.setFill(c.sessionId, payload.fillBots); this.begin(); });
    this.onMessage('ball-fill', (c, fill: unknown) => this.command(c, () => { if (!this.game.setFill(c.sessionId, fill)) return 'Only the host can change that.'; this.sendSnapshots(); return undefined; }));
    this.onMessage('ball-rumble', (c, on: unknown) => this.command(c, () => { if (this.access !== 'host') return 'Matchmaking plays its own rules.'; if (!this.game.setRumble(c.sessionId, on)) return 'Only the host can change that.'; this.rumble = this.game.view.rumble; this.mutator = this.game.view.mutator ?? null; this.sendSnapshots(); return undefined; }));
    // A private room's RULES: 'classic', 'rumble' or a mutator (mutators.ts).
    this.onMessage('ball-rules', (c, rules: unknown) => this.command(c, () => {
      // (Matchmaking's rooms play their queue's rules: classic, the week's mutator, ranked.)
      if (this.access !== 'host') return 'Matchmaking plays its own rules.';
      const ok = rules === 'rumble' ? this.game.setRumble(c.sessionId, true) : rules === 'classic' ? this.game.setRumble(c.sessionId, false) && this.game.setMutator(c.sessionId, null) : isMutator(rules) && this.game.setMutator(c.sessionId, rules);
      if (!ok) return 'Only the host can change that.';
      this.rumble = this.game.view.rumble; this.mutator = this.game.view.mutator ?? null; this.sendSnapshots(); return undefined;
    }));
    this.onMessage('ball-arena', (c, arena: unknown) => this.command(c, () => { if (!this.game.setArena(c.sessionId, arena)) return 'Only the host can change that.'; this.arena = this.game.view.arena; this.sendSnapshots(); return undefined; }));
    this.onMessage('ball-swap', c => this.command(c, () => { if (!this.game.swap(c.sessionId)) return 'The other side is full.'; this.sendSnapshots(); return undefined; }));
    this.onMessage('ball-skip', c => { this.game.skip(c.sessionId); });
    this.onMessage('ball-chat', (c, index: unknown) => { this.game.chat(c.sessionId, index); });
    this.onMessage('ball-rematch', c => { if (this.game.view.phase === 'over' && (this.access === 'quick' || c.sessionId === this.game.view.hostId)) this.rematch(); });
    this.onMessage('account', (c, token: unknown) => freshAccount(token, () => this.dress(c, token), () => this.clients.includes(c)));
    // (A ball room starts on its asset gate, not on a ready gate: a page's 'ready' is heard and has nothing to do.)
    this.onMessage('ready', () => {});
    this.onMessage('ping', (c, data: unknown) => { if (typeof data === 'number' && Number.isFinite(data)) c.send('pong', {clientTime: data, serverTime: this.game.sim.serverTime}); });
    this.setFixedTimestep(({dt}) => this.faults.guard(() => this.tick(dt)), SIMULATION_HZ);
  }
  private fresh(collision: ReturnType<typeof buildCollision>, round: number) {
    const game = new BallMatch(this.mode, {collision, seed: Math.random() * 0x7fffffff | 0 || 1, access: this.access, round, fillBots: true, lockCombat: LOCK_ONLINE, rumble: this.rumble, mutator: this.mutator, arena: this.arena, intro: true});
    game.sim.rewind = LAG_COMPENSATION; game.view.code = this.code;
    // A ranked queue's room: ranked or not is settled at kickoff, by the people seated then.
    if (this.queue === 'ranked') game.view.ranked = false;
    return game;
  }
  private async updateSeats() { await this.setMetadata(this.listing([...this.game.seats.values()].filter(s => !s.bot).length)); }
  /** What the matchmaker reads of this room: its mode and way, its queue (and the playlist's mutator), the people in it. */
  private listing(players: number) {
    const people = [...this.game?.seats.values() ?? []].filter(s => !s.bot && s.rank), band = people.length ? bandOf(people.reduce((n, s) => n + s.rank!.rating, 0) / people.length) : undefined;
    return {mode: this.mode, ball: this.mode, access: this.access, queue: this.queue, ...(this.mutator && this.access === 'quick' ? {mutator: this.mutator} : {}), ...(this.queue === 'ranked' && band !== undefined ? {band} : {}), map: BALL_STAGE[this.mode], players};
  }
  private command(client: Client, fn: () => unknown) {
    const now = performance.now(); if (now < (this.commandsAt.get(client.sessionId) ?? 0)) return;
    this.commandsAt.set(client.sessionId, now + 120); const error = fn(); if (typeof error === 'string') client.send('notice', {message: error});
  }
  onAuth(_client: Client, options: Options = {}) {
    requireRosterProtocol(options.rosterProtocol);
    if (options.ballProtocol !== BALL_PROTOCOL) throw new Error('Refresh the page to load the ball modes.');
    if (options.ball !== this.mode) throw new Error('This room plays another mode.');
    if (this.access === 'quick' && (options.queue ?? 'classic') !== this.queue) throw new Error('This room plays another queue.');
    if (!this.game || this.expired || this.game.view.phase !== 'lobby') throw new Error('This match has already started or expired.');
    if (typeof options.fighter !== 'string' || !isReleasedFighter(options.fighter)) throw new Error('Choose an available fighter.');
    if (this.game.seats.size >= BALL_RULES.capacity) throw new Error('This match is full.');
    const locked = lockedOut(options.fighter as FighterId, sharedEconomy()?.book.find(options.account)); if (locked) throw new Error(locked);
    if (this.queue === 'ranked' && !sharedEconomy()?.book.find(options.account)) throw new Error('Ranked plays for your account: open Account once, then queue again.');
    if (this.access === 'host' && options.code !== this.code && options.creationToken !== this.nonce) throw new Error('Enter the six-digit room code.');
    return true;
  }
  onJoin(client: Client, options: Options = {}) {
    this.onAuth(client, options); this.assets.add(client, options.assetGate);
    this.game.add(client.sessionId, options.fighter as FighterId, roomName(options.account, options.name, 18)); this.game.sim.setPlayerSkill(client.sessionId, options.skill);
    this.queues.set(client.sessionId, new InputQueue()); this.dress(client, options.account); void this.updateSeats().catch(error => this.faults.fault(error));
    if (this.access === 'quick' && this.autoStartAt === Infinity) this.autoStartAt = this.game.sim.serverTime + (this.queue === 'ranked' ? RANKED.wait : QUICK_WAIT);
    if (this.queue === 'ranked') this.standing(client.sessionId, sharedEconomy()?.book.find(options.account)?.pk);
    client.send('welcome', {playerId: client.sessionId, roomId: this.roomId, mode: this.mode, tickRate: SIMULATION_HZ, snapshotRate: BALL_RULES.snapshotHz, social: SOCIAL_PROTOCOL});
    client.send('snapshot', this.forOwner(this.game.snapshot(), client.sessionId));
  }
  private dress(client: Client, token: unknown) {
    this.rewards.bind(client.sessionId, token); this.emotes?.bind(client.sessionId, token);
    const account = sharedEconomy()?.book.find(token), state = this.game.sim.actors.get(client.sessionId)?.state;
    if (!account || !state) return;
    const outfit = account.worn.outfits?.[state.fighter];
    state.outfit = outfit && owns(account, outfit) && outfitFor(outfit, state.fighter) ? outfit : undefined;
    // The ball gear the account wears and owns (game/ball/look.ts): its ball skin, trail, goal burst, celebration.
    this.game.setLook(client.sessionId, lookOfWorn(account.worn, id => owns(account, id)));
  }
  private begin() {
    if (this.dropped.size) { this.broadcast('notice', {message: 'Waiting for a player to reconnect.'}); return; }
    if (this.game.start()) { this.partyStart.started(); void this.lock(); this.kickoffRanked(); }
    else if (this.game.view.phase === 'lobby') this.broadcast('notice', {message: 'Each side needs a fighter. Turn bots on to fill the teams.'});
  }
  private tick(dt: number) {
    if (this.pause?.hold()) return;
    const v = this.game.view;
    if (v.phase === 'lobby') {
      if (this.partyStart.waiting && this.autoStartAt === Infinity && this.partyStart.complete(this.queues.size, this.dropped.size) && this.assets.ready(this.game.snapshot())) this.autoStartAt = this.game.sim.serverTime + PARTY_COUNTDOWN;
      if (this.game.sim.serverTime >= PRIVATE_WAIT_SECONDS) { this.expired = true; this.broadcast('notice', {message: 'This room expired. Start a new match.'}); void this.disconnect(4004); return; }
      if ((this.access === 'quick' || this.partyStart.waiting) && !this.dropped.size && this.queues.size && (this.game.sim.serverTime >= this.autoStartAt || this.queues.size >= this.maxClients)) this.begin();
    }
    const waiting = new Set<string>();
    for (const [id, q] of this.queues) { const input = q.take(); if (input) { this.game.submit(id, input); this.rewards.input(id, input); } else waiting.add(id); }
    // The kickoff waits for every page to have loaded the pitch and the fighters.
    // (Its intro, when it has one, runs in the countdown: held at its start too - ceremony.ts INTRO.)
    if (v.phase === 'countdown' && !this.assets.ready(this.game.snapshot())) v.startsAt = this.game.sim.serverTime + this.game.leadIn();
    this.game.step(dt, waiting);
    if (this.game.view.phase === 'over' && this.overAt === Infinity) { this.overAt = this.game.sim.serverTime; this.finishRanked(); }
    if (this.game.sim.serverTime - this.overAt > AFTER_MATCH) { void this.disconnect(4006); return; }
    if (this.game.sim.tick % (SIMULATION_HZ / BALL_RULES.snapshotHz) === 0) this.sendSnapshots();
  }
  private forOwner(snapshot: BallSnapshot, id: string): BallSnapshot {
    const checkpoint = this.game.sim.predictionCheckpoint(id);
    const startsAt = snapshot.ball.phase === 'lobby' && Number.isFinite(this.autoStartAt) ? this.autoStartAt : snapshot.ball.startsAt;
    return {...snapshot, ...(this.pause ? {pause: this.pause.view()} : {}), ...(checkpoint ? {prediction: {[id]: checkpoint}, queued: this.queues.get(id)?.low} : {}),
      ball: {...snapshot.ball, startsAt, ...this.partyStart.view(this.game.sim.serverTime)}, receipt: this.rewards.receipt(id)};
  }
  private sendSnapshots() { const snapshot = this.game.snapshot(true); this.rewards.observe(snapshot); for (const client of this.clients) client.send('snapshot', this.forOwner(snapshot, client.sessionId)); }
  private rematch() {
    if (this.dropped.size) { this.broadcast('notice', {message: 'Wait for everyone to reconnect.'}); return; }
    const old = this.game, seats = [...old.seats.values()].filter(s => !s.bot), looks = new Map(old.sim.playerStates().map(p => [p.id, p.outfit]));
    this.game = this.fresh(buildCollision(BALL_STAGE[this.mode]), old.view.round + 1);
    for (const seat of seats) { this.game.add(seat.id, seat.fighter, seat.name, false, seat.team); this.game.sim.actors.get(seat.id)!.state.outfit = looks.get(seat.id); this.game.setLook(seat.id, seat.look); }
    old.dispose(); this.overAt = Infinity;
    this.autoStartAt = this.access === 'quick' ? this.game.sim.serverTime + 6 : Infinity; this.rejected.clear(); this.commandsAt.clear(); this.resyncAt.clear();
    for (const [id, q] of this.queues) { q.clear(); this.clients.find(c => c.sessionId === id)?.send('input-resync', this.forOwner(this.game.snapshot(), id)); }
    if (this.queue === 'ranked') { this.started = []; this.rated.clear(); for (const seat of seats) this.standing(seat.id, this.accounts.get(seat.id)); }
    void this.updateSeats().then(() => this.unlock()).catch(error => this.faults.fault(error));
  }
  // ─── RANKED (game/ball/ranked.ts) ───────────────────────────────────────────────────────────────────────────────
  /** A person's standing, asked of the ratings (control's, in the cluster) and put on their seat for every page. */
  private standing(id: string, pk: string | undefined) {
    const service = ranked();
    if (!pk || !service) return;
    this.accounts.set(id, pk);
    void service.rating(pk, this.mode).then(r => {
      const seat = this.game.seats.get(id);
      if (!seat || seat.bot || this.accounts.get(id) !== pk) return;
      seat.rank = {rating: r.rating, games: r.games}; this.game.view.seats = [...this.game.seats.values()];
      void this.updateSeats().catch(error => this.faults.fault(error));
    }, error => this.faults.fault(error));
  }
  /** The people seated as the match starts, with their standings: ranked if each side has one. */
  private kickoffRanked() {
    if (this.queue !== 'ranked') return;
    this.started = [...this.game.seats.values()].filter(s => !s.bot && this.accounts.has(s.id)).map(s => ({id: s.id, pk: this.accounts.get(s.id)!, team: s.team, rating: s.rank?.rating ?? RANKED.start, games: s.rank?.games ?? 0}));
    this.game.view.ranked = rankedStart(this.started);
  }
  private matchKey() { return `${this.roomId}:${this.game.view.round}`; }
  /** A person leaving a ranked match before the final whistle: a loss, at once. */
  private forfeit(id: string) {
    const seat = this.started.find(s => s.id === id), v = this.game?.view;
    if (!seat || !v?.ranked || v.phase === 'lobby' || v.phase === 'over' || this.rated.has(id)) return;
    this.rated.add(id);
    const delta = rate(this.started, [seat], otherTeam(seat.team)).get(id);
    if (delta !== undefined) void ranked()?.apply(seat.pk, this.mode, delta, false, this.matchKey());
  }
  /** The final whistle of a ranked match: everyone who started and stayed, rated; the change on their seat. */
  private finishRanked() {
    const v = this.game.view;
    if (this.queue !== 'ranked' || !v.ranked || !v.winner) return;
    const stayed = this.started.filter(s => !this.rated.has(s.id) && this.game.seats.get(s.id) && !this.game.seats.get(s.id)!.bot);
    const deltas = rate(this.started, stayed, v.winner);
    for (const s of stayed) {
      const delta = deltas.get(s.id);
      if (delta === undefined) continue;
      this.rated.add(s.id);
      const seat = this.game.seats.get(s.id)!;
      seat.rank = {rating: s.rating + delta, games: s.games + 1, delta};
      void ranked()?.apply(s.pk, this.mode, delta, s.team === v.winner, this.matchKey()).then(r => { if (r && seat.rank) { seat.rank = {rating: r.rating, games: r.games, delta}; this.game.view.seats = [...this.game.seats.values()]; } });
    }
    v.seats = [...this.game.seats.values()];
  }
  async onDrop(client: Client) { if (!this.game.seats.has(client.sessionId)) return; this.dropped.add(client.sessionId); this.queues.get(client.sessionId)?.clear(); this.game.disconnect(client.sessionId, true); this.pause?.drop(client.sessionId); try { await this.allowReconnection(client, 20); } catch { this.onLeave(client); } }
  onReconnect(client: Client) { this.resyncAt.delete(client.sessionId); this.dropped.delete(client.sessionId); this.rejected.delete(client.sessionId); this.queues.get(client.sessionId)?.clear(); this.game.disconnect(client.sessionId, false); client.send('input-resync', this.forOwner(this.game.snapshot(), client.sessionId)); }
  onLeave(client: Client) {
    this.rewards.leave(client.sessionId);
    this.forfeit(client.sessionId);
    if (this.partyStart.waiting && this.game?.view.phase === 'lobby') { this.partyStart.left(); this.autoStartAt = Infinity; }
    this.assets?.remove(client.sessionId); this.dropped.delete(client.sessionId); this.rejected.delete(client.sessionId); this.queues.delete(client.sessionId); this.commandsAt.delete(client.sessionId); this.resyncAt.delete(client.sessionId); this.emotes?.leave(client.sessionId);
    this.game?.remove(client.sessionId); void this.updateSeats().catch(error => this.faults.fault(error));
  }
  override setFixedTimestep(step: FixedTimestepCallback, hz = SIMULATION_HZ) {
    const clock = new StepClock(hz), loop = ++this.loop, dt = 1 / hz; let tick = 0, budget = 0, pending = false; clock.advance(performance.now());
    const run = () => { pending = false; if (loop !== this.loop) return; if (budget > 0 && clock.take()) { budget--; step({dt, dtMs: dt * 1000, tick: tick++, subSteps: 1, subDt: dt, subDtMs: dt * 1000}); } if (budget > 0 && clock.owed > 0 && loop === this.loop) { pending = true; setImmediate(run); } };
    this.setTimestep(() => { if (loop !== this.loop) return; clock.advance(performance.now()); budget = StepClock.PER_CALLBACK; if (!pending && clock.owed > 0) { pending = true; setImmediate(run); } }, 1000 / hz);
  }
  onUncaughtException(error: RoomException, method: RoomMethodName) { this.faults.report(error, method); }
  onDispose() { this.loop++; this.queues.clear(); this.dropped.clear(); this.commandsAt.clear(); this.resyncAt.clear(); if (this.code) privateCodes.release(this.code); capacity.release(this); this.game?.dispose(); }
}
