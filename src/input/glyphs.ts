import type { PadFamily } from './gamepad';
import { getBindings, keyName, MOVE_ACTIONS, pauseKey, type CombatAction } from './bindings';

/** A control on a standard-mapping pad, named by where it sits rather than by
 *  whose letter is printed on it. */
export type PadControl = 'south' | 'east' | 'west' | 'north' | 'l1' | 'r1' | 'l2' | 'r2' | 'l3' | 'r3'
  | 'start' | 'select' | 'lstick' | 'rstick' | 'dpad' | 'up' | 'down' | 'left' | 'right';

const PLAYSTATION: Record<PadControl, string> = {
  south: '✕', east: '○', west: '□', north: '△', l1: 'L1', r1: 'R1', l2: 'L2', r2: 'R2', l3: 'L3', r3: 'R3',
  start: 'OPTIONS', select: 'CREATE', lstick: 'L STICK', rstick: 'R STICK', dpad: 'D-PAD', up:'D ↑',down:'D ↓',left:'D ←',right:'D →',
};
const XBOX: Record<PadControl, string> = {
  south: 'A', east: 'B', west: 'X', north: 'Y', l1: 'LB', r1: 'RB', l2: 'LT', r2: 'RT', l3: 'LS', r3: 'RS',
  start: 'MENU', select: 'VIEW', lstick: 'L STICK', rstick: 'R STICK', dpad: 'D-PAD',up:'D ↑',down:'D ↓',left:'D ←',right:'D →',
};
/** Before a pad has said what it is, or for one that is neither: both names. */
const EITHER: Record<PadControl, string> = {
  south: 'A / ✕', east: 'B / ○', west: 'X / □', north: 'Y / △', l1: 'LB / L1', r1: 'RB / R1', l2: 'LT / L2', r2: 'RT / R2',
  l3: 'LS / L3', r3: 'RS / R3', start: 'MENU / OPTIONS', select: 'VIEW / CREATE', lstick: 'L STICK', rstick: 'R STICK', dpad: 'D-PAD',up:'D ↑',down:'D ↓',left:'D ←',right:'D →',
};
const NAMES: Record<PadFamily, Record<PadControl, string>> = { playstation: PLAYSTATION, xbox: XBOX, generic: EITHER };
const FACE = new Set<PadControl>(['south', 'east', 'west', 'north']);

export const padName = (family: PadFamily, control: PadControl) => NAMES[family][control];
export const BUTTON_CONTROLS:readonly PadControl[]=['south','east','west','north','l1','r1','l2','r2','select','start','l3','r3','up','down','left','right'];
/** The pad control an action is on. AWAKEN has none of its own: it is the ULTIMATE and AREA buttons together
 *  (gamepad.ts AWAKEN_CHORD), and this names the first of the two (chordControls names both). */
export const actionControl=(action:CombatAction)=>BUTTON_CONTROLS[getBindings().controller[action==='awaken'?'ultimate':action]];
/** AWAKEN's two pad controls: the ULTIMATE's and the AREA's (L2 + R2 by default). */
export const chordControls=():readonly [PadControl,PadControl]=>[actionControl('ultimate'),actionControl('area')];
/** An action's prompt on a pad; AWAKEN's is both its buttons, "L2+R2" (one key, "LT+RT / L2+R2", before a pad has said
 *  what it is: each button named both ways read "LT / L2+RT / R2"). */
export const actionKey=(action:CombatAction,family:PadFamily)=>action!=='awaken'?padKey(family,actionControl(action))
  :family==='generic'?`<kbd class="pad-key">${actionName('awaken',family)}</kbd>`:chordControls().map(control=>padKey(family,control)).join('+');
/** An action's pad button as plain text (a card's key, a binding list); AWAKEN's is both its buttons, "L2+R2", and
 *  before a pad has said what it is, both families' ("LT+RT / L2+R2"), as EITHER names one button. */
export const actionName=(action:CombatAction,family:PadFamily)=>{
  if(action!=='awaken')return padName(family,actionControl(action));
  const chord=(names:PadFamily)=>chordControls().map(control=>padName(names,control)).join('+');
  return family==='generic'?`${chord('xbox')} / ${chord('playstation')}`:chord(family);
};
/** `target`: what the target key does here (LOCK ON; a ball match's BALL CAM). */
export function keyboardCombatHints(target='LOCK ON'){
  const map=getBindings().keyboard, key=(action:keyof typeof map)=>`<kbd>${keyName(map[action][0])}</kbd>`;
  // (Goal Rush's SPORT mode, `?football`: the Sport keys - PASS, SHOOT, SPRINT, Tab to FIGHT, V the camera.)
  if(target==='SPORT')return `<span class="control-item">${['forward','left','backward','right'].map(a=>key(a as keyof typeof map)).join('')} MOVE</span>`+([['jump','JUMP'],['light','PASS'],['heavy','SHOOT'],['dash','SPRINT'],['target','FIGHT']] as const).map(([a,l])=>`<span class="control-item">${key(a)} ${l}</span>`).join('')+`<span class="control-item"><kbd>V</kbd> CAMERA</span><span class="control-item"><kbd>${pauseKey()==='KeyP'?'P':'ESC'}</kbd> PAUSE</span>`;
  return `<span class="control-item">${['forward','left','backward','right'].map(a=>key(a as keyof typeof map)).join('')} MOVE</span>`+(['jump','dash','guard','target'] as const).map(a=>`<span class="control-item">${key(a)} ${a==='target'?target:a.toUpperCase()}</span>`).join('')+`<span class="control-item"><kbd>${pauseKey()==='KeyP'?'P':'ESC'}</kbd> PAUSE</span>`;
}

/** A prompt as markup. PlayStation face buttons are drawn as their symbols in
 *  their own colours, which is how a PlayStation player reads them. */
export function padKey(family: PadFamily, control: PadControl) {
  const face = family === 'playstation' && FACE.has(control);
  return `<kbd class="pad-key${face ? ` ps-face ps-${control}` : ''}">${padName(family, control)}</kbd>`;
}

/** The combat strip under the arena, for a pad. */
export function padCombatHints(family: PadFamily, target = 'LOCK ON') {
  const item = (control: PadControl, label: string) => `<span class="control-item">${padKey(family, control)} ${label}</span>`;
  // The right stick turning the camera goes without saying; the strip only
  // has room for six.
  if (target === 'SPORT') return [item('lstick', 'MOVE'), item(actionControl('light'), 'PASS'), item(actionControl('heavy'), 'SHOOT'), item(actionControl('dash'), 'SPRINT'),
    item(actionControl('target'), 'FIGHT'), item('start', 'PAUSE')].join('');
  return [item('lstick', 'MOVE'), item(actionControl('jump'), 'JUMP'), item(actionControl('dash'), 'DASH'), item(actionControl('guard'), 'GUARD'),
    item(actionControl('target'), target), item('start', 'PAUSE')].join('');
}

export const MOVE_CONTROLS: readonly PadControl[] = ['west', 'north', 'r1', 'l2', 'r2'];
