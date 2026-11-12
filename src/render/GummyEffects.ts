import * as THREE from 'three';
import type {Fighter} from './Fighter';
import {FLIGHTS} from './CombatEffects';
import {MOVES,WHIFF_RECOVERY} from '../game/moves';
import {comboMove} from '../game/combos';
import {taimatsuMaterial,fireTongueMaterial} from './vfx/TaimatsuMaterial';
import {taimatsuGeometry} from './vfx/TaimatsuGeometry';
import {VfxKit} from './vfx/VfxKit';
import type {Element} from './vfx/palette';
import {GiantFists} from './signature/GiantFist';
import {bodyCenter} from './signature/body';
import {SIGNATURE,involvesLocal,gradeOnce,gradeLocal,GRADE} from './signature/context';
import {GatlingFists} from './signature/GatlingFists';
import {AWAKENING_ENTRY,awakeningSwapAt} from '../game/awakening';
import {BLACK,FIRE,flamePalette,flameSpriteGeometry,flameSpriteMaterial} from './signature/FlameSprites';
import {GlowBatch,GLOW,STAR,RING} from './signature/GlowBatch';
import {LightVolumes} from './signature/LightVolumes';
import {beats} from './signature/ultimateClock';
import {SPRING_TIDE_TAKE,springTideOut} from './gummy/spring-tide';
import {armoryDraws} from './vfx/armory/drawn';
import {LucyTideFx} from '../originals/lucyTideFx';
import {LUCY_TIDE} from '../originals/lucyTide';

/** Round 4b (GUMMY): the SUNSET BARRAGE (and SUNRISE's dawn barrage, on the same clock) and the SPRING TIDE, the
 *  ultimate's finisher: the fist is blown up over the held victim from the confirm and brought down on them. */
const GATLING_MOVE=MOVES.gummy.special;
const SPRING_TIDE_MOVE=MOVES.gummy.ultimate,SPRING_TIDE=SPRING_TIDE_MOVE.contacts[SPRING_TIDE_MOVE.contacts.length-1],SPRING_TIDE_OPEN=SPRING_TIDE_MOVE.contacts[0];
/** The barrage's fists beyond his own two (signature/GatlingFists): how long before the first contact they start, how
 *  many a second leave his shoulders, how long each is out (seconds), how big (times the Taimatsu fist) and how thick its
 *  arm (metres) - the Hawk's, and the Dawn's blown up - how wide over the body they land, and how far ahead with
 *  nobody to land on. */
const GATLING_PHANTOM={lead:.07,rate:72,life:.12,hawk:.2,dawn:.38,hawkArm:.055,dawnArm:.09,spread:.55,dawnSpread:.8,ahead:7};
/** The SPRING TIDE's fist (signature/GiantFist): from how long after the opener it shows, how long before the finisher
 *  it is driven down, its size cocked and full (times the Taimatsu fist: 2.3 m from wrist to knuckles at one), how far its
 *  knuckles hang over the victim's head, how far toward him from over them, and how long after the blow it is gone. */
const SPRING_TIDE_FIST={from:.3,drive:.24,small:.35,big:2,over:.08,toward:.6,gone:.6,rise:.32};
/** Round 6 (GUMMY ULT): how long after the opener he springs off the floor, held (0.7-0.9 s of the move, the take's
 *  spring on the cinematic's clock): when the floor's blast goes out round him. And the fist (Round 6) is not hung
 *  over them out of nothing: it rises off the hand that has them - the grab lets go as it is blown up (gummy/spring-tide.ts
 *  SPRING_TIDE_GRAB.release, SPRING_TIDE_FIST.from) - to over their head in SPRING_TIDE_FIST.rise. */
const SPRING_TIDE_SPRING=.22;
const BLAZE:Element={spike:0xffe2a0,rim:0xff5a12,light:0xff7a2a,ink:0x1a0602};
/** His enders that are his own fists (combosVol1.ts): Maelstrom Fist (Light, Heavy) and the ground smash,
 *  Beacon Crash; in SUNRISE his five sunrise enders. Looked up once. */
const MAELSTROM=comboMove('gummy','lh'),BEACON_CRASH=comboMove('gummy','airSpecial');
const SUNRISE_ENDER={lh:comboMove('gummy','lh',true),llh:comboMove('gummy','llh',true),lllh:comboMove('gummy','lllh',true),llls:comboMove('gummy','llls',true),airHeavy:comboMove('gummy','airHeavy',true)};
/** Will's black on the giant fist (BUSO: the fist's own colours). */
const WILL_FIST:Element={spike:0xffd8c8,rim:0xc01a12,light:0xff5a3a,ink:0x0a0204};
/** Crimson Command coating the SPRING TIDE: black lightning edged in red. */
const COMMAND_CRIMSON:Element={spike:0xffe2e2,rim:0xd0102a,light:0xff2a3a,ink:0x060002};
/** SUNRISE: his white, a warm rim, and the ink of a cartoon; and the lightning he catches. */
const SUNRISE_WHITE:Element={spike:0xffffff,rim:0xffd98a,light:0xfff2d6,ink:0x120a04};
const BOLT:Element={spike:0xf2fbff,rim:0x5aa8ff,light:0x9fd0ff,ink:0x0c1426};
const BOLT_GLOW=new THREE.Color(.55,.8,1.6);
/** A deterministic 0..1 off a number: where each barrage fist lands, the same on every client. */
const hash=(x:number)=>{const v=Math.sin(x*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
const FORWARD=new THREE.Vector3(0,0,1);
const RAM_RELEASE=MOVES.kosho.special.contacts[0];
/** Kagari: the fist ignites through Taimatsu's wind-up and the fire leaves with the
 *  column. The sun of the ultimate is CombatEffects' bomb core; the corona
 *  around it and the fire it trails are drawn here off FLIGHTS. */
const TAIMATSU_RELEASE=MOVES.kagari.special.contacts[0];
/** Round 4b (FMOVES): Yuragi - the blast of fire out of both palms - lets go here; and Banquet Infernal, one take, its
 *  kicks and the blaze at the end of them (game/moves.ts). */
const YURAGI_RELEASE=MOVES.kagari.heavy.contacts[0],YURAGI_LINGER=.32;
const HELL=MOVES.kosho.ultimate;
/** Round 4b (FMOVES): the fire a thrown flame ends in, by what threw it - how big the ball it bursts into is, and how
 *  long it burns. Signal Fire's as it always was. */
const BURST={hawk:{size:1,life:.45},ram:{size:1.25,life:.5},yuragi:{size:.95,life:.42},taimatsu:{size:1.7,life:.62},kick:{size:.8,life:.34},blaze:{size:1.8,life:1}} as const;
type Fire=keyof typeof BURST;
/** The fire palette in linear light: the sun's glare, the halo round a burning
 *  fist or leg, and what a flame does to the floor and bodies near it. */
const FLAME={glare:new THREE.Color(1.6,.62,.12),halo:new THREE.Color(.9,.3,.05),light:new THREE.Color(1.25,.55,.16),ember:new THREE.Color(2.2,.9,.2),nightfall:new THREE.Color(.45,.05,.6)};

/** Fire as flames, not as cones: every tongue here is an axial flame
 *  billboard (signature/FlameSprites) whose heat runs white-yellow at the
 *  root through orange to red and a cooling smoke, placed by the same rules
 *  the instanced cones used. Around the fire: a glow over the bloom
 *  threshold, embers, and a light volume, so the burning fist, Taimatsu, Ember Leg
 *  and Kagari's sun light the floor and the fighters near them. Gummy's
 *  (round 4b): the barrage's fists, SUNRISE's clouds, the SPRING TIDE and the
 *  SUNRISE's enders. The NIGHTFALL mist is as it was; the NIGHTFALL burn is
 *  signature/Unsealed's. Bounded buffers; no allocation per frame. */
export class GummyEffects {
  private flameGeometry=flameSpriteGeometry();
  private steamGeometry=new THREE.SphereGeometry(1,10,7);
  private flameMaterial=flameSpriteMaterial();
  /** SUNRISE's clouds as manga smoke: three flat bands keyed from above,
   *  a warm white, and an ink line round every puff (a second instanced draw
   *  of the same spheres by their back faces, pushed out a constant width). */
  private steamMaterial=new THREE.ShaderMaterial({name:'SunriseSteam',toneMapped:false,
    vertexShader:'varying vec3 vN;void main(){vN=normalize(normalMatrix*mat3(instanceMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 vN;void main(){float k=dot(normalize(vN),normalize(vec3(.3,.85,.4)));vec3 c=k>.35?vec3(1.,.97,.93):k>-.2?vec3(.8,.75,.74):vec3(.56,.5,.53);gl_FragColor=vec4(c,1.);}'});
  private steamInkMaterial=new THREE.ShaderMaterial({name:'SunriseSteamInk',side:THREE.BackSide,toneMapped:false,
    vertexShader:'void main(){vec4 clip=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);vec2 d=(projectionMatrix*vec4(normalize(normalMatrix*mat3(instanceMatrix)*normal),0.)).xy;float l=length(d);if(l>1e-5)clip.xy+=d/l*.0045*clip.w;clip.z+=.0004*clip.w;gl_Position=clip;}',
    fragmentShader:'void main(){gl_FragColor=vec4(.03,.02,.03,1.);}'});
  private mistMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,uniforms:{clock:{value:0}},vertexShader:'varying vec2 uvp;void main(){uvp=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}',fragmentShader:`varying vec2 uvp;uniform float clock;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){vec2 p=uvp;float n=noise(p*4.0+vec2(clock*.7,-clock*1.3))*.65+noise(p*9.0-clock*.5)*.35;float alpha=smoothstep(.25,.7,n)*(1.0-smoothstep(.3,1.0,length(p)));gl_FragColor=vec4(mix(vec3(.01,.005,.025),vec3(.22,.12,.3),n*.4),alpha*.68);}`});
  private mistGeometry=new THREE.PlaneGeometry(1,1);
  private mist=new THREE.InstancedMesh(this.mistGeometry,this.mistMaterial,192);
  private flames=new THREE.InstancedMesh(this.flameGeometry,this.flameMaterial,768);
  private wakeGeometry=new THREE.PlaneGeometry(1,1);
  private wakeMaterial=fireTongueMaterial();
  private wake=new THREE.InstancedMesh(this.wakeGeometry,this.wakeMaterial,384);
  private steam=new THREE.InstancedMesh(this.steamGeometry,this.steamMaterial,768);
  private steamInk=new THREE.InstancedMesh(this.steamGeometry,this.steamInkMaterial,768);
  private glows=new GlowBatch(96,'fire-glow',true);
  private lights=new LightVolumes(6,'fire-light');
  private transform=new THREE.Object3D();
  private forward=new THREE.Vector3();
  private lean=new THREE.Vector3();
  private offset=new THREE.Vector3();
  private at=new THREE.Vector3();
  private color=new THREE.Color();
  private up=new THREE.Vector3(0,1,0);
  private foot=new THREE.Vector3();
  private knee=new THREE.Vector3();
  private arm=new THREE.Vector3();private aim=new THREE.Vector3();private goal=new THREE.Vector3();private shoulder=new THREE.Vector3();
  private side=new THREE.Vector3();private across=new THREE.Vector3();private tip=new THREE.Vector3();
  /** The burning fist that comes down into the floor; the Taimatsu fist's shape and fire. */
  private fistGeometry=taimatsuGeometry();
  private taimatsu=taimatsuMaterial();
  private hawkFists:THREE.Mesh[]=[];
  private hawkCount=0;
  /** The bursts: the burning fist's ball of fire where the fist comes down, and Kosho's and Kagari's (round 4b, FMOVES). */
  private bursts=Array.from({length:10},()=>({position:new THREE.Vector3(),born:-9,size:1,life:.45,column:false}));
  /** Round 4b (FMOVES): COUP DE FEU, Yuragi and Taimatsu in the air, by flight, where each was last seen and where it
   *  left the foot or the hands - so each bursts where it lands (or ends), and Yuragi's jet runs back to its palms. */
  private fires=new Map<string,{position:THREE.Vector3;from:THREE.Vector3;seen:number;born:number;kind:Fire;burst?:boolean}>();
  /** Round 4b (FMOVES): the kicks of Banquet Infernal already burst, and the palms that have flared, by fighter: the
   *  cast and contact last drawn. */
  private kicked=new Map<string,number>();private flared=new Map<string,number>();
  private burstNext=0;
  /** Round 4b (GUMMY): the SPRING TIDE's fist, and the casts whose blow has landed (once each). */
  private springTideFists:GiantFists;
  private landed=new Set<number>();
  /** Round 4b (GUMMY): the barrage's fists beyond his own two, for every Gummy at once; the last of each barrage's
   *  contacts drawn landing, by fighter; and each SUNRISE ender's blow drawn landing (once a cast). */
  private gatlingFists:GatlingFists;
  private gatlingShown=new Map<string,{cast:number;contact:number}>();
  private sunriseLanded=new Map<string,number>();
  /** Round 4b (GUMMY): SUNRISE's cloud bursts - the transformation's, and the ultimate's going into the form and out
   *  of it unawakened - by fighter: when each began (render time) and how big it is. */
  private clouds=new Map<string,{born:number;size:number;key:number;at:THREE.Vector3}>();
  /** Start a cloud burst `id` (a fighter's own, or one where a blow landed: `at`), unless that one is already going. */
  private burst(id:string,born:number,size:number,key:number,at?:THREE.Vector3){
    let cloud=this.clouds.get(id);if(cloud?.key===key)return;
    if(!cloud){cloud={born,size,key,at:new THREE.Vector3()};this.clouds.set(id,cloud);}
    cloud.born=born;cloud.size=size;cloud.key=key;if(at)cloud.at.copy(at);
  }
  private nextSteam=0;
  /** Where each Gummy's burning fist came down, and when; and the giant fists that have landed (once a swing). */
  private crashes=new Map<string,{cast:number;at:THREE.Vector3;since:number}>();
  private maelstroms=new Map<string,number>();
  /** Round 5 (GUMMY): the SPRING TIDE casts whose spring off the floor has been drawn (once a cast). */
  private sprung=new Set<number>();
  /** Round 6 (GUMMY ULT): and those whose grab has shut on them - or on the air - drawn (once a cast). */
  private gripped=new Set<number>();
  private kit:VfxKit;
  private nextPuff=0;
  constructor(scene:THREE.Scene){for(const mesh of [this.flames,this.steam,this.mist,this.wake]){mesh.count=0;mesh.setColorAt(0,new THREE.Color(0xffffff));mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);}this.flames.name='signal-fire-fire';this.steam.name='gummy-cloud';this.steamInk.instanceMatrix=this.steam.instanceMatrix;this.steamInk.count=0;this.steamInk.frustumCulled=false;this.steamInk.name='gummy-cloud-ink';scene.add(this.steamInk);this.wake.name='taimatsu-fire-wake';scene.add(this.glows.mesh,this.lights.mesh);
    for(let i=0;i<4;i++){const fist=new THREE.Mesh(this.fistGeometry,this.taimatsu);fist.name='signal-flare-orb';fist.frustumCulled=false;fist.renderOrder=3;fist.visible=i===0;if(i===0){fist.position.set(0,-50,0);fist.scale.setScalar(.001);}scene.add(fist);this.hawkFists.push(fist);}
    this.springTideFists=new GiantFists(scene,2,this.fistGeometry);this.gatlingFists=new GatlingFists(scene,this.fistGeometry,48);this.kit=VfxKit.for(scene);
    if(LUCY_TIDE)this.tide=new LucyTideFx(scene,this.kit);}
  private tide?:LucyTideFx;
  /** A burning fist this frame: palm at `at`, knuckles along `aim`. */
  private hawkFist(at:THREE.Vector3,aim:THREE.Vector3,size:number){if(this.hawkCount>=this.hawkFists.length||size<.01)return;const fist=this.hawkFists[this.hawkCount++];fist.visible=true;fist.position.copy(at);fist.quaternion.setFromUnitVectors(FORWARD,aim);fist.scale.setScalar(size);}
  /** Round 4b (FMOVES): a ball of fire thrown open at `at`, of a kind (BURST); `column` stands a pillar of it up. */
  private blaze(at:THREE.Vector3,time:number,kind:Fire,column=false){const b=this.bursts[this.burstNext];this.burstNext=(this.burstNext+1)%this.bursts.length;b.position.copy(at);b.born=time;b.size=BURST[kind].size;b.life=BURST[kind].life;b.column=column;}
  /** One flame tongue: heat 0..1 (young and hot to cooling), palette. */
  private flame(index:number,heat:number,seed:number,palette=FIRE){this.transform.updateMatrix();this.flames.setMatrixAt(index,this.transform.matrix);this.flames.setColorAt(index,this.color.setRGB(heat,seed%1,flamePalette(palette)));}
  update(time:number,fighters:ReadonlyMap<string,Fighter>,density:number){
    let flame=0,steam=0,mist=0,wake=0;this.mistMaterial.uniforms.clock.value=time;this.wakeMaterial.uniforms.uTime.value=time;this.flameMaterial.uniforms.uTime.value=time;
    this.glows.begin(time);this.lights.begin();this.springTideFists.begin(time);this.gatlingFists.begin(time);this.hawkCount=0;this.taimatsu.uniforms.uTime.value=time;
    const flicker=.85+.15*Math.sin(time*23)*Math.sin(time*9.7);
    for(const fighter of fighters.values()){
      const s=fighter.state;if(!s.alive)continue;
      if(s.fighter==='nigo'&&s.action==='ultimate'){
        // Round 3d (ULTS): the NIGHTFALL form is the cinematic's - the mist
        // as he turns into it on the confirm, and as he turns back.
        const t=s.actionTime*s.actionDuration,landed=s.confirmedAt!==undefined,open=MOVES.nigo.ultimate.contacts[0];
        const birth=t<open+.6?open+.02:s.actionDuration-.54,age=landed?t-birth:-1;
        if(age>=0&&age<.78){const strength=THREE.MathUtils.smoothstep(age,0,.14)*(1-THREE.MathUtils.smoothstep(age,.42,.78));
          for(let i=0;i<16&&mist<192;i++){const a=i*2.4+age*3,r=.28+age*.3;this.transform.position.copy(fighter.group.position).add(this.offset.set(Math.cos(a)*r,.1+(i%6)*.33+age*.45,Math.sin(a)*r));this.transform.rotation.set(0,s.yaw+(i%2)*.5,(i%3-1)*.3);this.transform.scale.set((.7+(i%3)*.13)*strength,(1.1+(i%4)*.16)*strength,1);this.transform.updateMatrix();this.mist.setMatrixAt(mist++,this.transform.matrix);}
        }
        // The NIGHTFALL burn on the target is Unsealed's now (signature/Unsealed).
        continue;
      }
      if(s.fighter==='kosho'){
        const t=s.actionTime*s.actionDuration,ultimate=s.action==='ultimate';
        // (A combo ender thrown from the special is its own kick, not COUP DE FEU: game/combos.ts.)
        if(s.action==='special'&&!s.branch||ultimate){
          // Round 3d (ULTS): Banquet Infernal' blaze is its finisher now.
          const contact=ultimate?MOVES.kosho.ultimate.contacts[MOVES.kosho.ultimate.contacts.length-1]:RAM_RELEASE;const clearContact=1-.72*THREE.MathUtils.smoothstep(t,contact-.2,contact-.08)*(1-THREE.MathUtils.smoothstep(t,contact+.12,contact+.3));
          // COUP DE FEU throws its fire: once the crescent has left the foot
          // the leg burns down rather than on to the end of the recovery.
          const thrown=ultimate?1:1-.8*THREE.MathUtils.smoothstep(t,contact,contact+.35);
          const strength=THREE.MathUtils.smoothstep(t,.1,ultimate?.65:.4)*(1-THREE.MathUtils.smoothstep(t,s.actionDuration-.55,s.actionDuration))*clearContact*thrown;
          fighter.bones.get('rightfoot')?.getWorldPosition(this.foot);fighter.bones.get('rightleg')?.getWorldPosition(this.knee);this.forward.set(Math.sin(s.yaw),0,Math.cos(s.yaw));
          this.lean.copy(this.forward).multiplyScalar(-.6).add(this.up).normalize();
          const count=Math.round((ultimate?48:30)*density);
          for(let i=0;i<count&&flame<768;i++){
            const phase=(time*2.4+i*.618)%1,a=i*2.399+time*2;
            if(ultimate&&i%3!==0)this.transform.position.copy(fighter.group.position).addScaledVector(this.forward,-.25).add(this.offset.set(Math.cos(a)*.28,.15+(i%9)*.19+phase*.3,Math.sin(a)*.28));
            else this.transform.position.copy(this.foot).lerp(this.knee,(i%7)/7).add(this.offset.set(Math.cos(a)*.085,phase*.16,Math.sin(a)*.085));
            this.transform.quaternion.setFromUnitVectors(this.up,this.lean);this.transform.scale.setScalar((1-phase)*strength*(ultimate?1.15:1.0));this.flame(flame++,1-phase*.8,i*.618);
          }
          if(strength>.02){this.at.copy(this.foot).lerp(this.knee,.4);this.glows.add(this.at,.55*strength,FLAME.halo,.45*strength*flicker,GLOW,0);this.lights.add(this.at,2.6,FLAME.light,.4*strength*flicker);}
        }
        // Round 4b (FMOVES): Ember Leg - he spins on the planted foot until the leg catches. Through COUP DE FEU's
        // wind-up the fire whirls round his feet and climbs as the spin builds, and goes with the kick.
        if(s.action==='special'&&!s.branch&&t>.04&&t<RAM_RELEASE+.08){
          const whirl=THREE.MathUtils.smoothstep(t,.04,.3)*(1-THREE.MathUtils.smoothstep(t,RAM_RELEASE-.03,RAM_RELEASE+.08));
          const count=Math.round(30*density);
          for(let i=0;i<count&&flame<768;i++){
            const phase=(time*3.1+i*.618)%1,a=i*2.399963+time*11,r=.42+.16*Math.sin(i*1.7)+phase*.12;
            this.transform.position.copy(fighter.group.position).add(this.offset.set(Math.cos(a)*r,.06+phase*(.35+.5*whirl),Math.sin(a)*r));
            this.transform.quaternion.setFromUnitVectors(this.up,this.lean.set(-Math.sin(a)*.5,1,Math.cos(a)*.5).normalize());
            this.transform.scale.setScalar((1-phase)*whirl*(.75+.35*(i%3)/2));this.flame(flame++,1-phase*.85,i*.618);
          }
          if(whirl>.02){this.at.copy(fighter.group.position);this.at.y+=.3;this.glows.add(this.at,1.1*whirl,FLAME.halo,.35*whirl*flicker,GLOW,0);this.lights.add(this.at,3.4,FLAME.light,.55*whirl*flicker);}
        }
        // Round 4b (FMOVES): Banquet Infernal, landed. Every kick of the take bursts on the body it lands on, hotter each
        // time, and the last one - the turning roundhouse - is the blaze: a ball of fire thrown open over them and a
        // pillar of it going up, the floor ringed in it.
        if(ultimate&&s.confirmedAt!==undefined){
          const drawn=beats(s,HELL);
          for(let k=1;k<drawn;k++){
            if(t<HELL.contacts[k]||t>HELL.contacts[k]+.1)continue;
            const key=Math.round(s.actionStarted*1000)*16+k;if(this.kicked.get(s.id)===key)continue;this.kicked.set(s.id,key);
            const victim=s.target?fighters.get(s.target):undefined;
            if(victim)bodyCenter(victim,this.at);else this.at.copy(fighter.group.position).addScaledVector(this.forward,1.3).addScaledVector(this.up,1.1);
            const last=k===HELL.contacts.length-1;
            this.blaze(this.at,time,last?'blaze':'kick',last);
            if(last){
              const floor=victim?victim.group.position.y:fighter.group.position.y;
              this.kit.ring(this.at.x,floor+.05,this.at.z,.6,5.2,time,.55,0xfff0c8,FLAME.ember.getHex(),.14,'flat');
              this.kit.streaks(this.at.x,this.at.y,this.at.z,BLAZE,this.kit.n(22,8),14,.04,time,this.up,.9);
              this.kit.groundImpact(this.at.x,floor,this.at.z,0,1,0,3,time,BLAZE,floor);
            }else this.kit.streaks(this.at.x,this.at.y,this.at.z,BLAZE,this.kit.n(6+k*2,3),8+k*1.5,.025,time,this.forward,.7);
          }
        }
        continue;
      }
      if(s.fighter==='kagari'){
        const t=s.actionTime*s.actionDuration;this.forward.set(Math.sin(s.yaw),0,Math.cos(s.yaw));
        // TAIMATSU: the flame gathers on the extended fist from the wind-up
        // to the release, then goes with the column (drawn below off FLIGHTS).
        if(s.action==='special'&&!s.branch&&t>.12&&t<TAIMATSU_RELEASE+.1){
          // Round 4b (FMOVES): the arm burns to the shoulder as it is drawn back, the fist hottest - a bigger fire for a
          // fist of fire the size of a man (signature: CombatEffects' flaming fist, its wake below).
          const strength=THREE.MathUtils.smoothstep(t,.08,.45)*(1-THREE.MathUtils.smoothstep(t,TAIMATSU_RELEASE-.06,TAIMATSU_RELEASE+.08));
          const count=Math.round(48*density);this.lean.copy(this.forward).multiplyScalar(-.8).add(this.up).normalize();
          bodyCenter(fighter,this.shoulder);this.shoulder.y+=.45;
          for(let i=0;i<count&&flame<768;i++){
            const phase=(time*3.4+i*.618)%1,angle=i*2.4+time*7,trail=phase*.55,along=i%4===0?(i*.37)%1:0;
            this.transform.position.copy(fighter.handR).lerp(this.shoulder,along*.8).addScaledVector(this.forward,-trail);this.transform.position.y+=Math.sin(angle)*.12+phase*.25;this.transform.position.x+=Math.cos(angle)*.12;
            this.transform.quaternion.setFromUnitVectors(this.up,this.lean);
            const size=(1-phase)*strength*(1-along*.4);this.transform.scale.setScalar(size*(i%3===0?1.6:1.15));this.flame(flame++,1-phase*.7,i*.618);
          }
          if(strength>.02){this.glows.add(fighter.handR,.9*strength,FLAME.halo,.55*strength*flicker,GLOW,0);this.lights.add(fighter.handR,4,FLAME.light,.65*strength*flicker);}
          // The punch lets it go: a ring of flame thrown off the fist, and sparks down the line.
          if(t>=TAIMATSU_RELEASE){const key=Math.round(s.actionStarted*1000)*2+1;if(this.flared.get(s.id)!==key){this.flared.set(s.id,key);
            this.kit.ring(fighter.handR.x,fighter.handR.y,fighter.handR.z,.25,2.6,time,.26,0xfff0c8,BLAZE.rim,.12,'plane',this.forward.x,0,this.forward.z);
            this.kit.streaks(fighter.handR.x,fighter.handR.y,fighter.handR.z,BLAZE,this.kit.n(16,6),13,.035,time,this.forward,.9);}}
        }
        // Round 4b (FMOVES): Yuragi - fire gathered into both palms as they are drawn back, and let go as they are
        // driven out together: a flare off the palms, and the jet of flame itself drawn off its flight below.
        if(s.action==='heavy'&&!s.branch&&t>.04&&t<YURAGI_RELEASE+.12){
          const gather=THREE.MathUtils.smoothstep(t,.04,YURAGI_RELEASE-.02)*(1-THREE.MathUtils.smoothstep(t,YURAGI_RELEASE+.02,YURAGI_RELEASE+.12));
          this.at.copy(fighter.handR).lerp(fighter.handL,.5);
          const count=Math.round(28*density);this.lean.copy(this.forward).multiplyScalar(-.5).add(this.up).normalize();
          for(let i=0;i<count&&flame<768;i++){
            const phase=(time*3.6+i*.618)%1,a=i*2.399963+time*6,hand=i%2?fighter.handR:fighter.handL;
            this.transform.position.copy(hand).add(this.offset.set(Math.cos(a)*.09,phase*.22,Math.sin(a)*.09));
            this.transform.quaternion.setFromUnitVectors(this.up,this.lean);this.transform.scale.setScalar((1-phase)*gather*1.05);this.flame(flame++,1-phase*.7,i*.618);
          }
          if(gather>.02){this.glows.add(this.at,.8*gather,FLAME.halo,.55*gather*flicker,GLOW,0);this.lights.add(this.at,3.4,FLAME.light,.65*gather*flicker);}
          if(t>=YURAGI_RELEASE){const key=Math.round(s.actionStarted*1000)*2;if(this.flared.get(s.id)!==key){this.flared.set(s.id,key);
            this.kit.ring(this.at.x,this.at.y,this.at.z,.2,2,time,.24,0xfff0c8,BLAZE.rim,.12,'plane',this.forward.x,0,this.forward.z);
            this.kit.streaks(this.at.x,this.at.y,this.at.z,BLAZE,this.kit.n(14,5),12,.03,time,this.forward,.9);}}
        }
        // The ALL ABLAZE: fire climbs the raised arm while the sun is
        // gathered over his head, and the whole body smoulders on the throw.
        if(s.action==='ultimate'&&t>.3&&t<s.actionDuration-.4){
          const gather=THREE.MathUtils.smoothstep(t,.3,1.2)*(1-THREE.MathUtils.smoothstep(t,MOVES.kagari.ultimate.contacts[0],MOVES.kagari.ultimate.contacts[0]+.4));
          const count=Math.round(40*density);
          for(let i=0;i<count&&flame<768;i++){
            const phase=(time*2.6+i*.618)%1,a=i*2.399+time*1.6;
            if(i%2===0)this.transform.position.copy(fighter.handR).add(this.offset.set(Math.cos(a)*.12,phase*.5,Math.sin(a)*.12));
            else this.transform.position.copy(fighter.group.position).add(this.offset.set(Math.cos(a)*.34,.1+(i%9)*.2+phase*.35,Math.sin(a)*.34));
            this.transform.quaternion.setFromUnitVectors(this.up,this.lean.set(Math.cos(a)*.15,1,Math.sin(a)*.15).normalize());this.transform.scale.setScalar((1-phase)*gather*(i%2===0?1.5:1));this.flame(flame++,1-phase*.75,i*.618);
          }
        }
        continue;
      }
      if(s.fighter!=='gummy')continue;
      const t=s.actionTime*s.actionDuration;this.forward.set(Math.sin(s.yaw),0,Math.cos(s.yaw));
      // His Light, Heavy is Maelstrom Fist: the giant will-black fist driven at them on its rubber arm; and his
      // ground smash, the burning fist driven down where he lands (combosVol1.ts). In SUNRISE his
      // own enders (sunriseEnder).
      if(s.action==='heavy'&&s.branch==='lh'&&!s.awakened)this.maelstromFist(fighter,t,time,fighters);
      if(s.awakened&&s.branch&&(s.action==='heavy'||s.action==='special'))this.sunriseEnder(fighter,t,time,fighters);
      flame=this.burningFist(fighter,t,time,flame,density);
      // Round 4b (GUMMY): the SUNSET BARRAGE - SUNRISE's dawn barrage awakened - his arms hardened black from the first
      // frames (Fighter.ts's will) and the room graded to the Will's crimson round him.
      if(s.action==='special'&&!s.branch){
        gradeLocal(s.id,s.actionStarted,GRADE.nightfang,.35,GATLING_MOVE.contacts[GATLING_MOVE.contacts.length-1]+.4,fighter.group.position,s.id,s.target??undefined);// round 3c: local
        this.gatling(fighter,t,time,fighters);
      }
      if(s.action==='ultimate'&&s.confirmedAt!==undefined)gradeOnce(s.id,s.actionStarted,GRADE.nightfang,.5,Math.max(.3,SPRING_TIDE+.6-t),s.id,s.target??undefined);
      // SUNRISE arriving: the transformation's burst of cloud, and - unawakened - the ultimate's, as he goes into the
      // form for the SPRING TIDE on the confirm (the base body throws the opener) and as he comes out of it.
      steam=this.sunGodClouds(fighter,t,time,steam);
      if(s.action==='ultimate'&&!this.tide)this.springTide(fighter,t,time,fighters);
    }
    // The thrown fire. CombatEffects moves the body of a projectile and
    // records where it is; the flames that make Signal Fire a burning fist and
    // COUP DE FEU a burning crescent ride it from release to impact, trailing
    // back along its heading. The burst on impact is CombatEffects' own, at
    // the point the server said the hit landed.
    for(const [flightKey,flight] of FLIGHTS){
      // Kagari's plain moves the Armory casting draws (render/vfx/armory/drawn.ts): their flights are its; the wind-ups stay here.
      // A move the Armory draws (Kagari's casting, or any Forge kit's effect on the slot) is left to it.
      if(armoryDraws(flight.fighter,flight.slot,flight.branch,flight.actorId))continue;
      // Kagari's sun: a corona of fire around the bomb core from the moment it
      // is gathered over his head, and a wake of it once thrown. The glare
      // and the light make it a sun rather than a ball with flames on it.
      if(flight.fighter==='kagari'&&flight.slot==='ultimate'){
        const age=Math.max(0,time-flight.since+MOVES.kagari.ultimate.contacts[0]);
        const grown=THREE.MathUtils.smoothstep(age,.2,1.4),count=Math.round(84*density);
        for(let i=0;i<count&&flame<768;i++){
          const phase=(time*1.9+i*.618)%1,a=i*2.399963+time*.9,b=i*1.7;
          const r=2.15*grown;
          this.forward.set(Math.cos(a)*Math.cos(b),Math.sin(b),Math.sin(a)*Math.cos(b));
          this.transform.position.copy(flight.position).addScaledVector(this.forward,r+phase*.5);
          if(flight.released)this.transform.position.addScaledVector(flight.heading,-phase*2.2*(i%3));
          this.transform.quaternion.setFromUnitVectors(this.up,this.lean.copy(this.forward).addScaledVector(this.up,.4).normalize());
          this.transform.scale.setScalar((1-phase*.6)*grown*(i%3===0?3.2:2.3));this.flame(flame++,.52-phase*.3,i*.618);
        }
        // The glare stays orange (the white is the sun's own core) and the
        // light is broad but gentle: a sun over the arena, not a flashbulb.
        // Nothing additive over the sun's face: it bleached the fire white.
        // The corona is the fire; only a faint halo lies beyond it.
        this.lights.add(flight.position,9*grown,FLAME.light,.5*grown*flicker);
        // Embers thrown off the surface, rising on the heat.
        const embers=Math.round(24*density);
        for(let i=0;i<embers;i++){const phase=(time*.7+i*.618)%1,a=i*2.399963+time*.3,b=Math.sin(i*1.9)*.9;this.at.set(Math.cos(a)*Math.cos(b),Math.sin(b),Math.sin(a)*Math.cos(b)).multiplyScalar(2.2*grown*(1.05+phase*1.1)).add(flight.position);this.at.y+=phase*1.6;this.glows.add(this.at,.07+.05*(i%3),FLAME.ember,(1-phase)*grown,GLOW,.5);}
        continue;
      }
      // A combo ender thrown as fire (game/combos.ts) flies as a flame of its own, from either slot: no Signal Fire flame,
      // no Taimatsu wake, no Ram crescent - the plain tail of fire Kosho's kick trails.
      const ender=flight.branch!==undefined;
      // Round 4b (FMOVES): Yuragi is a shot of fire now as well - the heavy's flight is its jet.
      const yuragi=flight.fighter==='kagari'&&flight.slot==='heavy'&&!ender;
      if(!flight.released||flight.slot!=='special'&&!ender&&!yuragi)continue;
      // Round 4b (GUMMY): his only thrown thing now is SUNRISE's lightning (Light x3, Special, awakened): a bolt, not fire.
      if(flight.fighter==='gummy'){this.boltFlight(flight.position,flight.heading,time,flicker);continue;}
      if(flight.fighter!=='kosho'&&flight.fighter!=='kagari')continue;
      const kagari=flight.fighter==='kagari'&&!ender&&!yuragi,ram=flight.fighter==='kosho'&&!ender;
      const age=Math.max(0,time-flight.since),count=Math.round((kagari?72:ram?56:34)*density);
      const head=Math.min(1,age/.08);
      // Round 4b (FMOVES): where each of Kosho's and Kagari's lands, to burst there (and the jet's root, its palms).
      if(ram||kagari||yuragi){
        let fire=this.fires.get(flightKey);
        if(!fire){fire={position:new THREE.Vector3(),from:flight.position.clone(),seen:time,born:time,kind:ram?'ram':kagari?'taimatsu':'yuragi'};this.fires.set(flightKey,fire);}
        fire.position.copy(flight.position);fire.seen=time;
        if(yuragi)continue; // (drawn below with the jets that have landed, which burn on a moment)
      }
      this.glows.add(flight.position,(kagari?1.5:ram?1.15:.75)*head,FLAME.halo,(kagari?.55:.45)*head*flicker,GLOW,0);
      this.lights.add(flight.position,kagari?5.5:ram?4.5:3.2,FLAME.light,(kagari?.75:.6)*head*flicker);
      if(kagari){
        // Start behind the knuckles: the wake flows from the wrist instead
        // of broad bright cones bisecting the front of the fist.
        // Round 4b (FMOVES): a column of it, longer and wider behind a bigger fist - TAIMATSU's trail back to him.
        for(let i=0;i<count&&wake<384;i++){
          const phase=(time*2.1+i*.618)%1,angle=i*2.4,spread=.2+phase*.38;
          this.transform.position.copy(flight.position).addScaledVector(flight.heading,-.75-phase*Math.min(3.4,.6+age*14));
          this.transform.position.y+=Math.sin(angle)*spread+phase*.12;
          this.transform.position.x+=Math.cos(angle)*spread*flight.heading.z;
          this.transform.position.z-=Math.cos(angle)*spread*flight.heading.x;
          this.forward.copy(flight.heading).negate().addScaledVector(this.up,.15).normalize();
          this.transform.quaternion.setFromUnitVectors(this.up,this.forward);
          this.transform.rotateY(angle);
          const taper=(1-phase*.62)*head;
          this.transform.scale.set(.52*taper,(1.1+(i%3)*.2)*taper,1);
          this.transform.updateMatrix();this.wake.setMatrixAt(wake,this.transform.matrix);
          this.color.setRGB((i*.381966)%1,0,0);this.wake.setColorAt(wake++,this.color);
        }
        continue;
      }
      this.lean.copy(flight.heading).multiplyScalar(-1).addScaledVector(this.up,.35).normalize();
      for(let i=0;i<count&&flame<768;i++){
        const phase=(time*3.4+i*.618)%1,angle=i*2.4+time*9;
        // Never longer than the way it has come: at launch the tail is short.
        // Round 4b (FMOVES): COUP DE FEU's crescent trails a wider, longer fire (it was 1.1 m and a third of a metre wide).
        const trail=phase*(ram?Math.min(2.2,.3+age*16):1.1),spread=ram?.55+phase*.3:.34+phase*.12;
        this.transform.position.copy(flight.position).addScaledVector(flight.heading,-trail);
        this.transform.position.y+=Math.sin(angle)*spread*.5+phase*.12;
        this.transform.position.x+=Math.cos(angle)*spread*flight.heading.z;this.transform.position.z-=Math.cos(angle)*spread*flight.heading.x;
        this.transform.quaternion.setFromUnitVectors(this.up,this.lean);
        const size=(1-phase*.7)*head*(ram?1.85:1.25);this.transform.scale.setScalar(size*(i%3===0?1.3:1));this.flame(flame++,1-phase*.75,i*.618);
      }
    }
    // Round 4b (FMOVES): so does a COUP DE FEU, a Taimatsu and a Yuragi - where it struck, or where it ran out.
    for(const [key,fire] of this.fires){
      const gone=time-fire.seen;
      if(gone>1e-4&&!fire.burst){fire.burst=true;const kind=BURST[fire.kind];this.blaze(fire.position,time,fire.kind);
        this.kit.streaks(fire.position.x,fire.position.y,fire.position.z,BLAZE,this.kit.n(Math.round(10+kind.size*6),4),9+kind.size*3,.03,time);
        this.kit.ring(fire.position.x,fire.position.y,fire.position.z,.3*kind.size,2.4*kind.size,time,.3,0xfff0c8,BLAZE.rim,.12);}
      // Yuragi's jet: from the palms to its head while it flies, and on from the palms to where it struck for a moment
      // after - a blast of fire, not a ball of it.
      if(fire.kind==='yuragi'){
        const head=gone<=1e-4?Math.min(1,(time-fire.born)/.06):1-THREE.MathUtils.smoothstep(gone,.05,YURAGI_LINGER);
        if(head>.01){this.aim.copy(fire.position).sub(fire.from).setY(0);if(this.aim.lengthSq()<1e-6)this.aim.set(0,0,1);this.aim.normalize();this.goal.copy(this.aim);
          this.yuragi(fire.from,fire.position,this.goal,time-fire.born,head,time,density,flicker,flame);flame=Math.min(768,flame+this.jetDrawn);}
      }
      if(gone>1e-4&&(fire.kind!=='yuragi'||gone>YURAGI_LINGER))this.fires.delete(key);
    }
    // Each a ball of fire thrown open and gone in under a second; the blaze of Banquet Infernal stands a pillar of it up.
    for(const b of this.bursts){const age=time-b.born;if(age<0||age>b.life)continue;const k=1-age/b.life,grow=age*.45/b.life;
      for(let i=0,n=Math.round((b.size>1.5?40:28)*Math.max(.6,density));i<n&&flame<768;i++){const a=i*2.399,tilt=Math.sin(i*1.7)*1.2,r=(.3+grow*6)*b.size*(.6+.4*((i*.37)%1));this.offset.set(Math.cos(a)*Math.cos(tilt),Math.sin(tilt)*.7+.3,Math.sin(a)*Math.cos(tilt));this.transform.position.copy(b.position).addScaledVector(this.offset,r);this.transform.quaternion.setFromUnitVectors(this.up,this.offset.normalize());this.transform.scale.setScalar(2.6*k*Math.sqrt(b.size));this.flame(flame++,.4+.6*k,i*.29);}
      if(b.column)for(let i=0,n=Math.round(22*Math.max(.6,density));i<n&&flame<768;i++){const phase=(time*2.2+i*.618)%1,a=i*2.399+time*3,r=(.35+.25*Math.sin(i*1.3))*b.size*.5;this.transform.position.copy(b.position).add(this.offset.set(Math.cos(a)*r,-.9+(i/n)*3.4*Math.min(1,age*4)+phase*.4,Math.sin(a)*r));this.transform.quaternion.identity();this.transform.scale.setScalar((1.8+.8*(1-i/n))*k*(1-phase*.5));this.flame(flame++,.9-phase*.5,i*.41);}
      // (The glare is a head's height across whatever the fire's size: over a body in a close shot it was the frame.)
      const glare=Math.min(1,1.25/b.size);
      this.glows.add(b.position,2.2*Math.min(b.size,1.3)*(1+grow*2),FLAME.glare,k*glare,STAR,.2,7);this.glows.add(b.position,(1.5+grow*9)*Math.min(b.size,1.3),FLAME.halo,.8*k*glare,RING,.05,3,.5);this.lights.add(b.position,7*Math.sqrt(b.size),FLAME.light,1.4*k*glare);}
    for(let i=this.hawkCount;i<this.hawkFists.length;i++)if(i||this.hawkFists[0].position.y>-40)this.hawkFists[i].visible=false;
    this.springTideFists.end();this.gatlingFists.end();
    this.tide?.update(time,fighters);
    this.mist.count=mist;this.mist.instanceMatrix.needsUpdate=true;this.flames.count=flame;this.steam.count=steam;this.steamInk.count=steam;this.flames.instanceMatrix.needsUpdate=true;this.steam.instanceMatrix.needsUpdate=true;if(this.steam.instanceColor)this.steam.instanceColor.needsUpdate=true;if(this.flames.instanceColor)this.flames.instanceColor.needsUpdate=true;
    this.wake.count=wake;this.wake.instanceMatrix.needsUpdate=true;if(this.wake.instanceColor)this.wake.instanceColor.needsUpdate=true;
    this.glows.end();this.lights.end();
  }
  /** Round 4b (FMOVES): how many flames the last jet drew. */
  private jetDrawn=0;
  /** Round 4b (FMOVES): Yuragi, the blast of fire out of both palms: a jet from where it left the hands (`from`) to its
   *  head, widening as it goes - tongues of flame that rush along it and roll off it - with the head's glare and light,
   *  and the jet thinning from its root once the palms have let it go. Writes from `slot` of the flame batch. */
  private yuragi(from:THREE.Vector3,headAt:THREE.Vector3,heading:THREE.Vector3,age:number,head:number,time:number,density:number,flicker:number,slot:number){
    this.aim.copy(headAt).sub(from);const length=this.aim.length();this.jetDrawn=0;
    if(length<1e-3)return;this.aim.divideScalar(length);
    const side=this.arm.set(heading.z,0,-heading.x),root=THREE.MathUtils.smoothstep(age,.12,.38);
    this.lean.copy(heading).multiplyScalar(-.7).addScaledVector(this.up,.6).normalize();
    for(let i=0,n=Math.round(64*density);i<n&&slot+this.jetDrawn<768;i++){
      const phase=(time*4.2+i*.618)%1,u=((i*.381966)+phase*.35)%1;
      if(u<root*.8)continue;
      const a=i*2.399963+time*7,wide=(.12+.75*u)*(.75+.45*Math.sin(i*1.3+time*5));
      this.transform.position.copy(from).addScaledVector(this.aim,u*length).addScaledVector(side,Math.cos(a)*wide*.6);this.transform.position.y+=Math.sin(a)*wide*.45+phase*.18;
      this.transform.quaternion.setFromUnitVectors(this.up,this.lean);
      this.transform.scale.setScalar((.55+1.2*u)*head*(1-phase*.55)*(i%3===0?1.25:1));this.flame(slot+this.jetDrawn++,1-phase*.6-u*.2,i*.618);
    }
    this.glows.add(headAt,1.3*head,FLAME.halo,.55*head*flicker,GLOW,0);this.lights.add(headAt,4.5,FLAME.light,.75*head*flicker);
    this.at.copy(from).addScaledVector(this.aim,length*.5);this.glows.add(this.at,1.6*head*(1-root*.6),FLAME.halo,.35*head*flicker,GLOW,0);
  }
  /** 'Maelstrom Fist': the fist blown up and hardened black, thrown out on
   *  the arm from just before the blow to the blow, flattening on it, and pulled back. The burst on the body is
   *  CombatEffects' and EmperorEffects' (the ender's decorations): this is the fist. */
  private maelstromFist(f:Fighter,t:number,time:number,fighters:ReadonlyMap<string,Fighter>){
    const s=f.state,move=MAELSTROM;if(!move)return;
    const c=move.contacts[0],from=c-.2,until=c+.3;
    if(t<from||t>until)return;
    const foe=s.target?fighters.get(s.target):undefined;
    if(foe&&foe.state.alive&&foe.group.position.distanceTo(f.group.position)<move.range+1.5)this.goal.copy(foe.group.position).addScaledVector(this.up,1.15);
    else this.goal.copy(f.group.position).addScaledVector(this.forward,move.range).addScaledVector(this.up,1.2);
    const drive=THREE.MathUtils.smoothstep(t,from,c),back=THREE.MathUtils.smoothstep(t,c+.1,until);
    const size=.62*(.45+.55*drive)*(1-.55*back);
    this.aim.copy(this.goal).sub(f.handR);if(this.aim.lengthSq()<1e-4)this.aim.copy(this.forward);this.aim.normalize();
    this.at.copy(f.handR).lerp(this.offset.copy(this.goal).addScaledVector(this.aim,-size*.7),drive*(1-back*.85));
    bodyCenter(f,this.shoulder);this.shoulder.y+=.45;
    this.springTideFists.show(s.id,this.at,this.aim,size,this.shoulder,t>=c?1-THREE.MathUtils.smoothstep(t,c+.02,c+.22):0);
    this.lights.add(this.at,2+size*2,FLAME.light,.35+.4*drive);
    const key=Math.round(s.actionStarted*1000);
    if(t>=c&&this.maelstroms.get(s.id)!==key){this.maelstroms.set(s.id,key);this.kit.ring(this.goal.x,this.goal.y,this.goal.z,.4,3.4,time,.3,0xffffff,WILL_FIST.rim,.12,'plane',this.aim.x,0,this.aim.z);this.kit.streaks(this.goal.x,this.goal.y,this.goal.z,WILL_FIST,this.kit.n(14,5),13,.035,time,this.aim,.9);}
  }
  /** 'Beacon Crash': where his feet come down, the burning fist comes down after them out of the air into the floor,
   *  and bursts there - a ball of fire thrown open. */
  private burningFist(f:Fighter,t:number,time:number,flame:number,density:number){
    const s=f.state,move=BEACON_CRASH;
    let held=this.crashes.get(s.id);
    if(move&&s.action==='special'&&s.branch==='airSpecial'&&s.grounded&&t>=move.contacts[0]){
      const cast=s.actionSeq??Math.round(s.actionStarted*10);
      if(!held||held.cast!==cast){
        held=held??{cast,at:new THREE.Vector3(),since:time};held.cast=cast;held.since=time;held.at.copy(f.group.position).addScaledVector(this.forward,.6);this.crashes.set(s.id,held);
        this.blaze(this.at.copy(held.at).addScaledVector(this.up,.5),time+.1,'hawk');
      }
    }
    if(!held)return flame;
    const age=time-held.since;if(age<0||age>.32)return flame;
    // Down out of the air over a tenth of a second, then pressed into the floor as it bursts.
    const fall=THREE.MathUtils.smoothstep(age,0,.1),fade=1-THREE.MathUtils.smoothstep(age,.18,.32);
    this.at.copy(held.at).addScaledVector(this.up,2.6-2.1*fall);this.aim.set(0,-1,0);
    this.hawkFist(this.at,this.aim,.9*fade);
    this.glows.add(this.at,1.6*fade,FLAME.halo,.6*fade,GLOW,.0001);this.lights.add(this.at,6,FLAME.light,1.2*fade);
    for(let i=0,n=Math.round(24*density);i<n&&flame<768;i++){const phase=(time*3.4+i*.618)%1,a=i*2.4+time*9;this.transform.position.copy(this.at).add(this.offset.set(Math.cos(a)*.45,.4+phase*.9,Math.sin(a)*.45));this.transform.quaternion.identity();this.transform.scale.setScalar((1-phase*.7)*fade*2);this.flame(flame++,1-phase*.75,i*.618);}
    return flame;
  }
  /** Round 4b (GUMMY): Spring Tide, from the confirm. SUNRISE springs into the sky (his own take: Fighter.ts
   *  ULTIMATE_CLIPS) and the fist he hangs from it is blown up over the held victim - knuckles down, Crimson Command's black
   *  lightning cracking off it, bigger than the room - then brought straight down on them at the finisher, squashing
   *  on the blow with a burst the whole floor feels, a cartoon's impact frame and a ring of cloud, and let go. */
  private springTide(f:Fighter,t:number,time:number,fighters:ReadonlyMap<string,Fighter>){
    const s=f.state;
    // Round 6 (GUMMY ULT): the opener is SUNRISE's grab (gummy/spring-tide.ts; Fighter.ts stretches the arm). Where it has
    // them, a snap of white round the hand shut on them - the arm's line through it - and ink thrown off it; where it
    // closed on the air, a puff there as it lets go. Then, held, the blast off the floor as he springs from the crouch
    // (Round 5 had it on the opener, the crouch's own blow): a flat ring of white, a ring of cloud and dust thrown out
    // round him and a burst of SUNRISE's cloud.
    const cast=Math.round(s.actionStarted*1000)+7,local=involvesLocal(s.id,s.target??undefined);
    const victim=s.target?fighters.get(s.target):undefined;
    if(t>=SPRING_TIDE_OPEN&&t<SPRING_TIDE_OPEN+.5&&(s.confirmedAt!==undefined||s.whiffedAt!==undefined)&&!this.gripped.has(cast)){
      this.gripped.add(cast);if(this.gripped.size>32)this.gripped.delete(this.gripped.values().next().value!);
      const hand=f.handR;
      bodyCenter(f,this.shoulder);this.aim.subVectors(hand,this.shoulder);if(this.aim.lengthSq()<1e-6)this.aim.copy(this.forward);this.aim.normalize();
      if(s.confirmedAt!==undefined&&victim){
        bodyCenter(victim,this.at);this.at.lerp(hand,.5);
        this.kit.ring(this.at.x,this.at.y,this.at.z,.15,1.7,time,.24,0xffffff,SUNRISE_WHITE.rim,.1,'plane',this.aim.x,this.aim.y,this.aim.z);
        this.kit.streaks(this.at.x,this.at.y,this.at.z,SUNRISE_WHITE,this.kit.n(12,4),11,.03,time,this.aim,.85);
        if(local)SIGNATURE.screen?.speedLines?.(.7);
      }else this.kit.puff(hand.x,hand.y,hand.z,-this.aim.x*1.2,.4,-this.aim.z*1.2,.5,time,.25,.45);
    }
    if(s.confirmedAt===undefined)return;
    if(t>=SPRING_TIDE_OPEN+SPRING_TIDE_SPRING&&t<SPRING_TIDE_OPEN+SPRING_TIDE_SPRING+.5&&!this.sprung.has(cast)){
      this.sprung.add(cast);if(this.sprung.size>32)this.sprung.delete(this.sprung.values().next().value!);
      const p=f.group.position,born=time-(t-SPRING_TIDE_OPEN-SPRING_TIDE_SPRING);
      this.kit.ring(p.x,p.y+.05,p.z,.5,3,born,.42,0xffffff,SUNRISE_WHITE.rim,.16,'flat');
      this.kit.ring(p.x,p.y+.9,p.z,.4,2.2,born,.3,0xffffff,SUNRISE_WHITE.rim,.1);
      this.kit.dustRing(p.x,p.y,p.z,22,1.4,7,1.2,born,.9);
      this.goal.copy(p);this.burst(s.id+':spring-tide',born,1.2,cast,this.goal);
      if(local)SIGNATURE.screen?.speedLines?.(.6);
    }
    const from=SPRING_TIDE_OPEN+SPRING_TIDE_FIST.from,drive=SPRING_TIDE-SPRING_TIDE_FIST.drive,after=t-SPRING_TIDE;
    if(t<from||after>SPRING_TIDE_FIST.gone)return;
    const foe=victim;
    if(foe)this.goal.copy(foe.group.position);else this.goal.copy(f.group.position).addScaledVector(this.forward,2.6);
    // A little toward him: the fist looms between the two of them, in the shot that frames them both.
    this.tip.subVectors(f.group.position,this.goal);this.tip.y=0;const apart=this.tip.length();
    if(apart>.05)this.goal.addScaledVector(this.tip,Math.min(SPRING_TIDE_FIST.toward,apart*.4)/apart);
    const floor=this.goal.y,push=Math.pow(THREE.MathUtils.clamp((t-drive)/SPRING_TIDE_FIST.drive,0,1),2);
    const inflate=THREE.MathUtils.smoothstep(t,from,drive-.05),throb=1+.04*Math.sin(t*9.5)*(1-push);
    const size=(SPRING_TIDE_FIST.small+(SPRING_TIDE_FIST.big-SPRING_TIDE_FIST.small)*inflate)*throb*(after>.12?1-THREE.MathUtils.smoothstep(after,.12,SPRING_TIDE_FIST.gone)*.85:1);
    // Knuckles down over the victim, leaning away from him while it is blown up - its bulk over the shot that frames
    // them past him, at the top of it - hung just over their head; straightened as it is driven down through them to
    // the floor, so it falls on them rather than sweeping across the lens.
    this.aim.set(-this.tip.x,0,-this.tip.z);if(this.aim.lengthSq()<1e-6)this.aim.copy(this.forward);this.aim.normalize().multiplyScalar(.5*(1-(after>=0?1:push))).add(this.side.set(0,-.86,0)).normalize();
    const crown=floor+1.9*(foe?.state.size??1),knuckles=.82*size,hung=crown+SPRING_TIDE_FIST.over,struck=floor+.45;
    // Round 6 (GUMMY ULT): risen off the grip, at their middle, to over their head.
    const risen=THREE.MathUtils.smoothstep(t,from,from+SPRING_TIDE_FIST.rise),gripAt=floor+1.1*(foe?.state.size??1);
    this.offset.set(this.goal.x,gripAt+(hung-gripAt)*risen+(struck-hung)*(after>=0?1:push),this.goal.z);
    // Lifted off again as it lets go.
    if(after>.12)this.offset.y+=THREE.MathUtils.smoothstep(after,.12,SPRING_TIDE_FIST.gone)*2.5;
    this.at.copy(this.offset).addScaledVector(this.aim,-knuckles);
    bodyCenter(f,this.shoulder);this.shoulder.y+=.45;
    const squash=after>=0?1-THREE.MathUtils.smoothstep(after,.06,.32):0;
    this.springTideFists.show(s.id,this.at,this.aim,size,this.shoulder,squash);
    this.lights.add(this.at,4+size*2,FLAME.light,.4+.6*push);
    const mine=involvesLocal(s.id,s.target??undefined);
    // Crimson Command coating it: black lightning edged in red, off its knuckles and its back.
    if(after<0&&Math.floor(time*24)!==Math.floor((time-.017)*24)){
      this.tip.copy(this.at).addScaledVector(this.aim,knuckles);
      this.offset.copy(this.at).addScaledVector(this.aim,-size*1.1);
      this.kit.crackle(this.offset,this.tip,size*.62,COMMAND_CRIMSON,this.kit.n(5,2),time);
    }
    if(push>0&&after<0&&mine)SIGNATURE.screen?.speedLines?.(1);
    const key=Math.round(s.actionStarted*1000);
    if(after>=0&&!this.landed.has(key)){this.landed.add(key);if(this.landed.size>32)this.landed.delete(this.landed.values().next().value!);
      this.kit.groundImpact(this.goal.x,floor,this.goal.z,0,1,0,3,time,WILL_FIST,floor);
      this.kit.ring(this.goal.x,floor+.06,this.goal.z,.8,9,time,.55,0xffffff,COMMAND_CRIMSON.rim,.14,'flat');
      this.kit.ring(this.goal.x,floor+1.1,this.goal.z,.6,7,time,.42,0xffffff,WILL_FIST.rim,.1);
      this.kit.dustRing(this.goal.x,floor,this.goal.z,30,2.2,8,1.5,time,1.1);
      this.kit.streaks(this.goal.x,floor+.6,this.goal.z,COMMAND_CRIMSON,this.kit.n(26,8),16,.05,time,this.up,.9);
      // SUNRISE's cartoon: a ring of cloud thrown out round the blow.
      this.burst(s.id+':spring-tide',time,2.4,key,this.goal);
      if(mine){SIGNATURE.screen?.impactFrame?.(1);SIGNATURE.screen?.chromaticPulse?.(1);}}
    if(after>=0&&after<.32){const k=1-after/.32;this.tip.set(this.goal.x,floor+1,this.goal.z);this.glows.add(this.tip,3*(1+after*3),FLAME.glare,k,STAR,.22,11);this.glows.add(this.tip,2.4+after*16,FLAME.halo,.8*k,RING,.05,5,.55);this.lights.add(this.tip,9,FLAME.light,1.6*k);}
  }
  /** Round 4b (GUMMY): the SUNSET BARRAGE - and SUNRISE's dawn barrage, the same barrage with his fists blown up. Fists
   *  pour down the line at the body it is for, GATLING_PHANTOM.rate a second from alternate shoulders, each out on its
   *  rubber arm to somewhere over that body, a beat there, and snapped back (the two his own arms throw on the
   *  contacts are Fighter.ts's GATLING); each contact a puff of ink where the fists land, the frame's speed lines for
   *  whoever it involves, and the last a blow of its own. Where each fist lands is hashed off the cast, so every
   *  client draws the same barrage. */
  private gatling(f:Fighter,t:number,time:number,fighters:ReadonlyMap<string,Fighter>){
    const s=f.state,c=GATLING_MOVE.contacts,first=c[0],last=c[c.length-1],P=GATLING_PHANTOM;
    if(t<first-P.lead||t>last+P.life)return;
    const dawn=!!s.awakened,size=dawn?P.dawn:P.hawk,thick=dawn?P.dawnArm:P.hawkArm,spread=dawn?P.dawnSpread:P.spread;
    const foe=s.target?fighters.get(s.target):undefined,aimed=!!foe&&foe.state.alive&&foe.group.position.distanceTo(f.group.position)<GATLING_MOVE.range+1;
    if(aimed)bodyCenter(foe!,this.goal);else this.goal.copy(f.group.position).addScaledVector(this.forward,P.ahead).addScaledVector(this.up,1.15);
    bodyCenter(f,this.shoulder);this.shoulder.y+=.4;
    this.aim.subVectors(this.goal,this.shoulder);const span=this.aim.length();if(span<.3)return;this.aim.divideScalar(span);
    this.side.crossVectors(this.aim,this.up);if(this.side.lengthSq()<1e-6)this.side.set(1,0,0);this.side.normalize();
    this.across.crossVectors(this.side,this.aim).normalize();
    // Every fist alive now: those born within a fist's life of now, the last a beat before the ninth contact (that one
    // is his own arm's, and lands alone).
    const start=first-P.lead,stop=last-.03,seed=(Math.round(s.actionStarted*997)%9973)*.731;
    const k0=Math.max(0,Math.ceil((t-P.life-start)*P.rate)),k1=Math.floor((Math.min(t,stop)-start)*P.rate);
    for(let k=k0;k<=k1;k++){
      const born=start+k/P.rate,p=(t-born)/P.life;if(p<0||p>1)continue;
      const r1=hash(seed+k*3.17),r2=hash(seed+k*7.73),r3=hash(seed+k*13.39),side=k%2===0?1:-1;
      // Out on an ease-out, a beat on the body, back on an ease-in.
      const reach=p<.42?1-Math.pow(1-p/.42,3):p<.56?1:1-THREE.MathUtils.smoothstep(p,.56,1);
      this.at.copy(this.shoulder).addScaledVector(this.side,side*.2).addScaledVector(this.across,(r3-.5)*.14);
      this.offset.copy(this.goal).addScaledVector(this.side,(r1*2-1)*spread).addScaledVector(this.across,(r2*2-1)*spread*.8).addScaledVector(this.aim,-(dawn?.42:.22));
      this.tip.lerpVectors(this.at,this.offset,reach);
      this.gatlingFists.add(this.at,this.tip,size*(.85+.3*r2),thick,.25+.35*reach);
    }
    // The contacts landing: a puff of ink and dust over the body each time, and the last one a blow.
    const cast=Math.round(s.actionStarted*1000);let shown=this.gatlingShown.get(s.id);
    if(!shown||shown.cast!==cast){shown={cast,contact:-1};this.gatlingShown.set(s.id,shown);}
    const mine=involvesLocal(s.id,s.target??undefined);
    while(shown.contact+1<c.length&&t>=c[shown.contact+1]){
      const i=++shown.contact,final=i===c.length-1;
      if(!aimed)continue;
      this.offset.copy(this.goal).addScaledVector(this.aim,-.3);
      this.kit.ring(this.offset.x,this.offset.y,this.offset.z,.12,final?2.6:dawn?1.4:.9,time,final?.32:.16,0xffffff,WILL_FIST.rim,.1,'plane',this.aim.x,this.aim.y,this.aim.z);
      if(final){this.kit.streaks(this.offset.x,this.offset.y,this.offset.z,WILL_FIST,this.kit.n(14,5),13,.035,time,this.aim,.9);if(mine)SIGNATURE.screen?.impactFrame?.(.6);}
      else this.kit.puff(this.offset.x,this.offset.y,this.offset.z,this.aim.x*1.5,.5,this.aim.z*1.5,dawn?.75:.5,time,.25,.5);
    }
    if(t>=first-P.lead&&t<last&&mine)SIGNATURE.screen?.speedLines?.(.55);
  }
  /** Round 4b (GUMMY): SUNRISE arriving in a burst of cartoon cloud - the transformation's on its swap, and, unawakened,
   *  the ultimate's going into the form on the confirm and coming out of it - and the ring of cloud the SPRING TIDE
   *  throws out where it lands. A ring of puffs bursting out round his middle, a second higher and slower, and a
   *  column going up; white in three flat tones with an ink line (the steam material). Returns the puffs drawn. */
  private sunGodClouds(f:Fighter,t:number,time:number,steam:number){
    const s=f.state;
    let key=-1,size=0,at=0;
    if(s.action==='awaken'){key=Math.round(s.actionStarted*1000);size=1;at=awakeningSwapAt('gummy');}
    // Round 5 (GUMMY): unawakened, he goes into the form on the SPRING TIDE's first frame (gummy/spring-tide.ts) - the burst
    // covers the swap - and comes out of it at the end, a whiff's too.
    else if(s.action==='ultimate'&&!s.awakened&&!this.tide){
      const out=springTideOut(s,WHIFF_RECOVERY);
      if(t<out-.06){key=Math.round(s.actionStarted*1000)+1;size=.85;at=Math.max(0,SPRING_TIDE_TAKE.swap-.04);}else{key=Math.round(s.actionStarted*1000)+2;size=.6;at=out-.06;}
    }
    if(key>=0&&t>=at)this.burst(s.id,time-(t-at),size,key);
    for(const id of [s.id,s.id+':spring-tide']){
      const cloud=this.clouds.get(id);if(!cloud)continue;
      const own=id===s.id,age=time-cloud.born,life=own?1.1:1;if(age<0)continue;if(age>life){this.clouds.delete(id);continue;}
      const envelope=THREE.MathUtils.smoothstep(age,0,.08)*(1-THREE.MathUtils.smoothstep(age,life*.4,life)),k=cloud.size;
      const grow=1-Math.pow(1-Math.min(1,age/(life*.75)),2);
      if(own)this.offset.copy(f.group.position);else this.offset.copy(cloud.at);
      // Cartoon clouds: each a big puff with three smaller ones round it, a ring of them bursting out low round him
      // and, for the transformation, three more going up over his head.
      const ring=own?(k>=1?7:5):9,rising=own&&k>=1?3:0;
      for(let c=0;c<ring+rising&&steam<764;c++){
        const up=c>=ring,a=up?c*2.1:c/ring*Math.PI*2+hash(c+k)*.5;
        const r=up?.3:.45+grow*(own?1.7:4.2)*Math.min(1.3,k);
        const y=up?1.55+grow*1.3+(c-ring)*.2:(own?.35:.22)+grow*(own?.6:.35);
        const size=(.2+.08*hash(c*1.7+k))*envelope*Math.sqrt(k)*(up?.85:1);
        this.tip.set(Math.cos(a)*r,y,Math.sin(a)*r).add(this.offset);this.side.set(-Math.sin(a),0,Math.cos(a));
        for(let lobe=0;lobe<4;lobe++){
          const side=lobe===1?1:lobe===2?-1:0,top=lobe===3?1:0;
          this.transform.position.copy(this.tip).addScaledVector(this.side,side*size*.9).addScaledVector(this.up,(side?.15:top*.55)*size);
          this.transform.quaternion.identity();this.transform.scale.setScalar(size*(lobe===0?1:.68));
          this.transform.updateMatrix();this.steam.setMatrixAt(steam,this.transform.matrix);this.steam.setColorAt(steam++,this.color.set(0xffffff));
        }
      }
    }
    return steam;
  }
  /** Round 4b (GUMMY): SUNRISE's enders (combosVol1.ts awakened): the rocket's cloud trail and the burst where he
   *  lands on them, the whip's arc, the giant stamp shaking the floor, the lightning caught crackling in his
   *  hand before it is thrown (its flight is boltFlight's) and the floor thrown up round the burrowing fist. */
  private sunriseEnder(f:Fighter,t:number,time:number,fighters:ReadonlyMap<string,Fighter>){
    const s=f.state,key=s.branch as keyof typeof SUNRISE_ENDER,move=SUNRISE_ENDER[key];if(!move)return;
    const c=move.contacts[0],cast=s.actionSeq??Math.round(s.actionStarted*10);
    const foe=s.target?fighters.get(s.target):undefined;
    if(foe&&foe.state.alive&&foe.group.position.distanceTo(f.group.position)<4)bodyCenter(foe,this.goal);
    else this.goal.copy(f.group.position).addScaledVector(this.forward,1.4).addScaledVector(this.up,1.05);
    if(key==='lh'&&t<c+.05&&time>=this.nextSteam){this.nextSteam=time+.035;bodyCenter(f,this.at);
      this.kit.smoke(this.at.x-this.forward.x*.5,this.at.y-.2,this.at.z-this.forward.z*.5,-this.forward.x*1.5,.4,-this.forward.z*1.5,.9,time,.45,0xffffff,0xd8dcf0);}
    if(key==='llls'&&t>.05&&t<c+.04){
      this.tip.copy(f.handR).addScaledVector(this.up,.9);
      if(Math.floor(time*40)!==Math.floor((time-.017)*40))this.kit.crackle(f.handR,this.tip,.1,BOLT,this.kit.n(3,1),time);
      this.glows.add(f.handR,.7,BOLT_GLOW,.6,GLOW,0);this.lights.add(f.handR,3,BOLT_GLOW,.6);
    }
    if(t<c||this.sunriseLanded.get(s.id)===cast)return;
    this.sunriseLanded.set(s.id,cast);
    const floor=f.group.position.y;
    if(key==='lh'){
      this.kit.ring(this.goal.x,this.goal.y,this.goal.z,.3,3,time,.3,0xffffff,SUNRISE_WHITE.rim,.12,'plane',this.forward.x,0,this.forward.z);
      this.kit.streaks(this.goal.x,this.goal.y,this.goal.z,SUNRISE_WHITE,this.kit.n(12,4),12,.03,time,this.forward,.9);
      this.burst(s.id+':spring-tide',time,.7,cast,this.goal);
    }else if(key==='llh'){
      this.kit.ring(this.goal.x,this.goal.y,this.goal.z,.3,2.6,time,.28,0xffffff,SUNRISE_WHITE.rim,.12);
      this.kit.streaks(this.goal.x,this.goal.y,this.goal.z,SUNRISE_WHITE,this.kit.n(12,4),11,.03,time,this.up,.7);
    }else if(key==='lllh'){
      this.kit.groundImpact(this.goal.x,floor,this.goal.z,0,1,0,3,time,SUNRISE_WHITE,floor);
      this.kit.ring(this.goal.x,floor+.06,this.goal.z,.6,5,time,.45,0xffffff,SUNRISE_WHITE.rim,.14,'flat');
    }else if(key==='airHeavy'){
      this.kit.groundImpact(this.goal.x,floor,this.goal.z,0,1,0,3,time,SUNRISE_WHITE,floor);
      this.kit.debris.burst(this.kit.n(14,4),this.goal.x,floor,this.goal.z,0,1,0,8,.95,.14,floor,2.6);
      this.kit.ring(this.goal.x,floor+.06,this.goal.z,.5,4.2,time,.4,0xffffff,SUNRISE_WHITE.rim,.14,'flat');
    }
  }
  /** Round 4b (GUMMY): SUNRISE's lightning in flight (Thunderhead Hurl, thrown): a spear of it crackling white-blue
   *  along its line, its glow and its light. */
  private boltFlight(at:THREE.Vector3,heading:THREE.Vector3,time:number,flicker:number){
    this.tip.copy(at).addScaledVector(heading,-1.5);
    if(Math.floor(time*60)%2===0)this.kit.crackle(this.tip,at,.09,BOLT,this.kit.n(4,2),time);
    this.glows.add(at,1,BOLT_GLOW,.7*flicker,GLOW,0);this.lights.add(at,4,BOLT_GLOW,.8*flicker);
  }
  reset(){this.crashes.clear();this.maelstroms.clear();this.fires.clear();this.kicked.clear();this.flared.clear();this.flames.count=0;this.steam.count=0;this.steamInk.count=0;this.mist.count=0;this.wake.count=0;this.springTideFists.reset();this.gatlingFists.reset();this.gatlingShown.clear();this.sunriseLanded.clear();this.clouds.clear();this.landed.clear();this.sprung.clear();this.gripped.clear();for(const b of this.bursts)b.born=-9;for(let i=1;i<this.hawkFists.length;i++)this.hawkFists[i].visible=false;this.glows.begin(0);this.glows.end();this.lights.begin();this.lights.end();this.tide?.reset();}
  dispose(){for(const m of [this.flames,this.steam,this.mist,this.wake]){m.removeFromParent();m.dispose();}this.mistGeometry.dispose();this.mistMaterial.dispose();this.flameGeometry.dispose();this.steamGeometry.dispose();this.flameMaterial.dispose();this.steamMaterial.dispose();this.steamInkMaterial.dispose();this.steamInk.removeFromParent();this.steamInk.dispose();this.wakeGeometry.dispose();this.wakeMaterial.dispose();this.glows.dispose();this.lights.dispose();this.springTideFists.dispose();this.gatlingFists.dispose();for(const f of this.hawkFists)f.removeFromParent();this.fistGeometry.dispose();this.taimatsu.dispose();this.tide?.dispose();}
}
