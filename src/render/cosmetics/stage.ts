/** A fighter on a small stage of their own, wearing what they are given: the
 *  shop's picture of an item (src/ui/shop), and the bench the cosmetics are
 *  tuned on (scripts/economy/cosmetics_lab.html). The fighter is built the way
 *  the game builds one and drawn through the game's own bloom and final pass
 *  with a stage's look, so what is shown is what a match shows. One fighter's
 *  model is loaded at a time - not the roster. */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { FIGHTERS } from '../../config';
import type { AttackSlot, FighterId, PlayerState } from '../../game/types';
import { MOVES } from '../../game/moves';
import type { StageId } from '../../game/stages';
import type { Worn } from '../../game/economy/catalog';
import { outfitFor } from '../../game/economy/outfits';
import { Fighter, bindClips } from '../Fighter';
import { IDLE_PROFILES } from '../idle/profile';
import { LookBloomPass, LookFinalPass } from '../look/LookPost';
import { lookFor } from '../look/stageLooks';
import { Cosmetics } from './Cosmetics';
import { setSkinResolution } from './skins';
import { auraShared } from './auras';

const state = (fighter: FighterId): PlayerState => ({ id: 'stage', name: 'Stage', fighter, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0,
  action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });

const _eye = new THREE.Vector3();

export interface StageOptions {
  /** The look it is lit and graded with (a stage's). */
  look?: StageId;
  /** What stands behind the fighter: a colour as the screen shows it (sRGB). */
  paper?: number;
  /** Frames drawn a second at most. */
  fps?: number;
}

export class FighterStage {
  readonly canvas: HTMLCanvasElement;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, .1, 60);
  readonly cosmetics = new Cosmetics(this.scene);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly loader = new GLTFLoader();
  /** Bodies, by their file (a fighter's own, or an outfit's). */
  private readonly sources = new Map<string, Promise<GLTF>>();
  private fighter?: Fighter;
  /** What stands on the stage: the fighter, and the outfit they are drawn in. */
  private shown?: string;
  private ticket = 0;
  private frame = 0;
  private last = 0;
  private time = 0;
  private readonly body: PlayerState = state('konta');
  private height = 1.75;
  /** How close the camera stands (1: the whole fighter, 2: twice as near) and the height it looks at, as a share of the fighter's. */
  zoom = 1; level = .53;
  /** How far the camera stands above what it looks at, as a share of how far off it stands (0: level; a kill
   *  effect is on the ground and is looked down on, as the game's own camera does). */
  lift = 0;
  /** What must be seen round the fighter, in metres across and as a share of their height (the camera stands back until it all fits). */
  span = { across: 1.4, tall: 1.15 };
  aim() {
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const distance = Math.max(this.height * this.span.tall / 2 / tan, this.span.across / 2 / (tan * this.camera.aspect)) / this.zoom;
    this.camera.position.set(0, this.height * (this.level + .03) + distance * this.lift, distance); this.camera.lookAt(0, this.height * this.level, 0);
  }
  dash = false;
  /** How far the bench's dash goes (m). */
  dashReach = 3.6;
  /** The shop's picture of what the run moves: kills round the fighter every so often for a kill effect (every
   *  third a whole one), the fighter awakened for a form, a knockout count for Living Ink, a style for Rising Spirit.
   *  `cycle`: Living Ink and Rising Spirit go through their stages, a few seconds each. */
  show_ = { kills: false, awake: false, awakeCycle: false, cycle: false, count: 0, style: 0 };
  /** The bench's moves: the fighter throws these in turn, a beat apart (an outfit's own fight set, seen). */
  moves: PlayerState['action'][] = [];
  private moveAt = 0; private moveN = 0;
  private nextKill = 0;
  private killN = 0;
  /** The fighter turns slowly, to be seen all round; 0 stands still. */
  spin = .35;
  yaw = .5;

  constructor(private host: HTMLElement, private readonly options: StageOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.canvas = this.renderer.domElement;
    host.append(this.canvas);
    const look = lookFor(options.look ?? 'harbor');
    // The paper behind the fighter, as the final pass will show it (it multiplies the exposure back in).
    this.scene.background = new THREE.Color(options.paper ?? 0xffffff).multiplyScalar(1 / Math.max(.2, look.exposure));
    this.scene.add(new THREE.HemisphereLight(look.hemi.sky, look.hemi.ground, look.hemi.intensity));
    // (The fighters' shader takes the first directional light as the key and the second as the fill.)
    const key = new THREE.DirectionalLight(look.key.color, look.key.intensity); key.position.set(-.45, .8, .55).multiplyScalar(10); this.scene.add(key);
    const fill = new THREE.DirectionalLight(look.fill.color, look.fill.intensity); fill.position.set(.7, .3, .4).multiplyScalar(10); this.scene.add(fill);
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new LookBloomPass(), final = new LookFinalPass();
    Object.assign(bloom.bloom, { threshold: look.bloom.threshold, knee: look.bloom.knee, radius: look.bloom.radius, strength: look.bloom.strength });
    final.bloom = bloom; final.setGrade(look); final.uniforms.uVignette.value = 0;
    this.composer.addPass(bloom); this.composer.addPass(final);
    this.resize();
    this.watcher = new ResizeObserver(() => this.resize());
    this.watcher.observe(host);
  }
  private readonly watcher: ResizeObserver;

  /** The stage fitted to its host. */
  resize() {
    const w = Math.max(2, this.host.clientWidth), h = Math.max(2, this.host.clientHeight);
    this.renderer.setSize(w, h, false); this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.pixels = h * this.renderer.getPixelRatio();
    this.aim();
  }
  private pixels = 1;
  /** The stage's picture moved into another element (the shop redraws the panel it sits in). */
  moveTo(host: HTMLElement) {
    if (host === this.host && this.canvas.parentElement === host) return;
    this.watcher.unobserve(this.host);
    this.host = host; host.append(this.canvas);
    this.watcher.observe(host); this.resize();
  }

  /** A body: the fighter's own (its idle clips bound on), or an outfit's (which carries its own clips). */
  private source(id: FighterId, model?: string) {
    const url = model ?? FIGHTERS[id].model;
    let source = this.sources.get(url);
    if (!source) {
      source = (async () => {
        const gltf = await this.loader.loadAsync(url), idle = model ? undefined : IDLE_PROFILES[id]?.model;
        if (idle) try { const clips = bindClips(gltf.scene, (await this.loader.loadAsync(idle)).animations, FIGHTERS[id].name), names = new Set(clips.map(clip => clip.name)); gltf.animations = [...gltf.animations.filter(clip => !names.has(clip.name)), ...clips]; } catch { /* The body's own idle stands. */ }
        return gltf;
      })();
      this.sources.set(url, source);
      // (Three bodies are kept: the shop is looked through one fighter at a time, and an outfit or two of theirs.)
      for (const old of [...this.sources.keys()].slice(0, -3)) this.sources.delete(old);
    }
    return source;
  }

  /** A fighter on the stage, wearing this. */
  async show(id: FighterId, worn: Worn) {
    const ticket = ++this.ticket;
    // In the outfit they wear for this fighter, if any (another body, or a look on their own).
    const outfitId = worn.outfits?.[id], outfit = outfitFor(outfitId, id), key = `${id}:${outfit ? outfitId : ''}`;
    if (this.shown !== key) {
      const gltf = await this.source(id, outfit?.model);
      if (ticket !== this.ticket) return;
      this.fighter?.group.removeFromParent(); this.fighter?.dispose();
      Object.assign(this.body, state(id));
      this.fighter = new Fighter(this.body, gltf, false, undefined, outfit ? outfitId : undefined);
      this.fighter.targetPoint = new THREE.Vector3(0, 1.3, 6); this.fighter.targetDistance = 6;
      this.scene.add(this.fighter.group);
      this.shown = key;
      this.height = (outfit?.model ? outfit.height : undefined) ?? FIGHTERS[id].height ?? 1.75;
      this.aim();
    }
    this.cosmetics.wear('stage', worn, this.height, new THREE.Color(FIGHTERS[id].color).getHex());
    this.start();
  }

  start() {
    if (this.frame) return;
    this.last = performance.now();
    const step = (now: number) => {
      this.frame = requestAnimationFrame(step);
      const dt = Math.min(.05, (now - this.last) / 1000);
      if (dt < 1 / (this.options.fps ?? 60) - .002) return;
      this.last = now; this.draw(dt);
    };
    this.frame = requestAnimationFrame(step);
  }
  stop() { cancelAnimationFrame(this.frame); this.frame = 0; }

  /** One frame (the lab calls this itself to draw at a chosen moment). */
  draw(dt: number) {
    if (!this.fighter) return;
    this.time += dt; this.yaw += this.spin * dt;
    this.body.yaw = this.yaw;
    // A dash, for the bench: across the stage and back, at a dash's speed, with a rest between.
    if (this.dash) { const beat = this.time % 1.6, across = beat < .22 ? beat / .22 : beat < .8 ? 1 : beat < 1.02 ? 1 - (beat - .8) / .22 : 0; this.body.x = (across * across * (3 - 2 * across) - .5) * this.dashReach; }
    if (this.moves.length) {
      // (Each at its own length, as the fight times it, and a beat between.)
      if (this.time >= this.moveAt) {
        const slot = this.moves[this.moveN++ % this.moves.length], length = MOVES[this.body.fighter]?.[slot as AttackSlot]?.duration ?? 1.4;
        this.moveAt = this.time + length + .8; this.body.action = slot; this.body.actionStarted = this.time; this.body.actionDuration = length;
      }
      const into = (this.time - this.body.actionStarted) / this.body.actionDuration;
      if (into >= 1 && this.body.action !== 'idle') this.body.action = 'idle';
      this.body.actionTime = Math.min(1, Math.max(0, into));
    }
    this.fighter.update(dt, this.body, true, dt);
    this.scene.updateMatrixWorld();
    // (What a kill effect letters faces the camera, as the game's does.)
    this.camera.getWorldDirection(_eye); this.cosmetics.eye = Math.atan2(_eye.x, _eye.z);
    this.demo();
    // (The marks' sizes are shared with the game's own layer: set for this picture, as it is drawn.
    // A small picture of a fighter has its marks drawn as fine as a full frame's would be on them.)
    setSkinResolution(this.pixels * 1.6); auraShared.uAuraHeight.value = this.pixels;
    this.cosmetics.update(this.time, dt);
    this.composer.render(dt);
  }

  /** What the run would move, played on the stage (show_). */
  private demo() {
    const d = this.show_, t = this.time;
    // Living Ink: sketched, inked, in colour, gilded, three seconds each; Rising Spirit from D to SSS and back.
    const stage = Math.floor(t / 3) % 4, kills = d.cycle ? [0, 100, 500, 2000][stage] : d.count;
    const style = d.cycle ? Math.round(3 - 3 * Math.cos(t / 9 * Math.PI * 2)) : d.style;
    // (A form: awake four seconds in seven, its burst as it comes on.)
    this.cosmetics.react('stage', { kills, style, awake: d.awake || (d.awakeCycle && t % 7 > 3) });
    if (!d.kills || t < this.nextKill) return;
    this.nextKill = t + .75;
    // Round the fighter, in front more than behind, the camera's side.
    const a = (this.killN * 2.4 + .6) % (Math.PI * 1.4) - Math.PI * .7, r = 1.3 + (this.killN % 3) * .5;
    this.cosmetics.killed('stage', Math.sin(a) * r, 0, Math.cos(a) * r * .6 + .4, ++this.killN % 3 === 0);
  }

  dispose() {
    this.stop(); this.ticket++;
    this.watcher.disconnect();
    this.cosmetics.clear();
    this.fighter?.dispose();
    this.composer.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
