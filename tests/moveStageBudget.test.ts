import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { MOVES } from '../src/game/moves';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { BellowsStoked } from '../src/render/signature/BellowsStoked';
import { BarrowEmperor } from '../src/render/signature/BarrowEmperor';
import { TsubutePopGreen } from '../src/render/signature/TsubutePopGreen';
import { OnigawaraPressure } from '../src/render/signature/OnigawaraPressure';
import { ShidareSteelPetalCut } from '../src/render/signature/ShidareSteelPetalCut';
import { IrbisBaredFangs } from '../src/render/signature/IrbisBaredFangs';
import { ShijimaSnowfall } from '../src/render/signature/ShijimaSnowfall';
import { HinomotoBlaze } from '../src/render/signature/HinomotoBlaze';
import { MikageHacklesUp } from '../src/render/signature/MikageHacklesUp';
import { ShanxiaoRampage } from '../src/render/signature/ShanxiaoRampage';
import { HagureSnapBite } from '../src/render/signature/HagureSnapBite';
import { TorsionPsychic } from '../src/render/signature/TorsionPsychic';
import { HawserColossus } from '../src/render/signature/HawserColossus';
import { MizuhikiGRAPPLE } from '../src/render/signature/MizuhikiGRAPPLE';
import { StrixBearpawCut } from '../src/render/signature/StrixBearpawCut';
import { StrappadoStrings } from '../src/render/signature/StrappadoStrings';
import { AqrabDesert } from '../src/render/signature/AqrabDesert';
import { SenkoGlint } from '../src/render/signature/SenkoGlint';
import { ShakugoMagma } from '../src/render/signature/ShakugoMagma';
import { TokanIce } from '../src/render/signature/TokanIce';
import { AdadThunder } from '../src/render/signature/AdadThunder';
import { BunaOni } from '../src/render/signature/BunaOni';
import { BoaEmpress } from '../src/render/signature/BoaEmpress';
import { SorayomiWeather } from '../src/render/signature/SorayomiWeather';
import { PsycheFleur } from '../src/render/signature/PsycheFleur';
import { OyashioKarate } from '../src/render/signature/OyashioKarate';
import { VfxKit } from '../src/render/vfx/VfxKit';
import { ChohanAllIn } from '../src/render/signature/ChohanAllIn';
import { TempoDarkSpark } from '../src/render/signature/TempoDarkSpark';
import { AkaitoGhostBride } from '../src/render/signature/AkaitoGhostBride';
import { SashiganeRatio } from '../src/render/signature/SashiganeRatio';
import { AmpereSurge } from '../src/render/signature/AmpereSurge';
import { PyroclastExplosions } from '../src/render/signature/PyroclastExplosions';
import { TanchoPhosphor } from '../src/render/signature/TanchoPhosphor';
import { FullBeamPressure } from '../src/render/signature/FullBeamPressure';
import { YodakaFlameArt } from '../src/render/signature/YodakaFlameArt';
import { KuzuChainsaw } from '../src/render/signature/KuzuChainsaw';
import { RakuchoTendrils } from '../src/render/signature/RakuchoTendrils';
import { HikuiDarknessFlame } from '../src/render/signature/HikuiDarknessFlame';
import { AkayuriNightblade } from '../src/render/signature/AkayuriNightblade';
import { HisameWhiteoutGlassCoffin } from '../src/render/signature/HisameWhiteoutGlassCoffin';
import { RotfalkeField } from '../src/render/signature/RotfalkeField';
import { MurexBarrier } from '../src/render/signature/MurexBarrier';
import { ShakudoAlchemy } from '../src/render/signature/ShakudoAlchemy';
import { MinaseRaijin } from '../src/render/signature/MinaseRaijin';
import { MadakeGates } from '../src/render/signature/MadakeGates';
import { AmagoiGravity } from '../src/render/signature/AmagoiGravity';
import { HakushiToadSage } from '../src/render/signature/HakushiToadSage';
import { KusushiStrength } from '../src/render/signature/KusushiStrength';
import { KubiwaControl } from '../src/render/signature/KubiwaControl';
import { SuzuranTwinLions } from '../src/render/signature/SuzuranTwinLions';
import { UmeBlossom } from '../src/render/signature/UmeBlossom';
import { BonshoBodhisattva } from '../src/render/signature/BonshoBodhisattva';
import { UnariBungeeGum } from '../src/render/signature/UnariBungeeGum';
import { LanthornLampblack } from '../src/render/signature/LanthornLampblack';
import { HighsunSun } from '../src/render/signature/HighsunSun';
import { ShibuichiBastion } from '../src/render/signature/ShibuichiBastion';
import { KinuStoneThread } from '../src/render/signature/KinuStoneThread';
import { GosuRestoration } from '../src/render/signature/GosuRestoration';
import { WataameSilverSoul } from '../src/render/signature/WataameSilverSoul';
import { OvidFortitude } from '../src/render/signature/OvidFortitude';

type Pool = 'flames' | 'glows' | 'bolts' | 'lights' | 'discs' | 'shells' | 'shots';
const POOLS: readonly Pool[] = ['flames', 'glows', 'bolts', 'lights', 'discs', 'shells', 'shots'];
function body(id: string, fighter: FighterId, z = 0): Fighter {
  const group = new THREE.Group(); group.position.z = z;
  const head = new THREE.Object3D(); head.position.set(0, 1.7, z);
  return { group, handR: new THREE.Vector3(.3, 1.3, z + .2), handL: new THREE.Vector3(-.3, 1.3, z + .2), strikePoint: (out: THREE.Vector3) => out.set(.3, 1.3, z + .6), drawnJoint: () => head,
    state: { id, fighter, alive: true, action: 'idle', actionSeq: 2, actionTime: 0, actionDuration: 1, yaw: 0 } as PlayerState } as unknown as Fighter;
}
function ultimate(fighter: FighterId, make: (scene: THREE.Scene) => { handle(e: CombatEvent, f?: ReadonlyMap<string, Fighter>): void; update(t: number, f: ReadonlyMap<string, Fighter>, fl: ReadonlyMap<string, Flight>): void; dispose(): void }) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget: 1 }), fx = make(scene), move = MOVES[fighter].ultimate;
  const actor = body('a', fighter), foe = body('v', 'taisei', 2.2), fighters = new Map([['a', actor], ['v', foe]]), flights = new Map<string, Flight>();
  const peak: Record<Pool, number> = { flames: 0, glows: 0, bolts: 0, lights: 0, discs: 0, shells: 0, shots: 0 };
  const event = (kind: CombatEvent['kind'], contactIndex: number, at: number, id: number): CombatEvent => ({ id, kind, fighter, actorId: 'a', targetId: 'v', actionSeq: 2, slot: 'ultimate', contactIndex, serverTime: 10 + at, endpoint: { x: 0, y: 1.2, z: 2.2 } });
  let landed = 0;
  try {
    for (let frame = 0; frame <= (move.duration + 3.5) * 60; frame++) {
      const t = frame / 60;
      if (t <= move.duration) Object.assign(actor.state, { action: 'ultimate', actionDuration: move.duration, actionTime: t / move.duration, ...(landed ? { confirmedAt: 10 + move.contacts[0] } : {}) });
      else Object.assign(actor.state, { action: 'idle', actionTime: 0 });
      while (landed < move.contacts.length && t >= move.contacts[landed]) {
        if (landed === 0) fx.handle(event('confirm', 0, move.contacts[0], 1), fighters);
        fx.handle(event('hit', landed, move.contacts[landed], 10 + landed), fighters); landed++;
      }
      fx.update(10 + t, fighters, flights);
      for (const pool of POOLS) peak[pool] = Math.max(peak[pool], stage.counts[pool]);
    }
    expect(stage.counts.shots, 'everything spent after the move').toBe(0);
  } finally { fx.dispose(); stage.release(); }
  return peak;
}

describe('what a pilot\'s ultimate asks of the shared stage at its busiest frame', () => {
  it.each([
    ['bellows', (scene: THREE.Scene) => new BellowsStoked(scene, { budget: 1 })],
    ['barrow', (scene: THREE.Scene) => new BarrowEmperor(scene, { budget: 1 })],
    ['tsubute', (scene: THREE.Scene) => new TsubutePopGreen(scene, { budget: 1 })],
    ['onigawara', (scene: THREE.Scene) => new OnigawaraPressure(scene, { budget: 1 })],
    ['shidare', (scene: THREE.Scene) => new ShidareSteelPetalCut(scene, { budget: 1 })],
    ['irbis', (scene: THREE.Scene) => new IrbisBaredFangs(scene, { budget: 1 })],
    ['shijima', (scene: THREE.Scene) => new ShijimaSnowfall(scene, { budget: 1 })],
    ['hinomoto', (scene: THREE.Scene) => new HinomotoBlaze(scene, { budget: 1 })],
    ['mikage', (scene: THREE.Scene) => new MikageHacklesUp(scene, { budget: 1 })],
    ['shanxiao', (scene: THREE.Scene) => new ShanxiaoRampage(scene, { budget: 1 })],
    ['hagure', (scene: THREE.Scene) => new HagureSnapBite(scene, { budget: 1 })],
    ['torsion', (scene: THREE.Scene) => new TorsionPsychic(scene, { budget: 1 })],
    ['hawser', (scene: THREE.Scene) => new HawserColossus(scene, { budget: 1 })],
    ['mizuhiki', (scene: THREE.Scene) => new MizuhikiGRAPPLE(scene, { budget: 1 })],
    ['strix', (scene: THREE.Scene) => new StrixBearpawCut(scene, { budget: 1 })],
    ['strappado', (scene: THREE.Scene) => new StrappadoStrings(scene, { budget: 1 })],
    ['aqrab', (scene: THREE.Scene) => new AqrabDesert(scene, { budget: 1 })],
    ['senko', (scene: THREE.Scene) => new SenkoGlint(scene, { budget: 1 })],
    ['shakugo', (scene: THREE.Scene) => new ShakugoMagma(scene, { budget: 1 })],
    ['tokan', (scene: THREE.Scene) => new TokanIce(scene, { budget: 1 })],
    ['adad', (scene: THREE.Scene) => new AdadThunder(scene, { budget: 1 })],
    ['buna', (scene: THREE.Scene) => new BunaOni(scene, { budget: 1 })],
    ['basilissa', (scene: THREE.Scene) => new BoaEmpress(scene, { budget: 1 })],
    ['sorayomi', (scene: THREE.Scene) => new SorayomiWeather(scene, VfxKit.for(scene))],
    ['psyche', (scene: THREE.Scene) => new PsycheFleur(scene, { budget: 1 })],
    ['oyashio', (scene: THREE.Scene) => new OyashioKarate(scene, { budget: 1 })],
    ['chohan', (scene: THREE.Scene) => new ChohanAllIn(scene, { budget: 1 })],
    ['tempo', (scene: THREE.Scene) => new TempoDarkSpark(scene, { budget: 1 })],
    ['akaito', (scene: THREE.Scene) => new AkaitoGhostBride(scene, { budget: 1 })],
    ['sashigane', (scene: THREE.Scene) => new SashiganeRatio(scene, { budget: 1 })],
    ['ampere', (scene: THREE.Scene) => new AmpereSurge(scene, { budget: 1 })],
    ['pyroclast', (scene: THREE.Scene) => new PyroclastExplosions(scene, { budget: 1 })],
    ['tancho', (scene: THREE.Scene) => new TanchoPhosphor(scene, { budget: 1 })],
    ['full-beam', (scene: THREE.Scene) => new FullBeamPressure(scene, { budget: 1 })],
    ['yodaka', (scene: THREE.Scene) => new YodakaFlameArt(scene, { budget: 1 })],
    ['kuzu', (scene: THREE.Scene) => new KuzuChainsaw(scene, { budget: 1 })],
    ['rakucho', (scene: THREE.Scene) => new RakuchoTendrils(scene, { budget: 1 })],
    ['hikui', (scene: THREE.Scene) => new HikuiDarknessFlame(scene, { budget: 1 })],
    ['akayuri', (scene: THREE.Scene) => new AkayuriNightblade(scene, { budget: 1 })],
    ['hisame', (scene: THREE.Scene) => new HisameWhiteoutGlassCoffin(scene, { budget: 1 })],
    ['rotfalke', (scene: THREE.Scene) => new RotfalkeField(scene, { budget: 1 })],
    ['murex', (scene: THREE.Scene) => new MurexBarrier(scene, { budget: 1 })],
    ['shakudo', (scene: THREE.Scene) => new ShakudoAlchemy(scene, { budget: 1 })],
    ['minase', (scene: THREE.Scene) => new MinaseRaijin(scene, { budget: 1 })],
    ['madake', (scene: THREE.Scene) => new MadakeGates(scene, { budget: 1 })],
    ['amagoi', (scene: THREE.Scene) => new AmagoiGravity(scene, { budget: 1 })],
    ['hakushi', (scene: THREE.Scene) => new HakushiToadSage(scene, { budget: 1 })],
    ['kusushi', (scene: THREE.Scene) => new KusushiStrength(scene, { budget: 1 })],
    ['kubiwa', (scene: THREE.Scene) => new KubiwaControl(scene, { budget: 1 })],
    ['suzuran', (scene: THREE.Scene) => new SuzuranTwinLions(scene, { budget: 1 })],
    ['ume', (scene: THREE.Scene) => new UmeBlossom(scene, { budget: 1 })],
    ['bonsho', (scene: THREE.Scene) => new BonshoBodhisattva(scene, { budget: 1 })],
    ['unari', (scene: THREE.Scene) => new UnariBungeeGum(scene, { budget: 1 })],
    ['lanthorn', (scene: THREE.Scene) => new LanthornLampblack(scene, { budget: 1 })],
    ['highsun', (scene: THREE.Scene) => new HighsunSun(scene, { budget: 1 })],
    ['shibuichi', (scene: THREE.Scene) => new ShibuichiBastion(scene, { budget: 1 })],
    ['kinu', (scene: THREE.Scene) => new KinuStoneThread(scene, { budget: 1 })],
    ['gosu', (scene: THREE.Scene) => new GosuRestoration(scene, { budget: 1 })],
    ['wataame', (scene: THREE.Scene) => new WataameSilverSoul(scene, { budget: 1 })],
    ['ovid', (scene: THREE.Scene) => new OvidFortitude(scene, { budget: 1 })],
  ] as const)('%s stays under half of every pool', (fighter, make) => {
    const peak = ultimate(fighter as FighterId, make);
    if (process.env.STAGE_BUDGET_PRINT) console.info(`${fighter} ultimate, busiest frame: ${JSON.stringify(peak)}`);
    // Something of the move's every beat was drawn...
    expect(peak.glows).toBeGreaterThan(4); expect(peak.lights).toBeGreaterThan(2); expect(peak.shots).toBeGreaterThan(2);
    // ...and no pool is half taken by one fighter.
    for (const pool of POOLS) expect(peak[pool], `${fighter} ${pool} ${JSON.stringify(peak)}`).toBeLessThanOrEqual(STAGE_LIMITS[pool] / 2);
  });
});
