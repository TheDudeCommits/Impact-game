/** A/B switches for the look changes: `?ab=upscale,brush` turns those changes off for a visit, `?ab=old` all of them, so
 *  each can be compared on the player's own screen. The names:
 *  - upscale: the edge-aware upscale to the screen's own pixels (look/upscale.ts);
 *  - inkweight: the fighters' ink heavier on the shadow side (look/inkWeight.ts);
 *  - brush: the painting's strokes along the forms (filmPaint.ts);
 *  - face: the fighters' face light (look/faceLight.ts);
 *  - phonepaint: the painting on phones (GameRenderer.applySettings);
 *  - resmemory: the resolution a desktop settled at, remembered (resolutionMemory.ts).
 *  And:
 *  - guard: the guard drawn in ink in the film look, where it was a glass bubble (vfx/GuardFx.ts);
 *  - seethrough: the player's body drawn as a pencil line where it hides the rival, where it was thinned with dots
 *    (OcclusionFade.ts);
 *  - fxcap: effects thinned where they would bury a fighter;
 *  - inkhits: the hand-drawn ink impacts on the big hits in the film look (vfx/VfxKit.ts);
 *  - facefix: the face light's back-light guard (look/faceLight.ts);
 *  - onones: a fighter in a move or a reaction posed on every frame in the film look, the rest on twos
 *    (look/filmDrawings.ts);
 *  - hitflash: the struck body's flash two frames long, and an inverted ink frame for a counter or a punish;
 *  - posesnap: a reaction started from the body's own pose and angle, eased in over its first frames;
 *  - hitzone: the reaction picked by where the blow lands: high, middle or low;
 *  - settle: a knocked-down body settling onto the floor as it lands;
 *  - hairhit: hair and cloth pushed along the blow.
 *  And:
 *  - kostill: no painted still on a knockout in the film look (render/CombatEffects.ts knockout; look/filmFreeze.ts):
 *    the off switch brings back the frame held 1.15 s as a painting;
 *  - roundbodies: a Duel's next round keeps its two bodies (main.ts onSnapshot) where it built them afresh;
 *  - lightfx: the Armory's heaviest kits drawn lighter for the game's close camera (render/vfx/armory/lighter.ts:
 *    smoke-shaped particles, ground fields' marks and decals, volumes that fill the screen, the dustiest casts thinned).
 *  The look's probe (window.__look.ab) flips them in a running page for the before/after stills. */
export type AbName = 'upscale' | 'inkweight' | 'brush' | 'face' | 'phonepaint' | 'resmemory'
  | 'guard' | 'seethrough' | 'fxcap' | 'inkhits' | 'facefix' | 'onones' | 'hitflash' | 'posesnap' | 'hitzone' | 'settle' | 'hairhit'
  | 'kostill' | 'roundbodies' | 'lightfx';
export const AB_NAMES: readonly AbName[] = ['upscale', 'inkweight', 'brush', 'face', 'phonepaint', 'resmemory',
  'guard', 'seethrough', 'fxcap', 'inkhits', 'facefix', 'onones', 'hitflash', 'posesnap', 'hitzone', 'settle', 'hairhit',
  'kostill', 'roundbodies', 'lightfx'];

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
