import type { FighterId } from '../game/types';
import type { AudioCue } from './cueTypes';
import { powerCues } from './powerSound';
import { familyCues } from './sfxFamilies';
import { signatureCues } from './sfxSignatures';
import { originalCues } from '../originals/sfx';

export const byNeed = (cue: string) => /^fx-(aura|enter|el|sig)-/.test(cue);

/** What `fighter` brings into a room of the by-need sounds: their awakening's loop and entrance, the made layers of
 *  their moves' element families (audio/sfxFamilies.ts: `fx-el-*`) and their moves' own signatures (sfxSignatures.ts:
 *  `fx-sig-*`). */
export function fighterCues(fighter: FighterId): AudioCue[] { return [...new Set([...powerCues(fighter), ...familyCues(fighter), ...signatureCues(fighter), ...originalCues(fighter) as AudioCue[]])].filter(byNeed); }
