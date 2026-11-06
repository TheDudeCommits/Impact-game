import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { COOKIE_GLSL, cookieUniforms, setCookieLook, setCookieQuality } from '../src/render/look/lightCookie';
import { lookFor, STAGE_LOOKS } from '../src/render/look/stageLooks';
import type { StageId } from '../src/game/stages';

/** The leaves' dappled light on the green places, warm light over a cool shade, and the ground's colour bounced into
 *  the fighters' shade. */
/** The hue of an sRGB hex as an artist picks it. */
const hue = (hex: number) => { const hsl = { h: 0, s: 0, l: 0 }; new THREE.Color(hex).getHSL(hsl, THREE.SRGBColorSpace); return hsl.h * 360; };

describe('the dappled light', () => {
  const dappled = (Object.keys(STAGE_LOOKS) as StageId[]).filter(stage => lookFor(stage).leaves);
  it('rides the cookie the stage and the fighters already share, and every look sets it', () => {
    expect(COOKIE_GLSL).toContain('float lookCloud( vec3 p ) { return lookClouds( p ) * lookLeaves( p ); }');
    setCookieLook(lookFor('ash-colosseum'));
    expect(cookieUniforms.uLeafOn.value).toBe(1);
    for (const stage of ['rift-village', 'proving-hall', 'mirror-mere', 'kuroyuki-hall'] as StageId[]) {
      setCookieLook(lookFor('ash-colosseum')); setCookieLook(lookFor(stage));
      expect(cookieUniforms.uLeafOn.value, stage).toBe(0);
    }
  });
  it('costs less on medium and nothing on low', () => {
    setCookieQuality('medium'); setCookieLook(lookFor('ash-colosseum'));
    expect(cookieUniforms.uLeafOn.value).toBe(1); expect(cookieUniforms.uLeafDetail.value).toBe(0);
    setCookieQuality('low');
    expect(cookieUniforms.uLeafOn.value).toBe(0);
    setCookieQuality('high');
    expect(cookieUniforms.uLeafOn.value).toBe(1); expect(cookieUniforms.uLeafDetail.value).toBe(1);
  });
});

describe('warm light, cool shade, and the ground\'s bounce', () => {
  it('keeps the key warm and shades the natural places teal-green', () => {
    for (const stage of ['ash-colosseum'] as StageId[]) {
      const look = lookFor(stage);
      const key = new THREE.Color(look.key.color);
      expect(key.r, `${stage} key warm`).toBeGreaterThanOrEqual(key.b);
      const shade = hue(look.grade.shadowTint);
      // Teal-green on the grass: between green (120) and blue (240), never violet.
      expect(shade, `${stage} shade`).toBeGreaterThan(150); expect(shade, `${stage} shade`).toBeLessThan(205);
    }
  });
  it('bounces the grass\'s green into the fighters\' shade on the Proving arena', () => {
    const ground = hue(lookFor('ash-colosseum').hemi.ground);
    expect(ground).toBeGreaterThan(70); expect(ground).toBeLessThan(150);
  });
  it('keeps the fighters as bright where the shade deepens: their share of the ambient rises as the sky\'s light falls', () => {
    const linear = (c: number) => Math.pow(c / 255, 2.2);
    const skyLight = (h: { sky: number; intensity: number }) => h.intensity * (.2126 * linear((h.sky >> 16) & 255) + .7152 * linear((h.sky >> 8) & 255) + .0722 * linear(h.sky & 255));
    for (const stage of ['ash-colosseum', 'sunfall-arena'] as StageId[]) {
      const look = lookFor(stage), base = STAGE_LOOKS[stage]!;
      // The fighters' ambient (their share times the sky's light) stays within 15% of the pass's (share x1.08).
      const now = look.toon.ambient * skyLight(look.hemi), was = base.toon.ambient * 1.08 * skyLight(base.hemi);
      expect(now / was, stage).toBeGreaterThan(.85);
    }
  });
});
