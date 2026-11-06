
/** The least share of the quality's pixel ratio the governor will ever draw at, and the step it is changed by. The
 *  renderer sets a floor above it (`floor`): on a high-density display never under one pixel a CSS pixel - the
 *  governor first took an M4's twelve-fighter match to 0.975, visibly soft on a Retina screen - and elsewhere three
 *  quarters of the quality's own. */
export const MIN_SCALE = .6, STEP = .05;
/** The least a renderer may set `floor` to: a phone allowed above one pixel a CSS pixel (GameRenderer, powerBudget.ts
 *  phoneSharpness) keeps its floor at three quarters of a pixel, a smaller share of its larger cap. */
export const LEAST_SCALE = .4;
/** Without a timer: the frame is the CPU's when the main thread's own work a frame (its median) is over this share of
 *  the frame aimed at - then no resolution would buy the frame back, and none is given up. */
export const CPU_SHARE = .85;
/** The GPU's budget for a frame, milliseconds: three quarters of a sixtieth. Down when the window's 75th percentile
 *  is over it, up when its 90th is under `ROOM` of it. */
export const BUDGET_MS = 12.5, ROOM = .7;
export const STRONG_BUDGET_MS = 15, STRONG_QUANTILE = .95;

export function strongGpu(name: string) {
  if (/Apple M\d+ (Pro|Max|Ultra)/i.test(name)) return true;
  const apple = name.match(/Apple M(\d+)/i);
  if (apple) return +apple[1] >= 4;
  if (/NVIDIA|GeForce|Quadro/i.test(name)) return /RTX|GTX 1[6-9]\d\d|COLOSSUS/i.test(name) && !/\bMX\s?\d/i.test(name);
  if (/Radeon/i.test(name)) return /\bRX\s?\d|Pro W\d|Radeon VII/i.test(name) && !/Vega \d|Graphics/i.test(name);
  return false;
}
/** Without a timer: down when the frames' 75th percentile is over a 50 fps frame, up when the 90th is inside a
 *  sixtieth's margin. */
export const SLOW_FRAME_MS = 20, FAST_FRAME_MS = 18;
/** Seconds: how often the window is judged, how long after a step down before a step up, and how many samples a
 *  judgement needs. */
export const WINDOW_S = 1, UP_AFTER_DOWN_S = 4, MIN_SAMPLES = 20;

export interface GovernorJudgement {
  scale: number;
  /** A strong machine (strongGpu, on mains power): STRONG_BUDGET_MS at the window's STRONG_QUANTILE. */
  strong?: boolean;
  /** The least scale allowed, MIN_SCALE..1. */
  floor?: number;
  /** Seconds since the last step down. */
  sinceDown: number;
  /** The window's samples, milliseconds: GPU time a frame when `timed`, else whole frames. */
  samples: readonly number[];
  timed: boolean;
  budgetMs?:number;
  frameMs?:number;
  /** The window's main-thread milliseconds a frame (from the frame's start to its draw calls sent), where known. */
  cpu?: readonly number[];
  /** No step up while the CPU holds the frame back (a phone drawing above one pixel a CSS pixel: GameRenderer). */
  cpuGate?: boolean;
}

const quantile = (sorted: readonly number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

/** Whether the main thread's own work holds the frame back: its median over CPU_SHARE of the frame aimed at. */
export function cpuLimited(cpu: readonly number[] | undefined, frameMs = 1000 / 60) {
  if (!cpu || cpu.length < MIN_SAMPLES) return false;
  return quantile([...cpu].sort((a, b) => a - b), .5) > frameMs * CPU_SHARE;
}

/** The scale for the next window. Steps down by `STEP` (two when far over), up by `STEP`, and holds otherwise. Without a
 *  timer, a window the CPU holds back (cpuLimited) is not stepped down; with `cpuGate`, nor up. */
export function nextScale({scale, floor = MIN_SCALE, strong = false, sinceDown, samples, timed,budgetMs,frameMs=1000/60,cpu,cpuGate=false}: GovernorJudgement): number {
  if (samples.length < MIN_SAMPLES) return scale;
  const sorted = [...samples].sort((a, b) => a - b), p75 = quantile(sorted, .75), p90 = quantile(sorted, .9);
  const budget = budgetMs??(strong ? STRONG_BUDGET_MS : BUDGET_MS), held = strong ? quantile(sorted, STRONG_QUANTILE) : p75, room = strong ? held : p90;
  const over = timed ? held / budget : p75 / Math.max(SLOW_FRAME_MS,frameMs*1.2);
  let next = scale;
  if (over > 1) { if (timed || !cpuLimited(cpu, frameMs)) next = scale - (over > 1.4 ? 2 : 1) * STEP; }
  else if (sinceDown >= UP_AFTER_DOWN_S && !(cpuGate && cpuLimited(cpu, frameMs)) && (timed ? room < budget * ROOM : p90 < Math.max(FAST_FRAME_MS,frameMs*1.08))) next = scale + STEP;
  const least = Math.min(1, Math.max(LEAST_SCALE, floor));
  // (A floor or a start off the step's grid - a phone's 1/1.5 - is kept exactly: rounded, it fell a step under it.)
  return Math.min(1, Math.max(least, Math.abs(next - scale) < 1e-9 ? scale : Math.round(next / STEP) * STEP));
}

export class ResolutionGovernor {
  /** The share of the quality's pixel ratio drawn at now, floor..1. */
  scale = 1;
  /** The least share it may draw at (see MIN_SCALE). */
  floor = MIN_SCALE;
  /** A GPU with room to spare (strongGpu), and whether the machine is on mains power - a laptop on battery, or one the
   *  browser cannot tell about, is plugged in unless it says otherwise (navigator.getBattery). */
  strong = false;
  plugged = true;
  budgetMs?:number;
  frameMs=1000/60;
  /** The last window judged held back by the main thread (cpuLimited), where the frame's CPU time is told (`update`). */
  cpuBound = false;
  /** No step up while the CPU holds the frame back (nextScale `cpuGate`): a phone allowed above one pixel a CSS pixel. */
  cpuGate = false;
  /** Held to the strong budget now. */
  get relaxed() { return this.strong && this.plugged; }
  private readonly gl: WebGL2RenderingContext;
  private ext: {TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number} | null;
  private readonly pending: WebGLQuery[] = [];
  private readonly samples: number[] = [];
  private readonly cpu: number[] = [];
  private open = false;
  private judgedAt = 0;
  private downAt = -1e9;
  private lastFrame = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as {TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number} | null;
    const info = gl.getExtension('WEBGL_debug_renderer_info') as {UNMASKED_RENDERER_WEBGL: number} | null;
    this.strong = strongGpu(String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? ''));
    // Battery power holds a strong laptop to the ordinary budget, and lets it go when it is plugged in again.
    const nav = (typeof navigator === 'undefined' ? undefined : navigator) as (Navigator & {getBattery?: () => Promise<{charging: boolean; addEventListener(type: string, listener: () => void): void}>}) | undefined;
    nav?.getBattery?.().then(battery => {
      const read = () => { this.plugged = battery.charging; };
      read(); battery.addEventListener('chargingchange', read);
    }).catch(() => {});
  }

  get timed() { return !!this.ext; }

  /** Before the frame's draws: starts its timer, when there is one and nothing else is timing. */
  begin() {
    if (!this.ext || this.open || this.pending.length > 6) return;
    const query = this.gl.createQuery();
    if (!query) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.pending.push(query);
    this.open = true;
  }

  /** After the frame's draws. */
  end() {
    if (!this.ext || !this.open) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.open = false;
  }

  /** Once a frame, after `end`: collects what has come back and, once a window, judges it. `hold` keeps the scale
   *  where it is (a clip being recorded); `cpuMs`, the frame's main-thread time, where the renderer knows it. Answers
   *  whether the scale changed. */
  update(now: number, hold = false, cpuMs?: number): boolean {
    const {gl, ext} = this;
    if (cpuMs !== undefined && cpuMs >= 0 && cpuMs < 250) this.cpu.push(cpuMs);
    if (ext) {
      while (this.pending.length && gl.getQueryParameter(this.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const query = this.pending.shift()!;
        this.samples.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(query);
      }
    } else if (this.lastFrame) {
      // A frame away longer than a quarter of a second is a tab put back, not a slow frame.
      const gap = now - this.lastFrame;
      if (gap < 250) this.samples.push(gap);
    }
    this.lastFrame = now;
    if (now - this.judgedAt < WINDOW_S * 1000) return false;
    this.judgedAt = now;
    let samples = this.samples.splice(0);
    const cpu = this.cpu.splice(0);
    this.cpuBound = cpuLimited(cpu, this.frameMs);
    // A GPU that went disjoint in the window (a power-state or display switch) voids the timings in flight: the whole
    // window is dropped. It is asked once a window, not once a query: getParameter is a round trip to the GPU process
    // that waits until it has decoded every command queued before it, so one a frame held the page's main thread
    // behind its own frame's draws - 0.5-0.9 ms of waiting a frame, 5% of the main thread in a Training fight, measured.
    if (ext && gl.getParameter(ext.GPU_DISJOINT_EXT)) samples = [];
    if (hold) return false;
    const next = nextScale({scale: this.scale, floor: this.floor, strong: this.relaxed, sinceDown: (now - this.downAt) / 1000, samples, timed: !!ext,budgetMs:this.budgetMs,frameMs:this.frameMs,cpu,cpuGate:this.cpuGate});
    if (Math.abs(next - this.scale) < 1e-6) return false;
    if (next < this.scale) this.downAt = now;
    this.scale = next;
    return true;
  }

  /** The context came back after it was lost (GameRenderer): the queries in flight belonged to the lost one and never
   *  answer (kept, they filled `pending` and no timer was started again), and an extension has to be asked for anew on
   *  a restored context before its enums are valid. */
  restored() { this.pending.length = 0; this.open = false; this.samples.length = 0; this.cpu.length = 0; this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2') as {TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number} | null; }
  /** A new quality starts from its own full resolution (`start`: a share of it, a phone allowed above one pixel a CSS
   *  pixel starting at one). */
  reset(start = 1) { this.scale = start; this.samples.length = 0; this.cpu.length = 0; this.cpuBound = false; this.downAt = -1e9; }
}
