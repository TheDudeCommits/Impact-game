import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Less on screen on the volleyball rules - no HEAT word (the ball has none to show), the dash's bar named DIVE (it
// is the dive), no name over any body, a tier word only for the person's touches and anyone's PERFECT. Pinned in the
// source: these are DOM and WebGL pieces the node tests do not draw.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('the volleyball rules\' screen', () => {
  it('shows no HEAT word and calls the dash\'s bar DIVE, set before the stance\'s early way out', () => {
    const hud = read('./BallHud.ts');
    expect(hud).toMatch(/this\.heat\.set\(v\.football \|\| v\.volley \? 'none'/);
    expect(hud).toMatch(/this\.heatLabel\.set\(v\.football \|\| v\.volley \? ''/);
    const dive = hud.indexOf("if (v.volley) this.boostName.set('DIVE');"), out = hud.indexOf("if (!stances) {");
    expect(dive).toBeGreaterThan(0); expect(dive).toBeLessThan(out);
  });
  it('names no body, and words only your touches and a PERFECT one', () => {
    expect(read('../../render/ball/BallField.ts')).toMatch(/view\.volley\?noTag:undefined/);
    expect(read('../../render/ball/touchWord.ts')).toMatch(/if \(e\.actorId !== selfId && tier !== 'PERFECT'\) continue;/);
  });
});
