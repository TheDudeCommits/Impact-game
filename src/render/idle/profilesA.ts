import type { FighterId } from '../../game/types';
import type { IdleProfile } from './profile';

export const PROFILES_A: Partial<Record<FighterId, IdleProfile>> = {
  // An energetic ready stance, bouncing on the balls of his feet; the clip
  // carries the bounce, so the layer adds none.
  konta: { model: '/assets/fighters/konta-idle2.glb', clip: 'Konta idle', fidgets: ['Konta idle fidget'], stance: 'guard', breath: 1, sway: .6, gaze: 1 },
  // Slouched over one hip, a hand in his pocket, the kunai hanging loose.
  // Round 3c: a lazy breath he sinks into (0.5 cm of head travel before).
  shirokane: { model: '/assets/fighters/shirokane-idle1.glb', clip: 'Shirokane idle', fidgets: ['Shirokane idle fidget'], stance: 'relaxed', breath: 1, sway: .8, gaze: 1, dip: 2.8 },
  shiden: { model: '/assets/fighters/shiden-idle1.glb', clip: 'Shiden idle', fidgets: ['Shiden idle fidget'], stance: 'weapon', breath: 1.2, sway: .9, gaze: .8, dip: 3.8 },
  taisei: { model: '/assets/fighters/taisei-idle1.glb', clip: 'Taisei idle', fidgets: ['Taisei idle fidget'], stance: 'guard', breath: 1, sway: .6, gaze: 1, ready: 'taisei-ready' },
  // Arms folded, chin up: he barely moves. Round 3c: barely, not at all -
  // 0.5 cm of head travel up and down in five seconds read as a statue; the
  // folded arms rise and fall with a fuller breath and he settles into it.
  ouga: { model: '/assets/fighters/ouga-idle1.glb', clip: 'Ouga idle', fidgets: ['Ouga idle fidget'], stance: 'relaxed', breath: 1.3, sway: .8, gaze: .7, dip: 3 },
  // HAIZAN over the shoulder. Round 3c: breathing into the ready knees
  // (0.3 cm of head travel before).
  nigo: { model: '/assets/fighters/nigo-idle1.glb', clip: 'Nigo idle', fidgets: ['Nigo idle fidget'], stance: 'weapon', breath: 1, sway: .7, gaze: 1, dip: 3 },
  // Hands in his pockets and a lazy sway of his own. Round 3c: and a breath
  // he settles into - squared up at lock-on range his head moved 0.7 cm up
  // and down in five seconds.
  kuon: { model: '/assets/fighters/kuon-idle1.glb', clip: 'Kuon idle', fidgets: ['Kuon idle fidget'], stance: 'relaxed', breath: .9, sway: .8, gaze: 1, dip: 2.8 },
  // Hands in his pockets, unmoved - but breathing (0.4 cm of head travel up
  // and down before round 3c).
  koko: { model: '/assets/fighters/koko-idle1.glb', clip: 'KoKo idle', fidgets: ['KoKo idle fidget'], stance: 'relaxed', breath: .9, sway: .5, gaze: .6, dip: 2.6 },
};
