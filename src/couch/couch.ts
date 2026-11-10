import * as THREE from 'three';
import type { PlayerInput, PlayerState } from '../game/types';
import { SECOND } from '../game/couchSeat';
import type { CouchScreen } from '../network';
import { CouchRig, type CouchBody } from './CouchCamera';
import { CouchSeats, deviceName, suggestSeats, type SeatDevice } from './seats';
import { setCameraCutaway } from '../render/CameraCutaway';
import { currentDevice } from '../ui/prompts';
import './couch.css';

/** What a couch fight is: a Duel's two people against each other (versus), the arcade's two heroes against the horde
 *  (coop), or two people in one of the big modes - the royale, Training, the operations, the Rift - each among the
 *  others there, rival, ally or bot, with a target of their own (field). */
export type CouchKind = 'versus' | 'coop' | 'field';
/** Co-op's leash (metres): a hero further than this from the other walks no further away, so one screen always holds
 *  both (the couch camera frames up to DOLLY_FAR). Versus needs none: a duelling floor is small enough to frame whole.
 *  A split screen has no leash: each half follows its own player. */
export const LEASH = 12;
/** A field seat's soft target: the nearest opponent within this many metres, the one ahead of its view preferred (each
 *  radian off the view counts as this many metres), held until another is clearly nearer (HOLD) or it is gone. */
export const SOFT_RANGE = 16, OFF_VIEW = 3.5, HOLD = 2;
/** A seat's lock (its TARGET button) lets go of a body this far away (metres). */
export const LOCK_RANGE = 30;
/** How fast a pad's right stick turns a split screen's view (radians a second at full tilt) and tilts it - the single
 *  player's own (input.ts). */
const TURN = 2.7, TILT = 1.75;

/** The seats a couch start would sit, as the mode sheet shows them and the start uses them: suggestSeats on the pads
 *  connected now and the device the menus are being driven with, swapped if the players asked. */
export function plannedSeats(swap = false): SeatDevice[] {
  const pads = typeof navigator === 'object' && typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()) : [];
  const seats = suggestSeats(pads as never, currentDevice().device === 'controller');
  return swap ? [seats[1], seats[0]] : seats;
}
/** The seats in words, for the sheet's CONTROLS line. */
export function seatsLine(seats: readonly SeatDevice[]) {
  const pads = typeof navigator === 'object' && typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()) : [];
  return seats.map((seat, i) => `P${i + 1} · ${deviceName(seat, pads as never)}`);
}
/** What each keyboard half's keys are, for the sheet. */
export const KEY_HELP: Record<'left' | 'right' | 'full', string> = {
  left: 'WASD move · C light · V heavy · Q special · R ultimate · G area · F guard · Space jump · Shift dash · E awaken · Tab target',
  right: 'Arrows move · K light · L heavy · ; special · O ultimate · P area · J guard · I jump · \' dash · [ awaken · U target (or the numpad: 1 2 3 light/heavy/special, 4 guard, 0 jump)',
  full: 'Your own keys (Settings → Controls), arrows move too',
};

/** Who a field seat may aim at: anyone standing who is not them and not on their side (a team, where the mode has teams). */
export function opponentOf(me: Pick<PlayerState, 'id' | 'team'>, p: Pick<PlayerState, 'id' | 'team' | 'alive'>) {
  return p.alive && p.id !== me.id && !(me.team !== undefined && p.team !== undefined && p.team === me.team);
}
/** A field seat's soft target among `players`: the nearest opponent within SOFT_RANGE, ahead of `viewYaw` preferred,
 *  the one it has (`held`) kept unless another is HOLD metres nearer by that measure. */
export function softTarget(me: PlayerState, players: readonly PlayerState[], viewYaw: number, held: string | null): string | null {
  let best: string | null = null, bestScore = Infinity, heldScore = Infinity;
  for (const p of players) {
    if (!opponentOf(me, p)) continue;
    const dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz);
    if (d > SOFT_RANGE) continue;
    const off = d > .01 ? Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - viewYaw), Math.cos(Math.atan2(dx, dz) - viewYaw))) : 0;
    const score = d + off * OFF_VIEW;
    if (p.id === held) heldScore = score;
    if (score < bestScore) { bestScore = score; best = p.id; }
  }
  return heldScore < Infinity && heldScore - HOLD <= bestScore ? held : best;
}

/** One seat's view of a split screen: the heading and tilt it reads its stick against, as the single player's Input
 *  keeps them for the follow camera. */
export interface SeatView { yaw: number; pitch: number; /** The heading its keys are read against this frame (FollowCamera.movementBasis: the view, less the camera's own turning
   *  since the keys went down). */ basis?: number }

/**
 * The couch on the page (2 November 2026): which kind of couch fight is on, its two seats, and how the screen is shared.
 * main.ts asks it for each seat's command on every tick of the input clock and, on a shared screen, hands it the frame's
 * bodies to film; on a split screen each half is filmed by the game's own follow camera (main.ts splitFrame) and the
 * seats read their keys against their own half's heading (`views`). With no couch fight on (`on` false) it does nothing
 * at all and every other mode is exactly as it was.
 */
export class Couch {
  readonly seats = new CouchSeats();
  readonly rig = new CouchRig();
  kind: CouchKind | null = null;
  /** How the screen is shared (network.ts CouchScreen): the couch camera's one shot, or two halves. */
  screen: CouchScreen = 'shared';
  /** The two fighters' ids in the mode: Player 1's (the page's own) and Player 2's. */
  ids: readonly [string, string] = ['you', SECOND];
  /** The fight is on for the seats (main.ts: the same gate that turns the single player's input on). */
  live = false;
  /** Each seat's own heading and tilt on a split screen (main.ts writes back what its half's follow camera made of them). */
  readonly views: [SeatView, SeatView] = [{ yaw: Math.PI, pitch: .02 }, { yaw: Math.PI, pitch: .02 }];
  private viewYaw = Math.PI;
  private aims: Record<string, number> = {};
  private targets: Record<string, string | null> = {};
  private locks: Record<string, boolean> = {};
  private where: Record<string, { x: number; z: number }> = {};
  private readonly eye = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  /** A pad came or went mid-fight and seats moved (seats.ts reseat): what each moved seat is on now, in words, for its
   *  player's half (main.ts). */
  onReseat = (_notices: readonly { seat: number; text: string }[]) => {};
  constructor() {
    this.seats.onReseat = (moves, pads) => this.onReseat(moves.map(move => ({ seat: move.seat, text: `PLAYER ${move.seat + 1} · ${deviceName(move.device, pads)}` })));
  }
  get on() { return this.kind !== null; }
  get split() { return this.kind !== null && this.screen !== 'shared'; }
  /** `ids`: the two fighters' ids (Player 1's first); `yaw`: the heading the shared lens starts on. */
  begin(kind: CouchKind, devices: readonly SeatDevice[], options: { ids?: readonly [string, string]; screen?: CouchScreen; yaw?: number } = {}) {
    this.kind = kind; this.live = false; this.ids = options.ids ?? ['you', SECOND];
    // A field fight has no shared shot to fall back on: its players go where they like, so it is always split (top and
    // bottom, the default split: couch/split.ts SCREENS).
    this.screen = kind === 'field' && (options.screen ?? 'shared') === 'shared' ? 'split-h' : options.screen ?? 'shared';
    this.seats.seat(devices, this.ids); this.seats.attach();
    this.rig.coop = kind === 'coop'; this.rig.reset(options.yaw); this.viewYaw = this.rig.yaw; this.aims = {}; this.targets = {}; this.locks = {}; this.where = {}; this.presses = {};
    for (const view of this.views) { view.yaw = options.yaw ?? Math.PI; view.pitch = .02; view.basis = undefined; }
    if (typeof document === 'object') document.body.classList.add('couch-play');
  }
  end() { if (!this.kind) return; this.kind = null; this.live = false; this.seats.detach(); if (typeof document === 'object') document.body.classList.remove('couch-play'); }
  /** The heading both seats read their keys against on a shared screen; Player 1's own on a split one. */
  get yaw() { return this.split ? this.views[0].yaw : this.viewYaw; }
  /** Which seat (0, 1) a fighter id is, or -1. */
  seatOf(id: string) { return this.ids.indexOf(id); }
  /** Whom a seat aims at now (null: nobody - the simulation picks the one faced when the swing starts), and whether
   *  its TARGET button holds them. */
  targetOf(id: string) { return this.targets[id] ?? null; }
  lockedOf(id: string) { return !!this.locks[id]; }
  /** How many times a seat has pressed its TARGET button in a field fight (the ball modes' ball camera toggles on it). */
  pressesOf(id: string) { return this.presses[id] ?? 0; }
  private presses: Record<string, number> = {};
  /** Whom each seat aims at, and along which line (main.ts updates it each frame from the snapshot). */
  aimAt(players: readonly PlayerState[]) {
    if (!this.kind) return;
    const [one, two] = this.ids;
    for (const seat of this.seats.seats) {
      const me = players.find(p => p.id === seat.id);
      if (!me) continue;
      this.where[seat.id] = { x: me.x, z: me.z };
      const view = this.split ? this.views[Math.max(0, this.seatOf(seat.id))].yaw : this.viewYaw;
      if (this.kind === 'field') {
        // A seat's TARGET holds the one it has (or lets them go); otherwise the soft target follows the fight.
        let target = this.targets[seat.id] ?? null, locked = !!this.locks[seat.id];
        const held = target ? players.find(p => p.id === target) : undefined;
        if (locked && (!held || !opponentOf(me, held) || Math.hypot(held.x - me.x, held.z - me.z) > LOCK_RANGE)) locked = false;
        if (seat.takeTarget()) { locked = !locked && !!target; this.presses[seat.id] = (this.presses[seat.id] ?? 0) + 1; }
        if (!locked) target = softTarget(me, players, view, target);
        const foe = target ? players.find(p => p.id === target) : undefined;
        this.targets[seat.id] = foe ? foe.id : null; this.locks[seat.id] = locked && !!foe;
        this.aims[seat.id] = foe ? Math.atan2(foe.x - me.x, foe.z - me.z) : view;
        continue;
      }
      // Versus: always the other person. Co-op: the nearest standing enemy, as a soft target (the simulation's own
      // chooseIntent picks the one faced when the swing starts).
      const foe = this.kind === 'versus' ? players.find(p => p.id === (seat.id === one ? two : one)) : undefined;
      this.targets[seat.id] = foe?.alive ? foe.id : null;
      this.aims[seat.id] = foe ? Math.atan2(foe.x - me.x, foe.z - me.z) : me.yaw;
    }
  }
  /** One seat's command for this tick; neutral while the fight is not on (the intro, a finale, a menu). */
  command(id: string): PlayerInput | undefined {
    const seat = this.seats.seats.find(s => s.id === id);
    if (!seat) return undefined;
    const at = this.seatOf(id), view = this.split && at >= 0 ? this.views[at].basis ?? this.views[at].yaw : this.viewYaw;
    const command = seat.command(this.seats.held, view, this.aims[id] ?? view, this.targets[id] ?? null);
    if (this.kind === 'field') command.lock = !!this.locks[id];
    if (this.kind === 'coop') {
      command.lock = false;
      // The leash (a shared screen only): past it, the step that would take this hero further from the other is taken out.
      const me = this.where[id], other = this.where[id === this.ids[0] ? this.ids[1] : this.ids[0]];
      if (me && other && !this.split) {
        const dx = me.x - other.x, dz = me.z - other.z, d = Math.hypot(dx, dz);
        if (d > LEASH) { const ux = dx / d, uz = dz / d, out = command.moveX * ux + command.moveZ * uz; if (out > 0) { command.moveX -= out * ux; command.moveZ -= out * uz; } }
      }
    }
    // Out of the fight, or working its own shop on a split screen (seats.ts menuOpen): the fighter stands still.
    if (!this.live || seat.menuOpen) return { ...command, moveX: 0, moveZ: 0, attack: undefined, jump: false, jumpHeld: false, heavyHeld: false, dash: false, guard: false, awaken: false };
    return command;
  }
  /** A split screen's frame, before its halves are filmed: each pad seat's right stick turns and tilts its own view, as
   *  the single player's does theirs (input.ts). Reads the seats' pads. */
  turn(dt: number, sensitivity = 1) {
    this.seats.poll();
    const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), .1);
    this.seats.seats.forEach((seat, i) => {
      const view = this.views[i];
      if (!view) return;
      view.yaw -= seat.lookX * TURN * step * sensitivity;
      view.pitch = Math.max(-.28, Math.min(.72, view.pitch + seat.lookY * TILT * step * sensitivity));
    });
  }
  /** Films the frame: writes the scene's camera from the couch rig, and reads the seats' pads. */
  frame(dt: number, camera: THREE.PerspectiveCamera, players: readonly CouchBody[], extras: readonly CouchBody[], bounds?: { halfX: number; halfZ: number }) {
    const shot = this.rig.update(dt, players, extras, bounds);
    this.viewYaw = shot.yaw;
    this.eye.set(shot.eyeX, shot.eyeY, shot.eyeZ); this.look.set(shot.lookX, shot.lookY, shot.lookZ);
    camera.position.copy(this.eye); camera.up.set(0, 1, 0); camera.lookAt(this.look);
    if (Math.abs(camera.fov - shot.fov) > 1e-3) { camera.fov = shot.fov; camera.updateProjectionMatrix(); }
    // The stage in front of the pair opens round them, as it does round a player in the follow camera.
    setCameraCutaway(this.eye, this.look, this.look.y - 1.05, 1.6);
    this.seats.poll();
  }
  /** The pads whose menu button went down this frame (main.ts pauses for any the single player's input doesn't read). */
  menuPads(): number[] { return this.seats.seats.flatMap(seat => seat.menu && seat.device.kind === 'pad' ? [seat.device.index] : []); }
}
