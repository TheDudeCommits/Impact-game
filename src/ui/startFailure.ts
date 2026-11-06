/** What a start that failed says to the player (the stability pass, 2 November 2026). The live log had 95 "start:
 *  TypeError: Failed to fetch": not the match server - network.ts turns a join that never reached it into plain words
 *  ("The servers are restarting...") - but one of the room's files (a fighter's model, a stage, a sound) that the
 *  connection dropped, and the player read the browser's own "Failed to fetch" under the menu. Each /assets/ download is
 *  now tried three times (loading/assetVersions.ts); one that still did not come says so in words, with RETRY.
 *
 *  A lazy chunk of the page that would not load and no newer build to reload onto (loading/staleBuild.ts) says the same,
 *  and its RETRY loads the page again: a browser keeps a module that failed to load failed until the page is reloaded. */
import { isChunkError } from '../loading/staleBuild';

/** (Its "try again" is what the mode sheet a start came from shows as it is, over its own button to start again:
 *  ui/modes/HomeShell.ts `failures`. Off the sheet, the home's RETRY stands under it.) */
export const HICCUP_MESSAGE = 'Connection hiccup: part of the match didn’t download. Check your connection and try again.';

/** The browsers' words for a request that never got an answer (Chrome's, Safari's, Firefox's, Node's), and three's for a
 *  file whose server failed (5xx). */
const NETWORK = /^Failed to fetch$|^Load failed$|NetworkError when attempting to fetch|^fetch failed$|^Network ?Error$|network connection was lost|ERR_(?:INTERNET_DISCONNECTED|NETWORK_CHANGED|CONNECTION_\w+|TIMED_OUT|HTTP2_\w+|QUIC_\w+)|responded with 5\d\d\b/i;

const words = (error: unknown) => error && typeof error === 'object' ? String((error as { message?: unknown }).message ?? '') : typeof error === 'string' ? error : '';

/** A download that failed on the way, not the code. */
export function isHiccup(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if (NETWORK.test(words(error).trim())) return true;
  const cause = (error as { cause?: unknown }).cause;
  return cause !== undefined && cause !== error && isHiccup(cause);
}

export interface StartFailure { message: string; retry?: 'start' | 'reload' }
/** The words for a failed start, and what its RETRY does (none: the error's own words are the player's to read - a
 *  refusal, a full room, a mistyped code). */
export function startFailure(error: unknown): StartFailure {
  if (isChunkError(error)) return { message: HICCUP_MESSAGE, retry: 'reload' };
  if (isHiccup(error)) return { message: HICCUP_MESSAGE, retry: 'start' };
  return { message: error instanceof Error ? error.message : String(error) };
}

/** The failure on the home (Hud.retryable, else Hud.error): `again` starts the same match again. A party's start has no
 *  RETRY - its seat is the leader's to send again. */
export function showStartFailure(hud: { error(message: string): void; retryable(message: string, retry: () => void): void }, error: unknown, again?: () => void, reload = () => location.reload()) {
  const failed = startFailure(error);
  if (failed.retry === 'reload') hud.retryable(failed.message, reload);
  else if (failed.retry === 'start' && again) hud.retryable(failed.message, again);
  else hud.error(failed.message);
}
