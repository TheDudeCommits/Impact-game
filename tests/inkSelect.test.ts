import { describe, expect, it } from 'vitest';
import { fighterCaption, HOME_ROSTER } from '../src/ui/MangaHome';
import { homeOptions, QUALITY_OPTIONS } from '../src/ui/HomePanels';
import { pauseMenu } from '../src/ui/PauseMenu';
import { customControls } from '../src/ui/social/CustomControls';
import { defaultRules } from '../src/game/social/custom';
import { loadSettings } from '../src/config';
import { ORIGINALS } from '../src/originals/roster';
describe('the game\'s own pickers and captions', () => {
  it('puts no native select in the settings menus or the room rules', () => {
    const settings = loadSettings();
    const markup = [homeOptions(settings), pauseMenu(settings), customControls({ mode: 'royale', rules: defaultRules('royale'), votes: {} } as never, true, 'me', true, true)];
    for (const html of markup) { expect(html).not.toMatch(/<select/); expect(html).toMatch(/<ink-select/); }
    // The pause menu and the home's OPTIONS read one list of graphics levels.
    for (const html of markup.slice(0, 2)) for (const [value] of QUALITY_OPTIONS) expect(html).toContain(`<option value="${value}"`);
  });
  it('captions every fighter by name, never by a hyphenated id', () => {
    expect(fighterCaption('wuming')).toBe(ORIGINALS['wuming'] ? 'WUMING' : 'WUMING');
    expect(fighterCaption('rook')).toBe(ORIGINALS['rook'] ? 'ROOK' : 'ROOK');
    expect(fighterCaption('dorado')).toBe(ORIGINALS.dorado ? ORIGINALS.dorado.name.toUpperCase() : 'DORADO');
    expect(fighterCaption('tobari')).toBe(ORIGINALS.tobari ? 'TOBARI' : 'TOBARI');
    for (const id of HOME_ROSTER) expect(fighterCaption(id)).not.toMatch(/-/);
  });
});
