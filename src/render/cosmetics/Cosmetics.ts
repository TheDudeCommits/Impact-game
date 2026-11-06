import * as THREE from 'three';
import type { Worn } from '../../game/economy/catalog';
import { CELESTIAL, LIVING_STAGES, ONI, SKIN, livingStage, skinMaterial, skinShared, skinUniforms, type SkinUniforms } from './skins';
import { auraShared, makeAura, type Aura } from './auras';
import { makeTrail, type Trail } from './trails';
import { makeKnockout, type Effect } from './knockouts';
import { makeKillFx, type KillFx } from './kills';
import { makeBurst } from './bursts';

/** What a form draws its fighter as, while they are awakened (skins.ts). */
const FORM_SKIN: Record<string, number> = { 'form-oni': ONI, 'form-celestial': CELESTIAL, 'form-negative': SKIN['skin-negative'] };
/** Seconds Living Ink takes to climb a fighter as it changes. */
const LIVING_CLIMB = 1.3;
/** A kill effect is played whole at most this often for one fighter (seconds), whatever else says it should be. */
const FULL_GAP = .22;

interface Wearer {
  id: string;
  worn: Worn;
  /** Their own colour (an afterimage is drawn in it). */
  tint: THREE.Color;
  skin: SkinUniforms;
  aura?: Aura; auraId?: string;
  trail?: Trail; trailId?: string;
  /** How fast they are moving (m/s), from where they were a frame ago. */
  speed: number; was: THREE.Vector3;
  height: number;
  /** Their bodies in the scene now (looked for again every quarter second: fighters come, go and change form). */
  bodies: THREE.Object3D[];
  /** Materials that already carry the skin stage. */
  dressed: WeakSet<THREE.Material>;
  nextLook: number;
  /** Where they stand (their feet, under their hips), and whether they are in the scene. */
  at: THREE.Vector3; seen: boolean;
  /** Each body's hips: a stance can stand well off its body's own origin, and an aura goes round the fighter. */
  hips: WeakMap<THREE.Object3D, THREE.Object3D | null>;
  /** What the run says of them (react): knockouts this run, their style's rank (0-6), whether they are awakened. */
  kills: number; style: number; awake: boolean;
  /** Living Ink: the stage reached, the one it was, and when it changed. */
  stage: number; stageFrom: number; stageAt: number;
  /** A form's own aura, while they are awakened in it. */
  formAura?: Aura; formAuraId?: string;
  /** Their kill effect: the last kill, kills in this quick run of them, all of them, and the last whole one. */
  lastKill: number; burst: number; count: number; lastFull: number;
}
const _hips = new THREE.Vector3();

export class Cosmetics {
  private readonly wearers = new Map<string, Wearer>();
  /** The fighter this page plays (their knockout effect is the one the layer plays). */
  self?: string;
  constructor(readonly scene: THREE.Scene) {}
  /** What a fighter has on, as they were last given it. */
  wornBy(id: string | undefined): Worn | undefined { return id ? this.wearers.get(id)?.worn : undefined; }

  /** What a fighter has on (their arena id), their height in metres and their own colour. Nothing, or an empty set: everything comes off. */
  wear(id: string, worn: Worn | undefined, height = 1.75, tint = 0xbfe0ff) {
    let wearer = this.wearers.get(id);
    if (!wearer) {
      wearer = { id, worn: {}, tint: new THREE.Color(), skin: skinUniforms(), bodies: [], dressed: new WeakSet(), hips: new WeakMap(), nextLook: 0, at: new THREE.Vector3(), was: new THREE.Vector3(), speed: 0, height, seen: false,
        kills: 0, style: 0, awake: false, stage: 0, stageFrom: 0, stageAt: -99, lastKill: -99, burst: 0, count: 0, lastFull: -99 };
      this.wearers.set(id, wearer);
    }
    wearer.worn = worn ?? {}; wearer.height = height; wearer.tint.set(tint);
    this.skinOf(wearer);
    if (wearer.auraId !== wearer.worn.aura) {
      wearer.aura?.dispose();
      wearer.auraId = wearer.worn.aura; wearer.aura = wearer.auraId ? makeAura(wearer.auraId) : undefined;
      if (wearer.aura) this.scene.add(wearer.aura.root);
    }
    if (wearer.trailId !== wearer.worn.trail) {
      wearer.trail?.dispose();
      wearer.trailId = wearer.worn.trail; wearer.trail = wearer.trailId ? makeTrail(wearer.trailId, wearer.tint) : undefined;
      if (wearer.trail) this.scene.add(wearer.trail.root);
    }
    wearer.nextLook = 0;
  }
  /** A fighter who left: what they wore goes with them. */
  drop(id: string) {
    const wearer = this.wearers.get(id);
    if (!wearer) return;
    wearer.skin.uCosSkin.value = 0;
    wearer.aura?.dispose(); wearer.trail?.dispose(); wearer.formAura?.dispose();
    this.wearers.delete(id);
  }
  clear() {
    for (const id of [...this.wearers.keys()]) this.drop(id);
    for (const effect of this.effects) effect.dispose(); this.effects.length = 0;
    for (const pool of this.pools.values()) pool.fx.dispose(); this.pools.clear();
  }
  /** Whether anyone wears anything, or a one-off is playing (nothing to do otherwise). */
  get worn() { return this.wearers.size > 0 || this.effects.length > 0 || this.pools.size > 0; }

  /** What the run says of a fighter, once a frame: their knockouts this run, their style's rank (0 D - 6 SSS),
   *  whether they are awakened. What they wear that grows with these (Living Ink, Rising Spirit) and their form follow. */
  react(id: string, state: { kills?: number; style?: number; awake?: boolean }) {
    const wearer = this.wearers.get(id);
    if (!wearer) return;
    const awake = !!state.awake, kills = state.kills ?? 0;
    // A new run (or the shop's picture starting again): Living Ink starts over, with no climb.
    if (kills < wearer.kills) { wearer.stage = wearer.stageFrom = livingStage(kills); wearer.stageAt = -99; }
    wearer.kills = kills; wearer.style = state.style ?? 0;
    if (awake !== wearer.awake) {
      wearer.awake = awake;
      // Into the form: a burst of it where they stand.
      if (awake && wearer.worn.form && wearer.seen) this.play(makeBurst(wearer.worn.form, wearer.at, wearer.height, this.clock));
    }
    this.skinOf(wearer);
  }
  /** Told when a fighter's Living Ink reaches a new stage (the HUD letters it for the player's own). */
  onStage?: (id: string, stage: number) => void;

  // ---- kill effects: what the horde does as a fighter who wears one cuts it down ----------------------
  private readonly pools = new Map<string, { fx: KillFx; used: number }>();
  /** The camera's heading, as it last drew (what a kill effect letters faces it). */
  eye = 0;
  /** One the fighter `id` cut down at (x, z), on the ground at y (`big`: an elite or a champion). Plays their
   *  kill effect there - whole for a big one, the third of a quick run of kills or every fifth, else its echo -
   *  and says which, for its sound. Nothing, if they wear none. */
  killed(id: string, x: number, y: number, z: number, big: boolean): { effect: string; full: boolean } | undefined {
    const wearer = this.wearers.get(id), effect = wearer?.worn.kill;
    if (!wearer || !effect) return undefined;
    let pool = this.pools.get(effect);
    if (!pool) {
      const fx = makeKillFx(effect);
      if (!fx) return undefined;
      pool = { fx, used: this.clock }; this.pools.set(effect, pool); this.scene.add(fx.root);
    }
    const now = this.clock;
    wearer.burst = now - wearer.lastKill < .35 ? wearer.burst + 1 : 1; wearer.lastKill = now;
    const full = (big || wearer.burst === 3 || ++wearer.count % 5 === 0) && now - wearer.lastFull >= FULL_GAP;
    if (full) wearer.lastFull = now;
    pool.used = now;
    pool.fx.emit(x, y, z, full, now, this.eye);
    return { effect, full };
  }
  /** Whose kill effect a fighter wears, if any. */
  killEffectOf(id: string) { return this.wearers.get(id)?.worn.kill; }

  /** The skin a fighter is drawn in now: their form's while they are awakened in one, else what they wear -
   *  and Living Ink's stage, climbing to the next as their knockouts reach it. */
  private skinOf(wearer: Wearer) {
    const form = wearer.awake ? wearer.worn.form : undefined;
    const skin = form ? FORM_SKIN[form] ?? 0 : SKIN[wearer.worn.skin ?? ''] ?? 0;
    wearer.skin.uCosSkin.value = skin;
    if (skin !== SKIN['skin-living-ink']) return;
    const stage = livingStage(wearer.kills);
    if (stage !== wearer.stage) {
      wearer.stageFrom = wearer.stage; wearer.stage = stage; wearer.stageAt = this.clock;
      if (stage > wearer.stageFrom) { if (wearer.seen) this.play(makeBurst('skin-living-ink', wearer.at, wearer.height, this.clock, stage)); this.onStage?.(wearer.id, stage); }
    }
  }
  private play(effect: Effect | undefined) { if (effect) { this.scene.add(effect.root); this.effects.push(effect); } }
  /** A fighter's height as they wear things. */
  heightOf(id: string) { return this.wearers.get(id)?.height; }

  // ---- one-offs: what a knockout does -----------------------------------------------------
  private readonly effects: Effect[] = [];
  /** A knockout effect where one fell (x, y, z: their feet; height: theirs), if it is one the layer draws - after `delay` seconds. */
  knockout(id: string, x: number, y: number, z: number, height: number, delay = 0) {
    this.play(makeKnockout(id, new THREE.Vector3(x, y, z), height, this.clock + delay));
  }
  private clock = 0;
  /** Where a fighter who wears something stands, if they are seen (their feet). */
  where(id: string) { const wearer = this.wearers.get(id); return wearer?.seen ? wearer.at : undefined; }

  /** Once a frame, after the scene's own matrices are up to date: `time` in seconds (any steady clock). */
  update(time: number, dt: number) {
    this.clock = time;
    skinShared.uCosTime.value = auraShared.uAuraTime.value = time % 3600;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      if (effect.update(time)) { effect.root.updateMatrixWorld(true); continue; }
      effect.dispose(); this.effects.splice(i, 1);
    }
    // A kill effect nobody has played for half a minute is let go.
    for (const [id, pool] of this.pools) if (time - pool.used > 30) { pool.fx.dispose(); this.pools.delete(id); }
    for (const wearer of this.wearers.values()) {
      if (time >= wearer.nextLook) { wearer.nextLook = time + .25; this.look(wearer); }
      const body = wearer.bodies.find(each => each.visible && each.parent);
      const came = !!body && !wearer.seen;
      wearer.seen = !!body;
      if (body) {
        wearer.was.copy(wearer.at);
        body.getWorldPosition(wearer.at);
        const hips = wearer.hips.get(body);
        if (hips) { hips.getWorldPosition(_hips); wearer.at.x = _hips.x; wearer.at.z = _hips.z; }
        wearer.skin.uCosOrigin.value.copy(wearer.at);
        // (A fighter who has only just appeared has not moved: they were put there.)
        const moved = came || dt <= 0 ? 0 : wearer.at.distanceTo(wearer.was) / dt;
        wearer.speed = moved > 80 ? 0 : wearer.speed + (moved - wearer.speed) * .5;
      }
      // Living Ink's climb (from the stage it was to the one it is: 1 once it has reached the head).
      const live = wearer.skin.uCosLive.value;
      live.set(LIVING_STAGES[wearer.stageFrom], LIVING_STAGES[wearer.stage], Math.min(1, (time - wearer.stageAt) / LIVING_CLIMB), wearer.height);
      // A form's aura while they are awakened in it, in place of what they wear.
      const formAura = wearer.awake && wearer.worn.form ? wearer.worn.form : undefined;
      if (wearer.formAuraId !== formAura) {
        wearer.formAura?.dispose();
        wearer.formAuraId = formAura; wearer.formAura = formAura ? makeAura(formAura) : undefined;
        if (wearer.formAura) this.scene.add(wearer.formAura.root);
      }
      if (wearer.formAura) { wearer.formAura.update(time, dt, wearer.at, wearer.height, wearer.seen); wearer.formAura.root.updateMatrixWorld(true); }
      if (wearer.aura) {
        wearer.aura.level?.(wearer.style / 6);
        wearer.aura.update(time, dt, wearer.at, wearer.height, wearer.seen && !wearer.formAura); wearer.aura.root.updateMatrixWorld(true);
      }
      if (wearer.trail) { wearer.trail.update(time, dt, wearer.at, wearer.height, wearer.speed, wearer.bodies, wearer.seen); wearer.trail.root.updateMatrixWorld(true); }
    }
  }

  /** A fighter's bodies as they are now, and the skin stage on any material of theirs that lacks it. */
  private look(wearer: Wearer) {
    wearer.bodies = this.scene.getObjectsByProperty('name', `fighter-${wearer.id}`);
    for (const body of wearer.bodies) if (!wearer.hips.has(body)) {
      let hips: THREE.Object3D | null = null;
      body.traverse(node => { if (!hips && (node as THREE.Bone).isBone && /hips|pelvis/i.test(node.name)) hips = node; });
      wearer.hips.set(body, hips);
    }
    // (A form is a skin while they are awakened: its fighter's materials carry the stage from the start.)
    if (!SKIN[wearer.worn.skin ?? ''] && !wearer.worn.form) return;
    for (const body of wearer.bodies) body.traverse(node => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!material || wearer.dressed.has(material)) continue;
        wearer.dressed.add(material);
        skinMaterial(material, wearer.skin);
      }
    });
  }
}
