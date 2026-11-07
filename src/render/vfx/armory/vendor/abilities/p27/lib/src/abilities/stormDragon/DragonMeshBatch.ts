// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, Mesh, Material } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
/** Merge static siblings by material, preserving joint groups and attachments. Originals remain owned until disposal. */
export function batchAnatomy(root: Group): void {
  for (const o of [...root.children]) if (o instanceof Group) batchAnatomy(o);
  const groups = new Map<Material, Mesh[]>();
  for (const o of root.children)
    if (
      o instanceof Mesh &&
      !("isInstancedMesh" in o) &&
      !Array.isArray(o.material)
    ) {
      const list = groups.get(o.material) ?? [];
      list.push(o);
      groups.set(o.material, list);
    }
  for (const [material, list] of groups) {
    if (list.length < 2) continue;
    const transformed = list.map((m) => {
      m.updateMatrix();
      return m.geometry.clone().applyMatrix4(m.matrix);
    });
    const geometry = mergeGeometries(transformed);
    for (const g of transformed) g.dispose();
    if (!geometry) continue;
    for (const m of list) {
      root.remove(m);
      m.geometry.dispose();
    }
    root.add(new Mesh(geometry, material));
  }
}
