// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { envelope, smooth } from "./StormDragonConfig";
export type DragonState =
  | "DORMANT"
  | "EMERGING"
  | "ASCENDING"
  | "CIRCLING"
  | "HOVERING"
  | "CHARGING"
  | "BREATHING"
  | "CATACLYSM"
  | "DISSOLVING";
export const WINGBEATS = [4.7, 5.85, 6.95];
export function dragonState(t: number): DragonState {
  return t < 2.2
    ? "DORMANT"
    : t < 3.4
      ? "EMERGING"
      : t < 4.5
        ? "ASCENDING"
        : t < 5.7
          ? "CIRCLING"
          : t < 7
            ? "HOVERING"
            : t < 8.8
              ? "CHARGING"
              : t < 10.3
                ? "BREATHING"
                : t < 13.5
                  ? "CATACLYSM"
                  : "DISSOLVING";
}
export class StormDragonTimeline {
  age = 0;
  state: DragonState = "DORMANT";
  storm = 0;
  charge = 0;
  breath = 0;
  dragon = 0;
  dissolve = 0;
  surge = 0;
  advance(delta: number): void {
    this.age += Math.max(0, delta);
    const t = this.age;
    this.state = dragonState(t);
    this.storm = envelope(0.5, 3, 14.5, 18, t);
    this.charge = envelope(7, 8.75, 9, 10.3, t);
    this.breath = envelope(8.8, 9, 10, 10.4, t);
    this.dragon = envelope(2.2, 3.7, 15.1, 16, t);
    this.dissolve = smooth(13.5, 15.8, t);
    this.surge = envelope(12.1, 12.65, 13, 13.6, t);
  }
}
