// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * MIT License — VFX Armory cinematic pack (samurai port).
 * Original effect, authored for the port of achrefelouafi/SamuraiThirdPersonTemplateThreeJS
 * (MIT, Copyright (c) 2026 mohamedachrefelouafi): the source has no slash-trail
 * ribbon, so this one is built to burn in the source's own black-body palette
 * (`blackbody.glsl.js`, the same `blackbody()` its sword fire, steel heat and
 * embers all radiate through).
 *
 * A crescent slash: a band swept around an arc, whose leading edge is the path
 * of the blade tip. The visible window is a trail chasing a head round the arc
 * (`sweep`), so the cut *draws itself* in one snappy beat, then burns away from
 * the tail. Anime read:
 *  - a hairline of white-hot steel on the outer edge,
 *  - a core that steps through cel bands (`bands`, `cel`) instead of a gradient,
 *  - a saturated rim, then ragged flame tongues eroding the inner edge,
 *  - cooling through the black-body ramp as it dissolves.
 *
 * Geometry is one unit band shared by every arc; radius/width/arc are uniforms,
 * so a slider reshapes a cut that is already on screen. Pooled: `spawn` takes a
 * free slot, nothing is allocated during a cast.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Matrix4,
  Mesh,
  ShaderMaterial,
  Vector3
} from 'three';
import { LAYER } from '../../../../core/Layers.js';
import { blackbodyGLSL } from './blackbody.glsl.js';
import { noiseGLSL } from './noise.glsl.js';
import { copyColor } from './color.js';

const ALONG = 96;
const ACROSS = 8;

const _x = new Vector3();
const _y = new Vector3();
const _z = new Vector3();
const _m = new Matrix4();
const UP = new Vector3(0, 1, 0);

function buildBand() {
  const verts = (ALONG + 1) * (ACROSS + 1);
  const uv = new Float32Array(verts * 2);
  const pos = new Float32Array(verts * 3);
  let k = 0;
  for (let i = 0; i <= ALONG; i++) {
    for (let j = 0; j <= ACROSS; j++) {
      uv[k * 2] = i / ALONG;
      uv[k * 2 + 1] = j / ACROSS;
      k++;
    }
  }
  const index = [];
  for (let i = 0; i < ALONG; i++) {
    for (let j = 0; j < ACROSS; j++) {
      const a = i * (ACROSS + 1) + j;
      const b = a + ACROSS + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.boundingSphere = null;
  return geometry;
}

const VERTEX = /* glsl */ `
uniform float uRadius;
uniform float uWidth;
uniform float uArc;
uniform float uHead;
uniform float uTrail;
uniform float uFlip;
uniform float uBow;
varying vec2 vUv;
varying float vS;
varying float vProfile;
void main() {
  float along = uFlip > 0.5 ? 1.0 - uv.x : uv.x;
  float tail = uHead - uTrail;
  float s = (uv.x - tail) / max(uHead - tail, 1e-4);
  float inside = step(0.0, s) * step(s, 1.0);
  float sc = clamp(s, 0.0, 1.0);
  // crescent: fattest just behind the head, needle-thin at both ends
  float profile = inside * pow(sin(3.14159265 * pow(sc, 0.7)), 0.6) * pow(sc, 0.2);
  float angle = (along - 0.5) * uArc;
  float r = uRadius - uv.y * uWidth * profile;
  // a slight bow out of plane gives the cut some volume when seen edge-on
  float lift = uBow * uWidth * profile * (uv.y - 0.5);
  vec3 p = vec3(sin(angle) * r, lift, cos(angle) * r);
  vUv = uv;
  vS = s;
  vProfile = profile;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
${noiseGLSL}
${blackbodyGLSL}
uniform float uTime;
uniform float uSeed;
uniform float uLife;
uniform float uDissolve;
uniform float uTempCore;
uniform float uTempEdge;
uniform float uCoreSharp;
uniform float uLineWidth;
uniform float uLineGlow;
uniform float uBands;
uniform float uCel;
uniform float uPalette;
uniform float uShred;
uniform float uNoiseScale;
uniform float uFlow;
uniform float uGlow;
uniform float uOpacity;
uniform vec3 uColorCore;
uniform vec3 uColorMid;
uniform vec3 uColorRim;
varying vec2 vUv;
varying float vS;
varying float vProfile;
void main() {
  if (vS < 0.0 || vS > 1.0 || vProfile < 0.002) discard;
  float across = vUv.y;                 // 0 = the blade's edge, 1 = inner fringe
  float s = vS;                         // 0 = tail, 1 = head
  vec3 q = vec3(vUv.x * uNoiseScale - uTime * uFlow, across * 2.3, uSeed);
  float n = fbm3(q) * 0.5 + 0.5;
  float n2 = snoise01(vec3(vUv.x * uNoiseScale * 2.7 + uSeed, across * 5.0, uTime * 3.0));

  // ragged inner edge: tongues of flame lick inward, more toward the tail
  float edge = 1.0 - uShred * (0.35 + 0.65 * n) * (0.4 + 0.6 * (1.0 - s));
  if (across > edge) discard;
  // the burn-away eats from the tail forward
  float keep = 0.55 * n + 0.45 * n2 + 0.35 * s;
  if (uDissolve > 0.0 && keep < uDissolve * 1.35) discard;

  // heat: hottest on the edge, near the head, while fresh
  float heat = pow(clamp(1.0 - across / max(edge, 1e-3), 0.0, 1.0), uCoreSharp);
  heat *= 0.3 + 0.7 * smoothstep(0.0, 0.85, s);
  heat *= uLife;
  heat = clamp(heat + 0.12 * (n - 0.5), 0.0, 1.0);
  float stepped = floor(heat * uBands + 0.5) / max(uBands, 1.0);
  float h = mix(heat, stepped, uCel);

  float kelvin = mix(uTempEdge, uTempCore, h);
  vec3 thermalColor = blackbody(kelvin) * (0.25 + 1.75 * h * h);
  vec3 cel = mix(mix(uColorRim, uColorMid, smoothstep(0.0, 0.5, h)), uColorCore, smoothstep(0.5, 1.0, h));
  vec3 color = mix(thermalColor, cel, uPalette);

  // the hairline of white-hot steel along the cut itself
  float line = 1.0 - smoothstep(0.0, uLineWidth, across);
  color += vec3(1.0, 0.97, 0.9) * line * uLineGlow * uLife * smoothstep(0.05, 0.6, s);

  float alpha = uOpacity * (0.35 + 0.65 * smoothstep(1.0, 0.0, across)) * smoothstep(0.0, 0.08, s);
  gl_FragColor = vec4(color * uGlow * alpha, alpha);
}
`;

export class SlashArcs {
  constructor(capacity = 12) {
    this.geometry = buildBand();
    this.slots = [];
    this.meshes = [];
    for (let i = 0; i < capacity; i++) {
      const material = new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: DoubleSide,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: 0 },
          uRadius: { value: 1.4 },
          uWidth: { value: 0.5 },
          uArc: { value: 2.6 },
          uHead: { value: 0 },
          uTrail: { value: 0.7 },
          uFlip: { value: 0 },
          uBow: { value: 0.4 },
          uLife: { value: 1 },
          uDissolve: { value: 0 },
          uTempCore: { value: 6500 },
          uTempEdge: { value: 1500 },
          uCoreSharp: { value: 1.6 },
          uLineWidth: { value: 0.08 },
          uLineGlow: { value: 2 },
          uBands: { value: 4 },
          uCel: { value: 0.8 },
          uPalette: { value: 0.35 },
          uShred: { value: 0.45 },
          uNoiseScale: { value: 7 },
          uFlow: { value: 1.5 },
          uGlow: { value: 2 },
          uOpacity: { value: 1 },
          uColorCore: { value: new Color('#fff8e6') },
          uColorMid: { value: new Color('#ffb02e') },
          uColorRim: { value: new Color('#ff3d10') }
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT
      });
      const mesh = new Mesh(this.geometry, material);
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      mesh.layers.set(LAYER.VFX);
      mesh.renderOrder = 13;
      mesh.visible = false;
      mesh.raycast = () => {};
      this.meshes.push(mesh);
      this.slots.push({
        mesh,
        live: false,
        timer: 0,
        delay: 0,
        scale: 1,
        flip: 0,
        onDraw: null,
        drawn: false,
        center: new Vector3(),
        forward: new Vector3()
      });
    }
  }

  /**
   * Queue one cut.
   * @param {Vector3} center    pivot of the arc (where the hand would be)
   * @param {Vector3} forward   flat direction the middle of the arc points
   * @param {number} roll       radians about `forward`: 0 = flat horizontal cut,
   *                            ±π/2 = vertical, in between = diagonal
   * @param {object} o          { delay, scale, flip, onDraw }
   */
  spawn(center, forward, roll, o = {}) {
    const slot = this.slots.find((s) => !s.live) ?? this.slots[0];
    slot.live = true;
    slot.timer = 0;
    slot.delay = o.delay ?? 0;
    slot.scale = o.scale ?? 1;
    slot.flip = o.flip ? 1 : 0;
    slot.onDraw = o.onDraw ?? null;
    slot.drawn = false;
    slot.center.copy(center);
    slot.forward.copy(forward).normalize();

    _z.copy(slot.forward);
    _x.crossVectors(UP, _z).normalize();
    _y.crossVectors(_z, _x);
    // roll the arc's plane about the forward axis
    const c = Math.cos(roll);
    const s = Math.sin(roll);
    const rx = _x.x * c + _y.x * s, ry = _x.y * c + _y.y * s, rz = _x.z * c + _y.z * s;
    const ux = _y.x * c - _x.x * s, uy = _y.y * c - _x.y * s, uz = _y.z * c - _x.z * s;
    _m.set(rx, ux, _z.x, center.x, ry, uy, _z.y, center.y, rz, uz, _z.z, center.z, 0, 0, 0, 1);
    slot.mesh.matrix.copy(_m);
    slot.mesh.matrixWorldNeedsUpdate = true;
    slot.mesh.material.uniforms.uSeed.value = Math.random() * 50;
    slot.mesh.material.uniforms.uFlip.value = slot.flip;
    slot.mesh.material.uniforms.uHead.value = 0;
    slot.mesh.visible = false;
    return slot;
  }

  /**
   * @param {number} dt
   * @param {number} time  clock for the flame scroll
   * @param {object} c     the ability's flat config (slash* keys)
   */
  update(dt, time, c) {
    let live = 0;
    const sweep = Math.max(0.02, c.slashSweep);
    const hold = Math.max(0, c.slashHold);
    const fade = Math.max(0.02, c.slashFade);
    const trail = Math.max(0.05, c.slashTrail);
    for (const slot of this.slots) {
      if (!slot.live) continue;
      slot.timer += dt;
      const t = slot.timer - slot.delay;
      if (t < 0) continue;
      live++;
      const u = slot.mesh.material.uniforms;
      // head races round in `sweep`, the tail catches up over hold
      const draw = Math.min(1, t / sweep);
      const head = 1 - (1 - draw) * (1 - draw) * (1 - draw); // snap out, ease in
      const after = Math.max(0, t - sweep);
      u.uHead.value = head + Math.min(trail, (after / Math.max(hold + fade, 1e-3)) * trail * 0.6);
      u.uTrail.value = trail;
      const dissolve = Math.max(0, (t - sweep - hold) / fade);
      u.uDissolve.value = Math.min(1, dissolve);
      u.uLife.value = 1 - 0.55 * Math.min(1, dissolve);
      if (!slot.drawn && draw >= 0.35) {
        slot.drawn = true;
        slot.onDraw?.(slot);
      }
      u.uTime.value = time;
      u.uRadius.value = c.slashRadius * slot.scale;
      u.uWidth.value = c.slashWidth * slot.scale;
      u.uArc.value = c.slashArc;
      u.uBow.value = c.slashBow;
      u.uTempCore.value = c.slashTempCore;
      u.uTempEdge.value = c.slashTempEdge;
      u.uCoreSharp.value = c.slashCoreSharp;
      u.uLineWidth.value = c.slashLineWidth;
      u.uLineGlow.value = c.slashLineGlow;
      u.uBands.value = Math.max(1, Math.round(c.slashBands));
      u.uCel.value = c.slashCel;
      u.uPalette.value = c.slashPalette;
      u.uShred.value = c.slashShred;
      u.uNoiseScale.value = c.slashNoiseScale;
      u.uFlow.value = c.slashFlow;
      u.uGlow.value = c.slashGlow;
      u.uOpacity.value = c.slashOpacity;
      copyColor(u.uColorCore.value, c.slashColorCore);
      copyColor(u.uColorMid.value, c.slashColorMid);
      copyColor(u.uColorRim.value, c.slashColorRim);
      slot.mesh.visible = true;
      if (dissolve >= 1) {
        slot.live = false;
        slot.mesh.visible = false;
      }
    }
    return live;
  }

  get busy() {
    return this.slots.some((s) => s.live);
  }

  clear() {
    for (const slot of this.slots) {
      slot.live = false;
      slot.mesh.visible = false;
    }
  }

  dispose() {
    this.geometry.dispose();
    for (const mesh of this.meshes) mesh.material.dispose();
  }
}
