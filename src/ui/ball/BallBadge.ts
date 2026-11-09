import { ballOf, type BallView } from '../../game/ball/model';
import { MUTATOR_NAMES } from '../../game/ball/mutators';
import { DRILLS } from '../../game/ball/drills';
import type { GameSnapshot } from '../../game/types';
import { MEDAL_MARK } from './drillMedals';
import './ballBadge.css';

/** A line on the ball modes' screen during play (the HUD itself is BallHud's, left alone): the mutator at work
 *  (HEAT RUSH...), RANKED, and a training drill's progress - its name, which ball of ten, each ball's result as a dot,
 *  and how many the next medal asks for. Drawn under the scoreboard's strip, small, out of the way of the fight. */
export class BallBadge {
  readonly root: HTMLElement;
  private key = '';
  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ball-badge hidden';
    this.root.setAttribute('aria-live', 'polite');
    parent.append(this.root);
  }
  update(snapshot: GameSnapshot | null | undefined, hidden: boolean) {
    const v = ballOf(snapshot);
    const show = !!v && !hidden && v.phase !== 'lobby' && v.phase !== 'over' && (!!v.mutator || !!v.ranked || !!v.drill);
    this.root.classList.toggle('hidden', !show);
    if (!v || !show) { this.key = ''; return; }
    const d = v.drill, key = `${v.mutator}|${v.ranked}|${d ? `${d.id}:${d.ball}:${d.results.join('')}:${d.state}` : ''}`;
    if (key === this.key) return;
    this.key = key;
    this.root.classList.toggle('drill', !!d);
    this.root.innerHTML = this.html(v);
  }
  private html(v: BallView) {
    const chips = [v.ranked ? '<span class="bb-chip ranked">RANKED</span>' : '', v.mutator ? `<span class="bb-chip">${MUTATOR_NAMES[v.mutator]}</span>` : ''].join('');
    const d = v.drill;
    if (!d) return chips;
    const def = DRILLS[d.id], next = def.medals.find(n => d.done < n), medal = next === def.medals[0] ? 'bronze' : next === def.medals[1] ? 'silver' : 'gold';
    const dots = Array.from({ length: d.balls }, (_, i) => `<i class="${i < d.results.length ? (d.results[i] ? 'hit' : 'miss') : i === d.results.length && d.state === 'live' ? 'now' : ''}"></i>`).join('');
    // (While a ball is in play after the first, the card is its count, dots and medal alone - the line is read
    // between balls - so it never stands on the play: on a phone it would cover the middle of the screen.)
    return `${chips}<div class="bb-drill" data-state="${d.state}"${d.ball <= 1 ? ' data-first' : ''}><small>BALL ${Math.min(d.balls, Math.max(1, d.ball))} / ${d.balls}</small><b>${def.line}</b><span class="bb-dots">${dots}</span>
      <em>${d.done} RIGHT${next !== undefined ? ` · <u class="${medal}">${MEDAL_MARK[medal]}</u> AT ${next}` : ' · GOLD'}</em></div>`;
  }
  clear() { this.root.classList.add('hidden'); this.root.innerHTML = ''; this.key = ''; }
}
