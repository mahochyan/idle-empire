// ==================== 状态 ====================
let S = {
  res:{wood:300,stone:300,food:300,tech:0},
  buildings:{},
  pool:{infantry:0,archer:0,mage:0},
  formation:{front:[],mid:[],back:[]},
  townLv:1,
  popAlloc:{wood:3,stone:3,food:4},
  defeated:[],
  mageOk:false,
  merit:0,
  log:[],
  garrisonLog:[],
  garrison:null,
  tick:0,
  page:'home',
  selEnemy:null,
  queue:{},
  battleSpeed:2,
  battleActive:false,
  _trainQty:{},
  _testUnlocked:false,
  _garrisonForm:{front:[],mid:[],back:[]},
  _fightTab:'expedition',
  _buildTab:'basic',
  _barracksTier:'t0',
  _barracksFold:{},
  townUpgrade:null,
  upgradedUnits:{},
  essence:{}
};

// ==================== 辅助 ====================
function bldSt(k){return S.buildings[k]||{lv:0,state:'idle',timer:0,timerEnd:0,tier:0}}
function bldCfg(k){return CFG.buildings[k]}
function prodRate(rk){
  const alloc=S.popAlloc[rk]||0;
  const base=CFG.res[rk].basePerPop||0.5;
  return alloc*base*(1+buildingBuff(rk));
}
function buildingBuff(rk){
  const bk=Object.keys(CFG.buildings).find(k=>CFG.buildings[k].buffRes===rk);
  if(!bk)return 0;
  const cfg=CFG.buildings[bk],st=bldSt(bk);
  if(st.state==='idle'&&st.lv>0)return cfg.buffBase+st.lv*cfg.buffPerLv;
  return 0;
}
function townCfg(){return CFG.town.find(t=>t.lv===S.townLv)||CFG.town[0]}
function maxPop(){return townCfg().maxPop}
function popAllocTotal(){return Object.values(S.popAlloc).reduce((a,b)=>a+b,0)}
function popFree(){return Math.max(0,maxPop()-popAllocTotal())}
function townUpgradeNeedBossId(){
  const next=CFG.town.find(t=>t.lv===S.townLv+1);
  return next?next.needBossId:999;
}
function townCanUpgrade(){
  if(S.townUpgrade)return false;
  if(S.townLv>=CFG.town.length)return false;
  const needId=townUpgradeNeedBossId();
  if(needId===0)return true;
  return S.defeated.includes(needId);
}
function bossDefeatedCount(){
  return CFG.enemies.filter(e=>e.boss&&S.defeated.includes(e.id)).length;
}
function resourceLevelCap(){
  return bossDefeatedCount() + 1;
}
function resourceCapText(){
  return `本章上限 Lv.${resourceLevelCap()}`;
}
function storageCapacity(){
  const whLv=(S.buildings.warehouse||{lv:0}).lv;
  const cfg=CFG.buildings.warehouse;
  return (cfg.storageBase??2000) + whLv * (cfg.storagePerLv??500);
}
function upgradeLockReason(key){
  const cfg=CFG.buildings[key],st=bldSt(key),cap=CFG.buildingCaps;
  // 兵营建筑（步兵/弓兵/骑兵/矛兵/法师）：上限 = 城镇等级 × buildingCaps.training
  if(cfg.trains && st.lv>=S.townLv*cap.training) return `需升级城镇到Lv.${Math.floor(st.lv/cap.training)+1}`;
  // 仓库：上限 = 城镇等级 × buildingCaps.warehouse
  if(cfg.storagePerLv && st.lv>=S.townLv*cap.warehouse) return `需升级城镇到Lv.${Math.floor(st.lv/cap.warehouse)+1}`;
  // 营帐：上限 = 城镇等级 × buildingCaps.barracks
  if(!cfg.trains&&!cfg.storagePerLv&&!cfg.buffRes && st.lv>=S.townLv*cap.barracks) return `需升级城镇到Lv.${Math.floor(st.lv/cap.barracks)+1}`;
  // 资源建筑（伐木场/采石场/农田）：上限 = 城镇等级 × buildingCaps.resource
  if(cfg.buffRes && st.lv>=S.townLv*cap.resource) return `需升级城镇到Lv.${Math.floor(st.lv/cap.resource)+1}`;
  return '';
}
function regMax(){
  const s=bldSt('barracks');
  return 5+(s.state==='idle'?s.lv*5:0);
}
function baseUnitType(uk){
  return CFG.units[uk]?.baseUnit||uk;
}
function unitTag(uk){
  return CFG.units[uk]?.tag||null;
}
// 统一克制结算：有tag优先innerCounters，无tag fallback到counters（避免双重结算）
function cm(atk,def){
  const atkTag=unitTag(atk),defTag=unitTag(def);
  if(atkTag&&defTag)return CFG.innerCounters[atkTag]?.[defTag]||1.0;
  if(atkTag&&!defTag)return CFG.innerCounters[atkTag]?._default||(CFG.counters[baseUnitType(atk)]?.[baseUnitType(def)]||1.0);
  if(!atkTag&&defTag)return (CFG.innerNoTagDef||1.0)*(CFG.counters[baseUnitType(atk)]?.[baseUnitType(def)]||1.0);
  return CFG.counters[baseUnitType(atk)]?.[baseUnitType(def)]||1.0;
}
function trainBuildingKey(uk){
  const bu=baseUnitType(uk);
  return Object.keys(CFG.buildings).find(k=>CFG.buildings[k].trains===bu)||null;
}
function trainBuildingState(uk){
  const key=trainBuildingKey(uk);
  return key?bldSt(key):null;
}
function unitCap(uk){
  const bu=baseUnitType(uk);
  const key=trainBuildingKey(bu);
  if(!key)return 0;
  const cfg=CFG.buildings[key],st=bldSt(key);
  if(st.lv<=0)return 0;
  const bldTier=st.tier??0;
  const unitTier=CFG.units[uk]?.tier??0;
  if(unitTier>bldTier)return 0;
  return (cfg.unitCapBase||0) + st.lv * (cfg.unitCapPerLv||0);
}
function garrisonCount(uk){
  let n=0;
  const gf=S._garrisonForm||{front:[],mid:[],back:[]};
  for(const row of['front','mid','back']){
    for(const u of gf[row]){if(u.type===uk||baseUnitType(u.type)===uk)n+=u.count;}
  }
  return n;
}
function expeditionCount(uk){
  let n=0;
  for(const row of['front','mid','back']){
    for(const u of S.formation[row]){if(u.type===uk||baseUnitType(u.type)===uk)n+=u.count;}
  }
  return n;
}
function sameLine(a,b){return baseUnitType(a)===baseUnitType(b)}
function unitCapLeft(uk){
  let used=0;
  for(const[k,v] of Object.entries(S.pool)){if(sameLine(k,uk))used+=v;}
  for(const row of['front','mid','back']){
    for(const u of S.formation[row]){if(sameLine(u.type,uk))used+=u.count;}
    for(const u of S._garrisonForm[row]){if(sameLine(u.type,uk))used+=u.count;}
  }
  return Math.max(0,unitCap(uk)-used);
}
function queueTotal(uk){
  const q=S.queue[uk];
  return q?q.count:0;
}
function queueMax(uk){
  return unitCap(uk)*(CFG.queueMultiplier||5);
}
function processQueue(){
  let changed=false;
  for(const[uk,q] of Object.entries(S.queue)){
    if(!q||!q.count){q.reason='';continue;}
    const lock=trainLockReason(uk);
    if(lock){q.reason='';continue;}
    const tt=CFG.units[uk].trainTime||1;
    if(q.timer>0){q.timer--;}
    if(q.timer<=0&&q.count>0){
      if(unitCapLeft(uk)<=0)continue;
      const cost=CFG.units[uk].cost;
      if(S.res.wood<cost.wood||S.res.stone<cost.stone||S.res.food<cost.food){q.reason='资源不足，暂停生产';continue;}
      S.res.wood-=cost.wood;S.res.stone-=cost.stone;S.res.food-=cost.food;
      S.pool[uk]=(S.pool[uk]||0)+1;
      q.count--;
      changed=true;
      q.reason='';
      if(q.count>0)q.timer=tt;else{q.timer=0;q.reason='';}
    }
  }
  if(changed)save();
}
function trainLockReason(uk){
  const unitCfg=CFG.units[uk];
  if(unitCfg&&unitCfg.locked){
    if(baseUnitType(uk)===uk){
      const key=trainBuildingKey(uk);
      if(!key)return '';
      const cfg=CFG.buildings[key],st=bldSt(key);
      if(cfg.needBoss&&bossDefeatedCount()<cfg.needBoss)return '击败'+cfg.needBoss+'个Boss后解锁'+cfg.name;
      if(st.lv<=0&&st.state==='idle')return `需先建造${cfg.name}`;
      if(st.state==='building')return `${cfg.name}建设中`;
      if(st.state==='upgrading')return `${cfg.name}升级中`;
      return '';
    }else{
      if(!S.upgradedUnits[uk]){
        const tree=CFG.unitUpgrades[baseUnitType(uk)]?.tree;
        for(const[,node] of Object.entries(tree||{})){
          for(const br of node.branches||[]){
            if(br.to===uk){
              let msg=`需在科技树研究「${br.name}」(科技点:${br.needTech||0}`;
              msg+=`, 战功:${br.needMerit||0}`;
              if(br.needEssence){
                const ei=CFG.essences?.[br.needEssence.type];
                msg+=`, ${ei?.name||br.needEssence.type}:${br.needEssence.count}`;
              }
              msg+=`)`;
              return msg;
            }
          }
        }
        return '需在科技树研究升级';
      }
    }
  }
  const key=trainBuildingKey(uk);
  if(!key)return '';
  const cfg=CFG.buildings[key],st=bldSt(key);
  if(cfg.needBoss&&bossDefeatedCount()<cfg.needBoss)return '击败'+cfg.needBoss+'个Boss后解锁'+cfg.name;
  if(st.lv<=0&&st.state==='idle')return `需先建造${cfg.name}`;
  if(st.state==='building')return `${cfg.name}建设中`;
  if(st.state==='upgrading')return `${cfg.name}升级中`;
  if(st.state==='tier_upgrading')return `${cfg.name}时代升级中`;
  const bldTier=st.tier??0;
  const unitTier=CFG.units[uk]?.tier??0;
  if(unitTier>bldTier)return `需将${cfg.name}升级至T${unitTier}`;
  return '';
}
function mageOk(){return bossDefeatedCount()>=2;}
function trainBuildingLabel(uk){
  const key=trainBuildingKey(uk);
  if(!key)return '';
  const cfg=CFG.buildings[key],st=bldSt(key);
  if(st.lv<=0)return `${cfg.name}: \u672a\u5efa\u9020`;
  const tLabel='T'+(st.tier||0);
  return `${cfg.name}: Lv.${st.lv} ${tLabel}${st.state==='idle'?'':' / \u6682\u505c\u8bad\u7ec3'}`;
}
function reserveHtml(uk){
  const cap=unitCap(uk);
  let pool=0,garrison=0,expedition=0;
  for(const[k,v] of Object.entries(S.pool)){if(sameLine(k,uk))pool+=v;}
  for(const row of['front','mid','back']){
    for(const u of S.formation[row]){if(sameLine(u.type,uk))expedition+=u.count;}
    for(const u of S._garrisonForm[row]){if(sameLine(u.type,uk))garrison+=u.count;}
  }
  const used=pool+garrison+expedition;
  const cls=cap>0&&used<=cap?'limit-ok':'limit-warn';
  const extra=cap>0?` | 上限 ${cap} = 远征 ${expedition} + 驻军 ${garrison} + 余量 ${pool} (本线合计)`:'';
  return extra;
}
function totalSoldiers(){
  let n=0;for(const v of Object.values(S.pool)) n+=v;
  for(const row of['front','mid','back']){
    for(const u of S.formation[row]) n+=u.count;
    for(const u of S._garrisonForm[row]) n+=u.count;
  }
  return n;
}
function formCnt(){return S.formation.front.length+S.formation.mid.length+S.formation.back.length}
function poolAvail(uk){ return S.pool[uk]||0; }
// 获取当前编辑目标阵容
function getForm(which){ return which==='garrison'?S._garrisonForm:S.formation; }
// 切换战斗页子标签
function setFightTab(tab){ S._fightTab=tab; updateUI(); }
function setBuildTab(tab){ S._buildTab=tab; updateUI(); }
function setBarracksTier(tier){ S._barracksTier=tier; updateUI(); }
function rowSlots(row){
  const boss=bossDefeatedCount();
  if(row==='front') return 1+(boss>=1?1:0);
  if(row==='mid') return 1+(boss>=2?1:0);
  return 1;
}
function formSlots(){ return rowSlots('front')+rowSlots('mid')+rowSlots('back'); }
function totalUpkeep(){
  let up=0;
  for(const[k,c] of Object.entries(CFG.units)){
    up+=(S.pool[k]||0)*(c.upkeep||0);
    for(const row of['front','mid','back']){
      for(const u of S.formation[row]){ if(u.type===k) up+=u.count*(c.upkeep||0); }
      for(const u of S._garrisonForm[row]){ if(u.type===k) up+=u.count*(c.upkeep||0); }
    }
  }
  return up;
}
function mm(atk,def){
  if(atk==='mage'&&def!=='mage')return CFG.counters.mage[def]||1.0;
  if(atk!=='mage'&&def==='mage')return CFG.normalVsMage;
  return 1.0;
}
function missRate(attacker,defender){
  // 刃(blade)刺客不受弓兵基础miss影响
  if(attacker.tag==='blade')return 0;
  const cfg=CFG.miss[attacker.type]||CFG.miss[baseUnitType(attacker.type)];
  if(!cfg)return 0;
  // 弩(crossbow)不受骑兵额外miss影响，仅保留基础miss
  if(attacker.tag==='crossbow'&&baseUnitType(defender.type)==='cavalry')return cfg.base||0;
  return cfg[defender.type]??cfg.base??0;
}
function isAttackMiss(attacker,defender){
  const baseRate=missRate(attacker,defender);
  let rate=baseRate;
  // 弓攻击骑兵：额外50%miss
  if(attacker.tag==='bow'&&baseUnitType(defender.type)==='cavalry'){
    rate=Math.max(rate,CFG.archerSpecials?.bow?.attack?.vsCavalry?.miss||0.5);
  }
  return rate>0&&Math.random()<rate;
}

function save(){
  const d={res:S.res,buildings:S.buildings,pool:S.pool,queue:S.queue,formation:S.formation,townLv:S.townLv,popAlloc:S.popAlloc,defeated:S.defeated,mageOk:S.mageOk,merit:S.merit,garrisonLog:S.garrisonLog,garrison:S.garrison,tick:S.tick,garrisonForm:S._garrisonForm,townUpgrade:S.townUpgrade,upgradedUnits:S.upgradedUnits,essence:S.essence};
  localStorage.setItem('rts_save',JSON.stringify(d));
}
function load(){
  const r=localStorage.getItem('rts_save');if(!r)return;
  try{const d=JSON.parse(r);S.res=d.res||S.res;S.buildings=d.buildings||{};S.pool=d.pool||S.pool;S.formation=d.formation||S.formation;S.townLv=d.townLv||1;S.popAlloc=d.popAlloc||{wood:5,stone:3,food:2};S.defeated=d.defeated||[];S.mageOk=d.mageOk||false;S.merit=d.merit||0;S.garrisonLog=d.garrisonLog||[];S.garrison=d.garrison||S.garrison;S.queue=d.queue||{};S.tick=d.tick||0;S._garrisonForm=d.garrisonForm||{front:[],mid:[],back:[]};S.townUpgrade=d.townUpgrade||null;S.upgradedUnits=d.upgradedUnits||{};S.essence=d.essence||{};if(typeof ensureGarrisonState==='function')ensureGarrisonState();}catch(e){}
}

// ==================== 计时 ====================
function tick(){
  S.tick++;if(S.battleActive)return;
  let ch=false;
  // 城镇升级计时
  if(S.townUpgrade){
    S.townUpgrade.timer--;
    if(S.townUpgrade.timer<=0){
      S.townLv++;
      addLog(`城镇升级为${townCfg().name}，村民上限${maxPop()}`);
      S.townUpgrade=null;ch=true;
    }
  }
  for(const k of Object.keys(CFG.buildings)){
    const st=bldSt(k);
    if((st.state==='building'||st.state==='upgrading'||st.state==='tier_upgrading')&&st.timerEnd>0){
      st.timer--;if(st.timer<=0){
        if(st.state==='building'){st.lv=1;addLog(`${CFG.buildings[k].name}建成`)}
        else if(st.state==='tier_upgrading'){
          st.tier=(st.tier||0)+1;
          addLog(`${CFG.buildings[k].name}升级到T${st.tier}`);
        }
        else{st.lv++;addLog(`${CFG.buildings[k].name}→Lv.${st.lv}`)}
        st.state='idle';st.timer=0;st.timerEnd=0;ch=true;
      }
    }
  }
  if(ch)save();processQueue();
  const cap=storageCapacity();
  for(const rk of Object.keys(CFG.res)){
    if(rk==='tech')continue;
    if(rk==='food'){
      S.res[rk]=Math.min(S.res[rk]+prodRate(rk)-totalUpkeep()-popAllocTotal()*(CFG.popFoodCost||0.1), cap);
      if(S.res[rk]<0)S.res[rk]=0;
    }else{
      S.res[rk]=Math.min(S.res[rk]+prodRate(rk), cap);
    }
  }
  if(typeof garrisonTick==='function')garrisonTick();
  if(S.tick%60===0)save();
  updateUI();
}

// ==================== 操作 ====================
function buildAct(key){
  const cfg=CFG.buildings[key],st=bldSt(key);
  if(cfg.needBoss && bossDefeatedCount()<cfg.needBoss){toast(`击败${cfg.needBoss}个Boss后解锁`);return}
  if(st.state!=='idle'){toast(st.state==='building'?'建造中':'升级中');return}
  const upLock=st.lv>0?upgradeLockReason(key):'';
  if(upLock){toast(upLock);return}
  const rawCost=st.lv===0?cfg.build:upCost(key);
  const cost={...rawCost, time:Math.min(rawCost.time, CFG.maxUpgradeTime||120)};
  if(S.res.wood<cost.wood||S.res.stone<cost.stone||S.res.food<cost.food){toast('资源不足');return}
  S.res.wood-=cost.wood;S.res.stone-=cost.stone;S.res.food-=cost.food;
  if(!S.buildings[key])S.buildings[key]={lv:0,state:'idle',timer:0,timerEnd:0,tier:(CFG.buildings[key]?.tier||0)};
  const bs=S.buildings[key];
  if(bs.lv===0){bs.state='building';bs.timerEnd=cost.time;bs.timer=cost.time;addLog(`开始建造${cfg.name}`)}
  else{bs.state='upgrading';bs.timerEnd=cost.time;bs.timer=cost.time;addLog(`开始升级${cfg.name}`)}
  save();updateUI();
}
function tierUpgradeLockReason(key){
  const cfg=CFG.buildings[key],st=bldSt(key);
  if(!cfg.tierUpgrade||!cfg.tierUpgrade.length)return '无法时代升级';
  const currentTier=st.tier||0;
  if(currentTier>=4)return '已达最高时代';
  if(!cfg.tierUpgrade[currentTier])return '无法继续升级';
  if(st.state!=='idle'){
    if(st.state==='building')return '建造中';
    if(st.state==='upgrading')return '升级中';
    if(st.state==='tier_upgrading')return '时代升级中';
    return '建设中';
  }
  const upg=cfg.tierUpgrade[currentTier];
  if(upg.needBossId&&!S.defeated.includes(upg.needBossId)){
    const be=CFG.enemies.find(e=>e.id===upg.needBossId);
    return `需击败第${upg.needBossId}关Boss「${be?.name||'?'}」`;
  }
  const cost=upg.cost;
  if(S.res.wood<cost.wood||S.res.stone<cost.stone||S.res.food<cost.food)return '资源不足';
  return '';
}
function tierUpgradeCost(key){
  const cfg=CFG.buildings[key],st=bldSt(key);
  const currentTier=st.tier||0;
  const upg=cfg.tierUpgrade?.[currentTier];
  if(!upg)return null;
  return {wood:upg.cost.wood,stone:upg.cost.stone,food:upg.cost.food,time:Math.min(upg.time||30,CFG.maxUpgradeTime||120)};
}
function buildTierUpgradeAct(key){
  const cfg=CFG.buildings[key],st=bldSt(key);
  if(st.state!=='idle'){toast(st.state==='building'?'建造中':st.state==='upgrading'?'升级中':'时代升级中');return}
  const currentTier=st.tier||0;
  if(currentTier>=4){toast('已达最高时代');return}
  const upg=cfg.tierUpgrade?.[currentTier];
  if(!upg){toast('无法继续升级');return}
  const cost=upg.cost;
  const time=Math.min(upg.time||30,CFG.maxUpgradeTime||120);
  if(S.res.wood<cost.wood||S.res.stone<cost.stone||S.res.food<cost.food){toast('资源不足');return}
  S.res.wood-=cost.wood;S.res.stone-=cost.stone;S.res.food-=cost.food;
  if(!S.buildings[key])S.buildings[key]={lv:0,state:'idle',timer:0,timerEnd:0,tier:(CFG.buildings[key]?.tier||0)};
  S.buildings[key].state='tier_upgrading';
  S.buildings[key].timerEnd=time;
  S.buildings[key].timer=time;
  addLog(`开始升级${cfg.name}至T${currentTier+1}`);
  save();updateUI();
}
function upgradeTown(){
  if(!townCanUpgrade()){const bid=townUpgradeNeedBossId();const be=CFG.enemies.find(e=>e.id===bid);toast(`需击败第${bid}关Boss「${be?.name||'?'}」才能升级城镇`);return}
  if(popAllocTotal()>CFG.town.find(t=>t.lv===S.townLv+1).maxPop){toast('请先减少村民分配');return}
  const bt=CFG.buildingTimes;
  const rawTime=bt.cap1Base+(S.townLv-1)*bt.cap1PerLv;
  const time=Math.min(rawTime, CFG.maxUpgradeTime||120);
  S.townUpgrade={timer:time,timerEnd:time};
  addLog(`开始升级城镇，预计${time}秒`);
  save();updateUI();
}
function setPopAlloc(rk,v){
  const nv=Math.max(0,Math.min(Math.floor(v),999));
  const old=S.popAlloc[rk]||0;
  const diff=nv-old;
  if(diff>0&&popFree()<diff){toast(`空闲村民不足，最多${popAllocTotal()+popFree()}`);return}
  S.popAlloc[rk]=nv;
  save();updateUI();
}
function upCost(key){
  const cfg=CFG.buildings[key],lv=bldSt(key).lv||1;
  const b=cfg.upBase;
  // 仓库：升级消耗 = 当前等级 × upBase（线性）
  const m=cfg.storagePerLv?lv:Math.pow(cfg.upCostLv,lv);
  // 升级时间线性增长，不受 upCostLv 倍率影响，参数见 CFG.buildingTimes
  const isCap1=cfg.buffRes||(!cfg.trains&&!cfg.storagePerLv&&!cfg.buffRes);
  const bt=CFG.buildingTimes;
  const rawTime=isCap1?bt.cap1Base+lv*bt.cap1PerLv:bt.otherBase+lv*bt.otherPerLv;
  const time=Math.min(rawTime, CFG.maxUpgradeTime||120);
  return{wood:Math.ceil(b.wood*m),stone:Math.ceil(b.stone*m),food:Math.ceil(b.food*m),time};
}
function maxTrainable(uk){
  if(trainLockReason(uk))return 0;
  return Math.max(0, queueMax(uk) - queueTotal(uk));
}
function train(uk,qty){
  qty=qty||1;
  qty=Math.max(1,Math.floor(qty));
  const lock=trainLockReason(uk);
  if(lock){toast(lock);return}
  const max=maxTrainable(uk);
  if(max<=0){toast('训练队列已满');return}
  if(qty>max){qty=max;toast('已按队列上限训练'+qty);}
  if(!S.queue[uk])S.queue[uk]={count:0,timer:0};
  S.queue[uk].count+=qty;
  if(S.queue[uk].timer<=0)S.queue[uk].timer=CFG.units[uk].trainTime||1;
  addLog('排队训练'+CFG.units[uk].name+'+'+qty+' (队列'+queueTotal(uk)+'/'+queueMax(uk)+')');
  save();updateUI();
}
function trainCustom(uk,inputId){
  const el=document.getElementById(inputId);
  const qty=Math.max(1,Math.floor(parseInt(el?.value,10)||1));
  train(uk,qty);
}
function adjTrainInput(uk,d){
  const el=document.getElementById('train-barracks-'+uk);
  if(!el)return;
  let v=(parseInt(el.value)||1)+d;
  if(v<1)v=1;
  if(d>0){const tm=maxTrainable(uk);if(v>tm)v=tm;}
  el.value=v;
}
function trainMax(uk,inputId){
  const qty=maxTrainable(uk);
  if(qty<=0){
    const lock=trainLockReason(uk);
    toast(lock||'训练队列已满');
    return;
  }
  const el=document.getElementById(inputId);
  if(el)el.value=qty;
  train(uk,qty);
}
function dismissN(uk,n){
  let qty=Math.floor(n)||1;
  const q=S.queue[uk];
  if(q&&q.count>0){
    const fromQ=Math.min(q.count,qty);
    q.count-=fromQ;qty-=fromQ;
    addLog(`取消训练${CFG.units[uk].name}-${fromQ} (队列${q.count}人)`);
    if(q.count<=0){q.count=0;q.timer=0;q.reason='';}
  }
  if(qty<=0){save();updateUI();return;}
  const a=poolAvail(uk);
  if(a<=0){toast('无可用士兵');return}
  const fromP=Math.min(a,qty);
  S.pool[uk]-=fromP;
  const cost=CFG.units[uk].cost,cap=storageCapacity();
  const refund={wood:Math.floor(cost.wood*fromP*0.5),stone:Math.floor(cost.stone*fromP*0.5),food:Math.floor(cost.food*fromP*0.5)};
  S.res.wood=Math.min((S.res.wood||0)+refund.wood,cap);
  S.res.stone=Math.min((S.res.stone||0)+refund.stone,cap);
  S.res.food=Math.min((S.res.food||0)+refund.food,cap);
  addLog(`解散${CFG.units[uk].name}-${fromP}，返还木${refund.wood}石${refund.stone}食${refund.food}`);save();updateUI();
}
function cancelQueue(uk){
  const q=S.queue[uk];
  if(!q||q.count<=0){toast('队列为空');return}
  dismissN(uk, q.count);
}
function addRes(rk,inputId){
  const el=document.getElementById(inputId);
  const n=Math.max(1,Math.floor(parseInt(el?.value,10)||0));
  const cap=storageCapacity();
  S.res[rk]=Math.min((S.res[rk]||0)+n,cap);
  addLog(`手动添加${CFG.res[rk].name}+${n}`);
  save();updateUI();
}
function addAllRes(inputId){
  const el=document.getElementById(inputId);
  const n=Math.max(1,Math.floor(parseInt(el?.value,10)||0));
  const cap=storageCapacity();
  for(const rk of['wood','stone','food','tech']){
    S.res[rk]=Math.min((S.res[rk]||0)+n,rk==='tech'?999999:cap);
  }
  addLog(`一键添加木/石/食/科技点各+${n}`);
  save();updateUI();
}
function addMerit(inputId){
  const el=document.getElementById(inputId);
  const n=Math.max(1,Math.floor(parseInt(el?.value,10)||0));
  S.merit=(S.merit||0)+n;
  addLog(`战功 +${n}`);
  save();updateUI();
}

// 激活码校验：输入1122解锁测试工具
function checkActivationCode(inputId){
  const el=document.getElementById(inputId);
  if(!el)return;
  if(el.value.trim()==='1122'){
    S._testUnlocked=true;
    toast('测试工具已解锁');
    updateUI();
  }else{
    toast('激活码错误');
  }
}

// ==================== 编队弹窗 ====================
let formModalTarget=null; // {which:'expedition'|'garrison', row, idx}

function openFormModal(which,row,idx){
  formModalTarget={which,row,idx};
  const form=getForm(which);
  const content=document.getElementById('form-modal-content');
  const rm=regMax();
  const label=which==='garrison'?'驻军':'远征';
  let h=`<h3>${pix('army','card-pix')} ${label}编入 — ${row==='front'?'前排':row==='mid'?'中排':'后排'} (上限 ${rm}人/团)</h3>`;
  h+='<div style="max-height:300px;overflow-y:auto">';
  let hasAny=false;
  for(const[k,c] of Object.entries(CFG.units)){
    if(k==='mage'&&!mageOk())continue;
    const av=poolAvail(k);
    if(av<=0)continue;
    hasAny=true;
    const target=form[row][idx];
    const remaining=target&&target.type===k?Math.min(rm-target.count, av):Math.min(rm, av);
    if(remaining<=0)continue;
    h+=`<div class="modal-unit" data-type="${k}" data-avail="${remaining}" onclick="selModalUnit(this,'${k}',${remaining})">
      <span class="mu-icon">${pix(c.icon,'lg')}</span>
      <div class="mu-info"><div class="mu-name">${c.name}</div>
      <div class="mu-detail">可编入:${av}人 | 上限 ${rm}人/团 | ${c.passive}</div></div>
    </div>`;
  }
  if(!hasAny)h+='<div style="text-align:center;color:#666;padding:20px">余量无可用士兵，请先训练</div>';
  h+='</div>';
  h+=`<div id="modal-qty-area" style="display:none"><div class="modal-qty">
    <button onpointerdown="startModalLongPress(-1)" onpointerup="stopModalLongPress()" onpointerleave="stopModalLongPress()" onpointercancel="stopModalLongPress()" onclick="event.preventDefault()">-</button>
    <input type="text" inputmode="numeric" pattern="[0-9]*" id="modal-qty-input" value="1" onchange="clampQty()" oninput="clampQty()">
    <button onpointerdown="startModalLongPress(1)" onpointerup="stopModalLongPress()" onpointerleave="stopModalLongPress()" onpointercancel="stopModalLongPress()" onclick="event.preventDefault()">+</button>
  </div>
  <div class="modal-quick">
    <button class="btn btn-ghost btn-xs" onclick="setModalQty(S._formModalMax)">MAX</button>
  </div>
  <div style="text-align:center;margin-top:6px;font-size:10px;color:#888">部队人数 (HP)</div>
  <button class="btn btn-go" style="width:100%;margin-top:8px" onclick="confirmForm()">${pix('check','mini')}确认编入</button></div>`;
  content.innerHTML=h;
  document.getElementById('form-modal').classList.add('active');
  S._formModalSel=null;S._formModalQty=1;
}

function selModalUnit(el,type,avail){
  document.querySelectorAll('.modal-unit').forEach(e=>e.classList.remove('sel'));
  el.classList.add('sel');
  S._formModalSel=type;
  S._formModalMax=avail;
  S._formModalQty=Math.min(avail, Math.max(1, Math.floor(avail/2))); // 默认填一半
  const qa=document.getElementById('modal-qty-area');
  qa.style.display='block';
  const inp=document.getElementById('modal-qty-input');
  inp.value=S._formModalQty;
  inp.max=avail;
}

function adjQty(d){
  if(!S._formModalSel)return;
  S._formModalQty=Math.max(1,Math.min(S._formModalMax,S._formModalQty+d));
  document.getElementById('modal-qty-input').value=S._formModalQty;
}
function setModalQty(qty){
  if(!S._formModalSel)return;
  S._formModalQty=Math.max(1,Math.min(S._formModalMax,Math.floor(qty)||1));
  document.getElementById('modal-qty-input').value=S._formModalQty;
}
function clampQty(){
  const v=parseInt(document.getElementById('modal-qty-input').value)||1;
  S._formModalQty=Math.max(1,Math.min(S._formModalMax,v));
  document.getElementById('modal-qty-input').value=S._formModalQty;
}

function confirmForm(){
  if(!S._formModalSel||!formModalTarget)return;
  const type=S._formModalSel,row=formModalTarget.row,idx=formModalTarget.idx;
  const which=formModalTarget.which||'expedition';
  const form=getForm(which);
  const qty=S._formModalQty;
  if(qty<=0){toast('人数无效');return}
  if(poolAvail(type)<qty){toast('余量不足');return}
  const target=form[row][idx];
  if(target&&target.type===type){
    if(target.count+qty>regMax()){toast(`超过上限${regMax()}人/团`);return}
    target.count+=qty;
  } else {
    const curCnt=form.front.length+form.mid.length+form.back.length;
    if(curCnt>=formSlots()){toast('阵容已满');return}
    if(qty>regMax()){toast(`超过上限${regMax()}人/团`);return}
    form[row].push({type,count:qty,id:Date.now()+Math.random()});
  }
  S.pool[type]-=qty;
  closeFormModal();
  updateUI();
}

function closeFormModal(){
  document.getElementById('form-modal').classList.remove('active');
  formModalTarget=null;S._formModalSel=null;
}

// 点击弹窗外部关闭
document.getElementById('form-modal').addEventListener('click',function(e){
  if(e.target===this) closeFormModal();
});

// ==================== 单位详情弹窗 ====================
function openUnitDetail(uk){
  const c=CFG.units[uk];
  if(!c)return;
  const rowLabel={front:'前排',mid:'中排',back:'后排'}[c.row]||c.row;
  const st=trainBuildingState(uk);
  const bldName=st?CFG.buildings[trainBuildingKey(uk)].name:'';
  let h=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span>${pix(c.icon,'lg')}</span><div><div style="font-size:15px;font-weight:bold;color:#e0e0e0">${c.name}</div><div style="font-size:10px;color:#888">${c.race} | ${rowLabel}</div></div></div>`;
  h+=`<div style="background:#121224;border:2px solid #2b3144;border-radius:6px;padding:10px 12px;margin-bottom:8px">`;
  h+=`<div style="font-size:11px;color:#f0d060;margin-bottom:8px;text-align:center;letter-spacing:2px">◆ 属性 ◆</div>`;
  h+=`<div style="font-size:12px;line-height:2.2">`;
  h+=`<div><span style="color:#888">攻击力</span><span style="color:#f0d060;float:right">${c.atk} <span style="color:#888;font-size:10px">→ ${Math.max(1,c.atk-3)}~${c.atk+3}</span></span></div>`;
  h+=`<div><span style="color:#888">防御力</span> <span style="color:#f0d060;float:right">${c.def}</span></div>`;
  h+=`<div><span style="color:#888">速度</span> <span style="color:#f0d060;float:right">${c.spd}</span></div>`;
  h+=`<div style="margin-top:4px;padding-top:4px;border-top:1px solid #2b3144"><span style="color:#888">训练费</span> <span style="color:#f0d060;float:right">${costHtml(c.cost)}</span></div>`;
  h+=`<div><span style="color:#888">维护费</span> <span style="color:#f0d060;float:right">${c.upkeep||0}食物/秒</span></div>`;
  h+=`<div><span style="color:#888">训练时间</span> <span style="color:#f0d060;float:right">${c.trainTime||1}秒/人</span></div>`;
  h+=`<div style="margin-top:4px;padding-top:4px;border-top:1px solid #2b3144"><span style="color:#888">训练建筑</span> <span style="color:#aaa;float:right">${bldName||'无'}</span></div>`;
  const pool=S.pool[uk]||0;
  const qNow=queueTotal(uk);
  h+=`<div><span style="color:#888">拥有</span> <span style="color:#f0d060;float:right">${pool}人${qNow>0?' | 队列'+qNow+'人':''}</span></div>`;
  h+=`</div></div>`;
  h+=`<div style="background:#1a2220;border:1px solid #2b443b;border-radius:6px;padding:8px 12px;margin-bottom:8px">`;
  h+=`<span style="font-size:11px;color:#888">被动: </span><span style="font-size:12px;color:#40bf80">${c.passive}</span></div>`;
  h+=`<button class="btn btn-ghost btn-sm" style="width:100%" onclick="closeUnitDetail()">关闭</button>`;
  document.getElementById('unit-detail-content').innerHTML=h;
  document.getElementById('unit-detail-modal').classList.add('active');
}
function closeUnitDetail(){
  document.getElementById('unit-detail-modal').classList.remove('active');
}
document.getElementById('unit-detail-modal').addEventListener('click',function(e){
  if(e.target===this) closeUnitDetail();
});

// 从阵容移除兵团
function rmForm(which,row,idx){
  const form=getForm(which);
  const u=form[row][idx];
  if(!u)return;
  S.pool[u.type]=(S.pool[u.type]||0)+u.count;
  form[row].splice(idx,1);
  updateUI();
}
// 调整兵团人数
function adjForm(which,row,idx,d){
  const form=getForm(which);
  const u=form[row][idx];
  if(!u)return;
  const nv=u.count+d;
  if(d>0 && nv>regMax()){toast(`上限${regMax()}人/团`);return}
  if(d>0 && poolAvail(u.type)<d){toast('余量不足');return}
  if(nv<=0){S.pool[u.type]=(S.pool[u.type]||0)+u.count;form[row].splice(idx,1);updateUI();return}
  if(d>0){S.pool[u.type]-=d;}
  else if(d<0){S.pool[u.type]=(S.pool[u.type]||0)+(-d);}
  u.count=nv;
  updateUI();
}
function clrForm(which){
  const form=getForm(which);
  for(const row of['front','mid','back']){for(const u of form[row]){S.pool[u.type]=(S.pool[u.type]||0)+u.count}}
  if(which==='garrison'){S._garrisonForm={front:[],mid:[],back:[]}}
  else{S.formation={front:[],mid:[],back:[]}}
  updateUI();
}
function removeFormSlot(which,row,idx){
  const form=getForm(which);
  const u=form[row][idx];
  if(!u)return;
  S.pool[u.type]=(S.pool[u.type]||0)+u.count;
  form[row].splice(idx,1);
  updateUI();
}
function fillFormMax(which,row,idx){
  const form=getForm(which);
  const u=form[row][idx];
  if(!u)return;
  const avail=poolAvail(u.type);
  const cap=regMax();
  const add=Math.min(avail, cap-u.count);
  if(add<=0){toast('已满或余量不足');return}
  u.count+=add;
  S.pool[u.type]-=add;
  updateUI();
}
function useLastFormation(which){
  const form=getForm(which);
  const lastKey=which==='garrison'?'_lastGarrisonForm':'_lastForm';
  if(!S[lastKey]){toast('没有上次阵容记录');return}
  const last=S[lastKey];
  const hasAny=last.front.length+last.mid.length+last.back.length>0;
  if(!hasAny){toast('上次阵容为空');return}
  for(const row of['front','mid','back']){
    for(const u of form[row]){S.pool[u.type]=(S.pool[u.type]||0)+u.count;}
  }
  const newForm={front:[],mid:[],back:[]};
  let shortage=false;
  for(const row of['front','mid','back']){
    for(const u of last[row]){
      if(newForm[row].length>=rowSlots(row)){shortage=true;break;}
      const avail=poolAvail(u.type);
      if(avail<=0){shortage=true;continue;}
      const count=Math.min(u.count, avail, regMax());
      if(count<u.count)shortage=true;
      S.pool[u.type]-=count;
      newForm[row].push({type:u.type,count,id:Date.now()+Math.random()});
    }
  }
  if(which==='garrison'){S._garrisonForm=newForm}
  else{S.formation=newForm}
  if(shortage)toast('驻军不足，已按可用人数填充');
  save();updateUI();
}

// ==================== 战斗系统 ====================
let battleTimer=null;
let B={};

function selEnemy(idx){
  S.selEnemy=idx;updateUI();
}

function openTraining(){
  if(formCnt()===0){toast('请先配置阵容');return}
  S.battleActive=true; B.isTraining=true;
  document.getElementById('battle-screen').classList.add('active');
  document.getElementById('navbar').classList.add('paused');
  document.getElementById('topbar').classList.add('paused');
  document.getElementById('main').classList.add('paused');
  document.getElementById('battle-result').style.display='none';
  document.getElementById('battle-msg').innerHTML='';
  initBattleState();
  drawBattleField();
  bmsg('训练开始！训练场×9 各100HP','#f0d060');
  battleTimer=setTimeout(battleTurn, 600/S.battleSpeed);
}

function openBattle(){
  if(S.selEnemy===null||S.selEnemy===undefined){toast('请先选择关卡');return}
  if(formCnt()===0){toast('请先配置阵容');return}
  S.battleActive=true; B.isTraining=false;
  document.getElementById('battle-screen').classList.add('active');
  document.getElementById('navbar').classList.add('paused');
  document.getElementById('topbar').classList.add('paused');
  document.getElementById('main').classList.add('paused');
  document.getElementById('battle-result').style.display='none';
  document.getElementById('battle-msg').innerHTML='';
  initBattleState();
  drawBattleField();
  bmsg('战斗开始！','#f0d060');
  battleTimer=setTimeout(battleTurn, 600/S.battleSpeed);
}

function fleeBattle(){
  if(battleTimer)clearTimeout(battleTimer);
  S.battleActive=false;
  document.getElementById('battle-screen').classList.remove('active');
  document.getElementById('navbar').classList.remove('paused');
  document.getElementById('topbar').classList.remove('paused');
  document.getElementById('main').classList.remove('paused');
  document.getElementById('battle-result').style.display='none';
  S.formation=S._preForm;
  if(B.isTraining){B.isTraining=false;addLog('退出训练');}
  else addLog('逃离战斗');
  save(); updateUI();
}

function shiftRows(){
  const hasAlive=r=>B.ourUnits.some(u=>u.alive!==false&&u.row===r);
  if(!hasAlive('front')){
    for(const u of B.ourUnits){
      if(u.alive===false)continue;
      if(u.row==='mid')u.row='front';
      else if(u.row==='back')u.row='mid';
    }
  }
  if(!hasAlive('mid')){
    for(const u of B.ourUnits){
      if(u.alive===false)continue;
      if(u.row==='back')u.row='mid';
    }
  }
}

function initBattleState(){
  if(B.isTraining){
    S._preForm=JSON.parse(JSON.stringify(S.formation));
    S._lastForm=JSON.parse(JSON.stringify(S.formation));
    B.tactic=CFG.tactics.steady; B.enemyCfg={name:'训练场',boss:false};
    B.round=0; B.maxRound=99; B.winner=null; B.msgs=[];
    B.ourUnits=[]; B.enemyUnits=[]; B.trainingStats={}; B.dummyDmg=[];
    let uid=0;
    for(const row of['front','mid','back']){
      for(const u of S.formation[row]){
        const cfg=CFG.units[u.type];
        B.ourUnits.push({id:uid++, fid:u.id, type:u.type, row, hp:u.count, maxHp:u.count,
          icon:cfg.icon, name:cfg.name, spd:cfg.spd, atk:cfg.atk, def:cfg.def, tag:cfg.tag||null});
      }
    }
    const rows=['front','mid','back'];
    for(let i=0;i<9;i++){
      const rowIdx=Math.floor(i/3);
      B.enemyUnits.push({id:uid++, type:'dummy', name:'训练场', row:rows[rowIdx],
        hp:100, maxHp:100, icon:'dummy', spd:0, atk:0, def:1, alive:true, dummyIdx:i});
      B.dummyDmg.push(0);
    }
  }else{
    const e=CFG.enemies[S.selEnemy];
    const tkey='steady';
    S._preForm=JSON.parse(JSON.stringify(S.formation));
    S._lastForm=JSON.parse(JSON.stringify(S.formation));
    B.tactic=CFG.tactics[tkey]; B.enemyCfg=e;
    B.round=0; B.maxRound=25+(e.boss?5:0); B.winner=null; B.msgs=[];
    B.ourUnits=[]; B.enemyUnits=[];
    let uid=0;
    for(const row of['front','mid','back']){
      for(const u of S.formation[row]){
        const cfg=CFG.units[u.type];
        B.ourUnits.push({id:uid++, fid:u.id, type:u.type, row, hp:u.count, maxHp:u.count,
          icon:cfg.icon, name:cfg.name, spd:cfg.spd, atk:cfg.atk, def:cfg.def, tag:cfg.tag||null});
      }
    }
    for(const[k,counts] of Object.entries(e.units)){
      for(let i=0;i<counts.length;i++){
        const cfg=CFG.units[k];
        const bm=e.boss?e.bossMult:null;
        B.enemyUnits.push({id:uid++, type:k, row:cfg.row, hp:counts[i], maxHp:counts[i],
          icon:cfg.icon, name:cfg.name,
          spd:cfg.spd,
          atk:bm?Math.floor(cfg.atk*bm.atk):cfg.atk,
          def:bm?Math.floor(cfg.def*bm.def):cfg.def,
          tag:cfg.tag||null});
      }
    }
  }
  shiftRows();
}

function drawBattleField(){
  const f=document.getElementById('battle-field');
  const oa=B.ourUnits.filter(u=>u.alive!==false).length;
  const ea=B.enemyUnits.filter(u=>u.alive!==false).length;
  const ohp=B.ourUnits.filter(u=>u.alive!==false).reduce((s,u)=>s+u.hp,0);
  const ehp=B.enemyUnits.filter(u=>u.alive!==false).reduce((s,u)=>s+u.hp,0);
  document.getElementById('battle-title').innerHTML=`${pix('battle','sm')} ${B.enemyCfg.name} | 回合${B.round} | 我方${oa}团${ohp}人 vs ${B.isTraining?'训练场':'敌方'}${ea}个${B.isTraining?'':'团'+ehp+'人'}`;

  let h='';
  if(B.isTraining){
    h+=`<div class="enemy-zone dummy-zone"><div class="zone-label">${pix('dummy','sm')} 训练场</div>`;
    for(const row of['back','mid','front']){
      const units=B.enemyUnits.filter(u=>u.alive!==false&&u.row===row);
      if(!units.length)continue;
      h+=`<div class="battle-row"><div class="row-label">${row==='front'?'前排':row==='mid'?'中排':'后排'}</div>`;
      for(const u of units){
        h+=`<div class="unit-box dummy-box" id="eu-${u.id}">
          <span class="ub-icon">${pix(u.icon,'lg')}</span><span class="ub-name">${u.name}</span>
          <span class="ub-hp">${u.hp}</span>
          ${u.dummyIdx!==undefined?`<div class="dummy-dmg">受伤:${B.dummyDmg[u.dummyIdx]||0}</div>`:''}</div>`;
      }
      h+='</div>';
    }
    h+=`</div><div style="text-align:center;font-size:10px;color:#3a4158;padding:2px">${pix('battle','sm')} VS ${pix('battle','sm')}</div>`;
  }else{
    h+=`<div class="enemy-zone"><div class="zone-label">${pix(B.enemyCfg.boss?'boss':'enemy','sm')} 敌方</div>`;
    for(const row of['back','mid','front']){
      const units=B.enemyUnits.filter(u=>u.alive!==false&&u.row===row);
      if(!units.length)continue;
      h+=`<div class="battle-row"><div class="row-label">${row==='front'?'前排':row==='mid'?'中排':'后排'}</div>`;
      for(const u of units){
        h+=`<div class="unit-box" id="eu-${u.id}">
          <span class="ub-icon">${pix(u.icon,'lg')}</span><span class="ub-name">${u.name}</span>
          <span class="ub-hp">${u.hp}</span></div>`;
      }
      h+='</div>';
    }
    h+=`</div><div style="text-align:center;font-size:10px;color:#3a4158;padding:2px">${pix('battle','sm')} VS ${pix('battle','sm')}</div>`;
  }

  // 我方
  h+=`<div class="our-zone"><div class="zone-label">${pix('army','sm')} 我方</div>`;
  for(const row of['front','mid','back']){
    const units=B.ourUnits.filter(u=>u.alive!==false&&u.row===row);
    if(!units.length)continue;
    h+=`<div class="battle-row"><div class="row-label">${row==='front'?'前排':row==='mid'?'中排':'后排'}</div>`;
    for(const u of units){
      h+=`<div class="unit-box" id="ou-${u.id}">
        <span class="ub-icon">${pix(u.icon,'lg')}</span><span class="ub-name">${u.name}</span>
        <span class="ub-hp">${u.hp}</span></div>`;
    }
    h+='</div>';
  }
  h+='</div>';
  f.innerHTML=h;
}

function bmsg(m,c=''){
  B.msgs.push({m,c});
  const el=document.getElementById('battle-msg');
  el.innerHTML=B.msgs.slice(-25).map(e=>`<span style="color:${e.c||'#666'}">${e.m}</span>`).join('<br>');
  el.scrollTop=el.scrollHeight;
}

// 兵种攻击类型：melee 只能在前排攻击，ranged 任意排都可攻击
function isRanged(unitType){
  const bu=baseUnitType(unitType);
  return bu==='archer'||bu==='mage';
}

function getTarget(attacker,enemyList){
  const alive=enemyList.filter(u=>u.alive!==false);
  if(!alive.length)return null;
  const rows={front:0,mid:1,back:2};
  const minR=Math.min(...alive.map(u=>rows[u.row]));
  const front=alive.filter(u=>rows[u.row]===minR);

  if(!isRanged(attacker.type) && attacker.row!=='front') return null;

  if(isRanged(attacker.type)){
    // 远程：60%命中前排（被前线阻挡）
    if(front.length>0 && Math.random()<0.6){
      return front[Math.floor(Math.random()*front.length)];
    }
    return alive[Math.floor(Math.random()*alive.length)];
  }
  // 近战：只能打敌方最前排
  return front[Math.floor(Math.random()*front.length)];
}

// 计算伤害（杀多少兵）
// damage = hp * atk * DAMAGE_COEF * defenseFactor * counterFactor * mageFactor * passiveFactor * randomFactor
const DAMAGE_COEF = 0.09;
function calcDmg(attacker,defender,isOur){
  // 攻击力（含战术加成）
  let atk=attacker.atk;
  if(isOur){
    if(B.tactic.atkPct) atk=Math.floor(atk*(1+B.tactic.atkPct));
    if(attacker.row==='back'&&B.tactic.backPct) atk=Math.floor(atk*(1+B.tactic.backPct));
  }
  // 防御力（我方被攻击时享受战术防御加成）
  let def=defender.def;
  if(!isOur&&B.tactic.defPct) def=Math.floor(def*(1+B.tactic.defPct));
  // 因子拆解
  const defenseFactor=100/(100+def*8);
  const counterFactor=cm(attacker.type,defender.type);
  const mageFactor=mm(attacker.type,defender.type);
  const passiveFactor=baseUnitType(attacker.type)==='infantry'?1.1:1.0;
  const randomFactor=0.9+Math.random()*0.2;
  // 暴击（长矛兵10%）
  const isCrit=(attacker.tag==='spear')&&Math.random()<0.1;
  let specialFactor=1.0;
  const AS=CFG.archerSpecials||{};
  // 弩攻击盾兵：穿透80%伤害
  if(attacker.tag==='crossbow'&&defender.tag==='shield') specialFactor*=AS.crossbow?.attack?.vsShield?.dmgPct||0.8;
  // 刃攻击远程：+60%伤害
  if(attacker.tag==='blade'&&isRanged(defender.type)) specialFactor*=AS.blade?.attack?.vsRanged?.dmgPct||1.6;
  // 刃攻击盾兵：60%伤害
  if(attacker.tag==='blade'&&defender.tag==='shield') specialFactor*=AS.blade?.attack?.vsShield?.dmgPct||0.6;
  // 弓攻击盾兵：80%被格挡无伤
  if(attacker.tag==='bow'&&defender.tag==='shield'&&Math.random()<(AS.bow?.attack?.vsShield?.block||0.8)){
    specialFactor=0;
  }
  const raw=attacker.hp*atk*DAMAGE_COEF*defenseFactor*counterFactor*mageFactor*passiveFactor*randomFactor*specialFactor;
  const baseDmg=Math.max(specialFactor>0?1:0,Math.floor(isCrit?raw*2:raw));
  const dmgVar=Math.floor(Math.random()*7)-3;
  return {dmg:Math.max(specialFactor>0?1:0, baseDmg+dmgVar), crit:isCrit};
}

function spawnVFX(actorEl,targetEl,type){
  const layer=document.getElementById('battle-vfx-layer');
  if(!layer||!actorEl||!targetEl)return;
  const lRect=layer.getBoundingClientRect();
  const aRect=actorEl.getBoundingClientRect();
  const tRect=targetEl.getBoundingClientRect();
  const ax=aRect.left+aRect.width/2-lRect.left;
  const ay=aRect.top+aRect.height/2-lRect.top;
  const dx=tRect.left+tRect.width/2-(aRect.left+aRect.width/2);
  const dy=tRect.top+tRect.height/2-(aRect.top+aRect.height/2);
  const angle=Math.atan2(dy,dx)*180/Math.PI;
  const dist=Math.sqrt(dx*dx+dy*dy);
  const dur=Math.max(0.22, dist/400);
  const el=document.createElement('div');
  const vfxMap={infantry:'swordqi',archer:'arrow',spearman:'thrust',cavalry:'cavslash',mage:'magebolt'};
  const vfxType=vfxMap[baseUnitType(type)]||vfxMap[type]||'swordqi';
  const isSwordQi=vfxType==='swordqi';
  const isArcStrike=vfxType==='cavslash';
  const isImageShot=vfxType==='arrow'||vfxType==='thrust'||vfxType==='magebolt';
  const swordW=isSwordQi?Math.max(82,Math.min(132,dist*0.68)):0;
  const swordH=isSwordQi?swordW*813/867:0;
  const arcW=isArcStrike?Math.max(98,Math.min(152,dist*0.74)):0;
  const arcH=isArcStrike?arcW*806/868:0;
  const shotMin=vfxType==='arrow'?74:vfxType==='thrust'?86:78;
  const shotMax=vfxType==='arrow'?132:vfxType==='thrust'?150:138;
  const shotW=isImageShot?Math.max(shotMin,Math.min(shotMax,dist*0.78)):0;
  const shotH=isImageShot?shotW*(vfxType==='arrow'?511/1016:vfxType==='thrust'?451/1146:497/945):0;
  const originX=isSwordQi?swordW*0.18:isArcStrike?arcW*0.76:isImageShot?shotW*0.9:0;
  const originY=isSwordQi?swordH*0.9:isArcStrike?arcH*0.58:isImageShot?shotH*0.5:0;
  el.className=`vfx vfx-${vfxType}`;
  if(isSwordQi||isArcStrike||isImageShot){
    el.style.width=(isSwordQi?swordW:isArcStrike?arcW:shotW)+'px';
    el.style.height=(isSwordQi?swordH:isArcStrike?arcH:shotH)+'px';
    el.style.left=(ax-originX)+'px';
    el.style.top=(ay-originY)+'px';
    el.style.transformOrigin=`${originX}px ${originY}px`;
  }else{
    el.style.left=ax+'px';
    el.style.top=ay+'px';
  }
  layer.appendChild(el);
  const rotateOffset=isSwordQi?72:isArcStrike?180:90;
  const frames=isSwordQi?[
    { transform:`rotate(${angle+rotateOffset}deg) scale(.55)`, opacity:0, filter:'brightness(1.45) drop-shadow(0 0 8px rgba(180,220,255,.95))', offset:0 },
    { transform:`rotate(${angle+rotateOffset}deg) scale(1.08)`, opacity:1, filter:'brightness(1.25) drop-shadow(0 0 16px rgba(210,235,255,.9))', offset:.28 },
    { transform:`rotate(${angle+rotateOffset}deg) scale(.96)`, opacity:.12, filter:'brightness(1) drop-shadow(0 0 4px rgba(120,170,255,.45))', offset:1 }
  ]:isArcStrike?[
    { transform:`rotate(${angle+rotateOffset}deg) scale(.55)`, opacity:0, filter:'brightness(1.4) drop-shadow(0 0 10px rgba(110,190,255,.95))', offset:0 },
    { transform:`rotate(${angle+rotateOffset}deg) scale(1.08)`, opacity:1, filter:'brightness(1.22) drop-shadow(0 0 18px rgba(255,215,90,.9))', offset:.3 },
    { transform:`rotate(${angle+rotateOffset}deg) scale(.98)`, opacity:.12, filter:'brightness(1) drop-shadow(0 0 5px rgba(110,190,255,.4))', offset:1 }
  ]:isImageShot?[
    { transform:`translate(0,0) rotate(${angle}deg) scale(.75)`, opacity:0, filter:`brightness(1.35) drop-shadow(0 0 8px ${vfxType==='magebolt'?'rgba(135,110,255,.9)':'rgba(255,205,95,.85)'})`, offset:0 },
    { transform:`translate(${dx*0.75}px,${dy*0.75}px) rotate(${angle}deg) scale(1)`, opacity:1, filter:`brightness(1.18) drop-shadow(0 0 12px ${vfxType==='magebolt'?'rgba(135,110,255,.85)':'rgba(255,205,95,.75)'})`, offset:.7 },
    { transform:`translate(${dx}px,${dy}px) rotate(${angle}deg) scale(.92)`, opacity:.2, filter:`brightness(1) drop-shadow(0 0 4px ${vfxType==='magebolt'?'rgba(135,110,255,.4)':'rgba(255,205,95,.35)'})`, offset:1 }
  ]:[
    { transform:`rotate(${angle+rotateOffset}deg)`, offset:0 },
    { transform:`translate(${dx}px,${dy}px) rotate(${angle+rotateOffset}deg)`, offset:1 }
  ];
  el.animate(frames,{duration:dur*1000,easing:(isSwordQi||isArcStrike||isImageShot)?'cubic-bezier(.16,.84,.32,1)':'ease-out',fill:'forwards'});
  setTimeout(()=>el.remove(), dur*1000+200);
}

function battleTurn(){
  if(!S.battleActive)return;
  B.round++;
  shiftRows();
  if(B.round>B.maxRound){endBattle('timeout');return}

  const ourAlive=[], enemyAlive=[];
  for(const u of B.ourUnits) if(u.alive!==false) ourAlive.push(u);
  for(const u of B.enemyUnits) if(u.alive!==false&&u.type!=='dummy') enemyAlive.push(u);

  if(ourAlive.length===0){endBattle('lose');return}

  const ourSpd=u=>Math.floor(u.spd*(1+(B.tactic.spdPct||0)));
  const sortFn=(a,b,sf)=>sf(b)-sf(a)||(Math.random()<0.5?1:-1);
  ourAlive.sort((a,b)=>sortFn(a,b,ourSpd));
  enemyAlive.sort((a,b)=>sortFn(a,b,u=>u.spd));

  const isBossFight=B.enemyCfg&&B.enemyCfg.boss&&enemyAlive.length===1;

  const actions=[];
  if(enemyAlive.length===0){
    // 训练场：只有我方攻击，敌方木人桩不还手
    for(const u of ourAlive) actions.push({unit:u,side:'our'});
  } else if(isBossFight){
    for(const u of ourAlive) actions.push({unit:u,side:'our'});
    actions.push({unit:enemyAlive[0],side:'enemy'});
  } else {
    const maxCnt=Math.max(ourAlive.length,enemyAlive.length);
    const ourFast=ourSpd(ourAlive[0]), enemyFast=enemyAlive[0].spd;
    const ourFirst=ourFast>enemyFast?true:enemyFast>ourFast?false:Math.random()<0.5;
    for(let i=0;i<maxCnt;i++){
      if(ourFirst){
        actions.push({unit:ourAlive[i%ourAlive.length],side:'our'});
        actions.push({unit:enemyAlive[i%enemyAlive.length],side:'enemy'});
      } else {
        actions.push({unit:enemyAlive[i%enemyAlive.length],side:'enemy'});
        actions.push({unit:ourAlive[i%ourAlive.length],side:'our'});
      }
    }
  }

  let idx=0,delay=600/S.battleSpeed;

  function nextAction(){
    if(!S.battleActive)return;
    if(idx>=actions.length){
      drawBattleField();
      const oa=B.ourUnits.filter(u=>u.alive!==false).length;
      const ea=B.enemyUnits.filter(u=>u.alive!==false).length;
      if(oa===0){endBattle('lose');return}
      if(ea===0){endBattle('win');return}
      bmsg(`── 回合${B.round}结束 ──`,'#555');
      battleTimer=setTimeout(battleTurn,375/S.battleSpeed);
      return;
    }

    const {unit:actor,side}=actions[idx];
    if(actor.alive===false){idx++;nextAction();return}

    const enemyList=side==='our'?B.enemyUnits:B.ourUnits;
    const target=getTarget(actor,enemyList);
    if(!target){idx++;nextAction();return}

    const actorEl=document.getElementById((side==='our'?'ou-':'eu-')+actor.id);
    const targetEl=document.getElementById((side==='our'?'eu-':'ou-')+target.id);

    if(targetEl)targetEl.classList.add('targeted');
    if(actorEl)actorEl.classList.add('attacking');

    const archerMiss=isAttackMiss(actor,target);
    const cavDodge=!archerMiss&&baseUnitType(target.type)==='cavalry'&&!isRanged(actor.type)&&Math.random()<0.1;
    const missed=archerMiss||cavDodge;
    const cr=missed?{dmg:0,crit:false}:calcDmg(actor,target,side==='our');
    const dmg=cr.dmg; const isCrit=cr.crit;
    const cmv=cm(actor.type,target.type);
    const mmv=mm(actor.type,target.type);
    const actualKill=missed?0:Math.min(dmg,target.hp);

    if(!missed&&actorEl&&targetEl){
      spawnVFX(actorEl,targetEl,actor.type);
    }

    if(B.isTraining&&side==='our'){
      if(!B.trainingStats[actor.type])B.trainingStats[actor.type]={dmg:0,atks:0,crits:0,misses:0};
      const ts=B.trainingStats[actor.type];
      ts.atks++;
      if(missed){ts.misses++;}
      else{ts.dmg+=actualKill;if(isCrit)ts.crits++;}
      if(target.dummyIdx!==undefined)B.dummyDmg[target.dummyIdx]+=actualKill;
    }

    setTimeout(()=>{
      if(!S.battleActive)return;
      if(actorEl)actorEl.classList.remove('attacking');
      if(targetEl)targetEl.classList.remove('targeted');

      const isGood=cmv>=1.3,isBad=cmv<=0.7;

      if(missed){
        bmsg(`${side==="our"?"[我方]":"[敌方]"}${actor.name} → ${target.name} MISS${cavDodge?' [闪避]':baseUnitType(target.type)==='cavalry'?' [骑兵闪避]':''}`,'#6f7890');
        idx++;
        drawBattleField();
        nextAction();
        return;
      }

      target.hp-=actualKill;

      if(target.hp<=0){
        target.hp=0;target.alive=false;
        if(targetEl){targetEl.classList.add('dead');setTimeout(()=>{if(targetEl)targetEl.classList.add('dead-done')},500);}
        bmsg(`${side==="our"?"[我方]":"[敌方]"}${actor.name} → ${target.name} 击杀${actualKill}人，${target.name}全灭！`+(isGood?'[克制]':'')+(mmv>1?'[易伤]':''),isGood?'#40bf80':'#e06060');
      }else{
        if(targetEl){targetEl.classList.add('hit');setTimeout(()=>{if(targetEl)targetEl.classList.remove('hit')},400);}
        bmsg(`${side==="our"?"[我方]":"[敌方]"}${actor.name} → ${target.name} 击杀${actualKill}人，${target.name}剩余${target.hp}人`+(isBad?'[劣势]':''),'#888');
      }
      idx++;
      drawBattleField();
      nextAction();
    },delay);
  }
  nextAction();
}

// 从存活战斗单位重建阵容，并从军营自动补兵
function rebuildFormation(){
  const newForm={front:[],mid:[],back:[]};
  for(const u of B.ourUnits){
    if(u.alive===false||u.hp<=0)continue;
    for(const row of['front','mid','back']){
      for(const fu of S.formation[row]){
        if(fu.id===u.fid){
          newForm[row].push({type:fu.type,count:u.hp,id:fu.id});
          break;
        }
      }
    }
  }
  S.formation=newForm;
}

function showTrainingResult(){
  const resEl=document.getElementById('battle-result');
  const ts=B.trainingStats||{};
  let h=`<div style="font-size:14px;font-weight:bold;color:#e0c870;margin-bottom:8px">${pix('dummy','sm')} 训练结束 — 数据统计</div>`;
  h+=`<div style="font-size:10px;color:#888;margin-bottom:8px">回合${B.round} | 击破${B.enemyUnits.filter(u=>u.alive===false).length}/9个训练目标</div>`;
  let totalDmg=0,totalAtks=0;
  for(const[uk,t] of Object.entries(ts)){
    totalDmg+=t.dmg; totalAtks+=t.atks;
  }
  h+=`<div style="font-size:11px;color:#aaa;margin-bottom:6px">总伤害: <span style="color:#f0d060">${totalDmg}</span> | 总攻击: <span style="color:#f0d060">${totalAtks}</span></div>`;
  for(const[uk,t] of Object.entries(ts)){
    const cfg=CFG.units[uk]; if(!cfg)continue;
    const avg=t.atks>t.misses?(t.dmg/Math.max(1,t.atks-t.misses)).toFixed(1):'0';
    h+=`<div class="training-stat-row">
      <span class="ts-icon">${pix(cfg.icon,'sm')}</span>
      <div class="ts-info">
        <div class="ts-name">${cfg.name}</div>
        <div class="ts-num">伤害:${t.dmg} | 攻击:${t.atks}次 | 均伤:${avg} | 暴击:${t.crits||0} | MISS:${t.misses||0}</div>
      </div>
    </div>`;
  }
  h+=`<div class="result-btns" style="margin-top:8px">
    <button class="btn btn-go btn-sm" onclick="retryTraining()">重新测试</button>
    <button class="btn btn-ghost btn-sm" onclick="exitTraining()">退出训练</button>
  </div>`;
  resEl.className='win';
  resEl.innerHTML=h;
  resEl.style.display='flex';
}

function retryTraining(){
  document.getElementById('battle-result').style.display='none';
  document.getElementById('battle-msg').innerHTML='';
  S.battleActive=true; B.isTraining=true;
  initBattleState();
  drawBattleField();
  bmsg('重新测试开始！','#f0d060');
  battleTimer=setTimeout(battleTurn,600/S.battleSpeed);
}

function exitTraining(){
  if(battleTimer)clearTimeout(battleTimer);
  S.battleActive=false; B.isTraining=false;
  document.getElementById('battle-screen').classList.remove('active');
  document.getElementById('navbar').classList.remove('paused');
  document.getElementById('topbar').classList.remove('paused');
  document.getElementById('main').classList.remove('paused');
  document.getElementById('battle-result').style.display='none';
  S.formation=S._preForm;
  addLog('退出训练'); save(); updateUI();
}

function endBattle(result){
  if(battleTimer)clearTimeout(battleTimer);
  S.battleActive=false;
  rebuildFormation();
  if(B.isTraining){
    B.isTraining=false;
    showTrainingResult();
    save(); updateUI();
    return;
  }
  const resEl=document.getElementById('battle-result');
  let text='',cls='';
  if(result==='win'){
    cls='win';text=`${pix('win','sm')} 胜利！`;
    const e=CFG.enemies[S.selEnemy];
    const cap=storageCapacity();
    // 统计战损
    let lossTotal=0;
    const lossByType={};
    const preForm=S._preForm||{front:[],mid:[],back:[]};
    for(const row of['front','mid','back']){
      for(const u of preForm[row]){lossByType[u.type]=(lossByType[u.type]||0)+u.count;}
      for(const u of S.formation[row]){lossByType[u.type]=(lossByType[u.type]||0)-u.count;}
    }
    for(const[k,v] of Object.entries(lossByType)){if(v>0)lossTotal+=v;}
    // 发放奖励（含战功）
    let rewardHtml='';
    const meritGain=e.boss?15+(Math.floor(e.id/10)-1)*10:Math.ceil(e.id/2)+1;
    S.merit=(S.merit||0)+meritGain;
    rewardHtml+=`<div style="font-size:11px;color:#c0a060">⚔ 战功 +${meritGain}</div>`;
    for(const[r,v] of Object.entries(e.reward)){
      S.res[r]=(S.res[r]||0)+v;if(S.res[r]>cap)S.res[r]=cap;
      rewardHtml+=`<div style="font-size:11px;color:#f0d060">${pix(CFG.res[r].icon,'mini')} ${CFG.res[r].name} +${v}</div>`;
    }
    // 精魄掉落（Boss概率掉落）
    if(e.boss&&e.drops){
      for(const[ek,dc] of Object.entries(e.drops)){
        if(Math.random()<dc.prob){
          const cnt=dc.count||1;
          S.essence[ek]=(S.essence[ek]||0)+cnt;
          const ei=CFG.essences?.[ek];
          rewardHtml+=`<div style="font-size:11px;color:#b0a0d0">${pix(ei?.icon||ek,'mini')} ${ei?.name||ek} +${cnt}</div>`;
        }
      }
    }
    if(!S.defeated.includes(e.id)){S.defeated.push(e.id);}
    addLog(`战胜${e.name}`);
    resEl.innerHTML=`
      <span class="result-text">${text}</span>
      ${lossTotal>0?`<div style="font-size:11px;color:#e06060;margin-top:4px">战损: ${lossTotal}人阵亡</div>`:''}
      <div style="margin-top:8px;padding:8px;background:#121224;border:1px solid #2b3144;border-radius:4px">
        <div style="font-size:10px;color:#888;margin-bottom:4px">战利品</div>
        ${rewardHtml}
      </div>
      <div class="result-btns" style="margin-top:10px">
        ${S.selEnemy+1<CFG.enemies.length?`<button class="btn btn-go btn-sm" onclick="nextBattle()">下一关</button>`:''}
        <button class="btn btn-go btn-sm" onclick="retryBattle()">重新对战</button>
        <button class="btn btn-ghost btn-sm" onclick="exitBattle()">退出</button>
      </div>`;
  }else if(result==='lose'){
    cls='lose';text=`${pix('lose','sm')} 战败`;
    addLog(`败于${CFG.enemies[S.selEnemy].name}`);
    resEl.innerHTML=`
      <span class="result-text">${text}</span>
      <div class="result-btns">
        <button class="btn btn-go btn-sm" onclick="retryBattle()">重新对战</button>
        <button class="btn btn-ghost btn-sm" onclick="exitBattle()">退出</button>
      </div>`;
  }else{
    cls='lose';text=`${pix('timer','sm')} 超时`;
    resEl.innerHTML=`
      <span class="result-text">${text}</span>
      <div class="result-btns">
        <button class="btn btn-go btn-sm" onclick="retryBattle()">重新对战</button>
        <button class="btn btn-ghost btn-sm" onclick="exitBattle()">退出</button>
      </div>`;
  }
  save();
  resEl.className=cls;
  resEl.style.display='flex';
  updateUI();
}

function nextBattle(){
  S.selEnemy++;
  const last=S._lastForm;
  if(last&&(last.front.length+last.mid.length+last.back.length>0)){
    for(const row of['front','mid','back']){
      for(const u of S.formation[row]){S.pool[u.type]=(S.pool[u.type]||0)+u.count;}
    }
    const newForm={front:[],mid:[],back:[]};
    let shortage=false;
    for(const row of['front','mid','back']){
      for(const u of last[row]){
        if(newForm[row].length>=rowSlots(row)){shortage=true;break;}
        const avail=poolAvail(u.type);
        if(avail<=0){shortage=true;continue;}
        const count=Math.min(u.count,avail,regMax());
        if(count<u.count)shortage=true;
        S.pool[u.type]-=count;
        newForm[row].push({type:u.type,count,id:Date.now()+Math.random()});
      }
    }
    S.formation=newForm;
    if(shortage)toast('余量不足，已按可用人数填充');
  }
  exitBattle();
  setTimeout(()=>openBattle(),150);
}

function retryBattle(){
  exitBattle();
  setTimeout(()=>openBattle(),150);
}

function exitBattle(){
  const cur=CFG.enemies[S.selEnemy];
  if(cur&&S.defeated.includes(cur.id))S.selEnemy=Math.min(S.selEnemy+1,CFG.enemies.length-1);
  document.getElementById('battle-result').style.display='none';
  document.getElementById('battle-screen').classList.remove('active');
  document.getElementById('navbar').classList.remove('paused');
  document.getElementById('topbar').classList.remove('paused');
  document.getElementById('main').classList.remove('paused');
  updateUI();
}

// 速度按钮
document.getElementById('battle-speed').addEventListener('click',e=>{
  if(e.target.classList.contains('btn-speed')){
    document.querySelectorAll('#battle-speed .btn-speed').forEach(b=>b.classList.remove('on'));
    e.target.classList.add('on');
    S.battleSpeed=parseInt(e.target.dataset.spd);
  }
});
