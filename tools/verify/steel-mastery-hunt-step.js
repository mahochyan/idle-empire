'use strict';
// 供自然新档探针复用的真实郊野猎骨→边贸行→冶钢精通6～13级动作；可多留兽骨供14～20级。
const assert=require('node:assert/strict');

module.exports=function steelMasteryHuntStep({run,assign,waitFor,build,action,extraActions},random=0.5,fighters=8,boneTarget=1140,seed=null){
  assert.ok(Number.isFinite(random)&&random>=0&&random<1,'战斗随机值须在[0,1)');
  assert.ok(Number.isSafeInteger(fighters)&&fighters>=1&&fighters<=10,'合金猎队人数须为1～10');
  assert.ok(Number.isSafeInteger(boneTarget)&&boneTarget>=1140,'兽骨目标不得低于前13级费用');
  assert.ok(seed===null||(Number.isSafeInteger(seed)&&seed>0&&seed<=0xffffffff),'随机种子须为非零32位整数');
  assert.equal(run('S.steelMasteryLv'),5);
  assert.equal(run('S.defeated.length'),0);
  assert.equal(run('S.res.medal'),0);
  const begin=run('S.tick');
  if(fighters>run('regMax()')){
    assign({wood:8,stone:8,food:10});
    build('barracks');
  }
  assert.ok(run('regMax()')>=fighters);
  const armoryUpgrades=[];
  while(run("unitCap('alloy_special')")<fighters){
    const before=run("bldSt('alloy_armory').lv"),cost=run("upCost('alloy_armory')");
    assign({wood:8,stone:8,food:10});
    waitFor(Object.entries(cost).filter(([rk,n])=>rk!=='time'&&n>0)
      .map(([rk,n])=>`S.res.${rk}>=${n}`).join('&&'),50000);
    action("buildAct('alloy_armory')",'build',`合金兵坊 Lv${before+1}`);
    waitFor(`bldSt('alloy_armory').lv===${before+1}&&bldSt('alloy_armory').state==='idle'`,130);
    armoryUpgrades.push({level:before+1,cost});
  }
  for(let target=2;target<=fighters;target++){
    assign({food:2,stone:8,coal:7,iron:5,steel:4});
    waitFor('S.res.steel>=100&&S.res.food>=1500',50000);
    const trained=run("train('alloy_special',1)");
    assert.equal(trained?.ok,true,JSON.stringify(trained));
    extraActions.train++;
    waitFor(`S.pool.alloy_special>=${target}`,20);
  }
  run(`
    globalThis.__huntOriginal={setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,
      getElementById:document.getElementById,random:Math.random};
    globalThis.__huntTimers=new Map();globalThis.__huntNextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__huntNextTimer++;__huntTimers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__huntTimers.delete(id);
    globalThis.__huntStep=()=>{const entry=__huntTimers.entries().next().value;if(!entry)return false;
      __huntTimers.delete(entry[0]);entry[1]();return true};
    globalThis.__huntNodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__huntNodes.has(id))__huntNodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __huntNodes.get(id)};
    ${seed===null?`Math.random=()=>${random};`:`globalThis.__huntSeed=${seed};Math.random=()=>{
      let x=__huntSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__huntSeed=x>>>0;return __huntSeed/4294967296;};`}
    openFormModal('expedition','front',0);
    S._formModalSel='alloy_special';S._formModalQty=${fighters};confirmForm();
  `);
  assert.equal(run('S.formation.front[0].count'),fighters);
  assert.equal(run('S.pool.alloy_special'),0);
  const requiredMedals=2280,requiredBone=1140;
  const wins=[];
  for(let n=0;n<120&&run('S.res.bone')<boneTarget;n++){
    const before=run('({bone:S.res.bone,kill:S.killValues.wildBoar})');
    run("openMaterialDomain('bone')");
    assert.equal(run('S.battleActive'),true,'郊野战斗未启动');
    for(let step=0;step<500&&run('S.battleActive');step++)assert.equal(run('__huntStep()'),true,'战斗回调丢失');
    assert.equal(run('S.battleActive'),false,'郊野战斗未结束');
    const after=run('({bone:S.res.bone,kill:S.killValues.wildBoar,form:S.formation.front[0]?.count||0,round:B.round})');
    wins.push({number:n+1,boneGain:after.bone-before.bone,survivors:after.form,round:after.round});
    assert.ok(after.bone>before.bone,`第${n+1}场郊野战斗失败：${JSON.stringify({before,after})}`);
    assert.equal(after.kill,before.kill+10);
    run('exitBattle()');
  }
  const boneEarned=run('S.res.bone');
  assert.ok(boneEarned>=boneTarget,`${wins.length}场后兽骨不足：${boneEarned}`);
  const released=run(`globalThis.setTimeout=__huntOriginal.setTimeout;globalThis.clearTimeout=__huntOriginal.clearTimeout;
    document.getElementById=__huntOriginal.getElementById;Math.random=__huntOriginal.random;
    clrForm('expedition');save();`);
  assert.equal(released?.ok,true,'猎队归池写档失败');
  assert.equal(run('S.formation.front.length'),0);
  assert.equal(run('S.pool.alloy_special'),fighters);
  const traded=run('exchangeBonesForMedals(114)');
  assert.equal(traded?.ok,true,JSON.stringify(traded));
  assert.equal(run('S.res.medal'),requiredMedals);
  assert.equal(run('S.daily.counts.market||0'),0);
  assign({food:5,tech:21});
  const payments=[];
  for(let target=6;target<=13;target++){
    const cost=run('steelMasteryCost()');
    assert.equal(cost.tech,1500*target);
    assert.equal(cost.medal,30*target);
    assert.ok(run("resCap('tech')")>=cost.tech,'当前知识容量不足');
    waitFor(`S.res.tech>=${cost.tech}`,50000);
    const before=run('({tech:S.res.tech,medal:S.res.medal})');
    action('upgradeSteelMastery()','research',`冶钢精通 Lv${target}`);
    assert.equal(run('S.steelMasteryLv'),target);
    assert.equal(run('S.res.tech'),before.tech-cost.tech);
    assert.equal(run('S.res.medal'),before.medal-cost.medal);
    payments.push({level:target,second:run('S.tick'),tech:cost.tech,medal:cost.medal});
  }
  assert.equal(run('S.res.medal'),0);
  const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
  assert.equal(saved.v,run('targetSaveVersion()'));
  assert.equal(saved.steelMasteryLv,13);
  assert.equal(saved.pool.alloy_special,fighters);
  assert.equal(saved.buildings.alloy_armory.lv,run("bldSt('alloy_armory').lv"));
  assert.equal(saved.formation.front.length,0);
  assert.equal(saved.defeated.length,0);
  assert.equal(saved.killValues.wildBoar,wins.length*10);
  assert.equal(saved.res.bone,boneEarned-requiredBone);
  assert.equal(run('S.battleActive'),false);
  return{unit:'online tick seconds',start:begin,finish:run('S.tick'),elapsed:run('S.tick')-begin,
    fighters,armoryUpgrades,level:13,requiredMedals,requiredBone,boneTarget,boneEarned,remainingBone:run('S.res.bone'),
    wildWins:wins.length,battleRandom:seed===null?random:null,battleSeed:seed,battleTimeExcluded:true,
    first:wins[0],last:wins.at(-1),payments,saveVersion:saved.v};
};
