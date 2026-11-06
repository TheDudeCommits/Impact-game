import { browserOf, cleanReport, signatureOf, type ErrorReport, type ReportKind } from '../game/errorReport';
import { isChunkError, isMissingAsset, whenUnrecovered } from '../loading/staleBuild';
import { economyServer } from '../ui/shop/account';

export const REPORTS_PER_TAB = 10;
/** The first-visit notice's key (ui/firstVisit.ts NOTICE_KEY; not imported, so its stylesheet keeps its place in the
 *  page's order: a test holds the two together). Any value: the notice has been seen at some version. */
export const NOTICE_SEEN_KEY = 'jump-fan-notice';
const SETTINGS_KEY = 'rift-settings';

/** What the page around the reporter is: the browser's, or a test's. */
export interface ReporterHost {
  send(url: string, body: string): void;
  read(key: string): string | null;
  agent: string;
  path(): string;
  build: string;
  server(): string;
  automated: boolean;
}

/** Whether a settings save allows reports: anything but an explicit `errorReports: false` does. */
export function savedChoice(raw: string | null): boolean {
  try { const saved = JSON.parse(raw ?? '{}') as { errorReports?: unknown } | null; return saved?.errorReports !== false; } catch { return true; }
}

/** An error's words and stack, whatever was thrown: an Error, a string, an event, anything. */
export function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, stack: error.stack };
  if (typeof error === 'string') return { message: error };
  if (error && typeof error === 'object') {
    const { message, name, stack, type } = error as { message?: unknown; name?: unknown; stack?: unknown; type?: unknown };
    if (typeof message === 'string') return { message: typeof name === 'string' && name ? `${name}: ${message}` : message, stack: typeof stack === 'string' ? stack : undefined };
    if (typeof type === 'string') return { message: `${(error as object).constructor?.name ?? 'Event'}: ${type}` };
    return { message: Object.prototype.toString.call(error) };
  }
  return { message: String(error) };
}

/** Not the game's to fix: the browser's own resize-loop warning, a cross-origin script's empty "Script error.", and
 *  anything a browser extension threw. */
export function noise(message: string, stack?: string, file?: string): boolean {
  if (/^ResizeObserver loop/.test(message)) return true;
  if (/^Script error\.?$/.test(message) && !stack) return true;
  return /\b(?:chrome|moz|safari(?:-web)?|ms-browser|webkit-masked)-extension:/.test(`${stack ?? ''}\n${file ?? ''}`);
}

const safely = <T>(read: () => T, fallback: T): T => { try { return read(); } catch { return fallback; } };
const randomTab = () => {
  try { const bytes = crypto.getRandomValues(new Uint8Array(8)); return Array.from(bytes, byte => (byte % 36).toString(36)).join(''); }
  catch { return Math.random().toString(36).slice(2, 10).padEnd(8, '0'); }
};

/** What became of a report (the tests read it). */
export type Outcome = 'off' | 'noise' | 'seen' | 'full' | 'held' | 'sent';

export class ErrorReporter {
  /** Whether Settings allow reports: main.ts lends the live settings (`lend`); until then, what is saved. */
  enabled: () => boolean = () => savedChoice(this.host.read(SETTINGS_KEY));
  /** Where the player is ('home', 'match', 'survival', a room's mode): main.ts lends it. */
  screen: () => string | undefined = () => undefined;
  /** The player's own names, taken out of every report: main.ts lends the one they play under. */
  names: () => readonly string[] = () => [];
  readonly tab: string;
  private readonly seen = new Set<string>();
  private readonly held: ErrorReport[] = [];
  private noticeClosed = false;
  constructor(private readonly host: ReporterHost, tab = randomTab()) { this.tab = tab; }

  /** What main.ts knows once it is up. */
  lend(parts: { enabled?: () => boolean; screen?: () => string | undefined; names?: () => readonly string[] }) {
    if (parts.enabled) this.enabled = parts.enabled;
    if (parts.screen) this.screen = parts.screen;
    if (parts.names) this.names = parts.names;
  }

  /** Whether the first-visit notice has been seen: at some version, in this browser, or closed in this tab (a
   *  browser that keeps no storage never remembers it). */
  noticeSeen() { return this.noticeClosed || this.host.read(NOTICE_SEEN_KEY) !== null; }
  /** The notice was closed: what waited for it goes now (if Settings still allow it). */
  noticeRead() { this.noticeClosed = true; const held = this.held.splice(0); if (safely(this.enabled, false)) for (const report of held) this.post(report); }

  /** One error, as `kind`; `where`, the part of the game that caught it. `urgent`: sent even before the first-visit
   *  notice has been seen - a page that cannot start (no 3D graphics: boot/webglFailure.ts) never shows the notice, so
   *  its report would wait for ever, and every first visit that failed so went unheard. `details`: lines sent as the
   *  report's stack (no frame, so the group stays one: game/errorReport.ts signatureOf). */
  report(kind: ReportKind, error: unknown, where?: string, file?: string, urgent = false, details?: readonly string[]): Outcome {
    try {
      if (this.host.automated || !safely(this.enabled, false)) return 'off';
      const described = describe(error), message = described.message, stack = details?.length ? details.join('\n') : described.stack;
      if (noise(message, stack, file)) return 'noise';
      const report = cleanReport({ kind, message: where ? `${where}: ${message}` : message, stack, build: this.host.build, path: this.host.path(),
        screen: safely(this.screen, undefined), browser: browserOf(this.host.agent), tab: this.tab }, safely(this.names, []));
      if (!report) return 'noise';
      const id = signatureOf(report).id;
      if (this.seen.has(id)) return 'seen';
      if (this.seen.size >= REPORTS_PER_TAB) return 'full';
      this.seen.add(id);
      if (!this.noticeSeen() && !urgent) { this.held.push(report); return 'held'; }
      this.post(report);
      return 'sent';
    } catch { return 'noise'; }
  }

  /** A context lost while the game is on screen (iOS takes a background page's and gives it back: not a fault).
   *  `details`: what the page knew then (main.ts: the GPU, the quality, the fighters, the GPU's textures and geometries,
   *  the seconds since load, the host), sent as the report's lines (the 2 November audit: 156 losses and nothing to tell
   *  a phone's memory from a driver's reset). */
  watchCanvas(canvas: Pick<EventTarget, 'addEventListener'>, hidden: () => boolean = () => typeof document === 'object' && document.hidden, details: () => readonly string[] = () => []) {
    canvas.addEventListener('webglcontextlost', () => { if (!hidden()) this.report('webgl', 'the graphics context was lost while the game was on screen', undefined, undefined, false, safely(details, [])); });
  }

  private post(report: ErrorReport) { try { this.host.send(`${this.host.server()}/errors`, JSON.stringify(report)); } catch { /* nothing to be done */ } }
}

/** A graphics loss's lines (watchCanvas `details`): what tells a phone's memory from a driver's reset. */
export interface LossFacts { gpu?: string; quality?: string; fighters?: number; memory?: { geometries: number; textures: number }; images?: { count: number; bytes: number; largest: number }; seconds: number; host: string }
export function lossDetails(facts: LossFacts): string[] {
  const lines = [`gpu: ${facts.gpu || 'unknown'}`, `quality: ${facts.quality ?? 'unknown'}`];
  if (facts.fighters !== undefined) lines.push(`fighters: ${facts.fighters}`);
  if (facts.memory) lines.push(`gpu memory: ${facts.memory.textures} textures, ${facts.memory.geometries} geometries`);
  if (facts.images) lines.push(`images: ${facts.images.count}, ${(facts.images.bytes / 1048576).toFixed(1)} MB, largest ${facts.images.largest} px`);
  lines.push(`seconds since load: ${Math.round(facts.seconds)}`, `host: ${facts.host}`);
  return lines;
}

const browserHost = (): ReporterHost => ({
  send: (url, body) => { void fetch(url, { method: 'POST', body, keepalive: true, credentials: 'omit', headers: { 'content-type': 'text/plain' } }).catch(() => {}); },
  read: key => { try { return localStorage.getItem(key); } catch { return null; } },
  agent: navigator.userAgent,
  path: () => location.pathname,
  build: import.meta.env.VITE_BUILD_SHA || 'development',
  server: economyServer,
  automated: !!navigator.webdriver && !new URLSearchParams(location.search).has('reports'),
});
const nowhere: ReporterHost = { send: () => {}, read: () => null, agent: '', path: () => '/', build: 'development', server: () => '', automated: true };

/** The page's one reporter. */
export const errorReports = new ErrorReporter(typeof window === 'object' && typeof navigator === 'object' ? browserHost() : nowhere);
/** An error the game caught and carried on through (`where`: which part caught it). */
export const reportCaught = (error: unknown, where: string) => errorReports.report('caught', error, where);
/** A start that failed (main.ts hud.onStart), unless it failed at somebody's word: a refusal for the player to read
 *  (the server's, the room's, a mistyped code's - each a plain Error in network.ts) is not a fault, and a chunk of an
 *  older build is staleBuild's (it reports one it could not cure). A TypeError and its kind are the code's own. */
export function reportStartFailure(error: unknown): Outcome | undefined {
  if (error instanceof Error && error.name === 'Error') return undefined;
  if (isChunkError(error) || isMissingAsset(error)) return undefined;
  return reportCaught(error, 'start');
}

if (typeof window === 'object' && typeof document === 'object') {
  // (An error marked `reported` was told already, as itself: boot/webglFailure.ts's stop.)
  window.addEventListener('error', event => { if ((event.error as { reported?: unknown } | null)?.reported !== true) errorReports.report('error', event.error ?? event.message, undefined, event.filename); });
  // (A chunk of an older build is staleBuild's: it reloads, and tells the reporter only if it could not.)
  window.addEventListener('unhandledrejection', event => { if (!isChunkError(event.reason)) errorReports.report('rejection', event.reason); });
  whenUnrecovered(error => errorReports.report('chunk', error));
  // The notice's dialog closing (its own listener writes the key; this one, in the capture phase, runs first).
  document.addEventListener('close', event => { if ((event.target as Element | null)?.id === 'first-visit') errorReports.noticeRead(); }, true);
}
