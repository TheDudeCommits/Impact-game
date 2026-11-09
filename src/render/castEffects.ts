/** The old cast's own effect layers, in a chunk of their own (main.ts castFx).
 *
 *  Main.ts made each of these at startup, for every visit, whoever was in a room: about 660 KB of the entry before minifying
 *  (Emperor's alone 170 KB). They are made here now, together and in the order main.ts made them, the first time a room asks
 *  (its load waits for them, roomExtras) or at idle once the home is up (loading/lazyCode.ts), before any room has loaded: so
 *  every room's compile still finds every one of them in the scene, and the frame's calls below are main.ts's own, in its own
 *  order. */
import type * as THREE from 'three';
import type { Fighter } from './Fighter';
import { GummyEffects } from './GummyEffects';
import { NinjaEffects } from './NinjaEffects';
import { SwordSpiritEffects } from './SwordSpiritEffects';
import { SetsuEffects } from './SetsuEffects';
import { WardEffects } from './WardEffects';
import { EmperorEffects } from './EmperorEffects';
import { KuonEffects } from './KuonEffects';
import { LastSunEffects } from './signature/LastSun';
import { GauntEffects } from './GauntEffects';

type Events = Parameters<NinjaEffects['handle']>[0];
type Bodies = ReadonlyMap<string, Fighter>;

export class CastEffects {
  readonly gummy: GummyEffects; readonly ninja: NinjaEffects; readonly swordSpirit: SwordSpiritEffects;
  readonly setsu: SetsuEffects; readonly ward: WardEffects; readonly emperor: EmperorEffects;
  readonly kuon: KuonEffects; readonly lastSun: LastSunEffects; readonly gaunt: GauntEffects;
  constructor(scene: THREE.Scene) {
    this.gummy = new GummyEffects(scene); this.ninja = new NinjaEffects(scene); this.swordSpirit = new SwordSpiritEffects(scene);
    this.setsu = new SetsuEffects(scene); this.ward = new WardEffects(scene); this.emperor = new EmperorEffects(scene);
    this.kuon = new KuonEffects(scene); this.lastSun = new LastSunEffects(scene); this.gaunt = new GauntEffects(scene);
  }
  /** A room's fighters (and the donors of the moves their kits borrow): Emperor's props made, and the Ninja's and the spirits'
   *  files fetched (main.ts roomExtras and the move transplant's effects). */
  load(ids: readonly string[]) { this.emperor.load(ids); return Promise.all([this.ninja.load(ids), this.swordSpirit.load(ids)]).then(() => {}); }
  /** A room's warm-up bodies, before its compile: the lightning clone built on the warm Shirokane, and the spirits posed. */
  warmup(bodies: Bodies) { const shirokane = bodies.get('warm-shirokane'); if (shirokane) this.ninja.warmup(shirokane); this.swordSpirit.update(0, 0, bodies); }
  handle(events: Events, shown: Bodies) {
    this.ninja.handle(events, shown); this.setsu.handle(events); this.kuon.handle(events); this.ward.handle(events, shown);
    this.emperor.handle(events, shown); this.swordSpirit.handle(events);
  }
  update(time: number, dt: number, bodies: Bodies, density: number, camera: THREE.Camera) {
    this.gummy.update(time, bodies, density); this.ninja.update(time, dt, bodies, density); this.setsu.update(time, bodies, density);
    this.gaunt.update(time, bodies, density); this.kuon.update(time, dt, bodies, density); this.lastSun.update(time, bodies, density);
    this.ward.update(time, bodies, density); this.emperor.update(time, bodies, density, camera); this.swordSpirit.update(time, dt, bodies, density, camera);
  }
  reset() {
    this.gummy.reset(); this.ninja.reset(); this.setsu.reset(); this.gaunt.reset(); this.kuon.reset(); this.lastSun.reset();
    this.ward.reset(); this.emperor.reset(); this.swordSpirit.reset();
  }
  dispose() {
    this.gummy.dispose(); this.ninja.dispose(); this.setsu.dispose(); this.gaunt.dispose(); this.kuon.dispose(); this.lastSun.dispose();
    this.ward.dispose(); this.emperor.dispose(); this.swordSpirit.dispose();
  }
}
