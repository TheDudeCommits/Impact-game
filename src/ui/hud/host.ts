import type { CombatEvent, GameSnapshot, PlayerState } from '../../game/types';
import type { RunView } from '../../survival/SurvivalGame';
import { objectiveOf } from '../../game/objectives/model';
import type { PadFamily } from '../../input/gamepad';
import { modeOfSnapshot } from '../modes/catalogue';
import { EventCursor, HUD_ZONES, hudPhaseOf, type HudLayoutId, type HudZone, type ModeHud, type ModeHudFactory, type ModeHudFrame, type ModeHudMount } from './modeHud';
import { MODE_HUDS } from './registry';
import { FALLS } from '../results/placement';
import './zones.css';

/** The zone layer: `.mode-hud` with one container per zone, laid over `.combat-hud`. Injectable for tests. */
export interface ZoneLayer { combat: HTMLElement; zone(id: HudZone): HTMLElement; clear(): void }
export function domZoneLayer(root: HTMLElement): ZoneLayer | undefined {
  const combat = root.querySelector<HTMLElement>('.combat-hud');
  if (!combat) return undefined;
  const layer = document.createElement('div');
  layer.className = 'mode-hud'; layer.setAttribute('aria-live', 'off');
  const zones = new Map<HudZone, HTMLElement>();
  for (const id of HUD_ZONES) { const zone = document.createElement('div'); zone.dataset.zone = id; layer.append(zone); zones.set(id, zone); }
  combat.append(layer);
  return { combat, zone: id => zones.get(id)!, clear: () => { for (const zone of zones.values()) zone.replaceChildren(); } };
}

/** An ultimate's or a transformation's cut-in (CutIn.ts), or the finisher's cinema bars (Letterbox.ts), on screen now. */
export const rolling = () => typeof document === 'object' && !!document.querySelector('.cutin:not([hidden]), .cine-bar[style*="display: block"]');

/**
 * Round 5 (UX): runs the mode's HUD module (modeHud.ts). Hud constructs it, calls `update` at the end of each HUD
 * tick and `clear` on the way home; main.ts feeds it every snapshot (`snapshot`, for the events) and the arcade's run
 * view (`runView`). It picks the layout from the snapshot, mounts and unmounts modules, and keeps
 * #interface[data-hud] and [data-hud-phase] current.
 */
export class ModeHudHost {
  /** main.ts: the arcade's run, solo or co-op (its `runView`). */
  runView: () => RunView | undefined = () => undefined;
  /** WP1's shell: a match's layout was mounted (the training dummy's default, the coach). */
  onLayout?: (layout: HudLayoutId) => void;
  /** main.ts: the match runs on this device (training, a bot duel, a solo run, an operation with bots) and so pauses with the menu. */
  local: () => boolean = () => false;
  /** Whether the fight is frozen right now: the menu's title and note say PAUSED only when this is true. main.ts wires
   *  it (round 5, SOLOPAUSE): a local match held by the menu, or a room that has said it is frozen for its one human
   *  (src/game/pauseLink.ts). Before that wiring, a match on this device counts as paused (`local`). */
  paused: () => boolean = () => this.local();
  /** Round 5 (SOLOPAUSE), main.ts: opening the menu pauses this match (always for a local one; online, only a room
   *  whose one human this page is). False: the match goes on behind the menu. */
  pausable: () => boolean = () => this.local();
  /** The last frame a module was given: the menu's live status reads it. */
  frame?: ModeHudFrame;
  /** WP1's shell (the waiting dock, the coach): every frame and every event, after the module has had them. */
  readonly listeners: { frame(frame: ModeHudFrame, layout: HudLayoutId): void; event?(event: CombatEvent, snapshot: GameSnapshot, layout: HudLayoutId): void; clear?(): void }[] = [];
  private layer?: ZoneLayer;
  private id?: HudLayoutId;
  private module?: ModeHud;
  private readonly cursor = new EventCursor();
  constructor(private readonly root: HTMLElement, private readonly survival: () => boolean,
    private readonly registry: Readonly<Record<HudLayoutId, ModeHudFactory>> = MODE_HUDS,
    private readonly makeLayer: (root: HTMLElement) => ZoneLayer | undefined = domZoneLayer,
    private readonly cinema: () => boolean = rolling) {}
  get layout() { return this.id; }

  update(snapshot: GameSnapshot, self: PlayerState, target: PlayerState | undefined) {
    const id = modeOfSnapshot(snapshot, this.survival());
    if (id === 'royale' || id === 'duel') FALLS.observe(snapshot);
    if (id !== this.id) this.mount(id);
    const objective = objectiveOf(snapshot), run = id === 'arcade' ? this.runView() : undefined;
    const phase = hudPhaseOf(snapshot, objective, run);
    if (this.root.dataset.hudPhase !== phase) this.root.dataset.hudPhase = phase;
    // RoaN's cut-ins and finisher bars own the middle of the screen while they play (zones.css).
    const cinema = this.cinema();
    if (cinema !== ('cinema' in this.root.dataset)) { if (cinema) this.root.dataset.cinema = ''; else delete this.root.dataset.cinema; }
    const input = this.root.dataset.input === 'controller' ? 'controller' : this.root.dataset.input === 'touch' ? 'touch' : 'keyboard';
    const family = (this.root.dataset.pad ?? 'generic') as PadFamily;
    const frame: ModeHudFrame = { snapshot, self, target, phase, objective, run, input, family, now: performance.now() };
    this.frame = frame;
    this.guard(() => this.module?.update(frame));
    for (const listener of this.listeners) this.guard(() => listener.frame(frame, id));
  }
  /** Every snapshot (main.ts onSnapshot): each new combat event goes to the mounted module once. */
  snapshot(snapshot: GameSnapshot) {
    const fresh = this.cursor.take(snapshot);
    const module = this.module, layout = this.id;
    for (const event of fresh) {
      if (module?.event) this.guard(() => module.event!(event, snapshot));
      if (layout) for (const listener of this.listeners) if (listener.event) this.guard(() => listener.event!(event, snapshot, layout));
    }
  }
  /** Home: the module goes, and the attributes with it. */
  clear() {
    this.unmount(); this.id = undefined; this.frame = undefined; this.cursor.reset(); FALLS.reset();
    for (const listener of this.listeners) this.guard(() => listener.clear?.());
    delete this.root.dataset.hud; delete this.root.dataset.hudPhase; delete this.root.dataset.cinema;
  }

  private mount(id: HudLayoutId) {
    this.unmount();
    this.layer ??= this.makeLayer(this.root);
    this.id = id; this.root.dataset.hud = id;
    this.guard(() => this.onLayout?.(id));
    if (!this.layer) return;
    const layer = this.layer, module = this.registry[id]();
    const mount: ModeHudMount = { root: this.root, combat: layer.combat, zone: zone => layer.zone(zone) };
    this.module = module;
    this.guard(() => module.mount(mount));
  }
  private unmount() {
    const module = this.module; this.module = undefined;
    if (module) this.guard(() => module.unmount());
    this.layer?.clear();
  }
  /** A module's fault never takes the fight's HUD down with it. */
  private guard(fn: () => void) { try { fn(); } catch (error) { console.error('[mode HUD]', this.id, error); } }
}
