import * as THREE from 'three';
import {BALL_TEAM_COLOURS, type BallView} from '../../game/ball/model';
import type {PlayerState} from '../../game/types';

/**
 * VOLLEYBALL (game/ball/volley.ts; `?volleyball`): each touch's tier - PERFECT, GOOD, EARLY, LATE,
 * FLUBBED - one small word over the fighter who made it for `TOUCH_WORD.seconds`, yours in your side's colour, the others
 * plain. It stands in for the line under the score that named each touch (ui/hud/BallHud.ts keeps that line and the
 * banner for points): the ball spent two fifths of a phone's live play behind that line, and the score bug faded for it.
 * A few plain DOM words over #interface, placed by projecting the fighter's head each frame; nothing in the scene.
 */
/** A touch's tier word, small, beside the contact, gone in about half a second, and none over bots: the word is the
 *  page's own fighter's alone, shown `seconds` (ballHud.css's vb-word runs as long), pinned beside where the ball was met
 *  (the touch's own point, `side` px to its right on the screen), never higher than `top` of the screen. (`over` is not
 *  read: the word stands beside the contact, not over the head.) */
export const TOUCH_WORD = {seconds: .5, over: 3.1, most: 3, top: .2, side: 22} as const;
const TIERS = new Set(['PERFECT', 'GOOD', 'EARLY', 'LATE', 'FLUBBED']);
interface Word {node: HTMLElement; id: string; until: number; x: number; y: number; z: number}
export class TouchWords {
  private readonly words: Word[] = [];
  private last = -1; private started = NaN;
  private readonly v = new THREE.Vector3();
  /** The words on screen now, for the checks: who and what. */
  get shown() { return this.words.filter(w => w.until > performance.now()).map(w => ({id: w.id, text: w.node.textContent ?? ''})); }
  update(view: BallView | undefined, players: readonly PlayerState[] | undefined, selfId: string, camera: THREE.Camera, now: number) {
    const root = typeof document === 'object' ? document.getElementById('interface') : null;
    if (!root) return;
    if (!view?.volley) { this.clear(); return; }
    if (view.startedAt !== this.started) { this.started = view.startedAt; this.last = -1; this.clear(); }
    const team = view.seats.find(s => s.id === selfId)?.team;
    for (const e of view.events) {
      if (e.id <= this.last) continue;
      this.last = e.id;
      if (e.kind !== 'touch' || !e.actorId) continue;
      const tier = (e.text ?? '').split(' · ').pop() ?? '';
      if (!TIERS.has(tier)) continue;
      // (Less on screen - the words are yours alone.)
      if (e.actorId !== selfId) continue;
      const w = this.words.length >= TOUCH_WORD.most ? this.words.shift()! : {node: Object.assign(document.createElement('div'), {className: 'vb-word'}), id: '', until: 0, x: 0, y: 0, z: 0};
      if (!w.node.isConnected) root.appendChild(w.node);
      w.id = e.actorId; w.until = now + TOUCH_WORD.seconds * 1000; w.node.textContent = tier; w.x = e.x; w.y = e.y; w.z = e.z;
      const mine = e.actorId === selfId || (!!team && e.team === team && e.actorId === selfId);
      w.node.style.color = mine && team ? `#${BALL_TEAM_COLOURS[team].toString(16).padStart(6, '0')}` : '';
      if (mine) w.node.dataset.own = ''; else delete w.node.dataset.own;
      w.node.dataset.tier = tier;
      w.node.classList.remove('on'); void w.node.offsetWidth; w.node.classList.add('on');
      this.words.push(w);
    }
    const W = innerWidth, H = innerHeight;
    for (const w of this.words) {
      const p = players?.find(q => q.id === w.id), live = w.until > now && !!p;
      if (!live) { w.node.hidden = true; continue; }
      // (Beside the contact - the ball's point as it was met - not over the head.)
      const v = this.v.set(w.x, w.y, w.z).project(camera);
      w.node.hidden = v.z > 1;
      // (Kept on the screen and clear of the score bug.)
      const x = Math.max(40, Math.min(W - 80, (v.x + 1) / 2 * W + TOUCH_WORD.side)), y = Math.max(H * TOUCH_WORD.top, (1 - v.y) / 2 * H);
      w.node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(0, -50%)`;
    }
  }
  private clear() { for (const w of this.words) w.node.remove(); this.words.length = 0; }
}
