// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Mesh, Vector3 } from "three";
import { makeRiftGeometry } from "./RiftGeometry";
import { voidMaterial, noiseGLSL, riftVertex } from "./VoidMaterials";
import { riftPhase } from "./WorldrendConfig";
import type { VoidQuality } from "./WorldrendConfig";
export class RiftOpening {
  private readonly shared = {
    uTime: { value: 0 },
    uOpen: { value: 0 },
    uStretch: { value: 0 },
    uRepair: { value: 0 },
    uDetail: { value: 1 },
    uLayers: { value: 5 },
    uView: { value: new Vector3() },
  };
  readonly interiorMaterial = voidMaterial(
    riftVertex,
    `${noiseGLSL}varying vec2 vUv;varying float vDepth;varying vec3 vPosition;uniform float uTime,uDetail,uLayers;uniform vec3 uView;
  void main(){vec2 p=vec2((vUv.x-.5)*2.,(vUv.y-.5)*1.5);float acceleration=1.+smoothstep(5.3,7.4,uTime)*3.;vec3 color=vec3(.004,.002,.014);vec2 view=normalize(uView-vPosition).xy;
   for(int i=0;i<8;i++){if(float(i)>=uLayers)break;float d=float(i)+1.;float ang=uTime*(.018+d*.009)*acceleration+d*.73;mat2 rot=mat2(cos(ang),-sin(ang),sin(ang),cos(ang));vec2 q=rot*(p*(1.+d*.38)+view*(.06+d*.022));q+=vec2(fbm(q*2.+uTime*.05),fbm(q*2.-uTime*.07))*.32;
    float cloud=fbm(q*(1.7+d*.35));float river=exp(-abs(cloud-.54)*80.);float star=pow(hash(floor(q*(35.+d*19.))),160.)*smoothstep(.32,.48,cloud);float attenuation=1./(d+1.);
    color+=(vec3(.042,.015,.12)*pow(cloud,3.)+vec3(.22,.055,.42)*river*.45+vec3(.35,.48,.7)*star*.18)*attenuation;}
   float rim=pow(abs(vUv.x-.5)*2.,9.)*(1.-vDepth);color+=vec3(.018,.002,.045)*rim;float depthShade=.56+.44*(1.-vDepth);gl_FragColor=vec4(color*depthShade,1.);}`,
    this.shared,
    false,
    true,
  );
  readonly edgeMaterial = voidMaterial(
    riftVertex,
    `${noiseGLSL}varying vec2 vUv;varying float vDepth;uniform float uTime,uOpen,uStretch,uRepair,uDetail;
  void main(){float x=abs(vUv.x-.5)*2.;float core=exp(-x*55.),channel=exp(-x*12.),halo=pow(1.-x,3.);float surge=exp(-pow((vUv.y-fract((uTime-3.2)*.24))*24.,2.))*step(3.,uTime)*step(uTime,5.6);
   float flow=fbm(vec2(vUv.y*37.-uTime*4.,x*5.));float edgeLife=max(uStretch,uRepair);float cap=smoothstep(0.,.06,vUv.y)*(1.-smoothstep(.95,1.,vUv.y));float seam=1.-smoothstep(8.2,10.3,uTime);
   vec3 col=vec3(.85,.66,1.2)*core*(1.+surge*2.)+vec3(.35,.018,.8)*channel*(.7+flow*.8)+vec3(.12,.007,.3)*halo*(.5+uDetail*.16);
   gl_FragColor=vec4(col*2.,cap*edgeLife*seam*(.7+.3*flow));}`,
    this.shared,
  );
  readonly interior = new Mesh(
    makeRiftGeometry(28, 5, 27),
    this.interiorMaterial,
  );
  readonly edges = new Mesh(
    makeRiftGeometry(28, 1, 27, true),
    this.edgeMaterial,
  );
  readonly coronaMaterial = voidMaterial(
    riftVertex,
    `${noiseGLSL}varying vec2 vUv;uniform float uTime,uOpen,uStretch,uDetail;
   void main(){float x=(vUv.x-.5)*2.;float displacement=sin(vUv.y*34.+uTime*3.)*.13;float blue=exp(-pow((x-displacement-.18)*8.,2.)),red=exp(-pow((x-displacement+.18)*8.,2.));float veil=pow(max(0.,1.-x*x),3.)*(.4+.6*fbm(vec2(vUv.y*27.+uTime*.2,x*4.)));
   vec3 color=vec3(.13,.06,.35)*veil+vec3(.03,.12,.25)*blue*.3+vec3(.22,.01,.16)*red*.3;gl_FragColor=vec4(color,uOpen*uStretch*(.25+uDetail*.12));}`,
    this.shared,
  );
  readonly corona = new Mesh(
    makeRiftGeometry(28, 1, 27, true, 1.1),
    this.coronaMaterial,
  );
  private key = "";
  private topology = "";
  constructor() {
    this.interior.renderOrder = 2;
    this.edges.renderOrder = 6;
    this.corona.renderOrder = 5;
    this.corona.frustumCulled = false;
    this.interior.frustumCulled = this.edges.frustumCulled = false;
  }
  configure(q: VoidQuality, seed: number): void {
    const key = `${q.levels}:${q.depths}:${seed}`;
    if (this.key !== key) {
      this.key = key;
      const topology = `${q.levels}:${q.depths}`;
      const next = [
        makeRiftGeometry(q.levels, q.depths, seed),
        makeRiftGeometry(q.levels, 1, seed, true),
        makeRiftGeometry(q.levels, 1, seed, true, 1.1),
      ];
      const meshes = [this.interior, this.edges, this.corona];
      for (let i = 0; i < meshes.length; i++) {
        if (this.topology === topology) {
          const position = meshes[i].geometry.getAttribute("position");
          position.array.set(next[i].getAttribute("position").array);
          position.needsUpdate = true;
          meshes[i].geometry.computeBoundingBox();
          next[i].dispose();
        } else {
          meshes[i].geometry.dispose();
          meshes[i].geometry = next[i];
        }
      }
      this.topology = topology;
    }
    this.shared.uDetail.value = q.detail;
    this.shared.uLayers.value = q.depths;
  }
  update(t: number, view: Vector3): void {
    const p = riftPhase(t);
    this.shared.uTime.value = t;
    this.shared.uOpen.value = p.open;
    this.shared.uStretch.value = p.stretch;
    this.shared.uRepair.value = p.repair;
    this.shared.uView.value.copy(view);
    this.interior.visible = t > 1.21 && t < 7.4 && p.open > 0.004;
    this.edges.visible = t > 0.72 && t < 10.3;
    this.corona.visible = this.shared.uDetail.value > 0 && t > 1.3 && t < 7.4;
  }
  dispose(): void {
    this.interior.geometry.dispose();
    this.edges.geometry.dispose();
    this.interiorMaterial.dispose();
    this.edgeMaterial.dispose();
    this.corona.geometry.dispose();
    this.coronaMaterial.dispose();
  }
}
