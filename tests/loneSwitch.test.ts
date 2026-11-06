import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

/** A lone player's switch to the device match (src/ui/modes/loneQueue.ts, main.ts playLocally): the royale is played where
 *  the room was dealt, so the place stays loaded through the switch instead of being let go and built again from its files. */
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

describe('the lone switch keeps the place', () => {
  it('keeps it only while it goes home for the device match, and only for a royale at that place', () => {
    const play = main.slice(main.indexOf('function playLocally('), main.indexOf('\n', main.indexOf('function playLocally(')));
    expect(play).toMatch(/keepPlace=local\.kind==='bots'\?local\.place\?\?null:null;try\{returnToLobby\(\);\}finally\{keepPlace=null;\}/);
    // Asked before it starts the device match, so the match finds the place still shown.
    expect(play.indexOf('returnToLobby()')).toBeLessThan(play.indexOf('hud.onStart('));
  });
  it('lets every other trip home release the stages, as before', () => {
    const want = main.slice(main.indexOf('function wantStage('), main.indexOf('if(stage===stageWanted)return;', main.indexOf('function wantStage(')));
    expect(want).toMatch(/if\(!started&&stage==='harbor'&&keepPlace&&keepPlace===stageShown\)\{stageWanted=null;return;\}/);
    expect(want).toMatch(/if\(!started&&stage==='harbor'\)\{stageWanted=stageShown=null;stages\.releaseAll\(\);view\.applyStage\(STAGES\.harbor\);return;\}/);
    // stageWanted is let go, so the device match's wantStage runs whole: its collision, its notice, applyStage.
    expect(main).toMatch(/if\(stage===stageWanted\)return;\s*stageWanted=stage;\s*ensureLocalCollision\(stage\);/);
  });
  it('declares the flag before anything can ask wantStage (a module-level let read early would throw)', () => {
    expect(main.indexOf('let keepPlace:StageId|null=null;')).toBeGreaterThan(-1);
    expect(main.indexOf('let keepPlace:StageId|null=null;')).toBeLessThan(main.indexOf('function wantStage('));
  });
});
