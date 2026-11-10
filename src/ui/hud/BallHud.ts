import { FIGHTERS } from '../../config';
import { ballOf, BALL_TEAM_NAMES, CHARM_COLOURS, POINT_GIVEN, POINT_WON, GOAL_RULES, SHOT_NAMES, SPIKE_RULES, charmLine, charmName, heatTier, otherTeam, type BallEvent, type BallSeat, type BallTeam, type BallView } from '../../game/ball/model';
import type { ModeHud, ModeHudFrame, ModeHudMount } from './modeHud';
import { el, Text, Flag, Data, Face, Markup, Fill, clockOf, pulse } from './kit';
import { hudView } from './hudView';
import { readEdge, type EdgeRead } from './EdgeMarkers';
import { promptText } from '../prompts';
import { DRILLS } from '../../game/ball/drills';
import { superShotName } from '../../game/ball/superShots';
import { VFX } from '../../render/vfxLevel';
import { padKey } from '../../input/glyphs';
import { BallHints } from '../ball/ballHints';
import { hasStances } from '../../game/ball/stance';
import './ballHud.css';

/**
 * The ball modes' HUD: Goal Rush and Sky Spike share one layout, a broadcast scoreboard over the
 * fight and the game's moments as big manga banners.
 *
 * Zone 2: the scoreboard - each side's faces in its colour, the two scores large, between them the clock (Goal Rush),
 * OVERTIME, or the rally (Sky Spike). Zone 2b under it: the ball's heat, and in Sky Spike whose serve it is and how many
 * of your side's three touches are spent. Zone 7: the banner (GOAL, SAVE, SPIKE, ACE, FEVER RALLY, the kickoff's count).
 * Zone 6: the one prompt that matters now (your serve). Zone 8: an arrow at the screen's edge toward the ball when it is
 * off screen. The shot ticker (zone 3b) names each big strike: who, which shot, how fast.
 */
const BANNER_MS = 2300, TICKER_MS = 2600, CHAT_MS = 4500, CHAT_LINES = 4;
const KMH = 3.6;

interface Slot { seat: string; root: HTMLElement; face: Face }

export function createBallHud(): ModeHud { return new BallHud(); }

const nameOf = (seat: BallSeat | undefined) => !seat ? '' : (seat.bot || seat.name === 'Fighter' ? FIGHTERS[seat.fighter].name : seat.name).toUpperCase();

class BallHud implements ModeHud {
  private board!: HTMLElement; private side!: Data; private boardLesson!: Flag;
  private faces: Record<BallTeam, HTMLElement> = {} as Record<BallTeam, HTMLElement>;
  private scores: Record<BallTeam, Text> = {} as Record<BallTeam, Text>;
  private scoreNodes: Record<BallTeam, HTMLElement> = {} as Record<BallTeam, HTMLElement>;
  private labels: Record<BallTeam, Text> = {} as Record<BallTeam, Text>;
  private middle!: Text; private middleKind!: Data; private sub!: Text;
  private slots: Slot[] = []; private rosterKey = '';
  private strip!: HTMLElement; private heat!: Data; private heatLabel!: Text; private touches!: HTMLElement; private touchDots: HTMLElement[] = []; private touchFlag!: Flag; private serve!: Text;
  private banner!: HTMLElement; private bannerOn!: Flag; private bannerKind!: Data; private bannerTeam!: Data; private bannerTop!: Text; private bannerTitle!: Text; private bannerLine!: Text;
  private bannerUntil = 0;
  private ticker!: HTMLElement; private tickerOn!: Flag; private tickerTeam!: Data; private tickerKind!: Data; private tickerText!: Text; private tickerUntil = 0;
  private chat!: HTMLElement; private chatLines: { node: HTMLElement; until: number }[] = [];
  private charms!: HTMLElement; private charmsKey = ''; private cam!: Markup;
  private chatButton!: HTMLButtonElement; private chatOn!: Flag;
  private prompt!: HTMLElement; private promptText!: Markup; private promptOn!: Flag;
  /** The first-time hints (ui/ball/ballHints.ts) in the prompt lane, when it has nothing else to say and the coach's tip
   *  is not up. */
  private readonly hints = new BallHints(() => !!this.root?.querySelector('.mode-hud .coach-tip.on'));
  private arrow!: HTMLElement; private arrowOn!: Flag; private edge: EdgeRead = { onScreen: true, side: 1, height: 0, behind: false };
  private lastEvent = 0; private lastAt = -Infinity; private shownScore = ''; private live = false;
  /** The sports HUD's own meter: health (Goal Rush, where the sides fight) and the boost, slim under the play;
   *  and the count back in while the page's own fighter is wiped out. */
  private meter!: HTMLElement; private hpFill!: HTMLElement; private boostFill!: HTMLElement; private meterHp!: Flag; private meterLow!: Flag; private meterBoost!: Data; private selfId = '';
  private shownHp = -1; private shownBoost = -1;
  private out!: HTMLElement; private outOn!: Flag; private outText!: Text; private shownOut = '';
  /** Goal Rush's stance (game/ball/stance.ts): a small badge over the meter - BALL in gold, or FIGHT in red with
   *  the one locked and their health - its key while the match is young, flashing as it changes. */
  private stance!: HTMLElement; private stanceKind!: Data; private stanceOn!: Flag; private stanceName!: Text; private stanceKey!: Markup; private stanceHp!: Fill; private stanceShown = '';
  private countdown = -1;
  private root?: HTMLElement;
  private wipe!: HTMLElement; private wipeTeam!: Data; private replayShown = false;
  private mood!: HTMLElement; private moodKind!: Data;
  private replay!: HTMLElement; private replayOn!: Flag; private replayTeam!: Data; private replayLine!: Text; private replaySkip!: Markup; private replayKey = '';

  mount(m: ModeHudMount) {
    this.board = el('div', 'bh-board', m.zone('2')); this.side = new Data(this.board, 'side'); this.boardLesson = new Flag(this.board, 'lesson');
    for (const team of ['red', 'blue'] as BallTeam[]) {
      const plate = el('div', `bh-team ${team}`, this.board);
      this.labels[team] = new Text(el('small', '', plate));
      this.faces[team] = el('div', 'bh-faces', plate);
      const score = el('b', `bh-score ${team}`, team === 'red' ? this.board : this.board);
      this.scoreNodes[team] = score; this.scores[team] = new Text(score);
    }
    // Order: red plate, red score, middle, blue score, blue plate (the CSS grid places them by class).
    const middle = el('div', 'bh-middle', this.board);
    this.middle = new Text(el('strong', '', middle)); this.middleKind = new Data(middle, 'kind'); this.sub = new Text(el('small', '', middle));
    // (The sports HUD: the strip and the charms hang under the score bug in its own zone, one block at the top edge.)
    this.strip = el('div', 'bh-strip', m.zone('2'));
    const heat = el('div', 'bh-heat', this.strip); this.heat = new Data(heat, 'tier');
    this.heatLabel = new Text(el('small', '', heat)); for (let i = 0; i < 4; i++) el('i', '', heat);
    this.touches = el('div', 'bh-touches', this.strip); this.touchFlag = new Flag(this.touches);
    el('small', '', this.touches, 'TOUCHES');
    for (let i = 0; i < SPIKE_RULES.touches; i++) this.touchDots.push(el('i', '', this.touches));
    this.serve = new Text(el('span', 'bh-serve', this.strip));
    // The ball cam's key (Tab, the pad's target button): the ball cam is on by default (render/ball/BallCam.ts), and the
    // key turns it off for the follow camera.
    this.cam = new Markup(el('span', 'bh-cam', this.strip));
    // RUMBLE: the charms at work, each a chip in its colour with whose it is and the seconds it has left.
    this.charms = el('div', 'bh-charms', m.zone('2'));
    this.banner = el('div', 'bh-banner', m.zone('7')); this.bannerOn = new Flag(this.banner, 'on');
    this.bannerKind = new Data(this.banner, 'kind'); this.bannerTeam = new Data(this.banner, 'team');
    this.bannerTop = new Text(el('small', '', this.banner)); this.bannerTitle = new Text(el('strong', '', this.banner)); this.bannerLine = new Text(el('span', '', this.banner));
    this.ticker = el('div', 'bh-ticker', m.zone('3b')); this.tickerOn = new Flag(this.ticker, 'on'); this.tickerTeam = new Data(this.ticker, 'team'); this.tickerKind = new Data(this.ticker, 'kind'); this.tickerText = new Text(this.ticker);
    // The bots' lines (and, later, people's quick chat): a short feed under the ticker.
    this.chat = el('div', 'bh-chat', m.zone('3b'));
    this.prompt = el('div', 'hk-slip bh-prompt hidden', m.zone('6')); this.promptText = new Markup(this.prompt); this.promptOn = new Flag(this.prompt); this.promptOn.set(true);
    // FREE PLAY's prompt is also the reset's button on a touch screen (main.ts hears the event and tells the room).
    this.prompt.addEventListener('pointerdown', event => { if (this.prompt.dataset.act === 'reset') { event.stopPropagation(); window.dispatchEvent(new CustomEvent('ball-reset')); } });
    // Quick chat's button on a touch screen (ui/ball/QuickChat.ts opens on the event).
    this.chatButton = el('button', 'bh-chat-btn', m.root, 'CHAT'); this.chatButton.type = 'button'; this.chatOn = new Flag(this.chatButton, 'on');
    this.chatButton.addEventListener('pointerdown', event => { event.stopPropagation(); event.preventDefault(); window.dispatchEvent(new CustomEvent('ball-chat-open')); });
    this.arrow = el('div', 'bh-arrow', m.zone('8')); this.arrowOn = new Flag(this.arrow, 'on');
    // The meter (zone 9, under the play over the cards' line): health in Goal Rush, the boost in both.
    this.meter = el('div', 'bh-meter', m.zone('9')); this.meterHp = new Flag(this.meter, 'hp'); this.meterLow = new Flag(this.meter, 'low'); this.meterBoost = new Data(this.meter, 'boost');
    const hp = el('i', 'bh-hp', this.meter); this.hpFill = el('b', '', hp);
    const boost = el('i', 'bh-boost', this.meter); this.boostFill = el('b', '', boost);
    this.stance = el('div', 'bh-stance', m.zone('9')); this.stanceKind = new Data(this.stance, 'stance'); this.stanceOn = new Flag(this.stance, 'on');
    el('b', '', this.stance); this.stanceName = new Text(el('span', '', this.stance));
    const foeHp = el('i', 'bh-stance-hp', this.stance); this.stanceHp = new Fill(el('b', '', foeHp));
    this.stanceKey = new Markup(el('small', '', this.stance));
    this.meter.before(this.stance);
    // Wiped out: the count back in, in the prompt lane.
    this.out = el('div', 'bh-out', m.zone('6a')); this.outOn = new Flag(this.out, 'on'); this.outText = new Text(this.out);
    // The replay's tag: REPLAY, whose goal it was, and the skip vote.
    this.root = m.root;
    this.replay = el('div', 'bh-replay', m.root);
    this.wipe = el('div', 'bh-wipe', m.root); this.wipeTeam = new Data(this.wipe, 'team');
    // FEVER and OVERTIME: the screen's edges glow while they last (gold; the two sides' colours).
    this.mood = el('div', 'bh-mood', m.root); this.moodKind = new Data(this.mood, 'mood'); this.replayOn = new Flag(this.replay, 'on'); this.replayTeam = new Data(this.replay, 'team');
    const chip = el('b', 'bh-replay-chip', this.replay); el('i', '', chip); el('span', '', chip, 'REPLAY');
    this.replayLine = new Text(el('strong', '', this.replay)); this.replaySkip = new Markup(el('small', '', this.replay));
    el('i', '', this.arrow); el('b', '', this.arrow, 'BALL');
  }

  update(f: ModeHudFrame) {
    const v = ballOf(f.snapshot);
    if (!v) return;
    const now = f.now, own = v.seats.find(s => s.id === f.self.id), team: BallTeam = own?.team ?? 'red';
    this.side.set(team);
    // #interface[data-ball-live] while the ball is in play: the sports HUD's CSS clears the screen down to the score bug.
    const live = v.phase === 'live' && !v.replay;
    if (this.root && live !== this.live) { this.live = live; if (live) this.root.dataset.ballLive = ''; else delete this.root.dataset.ballLive; }
    this.roster(v, f);
    this.selfId = f.self.id; this.gauges(v, f, own); this.stanceBadge(v, f, own);
    for (const t of ['red', 'blue'] as BallTeam[]) {
      this.labels[t].set(t === team ? `${BALL_TEAM_NAMES[t]} · YOU` : BALL_TEAM_NAMES[t]);
      this.scores[t].set(String(v.score[t]));
    }
    // (LEARN TO PLAY's goals and points are its steps' moments, not a match's: the score bug carries no score
    // there, only LEARN TO PLAY between the two sides - the steps' count is the checklist's, ui/ball/LearnToPlay.ts.)
    this.boardLesson.set(!!v.lesson);
    const score = `${v.score.red}-${v.score.blue}`;
    if (score !== this.shownScore) { if (this.shownScore) for (const t of ['red', 'blue'] as BallTeam[]) pulse(this.scoreNodes[t], 'pulse'); this.shownScore = score; }
    // The middle: the clock, OVERTIME, or the rally and what the next point is worth.
    if (v.practice) {
      this.middle.set(v.drill ? 'DRILL' : v.lesson ? 'LEARN TO PLAY' : 'FREE PLAY'); this.middleKind.set('clock');
      // (A training drill: its name; its progress is ui/ball/BallBadge.ts's. LEARN TO PLAY: the step's line and
      // checklist are ui/ball/LearnToPlay.ts's.)
      if (v.drill) this.sub.set(DRILLS[v.drill.id].name);
      else if (v.lesson) this.sub.set('');
      else this.sub.set([v.hits ? `TARGETS ${v.hits}${v.streak > 1 ? ` · STREAK ${v.streak}` : ''}` : v.mode === 'goal-rush' ? 'SHOOT THROUGH THE GOLD RING' : 'SPIKE IT ONTO THE GOLD RING', v.best > 0 ? `FASTEST ${Math.round(v.best * KMH)} KM/H` : ''].filter(Boolean).join(' · '));
    } else if (v.mode === 'goal-rush') {
      const ending = v.clock <= 0 && !v.overtime && v.phase === 'live';
      this.middle.set(v.overtime ? 'OVERTIME' : clockOf(Math.ceil(v.clock)));
      this.middleKind.set(v.overtime ? 'overtime' : ending ? 'ending' : v.clock <= 30 ? 'late' : 'clock');
      // In play the line says only what changes the play (the sports HUD): the match's terms are for the kickoff.
      this.sub.set(v.overtime ? 'NEXT GOAL WINS' : ending ? 'BALL ON THE GROUND ENDS IT' : v.phase === 'live' ? '' : `${v.rumble ? 'RUMBLE' : 'FIRST TO SCORE MORE'} · ${Math.round(GOAL_RULES.matchSeconds / 60)} MIN`);
    } else {
      // (A FEVER point counts double to the side behind alone - the arrow points at it on the score bug, red's
      // on the left - or to either side level, and to anyone in SUDDEN DEATH.)
      const behind = !v.fever || v.mutator === 'sudden-death' || v.score.red === v.score.blue ? '' : v.score.red < v.score.blue ? 'red' : 'blue';
      this.middle.set(v.fever ? behind === 'red' ? '◂ FEVER ×2' : behind === 'blue' ? 'FEVER ×2 ▸' : 'FEVER ×2' : `RALLY ${v.rally}`);
      this.middleKind.set(v.fever ? 'fever' : v.rally >= SPIKE_RULES.rallyHeat ? 'hot' : 'rally');
      this.sub.set(v.phase === 'live' ? '' : `${v.rumble ? 'RUMBLE · ' : ''}FIRST TO ${v.target} · WIN BY 2`);
    }
    // The strip: heat, touches, serve.
    const tier = heatTier(v.ball.heat);
    this.heat.set(String(tier)); this.heatLabel.set(tier >= 4 ? 'OVERDRIVE' : 'HEAT');
    const spike = v.mode === 'sky-spike';
    this.touchFlag.set(!spike);
    if (spike) {
      const used = v.touchTeam === team ? Math.min(SPIKE_RULES.touches, v.touches) : 0;
      this.touchDots.forEach((dot, i) => dot.classList.toggle('used', i < used));
      this.touches.classList.toggle('last', used === SPIKE_RULES.touches - 1);
      const server = v.seats.find(s => s.id === v.serverId);
      this.serve.set(v.phase === 'kickoff' ? `${BALL_TEAM_NAMES[v.servingTeam]} SERVE · ${nameOf(server)}` : `${BALL_TEAM_NAMES[v.servingTeam]} SERVING`);
    } else this.serve.set(v.ball.lastId ? `LAST TOUCH · ${nameOf(v.seats.find(s => s.id === v.ball.lastId))}` : '');
    this.charmChips(v, f, team);
    // The ball cam's key, and quick chat's (ui/ball/QuickChat.ts; none in FREE PLAY, where nobody hears it): taught for
    // the match's first half minute and at each kickoff or serve, when nobody is busy, and out of the way otherwise.
    const teach = f.snapshot.serverTime - v.startedAt < 30 || v.phase === 'kickoff' || v.phase === 'countdown';
    const chat = v.practice ? '' : ` · ${f.input === 'controller' ? padKey(f.family, 'select') : '<kbd>C</kbd>'} CHAT`;
    // (Goal Rush's target key is the stance's: its badge teaches it, over the meter.)
    const stances = v.mode === 'goal-rush' && (!v.practice || !!v.lesson);
    this.cam.set(f.input === 'touch' || !teach ? '' : (stances ? chat.replace(/^ · /, '') : promptText(hudView.ballCam() ? '{target} FREE CAM' : '{target} BALL CAM', { device: f.input, family: f.family }) + chat));
    // The prompt: your serve, or a KI CHARGE waiting in your boots.
    // (LEARN TO PLAY's JUMP SERVE says it in its own line: ui/ball/LearnToPlay.ts.)
    const serving = spike && v.phase === 'kickoff' && v.serverId === f.self.id && !v.lesson;
    const charged = v.rumble && v.effects.some(e => e.kind === 'charge' && e.id === f.self.id);
    const practice = v.practice && !v.drill && !v.lesson && (v.phase === 'live' || v.phase === 'kickoff');
    const hint = serving || charged || practice ? '' : this.hints.frame({ view: v, self: f.self, players: f.snapshot.players, fight: !!hudView.ballLock(), device: f.input, family: f.family, serverTime: f.snapshot.serverTime }, now);
    this.promptOn.set(!serving && !charged && !practice && !hint);
    if (serving) this.promptText.set(promptText('YOUR SERVE · {light} LOB · {heavy} POWER SERVE', { device: f.input, family: f.family }));
    else if (charged) this.promptText.set(promptText('KI CHARGE · YOUR NEXT {heavy} FLIES AT OVERDRIVE', { device: f.input, family: f.family }));
    else if (practice) this.promptText.set(f.input === 'touch' ? '<span class="ux-prompt"><b>TAP: RESET BALL</b></span>' : `<span class="ux-prompt">${f.input === 'controller' ? padKey(f.family, 'select') : '<kbd>⌫</kbd>'}<b>RESET BALL</b></span>`);
    else if (hint) this.promptText.set(hint);
    if (practice && f.input === 'touch') this.prompt.dataset.act = 'reset'; else delete this.prompt.dataset.act;
    this.chatOn.set(f.input === 'touch' && !v.practice && v.phase !== 'lobby' && v.phase !== 'over');
    // The events.
    if (f.snapshot.serverTime < this.lastAt - 1) this.lastEvent = 0;
    this.lastAt = f.snapshot.serverTime;
    for (const e of v.events) if (e.id > this.lastEvent) { this.lastEvent = e.id; this.hints.event(e, f.self.id); this.moment(e, v, team, now); }
    // The kickoff's count.
    // (An intro plays through its countdown: BallCeremony's own lens and pages, no count.)
    if (v.phase === 'kickoff' && v.mode === 'goal-rush' && !v.practice || v.phase === 'countdown' && !v.intro) {
      const until = v.phase === 'countdown' ? v.startsAt ?? 0 : v.phaseUntil, left = Math.ceil(until - f.snapshot.serverTime);
      if (left !== this.countdown && left >= 0) { this.countdown = left; this.show(now, 'count', team, v.phase === 'countdown' ? 'GET READY' : 'KICKOFF', left > 0 ? String(left) : 'GO!', '', 1000); }
    } else if (this.countdown > 0 && v.phase === 'live' && !v.practice) { this.countdown = 0; this.show(now, 'count', team, v.mode === 'goal-rush' ? 'KICKOFF' : 'SERVE', 'GO!', '', 700); }
    this.replayTag(v, f, now);
    this.moodKind.set(v.phase === 'over' || v.phase === 'lobby' ? '' : v.mode === 'sky-spike' && v.fever ? 'fever' : v.mode === 'goal-rush' && v.overtime ? 'overtime' : '');
    if (now > this.bannerUntil) this.bannerOn.set(false);
    if (now > this.tickerUntil) this.tickerOn.set(false);
    while (this.chatLines.length && (this.chatLines[0].until < now || this.chatLines.length > CHAT_LINES)) this.chatLines.shift()!.node.remove();
    this.edgeArrow(v, f);
  }

  private roster(v: BallView, f: ModeHudFrame) {
    const key = v.seats.map(s => `${s.id}:${s.team}:${s.fighter}`).join('|');
    if (key !== this.rosterKey) {
      this.rosterKey = key;
      for (const slot of this.slots) slot.root.remove();
      this.slots = [];
      for (const seat of v.seats) {
        const root = el('div', `bh-face ${seat.team}`, this.faces[seat.team]);
        const face = new Face(el('span', '', root)); face.set(seat.fighter);
        root.title = nameOf(seat);
        if (seat.id === f.self.id) root.classList.add('self');
        this.slots.push({ seat: seat.id, root, face });
      }
    }
    for (const slot of this.slots) {
      const seat = v.seats.find(s => s.id === slot.seat);
      slot.root.classList.toggle('touch', v.ball.lastId === slot.seat);
      slot.root.classList.toggle('gone', !!seat?.disconnected);
    }
  }

  /** The meter and the count back in. Written only when a share moves a percent (or the count a tenth), so a frame
   *  costs nothing. */
  private gauges(v: BallView, f: ModeHudFrame, own: BallSeat | undefined) {
    const self = f.self, fights = v.mode === 'goal-rush' && (!v.practice || !!v.lesson);
    this.meterHp.set(fights);
    const hp = fights && self.maxHp > 0 ? Math.round(100 * Math.max(0, self.hp) / self.maxHp) : 100;
    if (hp !== this.shownHp) { this.shownHp = hp; this.hpFill.style.transform = `scaleX(${hp / 100})`; this.meterLow.set(fights && hp <= 30); }
    const max = self.maxStamina ?? 100, boost = Math.round(100 * Math.max(0, Math.min(max, self.stamina)) / Math.max(1, max));
    if (boost !== this.shownBoost) { this.shownBoost = boost; this.boostFill.style.transform = `scaleX(${boost / 100})`; }
    this.meterBoost.set(self.boost ? 'on' : boost >= 99 ? 'full' : '');
    const left = own?.out !== undefined ? own.out - f.snapshot.serverTime : 0;
    const out = left > 0 ? `WIPED OUT · BACK IN ${left.toFixed(1)}` : '';
    if (out !== this.shownOut) { this.shownOut = out; this.outText.set(out); this.outOn.set(!!out); }
  }

  private show(now: number, kind: string, team: BallTeam | '', top: string, title: string, line: string, ms = BANNER_MS) {
    this.bannerKind.set(kind); this.bannerTeam.set(team); this.bannerTop.set(top); this.bannerTitle.set(title); this.bannerLine.set(line);
    this.bannerOn.set(true); pulse(this.banner, 'pulse'); this.bannerUntil = now + ms;
  }
  private tick(now: number, team: BallTeam | undefined, text: string, kind = '') {
    this.tickerKind.set(kind); this.tickerTeam.set(team ?? ''); this.tickerText.set(text); this.tickerOn.set(true); pulse(this.ticker, 'pulse'); this.tickerUntil = now + TICKER_MS;
  }

  private moment(e: BallEvent, v: BallView, team: BallTeam, now: number) {
    const seat = (id?: string) => v.seats.find(s => s.id === id);
    const who = nameOf(seat(e.actorId)), mine = e.team === team, shot = e.shot ? SHOT_NAMES[e.shot] : '';
    const speed = e.value ? `${Math.round(e.value * (e.kind === 'goal' || e.kind === 'own-goal' ? 1 : KMH))} KM/H` : '';
    // (LEARN TO PLAY keeps no score - a goal or point to the other side is a step's miss, which the lesson's own
    // line says, not a banner that stood over the next step's start for two seconds; the person's own side's moment keeps
    // its banner without the score's words.)
    const scored = e.kind === 'goal' || e.kind === 'own-goal' || POINT_WON.has(e.kind) || POINT_GIVEN.has(e.kind);
    if (v.lesson && scored && !mine) return;
    const lesson = !!v.lesson && scored;
    switch (e.kind) {
      case 'goal': {
        const assist = seat(e.assistId);
        this.show(now, 'goal', e.team ?? '', lesson ? '' : mine ? 'YOUR TEAM SCORES' : `${BALL_TEAM_NAMES[e.team!]} SCORES`, e.text === 'SUPER GOAL' ? 'SUPER GOAL!!' : 'GOOOAL!!',
          [who, shot, speed, assist ? `ASSIST ${nameOf(assist)}` : ''].filter(Boolean).join(' · '), v.drill || v.lesson ? 1500 : 3600); // (A drill's next ball comes a breath after, and LEARN TO PLAY's: its banner goes before it does.)
        break;
      }
      case 'own-goal': this.show(now, 'goal', e.team ?? '', `${BALL_TEAM_NAMES[e.team!]} SCORES`, 'OWN GOAL!', who, 3200); break;
      case 'save': this.show(now, 'save', e.team ?? '', mine ? 'DENIED' : 'STOPPED', e.text === 'PERFECT SAVE' ? 'PERFECT SAVE!' : e.text === 'DIVING SAVE' ? 'DIVING SAVE!' : e.text === 'OFF THE LINE' ? 'OFF THE LINE!' : 'SAVE!', who, 1600); break;
      case 'post': this.tick(now, e.team, `${e.text ?? 'OFF THE POST!'} ${who}`); break;
      case 'overtime': this.show(now, 'overtime', '', 'ALL SQUARE', 'OVERTIME', 'NEXT GOAL WINS', 2600); break;
      // Each fighter's super shot by its own name (game/ball/superShots.ts). Its cut-in (ui/ball/BallShow.ts) names it
      // big; the banner only where the VISUAL EFFECTS level leaves the cut-in out.
      case 'super': if (VFX.level !== 'minimal') { this.tick(now, e.team, `${who} · ${superShotName(seat(e.actorId)?.fighter)}`, 'accolade'); break; }
        this.show(now, 'super', e.team ?? '', `${who} · SUPER SHOT`, superShotName(seat(e.actorId)?.fighter), v.mode === 'goal-rush' ? `A GOAL FROM IT COUNTS ${GOAL_RULES.superGoal}` : 'INTO THE EMPTIEST CORNER', 1900); break;
      case 'duel': this.show(now, 'clash', e.team ?? '', `${who} MEETS ${superShotName(seat(e.targetId)?.fighter)}`, 'TECHNIQUE DUEL!!', 'A PERFECT GUARD AGAINST A SUPER SHOT', 1200); break;
      case 'duel-won': this.show(now, e.text === 'SHOT STOPPED' ? 'save' : 'super', e.team ?? '', e.text === 'SHOT STOPPED' ? `${who} WINS THE DUEL` : `${who} BREAKS THROUGH`, e.text === 'SHOT STOPPED' ? 'SHOT STOPPED!!' : 'BREAKS THROUGH!!', nameOf(seat(e.targetId)) ? `OVER ${nameOf(seat(e.targetId))}` : '', 1800); break;
      case 'kill': this.show(now, 'kill', e.team ?? '', lesson ? '' : mine ? 'POINT' : `${BALL_TEAM_NAMES[e.team!]} POINT`, e.text === 'SUPER SHOT' ? 'SUPER SHOT!!' : e.shot === 'spike' ? 'SPIKED!' : 'KILL!', [who, shot, (e.value ?? 1) > 1 ? '×2 FEVER' : ''].filter(Boolean).join(' · '), v.lesson ? 1500 : 2400); break;
      case 'ace': this.show(now, 'ace', e.team ?? '', lesson ? '' : mine ? 'POINT' : `${BALL_TEAM_NAMES[e.team!]} POINT`, 'ACE!', who, v.lesson ? 1500 : 2400); break;
      case 'out': this.show(now, 'out', e.team ?? '', `${BALL_TEAM_NAMES[e.team!]} POINT`, 'OUT!', who ? `OFF ${who}` : '', 1900); break;
      case 'touches': this.show(now, 'out', e.team ?? '', `${BALL_TEAM_NAMES[e.team!]} POINT`, 'FOUR TOUCHES!', `${SPIKE_RULES.touches} A SIDE`, 1900); break;
      case 'block': case 'perfect':
        if (v.mode === 'sky-spike') this.show(now, 'save', e.team ?? '', who, e.kind === 'perfect' ? 'STUFF BLOCK!' : 'BLOCK!', '', 1400);
        else if (e.text) this.tick(now, e.team, `${e.text} · ${who}`);
        break;
      // (Goal Rush's FINAL PUSH: the last half minute of a match in reach - the ball burns, the side behind charges.)
      // (Sky Spike's FEVER point counts double to the side behind - the event's team - or to either side level.)
      case 'fever': this.show(now, 'fever', v.mode === 'goal-rush' ? '' : e.team ?? '', v.mode === 'goal-rush' ? `${e.value ?? 30} SECONDS LEFT` : `RALLY ${e.value}`, v.mode === 'goal-rush' ? 'FINAL PUSH!' : 'FEVER RALLY!',
        v.mode === 'goal-rush' ? 'THE BALL BURNS' : e.team ? (mine ? 'YOUR POINT COUNTS DOUBLE' : `${BALL_TEAM_NAMES[e.team]}'S POINT COUNTS DOUBLE`) : 'EVERY POINT COUNTS DOUBLE', 2400); break;
      case 'rally': this.tick(now, undefined, e.text ? `${e.text} · RALLY ${e.value}` : `RALLY ${e.value}!`); break;
      case 'match-point': this.show(now, 'match', e.team ?? '', BALL_TEAM_NAMES[e.team!], 'MATCH POINT', '', 1800); break;
      case 'side-out': break;
      case 'target': this.show(now, 'save', team, (e.value ?? 1) > 1 ? `STREAK ${e.value}` : 'FREE PLAY', (e.value ?? 1) >= 3 ? `${e.value} IN A ROW!` : 'TARGET!', `BEST STREAK ${v.bestStreak}`, 1300); break;
      case 'clash': this.show(now, 'clash', e.team ?? '', `${who} OVERPOWERS ${nameOf(seat(e.targetId))}`, 'CLASH!!', speed, 1500); break;
      case 'accolade': this.tick(now, e.team, `${e.text ?? ''}! · ${e.assistId ? `${nameOf(seat(e.assistId))} ▸ ${who}` : who}`, 'accolade'); break;
      case 'charm': this.tick(now, e.team, `${who} · ${e.text ?? ''}${e.charm ? ` · ${charmLine(e.charm, v.mode)}` : ''}`, 'charm'); break;
      case 'shield': this.show(now, 'save', e.team ?? '', who ? `${who} · ${mine ? 'SAVED' : 'DENIED'}` : 'DENIED', `${e.text ?? 'IRON WALL'}!`, v.mode === 'goal-rush' ? 'THE GOAL WAS SEALED' : 'THE BALL BOUNCED BACK UP', 1600); break;
      case 'chat': {
        const line = el('div', `bh-chat-line ${e.team ?? ''}`, this.chat);
        el('b', '', line, who); el('span', '', line, e.text ?? '');
        this.chatLines.push({ node: line, until: now + CHAT_MS });
        break;
      }
      // Goal Rush's fights (GOAL_FIGHT): your own wipe-out a banner, anyone else's and every bump a ticker line.
      case 'wipeout': {
        const down = nameOf(seat(e.targetId)), self = v.seats.find(s => s.id === this.selfId);
        if (e.targetId === this.selfId) this.show(now, 'out', e.team ?? '', who ? `BY ${who}` : 'DOWN', 'WIPED OUT!', `BACK IN ${Math.round(e.value ?? 3)} S`, 1500);
        else if (e.actorId === this.selfId) this.show(now, 'kill', self?.team ?? '', down, 'WIPED OUT!', e.text ? `${e.text}` : '', 1300);
        else this.tick(now, e.team, `${who || 'DOWN'} ${who ? 'WIPES OUT' : ''} ${down}`.replace(/\s+/g, ' ').trim());
        break;
      }
      case 'demo': this.tick(now, e.team, `${who} BUMPS ${nameOf(seat(e.targetId))} · ${Math.round((e.value ?? 0) * KMH)} KM/H`); break;
      // Goal Rush's FIGHT stance (game/ball/model.ts GOAL_STANCE): yours a banner, anyone's a ticker line.
      case 'tackle': {
        const down = nameOf(seat(e.targetId)), big = e.text === 'TAKEDOWN';
        if (e.actorId === this.selfId) this.show(now, 'tackle', e.team ?? '', `${down} · OFF THE BALL`, big ? 'TAKEDOWN!!' : 'TACKLE!', '', big ? 1400 : 1000);
        else this.tick(now, e.team, `${who} ${big ? 'TAKES DOWN' : 'TACKLES'} ${down}${e.targetId === this.selfId ? ' · YOU' : ''}`, 'tackle');
        break;
      }
      case 'bowled': this.tick(now, e.team, `${who || 'THE BALL'} ${e.text === 'STAGGERED' ? 'STAGGERS' : 'BOWLS OVER'} ${nameOf(seat(e.targetId))} · ${Math.round((e.value ?? 0) * KMH)} KM/H`); break;
      // (Goal Rush: your own PERFECT STRIKE - PERFECT VOLLEY, PERFECT HEADER - is a short gold banner.)
      case 'strike':
        if (e.perfect && v.mode === 'goal-rush' && e.actorId === this.selfId) this.show(now, 'perfect', e.team ?? '', speed, `${e.text ?? 'PERFECT STRIKE'}!`, '', 1000);
        else if (e.shot && e.shot !== 'tap' && e.shot !== 'bump' && e.shot !== 'set') this.tick(now, e.team, [who, e.perfect ? (v.mode === 'sky-spike' ? 'PERFECT SPIKE' : e.text ?? 'PERFECT STRIKE') : e.text ?? shot, speed].filter(Boolean).join(' · '));
        break;
      case 'win': {
        const winner = e.team;
        this.show(now, 'win', winner ?? '', winner ? (winner === team ? 'VICTORY' : 'DEFEAT') : 'FULL TIME', winner ? `${BALL_TEAM_NAMES[winner]} WIN` : 'DRAW', `${v.score.red} – ${v.score.blue}`, 4200);
        break;
      }
      default: break;
    }
    void otherTeam;
  }

  /** Goal Rush's stance badge, and `#interface[data-ball-stance]` for the touch layer's button (its label: what a tap
   *  does - FIGHT from the ball, BALL from a fight). The key is shown while the match is young and at each kickoff. */
  private stanceBadge(v: BallView, f: ModeHudFrame, own: BallSeat | undefined) {
    const on = hasStances(v) && v.phase !== 'lobby' && v.phase !== 'over' && !!own && own.out === undefined;
    this.stanceOn.set(on);
    const lock = on ? hudView.ballLock() : null, kind = !on ? '' : lock ? 'fight' : 'ball';
    if (this.root) { if (kind) this.root.dataset.ballStance = kind; else delete this.root.dataset.ballStance; }
    if (!on) { this.stanceShown = ''; return; }
    const foe = lock ? f.snapshot.players.find(p => p.id === lock) : undefined;
    this.stanceKind.set(kind);
    this.stanceName.set(lock ? nameOf(v.seats.find(s => s.id === lock)) : '');
    this.stanceHp.set(foe && foe.maxHp > 0 ? foe.hp / foe.maxHp : 0);
    if (kind + lock !== this.stanceShown) { this.stanceShown = kind + lock; pulse(this.stance, 'pulse'); }
    const teach = f.snapshot.serverTime - v.startedAt < 40 || v.phase === 'kickoff' || v.phase === 'countdown';
    this.stanceKey.set(f.input === 'touch' || !teach ? '' : promptText(lock ? '{target} BALL' : '{target} FIGHT', { device: f.input, family: f.family }));
  }

  /** RUMBLE's charms at work: a chip each, rebuilt only when what it says changes. */
  private charmChips(v: BallView, f: ModeHudFrame, team: BallTeam) {
    const t = f.snapshot.serverTime, live = v.rumble ? v.effects.filter(e => e.until > t) : [];
    const key = live.map(e => `${e.kind}:${e.team}:${e.id}:${Math.ceil(e.until - t)}`).join('|');
    if (key === this.charmsKey) return;
    this.charmsKey = key;
    this.charms.replaceChildren(...live.map(e => {
      const chip = document.createElement('span'); chip.className = `bh-charm ${e.team}`;
      chip.style.setProperty('--c', `#${CHARM_COLOURS[e.kind].toString(16).padStart(6, '0')}`);
      const holder = e.id === f.self.id ? 'YOU' : e.kind === 'wall' || e.kind === 'feather' || e.kind === 'giant' || e.kind === 'ice' ? BALL_TEAM_NAMES[e.team] : nameOf(v.seats.find(s => s.id === e.id));
      chip.textContent = `${charmName(e.kind, v.mode)} · ${holder} · ${Math.ceil(e.until - t)}`;
      if (e.team === team) chip.classList.add('ours');
      return chip;
    }));
  }

  /** While a replay shows (render/ball/BallReplay.ts): its tag, the fight's own plates and cards put away, the banner
   *  that was up let go. */
  private replayTag(v: BallView, f: ModeHudFrame, now: number) {
    const r = v.replay, t = f.snapshot.serverTime, on = !!r && v.phase === 'scored' && t >= r.at && t < r.until;
    this.replayOn.set(on);
    // In and out of it, a wipe in the scorer's colour across the cut.
    if (on !== this.replayShown) { this.replayShown = on; this.wipeTeam.set(r?.team ?? ''); pulse(this.wipe, 'pulse'); }
    if (this.root) { if (on) this.root.dataset.ballReplay = ''; else delete this.root.dataset.ballReplay; }
    if (!on || !r) { this.replayKey = ''; return; }
    const key = `${r.from}:${r.to}`;
    if (key !== this.replayKey) {
      this.replayKey = key; this.bannerUntil = Math.min(this.bannerUntil, now); this.replayTeam.set(r.team ?? '');
      const who = nameOf(v.seats.find(s => s.id === r.actorId)), shot = r.shot ? SHOT_NAMES[r.shot] : '';
      this.replayLine.set([r.text ?? (r.kind === 'goal' ? 'GOAL' : ''), who, r.text === 'OWN GOAL' ? '' : shot, r.speed ? `${r.speed} KM/H` : ''].filter(Boolean).join(' · '));
    }
    const votes = r.people && r.people > 1 && r.skips ? ` · ${r.skips}/${r.people}` : '';
    this.replaySkip.set(f.input === 'touch' ? `TAP TO SKIP${votes}` : promptText(`{jump} SKIP${votes}`, { device: f.input, family: f.family }));
  }

  /** An arrow at the screen's edge toward the ball when the view has lost it. */
  private edgeArrow(v: BallView, f: ModeHudFrame) {
    const camera = hudView.camera, b = v.ball;
    const live = v.phase === 'live' || v.phase === 'kickoff';
    if (!camera || !live) { this.arrowOn.set(false); return; }
    readEdge(camera, b.x, b.y, b.z, this.edge, .06);
    this.arrowOn.set(!this.edge.onScreen);
    if (this.edge.onScreen) return;
    const zone = this.arrow.parentElement, w = zone?.clientWidth ?? 1600, h = zone?.clientHeight ?? 900;
    // (On the touch controls it stays above the sports set's buttons down the right: input/sportTouch.ts, 176 px up.)
    const x = this.edge.side > 0 ? w - 70 : 16, y = Math.max(60, Math.min(h - (f.input === 'touch' ? 210 : 120), (this.edge.height * .5 + .5) * h));
    this.arrow.style.transform = `translate(${x}px,${y}px)`;
    this.arrow.dataset.side = this.edge.side > 0 ? 'r' : 'l';
    this.arrow.dataset.team = b.lastTeam ?? '';
    void f;
  }

  unmount() { this.hints.clear(); if (this.root) { delete this.root.dataset.ballReplay; delete this.root.dataset.ballLive; delete this.root.dataset.ballStance; } this.stance?.remove(); this.stanceShown = ''; this.live = false; this.replay?.remove(); this.wipe?.remove(); this.mood?.remove(); this.chatButton?.remove(); this.replayKey = ''; this.replayShown = false; this.board?.remove(); this.strip?.remove(); this.banner?.remove(); this.ticker?.remove(); this.chat?.remove(); this.chatLines = []; this.charms?.remove(); this.charmsKey = ''; this.prompt?.remove(); this.arrow?.remove(); this.meter?.remove(); this.out?.remove(); this.shownHp = this.shownBoost = -1; this.shownOut = ''; this.slots = []; this.rosterKey = ''; this.lastEvent = 0; this.countdown = -1; }
}
