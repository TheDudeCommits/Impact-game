/** Arcade survival's horde voices: families of short CC0 takes (built by
 *  scripts/survival/build_sfx.py into /assets/audio/survival, sources in its
 *  manifest.json), picked from at random, and which family each kind of grunt
 *  speaks with and at what pitch - a Automaton is a machine, a Brood Spawn. a
 *  child. Nothing here is a character's voice: the rank and file are men,
 *  beasts, brutes and imps. */
import { WEARS } from '../survival/horde/kinds';
import { applyOriginalHordeVoices } from '../originals/hordeVoices';

export const BANK = {
  'man-swing': 10, 'man-cry': 8, 'man-hurt': 5, 'man-die': 5,
  'beast-swing': 9, 'beast-growl': 10, 'beast-roar': 7, 'beast-hurt': 5, 'beast-die': 7,
  'brute-roar': 5, imp: 7, gore: 18, stomp: 1,
  'zombie-swing': 16, 'zombie-cry': 5, 'zombie-hurt': 6, 'zombie-die': 5, 'demon-roar': 12,
} as const;
export type Family = keyof typeof BANK;
export type Voice = 'man' | 'beast' | 'brute' | 'imp' | 'zombie' | 'demon';

/** Who speaks how, by grunt kind id (src/survival/horde/kinds.ts). */
export const VOICE_OF: Record<string, Voice> = {
  // (The Tribunal's guards are dead men walking now - their models are zombie sailors - and so are the husks.)
  'tribunal-guard': 'zombie', 'tribunal-guard-rifle': 'zombie', husk: 'zombie',
  'graft-raider': 'man', 'jinlin-soldier': 'man', 'cutthroat': 'man',
  'ash-wraith': 'demon', 'ash-caster': 'demon', 'pale-sapling': 'beast',
  automaton: 'brute', 'graft-brute': 'brute', 'great-wraith': 'brute', 'rift-spawn': 'brute',
  'cinder-imp': 'imp', 'brood-spawn': 'imp',
};
/** Playback rate by kind: pitch without another take. */
export const PITCH: Record<string, number> = {
  automaton: .72, 'graft-brute': .82, 'great-wraith': .7, 'rift-spawn': .66, 'graft-raider': .9, husk: .86, 'tribunal-guard': .96, 'tribunal-guard-rifle': 1.02,
  'pale-sapling': 1.12, 'cinder-imp': 1.18, 'brood-spawn': 1.25, 'ash-wraith': .95, 'ash-caster': 1.02,
};

// The fifth list's kinds speak as the bodies they wear (horde/kinds.ts WEARS).
for (const [kind, body] of Object.entries(WEARS)) { VOICE_OF[kind] ??= VOICE_OF[body]; PITCH[kind] ??= PITCH[body] ?? 1; }

/** The families a voice uses for each moment. */
export const LINES: Record<Voice, { swing: Family; cry: Family; hurt: Family; die: Family }> = {
  man: { swing: 'man-swing', cry: 'man-cry', hurt: 'man-hurt', die: 'man-die' },
  beast: { swing: 'beast-swing', cry: 'beast-roar', hurt: 'beast-hurt', die: 'beast-die' },
  brute: { swing: 'brute-roar', cry: 'demon-roar', hurt: 'beast-hurt', die: 'beast-die' },
  imp: { swing: 'imp', cry: 'imp', hurt: 'imp', die: 'beast-die' },
  zombie: { swing: 'zombie-swing', cry: 'zombie-cry', hurt: 'zombie-hurt', die: 'zombie-die' },
  demon: { swing: 'beast-swing', cry: 'demon-roar', hurt: 'beast-hurt', die: 'beast-die' },
};
applyOriginalHordeVoices(BANK as unknown as Record<string, number>, VOICE_OF, PITCH, LINES as unknown as Record<string, Record<'swing' | 'cry' | 'hurt' | 'die', string>>);

/** How many of a family may sound in a second, where a crowd would otherwise
 *  fire one per body (every sliced grunt a wet splat): past it, silence. */
const RATE: Partial<Record<Family, number>> = { gore: 5 };
const heard = new Map<Family, number[]>();
/** A breath of silence, for a take the rate turned away. */
export const SILENCE = '/assets/audio/survival/silence.m4a';

/** One take of a family, at random (or silence, past its rate). */
export const take = (family: Family, random = Math.random) => {
  const limit = RATE[family];
  if (limit !== undefined && typeof performance === 'object') {
    const now = performance.now() / 1000, times = heard.get(family) ?? [];
    while (times.length && now - times[0] > 1) times.shift();
    if (times.length >= limit) return SILENCE;
    times.push(now); heard.set(family, times);
  }
  return `/assets/audio/survival/${family}-${1 + Math.floor(random() * BANK[family])}.m4a`;
};
/** Every take, for warming the cache when a run starts. */
export const everyTake = () => [SILENCE, ...(Object.keys(BANK) as Family[]).flatMap(family => Array.from({ length: BANK[family] }, (_, i) => `/assets/audio/survival/${family}-${i + 1}.m4a`))];
