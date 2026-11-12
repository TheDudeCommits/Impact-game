import { SkillAtlas } from './survival/SkillAtlas';
import { bossPortrait } from './survival/bossArt';
import './survival/results.css';
import { resultFighterArt } from './survival/resultArt';
import { FIGHTERS } from '../config';
import type { FighterId } from '../game/types';
import type { InputMode, PadFamily, UiAction } from '../input/gamepad';
import { padKey, padName } from '../input/glyphs';
import { mangaPortrait } from './MangaHome';
import { upgrade, describeNext, stacksOf, type Rarity } from '../survival/upgrades';
import { BRANCHES, SKILL_TREE, TIER_POINTS, TIERS, TREE_NODE, branchPoints, closed, forkOf, keystoneOf, lockOf, maxRank, rankOf, type SkillNode } from '../survival/skillTree';
import { nodeInfo } from '../survival/skillText';
import { RANKS as STYLE_RANKS } from '../survival/style';
import { LOCATIONS, FINAL_ROUND } from '../survival/locations';
import { rankFor } from '../survival/bosses';
import { awakeningOf } from '../survival/signatures';
import { PATH_INFO, PATH_RULES, type PathKind } from '../survival/paths';
import { PathMarks, PATH_MARKS } from './survival/pathMarks';
import { ThreatMarks, THREAT_MARKS } from './survival/threatMarks';
import { Minimap } from './survival/minimap';
import { AllyMarks, ALLY_MARKS } from './survival/allyMarks';
import { glitch, GLITCH_CONTEXT } from './survival/glitch';
import { canFullScreen, enterFullScreen } from './fullScreen';
import { SELF_AURA } from './survival/seats';
import { RiftProfile } from './survival/profile';
import { inFight, mountShop, partyEmote, playerBanner, playerPage, playerStamp, playerTitle, showRunPay, unwearSelf, wearParty, wearSelf } from './shop/boot';
import { BANNER_MARKS, playBanner } from './survival/banners';
import { gameCosmetics } from '../render/cosmetics/index';
import { LIVING_NAMES } from '../render/cosmetics/skins';
import { ENTRANCE_MS } from '../render/cosmetics/pages';
import { bossesHtml, damageHtml, progressHtml } from './survival/runSummary';
import { RelicHud, plain, relicArt, relicBoss } from './survival/relicHud';
import { RELIC_LEAVE, givenOf, relicOf } from '../survival/relics';
import { PLACE_RULES } from '../survival/placeRules';
import { canShareFiles, cardBlob, drawShareCard, shareFile, type ShareCardInput } from './survival/shareCard';
import { carried, settleRun } from '../survival/progressStore';
import { masteryOf, titleAt, type Settled } from '../survival/progress';
import type { BossView, FeedItem, PartyMember, RunResult, RunView } from '../survival/SurvivalGame';

/** Arcade survival's HUD, laid over the combat HUD it shares the fighter's
 *  panel and move cards with. Ink, paper and red, the home screen's lettering
 *  (Electroharmonix) for what the rift announces, italic Impact numerals for
 *  what the fight counts; every string written only when it changes.
 *
 *  Top and centre is the round - its number, its rank, where it is being
 *  fought - with the running event under it, and under that a bar for every
 *  boss and champion standing. A boss's entrance takes the screen for a
 *  moment: a card with its rank, its name, what it is and where it came from. */

const RARITY_LABEL: Record<Rarity, string> = { common: 'COMMON', rare: 'RARE', epic: 'EPIC', legendary: 'LEGENDARY' };
const RECORDS_KEY = 'rift-survival-records';
export interface SurvivalRecord { score: number; wave: number; kills: number; at: number }
export type SurvivalRecords = Partial<Record<FighterId | 'best', SurvivalRecord>>;

export function loadRecords(): SurvivalRecords {
  try { const saved = JSON.parse(localStorage.getItem(RECORDS_KEY) || '{}'); return saved && typeof saved === 'object' ? saved : {}; } catch { return {}; }
}
/** Saves a run's record. `beaten`: it beat one there was - a first run is a
 *  record by default, and NEW HIGH SCORE on a 13-second loss meant nothing. */
function saveRecord(result: RunResult): { fighter: boolean; overall: boolean; beaten: boolean } {
  const records = loadRecords();
  const entry: SurvivalRecord = { score: result.score, wave: result.round, kills: result.kills, at: Date.now() };
  const before = records[result.fighter];
  const fighter = !before || result.score > before.score;
  const overall = !records.best || result.score > records.best.score;
  if (fighter) records[result.fighter] = entry;
  if (overall) records.best = entry;
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch { /* Records are a nicety; the run still counts. */ }
  return { fighter, overall, beaten: fighter && !!before && before.score > 0 };
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const GROUPED = new Intl.NumberFormat('en-US');
const thousands = (n: number) => GROUPED.format(Math.round(n));
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** The kanji an event card carries. */
const EVENT_KANJI: Record<string, string> = { surge: '怒涛', siege: '攻城', eclipse: '蝕', storm: '天災', elites: '強者', hoarder: '宝' };

/** "PRESS 1 · 2 · 3 OR CLICK A CARD", for as many cards as there are. */
const keysHint = (count: number) => `PRESS ${Array.from({ length: Math.max(1, count) }, (_, i) => i + 1).join(' · ')} OR CLICK A CARD`;
/** The draft's line under its cards for the device in use (overnight UX, 9 October 2026: a touch screen read the
 *  keyboard's PRESS 1 · 2 · 3 OR CLICK A CARD). */
export const draftHint = (mode: InputMode, count: number) => mode === 'touch' ? 'TAP A CARD TO TAKE IT' : keysHint(count);

/** The player's full-screen choice: on unless turned off in the pause menu. */
const FULLSCREEN_KEY = 'rift-fullscreen';
const fullScreenWanted = () => { try { return localStorage.getItem(FULLSCREEN_KEY) !== 'off'; } catch { return true; } };

/** Where the eyes are in each boss's entrance portrait, as a share of its height from the
 *  top (the splash page cuts a strip across them; .44 where one is not listed). */
const EYES: Record<string, number> = {
  shiun: .28, caldera: .26, rime: .21, mirabel: .33, barrow: .20, kanuki: .32, oro: .25, 'wuming': .40, 'jinlin': .40, vesper: .33,
  zarek: .29, 'nightfall': .34, gorm: .26, harrow: .34, banjaku: .29, gorai: .26, 'gorai-wyrm': .29, takane: .29, kuromitsu: .55, 'dune-oni': .26,
  ashwing: .40, lumen: .27, kurobi: .57, kade: .34, akagane: .27, imago: .38, gantry: .28, magatsu: .28, nihil: .35, haldor: .22,
};
Object.assign(EYES, { caldera: .34, rime: .38, mirabel: .40, kanuki: .35, zarek: .34, 'nightfall': .37, harrow: .38, takane: .39, kuromitsu: .22,
  'dune-oni': .23, ashwing: .24, lumen: .35, kade: .35, gantry: .37, nihil: .39, oro: .36, shiun: .42, 'wuming': .42, 'jinlin': .40,
  vesper: .42, banjaku: .35, 'gorai-wyrm': .31, gorai: .44, kurobi: .42, akagane: .42, imago: .37, magatsu: .40, haldor: .33, barrow: .28 });

export class SurvivalHud {
  private root: HTMLElement;
  private lastFeed = 0;
  private banners: FeedItem[] = [];
  private bannerUntil = 0;
  private cards: string[] = [];
  private focus = 0;
  private draftKey = '';
  private resultShown = false;
  private scoreShown = 0;
  private inputMode: InputMode = 'keyboard';
  private family: PadFamily = 'generic';
  private openedAt = 0;
  private locationKanji = '';
  /** Where the run is (the view's), for the chapter card a new place opens with. */
  private place?: RunView['location'];
  private chapterUntil = 0;
  private buildKey = '';
  /** Boss cards that arrived while a draft was open: shown when it closes, never over it. */
  private waitingEntrances: FeedItem[] = [];
  private readonly echoes = new Map<string, number>();
  private entranceUntil = 0;
  /** The skill tree: up, which node has the focus, what it was drawn from. */
  private treeUp = false;
  private treeConfirmed = false;
  private treeOpenedAt = 0;
  private treeKey = '';
  private atlas!: SkillAtlas;
  private treeState?: { picks: readonly string[]; points: number; level: number; phase: RunView['phase']; finale: boolean };
  private pointsShown = 0;
  private upHeld = false;
  /** Co-op: the room is paused on someone's skill tree. */
  private partyPaused = false;
  private readonly minimap: Minimap;
  /** Boss relics: the seals, a relic's arrival and its card (survival/relicHud.ts). */
  private readonly relicHud: RelicHud;
  /** What every run so far left behind, and the page of it (opened from the results). */
  private readonly profile: RiftProfile;
  /** The nodes the player bought with shards: open in their tree (progressStore). */
  private unlocked: readonly string[] = [];
  /** The run just shown, for its share card. */
  private shareInput?: ShareCardInput;
  private shareUrl = '';
  /** The fight's own beats on the screen: a signature's name, BREAK IT
   *  while a charge gathers, FINISH IT until when (the run's clock), and the
   *  stamp a finisher or a team ultimate slams down. */
  private sigUntil = 0;
  private breakFor = '';
  private finishUntil = 0;
  private finishFor = '';
  private stampUntil = 0;
  /** LEVEL UP! and TREASURE! wait their turn: one headline at a time in the
   *  middle of the screen (they landed on the portals' names, on FINISHER, on
   *  a boss's card, a signature's name and THE HORDE COMES). A level waits
   *  while any of those is up; one that waits too long is said in the corner. */
  private levels: { text: string; treasure: boolean; at: number }[] = [];
  private levelUpUntil = 0;
  private forksOpen = false;
  onChoose = (_id?: string) => {};
  onRetry = () => {};
  onLeave = () => {};
  /** A boss entrance began: for the camera and the voice. */
  onEntrance = (_item: FeedItem) => {};
  active = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('section');
    this.root.className = 'sv-hud hidden';
    this.root.setAttribute('aria-label', 'Arcade survival');
    this.root.innerHTML = `
      <div class="sv-round"><small id="sv-where">THE BURNING VILLAGE</small><div class="sv-round-row"><strong id="sv-round">ROUND <b id="sv-round-n">1</b></strong><b class="sv-rank-stamp" id="sv-rank-stamp" data-rank="F">F</b></div><span id="sv-horde"></span><em class="sv-path hidden" id="sv-path"></em><i class="sv-rift-track hidden"><i id="sv-rift"></i></i></div>
      <div class="sv-event hidden" id="sv-event"><b id="sv-event-kanji"></b><strong id="sv-event-name"></strong><i class="sv-event-track"><i id="sv-event-left"></i></i></div>
      <div class="sv-bosses" id="sv-bosses"></div>
      <div class="sv-score"><span class="sv-label">SCORE</span><strong id="sv-score">0</strong><div class="sv-sub"><span id="sv-kills">0 KO</span><span id="sv-time">0:00</span></div></div>
      <div class="sv-chain hidden" id="sv-chain" aria-hidden="true"><b id="sv-chain-n">0</b><span>KO CHAIN</span><em id="sv-chain-stamp"></em></div>
      <div class="sv-style" id="sv-style" data-rank="0"><b id="sv-rank">D</b><div><span id="sv-rank-word">DULL</span><i class="sv-rank-track"><i id="sv-rank-bar"></i></i></div><em id="sv-mult">×1.0</em></div>
      <div class="sv-level"><b>LV</b><strong id="sv-level">1</strong><i class="sv-xp-track"><i id="sv-xp"></i></i><button type="button" class="sv-points hidden" id="sv-points"></button></div>
      <div class="sv-build" id="sv-build" aria-label="Your build"></div>
      <div class="sv-banner" id="sv-banner" aria-live="polite"><div class="sv-banner-inner"><span class="sv-banner-kanji" id="sv-banner-kanji"></span><strong id="sv-banner-text"></strong><small id="sv-banner-sub"></small></div></div>
      <svg class="sv-splash-defs" width="0" height="0" aria-hidden="true"><filter id="sv-brush" x="-6%" y="-25%" width="112%" height="150%"><feTurbulence type="fractalNoise" baseFrequency=".02 .075" numOctaves="2" seed="11" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale="9" xChannelSelector="R" yChannelSelector="G"/></filter></svg>
      <div class="sv-entrance hidden" id="sv-entrance" aria-live="assertive"><div class="sv-splash-flash"></div><div class="sv-splash-lines"></div><div class="sv-splash-band top"><b><i></i></b><div class="sv-splash-eyes" id="sv-entrance-art"></div><em class="sv-splash-from" id="sv-entrance-universe"></em></div><span class="sv-entrance-kanji">強敵襲来</span><div class="sv-splash-band bottom"><b><i></i></b><div class="sv-entrance-text"><div class="sv-splash-wipe"><strong id="sv-entrance-name"></strong></div><small id="sv-entrance-epithet"></small></div><div class="sv-entrance-rank"><small>RANK</small><b id="sv-entrance-rank">F</b></div></div></div>
      <div class="sv-entrance sv-end hidden" id="sv-endpage" aria-hidden="true"><div class="sv-splash-flash"></div><div class="sv-splash-lines"></div><div class="sv-splash-band top"><b><i></i></b><div class="sv-splash-eyes" id="sv-end-art"></div><em class="sv-splash-from" id="sv-end-by"></em></div><div class="sv-splash-band bottom"><b><i></i></b><div class="sv-entrance-text"><div class="sv-splash-wipe"><strong id="sv-end-name"></strong></div><small id="sv-end-epithet"></small></div><div class="sv-entrance-rank"><small>RANK</small><b id="sv-end-rank">F</b></div></div></div>
      <div class="sv-pageturn hidden" id="sv-pageturn" aria-hidden="true"><i><b>覚醒</b></i></div>
      <div class="sv-chapter hidden" id="sv-chapter" aria-live="polite"><div class="sv-chapter-panel"><span class="sv-chapter-art"><img id="sv-chapter-art" alt="" draggable="false"></span><span class="sv-chapter-hero" id="sv-chapter-hero"></span><span class="sv-chapter-kanji" id="sv-chapter-kanji"></span><div class="sv-chapter-text"><em id="sv-chapter-number">CHAPTER I</em><strong id="sv-chapter-name"></strong><p id="sv-chapter-line"></p><span class="sv-chapter-rule hidden" id="sv-chapter-rule"><b></b><i></i></span></div></div></div>
      <div class="sv-sig hidden" id="sv-sig" aria-live="polite"><strong id="sv-sig-name"></strong><small id="sv-sig-boss"></small></div>
      <div class="sv-breakit hidden" id="sv-breakit" role="status"><strong>BREAK IT!</strong><small id="sv-breakit-name"></small></div>
      <div class="sv-finish hidden" id="sv-finish" role="status"><strong>FINISH IT!</strong><span class="sv-finish-key" id="sv-finish-key"></span><i class="sv-finish-track"><i id="sv-finish-left"></i></i></div>
      <div class="sv-stamp hidden" id="sv-stamp" aria-live="assertive"><strong id="sv-stamp-text">FINISHER</strong><small id="sv-stamp-sub"></small></div>
      <div class="sv-toasts" id="sv-toasts" aria-hidden="true"></div>
      <div class="sv-levelup hidden" id="sv-levelup" role="status" aria-live="polite"></div>
      <div class="sv-levelup-edge hidden" id="sv-levelup-edge" aria-hidden="true"></div>
      <div class="sv-party hidden" id="sv-party" aria-label="Party"></div>
      <div class="sv-downed sv-joining hidden" id="sv-joining" role="status"><strong>INTO THE RIFT</strong><small>YOU'RE IN WHEN THIS ROUND'S BOSS FALLS</small><em id="sv-joining-points"></em></div>
      <div class="sv-downed hidden" id="sv-downed" role="status"><strong>YOU'RE DOWN</strong><i class="sv-downed-track"><i id="sv-downed-rescue"></i></i><small id="sv-downed-hint">A FRIEND CAN PICK YOU UP — OR HOLD ON UNTIL THE BOSS FALLS</small></div>
      <div class="sv-waiting hidden" id="sv-waiting" role="status"></div>
      <div class="sv-paused hidden" id="sv-paused" role="status"><div class="sv-paused-card"><span class="sv-paused-kanji">待機</span><strong>PARTY PAUSED</strong><p id="sv-paused-who"></p><small id="sv-paused-left"></small><button type="button" class="sv-paused-open" id="sv-paused-open">SPEND MY SKILL POINTS</button></div></div>
      <div class="sv-draft hidden" id="sv-draft" role="dialog" aria-label="Choose an upgrade"><div class="sv-draft-head"><span id="sv-draft-kind">LEVEL UP</span><h2>CHOOSE YOUR POWER</h2><em class="sv-draft-clock" id="sv-draft-clock"></em></div><div class="sv-cards" id="sv-cards"></div><div class="sv-draft-foot"><small class="sv-draft-hint" id="sv-draft-hint">PRESS 1 · 2 · 3 OR CLICK A CARD</small><button type="button" class="sv-reroll" id="sv-reroll">REROLL <b id="sv-reroll-count">1</b> <kbd id="sv-reroll-key">R</kbd></button></div></div>
      <div class="sv-tree hidden" id="sv-tree" role="dialog" aria-label="Skill tree"><div class="sv-dtree">
        <header class="sv-dtree-head"><h2>SKILL TREE</h2><b id="sv-tree-points" class="sv-dtree-points">0 POINTS</b><em class="sv-tree-hint" id="sv-tree-hint"></em><button type="button" class="sv-tree-ready" id="sv-tree-ready">READY</button></header>
        <div class="sv-dtree-body"><div class="sv-tree-branches" id="sv-tree-branches"></div><aside class="sv-dtree-tip" id="sv-tree-foot" aria-live="polite"></aside></div>
      </div></div>
      <div class="sv-results hidden" id="sv-results" role="dialog" aria-modal="true" aria-label="Run results"><div class="sv-results-card">
        <div class="sv-result-spread">
          <aside class="sv-result-cover"><div class="sv-results-art" id="sv-results-art"></div><span class="sv-results-portrait" id="sv-results-portrait"></span><span class="sv-result-issue">ARCADE SURVIVAL <b id="sv-result-chapter"></b></span><div class="sv-result-score"><span>FINAL SCORE</span><strong id="sv-result-score"></strong><b class="sv-record hidden" id="sv-record">NEW RECORD</b></div></aside>
          <div class="sv-result-story"><header class="sv-results-head"><span class="sv-label" id="sv-results-kicker">ARCADE SURVIVAL</span><h2 id="sv-results-title">CHAPTER CLOSED</h2><p id="sv-results-sub"></p><em id="sv-results-epitaph"></em></header>
            <div class="sv-results-grid" id="sv-results-grid"></div>
            <div class="sv-results-summary" id="sv-results-bosses"></div>
            <div class="sv-results-summary" id="sv-results-summary"></div>
            <div class="sv-results-pay hidden" id="sv-results-pay"></div>
            <details class="sv-result-details" id="sv-result-details"><summary>RUN BREAKDOWN <span>+</span></summary><div id="sv-result-extra" class="sv-result-extra"></div><div id="sv-result-damage"></div><div class="sv-results-picks" id="sv-results-picks"></div></details>
          </div>
        </div>
        <div class="sv-results-actions"><button type="button" id="sv-retry" class="primary-button">PLAY AGAIN <span>↻</span></button><button type="button" data-results="change" class="secondary-button sv-small">CHANGE MODE</button><button type="button" data-results="training" class="secondary-button sv-small">TRAINING</button><button type="button" id="sv-share" class="secondary-button sv-small">SHARE CARD <span>⇪</span></button><button type="button" id="sv-profile-open" class="secondary-button sv-small">RIFT PROFILE <span>◆</span></button><button type="button" id="sv-leave" class="secondary-button sv-small">HOME</button></div>
      </div>
      <div class="sv-sharebox hidden" id="sv-sharebox" role="dialog" aria-label="Share card"><div class="sv-sharebox-card"><img id="sv-share-img" alt="The run's share card"><div class="sv-sharebox-actions"><a id="sv-share-save" class="primary-button" download="arcade-survival.png" href="#">SAVE PICTURE <span>↓</span></a><button type="button" id="sv-share-send" class="secondary-button">SHARE <span>⇪</span></button><button type="button" id="sv-share-close" class="secondary-button">CLOSE <span>✕</span></button></div></div></div></div>`;
    parent.append(this.root);
    this.minimap = new Minimap(this.root);
    this.relicHud = new RelicHud(this.root);
    // A signature is named in the bars' own column, under the last of them.
    this.root.querySelector('#sv-bosses')!.append(this.root.querySelector('#sv-sig')!);
    ALLY_MARKS.current = new AllyMarks(this.root);
    PATH_MARKS.current = new PathMarks(this.root);
    THREAT_MARKS.current = new ThreatMarks(this.root);
    this.clarifyCallouts(parent);
    this.root.querySelector<HTMLButtonElement>('#sv-retry')!.onclick = () => this.onRetry();
    this.root.querySelector<HTMLButtonElement>('#sv-reroll')!.onclick = () => this.reroll();
    this.root.querySelector<HTMLButtonElement>('#sv-leave')!.onclick = () => this.onLeave();
    this.profile = new RiftProfile(this.root);
    // The account, the shop and what a fight pays start with the game's interface (src/ui/shop/boot.ts).
    mountShop();
    this.profile.onAura = (fighter, colour) => { if (fighter === this.root.dataset.fighter) SELF_AURA.colour = colour; };
    this.profile.onClose = () => this.root.querySelector<HTMLButtonElement>('#sv-profile-open')?.focus();
    this.root.querySelector<HTMLButtonElement>('#sv-profile-open')!.onclick = () => this.profile.show(this.root.dataset.fighter as FighterId | undefined);
    this.root.querySelector<HTMLElement>('#sv-results')!.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const items=[...this.root.querySelectorAll<HTMLElement>('#sv-results summary, .sv-results-actions button:not(:disabled)')],first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
    this.root.querySelector<HTMLButtonElement>('#sv-share')!.onclick = () => void this.openShare();
    this.root.querySelector<HTMLButtonElement>('#sv-share-close')!.onclick = () => this.closeShare();
    this.root.querySelector<HTMLButtonElement>('#sv-share-send')!.onclick = () => void this.sendShare();
    // The profile and the share card close on Escape before the settings see it.
    window.addEventListener('keydown', event => {
      if (!this.active || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const share = this.shareOpen;
      if (!this.profile.open && !share) return;
      if (event.code === 'Escape') { if (share) this.closeShare(); else this.profile.close(); }
      else if (this.profile.open && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) this.profile.turn(event.code === 'ArrowRight' ? 1 : -1);
      else return;
      event.preventDefault(); event.stopImmediatePropagation();
    }, true);
    // The skill tree: T (or the pad's share button) opens and closes it; while
    // it is open, arrows move, Enter or Space spends a point, Escape closes it
    // (before the settings see the key).
    window.addEventListener('keydown', event => {
      if (!this.active || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      // (Not over the run's results: the tree cannot open there, and T is the results card's TRAINING - R1, 12 October 2026.)
      if (event.code === 'KeyT' && !typing && !this.resultsOpen) {
        if (this.treeShown) this.closeTree(); else this.openTree();
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (!this.treeShown || typing && event.code !== 'Escape' || event.ctrlKey || event.metaKey || event.altKey) return;
      const move: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };
      if (move[event.code]) this.moveTree(...move[event.code]);
      else if ((event.code === 'Enter' || event.code === 'Space') && (!(event.target as HTMLElement)?.closest('button,input') || !!(event.target as HTMLElement)?.closest('.atlas-node'))) this.learnFocused();
      else if (event.code === 'KeyR') this.atlas.refund();
      else if (event.code === 'Escape') this.closeTree();
      else return;
      event.preventDefault(); event.stopImmediatePropagation();
    }, true);
    this.atlas = new SkillAtlas(this.root.querySelector<HTMLElement>('#sv-tree')!, id => this.onChoose(id));
    this.root.querySelector<HTMLButtonElement>('#sv-points')!.onclick = () => this.openTree();
    this.root.querySelector<HTMLButtonElement>('#sv-tree-ready')!.onclick = () => this.closeTree();
    this.root.querySelector<HTMLButtonElement>('#sv-paused-open')!.onclick = () => this.openTree();
    window.addEventListener('keydown', event => {
      if (!this.draftOpen || this.treeShown || event.repeat) return;
      // (A relic's question has four: 4 leaves it.)
      const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'].indexOf(event.code) % 4;
      if (index >= 0 && this.cards[index]) { event.preventDefault(); this.take(index); }
      if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') { this.move(event.code === 'ArrowRight' ? 1 : -1); event.preventDefault(); }
      if (event.code === 'Enter') { this.take(this.focus); event.preventDefault(); }
      if (event.code === 'KeyR') { this.reroll(); event.preventDefault(); }
    });
  }

  get draftOpen() { return !this.root.querySelector('#sv-draft')!.classList.contains('hidden') || this.treeShown || this.partyPaused; }
  get resultsOpen() { return !this.root.querySelector('#sv-results')!.classList.contains('hidden'); }
  /** While a boss's card holds the screen. */
  get entranceOpen() { return performance.now() < this.entranceUntil; }

  enter(fighter: FighterId) {
    this.fullscreen(true);
    this.active = true; this.lastFeed = 0; this.banners = []; this.bannerUntil = 0; this.resultShown = false; this.scoreShown = 0; this.draftKey = '';
    this.entranceUntil = 0; this.echoes.clear(); document.documentElement.classList.remove('rift-splash');
    this.arrived = false; this.mine?.remove(); this.mine = undefined;
    this.root.classList.remove('hidden');
    for (const id of ['#sv-draft', '#sv-results', '#sv-entrance', '#sv-endpage', '#sv-pageturn', '#sv-event', '#sv-party', '#sv-downed', '#sv-joining', '#sv-waiting', '#sv-chapter']) this.root.querySelector(id)!.classList.add('hidden');
    this.chapterUntil = 0; this.levels = []; this.levelUpUntil = 0; this.forksOpen = false; this.waitingEntrances = []; this.buildKey = ''; this.chainBest = 0;
    this.sigUntil = 0; this.breakFor = ''; this.finishUntil = 0; this.finishFor = ''; this.stampUntil = 0;
    for (const id of ['#sv-sig', '#sv-breakit', '#sv-finish', '#sv-stamp']) this.root.querySelector(id)!.classList.add('hidden');
    this.atlas.close(); this.treeUp = false; this.treeKey = ''; this.treeState = undefined; this.pointsShown = 0; this.root.querySelector('#sv-tree')!.classList.add('hidden');
    this.root.querySelector('#sv-toasts')!.replaceChildren();
    this.relicHud.reset();
    window.setTimeout(() => this.lookHints(), 0);
    this.root.querySelectorAll('#sv-bosses .sv-bossbar').forEach(bar => bar.remove());
    this.root.dataset.fighter = fighter;
    // What the player's progress brings: the frame's aura, the nodes bought.
    const carry = carried(fighter);
    SELF_AURA.colour = carry.aura; this.unlocked = carry.unlocked;
    if (this.profile.open) this.profile.close();
    this.closeShare();
    this.partyKey = '';
    const retry = this.root.querySelector<HTMLButtonElement>('#sv-retry')!;
    retry.disabled = false; retry.innerHTML = 'PLAY AGAIN <span>↻</span>';
  }
  leave() { this.atlas.close(); this.dropLookHints(); THREAT_MARKS.current?.clear(); unwearSelf(); this.mine?.remove(); this.fullScreenSetting(false); this.active = false; this.minimap.hide(); ALLY_MARKS.current?.clear(); PATH_MARKS.current?.clear(); this.treeUp = false; this.root.querySelector('#sv-tree')!.classList.add('hidden'); this.root.classList.add('hidden'); this.root.querySelector('#sv-toasts')!.replaceChildren(); delete document.body.dataset.svLearned; }

  /** Into full screen as the run starts, unless the player turned it off; a
   *  browser that wants a click for it first gets it from the next one. Esc
   *  stays the pause menu inside it (held, it leaves full screen, as the
   *  browser says). */
  private fullscreen(wanted: boolean) {
    this.fullScreenSetting(true);
    if (!wanted || !fullScreenWanted() || !canFullScreen() || document.fullscreenElement) return;
    const go = () => {
      if (document.fullscreenElement || !this.active && !wanted) return;
      void enterFullScreen().catch(() => {
        // No activation to spend: the next click or key into the fight brings it.
        const once = () => { removeEventListener('pointerdown', once, true); removeEventListener('keydown', once, true); if (this.active && fullScreenWanted() && !document.fullscreenElement) go(); };
        addEventListener('pointerdown', once, true); addEventListener('keydown', once, true);
      });
    };
    go();
  }
  /** A FULL SCREEN switch in the pause menu while a run is on. */
  private fullScreenSetting(show: boolean) {
    const card = document.querySelector<HTMLElement>('.settings-card');
    let row = document.querySelector<HTMLLabelElement>('#sv-fullscreen-setting');
    if (!show) { row?.remove(); return; }
    // (No switch where the browser has no full screen: iPhone Safari.)
    if (!card || row || !canFullScreen()) return;
    row = document.createElement('label');
    row.id = 'sv-fullscreen-setting';
    row.innerHTML = 'FULL SCREEN<input type="checkbox">';
    const box = row.querySelector('input')!;
    box.checked = fullScreenWanted();
    box.onchange = () => {
      try { localStorage.setItem(FULLSCREEN_KEY, box.checked ? 'on' : 'off'); } catch { /* the choice holds for this session */ }
      if (box.checked && !document.fullscreenElement) void enterFullScreen().catch(() => {});
      else if (!box.checked && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
    document.addEventListener('fullscreenchange', () => { box.checked = !!document.fullscreenElement || (fullScreenWanted() && box.checked); });
    card.insertBefore(row, card.querySelector('.key-guide'));
  }

  setInputMode(mode: InputMode, family: PadFamily) {
    this.inputMode = mode; this.family = family; this.root.dataset.input = mode;
    window.setTimeout(() => this.lookHints(), 0);
    const hint = this.root.querySelector('#sv-draft-hint')!;
    hint.innerHTML = mode === 'controller' ? `${padKey(family, 'dpad')} CHOOSE · ${padKey(family, 'south')} TAKE` : draftHint(mode, this.cards.length || 3);
    const rerollKey = this.root.querySelector<HTMLElement>('#sv-reroll-key')!;
    rerollKey.textContent = mode === 'controller' ? padName(family, 'north') : 'R';
    rerollKey.className = mode === 'controller' && family === 'playstation' ? 'ps-face ps-north' : '';
    this.root.querySelectorAll<HTMLElement>('.sv-card kbd').forEach((kbd, i) => this.cardKey(kbd, i));
    this.treeHint();
    this.pointsShown = -1;
  }
  /** The run's own view keys on the main HUD's key strip and in the pause menu's guide
   *  (shared ViewKeys: O/P turn, I looks at the target, U turns round; Tab switches and hold releases). */
  private lookHints() {
    if (!this.active || this.inputMode === 'controller') return;
    const strip = document.querySelector('#controls-hint');
    if (strip && !strip.querySelector('.sv-look-hint')) {
      const look = document.createElement('span'); look.className = 'control-item sv-look-hint'; look.innerHTML = '<kbd>O</kbd><kbd>P</kbd> TURN';
      const behind = document.createElement('span'); behind.className = 'control-item sv-look-hint'; behind.innerHTML = '<kbd>I</kbd> LOOK · <kbd>U</kbd> ROUND';
      strip.querySelector('.control-item:last-child')?.before(look, behind);
    }
    const guide = document.querySelector<HTMLElement>('.secondary-keys [data-key="MOUSE"]');
    if (guide && !guide.dataset.rift) { guide.dataset.rift = '1'; guide.textContent = 'MOUSE · O P / RS'; guide.parentElement!.lastChild!.textContent = ' Camera · I look at target · U turn round · Tab switches · hold Tab releases'; }
  }
  private dropLookHints() {
    document.querySelectorAll('.sv-look-hint').forEach(el => el.remove());
    const guide = document.querySelector<HTMLElement>('.secondary-keys [data-key="MOUSE"]');
    if (guide?.dataset.rift) { delete guide.dataset.rift; guide.textContent = 'MOUSE / RS'; guide.parentElement!.lastChild!.textContent = ' Camera'; }
  }
  private treeHint() {
    this.root.querySelector('#sv-tree-hint')!.innerHTML = this.inputMode === 'controller'
      ? `${padKey(this.family, 'dpad')} MOVE · ${padKey(this.family, 'south')} LEARN · ${padKey(this.family, 'north')} REFUND · ${padKey(this.family, 'east')} READY`
      : '<kbd>↑↓←→</kbd> MOVE · <kbd>ENTER</kbd> LEARN · <kbd>R</kbd> REFUND · <kbd>T</kbd> RESUME';
  }
  private cardKey(kbd: HTMLElement, index: number) {
    const pad = this.inputMode === 'controller';
    kbd.textContent = pad ? padName(this.family, 'south') : String(index + 1);
    kbd.className = pad && this.family === 'playstation' ? 'ps-face ps-south' : '';
  }

  controller(action: UiAction) {
    const settling = performance.now() - this.openedAt;
    if (this.partyPaused && !this.treeShown) {
      if (action === 'confirm' && (this.treeState?.points ?? 0) > 0) this.openTree();
      return true;
    }
    if (this.treeShown) {
      if (action === 'left') this.moveTree(-1, 0);
      else if (action === 'right') this.moveTree(1, 0);
      else if (action === 'previous') this.moveTree(0, -1);
      else if (action === 'next') this.moveTree(0, 1);
      else if (action === 'confirm') this.learnFocused();
      else if (action === 'extra') this.atlas.refund();
      else if (action === 'back') this.closeTree();
      return true;
    }
    if (this.draftOpen) {
      if (action === 'left' || action === 'previous') this.move(-1);
      else if (action === 'right' || action === 'next') this.move(1);
      else if (action === 'confirm' && settling > 550) this.take(this.focus);
      else if (action === 'extra' && settling > 550) this.reroll();
      return true;
    }
    if (this.shareOpen) {
      const buttons = [...this.root.querySelectorAll<HTMLElement>('.sv-sharebox-actions > *')].filter(el => !(el as HTMLButtonElement).disabled && !el.classList.contains('hidden'));
      const at = buttons.indexOf(document.activeElement as HTMLElement);
      if (action === 'left' || action === 'right' || action === 'next' || action === 'previous') buttons[at < 0 ? 0 : (at + (action === 'left' || action === 'previous' ? buttons.length - 1 : 1)) % buttons.length]?.focus();
      else if (action === 'confirm') { if (at < 0) buttons[0]?.focus(); else buttons[at].click(); }
      else if (action === 'back') this.closeShare();
      return true;
    }
    if (this.profile.open) {
      if (action === 'left' || action === 'right') this.profile.step(action === 'right' ? 1 : -1);
      else if (action === 'previous' || action === 'next') this.profile.turn(action === 'next' ? 1 : -1);
      else if (action === 'confirm') this.profile.press();
      else if (action === 'back' || action === 'extra') this.profile.close();
      return true;
    }
    if (this.resultsOpen) {
      const buttons = [...this.root.querySelectorAll<HTMLElement>('.sv-results-actions button, #sv-result-details summary')].filter(button => !(button as HTMLButtonElement).disabled);
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (action === 'left' || action === 'right' || action === 'next' || action === 'previous') buttons[at < 0 ? 0 : (at + (action === 'left' || action === 'previous' ? -1 : 1) + buttons.length) % buttons.length].focus();
      else if (action === 'confirm' && settling > 900) { if (at < 0) buttons[0]?.focus(); else buttons[at].click(); }
      // B is HOME, as on every results card (and as Escape and the pad's menu button are here: HomeShell.back).
      else if (action === 'back' && settling > 900) this.root.querySelector<HTMLButtonElement>('#sv-leave')?.click();
      return true;
    }
    return false;
  }

  /** A fresh hand of cards, while the fighter has a reroll left. */
  onReroll: () => void = () => {};
  private rerolls = 0;
  private reroll() {
    if (!this.draftOpen || this.rerolls <= 0 || !this.cards.length) return;
    this.root.querySelectorAll<HTMLElement>('.sv-card').forEach(card => card.classList.add('rerolled'));
    this.rerolls--; this.cards = [];
    window.setTimeout(() => this.onReroll(), 160);
  }

  private move(step: number) {
    if (!this.cards.length) return;
    this.focus = (this.focus + step + this.cards.length) % this.cards.length;
    this.root.querySelectorAll<HTMLElement>('.sv-card').forEach((card, i) => card.classList.toggle('focused', i === this.focus));
  }
  private take(index: number) {
    const id = this.cards[index];
    if (!id) return;
    this.root.querySelectorAll<HTMLElement>('.sv-card').forEach((card, i) => card.classList.toggle('taken', i === index));
    this.cards = [];
    window.setTimeout(() => this.onChoose(id), 180);
  }

  /** The entrance cards' portraits for the bosses the run can send next,
   *  fetched and decoded ahead: loaded as the card opened, each one's decode
   *  landed on the frame the boss arrived. */
  private readonly portraits = new Map<string, HTMLImageElement>();
  private warmPortraits(ids: readonly string[] | undefined) {
    for (const id of ids ?? []) {
      if (this.portraits.has(id)) continue;
      const img = new Image();
      img.decoding = 'async'; img.src = bossPortrait(id);
      img.decode().catch(() => {});
      this.portraits.set(id, img);
    }
  }

  update(view: RunView, fighter: FighterId) {
    GLITCH_CONTEXT.round = view.round; GLITCH_CONTEXT.stage = view.location?.stage; GLITCH_CONTEXT.boss = view.bosses.map(boss => boss.enemy).join(',') || undefined;
    // What the player wears is put on them (src/ui/shop/boot.ts, render/cosmetics).
    if (view.party[0]) { wearSelf(view.party[0].id, view.party[0].fighter); inFight(); if (view.party.length > 1) wearParty(view.party); }
    try { this.frame(view, fighter); } catch (error) { glitch(error, 'hud'); }
  }
  private frame(view: RunView, fighter: FighterId) {
    this.hero = fighter;
    this.warmPortraits(view.upcoming);
    // The controls strip has said its piece by round three: it stood over the
    // bottom-left corner, where the fighter often is, thirteen minutes in.
    const learned = view.round >= 3 || view.loop > 0;
    if (learned !== ('svLearned' in document.body.dataset)) { if (learned) document.body.dataset.svLearned = ''; else delete document.body.dataset.svLearned; }
    this.locationKanji = view.location.kanji;
    this.place = view.location;
    this.text('sv-where', `${view.location.name.toUpperCase()}${view.loop ? ` · THE RIFT ${view.loop}` : ''}`);
    // Arriving somewhere, the round on the way is the one to show.
    // (The run's own count, not the view's round plus one: the first intro, before round one, read ROUND 2.)
    const coming = view.coming ?? (view.phase === 'intro' || view.phase === 'travel' ? view.round + 1 : undefined);
    this.text('sv-round-n', String(coming ?? view.round));
    // ...and its rank with it (the stamp read A over "ROUND 13", the first S).
    const shownRank = coming ? rankFor(coming) : view.rank;
    const stamp = this.root.querySelector<HTMLElement>('#sv-rank-stamp')!, rank = view.loop ? 'RIFT' : shownRank;
    if (stamp.dataset.rank !== rank) { stamp.dataset.rank = rank; stamp.textContent = view.loop ? '∞' : shownRank; stamp.classList.remove('stamped'); void stamp.offsetWidth; stamp.classList.add('stamped'); }
    // A dungeon's horde fills the rift's bar; at full its guardian comes.
    const rift = view.roundState === 'horde' ? view.dungeon?.progress : undefined;
    this.text('sv-horde', view.held ? 'THE RIFT IS SEALED' : view.forks?.length ? `THE ROAD FORKS · ${Math.ceil(view.forkLeft ?? 0)}s` : view.phase === 'fight' || view.phase === 'draft' ? (view.roundState === 'interlude' ? 'THE RIFT STIRS…'
      : rift !== undefined ? (view.path === 'ward' ? `HOLD THE WARD · ${Math.floor(rift * 100)}%` : view.path === 'night' ? `SURVIVE · ${Math.max(0, Math.ceil((1 - rift) * PATH_RULES.nightSeconds))}s` : `THE HORDE · ${Math.floor(rift * 100)}%`) : view.bosses.some(boss => !boss.champion) ? 'THE GUARDIAN' : `${view.horde} IN THE HORDE`) : view.phase === 'intro' ? 'INCOMING' : view.phase === 'travel' ? 'TELEPORTING…' : '');
    this.root.querySelector('.sv-rift-track')!.classList.toggle('hidden', rift === undefined);
    // The path this round was reached by (or the one taken for the next), on the plaque.
    const path = view.phase === 'travel' || view.phase === 'intro' ? view.pathNext : view.path;
    const tag = this.root.querySelector<HTMLElement>('#sv-path')!;
    tag.classList.toggle('hidden', !path);
    if (path && tag.dataset.kind !== path) { tag.dataset.kind = path; tag.textContent = PATH_INFO[path].name; tag.style.setProperty('--c', `#${PATH_INFO[path].color.toString(16).padStart(6, '0')}`); }
    if (rift !== undefined) this.fill('sv-rift', rift);
    this.scoreShown += (view.score - this.scoreShown) * .18;
    if (Math.abs(view.score - this.scoreShown) < 1) this.scoreShown = view.score;
    this.text('sv-score', thousands(this.scoreShown));
    this.text('sv-kills', `${view.kills} KO`);
    // (The fighter's own chain: in a party, theirs, not everyone's.)
    this.chain(view.party[0] ? view.party[0].kills ?? 0 : view.kills);
    this.livingInk(view.party[0]?.id);
    this.text('sv-time', clock(view.time));
    const style = this.root.querySelector<HTMLElement>('#sv-style')!;
    if (style.dataset.rank !== String(view.style.rank)) { style.dataset.rank = String(view.style.rank); style.classList.remove('rank-up'); void style.offsetWidth; style.classList.add('rank-up'); }
    this.text('sv-rank', view.style.letter); this.text('sv-rank-word', view.style.word); this.text('sv-mult', `×${view.style.multiplier.toFixed(1)}`);
    this.fill('sv-rank-bar', view.style.fill);
    this.text('sv-level', String(view.level)); this.fill('sv-xp', view.xp / view.xpNext);
    this.points(view);
    this.event(view);
    this.bosses(view.bosses);
    this.beats(view);
    this.build(view.picks);
    // A relic's stamp waits its turn in the middle: after DEFEATED, the finisher's page and a LEVEL UP.
    const at = performance.now();
    this.relicHud.update(view, !this.entranceOpen && at >= this.chapterUntil && at >= this.stampUntil && this.finishUntil <= 0 && !this.breakFor && !this.draftOpen && at >= this.levelUpUntil && !this.defeatUp());
    this.forksOpen = !!view.forks?.length;
    for (const item of view.feed) if (item.id > this.lastFeed) { this.lastFeed = item.id; this.feed(item, view.party[0]?.id); }
    this.banner();
    this.levelTurn();
    this.party(view.party);
    if (this.resultsOpen || view.phase === 'over') this.minimap.hide(); else this.minimap.update(view, performance.now() / 1000);
    this.treeState = { picks: view.picks, points: view.points, level: view.level, phase: view.phase, finale: !!view.draft?.finale };
    this.upPad();
    this.pausedFor(view);
    if (this.treeUp) {
      if (view.treeOpen) this.treeConfirmed = true;
      // The run ended, or the seal asks its question, under it: that has the screen.
      // A server tree timeout must also reveal the resumed fight. Allow the
      // initial request to reach the server before interpreting a closed frame.
      if (view.phase === 'over' || view.draft || !view.treeOpen && (this.treeConfirmed || performance.now()-this.treeOpenedAt>5000)) this.closeTree();
      else this.drawTree();
    }
    this.draft(view);
    if (this.waitingEntrances.length && !this.draftOpen && !this.entranceOpen && !this.defeatUp()) this.entrance(this.waitingEntrances.shift()!);
    this.root.classList.toggle('modal', this.draftOpen || this.resultsOpen);
    this.waiting(view);
    if (view.result && view.phase === 'over' && view.timeScale >= 1 && !this.resultShown) this.results(view.result, fighter, view.host);
    if (this.resultShown && view.host !== undefined) this.retryFor(view.host);
  }

  /** The running event: its name, its kanji and how long it has left. */
  private event(view: RunView) {
    const panel = this.root.querySelector<HTMLElement>('#sv-event')!;
    panel.classList.toggle('hidden', !view.event);
    if (!view.event) return;
    panel.dataset.kind = view.event.kind;
    this.text('sv-event-name', view.event.name);
    this.text('sv-event-kanji', EVENT_KANJI[view.event.kind] ?? '');
    this.fill('sv-event-left', view.event.left / view.event.total);
  }

  /** A bar for every boss and champion standing, in the order they came. */
  private bosses(all: readonly BossView[]) {
    const box = this.root.querySelector<HTMLElement>('#sv-bosses')!;
    // A fallen boss's bar goes as it falls (an empty one stayed up into the
    // lull, and a transforming boss's two forms stood stacked).
    // (A copy of a boss has no bar: which of them is real is the question.)
    const bosses = all.filter(boss => boss.hp > 0 && !boss.illusion);
    const alive = new Set(bosses.map(boss => boss.id));
    for (const bar of [...box.querySelectorAll<HTMLElement>('.sv-bossbar')]) if (!alive.has(bar.dataset.id!)) { bar.classList.add('gone'); window.setTimeout(() => bar.remove(), 700); this.echoes.delete(bar.dataset.id!); bar.dataset.id = ''; }
    for (const boss of bosses) {
      let bar = box.querySelector<HTMLElement>(`.sv-bossbar[data-id="${boss.id}"]`);
      if (!bar) {
        bar = document.createElement('div');
        bar.className = `sv-bossbar${boss.champion ? ' champion' : ''}`; bar.dataset.id = boss.id; bar.dataset.rank = boss.rank ?? 'F';
        bar.innerHTML = `<b class="sv-bossbar-rank">${esc(boss.rank ?? '')}</b><div class="sv-bossbar-body"><div class="sv-bossbar-name"><strong>${esc(boss.name.toUpperCase())}</strong><small>${esc((boss.title ?? '').toUpperCase())}</small></div><i class="sv-bossbar-track"><i class="sv-bossbar-echo"></i><i class="sv-bossbar-hp"></i></i><i class="sv-bossbar-poise"><i></i></i><i class="sv-bossbar-break"><i></i></i></div>`;
        box.insertBefore(bar, box.querySelector('#sv-sig'));
      }
      const share = Math.max(0, boss.hp / boss.maxHp);
      let echo = this.echoes.get(boss.id) ?? 1;
      echo += (share - echo) * .07; if (share > echo) echo = share;
      this.echoes.set(boss.id, echo);
      (bar.querySelector('.sv-bossbar-hp') as HTMLElement).style.transform = `scaleX(${share})`;
      (bar.querySelector('.sv-bossbar-echo') as HTMLElement).style.transform = `scaleX(${echo})`;
      (bar.querySelector('.sv-bossbar-poise > i') as HTMLElement).style.transform = `scaleX(${Math.max(0, Math.min(1, boss.poise ?? 0))})`;
      bar.classList.toggle('broken', boss.poise !== undefined && boss.poise <= 0);
      bar.classList.toggle('enraged', boss.phase > 0);
      // Awakened: its form's name where its title was, its aura's colour round the bar.
      if (boss.form && !bar.classList.contains('awakened')) {
        bar.classList.add('awakened');
        const form = awakeningOf(boss.enemy, 0xff2038);
        bar.style.setProperty('--aura', `#${form.aura[1].toString(16).padStart(6, '0')}`);
        bar.style.setProperty('--aura-core', `#${form.aura[0].toString(16).padStart(6, '0')}`);
        bar.querySelector('.sv-bossbar-name small')!.textContent = `AWAKENED · ${boss.form}`;
      }
      bar.classList.toggle('brink', boss.brink !== undefined);
      bar.classList.toggle('charging', boss.charge !== undefined);
      if (boss.charge !== undefined) (bar.querySelector('.sv-bossbar-break > i') as HTMLElement).style.transform = `scaleX(${Math.max(0, Math.min(1, boss.charge))})`;
    }
  }

  private partyKey = '';
  private heroCount = 1;
  /** The party as the last frame had it (whose emote is whose). */
  private lastParty: readonly PartyMember[] = [];
  private party(members: readonly PartyMember[]) {
    this.lastParty = members;
    this.heroCount = members.length;
    const panel = this.root.querySelector<HTMLElement>('#sv-party')!;
    const allies = members.slice(1);
    panel.classList.toggle('hidden', !allies.length);
    const self = members[0];
    this.root.querySelector('#sv-downed')!.classList.toggle('hidden', !self?.down || members.length < 2);
    if (self?.down) this.fill('sv-downed-rescue', self.rescue);
    // Dropped in mid-round: waiting in a rift, with points to spend meanwhile.
    this.root.querySelector('#sv-joining')!.classList.toggle('hidden', !self?.joining || this.treeUp);
    if (self?.joining) {
      const points = this.treeState?.points ?? 0, key = this.inputMode === 'controller' ? 'D-PAD ↑' : 'T';
      this.text('sv-joining-points', points > 0 ? `${points} SKILL POINT${points === 1 ? '' : 'S'} TO SPEND · PRESS ${key}` : '');
    }
    if (!allies.length) return;
    const key = allies.map(ally => `${ally.id}:${ally.fighter}:${ally.name}`).join('|');
    if (key !== this.partyKey) {
      this.partyKey = key;
      panel.replaceChildren(...allies.map(ally => {
        const card = document.createElement('div');
        card.className = 'sv-ally'; card.dataset.id = ally.id;
        card.innerHTML = `<span class="sv-ally-face">${mangaPortrait(ally.fighter)}</span><div><strong></strong><i class="sv-ally-track"><i class="sv-ally-hp"></i></i><small></small></div>`;
        card.querySelector('strong')!.textContent = ally.name.toUpperCase();
        return card;
      }));
    }
    for (const ally of allies) {
      const card = panel.querySelector<HTMLElement>(`.sv-ally[data-id="${ally.id}"]`);
      if (!card) continue;
      card.classList.toggle('down', ally.down);
      (card.querySelector('.sv-ally-hp') as HTMLElement).style.transform = `scaleX(${Math.max(0, Math.min(1, ally.down ? ally.rescue : ally.hp / ally.maxHp))})`;
      const state = ally.down ? (ally.rescue > 0 ? `REVIVING ${Math.round(ally.rescue * 100)}%` : 'DOWN — STAND OVER THEM') : FIGHTERS[ally.fighter].name.toUpperCase();
      const small = card.querySelector('small')!;
      if (small.textContent !== state) small.textContent = state;
    }
  }

  private waiting(view: RunView) {
    const el = this.root.querySelector<HTMLElement>('#sv-waiting')!;
    let text = '';
    if (view.phase === 'draft' && !view.draft && view.choosing && !(view.upgrading?.length)) text = `WAITING FOR ${view.choosing} ${view.choosing === 1 ? 'FIGHTER' : 'FIGHTERS'} TO CHOOSE${view.draftLeft !== undefined ? ` · ${Math.ceil(view.draftLeft)}s` : ''}`;
    else if (view.phase === 'travel' && view.loading) text = `THE PARTY GATHERS · ${view.loading} STILL LOADING`;
    el.classList.toggle('hidden', !text);
    if (el.textContent !== text) el.textContent = text;
    this.text('sv-draft-clock', view.draft && view.draftLeft !== undefined ? `${Math.ceil(view.draftLeft)}s` : '');
  }

  private feed(item: FeedItem, self?: string) {
    this.relicHud.feed(item, self);
    switch (item.kind) {
      case 'relic': if (item.sub === 'left' && (!item.hero || item.hero === self)) this.toast(`LEFT BEHIND · ${plain(relicOf(item.text)?.name ?? '')}`, 'learn'); break;
      case 'fallen': if (item.hero !== self) this.toast(`${item.text} — HELP THEM UP`, 'fallen'); break;
      case 'rescued': this.toast(item.text ?? 'REVIVED', 'heal'); break;
      case 'regroup': this.toast(item.text ?? 'BACK IN THE FIGHT', 'heal'); break;
      case 'location': this.arrive(item); break;
      case 'emote': if (item.hero) partyEmote(item.hero, item.value, this.lastParty.find(member => member.id === item.hero)); break;
      case 'finale': this.finale(item); break;
      // (A round is not bannered: the top of the screen counts it, the boss's
      // card announces it, and queued behind other headlines ROUND N landed on
      // the boss's head as it stepped out.)
      case 'round': break;
      // (A boss finished has its stamp: its DEFEATED would land on top of it.)
      case 'down': if (item.boss) this.closeFinish(); if (item.boss && performance.now() < this.stampUntil) break; this.banners.push(item); break;
      case 'event': case 'revive': case 'hunt': case 'lair': this.banners.push(item); break;
      // (The count is the round plaque's, against the packs the lair waits on:
      // a toast's "1 / 4" beside its "1 / 3" read as two different hunts.)
      case 'pack': this.toast(item.text ?? 'PACK SLAIN', item.text?.startsWith('ELITE') ? 'level' : 'bonus'); break;
      case 'elite': this.toast(item.text ?? 'ELITE', `elite affix-${item.value ?? 0}`); break;
      // Half its health gone, the boss stops holding back: said, big.
      // (From C up the sky comes down with it; an S boss has a last stand at a quarter.)
      // Its awakening, as a fighter's is: the form's name, said big.
      case 'enraged': if (item.value === 3) { this.pageTurn(item.enemy); this.banners.unshift({ ...item, text: `${item.sub ?? ''} AWAKENS`, sub: `${item.text ?? ''} · STRONGER · FASTER · ITS SIGNATURE UNLEASHED` }); this.bannerUntil = 0; break; }
        this.banners.unshift({ ...item, text: `${item.sub ?? ''} — ${item.text ?? 'ENRAGED'}`,
        sub: item.value === 2 ? 'ITS LAST STAND · THE SKY FALLS · THE ARMY RETURNS' : item.rank === 'S' || item.rank === 'A' ? 'A SECOND WIND · THE SKY FALLS · THE ARMY RETURNS'
          : item.rank === 'B' || item.rank === 'C' ? 'HALF THE HEALTH GONE · THE SKY FALLS' : 'HALF THE HEALTH GONE · NO MORE HOLDING BACK' }); this.bannerUntil = 0; break;
      // One headline at a time: a card waits for a draft, and for a DEFEATED to clear.
      case 'boss': if (this.draftOpen || this.defeatUp()) this.waitingEntrances.push(item); else this.entrance(item); break;
      case 'event-end': this.toast(`${item.text ?? 'EVENT'} — ${item.sub ?? 'SURVIVED'}`, 'bonus'); break;
      case 'rout': this.toast(`THE HORDE BREAKS · ${item.value ?? 0} ROUTED`, 'bonus'); break;
      // A level is a skill point for every fighter, said in the corner (a
      // stamp mid-screen and three cards over the fight were "too distracting").
      // (Not over a finisher's stamp: it waits for it.)
      case 'level': if (!item.hero || item.hero === self) this.queueLevel(item.text ?? 'LEVEL UP', false); else this.toast(`${item.text ?? 'LEVEL UP'} · SKILL POINT`, 'level'); break;
      case 'learn': if (!item.hero || item.hero === self) this.toast(item.text ?? '', 'learn'); break;
      case 'bonus': this.toast(`${item.text} ${item.sub ?? ''}`, 'bonus'); break;
      case 'break': this.toast('BREAK!', 'break'); break;
      case 'signature': this.signature(item); break;
      case 'paths': this.banners.unshift({ ...item, text: 'CHOOSE YOUR PATH', sub: this.heroCount > 1 ? 'ALL OF YOU INTO ONE RIFT' : 'WALK INTO A RIFT' }); this.bannerUntil = 0; break;
      case 'path': { const info = PATH_INFO[item.text as PathKind]; if (info) this.banners.unshift({ ...item, text: info.name, sub: info.line.toUpperCase() }); this.bannerUntil = 0; break; }
      case 'charge': this.breakFor = item.actor ?? ''; this.text('sv-breakit-name', item.text ?? ''); this.root.querySelector('#sv-breakit')!.classList.remove('hidden'); break;
      case 'charge-end': if (item.actor === this.breakFor) { this.breakFor = ''; this.root.querySelector('#sv-breakit')!.classList.add('hidden'); } if (item.value === 1) this.toast(`${item.text ?? 'CHARGE'} BROKEN!`, 'break'); break;
      case 'finish': this.finishUntil = item.value ?? 0; this.finishFor = item.actor ?? ''; this.finishKey(); this.root.querySelector('#sv-finish')!.classList.remove('hidden'); break;
      case 'finisher': this.closeFinish(); this.stamp(item.text ?? 'FINISHER', item.sub ?? '', item.value === 2 ? 'team' : 'finisher'); if (item.boss) this.endPage(item, self); break;
      case 'team': this.stamp(item.text ?? 'TEAM ULTIMATE', item.sub ?? '', 'team'); break;
      case 'chest': if (!item.hero || item.hero === self) this.queueLevel('TREASURE', true); break;
      case 'magnet': if (!item.hero || item.hero === self) this.toast('SOUL MAGNET', 'meter'); break;
      case 'bomb': this.toast('RIFT BOMB!', 'break'); break;
      case 'pickup': if (!item.hero || item.hero === self) this.toast('HEALTH', 'heal'); break;
      case 'meter': if (!item.hero || item.hero === self) this.toast('SPIRIT', 'meter'); break;
      case 'momentum': if (!item.hero || item.hero === self) this.toast(`MOMENTUM ${'▲'.repeat(Math.max(1, Math.min(5, item.value ?? 1)))}`, 'bonus'); break;
      case 'second-wind': if (!item.hero || item.hero === self) this.toast('SECOND WIND', 'heal'); break;
      // Co-op drop-in: someone waits in a rift (said to the others), then comes in - A NEW CHALLENGER.
      case 'challenger': if (item.value === 1) this.stamp(item.text ?? 'A NEW CHALLENGER', item.sub ?? '', 'team'); else if (item.hero !== self) this.toast(item.text ?? 'A FIGHTER JOINS', 'level'); break;
      default: break;
    }
  }

  /** A boss's signature, called out under its bar as it comes. */
  private signature(item: FeedItem) {
    const el = this.root.querySelector<HTMLElement>('#sv-sig')!;
    this.text('sv-sig-name', item.text ?? '');
    this.text('sv-sig-boss', item.sub ?? '');
    el.dataset.element = item.element ?? 'steel';
    el.classList.remove('hidden', 'show'); void el.offsetWidth; el.classList.add('show');
    this.sigUntil = performance.now() + 1900;
    window.setTimeout(() => { if (performance.now() >= this.sigUntil - 30) el.classList.add('hidden'); }, 1960);
  }
  /** The ultimate's button, in the finish prompt. */
  private finishKey() {
    const key = this.root.querySelector<HTMLElement>('#sv-finish-key')!;
    key.innerHTML = this.inputMode === 'controller' ? `${padKey(this.family, 'r2')} ULTIMATE` : '<kbd>R</kbd> ULTIMATE';
  }
  private closeFinish() { this.finishUntil = 0; this.finishFor = ''; this.root.querySelector('#sv-finish')!.classList.add('hidden'); }
  /** FINISHER, TEAM ULTIMATE: slammed down mid-screen, the way the announcer says it. */
  private stamp(text: string, sub: string, kind: 'finisher' | 'team') {
    const el = this.root.querySelector<HTMLElement>('#sv-stamp')!;
    this.text('sv-stamp-text', text); this.text('sv-stamp-sub', sub);
    el.dataset.kind = kind;
    el.classList.remove('hidden', 'show'); void el.offsetWidth; el.classList.add('show');
    this.stampUntil = performance.now() + 2300;
    window.setTimeout(() => { if (performance.now() >= this.stampUntil - 30) el.classList.add('hidden'); }, 2360);
  }
  /** Every frame: the finish prompt's clock, and BREAK IT gone with its charge. */
  private beats(view: RunView) {
    if (this.finishUntil) {
      const brink = view.bosses.find(boss => boss.id === this.finishFor);
      if (!brink || brink.brink === undefined || view.phase === 'over') this.closeFinish();
      else this.fill('sv-finish-left', Math.max(0, this.finishUntil - view.time) / 5.5);
    }
    if (this.breakFor && !view.bosses.some(boss => boss.id === this.breakFor && boss.charge !== undefined)) { this.breakFor = ''; this.root.querySelector('#sv-breakit')!.classList.add('hidden'); }
  }

  /** A boss's card: the rank stamped, the name slammed in, where it is from.
   *  A champion's is a smaller one at the side. */
  /** A boss's eyes, cut in from its portrait: a strip across it, set on its eye line. */
  private cutIn(art: HTMLElement, enemy?: string) {
    art.replaceChildren();
    if (!enemy) return;
    // The one decoded ahead when there is one (see warmPortraits).
    const ready = this.portraits.get(enemy);
    const img = ready?.complete && ready.naturalWidth ? ready.cloneNode() as HTMLImageElement : new Image();
    img.alt = ''; img.decoding = 'async';
    img.onerror = () => img.remove();
    if (!img.src) img.src = bossPortrait(enemy);
    art.append(img);
    // (A square portrait, scaled to the strip's width.)
    const strip = art.clientHeight / Math.max(1, art.clientWidth), eyes = EYES[enemy] ?? .44;
    img.style.objectPosition = `center ${(Math.min(1, Math.max(0, (eyes - strip / 2) / Math.max(.05, 1 - strip))) * 100).toFixed(1)}%`;
  }
  /** A finisher closes a boss's page as its entrance opened it (the overhaul: "FINISH IT ends
   *  on a spread"): the same paper closes in round the blow, its name is struck through in
   *  red and its eyes crossed out. The stamp stands over it; the fight's HUD stays. */
  private endTimer = 0;
  /** A run's first place: the player's own entrance page first (the one they wear), then the chapter. */
  private mine?: HTMLElement;
  private arrived = false;
  private arrive(item: FeedItem) {
    const page = this.arrived ? '' : playerPage(this.hero ?? (this.root.dataset.fighter as FighterId));
    this.arrived = true;
    if (!page) { this.chapter(item); return; }
    this.mine?.remove();
    const holder = document.createElement('div');
    holder.innerHTML = page;
    this.mine = holder.firstElementChild as HTMLElement;
    this.root.append(this.mine);
    window.setTimeout(() => { this.mine?.remove(); this.mine = undefined; if (this.active) this.chapter(item); }, ENTRANCE_MS - 120);
  }
  private endPage(item: FeedItem, self?: string) {
    const page = this.root.querySelector<HTMLElement>('#sv-endpage')!;
    // The player's own finisher is stamped with the seal they wear.
    page.querySelector('.cos-stamp')?.remove();
    const seal = !item.hero || item.hero === self ? playerStamp() : '';
    if (seal) page.insertAdjacentHTML('beforeend', seal);
    const sub = item.sub ?? '', cut = sub.lastIndexOf(' · ');
    const name = cut >= 0 ? sub.slice(cut + 3) : sub, by = cut >= 0 ? sub.slice(0, cut) : '';
    page.classList.remove('hidden', 'show');
    page.dataset.rank = item.rank ?? 'F';
    page.dataset.length = name.length > 15 ? 'longest' : name.length > 11 ? 'long' : '';
    this.text('sv-end-rank', item.rank ?? '');
    this.text('sv-end-name', name);
    this.text('sv-end-epithet', by ? `${item.value === 2 ? 'FINISHED TOGETHER BY' : 'FINISHED BY'} ${by}` : '');
    this.text('sv-end-by', item.value === 2 ? 'THE LAST PAGE · A TEAM FINISHER' : 'THE LAST PAGE');
    this.cutIn(this.root.querySelector<HTMLElement>('#sv-end-art')!, item.enemy);
    page.style.setProperty('--hold', '2000ms');
    void page.offsetWidth; page.classList.add('show');
    window.clearTimeout(this.endTimer);
    this.endTimer = window.setTimeout(() => page.classList.add('hidden'), 2060);
  }
  private entrance(item: FeedItem) {
    const card = this.root.querySelector<HTMLElement>('#sv-entrance')!;
    const champion = !item.boss;
    card.classList.remove('hidden', 'show'); card.classList.toggle('champion', champion);
    card.dataset.rank = item.rank ?? 'F';
    this.text('sv-entrance-rank', item.rank ?? '');
    this.text('sv-entrance-name', item.text ?? '');
    // A long name steps down a size rather than losing its end.
    const length = (item.text ?? '').length;
    card.dataset.length = length > 15 ? 'longest' : length > 11 ? 'long' : '';
    this.text('sv-entrance-epithet', item.sub ?? '');
    this.text('sv-entrance-universe', champion ? 'A CHAMPION APPEARS' : `FROM ${item.universe ?? 'THE RIFT'}`);
    this.cutIn(this.root.querySelector<HTMLElement>('#sv-entrance-art')!, item.enemy);
    // The splash page (rift.css): the screen is a page for as long as the lens circles the
    // arrival (2.6 s for a boss, 1.6 for a champion: main.ts), and the fight's own HUD steps aside.
    const hold = champion ? 1700 : 2600;
    card.style.setProperty('--hold', `${hold}ms`);
    void card.offsetWidth; card.classList.add('show');
    document.documentElement.classList.add('rift-splash');
    this.entranceUntil = performance.now() + hold;
    window.setTimeout(() => { if (performance.now() >= this.entranceUntil - 30) { card.classList.add('hidden'); document.documentElement.classList.remove('rift-splash'); } }, hold + 60);
    this.onEntrance(item);
  }

  /** A new place: a chapter of the story, as a manga panel - the place drawn,
   *  its chapter stamped, and one line of what happened there. The Rift's
   *  later loops come back to the same places, worse. */
  private chapter(item: FeedItem) {
    const place = this.place, def = LOCATIONS.find(l => l.name === item.text) ?? LOCATIONS[(place?.index ?? 0) % LOCATIONS.length];
    const loop = place?.loop ?? 0, index = place?.index ?? 0;
    const card = this.root.querySelector<HTMLElement>('#sv-chapter')!;
    // The run's own count of places, not the place's number in the deck: the
    // chapters go on (a fifth place was CHAPTER I again, and past ten, nothing).
    this.text('sv-chapter-number', loop ? `THE RIFT · DEPTH ${loop} · ${roman(index + 1)}` : `CHAPTER ${roman(index + 1)}`);
    this.text('sv-chapter-name', (item.text ?? def.name).toUpperCase());
    this.text('sv-chapter-line', loop ? def.again : def.line);
    this.text('sv-chapter-kanji', def.kanji);
    // What the place does to the fight (placeRules.ts), where it does something.
    this.chapterRule(PLACE_RULES[def.id]);
    const img = this.root.querySelector<HTMLImageElement>('#sv-chapter-art')!;
    // In cards/ because the preview and production packagers ship that folder whole.
    const src = `/assets/survival/cards/chapter-${def.id}.webp`;
    if (!img.src.endsWith(src)) img.src = src;
    card.dataset.place = def.id;
    card.classList.remove('hidden', 'show'); void card.offsetWidth; card.classList.add('show');
    this.chapterUntil = performance.now() + 3600;
    // The main HUD calls the place out too: while the card says it, it is quiet.
    this.quietCallouts(true);
    window.setTimeout(() => { if (performance.now() >= this.chapterUntil - 30) { card.classList.add('hidden'); this.quietCallouts(false); } }, 3660);
  }
  private chapterRule(rule: { name: string; line: string } | undefined) {
    const el = this.root.querySelector<HTMLElement>('#sv-chapter-rule')!;
    el.classList.toggle('hidden', !rule);
    if (!rule) return;
    el.querySelector('b')!.textContent = rule.name;
    el.querySelector('i')!.textContent = rule.line;
  }
  /** The main HUD's callouts say NOT READY and BROKEN; in a run, where the
   *  cards and a crowd fill the screen, they say what is not ready or broken. */
  /** The main HUD's callouts, in the Rift: said plainly, and not on repeat.
   *  SKILL NOT READY is not said at all (the arts' cards show their clocks) and
   *  GUARD BROKEN at most once in six seconds - re-announced on every blow on a
   *  broken boss, the pair sat in the callout's place for half a run. */
  private calloutAt = -1e9;
  private clarifyCallouts(parent: HTMLElement) {
    const say: Record<string, string> = { 'NOT READY': 'SKILL NOT READY', BROKEN: 'GUARD BROKEN' };
    const watch = () => {
      const el = parent.querySelector<HTMLElement>('#action-message');
      if (!el) return false;
      new MutationObserver(() => {
        if (this.root.classList.contains('hidden')) return;
        const text = el.textContent ?? '', hud = parent.querySelector('.combat-hud');
        let mute = false;
        if (text === 'NOT READY' || text === 'SKILL NOT READY') mute = true;
        else if (text === 'BROKEN' || text === 'GUARD BROKEN') {
          const now = performance.now();
          if (text === 'BROKEN') { mute = now - this.calloutAt < 6000; if (!mute) this.calloutAt = now; }
          else mute = hud?.classList.contains('sv-callout-mute') ?? false;
        }
        hud?.classList.toggle('sv-callout-mute', mute);
        if (say[text]) el.textContent = say[text];
      }).observe(el, { childList: true, characterData: true, subtree: true });
      return true;
    };
    // The main HUD may be built after this one.
    if (!watch()) { const late = new MutationObserver(() => { if (watch()) late.disconnect(); }); late.observe(parent, { childList: true, subtree: true }); }
  }
  private quietCallouts(quiet: boolean) { this.root.parentElement?.querySelector('.combat-hud')?.classList.toggle('sv-callouts-quiet', quiet); }

  /** Who is playing, for the ending's inset. */
  private hero?: FighterId;
  /** The ending: rank S has fallen over the Fallen Star and the rift closes -
   *  for now. A panel of its own (the one it had was the intro's), gold on
   *  black, with the fighter who won inset in it. */
  private finale(item: FeedItem) {
    const card = this.root.querySelector<HTMLElement>('#sv-chapter')!;
    this.text('sv-chapter-number', 'EVERY RANK HAS FALLEN');
    this.text('sv-chapter-name', item.text ?? 'THE RIFT IS SEALED');
    this.text('sv-chapter-line', 'The black sun closes its eye. Somewhere behind it, something pushes back. It will not stay shut.');
    this.chapterRule(undefined);
    this.text('sv-chapter-kanji', '封印');
    const img = this.root.querySelector<HTMLImageElement>('#sv-chapter-art')!;
    img.src = '/assets/survival/cards/finale-panel.webp';
    this.root.querySelector('#sv-chapter-hero')!.innerHTML = this.hero ? mangaPortrait(this.hero) : '';
    card.dataset.place = 'finale';
    card.classList.remove('hidden', 'show'); void card.offsetWidth; card.classList.add('show');
    // Gone before its question opens (SurvivalGame asks five seconds on).
    this.chapterUntil = performance.now() + 4700;
    window.setTimeout(() => { if (performance.now() >= this.chapterUntil - 30) card.classList.add('hidden'); }, 4760);
  }

  /** The build, where it can be seen: every art with its level (★ awakened,
   *  gold once evolved) and every legendary, as ink chips under the level bar. */
  private build(picks: readonly string[]) {
    const key = picks.join(',');
    if (key === this.buildKey) return;
    this.buildKey = key;
    const box = this.root.querySelector<HTMLElement>('#sv-build')!;
    box.replaceChildren();
    const held = stacksOf(picks);
    for (const [id, n] of held) {
      const def = upgrade(id), technique = !!TREE_NODE.get(id)?.technique;
      if (!def || !(technique || def.rarity === 'legendary')) continue;
      const chip = document.createElement('span');
      chip.className = `sv-build-chip ${def.rarity === 'legendary' ? 'legend' : 'art'}${n >= def.max && def.max > 1 ? ' awake' : ''}`;
      chip.title = def.name;
      const shown = def;
      const kanji = document.createElement('b'); kanji.textContent = shown.kanji;
      // Its name beside the kanji: most players read the one, not the other.
      const name = document.createElement('small'); name.textContent = shown.name.toUpperCase();
      // (A long one, set tighter: a long name ran under its own ★.)
      if (shown.name.length > 12) name.className = 'long';
      const level = document.createElement('i'); level.textContent = def.max > 1 ? (n >= def.max ? '★' : String(n)) : '';
      chip.append(kanji, name, level);
      box.append(chip);
    }
    // A long build goes three abreast, smaller (eleven chips two abreast
    // filled the upper left of the play field).
    box.classList.toggle('many', box.childElementCount > 8);
  }

  // ---- the skill tree ---------------------------------------------------------------------------
  get treeShown() { return this.treeUp; }

  /** Points waiting, as a badge under the level bar that opens the tree. */
  private points(view: RunView) {
    const badge = this.root.querySelector<HTMLButtonElement>('#sv-points')!;
    if (view.points === this.pointsShown) return;
    const more = view.points > this.pointsShown && this.pointsShown >= 0;
    this.pointsShown = view.points;
    badge.classList.toggle('hidden', view.points <= 0);
    const key = this.inputMode === 'controller' ? '<kbd class="pad-key">D-PAD ↑</kbd>' : '<kbd>T</kbd>';
    badge.innerHTML = `<b>${view.points}</b> SKILL POINT${view.points === 1 ? '' : 'S'} ${key}`;
    if (more) { badge.classList.remove('earned'); void badge.offsetWidth; badge.classList.add('earned'); }
  }

  /** The pad's D-pad up opens the tree: the fight leaves the D-pad free.
   *  (The share button it used to be opens Game Center on a Mac, over the
   *  game.) Inside the tree the D-pad moves and ○ / B is READY. */
  private upPad() {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    let held = false;
    for (const pad of pads) if (pad?.connected && pad.mapping === 'standard' && pad.buttons[12]?.pressed) held = true;
    const settings = document.querySelector('.settings-scrim:not(.hidden)');
    if (held && !this.upHeld && !this.treeUp && !settings) this.openTree();
    this.upHeld = held;
  }

  /** Co-op: someone else's tree holds the run - a card over the fight saying
   *  who, and how long the room will wait, with a way into one's own tree. */
  private pausedFor(view: RunView) {
    const el = this.root.querySelector<HTMLElement>('#sv-paused')!;
    const others = (view.upgrading ?? []).filter(name => name !== view.party[0]?.name);
    const paused = view.phase === 'draft' && !view.draft && others.length > 0 && !this.treeUp;
    this.partyPaused = view.phase === 'draft' && (view.upgrading?.length ?? 0) > 0;
    el.classList.toggle('hidden', !paused);
    if (paused) {
      this.text('sv-paused-who', `${others.join(' & ').toUpperCase()} ${others.length === 1 ? 'IS' : 'ARE'} CHOOSING SKILLS`);
      this.text('sv-paused-left', `THE RUN GOES ON WHEN EVERYONE IS READY${view.treeLeft !== undefined ? ` · ${Math.ceil(view.treeLeft)}s` : ''}`);
      this.root.querySelector('#sv-paused-open')!.classList.toggle('hidden', view.points <= 0);
    }
    if (this.treeUp) this.text('sv-tree-ready', view.party.length > 1 ? `READY${view.treeLeft !== undefined ? ` · ${Math.ceil(view.treeLeft)}s` : ''}` : 'RESUME');
  }

  private openTree() {
    const state = this.treeState;
    if (this.treeUp || !this.active || this.resultsOpen || !state || state.finale) return;
    if (state.phase !== 'fight' && state.phase !== 'draft' && state.phase !== 'intro') return;
    // A card still being chosen (a co-op draft) is answered first.
    if (!this.root.querySelector('#sv-draft')!.classList.contains('hidden')) return;
    this.treeUp = true; this.treeKey = ''; this.treeConfirmed = false; this.treeOpenedAt = performance.now();
    this.treeHint();
    this.drawTree();
    this.root.querySelector('#sv-tree')!.classList.remove('hidden');
    this.atlas.open();
    this.root.classList.add('modal');
    document.exitPointerLock?.();
    this.onChoose('tree:open');
  }
  private closeTree() {
    if (!this.treeUp) return;
    this.treeUp = false;
    this.root.querySelector('#sv-tree')!.classList.add('hidden');
    this.onChoose('tree:close');
    this.atlas.close();
  }

  private drawTree() { if (this.treeState) this.atlas.update(this.treeState, this.unlocked); }
  private moveTree(dx: number, dy: number) { this.atlas.move(dx, dy); }
  private learnFocused() { this.atlas.learn(); }

  /** The KO chain: kills with no three-second gap between them, counted up
   *  big on the right while it runs, stamped at a hundred, five hundred and a
   *  thousand (a hundred-man cut, 百人斬り). It is the horde's size made a
   *  score of its own: the arts' kills count, as the build is the fighter's. */
  private chainKills = -1;
  private chainN = 0;
  private chainAt = 0;
  private chainShown = 0;
  /** The run's longest chain, for its results: the horde game's combo. */
  private chainBest = 0;
  private chain(kills: number) {
    const now = performance.now(), el = this.root.querySelector<HTMLElement>('#sv-chain')!;
    if (this.chainKills < 0 || kills < this.chainKills) this.chainKills = kills;
    if (kills > this.chainKills) {
      if (now - this.chainAt > 3000) this.chainN = 0;
      const before = this.chainN;
      this.chainN += kills - this.chainKills; this.chainAt = now; this.chainBest = Math.max(this.chainBest, this.chainN);
      // A streak banner worn (the shop's): it crosses the screen at every mark, from fifty; else the stamp at a hundred and on.
      const banner = playerBanner(), marks: readonly number[] = banner ? [...BANNER_MARKS].reverse() : [1000, 500, 100];
      const mark = marks.find(m => before < m && this.chainN >= m);
      if (mark && banner) playBanner(this.root, banner, mark);
      else if (mark) {
        this.text('sv-chain-stamp', mark === 1000 ? '千人斬り' : mark === 500 ? '五百人斬り' : '百人斬り');
        el.classList.remove('stamped'); void el.offsetWidth; el.classList.add('stamped');
      }
    }
    this.chainKills = kills;
    const live = now - this.chainAt < 3000 && this.chainN >= 10;
    el.classList.toggle('hidden', !live);
    el.classList.toggle('fading', live && now - this.chainAt > 2200);
    if (live && this.chainN !== this.chainShown) {
      this.chainShown = this.chainN; this.text('sv-chain-n', String(this.chainN));
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }
  }

  /** Living Ink (the shop's): the player told as theirs reaches a new stage. */
  private livingSelf = '';
  private livingInk(self: string | undefined) {
    const cosmetics = gameCosmetics();
    if (!cosmetics || !self || this.livingSelf === self) return;
    this.livingSelf = self;
    cosmetics.onStage = (id, stage) => { if (id === this.livingSelf) this.toast(`LIVING INK · ${LIVING_NAMES[stage]}`, 'level'); };
  }

  /** A boss's DEFEATED on screen, or waiting its turn. */
  private defeatUp() {
    const el = this.root.querySelector<HTMLElement>('#sv-banner')!;
    return (el.dataset.kind === 'down' && performance.now() < this.bannerUntil) || this.banners.some(b => b.kind === 'down');
  }

  /** One banner at a time, in order; each holds long enough to read. */
  private banner() {
    const now = performance.now();
    const el = this.root.querySelector<HTMLElement>('#sv-banner')!;
    if (now < this.bannerUntil || this.entranceOpen || now < this.chapterUntil || now < this.levelUpUntil) return;
    const next = this.banners.shift();
    if (!next) { el.classList.remove('show'); return; }
    const kind = next.kind;
    el.dataset.kind = kind;
    this.text('sv-banner-text', next.text ?? '');
    this.text('sv-banner-sub', next.sub ?? '');
    this.text('sv-banner-kanji', kind === 'location' ? this.locationKanji : kind === 'round' ? '開戦' : kind === 'event' ? '異変' : kind === 'down' ? '撃破' : kind === 'revive' ? '不屈' : kind === 'enraged' ? (next.value === 2 ? '背水' : next.value === 3 ? '覚醒' : '激怒') : kind === 'hunt' ? '軍勢' : kind === 'lair' ? '守護者' : kind === 'paths' ? '分岐' : kind === 'path' ? PATH_INFO[next.text === undefined ? 'treasure' : (Object.keys(PATH_INFO) as PathKind[]).find(k => PATH_INFO[k].name === next.text) ?? 'treasure'].kanji : '');
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    // Short: a banner is over the fight while it holds (events and enrages sat on the action).
    this.bannerUntil = now + (kind === 'location' ? 2900 : kind === 'event' ? 1800 : kind === 'round' ? 1300 : kind === 'enraged' ? 1700 : kind === 'hunt' ? 1600 : kind === 'lair' ? 1500 : 1900);
  }

  private queueLevel(text: string, treasure: boolean) {
    // (A level that comes while one waits replaces it: the badge counts the points.)
    const waiting = this.levels.find(each => each.treasure === treasure);
    if (waiting) waiting.text = text; else this.levels.push({ text, treasure, at: performance.now() });
  }
  /** Whether the middle of the screen is someone else's: a boss's card, a chapter, a finisher's
   *  stamp, FINISH IT or BREAK IT, a signature's name, the road's rifts, a draft or the tree. */
  private centreClaimed(now: number) {
    return this.entranceOpen || now < this.chapterUntil || now < this.stampUntil || this.finishUntil > 0 || !!this.breakFor
      || now < this.sigUntil || this.forksOpen || this.draftOpen || this.relicHud.busy;
  }
  /** ...or a banner's, showing or waiting. */
  private centreTaken(now: number) {
    const banner = this.root.querySelector<HTMLElement>('#sv-banner')!;
    return this.centreClaimed(now) || (now < this.bannerUntil && banner.classList.contains('show')) || this.banners.length > 0;
  }
  private levelTurn() {
    const now = performance.now();
    // A LEVEL UP on screen gives way at once to whatever claims the middle (the road forking
    // a breath after a boss falls, a boss's card): it does not play on over it.
    if (now < this.levelUpUntil && this.centreClaimed(now)) { this.levelUpUntil = 0; this.hideLevelUp(); }
    if (!this.levels.length || now < this.levelUpUntil) return;
    if (this.centreTaken(now)) {
      // Waited long enough: said in the corner instead (the level bar's badge still counts it).
      for (const late of this.levels.filter(each => now - each.at > 9000)) this.toast(late.treasure ? 'TREASURE · SKILL POINT' : `${late.text} · SKILL POINT`, 'level');
      this.levels = this.levels.filter(each => now - each.at <= 9000);
      return;
    }
    const next = this.levels.shift()!;
    this.levelUp(next.text, next.treasure);
    this.levelUpUntil = now + 2600;
  }
  private hideLevelUp() {
    window.clearTimeout(this.levelUpTimer);
    this.root.querySelector('#sv-levelup')!.classList.add('hidden');
    this.root.querySelector('#sv-levelup-edge')!.classList.add('hidden');
  }
  /** An awakening turns the page (the overhaul: "the sky takes the boss's colour and the page
   *  turns over for a beat"): a sheet crosses the screen with 覚醒 brushed on it in the boss's
   *  colour, and behind it the sky has taken that colour (rift/ink.ts inkFlood). */
  private pageTimer = 0;
  private pageTurn(enemy?: string) {
    const page = this.root.querySelector<HTMLElement>('#sv-pageturn')!;
    const [core, rim] = awakeningOf(enemy ?? '', 0xcc202b).aura;
    // (A rim near black - the darkest forms' - would print as plain ink: its core then.)
    const bright = (hex: number) => (hex >> 16 & 255) + (hex >> 8 & 255) + (hex & 255);
    page.style.setProperty('--aura', `#${(bright(rim) > 150 ? rim : core).toString(16).padStart(6, '0')}`);
    page.classList.remove('hidden', 'show'); void page.offsetWidth; page.classList.add('show');
    window.clearTimeout(this.pageTimer);
    this.pageTimer = window.setTimeout(() => page.classList.add('hidden'), 600);
  }
  private levelUpTimer = 0;
  private levelUp(text: string, treasure = false) {
    const el = this.root.querySelector<HTMLElement>('#sv-levelup')!, edge = this.root.querySelector<HTMLElement>('#sv-levelup-edge')!;
    const level = /\d+/.exec(text)?.[0] ?? '', points = Math.max(1, this.treeState?.points ?? 1);
    const key = this.inputMode === 'controller' ? `<kbd class="pad-key">D-PAD ↑</kbd>` : '<kbd>T</kbd>';
    const sparks = Array.from({ length: 22 }, (_, i) => {
      const a = i / 22 * 360 + Math.random() * 14, d = 150 + Math.random() * 190, t = .55 + Math.random() * .55, z = .6 + Math.random() * .9;
      return `<i class="sv-lvup-spark" style="--a:${a.toFixed(0)}deg;--d:${d.toFixed(0)}px;--t:${t.toFixed(2)}s;--z:${z.toFixed(2)}"></i>`;
    }).join('');
    el.innerHTML = `<div class="sv-lvup-rays"></div><div class="sv-lvup-ring"></div><div class="sv-lvup-ring late"></div>${sparks}`
      + `<div class="sv-lvup-core">${level ? `<span class="sv-lvup-num"><small>LV</small>${level}</span>` : ''}`
      + `<strong class="sv-lvup-title" data-text="${treasure ? 'TREASURE!' : 'LEVEL UP!'}">${treasure ? 'TREASURE!' : 'LEVEL UP!'}</strong>`
      + `<span class="sv-lvup-point"><b>+1</b> SKILL POINT${points > 1 ? ` <em>· ${points} TO SPEND</em>` : ''} ${key}</span></div>`;
    for (const each of [el, edge]) { each.classList.remove('hidden', 'go'); void each.offsetWidth; each.classList.add('go'); }
    window.clearTimeout(this.levelUpTimer);
    this.levelUpTimer = window.setTimeout(() => { el.classList.add('hidden'); edge.classList.add('hidden'); }, 2900);
  }

  private toast(text: string, kind: string) {
    const box = this.root.querySelector('#sv-toasts')!;
    const toast = document.createElement('div');
    toast.className = `sv-toast ${kind}`; toast.textContent = text;
    box.prepend(toast);
    while (box.children.length > 5) box.lastElementChild!.remove();
    window.setTimeout(() => toast.remove(), 1900);
  }

  private draft(view: RunView) {
    const panel = this.root.querySelector<HTMLElement>('#sv-draft')!;
    const open = view.phase === 'draft' && !!view.draft;
    if (!open) { if (!panel.classList.contains('hidden')) panel.classList.add('hidden'); this.draftKey = ''; return; }
    // A choice has the screen to itself: a chapter card still up goes.
    if (this.chapterUntil > performance.now()) { this.chapterUntil = 0; this.root.querySelector('#sv-chapter')!.classList.add('hidden'); this.quietCallouts(false); }
    const key = view.draft!.cards.join('|') + view.picks.length;
    if (key === this.draftKey) return;
    this.draftKey = key;
    this.cards = [...view.draft!.cards]; this.focus = 0;
    const finale = !!view.draft!.finale, relic = !!view.draft!.relic;
    panel.classList.toggle('finale', finale);
    panel.classList.toggle('relic', relic);
    // (No dash: the display face draws one as "=".)
    panel.querySelector('h2')!.textContent = finale ? 'END IT, OR GO DEEPER' : relic ? 'GIVE ONE UP FOR IT?' : 'CHOOSE YOUR POWER';
    this.root.querySelector('#sv-reroll')!.classList.toggle('hidden', finale || relic);
    // The keys the hint names are the cards there are (the seal asks with two, a relic with four).
    if (this.inputMode !== 'controller') this.root.querySelector('#sv-draft-hint')!.innerHTML = draftHint(this.inputMode, this.cards.length);
    if (finale) { this.finaleCards(view); return; }
    if (relic) { this.relicCards(view); return; }
    this.text('sv-draft-kind', view.draft!.legendary ? 'TREASURE' : `LEVEL ${view.level}`);
    this.rerolls = view.rerolls ?? 0;
    this.text('sv-reroll-count', String(this.rerolls));
    this.root.querySelector('#sv-reroll')!.classList.toggle('spent', this.rerolls <= 0);
    const held = stacksOf(view.picks);
    const box = this.root.querySelector('#sv-cards')!;
    box.replaceChildren();
    view.draft!.cards.forEach((id, i) => {
      const def = upgrade(id), card = document.createElement('button');
      const stacks = held.get(id) ?? 0;
      const tag = RARITY_LABEL[def.rarity];
      card.type = 'button'; card.className = `sv-card ${def.rarity}${i === 0 ? ' focused' : ''}`;
      card.style.setProperty('--i', String(i));
      card.innerHTML = `<span class="sv-card-frame"><span class="sv-card-art"><img alt="" draggable="false"><span class="sv-card-kanji"></span><span class="sv-card-rarity"></span></span><span class="sv-card-caption"><strong></strong><p></p><span class="sv-card-stack"></span></span></span><kbd></kbd>`;
      this.cardKey(card.querySelector('kbd')!, i);
      const img = card.querySelector('img')!;
      img.src = `/assets/survival/cards/${id}.webp`;
      img.onerror = () => { img.remove(); card.classList.add('no-art'); };
      card.querySelector('.sv-card-rarity')!.textContent = tag;
      card.querySelector('.sv-card-kanji')!.textContent = def.kanji;
      card.querySelector('strong')!.textContent = def.name.toUpperCase();
      card.querySelector('p')!.textContent = describeNext(id, view.picks, view.level);
      card.querySelector('.sv-card-stack')!.innerHTML = def.max > 1 ? Array.from({ length: def.max }, (_, k) => `<i class="${k < stacks ? 'held' : k === stacks ? 'next' : ''}"></i>`).join('') : '<em>UNIQUE</em>';
      card.onclick = () => this.take(i);
      card.onpointerenter = () => { this.focus = i; this.move(0); };
      box.append(card);
    });
    panel.classList.remove('hidden');
    this.openedAt = performance.now();
    document.exitPointerLock?.();
  }

  /** A relic left while all three places are full (survival/relics.ts): the
   *  one on offer over the draft, and the three held as cards - one given up
   *  for it - with a fourth that leaves it where it fell. */
  private relicCards(view: RunView) {
    const panel = this.root.querySelector<HTMLElement>('#sv-draft')!;
    const offered = relicOf(view.draft!.relic);
    if (!offered) return;
    this.text('sv-draft-kind', `A RELIC · ${relicBoss(offered.id)}`);
    const head = panel.querySelector('.sv-draft-head')!;
    let offer = head.querySelector<HTMLElement>('.sv-relic-offer');
    if (!offer) { offer = document.createElement('div'); offer.className = 'sv-relic-offer'; head.append(offer); }
    offer.innerHTML = `<span class="sv-relic-card-art"><img alt="" draggable="false"></span><span class="sv-seal" data-n="${[...offered.kanji].length}"><b></b></span><div><strong></strong><p></p></div>`;
    const art = offer.querySelector('img')!; art.src = relicArt(offered.id); art.onerror = () => art.remove();
    offer.querySelector('.sv-seal b')!.textContent = offered.kanji;
    offer.querySelector('strong')!.textContent = plain(offered.name);
    offer.querySelector('p')!.textContent = offered.text;
    const box = this.root.querySelector('#sv-cards')!;
    box.replaceChildren();
    view.draft!.cards.forEach((id, i) => {
      const held = relicOf(givenOf(id)), leave = id === RELIC_LEAVE;
      if (!held && !leave) return;
      const card = document.createElement('button');
      card.type = 'button'; card.className = `sv-card relic-card${leave ? ' leave no-art' : ''}${i === 0 ? ' focused' : ''}`;
      card.style.setProperty('--i', String(i));
      card.innerHTML = `<span class="sv-card-frame"><span class="sv-card-art"><img alt="" draggable="false"><span class="sv-card-kanji"></span><span class="sv-card-rarity"></span></span><span class="sv-card-caption"><strong></strong><p></p></span></span><kbd></kbd>`;
      this.cardKey(card.querySelector('kbd')!, i);
      const img = card.querySelector('img')!;
      if (held) { img.src = relicArt(held.id); img.onerror = () => { img.remove(); card.classList.add('no-art'); }; } else img.remove();
      card.querySelector('.sv-card-rarity')!.textContent = leave ? 'KEEP ALL THREE' : 'GIVE UP';
      card.querySelector('.sv-card-kanji')!.textContent = held ? held.kanji : '去';
      card.querySelector('strong')!.textContent = held ? plain(held.name) : 'LEAVE IT';
      card.querySelector('p')!.textContent = held ? held.text : `${plain(offered.name)} stays where ${relicBoss(offered.id)} fell.`;
      card.onclick = () => this.take(i);
      card.onpointerenter = () => { this.focus = i; this.move(0); };
      box.append(card);
    });
    panel.classList.remove('hidden');
    this.openedAt = performance.now();
    document.exitPointerLock?.();
  }

  /** The seal's question, as two cards: bank the run, or let the Rift take it on. */
  private finaleCards(view: RunView) {
    const panel = this.root.querySelector<HTMLElement>('#sv-draft')!;
    this.text('sv-draft-kind', 'THE RIFT IS SEALED');
    const box = this.root.querySelector('#sv-cards')!;
    box.replaceChildren();
    const choices: Record<string, { art: string; kanji: string; tag: string; name: string; text: string }> = {
      'finale-end': { art: '/assets/survival/cards/finale-end.webp', kanji: '封印', tag: 'VICTORY', name: 'END IT HERE', text: `Every rank has fallen. Bank the run - ${thousands(view.score)} points - and leave the rift shut behind you.` },
      'finale-deeper': { art: '/assets/survival/cards/finale-deeper.webp', kanji: '深淵', tag: 'THE RIFT', name: 'GO DEEPER', text: 'The Rift takes you back: every place again, worse, and the score keeps climbing until you fall.' },
    };
    view.draft!.cards.forEach((id, i) => {
      const def = choices[id];
      if (!def) return;
      const card = document.createElement('button');
      card.type = 'button'; card.className = `sv-card legendary finale-card${i === 0 ? ' focused' : ''}`;
      card.style.setProperty('--i', String(i));
      card.innerHTML = `<span class="sv-card-frame"><span class="sv-card-art"><img alt="" draggable="false"><span class="sv-card-kanji"></span><span class="sv-card-rarity"></span></span><span class="sv-card-caption"><strong></strong><p></p></span></span><kbd></kbd>`;
      this.cardKey(card.querySelector('kbd')!, i);
      card.querySelector('img')!.src = def.art;
      card.querySelector('.sv-card-rarity')!.textContent = def.tag;
      card.querySelector('.sv-card-kanji')!.textContent = def.kanji;
      card.querySelector('strong')!.textContent = def.name;
      card.querySelector('p')!.textContent = def.text;
      card.onclick = () => this.take(i);
      card.onpointerenter = () => { this.focus = i; this.move(0); };
      box.append(card);
    });
    panel.classList.remove('hidden');
    this.openedAt = performance.now();
    document.exitPointerLock?.();
  }

  private results(result: RunResult, fighter: FighterId, host?: boolean) {
    this.resultShown = true;
    const party = result.party && result.party > 1 ? result.party : 0;
    const before = loadRecords()[fighter];
    const record = party ? { fighter: false, overall: false, beaten: false } : saveRecord(result);
    // A panel over the result, as the chapters and the seal have: where the
    // run fell (its place's panel, drained red), or the seal's own on a win -
    // a loss was a bare form under the victory's manga panel.
    const where = LOCATIONS.find(l => l.name === this.place?.name) ?? LOCATIONS[(this.place?.index ?? 0) % LOCATIONS.length];
    const art = this.root.querySelector<HTMLElement>('#sv-results-art')!;
    art.style.setProperty('--art', `url(${result.victory ? '/assets/survival/cards/finale-panel.webp' : `/assets/survival/cards/chapter-${where.id}.webp`})`);
    art.classList.toggle('fallen', !result.victory);
    this.text('sv-results-epitaph', result.victory ? 'THE BLACK SUN CLOSES ITS EYE' : party ? `THEY FELL AT ${where.name.toUpperCase()}` : `HERE ${FIGHTERS[fighter].name.toUpperCase()} FELL · ${where.name.toUpperCase()}`);
    const panel = this.root.querySelector<HTMLElement>('#sv-results')!;
    this.root.querySelector('#sv-results-portrait')!.innerHTML = `<img src="${resultFighterArt(fighter)}" alt="">`;
    // (A victory's word goes above the title: in one line with it, the title wrapped.)
    // (The seal's card and its question have said THE RIFT IS SEALED already.)
    const title = playerTitle();
    this.text('sv-results-kicker', `${result.victory ? 'ARCADE SURVIVAL · THE RIFT IS SEALED' : 'ARCADE SURVIVAL'}${title && !party ? ` · 「${title.toUpperCase()}」` : ''}`);
    this.text('sv-results-title', result.victory ? 'VICTORY' : result.sealed ? (party ? 'THEY SEALED THE RIFT' : 'THE RIFT WAS SEALED') : party ? (result.bosses ? 'A PARTY OF LEGENDS FALLS' : 'THE PARTY FALLS') : result.bosses ? 'A LEGEND FALLS' : 'CHAPTER CLOSED');
    const depth = result.round > FINAL_ROUND ? ` · THE RIFT, ${result.round - FINAL_ROUND} ROUNDS DEEP` : ` · RANK ${result.rank}`;
    this.text('sv-results-sub', `${party ? `PARTY OF ${party}` : FIGHTERS[fighter].name.toUpperCase()} · ${result.victory ? `${result.bosses} ${result.bosses === 1 ? 'BOSS' : 'BOSSES'} FELL · THE LAST AT RANK S` : `FELL IN ROUND ${result.round}${depth}`}`);
    panel.classList.toggle('sealed', !!result.sealed);
    panel.classList.toggle('victory', !!result.victory);
    // A record is something beaten: a run that scored nothing sets none, and a
    // first run is only a record because there was none.
    // Beaten: the stamp. Not beaten: the best there is to beat, so a loss says what to go for.
    const toBeat = !record.beaten && before && before.score > 0 && !party;
    this.root.querySelector('#sv-record')!.classList.toggle('hidden', !(record.beaten && result.score > 0) && !toBeat);
    this.root.querySelector('#sv-record')!.classList.toggle('best', !!toBeat);
    this.text('sv-record', record.beaten ? (record.overall ? 'NEW HIGH SCORE' : 'NEW PERSONAL BEST') : toBeat ? `BEST · ROUND ${before!.wave} · ${thousands(before!.score)}` : '');
    const grid = this.root.querySelector('#sv-results-grid')!;
    grid.replaceChildren();
    this.text('sv-result-score', thousands(result.score));
    this.text('sv-result-chapter', `CH. ${String(result.round).padStart(2,'0')} / ${result.rank}`);
    const stats: [string,string][] = [[party?'YOUR KOs':'KNOCKOUTS',thousands(result.ownKills??result.kills)],['BEST STYLE',STYLE_RANKS[result.bestRank].letter],['SURVIVED',clock(result.seconds)],['BOSSES',String(result.bosses)]];
    for(const [label,value] of stats){const cell=document.createElement('div'),small=document.createElement('span'),big=document.createElement('b');small.textContent=label;big.textContent=value;cell.append(big,small);grid.append(cell);}
    const extra:[string,string][]=[['MAX COMBO',thousands(result.bestCombo)],['DAMAGE DEALT',thousands(result.damageDealt)],['DAMAGE TAKEN',thousands(result.damageTaken)],['LEVEL',String(result.level)],...(this.chainBest>=10?[['BEST KO CHAIN',thousands(this.chainBest)]] as [string,string][]:[]),...(party?[['PARTY KOs',thousands(result.kills)]] as [string,string][]:[])];
    this.root.querySelector('#sv-result-extra')!.innerHTML=extra.map(([label,value])=>`<div><span>${label}</span><b>${value}</b></div>`).join('');
    this.root.querySelector<HTMLDetailsElement>('#sv-result-details')!.open=false;
    const picks = this.root.querySelector('#sv-results-picks')!;
    picks.replaceChildren();
    for (const [id, n] of stacksOf(result.picks)) { const chip = document.createElement('span'); const def = upgrade(id); chip.className = `sv-chip ${def.rarity}`; chip.textContent = `${def.kanji} ${def.name}${n > 1 ? ` ×${n}` : ''}`; picks.append(chip); }
    // The relics carried to the end, first among them.
    for (const id of [...result.relics ?? []].reverse()) { const relic = relicOf(id); if (!relic) continue; const chip = document.createElement('span'); chip.className = 'sv-chip relic'; chip.textContent = `${relic.kanji} ${plain(relic.name)}`; chip.title = `${relicBoss(id)} · ${relic.text}`; picks.prepend(chip); }
    // What the run was made of, and what it left behind (a probe's run leaves nothing).
    let settled: Settled | undefined;
    if (!result.probe) { try { settled = settleRun(result); } catch (error) { glitch(error, 'progress'); } }
    const summary = this.root.querySelector<HTMLElement>('#sv-results-summary')!;
    summary.innerHTML = progressHtml(fighter, settled);
    this.root.querySelector('#sv-results-bosses')!.innerHTML=bossesHtml(result);
    this.root.querySelector('#sv-result-damage')!.innerHTML=damageHtml(result);
    this.root.querySelector('#sv-results-bosses')!.querySelectorAll('img').forEach(img => { img.onerror = () => img.remove(); });
    showRunPay(this.root.querySelector<HTMLElement>('#sv-results-pay')!, result);
    const level = settled ? masteryOf(settled.progress.mastery[fighter]).level : 0;
    this.shareInput = { result, fighter, title: this.root.querySelector('#sv-results-title')!.textContent ?? '', sub: this.root.querySelector('#sv-results-sub')!.textContent ?? '',
      epitaph: this.root.querySelector('#sv-results-epitaph')!.textContent ?? '', art: result.victory ? '/assets/survival/cards/finale-panel.webp' : `/assets/survival/cards/chapter-${where.id}.webp`,
      fallen: !result.victory, mastery: level ? `${titleAt(level)} · MASTERY ${level}` : undefined };
    panel.classList.remove('hidden');
    this.openedAt = performance.now();
    document.exitPointerLock?.();
    if (host !== undefined) this.retryFor(host);
    window.setTimeout(() => this.root.querySelector<HTMLButtonElement>(host === false ? '#sv-leave' : '#sv-retry')?.focus(), 400);
  }

  get shareOpen() { return !this.root.querySelector('#sv-sharebox')!.classList.contains('hidden'); }
  /** The run as a picture: drawn, shown, and saved or shared from there. */
  private async openShare() {
    if (!this.shareInput) return;
    const box = this.root.querySelector<HTMLElement>('#sv-sharebox')!, button = this.root.querySelector<HTMLButtonElement>('#sv-share')!;
    button.disabled = true;
    try {
      const blob = await cardBlob(await drawShareCard(this.shareInput));
      if (!blob) return;
      this.shareBlob = blob;
      if (this.shareUrl) URL.revokeObjectURL(this.shareUrl);
      this.shareUrl = URL.createObjectURL(blob);
      this.root.querySelector<HTMLImageElement>('#sv-share-img')!.src = this.shareUrl;
      const save = this.root.querySelector<HTMLAnchorElement>('#sv-share-save')!;
      save.href = this.shareUrl; save.download = `arcade-survival-${this.shareInput.fighter}-round-${this.shareInput.result.round}.png`;
      this.root.querySelector('#sv-share-send')!.classList.toggle('hidden', !canShareFiles());
      box.classList.remove('hidden');
      window.setTimeout(() => save.focus(), 30);
    } catch (error) { glitch(error, 'share card'); } finally { button.disabled = false; }
  }
  /** The picture kept as drawn: SHARE opens the sheet inside the press (fetching it back first was too late for
   *  Safari), with the link back to the game (shareCard.ts shareFile). */
  private shareBlob?: Blob;
  private async sendShare() {
    if (!this.shareBlob || !this.shareInput) return;
    await shareFile(this.shareBlob, `arcade-survival-${this.shareInput.fighter}.png`);
  }
  private closeShare() {
    const box = this.root.querySelector<HTMLElement>('#sv-sharebox');
    if (!box || box.classList.contains('hidden')) return;
    box.classList.add('hidden');
    this.root.querySelector<HTMLButtonElement>('#sv-share')?.focus();
  }

  private retryFor(host: boolean) {
    const retry = this.root.querySelector<HTMLButtonElement>('#sv-retry')!;
    // Round 5 (UX): one label for playing again in every mode (src/ui/results); co-op's goes through its lobby.
    const label = host ? 'PLAY AGAIN <span>↻</span>' : 'WAITING FOR THE HOST';
    if (retry.innerHTML !== label) retry.innerHTML = label;
    retry.disabled = !host;
  }

  private text(id: string, value: string) { const el = this.root.querySelector('#' + id); if (el && el.textContent !== value) el.textContent = value; }
  private fill(id: string, value: number) { const el = this.root.querySelector<HTMLElement>('#' + id); if (el) el.style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`; }
}

/** 1 → I, 14 → XIV. */
function roman(n: number) {
  let out = '';
  for (const [value, letters] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']] as const) while (n >= value) { out += letters; n -= value; }
  return out || 'I';
}
