import { bossPortrait } from './bossArt';
/** A downloadable 1200×630 ending spread, drawn from the same score, fighter
 * and boss portraits as the results screen. Same-origin art keeps it exportable. */
import type { FighterId } from '../../game/types';
import { FIGHTERS } from '../../config';
import type { RunResult } from '../../survival/SurvivalGame';
import { RANKS as STYLE_RANKS } from '../../survival/style';
import { resultFighterArt } from './resultArt';
import { prefetchResultLink, resultLink } from '../results/resultLink';
import { SITE_URL, TITLE } from '../../originals/brand';

export interface ShareCardInput {
  result: RunResult; fighter: FighterId;
  title: string; sub: string; epitaph: string;
  /** The panel over it: the place it fell (drained red) or the seal's. */
  art: string; fallen: boolean;
  /** The fighter's mastery, said small in the corner. */
  mastery?: string;
}

export const CARD_W = 1200, CARD_H = 630;
const INK = '#141414', PAPER = '#f7f4ed', RED = '#d91e36';
const GROUPED = new Intl.NumberFormat('en-US');
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const IMPACT = 'Impact, "Anton", "Arial Black", sans-serif', CONDENSED = '"Barlow Condensed", "Arial Narrow", sans-serif';

function image(src: string) {
  return new Promise<HTMLImageElement | undefined>(resolve => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img); img.onerror = () => resolve(undefined);
    img.src = src;
  });
}
/** An image drawn to cover the box, cropped round `focusY` (0 top, 1 bottom). */
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, focusY = .4) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight), sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, Math.max(0, (img.naturalHeight - sh) * focusY), sw, sh, x, y, w, h);
}
/** The box's pixels in grey, harder: the results panel's filter, by hand (Safari has no ctx.filter). */
function ink(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, contrast = 1.15, bright = 1) {
  const data = ctx.getImageData(x, y, w, h), px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const g = ((px[i] * .299 + px[i + 1] * .587 + px[i + 2] * .114) - 128) * contrast + 128;
    px[i] = px[i + 1] = px[i + 2] = Math.max(0, Math.min(255, g * bright));
  }
  ctx.putImageData(data, x, y);
}
function skewText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number) {
  ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, -.12, 1, 0, 0);
  ctx.fillText(text, 0, 0, maxW); ctx.restore();
}

/** A card's parts (drawCard): the left column - the place's art drained to ink, the fighter over it, the key number at
 *  its foot - and the right - the verdict, its line, four numbers, a row of faces or the art again, and the footer with
 *  the game's address. Arcade Survival's run fills it (drawShareCard) and every other mode's results (ui/results/
 *  shareResult.ts). */
export interface CardSpec {
  art?: string; fighter: FighterId; accent: string;
  /** The left column's top line: the mode, and what stands right of it (CH. 03 / S, a way to play). */
  corner: [string, string];
  /** The key number at the left column's foot, under its label. */
  key: { label: string; value: string };
  heading: string; title: string; sub: string; epitaph: string;
  /** Up to four [value, label]. */
  stats: readonly [string, string][];
  /** The row under the numbers: faces (a run's bosses), or the art again when there are none. */
  lower: { label: string; faces: { src: string; name: string; marked: boolean }[]; more: number };
  footer: string;
}
export const CARD_ADDRESS = SITE_URL.replace(/^https?:\/\//, '');

/** The same ending spread as the results overlay, composed from its real art. */
export async function drawShareCard(input: ShareCardInput): Promise<HTMLCanvasElement> {
  // (Player Two's link for the picture's SHARE, asked for now, while the card is drawn: resultLink.ts.)
  prefetchResultLink();
  const { result, fighter } = input, log = result.bossLog ?? [], shown = log.slice(0, 7);
  const style = STYLE_RANKS[Math.max(0, Math.min(STYLE_RANKS.length - 1, result.bestRank))]?.letter ?? 'D';
  return drawCard({
    art: input.art, fighter, accent: result.victory ? '#ad7410' : RED,
    corner: ['ARCADE SURVIVAL', `CH. ${String(result.round).padStart(2, '0')} / ${result.rank}`],
    key: { label: 'FINAL SCORE', value: GROUPED.format(Math.round(result.score)) },
    heading: `${FIGHTERS[fighter].name.toUpperCase()}  /  ${result.party ? 'CO-OP' : 'SOLO'} SURVIVAL`,
    title: input.title, sub: input.sub, epitaph: input.epitaph,
    stats: [[GROUPED.format(result.ownKills ?? result.kills), result.party ? 'YOUR KOs' : 'KNOCKOUTS'], [style, 'BEST STYLE'], [clock(result.seconds), 'SURVIVED'], [String(result.bosses), 'BOSSES']],
    lower: { label: log.length ? 'BOSSES DEFEATED' : 'THE NEXT CHAPTER AWAITS', faces: shown.map(b => ({ src: bossPortrait(b.id), name: b.name, marked: !!b.finished })), more: log.length - shown.length },
    footer: input.mastery ?? `MAX COMBO ${result.bestCombo}  /  DAMAGE ${GROUPED.format(Math.round(result.damageDealt))}`,
  });
}

/** A card drawn from its parts (CardSpec): 1200×630, same-origin art only, so it can be exported. */
export async function drawCard(spec: CardSpec): Promise<HTMLCanvasElement> {
  const {fighter}=spec,canvas=document.createElement('canvas');canvas.width=CARD_W;canvas.height=CARD_H;
  const ctx=canvas.getContext('2d')!;
  try{await Promise.all([document.fonts.load(`800 24px ${CONDENSED}`),document.fonts.load(`900 24px ${IMPACT}`)]);}catch{/* platform fallbacks */}
  const shown=spec.lower.faces;
  const [art,portrait,...faces]=await Promise.all([spec.art?image(spec.art):Promise.resolve(undefined),image(resultFighterArt(fighter)),...shown.map(b=>image(b.src))]);
  const accent=spec.accent,left=350;
  ctx.fillStyle=PAPER;ctx.fillRect(0,0,CARD_W,CARD_H);ctx.fillStyle=INK;ctx.fillRect(0,0,left,CARD_H);
  if(art){cover(ctx,art,0,0,left,CARD_H);ink(ctx,0,0,left,CARD_H,1.2,.42);}
  if(portrait){
    ctx.save();ctx.beginPath();ctx.rect(0,64,left,440);ctx.clip();
    cover(ctx,portrait,-70,64,left+140,520,0);
    ink(ctx,0,64,left,440,1.15);ctx.restore();
  }
  const fade=ctx.createLinearGradient(0,300,0,570);fade.addColorStop(0,'#14141400');fade.addColorStop(.7,'#141414ee');fade.addColorStop(1,INK);ctx.fillStyle=fade;ctx.fillRect(0,260,left,CARD_H-260);
  ctx.fillStyle='#fff';ctx.font=`800 16px ${CONDENSED}`;ctx.fillText(spec.corner[0],24,35,left/2);ctx.textAlign='right';ctx.fillText(spec.corner[1],left-24,35,left/2-36);ctx.textAlign='left';
  ctx.strokeStyle='#ffffff55';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(24,49);ctx.lineTo(left-24,49);ctx.stroke();
  ctx.fillStyle='#ddd';ctx.font=`800 17px ${CONDENSED}`;ctx.fillText(spec.key.label,26,493,left-50);ctx.fillStyle='#fff';ctx.font=`italic 900 73px ${IMPACT}`;ctx.fillText(spec.key.value,24,571,left-48);
  ctx.fillStyle=accent;ctx.fillRect(left,0,5,CARD_H);
  const x=390,right=CARD_W-38,width=right-x;
  ctx.fillStyle=accent;ctx.font=`800 17px ${CONDENSED}`;ctx.fillText(spec.heading,x,49,width);
  // Preserve long party outcomes with two lines, without crushing the lettering.
  const words=spec.title.split(' '),lines:string[]=[];let line='';ctx.font=`italic 900 59px ${IMPACT}`;
  for(const word of words){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>width){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
  const titleLines=lines.length<=2?lines:[lines[0],lines.slice(1).join(' ')];titleLines.forEach((value,i)=>{ctx.fillStyle=INK;skewText(ctx,value,x+3,116+i*59,width-10);});
  const after=titleLines.length>1?204:164;
  ctx.fillStyle=INK;ctx.font=`800 18px ${CONDENSED}`;ctx.fillText(spec.sub,x,after,width);
  ctx.fillStyle='#67635f';ctx.font=`600 14px ${CONDENSED}`;ctx.fillText(spec.epitaph,x,after+24,width);
  ctx.strokeStyle='#141414';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,after+44);ctx.lineTo(right,after+44);ctx.stroke();
  const columns=Math.max(3,spec.stats.length);
  const y=after+94;spec.stats.slice(0,4).forEach(([value,label],i)=>{const sx=x+i*(width/columns);ctx.fillStyle=INK;ctx.font=`italic 900 43px ${IMPACT}`;ctx.fillText(value,sx,y,width/columns-14);ctx.fillStyle='#62615d';ctx.font=`800 14px ${CONDENSED}`;ctx.fillText(label,sx,y+25,width/columns-14);});
  const by=after+156;ctx.fillStyle='#666';ctx.font=`800 14px ${CONDENSED}`;ctx.fillText(spec.lower.label,x,by,width-120);
  const size=72;shown.forEach((boss,i)=>{const bx=x+i*105,top=by+14;ctx.fillStyle='#e3dfd7';ctx.fillRect(bx,top,size,size);if(faces[i]){cover(ctx,faces[i]!,bx,top,size,size,.3);ink(ctx,bx,top,size,size,1.1);}ctx.strokeStyle=boss.marked?accent:INK;ctx.lineWidth=2;ctx.strokeRect(bx,top,size,size);ctx.fillStyle=boss.marked?accent:INK;ctx.font=`800 12px ${CONDENSED}`;ctx.fillText(boss.name.toUpperCase(),bx,top+88,99);});
  if(!shown.length&&art){const top=by+18,height=550-top;ctx.save();ctx.globalAlpha=.55;cover(ctx,art,x,top,width,height,.55);ctx.restore();ink(ctx,x,top,width,height,1.05);}
  if(spec.lower.more>0){ctx.textAlign='right';ctx.fillStyle='#555';ctx.font=`800 14px ${CONDENSED}`;ctx.fillText(`+ ${spec.lower.more} MORE`,right,by);ctx.textAlign='left';}
  ctx.strokeStyle='#14141433';ctx.beginPath();ctx.moveTo(x,575);ctx.lineTo(right,575);ctx.stroke();ctx.fillStyle='#555';ctx.font=`800 16px ${CONDENSED}`;ctx.fillText(spec.footer,x,604,width-390);
  ctx.textAlign='right';ctx.fillStyle=accent;ctx.font=`italic 900 23px ${IMPACT}`;ctx.fillText(TITLE.toUpperCase(),right,605,110);
  ctx.fillStyle=INK;ctx.font=`800 18px ${CONDENSED}`;ctx.fillText(CARD_ADDRESS,right-118,604,250);ctx.textAlign='left';
  ctx.lineWidth=6;ctx.strokeStyle=INK;ctx.strokeRect(3,3,CARD_W-6,CARD_H-6);return canvas;
}

export const cardBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

/** The device's share sheet with the picture, where there is one that takes files: its words and the link back to the
 *  game with it (ui/results/shareResult.ts resultLink). Called straight from the press, with the picture already made:
 *  Safari shares only inside the press. */
export async function shareFile(blob: Blob, name: string, words: { title: string; text: string } = { title: `Arcade Survival · ${TITLE}`, text: `My Arcade Survival run in ${TITLE}.` }) {
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
  try { await nav.share({ files: [file], ...words, url: resultLink() }); return true; } catch { return false; }
}
export function canShareFiles() {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  try { return !!nav.share && !!nav.canShare?.({ files: [new File([new Blob()], 'x.png', { type: 'image/png' })] }); } catch { return false; }
}
