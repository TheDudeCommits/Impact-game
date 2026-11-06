import { createElement, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider, getIdentityToken, useLogin, usePrivy, type User } from '@privy-io/react-auth';
import { maskEmail } from './account';
import { TITLE } from '../../originals/brand';

/** `shown`: how the login reads on this screen, after "Signed in" - "as a•••@g•••.com", "with Google". */
export interface PrivyLogin { token: string; shown?: string }
export interface PrivyBridge {
  /** Privy's modal (or, unless `fresh`, a Privy session this browser still has): the token, and how it reads. `fresh`: this
   *  browser signed out of the game, so a Privy session still left in it is ended first and the modal always asks. */
  login(options?: { fresh?: boolean }): Promise<PrivyLogin>;
  /** Back from a provider's page: Privy finishes the sign-in on its own; the token once it has. */
  resume(): Promise<PrivyLogin>;
  logout(): Promise<void>;
  /** Privy's identity token for the login signed in here (after Privy's modal, if none is): the login's verified
   *  emails, signed by Privy, for a code bound to one (the server checks it). Null when Privy issues none: identity
   *  tokens are switched off in the app's dashboard. */
  identity(): Promise<{ token: string | null }>;
}

/** How a login reads on screen, masked (streamers show their screens): an email login's address as a•••@g•••.com, a
 *  social one by its provider's name. */
function shownOf(user: User | null | undefined): string | undefined {
  if (!user) return undefined;
  return user.email?.address ? `as ${maskEmail(user.email.address)}` : user.google ? 'with Google' : user.twitter ? 'with X' : user.discord ? 'with Discord' : undefined;
}

type Pending = { resolve: (login: PrivyLogin) => void; reject: (error: Error) => void };
/** Until `done()` holds (polled), or `ms` pass: whether it held. */
const until = (done: () => boolean, ms: number) => new Promise<boolean>(settle => {
  const began = performance.now(), look = () => done() ? settle(true) : performance.now() - began > ms ? settle(false) : setTimeout(look, 50);
  look();
});

export function mount(appId: string): Promise<PrivyBridge> {
  return new Promise(ready => {
    const host = document.createElement('div');
    host.id = 'privy-root';
    document.body.append(host);
    let pending: Pending | null = null;
    const live: { login?: () => void; logout?: () => Promise<void>; token?: () => Promise<string | null>; user?: User | null; authenticated?: boolean } = {};
    const finish = (job: Pending, token: string | null, user: User | null | undefined) => token ? job.resolve({ token, shown: shownOf(user) }) : job.reject(new Error('Privy gave no sign-in token.'));

    function Bridge() {
      const privy = usePrivy();
      const done = useRef(false);
      const { login } = useLogin({
        onComplete: ({ user }) => { const job = pending; pending = null; if (job) privy.getAccessToken().then(token => finish(job, token, user), (error: Error) => job.reject(error)); },
        onError: code => { const job = pending; pending = null; job?.reject(new Error(code === 'exited_auth_flow' ? 'cancelled' : String(code))); },
      });
      Object.assign(live, { login, logout: privy.logout, token: privy.getAccessToken, user: privy.user, authenticated: privy.authenticated });
      useEffect(() => {
        if (!privy.ready || done.current) return;
        done.current = true;
        ready({
          login: (options = {}) => new Promise((resolve, reject) => {
            const job: Pending = { resolve, reject }, open = () => { pending = job; live.login!(); };
            if (live.authenticated && live.user) {
              // Signed out of the game in this browser: Privy's session is ended first. (Privy's own login does nothing
              // while a user is still set - it only warns - so the modal is opened once the logout has gone through.)
              if (options.fresh) {
                // (Privy's logout waits up to fifteen seconds on its wallet frame: it is given twenty, and the state five more to follow.)
                void Promise.race([Promise.resolve().then(() => live.logout!()), new Promise(done => setTimeout(done, 20000))]).catch(() => undefined)
                  .then(() => until(() => !live.authenticated && !live.user, 5000))
                  .then(out => out ? open() : reject(new Error('Sign-in is still ending the last session. Try again in a moment.')));
                return;
              }
              // Still signed in with Privy in this browser: no modal needed.
              live.token!().then(token => { if (token) finish(job, token, live.user); else open(); }, reject);
              return;
            }
            open();
          }),
          resume: () => new Promise((resolve, reject) => {
            const job: Pending = { resolve, reject };
            const take = () => live.token!().then(token => finish(job, token, live.user), reject);
            if (live.authenticated && live.user) { void take(); return; }
            // Still checking the provider's answer (or showing its own retry): take the login when it lands.
            pending = job;
            const began = performance.now();
            const poll = () => {
              if (pending !== job) return;
              if (live.authenticated && live.user) { pending = null; void take(); }
              else if (performance.now() - began > 15000) { pending = null; reject(new Error('cancelled')); }
              else setTimeout(poll, 120);
            };
            poll();
          }),
          logout: () => live.authenticated ? live.logout!() : Promise.resolve(),
          identity: () => new Promise((resolve, reject) => {
            // (getIdentityToken asks Privy for the login again, so the token is fresh, and null if the app issues none.)
            const take = () => getIdentityToken().then(token => resolve({ token }), reject);
            if (live.authenticated && live.user) { void take(); return; }
            // No Privy session left in this browser: its modal first, then the token.
            pending = { resolve: () => void take(), reject }; live.login!();
          }),
        });
      }, [privy.ready]);
      return null;
    }

    createRoot(host).render(createElement(PrivyProvider, {
      appId,
      config: {
        loginMethods: ['email', 'google', 'twitter', 'discord'],
        appearance: { theme: 'light', accentColor: '#cc202b', logo: `${location.origin}/assets/survival/intro/sign-in.png`, landingHeader: `Sign in to ${TITLE}`, loginMessage: 'Keep your Sumi and everything you have unlocked on every device.' },
        embeddedWallets: { ethereum: { createOnLogin: 'off' }, solana: { createOnLogin: 'off' } },
      },
      children: createElement(Bridge),
    }));
  });
}
