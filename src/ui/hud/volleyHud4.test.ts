import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// So the play is easy to follow - who is who, where the ball is, when to press: on the volleyball rules a point's words
// are short and small under the score bug, the prompt is in the plain HUD face with a timing bar, nothing says FEVER,
// the person wears one arrow over the head and one ring on the floor, nobody else a ring, and a phone's score bug is
// bigger. Pinned in the source and the CSS: these are DOM and WebGL pieces the node tests do not draw.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('the volleyball rules\' screen', () => {
  it('shows a point\'s words for about 0.6 s, small, under the score bug', async () => {
    const hud = read('./BallHud.ts');
    const { VOLLEY_POINT_MS } = await import('./BallHud');
    expect(VOLLEY_POINT_MS).toBeGreaterThanOrEqual(500); expect(VOLLEY_POINT_MS).toBeLessThanOrEqual(700);
    // (Every point's banner: a kill, a serve's point, an OUT, FOUR TOUCHES.)
    expect(hud.match(/v\.volley \? VOLLEY_POINT_MS/g)?.length).toBe(4);
    const css = read('./ballHud.css');
    expect(css).toMatch(/#interface\[data-ball-volley\] \.bh-banner strong\{font-size:calc\(44 \* var\(--bh-u\)\)\}/);
  }, 30000);
  it('sets the prompt in the plain HUD face, bold and bigger, with a timing bar that fills to the moment to press', async () => {
    const css = read('./ballHud.css'), hud = read('./BallHud.ts');
    expect(css).toMatch(/\.bh-prompt\.hk-slip\{font:800 calc\(32 \* var\(--bh-u\)\)\/1\.1 var\(--hl-sans/);
    expect(css).not.toMatch(/\.bh-prompt\.hk-slip\{[^}]*--hl-display/);
    expect(css).toMatch(/\.bh-timer\.now i\{background:var\(--bh-gold\)\}/);
    expect(hud).toMatch(/kind: 'touch', at: performance\.now\(\) \+ \(vol\.at - VOLLEY\.contact - f\.snapshot\.serverTime\) \* 1000/);
    expect(hud).toMatch(/now = Math\.abs\(left\) <= VOLLEY\.tier\.perfect/);
    const { VOLLEY_TIMER } = await import('./BallHud');
    expect(VOLLEY_TIMER.lead).toBeGreaterThan(.6);
  }, 30000);
  it('says nothing of FEVER and counts every point one', () => {
    const match = read('../../game/ball/BallMatch.ts');
    expect(match).toMatch(/if \(this\.view\.rally >= SPIKE_RULES\.fever && !this\.feverTold && !this\.volley\) \{/);
    expect(match).toMatch(/if \(this\.view\.mutator === 'sudden-death' && !this\.volley\) \{ this\.view\.fever = true;/);
    expect(match).toMatch(/if \(!this\.view\.fever \|\| this\.volley\) return 1;/);
  });
  it('marks the person with the arrow over the head and one ring underfoot, and nobody else on the floor', () => {
    expect(read('../../render/ball/footballPage.ts')).toMatch(/if \(!\(view\?\.football \|\| view\?\.volley\) \|\| view\.replay/);
    expect(read('../../render/ball/BallField.ts')).toMatch(/if\(own\|\|!volley\)fx\.put\(K\.side,/);
  });
  it('makes the score bug and the bars bigger on a phone on its side', () => {
    const css = read('./ballHud.css');
    expect(css).toMatch(/The volleyball rules' screen[^]*@media \(orientation:landscape\) and \(max-height:520px\)\{\s*#interface\[data-hud="sky-spike"\]\[data-ball-volley\]\{--bh-u:min\(\.64px,\.165vh\)\}/);
    expect(css).toMatch(/\[data-ball-volley\]\[data-volley\] \.bh-board\{--bh-bug:60\}/);
  });
});
