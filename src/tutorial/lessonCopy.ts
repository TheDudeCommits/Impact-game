import type { PadFamily } from '../input/gamepad';
import { padKey } from '../input/glyphs';
import { ACTIONS, boundTo } from '../input/bindings';
import { keyLabel, prompt, promptKey, touchKey, touchLabel, type PromptAction, type PromptDevice, type PromptOptions } from '../ui/prompts';
import type { StepId, StepProgress } from './guidedFight';

/**
 * LEARN TO FIGHT's words (guidedFight.ts): each step's one line in the prompt grammar (ui/prompts.ts: the key first,
 * then the verb), drawn for the device in hand - the player's own key bindings, the pad's own glyphs, the touch
 * controls' own labels - and the small line under it that says how far along the step is.
 */
export interface Device { device: PromptDevice; family: PadFamily }
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** A prompt with several keys before its verb (MOVE's four, the technique's stick and button). */
const keys = (parts: readonly string[], verb: string, detail?: string) =>
  `<span class="ux-prompt">${parts.join('<i>+</i>')}<b>${escape(verb)}</b>${detail ? `<small>${escape(detail)}</small>` : ''}</span>`;
/** A prompt whose verb a touch button already says (GUARD on GUARD): the button alone, HOLD kept. */
const act = (action: PromptAction, verb: string, o: PromptOptions) => o.device === 'touch' && touchLabel(action) === verb ? prompt(action, '', o).replace('<b></b>', '') : prompt(action, verb, o);
const keyless = (verb: string, detail?: string) => `<span class="ux-prompt" data-keyless><b>${escape(verb)}</b>${detail ? `<small>${escape(detail)}</small>` : ''}</span>`;

/** SKIP STEP's key: N on a keyboard (unless a fight action has it), the D-pad's right on a pad; tapped on a touch screen. */
export const SKIP_KEY = 'KeyN', SKIP_BUTTON = 15;
export const skipKeyFree = () => !ACTIONS.some(action => boundTo(action, SKIP_KEY));
export function skipKey(d: Device): string {
  if (d.device === 'controller') return padKey(d.family, 'right');
  if (d.device === 'keyboard' && skipKeyFree()) return '<kbd>N</kbd>';
  return '';
}

/** The step's line: its keys and verb, nothing more (what to do with them is the note under it, which reads in any
 *  HUD look). `technique` is the fighter's own name for the step's technique; `locked` whether the mouse has the view
 *  (a keyboard player clicks the arena first). */
export function stepLine(step: StepId, d: Device, technique: string, locked = true): string {
  const o = { device: d.device, family: d.family };
  switch (step) {
    case 'move': {
      if (d.device === 'controller') return keys([padKey(d.family, 'lstick')], 'MOVE') + keys([padKey(d.family, 'rstick')], 'LOOK');
      if (d.device === 'touch') return keys([touchKey('forward')], 'MOVE') + keyless('DRAG THE RIGHT SIDE TO LOOK');
      const wasd = (['forward', 'left', 'backward', 'right'] as const).map(a => `<kbd>${escape(keyLabel(a))}</kbd>`).join('');
      return `<span class="ux-prompt">${wasd}<b>MOVE</b></span>` + (locked ? keys(['<kbd>Mouse</kbd>'], 'LOOK') : keys(['<kbd>Click</kbd>'], 'THEN MOUSE TO LOOK'));
    }
    case 'light': return prompt('light', d.device === 'touch' ? '× 3' : 'LIGHT × 3', o);
    case 'heavy': return act('heavy', 'HEAVY', o);
    case 'guard': return act('guard', 'GUARD', { ...o, hold: true });
    case 'parry': return prompt('guard', 'PERFECT PARRY', o);
    case 'dash': return act('dash', 'DASH', o);
    case 'special': return act('special', 'SPECIAL', o);
    case 'technique': {
      // Away from the opponent: the stick pulled back (the view is behind the player, facing them).
      const away = d.device === 'keyboard' ? promptKey('backward', o) : d.device === 'controller' ? padKey(d.family, 'lstick') : touchKey('backward');
      return keys([away, promptKey('light', o)].filter(Boolean), technique.toUpperCase());
    }
    case 'ultimate': return prompt('ultimate', 'ULTIMATE', o);
    case 'fight': return keyless('KNOCK THEM DOWN');
  }
}

/** What the step asks, in a few words, for the note under its line. */
export function stepAsk(step: StepId, d: Device): string {
  switch (step) {
    case 'move': return '';
    case 'light': return 'LAND A STRING';
    case 'heavy': return 'LAND ONE';
    case 'guard': return 'BLOCK THE JAB';
    case 'parry': return 'TAP JUST BEFORE THE HIT';
    case 'dash': return 'ANY WAY';
    case 'special': return '';
    case 'technique': return `${d.device === 'keyboard' ? 'AWAY' : 'STICK AWAY'} + LIGHT · A LAUNCHER`;
    case 'ultimate': return 'YOUR METER IS FULL';
    case 'fight': return 'A REAL FIGHT · THEY FIGHT BACK';
  }
}
/** How the step stands: what is done of it, or why the last try did not count. */
export function stepFeedback(step: StepId, p: StepProgress, d: Device): string {
  switch (step) {
    case 'move': return `${p.moved ? '✓' : '·'} MOVE   ${p.looked ? '✓' : '·'} LOOK${d.device === 'keyboard' && !p.looked ? '   CLICK THE ARENA FIRST' : ''}`;
    case 'light': return p.hits ? `HITS ${Math.min(p.hits, 3)} / 3` : '';
    case 'guard': return p.miss === 'hit' ? 'HOLD IT BEFORE THE BLOW LANDS' : '';
    case 'parry': return p.miss === 'blocked' ? "THAT'S A BLOCK · TAP, DON'T HOLD" : p.miss === 'hit' ? 'A LITTLE EARLIER' : 'WATCH THE WIND-UP';
    case 'technique': return p.miss === 'plain' ? 'PULL THE STICK AWAY AS YOU PRESS' : '';
    case 'fight': return 'MIX YOUR MOVES';
    default: return '';
  }
}
/** The note under the line: the ask, then how it stands. Empty when there is nothing to say. */
export const stepNote = (step: StepId, p: StepProgress, d: Device) => [stepAsk(step, d), stepFeedback(step, p, d)].filter(Boolean).join('  ·  ');
