import { guardTakes, type Take } from './takeGuard';

const TAKES: Take[] = [
  // (Nigo's cinder-step take is in nigo-fanim5.glb now, which re-authored it; nigo-fanim2.glb no longer downloads: VOL.7.)
  ['nigo', 'nigo-fanim5.glb', ['Ashstep Strike'], ['nigo-fanim2.glb']],
  ['ouga', 'ouga-fanim2.glb', ['Haou-Dan']],
  ['ward', 'ward-fanim2.glb', ['Stat Shot']],
  ['kagari', 'kagari-fanim2.glb', ['Yuragi Blast']],
  // Vesper's (7 October 2026, scripts/fanim/vesper.py): Raven's Drop, the overhead cut into the floor (it was an
  // upright chop with no step); Raven Dive, the fall on them sabre first (it was a standing slash); and The Offering over
  // its own leap, its thrust at their chest (it was thrust with his hand behind his hips).
  ['vesper', 'vesper-fanim4.glb', ['Hawks Talon', 'Raven Dive', 'The Offering']],
];

guardTakes('the hand-posed heavies', TAKES);
