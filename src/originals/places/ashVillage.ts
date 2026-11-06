import * as THREE from 'three';
import type { DressContext } from '../../render/stages/dressing';
import { StageAmbient } from '../../render/stages/ambient';
import { StageKit } from '../../render/stages/StageKit';
import { Beacons, LightPools } from '../../render/stages/glow';
import { Forge } from './forge';
import { CHEERING, STANDING, fires, inlay, lanternString, people } from './richness';
import { rand } from './remake';
import { crater } from './battleScars';
import { PaintedSky } from '../../render/stages/PaintedSky';
import { ashBanner as ashBannerCloth } from './craterWreck';
import { ashMark } from './mark';

export async function ashVillage(root: THREE.Group, objective: { update(time: number): void }) {
  const ambient = new StageAmbient('hidden-ash'), kit = new StageKit(root, 'hidden-ash');
  const c = { stage: 'hidden-ash', root, ambient, kit } as unknown as DressContext;
  const tick = objective.update.bind(objective);
  objective.update = (time: number) => { tick(time); ambient.update(time); };
  await kit.load(['own/proving-kneeler', 'own/proving-brazier', 'own/proving-rack', 'own/proving-post', 'br/meshy-stall', 'br/cart', 'cc0/barrels', 'br/umbrella']);
  const r = rand(611);
  // On the inner gate wall's top (its boxes: x +/-8 to +/-40 at z 20): kneeling guardians and braziers either side
  // of the gate, facing the approach (the wall's top is 8 m: HiddenAshVillage's wall-tall pieces, 8 m high).
  const braziers: { x: number; y: number; z: number; size: number }[] = [];
  for (const s of [-1, 1]) {
    kit.place('own/proving-kneeler', { x: s * 13.2, y: 8, z: 20, height: 3.4, rot: Math.PI });
    for (const x of [17.5, 30]) { kit.place('own/proving-brazier', { x: s * x, y: 8, z: 20, height: 1.6, rot: x }); braziers.push({ x: s * x, y: 9.45, z: 20, size: .75 }); }
    // Along the street fronts past the bounds (x 41-47): racks, posts, carts, barrels, a stall, an umbrella.
    for (let k = 0; k < 4; k++) kit.place('own/proving-rack', { x: s * 44.5, z: -30 + k * 21, height: 2.1, rot: s > 0 ? -Math.PI / 2 : Math.PI / 2 });
    for (let k = 0; k < 3; k++) kit.place('own/proving-post', { x: s * 43.2, z: -22 + k * 23, height: 2.2, rot: r() * 6 });
    kit.place('br/cart', { x: s * 45, z: -40, height: 1.9, rot: s * 1.2 });
    kit.place('br/cart', { x: s * 45.5, z: 8, height: 1.9, rot: -s * 1.4 });
    for (let k = 0; k < 4; k++) kit.place('cc0/barrels', { x: s * (42.6 + r()), z: -35 + k * 24 + r() * 3, height: 1.1, rot: r() * 6 });
    kit.place('br/meshy-stall', { x: s * 46, z: 30, height: 3.2, rot: s > 0 ? -Math.PI / 2 : Math.PI / 2 });
    kit.place('br/umbrella', { x: s * 44, z: 38, height: 3.4, rot: r() * 6 });
  }
  kit.flush('hidden-ash');

  const f = new Forge(c, 'hidden ash defence');
  f.mat('dark', { roughness: 1 });
  f.mat('glow', { basic: true });
  const glow = new Beacons(root, 180, ambient.time), pools = new LightPools(root, 24);
  const braziersSouth: { x: number; y: number; z: number; size: number }[] = [];
  fires(c, braziers, { glow, smoke: .35, seed: 31 });
  // Paper lanterns down both street fronts, post to post (the lantern posts at x +/-41, 6 m), and over the gate's wall.
  for (const s of [-1, 1]) {
    for (let z = -46; z < 56; z += 17) lanternString(f, glow, [s * 41.2, 6.2, z], [s * 41.2, 6.2, z + 17], { gap: 2.4, sag: 1.4, colour: 0xff8a40, bodyTint: 0xff9a50, seed: z * s + 80 });
    for (let z = -37; z <= 39; z += 19) pools.add(s * 39.5, z + 8, 6, new THREE.Color(.4, .2, .08), .03);
    lanternString(f, glow, [s * 9.5, 12.4, 18.6], [s * 40, 8.6, 19.2], { gap: 2.6, sag: 1.6, colour: 0xffa050, bodyTint: 0xffb060, size: .9, seed: s + 90 });
    // And along the south line (its walls 9 m at x +/-9 to +/-21 and +/-33 to +/-41, its torii at 0 and +/-27, z -46).
    lanternString(f, glow, [s * 6.5, 10.6, -45.4], [s * 27, 9.4, -45.4], { gap: 2.4, sag: 1.5, colour: 0xff8a40, bodyTint: 0xff9a50, seed: s + 94 });
    lanternString(f, glow, [s * 27, 9.4, -45.4], [s * 41, 9, -45.4], { gap: 2.4, sag: 1.2, colour: 0xff8a40, bodyTint: 0xff9a50, seed: s + 96 });
    for (const x of [15, 37]) braziersSouth.push({ x: s * x, y: 9.35, z: -46, size: .7 });
  }
  for (const b of braziersSouth) f.cyl('dark', b.x, 9, b.z, .45, .28, .4, 0x2a2420, { sides: 8 });
  fires(c, braziersSouth, { glow, smoke: .35, seed: 37 });
  f.done();
  glow.finish('hidden ash lanterns', 2.1);
  pools.finish('hidden ash lantern pools');
  // The village's banners down the south walls' inner faces, toward the plaza.
  const banner = ashBannerCloth();
  for (const s of [-1, 1]) for (const x of [11, 15, 19, 35, 39]) ambient.cloth(banner, { x: s * x, y: 8.4, z: -44.9, width: 1.8, height: 4.2, rot: 0, wind: .35, lit: .3 });
  // The defenders on the inner wall's walk, either side of the gate, and villagers at the street fronts.
  const spots = [
    ...Array.from({ length: 34 }, (_, i) => { const s = i % 2 ? 1 : -1, x = s * (11.5 + r() * 27.5); return { x, y: 8, z: 20 + (r() - .5) * 1.2, cell: [STANDING, CHEERING][Math.floor(r() * 2)] + Math.floor(r() * 8), height: 1.72 + r() * .12, flip: r() < .5 }; })
      .filter(p => Math.abs(Math.abs(p.x) - 13.2) > 1.3 && Math.abs(Math.abs(p.x) - 17.5) > 1 && Math.abs(Math.abs(p.x) - 30) > 1),
    ...Array.from({ length: 30 }, (_, i) => { const s = i % 2 ? 1 : -1; return { x: s * (42 + r() * 4.5), y: 0, z: -42 + r() * 88, cell: [STANDING, STANDING, CHEERING][Math.floor(r() * 3)] + Math.floor(r() * 8), height: 1.7 + r() * .12, flip: r() < .5 }; }),
  ];
  people(c, spots, { robes: ['#5a524a', '#8a6a3a', '#3a3a40', '#7a3a2a', '#6a6a5a', '#4a3a30', '#9a8a6a', '#2e2e34'], wraps: ['#8e2620', '#4a4440', '#c8b890', '#2a2624'] }, { name: 'hidden ash defenders', shade: .82, sway: .05 });
  // The village's mark (mark.ts) laid in the approach's paving, scorch marks and petals of the last raid on it.
  inlay(c, (g, n) => {
    const u = n / 24;
    ashMark(g, n / 2, n / 2, 10.4 * u, 'rgba(120,40,30,.36)');
  }, { x: 0, z: -14, size: 24, px: 1024, y: .012, roughness: .9, name: 'hidden ash mark' });
  inlay(c, (g, n) => {
    const u = n / 80, q = rand(613);
    g.translate(n / 2, n / 2);
    for (let k = 0; k < 9; k++) {
      const x = (q() - .5) * 70 * u, z = (q() - .5) * 70 * u, rr = (1.6 + q() * 2.4) * u;
      if (Math.abs(x) < 9 * u && z > -26 * u && z < -2 * u) continue;
      const grad = g.createRadialGradient(x, z, 0, x, z, rr);
      grad.addColorStop(0, 'rgba(20,16,14,.55)'); grad.addColorStop(.6, 'rgba(40,30,26,.3)'); grad.addColorStop(1, 'rgba(40,30,26,0)');
      g.fillStyle = grad; g.beginPath(); g.arc(x, z, rr, 0, Math.PI * 2); g.fill();
    }
    for (let k = 0; k < 1800; k++) {
      // Drifted toward the street fronts and their cherry trees, a few blown across the approach.
      const side = q() < .5 ? -1 : 1, x = side * (q() < .8 ? 22 + q() * 18 : q() * 22) * u, z = (q() - .5) * 80 * u;
      g.fillStyle = `rgba(${214 + q() * 24},${150 + q() * 30},${164 + q() * 26},${.3 + q() * .35})`;
      g.beginPath(); g.ellipse(x, z, .1 * u, .055 * u, q() * 3, 0, Math.PI * 2); g.fill();
    }
  }, { x: 0, z: -2, size: 80, px: 2048, y: .011, roughness: .9, name: 'hidden ash scorch and petals' });
  // Smoke from the chimneys of the street fronts and the town behind; crows at dusk; petals on the wind; fireflies.
  const chimneys: { x: number; y: number; z: number; size: number }[] = [];
  for (const s of [-1, 1]) for (let k = 0; k < 6; k++) chimneys.push({ x: s * (56 + r() * 14), y: 16 + r() * 8, z: -60 + k * 26 + r() * 6, size: 2.6 });
  ambient.puffs({ spots: chimneys, color: 0xb8aaa4, shade: 0x5a4c50, opacity: .32, life: 9, rise: 14, grow: 3, drift: [.9, 0, .3], seed: 614, order: 1 });
  ambient.birds({ centre: [0, 0, -10], count: 14, radius: 70, height: 38, spread: 12, speed: 7, size: .7, color: 0x16121a, seed: 615 });
  ambient.motes({ min: [-70, 0, -60], max: [70, 10, 70], count: 240, velocity: [1.1, -.25, .5], size: .08, color: 0xf0b0c4, color2: 0xffd8e4, opacity: .85, wobble: 1.4, seed: 616 });
  for (const s of [-1, 1]) ambient.motes({ min: [s > 0 ? 40 : -48, .3, -46], max: [s > 0 ? 48 : -40, 3, 58], count: 60, velocity: [.1, .15, .1], size: .05, color: 0xd8ff8a, color2: 0xffe890, opacity: .9, additive: true, twinkle: 1, wobble: 1, seed: 617 + s });
  siege(c);
  ambient.finish();
  root.add(ambient.root);
}

function siege(c: DressContext) {
  const { ambient, root } = c, r = rand(641);
  const dusk = root.getObjectByName('Painted dusk') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
  const image = dusk?.material.map?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (dusk && image?.width) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const g = canvas.getContext('2d')!;
    g.filter = 'saturate(40%) brightness(88%)';
    g.translate(image.width, 0); g.scale(-1, 1); g.drawImage(image, 0, 0);
    const sky = new PaintedSky(new THREE.CanvasTexture(canvas), { rotation: dusk.rotation.y - Math.PI / 2, drift: 0, exposure: 1 });
    sky.mesh.name = 'Painted dusk (far plane)';
    root.add(sky.mesh);
    dusk.visible = false;
  }
  // The guardian flame on the pyramid (its bowl at 0, 75, 238): a pillar of fire a hundred metres tall, drawn as a stack of
  // glows (additive smoke cards over the painted sky laid a dark disc round it), embers streaming up it.
  const px = 0, py = 76, pz = 238;
  const glow = new Beacons(root, 40, ambient.time);
  for (let k = 0; k < 12; k++) glow.add(px + (r() - .5) * 2, py + 4 + k * 10, pz, 30 - k * 1.7, k < 4 ? 0xffc060 : k < 8 ? 0xff8a30 : 0xff5a1a, -1, k * .13, 1);
  ambient.motes({ min: [px - 8, py, pz - 8], max: [px + 8, py + 140, pz + 8], count: 120, velocity: [.3, 9, .3], size: .6, color: 0xffb040, color2: 0xffe0a0, opacity: 1, additive: true, twinkle: .6, wobble: 1.2, seed: 642 });
  root.add(flameSheet(px, py, pz, ambient.time));
  // South: the outer town burning past the wall - fires on the ground behind it, the siege's smoke in columns.
  const burning: { x: number; y: number; z: number; size: number }[] = [];
  for (const [x, z] of [[-58, -62], [-30, -78], [8, -96], [36, -70], [62, -88], [-70, -104], [24, -122], [-12, -140]] as const) {
    for (let k = 0; k < 3; k++) burning.push({ x: x + (r() - .5) * 8, y: .5 + r(), z: z + (r() - .5) * 8, size: 3 + r() * 2.5 });
    glow.add(x, 6, z, 22, 0xff7a2a, -1, r(), 1);
  }
  ambient.fire(burning.map((s, i) => ({ ...s, smoke: .9, seed: i * .37 })));
  const columns = [[-58, -62], [8, -96], [62, -88], [-70, -104], [24, -122]].flatMap(([x, z], i) =>
    Array.from({ length: 8 }, (_, k) => ({ x: x + k * 2.2, y: 10 + k * 8, z: z - k * .8, size: 6 + k * 2.2 + (i % 2) * 1.5 })));
  ambient.puffs({ spots: columns, color: 0x5a403c, shade: 0x18100e, opacity: .7, life: 12, rise: 6, grow: 1.8, drift: [2, 0, .6], cel: true, seed: 645, order: 0 });
  glow.finish('hidden ash siege fires', 1.1);
  arrows(c);
  // The last raid's worst blow in the approach; barricades broken along the street fronts past the bounds.
  crater(c, { size: 30, cx: -4, cz: -24, x: -4, z: -24, radius: 3.8, reach: 12, seed: 646, strokes: [[[-16, -12], [6, -36]]], lit: -Math.PI / 2,
    ember: 0xff7028, strength: 1.1, litStone: 'rgba(196,170,150,.8)', darkStone: 'rgba(40,34,36,.85)', name: 'hidden ash crater' });
  const f = new Forge(c, 'hidden ash barricades');
  f.mat('timber', { roughness: .95 });
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
    const z = -40 + k * 13 + r() * 4, x = s * (41.2 + r() * 1.2);
    // A stake barricade: crossed poles, one or two broken off, scorched.
    for (let j = 0; j < 4; j++) {
      const zz = z + j * .9, lean = (r() - .5) * .9, h = j === 1 && r() < .6 ? .9 : 1.9 + r() * .5;
      f.pipe('timber', [x, 0, zz], [x + s * lean, h, zz + (j % 2 ? .7 : -.7)], .09, j % 2 ? 0x3a2a20 : 0x5a4232);
    }
    f.pipe('timber', [x, .9, z - .6], [x, .9, z + 3.3], .07, 0x4a3a2a);
  }
  f.done();
}

/** Fire arrows arcing in over the south wall out of the dusk, each a streak of fire along its arc, one draw: each flies
 *  from beyond the outer town (z -150 to -230, 25-60 m up) toward the village's roofs past the bounds and fades as it
 *  falls; their arcs drawn in the vertex shader. */
function arrows(c: DressContext) {
  const n = 36, r = rand(651), data = new Float32Array(n * 8);
  for (let i = 0; i < n; i++) {
    const sx = (r() - .5) * 160, sz = -150 - r() * 80, ex = (r() < .5 ? -1 : 1) * (46 + r() * 30), ez = -60 + r() * 140;
    data.set([sx, sz, ex, ez, 25 + r() * 35, 2.6 + r() * 2, r(), 30 + r() * 25], i * 8);
  }
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const buffer = new THREE.InstancedInterleavedBuffer(data, 8);
  geometry.setAttribute('aPath', new THREE.InterleavedBufferAttribute(buffer, 4, 0));
  geometry.setAttribute('aFlight', new THREE.InterleavedBufferAttribute(buffer, 4, 4));
  geometry.instanceCount = n;
  const material = new THREE.ShaderMaterial({
    name: 'hidden ash fire arrows', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: c.ambient.time },
    vertexShader: /* glsl */`
      attribute vec4 aPath; attribute vec4 aFlight; uniform float uTime; varying float vAlong; varying float vFade;
      vec3 at( float t ) { vec2 xz = mix( aPath.xy, aPath.zw, t ); float y = mix( aFlight.x, 9.0, t ) + sin( t * 3.14159 ) * aFlight.w; return vec3( xz.x, y, xz.y ); }
      void main() {
        float t = fract( uTime / aFlight.y + aFlight.z );
        float tail = .07;
        float s = clamp( t - tail * ( 1.0 - position.x ), 0.0, 1.0 );
        vec3 p = at( s ), q = at( s + .01 );
        vec4 view = modelViewMatrix * vec4( p, 1.0 );
        vec3 dir = normalize( ( modelViewMatrix * vec4( q, 1.0 ) ).xyz - view.xyz );
        vec3 side = normalize( cross( dir, vec3( 0.0, 0.0, 1.0 ) ) );
        view.xyz += side * position.y * .35;
        vAlong = position.x; vFade = smoothstep( 0.0, .08, t ) * ( 1.0 - smoothstep( .82, 1.0, t ) );
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: /* glsl */`
      varying float vAlong; varying float vFade;
      void main() { gl_FragColor = vec4( vec3( 1.0, .62, .22 ) * ( .3 + 1.9 * vAlong * vAlong ) * vFade, 1.0 ); }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'hidden ash fire arrows'; mesh.frustumCulled = false; mesh.renderOrder = 3;
  c.root.add(mesh);
}

/** places-epic-b: the pillar's body of fire - a sheet 26 m wide at the bowl narrowing up 130 m, turned to the camera about its
 *  axis, its tongues climbing it (one additive draw over the stack of glows, so it reads as one fire and not as beads). */
function flameSheet(x: number, y: number, z: number, time: { value: number }) {
  const material = new THREE.ShaderMaterial({
    name: 'hidden ash pillar flame', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: time },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 centre = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz, toCam = cameraPosition - centre;
        toCam.y = 0.0;
        vec3 side = normalize( vec3( toCam.z, 0.0, -toCam.x ) + vec3( 1e-5 ) );
        gl_Position = projectionMatrix * viewMatrix * vec4( centre + side * position.x + vec3( 0.0, position.y, 0.0 ), 1.0 );
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; varying vec2 vUv;
      float h( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
      float n( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( h( i ), h( i + vec2( 1.0, 0.0 ) ), f.x ), mix( h( i + vec2( 0.0, 1.0 ) ), h( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }
      void main() {
        float x = abs( vUv.x - .5 ) * 2.0, y = vUv.y;
        float t = n( vec2( vUv.x * 6.0, y * 9.0 - uTime * 2.2 ) ) * .6 + n( vec2( vUv.x * 13.0, y * 20.0 - uTime * 3.7 ) ) * .4;
        float width = mix( .6, .1, y ) * ( .7 + .6 * t );
        float body = smoothstep( width, width * .3, x ) * ( 1.0 - smoothstep( .45, 1.0, y ) ) * smoothstep( .0, .05, y );
        vec3 col = mix( vec3( 1.0, .32, .06 ), vec3( 1.0, .86, .52 ), smoothstep( .35, 1.0, body * ( 1.0 - y * .8 ) ) );
        gl_FragColor = vec4( col * body * 1.4, 1.0 );
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(26, 130).translate(0, 65, 0), material);
  mesh.position.set(x, y, z); mesh.name = 'hidden ash pillar flame'; mesh.frustumCulled = false; mesh.renderOrder = 2;
  return mesh;
}
