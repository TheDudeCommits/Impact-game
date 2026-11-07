// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { AdditiveBlending, DoubleSide, Group, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import { SpectralRibbons } from './SpectralRibbons';
import { smooth } from './SpectralBreakConfig';
export class SpectralCharge {
  readonly root = new Group();
  readonly nucleus: Mesh;
  readonly strands = new SpectralRibbons('ribbon', 12);
  readonly rings = new SpectralRibbons('pressure', 5);
  constructor() {    
this.nucleus = new Mesh(new SphereGeometry(1, 24, 16), new ShaderMaterial({      
uniforms: { uTime: { value: 0 }, uStrength: { value: 0 } }, transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
      vertexShader: `uniform float uTime;varying vec3 vN;void main(){vN=normal;vec3 p=position*(1.+.1*sin(position.y*12.+uTime*17.));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `uniform float uTime,uStrength;varying vec3 vN;void main(){float n=.8+.2*sin(vN.x*20.+vN.y*7.-uTime*29.);gl_FragColor=vec4(vec3(.75,1.1,1.4)*n*uStrength,.8);}`    
}));
    this.strands.mesh.scale.set(.32, .32, .55);
    this.root.add(this.nucleus, this.strands.mesh, this.rings.mesh);
  }
  update(t: number, strength: number, compression: number, flash: number): void {
    this.root.visible = strength + flash > .001;
    const radius = (.12 + smooth(0, .65, t) * .19) * (1. - compression * .65) + flash * .7;
    this.nucleus.scale.setScalar(radius); const u = (this.nucleus.material as ShaderMaterial).uniforms; u.uTime.value = t; u.uStrength.value = strength * (1. + compression * 3.) + flash * 6.;
    this.strands.update(-t * 1.5, 2.6 * (1. - compression * .7), 1, strength, compression);
    this.rings.update(-t, 1.2, 1, strength * .6 + flash); this.rings.mesh.scale.setScalar(.3 * (1. - compression * .7) + flash * .7);
    this.strands.mesh.position.z = -.7 * (1. - compression * .7);
  }
  dispose(): void { this.nucleus.geometry.dispose(); (this.nucleus.material as ShaderMaterial).dispose(); this.strands.dispose(); this.rings.dispose(); }
}
