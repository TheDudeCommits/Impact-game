/** Streak banners (the shop's overhaul, 1 October; after the kill banners the
 *  big shooters sell, that grow with every kill in a round): what crosses the
 *  screen as the player's KO chain reaches 50, 100, 500 and 1,000 - grander at
 *  every mark. Lettered by the HUD (SurvivalHud.chain) for the player's own
 *  chain; its sound is the run's (RiftAudio.cosmetic).
 *
 *  Brushstroke: one stroke of a wide brush across the screen, dragged on in a
 *  third of a second, the count's name in white inside it and its number in a
 *  red seal. Taiko: a war drum's crest struck in on a crimson band, the name
 *  in gold, gold leaf thrown off it - one beat of the drum at 50, four at a
 *  thousand. */
import './banners.css';
import { COSMETIC_SOUND } from '../../audio/survival/RiftAudio';

export const BANNER_IDS = ['banner-brush', 'banner-taiko'] as const;
/** The chain's marks, in order, and what each is called (a fifty-man cut, a hundred-man cut...). */
export const BANNER_MARKS = [50, 100, 500, 1000] as const;
const NAMES: Record<number, string> = { 50: '五十人斬り', 100: '百人斬り', 500: '五百人斬り', 1000: '千人斬り' };
/** How long one holds the screen (ms). */
export const BANNER_MS = 2300;

/** A brush stroke's outline across a 1200 x 220 box: a heavy loaded head, a body that thins and wavers, and
 *  a tail split into dry bristles - with the gaps where the brush ran dry drawn as paper. Its own each time. */
function stroke(seed: number): string {
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const top: string[] = [], bottom: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const x = 40 + i * 46, t = i / 24;
    // (Thick where the brush came down, thinning toward the tail, the edge never quite straight.)
    const half = (78 - 34 * t * t) * (1 + (r() - .5) * .12), mid = 110 + Math.sin(t * 3.1 + seed) * 10;
    top.push(`${x.toFixed(0)},${(mid - half + (r() - .5) * 8).toFixed(0)}`);
    bottom.push(`${x.toFixed(0)},${(mid + half + (r() - .5) * 8).toFixed(0)}`);
  }
  const head = `M40,${top[0].split(',')[1]} C0,40 0,180 40,${bottom[0].split(',')[1]}`;
  const body = `${head} L${bottom.join(' L')} L1170,120 L${[...top].reverse().join(' L')} Z`;
  let dry = '';
  for (let i = 0; i < 9; i++) {
    const y = 60 + r() * 100, from = 520 + r() * 420, w = 2 + r() * 5;
    dry += `<rect x="${from.toFixed(0)}" y="${y.toFixed(0)}" width="${(1200 - from).toFixed(0)}" height="${w.toFixed(1)}"/>`;
  }
  return `<svg class="sv-streak-stroke" viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true"><path d="${body}"/><g class="dry">${dry}</g></svg>`;
}
/** The three commas of a taiko's crest (mitsudomoe), in a gold ring. */
const CREST = `<svg class="sv-streak-crest" viewBox="-100 -100 200 200" aria-hidden="true"><circle r="96" class="rim"/><circle r="86" class="face"/>${[0, 120, 240].map(turn =>
  `<path transform="rotate(${turn})" d="M0,-70 A22,22 0 1,1 0,-26 A44,44 0 0,1 -44,-48 A58,58 0 0,0 0,-70 Z"/><circle transform="rotate(${turn})" cx="0" cy="-48" r="21"/>`).join('')}</svg>`;

let shown: HTMLElement | undefined;
/** A banner for the player's chain reaching `mark` (one of BANNER_MARKS), over `host`. `preview`: the shop's
 *  picture of it (sized to its panel, and silent). */
export function playBanner(host: HTMLElement, id: string, mark: number, preview = false) {
  const tier = Math.max(1, BANNER_MARKS.indexOf(mark as (typeof BANNER_MARKS)[number]) + 1);
  shown?.remove();
  const el = document.createElement('div');
  el.className = `sv-streak t-${tier} ${id === 'banner-taiko' ? 'b-taiko' : 'b-brush'}${preview ? ' is-preview' : ''}`;
  el.setAttribute('aria-hidden', 'true');
  const words = `<div class="sv-streak-words"><b>${NAMES[mark] ?? `${mark}人斬り`}</b><span>${mark.toLocaleString('en-US')} KO CHAIN</span></div>`;
  if (id === 'banner-taiko') {
    const flakes = Array.from({ length: 10 + tier * 6 }, (_, i) => `<i style="--a:${(i * 137.5) % 360}deg;--d:${(.6 + (i % 5) * .22).toFixed(2)};--w:${(i % 3) + 1}"></i>`).join('');
    el.innerHTML = `<div class="sv-streak-band"></div>${CREST}${words}<div class="sv-streak-flakes">${flakes}</div>`;
    if (!preview) COSMETIC_SOUND.play('drum', 0, tier);
  } else {
    el.innerHTML = `${stroke(mark * 7 + Math.floor(Math.random() * 1000))}${tier >= 3 ? stroke(mark * 13 + 5).replace('sv-streak-stroke', 'sv-streak-stroke second') : ''}${words}<i class="sv-streak-seal">${mark}</i>`;
    if (!preview) COSMETIC_SOUND.play('swish');
  }
  host.append(el);
  shown = el;
  window.setTimeout(() => { el.remove(); if (shown === el) shown = undefined; }, BANNER_MS);
}
