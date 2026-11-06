/** Missions: three a day and three a week, the same for everyone, picked from
 *  a pool by the date. Each counts something a match's report carries.
 *
 *  Every mission can be done in every mode that pays (8 October 2026, the shop
 *  streamlined: the pools had Arcade-only missions - beat bosses, cut down the
 *  horde - that a player of Battle Royale, Duel, Last Stand or Bad Blood could
 *  never finish). A knockout is a fighter knocked out in a match or a boss beaten
 *  in a run; a win is a match, a set or a team battle won, or a run that reached
 *  rank B.
 *
 *  Beside the three, one challenge a day and one a week asks for a mode or a
 *  friend (2 November 2026, below): the one kind of mission a mode can't finish,
 *  and so never needed for the bonus for all three. */
import type { MatchReport, Report } from './earn';

export interface Mission { id: string; text: string; goal: number; pay: number; count: (report: Report, fresh: { fighter: boolean }) => number }

/** What a mission pays: each of the day's, all three of them, each of the week's (in Sumi; and 10 experience each). */
const DAILY_PAY = 40, WEEKLY_PAY = 150;
export const ALL_DAILY_BONUS = 60;
const daily = (id: string, text: string, goal: number, count: Mission['count']): Mission => ({ id: `d-${id}`, text, goal, pay: DAILY_PAY, count });
const weekly = (id: string, text: string, goal: number, count: Mission['count']): Mission => ({ id: `w-${id}`, text, goal, pay: WEEKLY_PAY, count });

/** Knockouts, in any mode: fighters knocked out in a match, bosses beaten in a run. */
const knockouts = (r: Report) => r.mode === 'survival' ? r.bosses : r.kos;
/** A win, in any mode: first place in a match, a set or a team battle; a run that reached rank B or sealed the rift. */
const won = (r: Report) => r.mode === 'survival' ? r.sealed || r.rank >= 4 : r.place === 1;
/** A podium, in any mode: the top three of a Battle Royale, a Duel or a team battle won (a Rift War's too: its sides are
 *  first and second), a run at rank C. */
const podium = (r: Report) => r.mode === 'survival' ? r.rank >= 3 : r.mode === 'duel' || r.mode === 'last-stand' || r.mode === 'bad-blood' || r.mode === 'rift-war' ? r.place === 1 : r.place <= 3;

export const DAILY: readonly Mission[] = [
  daily('play-3', 'Play three matches', 3, () => 1),
  daily('play-5', 'Play five matches', 5, () => 1),
  daily('minutes-20', 'Fight for twenty minutes', 20, r => r.seconds / 60),
  daily('fighters-2', 'Play two different fighters', 2, (_r, fresh) => fresh.fighter ? 1 : 0),
  daily('kos-5', 'Five knockouts (fighters or bosses)', 5, knockouts),
  daily('top-3', 'Finish in the top three', 1, r => podium(r) ? 1 : 0),
  daily('win-1', 'Win a match', 1, r => won(r) ? 1 : 0),
];
export const WEEKLY: readonly Mission[] = [
  weekly('play-20', 'Play twenty matches', 20, () => 1),
  weekly('wins-3', 'Win three matches', 3, r => won(r) ? 1 : 0),
  weekly('hours-2', 'Fight for two hours', 120, r => r.seconds / 60),
  weekly('kos-40', 'Forty knockouts (fighters or bosses)', 40, knockouts),
  weekly('top-3-6', 'Finish in the top three six times', 6, r => podium(r) ? 1 : 0),
];

/** The day's and the week's challenge (2 November 2026): a fourth mission beside the three, from a mode or from playing
 *  with friends - a Duel won, a tower brought down in Rift War, a match with a friend or on the couch. The three stay as
 *  they were (each date still picks the same three, and the bonus for all three still asks only what any mode can
 *  finish); a challenge is one more to do, paid as the others are, and never needed for that bonus. */
const won1 = (r: Report) => r.mode !== 'survival' && r.place === 1;
const royale = (r: Report): r is MatchReport => r.mode === 'match' || r.mode === 'bots' || r.mode === 'private';
const of = (mode: Report['mode'], test: (r: Report) => boolean = () => true) => (r: Report) => r.mode === mode && test(r) ? 1 : 0;
const waves = (r: Report) => r.mode === 'last-stand' ? r.rounds ?? 0 : 0;
export const DAILY_CHALLENGES: readonly Mission[] = [
  daily('friend', 'Play a match with a friend (a private room, a party or the couch)', 1, r => r.friends ? 1 : 0),
  daily('couch-win', 'Win a couch match', 1, r => r.couch && won(r) ? 1 : 0),
  daily('duel-win', 'Win a Duel', 1, of('duel', won1)),
  daily('royale-top-3', 'Finish a Battle Royale in the top three', 1, r => royale(r) && r.players > 2 && r.place <= 3 ? 1 : 0),
  daily('waves-10', 'Clear ten waves in one Last Stand', 1, r => waves(r) >= 10 ? 1 : 0),
  daily('bad-blood-win', 'Win a Bad Blood match', 1, of('bad-blood', won1)),
  daily('rift-tower', 'Destroy a tower in Rift War', 1, r => r.mode === 'rift-war' ? r.towers ?? 0 : 0),
];
export const WEEKLY_CHALLENGES: readonly Mission[] = [
  weekly('friends-5', 'Play five matches with friends', 5, r => r.friends ? 1 : 0),
  weekly('couch-wins-3', 'Win three couch matches', 3, r => r.couch && won(r) ? 1 : 0),
  weekly('duel-wins-3', 'Win three Duels', 3, of('duel', won1)),
  weekly('royale-win', 'Win a Battle Royale', 1, r => royale(r) && r.players > 2 && won1(r) ? 1 : 0),
  weekly('waves-15', 'Clear fifteen waves in one Last Stand', 1, r => waves(r) >= 15 ? 1 : 0),
  weekly('bad-blood-wins-3', 'Win three Bad Blood matches', 3, of('bad-blood', won1)),
  weekly('rift-win', 'Win a Rift War', 1, of('rift-war', won1)),
];

/** Three of a pool for a day or a week: the same three for everyone, from its name. */
export function pick(pool: readonly Mission[], key: string): Mission[] {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const left = [...pool], out: Mission[] = [];
  while (out.length < 3 && left.length) { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; out.push(left.splice(h % left.length, 1)[0]); }
  return out;
}
export const dailyMissions = (day: string) => pick(DAILY, `day:${day}`);
export const weeklyMissions = (week: string) => pick(WEEKLY, `week:${week}`);
/** The day's and the week's challenge: one of its pool, the same for everyone, from its name. */
export const dailyChallenge = (day: string) => pick(DAILY_CHALLENGES, `challenge:${day}`)[0];
export const weeklyChallenge = (week: string) => pick(WEEKLY_CHALLENGES, `challenge:${week}`)[0];
