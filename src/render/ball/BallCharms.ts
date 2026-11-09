import * as THREE from 'three';
import type {PlayerState} from '../../game/types';
import {BALL_TEAM_COLOURS, CHARM_COLOURS, GOAL_RULES, RUMBLE, SPIKE_RULES, charmName, type BallCharm, type BallTeam, type BallView, type CharmKind} from '../../game/ball/model';

/** How many charms can lie on the field at once (a little over RUMBLE.most, for one being taken as the next appears). */
const POOL = 4;
/** The gem's height over the floor, and how far it bobs. */
const FLOAT = 1.15, BOB = .18;

interface Slot { group: THREE.Group; gem: THREE.Mesh; shell: THREE.Mesh; tag: THREE.Sprite; ring: THREE.Mesh; pillar: THREE.Mesh; id: number; kind: CharmKind | null; born: number }

/** A charm's name in the game's ink, on a torn black slip, for the tag over its gem. */
function tagTexture(text: string, colour: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#0b0c0e';
  g.beginPath(); g.moveTo(24, 14); g.lineTo(500, 8); g.lineTo(488, 116); g.lineTo(12, 120); g.closePath(); g.fill();
  g.fillStyle = `#${colour.toString(16).padStart(6, '0')}`; g.fillRect(12, 104, 488, 10);
  g.font = 'italic 900 70px Impact, "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#fff'; g.fillText(text, 256, 60, 460);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A soft vertical glow: bright at the floor, gone at the top (the charm's light pillar). Built from numbers, so a page
 *  without a canvas (the tests) can build it too. */
function pillarTexture(): THREE.DataTexture {
  const h = 64, data = new Uint8Array(h * 4);
  for (let i = 0; i < h; i++) { const u = i / (h - 1), a = u < .35 ? .9 - u / .35 * .55 : .35 * (1 - (u - .35) / .65); data.set([255, 255, 255, Math.round(a * 255)], i * 4); }
  const texture = new THREE.DataTexture(data, 1, h); texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true;
  return texture;
}

/**
 * RUMBLE on the field (game/ball/model.ts RUMBLE): each charm lying there as a spinning gem in its colour with an ink
 * outline, its name on a slip over it, a light pillar and a ring on the floor; an IRON WALL as a barrier over the goal
 * it seals; a SAFETY NET as a glowing net laid over the court it guards; SPIRIT HOOK as a tether from its holder to
 * the ball while it pulls.
 */
export class BallCharms {
  readonly root = new THREE.Group();
  private readonly slots: Slot[] = [];
  private readonly tags = new Map<string, THREE.CanvasTexture>();
  private readonly gemGeometry = new THREE.OctahedronGeometry(.56, 0);
  private readonly ringGeometry = new THREE.RingGeometry(1.05, 1.32, 40);
  private readonly pillarGeometry = new THREE.CylinderGeometry(.55, .75, 5, 20, 1, true);
  private readonly pillarMap = pillarTexture();
  private readonly outline = new THREE.MeshBasicMaterial({color: 0x050506, side: THREE.BackSide, name: 'Charm ink outline'});
  private readonly barrier: THREE.Mesh; private readonly barrierMaterial: THREE.ShaderMaterial;
  private readonly net: THREE.Mesh; private readonly netMaterial: THREE.ShaderMaterial;
  private readonly tether: THREE.Line; private readonly tetherPoints = new Float32Array(3 * 12);
  private readonly time = {value: 0};
  /** FREE PLAY's target: a gold ring with a bullseye, on the goal's mouth or the far court's floor. */
  private readonly target = new THREE.Group();
  private readonly targetSpin: THREE.Mesh;

  constructor() {
    this.root.name = 'Ball modes · RUMBLE charms';
    for (let i = 0; i < POOL; i++) {
      const group = new THREE.Group(); group.visible = false;
      const gem = new THREE.Mesh(this.gemGeometry, new THREE.MeshBasicMaterial({color: 0xffffff, name: 'Charm gem'}));
      const shell = new THREE.Mesh(this.gemGeometry, this.outline); shell.scale.setScalar(1.16);
      gem.add(shell);
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({depthWrite: false, transparent: true, name: 'Charm tag'}));
      tag.scale.set(1.9, .48, 1); tag.position.y = FLOAT + .95; tag.renderOrder = 3;
      const ring = new THREE.Mesh(this.ringGeometry, new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide, name: 'Charm ring'}));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .05;
      const pillar = new THREE.Mesh(this.pillarGeometry, new THREE.MeshBasicMaterial({color: 0xffffff, map: this.pillarMap, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, name: 'Charm pillar'}));
      pillar.position.y = 2.5;
      group.add(gem, tag, ring, pillar);
      this.root.add(group);
      this.slots.push({group, gem, shell, tag, ring, pillar, id: -1, kind: null, born: 0});
    }
    // The IRON WALL: stripes of light marching up a pane over the goal mouth.
    this.barrierMaterial = new THREE.ShaderMaterial({
      name: 'Iron wall', transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: {uTime: this.time, uColour: {value: new THREE.Color(1, 1, 1)}, uFade: {value: 0}},
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float uTime;uniform vec3 uColour;uniform float uFade;varying vec2 vUv;
        void main(){vec2 c=vUv*vec2(9.,4.5);vec2 h=abs(fract(c+vec2(step(1.,mod(floor(c.y),2.))*.5,0.))-.5);
          float hex=smoothstep(.42,.48,max(h.x,h.y));float band=.5+.5*sin(vUv.y*18.-uTime*6.);
          float edge=max(smoothstep(.9,1.,abs(vUv.x*2.-1.)),smoothstep(.92,1.,vUv.y));
          float a=(hex*.55+band*.18+edge*.8)*uFade;gl_FragColor=vec4(uColour*a,a);}`,
    });
    this.barrier = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_RULES.goalHalfWidth * 2, GOAL_RULES.goalHeight), this.barrierMaterial);
    this.barrier.visible = false; this.barrier.renderOrder = 2;
    // The SAFETY NET: a glowing mesh over the court it guards, warm white (a court is red or blue itself) edged in the side's colour.
    this.netMaterial = new THREE.ShaderMaterial({
      name: 'Safety net', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {uTime: this.time, uColour: {value: new THREE.Color(1, 1, 1)}, uFade: {value: 0}},
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float uTime;uniform vec3 uColour;uniform float uFade;varying vec2 vUv;
        void main(){vec2 g=abs(fract(vUv*vec2(10.,7.))-.5);float line=smoothstep(.44,.5,max(g.x,g.y));
          float pulse=.55+.45*sin(uTime*4.-length(vUv-.5)*12.);float edge=smoothstep(.45,.5,max(abs(vUv.x-.5),abs(vUv.y-.5)));
          vec3 col=mix(vec3(1.,.96,.84),uColour,.3+.4*edge);float a=(line*.75*pulse+edge*.9)*uFade;gl_FragColor=vec4(col*a,a);}`,
    });
    this.net = new THREE.Mesh(new THREE.PlaneGeometry(SPIKE_RULES.courtHalfX * 2, SPIKE_RULES.courtHalfZ), this.netMaterial);
    this.net.rotation.x = -Math.PI / 2; this.net.visible = false; this.net.renderOrder = 1;
    // SPIRIT HOOK's tether.
    const line = new THREE.BufferGeometry(); line.setAttribute('position', new THREE.BufferAttribute(this.tetherPoints, 3));
    this.tether = new THREE.Line(line, new THREE.LineBasicMaterial({color: CHARM_COLOURS.magnet, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false, name: 'Spirit hook'}));
    this.tether.visible = false; this.tether.frustumCulled = false;
    this.root.add(this.barrier, this.net, this.tether);
    const gold = (opacity: number) => new THREE.MeshBasicMaterial({color: 0xffc54a, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, name: 'Target'});
    const ring = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 56), gold(.95));
    this.targetSpin = new THREE.Mesh(new THREE.RingGeometry(.32, .46, 40, 1, 0, Math.PI * 1.6), gold(.9));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(.8, 48), gold(.12));
    this.target.add(ring, this.targetSpin, disc); this.target.visible = false; this.target.renderOrder = 3;
    this.root.add(this.target);
  }

  /** Every frame of a ball match. `ball` is where the ball is drawn; `serverTime` the presented frame's clock. */
  update(view: BallView, players: readonly PlayerState[], ball: THREE.Vector3 | null, dt: number, serverTime: number) {
    this.root.visible = view.rumble || !!view.aim;
    this.time.value += dt;
    const t = this.time.value;
    // FREE PLAY's target, facing the pitch from the goal's mouth or lying on the floor.
    const aim = view.aim;
    this.target.visible = !!aim && view.phase === 'live';
    if (aim) {
      this.target.position.set(aim.x, aim.floor ? .05 : aim.y, aim.floor ? aim.z : aim.z - Math.sign(aim.z) * .1);
      this.target.rotation.set(aim.floor ? -Math.PI / 2 : 0, aim.floor ? 0 : aim.z > 0 ? Math.PI : 0, 0);
      this.target.scale.setScalar(aim.r * (1 + .05 * Math.sin(t * 5)));
      this.targetSpin.rotation.z = t * 2.4;
    }
    for (const slot of this.slots) slot.group.visible &&= view.rumble;
    this.barrier.visible &&= view.rumble; this.net.visible &&= view.rumble; this.tether.visible &&= view.rumble;
    if (!view.rumble) return;
    // The charms lying on the field, each kept in the slot it first took.
    for (const slot of this.slots) if (slot.id >= 0 && !view.charms.some(c => c.id === slot.id)) { slot.id = -1; slot.group.visible = false; }
    for (const c of view.charms) {
      let slot = this.slots.find(s => s.id === c.id);
      if (!slot) { slot = this.slots.find(s => s.id < 0); if (!slot) continue; this.dress(slot, c, view); }
      const age = t - slot.born, grow = Math.min(1, age / .35), left = c.until - serverTime, blink = left < 3 ? (Math.sin(t * 18) > 0 ? 1 : .35) : 1;
      slot.group.visible = true; slot.group.position.set(c.x, 0, c.z);
      slot.gem.position.y = FLOAT + Math.sin(t * 2.6 + c.id) * BOB; slot.gem.rotation.y = t * 2.2; slot.gem.rotation.x = Math.sin(t * 1.3 + c.id) * .3;
      slot.gem.scale.setScalar((.6 + .4 * grow) * (1 + .08 * Math.sin(t * 7)));
      (slot.ring.material as THREE.MeshBasicMaterial).opacity = (.5 + .35 * Math.sin(t * 5)) * blink;
      slot.ring.scale.setScalar(grow * (1 + .06 * Math.sin(t * 5)));
      (slot.pillar.material as THREE.MeshBasicMaterial).opacity = .45 * grow * blink;
      (slot.tag.material as THREE.SpriteMaterial).opacity = grow * blink;
    }
    // IRON WALL over the sealed goal.
    const wall = view.ball.wall, wallFade = this.barrierMaterial.uniforms.uFade;
    wallFade.value += ((wall ? 1 : 0) - wallFade.value) * Math.min(1, dt * 8);
    this.barrier.visible = wallFade.value > .01 && view.mode === 'goal-rush';
    if (wall) { const sz = wall === 'red' ? -1 : 1; this.barrier.position.set(0, GOAL_RULES.goalHeight / 2, sz * (GOAL_RULES.halfZ + .05)); (this.barrierMaterial.uniforms.uColour.value as THREE.Color).setHex(BALL_TEAM_COLOURS[wall]); }
    // SAFETY NET over the court it guards.
    const guarded: BallTeam | undefined = view.mode === 'sky-spike' ? view.effects.find(e => e.kind === 'wall')?.team : undefined, netFade = this.netMaterial.uniforms.uFade;
    netFade.value += ((guarded ? 1 : 0) - netFade.value) * Math.min(1, dt * 8);
    this.net.visible = netFade.value > .01;
    if (guarded) { const sz = guarded === 'red' ? -1 : 1; this.net.position.set(0, .04, sz * SPIKE_RULES.courtHalfZ / 2); (this.netMaterial.uniforms.uColour.value as THREE.Color).setHex(BALL_TEAM_COLOURS[guarded]); }
    // SPIRIT HOOK: a wavering line from its holder to the ball while the ball is in its reach.
    const hook = view.effects.find(e => e.kind === 'magnet'), holder = hook && players.find(p => p.id === hook.id);
    const reach = holder && ball ? Math.hypot(holder.x - ball.x, holder.y + 1 - ball.y, holder.z - ball.z) : Infinity;
    this.tether.visible = !!holder && !!ball && reach < RUMBLE.magnetRange && !view.ball.held;
    if (this.tether.visible && holder && ball) {
      const p = this.tetherPoints, n = p.length / 3;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), wave = Math.sin(u * Math.PI) * .35 * Math.sin(t * 14 + u * 9);
        p[i * 3] = holder.x + (ball.x - holder.x) * u + wave; p[i * 3 + 1] = holder.y + 1.1 + (ball.y - holder.y - 1.1) * u + wave * .6; p[i * 3 + 2] = holder.z + (ball.z - holder.z) * u;
      }
      (this.tether.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  private dress(slot: Slot, c: BallCharm, view: BallView) {
    slot.id = c.id; slot.kind = c.kind; slot.born = this.time.value;
    const colour = CHARM_COLOURS[c.kind];
    (slot.gem.material as THREE.MeshBasicMaterial).color.setHex(colour);
    (slot.ring.material as THREE.MeshBasicMaterial).color.setHex(colour);
    (slot.pillar.material as THREE.MeshBasicMaterial).color.setHex(colour);
    const name = charmName(c.kind, view.mode);
    let tag = this.tags.get(name);
    if (!tag) { tag = tagTexture(name, colour); this.tags.set(name, tag); }
    const material = slot.tag.material as THREE.SpriteMaterial; material.map = tag; material.needsUpdate = true;
  }

  clear() { this.target.visible = false; for (const slot of this.slots) { slot.id = -1; slot.group.visible = false; } this.barrier.visible = this.net.visible = this.tether.visible = false; this.barrierMaterial.uniforms.uFade.value = this.netMaterial.uniforms.uFade.value = 0; }

  dispose() {
    this.clear(); this.root.removeFromParent();
    for (const slot of this.slots) for (const mesh of [slot.gem, slot.ring, slot.pillar]) (mesh.material as THREE.Material).dispose();
    for (const slot of this.slots) (slot.tag.material as THREE.Material).dispose();
    for (const tag of this.tags.values()) tag.dispose();
    this.gemGeometry.dispose(); this.ringGeometry.dispose(); this.pillarGeometry.dispose(); this.pillarMap.dispose(); this.outline.dispose();
    this.barrier.geometry.dispose(); this.barrierMaterial.dispose(); this.net.geometry.dispose(); this.netMaterial.dispose();
    this.target.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    this.tether.geometry.dispose(); (this.tether.material as THREE.Material).dispose();
  }
}
