import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CombatEffects, FLIGHTS } from '../src/render/CombatEffects';
import { NinjaEffects } from '../src/render/NinjaEffects';
import { GummyEffects } from '../src/render/GummyEffects';
import { SetsuEffects } from '../src/render/SetsuEffects';
import { KuonEffects } from '../src/render/KuonEffects';
import { WardEffects } from '../src/render/WardEffects';
import { GauntEffects } from '../src/render/GauntEffects';
import { GoldenTechniques, transmissionHidden } from '../src/render/signature/GoldenTechniques';
import { ThreeBladeEffects as ThreeBlade } from '../src/render/signature/ThreeBlade';
import { UnsealedEffects as Unsealed } from '../src/render/signature/Unsealed';
import { MOVES } from '../src/game/moves';
import { elementFor, enderElement, techniqueColour, ENDER_ELEMENTS } from '../src/render/vfx/palette';
import { COMBO_KEYS, type ComboKey } from '../src/game/combos';
import type { Fighter } from '../src/render/Fighter';
import type { AttackSlot, CombatEvent, FighterId, PlayerState } from '../src/game/types';

/**
 * Vol.1's combo enders (game/combos.ts) are drawn as their own moves, never as the slot's signature: a Light, Heavy
 * thrown from Konta's heavy is no Senpugan, an ender off Taisei's heavy no Cloudstep, one off Kagari's special no
 * Taimatsu. Every effect site that keyed on the heavy or the special alone (the research's list) checks the branch now.
 * These hold whatever the rows make the enders - a blow, a blast or a snare.
 */
const VOL1: readonly FighterId[] = ['taisei', 'konta', 'gummy', 'kosho', 'ouga', 'shirokane', 'shiden', 'kenzo', 'koko', 'nigo', 'kagari', 'ward', 'kuon', 'oro', 'gaunt', 'setsu'];
const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 'a', name: 'X', fighter: 'konta', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle', actionStarted: 1, actionTime: 0, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
function body(id: string, fighter: FighterId, props: Partial<PlayerState> = {}): Fighter {
  const state = player({ id, fighter, ...props });
  const group = new THREE.Group(); group.name = `fighter-${id}`; group.position.set(state.x, state.y, state.z);
  const model = new THREE.Group(); group.add(model);
  const hips = new THREE.Bone(); hips.name = 'Hips'; hips.position.y = 1; model.add(hips);
  const handR = new THREE.Vector3(.2, 1.2, .4), handL = new THREE.Vector3(-.2, 1.2, .4);
  return { state, group, model, velocity: new THREE.Vector3(), handR, handL, bones: new Map(), joints: new Map([['Hips', hips]]), clips: [], armed: false,
    chargePosition(out: THREE.Vector3) { return out.copy(handR); }, meleeContactPoint() { return false; }, strikePoint(out: THREE.Vector3) { return out.copy(handR); } } as unknown as Fighter;
}
const cast = (fighter: FighterId, slot: AttackSlot, branch?: ComboKey, id = 10): CombatEvent => ({ id, kind: 'cast', serverTime: 1, actorId: 'a', fighter, slot, actionSeq: 3,
  ...(branch ? { branch } : {}), origin: { x: 0, y: 1.2, z: .4 }, endpoint: { x: 0, y: 1.2, z: 8 }, seed: 5 });
const named = (scene: THREE.Scene, name: string) => { let found = false; scene.traverse(o => { if (o.name === name) found = true; }); return found; };

describe('CombatEffects draws an ender as its own move', () => {
  const thrown = (fighter: FighterId, slot: AttackSlot, branch?: ComboKey) => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene), actor = body('a', fighter, { action: slot, actionSeq: 3, branch });
    const fighters = new Map([['a', actor]]);
    fx.handle([cast(fighter, slot, branch)], fighters);
    fx.update(1.1, 1 / 60, fighters);
    return { scene, fx };
  };
  const signature: [FighterId, AttackSlot, string][] = [['kagari', 'special', 'taimatsu-taimatsu'], ['konta', 'special', 'galewheel-swallow-darts'], ['kosho', 'special', 'ram-crescent']];
  for (const [fighter, slot, mark] of signature) it(`no ${mark} on ${fighter}'s enders off the ${slot}`, () => {
    const own = thrown(fighter, slot);
    try { expect(named(own.scene, mark), 'the slot\'s own move still has it').toBe(true); } finally { own.fx.dispose(); }
    for (const key of COMBO_KEYS) {
      // (Konta's Light x3, Special is the Mini Galewheel - its own move, drawn with the blades: below.)
      if (fighter === 'konta' && key === 'llls') continue;
      const ender = thrown(fighter, slot, key);
      try { expect(named(ender.scene, mark), `${fighter} ${key}`).toBe(false); } finally { ender.fx.dispose(); }
    }
  });
  it('throws Konta\'s Mini Galewheel as a Galewheel, at its own size and on its own clock', () => {
    const ender = thrown('konta', 'special', 'llls');
    try { expect(named(ender.scene, 'galewheel-swallow-darts')).toBe(true); } finally { ender.fx.dispose(); }
  });
  it('never puts the Senpugan in Konta\'s palm for an ender off the heavy but the Giant Senpugan', () => {
    const own = thrown('konta', 'heavy');
    // The Senpugan's cast: its two orbital rings in the palm.
    const rings = (scene: THREE.Scene) => { let n = 0; scene.traverse(o => { if (o.name.startsWith('cast-')) o.traverse(m => { if ((m as THREE.Mesh).isMesh && (m as THREE.Mesh).geometry instanceof THREE.TorusGeometry) n++; }); }); return n; };
    try { expect(rings(own.scene)).toBe(2); } finally { own.fx.dispose(); }
    for (const key of ['lh', 'llh', 'airHeavy'] as const) {
      const ender = thrown('konta', 'heavy', key);
      try { expect(rings(ender.scene), key).toBe(0); } finally { ender.fx.dispose(); }
    }
    // His Light x3, Heavy is the Giant Senpugan: a Senpugan in the palm, its own move (combosVol1.ts).
    const big = thrown('konta', 'heavy', 'lllh');
    try { expect(rings(big.scene), 'the Giant Senpugan').toBe(2); } finally { big.fx.dispose(); }
  });
  it('does not hide an ender of LORD ORO\'s as his knife throw, nor hand its flight to the knives', () => {
    const own = thrown('oro', 'heavy');
    const group = (scene: THREE.Scene) => scene.children.find(o => o.name === 'cast-10');
    try { expect(group(own.scene)?.visible).toBe(false); } finally { own.fx.dispose(); }
    FLIGHTS.clear();
    const ender = thrown('oro', 'heavy', 'lh');
    try {
      const g = group(ender.scene);
      // A blow is drawn where it lands; a blast flies as itself. Neither is the hidden knife group.
      if (g) expect(g.visible).toBe(true);
      for (const flight of FLIGHTS.values()) expect(flight.fighter === 'oro' && flight.slot === 'heavy' && !flight.branch, 'a knife flight').toBe(false);
    } finally { ender.fx.dispose(); FLIGHTS.clear(); }
  });
  it('carries the branch on the flights it records', () => {
    FLIGHTS.clear();
    const scene = new THREE.Scene(), fx = new CombatEffects(scene), actor = body('a', 'kagari', { action: 'special', actionSeq: 3, branch: 'llls' });
    const fighters = new Map([['a', actor]]);
    try {
      fx.handle([cast('kagari', 'special', 'llls')], fighters);
      for (let t = 1; t < 2; t += 1 / 30) fx.update(t, 1 / 30, fighters);
      for (const flight of FLIGHTS.values()) expect(flight.branch).toBe('llls');
    } finally { fx.dispose(); FLIGHTS.clear(); }
  });
});

describe('the palette colours an ender by its own element', () => {
  it('gives every Vol.1 fighter an ender element, and the shop none (their enders keep their slot\'s colours)', () => {
    for (const f of VOL1) for (const key of COMBO_KEYS) expect(enderElement(f, key), `${f} ${key}`).toBeDefined();
    for (const f of ['gorai', 'shiun', 'tobari', 'gaku'] as const) {
      expect(ENDER_ELEMENTS[f]).toBeUndefined();
      expect(elementFor(f, 'heavy', false, 0, 'lh')).toBe(elementFor(f, 'heavy'));
      expect(techniqueColour(f, 'special', false, 'llls')).toBe(techniqueColour(f, 'special'));
    }
  });
  it('lands Konta\'s Light, Heavy in his chi, not the Senpugan\'s blue, and Taisei\'s enders in ki, not a plain fist', () => {
    expect(elementFor('konta', 'heavy', false, 0, 'lh')).not.toBe(elementFor('konta', 'heavy'));
    expect(elementFor('taisei', 'heavy', false, 0, 'llh')).not.toBe(elementFor('taisei', 'heavy'));
    expect(techniqueColour('konta', 'heavy', false, 'lh')).not.toBe(techniqueColour('konta', 'heavy'));
    // A light is never an ender, whatever is passed.
    expect(elementFor('konta', 'light', false, 0, 'lh')).toBe(elementFor('konta', 'light'));
  });
});

describe('the signature layers leave an ender alone', () => {
  it('keeps Taisei in sight through an ender off the heavy (no Cloudstep)', () => {
    const T = MOVES.taisei.heavy.teleport!, mid = (T.vanish + T.appear) / 2;
    expect(transmissionHidden('taisei', 'heavy', mid)).toBe(true);
    for (const key of ['lh', 'llh', 'lllh', 'airHeavy']) expect(transmissionHidden('taisei', 'heavy', mid, key)).toBe(false);
    const scene = new THREE.Scene(), fx = new GoldenTechniques(scene);
    const taisei = body('g', 'taisei', { action: 'heavy', branch: 'lh', actionStarted: 1, actionDuration: MOVES.taisei.heavy.duration, actionTime: mid / MOVES.taisei.heavy.duration });
    fx.update(1 + mid, new Map([['g', taisei]]), 1);
    expect(taisei.group.visible).toBe(true);
  });
  it('tracks no Galewheel, Ikazuchi, Blue, ROOM, Phoenix or Nightfang for an ender cast off the special', () => {
    const scene = new THREE.Scene();
    const fighters = (f: FighterId, slot: AttackSlot, branch?: ComboKey) => new Map([['a', body('a', f, { action: slot, branch })]]);
    const ninja = new NinjaEffects(scene);
    ninja.handle([cast('konta', 'special', 'llls')], fighters('konta', 'special', 'llls'));
    expect((ninja as unknown as { rasen: unknown[] }).rasen).toHaveLength(0);
    ninja.handle([cast('konta', 'special', undefined, 11)], fighters('konta', 'special'));
    expect((ninja as unknown as { rasen: unknown[] }).rasen).toHaveLength(1);
    const setsu = new SetsuEffects(scene);
    setsu.handle([cast('setsu', 'special', 'llls', 12)]);
    // An ender is tracked only when it is thrown, as lightning on its own move: never as the Ikazuchi.
    for (const c of (setsu as unknown as { casts: { move: unknown }[] }).casts) expect(c.move).not.toBe(MOVES.setsu.special);
    const kuon = new KuonEffects(scene);
    kuon.handle([cast('kuon', 'heavy', 'lh', 13), cast('kuon', 'special', 'airSpecial', 14)]);
    for (const c of (kuon as unknown as { charges: { tone?: string }[] }).charges) expect(c.tone, 'an ender sphere of its own tone').toBeDefined();
    expect((kuon as unknown as { purples: unknown[] }).purples).toHaveLength(0);
    const ward = new WardEffects(scene);
    ward.handle([cast('ward', 'special', 'llls', 15)], fighters('ward', 'special', 'llls'));
    expect((ward as unknown as { rooms: { active: boolean }[] }).rooms.some(r => r.active)).toBe(false);
    const santoryu = new ThreeBlade(scene), unsealed = new Unsealed(scene);
    santoryu.handle([cast('kenzo', 'special', 'llls', 16)]); unsealed.handle([cast('nigo', 'special', 'airSpecial', 17)]);
    expect((santoryu as unknown as { casts: unknown[] }).casts).toHaveLength(0);
    expect((unsealed as unknown as { casts: unknown[] }).casts).toHaveLength(0);
    for (const fx of [ninja, setsu, kuon, ward, santoryu, unsealed]) fx.dispose();
  });
  it('fires no Scrap Cannon Arm and dresses no Signal Fire flame for an ender', () => {
    const scene = new THREE.Scene(), gaunt = new GauntEffects(scene), gummy = new GummyEffects(scene);
    const gauntBody = body('g', 'gaunt', { action: 'special', branch: 'llls', actionStarted: 1, actionDuration: 1.5, actionTime: .8 / 1.5 });
    gaunt.update(1.8, new Map([['g', gauntBody]]), 1);
    expect((gaunt as unknown as { flashes: THREE.InstancedMesh }).flashes.count).toBe(0);
    FLIGHTS.clear();
    FLIGHTS.set('9:0', { fighter: 'gummy', slot: 'special', branch: 'llls', position: new THREE.Vector3(0, 1.2, 3), heading: new THREE.Vector3(0, 0, 1), released: true, since: 1 });
    gummy.update(1.2, new Map(), 1);
    const fists = scene.children.filter(o => o.name === 'signal-flare-orb' && o.visible && o.position.y > -40);
    expect(fists, 'no Signal Fire flame on an ender\'s flight').toHaveLength(0);
    FLIGHTS.clear(); gaunt.dispose(); gummy.dispose();
  });
});
