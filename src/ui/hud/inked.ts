import { FIGHTERS } from '../../config';
import type { CombatEvent, FighterId, PlayerState } from '../../game/types';
import { brushStroke, inkSplats } from '../inkSplat';
import { fighterArt, mangaPortrait } from '../MangaHome';
import { cutout, whenIdle } from './cutout';
import { protoPlatesHtml } from './protos';


/** The brush that inks every hull: a slight wobble so each one reads as drawn by hand (the prototype's #inked). */
export const INK_DEFS = '<svg class="ik-defs" width="0" height="0" aria-hidden="true" focusable="false">'
  + '<filter id="ik-ink" x="-5%" y="-10%" width="110%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter>'
  + '<filter id="ik-ink-s" x="-5%" y="-12%" width="110%" height="124%"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/></filter></svg>';

/** An inked hull: a paper shape in an ink stroke, through the brush filter. */
export const hull = (w: number, h: number, d: string, cls: string, filter = 'ik-ink-s') =>
  `<svg class="ik-hull ${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path filter="url(#${filter})" d="${d}"/></svg>`;

/**
 * Where each fighter's head sits in their full-body drawing (public/assets/home/fighters/<id>.webp, 933x1400 on white
 * paper): the plate window's left and top edges and the width of drawing it shows, in the drawing's pixels. Where the
 * window's top edge cuts through the hair or a hat, that part breaks out of the frame. Taisei's and Nigo's drawings are
 * on black paper and cannot be cut out, and Vol. 2 has no full-body drawings: those show their head (the home's
 * portrait) inside the frame, with no breakout.
 */
export const HEADS: Partial<Record<FighterId, readonly [number, number, number]>> = {
  gummy: [338, 114, 233], konta: [338, 117, 233], shirokane: [338, 89, 233], kenzo: [335, 22, 200], kosho: [318, 20, 200],
  ouga: [300, 192, 310], shiden: [398, 60, 190], koko: [370, 50, 180], kagari: [338, 73, 190], ward: [370, 80, 150],
  kuon: [393, 67, 160], oro: [379, 47, 170], gaunt: [408, 150, 170], setsu: [340, 147, 240],
};
const BODY_W = 933, BODY_H = 1400;
/** The own portrait's frame and window, px (the window is inset 5 px left and top, 6 px right and bottom). */
const FRAME_W = 94, WINDOW_W = 83;

/** The move sheets' five panels (public/assets/ui/moves/<id>.webp, five equal panels on white): each card shows its
 *  panel inset a little, at the card's own aspect (inked.css: background-size 540%). */
export const ART_X = ['0.9%', '25.45%', '50%', '74.55%', '99.1%'];
const art = (i: number) => `<span class="ik-art" style="--art-x:${ART_X[i]}"></span><span class="ik-art ik-lit" style="--art-x:${ART_X[i]}"></span>`;
/** Reticle fallback until a reviewed area illustration has loaded (MoveCardArt). */
const GLYPH = '<span class="ik-art ik-glyph"></span><span class="ik-art ik-lit ik-glyph"></span>';

/* ---------- Markup (Hud.ts builds the combat HUD from these; the ids are the ones code and tests use) ---------- */

export function ownPlateHtml() {
  return `<div class="fighter-meter own ik-plate">${hull(300, 94, 'M8 4 L132 2 L137 0 L300 0 L290 86 L214 89 L208 92 L0 94 Z', 'ik-plate-hull')}`
    + `<span class="ik-portrait">${hull(94, 88, 'M4 2 L94 0 L90 88 L0 85 Z', 'ik-frame')}<span class="ik-window" id="own-portrait"></span><span class="ik-breakout" aria-hidden="true"></span></span>`
    + '<span class="ik-body"><strong class="ik-name" id="own-name">' + FIGHTERS.taisei.name.toUpperCase() + '</strong><span class="ik-hpnum" id="own-hp"><b>1000</b><small>/1000</small></span>'
    + '<span class="ik-bar ik-hp" id="own-health"><span class="ik-in"><i class="ik-echo" id="own-health-echo"></i><i class="ik-fill"></i><i class="ik-shade"></i><i class="ik-tip"></i></span></span>'
    + '<span class="ik-stamina"><span class="ik-label">STAMINA</span><span class="ik-bar ik-stam" id="own-stamina"><span class="ik-in"><i class="ik-chip"></i><i class="ik-fill"></i><i class="ik-shade"></i><i class="ik-tip"></i><i class="ik-flash"></i><i class="ik-glint"></i></span></span></span>'
    + `</span>${protoPlatesHtml('own')}</div>`;
}
/** The target plate. In a duel it is the rival plate instead (SPEC 5.3): the own plate mirrored, as big, with stamina -
 *  the second hull and the stamina row are there for that, and inked.css shows them under #interface[data-hud=duel]. */
export function foePlateHtml() {
  return `<div class="fighter-meter foe ik-plate">${hull(262, 66, 'M10 0 L262 5 L254 66 L0 61 Z', 'ik-plate-hull')}${hull(300, 94, 'M0 0 L163 0 L168 2 L292 4 L300 94 L92 92 L86 89 L10 86 Z', 'ik-rival-hull')}`
    + `<span class="ik-portrait">${hull(78, 72, 'M0 0 L75 4 L78 72 L3 68 Z', 'ik-frame')}<span class="ik-window" id="foe-portrait"></span></span>`
    + '<span class="ik-body"><strong class="ik-name" id="foe-name">' + FIGHTERS.konta.name.toUpperCase() + '</strong><span class="ik-hpnum" id="foe-hp"><b>1000</b><small>/1000</small></span>'
    + '<span class="ik-bar ik-hp" id="foe-health"><span class="ik-in"><i class="ik-echo" id="foe-health-echo"></i><i class="ik-fill"></i><i class="ik-shade"></i><i class="ik-tip"></i></span></span>'
    + '<span class="ik-stamina"><span class="ik-label">STAMINA</span><span class="ik-bar ik-stam" id="foe-stamina"><span class="ik-in"><i class="ik-chip"></i><i class="ik-fill"></i><i class="ik-shade"></i><i class="ik-tip"></i><i class="ik-flash"></i></span></span></span>'
    + `</span>${protoPlatesHtml('foe')}</div>`;
}
/** The combo: the game's own ink splat (inkSplat.ts, as the damage counts print on), the count and the string's damage. */
export function comboHtml() {
  return `<div class="combo-counter ik-combo hidden" id="combo-counter" aria-hidden="true"><svg class="ik-splat" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><path d="${inkSplats()[2]}"/></svg>`
    + '<b class="ik-count" id="combo-count">0</b><span class="ik-hits">HITS</span><span class="ik-dmg"><b>0</b><small>DMG</small></span>'
    // Techniques (game/techniques.ts): what the combo's variety is worth, once it is worth more than itself.
    + '<span class="ik-style" hidden><b>×1.0</b><small>STYLE</small></span></div>';
}
export function cardsHtml(labels: readonly string[], keys: readonly string[]) {
  const card = (i: number) => `<div class="move-slot ik-card${i === 3 ? ' charged' : ''}" data-move="${i}"${i === 3 ? ' id="ultimate-card"' : i === 4 ? ' id="area-card"' : ''}>${i === 4 ? GLYPH : art(i)}<b class="ik-num ik-cool"></b>`
    + `${i === 3 ? '<b class="ik-num ik-charge" data-unit="%">0</b>' : ''}<strong class="ik-cap">${labels[i]}</strong><kbd>${keys[i]}</kbd>${i === 3 ? '<span class="ik-ready">READY</span>' : ''}</div>`;
  return `<div class="move-bar ik-cards">${[0, 1, 2, 4, 3].map(card).join('')}`
    + `<div class="move-slot ik-card charged awakening-slot" id="awakening-card">${art(4)}<b class="ik-num ik-charge" data-unit="%">0</b><strong class="ik-cap" id="awakening-card-title">AWAKENING</strong><kbd>${keys[5]}</kbd><span class="ik-ready">READY</span></div>`
    + `<div class="ik-ultcall" aria-hidden="true"><svg viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${brushStroke(5, .7)}"/></svg>`
    + '<strong>ULTIMATE READY</strong><span><kbd class="ik-ult-key">R</kbd><em class="ik-ult-name"></em></span></div></div>';
}

/* ---------- Behaviour ---------- */

/** A phone on its side, or a narrow window: the pieces' own phone scales (inked.css's media query is the same). */
const PHONE = '(max-height:520px) and (orientation:landscape), (max-width:620px)';
/** The interface's scale (--hud-k) and whether the phone factors apply, kept current by InkedHud on resize: EdgeMarkers
 *  sizes its stack from it without reading the page's styles. `comboTop` is where the combo prints at the reference
 *  frame (inked.css 300; Halo prints it lower, under its X - halo.css 340 - and Hud.applySkin says which). */
export const inkedFit = { k: 1, phone: false, comboTop: 300 };
/** The edge markers' bubbles are scaled by this on a phone (inked.css --k-edge). */
export const EDGE_PHONE = .6;
const keep = { left: 0, top: 0, right: 0, bottom: 0 };
/** Where the combo prints, its ink splat included (inked.css .ik-combo: left middle, further in on a phone), in screen
 *  px at the current fit. Pieces pinned to the left edge (Last Stand's lane tags, edge.ts) keep out of it. One shared
 *  object, written in place: no allocation. */
export function comboKeepOut() {
  const k = inkedFit.k, s = k * (inkedFit.phone ? .5 : 1), left = (inkedFit.phone ? 200 : 62) * k, middle = (inkedFit.phone ? 112 : inkedFit.comboTop) * k + 110;
  keep.left = left - 20 * s; keep.right = left + 300 * s; keep.top = middle - 150 * s; keep.bottom = middle + 120 * s;
  return keep;
}
/** How long the ULTIMATE READY banner (and the R card's pulse with it) stays up, ms. */
const READY_MS = 2400;
/** A blow's late damage (a burn) joins the string it came from within this long, s (trainingTrials' ComboTracker). */
const STRING_GRACE = 1.2;

/** A bar: an ink trough whose fill, cel shade, tip and the chip of what was just lost all follow one --v (0..1). */
class Bar {
  private v = -1; private up = false;
  constructor(readonly el: HTMLElement) {}
  set(value: number) {
    const v = Math.max(0, Math.min(1, value));
    if (Math.abs(v - this.v) < .0005) return;
    // Drops are quick and refills sweep up (inked.css .ik-up); the direction class is written only when it turns.
    const up = this.v >= 0 && v > this.v;
    if (up !== this.up) { this.up = up; this.el.classList.toggle('ik-up', up); }
    this.v = v; this.el.style.setProperty('--v', v.toFixed(4));
  }
  get value() { return this.v; }
  /** The next value lands at once, without the chip (a new target, a new match). */
  snap() { this.v = -1; this.el.classList.add('ik-snap'); }
  settle() { this.el.classList.remove('ik-snap'); }
}

const setText = (node: Element, value: string) => { if (node.textContent !== value) node.textContent = value; };
/** A long name is lettered a size or two down, so it never runs into the HP number (inked.css [data-name]). */
function nameSize(plate: HTMLElement, name: string, long: number, longer: number) {
  const size = name.length > longer ? 'longer' : name.length > long ? 'long' : undefined;
  if (plate.dataset.name !== size) { if (size) plate.dataset.name = size; else delete plate.dataset.name; }
}

export class InkedHud {
  private readonly own: HTMLElement; private readonly foe: HTMLElement;
  private readonly ownHp: Bar; private readonly ownStamina: Bar; private readonly foeHp: Bar; private readonly foeStamina: Bar;
  private readonly ownNum: HTMLElement; private readonly ownMax: HTMLElement; private readonly foeNum: HTMLElement; private readonly foeMax: HTMLElement; private readonly foeName: HTMLElement;
  private readonly window: HTMLElement; private readonly breakout: HTMLElement; private readonly glint: HTMLElement;
  private readonly combo: HTMLElement; private readonly comboCount: HTMLElement; private readonly comboDamage: HTMLElement;
  private readonly comboStyle: HTMLElement; private style = 1; private shownStyle = 1;
  private readonly ult: HTMLElement; private readonly ultKey: HTMLElement; private readonly ultName: HTMLElement;
  private low = false; private staminaFloor = 1; private snapped = false;
  /** The plates' flags (inked.css): under 20% HP the number throbs; at 0 the portrait greys; the rival's stamina low. */
  private readonly flags = new Map<string, boolean>();
  private foeId: string | null = null; private foeFighter = '';
  private shownCombo = 0; private damage = 0; private stringAt = -Infinity; private shownDamage = -1;
  private ultReady = false; private ultUntil = 0;
  private portraitToken = 0;
  /** The local player's id, for the combo's damage (events name who struck). */
  selfId = '';

  /** `fit`: keep --hud-k on `root` to the window's size (the page's own HUD); a split screen's half sets its own
   *  (couch/CouchHud.ts). */
  constructor(private readonly root: HTMLElement, fit = true) {
    const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
    this.own = q('.fighter-meter.own'); this.foe = q('.fighter-meter.foe');
    this.ownHp = new Bar(q('#own-health')); this.ownStamina = new Bar(q('#own-stamina')); this.foeHp = new Bar(q('#foe-health')); this.foeStamina = new Bar(q('#foe-stamina'));
    this.ownNum = q('#own-hp b'); this.ownMax = q('#own-hp small'); this.foeNum = q('#foe-hp b'); this.foeMax = q('#foe-hp small'); this.foeName = q('#foe-name');
    this.window = q('#own-portrait'); this.breakout = q('.fighter-meter.own .ik-breakout'); this.glint = q('#own-stamina .ik-glint');
    this.combo = q('#combo-counter'); this.comboCount = q('#combo-count'); this.comboDamage = q('#combo-counter .ik-dmg b');
    this.comboStyle = q('#combo-counter .ik-style');
    this.ult = q('.ik-ultcall'); this.ultKey = q('.ik-ult-key'); this.ultName = q('.ik-ult-name');
    if (fit) this.watchFit();
    // The italic faces the plates and cards are lettered in (self-hosted, inked.css), fetched before the first fight.
    if (typeof document === 'object') for (const face of ['italic 900 30px "Barlow Condensed"', 'italic 800 13px "Barlow Condensed"']) void document.fonts?.load(face).catch(() => undefined);
  }

  /** --hud-k (the SPEC's scaling, section 3): the 1600x900 reference frame fitted to the window, kept within .75-1.3; on a
   *  phone the 844x390 frame the phone factors were measured on (1 on that phone). --hud-kw is the frame fitted to the
   *  window's width alone, with no floor: the drawn looks' wider plates (hud/protos) never grow past it, so two of them
   *  and the clock fit side by side in a narrow window or on a tablet. Written on resize only. */
  private watchFit() {
    if (typeof window !== 'object' || typeof matchMedia !== 'function') return;
    const phone = matchMedia(PHONE);
    let last = '', lastWide = '';
    const fit = () => {
      const w = innerWidth, h = innerHeight, fit = phone.matches ? Math.min(w / 844, h / 390) : Math.min(w / 1600, h / 900);
      const k = Math.min(1.3, Math.max(.75, fit)), wide = Math.min(1.3, w / (phone.matches ? 844 : 1600));
      inkedFit.k = k; inkedFit.phone = phone.matches;
      const v = (Math.round(k * 1000) / 1000).toString(), vw = (Math.round(wide * 1000) / 1000).toString();
      if (v !== last) { last = v; this.root.style.setProperty('--hud-k', v); }
      if (vw !== lastWide) { lastWide = vw; this.root.style.setProperty('--hud-kw', vw); }
    };
    fit(); addEventListener('resize', fit); phone.addEventListener?.('change', fit);
  }

  /** A new match: the fighter's portrait (and its breakout), and every bar snapped to the fighter as they stand. */
  enter(fighter: FighterId) {
    this.portrait(fighter);
    nameSize(this.own, FIGHTERS[fighter]?.name ?? fighter, 9, 12);
    this.ownHp.snap(); this.ownStamina.snap(); this.foeHp.snap(); this.foeStamina.snap(); this.snapped = true;
    this.low = false; this.own.classList.remove('ik-low'); this.staminaFloor = 1;
    this.foeId = null; this.foeFighter = '';
    this.shownCombo = 0; this.damage = 0; this.stringAt = -Infinity; this.shownDamage = -1;
    this.ultReady = false; this.ultUntil = 0; this.ult.classList.remove('ik-on');
    this.root.querySelector('#ultimate-card')?.classList.remove('ik-fresh');
  }

  /** The own portrait: the full-body drawing framed on the head, its hair or hat cut out to break over the frame's top
   *  edge; or, without a drawing that allows it, the head the home screen shows. */
  portrait(fighter: FighterId) {
    const token = ++this.portraitToken, head = HEADS[fighter], b = this.breakout;
    b.style.cssText = ''; b.hidden = true;
    if (!head) { this.window.dataset.kind = 'face'; this.window.innerHTML = mangaPortrait(fighter); return; }
    const [x, y, w] = head, s = WINDOW_W / w, src = fighterArt(fighter);
    this.window.dataset.kind = 'body';
    this.window.innerHTML = `<span class="ik-draw" style="left:${-x * s}px;top:${-y * s}px;width:${BODY_W * s}px;height:${BODY_H * s}px;background-image:url('${src}')"></span>`;
    // The sticker is cut at twice the drawing's size in the frame, so it stays sharp on a high-density screen.
    const q = 2;
    whenIdle(() => void cutout(src, { scale: s * q, margin: 2 * q, rim: 4 * q }).then(c => {
      if (!c || token !== this.portraitToken) return;
      const pad = c.pad / q, left = 5 - x * s - pad, top = 5 - y * s - pad, width = BODY_W * s + 2 * pad, height = BODY_H * s + 2 * pad;
      // Only what rises above the frame (to the plate's top), and no wider than the frame and a little.
      const clip = `inset(${Math.max(0, -36 - top).toFixed(1)}px ${Math.max(0, width - (FRAME_W + 8 - left)).toFixed(1)}px calc(100% - ${(7 - top).toFixed(1)}px) ${Math.max(0, -8 - left).toFixed(1)}px)`;
      b.style.cssText = `left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;width:${width.toFixed(1)}px;height:${height.toFixed(1)}px;background-image:url('${c.url}');clip-path:${clip}`;
      b.hidden = false;
    }));
  }

  /** Every HUD tick (Hud.update): the own plate, the target plate. */
  update(self: PlayerState, target: PlayerState | undefined) {
    if (this.snapped) { this.snapped = false; } else { this.ownHp.settle(); this.ownStamina.settle(); this.foeHp.settle(); this.foeStamina.settle(); }
    this.selfId = self.id;
    const maxHp = self.maxHp || 1;
    this.ownHp.set(self.hp / maxHp);
    setText(this.ownNum, String(Math.max(0, Math.ceil(self.hp)))); setText(this.ownMax, `/${self.maxHp}`);
    const stamina = self.stamina / (self.maxStamina ?? 100);
    this.ownStamina.set(stamina);
    // Under 25% a held guard can break: the label turns red and the bar pulses.
    const low = stamina < .25;
    if (low !== this.low) { this.low = low; this.own.classList.toggle('ik-low', low); }
    this.flag(this.own, 'ik-hplow', self.hp > 0 && self.hp / maxHp < .2); this.flag(this.own, 'ik-down', self.hp <= 0);
    // A refill to the top, after a real spend, lands with a glint along the bar.
    this.staminaFloor = Math.min(this.staminaFloor, stamina);
    if (stamina >= .999) {
      if (this.staminaFloor < .9 && typeof this.glint.animate === 'function') this.glint.animate([{ transform: 'translateX(-110%)' }, { transform: 'translateX(300%)' }], { duration: 550, delay: 750, easing: 'ease-out' });
      this.staminaFloor = 1;
    }
    this.foeUpdate(target);
  }

  private foeUpdate(target: PlayerState | undefined) {
    const shown = target ? '1' : '0';
    if (this.foe.style.opacity !== shown) this.foe.style.opacity = shown;
    if (!target) return;
    if (target.id !== this.foeId) { this.foeId = target.id; this.foeHp.snap(); this.foeStamina.snap(); }
    if (target.fighter !== this.foeFighter) {
      this.foeFighter = target.fighter;
      const name = FIGHTERS[target.fighter]?.name ?? target.fighter;
      setText(this.foeName, name.toUpperCase()); nameSize(this.foe, name, 10, 13);
      this.root.querySelector('#foe-portrait')!.innerHTML = mangaPortrait(target.fighter);
    }
    const maxHp = target.maxHp || 1;
    this.foeHp.set(target.hp / maxHp);
    setText(this.foeNum, String(Math.max(0, Math.ceil(target.hp)))); setText(this.foeMax, `/${target.maxHp}`);
    this.flag(this.foe, 'ik-hplow', target.hp > 0 && target.hp / maxHp < .2); this.flag(this.foe, 'ik-down', target.hp <= 0);
    // A duel's rival plate shows their stamina too (SPEC 5.3); elsewhere the row is not drawn, so it is not written.
    if (this.root.dataset.hud === 'duel') {
      const stamina = target.stamina / (target.maxStamina ?? 100);
      this.foeStamina.set(stamina); this.flag(this.foe, 'ik-low', stamina < .25);
    }
  }
  /** A class, written only when it turns. */
  private flag(plate: HTMLElement, name: string, on: boolean) {
    const key = plate === this.own ? `own:${name}` : `foe:${name}`;
    if (this.flags.get(key) === on) return;
    this.flags.set(key, on); plate.classList.toggle(name, on);
  }

  /** The combo, every HUD tick: shown from the second hit of a string, its count and the string's damage. */
  comboTick(combo: number) {
    const on = combo >= 2;
    if (on !== !this.combo.classList.contains('hidden')) this.combo.classList.toggle('hidden', !on);
    if (!on) { if (this.shownCombo >= 10) delete this.combo.dataset.wide; this.shownCombo = 0; return; }
    if (combo !== this.shownCombo) {
      setText(this.comboCount, String(combo));
      // Every hit of a string shakes the count (Web Animations: no reflow to restart it).
      if (this.shownCombo && combo > this.shownCombo && typeof this.comboCount.animate === 'function')
        this.comboCount.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(3px,-2px)' }, { transform: 'translate(0,0)' }], { duration: 220, easing: 'steps(2,end)', iterations: 2 });
      const wide = combo >= 10;
      if (wide !== (this.shownCombo >= 10)) { if (wide) this.combo.dataset.wide = ''; else delete this.combo.dataset.wide; }
      this.shownCombo = combo;
    }
    const damage = Math.round(this.damage);
    if (damage !== this.shownDamage) { this.shownDamage = damage; setText(this.comboDamage, String(damage)); }
    if (this.style !== this.shownStyle) {
      this.shownStyle = this.style; this.comboStyle.hidden = this.style <= 1;
      setText(this.comboStyle.querySelector('b')!, `×${this.style.toFixed(1)}`);
    }
  }
  /** Each combat event, once (ModeHudHost's listeners): the player's own blows add up into the string's damage. */
  event(event: CombatEvent) {
    if (event.kind !== 'hit' || !this.selfId || event.actorId !== this.selfId || !event.targetId || event.targetId === this.selfId) return;
    const damage = event.damage ?? 0, at = event.serverTime;
    if (event.combo === undefined) { if (at - this.stringAt <= STRING_GRACE) this.damage += damage; }
    else if (event.combo <= 1) { this.damage = damage; this.style = 1; }
    else this.damage += damage;
    if (event.style && event.style > this.style) this.style = event.style;
    this.stringAt = at;
  }

  /** The ultimate's state, every HUD tick: once it is ready, ULTIMATE READY sweeps in over the cards for a moment, and
   *  while it is up the R card pulses and its READY ring runs fast (SPEC 5.5, 5.7). */
  ultimateTick(ready: boolean, card: HTMLElement, now: number) {
    if (ready && !this.ultReady) {
      setText(this.ultKey, card.querySelector('kbd')?.textContent ?? 'R');
      setText(this.ultName, card.querySelector('.ik-cap')?.textContent ?? '');
      this.ult.classList.add('ik-on'); card.classList.add('ik-fresh'); this.ultUntil = now + READY_MS;
    }
    if ((!ready || now > this.ultUntil) && this.ult.classList.contains('ik-on')) { this.ult.classList.remove('ik-on'); card.classList.remove('ik-fresh'); }
    this.ultReady = ready;
  }
}

/** A card cooling down: the share of its cooldown already done (0..1), from the longest wait seen since it started. */
export class CooldownShare {
  private total = 0;
  of(remaining: number) {
    if (remaining <= .1) { this.total = 0; return 1; }
    if (remaining > this.total) this.total = remaining;
    return 1 - remaining / this.total;
  }
}

/** A fighter's face, the head the home screen shows (MangaHome's portrait: a window on the home sheet, or a Vol. 2
 *  portrait), cut out as a sticker `width` px wide with a paper margin and an ink rim, for the edge markers; cached for
 *  the session, and made in idle time. Undefined where it cannot be cut. */
const faces = new Map<string, Promise<{ url: string; aspect: number } | undefined>>();
export function faceSticker(fighter: FighterId, width = 66): Promise<{ url: string; aspect: number } | undefined> {
  const key = `${fighter}@${width}`;
  let job = faces.get(key);
  if (!job) {
    job = new Promise<{ url: string; aspect: number } | undefined>(resolve => whenIdle(() => {
      // The portrait's own markup says which image and which window of it (no second table to keep in step).
      const svg = mangaPortrait(fighter), box = /viewBox="([\d. ]+)"/.exec(svg)?.[1].split(' ').map(Number), href = /href="([^"]+)"/.exec(svg)?.[1];
      const declared = /width="([\d.]+)" height="([\d.]+)"/.exec(svg);
      if (!box || box.length !== 4 || !href || !declared) { resolve(undefined); return; }
      const img = new Image(); img.decoding = 'async'; img.src = href;
      img.decode().then(() => {
        const kx = img.naturalWidth / +declared[1], ky = img.naturalHeight / +declared[2];
        const crop = [box[0] * kx, box[1] * ky, box[2] * kx, box[3] * ky] as const, q = 2;
        return cutout(href, { crop, scale: width * q / crop[2], margin: 2 * q, rim: 3 * q, lum: 228 });
      }).then(c => resolve(c ? { url: c.url, aspect: c.width / c.height } : undefined), () => resolve(undefined));
    }));
    faces.set(key, job);
  }
  return job;
}
