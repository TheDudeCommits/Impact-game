import type { PadFamily } from '../../input/gamepad';
import { padKey } from '../../input/glyphs';
import { ACTIONS, boundTo } from '../../input/bindings';
import { keyLabel, prompt as drawPrompt, promptKey, touchKey, type PromptAction, type PromptDevice, type PromptOptions, type PromptSport } from '../prompts';
import { sportTouchName } from '../../input/sportTouch';
import type { BallModeId } from '../../game/ball/model';
import type { LessonMiss, LessonStepId, LessonView } from '../../game/ball/lesson';

/**
 * LEARN TO PLAY's words (game/ball/lesson.ts has the rules): each step's line in the prompt grammar (ui/prompts.ts: the
 * key first, then the verb), drawn for the device in hand - the player's own bindings, the pad's glyphs, and on a touch
 * screen the sports set's own buttons (input/sportTouch.ts: PASS, SHOOT, BOOST, FIGHT; SET, SPIKE, BLOCK, DIVE) - and
 * the small line under it: what the step asks, then why the last try missed. As LEARN TO FIGHT's (tutorial/lessonCopy.ts).
 *
 * And the device's memory of it: whether each mode's lesson was finished, or offered and turned down (`rift-ball-learn`).
 */
export interface LearnDevice { device: PromptDevice; family: PadFamily; sport: PromptSport }
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const keyless = (verb: string) => `<span class="ux-prompt" data-keyless><b>${escape(verb)}</b></span>`;
/** Several keys, then the verb (MOVE's four, a jump and a swing). */
const keys = (parts: readonly string[], verb: string) => `<span class="ux-prompt">${parts.filter(Boolean).join('<i>+</i>')}<b>${escape(verb)}</b></span>`;
const opts = (d: LearnDevice, more: PromptOptions = {}): PromptOptions => ({ device: d.device, family: d.family, sport: d.sport, ...more });
const key = (d: LearnDevice, action: PromptAction) => promptKey(action, opts(d));
/** `[key] VERB`, but on a touch screen a button that already says the verb's first word (PASS on PASS, FIGHT on FIGHT)
 *  is not said twice: the button, then what is left of the verb. (LEARN TO FIGHT's `act`, tutorial/lessonCopy.ts.) */
function prompt(action: PromptAction, verb: string, o: PromptOptions): string {
  const label = o.device === 'touch' && o.sport ? sportTouchName(o.sport.mode, !!o.sport.fight, action) : undefined;
  if (!label || (verb !== label && !verb.startsWith(`${label} `))) return drawPrompt(action, verb, o);
  return drawPrompt(action, verb.slice(label.length).trim(), o).replace('<b></b>', '');
}

/** SKIP STEP's key: N on a keyboard (unless a fight action has it), the D-pad's right on a pad; tapped on a touch screen.
 *  (LEARN TO FIGHT's own: tutorial/lessonCopy.ts.) */
export const SKIP_KEY = 'KeyN', SKIP_BUTTON = 15;
export const skipKeyFree = () => !ACTIONS.some(action => boundTo(action, SKIP_KEY));
export function skipKey(d: Pick<LearnDevice, 'device' | 'family'>): string {
  if (d.device === 'controller') return padKey(d.family, 'right');
  if (d.device === 'keyboard' && skipKeyFree()) return '<kbd>N</kbd>';
  return '';
}

/** The stick, or the four keys. */
function move(d: LearnDevice) {
  if (d.device === 'controller') return padKey(d.family, 'lstick');
  if (d.device === 'touch') return touchKey('forward', d.sport);
  return (['forward', 'left', 'backward', 'right'] as const).map(a => `<kbd>${escape(keyLabel(a))}</kbd>`).join('');
}

/** The step's line: its keys and verb. `fight`: Goal Rush's FIGHT stance is on (its buttons are fight moves). */
export function learnLine(v: LessonView, d: LearnDevice): string {
  const fight = !!d.sport.fight, o = opts(d);
  switch (v.step) {
    case 'gr-run': return keys([move(d)], 'RUN') + prompt('dash', 'BOOST', opts(d, { hold: d.device === 'touch' }));
    case 'gr-pass': return fight ? prompt('target', 'BALL', o) : prompt('light', 'PASS', o);
    case 'gr-shoot': return fight ? prompt('target', 'BALL', o) : prompt('heavy', v.pops ? 'SHOOT AS IT ARRIVES' : 'SHOOT', o);
    case 'gr-perfect': return fight ? prompt('target', 'BALL', o) : prompt('heavy', v.firstTime ? 'FIRST TIME' : 'AS IT ARRIVES', o);
    case 'gr-header': return fight ? prompt('target', 'BALL', o) : prompt('jump', 'INTO THE CROSS', o);
    case 'gr-tackle': return fight ? keys([key(d, 'light'), key(d, 'heavy')], 'KNOCK THEM DOWN') : prompt('target', 'FIGHT', o);
    case 'gr-score': return fight ? prompt('target', 'BALL', o) : v.pops ? prompt('light', 'PASS TO THEIR RUN', o) : prompt('heavy', 'SCORE', o);
    // (On a touch screen the light's button is named for the touch it will be - BUMP now, SET next - and the heavy's is
    // SERVE on your serve: sportTouch.ts spikeLight, sportSet. Prompts call them SET and SPIKE whatever the touch.)
    case 'ss-bump': return d.device === 'touch' ? '<span class="ux-prompt"><kbd class="touch-key">BUMP</kbd></span>' : prompt('light', 'BUMP', o);
    case 'ss-set': return prompt('light', 'SET', o);
    case 'ss-spike': return `<span class="ux-prompt">${key(d, 'jump')}<b>AS IT PEAKS</b>${key(d, 'heavy')}<b>AT THE TOP</b></span>`;
    case 'ss-block': return keys([key(d, 'jump'), key(d, 'guard')], d.device === 'touch' ? 'AT THE GLINT' : 'BLOCK');
    case 'ss-dive': return prompt('dash', 'DIVE', o);
    case 'ss-serve': return `<span class="ux-prompt">${key(d, 'jump')}<b>THEN</b>${d.device === 'touch' ? '<kbd class="touch-key">SERVE</kbd>' : `${key(d, 'heavy')}<b>SERVE</b>`}</span>`;
    default: return keyless('');
  }
}
/** What the step asks, in a few words (the note's first half). */
export function learnAsk(v: LessonView, d: LearnDevice): string {
  const fight = !!d.sport.fight;
  if (fight && v.step && v.step.startsWith('gr-') && v.step !== 'gr-tackle') return 'BACK TO THE BALL STANCE · YOUR SWINGS PLAY THE BALL';
  switch (v.step) {
    case 'gr-run': return d.device === 'touch' ? 'HOLD BOOST AND PUSH THE STICK' : 'BOOST ON THE RUN · THE GOLD BAR';
    case 'gr-pass': return 'FACE YOUR TEAM-MATE · THE PASS FINDS THEM';
    case 'gr-shoot': return v.pops ? 'YOUR SHOOT POPS A STILL BALL UP · MEET THE PASS AS THE BAR FILLS' : d.device === 'touch' ? 'THE GOAL IS BEHIND THE BALL · DRAG TO AIM' : 'THE GOAL IS BEHIND THE BALL · AIM WITH THE VIEW';
    case 'gr-perfect': return v.firstTime ? 'MEET THE PASS AS IT COMES' : 'PERFECT STRIKE · PRESS AS THE BAR FILLS';
    case 'gr-header': return 'HEADER · JUMP AS THE BAR FILLS';
    case 'gr-tackle': return fight ? 'A TACKLE WINS THE BALL' : 'LOCK ON THE ONE WITH THE BALL';
    case 'gr-score': return v.pops ? 'PASS TO YOUR TEAM-MATE\'S RUN · THEY FINISH IT' : 'ANY WAY YOU LIKE · YOUR TEAM-MATE IS MAKING A RUN';
    case 'ss-bump': return 'GET UNDER THE SERVE · THE RING SHOWS WHERE';
    case 'ss-set': return 'FLOAT IT UP AT THE NET';
    case 'ss-spike': return 'FROM A STEP BACK · SWING AT THE GLINT ON YOUR HANDS';
    case 'ss-block': return 'IN THE AIR AT THE NET · AS THEIR GLINT FLARES';
    case 'ss-dive': return 'AT THE HARD BALL · THE ARROW AT YOUR FEET';
    case 'ss-serve': return 'JUMP SERVE · THE BALL GOES UP WITH YOU';
    default: return '';
  }
}
const MISSES: Record<LessonMiss, string> = {
  boost: 'YOU GOT THERE · NOW WITH BOOST', pass: 'FACE THEM FIRST · THE VIEW AIMS IT', wide: 'WIDE · AIM AT THE GOAL',
  early: 'EARLY · WAIT FOR THE BAR', late: 'LATE · PRESS AS THE BAR FILLS', plain: 'NOW TIME IT', jump: 'JUMP INTO IT',
  lock: 'FIGHT FIRST · THEN HIT THEM', tackle: 'THEY GOT THEIR SHOT AWAY · CATCH THEM SOONER', press: "PRESS IT · DON'T LET IT HIT YOU",
  under: 'GET UNDER IT', top: 'SWING AT THE TOP OF YOUR JUMP', block: 'JUMP AT THEIR GLINT · HANDS UP', dive: 'DIVE AT IT AS IT COMES',
  float: 'JUMP FIRST · THEN SERVE IN THE AIR', time: 'AGAIN',
};
/** Why the last try missed, for this step (some misses read differently by step). */
export function learnMiss(v: LessonView): string {
  if (!v.miss) return '';
  if (v.miss === 'plain' && v.step === 'gr-perfect') return 'A GOAL · NOW MAKE IT PERFECT';
  if (v.miss === 'plain' && v.step === 'ss-set') return 'A SOFT TOUCH SETS IT';
  if (v.miss === 'jump' && v.step === 'ss-spike') return 'JUMP FIRST · SWING IN THE AIR';
  if (v.miss === 'jump' && v.step === 'gr-header') return 'JUMP AS IT COMES · MEET IT WITH YOUR HEAD';
  if (v.miss === 'under' && v.step === 'ss-spike') return 'A STEP BACK FROM WHERE IT COMES DOWN';
  return MISSES[v.miss];
}
/** The note under the line: the ask, then how it stands (RUN & BOOST's halves; the last miss). */
export function learnNote(v: LessonView, d: LearnDevice): string {
  const parts = v.step === 'gr-run' ? `${v.parts[0] ? '✓' : '○'} BOOST   ${v.parts[1] ? '✓' : '○'} REACH THE BALL` : '';
  return [learnAsk(v, d), parts, learnMiss(v)].filter(Boolean).join('  ·  ');
}

// ─── The device's memory ────────────────────────────────────────────────────────────────────────────────────────────
/** localStorage: each ball mode's lesson 'done' once finished, 'skipped' once offered and turned down or left early.
 *  Neither, and a first match of the mode offers it (ModeSheet). 'done' is kept. */
export const LEARN_KEY = 'rift-ball-learn';
export type LearnState = 'new' | 'done' | 'skipped';
export function learnState(mode: BallModeId): LearnState {
  try { const v = (JSON.parse(globalThis.localStorage?.getItem(LEARN_KEY) ?? '{}') as Record<string, unknown>)[mode]; return v === 'done' || v === 'skipped' ? v : 'new'; } catch { return 'new'; }
}
export function markLearn(mode: BallModeId, state: 'done' | 'skipped') {
  if (state === 'skipped' && learnState(mode) === 'done') return;
  try {
    const all = JSON.parse(globalThis.localStorage?.getItem(LEARN_KEY) ?? '{}') as Record<string, string>;
    all[mode] = state; globalThis.localStorage?.setItem(LEARN_KEY, JSON.stringify(all));
  } catch { /* the visit keeps it */ }
}
/** The lesson's titles, for HOW TO PLAY's button. */
export const LEARN_PITCH: Readonly<Record<BallModeId, string>> = {
  'goal-rush': 'A GUIDED FIRST GAME: PASS, SHOOT, A PERFECT STRIKE, A HEADER, A TACKLE',
  'sky-spike': 'A GUIDED FIRST GAME: BUMP, SET, A PERFECT SPIKE, A BLOCK, A JUMP SERVE',
};
export type { LessonStepId };
