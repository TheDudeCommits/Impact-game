import * as THREE from 'three';

const INK = '#28212b', CLOTH = '#f7f0df';

/** The crack down the banner: a jagged band, wider where it bites, as the rift runs across the Torn Plain. */
const CRACK: readonly [number, number, number][] = [[64, 52, 2], [58, 74, 5], [70, 92, 6], [56, 110, 7], [69, 128, 6], [59, 148, 5], [66, 168, 3], [63, 184, 1]];

export function riftBannerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 256;
  const c = canvas.getContext('2d')!;
  c.fillStyle = CLOTH; c.fillRect(0, 0, 128, 256);
  c.strokeStyle = INK; c.lineWidth = 5; c.strokeRect(7, 9, 114, 236);
  // The sun: a ring and eight rays.
  c.lineWidth = 7; c.beginPath(); c.arc(64, 110, 25, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 5; c.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    c.beginPath(); c.moveTo(64 + Math.cos(a) * 34, 110 + Math.sin(a) * 34); c.lineTo(64 + Math.cos(a) * 44, 110 + Math.sin(a) * 44); c.stroke();
  }
  // The rift through it: cloth-coloured edges first (the disc torn open), then the ink of the crack.
  for (const [colour, extra] of [[CLOTH, 4], [INK, 0]] as const) {
    c.fillStyle = colour; c.beginPath();
    CRACK.forEach(([x, y, w], i) => i ? c.lineTo(x - w - extra, y) : c.moveTo(x - w - extra, y));
    for (let i = CRACK.length - 1; i >= 0; i--) { const [x, y, w] = CRACK[i]; c.lineTo(x + w + extra, y); }
    c.closePath(); c.fill();
  }
  c.fillStyle = INK; c.beginPath(); c.moveTo(40, 214); c.lineTo(64, 200); c.lineTo(88, 214); c.lineTo(88, 220); c.lineTo(64, 206); c.lineTo(40, 220); c.closePath(); c.fill();
  for (let i = 0; i < 12; i++) { c.globalAlpha = .12; c.fillRect(10 + (i * 47) % 108, 0, 1, 256); }
  c.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
