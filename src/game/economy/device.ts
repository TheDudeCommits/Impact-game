import type { GameSnapshot, PlayerInput } from '../types';
import type { RunResult } from '../../survival/SurvivalGame';
import { RANKS } from '../../survival/bosses';
import { objectiveOf } from '../objectives/model';
import { riftOf } from '../moba/model';
import type { MatchReport, Report, SurvivalReport } from './earn';
import { riftContributed, riftReport } from './riftReport';

/** Every on-device report's id starts so: the server sends it down the on-device path, and never confuses it with a
 *  room's (a UUID). */
export const DEVICE_PREFIX = 'local-';
export const isDeviceId = (id: unknown): id is string => typeof id === 'string' && id.startsWith(DEVICE_PREFIX);
/** The modes a device plays: the royale and the duel against bots, Last Stand and Bad Blood with bots (or alone), a solo
 *  run, and Rift War with bots (2 November 2026) - each also on the couch. */
export const DEVICE_MODES: readonly Report['mode'][] = ['bots', 'duel', 'last-stand', 'bad-blood', 'survival', 'rift-war'];

/** A fresh id for a result: the prefix and 32 random hex digits (within the 48 earn.ts allows). */
export function deviceId(): string {
  const bytes = new Uint8Array(16);
  try { globalThis.crypto.getRandomValues(bytes); } catch { for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256); }
  return DEVICE_PREFIX + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Where a decided match's report goes, and who hears a match begin: the shop (src/ui/shop/boot.ts) shows what it
 *  paid and sends it to the account's server; at a match's start it opens the account if this browser has none, so
 *  the server's wall clock (deviceReports.ts) covers the first match too. Nothing until the shop is mounted. */
export const deviceReports: { begin(): void; send(report: Report): void } = { begin: () => {}, send: () => {} };

/** A command that plays: movement, or any button (RoomRewards.input's test). */
const played = (input: PlayerInput) => Math.hypot(input.moveX, input.moveZ) > .1 || !!input.attack || !!input.guard || !!input.dash || !!input.jump;
/** Whether a seat did something in the match besides moving: damage dealt, or an objective's or a war's contribution. */
function contributed(snapshot: GameSnapshot, id: string) {
  const p = snapshot.players.find(q => q.id === id), seat = objectiveOf(snapshot)?.seats.find(s => s.id === id);
  return (p?.damageDealt ?? 0) > 0 || (seat?.revives ?? 0) > 0 || (seat?.repairs ?? 0) > 0 || (seat?.assists ?? 0) > 0 || (seat?.rescues ?? 0) > 0 || (seat?.supplies ?? 0) > 0
    || riftContributed(riftOf(snapshot)?.seats.find(s => s.id === id));
}

export class DeviceMatch {
  private started: number | undefined;
  private fieldSize = 0;
  private places = new Map<string, number>();
  private active = false;
  private partnerActive = false;
  private done = false;
  private set = 1;
  constructor(private readonly send: (report: MatchReport) => void = report => deviceReports.send(report)) {}
  /** A new match, or the next set of one (a duel's runback): nothing of the last carries over. */
  reset(set = 1) { this.set = set; this.started = undefined; this.fieldSize = 0; this.places.clear(); this.active = false; this.partnerActive = false; this.done = false; }
  /** A command the page sent while the match ran. */
  input(input: PlayerInput) { if (this.started !== undefined && played(input)) this.active = true; }
  /** The couch: a command Player 2 sent while the match ran. */
  partnerInput(input: PlayerInput) { if (this.started !== undefined && played(input)) this.partnerActive = true; }
  /** Every snapshot published: the report (sent, and returned) once the human's result is decided - the match over,
   *  or in the royale the human knocked out, their place theirs whatever the bots do after. A match not played
   *  reports nothing; one too short is reported here, and the page's own check of the rules says so without sending.
   *  `partner`: on the couch, Player 2's id. */
  observe(snapshot: GameSnapshot, self: string, partner?: string): MatchReport | undefined {
    const objective = objectiveOf(snapshot), rift = riftOf(snapshot), set = snapshot.duel?.set ?? objective?.round ?? rift?.round ?? 1;
    if (set !== this.set) this.reset(set);
    if (snapshot.status === 'active' && this.started === undefined) { this.started = snapshot.serverTime; this.fieldSize = objective?.seats.length ?? rift?.seats.length ?? snapshot.players.length; deviceReports.begin(); }
    // (A royale's places come from its knockouts; the Rift's fighters fall and come back.)
    const royale = !objective && !snapshot.duel && !rift;
    if (royale && this.started !== undefined) for (const e of snapshot.events) {
      if (e.kind === 'eliminated' && e.targetId && !this.places.has(e.targetId)) this.places.set(e.targetId, Math.max(2, this.fieldSize - this.places.size));
    }
    if (this.done || this.started === undefined) return undefined;
    const over = snapshot.status === 'finished' && (objective ? objective.phase === 'over' : rift ? rift.phase === 'over' : snapshot.roomMode === 'match' && (!snapshot.duel || snapshot.duel.phase === 'complete'));
    if (!over && !(this.places.has(self) && royale)) return undefined;
    this.done = true;
    const p = snapshot.players.find(q => q.id === self), seat = objective?.seats.find(s => s.id === self);
    if (!p || !this.active && !contributed(snapshot, self)) return undefined;
    const couch = partner !== undefined && snapshot.players.some(q => q.id === partner) && (this.partnerActive || contributed(snapshot, partner));
    const seconds = Math.floor(Math.max(0, snapshot.serverTime - this.started));
    if (rift) {
      const report = riftReport(snapshot, self, deviceId(), seconds, { practice: true, couch });
      if (report) this.send(report);
      return report;
    }
    const won = objective ? objective.winner === seat?.team : snapshot.winnerId === self;
    const report: MatchReport = { id: deviceId(), fighter: p.fighter, seconds,
      mode: objective?.kind ?? (snapshot.duel ? 'duel' : 'bots'), practice: true,
      place: won ? 1 : objective || snapshot.duel ? 2 : this.places.get(self) ?? Math.max(2, this.fieldSize - this.places.size),
      players: this.fieldSize, kos: p.kills ?? 0,
      rounds: objective?.village ? Math.max(0, objective.village.wave - (objective.village.phase === 'assault' ? 1 : 0)) : snapshot.duel?.scores[self] ?? 0,
      revives: seat?.revives ?? 0, repairs: seat?.repairs ?? 0, bossDamage: seat?.bossDamage ?? 0,
      assists: seat?.assists ?? 0, rescues: seat?.rescues ?? 0, supplies: seat?.supplies ?? 0, ...(couch ? { friends: true, couch: true } : {}) };
    this.send(report);
    return report;
  }
}

/** The query flags that make a run something other than the player's own play - it plays itself, starts with help, a
 *  boss on demand, no horde... (src/survival/LocalArena.ts; the probes among them already mark the run `probe`). */
const TEST_FLAGS = ['autopilot', 'allies', 'allydown', 'picks', 'points', 'kinds', 'spawn', 'quiet', 'fall', 'round', 'wave', 'god', 'bosshp', 'relics', 'path'];
const testRun = () => typeof location === 'object' && TEST_FLAGS.some(flag => new URLSearchParams(location.search).has(flag));

/** A solo run's result as its report: RoomRewards.survival's fields, alone (no co-op, no revives). A probe's run reports nothing. */
export function deviceRunReport(result: RunResult): SurvivalReport | undefined {
  if (result.probe) return undefined;
  const log = result.bossLog ?? [];
  return { id: deviceId(), mode: 'survival', coop: false, fighter: result.fighter, seconds: Math.floor(result.seconds), round: result.round,
    rank: Math.max(0, RANKS.indexOf(result.rank)), bosses: result.bosses, finishers: result.finishers ?? 0, sealed: !!result.sealed,
    score: Math.round(result.score), kills: result.ownKills ?? result.kills, style: result.bestRank, sBosses: log.filter(b => b.rank === 'S').length,
    fastBoss: log.length ? Math.min(...log.map(b => b.seconds)) : undefined };
}

/** One solo Arcade run on this device (LocalArena), for its report when it ends - or a couch run's, Player 1's result for
 *  the device's account, reported as played with a friend when Player 2 played too. */
export class DeviceRun {
  private started = false;
  private active = false;
  private partnerActive = false;
  private done = false;
  constructor(private readonly send: (report: SurvivalReport) => void = report => deviceReports.send(report)) {}
  reset() { this.started = false; this.active = false; this.partnerActive = false; this.done = false; }
  input(input: PlayerInput) { if (this.started && played(input)) this.active = true; }
  /** The couch: a command Player 2 sent while the run went on. */
  partnerInput(input: PlayerInput) { if (this.started && played(input)) this.partnerActive = true; }
  /** Each tick's phase, and the run's result once it is over: the report (sent, and returned), once, for a run played.
   *  `couch`: the run has a Player 2. */
  observe(phase: string, result: () => RunResult | undefined, couch = false): SurvivalReport | undefined {
    if (!this.started && phase !== 'lobby' && phase !== 'over') { this.started = true; deviceReports.begin(); }
    if (this.done || !this.started || phase !== 'over') return undefined;
    const run = result();
    if (!run) return undefined;
    this.done = true;
    const own = this.active && !testRun() ? deviceRunReport(run) : undefined;
    const report = own && couch && this.partnerActive ? { ...own, friends: true, couch: true } : own;
    if (report) this.send(report);
    return report;
  }
}
