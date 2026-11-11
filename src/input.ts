import type { AttackSlot, PlayerInput } from './game/types';
import { GamepadControls, type InputMode, type PadFamily, type UiAction } from './input/gamepad';
import { Rumble, type Actuator, type Pulse } from './input/rumble';
import { TouchHaptics } from './input/haptics';
import { ACTIONS, BINDINGS_EVENT, boundTo, getBindings, heldBinding, isCapturingBinding, pauseKey, type BindingAction } from './input/bindings';
/** How the menu key came: see InputController.onMenu. */
export type MenuVia='menu'|'back'|'pause';
import { touchFirst } from './input/device';
import { AreaAim, type AimPoint } from './input/areaAim';
export type { InputMode, PadFamily, UiAction } from './input/gamepad';
/** A thumb's drag turns the view by the mouse's own constants, this much more per CSS pixel: a phone's right half is
 *  about 430 px, so one stroke across it turns about 85 degrees (Input.touchLook). */
export const TOUCH_LOOK = 1.6;
/** An on-screen button (input/touch.ts) that does what a key does. AREA aims instead: Input.touchAim. */
export type TouchAction = 'light' | 'heavy' | 'special' | 'ultimate' | 'jump' | 'dash' | 'awaken' | 'target';
export const AIM_MOUSE = .035, AIM_STICK = 17;

export class Input {
  keys = new Set<string>();
  yaw = Math.PI;
  pitch = 0.02;
  sensitivity = 1;
  enabled = false;
  /** Arcade Survival: the arrow keys turn the view (src/survival/riftCamera.ts) instead of moving. */
  arrowsLook = false;
  /** A phone or a tablet starts on its own screen (input/device.ts). */
  mode: InputMode = touchFirst() ? 'touch' : 'keyboard';
  controllerLabel = '';
  /** Whose button names the prompts use: the last pad that was touched. */
  family: PadFamily = 'generic';
  readonly rumble = new Rumble();
  /** The phone's own buzz while the touch controls are the controller (input/haptics.ts: Android). */
  readonly haptics = new TouchHaptics();
  /** The area slot's aim (input/areaAim.ts): begun and cast by the AREA control on every device. */
  readonly aim = new AreaAim();
  /** Where the area attack waiting to be sent is cast (PlayerInput.aim). */
  private aimPoint?: AimPoint;
  private actuator?: Actuator;
  private seq=0;
  private attack?:AttackSlot;
  private jump=false;
  private dash=false;
  private awaken=false;
  private pad = new GamepadControls();
  private padForward=0;
  private padRight=0;
  private padGuard=false;
  private padJumpHeld=false;
  /** The heavy held down on the pad (the keyboard's is read off its keys, and the touch set's SHOOT joins them: touchKey):
   *  the ball rooms' SHOOT is charged by holding it (PlayerInput.heavyHeld). */
  private padHeavyHeld=false;
  /** Goal Rush's SPORT mode: the pad's light and dash buttons down (sportHeld). */
  private padLightHeld=false;private padDashHeld=false;
  /** The on-screen stick, read where the pad's left stick is, and the held buttons (TouchControls.update). */
  private touchForward=0;
  private touchRight=0;
  private touchGuard=false;
  private touchJumpHeld=false;
  /** When a finger last touched the page: the mouse events a browser makes up after a tap are not a mouse. */
  private touchedAt=-Infinity;
  /** What pressed last ('mouse', 'touch', 'pen'): a tap's pointerdown comes before the mousedown made up from it. */
  private pointerType='mouse';
  private selectedPad:number|null=null;
  /** The pad this input reads (couch play: its menu button is already this input's, couch/couch.ts). */
  get padIndex(){return this.selectedPad;}
  private wasEnabled=false;
  private focused=true;
  /** The menu key: 'menu' - a pad's OPTIONS / MENU button or the on-screen pause - goes back out of whatever is open, else
   *  pauses; 'back' (Esc) only goes back, the pause menu included, and never opens it; 'pause' (P) opens or closes it. */
  onMenu=(_source:'keyboard'|'controller',_via:MenuVia='menu')=>{};
  onTarget=()=>{};
  onInteract=(_explicit=false)=>false;
  /** Goal Rush's SPORT mode (`?football`): V (unless bound) or the pad's left stick click switches BALL LOCK and FREE
   *  LOOK; whether the page took it. */
  onView=()=>false;
  onModeChange=(_mode:InputMode)=>{};
  onUiAction=(_action:UiAction)=>{};
  constructor(readonly canvas:HTMLCanvasElement) {
    window.addEventListener(BINDINGS_EVENT,()=>this.clear());
    window.addEventListener('keydown',e=>{
      if(isCapturingBinding())return;
      // Esc goes back (it closes the pause menu, never opens it); P pauses - a field typed into keeps its P.
      if (e.code==='Escape') { if(!e.repeat){this.useMode('keyboard');this.onMenu('keyboard',pauseKey()==='Escape'?'menu':'back');}return; }
      if ((e.target as HTMLElement | null)?.matches?.('input,select,textarea')) return;
      if (e.code==='KeyP'&&pauseKey()==='KeyP') { e.preventDefault(); if(!e.repeat){this.useMode('keyboard');this.onMenu('keyboard','pause');}return; }
      // A real key (a tablet's keyboard) puts the on-screen controls away; one typed into a field does not.
      if (e.isTrusted&&this.mode==='touch') this.useMode('keyboard');
      if (!this.enabled) return;
      if(e.code==='KeyB'&&!e.repeat&&!ACTIONS.some(action=>boundTo(action,e.code))&&this.onInteract(true)){e.preventDefault();this.clear();return;}
      if(e.code==='KeyV'&&!e.repeat&&!ACTIONS.some(action=>boundTo(action,e.code))&&this.onView()){e.preventDefault();return;}
      if (ACTIONS.some(action=>boundTo(action,e.code))||e.code.startsWith('Arrow')) e.preventDefault();
      this.keys.add(e.code);this.useMode('keyboard');
      if(e.repeat)return;
      this.press(e.code);
    });
    window.addEventListener('keyup',e=>{this.keys.delete(e.code);if(boundTo('area',e.code))this.releaseAim('keyboard');});
    window.addEventListener('mouseup',e=>{this.keys.delete(`Mouse${e.button}`);if(boundTo('area',`Mouse${e.button}`))this.releaseAim('keyboard');});
    for(const type of ['touchstart','touchend'])window.addEventListener(type,()=>{this.touchedAt=performance.now();},{capture:true,passive:true});
    window.addEventListener('pointerdown',e=>{this.pointerType=e.pointerType||'mouse';},{capture:true,passive:true});
    document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas)this.clear();});
    window.addEventListener('blur',()=>{this.focused=false;this.clear();this.rumble.stop(this.actuator);});
    window.addEventListener('focus',()=>{this.focused=true;this.clear();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();this.rumble.stop(this.actuator);}});
    window.addEventListener('gamepaddisconnected',e=>{if(e.gamepad.index===this.selectedPad){this.clear();this.rumble.stop(this.actuator);this.actuator=undefined;this.selectedPad=null;this.controllerLabel='';this.useMode(touchFirst()?'touch':'keyboard');}});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('mousedown',e=>{
      if(!this.enabled||isCapturingBinding()||this.fromTouch())return;
      this.useMode('keyboard');
      // Only a mouse takes the pointer (a phone has none to take: Chrome refused a tap's with "not valid for pointer
      // lock"), and a refusal is never an error.
      if(document.pointerLockElement!==canvas){try{(canvas.requestPointerLock() as unknown as Promise<void>|undefined)?.catch?.(()=>{});}catch{/* the view still turns by keys */}return;}
      this.keys.add(`Mouse${e.button}`);this.press(`Mouse${e.button}`);
    });
    document.addEventListener('mousemove',e=>{
      if(!this.enabled||document.pointerLockElement!==canvas)return;
      if(e.movementX||e.movementY)this.useMode('keyboard');
      // Aiming the area slot, the mouse moves the reticle and the view holds still.
      if(this.aim.active&&this.aim.view.source==='keyboard'){this.aim.nudge(e.movementX*AIM_MOUSE*this.sensitivity,-e.movementY*AIM_MOUSE*this.sensitivity,this.yaw);return;}
      this.yaw-=e.movementX*0.0023*this.sensitivity;
      this.pitch=Math.max(-0.28,Math.min(0.72,this.pitch+e.movementY*0.0018*this.sensitivity));
    });
  }
  private press(code:string){
    if(boundTo('jump',code))this.jump=true;
    if(boundTo('dash',code))this.dash=true;
    for(const slot of ['light','heavy','special','ultimate'] as const)if(boundTo(slot,code))this.attack=slot;
    if(boundTo('awaken',code))this.awaken=true;
    // The area slot: held to aim, let go to cast (releaseAim); the guard puts the aim away.
    if(boundTo('area',code))this.aim.begin('keyboard');
    else if(boundTo('guard',code)&&this.aim.active)this.aim.cancel();
    if(boundTo('target',code))this.onTarget();
  }
  useMode(mode:InputMode){if(this.mode!==mode){this.mode=mode;this.onModeChange(mode);}}
  /** A mouse event made up from a tap (a second after one): it neither takes the pointer nor puts the touch controls away. */
  private fromTouch(){return this.pointerType!=='mouse'||performance.now()-this.touchedAt<1000;}
  /** The AREA control let go on `source`: the attack, at the reticle, if the aim was that device's and valid. */
  private releaseAim(source:'keyboard'|'pad'|'touch'){
    if(!this.aim.active||this.aim.view.source!==source)return;
    const point=this.aim.release();
    if(point&&this.enabled){this.attack='area';this.aimPoint=point;}
  }
  /** The touch screen's AREA button (input/touch.ts): 'start' as the finger goes down on it, 'move' as it drags (`right`
   *  and `forward` a share of the move's range from the fighter, in the view's frame), 'end' to cast, 'cancel' when it
   *  is dragged back onto the button. A tap without a drag casts where the aim starts: the locked target, or ahead. */
  touchAim(phase:'start'|'move'|'end'|'cancel',right=0,forward=0){
    this.touchedAt=performance.now();this.useMode('touch');
    if(!this.enabled||isCapturingBinding()){this.aim.cancel();return;}
    if(phase==='start')this.aim.begin('touch');
    else if(phase==='move'){if(this.aim.view.source==='touch')this.aim.place(right,forward);}
    else if(phase==='end')this.releaseAim('touch');
    else if(this.aim.view.source==='touch')this.aim.cancel();
  }
  clear(){this.aim.cancel();this.aimPoint=undefined;this.keys.clear();this.attack=undefined;this.jump=false;this.dash=false;this.awaken=false;this.padForward=0;this.padRight=0;this.padGuard=false;this.padJumpHeld=false;this.padHeavyHeld=false;this.touchForward=0;this.touchRight=0;this.touchGuard=false;this.touchJumpHeld=false;this.pad.reset();}
  /** The on-screen stick ([forward, right], as the pad's left stick reads after its deadzone) and held buttons, each
   *  frame they are up (input/touch.ts). */
  touchHold(forward:number,right:number,guard:boolean,jumpHeld:boolean){this.touchForward=forward;this.touchRight=right;this.touchGuard=guard;this.touchJumpHeld=jumpHeld;}
  touchPress(action:TouchAction){
    this.touchedAt=performance.now();this.useMode('touch');
    if(!this.enabled||isCapturingBinding())return;
    if(action==='jump'&&this.onInteract()){this.clear();return;}
    if(action==='jump')this.jump=true;else if(action==='dash')this.dash=true;else if(action==='awaken')this.awaken=true;else if(action==='target')this.onTarget();else this.attack=action;
  }
  /** An on-screen button held down and let go, as its key is (input/touch.ts: the ball modes' SHOOT, for a rule that reads
   *  how long it is held): the action's first key joins the held keys while the finger is down, so whatever reads the
   *  key held reads the button held. The press itself is touchPress's. */
  touchKey(action:BindingAction,down:boolean){
    const code=getBindings().keyboard[action][0];if(!code)return;
    if(down&&this.enabled&&!isCapturingBinding())this.keys.add(code);else this.keys.delete(code);
  }
  /** A drag on the free right half, CSS pixels: the mouse's turn (see TOUCH_LOOK). */
  touchLook(dx:number,dy:number){
    if(!this.enabled||!Number.isFinite(dx)||!Number.isFinite(dy))return;
    this.yaw-=dx*0.0023*TOUCH_LOOK*this.sensitivity;
    this.pitch=Math.max(-0.28,Math.min(0.72,this.pitch+dy*0.0018*TOUCH_LOOK*this.sensitivity));
  }
  /** Call every render, including lobby and pause, so camera speed is frame-rate independent. */
  update(dt:number){
    if(isCapturingBinding()){this.clear();return;}
    if(this.wasEnabled!==this.enabled){this.clear();this.wasEnabled=this.enabled;}
    const pads=typeof navigator.getGamepads==='function'?Array.from(navigator.getGamepads()):[];
    const current=pads.find(p=>p?.connected&&p.mapping==='standard'&&p.index===this.selectedPad)??pads.find(p=>p?.connected&&p.mapping==='standard');
    if(!current&&this.selectedPad!==null){this.clear();this.actuator=undefined;this.selectedPad=null;this.controllerLabel='';this.useMode(touchFirst()?'touch':'keyboard');}
    if(current){this.selectedPad=current.index;this.actuator=(current as {vibrationActuator?:Actuator|null}).vibrationActuator??undefined;}
    const frame=this.pad.read(current??undefined,this.enabled&&!document.hidden&&this.focused,performance.now());
    this.controllerLabel=frame.label;
    if(document.hidden||!this.focused)return;
    // A different pad picked up (a DualSense after an Xbox pad) redraws the
    // prompts even though the mode itself has not changed.
    if(frame.label&&frame.family!==this.family){this.family=frame.family;if(this.mode==='controller')this.onModeChange('controller');}
    if(frame.active)this.useMode('controller');
    if(this.mode==='controller')this.rumble.flush(performance.now(),this.actuator);else if(this.mode==='touch')this.haptics.flush(performance.now());
    this.padForward=frame.forward;this.padRight=frame.right;this.padGuard=frame.guard;
    if(frame.menu){this.clear();this.onMenu('controller');return;}
    for(const action of frame.ui)this.onUiAction(action);
    if(!this.enabled)return;
    if((frame.interact||frame.jump)&&this.onInteract(!!frame.interact)){this.clear();return;}
    if(frame.attack)this.attack=frame.attack;
    this.padJumpHeld=frame.jumpHeld;this.padHeavyHeld=!!frame.heavyHeld;this.padLightHeld=!!frame.lightHeld;this.padDashHeld=!!frame.dashHeld;if(frame.view)this.onView();this.jump ||= frame.jump;this.dash ||= frame.dash;this.awaken ||= frame.awaken;
    if(frame.target)this.onTarget();
    // The area slot (gamepad.ts): R2 down aims, up casts; the AWAKEN chord or L1 puts the aim away.
    if(frame.area==='press')this.aim.begin('pad');
    else if(frame.area==='release')this.releaseAim('pad');
    else if(frame.area==='cancel'&&this.aim.view.source==='pad')this.aim.cancel();
    if(frame.guardPressed&&this.aim.active)this.aim.cancel();
    const seconds=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
    // Aiming with the pad, the right stick moves the reticle and the view holds still.
    if(this.aim.active&&this.aim.view.source==='pad'){this.aim.nudge(frame.lookX*AIM_STICK*seconds*this.sensitivity,-frame.lookY*AIM_STICK*seconds*this.sensitivity,this.yaw);return;}
    this.yaw-=frame.lookX*2.7*seconds*this.sensitivity;
    this.pitch=Math.max(-.28,Math.min(.72,this.pitch+frame.lookY*1.75*seconds*this.sensitivity));
  }
  /** Rumbles the pad, when it is the pad being played and it can; on the touch controls, the phone's own buzz. */
  feel(pulse:Pulse){if(this.mode==='controller'&&this.focused&&this.actuator?.playEffect)this.rumble.add(pulse);else if(this.mode==='touch'&&this.focused){this.haptics.scale=this.rumble.scale;this.haptics.add(pulse);}}
  /** Goal Rush's SPORT mode (game/ball/football.ts): whether PASS's and SPRINT's keys are down now - a held PASS is lofted,
   *  SPRINT runs while held. The touch set says neither (its PASS is a tap; its BOOST holds as it always has). */
  sportHeld():{lightHeld?:boolean;dashHeld?:boolean}{
    if(this.mode==='touch')return {};
    return {lightHeld:heldBinding('light',this.keys)||this.padLightHeld,dashHeld:heldBinding('dash',this.keys)||this.padDashHeld};
  }
  command(targetId:string|null,viewYaw=this.yaw):PlayerInput {
    const arrows=!this.arrowsLook;
    const held=(action:BindingAction)=>heldBinding(action,this.keys);
    const forward=Number(held('forward')||arrows&&this.keys.has('ArrowUp'))-Number(held('backward')||arrows&&this.keys.has('ArrowDown'))+this.padForward+this.touchForward;
    const right=Number(held('right')||arrows&&this.keys.has('ArrowRight'))-Number(held('left')||arrows&&this.keys.has('ArrowLeft'))+this.padRight+this.touchRight;
    const magnitude=Math.max(1,Math.hypot(forward,right));
    const moveX=(Math.sin(viewYaw)*forward-Math.cos(viewYaw)*right)/magnitude;
    const moveZ=(Math.cos(viewYaw)*forward+Math.sin(viewYaw)*right)/magnitude;
    // Simulation owns body facing; view and travel are independent of clips.
    const command:PlayerInput={seq:++this.seq,moveX,moveZ,yaw:viewYaw,guard:held('guard')||this.padGuard||this.touchGuard,targetId};
    if(this.attack)command.attack=this.attack;
    if(this.attack==='area'&&this.aimPoint)command.aim={x:+this.aimPoint.x.toFixed(2),z:+this.aimPoint.z.toFixed(2)};
    if(this.jump)command.jump=true;
    if(held('jump')||this.padJumpHeld||this.touchJumpHeld)command.jumpHeld=true;
    if(held('heavy')||this.padHeavyHeld)command.heavyHeld=true;
    if(this.dash)command.dash=true;
    if(this.awaken)command.awaken=true;
    this.attack=undefined;this.aimPoint=undefined;this.jump=false;this.dash=false;this.awaken=false;
    return command;
  }
}
