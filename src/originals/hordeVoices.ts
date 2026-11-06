type Moment = 'swing' | 'cry' | 'hurt' | 'die';

/** The new families and how many takes each has. */
export const ORIGINAL_HORDE_FAMILIES: Readonly<Record<string, number>> = {
  'woman-swing': 5, 'woman-cry': 3, 'woman-hurt': 4, 'woman-die': 3,
  'masked-swing': 10, 'masked-cry': 8, 'masked-hurt': 5, 'masked-die': 5,
  'iron-grind': 4, 'furnace-roar': 3, 'iron-hit': 8, 'iron-fall': 3,
  'hyena-cry': 3, 'fuse-hiss': 3,
  'wood-swing': 3, 'wood-cry': 2, 'wood-hurt': 3, 'wood-die': 2,
};
/** The new voices: the family for each moment. */
export const ORIGINAL_HORDE_VOICES: Readonly<Record<string, Readonly<Record<Moment, string>>>> = {
  iron: { swing: 'iron-grind', cry: 'furnace-roar', hurt: 'iron-hit', die: 'iron-fall' },
  hyena: { swing: 'beast-swing', cry: 'hyena-cry', hurt: 'beast-hurt', die: 'beast-die' },
  woman: { swing: 'woman-swing', cry: 'woman-cry', hurt: 'woman-hurt', die: 'woman-die' },
  masked: { swing: 'masked-swing', cry: 'masked-cry', hurt: 'masked-hurt', die: 'masked-die' },
  wood: { swing: 'wood-swing', cry: 'wood-cry', hurt: 'wood-hurt', die: 'wood-die' },
};
/** Who speaks with them, by grunt kind (src/survival/horde/kinds.ts), and at what playback rate. */
export const ORIGINAL_HORDE_VOICE_OF: Readonly<Record<string, string>> = {
  automaton: 'iron', 'beast-leaper': 'hyena', 'beast-medic': 'woman',
  'tribunal-guard': 'masked', 'tribunal-guard-shield': 'masked', 'tribunal-guard-rifle': 'masked', 'tribunal-guard-sniper': 'masked', 'white-pale-sapling': 'wood',
};
const ORIGINAL_HORDE_PITCH: Readonly<Record<string, number>> = {
  automaton: .9, 'beast-leaper': 1.1, 'beast-medic': 1, 'tribunal-guard': .96, 'tribunal-guard-shield': .92, 'tribunal-guard-rifle': 1.02, 'tribunal-guard-sniper': 1, 'white-pale-sapling': .95,
};

export function applyOriginalHordeVoices(bank: Record<string, number>, voiceOf: Record<string, string>, pitch: Record<string, number>, lines: Record<string, Record<Moment, string>>) {
  Object.assign(bank, ORIGINAL_HORDE_FAMILIES);
  for (const [voice, row] of Object.entries(ORIGINAL_HORDE_VOICES)) lines[voice] = { ...row };
  Object.assign(voiceOf, ORIGINAL_HORDE_VOICE_OF);
  Object.assign(pitch, ORIGINAL_HORDE_PITCH);
}

/** main.ts's horde windup: the family a self-destruct's wind-up hisses with (a fuse up to the burst). */
export const hordeFuse = (moveKind: string | undefined): string | undefined => moveKind === 'explode' ? 'fuse-hiss' : undefined;
