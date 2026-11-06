import './shop.css';
import type { UiAction } from '../../input/gamepad';
import { stepRound } from '../padNav';
import type { FighterId } from '../../game/types';
import { FIGHTERS } from '../../config';
import { RELEASED_FIGHTERS, isReleasedFighter } from '../../game/rosterAvailability';
import { CURRENCY, EARNED_LINE, money } from '../../game/economy/currency';
import { ITEM, type Item } from '../../game/economy/catalog';
import { turnover } from '../../game/economy/front';
import { RARITY } from '../../game/economy/rarity';
import { levelOf } from '../../game/economy/earn';
import { cannotBuy, owns, type Account } from '../../game/economy/account';
import { HELD, LOCKED } from '../../game/economy/fighters';
import { roadLevel } from '../../game/economy/unlocks';
import { Refused, type AccountClient, type Wallet } from './account';
import { fighterArt } from './art';
import { AccountPanel, clock } from './accountPanel';
import { goalOf, roadNext, savingFor, setGoal } from './goal';

type Tab = 'unlocks' | 'profile';
const TABS: readonly [Tab, string][] = [['unlocks', 'UNLOCKS'], ['profile', 'PROFILE']];
/** Which fighters UNLOCKS lists: all of them (those to unlock first), or one side. */
type Filter = 'all' | 'locked' | 'yours';
const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const thousands = (n: number) => Math.floor(n).toLocaleString('en-US');
const COIN = `<b class="shop-coin" aria-hidden="true">${CURRENCY.mark}</b>`;
/** A number where the display face would be set (a button's label): its numerals are drawn to look like kana. */
const num = (text: string) => `<b class="shop-n">${text}</b>`;
const plural = (n: number, one: string, many = `${one}s`) => `${thousands(n)} ${n === 1 ? one : many}`;

interface Entry { fighter: FighterId; item?: Item }
const ENTRIES: readonly Entry[] = [
  ...RELEASED_FIGHTERS.filter(fighter => !LOCKED.has(fighter) && !HELD.has(fighter)).map(fighter => ({ fighter })),
  ...[...LOCKED].filter(([fighter]) => isReleasedFighter(fighter)).map(([fighter, id]) => ({ fighter, item: ITEM.get(id)! })),
];
const ENTRY = new Map(ENTRIES.map(entry => [entry.fighter, entry] as const));
const nameOf = (entry: Entry) => entry.item?.name ?? FIGHTERS[entry.fighter].name;

/** Sumi given back when prices dropped (refunds.ts), as the account says, and what this browser has already said of it. */
const refundTotal = (account: Account | undefined) => Object.values((account as { refunded?: Record<string, number> } | undefined)?.refunded ?? {}).reduce((sum, n) => sum + n, 0);
const SEEN = 'jump-shop-refund-seen';

/** What draws the fighter picked, in the detail panel (src/ui/shop/preview.ts, when it is there). */
export interface ShopStage {
  show(host: HTMLElement, fighter: FighterId): void;
  hide(): void;
}

export class Shop {
  readonly root: HTMLElement;
  private tab: Tab = 'unlocks';
  /** The countdowns, ticking while it is open. */
  private tick = 0;
  /** The fighter looked at in UNLOCKS, and which fighters it lists. */
  private picked?: FighterId;
  private filter: Filter = 'all';
  /** The fighter whose UNLOCK has been pressed once (a second press unlocks). */
  private confirming?: FighterId;
  private confirmTimer = 0;
  private busy = false;
  private wallet: Wallet;
  /** Where each tab was scrolled to, kept across a redraw. */
  private scrolled: Partial<Record<Tab, number>> = {};
  /** The server did not answer the last time the account was asked for. */
  private unreachable = false;
  stage?: ShopStage;
  onOpen = () => {};
  onClose = () => {};
  /** A fighter chosen to play (theirs), or to try in the Training Ground (anyone's). */
  onPlay?: (fighter: FighterId, training: boolean) => void;
  /** The PROFILE tab, a file of its own (accountPanel.ts): drawn in the body, and given the presses made in it. */
  readonly accountTab: AccountPanel;

  constructor(private readonly host: HTMLElement, private readonly client: AccountClient) {
    this.wallet = client.wallet;
    this.accountTab = new AccountPanel(client, { attempt: work => this.attempt(work), say: text => this.say(text), retry: () => this.connect() });
    this.root = document.createElement('section');
    this.root.className = 'shop hidden'; this.root.id = 'shop'; this.root.setAttribute('aria-label', 'Account');
    this.root.innerHTML = `
      <header class="shop-head">
        <h2 class="shop-name"><span>ACCOUNT</span><b aria-hidden="true">帳</b></h2>
        <nav class="shop-tabs" role="tablist" aria-label="Account sections">${TABS.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="false">${label}</button>`).join('')}</nav>
        <div class="shop-wallet" id="shop-wallet"></div>
        <button type="button" class="shop-close" id="shop-close" aria-label="Close Account">BACK <span aria-hidden="true">↩</span></button>
      </header>
      <p class="shop-earned" id="shop-earned">${COIN}<span>${EARNED_LINE}</span></p>
      <div class="shop-body" id="shop-body"></div>
      <p class="shop-status" id="shop-status" role="status" aria-live="polite"></p>`;
    host.append(this.root);
    this.root.addEventListener('click', event => this.click(event.target as HTMLElement));
    // A card focused (a pad, the keyboard) is the one looked at.
    this.root.addEventListener('focusin', event => { const card = (event.target as HTMLElement).closest<HTMLElement>('[data-item]'); if (card && !card.dataset.act) this.pick(card.dataset.item as FighterId); });
    // Escape closes it before anything under it hears the key.
    window.addEventListener('keydown', event => { if (!this.open || event.code !== 'Escape') return; event.preventDefault(); event.stopPropagation(); this.hide(); }, true);
    client.on(wallet => { this.wallet = wallet; if (this.open) this.render(); });
  }

  get open() { return !this.root.classList.contains('hidden'); }
  private get account() { return this.wallet.account; }
  /** Whether a fighter is the account's: everyone's from the start, unlocked, or all access. */
  private mine(entry: Entry) { return !entry.item || owns(this.account, entry.item.id); }

  show(tab: string = this.tab) {
    // (The old tabs: REWARDS and the sign-in's ACCOUNT are in PROFILE now, the old SHOP and LOCKER in UNLOCKS.)
    this.tab = tab === 'profile' || tab === 'account' || tab === 'rewards' || tab === 'missions' ? 'profile' : 'unlocks';
    this.host.classList.add('shop-open'); this.root.classList.remove('hidden');
    this.render();
    this.connect();
    this.onOpen();
    // A pad's B closes it and LB / RB turn its tabs (controller, from main.ts); the main HUD's navigation does the
    // rest: it finds only the Account's controls.
    window.setTimeout(() => this.root.querySelector<HTMLElement>('#shop-body [data-item][aria-pressed=true], [data-tab][aria-selected=true]')?.focus({ preventScroll: true }), 30);
    window.clearInterval(this.tick);
    this.tick = window.setInterval(() => this.countdowns(), 1000);
  }
  /** The account asked of the server: on an answer the wallet redraws the panel (client.on); with none, the panel says so
   *  (PROFILE, with no account from before to show, offers TRY AGAIN). */
  private connect() {
    this.say(this.wallet.live ? '' : 'Opening your account…');
    if (this.unreachable) { this.unreachable = false; if (this.open) this.render(); }
    this.client.open().then(() => { this.unreachable = false; this.say(''); }, () => {
      this.unreachable = true;
      this.say(this.wallet.account ? 'Account cannot reach the server. What you have unlocked is shown as it was last seen.' : 'Account cannot reach the server.');
      if (this.open) this.render();
    });
  }
  /** UNLOCKS opened on one fighter, looked at: the one a locked PLAY was pressed with, say (`id`: their item's id). */
  showItem(id: string) {
    const fighter = ITEM.get(id)?.fighter;
    if (fighter && ENTRY.has(fighter)) { this.picked = fighter; this.confirming = undefined; this.filter = 'all'; }
    this.show('unlocks');
    window.setTimeout(() => { const card = this.root.querySelector<HTMLElement>(`#shop-body [data-item="${this.picked}"]`); card?.scrollIntoView({ block: 'nearest' }); card?.focus({ preventScroll: true }); }, 60);
  }
  private countdowns() {
    const left = turnover(Date.now());
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-until]')) {
      const ms = el.dataset.until === 'week' ? left.week : left.day;
      el.textContent = clock(ms);
      if (ms < 1000) window.setTimeout(() => this.render(), 1500);
    }
  }
  hide() {
    if (!this.open) return;
    window.clearInterval(this.tick);
    this.stage?.hide();
    this.root.classList.add('hidden'); this.host.classList.remove('shop-open');
    this.onClose();
    this.host.querySelector<HTMLElement>('#home-shop')?.focus({ preventScroll: true });
  }
  private say(text: string) { this.root.querySelector('#shop-status')!.textContent = text; }
  /** A pad's presses that are the Account's own (main.ts, before the HUD's navigation): B closes it, LB / RB turn its
   *  tabs - UNLOCKS, PROFILE, and round - with the focus on the tab turned to. */
  controller(action: UiAction): boolean {
    if (!this.open) return false;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // A card is looked at as the focus lands on it (focusin), so the way to its actions crossed its neighbours, each
    // looked at in turn: A on a card carries the focus to what can be done with it, and B there comes back to the card.
    if (action === 'confirm' && active?.matches('#shop-body [data-item]:not([data-act])')) {
      this.pick(active.dataset.item as FighterId);
      (this.root.querySelector<HTMLElement>('#shop-detail .shop-act:not(:disabled)') ?? active).focus();
      return true;
    }
    if (action === 'back' && active?.closest('#shop-detail')) { this.root.querySelector<HTMLElement>('#shop-body [data-item][aria-pressed="true"]')?.focus(); return true; }
    if (action === 'back') { this.hide(); return true; }
    if (action !== 'tabPrevious' && action !== 'tabNext') return false;
    this.tab = stepRound<Tab>(TABS.map(([id]) => id), this.tab, action === 'tabNext' ? 1 : -1)!; this.confirming = undefined;
    this.render();
    this.root.querySelector<HTMLElement>(`.shop-head [data-tab="${this.tab}"]`)?.focus({ preventScroll: true });
    return true;
  }

  // ---- the frame ----------------------------------------------------------------------------
  private render() {
    for (const tab of this.root.querySelectorAll<HTMLElement>('[role=tab]')) tab.setAttribute('aria-selected', String(tab.dataset.tab === this.tab));
    this.renderWallet();
    const body = this.root.querySelector<HTMLElement>('#shop-body')!;
    const was = body.querySelector<HTMLElement>('.shop-scroll') ?? (body.dataset.tab === 'profile' ? body : null);
    if (was && body.dataset.tab) this.scrolled[body.dataset.tab as Tab] = was.scrollTop;
    const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('#shop [data-item], #shop [data-act], #shop [data-tab], #shop [data-filter]');
    const refocus = focused ? (focused.dataset.act ? `[data-act="${focused.dataset.act}"]` : focused.dataset.item ? `[data-item="${focused.dataset.item}"]` : focused.dataset.filter ? `[data-filter="${focused.dataset.filter}"]` : `[data-tab="${focused.dataset.tab}"]`) : '';
    body.dataset.tab = this.tab;
    if (this.tab === 'profile') {
      this.stage?.hide();
      this.accountTab.render(body, this.wallet, this.unreachable && !this.wallet.account);
      body.scrollTop = this.scrolled.profile ?? 0;
    } else {
      const page = this.unlocksPage();
      body.innerHTML = `<div class="shop-scroll" id="shop-scroll">${page.html}</div><aside class="shop-detail" id="shop-detail" aria-live="polite"></aside>`;
      if (!this.picked || !page.ids.includes(this.picked)) this.picked = page.first;
      this.markPicked();
      body.querySelector<HTMLElement>('.shop-scroll')!.scrollTop = this.scrolled.unlocks ?? 0;
      this.renderDetail();
    }
    if (refocus) this.root.querySelector<HTMLElement>(refocus)?.focus({ preventScroll: true });
  }

  private renderWallet() {
    const account = this.account, level = levelOf(account?.xp ?? 0), next = roadNext(account);
    this.root.querySelector('#shop-wallet')!.innerHTML = `
      <button type="button" class="shop-level" data-tab="profile" aria-label="Level ${level.level}${next ? `: ${escape(next.item.name)} free at level ${next.level}` : ''}. Open your profile.">
        <b>${level.level}</b>
        <span><small>LEVEL ${level.level}${next ? ` · NEXT AT ${next.level}` : ''}</small><i><u style="width:${level.max ? 100 : Math.round(level.into / level.span * 100)}%"></u></i>
        <small class="shop-level-next">${next ? escape(next.item.name.toUpperCase()) : 'EVERY LEVEL REACHED'}</small></span>
      </button>
      <div class="shop-balance" title="${EARNED_LINE}">${COIN}<strong>${thousands(account?.balance ?? 0)}</strong><small>${CURRENCY.name.toUpperCase()}</small></div>`;
  }

  // ---- how a fighter is got, said on a card and in full ----------------------------------------
  /** A card's line: what it costs, the level it is free at, or that it is yours. */
  private how(entry: Entry): { html: string; state: 'owned' | 'free' | 'price' } {
    const item = entry.item;
    if (!item || this.mine(entry)) return { html: 'YOURS', state: 'owned' };
    const level = roadLevel(item.id);
    if (level !== undefined) return { html: `<em>FREE · LV ${level}</em><span>or ${COIN}${thousands(item.price ?? 0)}</span>`, state: 'free' };
    return { html: `${COIN}${thousands(item.price ?? 0)}`, state: 'price' };
  }
  /** How it is got, in words (for a screen reader, and the detail). */
  private howWords(entry: Entry): string {
    const account = this.account, item = entry.item;
    if (!item) return 'yours from the start';
    const level = roadLevel(item.id);
    if (owns(account, item.id)) return account?.items[item.id] ? 'yours: unlocked' : level !== undefined && levelOf(account?.xp ?? 0).level >= level ? `yours: free at level ${level}` : 'yours: all access';
    return `${level !== undefined ? `free at level ${level}, or ` : ''}${thousands(item.price ?? 0)} ${CURRENCY.name}`;
  }
  private card(entry: Entry): string {
    const { fighter, item } = entry, how = this.how(entry), afford = how.state !== 'owned' && (this.account?.balance ?? 0) >= (item?.price ?? Infinity), name = nameOf(entry);
    return `<button type="button" class="shop-card kind-fighter${item ? ` r-${item.rarity}` : ''} is-${how.state}${afford ? ' can-buy' : ''}" data-item="${fighter}" aria-pressed="false" aria-label="${escape(name)}, ${escape(this.howWords(entry))}">
      ${fighterArt(fighter, how.state === 'owned' ? undefined : item?.glyph)}
      ${how.state === 'owned' && item ? '<span class="shop-card-seal" aria-hidden="true">済</span>' : ''}
      <span class="shop-card-name">${escape(name)}</span>
      <span class="shop-card-how">${how.html}</span>
    </button>`;
  }

  // ---- UNLOCKS -----------------------------------------------------------------------------------
  private unlocksPage(): { html: string; ids: FighterId[]; first?: FighterId } {
    const locked = ENTRIES.filter(entry => !this.mine(entry) && entry.item?.stage === 'live'), mine = ENTRIES.filter(entry => this.mine(entry));
    const goal = goalOf(this.account)?.fighter, shows = (side: Filter) => this.filter === 'all' || this.filter === side;
    const shelf = (id: Filter, name: string, entries: readonly Entry[], none: string) => shows(id) ? `<section class="shop-shelf" data-shelf="${id}"><h3><span>${name}</span><small>${entries.length}</small></h3>
      ${entries.length ? `<div class="shop-cards">${entries.map(entry => this.card(entry)).join('')}</div>` : `<p class="shop-empty">${none}</p>`}</section>` : '';
    const filters: [Filter, string, number][] = [['all', 'ALL', ENTRIES.length], ['locked', 'TO UNLOCK', locked.length], ['yours', 'YOURS', mine.length]];
    const listed = [...(shows('locked') ? locked : []), ...(shows('yours') ? mine : [])];
    return {
      ids: listed.map(entry => entry.fighter),
      first: (goal && listed.some(entry => entry.fighter === goal) ? goal : undefined) ?? listed[0]?.fighter,
      html: `${this.refundNotice()}
        <div class="shop-filter" role="group" aria-label="Show">${filters.map(([id, label, n]) => `<button type="button" data-filter="${id}" aria-pressed="${this.filter === id}">${label}<b>${n}</b></button>`).join('')}
          <span class="shop-filter-note">${mine.length} of ${ENTRIES.length} fighters are yours. Unlock the rest with ${CURRENCY.name}, or free at their level.</span></div>
        ${shelf('locked', 'TO UNLOCK', locked, 'Every fighter is yours.')}
        ${shelf('yours', 'YOURS', mine, 'None yet.')}` };
  }
  /** Prices dropped (refunds.ts): what came back, said once in this browser. */
  private refundNotice(): string {
    const account = this.account, total = refundTotal(account);
    if (!account || !total) return '';
    let seen = 0;
    try { seen = Number(localStorage.getItem(`${SEEN}:${account.pk}`)) || 0; } catch { /* Said again next time. */ }
    if (seen >= total) return '';
    return `<section class="shop-notice" role="note"><b class="shop-notice-mark" aria-hidden="true">${CURRENCY.mark}</b>
      <span><strong>COSTS DROPPED · ${COIN}${thousands(total - seen)} RETURNED</strong><small>Fighters now cost days of play, not weeks. The ${CURRENCY.name} you spent above today's cost is yours again.</small></span>
      <button type="button" class="shop-act off" data-act="notice">GOT IT</button></section>`;
  }

  // ---- the fighter looked at -------------------------------------------------------------------
  private markPicked() {
    for (const card of this.root.querySelectorAll<HTMLElement>('#shop-body [data-item]')) card.setAttribute('aria-pressed', String(card.dataset.item === this.picked));
  }
  private pick(fighter: FighterId) {
    if (this.picked === fighter || !ENTRY.has(fighter)) return;
    this.picked = fighter; this.confirming = undefined;
    this.markPicked();
    this.renderDetail();
  }

  /** The fighter looked at: who they are, how they are got, and what can be done with them. */
  private renderDetail() {
    const detail = this.root.querySelector<HTMLElement>('#shop-detail');
    if (!detail) return;
    // The focus on one of its buttons stays on that button as it is drawn again (SET AS YOUR GOAL, from a pad or the keys).
    const kept = detail.contains(document.activeElement) ? (document.activeElement as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act : undefined;
    const entry = this.picked ? ENTRY.get(this.picked) : undefined, account = this.account;
    if (!entry) { detail.innerHTML = ''; this.stage?.hide(); return; }
    const { fighter, item } = entry, name = nameOf(entry), mine = this.mine(entry), level = item ? roadLevel(item.id) : undefined, at = levelOf(account?.xp ?? 0).level, goal = !!item && goalOf(account)?.id === item.id;
    // How they are got: yours (and how), free at a level (and how far), or their cost (and how far the Sumi is from it).
    let how = '';
    if (mine) how = `<div class="shop-how is-mine"><b>YOURS</b><span>${escape(item ? this.howWords(entry).replace(/^yours:?\s*/, '').replace(/^./, c => c.toUpperCase()) : 'Every player has them from the start.')}</span></div>`;
    else if (item) {
      if (level !== undefined) { const left = Math.max(0, level - at);
        how += `<div class="shop-how is-road"><b>FREE AT LEVEL ${level}</b><span>${left ? `You are level ${at}: ${plural(left, 'level')} to go.` : 'Yours at your next match.'}</span><i><u style="width:${Math.round(Math.min(1, at / level) * 100)}%"></u></i></div>`; }
      if (item.price !== undefined) { const save = savingFor(account, item);
        how += `<div class="shop-how is-price"><b>${level !== undefined ? 'OR UNLOCK NOW · ' : 'COSTS '}${COIN}${thousands(save.price)}</b><span>${save.left ? `You have ${thousands(save.have)}: about ${plural(save.matches, 'match', 'matches')} to go.` : `You have ${thousands(save.have)}.`}</span><i><u style="width:${Math.round(save.share * 100)}%"></u></i><small class="shop-how-earned">${EARNED_LINE}</small></div>`; }
    }
    const acts: string[] = [];
    if (mine) acts.push(`<button type="button" class="shop-act" data-act="play">PLAY AS ${escape(name.toUpperCase())}</button>`);
    else if (item && item.stage === 'live' && item.price !== undefined) {
      const no = cannotBuy(account ?? ({ items: {}, feats: [], xp: 0, balance: 0, worn: {} } as unknown as Account), item.id, this.wallet.sold[item.id] ?? 0);
      acts.push(no ? `<button type="button" class="shop-act" disabled>${COIN}${num(thousands(item.price))}</button>`
        : `<button type="button" class="shop-act${this.confirming === fighter ? ' sure' : ''}" data-act="buy">${this.confirming === fighter ? `PRESS AGAIN TO UNLOCK · ${COIN}${num(thousands(item.price))}` : `UNLOCK · ${COIN}${num(thousands(item.price))}`}</button>`);
      if (no && !/costs/.test(no)) acts.push(`<p class="shop-why">${escape(no)}</p>`);
    }
    acts.push(`<button type="button" class="shop-act off" data-act="try">${mine ? 'THE TRAINING GROUND' : 'TRY IN THE TRAINING GROUND'}</button>`);
    if (!mine && item?.stage === 'live' && item.price !== undefined) acts.push(`<button type="button" class="shop-act off shop-goal${goal ? ' is-goal' : ''}" data-act="goal" aria-pressed="${goal}">${goal ? '★ YOUR GOAL' : '☆ SET AS YOUR GOAL'}</button>`);
    detail.className = `shop-detail${item ? ` r-${item.rarity}` : ''}`;
    detail.innerHTML = `
      <div class="shop-stage" id="shop-stage">${fighterArt(fighter)}</div>
      <div class="shop-detail-text">
        <span class="shop-detail-kind">${item ? `<b>${RARITY[item.rarity].name.toUpperCase()}</b>` : ''}${escape(FIGHTERS[fighter].series.toUpperCase())}</span>
        <h3>${escape(name)}</h3>
        ${item ? `<p>${escape(item.blurb)}</p>` : ''}
        ${how}
        <div class="shop-acts">${acts.join('')}</div>
      </div>`;
    if (kept) detail.querySelector<HTMLElement>(`[data-act="${kept}"]`)?.focus({ preventScroll: true });
    // (The camera sits where it did until then.)
    this.stage?.show(detail.querySelector<HTMLElement>('#shop-stage')!, fighter);
  }

  // ---- what is pressed -----------------------------------------------------------------------
  private click(target: HTMLElement) {
    const button = target.closest<HTMLElement>('button');
    if (!button || (button as HTMLButtonElement).disabled) return;
    if (button.id === 'shop-close') { this.hide(); return; }
    if (button.dataset.tab) { this.tab = button.dataset.tab as Tab; this.confirming = undefined; this.render(); return; }
    if (button.dataset.filter) { this.filter = button.dataset.filter as Filter; this.scrolled.unlocks = 0; this.render(); return; }
    if (this.tab === 'profile' && this.accountTab.click(button)) return;
    if (button.dataset.item && !button.dataset.act) { this.pick(button.dataset.item as FighterId); return; }
    const act = button.dataset.act, entry = this.picked ? ENTRY.get(this.picked) : undefined, item = entry?.item;
    if (act === 'notice') { try { localStorage.setItem(`${SEEN}:${this.account?.pk}`, String(refundTotal(this.account))); } catch { /* Said again next time. */ } this.render(); return; }
    if (!entry || this.busy) return;
    if ((act === 'play' || act === 'try')) { this.hide(); this.onPlay?.(entry.fighter, act === 'try'); return; }
    if (!item) return;
    if (act === 'goal') {
      const was = goalOf(this.account)?.id === item.id;
      setGoal(was ? undefined : item.id);
      this.say(was ? '' : `${item.name} is your goal: the home screen and what each match earns count you towards them.`);
      this.renderDetail(); return;
    }
    if (act === 'buy') {
      // Twice to unlock: once to say so, once to mean it.
      if (this.confirming !== entry.fighter) { this.confirming = entry.fighter; window.clearTimeout(this.confirmTimer); this.confirmTimer = window.setTimeout(() => { this.confirming = undefined; this.renderDetail(); }, 5000); this.renderDetail(); this.root.querySelector<HTMLElement>('[data-act=buy]')?.focus(); return; }
      this.confirming = undefined; window.clearTimeout(this.confirmTimer);
      void this.attempt(async () => { await this.client.buy(item.id); this.say(`${item.name} is yours.`); this.stamp(entry.fighter); });
    }
  }
  /** Something asked of the server: one at a time, and its refusal said in its own words. */
  private async attempt(work: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true; this.root.classList.add('busy');
    try { await work(); }
    catch (error) {
      const message = (error as Error)?.message ?? '';
      if (message === 'cancelled' || (error as { cancelled?: boolean })?.cancelled) this.say('');
      else this.say(error instanceof Refused ? message : /sign-in|privy/i.test(message) ? message : 'The server could not be reached. Try again in a moment.');
    }
    finally { this.busy = false; this.root.classList.remove('busy'); this.render(); }
  }

  /** The seal coming down on the fighter just unlocked. */
  private stamp(fighter: FighterId) { window.setTimeout(() => { for (const seal of this.root.querySelectorAll(`.shop-card[data-item="${fighter}"] .shop-card-seal`)) seal.classList.add('fresh'); }, 0); }
}

/** The account on the home screen: a chip in the heading's rule - the level and the next fighter it frees, the goal if
 *  one is chosen, the Sumi - and ACCOUNT among the menu's actions. */
export function homeChip(account: Account | undefined): string {
  const level = levelOf(account?.xp ?? 0), next = roadNext(account), goal = goalOf(account);
  // (No spans: the heading it sits in styles every span as its own rule.)
  return `<b class="shop-chip-level">LV ${level.level}</b>${next ? `<em class="shop-chip-next"><i><u style="width:${Math.round(next.share * 100)}%"></u></i>NEXT · ${escape(next.item.name.toUpperCase())} AT ${next.level}</em>` : ''}${goal ? `<em class="shop-chip-goal">★ ${escape(goal.name.toUpperCase())} ${thousands(Math.min(account?.balance ?? 0, goal.price ?? 0))}/${thousands(goal.price ?? 0)}</em>` : ''}<strong class="shop-chip-money">${COIN}${thousands(account?.balance ?? 0)}</strong>`;
}
export { money };
