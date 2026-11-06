/** Restarts a one-shot CSS animation class - a hit on a plate, a meter filling, an entrance, a KO line - without a
 *  synchronous layout.
 *
 *  The way it was done everywhere: take the class off, read `offsetWidth` so the browser sees it gone, put it back. The
 *  read made the browser style *and lay out* the whole page there and then, in the middle of the frame's DOM writes,
 *  once per pulse; in a royale every blow pulsed a plate or two. Here a class that is not on is simply put on (the
 *  animation starts); one that is still on is taken off at once, and put back once the frame's work is over (a
 *  microtask: after the requestAnimationFrame callback, before the frame is drawn), after a single style pass for all of
 *  them - a `getComputedStyle` read, which styles but does not lay out, and which the frame was about to do anyway. The
 *  animation restarts on the same frame as before. */
const queued: { el: Element; name: string }[] = [];
let due = false;
export function pulseClass(el: Element, name: string): void {
  if (queued.some(q => q.el === el && q.name === name)) return;
  if (!el.classList.contains(name)) { el.classList.add(name); return; }
  el.classList.remove(name); queued.push({ el, name });
  if (!due) { due = true; queueMicrotask(flush); }
}
function flush() {
  due = false;
  const batch = queued.splice(0);
  if (typeof getComputedStyle === 'function') for (const { el } of batch) void getComputedStyle(el).animationName;
  for (const { el, name } of batch) el.classList.add(name);
}
