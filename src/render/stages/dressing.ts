import * as THREE from 'three';
import type { StageId } from '../../game/stages';
import { StageKit } from './StageKit';
import { StageAmbient } from './ambient';
import { PaintedSky, type PaintedSkyOptions } from './PaintedSky';
import { stageSky } from '../../originals/stages'; import { applyOriginalDressers } from '../../originals/placeDressers';

export interface StageDressing {
  update(time: number): void;
  dispose(): void;
}

export interface DressContext {
  stage: StageId;
  /** The stage's root: everything added here is shown, hidden and released with it. */
  root: THREE.Group;
  /** The stage's own sourced model, as loaded (its meshes already in the look). */
  model: THREE.Object3D;
  kit: StageKit;
  ambient: StageAmbient;
  sky(options?: PaintedSkyOptions & { url?: string }): Promise<PaintedSky>;
  /** A texture, colour or data, with the repeat and the colour space it is used with. */
  texture(url: string, o?: { repeat?: number | [number, number]; srgb?: boolean; anisotropy?: number }): Promise<THREE.Texture>;
}

type Dresser = (context: DressContext) => Promise<void>;

/** Every place's dresser is its own code under src/originals/places (applyOriginalDressers). */
const DRESSERS: Partial<Record<StageId, () => Promise<Dresser>>> = {};
applyOriginalDressers(DRESSERS);

export function isDressed(stage: StageId) { return stage in DRESSERS; }

/** Dress a stage that has a dressing; undefined for one that has none, or
 *  where there is no page to draw on (the collision tests load stages in Node).
 *  A dressing that fails leaves the bare stage, never a broken match. */
export async function dressStage(stage: StageId, root: THREE.Group, model: THREE.Object3D): Promise<StageDressing | undefined> {
  const load = DRESSERS[stage];
  if (!load || typeof document === 'undefined') return undefined;
  const kit = new StageKit(root, stage);
  const ambient = new StageAmbient(stage);
  const loader = new THREE.TextureLoader();
  const context: DressContext = {
    stage, root, model, kit, ambient,
    async sky(options = {}) {
      const sky = await PaintedSky.load(stageSky(stage, options.url), options);
      root.add(sky.mesh);
      ambient.onUpdate(time => sky.update(time));
      return sky;
    },
    async texture(url, o = {}) {
      const texture = await loader.loadAsync(url);
      if (o.repeat !== undefined) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        const [x, y] = typeof o.repeat === 'number' ? [o.repeat, o.repeat] : o.repeat;
        texture.repeat.set(x, y);
      }
      if (o.srgb !== false) texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = o.anisotropy ?? 8;
      return texture;
    },
  };
  try {
    const dress = await load();
    await dress(context);
    ambient.finish();
    root.add(ambient.root);
    root.updateMatrixWorld(true);
    return {
      update: time => ambient.update(time),
      dispose: () => { ambient.dispose(); kit.dispose(); },
    };
  } catch (error) {
    console.warn(`Stage dressing failed: ${stage}`, error);
    ambient.dispose(); kit.dispose();
    return undefined;
  }
}
