import { afterEach, describe, expect, it, vi } from 'vitest';
import { ballRulesOf, pageBallRules, sportPage } from './sportRules';
import { volleyballWanted } from './volley';
import { footballWanted } from '../../render/ball/footballPage';

describe('which rules a page\'s ball matches play (football and volleyball the default)', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('plays the sport rules on a page with nothing in the address, on any host, Player Two\'s copy too', () => {
    for (const url of ['https://impact.playertwo.cc/~b1/index.html', 'https://play.example.com/', 'http://127.0.0.1:5398/?ballpilot']) {
      vi.stubGlobal('location', new URL(url));
      expect(pageBallRules(), url).toBe('sport'); expect(sportPage(), url).toBe(true);
      expect(footballWanted(location), url).toBe(true); expect(volleyballWanted(location), url).toBe(true);
    }
  });
  it('plays the classic rules with `?classic`, and the old `?football` / `?volleyball` change nothing', () => {
    expect(ballRulesOf({ search: '?classic' })).toBe('classic');
    expect(ballRulesOf({ search: '?ballpilot&classic&balllength=60' })).toBe('classic');
    expect(ballRulesOf({ search: '?football' })).toBe('sport'); expect(ballRulesOf({ search: '?volleyball' })).toBe('sport');
    expect(ballRulesOf({ search: '?football&classic' })).toBe('classic');
    vi.stubGlobal('location', new URL('https://impact.playertwo.cc/~b1/index.html?classic'));
    expect(sportPage()).toBe(false); expect(footballWanted(location)).toBe(false); expect(volleyballWanted(location)).toBe(false);
  });
  it('keeps today\'s answers under node (no address: the match server, the packager, the tests)', () => {
    expect(typeof location).toBe('undefined');
    expect(pageBallRules()).toBe('classic'); expect(sportPage()).toBe(false);
    expect(ballRulesOf(undefined)).toBe('classic'); expect(footballWanted(undefined)).toBe(false); expect(volleyballWanted(undefined)).toBe(false);
  });
});
