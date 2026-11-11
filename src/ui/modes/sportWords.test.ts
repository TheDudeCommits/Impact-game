import { afterEach, describe, expect, it, vi } from 'vitest';

// Football and volleyball the page's default. The words and the sheet's rows are read as a
// page's modules load, so each case loads them afresh under its own address.
const page = async (url: string) => {
  vi.resetModules(); vi.stubGlobal('location', new URL(url));
  const [{ MODES }, { LAUNCH }, basics, learn, sheet] = await Promise.all([import('./catalogue'), import('../../originals/launch'), import('./sportsBasics'), import('../ball/learnCopy'), import('../ball/ballSheet')]);
  return { MODES, LAUNCH, basics, learn, sheet };
};
const ways = (MODES: Awaited<ReturnType<typeof page>>['MODES'], mode: 'goal-rush' | 'sky-spike') => Object.keys(MODES[mode].variants);

describe('the ball modes\' words and rows by the page\'s rules', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  it('describes football and volleyball on a page with nothing in the address, and offers only the ways on this device', async () => {
    const { MODES, basics, learn } = await page('https://impact.playertwo.cc/~b1/index.html');
    expect(MODES['sky-spike'].kicker).toBe('THE SKY COURT · 3 V 3 VOLLEYBALL');
    expect(MODES['goal-rush'].facts.players).toBe('3 V 3 + KEEPERS');
    expect(MODES['goal-rush'].howTo.join(' ')).toMatch(/\{guard\} tackles/);
    expect(MODES['sky-spike'].howTo.join(' ')).toMatch(/\{light\} plays every touch/);
    for (const mode of ['goal-rush', 'sky-spike'] as const) {
      expect(ways(MODES, mode), mode).toEqual(['offline', 'couch']);
      expect(MODES[mode].name).toBe(mode === 'goal-rush' ? 'GOAL RUSH' : 'SKY SPIKE');
      // (No word of the classic rules: the swing that plays the ball, the bump, takraw, heat.)
      const words = JSON.stringify(MODES[mode]) + basics.sportsBasics(mode) + learn.LEARN_PITCH[mode];
      expect(words, mode).not.toMatch(/TAKRAW|BUMP|Every swing|heat|PERFECT STRIKE/i);
    }
    expect(basics.sportsBasics('goal-rush')).toContain('TACKLE'); expect(basics.sportsBasics('sky-spike')).toContain('SUPER SPIKE');
    expect(learn.LEARN_PITCH['sky-spike']).toContain('RECEIVE');
  });
  it('reads as today and offers ONLINE and FRIENDS again under ?classic', async () => {
    const { MODES, LAUNCH, basics, learn } = await page('https://impact.playertwo.cc/~b1/index.html?classic');
    expect(MODES['sky-spike'].kicker).toBe('THE SKY COURT · 3 V 3 TAKRAW');
    expect(MODES['goal-rush'].howTo[0]).toMatch(/^Every swing hits the ball/);
    expect(basics.sportsBasics('sky-spike')).toContain('BUMP');
    expect(learn.LEARN_PITCH['goal-rush']).toContain('PERFECT STRIKE');
    for (const mode of ['goal-rush', 'sky-spike'] as const) expect(ways(MODES, mode), mode).toEqual(LAUNCH.online ? ['offline', 'couch', 'online', 'friends'] : ['offline', 'couch']);
  });
  it('offers on a default page only the extras that play under the sport rules, and starts a kept classic pick as the plain match', async () => {
    const { sheet } = await page('https://play.example.com/');
    const gr = sheet.ballRulesRow('goal-rush', 'offline', {}), ss = sheet.ballRulesRow('sky-spike', 'offline', {});
    expect(gr).toContain('STANDARD'); expect(gr).toContain('SUDDEN DEATH');
    for (const name of ['RUMBLE', 'HEAT RUSH', 'LOW GRAVITY', 'GIANT BALL', '>CLASSIC<']) expect(gr, name).not.toContain(name);
    expect(ss).toContain('HEAT RUSH'); expect(ss).toContain('GIANT BALL');
    for (const name of ['RUMBLE', 'LOW GRAVITY', 'SUDDEN DEATH']) expect(ss, name).not.toContain(name);
    expect(sheet.ballPlayRow('goal-rush', {})).toContain('FREE PLAY'); expect(sheet.ballPlayRow('goal-rush', {})).not.toContain('DRILLS');
    expect(sheet.ballPlayRow('sky-spike', { practice: true })).toBe('');
    expect(sheet.ballStart('goal-rush', 'offline', { rumble: true, drills: true, drill: 'gr-keeper' }, false, '')).toMatchObject({ rumble: false, practice: false, drill: undefined });
    expect(sheet.ballStart('sky-spike', 'offline', { mutator: 'sudden-death', practice: true }, false, '')).toMatchObject({ mutator: undefined, practice: false });
    expect(sheet.ballStart('sky-spike', 'couch', { mutator: 'giant-ball' }, false, '', { partner: 'konta', screen: 'split-v' })).toMatchObject({ mutator: 'giant-ball' });
    expect(sheet.ballStart('goal-rush', 'offline', { practice: true }, false, '')).toMatchObject({ practice: true });
  });
  it('offers every extra under ?classic, as today', async () => {
    const { sheet } = await page('https://play.example.com/?classic');
    for (const name of ['CLASSIC', 'RUMBLE', 'HEAT RUSH', 'LOW GRAVITY', 'GIANT BALL', 'SUDDEN DEATH']) expect(sheet.ballRulesRow('sky-spike', 'offline', {}), name).toContain(name);
    expect(sheet.ballPlayRow('sky-spike', {})).toContain('DRILLS');
    expect(sheet.ballStart('goal-rush', 'offline', { rumble: true }, false, '')).toMatchObject({ rumble: true });
  });
});

describe('LEARN TO PLAY\'s step titles by the lesson\'s rules', () => {
  it('says RECEIVE and SPIKE under volleyball, as its lines do, and keeps the classic titles', async () => {
    const { stepTitle } = await import('../ball/learnCopy');
    expect(stepTitle({ volley: true }, { id: 'ss-bump', title: 'BUMP' })).toBe('RECEIVE');
    expect(stepTitle({ volley: true }, { id: 'ss-spike', title: 'PERFECT SPIKE' })).toBe('SPIKE');
    expect(stepTitle({ volley: true }, { id: 'ss-set', title: 'SET' })).toBe('SET');
    expect(stepTitle({}, { id: 'ss-bump', title: 'BUMP' })).toBe('BUMP');
    expect(stepTitle({ sport: true }, { id: 'gr-perfect', title: 'PERFECT STRIKE' })).toBe('FIRST TIME');
  });
});
