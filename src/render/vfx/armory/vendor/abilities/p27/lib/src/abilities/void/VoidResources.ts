// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, PointLight } from "three";
import { ObjectPool } from "../../effects/ObjectPool";
import { RiftOpening } from "./RiftOpening";
import { RealityShards } from "./RealityShards";
import { SpatialFilaments } from "./SpatialFilaments";
import { VoidParticles } from "./VoidParticles";
import { SpatialAtmosphere } from "./SpatialAtmosphere";
import { VoidWaterInteraction } from "./VoidWaterInteraction";
import { SingularityCore } from "./SingularityCore";
import { VoidCharge } from "./VoidCharge";
export class VoidVisuals {
  readonly root = new Group();
  readonly rift = new RiftOpening();
  readonly shards = new RealityShards();
  readonly filaments = new SpatialFilaments();
  readonly particles = new VoidParticles();
  readonly atmosphere = new SpatialAtmosphere();
  readonly water = new VoidWaterInteraction();
  readonly core = new SingularityCore();
  readonly charge = new VoidCharge();
  readonly light = new PointLight("#8e35ff", 0, 70, 2);
  readonly upper = new PointLight("#bc83ff", 0, 55, 2);
  constructor() {
    this.root.name = "WORLDREND";
    this.root.add(
      this.rift.interior,
      this.rift.edges,
      this.rift.corona,
      this.shards.mesh,
      this.filaments.mesh,
      this.particles.points,
      this.atmosphere.mesh,
      this.water.mesh,
      this.water.dark,
      this.core.mesh,
      this.charge.mesh,
    );
  }
  reset(): void {
    this.root.removeFromParent();
    this.root.visible = false;
    this.light.removeFromParent();
    this.upper.removeFromParent();
    this.light.intensity = this.upper.intensity = 0;
  }
  dispose(): void {
    this.reset();
    this.rift.dispose();
    this.shards.dispose();
    this.filaments.dispose();
    this.particles.dispose();
    this.atmosphere.dispose();
    this.water.dispose();
    this.core.dispose();
    this.charge.dispose();
    this.light.dispose();
    this.upper.dispose();
    this.root.clear();
  }
}
export class VoidResources {
  readonly pool = new ObjectPool(
    () => new VoidVisuals(),
    (v) => v.reset(),
    (v) => v.dispose(),
    2,
  );
  dispose(): void {
    this.pool.dispose();
  }
}
