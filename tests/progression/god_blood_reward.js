'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const root=path.resolve(__dirname,'../..');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
const deob=fs.readFileSync(path.join(root,'210(1)_unpacked/_analysis/deob_main.js'),'utf8');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}
function battleEnv(){
  const e=environment();
  e.run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
    __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    addLog=m=>S.log.push(String(m));Math.random=()=>0.5;
    S.sciences=['sci_alloy_age','sci_steam_age','sci_electric_age','sci_god_domain'];
    S.buildings.barracks={lv:7,state:'idle'};
    S.formation={front:[{type:'alloy_special',count:40,id:101}],
      mid:[{type:'armored_trooper',count:40,id:102}],back:[{type:'archer',count:40,id:103}]};`);
  return e;
}
function finish(e){
  for(let i=0;i<500&&e.run('S.battleActive');i++)assert.equal(e.run('__step()'),true);
  assert.equal(e.run('S.battleActive'),false,'battle did not settle');
}
check('母本神域胜利100%给血剂，按胜后警戒2001/4001/6001分四档',()=>{
  assert.equal(source[180001]['itemPill:Name'],'麒麟凝血丹');
  assert.equal(source[180001]['itemPill:Max'],300000);
  const start=deob.indexOf("'key':'winGodWar'");
  assert(start>=0);
  const body=deob.slice(start,start+7500);
  assert(body.includes('["per10000"](0x2710)'));
  for(const threshold of ['0x7d1','0xfa1','0x1771'])assert(body.includes(threshold));
  assert.deepEqual(JSON.parse(battleEnv().run('JSON.stringify(CFG.godBloodRewardTiers)')),[[2001,2],[4001,3],[6001,4]]);
});
check('六条神域预估在边界按胜后警戒计血剂，原材料奖励不被替换',()=>{
  const e=battleEnv();
  const sixDomains=['godCrystal',...Object.keys(e.run('CFG.godDomains')).filter(key=>!e.run(`CFG.godDomains['${key}'].soulRealm`))];
  assert.equal(sixDomains.length,6);
  for(const key of sixDomains){
    for(const [before,wanted] of [[0,1],[1900,1],[1901,2],[3901,3],[5901,4]]){
      const actual=e.run(`materialDomainEncounter('${key}',${before}).reward.sacredBlood`);
      assert.equal(actual,wanted,`${key} alert ${before}`);
    }
  }
  assert.equal(e.run("materialDomainEncounter('medal',0).reward.godCore"),1);
  assert.equal(e.run("materialDomainEncounter('godCrystal',0).reward.godCrystal"),1);
  assert.equal(e.run("materialDomainEncounter('soulStone',0)"),null);
  assert.equal(e.run("materialDomainEncounter('bone',0).reward.sacredBlood"),undefined);
  assert.equal(e.run("developmentBorderEncounter(CFG.developmentBorder.copper).reward.sacredBlood"),undefined);
});
check('真实光学拟态机胜利给血剂且重载，复结不重奖',()=>{
  const e=battleEnv();
  e.run("openMaterialDomain('phantomFlower')");
  assert.equal(e.run('S.battleActive'),true);
  finish(e);
  assert.equal(e.run('S.items.phantomFlower'),2);
  assert.equal(e.run('S.items.sacredBlood'),1);
  assert.equal(e.run('S.killValues.godPhantom'),100);
  assert.ok(e.run("document.getElementById('battle-result').innerHTML").includes('圣兽血剂 +1'));
  e.run("endBattle('win');fleeBattle()");
  assert.equal(e.run('S.items.sacredBlood'),1);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.sacredBlood'),1);
});
check('核心战在胜后警戒5000发3血剂，历史超仓不裁剪',()=>{
  const e=battleEnv();
  e.run("S.killValues.godSlaughter=4900;openMaterialDomain('medal');B.enemyUnits[0].alive=false;endBattle('win')");
  assert.equal(e.run('S.items.sacredBlood'),3);
  assert.equal(e.run('S.killValues.godSlaughter'),5000);
  assert.equal(e.run('S.items.godCore')>0,true);
  const capped=battleEnv();
  capped.run("S.items.sacredBlood=300007;openMaterialDomain('phantomFlower');B.enemyUnits[0].alive=false;endBattle('win')");
  assert.equal(capped.run('S.items.sacredBlood'),300007);
});
check('逃跑、战败、伪胜和写档失败均不发血剂',()=>{
  const e=battleEnv();
  e.run("openMaterialDomain('phantomFlower');fleeBattle()");
  assert.equal(e.run('S.items.sacredBlood'),0);
  e.run("openMaterialDomain('phantomFlower');endBattle('lose')");
  assert.equal(e.run('S.items.sacredBlood'),0);
  e.run("exitBattle();openMaterialDomain('phantomFlower');endBattle('win')");
  assert.equal(e.run('S.battleActive'),true);
  e.run("B.enemyUnits[0].alive=false;save=()=>({ok:false,stage:'write'});endBattle('win')");
  assert.equal(e.run('S.items.sacredBlood'),0);
  assert.equal(e.run('S.killValues.godPhantom'),0);
});
console.log(`${passed} passed`);
