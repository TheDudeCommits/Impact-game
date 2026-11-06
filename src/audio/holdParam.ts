/** Freezes an AudioParam at its present value from `time` on, so a new ramp starts where the sound is now.
 *  `cancelAndHoldAtTime` is the one call that does this, and Firefox does not have it (no version does): calling it
 *  there throws a TypeError, which in `CombatAudio.stop` skipped the fade and the `source.stop()` too, so a looping
 *  sound (an awakening's aura, a charge) played on for the rest of the match. Without it, cancel what is scheduled and
 *  pin the value the param reads now: the same hold, one render quantum coarser, which a fade of 35 ms cannot hear. */
export function holdAt(param: AudioParam, time: number): void {
  if (typeof (param as Partial<AudioParam>).cancelAndHoldAtTime === 'function') { param.cancelAndHoldAtTime(time); return; }
  const value = param.value; param.cancelScheduledValues(time); param.setValueAtTime(value, time);
}
