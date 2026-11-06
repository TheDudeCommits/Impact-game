import * as THREE from 'three';


/** Children walked whether they are shown or not (`passWhileHidden`). */
const always = new WeakSet<THREE.Object3D>();

/** three's `Object3D.updateMatrixWorld` (r186), with the one difference above. Kept word for word otherwise, so a node
 *  that asks is passed exactly as three passes it (tests/hiddenMatrices.test.ts holds the two against each other). */
function passShown(this: THREE.Object3D, force?: boolean) {
  if (this.matrixAutoUpdate) this.updateMatrix();
  if (this.matrixWorldNeedsUpdate || force) {
    if (this.matrixWorldAutoUpdate === true) {
      if (this.parent === null) this.matrixWorld.copy(this.matrix);
      else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    }
    this.matrixWorldNeedsUpdate = false;
    force = true;
  }
  const children = this.children;
  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i];
    if (child.visible === false && !always.has(child)) { child.matrixWorldNeedsUpdate = true; continue; }
    child.updateMatrixWorld(force);
  }
}

/** From now on `parent`'s matrix pass leaves its hidden children (and all under them) alone; see the rule above. Only
 *  for a node three passes with its plain `Object3D` pass (a scene, a group): a skinned mesh or a camera has work of
 *  its own in there, which this would drop. Returns `parent`. */
export function skipHiddenChildren<T extends THREE.Object3D>(parent: T): T {
  if (parent.updateMatrixWorld === passShown) return parent;
  if (parent.updateMatrixWorld !== THREE.Object3D.prototype.updateMatrixWorld) throw new Error(`hiddenMatrices: '${parent.name || parent.type}' has a matrix pass of its own`);
  parent.updateMatrixWorld = passShown;
  return parent;
}

/** `object` is walked by a skipping parent whether it is shown or not: something reads its world matrices while it is
 *  hidden (a fighter's joints; a stage's occluders). */
export function passWhileHidden<T extends THREE.Object3D>(object: T): T { always.add(object); return object; }

/** Whether `parent` skips its hidden children (tests, the perf tools). */
export function skipsHiddenChildren(parent: THREE.Object3D) { return parent.updateMatrixWorld === passShown; }
