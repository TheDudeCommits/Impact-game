import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AIR_FRAGMENT, airAt, airUniforms, setAirLook, setAirQuality } from '../src/render/look/air';
import { lookFor } from '../src/render/look/stageLooks';
import type { StageId } from '../src/game/stages';

/** The air laid on the distance from just behind the fight (look/air.ts). */
const PLACES: StageId[] = ['ash-colosseum', 'sunward-summit', 'sunfall-arena', 'wreckers-causeway', 'ashfall-weir', 'hollowmere-quarry', 'mirror-mere'];

describe('the air', () => {
  it('reshapes the fog chunk every fogged material shares, and leaves the linear fog running on top', () => {
    expect(THREE.ShaderChunk.fog_fragment).toBe(AIR_FRAGMENT);
    expect(AIR_FRAGMENT).toContain('smoothstep( fogNear, fogFar, vFogDepth )');
    expect(THREE.ShaderChunk.fog_vertex).toContain('vAirRay');
  });

  it('reaches every material through three\'s own tables: one array, shared, never cloned', () => {
    for (const lib of ['standard', 'physical', 'basic', 'lambert', 'phong', 'points', 'sprite'] as const) {
      const uniforms = THREE.UniformsUtils.clone(THREE.ShaderLib[lib].uniforms);
      expect(uniforms.uAirFog.value, lib).toBe(airUniforms.uAirFog.value);
      expect(uniforms.uAirColor.value, lib).toBe(airUniforms.uAirColor.value);
    }
    // ShaderMaterials built from UniformsLib.fog (the places' falls, foam, birds) too.
    expect(THREE.UniformsUtils.merge([THREE.UniformsLib.fog]).uAirShape.value).toBe(airUniforms.uAirShape.value);
    // The fighters' toon materials have their own share.
    const toon = THREE.UniformsUtils.clone(THREE.ShaderLib.toon.uniforms).uAirFog.value as Float32Array;
    expect(toon).not.toBe(airUniforms.uAirFog.value);
    setAirLook(lookFor('sunward-summit'));
    expect(toon[0]).toBeCloseTo(lookFor('sunward-summit').air!.fighters, 5);
  });

  it('lies on scenery 20-60 m back on every place of the main game, and leaves a fighter in the lens\'s reach alone', () => {
    for (const place of PLACES) {
      const air = lookFor(place).air!;
      expect(air, place).toBeDefined();
      // The fighters 5-15 m from the camera: untouched.
      expect(airAt(air, 15, true), place).toBeLessThan(.02);
      expect(air.fighters, place).toBeLessThanOrEqual(.4);
      // Visibly paler 60 m back, more of the fog's colour than the fight has; and most of it far off.
      expect(airAt(air, 60), place).toBeGreaterThan(.1);
      expect(airAt(air, 60), place).toBeGreaterThan(airAt(air, 15) + .08);
      expect(airAt(air, 400), place).toBeGreaterThan(place === 'mirror-mere' || place === 'sunfall-arena' ? .45 : .65);
    }
  });

  it('keeps every place\'s own palette: the Ashfall Weir\'s violet, the Mirror Mere\'s red', () => {
    const hue = (hex: number) => { const hsl = { h: 0, s: 0, l: 0 }; new THREE.Color(hex).getHSL(hsl); return hsl.h * 360; };
    const weir = hue(lookFor('ashfall-weir').air!.color!), mere = hue(lookFor('mirror-mere').air!.color!);
    expect(weir).toBeGreaterThan(260); expect(weir).toBeLessThan(330);
    expect(mere < 15 || mere > 345).toBe(true);
  });

  it('is off on every place without it - the rifts, Last Stand\'s places, the harbour - so none inherits the last one\'s', () => {
    // The Proving Hall's own linear fog (10-80 m) is already the air of a room 25 m long.
    for (const place of ['rift-village', 'hidden-ash', 'blood-citadel', 'harbor', 'zenith-coliseum', 'proving-hall'] as StageId[]) {
      setAirLook(lookFor('hollowmere-quarry'));
      setAirLook(lookFor(place));
      expect(Array.from(airUniforms.uAirFog.value), place).toEqual([0, 0, 0, 0]);
    }
  });

  it('drops its shaping on low quality and keeps the haze', () => {
    setAirQuality('low');
    setAirLook(lookFor('ashfall-weir'));
    expect(airUniforms.uAirFog.value[0]).toBe(1);
    expect(Array.from(airUniforms.uAirShape.value).slice(1)).toEqual([0, 0, 0]);
    setAirQuality('high');
    expect(airUniforms.uAirShape.value[1]).toBeGreaterThan(0);
  });
});
