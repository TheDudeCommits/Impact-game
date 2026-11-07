import * as THREE from 'three';

type G = CanvasRenderingContext2D;

/** The Dust Sea's compass rose (four long points and four short round a ring), centred on (cx, cy), `r` its long points'
 *  reach. No lettering. */
export function compassRose(g: G, cx: number, cy: number, r: number, colour: string, ring = true) {
  g.fillStyle = colour; g.strokeStyle = colour;
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2, long = k % 2 === 0 ? r : r * .57, side = .22;
    g.beginPath(); g.moveTo(cx + Math.sin(a) * long, cy - Math.cos(a) * long);
    g.lineTo(cx + Math.sin(a + side) * r * .24, cy - Math.cos(a + side) * r * .24); g.lineTo(cx, cy);
    g.lineTo(cx + Math.sin(a - side) * r * .24, cy - Math.cos(a - side) * r * .24); g.closePath(); g.fill();
  }
  if (ring) { g.lineWidth = Math.max(2, r * .07); g.beginPath(); g.arc(cx, cy, r * .44, 0, Math.PI * 2); g.stroke(); }
}

function texture(canvas: HTMLCanvasElement) {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  return map;
}

/** One flag of the Dust Sea's, 256 x 160: the compass rose in navy on white, a navy hem along its foot. */
export function dustSeaFlag() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 160;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, 256, 160);
  compassRose(g, 128, 74, 56, '#1e3a6e');
  g.fillStyle = '#1e3a6e'; g.fillRect(0, 140, 256, 12);
  return texture(canvas);
}
