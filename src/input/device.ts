/**
 * What kind of device this is, for the touch controls (input/touch.ts) and the phone tier (render/qualityTier.ts):
 * the screen's own pointer, and whether it is a phone or a tablet. iPadOS asks for desktop pages as a Mac with a touch
 * screen; Android tablets say Android without "Mobile". Every read is guarded: tests and old browsers have no
 * matchMedia, navigator or screen.
 */
const media = (query: string) => typeof matchMedia === 'function' && matchMedia(query).matches;
const agent = () => typeof navigator === 'object' ? navigator.userAgent ?? '' : '';
const touchPoints = () => typeof navigator === 'object' ? navigator.maxTouchPoints ?? 0 : 0;
/** The screen's shorter side, CSS pixels (the window's where the screen is not known). */
function shortSide() {
  const s = typeof screen === 'object' ? screen : undefined;
  const side = s && s.width > 0 && s.height > 0 ? Math.min(s.width, s.height) : typeof innerWidth === 'number' ? Math.min(innerWidth, innerHeight) : 0;
  return side;
}

/** iPadOS: a Mac that has a touch screen. */
export const iPadOS = () => /Macintosh/.test(agent()) && touchPoints() > 1;
/** A phone or a tablet: the browser says mobile, or an iPad, or a touch screen with no mouse. */
export function handheld() {
  const nav = (typeof navigator === 'object' ? navigator : {}) as Navigator & { userAgentData?: { mobile?: boolean } };
  return !!nav.userAgentData?.mobile || iPadOS() || /Android|iPhone|iPad|iPod|Mobile/i.test(agent()) || media('(pointer: coarse)') && !media('(any-pointer: fine)');
}
/** A phone: handheld, and the screen's shorter side under 600 CSS pixels (every tablet is wider: an iPad mini is 744). */
export const phone = () => handheld() && shortSide() > 0 && shortSide() < 600;
/** A tablet: handheld and not a phone. */
export const tablet = () => handheld() && !phone();
/** The screen is the pointer: no mouse or trackpad (an iPad with its keyboard's trackpad is not). Starts the game on its
 *  touch controls (Input.mode). */
export const touchFirst = () => touchPoints() > 0 && media('(pointer: coarse)') && !media('(any-pointer: fine)');
