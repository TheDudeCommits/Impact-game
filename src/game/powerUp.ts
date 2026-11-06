import type { FighterId } from './types';

/** The power-up pass (10 October 2026): every transformation arrives as a power-up - the ki flame erupting round the
 *  fighter, its lightning, the floor lifting, the room going dark, and its roar - except these, whose arrival is
 *  drawn and heard by their fighter's own layer (src/render/signature/). The renderer (AwakeningEffects, the flame)
 *  and the audio (CombatAudio, the roar) both read it. Client-side.
 *
 *  Launch night (12 October 2026): six more stood here (the Empress's posture, Kuzu's ripcord, Shakugo's magma, Shanxiao's
 *  berserker, Pyroclast's cluster, Full Beam's pressure) and, filmed in the game, their own layers drew nothing or next to
 *  nothing: eight frames of the idle, no flash, no aura, and nothing left on the body afterwards (the standing layer
 *  is skipped for these too). They arrive as everyone does until their layers draw. Sorayomi's gathering weather does
 *  draw, and Chohan's arrival is physical on purpose (tests/roster96Availability.test.ts). */
export const OWN_ENTRANCES: ReadonlySet<FighterId> = new Set<FighterId>(['chohan', 'sorayomi']);
