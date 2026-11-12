import * as THREE from 'three';
import { MOVES } from '../game/moves';
import type { CombatEvent, FighterId } from '../game/types';
import type { Fighter } from '../render/Fighter';
import { MoveStage, stageLook, type StageLook } from '../render/signature/MoveStage';
import { floorUnder } from '../render/signature/blowFloor';
import { ORIGINALS } from './roster';

type StormKind = 'blizzard' | 'swarm' | 'dawn' | 'feathers' | 'thunder' | 'harvest' | 'rookery' | 'slabs' | 'landslide' | 'wake' | 'seabed' | 'sunset' | 'moon' | 'sweep' | 'spiral' | 'slate' | 'hymn';
interface Finale {
  /** The finisher's look (its burst, dome, pillar and ring) and the second one its storm is drawn in. */
  look: StageLook; dark: StageLook;
  /** What it leaves for a second and a half after the last blow. */
  storm: StormKind;
  /** Its colour gathered on both fists through the rush (unless false: a thrower whose fists stay near the lens is lost in it). */
  hands?: boolean;
  /** How big its landing is (MoveStage sizes: an ultimate's burst 2.5-3). */
  size: number;
  /** The landing's domes, as a share of their size (a thrower who closes right in is inside them: smaller keeps him read). */
  dome?: number;
  /** Metres the storm stands beyond the blow, the way it travelled (where the victim is thrown): off a thrower who struck
   *  from right beside them. */
  ahead?: number;
  /** The opener's own burst and ring (unless false: a move whose opener already closes a thing round the victim - Shiun's
   *  coffin - would bury them for longer than the VFX bar allows). */
  opener?: boolean;
}
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
/** Sekka's frost: a white heart, his pink, a deep plum edge; and the black snow, near black with his pink at its rim. */
const FROST = stageLook(0xf4f8ff, 0xff6fa0, 0x2a0a1e);
const BLACK_SNOW: StageLook = { ...stageLook(0xffd8e6, 0x3a1a2a, 0x080306, { dark: true }), core: lin(2.6, 1.9, 2.2), main: lin(.16, .07, .11), rim: lin(.03, .01, .02) };

/** Imago's swarm: a gold-white heart in his green; the old shell, near black with green at its edge. */
const SWARM = stageLook(0xfaffd8, 0x3ae88a, 0x062a14);
const CHITIN: StageLook = { ...stageLook(0xe8ffb0, 0x1c2a12, 0x030602, { dark: true }), core: lin(2.4, 2.8, 1.4), main: lin(.09, .16, .06), rim: lin(.02, .03, .01) };
/** Asahi's first light: a white-gold sun in dawn orange; and his own green for the lanterns. */
const DAWN = stageLook(0xfff4d0, 0xffa23a, 0x4a1604);
const LANTERN = stageLook(0xf0fff4, 0x2e9e6a, 0x041a0e);
/** Vesper's pale (his #dfe8ff) and the black of the grave road. */
const PALE = stageLook(0xffffff, 0xdfe8ff, 0x1a1e2e);
const RAVEN: StageLook = { ...stageLook(0xd8e0ff, 0x101420, 0x020306, { dark: true }), core: lin(2.5, 2.6, 3.1), main: lin(.06, .065, .1), rim: lin(.01, .01, .02) };

/** Gorai's thunder: a white heart in his violet, a bruised storm-cloud edge. */
const THUNDER = stageLook(0xf4ecff, 0x8a63d2, 0x1a0a36);
const CLOUD: StageLook = { ...stageLook(0xe0d0ff, 0x1c1030, 0x040208, { dark: true }), core: lin(2.4, 2.1, 3.2), main: lin(.1, .06, .16), rim: lin(.02, .01, .04) };
/** Wuming's harvest: a white-pink heart in his pink; the petals' deeper rose. */
const HARVEST = stageLook(0xfff0fa, 0xe85fc8, 0x3a0828);
const PETAL = stageLook(0xffe0f0, 0xff7ab0, 0x40081a);
/** Rook's dead: his violet over black. */
const GRAVE = stageLook(0xeee4ff, 0x7a4dff, 0x12062e);
const ROOKERY: StageLook = { ...stageLook(0xd8c8ff, 0x140a24, 0x030106, { dark: true }), core: lin(2.2, 1.8, 3.3), main: lin(.07, .04, .12), rim: lin(.015, .01, .03) };
/** Banjaku's vermilion seal and the temple's grey stone. */
const SEAL = stageLook(0xffe8d8, 0xd8262e, 0x3a0406);
const STONE: StageLook = { ...stageLook(0xf0e8e0, 0x2a2624, 0x060505, { dark: true }), core: lin(2.2, 1.9, 1.7), main: lin(.2, .17, .15), rim: lin(.03, .025, .02) };
/** Gaku's green, and the earth he throws. */
const WILD = stageLook(0xf0ffe0, 0x4fae3c, 0x0c2a06);
const EARTH: StageLook = { ...stageLook(0xf4e4c8, 0x2e2416, 0x060402, { dark: true }), core: lin(2.4, 2.1, 1.5), main: lin(.22, .16, .09), rim: lin(.03, .02, .01) };

/** Sorrel's crimson, over a near-black. */
const CRIMSON = stageLook(0xfff0f0, 0xd8323c, 0x3a0408);
const WAKE: StageLook = { ...stageLook(0xffd0d4, 0x24060a, 0x060102, { dark: true }), core: lin(3, 1.6, 1.7), main: lin(.16, .03, .04), rim: lin(.03, .005, .01) };
/** Haldor's bone-white, and the old seabed's stone. */
const BONE = stageLook(0xffffff, 0xe9e2cf, 0x2a2618);
const SEABED: StageLook = { ...stageLook(0xf0e8d8, 0x2c2820, 0x060504, { dark: true }), core: lin(2.6, 2.4, 2.1), main: lin(.2, .18, .14), rim: lin(.03, .03, .02) };
/** Dorado's gold, and the sunset's red-orange. */
const GOLDEN = stageLook(0xfff4d8, 0xd9a441, 0x3a2404);
const SUNSET = stageLook(0xffe0c0, 0xff6a2a, 0x3a0c02);
/** Tobari's red moon, and his crows' black. */
const MOON = stageLook(0xffe8ea, 0xd42a3c, 0x2a0408);
const CROW: StageLook = { ...stageLook(0xffc8cc, 0x160406, 0x030001, { dark: true }), core: lin(2.8, 1.2, 1.3), main: lin(.08, .02, .025), rim: lin(.015, .003, .004) };
/** Levin's green wind, and the dust it sweeps out. */
const SWEEP = stageLook(0xf0fff4, 0x4fd08a, 0x08301a);
const DUST: StageLook = { ...stageLook(0xf4ece0, 0x3a342c, 0x080706, { dark: true }), core: lin(2.4, 2.3, 2.1), main: lin(.3, .27, .22), rim: lin(.05, .045, .04) };

/** Gohaku's violet, and the library's pale pages. */
const SCHOLAR = stageLook(0xf6f0ff, 0xa57cff, 0x1e0e3a);
const PAGE = stageLook(0xffffff, 0xf2ead8, 0x2a261c);
/** Ippon's yellow, and the grit he blows out. */
const PUNCH = stageLook(0xfffbe8, 0xf0d040, 0x3a2e04);
const GRIT: StageLook = { ...stageLook(0xf4ece0, 0x3a342c, 0x080706, { dark: true }), core: lin(2.4, 2.3, 2.1), main: lin(.3, .27, .22), rim: lin(.05, .045, .04) };
/** Shiun's lilac hymn, and the stained glass (its panes in the window's rose and gold). */
const HYMN = stageLook(0xf8f0ff, 0xa48ae0, 0x1c1238);
const GLASS = stageLook(0xfff0e0, 0xff7a9a, 0x3a0a1a);

const ALL: Partial<Record<FighterId, Finale>> = {
  sekka: { look: FROST, dark: BLACK_SNOW, storm: 'blizzard', size: 2.7 },
  imago: { look: SWARM, dark: CHITIN, storm: 'swarm', size: 2.6, ahead: .8, opener: false },
  asahi: { look: DAWN, dark: LANTERN, storm: 'dawn', size: 2.6 },
  vesper: { look: PALE, dark: RAVEN, storm: 'feathers', size: 2.6 },
  gorai: { look: THUNDER, dark: CLOUD, storm: 'thunder', size: 2.8, hands: false },
  'wuming': { look: HARVEST, dark: PETAL, storm: 'harvest', size: 2.5, hands: false, dome: .7, ahead: 1.6 },
  'rook': { look: GRAVE, dark: ROOKERY, storm: 'rookery', size: 2.5, hands: false, ahead: 1 },
  banjaku: { look: SEAL, dark: STONE, storm: 'slabs', size: 2.7, hands: false },
  gaku: { look: WILD, dark: EARTH, storm: 'landslide', size: 2.4, hands: false, dome: .65, ahead: 1.8 },
  sorrel: { look: CRIMSON, dark: WAKE, storm: 'wake', size: 2.5, hands: false, dome: .8, ahead: 1 },
  haldor: { look: BONE, dark: SEABED, storm: 'seabed', size: 2.7, hands: false, dome: .85, ahead: 1 },
  dorado: { look: GOLDEN, dark: SUNSET, storm: 'sunset', size: 2.5, hands: false, dome: .8, ahead: 1.6 },
  tobari: { look: MOON, dark: CROW, storm: 'moon', size: 2.4, hands: false, dome: .8, ahead: 1.2 },
  levin: { look: SWEEP, dark: DUST, storm: 'sweep', size: 2.2, hands: false, dome: .55, ahead: 2.2 },
  'gohaku': { look: SCHOLAR, dark: PAGE, storm: 'spiral', size: 2.4, hands: false, dome: .75, ahead: 1 },
  ippon: { look: PUNCH, dark: GRIT, storm: 'slate', size: 2.5, hands: false, dome: .7, ahead: .6 },
  shiun: { look: HYMN, dark: GLASS, storm: 'hymn', size: 2.4, hands: false, dome: .75, ahead: 1.2, opener: false },
};
export const FINALES: Partial<Record<FighterId, Finale>> = Object.fromEntries(Object.entries(ALL).filter(([id]) => ORIGINALS[id as FighterId]));

const UP = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
type Storm = { slot: FighterId; at: THREE.Vector3; ground: THREE.Vector3; dir: THREE.Vector3; born: number; seed: number; live: boolean };

/** The finales: EmperorEffects hands it every event and a frame, and it draws on the scene's stage. */
export class EmperorFinales {
  private stage?: MoveStage;
  private until = -1e9; private cleared = true;
  private storms: Storm[] = Array.from({ length: 4 }, () => ({ slot: 'sekka' as FighterId, at: new THREE.Vector3(), ground: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), born: -1e9, seed: 0, live: false }));
  private cursor = 0;
  private seen = new Set<string>();
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private dir = new THREE.Vector3();

  constructor(private scene: THREE.Scene) {}
  private get st() { return this.stage ??= MoveStage.for(this.scene, { budget: 1 }); }

  /** An event: the ultimate's blows landing. */
  handle(event: CombatEvent, fighters: ReadonlyMap<string, Fighter>) {
    const slot = event.fighter as FighterId | undefined, finale = slot && FINALES[slot];
    if (!finale || event.kind !== 'hit' || event.slot !== 'ultimate' || event.branch) return;
    const key = `${event.id}:${event.serverTime}`; if (this.seen.has(key)) return;
    this.seen.add(key); if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!);
    const actor = fighters.get(event.actorId), victim = event.targetId ? fighters.get(event.targetId) : undefined;
    const point = this.a;
    if (victim) point.copy(victim.group.position).setY(victim.group.position.y + 1.1);
    else if (event.endpoint) point.set(event.endpoint.x, event.endpoint.y, event.endpoint.z);
    else return;
    const floor = floorUnder(point.x, point.y - 1.1, point.z), ground = this.b.set(point.x, floor, point.z), t = event.serverTime;
    if (actor) { this.dir.subVectors(point, actor.group.position).setY(0); if (this.dir.lengthSq() < .01) this.dir.set(0, 0, 1); this.dir.normalize(); } else this.dir.set(0, 0, 1);
    const st = this.st, last = (event.contactIndex ?? 0) >= MOVES[slot!].ultimate.contacts.length - 1, size = finale.size;
    this.until = Math.max(this.until, t + 3.4); this.cleared = false;
    if (!last) {
      if ((event.contactIndex ?? 0) > 0 && MOVES[slot!].ultimate.contacts.length > 3 || finale.opener === false) return;
      // The opener: a ring cracked round the victim, and the blow's own burst.
      st.burst(point, finale.look, size * .45, t, { dir: this.dir, floor });
      st.shock(ground, finale.look, size * 1.6, t, .45);
      st.scar(ground, finale.look, size * .7, t + .05, 1.6);
      return;
    }
    // The last blow: the air breaks in shards, the blizzard is thrown out of it.
    st.shatter(this.c.copy(point).addScaledVector(this.dir, -.2), this.dir, finale.look, size * 1.3, t, .8);
    st.burst(point, finale.look, size, t, { dir: this.dir, floor });
    // (The dawn's is light, not a dark: one dome, smaller, so the pair still read through it.)
    const domes = finale.dome ?? 1;
    if (finale.storm !== 'dawn') st.dome(point, finale.dark, size * 1.9 * domes, t, .7);
    st.dome(point, finale.look, size * (finale.storm === 'dawn' ? 1.1 : 1.4) * domes, t + .03, .5);
    if (finale.storm === 'dawn') { st.erupt(ground, UP, finale.look, size * .36, 13, t + .02, 1.0); st.erupt(ground, UP, finale.dark, size * .16, 12, t + .06, .7); }
    else { st.erupt(ground, UP, finale.dark, size * .45, 10, t + .05, 1.1); st.erupt(ground, UP, finale.look, size * .22, 11, t + .02, .6); }
    st.shock(ground, finale.look, size * 3.6, t, .7);
    st.scar(ground, finale.look, size * 1.2, t + .2, 2.6);
    const storm = this.storms[this.cursor++ % this.storms.length];
    storm.slot = slot!; storm.at.copy(point).addScaledVector(this.dir, finale.ahead ?? 0); storm.ground.copy(ground).addScaledVector(this.dir, finale.ahead ?? 0); storm.dir.copy(this.dir); storm.born = t; storm.seed = (event.seed ?? event.id) % 997; storm.live = true;
  }

  /** A frame: the cold gathering on the fists through the rush, and each storm's black snow. */
  update(time: number, fighters: ReadonlyMap<string, Fighter>) {
    if (!this.stage && !this.throwing(fighters)) return;
    if (time > this.until && !this.throwing(fighters)) {
      // All of it spent: one empty frame so nothing is left drawn, then nothing more until the next.
      if (!this.cleared && this.stage) { this.stage.open(time).close(); this.cleared = true; }
      return;
    }
    this.cleared = false;
    const st = this.st.open(time);
    for (const f of fighters.values()) {
      const s = f.state, finale = FINALES[s.fighter];
      if (!finale || s.action !== 'ultimate' || !s.alive || s.branch) continue;
      const move = MOVES[s.fighter].ultimate, t = s.actionTime * s.actionDuration, last = move.contacts[move.contacts.length - 1];
      if (t > last + .05) continue;
      // The air freezing round both fists, thicker as the last blow comes.
      const k = clamp(t / last), seed = (s.actionSeq ?? 0) * 3.1;
      // (Small: a thrower lost in his own glow for the whole rush is over the VFX bar's ceiling.)
      if (finale.hands !== false) for (const hand of [f.handL, f.handR]) if (hand) { st.charge(hand, finale.look, .12 + .14 * k, k, seed); st.glow(hand, .32 + .3 * k, finale.look.main, .16 + .22 * k); }
      if (k > .6) st.dim(.25 + .3 * (k - .6) / .4, s.id);
    }
    for (const storm of this.storms) {
      if (!storm.live) continue;
      const age = time - storm.born, finale = FINALES[storm.slot];
      if (!finale || age > 1.8 || age < 0) { if (age > 1.8) storm.live = false; continue; }
      const fade = 1 - clamp((age - 1.1) / .7), grow = clamp(age / .3);
      if (finale.storm === 'blizzard') this.blizzard(st, storm, finale, age, fade, grow);
      else if (finale.storm === 'swarm') this.swarm(st, storm, finale, age, fade, grow);
      else if (finale.storm === 'dawn') this.dawn(st, storm, finale, age, fade, grow);
      else if (finale.storm === 'feathers') this.feathers(st, storm, finale, age, fade, grow);
      else if (finale.storm === 'thunder') this.thunder(st, storm, finale, age, fade);
      else if (finale.storm === 'harvest') this.harvest(st, storm, finale, age, fade, grow);
      else if (finale.storm === 'rookery') this.rookery(st, storm, finale, age, fade, grow);
      else if (finale.storm === 'wake') this.wake(st, storm, finale, age, fade, grow);
      else if (finale.storm === 'seabed') this.seabed(st, storm, finale, age, fade);
      else if (finale.storm === 'sunset') this.sunset(st, storm, finale, age, fade, grow);
      else if (finale.storm === 'moon') { this.rookery(st, storm, finale, age, fade, grow, true); this.moon(st, storm, finale, fade, grow); }
      else if (finale.storm === 'sweep') this.sweep(st, storm, finale, age, fade, grow);
      else if (finale.storm === 'spiral') this.spiral(st, storm, finale, age, fade, grow);
      else if (finale.storm === 'slate') this.slate(st, storm, finale, age, fade, grow);
      else if (finale.storm === 'hymn') this.hymn(st, storm, finale, age, fade, grow);
      else this.rocks(st, storm, finale, age, fade, grow, finale.storm === 'slabs');
      st.glow(storm.at, 2.6 + 1.2 * grow, finale.look.main, .22 * fade);
      if (MOVES[storm.slot].ultimate.contacts.length < 3) st.light(storm.at, 7, finale.look, .35 * fade); // (a third blow's burst holds a light volume of its own: the half of the pool is the bar)
    }
    st.close();
  }

  /** Black snow whirling round where the blow landed, out and up, thinning as it settles. (Big enough to read as flakes from
   *  the gameplay camera, which has pulled back to the thrower by now: a fifth of a metre across, a third of a turn long.) */
  private blizzard(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number, grow: number) {
    for (let i = 0, n = st.n(72, 24); i < n; i++) {
      const h = hash(i * 7.31 + storm.seed), r = (.8 + 4.4 * h) * (.35 + .65 * grow), spin = 1.4 + 2.4 * (1 - h);
      const ang = h * TAU + age * spin, y = storm.ground.y + .15 + 5.2 * hash(i * 3.7 + storm.seed) * (.45 + .55 * grow) - age * .7 * h;
      this.a.set(storm.at.x + Math.cos(ang) * r, Math.max(storm.ground.y + .05, y), storm.at.z + Math.sin(ang) * r);
      this.b.set(storm.at.x + Math.cos(ang - .34) * r, this.a.y + .1, storm.at.z + Math.sin(ang - .34) * r);
      const pale = i % 4 === 0;
      st.streak(this.a, this.b, (.1 + .12 * hash(i * 1.9)) * (pale ? .7 : 1), pale ? finale.look.main : finale.dark.main, (pale ? .75 : 1.2) * fade);
    }
  }
  /** Wings spiralling up round where the victim stood, tight and fast, glittering; dark shards of the shed shell falling. */
  private swarm(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number, grow: number) {
    for (let i = 0, n = st.n(64, 22); i < n; i++) {
      const h = hash(i * 5.17 + storm.seed), r = (.5 + 2.3 * h) * (.5 + .5 * grow), spin = 4.5 + 3 * (1 - h);
      const ang = h * TAU + age * spin, y = storm.ground.y + .3 + (h * 1.6 + age * (1.6 + 2 * hash(i * 2.3))) * (.4 + .6 * grow);
      this.a.set(storm.at.x + Math.cos(ang) * r, y, storm.at.z + Math.sin(ang) * r);
      this.b.set(storm.at.x + Math.cos(ang - .5) * r, y - .12, storm.at.z + Math.sin(ang - .5) * r);
      const glint = .6 + .4 * Math.sin(age * 31 + i * 1.7);
      st.streak(this.a, this.b, .07 + .05 * hash(i * 1.3), i % 5 === 0 ? finale.look.core : finale.look.main, 1.15 * glint * fade);
    }
    for (let i = 0, n = st.n(18, 8); i < n; i++) {
      const h = hash(i * 9.1 + storm.seed + 3), a = h * TAU, v = 2.5 + 3 * hash(i * 4.7), up = 3.5 + 2 * hash(i * 6.1);
      const x = Math.cos(a) * v * age, z = Math.sin(a) * v * age, y = Math.max(storm.ground.y + .05, storm.at.y + up * age - 4.9 * age * age);
      this.a.set(storm.at.x + x, y, storm.at.z + z); this.b.copy(this.a).addScaledVector(this.c.set(Math.cos(a + 1.3), .6, Math.sin(a + 1.3)), .32);
      st.streak(this.a, this.b, .14, finale.dark.main, 1.1 * fade);
    }
  }
  /** A low sun swelling behind where the victim stood, shafts of morning rising off the floor round it one after another, and
   *  lantern sparks drifting up. */
  private dawn(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number, grow: number) {
    this.a.copy(storm.ground); this.a.y += 1.6;
    st.glow(this.a, 3 + 1.8 * grow, finale.look.main, .3 * fade); st.glow(this.a, 1.2 + .6 * grow, finale.look.core, .34 * fade);
    for (let i = 0, n = st.n(16, 8); i < n; i++) {
      const h = hash(i * 3.3 + storm.seed), a = i / n * TAU + h, r = 1.2 + 2.6 * hash(i * 8.1), rise = clamp((age - h * .5) / .35);
      if (rise <= 0) continue;
      this.a.set(storm.ground.x + Math.cos(a) * r, storm.ground.y, storm.ground.z + Math.sin(a) * r);
      this.b.copy(this.a); this.b.y += (3 + 4 * h) * rise;
      st.streak(this.a, this.b, .12 + .16 * h, finale.look.main, .9 * fade * (1 - .5 * rise));
    }
    for (let i = 0, n = st.n(40, 16); i < n; i++) {
      const h = hash(i * 6.7 + storm.seed + 1), a = h * TAU + age * .6, r = .6 + 3.6 * hash(i * 2.9), y = storm.ground.y + .2 + (age * (.8 + 1.2 * h) + 3 * hash(i * 4.1)) * grow;
      this.a.set(storm.ground.x + Math.cos(a) * r, y, storm.ground.z + Math.sin(a) * r); this.b.copy(this.a); this.b.y += .14;
      st.streak(this.a, this.b, .09, i % 3 ? finale.look.core : finale.dark.main, (.8 + .4 * Math.sin(age * 9 + i)) * fade);
    }
  }
  /** Black and pale feathers falling slowly, swaying, through a ring of pale light, round a pillar of dark where the victim was. */
  private feathers(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number, grow: number) {
    for (let i = 0, n = st.n(54, 20); i < n; i++) {
      const h = hash(i * 4.9 + storm.seed), a = h * TAU, r = .5 + 4 * hash(i * 7.7), top = 3 + 3 * hash(i * 1.1);
      const y = storm.ground.y + Math.max(.05, top - age * (.9 + 1.1 * h)), sway = Math.sin(age * 3 + i) * .35;
      this.a.set(storm.at.x + Math.cos(a) * r + sway, y, storm.at.z + Math.sin(a) * r);
      this.b.set(this.a.x + .1 + sway * .4, y - .26, this.a.z + .06);
      const pale = i % 3 === 0;
      st.streak(this.a, this.b, .09 + .05 * h, pale ? finale.look.main : finale.dark.main, (pale ? .8 : 1.15) * fade * grow);
    }
    for (let i = 0, n = st.n(24, 12); i < n; i++) {
      const a0 = i / n * TAU + age * .4, a1 = (i + 1) / n * TAU + age * .4, r = 2.4 + 1.6 * grow, y = storm.ground.y + .1 + 1.2 * grow;
      this.a.set(storm.at.x + Math.cos(a0) * r, y, storm.at.z + Math.sin(a0) * r); this.b.set(storm.at.x + Math.cos(a1) * r, y, storm.at.z + Math.sin(a1) * r);
      st.streak(this.a, this.b, .08, finale.look.core, .7 * fade);
    }
  }

  /** Bolts striking the floor round the victim out of the sky, one after another, each jagged, with its flash on the floor. */
  private thunder(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number) {
    const strikes = 12;
    for (let k = 0; k < strikes; k++) {
      const at = k * .11 + .05 * hash(k + storm.seed), life = age - at;
      if (life < 0 || life > .32) continue;
      const a = hash(k * 3.7 + storm.seed) * TAU, r = 1.2 + 3 * hash(k * 5.3 + storm.seed), flick = life < .08 ? 1 : (1 - (life - .08) / .24) * (.6 + .4 * Math.sin(life * 90));
      const gx = storm.ground.x + Math.cos(a) * r, gz = storm.ground.z + Math.sin(a) * r;
      this.a.set(gx + (hash(k * 2.1) - .5) * 2, storm.ground.y + 11, gz + (hash(k * 4.4) - .5) * 2);
      for (let j = 1; j <= 7; j++) {
        const f = j / 7, jag = (1 - f) * .7;
        this.b.set(gx + (this.a.x - gx) * (1 - f) + (hash(k * 9 + j) - .5) * jag, storm.ground.y + 11 * (1 - f), gz + (this.a.z - gz) * (1 - f) + (hash(k * 7 + j * 3) - .5) * jag);
        st.streak(this.a, this.b, .26, finale.look.main, 1.3 * flick * fade); st.streak(this.a, this.b, .08, finale.look.core, 1.6 * flick * fade);
        this.a.copy(this.b);
      }
      this.c.set(gx, storm.ground.y + .2, gz);
      st.glow(this.c, 1.3, finale.look.main, .5 * flick * fade); st.glow(this.c, .5, finale.look.core, .7 * flick * fade);
    }
    st.glow(this.c.set(storm.at.x, storm.ground.y + 6, storm.at.z), 4.5, finale.look.main, .12 * fade);
  }
  /** Crescents of light sweeping round the victim at three heights, turning, and petals falling through them. */
  private harvest(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number, grow: number) {
    for (let ring = 0; ring < 3; ring++) {
      const y = storm.ground.y + .5 + ring * 1.1, r = (1.2 + .5 * ring) * (.5 + .5 * grow), turn = age * (5 - ring) * (ring % 2 ? -1 : 1) + ring * 2.1;
      for (let j = 0, n = 10; j < n; j++) {
        const a0 = turn + j / n * Math.PI * 1.1, a1 = turn + (j + 1) / n * Math.PI * 1.1, w = .05 + .22 * Math.sin(Math.PI * (j + .5) / n);
        this.a.set(storm.at.x + Math.cos(a0) * r, y, storm.at.z + Math.sin(a0) * r); this.b.set(storm.at.x + Math.cos(a1) * r, y, storm.at.z + Math.sin(a1) * r);
        st.streak(this.a, this.b, w, finale.look.main, 1.2 * fade); st.streak(this.a, this.b, w * .35, finale.look.core, 1.4 * fade);
      }
    }
    for (let i = 0, n = st.n(40, 16); i < n; i++) {
      const h = hash(i * 4.3 + storm.seed), a = h * TAU, r = .4 + 2.6 * hash(i * 6.6), y = storm.ground.y + Math.max(.05, 3.5 + 2 * hash(i * 2.2) - age * (1.2 + h));
      const sway = Math.sin(age * 4 + i) * .3;
      this.a.set(storm.at.x + Math.cos(a) * r + sway, y, storm.at.z + Math.sin(a) * r); this.b.set(this.a.x + .12, y - .12, this.a.z + .08);
      st.streak(this.a, this.b, .1, finale.dark.main, .95 * fade * grow);
    }
  }
  /** Black wings rising out of the floor round the victim in a column, spiralling up, edged in violet, over a pool of dark. */
  private rookery(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number, grow: number, outward = false) {
    st.glow(this.c.copy(storm.ground).setY(storm.ground.y + .1), 3.4 * (.5 + .5 * grow), finale.look.main, .2 * fade);
    for (let i = 0, n = st.n(46, 18); i < n; i++) {
      const h = hash(i * 3.9 + storm.seed), born = h * .7, life = age - born;
      if (life < 0) continue;
      const a = h * TAU * 3 + life * (3 + 2 * hash(i)) * (outward ? .4 : 1), r = 1.1 + 1.6 * hash(i * 8.8) + life * (outward ? 3.2 : -.25), y = storm.ground.y + .1 + life * (outward ? 1.6 + 2 * hash(i * 1.7) : 3.2 + 2.4 * hash(i * 1.7));
      this.a.set(storm.at.x + Math.cos(a) * r, y, storm.at.z + Math.sin(a) * r);
      // a wing: a dark stroke swept out from the body, its leading edge lit
      const flap = Math.sin(life * 18 + i) * .25;
      this.b.set(this.a.x + Math.cos(a + 1.6) * .45, y + .1 + flap, this.a.z + Math.sin(a + 1.6) * .45);
      this.c.set(this.a.x + Math.cos(a - 1.6) * .45, y + .1 - flap, this.a.z + Math.sin(a - 1.6) * .45);
      const f = fade * (1 - clamp((life - 1.2) / .4));
      st.streak(this.a, this.b, .16, finale.dark.main, 1.2 * f); st.streak(this.a, this.c, .16, finale.dark.main, 1.2 * f);
      st.streak(this.b, this.c, .04, finale.look.main, .9 * f);
    }
  }
  /** Stone thrown up out of the floor round the victim (slabs: standing up in a ring and sinking, with a seal burning under
   *  them; else boulders flying up and raining back down, with rings of light rolling out over the floor). */
  private rocks(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number, grow: number, slabs: boolean) {
    if (slabs) {
      for (let i = 0, n = 14; i < n; i++) {
        const a = i / n * TAU + hash(i + storm.seed) * .3, r = 2.4 + .5 * hash(i * 3.3), rise = clamp((age - .03 * i) / .18) * (1 - clamp((age - 1.1) / .6));
        if (rise <= 0) continue;
        const h = (1.4 + 1.6 * hash(i * 5.5 + storm.seed)) * rise, lean = .35 * (hash(i * 7.1) - .2);
        this.a.set(storm.ground.x + Math.cos(a) * r, storm.ground.y, storm.ground.z + Math.sin(a) * r);
        this.b.set(storm.ground.x + Math.cos(a) * (r + lean), storm.ground.y + h, storm.ground.z + Math.sin(a) * (r + lean));
        st.streak(this.a, this.b, .7 + .3 * hash(i * 2.7), finale.dark.main, 1.4 * fade); st.streak(this.b, this.c.copy(this.b).setY(this.b.y + .06), .3, finale.look.main, .7 * fade);
      }
      for (let j = 0, n = 32; j < n; j++) {
        const a0 = j / n * TAU, a1 = (j + 1) / n * TAU, r = 1.7 * (.6 + .4 * grow), y = storm.ground.y + .06;
        this.a.set(storm.ground.x + Math.cos(a0) * r, y, storm.ground.z + Math.sin(a0) * r); this.b.set(storm.ground.x + Math.cos(a1) * r, y, storm.ground.z + Math.sin(a1) * r);
        st.streak(this.a, this.b, .1, finale.look.main, 1.2 * fade);
        if (j % 4 === 0) { this.c.set(storm.ground.x + Math.cos(a0) * r * .35, y, storm.ground.z + Math.sin(a0) * r * .35); st.streak(this.a, this.c, .07, finale.look.main, 1.1 * fade); }
      }
      return;
    }
    for (let i = 0, n = st.n(20, 10); i < n; i++) {
      const h = hash(i * 6.1 + storm.seed), a = h * TAU, v = 1.5 + 3.5 * hash(i * 2.9), up = 5 + 4 * hash(i * 8.3), t = age * .9;
      const y = storm.ground.y + Math.max(.2, up * t - 6 * t * t), x = Math.cos(a) * v * t, z = Math.sin(a) * v * t, s = .22 + .22 * hash(i * 1.3);
      this.a.set(storm.at.x + x, y, storm.at.z + z); this.b.copy(this.a).addScaledVector(this.c.set(Math.cos(a + 2), .3, Math.sin(a + 2)), s);
      st.streak(this.a, this.b, s * 1.2, finale.dark.main, 1.3 * fade); st.streak(this.a, this.b, s * .25, finale.look.main, .5 * fade);
    }
    for (let ring = 0; ring < 3; ring++) {
      const life = age - ring * .3; if (life < 0 || life > .9) continue;
      const r = 1 + 5.5 * life, f = (1 - life / .9) * fade;
      for (let j = 0, n = 24; j < n; j++) {
        const a0 = j / n * TAU, a1 = (j + 1) / n * TAU, y = storm.ground.y + .08;
        this.a.set(storm.ground.x + Math.cos(a0) * r, y, storm.ground.z + Math.sin(a0) * r); this.b.set(storm.ground.x + Math.cos(a1) * r, y, storm.ground.z + Math.sin(a1) * r);
        st.streak(this.a, this.b, .16, finale.look.main, 1.2 * f);
      }
    }
  }

  /** One crimson cut drawn across the room through the victim, square to the blow, and its wake rolling out in rings. */
  private wake(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number, grow: number) {
    const across = this.c.set(storm.dir.z, 0, -storm.dir.x), reach = 3 + 9 * clamp(age / .18), y = storm.at.y + .1;
    this.a.copy(storm.at).addScaledVector(across, -reach).setY(y); this.b.copy(storm.at).addScaledVector(across, reach).setY(y);
    const cut = fade * (1 - clamp((age - .6) / .9));
    st.streak(this.a, this.b, .5 * cut + .05, finale.look.main, 1.2 * cut); st.streak(this.a, this.b, .12 * cut + .02, finale.look.core, 1.5 * cut);
    this.a.y = this.b.y = y + .35; st.streak(this.a, this.b, .3 * cut, finale.dark.main, 1.1 * cut);
    this.ripples(st, storm, finale.look, age, fade, 4, 7);
  }
  /** Rings rolling out over the floor from the storm, one after another. */
  private ripples(st: MoveStage, storm: Storm, look: StageLook, age: number, fade: number, count: number, reach: number) {
    for (let ring = 0; ring < count; ring++) {
      const life = age - ring * .22; if (life < 0 || life > 1) continue;
      const r = .8 + reach * life, f = (1 - life) * fade;
      for (let j = 0, n = 28; j < n; j++) {
        const a0 = j / n * TAU, a1 = (j + 1) / n * TAU, y = storm.ground.y + .07;
        this.a.set(storm.ground.x + Math.cos(a0) * r, y, storm.ground.z + Math.sin(a0) * r); this.b.set(storm.ground.x + Math.cos(a1) * r, y, storm.ground.z + Math.sin(a1) * r);
        st.streak(this.a, this.b, .14, look.main, 1.15 * f);
      }
    }
  }
  /** The floor rolling out from the blow in waves: slabs of the seabed heaving up in ring after ring, and settling. */
  private seabed(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number) {
    for (let wave = 0; wave < 3; wave++) {
      const life = age - wave * .3; if (life < 0 || life > 1.1) continue;
      const r = 1.4 + 4.2 * life, n = 10 + wave * 3, heave = Math.sin(Math.PI * clamp(life / 1.1));
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + wave * .4 + hash(i + storm.seed) * .2, h = (.7 + .9 * hash(i * 2.3 + wave)) * heave;
        this.a.set(storm.ground.x + Math.cos(a) * r, storm.ground.y, storm.ground.z + Math.sin(a) * r);
        this.b.set(this.a.x + Math.cos(a) * .3, storm.ground.y + h, this.a.z + Math.sin(a) * .3);
        st.streak(this.a, this.b, .55 + .25 * hash(i * 4.1), finale.dark.main, 1.3 * fade); st.streak(this.b, this.c.copy(this.b).setY(this.b.y + .05), .45, finale.look.main, .8 * fade * heave);
      }
    }
    this.ripples(st, storm, finale.look, age, fade, 3, 6);
  }
  /** A setting sun sinking on the floor beyond the victim, the horizon drawn across it in gold, and the light divided. */
  private sunset(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number, grow: number) {
    const across = this.c.set(storm.dir.z, 0, -storm.dir.x), sink = clamp(age / 1.6);
    this.a.copy(storm.ground).addScaledVector(storm.dir, 1.2); this.a.y = storm.ground.y + 1.8 - 1.2 * sink;
    st.glow(this.a, 2.6 + 1.2 * grow, finale.dark.main, .4 * fade); st.glow(this.a, 1.3 + .5 * grow, finale.look.core, .45 * fade);
    const reach = 2 + 7 * clamp(age / .25), y = storm.ground.y + .5;
    this.a.copy(storm.ground).addScaledVector(across, -reach).setY(y); this.b.copy(storm.ground).addScaledVector(across, reach).setY(y);
    st.streak(this.a, this.b, .16, finale.look.main, 1.2 * fade); st.streak(this.a, this.b, .05, finale.look.core, 1.5 * fade);
    const cut = 1 - clamp((age - .5) / .8);
    this.a.copy(storm.at).setY(storm.ground.y); this.b.copy(storm.at).setY(storm.ground.y + 7 * clamp(age / .15));
    st.streak(this.a, this.b, .22 * cut, finale.look.core, 1.4 * cut * fade);
    for (let i = 0, n = st.n(24, 10); i < n; i++) {
      const h = hash(i * 5.9 + storm.seed), a = h * TAU, r = .5 + 3 * hash(i * 2.1), y2 = storm.ground.y + .2 + age * (1 + h) + 2 * hash(i * 7.7);
      this.a.set(storm.at.x + Math.cos(a) * r, y2, storm.at.z + Math.sin(a) * r); this.b.copy(this.a); this.b.y += .12;
      st.streak(this.a, this.b, .08, finale.look.main, fade * (.7 + .3 * Math.sin(age * 8 + i)));
    }
  }
  /** A red moon hanging over the victim. */
  private moon(st: MoveStage, storm: Storm, finale: Finale, fade: number, grow: number) {
    this.a.copy(storm.ground); this.a.y += 5.5;
    st.glow(this.a, 2.2 + .8 * grow, finale.look.main, .5 * fade); st.glow(this.a, 1.5 + .4 * grow, finale.look.core, .3 * fade);
    st.glow(this.a, 4.5, finale.look.main, .12 * fade);
  }
  /** Flat crescents of wind sweeping the floor round the victim, turning fast, and the dust blown out of the circle. */
  private sweep(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number, grow: number) {
    for (let ring = 0; ring < 4; ring++) {
      const y = storm.ground.y + .15 + ring * .32, r = (1 + .42 * ring) * (.5 + .5 * grow), turn = age * (9 - ring) * (ring % 2 ? -1 : 1) + ring * 1.7;
      for (let j = 0, n = 10; j < n; j++) {
        const a0 = turn + j / n * Math.PI * 1.25, a1 = turn + (j + 1) / n * Math.PI * 1.25, w = .04 + .18 * Math.sin(Math.PI * (j + .5) / n);
        this.a.set(storm.at.x + Math.cos(a0) * r, y, storm.at.z + Math.sin(a0) * r); this.b.set(storm.at.x + Math.cos(a1) * r, y, storm.at.z + Math.sin(a1) * r);
        st.streak(this.a, this.b, w, finale.look.main, 1.2 * fade); st.streak(this.a, this.b, w * .3, finale.look.core, 1.3 * fade);
      }
    }
    for (let i = 0, n = st.n(36, 14); i < n; i++) {
      const h = hash(i * 3.1 + storm.seed), a = h * TAU, r = .4 + age * (3 + 4 * hash(i * 6.2)), y = storm.ground.y + .1 + .6 * hash(i * 9.4);
      this.a.set(storm.ground.x + Math.cos(a) * r, y, storm.ground.z + Math.sin(a) * r); this.b.set(storm.ground.x + Math.cos(a) * (r + .5), y + .05, storm.ground.z + Math.sin(a) * (r + .5));
      st.streak(this.a, this.b, .14, finale.dark.main, 1.1 * fade * (1 - clamp(age / 1.4)));
    }
  }

  /** A spiral of light corkscrewing on out beyond the victim along the blow, and pages scattering in it. */
  private spiral(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number, grow: number) {
    const across = this.c.set(storm.dir.z, 0, -storm.dir.x), length = 2 + 9 * clamp(age / .35), turns = 4, n = 40;
    for (let strand = 0; strand < 2; strand++) {
      let first = true;
      for (let j = 0; j <= n; j++) {
        const f = j / n, ang = f * turns * TAU - age * 9 + strand * Math.PI, r = .55 + .5 * f;
        this.b.copy(storm.at).addScaledVector(storm.dir, f * length).addScaledVector(across, Math.cos(ang) * r); this.b.y += Math.sin(ang) * r;
        if (!first) { st.streak(this.a, this.b, .1, finale.look.main, 1.15 * fade); st.streak(this.a, this.b, .035, finale.look.core, 1.3 * fade); }
        this.a.copy(this.b); first = false;
      }
    }
    for (let i = 0, n2 = st.n(30, 12); i < n2; i++) {
      const h = hash(i * 7.7 + storm.seed), along = h * length, ang = h * 40 + age * (3 + 2 * hash(i)), r = .8 + 1.8 * hash(i * 3.4) * grow;
      this.a.copy(storm.at).addScaledVector(storm.dir, along).addScaledVector(across, Math.cos(ang) * r); this.a.y += Math.sin(ang) * r - age * .5;
      this.b.copy(this.a).addScaledVector(across, .2); this.b.y += .06 * Math.sin(age * 12 + i);
      st.streak(this.a, this.b, .16, finale.dark.main, .9 * fade);
    }
  }
  /** The punch's corridor: wind streaming out beyond the victim in a widening cone, grit blown with it, a clean circle on the floor. */
  private slate(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number, grow: number) {
    const across = this.c.set(storm.dir.z, 0, -storm.dir.x);
    for (let i = 0, n = st.n(44, 18); i < n; i++) {
      const h = hash(i * 2.7 + storm.seed), u = hash(i * 9.1), along = ((age * (14 + 8 * h) + u * 6) % 14), spread = .3 + along * .22;
      const side = (hash(i * 4.3) - .5) * 2 * spread, up = (hash(i * 5.9) - .3) * spread;
      this.a.copy(storm.at).addScaledVector(storm.dir, along).addScaledVector(across, side); this.a.y += up;
      this.b.copy(this.a).addScaledVector(storm.dir, 1.2 + 1.5 * h);
      const pale = i % 3 === 0;
      st.streak(this.a, this.b, pale ? .06 : .1, pale ? finale.look.core : finale.look.main, (pale ? 1.2 : .9) * fade * (1 - along / 16));
    }
    for (let i = 0, n = st.n(24, 10); i < n; i++) {
      const h = hash(i * 6.3 + storm.seed + 2), along = age * (6 + 6 * h), side = (hash(i * 1.9) - .5) * (1 + along * .4);
      this.a.copy(storm.ground).addScaledVector(storm.dir, along).addScaledVector(across, side); this.a.y += .15 + .5 * hash(i * 8.2);
      this.b.copy(this.a).addScaledVector(storm.dir, .5);
      st.streak(this.a, this.b, .16, finale.dark.main, 1.1 * fade * (1 - clamp(age / 1.5)));
    }
    for (let j = 0, n = 32; j < n; j++) {
      const a0 = j / n * TAU, a1 = (j + 1) / n * TAU, r = 2.2 * (.6 + .4 * grow), y = storm.ground.y + .05;
      this.a.set(storm.ground.x + Math.cos(a0) * r, y, storm.ground.z + Math.sin(a0) * r); this.b.set(storm.ground.x + Math.cos(a1) * r, y, storm.ground.z + Math.sin(a1) * r);
      st.streak(this.a, this.b, .09, finale.look.main, fade);
    }
  }
  /** Rings of staff lines rising round where the victim stood, turning slowly, and panes of stained glass falling through them. */
  private hymn(st: MoveStage, storm: Storm, finale: Finale, age: number, fade: number, grow: number) {
    for (let staff = 0; staff < 3; staff++) {
      const base = storm.ground.y + .4 + staff * 1.2 + age * .5, r = (1.6 + .5 * staff) * (.5 + .5 * grow), turn = age * (.8 + .3 * staff) * (staff % 2 ? -1 : 1);
      for (let line = 0; line < 5; line++) {
        const y = base + line * .11;
        for (let j = 0, n = 14; j < n; j++) {
          const a0 = turn + j / n * Math.PI * 1.4, a1 = turn + (j + 1) / n * Math.PI * 1.4;
          this.a.set(storm.at.x + Math.cos(a0) * r, y, storm.at.z + Math.sin(a0) * r); this.b.set(storm.at.x + Math.cos(a1) * r, y, storm.at.z + Math.sin(a1) * r);
          st.streak(this.a, this.b, .025, line === 2 ? finale.look.core : finale.look.main, .95 * fade);
        }
      }
    }
    for (let i = 0, n = st.n(26, 10); i < n; i++) {
      const h = hash(i * 5.3 + storm.seed), a = h * TAU, r = .5 + 2.6 * hash(i * 3.1), y = storm.ground.y + Math.max(.05, 4 + 1.5 * hash(i * 6.6) - age * (1.6 + h));
      this.a.set(storm.at.x + Math.cos(a) * r, y, storm.at.z + Math.sin(a) * r);
      this.b.set(this.a.x + .16 * Math.cos(age * 5 + i), y + .22, this.a.z + .16 * Math.sin(age * 5 + i));
      st.streak(this.a, this.b, .2, i % 2 ? finale.dark.main : finale.look.main, 1.1 * fade * grow);
    }
  }

  /** Whether an original of the table is throwing its ultimate now. */
  private throwing(fighters: ReadonlyMap<string, Fighter>) {
    for (const f of fighters.values()) if (FINALES[f.state.fighter] && f.state.action === 'ultimate' && f.state.alive) return true;
    return false;
  }
  reset() { for (const s of this.storms) s.live = false; this.seen.clear(); this.until = -1e9; this.stage?.reset(); }
  dispose() { for (const s of this.storms) s.live = false; this.seen.clear(); if (this.stage) { this.stage.reset(); this.stage.release(); this.stage = undefined; } }
}
