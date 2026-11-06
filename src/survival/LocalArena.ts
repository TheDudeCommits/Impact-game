import { requireReleasedFighter } from '../game/rosterAvailability';
// Rapier is loaded on demand, as the rest of the client loads it: a static
// import here would put its wasm in the bundle every mode starts with.
const rapier = () => import('../game/rapierCollision').then(module => module.createRapierCollision);
import type { FighterId, GameSnapshot, PlayerInput, RoomMode } from '../game/types';
import { SurvivalGame, PLAYER_ID, type SurvivalView } from './SurvivalGame';
import { locationFor, dungeonFor } from './locations';
import { HordeFrames } from './horde/frame';
import { Autopilot, watchCrowd } from './autopilot';
import { glitch } from '../ui/survival/glitch';
import { carried } from './progressStore';
import type { PathKind } from './paths';
import type {StageId} from '../game/stages';
import { DeviceRun } from '../game/economy/device';
import { lockCombatOn } from '../game/lockMode';
import { SECOND } from '../game/couchSeat';

/** Arcade survival's room: the same surface `Network` gives main.ts - a
 *  snapshot, an id, `send` for the one command a tick and the callbacks - but
 *  the simulation runs right here. Each command the client sends is one tick
 *  of the arena, exactly as it is one tick on the match server, so the input
 *  clock, the rendering and the whole combat pipeline are shared; there is
 *  simply no round trip, so there is nothing to predict and nothing to
 *  correct. The game can pause, which an online room never could. */
export class LocalArena {
  readonly local = true;
  room: { send(type: string, payload?: unknown): void } | null = null;
  snapshot: GameSnapshot | null = null;
  receivedAt = 0;
  predictionReady = false;
  game: SurvivalGame | null = null;
  onSnapshot = (_snapshot: GameSnapshot) => {};
  onControlReset = () => {};
  onDisconnect = (_reason: string) => {};
  onNotice = (_message: string) => {};
  /** Loads what a round needs drawn - its stage and any probe bosses -
   *  before the arena moves there. Set by the client. */
  prepare?: (round: number, extra: readonly string[], stage:StageId) => Promise<void>;
  /** Held while settings are open or the tab is hidden. */
  private pausedNow = false;
  get paused() { return this.pausedNow; }
  set paused(value: boolean) { this.pausedNow = value; if (value) this.clearPresses(); }
  /** Steps owed at a fractional time scale (slow motion). */
  private owed = 0;
  /** Input samples keep coming during slow motion. Carry their button edges
   * only to the next simulation tick, never a queue of future attacks. */
  private pressedAttack?: PlayerInput['attack'];
  private pressedJump = false;
  private pressedDash = false;
  private pressedAwaken = false;
  private clearPresses() { this.pressedAttack = undefined; this.pressedJump = this.pressedDash = this.pressedAwaken = false; }
  private travelling = false;
  private generation = 0;
  private fighter: FighterId = 'taisei';
  private name = 'You';
  /** The horde as drawn: a frame captured on every tick. */
  readonly hordeFrames = new HordeFrames();
  /** `?allies=taisei,gummy`: a party of bots beside the fighter, for looking at
   *  co-op's frames and markers without a room (`?allydown` fells the first). */
  private allies: { id: string; pilot: Autopilot }[] = [];
  private allyDown = false;
  private fallAt = 0;
  private kinds: string[] = [];
  private kindsAt = 0;
  /** The run's report for pay once it ends (economy/device.ts): the account's server pays it within its caps. */
  private rewards = new DeviceRun();
  /** Couch co-op (couch/seats.ts): the second person's hero, beside the first, and its command for each tick (main.ts
   *  sets it). Player 1's run pays the device's account, as a run with a friend once Player 2 has played too
   *  (economy/device.ts): alone, as a solo run is, with the friend's line. */
  partner?: { fighter: FighterId; name: string };
  second: () => PlayerInput | undefined = () => undefined;
  private secondPress: Pick<PlayerInput, 'attack' | 'jump' | 'dash' | 'awaken'> = {};
  get id() { return this.game ? PLAYER_ID : ''; }
  get view(): SurvivalView | undefined { return this.game?.view(); }

  async connect(fighter: FighterId, _mode: RoomMode, name: string, options: { seed?: number; wave?: number; partner?: { fighter: FighterId; name: string } } = {}) {
    requireReleasedFighter(fighter);
    if (options.partner) requireReleasedFighter(options.partner.fighter);
    this.partner = options.partner; this.secondPress = {};
    const generation=this.generation+1;
    await this.leave();
    if(generation!==this.generation)return;
    this.fighter = fighter; this.name = name;
    // `?round=N` starts a run further in, for checking a rank or a stage.
    const params = new URLSearchParams(typeof location === 'object' ? location.search : '');
    const asked = Number(params.get('round') ?? params.get('wave'));
    const round = options.wave ?? (Number.isInteger(asked) && asked > 0 ? asked : 1);
    const query = new URLSearchParams(typeof location === 'object' ? location.search : '');
    // `?picks=a,b,c`: a build to start from, for checking a wave as a run would reach it.
    const picks = query.get('picks')?.split(',').filter(Boolean);
    // `?spawn=caldera`: the first round's boss, for looking at it.
    const spawn = query.get('spawn')?.split(',').filter(Boolean);
    // `?relics=oro,caldera`: boss relics to start with (relics.ts), for looking at them.
    const relics = query.get('relics')?.split(',').filter(Boolean);
    // `?path=ward`: the first round reached by that door (paths.ts), for looking at it.
    const path = (query.get('path') ?? undefined) as PathKind | undefined;
    // `?bosshp=0.3`, `?god` and `?quiet` (no horde): probes.
    const bossHp = Number(query.get('bosshp')) || undefined, god = query.has('god'), quiet = query.has('quiet');
    // The run's seed draws its dungeons' order (`?seed=N` to replay one); its
    // first dungeon's world is built now. Probes keep the old road of places.
    const seed = options.seed ?? (Number(query.get('seed')) || ((Math.random() * 0x7fffffff | 0) || 1));
    const stage = quiet || spawn?.length ? locationFor(round).location.stage : dungeonFor(seed, round).location.stage;
    const collision=await this.destination(stage,round,spawn??[]);
    if(generation!==this.generation){collision?.dispose?.();return;}
    // `?autopilot` plays itself, skill points included.
    const autoLearn = query.has('autopilot');
    const allies = (query.get('allies')?.split(',').filter(Boolean) ?? []).slice(0, 3) as FighterId[];
    // What the player's progress brings in: the nodes bought with shards, their mastery's skill points.
    const { unlocked, bonus } = carried(fighter);
    const partner = options.partner ? [{ id: SECOND, fighter: options.partner.fighter, name: options.partner.name }] : [];
    const heroes = allies.length || partner.length ? [{ id: PLAYER_ID, fighter, name, unlocked, bonus }, ...partner, ...allies.map((ally, i) => ({ id: `ally-${i + 1}`, fighter: ally, name: `Ally ${i + 1}` }))] : undefined;
    this.game = new SurvivalGame({ fighter, name, seed, collision, round, picks, spawn, bossHp, god, quiet, autoLearn, unlocked, bonus, relics, path, lockCombat: lockCombatOn(), ...(heroes ? { heroes } : {}) });
    this.allies = allies.map((_, i) => ({ id: `ally-${i + 1}`, pilot: new Autopilot(.8, `ally-${i + 1}`) }));
    this.allyDown = query.has('allydown');
    // `?fall=N`: the fighter falls N seconds into the run, for looking at its results.
    this.fallAt = Number(query.get('fall')) || 0;
    // `?kinds=tribunal-guard-shield,tribunal-guard-sniper`: a pair of each ahead of the fighter every 15 s, for looking at them.
    this.kinds = query.get('kinds')?.split(',').filter(Boolean) ?? []; this.kindsAt = 0;
    // `?points=N`: skill points to spend from the start, for looking at the tree.
    const points = Number(query.get('points'));
    if (points > 0) for (const hero of this.game.heroes.values()) hero.points = Math.floor(points);
    watchCrowd(this.game.horde);
    this.room = { send: () => {} };
    this.predictionReady = true;
    this.publish();
  }

  /** One command, one tick - or none while paused, choosing a card or
   *  travelling, and a fraction of one in slow motion. */
  send(input: PlayerInput) {
    const game = this.game;
    if (!game) return false;
    if (game.phase === 'travel' && !this.travelling) void this.travel();
    if (this.paused || game.frozen) { this.clearPresses(); this.publish(); return true; }
    this.pressedAttack = input.attack ?? this.pressedAttack;
    this.pressedJump ||= !!input.jump; this.pressedDash ||= !!input.dash; this.pressedAwaken ||= !!input.awaken;
    this.owed += game.timeScale;
    this.rewards.input(input);
    // The second seat's presses ride to the next whole tick, as the first's do.
    const other = this.partner ? this.second() : undefined;
    if (other) this.rewards.partnerInput(other);
    if (other) { const p = this.secondPress; p.attack = other.attack ?? p.attack; p.jump ||= !!other.jump; p.dash ||= !!other.dash; p.awaken ||= !!other.awaken; }
    let stepped = false;
    while (this.owed >= 1) {
      this.owed--;
      if (this.pressedAttack || this.pressedJump || this.pressedDash || this.pressedAwaken) {
        input = { ...input, attack: this.pressedAttack, jump: this.pressedJump, dash: this.pressedDash, awaken: this.pressedAwaken };
        this.clearPresses();
      }
      if (other) {
        const p = this.secondPress;
        game.submit(SECOND, { ...other, attack: p.attack, jump: p.jump, dash: p.dash, awaken: p.awaken });
        this.secondPress = {};
      }
      if (this.allies.length) {
        const players = game.sim.playerStates();
        for (const ally of this.allies) game.submit(ally.id, ally.pilot.command(players, game.sim.serverTime, game.horde));
        if (this.allyDown && game.sim.serverTime > 12) { this.allyDown = false; game.sim.damage(this.allies[0].id, 1e6, this.allies[0].id, 'Probe'); }
      }
      if (this.kinds.length && game.phase === 'fight' && game.sim.serverTime >= this.kindsAt && game.probeSpawn(this.kinds)) this.kindsAt = game.sim.serverTime + 15;
      if (this.fallAt && game.sim.serverTime > this.fallAt) {
        this.fallAt = 0;
        for (const hero of game.heroes.values()) { hero.stats.revives = 0; game.sim.damage(hero.id, 1e6, hero.id, 'Probe'); }
      }
      // (A fault in the run's own rules is caught and reported rather than
      // taking the whole game down with it - see ui/survival/glitch.)
      try { game.tick(input); } catch (error) { glitch(error, 'game'); }
      stepped = true;
      // Couch co-op: the second hero's cards are taken for them (the best of the hand), so the draft never waits on a
      // person who has no card table of their own on the screen.
      if (this.partner && game.phase === 'draft') game.autoChooseFor(SECOND);
      this.hordeFrames.next().capture(game.horde, game.sim.serverTime);
      input = { ...input, attack: undefined, jump: false, dash: false, awaken: false, seq: input.seq };
    }
    if (stepped || !this.snapshot) this.publish();
    return true;
  }

  private async travel() {
    const game = this.game;
    if (!game?.travelTo) return;
    this.travelling = true;
    try {
      const collision=await this.destination(game.travelTo,game.wave+1,[]);
      if (this.game === game) game.arrive(collision);else collision?.dispose?.();
    }
    catch (error) { console.warn('Survival: the next stage failed to load', error); if(this.game===game)game.arrive(); }
    finally { if(this.game===game)this.travelling = false; }
  }

  private async destination(stage:StageId,round:number,extra:readonly string[]){
    const [world,assets]=await Promise.allSettled([rapier().then(create=>create(stage)),Promise.resolve().then(()=>this.prepare?.(round,extra,stage))]);
    if(world.status==='rejected')throw world.reason;
    if(assets.status==='rejected'){world.value?.dispose?.();throw assets.reason;}
    return world.value;
  }

  private publish() {
    const game = this.game;
    if (!game) return;
    const snapshot = game.snapshot();
    this.snapshot = snapshot; this.receivedAt = performance.now();
    this.rewards.observe(game.phase, () => game.view(PLAYER_ID).result, !!this.partner);
    this.onSnapshot(snapshot);
  }

  /** Take a card (or none) in a draft. */
  choose(id?: string) { this.game?.choose(id); if (this.game?.frozen) this.clearPresses(); }
  /** A fresh hand of cards, if a reroll is left. */
  reroll() { this.game?.reroll(); this.publish(); }
  /** Start the same run over: same fighter, fresh seed. */
  async retry() { await this.connect(this.fighter, 'match', this.name, this.partner ? { partner: this.partner } : {}); }
  startPrivateMatch() {}
  async leave() {
    this.generation++;
    this.game?.dispose(); this.game = null; this.room = null; watchCrowd(undefined);
    this.snapshot = null; this.receivedAt = 0; this.predictionReady = false; this.owed = 0; this.paused = false; this.travelling = false;
    this.clearPresses();
    this.hordeFrames.clear(); this.rewards.reset();
  }
}
