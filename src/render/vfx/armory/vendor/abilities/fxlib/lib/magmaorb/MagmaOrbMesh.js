// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * MagmaOrbMesh — WebGL / GLSL re-implementation of the ICS "Magma Flare" orb.
 *
 * Ported from ICS INC. `ics-magma-orb` (src/magmaFlare/*: Magma, Aura, InGlow,
 * Flare + FlareEmitter, Spark + SparkEmitter, OutGlow). The original is a
 * WebGPU / TSL demo; every layer is rebuilt here as a plain ShaderMaterial so it
 * runs on the sandbox's WebGL renderer. The look (textures, radii, scroll speeds,
 * opacities, spark life cycle) follows the original 1:1, in the original's own
 * units (orb radius 2), and the whole group is scaled by the ability.
 *
 * MIT License — Copyright (c) 2017 - 2026 ICS INC.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, subject to the conditions of the MIT License (see
 * public/fxlib/ics-magma-orb/LICENSE.txt). THE SOFTWARE IS PROVIDED "AS IS",
 * WITHOUT WARRANTY OF ANY KIND.
 */
import {
  Group,
  Mesh,
  SphereGeometry,
  PlaneGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  AdditiveBlending,
  NormalBlending,
  DoubleSide,
  FrontSide,
  TextureLoader,
  RepeatWrapping,
  SRGBColorSpace,
  Color,
  Vector2,
  Euler,
  Vector3,
  Matrix4
} from 'three';
import { LAYER } from '../../../../core/Layers.js';

const BASE = `/assets/armory/fxlib/ics-magma-orb/`;

/* Original constants (src/magmaFlare/*). */
const ORB_RADIUS = 2;
const FLARE_INNER = 2;
const FLARE_OUTER = 6;
const FLARE_COUNT = 10;
const SPARK_COUNT = 500;

let _textures = null;
function textures() {
  if (_textures) return _textures;
  const loader = new TextureLoader();
  const load = (name, repeat) => {
    const t = loader.load(BASE + name);
    t.colorSpace = SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
    return t;
  };
  _textures = {
    magma: load('magma.png', true),
    aura: load('aura3_type2.png', true),
    spark: load('Burst01.png', true),
    glow: load('Particle01.png', false)
  };
  return _textures;
}

const SIMPLE_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

/* Magma.ts — MeshBasicMaterial({ map }) with the map scrolling. */
const MAGMA_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uOffset;
  uniform vec3 uTint;
  uniform float uGain;
  uniform float uFade;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(uMap, vUv + uOffset).rgb * uTint * uGain;
    gl_FragColor = vec4(c, uFade);
  }
`;

/* Aura.ts — additive map scrolling over a slightly larger sphere. */
const AURA_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uOffset;
  uniform vec3 uTint;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 t = texture2D(uMap, vUv + uOffset);
    gl_FragColor = vec4(t.rgb * uTint, t.a * uOpacity);
  }
`;

/* InGlow.ts — rim: (1 - saturate(dot(N, V))) * 0.55 in #96ecff. */
const INGLOW_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    float a = (1.0 - clamp(dot(normalize(vNormalV), normalize(vViewDir)), 0.0, 1.0)) * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`;

/* Flare.ts — annulus r 2..6, aura map repeated 10x10 and scrolled.
   color = tex.rgb + (0,0,0.3); opacity = (tex.a + 1) * sin(v*PI) * 0.15 */
const FLARE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FLARE_FRAG = /* glsl */ `
  #define PI 3.141592653589793
  uniform sampler2D uMap;
  uniform vec2 uOffset;
  uniform vec3 uTint;
  uniform float uOpacity;
  uniform float uBlue;
  varying vec2 vUv;
  void main() {
    // Note: the original sets map.repeat(10,10) but samples through a TSL
    // texture() node with a custom uv, which ignores the repeat; so do we.
    vec4 t = texture2D(uMap, vUv + uOffset);
    float radial = clamp(sin(vUv.y * PI), 0.0, 1.0) * 0.15;
    vec3 c = (t.rgb + vec3(0.0, 0.0, uBlue)) * uTint;
    gl_FragColor = vec4(c, (t.a + 1.0) * radial * uOpacity);
  }
`;

/* Spark.ts × 500 — thin 0.1 × 2 planes falling from y = 8 to 0 along their
   own (rotated) axis, opacity 0.5 − 0.01/frame, respawning at 8. All baked
   into one geometry; the life cycle is evaluated analytically per vertex. */
const SPARK_VERT = /* glsl */ `
  attribute vec3 aAxis;
  attribute vec3 aTangent;
  attribute vec2 aCorner;
  attribute vec2 aSeed; // x = speed (units / 16ms frame), y = phase 0..1
  uniform float uTime;
  uniform float uRate;
  uniform float uReach;
  uniform float uLength;
  uniform float uWidth;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    float speed = aSeed.x;
    float life = min(50.0, 8.0 / speed);           // frames until reset
    float frames = uTime * 60.0 * uRate;
    float age = mod(frames + aSeed.y * life, life);
    float y = (8.0 - speed * age) * uReach;
    vAlpha = max(0.0, 0.5 - 0.01 * age);
    vUv = uv;
    vec3 p = aAxis * (y + aCorner.y * uLength) + aTangent * (aCorner.x * uWidth);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const SPARK_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uTint;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    gl_FragColor = vec4(t.rgb * uTint, t.a * vAlpha * uOpacity);
  }
`;

/* OutGlow.ts — Sprite(Particle01) scaled 11, opacity 0.8. */
const GLOW_VERT = /* glsl */ `
  uniform float uScale;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float s = length(modelMatrix[0].xyz);
    mv.xy += position.xy * uScale * s;
    gl_Position = projectionMatrix * mv;
  }
`;
const GLOW_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uTint;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    gl_FragColor = vec4(t.rgb * uTint, t.a * uOpacity);
  }
`;

function createFlareGeometry() {
  const radialSegments = 30;
  const widthSegments = 3;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let y = 0; y <= widthSegments; y++) {
    const v = y / widthSegments;
    const radius = FLARE_INNER + (FLARE_OUTER - FLARE_INNER) * v;
    for (let x = 0; x <= radialSegments; x++) {
      const u = x / radialSegments;
      const theta = u * Math.PI * 2;
      positions.push(Math.cos(theta) * radius, 0, Math.sin(theta) * radius);
      uvs.push(u, v);
    }
  }
  const stride = radialSegments + 1;
  for (let y = 0; y < widthSegments; y++) {
    for (let x = 0; x < radialSegments; x++) {
      const a = y * stride + x;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

function createSparkGeometry() {
  const pos = new Float32Array(SPARK_COUNT * 4 * 3);
  const uv = new Float32Array(SPARK_COUNT * 4 * 2);
  const axis = new Float32Array(SPARK_COUNT * 4 * 3);
  const tangent = new Float32Array(SPARK_COUNT * 4 * 3);
  const corner = new Float32Array(SPARK_COUNT * 4 * 2);
  const seed = new Float32Array(SPARK_COUNT * 4 * 2);
  const index = [];
  const perAngle = 360 / SPARK_COUNT;
  const e = new Euler();
  const m = new Matrix4();
  const ax = new Vector3();
  const tx = new Vector3();
  const corners = [
    [-0.5, -0.5, 0, 0],
    [0.5, -0.5, 1, 0],
    [-0.5, 0.5, 0, 1],
    [0.5, 0.5, 1, 1]
  ];
  for (let i = 0; i < SPARK_COUNT; i++) {
    const rad = (perAngle * i * Math.PI) / 180;
    // SparkEmitter: parent rotation.x = 360*sin(rad), rotation.z = rad;
    // Spark mesh rotation.y = random*2 (spins the plane about its own axis).
    e.set(360 * Math.sin(rad), 0, rad, 'XYZ');
    m.makeRotationFromEuler(e);
    ax.set(0, 1, 0).applyMatrix4(m).normalize();
    const spin = Math.random() * 2;
    tx.set(Math.cos(spin), 0, -Math.sin(spin)).applyMatrix4(m).normalize();
    const speed = Math.random() * 0.2 + 0.1;
    const phase = Math.random();
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k;
      const [cx, cy, u, w] = corners[k];
      corner[v * 2] = cx;
      corner[v * 2 + 1] = cy;
      uv[v * 2] = u;
      uv[v * 2 + 1] = w;
      axis.set([ax.x, ax.y, ax.z], v * 3);
      tangent.set([tx.x, tx.y, tx.z], v * 3);
      seed[v * 2] = speed;
      seed[v * 2 + 1] = phase;
    }
    const b = i * 4;
    index.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('aAxis', new Float32BufferAttribute(axis, 3));
  g.setAttribute('aTangent', new Float32BufferAttribute(tangent, 3));
  g.setAttribute('aCorner', new Float32BufferAttribute(corner, 2));
  g.setAttribute('aSeed', new Float32BufferAttribute(seed, 2));
  g.setIndex(index);
  return g;
}

function mat(vertexShader, fragmentShader, uniforms, opts = {}) {
  return new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    ...opts
  });
}

/**
 * The full orb in original units (radius 2). Call `update(time, params)` each
 * frame; scale `object3D` to size it.
 */
export class MagmaOrbMesh {
  constructor() {
    const tex = textures();
    this.object3D = new Group();
    this.object3D.name = 'fx_magmaorb.orb';

    /* Magma */
    this.magmaMat = mat(SIMPLE_VERT, MAGMA_FRAG, {
      uMap: { value: tex.magma },
      uOffset: { value: new Vector2() },
      uTint: { value: new Color(1, 1, 1) },
      uGain: { value: 1 },
      uFade: { value: 1 }
    }, { blending: NormalBlending, depthWrite: true });
    this.magma = new Mesh(new SphereGeometry(ORB_RADIUS, 40, 40), this.magmaMat);
    this.magma.renderOrder = 9;

    /* Aura */
    this.auraMat = mat(SIMPLE_VERT, AURA_FRAG, {
      uMap: { value: tex.aura },
      uOffset: { value: new Vector2() },
      uTint: { value: new Color(1, 1, 1) },
      uOpacity: { value: 1 }
    });
    this.aura = new Mesh(new SphereGeometry(2.02, 40, 40), this.auraMat);
    this.aura.renderOrder = 10;

    /* Glow inside */
    this.inGlowMat = mat(SIMPLE_VERT, INGLOW_FRAG, {
      uColor: { value: new Color(0x96ecff) },
      uOpacity: { value: 0.55 }
    }, { side: FrontSide });
    this.inGlow = new Mesh(new SphereGeometry(2.03, 40, 40), this.inGlowMat);
    this.inGlow.renderOrder = 11;

    /* Flares */
    this.flares = new Group();
    this.flareMats = [];
    this.flareRatios = [];
    const flareGeo = createFlareGeometry();
    const perAngle = 360 / FLARE_COUNT;
    for (let i = 0; i < FLARE_COUNT; i++) {
      const rad = (perAngle * i * Math.PI) / 180;
      const m = mat(FLARE_VERT, FLARE_FRAG, {
        uMap: { value: tex.aura },
        uOffset: { value: new Vector2() },
        uTint: { value: new Color(1, 1, 1) },
        uOpacity: { value: 1 },
        uBlue: { value: 0.3 }
      }, { side: DoubleSide });
      const mesh = new Mesh(flareGeo, m);
      mesh.rotation.set(rad, rad, rad / 2);
      mesh.renderOrder = 20;
      this.flares.add(mesh);
      this.flareMats.push(m);
      this.flareRatios.push(Math.random() + 1);
    }

    /* Sparks */
    this.sparkMat = mat(SPARK_VERT, SPARK_FRAG, {
      uMap: { value: tex.spark },
      uTime: { value: 0 },
      uRate: { value: 1 },
      uReach: { value: 1 },
      uLength: { value: 2 },
      uWidth: { value: 0.1 },
      uTint: { value: new Color(1, 1, 1) },
      uOpacity: { value: 1 }
    }, { side: DoubleSide });
    this.sparks = new Mesh(createSparkGeometry(), this.sparkMat);
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = 19;

    /* Glow outside */
    this.outGlowMat = mat(GLOW_VERT, GLOW_FRAG, {
      uMap: { value: tex.glow },
      uScale: { value: 11 },
      uTint: { value: new Color(1, 1, 1) },
      uOpacity: { value: 0.8 }
    }, { depthTest: true });
    this.outGlow = new Mesh(new PlaneGeometry(1, 1), this.outGlowMat);
    this.outGlow.frustumCulled = false;
    this.outGlow.renderOrder = 21;

    this.object3D.add(this.magma, this.aura, this.inGlow, this.flares, this.sparks, this.outGlow);
    this.object3D.traverse((o) => o.layers.set(LAYER.VFX));
  }

  /**
   * @param {number} time seconds
   * @param {object} p    { fade, flare, spark, sparkRate, sparkReach, aura, inGlow,
   *                        outGlow, outGlowScale, magmaGain, flowSpeed, tint (Color),
   *                        glowColor (Color), flareSpin }
   */
  update(time, p) {
    const flow = p.flowSpeed;
    const t = time * flow;
    const fade = p.fade;

    this.magmaMat.uniforms.uOffset.value.set(t / 2, t / 2.5);
    this.magmaMat.uniforms.uTint.value.copy(p.tint);
    this.magmaMat.uniforms.uGain.value = p.magmaGain;
    this.magmaMat.uniforms.uFade.value = fade;
    this.magma.visible = fade > 0.01 && p.magmaGain > 0;

    this.auraMat.uniforms.uOffset.value.set(-t / 4, -t / 4);
    this.auraMat.uniforms.uTint.value.copy(p.tint);
    this.auraMat.uniforms.uOpacity.value = p.aura * fade;

    this.inGlowMat.uniforms.uColor.value.copy(p.glowColor);
    this.inGlowMat.uniforms.uOpacity.value = 0.55 * p.inGlow * fade;

    for (let i = 0; i < this.flareMats.length; i++) {
      const u = this.flareMats[i].uniforms;
      const r = this.flareRatios[i];
      u.uOffset.value.set(t * 0.2 * r, -t * 0.8 * r);
      u.uTint.value.copy(p.tint);
      u.uOpacity.value = p.flare * p.flareFade;
    }
    this.flares.visible = p.flare * p.flareFade > 0.001;
    this.flares.scale.setScalar(p.flareScale);
    this.flares.rotation.y = time * p.flareSpin;

    const s = this.sparkMat.uniforms;
    s.uTime.value = time;
    s.uRate.value = p.sparkRate;
    s.uReach.value = p.sparkReach;
    s.uTint.value.copy(p.tint);
    s.uOpacity.value = p.spark * p.sparkFade;
    this.sparks.visible = p.spark * p.sparkFade > 0.001;

    const g = this.outGlowMat.uniforms;
    g.uScale.value = 11 * p.outGlowScale;
    g.uTint.value.copy(p.tint);
    g.uOpacity.value = 0.8 * p.outGlow * fade;
  }

  dispose() {
    this.object3D.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}

