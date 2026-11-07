// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { Camera, Scene, Vector3 } from 'three';
import type { Player } from '../player/Player';
import type { EffectManager } from '../effects/EffectManager';
import type { GraphicsSettings } from '../quality/GraphicsSettings';
import type { TargetingSystem } from '../targeting/TargetingSystem';
import type { WaterInteractionManager } from '../world/water/WaterInteractionManager';

export interface AbilityCastContext {
  readonly player: Player;
  readonly scene: Scene;
  readonly camera: Camera;
  /** Snapshot vectors owned by this cast; safe for a long-lived effect to retain. */
  readonly origin: Vector3;
  readonly direction: Vector3;
  readonly playerForward: Vector3;
  readonly cameraForward: Vector3;
  readonly targetPoint: Vector3;
  readonly groundTarget: Vector3 | null;
  readonly targeting: TargetingSystem;
  readonly effectManager: EffectManager;
  readonly quality: GraphicsSettings;
  readonly time: number;
  readonly water?:WaterInteractionManager;
  /** Optional decoupled, bounded camera response supplied by the game. */
  readonly cameraFeedback?: (strength: number, duration: number) => void;
  /** Optional short-lived upward framing request; camera input and targeting stay live. */
  readonly skyFraming?: (angle: number, duration: number) => void;
}
export interface Ability {
  readonly id: string;
  readonly name: string;
  readonly subtitle?: string;
  readonly element: string;
  readonly color: string;
  readonly icon?: string;
  readonly cooldown: number;
  /** Display metadata, using the same configuration as targeting. */
  readonly range?: number;
  readonly tags?: readonly string[];
  select?(): void;
  deselect?(): void;
  /** Return false to reject a cast without starting a cooldown. */
  cast(context: AbilityCastContext): void | boolean;
  update?(deltaTime: number): void;
  dispose?(): void;
}
