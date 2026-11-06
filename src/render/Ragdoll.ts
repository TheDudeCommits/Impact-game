import type RAPIER_NS from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

/** Loaded on demand, never at module scope.
 *
 *  A static import here puts the whole Rapier wasm in the entry chunk: it took
 *  the main bundle from 1.1 MB to 4.0 MB, and 316 kB to 1.4 MB gzipped, on a
 *  game that is a link somebody opens. The stage collision has always loaded
 *  it this way for the same reason, and both share the one instance. */
let RAPIER: typeof RAPIER_NS | undefined;

/**
 * A dead fighter, handed to physics.
 *
 * Death plays an authored slam and then holds the downed pose, which is
 * correct and is also identical every single time - the same body falling the
 * same way regardless of what killed it or which direction it came from. A
 * ragdoll costs nothing to be right about, because by the time it runs the
 * server has already decided the fighter is dead and nothing about the
 * simulation depends on where the corpse ends up.
 *
 * So this is deliberately render-only and deliberately local. It is never
 * authoritative, never networked, and never consulted for anything: two
 * clients will draw the same death differently, and that is fine, because
 * neither of them is deciding anything with it.
 *
 * It starts from the pose that was being drawn, so the handover has nothing
 * to blend - the first physics frame is the animation's last one.
 */

/** Parent joint, child joint, and how thick the limb between them is as a
 *  fraction of its length. Built from the canonical skeleton, so it is the
 *  same eleven bones on every rig in the roster however each one spells them. */
const SEGMENTS: [string, string, number][] = [
  ['Hips', 'Spine', .42],
  ['Spine', 'Neck', .36],
  ['Neck', 'Head', .5],
  ['LeftArm', 'LeftForeArm', .22], ['LeftForeArm', 'LeftHand', .2],
  ['RightArm', 'RightForeArm', .22], ['RightForeArm', 'RightHand', .2],
  ['LeftUpLeg', 'LeftLeg', .26], ['LeftLeg', 'LeftFoot', .22],
  ['RightUpLeg', 'RightLeg', .26], ['RightLeg', 'RightFoot', .22],
];
/** Which segment hangs off which, by index into SEGMENTS. */
const ATTACH: [number, number][] = [
  [0, 1], [1, 2],
  [1, 3], [3, 4], [1, 5], [5, 6],
  [0, 7], [7, 8], [0, 9], [9, 10],
];
/** Kilograms per segment, by index into SEGMENTS: pelvis, chest, head, then
 *  upper arm and forearm twice, thigh and shin twice. 52 kg all told, heaviest
 *  to lightest 8:1. Left to Rapier's default density the capsules weighed
 *  0.010 to 0.030 kg for the whole fighter, the lightest segment 0.0002 kg,
 *  and the heaviest-to-lightest ratio ran to 58:1 on konta, which is the
 *  kind of ratio an iterative solver resolves by flinging the light body.
 *  With the rest of this file as it is, that default still let every rig
 *  sleep, only later: kenzo took 8.1 s to come to rest on it and 2.3 s on
 *  these. */
const MASS = [12, 12, 4, 2.5, 1.5, 2.5, 1.5, 5, 3, 5, 3];
/** Joint spring towards the death pose, and its damping, as accelerations
 *  per radian and per radian a second. */
const SPRING = 20, SPRING_DAMPING = 8;
/** The most torque a joint spring may apply, in newton-metres per kilogram
 *  of the segment it moves. */
const SPRING_TORQUE = 3;
/** How far the head capsule runs on past the Head joint, in metres. The
 *  joint is the base of the skull, and the skull is what actually meets the
 *  floor: with the capsule ending at the joint, a rig lying down had the
 *  joint itself on the surface, kenzo's 0.002 m up and konta's 0.008, with
 *  the skull drawn around it below the tile. Run on, the joint rests at
 *  0.048 to 0.097 m across the roster. */
const SKULL = .12;
/** Collision groups, membership in the high half and filter in the low: the
 *  segments are in group 1 and collide only with group 2, which is the floor,
 *  and the floor collides only with group 1. So a corpse never collides with
 *  itself. Two neighbouring capsules both reach the joint between them with
 *  their full radius, so they overlap there by twice that radius, and Rapier
 *  keeps contacts on between jointed bodies. The contact solver shoved every
 *  pair apart and the joint hauled them back, from the first step and for
 *  ever: measured with the springs, masses and iterations below already in
 *  place, ouga's head was turning at 18.5 rad/s on frame 0 of a death,
 *  before anything had fallen, and six of ten rigs were still jittering at
 *  1.2 to 2.1 rad/s twenty seconds later with no body asleep. Without it
 *  all ten sleep in 1.1 to 3.3 s. What it does not change is the whip in the
 *  first half second, 39 to 57 rad/s on every rig: that is the crumple. A
 *  standing rig free-falls under 23 m/s^2 until the shins meet the floor,
 *  the knees buckle, and the torso lands at 5.8 m/s, swinging the head and
 *  forearms round on their short levers. */
const FLESH = 0x0001_0002, FLOOR = 0x0002_0001;

let ready = false;
let starting: Promise<void> | undefined;
/** Rapier is wasm and has to be initialised once. Anything that runs before
 *  that simply does not get a ragdoll, which is why every call site treats one
 *  as optional rather than waiting for it. */
export function prepareRagdolls() {
  // Through the collision module rather than initialising a second time.
  // Rapier is one wasm module and `init()` is not reentrant: two concurrent
  // calls throw `recursive use of an object ... unsafe aliasing in rust` and
  // then trap, taking the stage collision - and with it the client's
  // predicted movement - down alongside the ragdolls.
  return (starting ??= import('../game/rapierCollision').then(async ({ initRapier }) => {
    RAPIER = await initRapier() as unknown as typeof RAPIER_NS;
    ready = true;
  }));
}
export function ragdollsReady() { return ready; }

type Part = { body: RAPIER_NS.RigidBody; bone: THREE.Bone; child: THREE.Bone;
  /** The bone's world rotation when the body was made. The body's own frame
   *  is the world's, so this composed onto the body's rotation is the bone's
   *  rotation now. It is never the capsule's rotation: that is built with a
   *  minimal-arc turn from +Y onto the bone direction, which throws away the
   *  bone's roll about its own axis - and for any bone pointing straight
   *  down, which is every limb in a standing rig, that arc is a 180-degree
   *  turn about an axis three.js picks arbitrarily. Writing it straight onto
   *  the bone scrambled the pose on the very first frame of death: measured
   *  with physics frozen, 146 to 180 degrees of bone error on all ten rigs,
   *  and a toe up to 1.9 m out of place. */
  offset: THREE.Quaternion;
  /** Where this segment's own joint sits in world space at construction. */
  origin: THREE.Vector3;
  /** That same joint in the body's frame: the bone end of the capsule. */
  tail: THREE.Vector3 };

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _mid = new THREE.Vector3();
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3();
const _parent = new THREE.Quaternion(), _scale = new THREE.Vector3(), _pos = new THREE.Vector3();

export class Ragdoll {
  private world: RAPIER_NS.World;
  private parts: Part[] = [];
  /** Which segments ended up joined to something. */
  private linked = new Set<number>();
  /** How much of the drawn pose is physics rather than the clip. */
  weight = 0;

  /**
   * @param joints the fighter's canonical skeleton, from resolveSkeleton
   * @param velocity the body's world velocity when it died, so a fighter
   *        killed mid-flight keeps going rather than dropping on the spot
   * @param floor world height of the ground under the fighter
   */
  constructor(joints: Map<string, THREE.Bone>, velocity: THREE.Vector3, floor: number) {
    const R = RAPIER!;
    this.world = new R.World({ x: 0, y: -23, z: 0 });
    // Eleven bodies on ten joints is a long chain for the default four
    // iterations. They do not decide whether a rig rests, only how soon and
    // how hard it lands: measured across the roster with the rest of this
    // constructor as it is, four iterations took 1.6 to 4.9 s to put a rig to
    // sleep and peaked at 71 rad/s, eight take 1.1 to 3.3 s and peak at 57.
    this.world.numSolverIterations = 8;
    // Ground only. A corpse sliding through a crate is worth less than the
    // frame time of keeping the stage's collision in a second world.
    this.world.createCollider(R.ColliderDesc.cuboid(60, .5, 60).setTranslation(0, floor - .5, 0)
      .setCollisionGroups(FLOOR));
    // Some rigs put Hips and Spine at exactly the same point - Shiden's does -
    // which makes the pelvis capsule degenerate. It used to be skipped, and
    // the joint loop then silently dropped the only three joints holding the
    // legs to the torso: ten parts, three disconnected pieces, and nothing
    // reported it. Walking down the chain to the first joint that is really
    // somewhere else keeps the topology intact, and because the name is
    // aliased everywhere the arms and the waist follow it together.
    const alias = new Map<string, string>();
    const hips = joints.get('Hips'), spine = joints.get('Spine');
    if (hips && spine) {
      hips.getWorldPosition(_a); spine.getWorldPosition(_b);
      if (_a.distanceTo(_b) < .02) {
        for (const next of ['Spine1', 'Spine2', 'Neck']) {
          const node = joints.get(next);
          if (!node) continue;
          node.getWorldPosition(_b);
          if (_a.distanceTo(_b) >= .02) { alias.set('Spine', next); break; }
        }
      }
    }
    const named = (name: string) => joints.get(alias.get(name) ?? name);
    const made = new Map<number, RAPIER_NS.RigidBody>();
    for (let i = 0; i < SEGMENTS.length; i++) {
      const [from, to, thickness] = SEGMENTS[i];
      const bone = named(from), child = named(to);
      if (!bone || !child) continue;
      bone.getWorldPosition(_a); child.getWorldPosition(_b);
      if (_a.distanceTo(_b) < .02) continue;
      if (to === 'Head') _b.addScaledVector(_dir.copy(_b).sub(_a).normalize(), SKULL);
      const length = _a.distanceTo(_b);
      _mid.copy(_a).add(_b).multiplyScalar(.5);
      // The body's frame is the world's, at every segment. The capsule is
      // what gets turned onto the bone, as a collider offset inside it. The
      // point is the joints: a spherical joint's motors drive the relative
      // rotation of the two bodies' frames towards a target, and the joint
      // builder gives no way to say which relative rotation is "zero" - so
      // with each body rotated onto its own bone, a target of zero would
      // have pulled every limb straight along its parent. With every body
      // world-aligned, the relative rotation at handover is the identity on
      // all ten joints, and zero IS the pose the fighter died in.
      _dir.copy(_b).sub(_a).normalize();
      _q.setFromUnitVectors(_up, _dir);
      // Damping shortens the settle rather than deciding it: with the old
      // 0.12 and 0.45 the roster slept in 1.4 to 4.2 s, with these in 1.1 to
      // 3.3 s. Linear damping stays low so a body knocked back travels.
      const body = this.world.createRigidBody(R.RigidBodyDesc.dynamic()
        .setTranslation(_mid.x, _mid.y, _mid.z)
        .setLinvel(velocity.x, velocity.y, velocity.z)
        .setLinearDamping(.3).setAngularDamping(3));
      const radius = Math.max(.035, length * thickness * .5);
      this.world.createCollider(
        R.ColliderDesc.capsule(Math.max(.01, length / 2 - radius), radius)
          .setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
          .setMass(MASS[i]).setFriction(.9).setRestitution(.02).setCollisionGroups(FLESH), body);
      made.set(i, body);
      // The bone's world rotation expressed in the body's frame, so the
      // write-back can put it back exactly. At t=0 the written pose is then
      // the animated pose and the handover really has nothing to blend.
      const offset = bone.getWorldQuaternion(new THREE.Quaternion());
      this.parts.push({ body, bone, child, offset, origin: _a.clone(), tail: _a.clone().sub(_mid) });
    }
    for (const [a, b] of ATTACH) {
      const first = made.get(a), second = made.get(b);
      if (!first || !second) continue;
      const parent = this.parts.find(p => p.body === first)!;
      const childPart = this.parts.find(p => p.body === second)!;
      // The joint is where the child segment starts. In the child's own frame
      // that is half its length back along +Y, which is what it always was;
      // in the PARENT's frame it is only the far tip for an end-to-end chain.
      // The thighs hang off the Hips->Spine capsule and the arms off the
      // Spine->Neck one, so deriving both ends from length/2 anchored them at
      // the far end of the torso - the shoulders at the neck and the hips at
      // the chest. Measured, that handed Rapier four joints per body whose two
      // anchors were 0.12 to 0.28 m apart at rest, and with four solver
      // iterations it resolves that by throwing the bodies at each other: one
      // 1/60 s step from zero velocity moved bodies up to 0.24 m and produced
      // up to 10.2 m/s, against the 0.38 m/s gravity alone would give. The
      // corpse did not fall, it detonated.
      const t = first.translation(), r = first.rotation();
      _a.copy(childPart.origin).sub(_b.set(t.x, t.y, t.z))
        .applyQuaternion(_q.set(r.x, r.y, r.z, r.w).invert());
      const joint = this.world.createImpulseJoint(
        R.JointData.spherical({ x: _a.x, y: _a.y, z: _a.z }, childPart.tail),
        first, second, true);
      // A free spherical joint has no limits and no muscle: the forearm turns
      // a full circle about the upper arm, the head screws round, the knee
      // bends backwards, and every one of those is a limb free to keep
      // swinging. A spring on each angular axis towards the death pose is the
      // tone a body still has for a moment after it dies, and the damping on
      // it is what the free joint lacked. Both are accelerations rather than
      // torques, so they mean the same thing on a 1.5 kg forearm as on a
      // 12 kg pelvis. This is the one that decides rest: measured at 60 Hz
      // with everything else in this file in place, no springs left all ten
      // rigs awake after twenty seconds, still turning at 0.05 to 0.80 rad/s
      // with the head and hands moving 0.02 to 0.24 m over the final second;
      // these put all ten to sleep in 1.1 to 3.3 s. They are soft enough
      // that a standing corpse still folds rather than falling as a plank -
      // a 1 m, 2 kg arm held out level droops 79 degrees on them, against
      // 101 and still swinging on none.
      // Through the prototype, not the object. Rapier 0.20's bindings
      // report a joint made by `JointData.spherical` as type 6, Generic, so
      // `createImpulseJoint` hands back a GenericImpulseJoint with no motor
      // methods on it at all, whatever the typings say. The raw set still
      // has them and they only need the handle, so the spherical class's
      // methods work when called against the object it should have been.
      const spherical = R.SphericalImpulseJoint.prototype;
      for (const axis of [R.JointAxis.AngX, R.JointAxis.AngY, R.JointAxis.AngZ]) {
        spherical.configureMotorModel.call(joint, axis, R.MotorModel.AccelerationBased);
        spherical.configureMotorPosition.call(joint, axis, 0, SPRING, SPRING_DAMPING);
        spherical.setMotorMaxForce.call(joint, axis, SPRING_TORQUE * MASS[b]);
      }
      this.linked.add(a); this.linked.add(b);
    }
  }

  /** Every segment built, and every one of them joined to the rest.
   *
   *  `parts.length >= 6` was not enough. Shiden's rig puts Hips and Spine at
   *  the same world position, so the Hips->Spine segment is shorter than the
   *  2 cm floor and is skipped - and the joint loop then silently drops the
   *  only three joints that hold the legs and the torso together. He still had
   *  ten parts, so this said yes, and his corpse came apart into three pieces
   *  that never stopped spinning. `Fighter.driveRagdoll` already falls back to
   *  the authored slam when this is false, which is the right answer for a rig
   *  whose pelvis is degenerate. */
  get built() {
    if (this.parts.length !== SEGMENTS.length) return false;
    for (let i = 0; i < SEGMENTS.length; i++) if (!this.linked.has(i)) return false;
    return true;
  }

  /** Step the bodies and write them back onto the skeleton. */
  update(dt: number) {
    if (dt <= 0) return;
    this.world.timestep = Math.min(dt, 1 / 30);
    this.world.step();
    for (const part of this.parts) {
      const r = part.body.rotation();
      _q.set(r.x, r.y, r.z, r.w);
      // The body's rotation is how far the segment has turned since the
      // handover; the bone's own world rotation is that turn composed onto
      // the rest orientation it had when the body was made, so a limb keeps
      // its twist instead of snapping flat.
      const bone = part.bone;
      const parent = bone.parent;
      if (!parent) continue;
      parent.updateWorldMatrix(true, false);
      parent.matrixWorld.decompose(_pos, _parent, _scale);
      // Desired world rotation, expressed in the parent's frame. `offset` is
      // what makes it the bone's rotation rather than the capsule's.
      bone.quaternion.copy(_parent.invert().multiply(_q.multiply(part.offset)));
      // And its position: the joint end of the capsule, not its centre - the
      // capsule spans Hips to Spine and is placed at the midpoint of the two,
      // so writing its translation onto the Hips bone lifted the whole
      // skeleton by half that bone's length, 3 to 10 cm, every frame. Every
      // bone gets this, not only the hips, because what sits between two
      // canonical joints is the rig's business and not always a rigid link:
      // Nigo's shoulders hang off his Neck bone rather than his chest, so
      // with only the rotations written his arms followed the head body
      // while their joints were on the chest one, and at rest his drawn
      // forearm was 0.101 m from where physics had it and a foot 0.103 m
      // under the floor. The joints hold the anchors within a millimetre,
      // so on a rig with nothing odd in between this writes the position the
      // rotation already implied.
      const t = part.body.translation();
      _a.copy(part.tail).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).add(_b.set(t.x, t.y, t.z));
      bone.position.copy(parent.worldToLocal(_a));
    }
  }

  /** The fastest any segment is still turning, in radians a second. Zero
   *  once Rapier has put the island to sleep. Read-only, for the tests. */
  restless() {
    let spin = 0;
    for (const part of this.parts) {
      const w = part.body.angvel();
      spin = Math.max(spin, Math.hypot(w.x, w.y, w.z));
    }
    return spin;
  }

  dispose() { this.world.free(); this.parts.length = 0; this.linked.clear(); }
}
