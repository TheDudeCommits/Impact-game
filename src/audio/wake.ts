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
  // A finger's press lets sound start only as it lifts (the browsers' user activation: pointerup and touchend for a
  // touch, never its pointerdown), so a phone's first tap woke nothing without these.
  addEventListener('pointerup', wake, true); addEventListener('touchend', wake, true);
}
/** The press that lets a page start its sound (the HTML standard's activation-triggering events): a mouse's pointerdown,
 *  a finger's or a pen's pointerup, touchend, a key. Listen with `onActivation`; a touch's pointerdown is passed over. */
export function onActivation(handler: () => void): void {
  if (typeof addEventListener !== 'function') return;
  const pointer = (event: PointerEvent) => { if ((event.type === 'pointerdown') === (event.pointerType === 'mouse')) handler(); };
  addEventListener('pointerdown', pointer, true); addEventListener('pointerup', pointer, true);
  addEventListener('touchend', handler, true); addEventListener('keydown', handler, true);
}
