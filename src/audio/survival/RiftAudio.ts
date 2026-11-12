import { audioContext } from '../contextRate';
import type { FeedItem, RunView } from '../../survival/SurvivalGame';
import type { CombatEvent } from '../../game/types';
import { attackShout, linesOf, moveLine, ownLine, signatureLine, voicedOnCast } from '../bossVoices';
import { BOSSES, loopOf, rankFor } from '../../survival/bosses';
import { LOCATIONS, FINAL_ROUND } from '../../survival/locations';
import { asleep } from '../wake';
import { survivalStandIn } from '../standIns';

const ANNOUNCE = { run: 5, boss: 5, kill: 4, down: 5, finish: 4, round: 3, event: 3, style: 2, chain: 2, level: 1, pickup: 1, finisher: 6 } as const;
const EVENT_LINE: Record<string, string> = { 'HORDE SURGE': 'event-surge', 'ELITE HUNT': 'event-elites', 'BLOOD ECLIPSE': 'event-eclipse', SIEGE: 'event-siege', 'RIFT STORM': 'event-storm', 'TREASURE HOARDER': 'event-hoarder' };
const pickOne = (...ids: string[]) => ids[Math.floor(Math.random() * ids.length)];

type Place = 'rift-village' | 'rift-swords' | 'rift-fortress' | 'rift-eclipse' | 'rift-frost' | 'rift-grove' | 'rift-wastes' | 'rift-harbor';
/** The new places' synthesis borrows an old place's (the recordings over it are their own). */
const SYNTH_OF: Partial<Record<Place, Place>> = { 'rift-frost': 'rift-swords', 'rift-grove': 'rift-swords', 'rift-wastes': 'rift-village', 'rift-harbor': 'rift-fortress' };
type Signature = 'quake' | 'magma' | 'ice' | 'light' | 'void' | 'power' | 'beast' | 'steel' | 'soul' | 'door' | 'brute';
/** What each boss sounds like arriving, by enemy id (src/survival/enemies.ts). */
const SIGNATURE: Record<string, Signature> = {
  haldor: 'quake', barrow: 'void', caldera: 'magma', ashwing: 'magma', gorai: 'magma', 'gorai-wyrm': 'magma', rime: 'ice', lumen: 'light',
  shiun: 'void', akagane: 'void', nihil: 'void', 'wuming': 'power', 'jinlin': 'power', banjaku: 'power',
  kade: 'beast', harrow: 'beast', kurobi: 'beast', zarek: 'beast', 'nightfall': 'beast',
  'dune-oni': 'steel', kuromitsu: 'steel', takane: 'steel', mirabel: 'soul', kanuki: 'door', gantry: 'brute', oro: 'void',
  magatsu: 'steel', vesper: 'void', imago: 'beast',
};
interface Voice { stop(at: number): void }
interface Bed { place: Place; out: GainNode; voices: Voice[]; next: number; tick(now: number): void }

/** The recorded families RiftAudio plays itself (the horde's voices are the
 *  game's: src/audio/survivalBank.ts), and how many takes each has. */
const TAKES = { scream: 5, laugh: 3, chain: 3, thunder: 1, 'spell-fire': 7, shatter: 7, 'blade-swing': 10, 'blade-clash': 10, 'iron-hit': 8, quake: 7, 'demon-roar': 12, 'star-groan': 3, 'chain-strain': 3 } as const;
type Take = keyof typeof TAKES;
interface Accent { take: Take; every: readonly [number, number]; gain: number; rate: readonly [number, number] }
/** Each place's recorded bed - its loops and their levels - and what is heard
 *  over it now and then, far off. */
const RECORDED: Record<Place, { loops: readonly (readonly [string, number])[]; accents: readonly Accent[] }> = {
  'rift-village': { loops: [['bed-village-fire', .95], ['bed-village-crackle', .6]], accents: [{ take: 'scream', every: [7, 18], gain: .26, rate: [.85, 1.05] }] },
  'rift-swords': { loops: [['bed-armoury-lake', .95], ['bed-armoury-reeds', .7], ['bed-swords-wind', .5], ['bed-swords-crows', .3]], accents: [{ take: 'blade-clash', every: [8, 19], gain: .12, rate: [.55, .75] }] },
  'rift-fortress': { loops: [['bed-fortress-storm', 1]], accents: [{ take: 'chain', every: [9, 22], gain: .2, rate: [.7, .9] }, { take: 'scream', every: [15, 32], gain: .14, rate: [.7, .85] }] },
  'rift-eclipse': { loops: [['bed-fallen-star', .95], ['bed-swords-wind', .45]], accents: [{ take: 'star-groan', every: [12, 26], gain: .2, rate: [.85, 1] }, { take: 'chain-strain', every: [9, 20], gain: .16, rate: [.85, 1] }] },
  'rift-frost': { loops: [['bed-swords-wind', 1]], accents: [{ take: 'shatter', every: [9, 20], gain: .14, rate: [.5, .7] }, { take: 'chain', every: [18, 34], gain: .1, rate: [.6, .8] }] },
  'rift-grove': { loops: [['bed-swords-wind', .75], ['bed-swords-crows', .7]], accents: [{ take: 'laugh', every: [16, 32], gain: .16, rate: [.8, .95] }, { take: 'scream', every: [20, 40], gain: .1, rate: [.8, 1] }] },
  'rift-wastes': { loops: [['bed-village-fire', .55], ['bed-eclipse-belly', .8]], accents: [{ take: 'demon-roar', every: [9, 22], gain: .14, rate: [.45, .6] }, { take: 'quake', every: [14, 30], gain: .16, rate: [.5, .65] }] },
  'rift-harbor': { loops: [['bed-fortress-storm', .8]], accents: [{ take: 'chain', every: [8, 18], gain: .18, rate: [.6, .8] }, { take: 'scream', every: [18, 36], gain: .1, rate: [.7, .85] }] },
};
/** The synthesised bed's level once its recordings are in. */
const SYNTH_UNDER = .35;
const between = ([a, b]: readonly [number, number]) => a + Math.random() * (b - a);

const SETTINGS_KEY = 'rift-settings';
/** Bed level (before the player's volume) and how far it swells with a full field. */
const BED = .5, BED_CROWD = .25;

/** A cosmetic's sound, for what plays it outside the effects (a streak banner in the HUD): the run's audio
 *  answers it once it is made (RiftAudio.cosmetic). */
export const COSMETIC_SOUND: { play(kind: 'bell' | 'thud' | 'drum' | 'swish', distance?: number, strikes?: number): void } = { play: () => {} };

export class RiftAudio {
  constructor() { COSMETIC_SOUND.play = (kind, distance, strikes) => this.cosmetic(kind, distance, strikes); }
  private ctx?: AudioContext;
  private master?: GainNode;
  private beds?: GainNode;
  private hits?: GainNode;
  private wet?: GainNode;
  /** War drums under a big boss fight: their own level, swelling with the boss's rank. */
  private drumBus?: GainNode;
  /** Bosses' spoken lines, at the player's voice volume rather than effects. */
  private voices?: GainNode;
  private voiceVolume = 1;
  private readonly spoke = new Map<string, number>();
  private readonly lines = new Map<string, Promise<AudioBuffer | undefined>>();
  /** Recordings, fetched once and kept (the lines above are let go as the ranks move on). */
  private readonly recorded = new Map<string, Promise<AudioBuffer | undefined>>();
  /** The horde snarling all round, as thick as the field is. */
  private hordeOut?: GainNode;
  /** The bosses' voice channel: one line at a time (35 of 132 lines began over
   *  another), and no line again within twenty seconds (Banjaku said "this
   *  power" eight times in 39 s). `voiceUntil` is on the audio clock. */
  private voiceUntil = 0;
  private readonly heard = new Map<string, number>();
  /** The announcer's channel (ANNOUNCE): until when a line holds it, at what
   *  priority, and when each line was last called. */
  private caller?: GainNode;
  private callUntil = 0;
  private callPriority = 0;
  private readonly called = new Map<string, number>();
  /** What the announcer watches between feed items: the round, the style
   *  grade, the KO chain, the fighter's lowest health this round, the bosses. */
  private seenRound = 0;
  private styleHeld = 0;
  private chain = { kills: 0, count: 0, at: 0, called: 0 };
  private roundLow = 1;
  private roundState = '';
  private finishCalled = new Set<string>();
  /** When a finisher last landed: the boss's DEFEATED line is not said over its word for it. */
  private finisherAt = -1e9;
  private selfId = '';
  /** When a relic this fighter took is shown (the run's clock), to be heard then. */
  private relicDue = 0;
  private drumNext = 0;
  private drumStep = 0;
  private white?: AudioBuffer;
  private brown?: AudioBuffer;
  private bed?: Bed;
  private lastFeed = 0;
  private lastTime = -1;
  private still = 0;
  private settingsAt = -10;
  private volume = 1;
  private hidden = false;
  private over = false;
  private readonly resume = () => { if (asleep(this.ctx) && !this.hidden) void this.ctx.resume().catch(() => {}); };
  private readonly visibility = () => {
    this.hidden = document.hidden;
    if (!this.ctx) return;
    if (this.hidden) void this.ctx.suspend().catch(() => {}); else this.resume();
  };

  /** Per frame, from the survival effects: the place's bed, its level, the pause. */
  update(view: RunView | undefined, time: number, dt: number) {
    if (!view || view.phase === 'lobby') { this.fade(0, 1); return; }
    if (!this.start()) return;
    const ctx = this.ctx!, now = ctx.currentTime;
    if (performance.now() - this.settingsAt > 1500) this.readSettings();
    // Paused (the arena stops its clock) or choosing a card: the world holds its breath.
    this.still = time === this.lastTime ? this.still + dt : 0;
    this.lastTime = time;
    const place = view.location?.stage as Place;
    if (place && (!this.bed || this.bed.place !== place)) this.setBed(place);
    // The run ends: its own sound - a fall, or (banked at the seal) the fanfare
    // again - not silence and then the menu's music.
    if (view.phase === 'over' && !this.over) {
      if (view.result?.victory) { this.banked(); this.call('victory', ANNOUNCE.run, 30, .6); }
      else { this.defeat(); this.call('you-fell', ANNOUNCE.run, 30, .4); this.call('game-over', ANNOUNCE.run, 30, 2.2); }
    }
    this.over = view.phase === 'over';
    const crowd = Math.min(1, (view.horde ?? 0) / 90);
    const level = this.over ? 0 : this.still > .25 ? .18 : BED + crowd * BED_CROWD;
    this.beds!.gain.setTargetAtTime(level, now, this.over ? 1.2 : .35);
    this.hordeBed(this.over || this.still > .25 ? 0 : Math.pow(crowd, .8) * .6, now);
    this.master!.gain.setTargetAtTime(this.volume, now, .1);
    this.voices!.gain.setTargetAtTime(this.voiceVolume, now, .1);
    this.preload(view);
    this.bed?.tick(now);
    this.warDrums(view, now);
    this.watch(view);
  }

  /** The announcer's eye on the run between its feed items. */
  private watch(view: RunView) {
    if (view.phase !== 'fight' || this.hidden || this.still > .25) return;
    this.selfId = view.party[0]?.id ?? this.selfId;
    // A relic taken, heard as its seal is shown.
    if (this.relicDue && view.time >= this.relicDue) { this.relicDue = 0; this.braam(.45); this.chime([392, 587.3, 784], .11); }
    // The style grade climbing to S, SS and SSS.
    // (Not S: the grade climbs through S, SS and SSS inside ten seconds of a
    // good start, and three calls on each other's heels were noise.)
    const grade = view.style?.rank ?? 0;
    if (grade > this.styleHeld && grade >= 5) this.call(grade >= 6 ? 'style-sss' : 'style-ss', ANNOUNCE.style, 30);
    this.styleHeld = grade;
    // The KO chain: kills without three seconds between them.
    const t = performance.now() / 1000, kills = view.kills ?? 0;
    if (kills > this.chain.kills) {
      if (t - this.chain.at > 3) { this.chain.count = 0; this.chain.called = 0; }
      this.chain.count += kills - this.chain.kills; this.chain.at = t;
      const milestone = [400, 200, 100, 50].find(n => this.chain.count >= n && this.chain.called < n);
      if (milestone) { this.chain.called = milestone; this.call(`chain-${milestone}`, ANNOUNCE.chain, 20); }
    }
    this.chain.kills = kills;
    // (FINISH IT is said at the brink now - the 'finish' beat - not at a tenth of its health.)
    // The round won: cleared - or, without a scratch, flawless.
    const me = view.party[0];
    if (me && me.maxHp > 0) this.roundLow = Math.min(this.roundLow, me.hp / me.maxHp);
    if (view.roundState !== this.roundState) {
      if (view.roundState === 'interlude' && this.roundState === 'battle') this.call(this.roundLow >= .999 ? 'flawless' : 'round-clear', ANNOUNCE.round, 10, 1.6);
      this.roundState = view.roundState ?? '';
    }
  }

  /** One of the announcer's lines (scripts/survival/announcer), fetched once
   *  and kept: not again within `gap` seconds; while another holds the
   *  channel, a line that matters more waits its turn (a second and a half at
   *  most), one that matters as much or less is dropped. Everything else ducks a
   *  little under it. */
  private call(id: string, priority: number, gap = 6, delay = 0) {
    if (!this.ctx || !this.caller || this.hidden) return false;
    const ctx = this.ctx, now = ctx.currentTime;
    if (now - (this.called.get(id) ?? -1e9) < gap) return false;
    let at = now + delay;
    if (at < this.callUntil) {
      if (priority <= this.callPriority && priority < ANNOUNCE.boss) return false;
      if (this.callUntil - at > 1.5) return false;
      at = this.callUntil + .06;
    }
    this.called.set(id, now);
    const claim = at + 1.1;
    this.callUntil = Math.max(this.callUntil, claim); this.callPriority = priority;
    const url = `/assets/audio/survival/announcer-${id}.m4a`;
    void this.load(url).then(decoded => {
      if (!decoded || this.hidden) { if (this.callUntil === claim) this.callUntil = 0; return; }
      const start = Math.max(ctx.currentTime, at);
      if (this.callUntil === claim) this.callUntil = start + decoded.duration;
      const source = ctx.createBufferSource();
      source.buffer = decoded; source.connect(this.caller!);
      source.start(start);
      this.cue(`announce-${id}`, decoded.duration);
      // Everything else steps back while it is said.
      for (const bus of [this.beds!, this.hits!, this.drumBus!]) {
        const g = bus.gain, base = g.value;
        g.setTargetAtTime(base * .55, start, .04); g.setTargetAtTime(base, start + decoded.duration, .25);
      }
    });
    return true;
  }
  /** The fighter's own awakening (SurvivalFx sees the arena's events). */
  awakened() { this.call('awakened', ANNOUNCE.pickup, 20); }

  /** The beats of the run, off its feed. */
  handle(feed: readonly FeedItem[]) {
    if (!feed.length || !this.start()) return;
    for (const item of feed) {
      if (item.id <= this.lastFeed) continue;
      this.lastFeed = item.id;
      if (this.hidden || this.still > .25) continue;
      const evolved = item.value === 2 || item.sub === 'evolved';
      switch (item.kind) {
        case 'round': {
          this.drums(3);
          const round = Number((item.text ?? '').replace(/\D+/g, '')) || 0;
          this.roundLow = 1; this.finishCalled.clear();
          const first = round <= 1 || this.seenRound === 0;
          const line = round >= FINAL_ROUND + 1 ? 'round-deeper' : round === FINAL_ROUND ? 'round-final' : `round-${Math.max(1, round)}`;
          this.call(line, ANNOUNCE.run, 4, .15);
          if (first) this.call('fight', ANNOUNCE.run, 4, 1.25);
          this.seenRound = round;
          break;
        }
        // Techniques: the cut's burst rings and cracks; the afterimage is its blade again, softer.
        case 'rend': if (item.value && this.allow('rend', 5)) { this.weapon('steel', true); this.crack(); } break;
        case 'echo': if (this.allow('echo', 5)) this.weapon('steel', false); break;
        case 'boss': {
          this.braam(item.boss ? 1 : .55); this.signature(item.enemy, item.boss ? 1 : .6);
          if (item.boss) this.call(item.rank === 'S' ? 'boss-s' : pickOne('boss-1', 'boss-2', 'boss-3'), ANNOUNCE.boss, 4);
          else this.call('champion', ANNOUNCE.event, 25);
          // The boss's own voice after the announcer has named the moment.
          this.speak(item.enemy, 'entrance', item.boss ? 1.3 : .35);
          break;
        }
        case 'enraged': this.enrage(); this.speak(item.enemy, 'rage', .25);
          if (item.value === 3) { this.braam(1); this.rumble(1.2); this.call('awakens', ANNOUNCE.boss, 10, .35); }
          else if (item.boss || item.value === 2) this.call(item.value === 2 ? 'last-stand' : 'enraged', ANNOUNCE.event, 15, .5);
          break;
        case 'break': if (item.boss) this.speak(item.enemy, 'hurt', 0, 9); break;
        case 'event': this.horn(); if (EVENT_LINE[item.text ?? '']) this.call(EVENT_LINE[item.text ?? ''], ANNOUNCE.event, 20, .6); break;
        case 'location': {
          this.toll();
          const place = LOCATIONS.find(location => location.name === item.text);
          if (place) this.call(`place-${place.id}`, ANNOUNCE.event, 30, 1);
          break;
        }
        case 'down': if (item.boss) { this.fall(); this.speak(item.enemy, 'defeat', 1.4); this.fellAt = performance.now(); if (performance.now() - this.finisherAt > 2500) this.call(pickOne('boss-down-1', 'boss-down-2', 'boss-down-3'), ANNOUNCE.kill, 4, .25); } break;
        // The bosses' set pieces and the fight's beats (the fifth list).
        case 'signature': if (this.allow('signature', 2)) { this.signature(item.enemy, .55); this.braam(.35); const said = signatureLine(item.enemy ?? '', item.text); if (said) this.say(said, 1); } break;
        case 'charge': this.call('break-it', ANNOUNCE.event, 8, .3); this.rumble(item.value !== undefined ? Math.max(.5, item.value - item.at) : 3); break;
        case 'charge-end': if (item.value === 1) { this.ice(true); this.call('broken', ANNOUNCE.kill, 6); } else { this.thump(true); this.meteor(.01, true); } break;
        case 'wave': if (this.allow('wave', 1.2)) this.whoosh(true); break;
        case 'fissure': if (this.allow('fissure', 1.2)) { this.crack(); this.take('quake', this.hits!, .5, .85 * this.vary(), this.ctx!.currentTime + Math.max(0, (item.value ?? item.at) - item.at)); } break;
        case 'pool': if (this.allow('pool', 1.5)) this.take(item.element === 'ice' ? 'shatter' : 'spell-fire', this.hits!, .35, .8 * this.vary(), this.ctx!.currentTime + Math.max(0, (item.value ?? item.at) - item.at)); break;
        case 'shatter': if (this.allow('shatter', .4)) this.ice(false); break;
        case 'finish': this.call('finish', ANNOUNCE.finisher, 3); this.braam(.8); break;
        case 'finisher': this.finisherAt = performance.now(); this.triumph(); this.call(item.value === 2 ? 'team-ultimate' : pickOne('finisher', 'execution'), ANNOUNCE.finisher, 3, .15); break;
        case 'team': this.braam(1); this.thump(true); this.call('team-ultimate', ANNOUNCE.finisher, 6, .1); break;
        case 'paths': this.whoosh(true); this.call('choose-path', ANNOUNCE.event, 10, .6); break;
        case 'path': this.braam(.5); this.whoosh(false); if (item.text) this.call(`path-${item.text}`, ANNOUNCE.event, 4, .1); break;
        case 'finale': this.triumph(); this.call('sealed', ANNOUNCE.run, 30, .8); break;
        case 'fallen': if (item.hero !== this.selfId) this.call('ally-down', ANNOUNCE.down, 5); break;
        case 'rescued': this.call('ally-up', ANNOUNCE.event, 8); break;
        case 'pack': if ((item.text ?? '').startsWith('ELITE')) this.call('elite', ANNOUNCE.event, 15); break;
        case 'lair': this.call('lair', ANNOUNCE.event, 30, .4); break;
        // A level won off a boss's fall waits for its fall and its last line
        // (the chimes landed on 11 of 14 boss deaths, the line under them).
        case 'level': if (item.hero === undefined || item.hero === this.selfId) this.call('level-up', ANNOUNCE.level, 8, .35); if (this.allow('level', 2)) { const wait = this.fellAt + 1800 - performance.now(); if (wait > 0) window.setTimeout(() => this.ascend(), wait); else this.ascend(); } break;
        // Pickups, each its own small sound.
        case 'pickup': if (this.allow('pickup', 3)) this.chime([523.3, 659.3], .07); break;
        case 'meter': if (this.allow('meter', 3)) this.chime([784, 1175], .05, 'sawtooth'); break;
        case 'momentum': if (item.hero === undefined || item.hero === this.selfId) this.chime([659.3, 880, 1318.5].slice(0, 1 + Math.min(2, Math.floor((item.value ?? 1) / 2))), .05, 'sawtooth'); break;
        case 'second-wind': if (item.hero === undefined || item.hero === this.selfId) { this.chime([392, 523.3, 784], .1); this.whoosh(false); } break;
        // Co-op drop-in: the announcer calls the fighter out of their rift.
        case 'challenger': if (item.value === 1) { this.call('new-challenger', ANNOUNCE.boss, 4); this.whoosh(true); } break;
        case 'chest': this.chime([523.3, 659.3, 784, 1046.5], .09); this.call('treasure', ANNOUNCE.pickup, 20, .3); break;
        case 'magnet': this.whoosh(false); break;
        case 'bomb': this.thump(true); this.meteor(.01, false); break;
        // The arts, each heard once as itself when thrown (their victims are quiet).
        // (Each over its synthesis, the recorded thing itself: thunder, fire, breaking ice, steel through the air, the ground struck.)
        case 'smite': if (this.allow('smite', 5)) { this.thunderclap(evolved); this.take('thunder', this.hits!, evolved ? .7 : .5, this.vary() * .92, 0, .15); } break;
        case 'whirl': if (this.allow('whirl', 4)) { this.whoosh(evolved); this.take('blade-swing', this.hits!, .34, .78 * this.vary()); } break;
        case 'pillar': if (item.sub !== 'crater' && this.allow('pillar', 4)) { this.fireburst(evolved); this.take('spell-fire', this.hits!, evolved ? .55 : .42, this.vary()); } break;
        case 'meteor': if (this.allow('meteor', 6)) { const fall = Math.max(.2, (item.value ?? 0) - item.at); this.meteor(fall, evolved); this.take('quake', this.hits!, evolved ? .75 : .55, .8 * this.vary(), this.ctx!.currentTime + fall); } break;
        case 'frost': if (this.allow('frost', 2)) { this.ice(evolved); this.take('shatter', this.hits!, .4, this.vary()); } break;
        case 'slash': if (this.allow('slash', 6)) { this.zing(evolved); this.take('blade-swing', this.hits!, .3, 1.08 * this.vary()); } break;
        case 'shockwave': case 'burst': case 'counter': case 'will': if (this.allow('thump', 4)) { this.thump(item.kind === 'will' || item.kind === 'counter'); this.take('quake', this.hits!, .32, this.vary()); } break;
        case 'crescent': if (this.allow('crescent', 4)) { this.zing(true); this.take('blade-swing', this.hits!, .3, this.vary()); } break;
        case 'chain': if (this.allow('chain', 4)) this.zap(); break;
        // Boss relics (survival/relics.ts): one taken is heard as it is shown (after its boss's fall has
        // had the screen, on the run's clock); the ones that go off big are heard as themselves.
        case 'relic':
          if ((item.sub === 'taken' || item.sub === 'waiting') && item.hero === this.selfId) this.relicDue = Math.max(this.relicDue, item.value ?? item.at);
          else if (item.sub === 'stop') { this.braam(1); this.thump(true); }
          else if (item.sub === 'shrine') this.braam(.7);
          else if (item.sub === 'quake' && this.allow('quake', 2)) { this.thump(true); this.take('quake', this.hits!, .6, .8 * this.vary()); }
          else if ((item.sub === 'mochi' || item.sub === 'iron-shock') && this.allow('relic-blow', 3)) this.thump(item.sub === 'iron-shock');
          else if (item.sub === 'nightfang' && this.allow('nightfang', 3)) { this.zing(true); this.take('blade-swing', this.hits!, .36, .7 * this.vary()); }
          else if (item.sub === 'cut' && this.allow('slash', 6)) this.zing(false);
          break;
      }
    }
  }

  /** A boss throwing a move it names says the name, as it throws it; its other
   *  blows get a shout now and then. Bosses that name no moves are voiced by
   *  the game's own boss voices (src/audio/bossVoices.ts) instead. */
  casts(events: readonly CombatEvent[]) {
    if (!events.length || !this.ctx || this.hidden || this.still > .25) return;
    const now = performance.now() / 1000;
    for (const event of events) {
      if (event.kind !== 'cast' || !event.enemy || !voicedOnCast(event.enemy)) continue;
      if (now < (this.spoke.get(event.actorId) ?? 0)) continue;
      const named = moveLine(event.enemy, event.move);
      const line = named ?? (Math.random() < .4 ? attackShout(event.enemy) : undefined);
      if (!line) continue;
      if (!this.say(line, named ? 1 : .85)) continue;
      this.spoke.set(event.actorId, now + (named ? 3 : 6));
    }
  }

  /** A boss's own line for a moment of the run, `delay` seconds on (after
   *  its brass), at most once every `every` seconds for that boss. */
  private speak(enemy: string | undefined, moment: 'entrance' | 'rage' | 'hurt' | 'defeat', delay = 0, every = 0) {
    const line = enemy ? ownLine(enemy, moment) : undefined;
    if (!line) return;
    const now = performance.now() / 1000, key = `${enemy}:${moment}`;
    if (every && now < (this.spoke.get(key) ?? 0)) return;
    // An entrance, a rage and a fall wait their turn (briefly); the rest is dropped when the channel is busy.
    if (this.say(line, 1, delay, moment !== 'hurt')) this.spoke.set(key, now + every);
  }

  /** The lines of the bosses this rank and the next can send, loaded before
   *  they arrive (and the rest let go): a line fetched on first use lands
   *  seconds after its moment. */
  private preloadAt = 0;
  private preloadKey = '';
  private preload(view: RunView) {
    const now = performance.now();
    if (now < this.preloadAt || !view.round) return;
    this.preloadAt = now + 2000;
    const round = Math.max(1, view.round), ranks = new Set(loopOf(round + 1) > 0 ? ['A', 'S'] : [rankFor(round), rankFor(round + 1)]);
    const ids = BOSSES.filter(entry => ranks.has(entry.rank)).map(entry => entry.id);
    if (ids.includes('gorai')) ids.push('gorai-wyrm');
    const key = ids.join(',');
    if (key === this.preloadKey) return;
    this.preloadKey = key;
    const wanted = new Set(ids.flatMap(linesOf));
    for (const url of [...this.lines.keys()]) if (!wanted.has(url)) this.lines.delete(url);
    for (const url of wanted) this.load(url);
  }

  private load(url: string) {
    const ctx = this.ctx!;
    let buffer = this.lines.get(url);
    if (!buffer) {
      buffer = fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(url))).then(bytes => ctx.decodeAudioData(bytes)).catch(() => undefined);
      this.lines.set(url, buffer);
    }
    return buffer;
  }

  /** One recorded line on the voice channel, fetched once and kept. A line
   *  heard in the last twenty seconds is not said again; while another plays,
   *  a `priority` line waits for it (up to a second and a half) and any other
   *  is dropped. Returns whether it will be said. */
  private say(url: string, gain: number, delay = 0, priority = false) {
    const ctx = this.ctx!, now = ctx.currentTime;
    if (now - (this.heard.get(url) ?? -1e9) < 20) return false;
    let at = now + delay;
    if (at < this.voiceUntil) {
      if (!priority || this.voiceUntil - at > 1.5) return false;
      at = this.voiceUntil + .08;
    }
    this.heard.set(url, now);
    // Held for the line's length once it is known; a guess until then.
    const claim = at + 1.2;
    this.voiceUntil = Math.max(this.voiceUntil, claim);
    void this.load(url).then(decoded => {
      if (!decoded || this.hidden) { if (this.voiceUntil === claim) this.voiceUntil = 0; return; }
      const start = Math.max(ctx.currentTime, at);
      if (this.voiceUntil === claim) this.voiceUntil = start + decoded.duration;
      const source = ctx.createBufferSource(), level = ctx.createGain();
      source.buffer = decoded; level.gain.value = gain;
      source.connect(level); level.connect(this.voices!);
      source.start(start);
    });
    return true;
  }

  /** A boss's second wind: a snarl of brass and a roll of drums under its roar. */
  /** Power gathering: a low swell rising under everything for `seconds`
   *  (a charge being built, an awakening drawn in). */
  private rumble(seconds: number) {
    this.cue('boss-gather', seconds);
    const ctx = this.ctx!, at = ctx.currentTime + .02, out = this.hits!;
    const body = this.burst(this.brown!, out, at, Math.max(.3, seconds * .85), .5, .55, ['lowpass', 180, .8], .6); this.send(body, .35);
    const f = this.filter('bandpass', 220, 4), g = this.gain(0, out); f.connect(g); this.send(g, .3);
    f.frequency.setValueAtTime(160, at); f.frequency.exponentialRampToValueAtTime(900, at + seconds);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.12, at + seconds * .9); g.gain.exponentialRampToValueAtTime(.0001, at + seconds + .3);
    for (const freq of [55, 82.4]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, at); o.frequency.exponentialRampToValueAtTime(freq * 2, at + seconds); o.connect(f); o.start(at); o.stop(at + seconds + .35); }
  }
  private enrage() {
    this.cue('boss-enrage', 2);
    const ctx = this.ctx!, at = ctx.currentTime + .02, out = this.hits!;
    const f = this.filter('lowpass', 400, 3), g = this.gain(0, out); f.connect(g); this.send(g, .4);
    f.frequency.setValueAtTime(400, at); f.frequency.exponentialRampToValueAtTime(2600, at + .5); f.frequency.exponentialRampToValueAtTime(700, at + 1.6);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.2, at + .08); g.gain.exponentialRampToValueAtTime(.0001, at + 1.8);
    for (const freq of [73.4, 77.8, 110, 146.8]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, at); o.frequency.linearRampToValueAtTime(freq * .94, at + 1.6); o.connect(f); o.start(at); o.stop(at + 1.9); }
    for (let i = 0; i < 6; i++) {
      const t = at + i * .075, hit = .35 + i * .1;
      this.tone('sine', 140 - i * 8, 50, t, .003, .3, .45 * hit, out, .15);
      this.burst(this.white!, out, t, .001, .06, .12 * hit, ['bandpass', 1100, .9]);
    }
  }

  /** Names each synthesised sound for a capture's cue log (gauntlet_capture.py
   *  defines the hook; a player's browser never has it). */
  private cue(name: string, seconds = 0, rate = 1) { (globalThis as { __riftCue?: (name: string, seconds: number, rate: number) => void }).__riftCue?.(name, seconds, rate); }
  /** Each cast of an art pitched a little its own way (0.88-1.14): the same
   *  synthesis at the same pitch, hundreds of times a run, is a machine gun. */
  private vary() { return .88 + Math.random() * .26; }

  /** Something great coming down beyond the field, `distance` metres off: the
   *  crack of it giving way, then (as it lands, most of a second on) its
   *  weight arriving as a crunch and a long rumble. */
  /** A kill effect's own sound, as a whole one plays (render/cosmetics/kills.ts KILL_SOUND): Kintsugi's bell,
   *  the seal's thud; a streak banner's drum (`strikes` beats, louder at every mark). Quieter the further off. */
  cosmetic(kind: 'bell' | 'thud' | 'drum' | 'swish', distance = 0, strikes = 1) {
    if (!this.ctx || this.hidden || this.still > .25 || !this.allow(`cosmetic-${kind}`, kind === 'drum' || kind === 'swish' ? 2 : 5)) return;
    this.cue(`cosmetic-${kind}`);
    const at = this.ctx.currentTime + .01, out = this.hits!, near = Math.max(.25, 1 - distance / 45);
    if (kind === 'bell') {
      // A small temple bell: a struck partial, its inharmonic overtones dying first, in the room's air.
      const f = [659.3, 740, 880, 987.8, 1174.7][Math.floor(Math.random() * 5)];
      [[1, .1, 2.2], [2.76, .045, 1.1], [5.4, .025, .5], [8.9, .012, .25]].forEach(([ratio, level, decay]) => { const o = this.tone('sine', f * ratio, f * ratio, at, .002, decay, level * near, out, decay); this.send(o, .55); });
    } else if (kind === 'thud') {
      // A seal brought down on a desk: a low knock and the thump of the wood.
      this.tone('sine', 150, 48, at, .002, .28, .42 * near, out, .12);
      this.burst(this.brown!, out, at, .001, .09, .5 * near, ['lowpass', 700, .8]);
      this.burst(this.white!, out, at, .001, .025, .18 * near, ['bandpass', 1800, 1.4]);
    } else if (kind === 'swish') {
      // A wide brush dragged across paper: a breath of noise sweeping up, and the bristles' rasp.
      const sweep = this.burst(this.white!, out, at, .05, .32, .22, ['bandpass', 900, 1.1]);
      sweep.frequency.setValueAtTime(500, at); sweep.frequency.exponentialRampToValueAtTime(2600, at + .3);
      this.burst(this.brown!, out, at + .02, .02, .25, .2, ['lowpass', 900, .7]);
    } else {
      // A taiko: the head's deep boom, the rim's crack, struck `strikes` times.
      for (let i = 0; i < strikes; i++) {
        const t = at + i * .17, w = i === strikes - 1 ? 1 : .7;
        const boom = this.tone('sine', 92, 46, t, .003, .6, .62 * w, out, .3); this.send(boom, .3);
        this.burst(this.brown!, out, t, .002, .16, .55 * w, ['lowpass', 380, .9]);
        this.burst(this.white!, out, t, .001, .03, .14 * w, ['bandpass', 2600, 2]);
      }
    }
  }

  collapse(distance: number) {
    if (!this.ctx || this.hidden || this.still > .25) return;
    this.cue('collapse', 3.6);
    const at = this.ctx.currentTime + Math.min(.4, distance / 340), out = this.hits!, far = Math.max(.35, 1 - distance / 160), land = at + .85;
    for (let i = 0; i < 3; i++) this.burst(this.white!, out, at + i * .07 + Math.random() * .04, .002, .1, .12 * far, ['bandpass', 900 + Math.random() * 900, 1.4]);
    for (let i = 0; i < 5; i++) this.burst(this.white!, out, land + i * .06 + Math.random() * .05, .002, .16, .2 * far, ['bandpass', 350 + Math.random() * 600, 1]);
    const rumble = this.burst(this.brown!, out, land, .12, 2.8, .75 * far, ['lowpass', 220, .8], .6); this.send(rumble, .5);
    this.take('quake', out, .7 * far, .62 + Math.random() * .12, land, Math.min(1, distance / 120));
    this.tone('sine', 58, 30, land + .02, .04, 2.4, .5 * far, out, 2.2);
  }

  /** The fighter's own blade on a body, over the shared impact: steel's ring
   *  for the swordsmen, iron's clang for the greatsword (every fighter hit with
   *  the same six files - 6,967 of Kenzo's hits, his own sounds 102). Eight a
   *  second at most, pitched a little each time. */
  weapon(kind: 'steel' | 'iron', heavy: boolean) {
    // (One for a sweep through three bodies in the same instant, not three.)
    const now = performance.now();
    if (!this.ctx || this.hidden || this.still > .25 || now - this.weaponAt < 60 || !this.allow('weapon', 8)) return;
    this.weaponAt = now;
    this.cue('weapon:' + kind);
    const at = this.ctx.currentTime + .005, out = this.hits!, pitch = .92 + Math.random() * .16, w = heavy ? 1 : .7;
    // The recorded blade on it, under the ring.
    this.take(kind === 'steel' ? 'blade-clash' : 'iron-hit', out, (kind === 'steel' ? .14 : .2) * w, pitch * (heavy ? .9 : 1.05), at, 0, (Math.random() - .5) * .4);
    if (kind === 'steel') {
      this.burst(this.white!, out, at, .001, .03, .09 * w, ['bandpass', 6200 * pitch, 1.4]);
      for (const [f, level, decay] of [[2480, .05, .16], [3650, .035, .12], [5120, .02, .08]] as const)
        this.tone('sine', f * pitch, f * pitch * .995, at, .001, decay * (heavy ? 1.4 : 1), level * w, out);
    } else {
      this.burst(this.brown!, out, at, .002, .09, .22 * w, ['lowpass', 900, .9]);
      for (const [f, level, decay] of [[820, .07, .26], [1270, .05, .2], [1990, .025, .14]] as const)
        this.tone('triangle', f * pitch, f * pitch * .99, at, .002, decay * (heavy ? 1.3 : 1), level * w, out);
    }
  }

  private weaponAt = -1e9;
  /** A dry crack under a burst: noise, snapped short. */
  private crack() {
    if (!this.ctx) return;
    const at = this.ctx.currentTime + .01;
    this.burst(this.white!, this.hits!, at, .001, .07, .2, ['bandpass', 2400, .9]);
    this.tone('sine', 140, 60, at, .002, .18, .35, this.hits!, .15);
  }
  /** Thunder after a lightning flash, `delay` seconds on (the storm's distance). */
  strike(delay: number) {
    if (!this.ctx || !this.bed || this.hidden || this.still > .25) return;
    this.thunder(this.ctx.currentTime + delay, this.bed.out);
    this.take('thunder', this.bed.out, .55, .8 + Math.random() * .2, this.ctx.currentTime + delay, .45);
  }

  /** At most `perSecond` of a kind of sound: a crowd of casts is still one voice each. */
  private allow(kind: string, perSecond: number) {
    const now = performance.now() / 1000, times = this.recent.get(kind) ?? [];
    while (times.length && now - times[0] > 1) times.shift();
    if (times.length >= perSecond) return false;
    times.push(now); this.recent.set(kind, times);
    return true;
  }
  private readonly recent = new Map<string, number[]>();

  /** A new run or the lobby: everything stops. */
  reset() {
    this.lastFeed = 0; this.lastTime = -1; this.still = 0; this.over = false; this.drumNext = 0;
    if (this.ctx && this.drumBus) this.drumBus.gain.setTargetAtTime(0, this.ctx.currentTime, .2);
    if (this.ctx && this.hordeOut) this.hordeOut.gain.setTargetAtTime(0, this.ctx.currentTime, .2);
    if (this.bed && this.ctx) { const now = this.ctx.currentTime; this.bed.out.gain.setTargetAtTime(0, now, .2); for (const v of this.bed.voices) v.stop(now + 1.2); }
    this.bed = undefined;
  }

  // ---- the context ------------------------------------------------------------------
  private start(): boolean {
    if (this.ctx) { if (asleep(this.ctx) && !this.hidden) this.resume(); return true; }
    const Ctor = globalThis.AudioContext;
    if (!Ctor || typeof document === 'undefined') return false;
    try { this.ctx = audioContext('playback'); } catch { return false; }   // a phone's at 32 kHz (audio/contextRate.ts)
    const ctx = this.ctx;
    // A soft ceiling last: this plays on top of the game's own mix, so its
    // peaks bend toward full scale instead of clipping. Linear below half
    // scale (no make-up gain, unlike a compressor node).
    const limit = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) { const x = i / (curve.length - 1) * 2 - 1, a = Math.abs(x); curve[i] = a < .5 ? x : Math.sign(x) * (.5 + .5 * Math.tanh((a - .5) * 2)); }
    limit.curve = curve; limit.oversample = '2x';
    limit.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(limit);
    this.beds = ctx.createGain(); this.beds.gain.value = 0; this.beds.connect(this.master);
    this.hits = ctx.createGain(); this.hits.gain.value = .45; this.hits.connect(this.master);
    this.drumBus = ctx.createGain(); this.drumBus.gain.value = 0; this.drumBus.connect(this.master);
    this.voices = ctx.createGain(); this.voices.gain.value = 0; this.voices.connect(limit);
    this.caller = ctx.createGain(); this.caller.gain.value = 1.15; this.caller.connect(this.voices);
    const reverb = ctx.createConvolver(); reverb.buffer = this.impulse(2.8);
    this.wet = ctx.createGain(); this.wet.gain.value = .55; this.wet.connect(reverb); reverb.connect(this.master);
    this.white = this.noise('white'); this.brown = this.noise('brown');
    this.readSettings();
    addEventListener('pointerdown', this.resume); addEventListener('keydown', this.resume);
    document.addEventListener('visibilitychange', this.visibility);
    this.visibility();
    return true;
  }

  private readSettings() {
    this.settingsAt = performance.now();
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      const v = (x: unknown, d: number) => typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : d;
      this.volume = v(s.volume, 1) * v(s.sfxVolume, 1);
      this.voiceVolume = v(s.volume, 1) * v(s.voiceVolume, 1);
    } catch { this.volume = 1; this.voiceVolume = 1; }
  }

  private fade(level: number, seconds: number) {
    if (this.ctx && this.beds) this.beds.gain.setTargetAtTime(level, this.ctx.currentTime, seconds / 3);
  }

  private noise(kind: 'white' | 'brown') {
    const ctx = this.ctx!, length = ctx.sampleRate * 3, buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buffer.getChannelData(c);
      let last = 0;
      for (let i = 0; i < length; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w;
        else { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
      }
    }
    return buffer;
  }

  /** A generated hall: two channels of decaying noise, darker as they fade. */
  private impulse(seconds: number) {
    const ctx = this.ctx!, length = Math.floor(ctx.sampleRate * seconds), buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buffer.getChannelData(c);
      let smooth = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length, k = .15 + .75 * t;
        smooth = smooth * k + (Math.random() * 2 - 1) * (1 - k);
        d[i] = smooth * Math.pow(1 - t, 2.4) * (i < ctx.sampleRate * .012 ? i / (ctx.sampleRate * .012) : 1);
      }
    }
    return buffer;
  }

  // ---- building blocks -----------------------------------------------------------------
  private loop(buffer: AudioBuffer, to: AudioNode, rate = 1): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource(); s.buffer = buffer; s.loop = true; s.playbackRate.value = rate;
    s.loopStart = Math.random() * 1.5; s.connect(to); s.start(this.ctx!.currentTime, Math.random() * 2);
    return s;
  }
  private filter(type: BiquadFilterType, frequency: number, q = .7, to?: AudioNode) {
    const f = this.ctx!.createBiquadFilter(); f.type = type; f.frequency.value = frequency; f.Q.value = q; if (to) f.connect(to); return f;
  }
  private gain(value: number, to?: AudioNode) { const g = this.ctx!.createGain(); g.gain.value = value; if (to) g.connect(to); return g; }
  /** A slow wobble on a parameter. */
  private lfo(param: AudioParam, rate: number, depth: number) {
    const o = this.ctx!.createOscillator(); o.frequency.value = rate; const g = this.gain(depth); o.connect(g); g.connect(param); o.start();
    return o;
  }
  /** A one-shot burst of filtered noise with an attack/decay envelope. */
  private burst(buffer: AudioBuffer, to: AudioNode, at: number, attack: number, decay: number, peak: number, filter: [BiquadFilterType, number, number], rate = 1) {
    const ctx = this.ctx!, s = ctx.createBufferSource(); s.buffer = buffer; s.playbackRate.value = rate;
    const f = this.filter(filter[0], filter[1], filter[2]), g = this.gain(0);
    s.connect(f); f.connect(g); g.connect(to);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + attack); g.gain.exponentialRampToValueAtTime(.0001, at + attack + decay);
    s.start(at, Math.random() * 2); s.stop(at + attack + decay + .05);
    return f;
  }
  /** A tone: an oscillator through its own envelope, optionally sliding in pitch. */
  private tone(type: OscillatorType, from: number, to: number, at: number, attack: number, decay: number, peak: number, out: AudioNode, slide = decay) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = this.gain(0, out);
    o.type = type; o.frequency.setValueAtTime(from, at); o.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + slide);
    o.connect(g);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + attack); g.gain.exponentialRampToValueAtTime(.0001, at + attack + decay);
    o.start(at); o.stop(at + attack + decay + .05);
    // The shaped signal, for a send: the raw oscillator fed the hall a flat
    // tone that ignored the envelope and cut off dead.
    return g;
  }
  private send(node: AudioNode, amount: number) { const g = this.gain(amount, this.wet!); node.connect(g); }

  // ---- the places ----------------------------------------------------------------------
  private setBed(place: Place) {
    this.cue('bed:' + place, -1);
    const ctx = this.ctx!, now = ctx.currentTime;
    if (this.bed) { const old = this.bed; old.out.gain.setTargetAtTime(0, now, .8); for (const v of old.voices) v.stop(now + 4); }
    const out = this.gain(0, this.beds!);
    out.gain.setTargetAtTime(1, now + .4, 1.5);
    // The synthesis, on its own level: it drops under the recordings once they are in (dressBed).
    const synth = this.gain(1, out);
    const voices: Voice[] = [];
    const keep = (...nodes: (AudioScheduledSourceNode)[]) => { for (const n of nodes) voices.push({ stop: at => { try { n.stop(at); } catch { /* already stopped */ } } }); };
    const bed: Bed = { place, out, voices, next: now + .5, tick: () => {} };
    const sound = SYNTH_OF[place] ?? place;
    if (sound === 'rift-village') {
      // Fire: a roaring low bed that breathes, and crackle over it.
      const roar = this.filter('bandpass', 420, .6, this.gain(.22, synth));
      keep(this.loop(this.brown!, roar, 1.1), this.lfo(roar.frequency, .23, 140));
      const air = this.filter('lowpass', 260, .5, this.gain(.12, synth));
      keep(this.loop(this.brown!, air, .6));
      bed.tick = t => {
        while (bed.next < t + .25) {
          const at = Math.max(t, bed.next);
          this.burst(this.white!, synth, at, .001, .012 + Math.random() * .04, .05 + Math.random() * .12, ['highpass', 1800 + Math.random() * 2500, .8]);
          bed.next = at + .03 + Math.random() * .16;
        }
      };
    } else if (sound === 'rift-swords') {
      // Wind over the graves: two howling bands drifting against each other.
      for (const [f, q, rate, depth, level] of [[380, 5, .07, 160, .16], [720, 7, .11, 260, .09]] as const) {
        const band = this.filter('bandpass', f, q, this.gain(level, synth));
        keep(this.loop(this.white!, band, 1), this.lfo(band.frequency, rate, depth));
      }
      const low = this.filter('lowpass', 180, .5, this.gain(.14, synth));
      keep(this.loop(this.brown!, low, .5));
      bed.next = now + 6 + Math.random() * 8;
      bed.tick = t => { if (t >= bed.next) { this.hornCall(t, out, .12, true); bed.next = t + 22 + Math.random() * 20; } }; // (a far war horn)
    } else if (sound === 'rift-fortress') {
      // Rain on stone, drips, and thunder rolling in now and then.
      const hiss = this.filter('highpass', 1300, .5, this.filter('lowpass', 7500, .5, this.gain(.14, synth)));
      keep(this.loop(this.white!, hiss, 1));
      const patter = this.filter('bandpass', 2600, 1.2, this.gain(.07, synth));
      keep(this.loop(this.white!, patter, .9), this.lfo(patter.frequency, .4, 500));
      let drip = now;
      // Thunder comes with the lightning the effects draw (thunder()).
      bed.tick = t => {
        while (drip < t + .25) { const at = Math.max(t, drip); this.tone('sine', 2200 + Math.random() * 1600, 900, at, .001, .06, .025, synth, .05); drip = at + .08 + Math.random() * .4; }
      };
    } else {
      // Dusk: a drone of detuned saws under a slow sweep, and a heartbeat.
      const drone = this.filter('lowpass', 190, 1.4, this.gain(.1, synth));
      for (const f of [41.2, 41.5, 61.8, 82.1]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(drone); o.start(); keep(o); }
      keep(this.lfo(drone.frequency, .05, 90));
      const wind = this.filter('bandpass', 300, 3, this.gain(.08, synth));
      keep(this.loop(this.white!, wind, .8), this.lfo(wind.frequency, .09, 150));
      bed.tick = t => {
        while (bed.next < t + .3) {
          const at = Math.max(t, bed.next);
          this.tone('sine', 62, 38, at, .01, .28, .5, out, .2); this.tone('sine', 58, 36, at + .24, .01, .32, .35, out, .25);
          bed.next = at + 1.25;
        }
      };
    }
    this.bed = bed;
    this.dressBed(bed, synth);
  }

  /** A place's recordings over its synthesis: the loops, faded in once they
   *  are loaded (the synthesis stepping back under them), and its far-off
   *  accents on their own clocks. */
  private dressBed(bed: Bed, synth: GainNode) {
    const ctx = this.ctx!, spec = RECORDED[bed.place], start = ctx.currentTime;
    const next = spec.accents.map(a => start + between(a.every) * .5);
    const tick = bed.tick;
    bed.tick = now => {
      tick(now);
      spec.accents.forEach((a, i) => {
        if (now < next[i]) return;
        next[i] = now + between(a.every);
        this.take(a.take, bed.out, a.gain, between(a.rate), now, .75, (Math.random() - .5) * 1.8);
      });
    };
    void Promise.all(spec.loops.map(([name]) => this.recording(name))).then(buffers => {
      if (this.bed !== bed || !this.ctx) return;
      const now = ctx.currentTime;
      buffers.forEach((buffer, i) => {
        if (!buffer) return;
        const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
        const level = this.gain(0, bed.out); source.connect(level);
        source.start(now, Math.random() * buffer.duration);
        level.gain.setTargetAtTime(spec.loops[i][1], now, 1.2);
        bed.voices.push({ stop: at => { try { source.stop(at); } catch { /* already stopped */ } } });
      });
      if (buffers.some(Boolean)) synth.gain.setTargetAtTime(SYNTH_UNDER, now, 1.5);
    });
  }

  /** The horde's own bed, at `level` (the field's fill). */
  private hordeBed(level: number, now: number) {
    const ctx = this.ctx!;
    if (!this.hordeOut) {
      const out = this.hordeOut = this.gain(0, this.beds!);
      void this.recording('bed-horde').then(buffer => {
        if (!buffer) return;
        const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true; source.connect(out);
        source.start(ctx.currentTime, Math.random() * buffer.duration);
      });
    }
    this.hordeOut.gain.setTargetAtTime(level, now, .9);
  }

  /** A recording, fetched and decoded once. */
  private recording(name: string) {
    let buffer = this.recorded.get(name);
    if (!buffer) {
      const ctx = this.ctx!;
      buffer = fetch(survivalStandIn(`/assets/audio/survival/${name}.m4a`)).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(name))).then(bytes => ctx.decodeAudioData(bytes)).catch(() => undefined);
      this.recorded.set(name, buffer);
    }
    return buffer;
  }

  /** One take of a recorded family at `at` on the audio clock (now, if that is
   *  past): pitched by `rate`, placed across the field by `pan`, and - `far`,
   *  0-1 - dulled and sent to the hall, as something heard from a distance. */
  private take(take: Take, out: AudioNode, gain: number, rate = 1, at = 0, far = 0, pan = (Math.random() - .5) * 1.2) {
    if (!this.ctx) return;
    const ctx = this.ctx, name = `${take}-${1 + Math.floor(Math.random() * TAKES[take])}`;
    void this.recording(name).then(buffer => {
      if (!buffer || this.hidden) return;
      const source = ctx.createBufferSource(); source.buffer = buffer; source.playbackRate.value = rate;
      let node: AudioNode = source;
      if (far > 0) { const dull = this.filter('lowpass', 5400 - far * 4300, .7); source.connect(dull); node = dull; }
      const panner = ctx.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(panner);
      const level = this.gain(gain, out); panner.connect(level);
      if (far > 0) this.send(level, .25 + far * .5);
      source.start(Math.max(ctx.currentTime, at));
    });
  }

  // ---- the beats -------------------------------------------------------------------------
  /** War drums: taiko hits in a short roll, the last the heaviest. */
  private drums(count: number) {
    this.cue('war-drums-round');
    const now = this.ctx!.currentTime + .05;
    for (let i = 0; i < count; i++) {
      const at = now + i * .32, last = i === count - 1, peak = last ? .9 : .6;
      const body = this.tone('sine', 120, 42, at, .004, last ? 1.1 : .55, peak, this.hits!, .18);
      this.send(body, .35);
      const skin = this.burst(this.white!, this.hits!, at, .001, .07, .25 * peak, ['bandpass', 900, .8]);
      this.send(skin, .3);
    }
  }
  /** A boss: the low brass wall - a detuned cluster whose filter swells open and shuts. */
  private braam(weight: number) {
    this.cue('boss-brass');
    const ctx = this.ctx!, at = ctx.currentTime + .02, length = 1.6 + weight * 1.4;
    const f = this.filter('lowpass', 160, 2.5), g = this.gain(0, this.hits!);
    f.connect(g); this.send(g, .5);
    f.frequency.setValueAtTime(160, at); f.frequency.exponentialRampToValueAtTime(1400 + weight * 900, at + .35); f.frequency.exponentialRampToValueAtTime(220, at + length);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.34 * weight + .1, at + .08); g.gain.exponentialRampToValueAtTime(.0001, at + length);
    for (const [freq, detune] of [[55, -8], [55, 7], [82.4, 0], [110, -5], [130.8, 6]] as const) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = detune; o.connect(f); o.start(at); o.stop(at + length + .1);
    }
    this.tone('sine', 55, 30, at, .02, length, .6 * weight, this.hits!, length);
    this.drums(1);
  }
  /** An event: a war horn, two notes swelling. */
  private horn() {
    this.cue('event-horn');
    const ctx = this.ctx!, at = ctx.currentTime + .05;
    const band = this.filter('bandpass', 620, 1.1), g = this.gain(0, this.hits!);
    band.connect(g); this.send(g, .6);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.3, at + .45); g.gain.setValueAtTime(.3, at + 1.3); g.gain.exponentialRampToValueAtTime(.0001, at + 2.4);
    for (const [freq, start] of [[110, 0], [164.8, .5]] as const) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
      const vib = this.lfo(o.frequency, 5.2, 1.6);
      o.connect(band); o.start(at + start); o.stop(at + 2.5); vib.stop(at + 2.5);
    }
  }
  /** A new place: a great war drum struck once, and the wind drawing in. (The cue keeps its id.) */
  private toll() {
    this.cue('place-bell');
    const at = this.ctx!.currentTime + .05;
    this.greatDrum(at, this.hits!, .5);
    this.burst(this.brown!, this.hits!, at, 1.2, 2.2, .35, ['lowpass', 500, .7], .7);
  }
  /** A great war drum struck once, long in the hall: the head's deep boom falling away, the
   *  skin's slap, the frame's thump - a round's taiko (drums()), bigger and lower, at `level`. */
  private greatDrum(at: number, out: AudioNode, level = .12) {
    const body = this.tone('sine', 96, 36, at, .004, 2.4, level * 1.9, out, .55);
    this.send(body, .45);
    const skin = this.burst(this.white!, out, at, .001, .08, level * .55, ['bandpass', 760, .8]);
    this.send(skin, .3);
    const thump = this.burst(this.brown!, out, at, .002, .45, level * .8, ['lowpass', 240, .7]);
    this.send(thump, .35);
  }
  /** A war horn's long call: one note swelling and fading, a fifth over it with `fifth`, brassy
   *  through a band; `far`, dulled and mostly hall, as heard over the graves. */
  private hornCall(at: number, out: AudioNode, level: number, far = false, fifth = true) {
    const ctx = this.ctx!, band = this.filter('bandpass', far ? 440 : 600, far ? 1.6 : 1.1), g = this.gain(0, out);
    band.connect(g); this.send(g, far ? .85 : .55);
    const peak = level * (far ? .55 : 1), length = far ? 4.4 : 3.2;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + (far ? 1.2 : .5)); g.gain.setValueAtTime(peak, at + length * .5);
    g.gain.exponentialRampToValueAtTime(.0001, at + length);
    for (const [freq, start] of (fifth ? [[98, 0], [146.8, .6]] : [[98, 0]]) as readonly (readonly [number, number])[]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
      const vib = this.lfo(o.frequency, 4.8, 1.3);
      o.connect(band); o.start(at + start); o.stop(at + length + .1); vib.stop(at + length + .1);
    }
  }
  /** Thunder: a crack, then the roll. */
  private thunder(at: number, out: AudioNode) {
    this.cue('thunder');
    this.burst(this.white!, out, at, .005, .25, .18, ['highpass', 900, .5]);
    const roll = this.burst(this.brown!, out, at + .08, .5, 3.6 + Math.random() * 2, .6, ['lowpass', 260, .8], .8);
    this.send(roll, .3);
  }
  // ---- the arts ------------------------------------------------------------------------
  /** Lightning: the crack, and the boom under it (Judgement's rolls on). */
  private thunderclap(big: boolean) {
    const v = this.vary();
    this.cue('art-thunderclap' + (big ? '-big' : ''), 0, v);
    const at = this.ctx!.currentTime + .01;
    const crack = this.burst(this.white!, this.hits!, at, .002, .12 + (big ? .08 : 0), big ? 1.1 : .9, ['highpass', 1800 * v, .6]);
    this.send(crack, .25);
    this.tone('sine', 90 * v, 38 * v, at, .005, big ? .9 : .45, big ? .8 : .6, this.hits!, .35);
    if (big) { const roll = this.burst(this.brown!, this.hits!, at + .06, .15, 1.4, .35, ['lowpass', 320, .7], .8); this.send(roll, .3); }
  }
  /** A sweep of blood: air torn round the fighter. */
  private whoosh(big: boolean) {
    const v = this.vary();
    this.cue('art-whoosh' + (big ? '-big' : ''), 0, v);
    const at = this.ctx!.currentTime + .01, length = (big ? .5 : .36) / Math.sqrt(v);
    const band = this.burst(this.white!, this.hits!, at, length * .45, length * .7, big ? 1 : .8, ['bandpass', 500 * v, 2.6]);
    band.frequency.setValueAtTime(420 * v, at); band.frequency.exponentialRampToValueAtTime(2600 * v, at + length * .45); band.frequency.exponentialRampToValueAtTime(700 * v, at + length);
    this.send(band, .2);
  }
  /** Fire out of the ground: a roaring swell and its crackle. */
  private fireburst(big: boolean) {
    const v = this.vary();
    this.cue('art-fireburst' + (big ? '-big' : ''), 0, v);
    const at = this.ctx!.currentTime + .01;
    const roar = this.burst(this.brown!, this.hits!, at, .08, big ? .9 : .6, big ? 1 : .8, ['lowpass', 900 * v, .7], 1.4);
    roar.frequency.setValueAtTime(300 * v, at); roar.frequency.exponentialRampToValueAtTime(1400 * v, at + .12); roar.frequency.exponentialRampToValueAtTime(500 * v, at + .7);
    this.send(roar, .25);
    for (let i = 0; i < 5; i++) this.burst(this.white!, this.hits!, at + .05 + Math.random() * .4, .001, .02, .1, ['highpass', 2500, .8]);
  }
  /** A star falling: its whistle down, then the impact. */
  private meteor(fall: number, big: boolean) {
    const v = this.vary();
    this.cue('art-meteor' + (big ? '-big' : ''), 0, v);
    const at = this.ctx!.currentTime + .01, lands = at + fall;
    this.tone('sine', 1900 * v, 260 * v, at, fall * .6, fall * .45, big ? .07 : .05, this.hits!, fall);
    const boom = this.burst(this.brown!, this.hits!, lands, .01, big ? 1.8 : 1.3, big ? .75 : .6, ['lowpass', 380, .8], .9);
    this.send(boom, .45);
    this.tone('sine', 70, 28, lands, .01, 1, .6, this.hits!, .8);
    this.burst(this.white!, this.hits!, lands, .003, .18, .3, ['highpass', 1200, .5]);
  }
  /** Ice: crackling as it spreads, and the air ringing cold. */
  private ice(big: boolean) {
    this.cue('art-ice' + (big ? '-big' : ''));
    const at = this.ctx!.currentTime + .01;
    for (let i = 0; i < (big ? 12 : 7); i++) this.tone('sine', 2400 + Math.random() * 3200, 1800 + Math.random() * 800, at + Math.random() * (big ? .7 : .4), .001, .05, .06, this.hits!, .04);
    const shimmer = this.burst(this.white!, this.hits!, at, .05, big ? 1.1 : .6, big ? .12 : .08, ['highpass', 5200, .6]);
    this.send(shimmer, .6);
    if (big) this.tone('sine', 110, 55, at, .02, 1.2, .35, this.hits!, 1);
  }
  /** A cut through space: a ringing zing. */
  private zing(big: boolean) {
    const v = this.vary();
    this.cue('art-zing' + (big ? '-big' : ''), 0, v);
    const at = this.ctx!.currentTime + .01;
    const ring = this.tone('sine', (big ? 3600 : 3000) * v, (big ? 1500 : 1200) * v, at, .003, big ? .3 : .2, .08, this.hits!, .15);
    this.send(ring, .4);
    this.burst(this.white!, this.hits!, at, .002, .07, .16, ['highpass', 3200 * v, .7]);
  }
  /** A shockwave, a burst, a wave of will: a thump in the chest. */
  private thump(heavy: boolean) {
    const v = this.vary();
    this.cue('art-thump' + (heavy ? '-big' : ''), 0, v);
    const at = this.ctx!.currentTime + .01;
    this.tone('sine', (heavy ? 90 : 75) * v, 34 * v, at, .004, heavy ? .5 : .3, heavy ? 1 : .85, this.hits!, .22);
    this.burst(this.brown!, this.hits!, at, .004, .22, .7, ['lowpass', 700 * v, .7]);
  }
  /** Lightning jumping between bodies: a short electric zap. */
  private zap() {
    const v = this.vary();
    this.cue('art-zap', 0, v);
    const at = this.ctx!.currentTime + .01;
    const o = this.ctx!.createOscillator(), g = this.gain(0, this.hits!), f = this.filter('bandpass', 2400 * v, 3);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(640 * v, at);
    for (let i = 1; i < 8; i++) o.frequency.setValueAtTime((420 + Math.random() * 900) * v, at + i * .018);
    o.connect(f); f.connect(g);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.7, at + .005); g.gain.exponentialRampToValueAtTime(.0001, at + .16);
    o.start(at); o.stop(at + .18);
  }

  /** Under a boss, war drums: a pattern that swells with the rank - at F to D
   *  only its heavy beats, a pulse, filling in from C (the first half of a run
   *  had none) - S adds the brass every eight bars; it falls away with the boss. */
  private warDrums(view: RunView, now: number) {
    const RANK_DRUMS: Record<string, number> = { F: .2, E: .26, D: .34, C: .45, B: .6, A: .8, S: 1 };
    let intensity = 0, top = '';
    for (const boss of view.bosses ?? []) if (!boss.champion && boss.hp > 0) { const v = RANK_DRUMS[boss.rank ?? ''] ?? 0; if (v > intensity) { intensity = v; top = boss.rank ?? ''; } }
    if (this.still > .25 || this.over || view.phase !== 'fight') intensity = 0;
    this.drumBus!.gain.setTargetAtTime(intensity * .55, now, intensity ? .8 : 1.5);
    if (!intensity) { this.drumNext = 0; return; }
    if (this.drumNext < now) { this.drumNext = now + .05; this.drumStep = 0; }
    // Eight sixteenths a bar at 100 bpm: the heavy on one and five.
    const PATTERN = [1, 0, .55, 0, .9, .45, .6, 0, 1, 0, .55, .35, .9, 0, .7, .5];
    while (this.drumNext < now + .3) {
      const at = this.drumNext, hit = PATTERN[this.drumStep % PATTERN.length];
      if (hit >= (intensity < .4 ? .85 : .01)) {
        this.tone('sine', 95 + hit * 20, 42, at, .003, .28 + hit * .25, .5 * hit, this.drumBus!, .16);
        this.burst(this.white!, this.drumBus!, at, .001, .05, .12 * hit, ['bandpass', 700 + hit * 500, .9]);
      }
      if (top === 'S' && this.drumStep % 128 === 0 && this.drumStep > 0) this.braam(.7);
      if (this.drumStep % 16 === 0) this.cue('war-drums:' + top, 2.4);
      this.drumStep++;
      this.drumNext += .15;
    }
  }

  /** A small bright figure of tones: a pickup, a chest. */
  private chime(notes: number[], level: number, type: OscillatorType = 'triangle') {
    this.cue('pickup-chime');
    const at = this.ctx!.currentTime + .01;
    notes.forEach((f, i) => { const o = this.tone(type, f, f, at + i * .06, .004, .35, level, this.hits!); this.send(o, .4); });
  }

  /** Each boss arrives with a sound of what it is, under the brass: the quake,
   *  magma, ice, light, the void, raw power, a beast, drawn steel, souls, a
   *  door out of the air, or a brute's weight (seven were shared by sixteen,
   *  the brute's by seven). */
  private signature(enemy: string | undefined, weight: number) {
    const kind = SIGNATURE[enemy ?? ''] ?? 'brute';
    this.cue('boss-signature:' + kind);
    const ctx = this.ctx!, at = ctx.currentTime + .05, out = this.hits!;
    switch (kind) {
      case 'quake': {
        const rumble = this.burst(this.brown!, out, at, .4, 2.4, .7 * weight, ['lowpass', 140, .9], .5); this.send(rumble, .4);
        for (let i = 0; i < 6; i++) this.burst(this.white!, out, at + .3 + Math.random() * 1.6, .002, .12, .14 * weight, ['bandpass', 400 + Math.random() * 600, 1.2]);
        break;
      }
      case 'magma': {
        const roar = this.burst(this.brown!, out, at, .5, 1.6, .55 * weight, ['lowpass', 500, 1.1], .8);
        roar.frequency.setValueAtTime(200, at); roar.frequency.exponentialRampToValueAtTime(900, at + .6); roar.frequency.exponentialRampToValueAtTime(260, at + 2);
        this.send(roar, .35); this.tone('sawtooth', 55, 41, at, .3, 1.6, .12 * weight, out, 1.8);
        break;
      }
      case 'ice': {
        for (let i = 0; i < 10; i++) this.tone('sine', 1800 + Math.random() * 3600, 1500, at + i * .09, .002, .5, .05 * weight, out, .4);
        const swell = this.burst(this.white!, out, at, .8, 1.2, .12 * weight, ['highpass', 4200, .6]); this.send(swell, .7);
        this.tone('sine', 98, 49, at, .6, 1.4, .3 * weight, out, 1.6);
        break;
      }
      case 'light': {
        const o = this.tone('sine', 900, 3600, at, .6, .5, .07 * weight, out, 1); this.send(o, .6);
        for (let i = 0; i < 8; i++) this.burst(this.white!, out, at + .9 + i * .05, .001, .04, .18 * weight, ['highpass', 3000, .7]);
        break;
      }
      case 'void': {
        // A swell that rises out of nothing and is cut off, then the drop.
        const swell = this.burst(this.white!, out, at, 1.3, .05, .2 * weight, ['bandpass', 700, 4]);
        swell.frequency.setValueAtTime(220, at); swell.frequency.exponentialRampToValueAtTime(2600, at + 1.3);
        this.send(swell, .8);
        this.tone('sine', 70, 26, at + 1.35, .01, 1.6, .7 * weight, out, 1.2);
        break;
      }
      case 'power': {
        const f = this.filter('lowpass', 300, 2), g = this.gain(0, out); f.connect(g); this.send(g, .4);
        f.frequency.setValueAtTime(300, at); f.frequency.exponentialRampToValueAtTime(3200, at + 1.6);
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.16 * weight, at + 1.4); g.gain.exponentialRampToValueAtTime(.0001, at + 2.2);
        for (const freq of [110, 110.7, 165, 220.5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq * .5, at); o.frequency.exponentialRampToValueAtTime(freq, at + 1.6); o.connect(f); o.start(at); o.stop(at + 2.3); }
        this.burst(this.white!, out, at + 1.55, .002, .3, .3 * weight, ['highpass', 1500, .6]);
        break;
      }
      case 'beast': {
        // A growl: a low tone shaken by a fast wobble, through noise.
        const o = ctx.createOscillator(), g = this.gain(0, out), f = this.filter('lowpass', 700, 1.5);
        o.type = 'sawtooth'; o.frequency.setValueAtTime(70, at); o.frequency.linearRampToValueAtTime(95, at + .6); o.frequency.linearRampToValueAtTime(60, at + 1.6);
        const wobble = this.lfo(o.frequency, 23, 14);
        o.connect(f); f.connect(g); this.send(g, .3);
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.22 * weight, at + .15); g.gain.setValueAtTime(.22 * weight, at + 1.1); g.gain.exponentialRampToValueAtTime(.0001, at + 1.7);
        o.start(at); o.stop(at + 1.8); wobble.stop(at + 1.8);
        this.burst(this.brown!, out, at, .1, 1.4, .25 * weight, ['bandpass', 500, 1.4], .7);
        break;
      }
      case 'steel': {
        // A blade drawn: a scrape climbing, then the ring of the steel.
        const scrape = this.burst(this.white!, out, at, .35, .12, .16 * weight, ['bandpass', 1800, 3]);
        scrape.frequency.setValueAtTime(1200, at); scrape.frequency.exponentialRampToValueAtTime(6200, at + .45);
        for (const [f, level] of [[1870, .07], [2960, .05], [4410, .04], [6230, .025]] as const) this.send(this.tone('sine', f, f * .997, at + .45, .002, 1.6, level * weight, out), .5);
        this.tone('sine', 120, 45, at + .45, .003, .4, .45 * weight, out, .3);
        break;
      }
      case 'soul': {
        // Souls taken: a hollow, wavering chord swelling out of the dark, and gone.
        const f = this.filter('lowpass', 500, 1.2), g = this.gain(0, out); f.connect(g); this.send(g, .6);
        f.frequency.setValueAtTime(500, at); f.frequency.exponentialRampToValueAtTime(1600, at + 1.2);
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.14 * weight, at + 1.1); g.gain.exponentialRampToValueAtTime(.0001, at + 2.4);
        for (const freq of [110, 164.8, 220.9, 261.6, 329.1]) {
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
          const waver = this.lfo(o.frequency, 4.5 + Math.random(), freq * .012);
          o.connect(f); o.start(at); o.stop(at + 2.5); waver.stop(at + 2.5);
        }
        this.tone('sine', 55, 40, at + 1.1, .01, 1.3, .5 * weight, out, 1.2);
        break;
      }
      case 'door': {
        // A door out of thin air: a long creak, and the slam.
        const creak = ctx.createOscillator(), f = this.filter('bandpass', 900, 6), g = this.gain(0, out);
        creak.type = 'sawtooth'; creak.frequency.setValueAtTime(38, at); creak.frequency.linearRampToValueAtTime(64, at + .7); creak.frequency.linearRampToValueAtTime(30, at + 1);
        const jitter = this.lfo(creak.frequency, 17, 9);
        creak.connect(f); f.connect(g);
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.2 * weight, at + .08); g.gain.setValueAtTime(.2 * weight, at + .9); g.gain.exponentialRampToValueAtTime(.0001, at + 1.05);
        creak.start(at); creak.stop(at + 1.1); jitter.stop(at + 1.1);
        this.tone('sine', 90, 38, at + 1.08, .002, .5, .8 * weight, out, .3);
        this.burst(this.brown!, out, at + 1.08, .002, .35, .5 * weight, ['lowpass', 700, .8]);
        break;
      }
      default: {
        // A brute: the ground taking its weight, twice.
        for (const t of [0, .42]) { this.tone('sine', 80, 32, at + t, .004, .6, .7 * weight, out, .35); this.burst(this.brown!, out, at + t, .004, .3, .4 * weight, ['lowpass', 600, .7]); }
      }
    }
  }

  /** A level: a rising run of bright tones, and the air opening. */
  /** When the last boss fell (performance.now), for the level chime's wait. */
  private fellAt = -1e9;
  private ascend() {
    if (!this.ctx || this.hidden) return;
    this.cue('level-up');
    const at = this.ctx!.currentTime + .01, out = this.hits!;
    // A hit under it first - the stamp landing - then the run climbing to a
    // held octave, and the air opening: it has to be heard over a crowd.
    this.tone('sine', 150, 55, at, .003, .35, .5, out, .2);
    this.burst(this.white!, out, at, .002, .09, .22, ['bandpass', 1800, .9]);
    [392, 523.3, 659.3, 784].forEach((f, i) => { const o = this.tone('triangle', f, f, at + .04 + i * .07, .005, .55, .26, out); this.send(o, .5); });
    const held = this.tone('sawtooth', 1046.5, 1046.5, at + .32, .02, .9, .06, out); this.send(held, .6);
    const air = this.burst(this.white!, out, at, .25, .55, .22, ['bandpass', 3000, 1.5]);
    air.frequency.setValueAtTime(1200, at); air.frequency.exponentialRampToValueAtTime(6000, at + .6);
  }

  /** The ending: the rift sealed - a great drum struck three times over a
   *  rising chord that resolves, and the drums once more. */
  private triumph() {
    this.cue('finale-fanfare');
    const ctx = this.ctx!, at = ctx.currentTime + .05;
    for (let i = 0; i < 3; i++) this.greatDrum(at + i * 1.1, this.hits!, .22);
    const f = this.filter('lowpass', 400, 1.2), g = this.gain(0, this.hits!);
    f.connect(g); this.send(g, .6);
    f.frequency.setValueAtTime(400, at); f.frequency.exponentialRampToValueAtTime(2600, at + 3); f.frequency.exponentialRampToValueAtTime(900, at + 6);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.16, at + 2.2); g.gain.setValueAtTime(.16, at + 4.2); g.gain.exponentialRampToValueAtTime(.0001, at + 6.5);
    // A minor chord that lifts to its major on the last stroke.
    for (const [freq, lift] of [[110, 110], [130.8, 138.6], [164.8, 164.8], [220, 220]] as const) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, at); o.frequency.setValueAtTime(lift, at + 2.2);
      o.detune.value = (Math.random() - .5) * 10; o.connect(f); o.start(at); o.stop(at + 6.6);
    }
    window.setTimeout(() => this.flourish(), 2300);
  }

  /** The fanfare's close: a rolling flourish of drums, quickening to a last
   *  great hit - its own figure, not the roll a round starts on. */
  private flourish() {
    if (!this.ctx || this.hidden) return;
    this.cue('fanfare-drums');
    const at = this.ctx.currentTime + .05;
    const beats = [0, .22, .4, .54, .66, .76, .85, 1.25];
    beats.forEach((t, i) => {
      const last = i === beats.length - 1, peak = last ? 1 : .35 + i * .06;
      const body = this.tone('sine', last ? 96 : 130, 40, at + t, .003, last ? 1.6 : .3, peak * .8, this.hits!, .18);
      this.send(body, last ? .6 : .3);
      this.burst(this.white!, this.hits!, at + t, .001, .06, .2 * peak, ['bandpass', last ? 600 : 1000, .8]);
    });
  }

  /** The run banked after the seal's fanfare: one horn call and the chord
   *  resolving, not the whole fanfare a second time. */
  private banked() {
    if (!this.ctx) return;
    this.cue('victory-sting');
    const at = this.ctx.currentTime + .05;
    this.hornCall(at, this.hits!, .2, false, false);
    for (const freq of [110, 138.6, 164.8]) this.tone('triangle', freq, freq, at, .08, 3.2, .05, this.hits!, 1.2);
  }

  /** A boss falls: a sub drop and the hall ringing after it. */
  /** The fighter falls and the run ends: the ground taking the body, a great
   *  drum struck twice, low and muffled, and the dark closing over it. */
  private defeat() {
    this.cue('defeat', 5);
    const at = this.ctx!.currentTime + .02, out = this.hits!;
    const drop = this.tone('sine', 70, 22, at, .01, 3.2, .9, out, 2.8); this.send(drop, .5);
    this.burst(this.brown!, out, at, .02, 2.6, .5, ['lowpass', 320, .7]);
    for (const [t, level] of [[.5, .5], [2.1, .36]] as const) {
      // A great drum, muffled: its low boom under a cloth, the thump of its frame, no ring.
      const boom = this.tone('sine', 80, 34, at + t, .006, 2.8, level * .8, out, .6);
      this.send(boom, .5);
      this.burst(this.brown!, out, at + t, .004, .6, level * .45, ['lowpass', 180, .7]);
    }
    const pad = this.tone('sawtooth', 49, 46, at + .3, 1.6, 4.2, .08, out, 3);
    this.send(pad, .7);
  }

  private fall() {
    this.cue('boss-fall');
    const at = this.ctx!.currentTime + .02;
    const o = this.tone('sine', 90, 28, at, .01, 2.6, .8, this.hits!, 2.2);
    this.send(o, .5);
    this.burst(this.brown!, this.hits!, at, .02, 2.2, .45, ['lowpass', 400, .7]);
  }
}
