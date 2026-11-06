import * as THREE from 'three';
import type { FighterId } from '../game/types';
import { SPRITE } from '../render/vfx/SparkField';
import type { VfxKit } from '../render/vfx/VfxKit';
import { ORIGINALS } from './roster';

/** The king's light, core then rim: molten copper and its ember (guardianLook.ts's body and rim). */
export const AKAGANE_EMBER = [0xffb466, 0xd2451a] as const;
const WHITE_HOT = 0xffe6b8, COPPER = 0xff7a2a, DEEP = 0x7a1c08;

/** render/EmperorEffects.ts WRATHFUL_KING: the light his awakening raises round him - the dome, the strike along the floor
 *  and the air breaking over his head - in the king's molten copper, not the WRATHFUL KING's blue (in the bloom's range,
 *  as the table's other colours are). */
export function applyOriginalRising(colour: THREE.Color) {
  if (ORIGINALS.akagane?.guardian) colour.setRGB(3.3, 1.15, .3);
  return colour;
}

/** render/awakenedPower.ts OWN: Akagane's row - his own power, not his world's chi. */
export function applyOriginalPowers<P>(own: Partial<Record<FighterId, Partial<P>>>) {
  if (ORIGINALS.akagane?.guardian)
    (own as Record<string, unknown>).akagane = { kind: 'plain', colours: AKAGANE_EMBER, motes: ['ember', 0xffb040, 0xc8401a] };
  return own;
}

const TAU = Math.PI * 2;
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Vector3();

/** The burst's own layer, for the fighters that have one: Akagane's ring of flame. `p` is the fighter's feet, `yaw` the way
 *  they face. Called once, on the burst's frame. */
export function originalBurst(fighter: FighterId, p: THREE.Vector3, yaw: number, time: number, kit: VfxKit) {
  if (fighter !== 'akagane' || !ORIGINALS.akagane?.guardian) return;
  const sp = kit.sparks.spec;
  _f.set(Math.sin(yaw), 0, Math.cos(yaw));
  _r.set(_f.z, 0, -_f.x);
  // The wheel's hub: behind his head and shoulders, where the king's ring burns behind its own.
  _c.copy(p).addScaledVector(_f, -.3); _c.y += 1.7;
  // The wheel itself: a white-hot ring, then its copper rim a beat behind and wider.
  kit.ring(_c.x, _c.y, _c.z, .45, 2.3, time, .5, WHITE_HOT, AKAGANE_EMBER[1], .12, 'plane', _f.x, 0, _f.z);
  kit.ring(_c.x, _c.y, _c.z, .35, 3.1, time + .07, .5, COPPER, DEEP, .2, 'plane', _f.x, 0, _f.z);
  // Tongues of flame shot out along its spokes, riding out with it.
  const tongues = kit.n(26, 12);
  for (let i = 0; i < tongues; i++) {
    const a = (i + Math.random() * .35) / tongues * TAU;
    _d.copy(_r).multiplyScalar(Math.cos(a)); _d.y = Math.sin(a);
    sp.reset(SPRITE.flame, time + (i % 3) * .025, .42 + Math.random() * .14).pos(_c.x + _d.x * .5, _c.y + _d.y * .5, _c.z + _d.z * .5)
      .velocity(_d.x * 3.4, _d.y * 3.4, _d.z * 3.4).sized(.3, .85 + Math.random() * .25, .45).hot(WHITE_HOT, 1.05).cool(AKAGANE_EMBER[1], .92);
    sp.drag = 2.6; sp.axis(_d.x, _d.y, _d.z); sp.rotation = (Math.random() - .5) * .3; kit.sparks.emit();
  }
  // Embers thrown off the wheel, rising as they cool.
  const embers = kit.n(34, 12);
  for (let i = 0; i < embers; i++) {
    const a = Math.random() * TAU, v = 2.2 + Math.random() * 4.5, s = .035 + Math.random() * .04;
    _d.copy(_r).multiplyScalar(Math.cos(a)); _d.y = Math.sin(a);
    sp.reset(SPRITE.core, time + Math.random() * .1, .6 + Math.random() * .6).pos(_c.x + _d.x * .7, _c.y + _d.y * .7, _c.z + _d.z * .7)
      .velocity(_d.x * v - _f.x * .6, _d.y * v + 1.2, _d.z * v - _f.z * .6).sized(s, s * .5, .6).hot(0xffd08a, 1.2).cool(COPPER, .4);
    sp.drag = 1.8; sp.gravity = -.8; kit.sparks.emit();
  }
  // A ring of fire out along the floor, and the light of it.
  kit.ring(p.x, p.y + .08, p.z, .5, 6.5, time, .5, AKAGANE_EMBER[0], DEEP, .14, 'flat');
  sp.reset(SPRITE.glow, time, .32).pos(_c.x, _c.y, _c.z).sized(1.2, 2.6, .3).hot(COPPER, 1.1); kit.sparks.emit();
  kit.lights.request(_c.x, _c.y, _c.z, COPPER, 7, 9, 3);
  kit.pulse(p.x, p.y + 1.5, p.z, COPPER, 3, 9, time, .5, 2.5);
}
