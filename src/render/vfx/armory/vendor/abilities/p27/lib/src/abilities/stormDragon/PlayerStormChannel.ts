// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, Mesh, PlaneGeometry, Vector3 } from "three";
import { stormMaterial, planeVertex } from "./StormShaderLibrary";
import { envelope } from "./StormDragonConfig";
import { StormElectricArcs } from "./StormElectricArcs";
import type { Player } from "../../player/Player";
export class PlayerStormChannel {
  readonly root = new Group();
  readonly arcs = new StormElectricArcs();
  private readonly hand = new Vector3();
  private readonly chest = new Vector3();
  readonly material = stormMaterial(
    planeVertex,
    `varying vec2 vUv;uniform float uTime,uOpacity;void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);float circle=exp(-pow((r-.72)*90.,2.));float broken=step(.32,fract(a*2.86+uTime*.13));float inner=exp(-pow((r-.48)*70.,2.))*step(.4,fract(a*1.91-uTime*.1));float marks=pow(max(0.,cos(a*6.+r*14.)),25.)*exp(-pow((r-.6)*8.,2.));gl_FragColor=vec4(.2,.09,.48,(circle*broken+inner+marks*.6)*uOpacity);}`,
    { uTime: { value: 0 }, uOpacity: { value: 0 } },
  );
  readonly sigil = new Mesh(new PlaneGeometry(5, 5), this.material);
  readonly ribbonMaterial = stormMaterial(
    `uniform float uTime;varying vec2 vUv;void main(){vUv=uv;float a=uv.y*15.-uTime*5.;float r=.65+.25*sin(uv.y*3.14159);vec3 p=vec3(cos(a)*(r+position.x*.18),uv.y*2.5,sin(a)*(r+position.x*.18));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    `varying vec2 vUv;uniform float uPower;void main(){float a=pow(1.-abs(vUv.x*2.-1.),2.)*sin(vUv.y*3.14159);gl_FragColor=vec4(.14,.1,.38,a*uPower*.28);}`,
    { uTime: { value: 0 }, uPower: { value: 0 } },
  );
  readonly ribbon = new Mesh(
    new PlaneGeometry(1, 1, 1, 96),
    this.ribbonMaterial,
  );
  constructor() {
    this.sigil.rotation.x = -Math.PI / 2;
    this.ribbon.frustumCulled = false;
    this.root.add(this.sigil, this.arcs.renderer.mesh, this.ribbon);
  }
  update(t: number, player: Player, parent: Group): void {
    const strength = envelope(0, 0.35, 1.8, 3.3, t);
    this.root.visible = strength > 0.001;
    this.root.position.copy(player.position);
    parent.worldToLocal(this.root.position);
    this.sigil.position.y = 0.07;
    player.visual.getRightHandWorldPosition(this.hand);
    player.visual.getChestWorldPosition(this.chest);
    this.root.worldToLocal(this.hand);
    this.root.worldToLocal(this.chest);
    this.arcs.begin(Math.floor(t * 27) * 719);
    this.arcs.arc(this.hand, this.chest, 0.08, 14, 0.18);
    for (let i = 0; i < 3; i++) {
      this.chest.set(
        Math.cos(t * 4 + i * 2.1) * 0.75,
        0.5 + i * 0.45,
        Math.sin(t * 4 + i * 2.1) * 0.75,
      );
      this.arcs.arc(this.hand, this.chest, 0.075, 16, 0.16);
    }
    this.arcs.end(t, strength * 0.7, 1);
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uOpacity.value = strength * 0.8;
    this.ribbonMaterial.uniforms.uTime.value = t;
    this.ribbonMaterial.uniforms.uPower.value = strength;
  }
  dispose(): void {
    this.root.removeFromParent();
    this.sigil.geometry.dispose();
    this.material.dispose();
    this.ribbon.geometry.dispose();
    this.ribbonMaterial.dispose();
    this.arcs.dispose();
  }
}
