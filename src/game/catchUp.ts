/** How many whole simulation ticks a real interval is worth.
 *
 *  Input leaves on its own 60 Hz timer rather than on the render loop, and the
 *  local copy of the simulation advances one tick per command sent. A browser
 *  does not queue the timer callbacks it missed - a 200 ms block yields one
 *  callback carrying 200 ms - so without a backlog the local fighter runs a
 *  tick behind for every callback the page was too busy to answer.
 *
 *  The server consumes the same ordered command stream, one tick per command.
 *  Keeping this clock at sixty ticks per second prevents a slow render loop
 *  from starving that stream. Rendering samples between the last two ticks;
 *  it does not control how many movement commands the network receives.
 *
 *  Measured, local ticks run against real 60 Hz ticks over the same wall time:
 *  100% at 60 fps, 83% at 10 fps, and 42% at 5 fps against the old five-tick
 *  cap - and the correction banked on each reconcile went from 0.001 m to
 *  0.271 m, which is one snapshot interval of server travel the client never
 *  ran.
 *
 *  The cap has to tell a slow frame from a stall. A tab that was hidden for a
 *  minute is not owed a minute of replayed input; a page rendering at five
 *  frames a second is owed every tick of it.
 */
export const INPUT_HZ = 60;
/** Past this, the page was not slow, it was away. */
export const STALL_SECONDS = .5;
/** The most ticks one callback may run. Twenty is a third of a second, which
 *  is ten snapshot intervals - far longer than any frame that is still
 *  playable - and costs about 2.4 ms of main thread at twelve actors with the
 *  real stage collision loaded, measured at 0.121 ms a step. */
export const MAX_CATCH_UP = 20;

/** Given the backlog and how long has really passed, how many ticks to run and
 *  what backlog is left. Pure, so the arithmetic can be tested without a
 *  browser - which is the only reason it is not inline in main.ts.
 *
 *  `rate` is simulation time per real second: 1, or slightly less while the
 *  input clock drains the server's queue (inputClock.ts). It is never more -
 *  the clock does not run ahead of real time. Whether the page stalled is a
 *  question about real time, so the ceiling reads `elapsed` undilated. */
export function catchUp(backlog: number, elapsed: number, rate = 1) {
  const tick = 1 / INPUT_HZ;
  const ceiling = (elapsed > STALL_SECONDS ? 1 : MAX_CATCH_UP) * tick;
  let left = Math.min(backlog + elapsed * Math.max(0, Math.min(1, rate)), ceiling);
  let steps = 0;
  while (left >= tick && steps < MAX_CATCH_UP) { left -= tick; steps++; }
  return { steps, backlog: left };
}
