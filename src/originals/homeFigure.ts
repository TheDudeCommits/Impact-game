import type { FighterId } from '../game/types';

export const IMPACT_FIGURE: Readonly<Partial<Record<FighterId, readonly [number, number?]>>> = {
  kagari:[0.7822],shiun:[0.8659],shakugo:[0.918],akayuri:[0.7443],sekka:[0.8027],'full-beam':[0.9395],'shibuichi':[0.9297],
  tokan:[0.877],cardo:[0.6885],rotfalke:[0.9453],pyroclast:[0.8422],barrow:[0.9434],'basilissa':[0.709],shanxiao:[0.9414],
  shidare:[0.8151],aqrab:[0.8828],ampere:[0.8027],kuzu:[0.7718],oro:[0.8607],strappado:[0.9453],'shakudo':[0.7614],
  bellows:[0.9426],adad:[0.9434],hawser:[0.7878],highsun:[0.9316],hisame:[0.7764],hagure:[0.8364],wataame:[0.8312],
  'gohaku':[0.8812],kuon:[0.8641],taisei:[0.7942],'wuming':[0.7925],'jinlin':[0.7305],gaku:[0.69],vesper:[0.8333],
  irbis:[0.853],gaunt:[0.9336],hikui:[0.714],suzuran:[0.7322],unari:[0.8804],nigo:[0.7209],tobari:[0.8112],oyashio:[0.832],
  hakushi:[0.8741],jirenga:[0.9355],kinu:[0.8013],gosu:[0.8254],koko:[0.8203],gorai:[0.9121],'ovid':[0.9277],
  shirokane:[0.822],'rakucho':[0.7731],onigawara:[0.918],setsu:[0.708],senko:[0.9414],ward:[0.8723],levin:[0.672],gummy:[0.7796],
  akagane:[0.8123],kubiwa:[0.7878],lanthorn:[0.7123],imago:[0.8831],'madake':[0.8434],strix:[0.9004],mizuhiki:[0.6104],
  minase:[0.8364],sorayomi:[0.7894],sashigane:[0.8403],konta:[0.7549],bonsho:[0.7769],'psyche':[0.8658],svanhild:[0.6751],
  amagoi:[0.8469],yodaka:[0.8203],dorado:[0.8203],shijima:[0.684],ippon:[0.8109],ume:[0.7472],kosho:[0.8169],
  shiden:[0.7672],sorrel:[0.7221],murex:[0.9453],magatsu:[0.8566],'rook':[0.8259],asahi:[0.7093],torsion:[0.5909,0.0524],
  tancho:[0.8169],chohan:[0.8712],kusushi:[0.7894],tsubute:[0.8604],ouga:[0.8203],haldor:[0.9238],hinomoto:[0.7302],
  buna:[0.9336],bruin:[0.7674],mikage:[0.7592],tempo:[0.8088],aquilo:[0.7987],akaito:[0.8078],kenzo:[0.6793],
};
/** The share of the preview a figure keeps clear of at the top and at each side. */
const CLEAR = .03;

type Timing = { frameTimesMs: number[]; loopMs: number };
/** A sprite manifest row, as public/assets/home/sprites/manifest.json has it in the repository (the build keeps no bounds). */
export type FigureRow = { id: string; frameCount?: number; heroFrame?: number; cellWidth?: number; cellHeight?: number;
  frames?: { frame: number; bounds?: number[] }[]; motionTiming?: Timing; timing?: Timing };

/** How long each cel is shown in a loop: the sheet's timing, else HomePreview.poseFrame's schedule for a sixteen-cel sheet
 *  (half a second on the first, the signature pose held a second, the rest at their steps), else the hero cel alone. */
function durations(row: FigureRow, count: number): number[] {
  const timing = row.motionTiming ?? row.timing, out = Array<number>(count).fill(0);
  if (timing && timing.frameTimesMs.length === count) {
    const t = [...timing.frameTimesMs, timing.loopMs];
    for (let i = 0; i < count; i++) out[i] = Math.max(0, t[i + 1] - t[i]);
    return out;
  }
  if (count === 16) { for (let i = 0; i < 16; i++) out[i] = i === 0 ? 500 : i < 7 ? 115 : i === 7 ? 1110 : i < 15 ? 145 : 285; return out; }
  out[row.heroFrame ?? 7] = 1; return out;
}
/** A sheet's own drawing from its manifest row's per-cel bounds, in cel pixels: [the figure's median standing height, how high its
 *  tallest cel reaches above the cel's floor, how far any cel reaches from the cel's middle to a side]. */
export function measureOwnFigure(row: FigureRow): [number, number, number] | null {
  if (!row.frames?.length) return null;
  const count = row.frameCount === 32 ? 32 : 16, cellWidth = row.cellWidth ?? 384, cellHeight = row.cellHeight ?? 512, time = durations(row, count);
  const cels = row.frames.flatMap(cel => cel.bounds && cel.frame < count ? [{ b: cel.bounds, t: time[cel.frame] }] : []);
  if (!cels.length) return null;
  const floor = Math.max(...cels.map(cel => cel.b[3])), standing = cels.filter(cel => cel.b[3] >= floor - 8 && cel.t > 0);
  const sorted = (standing.length ? standing : cels).map(cel => ({ h: cel.b[3] - cel.b[1], t: cel.t || 1 })).sort((a, b) => a.h - b.h);
  const total = sorted.reduce((sum, cel) => sum + cel.t, 0); let run = 0, median = sorted[sorted.length - 1].h;
  for (const cel of sorted) { run += cel.t; if (run >= total / 2) { median = cel.h; break; } }
  return [median, cellHeight - Math.min(...cels.map(cel => cel.b[1])), Math.max(...cels.map(cel => Math.max(cellWidth / 2 - cel.b[0], cel.b[2] - cellWidth / 2)))];
}
export interface HomeFigureFit { scale: number; lift: number }
export const AS_DRAWN: HomeFigureFit = { scale: 1, lift: 0 };
/** How HomePreview draws a slot's figure: `scale` on the cel it would draw (`box` x `zoom` px tall, its floor on the preview's
 *  floor, centred), about the feet, and `lift` px off the floor (the animated figure's; the poster stands on the floor). `own` is the sheet's measure (measureOwnFigure), `reference` the
 *  preview's reference height (min(height, width x cel aspect)), `width` x `height` the preview, all in the same pixels. */
export function fitFigure(id: FighterId, own: readonly [number, number, number] | null | undefined, box: number, zoom: number, reference: number, width: number, height: number, cellHeight = 512): HomeFigureFit {
  const target = IMPACT_FIGURE[id];
  if (!target || !own || !(box > 0) || !(zoom > 0) || !(reference > 0)) return AS_DRAWN;
  const [median, reach, half] = own, drawn = box * zoom / cellHeight, lift = (target[1] ?? 0) * reference;
  const scale = Math.min(target[0] * reference / (median * drawn), ((1 - CLEAR) * height - lift) / (reach * drawn), (1 - CLEAR) * width / 2 / (half * drawn));
  return Number.isFinite(scale) && scale > 0 ? { scale, lift } : AS_DRAWN;
}
