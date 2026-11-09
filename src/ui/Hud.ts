import { commentaryOf } from '../audio/ballCaller';
import { mediaArt } from './mediaArt';
import {pulseClass} from './pulse';
import {riftOf} from '../game/moba/model';
import {ballOf} from '../game/ball/model';
import { activePackRoster } from '../engine/packs/active';
import { commandList } from './commandList';
import {customOf} from '../game/social/custom';
import {customControls,customValue} from './social/CustomControls';
import {privatePanel} from './hud/privatePanel';
import {InkSelect} from './inkSelect';
import {ObjectiveUI} from './objectives/ObjectiveUI';
import {objectiveOf,isObjectiveKind,OBJECTIVE_NAMES} from '../game/objectives/model';
import {MatchIntro} from './MatchIntro';
import {matchResults} from './MatchResults';
import { pauseMenu } from './PauseMenu';
import { BindingEditor } from './BindingEditor';
import { ACTIONS, boundTo, BINDINGS_EVENT, getBindings, isCapturingBinding, keyName, keyNames, MOVE_ACTIONS, resetBindings, type CombatAction } from '../input/bindings';
import { illustratedControls, type ControlDevice } from './HomeControls';
import { readInvite } from './roomInvite';
import { canNativeShare, shareInvite } from '../social/share';
import { setMatch } from '../social/presence';
import { FIGHTERS, HUD_SKINS, MOVE_LAYOUTS, VFX_DENSITY, VFX_LEVELS, chooseQuality, type Settings } from '../config';
import { launchInvite } from '../originals/launch';
import { machineQuality } from '../render/qualityTier';
import { mangaHome, mangaPortrait, HOME_MODES, HOME_ROSTER, type HomeMode } from './MangaHome';
import { isLaboratoryPreviewFighter } from '../fighterLab';
import { HomePreview } from './HomePreview';
import { bindHomeVolumes, revealHomeFighter, showHomeVolume, stepHomeVolume } from './HomeVolumes';
import { homeFighterGuide } from './HomeFighterGuide';
import { homeOptions, optionValue } from './HomePanels';
import type { NetworkAccess } from '../network';
import type { FighterId, GameSnapshot, PlayerState, RoomMode } from '../game/types';

import { LockOnView, quietNotice, type LockTarget } from './LockOnView';
import { THREAT_NAMES, ThreatOutline, type ThreatBody } from '../render/ThreatOutline';
import { nearest, type Direction } from './spatialFocus';
import { keyboardCombatHints, actionControl, actionName, padCombatHints, padName, type PadControl } from '../input/glyphs';
import { touchLabel } from './prompts';
import { UI_DIRECTION, type PadFamily, type UiAction } from '../input/gamepad';
import { enterDigit, entryHint, showEntry } from './padEntry';
import { stepRound } from './padNav';
import { ModeHudHost } from './hud/host';
import { InkedHud, INK_DEFS, cardsHtml, comboHtml, foePlateHtml, inkedFit, ownPlateHtml } from './hud/inked';
import { PROTO_IDS, ProtoHud, protoClocksHtml } from './hud/protos';
import { MoveTape } from './hud/moveTape';
import { MoveCards } from './hud/moveCards';
import { lockPreview } from '../game/lockMode';

export type TrainingCommand = 'passive' | 'combat' | 'reset' | 'awakening' | import('../game/training/TrainingLab').LabCommand;
/** What the reticle needs besides the projected point: who it is and how far,
 *  an enemy's tint and - round 4 (LOCKON) - the target's id, its drawn body
 *  (or an enemy's centre and size) and the camera, so the brackets hug the body
 *  (src/ui/LockOnView.ts). `inFront` (false when the point came from behind the
 *  camera) is read only without a camera. */
export interface TargetMarkerInfo extends LockTarget { fighter:FighterId; hp:number; threatBody?:ThreatBody;
  /** Round 4b: a bot - its stamp says the fighter, not the rank title it plays under. */
  bot?:boolean }

export class Hud {
  private lastOwnHp:number|null=null;
  private lastFoeHp:number|null=null;
  private lastFoeId:string|null=null;
  private ownHitTimer=0;
  private foeHitTimer=0;
  /** A content pack starts on its first fighter: the default may not be one of its slots (src/engine/packs). */
  selected:FighterId=activePackRoster()?.[0]??'konta';
  private homeMode:HomeMode='bots';
  private duelAccess:'online'|'bot'|'friend'='online';
  /** Arcade Survival alone, or a co-op room for up to four. */
  private arcadeParty:'solo'|'coop'='solo';
  private homeBusy=true;
  private homePreview:HomePreview;
  private homePreviewFighter?:FighterId;
  private homeReturnFocus:HTMLElement|null=null;
  private controlDevice:ControlDevice='keyboard';
  private controlFamily:PadFamily='xbox';
  private controlsPage:'layout'|'guide'='layout';
  onRetryLoading=()=>{};
  /** A lone online Duel queue's FIGHT A BOT (the waiting dock): a bot Duel instead. */
  onFightBot=()=>{};
  onReportBug=()=>{};
  onParty=()=>{};onCareer=()=>{};onCustom=(_type:string,_value:unknown)=>{};
  private customKey='';
  private privateKind:'private'|'coop'|'duel'='private';
  private guideFighter:FighterId='konta';
  private bindingEditor!:BindingEditor;
  /** How many fighters, including the player, the bot royale starts with. */
  botPlayers:number=8;
  /** How many fighters, bots included, a private room the player hosts holds (2 is a duel). */
  private roomSize=8;
  onStart=(_fighter:FighterId,_mode:RoomMode,_name:string,_access?:NetworkAccess)=>{};
  onPrivateStart=()=>{};
  onMusicToggle=(_enabled:boolean)=>{};
  onFighterSelect=(_fighter:FighterId)=>{};
  onFighterPreview=(_fighter:FighterId,_immediate:boolean)=>{};
  onPreviewStop=()=>{};
  private inputMode:'keyboard'|'controller'='keyboard';
  private objectiveCameraHint='';
  private padFamily:PadFamily='generic';
  private editingCode=false;
  private codeDigit=0;
  private privateWaiting=false;
  private rosterKey="";
  onSettings=(_settings:Settings)=>{};
  onResume=()=>{};
  onLeave=()=>{};
  onPlayAgain=()=>{};
  onLaboratoryReview=(_fighter:FighterId)=>{};
  onPractice=()=>{};
  onResults=()=>{};
  /** The match's finale is on screen (main.ts, src/ui/results/finale.ts): the winner's pose holds its results back. */
  finale=()=>false;
  resultAgainLabel='PLAY AGAIN';
  /** The results on screen are a room's that is gone (main.ts onDisconnect): their PLAY AGAIN starts the next match
   *  without it, so a Duel's card offers that rather than RUN IT BACK (MatchResults). A new match, or home, clears it. */
  roomGone=false;
  readonly objectives:ObjectiveUI;
  private matchIntro:MatchIntro;
  get introOpen(){return this.matchIntro.open;}
  skipIntro(){return this.matchIntro.skip();}
  /** The match intro's own VS splash (MatchIntro), so main.ts can give it the same sound as training's. */
  get introSplash(){return this.matchIntro.splash;}
  presentMatch(snapshot:GameSnapshot|null,id:string,blocked=false){this.matchIntro.update(snapshot,id,!objectiveOf(snapshot)&&!riftOf(snapshot)&&!this.survivalMode&&!this.settingsOpen&&!blocked);}
  onTraining=(_command:TrainingCommand)=>{};
  private trainingRoom=false;
  /** Arcade survival: the arena runs as a training room with no sparring bot,
   *  so the practice tools and wording must stay out of it. */
  private survivalMode=false;
  /** Round 5 (UX): the mode's own HUD module (src/ui/hud/), mounted per match by layout. */
  readonly modes:ModeHudHost;
  setSurvival(on:boolean){this.survivalMode=on;this.root.querySelector('.combat-hud')!.classList.toggle('survival',on);}
  private root:HTMLElement;
  private menu:HTMLElement;
  private settingsPanel:HTMLElement;
  private noticeTimer=0;
  /** Ids in the order they stopped being alive, for the placings. */
  private fallen:string[]=[];
  private resultsKey='';
  private botModeButtons:HTMLButtonElement[]=[];
  private markerKey='';private lockOn?:LockOnView;
  /** Round 4b (TARGETING): the lock as the target's own glow (Settings.lockStyle 'glow'). */
  readonly threatGlow=new ThreatOutline();private glowAt=0;private readonly reducedMotion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):undefined;
  /** The own move cards (hud/moveCards.ts): their names, art, cooldowns and charges. */
  private cards!:MoveCards;
  /** Round 5 (HUDIMPL): Inked Plates v2 - the plates, cards, combo and ULTIMATE READY banner (src/ui/hud/inked.ts). */
  private inked!:InkedHud;
  /** Halo's plates and clock (Settings.hudSkin; hud/protos/): idle while the inked look is on. */
  private protos!:ProtoHud;
  /** The Pocket Pad's name tape (Settings.moveLayout). */
  private moveTape=new MoveTape();
  /** Whether Halo is drawn lean (LOW quality or the cooler power setting), as last written to #interface. */
  private hudLean?:boolean;
  constructor(parent:HTMLElement,readonly settings:Settings) {
    this.root=document.createElement('div');this.root.id='interface';parent.append(this.root);
    this.root.innerHTML=`
    <section class="combat-hud hidden" aria-label="Combat status">
      ${INK_DEFS}${ownPlateHtml()}${protoClocksHtml()}
      <div class="match-status"><button type="button" id="duel-cancel" hidden>CANCEL SEARCH</button><strong id="match-mode">TRAINING</strong><span id="match-detail">Sparring arena</span></div>
      <div class="connection-note hidden" id="connection-note" role="status" aria-live="polite">RECONNECTING · Your controls resume when the connection returns.</div><div class="connection-note weak hidden" id="link-note" role="status"></div><div class="private-status hidden" id="private-status"><span>PRIVATE ROOM</span><strong id="private-code"></strong><button id="copy-room-code" type="button">COPY CODE</button><button id="copy-room-link" type="button">COPY INVITE</button><button id="share-room-link" type="button">SHARE</button><button id="room-leave" type="button">LEAVE ROOM</button><button id="private-start" type="button">START FIGHT</button><small id="private-hint"></small><div class="room-roster" id="room-roster" aria-label="Room participants"></div><div id="private-custom"></div></div>${foePlateHtml()}
      <div class="target-marker hidden" id="target-marker" aria-hidden="true"></div>
      <div class="spectate-chip hidden" id="spectate-chip"><b>ELIMINATED</b><span>spectating</span></div>
      <div class="action-message" id="action-message" role="status"></div>
      ${comboHtml()}
      ${cardsHtml(['LIGHT','HEAVY','SPECIAL','ULTIMATE','AREA'],['J','K','Q','R','G','E'])}
      <div class="controls-hint" id="controls-hint">${keyboardCombatHints()}</div>
      <div class="pointer-hint hidden" id="pointer-hint">CLICK TO FOCUS CAMERA</div>
      <div class="perf hidden" id="perf"></div>
    </section>
    <section class="results-scrim hidden" id="results" role="dialog" aria-modal="true" aria-labelledby="results-title"></section>
    ${mangaHome(this.selected,this.botPlayers)}
    ${pauseMenu(settings)}`;
    this.menu=this.root.querySelector('.lobby')!;this.settingsPanel=this.root.querySelector('.settings-scrim')!;
    this.inked=new InkedHud(this.root);this.protos=new ProtoHud(this.root,PROTO_IDS);this.applySkin();this.applyMoveLayout();
    for(const button of this.settingsPanel.querySelectorAll<HTMLButtonElement>('[data-pause-page]'))button.onclick=()=>this.showPausePage(button.dataset.pausePage as 'settings'|'moves');
    this.matchIntro=new MatchIntro(this.root);
    this.modes=new ModeHudHost(this.root,()=>this.survivalMode);
    this.modes.listeners.push({frame(){},event:event=>this.inked.event(event)});
    this.objectives=new ObjectiveUI(this.root);this.objectives.onStart=access=>this.onStart(access.kind==='objective'&&access.fighter?access.fighter:this.selected,'match',this.playerName(),access);this.objectives.onLeave=()=>this.onLeave();this.objectives.onResults=()=>this.onResults();this.objectives.onPause=()=>this.toggleSettings(true);this.objectives.onShop=()=>this.toggleSettings(false);
    bindHomeVolumes(this.menu);
    this.homePreview=new HomePreview(this.root.querySelector('.home-preview')!);
    this.homePreview.setEnabled(settings.homeAnimations!==false);
    this.root.querySelectorAll<HTMLImageElement>('img').forEach(img=>img.addEventListener('error',()=>{img.style.visibility='hidden';}));
    this.root.querySelectorAll<HTMLButtonElement>('[data-fighter]').forEach(button=>{
      button.addEventListener('pointerenter',()=>{this.previewFighter(button.dataset.fighter as FighterId);this.onFighterPreview(button.dataset.fighter as FighterId,false);});
      button.addEventListener('focus',()=>{this.previewFighter(button.dataset.fighter as FighterId);this.onFighterPreview(button.dataset.fighter as FighterId,false);});
      const restoreSelectedPreview=()=>{
        // Pointer and keyboard focus can belong to different cards. A departing
        // old card must not cancel the newer card's preview or pending voice.
        if(this.homePreviewFighter!==button.dataset.fighter)return;
        // A hover voice belongs to its pictured fighter. Leaving an unselected
        // card restores the selected pose, so its temporary line must stop too.
        if(button.dataset.fighter!==this.selected)this.onPreviewStop();
        this.previewFighter(this.selected);
      };
      button.addEventListener('pointerleave',restoreSelectedPreview);
      button.addEventListener('blur',restoreSelectedPreview);
      button.onclick=()=>{
      revealHomeFighter(this.menu,button.dataset.fighter as FighterId);
      this.selected=button.dataset.fighter as FighterId;
      this.root.querySelectorAll<HTMLButtonElement>('[data-fighter]').forEach(el=>{el.classList.toggle('selected',el===button);el.setAttribute('aria-pressed',String(el===button));});
      this.previewFighter(this.selected);
      this.updatePlayLabel();
      this.onFighterSelect(this.selected);this.onFighterPreview(this.selected,true);
      };
    });
    this.bindingEditor=new BindingEditor(this.root,()=>this.renderHomeControls());
    window.addEventListener(BINDINGS_EVENT,()=>{if(!isCapturingBinding())this.refreshBindingHints();});
    window.addEventListener('pointerdown',()=>this.focusBy('pointer'),{capture:true,passive:true});
    window.addEventListener('keydown',()=>this.focusBy('keys'),{capture:true});
    this.homeDialog.addEventListener('close',()=>this.bindingEditor.cancel());
    this.homeDialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&this.homeDialog.dataset.kind==='controls'&&!isCapturingBinding()){event.preventDefault();event.stopPropagation();this.controllerAction('back');}});
    this.homeDialog.addEventListener('cancel',event=>{if(this.homeDialog.dataset.kind==='controls'){event.preventDefault();this.returnToOptions();}});
    this.bindHome();
    this.root.querySelector<HTMLButtonElement>('#home-party')!.onclick=()=>this.onParty();
    const custom=this.root.querySelector<HTMLElement>('#private-custom')!;
    custom.addEventListener('change',e=>{const select=e.target as HTMLSelectElement;if(select.dataset.custom)this.onCustom('custom-rules',customValue(select));});
    custom.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLElement>('[data-vote]');if(b)this.onCustom('arena-vote',b.dataset.vote);});
    this.refreshBindingHints();
    this.root.querySelector<HTMLButtonElement>('#settings-close')!.onclick=()=>this.toggleSettings(false);
    this.root.querySelector<HTMLButtonElement>('#resume')!.onclick=()=>this.toggleSettings(false);
    this.root.querySelector<HTMLButtonElement>('#leave-arena')!.onclick=()=>this.onLeave();
    const results=this.root.querySelector<HTMLElement>('#results')!;
    results.addEventListener('click',event=>{const id=(event.target as HTMLElement).closest('button')?.id;if(id==='results-leave')this.onLeave();else if(id==='results-again')this.onPlayAgain();else if(id==='results-practice')this.onPractice();});
    results.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const items=this.focusables(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
    this.root.addEventListener('training-lab', event => { if(this.trainingRoom)this.onTraining((event as CustomEvent<TrainingCommand>).detail); });
    this.root.querySelectorAll<HTMLButtonElement>('[data-training]').forEach(button=>button.onclick=()=>{
      if(this.trainingRoom)this.onTraining(button.dataset.training as TrainingCommand);
    });
    // What every HUD tick writes to, found once: these are this markup's own (the pause menu's two opponent buttons, the
    // move cards), built above and never rebuilt. `update` asked the whole interface for them fourteen times a second,
    // one of the two by attribute, which no index answers (perf3.md: 0.2-0.5% of the main thread).
    this.botModeButtons=[...this.root.querySelectorAll<HTMLButtonElement>('[data-training="passive"],[data-training="combat"]')];
    this.cards=new MoveCards(this.root.querySelector<HTMLElement>('.move-bar')!);
    // The LABORATORY's drawer (TrainingLabPanel), whose tag is off the fight: the pause menu opens it, and the fight resumes beside it.
    this.root.querySelector<HTMLButtonElement>('[data-lab-open]')!.onclick=()=>{const lab=this.root.querySelector<HTMLDetailsElement>('.training-lab');if(!this.trainingRoom||!lab)return;this.toggleSettings(false);lab.open=true;};
    // Training's switch, from the pause menu too: CHANGE FIGHTER / CHANGE OPPONENT close it and open the picker (TrainingHud).
    this.root.querySelectorAll<HTMLButtonElement>('[data-swap-open]').forEach(button=>button.onclick=()=>{if(!this.trainingRoom)return;this.toggleSettings(false);this.root.dispatchEvent(new CustomEvent('training-swap-open',{detail:button.dataset.swapOpen}));});
    this.root.querySelectorAll<HTMLButtonElement>('[data-bots]').forEach(button=>button.onclick=()=>{
      this.botPlayers=Number(button.dataset.bots);
      this.root.querySelectorAll<HTMLButtonElement>('[data-bots]').forEach(other=>{
        const on=other===button;other.classList.toggle('selected',on);other.setAttribute('aria-pressed',String(on));
      });
      this.selectHomeMode('bots');
    });
    this.root.querySelector<HTMLButtonElement>('#create-private')!.onclick=()=>{if(!this.homeBusy)this.onStart(this.selected,'match',this.playerName(),this.homeDialog.dataset.kind==='duel'?{kind:'duel',access:'host'}:this.homeDialog.dataset.kind==='coop'?{kind:'coop-create'}:{kind:'create-private',players:this.roomSize});};
    // Quick co-op: matched into an open party's run (between its rounds) or a new lobby that starts on a clock.
    this.root.querySelector<HTMLButtonElement>('#quick-coop')!.onclick=()=>{if(!this.homeBusy)this.onStart(this.selected,'match',this.playerName(),{kind:'coop-join',code:'',quick:true});};
    this.root.querySelectorAll<HTMLButtonElement>('[data-room-size]').forEach(button=>button.onclick=()=>{
      this.roomSize=Number(button.dataset.roomSize);
      this.root.querySelectorAll<HTMLButtonElement>('[data-room-size]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
    });
    this.root.querySelector<HTMLFormElement>('#home-join-form')!.onsubmit=event=>{
      event.preventDefault();if(this.homeBusy)return;
      const code=this.root.querySelector<HTMLInputElement>('#room-code')!.value.replace(/\D/g,'');
      if(!/^\d{6}$/.test(code)){this.text('home-dialog-status','Enter a six-digit room code.');return;}
      this.onStart(this.selected,'match',this.playerName(),this.homeDialog.dataset.kind==='duel'?{kind:'duel',access:'join',code}:this.homeDialog.dataset.kind==='coop'?{kind:'coop-join',code}:{kind:'join-private',code});
    };
    this.root.querySelector<HTMLInputElement>('#room-code')!.addEventListener('paste',event=>{
      const invite=readInvite(event.clipboardData?.getData('text')??'');if(!invite)return;event.preventDefault();
      this.openHomeDialog(invite.kind);this.root.querySelector<HTMLInputElement>('#room-code')!.value=invite.code;
      this.text('home-dialog-status',`Invite ready · ${invite.kind==='duel'?'Duel':invite.kind==='coop'?'Co-op Survival':'Private match'}. Press Join room when ready.`);
      this.root.querySelector<HTMLElement>('#join-private')!.focus();
    });
    this.root.querySelector<HTMLInputElement>('#room-code')!.addEventListener('input',event=>{const input=event.target as HTMLInputElement;input.value=input.value.replace(/\D/g,'').slice(0,6);});
    this.root.querySelector<HTMLButtonElement>('#private-start')!.onclick=()=>this.onPrivateStart();
    this.root.querySelector<HTMLButtonElement>('#duel-cancel')!.onclick=()=>this.onLeave();
    this.root.querySelector<HTMLButtonElement>('#room-leave')!.onclick=()=>this.onLeave();
    this.root.querySelector<HTMLButtonElement>('#copy-room-link')!.onclick=()=>void this.shareInvite(false);
    this.root.querySelector<HTMLButtonElement>('#share-room-link')!.onclick=()=>void this.shareInvite(true);
    // SHARE only where the device has a share sheet: elsewhere it was COPY INVITE again.
    this.root.querySelector<HTMLButtonElement>('#share-room-link')!.hidden=!canNativeShare();
    this.root.querySelector<HTMLButtonElement>('#load-retry')!.onclick=()=>{const retry=this.retryStart;this.retryStart=undefined;if(retry)retry();else this.onRetryLoading();};
    this.root.addEventListener('click',event=>{if((event.target as HTMLElement).closest('[data-report-bug]'))this.onReportBug();});
    const invitation=launchInvite(readInvite(location.href));
    if(invitation){
      this.selectHomeMode(invitation.kind==='duel'?'duel':invitation.kind==='coop'?'arcade':'private');
      if(invitation.kind==='coop'){this.arcadeParty='coop';this.root.querySelector('#choose-coop')!.setAttribute('aria-pressed','true');this.root.querySelector('#choose-solo')!.setAttribute('aria-pressed','false');}
      this.openHomeDialog(invitation.kind);this.root.querySelector<HTMLInputElement>('#room-code')!.value=invitation.code;
      const preview=this.root.querySelector<HTMLElement>('#invite-preview')!;preview.textContent=`YOU'RE INVITED · ${invitation.kind==='duel'?'DUEL':invitation.kind==='coop'?'CO-OP SURVIVAL':'PRIVATE MATCH'} · ${invitation.code}. Choose your fighter, then join when ready.`;preview.hidden=false;
    }
    this.root.querySelector<HTMLButtonElement>('#copy-room-code')!.onclick=()=>{const code=this.root.querySelector('#private-code')!.textContent??'';void navigator.clipboard.writeText(code.replace(/\s/g,'')).then(()=>this.notify('ROOM CODE COPIED')).catch(()=>this.notify('SHARE '+code));};
    this.root.querySelector<HTMLSelectElement>('[data-setting="quality"]')!.value=settings.quality;
    this.root.querySelector<HTMLSelectElement>('[data-setting="powerMode"]')!.value=settings.powerMode??'auto';
    this.root.querySelector<HTMLSelectElement>('[data-setting="cameraMode"]')!.value=settings.cameraMode;
    this.root.querySelector<HTMLSelectElement>('[data-setting="cameraStyle"]')!.value=settings.cameraStyle;
    this.root.querySelector<HTMLSelectElement>('[data-setting="lockStyle"]')!.value=settings.lockStyle;
    this.root.querySelector<HTMLSelectElement>('[data-setting="animStyle"]')!.value=settings.animStyle;
    this.root.querySelector<HTMLSelectElement>('[data-setting="hudSkin"]')!.value=settings.hudSkin;
    this.root.querySelector<HTMLSelectElement>('[data-setting="moveLayout"]')!.value=settings.moveLayout;
    this.root.querySelector<HTMLSelectElement>('[data-setting="vfx"]')!.value=settings.vfx;
    const commentary=this.root.querySelector<HTMLSelectElement>('[data-setting="commentary"]');if(commentary)commentary.value=settings.commentary??'grandpa';
    this.root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-setting]').forEach(input=>input.addEventListener(input.type==='range'?'input':'change',()=>this.applySetting(input.dataset.setting!,input)));
    this.settingsPanel.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const items=this.focusables(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
  }
  private applySetting(key:string,input:HTMLInputElement|HTMLSelectElement|InkSelect){
    if(key==='quality')chooseQuality(this.settings,input.value,machineQuality());   // a preset is the player's from now on; AUTO the machine's
    else if(key==='powerMode')this.settings.powerMode=input.value==='cool'||input.value==='full'?input.value:'auto';
    else if(key==='cameraMode')this.settings.cameraMode=input.value as Settings['cameraMode'];
    else if(key==='cameraStyle')this.settings.cameraStyle=input.value==='close'||input.value==='chase'?input.value:'classic';
    else if(key==='lockStyle')this.settings.lockStyle=input.value==='brackets'?'brackets':'glow';
    else if(key==='commentary')this.settings.commentary=commentaryOf(input.value);   // the ball modes' voice (audio/ballCaller.ts)
    else if(key==='hudSkin'){this.settings.hudSkin=(HUD_SKINS as readonly string[]).includes(input.value)?input.value as Settings['hudSkin']:'halo';this.applySkin();}
    else if(key==='moveLayout'){this.settings.moveLayout=(MOVE_LAYOUTS as readonly string[]).includes(input.value)?input.value as Settings['moveLayout']:'row';this.applyMoveLayout();}
    else if(key==='cinematics')this.settings.cinematics=(input as HTMLInputElement).checked;
    // VISUAL EFFECTS: the level, and the particle density that goes with it (config.ts VFX_DENSITY).
    else if(key==='vfx'){this.settings.vfx=(VFX_LEVELS as readonly string[]).includes(input.value)?input.value as Settings['vfx']:'full';this.settings.effects=VFX_DENSITY[this.settings.vfx];}
    else if(key==='animStyle')this.settings.animStyle=input.value==='snap'||input.value==='classic'?input.value:'twos';
    else if(key==='musicEnabled'){this.setMusicEnabled((input as HTMLInputElement).checked);this.onMusicToggle(this.settings.musicEnabled);}
    else if(key==='homeAnimations'){this.settings.homeAnimations=(input as HTMLInputElement).checked;this.homePreview.setEnabled(this.settings.homeAnimations);}
    else if(key==='errorReports')this.settings.errorReports=(input as HTMLInputElement).checked;   // read at every report (boot/errorReports.ts)
    else (this.settings as unknown as Record<string,number>)[key]=Number(input.value);
    this.root.querySelectorAll<HTMLInputElement|HTMLSelectElement>(`[data-setting="${key}"],[data-home-setting="${key}"]`).forEach(other=>{if(other instanceof HTMLInputElement&&other.type==='checkbox')other.checked=(input as HTMLInputElement).checked;else other.value=input.value;});
    this.root.querySelectorAll(`[data-option-value="${key}"]`).forEach(output=>output.textContent=optionValue(key,Number(input.value)));
    try{localStorage.setItem('rift-settings',JSON.stringify(this.settings));}catch{/* Settings still apply in this session. */}
    this.onSettings(this.settings);
  }
  private previewFighter(fighter:FighterId){this.homePreviewFighter=fighter;void this.homePreview.select(fighter);}
  private get homeDialog(){return this.root.querySelector<HTMLDialogElement>('#home-dialog')!;}
  private updatePlayLabel(){
    const label=HOME_MODES.find(mode=>mode.id===this.homeMode)!.label;
    const play=this.root.querySelector('#home-play')!;
    if(isLaboratoryPreviewFighter(this.selected)){
      play.setAttribute('aria-label',`Review ${FIGHTERS[this.selected].name} in offline Training`);
      play.querySelector('span')!.textContent='TEST FIGHTER';return;
    }
    play.setAttribute('aria-label',`Play ${label}${this.homeMode==='duel'?' · '+this.duelAccess:''} as ${FIGHTERS[this.selected].name}`);
    play.querySelector('span')!.textContent=isObjectiveKind(this.homeMode)?'PLAY NOW':'PLAY';
  }
  private selectHomeMode(mode:HomeMode){
    this.homeMode=mode;
    this.root.querySelector<HTMLElement>(`[data-panel="${mode}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
    this.updatePlayLabel();
  }
  private openHomeDialog(kind:'private'|'arcade'|'options'|'controls'|'coop'|'duel'){
    this.onPreviewStop();
    if(!this.homeDialog.open)this.homeReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    this.homeDialog.dataset.kind=kind;
    this.homeDialog.classList.toggle('home-dialog-wide',kind==='options'||kind==='controls');
    this.root.querySelector<HTMLElement>('#invite-preview')!.hidden=true;
    this.text('home-dialog-title',{duel:'DUEL WITH A FRIEND',private:'PRIVATE ROOM',arcade:'ARCADE SURVIVAL',options:'OPTIONS',controls:'CONTROLS',coop:'CO-OP SURVIVAL'}[kind]);
    // A co-op room is made and joined through the same name, host and code
    // fields as a private match.
    if(kind==='private'||kind==='coop'||kind==='duel')this.text('code-help',kind==='duel'?'A private 1v1. Share the code or invite link. Both players choose their fighter before joining.':kind==='coop'?'Share your six-digit code, up to 4 fighters. QUICK MATCH puts you in any open party: mid-run, you drop in between rounds.':'Share your six-digit code. Seats your friends leave empty are filled with bots.');
    this.root.querySelector<HTMLElement>('#home-room-size')!.hidden=kind!=='private';
    this.root.querySelector<HTMLElement>('#quick-coop')!.hidden=kind!=='coop';
    for(const [id,show] of [['home-private-fields',kind==='private'||kind==='coop'||kind==='duel'],['home-arcade-note',kind==='arcade'],['home-coop-note',kind==='coop'],['home-options-fields',kind==='options'],['home-controls-fields',kind==='controls']] as const)this.root.querySelector<HTMLElement>('#'+id)!.hidden=!show;
    if(kind==='options')this.root.querySelector('#home-options-fields')!.innerHTML=homeOptions(this.settings);
    if(kind==='controls'){this.guideFighter=this.selected;this.renderHomeControls();this.showControlsPage('layout');}
    this.text('home-dialog-status','');this.homePreview.setPaused(true);
    if(!this.homeDialog.open)this.homeDialog.showModal();
    // A pad lands on the first content action, keeping Options navigation visible.
    (this.root.querySelector(kind==='private'||kind==='coop'||kind==='duel'?'#create-private':kind==='options'&&this.inputMode==='controller'?'#home-career':'#home-dialog-close') as HTMLElement).focus();
  }
  private renderHomeControls(){this.root.querySelector('#home-control-layout')!.innerHTML=illustratedControls(this.controlDevice,this.controlFamily);}
  private showControlsPage(page:'layout'|'guide'){
    this.bindingEditor.cancel();this.controlsPage=page;
    this.root.querySelector<HTMLElement>('#home-control-layout')!.hidden=page!=='layout';
    this.root.querySelector<HTMLElement>('#home-guide-fields')!.hidden=page!=='guide';
    this.root.querySelectorAll<HTMLButtonElement>('[data-controls-page]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.controlsPage===page)));
    if(page==='guide')this.renderGuide();
  }
  private async shareInvite(native:boolean){
    const code=this.root.querySelector('#private-code')!.textContent?.replace(/\s/g,'')??'';
    if(!/^\d{6}$/.test(code))return;
    // The one SHARE (social/share.ts): the link is at hand inside the press - the game's /join/ page outside Player Two,
    // Player Two's own (asked for as the room opened, social/presence.ts) inside it - so Safari lets it copy or share.
    const {result,url}=await shareInvite({room:code,kind:this.privateKind},native);
    if(result==='shared')this.notify('INVITE SHARED');else if(result==='copied')this.notify('INVITE LINK COPIED');else if(result==='failed')this.text('private-hint',`Copy this invite: ${url}`);
  }
  private renderGuide(){
    const active=document.activeElement as HTMLElement|null;
    const selector=active?.id?`#${active.id}`:active?.dataset.guideStep?`[data-guide-step="${active.dataset.guideStep}"]`:active?.dataset.guidePick?`[data-guide-pick="${this.guideFighter}"]`:undefined;
    this.root.querySelector('#home-guide-fields')!.innerHTML=homeFighterGuide(this.guideFighter,this.controlDevice,this.controlFamily,this.homeBusy);
    if(selector)this.root.querySelector<HTMLElement>(selector)?.focus({preventScroll:true});
    const track=this.root.querySelector<HTMLElement>('.guide-carousel'),selected=track?.querySelector<HTMLElement>('[aria-pressed=true]');
    if(track&&selected)track.scrollLeft=selected.offsetLeft-(track.clientWidth-selected.offsetWidth)/2;
  }
  private returnToOptions(){this.bindingEditor.cancel();this.openHomeDialog('options');this.root.querySelector<HTMLElement>('#home-controls')?.focus();}
  private bindHome(){
    const rail=this.root.querySelector<HTMLElement>('.home-modes')!,wrap=rail.parentElement!;
    const page=()=>{const max=Math.max(0,rail.scrollWidth-rail.clientWidth);wrap.classList.toggle('has-next',rail.scrollLeft<max-8);wrap.classList.toggle('has-previous',rail.scrollLeft>8);wrap.style.setProperty('--mode-progress',String(max?rail.scrollLeft/max:0));wrap.style.setProperty('--mode-visible',`${Math.min(100,rail.clientWidth/Math.max(1,rail.scrollWidth)*100)}%`);};
    rail.addEventListener('scroll',page,{passive:true});new ResizeObserver(page).observe(rail);
    rail.addEventListener('wheel',event=>{if(event.ctrlKey||Math.abs(event.deltaX)>=Math.abs(event.deltaY))return;const max=rail.scrollWidth-rail.clientWidth;if(event.deltaY<0&&rail.scrollLeft<=0||event.deltaY>0&&rail.scrollLeft>=max-1)return;event.preventDefault();rail.scrollLeft+=event.deltaY;},{passive:false});
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button=>button.onclick=()=>this.selectHomeMode(button.dataset.mode as HomeMode));
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode-options]').forEach(button=>button.onclick=()=>{const mode=button.dataset.modeOptions;if(isObjectiveKind(mode)){this.selectHomeMode(mode);this.onPreviewStop();this.objectives.open(mode,'',this.selected);}});
    this.root.querySelectorAll<HTMLButtonElement>('[data-duel]').forEach(button=>button.onclick=()=>{
      this.duelAccess=button.dataset.duel as typeof this.duelAccess;
      this.root.querySelectorAll<HTMLButtonElement>('[data-duel]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
      this.selectHomeMode('duel');if(this.duelAccess==='friend')this.openHomeDialog('duel');
    });
    // Lock combat's preview build (game/lockMode.ts lockPreview): Duel starts on the offline bot, the fight the page itself
    // runs and so the one that plays the experiment; online Duel is the server's, on the live rules.
    if(lockPreview()){const bot=this.root.querySelector<HTMLButtonElement>('[data-duel="bot"]');if(bot){this.duelAccess='bot';this.root.querySelectorAll<HTMLButtonElement>('[data-duel]').forEach(other=>other.setAttribute('aria-pressed',String(other===bot)));}}
    this.root.querySelector<HTMLButtonElement>('#home-play')!.onclick=()=>{
      if(this.homeBusy)return;
      if(isLaboratoryPreviewFighter(this.selected)){this.onLaboratoryReview(this.selected);return;}
      if(isObjectiveKind(this.homeMode)){this.onPreviewStop();this.onStart(this.selected,'match',this.playerName(),{kind:'objective',objective:this.homeMode,access:'bots',fighter:this.selected});return;}
      if(this.homeMode==='duel'){if(this.duelAccess==='friend')this.openHomeDialog('duel');else this.onStart(this.selected,'match',this.playerName(),{kind:'duel',access:this.duelAccess});return;}
      if(this.homeMode==='private'){this.openHomeDialog(this.homeMode);return;}
      if(this.homeMode==='arcade'&&this.arcadeParty==='coop'){this.openHomeDialog('coop');return;}
      this.onStart(this.selected,this.homeMode==='training'?'training':'match',this.playerName(),this.homeMode==='bots'?{kind:'bots',players:this.botPlayers}:this.homeMode==='arcade'?{kind:'survival'}:{kind:'public'});
    };
    for(const action of ['host','join'])for(const b of this.root.querySelectorAll<HTMLButtonElement>('#choose-'+action))b.onclick=()=>{
      this.selectHomeMode('private');this.openHomeDialog('private');
      if(action==='join')this.root.querySelector<HTMLInputElement>('#room-code')!.focus();
    };
    this.root.querySelector<HTMLButtonElement>('#join-private-tab')!.onclick=()=>this.root.querySelector<HTMLInputElement>('#room-code')!.focus();
    for(const party of ['solo','coop'] as const)for(const b of this.root.querySelectorAll<HTMLButtonElement>('#choose-'+party))b.onclick=()=>{
      this.arcadeParty=party;
      for(const other of ['solo','coop'])this.root.querySelector('#choose-'+other)?.setAttribute('aria-pressed',String(other===party));
      this.selectHomeMode('arcade');
      if(party==='coop')this.openHomeDialog('coop');
    };
    this.root.querySelector<HTMLButtonElement>('#home-dialog-close')!.onclick=()=>this.homeDialog.close();
    this.homeDialog.addEventListener('close',()=>{if(this.editingCode)showEntry(this.root.querySelector<HTMLInputElement>('#room-code')!,undefined);this.editingCode=false;this.homePreview.setPaused(false);if(!this.menu.classList.contains('hidden'))this.homeReturnFocus?.focus();});
    this.root.querySelector<HTMLButtonElement>('#home-options')!.onclick=()=>this.openHomeDialog('options');
    this.root.querySelector('#home-options-fields')!.addEventListener('click',event=>{const id=(event.target as Element).closest('button')?.id;if(id==='home-career')this.onCareer();else if(id==='home-controls')this.openHomeDialog('controls');});
    this.root.querySelector('[data-options-back]')!.addEventListener('click',()=>this.returnToOptions());
    this.root.querySelectorAll<HTMLButtonElement>('[data-controls-page]').forEach(button=>button.onclick=()=>this.showControlsPage(button.dataset.controlsPage as 'layout'|'guide'));
    const guide=this.root.querySelector('#home-guide-fields')!;
    guide.addEventListener('keydown',event=>{const e=event as KeyboardEvent;if(!(e.target as HTMLElement).closest('.guide-carousel'))return;let index=HOME_ROSTER.indexOf(this.guideFighter);if(e.key==='ArrowRight')index++;else if(e.key==='ArrowLeft')index--;else if(e.key==='Home')index=0;else if(e.key==='End')index=HOME_ROSTER.length-1;else return;e.preventDefault();this.guideFighter=HOME_ROSTER[(index+HOME_ROSTER.length)%HOME_ROSTER.length];this.renderGuide();});
    guide.addEventListener('wheel',event=>{const e=event as WheelEvent,track=(e.target as HTMLElement).closest<HTMLElement>('.guide-carousel');if(!track||e.ctrlKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;const left=track.scrollLeft,max=track.scrollWidth-track.clientWidth;if(e.deltaY<0&&left<=0||e.deltaY>0&&left>=max-1)return;e.preventDefault();track.scrollBy({left:e.deltaY,behavior:'smooth'});},{passive:false});
    guide.addEventListener('click',event=>{
      const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;
      if(button.dataset.guideStep){this.guideFighter=HOME_ROSTER[(HOME_ROSTER.indexOf(this.guideFighter)+Number(button.dataset.guideStep)+HOME_ROSTER.length)%HOME_ROSTER.length];this.renderGuide();}
      else if(button.dataset.guidePick&&HOME_ROSTER.includes(button.dataset.guidePick as FighterId)){this.guideFighter=button.dataset.guidePick as FighterId;this.renderGuide();}
      else if(button.id==='guide-select'||button.id==='guide-training'){
        if(button.id==='guide-training'&&this.homeBusy)return;
        const fighter=this.root.querySelector<HTMLButtonElement>(`.home-fighter[data-fighter="${this.guideFighter}"]`)!;
        fighter.click();this.homeReturnFocus=fighter;this.homeDialog.close();
        if(button.id==='guide-training'){this.selectHomeMode('training');this.root.querySelector<HTMLButtonElement>('#home-play')!.click();}
      }
    });
    const options=this.root.querySelector('#home-options-fields')!;
    const change=(event:Event)=>{const input=event.target;if(!(input instanceof HTMLInputElement||input instanceof HTMLSelectElement||input instanceof InkSelect)||!input.dataset.homeSetting)return;if((input.type==='range')!==(event.type==='input'))return;this.applySetting(input.dataset.homeSetting,input);};
    options.addEventListener('input',change);options.addEventListener('change',change);
    this.root.querySelector('#home-controls-fields')!.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;if(button.dataset.bind){this.bindingEditor.start(button,this.controlDevice==='controller');return;}if(button.id==='bindings-reset'){this.bindingEditor.cancel();resetBindings(this.controlDevice);this.renderHomeControls();this.root.querySelector<HTMLElement>('#bindings-reset')?.focus();return;}if(!button.dataset.controlDevice)return;this.bindingEditor.cancel();this.controlDevice=button.dataset.controlDevice as ControlDevice;if(button.dataset.controlFamily)this.controlFamily=button.dataset.controlFamily as PadFamily;this.renderHomeControls();this.root.querySelector<HTMLElement>(this.controlDevice==='keyboard'?'[data-control-device="keyboard"]':`[data-control-family="${this.controlFamily}"]`)!.focus();});
    const name=this.root.querySelector<HTMLInputElement>('#player-name')!;
    try{name.value=localStorage.getItem('rift-player-name')||'Fighter';}catch{/* Storage can be unavailable in private browsing. */}
    name.addEventListener('change',()=>{
      name.value=name.value.trim().slice(0,18)||'Fighter';
      try{localStorage.setItem('rift-player-name',name.value);}catch{/* Keep the current session name. */}
    });
    this.updatePlayLabel();
  }
  loading(text:string,progress:number){this.retryStart=undefined;this.root.querySelector<HTMLElement>('#load-retry')!.hidden=true;this.root.querySelector<HTMLElement>('#home-loading')!.hidden=progress>=100&&!this.homeBusy;this.text('load-status',text);this.text('load-label','Loading Fighters');if(this.homeDialog.open&&this.homeBusy)this.text('home-dialog-status','');this.root.querySelector<HTMLProgressElement>('#load-progress')!.value=progress;}
  ready(){this.busy(false);this.loading('ARENA READY',100);this.root.querySelector<HTMLElement>('#load-retry')!.hidden=true;}
  loadingStages(text:string){this.text('load-stages',text);}
  loadFailed(message:string){this.loading(message,0);this.busy(true);this.text('load-label','Couldn’t load fighters');this.root.querySelector<HTMLElement>('#load-retry')!.hidden=false;}
  busy(value:boolean){this.homeBusy=value;if(value)this.banner('');this.objectives.busy(value);this.root.querySelectorAll<HTMLButtonElement>('#home-play,#create-private,#join-private,#quick-coop,#guide-training').forEach(b=>b.disabled=value);this.menu.setAttribute('aria-busy',String(value));if(this.homeDialog.open&&this.homeDialog.dataset.kind==='controls'&&this.controlsPage==='guide')this.renderGuide();}
  /** The HUD's look (Settings.hudSkin): Halo, the default (hud/protos/: data-proto too, for the rules the drawn looks
   *  share), or the inked plates. */
  private applySkin(){const skin=this.settings.hudSkin??'halo';if(this.root.dataset.skin===skin)return;this.root.dataset.skin=skin;inkedFit.comboTop=skin==='halo'?340:300;
    if((PROTO_IDS as readonly string[]).includes(skin)){this.root.dataset.proto=skin;this.protos.refresh();}else delete this.root.dataset.proto;}
  /** How the move cards stand (Settings.moveLayout): the row, or the Pocket Pad (halo.css data-moves). */
  private applyMoveLayout(){this.root.dataset.moves=this.settings.moveLayout??'row';}
  setMusicEnabled(enabled:boolean){this.settings.musicEnabled=enabled;this.root.querySelectorAll<HTMLInputElement>('[data-setting="musicEnabled"],[data-home-setting="musicEnabled"]').forEach(input=>input.checked=enabled);try{localStorage.setItem('rift-settings',JSON.stringify(this.settings));}catch{/* Session settings remain active. */}}
  playerName(){return this.root.querySelector<HTMLInputElement>('#player-name')!.value.trim().slice(0,18)||'Fighter';}
  enter(fighter:FighterId){
    this.objectives.closeSetup();
    this.matchIntro.reset();
    this.onPreviewStop();this.homeDialog.close();this.homePreview.setVisible(false);this.menu.classList.add('hidden');this.root.querySelector('.combat-hud')!.classList.remove('hidden');
    this.fallen=[];this.resultsKey='';this.markerKey='';this.roomGone=false;this.root.querySelector('#results')!.classList.add('hidden');
    this.refighter(fighter);
    // Halo's plates start afresh and play their entrance once the loading screen has cleared (ProtoHud.enter).
    this.protos.enter(fighter);
  }
  /** The fight's HUD made this fighter's: the pause menu's portrait and move list, the own plate, the cards' art and
   *  names. A new match (`enter`) - and Training's switch (main.ts watchSwaps), where the player becomes another fighter
   *  without leaving the fight: nothing else of the HUD is touched, and Halo's own plate takes the new fighter - with
   *  its entrance, that plate alone - from the frame that shows them (ProtoHud.update). */
  refighter(fighter:FighterId){
    this.lastOwnHp=null;this.lastFoeHp=null;this.lastFoeId=null;
    this.text('pause-fighter-name',FIGHTERS[fighter].name.toUpperCase());this.root.querySelector('#pause-portrait')!.innerHTML=mangaPortrait(fighter);
    this.pauseFighter=fighter;this.renderPauseMoves();
    this.text('own-name',FIGHTERS[fighter].name.toUpperCase());this.inked.enter(fighter);
    this.cards.refighter(fighter);
  }
  /** The home's selection moved without a click (Training's switch: the fighter chosen there is the one the next PLAY
   *  starts with). The roster's card and PLAY's label follow now; the big preview - a poster and a pose sheet to fetch
   *  and decode - when the home is next shown (`lobby`), not in the middle of the fight. Nothing is said or played, as
   *  a click would (onFighterSelect, onFighterPreview: the lobby's music and the fighter's line belong to the home). */
  select(fighter:FighterId){
    const button=this.root.querySelector<HTMLButtonElement>(`.home-fighter[data-fighter="${fighter}"]`);
    if(!button||this.selected===fighter)return;
    revealHomeFighter(this.menu,fighter);this.selected=fighter;
    this.root.querySelectorAll<HTMLButtonElement>('[data-fighter]').forEach(el=>{el.classList.toggle('selected',el===button);el.setAttribute('aria-pressed',String(el===button));});
    if(this.menu.classList.contains('hidden'))this.previewDue=true;else this.previewFighter(fighter);
    this.updatePlayLabel();
  }
  private previewDue=false;
  lobby(){if(this.previewDue){this.previewDue=false;this.previewFighter(this.selected);}this.modes.clear();this.objectives.reset();this.matchIntro.reset();this.settingsPanel.classList.add('hidden');this.root.querySelector('#results')!.classList.add('hidden');this.fallen=[];this.resultsKey='';this.roomGone=false;this.root.querySelector('.combat-hud')!.classList.add('hidden');this.menu.classList.remove('hidden');this.homePreview.setVisible(true);this.trainingRoom=false;this.privateWaiting=false;this.root.querySelector('#private-status')!.classList.add('hidden');this.ready();}
  /** The pause menu's MOVE LIST (commandList.ts): the match's fighter, with the buttons of the device in use. */
  private pauseFighter?:FighterId;
  private renderPauseMoves(){const list=this.root.querySelector<HTMLElement>('#pause-move-list');if(list&&this.pauseFighter)list.innerHTML=commandList(this.pauseFighter,this.root.dataset.input==='touch'?'touch':this.inputMode,this.padFamily);}
  private showPausePage(page:'settings'|'moves'){
    const card=this.settingsPanel.querySelector<HTMLElement>('.pause-menu');if(!card)return;
    card.dataset.pausePage=page;card.scrollTop=0;
    this.settingsPanel.querySelector<HTMLElement>(page==='moves'?'.pause-moves-head [data-pause-page]':'.pause-move-list')?.focus({preventScroll:true});
  }
  toggleSettings(force?:boolean){
    this.matchIntro.close();
    if(!this.menu.classList.contains('hidden')){if(force===false||this.homeDialog.open)this.homeDialog.close();else this.openHomeDialog('options');return;}
    const open=force??this.settingsPanel.classList.contains('hidden');
    this.settingsPanel.classList.toggle('hidden',!open);
    if(open){document.exitPointerLock?.();const card=this.settingsPanel.querySelector<HTMLElement>('.pause-menu');if(card)card.dataset.pausePage='settings';this.settingsPanel.querySelector<HTMLElement>('#resume')!.focus({preventScroll:true});}else{this.onResume();if(this.settingsPanel.contains(document.activeElement))(document.activeElement as HTMLElement).blur();}
  }
  get settingsOpen(){return this.objectives.setupOpen||this.homeDialog.open||!this.settingsPanel.classList.contains('hidden');}
  update(snapshot:GameSnapshot,self:PlayerState,target:PlayerState|undefined,connected:boolean){
    // Rift armies and defenses have world health bars and a named Glow target.
    // Their camera proxy is not a roster fighter and must never show Taisei's portrait.
    if(target?.enemy==='rift-unit')target=undefined;
    if(this.lastOwnHp!==null&&self.hp<this.lastOwnHp-1)this.pulseHit('own');
    this.lastOwnHp=self.hp;
    if(target?.id!==this.lastFoeId){this.lastFoeId=target?.id??null;this.lastFoeHp=null;}
    if(target&&this.lastFoeHp!==null&&target.hp<this.lastFoeHp-1)this.pulseHit('foe');
    this.lastFoeHp=target?.hp??null;
    const objective=objectiveOf(snapshot);this.objectives.update(snapshot,self.id);
    this.trainingRoom=snapshot.roomMode==='training'&&!this.survivalMode&&!objective&&!riftOf(snapshot);
    this.root.querySelector('#training-tools')!.classList.toggle('hidden',!this.trainingRoom);
    this.text('pause-mode',riftOf(snapshot)?'RIFT WAR':objective?OBJECTIVE_NAMES[objective.kind]:this.survivalMode?('survival' in snapshot?'ARCADE CO-OP':'ARCADE SURVIVAL'):this.trainingRoom?'TRAINING':snapshot.lobby?.duel?'DUEL':'ONLINE MATCH');
    this.text('settings-session-note',riftOf(snapshot)?.access==='bots'||objective&&(objective.access==='bots'||objective.access==='solo')?'The match is paused. Played locally on this device.':this.survivalMode?('survival' in snapshot?'The co-op run continues while this menu is open.':'The run is paused while this menu is open.'):this.trainingRoom?'Training continues while this menu is open.':'The online match continues while this menu is open.');
    const botMode=(snapshot as GameSnapshot & {trainingBotMode?:'passive'|'combat'}).trainingBotMode;
    for(const button of this.botModeButtons){
      const active=this.trainingRoom&&button.dataset.training===botMode,pressed=String(active);
      if(button.classList.contains('selected')!==active)button.classList.toggle('selected',active);
      if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
    }
    // A string is only a combo once it is two hits long; one hit is just a hit (inked.ts: the count, its damage, the shake).
    this.inked.comboTick(self.combo??0);
    this.privateKind=snapshot.lobby?.duel?'duel':this.survivalMode?'coop':'private';
    // Player Two's friends: the room's line, and its Join while it waits for players (social/presence.ts).
    setMatch(snapshot);
    this.privateWaiting=snapshot.lobby?.visibility==='private'&&snapshot.status==='waiting';this.root.querySelector('.combat-hud')!.classList.toggle('waiting-room',this.privateWaiting);
    const lobby=snapshot.lobby;const isPrivate=lobby?.visibility==='private';
    // A co-op survival room waits in the same panel: four seats, and a run to start.
    const coopRoom='survival' in snapshot;
    // (The panel's words and buttons: ui/hud/privatePanel.ts - a party's room shows no invite, and no START while it starts by itself.)
    const panel=privatePanel(lobby,snapshot.status,snapshot.serverTime,self.id,{coop:coopRoom,players:snapshot.players.length,duel:snapshot.duel}),status=this.root.querySelector<HTMLElement>('#private-status')!;
    status.classList.toggle('hidden',panel.hidden);status.classList.toggle('waiting',snapshot.status==='waiting');status.classList.toggle('party',panel.party);
    if(isPrivate){this.text('private-code',panel.party?'':lobby.code??'');const start=this.root.querySelector<HTMLButtonElement>('#private-start')!;start.hidden=panel.startHidden;start.disabled=!lobby.canStart||!connected;
      const label=this.root.querySelector('#private-status > span');if(label&&label.textContent!==panel.label)label.textContent=panel.label;
      if(start.textContent!==panel.startLabel)start.textContent=panel.startLabel;
      this.text('private-hint',panel.hint);}
    const cv=customOf(snapshot),ck=JSON.stringify([this.privateWaiting&&cv,lobby?.hostId===self.id,lobby?.startsAt]);
    if(ck!==this.customKey){this.customKey=ck;const panel=this.root.querySelector<HTMLElement>('#private-custom')!,focus=panel.contains(document.activeElement)?(document.activeElement as HTMLElement).dataset.focus:undefined;panel.innerHTML=this.privateWaiting&&cv?customControls(cv,lobby?.hostId===self.id,self.id,lobby?.startsAt===null):'';if(focus)panel.querySelector<HTMLElement>(`[data-focus="${focus}"]`)?.focus({preventScroll:true});}
    if(this.privateWaiting){
      const key=snapshot.players.map(p=>`${p.id}:${p.name}:${p.fighter}`).join('|')+lobby?.hostId;
      if(key!==this.rosterKey){this.rosterKey=key;const roster=this.root.querySelector('#room-roster')!;roster.replaceChildren();
        for(let i=0;i<(coopRoom?4:lobby?.size??12);i++){const player=snapshot.players[i],card=document.createElement('div');card.className='room-player'+(player?'':' empty');
          if(player){const portrait=document.createElement('img');portrait.src=mediaArt(FIGHTERS[player.fighter].portrait);portrait.alt='';const names=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small');name.textContent=player.name;detail.textContent=`${FIGHTERS[player.fighter].name} · ${player.id===lobby?.hostId?'HOST':'READY'}`;names.append(name,detail);card.append(portrait,names);}else{card.textContent=`${String(i+1).padStart(2,'0')} · ${lobby?.size&&!coopRoom&&!lobby.duel?'OPEN · BOT AT START':'OPEN SEAT'}`;}roster.append(card);
        }
      }
    }
    // Round 5 (HUDIMPL): the own plate (HP, its number, STAMINA) and the target plate (inked.ts).
    this.inked.update(self,target);
    // Halo's plates and clock (a custom room's time limit, else ∞), drawn lean on LOW quality or the cooler power
    // setting (#interface[data-hd-lean], halo.css): written when that setting turns, not every frame.
    {const custom=customOf(snapshot),clock=custom?.endsAt&&snapshot.status==='active'?Math.max(0,custom.endsAt-snapshot.serverTime):null,inView=!this.matchIntro.open&&snapshot.status==='active';
      const lean=this.settings.quality==='low'||this.settings.powerMode==='cool';if(lean!==this.hudLean){this.hudLean=lean;if(lean)this.root.dataset.hdLean='';else delete this.root.dataset.hdLean;}
      this.protos.update(self,target,snapshot.serverTime,clock,inView);}
    // The move cards (hud/moveCards.ts), and ULTIMATE READY over them once the ultimate is.
    const now=performance.now(),ultimateReady=this.cards.update(self,snapshot.serverTime);
    this.inked.ultimateTick(ultimateReady,this.cards.ultimate,now);
    this.root.querySelector('.fighter-meter.own')!.classList.toggle('offline',!connected);
    this.root.querySelector('#connection-note')!.classList.toggle('hidden',connected);
    // A bot in a royale is a fighter, not scenery: the count is everyone still
    // standing, which is the number the last-one-standing rule is about.
    this.text('match-mode',snapshot.lobby?.duel?'DUEL':snapshot.roomMode==='training'?'TRAINING':this.privateWaiting?'PRIVATE LOBBY':`${snapshot.players.filter(p=>p.alive).length} ALIVE`);
    this.root.querySelector<HTMLElement>('#duel-cancel')!.hidden=!(lobby?.duel&&snapshot.status==='waiting'&&!isPrivate&&!snapshot.players.some(p=>p.isBot));
    const bots=snapshot.players.filter(p=>p.isBot).length;
    this.text('match-detail',lobby?.duel?(snapshot.status==='waiting'?(snapshot.players.length<2?(isPrivate?'WAITING FOR A FRIEND':'FINDING AN OPPONENT…'):lobby.startsAt!==null?`GET READY · ${Math.max(0,Math.ceil(lobby.startsAt-snapshot.serverTime))}s`:'WAITING FOR HOST'):'BEST OF THREE · FIRST TO TWO'):snapshot.roomMode==='training'?(bots===1&&snapshot.players.length-bots===1?'1 PLAYER · SPARRING BOT':`${snapshot.players.length-bots} PLAYER${snapshot.players.length-bots===1?'':'S'} · ${bots} SPARRING BOT${bots===1?'':'S'}`):snapshot.status==='waiting'?(bots?`BATTLE ROYALE · ${snapshot.players.length} FIGHTERS`:`${snapshot.players.length} / ${coopRoom?4:lobby?.size??12} FIGHTERS JOINED`):'LAST ONE STANDING');
    if(cv?.endsAt&&snapshot.status==='active'){const remaining=Math.max(0,Math.ceil(cv.endsAt-snapshot.serverTime));this.text('match-detail',`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')} LEFT`);}
    this.moveTape.tick(this.root,this.cards.bar,now);
    const pointerHint=this.root.querySelector('#pointer-hint')!;
    // Written only when it changes: setting a text to what it already says still swaps its text node, and every DOM
    // insertion on the page made Chrome re-ask its document-wide :has() rules (see panelFlags.ts).
    const hint=this.root.dataset.objective?this.objectiveCameraHint:'CLICK TO FOCUS CAMERA';if(pointerHint.textContent!==hint)pointerHint.textContent=hint;
    pointerHint.classList.toggle('hidden',document.pointerLockElement!==null||this.settingsOpen||this.privateWaiting||this.objectives.blocking||this.inputMode==='controller');
    // Elimination order, for the placings: the snapshot only says who is
    // alive, so the order they stopped being is kept here. Two fighters
    // falling inside one HUD interval are split by damage dealt.
    if(snapshot.status==='waiting')this.fallen.length=0;
    else if(!this.trainingRoom)for(const p of snapshot.players)if(!p.alive&&!this.fallen.includes(p.id))this.fallen.push(p.id);
    // Dead in a match is a chip, not a banner: the banner sat over the
    // spectator view for the rest of the fight and ate every other notice.
    this.root.querySelector('#spectate-chip')!.classList.toggle('hidden',self.alive||this.trainingRoom||snapshot.status!=='active');
    if(!self.alive&&this.trainingRoom)this.notify('TRAINING RESET',0.4);
    // Round 5 (UX, WP2): or RESULTS now, asked from the royale's spectator bar once knocked out (#interface[data-results-now]).
    const finale=snapshot.status==='finished'&&this.finale();
    const finished=((snapshot.status==='finished'&&!finale)||(!self.alive&&'resultsNow' in this.root.dataset))&&!this.trainingRoom&&!this.survivalMode&&!objective&&!riftOf(snapshot)&&!ballOf(snapshot);
    this.results(snapshot,self,finished);
    if(snapshot.status==='finished'&&!finished&&!finale&&!objective&&!riftOf(snapshot)&&!ballOf(snapshot))this.notify(snapshot.winnerId===self.id?'LAST FIGHTER STANDING':'MATCH COMPLETE',0.4);
    this.modes.update(snapshot,self,target);
  }
  private pulseHit(side:'own'|'foe'){
    const meter=this.root.querySelector<HTMLElement>(`.fighter-meter.${side}`)!;
    pulseClass(meter,'hit');
    if(side==='own')window.clearTimeout(this.ownHitTimer);else window.clearTimeout(this.foeHitTimer);
    const timer=window.setTimeout(()=>meter.classList.remove('hit'),420);
    if(side==='own')this.ownHitTimer=timer;else this.foeHitTimer=timer;
  }
  private refreshBindingHints(){
    const free=(code:string)=>!ACTIONS.some(a=>boundTo(a,code));
    this.objectiveCameraHint=`${free('KeyO')&&free('BracketLeft')?'O / [':'← / →'} LOOK${free('KeyI')?'   I RECENTRE':''}   ${keyNames('target').toUpperCase()} LOCK`;
    const pad=this.inputMode==='controller',family=this.padFamily;
    this.root.querySelectorAll<HTMLElement>('.move-slot:not(.couch-view[data-seat="1"] *)').forEach(card=>{const el=card.querySelector<HTMLElement>('kbd');if(!el)return;const action:CombatAction=card.dataset.move?MOVE_ACTIONS[Number(card.dataset.move)]:'awaken',control=action==='awaken'?undefined:actionControl(action);el.textContent=pad?actionName(action,family):keyName(getBindings().keyboard[action][0]);el.className=pad&&family==='playstation'&&control&&['south','east','west','north'].includes(control)?`ps-face ps-${control}`:'';});
    this.root.querySelector('#controls-hint')!.innerHTML=pad?padCombatHints(family):keyboardCombatHints();
    // Overnight UX (9 October 2026): on a touch screen the pause menu's YOUR CONTROLS names the on-screen buttons
    // (prompts.ts touchKey's labels), not the keyboard's keys it read before (J, WASD, SPACE...). Each card and key says
    // its own action (PauseMenu.ts data-action); the sticks have none.
    const touch=this.root.dataset.input==='touch',TOUCH_CONTROL:Partial<Record<PadControl,string>>={lstick:'STICK',rstick:'DRAG'};
    this.root.querySelectorAll<HTMLElement>('.key-cards>[data-action]').forEach(card=>{const action=card.dataset.action as CombatAction,el=card.querySelector('kbd');if(!el)return;el.textContent=touch?touchLabel(action)??'':keyNames(action);el.classList.toggle('touch-key',touch);});
    const movement=this.root.querySelector<HTMLElement>('.secondary-keys [data-pad="lstick"]');if(movement)movement.dataset.plain=['forward','left','backward','right'].map(a=>keyName(getBindings().keyboard[a as 'forward'][0])).join(' / ');
    this.root.querySelectorAll<HTMLElement>('.key-cards small[data-pad],.secondary-keys b:is([data-pad],[data-action])').forEach(el=>{
      const control=el.dataset.pad as PadControl,action=el.closest<HTMLElement>('[data-action]')?.dataset.action as CombatAction|undefined,thumb=action?touchLabel(action):TOUCH_CONTROL[control];
      el.dataset.plain??=el.textContent??'';
      el.textContent=touch&&!pad&&thumb?thumb:action?(pad?actionName(action,family):keyNames(action)):pad?padName(family,control):el.dataset.plain;
    });
    if(this.homeDialog.open&&this.controlsPage==='guide')this.renderGuide();
    this.renderPauseMoves();
  }
  setInputMode(mode:'keyboard'|'controller'|'touch',label='Controller',family:PadFamily='generic'){
    // Touch (input/touch.ts) reads as the keyboard here; #interface[data-input] says touch, for the prompts and the CSS.
    const was=this.inputMode,device=mode==='controller'?'controller':'keyboard';
    this.inputMode=device;this.controlDevice=device;this.padFamily=family;if(family!=='generic')this.controlFamily=family;this.root.dataset.input=mode;this.root.dataset.pad=family;
    if(!isCapturingBinding()&&this.homeDialog.open&&this.homeDialog.dataset.kind==='controls'){const device=(document.activeElement as HTMLElement)?.dataset.controlDevice;this.renderHomeControls();if(device)this.root.querySelector<HTMLElement>(`[data-control-device="${device}"]`)?.focus();}
    if(this.homeDialog.open&&this.homeDialog.dataset.kind==='controls'&&this.controlsPage==='guide')this.renderGuide();
    const pad=mode==='controller';
    this.refreshBindingHints();
    this.text('code-help',pad?`${label} · ${padName(family,'south')} edit code · D-pad digits · ${padName(family,'east')} done`:'Share your six-digit code. Up to 12 fighters.');
    if(pad)this.focusBy('pad');
    if(pad&&was!=='controller'&&(!this.menu.classList.contains('hidden')||this.settingsOpen)&&!this.focusables().includes(document.activeElement as HTMLElement))this.focusDefault();
  }
  /** What moved the focus last, as html[data-focus-by]: after a click or a tap ('pointer') no focus frame is drawn
   *  (controller.css); a key or the pad ('keys', 'pad': main.ts's onUiAction and onMenu) draws them again. */
  focusBy(by:'pointer'|'keys'|'pad'){const html=document.documentElement;if(html.dataset.focusBy!==by)html.dataset.focusBy=by;}
  get homeVisible(){return !this.menu.classList.contains('hidden');}
  /** Operations use the selected fighter: mode then PLAY NOW on a pad.
   *  Other modes read as three steps: a mode, then a fighter,
   *  then PLAY. Choosing one carries the focus on to the next, so a run is
   *  three presses of the same button from wherever the pad started. */
  private nextStep(chosen:HTMLElement){
    if(!this.homeVisible||this.homeDialog.open||this.settingsOpen)return;
    const play=this.root.querySelector<HTMLButtonElement>('#home-play')!;
    if(chosen.matches('.home-fighter')&&!play.disabled)play.focus();
    else if(chosen.matches('.home-mode')&&isObjectiveKind(chosen.dataset.mode)&&!play.disabled)play.focus();
    else if(chosen.matches('.home-mode')&&chosen.dataset.mode!=='private')(this.focusables().find(el=>el.matches('.home-fighter[aria-pressed="true"]'))??this.focusables().find(el=>el.matches('.home-fighter')))?.focus();
  }
  /** Where a pad starts in a menu: the fighter already chosen on the home
   *  screen, the way back to the fight in the pause menu, the first control
   *  anywhere else. */
  private focusDefault(){
    if(this.objectives.blocking&&this.settingsPanel.classList.contains('hidden')){this.objectives.focus();return;}
    const items=this.focusables(),home=!this.homeDialog.open&&!this.settingsOpen&&!this.resultsOpen&&!this.privateWaiting;
    const preferred=home?items.find(el=>el.matches('[data-fighter][aria-pressed="true"],#shop [data-item][aria-pressed="true"]')):this.resultsOpen?items.find(el=>el.id==='results-again'):this.settingsOpen&&!this.homeDialog.open?items.find(el=>el.id==='resume'):undefined;
    (preferred??items[0])?.focus();
  }
  private focusables(){const container=this.homeDialog.open?this.homeDialog:this.settingsOpen?this.settingsPanel:this.resultsOpen?this.root.querySelector<HTMLElement>('#results')!:this.privateWaiting?this.root.querySelector<HTMLElement>('#private-status')!:this.menu;return [...container.querySelectorAll<HTMLElement>('button,input,select,summary')].filter(el=>el.getBoundingClientRect().width>0&&!(el as HTMLButtonElement).disabled&&el.id!=='player-name');}
  controllerAction(action:UiAction){
    if(isCapturingBinding())return;
    if(this.settingsPanel.classList.contains('hidden')&&this.objectives.controllerAction(action))return;
    if(this.introOpen){if(action==='confirm'||action==='back')this.skipIntro();return;}
    if(this.menu.classList.contains('hidden')&&!this.settingsOpen&&!this.privateWaiting&&!this.resultsOpen)return;
    const items=this.focusables();if(!items.length)return;let active=document.activeElement as HTMLElement;
    if(this.editingCode){const input=this.root.querySelector<HTMLInputElement>('#room-code')!,entry=enterDigit({value:input.value,digit:this.codeDigit},action);this.codeDigit=entry.digit;if(entry.done){this.editingCode=false;showEntry(input,undefined);this.text('code-help',`Code ready · JOIN with ${padName(this.padFamily,'south')}`);if(action==='confirm')this.root.querySelector<HTMLElement>('#join-private:not(:disabled)')?.focus();return;}showEntry(input,entry);return;}
    // LB / RB turn a screen's tabs: the roster's volumes on the home, CONTROLS' two pages in Options.
    if(action==='tabPrevious'||action==='tabNext'){this.turnTab(action==='tabNext'?1:-1);return;}
    if(action==='back'){if(this.homeDialog.open){if(this.homeDialog.dataset.kind==='controls'&&this.controlsPage==='guide'){this.showControlsPage('layout');this.root.querySelector<HTMLElement>('#home-guide')!.focus();return;}if(this.homeDialog.dataset.kind==='controls'){this.returnToOptions();return;}/* LEGAL, a page of Options: back to Options, as CONTROLS goes (legal.ts). */const legal=this.homeDialog.querySelector<HTMLElement>('#home-legal-page [data-legal-back]');if(legal){legal.click();return;}this.homeDialog.close();this.editingCode=false;return;}if(this.settingsOpen)this.toggleSettings(false);else if(this.resultsOpen)this.onLeave();return;}
    // The first press after the pad wakes up shows where it is, and does
    // nothing else: pressing a button nobody could see was focused is a guess.
    if(!items.includes(active)){this.focusDefault();return;}
    if(action==='confirm'){if(active.id==='room-code'){this.editingCode=true;this.codeDigit=0;showEntry(active as HTMLInputElement,{value:(active as HTMLInputElement).value.replace(/\D/g,'').padEnd(6,'0').slice(0,6),digit:0});this.text('code-help',entryHint(this.padFamily));}else{active.click();this.nextStep(active);}return;}
    if((action==='left'||action==='right')&&active instanceof HTMLInputElement&&active.type==='range'){const sign=action==='right'?1:-1;active.value=String(Math.max(Number(active.min),Math.min(Number(active.max),Number(active.value)+sign*Number(active.step||.1))));active.dispatchEvent(new Event('input',{bubbles:true}));active.dispatchEvent(new Event('change',{bubbles:true}));return;}
    if((action==='left'||action==='right')&&active instanceof HTMLSelectElement){active.selectedIndex=Math.max(0,Math.min(active.options.length-1,active.selectedIndex+(action==='right'?1:-1)));active.dispatchEvent(new Event('change',{bubbles:true}));return;}
    // A setting's picker (inkSelect.ts) in Options or the pause menu: left and right step its value, as a slider's do
    // (A still opens its list). Not the home's own pickers (the series filter), where left and right move on.
    {const pick=active.matches('.ink-pick-button')?active.closest('ink-select'):null;if((action==='left'||action==='right')&&pick instanceof InkSelect&&(this.homeDialog.open||this.settingsOpen)&&pick.getAttribute('layout')!=='faces'){pick.step(action==='right'?1:-1);return;}}
    if((action==='left'||action==='right')&&active.dataset.guidePick){this.guideFighter=HOME_ROSTER[(HOME_ROSTER.indexOf(this.guideFighter)+(action==='right'?1:-1)+HOME_ROSTER.length)%HOME_ROSTER.length];this.renderGuide();return;}
    if((action==='left'||action==='right')&&active.closest('.home-volumes')){stepHomeVolume(this.menu,action==='right'?1:-1);return;}
    // To whatever lies that way on screen; nothing there, and it stays put.
    const direction:Direction|undefined=UI_DIRECTION[action];if(!direction)return;
    const to=nearest(active.getBoundingClientRect(),items.map(el=>el.getBoundingClientRect()),direction);
    if(to>=0)items[to].focus();
  }
  /** LB / RB. On the home, the roster's volumes, round from the last to the first: a focus on a fighter stays on the
   *  roster, at the same place on the next volume; anywhere else it stays where it is. In Options' CONTROLS, its two
   *  pages. */
  private turnTab(step:1|-1){
    if(this.homeDialog.open){
      if(this.homeDialog.dataset.kind!=='controls')return;
      const page=this.controlsPage==='layout'?'guide':'layout';
      this.showControlsPage(page);this.root.querySelector<HTMLElement>(`[data-controls-page="${page}"]`)?.focus();return;
    }
    if(!this.homeVisible||this.settingsOpen||this.resultsOpen||this.privateWaiting)return;
    const active=document.activeElement instanceof HTMLElement?document.activeElement:null,shown=()=>[...this.menu.querySelectorAll<HTMLElement>('.home-volume:not([hidden]) .home-fighter')];
    const slot=active?.matches('.home-fighter')?shown().indexOf(active):-1,count=this.menu.querySelectorAll('.home-volume:not([data-active="false"])').length;
    const at=Number(this.menu.querySelector<HTMLElement>('[data-volume-tab][aria-pressed="true"]')?.dataset.volumeTab??1);
    if(count<2)return;
    showHomeVolume(this.menu,stepRound(Array.from({length:count},(_,i)=>i+1),at,step)!,true);
    if(slot>=0){const now=shown();now[Math.min(slot,now.length-1)]?.focus();}
    else if(active&&!active.closest('.home-volumes'))active.focus({preventScroll:true});
  }
  /** How many frames the focus has been lost for, while a pad is in use (keepPadFocus). */
  private lostFor=0;
  /** Every frame (main.ts): while a pad is in use, a focus lost to the page - a dialog closed under it, a list redrawn,
   *  the home back after a match - goes back to where the pad starts, once the page has had a few frames to put it
   *  somewhere itself. The next press never lands nowhere, and the focus frame is always drawn. A fight with no menu up
   *  keeps no focus. */
  keepPadFocus(){
    const html=document.documentElement,active=document.activeElement;
    if(this.inputMode!=='controller'||html.dataset.focusBy!=='pad'||isCapturingBinding()){this.lostFor=0;return;}
    if(active&&active!==document.body&&active!==html&&active.isConnected&&active.getClientRects().length){this.lostFor=0;return;}
    if(++this.lostFor<4)return;
    this.lostFor=0;
    // Another's modal over everything (the mode sheet, the party, a report, a page): its main control, or its first.
    const top=[...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].filter(dialog=>{try{return dialog.matches(':modal');}catch{return true;}}).at(-1);
    if(top&&top!==this.homeDialog){
      const items=[...top.querySelectorAll<HTMLElement>('button,input,select,summary,a[href]:not([href^="mailto:"]),textarea')].filter(el=>el.getClientRects().length&&!(el as HTMLButtonElement).disabled);
      (top.querySelector<HTMLElement>('[data-pad-default]:not(:disabled),[data-focus="go"]:not(:disabled),.ms-go:not(:disabled)')??items[0])?.focus();return;
    }
    if(this.menu.classList.contains('hidden')&&!this.settingsOpen&&!this.resultsOpen&&!this.privateWaiting&&!this.objectives.blocking)return;
    if(this.focusables().length||this.objectives.blocking)this.focusDefault();
  }
  get resultsOpen(){return this.objectives.resultsOpen||!this.root.querySelector('#results')!.classList.contains('hidden');}
  /** The lock-on reticle (round 4, LOCKON; src/ui/LockOnView.ts): brackets
   *  that hug a locked target's body with a red pin over the head, a hollow
   *  pin over the nominee, an arrow at the screen's edge for either off it.
   *  `visible` is main.ts's rule (locked, or the nominee far enough off);
   *  `fade` dims it (0..1) during a hit freeze and an ultimate, when it would
   *  sit on top of the blow. Survival hides it - `targetMarker(0,0,false)` -
   *  and marks its target on the floor instead. */
  /** A split screen's own half for the reticle (couch/CouchHud.ts: Player 1's half, its box and scale on the page), or
   *  none: the whole window. */
  markerSpace(space?:{w:number;h:number;x:number;y:number;s:number}){(this.lockOn??=new LockOnView(this.root.querySelector<HTMLElement>('#target-marker')!,this.settings)).space=space;}
  /** The cards' keys and the controls line as the bindings and the device say them, again (a split screen wrote its
   *  seats' own keys on Player 1's cards: couch/CouchHud.ts). */
  restoreKeys(){this.refreshBindingHints();}
  targetMarker(x:number,y:number,visible:boolean,locked=false,info?:TargetMarkerInfo,fade=1){
    // Round 4b (TARGETING): locked, the target's own body glows in its threat
    // colour (src/render/ThreatOutline.ts), including Last Stand enemies,
    // and the pin and the edge arrow take the same colour; the
    // brackets are the other style. A bot's stamp names its fighter.
    const now=performance.now()/1000,dt=this.glowAt?now-this.glowAt:0;this.glowAt=now;
    const glow=this.settings.lockStyle!=='brackets'&&locked&&!!info;
    const candidate=info?.threatBody??(info?.body as unknown as ThreatBody|undefined);
    const body=glow&&candidate?.threatInk?candidate:undefined;
    this.threatGlow.update(dt,body,!!this.reducedMotion?.matches);
    if(info){
      if(info.bot)info.name=FIGHTERS[info.fighter]?.name??info.name;
      // Bodies without threat uniforms keep the bracket fallback.
      if(body){info.glow=true;const level=this.threatGlow.state.level;if(level!==-1){info.threat=THREAT_NAMES[level];info.color=this.threatGlow.state.css;}}
    }
    (this.lockOn??=new LockOnView(this.root.querySelector<HTMLElement>('#target-marker')!,this.settings)).update(x,y,visible,locked,info,fade);
  }
  /** The results table, drawn once per distinct final standing rather than
   *  every HUD tick, and only for a match: training never finishes. */
  private results(snapshot:GameSnapshot,self:PlayerState,show:boolean){
    const panel=this.root.querySelector<HTMLElement>('#results')!;
    // Written only when it changes. `classList.add` of a class already there still counts as a change of the attribute
    // to whoever watches it, and two do (panelFlags.ts, ResultsShell): through a whole match this line, fourteen times a
    // second, had the first ask the page eleven selectors and the second two more (perf3.md).
    const opening=panel.classList.contains('hidden');
    if(!show){if(!opening)panel.classList.add('hidden');this.resultsKey='';return;}
    const key=snapshot.players.map(p=>`${p.id}:${p.alive?1:0}:${p.kills??0}:${p.damageDealt??0}:${p.damageTaken??0}`).join('|')+'#'+snapshot.winnerId+'#'+this.fallen.join(',')+'#'+JSON.stringify(snapshot.duel)+JSON.stringify(snapshot.rivals??'')+JSON.stringify(snapshot.lobby?.again??'')+(this.roomGone?'#gone':'');
    if(opening)panel.classList.remove('hidden');
    if(key===this.resultsKey)return;this.resultsKey=key;
    const expanded=panel.querySelector<HTMLDetailsElement>('details')?.open??false,focus=(document.activeElement as HTMLElement)?.id;
    panel.innerHTML=matchResults(snapshot,self,this.fallen,this.resultAgainLabel,this.roomGone);
    panel.querySelector<HTMLDetailsElement>('details')!.open=expanded;
    if(opening){document.exitPointerLock?.();this.onResults();panel.querySelector<HTMLButtonElement>('#results-again')!.focus({preventScroll:true});}
    else if(focus)panel.querySelector<HTMLElement>('#'+CSS.escape(focus))?.focus({preventScroll:true});
  }

  /** A notice. The reticle's animation says LOCKED ON and LOCK RELEASED
   *  while it is up (round 4), so those two stay quiet then - in the objective
   *  panel too; with no reticle (Arcade Survival) they are said as ever. */
  notify(text:string,duration=1.3){if(quietNotice(text,!!this.lockOn?.live&&!this.privateWaiting))return;this.objectives.notice(text);this.text('action-message',text);this.noticeTimer=performance.now()+duration*1000;}
  tick(){if(this.noticeTimer&&performance.now()>this.noticeTimer){this.text('action-message','');this.noticeTimer=0;}}
  /** Night net: the link's own warning (src/network/linkQuality.ts) - the round trip when it is long, or a stall - in the
   *  connection note's style and smaller, and never over RECONNECTING. A good connection sees nothing here. */
  link(text:string|undefined){
    const e=this.root.querySelector<HTMLElement>('#link-note');if(!e)return;
    const show=!!text&&this.root.querySelector('#connection-note')!.classList.contains('hidden');
    if(show&&e.textContent!==text)e.textContent=text!;
    e.classList.toggle('hidden',!show);
  }
  /** The ?stats line: its text is swapped only while it is shown (a hidden line was rewritten fourteen times a second, a
   *  DOM insertion each time), and only when it differs. */
  perf(text:string,show:boolean){const e=this.perfLine??=this.root.querySelector<HTMLElement>('#perf')!;if(!show){if(!e.classList.contains('hidden'))e.classList.add('hidden');return;}if(e.textContent!==text)e.textContent=text;e.classList.remove('hidden');}
  private perfLine?:HTMLElement;
  /** A start that failed on the way (ui/startFailure.ts): its words, and RETRY doing `retry` (the same start again). */
  retryable(message:string,retry:()=>void){this.error(message);this.retryStart=retry;this.root.querySelector<HTMLElement>('#load-retry')!.hidden=false;}
  private retryStart?:()=>void;
  error(message:string){this.objectives.error(message);this.loading(message,0);this.text('load-label',message);this.menu.classList.remove('hidden');this.root.querySelector('.combat-hud')!.classList.add('hidden');this.busy(false);}
  /** Why the player is back home - the server updated, the connection went - across the top of the home where it cannot
   *  be missed (the launch, 8 October 2026: it was the 11 px grey line under the menu), until it is dismissed or the next
   *  start begins. An empty message takes it down. */
  banner(message:string){
    let el=this.menu.querySelector<HTMLElement>('.home-banner');
    if(!el&&!message)return;
    if(!el){el=document.createElement('div');el.className='home-banner';el.setAttribute('role','alert');el.innerHTML='<p></p><button type="button" data-focus="banner-close" aria-label="Dismiss">✕</button>';el.querySelector('button')!.onclick=()=>this.banner('');this.menu.prepend(el);}
    el.querySelector('p')!.textContent=message;el.hidden=!message;
  }
  private text(id:string,value:string){const el=this.root.querySelector('#'+id)!;if(el.textContent!==value)el.textContent=value;}
}
