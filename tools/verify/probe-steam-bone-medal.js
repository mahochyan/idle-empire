'use strict';
// 从新档真实动作路线接续蒸汽研究：实际训练、编队、郊野战斗、兑换并支付装甲枪研究费。
// 时间仅计游戏在线 tick 秒；异步战斗回调被即时推进，主动操作时长另计，非典型玩家耗时。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const randomArg=process.argv.find(arg=>arg.startsWith('--random='));
const battleRandom=randomArg===undefined?0.5:Number(randomArg.slice('--random='.length));
assert.ok(Number.isFinite(battleRandom)&&battleRandom>=0&&battleRandom<1,'--random must be in [0,1)');
const previous=fs.readFileSync(path.join(__dirname,'probe-steam-era.js'),'utf8');
const {run,assign,waitFor,build,actions,extraActions}=new Function('require','console','__dirname',
  previous+'\nreturn {run,assign,waitFor,build,actions,extraActions};')(
  require,{log(){}},__dirname);

assert.equal(run("scienceUnlocked('sci_steam_age')"),true);
assert.equal(run("scienceUnlocked('sci_electric_age')"),false);
assert.equal(run('S.defeated.length'),0);
assert.equal(run('S.pool.alloy_special'),1);
assert.equal(run('S.res.bone'),0);
const begin=run('S.tick');

// 第一阵位已有，营帐先付费建成，把单团人数上限从5提高到10。
assign({wood:8,stone:8,food:10});
build('barracks');
assert.ok(run('regMax()')>=8);
// 保持原料与粮食正向流入；钢兵由当前产能、仓容和训练队列实际付费获得。
assign({food:2,stone:8,coal:7,iron:5,steel:4});
waitFor('S.res.steel>=700&&S.res.food>=1500',20000);
const recruit=run("train('alloy_special',7)");
assert.equal(recruit?.ok,true,JSON.stringify(recruit));
extraActions.train++;
assert.equal(recruit.qty,7);
waitFor('S.pool.alloy_special===8',20000);
const trainedAt=run('S.tick');

run(`
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  globalThis.clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const entry=__timers.entries().next().value;if(!entry)return false;__timers.delete(entry[0]);const fn=typeof entry[1]==='function'?entry[1]:entry[1].fn;if(typeof fn!=='function')throw Error('invalid battle timer');fn();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  Math.random=()=>${battleRandom};
  openFormModal('expedition','front',0);
  S._formModalSel='alloy_special';S._formModalQty=8;confirmForm();
`);
assert.equal(run('S.formation.front[0].count'),8);
assert.equal(run('S.pool.alloy_special'),0);
const wins=[];
for(let n=0;n<40&&run('S.res.bone')<500;n++){
  const before=run('({bone:S.res.bone,kill:S.killValues.wildBoar,form:S.formation.front[0]?.count||0})');
  run("openMaterialDomain('bone')");
  assert.equal(run('S.battleActive'),true,'郊野战斗未启动');
  for(let step=0;step<500&&run('S.battleActive');step++)assert.equal(run('__step()'),true,'战斗回调丢失');
  assert.equal(run('S.battleActive'),false,'郊野战斗未结束');
  const after=run('({bone:S.res.bone,kill:S.killValues.wildBoar,form:S.formation.front[0]?.count||0,round:B.round})');
  wins.push({number:n+1,boneGain:after.bone-before.bone,survivors:after.form,round:after.round});
  assert.ok(after.bone>before.bone,'郊野战斗失败，兽骨未增加');
  assert.equal(after.kill,before.kill+10);
  run('exitBattle()');
}
assert.ok(run('S.res.bone')>=500,'40场内未取得500兽骨');
const boneBefore=run('S.res.bone');
const traded=run('exchangeBonesForMedals(50)');
assert.equal(traded.ok,true,JSON.stringify(traded));
assert.equal(run('S.res.bone'),boneBefore-500);
assert.equal(run('S.res.medal'),1000);
assert.equal(run('S.daily.counts.market||0'),0);

assign({food:6,tech:20});
waitFor('S.res.tech>=20000',20000);
const research=run("researchWeapon('armored')");
assert.equal(research.ok,true,JSON.stringify(research));
assert.equal(run('S.weaponForge.armored.researched'),true);
assert.equal(run('S.res.medal'),0);
assert.equal(run("scienceUnlocked('sci_electric_age')"),false);
assert.equal(run('S.defeated.length'),0);
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,run('targetSaveVersion()'));
assert.equal(saved.weaponForge.armored.researched,true);
assert.equal(saved.res.bone,run('S.res.bone'));
assert.equal(saved.killValues.wildBoar,run('S.killValues.wildBoar'));
const {environment}=require('../../tests/progression/harness');
const restored=environment({rts_save:JSON.stringify(saved)});
assert.equal(restored.run('loadSaveAndApply().status'),'ok');
assert.equal(restored.run('S.weaponForge.armored.researched'),true);
assert.equal(restored.run('S.res.bone'),saved.res.bone);
assert.equal(restored.run('S.killValues.wildBoar'),saved.killValues.wildBoar);

console.log(JSON.stringify({unit:'online tick seconds',start:begin,trainedAt,finishedAt:run('S.tick'),
  elapsedFromSteam:run('S.tick')-begin,stageWins:run('S.defeated.length'),
  wildWins:wins.length,boneBeforeTrade:boneBefore,boneAfterTrade:saved.res.bone,
  wildKillValue:saved.killValues.wildBoar,weaponResearch:saved.weaponForge.armored.researched,
  battleRandom,battleTimeExcluded:true,marketDailyCount:run('S.daily.counts.market||0'),
  actions:{...actions,...extraActions,wildBattles:wins.length,boneTrades:50},
  first:wins[0],last:wins.at(-1)},null,2));
