import type { CombatEvent } from '../game/types';
import type { CueLayer } from './cueTypes';
import { planBodyEffort, planReaction, planVoice, type VoiceScene } from './voicePlan';
import { planSfx } from './sfxPlan';

export { AUDIO_CUES, BASE_CUES, cueDuration, type AudioCue, type CueLayer } from './cueTypes';

export function planCombatAudio(event: CombatEvent, awakened = false, scene?: VoiceScene): CueLayer[] {
  // VOL.5, the move transplant (src/engine/client/transplant.ts): a borrowed move sounds as itself - its own sound
  // effects, unawakened - in the voice of the body throwing it: that body's own efforts, nothing on the voice bus from the
  // fighter it comes from (a recorded move sound in their voice included).
  if (event.body && event.fighter && event.body !== event.fighter)
    // (And what the bodies in a borrowed move's event say about it - a cry, a knockout - is theirs: `scene` names them.)
    return [...planSfx(event, false).filter(layer => layer.bus !== 'voice'), ...planBodyEffort(event, event.body), ...planReaction(event, scene)];
  return [...planSfx(event, awakened), ...planVoice(event, awakened, scene)];
}
