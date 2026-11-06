/** Feats: things done once, each paying once - and what a Legendary or a
 *  Mythic asks for besides its price ("increasingly harder", not only
 *  dearer). Tested against an account's lifetime numbers after every match. */
import type { AccountStats } from './account';
import { levelOf } from './earn';
import { modesOf } from './modeStats';

export interface Feat { id: string; name: string; text: string; pay: number; done: (stats: AccountStats, xp: number) => boolean }

export const FEATS: readonly Feat[] = [
  { id: 'first-run', name: 'Through the Rift', text: 'Finish a run or a match.', pay: 50, done: s => s.runs + s.matches >= 1 },
  { id: 'rank-c', name: 'Third Volume', text: 'Reach rank C in a run.', pay: 80, done: s => s.bestRank >= 3 },
  { id: 'rank-b', name: 'Serialised', text: 'Reach rank B in a run.', pay: 150, done: s => s.bestRank >= 4 },
  { id: 'rank-a', name: 'Front Cover', text: 'Reach rank A in a run.', pay: 250, done: s => s.bestRank >= 5 },
  { id: 's-rank', name: 'God Slayer', text: 'Beat a boss of rank S.', pay: 300, done: s => s.sBosses >= 1 },
  { id: 'seal', name: 'The Seal', text: 'Seal the rift.', pay: 500, done: s => s.seals >= 1 },
  { id: 'seal-3', name: 'Three Seals', text: 'Seal the rift three times.', pay: 400, done: s => s.seals >= 3 },
  { id: 'author', name: 'Author', text: 'Seal the rift with five different fighters.', pay: 500, done: s => s.sealedWith.length >= 5 },
  { id: 'finishers-25', name: 'The Last Word', text: 'Land twenty-five finishers.', pay: 200, done: s => s.finishers >= 25 },
  { id: 'bosses-100', name: 'A Hundred Pages', text: 'Beat a hundred bosses.', pay: 300, done: s => s.bosses >= 100 },
  { id: 'rounds-100', name: 'Long Runner', text: 'Clear a hundred rounds.', pay: 200, done: s => s.rounds >= 100 },
  { id: 'style-sss', name: 'Shōnen Legend', text: 'Reach style SSS.', pay: 150, done: s => s.bestStyle >= 6 },
  { id: 'fast-boss', name: 'One Page', text: 'Beat a boss in under twenty seconds.', pay: 100, done: s => s.fastBoss > 0 && s.fastBoss < 20 },
  { id: 'wins-1', name: 'First Blood', text: 'Win a match.', pay: 50, done: s => s.wins >= 1 },
  { id: 'wins-10', name: 'Ten Wins', text: 'Win ten matches.', pay: 200, done: s => s.wins >= 10 },
  { id: 'streak-7', name: 'A Week Running', text: 'Play seven days in a row.', pay: 150, done: s => s.bestStreak >= 7 },
  { id: 'level-40', name: 'Forty Volumes', text: 'Reach account level 40.', pay: 300, done: (_s, xp) => levelOf(xp).level >= 40 },
  // Beyond Arcade (2 November 2026): a feat for each mode, the couch and playing with friends (modeStats.ts). Player Two
  // gives them as trophies once they are defined there (scripts/p2/trophies.mjs).
  { id: 'friends-1', name: 'Side by Side', text: 'Play a match with a friend: in a private room, a party or on the couch.', pay: 50, done: s => modesOf(s).friends >= 1 },
  { id: 'friends-25', name: 'The Old Crew', text: 'Play twenty-five matches with friends.', pay: 200, done: s => modesOf(s).friends >= 25 },
  { id: 'couch-1', name: 'One Couch', text: 'Play a couch match: two players on one device.', pay: 50, done: s => modesOf(s).couch >= 1 },
  { id: 'couch-wins-5', name: 'Home Ground', text: 'Win five couch matches.', pay: 100, done: s => modesOf(s).couchWins >= 5 },
  { id: 'duel-wins-5', name: 'Rival Arc', text: 'Win five Duels.', pay: 150, done: s => modesOf(s).duelWins >= 5 },
  { id: 'royale-win', name: 'Last One Standing', text: 'Win a Battle Royale.', pay: 100, done: s => modesOf(s).royaleWins >= 1 },
  { id: 'waves-20', name: 'The Village Holds', text: 'Clear twenty waves in one Last Stand.', pay: 200, done: s => modesOf(s).bestWaves >= 20 },
  { id: 'bad-blood-wins-3', name: 'Blood Feud', text: 'Win three Bad Blood matches.', pay: 150, done: s => modesOf(s).badBloodWins >= 3 },
  { id: 'rift-win', name: 'The Keep Falls', text: 'Win a Rift War.', pay: 150, done: s => modesOf(s).riftWins >= 1 },
  { id: 'towers-10', name: 'Siege Breaker', text: 'Bring down ten Rift War structures: towers, barracks, guardians or the core.', pay: 150, done: s => modesOf(s).towers >= 10 },
];
export const FEAT = new Map(FEATS.map(each => [each.id, each] as const));
