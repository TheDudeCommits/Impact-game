// The game's title card inside dude-world: index.html's own #boot page (its mark, the boiling focus lines, the name in the
// game's lettering and the bar that follows the files as they come), stood over the game while it loads and held a beat
// once its home is ready, then let go the way the page lets it go (boot/bootScreen.ts, index.html's __bootDone).
// The markup and the rules are index.html's, scoped under [data-game="impact"].
import markUrl from '../boot/art/mark-384.webp';
import { TITLE } from '../originals/brand';

const S = '[data-game="impact"]';
const css = (base: string) => `
@font-face{font-family:ImpactBootLettering;src:url('${base}assets/home/fonts/electroharmonix.otf') format('opentype');font-display:block}
${S} .ik-boot{position:absolute;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:hidden;pointer-events:auto;color:#111;background:radial-gradient(#11111114 .7px,transparent .9px) 0 0/5px 5px,#fff;box-shadow:inset 0 0 0 6px #111;transition:opacity .3s ease}
${S} .ik-boot.boot-done{opacity:0;pointer-events:none}
${S} .ik-boot .boot-lines{position:absolute;left:50%;top:50%;width:200vmax;height:200vmax;margin:-100vmax 0 0 -100vmax;background:repeating-conic-gradient(#111 0 .5deg,#0000 .5deg 7deg),repeating-conic-gradient(from 3deg,#111 0 .3deg,#0000 .3deg 11deg);-webkit-mask:radial-gradient(closest-side,#0000 13vmax,#000b 26vmax,#000 44vmax);mask:radial-gradient(closest-side,#0000 13vmax,#000b 26vmax,#000 44vmax);opacity:.9;animation:ik-boot-boil .36s steps(1) infinite,ik-boot-in .5s ease-out both}
${S} .ik-boot .boot-card{position:relative;display:grid;justify-items:center;gap:clamp(12px,2.2vmin,20px);padding:clamp(18px,3vmin,28px) clamp(22px,4vmin,40px);background:#fff;border:3px solid #111;box-shadow:7px 7px 0 #cc202b;animation:ik-boot-slam .5s cubic-bezier(.2,1.5,.45,1) both}
${S} .ik-boot .boot-mark{width:clamp(88px,15vmin,132px);aspect-ratio:1;background:url(${markUrl}) center/contain no-repeat #100f12;border:3px solid #111}
${S} .ik-boot .boot-word{font:400 clamp(30px,6.4vmin,56px)/.9 ImpactBootLettering,Impact,'Arial Narrow',sans-serif;letter-spacing:.05em;transform:skewX(-8deg);animation:ik-boot-word .55s .12s cubic-bezier(.2,1.3,.4,1) both}
${S} .ik-boot .boot-bar{position:relative;display:block;width:clamp(170px,30vmin,250px);height:9px;border:2px solid #111;transform:skewX(-18deg);overflow:hidden;background:#fff}
${S} .ik-boot .boot-bar>i{position:absolute;inset:0;background:#111;transform-origin:0 50%;transform:scaleX(var(--p,0));transition:transform .4s cubic-bezier(.3,.7,.3,1)}
${S} .ik-boot .boot-bar>i::after{content:'';position:absolute;right:0;top:0;bottom:0;width:4px;background:#cc202b}
${S} .ik-boot .boot-note{min-height:1em;font:400 11px/1 ImpactBootLettering,Impact,sans-serif;letter-spacing:.18em;color:#cc202b}
@keyframes ik-boot-boil{0%{transform:rotate(0)}33%{transform:rotate(1.4deg) scale(1.01)}66%{transform:rotate(-.9deg) scale(.995)}}
@keyframes ik-boot-in{from{opacity:0}}
@keyframes ik-boot-slam{from{opacity:0;transform:scale(1.18) rotate(-2deg)}}
@keyframes ik-boot-word{from{opacity:0;transform:translateX(-18px) skewX(-8deg)}}
@media (prefers-reduced-motion:reduce){${S} .ik-boot *{animation:none!important}${S} .ik-boot .boot-bar>i{transition:none}}`;

/** The title card over `parent` (host.ui): `progress(0..1)` moves its bar; `done()` fills it, holds it, fades it and takes
 *  it away (resolves when it has gone). */
export function titleCard(parent: HTMLElement, base: string) {
  const style = document.createElement('style'); style.textContent = css(base);
  const boot = document.createElement('div'); boot.className = 'ik-boot'; boot.setAttribute('aria-hidden', 'true');
  boot.innerHTML = '<i class="boot-lines"></i><div class="boot-card"><b class="boot-mark"></b><b class="boot-word"></b><i class="boot-bar"><i></i></i><small class="boot-note">LOADING</small></div>';
  boot.querySelector('.boot-word')!.textContent = TITLE.toUpperCase();
  const note = boot.querySelector<HTMLElement>('.boot-note')!;
  parent.append(style, boot);
  const set = (p: number) => { boot.style.setProperty('--p', p.toFixed(3)); note.textContent = `LOADING ${Math.round(p * 100)}%`; };
  set(.05);
  let gone = false, timer: ReturnType<typeof setTimeout> | undefined;
  const leave = () => {
    if (gone || boot.classList.contains('boot-done')) return;
    unlisten(); boot.classList.add('boot-done'); timer = setTimeout(remove, 320);
  };
  const unlisten = () => { removeEventListener('keydown', leave, true); removeEventListener('pointerdown', leave, true); };
  const remove = () => { gone = true; unlisten(); if (timer) clearTimeout(timer); boot.remove(); style.remove(); };
  return {
    progress: (fraction: number) => { if (!gone) set(.05 + .95 * Math.max(0, Math.min(1, fraction))); },
    /** The home is ready: the bar full and the name held a beat (a key or a click lets it go at once), then it fades. */
    done: (hold = 1100) => {
      if (gone) return;
      set(1);
      addEventListener('keydown', leave, true); addEventListener('pointerdown', leave, true);
      timer = setTimeout(leave, hold);
    },
    remove,
  };
}
