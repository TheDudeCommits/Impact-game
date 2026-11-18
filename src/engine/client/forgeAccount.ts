import { account } from '../../ui/shop/account';
import { economyPost } from '../../network/p2Economy';
import type { FighterId } from '../../game/types';

export interface KeptFighter { hash: string; code: string; name: string; body: FighterId; at: number }

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  /* (to the economy world inside PlayerTwo once it is on, to the match server otherwise: src/network/p2Economy.ts) */
  const response = await economyPost(path, body, 6000);
  const json = (response.body && typeof response.body === 'object' ? response.body : {}) as { error?: string } & Record<string, unknown>;
  if (response.status < 200 || response.status >= 300) throw new Error(json.error ?? `The server answered ${response.status}.`);
  return json as T;
}
/** The account's token; a page with no account yet is asked to sign in, not told its account is unknown. */
const token = () => { const secret = account.secret(); if (!secret) throw new Error('Sign in first (PROFILE, in Account) to keep forged fighters.'); return secret; };

/** Keeps a kit on the signed-in account; answers what was kept. */
export const saveForged = async (code: string) => call<{ kept: KeptFighter }>('forge-save', { token: token(), code }).then(answer => answer.kept);
/** The account's kept fighters, newest first. */
export const keptForged = async () => call<{ kept: KeptFighter[] }>('forge-mine', { token: token() }).then(answer => answer.kept);
/** One kept fighter by its hash, anyone's (a share link). */
export const sharedForged = (hash: string) => call<{ kit: Omit<KeptFighter, never> }>('forge-get', { hash }).then(answer => answer.kit);
export const removeForged = async (hash: string) => call<{ kept: KeptFighter[] }>('forge-remove', { token: token(), hash }).then(answer => answer.kept);
/** A link that opens the Forge with this fighter loaded (same page, `?forge&kit=<hash>`). */
export const shareLink = (hash: string) => `${location.origin}${location.pathname}?forge&kit=${hash}`;
