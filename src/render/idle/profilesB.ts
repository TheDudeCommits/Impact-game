import type { FighterId } from '../../game/types';
import type { IdleProfile } from './profile';

export const PROFILES_B: Partial<Record<FighterId, IdleProfile>> = {
  // Loose and bouncy: his battle stance with the flare taken out of the arms,
  // bouncing on the knees with the arms trailing the body a beat late. The
  // clip bounces itself, so the layer's bounce stays off and its sway is
  // halved under the clip's own. Now and then he pulls his hat down and
  // pushes it back up (the end of his own entrance).
  gummy: { model: '/assets/fighters/gummy-idleb1.glb', clip: 'Idle B', fidgets: ['Idle B hat'], stance: 'guard', bounce: 0, sway: .5 },
  // Grounded: his battle stance from the hips down and the lowered blade in
  // the left hand, his home pose's dark blade laid across the right shoulder.
  kenzo: { model: '/assets/fighters/kenzo-idleb1.glb', clip: 'Idle B', stance: 'weapon', sway: .7 },
  // Both hands in his pockets, the weight drifting foot to foot with the free
  // heel lifting, head cocked; the fidget brings the cigarette up.
  kosho: { model: '/assets/fighters/kosho-idleb1.glb', clip: 'Idle B', fidgets: ['Idle B smoke'], stance: 'relaxed', sway: .35, gaze: .8 },
  // Relaxed and cocky: his own home idle, weight back and a hand on his hip.
  // The body is still measured on his battle idle (a deep lunge every attack
  // of his starts from), so his swings keep their feet under them. Round 3c:
  // a home-screen idle is off duty in a fight, so with an opponent close he
  // drops into that battle idle - fists up - and back out once it cools.
  kagari: { clip: '_Idle', stance: 'relaxed', ready: '_Idle' },
  ward: { clip: '_Idle', stance: 'weapon', sway: .7, breath: 1.2, dip: 2.5, ready: '_Idle' },
  // Menace: leaning back, chin up, the right hand open in front of his face
  // and the left on his hip; slow. Now and then he throws his head back and
  // his arms wide - KYAHAAA! - and comes back down.
  oro: { model: '/assets/fighters/oro-idleb1.glb', clip: 'Idle B', fidgets: ['Idle B laugh'], stance: 'stand', breath: .9, sway: .5, gaze: .6 },
  gaunt: { model: '/assets/fighters/gaunt-idleb1.glb', clip: '_Idle', fidgets: ['Idle B heave'], stance: 'weapon', breath: 1.5, dip: 2 },
};
