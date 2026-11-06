import * as THREE from 'three';

/** Read a joint in an ancestor's coordinates without updating every sibling
 * bone and mesh. Root-motion correction needs only this short parent chain;
 * the renderer evaluates the complete hierarchy once when it draws it. */
export function jointInAncestor(joint: THREE.Object3D, ancestor: THREE.Object3D, out: THREE.Vector3) {
  out.set(0, 0, 0);
  let node: THREE.Object3D | null = joint;
  while (node && node !== ancestor) {
    if (node.matrixAutoUpdate) node.updateMatrix();
    out.applyMatrix4(node.matrix);
    node = node.parent;
  }
  return out;
}

/** Invisible enemies retain their scene membership and queryable joints, but
 * do not walk their entire skeleton again during scene rendering. Explicit
 * getWorldPosition/updateWorldMatrix queries still work normally. */
export class CrowdGroup extends THREE.Group {
  override updateMatrixWorld(force?: boolean) {
    if (!this.visible) return;
    super.updateMatrixWorld(force);
  }
}

/** Full-rate poses in view. Hidden poses are refreshed four times a second,
 * and immediately on an action change or camera re-entry. No gameplay clock,
 * collision, hit timing or visible animation is throttled. */
export class HiddenPoseClock {
  private pending = 0;
  private key = '';
  step(dt: number, visible: boolean, key: string): number | undefined {
    this.pending += dt;
    if (!visible && key === this.key && this.pending < .25) return undefined;
    const elapsed = this.pending;
    this.pending = 0;
    this.key = key;
    return elapsed;
  }
}
