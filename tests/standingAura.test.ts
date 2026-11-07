import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import { AWAKENINGS } from '../src/game/awakening';
import type { FighterId, PlayerState } from '../src/game/types';
import { AwakeningEffects } from '../src/render/AwakeningEffects';
import type { Fighter } from '../src/render/Fighter';
import { PHYSICAL_PRESENCE, standingAura, standingColours } from '../src/render/standingAura';
import { awakenedPower, WORLDS } from '../src/render/awakenedPower';
import { HOME_EXPANSION_FIGHTERS, homeSeries } from '../src/ui/HomeRosterOrder';
import { originalWorld } from '../src/originals/apply';

const roster = Object.keys(AWAKENINGS) as FighterId[];
const wip: ReadonlySet<FighterId> = new Set(HOME_EXPANSION_FIGHTERS);
const ownBody = (id: FighterId) => AWAKENINGS[id].kind === 'aura' && !FIGHTERS[id].formModel;
/** The fighters whose world has its own power, and no longer falls back to the smaller aura. */
const elsewhere = (id: FighterId) => !WORLDS[homeSeries(id)];
const world = (id: FighterId) => originalWorld(homeSeries(id)) ?? homeSeries(id);
/** The work-in-progress fighters who stand the smaller aura without burning. */
const STANDING_AURA: Partial<Record<FighterId, number>> = Object.fromEntries(roster.filter(id => wip.has(id) && ownBody(id) && awakenedPower(id).shell === 'flame').map(id => [id, standingAura(id)!]));

const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 'a', name: 'X', fighter: 'taisei', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle', actionStarted: .5, actionTime: 0, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
function body(id: string, fighter: FighterId, props: Partial<PlayerState> = {}): Fighter {
  const state = player({ id, fighter, ...props });
  const group = new THREE.Group(); group.name = `fighter-${id}`; group.position.set(state.x, state.y, state.z);
  const geometry = new THREE.BoxGeometry(.4, 1.6, .3, 1, 4, 1), count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(count * 4).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(count * 4).fill(0).map((_, i) => i % 4 === 0 ? 1 : 0), 4));
  const hips = new THREE.Bone(); hips.position.y = 1;
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial()); mesh.name = 'body'; mesh.add(hips); mesh.bind(new THREE.Skeleton([hips]));
  group.add(mesh);
  const hand = new THREE.Vector3(0, 1.2, .4);
  return { state, group, velocity: new THREE.Vector3(), handR: hand, handL: hand.clone(), bones: new Map(), joints: new Map([['Hips', hips]]), armed: false } as unknown as Fighter;
}

describe('the standing aura of an awakened fighter', () => {
  it('is nobody\'s fallback any more: of the work-in-progress fighters only Bellows wears a flame, and it is his own', () => {
    for (const id of roster) {
      // (Bellows's world has a row and his furnace flame is a flame all the same: his own row's.)
      const expected = id === 'bellows';
      expect(STANDING_AURA[id] !== undefined, `${id} stands the smaller aura`).toBe(expected);
      if (expected) expect(AWAKENINGS[id].flames, `${id} stands the aura without burning`).toBeFalsy();
    }
    // Thirty-nine the night before. Dust Sea's fourteen stand Will now, Cinder Requiem's three their pressure, Konta's two a
    // cloak of chi, Hex Fallout's three hex energy, Salvage Wilds's two a shroud of Aura, and My Hero
    // Academia's four and Black Snow's one their power and their breath (Bellows's furnace flame is a flame still, and
    // is his row's).
    // ... and by the end of the day nobody falls back to it: a world with no power to show shows none.
    expect(Object.keys(STANDING_AURA)).toEqual(['bellows']);
  });

  it('leaves Last Sun\'s Taisei and Ouga as they were - a definition that burns keeps its own glow - and Last Sun\'s flame to Last Sun', () => {
    for (const id of roster) {
      if (world(id) !== 'Last Sun' || !ownBody(id)) continue;
      const look = AWAKENINGS[id];
      expect(standingAura(id), id).toBe(look.flames ? look.auraGlow ?? 1 : undefined);
    }
    expect(standingAura('taisei')).toBe(1); expect(standingAura('kuon')).toBeUndefined();
    expect(roster.filter(id => awakenedPower(id).shell === 'flame' && world(id) !== 'Last Sun').sort()).toEqual(['bellows', 'gaku']);
    for (const id of ['ippon', 'levin', 'sekka', 'asahi', 'imago', 'sorrel', 'dorado', 'haldor', 'kagari'] as const) expect(AWAKENINGS[id].flames, id).toBe(true);
    for (const id of ['sorrel', 'dorado', 'haldor', 'kagari'] as const) expect(standingAura(id)).toBe(0);
  });

  it('is close to the shop\'s strength, never Taisei\'s and Ouga\'s', () => {
    for (const [id, glow] of Object.entries(STANDING_AURA)) { expect(glow, id).toBeGreaterThanOrEqual(.2); expect(glow, id).toBeLessThanOrEqual(.45); }
  });

  it('draws a pale-cored aura in its colour, not as a white outline, and leaves a saturated one and every released one as written', () => {
    const saturation = (hex: number) => { const r = hex >> 16 & 255, g = hex >> 8 & 255, b = hex & 255, max = Math.max(r, g, b); return max ? (max - Math.min(r, g, b)) / max : 0; };
    const shade = (hex: number) => Math.round((hex >> 16 & 255) * .5) << 16 | Math.round((hex >> 8 & 255) * .5) << 8 | Math.round((hex & 255) * .5);
    let pale = 0, vivid = 0;
    for (const id of roster) {
      const power = awakenedPower(id), written = AWAKENINGS[id].aura, drawn = standingColours(id, written);
      // A power with colours of its own (Will's haze, a captain's pressure) is drawn in them.
      if (power.colours) { expect(drawn, `${id} in the power's own colours`).toBe(power.colours); continue; }
      // No shell, or a definition that burns: as written.
      if (!power.shell || AWAKENINGS[id].flames) { expect(drawn, `${id} as written`).toBe(written); continue; }
      // A shell worn in the fighter's own aura without burning (the smaller aura; a cloak of chi; a shroud of Aura):
      // a white core with the fighter's colour as its rim (Suzuran's white and lavender) is drawn rim first, a deeper
      // shade of it the edge; a core that is already the colour (Murex's orange, Torsion's green) as written.
      if (saturation(written[0]) < .3 && saturation(written[1]) >= saturation(written[0]) + .1) { pale++; expect(drawn, `${id}: the rim is the aura`).toEqual([written[1], shade(written[1])]); }
      else { vivid++; expect(drawn, `${id} as written`).toBe(written); }
      expect(Math.max(saturation(drawn[0]), saturation(written[0])), `${id} stands a colour`).toBeGreaterThan(.25);
    }
    expect(pale).toBeGreaterThan(0); expect(vivid).toBeGreaterThan(0);
  });

  it('keeps Chohan physical: no energy stands on him', () => {
    expect(standingAura('chohan')).toBeUndefined();
    expect(PHYSICAL_PRESENCE.has('chohan')).toBe(true);
    for (const id of PHYSICAL_PRESENCE) expect(standingAura(id), `${id} is physical or energy, not both`).toBeUndefined();
  });

  it('draws the shell round an awakened stander for as long as it lasts, in their colours, and none round Chohan or a form', () => {
    // (Whoever still stands the smaller aura without burning; when no world falls back to it any more, a Golden.)
    const stander = (Object.keys(STANDING_AURA)[0] ?? 'taisei') as FighterId;
    const scene = new THREE.Scene(), aura = new AwakeningEffects(scene);
    const senko = body('k', stander, { awakened: true, awakenedUntil: 20 }), chohan = body('t', 'chohan', { x: 4, awakened: true, awakenedUntil: 20 }), konta = body('n', 'konta', { x: 8, awakened: true, awakenedUntil: 20 });
    const fighters = new Map([['k', senko], ['t', chohan], ['n', konta]]);
    const shells = () => scene.children.filter(o => o.name === 'aura-shell' && o.visible) as THREE.SkinnedMesh[];
    try {
      for (const f of fighters.values()) scene.add(f.group);
      for (const time of [2, 8, 15]) {
        aura.update(time, 1 / 60, fighters, 1);
        const drawn = shells();
        expect(drawn, `one shell ${time} s in`).toHaveLength(1);
        expect(drawn[0].skeleton).toBe((senko.group.getObjectByName('body') as THREE.SkinnedMesh).skeleton);
        const u = (drawn[0].material as THREE.ShaderMaterial).uniforms, colours = standingColours(stander, AWAKENINGS[stander].aura);
        expect((u.uCore.value as THREE.Color).getHex(), 'their colour').toBe(colours[0]);
        expect((u.uRim.value as THREE.Color).getHex()).toBe(colours[1]);
        expect(u.uStrength.value, 'at full strength').toBeCloseTo(1, 5);
      }
      senko.state.awakened = false;
      aura.update(15.1, 1 / 60, fighters, 1);
      expect(shells()).toHaveLength(0);
    } finally { aura.dispose(); }
  });
});
