import CUE_DURATIONS from './data/cueDurations.json';
import CUE_ONSETS from './data/cueOnsets.json';
import VOICE_DURATIONS from './data/voiceDurations.json';
import SFX_DURATIONS from './data/sfxDurations.json';
import { VOICE_CUES } from './voiceCues';
import { SFX_CUES, SFX_PEAKS } from './sfxCues';
import { applyOriginalCues } from '../originals/apply';
import { ORIGINAL_SFX_CUES, applyOriginalSfx } from '../originals/sfx';

export const BASE_CUES = {
  'koko-world':'koko-world.wav','kenzo-phoenix':'kenzo-phoenix.wav',
  'koko-star':'koko-star.wav',
  'ouga-gale':'ouga-gale.wav',
  'shirokane-resolve':'shirokane-resolve.wav',
  'kenzo-crossing':'kenzo-crossing.wav','kenzo-world':'kenzo-world.wav',
  'nigo-nightfall':'nigo-nightfall.wav','nigo-haizan':'nigo-haizan.wav','nigo-unsealed':'nigo-unsealed.wav',
  'swing-a': 'swing-a.wav', 'swing-b': 'swing-b.wav', cloth: 'cloth.wav',
  'body-a': 'body-a.wav', 'body-b': 'body-b.wav', crack: 'crack.wav', ground: 'ground.wav',
  'charge-chi': 'charge-chi.wav', 'release-ki': 'release-ki.wav',
  'energy-tail': 'energy-tail.wav', bomb: 'bomb.wav',
  'taisei-sunpalm-cannon-full': 'taisei-sunpalm-cannon-full.wav',
  'gummy-pistol':'gummy-pistol.wav', 'gummy-bazooka':'gummy-bazooka.wav', 'gummy-grand-tide-fist':'gummy-grand-tide-fist.wav',
  'taisei-spirit': 'taisei-spirit.wav', 'konta-whirlsphere': 'konta-whirlsphere.wav',
  'konta-galewheel': 'konta-galewheel.wav',
  'kurobi-link':'kurobi-link.wav','kurobi-taunt':'kurobi-taunt.wav',
  'kurobi-growl':'kurobi-growl.wav','kurobi-bite':'kurobi-bite.wav',
  // Round 16: the six new fighters. See scripts/register_round16_audio.py.
  'kagari-hinoko':'kagari-hinoko.wav','kagari-yuragi':'kagari-yuragi.wav',
  'ward-crossmatch':'ward-crossmatch.wav','ward-cautery-blade':'ward-cautery-blade.wav','ward-flatline':'ward-flatline.wav','ward-stat-shot':'ward-stat-shot.wav',
  'kuon-ao':'kuon-ao.wav','kuon-aka':'kuon-aka.wav','kuon-violet':'kuon-violet.wav','kuon-boundless':'kuon-boundless.wav',
  'oro-noroma':'oro-noroma.wav','oro-noroma-noroma':'oro-noroma-noroma.wav','oro-the-hour':'oro-the-hour.wav','oro-steamroller':'oro-steamroller.wav',
  'gaunt-scream':'gaunt-scream.wav',
  'setsu-ikazuchi':'setsu-ikazuchi.wav','setsu-gale-step':'setsu-gale-step.wav',
} as const;
export const AUDIO_CUES = { ...BASE_CUES, ...VOICE_CUES, ...SFX_CUES, ...ORIGINAL_SFX_CUES } as const;
applyOriginalCues(AUDIO_CUES as unknown as Record<string, string>, CUE_DURATIONS as Record<string, number>, VOICE_DURATIONS as Record<string, number>, CUE_ONSETS as Record<string, number>);
applyOriginalSfx(AUDIO_CUES as unknown as Record<string, string>, SFX_DURATIONS as Record<string, number>, SFX_PEAKS as Record<string, number>);
export type AudioCue = keyof typeof AUDIO_CUES;
export interface CueLayer {
  cue: AudioCue; voicePriority?:number; bus?: 'sfx' | 'voice'; gain: number; delay?: number; rate?: number;
  loop?: boolean; duration?: number; phase?: 'charge' | 'cast' | 'release' | 'impact';
  speaker?: string; url?: string; yields?: 'self' | 'all';
}

/** Measured output length of a cue, less the onset the runtime trims. New cues
 *  record their lengths in data/voiceDurations.json or data/sfxDurations.json;
 *  their files are trimmed at the source, so they carry no onset entry. */
export function cueDuration(cue:AudioCue){
  const durations={...CUE_DURATIONS,...VOICE_DURATIONS,...SFX_DURATIONS} as Record<string,number>;
  return durations[cue]-Math.max(0,((CUE_ONSETS as Record<string,number>)[cue]??0)-.015);
}
