import type { FighterId } from '../../game/types';
import { FighterStage } from '../../render/cosmetics/stage';
import type { ShopStage } from './Shop';

export class ShopPreview implements ShopStage {
  private stage?: FighterStage;
  show(host: HTMLElement, fighter: FighterId) {
    try { this.stage ??= new FighterStage(host, { look: 'harbor', paper: 0xffffff }); }
    catch { return; }   // (No WebGL to spare: the card's picture stands.)
    const stage = this.stage;
    stage.moveTo(host);
    host.classList.remove('drawn');
    // The four moves in turn, with the room round them to do it in, held at three-quarters front rather than turning
    // (a turn takes the moves away from the viewer).
    stage.dash = false; stage.moves = ['light', 'heavy', 'special', 'ultimate'];
    stage.spin = 0; stage.yaw = .45;
    stage.span = { across: 3, tall: 1.38 }; stage.level = .5; stage.lift = 0; stage.zoom = 1; stage.aim();
    stage.show_ = { kills: false, awake: false, awakeCycle: false, cycle: false, count: 0, style: 0 };
    stage.show(fighter, {}).then(() => { if (stage.canvas.parentElement === host) window.setTimeout(() => host.classList.add('drawn'), 60); }, () => undefined);
  }
  hide() { this.stage?.stop(); }
}
