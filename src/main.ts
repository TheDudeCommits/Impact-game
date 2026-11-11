import './engine/packs/boot';
import { keepSkill } from './boot/skill';
import './originals/launch';
import {BALL_ARENAS,type BallArenaId} from './game/ball/arenas';
import {ballArenaFor,setBallArena} from './render/ball/arenaChoice';
import {setCommentary} from './audio/ballCaller';
import {errorReports,lossDetails,reportStartFailure} from './boot/errorReports';
// In Player Two's player, a join link's room or party goes into the address before anything reads it (boot/playerTwoJoin.ts).
import './boot/playerTwoJoin';
import {activePack,activePackRoster,packHas,packRefuses} from './engine/packs/active';
import { laboratoryFighter, laboratoryOutfit, isLaboratoryPreviewFighter } from './fighterLab';
import {LocalRift} from './game/moba/LocalRift';
import {LocalBall} from './game/ball/LocalBall';
import {ballOf,ballAssist,BALL_ID} from './game/ball/model';
import {BallTargets} from './game/ball/BallTargets';
import {BallField} from './render/ball/BallField';
import {ownShot} from './render/ball/ownShot';
import {quietCounts} from './render/ball/BallMoments';
import {applyKicks,clearKicks} from './render/ball/kickLayer';
import {GOAL_LOOK_NAME,PassMark,footballWanted,goalLookChoice,switchGoalLook} from './render/ball/footballPage';
import {BallReplayer} from './render/ball/BallReplay';
import {BallCam,ballShadowFocus,teamOf} from './render/ball/BallCam';
import {BallMoments} from './render/ball/BallMoments';
import {SpikeCam} from './render/ball/SpikeCam';
import {SpikeCues,type SpikeCueTick} from './render/ball/SpikeCues';
import {BallChase,type ChaseFrame} from './render/ball/BallChase';
import {askBallCams,askTeamTrim,chaseCamChoice,netSheer,spikeCamChoice,superCamChoice} from './render/ball/ballCamChoice';
import {SuperRide} from './render/ball/superRide';
import {TeamTrimmer} from './render/ball/TeamTrim';
import {StanceMarks} from './render/ball/StanceMarks';
import {StanceControl,hasStances} from './game/ball/stance';
import {ballMovesReady,ballMovesWanted,installBallMoves,noteBallStick} from './render/ball/ballMoves';
import {volleyballWanted} from './game/ball/volley';
import {BallCeremony} from './render/ball/BallCeremony';
import {BallShow} from './ui/ball/BallShow';
import {QuickChat} from './ui/ball/QuickChat';
import {BallUI} from './ui/ball/BallUI';
import type {BallMutator} from './game/ball/mutators';
import type {BotLevel} from './game/ball/BallBrain';
import type {DrillId} from './game/ball/drills';
import {myBallLook} from './ui/ball/myLook';
import {RiftTargets} from './game/moba/RiftTargets';
import {RiftAssets} from './game/moba/RiftAssets';
import {RiftPredictionTargets} from './game/moba/RiftPredictionTargets';
import {riftOf,RIFT_RULES} from './game/moba/model';
import {RiftField} from './render/moba/RiftField';
import {faceLens} from './render/lenses';
import {RiftWarUI} from './ui/moba/RiftWarUI';
// First: the deployed files' versions, for the browser to keep them between visits (loading/assetVersions.ts); then
// every model loader decodes the deployed, compressed models (render/meshopt.ts).
import {refreshAssetVersions} from './loading/assetVersions';
// A tab open across a release reloads onto the new build, once, instead of failing on the old one's chunks (loading/staleBuild.ts).
import {beforeStart,recover,restoreSelection,watchMatch} from './loading/staleBuild';
import {modePrefs,namedPlaceFor,saveModePrefs} from './ui/modes/prefs';
import {SwapLedger,SWAP_LAB,swapMemory,swapSideOf,type SwapSide} from './ui/hud/trainingSwap';
import {swapPicker} from './ui/hud/TrainingSwapPicker';
import {loneNotice,loneQueue} from './ui/modes/loneQueue';
import {askRoomAgain} from './ui/social/roomAgain';
import {mountSocialPlay} from './ui/social/socialPlay';
import {pageWhere,queueAccess,queueModeOf,queueWatch,standby} from './social/standby';
import {ObjectiveAudio} from './audio/ObjectiveAudio';
import {RiftAudio} from './audio/RiftAudio';
import './render/meshopt';
import {textureSharing} from './render/sharedTextures';
import {CAREER_MODES,CareerTracker,type CareerMode} from './game/social/career';
import {setActivity as playerTwoPresence} from './social/presence';
import {inkSelectController} from './ui/inkSelect';
import {CareerUI} from './ui/social/CareerUI';
import {PartyClient} from './social/PartyClient';
import {PartyUI} from './ui/social/PartyUI';
import {assetSignature} from './game/social/assets';
import './ui/social/social.css';
import {objectiveOf} from './game/objectives/model';
import {LocalObjective} from './game/objectives/LocalObjective';
import {villageCollision} from './game/objectives/villageStructures';
import {ObjectiveField} from './ui/objectives/ObjectiveField';
import { Startup } from './loading/Startup';
import { backgroundRoster as backgroundRosterPolicy, readSignals, thinLine } from './loading/backgroundPolicy';
import { BugReport } from './ui/BugReport';
import './ui/homeTools.css';
import { HOME_VOICES, HOME_VOICE_SECONDS, HomeVoice } from './audio/HomeVoice';
// The interface type (Barlow, Barlow Condensed) from the site itself, before the stylesheets that set it (ui/fonts.css says why).
import './ui/fonts.css';
import './ui/style.css';
import './ui/manga.css';
import './ui/lockCombat.css';
import './ui/combat-hud.css';
import './ui/approved-hud.css';
import './ui/home.css';
import './ui/survival.css';
import './ui/controller.css';
import './ui/coop.css';
import './ui/rift.css';
import * as THREE from 'three';
import {FIGHTERS,loadSettings} from './config';
import {setVfxLevel} from './render/vfxLevel';
import {Input} from './input';
import {pulseFor} from './input/rumble';
import {INPUT_HZ} from './game/catchUp';
import {InputClock} from './game/inputClock';
import {FrameGate,frameSteps} from './render/frameClock';
import {DUEL_STAGE,LocalDuel} from './game/duel/LocalDuel';
import {Couch,plannedSeats,type CouchKind} from './couch/couch';
import {movementMaskOfSeat} from './couch/seats';
import {CouchHud} from './couch/CouchHud';
import {ViewState} from './couch/viewState';
import {SECOND} from './game/couchSeat';
import {lockCombatFor,lockCombatOn,lockPreview} from './game/lockMode';
import {duelStage} from './originals/launch';
DUEL_STAGE.id=duelStage(DUEL_STAGE.id);
import {LocalRoyale} from './game/LocalRoyale';
import {MatchBell} from './game/matchBell';
import {Network,LocalTraining,type NetworkAccess,type CouchStart} from './network';
import {GuidedFightRun} from './tutorial/GuidedFightRun';
import {LearnToPlay} from './ui/ball/LearnToPlay';
import {modeOfSnapshot,type ModeId} from './ui/modes/catalogue';
import {DamageNumbers} from './ui/DamageNumbers';
import {MangaImpact} from './ui/MangaImpact';
import {UI_SFX} from './originals/sfx';
import {BallAudio,ballSfxUrl,nextContact} from './audio/ballAudio'; // the ball modes' own sound
import {castMove} from './render/ThreatOutline'; // (the move a cast in progress throws, for the ball's sound)
import {MusicPanel} from './ui/MusicPanel';
import {Hud} from './ui/Hud';
import {Finale,FinaleSkip,finaleMine,finaleStateOf,finaleWinner} from './ui/results/finale';
import {GameRenderer} from './render/GameRenderer';
import {ArenaEnvironment} from './render/ArenaEnvironment';
import {StageEnvironment} from './render/StageEnvironment';
import {preloadRiftAssets} from './render/rift/RiftStage';
import {isRiftStage} from './game/riftLayouts';
import {STAGES,type StageId} from './game/stages';
import {FighterLibrary,Fighter} from './render/Fighter';
import {FollowCamera,hitTier} from './render/FollowCamera';
import type {CastEffects} from './render/castEffects';
import {lazyCode,prefetchAtIdle} from './loading/lazyCode';
import {SIGNATURE} from './render/signature/context';
import {AwakeningEffects} from './render/AwakeningEffects';
import { ClashEffects } from './render/ClashEffects';
import {CombatEffects,screenWorth} from './render/CombatEffects';
import {AreaTelegraph,areaMoveOf,areaReady,sealTextOf} from './render/AreaTelegraph';
import {prefetchRoomFx,retainRoomEffects,stamp,warmEffekseer,warmEnabled,warmRoomAssets,warmRoomSound,warmRoots} from './loading/matchWarmup';
import {nextTask} from './render/textureWarmup';
import {libraryCap,TRAINING_BENCH,TRAINING_BENCH_STRONG} from './loading/retention';
import {AreaBanner} from './ui/AreaBanner';
import {borrowedEvent,effectDonors,installTransplant,presentEvents,presentFighters,presentPlayers,presentSnapshot,slotNames,steadyBodies,transplantKey} from './engine/client/transplant';
import {installBorrowedHurts} from './engine/client/borrowedHurts';
import {installBorrowedStrikes} from './engine/client/borrowedStrikes';
import {installStyleMoves,stylesReady} from './engine/client/styleMoves';
import {bodyCentre} from './render/vfx/VfxKit';
import {bigBlowOf,cinematicBlowOf} from './render/bigBlowEvent';
import {Letterbox} from './ui/Letterbox';
import {VsSplash,type VsBeat} from './ui/VsSplash';
import {HomeShell} from './ui/modes/HomeShell';
import {closeNotice,mountFirstVisit,noticeController} from './ui/firstVisit';
import {closePageViewer,pageViewerController} from './ui/pageViewer';
import {CutIn,cutInSide,awakeningCutIn,cutInKey,type ScreenBox} from './ui/CutIn';
import {bodyBulk} from './render/CameraDirector';
import {roanEnabled} from './render/look/roanPass';
import {elementFor} from './render/vfx/palette';
import type {ComboKey} from './game/combos';
import {StrikeTrails} from './render/StrikeTrails';
import {CombatExercise} from './render/CombatExercise';
import {CombatTimeline} from './render/CombatTimeline';
import {installGameplayRecorder} from './render/GameplayRecorder';
import {CombatAudio} from './audio/CombatAudio';
import {MOVES,BIG_HITSTOP} from './game/moves';
import {moveFor,AWAKENINGS} from './game/awakening';
import {rushMove} from './game/awakening';
import {Targeting} from './game/Targeting';
import {AutoLock} from './game/autoLock';
import {Prediction} from './game/prediction';
import type {CollisionWorld} from './game/types';
import type {AttackSlot,CombatEvent,FighterId,GameSnapshot,PlayerState} from './game/types';
import {LocalArena} from './survival/LocalArena';
import {EnemyHorde} from './render/EnemyHorde';
import {SurvivalFx} from './render/SurvivalFx';
import {EnemyTechniques} from './render/EnemyTechniques';
import {SurvivalHud} from './ui/SurvivalHud';
import {isProc,isQuiet,type RunView} from './survival/SurvivalGame';
import {Autopilot} from './survival/autopilot';
import {ENEMIES} from './survival/enemies';
import {GruntRenderer} from './render/horde/GruntRenderer';
import {Gore} from './render/horde/Gore';
import type {HordeFrames} from './survival/horde/frame';
import {GRUNTS} from './survival/horde/kinds';
import {DEATH,type HordeEvent} from './survival/horde/Horde';
import {SurvivalTargets} from './survival/SurvivalTargets';
import {ViewKeys,movementMask} from './render/viewKeys';
import {squadSubject} from './ui/objectives/spectator';
import {RiftIntro} from './ui/RiftIntro';
import {LoadingScreen,type LoadingMode} from './ui/LoadingScreen';
import {loadingModeFor} from './ui/loadingMode';
import './ui/loading.css';
import {LINES,PITCH,VOICE_OF,everyTake,take,type Family} from './audio/survivalBank';
import { hordeFuse } from './originals/hordeVoices';
import {bossLine,type BossMoment} from './audio/bossVoices';
import {RIFT_SCORE} from './audio/musicTracks';
import {lockedStart,playerOutfit} from './ui/shop/boot';
import { displayMove } from './originals/apply';
import { shownStage } from './originals/stages';
import {hudView} from './ui/hud/hudView';
import {PauseLink} from './game/pauseLink';
// Round 5 (HUDIMPL): Inked Plates v2, last of the stylesheets, so it wins over the older passes on the same pieces.
import './ui/hud/inked.css';
import './ui/hud/protos/proto.css';
import './ui/hud/protos/halo.css';
import './ui/hud/protos/haloModes.css';
// Phones and tablets: the touch controls and the graphics picked for the machine.
import {TouchControls} from './input/touch';
import {phone} from './input/device';
import {PhoneShell} from './ui/phoneShell';
import {autoQuality,frameRateToast,gpuName,QualityWatch,stepDown} from './render/qualityTier';
import {emote,onEmoteVoice,shopController} from './ui/shop/boot';
import {connectArmorySound} from './render/vfx/armory/soundOut';
import {installPanelFlags} from './ui/panelFlags';
import {beforeLossReload,reloadIfNotRestored,reloadWhenRestored} from './boot/pageLife';
import {makeRenderer} from './boot/webglFailure';
import {saveRejoin,takeRejoin} from './boot/rejoin';
import {mountGraphicsNotice} from './ui/graphicsNotice';
import {textureBytes} from './render/textureBytes';
import {showStartFailure} from './ui/startFailure';
import {bootDone} from './boot/bootScreen'; // index.html's loading page (#boot) goes once the home is ready

const root=document.querySelector<HTMLElement>('#app')!;
// The renderer, tried twice and else a message and a RETRY in place of the boot mark (boot/webglFailure.ts).
const settings=loadSettings(),view=makeRenderer(gentle=>new GameRenderer(root,settings,gentle),root,(error,first)=>errorReports.report('webgl',error,'renderer',undefined,true,[`first try: ${String((first as Error)?.message??first)}`,`host: ${location.hostname}`]));
// VISUAL EFFECTS (Settings.vfx): the level every effect reads live (render/vfxLevel.ts); a menu's change applies at once below.
setVfxLevel(settings.vfx);
// Until the player chooses, the quality is the machine's: from its GPU, a phone on low (render/qualityTier.ts).
if(autoQuality(settings,gpuName(view.renderer.getContext())))view.applySettings(settings);
const hud=new Hud(root,settings),input=new Input(view.renderer.domElement),online=new Network();
let fighterLabEntry:import('./ui/FighterLaboratory').FighterLaboratory|undefined;
let fighterLabRequest=0;
async function showFighterLaboratory(fighter:FighterId){
  if(import.meta.env.MODE!=='fighter-lab')return;
  if(!isLaboratoryPreviewFighter(fighter))return;
  const request=++fighterLabRequest;
  const {FighterLaboratory}=await import('./ui/FighterLaboratory');
  if(request!==fighterLabRequest||started)return;
  fighterLabEntry??=new FighterLaboratory(root,fighter,async candidate=>{await hud.onStart(candidate,'training',hud.playerName());return started;});
  fighterLabEntry.show(fighter);
}
hud.onLaboratoryReview=fighter=>{void showFighterLaboratory(fighter);};
// The feel pass: how attacks are drawn (Settings.animStyle; `?anim=twos|snap|classic` overrides it for the session).
const animOverride=((v:string|null)=>v==='twos'||v==='snap'||v==='classic'?v:undefined)(new URLSearchParams(location.search).get('anim'));
Fighter.animStyle=animOverride??settings.animStyle;
// Arcade survival runs its arena here in the browser (src/survival); every
// training and solo/bot operations do too. Multiplayer uses the match server.
// main.ts talks to whichever the player chose through the same surface.
const arcade=new LocalArena();
/** Training, in this browser (LocalTraining): no link to the match server to drop. */
const practice=new LocalTraining();
if((window as any).__sheetClose)(window as any).__sheetSim=()=>network===practice?practice.sim:undefined;
const duel=new LocalDuel();
/** Couch play (couch/couch.ts): a second person at this screen, in a Duel (versus) or the arcade's run (co-op). Off, it
 *  does nothing and every mode is as it was. */
const couch=new Couch();
/** The split screen (couch/split.ts): Player 2's own follow camera - the game's, a second copy of it, leaving the fading
 *  to Player 1's (FollowCamera `fading`) - each half's lens-bound shader state (couch/viewState.ts), and each half's own HUD,
 *  the page's own sized to the half (couch/CouchHud.ts). Made the first time a couch splits the screen. */
let camera2:FollowCamera|undefined;
const halfStates=[new ViewState(),new ViewState()] as const;
const couchHud=new CouchHud(hud);let lastCouchHud=0;
window.addEventListener('resize',()=>{if(couch.split)couchHud.layout(view.halves());else if(couch.on)couchHud.fit();});
/** The couch start an access asks for, if any: Bad Blood's, the Rift's, the royale's, Training's and the operations'
 *  couch, and the Duel's and the arcade's (whose couch came first, with Player 2's fighter as the rival or the partner). */
function couchOf(access:NetworkAccess|undefined):CouchStart|undefined{
  if(!access)return undefined;
  if(access.kind==='duel')return access.access==='couch'&&access.rival?access.couch??{partner:access.rival,screen:'shared'}:undefined;
  if(access.kind==='survival')return access.partner?access.couch??{partner:access.partner,screen:'shared'}:undefined;
  return 'couch' in access?access.couch:undefined;
}
/** A split screen's half, just before it is drawn (GameRenderer renderHalves, its lens already the half's): its own lens's
 *  shader state, the fight's focus on its own player, and the crowd's see-through round that player - the grunts' and the
 *  enemies' cover is worked out for one lens at a time (GruntRenderer.prepareCamera, EnemyHorde.cover). */
const halfFocus=new THREE.Vector3();
function splitHalf(half:0|1){
  halfStates[half].apply();const id=couch.ids[half],body=fighters.get(id);if(body)view.setFocus(body.group.position);
  const kept=grunts.focus,alive=!!network.snapshot?.players.find(p=>p.id===id)?.alive;
  grunts.focus=body&&alive?halfFocus.set(body.group.position.x,body.group.position.y+1.1,body.group.position.z):undefined;
  grunts.prepareCamera(view.camera);horde.cover(view.camera);grunts.focus=kept;
  // The Rift's health bars turned to this half's lens, and its own person's tower range ring (RiftField.face); and every
  // effect turned to the lens on the CPU, turned to this one (render/lenses.ts faceLens).
  if(riftField.root.visible)riftField.face(view.camera,half);
  // Sky Spike's cues: each seat's only in its own half.
  spikeCues.drawing(half);spikeCues2.drawing(half);
  faceLens(view.camera);
}
/** The couch's split screen on: the second camera behind Player 2, the renderer drawing both halves, the halves' plates. */
function beginSplit(snapshot:GameSnapshot){
  if(!couch.split||(couch.screen!=='split-v'&&couch.screen!=='split-h'))return;
  camera2??=new FollowCamera(new THREE.PerspectiveCamera(view.camera.fov,innerWidth/innerHeight,view.camera.near,view.camera.far));
  camera2.fading=false;camera2.reset();
  const [one,two]=couch.ids,p1=snapshot.players.find(p=>p.id===one),p2=snapshot.players.find(p=>p.id===two);
  couch.views[0].yaw=p1?.yaw??Math.PI;couch.views[1].yaw=p2?.yaw??Math.PI;camera.lookAlong(couch.views[0].yaw);camera2.lookAlong(couch.views[1].yaw);
  const screen=couch.screen;
  view.setSplit({screen,second:camera2.camera,before:splitHalf,focus:half=>{const at=fighters.get(couch.ids[half])?.group.position;return at&&view.shadowCentred?ballShadowFocus(at,ballField.ballPosition(),ballShadow[half]):at;}});
  document.body.classList.add('couch-split',`couch-${screen}`);
  couchHud.show(screen,()=>couch.seats.seats);
  couchHud.layout(view.halves());
}
function endSplit(){view.setSplit(undefined);couchHud.hide();document.body.classList.remove('couch-split','couch-split-v','couch-split-h');camera2?.reset();}
/** A notice for one person at this screen (a COUNTER!, a PARRY, a move's name): the page's own HUD's for its player; on a
 *  split screen, the half of whichever seat it is for, either of them. False: nobody here for it to tell. */
function personal(id:string|null|undefined,text:string,duration:number){
  if(!id)return false;
  if(couch.split){const seat=couch.seatOf(id);if(seat<0)return false;couchHud.notice(seat,text,duration);return true;}
  if(id!==network.id)return false;
  hud.notify(text,duration);return true;
}
if(import.meta.env.MODE==='preview'){const tag=document.createElement('div');tag.textContent=`PREVIEW BUILD · OFFLINE MODES ONLY · ${import.meta.env.VITE_BUILD_SHA??''}`;tag.style.cssText='position:fixed;left:50%;bottom:3px;transform:translateX(-50%);z-index:2147483000;pointer-events:none;font:600 10px/1.2 system-ui,sans-serif;letter-spacing:.08em;color:#fff;background:rgba(201,34,53,.82);padding:2px 8px;border-radius:3px;opacity:.85';document.body.append(tag);}
// Lock combat (game/lockMode.ts): its look; and in the preview build a standing tag, so a screenshot or a report says
// which rules it was.
if(lockCombatOn()){document.documentElement.dataset.lockCombat='1';CombatEffects.lockLook=true;Fighter.hitReact=1.7;Fighter.reelHold=1.8;Fighter.reelSway=.07;Fighter.lockHurts=true;Fighter.whiteFlash=true;StrikeTrails.widthScale=.7;StrikeTrails.lifeScale=.75;Fighter.noSmear=true;}
if(lockPreview()){const tag=document.createElement('div');tag.id='lock-combat-tag';tag.textContent='LOCK COMBAT · EXPERIMENT';tag.title='Offline Duel and Training, every fighter: strings that dash in and run on, a finisher, and a ring to guard in to vanish out of one. Camera style Chase (settings) films an exchange up close. Add ?combat=live to the address for the live rules.';
  Object.assign(tag.style,{position:'fixed',top:'6px',left:'50%',transform:'translateX(-50%)',zIndex:'2147483000',padding:'3px 10px',borderRadius:'999px',background:'rgba(12,12,16,.72)',color:'#ffd34d',font:'700 11px/1.4 system-ui,sans-serif',letterSpacing:'.12em',pointerEvents:'none'});document.body.append(tag);}
const royale=new LocalRoyale();
const localObjective=new LocalObjective(),localRift=new LocalRift(),localBall=new LocalBall();
let network:Network|LocalArena|LocalTraining|LocalObjective|LocalDuel|LocalRoyale|LocalRift|LocalBall=online;
/** A co-op run: a party's arcade survival, stepped on the match server. */
const coop=()=>network===online&&online.coop;
const survival=()=>network===arcade||coop();
/** The run being drawn: this browser's own, or a co-op room's as its latest
 *  frame has it - and what the renderer asks of it either way. */
const runView=():RunView|undefined=>network===arcade?arcade.view:online.run;
hud.modes.runView=runView; // Round 5 (UX): the arcade's run for its mode HUD (src/ui/hud).
hud.modes.local=()=>network===practice||network===duel||network===royale||network===arcade||network===localObjective||network===localRift||network===localBall; // Round 5 (UX): the menu tells the truth about pausing.
// Round 5 (SOLOPAUSE): a room whose one human this page is pauses for real (src/game/pauseLink.ts, src/server/SoloPause.ts);
// a local match holds until a frame of it has been drawn (`fightShown`). hud.modes.paused/pausable: the truth, for the menu.
const pauseLink=new PauseLink();let fightShown=false,roomFrozen=false,hudCovered=false,drawnSize=0;
const localNetwork=()=>network===royale?royale:network===duel?duel:network===arcade?arcade:network===practice?practice:network===localObjective?localObjective:network===localRift?localRift:network===localBall?localBall:undefined;
hud.modes.paused=()=>network===online?pauseLink.state==='paused':!!localNetwork()?.paused;
hud.modes.pausable=()=>network===online?pauseLink.pausable||pauseLink.holding:!!localNetwork();
const isBoss=(id:string)=>network===arcade?!!arcade.game?.isBoss(id):!!online.run?.marked.bosses.includes(id);
const isChampion=(id:string)=>network===arcade?!!arcade.game?.isChampion(id):!!online.run?.marked.champions.includes(id);
const rivalIds=():readonly string[]=>network===arcade?arcade.game?.rivals()??[]:online.run?.marked.rivals??[];
const runScale=()=>network===arcade?arcade.game?.timeScale??1:1;
const horde=new EnemyHorde(view.scene),grunts=new GruntRenderer(view.scene),survivalFx=new SurvivalFx(view.scene),survivalHud=new SurvivalHud(root.querySelector('#interface')??root);
/** The premise, before the first run of a session (RiftIntro.ts). */
const riftIntro=new RiftIntro(root);
// Round 5 (UX), WP1: the mode sheet and the home's mode line (src/ui/modes/HomeShell.ts).
const shell=new HomeShell(hud,{story:()=>{riftIntro.preload();void riftIntro.play();},menuPad:()=>input.padIndex});
// LEARN TO FIGHT (src/tutorial): the guided first fight, in the offline Training Ground, its dummy and its HUD the lesson's.
const guided=new GuidedFightRun({root:root.querySelector<HTMLElement>('#interface')??root,modes:hud.modes,sim:()=>network===practice?practice.sim:null,viewYaw:()=>input.yaw,leave:()=>hud.onLeave()});
// LEARN TO PLAY (src/ui/ball/LearnToPlay.ts), the ball modes' guided first game, on this device's FREE PLAY.
new LearnToPlay({root:root.querySelector<HTMLElement>('#interface')??root,modes:hud.modes,send:(type,payload)=>network.room?.send(type,payload),leave:()=>hud.onLeave()});
// The first-visit notice: what the game is, that it is never monetized, and where a takedown goes.
mountFirstVisit();
const loadingScreen=new LoadingScreen(root);
{const here={x:0,y:0,z:0};riftIntro.sound={impact:()=>{audio.cue('bomb',here,.55,.7,'intro',2);audio.cue('ground',here,.5,.6,'intro',2,.05);},roar:()=>audio.sample(take('beast-roar'),here,.8,.62,'intro',2),stamp:()=>audio.cue('crack',here,.35,1.25,'intro',1)};}
/** The horde's frames: captured each tick here, or sent by a co-op room. */
const hordeFrames=():HordeFrames|undefined=>network===arcade?arcade.hordeFrames:online.hordeFrames;
const gore=new Gore(view.scene),gruntFocus=new THREE.Vector3();
grunts.onDeath=(x,y,z,kind,death,cut,dx,dz)=>gore.death(x,y,z,kind,death,cut,dx,dz,performance.now()/1000);
survivalFx.screen=view;
const techniques=new EnemyTechniques(view.scene);techniques.screen=view;
techniques.bodyOf=id=>{const body=horde.body(id);return body?{x:body.group.position.x,y:body.group.position.y,z:body.group.position.z,height:body.def.height}:undefined;};
/** The online display delay, and the local one: a tick behind the arena, so
 *  the two latest states can be interpolated and nothing waits on a wire. */
const ONLINE_DELAY=60,LOCAL_DELAY=1000/60;
/** A ball match on this device runs its drawing clock steered onto one steady lag behind the match (a PERFECT
 *  STRIKE timed by eye has to land the same way every time). The clock the other modes keep (below) runs free
 *  between its two clamps, so whichever end a session drifted to it stayed at: measured 2 to 4 ticks behind from one
 *  session to the next, the same press a PERFECT STRIKE in one and late in the next. This one is pulled onto `behind`
 *  the match's own clock (its newest tick plus the time the input clock has banked toward the next: smooth, real time) - gently (`gain` a second, never more than `pace` of the
 *  frame's time a frame, so the frames stay even), or at once past `snap` (a stall, the start). `behind` leaves the frame's
 *  own tick sent after the clock is read half a tick of room before the clamp at the newest (1.2 ticks hit it
 *  and doubled the uneven frames). */
const BALL_CLOCK={behind:1.5/60,gain:4,pace:.08,snap:3/60} as const;
/** On this machine only, for the checks' before and after on one build: `?freeclock` keeps a ball match on the free
 *  clock, `?noforecast` draws the page's own touches when the room's word comes, and an attack the room puts back into
 *  the page's time as the snapshots have it, as they were drawn before the forecast. */
const ballChecks=['localhost','127.0.0.1','[::1]'].includes(location.hostname)?new URLSearchParams(location.search):new URLSearchParams();
const steadyBallClock=!ballChecks.has('freeclock'),forecastTouches=!ballChecks.has('noforecast');
/** The local arena's visual clock, in arena seconds: it runs at the arena's
 *  own time scale (slow motion on a boss's fall), a tick behind its newest. */
let localClock=0;
/** The last boss or champion entrance the camera has shown. */
let lastEntrance=0,lastRoar=0;
const objectiveField=new ObjectiveField(view.scene,root);
const riftField=new RiftField(view.scene,grunts),riftUI=new RiftWarUI(root.querySelector<HTMLElement>('#interface')??root);
// The ball modes (game/ball): the ball, its trail and its moments in the world; the lobby and results over it.
const ballField=new BallField(view.scene),ballUI=new BallUI(root.querySelector<HTMLElement>('#interface')??root),ballTargets=new BallTargets();
// Online, the page's own touch of the ball is forecast from its prediction (game/ball/BallTargets,
// touchForecast.ts) and drawn at once (BallField.forecastTouch), the room's word blended in when it comes; and heard
// at once (BallAudio.own, from the ball as it was drawn just before), the room's own sound for it skipped.
ballTargets.local=()=>prediction.local;ballTargets.clock=()=>prediction.localTime;ballTargets.replaying=()=>prediction.replaying;
ballField.ownStick=()=>prediction.local?.input;// (Its own carried ball turned toward its stick, as the room turns it.)
ballTargets.drawn=()=>ballField.drawnState();ballTargets.onTouch=touch=>{if(!forecastTouches)return;
  // (BallMatch DOUBLE: how soon the page's own swing under way lands - a body's touch just ahead of it is its.)
  if(network===online){const cast=prediction.local?.cast;ballAudio.own(touch,ballField.drawnState(),cast?nextContact(cast.move.contacts,prediction.localTime-cast.start):Infinity);}
  ballField.forecastTouch(touch);};
// A goal's replay, and a great point's (render/ball/BallReplay.ts): the page plays the room's window again from what it kept.
const ballReplay=new BallReplayer();ballReplay.onSkip=()=>network.room?.send('ball-skip');let ballReplayBars=0,ballReplayed=false;
// The ball modes' own camera (render/ball/BallCam.ts): the ball cam, on by default, Tab (a couch seat's TARGET) toggles it;
// one for each half of a split screen. Their peaks felt (render/ball/BallMoments.ts): the frame's own tools on a goal, a
// SUPER SHOT, a CLASH, a PERFECT save and a SKY SPIKE, and the INK FLASH. The sun's shadow box between player and ball.
const ballCams=[new BallCam(),new BallCam()] as const;let ballCamPresses=0;const ballShadow=[new THREE.Vector3(),new THREE.Vector3()] as const;
// Sky Spike's broadcast camera (render/ball/SpikeCam.ts) stands in for the ball cam there, one for each half too.
const spikeCams=[new SpikeCam(),new SpikeCam()] as const;
// Goal Rush's two stances (game/ball/stance.ts): Tab - a couch seat's TARGET, the touch layer's button - is the
// BALL stance, filmed by the ball cam's own rig (render/ball/BallChase.ts), or the FIGHT stance on one opponent, filmed by
// the follow camera's lock-on framing; one of each for each seat. Their marks under the feet (render/ball/StanceMarks.ts).
const ballStances=[new StanceControl(),new StanceControl()] as const,ballChases=[new BallChase(),new BallChase()] as const,stanceMarks=new StanceMarks(view.scene);
const chaseFrame:ChaseFrame={self:new THREE.Vector3(),heading:0,ball:null,fight:false,mode:'goal-rush',boosting:false,shake:1},NO_FOCUS:readonly (Fighter|undefined)[]=[];let stanceYaw=NaN;
const stanceBody=(id:string)=>fighters.get(id)?.group.position;
// Each side's colour on its fighters' ink and rim light, in a ball match only (render/ball/TeamTrim.ts).
const teamTrims=new TeamTrimmer(),trimBody=(id:string)=>fighters.get(id);
// Sky Spike's timing cues (render/ball/SpikeCues.ts): the jump's beat, the PERFECT window's glint at the top, the
// other side's hitter at the top (the block's beat), a dive to make; each with a short tick on the ball's own takes.
// A couch split screen's Player 2 has their own (spikeCues2), drawn only into their half (splitHalf), their ticks
// a shade lower so each player hears their own.
const spikeCues=new SpikeCues(view.scene),spikeCues2=new SpikeCues(view.scene,1);
const spikeTick=(seat:0|1)=>(k:SpikeCueTick)=>{const [id,gain,rate]=({jump:['strike-tap-2',.42,2.2],apex:['target-hit',.5,1.25],block:['target-hit',.3,.82],dive:['strike-tap-1',.38,1.7]} as const)[k];audio.centred(ballSfxUrl(id),gain,0,rate*(seat?.88:1));
  (window as unknown as {__spikeTicks?:unknown[][]}).__spikeTicks?.push([performance.now(),k,seat]);};
spikeCues.onTick=spikeTick(0);spikeCues2.onTick=spikeTick(1);
// (A check on this machine reads the cues: `__spikeCues.state` (Player 2's `__spikeCues2`), and `__spikeTicks = []` logs
// each tick with its seat.)
if(['localhost','127.0.0.1','[::1]'].includes(location.hostname))Object.assign(window as unknown as {__spikeCues:SpikeCues;__spikeCues2:SpikeCues;__ballField:BallField},{__spikeCues:spikeCues,__spikeCues2:spikeCues2,__ballField:ballField,
  // (The cameras, their options' numbers and the drawn bodies, for the checks' measures: `__ballCams`;
  // `hold(true)` stops a match on this device where it is, still drawn, so one moment is filmed from both cameras
  // (`ask({spike:'side'})`), and `trim(false)` draws it without the sides' trim.)
  __ballCams:{spike:spikeCams,chase:ballChases,chaseFrame,SpikeCam,BallChase,body:(id:string)=>fighters.get(id),lens:()=>view.camera,lens2:()=>camera2?.camera,scene:()=>view.scene,hold:(on:boolean)=>{ballHeld=on;},trim:askTeamTrim,ask:askBallCams}});
let ballHeld=false;
/** `?ballpilot` on this machine (a bot plays the page's fighter, LocalBall): the page films the bot's stance. */
const ballPiloted=['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&new URLSearchParams(location.search).has('ballpilot');
// A TACKLE (game/ball/model.ts GOAL_STANCE): the lens punches for the tackler and the one tackled, the frame's ink for a
// TAKEDOWN; your own strikes of the ball in the BALL stance punch the ball cam a touch.
stanceMarks.onEvent=e=>{
  const mine=e.actorId===network.id||couch.on&&e.actorId===couch.ids[1],hit=e.targetId===network.id;
  if(e.kind==='tackle'&&(mine||hit)){const big=e.text==='TAKEDOWN';for(const lens of ballLenses)lens.impact(big?.85:.6,undefined,mine?2:1);
    if(mine){view.speedLines(big?.8:.5);if(big){view.impactFrame(.85,stanceAt.set(e.x,e.y,e.z));view.chromaticPulse(.8);}}}
  else if(e.kind==='strike'&&mine)for(const lens of ballChases)lens.impact(Math.min(.5,.18+(e.value??0)/90),undefined,1);};
const stanceAt=new THREE.Vector3();
/** A ball match's command says the seat's stance: the opponent locked (FIGHT), or the ball (game/ball/stance.ts). */
function ballAim<T extends {targetId?:string|null;lock?:boolean}>(command:T|undefined,seat:0|1):T|undefined{
  const v=ballOf(network.snapshot);if(!command||!v)return command;
  const stance=hasStances(v)?ballStances[seat]:undefined;command.targetId=stance?.targetId()??BALL_ID;command.lock=!!stance?.lock;return command;}
const ballLenses=[{impact:(w:number,d?:THREE.Vector3,t:0|1|2=0)=>{camera.impact(w,d,t);ballChases[0].impact(w,d,t);}},{impact:(w:number,d?:THREE.Vector3,t:0|1|2=0)=>{camera2?.impact(w,d,t);ballChases[1].impact(w,d,t);}}] as const;
const superRide=new SuperRide(); // The lens riding a SUPER SHOT, an option (render/ball/superRide.ts)
const ballMoments=new BallMoments(view,()=>couch.split&&camera2?[[ballLenses[0],fighters.get(couch.ids[0])?.group.position],[ballLenses[1],fighters.get(couch.ids[1])?.group.position]]:[[ballLenses[0],shownSelf]],()=>ballField.ballPosition());
ballField.bodyOf=id=>fighters.get(id)?.group.position;
// (The page's own swing as its prediction has it - offline, as the match in this browser has it,
// at the time drawn - for its aim line, its charge and its take: render/ball/ownShot.ts.)
ownShot.read=()=>network===localBall?localBall.match?.sim.actors.get(network.id):prediction.local;ownShot.clock=()=>network===localBall?timeline.drawnAt??NaN:prediction.localTime;ownShot.drawn=()=>network!==localBall&&prediction.active;
// FREE PLAY's reset (game/ball/BallMatch.ts reset): Backspace, or the pad's View/Share button.
let ballResetHeld=false;
// Quick chat (ui/ball/QuickChat.ts): C, or the pad's View button; the room relays the line.
const quickChat=new QuickChat(root.querySelector<HTMLElement>('#interface')??root);quickChat.onSend=index=>network.room?.send('ball-chat',index);
window.addEventListener('keydown',e=>{if(e.code==='Backspace'&&!e.repeat&&ballOf(network.snapshot)?.practice&&!(e.target instanceof HTMLInputElement)){e.preventDefault();network.room?.send('ball-reset');}});
window.addEventListener('ball-reset',()=>{if(ballOf(network.snapshot)?.practice)network.room?.send('ball-reset');}); // the HUD's RESET BALL, tapped
function ballResetPad(){if(!ballOf(network.snapshot)?.practice){ballResetHeld=false;return;}let held=false;for(const pad of navigator.getGamepads?.()??[])if(pad?.connected&&pad.buttons[8]?.pressed)held=true;if(held&&!ballResetHeld)network.room?.send('ball-reset');ballResetHeld=held;}
const environment=new ArenaEnvironment(view.scene),stages=new StageEnvironment(view.scene),library=new FighterLibrary(),camera=new FollowCamera(view.camera),effects=new CombatEffects(view.scene),fighters=new Map<string,Fighter>();
// The dream loop's films (scripts/dream/film.mjs --fixed; the dev server only): the view and the lens started afresh at a
// scene's start, as a match's bell starts them, so the keys a film presses - read against the view - carry nothing of
// the session before it.
if(import.meta.env.DEV)(window as unknown as {__filmReset?:()=>void}).__filmReset=()=>{input.yaw=network.snapshot?.players.find(p=>p.id===network.id)?.yaw??input.yaw;camera.reset();camera.lookAlong(input.yaw);};
const areaFx=new AreaTelegraph(view.scene,{small:typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches});/* (The floor's blow under each strike is the sound plan's now, by the element's weight: audio/sfxPlan.ts areaStrike.) */
// The seal slamming down on the floor (AreaTelegraph): a deep thud under the telegraph.
areaFx.onSlam=(at,actorId,local)=>{audio.cue('fx-land-heavy',at,local?.5:.32,.62,actorId,1);};
// The area move's cast banner: the caster's seal beside the move's name (src/ui/AreaBanner.ts), made on its first cast.
let areaBanner:AreaBanner|undefined,areaBannerShown={key:'',at:-Infinity};
const showAreaBanner=(body:FighterId,move:string,mover:FighterId)=>{const key=`${body}|${move}`,now=performance.now();if(key===areaBannerShown.key&&now-areaBannerShown.at<900)return;areaBannerShown={key,at:now};
  void (areaBanner??=new AreaBanner(document.getElementById('action-message')?.parentElement??document.body)).show(body,{...sealTextOf(body,move,mover),en:displayMove(mover,move)});};
const floorAt=(x:number,z:number,near:number)=>{const hit=localCollision?.raycast?.({x,y:Math.max(near,0)+12,z},{x,y:-20,z});return hit&&hit.y>-19.9?hit.y:0;};
// The floor under a point, for what a move lays on it (render/signature/blowFloor.ts): the first fixed surface from half a metre over the height asked about to six under it; nothing where the ray begins inside something or finds no floor.
SIGNATURE.floor=(x,y,z)=>{try{const top=y+.5,hit=localCollision?.raycast?.({x,y:top,z},{x,y:y-6,z});return hit&&hit.y<top-.001&&hit.y>y-5.999?hit.y:undefined;}catch{return undefined;}};
// Hidden Rift opponents keep their already compiled rigs, outside camera/target/effect maps.
const hiddenRiftBodies=new Map<string,Fighter>();
function clearFighters(){for(const body of [...fighters.values(),...hiddenRiftBodies.values()])body.dispose();fighters.clear();hiddenRiftBodies.clear();}
const timeline=new CombatTimeline(),strikeTrails=new StrikeTrails(view.scene);
const awakeningEffects=new AwakeningEffects(view.scene);
// The bodies the director's shots keep a clear sight line past and the lens out of.
camera.director.crowd=fighters;
/** The old cast's own effects (Gummy's, the Ninja's, the sword spirits', Setsu's, Ward's, the Emperor's, Kuon's, the Last Sun's,
 *  Gaunt's): made together the first time a room asks (roomExtras waits for them) or at idle once the home is up
 *  (render/castEffects.ts: 660 KB of the entry before minifying). Until then `castFx.now` is
 *  undefined and the frame's calls on it are skipped: no room has loaded, so none of them has anything to draw. */
const castFx=lazyCode<CastEffects>('cast-effects',()=>import('./render/castEffects').then(m=>new m.CastEffects(view.scene)));
const clashEffects=new ClashEffects(view.scene);
const targeting=new Targeting();
const autoLock=new AutoLock();
// The Chase camera style: when the player last traded a blow, and how long after it the combo shot holds (FollowCamera.comboFrame).
let lockExchangeAt=-Infinity;const LOCK_EXCHANGE_MS=1100;
/** Lock combat: whether this page has said what it is in a fight yet (once a session). */
let lockTold=false;
// Goal Rush's SPORT mode (game/ball/football.ts; `?football` in the address, any host): this device's Goal Rush matches
// play possession, PASS, SHOOT and SPRINT in the place of the BALL stance's swings. The camera's two states (BALL LOCK,
// FREE LOOK: render/ball/footballPage.ts) are V's or the pad's left stick click's, kept in the settings; one quiet mark
// shows who a PASS would find.
const footballOn=footballWanted(location),passMark=footballOn?new PassMark(root.querySelector<HTMLElement>('#interface')??root):null,footStick={x:0,z:0};
const sporting=()=>!!ballOf(network.snapshot)?.football;
/** `?ballpilot` in SPORT's FREE LOOK: the view eased toward the drawn body's run (at most 2.4 rad/s, once it runs). */
const pilotRun={x:NaN,z:NaN,vx:0,vz:0};
function pilotLook(yaw:number,at:THREE.Vector3,dt:number){
  if(Number.isFinite(pilotRun.x)&&dt>0){const k=Math.min(1,dt*6);pilotRun.vx+=((at.x-pilotRun.x)/dt-pilotRun.vx)*k;pilotRun.vz+=((at.z-pilotRun.z)/dt-pilotRun.vz)*k;}
  pilotRun.x=at.x;pilotRun.z=at.z;
  if(Math.hypot(pilotRun.vx,pilotRun.vz)<3)return yaw;
  const gap=Math.atan2(Math.sin(Math.atan2(pilotRun.vx,pilotRun.vz)-yaw),Math.cos(Math.atan2(pilotRun.vx,pilotRun.vz)-yaw)),most=2.4*dt;
  return yaw+Math.max(-most,Math.min(most,gap*Math.min(1,dt*3)));
}
hudView.goalLook=()=>GOAL_LOOK_NAME[goalLookChoice(settings)];
if(['localhost','127.0.0.1','[::1]'].includes(location.hostname))(window as unknown as {__ballQuiet:unknown}).__ballQuiet=quietCounts;
input.onView=()=>{if(!sporting()||couch.on)return false;switchGoalLook(settings);try{localStorage.setItem('rift-settings',JSON.stringify(settings));}catch{/* The choice still holds this session. */}hud.notify(GOAL_LOOK_NAME[goalLookChoice(settings)],.7);return true;};
hudView.camera=view.camera;hudView.locked=()=>targeting.locked;hudView.ballCam=()=>ballCams[0].on;hudView.ballLock=()=>hasStances(ballOf(network.snapshot))?ballStances[0].lock:null; // Round 5 (UX, WP2): the mode HUDs' edge markers and target plate (src/ui/hud/hudView.ts).
// Compact Arcade enemies join the same camera and target selection as every other mode.
const survivalTargets=new SurvivalTargets(),riftTargets=new RiftTargets(),riftAssets=new RiftAssets(),riftPredictionTargets=new RiftPredictionTargets();
// VOL.5, the move transplant (src/engine/client/transplant.ts): a borrowed move's clips and effects, loaded with the room's.
installTransplant({ensure:ids=>library.ensure(ids),donor:state=>library.has(state.fighter)?library.create(state):undefined,bodies:()=>fighters.values(),effects:donors=>{const room=network.snapshot?riftAssets.ids(network.snapshot):[hud.selected],ids=[...new Set([...room,...(network.snapshot?effectDonors(network.snapshot.players,room):[]),...donors,...benched()])];return Promise.all([castFx.get().then(cast=>cast.load(ids)),effects.load(ids)]).then(()=>{});},compile:()=>view.compileScene()});
// The dream loop, round 90: Taisei's authored hurts lent to every body that has none (src/engine/client/borrowedHurts.ts).
void installBorrowedHurts();
// Lock combat's preview: the second-round strikes of the fighters with none of their own (engine/client/borrowedStrikes.ts).
if(lockCombatOn())void installBorrowedStrikes();
// Techniques (game/techniques.ts): each style's takes, fitted to the bodies that throw them (engine/client/styleMoves.ts).
void installStyleMoves();
// Ball modes, sports moves (render/ball/ballMoves.ts): a pass, a header, a dig, a spike drawn for a ball match's swings -
// only with `?ballmoves` (or `?volleyball`) in the address, so the game as played is untouched. (But SHOOT's quick strike,
// which is nobody's own clip, is drawn with a take on every page.)
installBallMoves(()=>{const view=ballOf(network.snapshot);return view?{view,ball:ballField.ballPosition()}:undefined;},ballMovesWanted(location)||volleyballWanted(location));
riftField.glows=riftTargets.glows;
grunts.threats=survivalTargets.glows;
const targetPlayers=(snapshot:GameSnapshot)=>{const self=snapshot.players.find(p=>p.id===network.id);return ballOf(snapshot)?ballTargets.update(snapshot,ballField.ballPosition()):riftOf(snapshot)&&self?riftTargets.update(snapshot,self):survival()&&self?survivalTargets.update(snapshot.players,hordeFrames()?.around(snapshot.serverTime)?.b,self):snapshot.players;};
const gruntPosition=(id:string,out:THREE.Vector3)=>{const at=grunts.centre(id,out);if(at)at.y-=(grunts.heightOf(id)??1.8)*.55;return at;};
// Round 4 (CAMERA): the main game's keyboard view keys (src/render/viewKeys.ts).
const viewKeys=new ViewKeys();
const prediction=new Prediction();prediction.requireCollision=true;
let localCollision:CollisionWorld|undefined,localCollisionStage:StageId|null=null;
let collisionGeneration=0;
/** Predicted casts are given ids far above anything a room will issue, so the
 *  audio layer's own de-duplication cannot confuse one for a server event. */
const PREDICTED_EVENT_BASE=1_000_000_000;
const predictedCasts=new Map<string,number>();
/** One cast of a slot, not the slot: a rush string casts light four times in
 *  a second, and keyed by slot alone the second stage's server echo found no
 *  entry (the first stage's had been spent) and was announced a second time.
 *  The input sequence is the one both copies agree on. */
const castKey=(event:CombatEvent)=>`${event.slot}:${event.actionSeq??''}`;
const predictedVisuals:CombatEvent[]=[];
let predictedImpactId=2_000_000_000;
let started=false,targetId:string|null=null,previous=performance.now(),lastHud=0,lastEvent=0;
// What was actually drawn for the local fighter this frame - predicted or
// authoritative. Read-only, for the evidence probes.
let shownSelf:PlayerState|undefined;
// The server owns the stage; the client follows whatever the snapshot names.
// The swap is asynchronous, so the harbour stays up until the new one is ready
// rather than leaving the fighters standing in an empty sky.
// Round 4 (STAGES): every stage, the harbour included, is StageEnvironment's - loaded for the room that fights on it, let go after.
let stageShown:StageId|null=null,stageWanted:StageId|null=null;
/** The place a lone switch keeps loaded (playLocally): set only while it goes home. */
let keepPlace:StageId|null=null;
const occluders=()=>stages.occluders;
/** The local copy of the simulation needs the same colliders the server has,
 *  or a predicted fighter walks through a wall for the 50 ms before the next
 *  snapshot pulls them back out of it.
 *
 *  Loaded on demand rather than imported: Rapier carries its WebAssembly inside
 *  the module, and having it in the entry bundle put three megabytes in front
 *  of the lobby for something nobody needs until they are in a room.
 */
function ensureLocalCollision(stage:StageId){
  if(localCollisionStage===stage)return;
  localCollisionStage=stage;
  const generation=++collisionGeneration;
  // The old stage's world is gone the moment the stage is: see Prediction.setStage.
  localCollision=undefined;prediction.setStage(stage);
  // Rapier is shared: the same wasm backs the stage collision and the death
  // ragdolls. Started here rather than on the first death, so nobody's first
  // kill of the session is the one that falls back to the authored slam.
  void import('./render/Ragdoll').then(({prepareRagdolls})=>prepareRagdolls()).catch(error=>console.warn('Ragdolls unavailable',error));
  void import('./game/rapierCollision').then(({createRapierCollision})=>createRapierCollision(stage)).then(collision=>{
    if(localCollisionStage!==stage||generation!==collisionGeneration){collision.dispose?.();return;}
    // The online copy must give the same immovable barricades no ground.
    localCollision=stage==='hidden-ash'?villageCollision(collision):collision;prediction.setStage(stage,localCollision);
  }).catch(error=>{if(generation!==collisionGeneration)return;console.warn('Local collision failed',stage,error);prediction.setStage(stage);});
}
/** The arena the ball stage was last dressed as (render/ball/arenaChoice.ts). */
let ballArenaShown:BallArenaId|undefined;
function wantStage(stage:StageId){
  // Back home (returnToLobby asks for the harbour once the match is over) nothing is drawn behind the menus: the stage
  // that was shown is let go - geometry, textures and all - instead of the harbour being loaded to stand behind them.
  // (A lone player's switch to the device match at the same place keeps it, still shown: the match asks for it again at once.)
  if(!started&&stage==='harbor'&&keepPlace&&keepPlace===stageShown){stageWanted=null;return;}
  if(!started&&stage==='harbor'){stageWanted=stageShown=null;stages.releaseAll();view.applyStage(STAGES.harbor);return;}
  if(stage===stageWanted)return;
  stageWanted=stage;
  ensureLocalCollision(stage);
  const definition=STAGES[stage];
  const arenaShown=stage==='ball-pitch'||stage==='ball-court'?BALL_ARENAS[ballArenaFor(stage)]:undefined;// a ball stage shows its arena's name
  if(stage!=='harbor')hud.notify(arenaShown?`${arenaShown.name.toUpperCase()} — ${arenaShown.blurb.toUpperCase()}`:`${shownStage(stage)!.name.toUpperCase()} — ${shownStage(stage)!.scene.toUpperCase()}`,1.8);
  void stages.show(stage).then(()=>{
    if(stageWanted!==stage)return;
    view.applyStage(definition);
    stageShown=stage;
  }).catch(error=>{
    // A stage that will not load must not take the match with it: the harbour stands in (loaded now - it is not kept
    // behind every other stage any more) and the simulation is unaffected either way.
    console.warn('Stage failed to load',stage,error);
    if(stageWanted!==stage||stage==='harbor')return;
    stageWanted='harbor';
    void stages.show('harbor').then(()=>{if(stageWanted==='harbor'){view.applyStage(STAGES.harbor);stageShown='harbor';}}).catch(fallback=>console.warn('Harbour stand-in failed',fallback));
  });
}
input.sensitivity=settings.sensitivity;input.rumble.scale=settings.vibration;setCommentary(settings.commentary);hud.busy(true);const exercise=new CombatExercise(new URLSearchParams(location.search).has('contact-exercise'));installGameplayRecorder(view.renderer.domElement,async()=>{if(network.snapshot?.roomMode!=='training')throw new Error('Enter training first');await exercise.start(command=>network.room?.send('training',command));},()=>audio.captureOutput(music.captureElements()),()=>({...fighters.get(network.id)?.motionEvidence(),performance:view.perf(),player:shownSelf?{x:shownSelf.x,y:shownSelf.y,z:shownSelf.z,yaw:shownSelf.yaw,actionSeq:shownSelf.actionSeq}:undefined,view:{position:view.camera.position.toArray(),yaw:camera.yaw,movementYaw:camera.movementYaw},roster:network.snapshot?.players.map(p=>({id:p.id,fighter:p.fighter,action:p.action,hp:p.hp}))}));
const damageNumbers=new DamageNumbers(root),manga=new MangaImpact(root);
// The feel pass: an ultimate's cinema bars (render/FinisherCuts.ts), under the HUD.
const letterbox=new Letterbox(root);
// The feel pass: the animated VS splash and FIGHT! card (src/ui/VsSplash.ts) - a training start plays it here;
// a server match's countdown plays it through MatchIntro.
const vsSplash=new VsSplash(document.querySelector<HTMLElement>('#interface')??root);
/** Set from the moment a training start is due its splash until the splash is up (the loading screen's fade). */
let vsPending=false;
// The impact lettering rides the struck body as it is drawn. The lock-on
// reticle and its nameplate step aside while a blow freezes and through an
// ultimate, rather than stacking on the lettering and the damage count.
manga.bodies=(id,out)=>{const f=fighters.get(id);if(!f)return false;bodyCentre(f,out);return true;};
// Round 4: through a hit's hold the lock dims rather than going: the brackets
// sit outside the body now, clear of the lettering, and a brawl lands a blow
// every half second - hidden on each, the lock was gone for most of a fight.
const MARKER_HIT_DIM=.35;
let markerFade=1,markerHoldUntil=0;const numberAnchor=new THREE.Vector3();
// The live settings (the HUD edits this object in place), so the effects level and quality apply from boot, and the post API.
effects.settings=settings;manga.density=settings.effects;effects.screen=view;SIGNATURE.screen=view;
const marker=new THREE.Vector3(),audio=new CombatAudio({byRoom:true}),musicPanel=new MusicPanel(root),music=musicPanel.music;
// The VFX Armory's effects sound through the game's own audio (render/vfx/armory/soundOut.ts; a no-op without the Armory).
connectArmorySound(audio);
/** The feel pass, iteration two: the VS splash and the FIGHT! card heard on their beats (VsSplash.VS_BEATS) -
 *  the panels' whoosh and their two slams, the VS stamp, the blade that cuts the seam, the card's stroke and slam, and
 *  the announcer's FIGHT! (the arcade's own voice, scripts/survival/announcer). */
const FIGHT_LINE='/assets/audio/survival/announcer-fight.m4a';
const VICTORY_LINE='/assets/audio/survival/announcer-victory.m4a',FLAWLESS_LINE='/assets/audio/survival/announcer-flawless.m4a';
const onVsBeat=(beat:VsBeat)=>{
  if(beat==='panels')audio.ui(UI_SFX.panels,.5,.16);
  else if(beat==='stamp')audio.ui(UI_SFX.stamp,.5,.1);
  else if(beat==='cut')audio.ui(UI_SFX.cut,.5,.02);
  // (The voice situations: the local fighter answers the bell, then the nearest opponent - CombatAudio.bell.)
  else if(beat==='fight'){audio.ui(UI_SFX.fight,.55,.05);audio.announce(FIGHT_LINE,.95,.08);audio.bell();}
  else audio.ui(UI_SFX.slam,.5);
};
manga.onKnockout=()=>audio.ui(UI_SFX.ko,.5);
vsSplash.onBeat=onVsBeat;hud.introSplash.onBeat=onVsBeat;
// The ball modes' ceremonies (render/ball/BallCeremony.ts): the intro, a goal's sequence, the
// super shots' cut-ins, the podium, FREE PLAY's ball machine. Its splash page is heard as the VS splash is.
const ballShow=new BallShow(document.querySelector<HTMLElement>('#interface')??root);
const ballCeremony=new BallCeremony(view.scene,ballShow,{body:id=>fighters.get(id)?.group,inkFlash:seconds=>view.inkFlash(seconds),beat:beat=>{if(beat==='whistle')ballAudio.cue('whistle-serve');else onVsBeat(beat);}});
ballCeremony.onSkip=()=>network.room?.send('ball-skip');ballCeremony.clock=()=>timeline.drawnAt;/* (The duel mark on the drawn clock) */let ballCeremonyShown=false;const ceremonyBodies:Fighter[]=[];
/** An ultimate's cinema heard (render/FinisherCuts.ts): the player's own hit-confirmed one's camera move as it opens -
 *  the swoop under the glide; its blows and the finisher carry their own. */
let heardCinema=0;
/** The ultimate's name card (ui/CutIn.ts), once per cast: the player's own at its cast, an opponent's only once it has
 *  confirmed on the player, and the player's own transformation's at its start. Main-game modes, as the VS splash
 *  (elsewhere the HUD's own call-out names the move). It keeps off the fighters as they stand on the screen. */
const cutIn=new CutIn(document.querySelector<HTMLElement>('#interface')??root);
cutIn.onShow=()=>{audio.ui(UI_SFX.cutIn,.4);};
const cutInSeen=new Map<string,string>();
/** Whether the name card names the player's ultimates and transformation here (and the HUD's call-out leaves them to it). */
const carded=()=>!survival()&&!objectiveOf(network.snapshot)&&!riftOf(network.snapshot);
/** Training proper: the practice room, on the device or on the match server. The objective modes and Survival run on
 *  training-mode simulations too and their snapshots say so (ObjectiveMatch, SurvivalGame); they are not it, and nothing
 *  of Training's switch - its watch, its letting go of effects and voices with the fight on - is theirs. */
const practiceRoom=(snapshot:GameSnapshot|null|undefined)=>snapshot?.roomMode==='training'&&!survival()&&!objectiveOf(snapshot);
const boxPoint=new THREE.Vector3(),boxRight=new THREE.Vector3();
/** Where a fighter stands on the screen, roughly: the box round its feet, its middle and its crown, a body wide, as
 *  the view last drew it (CSS pixels); undefined behind the lens. */
function screenBox(f:Fighter):ScreenBox|undefined{
  const cam=view.camera,p=f.group.position,size=Math.max(f.state.size??1,bodyBulk(f.state)),w=innerWidth,h=innerHeight;
  boxRight.setFromMatrixColumn(cam.matrixWorld,0).setY(0).normalize();
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const up of [0,1.05,2.05])for(const across of [-.5,.5]){
    boxPoint.set(p.x+boxRight.x*across*size,p.y+up*size,p.z+boxRight.z*across*size).project(cam);
    if(!(boxPoint.z<1))continue;
    const x=(boxPoint.x*.5+.5)*w,y=(.5-boxPoint.y*.5)*h;
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  return left<=right?{left,top,right,bottom}:undefined;
}
function cutIns(snapshot:GameSnapshot){
  if(!carded())return;
  for(const p of snapshot.players){
    const key=cutInKey(p);
    if(cutInSeen.get(p.id)===key)continue;
    const awakening=awakeningCutIn(p,network.id),side=awakening?'mine':cutInSide(p,network.id);
    if(!side)continue;
    cutInSeen.set(p.id,key);
    // Kept off whoever's move it is, whoever it is aimed at, and the player.
    const avoid:ScreenBox[]=[];
    for(const id of new Set([p.id,p.target,network.id])){const body=id?fighters.get(id):undefined,box=body?screenBox(body):undefined;if(box)avoid.push(box);}
    cutIn.show(p.fighter,displayMove(p.fighter,awakening?AWAKENINGS[p.fighter].name:slotNames(p,'ultimate')?.name??moveFor(p.fighter,'ultimate',!!p.awakened).name),side,avoid);
  }
}
/* (Every room fighter's move sheets were fetched as the match started, for the ultimate's cut-in band, which drew the caster's
   card art: 6.9 MB for a pinned twelve-fighter royale, in the fight's first seconds. The name card that replaced the band shows
   none, and the HUD's cards show the player's own fighter, whose sheets Hud.enter warms, or a borrowed move's, which its card
   fetches as it shows it (moveCardArt.ts): no longer fetched. The performance sweep, 24 October 2026.) */
const objectiveAudio=new ObjectiveAudio(audio),riftAudio=new RiftAudio(audio);
audio.setMix({master:settings.volume,sfx:settings.sfxVolume,voice:settings.voiceVolume});music.setVolume(settings.volume*settings.musicVolume);
const homeVoice=new HomeVoice(root);homeVoice.setMix(settings.volume,settings.voiceVolume);
const startup=new Startup();startup.started=0;
const career=new CareerTracker(),careerUI=new CareerUI(root,career);
const party=new PartyClient(()=>({fighter:hud.selected,name:hud.playerName()})),partyUI=new PartyUI(root,party);
let startEpoch=0;
hud.onParty=()=>{homeVoice.stop();party.profileChanged();partyUI.show();};hud.onCareer=()=>{homeVoice.stop();careerUI.show();};
hud.onCustom=(type,value)=>network.room?.send(type,value);hud.objectives.onCustom=hud.onCustom;
partyUI.beforeReady=()=>prepareSelection(hud.selected);
// A fighter picked on the party's sheet is the home's selection too (its roster button, on its own volume), so the two
// never disagree; the home's onFighterSelect then tells the party.
partyUI.onFighter=fighter=>{const home=root.querySelector<HTMLElement>('.manga-home'),button=home?.querySelector<HTMLButtonElement>(`.home-fighter[data-fighter="${fighter}"]`);if(!button)return;
  const volume=button.closest<HTMLElement>('.home-volume')?.dataset.volume;if(volume)home!.querySelector<HTMLButtonElement>(`[data-volume-tab="${volume}"]`)?.click();button.click();};
party.onReturn=()=>{returnToLobby();partyUI.show();};
party.onTravel=async travel=>{partyUI.close();returnToLobby(false);await hud.onStart(hud.selected,'match',hud.playerName(),{kind:'party',travel});return started;};

Object.defineProperty(window,'jumpLoading',{get:()=>startup.snapshot()});
// (and hand the checks the match on this device, to set a moment up: `__ballMatch().view.fever = true`).
if(import.meta.env.DEV||['localhost','127.0.0.1','[::1]'].includes(location.hostname))(window as unknown as {__ballMatch:()=>unknown}).__ballMatch=()=>localBall.match;
// A development build (or one served from this machine) can start a ball match straight away, for the captures and checks
// that look at the ball modes: `__ballStart('goal-rush')`, `__ballStart('sky-spike', 'konta', 'quick')`, `__ballStart('goal-rush', undefined, 'bots', true)` (RUMBLE); a seventh argument, {arena, mutator, drill, queue, difficulty}.
if(import.meta.env.DEV||['localhost','127.0.0.1','[::1]'].includes(location.hostname))(window as unknown as {__ballStart:(mode:'goal-rush'|'sky-spike',fighter?:string,access?:'bots'|'quick'|'host',rumble?:boolean,practice?:boolean,couch?:'shared'|'split-v'|'split-h',extra?:{arena?:BallArenaId;mutator?:BallMutator;drill?:DrillId;lesson?:boolean;queue?:'classic'|'playlist'|'ranked';difficulty?:BotLevel})=>unknown}).__ballStart=(mode,fighter,access='bots',rumble=false,practice=false,couch,extra)=>hud.onStart((fighter as typeof hud.selected)??hud.selected,'match',hud.playerName(),{kind:'ball',mode,access,rumble,practice,...extra,...(couch?{couch:{partner:'taisei',screen:couch,sides:'same'}}:{})});
let reportCapture:((image:string)=>void)|undefined;
const bugReport=new BugReport(root,()=>({fighter:hud.selected,mode:started?(survival()?'survival':network.snapshot?.roomMode??'match'):'home',connection:(!started?'not connected':network.predictionReady?'connected':'reconnecting')+(started&&network===online?online.link.summary(performance.now()):''),input:input.mode,performance:view.perf(),loading:startup.snapshot()}),()=>new Promise<string>((resolve,reject)=>{
  const timer=setTimeout(()=>{reportCapture=undefined;reject(new Error('No arena frame'));},3000);
  reportCapture=image=>{clearTimeout(timer);resolve(image);};
}));
// The reports learn what only the page knows: the player's choice in Settings (read at every report), the screen, and
// the name they play under (never sent); and the canvas, whose context lost on screen is one.
errorReports.lend({enabled:()=>settings.errorReports!==false,screen:()=>started?(survival()?'survival':network.snapshot?.roomMode??'match'):'home',names:()=>[hud.playerName()]});
// (With what the page knew then: the GPU, read now - a lost context answers nothing - the quality, the fighters, the GPU's
// textures and geometries and the images' weight, the time since load, the host.)
{const gpu=gpuName(view.renderer.getContext());errorReports.watchCanvas(view.renderer.domElement,undefined,()=>{const images=textureBytes(view.scene);
  return lossDetails({gpu,quality:settings.quality,fighters:fighters.size,memory:{...view.renderer.info.memory},images:{count:images.images,bytes:images.bytes,largest:images.largest},seconds:performance.now()/1000,host:location.hostname});});}
// "Graphics reset — recovering…" while it is lost on screen (ui/graphicsNotice.ts); an online match is rejoined after the
// reload a loss that lasts forces (boot/rejoin.ts).
mountGraphicsNotice(view.renderer.domElement);
beforeLossReload(()=>{if(network===online&&started&&lastMatchStart){const token=online.keepForRejoin();if(token)saveRejoin(token,lastMatchStart);}});
hud.onReportBug=()=>{homeVoice.stop();document.exitPointerLock?.();input.clear();bugReport.show();};
let combatSpeaking=false,homeSpeaking=false;
audio.onVoiceActivity=active=>{combatSpeaking=active;music.duck(combatSpeaking||homeSpeaking);};
homeVoice.onActivity=active=>{homeSpeaking=active;music.duck(combatSpeaking||homeSpeaking);};
hud.onFighterPreview=(fighter,immediate)=>homeVoice.preview(fighter,immediate);
hud.onPreviewStop=()=>homeVoice.stop();
musicPanel.onClose=()=>{musicPanel.setEnabled(false);hud.setMusicEnabled(false);};
hud.onMusicToggle=enabled=>{hud.setMusicEnabled(enabled);musicPanel.setEnabled(enabled);};
hud.onFighterSelect=fighter=>{music.setContext(fighter,undefined,'lobby');party.profileChanged();void library.ensure([fighter]).then(trimLibrary).catch(()=>{});effects.prefetch(fighter);};
// Browsers require an activation before audible music. The first menu input
// starts the home playlist once, respecting the persisted music preference.
let homeMusicActivated=false;
const activateHomeMusic=()=>{if(homeMusicActivated||!settings.musicEnabled)return;homeMusicActivated=true;music.setContext(hud.selected,undefined,'lobby');musicPanel.setEnabled(true);};
window.addEventListener('pointerdown',activateHomeMusic,{once:true});
window.addEventListener('keydown',activateHomeMusic,{once:true});
let musicContext='';
input.onTarget=()=>{const s=network.snapshot,p=s?.players.find(p=>p.id===network.id);if(!s||!p)return;
  // A ball match: Tab turns the ball cam off (the follow camera you chose) and on again (render/ball/BallCam.ts).
  // Goal Rush: Tab is the stance instead - BALL, or FIGHT on the best opponent (game/ball/stance.ts).
  if(hasStances(ballOf(s))&&!couch.on){if(!ballStances[0].toggle(ballOf(s),p,s.players,input.yaw,ballField.ballPosition()))hud.notify('NOBODY TO LOCK',.6);return;}
  if(ballOf(s)&&!couch.on){ballCams[0].pressed(++ballCamPresses);hud.notify(ballCams[0].on?'BALL CAM':'FREE CAMERA',.7);return;}
  if(!p.alive&&(objectiveOf(s)||riftOf(s))){switchSquadSubject(p,s,1);return;}
  targetId=targeting.cycle(targetPlayers(s),p,input.yaw);if(!targeting.locked)autoLock.decline(s,startEpoch);hud.notify(targeting.locked?'LOCKED ON':'LOCK RELEASED',.7);};input.onMenu=(source,via='menu')=>{if(source==='controller')hud.focusBy('pad');/* A page opened from a pad, then the notice, go first (pageViewer.ts, firstVisit.ts). */if(source==='controller'&&(closePageViewer()||closeNotice()))return;/* Training's picker (TrainingSwapPicker) is the first thing any of them closes. */if(swapPicker.open){swapPicker.close();return;}if(via==='pause'){if(started||hud.settingsOpen)hud.toggleSettings();return;}if(fighterLabEntry?.open){fighterLabEntry.close();return;}if(finale.holding(seconds())&&!hud.settingsOpen){skipFinale();return;}if(vsSplash.open){vsSplash.skip();return;}if(!hud.settingsOpen&&riftOf(network.snapshot)&&riftUI.controllerAction('back'))return;if(shell.back(source))return;if(partyUI.open){partyUI.close();return;}if(careerUI.open){careerUI.close();return;}if(hud.objectives.closeSetup())return;if(bugReport.open){bugReport.dialog.close();return;}if(hud.skipIntro())return;if(hud.resultsOpen&&!hud.settingsOpen){hud.onLeave();return;}if((via==='menu'||hud.settingsOpen)&&(started||hud.settingsOpen||(source==='controller'&&hud.homeVisible)))hud.toggleSettings();};
input.onModeChange=mode=>{hud.setInputMode(mode,input.controllerLabel,input.family);survivalHud.setInputMode(mode,input.family);};
// The on-screen controls (input/touch.ts); a phone or tablet starts on them, and its prompts say so from the first page.
const touch=new TouchControls(input,root);touch.onEmote=emote;if(input.mode==='touch')input.onModeChange('touch');
// A phone or a tablet: full screen and landscape from GO (Android), the screen kept on in a fight, iOS's sound as media (ui/phoneShell.ts).
const phoneShell=new PhoneShell();
// The voice situations: an emote is a taunt in the fighter's own voice, where they have one (CombatAudio.say rests it).
onEmoteVoice(hero=>{audio.say('taunt',hero);});
/** A fight that cannot hold its frame rate steps the machine's quality down (qualityTier.ts). */
const qualityWatch=new QualityWatch();
input.onInteract=explicit=>{if(riftOf(network.snapshot))return riftUI.interact(explicit);return hud.objectives.interact();};
// A pad's press shows its focus frame again after a click hid it (Hud.focusBy, controller.css).
input.onUiAction=action=>{hud.focusBy('pad');/* A page opened from a pad (pageViewer.ts), then the notice over everything (firstVisit.ts). */if(pageViewerController(action)||noticeController(action))return;if(fighterLabEntry?.controller(action))return;if(finale.holding(seconds())&&!hud.settingsOpen){if(action==='confirm')skipFinale();return;}if(inkSelectController(action))return;if(swapPicker.controller(action))return;if(vsSplash.open&&(action==='confirm'||action==='back')){vsSplash.skip();return;}if(shell.controller(action))return;if(partyUI.controller(action)||careerUI.controller(action))return;if(bugReport.controller(action))return;if(riftIntro.open){riftIntro.skip();return;}if(!hud.settingsOpen&&riftOf(network.snapshot)&&riftUI.controllerAction(action))return;/* (The run's skill tree, opened from its menu, stands over the menu: the pad is the tree's.) */if((!hud.settingsOpen||survivalHud.treeShown)&&survival()&&survivalHud.controller(action))return;if(shopController(action))return;hud.controllerAction(action);};
/** Couch: a pad that came or went mid-fight moved the seats (couch/seats.ts reseat): each player is told in their own half what
 *  they are on now - "PLAYER 2 · XBOX PAD 1" - and on a shared screen both on one line. */
couch.onReseat=notices=>{if(couch.split)for(const n of notices)personal(couch.ids[n.seat],n.text,2.6);else if(notices.length)hud.notify(notices.map(n=>n.text).join('   '),2.6);};
hud.onPrivateStart=()=>network.startPrivateMatch();
for(const each of [online,arcade,practice,duel,royale,localObjective,localRift,localBall])each.onNotice=message=>{if(riftOf(network.snapshot))riftUI.notice(message);else hud.notify(message);};
// A split screen's halves (couch/CouchHud.ts): Player 2's target as drawn and their lens, and each seat's own shop - the
// purchase goes to that seat's fighter, and a refusal is said in that half.
couchHud.host={rift:riftUI,body:id=>fighters.get(id),camera:()=>camera2?.camera,act:(seat,type,payload)=>{const id=couch.ids[seat];if(!id)return undefined;if(network===localRift)return localRift.act(id,type,payload);if(network===localObjective&&type==='objective-buy')return localObjective.buy(id,payload);return undefined;}};
riftUI.onCustom=(type,payload)=>{if(type==='rift-requeue'||type==='rift-rematch'&&network===localRift)hud.onPlayAgain();else network.room?.send(type,payload);};
riftUI.onLeave=()=>hud.onLeave();riftUI.onPause=()=>hud.toggleSettings();
// (PLAY AGAIN on a ball match on this device is the same match again in place - LocalBall.rematch - with no loading screen.)
ballUI.onSend=(type,payload)=>network.room?.send(type,payload);ballUI.onKickOff=mode=>void hud.onStart(hud.selected,'match',hud.playerName(),{kind:'ball',mode,access:'bots',difficulty:'easy'});ballUI.onAgain=()=>{if(network===localBall&&localBall.rematch())return;hud.onPlayAgain();};ballUI.onLeave=()=>hud.onLeave();
localRift.onDisconnect=message=>{returnToLobby();hud.error(message);};
// Training's tools go to the room as they are - but a switch of fighter (the bar's FIGHTER and OPPONENT, the picker, and
// on this device the LABORATORY's own OPPONENT list) goes by way of `switchTraining`, which has the body here first.
hud.onTraining=command=>{const side=swapSideOf(command),value=side?(command as {value?:unknown}).value:undefined;
  if(side&&typeof value==='string'&&value in FIGHTERS&&((command as {lab:string}).lab!=='opponent'||network===practice)){void switchTraining(side,value as FighterId,!!(command as {random?:boolean}).random);return;}
  network.room?.send('training',command);};
hud.onResume=()=>{input.clear();if(settings.musicEnabled&&started)music.resume();};
const finale=new Finale(),seconds=()=>performance.now()/1000;
/** Whose page this is, as of the end on screen: a room gone takes its session id with it (Network.id). */
let finaleSelf='';
const skipFinale=(force=false)=>finale.skip(seconds(),force);
const finaleSkip=new FinaleSkip(root.querySelector<HTMLElement>('#interface')??root,()=>skipFinale());
hud.finale=hud.objectives.finale=riftUI.finale=ballUI.finale=()=>finale.holding(seconds());
/** The winner's line's length: as decoded, else as the manifest has it (the finale is timed on it). */
// (The voice situations: a winner with a win line of their own says that, and the finale is timed on it - CombatAudio.winLine.)
const lineSeconds=(fighter:FighterId)=>{const url=HOME_VOICES[fighter];return audio.winSeconds(fighter)??(url?audio.sampleSeconds(url):undefined)??HOME_VOICE_SECONDS[fighter];};
// Enter skips it, and a tap (a touch screen's confirm); the pad's confirm and Esc go through onUiAction and onMenu. Not a
// click or an attack key: a player still mashing the fight's buttons should see the winner, not skip them.
window.addEventListener('keydown',event=>{if((event.code==='Enter'||event.code==='NumpadEnter')&&!event.repeat&&!hud.settingsOpen&&finale.holding(seconds())){event.preventDefault();skipFinale();}},true);
window.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'&&!hud.settingsOpen&&finale.holding(seconds()))skipFinale();},true);
hud.objectives.onCommand=(action,role)=>{if(network===localObjective){if(action==='rematch')hud.onPlayAgain();return;}online.objectiveCommand(action,role);};
localObjective.onNotice=message=>hud.objectives.notice(message);localObjective.onDisconnect=message=>{returnToLobby();hud.error(message);};
let lastMatchStart:Parameters<typeof hud.onStart>|undefined;
// A friends' royale's PLAY AGAIN says "I'm in" for the next match in the same room, and the host's starts it (ui/social/roomAgain.ts).
hud.onPlayAgain=()=>{if(network.snapshot?.duel?.phase==='complete'&&network.snapshot.players.length===2){network.room?.send('duel-runback');return;}if(askRoomAgain(network.snapshot,network.room))return;if(party.joined){returnToLobby();partyUI.show();partyUI.notice('Ready up with your party for the next match.');return;}if(!lastMatchStart)return;const [fighter,mode,name,access]=lastMatchStart;
  // Round 5 (UX corrections): PLAY AGAIN · THE SAME BOT RIVAL keeps the rival it names.
  const rival=access?.kind==='duel'&&access.access==='bot'?duel.snapshot?.players.find(p=>p.isBot)?.fighter:undefined;
  const nextAccess=rival&&access?.kind==='duel'?{...access,rival}:access?.kind==='duel'&&(access.access==='host'||access.access==='join')?{kind:'duel' as const,access:'host' as const,place:access.access==='host'?access.place:undefined}:access?.kind==='create-private'||access?.kind==='join-private'?{kind:'create-private' as const,players:network.snapshot?.lobby?.size??8,place:access.kind==='create-private'?access.place:undefined}:access;returnToLobby();void hud.onStart(fighter,mode,name,nextAccess);};
hud.onPractice=()=>{const fighter=lastMatchStart?.[0]??hud.selected,name=lastMatchStart?.[2]??'Fighter';returnToLobby();void hud.onStart(fighter,'training',name);};
// The launch: a lone online Duel queue's FIGHT A BOT (WaitingDock, after 30 s) leaves the queue for the BOTS way's Duel on
// this device - the server hosts no bot Duel - against the rival the player picked for it, if any.
/** Leaves the online room for the same match on this device (loneQueue), and says why. The royale is played where the room
 *  was dealt, so its place stays loaded through the switch (keepPlace, wantStage): it used to be let go, geometry, images
 *  and all, and built again from its files for the device match - 0.6-0.8 s of the switch's 2.2 s on a desktop. */
function playLocally(local:NonNullable<ReturnType<typeof loneQueue>>){const [fighter,mode,name]=lastMatchStart!;loneNotice();standby.begin(queueModeOf(local));keepPlace=local.kind==='bots'?local.place??null:null;try{returnToLobby();}finally{keepPlace=null;}void hud.onStart(fighter,mode,name,local);}
hud.onFightBot=()=>{const [fighter,,name,access]=lastMatchStart??[hud.selected,'match',hud.playerName(),undefined],rival=(access?.kind==='duel'?access.rival:undefined)??modePrefs('duel').rival;standby.begin('duel');returnToLobby();void hud.onStart(fighter,'match',name,{kind:'duel',access:'bot',rival,place:namedPlaceFor('duel','offline')});};
mountSocialPlay(root.querySelector<HTMLElement>('#interface')??root,()=>pageWhere({started,online:network===online,snapshot:network.snapshot,selfId:network.id,access:lastMatchStart?.[3],
  local:network===royale?'royale':network===duel?'duel':network===localRift?'rift-war':network===arcade?'arcade':network===localObjective?objectiveOf(network.snapshot)?.kind:undefined}),
  mode=>{const [fighter,,name]=lastMatchStart??[hud.selected,'match',hud.playerName()],access=queueAccess(mode,fighter);if(!access)return;standby.end();returnToLobby();void hud.onStart(fighter,'match',name,access);});
hud.onSettings=s=>{setVfxLevel(s.vfx);setCommentary(s.commentary);Fighter.animStyle=animOverride??s.animStyle;input.sensitivity=s.sensitivity;input.rumble.scale=s.vibration;effects.density=s.effects;manga.density=s.effects;view.applySettings(s);audio.setMix({master:s.volume,sfx:s.sfxVolume,voice:s.voiceVolume});homeVoice.setMix(s.volume,s.voiceVolume);music.setVolume(s.volume*s.musicVolume);};
hud.onStart=async(fighter,mode,name,access)=>{{const refused=activePack()&&packRefuses(mode,access as {kind:string});if(refused){hud.error(refused);return;}}if(party.joined&&access?.kind!=='party'){partyUI.show();partyUI.notice(party.view?.leader===party.id?'You lead a party: choose the match here and START it together.':'You are in a party: READY here, and your leader starts the match.');return;}const laboratory=mode==='training'&&(!access||access.kind==='public')&&fighter===laboratoryFighter()?fighter:undefined;const epoch=++startEpoch;if(!laboratory&&lockedStart(fighter,mode==='training'))return;fighterLabEntry?.close();homeVoice.stop();
  // On a thin line (loading/backgroundPolicy.ts thinLine) the sound bank waits while the room's bodies, stage and effects come in
  // (CombatAudio.holdFetches; opened by the room's load as its compile begins, or when this start ends). Not for a survival run:
  // its story plays sounds over the load.
  let openAudio=()=>{};if(thinLine()&&!(access?.kind==='survival'||access?.kind==='coop-create'||access?.kind==='coop-join'||access?.kind==='party'&&access.travel.mode==='survival'))audio.holdFetches(new Promise<void>(open=>{openAudio=open;}),60_000);
  void audio.unlock().then(()=>audio.preload([FIGHT_LINE,VICTORY_LINE,FLAWLESS_LINE])).catch(console.warn);try{hud.busy(true);
    const riftRun=access?.kind==='rift-war'&&access.access==='bots';
    const ballRun=access?.kind==='ball'&&access.access==='bots';
    const arcadeRun=access?.kind==='survival',coopRun=access?.kind==='coop-create'||access?.kind==='coop-join'||access?.kind==='party'&&access.travel.mode==='survival';
    let firstWorld:Promise<void>=Promise.resolve(),story:Promise<void>=Promise.resolve();
    // Training on its own is played here: there is nobody to connect to (see LocalTraining).
    const objectiveRun=access?.kind==='objective'&&(access.access==='bots'||access.access==='solo');
    const royaleRun=access?.kind==='bots';
    const duelRun=access?.kind==='duel'&&(access.access==='bot'||access.access==='couch');
    // Couch (couch/couch.ts): the Duel's versus and Training's (the two face to face, no dummy: LocalTraining), the arcade's
    // co-op, and every other mode's field - Player 2 among the others.
    const couchStart=couchOf(access);
    const couchKind:CouchKind|undefined=access?.kind==='duel'&&access.access==='couch'||couchStart&&access?.kind==='training'?'versus':access?.kind==='survival'&&access.partner?'coop':couchStart&&(access?.kind==='bots'||access?.kind==='objective'||access?.kind==='rift-war'||access?.kind==='ball')?'field':undefined;
    couch.end();endSplit();
    const lesson=access?.kind==='training'&&!!access.tutorial;
    const practiceRun=mode==='training'&&(!access||access.kind==='public'||access.kind==='training')&&(LocalTraining.wanted()||!!couchStart||lesson);
    const loadingMode:LoadingMode=loadingModeFor(access,mode,arcadeRun||coopRun);
    if(!((arcadeRun||coopRun)&&RiftIntro.wanted()))loadingScreen.show(fighter,loadingMode,access?.kind==='bots'?access.players:undefined);
    loadingScreen.progress('prepare');
    // A newer build on the site: reload onto it now, before this one's chunks and models fail (a party's seat waits for nobody).
    if(access?.kind!=='party'&&await beforeStart())return;
    // The player's own fighter, the sky and their effects (prepareSelection) are not waited for before the room: they come in
    // beside its connection and the room's own assets, and are waited for with those (ensureSnapshotAssets), before anything is
    // compiled. Waited for here, they held a pinned royale's first fighter request back 1.1 s after PLAY, the selected
    // fighter's Armory chunks sharing the line with the sound bank's first hundred cues (the performance sweep, 24 October 2026).
    library.background(false);const selection=prepareSelection(fighter);selection.catch(()=>{/* thrown where it is waited for */});
    loadingScreen.progress('connect');
    hud.loading(arcadeRun?'Opening the rift…':coopRun?'Opening a co-op rift…':practiceRun?'Entering training…':objectiveRun?'Entering the battlefield…':'Connecting to arena…',100);await network.leave();
    // A new session's players are numbered afresh (sparring-bot, bot-1 ...): the last session's bodies go with it.
    clearFighters();resetSwaps();
    pauseLink.reset();roomFrozen=false;fightShown=false;
    network=riftRun?localRift:ballRun?localBall:royaleRun?royale:duelRun?duel:arcadeRun?arcade:practiceRun?practice:objectiveRun?localObjective:online;timeline.delayMs=riftRun||ballRun||royaleRun||duelRun||arcadeRun||practiceRun||objectiveRun?LOCAL_DELAY:ONLINE_DELAY;
    audio.reset();areaFx.reset();effects.reset();castFx.now?.reset();awakeningEffects.reset();clashEffects.reset();manga.reset();timeline.reset();lastEvent=0;targetId=null;targeting.reset();viewKeys.reset();objectiveAudio.reset();riftAudio.reset();survivalTargets.clear();riftTargets.clear();riftPredictionTargets.clear();riftAssets.clear();riftField.clear();riftUI.clear();ballField.clear();ballUI.clear();ballTargets.clear();ballReplay.clear();ballCeremony.clear();stanceMarks.clear();passMark?.hide();clearKicks();spikeCues.clear();spikeCues2.clear();ballStances[0].reset();ballStances[1].reset();ballChases[0].cut();ballChases[1].cut();camera.reset();
    horde.clear();grunts.clear();gore.clear();survivalFx.reset();techniques.reset();lastEntrance=0;lastRoar=0;bossesWanted='';lastHordeVoice=0;lastBossVoice=0;lastSmash=0;bossShoutAt.clear();stages.rift?.restore();
    if(arcadeRun||coopRun)audio.preload(everyTake());
    if(access?.kind==='objective'&&access.objective==='last-stand'||access?.kind==='party'&&access.travel.mode==='last-stand')objectiveAudio.preload();
    // The story, over the run's own loading, once a session.
    if((arcadeRun||coopRun)&&RiftIntro.wanted()){riftIntro.preload();story=riftIntro.play();}
    /** The couch's seats for this mode - the ones its sheet showed (CouchStart.seats), else planned now (swapped as the sheet
     *  says) - Player 1 under the mode's own id for the page. */
    const seatCouch=(kind:CouchKind,sheet:ModeId)=>couch.begin(kind,couchStart?.seats??plannedSeats(!!modePrefs(sheet).couchSwap),{ids:[network.id,SECOND],screen:couchStart?.screen});
    if(ballRun&&access?.kind==='ball'){await localBall.connect(access.mode,fighter,name,couchKind==='field'?couchStart?.partner:undefined,couchStart?.sides==='rivals',!!access.rumble,!!access.practice,{mutator:access.mutator,drill:access.drill,lesson:access.lesson,look:myBallLook(),arena:access.arena,difficulty:access.difficulty,volleyball:volleyballWanted(location),...(footballOn&&access.mode==='goal-rush'?{football:true}:{})});localClock=localBall.snapshot?.serverTime??0;
      if(couchKind==='field'){seatCouch('field',access.mode);localBall.second=()=>ballAim(couch.command(SECOND),1);}
    }else if(riftRun){await localRift.connect(fighter,name,1,couchKind==='field'?couchStart?.partner:undefined);localClock=localRift.snapshot?.serverTime??0;
      if(couchKind==='field'){seatCouch('field','rift-war');localRift.second=()=>couch.command(SECOND);}
    }else if(arcadeRun){
      // The horde's meshes and any probe boss, before the first rift opens
      // (see arcade.prepare); the round's own bosses load as they are drawn.
      await arcade.connect(fighter,mode,name,access?.kind==='survival'&&access.partner?{partner:{fighter:access.partner,name:'Player 2'}}:{});localClock=arcade.snapshot?.serverTime??0;
      if(couchKind==='coop'){seatCouch('coop','arcade');arcade.second=()=>couch.command(SECOND);}
      survivalHud.enter(fighter);
    }else if(royaleRun&&access?.kind==='bots'){
      await royale.connect(fighter,name,access.players,access.place,access.field,couchKind==='field'?couchStart?.partner:undefined);localClock=royale.snapshot?.serverTime??0;
      if(couchKind==='field'){seatCouch('field','royale');royale.second=()=>couch.command(SECOND);}
    }else if(duelRun){
      await duel.connect(fighter,name,access?.kind==='duel'?access.rival:undefined,access?.kind==='duel'?access.place:undefined,couchKind==='versus');localClock=duel.snapshot?.serverTime??0;
      if(couchKind==='versus'){seatCouch('versus','duel');duel.second=()=>couch.command(SECOND);hud.notify(couch.split?'COUCH VERSUS · SPLIT SCREEN':'COUCH VERSUS · PLAYER 1 ON THE LEFT · PLAYER 2 ON THE RIGHT',4);}
      // Lock combat (the experiment's preview, game/lockMode.ts): what it is, or who plays it.
      else if(lockCombatFor(fighter)){lockTold=true;hud.notify('LOCK COMBAT · MASH TO COMBO · GUARD WHEN THE RING CLOSES TO VANISH',4.5);}
    }else if(practiceRun){
      await practice.connect(fighter,name,couchKind?couchStart?.partner:undefined,{tutorial:lesson});localClock=practice.snapshot?.serverTime??0;
      if(lesson)guided.begin(fighter);
      if(couchKind){seatCouch('versus','training');practice.second=()=>couch.command(SECOND);hud.notify(couch.split?'COUCH TRAINING · SPLIT SCREEN':'COUCH TRAINING · PLAYER 1 ON THE LEFT · PLAYER 2 ON THE RIGHT',4);}
    }else if(objectiveRun&&access?.kind==='objective'){
      await localObjective.connect(fighter,name,access.objective,access.access as 'solo'|'bots',1,access.place,couchKind==='field'?couchStart?.partner:undefined);localClock=localObjective.snapshot?.serverTime??0;
      if(couchKind==='field'){seatCouch('field',access.objective);localObjective.second=()=>couch.command(SECOND);}
    }else{
      await online.connect(fighter,mode,name,access);
      // The party gathers in the first act's world, and its horde loads meanwhile.
      if(coopRun){coopRunSeen=-1;coopTravel='';survivalHud.enter(fighter);firstWorld=prepareRound(1,[]);}
    }
    if(epoch!==startEpoch)return;
    const careerMode:CareerMode=access?.kind==='ball'?access.mode:access?.kind==='rift-war'?'rift-war':access?.kind==='duel'?'duel':arcadeRun?'survival':coopRun?'coop':access?.kind==='party'?(access.travel.mode==='royale'?'private':access.travel.mode) as CareerMode:access?.kind==='objective'?access.objective:access?.kind==='bots'?'bots':access?.kind==='create-private'||access?.kind==='join-private'?'private':'royale';
    if(mode!=='training')career.start(careerMode);
    playerTwoPresence(mode==='training'?'Training':CAREER_MODES[careerMode]);
    loadingScreen.progress('room');
    const joined=performance.now();while(!network.snapshot){if(epoch!==startEpoch)return;if(performance.now()-joined>12000)throw new Error('The arena did not respond. Try again.');await new Promise(resolve=>setTimeout(resolve,50));}
    {const room=network.snapshot,stage=room.stage??'harbor';
      loadingScreen.room(shownStage(stage)?.name,room.players.filter(p=>!p.enemy).map(p=>({fighter:p.fighter,self:p.id===network.id})),id=>library.has(id),()=>stageLoaded===stage);}
    loadingScreen.progress('assets');
    // (Its bodies are built and warmed inside, before the room hears this page is ready.)
    await ensureSnapshotAssets(network.snapshot,()=>{loadingScreen.progress('warm');openAudio();},selection);if(epoch!==startEpoch)return;
    pilot=autopilotParam&&autopilotAllowed?new Autopilot(.8,network.id):undefined;
    if(couch.split&&network.snapshot)beginSplit(network.snapshot);else if(couch.on)couchHud.share(()=>couch.seats.seats);
    hud.setSurvival(arcadeRun||coopRun);lastMatchStart=[fighter,mode,name,access?.kind==='bots'&&access.lone?{kind:'bots',players:access.players}:access];hud.resultAgainLabel=access?.kind==='duel'?(access.access==='online'?'FIND NEXT DUEL':access.access==='bot'?'DUEL AGAIN':'NEW FRIEND DUEL'):access?.kind==='create-private'||access?.kind==='join-private'?'NEW PRIVATE ROOM':'PLAY AGAIN';
    music.setContext(fighter,undefined,'combat',{mode:network.snapshot?modeOfSnapshot(network.snapshot,arcadeRun||coopRun):undefined,turn:startEpoch});musicPanel.setEnabled(settings.musicEnabled);started=true;fetchPlannedBots();clearInterval(inputTimer);inputClock.reset();unacked.length=0;inputTimer=setInterval(pushInput,1000/INPUT_HZ) as unknown as number;hud.enter(fighter);loadingScreen.done();input.enabled=true;
    // Round 5 (SOLOPAUSE): a frame of the fight drawn behind the fading loading screen - a local match's clock starts
    // now, and a versus room hears it (ReadyGate) and runs its READY hold from here, then FIGHT.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(epoch!==startEpoch)return;fightShown=true;if(network===online)online.ready();
      // A party's co-op room starts its run by itself once every member has the first world in (SurvivalRoom's PartyStart):
      // this page says so when its loading screen is gone, the world is ready and the story (a first run's) is over.
      if(coopRun&&access?.kind==='party')void Promise.all([firstWorld.catch(()=>{}),story]).then(()=>{const run=online.run?.run;if(epoch===startEpoch&&network===online&&run!==undefined)online.loaded(run);});}));
    if(practiceRun&&!lesson){const room=network.snapshot!,foe=room.players.find(p=>p.isBot);
      // 420 ms lets the loading screen's fade clear first.
      if(foe){vsPending=true;setTimeout(()=>{vsPending=false;if(epoch!==startEpoch)return;
        void vsSplash.play({left:{fighter,name:FIGHTERS[fighter].name,tag:`YOU · ${name}`},rights:[{fighter:foe.fighter,name:FIGHTERS[foe.fighter].name,tag:'SPARRING BOT'}],stage:shownStage(room.stage)?.name})
          .then(()=>{if(epoch===startEpoch)void vsSplash.fight();});},420);}}
    // The view starts along the player's own fighter's facing, behind them (launch day, 12 October 2026: in every mode, not
    // the objectives and the rift alone - a room joined with its fight already on, or one whose bell rang while this page
    // was still loading, used to be handed pi whatever way its fighter stood), and the camera holds it from now (lookAlong).
    input.yaw=network.snapshot?.players.find(p=>p.id===network.id)?.yaw??Math.PI;camera.lookAlong(input.yaw);}catch(error){loadingScreen.hide();if(epoch!==startEpoch)return;await network.leave();library.background(true);network=online;if(await recover(error))return;
    reportStartFailure(error);
    // (A download that failed on the way says so in words, with RETRY: ui/startFailure.ts.)
    showStartFailure(hud,error,access?.kind==='party'?undefined:()=>void hud.onStart(fighter,mode,name,access));}finally{openAudio();}};
survivalHud.onChoose=id=>{if(network===arcade)arcade.choose(id);else online.choose(id);};
survivalHud.onReroll=()=>{if(network===arcade)arcade.reroll();else online.reroll();};
/** What a round needs drawn before its first rift opens: the horde's meshes
 *  (built once) and any probe bosses, loaded and compiled off the clock. */
async function prepareRound(_round:number,extra:readonly string[],stage?:StageId){
  const epoch=startEpoch,current=()=>epoch===startEpoch;
  if(!started)hud.loading('Summoning the horde…',100);
  gore.prepare(); // The stains' splats, painted before the uploads below if the page's idle time has not painted them yet (Gore.prepare).

  // Travel must prepare the destination, not compile the stage being left.
  // LocalArena/online travel keep the fight held until this promise resolves.
  const [,stageTextures]=await Promise.all([grunts.load(),stage&&isRiftStage(stage)?preloadRiftAssets(stage):[]]);
  if(!current())return;
  if(stage)await stages.preload(stage);
  if(!current())return;
  if(extra.length)await horde.load(extra,label=>{if(!started)hud.loading(label,100);});
  if(!current())return;
  const release=extra.length?horde.warm(view.scene,extra):()=>{};
  try{await view.compileScene();if(current()){if(started)await view.uploadTexturesOverFrames(current,stageTextures);else view.uploadTextures(undefined,stageTextures);}}
  catch(error){console.warn('Survival: warm-up failed',error);}finally{release();}}
arcade.prepare=prepareRound;
/** The bosses the run has drawn - this round's, the next's, the champion's -
 *  loaded as soon as they are known, and the rest let go. */
let bossesWanted='';
function wantBosses(ids:readonly string[],portraits=true){
  ids=[...new Set(ids.filter(id=>!!ENEMIES[id]))].sort();
  const models=[...new Set(ids.map(id=>ENEMIES[id].model))].sort();
  const key=`${portraits}:`+models.join(',');
  const added=models.some(model=>!bossesWanted.includes(model));
  if(key===bossesWanted)return;
  bossesWanted=key;
  const epoch=startEpoch,current=()=>epoch===startEpoch&&key===bossesWanted&&started;
  void horde.load(ids).then(()=>{
    if(!current()){horde.collect();return;}
    horde.keepOnly(ids);if(!added)return;
    const release=horde.warm(view.scene,ids);
    const warm=warming.then(async()=>{
      for(const root of horde.warmRoots(ids)){
        if(!current())return;
        await view.compileScene(root);
      }
    }).finally(release);
    warming=warm.then(()=>{},()=>{});
  }).catch(error=>console.warn('Survival: boss load failed',error));
  // Their entrance cards' portraits, so a card never opens on an empty frame.
  if(portraits)for(const id of ids){const portrait=new Image();portrait.decoding='async';portrait.src=`/assets/survival/portraits/${id}.webp`;}
  horde.keepOnly(ids);
}
/** Co-op: the run the HUD last drew, and the journey whose world is loading. */
let coopRunSeen=-1,coopTravel='';
/** What a co-op frame asks of this browser: a new run (the host took the
 *  party back to the lobby) starts the HUD afresh, and a journey to the next
 *  act loads its world and says so, so the room can move the fight there. */
function coopFrame(sv:RunView){
  // The run has started without this browser's intro finished: into the fight.
  if(sv.phase!=='lobby'&&riftIntro.open)riftIntro.close();
  if(sv.run!==undefined&&sv.run!==coopRunSeen){
    if(coopRunSeen>=0){survivalHud.enter(sv.party[0]?.fighter??hud.selected);survivalFx.reset();techniques.reset();lastEntrance=0;lastRoar=0;lastHordeVoice=0;lastBossVoice=0;lastSmash=0;stages.rift?.restore();}
    coopRunSeen=sv.run;
  }
  if(sv.phase==='travel'&&sv.run!==undefined){const run=sv.run,key=`${run}:${sv.round}`,epoch=startEpoch;if(key!==coopTravel){coopTravel=key;void prepareRound(sv.round+1,[],sv.next).catch(console.warn).finally(()=>{if(epoch===startEpoch&&network===online)online.loaded(run);});}}
}
survivalHud.onRetry=()=>{if(coop()){online.backToLobby();return;}const fighter=arcade.game?.fighter??hud.selected;void hud.onStart(fighter,'match','You',{kind:'survival',...(arcade.partner?{partner:arcade.partner.fighter}:{})});};
survivalHud.onLeave=()=>returnToLobby();
const autopilotParam=new URLSearchParams(location.search).has('autopilot');
const autopilotAllowed=import.meta.env.DEV||['localhost','127.0.0.1','[::1]'].includes(location.hostname);
/** `?autopilot`: plays the fighter this browser is given, solo or in a party, where `autopilotAllowed` (above). It used to farm
 *  Sumi AFK in public co-op and parties (8 October 2026). */
let pilot:Autopilot|undefined;
/** Input leaves on the simulation's own clock, not on the render loop's.
 *  Sending from the frame loop meant a client at thirty frames a second also
 *  pressed buttons at thirty a second, and one under software rendering at
 *  five - a press could sit unsent for a fifth of a second before anything,
 *  local or authoritative, had heard about it. */
let inputTimer=0;
/** Whole ticks of real time, slowed slightly while the server reports a
 *  standing input queue for this client (see InputClock). */
const inputClock=new InputClock();
/** One command: sample the keys, send it, and advance the local copy by the
 *  tick it represents. */
function sendCommand(){
  const snapshot=network.snapshot;
  if(!snapshot||!network.id)return;
  // Round 4 (CAMERA): in the main game the run is read against the view less
  // whatever the dynamic camera (or a view key's swing) turned by itself since
  // the movement keys changed, so a camera turning on its own never bends a run
  // in progress (FollowCamera.movementBasis); the aim stays on the view.
  // Couch play: both seats' commands come from the couch (couch/couch.ts), read against its own camera; the second goes
  // with the first, through the local mode's `second` (LocalDuel, LocalArena).
  if(couch.on){const own=ballAim(couch.command(couch.ids[0]),0);if(own&&network.send(own))prediction.submit(own);return;}
  const moving=movementMask(input.keys);
  // A ball match aims every press at the ball, as its room does (BallMatch.submit): the page's prediction homes the same way.
  // (Goal Rush's ball cam lays the frame along its own heading: the keys and the aim are read against it.)
  const chased=ballChases[0].active;
  let command=input.command(ballOf(network.snapshot)?BALL_ID:targetId,viewKeys.movementBasis(chased?ballChases[0].yaw:camera.movementBasis(moving),moving));
  // Launch day (the arena camera, FollowCamera ARENA): with an opponent held, what the simulation aims by - a swing, a
  // guard's facing, a dash with no direction - is the line to them, as the keys above are read against it; the view
  // itself in every other mode, and with nobody held.
  command.yaw=chased?ballChases[0].yaw:camera.aimYaw;
  command.lock=targeting.locked; // Round 3b (TARGET): unlocked, each attack goes to the enemy faced (simulation chooseIntent).
  ballAim(command,0); // Goal Rush's stance (game/ball/stance.ts): the ball, or the opponent locked.
  // (SPORT mode: whether PASS and SPRINT are held - a held PASS is lofted, SPRINT runs while held - for the match on this
  // device; the online room never has SPORT mode.)
  if(sporting()&&!ballStances[0].lock)Object.assign(command,input.sportHeld());
  // Lag compensation: when the others were, as this page is drawing them (ArenaSimulation.rewind).
  if(network===online&&timeline.drawnAt!==null)command.view=timeline.drawnAt;
  // `?autopilot`: the arcade plays itself, for captures and checks.
  if(pilot&&survival()){const auto=pilot.command(snapshot.players,snapshot.serverTime);command={...auto,seq:command.seq};if(auto.targetId)targetId=auto.targetId;}
  const sent=exercise.active?exercise.command(command,snapshot,network.id)
    :input.enabled?command:{...command,moveX:0,moveZ:0,attack:undefined,jump:false,dash:false,guard:false,awaken:false};
  footStick.x=sent.moveX;footStick.z=sent.moveZ;
  noteBallStick(network.id,sent.moveX,sent.moveZ); // The sport kit: the stick a spike's arm and a BACK SET are chosen by (ballMoves.ts)
  if(!network.send(sent))return;if(network===online)unacked.push(sent.seq);
  // (An online ball room's own touch of the ball, forecast around the prediction's step - BallTargets.)
  const forecasting=network===online&&prediction.enabled&&!!ballOf(snapshot);if(forecasting)ballTargets.beforeStep();
  prediction.submit(sent);if(forecasting)ballTargets.afterStep();
  for(const cast of presentEvents(prediction.takeCasts(),snapshot.players)){
    if(cast.fighter==='konta'&&cast.slot==='heavy')predictedVisuals.push({...cast,id:PREDICTED_EVENT_BASE+cast.id});
    if(cast.slot)predictedCasts.set(castKey(cast),performance.now());
    if(cast.slot==='area'&&cast.move&&cast.fighter)showAreaBanner(cast.body??cast.fighter,cast.move,cast.fighter);
    else if(cast.move&&!(cast.slot==='ultimate'&&carded()))hud.notify(displayMove(cast.fighter,cast.move).toUpperCase(),1.1);
    audio.handle([{...cast,id:PREDICTED_EVENT_BASE+cast.id}],network.id,presentPlayers(snapshot.players));
  }
}
/** Input leaves on its own clock and the local copy advances with it, in whole
 *  ticks of real time rather than one tick per callback. See `catchUp` for why
 *  the backlog exists and why its ceiling is not five ticks, and `InputClock`
 *  for why the clock sometimes runs a little slow. */
const MAX_IN_FLIGHT=40,unacked:number[]=[];
function inFlight(){
  const ack=network.snapshot?.players.find(p=>p.id===network.id)?.ackSeq;
  if(ack!==undefined)while(unacked.length&&unacked[0]<=ack)unacked.shift();
  return unacked.length;
}
function pushInput(){
  if(!started||!network.snapshot||!network.id||!network.predictionReady)return;
  // This pump also runs between render frames. Menus and hidden tabs must freeze
  // local matches before sending a tick, even when requestAnimationFrame stops.
  localPausePump();
  if(localNetwork()?.paused){inputClock.reset();return;}
  // Round 5 (SOLOPAUSE): nothing is sent - so nothing is predicted - while the room is frozen, or freezing, for this page.
  if(network===online&&pauseLink.holding){inputClock.reset();return;}
  // Night net: a snapshot the prediction kept back (a burst, or a costly replay) is replayed before this tick's commands are made.
  if(network===online)prediction.flush();
  const due=inputClock.advance(performance.now()),wire=network===online;
  for(let steps=0;steps<due&&!(wire&&inFlight()>=MAX_IN_FLIGHT);steps++)sendCommand();
}
/** Round 5 (SOLOPAUSE): what this page wants of a room that pauses for it - held while the menu or a bug report
 *  is open, or the tab is hidden - told to the room (PauseLink). Every frame, every snapshot, and as the tab hides (no
 *  frames run behind a hidden tab). */
function localPausePump(){
  const local=localNetwork();if(!local)return;
  local.paused=bugReport.open||hud.settingsOpen||document.hidden||!fightShown||ballHeld
    ||network===arcade&&riftIntro.open||network===practice&&(vsSplash.open||vsPending||swapPicker.open);
}
function pausePump(){
  localPausePump();
  if(network!==online||!online.room)return;
  const request=pauseLink.update(document.hidden||started&&(bugReport.open||hud.settingsOpen||swapPicker.open),performance.now());
  if(request)online.control(request);
}
document.addEventListener('visibilitychange',pausePump);
// Prediction.stop frees its Rapier world. Invalidate the cached pointer and
// pending loads as well, so reopening the same stage never reuses freed WASM.
/** The ball modes' sound (src/audio/ballAudio.ts): the ball, the referee, the stands, the caller
 *  and the music's climax, from each snapshot. The camera's punches stay here: your own SKY SPIKE, a CLASH near you - in
 *  Goal Rush; Sky Spike's camera holds still and makes its own few moves (render/ball/SpikeCam.ts). */
let ballHeard=0,ballHeardAt=-Infinity,ballMark='';
const ballAudio=new BallAudio(audio,music);
// (A check on this machine logs each hit of the ball as it is played: `__ballSfx = []` - page ms it sounds at, the sound,
// the page's own forecast touch's or the room's, the page's own fighter's touch or not; `__ballAudio.counts` tallies.)
if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)){ballAudio.trace=(id,own,mine,delay)=>{(window as unknown as {__ballSfx?:unknown[][]}).__ballSfx?.push([performance.now()+delay*1000,id,own,mine,delay]);};(window as unknown as {__ballAudio:BallAudio}).__ballAudio=ballAudio;}
function ballSounds(snapshot:GameSnapshot){
  const view=ballOf(snapshot);if(!view)return;
  if(snapshot.serverTime<ballHeardAt-1)ballHeard=0;ballHeardAt=snapshot.serverTime;
  // (BallMatch DOUBLE: how soon the page's own fighter's swing under way lands, its cast's move as the simulation
  // picks it - a body's touch just ahead of it is the swing's.)
  const me=snapshot.players.find(p=>p.id===network.id),move=me?castMove(me):undefined;
  for(const e of ballAudio.update(snapshot,network.id,me&&move?nextContact(move.contacts,me.actionTime*me.actionDuration):Infinity)){if(e.id<=ballHeard)continue;ballHeard=e.id;if(view.mode==='sky-spike')continue;
    if(e.kind==='strike'&&e.text==='SKY SPIKE'&&e.actorId===network.id)camera.impact(.7);
    else if(e.kind==='clash'){const me=snapshot.players.find(p=>p.id===network.id);if(me&&Math.hypot(me.x-e.x,me.z-e.z)<18)camera.impact(.9);}
  }
}
function returnToLobby(tellParty=true){couch.end();endSplit();finale.reset();resetSwaps();pauseLink.reset();roomFrozen=false;fightShown=false;vsSplash.skip();audio.setSpace(undefined);audio.setAmbience(undefined);cutIn.hide();cutInSeen.clear();loadingScreen.hide();library.background(true);startEpoch++;career.leave();playerTwoPresence(null);if(tellParty)party.send('party-home');objectivePhase='';objectiveRound=0;duelRoundKey='';matchBell.reset();objectiveField.reset();started=false;riftIntro.close();survivalHud.leave();horde.clear();grunts.clear();gore.clear();bossesWanted='';survivalFx.reset();techniques.reset();horde.keepOnly([]);hud.setSurvival(false);introFor=null;victoryFor=null;clearInterval(inputTimer);inputTimer=0;prediction.stop();localCollision=undefined;localCollisionStage=null;collisionGeneration++;predictedCasts.clear();predictedVisuals.length=0;wantStage('harbor');input.enabled=false;input.clear();document.exitPointerLock?.();void network.leave();audio.reset();effects.reset();castFx.now?.reset();awakeningEffects.reset();clashEffects.reset();manga.reset();timeline.reset();clearFighters();lastEvent=0;targetId=null;targeting.reset();viewKeys.reset();objectiveAudio.reset();riftAudio.reset();survivalTargets.clear();riftTargets.clear();riftPredictionTargets.clear();riftAssets.clear();riftField.clear();riftUI.clear();ballField.clear();ballUI.clear();ballTargets.clear();ballReplay.clear();ballCeremony.clear();stanceMarks.clear();passMark?.hide();clearKicks();spikeCues.clear();spikeCues2.clear();ballStances[0].reset();ballStances[1].reset();ballChases[0].cut();ballChases[1].cut();ballHeard=0;camera.reset();musicContext='';music.setContext(hud.selected,undefined,'lobby');network=online;timeline.delayMs=ONLINE_DELAY;hud.lobby();fighterLabEntry?.show();}
// Out of a party's match: home, and back on the party's sheet, where the others are seen coming home too.
hud.onLeave=()=>{returnToLobby();if(party.joined)partyUI.show();};
for(const each of [online,arcade,practice,duel,royale,localObjective,localRift,localBall])each.onDisconnect=(reason,code)=>{
  const over=code===4006;
  // (Drawn here once, as the frame no longer finds the page's own fighter: its id went with the room.)
  const shown=started&&finale.ended?timeline.sample(performance.now())?.snapshot:undefined,self=shown?.players.find(p=>p.id===finaleSelf);
  if(shown&&self){skipFinale(true);hud.roomGone=true;hud.update(shown,self,undefined,over);if(over)hud.link(undefined);riftUI.update(shown,finaleSelf);if(!over)hud.banner(reason);return;}
  returnToLobby();hud.banner(reason);};
// A ball match restarted in place on this device (PLAY AGAIN, a drill's AGAIN: LocalBall.onRestart)
// begins its clock and its events again from nothing, so the page lets go of the last one's, as for a Duel's next set; the
// bodies are built again under the short intro's splash page.
// An online ball room's rematch (its next round, BallRoom.rematch) is let go of the same way (onSnapshot).
function ballRestart(){clearFighters();timeline.reset();lastEvent=0;localClock=0;camera.reset();introFor=null;victoryFor=null;finale.reset();targetId=null;targeting.reset();ballField.clear();ballUI.clear();ballReplay.clear();ballCeremony.clear();stanceMarks.clear();passMark?.hide();clearKicks();ballStances[0].reset();ballStances[1].reset();ballChases[0].cut();ballChases[1].cut();ballHeard=0;ballMark='';network.onControlReset();}
localBall.onRestart=ballRestart;let ballRound='';
for(const each of [online,arcade,practice,duel,royale,localObjective,localRift,localBall])each.onControlReset=()=>{unacked.length=0;input.clear();input.enabled=false;prediction.stop();localCollision=undefined;localCollisionStage=null;collisionGeneration++;predictedCasts.clear();predictedVisuals.length=0;inputClock.reset();};
let objectiveRound=0,objectivePhase='',duelRoundKey='';
const matchBell=new MatchBell();
const onSnapshot=(snapshot:GameSnapshot)=>{
  if(network===online&&started&&lastMatchStart){const local=loneQueue(snapshot,network.id,lastMatchStart[3],online.plannedBots);if(local){playLocally(local);return;}queueWatch(snapshot,network.id,lastMatchStart[3]);}
  // Round 5 (SOLOPAUSE): the room's pause. Thawed, its clock carries on from where it stood while the wall clock ran
  // on: the timeline learns its arrival offset afresh (CombatTimeline.reanchor).
  if(network===online){const frozen=!!snapshot.pause?.paused;if(roomFrozen&&!frozen)timeline.reanchor();roomFrozen=frozen;pauseLink.observe(snapshot);pausePump();}
  const duelKey=snapshot.duel?`${snapshot.duel.set}:${snapshot.duel.round}`:'';
  if(snapshot.duel?.phase==='playing'&&snapshot.status==='active'&&duelKey!==duelRoundKey){if(duelRoundKey){clearFighters();}duelRoundKey=duelKey;timeline.reset();camera.reset();introFor=null;victoryFor=null;network.onControlReset();input.yaw=snapshot.players.find(p=>p.id===network.id)?.yaw??Math.PI;camera.lookAlong(input.yaw);}
  if(!snapshot.duel)duelRoundKey='';
  // A friends' royale's next match in the same room (server/social/RoomAgain.ts): its fighters afresh, as a Duel's next set's.
  {const again=snapshot.lobby?.again?.match??0;if(again>againSeen&&againSeen){clearFighters();timeline.reset();camera.reset();introFor=null;victoryFor=null;targetId=null;targeting.reset();network.onControlReset();}againSeen=again;}
  if(matchBell.rang(snapshot)){input.yaw=snapshot.players.find(p=>p.id===network.id)?.yaw??Math.PI;camera.reset();camera.lookAlong(input.yaw);}
  // Adaptive difficulty (game/adaptive.ts): the skill the match has learned, kept for the next one (boot/skill.ts).
  keepSkill(snapshot.players.find(p=>p.id===network.id)?.skill);
  hud.modes.snapshot(snapshot); // Round 5 (UX): each combat event, once, to the mode's HUD module.
  if(started&&practiceRoom(snapshot))watchSwaps(snapshot); // Training's switch: what the room shows of it.
  career.observe(snapshot,network.id);
  if(started)streamSnapshotAssets(snapshot);
  const modeView=objectiveOf(snapshot),warView=riftOf(snapshot),round=modeView?.round??warView?.round??0;
  if(round!==objectiveRound){
    objectiveRound=round;objectivePhase='';timeline.reset();lastEvent=0;prediction.stop();localCollision=undefined;localCollisionStage=null;collisionGeneration++;input.clear();inputClock.reset();unacked.length=0;predictedCasts.clear();predictedVisuals.length=0;objectiveField.reset();horde.clear();techniques.reset();bossesWanted='';
    audio.reset();areaFx.reset();effects.reset();castFx.now?.reset();awakeningEffects.reset();clashEffects.reset();manga.reset();camera.reset();victoryFor=null;introFor=null;targeting.reset();targetId=null;
    clearFighters();
  }
  if((modeView?.phase??warView?.phase)==='active'&&objectivePhase!=='active'){input.yaw=snapshot.players.find(p=>p.id===network.id)?.yaw??Math.PI;input.clear();camera.reset();}
  if(modeView?.kind==='last-stand')wantBosses([...new Set([...(modeView.village?.incoming??[]),...snapshot.players.flatMap(p=>p.enemy?[p.enemy]:[])])],false);
  objectivePhase=modeView?.phase??warView?.phase??'';
  // An online ball room's next round (its rematch) starts its clock again: the last one let go.
  {const ball=network===online?ballOf(snapshot):undefined,key=ball?`${ball.code??''}:${ball.round}`:'';if(key&&ballRound&&key!==ballRound&&key.split(':')[0]===ballRound.split(':')[0])ballRestart();ballRound=key;}
  // A ball match puts everyone back on their marks for each kickoff and serve: the view turns with the body, behind it.
  {const ball=ballOf(snapshot),mark=ball&&(ball.phase==='kickoff'||ball.phase==='countdown')?`${ball.phase}:${ball.phaseUntil}:${ball.startsAt}`:'';
    if(mark&&mark!==ballMark){ballMark=mark;input.yaw=snapshot.players.find(p=>p.id===network.id)?.yaw??input.yaw;camera.reset();ballChases[0].cut();ballChases[1].cut();}else if(!ball)ballMark='';}
  timeline.push(snapshot,performance.now());if(ballOf(snapshot)){ballReplay.record(snapshot);if(network===online){ballField.heard(snapshot);ballAudio.listen(snapshot,network.id);}}
  // Lock combat (the fight's snapshots say it plays it, whichever mode, here or online): what it is, once a session.
  if(snapshot.lockCombat&&!lockTold&&snapshot.players.some(p=>p.id===network.id)){lockTold=true;hud.notify('LOCK COMBAT · MASH TO COMBO · GUARD WHEN THE RING CLOSES TO VANISH',4.5);}
  if(!started||!network.id||!network.predictionReady)return;
  inputClock.report(snapshot.queued);
  // Nothing to predict when the arena is in this browser: the command is
  // simulated the moment it is sent. A co-op room is online like any other.
  if(network===arcade||network===practice||network===localObjective||network===localRift||network===localBall||network===duel||network===royale)return;
  riftPredictionTargets.update(snapshot,network.id);
  // A ball room: the page's prediction swings at the ball as the room last placed it (BallTargets), as it does at Rift War's armies.
  // (Where the page draws it, as the room judges this page's swing - BallMatch SEEN - not where the newest
  // snapshot has it, a round trip ahead of the frame.)
  const ballView=ballOf(snapshot);if(ballView){ballTargets.selfId=network.id;ballTargets.update(snapshot,ballField.ballPosition());}
  const external=warView?riftPredictionTargets:ballView?ballTargets:undefined,assist=warView?{magnet:RIFT_RULES.aimMagnet}:ballView?ballAssist(ballView.mode):undefined;
  if(!prediction.enabled){if(snapshot.players.some(p=>p.id===network.id)){ensureLocalCollision(snapshot.stage??'harbor');prediction.lockCombat=!!snapshot.lockCombat||!!(network===duel?duel.sim:network===practice?practice.sim:null)?.lockCombat;prediction.start(network.id,snapshot,localCollision);prediction.setExternalTargets(external,assist);}}
  else {prediction.setExternalTargets(external,assist);prediction.receive(snapshot);}
};
online.onSnapshot=onSnapshot;arcade.onSnapshot=onSnapshot;practice.onSnapshot=onSnapshot;localObjective.onSnapshot=onSnapshot;duel.onSnapshot=onSnapshot;royale.onSnapshot=onSnapshot;localRift.onSnapshot=onSnapshot;localBall.onSnapshot=onSnapshot;
// Programs are linked the first time something is drawn, and a transformation
// is drawn for the first time in the middle of a fight - so the frame the
// player pressed for is the frame that pays for it. Compiling once, as soon as
// the match's own bodies are in the scene, moves that cost to the entrance.
let pendingCompile=false,compiling=false;
/** Is this your fight? Everything that shakes the lens is weighted by it, so a
 *  stranger's parry across the map does not wobble your view - with six duels
 *  running, the camera never settled. */
const involved=(event:CombatEvent)=>event.actorId===network.id||event.targetId===network.id;
const nearby=(event:CombatEvent)=>{
  const at=event.endpoint??event.origin;
  if(!at||!shownSelf)return Infinity;
  return Math.hypot(at.x-shownSelf.x,at.z-shownSelf.z);
};
const witness=(event:CombatEvent)=>involved(event)?1:Math.max(0,1-nearby(event)/16)*.45;
/** The style the blow was thrown in. A rush stage is its own move: Ouga's
 *  light is a ki volley, but the three stages after it are knees and elbows. */
const eventStyle=(event:CombatEvent)=>event.fighter&&event.slot
  ?(event.slot==='light'&&(event.chain??0)>0?rushMove(event.fighter,event.chain!,false):MOVES[event.fighter][event.slot]).style:undefined;
/** What the struck body needs to know beyond the heading: which rush stage
 *  (the finisher lands heavier), which side, and what the server decided. */
// The feel pass: a big blow (game/bigBlow.ts) is snapped into, held shaking and flashed in its thrower's colour.
const impactDetail=(event:CombatEvent)=>{const awakened=!borrowedEvent(event)&&!!network.snapshot?.players.find(p=>p.id===event.actorId)?.awakened,big=bigBlowOf(event,awakened)||cinematicBlowOf(event,awakened);
  return {chain:event.chain,fromBehind:event.fromBehind,reaction:event.reaction,...(big?{big,tint:elementFor(event.fighter,event.slot,awakened,event.chain??0,event.branch as ComboKey|undefined).spike}:{}),...(event.downed?{downed:true}:{}),...(event.lift?{lift:event.lift}:{})};};
/** A big blow heard (CombatAudio.bigBlow) and, in the player's own exchange, the score's beat under its freeze
 *  (CharacterMusic.punch, for the hold the simulation gives it: BIG_HITSTOP). Played where the blow is presented. */
const bigBlowSound=(event:CombatEvent)=>{
  if(event.kind!=='hit')return;
  const awakened=!borrowedEvent(event)&&!!network.snapshot?.players.find(p=>p.id===event.actorId)?.awakened;
  if(!bigBlowOf(event,awakened))return;
  audio.bigBlow(event.endpoint??event.origin??{x:0,y:0,z:0},event.actorId,.8+Math.min(.35,(event.damage??60)/300));
  if(event.actorId===network.id||event.targetId===network.id)
    music.punch(event.slot==='special'?BIG_HITSTOP.special:event.slot==='ultimate'?BIG_HITSTOP.ultimate:event.branch?BIG_HITSTOP.ender:BIG_HITSTOP.finisher);
};
/** Which way the blow travelled, for the directional lens kick and the lean. */
const blowHeading=(event:CombatEvent)=>event.origin&&event.endpoint
  ?new THREE.Vector3(event.endpoint.x-event.origin.x,0,event.endpoint.z-event.origin.z):undefined;
/** The horde's voice, from the shared impact library: an enemy's swing, the
 *  blows it lands and has turned away, an upgrade's proc, a body going down. */
function survivalSounds(snapshot:GameSnapshot){
  for(const event of snapshot.events){
    const at=event.endpoint??event.origin;if(!at)continue;
    const mine=event.targetId===network.id;
    if(event.enemy&&event.kind==='cast')audio.cue('swing-a',event.origin??at,.28,.85+Math.random()*.25,event.actorId,0);
    else if(event.enemy&&event.kind==='release'&&event.slot==='special')audio.cue('crack',at,.45,.7,event.actorId,1);
    else if(event.enemy&&event.kind==='hit'&&mine){audio.cue('body-a',at,.9,.95+Math.random()*.1,event.actorId,4);audio.cue('crack',at,.3,1.3,event.actorId,3);}
    else if(event.enemy&&(event.kind==='blocked'||event.kind==='guard-break')&&mine)audio.cue('crack',at,event.kind==='guard-break'?.8:.45,event.kind==='guard-break'?.8:1.5,event.actorId,3);
    else if(isProc(event.move)&&event.kind==='hit'&&!isQuiet(event.move))audio.cue('body-b',at,.22,1.25+Math.random()*.2,'proc',0);
    else if(event.kind==='eliminated'&&event.targetId!==network.id&&event.targetId&&!fighters.has(event.targetId))audio.cue('ground',at,.35,.75+Math.random()*.2,'fall',0,.25);
    else if(event.kind==='poise-break')audio.cue('bomb',at,.7,1.35,'break',4);
  }
}
/** The horde's voices: a snarl or a grunt on a wind-up and the whistle of the
 *  blade after it, a war cry out of a rift, a death cry and the wet sound of a
 *  cut. Thinned by a budget that refills about seven a second, and the nearer
 *  a body the likelier it speaks, so a hundred of them sound like a crowd
 *  around you rather than a wall of noise. */
let lastHordeVoice=0,hordeVoiceBudget=6,hordeVoiceAt=0;
function hordeVoices(){
  const events:readonly HordeEvent[]=network===arcade?arcade.game?.horde.eventsSince(lastHordeVoice)??[]:online.hordeEvents.filter(event=>event.id>lastHordeVoice);
  if(!events.length)return;
  lastHordeVoice=events[events.length-1].id;
  const now=performance.now()/1000;hordeVoiceBudget=Math.min(6,hordeVoiceBudget+(now-hordeVoiceAt)*7);hordeVoiceAt=now;
  const me=shownSelf;
  for(const event of events){
    const kind=GRUNTS[event.type];if(!kind)continue;
    const distance=me?Math.hypot(event.x-me.x,event.z-me.z):0;if(distance>30)continue;
    const lines=LINES[VOICE_OF[kind.id]??'beast'],pitch=(PITCH[kind.id]??1)*(.94+Math.random()*.12);
    const at={x:event.x,y:event.y+1.4,z:event.z},owner=`g${event.serial}`;
    const say=(family:Family,gain:number,chance:number,delay=0)=>{if(hordeVoiceBudget<1||Math.random()>chance*(distance<8?1.6:1))return;hordeVoiceBudget--;audio.sample(take(family),at,gain,pitch,owner,0,delay);};
    switch(event.kind){
      case 'windup':{const move=kind.moves[event.value];const fuse=hordeFuse(move?.kind);if(fuse)audio.sample(take(fuse as Family),at,.62,1,owner,0);if(move?.kind==='charge'){say(lines.cry,.8,1);break;}say(lines.swing,.55,.4);if(move&&move.kind!=='shot'&&distance<14)audio.cue(Math.random()<.5?'swing-a':'swing-b',at,.2,.9+Math.random()*.25,owner,0,move.contact*.9);break;}
      case 'death':say(lines.die,.62,.45);if(event.value===DEATH.SLICED||event.value===DEATH.BURST)audio.sample(take('gore'),at,.5,.9+Math.random()*.25,owner,0);break;
      case 'spawn':say(lines.cry,.5,.12);break;
      case 'bark':say(lines.hurt,.6,.8);break;
      case 'topple':say(lines.hurt,.45,.12);break;
      case 'slam':audio.cue('bomb',at,.55,.8,owner,1);audio.sample(take('stomp'),at,.8,.8,owner,1);break;
      case 'explode':audio.cue('bomb',at,.8,1.1,owner,1);audio.sample(take('gore'),at,.6,.8,owner,1);break;
      case 'shot':{const element=kind.moves[event.value]?.element;const steel=element==='steel'||element==='blaster';audio.cue(steel?'crack':'release-ki',at,steel?.35:.25,steel?.75:1.3+Math.random()*.2,owner,0);break;}
    }
  }
}
/** The bosses' voices (bossVoices.ts): an entrance, a shout on a big move now
 *  and then, the stagger when poise breaks, the rage at half health and the
 *  fall. On the voice bus, which the soundtrack ducks under. */
let lastBossVoice=0,lastSmash=0;const bossShoutAt=new Map<string,number>();
/** The stage coming apart: each prop the run smashed folds away, with a crack. */
function smashes(sv:RunView){
  for(const item of sv.feed){
    if(item.id<=lastSmash||item.kind!=='smash')continue;lastSmash=item.id;
    stages.rift?.smash(item.value??0);
    const at={x:item.x??0,y:.5,z:item.z??0};audio.cue('crack',at,.5,.7+Math.random()*.2,'prop',1);audio.cue('ground',at,.3,1.3,'prop',0,.03);
  }
}
function speakBoss(enemy:string,moment:BossMoment,at:{x:number;y:number;z:number},owner:string,gain=.9){
  const line=bossLine(enemy,moment);if(!line)return;
  if('url' in line)audio.sample(line.url,at,gain,line.rate,owner,3,0,'voice');else audio.cue(line.cue,at,gain,line.rate,owner,3);
}
function bossVoices(sv:RunView,snapshot:GameSnapshot){
  for(const item of sv.feed){
    if(item.id<=lastBossVoice)continue;lastBossVoice=item.id;
    if(!item.enemy||(item.kind!=='boss'&&item.kind!=='enraged'&&item.kind!=='break'&&item.kind!=='down'))continue;
    const body=item.actor?horde.body(item.actor):undefined,pos=body?.group.position;
    const at={x:pos?.x??item.x??shownSelf?.x??0,y:(pos?.y??item.y??0)+2,z:pos?.z??item.z??shownSelf?.z??0};
    const moment:BossMoment=item.kind==='boss'?'entrance':item.kind==='enraged'?'rage':item.kind==='break'?'hurt':'defeat';
    speakBoss(item.enemy,moment,at,item.actor??item.enemy,moment==='hurt'?.8:1);
  }
  const now=performance.now()/1000;
  for(const event of snapshot.events){
    if(event.kind!=='cast'||!event.enemy||!isChampion(event.actorId))continue;
    if(now<(bossShoutAt.get(event.actorId)??0)||Math.random()>.45)continue;
    bossShoutAt.set(event.actorId,now+2.6);
    const at=event.origin??shownSelf??{x:0,y:0,z:0};speakBoss(event.enemy,'attack',{x:at.x,y:at.y+1.5,z:at.z},event.actorId,.8);
  }
}
/** The snapshot's fighters, each in its body: built for a player new to the room, rebuilt when their fighter or outfit
 *  changes, and let go when they leave. */
function bodiesFor(snapshot:GameSnapshot){
  const war=riftOf(snapshot);
  for(const [id,body] of hiddenRiftBodies){if(snapshot.players.some(p=>p.id===id)){hiddenRiftBodies.delete(id);body.group.visible=true;fighters.set(id,body);}else if(!war?.seats.some(s=>s.id===id)){body.dispose();hiddenRiftBodies.delete(id);}}
  for(const p of snapshot.players){if(p.enemy||!library.has(p.fighter))continue;const outfit=packHas(p.fighter)?undefined:library.outfitReady((p.id===network.id&&network===practice&&snapshot.roomMode==='training'?laboratoryOutfit(p.fighter):undefined)??p.outfit??(p.id===network.id?playerOutfit(p.fighter):undefined),p.fighter),have=fighters.get(p.id);/* A body is rebuilt when its player's fighter changes under the same id, not only its outfit: Konta's model was playing Kenzo's moves and lines. */if(have&&(have.outfitId!==outfit||have.bodyFighter!==p.fighter)){if(have.bodyFighter!==p.fighter)rebodied=true;have.dispose();fighters.delete(p.id);}if(!fighters.has(p.id)){const fighter=library.create(p,outfit);fighters.set(p.id,fighter);view.scene.add(fighter.group);pendingCompile=true;}}
  for(const [id,fighter] of fighters)if(!snapshot.players.some(p=>p.id===id&&!p.enemy)){if(war?.seats.some(s=>s.id===id)){fighter.group.visible=false;hiddenRiftBodies.set(id,fighter);}else fighter.dispose();fighters.delete(id);}
}
/** A body was rebuilt this frame because its player is another fighter now (bodiesFor). */
let rebodied=false;
/** Training's switch, in the frame that first shows it: the room has nothing in the air any more (swapFighter cleared
 *  every cast, shot and circle, and nobody is awakened), so nothing the old pair threw stays on screen or in the ear
 *  either - a fire still burning under the dummy, a circle still filling, the old fighter's shout from the new body.
 *  What is in flight is let go as a round's start lets it go (the block in onSnapshot): the effects go back to their
 *  pools, nothing built or compiled is thrown away. The camera, the lock, the stage and the HUD are not touched. */
function clearFlights(){audio.reset();areaFx.reset();effects.reset();castFx.now?.reset();awakeningEffects.reset();clashEffects.reset();manga.reset();predictedCasts.clear();predictedVisuals.length=0;}
function applyCombatFrame(snapshot:GameSnapshot){
  // Arcade enemies are not fighters: the horde draws them (EnemyHorde).
  // A player is drawn in the outfit they wear (the room says, or, for this player, their account), once its body is here.
  bodiesFor(snapshot);
  // (And with nothing in the air, the Armory effects of fighters gone from the room and from the bench are let go, as a
  // room's load lets go of the last room's: a session that tries the whole roster would keep every look it ever cast -
  // 250 scene objects, 8 programs and 25 MB of heap a switch, measured over fourteen.)
  if(rebodied){rebodied=false;if(practiceRoom(snapshot)){clearFlights();retainRoomEffects([...snapshot.players,...benched().map(fighter=>({fighter}))],effects);}}
  const self=snapshot.players.find(p=>p.id===network.id);if(self)targetId=targeting.update(targetPlayers(snapshot),self,snapshot.events,snapshot.serverTime,input.yaw);
  // A 1v1 round's fight on and nobody locked: the one opponent, as Tab would (AutoLock: let go, it stays off that round).
  {const rival=autoLock.want(snapshot,network.id,startEpoch,targeting.locked);if(rival){targeting.lockOn(rival);targetId=rival;}}
  const echoed=new Set<number>();
  if(prediction.enabled)for(const event of snapshot.events){
    if(event.kind!=='cast'||event.actorId!==network.id||!event.slot)continue;
    const at=predictedCasts.get(castKey(event));
    if(at===undefined||performance.now()-at>1200)continue;
    predictedCasts.delete(castKey(event));echoed.add(event.id);
  }
  // In the arcade, an enemy's blow and an upgrade's proc are voiced by the
  // survival layer; the roster's cue plans and lettering are for fighters.
  // A horde's rank and file do not each get the centre-screen K.O.: that
  // stamp is for a boss or a champion going down.
  const defence=objectiveOf(snapshot)?.kind==='last-stand',hordeMode=survival()||defence;
  const notable=(id:string)=>defence?id===objectiveOf(snapshot)?.village?.bossActor:isChampion(id);
  const roster=riftOf(snapshot)?snapshot.events.filter(event=>event.kind!=='eliminated'||snapshot.players.some(p=>p.id===event.targetId)):hordeMode?snapshot.events.filter(event=>!event.enemy&&!isProc(event.move)&&!(event.kind==='eliminated'&&event.targetId&&event.targetId!==network.id&&!notable(event.targetId))):snapshot.events;
  const bodies=hordeMode?snapshot.players.filter(p=>!p.enemy):snapshot.players;
  audio.handle(roster.filter(event=>!echoed.has(event.id)&&!prediction.impactWasPresented(event)),network.id,presentPlayers(bodies));manga.sport=!!ballOf(network.snapshot);manga.handle(roster,network.id,bodies);
  if(objectiveOf(snapshot))objectiveAudio.update(snapshot,network.id);
  if(riftOf(snapshot))riftAudio.update(snapshot,network.id);
  if(ballOf(snapshot))ballSounds(snapshot);
  if(ballOf(snapshot))ballMoments.handle(snapshot);
  if(hordeMode)survivalSounds(snapshot);if(survival())hordeVoices();
  for(const event of snapshot.events){if(event.id<=lastEvent)continue;lastEvent=event.id;
    // Tallied here rather than by polling: the server drains its event buffer
    // into each snapshot, so anything that samples `arenaEvidence` on a timer
    // loses a whole batch every time a frame runs longer than the snapshot
    // interval - which under software rendering is most of them.
    eventCounts[event.kind]=(eventCounts[event.kind]??0)+1;
    // Felt in the hands, on a pad that can: blows taken and landed, guards,
    // awakenings, ultimates and falls.
    {const pulse=pulseFor(event,network.id??'',id=>!!snapshot.players.find(player=>player.id===id)?.enemy);if(pulse)input.feel(pulse);}if(event.actorId===network.id&&event.kind==='cast'&&event.move&&!echoed.has(event.id)&&!(event.slot==='ultimate'&&carded())){if(event.slot==='area'&&event.fighter&&!couch.split)showAreaBanner(event.body??event.fighter,event.move,event.fighter);else personal(event.actorId,displayMove(event.fighter,event.move).toUpperCase(),1.1);}
    else if(couch.split&&event.actorId===SECOND&&event.kind==='cast'&&event.move&&event.slot!=='ultimate')personal(event.actorId,displayMove(event.fighter,event.move).toUpperCase(),1.1);
    if(event.kind==='awaken'&&event.move&&(event.actorId===network.id||couch.split&&event.actorId===SECOND)){if(!carded())personal(event.actorId,displayMove(event.fighter,event.move).toUpperCase(),1.8);if(event.actorId===network.id)camera.impact(.4);}if((event.kind==='hit'||event.kind==='blocked')&&event.endpoint&&(event.damage||event.downed)){
      // Which way the blow travelled, so the body can be bent away from it.
      // Kept in three dimensions. The vertical component is what tells an
      // uppercut from a downward chop, and it used to be zeroed here.
      const heading=event.origin?new THREE.Vector3(event.endpoint.x-event.origin.x,event.endpoint.y-event.origin.y,event.endpoint.z-event.origin.z):undefined;
      const landed=event.kind==='hit';
      // How far up the struck body the blow arrived, which decides whether it
      // folds over it or arches off it.
      const struck=snapshot.players.find(player=>player.id===event.targetId);
      const height=struck?event.endpoint.y-struck.y:undefined;
      const detail=impactDetail(event);
      if(!prediction.impactWasPresented(event))bigBlowSound(event);
      if(!prediction.impactWasPresented(event))fighters.get(event.targetId??'')?.impact(true,event.slot,eventStyle(event),event.contactIndex,heading,landed?event.damage??0:(event.damage??0)*2.2,height,detail);
      if(landed&&!prediction.impactWasPresented(event)&&(event.slot==='light'||event.slot==='heavy'))fighters.get(event.actorId)?.impact(false,event.slot,undefined,undefined,heading,event.damage,undefined,detail);
      if(!landed)fighters.get(event.actorId)?.impact(false,event.slot,undefined,undefined,heading,event.damage,undefined,detail);
      // Somebody else's duel forty metres away is not your damage. In a
      // twelve-player royale every number on the map used to print across the
      // screen at full size, stealing the pool from your own hits.
      // An art's blows through the horde are drawn by the art itself: a number
      // on every one of thirty grunts a bolt of lightning lands on is clutter.
      const artOnCrowd=survival()&&isProc(event.move)&&!event.critical&&!!event.targetId&&!isChampion(event.targetId);
      if(landed&&!!event.damage&&!isQuiet(event.move)&&!artOnCrowd&&(involved(event)||nearby(event)<14)){
        // The number rides the body it came off. A launched fighter used to
        // leave theirs hanging at the world point where the hit happened.
        const struck=event.targetId;
        damageNumbers.show(event.damage,new THREE.Vector3(event.endpoint.x,event.endpoint.y,event.endpoint.z),
          event.slot==='special'||event.slot==='ultimate'||event.slot==='area',
          struck?()=>{const body=fighters.get(struck);return body?bodyCentre(body,numberAnchor):horde.centre(struck,numberAnchor)??grunts.centre(struck,numberAnchor);}:undefined,struck,!!event.bullseye,event.fighter==='yodaka'&&event.slot==='area');
      }}// Shaken by what it was worth rather than by which button threw it: a
      // 290-damage ultimate and a 40-damage jab used to be two fixed numbers.
      // Shaken by what it was worth rather than by which button threw it, and
      // thrown the way the blow travelled rather than buzzing on the spot.
      // The camera applies the player's shake setting once; multiplying it in
      // here as well meant every impact landed at a quarter of its strength.
      if(event.kind==='hit'&&!prediction.impactWasPresented(event)&&!isQuiet(event.move)){
        const weight=witness(event)*(isProc(event.move)?.35:1);
        if(weight>.01){
          camera.impact(Math.min(1,(.2+screenWorth(event)/460)*weight),blowHeading(event),involved(event)?hitTier(event.slot,event.chain):0);
          // Every connected hit, not only the heavy ones: the bodies freeze
          // for between forty-five and a hundred and forty milliseconds on all
          // of them, and a camera that glides through that reads as a dropped
          // frame rather than as an impact.
          if(involved(event)){
            camera.holdFor(Math.min(1,(event.damage??0)/240));markerHoldUntil=performance.now()/1000+.5;
            // The frame itself registers the blow: speedlines, a desaturation
            // and a vignette bite, scaled by what it was worth. A 290-damage
            // ultimate used to look screen-wide identical to a 30-damage jab.
            view.punch(Math.min(.55,screenWorth(event)/420)*settings.effects);
          }
        }
      }
      if(event.kind==='rejected'&&event.reason)personal(event.actorId,REJECTIONS[event.reason]??event.reason.toUpperCase(),.7);
      // Round 5 (PARRY): a short punch-in on a parry and a shake on a guard break, for whoever is in them.
      // Techniques (game/techniques.ts): a counter stance met a blow - its thrower's COUNTER!, and the one it undid.
      // (On a split screen each of these goes to the half it is about, both halves where it is about both: `personal`.)
      if(event.kind==='counter'){if(couch.split){personal(event.actorId,'COUNTER!',.9);personal(event.targetId,'COUNTERED',.8);}else if(event.actorId===network.id||couch.on&&event.actorId===SECOND)hud.notify('COUNTER!',.9);else if(event.targetId===network.id)hud.notify('COUNTERED',.8);}
      if(event.kind==='just-guard'){personal(event.targetId,'PARRY',.8);camera.impact(.5*witness(event),blowHeading(event),involved(event)?1:0);}
      if(event.kind==='guard-break'){camera.impact(.6*witness(event),blowHeading(event),involved(event)?2:0);if(!personal(event.targetId,'GUARD BROKEN',.9)||couch.split)personal(event.actorId,'GUARD BREAK',.9);}
      // The royale's knockout heal (KO_HEAL): what it gave back, to whoever scored it.
      if(event.kind==='eliminated'&&event.heal){const scorer=snapshot.players.find(p=>p.id===event.actorId);if(scorer?.maxHp)personal(event.actorId,`+${Math.max(1,Math.round(event.heal/scorer.maxHp*100))}% HP`,1);}
      if(event.kind==='wall-splat')camera.impact(.46*witness(event));
      if(event.kind==='ground-bounce')camera.impact(.36*witness(event));
      // Round 4b (TARGETING): a ground smash, or any fall of 3 m or more, landing (JUMP's 'land' with how far it fell)
      // shakes the view by the drop - a whiffed smash too, which no hit ever shook.
      if(event.kind==='land'&&(event.drop??0)>=1)camera.impact(Math.min(.6,.12+((event.drop??0)-1)*.07)*witness(event));
      if(event.kind==='projectile-clash')camera.impact(.42*witness(event));
      // Getting out of a string. It used to happen in silence, with the
      // attacker's next three swings passing through a body standing right in
      // front of them and nothing anywhere saying why.
      if(event.kind==='break'){
        camera.impact(.4*witness(event),blowHeading(event));
        if(!personal(event.actorId,'BREAK',.8)||couch.split)personal(event.targetId,'BROKEN',.8);
      }
      // Lock combat (game/lockCombat.ts, the experiment's preview): a blow between the player and anyone - the exchange
      // the camera comes in for (FollowCamera.comboFrame) - the gap after a round, and what came of it.
      if((event.kind==='hit'||event.kind==='blocked'||event.kind==='chase')&&(event.actorId===network.id||event.targetId===network.id))lockExchangeAt=performance.now();
      if(event.kind==='hit'&&event.actorId===network.id&&(event.branch||event.slot==='light'&&(event.chain??0)>=3))camera.comboPunch();
      if(event.kind==='lock-gap')personal(event.targetId,event.reason==='early'?'TOO EARLY':'GUARD NOW · VANISH',.5);
      if(event.kind==='lock-escape'){
        const mine=!event.reason?'VANISHED':event.reason==='counter'?'COUNTER VANISH':event.reason==='early'?'TOO EARLY':event.reason==='late'?'TOO LATE':'NO STAMINA';
        const onMe=!event.reason?'ESCAPED · GUARD TO FOLLOW':event.reason==='counter'?'THEY FOLLOWED YOU':undefined;
        if((!personal(event.actorId,mine,!event.reason||event.reason==='counter'?.8:.6)||couch.split)&&onMe)personal(event.targetId,onMe,!event.reason?.6:.8);
      }
      if(event.kind==='hit'&&event.counter){if(!personal(event.actorId,'COUNTER',.6)||couch.split)personal(event.targetId,'COUNTERED',.6);}
      }
};
let commonLoad:Promise<void>|undefined;
const compiledFighters=new Set<FighterId>();let warming=Promise.resolve(),effectsWarmed=false;
const startupProgress=()=>hud.loadingStages(startup.snapshot().stages.map(s=>`${s.name}: ${s.state}`).join(' / '));
startup.onChange=startupProgress;
function prepareSelection(fighter:FighterId){
  commonLoad??=startup.stage('Sky',()=>view.loadSky()).then(()=>{}).catch(e=>{commonLoad=undefined;throw e;});
  return Promise.all([commonLoad,library.ensure([fighter],label=>{if(!started)hud.loading(label,20);}),roomExtras([fighter])]).then(()=>{});
}
function roomExtras(ids:readonly FighterId[],donors:readonly FighterId[]=[]){
  // The voices come in beside the bodies and are not waited for, as the bank never was: a room starts on its models.
  void audio.prepare(ids);
  // Iteration thirteen: each fighter's line for their victory (audio.quote), fetched with the room.
  audio.preload(ids.map(id=>HOME_VOICES[id]).filter((url):url is string=>!!url));
  // (And the effects of the fighters whose moves the room's kits borrow: VOL.5, the move transplant.)
  const fx=donors.length?[...ids,...donors]:ids;
  return Promise.all([castFx.get().then(cast=>cast.load(fx)),effects.load(fx)]).then(()=>{});
}
/** The stage whose model has loaded last (the loading screen's progress). */
let stageLoaded:StageId|null=null;
async function loadStage(stage:StageId){
  if(stage==='harbor')await startup.stage('Harbor',()=>stages.preload('harbor'));else await stages.preload(stage);
  stageLoaded=stage;
}
/** On the home screen, the library held to the cap a room's load holds it to (loading/retention.ts): every fighter picked
 *  there loads, and until 30 October 2026 each stayed whole until the next match - forty picks, forty fighters, about a
 *  hundred megabytes more, past twice a phone's sixteen. The longest unused go first (the background volume's, never
 *  asked for, before any picked); never the one picked now, nor the bots planned for the next online room. In a room
 *  nothing is trimmed here: its load keeps what it needs. A body let go is no longer uploaded (`compiledFighters`). */
function trimLibrary(){
  if(started)return;
  const keep=new Set<FighterId>([hud.selected,...trainingBench,...swaps.waiting(),...(network===online?online.plannedBots:[])]);
  for(const id of library.evict(keep,libraryCap(view.governor.relaxed)))compiledFighters.delete(id);
}
/** `also`: what else the room's compile waits for (a start's own selection: hud.onStart). */
async function ensureSnapshotAssets(snapshot:GameSnapshot,onWarm?:()=>void,also?:Promise<unknown>){
  const epoch=startEpoch,current=()=>epoch===startEpoch;
  const ids=riftAssets.ids(snapshot),donors=effectDonors(snapshot.players,ids);
  // A page open across a release reads the new files' versions before the room's are fetched (loading/assetVersions.ts).
  refreshAssetVersions();
  // Release the graphics copies of fighters absent from this room, preserving the shared loading budget.
  // (And the fighters Training has just switched away from - stepping back to one must not upload it again - and the
  // ones it is switching to: two switches loading at once must not let go of each other's bodies.)
  const keep=new Set<FighterId>([...ids,...donors,hud.selected,...trainingBench,...swaps.waiting(),...(network===online?online.plannedBots:[])]);
  for(const id of library.releaseGpu(keep))compiledFighters.delete(id);
  // The fighters a page keeps whole (body, form, clips, the parsed model: about 1.6-3 MB of heap each, 43 of them 68 MB
  // after three matches in one page, growing by the roster's newcomers for ever): a phone or an ordinary machine sixteen; a
  // strong one twenty-four - this room's twelve and the last room's, so a rematch loads nothing - whatever the longest
  // unused beyond that, and never the room's own or the selected fighter (loading/retention.ts).
  // (The cap counts the room's newcomers, which load after this: it is what the library holds once they have.)
  library.evict(keep,Math.max(0,libraryCap(view.governor.relaxed)-ids.filter(id=>!library.has(id)).length));
  // And the sounds of fighters this room does not have (CombatAudio.retain): 50-75 MB of decoded PCM a room.
  // (In Training with the fight on too: every switch is a room of its own for this, or a session that tries the whole
  // roster keeps the voices of all of it - 5 MB of PCM a fighter, measured over fourteen switches.)
  if(!started||practiceRoom(snapshot))audio.retain(keep);
  const incoming=objectiveOf(snapshot)?.kind==='last-stand'?objectiveOf(snapshot)?.village?.incoming:undefined;
  // The room's area looks and kit effects (an Armory chunk each): fetched with the models, built and cast once in hiding
  // after the signatures' own castings, so the compile and upload below cover them (loading/matchWarmup.ts).
  const loadStart=performance.now();stamp('assets-start');prefetchRoomFx(snapshot.players);
  if(!started){ensureLocalCollision(snapshot.stage??'harbor');audio.prepareSpace(survival()||objectiveOf(snapshot)||settings.quality==='low'?undefined:snapshot.stage);}
  // A room's first load waits for its sound after the compile, not before it (matchWarmup.ts warmRoomSound): the compile and
  // the uploads need none of it, and the bank is held until they begin (CombatAudio.holdFetches).
  const soundLater:{armory?:Promise<void>}|undefined=started?undefined:{};
  // (Training's bench and the fighters on their way keep their signatures loaded beside the room's: `effects.load` lets go of
  // every fighter it is not given, and a body kept on the card for a quick return would come back to effects built anew.)
  const extras=roomExtras(ids,[...donors,...benched()]).then(r=>{stamp('extras');return r;}),warmFx=extras.then(()=>{if(!started&&current())retainRoomEffects(snapshot.players,effects);return warmRoomAssets(snapshot.players,{current,areaFx,renderer:view.renderer,camera:view.camera,audio,soundLater});}).then(r=>{stamp('room-fx');return r;});
  // Before the fight, each fighter as its files arrive: its first build and its images on the card, while the room's other files
  // still download (FighterLibrary.prepare; at idle). They were the warm-up's below, after the last file: 1.1 s of first builds
  // and 0.8 s of uploads for a pinned twelve-fighter royale, all after the download (the performance sweep, 24 October 2026).
  const prepareEarly=(id:FighterId)=>{if(started)return;const go=()=>{if(!current()||started)return;try{for(const root of library.prepare(id))view.uploadTextures(root);}catch(error){console.warn('Fighter prepared on the warm-up instead',id,error);}};
    const idle=(globalThis as {requestIdleCallback?:(work:()=>void,options?:{timeout:number})=>number}).requestIdleCallback;if(idle)idle(go,{timeout:400});else setTimeout(go,0);};
  // (Techniques: the style takes come with the room's files, so its bodies fit theirs as they are built - styleMoves.ts.)
  await Promise.all([stylesReady(),...(ballOf(snapshot)?[ballMovesReady()]:[]),Promise.all(ids.map(id=>library.ensure([id]).then(()=>prepareEarly(id)))).then(()=>stamp('bodies')),loadStage(snapshot.stage??'harbor').then(()=>stamp('stage')),extras,warmFx,...(also?[also]:[]),...(incoming?[horde.load(incoming),objectiveField.prepare()]:[]),...(riftOf(snapshot)?[riftField.load()]:[])]);
  stamp('assets-loaded');
  if(!current()){horde.collect();return;}
  if(incoming)horde.warm(view.scene,incoming);
  const compileRoom=()=>incoming?stages.withStageLighting(snapshot.stage??'hidden-ash',()=>view.compileScene()):view.compileScene();
  // (A task's turn before the compile's long first task: what `onWarm` let go - a start's sound bank, CombatAudio.holdFetches -
  // asks for its files first, and the line downloads them through the compile.)
  onWarm?.();await new Promise(resolve=>setTimeout(resolve,0));
  // Serialize shader warm-ups so an old roster cannot remove another roster's bodies mid-compile.
  // (31 October 2026: the steps below, chained, held the page for 0.3 to 1.3 s at a time - the warm-up bodies, the compile,
  // every image in one go, the room's bodies and their compile - and the room's snapshots and the loading screen waited
  // behind them. Before the fight each step now has a task's turn before it and the images go in 8 ms slices
  // (uploadTexturesInSlices): the same work, in the same order, all of it behind the loading screen.)
  const warm=warming.then(async()=>{
    if(!current())return;
    const needed=ids.filter(id=>!compiledFighters.has(id));if(!needed.length)return;
    const bodies=library.warmup(view.scene,needed);
    // The transformation's shockwave, shell and shells, and the clash's ring and sparks: built once a page and compiled with
    // the room (the startup's graphics stage did this until the match-scoped load replaced it: the first awakening and the
    // first clash of a session then linked their programs mid-fight).
    const sharedEffects=!effectsWarmed;effectsWarmed=true;
    try{if(sharedEffects)try{awakeningEffects.warmup();clashEffects.warmup();}catch(error){console.warn('Shared effects warm-up',error);}
      castFx.now?.warmup(bodies);if(!started)await nextTask();await compileRoom();if(started)await view.uploadTexturesOverFrames(current);else await view.uploadTexturesInSlices(current);needed.forEach(id=>compiledFighters.add(id));}
    finally{library.hideWarmup();library.disposeWarmup();if(sharedEffects){awakeningEffects.hideWarmup();clashEffects.hideWarmup();}}
  });warming=warm.catch(()=>{});await warm;
  if(!current()){horde.collect();return;}
  // The stage's own images too, which are in the scene (hidden) once loaded: see uploadTextures. (In a fight already on - a
  // late joiner's bodies - over frames: a whole roster's images in one frame were a 100 ms stall.)
  if(started)await view.uploadTexturesOverFrames(current);else await view.uploadTexturesInSlices(current);
  stamp('warm-compiled');
  if(!started){bodiesFor(snapshot);await nextTask();try{await compileRoom();}catch{/* compiled on first draw instead */}await view.uploadTexturesInSlices(current);stamp('room-compiled');await nextTask();
    // The warm draw is one synchronous frame of programs and a load already this long (a slow line, a slow device) is not made
    // longer by it: the server gives a page 90 s to say its assets are in, and the depth programs then build on first use.
    // Its roots: the Armory's pools, and whole, the room's bodies with their forms (hidden until an awakening) and the place, so
    // every shadow program a body, a form or a prop of the place needs is linked here and every buffer of theirs sent
    // (GameRenderer.warmDraw; launch day 15).
    if(warmEnabled()&&performance.now()-loadStart<45000){const place=stages.root(snapshot.stage??'harbor');view.warmDraw(warmRoots(),[...[...fighters.values()].map(fighter=>fighter.group),...(place?[place]:[])]);stamp('warm-drawn');await warmEffekseer(view.renderer,view.camera).catch(()=>{});stamp('effekseer');}
    // The sound, which came in while the room compiled: waited for here as it was before the compile. Its cap is 30 s, not the
    // old 3: on a thin line the bank starts only as the compile does (CombatAudio.holdFetches), and its 13.5 MB for a royale
    // of twelve take 9 s at 12 Mbit/s; a line under 3.6 Mbit/s would start the fight with some still to come (it starts
    // sooner than it did either way: the bank used to come in before the compile, beside the bodies).
    if(soundLater){await warmRoomSound({current,audio,soundCap:30_000,armory:soundLater.armory});if(!current()){horde.collect();return;}}}
  // What this room needed is here: the stream below (a late joiner, a borrowed move) has nothing to add at the fight's start.
  if(!started)streamKey=riftAssets.key(snapshot)+transplantKey(snapshot.players);
  if(network.snapshot&&assetSignature(network.snapshot)===assetSignature(snapshot)&&network===online&&!online.coop)online.room?.send('assets-ready',assetSignature(snapshot));
}
let streamKey='',streamPending=false,streamRetryAt=0;
// A public match's bots, as its room drafts them while the countdown runs (ArenaRoom.planBots, Network.plannedBots): their
// bodies, voices and effects' code fetched once this page's own room is in (not beside it: the room's own files come first),
// so the kickoff's load finds them here - and so does a lone page's match on its device (loneQueue). They came down after
// the countdown, everyone waiting on the AssetGate. (The performance sweep, 24 October 2026.)
let plannedFetched='';
function fetchPlannedBots(){
  const bots=online.plannedBots,key=bots.join();
  if(!started||network!==online||!bots.length||key===plannedFetched)return;plannedFetched=key;
  void library.ensure(bots).catch(error=>{plannedFetched='';console.warn('Planned bots',error);});
  void audio.prepare(bots);prefetchRoomFx(bots.map(fighter=>({fighter})));
}
online.onPlannedBots=fetchPlannedBots;
function streamSnapshotAssets(snapshot:GameSnapshot){
  const key=riftAssets.key(snapshot)+transplantKey(snapshot.players);if(streamPending||key===streamKey||performance.now()<streamRetryAt)return;streamPending=true;
  void ensureSnapshotAssets(snapshot).then(()=>{streamKey=key;}).catch(error=>{streamRetryAt=performance.now()+5000;hud.notify('Loading fighters — retrying…');console.warn('Match assets',error);}).finally(()=>{streamPending=false;});
}
const swaps=new SwapLedger(),hudRoot=root.querySelector<HTMLElement>('#interface')!;
/** The fighters this Training has just switched away from, newest first: their bodies stay on the card
 *  (ensureSnapshotAssets keeps them), so stepping back to one is a frame, not an upload (loading/retention.ts). */
const trainingBench:FighterId[]=[];
/** Each switch as it went, for the measuring tools (arenaEvidence.trainingSwap; scripts/night/train_swap.mjs): whether its
 *  body had to be fetched (`cold`) or was only off the card, the milliseconds from the choice to its body being ready
 *  and to the frame that drew it, and how far the room moved the body in changing it (metres: the snapshot it was asked
 *  on against the snapshot that answered - a tick or two of whatever the fighter was doing, nothing for one standing). */
const swapLog:{side:SwapSide;fighter:FighterId;from:FighterId;cold:boolean;uploaded:boolean;readyMs?:number;shownMs?:number;moved?:number;failed?:string}[]=[];
const swapLanding:{actor:string;fighter:FighterId;askedAt:number;at?:{x:number;z:number};entry:typeof swapLog[number]}[]=[];
/** Couch Training's opponent is Player 2 (snapshot.trainingPair): no dummy there. */
const swapActor=(side:SwapSide)=>side==='self'?network.id:network.snapshot?.trainingPair?.find(id=>id!==network.id)??'sparring-bot';
const swapNote=(side:SwapSide,fighter?:FighterId)=>{const key=side==='self'?'swapSelf':'swapOpponent';if(fighter)hudRoot.dataset[key]=fighter;else delete hudRoot.dataset[key];};
function resetSwaps(){swaps.reset();swapNote('self');swapNote('opponent');trainingBench.length=0;swapLanding.length=0;}
/** The fighters Training holds beside the two in the room: the bench, and whoever is on their way in. */
function benched():FighterId[]{return [...trainingBench,...swaps.waiting()];}
/** The shadow casters among the Armory's pooled effects (roomFx.ts warmRoots): more of them after a load than before it
 *  is a pool the load built, whose depth programs are not linked yet. */
const pooledCasters=()=>{let n=0;for(const pool of warmRoots())pool.traverse(o=>{if((o as THREE.Mesh).isMesh&&o.castShadow)n++;});return n;};
/** A fighter Training is about to switch in, made ready as a late joiner's is (ensureSnapshotAssets with the fight on: its
 *  body, voices and signature effects loaded, its area look, kit effects and seal cast once in hiding, its programs
 *  compiled and its images uploaded a few a frame) - and then what that path leaves to a loading screen: the shadow
 *  programs of whatever pools its effects added (GameRenderer.warmDraw: one frame, drawn off screen, at the moment of
 *  the switch, and only when there is a new caster to link), the passes an effect simulates off screen and the Effekseer
 *  runtime's files (FxStage.effekseer: Bellows's area look linked seven programs on its first cast without it). The
 *  room is asked for as it will be, the newcomer beside the fighter they replace - who is still being drawn, so nothing
 *  of theirs is let go yet. */
async function prepareSwap(room:GameSnapshot,fighter:FighterId,side:SwapSide){
  const self=room.players.find(p=>p.id===network.id)!,casters=warmEnabled()?pooledCasters():0;
  await ensureSnapshotAssets({...room,players:[...room.players,{...self,id:'training-switch',fighter,forge:undefined,outfit:undefined,isBot:side==='opponent'}]});
  if(!warmEnabled())return;
  if(pooledCasters()>casters)view.warmDraw(warmRoots());
  await warmEffekseer(view.renderer,view.camera).catch(()=>{});
}
async function switchTraining(side:SwapSide,fighter:FighterId,random=false){
  const room=network.snapshot,now=room?.players.find(p=>p.id===swapActor(side));
  if(!started||!room||!practiceRoom(room)||!now)return;
  // The choice is remembered as the mode sheet's is: the dummy's fighter in Training's prefs (dealt by RANDOM: none, so the
  // next Training deals again). The player's own is the home's selection, which follows once the room shows it (watchSwaps).
  // (Couch Training's opponent is Player 2: their fighter is the sheet's Player 2 pick, not the dummy's.)
  {const memory=room.trainingPair&&side==='opponent'?random?undefined:{partner:fighter}:swapMemory(side,fighter,random);if(memory)saveModePrefs('training',memory);}
  if(now.fighter===fighter){swaps.drop(side);swapNote(side);return;}
  const ask=swaps.ask(side,fighter,performance.now()),epoch=startEpoch,current=()=>epoch===startEpoch&&started&&swaps.current(ask);
  const entry:typeof swapLog[number]={side,fighter,from:now.fighter,cold:!library.has(fighter),uploaded:compiledFighters.has(fighter)};swapLog.push(entry);if(swapLog.length>40)swapLog.shift();
  swapNote(side,fighter);
  try{
    await prepareSwap(room,fighter,side);
    // (Overtaken by a newer choice, or Training left, while it loaded: the body stays in the library, nothing is asked.)
    if(!current())return;
    entry.readyMs=Math.round(performance.now()-ask.askedAt);
    {const stood=network.snapshot?.players.find(p=>p.id===swapActor(side));swapLanding.push({actor:swapActor(side),fighter,askedAt:ask.askedAt,at:stood&&{x:stood.x,z:stood.z},entry});}
    swaps.sent(ask,performance.now());network.room?.send('training',{lab:SWAP_LAB[side],value:fighter});
  }catch(error){
    console.warn('Training switch',fighter,error);entry.failed=String(error instanceof Error?error.message:error).slice(0,160);
    if(!current())return;
    swaps.drop(side,ask);swapNote(side);hud.notify(`COULD NOT LOAD ${FIGHTERS[fighter].name.toUpperCase()}`,1.6);
  }
}
/** What the room shows of a switch, read off each of its snapshots: an ask it has answered (the bar's note goes), one it
 *  never did (a training room on a match server from before the command: said, and let go), and a side that is another
 *  fighter now - whoever asked. For the player's own, everything the page set from the fighter when the match began
 *  follows: the HUD's portrait, move list and cards (Hud.refighter), the home's selection (Hud.select: the fighter chosen
 *  here is the one the next PLAY starts with) and what PRACTICE AGAIN would start. The Forge studio follows inside
 *  LocalTraining, the trials inside TrainingHud, the music with the frame's own fighter. */
function watchSwaps(snapshot:GameSnapshot){
  const fighterOf=(side:SwapSide)=>snapshot.players.find(p=>p.id===swapActor(side))?.fighter;
  const before={self:swaps.shown('self'),opponent:swaps.shown('opponent')};
  const seen=swaps.observe({self:fighterOf('self'),opponent:fighterOf('opponent')},performance.now());
  for(const ask of seen.settled){swapNote(ask.side);const landing=swapLanding.find(each=>each.askedAt===ask.askedAt),stands=snapshot.players.find(p=>p.id===swapActor(ask.side));if(landing?.at&&stands)landing.entry.moved=+Math.hypot(stands.x-landing.at.x,stands.z-landing.at.z).toFixed(3);}
  for(const ask of seen.lapsed){swapNote(ask.side);const at=swapLanding.findIndex(landing=>landing.askedAt===ask.askedAt);if(at>=0){swapLanding[at].entry.failed='the room did not switch';swapLanding.splice(at,1);}hud.notify('THIS ROOM CANNOT SWITCH FIGHTERS',1.8);}
  for(const side of seen.changed){
    const fighter=fighterOf(side)!,was=before[side];
    if(was){const at=trainingBench.indexOf(was);if(at>=0)trainingBench.splice(at,1);trainingBench.unshift(was);trainingBench.length=Math.min(trainingBench.length,view.governor.relaxed?TRAINING_BENCH_STRONG:TRAINING_BENCH);}
    if(side==='self'){hud.refighter(fighter);hud.select(fighter);if(lastMatchStart)lastMatchStart[0]=fighter;}
    // (Nothing is fetched ahead for PREVIOUS / NEXT: a body parsed on a guess would cost the fight its frames just as the
    // player starts throwing the new fighter's moves. A step to a fighter never loaded waits under the bar's note.)
  }
}
// Home is actionable independently of the full roster. Idle downloads use one worker;
// selecting a fighter or entering a match promotes its assets ahead of that queue.
startup.readyMs=Math.round(performance.now()-startup.started);hud.ready();bootDone(); // (the loading page's end: boot/bootScreen.ts)
// Rapier, every match's collision (the offline modes' own simulation, the online one's prediction), is fetched once the home
// screen is up and the page has its images, not with the page: in the entry (game/moba/LocalRift.ts imported it at the top)
// it was 1.07 MB of a first visit's 3.3 MB of code before PLAY could be pressed. A start pressed before this imports it itself.
{const prefetch=()=>{const idle=(globalThis as {requestIdleCallback?:(go:()=>void,options?:{timeout:number})=>number}).requestIdleCallback;const go=()=>void import('./game/rapierCollision').catch(()=>{});if(idle)idle(go,{timeout:2000});else setTimeout(go,200);};
  if(document.readyState==='complete')prefetch();else{let done=false;const once=()=>{if(!done){done=true;prefetch();}};window.addEventListener('load',once,{once:true});setTimeout(once,3000);}}
// The code only a room needs, out of the entry (loading/lazyCode.ts), fetched the same way once
// the home is up: the old cast's effects (built then, as main.ts built them at startup before), and the picked fighter's own
// effect layer (fetched, built with the room that has them). A start pressed before then waits for them beside its models.
prefetchAtIdle([()=>castFx.get(),async()=>effects.prefetch(hud.selected)]);
// This UI and its candidate selector disappear from ordinary production builds.
if(import.meta.env.MODE==='fighter-lab'){
  const candidate=laboratoryFighter();
  if(candidate){
    root.querySelector<HTMLButtonElement>(`.home-fighter[data-fighter="${candidate}"]`)?.click();
    void showFighterLaboratory(candidate);
  }
}
// A content pack that does not play the royale starts the home on Training (src/engine/packs).
if(activePack()?.modes&&!activePack()!.modes!.includes('royale'))root.querySelector<HTMLButtonElement>('.home-mode[data-mode="training"]')?.click();
// After a reload onto a new build: the fighter and mode card picked before it; and no reload while a match is on.
restoreSelection(root);watchMatch(()=>started);
// After the reload a lost graphics context forced in an online match: the same room, by its reconnection token (boot/rejoin.ts).
{const back=takeRejoin();if(back){online.resumeWith(back.token);closeNotice();void hud.onStart(...back.start as Parameters<typeof hud.onStart>);}}
let backgroundRunning=false;
let rosterPolicy={allowed:false,reason:'not decided yet'};
async function backgroundRoster(){if(backgroundRunning)return;backgroundRunning=true;try{rosterPolicy=backgroundRosterPolicy(readSignals(view.governor.relaxed));await startup.stage('Background fighters',()=>rosterPolicy.allowed&&!activePack()?library.load(()=>{},hud.selected):library.ensure(activePackRoster()??[hud.selected]));}catch(error){console.warn('Background roster will retry on demand',error);}finally{backgroundRunning=false;}}
hud.onRetryLoading=()=>{if(startup.stages.some(s=>s.name==='Harbor'&&s.state==='failed'))location.reload();else{hud.ready();void backgroundRoster();}};
// Not on a phone: the home stays light, and the chosen fighter comes behind the loading screen.
if(!phone())setTimeout(()=>void backgroundRoster(),1500);
// Which body the camera is built from. Your own while you are in the fight;
// once you are out of it, in a match, the fighter `Targeting` nominates - the
// one nearest your corpse, and Tab cycles from there. It used to stay on the
// corpse for as long as the royale lasted, with a distant stranger somewhere
// in frame, which is a shot of the one thing nobody wants to look at. A
// change of subject is a cut, not a swoop: see FollowCamera.cut.
let spectating:string|null=null;
// The round-start intro and the victory orbit, armed once each per match.
// The intro runs for the countdown the room announces and lands on the chase
// shot as it ends; the orbit opens on the KO and eases back on its own.
let introFor:number|null=null,victoryFor:string|null=null;
/** The friends' royale's match in its room last seen (lobby.again.match): a higher one is the next match. */
let againSeen=0;
/** A body the camera can frame: a fighter, or in the arcade an enemy - the
 *  camera reads only its group, state, joints and model. The director's own
 *  shots (a knockout, an ultimate's impact) are kept for bosses: on fodder
 *  they would fire on every other kill. */
const bodyOf=(id:string)=>fighters.get(id)??riftTargets.body(id)??(ballTargets.stand(id) as unknown as Fighter|undefined)??(survival()||objectiveOf(network.snapshot)?.kind==='last-stand'?(horde.body(id) as unknown as Fighter|undefined)??survivalTargets.body(id):undefined);
const fighterById=(id:string)=>fighters.get(id)??(survival()&&isBoss(id)?(horde.body(id) as unknown as Fighter|undefined)??survivalTargets.body(id):undefined);
function cinematics(snapshot:GameSnapshot){
  // The director's own shots: the local player's KO pushes toward the victim,
  // and the local player being hit ends whatever shot is on screen. The
  // ultimate and awakening shots start from the presented fighter itself.
  if(!couch.on)camera.director.handle(snapshot.events,network.id,fighterById);
  const startsAt=snapshot.lobby?.startsAt??null;
  if(snapshot.status==='waiting'&&startsAt!==null&&introFor!==startsAt){introFor=startsAt;camera.intro(Math.max(0,startsAt-snapshot.serverTime));}
  if(snapshot.status==='waiting'&&startsAt===null&&introFor!==null){introFor=null;camera.intro(0);}
  // The finale (src/ui/results/finale.ts): the winner's pose under this orbit, with their line, before the results. On a
  // team's win the orbit holds a fighter of the side still standing (the room names its first seat, standing or not),
  // who says their line too, and the announcer calls the win for the whole side.
  const champion=snapshot.status==='finished'?finaleWinner(snapshot):undefined;
  if(champion&&victoryFor!==champion.id){const winner=fighters.get(champion.id);if(winner){victoryFor=champion.id;const mine=finaleMine(snapshot,network.id),team=!!objectiveOf(snapshot)||!!riftOf(snapshot)||!!ballOf(snapshot);audio.cheer(1,true);if(!survival())audio.ui(UI_SFX.victory,.45,.3);if(!survival()){const line=HOME_VOICES[winner.state.fighter],own=audio.winLine(winner.state.fighter,mine?1.9:.8);if(own===undefined&&line)audio.quote(line,.85,mine?1.9:.8);if(!mine)audio.lossLine(.8+(own??lineSeconds(winner.state.fighter)??0)+.4);}if(!ballOf(snapshot))camera.victory(winner,6);/* a ball match's end is its podium's orbit (BallCeremony) */
    // The feel pass, iteration four: the announcer calls the player's own win in the main game -
    // FLAWLESS! when nothing touched them - over the K.O. (MangaImpact) and the results.
    const self=snapshot.players.find(p=>p.id===network.id);if(mine&&!survival()&&self)audio.announce(self.damageTaken||team?VICTORY_LINE:FLAWLESS_LINE,.95,.55);}}
  if(snapshot.status!=='finished')victoryFor=null;
}
/** Couch play's frame (couch/couch.ts): the two people's fighters as drawn, and in co-op the enemies nearest them, filmed
 *  by the couch camera instead of the follow camera; each seat's aim; and a seat's own pad's START, which pauses. */
function couchFrame(dt:number,snapshot:GameSnapshot){
  const bodies:{x:number;y:number;z:number;height:number}[]=[];
  for(const id of couch.ids){const p=snapshot.players.find(q=>q.id===id);if(!p)continue;const at=fighters.get(id)?.group.position??p;bodies.push({x:at.x,y:at.y,z:at.z,height:1.8*(p.size??1)});}
  const extras:{x:number;y:number;z:number;height:number}[]=[];
  if(couch.kind==='coop'&&bodies.length){
    const mx=bodies.reduce((a,b)=>a+b.x,0)/bodies.length,mz=bodies.reduce((a,b)=>a+b.z,0)/bodies.length;
    const near=snapshot.players.filter(p=>p.alive&&p.enemy&&Math.hypot(p.x-mx,p.z-mz)<9).sort((a,b)=>Math.hypot(a.x-mx,a.z-mz)-Math.hypot(b.x-mx,b.z-mz)).slice(0,3);
    for(const p of near)extras.push({x:p.x,y:p.y,z:p.z,height:1.8*(p.size??1)});
  }
  couch.aimAt(snapshot.players);
  couch.frame(dt,view.camera,bodies,extras,STAGES[snapshot.stage??'harbor']);
  if(couch.menuPads().some(index=>index!==input.padIndex))input.onMenu('controller');
}
/** The split screen's frame (couch/split.ts): each seat's pad turns its own view; each half's follow camera - Player 1's
 *  the page's own, Player 2's the second copy - films its own player, framing the seat's target as the single player's
 *  frames theirs; each half's lens-bound state is kept for the renderer (GameRenderer split); a seat's START pauses. A
 *  seat whose fighter is not drawn (knocked out of a royale) watches the other's. */
function splitFrame(dt:number,snapshot:GameSnapshot){
  const second=camera2;if(!second)return;
  couch.turn(dt,settings.sensitivity);
  couch.aimAt(snapshot.players);
  for(const half of [0,1] as const){
    const rig=half?second:camera,id=couch.ids[half],seatView=couch.views[half];
    const body=fighters.get(id)??fighters.get(couch.ids[half?0:1]);
    if(!body)continue;
    if(half){second.mode=camera.mode;second.style=camera.style;second.cinematics=false;second.finisherCuts=false;second.cuts.arena=camera.cuts.arena;second.battlefield=camera.battlefield;second.stageBounds=camera.stageBounds;second.extraSubjects=camera.extraSubjects;}
    // A keyboard seat has no stick to turn its view with: in the free camera (turned by the mouse alone) its half is the
    // dynamic camera instead, which turns with the fight by itself.
    const seat=couch.seats.seats[half];
    if(seat?.device.kind==='keys'&&rig.mode==='free')rig.mode='dynamic';
    const target=couch.targetOf(id),held=target?bodyOf(target):undefined;
    rig.sole=couch.kind==='versus';rig.comboShot=false;
    seatView.basis=rig.movementBasis(seat?movementMaskOfSeat(seat,couch.seats.held):0);
    // A ball match: each half's ball cam, toggled by its own seat's TARGET (render/ball/BallCam.ts); in Goal Rush the
    // TARGET is the seat's stance instead (game/ball/stance.ts): the ball cam's own rig, or the fight's framing of the lock.
    // Sky Spike's broadcast camera (SpikeCam) takes the heading and the lens there.
    const ballView=ballOf(snapshot),cam=ballCams[half],stances=hasStances(ballView);if(!stances)cam.pressed(couch.pressesOf(id));
    const lock=stances?ballStances[half].lock:null,foe=lock?bodyOf(lock)?.group.position:undefined,subject=foe??ballField.ballPosition();
    const yaw=cam.steer(rig,dt,seatView.yaw,seat?.device.kind==='keys'&&settings.cameraMode==='free'?'dynamic':settings.cameraMode,body.group.position,subject,ballView,teamOf(ballView,id),!!foe);
    // (Each camera's option, off unless picked - render/ball/ballCamChoice.ts.)
    const spike=spikeCams[half];spike.style=spikeCamChoice(settings);ballChases[half].style=chaseCamChoice(settings);
    const heading=spike.steer(rig,dt,seatView.yaw,yaw,cam.on,body.group.position,ballField.ballPosition(),ballView,teamOf(ballView,id),rig.camera.aspect);
    rig.update(dt,body,heading,seatView.pitch,occluders(),settings.shake,!cam.active&&!spike.active&&held&&held!==body?held:undefined,!cam.active&&!spike.active&&couch.lockedOf(id));spike.aim(rig,rig.camera,settings.shake);
    const chase=cam.active&&ballView?.mode==='goal-rush';
    chaseFrame.self.copy(body.group.position);chaseFrame.heading=yaw;chaseFrame.ball=subject;chaseFrame.fight=!!foe;chaseFrame.boosting=!!body.state.boost;chaseFrame.shake=settings.shake;if(ballView)chaseFrame.mode=ballView.mode;
    ballChases[half].aim(rig.camera,dt,chase,ballView?chaseFrame:null);
    seatView.yaw=rig.inputYaw;seatView.pitch=rig.inputPitch;
    halfStates[half].capture(half===0,rig.camera.position);
  }
  netSheer.value=Math.max(spikeCams[0].sheer,spikeCams[1].sheer);
  halfStates[0].apply();
  if(couch.menuPads().some(index=>index!==input.padIndex))input.onMenu('controller');
}
function spectate(self:PlayerState,snapshot:GameSnapshot){
  // A knocked-out player watching the fight keeps watching through its finale: no cut back to their own body.
  const dead=!self.alive&&(snapshot.status==='active'||spectating!==null&&finale.holding(seconds()))&&(snapshot.roomMode!=='training'||!!objectiveOf(snapshot));
  const mode=objectiveOf(snapshot)??riftOf(snapshot);
  const wanted=dead?(mode?squadSubject(snapshot.players,self,spectating):(targetId&&fighters.has(targetId)?targetId:null)):null;
  if(wanted!==spectating){spectating=wanted;camera.cut();}
  if(objectiveOf(snapshot))hud.objectives.watching(wanted?snapshot.players.find(p=>p.id===wanted):undefined,snapshot.players.filter(p=>p.alive&&p.team===self.team&&p.id!==self.id).length);
}
function switchSquadSubject(self:PlayerState,snapshot:GameSnapshot,direction:number){
  const next=squadSubject(snapshot.players,self,spectating,direction);
  if(next!==spectating){spectating=next;camera.cut();}
}
// The panels the stylesheets ask about (body.pf-*), kept as classes instead of :has() rules (ui/panelFlags.ts).
installPanelFlags();
// `dt` is clamped to 0.05 so that a long frame cannot push a body through a
// wall. The camera is deliberately given the time that really passed instead,
// because handing it the clamp made the shot advance in slow motion while the
// fight did not, and below 20 fps it fell metres behind. FollowCamera bounds
// its own step; see the note on `update`. The policy is `frameSteps`.
// At most about sixty frames a second, whatever the display asks for (see FrameGate).
const gate=new FrameGate(),viewFrustum=new THREE.Frustum(),secondFrustum=new THREE.Frustum(),viewProjection=new THREE.Matrix4();
function frame(now:number){requestAnimationFrame(frame);Fighter.beginFrame(now);
  phoneShell.fighting(started&&!hud.settingsOpen);   // the screen kept on in a fight, not behind the pause menu (ui/phoneShell.ts)
  // Every frame's time to the link's measure, before anything below can return: a silence the page's own long frames fill
  // (a room's load, behind the loading screen) is not a stall of the connection (network/linkQuality.ts, 31 October 2026).
  online.link.frame(now);
  // The final optimization pass (26 October 2026): a match frozen for this page (a match on the device paused, or a room
  // that paused for it) behind the pause menu or the bug report draws nothing - the card covers the scene and says
  // "Nothing moves until you resume" - so the frame already on the canvas stays, and the GPU and the frame's work rest
  // until it closes. (A paused Training fight drew the whole scene some 80 times a second.) A bug report's capture still draws.
  // The fight's HUD under the card rests too: its liquid animations pause where they are (body.fight-covered, halo.css).
  // (A window resized meanwhile clears the canvas: that frame is drawn, so the edge round the card shows the fight.)
  const covered=(hud.settingsOpen||bugReport.open)&&!reportCapture&&(localNetwork()?.paused||network===online&&roomFrozen);
  if(covered!==hudCovered){hudCovered=covered;document.body.classList.toggle('fight-covered',covered);}
  const canvasSize=view.renderer.domElement.width*65536+view.renderer.domElement.height;
  // (The pad is still read: its presses drive that card - until 28 October 2026 a paused match's menu never heard them,
  // START did not close it and the D-pad did not move.)
  if(covered&&canvasSize===drawnSize){previous=now;input.enabled=false;input.update(0);hud.keepPadFocus();return;}
  if(!gate.draw(now,previous,view.frames.target(settings.powerMode)))return;
  const steps=frameSteps((now-previous)/1000);previous=now;const dt=steps.world,rawDt=steps.camera;
  pausePump(); // Round 5 (SOLOPAUSE): and a room that pauses for this page.
  let presented:ReturnType<CombatTimeline['sample']>;
  if(network===arcade||network===practice||network===localObjective||network===localRift||network===localBall||network===duel||network===royale){
    // A clock the arena's own time scale drives, a tick behind the newest
    // state it has produced, so two states are always there to blend.
    const local=network===royale?royale:network===duel?duel:network===arcade?arcade:network===practice?practice:network===localRift?localRift:network===localBall?localBall:localObjective,newest=timeline.newest??0,scale=network===arcade?arcade.game?.timeScale??1:1;
    let next=localClock+rawDt*(local.paused?0:scale);
    if(network===localBall&&steadyBallClock&&!local.paused&&inputClock.last>0){
      const err=newest+inputClock.backlog+(now-inputClock.last)/1000*inputClock.rate-BALL_CLOCK.behind-next;
      next+=Math.abs(err)>BALL_CLOCK.snap?err:Math.max(-rawDt*BALL_CLOCK.pace,Math.min(rawDt*BALL_CLOCK.pace,err*Math.min(1,rawDt*BALL_CLOCK.gain)));
    }
    localClock=Math.min(newest,Math.max(newest-3/60,next));
    presented=timeline.at(localClock-LOCAL_DELAY/1000);
  }else presented=timeline.sample(now);
  prediction.visualTime=presented?.time??NaN; // Round 5 (PARRY): a parry's vanish is drawn with the parry (Prediction.visualTime).
  const snapshot=presentSnapshot(started?presented?.snapshot:undefined);
  // A replay showing (Goal Rush's goals, Sky Spike's great points): the fighters and the ball are drawn from it, through its lens.
  const replayed=ballReplay.frame(snapshot);if(ballReplayed&&!replayed){camera.cut();ballChases[0].cut();ballChases[1].cut();}ballReplayed=!!replayed;ballResetPad();quickChat.update(started?network.snapshot:undefined);
  // The finale: what the frame shows as over holds its results back for the winner's pose (src/ui/results/finale.ts).
  {const reading=finaleStateOf(snapshot,id=>fighters.has(id),lineSeconds);if(reading.end&&network.id)finaleSelf=network.id;finale.observe(reading.end,reading.running,seconds());finaleSkip.update(finale.holding(seconds()),finale.elapsed(seconds()));}
  view.setHordeWorkload(survival()||!!riftOf(snapshot)||objectiveOf(snapshot)?.kind==='last-stand');
  hud.presentMatch(network.snapshot,network.id,bugReport.open);
  // The ball ceremonies (BallCeremony): what holds the lens now - the intro, a goal's close-up, the podium.
  const ceremony=ballCeremony.update(started?snapshot:undefined,network.id,rawDt,couch.on);if(ballCeremonyShown&&!ceremony){camera.cut();ballChases[0].cut();ballChases[1].cut();}ballCeremonyShown=!!ceremony;
  // (Its lens is not the follow camera's: what the follow camera would fade out of its own way is not faded under it.)
  if(!couch.on)camera.fading=!ceremony;
  input.enabled=!couch.on&&started&&!finale.holding(seconds())&&(!riftOf(network.snapshot)||riftOf(network.snapshot)?.phase==='active')&&!riftUI.blocking&&!ballUI.blocking&&!replayed&&!ballCeremony.holding&&!vsSplash.open&&!partyUI.open&&!careerUI.open&&(!objectiveOf(network.snapshot)||objectiveOf(network.snapshot)?.phase==='active')&&!hud.objectives.blocking&&network.predictionReady&&!hud.introOpen&&!hud.resultsOpen&&!bugReport.open&&!hud.settingsOpen&&!swapPicker.open&&!shell.dockChoice&&!document.hidden&&!riftIntro.open&&!(snapshot?.lobby?.visibility==='private'&&snapshot.status==='waiting')&&!(survival()&&(survivalHud.draftOpen||survivalHud.resultsOpen||runView()?.phase==='travel'));
  // Couch play: the same gate opens the two seats; the single player's own input stays off for the fight (its pause keys
  // and the menus are still its own).
  if(couch.on)couch.live=started&&!finale.holding(seconds())&&network.predictionReady&&!hud.introOpen&&!hud.resultsOpen&&!bugReport.open&&!hud.settingsOpen&&!document.hidden&&!vsSplash.open&&!(survival()&&(survivalHud.draftOpen||survivalHud.resultsOpen||runView()?.phase==='travel'));
  input.update(dt);hud.keepPadFocus();pushInput();environment.update(now/1000);stages.update(now/1000);
  touch.update(input.enabled,started&&network.snapshot?.status!=='waiting'&&!hud.objectives.blocking,!!ceremony); // a room's lobby may be read upright; its fight asks for landscape; a ball match's ceremony pages (its intro, the podium) are not drawn over
  if(qualityWatch.frame(rawDt,started&&!settings.qualityChosen&&settings.quality!=='low'&&!hud.settingsOpen&&!document.hidden,view.resolutionSpent,view.frames.target(settings.powerMode))){stepDown(settings);view.applySettings(settings);}
  // A phone on Balanced that cannot hold sixty draws an even thirty (render/framePolicy.ts).
  if(view.frames.frame(rawDt,started&&!hud.settingsOpen&&!document.hidden,settings.powerMode)){view.applySettings(settings);frameRateToast();}
  objectiveField.update(snapshot,presented?.time??0,network.id,view.camera);
  riftField.setTarget(targeting.locked?targetId:null);riftField.update(snapshot,network.id,view.camera,dt,couch.split?couch.ids[1]:undefined);riftUI.update(snapshot,network.id,targeting.locked?targetId:null);
  // (Online, how far behind the room this page draws - its prediction's clock less the frame's - for an attack the
  // room puts back into this page's time: BallField `rewound`.)
  ballField.viewLag=forecastTouches&&network===online&&prediction.enabled&&presented?Math.max(0,prediction.localTime-presented.time):0;
  ballField.update(replayed?.snapshot??snapshot,network.id,view.camera,replayed?dt*replayed.rate:dt,performance.now(),!!replayed);
  // Goal Rush's stances under the feet (render/ball/StanceMarks.ts), and its tackles felt.
  {const v=ballOf(snapshot);teamTrims.update(started?ballOf(replayed?.snapshot??snapshot):undefined,trimBody,view.camera.position,couch.split?camera2?.camera.position:null);stanceMarks.update(rawDt,v,network.id,hasStances(v)?ballStances[0].lock:null,ballField.ballPosition(),stanceBody,!!v&&started&&!replayed&&!ceremony);
    spikeCues.update(rawDt,v,network.id,snapshot?.players??[],stanceBody,ballField.ballPosition(),!!v&&started&&!replayed&&!ceremony);
    // (Player 2's, on a split screen: their seat's cues, for their half alone.)
    spikeCues2.update(rawDt,v,couch.split?couch.ids[1]??'':'',snapshot?.players??[],stanceBody,ballField.ballPosition(),couch.split&&!!v&&started&&!replayed&&!ceremony);}
  // A check's trace of the drawn ball (window.__ballTrace = [] on this machine): page ms, frame time, the ball, the newest snapshot's time.
  {const trace=(window as unknown as {__ballTrace?:number[][]}).__ballTrace,p=trace&&presented&&ballField.ballPosition();if(p)trace!.push([performance.now(),presented!.time,p.x,p.y,p.z,timeline.newest??0]);}ballMoments.update(rawDt);ballUI.update(snapshot,network.id);
  if(snapshot){const serverTime=presented!.time;
    // The ball stages are dressed as the arena the match plays in; a new arena is the stage again.
    const arenaNow=ballOf(snapshot)?.arena;if(arenaNow&&arenaNow!==ballArenaShown){setBallArena(arenaNow);ballArenaShown=arenaNow;if(stageWanted===snapshot.stage)stageWanted=null;}
    wantStage(snapshot.stage??'harbor');
    const localImpacts=presentEvents(prediction.takeImpacts(),snapshot.players).map(event=>({...event,id:predictedImpactId++,serverTime}));
    applyCombatFrame(snapshot);prediction.markAuthoritativeImpacts(snapshot.events);let self:PlayerState|undefined;
    cinematics(snapshot);cutIns(snapshot);
    // Measured in the input clock's own (possibly dilated) time, so a tick it
    // stretches is drawn stretched rather than frozen at its end.
    const renderAlpha=inputClock.alpha(performance.now());
    // The view the fighters are judged against (Fighter.unseen): last frame's camera, a frame's travel from this one. A
    // split screen has two: a body Player 2's half shows is seen, as one Player 1's shows is (couch/split.ts).
    viewProjection.multiplyMatrices(view.camera.projectionMatrix,view.camera.matrixWorldInverse);viewFrustum.setFromProjectionMatrix(viewProjection);
    const lens2=couch.split?camera2?.camera:undefined;if(lens2){viewProjection.multiplyMatrices(lens2.projectionMatrix,lens2.matrixWorldInverse);secondFrustum.setFromProjectionMatrix(viewProjection);}
    for(const p of snapshot.players){if(p.enemy||!fighters.has(p.id))continue;const fighter=fighters.get(p.id)!,opponent=snapshot.players.find(o=>o.id===(p.id===network.id?targetId:p.target));const shown=ballCeremony.posed(p.id,replayed?replayed.snapshot.players.find(q=>q.id===p.id)??p:p.id===network.id?(prediction.sample(steps.correction,p,renderAlpha)??p):prediction.sampleRemote(steps.correction,p,renderAlpha));fighter.targetDistance=opponent?Math.hypot(opponent.x-shown.x,opponent.z-shown.z):Infinity;fighter.targetPoint=opponent?(fighter.targetPoint??new THREE.Vector3()).set(opponent.x,opponent.y+1.45,opponent.z):undefined;fighter.cameraPoint=view.camera.position;fighter.unseen=p.id!==network.id&&p.id!==targetId&&p.id!==spectating&&!fighter.inView(viewFrustum,view.camera.position)&&!(lens2&&fighter.inView(secondFrustum,lens2.position));fighter.update(dt,shown,true,rawDt);if(p.id===network.id){self=shown;shownSelf=shown;}}
    // (Goal Rush's SPORT mode: a kick on the run laid over the run, after the bodies are posed - render/ball/kickLayer.ts.)
    if(ballOf(snapshot)?.football)applyKicks(timeline.drawnAt??snapshot.serverTime);
    // The arcade's horde: its bosses, its grunts, the rifts and orbs, and its HUD.
    if(objectiveOf(snapshot)?.kind==='last-stand'){survivalFx.uploadNextTexture();horde.update(snapshot.players,dt,serverTime,view.camera);horde.handle(snapshot.events);techniques.handle(snapshot.events,serverTime);techniques.feed(objectiveOf(snapshot)?.village?.warnings??[],serverTime);}
    if(survival()){
      const sv=runView(),scale=runScale();
      grunts.threats=survivalTargets.glows;
      horde.update(snapshot.players,dt*scale,serverTime,view.camera);horde.handle(snapshot.events);techniques.handle(snapshot.events,serverTime);
      grunts.focus=shownSelf?.alive?gruntFocus.set(shownSelf.x,shownSelf.y+1.1,shownSelf.z):undefined;
      const frames=hordeFrames();if(frames)grunts.update(frames,serverTime,dt*scale,view.camera);
      gore.density=settings.effects;gore.update(dt*scale,performance.now()/1000);
      for(const event of snapshot.events)if(event.kind==='eliminated'&&event.targetId&&event.targetId!==network.id){const body=horde.body(event.targetId);if(body)survivalFx.death(body.group.position.x,body.group.position.y,body.group.position.z,body.def.height,serverTime,body.def.role==='boss');}
      if(sv){career.survival(sv.result,sv.run??0);survivalFx.handle(sv.feed,serverTime,shownSelf?numberAnchor.set(shownSelf.x,shownSelf.y,shownSelf.z):undefined);techniques.feed(sv.feed,serverTime);bossVoices(sv,snapshot);smashes(sv);
        for(const id of rivalIds()){const rival=fighters.get(id);if(rival)survivalFx.aura(rival.group.position.x,rival.group.position.y,rival.group.position.z,serverTime);}
        for(const member of sv.party)if(member.rage){const body=fighters.get(member.id);if(body)survivalFx.rage(body.group.position.x,body.group.position.y,body.group.position.z,serverTime);}
        wantBosses(sv.upcoming??[]);
        survivalFx.update(sv,serverTime,dt,view.camera);survivalHud.update(sv,network===arcade?arcade.game!.fighter:sv.party[0]?.fighter??hud.selected);
        view.sky.setRift(sv.eclipse,sv.eclipse*.85);
        if(coop())coopFrame(sv);
        // Fallen allies, marked where they lie.
        survivalFx.allies(sv.party.slice(1).filter(member=>member.down).map(member=>{const body=snapshot.players.find(p=>p.id===member.id);return{x:body?.x??0,y:body?.y??0,z:body?.z??0,rescue:member.rescue};}),serverTime);
        // A boss walks out of the rift: the lens goes round it once while its
        // card holds the screen, then hands the fight back. The state the HUD
        // reads runs a tick ahead of the frame drawn, so an entrance waits
        // here until its body is on the stage.
        for(const item of sv.feed)if(item.id>lastEntrance&&item.kind==='boss'&&item.actor){
          const body=horde.body(item.actor);
          if(!body&&serverTime-item.at<1)break;
          lastEntrance=item.id;if(body&&settings.cinematics)camera.victory(body as unknown as Fighter,item.boss?2.6:1.6);}
        // Enraged at half health: the boss stops and roars.
        for(const item of sv.feed)if(item.id>lastRoar&&item.kind==='enraged'){lastRoar=item.id;if(item.actor)horde.body(item.actor)?.taunt(serverTime,1.6);}
      }
    }
    // Impact placement consumes the same already-evaluated pose as the contact hold.
    // Feet. The renderer knows the frame each one lands on; nothing was
    // listening.
    for(const [id,body] of fighters){
      if(!body.steps.length)continue;
      const mine=id===network.id;
      for(const step of body.steps){audio.step(step,step.speed,mine);effects.footstep(step,serverTime);}
      body.steps.length=0;
    }
    for(const event of localImpacts){
      const heading=blowHeading(event);
      const detail=impactDetail(event);
      bigBlowSound(event);
      fighters.get(event.targetId??'')?.impact(true,event.slot,'melee',event.contactIndex,heading,event.damage,undefined,detail);
      fighters.get(event.actorId)?.impact(false,event.slot,undefined,undefined,heading,event.damage,undefined,detail);
      camera.impact(Math.min(1,.2+screenWorth(event)/460),heading,hitTier(event.slot,event.chain));
      camera.holdFor(Math.min(1,(event.damage??0)/240));markerHoldUntil=performance.now()/1000+.5;
      view.punch(Math.min(.55,screenWorth(event)/420)*settings.effects);
    }
    audio.handle(localImpacts,network.id,presentPlayers(snapshot.players));
    effects.localId=network.id||undefined;SIGNATURE.localId=effects.localId;
    // VOL.5, the move transplant: to the effects, a body throwing a borrowed move is that move's fighter (engine/client/transplant.ts).
    const shown=presentFighters(fighters);
    effects.handle(predictedVisuals.splice(0),shown);effects.handle(localImpacts,shown);// An enemy's event carries no fighter, so the roster's technique effects
    // pass over it and only the generic contact language (sparks, the guard
    // shield) answers it; an upgrade's proc is drawn by the survival layer.
    // The area slot's casts, releases and strikes are drawn by areaFx alone; the rest go on to every effect module.
    const areaEvents=survival()?snapshot.events.filter(event=>!isProc(event.move)):snapshot.events;
    const fx=areaFx.handle(areaEvents,network.id||undefined,snapshot.players,event=>effects.handleAuthoredAreas([event],shown));
    effects.handle(fx.filter(event=>!prediction.impactWasPresented(event)),shown);castFx.now?.handle(fx,shown);awakeningEffects.handle(fx,fighters);clashEffects.handle(fx);
    if(survival())survivalFx.contacts(snapshot.events,serverTime);
    if(self&&started){const own=fighters.get(self.id)!;const move=['light','heavy','special','ultimate'].includes(self.action)?MOVES[self.fighter][self.action as AttackSlot]:undefined;const elapsed=own.state.actionTime*self.actionDuration;
      // The canvas carries the player's action for the capture tools; written when it changes (every frame it was 180 of the page's 800 DOM writes a second).
      {const canvas=view.renderer.domElement.dataset,phase=move?(elapsed<move.contacts[0]?'charge':'release'):'none',pose=move&&elapsed>move.contacts[0]*.74&&elapsed<move.contacts[0]*.89?'held':'transition';if(canvas.action!==self.action)canvas.action=self.action;if(canvas.phase!==phase)canvas.phase=phase;if(canvas.pose!==pose)canvas.pose=pose;}
      if(new URLSearchParams(location.search).has('capture'))view.renderer.domElement.dataset.motion=JSON.stringify(own.motionEvidence());spectate(self,snapshot);const subject=spectating?fighters.get(spectating):undefined;
      input.arrowsLook=false;
      // Round 4b (TARGETING): holding the lock's binding lets a Tab lock go (Tab itself goes round every opponent).
      if(input.enabled&&viewKeys.lockHold(rawDt,input.keys)&&targeting.locked){targeting.release();autoLock.decline(network.snapshot,startEpoch);hud.notify('LOCK RELEASED',.7);}
      // Round 4b: in the main game's dynamic camera the camera decides who the fight is about (CameraFocus:
      // threat-scored, with hysteresis), and its pick is the soft nominee - the HUD's pin, the input's target. A Tab
      // lock is the lock. The challenger it is weighing goes to the brain, which starts holding it in the shot.
      // Couch versus: Player 1's target is Player 2 (and the HUD's right-hand plate theirs); co-op leaves the aim soft.
      if(couch.on)targetId=couch.kind==='versus'?SECOND:couch.kind==='field'?couch.targetOf(couch.ids[0]):null;
      const focusing=!couch.on&&(settings.cameraMode==='dynamic'||settings.cameraMode==='arena'||settings.cameraMode==='smart')&&self.alive&&!subject;
      if(focusing){const picked=camera.picker.update(rawDt,ballOf(snapshot)?ballTargets.players:riftOf(snapshot)?riftTargets.players:survival()?survivalTargets.players:snapshot.players,self,camera.movementYaw,snapshot.events,targeting.locked?targetId:null,targetId);if(!targeting.locked)targetId=picked;camera.focusHint.pending=camera.picker.pending??'';camera.focusHint.share=camera.picker.pendingShare;}
      else{camera.focusHint.pending='';camera.focusHint.share=0;}
      // Goal Rush's stances (game/ball/stance.ts): the one locked is the target (its marker, the fight's framing), and
      // in the BALL stance nobody is. The player's own turning since the last frame flicks the lock along.
      const stanceView=ballOf(snapshot);
      if(hasStances(stanceView)&&!couch.on){const turned=Number.isFinite(stanceYaw)?Math.atan2(Math.sin(input.yaw-stanceYaw),Math.cos(input.yaw-stanceYaw)):0;
        if(ballPiloted)ballStances[0].mirror(stanceView,self.id);else ballStances[0].update(rawDt,stanceView,self,snapshot.players,input.enabled?turned:0);targetId=ballStances[0].lock;}
      else if(couch.on&&hasStances(stanceView))for(const half of [0,1] as const){const id=couch.ids[half],me=snapshot.players.find(p=>p.id===id);
        ballStances[half].pressed(couch.pressesOf(id),stanceView,me,snapshot.players,couch.split?couch.views[half].yaw:couch.yaw,ballField.ballPosition());ballStances[half].update(rawDt,stanceView,me,snapshot.players,0);}
      else{ballStances[0].update(rawDt,stanceView,self,snapshot.players,0);ballStances[1].update(rawDt,stanceView,undefined,snapshot.players,0);}
      camera.stageBounds=STAGES[snapshot.stage??'harbor'];
      // The stage's reverb (a convolver for the whole fight): dry on the low quality setting, the weak machines' choice.
      audio.setSpace(survival()||objectiveOf(snapshot)||settings.quality==='low'?undefined:snapshot.stage);
      // The place's own sound under the fight (audio/ambience.ts); survival's and the objective modes' places have theirs.
      audio.setAmbience(survival()||objectiveOf(snapshot)?undefined:snapshot.stage);
      // Round 4 (CAMERA): the main game's view keys - O / [ turn, I looks at the target, U behind (P pauses).
      if(input.enabled)viewKeys.steer(rawDt,input,self,targetId?bodyOf(targetId)?.group.position:undefined,camera.movementYaw,movementMask(input.keys),camera.blocked);
      // Every mode uses the shared camera and the player's saved choice.
      // Launch day: the arena camera holds the only opponent there is at any distance (a Duel, Training, the last two of a
      // royale) - further off than the focus looks for one (CameraFocus FOCUS_RANGE), so the camera is handed them itself.
      let rivals=0,rival='';for(const p of snapshot.players)if(p.id!==self.id&&p.alive&&!p.enemy&&(self.team===undefined||p.team!==self.team)){rivals++;rival=p.id;}
      camera.sole=rivals===1;const held=targetId||(camera.sole&&(settings.cameraMode==='arena'||settings.cameraMode==='smart')&&!camera.battlefield?rival:'');
      // The Chase camera style (HomePanels CAMERA_STYLE_OPTIONS): the combo shot while an exchange is on, in a 1v1.
      camera.comboShot=settings.cameraStyle==='chase'&&camera.sole&&!camera.battlefield&&performance.now()-lockExchangeAt<LOCK_EXCHANGE_MS;
      camera.mode=settings.cameraMode;camera.style=settings.cameraStyle;camera.cinematics=settings.cinematics;camera.finisherCuts=roanEnabled();camera.cuts.arena=carded();camera.battlefield=survival()||!!objectiveOf(snapshot)||!!riftOf(snapshot)||!!ballOf(snapshot);camera.wide=ballOf(snapshot)?.mode==='sky-spike'?4.2:ballOf(snapshot)?2.6:0;
      if(survival()){survivalTargets.present(gruntPosition,targetId,camera.picker.pending);for(const [id,body] of horde.cameraBodies)survivalTargets.crowd.set(id,body);}
      camera.extraSubjects=ballOf(snapshot)?ballTargets.crowd:riftOf(snapshot)?riftTargets.crowd:survival()?survivalTargets.crowd:objectiveOf(snapshot)?.kind==='last-stand'?horde.cameraBodies:undefined;
      camera.movementBasis(movementMask(input.keys,!input.arrowsLook));
      netSheer.value=0; // (Sky Spike's net is thinned only under the COURT-SIDE stand, set by whichever camera films below.)
      if(couch.split){splitFrame(rawDt,snapshot);if(now-lastCouchHud>70){couchHud.update(snapshot,couch.ids,[couch.targetOf(couch.ids[0]),couch.targetOf(couch.ids[1])]);lastCouchHud=now;}}
      else if(couch.on){couchFrame(rawDt,snapshot);if(now-lastCouchHud>70){couchHud.update(snapshot,couch.ids,[couch.targetOf(couch.ids[0]),couch.targetOf(couch.ids[1])]);lastCouchHud=now;}}
      else if(subject){const foeId=subject.state.target;const foe=foeId&&foeId!==network.id?fighters.get(foeId):undefined;camera.update(rawDt,subject,input.yaw,input.pitch,occluders(),settings.shake,foe?.state.alive?foe:undefined,!!foe);}
      else{const ballView=ballOf(snapshot),cam=ballCams[0],lock=hasStances(ballView)?ballStances[0].lock:null,foe=lock?bodyOf(lock)?.group.position:undefined,subject=foe??ballField.ballPosition();
        // Goal Rush is filmed by the ball cam's own rig (BallChase), laid over the follow camera's frame: on the ball in
        // the BALL stance, on the opponent locked in the FIGHT stance (closer and lower, a fight's lock-on). The follow
        // camera's own shots (an awakening's, an ultimate's) still have the lens while they run; the rig's fading of
        // what stands in the way is judged from its own lens. Sky Spike is filmed by its broadcast camera (SpikeCam).
        cam.free=!!ballView?.football&&goalLookChoice(settings)==='free';cam.selfId=network.id;
        // (`?ballpilot` in FREE LOOK: nobody's hand is on the view, so the pilot turns it toward where its body runs, at a
        // person's pace - a film of FREE LOOK as it is held.)
        if(cam.free&&ballPiloted)input.yaw=pilotLook(input.yaw,own.group.position,rawDt);
        const yaw=cam.steer(camera,rawDt,input.yaw,settings.cameraMode,own.group.position,subject,ballView,teamOf(ballView,network.id),!!foe);
        // (Each camera's option, off unless picked - render/ball/ballCamChoice.ts; the COURT-SIDE stand looks
        // through the net, which is drawn thinner for it.)
        const spike=spikeCams[0];spike.style=spikeCamChoice(settings);ballChases[0].style=chaseCamChoice(settings);
        const heading=spike.steer(camera,rawDt,input.yaw,yaw,cam.on,own.group.position,ballField.ballPosition(),ballView,teamOf(ballView,network.id),view.camera.aspect);netSheer.value=spike.sheer;
        const chase=cam.active&&ballView?.mode==='goal-rush'&&!((view.camera.userData.rig as {shotWeight?:number}|undefined)?.shotWeight! > .5);camera.fading=!chase;
        camera.update(rawDt,own,heading,input.pitch,occluders(),settings.shake,!cam.active&&!spike.active&&held?bodyOf(held):undefined,!cam.active&&!spike.active&&targeting.locked);spike.aim(camera,view.camera,settings.shake);
        chaseFrame.self.copy(own.group.position);chaseFrame.heading=yaw;chaseFrame.ball=cam.free&&!foe?null:subject;chaseFrame.fight=!!foe;chaseFrame.boosting=!!own.state.boost;chaseFrame.shake=settings.shake;if(ballView)chaseFrame.mode=ballView.mode;
        passMark?.update(ballView,snapshot.players.find(p=>p.id===network.id),snapshot.players,footStick,yaw,view.camera,view.renderer.domElement.clientWidth,view.renderer.domElement.clientHeight,id=>fighters.get(id)?.group.position);
        ballChases[0].aim(view.camera,rawDt,chase,ballView?chaseFrame:null);
        superRide.aim(view.camera,rawDt,ballView,ballField.ballPosition(),superCamChoice(settings),snapshot.serverTime); // (An option, off by default)
        if(chase)camera.fader.update(rawDt,view.camera,camera.director.crowd,own,undefined,NO_FOCUS);}
      // Locked on, the camera steers the heading, so the accumulator the next
      // mouse delta is added to must be the heading on screen (Targeting reads
      // it too). In free mode this hands back exactly what it was given.
      input.yaw=couch.on?couch.yaw:camera.inputYaw;stanceYaw=input.yaw;
      // Round 4: and the pitch, which the dynamic camera levels once it is left alone.
      if(!couch.on)input.pitch=camera.inputPitch;
      touch.meters(self,snapshot.serverTime,couch.on?undefined:ballOf(snapshot),snapshot.players); // (A ball match: its own sports set, input/sportTouch.ts; the players for its TRAP.)
      const target=(ballOf(snapshot)?ballTargets.players:riftOf(snapshot)?riftTargets.players:survival()?survivalTargets.players:snapshot.players).find(p=>p.id===targetId);if(now-lastHud>70){hud.update(snapshot,self,target,network!==online||now-network.receivedAt<1500);hud.link(network===online?online.link.note(now):undefined);const phase=snapshot.status==='finished'?'results':'combat';
        // An arcade enemy is not a matchup. The run plays its act's world's
        // score first - one piece under Shiun, another on Gorai's roof -
        // then the fighter's own.
        const sv=survival()?runView():undefined;
        const rival=sv?undefined:target&&!target.enemy?target.fighter:undefined;
        const lead=sv?RIFT_SCORE:self.fighter,second=sv?undefined:rival,tune=sv?.phase==='over'?'results':phase;
        const soundMode=modeOfSnapshot(snapshot,survival()),outcome=tune!=='results'?undefined:sv?(sv.result?.victory?'win':'loss'):finaleMine(snapshot,network.id)?'win':'loss';
        const context=`${lead}:${second}:${tune}:${soundMode}:${outcome}:${startEpoch}`;if(context!==musicContext){musicContext=context;music.setContext(lead,second,tune,{mode:soundMode,outcome,turn:startEpoch});}// The stats line (?stats) is worked out only when it is shown.
        if(new URLSearchParams(location.search).has('stats')){const perf=view.perf();hud.perf(`${perf.fps.toFixed(1)} FPS · P95 ${perf.p95.toFixed(1)}ms · ${fighters.size} FIGHTERS · ${perf.drawCalls} DRAWS · ${(perf.triangles/1000).toFixed(0)}K TRI · ${perf.samples} SAMPLES · ${settings.quality.toUpperCase()}${network===online&&Number.isFinite(online.link.rtt)?` · PING ${Math.round(online.link.rtt)}MS`:''}`,true);}else hud.perf('',false);lastHud=now;}
      const markerWant=self.action==='ultimate'||target?.action==='ultimate'?0:performance.now()/1000<markerHoldUntil?MARKER_HIT_DIM:1;markerFade+=(markerWant-markerFade)*Math.min(1,rawDt*(markerWant<markerFade?20:5));
      // A couch seat's lock is its own TARGET button's (couch.ts), not the single player's.
      const lockedNow=couch.on?couch.lockedOf(couch.ids[0])||!!ballStances[0].lock:targeting.locked||!!(hasStances(ballOf(snapshot))&&ballStances[0].lock);
      // Shared Glow / bracket feedback in every mode; no second Arcade reticle.
      if(target){const drawn=fighters.get(target.id);if(drawn)drawn.visualCenter(marker);else if(!horde.centre(target.id,marker)&&!grunts.centre(target.id,marker))marker.set(target.x,target.y+1.1*(target.size??1),target.z);marker.y+=.65*(target.size??1);marker.project(view.camera);
        const tint=target.enemy?`#${(ENEMIES[target.enemy]?.color??0xd51d34).toString(16).padStart(6,'0')}`:undefined;
        if(!drawn&&!horde.centre(target.id,marker)&&!grunts.centre(target.id,marker))marker.set(target.x,target.y+1.1*(target.size??1),target.z);hud.targetMarker(0,0,lockedNow||Math.hypot(target.x-self.x,target.z-self.z)>3.3,lockedNow,{id:target.id,name:target.name,bot:target.isBot&&!target.enemy,fighter:target.fighter,hp:target.hp/target.maxHp,distance:Math.hypot(target.x-self.x,target.y-self.y,target.z-self.z),color:tint,threatBody:drawn??riftTargets.body(target.id)??horde.body(target.id)??survivalTargets.body(target.id),body:drawn,centre:drawn?undefined:marker,size:target.size??1,camera:view.camera},markerFade);}else hud.targetMarker(0,0,false);
        // A split screen's second half: Player 2's reticle, and each seat's own shop key and cursor (couch/CouchHud.ts).
        if(couch.split)couchHud.frame(snapshot,couch.ids,[couch.targetOf(couch.ids[0]),couch.targetOf(couch.ids[1])],[couch.lockedOf(couch.ids[0]),couch.lockedOf(couch.ids[1])]);
    }
    const steady=steadyBodies(shown);// (a body whose borrowed move began or ended this frame: its last fighter's lasting visuals let go)
    // The area slot: the aim follows the fighter, its target and its move; the circles fill and strike.
    if(self){const move=areaMoveOf(self),lock=targetId?snapshot.players.find(p=>p.id===targetId&&p.alive):undefined;input.aim.follow(self,input.yaw,lock,move.range,move.radius,areaReady(self,snapshot.serverTime));}else input.aim.cancel();
    areaFx.update(serverTime,input.aim.view,self,floorAt);
    effects.update(serverTime,dt,steady);awakeningEffects.update(serverTime,dt,fighters,settings.effects,view.camera);castFx.now?.update(serverTime,dt,steady,settings.effects,view.camera);strikeTrails.update(dt,steady,view.camera);clashEffects.update(serverTime,view.camera,settings.effects);
    // After CombatEffects has opened this frame's beam slots.
    if(survival()||objectiveOf(snapshot)?.kind==='last-stand')techniques.update(serverTime);
  }
  view.shadowCentred=!replayed&&!!ballOf(snapshot);
  if(replayed){const at=ballField.ballPosition();ballReplay.aim(view.camera,at,replayed.snapshot.serverTime,rawDt);if(at)view.setFocus(at);}else if(ceremony){ballCeremony.aim(view.camera,rawDt);if(shownSelf)view.setFocus(shownSelf);
    // Every body the ceremony films is its subject: none is faded as though it stood in the follow camera's way.
    const own=fighters.get(network.id);if(own){ceremonyBodies.length=0;for(const f of fighters.values())ceremonyBodies.push(f);camera.fader.update(rawDt,view.camera,undefined,own,undefined,ceremonyBodies);}}else if(shownSelf)view.setFocus(view.shadowCentred?ballShadowFocus(shownSelf,ballField.ballPosition(),ballShadow[0]):shownSelf);// look: the sun's shadow box and the screen effects follow the fight (a replay's, the ball)
  ballReplayBars+=((replayed?1:0)-ballReplayBars)*Math.min(1,rawDt*7);
  hud.tick();damageNumbers.update(view.camera);manga.update(view.camera);letterbox.set(couch.on?0:Math.max(camera.cuts.bars,ballReplayBars,ballCeremony.bars));view.cinemaGrade(couch.on?0:camera.cuts.grade);if(camera.cuts.opened!==heardCinema){heardCinema=camera.cuts.opened;if(camera.cuts.openedKind==='confirm'&&camera.cuts.active)audio.ui('fx-swing-huge',.22,.1);}
  if(((started||!hud.homeVisible)&&!survivalHud.treeShown)||reportCapture){if(!couch.split)grunts.prepareCamera(view.camera);view.render(rawDt);ballCeremony.afterDraw(view.renderer.domElement);drawnSize=view.renderer.domElement.width*65536+view.renderer.domElement.height;}
  // Training's switch, measured: the frame that drew the new body (swapLog).
  for(let i=swapLanding.length-1;i>=0;i--){const landing=swapLanding[i];if(fighters.get(landing.actor)?.bodyFighter===landing.fighter){landing.entry.shownMs=Math.round(performance.now()-landing.askedAt);swapLanding.splice(i,1);}}
  if(reportCapture){const capture=reportCapture;reportCapture=undefined;try{capture(view.renderer.domElement.toDataURL('image/jpeg',.8));}catch{/* The capture timeout reports unavailable. */}}
  if(pendingCompile&&!compiling){pendingCompile=false;compiling=true;
    void view.compileScene().catch(()=>{}).finally(()=>{compiling=false;});}
}
requestAnimationFrame(frame);
// What pagehide lets go is not taken back: a page the back/forward cache returns is loaded again (boot/pageLife.ts).
reloadWhenRestored(window);
// A lost WebGL context is rebuilt when the browser gives it back (GameRenderer); one that does not come back reloads.
reloadIfNotRestored(view.renderer.domElement,window);
window.addEventListener('pagehide',()=>{clearInterval(inputTimer);void party.leave();career.leave();void network.leave();library.disposeWarmup();effects.dispose();castFx.now?.dispose();awakeningEffects.dispose();clashEffects.dispose();manga.dispose();environment.dispose();stages.dispose();audio.dispose();musicPanel.dispose();});
// Read-only evidence surface for local acceptance captures; never changes simulation state.
// The scene, renderer and camera are here for the evidence scripts: what a
// frame actually costs is a question about programs and textures, and
// scripts/probe_awakening_cost.mjs answers it by reading renderer.info.
const eventCounts:Record<string,number>={};
/** What a refused press says to the player. The simulation's reasons are ids
 *  ('ultimate-meter'), and the HUD used to print them as they came. */
const REJECTIONS:Record<string,string>={cooldown:'NOT READY',stamina:'NO STAMINA','ultimate-meter':'ULTIMATE NOT CHARGED'};
Object.defineProperty(window,'arenaEvidence',{get:()=>({ballCeremony:ballCeremony.evidence(),ballStance:{lock:ballStances[0].lock,why:ballStances[0].lastChange,chase:ballChases[0].active,yaw:ballChases[0].yaw},couch:couch.on?{kind:couch.kind,screen:couch.screen,split:couch.split,yaw:couch.yaw,ids:[...couch.ids],views:couch.views.map(v=>({...v})),targets:couch.ids.map(id=>couch.targetOf(id)),halves:couch.split?view.halves():undefined}:undefined,trainingSwap:{pending:{self:swaps.pending('self'),opponent:swaps.pending('opponent')},log:swapLog,bench:[...trainingBench],picker:swapPicker.open},areaAim:input.aim.view,areaEvents:areaFx.drawn,areaLooks:areaFx.laidLooks,pause:{state:pauseLink.state,holding:pauseLink.holding,pausable:hud.modes.pausable(),paused:hud.modes.paused(),fightShown},rosterPolicy,fightersLoaded:library.loadedCount,textureSharing,survival:survival()?runView():undefined,coop:coop(),horde:horde.count,enemyResources:horde.resources,localOperation:network===localObjective,grunts:network===arcade?arcade.game?.horde.alive??0:online.hordeFrames.frames.reduce((n:number,f:{n:number})=>Math.max(n,f.n),0),enemies:()=>horde.evidence(),performance:view.perf(),eventCounts,state:network.snapshot,playerId:network.id,local:shownSelf,predicted:prediction.action,prediction:prediction.diagnostics,replays:{replayed:prediction.replayed,folded:prediction.folded},link:network===online?online.link.view(performance.now()):undefined,predicting:prediction.enabled&&prediction.active,locked:targeting.locked,targetId,targetCandidates:survival()?survivalTargets.players.filter(p=>p.alive&&p.id!==network.id&&(shownSelf?.team===undefined||p.team!==shownSelf.team)).map(p=>p.id):undefined,targetProxyCapacity:riftOf(network.snapshot)?riftTargets.capacity:survivalTargets.capacity,riftBodies:{shown:fighters.size,hidden:hiddenRiftBodies.size},cameraMode:camera.mode,combo:camera.comboEvidence(),cameraStyle:camera.style,styleBlend:camera.styleBlend,lockStyle:settings.lockStyle,lockGlow:{...hud.threatGlow.state},cameraFocusHistory:camera.picker.historyEntries,cameraEventHistory:camera.director.historyEntries,scene:view.scene,renderer:view.renderer,camera:view.camera,assets:[...fighters.values()].map(f=>({id:f.state.id,fighter:f.state.fighter,clips:f.clips.map(c=>c.name)})),motion:[...fighters.values()].map(f=>({id:f.state.id,...f.motionEvidence()}))})});
