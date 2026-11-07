// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Mesh, PlaneGeometry, Vector3 } from "three";
import { stormMaterial, noiseGLSL } from "./StormShaderLibrary";
/** Effect-owned displaced surface overlay: the original ocean shader and other casts retain ownership of their own surfaces. */
export class StormWaterInteraction {
  readonly material = stormMaterial(
    `uniform float uTime;uniform vec3 uDragon;varying vec2 vUv;varying vec3 vP;float wave(float r,float age,float speed,float width){return exp(-pow((r-age*speed)/width,2.))*exp(-age*.4)*step(0.,age);}void main(){vUv=uv;vec3 p=vec3(position.x,0.,-position.y);float r=length(p.xz),d=length(p.xz-uDragon.xz);float impact=wave(r,uTime-9.2,19.,2.5)*1.5+wave(r,uTime-9.45,12.,2.)*.8;float wing=wave(d,uTime-4.7,11.,2.)*.4+wave(d,uTime-5.85,11.,2.)*.4+wave(d,uTime-6.95,11.,2.)*.4;p.y=.065+impact+wing;vP=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    `varying vec2 vUv;varying vec3 vP;uniform float uTime,uStrength,uDetail,uFlash;uniform vec3 uDragon;${noiseGLSL}float ring(float r,float age,float speed,float width){return exp(-pow((r-age*speed)/width,2.))*exp(-age*.65)*step(0.,age);}void main(){float r=length(vP.xz),d=length(vP.xz-uDragon.xz),a=atan(vP.z,vP.x);float n=fbm(vP.xz*.65+uTime*.2);float leading=ring(r,uTime-9.2,23.,.26);float swell=ring(r,uTime-9.4,13.,1.2);float electrical=ring(r,uTime-9.8,8.,.18);float slow=ring(r,uTime-10.4,5.,.65);float finalWave=ring(r,uTime-12.65,16.,.65);float wing=ring(d,uTime-4.7,11.,.6)+ring(d,uTime-5.85,11.,.6)+ring(d,uTime-6.95,11.,.6);float field=exp(-r*r/250.)*.075*(.35+n);float vein=pow(max(0.,sin(a*9.+r*.8+n*6.)),55.)*exp(-r*.12)*uFlash;float reflection=exp(-vP.x*vP.x/(7.+abs(vP.z)))*exp(-abs(vP.z)/28.)*(.3+n)*uFlash;float alpha=(leading+swell*.4+electrical*.5+slow*.15+wing*.25+field+vein+reflection*.35+finalWave*.8)*uStrength;float bounds=1.-smoothstep(40.,49.,r);vec3 col=vec3(.13,.23,.36)+vec3(.4,.57,.7)*leading+vec3(.18,.06,.38)*(electrical+finalWave)+vec3(.3,.4,.6)*uFlash;gl_FragColor=vec4(col,alpha*bounds);}`,
    {
      uTime: { value: 0 },
      uStrength: { value: 0 },
      uDetail: { value: 0 },
      uFlash: { value: 0 },
      uDragon: { value: new Vector3() },
    },
  );
  private readonly geometries = [32, 64, 96].map(
    (n) => new PlaneGeometry(100, 100, n, n),
  );
  readonly mesh = new Mesh(this.geometries[1], this.material);
  constructor() {
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }
  update(
    t: number,
    strength: number,
    detail: number,
    flash: number,
    dragon: Vector3,
  ): void {
    const u = this.material.uniforms;
    u.uTime.value = t;
    u.uStrength.value = strength;
    u.uDetail.value = detail;
    u.uFlash.value = flash;
    u.uDragon.value.copy(dragon);
    this.mesh.visible = strength > 0.001;
    this.mesh.geometry = this.geometries[detail];
  }
  dispose(): void {
    this.mesh.removeFromParent();
    for (const g of this.geometries) g.dispose();
    this.material.dispose();
  }
}
