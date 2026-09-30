'use strict';
// Real integrated actions with source callback pricing; optional --baseline saves failure evidence.
// These controlled state fixtures test real actions; they do not prove natural progression time.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {environment}=require('./harness');
const reference=fs.readFileSync(path.join(__dirname,'../../210(1)_unpacked/_analysis/deob_main.js'),'utf8');
const entities=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
assert.equal(crypto.createHash('sha256').update(reference).digest('hex'),'b0bc24d680517c592e8bd123148814f4f9ee24c53ddb0db8165294e131b563c4');
const anchor=reference.indexOf('getLvNeedALL');
assert.equal(anchor,1567851); // identifier start; key object starts1567844; JS code units, not bytes
const fnStart=reference.indexOf('function',anchor),bodyStart=reference.indexOf('{',fnStart);
let depth=0,quote='',escaped=false,fnEnd=-1;
for(let i=bodyStart;i<reference.length;i++){
  const ch=reference[i];
  if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
  if(ch==="'"||ch==='"'){quote=ch;continue;}
  if(ch==='{')depth++;else if(ch==='}'&&--depth===0){fnEnd=i+1;break;}
}
assert.ok(fnEnd>bodyStart);
const sourceContext=vm.createContext({_0x2474cc(){},_0x2a17f7:{player:{ArmsUP:{77:[0,0]}}},_0x3e0d3b:{77:{Name:'攻击'}}});
const sourceCost=vm.runInContext('('+reference.slice(fnStart,fnEnd)+')',sourceContext);
function motherMultiplier(name,stars){sourceContext._0x3e0d3b[77].Name=name;sourceContext._0x2a17f7.player.ArmsUP[77][0]=stars;return sourceCost(77);}
let pass=0,fail=0;
function check(name,fn){try{fn();pass++;console.log('PASS '+name)}catch(error){fail++;console.error('FAIL '+name+'\n'+error.stack)}}
function fixture(stat='atk',stars=0,progress=0,stock=1e6){
  const e=environment();
  e.run("S.sciences=['sci_bronze_age'];S.res.copper="+stock+";S.armsUp.bronze_guard."+stat+"={stars:"+stars+",progress:"+progress+"};save()");
  return e;
}
function rawState(e){return e.run('JSON.stringify({...serializeSave(),ts:0})');}
function expectUnchanged(e,reason,stat,times=1){
  const state=rawState(e),main=e.store.get('rts_save');
  assert.equal(e.run("investArmsUp('bronze_guard','"+stat+"',"+times+").reason"),reason);
  assert.equal(rawState(e),state);assert.equal(e.store.get('rts_save'),main);
}

check('source callback executes independently; all 37 explicit bands and their two ends match',()=>{
  const e=environment(),names={atk:'攻击',hp:'生命',def:'防御'};
  let bands=0;
  for(const stat of ['atk','hp','def']){
    const rows=JSON.parse(e.run('JSON.stringify(CFG.armsUpCostCurve.'+stat+'.bands)'));
    bands+=rows.length;
    for(const [from,to]of rows)for(const stars of [from,to-1]){
      const units=Number(e.run("armsUpStepCostUnits('bronze_guard','"+stat+"',"+stars+").units.toString()"));
      const expected=1000*motherMultiplier(names[stat],stars);
      assert.ok(Math.abs(units-expected)<=Math.max(1,expected)*1e-12,stat+' '+stars+' '+units+' '+expected);
    }
  }
  assert.equal(bands,37);
  assert.equal(motherMultiplier('防御',34),700000000);
  for(let stars=35;stars<40;stars++)assert.equal(motherMultiplier('防御',stars),1e15);
  assert.equal(motherMultiplier('防御',40),8200000000);
  for(const [name,stars]of [['攻击',120],['生命',1200],['防御',70]])assert.equal(motherMultiplier(name,stars),1e15);
  for(const [stat,stars]of [['atk',120],['hp',1200],['def',70]])
    assert.equal(e.run("armsUpStepCostUnits('bronze_guard','"+stat+"',"+stars+").units.toString()"),'1000000000000000000');
});

check('all nine era units use their real Need; zero-star ATK/HP/DEF charge 1/0.1/20 times base',()=>{
  const e=environment(),units=JSON.parse(e.run('JSON.stringify(CFG.armsUp)'));
  const keys=['bronze_guard','iron_spearman','silver_heavy','gold_cavalry','alloy_special','armored_trooper','electro_trooper','star_trooper','quantum_trooper'];
  assert.equal(Object.keys(units).length,9);
  for(let i=0;i<keys.length;i++){
    const uk=keys[i],cfg=units[uk],id=340002+i,base=i<6?1000:4000;
    for(const sourceId of [id,id+1000,id+2000]){
      assert.deepEqual(entities[sourceId]['armsUP:Need'][0].slice(1),[base]);
      assert.equal(entities[sourceId]['armsUP:ArmyID'],370002+i);
    }
    assert.equal(cfg.stepCost,base);
    for(const [stat,cost]of [['atk',base],['hp',base/10],['def',base*20]]){
      const f=environment();
      f.run('S.res.'+cfg.material+'='+cost);
      assert.equal(f.run("investArmsUp('"+uk+"','"+stat+"').reason"),'science-prerequisite');
      f.run('S.sciences='+JSON.stringify([cfg.needScience]));
      assert.equal(f.run("investArmsUp('"+uk+"','"+stat+"').cost"),cost);
      assert.equal(f.run('S.res.'+cfg.material),0);
      assert.equal(f.run('S.armsUp.'+uk+'.'+stat+'.progress'),1);
      assert.equal(f.run('armyCount()'),0);
      assert.equal(JSON.parse(f.store.get('rts_save')).armsUp[uk][stat].progress,1);
    }
  }
});

check('independent exact source anchors: attack9/10, HP99/100, DEF4/5 and DEF40',()=>{
  const rows=[['atk',9,10000],['atk',10,110000],['hp',99,10000],['hp',100,101000],['def',4,100000],['def',5,1200000],['def',40,8200000000000]];
  for(const [stat,stars,cost]of rows){
    const e=fixture(stat,stars,0,cost);
    assert.equal(e.run("armsUpCost('bronze_guard','"+stat+"').cost"),cost);
    assert.equal(e.run("investArmsUp('bronze_guard','"+stat+"').cost"),cost);
    assert.equal(e.run('S.res.copper'),0);
  }
});

check('bulk crossing a star reprices every next step and matches sequential actual actions',()=>{
  const rows=[['atk',0,3000],['atk',9,120000],['hp',99,111000],['def',4,1300000]];
  for(const [stat,stars,cost]of rows){
    const bulk=fixture(stat,stars,999,cost),single=fixture(stat,stars,999,cost);
    assert.equal(bulk.run("investArmsUp('bronze_guard','"+stat+"',2).cost"),cost);
    const a=single.run("investArmsUp('bronze_guard','"+stat+"').cost"),b=single.run("investArmsUp('bronze_guard','"+stat+"').cost");
    assert.equal(a+b,cost);assert.equal(bulk.run('S.res.copper'),0);
    assert.equal(bulk.run('JSON.stringify(S.armsUp)'),single.run('JSON.stringify(S.armsUp)'));
    assert.equal(bulk.run('S.res.copper'),single.run('S.res.copper'));
    const reload=environment({rts_save:bulk.store.get('rts_save')});
    assert.equal(reload.run('loadSaveAndApply().status'),'ok');
    assert.equal(reload.run('JSON.stringify(S.armsUp)'),bulk.run('JSON.stringify(S.armsUp)'));
    assert.equal(reload.run('armyCount()'),0);
  }
  const full=fixture('atk',9,999,109900000);
  assert.equal(full.run("investArmsUp('bronze_guard','atk',1000).cost"),109900000);
  assert.equal(full.run('S.res.copper'),0);
  assert.equal(full.run('S.armsUp.bronze_guard.atk.stars'),10);
  assert.equal(full.run('S.armsUp.bronze_guard.atk.progress'),999);
});

check('one material short and invalid count refuse the entire batch without payment or save write',()=>{
  expectUnchanged(fixture('atk',9,999,119999),'insufficient-resources','atk',2);
  for(const times of [0,-1,1001,1.5])expectUnchanged(fixture(),'invalid-count','atk',times);
});

check('primary write failure after successful backup rolls back resources, stars and progress',()=>{
  const e=fixture('atk',9,999,120000),before=rawState(e),main=e.store.get('rts_save');
  e.run("const p409SetItem=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('primary quota');return p409SetItem(key,value)}");
  assert.equal(e.run("investArmsUp('bronze_guard','atk',2).reason"),'save-failed');
  assert.equal(rawState(e),before);assert.equal(e.store.get('rts_save'),main);
  assert.equal(e.store.get('rts_save_backup_1'),main);
  const reload=environment({rts_save:main});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.armsUp.bronze_guard.atk.stars'),9);
  assert.equal(reload.run('S.res.copper'),120000);
});

check('backup failure also leaves primary save and in-memory investment unchanged',()=>{
  const e=fixture('hp',99,999,111000);
  e.run("localStorage.setItem=()=>{throw Error('storage full')}");
  expectUnchanged(e,'save-failed','hp',2);
});

check('DEF34 crossing and legacy35-39 pay the actual source fallback, without a new star wall',()=>{
  const e=fixture('def',34,999,700000000000);
  expectUnchanged(e,'insufficient-resources','def',2);
  assert.equal(e.run("investArmsUp('bronze_guard','def').cost"),700000000000);
  assert.equal(e.run('S.armsUp.bronze_guard.def.stars'),35);
  assert.equal(e.run('S.armsUp.bronze_guard.def.progress'),0);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.armsUp.bronze_guard.def.stars'),35);
  for(let stars=35;stars<40;stars++){
    const old=fixture('def',stars,321,1e18);
    assert.equal(old.run("armsUpBonus('bronze_guard','def')"),stars);
    assert.equal(old.run("armsUpCost('bronze_guard','def').cost"),1e18);
    assert.equal(old.run("investArmsUp('bronze_guard','def').cost"),1e18);
    assert.equal(old.run('S.res.copper'),0);
    assert.equal(old.run('S.armsUp.bronze_guard.def.progress'),322);
  }
  const bulk=fixture('def',34,999,1000000700000000000);
  assert.equal(bulk.run("investArmsUp('bronze_guard','def',2).cost"),1000000700000000000);
  assert.equal(bulk.run('S.res.copper'),0);
  assert.equal(bulk.run('S.armsUp.bronze_guard.def.stars'),35);
  assert.equal(bulk.run('S.armsUp.bronze_guard.def.progress'),1);
  for(const stat of ['atk','hp'])assert.equal(fixture(stat,35,0,1e9).run("investArmsUp('bronze_guard','"+stat+"').ok"),true);
});

check('exact high prices remain payable; history survives and unrepresentable actual debit is refused',()=>{
  const names={atk:'攻击',hp:'生命',def:'防御'};
  for(const [stat,stars]of [['atk',110],['atk',120],['hp',1100],['hp',1200],['def',60],['def',70]]){
    const e=fixture(stat,stars,999,1e18),main=e.store.get('rts_save');
    const reload=environment({rts_save:main});
    assert.equal(reload.run('loadSaveAndApply().status'),'ok');
    assert.equal(reload.run('S.res.copper'),1e18);
    assert.equal(reload.run('S.armsUp.bronze_guard.'+stat+'.stars'),stars);
    assert.equal(reload.run('S.armsUp.bronze_guard.'+stat+'.progress'),999);
    assert.equal(reload.run("armsUpBonus('bronze_guard','"+stat+"')"),e.run("armsUpBonus('bronze_guard','"+stat+"')"));
    const cost=1000*motherMultiplier(names[stat],stars);
    assert.equal(e.run("armsUpCost('bronze_guard','"+stat+"').cost"),cost);
    assert.equal(e.run("investArmsUp('bronze_guard','"+stat+"').cost"),cost);
    assert.equal(e.run('S.res.copper'),1e18-cost);
    assert.equal(e.run('S.armsUp.bronze_guard.'+stat+'.stars'),stars+1);
  }
  const full=fixture('def',35,0,1e21);
  assert.equal(full.run("investArmsUp('bronze_guard','def',1000).cost"),1e21);
  assert.equal(full.run('S.res.copper'),0);
  assert.equal(full.run('S.armsUp.bronze_guard.def.stars'),36);
  // 1e18-1000 rounds to a debit of1024; retaining stock is safer than a mischarged investment.
  expectUnchanged(fixture('atk',0,0,1e18),'numeric-limit','atk');
});

check('UI batch selection can use an exactly payable smaller batch and later cross the star',()=>{
  const e=fixture('atk',0,0,1e18);
  expectUnchanged(e,'numeric-limit','atk');
  assert.equal(e.run("armsUpPayableBatch('bronze_guard','atk')"),992);
  assert.equal(e.run("investArmsUp('bronze_guard','atk',992).cost"),992000);
  assert.equal(e.run('S.res.copper'),1e18-992000);
  assert.equal(e.run('S.armsUp.bronze_guard.atk.progress'),992);
  const next=e.run("armsUpPayableBatch('bronze_guard','atk')");
  assert.equal(next,996);
  assert.equal(e.run("investArmsUp('bronze_guard','atk',996).cost"),1984000);
  assert.equal(e.run('S.armsUp.bronze_guard.atk.stars'),1);
  assert.equal(e.run('S.armsUp.bronze_guard.atk.progress'),988);
  for(const stock of [1000.1,1000.75,10000.5,120000.125]){
    const fractional=fixture('atk',0,0,stock),before=fractional.run('S.res.copper');
    assert.equal(fractional.run("investArmsUp('bronze_guard','atk').cost"),1000);
    assert.equal(fractional.run('S.res.copper'),before-1000);
  }
});

check('existing schema and legal zeros persist; no caps or star limit added to save validation',()=>{
  const e=fixture('hp',0,0,100);
  const version=e.run('targetSaveVersion()');
  assert.equal(e.run("investArmsUp('bronze_guard','hp').cost"),100);
  const saved=JSON.parse(e.store.get('rts_save'));
  assert.equal(version,36);assert.equal(saved.v,36);assert.equal(saved.res.copper,0);
  assert.equal(saved.armsUp.bronze_guard.hp.stars,0);
  assert.equal(saved.armsUp.bronze_guard.hp.progress,1);
  const reload=environment({rts_save:JSON.stringify(saved)});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.res.copper'),0);
});
console.log('arms_up_cost_p409: pass '+pass+' fail '+fail);
process.exit(fail?1:0);
