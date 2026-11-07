// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* EXTRA_NOVA — Nova Burst (rollshade `nova`)                          */
/* ================================================================== */
/*!
 * Light gathers on the caster, then a 360-degree nova ring tears across the floor.
 *
 * Ported from rollshade (https://github.com/tsuyatt/rollshade, MIT, © 2026
 * tsuyatt): the `nova` recipe running on the GLSL runtime in
 * `abilities/extra/lib/rs/`. The move block mirrors the recipe's own params
 * (same names and defaults); the element slider switches rollshade's whole
 * element behaviour, and `useColor` swaps the palette for one custom colour.
 * Look and feel values are live on a playing move; move params apply on the
 * next cast.
 */
export const extra_nova = {
  /* --- the cast --- */
  range: 6, // the target sits at the aimed distance, clamped to this
  minRange: 1.5,
  speed: 0, // unused by this move (kept for the shared cast contract)
  cooldown: 2,
  castAnim: 'cast2',
  handHeight: 1.2, // height the move leaves the caster at (rollshade "chest")
  handForward: 0.25, // metres in front of the caster
  targetHeight: 1.05, // height of the struck point at the target
  maxLife: 14, // safety cut-off, seconds

  /* --- element --- */
  element: 1, // 0 plain 1 fire 2 ice 3 thunder 4 wind 5 earth 6 water 7 light 8 dark 9 poison 10 arcane
  hue: 0, // hue shift on the element palette
  useColor: 0, // 1 = one custom colour instead of the element palette
  color: '#ff9d3c',

  /* --- the move (rollshade recipe params) --- */
  charge: 0.55, // gather time before release
  radius: 0, // nova radius; 0 reaches 1.2 m past the target
  size: 1, // scales the move's shapes
  power: 1.7, // scales every impact; >= 1.5 adds the element extra, >= 1.8 adds impact frames
  circleFeet: 1, // magic circle under the caster, 8 styles
  circleHand: 0, // magic circle at the hand
  circleTarget: 0, // magic circle under the target

  /* --- look --- */
  scale: 1, // rollshade play scale
  brightness: 1.25, // emissive gain on every layer
  particles: 0.35, // particle density (rollshade LOOK.particles)
  smoke: 0.3, // smoke density
  coreWhite: 0.1, // how far the core colour is pushed to white
  hotWhite: 0.25, // how white the hottest particle centres burn
  lightScale: 0.4, // dynamic light strength

  /* --- feel --- */
  flash: 0.6, // screen flash strength
  distortion: 1, // refraction shock rings
  shake: 1, // camera shake
  hitStop: 1, // hit-stop length multiplier (0 = off)
  impactFrames: 1, // 1 = inverted impact frame on the heaviest hits
  anime: 0 // 1 = anime hit marks (spiky burst, speed lines) on strong hits
};

export const extra_novaSchema = {
  'The cast': [
    ['range', 1, 30, 0.1, 'max range'],
    ['minRange', 0, 10, 0.1, 'min range'],
    ['speed', 0, 1, 1, 'speed (unused)'],
    ['cooldown', 0, 6, 0.05, 'cooldown'],
    ['castAnim', 'cast animation'],
    ['handHeight', 0, 3, 0.01, 'from height'],
    ['handForward', -1, 2, 0.01, 'from forward'],
    ['targetHeight', 0, 3, 0.01, 'target height'],
    ['maxLife', 2, 30, 0.5, 'max lifetime']
  ],
  'Element: 0 plain 1 fire 2 ice 3 thunder 4 wind 5 earth 6 water 7 light 8 dark 9 poison 10 arcane': [
    ['element', 0, 10, 1, 'element'],
    ['hue', -0.5, 0.5, 0.005, 'hue shift'],
    ['useColor', 0, 1, 1, 'use custom colour'],
    ['color', 'custom colour']
  ],
  'The move': [
    ['charge', 0, 2, 0.01, 'charge (s)'],
    ['radius', 0, 12, 0.1, 'radius (0 = auto)'],
    ['size', 0.3, 3, 0.05, 'size'],
    ['power', 0.2, 3, 0.05, 'power'],
    ['circleFeet', 0, 8, 1, 'feet circle style (0 off)'],
    ['circleHand', 0, 8, 1, 'hand circle style (0 off)'],
    ['circleTarget', 0, 8, 1, 'target circle style (0 off)']
  ],
  Look: [
    ['scale', 0.3, 3, 0.05, 'scale'],
    ['brightness', 0, 4, 0.01, 'brightness'],
    ['particles', 0, 1.5, 0.01, 'particle density'],
    ['smoke', 0, 1.5, 0.01, 'smoke density'],
    ['coreWhite', 0, 1, 0.01, 'core whiteness'],
    ['hotWhite', 0, 1, 0.01, 'hot-white centres'],
    ['lightScale', 0, 3, 0.01, 'light strength']
  ],
  Feel: [
    ['flash', 0, 2, 0.01, 'screen flash'],
    ['distortion', 0, 3, 0.01, 'shock distortion'],
    ['shake', 0, 3, 0.01, 'camera shake'],
    ['hitStop', 0, 3, 0.01, 'hit-stop'],
    ['impactFrames', 0, 1, 1, 'impact frames'],
    ['anime', 0, 1, 1, 'anime hit marks']
  ]
};
