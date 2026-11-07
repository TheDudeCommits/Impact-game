// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { QualityConfig } from '../../quality/QualityPreset';
export const CHAIN_CAST = { range: 38, cooldown: 8, release: .75, wrap: .65, slam: .18, residual: 1.5, maximumActive: 2 } as const;
export const CHAIN_DEFAULTS = {
  chainCount: 5, linksPerChain: 40, linkLength: 1.12, linkThickness: .105,
  chainSpacing: .78, launchSpeed: 34, whipAmplitude: .55, whipFrequency: 3,
  wrapRadius: 2.9, wrapSpeed: 1.4, constrictTime: .4, runeBrightness: .75,
  runePulseSpeed: .7, metalRoughness: .29, scratchScale: 28, sparkDensity: 1,
  fragmentCount: 80, impactIntensity: 1, waterRippleStrength: .34,
};
export type AstralChainstormConfig = typeof CHAIN_DEFAULTS;
const limits: Record<keyof AstralChainstormConfig, readonly [number, number]> = {
  chainCount:[3,5],linksPerChain:[20,42],linkLength:[.9,1.5],linkThickness:[.07,.14],chainSpacing:[.65,.9],
  launchSpeed:[20,45],whipAmplitude:[0,1],whipFrequency:[1,5],wrapRadius:[2,4],wrapSpeed:[.5,2],constrictTime:[.25,.65],
  runeBrightness:[0,1.5],runePulseSpeed:[.3,1.5],metalRoughness:[.18,.5],scratchScale:[12,50],sparkDensity:[.2,1.5],
  fragmentCount:[20,84],impactIntensity:[.3,1.5],waterRippleStrength:[.15,.4],
};
export function validatedChainConfig(patch:Partial<AstralChainstormConfig>, current:Readonly<AstralChainstormConfig> = CHAIN_DEFAULTS):AstralChainstormConfig {
  const c={...current};
  for(const key of Object.keys(patch) as (keyof AstralChainstormConfig)[]) {
    const v=patch[key];if(!limits[key]||typeof v!=='number'||!Number.isFinite(v))throw new RangeError(`Invalid chain control ${key}`);
    c[key]=Math.max(limits[key][0],Math.min(limits[key][1],v));
  }
  c.linkThickness=Math.min(c.linkThickness,c.linkLength*.1);
  c.chainCount=Math.round(c.chainCount);c.linksPerChain=Math.round(c.linksPerChain);c.fragmentCount=Math.round(c.fragmentCount);return c;
}
export function chainQuality(q:Readonly<QualityConfig>,c:Readonly<AstralChainstormConfig>) {
  const tier=q.waterDetail-1;
  return {tier,chains:Math.min(c.chainCount,[3,4,5][tier]),links:Math.min(c.linksPerChain,[26,34,40][tier]),
    sparks:Math.min(900,q.effectParticleBudget,Math.round([130,350,750][tier]*c.sparkDensity)),fragments:Math.min(c.fragmentCount,[24,48,80][tier]),light:tier>0};
}
export type ChainQuality = ReturnType<typeof chainQuality>;
