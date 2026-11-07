import {afterEach,describe,expect,it} from 'vitest';
import {SurvivalGame,PLAYER_ID} from '../src/survival/SurvivalGame';
import {SKILL_TREE,lockOf,refundLock,validBuild,botPick,skillArt} from '../src/survival/skillTree';
import {runStats,offer} from '../src/survival/upgrades';
import {nodeInfo} from '../src/survival/skillText';
import {existsSync} from 'node:fs';
const clean:SurvivalGame[]=[];afterEach(()=>clean.splice(0).forEach(g=>g.dispose()));
const base=['iron-fist','iron-fist','iron-fist','burning-blade','burning-blade','focus','focus'];
function game(){const g=new SurvivalGame({fighter:'kenzo',seed:5,god:true});clean.push(g);for(let t=0;t<720&&g.phase!=='fight';t++){if(g.phase==='travel')g.arrive();else g.tick({seq:t,moveX:0,moveZ:0,yaw:0});}return g;}
describe('Ascension skill rules',()=>{
 it('requires a parent, keeps forks exclusive and resolves specialization order independently',()=>{
  expect(lockOf(Array(7).fill('iron-fist'),'searing-edge')).toMatch(/Burning Blade/);
  expect(lockOf(base,'searing-edge')).toBeUndefined();expect(validBuild(base)).toBe(true);
  expect(lockOf([...base,'searing-edge'],'cinder-cut')).toMatch(/sear/);
  const picks=[...base,'searing-edge'];expect(nodeInfo(SKILL_TREE.find(n=>n.id==='burning-blade')!,picks).now).toContain('40 damage');expect(runStats(picks).burn).toBeCloseTo(runStats(base).burn*1.8);expect(runStats([...picks].reverse())).toEqual(runStats(picks));
  const bolts=['thunder-chain','thunder-chain'];expect(runStats([...bolts,'forked-current']).chain).toBe(runStats(bolts).chain+2);expect(runStats([...bolts,'forked-current']).chainDamage).toBeCloseTo(runStats(bolts).chainDamage*.8);
 });
 it('prevents tier self-support and removal of an owned specialization parent',()=>{
  expect(refundLock([...base,'searing-edge'],'searing-edge')).toBeUndefined();
  const onlyParent=['iron-fist','iron-fist','iron-fist','burning-blade','focus','focus','focus','searing-edge'];
  expect(refundLock(onlyParent,'burning-blade')).toMatch(/dependent/);
  expect(refundLock(['iron-fist','iron-fist','iron-fist','burning-blade'],'iron-fist')).toMatch(/dependent/);
  expect(validBuild(['burning-blade','burning-blade','burning-blade','searing-edge'])).toBe(false);
 });
 it('keeps augment cards out of blind drafts and reuses available artwork',()=>{
  for(let n=0;n<40;n++)for(const id of offer([],()=>n/40))expect(SKILL_TREE.find(x=>x.id===id)?.requires).toBeUndefined();
  for(const node of SKILL_TREE)expect(existsSync(`public/assets/survival/cards/${skillArt(node.id)}.webp`),node.id).toBe(true);
 });
 it('validates refunds inside the authority, preserves total points and cannot farm health or refresh consumables',()=>{
  const g=game(),h=g.heroes.get(PLAYER_ID)!;h.points=30;g.choose('tree:open');g.choose('tree:tough-body');
  const body=g.sim.actors.get(PLAYER_ID)!.state;body.hp=body.maxHp*.3;h.revivesUsed=1;h.windRound=g.round;const share=body.hp/body.maxHp;
  for(let n=0;n<20;n++){g.choose('tree:refund:tough-body');g.choose('tree:tough-body');}
  expect(body.hp/body.maxHp).toBeCloseTo(share);expect(h.points+h.picks.length).toBe(30);expect(h.revivesUsed).toBe(1);expect(h.windRound).toBe(g.round);
  g.choose('tree:refund:missing');expect(h.points).toBe(29);g.choose('tree:close');g.choose('tree:refund:tough-body');expect(h.points).toBe(29);
  g.choose('tree:open');body.alive=false;g.choose('tree:refund:tough-body');expect(h.points).toBe(29);g.choose('tree:close');expect(h.treeOpen).toBe(false);body.alive=true;g.choose('tree:open');const total=h.points+h.picks.length;g.choose('tree:reset');expect(h.picks).toEqual([]);expect(h.points).toBe(total);expect(h.revivesUsed).toBe(1);expect(h.windRound).toBe(g.round);g.choose('tree:reset');expect(h.points).toBe(total);
 });
 it('still lets deterministic bot builds progress and refund safely back to zero',()=>{
  const picks:string[]=[];for(let i=0;i<70;i++){const id=botPick(picks);if(id)picks.push(id);}expect(validBuild(picks)).toBe(true);
  while(picks.length){const id=[...picks].reverse().find(id=>!refundLock(picks,id));expect(id).toBeDefined();picks.splice(picks.lastIndexOf(id!),1);}
 });
});
