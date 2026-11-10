import * as THREE from 'three';
import {FIGHTERS} from '../../config';
import {BALL_TEAM_COLOURS, type BallSeat, type BallTeam} from '../../game/ball/model';

/** Six seats a match; the atlas has a row for each, ROW pixels tall and WIDTH wide. */
const ROWS = 6, ROW = 64, WIDTH = 512;
/** How tall a tag stands on screen (a share of the frame's height), and how far over a fighter's feet it hangs (m). */
const TALL = .03, OVER = 2.35;
const PREMULTIPLIED = {transparent: true, depthWrite: false, forceSinglePass: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor} as const;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
export const tagName = (seat: BallSeat) => (seat.bot || seat.name === 'Fighter' ? FIGHTERS[seat.fighter]?.name ?? seat.name : seat.name).toUpperCase();

/** Speech bubbles: how many at once, how long each is up and its fades (ms). */
export const SPEECH = {most: 2, ms: 2500, fadeIn: 140, fadeOut: 220} as const;
/** A bubble's cell in its atlas (px), its type, and how it is laid: a full cell stands `tall` of the frame's height (its
 *  words 24 px at 1080p; a short screen's are drawn larger, as on one `floor` px tall at the least: 13 px on a phone on
 *  its side, where the HUD's own small words are 11), over the speaker's name tag, never past `edge` of the frame's
 *  sides, nor into its foot `foot` (the seat's strip: the stance badge and the BOOST and SUPER bars) or its top `top`
 *  (the score bug and its line, ui/hud/ballHud.css's top stack) - nor, while a banner is up, into the banner's place
 *  under them (`banner`) across the middle `band` of the frame's width. A phone on its side (`short`: under 520 px)
 *  has its own (the stack's phone numbers). */
const CELL = {w: 640, h: 176, font: 46, lead: 48, padX: 30, padY: 15, tail: 18, rim: 8, ink: 15, round: 24} as const;
const BUBBLE = {tall: .0843, floor: 600, edge: .02, band: .45, wide: {top: .118, banner: .236, foot: .12}, short: {top: .152, banner: .258, foot: .13}} as const;
const SPEECH_FONT = `800 ${CELL.font}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
export interface Said { id: string; team: BallTeam; text: string; at: number; until: number }

/**
 * What is being said in a ball match: the bots' lines - the plans they call, their
 * chat - and people's quick chat were a feed of text down the right edge of the HUD; now each is a small speech bubble
 * over the speaker, in the world. Two at most: a speaker's new line takes the place of their last, else a free place,
 * else the older of the two. The HUD hands each chat event over (`ballSpeech.say`, ui/hud/BallHud.ts); BallTags draws
 * them. Times are the page's (performance.now()).
 */
export class Speech {
  readonly lines: (Said | null)[] = Array.from({length: SPEECH.most}, () => null);
  /** A banner is up under the score (ui/hud/BallHud.ts says so as it changes): the bubbles keep out of its place. */
  banner = false;
  /** Counts up whenever a place's words change (BallTags draws its atlas again). */
  version = 0;
  say(id: string, team: BallTeam, text: string, now: number) {
    const words = text.trim();
    if (!id || !words) return;
    const L = this.lines;
    let at = L.findIndex(l => !!l && l.id === id && l.until > now);
    if (at < 0) at = L.findIndex(l => !l || l.until <= now);
    if (at < 0) { at = 0; for (let i = 1; i < L.length; i++) if (L[i]!.at < L[at]!.at) at = i; }
    L[at] = {id, team, text: words, at: now, until: now + SPEECH.ms};
    this.version++;
  }
  /** How many are up at `now`. */
  count(now: number) { let n = 0; for (const l of this.lines) if (l && l.until > now) n++; return n; }
  clear() { this.lines.fill(null); this.banner = false; this.version++; }
}
export const ballSpeech = new Speech();

/** Words broken into two lines at most, each within `most` px as `measure` reads them; a line still too long ends in an
 *  ellipsis. */
export function speechLines(text: string, most: number, measure: (s: string) => number): string[] {
  if (measure(text) <= most) return [text];
  const words = text.split(/\s+/);
  let first = '', i = 0;
  for (; i < words.length; i++) { const next = first ? `${first} ${words[i]}` : words[i]; if (first && measure(next) > most) break; first = next; }
  let second = words.slice(i).join(' ');
  if (!second) return [first];
  while (second.length > 1 && measure(second) > most) second = `${second.slice(0, -2).trimEnd()}…`;
  return [first, second];
}

/**
 * Name tags over every fighter of a ball match (who is who, and on which side, at a glance):
 * each a slanted ink slip with the name in white over a bar in the side's colour - your own fainter and smaller, since
 * you know where you are. Drawn into one canvas atlas when the seats change, and shown as one instanced draw of quads
 * that keep the same size on screen at any distance; in the world, so a split screen's each half has its own. Nothing
 * is allocated in a frame.
 *
 * And what they say (`Speech`): a speech bubble over the speaker's tag - paper, the words in ink, the rim in
 * the side's colour - a second instanced draw (a child of the tags' mesh, so it shows and hides with them). Its place is
 * settled on the screen itself: held inside the frame's edges when the speaker is out of it (at the nearer side when
 * they are behind the lens), and under the score bug, never on it.
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
  /** The speech bubbles: their atlas (a cell each), their draw, and which of `ballSpeech`'s words the atlas holds. */
  private readonly bubbleCanvas: HTMLCanvasElement | null;
  private readonly bubbleTexture: THREE.Texture;
  private readonly bubbles: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private readonly bubblePos: THREE.InstancedBufferAttribute;
  private readonly bubbleCell: THREE.InstancedBufferAttribute;
  /** Each bubble's other: its speaker's tag and its cell (the newer of two stands clear of the older, in the shader). */
  private readonly bubbleMate: THREE.InstancedBufferAttribute;
  private readonly bubbleMateCell: THREE.InstancedBufferAttribute;
  /** Which of `ballSpeech`'s places each bubble drawn this frame is (`speak`). */
  private readonly drawnAt = new Int8Array(SPEECH.most);
  private readonly cellSize = new Float32Array(SPEECH.most * 2);
  private spoken = -1;

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

    this.bubbleCanvas = typeof document === 'object' ? document.createElement('canvas') : null;
    if (this.bubbleCanvas) { this.bubbleCanvas.width = CELL.w; this.bubbleCanvas.height = CELL.h * SPEECH.most; }
    this.bubbleTexture = this.bubbleCanvas ? new THREE.CanvasTexture(this.bubbleCanvas) : new THREE.Texture();
    // (Mipmapped: its words are drawn at about twice the size they stand on screen, and without the smaller levels their
    // strokes shimmered and broke up - seen at 1080p. Built again only when what is said changes.)
    this.bubbleTexture.colorSpace = THREE.SRGBColorSpace; this.bubbleTexture.generateMipmaps = true; this.bubbleTexture.minFilter = THREE.LinearMipmapLinearFilter;
    const face = new THREE.PlaneGeometry(1, 1), said = new THREE.InstancedBufferGeometry();
    said.index = face.index; said.setAttribute('position', face.getAttribute('position'));
    this.bubblePos = new THREE.InstancedBufferAttribute(new Float32Array(SPEECH.most * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.bubbleCell = new THREE.InstancedBufferAttribute(new Float32Array(SPEECH.most * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.bubbleMate = new THREE.InstancedBufferAttribute(new Float32Array(SPEECH.most * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.bubbleMateCell = new THREE.InstancedBufferAttribute(new Float32Array(SPEECH.most * 4), 4).setUsage(THREE.DynamicDrawUsage);
    said.setAttribute('aPos', this.bubblePos); said.setAttribute('aCell', this.bubbleCell); said.setAttribute('aMate', this.bubbleMate); said.setAttribute('aMateCell', this.bubbleMateCell); said.instanceCount = 0;
    face.dispose();
    const speech = new THREE.ShaderMaterial({
      // Over everything in the world (depth always passes), and it writes its own depth where it is drawn: the finish's ink
      // lines come from the depth (render/look/LookPost.ts, the ball arenas' inkEdge), and drew the edges of whatever stood
      // behind a bubble across its words - seen at 1080p. Now the bubble is one flat near surface to it, ringed in ink.
      name: 'Ball speech bubbles', ...PREMULTIPLIED, depthTest: true, depthFunc: THREE.AlwaysDepth, depthWrite: true, toneMapped: false,
      uniforms: {uAtlas: {value: this.bubbleTexture}, uTall: {value: BUBBLE.tall}, uTag: {value: TALL}, uKeep: {value: new THREE.Vector3(BUBBLE.edge * 2, 1 - BUBBLE.wide.top * 2, BUBBLE.wide.foot * 2)}, uBand: {value: new THREE.Vector2(0, BUBBLE.band)}},
      // aPos: the speaker's tag (world) and the bubble's alpha. aCell: its cell, the share of the cell's width and of
      // its height the bubble fills, and its scale (it pops in). aMate, aMateCell: the other bubble's, when there are two
      // and this one is the newer (aMate.w 1): it stands clear of the older. Placed on the screen here, per lens, so a
      // split screen's each half places its own.
      vertexShader: `attribute vec4 aPos;attribute vec4 aCell;attribute vec4 aMate;attribute vec4 aMateCell;uniform float uTall,uTag;uniform vec3 uKeep;uniform vec2 uBand;varying vec2 vUv;varying float vAlpha;
        // The highest a bubble's top may stand at x: under the score bug, and under a banner that is up (uBand.x, 0 when
        // none) where the bubble reaches into the middle of the frame (uBand.y of its half-width).
        float ceilAt(float x,vec2 h){return uBand.x!=0.&&abs(x)-h.x<uBand.y?min(uKeep.y,uBand.x):uKeep.y;}
        // Where a bubble stands on the screen itself (the frame is 2 x 2: the same size at any distance and through any
        // lens): its centre (xy) and half-size (zw), from its speaker's tag and its cell's shares and scale.
        vec4 place(vec3 at,vec3 cell){
          vec4 mv=viewMatrix*vec4(at,1.);
          // Its foot over the name tag (drawn uTag of the frame tall at a 50 degree lens, as above).
          mv.y+=uTag*1.2*(-mv.z)*.9326;
          vec4 c=projectionMatrix*mv;
          vec2 foot=c.xy/max(abs(c.w),1e-4);
          // The speaker behind the lens: at the nearer side's edge, low.
          if(c.w<=0.)foot=vec2(c.x>=0.?2.:-2.,-.35);
          float aspect=projectionMatrix[1][1]/projectionMatrix[0][0];
          vec2 h=vec2(uTall*cell.x*${(CELL.w / CELL.h).toFixed(5)}/aspect,uTall*cell.y)*cell.z;
          vec2 m=vec2(foot.x,foot.y+h.y);
          // Inside the frame's sides, over its foot, and under its top.
          m.x=clamp(m.x,min(0.,-1.+uKeep.x+h.x),max(0.,1.-uKeep.x-h.x));
          m.y=clamp(m.y,-1.+uKeep.z+h.y,max(-1.+uKeep.z+h.y,ceilAt(m.x,h)-h.y));
          return vec4(m,h);
        }
        void main(){
          vec4 me=place(aPos.xyz,aCell.yzw);
          // Two that would touch: the newer stands over the older if there is room under the top, else under it.
          if(aMate.w>.5){
            vec4 o=place(aMate.xyz,aMateCell.yzw);
            if(abs(me.x-o.x)<me.z+o.z&&abs(me.y-o.y)<me.w+o.w){
              float up=o.y+o.w+me.w+.01;
              me.y=up+me.w<=ceilAt(me.x,me.zw)?up:o.y-o.w-me.w-.01;
            }
          }
          vUv=vec2(.5+position.x*aCell.y,(${SPEECH.most}.-1.-aCell.x+(position.y+.5)*aCell.z)/${SPEECH.most}.);
          vAlpha=aPos.w;
          gl_Position=vec4(me.xy+position.xy*2.*me.zw,0.,1.);
        }`,
      fragmentShader: `uniform sampler2D uAtlas;varying vec2 vUv;varying float vAlpha;
        void main(){vec4 t=texture2D(uAtlas,vUv);if(t.a*vAlpha<.1)discard;gl_FragColor=vec4(t.rgb*t.a,t.a)*vAlpha;}`,
    });
    this.bubbles = new THREE.Mesh(said, speech); this.bubbles.name = 'Ball speech bubbles'; this.bubbles.frustumCulled = false; this.bubbles.renderOrder = 60; this.bubbles.visible = false;
    this.mesh.add(this.bubbles);
  }

  /** Every frame: a tag over each seat's body (`at` gives where it is drawn, or null to leave it out). */
  update(seats: readonly BallSeat[], selfId: string, at: (id: string, out: THREE.Vector3) => THREE.Vector3 | null, show: boolean) {
    if (!show || !seats.length) { this.mesh.geometry.instanceCount = 0; this.mesh.visible = false; this.bubbles.geometry.instanceCount = 0; this.bubbles.visible = false; return; }
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
    this.speak(at, typeof performance === 'object' ? performance.now() : 0);
  }
  private readonly spot = new THREE.Vector3();

  /** Every frame: a bubble over each speaker still talking (and drawn), fading in with a small pop and out. */
  private speak(at: (id: string, out: THREE.Vector3) => THREE.Vector3 | null, now: number) {
    const lines = ballSpeech.lines;
    if (ballSpeech.version !== this.spoken) this.write();
    // Where it may stand (BUBBLE): a short screen's numbers on a phone on its side, and the banner's place while one is up.
    const keep = typeof innerHeight === 'number' && innerHeight > 0 && innerHeight < 520 ? BUBBLE.short : BUBBLE.wide, u = this.bubbles.material.uniforms;
    (u.uKeep.value as THREE.Vector3).set(BUBBLE.edge * 2, 1 - keep.top * 2, keep.foot * 2);
    (u.uBand.value as THREE.Vector2).x = ballSpeech.banner ? 1 - keep.banner * 2 : 0;
    const pos = this.bubblePos.array as Float32Array, cell = this.bubbleCell.array as Float32Array;
    const mate = this.bubbleMate.array as Float32Array, mateCell = this.bubbleMateCell.array as Float32Array;
    let n = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l || now >= l.until) continue;
      const p = at(l.id, this.spot);
      if (!p) continue;
      const k = n * 4, come = Math.min(1, (now - l.at) / SPEECH.fadeIn);
      pos[k] = p.x; pos[k + 1] = p.y + OVER; pos[k + 2] = p.z; pos[k + 3] = Math.min(come, (l.until - now) / SPEECH.fadeOut);
      cell[k] = i; cell[k + 1] = this.cellSize[i * 2]; cell[k + 2] = this.cellSize[i * 2 + 1]; cell[k + 3] = .82 + .18 * come * (2 - come);
      this.drawnAt[n] = i; n++;
    }
    // Two up: each is the other's mate, and the newer one gives way (the shader's place).
    for (let j = 0; j < n; j++) {
      const k = j * 4, o = (n - 1 - j) * 4, mine = lines[this.drawnAt[j]]!.at, theirs = lines[this.drawnAt[n - 1 - j]]!.at;
      const newer = n === 2 && (mine > theirs || (mine === theirs && j === 1));
      mate[k] = pos[o]; mate[k + 1] = pos[o + 1]; mate[k + 2] = pos[o + 2]; mate[k + 3] = newer ? 1 : 0;
      mateCell[k] = 0; mateCell[k + 1] = cell[o + 1]; mateCell[k + 2] = cell[o + 2]; mateCell[k + 3] = cell[o + 3];
    }
    this.bubbles.geometry.instanceCount = n; this.bubbles.visible = n > 0;
    if (!n) return;
    for (const a of [this.bubblePos, this.bubbleCell, this.bubbleMate, this.bubbleMateCell]) { a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; }
  }

  /** The bubbles' atlas, drawn again when what is said changes: each a paper slip with a tail, its rim in the side's
   *  colour inside an ink line, the words in ink on one line or two. */
  private write() {
    this.spoken = ballSpeech.version;
    const g = this.bubbleCanvas?.getContext('2d');
    if (!g) { this.cellSize.fill(.5); return; }
    // A short screen (a phone on its side) draws them larger (and its score bug stands lower: speak()).
    const tall = typeof innerHeight === 'number' && innerHeight > 0 ? innerHeight : 1080;
    this.bubbles.material.uniforms.uTall.value = BUBBLE.tall * Math.max(1, BUBBLE.floor / tall);
    g.clearRect(0, 0, CELL.w, CELL.h * SPEECH.most);
    g.font = SPEECH_FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const lines = ballSpeech.lines, out = CELL.ink / 2 + 1;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      const rows = speechLines(l.text, CELL.w - 2 * (CELL.padX + out), s => g.measureText(s).width);
      let wide = 0; for (const row of rows) wide = Math.max(wide, g.measureText(row).width);
      const w = Math.max(CELL.round * 2 + CELL.tail * 2, wide + 2 * CELL.padX), h = rows.length * CELL.lead + 2 * CELL.padY;
      const x = (CELL.w - w) / 2, foot = (i + 1) * CELL.h - out, y = foot - CELL.tail - h, r = CELL.round, mid = CELL.w / 2;
      g.beginPath();
      g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      g.lineTo(mid + CELL.tail * .7, y + h); g.lineTo(mid - CELL.tail * .2, foot); g.lineTo(mid - CELL.tail * .7, y + h);
      g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
      g.lineWidth = CELL.ink; g.strokeStyle = '#0b0c0e'; g.stroke();
      g.fillStyle = '#fff9ef'; g.fill();
      g.lineWidth = CELL.rim; g.strokeStyle = hex(BALL_TEAM_COLOURS[l.team]); g.stroke();
      g.fillStyle = '#0b0c0e';
      rows.forEach((row, k) => g.fillText(row, mid, y + CELL.padY + CELL.lead * (k + .5) + 2));
      this.cellSize[i * 2] = (w + 2 * out) / CELL.w; this.cellSize[i * 2 + 1] = (h + CELL.tail + 2 * out) / CELL.h;
    }
    this.bubbleTexture.needsUpdate = true;
    // The words' face, if it has not come yet (a canvas draws its stand-in, and never again by itself): once it has,
    // the atlas is drawn again.
    const fonts = typeof document === 'object' ? document.fonts : undefined;
    if (fonts && !this.asked && !fonts.check(SPEECH_FONT)) { this.asked = true; void fonts.load(SPEECH_FONT).then(() => { this.spoken = -1; }, () => {}); }
  }
  private asked = false;

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

  dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.texture.dispose(); this.bubbles.geometry.dispose(); this.bubbles.material.dispose(); this.bubbleTexture.dispose(); }
}
