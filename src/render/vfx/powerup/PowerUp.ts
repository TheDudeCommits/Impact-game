import * as THREE from 'three';
import type { Fighter } from '../../Fighter';
import type { VfxKit } from '../VfxKit';
import { SPRITE, ORIENT } from '../SparkField';
import { MARK } from '../GroundMarks';
import { ElectricKit } from '../../signature/ElectricKit';
import { STAR, GLOW } from '../../signature/GlowBatch';
import { KiAura, kiColours, SHEETS, type KiColours } from './KiAura';
import { AuraBurst, BURST } from './AuraBurst';
import { WillBolts, WILL, willEdge } from './WillBolts';
import type { PowerKind } from '../../awakenedPower';
import { emitMote, MOTE_EVERY, type MoteKind } from './Motes';
import { SIGNATURE } from '../../signature/context';

export const POWER = {
  /** Metres: the flame's height at the top of a power-up, for an ordinary fighter. */
  peak: 3.5,
  /** Metres: how tall a column of pressure stands at the top of its release, and its width over that height. */
  column: 6.2, slim: .3,
  /** How far out the ki crackles while the form lasts, as a share of the peak: the flame itself is gone by then. */
  burn: .4,
  /** Seconds after the entry the flame takes to come down and go out. */
  settle: .85,
} as const;

export type { PowerKind };
/** A fighter's Will: the glow round its black lightning and the deep light it throws on the floor, that colour as a
 *  hex for the shared kit's rings and cracks, and how much of it there is - a sovereign's is 1, the full crackle, the
 *  floor and the haze; a fighter with only the other two colours crackles thinner and more rarely (awakenedPower.ts). */
export interface WillStyle { glow: THREE.Color; deep: THREE.Color; hex: number; level: number }
/** How a transformation's power looks: its kind, the flame's colours, the ki lightning's colour, whether the ki
 *  crackles while it burns, its Will where that is its kind, and what comes off the body besides (Motes.ts), in which
 *  two colours. */
export interface PowerStyle { kind: PowerKind; colours: KiColours; bolt: THREE.Color; electric: boolean; will?: WillStyle; motes?: { kind: MoteKind; core: number; rim: number };
  /** The colour its light, its rings and its streaks are (sRGB hex), their dark end, and how much of what is behind
   *  them the streaks cover: the power's own colour, or its edge's where the power itself is black (Nigo's). */
  tint?: number; shade?: number; cover?: number;
  /** Lightning worn on the body itself for as long as it lasts, in `bolt`'s colour: Ampere's full-body lightning. */
  arcs?: boolean }
/** A pressure's colours as a flame's are given (KiAura): the edge it burns at, its body, its heart. A coloured one is
 *  drawn as written - its body the colour at full strength, its edge that colour toward white. A black one (its core
 *  under a twentieth as bright as white) keeps its black for the body and the heart and burns at its rim's colour. */
export function pressureColours(coreHex: number, rimHex: number): KiColours {
  const out = kiColours(coreHex, rimHex);
  if (darkHex(coreHex)) { out.core.setHex(coreHex); out.deep.setHex(coreHex); out.hot.setHex(rimHex).multiplyScalar(1.25); out.hotness = 1.5; }
  return out;
}
const darkHex = (hex: number) => ((hex >> 16 & 255) * .3 + (hex >> 8 & 255) * .59 + (hex & 255) * .11) < 28;
/** What a power's light and rings are coloured, from its [core, rim]: see PowerStyle.tint. */
export function powerTint(coreHex: number, rimHex: number) {
  const dark = darkHex(coreHex);
  return { tint: dark ? rimHex : coreHex, shade: dark ? coreHex : rimHex, cover: dark ? .75 : .3 };
}
/** `edge` (sRGB hex) as a fighter's Will, a sovereign's or not. */
export function willStyle(edge: number | undefined, sovereign: boolean): WillStyle {
  const colours = edge === undefined ? WILL : willEdge(edge);
  return { glow: colours.glow, deep: colours.deep, hex: edge ?? 0xff2a3a, level: sovereign ? 1 : .6 };
}
const hue = new THREE.Color(), hsl = { h: 0, s: 0, l: 0 };
/** Lightning that sets off a ki flame: a blue flame throws pink-white bolts, a gold awakening's gold the
 *  classic blue-white. */
export function boltFor(coreHex: number, out = new THREE.Color()) {
  hue.setHex(coreHex).getHSL(hsl);
  if (hsl.s < .15) return out.setRGB(.7, .85, 2.2);
  const h = hsl.h * 360;
  if (h >= 165 && h < 300) return out.setRGB(1.9, .38, 1.5);
  if (h >= 30 && h < 165) return out.setRGB(.42, .8, 2.4);
  return out.setRGB(2.2, .55, .9);
}

interface Entry {
  id: string; born: number; swap: number; entry: number; burst: boolean; lifted: boolean; cracked: boolean; rung: number;
  style: PowerStyle; seed: number; local: boolean; flames: boolean; scale: number;
  /** The power alone, over an arrival drawn by the fighter's own layer: no floor lifted, no crack, no dark. */
  bare: boolean;
}
/** What a running transformation burns as, and how strongly. */
export interface Burning { style: PowerStyle; scale: number; strength: number; local: boolean }
interface Burn { flareUntil: number; lastStart: number; nextCrackle: number; crackleUntil: number; seed: number; nextHaze: number; nextMote: number; nextRing: number }
interface Glint { x: number; y: number; z: number; born: number; life: number; size: number; streak: boolean }

const ease = (t: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(t, 0, 1), 3);
const FLARES: ReadonlySet<string> = new Set(['light', 'heavy', 'special', 'ultimate', 'dash']);
const TAU = Math.PI * 2;
/** The joints Will crawls between and leaps off while it stands on a fighter (the canonical names, skeleton.ts). */
const WILL_JOINTS = ['Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand', 'Spine2', 'Hips', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot'] as const;
/** Hex Energy's sparks, as a Dark Spark throws them: black, edged in red, and short - a fighter's, not a king's. */
const CURSED_SPARK: WillStyle = { glow: new THREE.Color(1.7, .1, .16), deep: new THREE.Color(.4, .02, .05), hex: 0xff2a3a, level: .6 };
/** The dark of Will's haze: a deep wine where the light falls on it, near black in its shadow. */
const HAZE_LIT = 0x3a0c1c, HAZE_SHADE = 0x07030a;

export class PowerUp {
  readonly ki: KiAura;
  private burst: AuraBurst;
  private electric: ElectricKit;
  private will: WillBolts;
  private entries = new Map<string, Entry>();
  private burns = new Map<Fighter, Burn>();
  /** Who is mid-entrance this frame (their burn waits for it to settle). Cleared and refilled each frame. */
  private entering = new Set<Fighter>();
  private glints: Glint[] = [];
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3();
  private right = new THREE.Vector3();
  private tint = new THREE.Color();
  private eye = new THREE.Vector3();
  private tick = 0;
  constructor(scene: THREE.Scene, private kit: VfxKit) {
    this.ki = new KiAura(scene);
    this.burst = new AuraBurst(scene);
    this.electric = new ElectricKit(scene, 'power-up-electric', 1600);
    this.will = new WillBolts(scene);
  }

  /** A transformation began for `actor`: `swap` seconds into an `entry` of the given length its form changes. `bare`:
   *  the fighter's own layer draws the arrival (Sorayomi's gathering weather), and only the power itself is added to it. */
  begin(actor: Fighter, time: number, swap: number, entry: number, style: PowerStyle, flames: boolean, scale: number, local: boolean, bare = false) {
    const id = actor.state.id;
    this.entries.set(id, { id, born: time, swap, entry, burst: false, lifted: bare, cracked: bare, rung: 0, style, seed: hashSeed(id), local, flames, scale, bare });
  }

  /** The swap: AwakeningEffects calls it on the frame the form changes. */
  break(actor: Fighter, time: number) {
    const e = this.entries.get(actor.state.id);
    if (!e || e.burst) return;
    e.burst = true;
    const p = actor.group.position, s = e.style, kit = this.kit;
    kit.debris.blast(p.x, p.y, p.z, 4.5 * e.scale, s.kind === 'will' ? 9 : 7.5);
    kit.dustRing(p.x, p.y, p.z, kit.n(14, 6), .7, 6.5 * e.scale, .7, time, .55);
    if (s.kind === 'ki') {
      this.burst.fire(p, time, s.colours.hot, s.colours.core, s.colours.deep, e.scale, actor.group);
      // Glints over the flame, and one long streak across the lens through the brightest.
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2, r = .6 + Math.random() * 1.1;
        this.glints.push({ x: p.x + Math.cos(a) * r, y: p.y + 1.2 + Math.random() * 1.8 * e.scale, z: p.z + Math.sin(a) * r, born: time + i * .05, life: .32, size: .7 + Math.random() * .5, streak: i === 0 });
      }
    } else if (s.kind === 'pressure') {
      // The pillar into the sky and the wind of it, and its weight going out along the floor in two waves.
      this.burst.fire(p, time, s.colours.hot, s.colours.core, s.colours.deep, e.scale, actor.group, BURST.pillar | BURST.vortex);
      const tint = s.tint ?? 0xffffff, shade = s.shade ?? 0x202028;
      kit.ring(p.x, p.y + .08, p.z, .5, 8.5 * e.scale, time, .5, tint, shade, .14, 'flat');
      kit.ring(p.x, p.y + .08, p.z, .4, 5.5 * e.scale, time + .09, .45, tint, shade, .1, 'flat');
    } else if (s.kind === 'chi' || s.kind === 'aura' || s.kind === 'cursed') {
      // Chi's wind flung round and out; Aura and hex energy go out along the floor, a ring of their colour.
      const tint = s.tint ?? 0xffffff, shade = s.shade ?? 0x202028;
      // (Three quarters of a ki burst's reach: round a Guardian's user, half again as big, its ribbons filled the frame.)
      if (s.kind === 'chi') this.burst.fire(p, time, s.colours.hot, s.colours.core, s.colours.deep, Math.min(1, e.scale) * .75, actor.group, BURST.vortex);
      kit.ring(p.x, p.y + .08, p.z, .5, 7.5 * e.scale, time, .5, tint, shade, .14, 'flat');
      if (s.kind === 'cursed') this.willCrackle(actor, e.seed, 1, e.scale, 6, true, CURSED_SPARK);
    } else if (s.kind === 'will') {
      // The pressure: a crimson wave through the air and another along the floor.
      const hex = s.will?.hex ?? 0xff2a3a;
      kit.ring(p.x, p.y + 1.1, p.z, .5, 9 * e.scale, time, .5, hex, 0x14020a, .1);
      kit.ring(p.x, p.y + .2, p.z, .4, 7 * e.scale, time + .05, .45, hex, 0x0c0206, .07);
    }
  }

  /** The fighter's transformation is over (a reset, a knockout): forget it at once. */
  end(id: string) { this.entries.delete(id); }

  update(time: number, dt: number, fighters: ReadonlyMap<string, Fighter>, camera: THREE.Camera | undefined, density: number,
    burning: (f: Fighter) => Burning | null) {
    const d = Math.max(.35, density);
    this.ki.begin(time, camera);
    this.electric.begin(time, density);
    this.will.begin();
    this.tick = Math.floor(time * 24);
    if (camera) { camera.getWorldPosition(this.eye); this.right.setFromMatrixColumn(camera.matrixWorld, 0); }
    const entering = this.entering; entering.clear();
    for (const [id, e] of this.entries) {
      const actor = fighters.get(id);
      const inEntry = actor?.state.action === 'awaken';
      const elapsed = actor && inEntry ? actor.state.actionTime * actor.state.actionDuration : time - e.born;
      if (!actor || !actor.state.alive || elapsed > e.entry + POWER.settle || elapsed < -.5) { this.entries.delete(id); continue; }
      entering.add(actor);
      this.entry(actor, e, time, elapsed, d);
    }
    // The burn of every transformation already running, and the entries' settle into it.
    for (const fighter of fighters.values()) {
      if (entering.has(fighter)) continue;
      const burn = burning(fighter);
      if (!burn) { this.burns.delete(fighter); continue; }
      this.sustain(fighter, burn, time, d);
    }
    if (import.meta.env?.DEV) this.preview(fighters);
    this.drawGlints(time);
    this.burst.update(time, dt, camera ? this.eye : undefined);
    this.ki.end();
    this.electric.end();
    this.will.end();
  }

  private entry(actor: Fighter, e: Entry, time: number, elapsed: number, d: number) {
    const kit = this.kit, p = actor.group.position, s = e.style;
    const floor = p.y, gather = elapsed < e.swap, u = elapsed / Math.max(.05, e.swap);
    if (!e.lifted) {
      e.lifted = true;
      // The floor comes apart under them and hangs in the air until the break throws it.
      kit.debris.lift(kit.n(s.kind === 'plain' ? 10 : 16, 5), p.x, p.z, .7 * e.scale, 2.6 * e.scale, .12, floor, 2.4, 1.5);
    }
    if (!e.cracked && elapsed > .06 && kit.quality !== 'low') {
      e.cracked = true;
      kit.marks.mark(MARK.crack, p.x, floor, p.z, 0, 1, 0, 3.4 * e.scale, time, 3.6, s.kind === 'will' ? s.will?.hex ?? 0xff1f30 : s.tint ?? colourHex(s.colours.core), s.kind === 'plain' ? .6 : 1.4);
    }
    // The place goes dark round the player's own power-up (and dimmer round one near them), the power the brightest
    // thing in the frame; it comes back as it settles.
    const own = s.kind === 'plain' ? .6 : .85;
    const night = (e.local ? own : own * .45 * (1 - THREE.MathUtils.smoothstep(this.eye.distanceTo(p), 7, 12)))
      * (gather ? ease(u * 1.4) : 1 - THREE.MathUtils.smoothstep(elapsed, e.swap + .25, e.entry + POWER.settle * .7));
    if (night > .01 && !e.bare) SIGNATURE.screen?.powerDim?.(night);
    const after = gather ? 0 : elapsed - e.swap;
    if (s.kind === 'ki') this.kiEntry(actor, e, time, elapsed, d);
    else if (s.kind === 'pressure') this.pressureEntry(actor, e, time, elapsed, d);
    else if (s.kind === 'chi' || s.kind === 'aura') this.windEntry(actor, e, time, elapsed, d, s.kind === 'chi');
    else if (s.kind === 'cursed') this.cursedEntry(actor, e, time, elapsed, d);
    // (Lightning worn on the body gathers with the power, whatever its kind: full-body lightning coming up.)
    if (s.arcs) this.arcSkin(actor, e.seed, gather ? .4 + .6 * u : Math.max(0, 1 - after / .5), e.scale, 4, s.bolt);
    if (s.kind === 'will') {
      // Black lightning round them and down into the floor, thickening to the break and discharging after it.
      const power = gather ? .5 + .5 * u : Math.max(0, 1 - after / .7);
      this.willCrackle(actor, e.seed, power, e.scale, Math.round((2 + 5 * power) * d), true, s.will);
      this.willSkin(actor, e.seed, power, e.scale, 3, s.will);
      // The dark of it lifting off them as it gathers, thrown outward on the break.
      if (kit.quality !== 'low' && Math.random() < (gather ? .5 : .8 * power) * d) this.willHaze(actor, time, e.scale, gather ? .7 : 1, gather ? 0 : 2.2 * power);
    }
  }

  /** Pressure released: the column standing up out of the floor through the gather, a third as wide as it is tall, and
   *  coming down after the break (whose pillar and wind are `break`'s). Streaks race up it; the floor rings under it. */
  private pressureEntry(actor: Fighter, e: Entry, time: number, elapsed: number, d: number) {
    const kit = this.kit, p = actor.group.position, s = e.style, tall = POWER.column * e.scale;
    const tint = s.tint ?? 0xffffff, shade = s.shade ?? 0x202028;
    let size: number, strength: number, flare: number, clear = 0;
    if (elapsed < e.swap) {
      const u = elapsed / Math.max(.05, e.swap);
      size = tall * (.3 + .7 * ease(u)); strength = Math.min(1, elapsed / .06); flare = 1;
      // Its weight going out along the floor as it builds: a ring a quarter of the way in and another at three.
      const rung = u < .25 ? 0 : u < .7 ? 1 : 2;
      if (rung > e.rung) { e.rung = rung; kit.ring(p.x, p.y + .06, p.z, .3, (3.2 + 1.6 * rung) * e.scale, time, .42, tint, shade, .12, 'flat'); }
    } else {
      const k = elapsed - e.swap, out = e.entry + POWER.settle - e.swap, settle = THREE.MathUtils.smoothstep(k, .22, out);
      size = THREE.MathUtils.lerp(tall * (1 + .22 * Math.exp(-k * 6)), tall * .55, settle);
      strength = 1 - settle; flare = 1 - .5 * settle;
      // The player's own thins to its edge as it goes, so they see the fight through it.
      clear = e.local ? settle : 0;
    }
    // (Behind them and see-through at its heart, with no sheet of it before them: whoever is in it is waking into a
    // new body, and that is the thing to see.)
    this.ki.draw({ x: p.x, y: p.y, z: p.z, size, aspect: POWER.slim, strength, flare, heart: THREE.MathUtils.lerp(.5, .08, clear), body: THREE.MathUtils.lerp(.8, .28, clear),
      colours: s.colours, seed: e.seed, sheets: this.sheets(SHEETS.body | SHEETS.flare) });
    this.c.set(p.x, p.y + .4, p.z);
    this.electric.lights.add(this.c, 3 * e.scale + size * .2, this.tint.setHex(tint), .8 * strength);
    kit.lights.request(p.x, p.y + 2.4, p.z, tint, 5 * strength, 7, e.local ? 3 : 1);
    // Streaks racing up the column.
    for (let i = 0, n = Math.round(2 * d * strength + Math.random()); i < n; i++) {
      const sp = kit.sparks.spec, a = Math.random() * TAU, r = (.15 + Math.random() * .55) * e.scale;
      sp.reset(SPRITE.streak, time, .22 + Math.random() * .2).pos(p.x + Math.cos(a) * r, p.y + Math.random() * size * .45, p.z + Math.sin(a) * r).velocity(0, 9 + Math.random() * 7, 0);
      sp.orient = ORIENT.velocity; sp.sized(.06, .02, .5); sp.stretch = 5; sp.trail = .05; sp.drag = .4; sp.hot(tint, 1.7).cool(shade, s.cover ?? .3); kit.sparks.emit();
    }
  }

  /** Chi gathered, or Aura swelling out: no flame and no column. Chi winds up off the floor round them, streaks
   *  on a rising turn; Aura rises off them straight and soft. Either lights the floor in its colour. */
  private windEntry(actor: Fighter, e: Entry, time: number, elapsed: number, d: number, winds: boolean) {
    const kit = this.kit, p = actor.group.position, s = e.style, tint = s.tint ?? 0xffffff, shade = s.shade ?? 0x202028;
    const power = elapsed < e.swap ? .35 + .65 * ease(elapsed / Math.max(.05, e.swap)) : Math.max(0, 1 - (elapsed - e.swap) / .7);
    if (power < .03) return;
    for (let i = 0, n = Math.round((1 + 3 * power) * d + Math.random() - .5); i < n; i++) {
      const sp = kit.sparks.spec, a = Math.random() * TAU, r = (.4 + Math.random() * .55) * e.scale, turn = winds ? 6 + 4 * power : 0;
      if (winds) {
        sp.reset(SPRITE.streak, time, .2 + Math.random() * .14).pos(p.x + Math.cos(a) * r, p.y + Math.random() * 1.7 * power, p.z + Math.sin(a) * r).velocity(-Math.sin(a) * turn, 1.2 + 2 * power, Math.cos(a) * turn);
        sp.orient = ORIENT.velocity; sp.sized(.045, .016, .5); sp.stretch = 5; sp.trail = .07; sp.drag = .8; sp.hot(tint, 1.15).cool(shade, s.cover ?? .25);
      } else {
        // (Soft and dim: a column of these at full light was a white pillar, and Aura is not light.)
        if (i > 1) continue;
        sp.reset(SPRITE.glow, time, .35 + Math.random() * .2).pos(p.x + Math.cos(a) * r * .8, p.y + .2 + Math.random() * 1.3, p.z + Math.sin(a) * r * .8).velocity(0, 1.6 + 2 * power, 0);
        sp.orient = ORIENT.axial; sp.axis(0, 1, 0); sp.sized(.07, .12, .5); sp.stretch = 3; sp.hot(tint, .32 * power).cool(shade, 0);
      }
      kit.sparks.emit();
    }
    this.c.set(p.x, p.y + .4, p.z);
    this.electric.lights.add(this.c, 3 * e.scale, this.tint.setHex(tint), .7 * power);
    kit.lights.request(p.x, p.y + 2.2, p.z, tint, 4 * power, 6.5, e.local ? 3 : 1);
  }

  /** Hex Energy let out: a dark flame standing up from the floor round them, a body and a half tall - near black,
   *  its colour only at the edge - with red-black sparks cracking in it, and coming down after the swap. */
  private cursedEntry(actor: Fighter, e: Entry, time: number, elapsed: number, d: number) {
    const p = actor.group.position, s = e.style, peak = POWER.peak * .82 * e.scale;
    let size: number, strength: number, power: number, clear = 0;
    if (elapsed < e.swap) { const u = elapsed / Math.max(.05, e.swap); size = peak * (.4 + .6 * ease(u)); strength = Math.min(1, elapsed / .07); power = .5 + .5 * u; }
    else {
      const k = elapsed - e.swap, settle = THREE.MathUtils.smoothstep(k, .2, e.entry + POWER.settle - e.swap);
      size = THREE.MathUtils.lerp(peak * (1 + .15 * Math.exp(-k * 7)), peak * .6, settle); strength = 1 - settle; power = Math.max(0, 1 - k / .6);
      clear = e.local ? settle : 0;
    }
    this.ki.draw({ x: p.x, y: p.y, z: p.z, size, aspect: .8, strength, flare: .8, heart: THREE.MathUtils.lerp(.62, .08, clear), body: THREE.MathUtils.lerp(.88, .28, clear),
      colours: s.colours, seed: e.seed, sheets: this.sheets(SHEETS.body | SHEETS.flare) });
    this.willSkin(actor, e.seed, power * strength, e.scale, 3, CURSED_SPARK);
    this.willCrackle(actor, e.seed, .6 * power * strength, e.scale * .7, Math.round((1 + 3 * power) * d), false, CURSED_SPARK);
    this.c.set(p.x, p.y + .4, p.z);
    this.electric.lights.add(this.c, 2.8 * e.scale, this.tint.setHex(s.tint ?? 0x3a6cff), .7 * strength);
  }

  private kiEntry(actor: Fighter, e: Entry, time: number, elapsed: number, d: number) {
    const kit = this.kit, p = actor.group.position, s = e.style, peak = POWER.peak * e.scale;
    let size: number, strength: number, flare: number, bolts: number, clear = 0;
    if (elapsed < e.swap) {
      const u = elapsed / Math.max(.05, e.swap);
      size = peak * (.4 + .55 * ease(u)); strength = Math.min(1, elapsed / .07); flare = 1; bolts = .45 + .55 * u;
    } else {
      // The flame comes down and goes out: only the transformation itself burns this big.
      const k = elapsed - e.swap, out = e.entry + POWER.settle - e.swap;
      const settle = THREE.MathUtils.smoothstep(k, .3, out);
      size = THREE.MathUtils.lerp(peak * (1 + .2 * Math.exp(-k * 7)), peak * .7, settle);
      strength = 1 - settle; flare = 1 - .6 * settle; bolts = Math.max(0, 1 - k / .8);
      // The player's own thins to its edge as it goes, so they see the fight through it.
      clear = e.local ? settle : 0;
    }
    this.ki.draw({ x: p.x, y: p.y, z: p.z, size, strength, flare, heart: THREE.MathUtils.lerp(.8, .08, clear), body: THREE.MathUtils.lerp(.94, .28, clear),
      colours: s.colours, seed: e.seed, sheets: this.sheets(clear > .99 ? SHEETS.body | SHEETS.flare : SHEETS.all) });
    // The flame lights the floor and everything round it in its colour.
    this.c.set(p.x, p.y + .4, p.z);
    this.electric.lights.add(this.c, 3.2 * e.scale + size * .35, s.colours.core, .9 * strength);
    kit.lights.request(p.x, p.y + 2.4, p.z, colourHex(s.colours.core), 6 * strength, 7, e.local ? 3 : 1);
    // Lightning out of the flame, re-forked on the electric kit's 30 Hz tick.
    this.crackle(actor, e.seed, bolts * strength, size, s.bolt, Math.round((1 + 3 * bolts) * d));
    // Sparkles rising off it.
    if (Math.random() < .55 * d) {
      const sp = kit.sparks.spec, a = Math.random() * Math.PI * 2, r = .3 + Math.random() * size * .32;
      sp.reset(SPRITE.streak, time, .45 + Math.random() * .3).pos(p.x + Math.cos(a) * r, p.y + .1 + Math.random() * size * .5, p.z + Math.sin(a) * r).velocity(0, 2.5 + Math.random() * 3, 0);
      sp.orient = ORIENT.velocity; sp.sized(.035, .015, .5); sp.stretch = 2.5; sp.drag = .8; sp.hot(0xffffff, 2).cool(colourHex(s.colours.core), 0); kit.sparks.emit();
    }
    // A glint now and then while it builds.
    if (elapsed < e.swap && Math.random() < .05) this.glints.push({ x: p.x + (Math.random() - .5) * 2, y: p.y + 1 + Math.random() * 2, z: p.z + (Math.random() - .5) * 2, born: time, life: .2, size: .45, streak: false });
  }

  private sustain(fighter: Fighter, burn: Burning, time: number, d: number) {
    let state = this.burns.get(fighter);
    if (!state) { state = { flareUntil: 0, lastStart: fighter.state.actionStarted, nextCrackle: time + .3, crackleUntil: 0, seed: hashSeed(fighter.state.id), nextHaze: 0, nextMote: 0, nextRing: time + .8 }; this.burns.set(fighter, state); }
    // Every swing and dash flares it.
    if (fighter.state.actionStarted !== state.lastStart) {
      if (FLARES.has(fighter.state.action)) { state.flareUntil = time + .38; if (burn.style.kind === 'will') state.crackleUntil = Math.max(state.crackleUntil, time + .22); }
      state.lastStart = fighter.state.actionStarted;
    }
    const flaring = Math.max(0, (state.flareUntil - time) / .38);
    const p = fighter.group.position, s = burn.style;
    // What comes off the body besides its power: a cursed fruit's own signature over the Will, a sword's element.
    if (s.motes && time >= state.nextMote && burn.strength > .05 && this.kit.quality !== 'low') {
      state.nextMote = time + MOTE_EVERY[s.motes.kind] * (.7 + Math.random() * .6) / d;
      emitMote(this.kit, s.motes.kind, fighter, time, burn.strength, s.motes.core, s.motes.rim);
    }
    if (s.kind === 'will') {
      // Will is not worn as a flame. For as long as it lasts a thread or two of it crawls over the body itself, so the
      // awakening reads at any moment (before, it showed only in its discharges, and a fighter stood bare between
      // them); now and then, and on every swing, it discharges out into the air and down into the floor round them;
      // and its dark lifts off the ground at their feet. A sovereign's is all of that; the rest crackle thinner.
      const will = s.will, level = will?.level ?? 1, strength = burn.strength;
      if (time >= state.nextCrackle) { state.crackleUntil = Math.max(state.crackleUntil, time + .12 + Math.random() * .14); state.nextCrackle = time + (.55 + Math.random() * 1.1) / level; }
      const discharge = time < state.crackleUntil;
      this.willSkin(fighter, state.seed, (discharge ? 1 : .7) * strength, burn.scale, discharge ? 4 : level >= 1 ? 3 : 2, will);
      this.willRise(fighter, state.seed, (discharge ? 1 : .75) * strength, burn.scale, level >= 1 ? 2 : 1, will);
      if (discharge) this.willCrackle(fighter, state.seed, (.6 + .3 * level) * strength, burn.scale, Math.max(2, Math.round((2 + 3 * level) * d)), true, will);
      // On a swing it runs out along the blow as well: the fist, the foot or the blade it is thrown with.
      if (flaring > 0) this.willStrike(fighter, state.seed, strength * Math.min(1, flaring * 1.6), burn.scale, will);
      if (time >= state.nextHaze && strength > .05 && this.kit.quality !== 'low') {
        state.nextHaze = time + (.05 + Math.random() * .06) / (d * level);
        this.willHaze(fighter, time, burn.scale, strength * (.55 + .45 * level), 0);
      }
      return;
    }
    // Lightning worn on the body (full-body lightning): a few arcs a tick between its joints and off them, never still.
    if (s.arcs) this.arcSkin(fighter, state.seed, burn.strength * (.75 + .25 * flaring), burn.scale, flaring > 0 ? 6 : 4, s.bolt);
    if (s.kind === 'cursed') {
      // Hex Energy does not crackle of itself: the dark flame is the shell's. Its red-black sparks crack off it now
      // and then, and off the blow on every swing.
      if (time >= state.nextCrackle) { state.crackleUntil = Math.max(state.crackleUntil, time + .1 + Math.random() * .1); state.nextCrackle = time + .7 + Math.random() * 1.3; }
      if (time < state.crackleUntil) this.willSkin(fighter, state.seed, .7 * burn.strength, burn.scale, 3, CURSED_SPARK);
      if (flaring > 0) this.willStrike(fighter, state.seed, burn.strength * Math.min(1, flaring * 1.6) * .8, burn.scale * .8, CURSED_SPARK);
      this.c.set(p.x, p.y + .3, p.z);
      this.electric.lights.add(this.c, 2 * burn.scale, this.tint.setHex(s.tint ?? 0x3a6cff), .3 * burn.strength * (1 + flaring));
      return;
    }
    if (s.kind === 'chi' || s.kind === 'aura') {
      // Worn, not thrown off: the cloak or the shroud is the shell's. It lights the floor round them, a little.
      this.c.set(p.x, p.y + .3, p.z);
      this.electric.lights.add(this.c, 2 * burn.scale, this.tint.setHex(s.tint ?? 0xffffff), .3 * burn.strength * (1 + flaring));
      return;
    }
    if (s.kind === 'pressure') {
      // Raw pressure standing on them. It streams upward off the body like smoke - the shell is AwakeningEffects',
      // these are the wisps leaving it, faster on a swing; under that weight a ring runs out along the floor now and
      // then and its grit lifts and hangs; and it lights the floor round them in its colour.
      const kit = this.kit, strength = burn.strength, scale = burn.scale, tint = s.tint ?? 0xffffff, shade = s.shade ?? 0x202028;
      if (time >= state.nextHaze && strength > .05) {
        state.nextHaze = time + (.05 - .025 * flaring) / d;
        const sp = kit.sparks.spec, a = Math.random() * TAU, r = (.16 + Math.random() * .3) * scale;
        sp.reset(SPRITE.streak, time, .28 + Math.random() * .24).pos(p.x + Math.cos(a) * r, p.y + (.25 + Math.random() * 1.5) * scale, p.z + Math.sin(a) * r).velocity(Math.cos(a) * .3, 4.5 + Math.random() * 3.5, Math.sin(a) * .3);
        sp.orient = ORIENT.velocity; sp.sized(.05, .018, .5); sp.stretch = 4; sp.trail = .05; sp.drag = .6; sp.hot(tint, 1.5 * strength).cool(shade, s.cover ?? .3); kit.sparks.emit();
      }
      if (time >= state.nextRing && fighter.state.grounded !== false && strength > .3) {
        state.nextRing = time + 1.5 + Math.random() * 1.2;
        kit.ring(p.x, p.y + .05, p.z, .35 * scale, 2.7 * scale, time, .55, tint, shade, .16, 'flat');
        if (kit.quality !== 'low') kit.debris.lift(kit.n(4, 2), p.x, p.z, .5 * scale, 1.3 * scale, .055, p.y, 1.3, 1.1);
      }
      this.c.set(p.x, p.y + .3, p.z);
      this.electric.lights.add(this.c, 2.2 * scale, this.tint.setHex(tint), .4 * strength * (1 + flaring));
      // (A pressure that is lightning besides - Mikage's HACKLES UP - crackles close round them, as the electric ki does.)
      if (s.electric) {
        if (time >= state.nextCrackle) { state.crackleUntil = time + .1 + Math.random() * .12; state.nextCrackle = time + .4 + Math.random() * .9; }
        if (time < state.crackleUntil) this.crackle(fighter, state.seed, .7 * strength, POWER.peak * POWER.burn * scale, s.bolt, Math.max(1, Math.round(2 * d)));
      }
      return;
    }
    if (s.kind !== 'ki') return;
    const size = POWER.peak * POWER.burn * burn.scale * (1 + .14 * flaring);
    this.c.set(p.x, p.y + .3, p.z);
    this.electric.lights.add(this.c, 2.2 * burn.scale, s.colours.core, .45 * burn.strength * (1 + flaring));
    if (s.electric) {
      if (time >= state.nextCrackle) { state.crackleUntil = time + .1 + Math.random() * .12; state.nextCrackle = time + .45 + Math.random() * 1.1; }
      if (time < state.crackleUntil) this.crackle(fighter, state.seed, .7 * burn.strength, size, s.bolt, Math.max(1, Math.round(2 * d)));
    }
  }

  /** The sheets a flame may draw on this machine: every sheet is a card the height of the fight drawn over the room,
   *  so the medium preset keeps the body and its flare and the low preset the body alone. */
  private sheets(wanted: number) {
    const q = this.kit.quality;
    return wanted & (q === 'low' ? SHEETS.body : q === 'medium' ? SHEETS.body | SHEETS.flare : SHEETS.all);
  }

  /** `count` bolts out of the body into the flame, re-forked each tick, a few ticks dropped so it flickers. */
  private crackle(actor: Fighter, seed: number, power: number, size: number, colour: THREE.Color, count: number) {
    if (power < .03) return;
    const ek = this.electric, rng = ek.painter.rng, p = actor.group.position;
    for (let i = 0; i < count; i++) {
      rng.seed(ek.tick * 977 + i * 131 + seed);
      if (rng.next() < .25) continue;
      const a = rng.next() * Math.PI * 2, h = .5 + rng.next() * 1.2;
      this.a.set(p.x + Math.cos(a) * .2, p.y + h, p.z + Math.sin(a) * .2);
      // Out past the flame's edge, the bolts leaving the aura, and thick: a white core in its glow.
      const out = size * (.3 + .4 * rng.next()), up = size * (rng.next() * .45 - .1);
      this.b.set(this.a.x + Math.cos(a + rng.signed() * .8) * out, this.a.y + up, this.a.z + Math.sin(a + rng.signed() * .8) * out);
      ek.arc(this.a, this.b, ek.tick * 31 + i * 7 + seed, .05 * Math.min(1.3, power + .3), colour, Math.min(1, power + .25), 2, 4, .36);
    }
  }

  /** 'Crimson Command': `count` black bolts round the body - out into the air from the shoulders and the arms, and,
   *  with `floor`, down into the ground round the feet - re-forked at 24 Hz with ticks dropped, so it spits rather
   *  than glows. Crimson light on the floor while it crackles. */
  private willCrackle(actor: Fighter, seed: number, power: number, scale: number, count: number, floor: boolean, will?: WillStyle) {
    if (power < .03) return;
    const rng = this.will.painter.rng, p = actor.group.position, s = scale, edge = will?.glow ?? WILL.glow;
    for (let i = 0; i < count; i++) {
      rng.seed(this.tick * 613 + i * 97 + seed);
      if (rng.next() < .3) continue;
      const a = rng.next() * Math.PI * 2;
      if (floor && i % 3 === 2) {
        // Down into the floor round them, and crawling along it.
        this.a.set(p.x + Math.cos(a) * .25 * s, p.y + (.5 + rng.next() * .6) * s, p.z + Math.sin(a) * .25 * s);
        const far = (.9 + rng.next() * 1.6) * s;
        this.b.set(p.x + Math.cos(a) * far, p.y + .02, p.z + Math.sin(a) * far);
      } else {
        this.a.set(p.x + Math.cos(a) * .18 * s, p.y + (.7 + rng.next() * .9) * s, p.z + Math.sin(a) * .18 * s);
        const out = (.6 + rng.next() * 1.1) * s * (.6 + .4 * power), up = (rng.next() * 1.1 - .2) * s;
        this.b.set(this.a.x + Math.cos(a + rng.signed() * .7) * out, this.a.y + up, this.a.z + Math.sin(a + rng.signed() * .7) * out);
      }
      this.will.bolt(this.a, this.b, this.tick * 41 + i * 13 + seed, (.045 + .03 * power) * s, Math.min(1, .45 + power), 2, edge);
      // Where it meets the floor it crawls on along it.
      if (floor && i % 3 === 2) {
        const turn = a + rng.signed() * 1.1, run = (.5 + rng.next() * .9) * s;
        this.c.set(this.b.x + Math.cos(turn) * run, p.y + .02, this.b.z + Math.sin(turn) * run);
        this.will.bolt(this.b, this.c, this.tick * 43 + i * 19 + seed, (.034 + .02 * power) * s, Math.min(1, .4 + power), 1, edge, 3);
      }
    }
    this.c.set(p.x, p.y + .3, p.z);
    this.electric.lights.add(this.c, 2.4 * s, will?.deep ?? WILL.deep, .7 * power);
  }

  /** Will on the body itself: `count` thin black threads a tick, each from one of the drawn body's joints (a form's
   *  where one stands in) either across to another - an arc over the chest, down an arm, between the legs - or a short
   *  leap off it into the air. Four ticks in ten are bare, so it spits. */
  private willSkin(actor: Fighter, seed: number, power: number, scale: number, count: number, will?: WillStyle) {
    if (power < .03 || typeof actor.drawnJoint !== 'function') return;
    const rng = this.will.painter.rng, edge = will?.glow ?? WILL.glow, n = WILL_JOINTS.length;
    for (let i = 0; i < count; i++) {
      rng.seed(this.tick * 389 + i * 71 + seed);
      if (rng.next() < .3) continue;
      const from = actor.drawnJoint(WILL_JOINTS[Math.floor(rng.next() * n) % n]);
      if (!from) continue;
      from.getWorldPosition(this.a);
      const to = rng.next() < .45 ? actor.drawnJoint(WILL_JOINTS[Math.floor(rng.next() * n) % n]) : undefined;
      if (to && to !== from) to.getWorldPosition(this.b);
      else {
        const turn = rng.next() * TAU, out = (.3 + .45 * rng.next()) * scale;
        this.b.set(this.a.x + Math.cos(turn) * out, this.a.y + (rng.next() * .8 - .15) * scale, this.a.z + Math.sin(turn) * out);
      }
      this.will.bolt(this.a, this.b, this.tick * 53 + i * 17 + seed, (.034 + .016 * power) * scale, Math.min(1, .5 + .5 * power), 1, edge, 3);
    }
  }

  /** Will standing up out of the floor round them: `count` forked bolts, each from the ground a pace out, up past the
   *  shoulders and leaning away. Each keeps its place for a fifth of a second - re-forking on the tick as it stands, a
   *  tick in five dark - and is struck again somewhere else, so there is always black lightning round a Will user and
   *  never a cage of it: it stands beside the body, not over it. */
  private willRise(actor: Fighter, seed: number, power: number, scale: number, count: number, will?: WillStyle) {
    if (power < .03) return;
    const rng = this.will.painter.rng, p = actor.group.position, edge = will?.glow ?? WILL.glow;
    for (let i = 0; i < count; i++) {
      rng.seed(Math.floor((this.tick + i * 3) / 5) * 911 + i * 67 + seed);
      if (rng.next() < (count > 1 ? .3 : .2)) continue;
      const turn = rng.next() * TAU, near = (.4 + rng.next() * .45) * scale, lean = rng.signed() * .6;
      const far = near + (.3 + rng.next() * .7) * scale, tall = (1.2 + rng.next() * 1.2) * scale * (.7 + .3 * power);
      this.a.set(p.x + Math.cos(turn) * near, p.y + .02, p.z + Math.sin(turn) * near);
      this.b.set(p.x + Math.cos(turn + lean) * far, p.y + tall, p.z + Math.sin(turn + lean) * far);
      if (rng.seed(this.tick * 613 + i * 31 + seed).next() < .2) continue;
      this.will.bolt(this.a, this.b, this.tick * 47 + i * 29 + seed, (.05 + .03 * power) * scale, Math.min(1, .55 + .5 * power), 2, edge);
    }
  }

  /** Lightning on the body itself: `count` arcs a tick, each from one of the drawn body's joints across to another or
   *  a short leap off it, re-forked on the electric kit's tick with a third of them dark. Light, where Will's are ink. */
  private arcSkin(actor: Fighter, seed: number, power: number, scale: number, count: number, colour: THREE.Color) {
    if (power < .03 || typeof actor.drawnJoint !== 'function') return;
    const ek = this.electric, rng = ek.painter.rng, n = WILL_JOINTS.length;
    for (let i = 0; i < count; i++) {
      rng.seed(ek.tick * 467 + i * 83 + seed);
      if (rng.next() < .33) continue;
      const from = actor.drawnJoint(WILL_JOINTS[Math.floor(rng.next() * n) % n]);
      if (!from) continue;
      from.getWorldPosition(this.a);
      const to = rng.next() < .5 ? actor.drawnJoint(WILL_JOINTS[Math.floor(rng.next() * n) % n]) : undefined;
      if (to && to !== from) to.getWorldPosition(this.b);
      else {
        const turn = rng.next() * TAU, out = (.25 + .4 * rng.next()) * scale;
        this.b.set(this.a.x + Math.cos(turn) * out, this.a.y + (rng.next() * .7 - .2) * scale, this.a.z + Math.sin(turn) * out);
      }
      ek.arc(this.a, this.b, ek.tick * 59 + i * 19 + seed, (.03 + .02 * power) * scale, colour, Math.min(1, .55 + .5 * power), 1, 3, .34);
    }
    this.c.copy(actor.group.position).y += 1;
    ek.lights.add(this.c, 2 * scale, colour, .25 * power);
  }

  /** Will along a blow: from the hands to the point the blow is thrown with, and off that point into the air. */
  private willStrike(actor: Fighter, seed: number, power: number, scale: number, will?: WillStyle) {
    if (power < .05 || typeof actor.strikePoint !== 'function') return;
    const rng = this.will.painter.rng.seed(this.tick * 733 + seed), edge = will?.glow ?? WILL.glow;
    actor.strikePoint(this.c);
    this.will.bolt(rng.next() < .5 ? actor.handR : actor.handL, this.c, this.tick * 59 + seed, (.036 + .024 * power) * scale, Math.min(1, .55 + power), 1, edge, 3);
    for (let i = 0; i < 2; i++) {
      const turn = rng.next() * TAU, out = (.35 + .5 * rng.next()) * scale;
      this.b.set(this.c.x + Math.cos(turn) * out, this.c.y + rng.signed() * .4 * scale, this.c.z + Math.sin(turn) * out);
      this.will.bolt(this.c, this.b, this.tick * 61 + i * 23 + seed, (.03 + .02 * power) * scale, Math.min(1, .5 + power), 1, edge, 3);
    }
  }

  /** The dark that comes off a Will user: one wisp of it lifting off the floor at their feet, small and low, so it
   *  stands round the legs and never over the body. `out` (m/s) throws it outward instead: the break's wave. */
  private willHaze(actor: Fighter, time: number, scale: number, strength: number, out: number) {
    const sp = this.kit.dust.spec, p = actor.group.position, turn = Math.random() * TAU, r = (.28 + Math.random() * .4) * scale;
    const size = (.2 + Math.random() * .14) * scale, c = Math.cos(turn), sn = Math.sin(turn);
    sp.reset(SPRITE.puff, time, .45 + Math.random() * .3).pos(p.x + c * r, p.y + .06 + Math.random() * .3 * scale, p.z + sn * r);
    sp.velocity(c * (.2 + out), .7 + Math.random() * .8, sn * (.2 + out)); sp.drag = 1.4; sp.gravity = -.5;
    sp.sized(size * .45, size, .6).hot(HAZE_LIT, 1).cool(HAZE_SHADE, Math.min(.8, .62 * strength)); sp.bias = size * .4;
    this.kit.dust.emit();
  }

  private drawGlints(time: number) {
    const ek = this.electric;
    for (let i = this.glints.length - 1; i >= 0; i--) {
      const g = this.glints[i], age = time - g.born;
      if (age > g.life) { this.glints.splice(i, 1); continue; }
      if (age < 0) continue;
      const k = age / g.life, pop = Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k * .3);
      this.c.set(g.x, g.y, g.z);
      ek.glows.add(this.c, g.size * pop, this.tint.setRGB(1.6, .55, 1.4), 1, STAR, .18, 7);
      ek.halos.add(this.c, g.size * 1.4 * pop, this.tint.setRGB(.5, .18, .45), .5 * pop, GLOW, .1);
      if (g.streak) {
        // A lens streak: a long flat line across the frame through the glint.
        this.a.copy(this.c).addScaledVector(this.right, -3.2 * pop); this.b.copy(this.c).addScaledVector(this.right, 3.2 * pop);
        ek.bolts.segment(this.a, this.b, .022 * pop + .004, this.tint.setRGB(1.5, .3, 1.1), pop, .3);
      }
    }
  }

  /** DEV: `window.__kiPreview = { size, strength, flare, heart, sheets, core?, rim?, only?: 'self' | 'other' }` burns a
   *  flame round fighters without a transformation, for tuning it. */
  private preview(fighters: ReadonlyMap<string, Fighter>) {
    const p = (globalThis as unknown as { __kiPreview?: { size: number; strength: number; flare: number; heart: number; body?: number; sheets: number; push?: number; core: number; rim?: number; only?: string; local?: string } }).__kiPreview;
    if (!p) return;
    for (const f of fighters.values()) {
      if (p.only && (p.only === 'self') !== (f.state.id === p.local)) continue;
      const b = f.group.position;
      this.ki.draw({ x: b.x, y: b.y, z: b.z, size: p.size, strength: p.strength, flare: p.flare, heart: p.heart, body: p.body, sheets: p.sheets, push: p.push,
        colours: kiColours(p.core, p.rim ?? p.core, this.previewColours), seed: hashSeed(f.state.id) });
    }
  }
  private previewColours = kiColours(0xffffff, 0xffffff);

  reset() { this.entries.clear(); this.burns.clear(); this.entering.clear(); this.glints.length = 0; this.burst.reset(); this.electric.reset(); this.will.begin(); this.will.end(); }
  dispose() { this.reset(); this.ki.dispose(); this.burst.dispose(); this.electric.dispose(); this.will.dispose(); }
}

function hashSeed(id: string) { let h = 7; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973; return h * .37; }
const _c = new THREE.Color();
function colourHex(c: THREE.Color) { return _c.copy(c).getHex(); }
export { kiColours };
