import { FIGHTERS } from '../../config';
import { MAX_MASTERY, masteryOf, rewardText, titleAt } from '../../survival/progress';
import type { MasteryGain } from '../../survival/progressStore';
import './masteryStrip.css';

/** Fighter mastery on every mode's results: the fighter, their level of ten, what the match paid, the bar filling from
 *  where the match found it to where it left it (from empty after a level-up), the title worn, and a level gained as a
 *  stamp with what it unlocked - and the mastery-up line said, once a gain (main.ts sets `up`). The gain is
 *  survival/progressStore.ts lastMastery: a match's or a run's. */
export const masteryCalls: { up?: (gain: MasteryGain) => void } = {};
const called = new Set<string>();

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function masteryStripHtml(gain: MasteryGain | undefined): string {
  if (!gain || gain.xp <= 0 || !FIGHTERS[gain.fighter]) return '';
  const now = masteryOf(gain.after), was = masteryOf(gain.before), up = gain.to > gain.from;
  const from = up ? 0 : was.into / was.span, to = now.max ? 1 : now.into / now.span;
  const rewards = up ? Array.from({ length: gain.to - gain.from }, (_, i) => rewardText(gain.from + 1 + i)).filter(Boolean) : [];
  const stamp = up ? `<em class="mastery-up">LEVEL UP${gain.to - gain.from > 1 ? ` ×${gain.to - gain.from}` : ''}</em>${rewards.map(r => `<span class="mastery-reward">${escape(r)}</span>`).join('')}` : '';
  // (The title worn, unless the level just gained gave it: its reward says it then.)
  const title = up && rewards.some(r => r.includes(`TITLE: ${titleAt(now.level)}`)) ? '' : `<span class="mastery-title">${escape(titleAt(now.level))}</span>`;
  return `<section class="mastery-strip${up ? ' is-up' : ''}" data-mastery="${escape(gain.key)}" aria-label="Fighter mastery">`
    + `<div class="mastery-top"><b class="mastery-name">${escape(FIGHTERS[gain.fighter].name.toUpperCase())}</b><span class="mastery-word">MASTERY</span><strong class="mastery-lv">LV ${now.level}<small>${now.max ? ' MAX' : `/${MAX_MASTERY}`}</small></strong><em class="mastery-xp">+${gain.xp} XP</em></div>`
    + `<i class="mastery-bar" style="--from:${from.toFixed(3)};--to:${to.toFixed(3)}" aria-hidden="true"><i></i></i>`
    + `<div class="mastery-foot">${title}${stamp}</div></section>`;
}

/** A strip on screen: a level gained calls the line, once for its gain. */
export function masteryShown(gain: MasteryGain | undefined) {
  if (!gain || gain.to <= gain.from || called.has(gain.key)) return;
  called.add(gain.key);
  try { masteryCalls.up?.(gain); } catch { /* The stamp shows all the same. */ }
}
