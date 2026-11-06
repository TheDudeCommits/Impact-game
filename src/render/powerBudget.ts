import type {Settings} from '../config';
import {handheld} from '../input/device';

/** Cool mode draws evenly at 30 Hz on a 60 Hz laptop screen. Auto retains
 * 60 Hz while giving integrated GPUs headroom in both endurance modes.
 * Input sampling, collision and combat simulation are never slowed. */
/** A phone or tablet on low (the phone tier, render/qualityTier.ts) draws its sun's shadow at 512: a small screen
 * shows no more, and a mobile GPU's memory and fill are the budget. */
export function powerBudget(settings:Pick<Settings,'quality'|'powerMode'>,strong:boolean,horde:boolean,small=handheld()){
  const cool=settings.powerMode==='cool';
  const economical=cool||(settings.powerMode!=='full'&&horde&&!strong);
  const q=settings.quality;
  return {fps:cool?30:60,economical,pixelCap:economical?1:q==='high'?1.5:q==='medium'?1.15:1,
    // Fanless/integrated crowd fights retain the authored ink, glow and
    // impact sprites, but skip the multisample resolve and bloom pyramid.
    samples:q==='low'||economical?0:q==='high'?4:2,bloom:q!=='low'&&!economical,
    shadowSize:q==='low'&&small?512:q==='low'||economical?1024:2048,gpuBudget:cool?10:economical?8.5:undefined};
}
export const PHONE_RATIO = 1.5;
export function phoneSharpness(o:{phone:boolean;quality:Settings['quality'];powerMode?:Settings['powerMode'];economical:boolean;dpr:number;timed:boolean;fps:number}){
  if(!o.phone||o.quality!=='low'||o.powerMode==='cool'||o.economical||!(o.dpr>=2))return undefined;
  if(o.fps>30)return undefined;
  const cap=Math.min(o.dpr,PHONE_RATIO);
  return {cap,start:1/cap,floor:.75/cap};
}
