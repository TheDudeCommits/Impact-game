import * as THREE from 'three';
import type { Fighter } from '../Fighter';
import { drawnBulk } from '../CameraDirector';
import { DREAM_IMPACT } from '../dreamFlag';

/** Keeping the victim readable through the attacker's own effects.
 *
 *  The last blind critic's fourth gap: beams, sparks, smoke, ghosts and
 *  bursts hid the fighter being hit - Sunpalm Cannon's shell covered all of
 *  KoKo, a wall splat's smoke puff hid Konta against the wall, Lion's
 *  Song's green afterimages lay over Kuon. Every effect layer that is drawn
 *  over a struck body now thins where it does: a fragment that lies between
 *  the lens and a body taking a blow - within the body's capsule on screen,
 *  and nearer the lens than the body is there - keeps only 1 - strength of
 *  itself, so the silhouette reads through it and the effect still reads
 *  round it. Effects behind the body, or beside it, are untouched.
 *
 *  It opens VEIL_DELAY after the blow, so the flash, the hit spark's first
 *  frames and the impact frame land at full strength - that beat is the hit -
 *  and closes over VEIL_OUT once the body is back on its feet. A body stays a
 *  victim for VEIL_LINGER after a blow that gave it no reaction to show (a
 *  hit through armour, a blow on a guard). Up to VEIL_BODIES bodies at once,
 *  the most veiled first. The capsule runs from the soles to the crown as
 *  drawn - a launched body is wherever its tumble has it - VEIL_RADIUS round
 *  (times the body's size) and VEIL_PAD past each end. */
export const VEIL_BODIES = 4;
// The dream loop (22 October 2026): opened sooner and faster - full by 70 ms where it was full by 150 - since a
// burst should cover its victim for a frame or two at most, and ours hid him for the whole of a heavy blow.
const VEIL_DELAY = DREAM_IMPACT ? .035 : .07, VEIL_IN = DREAM_IMPACT ? .035 : .08, VEIL_OUT = .3, VEIL_LINGER = .6, VEIL_RADIUS = DREAM_IMPACT ? .5 : .42, VEIL_PAD = .16;
/** The dream loop, round 53: a big blow's veil (a launcher, a slam, a finisher: CombatEffects `hitTier`) is the whole of
 *  each layer's strength (VEIL) and VEIL_WIDE round, held until the body is back up; any other blow's is VEIL_LIGHT of
 *  it, VEIL_RADIUS round - a string's dust at the victim's feet as it was (a blind critic, given the whole veil on every
 *  blow: "a larger, shaded, multi-puff toon dust cloud at the victim's feet ... where B shows only small wisps"). With
 *  the switch off, every blow's is the whole, as before. */
export const VEIL_LIGHT = DREAM_IMPACT ? .85 : 1;
const VEIL_WIDE = DREAM_IMPACT ? .65 : VEIL_RADIUS;
/** How much of itself each kind of layer gives up over a victim: the light
 *  that is the hit (sparks) least, the smoke and the ghosts that only ever
 *  covered it most.
 *  The dream loop, round 53: under the dream switch, after a big blow, nearly all of it (after any other, VEIL_LIGHT of
 *  this - about what it was). Both blind critics, of every heavy blow from 67 ms on: Ouga "hidden or half-buried in the
 *  opaque burst, low-poly rocks and popcorn dust", "buried under starburst, white dust and rocks" - a slam's dust is six
 *  puffs deep and each kept 15% of itself over him, its rocks 40%, so together they were a wall again - while the
 *  victim should stay a crisp body, visibly flung away or down, through it. The impact frame itself is
 *  untouched: the veil opens VEIL_DELAY after the blow. */
export const VEIL = DREAM_IMPACT
  ? { sparks: .9, dust: 1, beam: .75, corona: .8, burst: .95, ghost: 1, rubble: 1 } as const
  : { sparks: .75, dust: .85, beam: .75, corona: .8, burst: .8, ghost: .85, rubble: .6 } as const;
const REACTING = new Set<string>(['hurt', 'flinch', 'launched', 'knockdown', 'splat', 'stun', 'getup']);

/** Shared by every veiled material: one write a frame reaches all of them. */
const uniforms = {
  uVeilA: { value: Array.from({ length: VEIL_BODIES }, () => new THREE.Vector4()) },
  uVeilB: { value: Array.from({ length: VEIL_BODIES }, () => new THREE.Vector4()) },
};

/** `victimVeil(p, strength)`: how much of an effect fragment at world point
 *  `p` to keep. For each body, the least distance between the view ray
 *  through `p` and the body's axis, and how far beyond `p` along the ray
 *  that point is: inside the radius and not clearly behind the fragment is
 *  covered. The body's own near surface is a fifth of a metre in front of
 *  its axis and the depth test already hides what lies behind that, so a
 *  puff of smoke centred on the body - as a landing's is - counts as over
 *  it; only what is well behind the axis is spared.
 *  `victimVeilThrough` also thins what lies inside the body's own volume,
 *  for the beams, whose core passing through the victim blooms over them. */
export const VEIL_GLSL = /* glsl */`
uniform vec4 uVeilA[${VEIL_BODIES}]; uniform vec4 uVeilB[${VEIL_BODIES}];
float victimVeil(vec3 p, float strength){
  vec3 d = p - cameraPosition; float t0 = length(d); d /= max(t0, 1e-4);
  float keep = 1.0;
  for (int i = 0; i < ${VEIL_BODIES}; i++) {
    float w = uVeilB[i].w;
    if (w < .002) continue;
    vec3 a = uVeilA[i].xyz, ab = uVeilB[i].xyz - a, w0 = a - cameraPosition;
    float aa = dot(ab, ab), b = dot(ab, d), c = dot(ab, w0), e = dot(d, w0), den = aa - b * b;
    float s = den > 1e-5 ? clamp((b * e - c) / den, 0.0, 1.0) : 0.0;
    float t = e + b * s;
    float r = uVeilA[i].w, near = length(w0 + ab * s - d * t);
    float cover = (1.0 - smoothstep(r * .7, r * 1.25, near)) * smoothstep(-.15, .1, t - t0) * w;
    keep = min(keep, 1.0 - strength * cover);
  }
  return keep;
}
// The same, and also wherever the effect passes through the body itself: a
// beam's white-hot core running through the victim is what blooms over them,
// from in front or behind.
float victimVeilThrough(vec3 p, float strength){
  float keep = victimVeil(p, strength);
  for (int i = 0; i < ${VEIL_BODIES}; i++) {
    float w = uVeilB[i].w;
    if (w < .002) continue;
    vec3 a = uVeilA[i].xyz, ab = uVeilB[i].xyz - a;
    float s = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0), r = uVeilA[i].w;
    float inside = 1.0 - smoothstep(r * .8, r * 1.6, length(p - a - ab * s));
    keep = min(keep, 1.0 - strength * inside * w);
  }
  return keep;
}`;

/** `victimVeil` for one body, in TypeScript, line for line: what the tests
 *  hold the geometry to. `lens` is the camera, `a`-`b` the body's axis, `r`
 *  its radius, `w` its weight. */
export function veilKeep(p: THREE.Vector3, lens: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, r: number, w: number, strength: number) {
  const d = p.clone().sub(lens), t0 = d.length(); d.divideScalar(Math.max(t0, 1e-4));
  const ab = b.clone().sub(a), w0 = a.clone().sub(lens);
  const aa = ab.dot(ab), bb = ab.dot(d), c = ab.dot(w0), e = d.dot(w0), den = aa - bb * bb;
  const s = den > 1e-5 ? THREE.MathUtils.clamp((bb * e - c) / den, 0, 1) : 0, t = e + bb * s;
  const near = w0.clone().addScaledVector(ab, s).addScaledVector(d, -t).length();
  const cover = (1 - THREE.MathUtils.smoothstep(near, r * .7, r * 1.25)) * THREE.MathUtils.smoothstep(t - t0, -.15, .1) * w;
  return 1 - strength * cover;
}

/** The veil's uniforms, for a ShaderMaterial that calls `victimVeil` itself;
 *  `strength` is its own `uVeilStrength`. */
export function veilUniforms(strength: number) {
  return { ...uniforms, uVeilStrength: { value: strength } };
}

const installed = new WeakSet<THREE.Material>();
/** Veil a built-in material (a MeshBasicMaterial): its world position is
 *  carried to the fragment, which gives up `strength` of its alpha over a
 *  victim. Instancing-aware, as the scenery cutaway is. */
export function installVeil(material: THREE.Material, strength: number) {
  if (installed.has(material)) return material;
  installed.add(material);
  const previous = material.onBeforeCompile, cache = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = function (shader, renderer) {
    previous.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms, { uVeilStrength: { value: strength } });
    shader.vertexShader = 'varying vec3 vVeilWorld;\n' + shader.vertexShader.replace('#include <project_vertex>', `
      vec4 veilLocal = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        veilLocal = instanceMatrix * veilLocal;
      #endif
      vVeilWorld = (modelMatrix * veilLocal).xyz;
      #include <project_vertex>`);
    shader.fragmentShader = 'varying vec3 vVeilWorld;\nuniform float uVeilStrength;\n' + VEIL_GLSL + '\n'
      + shader.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      gl_FragColor.a *= victimVeil(vVeilWorld, uVeilStrength);`);
  };
  material.customProgramCacheKey = () => cache() + '-victim-veil';
  material.needsUpdate = true;
  return material;
}

const _feet = new THREE.Vector3(), _head = new THREE.Vector3(), _joint = new THREE.Vector3();
const FEET = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'] as const;

/** Who is being hit, and how far the veil is over each. CombatEffects tells
 *  it about every blow and updates it once a frame, after the bodies have
 *  been posed. Nothing here allocates once a body has been seen. */
export class VictimVeil {
  private struckAt = new Map<string, number>();
  /** The bodies a big blow has landed on since they were last up (VEIL_LIGHT). */
  private big = new Set<string>();
  private weights = new Map<string, number>();
  private order: Fighter[] = [];
  private byWeight = (a: Fighter, b: Fighter) => (this.weights.get(b.state.id) ?? 0) - (this.weights.get(a.state.id) ?? 0);
  /** A blow landed on `id` at `time` (the match clock); `big`, a launcher, a slam or a finisher. */
  struck(id: string, time: number, big = false) { this.struckAt.set(id, time); if (big) this.big.add(id); }
  /** How far the veil is over `id` this frame, 0..1: for tests and probes. */
  weight(id: string) { return this.weights.get(id) ?? 0; }

  update(time: number, dt: number, fighters: ReadonlyMap<string, Fighter>) {
    const order = this.order; order.length = 0;
    for (const body of fighters.values()) {
      const id = body.state.id, since = time - (this.struckAt.get(id) ?? -Infinity);
      const active = body.state.alive !== false && body.group.visible && (REACTING.has(body.state.action) || since < VEIL_LINGER);
      if (!active) this.big.delete(id);
      const want = active && since >= VEIL_DELAY ? this.big.has(id) ? 1 : VEIL_LIGHT : 0;
      let w = this.weights.get(id) ?? 0;
      w = want > w ? Math.min(want, w + dt / VEIL_IN) : Math.max(want, w - dt / VEIL_OUT);
      this.weights.set(id, w);
      if (w > .002) order.push(body);
    }
    // The most veiled first; a slot left over is switched off.
    order.sort(this.byWeight);
    for (let i = 0; i < VEIL_BODIES; i++) {
      const a = uniforms.uVeilA.value[i], b = uniforms.uVeilB.value[i], body = order[i];
      if (!body) { b.w = 0; continue; }
      const bulk = drawnBulk(body), w = this.weights.get(body.state.id) ?? 0;
      this.span(body, bulk);
      // Widened as the weight climbs past an ordinary blow's.
      const wide = VEIL_LIGHT < 1 ? THREE.MathUtils.clamp((w - VEIL_LIGHT) / (1 - VEIL_LIGHT), 0, 1) : 0;
      a.set(_feet.x, _feet.y, _feet.z, (VEIL_RADIUS + (VEIL_WIDE - VEIL_RADIUS) * wide) * bulk);
      b.set(_head.x, _head.y, _head.z, w);
    }
  }
  /** The body's axis as drawn, soles to crown and padded, into _feet/_head. */
  private span(body: Fighter, bulk: number) {
    const joints = body.joints, p = body.group.position;
    const head = joints?.get('Head');
    if (!head || body.model?.visible === false) { _feet.set(p.x, p.y, p.z); _head.set(p.x, p.y + 1.95 * bulk, p.z); }
    else {
      head.getWorldPosition(_head);
      let low = Infinity;
      for (let i = 0; i < FEET.length; i++) { const bone = joints!.get(FEET[i]); if (!bone) continue; bone.getWorldPosition(_joint); if (_joint.y < low) { low = _joint.y; _feet.copy(_joint); } }
      if (!Number.isFinite(low)) _feet.set(p.x, p.y, p.z);
    }
    // Past the crown and under the soles, along the body's own axis.
    _joint.subVectors(_head, _feet); const length = _joint.length();
    if (length > 1e-4) { _joint.multiplyScalar(VEIL_PAD / length); _head.add(_joint); _feet.sub(_joint); }
  }
}
