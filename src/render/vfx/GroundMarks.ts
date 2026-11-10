import * as THREE from 'three';
import { noiseGLSL } from './noise';
import { noiseTexture, NOISE_GLSL } from './noiseTexture';

/** Marks left on a surface: a crater of radial cracks, or a burn. For the ball modes: a
 *  skid - the dry-brush streaks a sliding body leaves, laid along the mark's own x (its `rotation`) - and a stamp, one
 *  brush stroke round a dab of colour. Both are ink that takes its `glow` colour as a lasting tint (by `glowAmount`, 0..1)
 *  where a crack's and a burn's glow cools in a second. */
export const MARK = { crack: 0, scorch: 1, skid: 2, stamp: 3 } as const;
const STRIDE = 16;
const colour = new THREE.Color();

const VERTEX = /* glsl */`
attribute vec4 aPosBorn; attribute vec4 aNormalLife; attribute vec4 aShape; attribute vec4 aGlow;
uniform float uTime;
varying vec2 vUv; varying vec4 vInfo; varying vec4 vGlow;
void main(){
  float age = uTime - aPosBorn.w, t = age / max(aNormalLife.w, 1e-4);
  vUv = position.xy; vInfo = vec4(t, age, aShape.y, aShape.z); vGlow = aGlow;
  if (age < 0.0 || t >= 1.0) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
  vec3 n = normalize(aNormalLife.xyz);
  vec3 t1 = normalize(cross(n, abs(n.y) < .99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), t2 = cross(n, t1);
  float cs = cos(aShape.w), sn = sin(aShape.w);
  vec2 c = vec2(position.x * cs - position.y * sn, position.x * sn + position.y * cs) * aShape.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(aPosBorn.xyz + n * .012 + t1 * c.x + t2 * c.y, 1.0);
}`;

const FRAGMENT = /* glsl */`
varying vec2 vUv; varying vec4 vInfo; varying vec4 vGlow;
${noiseGLSL}
${NOISE_GLSL}
vec4 crackMark(vec2 uv, float t, float age, float seed){
  float r = length(uv), ang = atan(uv.y, uv.x);
  // The crater opens in a few frames, as the blow arrives, and then only fades.
  float R = mix(.3, 1.0, 1.0 - pow(1.0 - clamp(age / .16, 0.0, 1.0), 3.0));
  float n = floor(7.0 + hash11(seed) * 5.0), sector = (ang / 6.2831853 + .5) * n, id = floor(sector);
  float jag = (tnoise(vec2(r * .7, id * .37 + seed * .01)).g - .5) * .64 + (tnoise(vec2(r * 1.9, id * .53 + seed * .02)).a - .5) * .2;
  float centre = (hash11(seed + id * 2.3) - .5) * .45 + jag;
  float arc = abs(fract(sector) - .5 - centre) * r * 6.2831853 / n;
  float reach = R * mix(.5, 1.0, hash11(seed * 3.1 + id));
  float width = mix(.03, .004, clamp(r / max(reach, .01), 0.0, 1.0)) * (1.0 + hash11(id + seed) * .6);
  float aa = fwidth(arc) * 1.3 + 1e-4;
  float radial = (1.0 - smoothstep(width, width + aa, arc)) * (1.0 - smoothstep(reach - .04, reach, r));
  // Concentric breaks between the radial ones: the spider web of a crater.
  float web = 0.0;
  for (int k = 0; k < 2; k++) {
    float ringR = (.24 + float(k) * .26) * R + (tnoise(vec2(ang / 6.2831853 * 2.0 + float(k) * .4, seed * .01)).g - .5) * .1;
    float d = abs(r - ringR), w = .012 * (1.0 - float(k) * .35);
    web = max(web, (1.0 - smoothstep(w, w + fwidth(r) * 1.3, d)) * step(.15, hash11(id * 5.1 + float(k) + seed)));
  }
  float crater = 1.0 - smoothstep(.12, .2, r + (tnoise(uv * .6 + seed * .01).b - .5) * .07);
  float fade = 1.0 - smoothstep(.55, 1.0, t);
  float a = max(max(radial, web * .9), crater * .5) * fade;
  float hot = exp(-age * 5.0) * max(radial, crater) * fade;
  return vec4(vec3(.028, .026, .03) * a + vGlow.rgb * vGlow.w * hot, a);
}
vec4 scorchMark(vec2 uv, float t, float age, float seed){
  // A blast crater, not a puddle: a charred disc darkest at its heart, radial
  // cracks running out past it, and a rim glowing in the energy's colour that
  // cools to nothing over a second. The glowing embers it used to be dotted
  // with read, in blue, as splashes of water.
  float r = length(uv), ang = atan(uv.y, uv.x);
  vec4 f = tnoise(uv * .35 + seed * .013);
  float wob = f.r * .5 + f.g * .3 + f.b * .2 - .5;
  float R = mix(.3, .6, 1.0 - pow(1.0 - clamp(age / .12, 0.0, 1.0), 3.0));
  float e = r + wob * .2, aa = fwidth(e) * 1.3 + 1e-4;
  float burn = 1.0 - smoothstep(R - aa, R + aa, e);
  float heart = 1.0 - smoothstep(0.0, R * .85, e);
  // Straight cracks with a kink or two, not rivers: the noise only nudges
  // each one off its spoke, and it tapers to a hairline at its tip.
  float n = floor(8.0 + hash11(seed) * 5.0), sector = (ang / 6.2831853 + .5) * n, id = floor(sector);
  float jag = (tnoise(vec2(r * .9, id * .37 + seed * .01)).g - .5) * .16;
  float arc = abs(fract(sector) - .5 - (hash11(seed + id * 2.3) - .5) * .4 - jag) * r * 6.2831853 / n;
  float reach = mix(.72, 1.0, hash11(seed * 3.1 + id));
  float width = mix(.014, .002, clamp((r - R * .5) / max(reach - R * .5, .01), 0.0, 1.0));
  float crack = (1.0 - smoothstep(width, width + fwidth(arc) * 1.3 + 1e-4, arc)) * (1.0 - smoothstep(reach - .05, reach, r)) * smoothstep(R * .4, R * .6, r);
  // The rim is a line, not a band: a hot edge round the charred disc.
  float rim = 1.0 - smoothstep(.006, .016 + aa, abs(e - R));
  float heat = exp(-age * 3.2), fade = 1.0 - smoothstep(.55, 1.0, t);
  float a = max(burn * mix(.72, .94, heart), crack * .9) * fade;
  vec3 col = mix(vec3(.07, .055, .05), vec3(.012, .01, .012), heart) * a;
  // Only the rim and the first stretch of each crack glow, briefly.
  vec3 glow = vGlow.rgb * vGlow.w * (rim * 1.6 + crack * .7 * (1.0 - smoothstep(R, R * 1.6, r)) + heart * .2) * heat * fade;
  return vec4(col + glow, a);
}
vec4 skidMark(vec2 uv, float t, float age, float seed){
  // Where a body slid: three streaks of a dry brush along x, each its own length and width, thin where the slide began
  // and blunt where it stopped, broken where the brush ran out of ink. Laid from tail to head in a quarter of a second.
  float a = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k), lane = (fk - 1.0) * .15 + (hash11(seed + fk * 3.7) - .5) * .07;
    float from = -mix(.6, .95, hash11(seed * 2.3 + fk * 5.1)), to = mix(.55, .95, hash11(seed * 1.3 + fk * 2.9));
    float s = (uv.x - from) / max(to - from, .01);
    float body = smoothstep(0.0, .45, s) * (1.0 - smoothstep(.93, 1.0, s));
    float wob = (tnoise(vec2(uv.x * .35 + seed * .01, fk * .31)).g - .5) * .07;
    float half_ = mix(.035, .07, hash11(seed * 1.7 + fk)) * body;
    float dry = smoothstep(.3, .55, tnoise(vec2(uv.x * 1.3 + fk * .37, uv.y * 7.0 + seed * .01)).r + body * .22);
    float d = abs(uv.y - lane - wob), aa = fwidth(uv.y) * 1.3 + 1e-4;
    a = max(a, (1.0 - smoothstep(half_, half_ + aa, d)) * dry * step(0.0, s) * step(s, 1.0));
  }
  a *= smoothstep(0.0, .2, age / .25 - (uv.x * .5 + .5) * .8) * (1.0 - smoothstep(.55, 1.0, t)) * .7;
  return vec4(mix(vec3(.04, .036, .04), vGlow.rgb, clamp(vGlow.w, 0.0, 1.0) * .6) * a, a);
}
vec4 stampMark(vec2 uv, float t, float age, float seed){
  // One brush stroke round: thick where the brush landed, thinning and breaking as it ran dry, never quite closed. A
  // dab in the mark's colour at its heart. Drawn round in a third of a second.
  float r = length(uv), turn = fract(atan(uv.y, uv.x) / 6.2831853 + .5 + hash11(seed));
  float wob = (tnoise(vec2(turn * 1.5, seed * .01)).g - .5) * .07;
  float w = mix(.12, .03, smoothstep(0.0, .9, turn)), aa = fwidth(r) * 1.3 + 1e-4;
  float ring = 1.0 - smoothstep(w, w + aa, abs(r - .72 - wob));
  float dry = smoothstep(.15 + turn * .45, .4 + turn * .45, tnoise(vec2(turn * 5.0, r * 4.0 + seed * .01)).r + .3);
  ring *= dry * (1.0 - smoothstep(.86, .93, turn)) * (1.0 - smoothstep(-.05, .05, turn - age / .3));
  float blot = 1.0 - smoothstep(.24, .24 + aa * 2.0, r + (tnoise(uv * .9 + seed * .013).b - .5) * .16);
  float fade = 1.0 - smoothstep(.55, 1.0, t), a = max(ring * .82, blot * .9) * fade;
  return vec4(mix(vec3(.035, .032, .036), vGlow.rgb, blot * clamp(vGlow.w, 0.0, 1.0)) * a, a);
}
void main(){
  vec4 o = vInfo.z < .5 ? crackMark(vUv, vInfo.x, vInfo.y, vInfo.w) : vInfo.z < 1.5 ? scorchMark(vUv, vInfo.x, vInfo.y, vInfo.w)
    : vInfo.z < 2.5 ? skidMark(vUv, vInfo.x, vInfo.y, vInfo.w) : stampMark(vUv, vInfo.x, vInfo.y, vInfo.w);
  if (o.a < .003 && max(o.r, max(o.g, o.b)) < .003) discard;
  gl_FragColor = o;
}`;

/** Cracks and burns on the floor or a wall, faded out over a few seconds.
 *
 *  The same shape as the sprite field: one quad per mark, a ring buffer of
 *  launch records, and the whole life of a mark in the shader. Drawn with a
 *  polygon offset so a mark lying on the floor never fights it for depth.
 */
export class GroundMarks {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private data: Float32Array;
  private buffer: THREE.InstancedInterleavedBuffer;
  private cursor = 0;
  private epoch = 0;
  private started = false;
  /** How many of the pool's slots new marks go round (all of them by default). A caller
   *  that wants fewer marks at a time - a low quality - lowers it; the marks in the slots beyond are left to fade. */
  limit = Infinity;
  constructor(scene: THREE.Scene, readonly capacity = 48) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.data = new Float32Array(capacity * STRIDE);
    for (let i = 0; i < capacity; i++) this.data[i * STRIDE + 3] = -1e9;
    this.buffer = new THREE.InstancedInterleavedBuffer(this.data, STRIDE, 1);
    this.buffer.setUsage(THREE.DynamicDrawUsage);
    ['aPosBorn', 'aNormalLife', 'aShape', 'aGlow'].forEach((attribute, i) => geometry.setAttribute(attribute, new THREE.InterleavedBufferAttribute(this.buffer, 4, i * 4)));
    geometry.instanceCount = capacity;
    const material = new THREE.ShaderMaterial({
      name: 'GroundMarks', uniforms: { uTime: { value: 0 }, uNoise: { value: noiseTexture() } }, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, forceSinglePass: true,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'vfx-ground-marks'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }

  /** A mark of `kind` centred on the point, lying in the plane whose normal is
   *  (nx,ny,nz): the floor is (0,1,0), a wall its own normal. `glow` lights
   *  the fresh crack or burn in the colour of what made it, cooling off. */
  mark(kind: number, x: number, y: number, z: number, nx: number, ny: number, nz: number, size: number, born: number, life: number, glow = 0xffffff, glowAmount = 0, rotation = Math.random() * Math.PI * 2) {
    if (!this.started) { this.started = true; this.epoch = born; }
    if (this.cursor >= this.limit) this.cursor = 0;
    const d = this.data, o = this.cursor * STRIDE;
    colour.setHex(glow);
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = born - this.epoch;
    d[o + 4] = nx; d[o + 5] = ny; d[o + 6] = nz; d[o + 7] = life;
    d[o + 8] = size; d[o + 9] = kind; d[o + 10] = Math.random() * 91; d[o + 11] = rotation;
    d[o + 12] = colour.r; d[o + 13] = colour.g; d[o + 14] = colour.b; d[o + 15] = glowAmount;
    this.buffer.addUpdateRange(o, STRIDE); this.buffer.needsUpdate = true;
    this.cursor = (this.cursor + 1) % Math.min(this.capacity, Math.max(1, this.limit));
  }

  update(time: number) {
    if (!this.started) { this.started = true; this.epoch = time; }
    if (time - this.epoch > 600 || time < this.epoch - 60) {
      const shift = time - this.epoch;
      for (let o = 3; o < this.data.length; o += STRIDE) if (this.data[o] > -1e8) this.data[o] -= shift;
      this.epoch = time; this.buffer.clearUpdateRanges(); this.buffer.addUpdateRange(0, this.data.length); this.buffer.needsUpdate = true;
    }
    this.mesh.material.uniforms.uTime.value = time - this.epoch;
  }

  clear() {
    for (let o = 3; o < this.data.length; o += STRIDE) this.data[o] = -1e9;
    this.buffer.clearUpdateRanges(); this.buffer.addUpdateRange(0, this.data.length); this.buffer.needsUpdate = true; this.cursor = 0;
  }

  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
