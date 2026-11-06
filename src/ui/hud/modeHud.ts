import type { CombatEvent, GameSnapshot, PlayerState } from '../../game/types';
import type { RunView } from '../../survival/SurvivalGame';
import type { ObjectiveView } from '../../game/objectives/model';
import type { PadFamily } from '../../input/gamepad';
import type { ModeId } from '../modes/catalogue';

export type HudLayoutId = ModeId;
/** '9': the bottom of the screen's middle, under the fight and over the cards' line - where a boss's bar stands
 *  (11 October 2026: over the fight, the objective modes' bars hid it). */
export const HUD_ZONES = ['1b', '2', '2b', '3', '3b', '5', '6', '6a', '7', '8', '8b', '9'] as const;
export type HudZone = typeof HUD_ZONES[number];
/** waiting: lobby, queue or countdown; active: the fight; over: results are up (or the run has ended). */
export type HudPhase = 'waiting' | 'active' | 'over';

/** What a module is given every HUD tick (about 14 times a second, from Hud.update). */
export interface ModeHudFrame {
  snapshot: GameSnapshot;
  /** The local player. */
  self: PlayerState;
  /** The locked or faced target; while `self` is down in a battle royale, the fighter being spectated. */
  target?: PlayerState;
  phase: HudPhase;
  /** Last Stand and Bad Blood. */
  objective?: ObjectiveView;
  /** Arcade Survival, solo and co-op. */
  run?: RunView;
  /** The device in use (#interface[data-input]) and the pad's family, for prompts (src/ui/prompts.ts). */
  input: 'keyboard' | 'controller' | 'touch';
  family: PadFamily;
  /** performance.now() at this tick, ms. */
  now: number;
}
/** Where a module draws. `zone()` returns that zone's container; a module appends its own nodes and removes them on
 *  unmount (the host empties every zone after unmount too). */
export interface ModeHudMount {
  /** #interface */
  root: HTMLElement;
  /** .combat-hud: the approved plates and cards, for a module that reads their boxes. */
  combat: HTMLElement;
  zone(id: HudZone): HTMLElement;
}
export interface ModeHud {
  /** Once, when the match's layout becomes this one. */
  mount(mount: ModeHudMount): void;
  /** Every HUD tick while mounted. Write the DOM only when a value changes. */
  update(frame: ModeHudFrame): void;
  /** Every combat event, exactly once, in order (kill feeds, move trials, coach triggers). */
  event?(event: CombatEvent, snapshot: GameSnapshot): void;
  /** Leaving the match or switching layout: remove listeners and nodes. */
  unmount(): void;
}
export type ModeHudFactory = () => ModeHud;

/** The match's phase, as the HUD shows it. */
export function hudPhaseOf(snapshot: GameSnapshot, objective?: ObjectiveView, run?: RunView): HudPhase {
  if (run) return run.phase === 'over' ? 'over' : run.phase === 'lobby' ? 'waiting' : 'active';
  if (objective) return objective.phase === 'over' ? 'over' : objective.phase === 'active' ? 'active' : 'waiting';
  return snapshot.status === 'finished' ? 'over' : snapshot.status === 'waiting' ? 'waiting' : 'active';
}

/** Hands each combat event over once: snapshots repeat recent events, and ids restart with a new room. */
export class EventCursor {
  private last = -1;
  private at = -Infinity;
  reset() { this.last = -1; this.at = -Infinity; }
  take(snapshot: GameSnapshot): CombatEvent[] {
    // A new room (or round) starts its clock again: its events count from the start.
    if (snapshot.serverTime < this.at - 1) this.reset();
    this.at = snapshot.serverTime;
    const fresh: CombatEvent[] = [];
    for (const event of snapshot.events) if (event.id > this.last) { fresh.push(event); this.last = event.id; }
    return fresh;
  }
}

/** A module that draws nothing: today's HUD stands. Each mode's file starts as this until its package lands. */
export const quietHud = (): ModeHud => ({ mount() {}, update() {}, unmount() {} });
