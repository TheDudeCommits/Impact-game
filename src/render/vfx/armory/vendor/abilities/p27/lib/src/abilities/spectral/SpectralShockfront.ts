// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { AdditiveBlending, DoubleSide, Group, Mesh, ShaderMaterial } from 'three';
import { spectralSurface } from './SpectralBeamGeometry';
import { SPECTRAL_NOISE_GLSL, SPECTRAL_PALETTE_GLSL } from './SpectralPalette';
/** Open spherical caps with asymmetric lobes, curved depth and a torn luminous lip. */
export class SpectralShockfront {
  readonly root = new Group();
  readonly geometry = spectralSurface(28, 96);
  readonly layers: Mesh[] = [];
  constructor() {    
for (let layer = 0; layer < 3; layer++) {
      const material = new ShaderMaterial({        
uniforms: { uTime: { value: 0 }, uRadius: { value: 4 }, uStrength: { value: 0 }, uLayer: { value: layer }, uDetail: { value: 1 } }, transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
        vertexShader: `uniform float uTime,uRadius,uLayer;varying vec2 vUv;varying float vLobe;void main(){vUv=uv;
       float a=uv.y*6.2831853,phi=.18+uv.x*1.30;
       float lobes=1.+.15*sin(a*3.+uTime*5.)+.09*sin(a*5.-uTime*9.)+.05*cos(a*9.+uTime*13.);vLobe=lobes;
       float r=uRadius*(1.-uLayer*.085)*lobes;
       vec3 p=vec3(cos(a)*sin(phi)*r,sin(a)*sin(phi)*r*.86,(cos(phi)-.3)*r*.9+sin(a*3.+uTime*4.)*r*.13-uLayer*.3);
       gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
        fragmentShader: `uniform float uTime,uStrength,uLayer,uDetail;varying vec2 vUv;varying float vLobe;${SPECTRAL_NOISE_GLSL}${SPECTRAL_PALETTE_GLSL}
       void main(){float a=vUv.y*6.2831853;float n=noise3(vec3(vUv.x*5.-uTime*5.,cos(a)*3.,sin(a)*3.));
        float rim=pow(smoothstep(.87,.99,vUv.x),3.);float bands=pow(max(0.,sin(vUv.x*31.-uTime*19.+n*4.)),8.);
        float cracks=step(.27,noise3(vec3(floor(a*4.),vUv.x*9.-uTime*3.,2.)));
        vec3 color=mix(vec3(.008,.25,.67),vec3(.025,.8,.95),n);
        if(uLayer>0.5)color=mix(vec3(.18,.025,.68),vec3(.75,.03,.4),n*.8);
        color=mix(color,vec3(1.5,1.9,2.),rim*(uLayer<.5?1.:.15));
        float alpha=(rim*.65+bands*.25+n*.17)*cracks*uStrength*smoothstep(0.,.13,vUv.x);
        alpha*=uLayer<.5?1.:.40;
        if(alpha<.01)discard;gl_FragColor=vec4(color,alpha);
      }`});
      const mesh = new Mesh(this.geometry, material); mesh.frustumCulled = false; mesh.renderOrder = 13; this.layers.push(mesh); this.root.add(mesh);
    }  
}
  setQuality(detail: number): void { this.layers.forEach((m, i) => { m.userData.enabled = i <= detail; (m.material as ShaderMaterial).uniforms.uDetail.value = detail; }); }
  update(t: number, radius: number, strength: number): void { this.root.visible = strength > .005; this.layers.forEach(m => { m.visible = !!m.userData.enabled; const u = (m.material as ShaderMaterial).uniforms; u.uTime.value = t; u.uRadius.value = radius; u.uStrength.value = strength; }); }
  dispose(): void { this.geometry.dispose(); this.layers.forEach(m => (m.material as ShaderMaterial).dispose()); }
}
