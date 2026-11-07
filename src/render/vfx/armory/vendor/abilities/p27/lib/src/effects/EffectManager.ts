// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
/** An effect owns and disposes its resources. Return false when its lifetime ends. */
export interface ManagedEffect {
  readonly particleCount?: number;
  readonly instanceCount?: number;
  update(deltaTime: number, elapsedTime: number): boolean;
  dispose(): void;
}

export class EffectManager {
  private readonly effects: ManagedEffect[] = [];
  get activeCount(): number { return this.effects.length; }
  add(effect: ManagedEffect): void { this.effects.push(effect); }
  update(deltaTime: number, elapsedTime: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      if (!this.effects[i].update(deltaTime, elapsedTime)) {
        this.effects[i].dispose();
        const last = this.effects.pop();
        if (i < this.effects.length && last) this.effects[i] = last;
      }
    }
  }
  get particleCount(): number { let count = 0; for (const effect of this.effects) count += effect.particleCount ?? 0; return count; }
  get instanceCount(): number { let count = 0; for (const effect of this.effects) count += effect.instanceCount ?? 0; return count; }
  dispose(): void { for (const effect of this.effects) effect.dispose(); this.effects.length = 0; }
}
