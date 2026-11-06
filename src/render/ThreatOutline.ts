import {ENEMIES} from '../survival/enemies';
import * as THREE from 'three';
import { addShaderPatch, replaceOnce } from './look/shaderPatch';
import { activeWindow, type MoveDefinition } from '../game/moves';
import { moveFor, rushMove } from '../game/awakening';
import { comboMove, type ComboKey } from '../game/combos';
import type { ActionKind, AttackSlot, FighterId } from '../game/types';


/** What a body's current cast means for whoever it is thrown at. */
export const THREAT_IDLE = 0, THREAT_BLOCKABLE = 1, THREAT_UNBLOCKABLE = 2;
export type ThreatLevel = 0 | 1 | 2;
export const THREAT_NAMES = ['idle', 'blockable', 'unblockable'] as const;
const ATTACKS: ReadonlySet<string> = new Set(['light', 'heavy', 'special', 'ultimate']);

/** The part of a body's state a threat is read from (PlayerState has it). */
export interface ThreatSource {
  /** Client-only compact-horde adapter; never sent as authoritative state. */
  viewMove?: MoveDefinition;
  fighter: FighterId; action: ActionKind; actionTime: number; actionDuration: number;
  alive?: boolean; awakened?: boolean; chain?: number; branch?: ComboKey; enemy?: string; move?: string;
}
/** One read. `until`: seconds to the cast's next contact (Infinity: none
 *  ahead); `elapsed`: seconds into it; `move`: the move, when it is known. */
export interface ThreatRead { level: ThreatLevel; until: number; elapsed: number; move: MoveDefinition | undefined }
const scratch: ThreatRead = { level: THREAT_IDLE, until: Infinity, elapsed: 0, move: undefined };

/** The move a cast in progress throws, as ArenaSimulation.cast picks it: the
 *  combo ender's row, else the rush stage's (a light) or the slot's, each in
 *  its awakened form when the body is awakened. Enemies use their named
 *  move from their own kit, never their placeholder roster fighter. */
export function castMove(s: ThreatSource): MoveDefinition | undefined {
  if (!ATTACKS.has(s.action)) return undefined;
  if (s.viewMove) return s.viewMove;
  if (s.enemy) {
    const def=ENEMIES[s.enemy];if(!def)return undefined;
    if(s.move==='Mending seal'||s.move==='Breach charge')return undefined;
    let slot:MoveDefinition|undefined;
    for(const move of def.moves){if(move.name===s.move)return move;if(!slot&&move.slot===s.action)slot=move;}
    return slot;
  }
  const slot = s.action as AttackSlot, awakened = !!s.awakened;
  try {
    if (s.branch && (slot === 'heavy' || slot === 'special')) { const m = comboMove(s.fighter, s.branch, awakened); if (m) return m; }
    return slot === 'light' ? rushMove(s.fighter, s.chain ?? 0, awakened) : moveFor(s.fighter, slot, awakened);
  } catch { return undefined; }
}

/** How long after its last contact a cast is still the threat it was: a
 *  swing's active window; a shot's flight to the end of its range. */
function reachTime(move: MoveDefinition) {
  const flight = (move.style === 'projectile' || move.style === 'bomb') && move.speed ? Math.min(1.2, move.range / move.speed) : 0;
  return Math.max(activeWindow(move), flight);
}

/** The threat `s` is to whoever its cast is aimed at, now (see the notes at
 *  the top). One object, rewritten by every call unless `out` is given. */
export function castThreat(s: ThreatSource, out: ThreatRead = scratch): ThreatRead {
  out.level = THREAT_IDLE; out.until = Infinity; out.elapsed = 0; out.move = undefined;
  if (s.alive === false || !ATTACKS.has(s.action)) return out;
  // These channels heal allies or charge a strike against a village post;
  // neither throws a blockable/unblockable cast at the player.
  if(s.enemy&&(s.move==='Mending seal'||s.move==='Breach charge'))return out;
  const elapsed = Math.max(0, (Number.isFinite(s.actionTime) ? s.actionTime : 0) * (Number.isFinite(s.actionDuration) ? s.actionDuration : 0));
  out.elapsed = elapsed;
  const move = castMove(s);
  if (!move) { out.level = THREAT_BLOCKABLE; return out; }
  out.move = move;
  if(move.damage<=0)return out;
  const contacts = move.contacts, last = contacts.length ? contacts[contacts.length - 1] : 0;
  // Past its last blow (and the blow's own reach), the cast is recovery: no
  // threat any more.
  if (elapsed > last + reachTime(move)) return out;
  for (let k = 0; k < contacts.length; k++) if (contacts[k] >= elapsed) { out.until = contacts[k] - elapsed; break; }
  if (out.until === Infinity) out.until = 0;
  out.level = move.guardBreak ? THREAT_UNBLOCKABLE : THREAT_BLOCKABLE;
  return out;
}

// ---- the glow on the ink ------------------------------------------------------
/** A fighter's own threat uniforms, shared by every ink shell it draws: the
 *  colour (linear, HDR), how much of the ink it replaces, and how many ink
 *  widths the shell is pushed out further. All zero: the ink as it was. */
export interface ThreatInk { color: { value: THREE.Color }; mix: { value: number }; widen: { value: number } }
export const threatInk = (): ThreatInk => ({ color: { value: new THREE.Color(0, 0, 0) }, mix: { value: 0 }, widen: { value: 0 } });

const THREAT_VERTEX = `if ( uThreatWiden > 0.0 ) {
		float threatDepth = max( - mvPosition.z, .05 );
		float threatPixel = 2.0 * threatDepth / projectionMatrix[ 1 ][ 1 ];
		float threatFar = mix( 1.0, .6, smoothstep( 12.0, 45.0, threatDepth ) );
		mvPosition.xyz -= normalize( transformedNormal ) * uInkWidth * uInkScale * threatPixel * threatFar * uThreatWiden;
		gl_Position = projectionMatrix * mvPosition;
	}
	#include <logdepthbuf_vertex>`;

export function applyThreatInk(material: THREE.Material, ink: ThreatInk, hull = true) {
  addShaderPatch(material, hull ? 'threat-ink-v1' : 'threat-ink-flat-v1', shader => {
    shader.uniforms.uThreatColor = ink.color; shader.uniforms.uThreatMix = ink.mix; shader.uniforms.uThreatWiden = ink.widen;
    if (hull) {
      // The ink's own push (uInkWidth x uInkScale pixels at the vertex's
      // depth, thinned far off) again, `uThreatWiden` times: the shell grows
      // outward, its depth bias untouched.
      shader.vertexShader = 'uniform float uThreatWiden;\n' + shader.vertexShader;
      shader.vertexShader = replaceOnce(shader.vertexShader, '#include <logdepthbuf_vertex>', THREAT_VERTEX, 'threat ink widen');
    }
    shader.fragmentShader = 'uniform vec3 uThreatColor;\nuniform float uThreatMix;\n' + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <opaque_fragment>', 'outgoingLight = mix( outgoingLight, uThreatColor, uThreatMix );\n#include <opaque_fragment>', 'threat ink colour');
  });
}

/** The same hull glow for GPU-instanced crowds. Two small per-instance
 * buffers keep fades independent when cycling, without extra draws or programs. */
export function applyInstancedThreatInk(material: THREE.Material) {
  addShaderPatch(material, 'threat-ink-instanced-v1', shader => {
    shader.vertexShader = 'attribute vec4 aThreat;\nattribute float aThreatWiden;\nvarying vec4 vThreat;\n#define uThreatWiden aThreatWiden\n' + shader.vertexShader;
    shader.vertexShader = replaceOnce(shader.vertexShader, 'void main() {', 'void main() {\n vThreat = aThreat;', 'instance threat');
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <logdepthbuf_vertex>', THREAT_VERTEX, 'instance threat widen');
    shader.fragmentShader = 'varying vec4 vThreat;\n' + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <opaque_fragment>', 'outgoingLight = mix( outgoingLight, vThreat.rgb, vThreat.a );\n#include <opaque_fragment>', 'instance threat colour');
  });
}

// ---- the colours and their motion ---------------------------------------------
/** The three colours, as the eye reads them (sRGB): yellow, orange, red. */
export const THREAT_HEX = ['#ffd23c', '#ff7a1c', '#ff2430'] as const;
/** How bright each is in the HDR frame, the bloom's threshold being 1 on the
 *  brightest channel (soft from 0.6): yellow - the calm state, on whenever a
 *  lock is - barely catches it, orange does, red blooms. */
export const THREAT_GLOW = [.85, 1.6, 2.3] as const;
/** How many ink widths further out the lit shell stands (the ink is about
 *  2.2 px at 1080p): the line reads as a rim of light, not a sticker. */
export const THREAT_WIDEN = [.8, 1.15, 1.5] as const;
/** A colour change: up at once for red (the warning is the point), after
 *  RISE_HOLD for orange; back down only after FALL_HOLD (red: RED_HOLD), so a
 *  string's gaps between blows do not flicker; the colour itself eased at
 *  COLOUR_RATE. */
export const RISE_HOLD = .03, FALL_HOLD = .18, RED_HOLD = .3, COLOUR_RATE = 24;
/** Red pulses while the blow is still to come: PULSE_HZ, PULSE_SHARE of its brightness. */
export const PULSE_HZ = 5, PULSE_SHARE = .22;
/** A lock: the glow flashes in (LOCK_IN seconds to full, FLASH bright for
 *  FLASH_TIME); a switch hands over the same way; a release lets go over
 *  RELEASE_OUT, the rim breathing out a little as it goes. */
export const LOCK_IN = .1, FLASH = 1.4, FLASH_TIME = .24, FLASH_WIDEN = 1.2, RELEASE_OUT = .22;

const linear = (hex: string) => new THREE.Color(hex);
const COLOURS = THREAT_HEX.map(linear);

/** A body the glow can light. Fighter satisfies it. */
export interface ThreatBody {
  readonly threatInk?: ThreatInk;
  readonly state: ThreatSource & { id?: string };
  /** The body drawn now (a form's while one stands in). */
  readonly shownBody?: ThreatBody;
}

interface Lit {
  body: ThreatBody;
  /** How present the glow is (0..1), and whether it is going. */
  amount: number; leaving: boolean;
  /** Seconds since it was lit. */
  age: number;
  /** The level shown, the one wanted and how long it has been wanted. */
  shown: ThreatLevel; want: ThreatLevel; wanted: number;
  /** Seconds since the shown level last changed, for the pulse. */
  clock: number;
  colour: THREE.Color; glow: number; widen: number;
  /** Seconds to the cast's next blow (red pulses until it lands). */
  until: number;
  /** The form drawn for the body when last painted, to put out when it goes. */
  form: ThreatBody | undefined;
}

/** Drives the ink of whoever is locked (see the notes at the top): every
 *  frame `update` with the locked body, or nothing. Allocation-free once two
 *  bodies have been lit. */
export class ThreatOutline {
  /** For the HUD and the evidence: the shown level of the lit body (-1 for
   *  none), its colour as CSS, and how present the glow is. */
  readonly state = { level: -1 as ThreatLevel | -1, css: THREAT_HEX[0] as string, amount: 0, id: '' };
  private lit: Lit[] = [];
  private pool: Lit[] = [];
  private read: ThreatRead = { level: THREAT_IDLE, until: Infinity, elapsed: 0, move: undefined };

  /** `body`: the locked target, or undefined (no lock, the glow style off).
   *  `reduced`: prefers-reduced-motion - no flash, no pulse. */
  update(dt: number, body: ThreatBody | undefined, reduced = false) {
    dt = Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0));
    // A body that is no longer the one locked goes; the one that is comes in.
    let current: Lit | undefined;
    for (const l of this.lit) { if (l.body === body && !l.leaving) current = l; else if (!l.leaving) l.leaving = true; }
    if (body && !current) {
      // Locked again before it had gone: it comes back from where it was.
      current = this.lit.find(l => l.body === body);
      if (current) current.leaving = false;
      else { current = this.pool.pop() ?? { body, amount: 0, leaving: false, age: 0, shown: THREAT_IDLE, want: THREAT_IDLE, wanted: 0, clock: 0, colour: new THREE.Color(), glow: 0, widen: 0, until: Infinity, form: undefined };
        current.body = body; current.amount = 0; current.leaving = false; current.age = 0; current.wanted = 0; current.clock = 0; current.form = undefined;
        const level = castThreat(body.state, this.read).level; current.shown = current.want = level; current.colour.copy(COLOURS[level]);
        current.glow = THREAT_GLOW[level]; current.widen = THREAT_WIDEN[level];
        this.lit.push(current); }
    }
    for (let k = this.lit.length - 1; k >= 0; k--) {
      const l = this.lit[k];
      l.age += dt; l.clock += dt;
      if (!l.leaving) {
        // The level, held against flicker (RISE_HOLD, FALL_HOLD, RED_HOLD).
        const level = castThreat(l.body.state, this.read).level; l.until = this.read.until;
        if (level !== l.want) { l.want = level; l.wanted = 0; } else l.wanted += dt;
        const hold = level > l.shown ? (level === THREAT_UNBLOCKABLE ? 0 : RISE_HOLD) : l.shown === THREAT_UNBLOCKABLE ? RED_HOLD : FALL_HOLD;
        if (level !== l.shown && l.wanted >= hold) { l.shown = level; l.clock = 0; }
        l.amount = reduced ? 1 : Math.min(1, l.amount + dt / LOCK_IN);
      } else l.amount = Math.max(0, l.amount - dt / RELEASE_OUT);
      const target = COLOURS[l.shown];
      const k2 = 1 - Math.exp(-COLOUR_RATE * dt);
      l.colour.r += (target.r - l.colour.r) * k2; l.colour.g += (target.g - l.colour.g) * k2; l.colour.b += (target.b - l.colour.b) * k2;
      // Brightness: the level's, the lock's flash over it, red's pulse.
      const flash = reduced || l.leaving ? 0 : Math.max(0, 1 - l.age / FLASH_TIME);
      const pulse = !reduced && l.shown === THREAT_UNBLOCKABLE && l.until > 0 && !l.leaving ? PULSE_SHARE * Math.sin(l.clock * Math.PI * 2 * PULSE_HZ) : 0;
      l.glow += (THREAT_GLOW[l.shown] - l.glow) * k2;
      l.widen += (THREAT_WIDEN[l.shown] - l.widen) * k2;
      const glow = l.glow * (1 + pulse) * (1 + (FLASH - 1) * flash * flash);
      const widen = (l.widen + FLASH_WIDEN * flash * flash + (l.leaving ? .5 * (1 - l.amount) : 0)) * l.amount;
      this.paint(l, glow, l.amount, widen);
      if (l.leaving && l.amount <= 0) { this.paint(l, 0, 0, 0); this.lit.splice(k, 1); this.pool.push(l); }
    }
    const shown = current && !current.leaving ? current : undefined;
    this.state.level = shown ? shown.shown : -1; this.state.css = THREAT_HEX[shown ? shown.shown : 0]; this.state.amount = shown?.amount ?? 0; this.state.id = shown?.body.state.id ?? '';
  }
  /** Let every lit body go at once (a new match, the style switched off). */
  clear() { for (const l of this.lit) { this.paint(l, 0, 0, 0); this.pool.push(l); } this.lit.length = 0; this.state.level = -1; this.state.amount = 0; this.state.id = ''; }
  /** The body's shells, and its form's while one is drawn for it (a form
   *  that has stopped being drawn is put out). */
  private paint(l: Lit, glow: number, amount: number, widen: number) {
    const body = l.body, shown = body.shownBody && body.shownBody !== body ? body.shownBody : undefined;
    if (l.form && l.form !== shown) set(l.form.threatInk, l.colour, 0, 0, 0);
    l.form = amount > 0 ? shown : undefined;
    set(body.threatInk, l.colour, glow, amount, widen);
    if (shown) set(shown.threatInk, l.colour, glow, amount, widen);
  }
}
function set(ink: ThreatInk | undefined, colour: THREE.Color, glow: number, amount: number, widen: number) {
  if (!ink) return;
  ink.color.value.setRGB(colour.r * glow, colour.g * glow, colour.b * glow);
  ink.mix.value = amount; ink.widen.value = widen;
}
