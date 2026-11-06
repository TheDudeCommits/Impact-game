import { AREA_DEFAULTS } from '../engine/sim/areaMoves';

export type AimSource = 'pad' | 'keyboard' | 'touch';
export interface AimPoint { x: number; z: number }
/** What the page draws while a player aims. */
export interface AreaAimView {
  active: boolean;
  source?: AimSource;
  /** The circle's centre (world metres, on the floor). */
  x: number; z: number;
  /** The caster, as last followed. */
  fromX: number; fromZ: number;
  /** The move's reach and its circle (m). */
  range: number; radius: number;
  /** A release now would cast: the slot is ready and the fighter is free to throw it. */
  valid: boolean;
}

/** A view's forward and right on the floor, the input's convention (Input.command: moveX = sin(yaw)·forward − cos(yaw)·right). */
const forwardOf = (yaw: number) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
const rightOf = (yaw: number) => ({ x: -Math.cos(yaw), z: Math.sin(yaw) });

export class AreaAim {
  readonly view: AreaAimView = { active: false, x: 0, z: 0, fromX: 0, fromZ: 0, range: AREA_DEFAULTS.range, radius: AREA_DEFAULTS.radius, valid: false };
  /** Not placed yet: the next follow() puts it on the target or ahead. */
  private placed = false;
  /** A touch aim: where it sits as a share of the range from the caster, in the view's frame, kept as the caster moves. */
  private share?: { right: number; forward: number };

  get active() { return this.view.active; }

  begin(source: AimSource) {
    this.view.active = true; this.view.source = source; this.placed = false; this.share = undefined;
  }
  cancel() { this.view.active = false; this.view.source = undefined; this.placed = false; this.share = undefined; }
  /** Ends the aim: the point to cast at, or undefined if it was not valid (the press is dropped, as a press on cooldown). */
  release(): AimPoint | undefined {
    if (!this.view.active) return undefined;
    const point = this.placed && this.view.valid ? { x: this.view.x, z: this.view.z } : undefined;
    this.cancel();
    return point;
  }

  /** Every frame while it is up: the caster's place, the view's yaw, the locked target's place if any, the move's range
   *  and radius, and whether a cast would be accepted. The first call places the reticle - on the target when it is in
   *  range, else AREA_DEFAULTS.aim metres ahead - and every call keeps it within range of the caster. */
  follow(caster: AimPoint, viewYaw: number, target: AimPoint | undefined, range: number, radius: number, valid: boolean) {
    const v = this.view;
    v.fromX = caster.x; v.fromZ = caster.z; v.range = range; v.radius = radius; v.valid = valid;
    if (!v.active) return;
    if (!this.placed) {
      this.placed = true;
      if (target && Math.hypot(target.x - caster.x, target.z - caster.z) <= range) { v.x = target.x; v.z = target.z; }
      else { const f = forwardOf(viewYaw), d = Math.min(AREA_DEFAULTS.aim, range); v.x = caster.x + f.x * d; v.z = caster.z + f.z * d; }
    }
    if (this.share) {
      const f = forwardOf(viewYaw), r = rightOf(viewYaw);
      v.x = caster.x + (f.x * this.share.forward + r.x * this.share.right) * range;
      v.z = caster.z + (f.z * this.share.forward + r.z * this.share.right) * range;
    }
    this.clamp();
  }

  /** Moves the reticle by `right` and `forward` metres in the view's frame (a stick, a mouse). */
  nudge(right: number, forward: number, viewYaw: number) {
    if (!this.view.active || !this.placed || !Number.isFinite(right) || !Number.isFinite(forward)) return;
    const f = forwardOf(viewYaw), r = rightOf(viewYaw);
    this.view.x += f.x * forward + r.x * right; this.view.z += f.z * forward + r.z * right;
    this.share = undefined;
    this.clamp();
  }

  /** Places the reticle from the caster as a share of the range (-1..1 each way) in the view's frame: a touch drag. */
  place(right: number, forward: number) {
    if (!this.view.active || !Number.isFinite(right) || !Number.isFinite(forward)) return;
    const length = Math.hypot(right, forward), k = length > 1 ? 1 / length : 1;
    this.share = { right: right * k, forward: forward * k };
    this.placed = true;
  }

  private clamp() {
    const v = this.view, dx = v.x - v.fromX, dz = v.z - v.fromZ, d = Math.hypot(dx, dz);
    if (d > v.range && d > 0) { v.x = v.fromX + dx / d * v.range; v.z = v.fromZ + dz / d * v.range; }
  }
}
