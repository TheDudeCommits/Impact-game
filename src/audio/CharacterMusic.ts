import { selectMusicTracks, type MusicPhase, type MusicTrack } from './musicTracks';
import type { SoundtrackContext } from '../originals/apply';

export interface MusicStatus { state: 'off' | 'loading' | 'ready' | 'playing' | 'paused' | 'unavailable'; message: string; track?: MusicTrack }
interface Deck { audio: HTMLAudioElement; track?: MusicTrack; weight: number; token: number }
interface Fade { from: number; to: number; started: number }
const CROSSFADE_MS = 1200;
// Keep the score present under dialogue: a gentle 0.9dB dip, never a transport change.
const VOICE_MUSIC_GAIN = .9;
const VOICE_ATTACK_MS = 350;
const VOICE_RELEASE_MS = 1200;
/** A big blow's beat (the feel pass, iteration two): the score dips under the freeze the picture holds
 *  and swells back under the blow's tail, so everything seems to stop for the hit. Short and rare - the last blow of
 *  a special, an ultimate, an ender or a rush finisher - so the voice dip above stays the score's only steady one. */
const PUNCH_GAIN = .5, PUNCH_ATTACK_MS = 30, PUNCH_RELEASE_MS = 480;

/** Two local streaming decks. Nothing is requested until the user enables music. */
export class CharacterMusic {
  onStatus?: (status: MusicStatus) => void;
  private decks: Deck[];
  private active = 0;
  private enabled = false;
  private paused = true;
  private dead = false;
  private generation = 0;
  private pending?: { token: number; index: number };
  private queued?: MusicTrack;
  private desired?: MusicTrack;
  private fade?: Fade;
  private timer?: ReturnType<typeof setInterval>;
  private volume = .18;
  private level = .18;
  private levelRamp?: { from: number; to: number; started: number; duration: number };
  private ducked = false;
  private punchAt?: { start: number; hold: number };
  private phase: MusicPhase = 'lobby';
  private queue = selectMusicTracks('taisei', undefined, 'lobby');
  private status: MusicStatus = { state: 'off', message: 'Music off' };
  /** Paused because the tab went away rather than by the player: it plays
   *  again when the tab comes back. It used to stay paused for good, with the
   *  play control hidden behind the arcade's HUD. */
  private resumeOnShow = false;
  private visibilityHandler = () => {
    // Not canPlay(): the tab is already hidden by the time this runs.
    if (document.hidden) { if (this.enabled && !this.paused && !this.dead) { this.resumeOnShow = true; this.pause(); } }
    else if (this.resumeOnShow) { this.resumeOnShow = false; if (this.enabled) void this.setEnabled(true); }
  };

  constructor(private container: HTMLElement) {
    container.setAttribute('aria-label', 'Anime soundtrack player');
    this.decks = [this.makeDeck(), this.makeDeck()];
    document.addEventListener('visibilitychange', this.visibilityHandler);
    // A collapsed visual radio is allowed: this is local background music, not an embedded video.
  }
  private makeDeck(): Deck {
    const audio = document.createElement('audio');
    audio.preload = 'none'; audio.volume = 0; audio.hidden = true;
    const deck: Deck = { audio, weight: 0, token: 0 };
    audio.addEventListener('timeupdate', () => {
      if (this.decks[this.active] !== deck || this.fade || this.pending || !this.canPlay() || this.queue.length < 2) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration - audio.currentTime <= CROSSFADE_MS / 1000) this.next();
    });
    audio.addEventListener('ended', () => {
      if (this.decks[this.active] === deck && !this.fade && !this.pending && this.canPlay()) this.next();
    });
    audio.addEventListener('error', () => {
      if (this.decks[this.active] === deck && !this.pending && this.enabled) this.publish('unavailable', 'This soundtrack could not be loaded. Select Next or retry Play.');
    });
    this.container.append(audio); return deck;
  }
  captureElements():HTMLAudioElement[]{return this.decks.map(d=>d.audio);}
  getStatus(): MusicStatus { return this.status; }
  setContext(localFighter: string, opponentFighter?: string, phase: MusicPhase = 'combat', context?: SoundtrackContext) {
    if (this.dead) return;
    let next = selectMusicTracks(localFighter, opponentFighter, phase, context);
    if (phase === 'lobby' && this.phase !== 'lobby' && this.lastHome && this.awayFromHome) { const at = next.findIndex(t => t.id === this.lastHome); if (at >= 0) next = [...next.slice(at + 1), ...next.slice(0, at + 1)]; }
    const phaseChanged = phase !== this.phase; this.phase = phase; this.queue = next;
    const current = this.desired ?? this.decks[this.active].track;
    // Never let a homescreen song linger in a room, including while the next
    // track buffers or when a rapid transition interrupts a crossfade.
    if(current && next[0] && current.scope!==next[0].scope){
      const wasPlaying=this.canPlay();this.stopTransport();
      for(const deck of this.decks)this.clearDeck(deck);
      this.active=0;this.paused=!wasPlaying;
    }
    if (phaseChanged || !current || !next.some(t => t.id === current.id) || (next[0]?.boss && !current.boss)) {
      this.desired = next[0];
      if (this.enabled) void this.switchTrack(next[0]);
    } else this.preloadNext();
  }
  async setEnabled(value: boolean): Promise<void> {
    if (this.dead) return;
    this.enabled = value; this.heldByPlayer = false;
    if (!value) { this.stopTransport(); this.publish('off', 'Music off'); return; }
    this.paused = false;
    if (document.hidden) { this.pause(); return; }
    // switchTrack calls play() before its first await, preserving the click/keypress activation.
    await this.switchTrack(this.desired ?? this.queue[0]);
  }
  /** Back to playing if music is on and something stopped it - a hidden tab,
   *  a pause menu - short of the player turning it off. */
  resume() {
    if (this.dead || !this.enabled || this.heldByPlayer || this.status.state === 'playing' || this.status.state === 'loading') return;
    void this.setEnabled(true);
  }
  /** The player paused it themselves (the caption's button): only they start it again. */
  private heldByPlayer = false;
  pause(byPlayer = false) {
    if (this.dead) return;
    this.heldByPlayer = byPlayer;
    this.stopTransport();
    this.publish(this.enabled ? 'paused' : 'off', this.enabled ? 'Music paused — press Play to resume' : 'Music off');
  }
  next() {
    if (this.dead || !this.queue.length) return;
    const current = this.desired ?? this.decks[this.active].track;
    const next = this.after(current?.id);
    // A single-track queue loops without reloading a second copy or dipping its volume.
    if (next.id === current?.id && this.decks[this.active].track?.id === next.id) {
      const audio = this.decks[this.active].audio;
      if (audio.ended) { audio.currentTime = 0; if (this.canPlay()) void this.switchTrack(next); }
      return;
    }
    this.desired = next; void this.switchTrack(next);
  }
  setVolume(value: number) {
    if (!Number.isFinite(value) || this.dead) return;
    this.volume = Math.max(0, Math.min(1, value)); this.rampLevel(250);
  }
  duck(active: boolean) {
    if (this.dead || this.ducked === active) return;
    this.ducked = active; this.rampLevel(active ? VOICE_ATTACK_MS : VOICE_RELEASE_MS);
  }
  /** A big blow landed: dip for its freeze (`hold` seconds), then come back (PUNCH_*). */
  punch(hold: number) {
    if (this.dead || !this.canPlay() || !Number.isFinite(hold)) return;
    this.punchAt = { start: performance.now(), hold: Math.max(.05, hold) * 1000 };
    this.applyLevels(); this.ensureTimer();
  }
  private punchGain(now = performance.now()) {
    const p = this.punchAt;
    if (!p) return 1;
    const t = now - p.start;
    if (t < PUNCH_ATTACK_MS) return 1 - (1 - PUNCH_GAIN) * Math.max(0, t) / PUNCH_ATTACK_MS;
    if (t < p.hold) return PUNCH_GAIN;
    const r = (t - p.hold) / PUNCH_RELEASE_MS;
    if (r >= 1) { this.punchAt = undefined; return 1; }
    return PUNCH_GAIN + (1 - PUNCH_GAIN) * r * r * (3 - 2 * r);
  }
  private after(id?: string): MusicTrack {
    const index = this.queue.findIndex(t => t.id === id);
    for (let step = 1; step <= this.queue.length; step++) {
      const track = this.queue[(index + step) % this.queue.length];
      if (!track.stinger) return track;
    }
    return this.queue[(index + 1) % this.queue.length];
  }
  private lastHome?: string;
  private awayFromHome = false;
  private canPlay() { return this.enabled && !this.paused && !this.dead && !document.hidden; }
  private async switchTrack(track?: MusicTrack): Promise<void> {
    this.desired = track;
    if (!track) { this.stopTransport(); this.publish(this.enabled ? 'unavailable' : 'off', this.enabled ? 'No soundtrack for this matchup yet.' : 'Music off'); return; }
    if (!this.canPlay()) { this.publish(this.enabled ? 'paused' : 'off', this.enabled ? 'Music paused — press Play to resume' : 'Music off'); return; }
    if (this.fade) { this.queued = track; return; }
    if (this.pending) {
      const stalled = this.decks[this.pending.index];
      if (stalled.track?.id === track.id) return;
      // A newer selection can recover immediately from a stalled media request.
      stalled.audio.pause(); stalled.token = ++this.generation;
      this.pending = undefined; this.queued = undefined;
    }
    const old = this.decks[this.active];
    if (old.track?.id === track.id && !old.audio.paused && !old.audio.ended) { this.publish('playing', 'Soundtrack'); this.preloadNext(); return; }
    const resume = old.track?.id === track.id;
    const index = resume || !old.track ? this.active : 1 - this.active;
    const incoming = this.decks[index];
    if (!resume) this.assign(incoming, track, 'auto');
    else if (incoming.audio.error) incoming.audio.load();
    const token = ++this.generation; incoming.token = token; this.pending = { token, index };
    if (index !== this.active || !old.track || old.audio.paused) incoming.weight = 0;
    incoming.audio.loop = this.queue.length === 1; this.applyLevels();
    this.publish('loading', 'Loading soundtrack…');
    try {
      await incoming.audio.play();
      if (this.dead || !this.canPlay() || token !== this.generation) {
        // A late promise must not stop a deck that a newer playback request has reused.
        if (incoming.token === token) incoming.audio.pause(); return;
      }
      this.pending = undefined;
      if (this.queued && this.queued.id !== track.id) {
        const latest = this.queued; this.queued = undefined; incoming.audio.pause(); incoming.weight = 0;
        await this.switchTrack(latest); return;
      }
      this.queued = undefined;
      const from = this.active; this.active = index;
      if (from !== index && !old.audio.paused && old.weight > 0) this.fade = { from, to: index, started: performance.now() };
      else { incoming.weight = 1; if (from !== index) { old.audio.pause(); old.weight = 0; } }
      this.publish('playing', 'Soundtrack'); this.applyLevels();
      if (track.scope === 'homescreen') { this.lastHome = track.id; this.awayFromHome = false; } else this.awayFromHome = true;
      if (this.fade) this.ensureTimer(); else this.preloadNext();
    } catch (error) {
      if (token !== this.generation || this.dead) return;
      this.pending = undefined; incoming.audio.pause();
      if (this.queued) { const latest = this.queued; this.queued = undefined; await this.switchTrack(latest); return; }
      const blocked = error instanceof Error && error.name === 'NotAllowedError';
      if (blocked) { this.stopTransport(); this.publish('ready', 'Press Play to enable the soundtrack.'); }
      else this.publish('unavailable', fromPlaying(old) ? 'This track is unavailable; the previous soundtrack continues. Select Next.' : 'This soundtrack could not be loaded. Select Next or retry Play.');
    }
  }
  private assign(deck: Deck, track: MusicTrack, preload: 'auto' | 'none') {
    if (deck.track?.id === track.id && deck.audio.getAttribute('src') === track.url) { deck.audio.preload = preload; deck.audio.currentTime = 0; if (deck.audio.error) deck.audio.load(); return; }
    deck.audio.pause(); deck.token = ++this.generation; deck.weight = 0; deck.track = track;
    deck.audio.preload = preload; deck.audio.src = track.url; deck.audio.load();
  }
  private preloadNext() {
    if (!this.canPlay() || this.fade || this.pending) return;
    const active = this.decks[this.active];
    const next = this.after(active.track?.id);
    active.audio.loop = this.queue.length === 1;
    const standby = this.decks[1 - this.active];
    if (next && next.id !== active.track?.id) this.assign(standby, next, 'auto');
    else this.clearDeck(standby);
  }
  private stopTransport() {
    this.paused = true; ++this.generation; this.pending = undefined; this.queued = undefined; this.fade = undefined;
    clearInterval(this.timer); this.timer = undefined;
    for (const deck of this.decks) deck.audio.pause();
    this.decks[this.active].weight = 1; this.decks[1 - this.active].weight = 0;
    this.levelRamp = undefined; this.level = this.volume * (this.ducked ? VOICE_MUSIC_GAIN : 1); this.applyLevels();
  }
  private rampLevel(duration: number) {
    const target = this.volume * (this.ducked ? VOICE_MUSIC_GAIN : 1);
    if (!this.canPlay()) { this.level = target; this.levelRamp = undefined; this.applyLevels(); return; }
    this.levelRamp = { from: this.level, to: target, started: performance.now(), duration }; this.ensureTimer();
  }
  private ensureTimer() { this.timer ??= setInterval(() => this.tick(), 25); }
  private tick() {
    const now = performance.now();
    if (this.levelRamp) {
      const r = this.levelRamp, t = Math.min(1, (now - r.started) / r.duration);
      const smooth=t*t*(3-2*t);
      this.level = r.from + (r.to - r.from) * smooth; if (t === 1) this.levelRamp = undefined;
    }
    if (this.fade) {
      const f = this.fade, t = Math.min(1, (now - f.started) / CROSSFADE_MS);
      this.decks[f.from].weight = 1 - t; this.decks[f.to].weight = t;
      if (t === 1) {
        this.decks[f.from].audio.pause(); this.fade = undefined;
        const queued = this.queued; this.queued = undefined;
        if (queued && queued.id !== this.decks[this.active].track?.id) void this.switchTrack(queued); else this.preloadNext();
      }
    }
    this.applyLevels();
    if (!this.fade && !this.levelRamp && !this.punchAt) { clearInterval(this.timer); this.timer = undefined; }
  }
  private applyLevels() { const punch = this.punchGain(); for (const deck of this.decks) deck.audio.volume = Math.max(0, Math.min(1, deck.weight * this.level * punch)); }
  private clearDeck(deck: Deck) { deck.audio.pause(); deck.audio.removeAttribute('src'); deck.audio.preload = 'none'; deck.audio.load(); deck.track = undefined; deck.weight = 0; deck.token = ++this.generation; }
  private publish(state: MusicStatus['state'], message: string) { if (this.dead) return; this.status = { state, message, track: this.desired ?? this.decks[this.active].track }; this.onStatus?.(this.status); }
  dispose() {
    if (this.dead) return;
    this.stopTransport(); this.dead = true; document.removeEventListener('visibilitychange', this.visibilityHandler);
    for (const deck of this.decks) { this.clearDeck(deck); deck.audio.remove(); }
  }
}
function fromPlaying(deck: Deck) { return !!deck.track && !deck.audio.paused; }
