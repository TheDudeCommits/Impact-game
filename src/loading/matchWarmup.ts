import type * as THREE from 'three';
import type { PlayerState } from '../game/types';
import { prefetchEffekseer, roomChunkIds, roomFxIds, warmEffekseer, warmRoomFx, warmRoots } from '../render/vfx/armory/roomFx';
import { loadGlyphs } from '../render/area/StampPainter';

/**
 * What a match's load waits for besides its bodies, stage and signatures, so that when the match says FIGHT nothing it can
 * show still needs a download, a parse, a shader compile or a texture upload (launch night, 12 October 2026: "a frozen
 * frame mid-fight the first time anyone throws a move, summons a form or casts an Armory effect", handover priority 3).
 * Read from the room's players and the game's data, never from a list kept by hand: the castings and house kits that are
 * switched on later are warmed with no change here.
 *
 * main.ts `ensureSnapshotAssets` calls `warmRoomAssets` beside the models' load and before the room's compile and texture
 * upload, so what it builds is compiled and uploaded with the room's own bodies, behind the loading screen:
 *  - every player's area look and kit effects (roomFx.ts), each built and cast once in hiding (fxStage.ts `warm`);
 *  - every player's area seal painted and uploaded, with the lettering it is drawn in (AreaTelegraph.warmSeal);
 *  - the sound: the Armory's renders made and decoded, and the game's own bank and voices waited for (never long).
 *
 * **It never holds a match up.** Everything here is an extra: a match that cannot have it (a chunk that does not arrive, a
 * browser without Web Audio, a device too slow) is built and played as it was before this existed, the effect on its first
 * use. So `warmRoomAssets` never rejects, stops after `WARM_CAP` ms whatever is left (the builds still queued are then not
 * started, so they cannot land in the fight), and every wait inside has a cap of its own.
 */
type RoomPlayer = Pick<PlayerState, 'fighter'> & Partial<Pick<PlayerState, 'forge' | 'enemy'>>;

/** The warm-up is on unless the page is opened with `?nowarm`: a switch for the release, to compare a match with and without
 *  it on the live site, and to turn it off at once if a device's load time turns out to matter more than its first-use
 *  hitches. (Nothing it does is needed to play: see the header.) */
export const warmEnabled = () => { try { return typeof location !== 'object' || !/[?&]nowarm\b/.test(location.search); } catch { return true; } };

/** A named moment of a match's load on the page's performance timeline (`jump:<name>`), for the measuring tools
 *  (scripts/night/load_hitches.mjs reads them): where PLAY's seconds go. */
export const stamp = (name: string) => { try { performance.mark(`jump:${name}`); } catch { /* no timeline */ } };

/** A frame, or 50 ms where none comes (a hidden tab draws none): the pause between two heavy builds, so the loading
 *  screen and a fight already in progress both keep moving. */
export const nextFrame = () => new Promise<void>(resolve => {
  let done = false;
  const go = () => { if (!done) { done = true; resolve(); } };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go);
  setTimeout(go, 50);
});

/** The room's Armory effects' code and the seals' lettering fetched now, beside the models (each effect a lazy chunk): the
 *  build that follows the signatures' load finds them in the module cache instead of asking the network a dozen times in
 *  a row. */
export function prefetchRoomFx(players: readonly RoomPlayer[]) {
  // A fetch ahead, nothing more: whatever goes wrong here (a player the data does not know) must not touch the load.
  try {
    if (!warmEnabled()) return;
    const ids = roomChunkIds(players);
    void loadGlyphs();
    if (!ids.length) return;
    void import('../render/vfx/armory/vendor/manifest').then(({ ARMORY_MANIFEST }) => {
      for (const id of ids) (ARMORY_MANIFEST as Record<string, { load(): Promise<unknown> } | undefined>)[id]?.load().catch(() => {});
    }, () => {});
  } catch (error) { console.warn('match warm-up: effects could not be fetched ahead', error); }
}

/** The longest `warmRoomAssets` runs, ms: far inside the server's 90 s for a page to say its assets are in. */
export const WARM_CAP = 10_000;

/** Rooms past let go, as a room's load begins (never in a fight): every Armory effect type the page built for an earlier room
 *  that this one does not draw - its pool's meshes, buffers and materials, and the scene objects they were - so a page's effects
 *  are the room's, not every room's. `keep` is what the room's players ask the stage for (roomFx.ts); what its castings built is
 *  added by the effects themselves. A type a later room wants is built again, as a first-time one is. Never throws. */
export function retainRoomEffects(players: readonly RoomPlayer[], effects: { retainEffects(keep: ReadonlySet<string>): string[] }): string[] {
  try { return warmEnabled() ? effects.retainEffects(new Set(roomFxIds(players))) : []; }
  catch (error) { console.warn('match warm-up: the effects of earlier rooms could not be let go', error); return []; }
}

export interface WarmOptions {
  /** False once the room this is for has been left. */
  current: () => boolean;
  /** The longest the whole warm-up runs, ms (WARM_CAP). */
  cap?: number;
  /** The area telegraph, for its seals; the renderer, to hand their textures to the card now. */
  areaFx?: { warmSeal(player: Pick<PlayerState, 'fighter' | 'forge'>): THREE.Texture };
  renderer?: { initTexture(texture: THREE.Texture): void };
  /** The game's camera: with a WebGLRenderer, Effekseer's runtime is started once the effects are built (prefetchEffekseer). */
  camera?: THREE.Camera;
  /** The game's audio (CombatAudio.ready). */
  audio?: { ready(cap?: number): Promise<void> };
  /** The longest the sound is waited for, ms. */
  soundCap?: number;
  /** The sound left to the caller, to wait for after its compile (warmRoomSound; the performance sweep, 24 October 2026). The
   *  Armory's renders are started here all the same, as the effects that name them are built, and handed back in `armory`. */
  soundLater?: { armory?: Promise<void> };
}

/** The area seals of a room painted, one at a time (a frame between when painting has taken a while), their textures
 *  uploaded as they are made. */
async function warmSeals(players: readonly RoomPlayer[], opts: WarmOptions) {
  const { areaFx, renderer } = opts;
  if (!areaFx) return;
  await loadGlyphs();
  let since = performance.now();
  for (const player of players) {
    if (!opts.current()) return;
    if (player.enemy) continue;
    try { const texture = areaFx.warmSeal(player); try { renderer?.initTexture(texture); } catch { /* uploaded on its first draw instead */ } }
    catch (error) { console.warn('match warm-up: a seal could not be painted', error); }
    if (performance.now() - since > 8) { await nextFrame(); since = performance.now(); }
  }
}

/** The Armory's renders made and decoded (once its effects are built: they name what to render; behind the loading screen in
 *  its longer slices, runtime.ts readySound). */
const armorySound = (cap: number, current: () => boolean) => import('../render/vfx/armory/runtime').then(runtime => runtime.readySound(cap, current));

/** The room's sound: the Armory's renders and decodes, and the game's own bank and voices. */
async function warmSound(opts: WarmOptions) {
  const cap = opts.soundCap ?? 3000;
  stamp('sound-wait');
  await Promise.all([opts.audio?.ready(cap), armorySound(cap, opts.current)]);
  stamp('sound');
}

/** The room's sound on its own (WarmOptions.soundLater): waited for after the room's compile, which needs none of it, so the
 *  compile and its uploads run while the bank comes in instead of after it - the Armory's renders, started with the effects
 *  (`armory`), and the game's bank and voices. Never rejects; at most `soundCap` ms. */
export async function warmRoomSound(opts: Pick<WarmOptions, 'current' | 'audio' | 'soundCap'> & { armory?: Promise<void> }): Promise<void> {
  if (!warmEnabled()) return;
  const cap = opts.soundCap ?? 3000, until = performance.now() + cap;
  stamp('sound-wait');
  await Promise.all([opts.audio?.ready(cap).then(() => stamp('sound-bank')), (opts.armory ?? armorySound(cap, opts.current)).then(() => stamp('sound-armory'))]).catch(error => console.warn('match warm-up: sound could not be warmed', error));
  // And what the bank's arrival asked for in its turn (main.ts preloads the announcer's lines once the bank is in), in the time left.
  const left = until - performance.now();
  if (left > 50) await opts.audio?.ready(left).catch(() => {});
  stamp('sound');
}

/** The objects a load-time warm draw (GameRenderer.warmDraw) shows once: every Armory effect's pool. */
export { warmEffekseer, warmRoots };

/** The room's effects, seals and sound made ready (see the header). Never rejects and never runs past `cap`: what cannot be
 *  warmed in that time is built on its first use, as before. */
export async function warmRoomAssets(players: readonly RoomPlayer[], opts: WarmOptions): Promise<void> {
  if (!warmEnabled()) return;
  const note = (what: string) => (error: unknown) => console.warn(`match warm-up: ${what} could not be warmed`, error);
  let expired = false, timer: ReturnType<typeof setTimeout> | undefined;
  const live = { ...opts, current: () => !expired && opts.current() };
  const work = (async () => {
    // Each part is its own async call, so a throw before its first await is a rejection, caught here like any other.
    try {
      await Promise.all([
        (async () => warmRoomFx(players, { between: nextFrame, current: live.current }))().catch(note('effects')),
        warmSeals(players, live).catch(note('seals')),
      ]);
      // Effekseer's runtime, when the room's effects use it, started now and its files fetched beside the models: started only
      // once the room had compiled (warmEffekseer), its 38 KB script took 2.35 s behind the sound bank (the performance sweep, 24
      // October 2026). warmEffekseer still waits for it, after the warm draw.
      try { const renderer = live.renderer as Partial<THREE.WebGLRenderer> | undefined; prefetchEffekseer(typeof renderer?.getContext === 'function' ? renderer as THREE.WebGLRenderer : undefined, live.camera); } catch (error) { note('Effekseer')(error); }
      if (opts.soundLater) opts.soundLater.armory = armorySound(WARM_CAP, opts.current).catch(note('sound'));
      else await warmSound(live).catch(note('sound'));
    } catch (error) { note('the room')(error); }
  })();
  const limit = new Promise<void>(done => { timer = setTimeout(() => { expired = true; done(); }, opts.cap ?? WARM_CAP); });
  try { await Promise.race([work, limit]); }
  finally {
    clearTimeout(timer);
    if (expired) console.warn(`match warm-up: stopped after ${opts.cap ?? WARM_CAP} ms; what is left is built on first use`);
  }
}
