import * as THREE from 'three';

export const TORSION_FLIGHT = Object.freeze({
  /** Speeds (m/s) between which she is still, drifting, and gliding flat out. */
  still: [.3, 1.2] as const, glide: [2.6, 6.5] as const,
  walk: { hz: .7, bob: .06, lean: deg(6), roll: deg(3), thigh: deg(-8), knee: deg(24), otherKnee: deg(12), swing: deg(7), arms: deg(6) },
  run: { hz: 1.5, bob: .025, lean: deg(10), thigh: deg(6), knee: deg(8), flutter: deg(7), arms: deg(16), lift: deg(14), stream: .75 },
  dash: { lean: deg(26), thigh: deg(-26), knee: deg(62), arms: deg(46), lift: deg(32), stream: .9, rise: 40, fall: 9 },
});
function deg(d: number) { return d * Math.PI / 180; }

export type FlightPose = {
  /** Metres added to the hips, straight up. */
  bob: number;
  /** About the travel heading's side axis (forward is positive) and about the heading itself. */
  lean: number; roll: number;
  /** Per leg [left, right]: thigh and knee, about her own side axis. */
  thigh: [number, number]; knee: [number, number];
  /** Both upper arms, back. */
  arms: number;
  /** How far the neck and head are raised against the lean, to look where she goes (her run clip bows the head). */
  lift: number;
  /** How much of her dress's hang toward the floor is let go (hemDrape `hangScale`): at a glide and a dash it streams
   *  back along her body and legs, as it should in flight. */
  stream: number;
  /** 0 when she is still or not travelling: nothing to apply. */
  weight: number;
};

const smooth = THREE.MathUtils.smoothstep;
/** The layer's state: the eased weights of the three and the bob's phase. One per Torsion body. */
export class TorsionFlight {
  phase = 0; moving = 0; glide = 0; dash = 0;
  private readonly pose: FlightPose = { bob: 0, lean: 0, roll: 0, thigh: [0, 0], knee: [0, 0], arms: 0, lift: 0, stream: 0, weight: 0 };
  /** `speed` is the body's drawn ground speed; `action` the simulation's. `dt` of zero holds the pose (a hitstop). */
  update(dt: number, speed: number, action: string): FlightPose {
    const F = TORSION_FLIGHT, p = this.pose;
    const travelling = action === 'run' ? smooth(speed, F.still[0], F.still[1]) : 0;
    const dashing = action === 'dash' ? 1 : 0;
    if (dt > 0) {
      this.moving += (travelling - this.moving) * (1 - Math.exp(-dt * 7));
      this.glide += (smooth(speed, F.glide[0], F.glide[1]) - this.glide) * (1 - Math.exp(-dt * 5));
      this.dash += (dashing - this.dash) * (1 - Math.exp(-dt * (dashing > this.dash ? F.dash.rise : F.dash.fall)));
      this.phase = (this.phase + dt * Math.PI * 2 * THREE.MathUtils.lerp(F.walk.hz, F.run.hz, this.glide)) % (Math.PI * 8);
    }
    const walk = this.moving * (1 - this.glide), run = this.moving * this.glide, dash = this.dash, s = Math.sin(this.phase);
    // The legs hang from the hips and follow the bob a beat late, as anything dangling does.
    const lag = Math.sin(this.phase - .9), half = Math.sin(this.phase * .5);
    p.weight = Math.max(walk + run, dash);
    p.bob = (walk * F.walk.bob + run * F.run.bob) * s * (1 - dash);
    p.lean = walk * (F.walk.lean + deg(1.5) * s) + run * F.run.lean + dash * F.dash.lean;
    p.roll = walk * F.walk.roll * half;
    const flutter = run * F.run.flutter * Math.sin(this.phase * 2);
    // Walk: the legs drawn in under her and hanging loose, one knee (her right) bent more than the other, both swinging
    // behind the bob. Run: trailed back together, a flutter. Dash: both thighs drawn up and the knees tucked.
    const hang = walk * (F.walk.thigh + F.walk.swing * lag) + run * F.run.thigh + dash * F.dash.thigh;
    p.thigh[0] = hang + flutter;
    p.thigh[1] = hang - flutter;
    p.knee[0] = walk * F.walk.otherKnee + run * F.run.knee + dash * F.dash.knee;
    p.knee[1] = walk * F.walk.knee + run * F.run.knee + dash * F.dash.knee;
    p.arms = walk * F.walk.arms * -lag + run * F.run.arms + dash * F.dash.arms;
    p.lift = run * F.run.lift * (1 - dash) + dash * F.dash.lift;
    p.stream = Math.min(1, run * F.run.stream + dash * F.dash.stream);
    return p;
  }
  reset() { this.phase = this.moving = this.glide = this.dash = 0; }
}
