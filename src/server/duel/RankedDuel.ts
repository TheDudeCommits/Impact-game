import type { GameSnapshot } from '../../game/types';
import type { DuelView } from '../../game/duel/DuelSet';
import { RANKED_DUEL, freshRankedView, rateDuel, type DuelRanked, type RankedDuelView } from '../../game/duel/ranked';
import { sharedEconomy } from '../economy/api';
import type { RoomEconomy } from '../cluster/economyLink';
import { ranked, type Ranked } from '../ball/ranked';

/**
 * A ranked Duel room's side of the rating (the rules: game/duel/ranked.ts), as RivalryWatch is a Duel room's side of the
 * rivalries: the account each seat plays as and its standing (read once, for every page: GameSnapshot.ranked), the two
 * people as the set begins, and the set rated once as it is decided.
 *
 * - The opponent is found (both people seated and their standings known, the room's count to the first round on): the
 *   two are paired, and the set is rated against those standings.
 * - It is decided (DuelSet `complete`): each person not yet rated is, the winner up and the loser down, as Elo's change
 *   (rateDuel), and the change is on their seat for every page.
 * - A person leaving once paired, before the set is decided (onLeave: a leave, or PlayerTwo letting a dropped seat go
 *   after 20 s), is rated as beaten at once - the VS page's stamps are no dodge. Once the set has begun it then ends with
 *   the other the winner (DuelSet.forfeit), and they are rated so; before its first round, the other is not rated and
 *   waits on for a new opponent, a new pairing (its own key: `<match id>:<n>`).
 * - Each change goes to the ratings (on PlayerTwo a signed note, ranked stub) for that account, carried by BOTH pages: a
 *   leaver's page is gone, and neither page can keep a result from the world by not posting it. The world takes each
 *   once, by the set's id and the account.
 * - PlayerTwo's own skill rating for the queue, which its matching by skill reads, is told the set's places (winner
 *   first) once (`report`: room.result on PlayerTwo, nothing on the match server).
 */
export class RankedDuel {
  readonly view: RankedDuelView;
  private readonly accounts = new Map<string, string>();
  private readonly names = new Map<string, string>();
  /** The two people paired (the opponent found), with their standings then. */
  private started?: [DuelRanked, DuelRanked];
  private readonly rated = new Set<string>();
  private key = '';
  /** Pairings made in this room: a pairing a leaver broke before the first round leaves the room to pair again. */
  private pairs = 0;
  private decided = false;
  constructor(
    private readonly service: () => Ranked | undefined = ranked,
    private readonly economy: () => RoomEconomy | undefined = sharedEconomy,
    private readonly report: (places: string[]) => void = () => {},
    now = Date.now(),
  ) { this.view = freshRankedView(now); }

  /** Whether the account a join's token opens may play ranked: a signed-in one (its pass says so on PlayerTwo). */
  eligible(token: unknown): boolean {
    const pk = this.economy()?.book.find(token)?.pk, service = this.service();
    return !!pk && !!service?.eligible?.(pk);
  }
  /** A seat's account (its join's token, or the page's `account` message) and the name the room shows them by; their
   *  standing is read for every page. */
  bind(id: string, token: unknown, name?: string) {
    if (name) this.names.set(id, name);
    const pk = this.economy()?.book.find(token)?.pk, service = this.service();
    if (!pk || !service || this.accounts.get(id) === pk || this.started) return;
    this.accounts.set(id, pk);
    void service.rating(pk, RANKED_DUEL.mode).then(r => {
      if (this.accounts.get(id) === pk && !this.started) this.view.seats[id] = { rating: r.rating, games: r.games };
    }, () => {});
  }
  /** After each snapshot: the pairing (the opponent found: the count to the first round on, or the set begun) and the
   *  set's end, each acted on once. `key`: the set's match id (RoomRewards'). */
  observe(snapshot: GameSnapshot, key: string) {
    const d = snapshot.duel;
    if (!d) return;
    const found = d.startedAt != null ? d.phase !== 'complete' : snapshot.status === 'waiting' && snapshot.lobby?.startsAt != null;
    if (!this.started && !this.decided && found) {
      const people = snapshot.players.filter(p => !p.isBot && this.accounts.has(p.id) && this.view.seats[p.id]);
      if (people.length === 2 && snapshot.players.length === 2 && this.accounts.get(people[0].id) !== this.accounts.get(people[1].id)) {
        this.started = people.map(p => ({ id: p.id, pk: this.accounts.get(p.id)!, rating: this.view.seats[p.id].rating, games: this.view.seats[p.id].games })) as [DuelRanked, DuelRanked];
        this.key = `${key}:${++this.pairs}`; this.view.rated = true;
      }
    }
    if (this.started && d.phase === 'complete' && !this.decided) this.decide(d.winner);
  }
  /** A person gone from the room (`duel`: the set as it stands). Paired and the set not decided: a loss at once. Not
   *  paired: they were never in it. Paired but the set not begun: the other waits on, unrated, to be paired again. */
  leave(id: string, duel?: Pick<DuelView, 'phase' | 'startedAt'>) {
    const forget = () => { this.accounts.delete(id); this.names.delete(id); delete this.view.seats[id]; };
    if (!this.started) { forget(); return; }
    const seat = this.started.find(s => s.id === id), other = this.started.find(s => s.id !== id);
    if (!seat || !other || this.decided || this.rated.has(id) || duel?.phase === 'complete') return;
    const delta = rateDuel(this.started[0], this.started[1], other.id).get(id);
    if (delta !== undefined) this.apply(seat, delta, false);
    if (duel?.startedAt == null) { this.started = undefined; this.rated.clear(); this.view.rated = false; forget(); }
  }
  /** The set decided: everyone not rated yet, and PlayerTwo's skill told its places. */
  private decide(winner: string | null) {
    this.decided = true;
    const [a, b] = this.started!, deltas = rateDuel(a, b, winner);
    if (!deltas.size) return;
    for (const s of [a, b]) if (!this.rated.has(s.id)) this.apply(s, deltas.get(s.id)!, s.id === winner);
    try { this.report([winner!, winner === a.id ? b.id : a.id]); } catch { /* PlayerTwo's skill is a nicety: the rating stands. */ }
  }
  private apply(s: DuelRanked, delta: number, won: boolean) {
    this.rated.add(s.id);
    this.view.seats[s.id] = { rating: s.rating + delta, games: s.games + 1, delta };
    const carriers = this.started!.filter(o => o.pk !== s.pk).map(o => o.pk);
    void this.service()?.apply(s.pk, RANKED_DUEL.mode, delta, won, this.key, { carriers, name: this.names.get(s.id) });
  }
  /** What every page is told (GameSnapshot.ranked): a copy, the room's own view keeps changing. */
  snapshot(): RankedDuelView { return { ...this.view, seats: Object.fromEntries(Object.entries(this.view.seats).map(([id, s]) => [id, { ...s }])) }; }
}
