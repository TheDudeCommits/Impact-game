/** A Player Two join link (or a friend's Join beside "Playing Impact" there) opens the game in Player Two's player with
 *  its params (p2.params, boot/playerTwo.ts). They go into the address the way the game's own invite links carry them,
 *  before the home screen reads it - main.ts imports this before it builds anything, and waits for it - so the same
 *  room, party or mode sheet opens as from #room=, #party= or #mode=. Only where Player Two's SDK is in the page, and
 *  Player Two is waited for three seconds at most: params that arrive later still open the invite, by loading the page
 *  again with them in its address (not once a match has begun). */
import { joinHash, playerTwo } from './playerTwo';

const WAIT = 3000;
const write = (hash: string) => history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
if (typeof window === 'object' && (globalThis as { PlayerTwo?: unknown }).PlayerTwo && location.hash.length <= 1) {
  const loaded = performance.now(), found = playerTwo().then(p2 => joinHash(p2?.params));
  const hash = await Promise.race([found, new Promise<null>(done => setTimeout(() => done(null), WAIT))]);
  if (hash) write(hash);
  else if (hash === null) void found.then(late => {
    if (late && location.hash.length <= 1 && performance.now() - loaded < 60_000 && !document.querySelector('.combat-hud:not(.hidden)')) { write(late); location.reload(); }
  });
}
