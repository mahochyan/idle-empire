'use strict';
// 续接P28真实102人口、四项电力科技中两项已达6级的存档，实战补材料并逐笔支付剩余两项。
// 时间单位为在线秒；前序战斗随机数固定0.5。无需注入资源、人口、兵力、科技、材料或胜利。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prior=fs.readFileSync(path.join(__dirname,'probe-electric-sixth-level.js'),'utf8');
const {run,fightFor,payToSix,battles,payments}=new Function(
  'require','console','__dirname',prior+'\nreturn {run,fightFor,payToSix,battles,payments};'
)(require,{log(){},error(){}},__dirname);
assert.equal(run('S.eraStorage.electricBasic'),1);
assert.equal(run('S.eraStorage.electricMetal'),1);
assert.equal(run('S.eraStorage.electricProduction'),6);
assert.equal(run('S.eraStorage.electricKnowledge'),6);
assert.equal(run('S.items.guardianStone'),11);
assert.equal(run('S.killValues.godGuardian'),1100);
assert.equal(run('S.defeated.length'),0);
const begin=run('S.tick'),battleStart=battles.length,paymentStart=payments.length;
fightFor('guardianStone',120,'godGuardian');
const stock=run('({second:S.tick,stone:S.items.guardianStone,kill:S.killValues.godGuardian})');
payToSix('electricBasic');
payToSix('electricMetal');
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,run('targetSaveVersion()'));
assert.equal(saved.population.current,102);
assert.equal(saved.defeated.length,0);
for(const key of ['electricBasic','electricMetal','electricKnowledge','electricProduction'])
  assert.equal(saved.eraStorage[key],6,`${key}未升至6级`);
assert.equal(saved.items.guardianStone,stock.stone-120);
assert.equal(saved.items.phantomFlower,6);
console.log(JSON.stringify({unit:'online seconds',begin,finish:run('S.tick'),elapsed:run('S.tick')-begin,
  materialsBeforePayment:stock,stoneRemaining:saved.items.guardianStone,flowerRemaining:saved.items.phantomFlower,
  guardianKill:saved.killValues.godGuardian,stageWins:saved.defeated.length,population:saved.population.current,
  battles:battles.slice(battleStart).map(({key,second,killBefore,before,after,formation})=>({key,second,killBefore,before,after,
    survivors:['front','mid','back'].map(row=>formation[row][0]?.count||0)})),
  payments:payments.slice(paymentStart)},null,2));
