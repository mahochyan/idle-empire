// ==================== 配置 ====================
const CFG = {
  tickMs: 1000,
  campBase: 0,
  maxRows: {front:1, mid:1, back:1},
  battleTimeoutMs: 10*60*1000,
  initRegMax: 10,
  chapterResourceLevels: 10,
  maxUpgradeTime: 120,

  res: {
    wood:{name:'木材',icon:'wood',basePerPop:0.5},
    stone:{name:'石料',icon:'stone',basePerPop:0.5},
    food:{name:'食物',icon:'food',basePerPop:0.5}
  },

  town: [
    {lv:1,name:'小村庄',maxPop:10, needBoss:0},
    {lv:2,name:'村庄',maxPop:18, needBoss:1},
    {lv:3,name:'大村庄',maxPop:28, needBoss:2},
    {lv:4,name:'小镇',maxPop:42, needBoss:3},
    {lv:5,name:'城镇',maxPop:60, needBoss:5},
    {lv:6,name:'大城镇',maxPop:80, needBoss:7},
    {lv:7,name:'小城',maxPop:105, needBoss:10},
    {lv:8,name:'城市',maxPop:140, needBoss:13}
  ],

  buildings: {
    lumber_mill:{name:'伐木场',buffRes:'wood',buffBase:0.15,buffPerLv:0.2, build:{wood:150,stone:80,food:50,time:4}, upBase:{wood:800,stone:500,food:300}, upCostLv:1.45},
    quarry:{name:'采石场',buffRes:'stone',buffBase:0.15,buffPerLv:0.2, build:{wood:50,stone:120,food:40,time:4}, upBase:{wood:500,stone:800,food:300}, upCostLv:1.45},
    farm:{name:'农田',buffRes:'food',buffBase:0.15,buffPerLv:0.2, build:{wood:80,stone:40,food:120,time:4}, upBase:{wood:600,stone:300,food:800}, upCostLv:1.45},
    barracks:{name:'营帐',build:{wood:300,stone:200,food:100,time:6}, upBase:{wood:2200,stone:1800,food:1000}, upCostLv:1.85},
    infantry_camp:{name:'步兵营',trains:'infantry',reserveBase:2,reserveBonus:2,build:{wood:180,stone:100,food:80,time:5},upBase:{wood:1600,stone:1000,food:800},upCostLv:1.7},
    archer_range:{name:'射手靶场',trains:'archer',reserveBase:1,reserveBonus:2,build:{wood:240,stone:100,food:100,time:6},upBase:{wood:2000,stone:1000,food:1000},upCostLv:1.75},
    stable:{name:'兽栏',trains:'cavalry',reserveBase:1,reserveBonus:1,needBoss:1,build:{wood:220,stone:160,food:180,time:7},upBase:{wood:2000,stone:1500,food:1600},upCostLv:1.8},
    spear_crypt:{name:'枪兵墓穴',trains:'spearman',reserveBase:1,reserveBonus:1,needBoss:2,build:{wood:160,stone:240,food:100,time:7},upBase:{wood:1400,stone:2200,food:1000},upCostLv:1.8},
    mage_tower:{name:'法师塔',trains:'mage',reserveBase:1,reserveBonus:1,needBoss:2,build:{wood:500,stone:500,food:350,time:10},upBase:{wood:3800,stone:3800,food:2800},upCostLv:1.9},
    warehouse:{name:'仓库',storagePerLv:500,build:{wood:200,stone:200,food:100,time:5},upBase:{wood:1600,stone:1600,food:800},upCostLv:1.45}
  },

  units: {
    infantry:{name:'步兵',race:'人族',row:'front',icon:'infantry',
      cost:{wood:50,stone:20,food:40}, upkeep:0.1, trainTime:1, atk:12,def:8,spd:10, passive:'格挡8%'},
    archer:{name:'弓兵',race:'精灵',row:'back',icon:'archer',
      cost:{wood:80,stone:20,food:30}, upkeep:0.2, trainTime:1, atk:16,def:4,spd:12, passive:'基础MISS20%，打骑兵50%'},
    cavalry:{name:'骑兵',race:'兽人',row:'front',icon:'cavalry',
      cost:{wood:40,stone:30,food:80}, upkeep:0.2, trainTime:1, atk:14,def:6,spd:14, passive:'吸血8%'},
    spearman:{name:'枪兵',race:'亡灵',row:'mid',icon:'spearman',
      cost:{wood:30,stone:60,food:40}, upkeep:0.1, trainTime:1, atk:13,def:7,spd:11, passive:'破甲10%'},
    mage:{name:'法师',race:'亡灵',row:'back',icon:'mage',
      cost:{wood:80,stone:60,food:80}, upkeep:0.4, trainTime:1, atk:22,def:2,spd:8, passive:'互易伤1.3x',locked:true}
  },

  counters: {
    infantry:{spearman:1.3,archer:1.0,cavalry:1.0,infantry:1.0,mage:1.0},
    archer:{infantry:1.3,spearman:1.3,cavalry:1.0,archer:1.0,mage:1.0},
    cavalry:{infantry:1.3,archer:1.5,spearman:0.7,cavalry:1.0,mage:1.0},
    spearman:{cavalry:1.5,infantry:1.0,archer:1.0,spearman:1.0,mage:1.0},
    mage:{infantry:1.3,archer:1.3,cavalry:1.3,spearman:1.3,mage:1.0}
  },
  miss: {
    archer:{base:0.2,cavalry:0.5}
  },
  normalVsMage:1.3,

  tactics: {
    steady:{name:'稳扎稳打',desc:'防御+15% 速度-10%',defPct:.15,atkPct:0,spdPct:-.1,backPct:0,heal:0},
    assault:{name:'全军突击',desc:'攻击+20% 防御-10%',defPct:-.1,atkPct:.2,spdPct:0,backPct:0,heal:0},
    range:{name:'远程压制',desc:'后排伤害+15% 前排防-5%',defPct:0,atkPct:0,spdPct:0,backPct:.15,heal:0},
    attrition:{name:'消耗战',desc:'每回合回复5% 速-5%',defPct:.05,atkPct:0,spdPct:-.05,backPct:0,heal:.05}
  },

  enemies: [
    // === 第一章：仅步兵+弓兵 (0 Boss) ===
    {id:1,name:'侦察兵小队',desc:'前排步兵试探，步兵扛线弓兵输出',units:{infantry:[1,1]},reward:{wood:120,stone:90,food:80}},
    {id:2,name:'弓兵巡逻队',desc:'步弓混编，考验前后排配置',units:{infantry:[1,1],archer:[1,1]},reward:{wood:200,stone:150,food:130}},
    {id:3,name:'步兵方阵',desc:'重步兵推进，弓兵集火削血',units:{infantry:[2,1]},reward:{wood:280,stone:200,food:180}},
    {id:99,name:'守关校尉',desc:'BOSS·步弓混编重兵，考验基本战术',units:{infantry:[3,2],archer:[2,2]},boss:true,bossMult:{atk:1.3,def:1.25},reward:{wood:800,stone:600,food:500}},
    // === 第二章：解锁骑兵 (1 Boss) ===
    {id:4,name:'骑兵侦察队',desc:'敌方骑兵出现，步兵前排抵御',units:{cavalry:[1,1],infantry:[1,1]},reward:{wood:350,stone:280,food:230}},
    {id:5,name:'骑步混编',desc:'骑兵冲击后排，布好前中排',units:{cavalry:[2,1],infantry:[1,1],archer:[1]},reward:{wood:450,stone:350,food:300}},
    {id:98,name:'骑兵统领',desc:'BOSS·骑兵主力，枪兵克制关键',units:{cavalry:[4,3],infantry:[2,2],archer:[2,1]},boss:true,bossMult:{atk:1.35,def:1.3},reward:{wood:1000,stone:800,food:700}},
    // === 第三章：解锁枪兵+法师 (2 Boss) ===
    {id:6,name:'枪兵方阵',desc:'敌方枪兵出现，反骑破甲',units:{spearman:[2,2],infantry:[1,1]},reward:{wood:550,stone:480,food:400}},
    {id:7,name:'法师小队',desc:'敌方法师高伤脆皮，骑兵切后',units:{mage:[1,1],infantry:[1,1],spearman:[1]},reward:{wood:650,stone:550,food:480}},
    {id:97,name:'混编将军',desc:'BOSS·四兵种齐全，多兵种协同破阵',units:{infantry:[4,3],archer:[2,2],cavalry:[3,2],spearman:[2,2],mage:[1]},boss:true,bossMult:{atk:1.4,def:1.35},reward:{wood:1300,stone:1100,food:950}}
  ]};

// ==================== 状态 ====================
let S = {
  res:{wood:300,stone:300,food:300},
  buildings:{},
  pool:{infantry:0,archer:0,cavalry:0,spearman:0,mage:0},
  formation:{front:[],mid:[],back:[]},
  townLv:1,
  popAlloc:{wood:5,stone:3,food:2},
  defeated:[],
  mageOk:false,
  log:[],
  tick:0,
  page:'home',
  selEnemy:null,
  queue:{},
  battleSpeed:1,
  battleActive:false
};

// ==================== 辅助 ====================
function bldSt(k){return S.buildings[k]||{lv:0,state:'idle',timer:0,timerEnd:0}}
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
function townUpgradeNeed(){
  const next=CFG.town.find(t=>t.lv===S.townLv+1);
  return next?next.needBoss:999;
}
function townCanUpgrade(){
  return S.townLv<CFG.town.length && bossDefeatedCount()>=townUpgradeNeed();
}
function bossDefeatedCount(){
  return CFG.enemies.filter(e=>e.boss&&S.defeated.includes(e.id)).length;
}
function resourceLevelCap(){
  return bossDefeatedCount() + 1;
}
function resourceCapText(){
  return `\u672c\u7ae0\u4e0a\u9650 Lv.${resourceLevelCap()}`;
}
function storageCapacity(){
  const whLv=(S.buildings.warehouse||{lv:0}).lv;
  return 2000 + whLv * 500;
}
function upgradeLockReason(key){
  const cfg=CFG.buildings[key],st=bldSt(key);
  if(st.lv>=S.townLv) return `\u9700\u5347\u7ea7\u57ce\u9547\u5230Lv.${S.townLv+1}`;
  if((cfg.buffRes||cfg.storagePerLv)&&st.lv>=resourceLevelCap()){
    const nextBoss=CFG.enemies.find(e=>e.boss&&!S.defeated.includes(e.id));
    return nextBoss?`\u5df2\u8fbe${resourceCapText()}\uff0c\u51fb\u8d25${nextBoss.name}\u540e\u7ee7\u7eed\u5347\u7ea7`:`\u5df2\u8fbe${resourceCapText()}`;
  }
  return '';
}
function regMax(){
  const s=bldSt('barracks');
  return 5+(s.state==='idle'&&s.lv>=1?5:0);
}
function trainBuildingKey(uk){
  return Object.keys(CFG.buildings).find(k=>CFG.buildings[k].trains===uk)||null;
}
function trainBuildingState(uk){
  const key=trainBuildingKey(uk);
  return key?bldSt(key):null;
}
function reserveMax(uk){
  const key=trainBuildingKey(uk);
  if(!key)return 0;
  const cfg=CFG.buildings[key],st=bldSt(key);
  return st.lv>0?cfg.reserveBase+st.lv*cfg.reserveBonus:0;
}
function reserveLeft(uk){
  return Math.max(0,reserveMax(uk)-(S.pool[uk]||0));
}
function queueTotal(uk){
  const q=S.queue[uk];
  return q?q.count:0;
}
function queueMax(uk){
  return reserveMax(uk)*10;
}
function processQueue(){
  let changed=false;
  for(const[uk,q] of Object.entries(S.queue)){
    if(!q||!q.count)continue;
    const lock=trainLockReason(uk);
    if(lock)continue;
    const tt=CFG.units[uk].trainTime||1;
    if(q.timer>0)q.timer--;
    if(q.timer<=0&&q.count>0){
      if(reserveLeft(uk)<=0)continue;
      const cost=CFG.units[uk].cost;
      if(S.res.wood<cost.wood||S.res.stone<cost.stone||S.res.food<cost.food)continue;
      S.res.wood-=cost.wood;S.res.stone-=cost.stone;S.res.food-=cost.food;
      S.pool[uk]=(S.pool[uk]||0)+1;
      q.count--;
      changed=true;
      if(q.count>0)q.timer=tt;else q.timer=0;
    }
  }
  if(changed)save();
}
function trainLockReason(uk){
  const key=trainBuildingKey(uk);
  if(!key)return '';
  const cfg=CFG.buildings[key],st=bldSt(key);
  if(cfg.needBoss && bossDefeatedCount() < cfg.needBoss)return '击败'+cfg.needBoss+'个Boss后解锁'+cfg.name;
  if(st.lv<=0&&st.state==='idle')return `需先建造${cfg.name}`;
  if(st.state==='building')return `${cfg.name}建设中`;
  if(st.state==='upgrading')return `${cfg.name}升级中`;
  return '';
}
function mageOk(){return bossDefeatedCount()>=2;}
function trainBuildingLabel(uk){
  const key=trainBuildingKey(uk);
  if(!key)return '';
  const cfg=CFG.buildings[key],st=bldSt(key);
  if(st.lv<=0)return `${cfg.name}: \u672a\u5efa\u9020`;
  return `${cfg.name}: Lv.${st.lv}${st.state==='idle'?'':' / \u6682\u505c\u8bad\u7ec3'}`;
}
function reserveHtml(uk){
  const cap=reserveMax(uk),used=S.pool[uk]||0,left=reserveLeft(uk);
  const cls=cap>0&&used<=cap?'limit-ok':'limit-warn';
  const extra=cap>0?` | \u4f59\u91cf ${left}`:'';
  return `<span class="${cls}">\u540e\u5907 ${used}/${cap}</span>${extra}`;
}
function totalSoldiers(){
  let n=0;for(const v of Object.values(S.pool)) n+=v;
  for(const row of['front','mid','back']) for(const u of S.formation[row]) n+=u.count;
  return n;
}
function formCnt(){return S.formation.front.length+S.formation.mid.length+S.formation.back.length}
function poolAvail(uk){ return S.pool[uk]||0; }
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
    }
  }
  return up;
}
function cm(atk,def){return CFG.counters[atk][def]||1.0}
function mm(atk,def){
  if(atk==='mage'&&def!=='mage')return CFG.counters.mage[def];
  if(atk!=='mage'&&def==='mage')return CFG.normalVsMage;
  return 1.0;
}
function missRate(attacker,defender){
  const cfg=CFG.miss[attacker.type];
  if(!cfg)return 0;
  return cfg[defender.type]??cfg.base??0;
}
function isAttackMiss(attacker,defender){
  const rate=missRate(attacker,defender);
  return rate>0&&Math.random()<rate;
}

function save(){
  const d={res:S.res,buildings:S.buildings,pool:S.pool,queue:S.queue,formation:S.formation,townLv:S.townLv,popAlloc:S.popAlloc,defeated:S.defeated,mageOk:S.mageOk,tick:S.tick};
  localStorage.setItem('rts_save',JSON.stringify(d));
}
function load(){
  const r=localStorage.getItem('rts_save');if(!r)return;
  try{const d=JSON.parse(r);S.res=d.res||S.res;S.buildings=d.buildings||{};S.pool=d.pool||S.pool;S.formation=d.formation||S.formation;S.townLv=d.townLv||1;S.popAlloc=d.popAlloc||{wood:5,stone:3,food:2};S.defeated=d.defeated||[];S.mageOk=d.mageOk||false;S.queue=d.queue||{};S.tick=d.tick||0;}catch(e){}
}

// ==================== 计时 ====================
function tick(){
  S.tick++;if(S.battleActive)return;
  let ch=false;
  for(const k of Object.keys(CFG.buildings)){
    const st=bldSt(k);
    if((st.state==='building'||st.state==='upgrading')&&st.timerEnd>0){
      st.timer--;if(st.timer<=0){
        if(st.state==='building'){st.lv=1;addLog(`${CFG.buildings[k].name}建成`)}
        else{st.lv++;addLog(`${CFG.buildings[k].name}→Lv.${st.lv}`)}
        st.state='idle';st.timer=0;st.timerEnd=0;ch=true;
      }
    }
  }
  if(ch)save();processQueue();
  const cap=storageCapacity();
  for(const rk of Object.keys(CFG.res)){
    if(rk==='food'){
      S.res[rk]=Math.min(S.res[rk]+prodRate(rk)-totalUpkeep()-popAllocTotal()*0.1, cap);
      if(S.res[rk]<0)S.res[rk]=0;
    }else{
      S.res[rk]=Math.min(S.res[rk]+prodRate(rk), cap);
    }
  }
  if(S.tick%60===0)save();
  updateUI();
}

// ==================== 操作 ====================
function buildAct(key){
  const cfg=CFG.buildings[key],st=bldSt(key);
  if(cfg.needBoss && bossDefeatedCount()<cfg.needBoss){toast(`\u51fb\u8d25${cfg.needBoss}\u4e2aBoss\u540e\u89e3\u9501`);return}
  if(st.state!=='idle'){toast(st.state==='building'?'建造中':'升级中');return}
  const upLock=st.lv>0?upgradeLockReason(key):'';
  if(upLock){toast(upLock);return}
  const cost=st.lv===0?cfg.build:upCost(key);
  if(S.res.wood<cost.wood||S.res.stone<cost.stone||S.res.food<cost.food){toast('资源不足');return}
  S.res.wood-=cost.wood;S.res.stone-=cost.stone;S.res.food-=cost.food;
  if(!S.buildings[key])S.buildings[key]={lv:0,state:'idle',timer:0,timerEnd:0};
  const bs=S.buildings[key];
  if(bs.lv===0){bs.state='building';bs.timerEnd=cost.time;bs.timer=cost.time;addLog(`开始建造${cfg.name}`)}
  else{bs.state='upgrading';bs.timerEnd=cost.time;bs.timer=cost.time;addLog(`开始升级${cfg.name}`)}
  save();updateUI();
}
function upgradeTown(){
  if(!townCanUpgrade()){toast(`需击败${townUpgradeNeed()}个Boss才能升级城镇`);return}
  if(popAllocTotal()>CFG.town.find(t=>t.lv===S.townLv+1).maxPop){toast('请先减少人口分配');return}
  S.townLv++;
  addLog(`城镇升级为${townCfg().name}，人口上限${maxPop()}`);
  save();updateUI();
}
function setPopAlloc(rk,v){
  const nv=Math.max(0,Math.min(Math.floor(v),999));
  const old=S.popAlloc[rk]||0;
  const diff=nv-old;
  if(diff>0&&popFree()<diff){toast(`空闲人口不足，最多${popAllocTotal()+popFree()}`);return}
  S.popAlloc[rk]=nv;
  save();updateUI();
}
function upCost(key){
  const cfg=CFG.buildings[key],lv=bldSt(key).lv||1;
  const b=cfg.upBase,m=Math.pow(cfg.upCostLv,lv);
  const rawTime=Math.ceil(5*Math.pow(1.45,lv-1)+lv*3);
  const time=Math.min(CFG.maxUpgradeTime,rawTime);
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
function dismiss(uk){
  const a=poolAvail(uk);
  if(a<=0){toast('无可用士兵');return}
  S.pool[uk]-=1;addLog(`解散${CFG.units[uk].name}-1`);save();updateUI();
}

// ==================== 编队弹窗 ====================
let formModalTarget=null; // {row, idx: 要填的位置, isNew: 是否填到空位}

function openFormModal(row,idx){
  formModalTarget={row,idx};
  const content=document.getElementById('form-modal-content');
  const rm=regMax();
  let h=`<h3>${pix('army','card-pix')} 编入兵团 — ${row==='front'?'前排':row==='mid'?'中排':'后排'} (最大${rm}人)</h3>`;
  h+='<div style="max-height:300px;overflow-y:auto">';
  let hasAny=false;
  for(const[k,c] of Object.entries(CFG.units)){
    if(k==='mage'&&!mageOk())continue;
    const av=poolAvail(k);
    if(av<=0)continue;
    hasAny=true;
    // 检查该排是否已有此兵种兵团
    const target=S.formation[row][idx];
    const remaining=target&&target.type===k?Math.min(rm-target.count, av):Math.min(rm, av);
    if(remaining<=0)continue;
    h+=`<div class="modal-unit" data-type="${k}" data-avail="${remaining}" onclick="selModalUnit(this,'${k}',${remaining})">
      <span class="mu-icon">${pix(c.icon,'lg')}</span>
      <div class="mu-info"><div class="mu-name">${c.name}</div>
      <div class="mu-detail">可用:${av}人 | ${c.passive}</div></div>
    </div>`;
  }
  if(!hasAny)h+='<div style="text-align:center;color:#666;padding:20px">无可用士兵，请先训练</div>';
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
  const qty=S._formModalQty;
  if(qty<=0||poolAvail(type)<qty){toast('可用人数不足');return}
  const target=S.formation[row][idx];
  if(target&&target.type===type){
    if(target.count+qty>regMax()){toast(`超过兵团上限${regMax()}人`);return}
    target.count+=qty;
  } else {
    if(formCnt()>=formSlots()){toast('阵容已满');return}
    if(qty>regMax()){toast(`超过兵团上限${regMax()}人`);return}
    S.formation[row].push({type,count:qty,id:Date.now()+Math.random()});
  }
  S.pool[type]-=qty; // 从军营扣除
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

// 从阵容移除兵团
function rmForm(row,idx){
  const u=S.formation[row][idx];
  if(!u)return;
  S.pool[u.type]=(S.pool[u.type]||0)+u.count; // 归还军营
  S.formation[row].splice(idx,1);
  updateUI();
}
// 调整兵团人数
function adjForm(row,idx,d){
  const u=S.formation[row][idx];
  if(!u)return;
  const nv=u.count+d;
  if(d>0 && nv>regMax()){toast(`兵团上限${regMax()}`);return}
  if(d>0 && poolAvail(u.type)<d){toast('可用人数不足');return}
  if(d>0) S.pool[u.type]-=d;  // 从军营扣除
  if(d<0) S.pool[u.type]+=(-d); // 归还军营
  if(nv<=0){S.formation[row].splice(idx,1);updateUI();return}
  u.count=nv;
  updateUI();
}
function clrForm(){S.formation={front:[],mid:[],back:[]};updateUI()}

// ==================== 战斗系统 ====================
let battleTimer=null;
let B={};

function selEnemy(idx){
  if(idx!==0&&!S.defeated.includes(CFG.enemies[idx-1]?.id))return;
  S.selEnemy=idx;updateUI();
}

function openBattle(){
  if(S.selEnemy===null||S.selEnemy===undefined){toast('请先选敌人');return}
  if(formCnt()===0){toast('请先配置阵容');return}
  S.battleActive=true;
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
  S.pool=S._prePool; S.formation=S._preForm;
  addLog('逃离战斗'); save(); updateUI();
}

function initBattleState(){
  const e=CFG.enemies[S.selEnemy];
  const tkey='steady'; // 战术归入英雄技能系统(P3)
  S._prePool=JSON.parse(JSON.stringify(S.pool));
  S._preForm=JSON.parse(JSON.stringify(S.formation));
  B.tactic=CFG.tactics[tkey]; B.enemyCfg=e;
  B.round=0; B.maxRound=25+(e.boss?5:0); B.winner=null; B.msgs=[];
  B.ourUnits=[]; B.enemyUnits=[];
  let uid=0;
  for(const row of['front','mid','back']){
    for(const u of S.formation[row]){
      const cfg=CFG.units[u.type];
      B.ourUnits.push({id:uid++, fid:u.id, type:u.type, row, hp:u.count, maxHp:u.count,
        icon:cfg.icon, name:cfg.name, spd:cfg.spd, atk:cfg.atk, def:cfg.def});
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
        def:bm?Math.floor(cfg.def*bm.def):cfg.def});
    }
  }
}

function drawBattleField(){
  const f=document.getElementById('battle-field');
  const oa=B.ourUnits.filter(u=>u.alive!==false).length;
  const ea=B.enemyUnits.filter(u=>u.alive!==false).length;
  const ohp=B.ourUnits.filter(u=>u.alive!==false).reduce((s,u)=>s+u.hp,0);
  const ehp=B.enemyUnits.filter(u=>u.alive!==false).reduce((s,u)=>s+u.hp,0);
  document.getElementById('battle-title').innerHTML=`${pix('battle','sm')} ${B.enemyCfg.name} | 回合${B.round} | 我方${oa}团${ohp}人 vs 敌方${ea}团${ehp}人`;

  let h='';
  // 敌方
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
  return unitType==='archer'||unitType==='mage'||unitType==='spearman';
}

function getTarget(attacker,enemyList){
  const alive=enemyList.filter(u=>u.alive!==false);
  if(!alive.length)return null;
  const rows={front:0,mid:1,back:2};
  const minR=Math.min(...alive.map(u=>rows[u.row]));
  const front=alive.filter(u=>rows[u.row]===minR);

  // 近战不在前排 → 不能攻击
  if(!isRanged(attacker.type) && attacker.row!=='front') return null;

  if(isRanged(attacker.type)){
    // 远程：可越过前排，60%优先打中后排
    const backAlive=alive.filter(u=>rows[u.row]>=1);
    if(backAlive.length>0 && Math.random()<0.6){
      return backAlive[Math.floor(Math.random()*backAlive.length)];
    }
    return alive[Math.floor(Math.random()*alive.length)];
  }
  // 近战(前排)：只能打敌方最前排
  return front[Math.floor(Math.random()*front.length)];
}

// 计算伤害（杀多少兵）
function calcDmg(attacker,defender,isOur){
  const cmv=cm(attacker.type,defender.type);
  const mmv=mm(attacker.type,defender.type);
  let atk=attacker.atk;
  if(isOur){
    atk=Math.floor(atk*(1+(B.tactic.atkPct||0)));
    if(attacker.row==='back') atk=Math.floor(atk*(1+(B.tactic.backPct||0)));
  }
  let def=defender.def;
  if(isOur&&B.tactic.defPct)def=Math.floor(def*(1+B.tactic.defPct));
  // 基础公式：攻击方ATK / 防御方DEF * 克制系数
  const base=atk/Math.max(1,def)*cmv*mmv*(0.8+Math.random()*0.4);
  return Math.max(1,Math.floor(base));
}

function battleTurn(){
  if(!S.battleActive)return;
  B.round++;
  if(B.round>B.maxRound){endBattle('timeout');return}

  const rows={front:0,mid:1,back:2};
  const all=[];
  for(const u of B.ourUnits) if(u.alive!==false) all.push({...u,side:'our'});
  for(const u of B.enemyUnits) if(u.alive!==false) all.push({...u,side:'enemy'});
  for(const a of all){
    if(a.side==='our') a.spd=Math.floor(a.spd*(1+(B.tactic.spdPct||0)));
  }
  all.sort((a,b)=>b.spd-a.spd);

  let idx=0,delay=400/S.battleSpeed;

  function nextAction(){
    if(!S.battleActive)return;
    if(idx>=all.length){
      drawBattleField();
      const oa=B.ourUnits.filter(u=>u.alive!==false).length;
      const ea=B.enemyUnits.filter(u=>u.alive!==false).length;
      if(oa===0){endBattle('lose');return}
      if(ea===0){endBattle('win');return}
      bmsg(`── 回合${B.round}结束 ──`,'#555');
      battleTimer=setTimeout(battleTurn,250/S.battleSpeed);
      return;
    }

    const actor=all[idx];
    if(actor.alive===false){idx++;nextAction();return}

    const enemyList=actor.side==='our'?B.enemyUnits:B.ourUnits;
    const target=getTarget(actor,enemyList);
    if(!target){idx++;nextAction();return} // 近战不在前排跳过攻击

    const actorEl=document.getElementById((actor.side==='our'?'ou-':'eu-')+actor.id);
    const targetEl=document.getElementById((actor.side==='our'?'eu-':'ou-')+target.id);

    if(targetEl)targetEl.classList.add('targeted');
    if(actorEl)actorEl.classList.add('attacking');

    const missed=isAttackMiss(actor,target);
    const dmg=missed?0:calcDmg(actor,target,actor.side==='our');
    const cmv=cm(actor.type,target.type);
    const mmv=mm(actor.type,target.type);
    const actualKill=missed?0:Math.min(dmg,target.hp);

    setTimeout(()=>{
      if(!S.battleActive)return;
      if(actorEl)actorEl.classList.remove('attacking');
      if(targetEl)targetEl.classList.remove('targeted');

      const isGood=cmv>=1.3,isBad=cmv<=0.7;

      if(missed){
        bmsg(`${actor.name} \u2192 ${target.name} MISS${target.type==='cavalry'?' [\u9a91\u5175\u95ea\u907f]':''}`,'#6f7890');
        idx++;
        drawBattleField();
        nextAction();
        return;
      }

      target.hp-=actualKill;

      if(target.hp<=0){
        target.hp=0;target.alive=false;
        if(targetEl){targetEl.classList.add('dead');setTimeout(()=>{if(targetEl)targetEl.classList.add('dead-done')},500);}
        bmsg(`${actor.name} → ${target.name} 击杀${actualKill}人，${target.name}全灭！`+(isGood?'[克制]':'')+(mmv>1?'[易伤]':''),isGood?'#40bf80':'#e06060');
      }else{
        if(targetEl){targetEl.classList.add('hit');setTimeout(()=>{if(targetEl)targetEl.classList.remove('hit')},400);}
        bmsg(`${actor.name} → ${target.name} 击杀${actualKill}人，${target.name}剩余${target.hp}人`+(isBad?'[劣势]':''),'#888');
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
          const lost=fu.count-u.hp; // 损失人数
          let refill=Math.min(lost,poolAvail(u.type)); // 从军营补充
          if(refill>0)S.pool[u.type]-=refill;
          newForm[row].push({type:fu.type,count:u.hp+refill,id:fu.id});
          if(refill>0)addLog(`${CFG.units[u.type].name}兵团自动补员+${refill}`);
          break;
        }
      }
    }
  }
  S.formation=newForm;
}

function endBattle(result){
  if(battleTimer)clearTimeout(battleTimer);
  S.battleActive=false;
  rebuildFormation();
  const resEl=document.getElementById('battle-result');
  let text='',cls='';
  if(result==='win'){
    cls='win';text=`${pix('win','sm')} 胜利！`;
    const e=CFG.enemies[S.selEnemy];
    const cap=storageCapacity();
    for(const[r,v] of Object.entries(e.reward)){S.res[r]=(S.res[r]||0)+v;if(S.res[r]>cap)S.res[r]=cap;}
    if(!S.defeated.includes(e.id)){
      S.defeated.push(e.id);
          }
    addLog(`战胜${e.name}`);
  }else if(result==='lose'){
    cls='lose';text=`${pix('lose','sm')} 战败`;
    addLog(`败于${CFG.enemies[S.selEnemy].name}`);
  }else{
    cls='lose';text=`${pix('timer','sm')} 超时`;
  }
  save();
  // 检查下一关是否可用
  const nextIdx=S.selEnemy+1;
  const hasNext=nextIdx<CFG.enemies.length && (S.defeated.includes(CFG.enemies[S.selEnemy].id) || result==='win');
  resEl.className=cls;
  resEl.innerHTML=`
    <span class="result-text">${text}</span>
    <div class="result-btns">
      ${hasNext?`<button class="btn btn-go btn-sm" onclick="nextBattle()">${pix('next','mini')}下一关</button>`:''}
      <button class="btn btn-go btn-sm" onclick="retryBattle()">${pix('reset','mini')}重新对战</button>
      <button class="btn btn-ghost btn-sm" onclick="exitBattle()">${pix('exit','mini')}退出</button>
    </div>`;
  resEl.style.display='flex';
  updateUI();
}

function nextBattle(){
  S.selEnemy++;
  exitBattle();
  setTimeout(()=>openBattle(),150);
}

function retryBattle(){
  exitBattle();
  setTimeout(()=>openBattle(),150);
}

function exitBattle(){
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
