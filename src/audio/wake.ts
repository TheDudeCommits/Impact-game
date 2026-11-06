/** A context that is not playing and can be asked to: 'suspended', and iOS Safari's 'interrupted' (a phone call, Siri,
 *  an alarm, the page sent to the background; it plays again only when asked). The checks asked about 'suspended'
 *  alone, and the fight's audio was asked only by the next PLAY, so a fight came back from an interruption silent. */
export const asleep = <T extends Pick<BaseAudioContext, 'state'>>(ctx: T | undefined): ctx is T => !!ctx && ctx.state !== 'running' && ctx.state !== 'closed';

/** Asks `context()` to play again on the next touch, click or key, and when the page is shown again (iOS lets a
 *  context resume after its interruption without a gesture; an older one wants the gesture). */
export function wakeOnReturn(context: () => BaseAudioContext | undefined, live: () => boolean = () => true): void {
  if (typeof addEventListener !== 'function' || typeof document !== 'object') return;
  const wake = () => { const ctx = context(); if (live() && asleep(ctx) && !document.hidden) void (ctx as AudioContext).resume?.().catch(() => {}); };
  addEventListener('pointerdown', wake, true); addEventListener('keydown', wake, true); document.addEventListener('visibilitychange', wake);
}
