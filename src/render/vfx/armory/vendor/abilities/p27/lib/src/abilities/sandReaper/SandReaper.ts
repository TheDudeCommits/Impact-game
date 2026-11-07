// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3 } from 'three';
import type { Ability, AbilityCastContext } from '../Ability';
import { SAND_CAST, SAND_REAPER_DEFAULTS, validatedSandConfig, type SandReaperConfig } from './SandReaperConfig';
import { createSandFragmentGeometry, createSandReaperGeometry } from './SandReaperGeometry';
import { SandReaperEffect, type SandResources } from './SandReaperEffect';

export function sandReaperTarget(ctx: AbilityCastContext): Vector3 | null {
  if (![ctx.origin.x, ctx.origin.y, ctx.origin.z].every(Number.isFinite)) return null;
  const source = ctx.groundTarget ?? ctx.targetPoint, target = new Vector3();
  if (source && [source.x, source.y, source.z].every(Number.isFinite)) target.copy(source);
  else {
    const dir = ctx.direction; if (![dir.x, dir.y, dir.z].every(Number.isFinite) || dir.lengthSq() < 1e-8 || !Number.isFinite(dir.length())) return null;
    target.copy(ctx.origin).addScaledVector(dir.clone().normalize(), SAND_CAST.range);
  }
  // Center of a physical blade above its selected water contact; safe snapshot, never mutate targeting vectors.
  target.y = Math.max(2.5, target.y);
  const delta = target.clone().sub(ctx.origin), distance = delta.length();
  if (!Number.isFinite(distance) || distance < .5) return null;
  if (distance > SAND_CAST.range) target.copy(ctx.origin).addScaledVector(delta.normalize(), SAND_CAST.range);
  return target;
}
export class SandReaper implements Ability {
  readonly id = 'sand-reaper'; readonly name = 'SAND REAPER'; readonly subtitle = 'DUNE CLEAVER';
  readonly element = 'SAND / EARTH / STONE'; readonly color = '#edc78a'; readonly icon = 'sand-reaper'; readonly cooldown = SAND_CAST.cooldown; readonly range = SAND_CAST.range;
  private readonly controls = { ...SAND_REAPER_DEFAULTS };
  private resources: SandResources | undefined;
  private readonly pool: SandReaperEffect[] = [];
  get config(): Readonly<SandReaperConfig> { return this.controls; }
  get activeCount(): number { return this.pool.filter(e => e.active).length; }
  /** Scalar controls are live. Shape edits are explicit and rejected while a visual lease is active. */
  configure(patch: Partial<SandReaperConfig>): void {
    const next = validatedSandConfig(patch, this.controls);
    const shape = ['bladeLength', 'bladeWidth', 'bladeThickness', 'crescentCurvature', 'facetRoughness'] as const;
    const rebuild = shape.some(key => next[key] !== this.controls[key]);
    if (rebuild && this.activeCount) throw new Error('Wait for Sand Reaper effects to finish before rebuilding geometry');
    if (rebuild) this.clearResources();
    Object.assign(this.controls, next);
  }
  cast(ctx: AbilityCastContext): boolean {
    const target = sandReaperTarget(ctx); if (!target || this.activeCount >= SAND_CAST.maximumActive) return false;
    this.resources ??= { blades: [16, 28, 40].map(n => createSandReaperGeometry(this.controls, n)), fragments: [0, 1, 2, 3].map(createSandFragmentGeometry) };
    let effect = this.pool.find(e => !e.active);
    if (!effect) { effect = new SandReaperEffect(ctx, this.resources, this.controls, () => {}); this.pool.push(effect); }
    ctx.player.visual.beginRightHandCast(.85);
    effect.activate(ctx, target); ctx.effectManager.add(effect); return true;
  }
  private clearResources(): void {
    for (const effect of this.pool) effect.destroy(); this.pool.length = 0;
    for (const geometry of [...this.resources?.blades ?? [], ...this.resources?.fragments ?? []]) geometry.dispose(); this.resources = undefined;
  }
  dispose(): void { this.clearResources(); }
}
