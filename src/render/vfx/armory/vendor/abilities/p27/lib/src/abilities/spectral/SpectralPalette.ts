// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
/** Linear shader palette: cyan/blue dominate; warm dispersion is sparse. */
export const SPECTRAL_PALETTE_GLSL = `
vec3 spectralColor(float n){
  if(n<.15) return vec3(.8,1.,1.);
  if(n<.47) return vec3(.015,.72,1.);
  if(n<.70) return vec3(.035,.13,.95);
  if(n<.86) return vec3(.32,.035,.9);
  if(n<.96) return vec3(.95,.02,.42);
  if(n<.986) return vec3(.22,.95,.35);
  return vec3(.95,.72,.06);
}
`;
export const SPECTRAL_NOISE_GLSL = `
float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
