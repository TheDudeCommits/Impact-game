import * as THREE from 'three';
import type { Fighter } from '../Fighter';
import { noiseGLSL } from './noise';
import { noiseTexture, NOISE_GLSL } from './noiseTexture';

const VERTEX = /* glsl */`
#include <common>
#include <skinning_pars_vertex>
uniform float uTime; uniform float uStrength; uniform float uThick; uniform float uLick; uniform float uPush;
uniform vec3 uFlow; uniform float uBoil;
varying vec3 vNormalW; varying vec3 vWorld; varying float vUp;
${noiseGLSL}
void main(){
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * objectNormal);
  // Flame tongues licking up off every upward-facing surface: noise that
  // scrolls up the body in world space, so the aura climbs whichever way the
  // fighter is turned, and is taller over the shoulders and the crown.
  // (uFlow: the noise's grain and how fast it climbs - a flame's 2.4 and 3.1. uBoil: 0 licks upward, as a flame; 1
  // swells off every surface alike and does not climb, as a cloak that clings and boils.)
  float flame = snoise(vec3(world.x * uFlow.x, world.y * uFlow.x * .7083 - uTime * uFlow.y, world.z * uFlow.x));
  float lick = max(0.0, flame) * mix(smoothstep(-.2, .9, n.y), 1.0, uBoil);
  world.xyz += n * (uThick * (1.0 + .4 * flame) + lick * uLick) * uStrength;
  world.y += lick * uLick * .5 * uStrength * (1.0 - uBoil);
  vNormalW = n; vWorld = world.xyz; vUp = n.y;
  // Pushed straight away from the lens: the same outline on screen, but
  // behind the body, so it shows only round the silhouette and never over
  // an arm or the chest - including the shell of an arm held in front.
  vec4 mv = viewMatrix * world;
  mv.xyz += normalize(mv.xyz) * uPush;
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = /* glsl */`
uniform vec3 uCore; uniform vec3 uRim; uniform float uTime; uniform float uStrength;
uniform vec3 uFlow; uniform vec4 uLook; uniform float uAlpha; uniform float uBand;
varying vec3 vNormalW; varying vec3 vWorld; varying float vUp;
${NOISE_GLSL}
const vec3 INK = vec3(.02, .014, .012);
void main(){
  // Drawn by its back faces, so all that shows is the band of shell standing
  // out round the body's silhouette. How square its surface is to the eye
  // runs from about 0.6 against the body out to 0 at its own edge: the bands
  // are printed on that, white-hot against the body, then gold, then the
  // outer colour, then an ink line - and the edge is torn into tongues by
  // noise rising up the body.
  vec3 n = normalize(vNormalW), v = normalize(cameraPosition - vWorld);
  float facing = abs(dot(n, v));
  // (uLook: x how soft - 0 the flame's hard printed bands, 1 a gradient thinning to nothing at its edge, a haze or a
  // shroud; y how torn the edge is, a flame's .26; z the white-hot band, 1 or none; w the ink line, 1 or none.
  // uFlow.z: how fast the tear climbs, a flame's 1. A flame's numbers print exactly what this printed before them.)
  float rise = tnoise(vec2(vWorld.x * .35 + vWorld.z * .35, vWorld.y * .22 - uTime * .55 * uFlow.z)).g;
  float torn = rise * uLook.y * smoothstep(-.5, .8, vUp);
  float e = facing - torn, aa = fwidth(facing) + 1e-4;
  if (e < -aa) discard;
  float ink = (1.0 - smoothstep(aa * 1.5, aa * 3.0, e)) * uLook.w;
  // Mostly the aura's gold, with the white-hot band only right against the
  // body: a white shell reads as a blown-out body from close up.
  // (uBand: how much of the shell, from its edge in, is its outer colour - a flame's tenth.)
  float band1 = smoothstep(uBand - aa, uBand + aa, e), band2 = smoothstep(.42 - aa, .42 + aa, e) * uLook.z;
  vec3 col = mix(uRim, uCore * 1.05, band1);
  col = mix(col, vec3(1.2, 1.16, 1.06), band2);
  col = mix(col, INK, ink);
  float a = smoothstep(-aa, aa, e) * uStrength * mix(.95, .85, band2);
  // Soft: its outer colour through the outer third of it, deepening to its core against the body, and thinning away
  // outward.
  col = mix(col, mix(uRim, uCore, smoothstep(.14, .46, e)), uLook.x);
  a = mix(a, smoothstep(.0, .2, e) * uStrength, uLook.x) * uAlpha;
  gl_FragColor = vec4(col, a);
}`;

/** The skinned parts of a body worth an aura: not its ink hulls, its contact
 *  shadow, anything already see-through, or anything that is not skinned. */
/** Carried things skinned to a hand or the hips (the Briar Crown four's are): an aura stood 11 cm off a katana is a slab, not a
 *  blade (round 19, blind critic 7: awakened, Bruin's second light drew "a solid blue rectangle" over his head, and his
 *  idle blade "a black rod covered in barbs"). */
const CARRIED = /^(cardo_weapon|bruin_weapon|bruin_saya|bruin_cigarette)|svanhild-wand/;
function auraSources(fighter: Fighter) {
  const out: THREE.SkinnedMesh[] = [];
  fighter.group.traverse(o => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || mesh.name.endsWith('-ink') || /outline|shadow/i.test(mesh.name) || CARRIED.test(mesh.name)) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.some(m => m.transparent && m.opacity < .9)) return;
    out.push(mesh);
  });
  return out;
}

interface Rig { parts: { source: THREE.SkinnedMesh; shell: THREE.SkinnedMesh }[]; material: THREE.ShaderMaterial; used: number }

/** How a world's power is worn on the body (awakenedPower.ts): one program, these numbers apart.
 *  thick, lick  metres the shell stands off the body, and how far its tongues reach off it;
 *  grain, climb the noise the tongues ride: its grain over the body and how fast it climbs it;
 *  boil         0 the tongues lick upward off the upward surfaces (a flame), 1 they swell off every surface and do
 *               not climb (a cloak that clings);
 *  soft         0 hard printed bands, 1 a gradient thinning to nothing at its edge;
 *  torn, tear   how ragged the outer edge is, and how fast the tear climbs (a flame's 1);
 *  hot, ink     the white-hot band against the body and the ink line round the edge, 1 or 0;
 *  band         how much of the shell, from its edge in, is its outer colour (a flame's tenth);
 *  alpha        how much of what is behind it the whole shell covers. */
export interface ShellLook { thick: number; lick: number; grain: number; climb: number; boil: number; soft: number; torn: number; tear: number; hot: number; ink: number; band: number; alpha: number }
export const SHELL = {
  /** Last Sun's: a flame hugging the body, white-hot against it, licking up off the shoulders and the crown. */
  flame: { thick: .07, lick: .24, grain: 2.4, climb: 3.1, boil: 0, soft: 0, torn: .26, tear: 1, hot: 1, ink: 1, band: .1, alpha: 1 },
  /** Will's dark: no flame and no light - a haze of pressure standing off the outline, near black against the body
   *  and thinning to its edge's colour, swelling slowly. */
  haze: { thick: .11, lick: .13, grain: 1.5, climb: .9, boil: .7, soft: 1, torn: .34, tear: .45, hot: 0, ink: 0, band: .1, alpha: .7 },
  /** Cinder Requiem's pressure: thin against the body and streaming up off the shoulders and the crown in long wisps, fast, torn
   *  like smoke; no white-hot band - it is pressure given a colour, not a flame. */
  smoke: { thick: .05, lick: .46, grain: 2.1, climb: 4.8, boil: .12, soft: .38, torn: .5, tear: 2.2, hot: 0, ink: 1, band: .1, alpha: .92 },
  /** Konta's chi: a cloak that clings and boils - close on the body, swelling off every surface in small slow
   *  bubbles, see-through, with no tongues and nothing climbing. Not a flame. */
  cloak: { thick: .055, lick: .11, grain: 3.4, climb: .7, boil: 1, soft: .55, torn: .16, tear: .5, hot: 0, ink: 0, band: .16, alpha: .88 },
  /** Hex Fallout's hex energy: a dark flame licking up the body, near black against it and its colour only at
   *  the edge, a third of the shell. */
  curse: { thick: .055, lick: .3, grain: 2.6, climb: 2.5, boil: 0, soft: .22, torn: .42, tear: 1.3, hot: 0, ink: 0, band: .3, alpha: .92 },
  /** Salvage Wilds's Aura: a smooth dense shroud - an even thickness of aura all round the body, flowing up slowly,
   *  with no tongues, no tear and no hard edge. */
  shroud: { thick: .095, lick: .08, grain: 1.2, climb: 1.2, boil: .45, soft: .85, torn: .1, tear: .6, hot: 0, ink: 0, band: .2, alpha: .8 },
} as const satisfies Record<string, ShellLook>;

/** A gold awakening's aura as a shell that hugs the body.
 *
 *  Each skinned part of the fighter is drawn a second time - its own vertex
 *  buffers and its own live skeleton, so it follows every frame of the
 *  animation for free - pushed out along its normals and licked upward by
 *  noise into flame tongues, and drawn by its back faces only, so it can
 *  never cover the body it surrounds. It replaced a handful of campfire
 *  flame cards stuck to the fighter's back.
 */
export class AuraShell {
  private rigs = new Map<Fighter, Rig>();
  private warm?: THREE.SkinnedMesh;
  private frame = 0;
  constructor(private scene: THREE.Scene) {}

  private material(core: number, rim: number) {
    return new THREE.ShaderMaterial({
      name: 'AuraShell', vertexShader: VERTEX, fragmentShader: FRAGMENT, side: THREE.BackSide,
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uThick: { value: .07 }, uLick: { value: .24 }, uPush: { value: .45 }, uCore: { value: new THREE.Color(core) }, uRim: { value: new THREE.Color(rim) }, uNoise: { value: noiseTexture() },
        uFlow: { value: new THREE.Vector3(2.4, 3.1, 1) }, uBoil: { value: 0 }, uLook: { value: new THREE.Vector4(0, .26, 1, 1) }, uAlpha: { value: 1 }, uBand: { value: .1 } },
      transparent: true, depthWrite: false, toneMapped: false,
    });
  }

  /** One skinned mesh with the aura's program, never drawn, for the load-time compile. */
  warmup() {
    if (this.warm) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, .01, 0, .01, 0, 0], 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(12).fill(0), 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    const bone = new THREE.Bone(), mesh = new THREE.SkinnedMesh(geometry, this.material(0xffe37a, 0xffa227));
    mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
    mesh.name = 'aura-shell-warmup'; mesh.frustumCulled = false; mesh.visible = false;
    this.scene.add(mesh); this.warm = mesh;
  }
  hideWarmup() { if (this.warm) this.warm.visible = false; }

  private rig(fighter: Fighter, core: number, rim: number) {
    let rig = this.rigs.get(fighter);
    if (rig) return rig;
    const material = this.material(core, rim);
    const parts = auraSources(fighter).map(source => {
      // The part's own buffers without its morph targets, bound to its live
      // skeleton: in attached bind mode where the shell sits cancels out, so
      // it can hang off the scene root rather than inside the fighter.
      const geometry = new THREE.BufferGeometry(), from = source.geometry;
      if (from.index) geometry.setIndex(from.index);
      for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) if (from.attributes[name]) geometry.setAttribute(name, from.attributes[name]);
      geometry.groups = from.groups.slice(); geometry.drawRange = { ...from.drawRange };
      const shell = new THREE.SkinnedMesh(geometry, material);
      shell.bindMode = source.bindMode; shell.bindMatrix.copy(source.bindMatrix); shell.bindMatrixInverse.copy(source.bindMatrixInverse); shell.skeleton = source.skeleton;
      shell.name = 'aura-shell'; shell.frustumCulled = false; shell.visible = false; shell.renderOrder = 1;
      shell.castShadow = shell.receiveShadow = false;
      this.scene.add(shell);
      return { source, shell };
    });
    rig = { parts, material, used: 0 };
    this.rigs.set(fighter, rig);
    return rig;
  }

  /** Burn the aura round `fighter` this frame at `strength` (0 hides it), worn as `look` (a flame unless said). */
  draw(fighter: Fighter, time: number, strength: number, core: number, rim: number, look: ShellLook = SHELL.flame) {
    const rig = this.rig(fighter, core, rim), u = rig.material.uniforms;
    u.uTime.value = time; u.uStrength.value = strength; rig.used = this.frame;
    (u.uCore.value as THREE.Color).setHex(core); (u.uRim.value as THREE.Color).setHex(rim);
    u.uThick.value = look.thick; u.uLick.value = look.lick; u.uBoil.value = look.boil; u.uAlpha.value = look.alpha; u.uBand.value = look.band;
    (u.uFlow.value as THREE.Vector3).set(look.grain, look.climb, look.tear); (u.uLook.value as THREE.Vector4).set(look.soft, look.torn, look.hot, look.ink);
    for (const part of rig.parts) {
      let visible = strength > .01;
      for (let o: THREE.Object3D | null = part.source; o && visible; o = o.parent) { visible = o.visible; if (o === fighter.group) break; }
      part.shell.visible = visible;
      // Detached parts carry their own world transform into the skinning.
      if (visible && part.source.bindMode !== THREE.AttachedBindMode) { part.shell.matrixAutoUpdate = false; part.shell.matrix.copy(part.source.matrixWorld); part.shell.matrixWorldNeedsUpdate = true; }
    }
  }

  /** Start a frame; hides every shell not drawn in it at `end`. */
  begin() { this.frame++; }
  end(fighters: ReadonlyMap<string, Fighter>) {
    for (const [fighter, rig] of this.rigs) {
      if (rig.used !== this.frame) for (const part of rig.parts) part.shell.visible = false;
      if ((this.frame & 63) === 0) { let present = false; for (const f of fighters.values()) if (f === fighter) { present = true; break; } if (!present) this.release(fighter, rig); }
    }
  }

  private release(fighter: Fighter, rig: Rig) {
    // The buffers are the fighter's own: detach them before disposing.
    for (const part of rig.parts) { part.shell.removeFromParent(); part.shell.geometry.index = null; part.shell.geometry.attributes = {}; part.shell.geometry.dispose(); }
    rig.material.dispose(); this.rigs.delete(fighter);
  }
  get count() { let n = 0; for (const rig of this.rigs.values()) for (const part of rig.parts) if (part.shell.visible) n++; return n; }
  reset() { for (const rig of this.rigs.values()) for (const part of rig.parts) part.shell.visible = false; }
  dispose() {
    for (const [fighter, rig] of this.rigs) this.release(fighter, rig);
    if (this.warm) { this.warm.removeFromParent(); (this.warm.material as THREE.Material).dispose(); this.warm.geometry.dispose(); this.warm = undefined; }
  }
}
