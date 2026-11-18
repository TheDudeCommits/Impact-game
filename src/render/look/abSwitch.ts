/** A/B switches for the look changes: `?ab=upscale,brush` turns those changes off for a visit, `?ab=old` all of them, so
 *  each can be compared on the player's own screen. The names:
 *  - upscale: the edge-aware upscale to the screen's own pixels (look/upscale.ts);
 *  - inkweight: the fighters' ink heavier on the shadow side (look/inkWeight.ts);
 *  - brush: the painting's strokes along the forms (filmPaint.ts);
 *  - face: the fighters' face light (look/faceLight.ts);
 *  - phonepaint: the painting on phones (GameRenderer.applySettings);
 *  - resmemory: the resolution a desktop settled at, remembered (resolutionMemory.ts).
 *  The look's probe (window.__look.ab) flips them in a running page for the before/after stills. */
export type AbName = 'upscale' | 'inkweight' | 'brush' | 'face' | 'phonepaint' | 'resmemory';
export const AB_NAMES: readonly AbName[] = ['upscale', 'inkweight', 'brush', 'face', 'phonepaint', 'resmemory'];

const off = new Set<string>((() => {
  try { return (new URLSearchParams(location.search).get('ab') ?? '').split(',').map(s => s.trim()).filter(Boolean); }
  catch { return []; }
})());
const listeners = new Set<() => void>();

/** Whether `name`'s change is turned off for this visit. */
export const abOff = (name: AbName) => off.has('old') || off.has(name);
/** Turns `name`'s change off (true) or back on, for the probe; whoever drew with it is told (onAbChange). */
export function setAbOff(name: AbName, value: boolean) {
  if (off.has('old')) { off.delete('old'); for (const n of AB_NAMES) off.add(n); }
  if (value) off.add(name); else off.delete(name);
  for (const listener of listeners) listener();
}
/** Calls `listener` whenever a switch is flipped by the probe. */
export function onAbChange(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
