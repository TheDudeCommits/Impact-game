import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import { describe, expect, it } from 'vitest';
import type { FighterId } from '../src/game/types';
import { MOVES } from '../src/game/moves';
import { BUDGET_LIMIT, FIGHTER_IDS, budget, decodeForge, encodeForge, forgeMoves, forgeProblems, ownKit, simSpec, type ForgeKit } from '../src/engine/sim';
import {
  STUDIO_HISTORY, STUDIO_TARGETS, assignItem, assignTrial, changed, defaultKitName, dropTrial, edit, fits as libraryFits, inPlay, isOwnKit, loadKit, lookHue,
  lookOf, lookScale, lookSetting, original, startStudio, targetFor, tryItem, undo, withLook, withName, withStatus, withTune, type StudioItem, type StudioState,
  type StudioTarget,
} from '../src/engine/client/forgeStudio';
import { forgeDraftKey, forgeJoinOption, forgeOnline, forgeOnlineKey } from '../src/engine/client/forgeJoin';
import { libraryMoves, moveName } from '../src/ui/forge/studioLibrary';
import { targetLabel } from '../src/ui/forge/studioDom';
import { fighterShown } from '../src/originals/launch';
import { displayMove } from '../src/originals/apply';

const move = (from: FighterId, fromSlot: 'light' | 'heavy' | 'special' | 'ultimate'): StudioItem => ({ kind: 'move', from, fromSlot });
const fx = (effect: string): StudioItem => ({ kind: 'fx', effect });
const fresh = (): StudioState => startStudio('bellows', defaultKitName('Bellows'));

describe('the Forge Studio: try, then assign', () => {
  it("starts from the body's draft when it is this body's, else from the body's own kit", () => {
    expect(fresh().assigned).toEqual(ownKit('bellows', 'Bellows Forged'));
    expect(isOwnKit(fresh().assigned)).toBe(true);
    const draft: ForgeKit = { ...ownKit('bellows', 'Flame Hero'), slots: { ...ownKit('bellows').slots, special: { from: 'taisei' } } };
    expect(startStudio('bellows', 'x', draft).assigned).toBe(draft);
    expect(startStudio('bellows', 'x', { ...draft, body: 'taisei' }).assigned.body).toBe('bellows');      // another body's draft is not this one's
  });

  it('tries a move in the target at once, without changing what is kept', () => {
    const tried = tryItem(fresh(), 'special', move('taisei', 'special'));
    expect(tried.trial).toMatchObject({ target: 'special', item: move('taisei', 'special') });
    expect(inPlay(tried).slots.special).toEqual({ from: 'taisei' });
    expect(tried.assigned.slots.special).toEqual({ from: 'bellows' });                  // kept: still his own
    expect(forgeMoves(inPlay(tried)).special).toEqual(simSpec('taisei')!.kit.slots.special); // Sunpalm Cannon, as the simulation runs it
  });

  it("puts an ultimate on Q: any of a fighter's four moves in any slot", () => {
    const tried = tryItem(fresh(), 'special', move('kagari', 'ultimate'));
    expect(inPlay(tried).slots.special).toEqual({ from: 'kagari', fromSlot: 'ultimate' });
    expect(forgeMoves(inPlay(tried)).special).toEqual(simSpec('kagari')!.kit.slots.ultimate);
    expect(forgeProblems(inPlay(tried), { sandbox: true }).errors).toEqual([]);
  });

  it('puts back what was assigned when something else is tried without assigning', () => {
    let state = assignTrial(tryItem(fresh(), 'heavy', move('kenzo', 'heavy')));       // K kept: Kenzo's heavy
    state = tryItem(state, 'special', move('taisei', 'special'));                        // Q tried
    state = tryItem(state, 'light', move('konta', 'light'));                         // then J tried instead
    expect(inPlay(state).slots.special).toEqual({ from: 'bellows' });                 // Q is back to what was kept
    expect(inPlay(state).slots.light).toEqual({ from: 'konta' });
    expect(inPlay(state).slots.heavy).toEqual({ from: 'kenzo' });                       // the kept K stays
    state = tryItem(state, 'light', move('gummy', 'light'));                          // another try on the same target
    expect(inPlay(state).slots.light).toEqual({ from: 'gummy' });
    expect(dropTrial(state).trial).toBeUndefined();
    expect(inPlay(dropTrial(state))).toBe(state.assigned);
  });

  it('assigns the trial: kept, one undo step, and the same kit the draft code carries', () => {
    const state = assignTrial(tryItem(fresh(), 'special', move('taisei', 'special')));
    expect(state.trial).toBeUndefined();
    expect(state.assigned.slots.special).toEqual({ from: 'taisei' });
    expect(state.history).toHaveLength(1);
    expect(decodeForge(encodeForge(state.assigned))).toEqual(state.assigned);
    expect(assignTrial(state)).toBe(state);                                            // nothing tried: nothing to assign
    expect(assignItem(fresh(), 'heavy', move('ippon', 'heavy')).assigned.slots.heavy).toEqual({ from: 'ippon' });
  });

  it('never puts a move on the aura: it goes to the slot it comes from', () => {
    expect(targetFor('aura', move('taisei', 'ultimate'))).toBe('ultimate');
    expect(targetFor('aura', fx('ext_aura_fire'))).toBe('aura');
    expect(tryItem(fresh(), 'aura', move('taisei', 'ultimate')).trial?.target).toBe('ultimate');
  });

  it("tries and assigns Armory effects per slot and as the aura; a slot's look stays when its move changes", () => {
    let state = assignTrial(tryItem(fresh(), 'special', fx('colossus_flamefist')));
    expect(state.assigned.slots.special).toEqual({ from: 'bellows', fx: { effect: 'colossus_flamefist' } });
    state = assignTrial(tryItem(state, 'aura', fx('ext_aura_fire')));
    expect(state.assigned.aura).toEqual({ effect: 'ext_aura_fire' });
    state = assignTrial(tryItem(state, 'special', move('taisei', 'special')));
    expect(state.assigned.slots.special).toEqual({ from: 'taisei', fx: { effect: 'colossus_flamefist' } });   // the look stays
    expect(forgeMoves(state.assigned)).toEqual(forgeMoves({ ...state.assigned, aura: undefined, slots: { ...state.assigned.slots, special: { from: 'taisei' } } }));  // cosmetic
    expect(forgeProblems(state.assigned).errors).toEqual([]);
    expect(decodeForge(encodeForge(state.assigned))).toEqual(state.assigned);         // v2 fields ride in the code
  });

  it('brings a new move with its own tunes and no status, and keeps them for a new look', () => {
    let state = assignTrial(tryItem(fresh(), 'special', move('taisei', 'special')));
    state = edit(state, 'special', withTune('special', 'power', .8));
    state = edit(state, 'special', withStatus('special', 'burn'));
    expect(state.assigned.slots.special).toEqual({ from: 'taisei', tune: { power: .8 }, status: 'burn' });
    const looked = assignTrial(tryItem(state, 'special', fx('dragonbreath')));
    expect(looked.assigned.slots.special).toEqual({ from: 'taisei', tune: { power: .8 }, status: 'burn', fx: { effect: 'dragonbreath' } });
    const moved = assignTrial(tryItem(looked, 'special', move('ouga', 'special')));
    expect(moved.assigned.slots.special).toEqual({ from: 'ouga', fx: { effect: 'dragonbreath' } });
  });

  it("ORIGINAL puts a slot's move (with its tunes and status) or a look back to the body's own, as an undoable assignment", () => {
    let state = assignTrial(tryItem(fresh(), 'special', move('taisei', 'special')));
    state = edit(state, 'special', withTune('special', 'reach', 1.2));
    state = assignTrial(tryItem(state, 'special', fx('dragonbreath')));
    const before = state.history.length;
    const plain = original(state, 'special', 'move');
    expect(plain.assigned.slots.special).toEqual({ from: 'bellows', fx: { effect: 'dragonbreath' } });
    expect(plain.history).toHaveLength(before + 1);
    const bare = original(plain, 'special', 'look');
    expect(bare.assigned.slots.special).toEqual({ from: 'bellows' });
    expect(isOwnKit(bare.assigned)).toBe(true);
    expect(undo(bare).assigned.slots.special).toEqual({ from: 'bellows', fx: { effect: 'dragonbreath' } });
    expect(original(bare, 'special', 'look')).toMatchObject({ assigned: bare.assigned, history: bare.history });  // nothing to put back
    const tried = tryItem(state, 'special', move('ippon', 'special'));
    expect(original(tried, 'special', 'move').trial).toBeUndefined();                   // the trial in that target goes too
    const auraed = assignTrial(tryItem(fresh(), 'aura', fx('ext_aura_fire')));
    expect(original(auraed, 'aura', 'look').assigned.aura).toBeUndefined();
  });

  it('undoes the last assignment, and anything being tried with it', () => {
    let state = assignTrial(tryItem(fresh(), 'special', move('taisei', 'special')));
    state = assignTrial(tryItem(state, 'heavy', move('kenzo', 'heavy')));
    state = tryItem(state, 'light', move('konta', 'light'));
    state = undo(state);
    expect(state.trial).toBeUndefined();
    expect(state.assigned.slots.heavy).toEqual({ from: 'bellows' });
    expect(state.assigned.slots.special).toEqual({ from: 'taisei' });
    state = undo(undo(state));                                                         // past the first: nothing more
    expect(isOwnKit(state.assigned)).toBe(true);
    expect(state.history).toEqual([]);
    expect(undo(tryItem(state, 'light', move('konta', 'light'))).trial).toBeUndefined();  // with no history it still drops a trial
  });

  it('takes a whole slider drag back in one undo, and an edit to what is tried stays with the trial', () => {
    let state = assignTrial(tryItem(fresh(), 'special', move('taisei', 'special')));
    for (const power of [.95, .9, .85, .8]) state = edit(state, 'special', withTune('special', 'power', power), 'tune:special:power');
    expect(state.assigned.slots.special.tune).toEqual({ power: .8 });
    expect(state.history).toHaveLength(2);                                             // the assignment, and the whole drag
    expect(undo(state).assigned.slots.special).toEqual({ from: 'taisei' });
    state = edit(state, 'special', withTune('special', 'power', 1), 'tune:special:power');
    expect(state.assigned.slots.special).toEqual({ from: 'taisei' });                     // 100%: no tune at all
    // A look tried on K, tuned while it is tried: the tuning is the trial's, and kept with it.
    let looked = tryItem(state, 'heavy', fx('blade_crescent'));
    looked = edit(looked, 'heavy', withLook('heavy', lookScale(1.5)), 'look:heavy:scale');
    looked = edit(looked, 'heavy', withLook('heavy', lookHue(40)), 'look:heavy:hue');
    looked = edit(looked, 'heavy', withLook('heavy', lookSetting('glow', 1.6)), 'look:heavy:glow');
    expect(looked.assigned.slots.heavy).toEqual({ from: 'bellows' });
    expect(lookOf(inPlay(looked), 'heavy')).toEqual({ effect: 'blade_crescent', scale: 1.5, hue: 40, settings: { glow: 1.6 } });
    // An edit elsewhere meanwhile is an assignment, carried into the trial so assigning it never undoes it.
    looked = edit(looked, 'name', withName('Flame Golden'), 'name');
    expect(looked.assigned.name).toBe('Flame Golden');
    expect(inPlay(looked).name).toBe('Flame Golden');
    const kept = assignTrial(looked);
    expect(kept.assigned.name).toBe('Flame Golden');
    expect(kept.assigned.slots.heavy.fx).toEqual({ effect: 'blade_crescent', scale: 1.5, hue: 40, settings: { glow: 1.6 } });
    expect(lookScale(1)(lookHue(0)({ effect: 'x', scale: 2, hue: 9 }))).toEqual({ effect: 'x' });
    expect(withLook('light', lookScale(2))(ownKit('bellows'))).toEqual(ownKit('bellows'));  // no look: nothing to tune
  });

  it('loads a whole kit (a code, a kept fighter, a share link) as an assignment, for this body only', () => {
    const kit: ForgeKit = { ...ownKit('bellows', 'Shared'), slots: { ...ownKit('bellows').slots, ultimate: { from: 'taisei' } } };
    const loaded = loadKit(tryItem(fresh(), 'light', move('konta', 'light')), kit);
    expect(loaded.assigned).toBe(kit);
    expect(loaded.trial).toBeUndefined();
    expect(undo(loaded).assigned).toEqual(fresh().assigned);
    expect(loadKit(fresh(), { ...kit, body: 'taisei' })).toEqual(fresh());
  });

  it('remembers a bounded history, and knows what differs from the body', () => {
    let state = fresh();
    const ids = ['taisei', 'konta', 'gummy', 'nigo'] as const;
    for (let i = 0; i < STUDIO_HISTORY + 20; i++) state = assignItem(state, 'light', move(ids[i % ids.length], 'light'));
    expect(state.history).toHaveLength(STUDIO_HISTORY);
    expect(changed(state.assigned, 'light')).toEqual({ move: true, look: false });
    expect(changed(state.assigned, 'heavy')).toEqual({ move: false, look: false });
    expect(changed({ ...state.assigned, slots: { ...state.assigned.slots, heavy: { from: 'bellows', fromSlot: 'heavy' } } }, 'heavy').move).toBe(false);
    expect(changed({ ...state.assigned, slots: { ...state.assigned.slots, heavy: { from: 'bellows', fromSlot: 'special' } } }, 'heavy').move).toBe(true);
    expect(isOwnKit({ ...ownKit('bellows', 'Renamed') })).toBe(true);                 // the name alone changes nothing
  });
});

describe('the Forge Studio: the area slot (G, docs/engine/AREA.md)', () => {
  const area = (from: FighterId): StudioItem => ({ kind: 'move', from, fromSlot: 'area' });
  const rows = libraryMoves('bellows').flatMap(group => group.moves);
  const listed = (target: StudioTarget) => rows.filter(row => libraryFits(target, row.item));

  it('is a row of the inspector like the others, G · AREA between R and the aura, holding the body\'s own area move', () => {
    expect(STUDIO_TARGETS).toEqual(['light', 'heavy', 'special', 'ultimate', 'area', 'aura']);
    expect(STUDIO_TARGETS.map(targetLabel)).toEqual(['J · LIGHT', 'K · HEAVY', 'Q · SPECIAL', 'R · ULTIMATE', 'G · AREA', 'AURA']);
    expect(fresh().assigned.slots.area).toEqual({ from: 'bellows' });
    expect(changed(fresh().assigned, 'area')).toEqual({ move: false, look: false });                // ORIGINAL: the body's own (house) move
    expect(moveName('bellows', 'area')).toBe(displayMove('bellows', MOVES.bellows.area.name));
  });

  it("lists every fighter's area move for the area slot alone, and no area move for any other target", () => {
    expect(libraryMoves('bellows')[0].id).toBe('bellows');                                         // the body's own first
    const areas = listed('area');
    expect(areas.map(row => row.item.from).sort()).toEqual([...RELEASED_FIGHTERS].filter(fighterShown).sort());
    for (const { item, name } of areas) {
      expect(item.fromSlot).toBe('area');
      expect(simSpec(item.from)!.kit.slots.area.area, item.from).toBeTruthy();                       // an area move, as the simulation runs it
      expect(name).toBe(displayMove(item.from, MOVES[item.from].area.name));
    }
    for (const target of STUDIO_TARGETS.filter(each => each !== 'area')) {
      expect(listed(target), target).toHaveLength(rows.length - RELEASED_FIGHTERS.filter(fighterShown).length);
      expect(listed(target).some(({ item }) => item.fromSlot === 'area' || !!simSpec(item.from)!.kit.slots[item.fromSlot].area), target).toBe(false);
    }
    for (const target of STUDIO_TARGETS) expect(libraryFits(target, fx('cosmos_meteorstorm')), target).toBe(true);  // an effect fits every target
  });

  it('tries, assigns and puts back an area move; the area slot takes only area moves, and they fit nowhere else', () => {
    let state = tryItem(fresh(), 'area', area('taisei'));
    expect(state.trial).toMatchObject({ target: 'area', item: area('taisei') });
    expect(inPlay(state).slots.area).toEqual({ from: 'taisei' });
    expect(forgeMoves(inPlay(state)).area).toEqual(simSpec('taisei')!.kit.slots.area);
    expect(forgeProblems(inPlay(state), { sandbox: true }).errors).toEqual([]);
    state = assignTrial(state);
    expect(state.assigned.slots.area).toEqual({ from: 'taisei' });
    expect(changed(state.assigned, 'area').move).toBe(true);
    // An area move goes in the area slot whatever is selected; any other move never does (it takes its own slot).
    expect(targetFor('special', area('kagari'))).toBe('area');
    expect(targetFor('aura', area('kagari'))).toBe('area');
    expect(targetFor('area', move('kagari', 'special'))).toBe('special');
    expect(inPlay(tryItem(state, 'area', move('kagari', 'special'))).slots).toMatchObject({ special: { from: 'kagari' }, area: { from: 'taisei' } });
    // ORIGINAL puts the body's own (house) area move back, as an undoable assignment; picking it is the same.
    const back = original(state, 'area', 'move');
    expect(back.assigned.slots.area).toEqual({ from: 'bellows' });
    expect(isOwnKit(back.assigned)).toBe(true);
    expect(undo(back).assigned.slots.area).toEqual({ from: 'taisei' });
    expect(assignItem(state, 'area', area('bellows')).assigned).toEqual(back.assigned);
  });

  it('tries and assigns any Armory effect on the area slot, in kit.slots.area.fx, kept when its move changes', () => {
    let state = tryItem(fresh(), 'area', fx('cosmos_meteorstorm'));
    expect(state.trial?.target).toBe('area');
    expect(inPlay(state).slots.area).toEqual({ from: 'bellows', fx: { effect: 'cosmos_meteorstorm' } });
    expect(state.assigned.slots.area).toEqual({ from: 'bellows' });                                // tried, not kept
    state = assignTrial(state);
    expect(state.assigned.slots.area?.fx).toEqual({ effect: 'cosmos_meteorstorm' });
    expect(lookOf(state.assigned, 'area')).toEqual({ effect: 'cosmos_meteorstorm' });
    state = edit(state, 'area', withLook('area', lookScale(1.5)), 'look:area:scale');
    state = assignItem(state, 'area', area('magatsu'));
    expect(state.assigned.slots.area).toEqual({ from: 'magatsu', fx: { effect: 'cosmos_meteorstorm', scale: 1.5 } });
    expect(forgeProblems(state.assigned, { sandbox: true }).errors).toEqual([]);
    expect(decodeForge(encodeForge(state.assigned))).toEqual(state.assigned);
    expect(original(state, 'area', 'look').assigned.slots.area).toEqual({ from: 'magatsu' });
  });

  it("keeps a kit made before the area slot: its area slot is the body's own, and ORIGINAL there changes nothing", () => {
    const { area: _area, ...core } = ownKit('bellows').slots;
    const old: ForgeKit = { ...ownKit('bellows', 'Old Kit'), slots: core as ForgeKit['slots'] };
    const state = startStudio('bellows', 'x', old);
    expect(isOwnKit(state.assigned)).toBe(true);
    expect(forgeProblems(old, { sandbox: true }).errors).toEqual([]);
    const same = original(state, 'area', 'move');
    expect(same.assigned).toBe(old);
    expect(same.history).toHaveLength(0);
    expect(assignItem(state, 'area', fx('cosmos_meteorstorm')).assigned.slots.area).toEqual({ from: 'bellows', fx: { effect: 'cosmos_meteorstorm' } });
  });
});

describe('the Forge Studio: "Use in private rooms"', () => {
  const store = (entries: Record<string, string>) => (key: string) => entries[key] ?? null;
  const fits: ForgeKit = { ...ownKit('bellows', 'Flame Hero'), slots: { ...ownKit('bellows').slots, special: { from: 'kagari', tune: { power: .8 } } } };
  const strongest = (slot: 'light' | 'heavy' | 'special' | 'ultimate') => FIGHTER_IDS
    .map(id => ({ id, power: budget({ ...ownKit('bellows'), slots: { ...ownKit('bellows').slots, [slot]: { from: id } } }) })).sort((a, b) => b.power - a.power)[0].id;
  const greedy: ForgeKit = { ...ownKit('bellows', 'Too Much'), slots: { light: { from: strongest('light') }, heavy: { from: strongest('heavy') }, special: { from: strongest('special') }, ultimate: { from: strongest('ultimate') } } };

  it('is off until the player turns it on for that body', () => {
    expect(forgeOnline('bellows', store({}))).toBe(false);
    expect(forgeOnline('bellows', store({ [forgeOnlineKey('bellows')]: '1' }))).toBe(true);
    expect(forgeOnline('taisei', store({ [forgeOnlineKey('bellows')]: '1' }))).toBe(false);
  });

  it('sends the draft only when it is on, the kit is whole and within the online budget', () => {
    expect(budget(fits)).toBeLessThanOrEqual(BUDGET_LIMIT);
    expect(budget(greedy)).toBeGreaterThan(BUDGET_LIMIT);
    expect(forgeProblems(greedy, { sandbox: true }).errors).toEqual([]);              // it plays in Training...
    const on = { [forgeOnlineKey('bellows')]: '1' };
    expect(forgeJoinOption('bellows', store({ [forgeDraftKey('bellows')]: encodeForge(fits) }))).toEqual({});        // off
    expect(forgeJoinOption('bellows', store({ ...on, [forgeDraftKey('bellows')]: encodeForge(fits) }))).toEqual({ forge: encodeForge(fits) });
    expect(forgeJoinOption('bellows', store({ ...on, [forgeDraftKey('bellows')]: encodeForge(greedy) }))).toEqual({});  // ...but not online
    expect(forgeJoinOption('bellows', store(on))).toEqual({});                                                          // no draft
    expect(forgeJoinOption('bellows', store({ ...on, [forgeDraftKey('bellows')]: 'JF1.garbage.00000000' }))).toEqual({}); // damaged
    const taisei = { ...fits, body: 'taisei' as FighterId, slots: ownKit('taisei').slots };
    expect(forgeJoinOption('bellows', store({ ...on, [forgeDraftKey('bellows')]: encodeForge(taisei) }))).toEqual({});     // another body's
    expect(forgeJoinOption('taisei', store({ ...on, [forgeDraftKey('taisei')]: encodeForge(taisei) }))).toEqual({});               // on for Bellows only
    const looks: ForgeKit = { ...fits, aura: { effect: 'ext_aura_fire' }, slots: { ...fits.slots, heavy: { from: 'bellows', fx: { effect: 'dragonbreath', scale: 1.4 } } } };
    expect(forgeJoinOption('bellows', store({ ...on, [forgeDraftKey('bellows')]: encodeForge(looks) }))).toEqual({ forge: encodeForge(looks) });  // looks ride along
  });
});
