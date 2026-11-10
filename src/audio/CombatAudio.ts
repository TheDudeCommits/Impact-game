import { audioContext } from './contextRate';
import type { CombatEvent, PlayerState, Vec3 } from '../game/types';
import { AUDIO_CUES, planCombatAudio, type AudioCue, type CueLayer } from './cuePlan';
import CUE_ONSETS from './data/cueOnsets.json';
import { FIGHTERS } from '../config';
import { SFX_PEAKS } from './sfxCues';
import { impulseResponse, spaceFor, spaceName, VOICE_SHARE, type Space, type SpaceName } from './space';
import { StageAmbience } from './ambience';
import { LIQUID_FLOORS, onLiquid, type LiquidFloor } from '../game/footing';
import { SPLASHES, SPLASHES_BIG } from './ambience';
import { QuipDirector } from './QuipDirector';
import { FIGHTER_QUIPS } from './quipCues';
import { SITUATION_RULES, isRift, lineSeconds, riftUrl, situationLayer, situationLines, situationSamples, type SituationLine, type VoiceSituation } from './voiceSituations';
import type { FighterId } from '../game/types';
/** The reactions a body is thrown down in: their landing is a body falling (movement). */
const FALLS = new Set<PlayerState['action']>(['launched', 'knockdown']);
import type { StageId } from '../game/stages';
import { AWAKENINGS, awakeningSwapAt } from '../game/awakening';
import { OWN_ENTRANCES } from '../game/powerUp';
import { POWER_SOUNDS, powerVoice } from './powerSound';
import { holdAt } from './holdParam';
import { trimAac } from './aacTrim';
import { wakeOnReturn } from './wake';
import { byNeed, fighterCues } from './roomCues';
import { GIANT, STEPS, surfaceAt, weightGain, weightNow, weightRate } from './floors';
import { standIn, survivalStandIn } from './standIns';

/** The power-up pass (10 October 2026) held one loop on a fighter, the ki flame's roar: through every entry, and after it
 *  under whoever the server's table marks `flames`. Launch day 5 (12 October): the loop is the fighter's own power's
 *  (audio/powerSound.ts, read from render/awakenedPower.ts) - Will's pressure and crackle, raw pressure's roar,
 *  chi's wind, a dark flame's low burn, Aura's hum, lightning, steam, frost, and the flame only where something burns.
 *
 *  What a fighter's power sounds like now, or nothing: its loop, swelling through the gather to the break (the swap) and
 *  held through the rest of the entry, then - where the power stands on them - kept low under the fight until it ends. */
export function auraVoice(p: PlayerState): { cue: AudioCue; level: number; rate: number } | undefined {
  if (!p.alive || p.enemy || !AWAKENINGS[p.fighter]) return undefined;
  const voice = powerVoice(p.fighter);
  if (!voice) return undefined;
  const sound = POWER_SOUNDS[voice.kind];
  let level = 0;
  if (p.action === 'awaken') {
    // (Chohan's and Sorayomi's arrivals are heard by their own layers: game/powerUp.ts.)
    if (OWN_ENTRANCES.has(p.fighter)) return undefined;
    const t = p.actionTime * p.actionDuration, swap = awakeningSwapAt(p.fighter);
    level = sound.entry * (t < swap ? .3 + .7 * Math.pow(t / Math.max(.05, swap), 1.5) : 1);
  } else if (p.awakened && voice.stands) level = sound.hold;
  return level > 0 ? { cue: sound.loop, level: level * voice.level, rate: voice.rate } : undefined;
}
/** How loud that loop is (0: none). */
export const auraRoar = (p: PlayerState) => auraVoice(p)?.level ?? 0;
/** How many powers are heard standing at once, and from how far (m): the player's own and the nearest three. In a royale
 *  of twelve every fighter can be awakened together; twelve beds under the fight are a wash of noise and eat the effects'
 *  twenty voices, and past thirty metres a bed held at a tenth is 26 dB down and under everything anyway. */
const AURA_VOICES = 4, AURA_RANGE = 30;
/** How far another fighter's footsteps carry (m; at 16 m a step is 7 dB down and under the fight), and the least time
 *  between two of them (s): six a second at most, whoever's they are. */
const STEP_RANGE = 16, STEP_GAP = .16;

/** How far behind a cast event the presented actionStarted may sit and still
 *  be that cast. A server cast and its snapshot share a tick; a predicted one
 *  is ahead of the server by the round trip. */
const CAST_MATCH = .3;
/** How long an announced cast waits for the server to show it before its
 *  layers are given up as a rejected press. main.ts stops treating the
 *  server's echo as a duplicate at the same 1.2 s. */
const CAST_CONFIRM = 1.2;
/** States a fighter can be shown in between pressing and the server agreeing,
 *  none of which say the press was refused. */
const NEUTRAL = new Set(['idle', 'run', 'jump', 'guard']);

/** The fighter a cue speaks for, by its name - 'vo-gohaku-roar', 'koko-iron-lullaby' - or none: the impacts, whooshes
 *  and shared effects, and Kurobi's growls (the fox boss's voice too) are every match's. No cue named for one fighter is
 *  planned for another (tests/assetLoads.test.ts walks every fighter through the plans). */
const FIGHTER_IDS = Object.keys(FIGHTERS).sort((a, b) => b.length - a.length);
export function cueFighter(cue: string): string | undefined {
  const name = cue.startsWith('vo-') ? cue.slice(3) : cue;
  return FIGHTER_IDS.find(id => name.startsWith(id + '-'));
}
/** The deploy's AAC copies of the bank (scripts/survival/pack/compress.ts): each WAV's [frames, rate], by its path
 *  under /assets/audio/v2. Absent (the dev server, a package built without the step): the WAVs. */
type PackedBank = Record<string, [number, number]>;
/** The effects bus while a voice speaks (the soundtrack's own duck is CharacterMusic's), how fast it goes down as a line
 *  starts and comes back after the last one (time constants, s), and how far ahead of a line's first sound it starts
 *  down: two of its time constants, so it is down by the first word (updateVoiceActivity). */
const VOICE_DUCK = .72, DUCK_DOWN = .04, DUCK_UP = .18, DUCK_LEAD = .08;

/** `start`: when it sounds, on the audio clock - a layer's delay after it was scheduled. */
interface ActiveSound { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode; priority: number; owner: string; bus: 'sfx' | 'voice'; phase?: CueLayer['phase']; stopping: boolean; sequence?:number; start: number; level: number; end: number }
export interface AudioMix { master: number; sfx: number; voice: number }

/** Event-timed sourced layers, protected dialogue, natural tails, and cancellable charge beds. */
export class CombatAudio {
  onVoiceActivity?: (active: boolean) => void;
  private context?: AudioContext;
  private master?: GainNode;
  private musicSources=new Map<HTMLAudioElement,MediaElementAudioSourceNode>();
  private sfx?: GainNode;
  private speech?: GainNode;
  private compressor?: DynamicsCompressorNode;
  /** The stage's reverb (audio/space.ts): the effects and the voices each send to one band-limited convolver, whose
   *  return joins the master. Silent until a stage with a space is set. */
  private reverb?: { sfx: GainNode; speech: GainNode; convolver: ConvolverNode; out: GainNode };
  private irs = new Map<SpaceName, AudioBuffer>();
  private stage?: StageId;
  /** The place's own sound (audio/ambience.ts), on a bus of its own into the master: the effects' level, no reverb
   *  send (the beds are their places already). */
  private ambienceBus?: GainNode;
  private ambience?: StageAmbience;
  private ambienceStage?: StageId;
  private loading?: Promise<void>;
  private mix: AudioMix = { master: .5, sfx: .85, voice: 1 };
  private buffers = new Map<AudioCue, AudioBuffer>();
  /** One-shots outside the cue plan (arcade survival's horde and bosses), by url, loaded on demand. */
  private samples = new Map<string, AudioBuffer>();
  private sampleLoads = new Map<string, Promise<void>>();
  private sounds = new Set<ActiveSound>();
  private seen = new Set<number>();
  private dashStates = new Map<string, number>();
  /** One entry per fighter mid-cast. `started` is the actionStarted the
   *  presented state shows for it; undefined while the cast has been announced
   *  ahead of authority and the snapshot has not got to it yet - see handle. */
  private casts = new Map<string, { started?: number; before: number; announced: number; slot: string; released: boolean }>();
  private latestPlayers: PlayerState[] = [];
  private selfId = '';
  private dead = false;
  private voiceActive = false;
  /** The start of the next line still to come while none speaks, which the effects bus is already set to duck for, and
   *  the timer that tells onVoiceActivity when it does (updateVoiceActivity). */
  private duckAt?: number;
  private duckTimer?: ReturnType<typeof setTimeout>;
  private abort = new AbortController();
  /** With `byRoom`, the bank holds every match's cues and the own cues of the fighters asked for (prepare), not the
   *  whole roster's (the game's; a bare CombatAudio, as the tests build one, opens the whole bank as before). */
  constructor(private readonly options: { byRoom?: boolean } = {}) {}
  /** Fighters whose own cues are wanted (prepare), the by-need sounds they name (roomCues.ts), and each cue's load. */
  private wanted = new Set<string>();
  private needed = new Set<AudioCue>();
  private cueLoads = new Map<AudioCue, Promise<void>>();
  private packed?: Promise<PackedBank | null>;
  /** A browser that decoded an AAC copy to a length it cannot be brought to the WAV's (aacTrim.ts: a decoder that is
   *  neither exact nor one that keeps the encoder's delay, as Firefox's does) hears the WAVs from then on: the game
   *  times its sounds to the sample. */
  private wavOnly = false;
  private quips = new QuipDirector();
  /** The performance sweep (24 October 2026): while a room's bodies, stage and effects are coming, the bank's requests wait
   *  (`holdFetches`). Asked for at PLAY, its 500-odd files (13.5 MB for a pinned twelve-fighter royale) shared the line with
   *  them, the stage's and the Armory's images queued behind them at the same low priority; and the compile could not start
   *  until the last sound was in. Held, the room's own files have the line first and the sound comes in while the room
   *  compiles (main.ts waits for it after the compile: matchWarmup.ts warmRoomSound). */
  private held: Promise<void> | undefined;
  /** Requests wait until `until` settles, or `cap` ms at most. */
  holdFetches(until: Promise<unknown>, cap: number) {
    const hold = Promise.race([until.then(() => {}, () => {}), new Promise<void>(done => setTimeout(done, cap))]);
    this.held = hold;
    void hold.then(() => { if (this.held === hold) this.held = undefined; });
  }
  /** A sound's file, fetched and read, after any hold. (Not a few at a time: with eight or twenty-four in flight, every long
   *  task of the room's compile - each next request is asked for by script - left the line idle, and the bank took twice as
   *  long to come. Nothing else of the room is fetched after the hold: Effekseer's files come with its models now.) */
  private async download(url: string, init: RequestInit, what: string): Promise<ArrayBuffer> {
    if (this.held) await this.held;
    const response = await fetch(url, init);
    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error(`Could not load sound: ${what}`);
    return await response.arrayBuffer();
  }

  async unlock(): Promise<void> {
    if (this.dead) return;
    if (!this.context) {
      if (!globalThis.AudioContext) throw new Error('Web Audio is unavailable in this browser');
      this.context = audioContext('interactive');   // a phone's at 32 kHz (contextRate.ts)
      wakeOnReturn(() => this.context, () => !this.dead);
      this.master = this.context.createGain(); this.sfx = this.context.createGain(); this.speech = this.context.createGain();
      this.master.gain.value = this.mix.master; this.sfx.gain.value = this.mix.sfx; this.speech.gain.value = this.mix.voice;
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -9; this.compressor.knee.value = 10; this.compressor.ratio.value = 4;
      this.compressor.attack.value = .003; this.compressor.release.value = .18;
      this.sfx.connect(this.master); this.speech.connect(this.master); this.master.connect(this.compressor).connect(this.context.destination);
      this.ambienceBus = this.context.createGain(); this.ambienceBus.gain.value = this.mix.sfx; this.ambienceBus.connect(this.master);
      this.ambience = new StageAmbience(this.context, this.ambienceBus, url => this.loadSample(url).then(() => this.samples.get(url)), Math.random,
        url => { this.samples.delete(url); this.sampleLoads.delete(url); });
      if (this.ambienceStage) this.ambience.set(this.ambienceStage);
      if (this.liquid) this.preload(SPLASHES);
      // The reverb send: post-fader from each bus, band-limited so it never muddies a blow's low end or hisses over it.
      // (A context without convolution - the tests' stand-ins - plays dry.)
      const ctx = this.context;
      if (typeof ctx.createConvolver === 'function' && typeof ctx.createBiquadFilter === 'function') {
        const high = ctx.createBiquadFilter(), low = ctx.createBiquadFilter();
        high.type = 'highpass'; high.frequency.value = 180; high.Q.value = .7;
        low.type = 'lowpass'; low.frequency.value = 6500; low.Q.value = .7;
        const reverb = { sfx: ctx.createGain(), speech: ctx.createGain(), convolver: ctx.createConvolver(), out: ctx.createGain() };
        reverb.convolver.normalize = false; reverb.sfx.gain.value = reverb.speech.gain.value = reverb.out.gain.value = 0;
        this.sfx.connect(reverb.sfx).connect(high); this.speech.connect(reverb.speech).connect(high);
        high.connect(low).connect(reverb.convolver).connect(reverb.out).connect(this.master);
        this.reverb = reverb; this.applySpace();
      }
    }
    const resume = this.context.resume();
    this.loading ??= this.load().catch(error => { this.loading = undefined; throw error; });
    await Promise.all([resume, this.loading]);
  }
  private async load() {
    this.preload(situationSamples(this.wanted));
    await this.loadCues((Object.keys(AUDIO_CUES) as AudioCue[]).filter(cue => {
      if (!this.options.byRoom) return true;
      const owner = cueFighter(cue);
      return owner ? this.wanted.has(owner) : !byNeed(cue) || this.needed.has(cue);
    }));
  }
  /** The fighters of a room: their own cues, and the by-need sounds their rows name, are fetched (now, if the bank is
   *  open; else with it). */
  prepare(fighters: Iterable<string>): Promise<void> {
    const fresh = [...fighters].filter(id => !this.wanted.has(id)), shared = new Set<AudioCue>();
    for (const id of fresh) {
      this.wanted.add(id);
      for (const cue of fighterCues(id as FighterId)) if (!this.needed.has(cue)) { this.needed.add(cue); shared.add(cue); }
    }
    if (!this.context || this.dead || !fresh.length || !this.options.byRoom) return Promise.resolve();
    // The voice situations (voiceSituations.ts): the room's lines outside the bank are fetched and decoded with it, behind
    // the loading screen (`ready` waits for both), never on their first use in the fight.
    this.preload(situationSamples(fresh));
    return this.loadCues((Object.keys(AUDIO_CUES) as AudioCue[]).filter(cue => fresh.includes(cueFighter(cue) ?? '') || shared.has(cue)));
  }
  private loadCues(cues: AudioCue[]) {
    cues = [...cues.filter(byNeed), ...cues.filter(cue => !byNeed(cue))];
    const batches: AudioCue[][] = [];
    for (let i = 0; i < cues.length; i += 40) batches.push(cues.slice(i, i + 40));
    const asked = Promise.all(batches.map((batch, n) => new Promise<void>(next => setTimeout(next, n * 16)).then(() => Promise.all(batch.map(cue => this.loadCue(cue)))))).then(() => {});
    // Held until it is in, so `ready` waits for a batch whose turn has not come yet as well as for the loads begun.
    this.asking.add(asked); void asked.finally(() => this.asking.delete(asked));
    return asked;
  }
  /** The requests in flight (loadCues): their later batches have no load to wait on until their turn comes. */
  private asking = new Set<Promise<void>>();
  /** The sound files this site serves (scripts/build/audioFiles.ts), or null where it says nothing: a cue whose file is
   *  not on it is never asked for (some sounds are held back from the public repository: README.md). */
  private served?: Promise<ReadonlySet<string> | null>;
  private files() {
    return this.served ??= (typeof fetch === 'function' ? fetch('/assets/audio/v2/files.json', { signal: this.abort.signal, priority: 'low' } as RequestInit)
      .then(async response => response.ok && response.headers.get('content-type')?.includes('json') ? new Set((await response.json()) as string[]) : null)
      .catch(() => null) : Promise.resolve(null));
  }
  private bank() {
    // (Not held with the sounds: a few kilobytes, and every cue's request waits on it - held, the bank's requests waited for the
    // page to parse it, which the room's compile kept from happening for two and a half seconds.)
    return this.packed ??= fetch('/assets/audio/v2/packed.json', { signal: this.abort.signal, priority: 'low' })
      .then(async response => response.ok && response.headers.get('content-type')?.includes('json') ? ((await response.json()) as { files?: PackedBank }).files ?? null : null)
      .catch(() => null);
  }
  private loadCue(cue: AudioCue): Promise<void> {
    let loading = this.cueLoads.get(cue);
    if (loading) return loading;
    loading = (async () => {
      try {
        let file: string = AUDIO_CUES[cue]; const served = await this.files();
        // A held-back sound (README.md) plays its CC0 stand-in where this site serves one (standIns.ts).
        if (served && !served.has(file)) { if (!served.has(standIn(file))) return; file = standIn(file); }
        const frames = this.wavOnly ? undefined : (await this.bank())?.[file];
        // The AAC copy where the deploy made one, held to its WAV's length (Firefox keeps the encoder's delay and padding,
        // which trimAac takes off: the same sound, to the sample); else, or then, the WAV.
        if (frames && !this.wavOnly) {
          try {
            const decoded = await this.decode(`/assets/audio/v2/${file.replace(/\.wav$/, '.m4a')}`, cue);
            if (this.dead) return;
            const buffer = trimAac(this.context!, decoded, frames);
            if (buffer) { this.buffers.set(cue, buffer); return; }
            // Said once, by the first copy to come back wrong: the others already asked for are in flight and get here
            // too (Firefox said it 424 times on a first room).
            if (!this.wavOnly) console.warn(`Sound bank: this browser decodes AAC to another length (${cue}: ${decoded.duration.toFixed(4)} s, not ${(frames[0] / frames[1]).toFixed(4)}); the WAVs from here on`);
            this.wavOnly = true;
          } catch (error) {
            if (this.dead) return;
            // One that cannot decode AAC at all hears the WAVs; a copy that failed to arrive, its own WAV.
            if (error instanceof DOMException && error.name !== 'AbortError') this.wavOnly = true;
            console.warn(`Sound bank: ${cue}'s AAC copy failed; its WAV instead`, error);
          }
        }
        const buffer = await this.decode(`/assets/audio/v2/${file}`, cue);
        if (!this.dead) this.buffers.set(cue, buffer);
      } catch (error) { if (!this.dead) console.warn(error); }
    })();
    this.cueLoads.set(cue, loading);
    return loading;
  }
  private async decode(url: string, cue: AudioCue): Promise<AudioBuffer> {
    return this.context!.decodeAudioData(await this.download(url, { signal: this.abort.signal, priority: 'low' }, cue));
  }
  setVolume(value: number) { this.setMix({ master: value }); }
  getMix(): AudioMix { return { ...this.mix }; }
  setMix(values: Partial<AudioMix>) {
    for (const key of ['master', 'sfx', 'voice'] as const) {
      const value = values[key]; if (value !== undefined && Number.isFinite(value)) this.mix[key] = Math.max(0, Math.min(1, value));
    }
    if (this.context) {
      this.master?.gain.setTargetAtTime(this.mix.master, this.context.currentTime, .025);
      this.speech?.gain.setTargetAtTime(this.mix.voice, this.context.currentTime, .025);
      this.ambienceBus?.gain.setTargetAtTime(this.mix.sfx, this.context.currentTime, .06);
    }
    // The effects bus at its new level, ducked or not, and a duck still to come at it too.
    this.updateVoiceActivity(.06);
  }
  /** Capture the same local soundtrack, voices and SFX heard during gameplay. */
  captureOutput(musicElements:HTMLAudioElement[]=[]) {
    if (!this.context || !this.compressor || this.context.state !== 'running') throw new Error('Enter the arena to enable game audio before recording');
    const output = this.context.createMediaStreamDestination(), compressor = this.compressor; compressor.connect(output);
    const sources=musicElements.map(audio=>{let source=this.musicSources.get(audio);if(!source){source=this.context!.createMediaElementSource(audio);source.connect(this.context!.destination);this.musicSources.set(audio,source);}source.connect(output);return source;});
    return { stream: output.stream, dispose: () => {for(const source of sources)source.disconnect(output); compressor.disconnect(output); output.stream.getTracks().forEach(track => track.stop()); } };
  }
  /** A foot coming down. There were no footsteps in the game at all; the
   *  renderer's foot planting already decides the exact frame one happens and
   *  how fast the body was moving when it did.
   *
   *  Launch day 5 (12 October 2026): it was one sample (`ground`, a 119 Hz thud pitched up) for every fighter on every
   *  floor. A step is now the floor it lands on (audio/floors.ts: stone, wood, sand, grass, water, snow, metal - two
   *  takes each, left foot and right), at the pace of the gait (a walk is softer and lower than a sprint) and the weight
   *  of the body (lower and fuller for a heavy one; a giant's shakes the floor under it). Still a detail: a fighter at a
   *  sprint makes four of them a second. */
  step(at: { x: number; y: number; z: number }, speed: number, local: boolean) {
    if (this.dead) return;
    // Another fighter's steps are heard near the listener, and never more than one every STEP_GAP: a royale's twelve
    // fighters at a run are sixty steps a second, each a voice of the effects' twenty.
    if (!local) {
      const here = this.here(), now = this.context?.currentTime ?? 0;
      if (Math.hypot(at.x - here.x, at.z - here.z) > STEP_RANGE || now - this.otherStep < STEP_GAP) return;
      this.otherStep = now;
    }
    // A run is 7.5 m/s and this divides by nine, so the pace of a walk, a run and a sprint are three levels and pitches
    // (it divided by seven once, saturated, and every step was the same sample at the same pitch: a metronome).
    const pace = Math.min(1, speed / 9), body = this.bodyAt(at), weight = body ? weightNow(body) : .2;
    // Varied off a counter rather than a random number, so two fighters
    // running side by side do not accidentally land on the same sequence and
    // so a replay of the same fight sounds the same twice.
    const n = this.steps++;
    const wobble = Math.sin(n * 2.399963) * .5 + Math.sin(n * 5.083203) * .5;
    const floor = STEPS[surfaceAt(this.ambienceStage, this.liquid, at.y)];
    const gain = floor.gain * (local ? 1 : .55) * (.5 + pace * .5) * (1 + wobble * .25) * weightGain(weight);
    this.play({ cue: floor.takes[n & 1], gain, rate: (.92 + pace * .16) * (1 + wobble * .06) * weightRate(weight), phase: 'impact' }, at, local ? 1 : 0, 'step');
    if (weight >= GIANT) this.play({ cue: 'ground', gain: gain * (.9 + weight), rate: 1 - .25 * weight, phase: 'impact' }, at, local ? 1 : 0, 'step');
  }
  /** The fighter shown standing at `at` (a step comes from the renderer with a place, not a name): the nearest within a
   *  stride and a half. */
  private bodyAt(at: Vec3): PlayerState | undefined {
    let best: PlayerState | undefined, nearest = 1.5 * 1.5;
    for (const p of this.latestPlayers) {
      if (p.enemy) continue;
      const d = (p.x - at.x) ** 2 + (p.z - at.z) ** 2;
      if (d < nearest) { nearest = d; best = p; }
    }
    return best;
  }
  /** When another fighter's step was last played (the audio clock). */
  private otherStep = -Infinity;
  /** How many footsteps have been played. Drives their variation. */
  private steps = 0;
  /** Jumps and guards going up, which made no sound: neither is a combat
   *  event (the simulation emits casts and what lands), so like the dash they
   *  are read off the fighters as shown. Each is keyed on the server time its
   *  action began and only ever moves forward, so a fighter seen through both
   *  the newest snapshot and the one presented a little behind it sounds once.
   *  The sounds are the SFX bank's air-and-cloth flip (the air recovery's),
   *  fuller with a firm step under it for a take-off, quicker and lighter
   *  with a brush of sleeve for arms coming up. */
  private movement(players: PlayerState[], selfId: string) {
    if (this.movesOf !== selfId) { this.moves.clear(); this.movesOf = selfId; }
    for (const p of players) {
      if (p.enemy) continue;
      const seen = this.moves.get(p.id);
      if (!seen) {
        this.moves.set(p.id, { action: p.action, grounded: p.grounded, y: p.y, airFrom: 0, peak: p.y,
          jump: p.action === 'jump' ? p.actionStarted : -Infinity, guard: p.action === 'guard' ? p.actionStarted : -Infinity });
        continue;
      }
      // The feel pass, iteration eleven: a body thrown down meets the floor. The simulation voices only an
      // ultimate's landing ('land') and a bounce ('ground-bounce'); every other launch and knockdown came down in
      // silence under its dust. Heard by how far it fell: a heavy fall and the cloth, or in a liquid floor a splash.
      const now = this.context?.currentTime ?? 0;
      if (seen.grounded && !p.grounded) { seen.airFrom = now; seen.peak = p.y; }
      if (!p.grounded) seen.peak = Math.max(seen.peak, p.y);
      // Launch day 5: by the body's weight too (a giant comes down lower and harder), and on the floor it lands on.
      const heavy = weightNow(p), floor = STEPS[surfaceAt(this.ambienceStage, this.liquid, p.y)];
      if (!seen.grounded && p.grounded && FALLS.has(seen.action) && now - seen.airFrom > .25 && !(now - (this.voicedLandings.get(p.id) ?? -9) < .35)) {
        const priority = p.id === selfId ? 3 : 0, weight = Math.min(1, .5 + Math.max(0, seen.peak - p.y) * .22);
        if (!this.splashAt(p, .32 + .3 * weight, priority, p.id)) {
          this.play({ cue: 'fx-land-heavy', gain: .34 * weight * weightGain(heavy), rate: (1.12 - weight * .14) * weightRate(heavy), phase: 'impact' }, p, priority, p.id);
          this.play({ cue: floor.takes[0], gain: floor.gain * 2.2 * weight, rate: .7 * weightRate(heavy), delay: .008, phase: 'impact' }, p, priority, p.id);
        }
        this.play({ cue: 'cloth', gain: .2 * weight, rate: .9, delay: .015, phase: 'impact' }, p, priority, p.id);
      }
      // An ordinary landing - off a jump, down from an air attack - made no sound at all: both feet on the floor it is,
      // by how far the body fell and how heavy it is. (Not a body thrown down: that is the fall above.)
      else if (!seen.grounded && p.grounded && !FALLS.has(seen.action) && !FALLS.has(p.action) && now - seen.airFrom > .25 && !(now - (this.voicedLandings.get(p.id) ?? -9) < .35)) {
        const priority = p.id === selfId ? 3 : 0, drop = Math.min(1, .45 + Math.max(0, seen.peak - p.y) * .2);
        this.play({ cue: floor.takes[0], gain: floor.gain * 1.7 * drop * weightGain(heavy), rate: .84 * weightRate(heavy), phase: 'impact' }, p, priority, p.id);
        this.play({ cue: floor.takes[1], gain: floor.gain * 1.3 * drop * weightGain(heavy), rate: .8 * weightRate(heavy), delay: .028, phase: 'impact' }, p, priority, p.id);
        if (heavy >= GIANT) this.play({ cue: 'ground', gain: .3 * drop * heavy, rate: 1 - .25 * heavy, phase: 'impact' }, p, priority, p.id);
      }
      const priority = p.id === selfId ? 3 : 0;
      // A take-off: on the floor a moment ago and rising now, or a new jump
      // straight out of one (a hop off the landing, quicker than a snapshot).
      // Not the fall that ends an air attack or an air dash, or a step off an
      // edge: those are 'jump' too, but nobody pushed off anything.
      if (p.action === 'jump' && p.actionStarted > seen.jump) {
        seen.jump = p.actionStarted;
        if ((seen.grounded && p.y > seen.y) || seen.action === 'jump') {
          // (The push off the floor it is, where it was the one `ground` thud: lower and fuller for a heavy body.)
          this.play({ cue: 'fx-tech', gain: .3, rate: 1.06 * weightRate(heavy), phase: 'release' }, p, priority, p.id);
          this.play({ cue: floor.takes[1], gain: floor.gain * 1.5 * weightGain(heavy), rate: 1.15 * weightRate(heavy), phase: 'release' }, p, priority, p.id);
        }
      }
      // The guard coming up. A blow taken on it holds the action at 'guard'
      // through the blockstun rather than restarting it, and is heard as the block.
      if (p.action === 'guard' && p.actionStarted > seen.guard) {
        seen.guard = p.actionStarted;
        if (seen.action !== 'guard') {
          this.play({ cue: 'fx-tech', gain: .2, rate: 1.3, phase: 'release' }, p, priority, p.id);
          this.play({ cue: 'cloth', gain: .1, rate: 1.15, delay: .012, phase: 'release' }, p, priority, p.id);
        }
      }
      seen.action = p.action; seen.grounded = p.grounded; seen.y = p.y;
    }
    if (this.moves.size > players.length) for (const id of this.moves.keys()) if (!players.some(p => p.id === id)) this.moves.delete(id);
  }
  private moves = new Map<string, { action: PlayerState['action']; grounded: boolean; y: number; airFrom: number; peak: number; jump: number; guard: number }>();
  /** When each fighter's landing was last voiced by the simulation ('land', 'ground-bounce'): no body fall over it. */
  private voicedLandings = new Map<string, number>();
  private movesOf = '';
  handle(events: CombatEvent[], selfId: string, players: PlayerState[]) {
    if (this.dead) return;
    if (this.selfId && this.selfId !== selfId) this.reset();
    this.selfId = selfId; this.latestPlayers = players;
    const self = players.find(p => p.id === selfId);
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id); if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!);
      const actor = players.find(p => p.id === event.actorId), target = players.find(p => p.id === event.targetId);
      const resolved = { ...event, fighter: event.fighter ?? actor?.fighter };
      const local = event.actorId === selfId || event.targetId === selfId;
      // (An area move's release is heard at its circle, where the element is going: its strikes land there.)
      const at = event.kind === 'cast' || event.kind === 'release' ? (event.kind === 'release' && event.slot === 'area' && event.endpoint || event.origin || actor) : (event.endpoint ?? target ?? event.origin ?? actor);
      if (event.kind === 'cast' && actor && event.slot) {
        this.cancelOwner(actor.id, true);
        // The local fighter's casts are announced by the prediction on the
        // frame the button goes down, against a snapshot that still shows
        // whatever they were doing before it. Binding the cast to *that*
        // action and then checking the presented state against it, as this
        // used to, cancelled every one of them on the same call: the voice
        // line was faded out sixty-five milliseconds in, and any layer with
        // a delay longer than that - every swing, every delayed callout - was
        // stopped before it started. It is why Nigo, whose every cue is
        // delayed or spoken, was heard to make no sound at all.
        const shown = actor.action === event.slot && actor.actionStarted > event.serverTime - CAST_MATCH;
        this.casts.set(actor.id, { started: shown ? actor.actionStarted : undefined, before: actor.actionStarted,
          announced: performance.now() / 1000, slot: event.slot, released: false });
      } else if (event.kind === 'release') {
        const cast = this.casts.get(event.actorId); if (cast) cast.released = true;
        // The full callout crosses the release boundary. Keep its final syllable
        // and natural tail intact through recovery and later non-voiced attacks.
        for(const sound of this.sounds)if(sound.owner===event.actorId&&sound.bus==='voice'&&sound.phase==='cast')sound.phase='release';
        this.cancelOwner(event.actorId, false);
      }
      // A perfect guard and a clash the player is part of are heard as events: everything else steps back for them.
      if (local && (event.kind === 'just-guard' || event.kind === 'projectile-clash')) this.hush();
      // The voice situations (voiceSituations.ts): who is in the event - the roster's fighters only; the Rift's enemies
      // have their own voices (RiftAudio) - and a line of the body acted on is theirs, from where they stand.
      const scene = { actor: actor && !actor.enemy ? actor.fighter : undefined, target: target && !target.enemy ? target.fighter : undefined,
        targetHealth: target && target.maxHp > 0 ? target.hp / target.maxHp : undefined };
      // (A blow on a body `soften` names - the ball modes' ball - keeps its effects at that share, under the body's own sound.)
      const soft = event.kind === 'hit' && event.targetId ? this.softBodies.get(event.targetId) : undefined;
      if (at) for (const layer of planCombatAudio(resolved, !!actor?.awakened, scene))
        this.play(soft !== undefined && (layer.bus ?? 'sfx') === 'sfx' ? { ...layer, gain: layer.gain * soft } : layer,
          (layer.speaker ? players.find(p => p.id === layer.speaker) : undefined) ?? at, local ? 4 : 1, layer.speaker ?? event.actorId, event.id);
      if (self) {
        // Only speak in an actual gap. Never replace a move name, boss line or victory quote.
        // (The quip left to the director is the advantage line on a guard or a poise broken: QuipDirector.ts.)
        const quip = this.quips.plan(event, self, () => {
          const kit = FIGHTER_QUIPS[self.fighter];
          if (this.context?.state !== 'running' || this.mix.master <= 0 || this.mix.voice <= 0
            || (kit.advantage !== undefined && !this.buffers.has(kit.advantage))) return false;
          for (const sound of this.sounds) if (sound.bus === 'voice' && !sound.stopping) return false;
          return true;
        });
        if (quip) this.play(quip, self, 1, self.id, event.id);
      }
      if (event.kind === 'land' || event.kind === 'ground-bounce') this.voicedLandings.set(event.actorId, this.context?.currentTime ?? 0);
      if (at && (event.kind === 'land' || event.kind === 'ground-bounce')) this.splashAt(at, event.kind === 'land' ? .6 : .5, local ? 4 : 1, event.actorId);
    }
    // Cancellation follows presented state, never a speculative input timer.
    const now = performance.now() / 1000;
    for (const [id, cast] of this.casts) {
      const player = players.find(p => p.id === id);
      if (!player) { this.cancelOwner(id, !cast.released); this.casts.delete(id); continue; }
      if (cast.started === undefined) {
        // Announced ahead of authority. The snapshot arriving at the cast is
        // the confirmation; anything else that has started since - a hit
        // taken, a different move - is authority overruling the prediction,
        // and so is a silence longer than a round trip has any business being.
        if (player.action === cast.slot && player.actionStarted > cast.before) { cast.started = player.actionStarted; continue; }
        const overruled = player.actionStarted > cast.before && !NEUTRAL.has(player.action);
        if (overruled || now - cast.announced > CAST_CONFIRM) { this.cancelOwner(id, !cast.released); this.casts.delete(id); }
        continue;
      }
      if (player.actionStarted !== cast.started || player.action !== cast.slot) {
        this.cancelOwner(id, !cast.released); this.casts.delete(id);
      }
    }
    this.movement(players, selfId); // jumps and guards going up: see movement
    this.holdAuras(players, selfId); // each awakened fighter's own power, held while it stands on them
    for (const player of players) {
      if (player.action === 'dash' && this.dashStates.get(player.id) !== player.actionStarted) {
        this.dashStates.set(player.id, player.actionStarted);
        // Launch day 5: by the body (a heavy one moves more air, lower) and, off the floor, the scuff of the push.
        const heavy = weightNow(player), priority = player.id === selfId ? 3 : 0;
        this.play({ cue: 'swing-b', gain: .35 * weightGain(heavy), rate: .82 * weightRate(heavy), phase: 'release' }, player, priority, player.id);
        this.play({ cue: 'cloth', gain: .18, delay: .035, phase: 'release' }, player, priority, player.id);
        if (player.grounded) { const floor = STEPS[surfaceAt(this.ambienceStage, this.liquid, player.y)]; this.play({ cue: floor.takes[0], gain: floor.gain * 1.2 * weightGain(heavy), rate: 1.3 * weightRate(heavy), phase: 'release' }, player, priority, player.id); }
      }
    }
    for (const id of this.dashStates.keys()) if (!players.some(p => p.id === id)) this.dashStates.delete(id);
  }
  /** Launch day 5 (12 October 2026): the effects already sounding step back to `depth` of themselves for `seconds`,
   *  then come back - so the sound laid next (a Perfect Parry, a clash) stands alone for a moment, as the picture's
   *  freeze does. Each sound's own gain, not the bus (the parry is on the bus too); the beds held on awakened fighters
   *  are left (holdAuras sets their level every frame), and a sound not yet begun keeps its own schedule. A sound that
   *  would have ended inside the hush fades out as it was going to. */
  private hush(depth = .35, seconds = .2) {
    const ctx = this.context;
    if (!ctx) return;
    const now = ctx.currentTime, back = now + seconds;
    for (const sound of this.sounds) {
      if (sound.bus !== 'sfx' || sound.stopping || sound.start > now || sound.owner === 'ui' || sound.owner.startsWith('aura:')) continue;
      const g = sound.gain.gain;
      try {
        g.cancelScheduledValues(now); g.setValueAtTime(sound.level, now); g.linearRampToValueAtTime(sound.level * depth, now + .015);
        if (sound.end > back + .04) {
          const tail = Math.min(.09, (sound.end - sound.start) * .2);
          g.setValueAtTime(sound.level * depth, back - .05); g.linearRampToValueAtTime(sound.level, back);
          g.setValueAtTime(sound.level, Math.max(back, sound.end - tail)); g.linearRampToValueAtTime(0, sound.end);
        } else g.linearRampToValueAtTime(0, sound.end);
      } catch { /* A stand-in context without scheduling: the sound plays on at its level. */ }
    }
  }
  /** One layer outside the combat plan: arcade survival's enemies have no
   *  cue plan of their own and are voiced from the shared impact library. */
  cue(cue: CueLayer['cue'], at: Vec3, gain: number, rate = 1, owner = 'survival', priority = 1, delay = 0) {
    if (this.dead) return;
    this.play({ cue, gain, rate, delay, phase: 'impact' }, at, priority, owner);
  }
  /** Where the listener is: a sound placed here is heard dead centre, at full level. */
  private here(): Vec3 { return this.latestPlayers.find(p => p.id === this.selfId) ?? { x: 0, y: 0, z: 0 }; }
  /** A presentation sound - the VS splash, the FIGHT! card, a finisher's camera cut - heard centred, its loudest
   *  moment `at` seconds from now (SFX_PEAKS), as the combat plan puts a swing's on its contact. */
  ui(cue: CueLayer['cue'], gain: number, at = 0, rate = 1) {
    if (this.dead) return;
    const peak = (SFX_PEAKS[cue] ?? 0) / rate;
    this.play({ cue, gain, rate, delay: Math.max(0, at - peak), phase: 'impact' }, this.here(), 6, 'ui');
  }
  /** The announcer (scripts/survival/announcer), heard centred on the voice bus. A line not loaded yet is fetched
   *  for next time and skipped now: preload it with the match. */
  announce(url: string, gain: number, delay = 0) { this.sample(url, this.here(), gain, 1, 'announcer', 8, delay, 'voice'); }
  /** The feel pass, iteration thirteen: the winner's own line over their victory pose (main.ts) - the
   *  fighter's line from the home screen's voices - on the voice bus, under its own owner so the announcer's VICTORY!
   *  before it is not cut. A line not loaded yet is fetched for next time and skipped now: preload it with the room. */
  quote(url: string, gain: number, delay = 0) { this.sample(url, this.here(), gain, 1, 'victory', 7, delay, 'voice'); }
  say(kind: VoiceSituation, id: string, wait = 0): number | undefined {
    const who = this.latestPlayers.find(p => p.id === id);
    if (this.dead || !who || who.enemy || !who.alive) return;
    const now = performance.now() / 1000, key = `${id}:${kind}`;
    if (now - (this.saidAt.get(key) ?? -Infinity) < SITUATION_RULES[kind].rest) return;
    const line = this.turn(who.fighter, kind, false);
    if (!line || !this.play(situationLayer(kind, line, id, wait), who, id === this.selfId ? 4 : 1, id)) return;
    this.turn(who.fighter, kind); this.saidAt.set(key, now);
    if (this.saidAt.size > 64) this.saidAt.delete(this.saidAt.keys().next().value!);
    return lineSeconds(line);
  }
  /** FIGHT! (main.ts, on the card's beat): the local fighter's line once the announcer has called it, then the nearest
   *  opponent's once that has been said - two voices, however many are in the room, and the second asked for only when
   *  its turn comes (the mixer counts the speakers there are when a line is scheduled, not when it starts). */
  bell(after = .9) {
    const self = this.latestPlayers.find(p => p.id === this.selfId);
    if (this.dead || !self) return;
    const mine = this.say('bell', self.id, after);
    let foe: PlayerState | undefined, nearest = Infinity;
    for (const p of this.latestPlayers) {
      if (p.id === self.id || p.enemy || !p.alive || (self.team && p.team === self.team)) continue;
      const distance = Math.hypot(p.x - self.x, p.z - self.z);
      if (distance < nearest) { nearest = distance; foe = p; }
    }
    if (!foe) return;
    const id = foe.id;
    clearTimeout(this.bellTimer);
    this.bellTimer = setTimeout(() => { this.bellTimer = undefined; this.say('bell', id); }, (after + (mine ? mine + .25 : 0)) * 1000);
  }
  /** The result (main.ts, as the champion is shown). The winner's line was always their line from the home screen
   *  (`quote`), said at FINALE.lineAt and timed with the finale; it still is, for every fighter with no `win` line of
   *  their own, by the same statement in main.ts as before. A fighter who has one says that instead: `winLine` says it -
   *  on the voice bus under the victory's own owner at `quote`'s priority, so the announcer's VICTORY! is not cut - and
   *  returns how long it is, or nothing (no line of their own, or it could not be played: main.ts then says the home
   *  line, so a winner is never silent). `winSeconds` is that line's length for the finale's clock: the one being said,
   *  or the one that would be. */
  winLine(winner: FighterId, delay = 0): number | undefined {
    if (this.dead) return;
    const line = this.turn(winner, 'win', false);
    if (!line) return;
    const { speaker: _speaker, ...layer } = situationLayer('win', line, '', delay);
    if (!this.play(layer, this.here(), 7, 'victory')) return;
    this.turn(winner, 'win'); this.wonWith = { fighter: winner, line };
    return lineSeconds(line);
  }
  winSeconds(fighter: FighterId): number | undefined {
    const line = this.wonWith?.fighter === fighter ? this.wonWith.line : this.turn(fighter, 'win', false);
    // Only a line that is ready to be said times the finale: one not decoded is not said (the home line is).
    return line && (isRift(line) ? this.samples.has(riftUrl(line)) : this.buffers.has(line)) ? lineSeconds(line) : undefined;
  }
  private wonWith?: { fighter: FighterId; line: SituationLine };
  /** And the local fighter's loss line, where they have one, `delay` seconds from now: after the winner has spoken. */
  lossLine(delay = 0) {
    const self = this.latestPlayers.find(p => p.id === this.selfId);
    if (this.dead || !self || self.enemy) return;
    const line = this.turn(self.fighter, 'loss');
    if (!line) return;
    const { speaker: _speaker, ...layer } = situationLayer('loss', line, '', delay);
    this.play(layer, this.here(), 6, 'defeat');
  }
  /** One of a fighter's lines of a kind, each in its turn (`advance` false: the next one, without taking the turn). */
  private turn(fighter: FighterId, kind: VoiceSituation, advance = true): SituationLine | undefined {
    const lines = situationLines(fighter, kind), key = `${fighter}:${kind}`, n = this.turns.get(key) ?? 0;
    if (!lines.length) return;
    if (advance) this.turns.set(key, n + 1);
    return lines[n % lines.length];
  }
  private saidAt = new Map<string, number>();
  private turns = new Map<string, number>();
  private bellTimer?: ReturnType<typeof setTimeout>;
  /** A loaded sample's length in seconds, or undefined until it has been decoded (preload). */
  sampleSeconds(url: string) { return this.samples.get(url)?.duration; }
  /** A big blow (game/bigBlow.ts: the last blow of a special, an ultimate, an ender, a rush finisher) lands with
   *  more than its own impact: the ground's weight under it, a fall pitched down, and a low crack, on top of the
   *  plan's layers - the sound of the freeze the picture holds (main.ts dips the score under it). */
  bigBlow(at: Vec3, owner: string, worth = 1) {
    if (this.dead) return;
    const level = Math.max(.6, Math.min(1.15, worth));
    this.play({ cue: 'fx-land-heavy', gain: .46 * level, rate: .84, phase: 'impact' }, at, 5, owner);
    this.play({ cue: 'crack', gain: .3 * level, rate: .78, delay: .012, phase: 'impact' }, at, 5, owner);
    this.ambience?.cheer(worth);
  }
  /** The place's sound (audio/ambience.ts) for `stage`, or none: arcade survival and the objective modes have their
   *  own beds. Kept until the context opens, if it has not. */
  setAmbience(stage: StageId | undefined) {
    this.ambienceStage = stage; this.ambience?.set(stage);
    const liquid = stage ? LIQUID_FLOORS[stage] : undefined;
    if (liquid !== this.liquid) { this.liquid = liquid; if (liquid && this.context) this.preload(SPLASHES); }
  }
  /** The place's liquid floor (game/footing.ts): footsteps, take-offs and falls in it are heard as splashes. */
  private liquid?: LiquidFloor;
  private splashAt(at: Vec3, gain: number, priority: number, owner: string) {
    if (!onLiquid(this.liquid, at.y)) return false;
    const url = SPLASHES_BIG[Math.floor(Math.random() * SPLASHES_BIG.length)];
    this.sample(url, at, gain, .92 + Math.random() * .12, owner, priority);
    return true;
  }
  /** The stands, where there are stands: a roar for the winner. */
  cheer(worth = 1, win = false) { this.ambience?.cheer(worth, win); }

  // ---- The ball modes (src/audio/ballAudio.ts): a few general hooks ---------------------------------------------------
  /** Blows on the external body `id` (the ball) keep their effects at `share` of their gain (none: as they are), so the
   *  body's own sound leads and the fighter's blow is its colour underneath. */
  soften(id: string, share?: number) { if (share === undefined) this.softBodies.delete(id); else this.softBodies.set(id, Math.max(0, share)); }
  private softBodies = new Map<string, number>();
  /** A one-shot by url heard centred on the listener, at a presentation sound's priority (a whistle, a horn, a riser: the
   *  stadium's, not a place's). One not loaded yet is fetched for next time and skipped now. */
  centred(url: string, gain: number, delay = 0, rate = 1, priority = 6) { this.sample(url, this.here(), gain, rate, 'ui', priority, delay); }
  /** The stands react (a roar, an "ooh", a groan): a one-shot on the place's own bus beside its crowd bed, not ducked
   *  under the voices and not counted against the effects' twenty, played wide (two copies panned apart, a few
   *  milliseconds and a hair of pitch between them, as a wide bed is). */
  stands(url: string, gain: number, delay = 0, rate = 1, owner?: string) {
    const ctx = this.context, buffer = this.samples.get(url);
    if (!buffer) { void this.loadSample(url); return; }
    if (!ctx || ctx.state !== 'running' || !this.ambienceBus || this.dead || this.mix.master <= 0 || this.mix.sfx <= 0) return;
    const start = ctx.currentTime + Math.max(0, delay);
    [[-.6, 0, 1], [.6, .017, .992]].forEach(([side, late, bend]) => {
      const source = ctx.createBufferSource(), level = ctx.createGain(), pan = ctx.createStereoPanner();
      source.buffer = buffer; source.playbackRate.value = rate * bend; level.gain.value = gain * Math.SQRT1_2; pan.pan.value = side;
      source.connect(level).connect(pan).connect(this.ambienceBus!);
      const held = owner ? { source, level } : undefined;
      if (held) { const list = this.standsBy.get(owner!) ?? []; list.push(held); this.standsBy.set(owner!, list); }
      source.onended = () => {
        source.disconnect(); level.disconnect(); pan.disconnect();
        if (held) { const list = this.standsBy.get(owner!), at = list?.indexOf(held) ?? -1; if (at >= 0) list!.splice(at, 1); if (list && !list.length) this.standsBy.delete(owner!); }
      };
      source.start(start + late);
    });
  }
  /** The stands' reactions played under an owner (`stands`'s last argument), so they can be taken back (`takeBack`). */
  private standsBy = new Map<string, { source: AudioBufferSourceNode; level: GainNode }[]>();
  /** Takes back what was played under `owner` - one-shots (`sample`, by its owner; with `url`, only that file's) and the
   *  stands' reactions played under it - faded over `fade` s, or never started if they were still to come. In the
   *  ball modes the page plays its own touch of the ball at once, and the room can refuse it (ballAudio.ts). (Not
   *  `hush`, which steps every effect back for a parry's moment.) */
  takeBack(owner: string, url?: string, fade = .1) {
    const buffer = url === undefined ? undefined : this.samples.get(url);
    if (url !== undefined && !buffer) return;
    for (const sound of this.sounds) if (sound.owner === owner && (!buffer || sound.source.buffer === buffer)) this.stop(sound, fade);
    if (url !== undefined) return;
    const ctx = this.context, list = this.standsBy.get(owner);
    if (!ctx || !list) return;
    for (const { source, level } of list) {
      try { const now = ctx.currentTime; holdAt(level.gain, now); level.gain.linearRampToValueAtTime(0, now + fade); source.stop(now + fade + .005); } catch { /* Already ended. */ }
    }
    this.standsBy.delete(owner);
  }
  /** How worked up the stands are (0-1): their bed held from quiet under play to loud at the peaks (StageAmbience.tension). */
  crowdTension(level: number) { this.ambience?.tension(level); }
  /** Held loops by key (the ball's OVERDRIVE roar, the stands' chant): started once the file is in, carried to `at` (none:
   *  centred) at `gain` every call with the effects' distance and pan, and let go with a fade at gain 0. `loop`: the
   *  seconds the file loops between (a seamless period of the file). `bus` 'ambience': the place's own. */
  loopAt(key: string, url: string, gain: number, options: { at?: Vec3; loop?: readonly [number, number]; bus?: 'sfx' | 'ambience'; rate?: number } = {}) {
    const ctx = this.context, held = this.loops.get(key);
    if (!ctx || this.dead) return;
    if (!(gain > .0005)) { if (held) this.letLoopGo(key, .5); return; }
    const buffer = this.samples.get(url);
    if (!buffer) { void this.loadSample(url); return; }
    const out = options.bus === 'ambience' ? this.ambienceBus : this.sfx;
    if (ctx.state !== 'running' || !out) return;
    let level = gain, side = 0;
    const listener = options.at && this.latestPlayers.find(p => p.id === this.selfId);
    if (options.at && listener) {
      const dx = options.at.x - listener.x, dz = options.at.z - listener.z, d2 = dx * dx + dz * dz;
      level = d2 > 48 * 48 ? 0 : gain / (1 + d2 / 120);
      side = Math.max(-.8, Math.min(.8, (dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw)) / 12));
    }
    const now = ctx.currentTime;
    if (held && held.url === url) {
      held.gain.gain.setTargetAtTime(level, now, .08); held.pan.pan.setTargetAtTime(side, now, .08);
      held.source.playbackRate.setTargetAtTime(options.rate ?? 1, now, .2);
      return;
    }
    if (held) this.letLoopGo(key, .3);
    const source = ctx.createBufferSource(), level0 = ctx.createGain(), pan = ctx.createStereoPanner();
    source.buffer = buffer; source.loop = true; source.playbackRate.value = options.rate ?? 1;
    const [from, to] = options.loop ?? [0, buffer.duration];
    source.loopStart = Math.max(0, from); source.loopEnd = Math.min(buffer.duration, Math.max(from + .05, to));
    level0.gain.setValueAtTime(0, now); level0.gain.setTargetAtTime(level, now, .12); pan.pan.value = side;
    source.connect(level0).connect(pan).connect(out);
    source.start(now, source.loopStart);
    this.loops.set(key, { source, gain: level0, pan, url });
  }
  private loops = new Map<string, { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode; url: string }>();
  private letLoopGo(key: string, fade: number) {
    const held = this.loops.get(key), now = this.context?.currentTime ?? 0;
    if (!held) return;
    this.loops.delete(key);
    try { holdAt(held.gain.gain, now); held.gain.gain.linearRampToValueAtTime(0, now + fade); held.source.stop(now + fade + .05); } catch { /* Already stopped. */ }
    held.source.onended = () => { held.source.disconnect(); held.gain.disconnect(); held.pan.disconnect(); };
  }
  /** The stage the fight is in (audio/space.ts), or none: arcade survival and the objective modes keep their dry mix. */
  setSpace(stage: StageId | undefined) {
    if (spaceName(stage) === spaceName(this.stage) && this.reverbReady(stage)) { this.stage = stage; return; }
    this.stage = stage; this.applySpace();
  }
  private reverbReady(stage: StageId | undefined) { return !this.reverb || !spaceFor(stage) || !!this.reverb.convolver.buffer; }
  /** The stage's impulse worked out ahead (main.ts, as a room loads; 31 October 2026): the fight's first frame computed it,
   *  4-14 ms in the frames the loading screen fades over. The same buffer, so nothing sounds any different. */
  prepareSpace(stage: StageId | undefined) {
    const space = spaceFor(stage), name = spaceName(stage);
    if (space && name && this.context && this.reverb && !this.dead) this.impulse(space, name);
  }
  private impulse(space: Space, name: SpaceName) {
    const ctx = this.context!;
    let buffer = this.irs.get(name);
    if (!buffer) {
      const [left, right] = impulseResponse(space, ctx.sampleRate);
      buffer = ctx.createBuffer(2, left.length, ctx.sampleRate);
      buffer.copyToChannel(left, 0); buffer.copyToChannel(right, 1);
      this.irs.set(name, buffer);
    }
    return buffer;
  }
  private applySpace() {
    const ctx = this.context, reverb = this.reverb;
    if (!ctx || !reverb || this.dead) return;
    const space = spaceFor(this.stage), name = spaceName(this.stage), now = ctx.currentTime;
    if (!space || !name) { reverb.out.gain.setTargetAtTime(0, now, .12); reverb.sfx.gain.setTargetAtTime(0, now, .12); reverb.speech.gain.setTargetAtTime(0, now, .12); return; }
    const buffer = this.impulse(space, name);
    if (reverb.convolver.buffer !== buffer) reverb.convolver.buffer = buffer;
    reverb.sfx.gain.setTargetAtTime(space.wet, now, .05); reverb.speech.gain.setTargetAtTime(space.wet * VOICE_SHARE, now, .05);
    reverb.out.gain.setTargetAtTime(1, now, .2);
  }
  /** A new room (main.ts, as its load begins): the own cues - voices, a fighter's own sounds - of the fighters it does not
   *  have are let go, and the room's keep theirs. Their decoded sound was held for the rest of the page's life: a room's
   *  voices are 50-75 MB of PCM (404, 757 and 1,010 buffers, 78, 152 and 204 MB, after one, two and three matches in one
   *  page), which no fighter outside the room will ever play. A fighter who comes back is asked for again by `prepare`
   *  (from the browser's cache); a rematch, whose fighters are all in the room, loads nothing. The match's own cues, the
   *  one-shots (`sample`) and a load still in flight are left alone. Returns how many buffers went. */
  retain(fighters: Iterable<string>): number {
    if (!this.options.byRoom) return 0;
    const keep = new Set(fighters), stay = new Set<AudioCue>();
    for (const id of keep) for (const cue of fighterCues(id as FighterId)) stay.add(cue);
    let released = 0;
    for (const cue of [...this.cueLoads.keys()]) {
      const owner = cueFighter(cue);
      // A fighter's own, or a by-need sound none of the room's fighters names (a world's power with nobody of it here).
      if (owner ? keep.has(owner) : !byNeed(cue) || stay.has(cue)) continue;
      if (!this.buffers.has(cue)) continue;
      this.buffers.delete(cue); this.cueLoads.delete(cue); released++;
    }
    // (And their lines outside the bank, unless a fighter who stays says the same one: voiceSituations.ts.)
    const gone = [...this.wanted].filter(id => !keep.has(id));
    if (gone.length) { const kept = new Set(situationSamples(keep)); this.release(situationSamples(gone).filter(url => !kept.has(url))); }
    for (const id of gone) this.wanted.delete(id);
    for (const cue of [...this.needed]) if (!stay.has(cue)) this.needed.delete(cue);
    return released;
  }
  /** One-shots no longer wanted let go (the Armory's, once the effects that played them are: SoundBank.retain): their decoded
   *  sound and their load record, so a later `sample` or `preload` of one fetches it again. */
  release(urls: readonly string[]) { for (const url of urls) { this.samples.delete(url); this.sampleLoads.delete(url); } }
  /** Fetch and decode one-shots ahead of their first use. */
  preload(urls: readonly string[]) { for (const url of urls) void this.loadSample(url); }
  /** Resolves once everything asked for so far has been fetched and decoded - the bank's cues, the room's voices and
   *  by-need sounds (`prepare`, whose batches are asked for a task apart: those still to be asked are waited for too),
   *  the one-shots handed over (`preload`) - or after `cap` ms: a room's loading screen waits for its sound
   *  before FIGHT (never long), so the decodes do not land as a burst of main-thread work in the fight's first seconds
   *  (117 ms frames, 118 buffers at once: scripts/night/load_hitches.mjs). */
  async ready(cap = 4000): Promise<void> {
    const all = [this.loading, ...this.asking, ...this.cueLoads.values(), ...this.sampleLoads.values()].filter((p): p is Promise<void> => !!p);
    if (!all.length || this.dead) return;
    await Promise.race([Promise.allSettled(all), new Promise<void>(done => setTimeout(done, cap))]);
  }
  private loadSample(url: string): Promise<void> {
    let loading = this.sampleLoads.get(url);
    if (loading) return loading;
    // Asked for before the context exists (a room prepared ahead of the first click): nothing is recorded, so the next
    // ask loads it. (The record was made after the early return below had tried to remove it, and stayed: a one-shot
    // preloaded too early was then never loaded at all.)
    if (!this.context || this.dead) return Promise.resolve();
    loading = (async () => {
      const ctx = this.context;
      if (!ctx || this.dead) { this.sampleLoads.delete(url); return; }
      try {
        const buffer = await ctx.decodeAudioData(await this.download(survivalStandIn(url), { signal: this.abort.signal }, url));
        if (!this.dead) this.samples.set(url, buffer);
      } catch (error) { if (!this.dead) console.warn(error); }
    })();
    this.sampleLoads.set(url, loading);
    return loading;
  }
  /** A one-shot by url, placed in the world: arcade survival's horde and boss
   *  voices. One not loaded yet is loaded for next time and skipped now. */
  sample(url: string, at: Vec3, gain: number, rate = 1, owner = 'horde', priority = 0, delay = 0, bus: 'sfx' | 'voice' = 'sfx') {
    if (this.dead) return;
    const buffer = this.samples.get(url);
    if (!buffer) { void this.loadSample(url); return; }
    this.play({ cue: 'swing-a', gain, rate, delay, phase: 'impact', bus }, at, priority, owner, undefined, buffer);
  }
  private play(layer: CueLayer, at: Vec3, priority: number, owner: string,sequence?:number, override?: AudioBuffer): ActiveSound | undefined {
    // (A situation line outside the bank - `url` - is one of the one-shots loaded with the room: voiceSituations.ts.)
    const ctx = this.context, buffer = override ?? (layer.url ? this.samples.get(layer.url) : this.buffers.get(layer.cue)), bus = layer.bus ?? 'sfx';
    // A cue nobody asked for yet (a fighter's, played outside their room's plan) is fetched for next time.
    if (!buffer && ctx && !this.dead && layer.url) void this.loadSample(layer.url);
    else if (!buffer && ctx && !this.dead && !this.cueLoads.has(layer.cue) && layer.cue in AUDIO_CUES) void this.loadCue(layer.cue);
    if (!ctx || ctx.state !== 'running' || !buffer || !this.master || this.mix.master <= 0 || this.mix[bus] <= 0 || this.dead) return;
    const listener = this.latestPlayers.find(p => p.id === this.selfId);
    const dx = listener ? at.x - listener.x : 0, dz = listener ? at.z - listener.z : 0, distance = Math.hypot(dx, dz);
    if (distance > (bus === 'voice' ? 25 : 48)) return;
    const sameBus = [...this.sounds].filter(sound => sound.bus === bus && !sound.stopping);
    if(bus==='voice'){
      // The voice situations: a line that yields is never said over one its own speaker is still saying - a signature
      // always takes precedence, and a missed moment is dropped, never played late - and a cry ('all') never takes a
      // speaker's place either: a hit cry must never cut a move's call, its own fighter's or anyone's.
      if(layer.yields&&(sameBus.some(sound=>sound.owner===owner)||(layer.yields==='all'&&new Set(sameBus.map(sound=>sound.owner)).size>=2)))return;
      priority+=layer.voicePriority??1;
      // Several spoken segments of one cast are one scheduled performance.
      // Scheduling its later line must not cancel the opening call now.
      const previous=sameBus.filter(sound=>sound.owner===owner&&(sequence===undefined||sound.sequence!==sequence));
      // A released signature keeps its complete tail when the next move starts.
      if(previous.some(sound=>sound.phase==='release'&&sound.priority>=priority))return;
      for(const old of previous){if(old.phase==='release'){holdAt(old.gain.gain,ctx.currentTime);old.gain.gain.setTargetAtTime(old.gain.gain.value*.65,ctx.currentTime,.12);}else this.stop(old,.08);}
    }
    const count = sameBus.filter(sound => !sound.stopping);
    const groups=bus==='voice'
      ? [...new Set(count.map(sound=>sound.owner))].map(actor=>count.filter(sound=>sound.owner===actor))
      : count.map(sound=>[sound]);
    const continuingOwner=bus==='voice'&&groups.some(group=>group[0].owner===owner);
    if (!continuingOwner&&groups.length >= (bus === 'voice' ? 2 : 20)) {
      const weakest=groups.filter(group=>bus!=='voice'||!group.some(sound=>sound.owner===this.selfId&&sound.phase==='release'))
        .sort((a,b)=>Math.max(...a.map(s=>s.priority))-Math.max(...b.map(s=>s.priority)))[0];
      if(!weakest||Math.max(...weakest.map(s=>s.priority))>priority)return;
      for(const sound of weakest)this.stop(sound,.08);
    }
    const source = ctx.createBufferSource(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
    source.buffer = buffer; source.playbackRate.value = layer.rate ?? 1; source.loop = layer.loop ?? false;
    if (source.loop) { source.loopStart = Math.min(.08, buffer.duration * .1); source.loopEnd = Math.max(source.loopStart + .03, buffer.duration - .08); }
    // Skip whatever dead air the file opens with, so what lands on the beat
    // is the transient rather than the head of the wav. Measured per cue by
    // scripts/measure_cue_onsets.mjs: koko-hush holds 250 ms of room tone
    // before the line and ouga-big-bang 240, which is two thirds of a heavy
    // wind-up spent waiting for a sound that has already been triggered. A
    // little is left in front so a soft attack is not clipped off.
    const onset = override || layer.url ? 0 : Math.max(0, ((CUE_ONSETS as Record<string, number>)[layer.cue] ?? 0) - .015);
    const start = ctx.currentTime + (layer.delay ?? 0);
    const duration = layer.duration ?? (buffer.duration - onset) / source.playbackRate.value;
    const attenuation = 1 / (1 + distance * distance / (bus === 'voice' ? 75 : 120)), level = layer.gain * attenuation;
    gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + (source.loop ? .075 : .004));
    const tail = Math.min(bus === 'voice' ? .04 : source.loop ? .1 : .09, duration * .2);
    gain.gain.setValueAtTime(level, start + Math.max(.005, duration - tail)); gain.gain.linearRampToValueAtTime(0, start + duration);
    const side = listener ? dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw) : 0;
    pan.pan.value = Math.max(-.8, Math.min(.8, side / (bus === 'voice' ? 20 : 12)));
    source.connect(gain).connect(pan).connect(bus === 'voice' ? this.speech! : this.sfx!);
    const sound: ActiveSound = { source, gain, pan, priority, owner, bus, phase: layer.phase, stopping: false,sequence, start, level, end: start + duration };
    this.sounds.add(sound);
    source.onended = () => { this.sounds.delete(sound); source.disconnect(); gain.disconnect(); pan.disconnect(); this.updateVoiceActivity(); };
    source.start(start, onset); source.stop(start + duration + .005); this.updateVoiceActivity();
    return sound;
  }
  /** Each fighter's power (auraVoice), one held loop apiece, carried and panned with them every frame and let go with a
   *  fade when it no longer stands. At most AURA_VOICES of them: the player's own, then the nearest within AURA_RANGE (one
   *  already sounding keeps its place against a newcomer less than two metres closer, so two fighters side by side do
   *  not trade the loop every frame). A loop the effects' cap took is started again. */
  private auras = new Map<string, { sound: ActiveSound; cue: AudioCue }>();
  private holdAuras(players: PlayerState[], selfId: string) {
    const ctx = this.context;
    if (!ctx) return;
    const listener = players.find(p => p.id === selfId);
    const rows: { id: string; voice: NonNullable<ReturnType<typeof auraVoice>>; near: number }[] = [];
    for (const p of players) {
      const voice = auraVoice(p);
      if (!voice) continue;
      const own = p.id === selfId, distance = listener ? Math.hypot(p.x - listener.x, p.z - listener.z) : 0;
      if (own || distance <= AURA_RANGE) rows.push({ id: p.id, voice, near: own ? -1 : distance - (this.auras.has(p.id) ? 2 : 0) });
    }
    rows.sort((a, b) => a.near - b.near);
    const heard = new Map(rows.slice(0, AURA_VOICES).map(row => [row.id, row.voice]));
    for (const p of players) {
      const own = p.id === selfId, voice = heard.get(p.id);
      let held = this.auras.get(p.id);
      if (held?.sound.stopping) { this.auras.delete(p.id); held = undefined; }
      // Over (or crowded out), or another power's loop than the one it holds: let go.
      if (held && (!voice || held.cue !== voice.cue)) { this.stop(held.sound, .7); this.auras.delete(p.id); held = undefined; }
      if (!voice) continue;
      const level = voice.level * (own ? 1 : .65);
      if (!held) {
        const sound = this.play({ cue: voice.cue, gain: level, loop: true, duration: 3600, phase: 'release', ...(voice.rate !== 1 ? { rate: voice.rate } : {}) }, p, own ? 2 : 0, `aura:${p.id}`);
        if (sound) this.auras.set(p.id, { sound, cue: voice.cue });
        continue;
      }
      const dx = listener ? p.x - listener.x : 0, dz = listener ? p.z - listener.z : 0;
      const attenuation = 1 / (1 + (dx * dx + dz * dz) / 120), side = listener ? dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw) : 0;
      held.sound.gain.gain.setTargetAtTime(level * attenuation, ctx.currentTime, .12);
      held.sound.pan.pan.setTargetAtTime(Math.max(-.8, Math.min(.8, side / 12)), ctx.currentTime, .1);
    }
    for (const [id, held] of this.auras) if (!players.some(p => p.id === id)) { this.stop(held.sound, .4); this.auras.delete(id); }
  }
  private updateVoiceActivity(levelTau?: number) {
    const now = this.context?.currentTime ?? 0;
    const voices = this.mix.master > 0 && this.mix.voice > 0 ? [...this.sounds].filter(sound => sound.bus === 'voice' && !sound.stopping) : [];
    const active = voices.some(sound => sound.start - DUCK_LEAD <= now + .001);
    const next = active || !voices.length ? undefined : Math.min(...voices.map(sound => sound.start)) - DUCK_LEAD;
    if (next !== this.duckAt || (next !== undefined && this.duckTimer === undefined)) {
      clearTimeout(this.duckTimer); this.duckTimer = undefined;
      if (next !== undefined && !this.dead) this.duckTimer = setTimeout(() => { this.duckTimer = undefined; this.updateVoiceActivity(); }, Math.max(10, (next - now) * 1000 + 5));
    }
    const flipped = active !== this.voiceActive;
    if (!flipped && next === this.duckAt && levelTau === undefined) return;
    this.voiceActive = active; this.duckAt = next;
    const gain = this.sfx?.gain;
    if (this.context && gain) {
      // From now: what was set for a line that has since been stopped, or for the old mix, is taken back.
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(this.mix.sfx * (active ? VOICE_DUCK : 1), now, levelTau ?? (active ? DUCK_DOWN : DUCK_UP));
      if (next !== undefined) gain.setTargetAtTime(this.mix.sfx * VOICE_DUCK, next, DUCK_DOWN);
    }
    if (flipped) this.onVoiceActivity?.(active);
  }
  private cancelOwner(owner: string, interrupted: boolean) {
    for (const sound of this.sounds) if (sound.owner === owner && (sound.phase === 'charge' || (interrupted && sound.phase === 'cast'))) this.stop(sound, .06);
  }
  private stop(sound: ActiveSound, fade = .035) {
    if (sound.stopping) return; sound.stopping = true;
    try { const now = this.context?.currentTime ?? 0; holdAt(sound.gain.gain, now); sound.gain.gain.linearRampToValueAtTime(0, now + fade); sound.source.stop(now + fade + .005); } catch { /* Already ended. */ }
    this.updateVoiceActivity();
  }
  reset() { for (const key of [...this.loops.keys()]) this.letLoopGo(key, .3); for (const sound of this.sounds) this.stop(sound); this.auras.clear(); this.standsBy.clear(); this.seen.clear(); this.dashStates.clear(); this.casts.clear(); this.quips.reset(); clearTimeout(this.bellTimer); this.bellTimer = undefined; this.saidAt.clear(); }
  dispose() { this.dead = true; clearTimeout(this.duckTimer); clearTimeout(this.bellTimer); this.abort.abort(); this.ambience?.dispose(); this.ambienceBus?.disconnect(); this.reset(); this.buffers.clear(); this.samples.clear(); this.reverb?.out.disconnect(); this.irs.clear(); this.master?.disconnect(); this.sfx?.disconnect(); this.speech?.disconnect(); this.compressor?.disconnect();for(const source of this.musicSources.values())source.disconnect();this.musicSources.clear(); void this.context?.close().catch(() => {}); }
}
