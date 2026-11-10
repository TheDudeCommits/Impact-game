import type { BallModeId } from '../../game/ball/model';
import { promptKey, type PromptAction, type PromptOptions } from '../prompts';
import './defence.css';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** One sport basic: the key it is pressed on (none: a key of its own in the name), its name, how it is done, its line. */
export interface SportBasic { action: PromptAction; name: string; how: string; line: string }
/**
 * The SPORTS BASICS, in place of the fight's DEFENCE BASICS (block, perfect parry, guard
 * break) on a ball mode's HOW TO PLAY - the mode sheet's (ModeSheet.ts) and the in-game menu's (GameMenu.ts). The skills
 * LEARN TO PLAY teaches (game/ball/lesson.ts), each with its key on the device in hand (prompts.ts; on a touch screen the
 * sports set's own buttons: PASS, SHOOT, BOOST, FIGHT; SET, SPIKE, BLOCK, DIVE).
 */
export const SPORTS_BASICS: Readonly<Record<BallModeId, readonly SportBasic[]>> = {
  'goal-rush': [
    { action: 'light', name: 'Pass', how: 'To a team-mate', line: 'Face someone on your side and tap it: the pass finds their run.' },
    { action: 'heavy', name: 'Shoot', how: 'Tap, or hold to charge', line: 'A tap shoots at once, where you look. Hold it to wind up your own move: a charged shot, harder and hotter.' },
    { action: 'heavy', name: 'Perfect Strike', how: 'As it arrives', line: 'Meet a pass, a cross or a rebound just as it gets to you: faster and hotter, and worth the most.' },
    { action: 'jump', name: 'Header', how: 'Into a cross', line: 'Jump into a high ball and it is headed on, the way you face. At the top of the jump: a perfect one.' },
    { action: 'dash', name: 'Boost', how: 'On the run', line: 'Burns the gold bar. Run a boost into a rival and they go flat.' },
    { action: 'target', name: 'Fight & Tackle', how: 'Lock on, knock down', line: 'Fight the one on the ball: knock them down and the ball is yours. Press it again to play the ball.' },
  ],
  'sky-spike': [
    { action: 'light', name: 'Bump & Set', how: 'Under it', line: 'Three touches a side: bump it up, set it high at the net, and the third goes over.' },
    { action: 'heavy', name: 'Perfect Spike', how: 'At the top', line: 'From a step behind the set, jump as it peaks and swing at the top of your jump: faster and hotter.' },
    { action: 'guard', name: 'Block', how: 'In the air at the net', line: 'Jump as their hitter does and get your hands up at their glint: on time, a STUFF BLOCK.' },
    { action: 'dash', name: 'Dive', how: 'At a hard ball', line: 'Throw yourself at a spike coming in past you and dig it up for your side.' },
    { action: 'heavy', name: 'Jump Serve', how: 'Jump, then serve', line: 'Jump beside the ball and it goes up with you: serve it at the top, hard and deep.' },
  ],
};

/** The list's rows (a `ul.ux-defence`, as DEFENCE BASICS draws: defence.css). */
export function sportsBasics(mode: BallModeId, options: PromptOptions = {}): string {
  return SPORTS_BASICS[mode].map(s => `<li><span class="ux-defence-key">${promptKey(s.action, { ...options, sport: options.sport === undefined ? { mode } : options.sport })}</span><span class="ux-defence-name"><b>${escape(s.name.toUpperCase())}</b><small>${escape(s.how.toUpperCase())}</small></span><span class="ux-defence-line">${escape(s.line)}</span></li>`).join('');
}
