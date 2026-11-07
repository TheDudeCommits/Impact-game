// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
/** Optional bounded reusable storage for future particles/instances; no effects are created here. */
export class ObjectPool<T> {
  private readonly available: T[] = [];
  private readonly leased = new Set<T>();
  constructor(private readonly create: () => T, private readonly reset: (value: T) => void, private readonly destroy: (value: T) => void, private readonly capacity: number) {}
  acquire(): T | null {
    if (this.leased.size >= this.capacity) return null;
    const value = this.available.pop() ?? this.create();
    this.leased.add(value); return value;
  }
  release(value: T): void { if (!this.leased.delete(value)) return; this.reset(value); this.available.push(value); }
  dispose(): void { this.available.forEach(this.destroy); this.leased.forEach(this.destroy); this.available.length = 0; this.leased.clear(); }
}
