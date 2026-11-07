// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * SavePointMesh — WebGL / GLSL re-implementation of the ICS "Magic Circle"
 * save point.
 *
 * Ported from ICS INC. `ics-magic-circle` (src/effects/MagicCircle.ts,
 * Pillar.ts, Swirl.ts, src/particles/*, src/objects/SavePoint.ts). The original
 * runs on WebGPURenderer with gsap tweens; here every layer is a ShaderMaterial
 * and every tween is evaluated analytically from times the ability passes in, so
 * the whole thing is scrubbable and allocation-free per frame. Dimensions are
 * the original's (circle radius 3, pillar 3 × 10, swirl torus R4 r1, ground
 * 8.5) and the root is scaled by the ability.
 *
 * MIT License — Copyright (c) 2017 - 2026 ICS INC.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, subject to the conditions of the MIT License (see
 * public/fxlib/ics-magic-circle/LICENSE.txt). THE SOFTWARE IS PROVIDED "AS IS",
 * WITHOUT WARRANTY OF ANY KIND.
 */
import {
  Group,
  Mesh,
  PlaneGeometry,
  CylinderGeometry,
  TorusGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  AdditiveBlending,
  DoubleSide,
  FrontSide,
  TextureLoader,
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  Color,
  Vector2
} from 'three';
import { LAYER } from '../../../../core/Layers.js';

const BASE = `/assets/armory/fxlib/ics-magic-circle/`;

let _tex = null;

/** SVG → 1024² canvas texture (crisper than the SVG's intrinsic 512²). */
function svgTexture(name, size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    texture.needsUpdate = true;
  };
  img.src = BASE + name;
  return texture;
}

function textures() {
  if (_tex) return _tex;
  const loader = new TextureLoader();
  const load = (name, wrapS = false) => {
    const t = loader.load(BASE + name);
    t.colorSpace = SRGBColorSpace;
    if (wrapS) t.wrapS = RepeatWrapping;
    return t;
  };
  _tex = {
    outer: svgTexture('magic-circle-outer.svg'),
    middle: svgTexture('magic-circle-middle.svg'),
    center: svgTexture('magic-circle-center.svg'),
    pillar: load('pillar.png', true),
    swirl: load('swirl.png', true),
    ground: load('ground.png'),
    ball: load('ball.png'),
    spark: load('particle.png')
  };
  return _tex;
}

/* ------------------------------------------------------------------ */
/* One textured additive surface (MeshBasicMaterial color*map, additive) */
/* ------------------------------------------------------------------ */
const SURFACE_VERT = /* glsl */ `
  uniform vec2 uRepeat;
  uniform vec2 uOffset;
  varying vec2 vUv;
  varying vec2 vRawUv;
  varying float vWorldY;
  void main() {
    vRawUv = uv;
    vUv = uv * uRepeat + uOffset;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldY = wp.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const SURFACE_FRAG = /* glsl */ `
  #define TAU 6.283185307179586
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uClipY;
  uniform float uReveal;     // angular draw-on 0..1 (circle layers)
  uniform float uRevealEdge; // brightness of the drawing front
  varying vec2 vUv;
  varying vec2 vRawUv;
  varying float vWorldY;
  void main() {
    if (vWorldY < uClipY) discard;
    vec4 t = texture2D(uMap, vUv);
    vec3 col = t.rgb * uColor;
    float a = t.a * uOpacity;
    #ifdef REVEAL
      vec2 d = vRawUv - 0.5;
      float ang = fract(atan(d.y, d.x) / TAU + 0.25);
      float head = uReveal;
      float m = 1.0 - smoothstep(head - 0.004, head + 0.004, ang);
      if (uReveal >= 0.999) m = 1.0;
      float front = exp(-pow((head - ang) * 28.0, 2.0)) * step(ang, head + 0.01) * (1.0 - step(0.999, uReveal));
      a *= m;
      col += vec3(0.8, 0.95, 1.0) * front * uRevealEdge * t.a;
    #endif
    gl_FragColor = vec4(col, a);
  }
`;

function surface(map, { repeat = [1, 1], offset = [0, 0], side = DoubleSide, reveal = false } = {}) {
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uRepeat: { value: new Vector2(repeat[0], repeat[1]) },
      uOffset: { value: new Vector2(offset[0], offset[1]) },
      uColor: { value: new Color(1, 1, 1) },
      uOpacity: { value: 1 },
      uClipY: { value: -0.05 },
      uReveal: { value: 1 },
      uRevealEdge: { value: 0 }
    },
    defines: reveal ? { REVEAL: '' } : {},
    vertexShader: SURFACE_VERT,
    fragmentShader: SURFACE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side,
    toneMapped: false
  });
}

/* ------------------------------------------------------------------ */
/* Particles: 80 ambient risers (Particle.ts) + 240 wave streaks        */
/* (WaveParticle.ts), gsap timelines evaluated in the vertex shader.   */
/* ------------------------------------------------------------------ */
const AMBIENT = 80;
const WAVE = 240;
const PARTICLE_DISPLAY_SCALE = 0.6;

const PARTICLE_VERT = /* glsl */ `
  #define TAU 6.283185307179586
  attribute vec2 aCorner;
  attribute vec4 aA;     // angle, radius, duration, height
  attribute vec4 aB;     // size, phase|delay, seed, kind (0 orb, 1 spark, 2 wave)
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uWaveTime;
  uniform float uAmbient;
  uniform float uWave;
  uniform float uEnergy;
  uniform float uSparkle;
  uniform float uSeed;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSpark;

  float expoIn(float t) { return t <= 0.0 ? 0.0 : pow(2.0, 10.0 * t - 10.0); }
  float pow4In(float t) { return t * t * t * t; }
  float pow4InOut(float t) { return t < 0.5 ? 8.0 * t * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 4.0) / 2.0; }

  void main() {
    float kind = aB.w;
    float angle = aA.x + uSeed;
    float radius = aA.y;
    float dur = aA.z;
    float height = aA.w;
    float size = aB.x;
    vec3 local;
    vec2 scl;
    float alpha;
    vec3 col = aColor;

    if (kind < 1.5) {
      // Particle.ts: rise 0.5 -> height on expo.in over dur, opacity expo.in
      // to 1 then power4.in out over the last second; drift +/-0.3; twinkle.
      float p = fract(uTime / dur + aB.y);
      float y = 0.5 + (height - 0.5) * expoIn(p);
      float q = p * dur;
      float hold = dur - 1.0;
      alpha = q < hold ? expoIn(q / hold) : 1.0 - pow4In(q - hold);
      float dx = 0.3 * sin(uTime * TAU / (3.0 + aB.z * 2.0) + aB.z * 17.0);
      float dz = 0.3 * cos(uTime * TAU / (3.5 + aB.z * 1.5) + aB.z * 29.0);
      local = vec3(cos(angle) * radius + dx, y, sin(angle) * radius + dz);
      float twinkle = mix(0.7, 1.0, step(0.0, sin(uTime * TAU / (0.1 + aB.z * 0.1) + aB.z * 40.0)));
      float spark = step(0.5, kind);
      float bright = spark > 0.5 ? 0.5 + uSparkle * 0.5 : 0.5 + uEnergy * 0.2 + uSparkle * 0.3;
      col *= twinkle * bright;
      alpha *= uAmbient;
      scl = vec2(size);
      vSpark = spark;
    } else {
      // WaveParticle.ts: delayed one-shot rise, y stretch [s, 4s, s], flicker.
      float tw = uWaveTime - aB.y;
      if (uWaveTime < 0.0 || tw < 0.0 || tw > dur) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        vAlpha = 0.0;
        return;
      }
      float p = tw / dur;
      float y = 0.5 + height * (1.0 - (1.0 - p) * (1.0 - p));
      local = vec3(cos(angle) * radius, y, sin(angle) * radius);
      float sy = p < 0.5 ? size + 3.0 * size * pow4InOut(p * 2.0) : 4.0 * size - 3.0 * size * pow4InOut((p - 0.5) * 2.0);
      scl = vec2(size * 0.5, sy);
      float seg = p * 13.0;
      float i = floor(seg);
      float f = pow4InOut(fract(seg));
      float v0 = mod(i, 2.0) < 0.5 ? 1.0 : 0.7;
      float v1 = mod(i + 1.0, 2.0) < 0.5 ? 1.0 : 0.7;
      if (i >= 12.0) v1 = 0.0;
      alpha = mix(v0, v1, f) * uWave;
      vSpark = 1.0;
    }

    vColor = col;
    vAlpha = alpha;
    vUv = aCorner + 0.5;
    vec4 mv = modelViewMatrix * vec4(local, 1.0);
    float ws = length(modelMatrix[0].xyz);
    mv.xy += aCorner * scl * ws;
    gl_Position = projectionMatrix * mv;
  }
`;
const PARTICLE_FRAG = /* glsl */ `
  uniform sampler2D uOrb;
  uniform sampler2D uSpark;
  uniform float uClipY;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSpark;
  void main() {
    if (vAlpha <= 0.001) discard;
    vec4 t = vSpark > 0.5 ? texture2D(uSpark, vUv) : texture2D(uOrb, vUv);
    gl_FragColor = vec4(t.rgb * vColor, t.a * vAlpha);
  }
`;

function createParticleGeometry() {
  const n = AMBIENT + WAVE;
  const corner = new Float32Array(n * 8);
  const a = new Float32Array(n * 16);
  const b = new Float32Array(n * 16);
  const color = new Float32Array(n * 12);
  const pos = new Float32Array(n * 12);
  const index = [];
  const cs = [-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5];
  const c = new Color();
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const waveColors = [0xffffff, 0xa0e0ff, 0x20c0ff, 0x4080ff];
  for (let i = 0; i < n; i++) {
    let A, B;
    if (i < AMBIENT) {
      const spark = i % 3 !== 0;
      let hex = i % 4 === 0 ? 0x20c0ff : 0x0090ff;
      if (spark) hex = 0x80d8ff;
      c.set(hex).multiplyScalar(spark ? 2 : 1);
      const size = rand(spark ? 0.4 : 0.1, spark ? 0.6 : 0.2);
      const display = spark ? size * PARTICLE_DISPLAY_SCALE : size;
      A = [Math.random() * Math.PI * 2, rand(0.5, 3), rand(6, 10), rand(5, 8)];
      B = [display, Math.random(), Math.random(), spark ? 1 : 0];
    } else {
      const k = i - AMBIENT;
      c.set(waveColors[k % 4]).multiplyScalar(1.5);
      const size = rand(0.2, 0.4) * PARTICLE_DISPLAY_SCALE;
      A = [Math.random() * Math.PI * 2, rand(0, 3), rand(1, 2), rand(6, 10)];
      B = [size, (k % 3) * 0.05 + Math.random() * 0.05, Math.random(), 2];
    }
    for (let v = 0; v < 4; v++) {
      const q = i * 4 + v;
      corner[q * 2] = cs[v * 2];
      corner[q * 2 + 1] = cs[v * 2 + 1];
      a.set(A, q * 4);
      b.set(B, q * 4);
      color.set([c.r, c.g, c.b], q * 3);
    }
    const o = i * 4;
    index.push(o, o + 1, o + 2, o + 2, o + 1, o + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aCorner', new Float32BufferAttribute(corner, 2));
  g.setAttribute('aA', new Float32BufferAttribute(a, 4));
  g.setAttribute('aB', new Float32BufferAttribute(b, 4));
  g.setAttribute('aColor', new Float32BufferAttribute(color, 3));
  g.setIndex(index);
  return g;
}

/* ------------------------------------------------------------------ */

const LAYERS = [
  { key: 'outer', color: 0x0060e0, duration: 20, scale: 1, turn: 1 },
  { key: 'middle', color: 0x00a0ff, duration: 12, scale: 0.7, turn: -1 },
  { key: 'center', color: 0x60d0ff, duration: 8, scale: 1, turn: 1 }
];

/**
 * The whole save point in original units. The ability drives it with
 * `update(dt, state)`; see `MagicCircleAbility` for the timeline.
 */
export class SavePointMesh {
  constructor() {
    const tex = textures();
    this.object3D = new Group();
    this.object3D.name = 'fx_magiccircle.savepoint';

    /* --- magic circle (MagicCircle.ts) --- */
    this.circle = new Group();
    this.layers = [];
    const plane = new PlaneGeometry(6, 6);
    for (const def of LAYERS) {
      const material = surface(tex[def.key], { reveal: true });
      material.uniforms.uColor.value.set(def.color);
      const mesh = new Mesh(plane, material);
      mesh.position.y = 0.1;
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.setScalar(def.scale);
      mesh.renderOrder = 12;
      const layer = new Group();
      layer.add(mesh);
      this.circle.add(layer);
      this.layers.push({ layer, material, base: new Color(def.color), def, angle: 0 });
    }

    /* --- floor effects: ground glow, spread light, swirl (SavePoint.ts) --- */
    this.floor = new Group();
    this.groundMat = surface(tex.ground, { repeat: [0.86, 0.86], offset: [0.07, 0.07] });
    const ground = new Mesh(new PlaneGeometry(8.5, 8.5), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.05;
    ground.renderOrder = 10;

    this.spread = this._pillar(4, 3, 2);
    this.spread.brightness = 0.8;

    this.swirlTex = { offsetX: 0 };
    this.swirlMat = surface(tex.swirl, { offset: [0, -0.25], side: FrontSide });
    const swirl = new Mesh(new TorusGeometry(4, 1, 2, 100), this.swirlMat);
    swirl.position.y = 0.02;
    swirl.rotation.x = Math.PI / 2;
    swirl.renderOrder = 11;
    this.swirl = new Group();
    this.swirl.add(swirl);

    this.floor.add(ground, this.spread.group, this.swirl);

    /* --- main pillar (Pillar.ts) --- */
    this.pillar = this._pillar(3, 3, 10);

    /* --- particles --- */
    this.particleMat = new ShaderMaterial({
      uniforms: {
        uOrb: { value: tex.ball },
        uSpark: { value: tex.spark },
        uTime: { value: 0 },
        uWaveTime: { value: -1 },
        uAmbient: { value: 0 },
        uWave: { value: 1 },
        uEnergy: { value: 0 },
        uSparkle: { value: 0.2 },
        uSeed: { value: 0 },
        uClipY: { value: 0 }
      },
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false
    });
    this.particles = new Mesh(createParticleGeometry(), this.particleMat);
    this.particles.frustumCulled = false;
    this.particles.renderOrder = 15;

    this.object3D.add(this.floor, this.circle, this.pillar.group, this.particles);
    this.object3D.traverse((o) => {
      o.layers.set(LAYER.VFX);
      o.frustumCulled = false;
    });
  }

  _pillar(top, bottom, height) {
    const tex = textures();
    const geometry = new CylinderGeometry(top, bottom, height, 64, 1, true);
    const outerMat = surface(tex.pillar, { repeat: [6, 1] });
    const innerMat = surface(tex.pillar, { repeat: [3, 1] });
    const outer = new Mesh(geometry, outerMat);
    const inner = new Mesh(geometry, innerMat);
    outer.position.y = height / 2;
    inner.position.y = height / 2;
    inner.scale.set(0.95, 1, 0.95);
    outer.renderOrder = 13;
    inner.renderOrder = 14;
    const group = new Group();
    group.add(outer, inner);
    return { group, outerMat, innerMat, outerX: 0, innerX: 0, brightness: 1, height };
  }

  /** Pillar.update(delta, energy). */
  _updatePillar(pl, dt, energy, gain, tint, fade, clipY) {
    pl.group.rotation.y += dt * 0.2;
    pl.outerX += dt * 0.2;
    pl.innerX -= dt * 0.3;
    const o = pl.outerMat.uniforms;
    const i = pl.innerMat.uniforms;
    o.uOffset.value.x = pl.outerX;
    i.uOffset.value.x = pl.innerX;
    o.uColor.value.setRGB(energy * 0.2, 0.3 + energy * 0.4, 1).multiplyScalar((1 + energy * 0.5) * pl.brightness * gain).multiply(tint);
    i.uColor.value.setRGB(energy * 0.4, 0.7 + energy * 0.1, 1).multiplyScalar((1 + energy) * pl.brightness * gain).multiply(tint);
    o.uOpacity.value = (0.25 + energy * 0.25) * fade;
    i.uOpacity.value = o.uOpacity.value * 0.6;
    o.uClipY.value = clipY;
    i.uClipY.value = clipY;
  }

  /**
   * @param {number} dt
   * @param {object} s  see MagicCircleAbility#_sync
   */
  update(dt, s) {
    const energy = s.energy;
    const fade = s.fade;
    const tint = s.tint;

    /* circle layers: entrance scale + angular draw + rotation */
    for (let i = 0; i < this.layers.length; i++) {
      const L = this.layers[i];
      L.angle += dt * L.def.turn * ((Math.PI * 2) / L.def.duration) * (1 + energy * 2) * s.spin;
      L.layer.rotation.y = L.angle;
      L.layer.scale.setScalar(Math.max(1e-4, s.layerScale[i]));
      L.layer.visible = s.layerScale[i] > 0.001;
      const u = L.material.uniforms;
      u.uColor.value.copy(L.base).multiply(tint).multiplyScalar(s.circleGain);
      u.uOpacity.value = (0.3 + energy * 0.6) * fade;
      u.uReveal.value = s.layerReveal[i];
      u.uRevealEdge.value = s.revealEdge;
    }
    this.circle.rotation.y = s.circleTurn;

    /* floor */
    this.floor.scale.set(Math.max(1e-4, s.floorScale), 1, Math.max(1e-4, s.floorScale));
    this.floor.visible = s.floorScale > 0.001;
    this.groundMat.uniforms.uColor.value.setRGB(energy * 0.4, 0.4 + energy * 0.4, 1).multiply(tint).multiplyScalar(s.groundGain);
    this.groundMat.uniforms.uOpacity.value = (0.65 + energy * 0.15) * fade;

    const speed = 0.1 + energy * 0.4;
    this.swirl.rotation.y -= dt * speed;
    this.swirlTex.offsetX -= dt * speed;
    this.swirlMat.uniforms.uOffset.value.x = this.swirlTex.offsetX;
    this.swirlMat.uniforms.uColor.value.setRGB(energy * 0.8, 0.5 + energy * 0.4, 1).multiplyScalar((1 + energy * 0.8) * s.swirlGain).multiply(tint);
    this.swirlMat.uniforms.uOpacity.value = (0.35 + energy * 0.2) * fade;

    this._updatePillar(this.spread, dt, energy, s.spreadGain, tint, fade, -0.05);

    /* main pillar: rises out of the floor, height breathes with energy */
    this.pillar.group.position.y = s.pillarY;
    this.pillar.group.scale.set(s.pillarWidth, (0.8 + energy * 0.2) * s.pillarHeight, s.pillarWidth);
    this.pillar.group.visible = s.pillarGain > 0 && fade > 0.001;
    this._updatePillar(this.pillar, dt, energy, s.pillarGain, tint, fade, s.clipY);

    /* particles */
    const p = this.particleMat.uniforms;
    p.uTime.value = s.time;
    p.uWaveTime.value = s.waveTime;
    p.uAmbient.value = s.ambient * fade;
    p.uWave.value = s.wave * fade;
    p.uEnergy.value = energy;
    p.uSparkle.value = s.sparkle;
    p.uSeed.value = s.seed;
  }

  reset() {
    for (const L of this.layers) L.angle = 0;
  }

  dispose() {
    this.object3D.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
