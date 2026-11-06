import * as THREE from 'three';
import { ORIGINALS } from './roster';
import type { VfxKit } from '../render/vfx/VfxKit';

export const BONSHO = !!ORIGINALS.bonsho?.sculpture;

/** How hard the bell has just been struck, 0..1, for every part's material (one value: the loudest Bonsho's). */
export const BONSHO_TOLL = { value: 0 };

const NOISE = `float bonshoHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float bonshoNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(bonshoHash(i),bonshoHash(i+vec3(1,0,0)),f.x),mix(bonshoHash(i+vec3(0,1,0)),bonshoHash(i+vec3(1,1,0)),f.x),f.y),
  mix(mix(bonshoHash(i+vec3(0,0,1)),bonshoHash(i+vec3(1,0,1)),f.x),mix(bonshoHash(i+vec3(0,1,1)),bonshoHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;

export function bonshoSurface(shader: THREE.WebGLProgramParametersWithUniforms, part: string) {
  shader.uniforms.uBonshoToll = BONSHO_TOLL;
  shader.vertexShader = 'varying vec3 vBonshoP;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBonshoP=position;');
  const torso = part === 'BodhiTorso';
  // The bell's own marks, cast into its bronze (the torso only; glTF metres, the bell's axis the y axis, its lip at y 0.1 and
  // its crown at 1.64): the crossed bands of a temple bell's sash pattern, each a double groove - three round it (the lip,
  // the waist, the shoulder) and four down it on the ribs - and in the four lower panels, columns of cast inscription. A
  // groove is dark with a bright lower lip, so it reads as cut into the metal from the gameplay camera's distance.
  const marks = torso ? `
 float bellR=length(vBonshoP.xz),th=atan(vBonshoP.z,vBonshoP.x),onBell=step(.1,vBonshoP.y)*step(vBonshoP.y,1.5)*step(.45,bellR);
 float cut=0.,lip=0.,y=vBonshoP.y;
 for(int k=0;k<3;k++){float yb=k==0?.30:(k==1?.78:1.36);
  for(int e=-1;e<=1;e+=2){float d=y-(yb+float(e)*.045);cut=max(cut,1.-smoothstep(.006,.013,abs(d)));lip=max(lip,smoothstep(.006,.012,-d)*(1.-smoothstep(.012,.024,-d)));}}
 float rib=mod(th-.7853982+.7853982,1.5707963)-.7853982,arc=rib*bellR,inBands=step(.30,y)*step(y,1.36);
 for(int e=-1;e<=1;e+=2){float d=arc-float(e)*.05;cut=max(cut,(1.-smoothstep(.006,.013,abs(d)))*inBands);}
 // the inscription: columns of small cast signs in the panels between the lip's and the waist's bands
 float col=(th+3.1415927)*bellR/.085,row=(y-.40)/.075;
 vec2 cell=floor(vec2(col,row)),f=fract(vec2(col,row));
 float panel=step(.40,y)*step(y,.70)*step(.11,abs(arc));
 float glyph=0.;
 if(panel>0.){float h=bonshoHash(vec3(cell,7.));
  vec2 q=f*vec2(1.,1.)-.5;
  float bar=step(abs(q.y-(h-.5)*.5),.05)*step(abs(q.x),.28);
  float stem=step(abs(q.x-(fract(h*7.)-.5)*.4),.045)*step(abs(q.y),.32);
  float tick=step(abs(q.x+q.y-(fract(h*13.)-.5)*.6),.05)*step(length(q),.3);
  glyph=max(bar,max(stem,tick*step(.4,fract(h*3.))))*step(abs(q.x),.36)*step(abs(q.y),.38);}
 cut=max(cut,glyph*panel)*onBell;lip*=onBell;
 c=mix(c,vec3(.035,.016,.005),cut*.9);
 c+=vec3(1.25,.78,.26)*lip*.8;
 // the ring behind the head (centre 0, 2.25, -0.12, radius 0.42, in the x-y plane) burns gold
 float ring=abs(length(vBonshoP.xy-vec2(0.,2.25))-.42);
 if(vBonshoP.y>1.72&&ring<.06&&vBonshoP.z<-.05)c=vec3(3.4,2.35,1.)*(1.+.8*uBonshoToll);` : '';
  shader.fragmentShader = 'uniform float uBonshoToll;varying vec3 vBonshoP;\n' + NOISE + shader.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
{
 vec3 bn=normalize(normal),bv=normalize(vViewPosition);
 float facing=abs(dot(bn,bv)),key=dot(bn,normalize(vec3(-.55,.62,.56))),fill=dot(bn,normalize(vec3(.8,-.1,.35)));
 // Cast bronze, dark and old: a near-black throat, the body's deep bronze, a lit face in a saturated gold, and a small sheen
 // where the key strikes square. Contrast, not glow: the shape has to read against the dimmed room and the stage's gold light.
 vec3 c=mix(vec3(.05,.02,.005),vec3(.34,.14,.028),smoothstep(-.40,-.28,key));
 c=mix(c,vec3(.92,.46,.09),smoothstep(.14,.22,key));
 c=mix(c,vec3(1.45,.9,.3),smoothstep(.86,.9,key)*.7);
 c+=vec3(.12,.05,.01)*smoothstep(.15,.55,fill);
 // The casting: a slow mottle, and finer grain in it.
 c*=.78+.34*bonshoNoise(vBonshoP*6.5)+.14*bonshoNoise(vBonshoP*21.);${marks}
 // Inked where the form turns away, like a sculpture: each arm, hand and band drawn round with a dark line.
 c=mix(c,vec3(.025,.01,.003),smoothstep(.34,.16,facing)*.88);
 // Struck: the bronze rings bright and cools, and its edge burns gold for that moment.
 c*=1.+.55*uBonshoToll;
 c+=vec3(1.8,1.05,.32)*pow(1.-facing,2.6)*uBonshoToll*1.1;
 gl_FragColor.rgb=c;
}`);
}

/** The bell struck at each of these moments of a move (seconds into it), with how loud. */
const ULT_TOLLS: readonly [number, number][] = [[.78, .8], [1.27, .85], [1.77, .9], [2.34, .95], [3.30, 1.25]];
const SPECIAL_TOLLS: readonly [number, number][] = [[.42, .9]];
const AWAKEN_TOLLS: readonly [number, number][] = [[.46, 1.1]];
const GOLD = 0xffe7a8, BRONZE = 0xd88a1e;

/** The tolls: rings of sound out of the bell, and its bronze's flash (`BONSHO_TOLL`), for each Bonsho drawn. */
export class BonshoTolls {
  private last = new Map<string, number>();
  private struck = new Map<string, { at: number; loud: number }>();
  private p = new THREE.Vector3();
  constructor(private kit: Partial<VfxKit>) {}

  /** A frame of one Bonsho whose guardian stands: `t` seconds into `action`, the bell's centre `bell` (world), its scale. */
  frame(id: string, action: string, t: number, time: number, bell: THREE.Vector3, floor: number, size: number) {
    const list = action === 'ultimate' ? ULT_TOLLS : action === 'special' ? SPECIAL_TOLLS : action === 'awaken' ? AWAKEN_TOLLS : null;
    const before = this.last.get(id) ?? -1; this.last.set(id, t);
    if (!list || t < before) return;
    for (const [at, loud] of list) if (before < at && t >= at) this.toll(id, time - (t - at), bell, floor, size, loud);
  }

  private toll(id: string, born: number, bell: THREE.Vector3, floor: number, size: number, loud: number) {
    this.struck.set(id, { at: born, loud });
    const ring = this.kit.ring?.bind(this.kit); if (!ring) return;
    const r = size * loud;
    // Three rings of sound facing the lens, each wider and later; and one along the floor from the bell's lip.
    ring(bell.x, bell.y, bell.z, .7 * r, 3.6 * r, born, .42, 0xffffff, GOLD, .07);
    ring(bell.x, bell.y, bell.z, .9 * r, 5.2 * r, born + .07, .55, GOLD, BRONZE, .05);
    ring(bell.x, bell.y, bell.z, 1.1 * r, 7 * r, born + .15, .7, GOLD, BRONZE, .035);
    ring(bell.x, floor + .05, bell.z, .8 * r, 5.5 * r, born + .02, .55, 0xffffff, BRONZE, .12, 'flat');
  }

  /** The loudest bell this frame, into `BONSHO_TOLL` (call once a frame, after every `frame`). */
  settle(time: number) {
    let v = 0;
    for (const [id, s] of this.struck) {
      const age = time - s.at;
      if (age > 1.2 || age < -.05) { if (age > 1.2) this.struck.delete(id); continue; }
      v = Math.max(v, Math.min(1, s.loud) * Math.exp(-Math.max(0, age) * 5.5));
    }
    BONSHO_TOLL.value = v;
  }

  /** A fighter no longer drawn with the guardian (its move over). */
  forget(id: string) { this.last.delete(id); }
  reset() { this.last.clear(); this.struck.clear(); BONSHO_TOLL.value = 0; }
}
