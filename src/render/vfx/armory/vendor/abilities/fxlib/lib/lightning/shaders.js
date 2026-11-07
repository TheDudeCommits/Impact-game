// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * GLSL for the lightning strike, ported from "lightning-vfx"
 * (repo "lightning-vfx", src/shaders/*.glsl).
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
 * Changes from the original: the three bolt layers' colour/thickness/alpha are
 * looked up from uniforms by a per-vertex layer index (so the sliders are live
 * on a standing bolt), and the spark colours are uniforms instead of
 * constants. A `uWidthScale` multiplier compensates for the sandbox
 * camera sitting ~2.5x closer than the demo's. Everything else is line-for-line.
 */

export const boltVS = /* glsl */ `
attribute float aRatio;
attribute vec3 aDirection;
attribute float aSide;
attribute float aStrikeOffset;
attribute float aThickMult;
attribute float aAlphaMult;
attribute float aLayer;

uniform float uTime;
uniform float uStrikeDur;
uniform float uFadeDur;
uniform float uSpread;
uniform vec3 uOrigin;
uniform vec3 uLayerColor[3];
uniform vec3 uLayerThick;
uniform vec3 uLayerAlpha;
uniform float uWidthScale;

varying float vRatio;
varying float vStrikeOffset;
varying float vAlpha;
varying vec3 vColor;

void main() {
  int li = int(aLayer + 0.5);
  float thick = li == 0 ? uLayerThick.x : (li == 1 ? uLayerThick.y : uLayerThick.z);
  float alpha = li == 0 ? uLayerAlpha.x : (li == 1 ? uLayerAlpha.y : uLayerAlpha.z);
  vec3 col = li == 0 ? uLayerColor[0] : (li == 1 ? uLayerColor[1] : uLayerColor[2]);

  float fadeT = clamp((uTime - uStrikeDur) / uFadeDur, 0.0, 1.0);
  // Positions are stored relative to the strike point; the original spread is
  // relative to the world origin, which it used as its stage centre.
  vec3 pos = position;
  pos.xz += pos.xz * pow(fadeT, 2.0) * uSpread;
  pos += uOrigin;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vec3 toCamera = normalize(cameraPosition - worldPos.xyz);
  vec4 nextWorld = modelMatrix * vec4(position + uOrigin + aDirection, 1.0);
  vec3 tangent = normalize(cross(normalize(nextWorld.xyz - worldPos.xyz), toCamera));
  worldPos.xyz += tangent * aSide * thick * aThickMult * uWidthScale;

  vRatio = aRatio;
  vStrikeOffset = aStrikeOffset;
  vAlpha = alpha * aAlphaMult;
  vColor = col;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const boltFS = /* glsl */ `
uniform float uTime;
uniform float uStrikeDur;
uniform float uFadeDur;

varying float vRatio;
varying float vStrikeOffset;
varying float vAlpha;
varying vec3 vColor;

void main() {
  float strikeT = clamp(uTime / uStrikeDur, 0.0, 1.0);
  float fadeT = clamp((uTime - uStrikeDur) / uFadeDur, 0.0, 1.0);

  float window = max(1.0 - vStrikeOffset, 0.001);
  float localT = clamp((strikeT - vStrikeOffset) / window, 0.0, 1.0);

  float reveal = step(vRatio, localT);
  float alpha = reveal * (1.0 - fadeT * fadeT) * vAlpha;
  if (uTime < 0.0) alpha = 0.0;

  gl_FragColor = vec4(vColor, alpha);
}
`;

export const crackVS = /* glsl */ `
attribute float aRatio;
attribute float aSide;
attribute float aAlpha;
attribute float aFadeMult;

varying float vRatio;
varying float vSide;
varying float vAlpha;
varying float vFadeMult;

void main() {
  vRatio = aRatio;
  vSide = aSide;
  vAlpha = aAlpha;
  vFadeMult = aFadeMult;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const crackFS = /* glsl */ `
uniform float uTime;
uniform float uDelay;
uniform float uRevealDur;
uniform float uFadeDur;
uniform vec3 uCoreColor;
uniform vec3 uMidColor;
uniform vec3 uEdgeColor;

varying float vRatio;
varying float vSide;
varying float vAlpha;
varying float vFadeMult;

void main() {
  float t = max(0.0, uTime - uDelay);
  float revealT = clamp(t / uRevealDur, 0.0, 1.0);
  float fadeT = clamp((t - uRevealDur) / (uFadeDur * vFadeMult), 0.0, 1.0);

  float reveal = step(vRatio, revealT);
  float edge = 1.0 - abs(vSide);
  float core = smoothstep(0.0, 0.25, edge);
  float glow = smoothstep(0.0, 0.85, edge);

  vec3 col = mix(uEdgeColor, mix(uMidColor, uCoreColor, core), glow);
  float fade = 1.0 - fadeT * fadeT;

  float alpha = reveal * glow * fade * vAlpha;
  gl_FragColor = vec4(col, alpha);
}
`;

export const groundFlashVS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const groundFlashFS = /* glsl */ `
uniform float uTime;
uniform float uDur;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uRadialPow;
uniform float uFadePow;

varying vec2 vUv;

void main() {
  float t = clamp(uTime / uDur, 0.0, 1.0);
  float radial = max(0.0, 1.0 - length(vUv - vec2(0.5)) * 2.0);
  float alpha =
    pow(radial, uRadialPow) * pow(1.0 - t, uFadePow) * uIntensity;
  gl_FragColor = vec4(uColor, alpha);
}
`;

export const shockwaveFS = /* glsl */ `
uniform float uTime;
uniform float uDelay;
uniform float uDur;
uniform float uAlphaMult;
uniform vec3 uColorA;
uniform vec3 uColorB;

varying vec2 vUv;

void main() {
  float t = clamp((uTime - uDelay) / uDur, 0.0, 1.0);
  vec2 uvc = vUv - 0.5;
  float r = length(uvc) * 2.0;
  float ring = abs(r - t);
  float alpha =
    smoothstep(0.12, 0.0, ring) * (1.0 - t) * (1.0 - t) * uAlphaMult;

  vec3 col = mix(uColorA, uColorB, t);
  gl_FragColor = vec4(col, alpha);
}
`;

export const sparksVS = /* glsl */ `
attribute vec3 aVelocity;
attribute float aLifetime;
attribute float aSeed;

uniform float uTime;
uniform float uDelay;
uniform float uSize;
uniform float uGravity;
uniform float uDepthScale;
uniform float uPixelRatio;

varying float vAge;
varying float vSeed;

void main() {
  float t = max(0.0, uTime - uDelay);
  vAge = clamp(t / aLifetime, 0.0, 1.5);
  vSeed = aSeed;

  vec3 p = position + aVelocity * t + vec3(0.0, -uGravity * t * t, 0.0);
  p.y = max(p.y, 0.0);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * uPixelRatio * max(0.0, 1.0 - vAge * 0.8) * (uDepthScale / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

export const sparksFS = /* glsl */ `
uniform vec3 uHot;
uniform vec3 uMid;
uniform vec3 uCool;

varying float vAge;
varying float vSeed;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv);
  if (r > 0.5) discard;

  float core = max(0.0, 1.0 - r * 5.0);
  float glow = max(0.0, 1.0 - r * 2.2);

  vec3 col = mix(uCool, mix(uMid, uHot, core), glow);
  float fade = max(0.0, 1.0 - vAge * vAge);
  gl_FragColor = vec4(col, (core * 1.0 + glow * 0.45) * fade);
}
`;
