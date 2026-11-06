import { GUARD_GUIDE } from '../guardGuide';
import { promptKey, type PromptOptions } from '../prompts';
import './defence.css';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** The guard key's place in each lesson: Block and Perfect Parry are pressed on it, Guard Break is not a press. */
export const DEFENCE_KEYED: Readonly<Record<(typeof GUARD_GUIDE)[number]['name'], boolean>> = { Block: true, 'Perfect Parry': true, 'Guard Break': false };

/**
 * Round 5 (UX) with PARRY: the DEFENCE BASICS list in the mode sheet (ModeSheet.ts) and the in-game menu's HOW TO PLAY
 * (GameMenu.ts). The words are the PARRY stream's, from the one source (ui/guardGuide.ts GUARD_GUIDE: Block, Perfect
 * Parry, Guard Break), never copied here: each lesson named, the guard key where it is pressed (the player's binding or
 * the pad's glyph, prompts.ts), how it is done, and its line.
 */
export function defenceBasics(options: PromptOptions = {}): string {
  return GUARD_GUIDE.map(g => `<li><span class="ux-defence-key">${DEFENCE_KEYED[g.name] ? promptKey('guard', options) : ''}</span><span class="ux-defence-name"><b>${escape(g.name.toUpperCase())}</b><small>${escape(g.how.toUpperCase())}</small></span><span class="ux-defence-line">${escape(g.line)}</span></li>`).join('');
}
