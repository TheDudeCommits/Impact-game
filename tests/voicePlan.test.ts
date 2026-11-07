import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { AUDIO_CUES, cueDuration, planCombatAudio, type AudioCue, type CueLayer } from '../src/audio/cuePlan';
import { AWAKENED_HEAVY_PRIORITY, BIG_BANG_PRIORITY, EFFORT_CHANCE, LIGHT_CALL_CHANCE, LIGHT_CALL_COOLDOWN, planVoice, resetVoiceMemory, SUPER_LINE_PRIORITY, voiceRoll } from '../src/audio/voicePlan';
import { VOICE_CUES } from '../src/audio/voiceCues';
import { AFTER_BURST, AWAKENING_LINES } from '../src/audio/awakeningLines';
import { GOLDEN_SAGE, SUPER_OUGA } from '../src/audio/goldAwakeningTiming';
import { AWAKENING_ENTRY, awakeningSwapAt, moveFor } from '../src/game/awakening';
import { MOVES, RUSH_STAGES } from '../src/game/moves';
import { barrageWindow } from '../src/game/timeStopBarrage';
import type { AttackSlot, CombatEvent, FighterId } from '../src/game/types';
import { isReleasedFighter } from '../src/game/rosterAvailability';
import { ORIGINALS } from '../src/originals/roster';
import ORIGINAL_VOICE_DATA from '../src/originals/voices.json';
const ORIGINAL_VOICES = (ORIGINAL_VOICE_DATA as unknown as { cues: Record<string, { file: string; text: string } | undefined> }).cues;


const FIGHTERS = Object.keys(MOVES) as FighterId[];
/** The lights that are named by a callout, and the callout. */
const LIGHT_CALLS: Partial<Record<FighterId, AudioCue>> = { 'rakucho':'vo-rakucho-my-turn', shidare:'vo-shidare-ready', kenzo: 'vo-kenzo-crossing', kagari: 'kagari-hinoko', gummy: 'gummy-pistol',
  'basilissa':'vo-basilissa-thorn-kiss', buna:'vo-buna-lets-go', adad:'vo-adad-enough',
  // The shop's four whose lights are named (voicePlan.ts): with efforts between their callouts since 5 October.
  gorai: 'vo-gorai-mast-breaker', shiun: 'vo-shiun-weak', magatsu: 'vo-magatsu-tch', imago: 'vo-imago-i-can-read' };

let nextId = 1;
const cast = (props: Partial<CombatEvent>): CombatEvent => {
  const id = nextId++;
  return { id, actionSeq: id, kind: 'cast', serverTime: 1, actorId: 'p1', fighter: 'kenzo', slot: 'light', chain: 0, ...props };
};
const voices = (layers: CueLayer[]) => layers.filter(l => l.bus === 'voice');

/** A fighter mashing light for `seconds`: full four-stage strings, one stage
 *  every half second, a breath between strings. Returns every stage's voice. */
function mash(fighter: FighterId, seconds: number, actorId = 'p1', from = 1, awakened = false) {
  const stages: { at: number; stage: number; voice: CueLayer[] }[] = [];
  let seq = Math.round(from * 10);
  for (let at = from; at < from + seconds;) {
    for (let stage = 0; stage < RUSH_STAGES; stage++, at += .5, seq++)
      stages.push({ at, stage, voice: voices(planVoice(cast({ id: seq, actionSeq: seq, actorId, fighter, chain: stage, serverTime: at }), awakened)) });
    at += .7;
  }
  return stages;
}

beforeEach(() => resetVoiceMemory());

describe('a named light callout is rationed', () => {
  for (const [fighter, call] of Object.entries(LIGHT_CALLS) as [FighterId, AudioCue][]) {
    it(`${fighter}: only on a string opener, never twice inside ${LIGHT_CALL_COOLDOWN} s, never on every string`, () => {
      const stages = mash(fighter, 120);
      const called = stages.filter(s => s.voice.some(l => l.cue === call));
      const strings = stages.filter(s => s.stage === 0).length;
      expect(called.length, 'it is still heard').toBeGreaterThan(0);
      expect(called.length, 'not on every string').toBeLessThan(strings);
      expect(called.every(s => s.stage === 0), 'only on the opening blow').toBe(true);
      for (let i = 1; i < called.length; i++) expect(called[i].at - called[i - 1].at).toBeGreaterThanOrEqual(LIGHT_CALL_COOLDOWN);
      expect(called.length).toBeLessThanOrEqual(Math.ceil(120 / LIGHT_CALL_COOLDOWN));
    });
  }
  it('is deterministic: the same fight is voiced the same twice', () => {
    for (const fighter of FIGHTERS) {
      const first = mash(fighter, 60).map(s => s.voice.map(l => l.cue).join());
      resetVoiceMemory();
      expect(mash(fighter, 60).map(s => s.voice.map(l => l.cue).join())).toEqual(first);
    }
  });
  it('rolls from the fighter and the cast, so prediction and authority agree', () => {
    // The predicted cast and the server's copy share the input sequence, not the id.
    const predicted = cast({ id: 1_000_000_007, actionSeq: 42, actorId: 'me', serverTime: 20 });
    const authority = { ...predicted, id: 7 };
    const a = voices(planVoice(predicted));
    resetVoiceMemory();
    expect(voices(planVoice(authority))).toEqual(a);
    // And planning the same cast twice is not two casts.
    resetVoiceMemory();
    const once = voices(planVoice(predicted)), twice = voices(planVoice(predicted));
    expect(twice).toEqual(once);
  });
  it('rolls near the chances it is tuned to', () => {
    let call = 0, effort = 0;
    for (let seq = 0; seq < 4000; seq++) {
      if (voiceRoll('bot-3', `${seq}:light:0:kenzo`, 1) < LIGHT_CALL_CHANCE) call++;
      if (voiceRoll('bot-3', `${seq}:light:0:kenzo`, 2) < EFFORT_CHANCE) effort++;
    }
    expect(call / 4000).toBeCloseTo(LIGHT_CALL_CHANCE, 1);
    expect(effort / 4000).toBeCloseTo(EFFORT_CHANCE, 1);
  });
  it('starts a new match fresh when the server clock runs back', () => {
    // A callout late in one match does not silence the next match's first minute.
    const late = mash('kenzo', 60, 'p1', 300).filter(s => s.voice.some(l => l.cue === 'vo-kenzo-crossing'));
    expect(late.length).toBeGreaterThan(0);
    const next = mash('kenzo', 60, 'p1', 0.5).filter(s => s.voice.some(l => l.cue === 'vo-kenzo-crossing'));
    expect(next.length).toBeGreaterThan(0);
    expect(next[0].at).toBeLessThan(30);
  });
});

describe('efforts between callouts', () => {
  for (const fighter of FIGHTERS) {
    it(`${fighter}: some light stages, never two running, never the same clip twice in a row`, () => {
      const stages = mash(fighter, 180);
      const call = LIGHT_CALLS[fighter];
      const efforts = stages.map(s => s.voice.find(l => l.cue !== call && l.cue !== 'kurobi-bite'));
      const voiced = efforts.filter(Boolean).length;
      expect(voiced / stages.length, 'at most ~40% of light stages').toBeLessThanOrEqual(.4);
      for (let i = 1; i < efforts.length; i++) {
        if (efforts[i] && stages[i].at - stages[i - 1].at < 1.6) expect(efforts[i - 1], `stage ${i} follows an effort`).toBeUndefined();
      }
      const clips = efforts.filter(Boolean).map(l => l!.cue);
      for (let i = 1; i < clips.length; i++) if (new Set(clips).size > 1) expect(clips[i]).not.toBe(clips[i - 1]);
      // Nothing talks over the callout it follows.
      for (let i = 0; i < stages.length; i++) {
        const spoken = stages[i].voice.find(l => l.cue === call);
        if (!spoken) continue;
        for (let j = i + 1; j < stages.length && stages[j].at < stages[i].at + cueDuration(spoken.cue); j++)
          expect(stages[j].voice, `${fighter} stage ${j} under the callout`).toEqual([]);
      }
    });
  }
  it('lands on the blow', () => {
    const stages = mash('gaunt', 60).filter(s => s.voice.length);
    for (const s of stages) for (const l of s.voice) expect(l.delay ?? 0).toBeLessThan(.5);
  });
});

describe('a light line outlives the stage pressed after it', () => {
  it('is laid down released, so the next predicted rush stage does not cut it', async () => {
    const { CombatAudio } = await import('../src/audio/CombatAudio');
    class Param { value = 1; setValueAtTime() {} linearRampToValueAtTime() {} setTargetAtTime() {} cancelScheduledValues() {} cancelAndHoldAtTime() {} }
    class Node { gain = new Param(); pan = new Param(); connect() { return this; } disconnect() {} }
    class Source extends Node { buffer?: unknown; playbackRate = new Param(); loop = false; loopStart = 0; loopEnd = 0; onended?: () => void; stops: number[] = []; start() {} stop(t: number) { this.stops.push(t); } }
    class Context { static last: Context; currentTime = 10; state = 'running'; destination = new Node(); sources: Source[] = []; constructor() { Context.last = this; } createGain() { return new Node(); } createStereoPanner() { return new Node(); } createBufferSource() { const x = new Source(); this.sources.push(x); return x; } createDynamicsCompressor() { return Object.assign(new Node(), { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param() }); } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } decodeAudioData() { return Promise.resolve({ duration: 1.3 }); } }
    const g = globalThis as unknown as Record<string, unknown>, saved = { AudioContext: g.AudioContext, fetch: g.fetch };
    g.AudioContext = Context; g.fetch = async () => ({ ok: true, headers: { get: () => 'audio/wav' }, arrayBuffer: async () => new ArrayBuffer(8) });
    try {
      const audio = new CombatAudio(); await audio.unlock();
      const me = { id: 'me', name: 'Z', fighter: 'kenzo', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 1, actionTime: 0, actionDuration: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } } as const;
      // Find an opener the plan calls out on, then press the next stage before its release.
      let seq = 1; while (!planVoice(cast({ actorId: 'probe', fighter: 'kenzo', actionSeq: seq, id: seq, serverTime: 50 })).some(l => l.cue === 'vo-kenzo-crossing')) seq++;
      resetVoiceMemory();
      audio.handle([cast({ id: 1_000_000_000 + seq, actionSeq: seq, actorId: 'probe', fighter: 'kenzo', serverTime: 50 })], 'probe', [{ ...me, id: 'probe' }]);
      const line = Context.last.sources.find((_, i) => planCombatAudio(cast({ id: 1_000_000_000 + seq, actionSeq: seq, actorId: 'probe', fighter: 'kenzo', serverTime: 50 })).findIndex(l => l.cue === 'vo-kenzo-crossing') === i)!;
      expect(line, 'the callout was scheduled').toBeDefined();
      audio.handle([cast({ id: 1_000_000_001 + seq, actionSeq: seq + 20, actorId: 'probe', fighter: 'kenzo', chain: 1, serverTime: 50.32 })], 'probe', [{ ...me, id: 'probe' }]);
      expect(line.stops, 'the next stage did not cut it').toHaveLength(1);
      audio.dispose();
    } finally { g.AudioContext = saved.AudioContext; g.fetch = saved.fetch; }
  });
});

describe('Gaunt is heard on every attack', () => {
  // "Gaunt doesn't have any voice lines on any of his attacks, fix that in the
  // same way as every other fighter's voice lines."
  it('voices his lights with efforts, and every heavy, special and ultimate', () => {
    const lights = mash('gaunt', 60).filter(s => s.voice.length);
    expect(lights.length, 'his light stages carry efforts').toBeGreaterThan(0);
    for (const slot of ['heavy', 'special', 'ultimate'] as const) for (let i = 0; i < 6; i++) {
      const layers = voices(planVoice(cast({ fighter: 'gaunt', slot, serverTime: 2 + i * 3 })));
      expect(layers.length, `${slot} ${i}`).toBeGreaterThan(0);
      expect(layers.every(l => l.cue.startsWith('vo-gaunt-')), 'in his own voice, Iwanaga\'s').toBe(true);
    }
    expect(voices(planVoice({ id: 1, kind: 'awaken', serverTime: 1, actorId: 'g', fighter: 'gaunt' })).length).toBeGreaterThan(0);
  });
  it('rotates his heavy cries, never the same twice running', () => {
    const heavies = Array.from({ length: 12 }, (_, i) => voices(planVoice(cast({ fighter: 'gaunt', slot: 'heavy', serverTime: 2 + i * 2 })))[0].cue);
    for (let i = 1; i < heavies.length; i++) expect(heavies[i]).not.toBe(heavies[i - 1]);
    expect(new Set(heavies).size).toBeGreaterThan(1);
  });
});

describe('the time-stop barrages', () => {
  /** Round 3d (ULTS): a hit-confirm ultimate's lines are split: the call goes
   *  out with the cast, and what is said inside the cinematic is planned from
   *  the release of its first blow - a release that only comes when the
   *  opener lands. Put back on the move's own timeline here. */
  const cinematic = (fighter: FighterId, awakened: boolean) => {
    const move = moveFor(fighter, 'ultimate', awakened), first = (move.timeStop?.contact ?? 0) + 1, at = move.contacts[first];
    const layers = voices(planVoice({ id: nextId++, kind: 'release', serverTime: 1 + at, actorId: 'p1', fighter, slot: 'ultimate', contactIndex: first }, awakened));
    return layers.map(l => ({ ...l, delay: (l.delay ?? 0) + at }));
  };
  for (const fighter of ['koko', 'oro'] as const) for (const awakened of [false, true]) {
    it(`${fighter} ${awakened ? 'awakened' : 'base'}: the loop covers barrageWindow and the call does not push it late`, () => {
      const move = moveFor(fighter, 'ultimate', awakened), window = barrageWindow(move)!;
      expect(window, 'the ultimate has a barrage').toBeTruthy();
      const cast_ = voices(planVoice(cast({ fighter, slot: 'ultimate', chain: undefined }), awakened));
      expect(cast_.some(l => l.loop), 'nothing of the barrage goes out with the cast: a stop that catches nobody is its call alone').toBe(false);
      const layers = [...cast_, ...cinematic(fighter, awakened)];
      const loop = layers.find(l => l.loop)!;
      expect(loop, 'a looped GAN/GILDED_PUNCH').toBeDefined();
      expect(loop.cue).toMatch(fighter === 'koko' ? /gan|barrage/ : /noroma/);
      expect(loop.delay!, 'starts right as the barrage does').toBeLessThanOrEqual(window.start);
      expect(loop.delay!).toBeGreaterThanOrEqual(window.start - .1);
      expect(loop.delay! + loop.duration!, 'and plays through it').toBeGreaterThanOrEqual(window.end);
      const call = layers.find(l => !l.loop && !l.delay)!;
      expect(call, 'the time-stop call').toBeDefined();
      expect(call.duration ?? cueDuration(call.cue), 'ends before the loop starts').toBeLessThanOrEqual(loop.delay! + 1e-9);
      // Every other spoken segment follows the one before it.
      const spoken = [...layers].sort((a, b) => (a.delay ?? 0) - (b.delay ?? 0));
      for (let i = 1; i < spoken.length; i++)
        expect(spoken[i].delay ?? 0).toBeGreaterThanOrEqual((spoken[i - 1].delay ?? 0) + (spoken[i - 1].duration ?? cueDuration(spoken[i - 1].cue)) - 1e-9);
      if (fighter === 'oro') expect(layers.some(l => l.cue.includes('steamroller')), 'Steamroller still follows').toBe(true);
    });
  }
  it('keeps the other chained lines - inside the cinematic, after the call', () => {
    for (const awakened of [false, true]) {
      for (const [fighter, line] of [['ward', 'ward-flatline'], ['setsu', 'setsu-gale-step']] as const) {
        expect(voices(planVoice(cast({ fighter, slot: 'ultimate' }), awakened)).map(l => l.cue), `${fighter}: not with the cast`).not.toContain(line);
        const said = cinematic(fighter, awakened), call = voices(planVoice(cast({ fighter, slot: 'ultimate' }), awakened))[0];
        expect(said.map(l => l.cue)).toContain(line);
        expect(said[0].delay, 'after the call has been said').toBeGreaterThanOrEqual(cueDuration(call.cue) - 1e-9);
      }
    }
  });
  it('says nothing of a cinematic on a release that is not its first blow, nor for a whiff', () => {
    for (const fighter of ['koko', 'oro', 'ward', 'setsu', 'gummy'] as FighterId[]) {
      const move = moveFor(fighter, 'ultimate', false);
      expect(voices(planVoice({ id: nextId++, kind: 'release', serverTime: 2, actorId: 'p1', fighter, slot: 'ultimate', contactIndex: 0 })), fighter).toHaveLength(0);
      expect(voices(planVoice({ id: nextId++, kind: 'release', serverTime: 2, actorId: 'p1', fighter, slot: 'ultimate', contactIndex: move.contacts.length - 1 })), fighter).toHaveLength(0);
      expect(voices(planVoice({ id: nextId++, kind: 'whiff', serverTime: 2, actorId: 'p1', fighter, slot: 'ultimate', castAge: .6 })), fighter).toHaveLength(0);
    }
  });
});

/** Where the cut's words start: 10 ms frames within 25 dB of its loudest, after 50 ms below it. */
function words(path: string) {
  const wav = readFileSync(path);
  let at = 12, rate = 48000, data: Buffer | undefined;
  while (at < wav.length) {
    const id = wav.toString('ascii', at, at + 4), size = wav.readUInt32LE(at + 4);
    if (id === 'fmt ') rate = wav.readUInt32LE(at + 12);
    if (id === 'data') data = wav.subarray(at + 8, at + 8 + size);
    at += 8 + size + (size % 2);
  }
  const samples = new Int16Array(data!.buffer, data!.byteOffset, data!.length / 2), hop = rate / 100, db: number[] = [];
  for (let i = 0; i + hop <= samples.length; i += hop) {
    let sum = 0; for (let k = 0; k < hop; k++) sum += (samples[i + k] / 32768) ** 2;
    db.push(10 * Math.log10(sum / hop + 1e-12));
  }
  const loud = Math.max(...db) - 25, onsets: number[] = [];
  let quiet = 99;
  db.forEach((v, i) => { if (v > loud) { if (quiet >= 5) onsets.push(i / 100); quiet = 0; } else quiet++; });
  return { onsets, seconds: samples.length / rate };
}

/** The fighter a played file belongs to, by its cue name (CombatAudio.cueFighter). */
const cueFighterOf = (url: string) => { const name = url.split('/').pop()!.replace(/\.wav$/, '').replace(/^vo-/, ''); return FIGHTERS.filter(id => name.startsWith(id + '-')).sort((a, b) => b.length - a.length)[0]; };

describe('Strix recorded focus voice', () => {
  it.skipIf(!!ORIGINALS.strix)('measures a recorded challenge without claiming a new transformation or listening approval', () => {
    const named = AWAKENING_LINES.strix!;
    const receipt = JSON.parse(readFileSync('docs/roster-expansion/strix-audio.json', 'utf8'));
    const entry = receipt.voices.find((row: { id: string }) => row.id === named.cue);
    expect(receipt.status).toBe('prototype-awaiting-blind-review');
    expect(entry.whisper.free).toMatch(/この俺を超えてみよ/);
    expect(entry.meaning).toContain('not a new canonical transformation');
    expect(entry.audition).toContain('no human listening acceptance');
    expect(VOICE_CUES[named.cue as keyof typeof VOICE_CUES]).toBe(`voice/${named.cue}.wav`);
    const measured = words(`public/assets/audio/v2/voice/${named.cue}.wav`);
    expect(cueDuration(named.cue)).toBeCloseTo(measured.seconds, 2);
    expect(measured.onsets).toHaveLength(named.words.length);
    measured.onsets.forEach((at, i) => expect(Math.abs(at - named.words[i])).toBeLessThan(.03));
  });

  it('lets the focus challenge finish over wordless efforts but yields to the special and confirmed ultimate', () => {
    const focus = voices(planVoice({ id: 1, kind: 'awaken', serverTime: 1, actorId: 'strix-focus', fighter: 'strix' }))[0];
    expect(focus).toMatchObject({ voicePriority: SUPER_LINE_PRIORITY, phase: 'release', delay: .6 });
    const heavy = voices(planVoice(cast({ fighter: 'strix', slot: 'heavy', actorId: 'strix-focus', actionSeq: 1 }), true));
    expect(heavy.length).toBeGreaterThan(0);
    for (const effort of heavy) expect(effort.voicePriority!).toBeLessThan(focus.voicePriority!);
    const special = voices(planVoice(cast({ fighter: 'strix', slot: 'special', actionSeq: 2 }), true));
    expect(special[0].voicePriority!).toBeGreaterThan(focus.voicePriority!);
    const confirmed = voices(planVoice({ ...cast({ fighter: 'strix', slot: 'ultimate', actionSeq: 3 }), kind: 'confirm', castAge: MOVES.strix.ultimate.contacts[0] }, true));
    expect(confirmed[0].voicePriority!).toBeGreaterThan(focus.voicePriority!);
  });
});

/** A CombatAudio over a stand-in Web Audio context: every source it starts, the file it plays, its starts and stops,
 *  and the gain node it plays through (whose holds say it was ducked). */
async function fakeAudio() {
  const { CombatAudio } = await import('../src/audio/CombatAudio');
  const lengths = JSON.parse(readFileSync('src/audio/data/voiceDurations.json', 'utf8')) as Record<string, number>;
  class Param { value = 1; holds = 0; setValueAtTime() {} linearRampToValueAtTime() {} setTargetAtTime() {} cancelScheduledValues() {} cancelAndHoldAtTime() { this.holds++; } }
  class Node { gain = new Param(); pan = new Param(); connect() { return this; } disconnect() {} }
  class Source extends Node { buffer?: { url: string; duration: number }; out?: Node; playbackRate = new Param(); loop = false; loopStart = 0; loopEnd = 0; onended?: () => void; starts = 0; stops: number[] = []; start() { this.starts++; } stop(t: number) { this.stops.push(t); } }
  const urls = new WeakMap<ArrayBuffer, string>();
  class Context {
    static last: Context; currentTime = 10; state = 'running'; destination = new Node(); sources: Source[] = []; pending?: Source;
    constructor() { Context.last = this; }
    createGain() { const node = new Node(); if (this.pending) { this.pending.out = node; this.pending = undefined; } return node; }
    createStereoPanner() { return new Node(); }
    createBufferSource() { const x = new Source(); this.sources.push(x); this.pending = x; return x; }
    createDynamicsCompressor() { return Object.assign(new Node(), { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param() }); }
    resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
    decodeAudioData(bytes: ArrayBuffer) { const url = urls.get(bytes)!, cue = url.split('/').pop()!.replace('.wav', ''); return Promise.resolve({ url, duration: lengths[cue] ?? 1 }); }
  }
  const g = globalThis as unknown as Record<string, unknown>, saved = { AudioContext: g.AudioContext, fetch: g.fetch };
  g.AudioContext = Context;
  g.fetch = async (url: string) => ({ ok: true, headers: { get: () => 'audio/wav' }, arrayBuffer: async () => { const b = new ArrayBuffer(8); urls.set(b, url); return b; } });
  const audio = new CombatAudio(); await audio.unlock();
  return { audio, sources: () => Context.last.sources, said: (file: string) => Context.last.sources.filter(x => x.buffer?.url.endsWith(file)),
    restore: () => { audio.dispose(); g.AudioContext = saved.AudioContext; g.fetch = saved.fetch; } };
}

describe("Taisei's gold awakening", () => {
  const awaken = (fighter: FighterId, id = 1): CombatEvent => ({ id, kind: 'awaken', serverTime: 1, actorId: 'g', fighter, move: 'GOLDEN SAGE' });
  it('names the form in his own recorded voice, on the voice bus, once the burst has passed', () => {
    const layers = planCombatAudio(awaken('taisei')), voice = voices(layers);
    expect(voice.map(l => l.cue)).toEqual(['vo-taisei-golden-sage']);
    expect(layers.filter(l => l.cue === 'vo-taisei-golden-sage').every(l => l.bus === 'voice'), 'never on the effects bus').toBe(true);
    const line = voice[0];
    expect(line.phase, 'released: the first attack after the entry does not cut it').toBe('release');
    expect(GOLDEN_SAGE.burst).toBe(awakeningSwapAt('taisei'));
    expect(line.delay).toBe(GOLDEN_SAGE.line);
    expect(line.delay! - GOLDEN_SAGE.burst, 'after the blast\'s crest').toBeGreaterThan(.15);
    expect(line.delay!, 'while he is still powering up').toBeLessThan(AWAKENING_ENTRY);
    expect(ORIGINAL_VOICES['vo-taisei-golden-sage']?.text, 'his own line, naming the form').toMatch(/タイセイ/);
  });

  it('is registered: its length is the WAV\'s that plays', () => {
    expect(VOICE_CUES['vo-taisei-golden-sage']).toBe('voice/vo-taisei-golden-sage.wav');
    expect(cueDuration('vo-taisei-golden-sage')).toBeCloseTo(words(`public/assets/audio/v2/${AUDIO_CUES['vo-taisei-golden-sage']}`).seconds, 2);
  });

  it('leaves gold awakening Taisei\'s calls as they were, and sits between his efforts and his calls', () => {
    for (const slot of ['special', 'ultimate'] as const) {
      const base = voices(planVoice(cast({ fighter: 'taisei', slot, actionSeq: 7000 }))), awakened = voices(planVoice(cast({ fighter: 'taisei', slot, actionSeq: 7001 }), true));
      expect(awakened.map(l => l.cue), slot).toEqual(base.map(l => l.cue));
      expect(awakened.length, slot).toBeGreaterThan(0);
      for (const l of awakened) expect(l.voicePriority!, `${slot}: speaks over the line`).toBeGreaterThan(SUPER_LINE_PRIORITY);
    }
    const efforts = mash('taisei', 30, 'efforts', 1, true).flatMap(s => s.voice);
    expect(efforts.length).toBeGreaterThan(0);
    for (const l of efforts) expect(l.voicePriority!, `${l.cue}: does not cut in on the line, or keep it out`).toBeLessThan(SUPER_LINE_PRIORITY);
  });

  it('outlives his attacks after the entry, and his calls still speak over it', async () => {
    const { CombatAudio } = await import('../src/audio/CombatAudio');
    const lengths = JSON.parse(readFileSync('src/audio/data/voiceDurations.json', 'utf8')) as Record<string, number>;
    class Param { value = 1; holds = 0; setValueAtTime() {} linearRampToValueAtTime() {} setTargetAtTime() {} cancelScheduledValues() {} cancelAndHoldAtTime() { this.holds++; } }
    class Node { gain = new Param(); pan = new Param(); connect() { return this; } disconnect() {} }
    class Source extends Node { buffer?: { url: string; duration: number }; out?: Node; playbackRate = new Param(); loop = false; loopStart = 0; loopEnd = 0; onended?: () => void; starts = 0; stops: number[] = []; start() { this.starts++; } stop(t: number) { this.stops.push(t); } }
    const urls = new WeakMap<ArrayBuffer, string>();
    class Context {
      static last: Context; currentTime = 10; state = 'running'; destination = new Node(); sources: Source[] = []; pending?: Source;
      constructor() { Context.last = this; }
      createGain() { const node = new Node(); if (this.pending) { this.pending.out = node; this.pending = undefined; } return node; }
      createStereoPanner() { return new Node(); }
      createBufferSource() { const x = new Source(); this.sources.push(x); this.pending = x; return x; }
      createDynamicsCompressor() { return Object.assign(new Node(), { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param() }); }
      resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
      decodeAudioData(bytes: ArrayBuffer) { const url = urls.get(bytes)!, cue = url.split('/').pop()!.replace('.wav', ''); return Promise.resolve({ url, duration: lengths[cue] ?? 1 }); }
    }
    const g = globalThis as unknown as Record<string, unknown>, saved = { AudioContext: g.AudioContext, fetch: g.fetch };
    g.AudioContext = Context;
    g.fetch = async (url: string) => ({ ok: true, headers: { get: () => 'audio/wav' }, arrayBuffer: async () => { const b = new ArrayBuffer(8); urls.set(b, url); return b; } });
    try {
      const audio = new CombatAudio(); await audio.unlock();
      const taisei = { id: 'g', name: 'G', fighter: 'taisei', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'awaken', actionStarted: 1, actionTime: 0, actionDuration: AWAKENING_ENTRY, target: null, alive: true, isBot: false, grounded: true, guarding: false, awakened: true, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } } as const;
      const said = (file: string) => Context.last.sources.filter(x => x.buffer?.url.endsWith(file));
      // An effort still ringing from a light thrown just before does not keep the line out.
      let seq = 1; while (!voices(planVoice(cast({ actorId: 'g', fighter: 'taisei', actionSeq: seq, id: seq, serverTime: 50 }))).length) seq++;
      resetVoiceMemory();
      audio.handle([cast({ id: 2_000_000_000 + seq, actionSeq: seq, actorId: 'g', fighter: 'taisei', serverTime: 50 })], 'g', [{ ...taisei, action: 'light', awakened: false }]);
      expect(Context.last.sources.filter(x => /vo-taisei-(ha|ya|fun)\.wav$/.test(x.buffer?.url ?? '')).length, 'an effort is ringing').toBe(1);
      audio.handle([{ ...awaken('taisei', 2_000_100_000), actorId: 'g', serverTime: 50.5 }], 'g', [taisei]);
      const [line] = said(AUDIO_CUES['vo-taisei-golden-sage']);
      expect(line?.starts, 'the line was scheduled').toBe(1);
      // A light after the entry does not cut it (only its own scheduled end is on it).
      audio.handle([cast({ id: 2_000_200_000, actionSeq: 9001, actorId: 'g', fighter: 'taisei', serverTime: 51.5 })], 'g', [{ ...taisei, action: 'light', actionStarted: 51.5 }]);
      expect(line.stops, 'a light does not cut the line').toHaveLength(1);
      // The Sunpalm Cannon is called by name over it, the line ducked under the call rather than stopped.
      audio.handle([cast({ id: 2_000_300_000, actionSeq: 9002, actorId: 'g', fighter: 'taisei', slot: 'special', serverTime: 52 })], 'g', [{ ...taisei, action: 'special', actionStarted: 52 }]);
      expect(said(AUDIO_CUES['vo-taisei-sunpalm-cannon']).map(x => x.starts), 'the call speaks').toEqual([1]);
      expect(line.stops, 'the line is not cut').toHaveLength(1);
      expect(line.out!.gain.holds, 'it is ducked under the call').toBeGreaterThan(0);
      audio.dispose();
    } finally { g.AudioContext = saved.AudioContext; g.fetch = saved.fetch; }
  });
});

describe("Ouga's gold awakening", () => {
  const awaken = (id = 1): CombatEvent => ({ id, kind: 'awaken', serverTime: 1, actorId: 'v', fighter: 'ouga', move: 'GOLDEN PRIDE' });

  it('names his form in his own recorded voice, on the voice bus, once the burst has passed', () => {
    const layers = planCombatAudio(awaken()), voice = voices(layers);
    expect(voice.map(l => l.cue)).toEqual(['vo-ouga-super-ouga']);
    expect(layers.filter(l => l.cue === 'vo-ouga-super-ouga').every(l => l.bus === 'voice'), 'never on the effects bus').toBe(true);
    const line = voice[0];
    expect(line.phase, 'released: the first attack after the entry does not cut it').toBe('release');
    expect(line.gain).toBe(.95);
    expect(SUPER_OUGA.burst).toBe(awakeningSwapAt('ouga'));
    expect(line.delay).toBe(SUPER_OUGA.line);
    expect(line.delay! - SUPER_OUGA.burst, 'after the blast\'s crest').toBeGreaterThan(.15);
    expect(line.delay!, 'while he is still powering up').toBeLessThan(AWAKENING_ENTRY);
    // On Taisei's beat: the two transform, then declare, alike.
    expect(line.delay! - SUPER_OUGA.burst).toBeCloseTo(GOLDEN_SAGE.line - GOLDEN_SAGE.burst, 3);
    expect(line.voicePriority).toBe(SUPER_LINE_PRIORITY);
    expect(ORIGINAL_VOICES['vo-ouga-super-ouga']?.text, 'his own line, naming his form').toMatch(/ゴールデン・プライド/);
  });

  it('is registered: its length is the WAV\'s that plays, a declaration and not a speech', () => {
    expect(VOICE_CUES['vo-ouga-super-ouga']).toBe('voice/vo-ouga-super-ouga.wav');
    const { seconds } = words(`public/assets/audio/v2/${AUDIO_CUES['vo-ouga-super-ouga']}`);
    expect(cueDuration('vo-ouga-super-ouga')).toBeCloseTo(seconds, 2);
    expect(seconds, 'a declaration, not a speech').toBeLessThan(3);
    // The beat after the opening word is kept, but short: the second phrase a third to half a second after it ends.
    expect(SUPER_OUGA.super - .65).toBeGreaterThan(.3);
    expect(SUPER_OUGA.super - .65).toBeLessThan(.5);
    // The form's name is said with the gold hair on: after the swap, and after the entry has ended.
    expect(SUPER_OUGA.line + SUPER_OUGA.super).toBeGreaterThan(AWAKENING_ENTRY);
  });

  it('sits between his efforts and his calls: Haou-Dan, the Gale and Kyokko-Ho speak over it', () => {
    for (const slot of ['heavy', 'special', 'ultimate'] as const) {
      const base = voices(planVoice(cast({ fighter: 'ouga', slot, actionSeq: 7100 }))), awakened = voices(planVoice(cast({ fighter: 'ouga', slot, actionSeq: 7101 }), true));
      expect(awakened.map(l => l.cue), slot).toEqual(base.map(l => l.cue));
      expect(awakened.length, slot).toBeGreaterThan(0);
      for (const l of awakened) expect(l.voicePriority!, `${slot}: speaks over the line`).toBeGreaterThan(SUPER_LINE_PRIORITY);
    }
    // Haou-Dan under the beams, as a heavy is under a special.
    expect(voices(planVoice(cast({ fighter: 'ouga', slot: 'heavy', actionSeq: 7102 })))[0].voicePriority).toBe(BIG_BANG_PRIORITY);
    expect(BIG_BANG_PRIORITY).toBeLessThan(voices(planVoice(cast({ fighter: 'ouga', slot: 'special', actionSeq: 7103 })))[0].voicePriority!);
    const efforts = mash('ouga', 30, 'efforts', 1, true).flatMap(s => s.voice);
    expect(efforts.length).toBeGreaterThan(0);
    for (const l of efforts) expect(l.voicePriority!, `${l.cue}: does not cut in on the line, or keep it out`).toBeLessThan(SUPER_LINE_PRIORITY);
  });

  it('outlives his attacks after the entry, and his Haou-Dan and the Gale are still called over it', async () => {
    const fake = await fakeAudio();
    try {
      const { audio, said } = fake;
      const ouga = { id: 'v', name: 'V', fighter: 'ouga', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'awaken', actionStarted: 1, actionTime: 0, actionDuration: AWAKENING_ENTRY, target: null, alive: true, isBot: false, grounded: true, guarding: false, awakened: true, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } } as const;
      // An effort still ringing from a light thrown just before does not keep the line out.
      let seq = 1; while (!voices(planVoice(cast({ actorId: 'v', fighter: 'ouga', actionSeq: seq, id: seq, serverTime: 50 }))).length) seq++;
      resetVoiceMemory();
      audio.handle([cast({ id: 2_100_000_000 + seq, actionSeq: seq, actorId: 'v', fighter: 'ouga', serverTime: 50 })], 'v', [{ ...ouga, action: 'light', awakened: false }]);
      expect(fake.sources().filter(x => /vo-ouga-(ha|da|fun)\.wav$/.test(x.buffer?.url ?? '')).length, 'an effort is ringing').toBe(1);
      audio.handle([{ ...awaken(2_100_100_000), serverTime: 50.5 }], 'v', [ouga]);
      const [line] = said(AUDIO_CUES['vo-ouga-super-ouga']);
      expect(line?.starts, 'the line was scheduled').toBe(1);
      // A light after the entry does not cut it, nor an effort cut in on it.
      for (let n = 0; n < 4; n++)
        audio.handle([cast({ id: 2_100_200_000 + n, actionSeq: 9100 + n, actorId: 'v', fighter: 'ouga', chain: n, serverTime: 51.5 + n * .3 })], 'v', [{ ...ouga, action: 'light', actionStarted: 51.5 + n * .3 }]);
      expect(line.stops, 'a light does not cut the line').toHaveLength(1);
      // Haou-Dan is called by name over it, the line ducked under the call rather than stopped...
      audio.handle([cast({ id: 2_100_300_000, actionSeq: 9200, actorId: 'v', fighter: 'ouga', slot: 'heavy', serverTime: 52.8 })], 'v', [{ ...ouga, action: 'heavy', actionStarted: 52.8 }]);
      expect(said(AUDIO_CUES['vo-ouga-big-bang']).map(x => x.starts), 'the call speaks').toEqual([1]);
      expect(line.stops, 'the line is not cut').toHaveLength(1);
      expect(line.out!.gain.holds, 'it is ducked under the call').toBeGreaterThan(0);
      // ... and so is the Gale.
      audio.handle([cast({ id: 2_100_400_000, actionSeq: 9201, actorId: 'v', fighter: 'ouga', slot: 'special', serverTime: 53.4 })], 'v', [{ ...ouga, action: 'special', actionStarted: 53.4 }]);
      expect(said(AUDIO_CUES['vo-ouga-gale']).map(x => x.starts), 'the Gale is called').toEqual([1]);
    } finally { fake.restore(); }
  });
});

describe('the awakening lines (the overnight pass, 9 October)', () => {
  const HEARD: Partial<Record<FighterId, RegExp>> = { kenzo: /羅刹/, gummy: /サンライズ/, shirokane: /番人/, oro: /我が刻/,
    setsu: /刹那/, gaku: /狛犬/, ward: /手術室/, kosho: /フー・ブルー/, shiden: /雷/, tobari: /鴉天狗/,
    asahi: /夜明け/, koko: /アイアン・ララバイ/, kagari: /カグツチ/, 'gohaku': /白猿/,
    kuon: /天眼/, sorrel: /紅の意志/, dorado: /水平線/, 'rook': /ホロウ・クラウン/ };
  const SILENT: FighterId[] = [];
  const NAMED = Object.keys(AWAKENING_LINES) as FighterId[];
  const awaken = (fighter: FighterId, id = 1): CombatEvent => ({ id, kind: 'awaken', serverTime: 1, actorId: 'w', fighter, move: 'AWAKEN' });
  const ORIGINAL_LINES: FighterId[] = ['taisei', 'ouga', 'nigo', 'konta', 'gaunt', 'gorai', 'haldor', 'shiun', 'magatsu', 'vesper', 'imago', 'wuming', 'jirenga', 'jinlin', 'ippon', 'sekka', 'levin', 'akagane'];

  // Expansion entries use source-recorded resolve lines or native acting at entry,
  // not a fabricated spoken name for every focus/awakening.
  const ENTRY_CUES: Partial<Record<FighterId, AudioCue>> = {
    chohan:'vo-chohan-power-gap',
    tsubute:'vo-tsubute-resolve', aqrab:'vo-aqrab-to-sand', yodaka:'vo-yodaka-heart-ablaze',
    'psyche':'vo-psyche-violet-swarm','ovid':'vo-ovid-resolve',hawser:'vo-hawser-stronger',rotfalke:'vo-rotfalke-sync',bonsho:'vo-bonsho-prayer',murex:'vo-murex-awaken',kinu:'vo-kinu-awakening','madake':'vo-madake-resolve',akayuri:'vo-akayuri-resolve',hagure:'vo-hagure-awakening',hisame:'vo-hisame-awaken',mizuhiki:'vo-mizuhiki-own-will','shibuichi':'vo-shibuichi-resolve','rakucho':'vo-rakucho-awakening',irbis:'vo-irbis-awaken',shidare:'vo-shidare-unsealed',
    shanxiao:'vo-shanxiao-unbound-fury', tancho:'vo-tancho-phosphor', bellows:'vo-bellows-stoked',
    mikage:'vo-mikage-hackles-up', akaito:'vo-akaito-ring-pact', shijima:'vo-shijima-unsealed', tempo:'vo-tempo-awakening',
    oyashio:'vo-oyashio-sea', adad:'vo-adad-awakening', senko:'vo-senko-speed', buna:'vo-buna-oden',
    ume:'vo-ume-grand-champion', lanthorn:'vo-lanthorn-awakening', highsun:'vo-highsun-sunshine', torsion:'vo-torsion-serious', kubiwa:'vo-kubiwa-awakening', onigawara:'vo-onigawara-awaken', minase:'vo-minase-sage', hinomoto:'vo-hinomoto-time-ripe',amagoi:'vo-amagoi-awakening','shakudo':'vo-shakudo-serious', hikui:'vo-hikui-awaken', tokan:'vo-tokan-justice', strappado:'vo-strappado-showstopper', unari:'vo-unari-awakening', barrow:'vo-barrow-strongest', sashigane:'vo-sashigane-overtime', gosu:'vo-gosu-awakening',
    kusushi:'vo-kusushi-grand-champion', hakushi:'vo-hakushi-awaken',
    suzuran:'vo-suzuran-resolve', wataame:'vo-wataame-awakening',
  };
  for (const [fighter, cue] of Object.entries(ENTRY_CUES) as [FighterId, AudioCue][]) {
    it(`${fighter}: retains its own recorded entry acting without claiming a named-form callout`, () => {
      const spoken = voices(planCombatAudio(awaken(fighter)));
      expect(spoken).toEqual([
        expect.objectContaining({ cue, bus:'voice', phase:'release', voicePriority:SUPER_LINE_PRIORITY }),
      ]);
      expect(spoken[0].delay ?? 0).toBe(0);
      const own = ORIGINAL_VOICES[cue];
      expect(own, cue).toBeDefined();
      expect(readFileSync(`public/assets/audio/v2/${own!.file}`).length).toBeGreaterThan(1000);
    });
  }

  it('leaves no awakening silent but those with no recorded take, and touches none that had a line', () => {
    for (const fighter of FIGHTERS) {
      const said = voices(planVoice(awaken(fighter))).map(l => l.cue);
      if (SILENT.includes(fighter)) expect(said, fighter).toEqual([]);
      else expect(said.length, fighter).toBe(1);
    }
    for (const fighter of ORIGINAL_LINES) expect(NAMED, `${fighter} kept its own line`).not.toContain(fighter);
    expect([...NAMED, ...SILENT, ...ORIGINAL_LINES, ...Object.keys(ENTRY_CUES)].sort()).toEqual([...FIGHTERS].sort());
  });

  // This recorded-form fixture has measured speech onsets for the bank. Strix's
  // focus challenge and Sorayomi's weather mastery have separate source, timing
  // and priority contracts. Release status
  // does not turn their ordinary attack efforts into named-form callouts.
  for (const fighter of NAMED.filter(id => id in HEARD)) {
    const named = AWAKENING_LINES[fighter]!;
    it(`${fighter}: names the form in their own recorded voice, on the voice bus, released, once the burst has passed`, () => {
      const layers = planCombatAudio(awaken(fighter)), voice = voices(layers);
      expect(voice.map(l => l.cue)).toEqual([named.cue]);
      expect(layers.filter(l => l.cue === named.cue).every(l => l.bus === 'voice'), 'never on the effects bus').toBe(true);
      const line = voice[0];
      expect(line.phase, 'released: the first attack after the entry does not cut it').toBe('release');
      expect(line.gain).toBe(.95);
      expect(line.voicePriority).toBe(SUPER_LINE_PRIORITY);
      expect(named.burst).toBe(awakeningSwapAt(fighter));
      expect(line.delay).toBe(named.line);
      // On Taisei's and Ouga's beat or after it: the burst, then the line, while the entry is still playing.
      expect(GOLDEN_SAGE.line - GOLDEN_SAGE.burst).toBeCloseTo(AFTER_BURST, 3);
      expect(line.delay! - named.burst, 'once the blast has crested').toBeGreaterThanOrEqual(AFTER_BURST - 1e-9);
      expect(line.delay!, 'while the entry is still playing').toBeLessThan(AWAKENING_ENTRY);
      // After the burst, so the burst stays the loud one the overnight audio pass made it (sfxPlan.ts, spokenOver).
      expect(layers.map(l => l.cue), 'the burst nobody speaks over').toEqual(expect.arrayContaining(['fx-awaken', 'fx-ki-launch', 'fx-wind-blast']));
      expect(ORIGINAL_VOICES[named.cue]?.text, 'what it says').toMatch(HEARD[fighter]!);
    });

    it(`${fighter}: is registered - its length is the WAV's that plays, a call and not a speech`, () => {
      expect(VOICE_CUES[named.cue as keyof typeof VOICE_CUES]).toBe(`voice/${named.cue}.wav`);
      const { seconds } = words(`public/assets/audio/v2/${AUDIO_CUES[named.cue]}`);
      expect(cueDuration(named.cue)).toBeCloseTo(seconds, 2);
      expect(seconds, 'a call, not a speech: no longer than Taisei\'s, but for Gaku\'s').toBeLessThan(fighter === 'gaku' ? 5.1 : 4.65);
      expect(named.named).toBeLessThan(named.words.length);
    });

    it(`${fighter}: sits between their efforts and their calls - every call speaks over it, nothing of a light cuts it`, () => {
      for (const slot of ['heavy', 'special', 'ultimate'] as const) {
        const awakened = voices(planVoice(cast({ fighter, slot, actionSeq: 7200, serverTime: 3 }), true));
        for (const l of awakened) expect(l.voicePriority!, `${slot}: ${l.cue} speaks over the line`).toBeGreaterThan(SUPER_LINE_PRIORITY);
      }
      // A named heavy goes out over the line awakened (AWAKENED_HEAVY_PRIORITY), and as it always did in the base form.
      const heavy = voices(planVoice(cast({ fighter, slot: 'heavy', actionSeq: 7201, serverTime: 3 }), true));
      if (heavy.length) {
        expect(heavy[0].voicePriority).toBe(AWAKENED_HEAVY_PRIORITY);
        expect(voices(planVoice(cast({ fighter, slot: 'heavy', actionSeq: 7202, serverTime: 3 })))[0].voicePriority, 'base: as it was').toBe(0);
      }
      const lights = mash(fighter, 30, `lights-${fighter}`, 1, true).flatMap(s => s.voice);
      expect(lights.length).toBeGreaterThan(0);
      for (const l of lights) expect(l.voicePriority!, `${l.cue}: does not cut in on the line, or keep it out`).toBeLessThan(SUPER_LINE_PRIORITY);
    });

    it(`${fighter}: outlives the attacks after the entry, and the first call after it still speaks over it`, async () => {
      const fake = await fakeAudio();
      try {
        const { audio, said } = fake, id = `w-${fighter}`;
        const me = { id, name: 'W', fighter, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'awaken', actionStarted: 1, actionTime: 0, actionDuration: AWAKENING_ENTRY, target: null, alive: true, isBot: false, grounded: true, guarding: false, awakened: true, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } } as const;
        const own = () => fake.sources().filter(x => x.buffer && cueFighterOf(x.buffer.url) === fighter);
        // A light's line still ringing when they awaken does not keep the line out.
        let seq = 1; while (!voices(planVoice(cast({ actorId: id, fighter, actionSeq: seq, id: seq, serverTime: 50 }))).length) seq++;
        resetVoiceMemory();
        audio.handle([cast({ id: 2_200_000_000 + seq, actionSeq: seq, actorId: id, fighter, serverTime: 50 })], id, [{ ...me, action: 'light', awakened: false }]);
        expect(own().length, 'a light\'s line is ringing').toBe(1);
        audio.handle([{ ...awaken(fighter, 2_200_100_000), actorId: id, serverTime: 50.5 }], id, [me]);
        const [line] = said(AUDIO_CUES[named.cue]);
        expect(line?.starts, 'the line was scheduled').toBe(1);
        // A string after the entry does not cut it, nor an effort or a callout cut in on it.
        for (let n = 0; n < 4; n++)
          audio.handle([cast({ id: 2_200_200_000 + n, actionSeq: 9300 + n, actorId: id, fighter, chain: n, serverTime: 51.5 + n * .3 })], id, [{ ...me, action: 'light', actionStarted: 51.5 + n * .3 }]);
        expect(line.stops, 'a light does not cut the line').toHaveLength(1);
        // The first call after it - the named heavy, else the special, else the ultimate - is said over it.
        const slot = (['heavy', 'special', 'ultimate'] as const).find(s => voices(planVoice(cast({ fighter, slot: s, actionSeq: 7300, serverTime: 3 }), true)).some(l => l.voicePriority! > SUPER_LINE_PRIORITY));
        let call: CueLayer | undefined;
        if (slot) {
          const event = cast({ id: 2_200_300_000, actionSeq: 9400, actorId: id, fighter, slot, serverTime: 52.8 });
          call = voices(planVoice({ ...event }, true))[0];
          audio.handle([event], id, [{ ...me, action: slot, actionStarted: 52.8 }]);
        } else {
          // No call with the cast: the ultimate's cinematic line, said when its opener catches them.
          const move = moveFor(fighter, 'ultimate', true), event: CombatEvent = { id: 2_200_400_000, kind: 'confirm', serverTime: 53, actorId: id, fighter, slot: 'ultimate', castAge: move.contacts[0] + .02 };
          call = voices(planVoice(event, true))[0];
          audio.handle([event], id, [{ ...me, action: 'ultimate', actionStarted: 53 - move.contacts[0] }]);
        }
        expect(call, 'a call to make').toBeDefined();
        expect(said(AUDIO_CUES[call!.cue]).map(x => x.starts), `${call!.cue} speaks`).toEqual([1]);
        expect(line.stops, 'the line is not cut').toHaveLength(1);
        expect(line.out!.gain.holds, 'it is ducked under the call').toBeGreaterThan(0);
      } finally { fake.restore(); }
    });
  }
});

describe('every voice cue', () => {
  const planned = new Set<AudioCue>();
  for (const fighter of FIGHTERS) for (const awakened of [false, true]) {
    for (const slot of ['heavy', 'special', 'ultimate'] as AttackSlot[]) for (let seq = 0; seq < 12; seq++)
      for (const l of voices(planVoice(cast({ fighter, slot, actionSeq: 5000 + seq, serverTime: 1 + seq * 3 }), awakened))) planned.add(l.cue);
    for (const s of mash(fighter, 120, `all-${fighter}-${awakened}`, 1, awakened)) for (const l of s.voice) planned.add(l.cue);
    for (const l of voices(planVoice({ id: 1, kind: 'awaken', serverTime: 1, actorId: 'x', fighter }))) planned.add(l.cue);
  }
  it('is a real, audible 48 kHz mono PCM WAV', () => {
    for (const cue of new Set<AudioCue>([...planned, ...(Object.keys(VOICE_CUES) as AudioCue[])])) {
      const b = readFileSync(new URL('../public/assets/audio/v2/' + AUDIO_CUES[cue], import.meta.url));
      expect(b.subarray(0, 4).toString(), cue).toBe('RIFF');
      expect(b.subarray(8, 12).toString(), cue).toBe('WAVE');
      let at = 12, data = 0, size = 0, rate = 0, channels = 0, bits = 0, format = 0;
      while (at + 8 <= b.length) {
        const id = b.toString('ascii', at, at + 4), length = b.readUInt32LE(at + 4);
        if (id === 'fmt ') { format = b.readUInt16LE(at + 8); channels = b.readUInt16LE(at + 10); rate = b.readUInt32LE(at + 12); bits = b.readUInt16LE(at + 22); }
        if (id === 'data') { data = at + 8; size = length; break; }
        at += 8 + length + (length & 1);
      }
      expect([format, bits], `${cue} is 16-bit PCM`).toEqual([1, 16]);
      if (cue in VOICE_CUES) expect([rate, channels], `${cue} is 48 kHz mono`).toEqual([48000, 1]);
      let peak = 0, sum = 0; const n = Math.floor(size / 2 / channels);
      for (let i = 0; i < n; i++) { const v = Math.abs(b.readInt16LE(data + i * 2 * channels)) / 32768; peak = Math.max(peak, v); sum += v * v; }
      expect(peak, `${cue} is not silent`).toBeGreaterThan(.2);
      // The cuts added this round are levelled and limited at the source.
      if (cue in VOICE_CUES) expect(peak, `${cue} peaks under -1.3 dBFS`).toBeLessThan(.862);
      expect(10 * Math.log10(sum / n), `${cue} is not near-silent`).toBeGreaterThan(-35);
      expect(cueDuration(cue), `${cue} has a measured length`).toBeGreaterThan(.1);
    }
  }, 60_000);   // reads every voice file on disk: over two thousand since the situation batches began
  it('added this round is trimmed at the source and measured', () => {
    const onsets = JSON.parse(readFileSync('src/audio/data/cueOnsets.json', 'utf8')) as Record<string, number>;
    const durations = JSON.parse(readFileSync('src/audio/data/voiceDurations.json', 'utf8')) as Record<string, number>;
    for (const cue of Object.keys(VOICE_CUES)) {
      expect(onsets[cue], `${cue} has no onset entry`).toBeUndefined();
      expect(durations[cue], `${cue} is measured`).toBeGreaterThan(.1);
      expect(AUDIO_CUES[cue as AudioCue]).toMatch(/^voice\//);
    }
  });
  it('is planned on the voice bus only', () => {
    for (const fighter of FIGHTERS) for (const slot of ['light', 'heavy', 'special', 'ultimate'] as AttackSlot[]) {
      const layers = planCombatAudio(cast({ fighter, slot, actionSeq: 900 + FIGHTERS.indexOf(fighter) }));
      for (const l of layers) if ((Object.keys(VOICE_CUES) as string[]).includes(l.cue)) expect(l.bus).toBe('voice');
    }
  });
});
