// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, PointLight } from "three";
import { ObjectPool } from "../../effects/ObjectPool";
import { BeamStrikeSequence } from "./BeamStrikeSequence";
import { LightBeam } from "./LightBeam";
import { TargetMark } from "./TargetMark";
import { CelestialArray } from "./CelestialArray";
import { HolyRipple } from "./HolyRipple";
import { LuminousParticles } from "./LuminousParticles";
import { HandChannel } from "./HandChannel";
import { RadiantLensField } from "./RadiantLensField";
import { PrismaticFragments } from "./PrismaticFragments";
export class MegiddoVisuals {
  readonly root = new Group();
  readonly sequence = new BeamStrikeSequence();
  readonly beams = new LightBeam(this.sequence);
  readonly mark = new TargetMark();
  readonly array = new CelestialArray(this.sequence);
  readonly ripples = new HolyRipple(this.sequence);
  readonly particles = new LuminousParticles();
  readonly hand = new HandChannel();
  readonly echoes = new RadiantLensField(this.sequence);
  readonly fragments = new PrismaticFragments();
  readonly impactLight = new PointLight("#fff0ce", 0, 65, 2);
  readonly fillLight = new PointLight("#a9caff", 0, 50, 2);
  constructor() {
    this.root.name = "MEGIDDO";
    this.root.add(
      this.beams.mesh,
      this.beams.shafts,
      this.mark.mesh,
      this.array.prisms,
      this.array.lenses,
      this.ripples.mesh,
      this.hand.root,
      this.echoes.mesh,
      this.fragments.mesh,
    );
    for (const e of this.particles.emitters) this.root.add(e.points);
  }
  reset(): void {
    this.root.removeFromParent();
    this.root.visible = false;
    this.impactLight.intensity = this.fillLight.intensity = 0;
    this.impactLight.removeFromParent();
    this.fillLight.removeFromParent();
  }
  dispose(): void {
    this.reset();
    this.beams.dispose();
    this.mark.dispose();
    this.array.dispose();
    this.ripples.dispose();
    this.particles.dispose();
    this.hand.dispose();
    this.echoes.dispose();
    this.fragments.dispose();
    this.impactLight.dispose();
    this.fillLight.dispose();
    this.root.clear();
  }
}
export class MegiddoResources {
  // 8 s cooldown exceeds lifetime: one bundle suffices in gameplay; a second permits bounded development stress.
  readonly pool = new ObjectPool(
    () => new MegiddoVisuals(),
    (v) => v.reset(),
    (v) => v.dispose(),
    2,
  );
  dispose(): void {
    this.pool.dispose();
  }
}
