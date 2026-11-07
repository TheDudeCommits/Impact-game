// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {
  Group,
  Vector3,
  InstancedMesh,
  InstancedBufferAttribute,
  Matrix4,
  PlaneGeometry,
} from "three";
import { ElectricArcRenderer } from "./ElectricArcRenderer";
import { SeededRandom, smooth, VERDICT } from "./verdictConfig";
import type { LightningQuality } from "./verdictConfig";
import { electricalMaterial } from "./LightningMaterials";

/** Organic surface conduction and intermittent links between temporary ionized nodes. */
export class WaterDischarge {
  readonly root = new Group();
  readonly veins = new ElectricArcRenderer(800);
  readonly field = new ElectricArcRenderer(240);
  readonly travel = new ElectricArcRenderer(160);
  readonly nodes = new Float32Array(16 * 3);
  private readonly start = new Vector3();
  private readonly end = new Vector3();
  private readonly random = new SeededRandom();
  private q!: LightningQuality;
  private seed = 1;
  private bucket = -1;
  private readonly coronaGeometry = new PlaneGeometry(0.55, 0.55);
  private readonly coronaMaterial = electricalMaterial(
    `attribute mat4 instanceMatrix;attribute float aSeed;varying vec2 vUv;varying float vGlow;uniform float uAge;
    void main(){vUv=uv;float flicker=fract(sin(floor(uAge*12.0)+aSeed*137.0)*43758.5453);
      vGlow=(0.12+step(0.84,flicker)*0.65)*smoothstep(0.35,0.7,uAge)*(1.0-smoothstep(3.7,4.8,uAge));
      vec4 p=modelViewMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0);p.xy+=position.xy;gl_Position=projectionMatrix*p;}`,
    `varying vec2 vUv;varying float vGlow;void main(){vec2 p=(vUv-0.5)*2.0;float r=dot(p,p);float core=exp(-r*65.0),halo=exp(-r*4.0)*(1.0-smoothstep(0.5,1.0,r));gl_FragColor=vec4(vec3(0.12,0.43,1.0)*halo+vec3(1.3)*core,(core+halo*0.25)*vGlow);}`,
    { uAge: { value: 0 } },
  );
  readonly coronas: InstancedMesh;
  private readonly nodeMatrix = new Matrix4();
  constructor() {
    const seeds = new Float32Array(16);
    for (let i = 0; i < 16; i++) seeds[i] = (i * 0.61803398875) % 1;
    this.coronaGeometry.setAttribute(
      "aSeed",
      new InstancedBufferAttribute(seeds, 1),
    );
    this.coronas = new InstancedMesh(
      this.coronaGeometry,
      this.coronaMaterial,
      16,
    );
    this.coronas.frustumCulled = false;
    this.coronas.renderOrder = 3;
    this.root.add(
      this.veins.mesh,
      this.field.mesh,
      this.travel.mesh,
      this.coronas,
    );
  }
  configure(seed: number, q: LightningQuality): void {
    this.seed = seed;
    this.q = q;
    this.bucket = -1;
    this.random.reset(seed + 128);
    const p = this.veins.path;
    p.clear(seed + 818);
    for (let i = 0; i < 16; i++) {
      const angle = i * 2.399963 + (this.random.next() - 0.5) * 0.6,
        r = 2.7 + this.random.next() * 7.5;
      this.nodes[i * 3] = Math.cos(angle) * r;
      this.nodes[i * 3 + 1] = 0.065;
      this.nodes[i * 3 + 2] = Math.sin(angle) * r;
      this.nodeMatrix.makeTranslation(
        this.nodes[i * 3],
        0.1,
        this.nodes[i * 3 + 2],
      );
      this.coronas.setMatrixAt(i, this.nodeMatrix);
    }
    this.coronas.count = q.nodes;
    this.coronas.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < q.nodes; i++) {
      this.start.set(0, 0.065, 0);
      this.end.fromArray(this.nodes, i * 3);
      const first = p.count;
      p.channel(
        this.start,
        this.end,
        22,
        0.15 + (i % 3) * 0.03,
        0.7,
        0,
        0,
        0.95,
      );
      for (let j = 0; j < q.detail + 1; j++) {
        const k = (first + 8 + j * 4) * 10;
        this.start.fromArray(p.data, k + 3);
        this.end.set(
          this.start.x + (p.randomValue() - 0.5) * 4.5,
          0.065,
          this.start.z + (p.randomValue() - 0.5) * 4.5,
        );
        p.channel(this.start, this.end, 8, 0.085, 0.32, 1, 0.35, 1);
      }
    }
    // Keep all veins near the surface, independent of the generator's perpendicular frame.
    for (let i = 0; i < p.count; i++) {
      p.data[i * 10 + 1] = 0.065;
      p.data[i * 10 + 4] = 0.065;
    }
    this.veins.commit();
  }
  configureTravel(player: Vector3, target: Vector3): void {
    const p = this.travel.path;
    p.clear(this.seed + 662);
    this.start.subVectors(player, target);
    this.start.y = 0.085;
    this.end.set(0, 0.085, 0);
    p.channel(
      this.start,
      this.end,
      Math.min(90, Math.max(12, Math.ceil(this.start.length() * 2))),
      0.065,
      0.45,
      0,
    );
    for (let i = 0; i < p.count; i++) {
      p.data[i * 10 + 1] = 0.085;
      p.data[i * 10 + 4] = 0.085;
    }
    this.travel.commit();
  }
  update(age: number): void {
    this.coronaMaterial.uniforms.uAge.value = age;
    this.coronas.visible = age >= 0.35 && age < 4.8;
    this.travel.update(
      age,
      smooth(0.16, 0.23, age) * (1 - smooth(0.48, 0.63, age)) * 0.6,
      smooth(0.19, 0.5, age),
      0.85,
      this.q.detail,
    );
    const pre = smooth(0.3, 0.7, age) * (1 - smooth(0.97, 1.07, age)) * 0.24;
    const burst =
      smooth(VERDICT.strike, VERDICT.strike + 0.08, age) *
      (1 - smooth(1.25, 2.6, age));
    this.veins.update(
      age,
      pre + burst * 0.74,
      age < VERDICT.strike ? 0.46 : smooth(VERDICT.strike, 1.4, age),
      1.15,
      this.q.detail,
    );
    const bucket = Math.floor(age * 14);
    if (bucket !== this.bucket) {
      this.bucket = bucket;
      const p = this.field.path;
      p.clear(this.seed + bucket * 817);
      if (age > 1.35 && age < 4.8) {
        for (let i = 0; i < this.q.nodes; i++) {
          if (p.randomValue() > 0.25 + this.q.detail * 0.035) continue;
          this.start.fromArray(this.nodes, i * 3);
          const node = (i + 2 + Math.floor(p.randomValue() * 3)) % this.q.nodes;
          this.end.fromArray(this.nodes, node * 3);
          this.start.y += p.randomValue() * 0.35;
          this.end.y += p.randomValue() * 0.8;
          p.channel(this.start, this.end, 13, 0.13, 0.22, 0);
        }
      }
      this.field.commit();
    }
    this.field.update(
      age,
      (1 - smooth(3.8, 4.8, age)) * 0.64,
      1.1,
      1.05,
      this.q.detail,
    );
  }
  dispose(): void {
    this.coronas.dispose();
    this.coronaGeometry.dispose();
    this.coronaMaterial.dispose();
    this.veins.dispose();
    this.field.dispose();
    this.travel.dispose();
  }
}
