import type { PrivyBridge, PrivyLogin } from './privy';
import { account as browserAccount, type AccountClient, type Store } from './account';
import { forgetProgressHere } from '../progress/sync';

/** What signing in and out work with (the browser's own, below; a test's stand-ins). */
export interface SignInDeps {
  account: Pick<AccountClient, 'wallet' | 'open' | 'signIn' | 'signOut' | 'deleteAccount'>;
  /** Privy's island for an app id, fetched and mounted the first time it is asked for. */
  privy: (appId: string) => Promise<PrivyBridge>;
  /** This tab's storage (the mark of a sign-in that went to a provider's page), and this browser's (its sign-out). */
  session: Store;
  local: Store;
  /** The page's address, and how it is replaced without a reload. */
  href: () => string;
  replace: (url: string) => void;
}

const MARK = 'jump-signin', OUT = 'jump-signed-out', OAUTH = ['privy_oauth_code', 'privy_oauth_state', 'privy_oauth_provider'];

/** Signing in and out, over `deps`. */
export function signInFlow(deps: SignInDeps) {
  const appId = () => deps.account.wallet.config.privy;
  /** Whether this browser signed out of the game, and has not signed in since. */
  const signedOut = () => !!deps.local.get(OUT);
  /** The account signed in with a login from Privy: this browser is signed in again. */
  async function adopt(login: PrivyLogin) { await deps.account.signIn(login.token, login.shown); deps.local.set(OUT, undefined); }
  /** Privy's return parameters out of the address bar. */
  function clean() {
    const url = new URL(deps.href()), keys = [...url.searchParams.keys()].filter(key => key.startsWith('privy_'));
    if (!keys.length) return;
    for (const key of keys) url.searchParams.delete(key);
    deps.replace(`${url.pathname}${url.search}${url.hash}`);
  }

  return {
    signedOut,
    /** SIGN IN pressed: Privy's modal, then this device opens the login's account. Rejects with the reason ('cancelled'
     *  if closed). After a sign-out in this browser the modal always asks: a leftover Privy session is not reused. */
    async signIn() {
      const id = appId();
      if (!id) throw new Error('Sign-in is not set up yet.');
      // (Google, X and Discord take this tab to their own page: the mark lets its return finish the sign-in.)
      deps.session.set(MARK, String(Date.now()));
      await adopt(await (await deps.privy(id)).login({ fresh: signedOut() }));
      deps.session.set(MARK, undefined);
    },
    /** SIGN OUT: the game's session ends on this device and a guest takes it over (at once, whatever Privy does), then
     *  Privy's session is ended in the background. */
    async signOut() {
      const id = appId();
      deps.local.set(OUT, String(Date.now()));
      await deps.account.signOut();
      if (id) void deps.privy(id).then(bridge => bridge.logout()).catch(() => undefined);
    },
    /** DELETE ACCOUNT (8 October 2026): the server deletes the account and this browser becomes a fresh guest (at once,
     *  whatever Privy does); then, if it was signed in, Privy's session is ended in the background as at a sign-out, and
     *  the next SIGN IN asks afresh. A guest's deletion never fetches Privy's island. */
    async deleteAccount() {
      const id = appId(), was = !!deps.account.wallet.signedIn;
      await deps.account.deleteAccount();
      // (Arcade progress and the career are the account's too: this browser's copy goes with it. src/ui/progress/sync.ts)
      forgetProgressHere();
      if (!was) return;
      deps.local.set(OUT, String(Date.now()));
      if (id) void deps.privy(id).then(bridge => bridge.logout()).catch(() => undefined);
    },
    /** Privy's identity token for this browser's login (Privy's modal first if it has none), for a code bound to one
     *  login's email. Null if Privy gives none: identity tokens are off in the Privy app's dashboard. */
    async identity(): Promise<string | null> {
      const id = appId();
      if (!id) throw new Error('Sign-in is not set up yet.');
      return (await (await deps.privy(id)).identity()).token;
    },
    /** On load: a page that has just come back from a provider finishes the sign-in it started. Resolves true if it did. */
    async finishSignIn(): Promise<boolean> {
      const query = new URL(deps.href()).searchParams;
      if (!OAUTH.some(key => query.has(key))) return false;
      const at = Number(deps.session.get(MARK) ?? 0);
      deps.session.set(MARK, undefined);
      try {
        if (!at || Date.now() - at > 30 * 60000 || !OAUTH.every(key => query.has(key))) return false;
        await deps.account.open();
        const id = appId();
        if (!id) return false;
        await adopt(await (await deps.privy(id)).resume());
        return true;
      } finally { clean(); }
    },
  };
}

// ---- in the browser ------------------------------------------------------------------------------
let chunk: Promise<typeof import('./privy')> | null = null;
let bridge: Promise<PrivyBridge> | null = null;
const privyModule = () => (chunk ??= import('./privy').catch(error => { chunk = null; throw error; }));
/** Privy's island: its chunk fetched and mounted once (and again after a failure), given twenty seconds to be ready. */
function load(appId: string): Promise<PrivyBridge> {
  bridge ??= privyModule().then(module => Promise.race([module.mount(appId),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Sign-in did not load. Check your connection and try again.')), 20000))]))
    .catch(error => { bridge = null; throw error; });
  return bridge;
}
/** A browser storage, read and written without throwing (private browsing: what it would keep lasts the visit). */
const storage = (which: () => globalThis.Storage): Store => ({
  get: key => { try { return which().getItem(key) ?? undefined; } catch { return undefined; } },
  set: (key, value) => { try { if (value === undefined) which().removeItem(key); else which().setItem(key, value); } catch { /* Kept for the visit only. */ } },
});

const flow = signInFlow({
  account: browserAccount, privy: load,
  session: storage(() => sessionStorage), local: storage(() => localStorage),
  href: () => location.href, replace: url => history.replaceState(history.state, '', url),
});
export const signIn = flow.signIn;
export const signOut = flow.signOut;
export const finishSignIn = flow.finishSignIn;
export const identity = flow.identity;
export const deleteAccount = flow.deleteAccount;
