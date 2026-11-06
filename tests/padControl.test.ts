import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GamepadControls, UI_DIRECTION, type PadState, type UiAction } from '../src/input/gamepad';
import { enterDigit, type DigitEntry } from '../src/ui/padEntry';
import { stepRound } from '../src/ui/padNav';
import { openPage, scrollFor, SCROLL_STEP } from '../src/ui/pageViewer';

const pad = (pressed: number[] = []): PadState => ({ index: 0, id: 'Xbox Wireless Controller', mapping: 'standard', connected: true, axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) });

describe('LB and RB in a menu', () => {
  it('turn tabs (tabPrevious / tabNext) once per press, and only in a menu', () => {
    const menu = new GamepadControls(); menu.read(pad(), false);
    expect(menu.read(pad([4]), false).ui).toEqual(['tabPrevious']);
    expect(menu.read(pad([4]), false).ui).toEqual([]);
    menu.read(pad(), false);
    expect(menu.read(pad([5]), false).ui).toEqual(['tabNext']);
    // In a fight LB guards and RB is the special: no menu press.
    const fight = new GamepadControls(); fight.read(pad(), true);
    const frame = fight.read(pad([5]), true);
    expect(frame.ui).toEqual([]); expect(frame.attack).toBe('special');
  });
  it('are not directions: a menu moves only on the four', () => {
    expect(UI_DIRECTION).toEqual({ previous: 'up', next: 'down', left: 'left', right: 'right' });
    for (const action of ['confirm', 'back', 'extra', 'tabPrevious', 'tabNext'] as UiAction[]) expect(UI_DIRECTION[action]).toBeUndefined();
  });
});

describe('a code typed with the D-pad', () => {
  const run = (start: DigitEntry, actions: UiAction[]) => actions.reduce<DigitEntry & { done: boolean }>((entry, action) => enterDigit(entry, action), { ...start, done: false });
  it('turns the digit up with up and down with down, round 9 and 0', () => {
    expect(enterDigit({ value: '000000', digit: 0 }, 'previous')).toEqual({ value: '100000', digit: 0, done: false });
    expect(enterDigit({ value: '000000', digit: 0 }, 'next')).toEqual({ value: '900000', digit: 0, done: false });
    expect(enterDigit({ value: '900000', digit: 0 }, 'previous').value).toBe('000000');
  });
  it('moves between the six digits with left and right, round the ends', () => {
    expect(enterDigit({ value: '000000', digit: 5 }, 'right').digit).toBe(0);
    expect(enterDigit({ value: '000000', digit: 0 }, 'left').digit).toBe(5);
  });
  it('types a whole code, and A or B ends it with the code kept', () => {
    const up = (n: number) => Array<UiAction>(n).fill('previous');
    const entry = run({ value: '', digit: 0 }, [...up(1), 'right', ...up(2), 'right', ...up(3), 'right', ...up(4), 'right', ...up(5), 'right', ...up(6)]);
    expect(entry.value).toBe('123456');
    expect(enterDigit(entry, 'confirm')).toEqual({ value: '123456', digit: 5, done: true });
    expect(enterDigit(entry, 'back').done).toBe(true);
  });
  it('changes nothing for the other buttons (Y, LB, RB), and keeps only digits, six of them', () => {
    for (const action of ['extra', 'tabPrevious', 'tabNext'] as UiAction[]) expect(enterDigit({ value: '123456', digit: 2 }, action)).toEqual({ value: '123456', digit: 2, done: false });
    expect(enterDigit({ value: '12a3', digit: 9 }, 'previous')).toEqual({ value: '123100', digit: 3, done: false });
    expect(enterDigit({ value: '1234567', digit: 0 }, 'right').value).toBe('123456');
  });
});

describe('tabs and pages turned with LB / RB', () => {
  it('go one along and round the ends; from nowhere RB starts at the first and LB at the last', () => {
    const tabs = ['shop', 'rewards', 'locker', 'account'];
    expect(stepRound(tabs, 'shop', 1)).toBe('rewards');
    expect(stepRound(tabs, 'account', 1)).toBe('shop');
    expect(stepRound(tabs, 'shop', -1)).toBe('account');
    expect(stepRound(tabs, 'home', 1)).toBe('shop');
    expect(stepRound(tabs, undefined, -1)).toBe('account');
    expect(stepRound([], 'x', 1)).toBeUndefined();
    expect(stepRound([1, 2, 3], 3, 1)).toBe(1);
  });
});

describe('a page beside the game', () => {
  it('opens in a new tab unless a pad pressed for it', () => {
    const opened: string[] = [];
    openPage('/terms.html', 'TERMS OF USE', false, url => opened.push(url));
    expect(opened).toEqual(['/terms.html']);
  });
  it('scrolls a line with the D-pad and most of a screen with LB / RB', () => {
    expect(scrollFor('next', 800)).toBe(SCROLL_STEP);
    expect(scrollFor('previous', 800)).toBe(-SCROLL_STEP);
    expect(scrollFor('tabNext', 800)).toBe(680);
    expect(scrollFor('tabPrevious', 100)).toBe(-SCROLL_STEP);
    expect(scrollFor('left', 800)).toBe(0);
  });
  it('is how the legal pages, the account\'s privacy page and the Discord invite open', () => {
    expect(readFileSync('src/ui/legal.ts', 'utf8')).not.toMatch(/window\.open/);
    expect(readFileSync('src/ui/shop/accountPanel.ts', 'utf8')).not.toMatch(/window\.open\('\/privacy/);
    expect(readFileSync('src/ui/social/discord.ts', 'utf8')).toMatch(/openPage\(DISCORD_INVITE/);
  });
});

describe('the pad wired through the page (main.ts)', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  it('gives an open page, then the notice, the pad first; the Account before the home under it', () => {
    const ui = main.slice(main.indexOf('input.onUiAction='), main.indexOf('\n', main.indexOf('input.onUiAction=')));
    expect(ui.indexOf('pageViewerController(action)')).toBeGreaterThan(-1);
    expect(ui.indexOf('pageViewerController(action)')).toBeLessThan(ui.indexOf('noticeController(action)'));
    expect(ui.indexOf('noticeController(action)')).toBeLessThan(ui.indexOf('shell.controller(action)'));
    expect(ui.indexOf('shopController(action)')).toBeLessThan(ui.indexOf('hud.controllerAction(action)'));
    expect(main).toMatch(/source==='controller'&&\(closePageViewer\(\)\|\|closeNotice\(\)\)/);
  });
  it('still reads the pad while a paused match rests its frames behind the pause menu', () => {
    const covered = main.split('\n').find(line => line.includes('if(covered&&canvasSize===drawnSize)'))!;
    expect(covered).toMatch(/input\.enabled=false;input\.update\(0\)/);
    expect(main).toMatch(/input\.update\(dt\);hud\.keepPadFocus\(\)/);
  });
  it('lets the notice\'s own presses come through main.ts, not a loop of its own', () => {
    const notice = readFileSync('src/ui/firstVisit.ts', 'utf8');
    expect(notice).not.toMatch(/getGamepads/);
    expect(notice).toMatch(/export function noticeController/);
  });
});

describe('a bug report from a pad', () => {
  it('chooses what happened with D← D→ on an empty box, round the list, and never overwrites the player\'s own words', async () => {
    const { PAD_REPORTS, nextReport } = await import('../src/ui/BugReport');
    expect(nextReport('', 1)).toBe(PAD_REPORTS[0]);
    expect(nextReport('', -1)).toBe(PAD_REPORTS.at(-1));
    expect(nextReport(PAD_REPORTS[0], 1)).toBe(PAD_REPORTS[1]);
    expect(nextReport(PAD_REPORTS.at(-1)!, 1)).toBe(PAD_REPORTS[0]);
    expect(nextReport('It crashed when I pressed jump', 1)).toBeUndefined();
    // Each is long enough to pass the report's own check (eight characters).
    for (const line of PAD_REPORTS) expect(line.length).toBeGreaterThanOrEqual(8);
  });
});
