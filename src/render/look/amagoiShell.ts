import type { MeshToonMaterial } from 'three';
import { addShaderPatch, replaceOnce } from './shaderPatch';

/** Amagoi's thin lower cloak folds can cross the expanded back-face hull during
 * the heavy follow-through. Move this body's ink along the view ray so its
 * projected silhouette stays fixed while the folded cloth wins the depth test. */
export function preserveAmagoiCloakSurface(material: MeshToonMaterial, fighter: string, mesh: string): void {
  if (fighter !== 'amagoi' || mesh !== 'body_amagoi') return;
  // A separate shader key keeps this literal out of other fighters' programs.
  addShaderPatch(material, 'amagoi-cloak-shell-clearance-v2', shader => {
    shader.vertexShader = replaceOnce(shader.vertexShader,
      'gl_Position = projectionMatrix * mvPosition;',
      'float amagoiInkDepth = max(-mvPosition.z, 0.05);\n\t\tmvPosition.xyz *= (amagoiInkDepth + 0.2050) / amagoiInkDepth;\n\t\tgl_Position = projectionMatrix * mvPosition;',
      'Amagoi cloak shell clearance');
  });
}
