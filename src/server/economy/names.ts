/** The server's own check of a username, past the shared rules (src/game/economy/names.ts): a short block-list of
 *  slurs and obscenities. It lives here so the page never carries it. It reads through the usual disguises - digits
 *  for letters ("sh1t"), underscores between letters - and matches short words only as whole words, so "Woodcock",
 *  "peacock", "torpedo", "class" and "password" stay free. Small on purpose: it stops the plain cases, not a determined
 *  speller. The display names typed in the lobby are read against the same lists, through more disguises
 *  (src/server/displayName.ts). */

/** Digits and signs read as the letters they stand for. */
export const LETTER: Record<string, string> = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's' };
const read = (text: string) => text.toLowerCase().replace(/[0-9@$]/g, digit => LETTER[digit] ?? digit);

/** Refused anywhere in a name. */
export const ANYWHERE = ['fuck', 'shit', 'cunt', 'bitch', 'nigg', 'faggot', 'retard', 'whore', 'slut', 'hitler', 'kike', 'chink',
  'pussy', 'penis', 'vagina', 'porn', 'twat', 'dildo', 'jizz', 'molest', 'asshole', 'motherf', 'bastard', 'wanker', 'tranny', 'paedo',
  // (8 October 2026, for the public lobby.)
  'cocksuck', 'blowjob', 'handjob', 'pedophil', 'paedophil', 'wetback', 'raghead', 'towelhead', 'sandnig', 'shemale', 'cumshot', 'phuck', 'fcuk'];
/** Refused as a whole name, or as one of the words its underscores separate ("therapist" and "Ashkenazi" stay free). */
export const WORDS = new Set(['ass', 'fag', 'fags', 'cum', 'dick', 'cock', 'tit', 'tits', 'sex', 'rape', 'rapist', 'nazi', 'nazis', 'spic', 'coon', 'hoe', 'hoes',
  'kys', 'pedo', 'wank', 'nig', 'gook', 'jap', 'slag', 'anal', 'nonce',
  'dicks', 'cocks', 'fck', 'fuk', 'fuq', 'niga', 'nigs', 'paki', 'pakis', 'dyke', 'dykes', 'heil', 'kkk', 'boob', 'boobs', 'anus', 'spaz']);

/** Whether `name` is on the block-list. */
export function blockedName(name: string): boolean {
  const whole = read(name.replace(/_/g, ''));
  if (ANYWHERE.some(word => whole.includes(word))) return true;
  return [whole, ...name.split('_').filter(Boolean).map(read)].some(word => WORDS.has(word));
}
