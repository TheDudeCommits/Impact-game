// The HUD lab (dev only: npx vite, then /tools/hud-lab.html): the combat HUD's real markup, stylesheets and drivers,
// fed a scripted fight instead of a match, over a still of the game - so every look can be judged in the same moments
// (the intro, a combo, taking hits, ULTIMATE READY, awakening, low health), side by side, and captured.
//   ?skin=inked|halo  ?hud=duel|royale|training  ?own=taisei&foe=konta
//   ?t=7.2&pause=1 (hold one moment)  ?clean=1 (no lab bar)  ?bg=<image url>  ?clock=90 (a timed room)  ?speed=1
// Keys: 1-6 the looks, space pause, R restart, [ and ] step a second.
import '../src/ui/style.css';
import '../src/ui/manga.css';
import '../src/ui/combat-hud.css';
import '../src/ui/approved-hud.css';
import '../src/ui/hud/zones.css';
import '../src/ui/hud/duelHud.css';
import '../src/ui/hud/inked.css';
import '../src/ui/hud/protos/proto.css';
import '../src/ui/hud/protos/halo.css';
import { FIGHTERS, HUD_SKIN_OPTIONS, type HudSkin } from '../src/config';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { AWAKENING_SECONDS } from '../src/game/awakening';
import { CooldownShare, InkedHud, INK_DEFS, cardsHtml, comboHtml, foePlateHtml, ownPlateHtml } from '../src/ui/hud/inked';
import { PROTO_IDS, ProtoHud, protoClocksHtml } from '../src/ui/hud/protos';
import { domZoneLayer } from '../src/ui/hud/host';
import { moveSheetUrl } from '../src/ui/moveSheet';

const q = new URLSearchParams(location.search);
const param = (k: string, d: string) => q.get(k) ?? d;
let skin = param('skin', 'halo') as HudSkin;
let hud = param('hud', 'duel');
const OWN = param('own', 'taisei') as FighterId, FOE = param('foe', 'konta') as FighterId;
const CLOCK = q.has('clock') ? +q.get('clock')! : null;
let speed = +param('speed', '1'), paused = q.get('pause') === '1';
if (q.get('clean') === '1') document.body.classList.add('clean');
const app = document.querySelector<HTMLElement>('#app')!;
// A still of the game behind the HUD: ?bg=<image url> (none by default: a plain backdrop).
const bg = param('bg', '');
if (bg) app.style.backgroundImage = `url('${bg}')`; else app.style.background = '#3a4048';

/* ---------- The interface, built as Hud.ts builds it ---------- */
const root = document.createElement('div'); root.id = 'interface'; app.append(root);
const labels = FIGHTERS[OWN].shortMoves ?? ['LIGHT', 'HEAVY', 'SPECIAL', 'ULTIMATE'];
root.innerHTML = `<section class="combat-hud" aria-label="Combat status">${INK_DEFS}${ownPlateHtml()}${protoClocksHtml()}`
  + '<div class="match-status"><strong id="match-mode">TRAINING</strong><span id="match-detail">1 PLAYER · SPARRING BOT</span></div>'
  + `${foePlateHtml()}${comboHtml()}${cardsHtml(labels, ['J', 'K', 'Q', 'R', 'E'])}</section>`;
const combat = root.querySelector<HTMLElement>('.combat-hud')!;
const zones = domZoneLayer(root)!;
const plaque = document.createElement('div'); plaque.className = 'duel-plaque'; plaque.innerHTML = '<strong>DUEL</strong><small>ROUND 2 · FIRST TO TWO</small>';
const pips = (wins: number) => { const n = document.createElement('div'); n.className = 'duel-pips'; n.innerHTML = Array.from({ length: 2 }, (_, i) => `<i class="${i < wins ? 'won' : ''}"></i>`).join(''); return n; };
const moveBar = root.querySelector<HTMLElement>('.move-bar')!;
moveBar.style.setProperty('--move-sheet', `url('${moveSheetUrl(OWN)}')`);
root.querySelectorAll('.move-slot[data-move] .ik-cap').forEach((el, i) => { el.textContent = labels[i]; });
root.querySelector('#own-name')!.textContent = FIGHTERS[OWN].name.toUpperCase();

const inked = new InkedHud(root), protos = new ProtoHud(root, PROTO_IDS);
function applyLook() {
  root.dataset.skin = skin; root.dataset.hud = hud;
  if ((PROTO_IDS as readonly string[]).includes(skin)) { root.dataset.proto = skin; protos.refresh(); } else delete root.dataset.proto;
  zones.clear();
  if (hud === 'duel') { zones.zone('2').append(plaque); zones.zone('1b').append(pips(1)); zones.zone('3b').append(pips(0)); }
  root.querySelector<HTMLElement>('.match-status')!.style.display = hud === 'training' ? '' : 'none';
  for (const b of bar.querySelectorAll<HTMLButtonElement>('[data-skin]')) b.setAttribute('aria-pressed', String(b.dataset.skin === skin));
  for (const b of bar.querySelectorAll<HTMLButtonElement>('[data-hud]')) b.setAttribute('aria-pressed', String(b.dataset.hud === hud));
  const url = new URL(location.href); url.searchParams.set('skin', skin); url.searchParams.set('hud', hud); history.replaceState(null, '', url);
}

/* ---------- The scripted fight ---------- */
type Fighter = { id: string; name: string; fighter: FighterId; hp: number; maxHp: number; stamina: number; maxStamina: number; ultimate: number; awakening: number;
  awakened: boolean; awakenedUntil: number; combo: number; guarding: boolean; action: string; alive: boolean; cooldowns: Record<'light' | 'heavy' | 'special' | 'ultimate', number> };
const fighter = (id: string, f: FighterId, ult: number, awk: number): Fighter => ({ id, name: FIGHTERS[f].name, fighter: f, hp: 1000, maxHp: 1000, stamina: 100, maxStamina: 100,
  ultimate: ult, awakening: awk, awakened: false, awakenedUntil: 0, combo: 0, guarding: false, action: 'idle', alive: true, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
let own = fighter('me', OWN, 30, 15), foe = fighter('rival', FOE, 20, 0);
const LENGTH = 19;
type Beat = { at: number; run: (t: number) => void };
const beats: Beat[] = [];
const at = (time: number, run: (t: number) => void) => beats.push({ at: time, run });
const hit = (from: Fighter, to: Fighter, damage: number, n: number, time: number) => {
  to.hp = Math.max(0, to.hp - damage); from.combo = n; from.ultimate = Math.min(100, from.ultimate + damage * .09); to.awakening = Math.min(100, to.awakening + damage * .12);
  from.action = 'light'; if (from === own) inked.event({ kind: 'hit', actorId: own.id, targetId: foe.id, damage, combo: n, serverTime: time } as unknown as CombatEvent);
};
// A first string on the rival, a heavy and a special thrown in it.
[28, 30, 26, 34, 30, 38, 42, 48, 120].forEach((d, i) => at(2.2 + i * .26, t => { hit(own, foe, d, i + 1, t); if (i === 4) own.cooldowns.heavy = t + 4; if (i === 7) own.cooldowns.special = t + 6.5; }));
at(4.7, () => { own.combo = 0; own.action = 'idle'; });
// The rival answers; the second one lands hard.
at(5.0, t => hit(foe, own, 70, 1, t)); at(5.35, t => hit(foe, own, 160, 2, t)); at(5.8, () => { foe.combo = 0; foe.action = 'idle'; });
at(6.2, () => { own.stamina = Math.max(0, own.stamina - 25); });
at(6.8, () => { own.ultimate = 100; });
at(7.6, () => { own.guarding = true; }); at(8.9, () => { own.guarding = false; });
at(9.4, () => { own.awakening = 100; });
at(10.4, t => { own.awakened = true; own.awakening = 0; own.awakenedUntil = t + AWAKENING_SECONDS; });
// Awakened, a second string takes the rival low.
[40, 44, 40, 48, 52, 60, 140].forEach((d, i) => at(11 + i * .25, t => { hit(own, foe, d, i + 1, t); if (i === 0) own.cooldowns.light = t + .8; }));
at(12.9, () => { own.combo = 0; own.action = 'idle'; });
at(13.4, t => hit(foe, own, 90, 1, t)); at(13.7, t => hit(foe, own, 110, 2, t)); at(14.05, t => hit(foe, own, 330, 3, t)); at(14.5, () => { foe.combo = 0; });
at(15.2, () => { foe.ultimate = 100; });
beats.sort((a, b) => a.at - b.at);

let t = 0, next = 0;
function restart() { own = fighter('me', OWN, 30, 15); foe = fighter('rival', FOE, 20, 0); t = 0; next = 0; inked.enter(OWN); protos.enter(OWN); inked.selfId = own.id; }
function step(dt: number) {
  t += dt;
  while (next < beats.length && beats[next].at <= t) beats[next++].run(beats[next - 1].at);
  for (const f of [own, foe]) {
    if (f.guarding) f.stamina = Math.max(0, f.stamina - 46 * dt); else f.stamina = Math.min(f.maxStamina, f.stamina + 22 * dt);
    if (f.awakened && t >= f.awakenedUntil) f.awakened = false;
  }
}

/* ---------- Every frame: what Hud.update does for these pieces ---------- */
const cooldowns = [0, 1, 2, 3].map(() => new CooldownShare());
let lastOwnHp = 1000;
const asState = (f: Fighter) => ({ ...f, x: 0, y: 0, z: 0, yaw: 0, isBot: false, grounded: true, target: null, actionStarted: 0, actionDuration: 0, actionTime: 0 }) as unknown as PlayerState;
function draw() {
  const self = asState(own), target = hud === 'training' && t < .1 ? undefined : asState(foe), now = performance.now();
  if (own.hp < lastOwnHp - 1) { const m = root.querySelector('.fighter-meter.own')!; m.classList.remove('hit'); void (m as HTMLElement).offsetWidth; m.classList.add('hit'); }
  lastOwnHp = own.hp;
  inked.comboTick(own.combo); inked.update(self, target);
  protos.update(self, target, t, CLOCK === null ? null : Math.max(0, CLOCK - t), t > .3);
  const left = Math.max(0, own.awakenedUntil - t), ultReady = own.ultimate >= 100, awkReady = !own.awakened && own.awakening >= 100;
  for (const [id, amount, display, ready, active] of [
    ['ultimate-card', own.ultimate / 100, `${Math.floor(own.ultimate)}%`, ultReady, false],
    ['awakening-card', own.awakened ? left / AWAKENING_SECONDS : own.awakening / 100, own.awakened ? `${left.toFixed(1)}s` : `${Math.floor(own.awakening)}%`, awkReady, own.awakened],
  ] as const) {
    const card = root.querySelector<HTMLElement>('#' + id)!;
    card.style.setProperty('--done', Math.max(0, Math.min(1, amount)).toFixed(3));
    card.classList.toggle('ready', ready); card.classList.toggle('awake', active);
    const number = card.querySelector<HTMLElement>('.ik-charge')!;
    number.textContent = display.slice(0, -1); number.dataset.unit = display.endsWith('%') ? '%' : 's';
  }
  inked.ultimateTick(ultReady, root.querySelector<HTMLElement>('#ultimate-card')!, now);
  root.querySelector('#awakening-card-title')!.textContent = own.awakened ? 'AWAKENED' : 'AWAKENING';
  root.querySelectorAll<HTMLElement>('.move-slot[data-move]').forEach((slot, i) => {
    const key = (['light', 'heavy', 'special', 'ultimate'] as const)[i], cooldown = Math.max(0, own.cooldowns[key] - t);
    slot.classList.toggle('unavailable', cooldown > .1 && i !== 3); slot.classList.toggle('cooling', cooldown > .1); slot.classList.toggle('active', own.action === key);
    if (i !== 3) slot.style.setProperty('--done', cooldowns[i].of(cooldown).toFixed(3));
    slot.querySelector('.ik-cool')!.textContent = cooldown > .1 ? cooldown.toFixed(1) : '';
  });
  clockOut.textContent = t.toFixed(1);
}

/* ---------- The lab bar ---------- */
const bar = document.querySelector<HTMLElement>('#lab-bar')!;
bar.innerHTML = HUD_SKIN_OPTIONS.map(([value, text], i) => `<button type="button" data-skin="${value}" title="${i + 1}">${text.replace('Prototype ', '')}</button>`).join('')
  + '<i></i>' + ['duel', 'royale', 'training'].map(h => `<button type="button" data-hud="${h}">${h.toUpperCase()}</button>`).join('')
  + '<i></i><button type="button" data-act="restart">RESTART</button><button type="button" data-act="pause">PAUSE</button><output></output>';
const clockOut = bar.querySelector('output')!;
bar.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b) return;
  if (b.dataset.skin) { skin = b.dataset.skin as HudSkin; applyLook(); restart(); }
  else if (b.dataset.hud) { hud = b.dataset.hud; applyLook(); restart(); }
  else if (b.dataset.act === 'restart') restart();
  else if (b.dataset.act === 'pause') { paused = !paused; b.textContent = paused ? 'PLAY' : 'PAUSE'; }
});
addEventListener('keydown', e => {
  const n = +e.key; if (n >= 1 && n <= HUD_SKIN_OPTIONS.length) { skin = HUD_SKIN_OPTIONS[n - 1][0]; applyLook(); restart(); }
  else if (e.key === ' ') { paused = !paused; e.preventDefault(); }
  else if (e.key === 'r' || e.key === 'R') restart();
  else if (e.key === ']') { for (let i = 0; i < 60; i++) step(1 / 60); }
  else if (e.key === '[') { const to = Math.max(0, t - 1); restart(); while (t < to) step(1 / 60); }
});

/* ---------- Run ---------- */
applyLook(); restart();
const hold = q.has('t') ? +q.get('t')! : null;
if (hold !== null) { while (t < hold - 1e-6) step(1 / 60); }
let last = performance.now();
(window as unknown as { hudLab: unknown }).hudLab = { get t() { return t; }, seek(to: number) { restart(); while (t < to - 1e-6) step(1 / 60); draw(); }, set paused(v: boolean) { paused = v; } };
function frame(nowMs: number) {
  const dt = Math.min(.25, (nowMs - last) / 1000); last = nowMs;
  if (!paused) { step(dt * speed); if (t > LENGTH) restart(); }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.title = 'ready';
