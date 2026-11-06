import { FIGHTERS } from '../config';
import { AWAKENINGS, moveFor, rushMove } from '../originals/shownAwakening';
import { COMBO_INPUTS, COMBO_ROLES, comboMove, hasCombos, OUTCOME_WORDS, type ComboKey, type EnderKey } from '../originals/shownCombos';
import { AIR_NORMAL_FIGHTERS, AIR_RUSH, airRushName, RUSH_AIR_STAGES, RUSH_STAGES, ULTIMATE_COST, type MoveDefinition } from '../originals/shownMoves';
import type { AttackSlot, FighterId } from '../game/types';
import { getBindings, keyName } from '../input/bindings';
import type { PadFamily } from '../input/gamepad';
import { actionKey } from '../input/glyphs';
import './commandList.css';
import { GUARD_GUIDE } from './guardGuide';
import { touchKey } from './prompts';
import { strikeOffsets } from '../engine/sim/areaDamage';
import { TECHNIQUE_KEYS, TECHNIQUE_ROLES, techniqueMove, type TechniqueKey } from '../game/techniques';
import { displayMove } from '../originals/apply';

/** `touch`: the on-screen buttons' own labels (prompts.ts touchKey), on a phone or a tablet - the list read J and
 *  Space + J there, keys a touch screen does not have (overnight UX, 9 October 2026). */
export type CommandDevice = 'keyboard' | 'controller' | 'touch';
type Press = 'jump' | 'guard' | 'dash' | AttackSlot | 'awaken';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function press(action: Press, device: CommandDevice, family: PadFamily) {
  if (device === 'controller') return actionKey(action, family);
  if (device === 'touch') return touchKey(action);
  return `<kbd>${escape(keyName(getBindings().keyboard[action][0] ?? '?'))}</kbd>`;
}
const inputs = (list: readonly Press[], device: CommandDevice, family: PadFamily) =>
  `<span class="cmd-input">${list.map(a => press(a, device, family)).join('<i aria-hidden="true">+</i>')}</span>`;
function traits(move: MoveDefinition) {
  const out: string[] = [];
  if (move.style === 'projectile' || move.style === 'beam') out.push('Ranged');
  else if (move.style === 'bomb' || move.style === 'field') out.push(move.plunge ? 'Area' : 'Area · ranged');
  if (move.guardBreak) out.push('Breaks guard');
  if (move.contacts.length > 1) out.push(`${move.contacts.length} hits`);
  return out;
}
/** The awakenings are named in capitals for their banner (AWAKENINGS); in the list every name is set the same way. */
const MINOR = new Set(['of', 'the', 'no', 'a', 'an', 'and', 'to', 'in']);
const titled = (name: string) => name !== name.toUpperCase() ? name
  : name.toLowerCase().replace(/\p{L}+/gu, (word, at: number) => at > 0 && MINOR.has(word) ? word : word[0].toUpperCase() + word.slice(1));
/** Techniques (game/techniques.ts): the stick's part in a press - toward the opponent, away, across - and a beat. */
type Step = Press | 'toward' | 'away' | 'across' | 'beat';
const STEP_GLYPH: Partial<Record<Step, string>> = { toward: '→', away: '←', across: '↕', beat: '…' };
const TECHNIQUE_PRESSES: Readonly<Record<TechniqueKey, readonly Step[]>> = {
  rush: ['toward', 'light'], rise: ['away', 'light'], slip: ['across', 'light'], hh: ['heavy', 'heavy'], hhh: ['heavy', 'heavy', 'heavy'],
  charge: ['toward', 'heavy'], counter: ['away', 'heavy'], delay: ['light', 'light', 'beat', 'light'], airRush: ['jump', 'toward', 'light'],
  dashStrike: ['dash', 'light'], wakeUp: ['light'], airRise: ['jump', 'away', 'light'],
};
const steps = (list: readonly Step[], device: CommandDevice, family: PadFamily) =>
  `<span class="cmd-input">${list.map(a => STEP_GLYPH[a] ? `<b class="cmd-dir" title="${a}">${STEP_GLYPH[a]}</b>` : press(a as Press, device, family)).join('<i aria-hidden="true">+</i>')}</span>`;
const row = (keys: string, name: string, tags: readonly string[], role?: string) =>
  `<li class="cmd-row${role ? ' cmd-ender' : ''}">${keys}<span class="cmd-name">${escape(name)}</span><span class="cmd-tags">${role ? `<b>${escape(role)}</b>` : ''}${tags.map(t => `<small>${escape(t)}</small>`).join('')}</span></li>`;

export function commandList(id: FighterId, device: CommandDevice, family: PadFamily) {
  const combos = hasCombos(id), string: string[] = [], enders: string[] = [], air: string[] = [], specials: string[] = [];
  for (let stage = 0; stage < RUSH_STAGES; stage++) {
    const move = rushMove(id, stage, false), last = stage === RUSH_STAGES - 1;
    const word = last ? OUTCOME_WORDS[move.outcome ?? 'launch'] : undefined;
    string.push(row(inputs(Array(stage + 1).fill('light'), device, family), move.name, traits(move), word));
  }
  const ender = (key: EnderKey, list: string[]) => {
    const move = comboMove(id, key); if (!move) return;
    list.push(row(inputs(COMBO_INPUTS[key], device, family), move.name, traits(move), COMBO_ROLES[key]));
  };
  if (combos) for (const key of ['lh', 'llh', 'lllh', 'llls'] as const) ender(key, enders);
  // The air string's first blow: the kick the seven lent one are announced by (AIR_RUSH), anyone else's own light.
  // Round 4b (COMBAT): a fighter with an air string of their own (AIR_RUSH) lists it whole, each blow by its own name -
  // the round-4 critic found Space+J listed as J.
  const own = AIR_RUSH[id];
  if (own) for (let stage = 0; stage < RUSH_AIR_STAGES; stage++)
    air.push(row(inputs(['jump', ...Array(stage + 1).fill('light')], device, family), own[stage] ?? rushMove(id, stage, false).name, [], stage === 0 ? 'Air string' : undefined));
  else air.push(row(inputs(['jump', 'light'], device, family), (AIR_NORMAL_FIGHTERS.includes(id) ? airRushName(id, 0) : undefined) ?? rushMove(id, 0, false).name, [], 'Air string'));
  if (combos) { ender('airHeavy', air); ender('airSpecial', air); }
  for (const slot of ['heavy', 'special'] as const) { const move = moveFor(id, slot, false); specials.push(row(inputs([slot], device, family), move.name, traits(move))); }
  const area = moveFor(id, 'area', false), strikes = strikeOffsets(area).length;
  specials.push(row(inputs(['area'], device, family), area.name, ['Hold to aim, let go to cast', 'Most damage dead centre', ...(area.guardBreak ? ['Breaks guard'] : []), ...(strikes > 1 ? [`${strikes} hits`] : [])], 'Area'));
  const ultimate = moveFor(id, 'ultimate', false);
  specials.push(row(inputs(['ultimate'], device, family), ultimate.name, [...traits(ultimate), `${ULTIMATE_COST}% meter`], 'Ultimate'));
  specials.push(row(inputs(['awaken'], device, family), titled(AWAKENINGS[id].name), ['Full awakening meter'], 'Awakening'));
  // Techniques (game/techniques.ts): the nine every fighter has, in their style.
  const techniques = TECHNIQUE_KEYS.map(key => { const move = techniqueMove(id, key); return row(steps(TECHNIQUE_PRESSES[key], device, family), displayMove(id, move.name), traits(move), TECHNIQUE_ROLES[key]); });
  const section = (title: string, rows: string[], note?: string) =>
    `<section class="cmd-section"><h4>${title}</h4>${note ? `<p>${note}</p>` : ''}<ol>${rows.join('')}</ol></section>`;
  // A form that fights as another body (Hawser's YUGE, 13 October 2026: FIGHTERS[id].formShortMoves): the same
  // buttons throw its own moves, so the list says what they are. Marked apart from the rows above (`cmd-form`), which
  // the Training Ground's trials are held to, row for row (ui/hud/trainingTrials.ts).
  const form: string[] = [];
  if (FIGHTERS[id].formShortMoves) {
    const own = (keys: string, move: MoveDefinition, tags: readonly string[], role?: string) => form.push(row(keys, move.name, tags, role).replace('<li class="cmd-row', '<li class="cmd-form cmd-row'));
    for (let stage = 0; stage < RUSH_STAGES; stage++) { const move = rushMove(id, stage, true); own(inputs(Array(stage + 1).fill('light'), device, family), move, traits(move), stage === RUSH_STAGES - 1 ? OUTCOME_WORDS[move.outcome ?? 'launch'] : undefined); }
    if (combos) for (const key of ['lh', 'llh', 'lllh', 'llls', 'airHeavy', 'airSpecial'] as const) { const move = comboMove(id, key, true); if (move) own(inputs(COMBO_INPUTS[key], device, family), move, traits(move), COMBO_ROLES[key]); }
    for (const slot of ['heavy', 'special'] as const) { const move = moveFor(id, slot, true); own(inputs([slot], device, family), move, traits(move)); }
    const zone = moveFor(id, 'area', true), blow = moveFor(id, 'ultimate', true);
    own(inputs(['area'], device, family), zone, ['Hold to aim, let go to cast', ...(zone.guardBreak ? ['Breaks guard'] : [])], 'Area');
    own(inputs(['ultimate'], device, family), blow, [...traits(blow), `${ULTIMATE_COST}% meter`], 'Ultimate');
  }
  return `<div class="command-list" data-command-fighter="${id}" aria-label="${escape(FIGHTERS[id].name)} command list">
    ${section('THE STRING', string, 'Press in rhythm: each hit carries into the next. Mashed, the string hits softer.')}
    ${combos ? section('ENDERS', enders, 'Finish a string early with Heavy or Special - on the beat, once its last hit lands, for a heavier finish.') : ''}
    ${section('TECHNIQUES', techniques, '→ is toward your opponent, ← away, ↕ sideways (the stick or the movement keys), pressed with nothing else running. Mix them into your strings: every kind of technique a combo uses adds STYLE, up to ×1.4. Bots learn a string you repeat.')}
    ${section('IN THE AIR', air, 'After a launch, one timed Light (or Jump + Light) chases them up.')}
    ${section('SPECIAL MOVES', specials)}
    ${form.length ? section(escape(titled(AWAKENINGS[id].name)).toUpperCase(), form, 'Awakened, he fights as another body: the same buttons, its own moves.') : ''}
    ${section('DEFENCE', GUARD_GUIDE.map((g, i) => row(i < 2 ? inputs(['guard'], device, family) : '<span class="cmd-input">-</span>', g.name, [g.how], i === 1 ? 'Skill' : undefined)),
      GUARD_GUIDE.map(g => `<b>${g.name}.</b> ${escape(g.line)}`).join(' '))}
  </div>`;
}
