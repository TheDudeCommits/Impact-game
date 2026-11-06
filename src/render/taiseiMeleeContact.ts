/** Deformed striking surfaces in the authored Oup77 gameplay origin, measured at 24fps.
 * Fists: timing-audit-21. Meteor: clean18-origin-probe.json. Local +Z is forward, +Y is up, units metres.
 * This lookup describes this asset, not the server's damage volume.
 */
export const TAISEI_MELEE_CONTACTS = [
  { clip: 'taisei-grounded-rock', peak: .2725, tip: [-.035, 1.4, .68] },
  { clip: 'taisei-grounded-cross', peak: .38, tip: [.035, 1.37, .66] },
  { clip: 'taisei-grounded-meteor', peak: .459375, tip: [-.030230, 1.050073, .770181] },
  // Round 3: the Cloudstep Strike (taisei-transmission1.glb), authored
  // on the heavy's round-3 1.2 s clock, so its kick lands at 0.64 / 1.2 of it.
  // Round 3d (PACE): played straight across the 0.84 s move, the kick at 0.448.
  { clip: 'taisei-cloudstep', peak: .64 / 1.2, tip: [.04, 1.05, .95] },
] as const;
/** Taisei's heavy since round 3: one clip played straight through (Fighter's
 *  `groundedMelee`), vanish, reappear and kick all on the move's own clock. */
export const TAISEI_TRANSMISSION = TAISEI_MELEE_CONTACTS.length - 1;
