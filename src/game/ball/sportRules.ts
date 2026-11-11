/**
 * Which rules this page's ball matches play: `sport` - Goal Rush as football (football.ts) and Sky Spike as volleyball
 * (volley.ts), on any host, Player Two's copy too, with nothing in the address - or `classic`, the rules the two modes
 * were first built on, with `classic` in the address (`?classic`). The old `?football` and `?volleyball` are still accepted and change nothing.
 *
 * Only the matches this device plays (LocalBall: BOTS, COUCH, FREE PLAY, LEARN TO PLAY) have the sport rules: the online
 * room plays classic ones, so a page on the sport rules offers no ONLINE, FRIENDS or party for the two modes
 * (originals/launch.ts). Under node - the match server, the packager, most tests - there is no address, and the answer is
 * `classic`, as it always was: nothing on the server changes.
 *
 * Data only, as everything under src/game.
 */
export type BallRules = 'sport' | 'classic';
export function ballRulesOf(location?: {search: string}): BallRules {
  return location && !new URLSearchParams(location.search).has('classic') ? 'sport' : 'classic';
}
/** This page's rules (read from its address each time: the tests stub it). */
export const pageBallRules = (): BallRules => ballRulesOf(typeof location === 'object' && location ? location : undefined);
/** Whether this page's ball matches play football and volleyball. */
export const sportPage = () => pageBallRules() === 'sport';
