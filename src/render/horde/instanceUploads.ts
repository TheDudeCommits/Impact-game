import type { BufferAttribute } from 'three';

const ranges = new WeakMap<BufferAttribute, { start: number; count: number }>();

/** Send only the occupied prefix of a pooled instance buffer. Three clears
 * update ranges after uploading; reuse the range object instead of creating
 * garbage for every attribute of every crowd kind on every rendered frame. */
export function uploadInstances(attribute: BufferAttribute, instances: number) {
  if (instances <= 0) return;
  let range = ranges.get(attribute);
  if (!range) { range = { start: 0, count: 0 }; ranges.set(attribute, range); }
  range.count = Math.min(instances, attribute.count) * attribute.itemSize;
  attribute.clearUpdateRanges();
  attribute.updateRanges.push(range);
  attribute.needsUpdate = true;
}
