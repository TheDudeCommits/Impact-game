// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, PointLight } from "three";
import { ObjectPool } from "../../effects/ObjectPool";
import { PlayerCharge } from "./PlayerCharge";
import { MainDischarge } from "./MainDischarge";
import { StormVolume } from "./StormVolume";
import { WaterDischarge } from "./WaterDischarge";
import { ElectricalShockwave } from "./ElectricalShockwave";
import { IonMist } from "./IonMist";
import { ElectricParticleSystem } from "./ElectricParticleSystem";

/** At most two cached bundles: cooldown 4 s / lifetime 6.2 s permits two overlapping verdicts. */
export class VerdictVisuals {
  readonly root = new Group();
  readonly charge = new PlayerCharge();
  readonly discharge = new MainDischarge();
  readonly storm = new StormVolume();
  readonly water = new WaterDischarge();
  readonly shockwave = new ElectricalShockwave();
  readonly mist = new IonMist();
  readonly particles = new ElectricParticleSystem();
  readonly impactLight = new PointLight("#badfff", 0, 70, 2);
  readonly skyLight = new PointLight("#5b95ff", 0, 50, 2);
  constructor() {
    this.root.name = "Heaven's Verdict";
    this.impactLight.position.set(0, 2.0, 0);
    this.skyLight.position.set(0, 12, 0);
    this.impactLight.castShadow = this.skyLight.castShadow = false;
    this.root.add(
      this.charge.root,
      this.discharge.root,
      this.storm.root,
      this.water.root,
      this.shockwave.mesh,
      this.mist.mesh,
    );
    for (const emitter of this.particles.emitters)
      this.root.add(emitter.points);
  }
  reset(): void {
    this.impactLight.intensity = this.skyLight.intensity = 0;
    this.impactLight.removeFromParent();
    this.skyLight.removeFromParent();
    this.root.removeFromParent();
    this.root.visible = false;
  }
  dispose(): void {
    this.reset();
    this.charge.dispose();
    this.discharge.dispose();
    this.storm.dispose();
    this.water.dispose();
    this.shockwave.dispose();
    this.mist.dispose();
    this.particles.dispose();
    this.impactLight.dispose();
    this.skyLight.dispose();
    this.root.clear();
  }
}
export class VerdictResources {
  readonly pool = new ObjectPool(
    () => new VerdictVisuals(),
    (visual) => visual.reset(),
    (visual) => visual.dispose(),
    2,
  );
  dispose(): void {
    this.pool.dispose();
  }
}
