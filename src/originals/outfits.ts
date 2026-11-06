import type { FighterId } from '../game/types';
import { OUTFITS, type OutfitDef, type OutfitVariant } from '../game/economy/outfits';

export const ORIGINAL_OUTFITS: Readonly<Record<string, { fighter: FighterId; variant: OutfitVariant }>> = {
  // (The places' light is warm, the shop's paper too: a white or a sand is given a little blue to come out white or sand.)
  // ---- Lucy (gummy): red jacket, white vest, yellow sash, navy trousers, black hair under a red headband --------------
  // (His hair stays black in every one: the crown tint that whitens a Golden's hair paled his red headband with it.)
  'outfit-gummy-daybreak': { fighter: 'gummy', variant: {
    aura: [0xfff4c8, 0xffb52e],
    palette: [
      { from: 0x8d252e, hue: .07, sat: [.32, 1], to: 0xf2f1ee, contrast: .55 },        // the jacket, bleached
      { from: 0x2c2f47, hue: .08, sat: [.18, 1], val: [0, .55], to: 0xf0efeb, contrast: .5 },   // the trousers, sun-white
      { from: 0xb88c42, hue: .05, sat: [.4, 1], to: 0xffc23a, contrast: .8, glow: .35 }, // the sash, lit
    ] } },
  'outfit-gummy-black-flag': { fighter: 'gummy', variant: {
    aura: [0xffb0a0, 0xd0121e],
    palette: [
      { from: 0x8d252e, hue: .07, sat: [.32, 1], to: 0x2a2630, contrast: .8 },          // the jacket, black
      { from: 0x2c2f47, hue: .08, sat: [.18, 1], val: [0, .55], to: 0x18161c, contrast: .8 },
      { from: 0xb88c42, hue: .05, sat: [.4, 1], to: 0xc0172c, contrast: .9 },             // the sash, blood red
    ] } },
  'outfit-gummy-mirage': { fighter: 'gummy', variant: {
    aura: [0xb8fff4, 0x14b8ac],
    palette: [
      { from: 0x8d252e, hue: .07, sat: [.32, 1], to: 0x169cbf, contrast: .8 },          // the jacket, turquoise
      { from: 0x2c2f47, hue: .08, sat: [.18, 1], val: [0, .55], to: 0xd8d0c0, contrast: .6 }, // the trousers, sand
      { from: 0xb88c42, hue: .05, sat: [.4, 1], to: 0xff6f59, contrast: .9 },             // the sash, coral
    ] } },
  'outfit-gummy-deckhand': { fighter: 'gummy', variant: {
    palette: [
      { from: 0x8d252e, hue: .07, sat: [.32, 1], to: 0x56789e, contrast: .85 },         // the jacket, washed denim
      { from: 0x2c2f47, hue: .08, sat: [.18, 1], val: [0, .55], to: 0x5d5a45, contrast: .8 }, // the trousers, olive drab
      { from: 0xb88c42, hue: .05, sat: [.4, 1], to: 0xc8332b, contrast: .9 },             // the sash, red
    ] } },
  // ---- Kenzo (kenzo), his green-haired base body: a torn orange-red vest over a black robe and trousers -----------------
  'outfit-kenzo-night-raider': { fighter: 'kenzo', variant: {
    palette: [
      { from: 0x8b3d24, hue: .06, sat: [.5, 1], to: 0x262c63, contrast: .85 },          // the vest, midnight indigo
    ] } },
  'outfit-kenzo-oasis-dandy': { fighter: 'kenzo', variant: {
    palette: [
      { from: 0x8b3d24, hue: .06, sat: [.5, 1], to: 0xf1f0ea, contrast: .5 },           // the vest, ivory silk
    ] } },
  'outfit-kenzo-masterless': { fighter: 'kenzo', variant: {
    palette: [
      { from: 0x8b3d24, hue: .06, sat: [.5, 1], to: 0x2a2a30, contrast: .8 },           // the vest, dyed black
    ] } },
  // ---- Kosho (kosho): a white shirt, a red neckerchief, black braces and trousers, blond hair -------------------------
  'outfit-kosho-sommelier': { fighter: 'kosho', variant: {
    aura: [0xffd0dc, 0xa3123a],
    palette: [
      { from: 0xe3e2e9, sat: [0, .18], val: [.6, 1], to: 0x6a1630, contrast: .8 },     // the shirt, claret
      { from: 0x6e1f2a, hue: .06, sat: [.45, 1], to: 0xe0ad3c, contrast: .8 },          // the neckerchief, gold
    ] } },
  'outfit-kosho-flambe': { fighter: 'kosho', variant: {
    aura: [0xffd27a, 0xff5a12],
    palette: [
      { from: 0x201f24, val: [0, .3], height: [-1, .17], fade: .08, to: 0xffc23a, contrast: .5, glow: 1.4 }, // the shoes, white-hot
      { from: 0x201f24, val: [0, .3], height: [-1, .4], fade: .14, to: 0xff4d14, contrast: .5, glow: 1.1 },  // the legs, alight to the knee
      { from: 0xe3e2e9, sat: [0, .18], val: [.6, 1], to: 0x2b2a30, contrast: .8 },     // the shirt, black
      { from: 0x6e1f2a, hue: .06, sat: [.45, 1], to: 0xff7a1a, contrast: .8, glow: .4 },
    ] } },
  // ---- Kagari (kagari): a black sleeveless top printed with orange flames, an orange sash -------------------------------
  'outfit-kagari-dune-walker': { fighter: 'kagari', variant: {
    palette: [
      { from: 0x96482d, hue: .06, sat: [.48, 1], to: 0xe0bc5e, contrast: .8 },          // the flames and the sash, gold
      { from: 0x2c2a2f, val: [0, .3], to: 0x582e3e, contrast: .7 },                      // the black, the dunes' dusk red
    ] } },
  'outfit-kagari-blue-ember': { fighter: 'kagari', variant: {
    aura: [0xc4ecff, 0x1f63ff],
    palette: [
      { from: 0x96482d, hue: .06, sat: [.48, 1], to: 0x2f86ff, contrast: .8, glow: .9 }, // the flames and the sash, blue fire
    ] } },
  // ---- Ward (ward): a yellow coat with black hazard stripes, a black turtleneck, grey trousers ------------------------
  'outfit-ward-night-shift': { fighter: 'ward', variant: {
    aura: [0xb6fff2, 0x0f9c8c],
    palette: [
      { from: 0xbba14f, hue: .07, sat: [.35, 1], to: 0x1a86a8, contrast: .8 },          // the coat, scrubs teal
    ] } },
  'outfit-ward-house-call': { fighter: 'ward', variant: {
    palette: [
      { from: 0xbba14f, hue: .07, sat: [.35, 1], to: 0xeef2f6, contrast: .45 },         // the coat, a doctor's white
      { from: 0x3a3e42, sat: [0, .25], val: [.18, .5], to: 0x263457, contrast: .9 },     // the trousers, navy
    ] } },
  // ---- Lord ORO (oro): a black vest worked with gold gears, gold bands, black trousers ------------------------------
  'outfit-oro-ascendant': { fighter: 'oro', variant: {
    aura: [0xfffbe6, 0xffcf4a],
    palette: [
      { from: 0x87611c, hue: .06, sat: [.4, 1], to: 0xe2a41c, contrast: .8, glow: .5 },  // the gold, lit
      { from: 0x1a1a1a, val: [0, .25], to: 0xf3f3f0, contrast: .45 },                   // the black, ivory
    ] } },
  // ---- Setsu (setsu): a navy jacket run with glowing blue seams, dark trousers, white hair ---------------------------
  'outfit-setsu-live-wire': { fighter: 'setsu', variant: {
    aura: [0xf2dcff, 0x8a2bff],
    palette: [
      { from: 0x1556a4, hue: .06, sat: [.6, 1], val: [.42, 1], to: 0xeed6ff, contrast: .6, glow: 2 }, // the seams, violet lightning
      { from: 0x162741, hue: .07, sat: [.3, 1], val: [0, .5], to: 0x4b2aa0, contrast: .8 },          // the jacket, storm violet
    ] } },
};

export function applyOriginalOutfits(outfits: Record<string, OutfitDef> = OUTFITS as Record<string, OutfitDef>) {
  for (const [id, own] of Object.entries(ORIGINAL_OUTFITS)) if (outfits[id]) outfits[id] = { fighter: own.fighter, variant: own.variant };
}
