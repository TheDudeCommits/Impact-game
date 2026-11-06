import * as THREE from 'three';
import { FIGHTERS, type Settings } from '../config';
import { VILLAGE } from '../game/objectives/lastStand';
import { objectiveOf, type ObjectiveView } from '../game/objectives/model';
import type { CombatEvent, FighterId, GameSnapshot, PlayerState } from '../game/types';
import type { CombatAction } from '../input/bindings';
import { padFamily, UI_DIRECTION, type PadFamily, type UiAction } from '../input/gamepad';
import { actionControl, actionName, padName } from '../input/glyphs';
import type { LockBody } from '../render/lockAnchors';
import type { Hud } from '../ui/Hud';
import { cardsHtml, comboHtml, foePlateHtml, InkedHud, inkedFit, ownPlateHtml } from '../ui/hud/inked';
import { MoveCards } from '../ui/hud/moveCards';
import { MoveTape } from '../ui/hud/moveTape';
import { PROTO_IDS, ProtoHud } from '../ui/hud/protos';
import { LockOnView, quietNotice } from '../ui/LockOnView';
import { RiftWarUI } from '../ui/moba/RiftWarUI';
import { quartermasterHtml } from '../ui/objectives/ObjectiveUI';
import { promptKey } from '../ui/prompts';
import { pulseClass } from '../ui/pulse';
import { nearest } from '../ui/spatialFocus';
import { keysOf, shopKeysOf, type Seat, type SeatDevice } from './seats';
import { SeatTrials } from './SeatTrials';
import type { Rect } from './split';
import './couchHud.css';

type Screen = 'split-v' | 'split-h';
/** A half's box: its own pixels (`w` x `h`), where it is on the page and its scale. */
interface Box { w: number; h: number; x: number; y: number; s: number }
/** The cards' actions by their data-move (inked.ts cardsHtml), and the awakening card's. */
const CARD_ACTIONS = ['light', 'heavy', 'special', 'ultimate', 'area'] as const;
const FACE = new Set(['south', 'east', 'west', 'north']);
/** The least a half's HUD is scaled to, of the 1600x900 frame's (a window's own floor is .75). */
const FLOOR = .62;
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** A key code as a card prints it: KeyC → C, Semicolon → ;, Numpad1 → N1. */
export function keyLabel(code: string | undefined): string {
  if (!code) return '';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'NumpadEnter') return 'N ENTER';
  if (code.startsWith('Numpad')) return 'N' + code.slice(6);
  return ({ Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT', Tab: 'TAB', Enter: 'ENTER' } as Record<string, string>)[code] ?? code.toUpperCase();
}
function padOf(device: SeatDevice) {
  if (device.kind !== 'pad' || typeof navigator !== 'object' || typeof navigator.getGamepads !== 'function') return null;
  return navigator.getGamepads()[device.index] ?? null;
}
/** Each pad's family as last seen: a pad gone for a moment (seats.ts UNPLUG_GRACE keeps its seat) keeps its buttons' names. */
const families = new Map<number, PadFamily>();
function familyOf(device: SeatDevice): PadFamily {
  if (device.kind !== 'pad') return padFamily('');
  const pad = padOf(device);
  if (pad) { const family = padFamily(pad.id); families.set(device.index, family); return family; }
  return families.get(device.index) ?? padFamily('');
}
/** What a seat's device is, as a key that changes when it does (a pad plugged in, the keys moved to another half). */
const deviceKey = (device: SeatDevice) => device.kind === 'keys' ? `keys:${device.layout}` : `pad:${device.index}:${familyOf(device)}`;
/** A card's key for a seat's device: its keyboard half's key, or its pad's button (a PlayStation face button in its colour). */
export function cardKey(device: SeatDevice, action: CombatAction): { text: string; className: string } {
  if (device.kind === 'keys') return { text: keyLabel(keysOf(device.layout)[action as keyof ReturnType<typeof keysOf>]?.[0]), className: '' };
  const family = familyOf(device), control = action === 'awaken' ? undefined : actionControl(action);
  return { text: actionName(action, family), className: family === 'playstation' && control && FACE.has(control) ? `ps-face ps-${control}` : '' };
}
/** One press as a seat's device shows it in a prompt (the trials' keys). */
function promptOf(device: SeatDevice, press: 'jump' | 'dash' | 'guard' | 'light' | 'heavy' | 'special' | 'ultimate' | 'area' | 'awaken') {
  if (device.kind === 'keys') return `<kbd>${escape(keyLabel(keysOf(device.layout)[press]?.[0]))}</kbd>`;
  return promptKey(press, { device: 'controller', family: familyOf(device) });
}
/** A seat's shop key, as its prompts name it. */
const shopKey = (device: SeatDevice) => device.kind === 'keys' ? keyLabel(shopKeysOf(device.layout)[0]) || 'CLICK' : padName(familyOf(device), 'select');

/** A half's cards' keys, each with its action (inked.ts cardsHtml: by data-move, the awakening card's AWAKEN). */
const keysOfCards = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('.move-bar .move-slot')].flatMap(card => {
  const kbd = card.querySelector<HTMLElement>('kbd');
  return kbd ? [{ kbd, action: (card.dataset.move ? CARD_ACTIONS[Number(card.dataset.move)] : 'awaken') as CombatAction }] : [];
});
/** Every card's key, written where it differs: a half's cards say its seat's own keys (the page's own HUD writes the
 *  single player's bindings on Player 1's now and then: Hud.refreshBindingHints). */
function labelCards(cards: readonly { kbd: HTMLElement; action: CombatAction }[], device: SeatDevice) {
  for (const { kbd, action } of cards) {
    const key = cardKey(device, action);
    if (kbd.textContent !== key.text) kbd.textContent = key.text;
    if (kbd.className !== key.className) kbd.className = key.className;
  }
}

/** A seat's own cursor in its shop: the device moves it from button to button by the screen's layout and chooses one,
 *  as a pad works the single player's menus (spatialFocus.ts nearest), without the page's one focus. */
class Cursor {
  el?: HTMLElement;
  /** Where in the shop's choices it stands (none yet: the first thing to buy or look at). */
  private index = -1;
  private items(scope: HTMLElement) {
    return [...scope.querySelectorAll<HTMLElement>('button:not(:disabled)')].filter(b => b.getClientRects().length > 0 && !b.closest('[hidden]'));
  }
  clear() { this.el?.classList.remove('couch-cursor'); this.el = undefined; this.index = -1; }
  /** The cursor on something in `scope`: where it was (or the same place after a redraw), else the first choice. */
  keep(scope: HTMLElement) {
    if (this.el && scope.contains(this.el) && !(this.el as HTMLButtonElement).disabled) return;
    const items = this.items(scope); if (!items.length) { this.clear(); return; }
    const first = Math.max(0, items.findIndex(b => b.dataset.buy || b.dataset.inspect));
    this.mark(items[this.index < 0 ? first : Math.min(this.index, items.length - 1)], items);
  }
  step(scope: HTMLElement, action: UiAction) {
    this.keep(scope); const at = this.el; if (!at) return;
    if (action === 'confirm') { at.click(); return; }
    const direction = UI_DIRECTION[action]; if (!direction) return;
    const items = this.items(scope), i = nearest(at.getBoundingClientRect(), items.map(el => el.getBoundingClientRect()), direction);
    if (i >= 0) this.mark(items[i], items);
  }
  private mark(el: HTMLElement, items: HTMLElement[]) {
    this.index = Math.max(0, items.indexOf(el));
    if (this.el === el) return;
    this.el?.classList.remove('couch-cursor'); this.el = el; el.classList.add('couch-cursor');
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
}

/** A shop opened in a half, at the size the single player's has, scaled down if need be to fit the half's box whole
 *  (a split-h half is shorter than any window the forge was drawn for). Reads its size: only as it opens and on a resize. */
function fitDialog(dialog: HTMLElement, box: Box | undefined) {
  if (!box) return;
  dialog.style.removeProperty('scale');
  const f = Math.min(1, box.w * .96 / Math.max(1, dialog.offsetWidth), box.h * .96 / Math.max(1, dialog.offsetHeight));
  if (f < .999) dialog.style.setProperty('scale', f.toFixed(3));
}

/** A seat's shop in its half: Last Stand's quartermaster or the Rift's forge. */
interface SeatShop {
  /** What is open over the half, for its cursor; none while it is shut. */
  surface(): HTMLElement | undefined;
  /** Its shop key: open (where it may be opened) or shut. */
  toggle(): void;
  /** BACK: shut what is open. */
  back(): void;
  /** Each HUD tick: `id` the seat's fighter, `target` whom it aims at, `key` its shop key's name. */
  update(snapshot: GameSnapshot, id: string, target: string | null, key: string): void;
  dispose(): void;
}

/** Last Stand: the quartermaster, the same shop as ObjectiveUI's (quartermasterHtml), opened beside it when this seat's
 *  fighter is at the shop inside the gate - with the shared squad funds, for the village. */
class Quartermaster implements SeatShop {
  private readonly dialog = document.createElement('dialog');
  private readonly prompt = document.createElement('button');
  private village?: NonNullable<ObjectiveView['village']>;
  private near = false; private key = ''; private notice = '';
  constructor(parent: HTMLElement, private readonly buy: (item: string) => string | undefined) {
    this.dialog.className = 'objective-shop couch-shop'; this.dialog.setAttribute('aria-label', 'Village quartermaster');
    this.prompt.type = 'button'; this.prompt.className = 'objective-shop-prompt couch-shop-prompt hidden';
    this.dialog.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button) return;
      if (button.dataset.close !== undefined) this.back();
      else if (button.dataset.buy) { this.notice = this.buy(button.dataset.buy) ?? ''; this.key = ''; if (this.village) this.draw(this.village); }
    });
    this.prompt.addEventListener('click', () => this.open());
    parent.append(this.dialog, this.prompt);
  }
  surface() { return this.dialog.open ? this.dialog : undefined; }
  toggle() { if (this.dialog.open) this.back(); else this.open(); }
  back() { if (this.dialog.open) this.dialog.close(); }
  private open() { if (!this.near || !this.village || this.dialog.open) return; this.notice = ''; this.key = ''; this.draw(this.village); this.dialog.show(); }
  update(snapshot: GameSnapshot, id: string, _target: string | null, key: string) {
    const view = objectiveOf(snapshot), village = view?.kind === 'last-stand' ? view.village : undefined, self = snapshot.players.find(p => p.id === id);
    this.village = village;
    this.near = !!village && view?.phase === 'active' && !!self?.alive && Math.hypot(self.x - VILLAGE.shop.x, self.z - VILLAGE.shop.z) <= VILLAGE.shop.radius && Math.abs(self.y) < 3;
    const label = `[ ${key} ] SHOP · SHARED FUNDS`;
    if (this.prompt.textContent !== label) this.prompt.textContent = label;
    const hidden = !this.near || this.dialog.open; if (this.prompt.classList.contains('hidden') !== hidden) this.prompt.classList.toggle('hidden', hidden);
    if (this.dialog.open) { if (!this.near || !village) this.back(); else this.draw(village); }
  }
  private draw(v: NonNullable<ObjectiveView['village']>) {
    const key = JSON.stringify([v.points, v.upgrades, v.hp >= v.maxHp, v.chapter?.id, this.notice]);
    if (key === this.key) return;
    this.key = key; this.dialog.innerHTML = quartermasterHtml(v, this.notice);
  }
  dispose() { this.dialog.close(); this.dialog.remove(); this.prompt.remove(); }
}

/** The Rift: a seat's own Rift HUD (RiftWarUI: its level, gold, relics, lane call, minimap and death clock) and its own
 *  forge and battle map, opened in its half. Player 1's is the page's own, moved into their half (`own`: main.ts updates
 *  it, and its scores are the mode's, shown once); Player 2's is a second one, its scores left out. Each one's purchases
 *  are its own fighter's. */
class RiftSeat implements SeatShop {
  readonly ui: RiftWarUI;
  private readonly own: boolean;
  constructor(parent: HTMLElement, act: (type: string, payload: unknown) => string | undefined, page?: RiftWarUI) {
    this.own = !!page;
    if (page) { this.ui = page; page.place(parent); }
    else {
      this.ui = new RiftWarUI(parent); this.ui.inline = true;
      this.ui.onCustom = (type, payload) => { const error = act(type, payload); if (error) this.ui.notice(error); };
    }
  }
  surface() { return this.ui.surface; }
  toggle() { if (this.ui.surface) this.ui.closeSetup(); else this.ui.interact(true); }
  back() { this.ui.closeSetup(); }
  update(snapshot: GameSnapshot, id: string, target: string | null, key: string) { this.ui.shopKey = () => key; if (!this.own) this.ui.update(snapshot, id, target); }
  dispose() { if (this.own) { this.ui.shopKey = undefined; this.ui.place(undefined); } else this.ui.dispose(); }
}

/** Player 2's own set of the page's HUD pieces in their half, driven from their fighter by the code that drives Player
 *  1's (Hud.update): the same markup (inked.ts), plates (InkedHud, ProtoHud), cards (MoveCards) and reticle (LockOnView). */
class SeatPanel {
  readonly inked: InkedHud;
  readonly protos: ProtoHud;
  readonly cards: MoveCards;
  readonly lockOn: LockOnView;
  private readonly tape = new MoveTape();
  private readonly own: HTMLElement; private readonly foe: HTMLElement; private readonly name: HTMLElement; private readonly message: HTMLElement;
  private fighter?: FighterId; private noticeUntil = 0;
  private lastHp: number | null = null; private lastFoeHp: number | null = null; private lastFoeId: string | null = null;
  private readonly hitTimers: number[] = [0, 0];
  private readonly centre = new THREE.Vector3();
  constructor(readonly root: HTMLElement, settings: Settings) {
    root.innerHTML = `${ownPlateHtml()}${foePlateHtml()}<div class="target-marker hidden" id="target-marker" aria-hidden="true"></div>`
      + `<div class="action-message" id="action-message" role="status"></div>${comboHtml()}`
      + cardsHtml(['LIGHT', 'HEAVY', 'SPECIAL', 'ULTIMATE', 'AREA'], ['', '', '', '', '', '']);
    this.inked = new InkedHud(root, false); this.protos = new ProtoHud(root, PROTO_IDS); this.cards = new MoveCards(root.querySelector<HTMLElement>('.move-bar')!);
    this.lockOn = new LockOnView(root.querySelector<HTMLElement>('#target-marker')!, settings);
    this.own = root.querySelector<HTMLElement>('.fighter-meter.own')!; this.foe = root.querySelector<HTMLElement>('.fighter-meter.foe')!;
    this.name = root.querySelector<HTMLElement>('#own-name')!; this.message = root.querySelector<HTMLElement>('#action-message')!;
    // A HUD picture that does not load is hidden (as Hud's are); a bust that gives way is shown again (proto.ts).
    root.querySelectorAll<HTMLImageElement>('img').forEach(img => img.addEventListener('error', () => { img.style.visibility = 'hidden'; }));
  }
  /** A new split screen: the plates' entrance, every value afresh. */
  reset() { this.fighter = undefined; this.lastHp = this.lastFoeHp = null; this.lastFoeId = null; this.noticeUntil = 0; this.message.textContent = ''; }
  /** The page's looks (#interface's skin, mode and card layout), which the pieces' own code reads off their root. */
  private looks(from: HTMLElement) {
    for (const key of ['skin', 'proto', 'hud', 'moves', 'hdLean'] as const) {
      const value = from.dataset[key]; if (this.root.dataset[key] === value) continue;
      if (value === undefined) delete this.root.dataset[key]; else this.root.dataset[key] = value;
    }
  }
  update(snapshot: GameSnapshot, self: PlayerState, target: PlayerState | undefined, page: HTMLElement) {
    this.looks(page);
    if (self.fighter !== this.fighter) {
      this.fighter = self.fighter; this.lastHp = null;
      this.name.textContent = (FIGHTERS[self.fighter]?.name ?? self.fighter).toUpperCase();
      this.inked.enter(self.fighter); this.protos.enter(self.fighter); this.cards.refighter(self.fighter);
    }
    if (this.lastHp !== null && self.hp < this.lastHp - 1) this.pulseHit(0);
    this.lastHp = self.hp;
    if (target?.id !== this.lastFoeId) { this.lastFoeId = target?.id ?? null; this.lastFoeHp = null; }
    if (target && this.lastFoeHp !== null && target.hp < this.lastFoeHp - 1) this.pulseHit(1);
    this.lastFoeHp = target?.hp ?? null;
    this.inked.comboTick(self.combo ?? 0);
    this.inked.update(self, target);
    this.protos.update(self, target, snapshot.serverTime, null, snapshot.status === 'active');
    const now = performance.now(), ready = this.cards.update(self, snapshot.serverTime);
    this.inked.ultimateTick(ready, this.cards.ultimate, now);
    this.tape.tick(this.root, this.cards.bar, now);
    if (this.noticeUntil && now > this.noticeUntil) { this.noticeUntil = 0; this.message.textContent = ''; }
  }
  private pulseHit(side: 0 | 1) {
    const meter = side ? this.foe : this.own;
    pulseClass(meter, 'hit'); window.clearTimeout(this.hitTimers[side]);
    this.hitTimers[side] = window.setTimeout(() => meter.classList.remove('hit'), 420);
  }
  notify(text: string, seconds: number) {
    if (quietNotice(text, this.lockOn.live)) return;
    if (this.message.textContent !== text) this.message.textContent = text;
    this.noticeUntil = performance.now() + seconds * 1000;
  }
  /** Every frame: the reticle on whom this seat aims at, through its own half's camera (Hud.targetMarker's, the
   *  brackets: the threat glow on a body is Player 1's). */
  marker(self: PlayerState | undefined, target: PlayerState | undefined, locked: boolean, body: LockBody | undefined, camera: THREE.Camera | undefined) {
    if (!self || !target || !target.alive || !camera || target.enemy === 'rift-unit') { this.lockOn.update(0, 0, false, false, undefined, 1); return; }
    const size = target.size ?? 1, distance = Math.hypot(target.x - self.x, target.y - self.y, target.z - self.z);
    const fade = self.action === 'ultimate' || target.action === 'ultimate' ? 0 : 1;
    const name = target.isBot && !target.enemy ? FIGHTERS[target.fighter]?.name ?? target.name : target.name;
    this.lockOn.update(0, 0, locked || Math.hypot(target.x - self.x, target.z - self.z) > 3.3, locked,
      { id: target.id, name, distance, body, centre: body ? undefined : this.centre.set(target.x, target.y + 1.75 * size, target.z), size, camera }, fade);
  }
}

/** Player 2's move cards on one screen, in the right corner under their plate: the page's markup (inked.ts cardsHtml),
 *  driven from their fighter by the cards' own code (MoveCards), as a split screen's half does (SeatPanel). */
class SeatCards {
  readonly root = document.createElement('div');
  readonly cards: MoveCards;
  private readonly tape = new MoveTape();
  private fighter?: FighterId;
  constructor() {
    this.root.className = 'couch-cards'; this.root.dataset.seat = '1';
    this.root.innerHTML = cardsHtml(['LIGHT', 'HEAVY', 'SPECIAL', 'ULTIMATE', 'AREA'], ['', '', '', '', '', '']);
    this.cards = new MoveCards(this.root.querySelector<HTMLElement>('.move-bar')!);
    this.root.querySelectorAll<HTMLImageElement>('img').forEach(img => img.addEventListener('error', () => { img.style.visibility = 'hidden'; }));
  }
  reset() { this.fighter = undefined; }
  update(self: PlayerState, serverTime: number, page: HTMLElement) {
    if (self.fighter !== this.fighter) { this.fighter = self.fighter; this.cards.refighter(self.fighter); }
    this.cards.update(self, serverTime);
    this.tape.tick(page, this.cards.bar, performance.now());
  }
}

export class CouchHud {
  /** main.ts: a body as it is drawn (Player 2's target, for their reticle), Player 2's lens, and a seat's purchase or
   *  command in its own shop ('objective-buy', 'rift-buy', 'rift-recall', 'rift-buyback', 'rift-ping'): the refusal, if any;
   *  and the page's own Rift HUD (Player 1's, moved into their half in the Rift). */
  host: { body(id: string): LockBody | undefined; camera(): THREE.Camera | undefined; act(seat: number, type: string, payload: unknown): string | undefined; rift?: RiftWarUI } = {
    body: () => undefined, camera: () => undefined, act: () => undefined,
  };
  private readonly page: HTMLElement;
  private readonly layer = document.createElement('div');
  private readonly halves: [HTMLElement, HTMLElement];
  private readonly divider = document.createElement('div');
  private seats: () => readonly Seat[] = () => [];
  private on = false;
  /** One screen: Player 2's cards beside Player 1's (`share`). */
  private sharing = false;
  private duo?: SeatCards;
  /** The page's looks the card rows were last fitted to (`fit`). */
  private looksFitted = '';
  private readonly moved: { piece: Element; mark: Comment }[] = [];
  private keyCards: { kbd: HTMLElement; action: CombatAction }[][] = [];
  private two?: SeatPanel;
  private boxes: Box[] = [];
  private mode = '';
  private trials: SeatTrials[] = [];
  private shops: SeatShop[] = [];
  private readonly cursors = [new Cursor(), new Cursor()];
  /** What each seat had open last frame (a shop just opened is fitted to its half). */
  private readonly opened: (HTMLElement | undefined)[] = [undefined, undefined];
  constructor(private readonly hud: Hud) {
    this.page = document.getElementById('interface')!;
    this.layer.className = 'couch-views'; this.divider.className = 'couch-divider';
    const half = (i: number) => { const node = document.createElement('div'); node.className = 'couch-view'; node.dataset.seat = String(i); return node; };
    this.halves = [half(0), half(1)];
    this.layer.append(...this.halves, this.divider);
    hud.modes.listeners.push({ frame() {}, event: (event, snapshot) => this.event(event, snapshot) });
  }
  get shown() { return this.on; }
  /** One screen: Player 2's move cards in the right corner, Player 1's to the left (couchHud.css), each naming its seat's
   *  keys, and in Training each person's own trials. `seats`: the couch's seats now. */
  share(seats: () => readonly Seat[]) {
    this.seats = seats;
    if (this.sharing || this.on) return;
    this.sharing = true;
    this.duo ??= new SeatCards();
    this.duo.reset();
    this.page.querySelector<HTMLElement>('.combat-hud')!.append(this.duo.root);
    document.body.classList.add('couch-shared');
    this.keyCards = []; this.looksFitted = '';
  }
  /** One screen: both card rows a size down where the window is too narrow for them side by side (a tablet's), each kept
   *  to its own half. Reads layout: only as the screen is shared, as the HUD's looks change and on a resize. */
  fit() {
    if (!this.sharing) return;
    const combat = this.page.querySelector<HTMLElement>('.combat-hud'); if (!combat) return;
    combat.style.removeProperty('--couch-fit');
    const mid = innerWidth / 2, gap = Math.max(16, innerWidth * .03);
    let fit = 1;
    for (const bar of combat.querySelectorAll<HTMLElement>('.move-bar.ik-cards')) {
      const r = bar.getBoundingClientRect(); if (r.width < 1) continue;
      fit = Math.min(fit, (bar.closest('.couch-cards') ? r.right - mid - gap : mid - gap - r.left) / r.width);
    }
    if (fit < .999) combat.style.setProperty('--couch-fit', Math.max(.4, fit).toFixed(3));
  }
  /** The screen split: Player 1's pieces into their half, Player 2's set into theirs. `seats`: the couch's seats now. */
  show(screen: Screen, seats: () => readonly Seat[]) {
    this.seats = seats;
    if (!this.on) {
      this.on = true;
      this.two ??= new SeatPanel(this.halves[1], this.hud.settings);
      this.two.reset();
      this.adopt();
      this.page.querySelector<HTMLElement>('.combat-hud')!.append(this.layer);
      this.keyCards = this.halves.map(keysOfCards);
    }
    this.layer.dataset.screen = screen;
  }
  hide() {
    if (this.sharing) {
      this.sharing = false; this.remode(''); this.keyCards = [];
      this.page.querySelector<HTMLElement>('.combat-hud')?.style.removeProperty('--couch-fit');
      this.duo?.root.remove(); document.body.classList.remove('couch-shared');
      this.hud.restoreKeys();
    }
    if (!this.on) return;
    this.on = false;
    this.remode('');
    for (const { piece, mark } of this.moved.splice(0).reverse()) mark.replaceWith(piece);
    this.layer.remove();
    for (const seat of this.seats()) { seat.menuOpen = false; seat.picks.length = 0; seat.interact = false; }
    this.hud.markerSpace(undefined); this.hud.restoreKeys();
    this.two?.lockOn.update(0, 0, false, false, undefined, 1);
  }
  /** The page's combat HUD into Player 1's half: each piece leaves a mark where it stood, so `hide` puts it back in its
   *  place. Pieces made later (the mode HUD's zones, mounted with the match's first snapshot) follow on the next tick. */
  private adopt() {
    const combat = this.page.querySelector<HTMLElement>('.combat-hud'); if (!combat) return;
    for (const piece of [...combat.children]) {
      if (piece === this.layer) continue;
      const mark = document.createComment('couch'); piece.replaceWith(mark); this.halves[0].append(piece); this.moved.push({ piece, mark });
    }
  }
  /** Each half's box on the page (CSS pixels) and its scale: the HUD's own fit for a window the half's size (inked.ts
   *  watchFit: the 1600x900 frame, a phone's 844x390), down to FLOOR (a window's own floor is .75: a half is smaller than
   *  any window the HUD was drawn for), against the window's own (inkedFit.k), which the box's pieces are drawn at. */
  layout(rects: readonly [Rect, Rect]) {
    if (!this.on) return;
    const combat = this.layer.parentElement; if (!combat) return;
    const frame = combat.getBoundingClientRect(), ox = frame.left + combat.clientLeft, oy = frame.top + combat.clientTop;
    const W = Math.max(1, innerWidth), H = Math.max(1, innerHeight), K = inkedFit.k || 1;
    this.boxes = rects.map((r, i) => {
      const half = this.halves[i], fit = inkedFit.phone ? Math.min(r.w / 844, r.h / 390) : Math.min(r.w / 1600, r.h / 900);
      const s = Math.min(1.3, Math.max(FLOOR, fit)) / K, w = r.w / s, h = r.h / s;
      Object.assign(half.style, { left: `${r.x - ox}px`, top: `${r.y - oy}px`, width: `${w}px`, height: `${h}px`, transform: `scale(${s})` });
      half.style.setProperty('--couch-s', s.toFixed(4)); half.style.setProperty('--hud-kw', Math.min(1.3, w / (inkedFit.phone ? 844 : 1600)).toFixed(3));
      return { w, h, x: r.x, y: r.y, s };
    });
    const [a, b] = rects, vertical = this.layer.dataset.screen === 'split-v';
    Object.assign(this.divider.style, vertical
      ? { left: `${a.x + a.w - ox}px`, top: `${-oy}px`, width: `${Math.max(1, b.x - a.x - a.w)}px`, height: `${H}px` }
      : { left: `${-ox}px`, top: `${a.y + a.h - oy}px`, width: `${W}px`, height: `${Math.max(1, b.y - a.y - a.h)}px` });
    this.hud.markerSpace(this.boxes[0]);
    if (this.two) this.two.lockOn.space = this.boxes[1];
    this.opened.forEach((dialog, i) => { if (dialog) fitDialog(dialog, this.boxes[i]); });
  }
  /** A notice for one seat in its own half (a COUNTER!, a PARRY, a move's name: main.ts `personal`): Player 1's is the
   *  page's own (Hud.notify), Player 2's their own half's. */
  notice(seat: number, text: string, seconds: number) {
    if (seat === 0) this.hud.notify(text, seconds);
    else this.two?.notify(text, seconds);
  }
  /** Each HUD tick (main.ts, about 14 a second): Player 2's pieces, both halves' keys, trials and shops. */
  update(snapshot: GameSnapshot, ids: readonly [string, string], targets: readonly [string | null, string | null]) {
    if (this.sharing) { this.shared(snapshot, ids); return; }
    if (!this.on) return;
    const mode = this.page.dataset.hud ?? '';
    if (mode !== this.mode) this.remode(mode, ids);
    if (this.layer.parentElement && this.layer.parentElement.children.length > 1) this.adopt();
    const seats = this.seats(), find = (id: string | null) => id ? snapshot.players.find(p => p.id === id) : undefined;
    seats.slice(0, 2).forEach((seat, i) => labelCards(this.keyCards[i] ?? [], seat.device));
    const two = find(ids[1]);
    if (two && this.two) { const target = find(targets[1]); this.two.update(snapshot, two, target?.enemy === 'rift-unit' ? undefined : target, this.page); }
    this.trials.forEach((trials, i) => { const seat = seats[i], me = find(ids[i]); if (seat && me) trials.update(me.fighter, deviceKey(seat.device)); });
    this.shops.forEach((shop, i) => { const seat = seats[i]; if (seat) shop.update(snapshot, ids[i], targets[i], shopKey(seat.device)); });
  }
  /** One screen's HUD tick: both seats' cards' keys (Player 1's are the page's own bar, found again if the page redraws
   *  it), Player 2's cards and, in Training, both seats' trials. */
  private shared(snapshot: GameSnapshot, ids: readonly [string, string]) {
    const mode = this.page.dataset.hud ?? '';
    if (mode !== this.mode) this.remode(mode, ids);
    const looks = `${mode} ${this.page.dataset.skin} ${this.page.dataset.moves}`;
    if (looks !== this.looksFitted) { this.looksFitted = looks; this.fit(); }
    if (!this.keyCards[0]?.[0]?.kbd.isConnected) {
      const own = [...this.page.querySelectorAll<HTMLElement>('.combat-hud .move-bar')].find(bar => !bar.closest('.couch-cards'));
      this.keyCards = [own ? keysOfCards(own) : [], this.duo ? keysOfCards(this.duo.cards.bar) : []];
    }
    const seats = this.seats(), find = (id: string | null) => id ? snapshot.players.find(p => p.id === id) : undefined;
    seats.slice(0, 2).forEach((seat, i) => labelCards(this.keyCards[i] ?? [], seat.device));
    const two = find(ids[1]); if (two) this.duo?.update(two, snapshot.serverTime, this.page);
    this.trials.forEach((trials, i) => { const seat = seats[i], me = find(ids[i]); if (seat && me) trials.update(me.fighter, deviceKey(seat.device)); });
  }
  /** Every frame (main.ts): Player 2's reticle, and each seat's shop key and cursor. */
  frame(snapshot: GameSnapshot, ids: readonly [string, string], targets: readonly [string | null, string | null], locks: readonly [boolean, boolean]) {
    if (!this.on) return;
    const find = (id: string | null) => id ? snapshot.players.find(p => p.id === id) : undefined;
    if (this.two) { const target = find(targets[1]); this.two.marker(find(ids[1]), target, locks[1], target ? this.host.body(target.id) : undefined, this.host.camera()); }
    this.seats().slice(0, 2).forEach((seat, i) => {
      const shop = this.shops[i], cursor = this.cursors[i];
      if (seat.interact) { seat.interact = false; shop?.toggle(); }
      let surface = shop?.surface();
      for (const pick of seat.picks.splice(0)) {
        if (!surface || !shop) break;
        if (pick === 'back') shop.back(); else cursor.step(surface, pick);
        surface = shop.surface();
      }
      seat.menuOpen = !!surface;
      if (surface !== this.opened[i]) { this.opened[i] = surface; this.halves[i].classList.toggle('couch-shopping', !!surface); if (surface) fitDialog(surface, this.boxes[i]); }
      if (surface) cursor.keep(surface); else cursor.clear();
    });
  }
  /** Each combat event once (ModeHudHost's listeners): Player 2's combo damage and STYLE, and each seat's trials. */
  event(event: CombatEvent, snapshot: GameSnapshot) {
    if (!this.on && !this.sharing) return;
    if (this.on) this.two?.inked.event(event);
    for (const trials of this.trials) trials.event(event, snapshot);
  }
  /** The mode's own pieces for each half: Training's trials, Last Stand's and the Rift's shops. */
  private remode(mode: string, ids: readonly [string, string] = ['', '']) {
    this.mode = mode;
    for (const trials of this.trials) trials.node.remove();
    for (const shop of this.shops) shop.dispose();
    this.trials = []; this.shops = [];
    this.cursors.forEach(cursor => cursor.clear()); this.opened.fill(undefined);
    for (const half of this.halves) half.classList.remove('couch-shopping');
    for (const seat of this.seats()) { seat.menuOpen = false; seat.picks.length = 0; }
    if (!this.on && !this.sharing) return;
    const seats = () => this.seats(), combat = this.page.querySelector<HTMLElement>('.combat-hud');
    if (mode === 'training') this.trials = [0, 1].map(i => {
      const trials = new SeatTrials(ids[i], press => { const seat = seats()[i]; return seat ? promptOf(seat.device, press) : ''; });
      // (One screen: under each person's plate, Player 1's on the left and Player 2's on the right: couchHud.css.)
      trials.node.dataset.seat = String(i);
      (this.on ? this.halves[i] : combat)?.append(trials.node); return trials;
    });
    else if (!this.on) return;
    else if (mode === 'last-stand') this.shops = [0, 1].map(i => new Quartermaster(this.halves[i], item => this.host.act(i, 'objective-buy', item)));
    else if (mode === 'rift-war') this.shops = [0, 1].map(i => new RiftSeat(this.halves[i], (type, payload) => this.host.act(i, type, payload), i ? undefined : this.host.rift));
  }
}
