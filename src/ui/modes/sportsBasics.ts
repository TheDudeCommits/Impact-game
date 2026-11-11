import type { BallModeId } from '../../game/ball/model';
import { promptKey, type PromptAction, type PromptOptions } from '../prompts';
import { sportPage } from '../../game/ball/sportRules';
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
    { action: 'light', name: 'Pass', how: 'The stick at a team-mate', line: 'Hold the stick at someone on your side and tap it: the pass is led into their run. With the stick let go it finds the one you face.' },
    { action: 'heavy', name: 'Shoot', how: 'Tap, or hold to charge', line: 'A tap shoots at once, where you look. Hold it to wind up your own move: a charged shot, harder and hotter.' },
    { action: 'heavy', name: 'Perfect Strike', how: 'As it arrives', line: 'Meet a pass, a cross or a rebound just as it gets to you: faster and hotter, and worth the most.' },
    { action: 'jump', name: 'Header', how: 'Into a cross', line: 'Jump into a high ball and it is headed on, the way you face. At the top of the jump: a perfect one.' },
    { action: 'dash', name: 'Boost', how: 'On the run', line: 'Burns the gold bar. Run a boost into a rival and they go flat.' },
    { action: 'guard', name: 'Trap & Carry', how: 'Guard as it arrives', line: 'Guard just as a pass or a loose ball gets to you and it dies at your feet. Run into a slow ball and you carry it, a little slower: a tackle, or a rival in its way, takes it off you.' },
    { action: 'target', name: 'Fight & Tackle', how: 'Lock on, knock down', line: 'Fight the one on the ball: knock them down and it pops loose toward you. Press it again to play the ball.' },
  ],
  'sky-spike': [
    { action: 'light', name: 'Bump & Set', how: 'Under it', line: 'Three touches a side: bump it up, set it high at the net, and the third goes over.' },
    { action: 'heavy', name: 'Perfect Spike', how: 'At the top', line: 'From a step behind the set, jump as it peaks and swing at the top of your jump: faster and hotter.' },
    { action: 'guard', name: 'Block', how: 'In the air at the net', line: 'Jump as their hitter does and get your hands up at their glint: on time, a STUFF BLOCK.' },
    { action: 'dash', name: 'Dive', how: 'At a hard ball', line: 'Throw yourself at a spike coming in past you and dig it up for your side.' },
    { action: 'heavy', name: 'Jump Serve', how: 'Jump, then serve', line: 'Jump beside the ball and it goes up with you: serve it at the top, hard and deep.' },
  ],
};

/** The basics on a page on the sport rules (game/ball/sportRules.ts: the default; `?classic` keeps the ones above) -
 *  football's (game/ball/football.ts) and volleyball's (game/ball/volley.ts), the skills their LEARN TO PLAY teaches and
 *  the rest of their buttons. */
export const SPORT_RULES_BASICS: Readonly<Record<BallModeId, readonly SportBasic[]>> = {
  'goal-rush': [
    { action: 'light', name: 'Pass', how: 'The stick at a team-mate', line: 'Point the stick at someone on your side and tap: the pass is led into their run. Hold it a moment to lift it. Without the ball, it calls for it.' },
    { action: 'heavy', name: 'Shoot', how: 'Tap, or hold', line: 'A tap places it where you look. Hold to wind up a harder shot: the stick still steers you.' },
    { action: 'heavy', name: 'First Time', how: 'As it arrives', line: 'Press just before a pass reaches you and you play it at once, with no touch first.' },
    { action: 'dash', name: 'Sprint', how: 'Hold it', line: 'Faster, but the ball runs further ahead of you. A rival who gets to it then takes it.' },
    { action: 'guard', name: 'Tackle', how: 'Poke or slide', line: 'From in front of the one on the ball, a poke takes it. While sprinting, a slide knocks it loose - miss, and you are down a moment.' },
    { action: 'special', name: 'Trick', how: 'With the ball', line: 'A quick cut off your run. A tackle in that moment misses.' },
    { action: 'jump', name: 'Header', how: 'Into a high ball', line: 'Jump into a cross and head it on, the way you face.' },
    { action: 'target', name: 'Sport & Fight', how: 'Switch', line: "In FIGHT your buttons are your fighter's moves: knock the one on the ball down and it is loose. Press it again for SPORT." },
  ],
  'sky-spike': [
    { action: 'light', name: 'Every Touch', how: 'One button', line: 'The serve, the receive, the set: the game walks you to the ball. Press as it comes down to you. The timing makes it PERFECT, GOOD, EARLY or LATE.' },
    { action: 'jump', name: 'Spike', how: 'Jump, then press', line: 'On the third touch, jump as the ring closes and press in the air. The higher in your jump, the harder. The stick aims it.' },
    { action: 'heavy', name: 'Tip', how: 'Up for the attack', line: 'A soft touch over the block, short into their court.' },
    { action: 'jump', name: 'Block', how: 'Hold at the net', line: 'Jump at the net as their hitter goes up, and hold it: the jump is the block.' },
    { action: 'dash', name: 'Dive', how: 'At a low ball', line: 'Throw yourself at a ball of yours just out of reach. A dive is at best GOOD.' },
    { action: 'light', name: 'Jump Serve', how: 'Jump, then press', line: 'Jump beside the ball and it goes up with you: serve it at the top, hard and deep.' },
    { action: 'ultimate', name: 'Super Spike', how: 'A full meter', line: 'Up for the attack with the meter full: a spike through any block.' },
  ],
};

/** The list's rows (a `ul.ux-defence`, as DEFENCE BASICS draws: defence.css), by this page's rules. */
export function sportsBasics(mode: BallModeId, options: PromptOptions = {}): string {
  return (sportPage() ? SPORT_RULES_BASICS : SPORTS_BASICS)[mode].map(s => `<li><span class="ux-defence-key">${promptKey(s.action, { ...options, sport: options.sport === undefined ? { mode } : options.sport })}</span><span class="ux-defence-name"><b>${escape(s.name.toUpperCase())}</b><small>${escape(s.how.toUpperCase())}</small></span><span class="ux-defence-line">${escape(s.line)}</span></li>`).join('');
}
