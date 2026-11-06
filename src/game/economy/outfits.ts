import type { FighterId } from '../types';

export interface OutfitVariant {
  /** The hair's colour. */
  hair?: number;
  /** The hair is that colour all the time, not only while awakened. */
  always?: boolean;
  /** The Golden Form hair (the body's `awaken-on-gold-hair`) is worn all the time. */
  goldHair?: boolean;
  /** The awakening's aura, core then rim, in place of the fighter's own. */
  aura?: readonly [number, number];
  palette?: readonly OutfitSwap[];
}
export interface OutfitSwap {
  from: number; to: number;
  hue?: number; sat?: readonly [number, number]; val?: readonly [number, number]; height?: readonly [number, number]; fade?: number;
  on?: 'body' | 'all' | 'head';
  contrast?: number; glow?: number;
}
export interface OutfitDef {
  fighter: FighterId;
  /** Candidate costume may be loaded by the laboratory but is not yet shop-admitted. */
  laboratory?: boolean;
  /** Another body: its GLB, and its own rush clips if it has them. */
  model?: string;
  rush?: string;
  /** The body's own height (m) and placement, where the fighter's would not fit it. */
  height?: number;
  normalization?: { scale: number; position: [number, number, number] };
  variant?: OutfitVariant;
}

export const OUTFITS: Readonly<Record<string, OutfitDef>> = {
  'outfit-barrow-classic':{"fighter":"barrow","model":"/assets/economy/outfits/barrow-classic.glb","height":2.3},
  // ---- Taisei's and Ouga's forms, on their own bodies: hair and aura ------------------------
  'outfit-taisei-golden-sage': { fighter: 'taisei', variant: { hair: 0xffd23d, always: true, goldHair: true } },
  'outfit-taisei-ember-mane': { fighter: 'taisei', variant: { hair: 0xff2852, always: true, aura: [0xffb08a, 0xff1f3a] } },
  'outfit-taisei-azure-sage': { fighter: 'taisei', variant: { hair: 0x22c4ff, always: true, goldHair: true, aura: [0x9ff2ff, 0x1d63ff] } },
  'outfit-taisei-silver-mane': { fighter: 'taisei', variant: { hair: 0xdfe7f4, always: true, aura: [0xf4f8ff, 0x7f9cff] } },
  'outfit-ouga-golden-pride': { fighter: 'ouga', variant: { hair: 0xffcf3a, always: true, goldHair: true } },
  'outfit-ouga-crimson-crown': { fighter: 'ouga', variant: { hair: 0xff2852, always: true, aura: [0xffb08a, 0xff1f3a] } },
  'outfit-ouga-azure-pride': { fighter: 'ouga', variant: { hair: 0x22c4ff, always: true, goldHair: true, aura: [0x9ff2ff, 0x1d63ff] } },
  'outfit-ouga-violet-wrath': { fighter: 'ouga', variant: { hair: 0x9a4bff, always: true, aura: [0xdcb0ff, 0x6a14d8] } },
  // ---- Dust Sea costumes: bodies with their own authored fight sets (scripts/economy/build_outfit.py) ----
  'outfit-gummy-daybreak': { fighter: 'gummy', model: '/assets/economy/outfits/gummy-daybreak.glb' },
  'outfit-gummy-black-flag': { fighter: 'gummy', model: '/assets/economy/outfits/gummy-black-flag.glb' },
  'outfit-gummy-mirage': { fighter: 'gummy', model: '/assets/economy/outfits/gummy-mirage.glb' },
  'outfit-gummy-deckhand': { fighter: 'gummy', model: '/assets/economy/outfits/gummy-deckhand.glb' },
  'outfit-kenzo-night-raider': { fighter: 'kenzo', model: '/assets/economy/outfits/kenzo-night-raider.glb' },
  'outfit-kenzo-oasis-dandy': { fighter: 'kenzo', model: '/assets/economy/outfits/kenzo-oasis-dandy.glb' },
  'outfit-kosho-sommelier': { fighter: 'kosho', model: '/assets/economy/outfits/kosho-sommelier.glb' },
  'outfit-kagari-dune-walker': { fighter: 'kagari', model: '/assets/economy/outfits/kagari-dune-walker.glb' },
  'outfit-ward-night-shift': { fighter: 'ward', model: '/assets/economy/outfits/ward-night-shift.glb' },
  'outfit-ward-house-call': { fighter: 'ward', model: '/assets/economy/outfits/ward-house-call.glb' },
  // ---- Repaints: a fighter's own body, rig and clips, with a texture painted for it (Meshy retexture, scripts/economy/swap_texture.py) ----
  'outfit-kenzo-masterless': { fighter: 'kenzo', model: '/assets/economy/outfits/kenzo-masterless.glb' },
  'outfit-oro-ascendant': { fighter: 'oro', model: '/assets/economy/outfits/oro-ascendant.glb' },
  'outfit-setsu-live-wire': { fighter: 'setsu', model: '/assets/economy/outfits/setsu-live-wire.glb' },
  'outfit-kagari-blue-ember': { fighter: 'kagari', model: '/assets/economy/outfits/kagari-blue-ember.glb' },
  'outfit-kosho-flambe': { fighter: 'kosho', model: '/assets/economy/outfits/kosho-flambe.glb' },
};

/** The outfit a fighter is shown in, if `id` is one of theirs. */
export const outfitFor = (id: string | undefined, fighter: FighterId): OutfitDef | undefined => {
  const outfit = id ? OUTFITS[id] : undefined;
  return outfit?.fighter === fighter ? outfit : undefined;
};
