// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { QualityConfig } from '../../quality/QualityPreset';

export const MOON_CAST = { range: 65, cooldown: 25, assembly: 1, storm: 3, fracture: 5.5, descent: 7.5 } as const;
export const MOON_DEFAULTS = {
  moonRadius: 35, moonHeight: 62, moonRotationSpeed: .055, craterDepth: .15,
  displacementScale: .05, rockRoughness: .79, fractureDensity: 1, fractureBrightness: 1.8,
  ringRotationSpeed: .12, satelliteCount: 60, debrisCount: 130,
  stormDensity: 1, stormRadius: 48, lightningFrequency: 1.4, lightningIntensity: .7,
  descentDuration: 2.5, impactFlash: 1, shockwaveRadius: 85, waterDisplacement: .36,
  sprayIntensity: 1, aftermathDuration: 4,
};
export type MoonfallConfig = typeof MOON_DEFAULTS;
const limits: Record<keyof MoonfallConfig, readonly [number, number]> = {
  moonRadius:[28,40],moonHeight:[48,110],moonRotationSpeed:[0,.15],craterDepth:[.08,.22],
  displacementScale:[.015,.1],rockRoughness:[.4,.95],fractureDensity:[.5,2],fractureBrightness:[.2,3],
  ringRotationSpeed:[.04,.3],satelliteCount:[12,70],debrisCount:[25,150],stormDensity:[.3,1.5],
  stormRadius:[30,65],lightningFrequency:[.4,3],lightningIntensity:[.1,1.3],descentDuration:[2,3.5],
  impactFlash:[.2,1.5],shockwaveRadius:[55,100],waterDisplacement:[.15,.4],sprayIntensity:[.3,1.5],aftermathDuration:[3,5],
};
export function validateMoonConfig(patch:Partial<MoonfallConfig>, base:Readonly<MoonfallConfig> = MOON_DEFAULTS):MoonfallConfig {
  const c={...base};
  for(const key of Object.keys(patch) as (keyof MoonfallConfig)[]) {
    const v=patch[key]; if(!limits[key] || typeof v!=='number'||!Number.isFinite(v)) throw new RangeError(`Invalid moon control ${key}`);
    c[key]=Math.max(limits[key][0],Math.min(limits[key][1],v));
  }
  c.moonHeight=Math.max(c.moonHeight,c.moonRadius+12);
  c.satelliteCount=Math.round(c.satelliteCount);c.debrisCount=Math.round(c.debrisCount);return c;
}
export function moonQuality(q:Readonly<QualityConfig>, c:Readonly<MoonfallConfig>) {
  const tier=q.waterDetail-1;
  return {tier, subdivisions:[10,18,26][tier],ringSegments:[18,26,36][tier],satellites:Math.min(c.satelliteCount,[18,34,60][tier]),
    debris:Math.min(c.debrisCount,[32,72,130][tier]),particles:Math.min(6000,Math.round(q.effectParticleBudget*6*c.stormDensity)),
    lightning:[3,5,8][tier],waterSegments:[64,96,144][tier],light:tier>0};
}
export type MoonQuality = ReturnType<typeof moonQuality>;
export type MoonPhase = 'summoning'|'assembly'|'storm'|'fracture'|'descent'|'impact'|'aftermath'|'cleanup';
export function moonPhase(time:number, c:Readonly<MoonfallConfig>):MoonPhase {
  const impact=MOON_CAST.descent+c.descentDuration;
  return time<1?'summoning':time<3?'assembly':time<5.5?'storm':time<7.5?'fracture':time<impact?'descent':time<impact+.75?'impact':time<impact+c.aftermathDuration?'aftermath':'cleanup';
}
export const saturate=(v:number)=>Math.max(0,Math.min(1,v));
export const smooth=(v:number)=>{const t=saturate(v);return t*t*(3-2*t);};
export const seed=(v:number)=>{const x=Math.sin(v*127.1+311.7)*43758.5453;return x-Math.floor(x);};
