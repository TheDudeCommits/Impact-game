import { FIGHTERS } from '../../config';
import { pulseClass } from '../pulse';
import type { CombatEvent, GameSnapshot, PlayerState } from '../../game/types';
import { rankPlayers } from '../hudMath';
import { callName, el, setText, show } from './mainHudKit';


/** The order fighters stopped being alive in, recorded the way Hud records it for the results card (each HUD tick,
 *  from the snapshot), so the spectator bar's "#4 OF 6" is the number the results card will show. */
export class FallOrder {
  readonly fallen: string[] = [];
  update(snapshot: GameSnapshot) {
    if (snapshot.status === 'waiting') { this.fallen.length = 0; return; }
    for (const p of snapshot.players) if (!p.alive && !this.fallen.includes(p.id)) this.fallen.push(p.id);
  }
  /** `self`'s place (1 is the winner) and the field's size, as the results card ranks them. */
  place(snapshot: GameSnapshot, selfId: string) {
    const ranked = rankPlayers(snapshot.players, snapshot.winnerId, this.fallen);
    return { place: ranked.findIndex(p => p.id === selfId) + 1, of: ranked.length };
  }
  reset() { this.fallen.length = 0; }
}

export const fighterName = (id: string) => FIGHTERS[id as keyof typeof FIGHTERS]?.name ?? id;

/** One line of the kill feed: "SHIDEN ✕ GUMMY", or "GUMMY IS OUT" when nobody earned it (the water, a fall). `mine`:
 *  the player dealt it or took it, and it is drawn in red. */
export interface FeedLine { killer: string; victim: string; mine: boolean }
export function feedLine(event: CombatEvent, players: readonly PlayerState[], selfId: string): FeedLine | undefined {
  if (event.kind !== 'eliminated' || !event.targetId) return undefined;
  const victim = players.find(p => p.id === event.targetId);
  if (!victim) return undefined;
  const killer = event.actorId !== event.targetId ? players.find(p => p.id === event.actorId) : undefined;
  return {
    killer: killer ? callName(killer, selfId, fighterName) : '',
    victim: callName(victim, selfId, fighterName),
    mine: event.actorId === selfId || event.targetId === selfId,
  };
}

/** FINAL 3 and FINAL 2, each called once a match, as the field comes down to it - and only from a field big enough
 *  for the call to mean something (FINAL 3 from four or more, FINAL 2 from three or more). */
export function finalCall(left: number, started: number, called: number): 2 | 3 | undefined {
  if (left === 3 && started >= 4 && called > 3) return 3;
  if (left === 2 && started >= 3 && called > 2) return 2;
  return undefined;
}

/** How long a kill feed line stays up, seconds. */
export const FEED_SECONDS = 5;
/** The kill feed (zone 3b): up to three lines, newest on top, each up for FEED_SECONDS. Three nodes, built once. */
export class KillFeed {
  private readonly lines: { node: HTMLElement; killer: HTMLElement; victim: HTMLElement; at: number; shown: boolean }[] = [];
  constructor(zone: HTMLElement) {
    const list = el('ol', 'royale-feed');
    list.setAttribute('aria-label', 'Knockouts');
    for (let i = 0; i < 3; i++) {
      const node = el('li'), killer = el('b'), mark = el('i', '', '✕'), victim = el('b');
      mark.setAttribute('aria-hidden', 'true');
      node.append(killer, mark, victim); node.hidden = true; list.append(node);
      this.lines.push({ node, killer, victim, at: 0, shown: false });
    }
    zone.append(list);
  }
  /** A new line at the top; the others move down one and the oldest goes. */
  push(line: FeedLine, now: number) {
    for (let i = this.lines.length - 1; i > 0; i--) this.copy(this.lines[i - 1], this.lines[i]);
    const top = this.lines[0];
    setText(top.killer, line.killer); setText(top.victim, line.victim);
    top.node.classList.toggle('mine', line.mine); top.node.classList.toggle('alone', !line.killer);
    top.at = now; top.shown = true; show(top.node, true);
    // Replays its entrance: the class goes off and on again (a reflow between), as the HUD's combo counter does.
    pulseClass(top.node, 'fresh');
  }
  update(now: number) {
    for (const line of this.lines) if (line.shown && now - line.at > FEED_SECONDS * 1000) { line.shown = false; show(line.node, false); }
  }
  clear() { for (const line of this.lines) { line.shown = false; show(line.node, false); } }
  private copy(from: KillFeed['lines'][number], to: KillFeed['lines'][number]) {
    setText(to.killer, from.killer.textContent ?? ''); setText(to.victim, from.victim.textContent ?? '');
    to.node.classList.toggle('mine', from.node.classList.contains('mine')); to.node.classList.toggle('alone', from.node.classList.contains('alone'));
    to.node.classList.remove('fresh');
    to.at = from.at; to.shown = from.shown; show(to.node, from.shown);
  }
}
