import { YodakaFlameArt } from './YodakaFlameArt';
import type * as THREE from 'three';
import type { CombatEvent, FighterId } from '../../game/types';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import type { VfxKit } from '../vfx/VfxKit';
import { packQuiets } from '../../engine/packs/active';
import { wireArmory } from '../vfx/armory/castingSignature';
import { fxDraws, signatureCovers } from '../vfx/armory/drawn';
import { ForgeFxDirector } from '../vfx/armory/forgeFx';
import { StagedMoves, stagedBaseline } from './StagedMoves';

interface Signature {
  load(ids: readonly FighterId[]): Promise<unknown>;
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>): void;
  prepareContact?(event: CombatEvent, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>): void;
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>): void;
  reset(): void;
  dispose(): void;
  /** A lazy one's module fetched ahead (LazySignature). */
  prefetchFor?(id: FighterId): void;
}
type Factory = (scene: THREE.Scene, kit: VfxKit) => Signature;
/** A fighter's own module, fetched when a room has them (the performance sweep, 24 October 2026): imported here, these
 *  twenty-nine were about 700 KB of a first visit's code before minifying, for fighters the visit may never meet. (And the
 *  twenty-two Fighter.ts and its sockets asked for a point of: those points are their
 *  <Module>Contact.ts now, the layers about 550 KB more. Yodaka's stays imported: its tests build it as `load` is
 *  called, before its texture arrives - tests/yodakaAreaBridge.test.ts.) `load` - which a room's loading screen waits for before anything is
 *  compiled (main.ts roomExtras, CombatEffects.load) - imports and builds it, then loads it as before; until then it draws
 *  nothing, and nothing is in the air before a room has loaded. The factory stays synchronous: wireArmory wraps it as any. */
const lazy = (module: () => Promise<Factory>): Factory => Object.assign((scene: THREE.Scene, kit: VfxKit) => new LazySignature(module, scene, kit), { prefetch: module });
/** The layers CombatEffects keeps of its own (Rose's, Kuzu's, Shakugo's, Full Beam's, Pyroclast's,
 *  Ampere's), the same way: fetched and built by the first room whose ids have `owner`'s fighter (a room's ids carry the donors
 *  of the moves its kits borrow too), and loaded as before by every room after it. Until then there is nothing of theirs in the
 *  air; their <Module>Contact.ts says whose a move is, so CombatEffects leaves those moves to them from the first frame. */
export type LazyLayer = Signature;
export const lazyLayer = (owner: (id: string) => boolean, module: () => Promise<Factory>, scene: THREE.Scene, kit: VfxKit): LazyLayer => new LazySignature(module, scene, kit, owner);
const markLayer = () => { try { performance.mark('jump:lazy-ready:layer'); } catch { /* no timeline */ } };
class LazySignature implements Signature {
  private real?: Signature;
  private building?: Promise<Signature>;
  private disposed = false;
  constructor(private readonly module: () => Promise<Factory>, private readonly scene: THREE.Scene, private readonly kit: VfxKit, private readonly owner?: (id: string) => boolean) {}
  /** The module fetched ahead (at idle on the home, for the fighter picked there), built only when a room loads it. */
  prefetchFor(id: FighterId) { if (!this.building && (!this.owner || this.owner(id))) void this.module().catch(() => {}); }
  load(ids: readonly FighterId[]): Promise<unknown> {
    if (this.owner && !this.building && !ids.some(id => this.owner!(id))) return Promise.resolve();

    this.building ??= this.module().then(factory => { markLayer(); const real = factory(this.scene, this.kit); if (this.disposed) real.dispose(); else this.real = real; return real; });
    return this.building.then(real => this.disposed ? undefined : real.load(ids));
  }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) { this.real?.handle(event, fighters); }
  prepareContact(event: CombatEvent, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) { this.real?.prepareContact?.(event, fighters, flights); }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) { this.real?.update(time, fighters, flights); }
  reset() { this.real?.reset(); }
  dispose() { this.disposed = true; this.real?.dispose(); this.real = undefined; }
}
const factories: Partial<Record<FighterId, Factory>> = {
  chohan: lazy(() => import('./ChohanAllIn').then(m => (scene, kit) => new m.ChohanAllIn(scene, kit))),
  tsubute: lazy(() => import('./TsubuteSeedShot').then(m => (scene, kit) => new m.TsubuteSeedShot(scene, kit))),
  aqrab: lazy(() => import('./AqrabDesert').then(m => (scene, kit) => new m.AqrabDesert(scene, kit))),
  yodaka: (scene, kit) => new YodakaFlameArt(scene, kit),
  ume: lazy(() => import('./UmeBlossom').then(m => (scene, kit) => new m.UmeBlossom(scene, kit))),
  lanthorn: lazy(() => import('./LanthornLampblack').then(m => (scene, kit) => new m.LanthornLampblack(scene, kit))),
  highsun: lazy(() => import('./HighsunSun').then(m => (scene, kit) => new m.HighsunSun(scene, kit))),
  torsion: lazy(() => import('./TorsionPsychic').then(m => (scene, kit) => new m.TorsionPsychic(scene, kit))),
  kubiwa: lazy(() => import('./KubiwaControl').then(m => (scene, kit) => new m.KubiwaControl(scene, kit))),
  onigawara: lazy(() => import('./OnigawaraPressure').then(m => (scene, kit) => new m.OnigawaraPressure(scene, kit))),
  cardo: lazy(() => import('./BriarMagic').then(m => (scene, kit) => new m.BriarMagic('cardo', scene, kit))),
  bruin: lazy(() => import('./BriarMagic').then(m => (scene, kit) => new m.BriarMagic('bruin', scene, kit))),
  aquilo: lazy(() => import('./BriarMagic').then(m => (scene, kit) => new m.BriarMagic('aquilo', scene, kit))),
  svanhild: lazy(() => import('./BriarMagic').then(m => (scene, kit) => new m.BriarMagic('svanhild', scene, kit))),
  minase: lazy(() => import('./MinaseRaijin').then(m => (scene, kit) => new m.MinaseRaijin(scene, kit))),
  'psyche': lazy(() => import('./PsycheFleur').then(m => (scene, kit) => new m.PsycheFleur(scene, kit))),
  'ovid': lazy(() => import('./OvidFortitude').then(m => (scene, kit) => new m.OvidFortitude(scene, kit))),
  hawser: lazy(() => import('./HawserColossus').then(m => (scene, kit) => new m.HawserColossus(scene, kit))),
  rotfalke: lazy(() => import('./RotfalkeField').then(m => (scene, kit) => new m.RotfalkeField(scene, kit))),
  bonsho: lazy(() => import('./BonshoGuardian').then(m => (scene, kit) => new m.BonshoGuardian(scene, kit))),
  murex: lazy(() => import('./MurexBarrier').then(m => (scene, kit) => new m.MurexBarrier(scene, kit))),
  kinu: lazy(() => import('./KinuStoneThread').then(m => (scene, kit) => new m.KinuStoneThread(scene, kit))),
  'madake': lazy(() => import('./MadakeSeasons').then(m => (scene, kit) => new m.MadakeSeasons(scene, kit))),
  akayuri: lazy(() => import('./AkayuriNightblade').then(m => (scene, kit) => new m.AkayuriNightblade(scene, kit))),
  hagure: lazy(() => import('./HagureSnapBite').then(m => (scene, kit) => new m.HagureSnapBite(scene, kit))),
  hisame: lazy(() => import('./HisameWhiteoutGlassCoffin').then(m => (scene, kit) => new m.HisameWhiteoutGlassCoffin(scene, kit))),
  mizuhiki: lazy(() => import('./MizuhikiGRAPPLE').then(m => (scene, kit) => new m.MizuhikiGRAPPLE(scene, kit))),
  'shibuichi': lazy(() => import('./ShibuichiBastion').then(m => (scene, kit) => new m.ShibuichiBastion(scene, kit))),
  'rakucho': lazy(() => import('./RakuchoTendrils').then(m => (scene, kit) => new m.RakuchoTendrils(scene, kit))),
  irbis: lazy(() => import('./IrbisBaredFangs').then(m => (scene, kit) => new m.IrbisBaredFangs(scene, kit))),
  shidare: lazy(() => import('./ShidareSteelPetalCut').then(m => (scene, kit) => new m.ShidareSteelPetalCut(scene, kit))),
  hinomoto: lazy(() => import('./HinomotoBlaze').then(m => (scene, kit) => new m.HinomotoBlaze(scene, kit))),
  amagoi: lazy(() => import('./AmagoiGravity').then(m => (scene, kit) => new m.AmagoiGravity(scene, kit))),
  'shakudo': lazy(() => import('./ShakudoAlchemy').then(m => (scene, kit) => new m.ShakudoAlchemy(scene, kit))),
  hikui: lazy(() => import('./HikuiWitchfire').then(m => (scene, kit) => new m.HikuiWitchfire(scene, kit))),
  tokan: lazy(() => import('../vfx/engine/pilots/tokan').then(m => (scene, kit) => m.tokanSignature(scene, kit))),
  strappado: lazy(() => import('./StrappadoStrings').then(m => (scene, kit) => new m.StrappadoStrings(scene, kit))),
  unari: lazy(() => import('./UnariElastic').then(m => (scene, kit) => new m.UnariElastic(scene, kit))),
  barrow: lazy(() => import('./BarrowEmperor').then(m => (scene, kit) => new m.BarrowEmperor(scene, kit))),
  sashigane: lazy(() => import('./SashiganeRule').then(m => (scene, kit) => new m.SashiganeRule(scene, kit))),
  gosu: lazy(() => import('./GosuRestoration').then(m => (scene, kit) => new m.GosuRestoration(scene, kit))),
  kusushi: lazy(() => import('./KusushiStrength').then(m => (scene, kit) => new m.KusushiStrength(scene, kit))),
  hakushi: lazy(() => import('./HakushiOldLion').then(m => (scene, kit) => new m.HakushiOldLion(scene, kit))),
  suzuran: lazy(() => import('./SuzuranResonance').then(m => (scene, kit) => new m.SuzuranResonance(scene, kit))),
  wataame: lazy(() => import('./WataameSilverSoul').then(m => (scene, kit) => new m.WataameSilverSoul(scene, kit))),
  senko: lazy(() => import('./SenkoGlint').then(m => (scene, kit) => new m.SenkoGlint(scene, kit))),
  buna: lazy(() => import('./BunaOni').then(m => (scene, kit) => new m.BunaOni(scene, kit))),
  oyashio: lazy(() => import('./OyashioCurrent').then(m => (scene, kit) => new m.OyashioCurrent(scene, kit))),
  adad: lazy(() => import('./AdadThunder').then(m => (scene, kit) => new m.AdadThunder(scene, kit))),
  shijima: lazy(() => import('./ShijimaSnowfall').then(m => (scene, kit) => new m.ShijimaSnowfall(scene, kit))),
  akaito: lazy(() => import('./AkaitoShade').then(m => (scene, kit) => new m.AkaitoShade(scene, kit))),
  tempo: lazy(() => import('./TempoDarkSpark').then(m => (scene, kit) => new m.TempoDarkSpark(scene, kit))),
  mikage: lazy(() => import('./MikageHacklesUp').then(m => (scene, kit) => new m.MikageHacklesUp(scene, kit))),
  tancho: lazy(() => import('./TanchoPhosphor').then(m => (scene, kit) => new m.TanchoPhosphor(scene, kit))),
  bellows: lazy(() => import('./BellowsStoked').then(m => (scene, kit) => new m.BellowsStoked(scene, kit))),
  strix: lazy(() => import('./StrixBearpawCut').then(m => (scene, kit) => new m.StrixBearpawCut(scene, kit))),
};
/** A fighter's own module fetched ahead without building it (main.ts: at idle once the home is up, and as a fighter
 *  is picked there), so a room that has them finds it in. Before the Armory wraps the factories. */
const prefetchers = new Map(Object.entries(factories).flatMap(([id, factory]) => { const module = (factory as { prefetch?: () => Promise<unknown> }).prefetch; return module ? [[id, module] as const] : []; }));
export const prefetchSignature = (id: FighterId) => { void prefetchers.get(id)?.().catch(() => {}); };
// The Armory casting: fighters drawn from src/engine/vfx/casting.json (rollout.json's live list in every build, its preview
// rollout besides in VITE_ARMORY builds).
wireArmory(factories);

/** A content pack's slot marked `quiet` has none while the pack is on (src/engine/packs): its moves then draw the
 *  common effects CombatEffects keeps for fighters without one. */
export const hasRosterSignature = (id: string | undefined, slot?: string, branch?: string, player?: string): boolean =>
  id !== undefined && ((Object.hasOwn(factories, id) && !packQuiets(id) && signatureCovers(id, slot, branch)) || fxDraws(id, slot, branch, player));

/** New roster effects allocate only for fighters in the loaded room. Leaving
 * a room retires absent pools, so browsing the roster cannot accumulate every
 * character's meshes/materials. Combat events remain simulation-owned. */
export class RosterSignatureSet {
  private readonly active = new Map<FighterId, Signature>();
  /** The baseline staging of the room's WIP fighters whose modules do not stage their own moves (StagedMoves): the
   *  charge, the light, the blast and the burn every move wants, whoever draws its body. Beside `active`, never in it:
   *  it is not a signature, and `hasRosterSignature` does not know it. */
  private readonly staged = new Map<FighterId, StagedMoves>();
  /** A Forge kit's Armory effects, for any fighter (render/vfx/armory/forgeFx.ts). */
  private readonly fx: ForgeFxDirector;
  constructor(private readonly scene: THREE.Scene, private readonly kit: VfxKit) { this.fx = new ForgeFxDirector(scene, kit); }

  async load(ids: readonly FighterId[]): Promise<void> {
    const wanted = new Set(ids);
    for (const [id, effect] of this.active) {
      if (wanted.has(id)) continue;
      effect.dispose();
      this.active.delete(id);
    }
    // (The room's new ones before the last room's are let go: the stage they share is then never dropped and rebuilt
    // between two rooms that both use it.)
    for (const id of wanted) if (stagedBaseline(id) && !this.staged.has(id)) this.staged.set(id, new StagedMoves(id, this.scene, this.kit));
    for (const [id, staging] of this.staged) if (!wanted.has(id)) { staging.dispose(); this.staged.delete(id); }
    const loads: Promise<unknown>[] = [];
    for (const id of wanted) {
      const factory = hasRosterSignature(id) ? factories[id] : undefined;
      if (!factory) continue;
      let effect = this.active.get(id);
      if (!effect) {
        effect = factory(this.scene, this.kit);
        this.active.set(id, effect);
      }
      loads.push(effect.load(ids));
    }
    await Promise.all(loads);
  }

  /** The Armory effects the room's castings draw as built (CastingSignature.armoryIds), for `retainEffects`. */
  castingEffects(): Set<string> {
    const out = new Set<string>();
    for (const signature of this.active.values()) for (const id of (signature as { armoryIds?: readonly string[] }).armoryIds ?? []) out.add(id);
    return out;
  }
  /** Rooms past let go, as a room is entered: every Armory effect type but `keep` and what this room's castings draw. */
  retainEffects(keep: ReadonlySet<string>): string[] { return this.fx.retain(new Set([...keep, ...this.castingEffects()])); }

  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>): void {
    // Removal/cancellation can concern a victim of a different fighter type.
    // Each effect filters its own casts but must also see those lifecycle events.
    // A move its thrower's Forge kit draws with an Armory effect is left out of the thrower's own module.
    const drawnByKit = this.fx.covers(event, fighters) ? event.fighter : undefined;
    for (const [id, effect] of this.active) if (id !== drawnByKit) effect.handle(event, fighters);
    if (event.fighter && event.fighter !== drawnByKit) this.staged.get(event.fighter)?.handle(event, fighters);
    this.fx.handle(event, fighters);
  }
  /** A presentation already selected by its owner (such as AreaTelegraph).
   * Do not also arm the Forge cue director: it owns ordinary move cues, not area zones. */
  handleOwn(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>): void {
    if (event.fighter) this.active.get(event.fighter)?.handle(event, fighters);
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>): void {
    for (const effect of this.active.values()) effect.update(time, fighters, flights);
    for (const staging of this.staged.values()) staging.update(time, fighters, flights);
    this.fx.update(time, fighters, flights);
  }
  prepareContact(event:CombatEvent,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>):void {if(this.fx.covers(event,fighters))return;this.active.get(event.fighter as FighterId)?.prepareContact?.(event,fighters,flights);}
  reset(): void { for (const effect of this.active.values()) effect.reset(); for (const staging of this.staged.values()) staging.reset(); this.fx.reset(); }
  dispose(): void {
    for (const effect of this.active.values()) effect.dispose();
    this.active.clear();
    for (const staging of this.staged.values()) staging.dispose();
    this.staged.clear();
    this.fx.dispose();
  }
}
