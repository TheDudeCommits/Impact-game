/** The Hidden Ash's mark, the game's own: a diamond frame round a mountain's peak, an ember over it and the ash line
 *  under it, drawn in one ink on a 2D canvas, centred on (cx, cy), `r` px from the centre to the frame's corners. */
export function ashMark(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, ink: string) {
  const k = r / 70;
  g.save();
  g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 11 * k; g.lineCap = 'round'; g.lineJoin = 'round';
  // The frame: a diamond, its corners on the axes.
  g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); g.stroke();
  // The peak: an open chevron.
  g.lineWidth = 13 * k;
  g.beginPath(); g.moveTo(cx - 34 * k, cy + 16 * k); g.lineTo(cx, cy - 22 * k); g.lineTo(cx + 34 * k, cy + 16 * k); g.stroke();
  // The ash line under it, and the ember over its tip.
  g.beginPath(); g.moveTo(cx - 20 * k, cy + 34 * k); g.lineTo(cx + 20 * k, cy + 34 * k); g.stroke();
  g.beginPath(); g.arc(cx, cy - 42 * k, 7 * k, 0, Math.PI * 2); g.fill();
  g.restore();
}
