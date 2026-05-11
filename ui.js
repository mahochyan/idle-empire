// ==================== UI 渲染 ====================
function updateUI(){
  if(S.battleActive)return;
  const cap=storageCapacity();
  const wood=Math.floor(S.res.wood),stone=Math.floor(S.res.stone),food=Math.floor(S.res.food);
  document.getElementById('res-wood').textContent=wood;
  document.getElementById('res-stone').textContent=stone;
  document.getElementById('res-food').textContent=food;
  document.getElementById('res-pop').textContent=popAllocTotal()+'/'+maxPop();
  document.getElementById('cap-wood').textContent='/'+cap;
  document.getElementById('cap-stone').textContent='/'+cap;
  const netFood=prodRate('food')-totalUpkeep()-popAllocTotal()*0.1;
  document.getElementById('cap-food').textContent=(netFood>=0?'+':'')+netFood.toFixed(1)+'/秒';
  document.getElementById('cap-pop').textContent='';
  const woodFull=wood>=cap,stoneFull=stone>=cap,foodFull=food>=cap||(food<=0&&netFood<0);
  document.getElementById('res-wood').style.color=woodFull?'#e06060':'#f0d060';
  document.getElementById('res-stone').style.color=stoneFull?'#e06060':'#f0d060';
  document.getElementById('res-food').style.color=foodFull?'#e06060':'#f0d060';
  const ts=document.getElementById('town-scene');
  if(S.page==='home'){
    ts.style.display='block';
    updateTownScene();
  }else{
    ts.style.display='none';
  }
  renderPage(S.page);
}
function renderPage(p){
  const main=document.getElementById('main');
  const el=document.activeElement;
  if(el&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA')&&main.contains(el))return;
  main.innerHTML={home:rHome,build:rBuild,barracks:rBarracks,fight:rFight,log:rLog}[p]();
}
function rHome(){
  const tc=townCfg();
  const canUp=townCanUpgrade(), upNeed=townUpgradeNeed();
  let h=`<div style="padding:4px 0">`;

  h+=`<div class="card"><h3>${pix("home","card-pix")}${tc.name} <span style="color:#f0d060;font-size:12px">Lv.${tc.lv}</span></h3>`;
  h+=`<div style="font-size:12px;color:#999">人口 ${popAllocTotal()}/${maxPop()} | 空闲 ${popFree()} | 仓库 ${storageCapacity()}</div>`;
  h+=`<div style="font-size:11px;color:#666">击败Boss ${bossDefeatedCount()}/${upNeed}`;
  if(canUp)h+=` <span style="color:#40bf80">可升级 → ${(CFG.town.find(t=>t.lv===S.townLv+1)||{}).name||"?"} (人口${(CFG.town.find(t=>t.lv===S.townLv+1)||{}).maxPop||"?"})</span>`;
  h+=`</div>`;
  if(canUp)h+=`<button class="btn btn-go btn-sm" onclick="upgradeTown()" style="margin-top:4px">${pix("upgrade","mini")}升级城镇</button>`;
  h+=`</div>`;

  h+=`<div class="card"><h3>${pix("pop","card-pix")}人口分配</h3>`;
  for(const[k,c] of Object.entries(CFG.res)){
    const buf=buildingBuff(k);
    const rate=prodRate(k);
    const alloc=S.popAlloc[k]||0;
    h+=`<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px">`;
    h+=`<span style="width:60px">${pix(c.icon,"sm")} ${c.name}</span>`;
    h+=`<button class="btn btn-ghost btn-xs" onclick="setPopAlloc('${k}',(S.popAlloc['${k}']||0)-1)" ${alloc<=0?"disabled":""}>−</button>`;
    h+=`<input type="text" inputmode="numeric" pattern="[0-9]*" value="${alloc}" onchange="setPopAlloc('${k}',parseInt(this.value)||0)" style="width:42px;text-align:center;font-weight:bold;color:#f0d060;background:#080912;border:2px solid #3a4158;font-family:inherit;font-size:12px">`;
    h+=`<button class="btn btn-ghost btn-xs" onclick="setPopAlloc('${k}',(S.popAlloc['${k}']||0)+1)" ${popFree()<=0?"disabled":""}>+</button>`;
    const rawRate=k==='food'?rate-totalUpkeep()-popAllocTotal()*0.1:rate;
    h+=`<span style="color:${rawRate>=0?'#40bf80':'#e06060'};margin-left:auto">${rawRate>=0?'+':''}${rawRate.toFixed(1)}/秒</span>`;
    h+=`<span style="font-size:10px;color:#666">Buff ${buf>0?"+":""}${(buf*100).toFixed(0)}%${k==='food'?' | 口粮 -'+(totalUpkeep()+popAllocTotal()*0.1).toFixed(1):''}</span>`;
    h+=`</div>`;
  }
  h+=`</div>`;

  h+=`<div class="card"><h3>${pix("log","card-pix")}最近事件</h3>`;
  const r=[...S.log].reverse().slice(0,6);
  if(!r.length)h+=`<div style="font-size:11px;color:#666">暂无</div>`;
  else for(const e of r)h+=`<div style="font-size:10px;color:#555;padding:1px 0">[${e.time}] ${e.msg}</div>`;
  h+=`</div></div>`;return h;
}
function renderTownMapOverview(){
  const tc=townCfg();
  const woodWorkers=S.popAlloc.wood||0;
  const stoneWorkers=S.popAlloc.stone||0;
  const foodWorkers=S.popAlloc.food||0;
  const unitTotal=uk=>{
    let n=S.pool[uk]||0;
    for(const row of['front','mid','back']){
      for(const u of S.formation[row]){
        if(u.type===uk)n+=u.count;
      }
    }
    return n;
  };
  const guardCounts=Object.fromEntries(Object.keys(CFG.units).map(k=>[k,unitTotal(k)]));
  const status=Object.values(guardCounts).some(n=>n>0)?'巡逻中':'防务薄弱';
  const troopSummary=Object.entries(CFG.units).map(([k,c])=>`${c.name}${unitTotal(k)}`).join('｜');

  return `<div class="card town-map-card">
    <div class="town-map-head">
      <h3>🏰 城镇巡防</h3>
      <span class="town-map-status">${status}</span>
    </div>
    <div class="town-map" aria-label="城镇巡防地图">
      <div class="town-map-zone town-resource-zone" aria-hidden="true"></div>
      <div class="town-map-zone town-defense-zone" aria-hidden="true"></div>
      <div class="town-map-zone town-frontier-zone" aria-hidden="true"></div>
      <div class="town-road town-road-main"></div>
      <div class="town-road town-road-branch"></div>
      <div class="town-palisade" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="town-gate" aria-hidden="true"></div>
      <div class="town-woods" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="town-stones" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="town-fields" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      ${workerDots('wood',woodWorkers,'wood')}
      ${workerDots('stone',stoneWorkers,'stone')}
      ${workerDots('food',foodWorkers,'food')}
      ${renderTownGuards(guardCounts)}
      <div class="town-building town-hall">
        <span class="town-building-sprite">${mapPix('town_hall','town-building-pix')}</span>
        <span class="town-map-badge town-level-badge">Lv.${tc.lv}</span>
      </div>
      <div class="town-building town-lumber">
        <span class="town-building-sprite">${mapPix('lumber_yard','town-building-pix')}</span>
        <span class="town-map-badge">${woodWorkers>0?`木 ${woodWorkers}`:'空闲'}</span>
      </div>
      <div class="town-building town-quarry">
        <span class="town-building-sprite">${mapPix('quarry_yard','town-building-pix')}</span>
        <span class="town-map-badge">${stoneWorkers>0?`石 ${stoneWorkers}`:'空闲'}</span>
      </div>
      <div class="town-building town-farm">
        <span class="town-building-sprite">${mapPix('farm_yard','town-building-pix')}</span>
        <span class="town-map-badge">${foodWorkers>0?`粮 ${foodWorkers}`:'空闲'}</span>
      </div>
      <div class="town-building town-tower">
        <span class="town-building-sprite">${mapPix('watch_tower','town-building-pix')}</span>
      </div>
    </div>
    <div class="town-troop-summary">驻军：${troopSummary}</div>
  </div>`;
}
function workerDots(resourceKey,assignedCount,type){
  if(assignedCount<=0)return '';
  const count=assignedCount>=16?3:assignedCount>=6?2:1;
  const workClass={wood:'worker-chop',stone:'worker-mine',food:'worker-harvest'}[type]||'worker-harvest';
  let h=`<div class="town-worker-group worker-${type}-group" aria-hidden="true">`;
  for(let i=0;i<count;i++){
    const alt=i%2?'worker-step':workClass;
    h+=`<span class="town-worker worker-${type} ${alt} worker-${resourceKey}-${i+1}"></span>`;
  }
  h+='</div>';
  return h;
}
function renderTownGuards(counts){
  const guards=[
    ['infantry','guard-infantry','guard-patrol'],
    ['archer','guard-archer','guard-watch'],
    ['cavalry','guard-cavalry','guard-ride'],
    ['spearman','guard-spearman','guard-stand'],
    ['mage','guard-mage','guard-pulse']
  ];
  return guards
    .filter(([type])=>(counts[type]||0)>0)
    .slice(0,5)
    .map(([type,cls,anim])=>`<span class="town-guard ${cls} ${anim}" aria-hidden="true">${pix(type)}</span>`)
    .join('');
}
let _townHash='';
function updateTownScene(){
  const woodWorkers=S.popAlloc.wood||0;
  const stoneWorkers=S.popAlloc.stone||0;
  const foodWorkers=S.popAlloc.food||0;
  const unitTotal=uk=>{
    let n=S.pool[uk]||0;
    for(const row of['front','mid','back']){
      for(const u of S.formation[row]){if(u.type===uk)n+=u.count;}
    }
    return n;
  };
  const h=woodWorkers+','+stoneWorkers+','+foodWorkers+','+Object.keys(CFG.units).map(k=>unitTotal(k)).join(',')+','+S.townLv;
  if(h===_townHash)return;
  _townHash=h;
  const html=renderTownMapOverview();
  document.getElementById('town-scene').innerHTML=html;
}
function rBuild(){
  let h=`<div style="padding:4px 0">`;
  for(const[key,cfg] of Object.entries(CFG.buildings)){
    const st=bldSt(key),locked=cfg.needBoss&&bossDefeatedCount()<cfg.needBoss,upLock=st.lv>0?upgradeLockReason(key):'';
    h+=`<div class="card" style="${locked||upLock?'opacity:.7':''}"><h3>`;
    h+=`${pix(key,'card-pix')}${cfg.name}`;if(st.state==='idle'&&st.lv>0)h+=` <span style="color:#f0d060">Lv.${st.lv}</span>`;
    if(key==='barracks')h+=` <span style="font-size:11px;color:#888">(\u51fa\u6218\u4e0a\u9650${regMax()}\u4eba/\u683c${st.lv<=0?'\uff0c\u5efa\u9020\u540e100\u4eba/\u683c':''})</span>`;
    if(key==='warehouse'&&st.state==='idle'&&st.lv>0)h+=` <span style="font-size:11px;color:#f0d060">\u5b58\u50a8\u4e0a\u9650 ${storageCapacity()}</span>`;
    h+=`</h3>`;
    if(cfg.trains){
      const u=CFG.units[cfg.trains],cap=reserveMax(cfg.trains),nextCap=cfg.reserveBase+(Math.max(1,st.lv+1))*cfg.reserveBonus;
      h+=`<div class="build-meta">\u8bad\u7ec3: ${pix(u.icon,'mini')}${u.name} | \u540e\u5907\u4e0a\u9650 ${st.lv>0?cap:0}${st.lv>0?` \u2192 ${nextCap}`:` (\u5efa\u6210\u540e ${nextCap})`}</div>`;
      if(locked)h+=`<div class="build-meta limit-warn">${pix('lock','mini')}\u51fb\u8d25\u7b2c5\u4e2a\u654c\u4eba\u540e\u89e3\u9501</div>`;
    }
    if(cfg.buffRes){
      h+=`<div class="build-meta">${resourceCapText()} | \u51fb\u8d25Boss\u540e\u89e3\u9501\u4e0b\u4e00\u7ea7</div>`;
      if(upLock)h+=`<div class="build-meta limit-warn">${pix('lock','mini')}${upLock}</div>`;
    }
    if(st.state==='idle'){
      if(st.lv===0){
        const c=cfg.build;
        h+=`<div style="font-size:11px;color:#888">\u5efa\u9020: ${costHtml(c)} | ${c.time}\u79d2</div>`;
        h+=`<button class="btn btn-go btn-sm" onclick="buildAct('${key}')" ${locked?'disabled':''}>${pix('build','mini')}\u5efa\u9020</button>`;
      }else{
        if(cfg.buffRes)h+=`<div style="font-size:12px;color:#40bf80">${pix(CFG.res[cfg.buffRes].icon,'sm')} ${CFG.res[cfg.buffRes].name} Buff: +${((bldSt(key).lv*cfg.buffPerLv+cfg.buffBase)*100).toFixed(0)}%</div>`;
        const uc=upCost(key);
        h+=`<div style="font-size:10px;color:#666">\u5347\u7ea7: ${costHtml(uc)} | ${uc.time}\u79d2</div>`;
        h+=`<button class="btn btn-go btn-sm" onclick="buildAct('${key}')" ${upLock?'disabled':''}>${pix('upgrade','mini')}\u5347\u7ea7\u2192Lv.${st.lv+1}</button>`;
      }
    }else{
      const pct=st.timerEnd>0?((st.timerEnd-st.timer)/st.timerEnd*100).toFixed(0):0;
      h+=`<div class="timer-text pulsing">${pix('timer','mini')} ${st.state==='building'?'\u5efa\u9020':'\u5347\u7ea7'}\u4e2d... ${st.timer}\u79d2</div>`;
      h+=`<div class="prog-wrap"><div class="prog-fill" style="width:${pct}%"></div></div>`;
    }
    h+=`</div>`;
  }
  h+=`</div>`;return h;
}
function rBarracks(){
  let h=`<div style="padding:4px 0"><div style="font-size:12px;color:#888;margin:4px 0">\u603b\u5175\u529b ${totalSoldiers()} | \u8425\u5e10\u4e0a\u9650 ${regMax()}\u4eba/\u56e2</div>`;
  for(const[k,c] of Object.entries(CFG.units)){
    const ow=S.pool[k]||0,lock=trainLockReason(k);
    const tm=maxTrainable(k),disabled=tm<=0?'disabled':'',muted=lock?'opacity:.55':'';
    h+=`<div class="card" style="${muted}">
      <div style="display:flex;align-items:center;gap:8px">
        <span>${pix(c.icon,'lg')}</span>
        <div style="flex:1;min-width:0"><strong style="cursor:pointer" onclick="openUnitDetail('${k}')">${c.name}</strong> <span style="font-size:10px;color:#888">[${c.race}]</span>
          <div style="font-size:10px;color:#777"><span onclick="event.stopPropagation();openUnitDetail('${k}')" style="font-size:9px;padding:1px 5px;border:1px solid #3a4158;border-radius:0;color:#8890a6;cursor:pointer;display:inline-block;margin-right:4px">属性</span>${c.passive} | ATK:${c.atk} DEF:${c.def}</div>
          <div style="font-size:10px;color:#666">${costHtml(c.cost)}/\u4eba</div>
          <div class="econ-note">${trainBuildingLabel(k)} | ${reserveHtml(k)}${queueTotal(k)>0?` | 队列 ${queueTotal(k)}人 <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();cancelQueue('${k}')" style="margin-left:4px">取消</button>`:''}${(S.queue[k]||{}).reason?`<br><span class="limit-warn">${pix('lock','mini')}${S.queue[k].reason}</span>`:``}${lock?`<br><span class="limit-warn">${pix('lock','mini')}${lock}</span>`:''}</div>
          <div style="font-size:11px;color:#40bf80">\u540e\u5907:${ow}\u4eba</div>
          ${lock?'':
          `<div class="train-custom">
            <input id="train-barracks-${k}" type="text" inputmode="numeric" pattern="[0-9]*" value="${(S._trainQty||{})[k]||1}" oninput="(S._trainQty||{})['${k}']=parseInt(this.value)||1">
            <button class="btn btn-go btn-xs" onclick="trainCustom('${k}','train-barracks-${k}')" ${disabled}>\u8bad\u7ec3</button>
            <button class="btn btn-ghost btn-xs" onclick="trainMax('${k}','train-barracks-${k}')" ${disabled}>MAX</button>
            <button class="btn btn-danger btn-xs" onclick="dismissN('${k}',(S._trainQty||{})['${k}']||1)">\u5220\u9664</button>
          </div>`}
        </div>
      </div></div>`;
  }
  h+=`</div>`;return h;
}
function rFight(){
  let h=`<div style="padding:4px 0"><div class="card"><h3>${pix('army','card-pix')}出战阵容 [营帐] (${formCnt()}/${formSlots()}团 | 上限${regMax()}人/团)</h3>`;
  const rs=[{k:'front',n:'前排(承伤)',c:'r1'},{k:'mid',n:'中排(输出)',c:'r2'},{k:'back',n:'后排(远程)',c:'r3'}];
  for(const r of rs){
    h+=`<div class="form-row ${r.c}"><div class="ftitle">${r.n} (${S.formation[r.k].length}/${rowSlots(r.k)})</div>`;
    if(!S.formation[r.k].length){
      h+=`<span class="form-slot" onclick="openFormModal('${r.k}',0)">+ 空位</span>`;
    }else{
      S.formation[r.k].forEach((u,i)=>{
        const da=deployAvail(u.type);
        const mx=Math.min(da, regMax()-u.count);
        h+=`<span class="form-slot filled" style="position:relative">
          <span onclick="rmForm('${r.k}',${i})" style="position:absolute;top:-6px;right:-4px;cursor:pointer;z-index:1">${pix('close','mini')}</span>
          <div onclick="openFormModal('${r.k}',${i})">${pix(CFG.units[u.type].icon,'sm')}${CFG.units[u.type].name}<br>
          <span style="font-size:10px;color:#f0d060">${u.count}人</span></div>
          <div class="qty-ctrl" style="margin-top:3px;gap:2px;justify-content:center">
            <button onpointerdown="startLongPress('${r.k}',${i},-1)" onpointerup="stopLongPress()" onpointerleave="stopLongPress()" onpointercancel="stopLongPress()" style="width:24px;height:24px;border-radius:50%;border:1px solid #555;background:#1a1a2e;color:#e0e0e0;font-size:14px;cursor:pointer;touch-action:manipulation">−</button>
            <span style="min-width:24px;font-size:12px;color:#f0d060">${u.count}</span>
            <button onpointerdown="startLongPress('${r.k}',${i},1)" onpointerup="stopLongPress()" onpointerleave="stopLongPress()" onpointercancel="stopLongPress()" style="width:24px;height:24px;border-radius:50%;border:1px solid #555;background:#1a1a2e;color:#e0e0e0;font-size:14px;cursor:pointer;touch-action:manipulation">+</button>
          </div>
          <div style="margin-top:3px;display:flex;gap:3px;justify-content:center">
            ${mx>0?`<span onclick="event.stopPropagation();adjForm('${r.k}',${i},${mx})" style="font-size:9px;padding:2px 6px;border:1px solid #40bf80;background:#1a2e1a;color:#40bf80;cursor:pointer">MAX</span>`:''}
            <span onclick="event.stopPropagation();rmForm('${r.k}',${i})" style="font-size:9px;padding:2px 6px;border:1px solid #e06060;background:#2e1a1a;color:#e06060;cursor:pointer">移除</span>
          </div></span>`;
      });
      if(S.formation[r.k].length<rowSlots(r.k))h+=`<span class="form-slot" onclick="openFormModal('${r.k}',${S.formation[r.k].length})">+ 空位</span>`;
    }
    h+=`</div>`;
  }
  h+=`<button class="btn btn-go btn-sm" onclick="useLastFormation()">使用上次阵容</button>
  <button class="btn btn-ghost btn-sm" onclick="clrForm()">清空阵容</button></div>`;
  h+=`<div class="card"><h3>${pix('enemy','card-pix')}敌人 — 第${S.defeated.length+1}层</h3>`;
  const cur=S.defeated.length;
  for(let i=cur;i<=cur+1&&i<CFG.enemies.length;i++){
    const e=CFG.enemies[i],df=S.defeated.includes(e.id),av=i===cur;
    const enemyInfo=Object.entries(e.units).map(([k,counts])=>{const t=counts.reduce((a,b)=>a+b,0);return `${pix(CFG.units[k].icon,'mini')}${CFG.units[k].name}×${t}`;}).join(' ');
    h+=`<div style="padding:6px 0;border-bottom:1px solid #1e1e2e;${av?'cursor:pointer;':''}opacity:${av?'1':'.55'};${S.selEnemy===i?'background:#1e1e2e;margin:0 -12px;padding:6px 12px;border-radius:4px':''}" ${av?`onclick="selEnemy(${i})"`:''}>
      <strong>${i===cur?'当前敌人':'下一层'}：${e.name}</strong> ${df?pix('check','mini'):''} ${e.boss?pix('boss','mini'):''}
      <div style="font-size:10px;color:#777">${e.desc} [${enemyInfo}]</div>
    </div>`;
  }
  if(cur>=CFG.enemies.length)h+=`<div style="color:#40bf80;text-align:center;padding:10px">全部通关！</div>`;
  h+=`</div><button class="btn btn-go" style="width:100%;margin-top:8px;padding:12px;font-size:15px" onclick="openBattle()">${pix('battle','sm')}开战</button></div></div>`;
  return h;
}
function rLog(){
  let h=`<div style="padding:4px 0"><div class="card"><h3>${pix('log','card-pix')}事件日志</h3><div style="max-height:500px;overflow-y:auto;font-size:11px;line-height:1.8">`;
  const l=[...S.log].reverse();
  if(!l.length)h+=`<div style="color:#666">暂无</div>`;
  else for(const e of l)h+=`<span style="color:#555">[${e.time}]</span> ${e.msg}<br>`;
  h+=`</div></div>
  <div class="card"><h3>${pix('build','card-pix')}测试工具</h3>
    <div class="train-custom" style="margin:4px 0"><span style="width:40px">木材</span><input id="test-wood" type="text" inputmode="numeric" pattern="[0-9]*" value="100" style="width:70px"><button class="btn btn-go btn-xs" onclick="addRes('wood','test-wood')">添加</button></div>
    <div class="train-custom" style="margin:4px 0"><span style="width:40px">石料</span><input id="test-stone" type="text" inputmode="numeric" pattern="[0-9]*" value="100" style="width:70px"><button class="btn btn-go btn-xs" onclick="addRes('stone','test-stone')">添加</button></div>
    <div class="train-custom" style="margin:4px 0"><span style="width:40px">食物</span><input id="test-food" type="text" inputmode="numeric" pattern="[0-9]*" value="100" style="width:70px"><button class="btn btn-go btn-xs" onclick="addRes('food','test-food')">添加</button></div>
  </div>
  <button class="btn btn-danger btn-sm" onclick="if(confirm('重置?')){localStorage.clear();location.reload()}">${pix('reset','mini')}重置</button></div>`;
  return h;
}

function addLog(msg){S.log.push({time:new Date().toLocaleTimeString(),msg});if(S.log.length>200)S.log.splice(0,S.log.length-200)}
function toast(msg){const e=document.createElement('div');e.className='toast';e.textContent=msg;document.body.appendChild(e);setTimeout(()=>e.remove(),2000)}

// 长按加速
let _lpTimer=null,_lpRow=null,_lpIdx=null,_lpDir=null;
function startLongPress(row,idx,dir){
  _lpRow=row;_lpIdx=idx;_lpDir=dir;
  adjForm(row,idx,dir);
  _lpTimer=setTimeout(()=>{
    _lpTimer=setInterval(()=>{adjForm(row,idx,dir);},80);
  },400);
}
function stopLongPress(){
  if(_lpTimer){clearTimeout(_lpTimer);clearInterval(_lpTimer);_lpTimer=null;}
  _lpRow=_lpIdx=_lpDir=null;
}

let _modalLpTimer=null;
function startModalLongPress(dir){
  adjQty(dir);
  stopModalLongPress();
  _modalLpTimer=setTimeout(()=>{
    _modalLpTimer=setInterval(()=>adjQty(dir),80);
  },400);
}
function stopModalLongPress(){
  if(_modalLpTimer){
    clearTimeout(_modalLpTimer);
    clearInterval(_modalLpTimer);
    _modalLpTimer=null;
  }
}

// ==================== 导航 ====================
document.querySelectorAll('.nav-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');S.page=b.dataset.page;updateUI();
  });
});

// ==================== init ====================
injectPixelIcons();
load();
if(S.defeated.length<CFG.enemies.length&&S.selEnemy===null)S.selEnemy=S.defeated.length;
if(S.selEnemy===null)S.selEnemy=CFG.enemies.length-1;
updateUI();
setInterval(tick,CFG.tickMs);
addLog('欢迎！');
