import './accountPanel.css';
import { openPage } from '../pageViewer';
import { PRIVACY_PAGE } from '../legalLinks';
import { CURRENCY, EARNED_LINE } from '../../game/economy/currency';
import { ITEM, ITEMS } from '../../game/economy/catalog';
import { PAY, levelOf } from '../../game/economy/earn';
import { FEATS } from '../../game/economy/feats';
import { turnover } from '../../game/economy/front';
import { ALL_DAILY_BONUS, dailyChallenge, dailyMissions, weeklyChallenge, weeklyMissions, type Mission } from '../../game/economy/missions';
import { owns, type Account } from '../../game/economy/account';
import { HELD, LOCKED } from '../../game/economy/fighters';
import { RELEASED_FIGHTERS } from '../../game/rosterAvailability';
import { NAME_EVERY_DAYS, NAME_MAX, nameFreeAt, nameProblem } from '../../game/economy/names';
import { Refused, type AccountClient, type Redeemed, type Wallet } from './account';
import { roadNext } from './goal';

/** What the panel asks of the shop it sits in. */
export interface AccountPanelHost {
  /** Something asked of the server: one at a time (the shop is busy meanwhile), its refusal said in its own words, then drawn again. */
  attempt(work: () => Promise<void>): Promise<void>;
  /** A line in the shop's status bar. */
  say(text: string): void;
  /** Ask the server for the account again (TRY AGAIN, when it could not be reached). */
  retry(): void;
}

const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const thousands = (n: number) => Math.floor(n).toLocaleString('en-US');
const COIN = `<b class="shop-coin" aria-hidden="true">${CURRENCY.mark}</b>`;
const plural = (n: number, one: string, many = `${one}s`) => `${thousands(n)} ${n === 1 ? one : many}`;
const RANK_LETTERS = 'FEDCBAS', STYLE_LETTERS = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
/** The fighters to unlock: an account owns some of them, or (all access) all of them; the rest of the roster is everyone's. */
const FIGHTERS_OUT = ITEMS.filter(item => item.kind === 'fighter' && item.stage === 'live');
const EVERYONES = RELEASED_FIGHTERS.filter(fighter => !LOCKED.has(fighter) && !HELD.has(fighter)).length;
/** Time left, as a countdown reads it: 3D 4H, 5H 12M, 12M 30S. */
export const clock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
  return d ? `${d}D ${h}H` : h ? `${h}H ${String(m).padStart(2, '0')}M` : `${m}M ${String(s % 60).padStart(2, '0')}S`; };
/** A date as the tab says it: 7 November 2026. */
const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
/** What a code unlocked, said in a line: its own words, and what it gave. */
export function unlockedLine(got: Redeemed): string {
  const parts = [...got.items.map(id => ITEM.get(id)?.name ?? id), ...(got.sumi ? [`${thousands(got.sumi)} ${CURRENCY.name}`] : [])];
  return parts.length ? `${got.says} (${parts.join(', ')})` : got.says;
}

/** The account as the home screen's chip names it: the username, if there is one (the chip's level, title and wallet
 *  follow it: Shop.ts homeChip). No spans: the heading the chip sits in styles every span as its own rule. */
export function chipName(account: Account | undefined): string {
  return account?.name ? `<i class="shop-chip-name">${escape(account.name)}</i>` : '';
}

export class AccountPanel {
  /** SIGN IN, SIGN OUT and DELETE ACCOUNT, and Privy's identity token for a code bound to an email (src/ui/shop/signin.ts,
   *  set by boot.ts). */
  signIn?: () => Promise<void>;
  signOut?: () => Promise<void>;
  deleteAccount?: () => Promise<void>;
  identity?: () => Promise<string | null>;
  /** Whether the game is in Player Two's player (boot/playerTwo.ts): signed in with Player Two there, so no Privy. */
  playerTwo?: () => boolean;
  /** DELETE ACCOUNT pressed once: the tab asks whether to, in its own words (never the browser's confirm()). */
  private deleting = false;
  /** What the last code redeemed here unlocked, shown under its field (until a sign-out, or the page is left). */
  private redeemed?: Redeemed;
  /** Fields to empty at the next drawing (what they held went through). */
  private readonly emptied = new Set<string>();

  constructor(private readonly client: Pick<AccountClient, 'account' | 'redeem' | 'claimName' | 'login'>, private readonly host: AccountPanelHost) {}

  /** The tab drawn into the shop's body. What is typed in its fields, and where the caret is, outlive a drawing.
   *  `unreachable`: the server did not answer, and there is no account from before to show. */
  render(body: HTMLElement, wallet: Wallet, unreachable = false) {
    const fields = ['acct-name', 'acct-code'].map(id => body.querySelector<HTMLInputElement>(`#${id}`)).filter((field): field is HTMLInputElement => !!field);
    const kept = fields.map(field => ({ id: field.id, value: field.value, focus: document.activeElement === field, from: field.selectionStart, to: field.selectionEnd }));
    body.innerHTML = this.html(wallet, unreachable);
    for (const was of kept) {
      const field = body.querySelector<HTMLInputElement>(`#${was.id}`);
      if (!field || field.disabled) continue;
      if (!this.emptied.has(was.id)) field.value = was.value;
      if (was.focus) { field.focus({ preventScroll: true }); if (!this.emptied.has(was.id)) field.setSelectionRange(was.from, was.to); }
    }
    this.emptied.clear();
    for (const form of body.querySelectorAll<HTMLFormElement>('form[data-form]')) form.addEventListener('submit', event => { event.preventDefault(); this.submit(form); });
  }
  html(wallet: Wallet, unreachable = false): string {
    const account = wallet.account, privy = wallet.config.privy;
    // (Until 30 October 2026 a server that never answered left "Opening your account…" here for good.)
    if (!account) return unreachable ? `<section class="acct-card acct-offline" role="status"><h3><span>CAN'T REACH THE SERVER</span></h3>
      <p class="shop-note">Your account can't be shown right now. Nothing is lost: it is kept on the server. Training, Arcade and Bot Duel still play on this device.</p>
      <button type="button" class="shop-act" data-act="retry">TRY AGAIN</button></section>` : `<p class="shop-empty">Opening your account…</p>`;
    const stats = account.stats, signedIn = !!wallet.signedIn, shown = this.client.login;
    const cells: [string, string][] = [['MATCHES', thousands(stats.matches)], ['WINS', thousands(stats.wins)], ['RUNS', thousands(stats.runs)], ['ROUNDS CLEARED', thousands(stats.rounds)], ['BOSSES BEATEN', thousands(stats.bosses)],
      ['FINISHERS', thousands(stats.finishers)], ['HORDE CUT DOWN', thousands(stats.kills)], ['RIFTS SEALED', thousands(stats.seals)], ['BEST RANK', stats.runs ? RANK_LETTERS[stats.bestRank] : '–'], ['BEST STYLE', stats.runs ? STYLE_LETTERS[stats.bestStyle] : '–'], ['BEST STREAK', `${stats.bestStreak} D`]];
    const all = account.allAccess ? '<p class="acct-all" title="Every fighter in the game is yours, and every one added from now on.">ALL ACCESS · NOW AND TO COME</p>' : '';
    // (In Player Two's player the game signs in with Player Two by itself, and Privy can't open in its frame.)
    const p2 = this.playerTwo?.() ?? false;
    const who = signedIn
      ? `<h3>${escape(account.name ?? 'SIGNED IN')}</h3>${all}<p>Signed in${shown ? ` ${escape(shown)}` : ''}. Your ${CURRENCY.name} and your fighters are kept with this login, on any device you sign in on.</p>${p2 ? '' : '<button type="button" class="shop-act off" data-act="signout">SIGN OUT</button>'}`
      : p2 ? `<h3>GUEST</h3>${all}<p>This account lives in this browser only: clear its data and it is gone. Sign in to Player Two to keep it, and to carry it to your other devices.</p>`
      : `<h3>GUEST</h3>${all}<p>This account lives in this browser only: clear its data and it is gone. ${privy ? 'Sign in to keep it, and to carry it to your other devices.' : 'Signing in, to keep it and carry it to your other devices, is coming.'}</p>${privy ? '<button type="button" class="shop-act" data-act="signin">SIGN IN</button>' : '<button type="button" class="shop-act" disabled>SIGN IN · SOON</button>'}
        <p class="acct-fine">Sign-in is by email, Google, X or Discord, through Privy. <button type="button" class="acct-link" data-act="privacy">PRIVACY</button></p>`;
    return `<div class="shop-account">
      <div class="acct-col">
        <section class="shop-who">${who}<small>ACCOUNT ${escape(account.pk)}</small></section>
        ${this.nameCard(account, signedIn)}
        ${this.codeCard(signedIn)}
        ${this.dataCard(signedIn)}
      </div>
      <div class="acct-main">
        ${this.progress(account)}
        ${this.missions(account, Date.now())}
        ${this.feats(account)}
        <section class="shop-stats"><h3><span>THE RECORD</span></h3><dl>${cells.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></section>
      </div>
    </div>`;
  }

  /** The level and the fighter it frees next, and the Sumi: what it is now, earned, spent, and the fighters unlocked. */
  private progress(account: Account): string {
    const level = levelOf(account.xp), next = roadNext(account), owned = FIGHTERS_OUT.filter(item => owns(account, item.id)).length;
    return `<section class="acct-progress" aria-label="Your level and ${CURRENCY.name}">
      <div class="acct-level">
        <b class="acct-level-n"><small>LEVEL</small>${level.level}</b>
        <div><strong>${level.max ? 'MAX' : `${thousands(level.into)} / ${thousands(level.span)} XP`}</strong><i><u style="width:${level.max ? 100 : Math.round(level.into / level.span * 100)}%"></u></i>
          <small>${next ? `<em>NEXT · ${escape(next.item.name.toUpperCase())} FREE AT LEVEL ${next.level}</em> · about ${plural(next.matches, 'match', 'matches')} away` : 'Every fighter a level frees is yours.'}</small></div>
      </div>
      <dl><div><dt>${CURRENCY.name.toUpperCase()} NOW</dt><dd>${COIN}${thousands(account.balance)}</dd></div><div><dt>EARNED BY PLAYING</dt><dd>${COIN}${thousands(account.earned)}</dd></div><div><dt>SPENT</dt><dd>${COIN}${thousands(account.spent)}</dd></div>
        <div><dt>FIGHTERS YOURS</dt><dd>${EVERYONES + owned} OF ${EVERYONES + FIGHTERS_OUT.length}</dd></div></dl>
      <p class="shop-note"><b>${EARNED_LINE}</b> Every run and match earns it, and experience; the missions and feats earn more.</p></section>`;
  }

  /** The day's and the week's missions, each with its challenge (a mode's or a friend's, missions.ts), and the days in a row. */
  private missions(account: Account, now: number): string {
    const row = (mission: Mission, book: { progress: Record<string, number>; done: string[] }, challenge = false) => {
      const done = book.done.includes(mission.id), at = done ? mission.goal : Math.min(mission.goal, Math.floor(book.progress[mission.id] ?? 0));
      return `<li class="${done ? 'done' : ''}${challenge ? ' challenge' : ''}"><span>${challenge ? '<small>CHALLENGE</small>' : ''}${escape(mission.text)}</span><i><u style="width:${Math.round(at / mission.goal * 100)}%"></u></i><em>${done ? 'DONE' : `${thousands(at)} / ${thousands(mission.goal)}`}</em><b>${COIN}${mission.pay}</b></li>`;
    };
    const left = turnover(now), streak = account.streak.days, next = PAY.streak[streak % PAY.streak.length];
    return `<section class="shop-missions">
      <div><h3><span>TODAY</span><small>NEW IN <b data-until="day">${clock(left.day)}</b></small></h3><ul class="shop-mission-list">${dailyMissions(account.day.date).map(mission => row(mission, account.day)).join('')}${row(dailyChallenge(account.day.date), account.day, true)}</ul>
        <p class="shop-note${account.day.all ? ' done' : ''}">All three: +${COIN}${ALL_DAILY_BONUS}${account.day.all ? ' · DONE' : ''}. Every mode that earns ${CURRENCY.name} counts. The challenge is one more, not one of the three.</p></div>
      <div><h3><span>THIS WEEK</span><small>NEW IN <b data-until="week">${clock(left.week)}</b></small></h3><ul class="shop-mission-list">${weeklyMissions(account.week.id).map(mission => row(mission, account.week)).join('')}${row(weeklyChallenge(account.week.id), account.week, true)}</ul></div>
      <div class="shop-day"><h3><span>EVERY DAY</span><small>${streak ? `DAY ${streak} RUNNING` : 'A DAY AT A TIME'}</small></h3>
        <div class="shop-streak" aria-label="Days in a row">${PAY.streak.map((pay, i) => `<span class="${streak && i < ((streak - 1) % PAY.streak.length) + 1 ? 'had' : ''}"><small>DAY ${i + 1}</small>${COIN}${pay}</span>`).join('')}</div>
        <p class="shop-note">The first match of a day earns ${COIN}${PAY.firstOfDay}${streak ? `, and tomorrow's ${COIN}${next} more` : ', and more each day in a row'}. Matches earn in full up to ${PAY.dailyCap} a day; past it, online matches earn a fifth and matches on this device nothing more. Missions and feats always earn. Matches with bots, and in a private room alone, earn half; solo runs in full; with a friend (a private room, a party or the couch) in full, and +${COIN}${PAY.friend}. Training earns nothing.</p></div>
    </section>`;
  }

  /** The feats: each earns once (in Player Two's player, each is a trophy there too). */
  private feats(account: Account): string {
    const feats = [...FEATS].sort((a, b) => Number(account.feats.includes(a.id)) - Number(account.feats.includes(b.id)));
    return `<section class="shop-feats"><h3><span>FEATS</span><small>${account.feats.length} OF ${FEATS.length} · each earns once</small></h3><ul>${feats.map(feat => `<li class="${account.feats.includes(feat.id) ? 'done' : ''}"><b>${escape(feat.name)}</b><span>${escape(feat.text)}</span><em>${account.feats.includes(feat.id) ? 'DONE' : `${COIN}${feat.pay}`}</em></li>`).join('')}</ul></section>`;
  }

  /** USERNAME: claimed by a signed-in account, unique, changed once a month at most. */
  private nameCard(account: Account, signedIn: boolean): string {
    if (!signedIn) return `<section class="acct-card"><h3><span>USERNAME</span></h3><p class="shop-note">Sign in to claim a username.</p></section>`;
    const freeAt = nameFreeAt(account), waits = freeAt > Date.now(), has = !!account.name;
    const note = waits ? `You can change it again on ${day(freeAt)}. A username can change once every ${NAME_EVERY_DAYS} days.`
      : `Letters, digits and _, ${NAME_MAX} at most; no one else can take it. ${has ? 'Changing it' : 'Claiming it'} starts a ${NAME_EVERY_DAYS}-day wait before the next change.`;
    return `<section class="acct-card"><h3><span>USERNAME</span></h3>
      <form class="acct-form" data-form="name" novalidate>
        <label for="acct-name">${has ? `YOURS: ${escape(account.name!)}` : 'CHOOSE ONE'}</label>
        <div class="acct-row"><input id="acct-name" name="name" maxlength="${NAME_MAX}" placeholder="${has ? 'A new username' : 'Your username'}" autocomplete="off" autocapitalize="off" spellcheck="false"${waits ? ' disabled' : ''}><button type="submit" class="shop-act" data-act="name"${waits ? ' disabled' : ''}>${has ? 'CHANGE' : 'CLAIM'}</button></div>
        <p class="shop-note">${note}</p>
      </form></section>`;
  }

  /** REDEEM A CODE: a signed-in account's, and what the last one unlocked. */
  private codeCard(signedIn: boolean): string {
    return `<section class="acct-card"><h3><span>REDEEM A CODE</span></h3>
      <form class="acct-form" data-form="code" novalidate>
        <label for="acct-code">YOUR CODE</label>
        <div class="acct-row"><input id="acct-code" name="code" maxlength="64" placeholder="Type a code" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="submit" class="shop-act" data-act="redeem">REDEEM</button></div>
        ${this.redeemed ? `<p class="acct-done" role="status">${escape(unlockedLine(this.redeemed))}</p>` : (signedIn ? '<p class="shop-note">A code unlocks things for this account. Each code works once per account.</p>' : '<p class="shop-note">Most codes need you signed in: what they unlock is kept with your login.</p>')}
      </form></section>`;
  }

  /** YOUR DATA: the privacy page, and DELETE ACCOUNT - asked twice, the second time in plain words. KEEP MY ACCOUNT
   *  answers to the same act as DELETE ACCOUNT, so the shop's focus (which follows the act pressed) lands on it, and a
   *  press made twice by mistake asks and then takes the question back. */
  private dataCard(signedIn: boolean): string {
    if (!this.deleting) return `<section class="acct-card acct-data"><h3><span>YOUR DATA</span></h3>
      <p class="shop-note">What the game keeps, and why: <button type="button" class="acct-link" data-act="privacy">THE PRIVACY PAGE</button></p>
      <button type="button" class="acct-delete" data-act="delete">DELETE ACCOUNT</button></section>`;
    return `<section class="acct-card acct-data is-asking" role="alertdialog" aria-labelledby="acct-delete-title" aria-describedby="acct-delete-text"><h3><span id="acct-delete-title">DELETE THIS ACCOUNT?</span></h3>
      <p class="shop-note" id="acct-delete-text">Your ${CURRENCY.name}, items, username and record are erased from the server${signedIn ? ', your login is let go, and this browser is signed out' : ', and this browser starts again as a new guest'}. <b>This cannot be undone.</b></p>
      <div class="acct-row"><button type="button" class="shop-act off" data-act="delete">KEEP MY ACCOUNT</button><button type="button" class="shop-act acct-delete-yes" data-act="delete-yes">DELETE FOR GOOD</button></div></section>`;
  }

  /** A press inside the tab: true if it was one of the panel's own (a form's button submits the form). */
  click(button: HTMLElement): boolean {
    const act = button.dataset.act;
    if (act === 'signin') {
      void this.host.attempt(async () => {
        this.host.say('Opening sign-in…');
        await this.signIn?.();
        const shown = this.client.login;
        this.host.say(shown ? `Signed in ${shown}.` : 'Signed in.');
      });
      return true;
    }
    if (act === 'signout') {
      void this.host.attempt(async () => {
        this.host.say('Signing out…');
        await this.signOut?.();
        this.redeemed = undefined;
        this.host.say('Signed out. This device plays as a guest now.');
      });
      return true;
    }
    if (act === 'retry') { this.host.retry(); return true; }
    if (act === 'privacy') { openPage(PRIVACY_PAGE, 'PRIVACY'); return true; }
    if (act === 'delete') {
      // (Nothing is asked of the server: the shop draws the tab again, asking or not.)
      void this.host.attempt(async () => { this.deleting = !this.deleting; this.host.say(this.deleting ? 'Deleting an account cannot be undone.' : ''); });
      return true;
    }
    if (act === 'delete-yes') {
      void this.host.attempt(async () => {
        this.host.say('Deleting your account…');
        try { await this.deleteAccount?.(); } finally { this.deleting = false; }
        this.redeemed = undefined;
        this.host.say('Your account is deleted. This browser plays as a new guest now.');
      });
      return true;
    }
    return act === 'name' || act === 'redeem';
  }

  private submit(form: HTMLFormElement) {
    const field = form.querySelector<HTMLInputElement>('input'), value = field?.value.trim() ?? '';
    if (form.dataset.form === 'name') {
      const problem = nameProblem(value);
      if (problem) { this.host.say(problem); field?.focus(); return; }
      void this.host.attempt(async () => {
        await this.client.claimName(value);
        this.emptied.add('acct-name');
        this.host.say(`Your username is ${this.client.account?.name ?? value}.`);
      });
    } else if (form.dataset.form === 'code') {
      if (!value) { this.host.say('Type a code first.'); field?.focus(); return; }
      void this.host.attempt(async () => {
        this.host.say('Checking the code…');
        let got: Redeemed;
        try { got = await this.client.redeem(value); }
        catch (error) {
          // A code bound to one login's email: Privy's identity token says which emails this login has verified.
          if (!(error instanceof Refused) || error.need !== 'identity') throw error;
          this.host.say('Confirming your sign-in with Privy…');
          const identity = await this.identity?.();
          if (!identity) throw new Refused('Privy did not confirm your email to the game, so this code cannot check it. (Privy\'s app needs identity tokens switched on.)');
          got = await this.client.redeem(value, identity);
        }
        this.redeemed = got;
        this.emptied.add('acct-code');
        this.host.say(unlockedLine(got));
      });
    }
  }
}
