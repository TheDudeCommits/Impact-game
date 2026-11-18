import * as THREE from 'three';
import { siteUrl } from '../loading/siteBase';
import { DREAM_IMPACT } from './dreamFlag';
import { VfxKit } from './vfx/VfxKit';
import { originalLiquid } from '../originals/grounds';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import type { Settings } from '../config';
import { STAGES, type StageDefinition, type StageId } from '../game/stages';
import { previewStage } from './look/preview';
import { lookFor, type LookPreset } from './look/stageLooks';
import { animeFinishOn, setAnimeFinish } from './look/powerupLook';
import { focusUniforms, LookBloomPass, LookFinalPass } from './look/LookPost';
import { SkyDome } from './look/SkyDome';
import { Atmosphere } from './look/Atmosphere';
import { StageLife } from './look/StageLife';
import { frameUniforms, INK_WEIGHT, inkUniforms, setToonLook, setToonResolution } from './look/toonShading';
import { setCloudTime, setCookieLook } from './look/lightCookie';
import { setAlbedoLook, setRoomDim, windowGlow } from './look/stageMaterials';
import { liftFightersUnderGrade } from './look/gradeReadability';
import { ResolutionGovernor } from './ResolutionGovernor';
import {phoneSharpness,powerBudget} from './powerBudget';
import { gpuName } from './qualityTier';
import { recallSettled, rememberSettled, settledKey, SettleWatch } from './resolutionMemory';
import { abOff, onAbChange, setAbOff, type AbName } from './look/abSwitch';
import { setSceneRatio } from './look/sceneBuffer';
import { UPSCALE } from './look/upscale';
import {FramePolicy} from './framePolicy';
import {EffectsLadder,LONGEST_WAIT_S,cutBudget,ladderFor,reallocates,type LadderBudget} from './mobileLadder';
import {handheld} from '../input/device';
import {materialTextures,nextTask,showCasters,warmTextures} from './textureWarmup';
import { compileShadowPrograms, introspectProgramsInSlices, programsLinked } from './programWarmup';
import {setTextureCap,textureCapFor} from './textureCap';
import {setLiveQuality} from './liveQuality';
import { installSkinnedBounds } from './skinnedBounds';
import { drawingFrame, installSkeletonOnce, skeletonOnce } from './skeletonOnce';
import { setDrawingHalf, setSecondLens } from './lenses';
import { skipHiddenChildren } from './hiddenMatrices';
import { EmptyInstances } from './emptyInstances';
import { VFX } from './vfxLevel';
import { glRect, halves, type Rect } from '../couch/split';
import { ContextGuard } from './contextGuard';
import { FILM, FILM_SPARK, FILM_IMPACT, LOOK, filmLookFor, filmEnvLook, filmOn, filmUniforms, onFilmLook, setFilmLook } from './look/filmLook';
import { PaintedFarView } from './look/filmFarView';
import { PaintedFreeze } from './look/filmFreeze';
import { PaintedScenePass, PAINT, type PaintTier } from './look/filmPaint';
import { holdDrawings } from './look/filmDrawings';
import { effekseerRedraw } from './vfx/armory/effekseer';

// Every three loader made without a manager of its own (models, textures, files) asks for a root /assets/ address inside the
// page's own folder: a build served under a folder of its own (Player Two's) answers a root address with a redirect on every
// request (loading/siteBase.ts). At a site's root, nothing changes.
THREE.DefaultLoadingManager.setURLModifier(url => siteUrl(url));

/** How far the sun's shadow box reaches from the fight, per quality: tight
 *  enough for crisp, stable texels, wide enough for a lock-on shot. */
const SHADOW_HALF = { high: 18, medium: 18, low: 15 } as const;
/** The ball modes' box: one that holds the whole pitch or court and stands still on its middle, so no
 *  fighter at the far end plays without a shadow and no edge crawls as the play moves (the pitch is 26 x 38 m, the
 *  court's floor 30 x 37: 23 m to a corner). A texel of 2.3 cm on High where the fight's box has 1.8. */
const BALL_SHADOW_HALF = { high: 24, medium: 24, low: 19 } as const;
/** The split screen's shared shadow (GameRenderer sharedShadow): the box and the map this much wider - 2048 texels to
 *  2688, 1024 to 1344, 512 to 672, the texel the same - so it holds two of the sun's own boxes whose centres are within
 *  SHARE_REACH of the box's side of each other on both of its axes (a little rounding kept back: 11.1 m on High). It
 *  takes them a little closer than it lets them go (SHARE_TAKE: 10.4 m), so two people at about that distance don't
 *  switch it back and forth. */
const SHARE_GROW = 1.3125, SHARE_REACH = .3125 * .99, SHARE_TAKE = .93;
/** Dev (the probe's `tune`): the split screen drawn the old way, part by part - a shadow pass for each half, the second
 *  half's matrix pass, the window's size read three times a frame - to cost what each saves on the same frames. */
const SPLIT_LEGACY = { shadow: false, matrices: false, sizes: false };
const MSAA = { high: 4, medium: 2, low: 0 } as const;
/** The ball modes' screen punch: seconds it takes to settle back (GameRenderer.screenPunch). */
const ZOOM_BACK = .22;
/** A body the impact blur keeps sharp: its drawn centre (the pelvis, wherever a launch has taken it) and size. */
export type BlurKeep={visualCenter(out:THREE.Vector3):THREE.Vector3;state?:{size?:number}};

/** A couch's split screen, as GameRenderer draws it (setSplit). */
export interface SplitView{screen:'split-v'|'split-h';second:THREE.PerspectiveCamera;before:(half:0|1)=>void;focus:(half:0|1)=>{x:number;y:number;z:number}|undefined}

/** What the film look paints (look/filmPaint.ts): the scene's top-level things that are the set - a stage (the Duels' and
 *  the royales' `Stage:`, the harbour's, Last Stand's Ashwood, Bad Blood's Citadel, Rift War's Torn Plain), the sky and its
 *  far paintings, the stage's life, the marks left on the ground, an ultimate's own backdrop - while the bodies, the hordes,
 *  Rift War's armies and towers and every effect are drawn crisp over the painting. (The ball modes' arenas are not
 *  painted: their lines are the game's rules - see render, `centred`.) */
const _skyCheck=new THREE.Color();
const paintedSet=(o:THREE.Object3D)=>{
  const n=o.name;
  return n.startsWith('Stage:')||n==='look-sky'||n==='look-stage-life'||n==='film-far-view'||n==='vfx-ground-marks'||n==='gore-stains'
    ||n.endsWith('Environment')||n==='Rift War · The Torn Plain'||n==='Ashwood · Gate District'||n.startsWith('Bad Blood · ')
    ||/^(mirror-mere|planetarium)-(backdrop|sea|shell|floor)$/.test(n);
};
export class GameRenderer {
  readonly scene=new THREE.Scene();
  /** The frame's draw leaves out the instanced meshes with nothing to draw: the effects' empty pools (emptyInstances.ts). */
  readonly emptyInstances=new EmptyInstances(this.scene);
  readonly camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.08,340);
  readonly renderer:THREE.WebGLRenderer;
  readonly composer:EffectComposer;
  readonly bloomPass:LookBloomPass;
  readonly finalPass:LookFinalPass;
  readonly hemi:THREE.HemisphereLight;
  readonly sun:THREE.DirectionalLight;
  readonly fill:THREE.DirectionalLight;
  readonly sky:SkyDome;
  readonly atmosphere:Atmosphere;
  /** The place's living air: dust in the sun, light shafts, moving clouds (look/StageLife.ts). */
  readonly life:StageLife;
  readonly frameTimes:number[]=[];
  /** The look the current stage is drawn with. */
  look:LookPreset=lookFor('harbor');
  /** The film look's far view (look/filmFarView.ts): painted ranges and cloud towers round the horizon. */
  readonly farView:PaintedFarView;
  /** The film look's painted freeze on a knockout (look/filmFreeze.ts): its painting, the seconds until it
   *  is taken (-1 none) and the blow it creeps in on (uv). */
  private readonly freeze=new PaintedFreeze();private freezeIn=-1;private readonly freezeFocus=new THREE.Vector2(.5,.5);
  /** The scene's draw (look/filmPaint.ts): three's RenderPass, with the film look's painted set. */
  private readonly scenePass:PaintedScenePass;
  stage:StageId='harbor';
  /** Draws below the quality's pixel ratio while the GPU is over its budget (see ResolutionGovernor). */
  readonly governor:ResolutionGovernor;
  /** The rate the fight is drawn at (framePolicy.ts: POWER USE, and a phone's step from sixty to thirty). */
  readonly frames=new FramePolicy();
  /** A phone or a tablet (input/device.ts), read once: the quality watch also steps for a CPU that cannot keep up. */
  private readonly handheld=handheld();
  /** When this animation frame began (requestAnimationFrame's time): the frame's main-thread time is measured from it. */
  private frameBegin=NaN;
  /** The WebGL context, lost and given back (contextGuard.ts): compiles wait for it, uploads skip a lost one. */
  readonly context:ContextGuard;
  /** The WebGL context is lost and not yet given back (see the constructor). */
  get contextLost(){return this.context.lost;}
  /** Keeps the resolution where it is: a clip is being recorded from the canvas. */
  holdResolution=false;
  private pixelCap=1;
  private hordeWorkload=false;
  private budgetKey='';
  private budgetStrong=false;
  /** The adaptive ladder's calm moments (mobileLadder.ts): no fight live on screen - a countdown, the results, a menu, the home - when a
   *  phone's or a tablet's step that reallocates a target (a pixel ratio, MSAA, the shadow map's size) is taken; main.ts
   *  sets it every frame. A step kept waiting LONGEST_WAIT_S is taken anyway. */
  calm=true;
  /** The ladder's tier applied now, and the preset budget it was cut from (handheld only). */
  private appliedTier=0;
  private ladderBudget?:LadderBudget;
  private waitingSince=-1;
  /** The sun's shadow drawn every `shadowEvery` frames (the ladder's shadowRate: 2), and the frames drawn. */
  private shadowEvery:1|2=1;
  private shadowFrame=0;
  /** The ladder's tier now, for measuring tools. Undefined on a desktop. */
  get mobileTier(){return this.governor.ladder?{tier:this.appliedTier,max:this.governor.ladder.max,wanted:this.governor.ladder.tier}:undefined;}
  setHordeWorkload(horde:boolean){if(this.hordeWorkload===horde)return;this.hordeWorkload=horde;this.applySettings(this.settings);}
  private readonly pmrem:THREE.PMREMGenerator;
  private environment?:THREE.WebGLRenderTarget;
  private time=0;
  /** `gentle`: the second try, when the first context could not be made (boot/webglFailure.ts, 2 November 2026: 59
   *  "Error creating WebGL context" on the live log) - no high-performance GPU asked for, which a laptop's switch to its
   *  discrete GPU or a blocklisted driver can refuse. */
  constructor(parent:HTMLElement,private settings:Settings,gentle=false){
    // No MSAA on the canvas: every frame is drawn into the composer's own
    // multisampled target and only a full-screen triangle reaches the canvas,
    // so a multisampled default framebuffer would be memory and a resolve
    // spent on nothing. The old setup asked for it and got no anti-aliasing
    // at all, because the composer's targets had no samples.
    this.renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:gentle?'default':'high-performance',alpha:false});
    {const gl=this.renderer.getContext();this.context=new ContextGuard(this.renderer.domElement,()=>gl.isContextLost());this.context.guard(this.renderer);}
    this.governor=new ResolutionGovernor(this.renderer.getContext() as WebGL2RenderingContext);
    // A phone's or a tablet's effects step down after its resolution (mobileLadder.ts); a desktop has none.
    if(this.handheld){this.governor.ladder=new EffectsLadder();this.installMobileDebug();}
    installSkinnedBounds();installSkeletonOnce();
    // The frame's matrix pass leaves what hangs hidden straight off the scene alone: the effect modules' pooled meshes, the
    // dash afterimages, a mode's furniture while another mode plays (hiddenMatrices.ts; a fighter's body is passed always).
    skipHiddenChildren(this.scene);
    // The feel pass: the hand-drawn impact flipbooks (vfx/inkImpactAtlas.ts), fetched by the game's own renderer.
    // (The ink impacts' flipbooks are fetched by main.ts once the home is up, and every room's load waits for them.)
    this.renderer.domElement.id='game-canvas';this.renderer.domElement.tabIndex=0;this.renderer.domElement.setAttribute('aria-label','Three-dimensional fighting arena');parent.append(this.renderer.domElement);
    // A lost context (iOS Safari loses it under memory pressure and in the background; a GPU reset anywhere). three
    // keeps the page alive through it - it prevents the default, so the browser may give the context back - and on
    // restore rebuilds its own state, uploading every geometry, texture and program again from what the CPU still
    // holds. Not what was drawn once and kept only on the GPU: the stage's environment light (black without it) and
    // the governor's timer queries, rebuilt here; the Effekseer runtime rebuilds its own (armory/effekseer.ts). These
    // listeners run after three's. A context that does not come back reloads the page (main.ts, boot/pageLife.ts).
    // The frame's start, for its main-thread time (render): this callback is asked for before main.ts's frame loop, so it
    // runs first in every animation frame, and its time is the frame's own (the display's), whatever ran before it.
    const begin=(time:number)=>{this.frameBegin=time;requestAnimationFrame(begin);};
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(begin);
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>{this.governor.restored();this.refreshEnvironment();});
    // Tone mapping and the sRGB encode both happen in the final pass, after
    // bloom and before the grade; the renderer itself only ever draws linear
    // HDR into targets.
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.NoToneMapping;
    this.renderer.debug.checkShaderErrors=!!import.meta.env?.DEV;
    this.renderer.info.autoReset=false;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.scene.background=new THREE.Color(0x7facce);this.scene.fog=new THREE.Fog(0x7facce,90,400);
    // Three lights, for the life of the renderer: the count is part of every
    // program's cache key, so a stage changes their colour, strength and
    // direction and never their number.
    this.hemi=new THREE.HemisphereLight(0xd7eaff,0x324c70,.85);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight(0xfff0d6,2.7);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.bias=-.0002;this.sun.shadow.normalBias=.025;this.sun.shadow.radius=1.4;this.scene.add(this.sun,this.sun.target);
    this.fill=new THREE.DirectionalLight(0x8bbbff,.3);this.scene.add(this.fill);
    this.sky=new SkyDome(this.scene);
    this.atmosphere=new Atmosphere(this.scene);
    this.life=new StageLife(this.scene,this.sky,this.renderer.domElement);
    this.pmrem=new THREE.PMREMGenerator(this.renderer);
    // The scene's HDR target is R11G11B10 float rather than RGBA16F: the frame
    // needs no alpha, and at four samples a pixel the half-size format is the
    // difference between multisampling being affordable and not.
    // Measured on the M4 at 1.5x: RGBA16F at 4x cost 13.5-14.3 ms of GPU a
    // frame, R11G11B10 at 4x 10.4-11.8 ms, R11G11B10 without MSAA 8.9 ms.
    // Rendering to it needs EXT_color_buffer_float; without that it falls back
    // to the half-float target the composer always used.
    const packed=this.renderer.extensions.has('EXT_color_buffer_float');
    const target=new THREE.WebGLRenderTarget(innerWidth*this.renderer.getPixelRatio(),innerHeight*this.renderer.getPixelRatio(),packed?{type:THREE.UnsignedInt101111Type,format:THREE.RGBFormat,samples:MSAA[settings.quality]}:{type:THREE.HalfFloatType,samples:MSAA[settings.quality]});
    target.texture.name='EffectComposer.rt1';
    // The anime finish reads the scene's depth (its focus, haze and dark near ground): resolved from the multisampled
    // depth into a texture at the end of the scene's draw. The composer's second target (a clone) gets its own, and
    // the scene lands in either as the composer swaps them.
    target.depthTexture=new THREE.DepthTexture(target.width,target.height);
    this.composer=new EffectComposer(this.renderer,target);
    this.composer.renderTarget2.depthTexture??=new THREE.DepthTexture(target.width,target.height);
    // The scene's draw: three's RenderPass, except in the film look, where the set is painted under the bodies and
    // the effects (look/filmPaint.ts).
    this.scenePass=new PaintedScenePass(this.scene,this.camera,paintedSet);this.composer.addPass(this.scenePass);
    this.bloomPass=new LookBloomPass();this.composer.addPass(this.bloomPass);
    this.finalPass=new LookFinalPass();this.finalPass.bloom=this.bloomPass;
    this.finalPass.beforeRender=()=>this.focusFinish();this.composer.addPass(this.finalPass);
    // The film look (look/filmLook.ts): the ART STYLE setting flips it, in play too, and the whole look follows at once.
    this.farView=new PaintedFarView(this.scene);this.finalPass.setFilm(filmOn());this.farView.visible=filmOn();
    onFilmLook(()=>this.restyle());
    this.camera.position.set(3.2,3.6,15);this.camera.lookAt(0,1,-1);
    window.addEventListener('resize',()=>this.resize());this.applySettings(settings);
    // (The look's A/B switches flipped by the probe: the upscale's on or off takes the ratio again.)
    onAbChange(()=>{this.setRatio(this.sceneRatio);this.resize();this.updateInk();});
    this.applyLook(this.look,STAGES.harbor);
    if(import.meta.env?.DEV)this.installProbe();
  }
  /** The painted sky replaced the photographic HDR, so there is nothing to
   *  download; this only renders the image light for the first stage, now
   *  that the renderer can draw. Kept under its old name because main.ts
   *  awaits it in the load. */
  async loadSky(){this.refreshEnvironment();}
  /** Depth range and haze are per stage. Wreckers' Causeway's island runs to 1.6 km
   *  and the Ash Chief cliff stands 440 m behind the Proving arena, so the
   *  harbour's 340 m far plane would cut both off in mid-air. Fog always ends
   *  inside the far plane, so distant geometry fades out instead of popping.
   *  Everything else - light, sky, grade, bloom, air, the fighters' ramp and
   *  rim - comes from the stage's look preset. */
  applyStage(requested:StageDefinition){
    const stage=STAGES[previewStage(requested.id)];
    this.camera.far=stage.cameraFar;this.camera.updateProjectionMatrix();
    this.stage=stage.id;this.farView.setStage(stage);
    this.applyLook(lookFor(stage.id),stage);
    VfxKit.setLiquid(this.scene,originalLiquid(stage.id));
    this.refreshEnvironment();
  }
  private readonly paneGlow=new THREE.Color(0,0,0);
  private readonly keyDir=new THREE.Vector3(0,1,0);
  private readonly shadowRight=new THREE.Vector3(1,0,0);
  private readonly shadowUp=new THREE.Vector3(0,0,1);
  private applyLook(look:LookPreset,stage:StageDefinition){
    this.look=look;
    const fog=this.scene.fog as THREE.Fog;
    fog.near=look.fog.near??stage.fog[0];fog.far=Math.min(look.fog.far??stage.fog[1],stage.cameraFar);fog.color.setHex(look.fog.color);
    this.fogBase.copy(fog.color);
    // The sky draws behind everything; the clear colour only shows for the
    // frame or two before the first stage is up.
    (this.scene.background as THREE.Color).copy(fog.color);
    this.hemi.color.setHex(look.hemi.sky);this.hemi.groundColor.setHex(look.hemi.ground);this.hemi.intensity=look.hemi.intensity;
    this.sun.color.setHex(look.key.color);this.sun.intensity=look.key.intensity;
    this.keyDir.set(...look.key.dir).normalize();
    // The shadow camera looks down the key light with world up, exactly as
    // three will aim it; the snapping below works in that same basis.
    this.shadowRight.crossVectors(THREE.Object3D.DEFAULT_UP,this.keyDir);
    if(this.shadowRight.lengthSq()<1e-6)this.shadowRight.set(1,0,0);
    this.shadowRight.normalize();this.shadowUp.crossVectors(this.keyDir,this.shadowRight).normalize();
    this.fill.color.setHex(look.fill.color);this.fill.intensity=look.fill.intensity;this.fill.position.set(...look.fill.dir).multiplyScalar(40);
    this.scene.environmentIntensity=look.ibl;
    setToonLook(look);setCookieLook(look);setAlbedoLook(look);
    this.paneGlow.setHex(look.key.color).multiplyScalar(look.cookie?look.cookie.glow??2.4:0);
    this.sky.setLook(look,fog.color);
    this.atmosphere.setLook(look);
    this.life.setStage(stage.id,look);
    this.finalPass.setGrade(look);
    const b=this.bloomPass.bloom;b.threshold=look.bloom.threshold;b.knee=look.bloom.knee;b.radius=look.bloom.radius;b.strength=look.bloom.strength;
    this.farView?.setAir(fog.color);
    // (the painted ranges and cloud towers stand round a day's or a dusk's horizon, not a night's)
    if(this.farView){const h=_skyCheck.setHex(look.sky.horizon);this.farView.visible=filmOn()&&.2126*h.r+.7152*h.g+.0722*h.b>.35;}
  }
  /** The film look on or off, on the running stage: its look, the image light from its sky, the film stage and the
   *  far view. Called by the switch (filmLook.ts setFilmLook), and by the probe to draw one held frame both ways. */
  restyle(){
    const on=filmOn();
    this.applyLook(lookFor(this.stage),STAGES[this.stage]);
    this.refreshEnvironment();
    this.finalPass.setFilm(on,this.scenePass.tier==='medium'||this.scenePass.tier==='high');
    if(!on){this.farView.visible=false;this.freeze.cancel();this.freezeIn=-1;}
    this.stepFilm();
  }
  /** The film look's painted freeze (look/filmFreeze.ts): the knockout that ends a round held a second as a
   *  painting, the lens creeping in on `at` (the blow's world point). Taken once the knockout's own impact frame has
   *  passed; the fight runs on underneath. Off in the game's own look, under reduced motion and on a split screen. */
  paintedFreeze(at?:THREE.Vector3){
    if(!filmOn()||this.reducedMotion||this.split||this.freeze.holding||this.freezeIn>=0)return;
    if(at){const p=at.clone().project(this.camera);this.freezeFocus.set(THREE.MathUtils.clamp(p.x*.5+.5,.2,.8),THREE.MathUtils.clamp(p.y*.5+.5,.2,.8));}
    else this.freezeFocus.set(.5,.5);
    this.freezeIn=.09;
  }
  /** After a frame is drawn: the painting taken when its time has come and no impact frame is on screen. */
  private paintAfter(dt:number){
    if(this.freezeIn<0)return;
    if(!filmOn()||this.split){this.freezeIn=-1;return;}
    this.freezeIn-=Math.min(dt,.1);
    if(this.freezeIn>=0)return;
    if(this.impactFrames>0||this.impactHold>0){this.freezeIn=0;return;}
    this.freezeIn=-1;this.freeze.capture(this.renderer,this.time,this.freezeFocus);
  }
  /** The film look's clocks (look/filmLook.ts): the boil's animation step (twelve a second) and the film's (24),
   *  wrapped so the shaders' hashes keep their precision. */
  private stepFilm(){
    const boil=filmUniforms.uReelBoil.value;
    if(!filmOn()){boil.set(0,0,0,0);return;}
    boil.set(.07,Math.floor(this.time*12)%997,.5,0);
    this.finalPass.stepFilm(this.time);
  }
  /** Image-based light for the stage's standard materials, rendered from the
   *  painted sky (sun disc excluded - the key light is the sun). Same size
   *  every time, so swapping it never changes a program. */
  private refreshEnvironment(){
    // The film look takes the set's image light from a cooler sky than the one it shows (filmEnvLook).
    const lit=filmOn()?filmEnvLook(this.look):null,air=(this.scene.fog as THREE.Fog).color;
    if(lit)this.sky.setLook(lit,air);
    this.sky.disc=false;
    const next=this.pmrem.fromScene(this.sky.envScene,0,.1,100,{size:128});
    this.sky.disc=true;
    if(lit)this.sky.setLook(this.look,air);
    this.environment?.dispose();this.environment=next;
    this.scene.environment=next.texture;
  }
  /** Compile every material in the scene for the pass that will actually draw it.
   *
   *  `renderer.compile()` on its own builds each program for whatever is bound
   *  when it is called - and with nothing bound that is the screen, where the
   *  output colour space is sRGB. The game draws through the composer, into a
   *  render target, where it is linear-sRGB, and the colour space is part of the
   *  program's cache key. So every program the warm-up built was the wrong
   *  variant, and the real one was linked the first time each object was drawn:
   *  for a transformation, that is the frame the player pressed for. Binding the
   *  composer's own target first is the whole fix. compile() runs synchronously
   *  inside compileAsync, so the target only has to be bound across that call.
   *  The composer's targets are multisampled on High and Medium; the sample
   *  count is not part of any program's key, so the variants are the same. */
  async compileScene(root:THREE.Object3D=this.scene){
    // Never on a lost context (contextGuard.ts: a compile there threw "shaderSource must be an instance of WebGLShader"):
    // it waits for the context to be given back, and starts again if it is lost before it is done.
    await this.context.whole(async()=>{
      const previous=this.renderer.getRenderTarget();
      // (the target the scene draws into: the composer's read buffer, the same every frame - LookFinalPass does not swap)
      this.renderer.setRenderTarget(this.composer.readBuffer);
      let ready:Promise<unknown>;
      try{ready=this.renderer.compileAsync(root,this.camera,this.scene);this.compileShadows(root);if(root===this.scene)this.compilePost();}
      finally{this.renderer.setRenderTarget(previous);}
      await ready;
      // Without KHR_parallel_shader_compile the programs above are linked behind the page's back, not waited for: a fence
      // behind them is waited for here, beside the page (programWarmup.ts programsLinked), so the questions below find
      // them linked instead of freezing the loading screen until they are.
      await programsLinked(this.renderer);
      if(this.context.lost)return;
      // A texture updated in ranges (three's WebGLTextures.updateTexture) asks for these three before it writes, and three
      // keeps them only once set: asked in a fight's first frame, the question waited for everything queued for the GPU
      // (8.6 s here on software GL). Set to the values they already have (WebGL's defaults), they are kept and never asked.
      const gl=this.renderer.getContext() as WebGL2RenderingContext,state=this.renderer.state;
      if(typeof gl.UNPACK_ROW_LENGTH==='number')for(const name of [gl.UNPACK_ROW_LENGTH,gl.UNPACK_SKIP_PIXELS,gl.UNPACK_SKIP_ROWS])state.pixelStorei(name,0);
      // And every program's interface asked for now, while nothing is queued for the GPU (programWarmup.ts): three asks at a
      // program's first draw, and in a royale's first seconds that was fifteen stalls of 30-93 ms.
      // (in slices, the page drawn between them: programWarmup.ts introspectProgramsInSlices)
      await introspectProgramsInSlices(this.renderer);
    });
  }
  /** The shadow pass's depth programs for every caster under `root`, each as the pass would draw it alone (programWarmup.ts
   *  compileShadowPrograms: which one the pass links depends on the order it meets the casters in, so a fight could ask for
   *  one nobody had made). Linked in parallel with the compile's own and asked for with them (introspectPrograms). The
   *  material that holds them is kept until the whole scene is compiled again, which hands its programs to a new one first,
   *  so a program the room still needs is never let go in between. */
  private compileShadows(root:THREE.Object3D){
    if(this.context.lost)return;
    const whole=root===this.scene,keeper=whole||!this.shadowKeeper?new THREE.MeshDepthMaterial():this.shadowKeeper;
    try{compileShadowPrograms(this.renderer,root,this.scene,this.camera,keeper);}
    catch(error){console.warn('shadow programs not compiled',error);}
    if(keeper!==this.shadowKeeper){this.shadowKeeper?.dispose();this.shadowKeeper=keeper;}
  }
  private shadowKeeper?:THREE.MeshDepthMaterial;
  /** The post chain's own programs (the bloom pyramid's three, the final grade), linked with the room's: they are drawn
   *  only through the composer, which no compile walks, so a fight's first frame linked them (11 s of that frame on
   *  software GL). Each against the target its pass draws into. */
  private compilePost(){
    if(this.context.lost)return;
    try{
      this.bloomPass.bloom.compile(this.renderer,this.camera);
      // (the composer marks its last pass as the screen's only as it draws: worked out here as it will)
      const toScreen=this.composer.renderToScreen&&this.composer.passes.filter(pass=>pass.enabled).at(-1)===this.finalPass;
      this.finalPass.compile(this.renderer,this.camera,toScreen?null:this.composer.writeBuffer);
      // The film look's own (look/filmPaint.ts, look/filmFreeze.ts): the painting, its laying and the knockout's
      // painted hold, linked whichever ART STYLE is on (a player may switch to it in a fight).
      this.scenePass.compile(this.renderer,this.camera,this.composer.readBuffer);
      this.freeze.compile(this.renderer,this.camera);
    }catch(error){console.warn('post programs not compiled',error);}
  }
  uploadTextures(root:THREE.Object3D=this.scene,extra:readonly THREE.Texture[]=[]){
    for(const texture of new Set([...materialTextures(root),...extra]))this.uploadTexture(texture);
  }
  uploadTexturesOverFrames(current:()=>boolean,extra:readonly THREE.Texture[]=[]){return warmTextures(new Set([...materialTextures(this.scene),...extra]),texture=>this.uploadTexture(texture),current);}
  /** uploadTextures for a room's load, behind the loading screen, in slices of 8 ms with a task's turn between them (31 October
   *  2026): sent in one go, a room's images held the page 60-170 ms at a time, and the room's snapshots waited behind them. */
  uploadTexturesInSlices(current:()=>boolean){return warmTextures(materialTextures(this.scene),texture=>this.uploadTexture(texture),current,8,nextTask);}
  private uploadTexture(texture:THREE.Texture){try{this.renderer.initTexture(texture);}catch{/* drawn, and so uploaded, on its first frame instead */}}
  /** The shadow casters under `roots` drawn once, while the loading screen still covers the canvas (never in a fight: it
   *  would show). A compile builds each material's own program and no more; the depth programs a shadow pass makes for each
   *  mesh that casts one are linked the first time the mesh is in one, and a pooled effect between its casts (an Armory
   *  effect) is hidden, so the first cast of one that casts a shadow linked its depth program in the fight: 597 ms for a
   *  bend of earth, 216 ms for a ki disc (scripts/night/load_hitches.mjs). Only each caster and the objects it hangs from
   *  are shown, and the colour pass goes to a 16 px target, so what costs is the shadow pass's vertices and the programs;
   *  what was hidden is hidden again after.
   *  Which objects those are is textureWarmup.ts `showCasters`: every hidden object a caster hangs from, up to the scene
   *  (an Armory effect between casts hides its space and leaves its meshes as they were: a caster that was itself
   *  visible was never drawn here, and its depth program linked on the first cast - one program, 2 to 10 ms, on the
   *  first G of Hawser, Minase, Bonsho, Buna, Tokan, Gosu and Ovid, and on Shakugo's and Basilissa's ultimates),
   *  each drawn wherever it lies. The roots are the spaces the Armory hands over (FxStage.warmRoots: casts left
   *  standing or finished, never an instance not yet cast), so what is shown with a caster is drawable.
   *  A skinned mesh under them is given its bone texture now, whether it casts or not (three makes one a skeleton, at
   *  its first draw): the cinematic dragon turns its shadow off as it is cast, so its four were made on its first cast
   *  (Hinomoto's first G, while it was his area look).
   *  Launch day 15: the room's bodies and the place are roots too (main.ts). A body's depth program is its own wherever
   *  its material clips (alpha test) or it has morph targets, and a body standing outside the sun's box round the fight
   *  linked it when the fight came near it (a royale's, a duel's bot: Tobari's 2.4 s after FIGHT), a form's (an
   *  awakening's body, hidden until it) at the awakening, a place's (the tournament's masts) in the first frame; so the
   *  frame is drawn whenever there is a caster under the roots, shown or not, and each is drawn uncut by the sun's box.
   *  `whole`: roots whose every mesh is drawn uncut as well (showCasters), so a place's piece the lens first turns to in
   *  the fight has its buffers already. */
  warmDraw(roots:readonly THREE.Object3D[],whole:readonly THREE.Object3D[]=[]){
    if(this.context.lost)return;
    const previous=this.renderer.getRenderTarget();
    let warm:ReturnType<typeof showCasters>|undefined;
    try{
      warm=showCasters(roots,this.scene,whole);
      for(const skeleton of warm.skeletons){skeleton.computeBoneTexture();if(skeleton.boneTexture)this.uploadTexture(skeleton.boneTexture);}
      if(!warm.casters&&!warm.unculled.length)return;
      const target=this.warmTarget??=this.composer.renderTarget1.clone();
      target.samples=0;target.setSize(16,16);
      this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera);
    }catch(error){console.warn('warm draw failed',error);}
    finally{this.renderer.setRenderTarget(previous);warm?.restore();}
  }
  private warmTarget?:THREE.WebGLRenderTarget;
  resize(){const w=innerWidth,h=innerHeight,views=this.split?halves(this.split.screen,w,h):undefined,half=views?.[0];this.page.w=w;this.page.h=h;this.views=views;this.camera.aspect=half?half.w/half.h:w/h;this.camera.updateProjectionMatrix();
    // Player 2's lens culls by its own frustum (lenses.ts), so it keeps its half's shape through a resize too.
    if(this.split&&views){this.split.second.aspect=views[1].w/views[1].h;this.split.second.updateProjectionMatrix();}this.renderer.setSize(w,h);this.composer.setSize(half?.w??w,half?.h??h);setToonResolution((half?.h??h)*this.sceneRatio);}
  /** The page's size and a split screen's halves (CSS pixels) as the last resize found them: a split frame reads these,
   *  not the window's - `innerWidth` and `innerHeight` lay the page out again whenever the frame's HUD has changed it,
   *  three times a frame on a phone's split screen. */
  private readonly page={w:typeof innerWidth==='number'?innerWidth:1,h:typeof innerHeight==='number'?innerHeight:1};
  /** The canvas's size in CSS pixels, as the last resize set it (`renderer.setSize`, nothing in the CSS sizes it): what
   *  its `clientWidth` and `clientHeight` answer, without laying the page out to answer it. */
  get canvasSize():{readonly w:number;readonly h:number}{return this.page;}
  private views?:[Rect,Rect];
  /** A couch's split screen (couch/split.ts), or none: the frame is drawn twice, Player 1's lens (`camera`) into the first
   *  half and Player 2's (`second`) into the other, each through the whole finish at the half's own size - the composer's
   *  targets are a half's, so the pixels drawn are the single view's. `before` puts each half's camera-bound state in
   *  place (the cutaway, the fades, the shadow's focus) just before it is drawn; the frame ends with Player 1's back.
   *  `focus` is where each half's player stands (the shadow's box is placed for both before either is drawn). The second
   *  lens is the frame's too for what culls by its camera (lenses.ts). */
  private split?:SplitView;
  setSplit(split?:SplitView){this.split=split;this.setRatio(this.sceneRatio);this.resize();setSecondLens(split?.second);if(split){const r=this.halves()[1];split.second.aspect=r.w/r.h;split.second.updateProjectionMatrix();}else{this.sharedShadow?.dispose();this.sharedShadow=undefined;this.sharing=false;}}
  /** The split screen's one shadow pass for both halves (renderHalves): the sun's own shadow, its map and its box each
   *  SHARE_GROW wider - the same texel, so the same shadow - drawn once while the two halves' boxes stand within
   *  SHARE_REACH of each other, when it holds both whole (two people in one ring, or side by side). Made with the split
   *  screen and let go with it. */
  private sharedShadow?:THREE.DirectionalLightShadow;
  private sharing=false;
  private readonly aims=[new THREE.Vector3(),new THREE.Vector3()] as const;
  /** The two halves now (CSS pixels), for the split screen's HUD. */
  halves():[Rect,Rect]{return this.split&&this.views?this.views:[{x:0,y:0,w:this.page.w,h:this.page.h},{x:0,y:0,w:this.page.w,h:this.page.h}];}
  private readonly kept={position:new THREE.Vector3(),quaternion:new THREE.Quaternion(),up:new THREE.Vector3(),fov:45,zoom:1,near:.08,far:340};
  applySettings(settings:Settings){
    this.settings=settings;const q=settings.quality;
    // The images of models loaded from now on keep no more than this quality holds (textureCap.ts); High keeps all.
    setTextureCap(textureCapFor(q));
    if(this.handheld)setLiveQuality(q);
    const budget=powerBudget(settings,this.governor.relaxed,this.hordeWorkload),fps=this.frames.target(settings.powerMode);
    // A phone with the room draws above one pixel a CSS pixel (powerBudget.ts phoneSharpness), from one, climbing.
    const sharp=phoneSharpness({phone:this.frames.small,quality:q,powerMode:settings.powerMode,economical:budget.economical,dpr:devicePixelRatio,timed:this.governor.timed,fps}),cap=sharp?.cap??budget.pixelCap;
    this.budgetStrong=this.governor.relaxed;
    // The film look's tier for this quality (below); on a phone or a tablet the ladder's last step is its painting.
    // a phone or a tablet at LOW paints too, small (filmPaint.ts 'low'), its ladder's last step taking it away
    // when the device cannot hold its rate (?ab=phonepaint: no painting at LOW, as before). A desktop at LOW does not.
    const film:PaintTier=budget.economical?'off':q==='low'?(this.handheld&&!abOff('phonepaint')?'low':'off'):q==='medium'?'medium':'high';
    const rungs:LadderBudget={samples:budget.samples,bloom:budget.bloom,shadowSize:budget.shadowSize,paint:film!=='off'&&filmLookFor(settings.artStyle)};
    const key=`${q}:${settings.powerMode??'auto'}:${this.hordeWorkload}:${this.budgetStrong}:${fps}:${cap}${this.handheld?`:${!!settings.qualityChosen}:${rungs.paint}`:''}`;
    // (A quality the player chose, or FULL DETAIL, is kept whole: the ladder has no steps there.)
    const ladder=this.governor.ladder,steps=ladder&&settings.powerMode!=='full'&&!settings.qualityChosen?ladderFor(rungs).length:0;
    // A desktop starts a budget at the share its last fights settled at under it (resolutionMemory.ts), not at the top.
    let kept:number|undefined;
    if(key!==this.budgetKey){
      this.settleKey=sharp||ladder?'':settledKey(this.gpu??=gpuName(this.renderer.getContext()),key,this.page.w,this.page.h);
      kept=this.settleKey?recallSettled(this.settleKey):undefined;
      this.governor.reset(sharp?.start??kept);this.settleWatch.reset(kept);
      this.budgetKey=key;this.pendingRatio=0;ladder?.reset(steps);this.waitingSince=-1;this.ratioSince=-1;
    }
    this.governor.budgetMs=budget.gpuBudget;this.governor.frameMs=1000/fps;this.governor.cpuGate=!!sharp;
    this.pixelCap=Math.min(devicePixelRatio,cap);
    // Never under one pixel a CSS pixel where the display has more than that; elsewhere three quarters (a phone drawing
    // above one: three quarters of a pixel too, a smaller share of its larger cap).
    this.governor.floor=sharp?sharp.floor:this.pixelCap>1?Math.max(.6,1/this.pixelCap):.75;
    // A phone or a tablet never under one pixel a CSS pixel; its effects step down instead (mobileLadder.ts).
    if(ladder)this.governor.floor=Math.min(1,Math.max(this.governor.floor,1/this.pixelCap));
    if(kept!==undefined)this.governor.scale=Math.min(1,Math.max(this.governor.floor,this.governor.scale));
    this.setRatio(this.pixelCap*this.governor.scale);
    // A phone's or a tablet's ladder: the preset's budget with the steps it has taken.
    this.ladderBudget=ladder?rungs:undefined;
    const cut=ladder?cutBudget(rungs,ladder.tier):undefined;this.appliedTier=ladder?ladder.tier:0;
    this.shadowEvery=cut?.shadowEvery??1;
    const size=cut?.shadowSize??budget.shadowSize;
    if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.mapSize.set(size,size);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}
    const half=this.shadowHalf(),cam=this.sun.shadow.camera;
    Object.assign(cam,{left:-half,right:half,top:half,bottom:-half,near:.5,far:150});cam.updateProjectionMatrix();
    // Multisampling is a property of the target's storage, so a change of
    // quality releases the targets and they are rebuilt on the next frame.
    const samples=cut?.samples??budget.samples;
    for(const target of [this.composer.renderTarget1,this.composer.renderTarget2])if(target.samples!==samples){target.samples=samples;target.dispose();}
    // Low quality keeps the grade and the impact response - how a hit reads
    // must not be wired to a graphics dropdown - and drops the bloom and the
    // light shafts.
    this.bloomPass.enabled=cut?.bloom??budget.bloom;
    // The anime finish per quality: High the whole of it; Medium a narrower glow (the bloom's pyramid a level
    // shorter); Low no glow (no bloom) - its grade, air, dark ground and grain are arithmetic in the final pass.
    this.bloomPass.bloom.active=q==='high'?5:4;
    // The film look per quality (look/filmLook.ts): HIGH the whole of it; MEDIUM a smaller painting of the set; LOW (a
    // phone's) and a crowd fight on a machine with no time to spare (economical) no painting, no ink on the set and no
    // diffusion - the colour, the print, the halation and the grain are arithmetic in the final pass. Then the ART STYLE.
    // (A phone's or a tablet's ladder may have taken the painting: LOW's film look until it gives it back.)
    this.scenePass.preset=film;this.paintTier(cut&&rungs.paint&&!cut.paint?'off':film);
    setFilmLook(filmLookFor(settings.artStyle));
    this.atmosphere.setQuality(q,cut&&!cut.air?0:settings.effects);
    this.life.setQuality(q,cut&&!cut.air?0:settings.effects);
    this.resize();
  }
  /** A step the ladder took or gave back, applied at the start of a frame: at once when it reallocates nothing, else at a
   *  calm moment or after LONGEST_WAIT_S. Only what the ladder touches is set again. */
  private applyLadder(now:number){
    const ladder=this.governor.ladder,budget=this.ladderBudget;
    if(!ladder||!budget||ladder.tier===this.appliedTier){this.waitingSince=-1;return;}
    if(reallocates(budget,this.appliedTier,ladder.tier)&&!this.calm){
      if(this.waitingSince<0)this.waitingSince=now;
      if(now-this.waitingSince<LONGEST_WAIT_S*1000)return;
    }
    this.waitingSince=-1;this.governor.ladderMoved=false;
    const cut=cutBudget(budget,ladder.tier),q=this.settings.quality;this.appliedTier=ladder.tier;
    this.shadowEvery=cut.shadowEvery;
    if(this.sun.shadow.mapSize.x!==cut.shadowSize){this.sun.shadow.mapSize.set(cut.shadowSize,cut.shadowSize);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}
    for(const target of [this.composer.renderTarget1,this.composer.renderTarget2])if(target.samples!==cut.samples){target.samples=cut.samples;target.dispose();}
    this.bloomPass.enabled=cut.bloom;
    this.atmosphere.setQuality(q,cut.air?this.settings.effects:0);
    this.life.setQuality(q,cut.air?this.settings.effects:0);
    this.paintTier(budget.paint&&!cut.paint?'off':this.scenePass.preset);
  }
  /** The film look's painted set at a tier, and the final pass's ink on the set and soft print with it (uniforms only:
   *  nothing links, nothing is allocated - the pass's targets were made for the preset with the room). */
  private paintTier(tier:PaintTier){this.scenePass.tier=tier;this.finalPass.setFilm(filmOn(),tier==='medium'||tier==='high');}
  /** With the debug switch on: each change of the tier, the rate or the pixel ratio, with its time (ms since the page began). */
  private mobileHistory?:{t:number;tier:number;fps:number;pr:number;calm:boolean}[];
  private noteLadder(){
    const h=this.mobileHistory!,fps=this.frames.target(this.settings.powerMode),pr=+this.renderer.getPixelRatio().toFixed(3),last=h[h.length-1];
    if(!last||last.tier!==this.appliedTier||last.fps!==fps||last.pr!==pr)h.push({t:Math.round(performance.now()),tier:this.appliedTier,fps,pr,calm:this.calm});
  }
  /** The adaptive ladder's debug switch, on a phone or a tablet only: `?mobileframes=MS` reads every frame as MS ms long (40:
   *  the steps down; 10: back up), and `window.__mobileQuality.frames(MS)` changes it live (`frames()` gives the real
   *  frames back); `state()` reads the governor and the ladder. */
  private installMobileDebug(){
    let wanted:number|undefined;
    try{const v=new URLSearchParams(location.search).get('mobileframes');if(v!==null&&Number.isFinite(+v)&&+v>0)wanted=+v;}catch{/* no location */}
    if(wanted===undefined)return;
    this.governor.debugFrameMs=wanted;this.mobileHistory=[];
    Object.defineProperty(window,'__mobileQuality',{configurable:true,value:{
      frames:(ms?:number)=>{this.governor.debugFrameMs=ms!==undefined&&ms>0?ms:undefined;return this.governor.debugFrameMs;},
      // A tier held for a look (a screenshot): taken at the next frame, as the ladder's own are.
      tier:(n:number)=>{const ladder=this.governor.ladder;if(ladder)ladder.tier=Math.max(0,Math.min(ladder.max,Math.round(n)));return ladder?.tier;},
      history:()=>this.mobileHistory,
      state:()=>({scale:this.governor.scale,floor:this.governor.floor,pixelRatio:this.renderer.getPixelRatio(),tier:this.appliedTier,wanted:this.governor.ladder?.tier,max:this.governor.ladder?.max,frameTarget:this.frames.target(this.settings.powerMode),stepped:this.frames.stepped,calm:this.calm,shadowEvery:this.shadowEvery,bloom:this.bloomPass.enabled,paint:this.scenePass.tier,samples:this.composer.renderTarget2.samples,shadowSize:this.sun.shadow.mapSize.x}),
    }});
  }
  private readonly focus=new THREE.Vector3();
  private focusAt=-1;
  private readonly finishPoint=new THREE.Vector3();private readonly finishCrown=new THREE.Vector3();
  /** The anime finish's depth, for the camera about to be drawn (a planned still's too): the band from the nearest
   *  fighter on screen to the farthest - the far air and the background's gentler grade start behind it - and the pool
   *  of light on the ground round the two nearest. */
  private focusFinish(){
    const cam=this.camera,u=focusUniforms,p=this.finishPoint,h=this.finishCrown;
    u.uClip.value.set(cam.near,cam.far);
    let near=Infinity,far=0,cx=0,cz=0,count=0,spread=0;
    for(const o of this.scene.children){
      if(!o.visible||!o.name.startsWith('fighter-'))continue;
      const size=o.scale.y||1;
      p.copy(o.position);p.y+=size;p.applyMatrix4(cam.matrixWorldInverse);const z=-p.z;
      if(z<cam.near||z>60)continue;
      p.copy(o.position).project(cam);h.copy(o.position);h.y+=1.9*size;h.project(cam);
      if(Math.abs(p.x)>1.25||p.y>1.3||h.y<-1.3)continue;
      near=Math.min(near,z);far=Math.max(far,z);
      if(count<2){if(count)spread=Math.hypot(o.position.x-cx,o.position.z-cz);cx=(cx*count+o.position.x)/(count+1);cz=(cz*count+o.position.z)/(count+1);count++;}
    }
    if(near===Infinity){
      if(this.focusAt>=0){p.copy(this.focus).applyMatrix4(cam.matrixWorldInverse);near=far=Math.max(1,-p.z);}else near=far=8;
    }
    // The pool of light on the ground: round the two nearest, else round the fight's focus.
    if(!count&&this.focusAt>=0){cx=this.focus.x;cz=this.focus.z;}
    const pool=Math.max(2.5,spread*.5+2);u.uPool.value.set(cx,cz,pool,pool+7);
    const tanY=Math.tan(THREE.MathUtils.degToRad(cam.fov)/2)/cam.zoom;u.uProj.value.set(tanY*cam.aspect,tanY);
    u.uViewToWorld.value.copy(cam.matrixWorld);u.uUpView.value.set(0,1,0).transformDirection(cam.matrixWorldInverse);
    const n=Math.max(.3,near-.8),f=far+1.2,start=f*1.05+1;
    u.uFocus.value.set(n,start,start+Math.max(6,f*1.4),n*.4);
  }
  /** Where the fight is, each frame: the shadow box and the screen-space
   *  effects are centred on it. Without it they follow the camera. */
  setFocus(point:{x:number;y:number;z:number}){this.focus.set(point.x,point.y,point.z);this.focusAt=this.time;}
  private readonly shadowCenter=new THREE.Vector3();
  private readonly scratch=new THREE.Vector3();
  /** The sun's shadow box follows the fight instead of sitting on the world
   *  origin - the harbour is 160 m wide and its box was 58 m - and is pushed
   *  a third of its size ahead along the camera's view, where the opponent
   *  is. The centre is snapped to whole shadow texels in the light's own
   *  basis, so a moving box never makes the shadow edges crawl. */
  private updateShadow(){this.placeSun(this.shadowAim(this.camera,this.shadowCenter),2*this.shadowHalf()/this.sun.shadow.mapSize.x);}
  /** The ball modes (main.ts): the focus is the box's own centre - between the player and the ball (render/ball/BallCam.ts
   *  ballShadowFocus) - not a point the box is led ahead of, and it is trusted further from the lens, which stands well
   *  back in those modes. */
  get shadowCentred(){return this.centred;}
  set shadowCentred(on:boolean){
    if(on===this.centred)return;this.centred=on;
    // The ball modes' box is their own size, so the sun's camera is fitted again as one starts or ends.
    const half=this.shadowHalf(),cam=this.sun.shadow.camera;
    Object.assign(cam,{left:-half,right:half,top:half,bottom:-half});cam.updateProjectionMatrix();
  }
  private centred=false;
  private shadowHalf(){return (this.centred?BALL_SHADOW_HALF:SHADOW_HALF)[this.settings.quality];}
  /** Where the box's centre is for `camera` (unsnapped): the fight's focus, a third of the box ahead along the view. */
  private shadowAim(camera:THREE.Camera,c:THREE.Vector3){
    // A ball match's box stands on the middle of the place and holds all of it.
    if(this.centred)return c.set(0,0,0);
    const half=this.shadowHalf();
    const forward=camera.getWorldDirection(this.scratch);forward.y=0;
    if(forward.lengthSq()<1e-6)forward.set(0,0,-1);forward.normalize();
    // The focus is only trusted while it is fresh and near the lens: a dead
    // player spectating someone else still reports their own body.
    const trusted=this.focusAt>=0&&this.time-this.focusAt<.5&&this.focus.distanceToSquared(camera.position)<half*half*(this.shadowCentred?2.2:.5);
    if(trusted)c.copy(this.focus);
    else c.copy(camera.position).addScaledVector(forward,6).setY(0);
    return trusted&&this.shadowCentred?c:c.addScaledVector(forward,half*.33);
  }
  /** The sun and its target on `c`, snapped to whole texels (`texel` metres) in the light's own basis. */
  private placeSun(c:THREE.Vector3,texel:number){
    const x=Math.round(c.dot(this.shadowRight)/texel)*texel,y=Math.round(c.dot(this.shadowUp)/texel)*texel,z=c.dot(this.keyDir);
    c.copy(this.shadowRight).multiplyScalar(x).addScaledVector(this.shadowUp,y).addScaledVector(this.keyDir,z);
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(this.keyDir,70);
  }
  // ---- the frame's answers to the fight ----------------------------------
  //
  // The post API the effect and camera streams call. All of it is cheap to
  // call every frame, all of it is safe to call with nothing on screen, and
  // none of it allocates.
  //
  //   punch(amount)            A hit on the local player: the frame bites -
  //                            drains a little colour, darkens at the edges,
  //                            throws ink lines. 0..0.55. main.ts calls it.
  //   impactFrame(strength,at?) The manga impact frame: one frame (strength
  //                            <= 0.5) or two (above), always paper-white
  //                            with the fighters as solid black ink, the
  //                            world in screentone and radial lines from `at`
  //                            (a world point; default the fight's focus).
  //                            At most one every 0.4 s. CombatEffects calls it.
  //   chromaticPulse(amount)   A colour fringe of at most two pixels at the
  //                            frame's edges for one frame (amount >= 0.9) or
  //                            two (amount 1). Anything under 0.9 is ignored:
  //                            the fringe belongs to the heaviest hits only.
  //   speedLines(amount)       Screen-space speed lines, 0..1; decays unless
  //                            fed again every frame.
  //   techniqueGrade(color, strength, seconds)
  //                            While a technique fires: the room drained,
  //                            dimmed by up to a half and pushed toward
  //                            `color` (sRGB hex - 0x3a8cff Sunpalm Cannon,
  //                            Sickle Bolt and Galewheel; 0x8a4dff
  //                            Singularity, PLANETARIUM and SICKLE REAPER; 0xd0203a
  //                            Haizan and NIGHTFALL; 0xff7a1a Signal Fire and
  //                            Kurobi), so the technique is the brightest
  //                            thing on screen; its hot core (the effects'
  //                            1.5-3 linear) keeps its light, and the
  //                            fighters take the colour as a rim all round.
  //                            `strength` 0..1 (1 = the full half-dim);
  //                            `seconds` is how long it holds. It eases in
  //                            over about 0.15 s and out over about 0.5 s
  //                            after the hold. Calling again extends it; a
  //                            call at least 80% as strong takes over the hue.
  //                            Round 3c: with `at` (a world point) and `reach`
  //                            (metres) the grade is local - a pool round the
  //                            technique that falls off across the frame, so a
  //                            crowd keeps its own colours. Ordinary specials
  //                            pass it; ultimates and stopped time do not.
  //   cinemaGrade(amount)      An ultimate's cinema (render/FinisherCuts.ts): the
  //                            contrast pushed, the room a little drained, an
  //                            ink vignette from the corners. 0..1; feed it
  //                            every frame (main.ts does) - unfed, it is gone.
  //   timeStop(amount)         MIDNIGHT / SLUMBER: the world as a two-tone
  //                            cyan print, the fighters as black ink with a
  //                            white edge and their outlines on top. `amount`
  //                            0..1, eased over a few frames. Call it every
  //                            frame while time is stopped and with 0 as it
  //                            resumes; unfed for 0.3 s it lets go on its own,
  //                            so a lost call cannot leave the screen stuck.
  //                            Open it with impactFrame(1) for the flash.
  /** The feel pass: the impact blur (see impactBlur) - its level, how long it holds at full, the blow's
   *  world point and the bodies it keeps sharp. */
  private blurLevel=0;private blurHold=0;private readonly blurPoint=new THREE.Vector3();private blurKeep:BlurKeep[]=[];
  private readonly blurCentre=new THREE.Vector3();private readonly blurEdge=new THREE.Vector3();private readonly blurRight=new THREE.Vector3();
  private punchLevel=0;private speedLevel=0;private speedFeed=0;private cinemaFeed=0;
  private chromaPx=0;private chromaFrames=0;
  private impactFrames=0;private impactHold=0;private impactMix=0;private lastImpact=-10;private impactSeed=0;
  private techLevel=0;private techStrength=0;private techLeft=0;
  /** Round 3c: how local the grade is (0 the whole frame, 1 a pool round
   *  `techFocus` of `techReach` metres), eased like the level. */
  private techLocal=0;private techLocalTarget=0;private techReach=4;private readonly techFocus=new THREE.Vector3();
  private readonly techColor=new THREE.Color(1,1,1);private readonly techTarget=new THREE.Color(1,1,1);
  private stopLevel=0;private stopFeed=0;private stopAt=-10;private probeStop=0;
  private readonly actionPoint=new THREE.Vector3();
  private actionPointSet=false;
  /** The frame's own answer to a blow. Decayed after the draw, so the frame
   *  the hit landed on shows the whole of it rather than most of it. */
  punch(amount:number){
    if(this.reducedMotion)return;
    const now=performance.now();
    // One pulse per beat: a rush string lands a hit every eighty milliseconds
    // and re-triggering on each reads as flicker rather than as impact.
    if(now-this.lastPunch<75)return;
    this.lastPunch=now;
    this.punchLevel=Math.min(.55,Math.max(this.punchLevel,amount));
  }
  /** An anime impact frame: for one or two frames the picture turns to ink
   *  and paper - the fighters solid black (they draw themselves as ink for
   *  it), the world paper with screentone in its shade, radial lines thrown
   *  from the blow - and then snaps back. Always paper: an inverted opening
   *  frame at high strength read as a black screen in review, and so did a
   *  dark room posterised to ink. `at` is the world point of the blow;
   *  without it the lines come from the fight's focus.
   *
   *  Rate-limited to one every 0.4 s: an impact frame is a full-screen
   *  luminance flash, and photosensitivity guidance allows no more than three
   *  a second. Off entirely under prefers-reduced-motion. */
  impactFrame(strength:number,at?:THREE.Vector3,hold=0,knockout=false){
    // (VISUAL EFFECTS, render/vfxLevel.ts: Reduced and Minimal print none - the frame's whole-screen white flash.)
    if(this.reducedMotion||!(strength>0)||!(VFX.impactFrame>0))return;
    if(filmOn()){
      // The film look holds them to its sakuga moments' biggest beats (look/filmLook.ts FILM_IMPACT): an
      // ultimate's last blow, a knockout, stopped time - never two within FILM_IMPACT.rest s - for two drawings.
      // (The knockout keeps its own frame: a shorter rest.)
      if(!(strength>=FILM_IMPACT.min||hold>=FILM_IMPACT.hold)||this.time-this.lastImpact<(knockout?FILM_IMPACT.koRest:FILM_IMPACT.rest))return;
      hold=Math.max(hold,FILM_IMPACT.hold);
    }else if(this.time-this.lastImpact<.4)return;
    this.lastImpact=this.time;
    const s=Math.min(1,strength);
    this.impactFrames=s>.5?2:1;this.impactMix=(.9+.1*s)*VFX.impactFrame;this.impactHold=Math.max(this.impactHold,hold);
    this.impactSeed=Math.floor(Math.random()*1000);
    if(at){this.actionPoint.copy(at);this.actionPointSet=true;}else this.actionPointSet=false;
  }
  /** The feel pass: hold an impact frame that has just printed (another effect's, a frame or two
   *  before the blow's own event) for `hold` seconds from its start - one flash, held, not a second one. */
  extendImpact(hold:number){
    const since=this.time-this.lastImpact;
    if(!(hold>0)||since>.15||this.reducedMotion)return;
    this.impactHold=Math.max(this.impactHold,hold-since);
  }
  /** A colour fringe at the edges of the frame, for the heaviest hits only:
   *  two pixels at most, for one frame or two. It used to reach a third of
   *  the screen in rainbow bands on any medium hit. */
  chromaticPulse(amount:number){
    if(this.reducedMotion||!(amount>=.9)||!(VFX.chroma>0))return;
    this.chromaPx=2*Math.min(1,amount)*VFX.chroma;this.chromaFrames=Math.max(this.chromaFrames,amount>=1?2:1);
  }
  /** An ultimate's cinema grade; see the API notes above. */
  cinemaGrade(amount:number){this.cinemaFeed=Math.max(this.cinemaFeed,THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1));}
  /** Screen-space speed lines, for dashes, chases and charges; decays unless
   *  it is fed again. */
  speedLines(amount:number){if(this.reducedMotion)return;this.speedFeed=Math.max(this.speedFeed,Math.min(1,amount));}
  /** The technique's colour grade; see the API notes above. */
  techniqueGrade(color:number,strength:number,seconds:number,at?:{x:number;y:number;z:number},reach=4){
    if(!(strength>0)||!(seconds>0))return;
    const s=Math.min(1,strength);
    if(s>=this.techStrength*.8||this.techLevel<.05){
      // Local only while nothing whole-frame is holding: an ultimate's grade
      // is never shrunk to a pool by a special cast inside it.
      if(at&&(this.techLocalTarget>0||this.techLevel<.05)){this.techLocalTarget=1;this.techFocus.set(at.x,at.y+1.1,at.z);this.techReach=reach;}
      else if(!at)this.techLocalTarget=0;
      // Stored at unit luminance, so the push changes the room's hue and not
      // its brightness; a pure blue is capped so one channel cannot run away.
      this.techTarget.setHex(color);
      const t=this.techTarget,l=.2126*t.r+.7152*t.g+.0722*t.b;
      t.multiplyScalar(1/Math.max(l,Math.max(t.r,t.g,t.b)/3,1e-4));
      if(this.techLevel<.05)this.techColor.copy(t);
      this.techStrength=s;
    }
    this.techLeft=Math.max(this.techLeft,seconds);
  }
  /** The feel pass: a big blow throws the room behind the pair into a zoom blur toward it for a few
   *  frames (held ~50 ms, then gone in about a tenth of a second), with `keep` - the thrower and the struck, at
   *  most two - drawn sharp inside a soft ellipse round each drawn body. 0..1. Off under reduced motion. */
  impactBlur(strength:number,at:{x:number;y:number;z:number},keep:BlurKeep[]=[]){
    if(this.reducedMotion||!(strength>0))return;
    // The dream loop (22 October 2026): half as strong - the room stays sharp behind a finisher and the burst
    // carries the blow; at full this smeared every finisher's frame into the soft look its critics marked down.
    this.blurLevel=Math.max(this.blurLevel,Math.min(1,strength)*(DREAM_IMPACT?.5:1));this.blurHold=.05;
    this.blurPoint.set(at.x,at.y,at.z);this.blurKeep=keep.slice(0,2);
  }
  /** Stopped time; see the API notes above. */
  timeStop(amount:number){this.stopFeed=THREE.MathUtils.clamp(amount,0,1);this.stopAt=this.time;}
  /** The ball modes' INK FLASH (render/ball/BallMoments.ts: a SUPER SHOT, a goal): for `seconds` (0.3-0.6) the frame is
   *  a two-tone manga print in paper, screentone and ink, while the ball - the world point `inkKeep` is fed, of `radius`
   *  metres - and whatever burns brighter than white keep their colour. Snaps in, lets go over a tenth of a second.
   *  Off under prefers-reduced-motion and on the VISUAL EFFECTS levels that print no impact frame. */
  inkFlash(seconds:number){
    if(this.reducedMotion||!(VFX.impactFrame>0)||!(seconds>0))return;
    this.inkLeft=Math.max(this.inkLeft,Math.min(.8,seconds));
  }
  /** The ball modes' screen punch (render/ball/BallMoments.ts): the finished frame
   *  bumps in toward the world point `at` - by up to 3.5% for `amount` 1 - and settles back over about a fifth of a
   *  second, so a spike slammed in or a wipe-out lands on the screen without the lens moving. Only the ball modes call
   *  it; every other frame is as it was. Off under prefers-reduced-motion, and the VISUAL EFFECTS level's share of the
   *  speed lines (none on Minimal). A weaker punch inside a stronger one is ignored. */
  screenPunch(amount:number,at?:{x:number;y:number;z:number}){
    if(this.reducedMotion||!(amount>0)||!(VFX.speedLines>0))return;
    const a=Math.min(1,amount)*VFX.speedLines,left=this.zoomLevel*Math.max(0,1-this.zoomAge/ZOOM_BACK)**2;
    if(a<left)return;
    this.zoomLevel=a;this.zoomAge=0;
    if(at){this.zoomPoint.set(at.x,at.y,at.z);this.zoomPointSet=true;}else this.zoomPointSet=false;
  }
  private zoomLevel=0;private zoomAge=0;private zoomPointSet=false;private readonly zoomPoint=new THREE.Vector3();
  /** The world point the INK FLASH keeps in colour this frame (the ball), and its radius; null for none. */
  inkKeep(point:{x:number;y:number;z:number}|null,radius=1){if(point){this.inkPoint.set(point.x,point.y,point.z);this.inkRadius=radius;}else this.inkRadius=0;}
  private inkLeft=0;private inkLevel=0;private inkRadius=0;private readonly inkPoint=new THREE.Vector3();
  /** Where the INK FLASH's kept point falls on the screen for the lens drawing now (a split screen's each half). */
  private placeInk(u:typeof this.finalPass.uniforms){
    const k=u.uInkBall.value;k.set(0,0,0);
    if(this.inkLevel<.002||!(this.inkRadius>0))return;
    this.projected.copy(this.inkPoint).applyMatrix4(this.camera.matrixWorldInverse);
    const depth=-this.projected.z;
    if(depth<.3)return;
    this.projected.copy(this.inkPoint).project(this.camera);
    k.set(this.projected.x*.5+.5,this.projected.y*.5+.5,THREE.MathUtils.clamp(this.inkRadius/(depth*2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)),.01,.3));
  }
  /** The power-up pass: a power-up's night, 0..1, fed every frame it holds (the strongest feed of a frame wins). The
   *  place goes dark - the room's albedo and key (look/stageMaterials.ts setRoomDim), the sky, the haze and the hall's
   *  panes - and nothing else: the fighters and every effect keep their light, so the flame is the brightest thing on
   *  screen, the sky gone black behind the aura. It closes in fast and lets go slowly. */
  powerDim(amount:number){
    if(this.dimAt!==this.time){this.dimFeed=0;this.dimAt=this.time;}
    this.dimFeed=Math.max(this.dimFeed,THREE.MathUtils.clamp(amount,0,1)*VFX.powerDim);
  }
  private dimFeed=0;private dimAt=-1;private dimLevel=0;private dimShown=0;
  private readonly fogBase=new THREE.Color();private readonly fogNight=new THREE.Color(0x05081a);
  /** Where a local grade's pool sits on screen and how wide it is: the
   *  focus projected, its reach turned into a share of the frame's height at
   *  its depth. Behind the lens it falls back to the whole frame. */
  private placeTechFocus(u:typeof this.finalPass.uniforms){
    u.uTechLocal.value=0;
    if(this.techLocal<.002)return;
    this.projected.copy(this.techFocus).applyMatrix4(this.camera.matrixWorldInverse);
    const depth=-this.projected.z;
    if(depth<.3)return;
    this.projected.copy(this.techFocus).project(this.camera);
    u.uTechLocal.value=this.techLocal;
    u.uTechFocus.value.set(this.projected.x*.5+.5,this.projected.y*.5+.5);
    u.uTechRadius.value=THREE.MathUtils.clamp(this.techReach/(depth*2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)),.1,.32);
  }
  private lastPunch=0;
  private reducedMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly projected=new THREE.Vector3();
  /** the ink's key light in the lens's space, and its widths (look/toonShading.ts uInkLight; ?ab=inkweight
   *  draws the even line). Each frame before the draw, and wherever the lens is moved for one (the probe's poses). */
  private updateInk(){
    inkUniforms.uInkLight.value.subVectors(this.sun.position,this.sun.target.position).normalize().transformDirection(this.camera.matrixWorldInverse);
    if(abOff('inkweight'))inkUniforms.uInkWeight.value.set(1,1);else inkUniforms.uInkWeight.value.set(INK_WEIGHT.lit,INK_WEIGHT.shade);
  }
  private updatePost(dt:number){
    const u=this.finalPass.uniforms,f=frameUniforms;
    u.uTime.value=this.time;
    this.updateInk();
    // Speed lines re-dealt twenty times a second, like hand-drawn lines boil.
    u.uSeed.value=Math.floor(this.time*20)%997;
    u.uPunch.value=this.punchLevel;u.uChroma.value=this.chromaFrames>0?this.chromaPx:0;
    // (VISUAL EFFECTS: the level's share of the frame's answers - render/vfxLevel.ts; all ones at Full.)
    u.uCinema.value=this.cinemaFeed>.002?this.cinemaFeed*VFX.cinema:0;this.cinemaFeed=0;u.uBloomGain.value=VFX.bloom;
    // (The dream loop, round 25: a burst, not a curtain - held 0.6 s, they ran on over a chase's whole air string and hid
    // its sparks, a blind critic's "heavy black-white speed lines".)
    this.speedLevel=Math.max(this.speedLevel*Math.exp(-dt*(DREAM_IMPACT?13:7)),this.speedFeed);this.speedFeed=0;
    u.uSpeed.value=this.speedLevel>.01?this.speedLevel*VFX.speedLines:0;
    // The technique grade holds while its time lasts and eases both ways.
    const step=Math.min(dt,.1),holding=this.techLeft>0;
    this.techLeft=Math.max(0,this.techLeft-step);
    const techTarget=holding?this.techStrength:0;
    this.techLevel+=(techTarget-this.techLevel)*(1-Math.exp(-step*(techTarget>this.techLevel?18:5)));
    if(!holding&&this.techLevel<.004){this.techLevel=0;this.techStrength=0;}
    this.techColor.lerp(this.techTarget,1-Math.exp(-step*10));
    this.techLocal+=(this.techLocalTarget-this.techLocal)*(1-Math.exp(-step*12));
    if(this.techLevel===0){this.techLocal=this.techLocalTarget=0;}
    // Stopped time follows its feed within a few frames, and lets go when
    // nobody has fed it for a moment.
    if(this.probeStop>0)this.timeStop(this.probeStop);
    const stopTarget=this.time-this.stopAt<.3?this.stopFeed:0;
    this.stopLevel+=(stopTarget-this.stopLevel)*(1-Math.exp(-step*25));
    if(stopTarget===0&&this.stopLevel<.004)this.stopLevel=0;
    const impact=this.impactFrames>0||this.impactHold>0;
    const tech=this.techLevel*VFX.grade;
    u.uTech.value=tech;u.uTechColor.value.copy(this.techColor);
    this.placeTechFocus(u);
    u.uStop.value=impact?0:this.stopLevel;
    // The INK FLASH: in at once, out over about a tenth of a second (an impact frame, a frame or two of paper, wins).
    if(this.inkLeft>0){this.inkLeft=Math.max(0,this.inkLeft-step);this.inkLevel=this.inkLeft>0?1:this.inkLevel;}
    else{this.inkLevel*=Math.exp(-step*16);if(this.inkLevel<.01)this.inkLevel=0;}
    u.uInk.value=impact?0:this.inkLevel;this.placeInk(u);
    // The ball modes' screen punch: in at once, eased back out (the toward point projected for the lens drawing now).
    u.uZoom.value=0;
    if(this.zoomLevel>0){
      u.uZoom.value=.035*this.zoomLevel*Math.max(0,1-this.zoomAge/ZOOM_BACK)**2;
      this.projected.copy(this.zoomPoint).project(this.camera);
      if(this.zoomPointSet&&this.projected.z<1)u.uZoomCenter.value.set(THREE.MathUtils.clamp(this.projected.x*.5+.5,.15,.85),THREE.MathUtils.clamp(this.projected.y*.5+.5,.15,.85));
      else u.uZoomCenter.value.set(.5,.5);
    }
    // The fighters' share of it (their rim in its colour, the lift) goes
    // with how whole-frame it is: a local pool does not re-light the crowd.
    const fighterTech=tech*(1-.7*this.techLocal);
    f.uLookTech.value=fighterTech;f.uLookTechColor.value.copy(this.techColor);
    setCloudTime(this.time);// iteration eight: the clouds drift on (look/lightCookie.ts)
    liftFightersUnderGrade(fighterTech,this.techColor);// round 3b: the fighters stay readable under it (3c: as much as the grade is whole-frame)
    // The hall's glowing panes are as hot as a technique's core, so the grade
    // would leave them alone; they are the room, and they dim with it.
    const dimTarget=this.time-this.dimAt<.25?this.dimFeed:0;
    this.dimLevel+=(dimTarget-this.dimLevel)*(1-Math.exp(-step*(dimTarget>this.dimLevel?9:2.4)));
    if(dimTarget===0&&this.dimLevel<.003)this.dimLevel=0;
    if(this.dimLevel>0||this.dimShown>0){
      setRoomDim(this.dimLevel);this.sky.dim(this.dimLevel);
      (this.scene.fog as THREE.Fog).color.copy(this.fogBase).lerp(this.fogNight,.75*this.dimLevel);
      this.dimShown=this.dimLevel;
    }
    windowGlow.uPaneGlow.value.copy(this.paneGlow).multiplyScalar((1-.65*tech)*(1-.8*this.dimLevel));
    // The fighters draw themselves as ink for an impact frame (solid black)
    // and for stopped time (black with a white edge).
    f.uLookSilhouette.value=impact?1:this.stopLevel;f.uLookSilhouetteRim.value=impact?0:1;
    // The centre of action, on screen: the blow's point during an impact
    // frame, otherwise the fight's focus at chest height.
    const center=u.uCenter.value;
    if(this.focusAt>=0){this.projected.copy(this.focus).setY(this.focus.y+1.2).project(this.camera);
      if(this.projected.z<1)center.set(THREE.MathUtils.clamp(this.projected.x*.5+.5,.3,.7),THREE.MathUtils.clamp(this.projected.y*.5+.5,.3,.7));else center.set(.5,.5);
    }else center.set(.5,.5);
    if(impact){
      if(this.actionPointSet){this.projected.copy(this.actionPoint).project(this.camera);u.uImpactCenter.value.set(this.projected.x*.5+.5,this.projected.y*.5+.5);}
      else u.uImpactCenter.value.copy(center);
      u.uImpact.value=this.impactMix;
      u.uSeed.value=this.impactSeed;
    }else u.uImpact.value=0;
    // The impact blur: toward the blow on screen, each kept body an ellipse round its drawn centre - its height
    // the projected span of a body about its pelvis, its width a share of that (arms out, a blade).
    u.uBlur.value=impact?0:this.blurLevel*VFX.blur;
    if(u.uBlur.value>0){
      this.projected.copy(this.blurPoint).project(this.camera);
      u.uBlurCenter.value.set(this.projected.x*.5+.5,this.projected.y*.5+.5);
      const aspect=u.uResolution.value.y/Math.max(1,u.uResolution.value.x);
      this.blurRight.setFromMatrixColumn(this.camera.matrixWorld,0);
      for(let i=0;i<2;i++){
        const k=u.uBlurKeep.value[i],body=this.blurKeep[i];k.set(0,0,0,0);
        if(!body)continue;
        const size=body.state?.size??1,centre=body.visualCenter(this.blurCentre);
        this.blurEdge.copy(centre).addScaledVector(this.camera.up,1.4*size).project(this.camera);
        this.projected.copy(centre).project(this.camera);
        if(this.projected.z>1||this.blurEdge.z>1)continue;
        const ry=Math.max(.04,Math.abs(this.blurEdge.y-this.projected.y)*.5);
        k.set(this.projected.x*.5+.5,this.projected.y*.5+.5,ry*.78*aspect,ry);
      }
    }
  }
  /** Counted in drawn frames where the brief is in frames: the impact frame
   *  and the fringe last one or two frames at any refresh rate. */
  private decayPost(dt:number){
    this.punchLevel*=Math.exp(-dt*9);if(this.punchLevel<.003)this.punchLevel=0;
    this.chromaFrames=Math.max(0,this.chromaFrames-1);
    this.impactFrames=Math.max(0,this.impactFrames-1);this.impactHold=Math.max(0,this.impactHold-dt);
    if(this.zoomLevel>0){this.zoomAge+=dt;if(this.zoomAge>=ZOOM_BACK)this.zoomLevel=0;}
    if(this.blurHold>0)this.blurHold-=dt;else{this.blurLevel*=Math.exp(-dt*26);if(this.blurLevel<.01){this.blurLevel=0;this.blurKeep=[];}}
  }
  render(dt:number){
    // Battery state can change after the scene has loaded. Rebudget once at
    // that transition, including shadow/MSAA cost, not just resolution.
    if(this.budgetStrong!==this.governor.relaxed)this.applySettings(this.settings);
    // (A phone's or a tablet's step waits for a calm moment, or LONGEST_WAIT_S: a resize mid-fight is a hitch.)
    if(this.pendingRatio&&this.ratioDue()){const ratio=this.pendingRatio;this.pendingRatio=0;this.ratioSince=-1;this.setRatio(ratio);this.resize();}
    if(this.governor.ladder){this.governor.ladderRest=this.calm;this.applyLadder(performance.now());if(this.mobileHistory)this.noteLadder();}
    this.frameTimes.push(dt*1000);if(this.frameTimes.length>600)this.frameTimes.shift();
    this.time+=Math.min(dt,.1);
    this.stepFilm();
    // The film look's drawings (look/filmDrawings.ts): the fighters posed twelve times a second.
    if(filmOn())holdDrawings(this.scene,this.time);
    // The frame's draws: every skeleton in them posed once (skeletonOnce.ts).
    drawingFrame(true);
    try{
    // (the painted set: not on a split screen, nor in the ball modes, whose pitch lines must read as drawn)
    this.scenePass.allowed=!this.split&&!this.centred;
    if(this.split&&!this.probePose)this.splitFrame(dt,this.split);
    else{
    // The ladder's shadowRate: the sun's map drawn every other frame and kept still between - its box with it, so the
    // map is read with the matrix it was drawn with.
    const shadowNow=this.shadowEvery===1||(this.shadowFrame++%this.shadowEvery)===0;
    this.renderer.shadowMap.autoUpdate=shadowNow;
    if(shadowNow)this.updateShadow();
    this.sky.update(this.time,Math.min(dt,.1));
    this.atmosphere.update(this.time,this.camera);
    this.life.update(this.time,Math.min(dt,.1),this.camera,this.dimLevel,this.focus);
    this.updatePost(dt);
    this.renderer.info.reset();
    const timing=this.gpuTimer?.begin();
    if(!timing)this.governor.begin();
    this.emptyInstances.hold();
    try{if(this.probePose)this.renderProbe(dt);else if(!this.freeze.draw(this.renderer,this.time)){this.composer.render(dt);this.paintAfter(dt);}}
    finally{this.emptyInstances.release();}
    if(timing)this.gpuTimer!.end();else this.governor.end();
    }
    }finally{drawingFrame(false);this.renderer.shadowMap.autoUpdate=true;}
    this.decayPost(Math.min(dt,.1));
    // Round 4: a step is applied at the start of the next frame, just before it
    // draws. Resizing the canvas clears what it holds, and resized after this
    // frame's draw, the frame the page showed was the cleared one: a black
    // flash at every step, once a second through a fight on a machine the
    // governor is holding down.
    // The frame's main-thread time, from its start to its draw calls sent: the governor holds the resolution while that
    // alone fills the frame (ResolutionGovernor cpuLimited).
    const end=performance.now(),cpu=end-this.frameBegin;
    this.lastCpu=Number.isFinite(cpu)?cpu:undefined;
    if(this.governor.update(end,this.holdResolution,Number.isFinite(cpu)?cpu:undefined))this.pendingRatio=this.pixelCap*this.governor.scale;
    // (A share held through ten seconds of fighting is kept for the next session: resolutionMemory.ts.)
    if(this.settleKey){const settled=this.settleWatch.frame(dt,this.governor.scale,this.calm);if(settled!==undefined)rememberSettled(this.settleKey,settled);}
  }
  /** A split screen's frame, timed and held as the single view's is (the empty instanced pools left out of both draws). */
  private splitFrame(dt:number,split:NonNullable<GameRenderer['split']>){
    this.sky.update(this.time,Math.min(dt,.1));
    this.renderer.info.reset();
    const timing=this.gpuTimer?.begin();
    if(!timing)this.governor.begin();
    this.emptyInstances.hold();
    try{this.renderHalves(dt,split);}
    finally{this.emptyInstances.release();}
    if(timing)this.gpuTimer!.end();else this.governor.end();
  }
  /** The split screen's frame (see `split`): each half through the shadow, the air and the finish with its own lens - the
   *  frame's camera made Player 2's for the second and given back after - into its own viewport. The finish's levels
   *  (a punch, a grade) move once a frame, with the first half; the second reads them as they stand.
   *
   *  What a half would only do again is done once (couch play, 2 November 2026: "the couch co-op across all modes needs
   *  more optimization"): the sun's shadow pass while one box holds both halves' (shareShadow), and the second half's
   *  matrix pass - nothing in the world moves between the halves, so it finds every world matrix as the first left it,
   *  the sun's alone brought up to date for its own box. */
  private renderHalves(dt:number,split:NonNullable<GameRenderer['split']>){
    const legacy=SPLIT_LEGACY.sizes,main=this.camera,kept=this.kept,second=split.second,height=legacy?innerHeight:this.page.h,views=legacy?halves(split.screen,innerWidth,innerHeight):this.halves(),own=this.sun.shadow;
    kept.position.copy(main.position);kept.quaternion.copy(main.quaternion);kept.up.copy(main.up);kept.fov=main.fov;kept.zoom=main.zoom;kept.near=main.near;kept.far=main.far;
    try{
      const shared=this.shareShadow(split,own);
      for(const half of [0,1] as const){
        const r=views[half],gl=glRect(r,height);setDrawingHalf(half);
        if(half){main.position.copy(second.position);main.quaternion.copy(second.quaternion);main.up.copy(second.up);main.fov=second.fov;main.zoom=second.zoom;main.near=second.near;main.far=second.far;}
        main.aspect=r.w/r.h;main.updateProjectionMatrix();main.updateMatrixWorld(true);
        split.before(half);
        if(!shared)this.placeSun(this.aims[half],2*this.shadowHalf()/own.mapSize.x);
        this.renderer.shadowMap.autoUpdate=!shared||!half;
        if(half&&!SPLIT_LEGACY.matrices){this.scene.matrixWorldAutoUpdate=false;this.sun.updateMatrixWorld();this.sun.target.updateMatrixWorld();}
        this.atmosphere.update(this.time,main);
        this.life.update(this.time,half?0:Math.min(dt,.1),main,this.dimLevel,this.focus);
        this.updatePost(half?0:dt);
        this.renderer.setViewport(gl.x,gl.y,gl.w,gl.h);this.renderer.setScissor(gl.x,gl.y,gl.w,gl.h);this.renderer.setScissorTest(true);
        this.composer.render(dt);
      }
    }finally{
      setDrawingHalf(0);this.sun.shadow=own;this.renderer.shadowMap.autoUpdate=true;this.scene.matrixWorldAutoUpdate=true;
      const w=legacy?innerWidth:this.page.w,h=legacy?innerHeight:this.page.h;
      this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,w,h);this.renderer.setScissor(0,0,w,h);
      main.position.copy(kept.position);main.quaternion.copy(kept.quaternion);main.up.copy(kept.up);main.fov=kept.fov;main.zoom=kept.zoom;main.near=kept.near;main.far=kept.far;
      main.aspect=views[0].w/views[0].h;main.updateProjectionMatrix();main.updateMatrixWorld(true);
      split.before(0);
    }
  }
  /** Each half's shadow box this frame (`aims`, each half's lens on its own player), and whether one pass draws the
   *  shadow for both: while the two stand within SHARE_REACH of each other on both of the light's axes, the shared
   *  shadow (sharedShadow) takes the sun's place, its box on the middle of theirs - holding both whole, at the sun's own
   *  texel - and the second half draws with the map the first made. Further apart, each half's box is its own, drawn
   *  in its own pass, as before. */
  private shareShadow(split:NonNullable<GameRenderer['split']>,own:THREE.DirectionalLightShadow){
    const [a,b]=this.aims,q=this.settings.quality,one=split.focus(0),two=split.focus(1);
    if(two)this.setFocus(two);this.shadowAim(split.second,b);
    if(one)this.setFocus(one);this.shadowAim(this.camera,a);
    const reach=2*this.shadowHalf()*SHARE_REACH*(this.sharing?1:SHARE_TAKE);
    this.sharing=!SPLIT_LEGACY.shadow&&Math.abs(b.dot(this.shadowRight)-a.dot(this.shadowRight))<=reach&&Math.abs(b.dot(this.shadowUp)-a.dot(this.shadowUp))<=reach;
    if(!this.sharing)return false;
    const size=Math.round(own.mapSize.x*SHARE_GROW),half=this.shadowHalf()*SHARE_GROW;
    let shadow=this.sharedShadow;
    if(!shadow||shadow.mapSize.x!==size){shadow?.dispose();shadow=this.sharedShadow=own.clone();shadow.mapSize.set(size,size);}
    shadow.bias=own.bias;shadow.normalBias=own.normalBias;shadow.radius=own.radius;shadow.intensity=own.intensity;
    const cam=shadow.camera;
    if(cam.right!==half||cam.near!==own.camera.near||cam.far!==own.camera.far){Object.assign(cam,{left:-half,right:half,top:half,bottom:-half,near:own.camera.near,far:own.camera.far});cam.updateProjectionMatrix();}
    this.sun.shadow=shadow;
    this.placeSun(this.shadowCenter.addVectors(a,b).multiplyScalar(.5),2*half/size);
    return true;
  }
  /** The resolution has nothing left to give the quality watch (qualityTier.ts QualityWatch): at its floor, or - on a
   *  phone or a tablet - held back by the CPU, which no resolution buys back. */
  get resolutionSpent(){return (this.governor.scale<=this.governor.floor+1e-3||this.handheld&&this.governor.cpuBound)&&(this.governor.ladder?.settled(performance.now())??true);}
  /** Round 4: a resolution step waiting for the next frame (see render). */
  private pendingRatio=0;
  /** The scene's pixels a CSS pixel (the quality's cap times the governor's share): the composer's ratio. */
  private sceneRatio=1;
  /** look/upscale.ts: on a desktop the canvas holds the screen's own pixels and the final pass's upscale takes
   *  the scene's frame there. A phone, a tablet, a split screen (its halves are drawn straight to the screen) or
   *  ?ab=upscale draw the canvas at the scene's ratio and leave the stretching to the browser, as before. */
  private setRatio(ratio:number){
    const possible=!this.handheld&&!this.split&&!abOff('upscale'),screen=possible?Math.max(ratio,devicePixelRatio):ratio;
    this.sceneRatio=ratio;setSceneRatio(this.renderer,ratio);
    this.renderer.setPixelRatio(screen);this.composer.setPixelRatio(ratio);
    this.finalPass.setUpscale(screen>ratio*1.001,possible);
  }
  /** Where a desktop's resolution settles under the current budget (resolutionMemory.ts; '' on a phone or a tablet). */
  private settleKey='';
  private readonly settleWatch=new SettleWatch();
  private gpu?:string;
  /** The last frame's main-thread time, ms (from its start to its draw calls sent), for the frame policy. */
  lastCpu?:number;
  /** The adaptive ladder's debug switch (installMobileDebug) for the frame policy: the frame's step and main-thread time as
   *  the switch has them, else as they were. */
  policyFrame(dt:number):[number,number|undefined,number]{const ms=this.governor.debugFrameMs;return ms===undefined?[dt,this.lastCpu,1]:[ms/1000,ms*.3,Math.max(1,Math.min(250,Math.round(dt*1000/ms)))];}
  /** When a phone's or a tablet's resolution step began to wait for a calm moment (-1: none waiting). */
  private ratioSince=-1;
  private ratioDue(){
    if(!this.handheld||this.calm)return true;
    const now=performance.now();if(this.ratioSince<0)this.ratioSince=now;
    return now-this.ratioSince>=LONGEST_WAIT_S*1000;
  }
  /** Dev-only GPU frame timer (EXT_disjoint_timer_query_webgl2): what the
   *  frame costs the GPU, independent of how busy the CPU is. */
  private gpuTimer?:{begin:()=>boolean;end:()=>void;samples:number[]};
  private startGpuTimer(frames:number){
    const gl=this.renderer.getContext() as WebGL2RenderingContext,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if(!ext)return false;
    const pending:WebGLQuery[]=[],samples:number[]=[];
    this.gpuTimer={samples,begin:()=>{
      for(let i=pending.length-1;i>=0;i--){const q=pending[i];if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))continue;if(!gl.getParameter(ext.GPU_DISJOINT_EXT))samples.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);pending.splice(i,1);}
      if(samples.length+pending.length>=frames)return false;
      const q=gl.createQuery()!;gl.beginQuery(ext.TIME_ELAPSED_EXT,q);pending.push(q);return true;
    },end:()=>gl.endQuery(ext.TIME_ELAPSED_EXT)};
    return true;
  }
  /** The last 600 frames' rate and 95th percentile, and what was drawn. The times are sorted in a typed array kept for it
   *  (a number sort with no comparator to call: the copy and the sort's 5,500 comparisons allocated 1.7% of a royale's
   *  garbage, the HUD asking 14 times a second); the same order, so the same sum and the same percentile. */
  perf(){const n=this.frameTimes.length;if(this.perfTimes.length<n)this.perfTimes=new Float64Array(n);const frames=this.perfTimes.subarray(0,n);for(let i=0;i<n;i++)frames[i]=this.frameTimes[i];frames.sort();let sum=0;for(let i=0;i<n;i++)sum+=frames[i];const avg=sum/Math.max(1,n);return {fps:1000/avg,p95:frames[Math.floor(n*.95)]??0,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,samples:n,resolution:this.governor.scale,pixelRatio:this.renderer.getPixelRatio(),frameTarget:this.frames?.target(this.settings?.powerMode)??60,cpuBound:+!!this.governor.cpuBound};}
  private perfTimes=new Float64Array(600);
  // ---- dev-only probe: fixed viewpoints for judging a stage's look --------
  private probePose?:{position:THREE.Vector3;target:THREE.Vector3};
  private readonly savedPosition=new THREE.Vector3();private readonly savedQuaternion=new THREE.Quaternion();
  private renderProbe(dt:number){
    const pose=this.probePose!;
    this.savedPosition.copy(this.camera.position);this.savedQuaternion.copy(this.camera.quaternion);
    this.camera.position.copy(pose.position);this.camera.lookAt(pose.target);this.camera.updateMatrixWorld();this.updateInk();
    this.composer.render(dt);
    this.camera.position.copy(this.savedPosition);this.camera.quaternion.copy(this.savedQuaternion);this.camera.updateMatrixWorld();
  }
  private installProbe(){
    Object.defineProperty(window,'__look',{configurable:true,value:{
      view:(position:number[],target:number[])=>{this.probePose={position:new THREE.Vector3(...position),target:new THREE.Vector3(...target)};},
      release:()=>{this.probePose=undefined;},
      // The anime finish (look/powerupLook.ts) off and on, on the running stage: one held frame drawn both ways.
      finish:(on:boolean)=>{setAnimeFinish(on);this.applyLook(lookFor(this.stage),STAGES[this.stage]);return animeFinishOn();},
      // The film look off and on, on the running stage (not kept for the next visit), and the frame drawn again as it
      // stands - nothing advanced - so one held frame is drawn both ways.
      film:(on:boolean)=>{setFilmLook(on);return filmOn();},
      // The look changes' A/B switches (look/abSwitch.ts), flipped on the running page for the before/after stills.
      ab:(name:AbName,off:boolean)=>{setAbOff(name,off);return abOff(name);},
      upscale:(o:Partial<typeof UPSCALE>)=>({...Object.assign(UPSCALE,o)}),
      inkWeight:(o:Partial<typeof INK_WEIGHT>)=>{Object.assign(INK_WEIGHT,o);this.updateInk();return {...INK_WEIGHT};},
      // The painted freeze taken from the frame just drawn (call after redraw) and shown, focused on (x, y) in uv.
      freeze:(x=.5,y=.5)=>{this.freezeFocus.set(x,y);this.freeze.capture(this.renderer,this.time,this.freezeFocus);return this.freeze.draw(this.renderer,this.time);},
      freezeOff:()=>{this.freeze.cancel();this.freezeIn=-1;},
      // The film look's numbers turned in play (look/filmLook.ts FILM, LOOK and FILM_SPARK's groups),
      // the look applied again on the running stage; returns them as they now stand.
      filmTune:(patch:{film?:Record<string,unknown>;look?:Record<string,unknown>;spark?:Record<string,Record<string,number>>;paint?:Record<string,unknown>}={})=>{
        Object.assign(FILM,patch.film??{});Object.assign(LOOK,patch.look??{});Object.assign(PAINT,patch.paint??{});
        for(const [k,v] of Object.entries(patch.spark??{}))Object.assign((FILM_SPARK as unknown as Record<string,Record<string,number>>)[k],v);
        this.restyle();return JSON.parse(JSON.stringify({film:FILM,look:LOOK,spark:FILM_SPARK,paint:PAINT}));},
      scene:this.scene,
      redraw:()=>{if(filmOn())holdDrawings(this.scene,this.time);this.updateShadow();effekseerRedraw.on=true;drawingFrame(true);try{this.emptyInstances.hold();try{if(this.probePose)this.renderProbe(0);else this.composer.render(0);}finally{this.emptyInstances.release();}}finally{drawingFrame(false);effekseerRedraw.on=false;}},
      // Another quality tier on the running game, to cost the finish's tiers on the GPU timer.
      quality:(quality:Settings['quality'])=>{this.applySettings({...this.settings,quality});return quality;},
      impact:(s:number,hold=0)=>{this.lastImpact=-10;this.impactFrame(s);this.impactHold=hold;},
      blur:(s:number)=>this.impactBlur(s,this.focus),
      speed:(s:number)=>this.speedLines(s),chroma:(s:number)=>this.chromaticPulse(s),punch:(s:number)=>{this.lastPunch=0;this.punch(s);},
      technique:(color:number,strength:number,seconds:number)=>this.techniqueGrade(color,strength,seconds),
      // Held until released with stop(0), for stills.
      stop:(amount:number)=>{this.probeStop=amount;if(!(amount>0))this.timeStop(0);},
      gpu:(frames=120)=>this.startGpuTimer(frames),
      // Switch single features off and on, to cost them on the GPU timer.
      tune:(o:{samples?:number;pixelRatio?:number;bloom?:boolean;half?:boolean;sky?:boolean;air?:boolean;life?:boolean;shadows?:boolean;legacy?:{shadow?:boolean;matrices?:boolean;skeletons?:boolean;lenses?:boolean;sizes?:boolean}})=>{
        if(o.legacy){if(o.legacy.lenses!==undefined)setSecondLens(o.legacy.lenses?undefined:this.split?.second);if(o.legacy.shadow!==undefined)SPLIT_LEGACY.shadow=o.legacy.shadow;if(o.legacy.matrices!==undefined)SPLIT_LEGACY.matrices=o.legacy.matrices;if(o.legacy.sizes!==undefined)SPLIT_LEGACY.sizes=o.legacy.sizes;if(o.legacy.skeletons!==undefined)skeletonOnce.on=!o.legacy.skeletons;}
        if(o.samples!==undefined)for(const t of [this.composer.renderTarget1,this.composer.renderTarget2]){t.samples=o.samples;t.dispose();}
        if(o.pixelRatio!==undefined){this.setRatio(o.pixelRatio);this.resize();}
        if(o.bloom!==undefined)this.bloomPass.enabled=o.bloom;
        if(o.half!==undefined)for(const t of [this.composer.renderTarget1,this.composer.renderTarget2]){t.texture.type=o.half?THREE.HalfFloatType:THREE.UnsignedInt101111Type;t.texture.format=o.half?THREE.RGBAFormat:THREE.RGBFormat;t.dispose();}
        if(o.sky!==undefined)this.sky.mesh.visible=o.sky;
        if(o.air!==undefined)this.atmosphere.group.visible=o.air;
        if(o.life!==undefined)this.life.enabled=o.life;
        if(o.shadows!==undefined)this.sun.castShadow=o.shadows;
      },
      // Wall time of whole frames rendered back to back with the GPU drained
      // after each: what a frame really costs once nothing can overlap it.
      bench:(frames=30)=>{
        const gl=this.renderer.getContext(),times:number[]=[];
        for(let i=0;i<frames;i++){const t0=performance.now();this.composer.render(1/60);gl.finish();times.push(performance.now()-t0);}
        times.sort((a,b)=>a-b);return {median:times[times.length>>1],p10:times[Math.floor(times.length*.1)],p90:times[Math.floor(times.length*.9)]};
      },
      gpuResult:()=>{const s=(this.gpuTimer?.samples??[]).slice().sort((a,b)=>a-b);return s.length?{frames:s.length,mean:s.reduce((a,b)=>a+b,0)/s.length,median:s[s.length>>1],p95:s[Math.floor(s.length*.95)]}:null;},
      state:()=>({stage:this.stage,samples:this.composer.renderTarget2.samples,bloom:this.bloomPass.enabled,shadow:this.sun.shadow.camera.right,environment:!!this.scene.environment,sharing:this.sharing}),
      // What the final pass drew with on the last frame, for counting frames.
      post:()=>{const u=this.finalPass.uniforms;return {impact:u.uImpact.value,chroma:u.uChroma.value,punch:u.uPunch.value,cinema:u.uCinema.value,tech:u.uTech.value,stop:u.uStop.value,silhouette:frameUniforms.uLookSilhouette.value};},
    }});
  }
}
