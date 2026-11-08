import type { FighterId } from '../../game/types';
import type { IdleProfile } from './profile';

/** The shop's fighters' idles, authored on each one's own skeleton the way the original sixteen's were
 *  (scripts/economy/idle_shop.mts, after scripts/author_idle.mts) and shipped beside the body. Before them they stood
 *  in whatever idle their build borrowed - the Rift's library stance, Emperor Jinlin's upright stand - and only the
 *  life layer's breath told them from the Rift's grunts. */
export const PROFILES_SHOP: Partial<Record<FighterId, IdleProfile>> = {
  // The Landslide's ready stance, bouncing; the fist drawn to the hip as the fidget.
  gaku: { model: '/assets/fighters/gaku-idle1.glb', clip: 'Gaku idle', fidgets: ['Gaku idle fidget'], stance: 'guard', breath: 1.1, sway: .5, gaze: 1 },
  // Upright and still, the hands low round their daggers' grips; squared up to an opponent, his dagger stance (9 October
  // 2026, scripts/fanim/slj.py: low, the left dagger out before him, the right drawn back to strike).
  'rook': { model: '/assets/fighters/rook-idle1.glb', clip: 'Rook idle', fidgets: ['Rook idle fidget'], stance: 'relaxed', breath: .8, sway: .5, gaze: .8, dip: 2.4, ready: 'Rook ready' },
  // Arms folded, chin up.
  akagane: { model: '/assets/fighters/akagane-idle1.glb', clip: 'Akagane idle', fidgets: ['Akagane idle fidget'], stance: 'relaxed', breath: .9, sway: .4, gaze: .7, dip: 2.4 },
  // Calm, the head a little bowed; a hand sign as the fidget.
  tobari: { model: '/assets/fighters/tobari-idle1.glb', clip: 'Tobari idle', fidgets: ['Tobari idle fidget'], stance: 'relaxed', breath: .8, sway: .4, gaze: .9, dip: 2.2 },
  // Slouched and amused; the neck cracked as the fidget.
  magatsu: { model: '/assets/fighters/magatsu-idle1.glb', clip: 'Magatsu idle', fidgets: ['Magatsu idle fidget'], stance: 'relaxed', breath: 1, sway: .8, gaze: 1, dip: 2.6 },
  // Fists up, wide and grounded, the power held in.
  'gohaku': { model: '/assets/fighters/gohaku-idle1.glb', clip: 'Gohaku idle', fidgets: ['Gohaku idle fidget'], stance: 'guard', breath: 1.3, sway: .5, gaze: 1 },
  // Gravedigger's stance, wide and low, rocking on his feet; the shoulders rolled as the fidget.
  sekka: { model: '/assets/fighters/sekka-idle2.glb', clip: 'Sekka idle', fidgets: ['Sekka idle fidget'], stance: 'guard', breath: 1.1, sway: .5, gaze: 1 },
  // Bored: slouched over one hip; the back of the head scratched as the fidget.
  ippon: { model: '/assets/fighters/ippon-idle1.glb', clip: 'Ippon idle', fidgets: ['Ippon idle fidget'], stance: 'relaxed', breath: .7, sway: .6, gaze: .5, dip: 2 },
  // A king's stillness, leaning in like a predator; the head turned slowly over the board as the fidget (his second
  // body's, round 5). His breath a touch deeper than it was: at .8 the doll his second body dies into from three in
  // sixteen of the poses he stands in (the 20th frame among them) was still creeping twenty seconds on; at .9, two in
  // twenty-seven, the 20th settled (ragdoll.test.ts).
  imago: { model: '/assets/fighters/imago-idle2.glb', clip: 'Imago idle', fidgets: ['Imago idle fidget'], stance: 'relaxed', breath: .9, sway: .3, gaze: .9, dip: 2 },
  vesper: { model: '/assets/fighters/vesper-idle1.glb', clip: 'Vesper idle', fidgets: ['Vesper idle fidget'], stance: 'weapon', breath: .8, sway: .4, gaze: .9, dip: 2, fidgetEvery: [9, 15] },
  gorai: { stance: 'weapon', breath: 1.1, sway: .5, gaze: .7, dip: 2.2 },
  haldor: { stance: 'weapon', breath: 1.1, sway: .5, gaze: .7, dip: 2.2, fidgets: ['Haldor Home Idle'], fidgetEvery: [9, 16] },
  sorrel: { stance: 'weapon', breath: .9, sway: .5, gaze: .9, dip: 2.2, fidgets: ['idlehome_a'], fidgetEvery: [8, 14] },
  dorado: { stance: 'weapon', breath: 1, sway: .5, gaze: .8, dip: 2.2 },
  shiun: { stance: 'weapon', breath: .7, sway: .4, gaze: .7, dip: 1.8 },
  'wuming': { stance: 'guard', breath: 1, sway: .5, gaze: .9, dip: 2 },
  jirenga: { stance: 'guard', breath: .8, sway: .3, gaze: .7, dip: 1.8 },
  'jinlin': { stance: 'relaxed', breath: .8, sway: .5, gaze: .9, dip: 1.8 },
  asahi: { stance: 'weapon', breath: 1, sway: .5, gaze: .8, dip: 2.2 },
  levin: { stance: 'weapon', breath: 1, sway: .5, gaze: .8, dip: 2.2 },
};
