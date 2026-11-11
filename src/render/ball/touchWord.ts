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
export const TOUCH_WORD = {seconds: .7, over: 2.35, most: 4} as const;
const TIERS = new Set(['PERFECT', 'GOOD', 'EARLY', 'LATE', 'FLUBBED']);
interface Word {node: HTMLElement; id: string; until: number}
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
      const w = this.words.length >= TOUCH_WORD.most ? this.words.shift()! : {node: Object.assign(document.createElement('div'), {className: 'vb-word'}), id: '', until: 0};
      if (!w.node.isConnected) root.appendChild(w.node);
      w.id = e.actorId; w.until = now + TOUCH_WORD.seconds * 1000; w.node.textContent = tier;
      const mine = e.actorId === selfId || (!!team && e.team === team && e.actorId === selfId);
      w.node.style.color = mine && team ? `#${BALL_TEAM_COLOURS[team].toString(16).padStart(6, '0')}` : '';
      w.node.dataset.tier = tier;
      w.node.classList.remove('on'); void w.node.offsetWidth; w.node.classList.add('on');
      this.words.push(w);
    }
    const W = innerWidth, H = innerHeight;
    for (const w of this.words) {
      const p = players?.find(q => q.id === w.id), live = w.until > now && !!p;
      if (!live) { w.node.hidden = true; continue; }
      const v = this.v.set(p!.x, p!.y + TOUCH_WORD.over * (p!.size ?? 1), p!.z).project(camera);
      w.node.hidden = v.z > 1;
      w.node.style.transform = `translate(${((v.x + 1) / 2 * W).toFixed(1)}px, ${((1 - v.y) / 2 * H).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  private clear() { for (const w of this.words) w.node.remove(); this.words.length = 0; }
}
