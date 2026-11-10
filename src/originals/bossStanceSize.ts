const STANCE: Record<string, { height: number; floor: number }> = {
  '/assets/survival/enemies/wuming.glb': { height: 1.63704, floor: -0.04495 }, // Wuming (wuming)
  '/assets/survival/enemies/jinlin.glb': { height: 1.94578, floor: -0.04115 }, // Emperor Jinlin (jinlin)
  '/assets/survival/enemies/gandang.glb': { height: 2.40652, floor: -0.09033 }, // Gandang (jirenga)
  '/assets/survival/enemies/akagane.glb': { height: 1.80076, floor: -0.06685 }, // Akagane (akagane)
  '/assets/survival/enemies/haldor.glb': { height: 3.16363, floor: -0.12664 }, // Haldor (haldor)
  '/assets/survival/enemies/shiun.glb': { height: 2.31585, floor: -0.09268 }, // Shiun (shiun)
  '/assets/survival/enemies/gorai.glb': { height: 3.38433, floor: -0.22921 }, // Gorai (gorai)
  '/assets/survival/enemies/gorai-wyrm.glb': { height: 3.30384, floor: -0.77641 }, // Gorai's Storm Wyrm (gorai-wyrm)
  '/assets/survival/enemies/nightfall.glb': { height: 1.83642, floor: -0.05874 }, // Nightfall (nightfall)
  '/assets/survival/enemies/barrow.glb': { height: 2.47525, floor: -0.20813 }, // Barrow (barrow): his old idle's box (his model unchanged; the new stance stands taller)
};

/** The box `url`'s previous idle measured (height and floor, in the file's units), or undefined to measure it. */
export function bossStance(url: string) {
  return STANCE[url.split('?')[0]];
}
