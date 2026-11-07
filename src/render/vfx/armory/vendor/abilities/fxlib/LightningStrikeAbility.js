// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Lightning-VFX (MIT)
 *
 * MIT License
 *
 * Copyright (c) 2026 Sahil K
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
/*!
 * LightningStrikeAbility — fxlib pack.
 *
 * Port of "lightning-vfx" by Sahil K (src/main.js `LightningEffect` +
 * src/shaders/*.glsl): a fractal sky bolt with branches, a ground flash,
 * glowing ground cracks, point sparks, a shockwave ring, additive debris
 * shards, a blue screen flash and a camera jolt.
 *
 * MIT License — Copyright (c) 2026 Sahil K
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, subject to the conditions of the MIT License (the
 * above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software). THE SOFTWARE IS PROVIDED
 * "AS IS", WITHOUT WARRANTY OF ANY KIND.
 *
 * Port notes (sandbox integration):
 *  - The original builds fresh geometry per strike with mergeGeometries and
 *    disposes it afterwards. Here every strike slot owns fixed-capacity
 *    buffers built once, filled at cast time and drawn with a draw range, so
 *    pooling allocates no GPU resources.
 *  - Layer colour/thickness/alpha and every timing value are uniforms read
 *    from `settings.fx_lightningstrike` each frame, so the sliders are live.
 *  - The DOM flash overlay maps onto `ctx.flash`, the camera kick onto
 *    `ctx.shake`; a dynamic light punch is added.
 *  - `strikes > 1` drops a volley of strikes scattered inside the zone.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector3
} from 'three';
import { Ability } from '../Ability.js';
import { LAYER } from '../../core/Layers.js';
import { settings } from '../../config/settings.js';
import { getColor } from '../../utils/color.js';
import {
  boltVS,
  boltFS,
  crackVS,
  crackFS,
  groundFlashVS,
  groundFlashFS,
  shockwaveFS,
  sparksVS,
  sparksFS
} from './lib/lightning/shaders.js';

const ID = 'fx_lightningstrike';

const MAX_STRIKES = 5;
const MAX_MAIN_DEPTH = 8;
const MAX_ALT_DEPTH = 6;
const MAX_BRANCHES = 6;
const LAYERS = 3;
const BOLT_SEGS = ((1 << MAX_MAIN_DEPTH) + MAX_BRANCHES * (1 << MAX_ALT_DEPTH)) * LAYERS;

const MAX_CRACKS = 16;
const MAX_CRACK_DEPTH = 3;
const MAX_CRACK_STEPS = 12;
const CRACK_SEGS = MAX_CRACKS * (MAX_CRACK_DEPTH + 1) * MAX_CRACK_STEPS * 2;

const MAX_SPARKS = 200;
const MAX_DEBRIS = 30;

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => {
  const lo = Math.round(Math.min(a, b));
  const hi = Math.round(Math.max(a, b));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
};

const _v = new Vector3();
const _dir = new Vector3();
const _dummy = new Object3D();
const _fade = new Color();
const _hidden = new Matrix4().makeScale(0, 0, 0);

/** Index buffer for `segs` quads laid out 4 vertices apiece, as the original does. */
function quadIndex(segs) {
  const idx = new Uint32Array(segs * 6);
  for (let i = 0; i < segs; i++) {
    const vi = i * 4;
    idx.set([vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2], i * 6);
  }
  return new BufferAttribute(idx, 1);
}

function dynAttr(count, size) {
  const a = new BufferAttribute(new Float32Array(count * size), size);
  a.setUsage(DynamicDrawUsage);
  return a;
}

/** The original's midpoint-displacement path (returns an array of Vector3). */
function fractalPath(start, end, depth, roughness) {
  if (depth <= 0) return [start.clone(), end.clone()];
  const mid = start.clone().lerp(end, 0.45 + Math.random() * 0.1);
  const dist = start.distanceTo(end);
  mid.x += (Math.random() - 0.5) * dist * roughness;
  mid.z += (Math.random() - 0.5) * dist * roughness;
  const L = fractalPath(start, mid, depth - 1, roughness * 0.88);
  const R = fractalPath(mid, end, depth - 1, roughness * 0.88);
  L.pop();
  return L.concat(R);
}

export class LightningStrikeAbility extends Ability {
  constructor(context) {
    super(ID, context);
  }

  /* ------------------------------------------------------------------ */
  /* Construction                                                        */
  /* ------------------------------------------------------------------ */

  createShaders() {
    this._target = new Vector3();
    this._impactDur = 1;
    this._layerColors = [new Color(), new Color(), new Color()];

    this.planeGeo = new PlaneGeometry(1, 1);
    this.planeGeo.rotateX(-Math.PI / 2);
    this.debrisGeo = new PlaneGeometry(1, 1);
    this.boltIndex = quadIndex(BOLT_SEGS);
    this.crackIndex = quadIndex(CRACK_SEGS);

    this.strikes = [];
    for (let i = 0; i < MAX_STRIKES; i++) this.strikes.push(this._buildStrike());
  }

  _buildStrike() {
    const add = (obj, order) => {
      obj.frustumCulled = false;
      obj.renderOrder = order;
      obj.layers.set(LAYER.VFX);
      obj.visible = false;
      this.group.add(obj);
      return obj;
    };

    /* --- bolt (all strands × all layers, one draw call) --- */
    const bv = BOLT_SEGS * 4;
    const boltGeo = new BufferGeometry();
    boltGeo.setAttribute('position', dynAttr(bv, 3));
    boltGeo.setAttribute('aDirection', dynAttr(bv, 3));
    boltGeo.setAttribute('aRatio', dynAttr(bv, 1));
    boltGeo.setAttribute('aSide', dynAttr(bv, 1));
    boltGeo.setAttribute('aStrikeOffset', dynAttr(bv, 1));
    boltGeo.setAttribute('aThickMult', dynAttr(bv, 1));
    boltGeo.setAttribute('aAlphaMult', dynAttr(bv, 1));
    boltGeo.setAttribute('aLayer', dynAttr(bv, 1));
    boltGeo.setIndex(this.boltIndex);
    const boltMat = new ShaderMaterial({
      vertexShader: boltVS,
      fragmentShader: boltFS,
      uniforms: {
        uTime: { value: 0 },
        uStrikeDur: { value: 0.15 },
        uFadeDur: { value: 1 },
        uSpread: { value: 0.01 },
        uOrigin: { value: new Vector3() },
        uLayerColor: { value: this._layerColors },
        uLayerThick: { value: new Vector3() },
        uLayerAlpha: { value: new Vector3() },
        uWidthScale: { value: 1 }
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide
    });
    const bolt = add(new Mesh(boltGeo, boltMat), 12);

    /* --- ground flash --- */
    const flashMat = new ShaderMaterial({
      vertexShader: groundFlashVS,
      fragmentShader: groundFlashFS,
      uniforms: {
        uTime: { value: -0.13 },
        uDur: { value: 0.45 },
        uColor: { value: new Color() },
        uIntensity: { value: 0.35 },
        uRadialPow: { value: 1.2 },
        uFadePow: { value: 1.5 }
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false
    });
    const flash = add(new Mesh(this.planeGeo, flashMat), 12);

    /* --- cracks --- */
    const cv = CRACK_SEGS * 4;
    const crackGeo = new BufferGeometry();
    crackGeo.setAttribute('position', dynAttr(cv, 3));
    crackGeo.setAttribute('aRatio', dynAttr(cv, 1));
    crackGeo.setAttribute('aSide', dynAttr(cv, 1));
    crackGeo.setAttribute('aAlpha', dynAttr(cv, 1));
    crackGeo.setAttribute('aFadeMult', dynAttr(cv, 1));
    crackGeo.setIndex(this.crackIndex);
    const crackMat = new ShaderMaterial({
      vertexShader: crackVS,
      fragmentShader: crackFS,
      uniforms: {
        uTime: { value: 0 },
        uDelay: { value: 0.15 },
        uRevealDur: { value: 0.22 },
        uFadeDur: { value: 2.8 },
        uCoreColor: { value: new Color() },
        uMidColor: { value: new Color() },
        uEdgeColor: { value: new Color() }
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide
    });
    const cracks = add(new Mesh(crackGeo, crackMat), 11);

    /* --- sparks --- */
    const sparkGeo = new BufferGeometry();
    sparkGeo.setAttribute('position', dynAttr(MAX_SPARKS, 3));
    sparkGeo.setAttribute('aVelocity', dynAttr(MAX_SPARKS, 3));
    sparkGeo.setAttribute('aLifetime', dynAttr(MAX_SPARKS, 1));
    sparkGeo.setAttribute('aSeed', dynAttr(MAX_SPARKS, 1));
    const sparkMat = new ShaderMaterial({
      vertexShader: sparksVS,
      fragmentShader: sparksFS,
      uniforms: {
        uTime: { value: 0 },
        uDelay: { value: 0.15 },
        uSize: { value: 2.5 },
        uGravity: { value: 9.5 },
        uDepthScale: { value: 160 },
        uPixelRatio: { value: 1 },
        uHot: { value: new Color() },
        uMid: { value: new Color() },
        uCool: { value: new Color() }
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false
    });
    const sparks = add(new Points(sparkGeo, sparkMat), 13);

    /* --- shockwave --- */
    const shockMat = new ShaderMaterial({
      vertexShader: groundFlashVS,
      fragmentShader: shockwaveFS,
      uniforms: {
        uTime: { value: 0 },
        uDelay: { value: 0.15 },
        uDur: { value: 0.55 },
        uAlphaMult: { value: 0.4 },
        uColorA: { value: new Color() },
        uColorB: { value: new Color() }
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false
    });
    const shock = add(new Mesh(this.planeGeo, shockMat), 11);

    /* --- debris --- */
    const debrisMat = new MeshBasicMaterial({
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide
    });
    const debris = add(new InstancedMesh(this.debrisGeo, debrisMat, MAX_DEBRIS), 12);
    debris.instanceMatrix.setUsage(DynamicDrawUsage);
    for (let i = 0; i < MAX_DEBRIS; i++) {
      debris.setMatrixAt(i, _hidden);
      debris.setColorAt(i, _fade.setRGB(0, 0, 0));
    }
    debris.instanceColor.setUsage(DynamicDrawUsage);
    const shards = [];
    for (let i = 0; i < MAX_DEBRIS; i++) {
      shards.push({
        sx: 1,
        sy: 1,
        color: new Color(),
        pos: new Vector3(),
        rot: new Euler(),
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        lifetime: 1,
        t: 0,
        active: false
      });
    }

    return {
      bolt,
      flash,
      cracks,
      sparks,
      shock,
      debris,
      shards,
      debrisCount: 0,
      x: 0,
      z: 0,
      start: 0, // ability age at which this strike begins
      fired: false,
      landed: false,
      done: true
    };
  }

  /* ------------------------------------------------------------------ */
  /* Timing                                                              */
  /* ------------------------------------------------------------------ */

  get impactDuration() {
    return this._impactDur;
  }

  get fadeDuration() {
    return Math.max(0.05, settings[ID].fadeTime);
  }

  /** Same horizon the original uses before it disposes a strike. */
  _strikeSpan() {
    const p = settings[ID];
    return Math.max(
      p.strikeDur + p.fadeDur + 0.15,
      p.strikeDur + p.crackReveal + p.crackFade + 0.5
    );
  }

  lightShimmer() {
    return 1;
  }

  /* ------------------------------------------------------------------ */
  /* Casting                                                             */
  /* ------------------------------------------------------------------ */

  onSpawn() {
    const p = settings[ID];
    this.pointAt(1, this._target);
    const n = Math.max(1, Math.min(MAX_STRIKES, Math.round(p.strikes)));
    this._count = n;
    for (let i = 0; i < MAX_STRIKES; i++) {
      const s = this.strikes[i];
      s.fired = false;
      s.landed = false;
      s.done = i >= n;
      s.start = i * p.strikeInterval;
      this._hideStrike(s);
    }
    this._impactDur = 1;
    this._tick(0);
  }

  onTravel(dt) {
    this._tick(dt);
  }

  onImpact() {
    const p = settings[ID];
    const total = Math.max(p.lifetime, (this._count - 1) * p.strikeInterval + this._strikeSpan());
    this._impactDur = Math.max(0.05, total - this.age);
  }

  onFade(dt) {
    this._tick(dt);
  }

  onDestroy() {
    for (const s of this.strikes) this._hideStrike(s);
  }

  _hideStrike(s) {
    s.bolt.visible = s.flash.visible = s.cracks.visible = false;
    s.sparks.visible = s.shock.visible = s.debris.visible = false;
  }

  /* ------------------------------------------------------------------ */
  /* Per frame                                                           */
  /* ------------------------------------------------------------------ */

  _tick(dt) {
    const p = settings[ID];
    const span = this._strikeSpan();

    for (let i = 0; i < this._count; i++) {
      const s = this.strikes[i];
      if (s.done) continue;
      if (!s.fired) {
        if (this.age < s.start) continue;
        this._fire(s, i);
      }
      const elapsed = this.age - s.start;

      if (!s.landed && elapsed >= p.strikeDur) {
        s.landed = true;
        this.ctx.shake.add(p.shakeOnStrike, p.shakeDecay, 22);
        this.lightBoost = Math.max(this.lightBoost, p.lightStrikeBoost);
        for (let k = 0; k < s.debrisCount; k++) s.shards[k].active = true;
      }

      this._syncStrike(s, elapsed);
      if (s.landed) this._stepDebris(s, dt);

      if (elapsed > span) {
        s.done = true;
        this._hideStrike(s);
      }
    }

    // Keep the light over the strike rather than on the travelling front.
    this.position.copy(this._target);
    this.position.y = p.lightHeight;
  }

  _syncStrike(s, elapsed) {
    const p = settings[ID];

    const bu = s.bolt.material.uniforms;
    bu.uTime.value = elapsed;
    bu.uStrikeDur.value = p.strikeDur;
    bu.uFadeDur.value = p.fadeDur;
    bu.uSpread.value = p.boltSpread;
    bu.uWidthScale.value = p.boltWidthScale;
    this._layerColors[0].copy(getColor(p.layer1Color));
    this._layerColors[1].copy(getColor(p.layer2Color));
    this._layerColors[2].copy(getColor(p.layer3Color));
    bu.uLayerThick.value.set(p.layer1Thick, p.layer2Thick, p.layer3Thick);
    bu.uLayerAlpha.value.set(p.layer1Alpha, p.layer2Alpha, p.layer3Alpha);

    const fu = s.flash.material.uniforms;
    fu.uTime.value = elapsed - p.strikeDur;
    fu.uDur.value = p.groundFlashDur;
    fu.uIntensity.value = p.groundFlashIntensity;
    fu.uRadialPow.value = p.groundFlashRadialPow;
    fu.uFadePow.value = p.groundFlashFadePow;
    fu.uColor.value.copy(getColor(p.groundFlashColor));
    s.flash.scale.set(p.groundFlashSize, 1, p.groundFlashSize);
    s.flash.updateMatrix();

    const cu = s.cracks.material.uniforms;
    cu.uTime.value = elapsed;
    cu.uDelay.value = p.strikeDur;
    cu.uRevealDur.value = p.crackReveal;
    cu.uFadeDur.value = p.crackFade;
    cu.uCoreColor.value.copy(getColor(p.crackCoreColor));
    cu.uMidColor.value.copy(getColor(p.crackMidColor));
    cu.uEdgeColor.value.copy(getColor(p.crackEdgeColor));

    const su = s.sparks.material.uniforms;
    su.uTime.value = elapsed;
    su.uDelay.value = p.strikeDur;
    su.uSize.value = p.sparkSize;
    su.uGravity.value = p.sparkGravity;
    su.uDepthScale.value = p.sparkDepthScale;
    su.uHot.value.copy(getColor(p.sparkHotColor));
    su.uMid.value.copy(getColor(p.sparkMidColor));
    su.uCool.value.copy(getColor(p.sparkCoolColor));

    const wu = s.shock.material.uniforms;
    wu.uTime.value = elapsed;
    wu.uDelay.value = p.strikeDur;
    wu.uDur.value = p.shockwaveDur;
    wu.uAlphaMult.value = p.shockwaveAlphaMult;
    wu.uColorA.value.copy(getColor(p.shockwaveColorA));
    wu.uColorB.value.copy(getColor(p.shockwaveColorB));
    s.shock.scale.set(p.shockwaveSize, 1, p.shockwaveSize);
    s.shock.updateMatrix();
  }

  _stepDebris(s, dt) {
    const p = settings[ID];
    const mesh = s.debris;
    let dirty = false;
    for (let i = 0; i < s.debrisCount; i++) {
      const d = s.shards[i];
      if (!d.active) continue;
      d.t += dt;
      dirty = true;
      if (d.t >= d.lifetime) {
        d.active = false;
        mesh.setMatrixAt(i, _hidden);
        continue;
      }
      d.pos.x += d.vx * dt;
      d.pos.z += d.vz * dt;
      d.vy -= p.debrisGravity * dt;
      d.pos.y = Math.max(0.05, d.pos.y + d.vy * dt);
      d.rot.x += d.rx * dt;
      d.rot.y += d.ry * dt;
      d.rot.z += d.rz * dt;
      _dummy.position.copy(d.pos);
      _dummy.rotation.copy(d.rot);
      _dummy.scale.set(d.sx, d.sy, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      const life = d.t / d.lifetime;
      const fade = Math.max(0, (1 - Math.pow(life, p.debrisFadePower)) * p.debrisFadeMult);
      mesh.setColorAt(i, _fade.copy(d.color).multiplyScalar(fade));
    }
    if (dirty) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Spawning one strike (the original's spawnAt)                        */
  /* ------------------------------------------------------------------ */

  _fire(s, index) {
    const p = settings[ID];
    s.fired = true;

    let cx = this._target.x;
    let cz = this._target.z;
    if (index > 0) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * p.strikeScatter * p.zoneRadius;
      cx += Math.cos(a) * r;
      cz += Math.sin(a) * r;
    }
    s.x = cx;
    s.z = cz;

    this._buildBolt(s);
    s.bolt.material.uniforms.uOrigin.value.set(cx, 0, cz);

    s.flash.position.set(cx, 0.2, cz);
    s.flash.matrixAutoUpdate = false;

    this._buildCracks(s, cx, cz);
    this._buildSparks(s, cx, cz);

    s.shock.position.set(cx, 0.06, cz);
    s.shock.matrixAutoUpdate = false;

    this._buildDebris(s, cx, cz);

    s.bolt.visible = s.flash.visible = s.cracks.visible = true;
    s.sparks.visible = s.shock.visible = s.debris.visible = true;

    this.ctx.flash.trigger(
      getColor(p.overlayTint),
      p.overlayMaxAlpha,
      Math.exp(-Math.max(0.1, p.overlayDecay))
    );
  }

  _buildBolt(s) {
    const p = settings[ID];
    const height = rand(p.spawnHeightMin, p.spawnHeightMax);
    const roughness = rand(p.roughnessMin, p.roughnessMax);
    // Relative to the strike point; the shader adds uOrigin.
    const top = new Vector3((Math.random() - 0.5) * p.spawnTopXZJitter, height, (Math.random() - 0.5) * p.spawnTopXZJitter);
    const bottom = new Vector3(0, 0, 0);
    const mainDepth = Math.max(1, Math.min(MAX_MAIN_DEPTH, Math.round(p.mainFractalDepth)));
    const altDepth = Math.max(1, Math.min(MAX_ALT_DEPTH, Math.round(p.altFractalDepth)));
    const mainPoints = fractalPath(top, bottom, mainDepth, roughness);

    const strands = [{ points: mainPoints, offset: 0, thick: p.mainStrandThickMult, alpha: p.mainStrandAlphaMult }];
    const bc = Math.min(MAX_BRANCHES, randInt(p.branchCountMin, p.branchCountMax));
    for (let b = 0; b < bc; b++) {
      const ff = rand(p.branchFFMin, p.branchFFMax);
      const fi = Math.floor(ff * (mainPoints.length - 1));
      const fp = mainPoints[fi].clone();
      const ba = Math.random() * Math.PI * 2;
      const bl = (1 - ff) * height * rand(p.branchLengthFactorMin, p.branchLengthFactorMax);
      const be = fp.clone();
      be.x += Math.cos(ba) * bl * p.branchXZScaleX;
      be.y -= bl * rand(p.branchDropFactorMin, p.branchDropFactorMax);
      be.z += Math.sin(ba) * bl * p.branchXZScaleZ;
      be.y = Math.max(be.y, p.branchMinYClampOffset + Math.random() * p.branchEndYJitter);
      strands.push({
        points: fractalPath(fp, be, altDepth, roughness * p.altRoughnessMult),
        offset: ff,
        thick: p.altStrandThickMult,
        alpha: p.altStrandAlphaMult
      });
    }

    const g = s.bolt.geometry;
    const pos = g.attributes.position.array;
    const dirs = g.attributes.aDirection.array;
    const ratios = g.attributes.aRatio.array;
    const sides = g.attributes.aSide.array;
    const offs = g.attributes.aStrikeOffset.array;
    const thick = g.attributes.aThickMult.array;
    const alph = g.attributes.aAlphaMult.array;
    const layer = g.attributes.aLayer.array;

    let seg = 0;
    for (const st of strands) {
      const pts = st.points;
      const segs = pts.length - 1;
      for (let l = 0; l < LAYERS; l++) {
        for (let i = 0; i < segs && seg < BOLT_SEGS; i++, seg++) {
          const a = pts[i];
          const b = pts[i + 1];
          const rA = i / segs;
          const rB = (i + 1) / segs;
          _dir.subVectors(b, a).normalize();
          const vi = seg * 4;
          for (let j = 0; j < 4; j++) {
            const q = j < 2 ? a : b;
            const k = (vi + j) * 3;
            pos[k] = q.x;
            pos[k + 1] = q.y;
            pos[k + 2] = q.z;
            dirs[k] = _dir.x;
            dirs[k + 1] = _dir.y;
            dirs[k + 2] = _dir.z;
            ratios[vi + j] = j < 2 ? rA : rB;
            sides[vi + j] = j % 2 === 0 ? -0.5 : 0.5;
            offs[vi + j] = st.offset;
            thick[vi + j] = st.thick;
            alph[vi + j] = st.alpha;
            layer[vi + j] = l;
          }
        }
      }
    }
    for (const name of ['position', 'aDirection', 'aRatio', 'aSide', 'aStrikeOffset', 'aThickMult', 'aAlphaMult', 'aLayer']) {
      g.attributes[name].needsUpdate = true;
    }
    g.setDrawRange(0, seg * 6);
  }

  _crackBranches(origin, angle, length, depth, roughness, all) {
    const p = settings[ID];
    const steps = Math.min(MAX_CRACK_STEPS, randInt(p.crackBranchStepsMin, p.crackBranchStepsMax));
    const points = [origin.clone()];
    let cur = origin.clone();
    for (let i = 0; i < steps; i++) {
      angle += (Math.random() - 0.5) * roughness;
      const step = (length / steps) * (0.6 + Math.random() * 0.8);
      cur = cur.clone();
      cur.x += Math.cos(angle) * step;
      cur.z += Math.sin(angle) * step;
      cur.y = origin.y;
      points.push(cur.clone());
    }
    all.push(points);
    if (depth > 0 && points.length > 2 && Math.random() < p.crackBranchChance) {
      const fi = 1 + Math.floor(Math.random() * (points.length - 2));
      const sign = Math.random() > 0.5 ? 1 : -1;
      this._crackBranches(
        points[fi].clone(),
        angle + sign * rand(p.crackBranchAngleOffsetMin, p.crackBranchAngleOffsetMax),
        length * rand(p.crackBranchLengthScaleMin, p.crackBranchLengthScaleMax),
        depth - 1,
        roughness * 0.9,
        all
      );
    }
  }

  _buildCracks(s, cx, cz) {
    const p = settings[ID];
    const g = s.cracks.geometry;
    const pos = g.attributes.position.array;
    const ratios = g.attributes.aRatio.array;
    const sides = g.attributes.aSide.array;
    const alpha = g.attributes.aAlpha.array;
    const fadeMul = g.attributes.aFadeMult.array;
    let seg = 0;

    const writeRibbon = (pts, hw, passAlpha, fadeMult) => {
      const segs = pts.length - 1;
      for (let i = 0; i < segs && seg < CRACK_SEGS; i++, seg++) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const px = (-dz / len) * hw;
        const pz = (dx / len) * hw;
        const vi = seg * 4;
        for (let j = 0; j < 4; j++) {
          const q = j < 2 ? a : b;
          const sd = j % 2 === 0 ? -1 : 1;
          const k = (vi + j) * 3;
          pos[k] = q.x + sd * px;
          pos[k + 1] = q.y;
          pos[k + 2] = q.z + sd * pz;
          ratios[vi + j] = (j < 2 ? i : i + 1) / segs;
          sides[vi + j] = sd;
          alpha[vi + j] = passAlpha;
          fadeMul[vi + j] = fadeMult;
        }
      }
    };

    const n = Math.min(MAX_CRACKS, randInt(p.crackCountMin, p.crackCountMax));
    const depth = Math.max(0, Math.min(MAX_CRACK_DEPTH, Math.round(p.crackBranchDepth)));
    const origin = new Vector3(cx, p.crackOriginYOffset, cz);
    for (let m = 0; m < n; m++) {
      const angle = (m / n) * Math.PI * 2 + (Math.random() - 0.5) * p.crackAngleJitter;
      const length = rand(p.crackLengthMin, p.crackLengthMax);
      const branches = [];
      this._crackBranches(origin, angle, length, depth, p.crackRoughness, branches);
      for (const pts of branches) {
        writeRibbon(pts, p.crackThinHW, p.crackThinAlpha, 1.0);
        writeRibbon(pts, p.crackThickHW, p.crackThickAlpha, p.crackThickFadeMult);
      }
    }
    for (const name of ['position', 'aRatio', 'aSide', 'aAlpha', 'aFadeMult']) g.attributes[name].needsUpdate = true;
    g.setDrawRange(0, seg * 6);
  }

  _buildSparks(s, cx, cz) {
    const p = settings[ID];
    const count = Math.min(MAX_SPARKS, randInt(p.sparkCountMin, p.sparkCountMax));
    const g = s.sparks.geometry;
    const pos = g.attributes.position.array;
    const vel = g.attributes.aVelocity.array;
    const life = g.attributes.aLifetime.array;
    const seeds = g.attributes.aSeed.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3] = cx + (Math.random() - 0.5) * p.sparkPosJitter;
      pos[i * 3 + 1] = p.sparkPosYOffset;
      pos[i * 3 + 2] = cz + (Math.random() - 0.5) * p.sparkPosJitter;
      const a = Math.random() * Math.PI * 2;
      const spd = rand(p.sparkVelocitySpdMin, p.sparkVelocitySpdMax);
      vel[i * 3] = Math.cos(a) * spd;
      vel[i * 3 + 1] = rand(p.sparkVelocityUpMin, p.sparkVelocityUpMax);
      vel[i * 3 + 2] = Math.sin(a) * spd;
      life[i] = Math.max(0.01, rand(p.sparkLifeMin, p.sparkLifeMax));
      seeds[i] = Math.random();
    }
    for (const name of ['position', 'aVelocity', 'aLifetime', 'aSeed']) g.attributes[name].needsUpdate = true;
    g.setDrawRange(0, count);
  }

  _debrisColor(out) {
    const p = settings[ID];
    if (Math.random() < p.debrisBlueChance) {
      return out.setHSL(rand(p.debrisBlueHueMin, p.debrisBlueHueMax), p.debrisBlueSat, rand(p.debrisBlueLightMin, p.debrisBlueLightMax));
    }
    return out.setRGB(rand(0.3, 0.6), rand(0.3, 0.5), rand(0.3, 0.5));
  }

  _buildDebris(s, cx, cz) {
    const p = settings[ID];
    const count = Math.min(MAX_DEBRIS, randInt(p.debrisCountMin, p.debrisCountMax));
    s.debrisCount = count;
    const mesh = s.debris;
    for (let i = 0; i < MAX_DEBRIS; i++) {
      const d = s.shards[i];
      if (i >= count) {
        d.active = false;
        mesh.setMatrixAt(i, _hidden);
        continue;
      }
      d.sx = rand(p.debrisWMin, p.debrisWMax);
      d.sy = rand(p.debrisHMin, p.debrisHMax);
      d.pos.set(cx, p.debrisBaseYOffset, cz);
      d.rot.set(0, 0, 0);
      this._debrisColor(d.color);
      const a = Math.random() * Math.PI * 2;
      const spd = rand(p.debrisVelocitySpdMin, p.debrisVelocitySpdMax);
      d.vx = Math.cos(a) * spd;
      d.vy = rand(p.debrisVelocityUpMin, p.debrisVelocityUpMax);
      d.vz = Math.sin(a) * spd;
      d.rx = (Math.random() - 0.5) * p.debrisRotationScale;
      d.ry = (Math.random() - 0.5) * p.debrisRotationScale;
      d.rz = (Math.random() - 0.5) * p.debrisRotationScale;
      d.lifetime = rand(p.debrisLifetimeMin, p.debrisLifetimeMax);
      d.t = 0;
      d.active = false;
      _dummy.position.copy(d.pos);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(d.sx, d.sy, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      mesh.setColorAt(i, d.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    super.dispose();
    for (const s of this.strikes) {
      s.bolt.geometry.dispose();
      s.bolt.material.dispose();
      s.flash.material.dispose();
      s.cracks.geometry.dispose();
      s.cracks.material.dispose();
      s.sparks.geometry.dispose();
      s.sparks.material.dispose();
      s.shock.material.dispose();
      s.debris.material.dispose();
      s.debris.dispose();
    }
    this.planeGeo.dispose();
    this.debrisGeo.dispose();
  }
}

