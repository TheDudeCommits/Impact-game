import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPIKE_BACK, SPORT_GLYPHS, SPORT_SLOTS, sportSet, sportTouchName, spikeLight, spikeMoment, type SportSet } from '../src/input/sportTouch';
import { currentSport, promptKey, promptText, touchKey } from '../src/ui/prompts';
import { MODES } from '../src/ui/modes/catalogue';
import type { BallView } from '../src/game/ball/model';

/** A ball match as the touch set reads it: the page's own seat 'me' on red, a team-mate and two of blue. */
const view = (over: Partial<BallView> = {}) => ({
  kind: 'ball', mode: 'goal-rush', phase: 'live', practice: false, serverId: null, touchTeam: null, touches: 0, drill: null,
  seats: [{ id: 'me', team: 'red' }, { id: 'mate', team: 'red' }, { id: 'foe', team: 'blue' }, { id: 'foe2', team: 'blue' }],
  ...over,
}) as unknown as BallView;
const shown = (set: SportSet) => SPORT_SLOTS.filter(slot => set[slot]);
const labels = (set: SportSet) => Object.fromEntries(SPORT_SLOTS.map(slot => [slot, set[slot]?.label ?? null]));

describe('the ball modes\' touch set (input/sportTouch.ts)', () => {
  it('Goal Rush, BALL stance: SHOOT, PASS, JUMP, BOOST (held), FIGHT and SUPER once charged', () => {
    const set = sportSet(view(), 'me', false, true);
    expect(labels(set)).toEqual({ main: 'SHOOT', pass: 'PASS', jump: 'JUMP', run: 'BOOST', side: 'FIGHT', super: 'SUPER' });
    expect(set.main!.action).toBe('heavy'); expect(set.pass!.action).toBe('light'); expect(set.run).toMatchObject({ action: 'dash', hold: true });
    expect(set.side!.action).toBe('target'); expect(set.super!.action).toBe('ultimate');
    // Short of its charge SUPER is no button at all - the HUD's bar is its charge: five on screen.
    const early = sportSet(view(), 'me', false, false);
    expect(early.super).toBeNull();
    expect(shown(early)).toHaveLength(5);
    // The shot alone is held as its key is (a rule may read how long).
    expect(SPORT_SLOTS.filter(slot => set[slot]!.held)).toEqual(['main']);
  });
  it('Goal Rush, FIGHT stance: the same buttons as fight moves, and BALL to go back', () => {
    const set = sportSet(view(), 'me', true, true);
    expect(labels(set)).toEqual({ main: 'HEAVY', pass: 'LIGHT', jump: 'JUMP', run: 'DASH', side: 'BALL', super: 'ULT' });
    expect(set.main!.glyph).toBe('art'); expect(set.pass!.glyph).toBe('fist');
    // Each slot presses the same action in both stances: the thumb's memory holds.
    const ball = sportSet(view(), 'me', false, true);
    for (const slot of SPORT_SLOTS) expect(set[slot]!.action, slot).toBe(ball[slot]!.action);
  });
  it('FREE PLAY has no stances, so no FIGHT button; Sky Spike never fights', () => {
    expect(sportSet(view({ practice: true }), 'me', false, false).side).toBeNull();
    expect(sportSet(view({ practice: true }), 'me', true, false).main!.label).toBe('SHOOT');
    expect(sportSet(view({ mode: 'sky-spike' }), 'me', true, true).main!.label).toBe('SPIKE');
  });
  it('Sky Spike: SPIKE, the light named for the touch it will be, JUMP, BOOST, BLOCK and SUPER', () => {
    const set = sportSet(view({ mode: 'sky-spike' }), 'me', false, true);
    expect(labels(set)).toEqual({ main: 'SPIKE', pass: 'BUMP', jump: 'JUMP', run: 'BOOST', side: 'BLOCK', super: 'SUPER' });
    expect(set.side!.action).toBe('guard'); expect(set.run).toMatchObject({ action: 'dash', hold: true }); expect(set.main!.held).toBe(true);
    const at = (over: Partial<BallView>) => spikeLight(view({ mode: 'sky-spike', ...over }), 'me').label;
    expect(at({ touchTeam: 'red', touches: 0 })).toBe('BUMP');
    expect(at({ touchTeam: 'red', touches: 1 })).toBe('SET');
    expect(at({ touchTeam: 'red', touches: 2 })).toBe('TIP');
    expect(at({ touchTeam: 'red', touches: 3 })).toBe('BUMP');
    expect(at({ touchTeam: 'blue', touches: 1 })).toBe('BUMP');
    const serving = sportSet(view({ mode: 'sky-spike', phase: 'kickoff', serverId: 'me' }), 'me', false, false);
    expect([serving.main!.label, serving.pass!.label]).toEqual(['SERVE', 'LOB']);
    expect(sportSet(view({ mode: 'sky-spike', phase: 'kickoff', serverId: 'foe' }), 'me', false, false).main!.label).toBe('SPIKE');
  });
  it("Sky Spike's button of the moment: BLOCK at the net, DIVE in the back court while the ball is the other side's", () => {
    const ball = (lastTeam: 'red' | 'blue' | undefined) => ({ lastTeam }) as unknown as BallView['ball'];
    const at = (over: Partial<BallView>, z?: number) => spikeMoment(view({ mode: 'sky-spike', ...over }), 'me', z === undefined ? undefined : { z });
    // Their ball, and you deep on your own side (red's is z < 0; the distance from the net is what counts): DIVE, the dash.
    expect(at({ ball: ball('blue') }, -(SPIKE_BACK + 2))).toMatchObject({ action: 'dash', label: 'DIVE', glyph: 'dive' });
    expect(at({ ball: ball('blue') }, SPIKE_BACK)).toMatchObject({ label: 'DIVE' });
    // At the net it is a block: the guard, held.
    expect(at({ ball: ball('blue') }, -(SPIKE_BACK - .5))).toMatchObject({ action: 'guard', label: 'BLOCK', glyph: 'block' });
    // Your own side's ball, nobody's, a serve's walk-up, or a body the set was not given: BLOCK.
    expect(at({ ball: ball('red') }, -8).label).toBe('BLOCK');
    expect(at({ ball: ball(undefined) }, -8).label).toBe('BLOCK');
    expect(at({ ball: ball('blue'), phase: 'kickoff' }, -8).label).toBe('BLOCK');
    expect(at({ ball: ball('blue') }).label).toBe('BLOCK');
    // The set shows it in the moment's slot; the other four stay what they are.
    const deep = sportSet(view({ mode: 'sky-spike', ball: ball('blue') }), 'me', false, false, { z: -8 });
    expect(labels(deep)).toEqual({ main: 'SPIKE', pass: 'BUMP', jump: 'JUMP', run: 'BOOST', side: 'DIVE', super: null });
  });
  it('never shows more than six, each pressing an action the input has, each with a face', () => {
    for (const v of [view(), view({ practice: true }), view({ mode: 'sky-spike' })]) for (const fight of [false, true]) for (const ready of [false, true]) {
      const set = sportSet(v, 'me', fight, ready);
      expect(shown(set).length).toBeLessThanOrEqual(6);
      for (const slot of SPORT_SLOTS) {
        const face = set[slot]; if (!face) continue;
        expect(['light', 'heavy', 'jump', 'dash', 'guard', 'ultimate', 'target']).toContain(face.action);
        if (face.glyph !== 'art') expect(SPORT_GLYPHS[face.glyph]).toMatch(/^<(path|circle|g|rect)/);
      }
    }
  });
});

describe('prompts name the touch set\'s buttons in a ball match (prompts.ts)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const touch = { device: 'touch', family: 'generic' } as const;
  it('names each action by the set\'s own label, and an action it has no button for not at all', () => {
    expect(promptKey('heavy', { ...touch, sport: { mode: 'goal-rush' } })).toBe('<kbd class="touch-key">SHOOT</kbd>');
    expect(promptKey('dash', { ...touch, sport: { mode: 'goal-rush' } })).toBe('<kbd class="touch-key">BOOST</kbd>');
    expect(promptKey('target', { ...touch, sport: { mode: 'goal-rush' } })).toBe('<kbd class="touch-key">FIGHT</kbd>');
    expect(promptKey('target', { ...touch, sport: { mode: 'goal-rush', fight: true } })).toBe('<kbd class="touch-key">BALL</kbd>');
    expect(promptKey('guard', { ...touch, sport: { mode: 'goal-rush' } })).toBe('');
    expect(promptKey('guard', { ...touch, sport: { mode: 'sky-spike' } })).toBe('<kbd class="touch-key">BLOCK</kbd>');
    // (Sky Spike's dash is BOOST, the button that is always there; the moment's DIVE is the same press.)
    expect(promptKey('dash', { ...touch, sport: { mode: 'sky-spike' } })).toBe('<kbd class="touch-key">BOOST</kbd>');
    expect(promptKey('special', { ...touch, sport: { mode: 'sky-spike' } })).toBe('');
    expect(touchKey('forward', { mode: 'sky-spike' })).toBe('<kbd class="touch-key">STICK</kbd>');
    // Outside one, the fight's fan.
    expect(promptKey('heavy', { ...touch, sport: null })).toBe('<kbd class="touch-key">HEAVY</kbd>');
    expect(sportTouchName('goal-rush', false, 'special')).toBeUndefined();
  });
  it('reads the match on screen from the HUD (#interface[data-hud], [data-ball-stance])', () => {
    const root = { dataset: { hud: 'goal-rush', ballStance: 'fight', input: 'touch' } };
    vi.stubGlobal('document', { querySelector: () => root });
    expect(currentSport()).toEqual({ mode: 'goal-rush', fight: true });
    expect(promptKey('light')).toBe('<kbd class="touch-key">LIGHT</kbd>');
    root.dataset.ballStance = 'ball';
    expect(promptKey('light')).toBe('<kbd class="touch-key">PASS</kbd>');
    root.dataset.hud = 'duel';
    expect(currentSport()).toBeNull();
    expect(promptKey('light')).toBe('<kbd class="touch-key">LIGHT</kbd>');
  });
  it('teaches the ball modes\' skills in the how-to-play, keyed for every device', () => {
    const goal = MODES['goal-rush'].howTo.join(' '), spike = MODES['sky-spike'].howTo.join(' ');
    for (const word of ['{target}', 'BALL', 'FIGHT', 'TACKLE', '{dash}', 'BOOST']) expect(goal).toContain(word);
    for (const word of ['{jump}', 'peaks', 'top of your jump', 'PERFECT SPIKE', 'DIVE', '{guard}']) expect(spike).toContain(word);
    const onTouch = promptText(MODES['goal-rush'].howTo[0], { ...touch, sport: { mode: 'goal-rush' } });
    expect(onTouch).toContain('PASS'); expect(onTouch).toContain('SHOOT'); expect(onTouch).toContain('BOOST');
    expect(promptText(MODES['sky-spike'].howTo[2], { ...touch, sport: { mode: 'sky-spike' } })).toContain('>BOOST<');
    expect(MODES['goal-rush'].rulesVersion).toBeGreaterThanOrEqual(2); expect(MODES['sky-spike'].rulesVersion).toBeGreaterThanOrEqual(2);
  });
});
