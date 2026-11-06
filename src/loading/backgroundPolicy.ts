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
  return { saveData: c?.saveData, effectiveType: c?.effectiveType, type: c?.type, downlink: c?.downlink, measured: measuredMbps(), deviceMemory: nav.deviceMemory, handheld, strongMachine };
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

export function backgroundRoster(s: DeviceSignals): { allowed: boolean; reason: string } {
  const no = (reason: string) => ({ allowed: false, reason });
  if (s.saveData) return no('data saver is on');
  if (s.type === 'cellular') return no('a cellular connection');
  // The page's own downloads where it has made some; else the browser's estimate, which swings (the same line read
  // '3g' and '4g' a minute apart).
  if (s.measured !== undefined) { if (s.measured < 5) return no(`a slow connection (${s.measured.toFixed(1)} Mbit/s)`); }
  else {
    if (s.effectiveType && s.effectiveType !== '4g') return no(`a slow connection (${s.effectiveType})`);
    if (s.downlink !== undefined && s.downlink > 0 && s.downlink < 5) return no(`a slow connection (${s.downlink} Mbit/s)`);
  }
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
