// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group } from "three";
import { ObjectPool } from "../../effects/ObjectPool";
import { StormDragon } from "./StormDragon";
import { DragonAnimationController } from "./DragonAnimationController";
import { StormCloudField } from "./StormCloudField";
import { StormParticleSystem } from "./StormParticleSystem";
import { StormRain } from "./StormRain";
import { DragonLightning } from "./DragonLightning";
import { ThunderfallSequence } from "./ThunderfallSequence";
import { DragonBreathBeam } from "./DragonBreathBeam";
import { DragonBreathCharge } from "./DragonBreathCharge";
import { PlayerStormChannel } from "./PlayerStormChannel";
import { StormTornadoField } from "./StormTornadoField";
import { StormWaterInteraction } from "./StormWaterInteraction";
import { StormImpact } from "./StormImpact";
import { StormWindField } from "./StormWindField";
import { StormLighting } from "./StormLighting";
import { DragonBreathDischarge } from "./DragonBreathDischarge";
import { StormDragonAura } from "./StormDragonAura";
import { StormMistField } from "./StormMistField";
export class StormVisuals {
  readonly mist = new StormMistField();
  readonly discharge = new DragonBreathDischarge();
  readonly aura = new StormDragonAura();
  readonly root = new Group();
  readonly dragon = new StormDragon();
  readonly animation = new DragonAnimationController(this.dragon);
  readonly clouds = new StormCloudField();
  readonly particles = new StormParticleSystem();
  readonly rain = new StormRain();
  readonly electricity = new DragonLightning();
  readonly thunder = new ThunderfallSequence();
  readonly beam = new DragonBreathBeam();
  readonly charge = new DragonBreathCharge();
  readonly player = new PlayerStormChannel();
  readonly tornadoes = new StormTornadoField();
  readonly water = new StormWaterInteraction();
  readonly impact = new StormImpact();
  readonly wind = new StormWindField();
  readonly lighting = new StormLighting();
  constructor() {
    this.root.name = "TEMPEST CATACLYSM";
    this.root.add(
      this.dragon.root,
      this.clouds.mesh,
      this.particles.points,
      this.rain.mesh,
      this.electricity.arcs.renderer.mesh,
      this.thunder.arcs.renderer.mesh,
      this.beam.root,
      this.player.root,
      this.tornadoes.mesh,
      this.water.mesh,
      this.impact.root,
      this.wind.mesh,
      this.discharge.arcs.renderer.mesh,
      this.mist.mesh,
    );
    this.dragon.root.add(this.aura.mesh);
    this.dragon.head.mouth.add(this.charge.root);
  }
  reset(): void {
    this.root.removeFromParent();
    this.root.visible = false;
    this.lighting.reset();
  }
  dispose(): void {
    this.reset();
    for (const v of [
      this.clouds,
      this.particles,
      this.rain,
      this.electricity,
      this.thunder,
      this.beam,
      this.charge,
      this.player,
      this.tornadoes,
      this.water,
      this.impact,
      this.wind,
      this.lighting,
      this.discharge,
      this.aura,
      this.mist,
    ])
      v.dispose();
    this.dragon.dispose();
    this.root.clear();
  }
}
export class StormResourcePool {
  readonly pool = new ObjectPool(
    () => new StormVisuals(),
    (v) => v.reset(),
    (v) => v.dispose(),
    1,
  );
  dispose(): void {
    this.pool.dispose();
  }
}
