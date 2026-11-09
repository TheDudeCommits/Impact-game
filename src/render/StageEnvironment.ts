import {RiftWarWorld} from './moba/RiftWarWorld';
import {BallArena} from './ball/BallArena';
import {ballArenaFor} from './ball/arenaChoice';
import {BloodCitadel} from './objectives/BloodCitadel';
import {HiddenAshVillage} from './objectives/HiddenAshVillage';
import {coverStage,installCameraCutaway} from './CameraCutaway';
import {ArenaEnvironment} from './ArenaEnvironment';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { STAGES, type StageId } from '../game/stages';
import { stageColliders } from '../game/environmentLayout';
import { previewStage } from './look/preview';
import { hiddenByLook, lookStageMaterial } from './look/stageMaterials';
import { placeCaster, showPlaceCasters } from './look/placeShadows';
import { MERGED_PLACES, mergeStaticMeshes } from './stages/mergeStatic';
import { isRiftStage } from '../game/riftLayouts';
import { RiftStage } from './rift/RiftStage';
import { dressStage, type StageDressing } from './stages/dressing';
import { dressGround } from './ground';
import { passWhileHidden } from './hiddenMatrices'; import { ownStageModel } from '../originals/ownModels';

interface Loaded { root: THREE.Group; occluders: THREE.Object3D[]; rift?: RiftStage; objective?: HiddenAshVillage | BloodCitadel | RiftWarWorld | BallArena; harbour?: ArenaEnvironment; dressing?: StageDressing }

/** Draws whichever themed stage the server has put the match in.
 *
 *  The harbour is still assembled by ArenaEnvironment from its own parts, but
 *  this owns it like any other stage since round 4 (STAGES): loaded only when
 *  a match is fought there (a private room's choice, or the stand-in for a
 *  stage that will not load) and let go when it is not shown. It used to be
 *  loaded under every battle royale and kept for the session - 23 MB and
 *  about 250 MB of GPU memory behind every other stage. It owns nothing
 *  authoritative: the play bounds and collision live on the server, and the
 *  camera walls here are built from the same numbers so the two agree.
 */
export class StageEnvironment {
  /** Meshes the chase camera must not see through. */
  public occluders: THREE.Object3D[] = [];
  public current: StageId | null = null;
  private readonly loader = new GLTFLoader();
  private readonly loaded = new Map<StageId, Loaded>();
  private readonly pending = new Map<StageId, Promise<Loaded>>();
  private disposed = false;

  constructor(private readonly scene: THREE.Scene) {}

  /** Fetch and prepare a stage without showing it. */
  preload(stage: StageId): Promise<void> {
    return this.fetch(stage).then(() => undefined);
  }

  /** compileAsync gathers lights synchronously, including only visible
   * stages. A preloaded village is hidden, so otherwise its two street lights
   * create a different shader variant when the first combat frame draws.
   * Restore visibility before yielding: background warm-up never shows a
   * different stage or changes the current stage's ownership/resources. */
  withStageLighting<T>(stage: StageId, compile: () => T): T {
    if (!this.loaded.has(stage)) return compile();
    const previous = [...this.loaded.values()].map(entry => [entry.root, entry.root.visible] as const);
    for (const [id, entry] of this.loaded) entry.root.visible = id === stage;
    try { return compile(); }
    finally { for (const [root, visible] of previous) root.visible = visible; }
  }

  /** Show a stage, loading it first if necessary. Resolves once it is visible. */
  async show(requested: StageId): Promise<void> {
    const stage = previewStage(requested);
    // A ball stage dressed as another arena than the match's is built again.
    if (stage === 'ball-pitch' || stage === 'ball-court') {
      const kept = this.loaded.get(stage);
      if (kept && (kept.objective as BallArena | undefined)?.arena !== ballArenaFor(stage)) this.release(stage, kept);
    }
    if (this.current === stage) return;
    const model = STAGES[stage].model;
    void model; // (a stage with no model is built in code, or stands on a plain floor: build)
    const entry = await this.fetch(stage);
    if (this.disposed) return;
    this.hideAll();
    entry.root.visible = true;
    // A rift stage is whole again every time the run comes to it.
    entry.rift?.restore();
    this.current = stage;
    this.occluders = entry.occluders;
    showPlaceCasters(entry.root);
    // Round 4 (STAGES): only the arena on screen is kept. It used to keep the
    // last one too, for a mode switch to reuse - which held a whole stage's
    // textures (the harbour's were 250 MB) through every match after it.
    this.loaded.delete(stage);this.loaded.set(stage,entry);
    for(const [id,other] of [...this.loaded])if(id!==stage)this.release(id,other);
  }

  /** Let every stage go (the lobby draws none). */
  releaseAll() {
    showPlaceCasters(null);
    for (const [id, entry] of [...this.loaded]) this.release(id, entry);
    this.current = null; this.occluders = [];
  }

  private hideAll() {
    for (const entry of this.loaded.values()) entry.root.visible = false;
  }

  private fetch(stage: StageId): Promise<Loaded> {
    const existing = this.loaded.get(stage);
    if (existing) return Promise.resolve(existing);
    let promise = this.pending.get(stage);
    if (!promise) {
      promise = this.build(stage).then(entry => {
        this.pending.delete(stage);
        if (this.disposed) { this.release(stage, entry); throw new Error('StageEnvironment disposed'); }
        // A stage waits hidden (preloaded, or put away by a dome) with the camera's occluders in it, hidden and never
        // drawn, and their world matrices come from the frame's matrix pass: the scene, which leaves hidden things
        // alone, keeps walking a stage (hiddenMatrices.ts).
        passWhileHidden(entry.root);
        // The camera cutaway on every material of the place that lacks it - the dressing's, the ground's - now, before the
        // room's compile: FollowCamera gives it to them (coverStage) when the stage arrives, the fight's first frame, and
        // each one given it there linked a program of its own in that frame (the tournament's wear decals: launch day 15).
        coverStage([entry.root]);
        this.loaded.set(stage, entry);
        return entry;
      }).catch(error=>{this.pending.delete(stage);throw error;});
      this.pending.set(stage, promise);
    }
    return promise;
  }

  /** A stage's root once it is loaded, shown or not (main.ts hands it to GameRenderer.warmDraw behind the loading screen). */
  root(stage: StageId): THREE.Object3D | undefined { return this.loaded.get(previewStage(stage))?.root; }

  /** The rift stage on screen, if one is: its fires, its smashed props. */
  get rift(): RiftStage | undefined { return this.current ? this.loaded.get(this.current)?.rift : undefined; }
  update(time: number) { this.rift?.update(time); if(this.current){const entry=this.loaded.get(this.current);entry?.objective?.update(time);entry?.harbour?.update(time);entry?.dressing?.update(time);} }

  private async build(stage: StageId): Promise<Loaded> {
    const definition = STAGES[stage];
    if (stage === 'harbor') {
      // Assembled from its kit by ArenaEnvironment, which adds its own root.
      const harbour = new ArenaEnvironment(this.scene);
      harbour.root.visible = false; passWhileHidden(harbour.root);// (in the scene from here, through its load)
      try { await harbour.load(); } catch (error) { harbour.dispose(); throw error; }
      return { root: harbour.root, occluders: harbour.occluders, harbour };
    }
    // The ball modes' arenas (render/ball/BallArena.ts): built in code, nothing to download.
    if(stage==='ball-pitch'||stage==='ball-court'){const arena=new BallArena(stage,ballArenaFor(stage));arena.root.visible=false;await arena.load();this.scene.add(arena.root);return {root:arena.root,occluders:arena.occluders,objective:arena};}
    if(stage==='rift-war'){const war=new RiftWarWorld();war.root.visible=false;try{await war.load();}catch(error){war.dispose();throw error;}this.scene.add(war.root);return {root:war.root,occluders:war.occluders,objective:war};}
    if(stage==='hidden-ash'||stage==='blood-citadel'){const village=stage==='hidden-ash'?new HiddenAshVillage():new BloodCitadel();village.root.visible=false;await village.load();this.scene.add(village.root);return {root:village.root,occluders:village.occluders,objective:village};}
    if (isRiftStage(stage)) {
      // Built in code: nothing to download.
      const rift = new RiftStage(stage);
      const root = new THREE.Group();
      root.name = `Stage:${stage}`; root.visible = false;
      root.add(rift.root);
      this.scene.add(root);
      return { root, occluders: rift.occluders, rift };
    }
    // A stage whose model is not in this checkout (some are held back from the public repository: README.md) is fought on
    // a plain arena floor of its size instead.
    let plain = false;
    const gltf: GLTF = await (ownStageModel(stage) ?? (definition.model ? this.loader.loadAsync(definition.model) : Promise.reject(new Error('no model in this checkout')))).catch((error: unknown) => {
      console.warn(`Stage ${stage}: its model is unavailable; a plain floor stands in`, error);
      plain = true;
      return { scene: plainFloor(definition.halfX, definition.halfZ) } as unknown as GLTF;
    });
    const root = new THREE.Group();
    root.name = `Stage:${stage}`;
    root.visible = false;
    root.add(gltf.scene);
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      // Stage geometry is a backdrop: it takes the fighters' shadows but never
      // casts into the sun map, which is spent on the box around the action -
      // save the few large pieces near the fight a place names (stream C,
      // look/placeShadows.ts), shown with the stage.
      object.castShadow = false;
      object.receiveShadow = true;
      // Every material is brought into the stage's look first - unlit source
      // materials made lit, painted skies kept unlit and out of the fog - and
      // the camera cutaway goes on whatever material comes out.
      const looked = (Array.isArray(object.material) ? object.material : [object.material])
        .map(material => lookStageMaterial(material, stage, object.name, { doubleSided: definition.doubleSided }));
      object.material = Array.isArray(object.material) ? looked : looked[0];
      for (const material of looked) {
        if (material.userData.lookBackdrop) object.receiveShadow = false;
        if (hiddenByLook(stage, material.name)) object.visible = false;
        if (placeCaster(stage, material.name)) object.userData.placeCaster = true;
        installCameraCutaway(material);
      }
    });
    // Invisible camera walls on the play bounds and boxes on every landmark
    // inside them, from `stageColliders`: the very list the server's Rapier
    // world is built from, so what stops the camera is exactly what stops
    // the body. Raycasting the stage itself would mean testing ninety
    // thousand triangles every frame.
    //
    // The walls sit on the play bound, not a metre outside it. The Proving
    // Hall's own walls sit at the bound, so a slab a metre further out let
    // the chase camera get inside the geometry - which an awakened fighter's
    // pull-back does every time they fight near a wall, and the frame becomes
    // a blurred texture. The landmarks used to be guessed here from mesh
    // bounding boxes instead, which boxed the camera off props the fighters
    // walked straight through, and missed the ones they could not.
    const occluders: THREE.Object3D[] = [];
    const wall = new THREE.MeshBasicMaterial({ visible: false });
    const { walls, landmarks } = stageColliders(stage);
    for (const c of walls) {
      // A metre-thick slab whose centre sits a tenth of a metre outside the
      // bound, which is where the collider's inner face is.
      const alongZ = c.halfZ > c.halfX;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 1 : c.halfX * 2, 14, alongZ ? c.halfZ * 2 : 1), wall);
      mesh.position.set(alongZ ? Math.sign(c.x) * (Math.abs(c.x) - c.halfX + .1) : 0, 7,
        alongZ ? 0 : Math.sign(c.z) * (Math.abs(c.z) - c.halfZ + .1));
      mesh.visible = false;
      root.add(mesh);
      occluders.push(mesh);
    }
    for (const c of landmarks) {
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(c.halfX * 2, c.halfY * 2, c.halfZ * 2), wall);
      proxy.position.set(c.x, c.y, c.z);
      proxy.visible = false;
      proxy.name = 'stage-landmark-occluder';
      root.add(proxy);
      occluders.push(proxy);
    }
    // Round 4b (MAPS): the battle royale's places dressed round their sourced
    // landmark (src/render/stages): sky, ground, set dressing, life. What of it
    // blocks a fighter is in STAGE_LANDMARKS already, boxed above.
    const dressing = plain ? undefined : await dressStage(stage, root, gltf.scene).catch((error: unknown) => { console.warn(`Stage ${stage}: its dressing failed`, error); return undefined; });
    if (!plain) await dressGround(stage, root, gltf.scene); // The ground under the fighters: grass, water, loose ground (src/render/ground).
    // The speed pass: a place built of many small pieces over a few materials, drawn in a handful of draws.
    if (MERGED_PLACES.has(stage)) mergeStaticMeshes(gltf.scene);
    this.scene.add(root);
    return { root, occluders, dressing };
  }

  private release(stage: StageId, entry: Loaded) {
    this.scene.remove(entry.root);
    if (entry.harbour) { entry.harbour.dispose(); this.loaded.delete(stage); if (this.current === stage) { this.current = null; this.occluders = []; } return; }
    entry.objective?.dispose();
    entry.dressing?.dispose();
    if (entry.rift) { entry.rift.dispose(); this.loaded.delete(stage); if (this.current === stage) { this.current = null; this.occluders = []; } return; }
    entry.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if(object instanceof THREE.InstancedMesh)object.dispose();
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
        material.dispose();
      }
    });
    this.loaded.delete(stage);
    if (this.current === stage) { this.current = null; this.occluders = []; }
  }

  dispose() {
    this.disposed = true;
    for (const [stage, entry] of [...this.loaded]) this.release(stage, entry);
    this.pending.clear();
  }
}

/** A plain arena floor, `halfX` by `halfZ` metres each way from the centre, with a wider ground round it and a ring at its
 *  edge: what a stage with no model is fought on. */
export function plainFloor(halfX: number, halfZ: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'plain-floor';
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(halfX * 8, halfZ * 8), new THREE.MeshStandardMaterial({ color: 0x8c8478, roughness: .95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.02; ground.name = 'plain-ground';
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(halfX * 2, halfZ * 2), new THREE.MeshStandardMaterial({ color: 0xb9ad98, roughness: .85 }));
  floor.rotation.x = -Math.PI / 2; floor.name = 'plain-arena';
  const edge = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 96), new THREE.MeshBasicMaterial({ color: 0x3a332c, side: THREE.DoubleSide }));
  edge.rotation.x = -Math.PI / 2; edge.position.y = .01; edge.scale.set(Math.min(halfX, halfZ), Math.min(halfX, halfZ), 1); edge.name = 'plain-edge';
  group.add(ground, floor, edge);
  return group;
}
