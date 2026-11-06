import * as THREE from 'three';

/** Launch day 10 (13 October 2026, perf4): the first seconds of a royale stalled five to eight times, 67 to 167 ms each, on a
 *  quiet Mac, tagged `gpu-wait` by scripts/night/load_hitches.mjs (a blocking GPU call with no program linked).
 *
 *  What they are: no program was built in them (`renderer.info.programs` did not grow in the first six seconds of a fight; the
 *  load had compiled all 339), but the first draw of each effect's mesh asked three for the program's `getUniforms()`, which
 *  three keeps until a program is first drawn: it reads the linked program's whole interface (`getProgramParameter`,
 *  `getActiveUniform` ...), a synchronous question to the GPU process that is answered after everything already queued for
 *  it, which in a fight's first frames is the buffers and the first draws of the same effect. Fifteen of them in the first
 *  six seconds, 510-534 ms in all, each inside one draw of 30-93 ms (a Ward's Room sphere, an area seal, a pressure shell, a
 *  ground decal: the first draw of an effect's mesh), in three runs on the unminified production bundle.
 *
 *  Asked for every program that exists once the room is compiled - while the loading screen still covers the canvas and the
 *  queue is empty - the same 339 programs cost 85-142 ms in all, and the fight's first six seconds had no such wait and no
 *  draw over 4 ms (three base/touch pairs, load 6-17). Nothing is drawn and nothing about a program changes: three answers
 *  from the same cache at the first draw. A program built later (a body's depth program on its first shadow pass) is asked
 *  at its first draw, as before. */
export interface IntrospectableProgram { getUniforms(): unknown; getAttributes(): unknown }
export interface ProgramSource { info: { programs: readonly IntrospectableProgram[] | null } }

/** Every program `renderer` has linked asked for its uniforms and attributes now. Returns how many were. Never throws: a
 *  program that cannot be asked (a lost context) is asked again at its first draw, as before. */
export function introspectPrograms(renderer: ProgramSource): number {
  let asked = 0;
  for (const program of renderer.info.programs ?? []) {
    try { program.getUniforms(); program.getAttributes(); asked++; }
    catch { /* at its first draw instead */ }
  }
  return asked;
}

/** Launch day 15 (s15perf): the shadow pass's own programs, linked with the room. Three draws every shadow caster with ONE
 *  shared depth material (WebGLShadowMap's, or a clone of it for a material that clips: an alpha test with a map, a
 *  displacement), and that material's program is chosen again only when the object in hand differs from the last in what
 *  three checks (skinned or not, instanced or not, morph targets ...). The key it is chosen under is the whole state of the
 *  object that made it choose: its material's side (flipped for the shadow), whether it has a map, its uv channels. Which
 *  object that is depends on the order the pass meets them in, so a depth program nobody had made could be asked for at any
 *  moment of a fight: when a fighter walks out of the sun's box and the next skinned body after an unskinned prop is a
 *  double-sided one with a map, or an instanced shard is the first instanced caster (late_sweep.mjs: 16 Duels and 3 royales
 *  of the launch day 15 sweep, each a body's or an Armory shard's depth program, 2.5 s to 40 s after FIGHT, at load 30-50).
 *  No compile makes them (a compile builds each material's own program) and a warm draw makes only the ones its own order
 *  asks for.
 *  So every caster under `root` is compiled here as the shadow pass would draw it alone: `keeper` (a MeshDepthMaterial that
 *  is not the shadow map's, kept alive so its programs stay linked) is given what WebGLShadowMap.getDepthMaterial gives its
 *  own (side, map, alpha map and test, clipping, displacement), and three's compile links the program under the same key the
 *  pass will ask for: the program cache is shared by key, so the pass's first draw finds it made. A caster with its own
 *  depth material (customDepthMaterial) has that one given the same and compiled. Lit as the pass is (the scene's visible
 *  lights) and with no scene (the pass draws with an empty one: no fog), under the render target bound by the caller (the
 *  pass draws into the shadow map, so linear colour and no tone mapping are in the key). Casters alike in everything the key
 *  reads are compiled once. Returns how many were compiled. */
const SHADOW_SIDE: Record<THREE.Side, THREE.Side> = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };
type Shadowed = THREE.Material & { map?: THREE.Texture | null; alphaMap?: THREE.Texture | null; displacementMap?: THREE.Texture | null; displacementScale?: number; displacementBias?: number; wireframe?: boolean };
export function compileShadowPrograms(renderer: THREE.WebGLRenderer, root: THREE.Object3D, scene: THREE.Object3D, camera: THREE.Camera, keeper: THREE.MeshDepthMaterial): number {
  if (!renderer.shadowMap.enabled) return 0;
  const vsm = renderer.shadowMap.type === THREE.VSMShadowMap, seen = new Set<string>();
  const channel = (t?: THREE.Texture | null) => t ? t.channel : -1;
  let compiled = 0;
  const casters = {
    traverse(visit: (object: THREE.Object3D) => void) {
      root.traverse(object => {
        const o = object as THREE.Mesh & { isSkinnedMesh?: boolean; isInstancedMesh?: boolean; isLine?: boolean; isPoints?: boolean; isBatchedMesh?: boolean; morphTexture?: unknown; instanceColor?: unknown; customDepthMaterial?: THREE.Material };
        if (!(o.isMesh || o.isLine || o.isPoints) || !o.castShadow || !o.material) return;
        const g = o.geometry, a = g?.attributes ?? {}, morph = g?.morphAttributes ?? {}, morphs = (morph.position ?? morph.normal ?? morph.color)?.length ?? 0;
        const shape = [o.isSkinnedMesh, o.isInstancedMesh && [!!o.instanceColor, !!o.morphTexture], o.isBatchedMesh, o.isPoints, o.isLine, morphs, !!morph.normal, !!morph.color, !!a.position, !!a.normal, !!a.uv, !!a.uv1, !!a.uv2, !!a.uv3].join();
        const own = o.material;
        for (const m of (Array.isArray(own) ? own : [own]) as Shadowed[]) {
          if (!m) continue;
          const depth = (o.customDepthMaterial ?? keeper) as Shadowed;
          const side = m.shadowSide ?? (vsm ? m.side : SHADOW_SIDE[m.side]), clips = renderer.localClippingEnabled && m.clipShadows && (m.clippingPlanes?.length ?? 0) > 0;
          const key = [depth === keeper ? '' : depth.uuid, shape, side, channel(m.map), channel(m.alphaMap), m.alphaTest > 0, m.alphaToCoverage, !!m.displacementMap && m.displacementScale !== 0 && channel(m.displacementMap), clips && [m.clippingPlanes!.length, m.clipIntersection]].join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          Object.assign(depth, { side, alphaMap: m.alphaMap ?? null, alphaTest: m.alphaToCoverage ? .5 : m.alphaTest, map: m.map ?? null, clipShadows: m.clipShadows, clippingPlanes: m.clippingPlanes, clipIntersection: m.clipIntersection,
            displacementMap: m.displacementMap ?? null, displacementScale: m.displacementScale ?? 1, displacementBias: m.displacementBias ?? 0, wireframe: !!m.wireframe });
          o.material = depth; compiled++;
          try { visit(o); } finally { o.material = own; }
        }
      });
    },
    traverseVisible() { /* the lights are the target's */ },
  };
  // Not a Scene, so three's getProgram draws with its empty one, as the shadow pass does; the lights are the scene's.
  const lights = { traverseVisible: (visit: (object: THREE.Object3D) => void) => scene.traverseVisible(visit) };
  renderer.compile(casters as unknown as THREE.Object3D, camera, lights as unknown as THREE.Scene);
  return compiled;
}
