// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, Mesh, PlaneGeometry, Vector3, Quaternion } from "three";
import type { Player } from "../../player/Player";
import { ElectricArcRenderer } from "./ElectricArcRenderer";
import { electricalMaterial, surfaceVertex } from "./LightningMaterials";
import { smooth, pulse } from "./verdictConfig";

export class PlayerCharge {
  readonly root = new Group();
  readonly arcs = new ElectricArcRenderer(180);
  private readonly geometry = new PlaneGeometry(0.48, 0.48);
  private readonly material = electricalMaterial(
    surfaceVertex,
    `varying vec2 vUv;uniform float uTime,uOpacity;void main(){vec2 p=(vUv-0.5)*2.0;float r=length(p),a=atan(p.y,p.x);float core=exp(-r*r*140.0);float ring=exp(-pow((r-0.55)/0.05,2.0))*pow(max(0.0,sin(a*2.0-uTime*14.0)),3.0);gl_FragColor=vec4(vec3(0.3,0.68,1.0)*ring+vec3(5.0)*core,(core+ring*0.5)*uOpacity*(1.0-smoothstep(0.8,1.0,r)));}`,
    { uTime: { value: 0 }, uOpacity: { value: 0 } },
  );
  private readonly core = new Mesh(this.geometry, this.material);
  private readonly hand = new Vector3();
  private readonly chest = new Vector3();
  private readonly start = new Vector3();
  private readonly end = new Vector3();
  private bucket = -1;
  constructor() {
    this.root.add(this.arcs.mesh, this.core);
    this.core.renderOrder = 5;
  }
  reset(): void {
    this.bucket = -1;
  }
  update(
    age: number,
    player: Player,
    target: Vector3,
    cameraRotation: Quaternion,
    seed: number,
    detail: number,
    handWorld: Vector3,
  ): void {
    const opacity = smooth(0, 0.16, age) * (1 - smooth(0.8, 1.15, age));
    this.root.visible = opacity > 0.001;
    if (!this.root.visible) return;
    this.hand.copy(handWorld);
    player.visual.getChestWorldPosition(this.chest);
    this.root.position.subVectors(this.hand, target);
    this.core.quaternion.copy(cameraRotation);
    const bucket = Math.floor(age * 22);
    if (bucket !== this.bucket) {
      this.bucket = bucket;
      const p = this.arcs.path;
      p.clear(seed + bucket * 33);
      this.chest.sub(this.hand);
      for (let i = 0; i < 3 + detail * 2; i++) {
        this.start.set(
          (p.randomValue() - 0.5) * 0.09,
          (p.randomValue() - 0.5) * 0.08,
          (p.randomValue() - 0.5) * 0.08,
        );
        this.end.set(
          (p.randomValue() - 0.5) * 0.32,
          0.08 + p.randomValue() * 0.13,
          (p.randomValue() - 0.5) * 0.25,
        );
        p.channel(this.start, this.end, 8, 0.035, 0.034, 0);
      }
      for (let i = 0; i < 2 + detail; i++) {
        this.start.set(0, 0, 0);
        this.end.copy(this.chest).multiplyScalar(0.45 + i * 0.17);
        this.end.x += (p.randomValue() - 0.5) * 0.09;
        p.channel(this.start, this.end, 16, 0.027, 0.045, 1);
      }
      let ax = 0.11,
        ay = 0,
        az = 0;
      for (let i = 1; i <= 20; i++) {
        const a = (i * Math.PI * 2) / 20 + age * 4,
          bx = Math.cos(a) * 0.105,
          by = Math.sin(a) * 0.105,
          bz = Math.sin(a * 2) * 0.03;
        p.segment(ax, ay, az, bx, by, bz, 0.027, i / 20, 0, 0);
        ax = bx;
        ay = by;
        az = bz;
      }
      this.arcs.commit();
    }
    this.arcs.update(
      age,
      opacity * (0.45 + pulse(age, 0.25, 0.12) * 0.5),
      1.1,
      1.0,
      detail,
    );
    this.material.uniforms.uTime.value = age;
    this.material.uniforms.uOpacity.value = opacity;
  }
  dispose(): void {
    this.arcs.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
