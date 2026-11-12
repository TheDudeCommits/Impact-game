import { take, type Family } from './survivalBank';
import type { AudioCue } from './cuePlan';
import { applyOriginalBossVoices } from '../originals/survival';

export type BossMoment = 'entrance' | 'attack' | 'hurt' | 'rage' | 'defeat';
type Timbre = 'man' | 'beast' | 'brute' | 'fox';
interface BossVoice { timbre: Timbre; pitch: number; own?: Partial<Record<BossMoment, readonly string[]>>; moves?: Record<string, readonly string[]>;
  /** What it says calling a signature (signatures.ts), by the signature's name. */
  signatures?: Record<string, readonly string[]> }

/** By enemy id (src/survival/enemies.ts). Pitch follows the body: Gorai and
 *  Banjaku low, Jinlin high. */
export const BOSS_VOICES: Record<string, BossVoice> = {
  takane: { timbre: 'man', pitch: 1.05 }, harrow: { timbre: 'beast', pitch: 1 }, kanuki: { timbre: 'man', pitch: .8 },
  gantry: { timbre: 'man', pitch: .8 }, zarek: { timbre: 'beast', pitch: 1.05 }, 'nightfall': { timbre: 'beast', pitch: 1.18 },
  kade: { timbre: 'beast', pitch: .86 }, nihil: { timbre: 'man', pitch: .95 }, ashwing: { timbre: 'brute', pitch: .92 },
  'dune-oni': { timbre: 'man', pitch: .84 }, kuromitsu: { timbre: 'man', pitch: .78 }, rime: { timbre: 'man', pitch: .82 },
  lumen: { timbre: 'man', pitch: .9 }, caldera: { timbre: 'man', pitch: .74 }, mirabel: { timbre: 'brute', pitch: 1.22 },
  'wuming': { timbre: 'man', pitch: 1.02 }, 'jinlin': { timbre: 'man', pitch: 1.2 }, shiun: { timbre: 'man', pitch: .88 },
  kurobi: { timbre: 'fox', pitch: 1 }, banjaku: { timbre: 'man', pitch: .72 }, gorai: { timbre: 'brute', pitch: .78 }, 'gorai-wyrm': { timbre: 'brute', pitch: .62 },
  haldor: { timbre: 'man', pitch: .68 }, barrow: { timbre: 'man', pitch: .82 }, akagane: { timbre: 'man', pitch: .9 },
  oro: { timbre: 'man', pitch: 1 }, magatsu: { timbre: 'man', pitch: .86 }, vesper: { timbre: 'man', pitch: 1.08 },
  imago: { timbre: 'beast', pitch: .9 },
};

const FAMILY: Record<Exclude<Timbre, 'fox'>, Record<BossMoment, Family>> = {
  man: { entrance: 'man-cry', attack: 'man-swing', hurt: 'man-hurt', rage: 'man-cry', defeat: 'man-die' },
  beast: { entrance: 'beast-roar', attack: 'beast-swing', hurt: 'beast-hurt', rage: 'beast-roar', defeat: 'beast-die' },
  brute: { entrance: 'brute-roar', attack: 'brute-roar', hurt: 'beast-hurt', rage: 'brute-roar', defeat: 'beast-die' },
};
const FOX: Record<BossMoment, AudioCue> = { entrance: 'kurobi-taunt', attack: 'kurobi-bite', hurt: 'kurobi-growl', rage: 'kurobi-growl', defeat: 'kurobi-growl' };

const OWN: Record<string, { entrance?: string[]; rage?: string[]; hurt?: string[]; defeat?: string[]; attack?: string[]; moves?: Record<string, string[]>; signatures?: Record<string, string[]> }> = {};
const url = (name: string) => `/assets/audio/survival/boss-${name}.m4a`;
applyOriginalBossVoices(OWN, BOSS_VOICES);
for (const [id, lines] of Object.entries(OWN)) {
  const voice = BOSS_VOICES[id];
  if (!voice) continue;
  const { moves, signatures, ...moments } = lines;
  voice.own = Object.fromEntries(Object.entries(moments).map(([moment, names]) => [moment, names!.map(url)]));
  if (moves) voice.moves = Object.fromEntries(Object.entries(moves).map(([move, names]) => [move, names.map(url)]));
  if (signatures) voice.signatures = Object.fromEntries(Object.entries(signatures).map(([name, names]) => [name, names.map(url)]));
}

/** Every boss line file, for tests and the packager's eyes. */
export const BOSS_LINE_FILES: readonly string[] = Object.values(OWN).flatMap(lines => [...Object.entries(lines).filter(([k]) => k !== 'moves' && k !== 'signatures').flatMap(([, v]) => v as string[]), ...Object.values(lines.moves ?? {}).flat(), ...Object.values(lines.signatures ?? {}).flat()]).map(url);

/** What a boss says calling a signature, if it has a line for it. */
export function signatureLine(enemy: string, name: string | undefined): string | undefined {
  const lines = name ? BOSS_VOICES[enemy]?.signatures?.[name] : undefined;
  return lines?.length ? lines[Math.floor(Math.random() * lines.length)] : undefined;
}

/** What a boss says throwing a move, if it names it: a line, or nothing. */
export function moveLine(enemy: string, move: string | undefined): string | undefined {
  const lines = move ? BOSS_VOICES[enemy]?.moves?.[move] : undefined;
  return lines?.length ? lines[Math.floor(Math.random() * lines.length)] : undefined;
}
/** One of a boss's own lines for a moment, or nothing (the game's generic voice covers it). */
export function ownLine(enemy: string, moment: BossMoment): string | undefined {
  const lines = BOSS_VOICES[enemy]?.own?.[moment];
  return lines?.length ? lines[Math.floor(Math.random() * lines.length)] : undefined;
}
/** Every line a boss has, to load ahead of its arrival. */
export function linesOf(enemy: string): string[] {
  const voice = BOSS_VOICES[enemy];
  return voice ? [...Object.values(voice.own ?? {}).flat(), ...Object.values(voice.moves ?? {}).flat(), ...Object.values(voice.signatures ?? {}).flat()] as string[] : [];
}
/** A boss whose casts RiftAudio voices - it names moves, or has its own
 *  attack shouts: its attack voice comes from there, not the generic one. */
export function voicedOnCast(enemy: string) { const voice = BOSS_VOICES[enemy]; return !!(voice?.moves || voice?.own?.attack?.length); }
/** One of a boss's own attack shouts, or nothing. */
export function attackShout(enemy: string): string | undefined {
  const lines = BOSS_VOICES[enemy]?.own?.attack;
  return lines?.length ? lines[Math.floor(Math.random() * lines.length)] : undefined;
}

export type BossLine = { url: string; rate: number } | { cue: AudioCue; rate: number };

/** One line for a boss's moment, or nothing for an enemy that is not a boss. */
export function bossLine(enemy: string, moment: BossMoment, random = Math.random): BossLine | undefined {
  const voice = BOSS_VOICES[enemy];
  if (!voice) return undefined;
  // A boss with its own attack voice is voiced on its casts by RiftAudio instead.
  if (moment === 'attack' && voicedOnCast(enemy)) return undefined;
  // Its own lines are spoken by RiftAudio too, which has them loaded before
  // the boss arrives: played from here they were fetched on first use and
  // landed seconds after the moment they belonged to.
  if (voice.own?.[moment]?.length) return undefined;
  const rate = voice.pitch * (.96 + random() * .08);
  if (voice.timbre === 'fox') return { cue: FOX[moment], rate };
  return { url: take(FAMILY[voice.timbre][moment], random), rate };
}
