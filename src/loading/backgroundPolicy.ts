import { phone } from '../input/device';

/** The bot royale's fighters until the player picks a number: six on a phone, whose browser tab is closed at about a
 *  gigabyte or so of memory (a twelve-fighter royale's bodies and textures take 0.6-1 GB of GPU memory), eight
 *  everywhere else. */
export const defaultRoyaleFighters = () => phone() ? 6 : 8;

export interface DeviceSignals {
  /** The browser's data saver (Save-Data). */
  saveData?: boolean;
  /** Network Information: 'slow-2g' to '4g' (Chromium), the link type where known ('cellular' on Android), and the
   *  measured downlink in Mbit/s (capped at 10). */
  effectiveType?: string;
  type?: string;
  downlink?: number;
  /** Mbit/s this page has itself been sent its larger files at (the fastest one): the browser's own estimate
   *  (`downlink`) can be a default before it has seen enough traffic, 1.45-1.75 on a line many times that fast. */
  measured?: number;
  /** Mbit/s of the line as a whole (lineMbps): every byte the page has been sent over the time something was arriving; known
   *  once over a megabyte has come. */
  line?: number;
  /** GB, Chromium only, capped at 8. */
  deviceMemory?: number;
  /** A phone or tablet: a touch screen with no mouse, or the browser saying it is mobile. */
  handheld: boolean;
  /** A GPU with room to spare, on mains power (ResolutionGovernor.relaxed). */
  strongMachine: boolean;
}

export function readSignals(strongMachine: boolean): DeviceSignals {
  const nav = (typeof navigator === 'undefined' ? {} : navigator) as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string; type?: string; downlink?: number };
    deviceMemory?: number; userAgentData?: { mobile?: boolean };
  };
  const media = (query: string) => typeof matchMedia === 'function' && matchMedia(query).matches;
  // iPadOS asks for desktop pages as a Mac, with a touch screen.
  const iPad = /Macintosh/.test(nav.userAgent ?? '') && (nav.maxTouchPoints ?? 0) > 1;
  const handheld = !!nav.userAgentData?.mobile || iPad || /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent ?? '')
    || media('(pointer: coarse)') && !media('(any-pointer: fine)');
  const c = nav.connection;
  return { saveData: c?.saveData, effectiveType: c?.effectiveType, type: c?.type, downlink: c?.downlink, measured: measuredMbps(), line: lineMbps(), deviceMemory: nav.deviceMemory, handheld, strongMachine };
}

/** The fastest of this page's own downloads over 300 KB (a lower bound on the line: several share it at once). */
export function measuredMbps(): number | undefined {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return undefined;
  let best: number | undefined;
  for (const e of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
    const bytes = e.encodedBodySize, seconds = (e.responseEnd - e.responseStart) / 1000;
    if (e.transferSize > 0 && bytes > 300_000 && seconds > .02) best = Math.max(best ?? 0, bytes * 8 / 1e6 / seconds);
  }
  return best;
}

/** The slowest line (lineMbps) the home fetches a volume's fighters on in the
 *  background - 40 to 60 MB, which this rate brings in about twenty seconds. Below it (on a 20
 *  Mbit/s line the volume took the whole line for 20-25 s after the home appeared, its files holding a first match's own behind
 *  them) the home fetches the picked fighter only, and each other one when it is picked or a room has it, as on a phone. Where
 *  the line is not known yet the page's fastest file decides as before (under 5 Mbit/s), else the browser's estimate. */
export const BACKGROUND_ROSTER_MBPS = 20;

/** The line as a whole - the bytes of every download this page has been sent, over
 *  the time something was arriving (the union of the responses' spans) - which files sharing the line do not divide as they do
 *  `measuredMbps`. Measured at the rule's moment: 48 on a 50 Mbit/s line,
 *  14-17 on 20, 5.6 on 9, where the fastest file read 19.6, 7.8 and 3.4 (and the entry chunk, smaller now, can
 *  arrive inside the 20 ms `measuredMbps` ignores on a fast line, which then read as no measure at all). Undefined under a
 *  megabyte (a return visit from the cache). */
export function lineMbps(): number | undefined {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return undefined;
  const spans: [number, number][] = []; let bytes = 0;
  for (const e of performance.getEntriesByType('resource') as PerformanceResourceTiming[])
    if (e.transferSize > 0 && e.encodedBodySize > 0 && e.responseEnd > e.responseStart) { bytes += e.encodedBodySize; spans.push([e.responseStart, e.responseEnd]); }
  if (bytes < 1e6) return undefined;
  spans.sort((a, b) => a[0] - b[0]);
  let busy = 0, end = -Infinity;
  for (const [from, to] of spans) { if (from > end) { busy += to - from; end = to; } else if (to > end) { busy += to - end; end = to; } }
  return bytes * 8 / 1e6 / Math.max(busy / 1000, .001);
}

export function backgroundRoster(s: DeviceSignals): { allowed: boolean; reason: string } {
  const no = (reason: string) => ({ allowed: false, reason });
  if (s.saveData) return no('data saver is on');
  if (s.type === 'cellular') return no('a cellular connection');
  // The browser's own read of a slow line ('slow-2g' to '3g', from its round trips and throughput) holds it back even where the
  // page has measured its own downloads: the read swings (the same line read '3g' and '4g' a minute apart), and a
  // swing to slow costs the home nothing it needs.
  if (s.effectiveType && s.effectiveType !== '4g') return no(`a slow connection (${s.effectiveType})`);
  // The line as the page has been sent it where over a megabyte has come; else its fastest file; else the browser's estimate.
  if (s.line !== undefined) { if (s.line < BACKGROUND_ROSTER_MBPS) return no(`a slow connection (${s.line.toFixed(1)} Mbit/s)`); }
  else if (s.measured !== undefined) { if (s.measured < 5) return no(`a slow connection (${s.measured.toFixed(1)} Mbit/s)`); }
  else if (s.downlink !== undefined && s.downlink > 0 && s.downlink < 5) return no(`a slow connection (${s.downlink} Mbit/s)`);
  if (s.handheld) return no('a phone or tablet');
  if (!s.strongMachine) return no('not a strong machine (or on battery)');
  if (s.deviceMemory !== undefined && s.deviceMemory < 8) return no(`${s.deviceMemory} GB of memory`);
  return { allowed: true, reason: 'a strong machine on a fast connection' };
}

/** A line on which a room's own files and its sound bank are better fetched one after the other (main.ts holds the bank while
 *  the room's bodies, stage and effects come in: CombatAudio.holdFetches; the performance sweep, 24 October 2026). On a 40
 *  Mbit/s line the hold took a pinned twelve-fighter royale from PLAY to the fight in 10.9 s instead of 13.7; with the files on
 *  this Mac's own disk it cost 0.6 s, the bank's decodes queuing behind the room's compile. Held where the page has measured
 *  under THIN_LINE_MBPS - where a royale's 13.5 MB of sound takes about as long as its compile, or longer - or says it saves
 *  data or is on a cellular link. */
export const THIN_LINE_MBPS = 150;
export function thinLine(): boolean {
  const c = (typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { connection?: { saveData?: boolean; type?: string } }).connection);
  if (c?.saveData || c?.type === 'cellular') return true;
  const measured = measuredMbps();
  return measured !== undefined && measured < THIN_LINE_MBPS;
}
