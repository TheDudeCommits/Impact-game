import { describe, expect, it } from 'vitest';
import { LocalRoyale } from '../src/game/LocalRoyale';
import { LocalObjective } from '../src/game/objectives/LocalObjective';
import { LocalRift } from '../src/game/moba/LocalRift';
import { LocalTraining } from '../src/network';
import { SECOND } from '../src/game/couchSeat';
import type { PlayerInput } from '../src/game/types';

const walk = (seq: number): PlayerInput => ({ seq, moveX: 1, moveZ: 0, yaw: Math.PI / 2, guard: false, targetId: null, lock: false });
const quiet = (seq: number): PlayerInput => ({ seq, moveX: 0, moveZ: 0, yaw: 0, guard: false, targetId: null, lock: false });

describe('couch seats in every mode', () => {
  it('the royale: Player 2 in the field as a person, one bot fewer, walking on their own commands', async () => {
    const royale = new LocalRoyale();
    await royale.connect('taisei', 'P1', 6, undefined, undefined, 'konta');
    const players = royale.snapshot!.players;
    expect(players).toHaveLength(6);
    expect(players.find(p => p.id === SECOND)).toMatchObject({ fighter: 'konta', isBot: false });
    expect(players.filter(p => p.isBot)).toHaveLength(4);
    let seq = 0, walking = false; royale.second = () => walking ? walk(++seq) : quiet(++seq);
    // (The bell places everyone afresh: the walk starts once the fight is on.)
    for (let i = 0; i < 60 * 5 && royale.snapshot!.status !== 'active'; i++) royale.send(quiet(i + 1));
    expect(royale.snapshot!.status).toBe('active');
    const at = () => royale.snapshot!.players.find(p => p.id === SECOND)!, start = at().x, p1 = royale.snapshot!.players.find(p => p.id === 'you')!.x;
    walking = true;
    for (let i = 0; i < 60; i++) royale.send(quiet(i + 1));
    expect(at().x).toBeGreaterThan(start + 1);
    // Player 1 stood still: only Player 2's own commands moved Player 2.
    expect(Math.abs(royale.snapshot!.players.find(p => p.id === 'you')!.x - p1)).toBeLessThan(.5);
    await royale.leave();
    expect(royale.partner).toBeUndefined();
  }, 120000);
  it('Training: Player 1 and Player 2 face to face as a Duel seats them, and no dummy', async () => {
    const training = new LocalTraining();
    await training.connect('taisei', 'P1', 'konta');
    const players = () => training.snapshot!.players, of = (id: string) => players().find(p => p.id === id)!;
    expect(players().map(p => p.id).sort()).toEqual([SECOND, 'you'].sort());
    expect(of(SECOND)).toMatchObject({ fighter: 'konta', isBot: false });
    expect(training.snapshot!.trainingPair).toEqual(['you', SECOND]);
    // No dummy, so none of its lab.
    expect(training.snapshot!.trainingLab).toBeUndefined();
    const facing = (a: string, b: string) => { const p = of(a), q = of(b), want = Math.atan2(q.x - p.x, q.z - p.z); return Math.abs(Math.atan2(Math.sin(p.yaw - want), Math.cos(p.yaw - want))); };
    const seat = { you: { x: of('you').x, z: of('you').z }, two: { x: of(SECOND).x, z: of(SECOND).z } };
    expect(Math.hypot(seat.you.x - seat.two.x, seat.you.z - seat.two.z)).toBeGreaterThan(4);
    expect(facing('you', SECOND)).toBeLessThan(.01); expect(facing(SECOND, 'you')).toBeLessThan(.01);
    // Player 2 walks off on their own commands; RESET puts both back on their seats, face to face, bars full.
    let seq = 0; training.second = () => walk(++seq);
    for (let i = 0; i < 90; i++) training.send(quiet(i + 1));
    expect(Math.hypot(of(SECOND).x - seat.two.x, of(SECOND).z - seat.two.z)).toBeGreaterThan(1);
    training.room!.send('training', 'reset'); training.second = () => quiet(++seq); training.send(quiet(200));
    expect(Math.hypot(of('you').x - seat.you.x, of('you').z - seat.you.z)).toBeLessThan(.05);
    expect(Math.hypot(of(SECOND).x - seat.two.x, of(SECOND).z - seat.two.z)).toBeLessThan(.05);
    expect(facing('you', SECOND)).toBeLessThan(.01); expect(facing(SECOND, 'you')).toBeLessThan(.01);
    // FILL METERS fills both people's; CHANGE OPPONENT switches Player 2.
    training.room!.send('training', 'awakening'); training.send(quiet(201));
    expect(of('you').awakening).toBe(100); expect(of(SECOND).awakening).toBe(100);
    training.room!.send('training', { lab: 'swap-opponent', value: 'gummy' }); training.send(quiet(202));
    expect(of(SECOND).fighter).toBe('gummy'); expect(of('you').fighter).toBe('taisei');
    await training.leave();
    // Training on one's own keeps its dummy.
    await training.connect('taisei', 'P1');
    expect(players().map(p => p.id)).toContain('sparring-bot'); expect(training.snapshot!.trainingPair).toBeUndefined();
    await training.leave();
  }, 120000);
  it('Last Stand: Player 2 a defender, two bots making up the four', async () => {
    const op = new LocalObjective();
    await op.connect('taisei', 'P1', 'last-stand', 'bots', 1, undefined, 'konta');
    const seats = op.match!.view.seats.length ? op.match!.view.seats : [...op.match!.seats.values()];
    const defenders = seats.filter(s => s.team === 'defenders');
    expect(defenders).toHaveLength(4);
    expect(defenders.find(s => s.id === SECOND)).toMatchObject({ bot: false, fighter: 'konta' });
    expect(defenders.filter(s => s.bot)).toHaveLength(2);
    await op.leave();
  }, 120000);
  it('Bad Blood and the Rift: Player 2 on their fighter\'s side, with Player 1 or against them', async () => {
    const against = new LocalObjective();
    await against.connect('taisei', 'P1', 'bad-blood', 'bots', 1, undefined, 'oro');
    const seats = [...against.match!.seats.values()];
    expect(seats.find(s => s.id === SECOND)?.team).toBe('villains');
    expect(seats.filter(s => s.team === 'heroes')).toHaveLength(3); expect(seats.filter(s => s.team === 'villains')).toHaveLength(3);
    await against.leave();
    const rift = new LocalRift();
    await rift.connect('taisei', 'P1', 1, 'konta');
    const riftSeats = [...rift.match!.seats.values()];
    expect(riftSeats.find(s => s.id === SECOND)).toMatchObject({ team: 'heroes', bot: false });
    expect(riftSeats.filter(s => s.team === 'heroes')).toHaveLength(5);
    await rift.leave();
  }, 180000);
  it('the Rift\'s rivals see each other on a shared screen', async () => {
    const rift = new LocalRift();
    await rift.connect('taisei', 'P1', 1, 'oro');
    rift.second = () => quiet(1);
    for (let i = 0; i < 60 * 6 && rift.match!.view.phase !== 'active'; i++) rift.send(quiet(i + 1));
    expect(rift.match!.view.phase).toBe('active');
    rift.send(quiet(999));
    // Fog would take Player 2 (across the map, the other side) out of Player 1's snapshot; the couch keeps both.
    const ids = rift.snapshot!.players.map(p => p.id);
    expect(ids).toContain('local-rift-fighter'); expect(ids).toContain(SECOND);
    await rift.leave();
  }, 180000);
});
