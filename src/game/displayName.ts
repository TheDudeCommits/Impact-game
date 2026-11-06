
/** The name of a fighter whose name was refused, or who typed none. */
export const NAME_FALLBACK = 'Fighter';

/** Scripts whose accented letters all have a precomposed form, which NFKC gives: a mark still standing after one of
 *  their letters is decoration (a strike-through, zalgo). Others write vowels and tones as marks (Devanagari, Thai),
 *  so two may follow each of their letters. */
const COMPOSED = /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}]/u;
const MARK = /\p{M}/u, LETTER = /\p{L}/u, READ = /[\p{L}\p{N}]/u, SPACE = /[\p{Zs}\t\n\r\u2028\u2029]/u;
/** Letters drawn as nothing (the Hangul fillers): a name of them would be invisible. */
const BLANK = /[\u115F\u1160\u3164\uFFA0]/u;
/** Curly quotes and the dashes, as the plain ones a strict name keeps. */
const QUOTE = /[\u2018\u2019\u02BC\u0060\u00B4]/u, DASH = /[\u2010-\u2015\u2212]/u;
/** Besides letters, digits and single spaces: what a strict name keeps, and what any name drops. */
const PUNCTUATION = /[-_.']/u, UNDRAWN = /[\p{C}<>]/u;

/** `raw` as a name to draw: at most `max` characters, its spaces single, or NAME_FALLBACK when no letter or digit is left.
 *  `strict` (the server's rule for a typed name) keeps nothing but letters, digits, spaces and - _ . ' ; otherwise
 *  only what is never drawn goes (the names the game itself gives - "Bot · Thunder Hawk" - keep their dots). */
export function tidyName(raw: unknown, max = 20, strict = false): string {
  let out = '', marks = -1, space = false;
  // (Bounded first: it runs on every join, and a page can send anything.)
  for (const each of String(raw ?? '').slice(0, 160).normalize('NFKC')) {
    if (MARK.test(each)) { if (marks >= 0 && marks < 2) { out += each; marks++; } continue; }
    marks = -1;
    if (BLANK.test(each)) continue;
    if (SPACE.test(each)) { space = out.length > 0; continue; }
    const char = QUOTE.test(each) ? '\'' : DASH.test(each) ? '-' : each;
    if (!READ.test(char) && (strict ? !PUNCTUATION.test(char) : UNDRAWN.test(char))) continue;
    if (space) { out += ' '; space = false; }
    out += char;
    if (LETTER.test(char) && !COMPOSED.test(char)) marks = 0;
  }
  const name = [...out].slice(0, max).join('').trimEnd();
  return READ.test(name) ? name : NAME_FALLBACK;
}
