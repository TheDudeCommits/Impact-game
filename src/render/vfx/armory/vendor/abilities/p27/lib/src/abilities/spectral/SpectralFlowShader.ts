// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { SPECTRAL_NOISE_GLSL, SPECTRAL_PALETTE_GLSL } from './SpectralPalette';
export const SPECTRAL_FLOW_VERTEX = `
uniform float uTime,uLength,uFront,uLayer,uStrength,uCollapse,uDetail;
varying vec2 vUv;varying float vFold;
${SPECTRAL_NOISE_GLSL}
void main(){
 vUv=uv;float a=uv.y*6.2831853,z=uv.x*uLength;
 float travel=z-uTime*(uLayer<2.?32.:18.);
 float roll=sin(a*3.+travel*.32)+.45*sin(a*5.-travel*.37);
 float taper=mix(.30,1.,smoothstep(0.,.16,uv.x));
 float radii[7];radii[0]=.48;radii[1]=1.55;radii[2]=2.55;radii[3]=3.2;radii[4]=3.75;radii[5]=.23;radii[6]=4.5;
 float r=radii[int(uLayer)]*taper*(1.+roll*(uLayer<1.?.06:.16));
 r*=1.-uCollapse*.65;
 if(uLayer<.5)r*=.86+.14*sin(z*.7-uTime*38.);
 vFold=roll;
 if(uLayer==5.){a+=z*.3-uTime*3.;r+=.34;}
 vec3 p=vec3(cos(a)*r,sin(a)*r,z);
 p.xy+=vec2(sin(z*.22-uTime*7.),cos(z*.29-uTime*6.))*.18*smoothstep(0.,.2,uv.x);
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
export const SPECTRAL_FLOW_FRAGMENT = `
uniform float uTime,uLength,uFront,uLayer,uStrength,uCollapse,uDetail;
varying vec2 vUv;varying float vFold;
${SPECTRAL_NOISE_GLSL}
${SPECTRAL_PALETTE_GLSL}
void main(){
 float z=vUv.x*uLength,a=vUv.y*6.2831853;
 float flowTime=uTime-uCollapse*max(0.,uTime-3.4)*.7;
 float flow=z-flowTime*38.;
 vec3 domain=vec3(flow*.13,cos(a)*2.3,sin(a)*2.3);
 float n=noise3(domain+vec3(0.,uTime*.45,0.));
 if(uDetail>.5)n=mix(n,noise3(domain*2.4+vec3(-uTime*3.,0.,0.)),.32);
 float streak=pow(max(0.,sin(a*11.+sin(flow*.16)*1.6+flow*.7)),14.);
 float band=pow(max(0.,sin(flow*.49+a*2.+n*5.)),5.);
 float stream=pow(max(0.,sin(a*9.+sin((z-uTime*29.)*.17)*2.2)),18.);
 float packet=pow(max(0.,sin((z-uTime*57.)*.62+a*1.7)),10.);
 float lanes=smoothstep(.30,.86,n+stream*.3);
 float edge=1.-smoothstep(uFront-.015,uFront+.003,vUv.x);
 float tips=smoothstep(0.,.006,vUv.x)*(1.-smoothstep(.96,1.,vUv.x));
 float tearing=noise3(vec3((z-uTime*22.)*.29,floor(a*3.)*.65,1.));
 float fracture=step(.74,tearing)*step(.54,n);
 float alpha=1.;vec3 color=vec3(.8,1.,1.);
 if(uLayer<.5){color=mix(vec3(.15,.6,.83),vec3(1.0,1.35,1.55),.55+streak*.45)*(.8+band*.35);alpha=.82;}
 else if(uLayer<1.5){color=mix(vec3(.005,.18,.32),vec3(.025,.72,.92),n)*(.7+band*.65);color+=vec3(.025,.45,.6)*stream*(.4+packet);alpha=(.11+lanes*.30)*(1.-fracture*.92);}
 else if(uLayer<2.5){color=mix(vec3(.006,.018,.16),vec3(.025,.22,.95),smoothstep(.22,.78,n));color+=vec3(.02,.18,.7)*stream;alpha=smoothstep(.39,.73,n)*.42;}
 else if(uLayer<3.5){color=mix(vec3(.035,.014,.21),vec3(.36,.055,.9),n);alpha=smoothstep(.53,.8,n)*.27;}
 else if(uLayer<4.5){color=mix(vec3(.13,.008,.21),vec3(.8,.02,.32),band);alpha=smoothstep(.72,.9,n)*.22;}
 else if(uLayer<5.5){color=vec3(.65,1.,1.)*1.5;alpha=.7*(.3+streak);}
 else{color=mix(vec3(.01,.08,.3),vec3(.015,.4,.55),n);alpha=.07*pow(max(0.,sin(a*3.+n*7.)),2.);}
 // Collapse fragments migrate forward and open coherent gaps instead of a uniform fade.
 float shred=1.-smoothstep(.28,.95,uCollapse+noise3(vec3(z*.7-uTime*15.,a*3.,0.))*.4);
 alpha*=edge*tips*min(uStrength,1.2)*shred;
 if(alpha<.008)discard;
 gl_FragColor=vec4(color*(1.+max(0.,uStrength-1.)*.5),alpha);
}`;
