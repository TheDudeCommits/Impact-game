import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PLACE_CASTERS, placeCaster, setPlaceShadowQuality, showPlaceCasters } from '../src/render/look/placeShadows';

/** A place's own large pieces near the fight cast into the sun's map. */
describe('the places\' own shadows', () => {
  it('name a few sourced pieces per place by material, and nothing else of a place casts', () => {
    expect(placeCaster('starfall-crater', 'Crater_Cover')).toBe(true);
    // The tournament's walls stand 30 m from the ring, outside the sun's box round the fight.
    expect(placeCaster('sunfall-arena', '5_walls_1_0_0')).toBe(false);
    // The stadium wall and the trees would lay the field in shade under the evening sun.
    expect(placeCaster('ash-colosseum', 'Material.036')).toBe(false);
    expect(placeCaster('ash-colosseum', 'Material.073')).toBe(false);
    // Places that ask for none, and a renamed export, cast nothing.
    expect(placeCaster('ashfall-weir', 'Material.002')).toBe(false);
    expect(placeCaster('hollowmere-quarry', 'Material_5')).toBe(false);
    expect(placeCaster('starfall-crater', 'Crater_Cover.renamed')).toBe(false);
    expect(Object.keys(PLACE_CASTERS)).not.toContain('proving-hall');
  });
  it('are named in the stage loader, and dropped on low quality', () => {
    const src = fs.readFileSync('src/render/StageEnvironment.ts', 'utf8');
    expect(src).toContain('placeCaster(stage, material.name)');
    expect(src).toContain('showPlaceCasters(entry.root)');
    const root = new THREE.Group(), piece = new THREE.Mesh(), other = new THREE.Mesh();
    piece.userData.placeCaster = true; root.add(piece, other);
    showPlaceCasters(root);
    expect(piece.castShadow).toBe(true); expect(other.castShadow).toBe(false);
    setPlaceShadowQuality('low');
    expect(piece.castShadow).toBe(false);
    setPlaceShadowQuality('medium');
    expect(piece.castShadow).toBe(true);
    showPlaceCasters(null);
  });
  it('fade every shadow out toward the edge of the sun\'s box instead of cutting it off', () => {
    const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
    const pcf = chunk.slice(chunk.indexOf('#if defined( SHADOWMAP_TYPE_PCF )'));
    expect(pcf.indexOf('lookShadowEdge')).toBeGreaterThan(0);
    expect(pcf.indexOf('lookShadowEdge')).toBeLessThan(pcf.indexOf('return mix( 1.0, shadow, shadowIntensity );'));
  });
});
