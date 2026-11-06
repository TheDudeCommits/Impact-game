import { describe, expect, it } from 'vitest';
import { creditsPage, declaredPackages, inline, markdown } from '../scripts/build/credits';
import { CONTACT, FAN_MADE, SITE_TITLE } from '../src/ui/legalLinks';

const SAMPLE = `# Credits

Third-party assets the game ships.

## Models

| Asset | Author | Licence |
| --- | --- | --- |
| [Stone Bridge](https://example.com/bridge) | **Jane** | CC BY 4.0 |

- A sound <by> someone, [link](https://example.com/s)
- \`public/assets/x.glb\`: CC0
`;

describe('the credits page (CREDITS.md drawn as a page)', () => {
  it('draws headings, paragraphs, tables, lists and links, and escapes the rest', () => {
    const html = markdown(SAMPLE);
    expect(html).toContain('<h2>Credits</h2>');
    expect(html).toContain('<h3>Models</h3>');
    expect(html).toContain('<th>Asset</th>');
    expect(html).toContain('<a href="https://example.com/bridge" target="_blank" rel="noopener">Stone Bridge</a>');
    expect(html).toContain('<b>Jane</b>');
    expect(html).toContain('A sound &lt;by&gt; someone');
    expect(html).toContain('<code>public/assets/x.glb</code>');
    expect(inline('a [b](javascript:alert(1)) c')).not.toContain('href="javascript');
  });

  it('carries the game\'s title, its line and its contact, and the packages it is built with', () => {
    const page = creditsPage({ date: '6 November 2026', commit: 'test', software: declaredPackages() }, SAMPLE);
    expect(page).toContain(`<title>Credits — ${SITE_TITLE}</title>`);
    expect(page).toContain(FAN_MADE);
    expect(page).toContain(`mailto:${CONTACT}`);
    expect(page).toContain('Stone Bridge');
    expect(page).toContain('three');
  });

  it('still makes a page with no CREDITS.md', () => {
    expect(creditsPage({ date: '6 November 2026', software: [] }, '')).toContain('No third-party asset is listed yet.');
  });
});
