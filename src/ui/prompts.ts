import { getBindings, keyName, pauseKey, type BindingAction, type CombatAction } from '../input/bindings';
import { actionControl, actionKey, padKey, type PadControl } from '../input/glyphs';
import type { PadFamily } from '../input/gamepad';
import './prompts.css';

export type PromptDevice = 'keyboard' | 'controller' | 'touch';
/** Everything a prompt can name: each binding, plus the interface's own presses. */
export type PromptAction = BindingAction | 'interact' | 'menu' | 'tree' | 'confirm' | 'back' | 'quick1' | 'quick2' | 'quick3' | 'quick4' | 'click';
export const PROMPT_ACTIONS: readonly PromptAction[] = ['forward', 'left', 'backward', 'right', 'jump', 'dash', 'guard', 'target', 'light', 'heavy', 'special', 'ultimate', 'area', 'awaken', 'interact', 'menu', 'tree', 'confirm', 'back', 'quick1', 'quick2', 'quick3', 'quick4', 'click'];
export interface PromptOptions {
  /** The device to draw for; by default the one in use now (#interface[data-input]). */
  device?: PromptDevice;
  /** The pad's family; by default the one in use now (#interface[data-pad]). */
  family?: PadFamily;
  /** HOLD [key] VERB. */
  hold?: boolean;
  /** A short detail after the verb: `· 2 POINTS`, `◈ 425`. */
  detail?: string;
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const COMBAT = new Set<string>(['jump', 'dash', 'guard', 'target', 'light', 'heavy', 'special', 'ultimate', 'area', 'awaken']);
/** The interface's own keys. 'interact' is B unless a binding has taken it (input.ts onInteract), then the pad's jump. */
const UI_KEYS: Record<Exclude<PromptAction, BindingAction>, string> = {
  interact: 'KeyB', menu: 'KeyP', tree: 'KeyT', confirm: 'Enter', back: 'Escape',
  quick1: 'Digit1', quick2: 'Digit2', quick3: 'Digit3', quick4: 'Digit4', click: 'Click',
};
/** On a pad: the D-pad is the wheel of four (up, right, down, left: shop/boot.ts emotes); in Arcade Survival its up
 *  opens the skill tree (SurvivalHud.upPad: button 12), so `tree` is D-pad up. */
const UI_PAD: Record<Exclude<PromptAction, BindingAction>, PadControl | 'jump' | undefined> = {
  interact: 'jump', menu: 'start', tree: 'up', confirm: 'south', back: 'east',
  quick1: 'up', quick2: 'right', quick3: 'down', quick4: 'left', click: undefined,
};
const UI_NAMES: Record<string, string> = { Escape: 'Esc', KeyP: 'P', Enter: 'Enter', Click: 'Click', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', KeyB: 'B', KeyT: 'T' };
/** On a touch screen: the on-screen button's own label (input/touch.ts), the stick for moving. What has none (a tool,
 *  a card, a confirm) is tapped where it is drawn, so its prompt is the verb alone. 'interact' is JUMP, as the pad's. */
const TOUCH_NAMES: Partial<Record<PromptAction, string>> = {
  forward: 'STICK', left: 'STICK', backward: 'STICK', right: 'STICK', jump: 'JUMP', dash: 'DASH', guard: 'GUARD', target: 'LOCK',
  light: 'LIGHT', heavy: 'HEAVY', special: 'SPECIAL', ultimate: 'ULT', area: 'AREA', awaken: 'AWAKEN', interact: 'JUMP', menu: '❚❚', back: '×',
};

/** The device and pad family in use now, as the HUD last saw them (Hud.setInputMode sets both on #interface). */
export function currentDevice(): { device: PromptDevice; family: PadFamily } {
  const root = typeof document === 'object' ? document.querySelector<HTMLElement>('#interface') : null;
  const device = root?.dataset.input === 'controller' ? 'controller' : root?.dataset.input === 'touch' ? 'touch' : 'keyboard';
  const family = (['playstation', 'xbox', 'generic'] as const).find(f => f === root?.dataset.pad) ?? 'generic';
  return { device, family };
}

/** The pad control an action is on, or undefined when it has none (the mouse's click). AWAKEN's is the first of its
 *  two (glyphs.ts chordControls): its prompt (promptKey) draws both. */
export function padControlFor(action: PromptAction): PadControl | undefined {
  if (COMBAT.has(action)) return actionControl(action as CombatAction);
  if (action === 'forward' || action === 'left' || action === 'backward' || action === 'right') return 'lstick';
  const pad = UI_PAD[action as Exclude<PromptAction, BindingAction>];
  return pad === 'jump' ? actionControl('jump') : pad;
}
/** The keyboard key's name for an action (its first binding), as printed on a keycap. */
export function keyLabel(action: PromptAction): string {
  if (action in UI_KEYS) { const code = action === 'menu' ? pauseKey() : UI_KEYS[action as keyof typeof UI_KEYS]; return UI_NAMES[code] ?? keyName(code); }
  return keyName(getBindings().keyboard[action as BindingAction][0] ?? '?');
}

/** The key (or pad button) for an action, as a <kbd>. Empty when the device has no such control. */
export function promptKey(action: PromptAction, options: PromptOptions = {}): string {
  const seen = options.device && options.family ? undefined : currentDevice();
  const device = options.device ?? seen!.device, family = options.family ?? seen?.family ?? 'generic';
  if (device === 'controller') { if (action === 'awaken') return actionKey('awaken', family); const control = padControlFor(action); return control ? padKey(family, control) : ''; }
  if (device === 'touch') return touchKey(action);
  return `<kbd>${escape(keyLabel(action))}</kbd>`;
}
/** The on-screen button's own label for an action (input/touch.ts), or undefined where the thing is tapped. */
export const touchLabel = (action: PromptAction): string | undefined => TOUCH_NAMES[action];
/** The on-screen button for an action, as a <kbd> (an ink circle with its label), or empty where the thing is tapped. */
export function touchKey(action: PromptAction): string {
  const name = TOUCH_NAMES[action];
  return name ? `<kbd class="touch-key">${escape(name)}</kbd>` : '';
}

/** `[key] VERB` as markup, the one prompt shape: <span class="ux-prompt"><kbd>B</kbd><b>QUARTERMASTER</b><small>◈ 425</small></span>.
 *  Without a key on this device (a click on a pad) it is the verb alone. */
export function prompt(action: PromptAction, verb: string, options: PromptOptions = {}): string {
  const key = promptKey(action, options);
  return `<span class="ux-prompt"${key ? '' : ' data-keyless'}>${options.hold ? '<i>HOLD</i>' : ''}${key}<b>${escape(verb)}</b>${options.detail ? `<small>${escape(options.detail)}</small>` : ''}</span>`;
}

/** Copy with `{action}` placeholders (the mode catalogue's lines), with each drawn as its key. Unknown names stay as written. */
export function promptText(text: string, options: PromptOptions = {}): string {
  // On a touch screen a tapped thing has no key: its placeholder goes, not printed as written.
  const touch = (options.device ?? currentDevice().device) === 'touch';
  return escape(text).replace(/\{([a-z0-9]+)\}/g, (whole, name: string) => (PROMPT_ACTIONS as readonly string[]).includes(name) ? promptKey(name as PromptAction, options) || (touch ? '' : whole) : whole);
}
