import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES } from '../src/game/moves';
import type { FighterId } from '../src/game/types';

const ROSTER = Object.keys(MOVES) as FighterId[];
const CONFIRM = ROSTER.filter(f => MOVES[f].ultimate.confirm);
const DT = 1 / 60;
/** What a standing opponent took before this round, whole ultimate. (Hawser's is the Scout's Slipped Moorings since 13 October
 *  2026: Levin's SOJI: Clean Sweep at nine tenths, 259 of his 290 off a standing opponent and 331 of his 368 from a side in
 *  arcade survival; the 300 it was is the YUGE's now, awakened: tests/hawserSharedIntegration.test.ts.) */
const TOTALS: Record<FighterId, number> = { cardo:290,bruin:290,aquilo:290,svanhild:290,chohan:290,tsubute:290,aqrab:300,yodaka:290,'psyche':290,'ovid':300,hawser:259,rotfalke:290,bonsho:290,murex:290,kinu:290,'madake':300,akayuri:290,hagure:290,hisame:290,mizuhiki:290,'shibuichi':300,'rakucho':290,irbis:290,shidare:290,hinomoto:300,amagoi:290,'shakudo':300,minase:290,onigawara:290,kubiwa:290,torsion:300,highsun:300,lanthorn:290,ume:290,hikui:290,tokan:300,strappado:300,unari:290,barrow:300,sashigane:300,gosu:290,kusushi:290,hakushi:290,suzuran:290,wataame:290,senko:290,buna:300,oyashio:300,adad:290, 'full-beam':300,pyroclast:290,ampere:285,akaito:290, shijima:290, tempo:290, tancho:290,bellows:300,mikage:290, shanxiao: 290, kuzu: 290, shakugo: 299, 'basilissa': 282, sorayomi: 290, strix: 290, kenzo: 295, koko: 305, nigo: 295, shirokane: 285, shiden: 290, kosho: 290, ouga: 290, taisei: 285,
  gummy: 295, konta: 270, kagari: 290, ward: 290, kuon: 315, oro: 310, gaunt: 331, setsu: 225,
  // The shop's fighters: no more than the roster's (bought, not better).
  gorai: 290, haldor: 290, sorrel: 290, dorado: 290, shiun: 290, magatsu: 290, vesper: 290, imago: 290, 'wuming': 290, jirenga: 290, 'jinlin': 290, 'gohaku': 290, ippon: 290, sekka: 290, tobari: 290, akagane: 290, asahi: 290, levin: 290, 'rook': 290, gaku: 290 };

/** The ultimate thrown at a standing opponent 2 m off: every blow, when and
 *  for how much. */
function landed(fighter: FighterId) {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 7 });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', fighter === 'taisei' ? 'ouga' : 'taisei', 'B', false, { x: 0, y: 0, z: 2 });
  sim.actors.get('a')!.state.ultimate = 100;
  const blows: { t: number; damage: number; contact: number }[] = [];
  let confirm = Infinity;
  for (let i = 0; i < 60 * 5; i++) {
    sim.submitInput('a', { seq: i + 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: i === 0 ? 'ultimate' : undefined });
    sim.step(DT);
    for (const e of sim.drainEvents()) {
      if (e.actorId !== 'a') continue;
      if (e.kind === 'hit' && e.targetId === 'b') blows.push({ t: (i + 1) * DT, damage: e.damage ?? 0, contact: e.contactIndex ?? 0 });
      if (e.kind === 'confirm') confirm = Math.min(confirm, (i + 1) * DT);
    }
  }
  sim.dispose();
  return { blows, confirm, damage: blows.map(b => b.damage), total: blows.reduce((sum, b) => sum + b.damage, 0) };
}
const ALL = Object.fromEntries(ROSTER.map(f => [f, landed(f)])) as Record<FighterId, ReturnType<typeof landed>>;

describe('each ultimate lands its own schedule', () => {
  it('no two hit-confirm ultimates land the same blows', () => {
    const seen = new Map<string, FighterId>();
    for (const f of CONFIRM) {
      const key = ALL[f].damage.join('/');
      expect(seen.get(key), `${f} lands ${key}, as ${seen.get(key)} does`).toBeUndefined();
      seen.set(key, f);
    }
  });

  it.each(ROSTER)('%s takes what it took off a standing opponent', f => {
    expect(ALL[f].total).toBe(TOTALS[f]);
  });

  it('finish across a spread of times, not all two seconds after the press', () => {
    const finish = CONFIRM.map(f => ALL[f].blows.at(-1)!.t);
    expect(Math.max(...finish) - Math.min(...finish)).toBeGreaterThan(.8);
    expect(new Set(finish.map(t => Math.round(t * 10))).size, 'at a tenth of a second, most of them apart').toBeGreaterThanOrEqual(8);
  });

  it.each(CONFIRM)('%s: a schedule for every contact, opening on its opener\'s damage', f => {
    const move = MOVES[f].ultimate;
    if (!move.schedule) return;
    expect(move.schedule).toHaveLength(move.contacts.length);
    expect(move.schedule[0]).toBe(move.damage);
  });

  it.each(CONFIRM)('%s: a side in arcade survival deals what it did', f => {
    // A side throws every contact as `damage` and the last as
    // `finisherDamage`, unscaled on a horde (the survival agent's balance):
    // those two sum to what the round-3d ultimate dealt that way.
    const PLAIN: Partial<Record<FighterId, number>> = { cardo:290,bruin:290,aquilo:290,svanhild:290,chohan:290,tsubute:290,aqrab:300,yodaka:290,'psyche':290,'ovid':300,hawser:331,rotfalke:290,bonsho:290,murex:290,kinu:290,'madake':300,akayuri:290,hagure:290,hisame:290,mizuhiki:290,'shibuichi':300,'rakucho':290,irbis:290,shidare:290,hinomoto:300,amagoi:290,'shakudo':300,minase:290,onigawara:290,kubiwa:290,torsion:300,highsun:300,lanthorn:290,ume:290,hikui:290,tokan:300,strappado:300,unari:290,barrow:300,sashigane:300,gosu:290,kusushi:290,hakushi:290,suzuran:290,wataame:290,senko:290,buna:300,oyashio:300,adad:290, 'full-beam':300,pyroclast:290,ampere:285,akaito:290, shijima:290, tempo:290, tancho:290,bellows:300,mikage:290, shanxiao: 290, kuzu: 290, shakugo: 299, 'basilissa': 282, sorayomi: 290, strix: 290, kenzo: 375, koko: 565, nigo: 375, shirokane: 361, shiden: 368, kosho: 368, ouga: 368, gummy: 320,
      ward: 368, kuon: 433, oro: 579, gaunt: 454, setsu: 348,
      // The shop's fighters, at Ward's: bought, not better.
      gorai: 368, haldor: 368, sorrel: 368, dorado: 368, shiun: 368, magatsu: 368, vesper: 368, imago: 368, 'wuming': 368, jirenga: 368, 'gohaku': 368, ippon: 368, sekka: 368, tobari: 368, akagane: 368, asahi: 368, levin: 368, 'rook': 368, gaku: 368 };
    const move = MOVES[f].ultimate, first = move.timeStop ? move.timeStop.contact + 1 : 0, last = move.contacts.length - 1;
    let sum = 0;
    for (let i = first; i <= last; i++) sum += i === last ? move.finisherDamage ?? move.damage : move.damage;
    expect(sum).toBe(PLAIN[f]);
  });

  it.each(CONFIRM)('%s: the design\'s fast opener, and a cinematic long enough for its shot', f => {
    const move = MOVES[f].ultimate, open = move.contacts[0], finish = move.contacts.at(-1)!;
    expect(open, 'out by 0.6 s (the domes, drawn from the cast, by 0.7)').toBeLessThanOrEqual(f === 'kuon' || f === 'magatsu' ? .7 : .6);
    // The camera swings from the opener's push-in to the release shot over
    // half a second at least and holds it over the blows (CameraDirector).
    expect(finish - open, 'a second at least from the opener to the finisher').toBeGreaterThanOrEqual(1.05);
    expect(move.duration - finish, 'and a follow-through after it').toBeGreaterThanOrEqual(.6);
  });
});

describe('each ultimate\'s damage shape', () => {
  const gaps = (f: FighterId) => { const c = MOVES[f].ultimate.contacts; return c.slice(1).map((t, i) => t - c[i]); };
  it('Setsuna: Tsumuji is a barrage - many small blows, then the one that counts', () => {
    const { damage } = ALL.setsu;
    expect(damage.length).toBeGreaterThanOrEqual(8);
    expect(Math.max(...gaps('setsu').slice(1, -1))).toBeLessThanOrEqual(.15);
    expect(Math.max(...damage.slice(1, -1)), 'small').toBeLessThanOrEqual(15);
    expect(damage.at(-1)!).toBeGreaterThan(damage.slice(1, -1).reduce((a, b) => a + b, 0) * 1.5);
  });
  it('Kyokko-Ho pours through them: a stream of burns under the beam, and the blast', () => {
    const { damage } = ALL.ouga;
    expect(damage.length).toBeGreaterThanOrEqual(10);
    expect(Math.max(...gaps('ouga').slice(1, -1))).toBeLessThanOrEqual(.1);
    expect(damage.at(-1)!).toBeGreaterThan(150);
  });
  it('NIGHTFALL is one cut; Grand Tide a wind-up and one colossal punch', () => {
    for (const f of ['nigo', 'gummy'] as FighterId[]) {
      expect(ALL[f].damage, f).toHaveLength(2);
      expect(ALL[f].damage[1] / ALL[f].total, `${f}: nearly all of it in the one blow`).toBeGreaterThan(.8);
    }
    expect(gaps('gummy')[0], 'the fist blown up first').toBeGreaterThanOrEqual(1.4);
  });
  it('VOID SICKLE is a delayed rip: the blade\'s crackle, a long pull, the tear', () => {
    const { blows } = ALL.shirokane, last = blows.at(-1)!;
    expect(last.t - blows.at(-2)!.t, 'nothing lands for over a second before the rip').toBeGreaterThan(1);
    expect(last.damage).toBeGreaterThan(ALL.shirokane.total * .75);
  });
  it('Banquet Infernal is a building fire: each kick harder and sooner than the last, then the blaze', () => {
    const { damage } = ALL.kosho, kicks = damage.slice(1, -1), g = gaps('kosho').slice(0, -1);
    for (let i = 1; i < kicks.length; i++) expect(kicks[i], `kick ${i + 1}`).toBeGreaterThan(kicks[i - 1]);
    for (let i = 1; i < g.length; i++) expect(g[i], `gap ${i + 1}`).toBeLessThan(g[i - 1]);
    expect(damage.at(-1)!).toBeGreaterThan(kicks.reduce((a, b) => a + b, 0));
  });
  it('the Hound Rampage builds as well; Ikazuchi Arrow and Flatline Shock strike hard, few and late', () => {
    const swings = ALL.gaunt.damage.slice(2, -1);
    for (let i = 1; i < swings.length; i++) expect(swings[i]).toBeGreaterThan(swings[i - 1]);
    expect(ALL.shiden.damage[0], 'the arrow itself lands hard').toBeGreaterThanOrEqual(100);
    expect(ALL.shiden.damage).toHaveLength(2);
    expect(ALL.ward.damage).toHaveLength(3);
    expect(ALL.ward.blows[2].t - ALL.ward.blows[1].t, 'two jolts, close together').toBeLessThan(.3);
  });
  it('the RAKSHASA\'s nine blades cut at once: a silence, then three sweeps in a sixth of a second', () => {
    const { blows } = ALL.kenzo;
    expect(blows).toHaveLength(4);
    expect(blows[1].t - blows[0].t, 'the RAKSHASA rises').toBeGreaterThan(.8);
    expect(blows[3].t - blows[1].t).toBeLessThanOrEqual(.2);
  });
});
