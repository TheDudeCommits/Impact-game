// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/**
 * MIT License — VFX Armory cinematic pack (samurai port).
 *
 * The source repo's effects read nested settings blocks
 * (`settings.fire.volume.thickness`); the Armory's settings blocks are flat so
 * every number is one editor slider. Flat keys spell the nested path with
 * underscores (`fire_volume_thickness`), and `nest()` rebuilds the nested shape
 * into one reusable object, in place, every frame — no allocation after the
 * first call, and a slider dragged mid-cast lands on the next frame.
 *
 * `prefix` strips a leading segment: nest(cfg, out, 'fire') turns
 * `fire_volume_thickness` into `out.volume.thickness`.
 */
export function nest(flat, out, prefix = '') {
  const head = prefix ? `${prefix}_` : '';
  for (const key in flat) {
    if (head && !key.startsWith(head)) continue;
    const parts = key.slice(head.length).split('_');
    let node = out;
    for (let i = 0; i < parts.length - 1; i++) {
      node = node[parts[i]] ??= {};
    }
    node[parts[parts.length - 1]] = flat[key];
  }
  return out;
}
