// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { frostNoise } from '../frostLance/FrostLanceNoise';
/** Sand-pressure crest and faint warm water reflection. The water mesh remains untouched. */
export class SandReaperImpact {
  readonly mesh: Mesh;
  private readonly material = new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide,
    uniforms: { uAge: { value: -1 }, uOpacity: { value: 1 }, uColor: { value: new Color('#edc78a') } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform float uAge,uOpacity;uniform vec3 uColor;${frostNoise}
      void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float age=max(0.,uAge);
        float front=(1.-exp(-age*5.))*.88;float grain=.65+.35*snoise(vec3(p*22.,age*2.));
        float ring=exp(-pow((r-front)*65.,2.))*exp(-age*2.3)*grain;
        float secondary=exp(-pow((r-front*.7)*90.,2.))*exp(-age*2.8)*.3;
        float reflection=exp(-r*r*24.)*exp(-age*5.)*.14;
        float alpha=(ring*.55+secondary+reflection)*uOpacity*step(0.,uAge);
        if(alpha<.002)discard;gl_FragColor=vec4(uColor*(.75+ring*.65),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  constructor() { this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material); this.mesh.rotation.x = -Math.PI / 2; this.mesh.renderOrder = 3; this.mesh.visible = false; }
  update(age: number, p: Vector3, radius: number): void {
    this.mesh.visible = age >= 0 && age < 2.3; this.mesh.position.set(p.x, .045, p.z); this.mesh.scale.setScalar(radius * 1.14);
    this.material.uniforms.uAge.value = age;
  }
  reset(): void { this.mesh.visible = false; }
  dispose(): void { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.material.dispose(); }
}
