// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { AdditiveBlending, DoubleSide, Group, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import { SpectralShockfront } from './SpectralShockfront';
import { SpectralRibbons } from './SpectralRibbons';
import { smooth } from './SpectralBreakConfig';
export class SpectralImpact {
  readonly root = new Group();
  readonly shell = new SpectralShockfront();
  readonly echo = new SpectralShockfront();
  readonly shreds = new SpectralRibbons('ribbon', 12);
  readonly nucleus: Mesh;
  constructor() {    
this.nucleus = new Mesh(new SphereGeometry(1, 32, 24), new ShaderMaterial({      
uniforms: { uTime: { value: 0 }, uStrength: { value: 0 } }, transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
      vertexShader: `uniform float uTime;varying vec3 vN;void main(){vN=normal;vec3 p=position*(1.+.15*sin(position.y*7.+position.x*8.-uTime*21.));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `uniform float uTime,uStrength;varying vec3 vN;void main(){float bands=pow(max(0.,sin(vN.x*8.+vN.z*11.-uTime*18.)),6.);vec3 c=mix(vec3(.03,.4,.85),vec3(1.3,1.65,1.8),bands);gl_FragColor=vec4(c,uStrength*.75);}`    
}));
    this.echo.root.rotation.y = Math.PI; this.echo.root.rotation.z = .25; this.root.add(this.shell.root, this.echo.root, this.shreds.mesh, this.nucleus);
  }
  update(t: number, impact: number, shock: number, after: number): void {    
const age = Math.max(0, t - 3.72);
    this.root.visible = impact + shock + after > .005;
    const radius = 1.5 + smooth(0, 1.7, age) * 16.;
    this.shell.update(t, radius, shock * .85); this.echo.update(t, radius * .76, shock * .38);
    this.nucleus.visible = impact > .01; this.nucleus.scale.set(1.4 + impact * 2.7, 1.6 + impact * 3.4, 1.3 + impact * 2.1); const u = (this.nucleus.material as ShaderMaterial).uniforms; u.uTime.value = t; u.uStrength.value = impact;
    this.shreds.mesh.position.z = -7; this.shreds.update(t, 17, 1, after * .5); this.shreds.mesh.scale.setScalar(.65 + age * .22);
  }
  setQuality(detail: number, ribbons: number): void { this.shell.setQuality(detail); this.echo.setQuality(Math.max(0, detail - 1)); this.shreds.setCount(ribbons); }
  dispose(): void { this.shell.dispose(); this.echo.dispose(); this.shreds.dispose(); this.nucleus.geometry.dispose(); (this.nucleus.material as ShaderMaterial).dispose(); }
}
