import { GAME_URL, inviteFor, inviteNow, inviteWords, type InviteParams } from './invite';

export type Delivered = 'shared' | 'copied' | 'aborted' | 'failed';
type ShareNav = Navigator & { canShare?: (data: ShareData) => boolean };
type Policy = { allowsFeature?: (feature: string) => boolean; features?: () => string[] };

/** The device has a share sheet this page may open (a frame - Player Two's player - may not have been allowed one). */
export function canNativeShare(): boolean {
  if (typeof navigator !== 'object' || typeof navigator.share !== 'function') return false;
  // (Asked only of a browser that knows the feature: one that does not answers false for a share it can open.)
  try { const policy = (document as Document & { featurePolicy?: Policy }).featurePolicy; return policy?.features?.().includes('web-share') ? policy.allowsFeature?.('web-share') ?? true : true; } catch { return true; }
}

/** The old way, for a frame or a browser without the clipboard's permission: a selected text area, copied. */
function copyBySelection(text: string): boolean {
  if (typeof document !== 'object') return false;
  const area = document.createElement('textarea'), focus = document.activeElement as HTMLElement | null;
  area.value = text; area.readOnly = true; area.setAttribute('aria-hidden', 'true');
  area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.append(area); area.select(); area.setSelectionRange(0, text.length);
  let done = false;
  try { done = document.execCommand('copy'); } catch { done = false; }
  area.remove(); focus?.focus?.({ preventScroll: true });
  return done;
}
/** Copies the text: the clipboard's own call first (started at once, inside the press), then the old way. */
export async function copyText(text: string): Promise<boolean> {
  const clip = typeof navigator === 'object' ? navigator.clipboard : undefined;
  if (!clip?.writeText) return copyBySelection(text);
  try { await clip.writeText(text); return true; } catch { return copyBySelection(text); }
}

/** The share sheet with this link (`native`, where there is one), else the link copied (or `copy`, when what is copied must
 *  say more than the link). Call it straight from the press, with the link already made. */
export async function shareOrCopy(data: { title: string; text: string; url: string }, native: boolean, copy = data.url): Promise<Delivered> {
  if (native && canNativeShare()) {
    try { await navigator.share(data); return 'shared'; }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'aborted';
      // Not allowed here after all (a frame's policy): copied instead, which the press may still allow.
    }
  }
  return await copyText(copy) ? 'copied' : 'failed';
}

/** An invite shared or copied from the press: its link at once where it is at hand (outside Player Two always; inside,
 *  once Player Two has answered the prefetch), else after Player Two answers - where Safari may refuse, and the caller
 *  shows the link to copy by hand. A link that carries no room (the public address: social/invite.ts ownInvite) is copied
 *  with the invite's words before it, so the code goes with it. */
export async function shareInvite(p: InviteParams, native: boolean): Promise<{ result: Delivered; url: string }> {
  const words = inviteWords(p), copied = (url: string) => url === GAME_URL ? `${words.text} ${url}` : url, now = inviteNow(p);
  if (now) return { url: now, result: await shareOrCopy({ ...words, url: now }, native, copied(now)) };
  const url = await inviteFor(p);
  return { url, result: await shareOrCopy({ ...words, url }, native, copied(url)) };
}

/** A picture shared with its words and link, where the device's sheet takes files. */
export function canShareFile(file: File): boolean {
  const nav = navigator as ShareNav;
  try { return canNativeShare() && !!nav.canShare?.({ files: [file] }); } catch { return false; }
}
export async function shareFileWith(file: File, data: { title: string; text: string; url: string }): Promise<Delivered> {
  try { await navigator.share({ ...data, files: [file] }); return 'shared'; }
  catch (error) { return error instanceof DOMException && error.name === 'AbortError' ? 'aborted' : 'failed'; }
}
