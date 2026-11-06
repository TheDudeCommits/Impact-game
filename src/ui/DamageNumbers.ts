import * as THREE from 'three';
import { viewHeight, viewWidth } from './viewport';
import { inkSplats } from './inkSplat';
import './inkNumbers.css';

/** How long a number holds after the last blow it counts, how long it takes
 *  to fade after that, and the punch it lands on. A number that hangs for most
 *  of a second at the world point where the hit happened is a number still
 *  floating there while its victim is being carried across the room. */
const HOLD = .42, FADE = .28, PUNCH = .09, LIFT = .35;
/** Blows on one body this close together are one count: a barrage used to
 *  print 25, 23 and 21 on top of each other and of the lettering. */
const MERGE = .7;
/** How long the count takes to tick up to a new total. */
const TICK = .14;
/** Every blow stamps the splat again: half as big again and twisted a few
 *  degrees, landing back on its own size and turn over this long. */
const POP = .09;
/** A count of 200 or more throws droplets off its splat with every blow: how
 *  many, and how long they fly. */
const DROPS = 5, FLIGHT = .34;
/** The ink, from chip damage's oxblood to a heavy count's crimson, and the
 *  offset of the black under it (a misregistered print), in the splat's units. */
const OXBLOOD = [102, 8, 20], CRIMSON = [228, 18, 44], SHADE = [2.4, 3];

type Counter = { element: HTMLDivElement; position: THREE.Vector3; born: number; last: number; active: boolean;
  follow?: () => THREE.Vector3 | undefined; id?: string; total: number; from: number; size: number; heavy: boolean; printed: number;
  /** An area strike found its body in the circle's bullseye (round 3): printed bigger, under a BULLSEYE tag. */
  bull: boolean;
  /** Centered authored effects can keep their face clear while the count follows beside them. */
  beside: boolean;
  /** Where it would print on screen this frame, its width there, and where it
   *  does print after the counts around it have made room (see SPREAD). */
  x: number; y: number; width: number; shown: number; placed: boolean;
  /** The parts: the splat (its two paths: the ink and its printed shadow), the
   *  flung droplets and the numerals. A bare element (the tests' stand-in
   *  document builds no children) has none and prints its count on itself. */
  splat?: SVGSVGElement; ink?: SVGPathElement; shade?: SVGPathElement; drops: HTMLElement[]; digits?: HTMLElement;
  /** The splat's width on screen, its turn and mirroring, and this blow's extra twist. */
  across: number; spin: number; flip: number; twist: number;
  /** The droplets in flight: per drop its heading (x, y), reach (a share of the
   *  splat's width) and angle; and whether any are still flying. */
  flung: Float32Array; flying: boolean };
/** Round 3b (HITFEEL): counts that would print over each other - an
 *  ultimate across a crowd lands one on each body, and three bodies in a line
 *  down the lens put three numbers on one spot - stack instead, each pushed
 *  clear above the one it would cover (the older stays put), and eased there
 *  so a moving crowd does not shuffle them. How much of a line a number's own
 *  height it keeps clear, and how fast it eases, per second. */
const SPREAD = 1.02, SPREAD_EASE = 18;

/** Damage as one counter per struck body, riding above its head and ticking
 *  up as a string of blows lands, rather than a number per hit: white numerals
 *  in heavy ink on a red ink splat that grows and reddens with the count. */
export class DamageNumbers {
  private pool: Counter[] = [];
  private scratch = new THREE.Vector3();
  constructor(parent: HTMLElement) {
    for (let i = 0; i < 16; i++) {
      const element = document.createElement('div');
      element.className = 'ink-count';
      Object.assign(element.style, { display: 'none', pointerEvents: 'none' });
      element.innerHTML = `<svg class="ink-splat" viewBox="-50 -50 100 100" aria-hidden="true"><path class="ink-shade"/><path class="ink-body"/></svg>${'<i class="ink-drop"></i>'.repeat(DROPS)}<b class="ink-digits"></b>`;
      const parts = element.children as HTMLCollection | undefined, splat = parts?.[0] as SVGSVGElement | undefined;
      parent.append(element);
      this.pool.push({ element, position: new THREE.Vector3(), born: 0, last: 0, active: false, total: 0, from: 0, size: 32, heavy: false, bull: false, beside: false, printed: -1, x: 0, y: 0, width: 0, shown: 0, placed: false,
        splat, shade: splat?.children[0] as SVGPathElement | undefined, ink: splat?.children[1] as SVGPathElement | undefined,
        drops: parts ? [...parts].slice(1, 1 + DROPS) as HTMLElement[] : [], digits: parts?.[1 + DROPS] as HTMLElement | undefined,
        across: 96, spin: 0, flip: 1, twist: 0, flung: new Float32Array(DROPS * 4), flying: false });
    }
  }
  /** `follow` is the body the number belongs to, read every frame: a launched
   *  fighter takes their damage with them. `id` is that body: blows on it in
   *  quick succession add to one count instead of stacking numbers. `bullseye`: an area strike dead centre. */
  show(damage: number, position: THREE.Vector3, heavy: boolean, follow?: () => THREE.Vector3 | undefined, id?: string, bullseye = false, beside = false) {
    const now = performance.now() / 1000;
    let n = id ? this.pool.find(p => p.active && p.id === id && now - p.last < MERGE) : undefined;
    if (n) { n.from = this.shown(n, now); n.total += damage; n.last = now; n.heavy ||= heavy; n.bull ||= bullseye; n.beside ||= beside; }
    else {
      n = this.pool.find(p => !p.active) ?? this.pool.reduce((a, b) => a.last <= b.last ? a : b);
      n.active = true; n.born = n.last = now; n.position.copy(position); n.follow = follow; n.id = id; n.total = damage; n.from = damage; n.heavy = heavy; n.bull = bullseye; n.beside = beside; n.printed = -1; n.placed = false;
      n.element.style.display = 'block';
      // A fresh splat: one of the shapes, mirrored or not, turned a little
      // either way (no further: its drips run down the page).
      const shapes = inkSplats(), shape = shapes[Math.floor(Math.random() * shapes.length)];
      n.ink?.setAttribute('d', shape); n.shade?.setAttribute('d', shape);
      n.spin = (Math.random() * 2 - 1) * 32; n.flip = Math.random() < .5 ? -1 : 1;
      // Its printed shadow falls down and to the right on the page however
      // the shape is turned: the offset is turned back into the shape's frame.
      const back = -n.spin * Math.PI / 180, sx = SHADE[0] * Math.cos(back) - SHADE[1] * Math.sin(back), sy = SHADE[0] * Math.sin(back) + SHADE[1] * Math.cos(back);
      n.shade?.setAttribute('transform', `translate(${(sx * n.flip).toFixed(2)} ${sy.toFixed(2)})`);
      if (n.flying) this.land(n);
    }
    // Every blow stamps it again, twisted a few degrees one way or the other.
    n.twist = (Math.random() < .5 ? -1 : 1) * (3 + Math.random() * 4);
    // Sized by what the count is worth, not by which button threw the last
    // blow: a two-hundred-point string should not print like a thirty-point tick.
    const big = n.total >= 200, small = Math.min(1, Math.max(.62, Math.min(viewWidth(), viewHeight() * 16 / 9) / 1280));
    n.size = Math.round((big ? 54 : n.heavy ? 42 : n.total >= 80 ? 38 : 32) * small * (n.bull ? 1.2 : 1));
    n.element.toggleAttribute?.('data-bull', n.bull);
    // The splat grows and reddens with the total: a chip is a small dark spot,
    // a heavy count a wide crimson one; at 200 it throws droplets as well.
    // The body (a little over half the splat's box) covers the numerals, and more.
    const worth = Math.min(1, Math.max(0, (n.total - 12) / 188)), heat = big ? 1 : Math.max(worth, n.heavy ? .58 : 0);
    n.across = Math.round(Math.max(n.size * (.3 + .55 * String(Math.round(n.total)).length), n.size * 1.45) * (1 + .3 * worth) / .54);
    const ink = OXBLOOD.map((dark, i) => Math.round(dark + (CRIMSON[i] - dark) * heat));
    n.element.style.color = `rgb(${ink[0]},${ink[1]},${ink[2]})`;
    n.element.style.fontSize = `${n.size}px`;
    if (n.splat) n.splat.style.width = n.splat.style.height = `${n.across}px`;
    if (big && n.digits) this.fling(n);
  }
  /** The count on screen: rolling up to the total over a few frames. */
  private shown(n: Counter, now: number) { const k = Math.min(1, (now - n.last) / TICK); return Math.round(n.from + (n.total - n.from) * (1 - (1 - k) * (1 - k))); }
  update(camera: THREE.Camera, dt = 1 / 60) {
    const now = performance.now() / 1000;
    let count = 0;
    for (const n of this.pool) {
      if (!n.active) continue;
      const since = now - n.last;
      if (since > HOLD + FADE) { n.active = false; n.follow = undefined; n.id = undefined; n.element.style.display = 'none'; if (n.flying) this.land(n); continue; }
      const anchor = n.follow?.();
      // Above the head of the body it belongs to - the anchor is its drawn
      // centre, at the hips - clear of the spark on the body and of the
      // lettering beside it.
      if (anchor) n.position.copy(anchor).setY(anchor.y + .25);
      const p = this.scratch.copy(n.position);
      p.y += .9 + Math.min(1, (now - n.born) / .5) * LIFT;
      p.project(camera);
      n.x = (p.x * .5 + .5) * viewWidth();
      if (n.beside) {
        const margin = Math.min(viewWidth() * .3, n.across * .55);
        const offset = n.across * .65 + Math.min(viewWidth(), viewHeight() * 16 / 9) * .035;
        const side = n.x + offset + margin < viewWidth() ? 1 : -1;
        n.x = Math.max(margin, Math.min(viewWidth() - margin, n.x + side * offset));
      }
      // Never up under the portrait bars or through the move-name banner,
      // which sits at 23% of the height.
      n.y = Math.max(viewHeight() * .27 + n.size * .5, (-p.y * .5 + .5) * viewHeight());
      const shown = this.shown(n, now);
      if (shown !== n.printed) { n.printed = shown; (n.digits ?? n.element).textContent = String(shown); }
      // Condensed digits are a little over half an em wide.
      n.width = n.size * (.3 + .55 * String(shown).length);
      this.order[count++] = n;
      n.element.style.visibility = p.z > 1 ? 'hidden' : 'visible';
    }
    // Oldest first: the count that was there first keeps its place, and one
    // that would print over it moves up clear of it (see SPREAD).
    const order = this.order;
    for (let i = 1; i < count; i++) { const n = order[i]; let j = i - 1; while (j >= 0 && order[j].born > n.born) { order[j + 1] = order[j]; j--; } order[j + 1] = n; }
    for (let i = 0; i < count; i++) {
      const n = order[i], top = viewHeight() * .27 + n.size * .5;
      // Up clear of whatever it would print over; below it instead where
      // going up would take it into the banner.
      let y = this.clearOf(order, i, n.y, -1);
      if (y < top) y = this.clearOf(order, i, n.y, 1);
      n.shown = n.placed ? n.shown + (y - n.shown) * (1 - Math.exp(-dt * SPREAD_EASE)) : y;
      n.placed = true;
      n.element.style.left = `${n.x}px`;
      n.element.style.top = `${n.shown}px`;
    }
    for (let i = 0; i < count; i++) this.stamp(order[i], now - order[i].last);
  }
  /** One count's look this frame: transforms and opacity only. */
  private stamp(n: Counter, since: number) {
    if (!n.digits || !n.splat) return;
    const fade = since < HOLD ? 0 : Math.min(1, (since - HOLD) / FADE), alpha = (1 - fade).toFixed(3);
    // Every blow that adds to the count punches it again.
    const punch = since < PUNCH ? 1.4 - .4 * (since / PUNCH) : 1;
    n.digits.style.opacity = alpha;
    n.digits.style.transform = `translate(-50%,-50%) scale(${punch.toFixed(3)})`;
    // The splat lands from half as big again, turning back into place, and
    // shrinks a little as it fades.
    const land = since < POP ? 1 - since / POP : 0, ease = land * land, scale = (1 + .5 * ease) * (1 - .16 * fade);
    n.splat.style.opacity = alpha;
    n.splat.style.transform = `translate(-50%,-50%) rotate(${(n.spin + n.twist * ease).toFixed(2)}deg) scale(${(scale * n.flip).toFixed(3)},${scale.toFixed(3)})`;
    if (n.flying) this.fly(n, since);
  }
  /** Droplets off a 200-point splat: a new spray with every blow. */
  private fling(n: Counter) {
    const from = Math.random() * Math.PI * 2;
    for (let i = 0; i < DROPS; i++) {
      const a = from + (i + Math.random() * .7) / DROPS * Math.PI * 2;
      n.flung.set([Math.cos(a), Math.sin(a), .42 + Math.random() * .3, a * 180 / Math.PI], i * 4);
    }
    n.flying = true;
  }
  /** The droplets out from under the splat, slowing, falling a little and shrinking away. */
  private fly(n: Counter, since: number) {
    const k = Math.min(1, since / FLIGHT), out = 1 - (1 - k) ** 3;
    if (k >= 1) { this.land(n); return; }
    for (let i = 0; i < n.drops.length; i++) {
      const f = n.flung, r = n.across * (.2 + f[i * 4 + 2] * out);
      const s = n.drops[i].style;
      s.opacity = (1 - k * k).toFixed(3);
      s.transform = `translate(${(f[i * 4] * r).toFixed(1)}px,${(f[i * 4 + 1] * r + n.size * .4 * k * k).toFixed(1)}px) rotate(${f[i * 4 + 3].toFixed(1)}deg) scale(${(1.15 - .65 * k).toFixed(3)})`;
    }
  }
  private land(n: Counter) { n.flying = false; for (const drop of n.drops) drop.style.opacity = '0'; }
  /** The live counts, in the order they are placed; reused every frame. */
  private order: Counter[] = [];
  /** Where the i-th count may print, starting from `y` and stepping `way`
   *  (-1 up the screen, 1 down it) past every count placed before it that it
   *  would cover. */
  private clearOf(order: Counter[], i: number, y: number, way: number) {
    const n = order[i];
    for (let pass = 0; pass <= i; pass++) {
      let moved = false;
      for (let j = 0; j < i; j++) {
        const m = order[j], clear = (m.size + n.size) * .5 * SPREAD;
        if (Math.abs(m.x - n.x) < (m.width + n.width) * .5 && Math.abs(m.shown - y) < clear) { y = m.shown + way * clear; moved = true; }
      }
      if (!moved) break;
    }
    return y;
  }
}
