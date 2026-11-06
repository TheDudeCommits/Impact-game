import { monitorEventLoopDelay } from 'node:perf_hooks';
import { ARENAS_FULL_MESSAGE } from '../game/arenasFull';

export interface CapacityOptions {
  /** Most match rooms at once; 0: no cap. */
  roomCap?: number;
  /** Refuse new rooms while the server is falling behind. */
  shed?: boolean;
  /** An event-loop stall longer than this, in a one-second window, counts that second as behind. */
  lagMs?: number;
  /** Consecutive seconds behind before new rooms are refused. */
  behindSeconds?: number;
  /** Consecutive calm seconds before they are accepted again. */
  clearSeconds?: number;
}

/** What the environment says; anything that is not a whole number above zero (or an on-word) is off, and said so. */
export function capacityFromEnv(env: Record<string, string | undefined> = process.env, warn: (line: string) => void = line => console.warn(line)): Required<CapacityOptions> {
  const whole = (name: string, fallback: number) => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (Number.isInteger(n) && n > 0) return n;
    warn(`[capacity] ${name}="${raw}" is not a whole number above zero: ignored${fallback ? ` (using ${fallback})` : ' (off)'}`);
    return fallback;
  };
  const rawShed = env.LOAD_SHED?.trim().toLowerCase();
  if (rawShed && !/^(1|true|on|yes|0|false|off|no)$/.test(rawShed)) warn(`[capacity] LOAD_SHED="${env.LOAD_SHED}" is not 1/true/on or 0/false/off: load shedding stays off`);
  return {
    roomCap: whole('ROOM_CAP', 0),
    shed: /^(1|true|on|yes)$/.test(rawShed ?? ''),
    lagMs: whole('LOAD_SHED_LAG_MS', 200),
    behindSeconds: whole('LOAD_SHED_SECONDS', 10),
    clearSeconds: whole('LOAD_SHED_CLEAR_SECONDS', 5),
  };
}

/** The refusal Colyseus carries to the page. */
export class ArenasFullError extends Error {
  constructor(readonly why: 'cap' | 'load') { super(ARENAS_FULL_MESSAGE); this.name = 'ArenasFullError'; }
}

/** One second at a time: is the server behind, and has it been behind long enough to turn new rooms away? Pure: the clock,
 *  the step counts and the event-loop reading are handed in, so the rules are testable without waiting ten seconds. */
export class LoadGauge {
  /** Consecutive seconds behind / calm. */
  behind = 0; calm = 0;
  shedding = false;
  constructor(readonly lagMs = 200, readonly behindSeconds = 10, readonly clearSeconds = 5) {}
  /** One second's reading: steps the clock wrote off in it, and the worst event-loop stall in it. Returns whether `shedding` changed. */
  sample(writtenOff: number, stallMs: number): boolean {
    const behind = writtenOff > 0 || stallMs > this.lagMs;
    if (behind) { this.behind++; this.calm = 0; } else { this.calm++; this.behind = 0; }
    const was = this.shedding;
    if (!this.shedding && this.behind >= this.behindSeconds) this.shedding = true;
    else if (this.shedding && this.calm >= this.clearSeconds) this.shedding = false;
    return was !== this.shedding;
  }
}

export class Capacity {
  roomCap: number;
  readonly shed: boolean;
  readonly gauge: LoadGauge;
  /** The match rooms alive now (a Set, so a room that is released twice, or admitted twice, counts once). */
  private readonly live = new Set<object>();
  /** Refusals since the last report, by reason; `refusedTotal` since the process started. */
  refusedCap = 0; refusedLoad = 0; refusedTotal = 0;
  private lastWrittenOff = 0;
  private timer?: ReturnType<typeof setInterval>;
  private loop?: ReturnType<typeof monitorEventLoopDelay>;
  private lastRefusalLog = -Infinity;

  constructor(options: CapacityOptions = {}, private readonly log: (line: string) => void = line => console.log(line), private readonly clock: () => number = () => performance.now()) {
    this.roomCap = options.roomCap ?? 0;
    this.shed = options.shed === true;
    this.gauge = new LoadGauge(options.lagMs, options.behindSeconds, options.clearSeconds);
  }

  /** Either part is on. */
  get armed() { return this.roomCap > 0 || this.shed; }
  /** Match rooms alive now. */
  get rooms() { return this.live.size; }
  get shedding() { return this.shed && this.gauge.shedding; }

  /** Why a NEW room would be turned away right now, if it would. */
  why(): 'cap' | 'load' | undefined {
    if (this.roomCap > 0 && this.live.size >= this.roomCap) return 'cap';
    if (this.shedding) return 'load';
    return undefined;
  }

  /** A match room is being created (first thing in its onCreate): refused with ArenasFullError, or counted. */
  admit(room: object): void {
    if (this.live.has(room)) return;
    const why = this.why();
    if (why) {
      if (why === 'cap') this.refusedCap++; else this.refusedLoad++;
      this.refusedTotal++;
      // One line at most every ten seconds (a crowd pressing PLAY would otherwise print one each): the minute's [net] line has the count.
      const now = this.clock();
      if (now - this.lastRefusalLog >= 10_000) {
        this.lastRefusalLog = now;
        this.log(`[capacity] a new room was refused (${why === 'cap' ? `ROOM_CAP ${this.roomCap} reached, ${this.live.size} live` : `the server has been behind for ${this.gauge.behind} s, ${this.live.size} live`}); refused so far: ${this.refusedTotal}`);
      }
      throw new ArenasFullError(why);
    }
    this.live.add(room);
  }

  /** The room is gone (onDispose), or its onCreate failed after it was admitted. Safe to call twice. */
  release(room: object): void { this.live.delete(room); }

  /** One second of load: `writtenOffTotal` is the step clock's running count (netStats), `stallMs` the worst event-loop stall of the second. */
  tickSecond(writtenOffTotal: number, stallMs: number): void {
    const wrote = Math.max(0, writtenOffTotal - this.lastWrittenOff);
    this.lastWrittenOff = writtenOffTotal;
    if (!this.gauge.sample(wrote, stallMs)) return;
    this.log(this.gauge.shedding
      ? `[capacity] LOAD SHEDDING ON: the server has been behind for ${this.gauge.behind} s in a row (steps written off ${wrote}, event loop stalled ${stallMs.toFixed(0)} ms); new rooms are refused until it has been calm for ${this.gauge.clearSeconds} s. Running matches are untouched. ${this.live.size} live`
      : `[capacity] load shedding off: calm for ${this.gauge.clearSeconds} s; new rooms are accepted again. ${this.live.size} live`);
  }

  /** Start the one-second sampler (only when load shedding is on). `writtenOff` reads the step clock's running count. */
  start(writtenOff: () => number): void {
    if (!this.shed || this.timer) return;
    this.loop = monitorEventLoopDelay({ resolution: 10 });
    this.loop.enable();
    this.lastWrittenOff = writtenOff();
    this.timer = setInterval(() => {
      const stall = this.loop!.max / 1e6;
      this.loop!.reset();
      this.tickSecond(writtenOff(), Number.isFinite(stall) ? stall : 0);
    }, 1000);
    this.timer.unref();
  }
  stop(): void { clearInterval(this.timer); this.timer = undefined; this.loop?.disable(); this.loop = undefined; }

  /** What the minute's [net] line adds: nothing while neither part is on (the line is then exactly what it was); otherwise the
   *  state, and what was refused in the interval just ended (which this resets). */
  report(): string {
    if (!this.armed) return '';
    const parts = [
      this.roomCap > 0 ? `cap ${this.rooms}/${this.roomCap}` : `rooms ${this.rooms}`,
      this.shed ? (this.shedding ? `SHEDDING (behind ${this.gauge.behind} s)` : 'shed idle') : 'shed off',
      `refused ${this.refusedCap + this.refusedLoad}${this.refusedCap + this.refusedLoad ? ` (cap ${this.refusedCap}, load ${this.refusedLoad})` : ''}`,
    ];
    this.refusedCap = this.refusedLoad = 0;
    return ` · valve ${parts.join(', ')}`;
  }
}

/** The one the rooms report to; built from the environment when the server starts. */
export const capacity = new Capacity(capacityFromEnv());
