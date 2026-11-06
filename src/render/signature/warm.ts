import * as THREE from 'three';
import { energyOrbMaterial, energyHaloMaterial, energyImpactMaterial, pressureWaveMaterial, groundDustMaterial } from '../vfx/EnergyOrbMaterial';
import { taimatsuMaterial, fireTongueMaterial } from '../vfx/TaimatsuMaterial';
import { windBladeMaterial } from '../vfx/WindBlade';

/** Links the programs behind the signature material factories at load.
 *
 *  CombatEffects builds its orbs, fists and blades of wind when a move is cast,
 *  so each program used to link on the first cast of the match - the frame
 *  the player pressed for. One speck of each variant is drawn once during the
 *  loading frames and hidden: the tinted orb clone (whose colour literals are
 *  replaced, which makes it a program of its own), the instanced flavours of
 *  the dust and the flame tongues, and the rest. Programs are shared by
 *  source and defines, so every later material of the same kind reuses them. */
export function signatureWarmup(scene: THREE.Scene) {
  const group = new THREE.Group(); group.name = 'signature-warmup';
  const speck = new THREE.SphereGeometry(.002, 4, 3), materials: THREE.Material[] = [];
  const add = (material: THREE.Material, instanced = false, colored = false) => {
    materials.push(material);
    const mesh = instanced ? new THREE.InstancedMesh(speck, material, 1) : new THREE.Mesh(speck, material);
    if (colored) (mesh as THREE.InstancedMesh).setColorAt(0, new THREE.Color(1, 1, 1));
    mesh.frustumCulled = false; mesh.onAfterRender = () => { mesh.visible = false; };
    group.add(mesh);
  };
  add(energyOrbMaterial());
  const tinted = energyOrbMaterial(); tinted.fragmentShader = tinted.fragmentShader.replace('vec3(.012,.25,1.0)', 'uTint*1.5').replace('vec3(.05,.2,.7)', 'uTint*.7'); add(tinted);
  add(energyHaloMaterial()); add(energyImpactMaterial()); add(pressureWaveMaterial()); add(groundDustMaterial(), true);
  add(taimatsuMaterial()); add(fireTongueMaterial(), true, true); add(windBladeMaterial());
  // Out of every shot: under the arena floor, where the specks cannot be seen
  // in the one frame they are drawn.
  group.position.set(0, -50, 0);
  scene.add(group);
  return { group, dispose() { group.removeFromParent(); speck.dispose(); for (const m of materials) m.dispose(); for (const c of group.children) (c as THREE.InstancedMesh).dispose?.(); } };
}
