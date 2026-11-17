// Impact as a dude-world cartridge (the site's docs/CARTRIDGES.md): the game's own boot (src/main.ts bootImpact), its
// menus, rules, bots, camera, look and HUD, on the world's three.js, renderer, frame loop and audio, inside host.ui.
// The demo's slice - one Duel against the game's own bot, on one stage, with a short roster - is the game's own launch
// gate narrowed (src/originals/demo.ts); nothing online is offered or called.
import { rt } from './runtime';
import type { Cartridge, CartridgeHost } from './contract';

declare const __IMPACT_SOURCE__: string;
export const meta = { id: 'impact', title: 'Impact', source: __IMPACT_SOURCE__ };

type Game = ReturnType<typeof import('../main')['bootImpact']>;

/** Until the home's fonts and pictures are in (or `cap` ms): the world's veil lifts on the menu as it looks. */
async function homeReady(root: HTMLElement, progress: (fraction: number) => void, cap = 9000) {
  const began = performance.now();
  const fonts = document.fonts?.ready.then(() => true) ?? Promise.resolve(true);
  let fontsIn = false; void fonts.then(() => { fontsIn = true; });
  for (;;) {
    const images = [...root.querySelectorAll<HTMLImageElement>('.manga-home img, .home-fighter img')].filter(img => img.src && img.loading !== 'lazy');
    const done = images.filter(img => img.complete).length;
    progress(images.length ? done / images.length : 0);
    if (fontsIn && images.length && done === images.length) return;
    if (performance.now() - began > cap) return;
    await new Promise(resolve => setTimeout(resolve, 60));
  }
}

export default function impact(): Cartridge {
  let host: CartridgeHost;
  let game: Game | undefined;
  const clear = { color: 0, alpha: 1 };
  return {
    async mount(h, progress) {
      host = h;
      // A fresh renderer's defaults, as the game's own page had them (the host puts the world's back after unmount).
      const r = h.renderer;
      r.setClearColor(0x000000, 1); r.autoClear = r.autoClearColor = r.autoClearDepth = r.autoClearStencil = true;
      r.sortObjects = true; r.localClippingEnabled = false; r.clippingPlanes = []; r.toneMappingExposure = 1; r.shadowMap.autoUpdate = true;
      h.THREE.ColorManagement.enabled = true; h.THREE.Cache.enabled = false;
      rt.begin(h);
      progress(.05);
      let main: typeof import('../main');
      rt.importing = true;
      try { main = await import('../main'); } finally { rt.importing = false; }
      progress(.35);
      game = main.bootImpact();
      await homeReady(game.root, f => progress(.35 + f * .65));
      progress(1);
    },
    frame(_dt, now) {
      rt.frame(now);
      // The home draws nothing behind its menus (main.ts): the frame under them is the page's own colour, not the world's.
      if (game && !game.drawing()) {
        const r = host.renderer, color = r.getClearColor(new host.THREE.Color()); clear.alpha = r.getClearAlpha(); clear.color = color.getHex();
        r.setRenderTarget(null); r.setClearColor(0x0b1620, 1); r.clear(); r.setClearColor(clear.color, clear.alpha);
      }
    },
    resize() { game?.resize(); },
    unmount() {
      try { game?.dispose(); } catch (error) { console.error('Impact: dispose', error); }
      finally { game = undefined; rt.end(); }
    },
  };
}
