/** The ball modes' gear in Account's UNLOCKS: ball skins, ball trails, goal bursts and
 *  celebrations for Goal Rush and Sky Spike (economy/catalog.ts kinds `ball`, `balltrail`, `goalburst`,
 *  `celebration`), each unlocked for its cost in Sumi (unlocks.ts) and worn or taken off here. The words follow
 *  Account's: unlock, cost, earn - never buy, price or pay - and EARNED_LINE beside every cost.
 *
 *  A shelf under the fighters, drawn only where the ball modes are (LAUNCH.ballModes: not on Player Two's copy of the
 *  build while it is 'site'), and a detail for the item looked at. Shop.ts hands it the presses on its cards. What an
 *  account owns is account.ts's owns(), as everywhere. */
import { ITEMS, type Item, type ItemKind } from '../../game/economy/catalog';
import { cannotBuy, owns, type Account } from '../../game/economy/account';
import { RARITY } from '../../game/economy/rarity';
import { CURRENCY, EARNED_LINE } from '../../game/economy/currency';
import { modeOpen } from '../../originals/launch'; // the ball modes' gear shows where the modes do
import './ballGear.css';

export const GEAR_KINDS: readonly ItemKind[] = ['ball', 'balltrail', 'goalburst', 'celebration'];
const SHELVES: Record<string, string> = { ball: 'BALL SKINS', balltrail: 'BALL TRAILS', goalburst: 'GOAL BURSTS', celebration: 'CELEBRATIONS' };
/** The gear on offer, in the catalogue's order. */
export const GEAR: readonly Item[] = ITEMS.filter(item => GEAR_KINDS.includes(item.kind) && item.stage === 'live');
export const isGear = (id: string | undefined) => !!id && GEAR.some(item => item.id === id);
/** Whether the ball modes (and so their gear) show on this page. */
export const gearShown = () => modeOpen('goal-rush') || modeOpen('sky-spike');

const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const thousands = (n: number) => Math.floor(n).toLocaleString('en-US');
const COIN = `<b class="shop-coin" aria-hidden="true">${CURRENCY.mark}</b>`;
/** The skins' inks, as the ball draws them (render/ball/ballCosmetics.ts SKINS): dark panel, middle, light panel. */
const SWATCH: Record<string, [string, string, string]> = {
  'ball-vermilion': ['#c81e2a', '#d8483a', '#fff4e6'], 'ball-night-ink': ['#f4f0e6', '#3a3a44', '#0d0d12'], 'ball-indigo': ['#1f3a8a', '#4a6fb5', '#f1ede2'],
  'ball-jade': ['#127a52', '#3fae7f', '#eef6ee'], 'ball-gold-leaf': ['#0d0b08', '#b8862a', '#ffd877'],
};
/** A gear card's picture: a skin's ball in its inks, anything else its mark. */
export function gearArt(item: Item): string {
  const s = SWATCH[item.id];
  if (s) return `<span class="shop-art bg-art k-ball" style="--bg-a:${s[0]};--bg-b:${s[1]};--bg-c:${s[2]}"><i class="bg-ball"></i></span>`;
  return `<span class="shop-art bg-art k-${item.kind}"><b>${escape(item.glyph ?? '')}</b></span>`;
}
const worn = (account: Account | undefined, item: Item) => (account?.worn as Record<string, unknown> | undefined)?.[item.kind] === item.id;

/** The shelf: each kind's gear, a card each, what it costs or that it is yours (WORN on the one worn). */
export function gearShelf(account: Account | undefined, picked: string | undefined): string {
  if (!gearShown() || !GEAR.length) return '';
  const card = (item: Item) => {
    const mine = owns(account, item.id), on = mine && worn(account, item), afford = !mine && (account?.balance ?? 0) >= (item.price ?? Infinity);
    return `<button type="button" class="shop-card kind-gear r-${item.rarity} is-${mine ? 'owned' : 'price'}${afford ? ' can-buy' : ''}" data-gear="${item.id}" aria-pressed="${item.id === picked}" aria-label="${escape(item.name)}, ${mine ? on ? 'yours, worn' : 'yours' : `${thousands(item.price ?? 0)} ${CURRENCY.name}`}">
      ${gearArt(item)}${mine ? `<span class="shop-card-seal" aria-hidden="true">${on ? '着' : '済'}</span>` : ''}
      <span class="shop-card-name">${escape(item.name)}</span><span class="shop-card-how">${mine ? on ? 'WORN' : 'YOURS' : `${COIN}${thousands(item.price ?? 0)}`}</span></button>`;
  };
  const shelves = GEAR_KINDS.map(kind => { const items = GEAR.filter(item => item.kind === kind); return items.length ? `<h4 class="bg-kind">${SHELVES[kind]}</h4><div class="shop-cards">${items.map(card).join('')}</div>` : ''; }).join('');
  const yours = GEAR.filter(item => owns(account, item.id)).length;
  return `<section class="shop-shelf bg-shelf" data-shelf="gear"><h3><span>BALL MODES · GOAL RUSH &amp; SKY SPIKE</span><small>${yours} / ${GEAR.length}</small></h3>${shelves}</section>`;
}

/** The gear looked at: what it is, what it costs or that it is yours, UNLOCK (twice, as a fighter's) and WEAR. */
export function gearDetail(item: Item, account: Account | undefined, sold: number, confirming: boolean): string {
  const mine = owns(account, item.id), on = mine && worn(account, item), kindName = SHELVES[item.kind]?.replace(/S$/, '') ?? '';
  const acts: string[] = [];
  if (mine) acts.push(`<button type="button" class="shop-act" data-act="gear-wear">${on ? 'TAKE OFF' : 'WEAR'}</button>`);
  else if (item.price !== undefined) {
    const no = cannotBuy(account ?? ({ items: {}, feats: [], xp: 0, balance: 0, worn: {} } as unknown as Account), item.id, sold);
    acts.push(no ? `<button type="button" class="shop-act" disabled>${COIN}${thousands(item.price)}</button>` : `<button type="button" class="shop-act${confirming ? ' sure' : ''}" data-act="gear-buy">${confirming ? `PRESS AGAIN TO UNLOCK · ${COIN}${thousands(item.price)}` : `UNLOCK · ${COIN}${thousands(item.price)}`}</button>`);
    if (no && !/costs/.test(no)) acts.push(`<p class="shop-why">${escape(no)}</p>`);
  }
  const how = mine ? `<div class="shop-how is-mine"><b>${on ? 'YOURS · WORN' : 'YOURS'}</b><span>${on ? 'You wear it in Goal Rush and Sky Spike.' : 'Wear it to see it in Goal Rush and Sky Spike.'}</span></div>`
    : `<div class="shop-how is-price"><b>COSTS ${COIN}${thousands(item.price ?? 0)}</b><span>You have ${thousands(account?.balance ?? 0)}.</span><small class="shop-how-earned">${EARNED_LINE}</small></div>`;
  return `<div class="shop-stage bg-stage">${gearArt(item)}</div>
    <div class="shop-detail-text">
      <span class="shop-detail-kind"><b>${RARITY[item.rarity].name.toUpperCase()}</b>${escape(kindName)} · BALL MODES</span>
      <h3>${escape(item.name)}</h3><p>${escape(item.blurb)}</p>${how}
      <div class="shop-acts">${acts.join('')}</div>
    </div>`;
}
