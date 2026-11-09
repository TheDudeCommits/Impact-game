import { chohanPhysicalArea } from './signature/ChohanAllInContact';
import { yodakaFireOwlReady } from './signature/YodakaFireOwl';
import * as THREE from 'three';
import { FIGHTERS } from '../config';
import { MOVES, type MoveDefinition } from '../game/moves';
import { moveFor } from '../game/awakening';
import { forgedMoves } from '../engine/sim/forgedKits';
import { areaJaOf } from '../engine/sim/areaMoves';
import { lookLead, strikeOffsets } from '../engine/sim/areaDamage';
import type { ForgeFx } from '../engine/sim/tune';
import { moveSource, slotFx } from '../engine/client/forgeLive';
import type { CombatEvent, FighterId, PlayerState, Vec3 } from '../game/types';
import type { AreaAimView } from '../input/areaAim';
import { forgeFxDirector } from './vfx/armory/forgeFx';
import { SIGNATURE, involvesLocal } from './signature/context';
import { EMBLEMS } from './area/emblems';
import { glyphsReady, loadGlyphs, paintSeal, type SealText } from './area/StampPainter';
import { STAMP_MARGIN, rangeMaterial, stampMaterial, type StampUniforms } from './area/stampMaterial';
import looks from '../engine/sim/areaLooks.json';
import { HAWSER_COLOSSUS_AREA_FX } from '../game/fighters/hawser';
import { displayMove } from '../originals/apply';
import { shownAreaJa } from '../originals/area';
import { shownEmblem } from '../originals/emblems';
import { isMonsoon, castMonsoon, clearMonsoons } from '../originals/lucyTide';
import { noteAreaCast } from '../originals/areaCastFx';

const LOOKS = looks as Readonly<Record<string, readonly string[]>>;
/** An awakened form's own area look in its own colours (the YUGE's Rumbling: earth and dust), where the look the
 *  server timed a cast to is not the caster's kit's. By the look's id: no other area move is cast with it. */
const FORM_LOOKS: Readonly<Record<string, ForgeFx>> = { [HAWSER_COLOSSUS_AREA_FX.effect]: HAWSER_COLOSSUS_AREA_FX };
/** How long a bullseye's flare burns on its seal (s). */
const BULL_FLARE = .55;
const LIFT = .045;
/** Seconds a cast's forming seal waits for its release before it is taken as interrupted. */
const CAST_WAIT = 1.4;
/** The slam: a drop from above in DROP seconds, then a squash for SQUASH. */
const DROP = .11, SQUASH = .24, BURN = .55;
const REACTING = new Set(['flinch', 'hurt', 'launched', 'knockdown', 'getup', 'stun', 'splat', 'defeated']);

/** The area move a player's slot throws, as the simulation has it: a forged kit's, else the fighter's (house kits
 *  included: they are in MOVES). */
export function areaMoveOf(state: Pick<PlayerState, 'fighter' | 'forge'> & Partial<Pick<PlayerState, 'awakened'>>): MoveDefinition {
  // (Awakened, the one its form casts where that is another - the YUGE's Rumbling: the simulation's moveFor.)
  return forgedMoves(state.forge)?.area ?? moveFor(state.fighter, 'area', !!state.awakened);
}
/** Whether a release now would cast: alive, free to throw, the slot cooled (`now`: the latest server time). */
export const areaReady = (state: PlayerState, now: number) => state.alive && !REACTING.has(state.action) && now >= (state.cooldowns.area ?? 0);
/** A seal's colour: its emblem's ink, else the fighter's card colour. */
export const sealColour = (fighter: FighterId) => (EMBLEMS[fighter] && shownEmblem(fighter, EMBLEMS[fighter]).colour) ?? FIGHTERS[fighter]?.color ?? '#ffd34d';
/** The seal a caster stamps for an area move: its own emblem, the move's name in English and Japanese. `mover` is whose
 *  move it is (a borrowed one's own fighter), for the Japanese. */
export function sealTextOf(caster: FighterId, name: string, mover: FighterId = caster): SealText {
  // (Its own area move, or the one its awakened form casts.)
  const own = MOVES[mover]?.area, awake = own ? moveFor(mover, 'area', true) : undefined;
  return { fighter: caster, en: displayMove(mover, name), ja: shownAreaJa(mover, areaJaOf(mover, own?.name === name ? own : awake?.name === name ? awake : undefined), name) };
}

/** Seals painted once each, by fighter and move: a mask canvas for the shader (512 px; 256 on a phone or on low). */
class Seals {
  private readonly made = new Map<string, { texture: THREE.CanvasTexture; text: SealText; lettered: boolean }>();
  private blank?: THREE.DataTexture;
  constructor(private readonly size: number) {}
  get(text: SealText): THREE.Texture {
    // Off the page (a test, a tool): a blank mask; the shader still runs.
    if (typeof document === 'undefined') return (this.blank ??= new THREE.DataTexture(new Uint8Array(4), 1, 1));
    const key = `${text.fighter}|${text.en}|${text.ja}`;
    let seal = this.made.get(key);
    if (!seal) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = this.size;
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping; texture.colorSpace = THREE.NoColorSpace; texture.generateMipmaps = true;
      seal = { texture, text, lettered: false };
      this.made.set(key, seal);
      if (this.made.size > 32) { const [first, old] = this.made.entries().next().value!; old.texture.dispose(); this.made.delete(first); }
      this.paint(seal);
      if (!glyphsReady()) void loadGlyphs().then(() => { for (const each of this.made.values()) if (!each.lettered) this.paint(each); });
    }
    return seal.texture;
  }
  private paint(seal: { texture: THREE.CanvasTexture; text: SealText; lettered: boolean }) {
    const canvas = seal.texture.image as HTMLCanvasElement, ctx = canvas.getContext('2d');
    if (!ctx) return;
    paintSeal(ctx, seal.text, { mask: true });
    seal.lettered = glyphsReady();
    seal.texture.needsUpdate = true;
  }
  dispose() { for (const seal of this.made.values()) seal.texture.dispose(); this.made.clear(); }
}

interface Stamp { mesh: THREE.Mesh; u: StampUniforms; busy: boolean }
interface Circle {
  key: string; actorId: string; fighter?: FighterId; body?: FighterId;
  at: THREE.Vector3; radius: number;
  cast: number; release?: number; due?: number;
  /** Strikes landed, of how many, and when the last one did. */
  struck: number; hits: number; lastStrike?: number;
  /** Its look, when it is laid (`due` less the look's lead), and whether it has been; when its bullseye last flared. */
  look?: ForgeFx; lookAt?: number; laid: boolean; bull?: number;
  /** Choose the tiger or its finite fallback at impact, after the texture's bounded load. */
  tigerCandidate: boolean; physical: boolean;
  monsoon: boolean;
  stamp: Stamp; threat: boolean; spin: number;
}

export class AreaTelegraph {
  private readonly root = new THREE.Group();
  private readonly quad = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  private readonly pool: Stamp[] = [];
  private readonly circles = new Map<string, Circle>();
  private readonly seals: Seals;
  /** The local player's aim: its seal, and the ring of its range. */
  private readonly aimStamp: Stamp;
  private readonly range = new THREE.Mesh(this.quad, rangeMaterial());
  private aimSpin = 0;
  private lastTime?: number;
  /** The page's own player, and the bodies by id (for sides and colours). */
  private localId?: string;
  private players = new Map<string, PlayerState>();
  /** The last area events drawn, newest last, with the page's clock (`at`, ms): what the proof tools read
   *  (window.arenaEvidence.areaEvents). */
  readonly drawn: { kind: string; actorId: string; serverTime: number; due?: number; at: number; contactIndex?: number; look?: string; strikes?: number;
    targetId?: string; damage?: number; bullseye?: boolean }[] = [];
  /** A strike, and a seal slamming down: the page plays their sounds (main.ts). */
  onImpact?: (at: Vec3, actorId: string, local: boolean) => void;
  onSlam?: (at: Vec3, actorId: string, local: boolean) => void;

  constructor(scene: THREE.Scene, options: { small?: boolean } = {}) {
    this.root.name = 'area-telegraph';
    this.seals = new Seals(options.small ? 256 : 512);
    this.aimStamp = this.stamp();
    this.aimStamp.mesh.visible = false; this.aimStamp.busy = true;
    this.range.visible = false; this.range.renderOrder = 7; this.range.frustumCulled = false;
    this.root.add(this.range);
    scene.add(this.root);
  }

  private stamp(): Stamp {
    const free = this.pool.find(s => !s.busy);
    if (free) { free.busy = true; free.mesh.visible = true; return free; }
    const material = stampMaterial(), mesh = new THREE.Mesh(this.quad, material);
    mesh.renderOrder = 8; mesh.frustumCulled = false;
    this.root.add(mesh);
    const made: Stamp = { mesh, u: material.uniforms, busy: true };
    this.pool.push(made);
    return made;
  }
  private seal(stamp: Stamp, text: SealText) {
    stamp.u.uMask.value = this.seals.get(text);
    stamp.u.uColor.value.set(sealColour(text.fighter));
  }

  /** The frame's events, as presented: the area slot's casts, releases and strikes are drawn here and left out of what
   *  is handed back for the other effect modules. */
  handle(events: readonly CombatEvent[], localId: string | undefined, players: readonly PlayerState[], onAuthoredImpact?: (event: CombatEvent) => void): CombatEvent[] {
    this.localId = localId;
    this.players.clear(); for (const p of players) this.players.set(p.id, p);
    const rest: CombatEvent[] = [];
    for (const event of events) {
      const area = event.slot === 'area' && (event.kind === 'cast' || event.kind === 'release' || event.kind === 'impact');
      if (!area) { rest.push(event); if (event.slot === 'area' && event.kind === 'hit') { this.note(event); if (event.bullseye) this.bullseye(event); } continue; }
      this.note(event);
      noteAreaCast(event, this.players);
      if (this.physicalCandidate(event) && event.kind !== 'impact' && event.endpoint) onAuthoredImpact?.(event);
      if (event.kind === 'cast' && event.endpoint) this.open(event, event.serverTime);
      else if (event.kind === 'release' && event.endpoint) {
        const c = this.open(event, event.serverTime);
        c.release = event.serverTime; c.due = event.due ?? event.serverTime + .75;
        if (event.strikes) c.hits = event.strikes;
        // The look the server timed the strikes to, laid its lead ahead of the first (update).
        c.look = this.lookOf(event) ?? c.look;
        c.lookAt = c.due - lookLead(c.look?.effect);
        if (c.monsoon) { c.laid = true; c.look = undefined; this.monsoon(c, event.serverTime, c.due); }
      } else if (event.kind === 'impact' && event.endpoint) this.strike(event, onAuthoredImpact);
    }
    return rest;
  }
  private note(event: CombatEvent) {
    this.drawn.push({ kind: event.kind, actorId: event.actorId, serverTime: event.serverTime, ...(event.due !== undefined ? { due: event.due } : {}), at: typeof performance === 'object' ? performance.now() : 0,
      ...(event.contactIndex !== undefined ? { contactIndex: event.contactIndex } : {}), ...(event.look ? { look: event.look } : {}), ...(event.strikes ? { strikes: event.strikes } : {}),
      ...(event.kind === 'hit' ? { targetId: event.targetId, damage: event.damage, bullseye: !!event.bullseye } : {}) });
    if (this.drawn.length > 40) this.drawn.shift();
  }

  /** The caster's body (a borrowed move's events name the move's own fighter, and the thrower in `body`). */
  private casterOf(event: CombatEvent): FighterId { return event.body ?? this.players.get(event.actorId)?.fighter ?? event.fighter ?? 'taisei'; }

  /** The circle a cast or a release names, made on first sight. A release follows its cast to the same point. */
  private open(event: CombatEvent, time: number): Circle {
    const e = event.endpoint!;
    for (const c of this.circles.values()) if (c.actorId === event.actorId && c.release === undefined
      && (c.physical && this.physicalCandidate(event) || Math.hypot(c.at.x - e.x, c.at.z - e.z) < .05)) {
      if (c.physical) c.at.set(e.x, e.y ?? 0, e.z);
      return c;
    }
    const key = `${event.actorId}:${time.toFixed(3)}:${Math.round(e.x * 10)}:${Math.round(e.z * 10)}`;
    const radius = event.radius ?? 4, body = this.casterOf(event), mover = event.fighter ?? body;
    const move = MOVES[mover]?.area, stamp = this.stamp();
    const physical = this.physicalCandidate(event);
    stamp.u.uSimpleRing.value = 0;
    this.seal(stamp, sealTextOf(body, event.move ?? move?.name ?? '', mover));
    if (physical) stamp.u.uColor.value.set('#a5aaa7');
    const threat = this.hostile(event.actorId);
    stamp.u.uMode.value = 1; stamp.u.uForm.value = 0; stamp.u.uSlam.value = -1; stamp.u.uFill.value = 0; stamp.u.uFlash.value = 0; stamp.u.uBull.value = 0;
    stamp.u.uBurn.value = 0; stamp.u.uThreat.value = threat ? 1 : 0; stamp.u.uOpacity.value = 1;
    stamp.mesh.position.set(e.x, (e.y ?? 0) + LIFT, e.z); stamp.mesh.scale.setScalar(radius * STAMP_MARGIN);
    const circle: Circle = { key, actorId: event.actorId, fighter: event.fighter, body, at: new THREE.Vector3(e.x, e.y ?? 0, e.z), radius, cast: time, struck: 0,
      hits: Math.max(1, event.strikes ?? (move ? strikeOffsets(move).length : 1)), laid: false, physical, tigerCandidate: this.tigerCandidate(event), monsoon: this.monsoonCandidate(event, body), stamp, threat, spin: Math.random() * Math.PI * 2 };
    this.circles.set(key, circle);
    // Its look is fetched now, so it is built by the time it is laid (the runtime loads on demand).
    const look = circle.look = this.lookOf(event);
    if (look && !circle.monsoon && (!circle.tigerCandidate || !yodakaFireOwlReady())) void forgeFxDirector()?.prepare(look.effect);
    return circle;
  }
  private hostile(actorId: string) {
    if (actorId === this.localId) return false;
    const me = this.localId ? this.players.get(this.localId) : undefined, caster = this.players.get(actorId);
    return !(me && caster && me.team !== undefined && me.team === caster.team);
  }

  private strike(event: CombatEvent, onAuthoredImpact?: (event: CombatEvent) => void) {
    const e = event.endpoint!;
    let circle: Circle | undefined;
    for (const c of this.circles.values()) if (c.actorId === event.actorId && Math.hypot(c.at.x - e.x, c.at.z - e.z) < .05) {
      // A repeated network impact must not change a fallback decision after the texture arrives.
      if ((event.fighter === 'yodaka' || c.physical) && c.lastStrike === event.serverTime) return;
      if (!circle && c.struck < c.hits) circle = c;
    }
    circle ??= this.open({ ...event, kind: 'release' }, event.serverTime);
    circle.release ??= event.serverTime; circle.due ??= event.serverTime;
    circle.struck = Math.max(circle.struck, (event.contactIndex ?? 0) + 1); circle.lastStrike = event.serverTime;
    const at = new THREE.Vector3(e.x, e.y ?? 0, e.z), local = event.actorId === this.localId;
    if (!circle.physical) this.onImpact?.(e, event.actorId, local);
    // The impact frame, for the players it involves: its caster, and whoever stands in the circle.
    const me = this.localId ? this.players.get(this.localId) : undefined;
    const caught = !!me && me.alive && Math.hypot(me.x - e.x, me.z - e.z) <= (event.radius ?? circle.radius) + .5;
    if (!circle.physical && (involvesLocal(event.actorId) || caught)) SIGNATURE.screen?.impactFrame?.(circle.struck >= circle.hits ? .85 : .45, at);
    // Its look, if its release went unseen: laid as far in as it would be by now.
    if (!circle.laid) {
      if (circle.monsoon) { circle.laid = true; circle.look = undefined; this.monsoon(circle, event.serverTime - .75, event.serverTime); }
      else if (circle.physical) {
        circle.laid = true; circle.look = undefined; onAuthoredImpact?.(event);
      } else if (circle.tigerCandidate && this.tigerCandidate(event) && yodakaFireOwlReady() && onAuthoredImpact) {
        circle.laid = true; circle.look = undefined;
        onAuthoredImpact(event);
      } else {
        circle.look = this.lookOf(event) ?? circle.look;
        this.lay(circle, event.serverTime - ((circle.due ?? event.serverTime) - lookLead(circle.look?.effect)));
      }
    }
  }
  /** Lays a circle's look, `preroll` seconds in, once. */
  private lay(c: Circle, preroll: number) {
    c.laid = true;
    if (c.look) void forgeFxDirector()?.zone(c.actorId, c.look, c.at, c.radius, Math.max(0, preroll));
  }
  /** A blow dead centre (round 3: all of a strike's damage): its circle's bullseye flares. */
  private bullseye(event: CombatEvent) {
    const o = event.origin;
    if (!o) return;
    for (const c of this.circles.values()) if (c.actorId === event.actorId && Math.hypot(c.at.x - o.x, c.at.z - o.z) < .05) { c.bull = event.serverTime; return; }
  }
  /** A circle's look: the one the server timed its strikes to (`look`), dressed in the thrower's kit's settings when
   *  that is the kit's (or house kit's) effect for its area slot; without one (an older server), the kit's, else the
   *  matcher's pick for the move's fighter. */
  private lookOf(event: CombatEvent): ForgeFx | undefined {
    if (this.physicalCandidate(event)) return undefined;
    const caster = this.players.get(event.actorId);
    const fx = caster ? slotFx(caster, 'area') : undefined;
    if (event.look) return fx?.effect === event.look ? fx : FORM_LOOKS[event.look] ?? { effect: event.look };
    if (fx) return fx;
    const id = LOOKS[event.fighter ?? caster?.fighter ?? '']?.[0];
    return id ? { effect: id } : undefined;
  }
  private physicalCandidate(event: CombatEvent): boolean {
    const caster = this.players.get(event.actorId);
    return event.fighter === 'chohan' && this.casterOf(event) === 'chohan'
      && (!event.look || event.look === LOOKS.chohan?.[0])
      && chohanPhysicalArea(caster ?? { fighter: 'chohan' });
  }
  private monsoonCandidate(event: CombatEvent, body: FighterId): boolean {
    const caster = this.players.get(event.actorId);
    return isMonsoon(event.fighter ?? caster?.fighter, body, event.look, caster ? slotFx(caster, 'area')?.effect : undefined);
  }
  private monsoon(c: Circle, release: number, due: number) {
    const caster = this.players.get(c.actorId);
    castMonsoon(c.key, c.actorId, c.at, c.radius, release, due, caster, c.hits);
  }
  private tigerCandidate(event: CombatEvent): boolean {
    const caster = this.players.get(event.actorId);
    return event.fighter === 'yodaka' && !(caster && slotFx(caster, 'area'));
  }

  /** Every frame: the seals form, slam, fill, flash and burn, and the local aim follows `aim`. `floorAt` gives the floor
   *  under a point (the page's collision). */
  update(time: number, aim: AreaAimView | undefined, self: PlayerState | undefined, floorAt: (x: number, z: number, near: number) => number) {
    const dt = this.lastTime === undefined ? 0 : Math.max(0, Math.min(.1, time - this.lastTime));
    this.lastTime = time;
    for (const [key, c] of this.circles) {
      const u = c.stamp.u, mesh = c.stamp.mesh;
      u.uTime.value = time;
      if (c.release === undefined) {
        // Cast, not yet released: forming, gone if the release never comes (the caster was struck out of it).
        if (time - c.cast > CAST_WAIT) { this.close(key, c); continue; }
        if (c.physical) {
          const caster = this.players.get(c.actorId);
          if (caster) { c.at.set(caster.x, caster.y, caster.z); mesh.position.x = caster.x; mesh.position.z = caster.z; }
        }
        u.uForm.value = Math.min(1, (time - c.cast) / .3);
        c.spin += dt * 1.6; u.uSpin.value = c.spin;
        mesh.position.y = c.at.y + LIFT + .02; mesh.scale.setScalar(c.radius * STAMP_MARGIN);
        continue;
      }
      if (!c.laid && !c.physical && !c.tigerCandidate && !c.monsoon && c.lookAt !== undefined && time >= c.lookAt) this.lay(c, time - c.lookAt);
      u.uBull.value = c.bull === undefined ? 0 : Math.max(0, 1 - (time - c.bull) / BULL_FLARE);
      const since = time - c.release, span = Math.max(.05, (c.due ?? c.release) - c.release);
      if (c.physical) {
        mesh.position.copy(c.at); mesh.position.y += LIFT; mesh.scale.set(c.radius * STAMP_MARGIN, 1, c.radius * STAMP_MARGIN);
        u.uForm.value = 1; u.uSlam.value = -1; u.uFill.value = 0; u.uFlash.value = 0; u.uBull.value = 0;
        if (c.struck) {
          const age = time - (c.lastStrike ?? time); u.uBurn.value = THREE.MathUtils.clamp(age / .24, 0, 1);
          if (age >= .24) this.close(key, c);
        } else if (time - c.cast > 12) this.close(key, c);
        continue;
      }
      // The slam: down from above, then a squash.
      const drop = Math.min(1, since / DROP), squash = since > DROP ? Math.max(0, 1 - (since - DROP) / SQUASH) : 0;
      mesh.position.y = c.at.y + LIFT + (1 - drop) ** 2 * 1.4;
      const s = (since < DROP ? 1.28 - .28 * drop : 1 + .1 * Math.sin((since - DROP) / SQUASH * Math.PI) * squash) * c.radius * STAMP_MARGIN;
      mesh.scale.set(s, 1, s);
      if (since >= DROP && u.uSlam.value < 0) this.onSlam?.(c.at, c.actorId, c.actorId === this.localId);
      u.uSlam.value = since >= DROP ? since - DROP : -1;
      u.uForm.value = 1;
      u.uFill.value = THREE.MathUtils.clamp((since - DROP) / Math.max(.05, span - DROP), 0, 1);
      c.spin += dt * (1.2 + 5 * u.uFill.value); u.uSpin.value = c.spin;
      if (c.struck) {
        const after = time - (c.lastStrike ?? time);
        u.uFlash.value = Math.max(0, 1 - after / .22);
        u.uFill.value = 1;
        if (c.struck >= c.hits) {
          u.uBurn.value = THREE.MathUtils.clamp((after - .08) / BURN, 0, 1);
          if (after > BURN + .12) { this.close(key, c); continue; }
        } else if (after > 3.2) { this.close(key, c); continue; }
      }
      if (time - c.cast > 12) this.close(key, c);
    }
    this.aim(time, dt, aim, self, floorAt);
  }

  private aim(time: number, dt: number, aim: AreaAimView | undefined, self: PlayerState | undefined, floorAt: (x: number, z: number, near: number) => number) {
    const on = !!aim?.active && !!self?.alive;
    this.aimStamp.mesh.visible = this.range.visible = on;
    if (!on || !aim || !self) return;
    const physical = chohanPhysicalArea(self);
    const ground = physical || self.grounded ? self.y : floorAt(self.x, self.z, self.y);
    const ring = this.range.material as ReturnType<typeof rangeMaterial>;
    this.range.position.set(aim.fromX, ground + LIFT * .5, aim.fromZ); this.range.scale.setScalar(Math.max(.5, aim.range));
    ring.uniforms.uTime.value = time; ring.uniforms.uWidth.value = Math.min(.08, .22 / Math.max(1, aim.range));
    ring.uniforms.uColor.value.set(aim.valid ? '#fff3dc' : '#c07a7a');
    const u = this.aimStamp.u, move = areaMoveOf(self);
    u.uSimpleRing.value = 0;
    this.seal(this.aimStamp, sealTextOf(self.fighter, move.name));
    if (physical) { u.uColor.value.set('#a5aaa7'); u.uThreat.value = 0; }
    this.aimSpin += dt * (aim.valid ? 1.4 : .5);
    u.uMode.value = 0; u.uValid.value = aim.valid ? 1 : 0; u.uTime.value = time; u.uSpin.value = this.aimSpin; u.uOpacity.value = 1;
    this.aimStamp.mesh.position.set(aim.x, (physical ? self.y : floorAt(aim.x, aim.z, self.y)) + LIFT * 1.5, aim.z);
    this.aimStamp.mesh.scale.setScalar(aim.radius * STAMP_MARGIN * (physical ? 1 : 1 + .03 * Math.sin(time * 5)));
  }

  private close(key: string, c: Circle) {
    c.stamp.busy = false; c.stamp.mesh.visible = false; c.stamp.u.uMask.value = null;
    this.circles.delete(key);
  }

  /** A room's player's seal painted before its first area cast (matchWarmup.ts), and its texture handed back for the
   *  load's upload: painted when first cast, a seal was 5-20 ms of canvas strokes and a 222 ms first draw, and its
   *  lettering a 457 KB chunk fetched at that moment. Needs `loadGlyphs()` (StampPainter) first, or it paints without
   *  its lettering and repaints on arrival. Painting is the cost, so a caller yields between players. */
  warmSeal(player: Pick<PlayerState, 'fighter' | 'forge'>): THREE.Texture {
    const move = areaMoveOf(player), mover = moveSource(player, 'area')?.fighter ?? player.fighter;
    return this.seals.get(sealTextOf(player.fighter, move.name, mover));
  }

  /** The looks laid and the hits each made as it played (the page's clock, ms), for the proof tools to hold against `drawn`. */
  get laidLooks() { return forgeFxDirector()?.laidLooks ?? []; }

  /** A match left: every circle goes. */
  reset() { for (const [key, c] of [...this.circles]) this.close(key, c); this.aimStamp.mesh.visible = this.range.visible = false; clearMonsoons(); }
  dispose() {
    this.reset();
    for (const s of this.pool) (s.mesh.material as THREE.Material).dispose();
    (this.range.material as THREE.Material).dispose(); this.quad.dispose(); this.seals.dispose(); this.root.removeFromParent();
  }
}
