/**
 * The fight's HUD inside dude.work while the visitor plays (the world shows host.ui only then): the game's own combat
 * HUD, the pieces ui/Hud.ts builds it from - the plates (inked.ts and the Halo look over them, protos/), the move cards,
 * the combo, the notices, the lock-on reticle, the duel's round pips and plaque (DuelHud) - without what Hud.ts carries
 * besides (the home, the pause menu, the results, private rooms, training), none of which the live duel has.
 */
import type { Settings } from '../config';
import type { CombatEvent, FighterId, GameSnapshot, PlayerState } from '../game/types';
import { INK_DEFS, InkedHud, cardsHtml, comboHtml, foePlateHtml, inkedFit, ownPlateHtml } from '../ui/hud/inked';
import { MoveCards } from '../ui/hud/moveCards';
import { LockOnView, quietNotice } from '../ui/LockOnView';
import type { TargetMarkerInfo } from '../ui/Hud';
import { PROTO_IDS, ProtoHud, protoClocksHtml } from '../ui/hud/protos';
import { createDuelHud } from '../ui/hud/DuelHud';
import { HUD_ZONES, hudPhaseOf, type HudZone, type ModeHud } from '../ui/hud/modeHud';
import { keyboardCombatHints, padCombatHints } from '../input/glyphs';
import type { PadFamily } from '../input/gamepad';
import { THREAT_NAMES, ThreatOutline, type ThreatBody } from '../render/ThreatOutline';
import { FIGHTERS } from '../config';
import { rt } from './runtime';
import '../ui/fonts.css';
import '../ui/style.css';
import '../ui/combat-hud.css';
import '../ui/approved-hud.css';
import '../ui/hud/inked.css';
import '../ui/hud/protos/proto.css';
import '../ui/hud/protos/halo.css';
import '../ui/hud/protos/haloModes.css';
import '../ui/hud/zones.css';

export class LiveHud {
  readonly root: HTMLElement;
  private readonly combat: HTMLElement;
  private readonly inked: InkedHud;
  private readonly protos: ProtoHud;
  private readonly cards: MoveCards;
  private readonly duel: ModeHud;
  private readonly zones = new Map<HudZone, HTMLElement>();
  private lockOn?: LockOnView;
  private readonly threatGlow = new ThreatOutline();
  private glowAt = 0;
  private noticeTimer = 0;
  private lastOwnHp: number | null = null;
  private lastFoeHp: number | null = null;
  private lastFoeId: string | null = null;
  private fighter: FighterId | null = null;
  private seenEvent = 0;

  constructor(parent: HTMLElement, private readonly settings: Settings) {
    const root = this.root = document.createElement('div');
    root.id = 'interface';
    root.innerHTML = `<section class="combat-hud" aria-label="Combat status">
      ${INK_DEFS}${ownPlateHtml()}${protoClocksHtml()}${foePlateHtml()}
      <div class="target-marker hidden" id="target-marker" aria-hidden="true"></div>
      <div class="action-message" id="action-message" role="status"></div>
      ${comboHtml()}
      ${cardsHtml(['LIGHT', 'HEAVY', 'SPECIAL', 'ULTIMATE', 'AREA'], ['J', 'K', 'Q', 'R', 'G', 'E'])}
      <div class="controls-hint" id="controls-hint">${keyboardCombatHints()}</div>
    </section>`;
    parent.append(root);
    this.combat = root.querySelector<HTMLElement>('.combat-hud')!;
    // The duel's look, as Hud.ts sets it: the Halo plates (the default skin), the cards in a row, the rival plate.
    const skin = settings.hudSkin ?? 'halo';
    root.dataset.skin = skin; inkedFit.comboTop = skin === 'halo' ? 340 : 300;
    if ((PROTO_IDS as readonly string[]).includes(skin)) root.dataset.proto = skin;
    root.dataset.moves = settings.moveLayout ?? 'row';
    root.dataset.input = 'keyboard';
    root.dataset.hud = 'duel';
    this.inked = new InkedHud(root);
    this.protos = new ProtoHud(root, PROTO_IDS);
    this.cards = new MoveCards(root.querySelector<HTMLElement>('.move-bar')!);
    // The mode's zone layer over the combat HUD (hud/host.ts domZoneLayer) and the duel's module in it.
    const layer = document.createElement('div');
    layer.className = 'mode-hud'; layer.setAttribute('aria-live', 'off');
    for (const id of HUD_ZONES) { const zone = document.createElement('div'); zone.dataset.zone = id; layer.append(zone); this.zones.set(id, zone); }
    this.combat.append(layer);
    this.duel = createDuelHud();
    this.duel.mount({ root, combat: this.combat, zone: id => this.zones.get(id)! });
  }

  /** The visitor took over `fighter`: its plate, its cards, its portrait. */
  enter(fighter: FighterId) {
    this.fighter = fighter;
    this.lastOwnHp = this.lastFoeHp = null; this.lastFoeId = null;
    const name = this.root.querySelector('#own-name'); if (name) name.textContent = FIGHTERS[fighter].name.toUpperCase();
    this.inked.enter(fighter);
    this.cards.refighter(fighter);
    this.protos.enter(fighter);
    this.root.querySelector('#target-marker')?.classList.add('hidden');
  }

  /** The keyboard's or a pad's glyphs on the cards and the strip (Hud.ts setInputMode, the keyboard's and a pad's). */
  setInput(mode: 'keyboard' | 'controller' | 'touch', family: PadFamily = 'generic') {
    this.root.dataset.input = mode; this.root.dataset.pad = family;
    const hint = this.root.querySelector('#controls-hint');
    if (hint) hint.innerHTML = mode === 'controller' ? padCombatHints(family, 'LOCK ON') : keyboardCombatHints('LOCK ON');
  }

  /** Every HUD tick while the visitor plays (Hud.ts update, the duel's part). */
  update(snapshot: GameSnapshot, self: PlayerState, target: PlayerState | undefined) {
    if (this.fighter !== self.fighter) this.enter(self.fighter);
    if (this.lastOwnHp !== null && self.hp < this.lastOwnHp - 1) this.pulse('own');
    this.lastOwnHp = self.hp;
    if (target?.id !== this.lastFoeId) { this.lastFoeId = target?.id ?? null; this.lastFoeHp = null; }
    if (target && this.lastFoeHp !== null && target.hp < this.lastFoeHp - 1) this.pulse('foe');
    this.lastFoeHp = target?.hp ?? null;
    this.inked.comboTick(self.combo ?? 0);
    this.inked.update(self, target);
    const inView = snapshot.status === 'active';
    this.protos.update(self, target, snapshot.serverTime, null, inView);
    const now = performance.now(), ready = this.cards.update(self, snapshot.serverTime);
    this.inked.ultimateTick(ready, this.cards.ultimate, now);
    const phase = hudPhaseOf(snapshot);
    if (this.root.dataset.hudPhase !== phase) this.root.dataset.hudPhase = phase;
    this.duel.update({ snapshot, self, target, phase, input: (this.root.dataset.input as 'keyboard' | 'controller' | 'touch') ?? 'keyboard', family: (this.root.dataset.pad ?? 'generic') as PadFamily, now });
  }

  /** Every frame's presented events, each once (Hud.ts gets them through ModeHudHost.snapshot): the combo's damage, the
   *  duel module's. */
  events(snapshot: GameSnapshot) {
    for (const event of snapshot.events) if (event.id > this.seenEvent) { this.seenEvent = event.id; this.inked.event(event); this.duel.event?.(event, snapshot); }
  }
  /** A new sim (a new set): its events count from the start again. */
  resetEvents() { this.seenEvent = 0; }

  private pulse(side: 'own' | 'foe') {
    const meter = this.root.querySelector<HTMLElement>(`.fighter-meter.${side}`);
    if (!meter) return;
    meter.classList.remove('hit'); void meter.offsetWidth; meter.classList.add('hit');
    rt.setTimeout(() => meter.classList.remove('hit'), 420);
  }

  /** The lock-on reticle (Hud.ts targetMarker). */
  targetMarker(x: number, y: number, visible: boolean, locked = false, info?: TargetMarkerInfo, fade = 1) {
    const now = performance.now() / 1000, dt = this.glowAt ? now - this.glowAt : 0; this.glowAt = now;
    const glow = this.settings.lockStyle !== 'brackets' && locked && !!info;
    const candidate = info?.threatBody ?? (info?.body as unknown as ThreatBody | undefined);
    const body = glow && candidate?.threatInk ? candidate : undefined;
    this.threatGlow.update(dt, body, false);
    if (info) {
      if (info.bot) info.name = FIGHTERS[info.fighter]?.name ?? info.name;
      if (body) { info.glow = true; const level = this.threatGlow.state.level; if (level !== -1) { info.threat = THREAT_NAMES[level]; info.color = this.threatGlow.state.css; } }
    }
    (this.lockOn ??= new LockOnView(this.root.querySelector<HTMLElement>('#target-marker')!, this.settings)).update(x, y, visible, locked, info, fade);
  }

  notify(text: string, duration = 1.3) {
    if (quietNotice(text, !!this.lockOn?.live)) return;
    const el = this.root.querySelector('#action-message'); if (el) el.textContent = text;
    this.noticeTimer = performance.now() + duration * 1000;
  }
  tick() {
    if (this.noticeTimer && performance.now() > this.noticeTimer) { const el = this.root.querySelector('#action-message'); if (el) el.textContent = ''; this.noticeTimer = 0; }
  }

  /** The visitor left: the reticle's glow goes off their rival. */
  leave() {
    this.threatGlow.update(1, undefined, false);
    this.lockOn?.update(0, 0, false, false, undefined, 1);
    this.notify('', 0);
  }

  dispose() {
    this.duel.unmount();
    this.root.remove();
  }
}

export type { CombatEvent };
