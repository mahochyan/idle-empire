'use strict';
// P381: exercise the real barracks renderer and unit research/dismissal actions.
// Run: node tests/progression/barracks_visibility_gate_p381.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const {environment}=require('./harness');

const uiSource=fs.readFileSync(path.join(__dirname,'../..','ui.js'),'utf8');
const uiStartup=uiSource.indexOf("\ndocument.getElementById('settings-modal').addEventListener");
assert(uiStartup>0,'expected UI startup boundary');
function game(){
  const e=environment();
  // Rendering uses a sprite cost formatter; this test concerns visibility and
  // actual game actions, not sprite markup or browser layout.
  e.run("function costHtml(){return ''}");
  e.run(uiSource.slice(0,uiStartup));
  // Research/dismissal calls keep their real math/technology implementations;
  // this lightweight DOM harness does not run the full page refresh.
  e.run('updateUI=()=>{}');
  return e;
}
function stageFive(e){e.run('S.defeated=[1,2,3,4,5]');}
function affordT1(e){e.run('Object.assign(S.res,{tech:200,wood:500,stone:300,food:300});S.merit=5');}
function camp(e,tier=1,lv=1){e.run(`S.buildings.infantry_camp={lv:${lv},state:'idle',timer:0,tier:${tier}}`);}
function cards(e){return e.run("(()=>{S._barracksTab='train';return rBarracks()})()");}
function cardVisible(html,key){return html.includes(`data-unit="${key}"`);}
function infantryBadge(html){
  const i=html.indexOf('步兵线 <span>');
  return i>=0&&html.slice(i,i+600).includes('branch-badge-own">可研究');
}

test('fresh locked metal lines stay absent even when their building exists',()=>{
  const e=game();
  e.run("S.buildings.bronze_workshop={lv:1,state:'idle',timer:0,tier:0}");
  assert.equal(cardVisible(cards(e),'bronze_guard'),false);
});

test('barracks research badge follows stage, completed camp tier and real payment',()=>{
  const e=game();camp(e,0);affordT1(e);
  assert.equal(infantryBadge(cards(e)),false,'stage 5 and camp T1 are both missing');
  stageFive(e);
  assert.equal(infantryBadge(cards(e)),false,'camp T1 is missing');
  camp(e,1,0);
  assert.equal(infantryBadge(cards(e)),false,'camp T1 is not built');
  camp(e,1,1);
  assert.equal(infantryBadge(cards(e)),true,'all conditions met');
  e.run('S.merit=0');
  assert.equal(infantryBadge(cards(e)),false,'payment no longer available');
});

test('completed camp remains visible while an ordinary building upgrade pauses training',()=>{
  const e=game();stageFive(e);affordT1(e);camp(e,1,1);
  e.run("S.buildings.infantry_camp.state='upgrading'");
  const html=cards(e);
  assert.equal(cardVisible(html,'infantry'),true);
  assert.equal(infantryBadge(html),true,'research is still legal at the completed tier');
  assert.match(e.run("trainLockReason('infantry')"),/升级中/);
});

test('unit research action rejects unfinished or science/Boss-locked training camp before payment',()=>{
  const e=game();stageFive(e);affordT1(e);camp(e,1,0);
  const before=e.run('({tech:S.res.tech,merit:S.merit,wood:S.res.wood})');
  assert.equal(e.run("upgradeUnit('infantry','infantry_t1')?.ok"),false);
  assert.equal(e.run('!!S.upgradedUnits.infantry_t1'),false);
  assert.deepEqual(e.run('({tech:S.res.tech,merit:S.merit,wood:S.res.wood})'),before);
  camp(e,1,1);
  e.run("CFG.buildings.infantry_camp.needScience='sci_prospect'");
  assert.equal(e.run("upgradeUnit('infantry','infantry_t1')?.ok"),false);
  e.run("CFG.buildings.infantry_camp.needScience=null;CFG.units.infantry_t1.needScience='sci_prospect'");
  assert.equal(e.run("upgradeUnit('infantry','infantry_t1')?.ok"),false);
  e.run("CFG.units.infantry_t1.needScience=null;CFG.buildings.infantry_camp.needBoss=1");
  assert.equal(e.run("upgradeUnit('infantry','infantry_t1')?.ok"),false);
  assert.deepEqual(e.run('({tech:S.res.tech,merit:S.merit,wood:S.res.wood})'),before);
  e.run('CFG.buildings.infantry_camp.needBoss=0');
  assert.equal(e.run("upgradeUnit('infantry','infantry_t1')?.ok"),true);
  assert.equal(e.run('!!S.upgradedUnits.infantry_t1'),true);
  assert.equal(e.run('S.res.tech'),0);
});

test('technology graph does not advertise an action that the real research gate rejects',()=>{
  const e=game();stageFive(e);affordT1(e);camp(e,1,0);
  assert.equal(cardVisible(e.run('rTechFull()'),'infantry_t1'),false);
  camp(e,1,1);
  assert.equal(cardVisible(e.run('rTechFull()'),'infantry_t1'),true);
  e.run("CFG.buildings.infantry_camp.needScience='sci_prospect'");
  assert.equal(cardVisible(e.run('rTechFull()'),'infantry_t1'),false);
});

test('historical locked stock remains visible and can be dismissed without removing deployed soldiers',()=>{
  const e=game();
  e.run("S.buildings.bronze_workshop={lv:1,state:'idle',timer:0,tier:0};S.pool.bronze_guard=3;S.formation.front=[{type:'bronze_guard',count:2}];S._garrisonForm.front=[{type:'bronze_guard',count:1}]");
  const html=cards(e);
  assert.equal(cardVisible(html,'bronze_guard'),true);
  const i=html.indexOf('data-unit="bronze_guard"');
  assert.match(html.slice(i,i+2000),/拥有\s*<strong>6<\/strong>/);
  assert.match(html.slice(i,i+2500),/dismissN\('bronze_guard'/);
  const result=e.run("dismissN('bronze_guard',2)");
  assert.equal(result.ok,true);
  assert.equal(result.dismissed,2);
  assert.equal(e.run('S.pool.bronze_guard'),1);
  assert.equal(e.run('S.formation.front[0].count+S._garrisonForm.front[0].count'),3);
});

test('old low-tier soldiers and trainable root stay visible after high-tier research',()=>{
  const e=game();camp(e,0);
  e.run('S.upgradedUnits.infantry_t1=true;S.pool.infantry=2;S.queue.infantry={count:1,timer:1}');
  let html=cards(e);
  assert.equal(e.run("trainLockReason('infantry')"),'');
  assert.match(e.run("trainLockReason('infantry_t1')"),/T1/);
  assert.equal(cardVisible(html,'infantry'),true,'lower root can still train');
  assert.equal(cardVisible(html,'infantry_t1'),true,'researched higher tier remains displayed with lock');
  camp(e,1);
  html=cards(e);
  assert.equal(cardVisible(html,'infantry'),true,'old low-tier stock/queue remains displayed');
  assert.equal(cardVisible(html,'infantry_t1'),true);
});
