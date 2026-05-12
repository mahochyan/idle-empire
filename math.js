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
  battleActive:false,
  _trainQty:{}
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
  const cfg=CFG.buildings.warehouse;
  return (cfg.storageBase??2000) + whLv * (cfg.storagePerLv??500);
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
    if(!q||!q.count){q.reason='';continue;}
    const lock=trainLockReason(uk);
    if(lock){q.reason='';continue;}
    const tt=CFG.units[uk].trainTime||1;
    if(q.timer>0){q.timer--;}
    if(q.timer<=0&&q.count>0){
      if(reserveLeft(uk)<=0){q.reason='后备已满';continue;}
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
function dismiss(uk){
  const q=S.queue[uk];
  if(q&&q.count>0){
    q.count--;addLog(`取消训练${CFG.units[uk].name}-1 (队列${q.count}人)`);
    if(q.count<=0){q.count=0;q.timer=0;q.reason='';}
    save();updateUI();return;
  }
  const a=poolAvail(uk);
  if(a<=0){toast('无可用士兵');return}
  S.pool[uk]-=1;addLog(`解散${CFG.units[uk].name}-1`);save();updateUI();
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
  S.pool[uk]-=fromP;addLog(`解散${CFG.units[uk].name}-${fromP}`);save();updateUI();
}
function cancelQueue(uk){
  const q=S.queue[uk];
  if(!q||q.count<=0){toast('队列为空');return}
  const n=q.count;
  q.count=0;q.timer=0;q.reason='';
  addLog(`取消训练${CFG.units[uk].name}-${n} (队列已清空)`);
  save();updateUI();
}
function addRes(rk,inputId){
  const el=document.getElementById(inputId);
  const n=Math.max(1,Math.floor(parseInt(el?.value,10)||0));
  const cap=storageCapacity();
  S.res[rk]=Math.min((S.res[rk]||0)+n,cap);
  addLog(`手动添加${CFG.res[rk].name}+${n}`);
  save();updateUI();
}

// ==================== 编队弹窗 ====================
let formModalTarget=null; // {row, idx: 要填的位置, isNew: 是否填到空位}

function openFormModal(row,idx){
  formModalTarget={row,idx};
  const content=document.getElementById('form-modal-content');
  const rm=regMax();
  let h=`<h3>${pix('army','card-pix')} 编入兵团 — ${row==='front'?'前排':row==='mid'?'中排':'后排'} (营帐上限 ${rm}人/团)</h3>`;
  h+='<div style="max-height:300px;overflow-y:auto">';
  let hasAny=false;
  for(const[k,c] of Object.entries(CFG.units)){
    if(k==='mage'&&!mageOk())continue;
    const av=poolAvail(k);
    if(av<=0)continue;
    hasAny=true;
    const target=S.formation[row][idx];
    const remaining=target&&target.type===k?Math.min(rm-target.count, av):Math.min(rm, av);
    if(remaining<=0)continue;
    h+=`<div class="modal-unit" data-type="${k}" data-avail="${remaining}" onclick="selModalUnit(this,'${k}',${remaining})">
      <span class="mu-icon">${pix(c.icon,'lg')}</span>
      <div class="mu-info"><div class="mu-name">${c.name}</div>
      <div class="mu-detail">可编入:${av}人 | 营帐上限 ${rm}人/团 | ${c.passive}</div></div>
    </div>`;
  }
  if(!hasAny)h+='<div style="text-align:center;color:#666;padding:20px">后备无可用士兵，请先训练</div>';
  h+='</div>';
  h+=`<div id="modal-qty-area" style="display:none"><div class="modal-qty">
    <button onpointerdown="startModalLongPress(-1)" onpointerup="stopModalLongPress()" onpointerleave="stopModalLongPress()" onpointercancel="stopModalLongPress()" onclick="event.preventDefault()">-</button>
    <input type="text" inputmode="numeric" pattern="[0-9]*" id="modal-qty-input" value="1" onchange="clampQty()" oninput="clampQty()">
    <button onpointerdown="startModalLongPress(1)" onpointerup="stopModalLongPress()" onpointerleave="stopModalLongPress()" onpointercancel="stopModalLongPress()" onclick="event.preventDefault()">+</button>
  </div>
  <div class="modal-quick">
    <button class="btn btn-ghost btn-xs" onclick="setModalQty(S._formModalMax)">MAX</button>
  </div>
  <div style="text-align:center;margin-top:6px;font-size:10px;color:#888">部队人数 (HP) | 不消耗后备</div>
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
  if(qty<=0){toast('人数无效');return}
  if(poolAvail(type)<qty){toast('后备不足');return}
  const target=S.formation[row][idx];
  if(target&&target.type===type){
    if(target.count+qty>regMax()){toast(`超过营帐上限${regMax()}人/团`);return}
    target.count+=qty;
  } else {
    if(formCnt()>=formSlots()){toast('阵容已满');return}
    if(qty>regMax()){toast(`超过营帐上限${regMax()}人/团`);return}
    S.formation[row].push({type,count:qty,id:Date.now()+Math.random()});
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
  h+=`<div><span style="color:#888">攻击力</span> <span style="color:#f0d060;float:right">${c.atk}</span></div>`;
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
function rmForm(row,idx){
  const u=S.formation[row][idx];
  if(!u)return;
  S.pool[u.type]=(S.pool[u.type]||0)+u.count;
  S.formation[row].splice(idx,1);
  updateUI();
}
// 调整兵团人数
function adjForm(row,idx,d){
  const u=S.formation[row][idx];
  if(!u)return;
  const nv=u.count+d;
  if(d>0 && nv>regMax()){toast(`营帐上限${regMax()}人/团`);return}
  if(d>0 && poolAvail(u.type)<d){toast('后备不足');return}
  if(nv<=0){S.pool[u.type]=(S.pool[u.type]||0)+u.count;S.formation[row].splice(idx,1);updateUI();return}
  if(d>0){S.pool[u.type]-=d;}
  else if(d<0){S.pool[u.type]=(S.pool[u.type]||0)+(-d);}
  u.count=nv;
  updateUI();
}
function clrForm(){for(const row of['front','mid','back']){for(const u of S.formation[row]){S.pool[u.type]=(S.pool[u.type]||0)+u.count}}S.formation={front:[],mid:[],back:[]};updateUI()}
function useLastFormation(){
  if(!S._lastForm){toast('没有上次阵容记录');return}
  const hasAny=S._lastForm.front.length+S._lastForm.mid.length+S._lastForm.back.length>0;
  if(!hasAny){toast('上次阵容为空');return}
  for(const row of['front','mid','back']){
    for(const u of S.formation[row]){S.pool[u.type]=(S.pool[u.type]||0)+u.count;}
  }
  const newForm={front:[],mid:[],back:[]};
  let shortage=false;
  for(const row of['front','mid','back']){
    for(const u of S._lastForm[row]){
      if(newForm[row].length>=rowSlots(row)){shortage=true;break;}
      const avail=poolAvail(u.type);
      if(avail<=0){shortage=true;continue;}
      const count=Math.min(u.count, avail, regMax());
      if(count<u.count)shortage=true;
      S.pool[u.type]-=count;
      newForm[row].push({type:u.type,count,id:Date.now()+Math.random()});
    }
  }
  S.formation=newForm;
  if(shortage)toast('后备不足，已按可用人数填充');
  save();updateUI();
}

// ==================== 战斗系统 ====================
let battleTimer=null;
let B={};

function selEnemy(idx){
  if(idx!==0&&!S.defeated.includes(CFG.enemies[idx-1]?.id))return;
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
  bmsg('训练开始！木人桩×9 各100HP','#f0d060');
  battleTimer=setTimeout(battleTurn, 600/S.battleSpeed);
}

function openBattle(){
  if(S.selEnemy===null||S.selEnemy===undefined){toast('请先选敌人');return}
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
          icon:cfg.icon, name:cfg.name, spd:cfg.spd, atk:cfg.atk, def:cfg.def});
      }
    }
    const rows=['front','mid','back'];
    for(let i=0;i<9;i++){
      const rowIdx=Math.floor(i/3);
      B.enemyUnits.push({id:uid++, type:'dummy', name:'木人桩', row:rows[rowIdx],
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
}

function drawBattleField(){
  const f=document.getElementById('battle-field');
  const oa=B.ourUnits.filter(u=>u.alive!==false).length;
  const ea=B.enemyUnits.filter(u=>u.alive!==false).length;
  const ohp=B.ourUnits.filter(u=>u.alive!==false).reduce((s,u)=>s+u.hp,0);
  const ehp=B.enemyUnits.filter(u=>u.alive!==false).reduce((s,u)=>s+u.hp,0);
  document.getElementById('battle-title').innerHTML=`${pix('battle','sm')} ${B.enemyCfg.name} | 回合${B.round} | 我方${oa}团${ohp}人 vs ${B.isTraining?'木人桩':'敌方'}${ea}个${B.isTraining?'':'团'+ehp+'人'}`;

  let h='';
  if(B.isTraining){
    h+=`<div class="enemy-zone dummy-zone"><div class="zone-label">${pix('dummy','sm')} 木人桩 (训练目标)</div>`;
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
  return unitType==='archer'||unitType==='mage';
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
    // 远程：60%命中前排（被前线阻挡）
    if(front.length>0 && Math.random()<0.6){
      return front[Math.floor(Math.random()*front.length)];
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
  if(attacker.type==='infantry') atk=Math.floor(atk*1.1);
  if(isOur){
    atk=Math.floor(atk*(1+(B.tactic.atkPct||0)));
    if(attacker.row==='back') atk=Math.floor(atk*(1+(B.tactic.backPct||0)));
  }
  let def=defender.def;
  if(isOur&&B.tactic.defPct)def=Math.floor(def*(1+B.tactic.defPct));
  const isCrit=attacker.type==='spearman'&&Math.random()<0.1;
  const base=attacker.hp*atk/Math.max(1,def)*cmv*mmv*(0.8+Math.random()*0.4);
  const raw=Math.max(1,Math.floor(base));
  return {dmg:isCrit?raw*2:raw, crit:isCrit};
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
  const vfxMap={infantry:'slash',archer:'arrow',spearman:'thrust',cavalry:'slash',mage:'slash'};
  el.className=`vfx vfx-${vfxMap[type]||type}`;
  el.style.left=ax+'px';
  el.style.top=ay+'px';
  layer.appendChild(el);
  el.animate([
    { transform:`rotate(${angle+90}deg)`, offset:0 },
    { transform:`translate(${dx}px,${dy}px) rotate(${angle+90}deg)`, offset:1 }
  ],{duration:dur*1000,easing:'ease-out',fill:'forwards'});
  setTimeout(()=>el.remove(), dur*1000+200);
}

function battleTurn(){
  if(!S.battleActive)return;
  B.round++;
  if(B.round>B.maxRound){endBattle('timeout');return}

  const rows={front:0,mid:1,back:2};
  const all=[];
  for(const u of B.ourUnits) if(u.alive!==false) all.push({...u,side:'our'});
  for(const u of B.enemyUnits) if(u.alive!==false&&u.type!=='dummy') all.push({...u,side:'enemy'});
  for(const a of all){
    if(a.side==='our') a.spd=Math.floor(a.spd*(1+(B.tactic.spdPct||0)));
  }
  all.sort((a,b)=>b.spd-a.spd);

  let idx=0,delay=600/S.battleSpeed;

  function nextAction(){
    if(!S.battleActive)return;
    if(idx>=all.length){
      drawBattleField();
      const oa=B.ourUnits.filter(u=>u.alive!==false).length;
      const ea=B.enemyUnits.filter(u=>u.alive!==false).length;
      if(oa===0){endBattle('lose');return}
      if(ea===0){endBattle('win');return}
      bmsg(`── 回合${B.round}结束 ──`,'#555');
      battleTimer=setTimeout(battleTurn,375/S.battleSpeed);
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

    const archerMiss=isAttackMiss(actor,target);
    const cavDodge=!archerMiss&&target.type==='cavalry'&&actor.type!=='archer'&&Math.random()<0.1;
    const missed=archerMiss||cavDodge;
    const cr=missed?{dmg:0,crit:false}:calcDmg(actor,target,actor.side==='our');
    const dmg=cr.dmg; const isCrit=cr.crit;
    const cmv=cm(actor.type,target.type);
    const mmv=mm(actor.type,target.type);
    const actualKill=missed?0:Math.min(dmg,target.hp);

    if(!missed&&actorEl&&targetEl){
      spawnVFX(actorEl,targetEl,actor.type);
    }

    if(B.isTraining&&actor.side==='our'){
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
        bmsg(`${actor.side==="our"?"[我方]":"[敌方]"}${actor.name} \u2192 ${target.name} MISS${cavDodge?' [\u95ea\u907f]':target.type==='cavalry'?' [\u9a91\u5175\u95ea\u907f]':''}`,'#6f7890');
        idx++;
        drawBattleField();
        nextAction();
        return;
      }

      target.hp-=actualKill;

      if(target.hp<=0){
        target.hp=0;target.alive=false;
        if(targetEl){targetEl.classList.add('dead');setTimeout(()=>{if(targetEl)targetEl.classList.add('dead-done')},500);}
        bmsg(`${actor.side==="our"?"[我方]":"[敌方]"}${actor.name} → ${target.name} 击杀${actualKill}人，${target.name}全灭！`+(isGood?'[克制]':'')+(mmv>1?'[易伤]':''),isGood?'#40bf80':'#e06060');
      }else{
        if(targetEl){targetEl.classList.add('hit');setTimeout(()=>{if(targetEl)targetEl.classList.remove('hit')},400);}
        bmsg(`${actor.side==="our"?"[我方]":"[敌方]"}${actor.name} → ${target.name} 击杀${actualKill}人，${target.name}剩余${target.hp}人`+(isBad?'[劣势]':''),'#888');
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
  h+=`<div style="font-size:10px;color:#888;margin-bottom:8px">回合${B.round} | 击破${B.enemyUnits.filter(u=>u.alive===false).length}/9个木人桩</div>`;
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
      ${hasNext?`<button class="btn btn-go btn-sm" onclick="nextBattle()">下一关</button>`:''}
      <button class="btn btn-go btn-sm" onclick="retryBattle()">重新对战</button>
      <button class="btn btn-ghost btn-sm" onclick="exitBattle()">退出</button>
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
