// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Mesh, PlaneGeometry, Vector3 } from "three";
import {
  electricalMaterial,
  electricalNoise,
  surfaceVertex,
} from "./LightningMaterials";
import { dischargeIntensity, smooth, VERDICT } from "./verdictConfig";

/** Light reflected by displaced water, not a fullscreen overlay or a replacement water simulation. */
export class ElectricalShockwave {
  private readonly geometry = new PlaneGeometry(60, 60);
  readonly material = electricalMaterial(
    surfaceVertex,
    `varying vec2 vUv;uniform float uAge,uFlash,uDetail,uWarning;uniform vec3 uTarget;${electricalNoise}
    void main(){vec2 p=(vUv-0.5)*60.0;float r=length(p),a=atan(p.y,p.x);float age=max(0.0,uAge);
      float radius=13.5*(1.0-exp(-age*4.2));float warp=sin(a*16.0+age*9.0)*0.04*uDetail;
      float ring=exp(-pow((r-radius+warp)/0.105,2.0))*exp(-age*1.8)*smoothstep(0.0,0.045,age);
      float skirt=exp(-pow((r-radius*0.96+warp)/0.45,2.0))*exp(-age*3.0)*0.2;
      float ripples=0.0;for(int i=0;i<3;i++){float t=max(0.0,age-float(i)*0.13);float rr=12.0*(1.0-exp(-t*1.7));ripples+=exp(-pow((r-rr)/(0.055+float(i)*0.025),2.0))*exp(-t*1.5)*step(float(i)*0.13,age)*0.2;}
      float n=fbm(p*1.8+vec2(age*0.1,-age*0.2));float flare=exp(-r*r*0.095)*uFlash;
      vec2 view=normalize(cameraPosition.xz-uTarget.xz+vec2(0.001));vec2 side=vec2(-view.y,view.x);
      // Local plane Y maps to negative world Z after its -90 degree rotation.
      vec2 ground=vec2(p.x,-p.y);float along=dot(ground,view),across=dot(ground,side);
      float broken=noise(vec2(across*2.0,along*4.4)+age*0.2);
      float reflection=exp(-pow(across/(0.5+max(0.0,along)*0.06),2.0))*exp(-r*0.065)*smoothstep(-0.3,0.2,along)*(0.12+pow(broken,3.0)*1.6)*uFlash;
      float warning=exp(-pow((r-1.8-0.3*sin(a*5.0+uAge*7.0))/0.035,2.0))*pow(max(0.0,sin(a*3.0+n*3.0)),4.0)*uWarning*0.12;
      float alpha=(ring+skirt+ripples+flare+reflection)*step(0.0,uAge)*(1.0-smoothstep(2.3,4.1,age))+warning;
      alpha*=1.0-smoothstep(26.0,30.0,max(abs(p.x),abs(p.y)));
      vec3 color=vec3(0.055,0.3,0.75)*(skirt+ripples)+vec3(0.65,0.9,1.0)*(ring+flare)+vec3(0.25,0.58,1.0)*reflection+vec3(0.04,0.28,0.7)*warning*4.0;
      gl_FragColor=vec4(color*(1.0+uFlash*3.0),min(0.92,alpha));}`,
    {
      uAge: { value: -1 },
      uFlash: { value: 0 },
      uDetail: { value: 1 },
      uWarning: { value: 0 },
      uTarget: { value: new Vector3() },
    },
  );
  readonly mesh = new Mesh(this.geometry, this.material);
  constructor() {
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.045;
    this.mesh.renderOrder = 2;
  }
  update(age: number, detail: number, target: Vector3): void {
    this.material.uniforms.uAge.value = age - VERDICT.strike;
    this.material.uniforms.uFlash.value = dischargeIntensity(age);
    this.material.uniforms.uDetail.value = detail;
    this.material.uniforms.uTarget.value.copy(target);
    this.material.uniforms.uWarning.value =
      smooth(0.3, 0.75, age) * (1 - smooth(0.98, 1.08, age));
    this.mesh.visible = age >= 0.3 && age < 5.2;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
