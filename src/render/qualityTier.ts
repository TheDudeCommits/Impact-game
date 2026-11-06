import type { Settings } from '../config';
import { phone, tablet } from '../input/device';

export type Quality = Settings['quality'];
const ORDER: readonly Quality[] = ['low', 'medium', 'high'];
export const lowerQuality = (q: Quality): Quality => ORDER[Math.max(0, ORDER.indexOf(q) - 1)];
const lowest = (a: Quality, b?: Quality) => !b || ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b;

export interface TierDevice { phone: boolean; tablet: boolean }
/** The preset a GPU starts on, by its name:
 *   low: software renderers (SwiftShader, llvmpipe), integrated Intel UHD and HD, every phone, and a tablet's weaker
 *     mobile GPU;
 *   medium: Iris Xe and Iris Plus, Intel Arc's integrated graphics, AMD's APUs, older dedicated cards (GTX 10 and
 *     before, NVIDIA's MX, Radeon R and HD), base Apple M1/M2, and a tablet with a strong mobile GPU (an iPad, Adreno 640 and up, Mali-G
 *     71 and up, Samsung's Xclipse);
 *   high: newer Apple M-series and Pro/Max/Ultra, NVIDIA's RTX and GTX 16 and up, AMD's Radeon RX, Intel Arc's cards.
 *  A name it does not know starts on medium (a desktop browser that hides its GPU), low on a tablet. */
export function gpuTier(name: string, device: TierDevice): Quality {
  const gpu = name.replace(/\s+/g, ' ');
  if (/SwiftShader|llvmpipe|softpipe|Software|Basic Render|Microsoft Basic/i.test(gpu)) return 'low';
  if (device.phone) return 'low';
  const mobile = /Adreno|Mali|PowerVR|Xclipse|Apple GPU|Apple A\d|Immortalis|Tegra|Vivante|VideoCore/i.test(gpu);
  if (mobile) {
    // Safari names every Apple GPU 'Apple GPU': an iPad's may be an A-series or an M-series, and a Mac's is M-series
    // (or, on an older Mac, Intel's).
    const strong = /Apple GPU|Apple M\d|Xclipse|Immortalis/i.test(gpu) || +(gpu.match(/Adreno[^\d]*(\d{3})/i)?.[1] ?? 0) >= 640 || /Mali-G(7[1-9]|[6-9]\d\d)/i.test(gpu);
    if (device.tablet) return strong ? 'medium' : 'low';
    // A Mac in Safari cannot be told apart, so it starts where Chrome starts the Macs most players have, a base M1/M2
    // (fanless Airs among them): medium, as for any desktop that hides its GPU. It was high, which put every Air in
    // Safari on High until the watch stepped it down mid-fight; the watch only steps down, so a Pro/Max in Safari now
    // keeps medium unless its player picks High (one tap in Settings, remembered).
    return /Apple GPU/i.test(gpu) ? 'medium' : 'low';
  }
  // Start base M1/M2 conservatively for prolonged crowd battles, including fanless Airs.
  // This saves scenery work before the sustained-load watch acts; it is not a thermal/FPS guarantee.
  if (/Apple M[12]\b(?!\s+(?:Pro|Max|Ultra)\b)/i.test(gpu)) return 'medium';
  if (/Apple M\d/i.test(gpu)) return 'high';
  if (/NVIDIA|GeForce|Quadro|COLOSSUS/i.test(gpu)) {
    if (/\bMX\s?\d/i.test(gpu)) return 'medium';
    if (/RTX|COLOSSUS|GTX 1[6-9]\d\d/i.test(gpu)) return 'high';
    return 'medium';
  }
  if (/Radeon|AMD/i.test(gpu)) return /\bRX\s?\d|Radeon Pro W|Radeon VII/i.test(gpu) && !/Vega \d|Graphics/i.test(gpu) ? 'high' : 'medium';
  if (/Intel/i.test(gpu)) {
    if (/Arc.*A\d{3}/i.test(gpu)) return 'high';
    if (/Iris|Xe\b|Arc/i.test(gpu)) return 'medium';
    return 'low';   // UHD, HD and older integrated graphics
  }
  return device.tablet ? 'low' : 'medium';
}

/** The GPU's name, as the browser gives it ('' where it will not say). */
export function gpuName(gl: WebGLRenderingContext | WebGL2RenderingContext | null | undefined) {
  if (!gl) return '';
  try {
    const info = gl.getExtension('WEBGL_debug_renderer_info') as { UNMASKED_RENDERER_WEBGL: number } | null;
    return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  } catch { return ''; }
}

/** A step down the watch made, remembered per GPU: { gpu, quality }. */
export const STEP_KEY = 'rift-quality-auto';
function remembered(gpu: string): Quality | undefined {
  try { const saved = JSON.parse(localStorage.getItem(STEP_KEY) ?? 'null'); return saved?.gpu === gpu && ORDER.includes(saved.quality) ? saved.quality : undefined; } catch { return undefined; }
}
export function rememberStep(gpu: string, quality: Quality) { try { localStorage.setItem(STEP_KEY, JSON.stringify({ gpu, quality })); } catch { /* this visit only */ } }

let bootGpu = '';
/** This machine's own preset: its GPU's, or lower where a fight here has stepped it down. */
export const machineQuality = (device: TierDevice = { phone: phone(), tablet: tablet() }) => lowest(gpuTier(bootGpu, device), remembered(bootGpu));
/** At boot: the preset for this machine, unless the player has chosen one. Answers whether `settings` changed. */
export function autoQuality(settings: Settings, gpu: string, device: TierDevice = { phone: phone(), tablet: tablet() }): boolean {
  bootGpu = gpu;
  if (settings.qualityChosen) return false;
  const quality = machineQuality(device);
  if (settings.quality === quality) return false;
  settings.quality = quality; return true;
}

/** Sustained low frame rate: a second's average under LOW_SHARE of the rate aimed at (45 of 60) for LOW_SECONDS in a
 *  row, with the resolution governor already at its floor. Then AFTER_STEP_S before another step can be judged. */
export const LOW_SHARE = .75, LOW_SECONDS = 9, AFTER_STEP_S = 12;
export class QualityWatch {
  private seconds = 0;
  private frames = 0;
  private lowFor = 0;
  private wait = 0;
  /** One frame: `dt` its seconds, `watching` whether this frame counts (a fight being drawn, the quality the
   *  machine's own), `atFloor` the governor drawing at its least, `target` the frame rate aimed at. Answers true when
   *  it is time to step down. */
  frame(dt: number, watching: boolean, atFloor: boolean, target: number): boolean {
    if (!watching) { this.seconds = 0; this.frames = 0; this.lowFor = 0; return false; }
    // A frame away a quarter of a second or more is a tab put back or a load, not the fight's rate.
    if (!(dt > 0) || dt >= .25) return false;
    this.seconds += dt; this.frames++;
    if (this.seconds < 1) return false;
    const fps = this.frames / this.seconds;
    this.seconds = 0; this.frames = 0; this.wait = Math.max(0, this.wait - 1);
    this.lowFor = fps < target * LOW_SHARE && atFloor ? this.lowFor + 1 : 0;
    if (this.lowFor < LOW_SECONDS || this.wait > 0) return false;
    this.lowFor = 0; this.wait = AFTER_STEP_S;
    return true;
  }
}

/** The watch's step: one preset down, remembered for this GPU and saved, the menus showing it and the notice saying
 *  it. The caller applies `settings` to the renderer. */
export function stepDown(settings: Settings) {
  settings.quality = lowerQuality(settings.quality);
  rememberStep(bootGpu, settings.quality);
  try { localStorage.setItem('rift-settings', JSON.stringify(settings)); } catch { /* this visit only */ }
  // The menus keep saying AUTO (the player has not chosen a level; the notice names the one picked).
  showQuality(settings.qualityChosen ? settings.quality : 'auto'); qualityToast(settings.quality);
}
/** Every control that shows the quality, set to it (the home's options and the pause menu; AUTO, or a level chosen). */
export function showQuality(quality: Quality | 'auto') {
  if (typeof document !== 'object') return;
  document.querySelectorAll<HTMLSelectElement>('[data-setting="quality"],[data-home-setting="quality"]').forEach(control => { if (!control.matches(':focus')) control.value = quality; });
}
let toastTimer = 0;
/** The small notice: "Graphics set to MEDIUM for smoother play · change it in Options". */
export function qualityToast(quality: Quality) { notice(`Graphics set to <b>${quality.toUpperCase()}</b> for smoother play · change it in Options`); }
/** The same notice when a phone on Balanced steps from sixty to an even thirty (render/framePolicy.ts). */
export function frameRateToast() { notice('Frame rate set to <b>30 FPS</b> for steadier play · POWER USE in Options'); }
function notice(html: string) {
  if (typeof document !== 'object') return;
  let toast = document.querySelector<HTMLElement>('.quality-toast');
  if (!toast) { toast = document.createElement('div'); toast.className = 'quality-toast'; toast.setAttribute('role', 'status'); document.body.append(toast); }
  toast.innerHTML = html;
  requestAnimationFrame(() => toast!.classList.add('in'));
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast!.classList.remove('in'), 5200);
}
