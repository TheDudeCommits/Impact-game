
const OWN = '/assets/vfx/originals/';

export const STILL_BELL = OWN + 'still-bell.webp';

export const TSUBUTE_STONES = { ballast: OWN + 'ballast.webp', farBank: OWN + 'far-bank.webp' } as const;

export const SWAN_HEAD = {
  asset: OWN + 'swan-head.glb',
  jawOpen: .812,
  eyes: [[-.472, .455, .046], [.472, .455, .046]] as readonly (readonly [number, number, number])[],
} as const;

export const HIKUI_BALEFIRE = OWN + 'balefire.webp';
export const HAKUSHI_LICK = OWN + 'cinder-lick.webp';
export const ONIGAWARA_BOAR = OWN + 'boar-mask.webp';
export const MADAKE_BEASTS = OWN + 'green-beasts.webp';
/** Yodaka (yodaka): Fire Owl, the eagle-owl of flame stooping onto the circle, in the old area drawing's place
 *  (YodakaFireOwl.ts: 3:2, stood on the floor at the impact, as wide as the circle; held with its slot). */
export const YODAKA_FIRE_OWL = OWN + 'fire-owl.webp';
export const YODAKA_FIRE_OWL_SCALE = 1.5;
export const OWN_EFFECT_FILES = [STILL_BELL, ...Object.values(TSUBUTE_STONES), SWAN_HEAD.asset, HIKUI_BALEFIRE, HAKUSHI_LICK, ONIGAWARA_BOAR, MADAKE_BEASTS, YODAKA_FIRE_OWL];

// (The clean, 6 November 2026: those nine files have left the repository, so none is listed.)
export const MAIN_EFFECT_FILES: readonly string[] = [];
