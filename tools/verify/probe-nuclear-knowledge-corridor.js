'use strict';
// 从真实材料战斗存档逐级支付核能前知识仓科技；在线时间以 tick 秒计。
// 不预置资源、研究、建筑、人口、兵力或胜利。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {environment}=require('../../tests/progression/harness');
const saveArg=process.argv.find(x=>x.startsWith('--save='));
const finalArg=process.argv.find(x=>x.startsWith('--snapshot-final='));
assert.ok(saveArg,'须提供实战存档 --save=路径');
const env=environment({rts_save:fs.readFileSync(saveArg.slice('--save='.length),'utf8')});
const run=env.run;
assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')),'源档必须安全读取或迁移');
assert.equal(run('S.defeated.length'),45);
assert.equal(run('S.eraStorage.steamKnowledge'),6);
assert.equal(run('S.eraStorage.electricKnowledge'),0);
assert.ok(run('S.items.godCrystal')>=150&&run('S.items.guardianStone')>=420,'实战材料不足以验收目标等级');
const start=run("({tick:S.tick,tech:S.res.tech,cap:resCap('tech'),crystal:S.items.godCrystal,stone:S.items.guardianStone,library:bldSt('library').lv,institute:bldSt('institute').lv})");
for(const [key,count] of Object.entries(run('({...S.popAlloc})')))
  if(count>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,`清退岗位 ${key} 失败`);
assert.equal(run("setPopAlloc('food',20)")?.ok,true);
assert.equal(run("setPopAlloc('tech',82)")?.ok,true);
const payments=[];
function pay(key,target){
  while(run(`S.eraStorage.${key}`)<target){
    const level=run(`S.eraStorage.${key}`)+1,cost=run(`eraStorageCost('${key}')`);
    const cap=run("resCap('tech')");
    assert.ok(cap>=cost.tech,`${key} Lv${level} 单笔知识${cost.tech}高于现有容量${cap}`);
    const before=run("({tech:S.res.tech,crystal:S.items.godCrystal,stone:S.items.guardianStone})");
    const available=run(`S.items.${key==='steamKnowledge'?'godCrystal':'guardianStone'}`);
    const materialCost=cost.godCrystal||cost.guardianStone||0;
    assert.ok(available>=materialCost,`${key} Lv${level}材料不足`);
    let waited=0;
    while(run('S.res.tech')<cost.tech&&waited<50000){run('tick()');waited++;}
    assert.ok(run('S.res.tech')>=cost.tech,`${key} Lv${level} 50000在线秒仍攒不够知识`);
    const atPay=run("({tech:S.res.tech,crystal:S.items.godCrystal,stone:S.items.guardianStone})");
    const result=run(`upgradeEraStorage('${key}')`);
    assert.equal(result?.ok,true,`${key} Lv${level} 研究失败：${JSON.stringify(result)}`);
    const after=run("({tech:S.res.tech,crystal:S.items.godCrystal,stone:S.items.guardianStone})");
    assert.equal(run(`S.eraStorage.${key}`),level);
    assert.ok(Math.abs(after.tech-(atPay.tech-cost.tech))<1e-5,'知识未单次实扣');
    assert.equal(after.crystal,atPay.crystal-(cost.godCrystal||0));
    assert.equal(after.stone,atPay.stone-(cost.guardianStone||0));
    payments.push({key,level,waited,second:run('S.tick'),cost,capBefore:cap,capAfter:run("resCap('tech')"),after});
  }
}
pay('steamKnowledge',8);
pay('electricKnowledge',3);
const next=run("eraStorageCost('electricKnowledge')");
const nextCap=run("resCap('tech')");
assert.equal(next.tech,8000000);
assert.ok(nextCap<next.tech,'此前界定的下一笔知识容量墙已改变，请重新审计');
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,29);
assert.equal(saved.eraStorage.steamKnowledge,8);
assert.equal(saved.eraStorage.electricKnowledge,3);
assert.equal(saved.defeated.length,45);
const restored=environment({rts_save:JSON.stringify(saved)});
assert.equal(restored.run('loadSaveAndApply().status'),'ok');
assert.equal(restored.run('S.eraStorage.steamKnowledge'),8);
assert.equal(restored.run('S.eraStorage.electricKnowledge'),3);
assert.equal(restored.run('S.items.godCrystal'),saved.items.godCrystal);
assert.equal(restored.run('S.items.guardianStone'),saved.items.guardianStone);
if(finalArg)fs.writeFileSync(finalArg.slice('--snapshot-final='.length),JSON.stringify(saved),'utf8');
console.log(JSON.stringify({unit:'online seconds and resource units',start,finish:{tick:saved.tick,tech:saved.res.tech,cap:nextCap,
  crystal:saved.items.godCrystal,stone:saved.items.guardianStone,library:saved.buildings.library.lv,institute:saved.buildings.institute.lv},
  payments,nextBlocked:{key:'electricKnowledge',level:4,cost:next,capacity:nextCap,shortfall:next.tech-nextCap}},null,2));
