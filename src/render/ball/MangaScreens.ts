import * as THREE from 'three';

/** The Ink Bowl's big screens: the live match drawn as a manga page. A broadcast camera
 *  over the side line's first rows follows the ball; every few frames it draws the scene into a small target (as three's Reflector
 *  does, from the screen's own onBeforeRender, the screens hidden meanwhile), and each screen's shader inks that picture -
 *  paper where it is light, ink where it is dark and along its edges, screentone in the middle tones, colour kept only
 *  where it is strong (the teams, the burning ball) - cut into three panels: the wide shot, a close-up on the ball and one
 *  on the goal it is heading for. No lettering anywhere. */

const W = 512, H = 288;
/** Milliseconds between redraws: 20 a second on a computer, 10 on a touch screen. */
const EVERY = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 100 : 50;

export interface ScreenSpot {
  /** The screen's centre, metres. */
  centre: THREE.Vector3;
  /** Width and height, metres. */
  width: number; height: number;
  /** The direction the screen faces (toward the pitch). */
  facing: THREE.Vector3;
}

/** What the broadcast camera is told to watch instead of the ball for a while (MangaScreens.focus): a body or a
 *  point, until when (performance.now() / 1000). One for the page: there is one ball match at a time. */
const FOCUS = { target: null as THREE.Object3D | null, point: new THREE.Vector3(), until: 0, lift: 1.5 };

export class MangaScreens {
  /** Aim every screen's broadcast camera at `target` - a body (followed as it moves) or a point - for `seconds`: the wide
   *  panel frames it, the two close-ups crop its middle and its head (a goal's scorer, the podium). `null` lets it go
   *  back to the ball at once. `lift` is how far above the point its middle is (a body's feet are its point). */
  static focus(target: THREE.Object3D | THREE.Vector3 | null, seconds: number, lift = 1.5) {
    if (!target) { FOCUS.target = null; FOCUS.until = 0; return; }
    if ((target as THREE.Object3D).isObject3D) { FOCUS.target = target as THREE.Object3D; } else { FOCUS.target = null; FOCUS.point.copy(target as THREE.Vector3); }
    FOCUS.until = performance.now() / 1000 + Math.max(0, seconds); FOCUS.lift = lift;
  }
  /** Whether a focus is on now (for the checks). */
  static get focused() { return performance.now() / 1000 < FOCUS.until; }

  readonly root = new THREE.Group();
  private readonly target = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 0, generateMipmaps: false });
  private readonly camera = new THREE.PerspectiveCamera(34, W / H, .5, 400);
  private readonly material: THREE.ShaderMaterial;
  private readonly cropBall = new THREE.Vector4(.5, .5, .3, .3);
  private readonly cropGoal = new THREE.Vector4(.5, .5, .5, .5);
  private ball?: THREE.Object3D;
  private last = -Infinity;
  private drawing = false;
  private readonly look = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly lastBall = new THREE.Vector3();
  private readonly heading = new THREE.Vector3();

  constructor(spots: readonly ScreenSpot[], private readonly goalZ: number, time: { value: number }, red: THREE.Color, blue: THREE.Color) {
    this.root.name = 'Ink Bowl screens';
    this.target.texture.name = 'Ink Bowl screens: the broadcast';
    this.camera.position.set(-23, 13, 0);
    this.material = new THREE.ShaderMaterial({
      name: 'Ink Bowl screens', fog: false, toneMapped: false,
      uniforms: {
        uLive: { value: this.target.texture }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) }, uTime: time,
        uCropBall: { value: this.cropBall }, uCropGoal: { value: this.cropGoal }, uRed: { value: red.clone() }, uBlue: { value: blue.clone() },
      },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform sampler2D uLive;uniform vec2 uTexel;uniform float uTime;uniform vec4 uCropBall,uCropGoal;uniform vec3 uRed,uBlue;
        varying vec2 vUv;
        float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
        vec3 tone(vec3 c){return c/(1.+c);}
        // The broadcast inked: paper, ink, screentone, and colour only where it is strong.
        vec3 inked(vec2 uv,float zoom){
          vec3 c=tone(texture2D(uLive,uv).rgb*1.6);
          vec2 t=uTexel*1.2/zoom;
          float l=lum(c);
          float gx=lum(tone(texture2D(uLive,uv+vec2(t.x,0.)).rgb*1.6))-lum(tone(texture2D(uLive,uv-vec2(t.x,0.)).rgb*1.6));
          float gy=lum(tone(texture2D(uLive,uv+vec2(0.,t.y)).rgb*1.6))-lum(tone(texture2D(uLive,uv-vec2(0.,t.y)).rgb*1.6));
          float edge=smoothstep(.06,.16,length(vec2(gx,gy)));
          // Screentone: dots on a 45-degree grid whose size follows the darkness.
          vec2 g=mat2(.7071,-.7071,.7071,.7071)*(vUv*vec2(150.,84.));
          float dots=step(length(fract(g)-.5),sqrt(clamp(1.-l*2.4,0.,1.))*.66);
          vec3 paper=vec3(.96,.93,.86),ink=vec3(.03,.03,.04);
          float shade=l<.14?1.:l<.36?dots:0.;
          vec3 col=mix(paper,ink,max(shade,edge));
          // Spot colour: a strongly coloured pixel keeps its hue (the sides' colours, the ball's fire).
          float sat=(max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b)))/max(max(c.r,max(c.g,c.b)),1e-3);
          float spot=smoothstep(.45,.7,sat)*smoothstep(.12,.3,l)*(1.-edge);
          return mix(col,normalize(c+1e-3)*1.25,spot*.85);
        }
        float box(vec2 p,vec4 r){vec2 q=step(r.xy,p)*step(p,r.zw);return q.x*q.y;}
        void main(){
          vec2 p=vUv;
          // The page: a wide panel on the left, two stacked on the right, white gutters, ink borders.
          vec4 A=vec4(.025,.05,.6,.95),B=vec4(.625,.52,.975,.95),C=vec4(.625,.05,.975,.48);
          vec3 col=vec3(.97,.95,.9);
          float inA=box(p,A),inB=box(p,B),inC=box(p,C);
          if(inA>0.){vec2 u=(p-A.xy)/(A.zw-A.xy);col=inked(u,1.);}
          else if(inB>0.){vec2 u=(p-B.xy)/(B.zw-B.xy);col=inked(uCropBall.xy+(u-.5)*uCropBall.zw,1./uCropBall.z);
            // Speed lines round the close-up on the ball.
            vec2 d=u-.5;float ang=atan(d.y,d.x);float ray=step(.82,fract(sin(floor(ang*38.)*91.7)*437.1))*smoothstep(.22,.5,length(d));
            col=mix(col,vec3(.03),ray*.8);}
          else if(inC>0.){vec2 u=(p-C.xy)/(C.zw-C.xy);col=inked(uCropGoal.xy+(u-.5)*uCropGoal.zw,1./uCropGoal.z);}
          // The panels' ink borders.
          float border=0.;
          for(int i=0;i<3;i++){vec4 r=i==0?A:i==1?B:C;vec2 q=min(p-r.xy,r.zw-p);float inside=box(p,r+vec4(-.006,-.01,.006,.01));
            border=max(border,inside*(1.-step(.004,min(q.x*1.78,q.y))));}
          col=mix(col,vec3(.02),border);
          // A thin frame of each side's colour along the bottom, and the screen's own light.
          col=mix(col,mix(uRed,uBlue,step(.5,p.x)),step(p.y,.018));
          gl_FragColor=vec4(col*1.08,1.);
        }`,
    });
    const quad = new THREE.PlaneGeometry(1, 1);
    for (const spot of spots) {
      const mesh = new THREE.Mesh(quad, this.material);
      mesh.name = 'Ink Bowl screen';
      mesh.scale.set(spot.width, spot.height, 1);
      mesh.position.copy(spot.centre);
      mesh.lookAt(this.tmp.copy(spot.centre).add(spot.facing));
      mesh.onBeforeRender = renderer => this.draw(renderer, mesh.parent);
      this.root.add(mesh);
      // The frame round it: an ink border a little larger, behind.
      const back = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ color: 0x050506, name: 'Ink Bowl screen frame' }));
      back.scale.set(spot.width + 1.4, spot.height + 1.4, 1);
      back.position.copy(spot.centre).addScaledVector(spot.facing, -.15);
      back.lookAt(this.tmp.copy(back.position).add(spot.facing));
      this.root.add(back);
    }
  }

  /** The broadcast camera on the side line, eased toward the ball; the crops follow it. */
  private aim(scene: THREE.Object3D) {
    if (MangaScreens.focused) { this.aimFocus(); return; }
    if (!this.ball) {
      let root: THREE.Object3D = scene;
      while (root.parent) root = root.parent;
      this.ball = root.getObjectByName('Ball') ?? undefined;
    }
    const ball = this.ball ? this.ball.getWorldPosition(this.tmp) : this.tmp.set(0, 0, 0);
    if (!Number.isFinite(ball.x)) ball.set(0, 0, 0);
    this.heading.subVectors(ball, this.lastBall).setY(0);
    this.lastBall.copy(ball);
    this.lookAt.lerp(ball, .25);
    this.eye.set(-23, 13, THREE.MathUtils.clamp(ball.z * .8, -20, 20));
    this.camera.position.lerp(this.eye, .2);
    this.look.copy(this.lookAt);
    this.camera.lookAt(this.look);
    this.camera.updateMatrixWorld();
    // The close-up on the ball, and the goal it is heading for (the nearer one when it is still).
    const p = this.tmp.copy(ball).project(this.camera);
    this.cropBall.x = THREE.MathUtils.clamp(p.x * .5 + .5, .2, .8);
    this.cropBall.y = THREE.MathUtils.clamp(p.y * .5 + .5, .2, .8);
    const toward = Math.abs(this.heading.z) > .02 ? Math.sign(this.heading.z) : Math.sign(ball.z || 1);
    const goal = this.tmp.set(0, 2, toward * this.goalZ).project(this.camera);
    this.cropGoal.z = this.cropGoal.w = .5;
    this.cropGoal.x = THREE.MathUtils.clamp(goal.x * .5 + .5, .25, .75);
    this.cropGoal.y = THREE.MathUtils.clamp(goal.y * .5 + .5, .25, .75);
  }

  /** The focus's framing: the camera in close on the subject from the broadcast side, the ball's panel on its middle and
   *  the goal's on its head. */
  private aimFocus() {
    const at = FOCUS.target ? FOCUS.target.getWorldPosition(this.tmp) : this.tmp.copy(FOCUS.point);
    const mid = this.look.set(at.x, at.y + FOCUS.lift, at.z);
    this.eye.set(at.x - 8.5, at.y + 3.2, at.z + 2.5);
    this.camera.position.lerp(this.eye, .35);
    this.lookAt.lerp(mid, .4);
    this.camera.lookAt(this.lookAt);
    this.camera.updateMatrixWorld();
    const p = this.tmp.copy(mid).project(this.camera);
    this.cropBall.x = THREE.MathUtils.clamp(p.x * .5 + .5, .2, .8); this.cropBall.y = THREE.MathUtils.clamp(p.y * .5 + .5, .2, .8);
    const head = this.tmp.set(at.x, at.y + FOCUS.lift + .55, at.z);
    if (FOCUS.target) FOCUS.target.getWorldPosition(head).add(this.heading.set(0, FOCUS.lift + .55, 0));
    head.project(this.camera);
    this.cropGoal.x = THREE.MathUtils.clamp(head.x * .5 + .5, .15, .85); this.cropGoal.y = THREE.MathUtils.clamp(head.y * .5 + .5, .15, .85);
    this.cropGoal.z = this.cropGoal.w = .24;
    this.lastBall.copy(at);
  }

  private draw(renderer: THREE.WebGLRenderer, parent: THREE.Object3D | null) {
    if (this.drawing || !parent) return;
    // One redraw every so often, from whichever screen is drawn first.
    const now = performance.now();
    if (now - this.last < EVERY) return;
    this.last = now;
    let scene: THREE.Object3D = parent;
    while (scene.parent) scene = scene.parent;
    if (!(scene as THREE.Scene).isScene) return;
    this.drawing = true;
    const target = renderer.getRenderTarget(), shadows = renderer.shadowMap.autoUpdate, xr = renderer.xr.enabled;
    this.root.visible = false;
    try {
      this.aim(scene);
      renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(this.target);
      renderer.state.buffers.depth.setMask(true);
      if (renderer.autoClear === false) renderer.clear();
      renderer.render(scene as THREE.Scene, this.camera);
    } finally {
      renderer.xr.enabled = xr; renderer.shadowMap.autoUpdate = shadows;
      renderer.setRenderTarget(target);
      this.root.visible = true;
      this.drawing = false;
    }
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); if (m.material !== this.material) (m.material as THREE.Material).dispose(); } });
  }
}
