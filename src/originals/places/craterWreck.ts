import * as THREE from 'three';
import { STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from '../../render/stages/dressing';
import { seeded } from '../../render/stages/ambient';
import { addMesh, nearMaterial } from '../../render/stages/near';
import { ashMark } from './mark';

export function charredPosts(c: DressContext) {
  const rng = seeded(1789);
  const parts: THREE.BufferGeometry[] = [];
  for (const p of (STAGE_PROPS['starfall-crater'] ?? []).filter(p => p.draw === 'posts')) {
    const n = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      // A squared post, 2-3 m, snapped: its top cut on a slant and a splinter left standing.
      const len = 2 + rng() * 1.1, w = .2 + rng() * .08, lean = .05 + rng() * .3, yaw = rng() * Math.PI * 2;
      const post = new THREE.BoxGeometry(w, len, w, 1, 4, 1).translate(0, len / 2, 0);
      const pos = post.getAttribute('position') as THREE.BufferAttribute;
      const cut = (rng() - .5) * .5;
      for (let k = 0; k < pos.count; k++) if (pos.getY(k) > len - 1e-3) pos.setY(k, len + cut * Math.sign(pos.getX(k)));
      const splinter = new THREE.ConeGeometry(w * .3, .5 + rng() * .4, 4).translate(w * .2, len + .25, 0);
      const ox = (i - (n - 1) / 2) * .32, oz = (rng() - .5) * .3;
      for (const g of [post, splinter]) {
        g.rotateZ(lean).rotateY(yaw).translate(p.x + ox, -.25, p.z + oz);
        g.computeVertexNormals();
        parts.push(g.index ? g.toNonIndexed() : g);
      }
    }
  }
  if (!parts.length) return;
  const position: number[] = [], normal: number[] = [];
  for (const g of parts) {
    const pa = g.getAttribute('position'), na = g.getAttribute('normal');
    for (let k = 0; k < pa.count; k++) { position.push(pa.getX(k), pa.getY(k), pa.getZ(k)); normal.push(na.getX(k), na.getY(k), na.getZ(k)); }
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  addMesh(c, merged, nearMaterial(c, 'Near charred posts', { color: 0x3a2a20, roughness: .95 }), 'near charred posts', { shadow: true });
}

/** Ashwood's banner, left standing in the Crater: a torn, dusty cloth with the village's mark in dark red. */
export function ashBanner() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 384;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#b4a68a'; g.fillRect(0, 0, 256, 384);
  g.fillStyle = '#4a4440'; g.fillRect(0, 0, 256, 34); g.fillRect(0, 350, 256, 34);
  // The village's mark (mark.ts).
  ashMark(g, 128, 196, 66, '#8e2620');
  // Soot up from its foot.
  const soot = g.createLinearGradient(0, 384, 0, 200);
  soot.addColorStop(0, 'rgba(40,32,28,.55)'); soot.addColorStop(1, 'rgba(40,32,28,0)');
  g.fillStyle = soot; g.fillRect(0, 200, 256, 184);
  // Torn: bites out of its lower edge and a rent.
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(i * 40, 384); g.lineTo(i * 40 + 18, 330 - (i % 3) * 18); g.lineTo(i * 40 + 34, 384); g.fill(); }
  g.beginPath(); g.moveTo(196, 110); g.lineTo(214, 214); g.lineTo(200, 216); g.closePath(); g.fill();
  g.globalCompositeOperation = 'source-over';
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}
