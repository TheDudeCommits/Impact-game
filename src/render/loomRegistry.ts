/** Round 3d, STANDS: how high a spirit looming over its awakened user reaches,
 *  by the user's fighter id, for the lock-on camera to size its rig by (the
 *  one hook FollowCamera takes: the spirit is part of the awakened silhouette,
 *  as a worn Guardian is, but it is its own body in the scene rather than a
 *  child of the fighter's). Written by SwordStandEffects every frame the spirit
 *  is drawn; metres over the user's root, 0 while none looms. A module of its
 *  own so the camera does not import the effects. */
const tops = new Map<string, number>();

export function setLoomTop(id: string, top: number) { if (top > 0) tops.set(id, top); else tops.delete(id); }
/** How high over `id`'s root the spirit looming over them reaches (0: none). */
export function loomTop(id: string) { return tops.get(id) ?? 0; }
export function clearLoomTops() { tops.clear(); }
