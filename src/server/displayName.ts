import { NAME_FALLBACK, tidyName } from '../game/displayName';
import { OWN_NAMES } from '../game/economy/names';
import { ANYWHERE, LETTER, WORDS } from './economy/names';

/** Names that would pass for the game, its staff or its owner, anywhere in a name (with its separators taken out)... */
const RESERVED_ANYWHERE = ['admin', 'moderator', 'official', 'impactgame', 'gamemaster', 'thedude'];
const RESERVED_WORDS = new Set(['mod', 'mods', 'owner', 'owners', 'staff', 'system', 'support', 'dev', 'devs', 'developer', 'developers',
  'gm', 'gms', 'sysop', 'dude', ...OWN_NAMES]);

/** Letters drawn like Latin ones: Cyrillic, Greek, small capitals and a few Latin letters NFKC leaves alone. */
const LOOKALIKE: Record<string, string> = Object.fromEntries([
  // Cyrillic
  'аa вb гr еe ѕs іi јj кk мm нh оo пn рp сc тt уy хx шw щw ъb ьb һh ԁd ԛq ԝw ӏl ғf',
  'АA ВB ЕE ЅS ІI ЈJ КK МM НH ОO РP СC ТT УY ХX ԀD ԚQ ԜW ӀI ЬB',
  // Greek
  'αa βb γy δd εe ηn ιi κk μu νv οo πn ρp σo ςc τt υu χx ωw ϲc ϳj',
  'ΑA ΒB ΕE ΖZ ΗH ΙI ΚK ΜM ΝN ΟO ΡP ΤT ΥY ΧX ϹC ͿJ',
  // Small capitals and other Latin
  'ᴀa ʙb ᴄc ᴅd ᴇe ɢg ʜh ɪi ᴊj ᴋk ʟl ᴍm ɴn ᴏo ᴘp ʀr ꜱs ᴛt ᴜu ᴠv ᴡw ʏy ᴢz ıi ȷj łl øo đd ħh ŧt ƀb ɑa ɡg ɩi ǀl',
].join(' ').split(' ').map(pair => [...pair] as [string, string]));
const SEPARATORS = /[\s\-_.']+/gu, EDGE_DIGITS = /^\d+|\d+$/g;

/** `text` as the Latin letters it shows: accents and marks gone, look-alikes read as what they look like, lower case
 *  (digits stay digits). */
function latin(text: string) {
  let out = '';
  for (const each of text.normalize('NFKD').replace(/\p{M}/gu, '')) out += LOOKALIKE[each] ?? each;
  return out.toLowerCase();
}
/** The readings of a word: its digits and signs as letters (1 as i, and as l), and l and rn as the i and m they pass for. */
function readings(word: string): string[] {
  const read = word.replace(/[0-9@$]/g, digit => LETTER[digit] ?? digit);
  return [...new Set([read, word.replace(/1/g, 'l').replace(/[0-9@$]/g, digit => LETTER[digit] ?? digit), read.replace(/l/g, 'i').replace(/rn/g, 'm')])];
}

export function refusedName(name: string): boolean {
  const whole = readings(latin(name).replace(SEPARATORS, ''));
  if (whole.some(reading => ANYWHERE.some(word => reading.includes(word)) || RESERVED_ANYWHERE.some(word => reading.includes(word)) || WORDS.has(reading) || RESERVED_WORDS.has(reading))) return true;
  // Its words: between separators, and at camelCase's capitals ("TheDude", "ModBob"), with and without digits at their ends.
  const words = name.split(SEPARATORS).flatMap(part => part.split(/(?<=\p{Ll})(?=\p{Lu})/u)).map(latin).filter(Boolean);
  return words.some(word => [word, word.replace(EDGE_DIGITS, '')].flatMap(readings).some(reading => WORDS.has(reading) || RESERVED_WORDS.has(reading)));
}

/** The name a typed one becomes on this server: tidy and strict, at most `max` characters, or NAME_FALLBACK if nothing
 *  readable is left or it says what no name may. */
export function displayName(raw: unknown, max = 20): string {
  if (typeof raw !== 'string') return NAME_FALLBACK;
  const name = tidyName(raw, max, true);
  // (Read with its signs too: "@dmin" and "$hit" say what they say, though the @ and $ are not drawn.)
  return name === NAME_FALLBACK || refusedName(name) || refusedName(tidyName(raw, max)) ? NAME_FALLBACK : name;
}

/** The keys a claimed username would be held under if `name` is passing for it (src/server/economy/book.ts nameHolder):
 *  its look-alike letters read as Latin, and its separators as _ or as nothing. */
export function heldKeys(name: string): string[] {
  const base = latin(name);
  return [...new Set([base, base.replace(SEPARATORS, '_'), base.replace(SEPARATORS, '')])];
}
