
/** What broke: an uncaught error on the page; a promise nobody caught; the graphics context lost on screen; a match
 *  that did not load in time (the server's 4008); an error the game caught and carried on through (the survival
 *  run's glitch notes, a start that failed in the code rather than at the server's word); and a file of the page's
 *  own build that would not load with no newer build to reload onto (loading/staleBuild.ts recovers the rest). */
export const REPORT_KINDS = ['error', 'rejection', 'webgl', 'stall', 'caught', 'chunk'] as const;
export type ReportKind = typeof REPORT_KINDS[number];

export interface ErrorReport {
  kind: ReportKind;
  /** The error's own words, cleaned: at most MESSAGE_MAX characters. */
  message: string;
  /** Its stack, cleaned: at most STACK_FRAMES lines and STACK_MAX characters. */
  stack?: string;
  /** The page's build (VITE_BUILD_SHA), or 'development', or 'unknown'. */
  build: string;
  /** The page's address: its path only. */
  path: string;
  /** Where the player was: 'home', 'match', 'survival', a room's mode... */
  screen?: string;
  /** "Chrome 141 / Android" (browserOf). */
  browser?: string;
  /** The tab's random id. */
  tab?: string;
}

export const MESSAGE_MAX = 300, STACK_FRAMES = 12, STACK_MAX = 2000;
/** The most a report may weigh on the wire, in bytes (the server stops reading past it). */
export const BODY_MAX = 8192;

/** A run of letters and digits long enough to be a key, a token or encoded data - unless it reads as words: a
 *  hyphenated lower-case name ("konta-whirl-clan-sage-mode-2") is kept; mixed case, or one long word of letters and
 *  digits, is not. */
const encoded = (run: string) => /\d/.test(run) && /[A-Za-z]/.test(run) && ((/[A-Z]/.test(run) && /[a-z]/.test(run)) || !/[-_]/.test(run));

/** Every rule, in order. (The URL rules first, so a token in a query goes with its query.) */
const RULES: readonly (readonly [RegExp, string | ((match: string, ...groups: string[]) => string)])[] = [
  // Data and blob addresses carry their whole payload.
  [/\bdata:[\w.+/-]*(?:;[\w=.+-]+)*,[^\s'"`()<>]*/gi, 'data:<data>'],
  // A query string, wherever it is (`?key=value...`), short of a stack frame's :line:column. (No lookbehind: Safari
  // before 16.4 cannot parse one, and this file is in the page's bundle.)
  [/([\w/.-])\?(?=[^\s'"`()<>]*=)[^\s'"`()<>]*?(?=:\d+(?::\d+)?\)?(?:\s|$)|[\s'"`()<>]|$)/gm, '$1'],
  // An address's fragment.
  [/(:\/\/[^\s#'"`()<>]*)#[^\s'"`()<>]*/g, '$1'],
  [/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 <token>'],
  [/\beyJ[\w-]*\.[\w-]*(?:\.[\w-]*)?/g, '<token>'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, '<email>'],
  [/\bdid:[a-z0-9]+:[\w.-]+/gi, '<id>'],
  // A signed-in session's token (s_ and 32 of base64url: economy/book.ts).
  [/\bs_[A-Za-z0-9_-]{16,}/g, '<token>'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>'],
  // A guest's token is 32 hex characters; a build's own hash is 12 (`build` is checked, not scrubbed).
  [/\b(?:0x)?[0-9a-f]{16,}\b/gi, '<hex>'],
  [/[A-Za-z0-9+_=-]{24,}/g, run => encoded(run) ? '<data>' : run],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ip>'],
  [/\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b/gi, '<ip>'],
  // A developer's machine: the folder that names its user.
  [/(\/Users\/|\/home\/|[A-Za-z]:\\+Users\\+)[^/\\\s'"`()<>]+/gi, '$1<user>'],
  // A private room's six digits (network.ts: rift-, duel-, objective- rooms).
  [/\b(rift|duel|objective|coop|private)-\d{6}\b/gi, '$1-<code>'],
];

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Text with everything that could say who it came from taken out. `names`: the player's own (the page knows it; the
 *  server cannot), replaced wherever they stand, whatever their case. */
export function scrub(text: string, names: readonly string[] = []): string {
  let out = text;
  for (const [pattern, to] of RULES) out = out.replace(pattern, to as string);
  // (After the rules, so a name in a query goes with its query; a marker the rules left - <hex>, <data> - stays whole.)
  for (const name of names) if (name && name.trim().length >= 3 && name.trim() !== 'Fighter')
    out = out.replace(new RegExp(`<[a-z]+>|${escape(name.trim())}`, 'gi'), found => /^<[a-z]+>$/.test(found) ? found : '<name>');
  return out;
}

const cut = (text: string, max: number) => text.length > max ? `${text.slice(0, max - 1)}…` : text;
const plain = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max * 4) : '';

/** A stack kept to its first STACK_FRAMES lines, each at most 300 characters, the whole at most STACK_MAX. */
function stackOf(value: unknown, names: readonly string[]): string | undefined {
  const lines = scrub(plain(value, STACK_MAX), names).split('\n').map(line => cut(line.trim(), 300)).filter(Boolean).slice(0, STACK_FRAMES);
  return lines.length ? cut(lines.join('\n'), STACK_MAX) : undefined;
}

/** A report as it may be kept, or undefined if it is not one: the page's own before it sends, the server's on receipt.
 *  Every field is checked against what it may hold; anything else in the body is dropped. */
export function cleanReport(raw: unknown, names: readonly string[] = []): ErrorReport | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const body = raw as Record<string, unknown>;
  if (!(REPORT_KINDS as readonly unknown[]).includes(body.kind)) return undefined;
  const message = cut(scrub(plain(body.message, MESSAGE_MAX), names).replace(/\s+/g, ' ').trim(), MESSAGE_MAX);
  if (!message) return undefined;
  const report: ErrorReport = { kind: body.kind as ReportKind, message, build: buildOf(body.build), path: pathOf(body.path) };
  const stack = stackOf(body.stack, names); if (stack) report.stack = stack;
  if (typeof body.screen === 'string' && /^[a-z0-9][a-z0-9 _-]{0,23}$/i.test(body.screen)) report.screen = body.screen.toLowerCase();
  if (typeof body.browser === 'string' && /^[A-Za-z][A-Za-z ]{0,19}( \d{1,4})?( \/ [A-Za-z][A-Za-z ]{0,11})?$/.test(body.browser)) report.browser = body.browser;
  if (typeof body.tab === 'string' && /^[a-z0-9]{6,16}$/.test(body.tab)) report.tab = body.tab;
  return report;
}
const buildOf = (value: unknown) => typeof value === 'string' && (/^[0-9a-f]{7,40}$/.test(value) || value === 'development') ? value : 'unknown';
const pathOf = (value: unknown) => {
  const path = typeof value === 'string' ? value.split(/[?#]/, 1)[0] : '';
  return /^\/[\w./-]{0,100}$/.test(path) ? scrub(path) : '/';
};

/** The browser as a report names it: its family and major version and the system it runs on, never the user agent
 *  itself ("Chrome 141 / Android", "Safari 18 / iOS"; "other" for what is not known). Order matters: Edge, Opera and
 *  Samsung Internet call themselves Chrome as well, and every browser on iOS calls itself Safari. */
export function browserOf(agent: string): string {
  const system = /iPhone|iPad|iPod/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /CrOS/.test(agent) ? 'ChromeOS'
    : /Windows/.test(agent) ? 'Windows' : /Macintosh|Mac OS X/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : '';
  const families: readonly (readonly [RegExp, string])[] = [[/\bEdg(?:e|A|iOS)?\/(\d+)/, 'Edge'], [/\b(?:OPR|OPX)\/(\d+)/, 'Opera'],
    [/\bSamsungBrowser\/(\d+)/, 'Samsung Internet'], [/\b(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'], [/\b(?:HeadlessChrome|Chrome|CriOS)\/(\d+)/, 'Chrome'],
    [/\bVersion\/(\d+)[\d.]*(?: Mobile\/\S+)? Safari\//, 'Safari']];
  for (const [pattern, name] of families) {
    const version = pattern.exec(agent)?.[1];
    if (version) return `${name} ${version}${system ? ` / ${system}` : ''}`;
  }
  return system ? `other / ${system}` : 'other';
}

/** A stack's first frame in the code - its function and file, no line or column, the build's hash out of the file's
 *  name (index-D3fK2aB1.js is index.js in every build), no address - so one bug is one group across releases. Chrome
 *  writes `at fn (url:1:2)` under the message; Firefox and Safari `fn@url:1:2`. */
export function firstFrame(stack?: string): string {
  for (const line of (stack ?? '').split('\n')) {
    const frame = line.trim();
    if (!/^at\s/.test(frame) && !/@.*:\d+/.test(frame) && !/^[a-z][a-z0-9+.-]*:\/\/\S*:\d+/i.test(frame)) continue;
    return frame.replace(/^at\s+/, '').replace(/[a-z][a-z0-9+.-]*:\/\/[^/\s)]*/gi, '').replace(/:\d+(?::\d+)?/g, '')
      .replace(/-[A-Za-z0-9_-]{8}(?=\.m?js\b)/g, '').slice(0, 160);
  }
  return '';
}

/** 32-bit FNV-1a, as eight hex digits: a group's short name (no crypto on the page for this). */
const fnv = (text: string) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };

/** What makes two reports the same error: the kind, the words with every number made '#' (an index, a count, a size
 *  is the same bug at another value), and the first frame. `id` names the group. */
export function signatureOf(report: Pick<ErrorReport, 'kind' | 'message' | 'stack'>): { id: string; message: string; frame: string } {
  const message = report.message.replace(/\d+(?:\.\d+)?/g, '#'), frame = firstFrame(report.stack);
  return { id: fnv(`${report.kind}|${message}|${frame}`), message, frame };
}
