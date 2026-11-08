import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NOTICE_LINES, NOTICE_VERSION, noticeHtml } from '../src/ui/firstVisit';
import { CONTACT, FAN_MADE, PRIVACY_PAGE, REPO_PAGE, TERMS_PAGE } from '../src/ui/legalLinks';
import { legalPage } from '../src/ui/legal';
import { EARNED_LINE } from '../src/game/economy/currency';
import { brandPrivacyHtml, brandTermsHtml } from '../scripts/build/brandPlugin';
import { TITLE } from '../src/originals/brand';

const terms = brandTermsHtml(readFileSync('public/terms.html', 'utf8')), privacy = brandPrivacyHtml(readFileSync('public/privacy.html', 'utf8'));
const text = terms.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

describe('the terms of use', () => {
  it('says what the game is, in the words the rest of the site uses', () => {
    expect(terms).toContain(`<title>Terms of Use — ${TITLE}</title>`);
    expect(terms).toContain('<h1>Terms of Use</h1>');
    expect(text).toContain(FAN_MADE);
    expect(text).toMatch(/free to play/i);
    expect(text).toMatch(/no monetization whatsoever: nothing is sold, there are no ads, and there never will be/);
    expect(text).toMatch(/It is open source ?\./);
    // The one GitHub address in the terms is the game's own repository (legalLinks.ts REPO_PAGE): "open source" and the footer.
    expect([...terms.matchAll(/href="(https:\/\/github\.com[^"]*)"/g)].map(m => m[1])).toEqual([REPO_PAGE, REPO_PAGE]);
  });

  it('is provided as it is: no warranty, no liability, and it may change or go offline at any time', () => {
    expect(text).toMatch(/as it is and as it is available/);
    expect(text).toMatch(/no warranty of any kind/);
    expect(text).toMatch(/not liable/);
    expect(text).toMatch(/go offline, for a while or for good, at any time and without notice/);
  });

  it('says how to behave: no cheating or exploiting, harassment, impersonation, offensive names or attacks on the service', () => {
    for (const rule of [/cheat or exploit/, /harass/, /impersonate/, /name that is hateful, sexual, abusive or otherwise offensive/, /attack the service/]) expect(text).toMatch(rule);
  });

  it('keeps the right to remove accounts, names and content, and to reset progress', () => {
    expect(text).toMatch(/remove, rename, suspend or delete any account, username or other content/);
    expect(text).toMatch(/at its discretion/);
    expect(text).toMatch(/Progress can be reset at any time/);
  });

  it('says players own nothing, and that Sumi and unlocks have no value and cannot be bought, sold or transferred', () => {
    expect(text).toMatch(/You own nothing in the game\./);
    expect(text).toMatch(/Sumi and unlocks have no monetary value\./);
    expect(text.split(EARNED_LINE).length - 1).toBe(2);
    expect(text).toMatch(/cannot be bought, sold, traded, transferred or exchanged for money or anything else/);
  });

  it('covers what players make and share (a username, a Forge fighter, its link) with a licence and a removal clause', () => {
    expect(text).toMatch(/What you make and share:/);
    expect(text).toMatch(/You may share only what you have the right to share/);
    expect(text).toMatch(/you let the project store it, show it and let other players use it, free of charge, for as long as it is kept/);
    expect(text).toMatch(/the project may remove it at any time, for any reason, including at the request of a rights holder/);
    // (The clip function is gone: the terms do not speak of clips.)
    expect(text).not.toMatch(/\bclips?\b/i);
  });

  it('tells a rights holder where a takedown goes and what to say, and that it is answered promptly', () => {
    expect(terms).toContain(`mailto:${CONTACT}`);
    for (const ask of [/what the material is/, /where it appears/, /who you are/]) expect(text).toMatch(ask);
    expect(text).toMatch(/Requests are answered promptly and the material is removed promptly/);
  });

  it("says the age the privacy page says, in the privacy page's words", () => {
    const age = new RegExp(`${TITLE} is meant for players aged 13 and over\\. If you are younger, or below the age your country sets for this, play only with a parent's or guardian's permission\\.`);
    expect(text).toMatch(age);
    expect(privacy.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).toMatch(age);
  });

  it('says how it changes and whom to write to, and names no company, address, governing law or court', () => {
    expect(text).toMatch(/If these terms change, this page changes with them, and the date at the top moves/);
    expect(text).toMatch(/Last updated 12 October 2026\./);
    expect(text).not.toMatch(/\b(LLC|Ltd|Inc\.|GmbH|governing ward|governed by|jurisdiction|courts? of|arbitrat\w+|registered office)\b/i);
  });

  it("is in the privacy page's hand: the same stylesheet, a way back, and every section numbered", () => {
    const style = (page: string) => page.match(/<style>([\s\S]*?)<\/style>/)![1];
    expect(style(terms)).toBe(style(privacy));
    expect(terms).toContain('<a class="back" href="index.html">← BACK TO THE GAME</a>'); // (relative to the page)
    expect([...terms.matchAll(/<h2 id="[a-z]+"><small>(\d\d)<\/small>/g)].map(m => m[1])).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09']);
  });

  it('is linked from the legal and privacy page and links back', () => {
    expect(TERMS_PAGE).toBe('terms.html'); // relative to the game's own page
    if (/terms\.html/.test(privacy)) expect(privacy.match(/href="terms\.html"/g)!.length).toBeGreaterThanOrEqual(2);
    expect(terms.match(/href="privacy\.html(#keep)?"/g)!.length).toBeGreaterThanOrEqual(2);
    expect(privacy).toContain('id="keep"');
  });

  it("has its row on Options' LEGAL page, beside PRIVACY, and opens in a new tab", () => {
    const page = legalPage();
    expect(page).toMatch(/data-open-terms data-focus="terms">TERMS OF USE/);
    expect(page.indexOf('data-open-terms')).toBeLessThan(page.indexOf('data-open-privacy'));
    // (In a new tab: pageViewer.ts openPage opens one, unless a pad pressed for it - a pad cannot close a tab - when it
    // shows the page over the game instead.)
    expect(readFileSync('src/ui/legal.ts', 'utf8')).toMatch(/closest\('\[data-open-terms\]'\)\) openPage\(TERMS_PAGE, 'TERMS OF USE'\)/);
    expect(readFileSync('src/ui/pageViewer.ts', 'utf8')).toMatch(/window\.open\(each, '_blank', 'noopener'\)/);
  });

  it('is accepted by playing: one small line under the notice\'s small print, its last three words the link, the buttons still three', () => {
    const html = noticeHtml();
    expect(html).toContain(`<p class="first-visit-small first-visit-terms">By playing you accept the <a href="${TERMS_PAGE}" target="_blank" rel="noopener" data-focus="notice-terms">terms of use</a>.</p>`);
    expect(NOTICE_LINES.terms).toBe('By playing you accept the');
    expect(html.indexOf('first-visit-terms')).toBeGreaterThan(html.indexOf(FAN_MADE));
    expect(html.indexOf('first-visit-terms')).toBeLessThan(html.indexOf('first-visit-links'));
    expect([...html.matchAll(/class="first-visit-link"/g)]).toHaveLength(3); // legal and privacy, credits, source code
    expect(html).toContain(`href="${PRIVACY_PAGE}"`);
    // (What the notice says changed, so it is shown once more to whoever read the first one.)
    expect(NOTICE_VERSION).toBe('2');
  });

});
