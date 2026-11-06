import type { FighterId } from '../../game/types';

export type SwapSide = 'self' | 'opponent';
export const SWAP_SIDES: readonly SwapSide[] = ['self', 'opponent'];
/** The room's command for each side (TrainingLab.command). */
export const SWAP_LAB = { self: 'swap-self', opponent: 'swap-opponent' } as const;
/** What the controls send (Hud's `training-lab` event, as every training tool's command): the room's own command, and
 *  whether the fighter was dealt by RANDOM - which is then what is remembered, not the fighter (the mode sheet's rule). */
export interface SwapRequest { lab: typeof SWAP_LAB[SwapSide]; value: FighterId; random?: boolean }
/** The side a training command switches, if it is one: the two above, and the LABORATORY's own OPPONENT pick. */
export function swapSideOf(command: unknown): SwapSide | undefined {
  const lab = command && typeof command === 'object' ? (command as { lab?: unknown }).lab : undefined;
  return lab === 'swap-self' ? 'self' : lab === 'swap-opponent' || lab === 'opponent' ? 'opponent' : undefined;
}

/** Who a side may become, in the roster's own order: the player anyone Training takes (every fighter the home page
 *  offers: Account's locks do not hold in the Training Ground), the dummy anyone but a fighter held back (as the
 *  mode sheet's and the LABORATORY's OPPONENT lists). */
export function swapRoster(side: SwapSide, roster: readonly FighterId[], held: ReadonlySet<FighterId>): FighterId[] {
  return side === 'self' ? [...roster] : roster.filter(id => !held.has(id));
}
/** PREVIOUS (-1) or NEXT (1) in the roster's order, round its ends. From a fighter the roster does not list (one held
 *  back, trained from the home page), NEXT is its first and PREVIOUS its last. */
export function stepFighter(roster: readonly FighterId[], current: FighterId | undefined, direction: 1 | -1): FighterId | undefined {
  if (!roster.length) return undefined;
  const at = current === undefined ? -1 : roster.indexOf(current);
  if (at < 0) return direction > 0 ? roster[0] : roster[roster.length - 1];
  return roster[(at + direction + roster.length) % roster.length];
}
/** RANDOM: anyone of the roster but `avoid` (the fighter the side already is, and the one across the room: never a
 *  mirror by chance, as the room's own first draw). With nobody else to deal, anyone but the first of `avoid`. */
export function randomFighter(roster: readonly FighterId[], avoid: readonly (FighterId | undefined)[], random: () => number = Math.random): FighterId | undefined {
  const deal = (pool: readonly FighterId[]) => pool.length ? pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] : undefined;
  return deal(roster.filter(id => !avoid.includes(id))) ?? deal(roster.filter(id => id !== avoid[0]));
}

/** What a choice leaves in Training's prefs (modes/prefs.ts: `rift-mode-prefs`, training.rival), as the mode sheet's
 *  own OPPONENT list does: the dummy's fighter - or, when RANDOM dealt it, none, so the next Training deals again. The
 *  player's own fighter is not kept there: it is the home's selection (Hud.select), as it is on the home page. */
export function swapMemory(side: SwapSide, fighter: FighterId, random: boolean): { rival: FighterId | undefined } | undefined {
  return side === 'opponent' ? { rival: random ? undefined : fighter } : undefined;
}

/** One thing asked of the room: a side's next fighter, from the moment it was chosen. */
export interface SwapAsk {
  side: SwapSide; fighter: FighterId; token: number;
  /** performance.now() when it was chosen, when its body was ready and the room was asked, ms. */
  askedAt: number; sentAt?: number;
}
/** How long the room has to show a fighter it was asked for, ms. A training room on a match server from before this
 *  command does not know it and never answers: the note in the bar must not stand for ever. */
export const SWAP_LAPSE_MS = 4000;

/**
 * The page's ledger of switches (main.ts). A side has at most one fighter on the way: a newer choice overtakes one still
 * loading, whose load then finishes for nothing (`current` says so before the room is asked). The room's answer is read
 * off its snapshots (`observe`), never assumed, so the same code serves Training on this device and a training room on
 * the match server: which sides show another fighter than last time (the HUD, the home's selection and the Forge follow
 * those), which asks the room has answered, and which it never did.
 */
export class SwapLedger {
  private tokens = 0;
  private readonly asks: Partial<Record<SwapSide, SwapAsk>> = {};
  private seen: Partial<Record<SwapSide, FighterId>> = {};
  /** A new choice for `side`: whatever was on its way for that side is overtaken. */
  ask(side: SwapSide, fighter: FighterId, now: number): SwapAsk {
    const ask: SwapAsk = { side, fighter, token: ++this.tokens, askedAt: now };
    this.asks[side] = ask;
    return ask;
  }
  /** Whether `ask` is still the one its side waits for. */
  current(ask: SwapAsk) { return this.asks[ask.side]?.token === ask.token; }
  /** The fighter a side is waiting for, if any. */
  pending(side: SwapSide): FighterId | undefined { return this.asks[side]?.fighter; }
  /** Every fighter on the way, either side: a load must not let go of what another is bringing in. */
  waiting(): FighterId[] { return SWAP_SIDES.flatMap(side => this.asks[side] ? [this.asks[side]!.fighter] : []); }
  /** The fighter a side was last seen as (the room's snapshots). */
  shown(side: SwapSide): FighterId | undefined { return this.seen[side]; }
  /** Its body is ready and the room has been asked. */
  sent(ask: SwapAsk, now: number) { if (this.current(ask)) ask.sentAt = now; }
  /** Given up (its body would not load), or no longer wanted. */
  drop(side: SwapSide, ask?: SwapAsk) { if (!ask || this.current(ask)) delete this.asks[side]; }
  /** The room's pair, as a snapshot has it. */
  observe(pair: Partial<Record<SwapSide, FighterId>>, now: number): { changed: SwapSide[]; settled: SwapAsk[]; lapsed: SwapAsk[] } {
    const changed: SwapSide[] = [], settled: SwapAsk[] = [], lapsed: SwapAsk[] = [];
    for (const side of SWAP_SIDES) {
      const fighter = pair[side], before = this.seen[side], ask = this.asks[side];
      if (fighter && before && fighter !== before) changed.push(side);
      if (fighter) this.seen[side] = fighter;
      if (!ask || ask.sentAt === undefined) continue;
      if (fighter === ask.fighter) { settled.push(ask); delete this.asks[side]; }
      else if (now - ask.sentAt > SWAP_LAPSE_MS) { lapsed.push(ask); delete this.asks[side]; }
    }
    return { changed, settled, lapsed };
  }
  /** Out of Training: nothing asked, nobody seen. */
  reset() { for (const side of SWAP_SIDES) delete this.asks[side]; this.seen = {}; }
}
