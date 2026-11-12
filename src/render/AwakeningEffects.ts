import * as THREE from 'three';
import { AWAKENINGS, AWAKENING_ENTRY, awakeningSwapAt } from '../game/awakening';
import type { FighterId } from '../game/types';
import { SIGNATURE, involvesLocal } from './signature/context';
import type { CombatEvent } from '../game/types';
import type { Fighter } from './Fighter';
import { VfxKit } from './vfx/VfxKit';
import { faceUpright, onLens } from './lenses';
import { SPRITE, ORIENT } from './vfx/SparkField';
import { AuraShell } from './vfx/AuraShell';
import { LacquerCoat } from './vfx/LacquerCoat';
import { KuonVoid } from './signature/KuonVoid';
import { FeuBleu, LimbFire, ALL_ABLAZE } from './signature/FeuBleu';
import { Setsuna } from './signature/Setsuna';
import { ScrubbedIn } from './signature/ScrubbedIn';
import { PowerUp, boltFor, willStyle, kiColours, powerTint, pressureColours, type Burning, type PowerKind, type PowerStyle } from './vfx/powerup/PowerUp';
import { OWN_ENTRANCES } from '../game/powerUp';
import { PHYSICAL_PRESENCE, standingAura, standingColours } from './standingAura';
import { awakenedPower, shellLook } from './awakenedPower';
import { VFX } from './vfxLevel';
import { originalBurst } from '../originals/akaganeBurst';

/** The aura a transformation burns while it lasts, and the burst it arrives on.
 *
 *  A flame transformation (gold awakening, Kagari's) burns as a shell hugging the
 *  body - see AuraShell - with a few tongues flicking off the crown and the
 *  shoulders, sparks rising off it and a light of its colour on the fighter
 *  and the floor. Bounded instanced geometry otherwise, in the same shape as
 *  the other effect layers, and one shockwave per transformation. Which body
 *  is showing - a replacement rig, a summoned one or the fighter's own - is
 *  decided elsewhere; this is the light around it.
 */
/** A fighter's awakening aura, core then rim: their outfit's, else their fighter's own. */
const auraOf = (fighter: Fighter): readonly [number, number] => typeof fighter.auraColours === 'function' ? fighter.auraColours() : AWAKENINGS[fighter.state.fighter].aura;
/** Transformations drawn entirely by their own layers (signature/), which this one leaves alone. */
const isOwnLayer = (id: FighterId) => OWN_ENTRANCES.has(id);
/** The player's own fighter (not merely one their fight involves). */
const isLocal = (id: string) => SIGNATURE.localId !== undefined && id === SIGNATURE.localId;
/** A form bigger than its fighter powers up in a bigger flame, up to half again. */
const auraScale = (formScale?: number) => THREE.MathUtils.clamp(formScale ?? 1, 1, 1.5);
const powerKind = (id: FighterId): PowerKind => awakenedPower(id).kind;
/** The two colours a fighter's entrance is drawn in - the light drawn in to the chest, the shockwave, the room's grade:
 *  their aura's, except that Will is not their colour but its own (its edge over black). */
const WILL_DARK = 0x14020a;
/** A lightning's colour from an sRGB hex: its hue, as far over the bloom's threshold as the kit's own blue. */
const hdr = (hex: number) => { const c = new THREE.Color(hex); return c.multiplyScalar(2.2 / Math.max(c.r, c.g, c.b, 1e-3)); };

/** Whose awakening is darkness, not light (the dark-magic pass, 31 October 2026): it arrives as Will does - no white flash
 *  and no column of light over them, its own colour's ring and pulse, drawn in dark (critic pass 4: "a bright
 *  white-violet column of light comes down from the sky, which is wrong for dark magic"). */
const DARK_ARRIVAL: ReadonlySet<FighterId> = new Set<FighterId>(['cardo', 'bruin']);

export class AwakeningEffects {
  private flameGeometry = new THREE.PlaneGeometry(1, 1);
  /** An analytic flame tongue on a card, rather than a cone: solid geometry
   *  standing around a fighter reads as scenery, and additive light does not. */
  private flameMaterial = new THREE.ShaderMaterial({
    // Straight alpha, not additive. Bloom runs on linear values with a 1.1
    // threshold, and additive light on top of a bright arena pushes the whole
    // neighbourhood over it - which bleaches whoever is standing behind.
    // forceSinglePass, here and on the wash below, because three draws a
    // transparent double-sided material twice - once as BackSide, once as
    // FrontSide - and each of those is a program of its own, linked the first
    // time it is actually drawn. Compiling it up front cannot help, because
    // the two-sided split only happens at draw. Flat cards and a flat ring have
    // nothing to sort front against back, so one pass is the whole picture.
    transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false,
    // (fade: VISUAL EFFECTS, the level's share of the flames' cover, render/vfxLevel.ts; 1 at Full.)
    uniforms: { clock: { value: 0 }, fade: { value: 1 } },
    // instanceColor is declared by the renderer's own instancing chunk; a
    // second declaration here fails to compile the whole program.
    vertexShader: `varying vec2 p;varying vec3 tint;varying float seed;
      void main(){p=uv;tint=instanceColor;seed=instanceMatrix[3].x*3.1+instanceMatrix[3].y*5.7+instanceMatrix[3].z*4.3;
      gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec2 p;varying vec3 tint;varying float seed;uniform float clock;uniform float fade;
      void main(){
        float sway=sin(p.y*6.5-clock*7.0+seed)*.15*p.y+sin(p.y*15.0+clock*11.0+seed)*.04;
        float width=.36*pow(max(0.0,1.0-p.y),.55)*(1.0+.18*sin(p.y*19.0-clock*8.0+seed));
        float d=abs(p.x-.5-sway);
        float body=(1.0-smoothstep(width*.45,width,d))*smoothstep(0.0,.09,p.y)*(1.0-smoothstep(.72,1.0,p.y));
        float core=(1.0-smoothstep(0.0,width*.45,d))*body;
        // Additive light accumulates twice over: overlapping cards blow out into
        // a white column, and anything the sum pushes past the bloom threshold
        // throws a halo that bleaches whoever is standing behind the fighter.
        gl_FragColor=vec4(mix(tint,vec3(1.0,.97,.88),core*.4),body*.42*fade);
      }`,
  });
  private flames = new THREE.InstancedMesh(this.flameGeometry, this.flameMaterial, 960);
  /** Thin: a shockwave line racing out, not a disc lying under the fighter. */
  private ringGeometry = new THREE.RingGeometry(.9, 1, 64);
  private bursts = new Map<string, { ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; born: number }>();
  private spare: { ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] } = { ring: [] };
  private transform = new THREE.Object3D();
  private colour = new THREE.Color();
  private eye = new THREE.Vector3();
  private readonly lensEye = new THREE.Vector3();
  private seen = new Set<number>();
  private kit: VfxKit;
  private up = new THREE.Vector3(0, 1, 0);
  private shell: AuraShell;
  /** Iron Will, hardened: the black a Dust Sea fighter's fists, shins or blade go while awakened. */
  private coat: LacquerCoat;
  /** The power-up pass: the power-up itself - the ki flame, its lightning, the floor and the break - and the flame a
   *  transformation burns while it lasts. */
  private power: PowerUp;
  /** (Keyed by the two colours as one number: this is asked several times a frame for each awakened fighter, and a
   *  string built each time is garbage each time.) */
  private styles = new Map<Fighter, { key: number; style: PowerStyle }>();
  /** Kuon's awakening has no body of its own and no flames: the TENGAN and
   *  the still field are drawn by their own layer, driven from here. */
  private infinity: KuonVoid;
  private ifrit: FeuBleu;
  /** Round 3b: Kagari's arms and shoulders become fire - the flame shell alone
   *  read as "a flame shell", not as the body itself burning. */
  private emperor: LimbFire;
  /** Setsu's SETSUNA as speed: a lightning trail, on standard joints only. */
  private setsuna: Setsuna;
  /** Round 3b: Ward's awakening on Ward - SHEATH DOME, the membrane, Crossmatch. */
  private room: ScrubbedIn;
  private nextSpark = new Map<Fighter, number>();
  private chest = new THREE.Vector3();
  /** Round 3e (MODELS2): each transformation's beat - the gather from the
   *  event, the burst when the fighter's own entry clock crosses the swap
   *  (awakeningSwapAt), the moment Fighter swaps the hair or the form, so the
   *  flash and the swap land on the same frame. Rewritten in place. */
  private entries = new Map<string, { born: number; fighter: FighterId; burst: boolean; next: number }>();
  private gatherAt = new THREE.Vector3();
  /** What the layer's update cost the CPU over the last 120 frames, for
   *  probes: `ms` is the median, `worst` the slowest (on a loaded machine a
   *  single descheduled frame is most of an average). */
  private cost = new Float32Array(120);
  private costAt = 0;
  get stats() { const sorted = Float32Array.from(this.cost).sort(); return { ms: sorted[sorted.length >> 1], worst: sorted[sorted.length - 1] }; }
  constructor(private scene: THREE.Scene) {
    this.kit = VfxKit.for(scene);
    // A split screen's half: the flame cards turned to its own lens about their upright axis (render/lenses.ts).
    onLens(camera => { if (this.flames.count) faceUpright(this.flames, camera.getWorldPosition(this.lensEye)); });
    this.shell = new AuraShell(scene); this.coat = new LacquerCoat(scene);
    this.power = new PowerUp(scene, this.kit);
    this.infinity = new KuonVoid(scene); this.ifrit = new FeuBleu(scene); this.emperor = new LimbFire(scene, ALL_ABLAZE); this.setsuna = new Setsuna(scene); this.room = new ScrubbedIn(scene);
    this.flames.count = 0; this.flames.setColorAt(0, new THREE.Color(0xffffff));
    this.flames.frustumCulled = false; this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flames.name = 'awakening-aura';
    scene.add(this.flames);
    if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __awakening?: AwakeningEffects }).__awakening = this;
  }

  /** One material definition for both, so they share a compiled program. */
  private wash(colour: number, opacity: number, side: THREE.Side) {
    return new THREE.MeshBasicMaterial({ color: colour, toneMapped: false, transparent: true,
      opacity, depthWrite: false, side, forceSinglePass: true });
  }

  private ring() {
    const ring = this.spare.ring.pop()
      ?? new THREE.Mesh(this.ringGeometry, this.wash(0xffffff, .9, THREE.DoubleSide));
    ring.rotation.x = -Math.PI / 2; ring.visible = true; ring.name = 'awakening-shockwave';
    if (!ring.parent) this.scene.add(ring);
    return ring;
  }
  /** Build the transformation's own geometry before anyone transforms, and
   *  compile it while the loading screen is still up.
   *
   *  The shockwave is the only material in the match that nothing else uses, so
   *  the first awakening of a session was linking its program on the frame it
   *  started - a stall on the exact frame the player pressed for, which reads as
   *  the transformation getting stuck. */
  warmup() {
    this.spare.ring.push(this.ring());
    this.shell.warmup(); this.coat.warmup(); this.infinity.warmup(); this.ifrit.warmup(); this.emperor.warmup(); this.setsuna.warmup(); this.room.warmup();
  }
  hideWarmup() {
    for (const mesh of this.spare.ring) mesh.visible = false;
    this.shell.hideWarmup(); this.coat.hideWarmup(); this.infinity.hideWarmup(); this.ifrit.hideWarmup(); this.emperor.hideWarmup(); this.setsuna.hideWarmup(); this.room.hideWarmup();
  }

  handle(events: readonly CombatEvent[], fighters: ReadonlyMap<string, Fighter>) {
    this.infinity.handle(events, fighters);
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!);
      if (event.kind !== 'awaken' || !event.fighter) continue;
      // EYE OF THE STORM is a staff flourish and gathering weather, drawn by SorayomiWeather - and she is Dust Sea's all the
      // same: its black lightning crackles through her arrival, with nothing else of the standard beat (no floor
      // lifted, no dark, no burst).
      if (isOwnLayer(event.fighter)) {
        const own = fighters.get(event.actorId);
        if (own && powerKind(event.fighter) === 'will') this.power.begin(own, event.serverTime, awakeningSwapAt(event.fighter), AWAKENING_ENTRY, this.styleOf(own), false, 1, isLocal(event.actorId), true);
        continue;
      }
      // The beat starts: the gather now, the burst at the swap (update).
      const entry = this.entries.get(event.actorId);
      if (entry) { entry.born = event.serverTime; entry.fighter = event.fighter; entry.burst = false; entry.next = 0; }
      else this.entries.set(event.actorId, { born: event.serverTime, fighter: event.fighter, burst: false, next: 0 });
      // The room dims toward the aura round the one gathering it, for the
      // player it involves, until a little past the burst.
      const actor = fighters.get(event.actorId);
      if (actor && involvesLocal(event.actorId)) SIGNATURE.screen?.techniqueGrade?.(this.entryColours(actor)[0], .45, awakeningSwapAt(event.fighter) + .25, actor.group.position, 3.2);
      if (actor) {
        const look = AWAKENINGS[event.fighter];
        this.power.begin(actor, event.serverTime, awakeningSwapAt(event.fighter), AWAKENING_ENTRY, this.styleOf(actor), !!look.flames, auraScale(look.formScale), isLocal(event.actorId));
      }
    }
  }

  /** The burst: the shockwave on the floor, the arrival (rings, the column,
   *  rubble, dust, the pulse of light) and, for the player it involves, a
   *  manga impact frame - the fighters drawn as ink for a frame or two, which
   *  is what hides the swap - with speed lines and the edge fringe. */
  private burst(id: string, fighter: FighterId, actor: Fighter, time: number) {
    // (An outfit's own aura where it has one: a blue gold-awakening outfit bursts blue.)
    const [core, rim] = this.entryColours(actor);
    const ring = this.ring();
    ring.material.color.set(core);
    ring.position.copy(actor.group.position).setY(actor.group.position.y + .06);
    const running = this.bursts.get(id);
    if (running) { running.ring.visible = false; this.spare.ring.push(running.ring); }
    this.bursts.set(id, { ring, born: time });
    this.arrival(actor.group.position, time, core, rim, DARK_ARRIVAL.has(fighter) ? 'will' : powerKind(fighter));
    this.power.break(actor, time);
    originalBurst(fighter, actor.group.position, actor.state.yaw, time, this.kit);
    if (involvesLocal(id)) {
      this.chest.copy(actor.group.position).y += 1.2;
      SIGNATURE.screen?.impactFrame?.(.8, this.chest);
      SIGNATURE.screen?.speedLines?.(1);
      SIGNATURE.screen?.chromaticPulse?.(.95);
    }
  }

  /** The gather: aura light drawn in to the chest from all round, faster and
   *  denser toward the burst, and the light at the chest growing. */
  private gather(actor: Fighter, fighter: FighterId, time: number, u: number, density: number) {
    const [core, rim] = this.entryColours(actor), will = powerKind(fighter) === 'will' || DARK_ARRIVAL.has(fighter);
    const p = actor.group.position, kit = this.kit, sp = kit.sparks.spec;
    this.gatherAt.set(p.x, p.y + 1.05, p.z);
    kit.lights.request(this.gatherAt.x, this.gatherAt.y, this.gatherAt.z, core, 1.5 + 5 * u, 3 + 2 * u, 1);
    const count = Math.max(1, Math.round((2 + 4 * u) * Math.max(.35, density)));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - .35) * 1.1, r = 1.3 + Math.random() * .7;
      const x = Math.cos(a) * Math.cos(e) * r, y = Math.sin(e) * r, z = Math.sin(a) * Math.cos(e) * r;
      const life = .16 + Math.random() * .08, k = .92 / life;
      sp.reset(SPRITE.streak, time, life).pos(this.gatherAt.x + x, this.gatherAt.y + y, this.gatherAt.z + z).velocity(-x * k, -y * k, -z * k);
      sp.orient = ORIENT.velocity; sp.sized(.035, .012, .4); sp.stretch = 4; sp.trail = .05; sp.drag = 0; sp.gravity = 0;
      // (Will draws in dark: its edge's colour over black, never a white streak.)
      sp.hot(i % 3 === 0 && !will ? 0xffffff : core, 1.9).cool(rim, will ? .7 : .2); kit.sparks.emit();
    }
  }

  /** The moment of transformation: a shockwave through the air, the floor
   *  thrown up in a ring of rubble and dust, and a column of the aura's light
   *  standing over the fighter for under a second. All of it is spent as it
   *  lands - nothing stays on the floor under them. */
  private arrival(p: THREE.Vector3, time: number, core: number, rim: number, kind: PowerKind = 'plain') {
    const kit = this.kit, sp = kit.sparks.spec;
    // Will is pressure, not light: no white flash and no column standing over them - its own wave (PowerUp.break), the
    // floor thrown up and a pulse of its colour.
    if (kind === 'will') {
      kit.ring(p.x, p.y + 1.1, p.z, .6, 6.5, time, .42, core, rim, .5);
      kit.streaks(p.x, p.y + .8, p.z, { spike: core, rim, light: core, ink: 0 }, kit.n(16, 6), 11, .03, time, this.up, 1.2, 2);
      kit.debris.burst(kit.n(14, 5), p.x, p.y, p.z, 0, 1, 0, 6.5, 1.15, .12, p.y, 2);
      kit.dustRing(p.x, p.y, p.z, 10, .5, 5.5, .6, time, .6);
      kit.pulse(p.x, p.y + 1.5, p.z, core, 2.2, 8, time, .45, 2.5);
      return;
    }
    // Pressure's column is its own (PowerUp: the pillar into the sky), and chi, hex energy and Aura stand none: the
    // shock through the air, the floor thrown up and the pulse of its colour, and no white column over it.
    if (kind === 'pressure' || kind === 'chi' || kind === 'cursed' || kind === 'aura') {
      kit.ring(p.x, p.y + 1.1, p.z, .6, 6.5, time, .42, 0xffffff, core, .12);
      sp.reset(SPRITE.core, time, .09).pos(p.x, p.y + 1.1, p.z).sized(.7, 1.6, .3).hot(0xffffff, 2).cool(core); kit.sparks.emit();
      kit.streaks(p.x, p.y + .8, p.z, { spike: 0xffffff, rim: core, light: core, ink: 0 }, kit.n(20, 8), 11, .03, time, this.up, 1.2, 2);
      kit.debris.burst(kit.n(14, 5), p.x, p.y, p.z, 0, 1, 0, 6.5, 1.15, .12, p.y, 2);
      kit.dustRing(p.x, p.y, p.z, 10, .5, 5.5, .6, time, .6);
      kit.pulse(p.x, p.y + 1.5, p.z, core, 3, 9, time, .45, 2.5);
      return;
    }
    // Round 3e (MODELS2): it lands on the burst now, with the lens pressed in
    // close (awakenBeat), so it is punchier and shorter: the white core a
    // flash rather than a 2.6 m disc held over the fighter, the column a
    // third of a second, the room's light a pulse - the rings, streaks,
    // rubble and dust carry the blast out. (It whited out the screen for a
    // third of a second at that range.)
    kit.ring(p.x, p.y + 1.1, p.z, .6, 6.5, time, .42, 0xffffff, core, .12);
    kit.ring(p.x, p.y + 1.1, p.z, .4, 4.2, time + .06, .38, core, rim, .08);
    sp.reset(SPRITE.core, time, .09).pos(p.x, p.y + 1.1, p.z).sized(.7, 1.6, .3).hot(0xffffff, 2.2).cool(core); kit.sparks.emit();
    // The column: a broad soft pillar and a white-hot line inside it.
    sp.reset(SPRITE.glow, time, .38).pos(p.x, p.y + 5.4, p.z).sized(.7, 1.1, .3).hot(core, 1.2); sp.orient = ORIENT.axial; sp.axis(0, 1, 0); sp.stretch = 4.2; kit.sparks.emit();
    sp.reset(SPRITE.glow, time, .26).pos(p.x, p.y + 5.4, p.z).sized(.2, .32, .3).hot(0xffffff, 1.6); sp.orient = ORIENT.axial; sp.axis(0, 1, 0); sp.stretch = 13; kit.sparks.emit();
    kit.streaks(p.x, p.y + .8, p.z, { spike: 0xffffff, rim: core, light: core, ink: 0 }, kit.n(20, 8), 11, .03, time, this.up, 1.2, 2);
    kit.debris.burst(kit.n(14, 5), p.x, p.y, p.z, 0, 1, 0, 6.5, 1.15, .12, p.y, 2);
    kit.dustRing(p.x, p.y, p.z, 10, .5, 5.5, .6, time, .6);
    kit.pulse(p.x, p.y + 1.5, p.z, core, 3.2, 9, time, .45, 2.5);
  }

  /** A fighter's power, in their outfit's colours where it has them (a blue gold-awakening outfit burns blue). */
  private styleOf(fighter: Fighter): PowerStyle {
    const forced = import.meta.env?.DEV ? (globalThis as unknown as { __auraColours?: readonly [number, number] }).__auraColours : undefined;
    const power = awakenedPower(fighter.state.fighter);
    // (The power's own colours where its row names them - a captain's pressure - else the fighter's aura, their outfit's.)
    const [core, rim] = forced ?? power.colours ?? auraOf(fighter), key = core * 0x1000000 + rim;
    let cached = this.styles.get(fighter);
    if (!cached || cached.key !== key) {
      cached = { key, style: { kind: power.kind, colours: power.kind === 'pressure' || power.kind === 'cursed' ? pressureColours(core, rim) : kiColours(core, rim),
        bolt: power.arcs === undefined ? boltFor(core) : hdr(power.arcs), electric: !!power.electric, arcs: power.arcs !== undefined,
        will: power.kind === 'will' ? willStyle(power.edge, !!power.sovereign) : undefined,
        motes: power.motes ? { kind: power.motes[0], core: power.motes[1], rim: power.motes[2] } : undefined, ...powerTint(core, rim) } };
      this.styles.set(fighter, cached);
    }
    return cached.style;
  }
  /** What `burning` answers with, rewritten in place: PowerUp reads it before it asks about the next fighter. */
  private burn: Burning = { style: undefined as unknown as PowerStyle, scale: 1, strength: 0, local: false };
  private entry: [number, number] = [0, 0];
  /** The entrance's two colours for `fighter` (see WILL_DARK). Rewritten in place: read it before the next call. */
  private entryColours(fighter: Fighter): readonly [number, number] {
    const style = this.styleOf(fighter);
    if (style.will) { this.entry[0] = style.will.hex; this.entry[1] = WILL_DARK; return this.entry; }
    // (A power with colours of its own - a captain's pressure - arrives in them: Nigo's in red over black.)
    if (!awakenedPower(fighter.state.fighter).colours) return auraOf(fighter);
    this.entry[0] = style.tint ?? 0xffffff; this.entry[1] = style.shade ?? 0;
    return this.entry;
  }

  /** What a running transformation burns as, or null: ki (its light and crackle; the big flame is the transformation's
   *  alone) only where the shell stands (a transformation with no body of its own), Will round everyone of Dust Sea -
   *  Sorayomi too, whose weather is her entrance and stands over her, not instead of it - nothing for a plain power. */
  private burning(fighter: Fighter, time: number) {
    const state = fighter.state;
    if (!state.awakened || !state.alive) return null;
    const look = AWAKENINGS[state.fighter], power = awakenedPower(state.fighter), kind = power.kind;
    if (!power.motes && power.arcs === undefined && (kind === 'plain' || (kind === 'ki' && standingAura(state.fighter) === undefined) || (kind !== 'will' && isOwnLayer(state.fighter)))) return null;
    // (A power worn as a shell stands only where the shell does: the fox and the Guardian wear no chi over them.)
    if ((kind === 'chi' || kind === 'cursed' || kind === 'aura' || kind === 'pressure') && !power.shell && !power.motes && power.arcs === undefined) return null;
    const burn = this.burn;
    burn.style = this.styleOf(fighter); burn.scale = auraScale(look.formScale); burn.strength = THREE.MathUtils.clamp((state.awakenedUntil ?? 0) - time, 0, 1); burn.local = isLocal(state.id);
    return burn;
  }

  update(time: number, _dt: number, fighters: ReadonlyMap<string, Fighter>, density: number, camera?: THREE.Camera) {
    const started = performance.now();
    let count = 0;
    for (const [id, entry] of this.entries) {
      const actor = fighters.get(id);
      const swap = awakeningSwapAt(entry.fighter);
      const inEntry = actor?.state.action === 'awaken';
      const elapsed = actor && inEntry ? actor.state.actionTime * actor.state.actionDuration : time - entry.born;
      if (!actor || elapsed > AWAKENING_ENTRY + .3 || elapsed < -.5) { if (!actor || time - entry.born > 3) this.entries.delete(id); if (actor && !inEntry) this.entries.delete(id); continue; }
      if (!entry.burst && elapsed >= swap) { entry.burst = true; this.burst(id, entry.fighter, actor, time); }
      else if (!entry.burst && time >= entry.next) { entry.next = time + .025; this.gather(actor, entry.fighter, time, THREE.MathUtils.clamp(elapsed / swap, 0, 1), density); }
    }
    this.flameMaterial.uniforms.clock.value = time; this.flameMaterial.uniforms.fade.value = VFX.aura;
    const eye = camera ? camera.getWorldPosition(this.eye) : undefined;
    const budget = Math.round(960 * Math.max(.3, density));
    this.shell.begin(); this.coat.begin();
    for (const fighter of fighters.values()) {
      const state = fighter.state;
      // (Six fighters' own layers were skipped here - the Empress, Kuzu, Shakugo, Shanxiao, Pyroclast, Full Beam - and, filmed
      // on launch night, those layers left nothing on the awakened body. Who stands the aura is standingAura's to say.)
      if (!state.awakened || !state.alive) continue;
      // (The fighter's own transformation, burning in its outfit's colours where it has them.)
      const def = AWAKENINGS[state.fighter], aura = standingColours(state.fighter, auraOf(fighter));
      const left = (state.awakenedUntil ?? 0) - time;
      const strength = THREE.MathUtils.clamp(left, 0, 1) * Math.max(.35, density);
      const base = fighter.group.position;
      if (PHYSICAL_PRESENCE.has(state.fighter)) {
        if (state.grounded !== false && left > 0 && time >= (this.nextSpark.get(fighter) ?? 0)) {
          this.nextSpark.set(fighter, time + .28);
          this.kit.dustRing(base.x, base.y, base.z, 6, .38, 1.5, .42, time, .7);
        }
        continue;
      }
      // Only where the transformation has no body of its own. A fox, a Guardian,
      // six arms and a pair of burning legs are each the transformation; flames
      // around them read as an effect stuck on rather than as power. Launch night: that is every definition that
      // burns (`flames`) and, at the shop's strength, the work-in-progress fighters who wake in their own body, who
      // stood nothing once the burst had passed (standingAura.ts).
      const power = awakenedPower(state.fighter), glow = standingAura(state.fighter), worn = power.shell;
      // Round 3e: a low burn while the power gathers; the flare on the burst.
      const gathering = state.action === 'awaken' && state.actionTime * state.actionDuration < awakeningSwapAt(state.fighter);
      // The lacquer coat comes up with the swap, in a breath, and goes as the window gutters out.
      if (power.coat && !gathering) {
        const since = state.action === 'awaken' ? state.actionTime * state.actionDuration - awakeningSwapAt(state.fighter) : 1;
        this.coat.draw(fighter, time, THREE.MathUtils.clamp(left, 0, 1) * THREE.MathUtils.clamp(since / .18, 0, 1), power.coat, this.styleOf(fighter).will?.glow ?? this.colour.set(aura[1]));
      }
      if (glow === undefined || !worn) continue;
      // A shop fighter's shell fades as the lens comes in on him: in an ultimate's close shots it drew over the body
      // itself and washed him out (the blind critics, 3 October: "a white blob at the key hit", eight of thirteen; seen
      // in Chrome with each suspect turned off in turn - the shell alone did it). Through the awakening only to a
      // fifth: faded away there as well, the critics saw "nothing burns on his body". The Last Sun pair's are as they were.
      const fade = (def.flames && def.auraGlow === undefined) || !eye || (state.action !== 'ultimate' && state.action !== 'awaken') ? 1
        : THREE.MathUtils.smoothstep(eye.distanceTo(this.chest.set(base.x, base.y + 1.2, base.z)), 2.4, 4.2);
      const near = state.action === 'awaken' ? .2 + .8 * fade : fade;
      this.shell.draw(fighter, time, Math.min(1, strength * 1.2) * (gathering ? .3 : 1) * near, aura[0], aura[1], shellLook(state.fighter));
      // The aura lights the floor round its fighter and their crown in its
      // colour, from over their head: a light inside the body only burns the
      // body's own surfaces white. (Not Will's haze, which is no light; a black pressure lights in its edge's colour.)
      this.chest.set(base.x, base.y + 2.6, base.z);
      if (glow > 0) this.kit.lights.request(this.chest.x, this.chest.y, this.chest.z, worn === 'flame' ? aura[0] : this.styleOf(fighter).tint ?? aura[0], 5 * strength * glow, 6, 1);
      // (What follows is a flame's: the sparks leaving it and its crown. A haze or a pressure's smoke is neither.)
      if (worn !== 'flame') continue;
      // Sparks rising off the body and leaving it. (Will stands no shell and throws none: it is pressure, not light.)
      const kind = powerKind(state.fighter);
      if (time >= (this.nextSpark.get(fighter) ?? 0)) {
        this.nextSpark.set(fighter, time + .05 / Math.max(.4, density));
        const sp = this.kit.sparks.spec, a = Math.random() * Math.PI * 2, r = .25 + Math.random() * .2;
        sp.reset(SPRITE.streak, time, .35 + Math.random() * .25).pos(base.x + Math.cos(a) * r, base.y + .2 + Math.random() * 1.5, base.z + Math.sin(a) * r).velocity(Math.cos(a) * .4, 3 + Math.random() * 2.5, Math.sin(a) * .4);
        sp.orient = ORIENT.velocity; sp.sized(.03, .015, .5); sp.stretch = 3; sp.trail = .04; sp.drag = 1.2; sp.gravity = -2; sp.hot(0xffffff, 1.8).cool(aura[1], 0); this.kit.sparks.emit();
      }
      if (kind !== 'plain') continue;
      // Cards stay upright and only turn about Y toward the eye: a full
      // billboard tips the flames over whenever the chase camera looks down.
      const facing = eye ? Math.atan2(eye.x - base.x, eye.z - base.z) : 0;
      // A few tongues flicking up off the crown, over the shell: the shell is
      // the aura, these are its flare. Around the head bone itself, so they
      // stay on the head however the body leans.
      const head = fighter.drawnJoint?.('Head') ?? fighter.joints?.get('Head');
      if (head) head.getWorldPosition(this.chest); else this.chest.set(base.x, base.y + 1.65, base.z);
      const tongues = Math.round(6 * Math.max(.5, density));
      for (let i = 0; i < tongues && count < budget; i++) {
        const phase = (time * (1.7 + (i % 3) * .35) + i * .618) % 1;
        const angle = i * 2.399963 + time * .8;
        const radius = .13 * (1 - phase * .3);
        const height = .38 * Math.sin(phase * Math.PI) * strength;
        this.transform.position.set(this.chest.x + Math.cos(angle) * radius, this.chest.y + .12 + phase * .35 + height * .5, this.chest.z + Math.sin(angle) * radius);
        this.transform.rotation.set(0, facing, 0);
        this.transform.scale.set(height * .7, height, 1);
        this.transform.updateMatrix();
        this.flames.setMatrixAt(count, this.transform.matrix);
        this.flames.setColorAt(count++, this.colour.set(i % 3 === 0 ? 0xfff2cf : aura[i % 3 === 1 ? 0 : 1]));
      }
    }
    this.shell.end(fighters); this.coat.end(fighters);
    this.power.update(time, _dt, fighters, camera, density, fighter => this.burning(fighter, time));
    this.infinity.update(time, _dt, fighters, density, camera);
    count = this.ifrit.update(time, _dt, fighters, density, this.flames, count, budget, eye);
    count = this.emperor.update(time, _dt, fighters, density, this.flames, count, budget, eye);
    this.setsuna.update(time, fighters, density, _dt);
    this.room.update(time, _dt, fighters, density);
    this.flames.count = count;
    this.flames.instanceMatrix.needsUpdate = true;
    if (this.flames.instanceColor) this.flames.instanceColor.needsUpdate = true;
    for (const [id, burst] of this.bursts) {
      const age = time - burst.born;
      if (age > .85 || age < -.5) { burst.ring.visible = false; this.spare.ring.push(burst.ring); this.bursts.delete(id); continue; }
      const actor = fighters.get(id);
      if (actor) burst.ring.position.set(actor.group.position.x, actor.group.position.y + .06, actor.group.position.z);
      burst.ring.scale.setScalar(.8 + age * 8);
      burst.ring.material.opacity = Math.max(0, .9 - age / .85);
    }
    this.cost[this.costAt] = performance.now() - started; this.costAt = (this.costAt + 1) % this.cost.length;
  }

  reset() {
    for (const burst of this.bursts.values()) { burst.ring.visible = false; this.spare.ring.push(burst.ring); }
    this.bursts.clear(); this.entries.clear();
    this.flames.count = 0;
    this.seen.clear();
    this.shell.reset(); this.coat.reset(); this.power.reset(); this.styles.clear(); this.nextSpark.clear(); this.infinity.reset(); this.ifrit.reset(); this.emperor.reset(); this.setsuna.reset(); this.room.reset();
  }

  dispose() {
    this.reset();
    for (const mesh of this.spare.ring) { mesh.removeFromParent(); mesh.material.dispose(); }
    this.spare = { ring: [] };
    this.flames.removeFromParent(); this.flames.dispose();
    this.flameGeometry.dispose(); this.flameMaterial.dispose();
    this.ringGeometry.dispose();
    this.shell.dispose(); this.coat.dispose(); this.power.dispose(); this.infinity.dispose(); this.ifrit.dispose(); this.emperor.dispose(); this.setsuna.dispose(); this.room.dispose();
    this.kit.release();
  }
}
