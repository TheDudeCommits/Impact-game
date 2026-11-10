import {afterEach, describe, expect, it, vi} from 'vitest';
import * as THREE from 'three';
import {TeamTrimmer, TRIM, sideRing, type TrimBody} from './TeamTrim';
import {askTeamTrim} from './ballCamChoice';
import {applyInkShell, applyTeamTrim, applyToonShading, teamTrim} from '../look/toonShading';
import {applyThreatInk, threatInk} from '../ThreatOutline';
import {shaderPatchKeys} from '../look/shaderPatch';
import {BALL_TEAM_COLOURS, type BallSeat, type BallView} from '../../game/ball/model';

/**
 * Team trim (TeamTrim.ts; look/toonShading.ts applyTeamTrim). A ball match's sides on the bodies' own ink
 * and rim light, on by default there - and nowhere else: a body outside a ball match draws exactly what it drew.
 */
type Shader = THREE.WebGLProgramParametersWithUniforms;
/** A material's edits run over the real three.js sources for its type (as tests/lookShading.test.ts does). */
function compile(material: THREE.Material, lib: {vertexShader: string; fragmentShader: string}) {
  const shader = {uniforms: {} as Record<string, THREE.IUniform>, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, defines: {}} as unknown as Shader;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}
const seat = (id: string, team: 'red' | 'blue') => ({id, team, fighter: 'taisei', name: id, bot: true}) as unknown as BallSeat;
const match = (seats: BallSeat[], o: Partial<BallView> = {}) => ({kind: 'ball', mode: 'sky-spike', phase: 'live', seats, ...o}) as unknown as BallView;
/** A body that records what it was last handed. */
const body = () => { const b = {ink: new THREE.Color(), rim: new THREE.Color(), amount: [0, 0], calls: 0, setTeamTrim(ink: THREE.Color, rim: THREE.Color, a: number, r: number) { b.ink.copy(ink); b.rim.copy(rim); b.amount = [a, r]; b.calls++; }}; return b; };
afterEach(() => { askTeamTrim(undefined); vi.restoreAllMocks(); });

describe('team trim: the sides on the bodies, in a ball match only', () => {
  it("puts each seat's side on its body's ink and rim: crimson and azure, the match's own colours", () => {
    const trim = new TeamTrimmer(), a = body(), b = body(), bodies: Record<string, TrimBody> = {a, b};
    trim.update(match([seat('a', 'red'), seat('b', 'blue')]), id => bodies[id]);
    expect(trim.count).toBe(2);
    expect(a.amount).toEqual([TRIM.ink, TRIM.rim]); expect(b.amount).toEqual([TRIM.ink, TRIM.rim]);
    for (const [got, team] of [[a, 'red'], [b, 'blue']] as const) {
      const side = new THREE.Color(BALL_TEAM_COLOURS[team]), peak = Math.max(side.r, side.g, side.b);
      // The rim: the side's hue at full strength (the shader lights it as bright as the rim it replaces); the ink the
      // same hue, darker - a line, under the bloom's knee.
      expect(got.rim.r).toBeCloseTo(side.r / peak, 6); expect(got.rim.g).toBeCloseTo(side.g / peak, 6); expect(got.rim.b).toBeCloseTo(side.b / peak, 6);
      expect(Math.max(got.rim.r, got.rim.g, got.rim.b)).toBeCloseTo(1, 6);
      expect(Math.max(got.ink.r, got.ink.g, got.ink.b)).toBeCloseTo(TRIM.inkLight, 6); expect(TRIM.inkLight).toBeLessThan(.7);
      expect(got.ink.r / got.ink.b).toBeCloseTo(got.rim.r / got.rim.b, 4);
    }
    // The two sides are told apart by hue, not by a shade.
    expect(a.rim.r).toBeGreaterThan(.9); expect(a.rim.b).toBeLessThan(.2); expect(b.rim.b).toBeGreaterThan(.9); expect(b.rim.r).toBeLessThan(.2);
  });

  it('never leaks: a body is cleared the frame its match, or its seat, is gone - any other mode has none', () => {
    const trim = new TeamTrimmer(), a = body(), b = body(), bodies: Record<string, TrimBody> = {a, b};
    const by = (id: string) => bodies[id];
    // No ball match (a duel, survival, the menus): nothing is touched.
    trim.update(undefined, by);
    expect(a.calls + b.calls).toBe(0); expect(trim.count).toBe(0);
    trim.update(match([seat('a', 'red'), seat('b', 'blue')]), by);
    // A seat gone (a player left): that body alone is cleared.
    trim.update(match([seat('a', 'red')]), by);
    expect(a.amount).toEqual([TRIM.ink, TRIM.rim]); expect(b.amount).toEqual([0, 0]); expect(b.rim.getHex()).toBe(0); expect(trim.count).toBe(1);
    // The match gone (home, or another mode started with the same bodies still loaded): every body is as it was.
    trim.update(undefined, by);
    expect(a.amount).toEqual([0, 0]); expect(a.ink.getHex()).toBe(0); expect(a.rim.getHex()).toBe(0); expect(trim.count).toBe(0);
    // And once cleared it is left alone.
    const calls = a.calls; trim.update(undefined, by); trim.update(undefined, by);
    expect(a.calls).toBe(calls);
    // A body built for any mode starts with none.
    const fresh = teamTrim();
    expect(fresh.amount.value.toArray()).toEqual([0, 0]); expect(fresh.inkColor.value.getHex()).toBe(0); expect(fresh.rimColor.value.getHex()).toBe(0);
    trim.update(match([seat('a', 'red')]), by); trim.clear();
    expect(a.amount).toEqual([0, 0]); expect(trim.count).toBe(0);
  });

  it('is on in every ball match and every phase of it (both modes, FREE PLAY, the lobby), off only for a check on this machine', () => {
    for (const o of [{mode: 'goal-rush'}, {mode: 'sky-spike'}, {mode: 'goal-rush', practice: true}, {phase: 'lobby'}, {phase: 'scored'}, {phase: 'over'}] as Partial<BallView>[]) {
      const trim = new TeamTrimmer(), a = body();
      trim.update(match([seat('a', 'blue')], o), () => a);
      expect(a.amount, JSON.stringify(o)).toEqual([TRIM.ink, TRIM.rim]);
    }
    const trim = new TeamTrimmer(), a = body();
    trim.update(match([seat('a', 'blue')]), () => a);
    askTeamTrim(false); trim.update(match([seat('a', 'blue')]), () => a);
    expect(a.amount).toEqual([0, 0]);
  });

  it('is whole on a body far from the lens, where it is small, and a tint on one close to it', () => {
    const trim = new TeamTrimmer(), at = (z: number) => Object.assign(body(), {group: {position: {x: 0, y: 0, z}}});
    const close = at(5), mid = at(11), far = at(18), court = at(30), bodies: Record<string, ReturnType<typeof at>> = {close, mid, far, court};
    const seats = [seat('close', 'red'), seat('mid', 'red'), seat('far', 'blue'), seat('court', 'blue')];
    trim.update(match(seats), id => bodies[id], {x: 0, y: 0, z: 0});
    expect(close.amount).toEqual([TRIM.inkNear, TRIM.rimNear]);
    expect(far.amount).toEqual([TRIM.ink, TRIM.rim]); expect(court.amount).toEqual([TRIM.ink, TRIM.rim]);
    expect(mid.amount[0]).toBeGreaterThan(TRIM.inkNear); expect(mid.amount[0]).toBeLessThan(TRIM.ink); expect(mid.amount[1]).toBeGreaterThan(TRIM.rimNear); expect(mid.amount[1]).toBeLessThan(TRIM.rim);
    // Never gone, however close: the side still reads on your own fighter.
    expect(TRIM.inkNear).toBeGreaterThanOrEqual(.4); expect(TRIM.rimNear).toBeGreaterThanOrEqual(.4);
    // Sky Spike's whole court is beyond `far` from either stand (the nearest body to the lens is over 13 m off, most over 16).
    expect(TRIM.far).toBeLessThanOrEqual(16);
    // A split screen: a body is as near as the nearer of its two lenses.
    trim.update(match(seats), id => bodies[id], {x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 30});
    expect(court.amount).toEqual([TRIM.inkNear, TRIM.rimNear]); expect(close.amount).toEqual([TRIM.inkNear, TRIM.rimNear]);
  });

  it("steps the others' floor rings back, and puts them back as they were without the trim", () => {
    const quiet = sideRing();
    askTeamTrim(false);
    const before = sideRing();
    // (The ring every body but your own had before the trim: BallField's .95 and .72.)
    expect(before).toEqual({size: .95, alpha: .72});
    expect(quiet.size).toBeLessThan(before.size); expect(quiet.alpha).toBeLessThanOrEqual(before.alpha * .6);
    // Still there to find: a ring, not a speck.
    expect(quiet.size).toBeGreaterThan(.6); expect(quiet.alpha).toBeGreaterThan(.25);
  });
});

describe('team trim: the shader edits', () => {
  it("tints a body's rims - the stage's edge rim and the anime finish's two - and finds every line it edits", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const kind of ['body', 'hair', 'metal', 'matte'] as const) {
      const material = new THREE.MeshToonMaterial(), trim = teamTrim();
      applyToonShading(material, kind); applyTeamTrim(material, trim, 'body');
      const shader = compile(material, THREE.ShaderLib.toon), f = shader.fragmentShader;
      expect(shader.uniforms.uTrim).toBe(trim.amount); expect(shader.uniforms.uTrimRim).toBe(trim.rimColor);
      expect(f).toContain('if ( uTrim.y > 0.0 ) lookRimColor = mix( lookRimColor, uTrimRim');
      expect(f).toContain('if ( uTrim.y > 0.0 ) rigLight = mix( rigLight, uTrimRim');
      // The line it replaced is gone (the rims are lit once), and the rest of the finish is as it was.
      expect(f).not.toContain('outgoingLight += ( uRigWarm * rigWarm + uRigCool * rigCool )');
      expect(f).toContain('outgoingLight = mix( outgoingLight, max( outgoingLight, lookRim ), lookEdge * lookSide );');
      // A technique's grade still takes the rim over.
      expect(f).toContain('uTrim.y * ( 1.0 - uLookTech )');
      expect(shaderPatchKeys(material).slice(-1)).toEqual(['look-team-trim-body-v1']);
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it("tints an ink hull's line after the ink's own colour and before the lock's glow, so a threat colour still wins", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hull = new THREE.MeshToonMaterial({side: THREE.BackSide}), trim = teamTrim();
    applyInkShell(hull, 1, .035); applyTeamTrim(hull, trim, 'ink'); applyThreatInk(hull, threatInk());
    const f = compile(hull, THREE.ShaderLib.toon).fragmentShader;
    const ink = f.indexOf('outgoingLight = uInkColor;'), side = f.indexOf('if ( uTrim.x > 0.0 ) outgoingLight = mix( outgoingLight, uTrimInk, uTrim.x );'), threat = f.indexOf('mix( outgoingLight, uThreatColor, uThreatMix )'), out = f.indexOf('#include <opaque_fragment>');
    expect(ink).toBeGreaterThan(0); expect(side).toBeGreaterThan(ink); expect(threat).toBeGreaterThan(side); expect(out).toBeGreaterThan(threat);
    // A silhouette frame's ink is still black: the trim is before the ink's own last word.
    expect(f.indexOf('gl_FragColor.rgb *= 1.0 - uLookSilhouette;')).toBeGreaterThan(side);
    // A body's own flat outline mesh takes the same line.
    const flat = new THREE.MeshBasicMaterial();
    applyTeamTrim(flat, trim, 'ink');
    expect(compile(flat, THREE.ShaderLib.basic).fragmentShader).toContain('if ( uTrim.x > 0.0 ) outgoingLight = mix( outgoingLight, uTrimInk, uTrim.x );');
    expect(warn).not.toHaveBeenCalled();
  });

  it('draws nothing of its own at zero: both branches are skipped, so every other mode draws what it drew', () => {
    const material = new THREE.MeshToonMaterial(), plain = new THREE.MeshToonMaterial(), trim = teamTrim();
    applyToonShading(material, 'body'); applyTeamTrim(material, trim, 'body'); applyToonShading(plain, 'body');
    const withTrim = compile(material, THREE.ShaderLib.toon).fragmentShader, without = compile(plain, THREE.ShaderLib.toon).fragmentShader;
    // Every use of the trim's colour is behind its own amount.
    for (const line of withTrim.split('\n')) if (/uTrim(Rim|Ink)/.test(line) && !/^uniform/.test(line.trim())) expect(line).toMatch(/if \( uTrim\.[xy] > 0\.0 \)/);
    // And taking the trim's lines out leaves the look's own shader, to the character.
    const stripped = withTrim.replace('uniform vec3 uTrimInk;\nuniform vec3 uTrimRim;\nuniform vec2 uTrim;\n', '')
      .replace(/\n\t\/\/ The side's trim \(applyTeamTrim\)[^\n]*\n\tif \( uTrim\.y > 0\.0 \) lookRimColor = [^\n]*/, '')
      .replace(/vec3 rigLight = uRigWarm \* rigWarm \+ uRigCool \* rigCool;\n\t\tif \( uTrim\.y > 0\.0 \) rigLight = [^\n]*\n\t\toutgoingLight \+= rigLight \* /, 'outgoingLight += ( uRigWarm * rigWarm + uRigCool * rigCool ) * ');
    expect(stripped).toBe(without);
    expect(trim.amount.value.x).toBe(0); expect(trim.amount.value.y).toBe(0);
  });
});
