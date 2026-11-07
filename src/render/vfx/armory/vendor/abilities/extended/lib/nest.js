// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * nest.js — a live, nested *view* over a flat settings block.
 *
 * The achrefelouafi source repos keep nested groups inside an ability block
 * (`settings.drone.hit.impulse`). The armory's editor only binds flat keys, so
 * the ported blocks in `config/abilities/extd_*.js` flatten every group with an
 * underscore (`hit_impulse`). Ported code keeps reading `c.hit.impulse`: this
 * module builds, once per block, an object of getters/setters that forwards
 * every read and write to the flat block, so a slider dragged in the editor is
 * seen by the ability on the very next frame.
 *
 * Part of the extended pack (ports of achrefelouafi/LinearAbiltyCastingExtendedThreeJS
 * and achrefelouafi/HandCastAbilityThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi).
 */

const views = new WeakMap();

/**
 * @param {object} flat the live settings block (e.g. `settings.extd_drone`)
 * @returns {object} the nested view; same object every call for the same block
 */
export function nest(flat) {
  if (!flat) return flat;
  let view = views.get(flat);
  if (!view) {
    view = build(flat, '');
    views.set(flat, view);
  }
  return view;
}

function build(flat, prefix) {
  const view = {};
  const groups = new Set();
  for (const key of Object.keys(flat)) {
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    const cut = rest.indexOf('_');
    if (cut < 0) {
      Object.defineProperty(view, rest, {
        enumerable: true,
        get: () => flat[key],
        set: (value) => {
          flat[key] = value;
        }
      });
    } else {
      groups.add(rest.slice(0, cut));
    }
  }
  for (const group of groups) {
    if (group in view) continue;
    Object.defineProperty(view, group, { enumerable: true, value: build(flat, `${prefix}${group}_`) });
  }
  return view;
}
