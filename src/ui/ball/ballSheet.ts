import { BALL_MUTATORS, MUTATOR_NAMES, isMutator, mutatorLine, weeklyMutator, weeklyTurnover, type BallMutator } from '../../game/ball/mutators';
import { DRILLS, MODE_DRILLS, isDrill, type DrillId } from '../../game/ball/drills';
import { TRAIT_LINES, TRAIT_NAMES, traitOf } from '../../game/ball/traits';
import { RANKED } from '../../game/ball/ranked';
import { isBotLevel, type BotLevel } from '../../game/ball/BallBrain';
import type { BallModeId } from '../../game/ball/model';
import { sportPage } from '../../game/ball/sportRules';
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
 *  - BOTS (a match) and COUCH, BOTS: the other side's bots EASY, NORMAL or HARD (game/ball/BallBrain.ts
 *    BOT_LEVELS); FRIENDS (a room opened): the level of the bots that fill its seats.
 *  And the fighter's ball trait (game/ball/traits.ts) under YOUR FIGHTER. Every button is `data-ms-ball="key:value"`;
 *  `ballChoice` turns a press into the preferences to keep. */
type Variant = 'offline' | 'online' | 'friends' | 'couch';
/** What the rows offer on a page on the sport rules (game/ball/sportRules.ts: the default; `?classic` offers everything
 *  above), where this device's matches play football and volleyball. Each extra was started there and played; what does not play right under those rules is not drawn there, and stays under `?classic`:
 *  - RUMBLE: its KI CHARGE charm is picked up and does nothing (neither rule set plays the classic strike that reads it).
 *  - Goal Rush: HEAT RUSH, LOW GRAVITY and GIANT BALL do nothing (football's ball sets its own size and weight and has no
 *    heat); SUDDEN DEATH plays as it says. The drills run the classic rules (BallMatch: none with a drill); FREE PLAY is
 *    football's.
 *  - Sky Spike: SUDDEN DEATH's points are worth one (volleyball's scoring), and LOW GRAVITY's flights keep their times
 *    (the touches aim the ball to arrive on time), so neither does what it says; HEAT RUSH and GIANT BALL do. FREE PLAY and
 *    the drills run the classic rules (LocalBall). */
export const SPORT_EXTRAS: Readonly<Record<BallModeId, { mutators: readonly BallMutator[]; rumble: boolean; free: boolean; drills: boolean }>> = {
  'goal-rush': { mutators: ['sudden-death'], rumble: false, free: true, drills: false },
  'sky-spike': { mutators: ['heat-rush', 'giant-ball'], rumble: false, free: false, drills: false },
};
/** The extras this page offers for `mode`: all of them on the classic rules, SPORT_EXTRAS on the sport rules. */
const extrasHere = (mode: BallModeId) => sportPage() ? SPORT_EXTRAS[mode] : { mutators: BALL_MUTATORS, rumble: true, free: true, drills: true };
/** A mode's kept preferences as this page may play them: on the sport rules, a pick it does not offer (kept from a page on
 *  the classic ones) is read as the plain match. */
export function ballPrefs(mode: BallModeId, prefs: ModePrefs): ModePrefs {
  if (!sportPage()) return prefs;
  const here = extrasHere(mode), out = { ...prefs };
  if (out.rumble && !here.rumble) out.rumble = false;
  if (isMutator(out.mutator) && !here.mutators.includes(out.mutator)) out.mutator = null;
  if (out.drills && !here.drills) out.drills = false;
  if (out.practice && !here.free) out.practice = false;
  return out;
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const pressed = (on: boolean) => `aria-pressed="${on}"`;
const rulesOf = (prefs: ModePrefs) => prefs.rumble ? 'rumble' : isMutator(prefs.mutator) ? prefs.mutator : 'classic';
/** The queue ONLINE joins: RANKED, the weekly PLAYLIST, or CLASSIC. */
const queueOf = (prefs: ModePrefs) => prefs.queue === 'ranked' || prefs.queue === 'playlist' ? prefs.queue : 'classic';

/** BOTS' PLAY row: a match, FREE PLAY, or a drill. */
export function ballPlayRow(mode: BallModeId, prefs: ModePrefs): string {
  const here = extrasHere(mode);
  prefs = ballPrefs(mode, prefs);
  // (A page on the sport rules: Sky Spike's FREE PLAY and both modes' drills are not offered, so a row of one is none.)
  if (!here.free && !here.drills) return '';
  const play = prefs.drills ? 'drills' : prefs.practice ? 'free' : 'match';
  const row = `<div class="ms-option" role="group" aria-label="Play"><b>PLAY</b><button type="button" data-ms-ball="play:match" ${pressed(play === 'match')}>3 V 3 MATCH</button>${here.free ? `<button type="button" data-ms-ball="play:free" ${pressed(play === 'free')}>FREE PLAY</button>` : ''}${here.drills ? `<button type="button" data-ms-ball="play:drills" ${pressed(play === 'drills')}>DRILLS</button>` : ''}</div>`;
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

/** The BOTS row's level: NORMAL unless the player picked another. */
export const levelOf = (prefs: ModePrefs): BotLevel => isBotLevel(prefs.difficulty) ? prefs.difficulty : 'normal';
const LEVEL_NOTES: Record<BotLevel, string> = {
  easy: 'Their bots read the ball late and mistime it: a match to learn in.',
  normal: '',
  hard: 'Their bots read every ball early, time it right and dig in when behind.',
};
/** What HARD's bots do in each mode (BallBrain LEVEL_EDGE), said on the row. */
const HARD_NOTES: Record<BallModeId, string> = {
  'goal-rush': 'Their bots read every ball early, shoot for the far corner, keep goal sharply and mark your runs. Your team-mates leave the match to you.',
  'sky-spike': 'Their bots read every ball early, jump-serve, set quick and time their blocks on your spike.',
};
/** A new player must be able to win, a good one must be challenged: BOTS' and COUCH's BOTS row - the level of the
 *  bots on the other side (a person's team-mates are always NORMAL). Not for FREE PLAY or the drills, which have no bots
 *  to beat. FRIENDS' too, as the room is opened - the host's pick for
 *  the bots that fill its empty seats (ONLINE's matchmaking stays NORMAL). */
export function ballLevelRow(prefs: ModePrefs, mode?: BallModeId): string {
  const level = levelOf(prefs), note = level === 'hard' && mode ? HARD_NOTES[mode] : LEVEL_NOTES[level];
  const row = `<div class="ms-option" role="group" aria-label="Bots"><b>BOTS</b>${(['easy', 'normal', 'hard'] as const).map(l => `<button type="button" data-ms-ball="level:${l}" ${pressed(level === l)}>${l.toUpperCase()}</button>`).join('')}</div>`;
  return note ? `${row}<p class="ms-note">${note}</p>` : row;
}

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
  const here = extrasHere(mode), rules = rulesOf(ballPrefs(mode, prefs));
  // (On the sport rules the plain match is STANDARD: CLASSIC there would read as the classic rules, `?classic`.)
  const names: [string, string][] = [['classic', sportPage() ? 'STANDARD' : 'CLASSIC'], ...(here.rumble ? [['rumble', 'RUMBLE'] as [string, string]] : []), ...here.mutators.map(m => [m, MUTATOR_NAMES[m]] as [string, string])];
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
  if (key === 'level' && isBotLevel(choice)) return { difficulty: choice };
  return undefined;
}

/** GO on a ball mode's sheet, as the start code's access. */
export function ballStart(mode: BallModeId, variant: Variant, prefs: ModePrefs, join: boolean, code: string, couch?: CouchStart): Extract<NetworkAccess, { kind: 'ball' }> {
  prefs = ballPrefs(mode, prefs);
  const rules = rulesOf(prefs), mutator = isMutator(rules) ? rules : undefined, rumble = rules === 'rumble';
  // (The BOTS row's level rides with a match against bots, never FREE PLAY or a drill.)
  const difficulty = levelOf(prefs);
  if (couch) return { kind: 'ball', mode, access: 'bots', couch, rumble, mutator, difficulty };
  if (join) return { kind: 'ball', mode, access: 'join', code };
  if (variant === 'online') return { kind: 'ball', mode, access: 'quick', queue: queueOf(prefs) };
  // (A private room's host picks its bots' level too; matchmaking's bots stay NORMAL.)
  if (variant === 'friends') return { kind: 'ball', mode, access: 'host', rumble, mutator, ...(difficulty !== 'normal' ? { difficulty } : {}) };
  const drill = prefs.drills ? drillOf(mode, prefs) : undefined;
  const practice = !!drill || !!prefs.practice;
  return { kind: 'ball', mode, access: 'bots', rumble, mutator, practice, drill, ...(practice ? {} : { difficulty }) };
}

/** The fighter's ball trait, under YOUR FIGHTER. */
export function traitBadge(fighter: FighterId): string {
  // (A trait is read by the classic strike, header, bump and guard only - football's and volleyball's touches
  // pass them by - so a page on the sport rules does not name one: a line for something that does not happen.)
  if (sportPage()) return '';
  const trait = traitOf(fighter);
  return `<span class="bs-trait t-${trait}" title="${escape(TRAIT_LINES[trait])}"><b>${TRAIT_NAMES[trait]}</b><small>${escape(TRAIT_LINES[trait])}</small></span>`;
}
