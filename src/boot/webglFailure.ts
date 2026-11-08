/** The page's 3D canvas could not be made (the stability pass, 2 November 2026: 59 "Error creating WebGL context" on the
 *  live log). main.ts made its GameRenderer at the top of the module with nothing round it: three threw, the module
 *  stopped there, and the page stayed on index.html's pulsing mark for ever, with no word of what was wrong.
 *
 *  Now the renderer is asked for twice: as ever, then gently (no high-performance GPU asked for: a laptop's switch to its
 *  discrete GPU, or a driver the browser blocklists for it, can refuse the first and allow the second). If both fail, the
 *  page says so in the game's own ink and paper - what is wrong, how to fix it, a RETRY - and the failure is reported at
 *  once, first visit or not (errorReports.ts holds a report until the fan notice has been seen; this page never shows it). */

import { TITLE } from '../originals/brand';

/** Thrown after the message is up, to stop main.ts: already reported (errorReports.ts lets it pass). */
export class GraphicsUnavailable extends Error {
  readonly reported = true;
  constructor(readonly failure: unknown) { super('the 3D graphics context could not be created'); this.name = 'GraphicsUnavailable'; }
}

/** What a failed try leaves in `parent`: the canvas three appended before it threw, if it got that far. */
const clean = (parent: ParentNode) => { for (const canvas of parent.querySelectorAll('canvas')) canvas.remove(); };

/** `make(false)`, else `make(true)`; if both throw, the message up, `report` told, and GraphicsUnavailable thrown. */
export function makeRenderer<T>(make: (gentle: boolean) => T, parent: HTMLElement, report: (error: unknown, first: unknown) => void, show: (parent: HTMLElement) => unknown = showGraphicsFailure): T {
  let first: unknown;
  try { return make(false); } catch (error) { first = error; clean(parent); }
  try { return make(true); } catch (error) {
    clean(parent);
    try { report(error, first); } catch { /* the message matters more */ }
    show(parent);
    throw new GraphicsUnavailable(error);
  }
}

/** The words of the message: the browser's own way to hardware acceleration where it is known. */
export function fixesFor(agent: string): string[] {
  const chromium = /\b(Chrome|CriOS|Edg|OPR)\//.test(agent) && !/iPhone|iPad|iPod/.test(agent);
  const firefox = /\bFirefox\//.test(agent);
  const apple = /iPhone|iPad|iPod/.test(agent) || /Macintosh/.test(agent) && /Version\/[\d.]+ Safari\//.test(agent);
  return [
    chromium ? 'Turn on hardware acceleration: Settings → System → “Use graphics acceleration when available”, then restart the browser.'
      : firefox ? 'Turn on hardware acceleration: Settings → General → Performance, then restart the browser.'
      : apple ? 'Close other apps and tabs, then try again: the system may have taken the graphics memory.'
      : 'Turn on hardware acceleration in your browser’s settings, then restart the browser.',
    'Update your browser (and on a computer, your graphics drivers).',
    'Try another browser: Chrome, Edge, Firefox or Safari.',
  ];
}

/** The message, in place of the boot mark (index.html's `#app:empty`, which stops pulsing once #app holds anything). */
export function showGraphicsFailure(parent: HTMLElement, agent = typeof navigator === 'object' ? navigator.userAgent : '') {
  const box = document.createElement('section');
  box.className = 'graphics-failure'; box.setAttribute('role', 'alert');
  box.innerHTML = `<style>
.graphics-failure{position:fixed;inset:0;display:grid;place-items:center;background:#fff;color:#111;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));overflow:auto;font:500 16px/1.45 Barlow,'Helvetica Neue',Arial,sans-serif;z-index:10}
.graphics-failure>div{max-width:520px;width:100%;border:3px solid #111;box-shadow:6px 6px 0 #cc202b;padding:22px 24px 20px;background:#fff}
.graphics-failure img{width:44px;height:44px;display:block;margin-bottom:6px}
.graphics-failure h1{margin:0 0 4px;font:italic 900 clamp(22px,4vw,30px)/1.05 Impact,'Arial Narrow',sans-serif;letter-spacing:.01em;text-transform:uppercase}
.graphics-failure p{margin:6px 0}
.graphics-failure ol{margin:10px 0 16px;padding-left:22px}
.graphics-failure li{margin:4px 0}
.graphics-failure button{font:italic 900 18px/1 Impact,'Arial Narrow',sans-serif;letter-spacing:.04em;background:#cc202b;color:#fff;border:3px solid #111;padding:10px 26px;cursor:pointer;box-shadow:3px 3px 0 #111}
.graphics-failure button:focus-visible{outline:3px solid #111;outline-offset:3px}
</style><div><img src="favicon.svg" alt=""><h1>3D graphics couldn’t start</h1>
<p>${TITLE} draws its fights with WebGL, and this browser didn’t give the game a 3D graphics context.</p>
<p><b>To fix it:</b></p><ol></ol><button type="button">RETRY</button></div>`;
  const list = box.querySelector('ol')!;
  for (const fix of fixesFor(agent)) { const item = document.createElement('li'); item.textContent = fix; list.append(item); }
  box.querySelector('button')!.onclick = () => location.reload();
  parent.append(box);
  box.querySelector('button')!.focus();
  return box;
}
