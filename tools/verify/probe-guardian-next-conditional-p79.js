'use strict';
// P79：从守御4300实付胜利档独立试战下一警戒值；条件补满兵仅作敏感性诊断。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const inputArg=process.argv.find(x=>x.startsWith('--input='));
const inputPath=path.resolve(inputArg?inputArg.slice('--input='.length):path.resolve(__dirname,'../../docs/codex/reports/data/p79-guardian4300-first-win-paid.json'));
const raw=fs.readFileSync(inputPath,'utf8');
const keys=['guardianStone'];
const result=[];
for(const key of keys){
  const trials=[];
  for(let seed=1;seed<=12;seed++){
    const e=environment({rts_save:raw}),run=e.run;
    assert.equal(run('loadSaveAndApply().status'),'ok');
    {
      // 仅在不保存的副本里把战损前排条件补足，不注入交付档。
      run('S.formation.front.forEach((u,i)=>u.count=[55,45,55,55][i])');
      assert.equal(run('armyCount()'),515);
    }
    run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
      globalThis.setTimeout=fn=>{let id=__nextTimer++;__timers.set(id,fn);return id};
      globalThis.clearTimeout=id=>__timers.delete(id);
      globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
      globalThis.__nodes=new Map();document.getElementById=id=>{
        if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
        if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
          classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
        return __nodes.get(id)};
      globalThis.addLog=m=>S.log.push(String(m));
      globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
    const killKey=run(`specialEncounterConfig('${key}').killValueKey`);
    const before=run(`({kill:S.killValues['${killKey}'],army:armyCount(),stock:S.items['${key==='bone'?'boarHeart':key}']})`);
    run(`openMaterialDomain('${key}')`);
    assert.equal(run('S.battleActive'),true);
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<1000){assert.equal(run('__step()'),true);callbacks++}
    assert.equal(run('S.battleActive'),false);
    const after=run(`({kill:S.killValues['${killKey}'],army:armyCount(),stock:S.items['${key==='bone'?'boarHeart':key}'],round:B.round,enemyHp:B.enemyUnits[0]?.hp})`);
    trials.push({seed,win:after.kill>before.kill,round:after.round,armyLost:before.army-after.army,drop:after.stock-before.stock,enemyHp:after.enemyHp,callbacks});
  }
  const wins=trials.filter(x=>x.win);
  result.push({key,wins:wins.length,dropWins:wins.filter(x=>x.drop>0).length,
    minLoss:wins.length?Math.min(...wins.map(x=>x.armyLost)):null,
    maxLoss:wins.length?Math.max(...wins.map(x=>x.armyLost)):null,
    best:trials.slice().sort((a,b)=>Number(b.win)-Number(a.win)||a.enemyHp-b.enemyHp)[0],
    ...(process.argv.includes('--detail')?{trials}:{})});
}
console.log(JSON.stringify({kind:'unpaid 515-soldier formation sensitivity only',source:inputPath,unit:'battle rounds; soldiers; items',result},null,2));
