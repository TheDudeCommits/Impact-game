// The ranked lab (dev only: npx vite, then /tools/ranked-lab.html): the ranked Duel's and fighter mastery's new screens,
// drawn by their real modules with the page set as it would be on PlayerTwo - in PlayerTwo's player, signed in, the economy
// answering the standing and the season's board - so each can be judged and captured (scripts/duel/ranked_stills.mjs).
//   ?screen=sheet      the Duel sheet, ONLINE, RANKED: the stamp, the season, the board
//   ?screen=guest      the same for a guest: how to sign in
//   ?screen=queue      the queue's dock, twelve seconds in       ?screen=offer   thirty-one seconds in: the unranked bot
//   ?screen=vs         the VS page with both stamps
//   ?screen=results    a ranked set won: PROMOTED, the change, and the fighter's mastery bar with a level gained
//   ?screen=placing    a placement set lost: PLACEMENT 3 OF 5     ?screen=royale  a royale's results with its mastery
//   ?screen=ball       a Goal Rush match's results with its mastery
const q = new URLSearchParams(location.search), screen = q.get('screen') ?? 'sheet', guest = screen === 'guest';

/* ---------- The page as PlayerTwo's player has it, before any module reads it ---------- */
// (At the site's root, as the game's own page is: loading/siteBase.ts puts /assets/ addresses inside the page's folder.)
history.replaceState(null, '', `/${location.search}`);
(globalThis as { PlayerTwo?: unknown }).PlayerTwo = { env: 'p2', init: async () => ({}) };
localStorage.clear();
const account = { pk: 'lab-account', name: 'KITE', xp: 1400, items: {}, worn: { outfits: {}, emotes: [] }, allAccess: true, created: Date.now() - 86_400_000, feats: [], redeemed: {} };
localStorage.setItem('jump-account-token', guest ? 'a'.repeat(32) : `s_${'x'.repeat(32)}`);
localStorage.setItem('jump-account', JSON.stringify({ account, signedIn: !guest }));
// The fighter one level short (MASTERY_XP: level 5 at 450) before the set the results show.
localStorage.setItem('rift-survival-progress', JSON.stringify({ version: 1, shards: 0, earned: 0, mastery: { kenzo: 440, taisei: 95 }, aura: {}, codex: {}, places: [], challenges: [], unlocked: [], runs: 3, best: { round: 0, score: 0 } }));
localStorage.setItem('rift-modes-seen', JSON.stringify({ duel: 99 }));
localStorage.setItem('rift-mode-prefs', JSON.stringify({ duel: { variant: 'online', queue: 'ranked' } }));

const SEASON_END = Date.UTC(2027, 0, 4);
const board = { season: 1, ends: SEASON_END, mode: 'duel', top: [
  ['MIRAGE', 1488, 41, 33], ['NIGHTJAR', 1452, 37, 28], ['KESTREL', 1391, 52, 35], ['TOMOE', 1344, 29, 20], ['MARLIN', 1302, 33, 21],
  ['KITE', 1187, 14, 9], ['RUSTWING', 1176, 22, 13], ['HALCYON', 1150, 18, 11], ['FLINT', 1121, 26, 14], ['SABLE', 1096, 12, 7],
].map(([name, rating, games, wins], i) => ({ place: i + 1, name, rating, games, wins, tier: (rating as number) >= 1450 ? 'cover' : (rating as number) >= 1300 ? 'gilded' : (rating as number) >= 1150 ? 'toned' : 'inked', ...(name === 'KITE' ? { you: true } : {}) })) };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.endsWith('/ball/ranked')) return json({ season: 1, ends: SEASON_END, modes: { duel: { rating: 1187, games: 14, wins: 9, peak: 1210 } } });
  if (url.endsWith('/api/economy/ranked-board')) return json(board);
  if (url.endsWith('/api/economy/hello')) return json({ account, signedIn: !guest, sold: {}, config: {} });
  if (url.includes('/api/economy/')) return json({ error: 'lab' }, 404);
  return realFetch(input, init);
};

/* ---------- Then the game's own styles and modules ---------- */
await Promise.all([
  import('../src/ui/fonts.css'), import('../src/ui/style.css'), import('../src/ui/manga.css'), import('../src/ui/combat-hud.css'),
  import('../src/ui/approved-hud.css'), import('../src/ui/home.css'), import('../src/ui/survival.css'), import('../src/ui/hud/inked.css'),
  import('../src/ui/hud/protos/proto.css'), import('../src/ui/hud/protos/halo.css'), import('../src/ui/hud/protos/haloModes.css'),
]);
const { ModeSheet } = await import('../src/ui/modes/ModeSheet');
const { WaitingDock } = await import('../src/ui/modes/WaitingDock');
const { MatchIntro } = await import('../src/ui/MatchIntro');
const { matchResults } = await import('../src/ui/MatchResults');
const { ResultsShell } = await import('../src/ui/results/ResultsShell');
const { BallUI } = await import('../src/ui/ball/BallUI');
const { creditMatch } = await import('../src/survival/progressStore');
const { account: client } = await import('../src/ui/shop/account');
import type { GameSnapshot, PlayerState } from '../src/game/types';

const app = document.querySelector<HTMLElement>('#app')!;
const root = document.createElement('div'); root.id = 'interface'; app.append(root);
const player = (id: string, fighter: string, name: string, over: Partial<PlayerState> = {}) => ({ id, fighter, name, isBot: false, alive: true, hp: 100, maxHp: 100, kills: 0, damageDealt: 0, damageTaken: 0, x: 0, y: 0, z: 0, ...over }) as unknown as PlayerState;
const me = player('me', 'kenzo', 'KITE'), rival = player('rival', 'konta', 'RUSTWING');
document.body.dataset.screen = screen;

if (screen === 'sheet' || screen === 'guest') {
  await client.open().catch(() => undefined);
  const sheet = new ModeSheet({ root, fighter: () => 'kenzo', name: () => 'KITE', setName: () => {}, busy: () => false, start: () => {}, changeFighter: () => {} });
  sheet.show('duel', { variant: 'online' });
} else if (screen === 'queue' || screen === 'offer') {
  app.style.backgroundImage = "url('/assets/stages/previews/sunfall-arena.webp')";
  root.innerHTML = '<section class="combat-hud" aria-label="Combat status"></section>';
  const dock = new WaitingDock(root, () => {}, () => {});
  const ranked = { queue: 'ranked' as const, season: 1, seats: { me: { rating: 1187, games: 14 } }, rated: false };
  const snapshot = { roomMode: 'match', status: 'waiting', serverTime: 0, events: [], stage: 'sunfall-arena', winnerId: null, tick: 0, players: [me], ranked,
    lobby: { duel: true, visibility: 'public', hostId: null, canStart: false, startsAt: null, expiresAt: null } } as unknown as GameSnapshot;
  const frame = (now: number) => ({ snapshot, self: me, phase: 'waiting', input: 'keyboard', family: 'xbox', now }) as never;
  const t = performance.now();
  dock.frame(frame(t), 'duel'); dock.frame(frame(t + (screen === 'offer' ? 31_400 : 12_400)), 'duel');
} else if (screen === 'vs') {
  const intro = new MatchIntro(root);
  const snapshot = { roomMode: 'match', status: 'waiting', serverTime: 10, events: [], stage: 'sunfall-arena', winnerId: null, tick: 0, players: [me, rival],
    lobby: { duel: true, visibility: 'public', hostId: null, canStart: false, startsAt: 13.5, expiresAt: null },
    ranked: { queue: 'ranked', season: 1, seats: { me: { rating: 1187, games: 14 }, rival: { rating: 1176, games: 22 } }, rated: false } } as unknown as GameSnapshot;
  intro.update(snapshot, 'me', true);
} else {
  // The results: the match counted (the career's), its mastery paid into this browser's copy, the card drawn and filled.
  const hud = { modes: { layout: screen === 'ball' ? 'goal-rush' : screen === 'royale' ? 'royale' : 'duel', frame: undefined }, selected: 'kenzo', settingsOpen: false, onLeave() {}, onPractice() {} };
  // (The results holder first: ResultsShell watches the holders there as it is made, as Hud's page has them.)
  const panel = document.createElement('div'); panel.id = 'results'; panel.className = 'match-results hidden'; root.append(panel);
  new ResultsShell(root, hud as never);
  const won = screen !== 'placing';
  creditMatch({ id: `lab-${screen}`, mode: screen === 'ball' ? 'goal-rush' : screen === 'royale' ? 'bots' : 'duel', fighter: 'kenzo', outcome: won ? 'win' : 'loss', seconds: screen === 'royale' ? 312 : screen === 'ball' ? 365 : 401 });
  if (screen === 'ball') {
    const ball = new BallUI(root);
    const seat = (id: string, team: string, fighter: string, name: string, n: number) => ({ id, team, fighter, name, bot: id.startsWith('bot'), goals: n, assists: 1, saves: n % 2, shots: n + 2, points: 100 + n * 60, kills: 0, aces: 0, blocks: 0, digs: 0 });
    ball.update({ roomMode: 'match', status: 'finished', serverTime: 400, events: [], stage: 'sunfall-arena', winnerId: null, tick: 0, players: [me],
      ball: { mode: 'goal-rush', phase: 'over', access: 'quick', round: 1, winner: 'red', reason: 'Full time.', score: { red: 3, blue: 1 }, mvp: 'me',
        seats: [seat('me', 'red', 'kenzo', 'KITE', 2), seat('bot-1', 'red', 'taisei', 'Rival', 1), seat('bot-2', 'red', 'gummy', 'Prospect', 0), seat('bot-3', 'blue', 'konta', 'Upstart', 1), seat('bot-4', 'blue', 'shiden', 'Veteran', 0), seat('bot-5', 'blue', 'koko', 'Drifter', 0)] } } as unknown as GameSnapshot, 'me');
  } else {
    let snapshot: GameSnapshot, label = 'FIND RANKED DUEL';
    if (screen === 'royale') {
      label = 'PLAY AGAIN';
      const bots = ['taisei', 'konta', 'gummy', 'shiden', 'koko'].map((f, i) => player(`bot-${i}`, f, f, { isBot: true, kills: i % 2, alive: i === 0 }));
      snapshot = { roomMode: 'match', status: 'finished', serverTime: 320, events: [], stage: 'sunfall-arena', winnerId: 'bot-0', tick: 0, players: [{ ...me, kills: 3, damageDealt: 2400, damageTaken: 1500, alive: false }, ...bots] } as unknown as GameSnapshot;
    } else {
      const delta = won ? 21 : -27, before = won ? { rating: 1140, games: 14 } : { rating: 1010, games: 2 };
      snapshot = { roomMode: 'match', status: 'finished', serverTime: 420, events: [], stage: 'sunfall-arena', winnerId: won ? 'me' : 'rival', tick: 0, matchId: `lab-${screen}`,
        players: [{ ...me, kills: won ? 2 : 1, damageDealt: 3120, damageTaken: 1980 }, { ...rival, kills: won ? 1 : 2, damageDealt: 1980, damageTaken: 3120 }],
        lobby: { duel: true, visibility: 'public', hostId: null, canStart: false, startsAt: null, expiresAt: null },
        duel: { set: 1, round: 3, firstTo: 2, scores: won ? { me: 2, rival: 1 } : { me: 1, rival: 2 }, phase: 'complete', nextRoundAt: null, roundWinner: won ? 'me' : 'rival', winner: won ? 'me' : 'rival', runback: [], startedAt: 19 },
        ranked: { queue: 'ranked', season: 1, rated: true, seats: { me: { rating: before.rating + delta, games: before.games + 1, delta }, rival: { rating: 1176 - delta, games: 23, delta: -delta } } } } as unknown as GameSnapshot;
    }
    panel.innerHTML = matchResults(snapshot, snapshot.players[0], [], label);
    panel.classList.remove('hidden');
  }
}
