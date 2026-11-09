import { BALL_MUTATORS, MUTATOR_NAMES, isMutator, mutatorLine, weeklyMutator, weeklyTurnover } from '../../game/ball/mutators';
import { DRILLS, MODE_DRILLS, isDrill, type DrillId } from '../../game/ball/drills';
import { TRAIT_LINES, TRAIT_NAMES, traitOf } from '../../game/ball/traits';
import { RANKED } from '../../game/ball/ranked';
import type { BallModeId } from '../../game/ball/model';
import type { FighterId } from '../../game/types';
import type { CouchStart, NetworkAccess } from '../../network';
import type { ModePrefs } from '../modes/prefs';
import { MEDAL_MARK, drillBest, drillMedal } from './drillMedals';
import { myRanks, refreshRanks, seasonLine, stampHtml } from './ranks';
import './ballSheet.css';

/** The ball modes' rows on the mode sheet (ui/modes/ModeSheet.ts):
 *  - BOTS, PLAY: a 3 V 3 MATCH, FREE PLAY, or DRILLS (game/ball/drills.ts) with each drill's best medal.
 *  - BOTS, COUCH and FRIENDS, RULES: CLASSIC, RUMBLE, or one of the mutators (game/ball/mutators.ts).
 *  - ONLINE, QUEUE: CLASSIC, this week's PLAYLIST (its mutator), or RANKED with the account's stamp (ui/ball/ranks.ts).
 *  And the fighter's ball trait (game/ball/traits.ts) under YOUR FIGHTER. Every button is `data-ms-ball="key:value"`;
 *  `ballChoice` turns a press into the preferences to keep. */
type Variant = 'offline' | 'online' | 'friends' | 'couch';
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const pressed = (on: boolean) => `aria-pressed="${on}"`;
const rulesOf = (prefs: ModePrefs) => prefs.rumble ? 'rumble' : isMutator(prefs.mutator) ? prefs.mutator : 'classic';
/** The queue ONLINE joins: RANKED, the weekly PLAYLIST, or CLASSIC. */
const queueOf = (prefs: ModePrefs) => prefs.queue === 'ranked' || prefs.queue === 'playlist' ? prefs.queue : 'classic';

/** BOTS' PLAY row: a match, FREE PLAY, or a drill. */
export function ballPlayRow(mode: BallModeId, prefs: ModePrefs): string {
  const play = prefs.drills ? 'drills' : prefs.practice ? 'free' : 'match';
  const row = `<div class="ms-option" role="group" aria-label="Play"><b>PLAY</b><button type="button" data-ms-ball="play:match" ${pressed(play === 'match')}>3 V 3 MATCH</button><button type="button" data-ms-ball="play:free" ${pressed(play === 'free')}>FREE PLAY</button><button type="button" data-ms-ball="play:drills" ${pressed(play === 'drills')}>DRILLS</button></div>`;
  if (play === 'free') return `${row}<p class="ms-note">Just you and the ball: no clock, no bots. ${mode === 'sky-spike' ? 'A ball machine keeps sending balls over to spike.' : 'The ball goes back on the spot after each goal.'} Backspace resets the ball.</p>`;
  if (play !== 'drills') return row;
  const chosen = drillOf(mode, prefs);
  const list = MODE_DRILLS[mode].map(id => {
    const medal = drillMedal(id), best = drillBest(id);
    return `<button type="button" class="bs-drill" data-ms-ball="drill:${id}" ${pressed(id === chosen)}><span>${escape(DRILLS[id].name)}</span>${medal ? `<i class="bs-medal ${medal}" title="${medal.toUpperCase()} · ${best}/${DRILLS[id].balls}">${MEDAL_MARK[medal]}</i>` : best ? `<i class="bs-medal none">${best}</i>` : ''}</button>`;
  }).join('');
  const d = DRILLS[chosen], [b, s, g] = d.medals;
  return `${row}<div class="bs-drills" role="group" aria-label="Drill">${list}</div><p class="ms-note">${escape(d.line)} ${d.balls} balls: bronze ${b}, silver ${s}, gold ${g}.</p>`;
}
const drillOf = (mode: BallModeId, prefs: ModePrefs): DrillId => isDrill(prefs.drill) && DRILLS[prefs.drill].mode === mode ? prefs.drill : MODE_DRILLS[mode][0];

/** BOTS', COUCH's and FRIENDS' RULES row, or ONLINE's QUEUE row. */
export function ballRulesRow(mode: BallModeId, variant: Variant, prefs: ModePrefs, now = Date.now()): string {
  if (variant === 'online') {
    const queue = queueOf(prefs), week = weeklyMutator(now);
    const row = `<div class="ms-option" role="group" aria-label="Queue"><b>QUEUE</b><button type="button" data-ms-ball="queue:classic" ${pressed(queue === 'classic')}>CLASSIC</button><button type="button" data-ms-ball="queue:playlist" ${pressed(queue === 'playlist')}>${MUTATOR_NAMES[week]}<small> THIS WEEK</small></button><button type="button" data-ms-ball="queue:ranked" ${pressed(queue === 'ranked')}>RANKED</button></div>`;
    if (queue === 'playlist') { const days = Math.max(1, Math.ceil((weeklyTurnover(now) - now) / 86_400_000)); return `${row}<p class="ms-note">This week's playlist: ${escape(mutatorLine(week, mode))} The next one comes in ${days} day${days === 1 ? '' : 's'}.</p>`; }
    if (queue === 'ranked') {
      void refreshRanks();
      const mine = myRanks()?.modes[mode];
      return `${row}<div class="bs-ranked">${stampHtml(mine)}<p class="ms-note"><b>${seasonLine(now)}</b> Rated against the people on the other side; bots don't count. People on both sides at kickoff, or it's unranked. Leaving counts as a loss. ${mine && mine.games < RANKED.placements ? `${RANKED.placements - mine.games} placement match${RANKED.placements - mine.games === 1 ? '' : 'es'} to play.` : ''}</p></div>`;
    }
    return row;
  }
  const rules = rulesOf(prefs);
  const names: [string, string][] = [['classic', 'CLASSIC'], ['rumble', 'RUMBLE'], ...BALL_MUTATORS.map(m => [m, MUTATOR_NAMES[m]] as [string, string])];
  const row = `<div class="ms-option bs-rules" role="group" aria-label="Rules"><b>RULES</b>${names.map(([id, name]) => `<button type="button" data-ms-ball="rules:${id}" ${pressed(rules === id)}>${name}</button>`).join('')}</div>`;
  if (rules === 'rumble') return `${row}<p class="ms-note">Charms appear on the field. Run through one: a KI CHARGE shot, a GIANT BALL, an IRON WALL over your goal and more.</p>`;
  if (isMutator(rules)) return `${row}<p class="ms-note">${escape(mutatorLine(rules, mode))}</p>`;
  return row;
}

/** A press on one of the rows above, as the preferences to keep (undefined: not one of them). */
export function ballChoice(value: string | undefined): Partial<ModePrefs> | undefined {
  const [key, choice] = (value ?? '').split(':');
  if (key === 'play') return choice === 'drills' ? { drills: true, practice: false } : { drills: false, practice: choice === 'free' };
  if (key === 'drill' && isDrill(choice)) return { drill: choice, drills: true, practice: false };
  if (key === 'rules') return choice === 'rumble' ? { rumble: true, mutator: null } : isMutator(choice) ? { rumble: false, mutator: choice } : { rumble: false, mutator: null };
  if (key === 'queue' && (choice === 'classic' || choice === 'playlist' || choice === 'ranked')) return { queue: choice };
  return undefined;
}

/** GO on a ball mode's sheet, as the start code's access. */
export function ballStart(mode: BallModeId, variant: Variant, prefs: ModePrefs, join: boolean, code: string, couch?: CouchStart): Extract<NetworkAccess, { kind: 'ball' }> {
  const rules = rulesOf(prefs), mutator = isMutator(rules) ? rules : undefined, rumble = rules === 'rumble';
  if (couch) return { kind: 'ball', mode, access: 'bots', couch, rumble, mutator };
  if (join) return { kind: 'ball', mode, access: 'join', code };
  if (variant === 'online') return { kind: 'ball', mode, access: 'quick', queue: queueOf(prefs) };
  if (variant === 'friends') return { kind: 'ball', mode, access: 'host', rumble, mutator };
  const drill = prefs.drills ? drillOf(mode, prefs) : undefined;
  return { kind: 'ball', mode, access: 'bots', rumble, mutator, practice: !!drill || !!prefs.practice, drill };
}

/** The fighter's ball trait, under YOUR FIGHTER. */
export function traitBadge(fighter: FighterId): string {
  const trait = traitOf(fighter);
  return `<span class="bs-trait t-${trait}" title="${escape(TRAIT_LINES[trait])}"><b>${TRAIT_NAMES[trait]}</b><small>${escape(TRAIT_LINES[trait])}</small></span>`;
}
