import { handheld } from '../input/device';
import { canFullScreen, enterFullScreen } from './fullScreen';

/**
 * A phone or a tablet in a fight (the phone pass, November 2026):
 *
 *  - Android: the GO that starts a fight (the mode sheet's, a tap: the user gesture full screen needs) takes the page full
 *    screen - the browser's bars gone, the arena the whole screen - and locks it on its side, as the fight asks (the
 *    touch controls pause a match held upright). An iPhone has no full screen for a page; there the manifest's landscape
 *    and the turn-your-phone card do. A player who turned FULL SCREEN off (the run's switch, SurvivalHud) is left as is,
 *    and leaving full screen (the system's back) unlocks it.
 *  - The screen stays on while a fight is on (the Screen Wake Lock), and may sleep again on the pause menu, the home or a
 *    tab put away; the browser lets the lock go with a hidden tab, and it is asked for again on return.
 *  - iOS: the game's sound is media (navigator.audioSession 'playback'), so the ring/silent switch no longer mutes the
 *    fight's sound while its music, an <audio> element, played on.
 */
const FULLSCREEN_KEY = 'rift-fullscreen';
const fullScreenWanted = () => { try { return localStorage.getItem(FULLSCREEN_KEY) !== 'off'; } catch { return true; } };
const android = () => typeof navigator === 'object' && /Android/i.test(navigator.userAgent ?? '');

type Sentinel = { released?: boolean; release(): Promise<void>; addEventListener?(type: 'release', listener: () => void): void };
type WakeLockApi = { request(type: 'screen'): Promise<Sentinel> };

export class PhoneShell {
  private wanted = false;
  private lock?: Sentinel;
  private asking = false;
  constructor(private readonly small = handheld()) {
    if (!small || typeof document !== 'object') return;
    // The GO press, before the sheet's own handler: full screen and landscape on Android.
    document.addEventListener('click', event => {
      const go = (event.target as Element | null)?.closest?.('[data-ms-go]');
      if (go && !(go as HTMLButtonElement).disabled) this.landscape();
    }, true);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.sync(); });
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) try { session.type = 'playback'; } catch { /* the browser's own */ }
  }

  /** Full screen, then the landscape lock (Chrome locks the orientation only in full screen). */
  landscape() {
    if (!android() || !canFullScreen() || document.fullscreenElement || !fullScreenWanted()) return;
    void enterFullScreen().then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape')).catch(() => {});
  }

  /** Every frame: whether a fight is on and in view (not the pause menu, not the home). Cheap when nothing changes. */
  fighting(on: boolean) {
    if (!this.small || on === this.wanted) return;
    this.wanted = on;
    this.sync();
  }

  private sync() {
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    if (!api) return;
    if (!this.wanted) { const lock = this.lock; this.lock = undefined; void lock?.release().catch(() => {}); return; }
    if (this.asking || (this.lock && !this.lock.released) || document.hidden) return;
    this.asking = true;
    api.request('screen').then(lock => {
      this.asking = false;
      if (!this.wanted) { void lock.release().catch(() => {}); return; }
      this.lock = lock;
      lock.addEventListener?.('release', () => { if (this.lock === lock) this.lock = undefined; });
    }, () => { this.asking = false; });
  }
}
