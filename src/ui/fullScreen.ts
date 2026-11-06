/** Full screen where the browser has it. iPhone Safari has no `Element.requestFullscreen` at all (only a video can go
 *  full screen there) and `document.fullscreenEnabled` is undefined: the run's FULL SCREEN switch called it unguarded
 *  and threw a TypeError on every tap. Where it is missing there is no switch to show, and asking never throws. */
type Doc = Pick<Document, 'fullscreenEnabled' | 'documentElement'>;
const here = (): Doc | undefined => typeof document === 'undefined' ? undefined : document;

export function canFullScreen(doc: Doc | undefined = here()): boolean {
  return !!doc?.fullscreenEnabled && typeof doc.documentElement?.requestFullscreen === 'function';
}

/** Into full screen with the browser's own bar hidden, Esc kept for the pause menu (held, it still leaves, as the
 *  browser says). Rejects where it cannot (no API, no user activation), so a caller can wait for the next click. */
export function enterFullScreen(doc: Doc | undefined = here()): Promise<void> {
  if (!doc || !canFullScreen(doc)) return Promise.reject(new Error('full screen is not available here'));
  return doc.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => {
    (navigator as { keyboard?: { lock?: (keys: string[]) => Promise<void> } }).keyboard?.lock?.(['Escape']).catch(() => {});
  });
}
