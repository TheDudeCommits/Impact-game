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
  it('names no body, and words only your touches - small, beside the contact, gone in half a second', async () => {
    expect(read('../../render/ball/BallField.ts')).toMatch(/view\.volley\?noTag:/);
    expect(read('../../render/ball/touchWord.ts')).toMatch(/if \(e\.actorId !== selfId\) continue;/);
    const {TOUCH_WORD} = await import('../../render/ball/touchWord');
    expect(TOUCH_WORD.seconds).toBeLessThanOrEqual(.5);
    expect(read('./ballHud.css')).toMatch(/\.vb-word\.on\{animation:vb-word \.5s/);
  });
  // The court keeps no floor marks under the volleyball rules (a kill's crack or a dive's skid would build up into
  // black scars), and the phone's dash says DIVE there.
  it('draws a block in the air at the net as the block take on these rules, kit or not - not the fighter\'s own guard', () => {
    const moves = read('../../render/ball/ballMoves.ts');
    expect(moves).toMatch(/const block = !!vol && !state\.grounded && !swinging && \(state\.action === 'guard' \|\| vol\.prompt\?\.\[state\.id\] === 'BLOCK'\);/);
    expect(moves).toMatch(/key: forced \?\? \(block \? 'SS\.wall' :/);
    expect(moves).toMatch(/!\(kit \|\| tap \|\| forced \|\| block\)/);
  });
  it('lays no marks on volleyball\'s court and names the phone\'s dash DIVE', () => {
    expect(read('../../render/ball/BallField.ts')).toMatch(/this\.lastView\?\.volley\)return;/);
    expect(read('../../input/sportTouch.ts')).toMatch(/run: \{ action: 'dash', label: 'DIVE', glyph: 'dive'/);
  });
});
