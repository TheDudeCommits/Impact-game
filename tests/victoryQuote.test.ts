import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatAudio } from '../src/audio/CombatAudio';
import { HOME_VOICES } from '../src/audio/HomeVoice';
import { FIGHTERS } from '../src/config';
import { situationLines } from '../src/audio/voiceSituations';
import { fighterShown } from '../src/originals/launch';

/** The feel pass, iteration thirteen: the winner says their own line over their victory pose - the line the
 *  home screen plays for them (audio/HomeVoice.ts) - after the announcer's VICTORY!, without cutting it. */
class Param { value = 1; setValueAtTime() { return this; } linearRampToValueAtTime() { return this; } setTargetAtTime() { return this; } cancelScheduledValues() { return this; } cancelAndHoldAtTime() { return this; } }
class Node { gain = new Param(); pan = new Param(); frequency = new Param(); Q = new Param(); type = ''; connect(to: Node) { return to; } disconnect() {} }
class Source extends Node { buffer?: unknown; playbackRate = new Param(); loop = false; loopStart = 0; loopEnd = 0; onended?: () => void; start() {} stop() {} }
class Context {
  currentTime = 5; state = 'running'; destination = new Node(); sampleRate = 48000;
  createGain() { return new Node(); } createStereoPanner() { return new Node(); } createBufferSource() { return new Source(); }
  createDynamicsCompressor() { return Object.assign(new Node(), { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param() }); }
  resume() { return Promise.resolve(); } close() { return Promise.resolve(); } decodeAudioData() { return Promise.resolve({ duration: 2 }); }
}
describe('the winner\'s line', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('is every core fighter\'s home line', () => {
    for (const id of ['taisei', 'konta', 'gummy', 'kenzo', 'shiden', 'ouga', 'nigo'] as const) {
      expect(HOME_VOICES[id], id).toBeDefined();
      expect(fs.existsSync(`public${HOME_VOICES[id]}`), id).toBe(true);
    }
    expect(Object.keys(HOME_VOICES).every(id => id in FIGHTERS || ['shanxiao', 'yodaka'].includes(id))).toBe(true);
  });
  it('plays on the voice bus under its own owner, after the announcer, which it leaves alone', async () => {
    vi.stubGlobal('AudioContext', Context);
    vi.stubGlobal('fetch', async () => ({ ok: true, headers: { get: () => 'audio/mp4' }, arrayBuffer: async () => new ArrayBuffer(8), json: async () => ({}) }));
    const audio = new CombatAudio();
    await audio.unlock();
    const sample = vi.spyOn(audio, 'sample');
    audio.quote(HOME_VOICES.taisei!, .85, 1.9);
    expect(sample).toHaveBeenCalledWith(HOME_VOICES.taisei, expect.anything(), .85, 1, 'victory', 7, 1.9, 'voice');
    audio.dispose();
  });
  it('is still every fighter\'s home line unless they have a win line of their own, and nobody wins in silence', async () => {
    vi.stubGlobal('AudioContext', Context);
    vi.stubGlobal('fetch', async () => ({ ok: true, headers: { get: () => 'audio/mp4' }, arrayBuffer: async () => new ArrayBuffer(8), json: async () => ({}) }));
    const audio = new CombatAudio();
    await audio.unlock(); await audio.ready(2000);
    const fighters = (Object.keys(FIGHTERS) as (keyof typeof FIGHTERS)[]).filter(fighterShown);
    const own = fighters.filter(id => situationLines(id, 'win').length), home = fighters.filter(id => !situationLines(id, 'win').length);
    // (Both groups are read from the data: the cutting batches move fighters from the second to the first, forty in the
    // first three. What is held is that the two together are the whole roster and that each is handled as below.)
    expect(own.length).toBeGreaterThan(15); expect(own.length + home.length).toBe(fighters.length);
    for (const id of home) {
      // No line of their own: `winLine` says nothing and leaves the finale's clock alone, so main.ts says the home line.
      expect(audio.winLine(id, 1.9), id).toBeUndefined();
      expect(audio.winSeconds(id), id).toBeUndefined();
      expect(HOME_VOICES[id], `${id} has a home line to win with`).toBeDefined();
    }
    for (const id of own) {
      const seconds = audio.winSeconds(id);
      expect(seconds, id).toBeGreaterThan(.3);
      expect(audio.winLine(id, 1.9), id).toBeCloseTo(seconds!);
    }
    audio.dispose();
  });
  // The finale (10 October 2026, src/ui/results/finale.ts): every versus mode's winner says it over their pose before the
  // results - Bad Blood's and Last Stand's too, a fighter of the winning side - never Arcade Survival's horde. It starts
  // at FINALE.lineAt on the winning side's pages, which the finale is timed on.
  it('is said at the win in every versus mode, timed with the finale, and fetched with the room', () => {
    const main = fs.readFileSync('src/main.ts', 'utf8');
    // (The voice situations, 12 October 2026: a winner with a `win` line of their own says that instead - CombatAudio.winLine,
    // at the same moment - and every other winner says their home line by the statement this always was.)
    expect(main).toContain("if(!survival()){const line=HOME_VOICES[winner.state.fighter],own=audio.winLine(winner.state.fighter,mine?1.9:.8);if(own===undefined&&line)audio.quote(line,.85,mine?1.9:.8);");
    // The finale's clock reads the line that is said: the win line's length, else the home line's as before.
    expect(main).toContain("return audio.winSeconds(fighter)??(url?audio.sampleSeconds(url):undefined)??HOME_VOICE_SECONDS[fighter];");
    expect(main).toContain('const champion=snapshot.status===\'finished\'?finaleWinner(snapshot):undefined;');
    expect(main).toContain('audio.preload(ids.map(id=>HOME_VOICES[id])');
  });
});
