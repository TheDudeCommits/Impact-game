import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NOTICE_LINES, noticeDue, noticeHtml } from '../src/ui/firstVisit';
import { CONTACT, CREDITS_PAGE, FAN_MADE, PRIVACY_PAGE } from '../src/ui/legalLinks';
import { brandPrivacyHtml } from '../scripts/build/brandPlugin';
import { TITLE } from '../src/originals/brand';

const shows = noticeDue({ webdriver: false, forced: true });

describe('the first-visit notice', () => {
  it.skipIf(!shows)('says what the design asked it to say, with the address a takedown goes to', () => {
    const html = noticeHtml();
    expect(html).toContain('open-source arena fighter');
    expect(html).toContain('open source');
    expect(html).toMatch(/no monetization whatsoever, and it never will/);
    expect(html).toContain(`mailto:${CONTACT}`);
    expect(html).toContain(NOTICE_LINES.promise);
    expect(html).toContain(FAN_MADE);
    expect(html).toContain(`${TITLE} is a free, open-source arena fighter`);
    expect(html).toContain('original fighters made for it');
    expect(html).not.toMatch(/these characters|grew up watching|not affiliated/);
  });

  it('carries its two ways out: legal and privacy, and the credits, each in a new tab; no GitHub button', () => {
    const html = noticeHtml(), links = [...html.matchAll(/<a class="first-visit-link" href="([^"]+)" target="_blank" rel="noopener"/g)].map(m => m[1]);
    expect(links).toEqual([PRIVACY_PAGE, CREDITS_PAGE]);
    expect(html).not.toMatch(/github\.com/i);
    expect(html).not.toMatch(/GITHUB/i);
    expect(html).toContain('LEGAL &amp; PRIVACY');
    expect(html).toMatch(/class="first-visit-go"/);
  });

  it('shows every time the game opens, and never to an automated browser unless it is asked for', () => {
    expect(noticeDue({ webdriver: false, forced: false })).toBe(shows);
    expect(noticeDue({ webdriver: true, forced: false })).toBe(false);
    expect(noticeDue({ webdriver: true, forced: true })).toBe(shows);
  });

  it('is mounted by the page, and the page it calls legal and privacy says what the notice says', () => {
    expect(readFileSync('src/main.ts', 'utf8')).toMatch(/mountFirstVisit\(\)/);
    const page = brandPrivacyHtml(readFileSync('public/privacy.html', 'utf8'));
    expect(page).toContain(`mailto:${CONTACT}`);
    expect(page).not.toMatch(/github\.com/i);                 // no source link since 28 October 2026
    const terms = readFileSync('public/terms.html', 'utf8');
    if (shows) for (const words of ['open-source', 'open source', 'no monetization', 'removed promptly']) expect(terms, words).toContain(words);
  });
});
