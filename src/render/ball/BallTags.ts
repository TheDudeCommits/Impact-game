import * as THREE from 'three';
import {FIGHTERS} from '../../config';
import {BALL_TEAM_COLOURS, type BallSeat} from '../../game/ball/model';

/** Six seats a match; the atlas has a row for each, ROW pixels tall and WIDTH wide. */
const ROWS = 6, ROW = 64, WIDTH = 512;
/** How tall a tag stands on screen (a share of the frame's height), and how far over a fighter's feet it hangs (m). */
const TALL = .03, OVER = 2.35;
const PREMULTIPLIED = {transparent: true, depthWrite: false, forceSinglePass: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor} as const;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
export const tagName = (seat: BallSeat) => (seat.bot || seat.name === 'Fighter' ? FIGHTERS[seat.fighter]?.name ?? seat.name : seat.name).toUpperCase();

/**
 * Name tags over every fighter of a ball match (who is who, and on which side, at a glance):
 * each a slanted ink slip with the name in white over a bar in the side's colour - your own fainter and smaller, since
 * you know where you are. Drawn into one canvas atlas when the seats change, and shown as one instanced draw of quads
 * that keep the same size on screen at any distance; in the world, so a split screen's each half has its own. Nothing
 * is allocated in a frame.
 */
export class BallTags {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private readonly canvas: HTMLCanvasElement | null;
  private readonly texture: THREE.Texture;
  private readonly pos: THREE.InstancedBufferAttribute;
  private readonly row: THREE.InstancedBufferAttribute;
  /** What the atlas was drawn for: whose it is, and each seat's id, side, name, fighter and whether a bot plays it. */
  private self = '';
  private readonly drawn: string[] = [];
  private readonly widths = new Float32Array(ROWS);

  constructor() {
    this.canvas = typeof document === 'object' ? document.createElement('canvas') : null;
    if (this.canvas) { this.canvas.width = WIDTH; this.canvas.height = ROW * ROWS; }
    this.texture = this.canvas ? new THREE.CanvasTexture(this.canvas) : new THREE.Texture();
    this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.generateMipmaps = false; this.texture.minFilter = THREE.LinearFilter;
    const quad = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index; geometry.setAttribute('position', quad.getAttribute('position'));
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(ROWS * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.row = new THREE.InstancedBufferAttribute(new Float32Array(ROWS * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aPos', this.pos); geometry.setAttribute('aRow', this.row); geometry.instanceCount = 0;
    quad.dispose();
    const material = new THREE.ShaderMaterial({
      name: 'Ball name tags', ...PREMULTIPLIED, toneMapped: false,
      uniforms: {uAtlas: {value: this.texture}, uTall: {value: TALL}, uAspect: {value: WIDTH / ROW}},
      vertexShader: `attribute vec4 aPos;attribute vec4 aRow;uniform float uTall,uAspect;varying vec2 vUv;varying float vAlpha;
        void main(){
          vec4 mv=viewMatrix*vec4(aPos.xyz,1.);
          // The same height on screen at any distance: sized by the depth (a share of the frame at a 50 degree lens).
          float h=uTall*aRow.z*(-mv.z)*.9326;
          mv.xy+=vec2(position.x*aRow.y*uAspect,position.y+.5)*h;
          vUv=vec2((position.x*aRow.y+.5*aRow.y)+(1.-aRow.y)*.5,(aRow.x+position.y+.5)/${ROWS}.);
          vAlpha=aPos.w;
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: `uniform sampler2D uAtlas;varying vec2 vUv;varying float vAlpha;
        void main(){vec4 t=texture2D(uAtlas,vUv);gl_FragColor=vec4(t.rgb*t.a,t.a)*vAlpha;}`,
    });
    this.mesh = new THREE.Mesh(geometry, material); this.mesh.name = 'Ball name tags'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 12;
  }

  /** Every frame: a tag over each seat's body (`at` gives where it is drawn, or null to leave it out). */
  update(seats: readonly BallSeat[], selfId: string, at: (id: string, out: THREE.Vector3) => THREE.Vector3 | null, show: boolean) {
    if (!show || !seats.length) { this.mesh.geometry.instanceCount = 0; this.mesh.visible = false; return; }
    this.draw(seats, selfId);
    const pos = this.pos.array as Float32Array, row = this.row.array as Float32Array;
    let n = 0;
    for (let i = 0; i < seats.length && i < ROWS; i++) {
      const seat = seats[i], p = at(seat.id, this.spot);
      if (!p) continue;
      const self = seat.id === selfId, k = n * 4;
      pos[k] = p.x; pos[k + 1] = p.y + OVER; pos[k + 2] = p.z; pos[k + 3] = self ? .55 : 1;
      row[k] = ROWS - 1 - i; row[k + 1] = this.widths[i]; row[k + 2] = self ? .8 : 1; row[k + 3] = 0;
      n++;
    }
    this.mesh.geometry.instanceCount = n; this.mesh.visible = n > 0;
    this.pos.clearUpdateRanges(); this.pos.addUpdateRange(0, n * 4); this.pos.needsUpdate = true;
    this.row.clearUpdateRanges(); this.row.addUpdateRange(0, n * 4); this.row.needsUpdate = true;
  }
  private readonly spot = new THREE.Vector3();

  /** The atlas, drawn again only when a seat's name, side or fighter (or which is yours) changes. */
  private draw(seats: readonly BallSeat[], selfId: string) {
    if (!this.changed(seats, selfId)) return;
    const g = this.canvas?.getContext('2d');
    if (!g) { this.widths.fill(.5); return; }
    g.clearRect(0, 0, WIDTH, ROW * ROWS);
    for (let i = 0; i < seats.length && i < ROWS; i++) {
      const seat = seats[i], y = i * ROW, text = tagName(seat), colour = hex(BALL_TEAM_COLOURS[seat.team]);
      g.font = `italic 800 ${ROW * .52}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
      const w = Math.min(WIDTH - 8, g.measureText(text).width + ROW * .9), x = (WIDTH - w) / 2, slant = ROW * .22;
      // An ink slip, slanted, with a bar in the side's colour under the name.
      g.beginPath(); g.moveTo(x + slant, y + 6); g.lineTo(x + w, y + 6); g.lineTo(x + w - slant, y + ROW - 6); g.lineTo(x, y + ROW - 6); g.closePath();
      g.fillStyle = 'rgba(11,12,14,.86)'; g.fill();
      g.fillStyle = colour; g.fillRect(x + slant * .4, y + ROW - 15, w - slant * .8, 7);
      g.lineWidth = 3; g.strokeStyle = colour; g.stroke();
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, WIDTH / 2, y + ROW * .45);
      this.widths[i] = (w + 4) / WIDTH;
    }
    this.texture.needsUpdate = true;
  }

  /** Compared field by field, so a frame builds no string to ask. */
  private changed(seats: readonly BallSeat[], selfId: string) {
    const d = this.drawn, n = Math.min(ROWS, seats.length);
    let same = selfId === this.self && d.length === n * 5;
    for (let i = 0; same && i < n; i++) { const s = seats[i], k = i * 5; same = d[k] === s.id && d[k + 1] === s.team && d[k + 2] === s.name && d[k + 3] === s.fighter && d[k + 4] === (s.bot ? '1' : '0'); }
    if (same) return false;
    this.self = selfId; d.length = 0;
    for (let i = 0; i < n; i++) { const s = seats[i]; d.push(s.id, s.team, s.name, s.fighter, s.bot ? '1' : '0'); }
    return true;
  }

  dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.texture.dispose(); }
}
