// ==================== UI 渲染 ====================
// IE-007：资源增减直观反馈（CSS-only 浮泡+闪色；首帧建立基线不闪）
let _prevResUI=null;
function compactUiNumber(value){
  const n=Number(value)||0,abs=Math.abs(n);
  const scaled=abs>=1e8?[n/1e8,'亿']:abs>=1e4?[n/1e4,'万']:null;
  return scaled?Number(scaled[0].toFixed(Math.abs(scaled[0])>=100?0:1))+scaled[1]:String(Math.floor(n));
}
function flashRes(el,rk,d){
  const cell=el.closest?el.closest('.top-res'):null;if(!cell)return;
  let dt=cell.querySelector('.res-delta');
  if(!dt){dt=document.createElement('span');dt.className='res-delta';cell.appendChild(dt)}
  const absolute=Math.abs(d);
  dt.textContent=(d>0?'+':'−')+(absolute>=1e4?compactUiNumber(absolute):absolute>=100?String(Math.floor(absolute)):absolute.toFixed(1));
  dt.classList.remove('up','down');void dt.offsetWidth;
  dt.classList.add(d>0?'up':'down');
  el.classList.remove('up','down');void el.offsetWidth;
  el.classList.add(d>0?'up':'down');
}
function updateUI(){
  if(S.battleActive)return;
  const woodCap=resCap('wood'),stoneCap=resCap('stone');
  const foodCap=resCap('food');
  const wood=Math.floor(S.res.wood),stone=Math.floor(S.res.stone),food=Math.floor(S.res.food);
  document.getElementById('res-wood').textContent=wood;
  document.getElementById('res-stone').textContent=stone;
  document.getElementById('res-food').textContent=food;
  document.getElementById('res-tech').textContent=Math.floor(S.res.tech||0);
  const showSilver=scienceUnlocked('sci_silver')||(S.res.silver||0)>0||(S.res.silverCoin||0)>0;
  for(const rk of ['silver','silverCoin'])document.getElementById('top-'+rk).style.display=showSilver?'':'none';
  const showGold=scienceUnlocked('sci_gold')||(S.res.gold||0)>0;
  document.getElementById('top-gold').style.display=showGold?'':'none';
  document.getElementById('top-goldCoin').style.display=showGold||(S.res.goldCoin||0)>0?'':'none';
  const showSteel=scienceUnlocked('sci_steel')||(S.res.steel||0)>0;
  document.getElementById('top-steel').style.display=showSteel?'':'none';
  const showMedal=scienceUnlocked('sci_electric_age')||(S.res.medal||0)>0;
  document.getElementById('top-medal').style.display=showMedal?'':'none';
  document.getElementById('resource-loot-group').hidden=!(S.res.bone>0||S.res.hide>0);
  const medal=S.res.medal||0;
  document.getElementById('res-medal').textContent=medal>=1e8?(medal/1e8).toFixed(1)+'亿':medal>=1e4?(medal/1e4).toFixed(1)+'万':String(medal);
  document.getElementById('medal-label').textContent=resourceDisplayName('medal');
  document.getElementById('top-medal').title=`${resourceDisplayName('medal')} ${medal} / ${resCap('medal')}`;
  document.getElementById('cap-medal').textContent='';
  for(const rk of ['coal','copper','iron','silver','gold','steel','silverCoin']){
    const stock=Math.floor(S.res[rk]||0),limit=Math.floor(resCap(rk));
    const valueEl=document.getElementById('res-'+rk),capEl=document.getElementById('cap-'+rk);
    if(valueEl){valueEl.textContent=stock;valueEl.style.color=stock>=limit?'#e06060':'#f0d060';}
    if(capEl)capEl.textContent='/'+limit;
  }
  document.getElementById('res-coin').textContent=Math.floor(S.res.coin||0);
  document.getElementById('coin-label').textContent=resourceDisplayName('coin');
  // IE-007：增减气泡/闪色（对比上一帧；首帧仅建基线）
  if(_prevResUI){for(const rk of Object.keys(CFG.res)){const el=document.getElementById('res-'+rk);if(!el)continue;const d=(S.res[rk]||0)-(_prevResUI[rk]||0);if(d!==0)flashRes(el,rk,d);}}
  _prevResUI={};for(const rk of Object.keys(CFG.res))_prevResUI[rk]=S.res[rk]||0;
  document.getElementById('res-pop').textContent=popCurrent()+'/'+maxPop();
  document.getElementById('cap-wood').textContent='/'+woodCap;
  document.getElementById('cap-stone').textContent='/'+stoneCap;
  const netFood=Math.max(0,productionSecond(1,false).food)-S.res.food;
  const capFoodEl=document.getElementById('cap-food');
  capFoodEl.textContent=(netFood>=0?'+':'')+netFood.toFixed(1)+'/秒';
  capFoodEl.title='食物库存上限 '+foodCap;
  capFoodEl.style.color=netFood<0?'#e06060':'';
  document.getElementById('cap-pop').textContent='空闲 '+popFree();
  const woodFull=wood>=woodCap,stoneFull=stone>=stoneCap,foodFull=food>=foodCap||(food<=0&&netFood<0);
  document.getElementById('res-wood').style.color=woodFull?'#e06060':'#f0d060';
  document.getElementById('res-stone').style.color=stoneFull?'#e06060':'#f0d060';
  document.getElementById('res-food').style.color=foodFull?'#e06060':'#f0d060';
  for(const [rk,cfg] of Object.entries(CFG.res)){
    const value=document.getElementById('res-'+rk);if(!value)continue;
    const stock=Math.floor(S.res[rk]||0),cap=resCap(rk),cell=value.closest('.top-res');
    value.textContent=compactUiNumber(stock);
    if(cell){
      cell.title=`${resourceDisplayName(rk)} ${stock.toLocaleString('zh-CN')} / ${Math.floor(cap).toLocaleString('zh-CN')}`;
      cell.classList.toggle('is-full',stock>=cap);
      cell.classList.toggle('is-depleting',rk==='food'&&netFood<0);
    }
    const capacity=document.getElementById('cap-'+rk);
    if(capacity&&rk!=='food')capacity.textContent='/'+compactUiNumber(cap);
  }
  // 切片16-UI：#town-scene 已移入 #main（滚动流内）。renderPage 内部负责：重建后插回保留节点并填充
  renderPage(S.page);
}
const _pageDisclosureState=new Map();
function renderPage(p){
  const main=document.getElementById('main');
  const el=document.activeElement;
  if(el&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.tagName==='SELECT')&&main.contains(el))return;
  if(document.getElementById('population-action-modal')?.classList.contains('active'))return;
  const previousPage=main.dataset.page,scrollTop=main.scrollTop;
  if(previousPage)_pageDisclosureState.set(previousPage,new Map(
    [...main.querySelectorAll('details[id]')].map(detail=>[detail.id,detail.open])));
  document.querySelectorAll('#navbar .nav-btn').forEach(button=>{
    const active=button.dataset.page===p;
    button.classList.toggle('on',active);
    if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });
  if(p!=='home'&&_townSceneNode){
    if(_townMapResizeObserver){_townMapResizeObserver.disconnect();_townMapResizeObserver=null;}
    if(window.HD2D)window.HD2D.disposeTown();
    _townSceneNode=null;
    _townHash='';
  }
  if(p!=='home')main.classList.remove('town-expanded');
  // #town-scene（巡防地图）**跨重渲染保留节点**——innerHTML 重建会销毁它：
  // 先捕获、重建后插回首位。保证：①随页面滚动 ②动画不因每秒重建而重置 ③hash 守卫继续生效
  let keepScene=null;
  if(p==='home'){
    if(!_townSceneNode){_townSceneNode=document.getElementById('town-scene')||document.createElement('div');_townSceneNode.id='town-scene';}
    _townSceneNode.style.display='block';
    keepScene=_townSceneNode;
  }
  main.innerHTML={home:rHome,build:rBuild,barracks:rBarracks,fight:rFight,tech:rTech,log:rLog}[p]();
  main.dataset.page=p;
  const disclosure=_pageDisclosureState.get(p);
  for(const detail of main.querySelectorAll('details[id]'))
    if(disclosure?.has(detail.id))detail.open=disclosure.get(detail.id);
  if(keepScene){main.insertBefore(keepScene,main.firstChild);updateTownScene();}
  main.scrollTop=previousPage===p?scrollTop:0;
}
function selectDevelopmentSiteFromUI(site){
  const result=selectDevelopmentSite(site);
  if(!result.ok)toast(({ 'site-locked':'尚未占领该采集点',
    'offline-transition':'请先完成历史离线结算',
    'save-failed':'保存失败，采集点未切换',
    'save-protected':'当前存档受保护，请先导出存档',
    busy:'当前无法切换采集点'})[result.reason]||'采集点暂不可选');
  return result;
}
function metalUiNumber(value){return Number((value||0).toFixed(2)).toString()}
function metalUiInputs(rk){
  const inputs=workerRecipeInputs(rk);
  return Object.entries(inputs||{}).map(([key,amount])=>`${CFG.res[key]?.name||key} ${metalUiNumber(amount)}`).join(' + ')||'无原料消耗';
}
function workerRecipeInputs(rk){
  const inputs=typeof metalConsumeMap==='function'?metalConsumeMap(rk):(CFG.res[rk]?.consumes||{});
  const coalRecipe=S.metalRecipeMode==='coal'&&CFG.metalChain?.recipes?.[rk];
  const building=CFG.res[rk]?.workerBuilding;
  return Object.fromEntries(Object.entries(inputs||{}).map(([key,amount])=>
    [key,coalRecipe?amount:((building&&effConsume(building,key))??amount)]));
}
function metalCapAfterSwitch(rk){
  const cfg=CFG.metalChain||{};
  const storeKey=cfg.stores?.[rk];
  return (cfg.baseStorage||0)+(cfg.storagePerLv||0)*(storeKey?bldSt(storeKey).lv:0);
}
function metalSwitchWarning(){
  const lines=['铜：旧配方无原料 → 石料／矿石 2 + 煤 2，每工每秒产 1',
    '铁：旧配方每工每秒耗铜 3 → 石料／矿石 2 + 煤 1，每工每秒产 0.5',
    '切换仅向煤链进行一次，不能再切回旧配方。'];
  for(const rk of ['copper','iron']){
    const stock=metalUiNumber(S.res[rk]||0),oldCap=metalUiNumber(resCap(rk)),newCap=metalUiNumber(metalCapAfterSwitch(rk));
    const over=Math.max(0,(S.res[rk]||0)-metalCapAfterSwitch(rk));
    lines.push(`${CFG.res[rk].name}：库存 ${stock}，上限 ${oldCap} → ${newCap}${over>0?`；高于新上限 ${metalUiNumber(over)}`:''}`);
  }
  lines.push('超仓库存会保留；低于新上限前无法继续生产该资源。确定切换吗？');
  return lines.join('\n');
}
function requestMetalRecipeSwitch(){
  if(S.metalRecipeMode!=='legacy'||typeof switchMetalRecipeMode!=='function')return;
  if(!confirm(metalSwitchWarning()))return;
  const result=switchMetalRecipeMode();
  if(result?.ok){toast('已切换至煤矿冶炼，旧库存保持不变');updateUI();}
  else{
    const reason={
      'save-protected':'存档保护中，无法切换',
      'need-sci-coal':'请先研究煤炭开采',
      'already-coal':'当前已是煤链配方',
      'save-failed':'保存失败，旧配方和库存保持不变'
    }[result?.reason]||'切换失败，旧配方和库存保持不变';
    toast(reason);
  }
}
function renderMetalModeCard(){
  if(!CFG.metalChain)return '';
  const legacy=S.metalRecipeMode==='legacy';
  const modeName=CFG.metalChain.modeNames?.[legacy?'legacy':'coal']||(legacy?'旧配方':'煤矿冶炼');
  let h=`<div class="card"><h3>${pix('coal','card-pix')}矿煤冶炼 <span style="font-size:10px;color:#f0d060">${modeName}</span></h3>`;
  h+=`<div style="font-size:10px;color:#999">${legacy?'旧配方中石料用于建造；切换后石料／矿石会与冶炼共用库存。':'石料／矿石共用同一库存，建造与冶炼会争用。'}煤、铜、铁各有独立上限。</div>`;
  h+=`<div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin:6px 0;font-size:11px">`;
  for(const rk of ['coal','copper','iron']){
    const stock=S.res[rk]||0,cap=resCap(rk);
    h+=`<span style="color:${stock>=cap?'#e0b060':'#b8c0cf'}">${pix(CFG.res[rk].icon,'mini')}${CFG.res[rk].name} ${metalUiNumber(stock)}/${metalUiNumber(cap)}</span>`;
  }
  h+=`</div><div style="font-size:10px;color:#aeb6c9">铜：${metalUiInputs('copper')}；铁：${metalUiInputs('iron')}（每工每秒）</div>`;
  if(legacy){
    const coalReady=S.sciences.includes('sci_coal');
    h+=`<div style="font-size:10px;color:#d0a870;margin-top:6px">历史存档沿用旧配方：铜、铁须先建矿井／冶炼厂派工，铜铁仍按旧仓容结算。研究煤后可主动切换；专仓建好后在煤链中生效。</div>`;
    for(const rk of ['copper','iron']){
      const stock=S.res[rk]||0,nextCap=metalCapAfterSwitch(rk);
      h+=`<div style="font-size:10px;color:${stock>nextCap?'#e0b060':'#999'};margin-top:3px">${CFG.res[rk].name}库存 ${metalUiNumber(stock)}；上限 ${metalUiNumber(resCap(rk))} → ${metalUiNumber(nextCap)}${stock>nextCap?`，超出新上限 ${metalUiNumber(stock-nextCap)}`:''}</div>`;
    }
    h+=`<div style="font-size:10px;color:#999;margin-top:3px">超仓库存保留，但低于新上限前暂停新增产出；切换后不能恢复旧配方。</div>`;
    h+=`<button class="btn btn-go btn-xs" style="margin-top:6px" onclick="requestMetalRecipeSwitch()" ${!coalReady||saveProtected()?'disabled':''}>一次性切换煤链</button>`;
    if(!coalReady)h+=`<span style="font-size:10px;color:#999;margin-left:6px">需先研究「${esc(sciName('sci_coal'))}」</span>`;
  }else{
    h+=`<div style="font-size:10px;color:#999;margin-top:5px">煤、铜、铁岗位由研究开放；煤井、矿井、冶炼厂提高产率，专仓完工后分别扩容。</div>`;
  }
  return h+'</div>';
}
// ==================== 主页渲染 ====================
function renderWorkerResource(key,cfg,nextSecond){
  const lock=workerLockReason(key),alloc=S.popAlloc[key]||0,buf=buildingBuff(key);
  const stock=S.res[key]||0,cap=resCap(key),rate=prodRate(key);
  const processed=['copper','iron','silver','gold','steel','coin','silverCoin','goldCoin'].includes(key);
  const net=key==='food'?Math.max(0,nextSecond.food)-stock:(nextSecond[key]||0)-stock;
  const inputs=processed?workerRecipeInputs(key):{};
  const room=Math.max(0,cap-stock);
  let warning=lock||'';
  if(alloc>0&&!lock&&room<=0)warning=processed?'成品满仓，暂停加工':'库存已满，产出受仓容限制';
  else if(processed&&alloc>0&&!lock&&(S.metalRecipeMode==='coal'||['coin','silverCoin','goldCoin'].includes(key))&&net+1e-8<Math.min(rate,room))
    warning='原料不足或被前序岗位占用';
  let h=`<article id="worker-${key}" class="worker-resource${lock?' is-locked':''}">
    <div class="worker-resource-head"><span class="worker-resource-name">${pix(cfg.icon,'sm')}${esc(resourceDisplayName(key))}</span>
      <span class="worker-stock" title="库存 ${metalUiNumber(stock)} / ${metalUiNumber(cap)}">${stock>=1e4?compactUiNumber(stock):metalUiNumber(stock)}<small> / ${compactUiNumber(cap)}</small></span></div>
    <div class="worker-resource-body"><div class="worker-controls" aria-label="${esc(resourceDisplayName(key))}工人分配">
      <button class="btn btn-ghost btn-xs" aria-label="${esc(resourceDisplayName(key))}减少工人" onclick="setPopAlloc('${key}',(S.popAlloc['${key}']||0)-1)" ${alloc<=0?'disabled':''}>−</button>
      <span class="worker-allocation">${alloc}<small>人</small></span>
      <button class="btn btn-ghost btn-xs" aria-label="${esc(resourceDisplayName(key))}增加工人" onclick="setPopAlloc('${key}',(S.popAlloc['${key}']||0)+1)" ${popFree()<=0||lock?'disabled':''}>+</button></div>
      <div class="worker-rate${net<0?' is-negative':''}"><strong>${net>=0?'+':''}${net.toFixed(1)}</strong><small> / 秒</small></div></div>
    <div class="worker-resource-note"><span>产出增益 ${buf>0?'+':''}${(buf*100).toFixed(0)}%</span>${key==='food'?`<span>基础粮耗 ${(totalUpkeep()+popCurrent()*(CFG.popFoodCost??0.1)).toFixed(1)}/秒</span>`:''}${key==='stone'?'<span>建造与冶炼共用</span>':''}</div>`;
  if(warning)h+=`<div class="worker-warning">${esc(warning)}</div>`;
  if(processed)h+=`<details id="worker-recipe-${key}" class="worker-recipe"><summary>加工配方</summary><div>每工每秒投入：${esc(metalUiInputs(key))}${alloc>0&&Object.keys(inputs).length?`<br>${alloc}人共需：${esc(Object.entries(inputs).map(([input,n])=>`${resourceDisplayName(input)} ${metalUiNumber(n*alloc)}`).join(' + '))}`:''}</div></details>`;
  return h+'</article>';
}
function renderResourceManagement(){
  const nextSecond=productionSecond(1,false),ready=[],locked=[];
  for(const [key,cfg] of Object.entries(CFG.res)){
    if(!isWorkerResource(key))continue;
    const row=renderWorkerResource(key,cfg,nextSecond);
    (workerLockReason(key)&&!(S.popAlloc[key]>0)&&!(S.res[key]>0)?locked:ready).push(row);
  }
  return `<section id="town-workers" class="resource-management"><div class="ui-section-heading"><div><h2>生产与库存</h2><p>安排村民，查看每秒净变化</p></div><span class="ui-count-badge">空闲 ${popFree()}人</span></div>
    <div class="resource-production-list">${ready.join('')}</div>
    ${locked.length?`<details id="worker-locked" class="ui-disclosure"><summary><span>待解锁岗位</span><small>${locked.length}项</small></summary><div class="resource-production-list">${locked.join('')}</div></details>`:''}
    <p class="resource-net-note">净变化已计加工扣料与仓容；满仓后新增产出会受限。</p></section>`;
}
function rHome(){
  const tc=townCfg();
  let h=`<div style="padding:4px 0">`;
  const tu=S.townUpgrade;
  if(saveProtected())h+=`<div class="card" style="border-color:#7a3040"><div style="font-size:11px;color:#e06060">⚠ 存档保护模式：${esc(saveProtectReason())}</div><button class="btn btn-ghost btn-xs" style="margin-top:4px" onclick="openSettings()">前往设置处理</button></div>`;
  // 切片11：离线结算报告卡（展示后由玩家清空；只展示一次、不二次发奖）
  if(S.offline&&S.offline.pendingReport){
    const r=S.offline.pendingReport, m=Math.floor((r.durationSec||0)/60), s=(r.durationSec||0)%60;
    const gainStr=Object.keys(r.gains||{}).map(k=>`${pix(CFG.res[k]?.icon||k,'mini')}${CFG.res[k]?.name||k} ${r.gains[k]<0?'−':'+'}${Math.abs(Math.round(r.gains[k]))}`).join(' ')||'（无净收益）';
    h+=`<div class="card" style="border-color:#3a6a4a"><div style="font-size:12px;color:#78d0a0">离线结算：${m}分${s}秒${r.truncated?'（已截断）':''}</div>
      <div style="font-size:11px;color:#c8c8c8;margin-top:4px">${gainStr}</div>
      ${r.populationFoodRule==='legacy'?'<div style="font-size:10px;color:#a0c8a8;margin-top:3px">历史存档首次结算：人口口粮按旧岗位人数计算</div>':''}
      ${r.reason?`<div style="font-size:10px;color:#888;margin-top:3px">${esc(r.reason)}</div>`:''}
      <button class="btn btn-ghost btn-xs" style="margin-top:4px" onclick="dismissOfflineReport()">知道了</button></div>`;
  }

  // 聚落扩容与实际人口：旧城镇等级只在迁移进度中展示，人口容量由聚落提供。
  h+=`<div class="card" id="town-population">`;
  h+=`<h3 style="display:flex;justify-content:space-between;align-items:center">`;
  h+=`<span>${pix("home","card-pix")}聚落与村民</span>`;
  h+=`<span style="font-size:11px;color:#f0d060">人口 ${popCurrent()}/${maxPop()}</span>`;
  h+=`</h3>`;
  h+=`<div class="population-overview"><span>已分配<strong>${popAllocTotal()}</strong></span><span>空闲村民<strong>${popFree()}</strong></span><span>人口上限<strong>${maxPop()}</strong></span></div>`;
  if((S.population?.legacyBonus||0)>0||tu)h+=`<div style="font-size:10px;color:#999;margin-bottom:4px">旧城镇进度：${esc(tc.name)} Lv.${tc.lv}（原有容量已保留）</div>`;
  if(popCurrent()>maxPop()||popAllocTotal()>popCurrent())h+=`<div style="font-size:10px;color:#e0b060;margin-bottom:4px">历史人口或分配超过当前容量，数据已保留；扩容或调配后可继续安排工人。</div>`;
  if(tu){
    const pct=Math.floor((1-tu.timer/tu.timerEnd)*100);
    h+=`<div style="font-size:10px;color:#e0b060">旧城镇升级仍在进行，完成后保留原有容量。</div>`;
    h+=`<div class="prog-wrap"><div class="prog-fill" style="width:${pct}%"></div></div>`;
  }
  const growthClock=S.population?.growthClock||0;
  const growthText=popCurrent()>=maxPop()?'人口已达上限，扩建聚落后继续增长':S.res.food<=0?'粮食不足，人口增长暂停':`在线每 10 秒增加 ${popGrowthPer10s()} 人（${growthClock}/10 秒）；离线不增长`;
  h+=`<div style="font-size:10px;color:${S.res.food<=0?'#e0b060':'#8daabb'};margin:5px 0">${growthText}</div>`;
  const policySlots=S.settlements.smallTown||0,birthSlots=birthPolicyCount();
  if(policySlots>0||S.sciences.includes('sci_birth_policy')){
    const policies=S.townPolicies.smallTown;
    let emptySlot=-1,lastBirth=-1;
    for(let i=0;i<policySlots;i++){if(policies[i]==='birth')lastBirth=i;else if(emptySlot<0)emptySlot=i;}
    const unlocked=S.sciences.includes('sci_birth_policy');
    h+=`<div style="font-size:10px;color:#aab4c4;margin:6px 0">小镇政策 · 鼓励生育 ${birthSlots}/${policySlots} 位；每位 +${CFG.pop.birthPolicyPer10s} 人/10在线秒${unlocked?'':' · 需先研究「鼓励生育」'}</div>`;
    if(emptySlot>=0)h+=`<button class="btn btn-go btn-xs" onclick="setSmallTownPolicy(${emptySlot},'birth')" ${unlocked&&!_saveProtected?'':'disabled'}>第${emptySlot+1}位推行鼓励生育</button>`;
    if(lastBirth>=0)h+=` <button class="btn btn-ghost btn-xs" onclick="setSmallTownPolicy(${lastBirth},null)" ${_saveProtected?'disabled':''}>撤销第${lastBirth+1}位</button>`;
  }
  h+=`<details id="settlement-expansion" class="ui-disclosure"><summary><span>聚落扩容</span><small>地契 ${compactUiNumber(S.res.deed||0)}</small></summary>`;
  for(const[key,name,gain] of [['village','村庄',1],['smallTown','小镇',2],['city','城市',4]]){
    const lv=S.settlements?.[key]||0, cost=settlementCost(key), reason=settlementLockReason(key);
    h+=`<div style="display:flex;align-items:center;gap:5px;padding:4px 0;border-bottom:1px solid #1e1e2e;font-size:11px">`;
    h+=`<span style="min-width:56px;color:#d0d0d8">${name} Lv.${lv}</span>`;
    h+=`<span style="flex:1;color:#999">每级 +${gain} 上限 · ${cost} 地契</span>`;
    h+=`<button class="btn btn-go btn-xs" onclick="upgradeSettlement('${key}',${lv})" ${reason?'disabled':''}>扩建</button></div>`;
    if(reason)h+=`<div style="font-size:10px;color:#888;padding:0 0 4px 2px">${esc(reason)}</div>`;
  }
  h+=`<div class="population-batch-tools">
    <div class="population-batch-title">多级扩建 · 逐级计价，先预览再确认</div>
    <div class="population-batch-controls">
      <select id="settlement-batch-kind" aria-label="选择聚落"><option value="village">村庄</option><option value="smallTown">小镇</option><option value="city">城市</option></select>
      <input id="settlement-batch-count" type="text" inputmode="numeric" pattern="[0-9]*" value="4" aria-label="扩建级数">
      <button id="settlement-batch-preview" class="btn btn-go btn-xs" onclick="openSettlementBatchPreview()">预览扩建</button>
    </div></div></details></div>`;
  h+=renderResourceManagement();

  h+=renderMetalModeCard();

  if(S._testUnlocked){
    h+=`<div class="card"><h3>${pix('build','card-pix')}测试工具</h3>
      <div class="train-custom" style="margin:4px 0"><span style="width:100px">木/石/食/科技</span><input id="test-all" type="text" inputmode="numeric" pattern="[0-9]*" value="50000" style="width:100px"><button class="btn btn-go btn-xs" onclick="addAllRes('test-all')">一键添加</button></div>
      <div class="train-custom" style="margin:4px 0"><span style="width:100px">⚔ 战功</span><input id="test-merit" type="text" inputmode="numeric" pattern="[0-9]*" value="50" style="width:100px"><button class="btn btn-go btn-xs" onclick="addMerit('test-merit')">添加战功</button></div>
  <div class="train-custom" style="margin:4px 0"><span style="width:100px">💎 精魄</span><input id="test-essence" type="text" inputmode="numeric" pattern="[0-9]*" value="5" style="width:100px"><button class="btn btn-go btn-xs" onclick="addAllEssences('test-essence')">添加精魄</button></div>
  <div class="train-custom" style="margin:4px 0"><span style="width:100px">⚡ 秒升建筑</span><button class="btn btn-xs" style="${S._fastBuild?'background:#40bf80;color:#121224':'background:#444;color:#888'}" onclick="toggleFastBuild()">${S._fastBuild?'✓ 已开启':'✗ 已关闭'}</button></div>
    </div>`;
  }
  h+=`</div>`;return h;
}
// ==================== 城镇巡防地图 ====================
function renderTownMapOverview(){
  const era=townVisualEra();
  const woodWorkers=S.popAlloc.wood||0;
  const stoneWorkers=S.popAlloc.stone||0;
  const foodWorkers=S.popAlloc.food||0;
  const garrisonOnly=uk=>{
    let n=0;
    const gf=S._garrisonForm||{front:[],mid:[],back:[]};
    for(const row of['front','mid','back']){
      for(const u of gf[row]){if(u.type===uk)n+=u.count;}
    }
    return n;
  };
  const guardCounts={};
  for(const k of Object.keys(CFG.units)){
    const bu=typeof baseUnitType==='function'?baseUnitType(k):k;
    guardCounts[bu]=(guardCounts[bu]||0)+garrisonOnly(k);
  }
  const hasAny=Object.values(guardCounts).some(n=>n>0);
  const status=typeof garrisonStatusText==='function'?garrisonStatusText(hasAny):(hasAny?'巡逻中':'无');
  const townMapClass=typeof garrisonTownMapClass==='function'?garrisonTownMapClass():'';
  const garrisonLayers=typeof renderGarrisonTownLayers==='function'?renderGarrisonTownLayers():'';
  const troopSummary=hasAny
    ?Object.entries(CFG.units).filter(([k])=>garrisonOnly(k)>0).map(([k,c])=>`${c.name}${garrisonOnly(k)}`).join('｜')
    :'无';

  return `<div class="card town-map-card">
    <div class="town-map-head">
      <h3>${pix('home','card-pix')}主城一览</h3>
      <span class="town-map-status">${status}</span>
      <div class="town-map-actions"><button class="btn btn-ghost btn-xs town-expand-button" type="button" onclick="toggleTownExpanded()" aria-expanded="false">展开地图</button></div>
    </div>
    <div class="town-map ${townMapClass}" data-era="${era}" aria-label="主城地图" style="background-image:url('./assets/art/scene/town-${era}.png'),url('./assets/art/scene/town-daylight.png'),url('./assets/art/map/terrain.png')">
      <div class="hd2d-town-host" aria-hidden="true"></div>
      <button type="button" class="town-art-site town-art-town" data-u="0.50" data-v="0.40" onclick="openTownTarget('town')" aria-label="主城，打开人口"></button>
      <button type="button" class="town-art-site town-art-wood" data-u="0.17" data-v="0.42" onclick="openTownTarget('wood')" aria-label="林地，${woodWorkers}名工人，打开木材分配"></button>
      <button type="button" class="town-art-site town-art-stone" data-u="0.82" data-v="0.42" onclick="openTownTarget('stone')" aria-label="采石场，${stoneWorkers}名工人，打开石料分配"></button>
      <button type="button" class="town-art-site town-art-food" data-u="0.20" data-v="0.70" onclick="openTownTarget('food')" aria-label="农田，${foodWorkers}名工人，打开粮食分配"></button>
      <button type="button" class="town-art-site town-art-army" data-u="0.65" data-v="0.28" onclick="openTownTarget('army')" aria-label="军营，打开训练"></button>
      <button type="button" class="town-art-site town-art-tech" data-u="0.26" data-v="0.15" onclick="openTownTarget('tech')" aria-label="学院，打开科技"></button>
      <button type="button" class="town-art-site town-art-defense" data-u="0.82" data-v="0.12" onclick="openTownTarget('defense')" aria-label="哨塔，打开驻军"></button>
      <div class="town-art-state" aria-label="主城工人状态">工人：木 ${woodWorkers} · 石 ${stoneWorkers} · 粮 ${foodWorkers} · ${status}</div>
      <div class="town-map-zone town-resource-zone" aria-hidden="true"></div>
      <div class="town-map-zone town-defense-zone" aria-hidden="true"></div>
      <div class="town-map-zone town-frontier-zone" aria-hidden="true"></div>
      <div class="town-road town-road-main"></div>
      <div class="town-road town-road-branch"></div>
      <div class="town-palisade" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="town-gate" aria-hidden="true"></div>
      <div class="town-woods" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="town-stones" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      ${garrisonLayers}

      ${workerDots('wood',woodWorkers,'wood')}
      ${workerDots('stone',stoneWorkers,'stone')}
      ${workerDots('food',foodWorkers,'food')}
      ${renderTownGuards(guardCounts)}
      <div class="town-building town-hall">
        <span class="town-building-sprite">${mapPix('town_hall','town-building-pix')}</span>
        <span class="town-map-badge town-level-badge">上限 ${maxPop()}</span>
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
      ${S.buildings.arrow_tower&&S.buildings.arrow_tower.lv>0?`
      <div class="town-building town-arrow-tower">
        <span class="town-building-sprite">${mapPix('arrow_tower','town-building-pix')}</span>
        <span class="town-map-badge">Lv.${S.buildings.arrow_tower.lv}</span>
      </div>`:''}
    </div>
    <div class="town-map-hotspots" aria-label="地图快捷入口">
      <button type="button" class="town-hotspot" onclick="openTownTarget('town')">主城 · 人口</button>
      <button type="button" class="town-hotspot" onclick="openTownTarget('wood')">林地 · 木材</button>
      <button type="button" class="town-hotspot" onclick="openTownTarget('stone')">采石 · 石料</button>
      <button type="button" class="town-hotspot" onclick="openTownTarget('food')">农田 · 粮食</button>
      <button type="button" class="town-hotspot" onclick="openTownTarget('tech')">学院 · 科技</button>
      <button type="button" class="town-hotspot" onclick="openTownTarget('army')">军营 · 训练</button>
      <button type="button" class="town-hotspot" onclick="openTownTarget('defense')">哨塔 · 驻军</button>
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
    .map(([type,cls,anim])=>`<span class="town-guard ${cls} ${anim}" data-unit="${type}" data-count="${counts[type]||0}" aria-hidden="true">${pix(type)}</span>`)
    .join('');
}
let _townHash='';
let _townSceneNode=null;   // 切片16-UI：巡防地图节点跨重渲染保留（避免 innerHTML 重建销毁+动画重置）
let _townMapResizeObserver=null;
const TOWN_ERA_SCIENCES=[
  'sci_bronze_age','sci_iron_age','sci_silver_age','sci_gold_age',
  'sci_alloy_age','sci_steam_age','sci_electric_age','sci_nuclear_age'
];
function townVisualEra(){
  const unlocked=Array.isArray(S.sciences)?S.sciences:[];
  for(let i=TOWN_ERA_SCIENCES.length-1;i>=0;i--){
    if(unlocked.includes(TOWN_ERA_SCIENCES[i]))return TOWN_ERA_SCIENCES[i];
  }
  return 'base';
}
function townHasAnyGarrison(){
  const gf=S._garrisonForm||{front:[],mid:[],back:[]};
  for(const row of['front','mid','back']){
    for(const u of gf[row]||[]){
      if((u.count||0)>0)return true;
    }
  }
  return false;
}
function townVisualSnapshot(){
  const buildings={};
  for(const key of Object.keys(CFG.buildings||{})){
    const st=bldSt(key);
    buildings[key]={lv:st.lv||0,state:st.state||'idle'};
  }
  return{
    townLevel:S.townLv,maxPop:maxPop(),era:townVisualEra(),
    workers:{wood:S.popAlloc.wood||0,stone:S.popAlloc.stone||0,food:S.popAlloc.food||0},
    buildings,garrison:{active:townHasAnyGarrison(),phase:S.garrison?.phase||'idle'},
    expanded:!!document.querySelector('.town-map-card.is-expanded')
  };
}
function openTownTarget(siteId){
  const card=document.querySelector('.town-map-card');
  if(card?.classList.contains('is-expanded'))toggleTownExpanded();
  const target={town:'town-population',wood:'worker-wood',stone:'worker-stone',food:'worker-food'}[siteId];
  if(target){
    document.getElementById(target)?.scrollIntoView({block:'start',behavior:'smooth'});
    return;
  }
  if(siteId==='tech')S.page='tech';
  else if(siteId==='army'){S.page='barracks';S._barracksTab='train';}
  else if(siteId==='defense'){S.page='fight';S._fightTab='garrison';}
  else return;
  updateUI();document.getElementById('main').scrollTop=0;
}
function toggleTownExpanded(){
  const card=document.querySelector('.town-map-card');
  if(!card)return;
  const expanded=card.classList.toggle('is-expanded');
  document.getElementById('main').classList.toggle('town-expanded',expanded);
  const button=card.querySelector('.town-expand-button');
  if(button){button.textContent=expanded?'收起地图':'展开地图';button.setAttribute('aria-expanded',String(expanded));}
  layoutTownArtSites();
  if(window.HD2D)window.HD2D.updateTown(townVisualSnapshot());
}
function layoutTownArtSites(){
  const map=document.querySelector('#town-scene .town-map');if(!map)return;
  const width=map.clientWidth,height=map.clientHeight,aspect=1024/525;
  const expanded=!!map.closest('.town-map-card.is-expanded');
  const imageWidth=expanded?Math.min(width,height*aspect):Math.max(width,height*aspect);
  const imageHeight=imageWidth/aspect;
  for(const button of map.querySelectorAll('.town-art-site')){
    const u=Number(button.dataset.u),v=Number(button.dataset.v);
    button.style.left=Math.min(width-24,Math.max(24,width/2+(u-0.5)*imageWidth))+'px';
    button.style.top=Math.min(height-24,Math.max(24,height/2+(v-0.5)*imageHeight))+'px';
  }
}
function updateTownDynamicBits(){
  if(S.page!=='home')return;
  const hasAny=townHasAnyGarrison();
  const statusEl=document.querySelector?.('.town-map-status');
  if(statusEl&&typeof garrisonStatusText==='function')statusEl.textContent=garrisonStatusText(hasAny);

  const bannerEl=document.querySelector?.('.town-phase-banner');
  if(bannerEl&&typeof garrisonStatusText==='function'){
    const gs=S.garrison||{};
    const inv=typeof garrisonById==='function'?garrisonById(gs.templateId):null;
    bannerEl.textContent=`${garrisonStatusText(true)}${inv?` · ${inv.name}`:''}`;
  }

  const barEl=document.querySelector?.('.town-cooldown-bar i');
  if(barEl&&S.garrison&&S.garrison.phase==='cooldown'&&S.garrison.phaseUntil>S.garrison.phaseStarted){
    const g=S.garrison;
    const progress=Math.max(0,Math.min(100,Math.round((g.phaseUntil-S.tick)/(g.phaseUntil-g.phaseStarted)*100)));
    barEl.style.width=progress+'%';
  }
}
function updateTownScene(){
  const woodWorkers=S.popAlloc.wood||0;
  const stoneWorkers=S.popAlloc.stone||0;
  const foodWorkers=S.popAlloc.food||0;
  // 哈希包含驻军阵容结构，确保阵容变化时能刷新
  const gHash=JSON.stringify(S._garrisonForm||{});
  const bHash=Object.keys(CFG.buildings||{}).map(key=>{const st=bldSt(key);return `${st.lv}:${st.state}`}).join(',');
  const gs=S.garrison||{};
  const invHash=[gs.phase,gs.templateId,gs.result&&gs.result.outcome,S.merit].join('|');
  const h=woodWorkers+','+stoneWorkers+','+foodWorkers+','+S.townLv+','+maxPop()+','+townVisualEra()+','+gHash+','+bHash+','+invHash;
  if(h===_townHash){
    updateTownDynamicBits();
    if(window.HD2D)window.HD2D.updateTown(townVisualSnapshot());
    return;
  }
  _townHash=h;
  const html=renderTownMapOverview();
  const scene=document.getElementById('town-scene');
  const oldHost=scene.querySelector('.hd2d-town-host');
  const expanded=!!scene.querySelector('.town-map-card.is-expanded');
  if(oldHost)oldHost.remove();
  scene.innerHTML=html;
  const host=scene.querySelector('.hd2d-town-host');
  if(oldHost&&host)host.replaceWith(oldHost);
  const actualHost=oldHost||host;
  if(expanded){
    scene.querySelector('.town-map-card')?.classList.add('is-expanded');
    const button=scene.querySelector('.town-expand-button');
    if(button){button.textContent='收起地图';button.setAttribute('aria-expanded','true');}
  }
  if(window.HD2D&&location.protocol!=='file:'&&actualHost){
    const snapshot=townVisualSnapshot();
    const ok=oldHost?window.HD2D.updateTown(snapshot):window.HD2D.mountTown(actualHost,snapshot,{
      onSelect:openTownTarget,
      onFallback:()=>{scene.querySelector('.town-map')?.classList.remove('hd2d-active');layoutTownArtSites();}
    });
    scene.querySelector('.town-map')?.classList.toggle('hd2d-active',ok!==false&&window.HD2D.status()?.town?.mounted===true);
  }
  if(_townMapResizeObserver)_townMapResizeObserver.disconnect();
  if(window.ResizeObserver){
    _townMapResizeObserver=new ResizeObserver(layoutTownArtSites);
    _townMapResizeObserver.observe(scene.querySelector('.town-map'));
  }
  layoutTownArtSites();
  updateTownDynamicBits();
}
// ==================== 建筑界面（含4个子标签） ====================
const BUILD_CATEGORIES = {
  basic: {name:'基础建筑',keys:['academy','library','institute','barracks','warehouse','stone_store','large_granary','lumber_mill','quarry','farm']},
  barracks: {name:'兵营建筑',keys:['infantry_camp','archer_range','stable','mage_tower','bronze_workshop','iron_forge','silver_armory','gold_armory','alloy_armory','steam_armory','electric_armory']},
  special: {name:'特殊建筑',keys:['arrow_tower']},
  economy: {name:'经济建筑',keys:['coal_mine','mine','copper_furnace','smelter','coal_store','copper_store','iron_store','silver_store','gold_store','steel_store','silver_refinery','gold_refinery','steel_refinery','mint','market']}
};

function rBuildDetailCard(key, cfg, showPrimaryAction=true, showTierAction=true){
  const st=bldSt(key),scienceLocked=cfg.needScience&&!buildingScienceUnlocked(key),progressLock=buildingProgressLock(key),locked=!!progressLock||scienceLocked,upLock=st.lv>0?upgradeLockReason(key):'';
  // 右侧对齐标签：资源Buff 或 解锁条件
  const buffLabel=cfg.buffRes&&st.state==='idle'&&st.lv>0?`<span style="font-size:12px;color:#40bf80">${pix(CFG.res[cfg.buffRes].icon,'sm')} ${CFG.res[cfg.buffRes].name} Buff: +${((st.lv*cfg.buffPerLv+cfg.buffBase)*100).toFixed(0)}%</span>`:'';
  // IE-007：被动产出/消耗标识
  const prodLabel=cfg.produces&&st.state==='idle'&&st.lv>0?(()=>{
    let t='';
    for(const[rk,v] of Object.entries(cfg.produces))t+=`${pix(CFG.res[rk]?.icon||rk,'sm')} ${CFG.res[rk]?.name||rk} +${v*st.lv}/s `;
    if(cfg.consumes)for(const[rk,v] of Object.entries(cfg.consumes))t+=`<span style="color:#d09090">消耗${CFG.res[rk]?.name||rk} ${(typeof effConsume==='function'?effConsume(key,rk):v)*st.lv}/s</span> `;
    return `<span style="font-size:11px;color:#78b8e8">${t}</span>`;
  })():'';
  const lockLabel=locked?(scienceLocked
    ?`<span style="font-size:11px;color:#e06060">${pix('lock','mini')}需先研究「${(typeof sciName==='function')?sciName(cfg.needScience):(CFG.sciences?.[cfg.needScience]?.name||cfg.needScience)}」</span>`
    :`<span style="font-size:11px;color:#e06060">${pix('lock','mini')}${esc(progressLock)}</span>`):'';
  const rightLabel=lockLabel||buffLabel||prodLabel;
  let h=`<div class="card" style="${locked?'opacity:.7':''}"><h3 style="display:flex;justify-content:space-between;align-items:center">`;
  h+=`<span>${pix(key,'card-pix')}${cfg.name}`;if(st.state==='idle'&&st.lv>0)h+=` <span style="color:#f0d060">Lv.${st.lv}</span>`;if(cfg.trains){const tls=['T0基础','T1进阶','T2精锐','T3终极','T4传说'];h+=` <span style="font-size:10px;color:#f0d060">时代:${tls[st.tier??0]||'T'+(st.tier??0)}</span>`;if(st.state==='tier_upgrading')h+=` → <span style="color:#40bf80">${tls[(st.tier??0)+1]||'T'+((st.tier??0)+1)}</span>`;}
  // 营帐特殊：显示出战上限
  if(key==='barracks')h+=` <span style="font-size:11px;color:#888">(出战上限${regMax()}人/格，每级+5)</span>`;
  // 仓库特殊：显示存储上限
  if(key==='warehouse'&&st.state==='idle'&&st.lv>0)h+=` <span style="font-size:11px;color:#f0d060">木 ${resCap('wood')} · 石 ${resCap('stone')}${S.storageMode==='legacy'?` · 粮 ${resCap('food')}`:''}</span>`;
  h+=`</span>${rightLabel}</h3>`;
  if(cfg.storageFor){
    const rk=cfg.storageFor,applies=rk==='food'||rk==='coal'||S.metalRecipeMode==='coal';
    const current=applies?resCap(rk):metalCapAfterSwitch(rk);
    h+=`<div class="build-meta">${CFG.res[rk]?.name||rk}专仓：${applies?'当前上限':'切换煤链后上限'} ${metalUiNumber(current)}；每完成一级 +${cfg.storagePerLv||CFG.metalChain?.storagePerLv||0}</div>`;
    if(!applies)h+=`<div class="build-meta" style="color:#b99c6d">旧配方期间不改变铜铁上限，现为 ${metalUiNumber(resCap(rk))}</div>`;
  }
  if(key==='iron_store')h+=`<div class="build-meta">同时每级提高基础钢容量 50；当前钢上限 ${metalUiNumber(resCap('steel'))}</div>`;
  if(cfg.buffRes&&['coal_mine','mine','smelter'].includes(key)){
    const rk=cfg.buffRes,researchDriven=rk==='coal'||S.metalRecipeMode==='coal';
    h+=`<div class="build-meta">${researchDriven?`研究「${esc(sciName(CFG.res[rk].science||cfg.needScience))}」后开放${CFG.res[rk].name}岗位；本建筑只提高产率`:`${st.lv>0?'已开放':'建成后开放'}${CFG.res[rk].name}岗位，需在主页分配村民`}</div>`;
  }
  // 兵营类建筑：显示训练兵种和训练上限
  const bldTier=st.tier??0;
  if(cfg.trains){
    const baseK=cfg.trains;
    const repU=CFG.units[baseK]||Object.values(CFG.units).find(u=>u.baseUnit===baseK);
    const u=repU||{icon:baseK,name:baseK};
    const cap=unitCap(baseK);
    const nextLv=st.lv+(st.lv===0?1:1);
    const capCfg=CFG.unitCaps?.[baseK]; const nextCap=capCfg?capCfg.base+nextLv*capCfg.perLv:0;
    h+=`<div class="build-meta">训练: ${pix(u.icon,'mini')}${u.name} | 训练上限 ${st.lv>0?cap:0}${st.lv>0?` → ${nextCap}`:` (建成后 ${nextCap})`}</div>`;
    for(const extra of cfg.trainsExtra||[]){
      const extraUnit=CFG.units[extra],need=extraUnit?.needScience;
      h+=`<div class="build-meta">兼训: ${pix(extraUnit.icon,'mini')}${extraUnit.name}${need&&!scienceUnlocked(need)?` · 需研究「${esc(sciName(need))}」`:''}</div>`;
    }
  }
  if(st.state==='idle'){
    if(st.lv===0){
      const c=buildingInitialCost(key);
      h+=`<div style="display:flex;justify-content:space-between;align-items:center">`;
      h+=`<span style="font-size:11px;color:#888">建造: ${costHtml(c)} | ${c.time}秒</span>`;
      if(showPrimaryAction)h+=`<button class="btn btn-go btn-sm" style="width:80px;text-align:center" onclick="buildAct('${key}')" ${locked?'disabled':''}>建造</button>`;
      h+=`</div>`;
      if(upLock)h+=`<div class="build-meta limit-warn" style="margin-top:2px">${pix('lock','mini')}${upLock}</div>`;
    }else{
      const uc=upCost(key);
      h+=`<div style="display:flex;justify-content:space-between;align-items:center">`;
      h+=`<span style="font-size:10px;color:#666">升级: ${costHtml(uc)} | ${uc.time}秒</span>`;
      if(showPrimaryAction)h+=`<button class="btn btn-go btn-sm" style="width:80px;text-align:center" onclick="buildAct('${key}')" ${upLock?'disabled':''}>升级→Lv.${st.lv+1}</button>`;
      h+=`</div>`;
      if(upLock)h+=`<div class="build-meta limit-warn" style="margin-top:2px">${pix('lock','mini')}${upLock}</div>`;
      // 时代进阶按钮
      if(cfg.tierUpgrade&&st.lv>0){
        const tuCost=tierUpgradeCost(key);
        const tuLock=tierUpgradeLockReason(key);
        if(tuCost){
          const nextTier=bldTier+1;
          h+=`<div style="margin-top:4px;display:flex;justify-content:space-between;align-items:center">`;
          h+=`<span style="font-size:10px;color:#888">进阶: ${costHtml(tuCost)} | ${tuCost.time}秒</span>`;
          if(showTierAction)h+=`<button class="btn btn-go btn-sm" style="width:80px;text-align:center" onclick="buildTierUpgradeAct('${key}')" ${tuLock?'disabled':''}>进阶→T${nextTier}</button>`;
          h+=`</div>`;
          if(tuLock)h+=`<div style="font-size:9px;color:#e06060;margin-top:2px">${tuLock}</div>`;
        }
      }
      // 军事学院已移除
    }
  }else{
    const pct=st.timerEnd>0?((st.timerEnd-st.timer)/st.timerEnd*100).toFixed(0):0;
    const stateLabels={building:'建造',upgrading:'升级',tier_upgrading:'时代升级'};
    h+=`<div class="timer-text pulsing">${pix('timer','mini')} ${stateLabels[st.state]||st.state}中... ${st.timer}秒</div>`;
    h+=`<div class="prog-wrap"><div class="prog-fill" style="width:${pct}%"></div></div>`;
  }
  h+=`</div>`;
  return h;
}

let _buildSearch='';
function buildEntryState(key,cfg){
  const st=bldSt(key);
  if(st.state!=='idle')return{rank:0,status:'施工中',label:st.state==='tier_upgrading'?'时代升级中':st.state==='upgrading'?'升级中':'建造中',kind:'busy',disabled:true,action:'施工中'};
  const lock=!!buildingProgressLock(key)||!buildingScienceUnlocked(key);
  const limit=st.lv>0?upgradeLockReason(key):'';
  const cost=st.lv?upCost(key):buildingInitialCost(key);
  const paid=cost&&Object.entries(cost).every(([rk,amount])=>rk==='time'||Number.isFinite(S.res[rk])&&S.res[rk]>=amount);
  const protectedSave=saveProtected();
  if(!protectedSave&&!lock&&st.lv>0&&(limit||!paid)&&cfg.tierUpgrade&&tierUpgradeCost(key)&&!tierUpgradeLockReason(key))return{rank:1,status:'可立即处理',label:'可时代进阶',kind:'upgrade',disabled:false,action:'进阶',actionTarget:'tier'};
  if(lock||limit)return{rank:3,status:lock?'尚未解锁':limit,label:lock?'尚未解锁':limit.includes('已达等级上限')?'已达等级上限':'升级条件未满足',kind:'locked',disabled:true,action:st.lv?'升级':'建造'};
  return{rank:paid?1:2,status:paid?'可立即处理':'资源不足',label:protectedSave?'存档保护中':paid?(st.lv?'可升级':'可建造'):'资源不足',kind:paid&&!protectedSave?(st.lv?'upgrade':'build'):'waiting',disabled:!paid||protectedSave,action:st.lv?'升级':'建造'};
}
function buildEntrySearch(key,cfg,category){
  return `${cfg.name} ${key} ${category} ${BUILD_CATEGORIES[category]?.name||''}`.toLowerCase();
}
function buildEntryMatches(search,rank,category,tab,query){
  return query?search.includes(query):tab==='ready'?rank<=2:category===tab;
}
function buildMarketVisible(tab,query){
  return query?buildEntrySearch('market',CFG.buildings.market||{name:'市场'},'economy').includes(query):tab==='economy';
}
function rBuildCard(key,cfg,category,state=buildEntryState(key,cfg)){
  const st=bldSt(key);
  const search=esc(buildEntrySearch(key,cfg,category));
  const tierAction=state.actionTarget==='tier';
  const actionLabel=tierAction?`时代进阶至 T${(st.tier??0)+1}`:st.lv?`升级至等级 ${st.lv+1}`:'建造';
  const action=st.state==='idle'
    ?`<button class="btn btn-go btn-sm build-entry-action" type="button" aria-label="${esc(cfg.name)}${actionLabel}" onclick="${tierAction?'buildTierUpgradeAct':'buildAct'}('${key}')" ${state.disabled?'disabled':''}>${tierAction?`进阶 <span>T${(st.tier??0)+1}</span>`:st.lv?`升级 <span>Lv.${st.lv+1}</span>`:'建造'}</button>`
    :`<div class="build-entry-timer"><strong>${Math.ceil(Math.max(0,st.timer||0))}</strong><span>秒后完成</span></div>`;
  const progress=st.state!=='idle'?Math.min(100,Math.max(0,st.timerEnd>0?(st.timerEnd-st.timer)/st.timerEnd*100:0)):0;
  return `<article class="build-entry" id="build-${key}" data-category="${category}" data-rank="${state.rank}" data-state="${state.kind}" data-search="${search}">
    <div class="build-entry-main"><span class="build-entry-icon">${pix(key,'md')}</span>
      <div class="build-entry-copy"><div class="build-entry-heading"><h3 class="build-entry-title">${esc(cfg.name)}</h3><span class="build-entry-level">${st.lv?`Lv.${st.lv}`:'未建造'}</span></div>
      <div class="build-entry-sub"><span class="build-entry-status">${esc(state.label)}</span>${cfg.trains?`<span class="build-entry-era">T${st.tier??0} 时代</span>`:''}</div></div>${action}</div>
    ${st.state!=='idle'?`<div class="build-entry-progress" role="progressbar" aria-label="${esc(cfg.name)}${esc(state.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><span style="width:${progress.toFixed(1)}%"></span></div>`:''}
    <details id="build-detail-${key}" data-building="${key}"><summary><span>费用与效果</span><small>查看条件${cfg.tierUpgrade?' · 时代进阶':''}</small></summary>${rBuildDetailCard(key,cfg,false,!tierAction)}</details>
  </article>`;
}
function setBuildSearch(value){
  _buildSearch=value;
  filterBuildEntries();
}
function filterBuildEntries(){
  const query=_buildSearch.trim().toLowerCase();
  const tab=S._buildTab||'ready';
  let shown=0;
  for(const entry of document.querySelectorAll('.build-entry')){
    const matches=buildEntryMatches(entry.dataset.search.toLowerCase(),Number(entry.dataset.rank),entry.dataset.category,tab,query);
    entry.hidden=!matches;if(matches)shown++;
  }
  const empty=document.getElementById('build-empty');
  if(empty)empty.hidden=shown>0;
  const count=document.getElementById('build-result-count');
  if(count)count.textContent=`${shown} 项`;
  const heading=document.getElementById('build-list-title');
  if(heading)heading.textContent=query?'搜索结果':tab==='ready'?'施工与建设':BUILD_CATEGORIES[tab]?.name||'建筑列表';
  const market=document.getElementById('build-market-region');
  if(market)market.hidden=!buildMarketVisible(tab,query);
}
function rBuild(){
  const tab=S._buildTab||'ready';
  const tabs=[{k:'ready',n:'待办'},{k:'basic',n:'基础'},{k:'economy',n:'经济'},{k:'barracks',n:'军事'},{k:'special',n:'特殊'}];
  const query=_buildSearch.trim().toLowerCase();
  const entries=[];
  for(const [category,group] of Object.entries(BUILD_CATEGORIES))for(const key of group.keys){
    const cfg=CFG.buildings[key];if(cfg){const state=buildEntryState(key,cfg);entries.push({key,cfg,category,state,rank:state.rank,search:buildEntrySearch(key,cfg,category)});}
  }
  entries.sort((a,b)=>a.rank-b.rank||a.cfg.name.localeCompare(b.cfg.name,'zh-CN'));
  const countKind=kind=>entries.filter(item=>item.state.kind===kind).length;
  const shown=entries.filter(item=>buildEntryMatches(item.search,item.rank,item.category,tab,query)).length;
  let h=`<header class="build-page-header"><span class="section-kicker">城镇建设</span><h2>建筑管理</h2><p>先处理施工与升级，再按类别查看所有建筑。</p></header>`;
  h+=`<div class="build-overview" aria-label="建筑状态总览"><div class="build-overview-item" data-state="busy"><strong>${countKind('busy')}</strong><span>施工中</span></div><div class="build-overview-item" data-state="build"><strong>${countKind('build')}</strong><span>可建造</span></div><div class="build-overview-item" data-state="upgrade"><strong>${countKind('upgrade')}</strong><span>可升级</span></div></div>`;
  h+=`<div class="build-toolbar"><label for="build-search">搜索全部建筑</label><input id="build-search" type="search" placeholder="输入名称，如仓库、市场" aria-label="搜索全部建筑" value="${esc(_buildSearch)}" oninput="setBuildSearch(this.value)"></div>`;
  h+=`<div class="build-filters" aria-label="建筑分类">`;
  for(const t of tabs)h+=`<button class="btn btn-sm ${tab===t.k?'btn-go':'btn-ghost'}" type="button" aria-pressed="${tab===t.k}" onclick="setBuildTab('${t.k}')">${t.n}</button>`;
  h+=`</div><div class="build-list-heading"><h3 id="build-list-title">${query?'搜索结果':tab==='ready'?'施工与建设':BUILD_CATEGORIES[tab]?.name||'建筑列表'}</h3><span id="build-result-count">${shown} 项</span></div>`;
  for(const item of entries){
    const match=buildEntryMatches(item.search,item.rank,item.category,tab,query);
    const card=rBuildCard(item.key,item.cfg,item.category,item.state);
    h+=match?card:card.replace('<article class="build-entry"','<article class="build-entry" hidden');
  }
  h+=`<div id="build-empty" class="card build-empty" ${shown?'hidden':''}><strong>没有符合条件的建筑</strong><p>切换分类或清除搜索，查看其他建设项目。</p></div>`;
  // 市场仍使用原有操作；搜索时只切换可见性，避免输入聚焦期间错过兑换入口。
  const mk=CFG.buildings.market,marketState=bldSt('market');
  if(CFG.market&&mk&&marketState.state==='idle'&&marketState.lv>0)h+=`<section id="build-market-region" class="build-market-region" aria-label="市场兑换" ${buildMarketVisible(tab,query)?'':'hidden'}>${marketPanel()}</section>`;
  return h;
}
function marketPanel(){
  const opts=marketAvailableRates().map(r=>`<option value="${r.from}|${r.to}">${resourceDisplayName(r.from)} → ${resourceDisplayName(r.to)}（1:${r.rate}）</option>`).join('');
  const advanced=scienceUnlocked('sci_coin');
  const cleanserPrice=CFG.market.special.goods.domainCleanser.cost;
  const cleanserCooling=idemSeen(idemKey('domain-cleanser-exchange','market'));
  const canExchange=count=>!S.battleActive&&!saveProtected()&&S.offline?.populationFoodRule!=='legacy-pending'&&
    !cleanserCooling&&S.items.sacredBlood>=cleanserPrice*count&&
    S.items.domainCleanser+count<=CFG.eraMaterials.domainCleanser.max;
  const special=marketSpecialUnlocked()?`<div style="border-top:1px solid #34394b;margin-top:8px;padding-top:7px;font-size:10px;color:#aaa">圣域货架 · ${CFG.eraMaterials.sacredBlood.name} ${S.items.sacredBlood} · ${CFG.eraMaterials.domainCleanser.name} ${S.items.domainCleanser} · ${CFG.eraMaterials.emberElixir.name} ${S.items.emberElixir} · ${CFG.eraMaterials.aegisElixir.name} ${S.items.aegisElixir} · 下次刷新 ${S.marketSpecial.clockSec} 秒<br>下方货品每20分钟补货一次；本轮未购货品会在补货时替换。</div>
    <div style="margin:7px 0 5px;display:flex;flex-wrap:wrap;gap:4px"><button id="market-domain-cleanser-exchange" class="btn btn-go btn-xs" onclick="exchangeDomainCleanserFromUI(1)" ${canExchange(1)?'':'disabled'}>${cleanserCooling?'兑换处理中':'常驻兑换'} · ${CFG.eraMaterials.sacredBlood.name} ${cleanserPrice} → ${CFG.eraMaterials.domainCleanser.name} 1</button><button id="market-domain-cleanser-exchange-six" class="btn btn-ghost btn-xs" onclick="exchangeDomainCleanserFromUI(6)" ${canExchange(6)?'':'disabled'}>批量兑换 6 · ${CFG.eraMaterials.sacredBlood.name} ${cleanserPrice*6}</button></div>
    <button class="btn btn-go btn-xs" onclick="buyMarketSpecialFromUI('sacredBlood')" ${S.marketSpecial.offers.sacredBlood>0&&S.res.goldCoin>=9999?'':'disabled'}>${CFG.eraMaterials.sacredBlood.name}（在售 ${S.marketSpecial.offers.sacredBlood} · 金铸币 9999）</button>
    <button class="btn btn-go btn-xs" onclick="buyMarketSpecialFromUI('domainCleanser')" ${S.marketSpecial.offers.domainCleanser>0&&S.items.sacredBlood>=3?'':'disabled'}>${CFG.eraMaterials.domainCleanser.name}（在售 ${S.marketSpecial.offers.domainCleanser} · 血剂 3）</button>
    <button class="btn btn-go btn-xs" onclick="buyMarketSpecialFromUI('emberElixir')" ${S.marketSpecial.offers.emberElixir>0&&S.items.sacredBlood>=20?'':'disabled'}>${CFG.eraMaterials.emberElixir.name}（在售 ${S.marketSpecial.offers.emberElixir} · 血剂 20）</button>
    <button class="btn btn-go btn-xs" onclick="buyMarketSpecialFromUI('aegisElixir')" ${S.marketSpecial.offers.aegisElixir>0&&S.items.emberElixir>=3?'':'disabled'}>${CFG.eraMaterials.aegisElixir.name}（在售 ${S.marketSpecial.offers.aegisElixir} · 炽翼战剂 3）</button>`:'';
  return `<div class="card"><h3>${pix('coin','card-pix')}市场兑换</h3>
    <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
      <select id="mk-rate" style="flex:1;min-width:150px" onchange="marketRateChange()">${opts}</select>
      <input id="mk-qty" type="text" inputmode="numeric" pattern="[0-9]*" value="10" style="width:64px">
      <button class="btn btn-go btn-xs" onclick="marketExchange(this)">兑换</button>
    </div>
    <div style="font-size:10px;color:#888;margin-top:4px">基础资源出售与购契不限次数；冶银后银两200可购1地契。${advanced?(marketDailyLimit()>0?`其他兑换每日 ${marketDailyLimit()} 次（本地 0 点重置，今日剩余 ${Math.max(0,marketDailyLimit()-dailyCount('market'))} 次）`:'其他兑换不限次数'):'高级兑换需货币铸造'}</div>
    <div class="population-batch-tools">
      <div class="population-batch-title">快捷购契 · 不改汇率，不额外占每日次数</div>
      <div class="population-batch-controls">
        <select id="quick-deed-from" aria-label="购契出售资源"><option value="wood">木材</option><option value="stone">石料</option><option value="food">粮食</option></select>
        <input id="quick-deed-count" type="text" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="目标地契数量">
        <button id="quick-deed-preview" class="btn btn-go btn-xs" onclick="openQuickDeedPreview()">预览购契</button>
      </div>
      <div class="population-batch-hint">只出售所选资源；已有${resourceDisplayName('coin')}先用于购契。钱币仓容不足时请减少本次数量。</div>
      <details id="market-resource-basket" class="population-batch-more"><summary>合并出售多种资源</summary>
        <div class="population-batch-basket">
          <label>木 <input id="deed-sell-wood" type="text" inputmode="numeric" pattern="[0-9]*" value="0"></label>
          <label>石 <input id="deed-sell-stone" type="text" inputmode="numeric" pattern="[0-9]*" value="0"></label>
          <label>粮 <input id="deed-sell-food" type="text" inputmode="numeric" pattern="[0-9]*" value="0"></label>
        </div>
        <div class="population-batch-controls"><span>目标地契</span><input id="deed-basket-count" type="text" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="合并购买地契数量"><button id="deed-basket-preview" class="btn btn-ghost btn-xs" onclick="openDeedBasketPreview()">预览合并购契</button></div>
      </details>${special}
    </div></div>`;
}
function marketRateChange(){
  const sel=document.getElementById('mk-rate'),input=document.getElementById('mk-qty');
  if(!sel||!input)return;
  const [from,to]=sel.value.split('|');
  const rate=marketAvailableRates().find(r=>r.from===from&&r.to===to);
  if(!rate)return;
  const min=Math.ceil(1/rate.rate),current=Number(input.value);
  if(!Number.isSafeInteger(current)||current<min)input.value=String(min);
}
function marketExchange(button){
  const sel=document.getElementById('mk-rate');if(!sel)return;
  const v=sel.value.split('|');const from=v[0],to=v[1];
  const qty=Number((document.getElementById('mk-qty')||{}).value);
  if(button)button.disabled=true;
  const r=exchangeResource(from,to,qty);
  if(button)button.disabled=false;
  if(r.ok&&typeof toast==='function')toast('兑换成功：'+resourceDisplayName(to)+' +'+r.get);
}
function buyMarketSpecialFromUI(key){
  const result=buyMarketSpecial(key);
  if(typeof toast==='function')toast(result.ok?`${CFG.eraMaterials[key].name} +1`:({
    'sold-out':'本轮没有该货品','insufficient-resource':'兑换材料不足','capacity':'道具仓已满',
    'market-locked':'圣域货架尚未开放','save-failed':'保存失败，兑换未生效',
    'save-protected':'存档保护中，无法兑换'
  }[result.reason]||'兑换失败'));
}
function exchangeDomainCleanserFromUI(count=1){
  const result=exchangeDomainCleanser(count);
  if(typeof toast==='function')toast(result.ok?(result.repeat?'本次兑换已处理':`${CFG.eraMaterials.domainCleanser.name} +${result.gained}`):({
    'insufficient-resource':'圣兽血剂不足','capacity':'道具仓已满','invalid-quantity':'兑换数量无效',
    'battle-active':'战斗中不能兑换','market-locked':'圣域货架尚未开放',
    'save-failed':'保存失败，兑换未生效','save-protected':'存档保护中，无法兑换',
    'offline-pending':'请先结算离线收益再兑换'
  }[result.reason]||'兑换失败'));
}
function useDomainCleanserFromUI(key){
  const result=useDomainCleanser(key);
  if(typeof toast==='function')toast(result.ok?(result.repeat?'已处理本次使用':`警戒值降至 ${result.alert}`):({
    'insufficient-item':'镇域净化剂不足','alert-too-low':'警戒值未到200','battle-active':'战斗中不能使用',
    'save-failed':'保存失败，净化剂未消耗','save-protected':'存档保护中，无法使用'
  }[result.reason]||'暂不能使用净化剂'));
}
function upgradeSoulRankFromUI(){
  const unitType=document.getElementById('soul-rank-unit')?.value;
  const result=upgradeSoulRank(unitType);
  if(typeof toast==='function')toast(result.ok?`${CFG.units[unitType].name}英魂升阶：${result.rank}阶 ${result.stars}星`:(
    {'science-locked':'需先研究星界领主','invalid-unit':'未知或敌方兵种','unit-unowned':'需先拥有该兵种',
      'insufficient-item':'英魂铭石不足','max-rank':'已达最高阶','battle-active':'战斗中不能升阶',
      'save-failed':'保存失败，升阶未生效','save-protected':'存档保护中，无法升阶'}[result.reason]||'暂不能升阶'));
}
function useSacredBloodFromUI(){
  const unitType=document.getElementById('bloodline-unit')?.value;
  const count=Number(document.getElementById('bloodline-count')?.value);
  const result=useSacredBlood(unitType,count);
  if(typeof toast==='function')toast(result.ok?`${CFG.units[unitType].name}圣兽血脉 +${result.used}%，累计 ${result.total}%`:({
    'invalid-unit':'未知或敌方兵种','unit-unowned':'需先拥有该兵种','invalid-quantity':'请输入正整数份数',
    'insufficient-item':'圣兽血剂不足','use-limit':'该兵种已达到血脉上限','battle-active':'战斗中不能淬炼',
    'save-failed':'保存失败，血剂未消耗','save-protected':'存档保护中，无法淬炼'
  }[result.reason]||'暂不能淬炼血脉'));
}
function useEmberElixirFromUI(){
  const unitType=document.getElementById('ember-unit')?.value;
  const count=Number(document.getElementById('ember-count')?.value);
  const result=useEmberElixir(unitType,count);
  if(typeof toast==='function')toast(result.ok?`${CFG.units[unitType].name}基础攻击永久 +${result.used*10}%，累计 +${result.total*10}%`:({
    'invalid-unit':'未知或敌方兵种','unit-unowned':'需先拥有该兵种','invalid-quantity':'请输入正整数份数',
    'insufficient-item':'炽翼战剂不足','use-limit':'该兵种已达到战剂上限','battle-active':'战斗中不能淬炼',
    'save-failed':'保存失败，战剂未消耗','save-protected':'存档保护中，无法淬炼'
  }[result.reason]||'暂不能使用战剂'));
}
function useAegisElixirFromUI(){
  const unitType=document.getElementById('aegis-unit')?.value;
  const count=Number(document.getElementById('aegis-count')?.value);
  const result=useAegisElixir(unitType,count);
  if(typeof toast==='function')toast(result.ok?`${CFG.units[unitType].name}圣盾淬炼 +${result.used}，累计 ${result.total} 份`:({
    'invalid-unit':'未知或敌方兵种','unit-unowned':'需先拥有该兵种','invalid-quantity':'请输入正整数份数',
    'insufficient-item':'圣盾秘剂不足','use-limit':'该兵种已达到秘剂上限','battle-active':'战斗中不能淬炼',
    'save-failed':'保存失败，秘剂未消耗','save-protected':'存档保护中，无法淬炼'
  }[result.reason]||'暂不能使用秘剂'));
}
function exchangeBonesFromUI(){
  const count=Number(document.getElementById('bone-trade-count')?.value);
  const result=exchangeBonesForMedals(count);
  if(typeof toast==='function')toast(result.ok?`${resourceDisplayName('medal')} +${result.medalGain}`:({
    'invalid-quantity':'请输入正整数份数','insufficient-bone':'兽骨不足','capacity':'勋章容量不足',
    'save-failed':'保存失败，兑换未生效','save-protected':'存档保护中，无法兑换'
  }[result.reason]||'兑换失败'));
}
function exchangeMedalOfferFromUI(){
  const count=Number(document.getElementById('medal-offer-count')?.value);
  const result=exchangeOfferedBonesForMedals(count);
  if(typeof toast==='function')toast(result.ok?`${resourceDisplayName('medal')} +${result.medalGain}`:({
    'invalid-quantity':'请输入正整数份数','level':'边贸行尚未达到60级','not-offered':'勋章货位未上架或库存不足',
    'insufficient-bone':'兽骨不足','capacity':'勋章容量不足','save-failed':'保存失败，兑换未生效',
    'save-protected':'存档保护中，无法兑换'
  }[result.reason]||'兑换失败'));
}
function exchangeHideFromUI(id){
  const count=Number(document.getElementById('hide-trade-count')?.value);
  const result=exchangeHideForResource(id,count);
  if(typeof toast==='function')toast(result.ok?`${resourceDisplayName(result.get)} +${result.gain}`:({
    'invalid-good':'未知兽皮货位','invalid-quantity':'请输入正整数份数','not-offered':'兽皮货位未上架或库存不足',
    'insufficient-hide':'兽皮不足','capacity':'目标物资仓容不足','save-failed':'保存失败，兑换未生效',
    'save-protected':'存档保护中，无法兑换'
  }[result.reason]||'兑换失败'));
}
function beastExchangeActionFromUI(action,materialKey='boarHeart'){
  const count=Number(document.getElementById('heart-trade-count')?.value);
  const result=action==='upgrade'?upgradeBeastExchange():action==='refresh'?refreshBeastExchange():action==='trade'?exchangeWildMaterialForScrolls(materialKey,count):useStorageScroll(count);
  const messages={
    'invalid-quantity':'请输入正整数份数','level':'边贸行尚未达到30级','progress':'本级交易进度未满',
    'max-level':'边贸行已满级','no-refresh':'暂无刷新次数','not-offered':'图纸商品未上架或库存不足',
    'insufficient-material':'兑换材料不足','invalid-material':'未知兑换材料','insufficient-scroll':'图纸不足',
    'capacity':'图纸库存已满','use-limit':'图纸使用次数已达上限',
    'save-failed':'保存失败，操作未生效','save-protected':'存档保护中，无法操作'
  };
  if(typeof toast==='function')toast(result.ok?(action==='upgrade'?`边贸行升至 ${result.level} 级`:action==='refresh'?`边贸行刷新：上架商品 ${result.offers} 份`:action==='trade'?`机巧拓仓图纸Ⅰ +${result.scrollGain}`:`仓容永久提升，图纸已用 ${result.used} 次`):(messages[result.reason]||'操作失败'));
}
function tierScrollActionFromUI(action,tier){
  const count=Number(document.getElementById(`tier-scroll-count-${tier}`)?.value);
  const result=action==='trade'?exchangeTierScroll(tier,count):useTierStorageScroll(tier,count);
  const name=CFG.eraMaterials[`storageScroll${tier}`]?.name||'密卷';
  const messages={
    'invalid-tier':'未知密卷','invalid-quantity':'请输入正整数份数','level':'边贸行等级不足',
    'not-offered':'密卷货位未上架或库存不足','insufficient-scroll':'一阶图纸不足',
    'capacity':'密卷库存已满','use-limit':'密卷使用次数已达上限',
    'save-failed':'保存失败，操作未生效','save-protected':'存档保护中，无法操作'
  };
  if(typeof toast==='function')toast(result.ok?(action==='trade'?`${name} +${count}`:`${name} 已使用 ${count} 张，仓容永久提升`):(messages[result.reason]||'操作失败'));
}
function exchangeSoulElixirFromUI(materialKey){
  const count=Number(document.getElementById('soul-trade-count')?.value);
  const result=exchangeSoulElixirForStones(materialKey,count);
  if(typeof toast==='function')toast(result.ok?`${CFG.eraMaterials.soulStone.name} +${result.stoneGain}`:({
    'invalid-quantity':'请输入正整数份数','invalid-material':'未知兑换材料','level':'边贸行尚未达到60级',
    'not-offered':'铭石商品未上架或库存不足','insufficient-material':'战剂或秘剂不足',
    'capacity':'英魂铭石已达库存上限','save-failed':'保存失败，兑换未生效',
    'save-protected':'存档保护中，无法兑换'
  }[result.reason]||'兑换失败'));
}
let _pendingPopulationAction=null;
let _populationPreviewInputId='';
function showPopulationActionPreview(title,body,canConfirm){
  const modal=document.getElementById('population-action-modal');
  const content=document.getElementById('population-action-content');
  if(!modal||!content)return;
  content.innerHTML=`<h3>${esc(title)}</h3>${body}<div class="population-preview-actions">
    <button class="btn btn-ghost btn-sm" onclick="closePopulationActionModal()">返回</button>
    ${canConfirm?'<button id="population-action-confirm" class="btn btn-go btn-sm" onclick="confirmPopulationAction()">确认执行</button>':''}
    </div>`;
  modal.classList.add('active');
}
function closePopulationActionModal(){
  _pendingPopulationAction=null;
  document.getElementById('population-action-modal')?.classList.remove('active');
  document.getElementById(_populationPreviewInputId)?.focus();
  updateUI();
}
function openSettlementBatchPreview(){
  _populationPreviewInputId='settlement-batch-count';
  const key=document.getElementById('settlement-batch-kind')?.value;
  const count=Number(document.getElementById('settlement-batch-count')?.value);
  const expectedLv=S.settlements[key];
  const plan=settlementBatchPreview(key,count,expectedLv);
  _pendingPopulationAction=plan.ok?{kind:'settlement',key,count,expectedLv,startingDeed:S.res.deed}:null;
  const costs=plan.costs?.length?(plan.costs.length<=20?plan.costs.join(' + '):plan.costs.slice(0,10).join(' + ')+' … + '+plan.costs.at(-1)+'（共'+plan.costs.length+'级）'):'';
  const detail=plan.cost!=null?`<div class="population-preview-line">逐级费用：${costs}</div>
    <div class="population-preview-line">总计 ${plan.cost} 地契 · 人口上限 +${plan.gain} · 余额 ${S.res.deed} → ${plan.remainingDeed}</div>`:'';
  const body=`${detail}<div class="population-preview-line" style="color:${plan.ok?'#78d0a0':'#e0b060'}">${plan.ok?`${CFG.settlements[key].name} Lv.${plan.startLevel} → Lv.${plan.level}；人口上限 ${maxPop()} → ${plan.capacity}，实际村民仍为 ${popCurrent()}`:esc(plan.reason)}</div>`;
  showPopulationActionPreview('多级扩建预览',body,plan.ok);
}
function openQuickDeedPreview(){
  _populationPreviewInputId='quick-deed-count';
  const from=document.getElementById('quick-deed-from')?.value;
  const deeds=Number(document.getElementById('quick-deed-count')?.value);
  const plan=previewDeedPurchase(from,deeds);
  _pendingPopulationAction=plan.ok?{kind:'quick-deed',from,deeds,sourceCost:plan.sourceCost,
    startingDeed:plan.startingDeed}:null;
  const moneyName=resourceDisplayName('coin');
  const sourceText=plan.ok?(plan.sourceCost?`出售${CFG.res[from].name} ${plan.sourceCost} → ${moneyName} +${plan.coinGained}`:`使用已有${moneyName}，无需出售资源`):'';
  const body=plan.ok?`<div class="population-preview-line">${sourceText}；已有${moneyName} ${plan.startingCoin}</div>
    <div class="population-preview-line">花${moneyName} ${plan.coinCost} → 地契 +${deeds}；成交后${moneyName} ${plan.remainingCoin}、地契 ${plan.remainingDeed}</div>
    <div class="population-preview-line" style="color:#8daabb">${moneyName}生产仍会继续；确认时重算，可少卖资源，不会超过上述出售量。任一步仓容或库存不够则整笔取消。</div>`:`<div class="population-preview-line" style="color:#e0b060">${esc(plan.message||plan.reason)}</div>`;
  showPopulationActionPreview('快捷购契预览',body,plan.ok);
}
function openDeedBasketPreview(){
  _populationPreviewInputId='deed-basket-count';
  const sales=[];
  for(const from of ['wood','stone','food']){
    const raw=document.getElementById('deed-sell-'+from)?.value?.trim()??'';
    if(raw!==''&&raw!=='0')sales.push({from,qty:Number(raw)});
  }
  const deeds=Number(document.getElementById('deed-basket-count')?.value);
  const plan=previewDeedBasket(sales,deeds);
  _pendingPopulationAction=plan.ok?{kind:'basket',sales,deeds,coinCost:plan.coinCost,
    gains:plan.trades.slice(0,-1).map(t=>t.get),startingDeed:plan.startingDeed}:null;
  const moneyName=resourceDisplayName('coin');
  const salesText=plan.ok?plan.trades.slice(0,-1).map(t=>`${CFG.res[t.from].name} ${t.qty} → ${moneyName} ${t.get}`).join('；')||`不出售资源，使用已有${moneyName}`:'';
  const body=plan.ok?`<div class="population-preview-line">${salesText}</div>
    <div class="population-preview-line">已有${moneyName} ${plan.startingCoin} · 本次得币 ${plan.coinGained} · 购契用币 ${plan.coinCost}</div>
    <div class="population-preview-line">地契 +${deeds}；成交后${moneyName} ${plan.remainingCoin}、地契 ${plan.remainingDeed}</div>
    <div class="population-preview-line" style="color:#8daabb">${moneyName}余额可能随生产变化；确认时按列出的出售量和顺序重新校验，全部通过才会一次保存。</div>`:`<div class="population-preview-line" style="color:#e0b060">${esc(plan.message||plan.reason)}</div>`;
  showPopulationActionPreview('合并购契预览',body,plan.ok);
}
function confirmPopulationAction(){
  const pending=_pendingPopulationAction;
  if(!pending)return;
  const button=document.getElementById('population-action-confirm');
  if(button)button.disabled=true;
  let result;
  if(pending.kind==='settlement')result=upgradeSettlementBatch(pending.key,pending.count,pending.expectedLv,pending.startingDeed);
  else if(pending.kind==='quick-deed')result=buyDeedsWithResource(pending.from,pending.deeds,pending.sourceCost,pending.startingDeed);
  else result=buyDeedsBasket(pending.sales,pending.deeds,pending.coinCost,pending.gains,pending.startingDeed);
  _pendingPopulationAction=null;
  document.getElementById('population-action-modal')?.classList.remove('active');
  if(result?.ok){toast(pending.kind==='settlement'?`扩建成功：人口上限 +${result.gain}`:`购得地契 ${result.deeds}`);}
  else if(result?.reason==='stale-quote'||result?.reason==='quote-required')toast('状态已变化，请重新预览');
  updateUI();
}
// ==================== 军营界面 ====================
function unitPortrait(key,size='card'){
  const artKey=['quantum_trooper','arcane_mage'].includes(key)?CFG.units[key]?.icon:key;
  if(typeof artKey!=='string'||!/^[a-z0-9_]+$/.test(artKey))return '';
  return `<img class="unit-portrait unit-portrait-${size}" src="./assets/art/units/hires/${artKey}.png" alt="" loading="lazy" decoding="async">`;
}
function calmStarBeastFromUI(){
  const result=calmStarBeastAlert();
  if(typeof toast==='function')toast(result.ok?`星兽警戒降至 ${result.alert}`:({
    'daily-limit':'今日三次镇静已用完','no-alert':'当前没有星兽警戒',
    'science-prerequisite':'需先研究星界兽域','save-failed':'保存失败，镇静未生效',
    'unavailable':'当前不能镇静星兽'
  }[result.reason]||'镇静失败'));
}
function toggleBarracksBranch(key){
  if(!S._barracksFold)S._barracksFold={};
  S._barracksFold[key]=!S._barracksFold[key];
  updateUI();
}
function rBarracks(){
  const tab=S._barracksTab||'train';
  let h=`<div class="barracks-page"><div class="barracks-overview">
    <div><span>总兵力</span><strong>${totalSoldiers()}</strong></div>
    <div><span>营帐上限</span><strong>${regMax()}<small>人/团</small></strong></div>
    <div><span>口粮消耗</span><strong>-${totalUpkeep().toFixed(1)}<small>/秒</small></strong></div>
  </div>`;
  // 主标签
  h+=`<div class="barracks-tabs">`;
  h+=`<button class="btn btn-sm ${tab==='train'?'btn-go':'btn-ghost'}" style="flex:1" onclick="setBarracksTab('train')">训练军队</button>`;
  h+=`<button class="btn btn-sm ${tab==='formation'?'btn-go':'btn-ghost'}" style="flex:1" onclick="setBarracksTab('formation')">阵容方案</button>`;
  h+=`</div>`;

  // 共用兵种卡片渲染
  function renderUnitCard(k,c){
    const poolCount=S.pool[k]||0,expCount=expeditionCount(k),garCount=garrisonCount(k);
    const ow=poolCount+expCount+garCount,lock=trainLockReason(k),queue=queueTotal(k);
    const tm=maxTrainable(k),disabled=tm<=0?'disabled':'';
    const isLockedUnit=c.locked && !(S.upgradedUnits||{})[k] && (baseUnitType(k)!==k||!!lock);
    const cap=unitCap(k);
    const isVariantLocked=!(S.upgradedUnits||{})[k]&&c.locked&&ow<=0&&queue<=0;
    let card=`<div class="card barracks-unit-card${lock?' is-unavailable':''}" data-unit="${k}">
      <div class="barracks-unit-head">
        ${unitPortrait(k,'card')}
        <div class="barracks-unit-name"><strong>${esc(c.name)}</strong><span>${esc(trainBuildingLabel(k))}</span></div>
        <button type="button" class="btn btn-ghost btn-xs barracks-detail-btn" onclick="openUnitDetail('${k}')">属性</button>
      </div>
      <div class="barracks-unit-meta"><span>${esc(c.passive.replace(/\n/g,' · '))}</span><span>攻击 ${weaponAttack(k)} · 防御 ${weaponDefense(k)}</span></div>
      <div class="barracks-unit-cost"><span>每人消耗</span><strong>${costHtml(c.cost)}</strong></div>
      ${!isVariantLocked?`<div class="barracks-unit-stock"><span>拥有 <strong>${ow}</strong> / 上限 ${cap}</span>${unitCapLeft(k)<=0?`<span class="limit-warn">已达上限</span>`:''}</div>`:''}
      ${queue?`<div class="barracks-unit-queue"><span>训练队列 ${queue} 人${(S.queue[k]||{}).reason?` · ${esc(S.queue[k].reason)}`:''}</span><button type="button" class="btn btn-ghost btn-xs" onclick="cancelQueue('${k}')">取消队列</button></div>`:''}
      ${isLockedUnit||lock?`<div class="barracks-unit-lock">${esc((lock||'尚未解锁').replace(/ ?\(科技点[^)]*\)/,''))}${expCount+garCount>0?' · 已编队兵员需先撤下再遣散':''}</div>
        ${ow>0||queue>0?`<div class="barracks-unit-actions">
          <label for="train-barracks-${k}">遣散人数</label>
          <input id="train-barracks-${k}" type="text" inputmode="numeric" pattern="[0-9]*" value="${(S._trainQty||{})[k]||1}" oninput="(S._trainQty||{})['${k}']=parseInt(this.value)||1">
          <button class="btn btn-danger btn-xs" onclick="dismissN('${k}',(S._trainQty||{})['${k}']||1)">遣散</button>
        </div>`:''}`:
      `<div class="barracks-unit-actions">
        <label for="train-barracks-${k}">训练人数</label>
        <input id="train-barracks-${k}" type="text" inputmode="numeric" pattern="[0-9]*" value="${(S._trainQty||{})[k]||1}" oninput="(S._trainQty||{})['${k}']=parseInt(this.value)||1">
        <button class="btn btn-go btn-xs" onclick="trainCustom('${k}','train-barracks-${k}')" ${disabled}>训练</button>
        <button class="btn btn-ghost btn-xs" onclick="trainMax('${k}','train-barracks-${k}')" ${disabled}>MAX</button>
        <button class="btn btn-danger btn-xs" onclick="dismissN('${k}',(S._trainQty||{})['${k}']||1)">遣散</button>
      </div>`}
    </div>`;
    return card;
  }

  if(tab==='train'){
    // ===== 训练军队标签 =====
    const branchOrder=['infantry','bronze_guard','iron_spearman','silver_heavy','gold_cavalry','alloy_special','armored_trooper','electro_trooper','star_trooper','quantum_trooper','archer','cavalry','mage','arcane_mage'];
    const branchNames={infantry:'步兵线',bronze_guard:'青铜刀盾兵',iron_spearman:'铁器长枪兵',silver_heavy:'白银重甲兵',gold_cavalry:'黄金重骑兵',alloy_special:'合金特种兵',armored_trooper:'蒸汽装甲兵',electro_trooper:'电磁兵',star_trooper:'星际先遣兵',quantum_trooper:'星界构装卫士',archer:'弓兵线',cavalry:'骑兵线',mage:'法师线',arcane_mage:'奥术师'};
    if(!S._barracksFold)S._barracksFold={};
    const readyBranches=[];
    for(const bu of branchOrder){
      const bKey=trainBuildingKey(bu);
      const cfg=bKey?CFG.buildings[bKey]:null;
      const st=bldSt(bKey);
      // 保留最新研究层、当前可训练层，以及旧档仍持有或排队的兵种。
      let latestTier=-1;
      let trainableTier=-1;
      for(const[k,c] of Object.entries(CFG.units)){
        if(baseUnitType(k)!==bu)continue;
        const tier=c.tier??0;
        const trainable=!trainLockReason(k);
        const ul=baseUnitType(k)===k||!!S.upgradedUnits[k];
        if(ul&&tier>latestTier)latestTier=tier;
        if(trainable&&tier>trainableTier)trainableTier=tier;
      }
      const lineUnits=[];
      let hasHistoricalStock=false;
      for(const[k,c] of Object.entries(CFG.units)){
        if(baseUnitType(k)!==bu)continue;
        const stock=(S.pool[k]||0)+expeditionCount(k)+garrisonCount(k)+queueTotal(k);
        const trainable=!trainLockReason(k);
        const researched=baseUnitType(k)===k||!!S.upgradedUnits[k];
        if(stock>0)hasHistoricalStock=true;
        if(stock>0||researched&&(c.tier??0)===latestTier||trainable&&(c.tier??0)===trainableTier)lineUnits.push([k,c]);
      }
      const shownTier=lineUnits.reduce((n,[,c])=>Math.max(n,c.tier??0),-1);
      const tierLabel=shownTier>=0?'T'+shownTier:'未解锁';
      const lineCap=unitCap(bu);
      const lineLeft=unitCapLeft(bu);
      // 解锁状态
      const scienceLock=cfg?.needScience&&!scienceUnlocked(cfg.needScience);
      const unitScience=CFG.units[bu]?.needScience;
      const unitScienceLock=unitScience&&!scienceUnlocked(unitScience);
      const bossLock=cfg&&!!buildingProgressLock(bKey);
      const notBuilt=!cfg||st.lv<=0;
      const isLocked=scienceLock||unitScienceLock||bossLock||notBuilt;
      const foldKey='line_'+bu;
      if((isLocked&&!hasHistoricalStock)||!lineUnits.length){delete S._barracksFold[foldKey];continue;}
      if(S._barracksFold[foldKey]===undefined)S._barracksFold[foldKey]=false;
      const folded=S._barracksFold[foldKey]===true;
      // 检查是否有满足条件的可研究升级
      let canResearch=false;
      const checkAfford=(fromKey,node,br)=> {
        if(S.upgradedUnits[br.to])return false;
        const target=CFG.units[br.to],targetTier=target?.tier??0;
        const freeRoot=fromKey===baseUnitType(fromKey)&&node.tier===0&&!node.unlock;
        if(!target||!freeRoot&&!S.upgradedUnits[fromKey])return false;
        if(checkTierLevel(targetTier)||!cfg||st.lv<=0||(st.tier??0)<targetTier)return false;
        if(cfg.needScience&&!scienceUnlocked(cfg.needScience)||target.needScience&&!scienceUnlocked(target.needScience))return false;
        if(buildingProgressLock(bKey))return false;
        return (S.res.tech||0)>=(br.needTech||0)
          && (S.merit||0)>=(br.needMerit||0)
          && S.res.wood>=(br.cost?.wood||0)
          && S.res.stone>=(br.cost?.stone||0)
          && S.res.food>=(br.cost?.food||0)
          && (!br.needEssence||(S.essence[br.needEssence.type]||0)>=br.needEssence.count);
      };
      const tree=CFG.unitUpgrades[bu]?.tree;
      if(tree){
        for(const[k,node] of Object.entries(tree)){
          if(!node||!node.branches)continue;
          for(const br of node.branches){if(checkAfford(k,node,br)){canResearch=true;break;}}
          if(canResearch)break;
        }
      }
      // 分支头
      let branchHtml=`<div class="branch-header barracks-branch-header" role="button" tabindex="0" aria-expanded="${!folded}" onclick="toggleBarracksBranch('${foldKey}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleBarracksBranch('${foldKey}')}">
        <span class="branch-arrow${folded?'':' open'}">▶</span>
        <span class="branch-icon">${unitPortrait(bu,'mini')}</span>
        <div class="barracks-branch-copy">
          <div class="barracks-branch-title">${branchNames[bu]} <span>${tierLabel}</span></div>
          <div class="barracks-branch-sub">${lineUnits.length} 种兵种 · 上限 ${lineCap}${st.lv>0?' · 可补 '+lineLeft:''}</div>
        </div>
        ${canResearch?`<span class="branch-badge-own">可研究</span>`:''}
      </div>`;
      // 折叠体
      branchHtml+=`<div class="branch-body${folded?' folded':' expanded'}">`;
      for(const[k,c] of lineUnits){
        branchHtml+=renderUnitCard(k,c);
      }
      branchHtml+=`</div>`;
      readyBranches.push(branchHtml);
    }
    h+=`<div class="section-kicker barracks-section-title">可训练兵种 <span>${readyBranches.length} 条兵种线</span></div>`;
    h+=readyBranches.length?readyBranches.join(''):`<div class="barracks-empty">当前没有可训练兵种。先完成对应研究并建造兵营。</div>`;
  }else{
    // ===== 阵容方案标签 =====
    const rowNames={front:'前排',mid:'中排',back:'后排'};
    // 远征阵容
    h+=`<div class="card"><h3>${pix('battle','card-pix')}远征阵容</h3>`;
    for(const row of['front','mid','back']){
      const slots=rowSlots(row);
      const units=S.formation[row]||[];
      h+=`<div style="margin:4px 0;font-size:12px;color:#aaa">${rowNames[row]} (${units.length}/${slots}格)</div>`;
      if(!units.length)h+=`<div style="font-size:10px;color:#555;padding:2px 8px">空</div>`;
      else for(const u of units){
        const uc=CFG.units[u.type];
        h+=`<div class="army-formation-unit">${unitPortrait(u.type,'mini')}${uc.name} <span class="army-formation-count">${u.count}</span></div>`;
      }
    }
    h+=`<div style="margin-top:8px;display:flex;gap:6px">
      <button class="btn btn-ghost btn-xs" onclick="useLastFormation('expedition')">使用上次阵容</button>
      <button class="btn btn-ghost btn-xs" onclick="clrForm('expedition')" style="color:#e06060">清空阵容</button>
      <button class="btn btn-ghost btn-xs" onclick="S.page='fight';S._fightTab='expedition';updateUI()">编队 →</button>
    </div></div>`;
    // 驻军阵容
    h+=`<div class="card"><h3>${pix('army','card-pix')}驻军阵容</h3>`;
    for(const row of['front','mid','back']){
      const slots=rowSlots(row);
      const units=(S._garrisonForm||{front:[],mid:[],back:[]})[row]||[];
      h+=`<div style="margin:4px 0;font-size:12px;color:#aaa">${rowNames[row]} (${units.length}/${slots}格)</div>`;
      if(!units.length)h+=`<div style="font-size:10px;color:#555;padding:2px 8px">空</div>`;
      else for(const u of units){
        const uc=CFG.units[u.type];
        h+=`<div class="army-formation-unit">${unitPortrait(u.type,'mini')}${uc.name} <span class="army-formation-count">${u.count}</span></div>`;
      }
    }
    h+=`<div style="margin-top:8px;display:flex;gap:6px">
      <button class="btn btn-ghost btn-xs" onclick="useLastFormation('garrison')">使用上次阵容</button>
      <button class="btn btn-ghost btn-xs" onclick="clrForm('garrison')" style="color:#e06060">清空阵容</button>
      <button class="btn btn-ghost btn-xs" onclick="S.page='fight';S._fightTab='garrison';updateUI()">编队 →</button>
    </div></div>`;
  }
  h+=`</div>`;return h;
}
// ==================== 战斗界面 ====================
function rFight(){
  const tab=S._fightTab||'expedition';
  let h=`<div style="padding:4px 0">`;
  h+=`<div style="display:flex;gap:4px;margin-bottom:6px">`;
  h+=`<button class="btn btn-sm ${tab==='expedition'?'btn-go':'btn-ghost'}" style="flex:1" onclick="setFightTab('expedition')">${pix('battle','mini')}远征</button>`;
  h+=`<button class="btn btn-sm ${tab==='garrison'?'btn-go':'btn-ghost'}" style="flex:1" onclick="setFightTab('garrison')">${pix('army','mini')}驻军</button>`;
  h+=`</div>`;

  if(tab==='expedition'){
    const form=S.formation;
    const rowNames={front:'前排',mid:'中排',back:'后排'};
    const rowCls={front:'r1',mid:'r2',back:'r3'};
    h+=`<div class="card"><h3>${pix('battle','card-pix')}远征阵容</h3>`;
    h+='<div style="font-size:10px;color:#e8b86a;margin-bottom:7px">近战兵只在前排主动攻击；中后排待前排倒下推进后才可出手。</div>';
    for(const row of['front','mid','back']){
      const slots=rowSlots(row);
      h+=`<div class="form-row ${rowCls[row]||''}"><div class="ftitle">${rowNames[row]} (${(form[row]||[]).length}/${slots}格)</div>`;
      for(let i=0;i<slots;i++){
        const u=form[row]?.[i];
        if(u){
          const uc=CFG.units[u.type];
          h+=`<span class="form-slot filled" onclick="openFormModal('expedition','${row}',${i})">
            ${pix(uc.icon,'sm')}<span style="font-size:10px;color:#e0e0e0">${uc.name}</span>
            <span class="qty-ctrl" style="margin-top:2px" onclick="event.stopPropagation()">
              <button onpointerdown="startLongPress('expedition','${row}',${i},-1)" onpointerup="stopLongPress()" onpointerleave="stopLongPress()">-</button>
              <span>${u.count}</span>
              <button onpointerdown="startLongPress('expedition','${row}',${i},1)" onpointerup="stopLongPress()" onpointerleave="stopLongPress()">+</button>
            </span>
            <div style="display:flex;gap:3px;margin-top:2px" onclick="event.stopPropagation()">
              <button class="btn btn-xs btn-ghost" onclick="fillFormMax('expedition','${row}',${i})" style="font-size:9px">MAX</button>
              <button class="btn btn-xs btn-ghost" onclick="removeFormSlot('expedition','${row}',${i})" style="font-size:9px;color:#e06060">✕</button>
            </div>
          </span>`;
        } else {
          h+=`<span class="form-slot" onclick="openFormModal('expedition','${row}',${i})"><span class="form-empty">+ 编入</span></span>`;
        }
      }
      h+=`</div>`;
    }
    h+=`<div style="display:flex;gap:6px;margin-top:8px">`;
    h+=`<button class="btn btn-ghost btn-sm" onclick="useLastFormation('expedition')">${pix('check','mini')}使用上次阵容</button>`;
    h+=`<button class="btn btn-ghost btn-sm" onclick="clrForm('expedition')" style="color:#e06060">${pix('reset','mini')}清空阵容</button>`;
    h+=`<button class="btn btn-ghost btn-sm" onclick="openTraining()">${pix('battle','mini')}训练场</button>`;
    h+=`</div>`;
    h+=`</div>`;

    // 关卡选择
    h+=`<div class="card"><h3>${pix('battle','card-pix')}关卡选择</h3>`;
    // 主线末关保留锁定预览；选项和开战都复用动作层的研究门。
    const hasSel=Number.isInteger(S.selEnemy)&&S.selEnemy>=0&&S.selEnemy<=campaignMaxSelectableIndex();
    const cur=hasSel?CFG.enemies[S.selEnemy]:null;
    const stageLock=cur?campaignStageLockReason(S.selEnemy):'';
    h+=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">`;
    h+=`<button class="btn btn-ghost btn-xs" onclick="selEnemy(${hasSel?(S.selEnemy-1):'null'})" ${!hasSel||S.selEnemy<=0?'disabled':''}>◀</button>`;
    h+=`<select onchange="this.blur();selEnemy(this.value===''?null:parseInt(this.value))" style="flex:1;background:#121224;color:#e0e0e0;border:1px solid #3a4158;padding:4px 8px;font-family:inherit;font-size:13px;cursor:pointer">`;
    h+=`<option value="" ${hasSel?'':'selected'}>-- 请选择关卡 --</option>`;
    for(let i=0;i<CFG.enemies.length;i++){
      if(i>campaignMaxSelectableIndex())continue;
      const e=CFG.enemies[i],df=S.defeated.includes(e.id);
      const locked=campaignStageLockReason(i);
      h+=`<option value="${i}" ${hasSel&&i===S.selEnemy?'selected':''} ${locked?'disabled':''}>${df?'✓ ':''}第${i+1}关 - ${e.name}${e.boss?' [BOSS]':''}${locked?' [待研究]':''}</option>`;
    }
    h+=`</select>`;
    h+=`<button class="btn btn-ghost btn-xs" onclick="selEnemy(${hasSel?(S.selEnemy+1):'null'})" ${!hasSel||!campaignStageSelectable(S.selEnemy+1)?'disabled':''}>▶</button>`;
    h+=`</div>`;
    if(cur){
      const df=S.defeated.includes(cur.id);
      h+=`<div style="background:#121224;border:1px solid #2b3144;border-radius:4px;padding:8px 10px;margin-bottom:8px">`;
      h+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span><strong>${cur.name}</strong> ${df?pix('check','mini'):''} ${cur.boss?pix('boss','mini'):''}</span>${df?'<span style="font-size:11px;color:#40bf80">已通关</span>':''}</div>`;
      h+=`<div style="font-size:11px;color:#888">${cur.desc||''}</div>`;
      const enemyInfo=Object.entries(cur.units).map(([k,counts])=>{const t=counts.reduce((a,b)=>a+b,0);return `${pix(CFG.units[k].icon,'mini')}${CFG.units[k].name}×${t}`;}).join(' ');
      h+=`<div style="font-size:10px;color:#777;margin-top:4px">${enemyInfo}</div>`;
      h+=`</div>`;
      if(stageLock)h+=`<div style="font-size:11px;color:#e8b86a;margin:-3px 0 8px">${pix('lock','mini')}${esc(stageLock)}</div>`;
    }
    h+=`<button class="btn btn-go" style="width:100%" onclick="openBattle()" ${cur&&!stageLock?'':'disabled'}>${pix('battle','mini')}开战</button>`;
    h+=`</div>`;
    // 拓境是独立于百关主线的发展副本；复用现有卡片样式，避免干扰并行美术工作。
    h+=`<div class="card"><h3>${pix('battle','card-pix')}拓境远征</h3>`;
    h+=`<div style="font-size:11px;color:#aaa;margin-bottom:7px">边疆占领采集点，外域回收地契、战备勋章与兵种研究精魄；胜利另得战功，不计入百关主线。使用当前远征编队，战损照常结算。</div>`;
    for(const [site,domain] of Object.entries(CFG.developmentBorder)){
      const unlocked=scienceUnlocked(domain.needScience),point=S.development.border.sites[site];
      const selected=S.development.border.collection.activeSite===site;
      const reward=Object.entries(domain.reward).map(([key,amount])=>`${esc(resourceDisplayName(key))} ×${amount}`).join('、');
      h+=`<div style="border-top:1px dashed #34394b;padding-top:7px;margin-top:7px;font-size:11px;color:#aaa">${esc(domain.name)} · 点位 ${point.level}/${CFG.developmentCollection.maxLevel}级 · 警戒 ${Math.min(13000,point.wins*domain.alertPerWin)} · 基础战利品 ${reward}、战功 ×${domain.researchReward.merit}</div>`;
      h+=`<div style="font-size:10px;color:#888;margin:3px 0">${unlocked?'胜利提升点位；仅选中的一处每'+CFG.developmentCollection.periodSec+'秒采集'+(selected?'（剩余 '+(CFG.developmentCollection.periodSec-S.development.border.collection.elapsedSec)+' 秒）':''):'需研究「'+esc(sciName(domain.needScience))+'」'}</div>`;
      h+=`<button class="btn btn-go btn-xs" onclick="openDevelopmentBorder('${site}')" ${unlocked&&formCnt()>0?'':'disabled'}>挑战</button>`;
      if(point.level>0)h+=` <button class="btn btn-ghost btn-xs" onclick="selectDevelopmentSiteFromUI(${selected?'null':`'${site}'`})">${selected?'停止采集':'设为采集点'}</button>`;
    }
    for(const [region,domain] of Object.entries(CFG.developmentOuter)){
      const unlocked=scienceUnlocked(domain.needScience),state=S.development.outer[region];
      const encounter=materialDomainEncounter(domain.key);
      const reward=Object.entries(domain.reward).map(([key,amount])=>`${esc(resourceDisplayName(key))} ×${amount}`).join('、');
      h+=`<div style="border-top:1px dashed #34394b;padding-top:7px;margin-top:7px;font-size:11px;color:#aaa">${esc(domain.name)} · 胜场 ${state.wins} · 警戒 ${Math.min(13000,state.alert)} · 基础战利品 ${reward}、战功 ×${domain.researchReward.merit}</div>`;
      if(domain.researchReward.essenceCycles)h+=`<div style="font-size:10px;color:#aaa;margin:3px 0">轮换精魄：${domain.researchReward.essenceCycles.map(cycle=>cycle.map(key=>esc(CFG.essences[key].name)).join('／')).join(' + ')}</div>`;
      h+=`<div style="font-size:10px;color:#888;margin:3px 0">稀有掉落：${esc(CFG.eraMaterials.sacredBlood.name)} ${(encounter.bloodDropChance/100).toFixed(2)}%${encounter.emberDropChance>0?' · '+esc(CFG.eraMaterials.emberElixir.name)+' '+(encounter.emberDropChance/100).toFixed(2)+'%':''}</div>`;
      if(!unlocked)h+=`<div style="font-size:10px;color:#888;margin:3px 0">需研究「${esc(sciName(domain.needScience))}」</div>`;
      h+=`<button class="btn btn-go btn-xs" onclick="openDevelopmentOuter('${region}')" ${unlocked&&formCnt()>0?'':'disabled'}>挑战</button>`;
    }
    h+='</div>';
    const wild=CFG.wildHunt,wildEncounter=materialDomainEncounter(wild.key),boneStock=S.res.bone||0;
    h+=`<div class="card"><h3>${pix('wild_boar','card-pix')}郊野猎场</h3>`;
    h+=`<div style="font-size:11px;color:#aaa;margin-bottom:5px">${esc(wild.name)} · 胜利预计兽骨 ×${wildEncounter.reward.bone}、兽皮 ×${wildEncounter.reward.hide}；可重复挑战</div>`;
    h+=`<div style="font-size:10px;color:#888;margin-bottom:6px">郊野警戒值 ${S.killValues.wildBoar} · 兽骨 ${boneStock} · 兽皮 ${S.res.hide} · 兽心 ${S.items.boarHeart}；胜利有 ${wildEncounter.heartChance}% 几率得兽心 ×${wildEncounter.heartAmount}；战损按实际结算</div>`;
    h+=`<button class="btn btn-go" style="width:100%" onclick="openMaterialDomain('bone')" ${formCnt()>0?'':'disabled'}>狩猎兽群</button>`;
    for(const hunt of Object.values(CFG.wildHunts)){
      const encounter=materialDomainEncounter(hunt.key),item=CFG.eraMaterials[hunt.dropItem],unitKey=Object.keys(hunt.units)[0];
      h+=`<div style="border-top:1px dashed #34394b;margin-top:7px;padding-top:7px;font-size:10px;color:#aaa">${pix(CFG.units[unitKey].icon,'mini')}${esc(hunt.name)} · 警戒值 ${S.killValues[hunt.killValueKey]} · ${esc(item.name)} ${S.items[hunt.dropItem]} · 掉落 ${encounter.heartChance}% ×${encounter.heartAmount}</div>`;
      h+=`<button class="btn btn-go btn-xs" onclick="openMaterialDomain('${hunt.key}')" ${formCnt()>0?'':'disabled'}>狩猎${esc(CFG.units[unitKey].name)}</button>`;
    }
    h+=`<div style="border-top:1px dashed #34394b;margin-top:8px;padding-top:7px;font-size:10px;color:#aaa">${esc(CFG.beastExchange.name)} · 兽骨 ${beastBoneTradeCost()} 换${esc(resourceDisplayName('medal'))} ${beastBoneTradeReward()}，每次必成、不占市场每日次数</div>`;
    h+=`<div style="display:flex;gap:5px;margin-top:4px"><input id="bone-trade-count" type="text" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="兽骨兑换份数" style="width:66px"><button class="btn btn-go btn-xs" onclick="exchangeBonesFromUI()" ${boneStock>=beastBoneTradeCost()?'':'disabled'}>兑换</button></div>`;
    const bx=S.beastExchange,bxc=CFG.beastExchange,need=beastExchangeProgressNeed(bx.level);
    h+=`<div style="border-top:1px dashed #34394b;margin-top:8px;padding-top:7px;font-size:10px;color:#aaa">边贸行 Lv${bx.level}/${bxc.maxLevel} · 交易进度 ${bx.progress}/${need}（每笔兑换计1，满进度后手动升级）</div>`;
    h+=`<button class="btn btn-go btn-xs" onclick="beastExchangeActionFromUI('upgrade')" ${bx.level<bxc.maxLevel&&bx.progress>=need?'':'disabled'}>提升边贸行</button>`;
    h+=`<div style="font-size:10px;color:#888;margin-top:6px">30级开放：机巧拓仓图纸Ⅰ · 六类郊野材料可分别换取；每张使非货币资源容量 +1%，最多使用 ${bxc.scrollUseLimit} 张。图纸库存 ${S.items.storageScroll} · 已用 ${bx.scrollUsed}</div>`;
    h+=`<div style="font-size:10px;color:#888">刷新次数 ${bx.refreshCharges}/${bxc.maxRefreshCharges} · 下次恢复／自动刷新 ${bx.refreshClock} 秒</div><button class="btn btn-go btn-xs" onclick="beastExchangeActionFromUI('refresh')" ${bx.refreshCharges>0?'':'disabled'}>刷新货品</button>`;
    const hideGoods=Object.entries(bxc.hideTrades).filter(([id])=>bx.hideOffers[id]?.count>0);
    h+=`<div style="font-size:10px;color:#888;margin-top:7px">兽皮 ${S.res.hide} · 早期物资货位每20分钟刷新；当前上架 ${hideGoods.reduce((sum,[id])=>sum+bx.hideOffers[id].count,0)} 份</div>`;
    if(hideGoods.length){
      h+=`<input id="hide-trade-count" type="text" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="兽皮兑换份数" style="width:66px">`;
      for(const [id,trade] of hideGoods){
        const offer=bx.hideOffers[id],cost=beastHideTradeCost(id),gain=beastHideTradeReward(id);
        h+=`<div style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin-top:4px;font-size:10px;color:#aaa"><span>${esc(resourceDisplayName(trade.get))} · 上架 ${offer.count} · ${cost}兽皮换${gain}</span><button class="btn btn-go btn-xs" onclick="exchangeHideFromUI('${id}')" ${S.res.hide>=cost&&S.res[trade.get]+gain<=resCap(trade.get)?'':'disabled'}>兑物资</button></div>`;
      }
    }
    h+=`<div style="display:flex;gap:5px;margin-top:4px"><input id="heart-trade-count" type="text" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="图纸兑换或使用份数" style="width:66px"><button class="btn btn-go btn-xs" onclick="beastExchangeActionFromUI('use')" ${S.items.storageScroll>0&&bx.scrollUsed<bxc.scrollUseLimit?'':'disabled'}>使用图纸</button></div>`;
    for(const materialKey of bxc.scrollMaterials){
      const item=CFG.eraMaterials[materialKey],stock=beastScrollOfferCount(materialKey),cost=beastScrollTradeCost(materialKey),click=materialKey==='boarHeart'?"beastExchangeActionFromUI('trade')":`beastExchangeActionFromUI('trade','${materialKey}')`;
      h+=`<div style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin-top:4px;font-size:10px;color:#aaa"><span>${esc(item.name)} ${S.items[materialKey]} · 上架 ${stock} · 每份 ${cost}</span><button class="btn btn-go btn-xs" onclick="${click}" ${bx.level>=bxc.scrollLevel&&stock>0&&S.items[materialKey]>=cost?'':'disabled'}>兑图纸</button></div>`;
    }
    for(const [tierKey,trade] of Object.entries(bxc.highScrollTrades||{})){
      const tier=Number(tierKey),itemKey=`storageScroll${tier}`,stock=S.items[itemKey]||0,used=bx.scrollUsedTiers?.[tier]||0;
      if(bx.level<trade.level&&stock===0&&used===0)continue;
      const offer=bx.tierOffers?.[tier],offerCount=offer?.count||0,cost=beastTierScrollTradeCost(tier),name=CFG.eraMaterials[itemKey].name;
      h+=`<div style="border-top:1px dashed #34394b;margin-top:7px;padding-top:6px;font-size:10px;color:#aaa">${esc(name)} · 库存 ${stock} · 已用 ${used}/${trade.useLimit} · 每张仓容 +${(trade.capacityPerUse*100).toFixed(1).replace(/\.0$/,'')}%</div>`;
      h+=`<div style="font-size:10px;color:#888">上架 ${offerCount} · ${cost} 张${esc(CFG.eraMaterials.storageScroll.name)}换 1 张${esc(name)}</div>`;
      h+=`<div style="display:flex;gap:5px;margin-top:4px"><input id="tier-scroll-count-${tier}" type="text" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="${esc(name)}兑换或使用份数" style="width:66px"><button class="btn btn-go btn-xs" onclick="tierScrollActionFromUI('trade',${tier})" ${bx.level>=trade.level&&offerCount>0&&S.items.storageScroll>=cost&&stock<CFG.eraMaterials[itemKey].max?'':'disabled'}>兑换密卷</button><button class="btn btn-go btn-xs" onclick="tierScrollActionFromUI('use',${tier})" ${stock>0&&used<trade.useLimit?'':'disabled'}>使用密卷</button></div>`;
    }
    if(bx.level>=bxc.medalOfferTrade.level){
      const trade=bxc.medalOfferTrade;
      h+=`<div style="font-size:10px;color:#888;margin-top:7px">60级限时勋章货位 · 上架 ${bx.medalOffers} · ${trade.boneCost}兽骨换${trade.medalGain}${esc(resourceDisplayName('medal'))}</div>`;
      h+=`<div style="display:flex;gap:5px;margin-top:4px"><input id="medal-offer-count" type="text" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="限时勋章兑换份数" style="width:66px"><button class="btn btn-go btn-xs" onclick="exchangeMedalOfferFromUI()" ${bx.medalOffers>0&&boneStock>=trade.boneCost?'':'disabled'}>兑换勋章</button></div>`;
    }
    h+=`<div style="font-size:10px;color:#888;margin-top:7px">60级开放：战剂／秘剂兑换${CFG.eraMaterials.soulStone.name}，需抽到对应货位。当前铭石 ${S.items.soulStone}</div>`;
    if(bx.level>=bxc.soulTradeLevel){
      h+=`<input id="soul-trade-count" type="text" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="铭石兑换份数" style="width:66px">`;
      for(const [materialKey,trade] of Object.entries(bxc.soulTrades)){
        const stock=bx.soulOffers[materialKey];
        h+=`<div style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin-top:4px;font-size:10px;color:#aaa"><span>${esc(CFG.eraMaterials[materialKey].name)} ${S.items[materialKey]} · 上架 ${stock} · ${trade.cost}份换${trade.stones}铭石</span><button class="btn btn-go btn-xs" onclick="exchangeSoulElixirFromUI('${materialKey}')" ${stock>0&&S.items[materialKey]>=trade.cost?'':'disabled'}>兑铭石</button></div>`;
      }
    }
    h+='</div>';
    if(scienceUnlocked('sci_alloy_age')){
      const domain=CFG.godDomain,unlocked=scienceUnlocked(domain.needScience);
      const encounter=godDomainEncounter();
      const crystalName=CFG.eraMaterials.godCrystal.name,scienceName=sciName(domain.needScience);
      h+=`<div class="card"><h3>${pix('mage_space','card-pix')}机巧遗迹</h3>`;
      h+=`<div style="font-size:11px;color:#aaa;margin-bottom:5px">${domain.name} · 本次胜利预计${crystalName} ×${encounter.reward.godCrystal} ＋ ${esc(resourceDisplayName('medal'))} ×${encounter.reward.medal} ＋ ${CFG.eraMaterials.sacredBlood.name} ×${encounter.reward.sacredBlood}；${CFG.eraMaterials.emberElixir.name} ${encounter.emberDropChance/100}%概率、${CFG.eraMaterials.aegisElixir.name} ${encounter.aegisDropChance/100}%概率，可重复挑战</div>`;
      h+=`<div style="font-size:10px;color:#888;margin-bottom:8px">${unlocked?'当前库存 '+S.items.godCrystal+' · 警戒值 '+S.killValues.godRevival:'先研究「'+scienceName+'」（知识 50000＋钢 5000）'}；遗迹警戒值越高，守卫越强，使用远征编队，战损按实际结算</div>`;
      h+=`<button class="btn btn-go" style="width:100%" onclick="openGodDomain()" ${unlocked&&formCnt()>0?'':'disabled'}>探索遗迹</button>`;
      if(scienceUnlocked('sci_electric_age'))h+=`<button class="btn btn-ghost btn-xs" onclick="useDomainCleanserFromUI('godCrystal')" ${unlocked&&S.items.domainCleanser>0&&S.killValues.godRevival>=200?'':'disabled'}>镇域净化剂 ${S.items.domainCleanser} · 警戒 -100</button>`;
      h+='</div>';
    }
    if(scienceUnlocked('sci_god_domain')||S.items.sacredBlood>0||S.items.emberElixir>0||S.items.aegisElixir>0||Object.keys(S.bloodline).length>0||Object.keys(S.attackInfusions).length>0||Object.keys(S.aegisInfusions).length>0){
      const bloodChoices=Object.entries(CFG.units).filter(([key,cfg])=>!cfg.enemyOnly&&ownedUnitCount(key)>0);
      const bloodOptions=bloodChoices.map(([key,cfg])=>`<option value="${key}">${esc(cfg.name)} · ${S.bloodline[key]||0}/${CFG.bloodline.limitPerUnit}</option>`).join('');
      const emberOptions=bloodChoices.map(([key,cfg])=>`<option value="${key}">${esc(cfg.name)} · ${S.attackInfusions[key]||0}/${CFG.emberElixir.limitPerUnit}</option>`).join('');
      const aegisOptions=bloodChoices.map(([key,cfg])=>`<option value="${key}">${esc(cfg.name)} · ${S.aegisInfusions[key]||0}/${CFG.aegisElixir.limitPerUnit}</option>`).join('');
      h+=`<div class="card"><h3>${pix('mage_space','card-pix')}圣兽血脉</h3>`;
      h+=`<div style="font-size:11px;color:#aaa;margin-bottom:5px">圣兽血剂 ${S.items.sacredBlood} · 每份为所选兵种永久增加基础生命 1%，单兵种最多 ${CFG.bloodline.limitPerUnit} 份。血剂也可在市场兑换镇域净化剂。</div>`;
      h+=`<div style="display:flex;gap:5px;flex-wrap:wrap"><select id="bloodline-unit" aria-label="血脉淬炼兵种" style="flex:1;min-width:150px">${bloodOptions}</select><input id="bloodline-count" aria-label="血剂使用份数" type="text" inputmode="numeric" pattern="[0-9]*" value="1" style="width:55px"><button class="btn btn-go btn-xs" onclick="useSacredBloodFromUI()" ${bloodChoices.length&&S.items.sacredBlood>0?'':'disabled'}>淬炼</button></div>`;
      h+=`<div style="font-size:11px;color:#aaa;margin:8px 0 5px">炽翼战剂 ${S.items.emberElixir} · 每份为所选兵种永久增加基础攻击 10%，单兵种最多 ${CFG.emberElixir.limitPerUnit} 份；也可在市场用 20 份血剂兑换。</div>`;
      h+=`<div style="display:flex;gap:5px;flex-wrap:wrap"><select id="ember-unit" aria-label="炽翼战剂兵种" style="flex:1;min-width:150px">${emberOptions}</select><input id="ember-count" aria-label="战剂使用份数" type="text" inputmode="numeric" pattern="[0-9]*" value="1" style="width:55px"><button class="btn btn-go btn-xs" onclick="useEmberElixirFromUI()" ${bloodChoices.length&&S.items.emberElixir>0?'':'disabled'}>淬炼攻击</button></div>`;
      h+=`<div style="font-size:11px;color:#aaa;margin:8px 0 5px">圣盾秘剂 ${S.items.aegisElixir} · 每份为所选兵种永久增加防御 1、基础攻击与生命各 5%，单兵种最多 ${CFG.aegisElixir.limitPerUnit} 份；市场需 3 份炽翼战剂。</div>`;
      h+=`<div style="display:flex;gap:5px;flex-wrap:wrap"><select id="aegis-unit" aria-label="圣盾秘剂兵种" style="flex:1;min-width:150px">${aegisOptions}</select><input id="aegis-count" aria-label="秘剂使用份数" type="text" inputmode="numeric" pattern="[0-9]*" value="1" style="width:55px"><button class="btn btn-go btn-xs" onclick="useAegisElixirFromUI()" ${bloodChoices.length&&S.items.aegisElixir>0?'':'disabled'}>淬炼防护</button></div></div>`;
    }
    if(scienceUnlocked('sci_electric_age')){
      for(const [key,domain] of Object.entries(CFG.godDomains)){
        if(!scienceUnlocked(domain.needScience))continue;
        if(domain.soulRealm){
          const team=S.soulRealmTeam,alert=S.killValues.soulRealm;
          h+=`<div class="card"><h3>${pix('soul_wraith','card-pix')}${esc(domain.name)}</h3>`;
          h+=`<div style="font-size:11px;color:#aaa;margin-bottom:7px">英魂铭石 ${S.items.soulStone} · 警戒值 ${alert}。九个敌位独立出现，胜利只清除所选敌位，并按该英魂增加警戒。</div>`;
          if(team)for(let i=0;i<team.slots.length;i++){
            const id=team.slots[i],tier=soulRealmTier(id);
            if(!tier){h+=`<div style="font-size:11px;color:#888">${i+1}号敌位 · 已击败</div>`;continue}
            const encounter=materialDomainEncounter(key,alert,id);
            h+=`<button class="btn btn-go btn-xs" style="margin:0 4px 5px 0" onclick="openSoulRealmSlot(${i})" ${formCnt()>0?'':'disabled'}>${i+1}号 · ${esc(tier.name)} · 铭石 ×${encounter.reward.soulStone} · 警戒 +${tier.alert}</button>`;
          }
          h+=`<button class="btn btn-ghost btn-xs" onclick="refreshSoulRealmTeam()" ${soulRealmRefreshAllowed()?'':'disabled'}>${team?'刷新敌位':'生成敌位'}</button>`;
          h+=`<div style="font-size:10px;color:#888;margin-top:6px">每日可刷新一次；九位全胜后可立即刷新。战败和撤退保留敌位。</div></div>`;
          continue;
        }
        const encounter=materialDomainEncounter(key),material=domain.resourceReward?CFG.res[key]:CFG.eraMaterials[key],kill=S.killValues[domain.killValueKey];
        const stock=domain.resourceReward?S.res[key]:S.items[key];
        const icon=CFG.units[Object.keys(domain.units)[0]].icon;
        const bonusItems=Object.keys(domain.bonusItemReward||{});
        const bonusText=bonusItems.map(itemKey=>` ＋ ${esc(CFG.eraMaterials[itemKey].name)} ×${encounter.reward[itemKey]}`).join('');
        const bonusStock=bonusItems.map(itemKey=>` · ${esc(CFG.eraMaterials[itemKey].name)} ${S.items[itemKey]}`).join('');
        h+=`<div class="card"><h3>${pix(icon,'card-pix')}${esc(domain.name)}</h3>`;
        h+=`<div style="font-size:11px;color:#aaa;margin-bottom:5px">本次胜利预计${esc(material.name)} ×${encounter.reward[key]}${domain.bonusReward?.medal?` ＋ ${esc(resourceDisplayName('medal'))} ×${encounter.reward.medal}`:''}${bonusText}${domain.soulRealm?'；可重复挑战':`；${CFG.eraMaterials.emberElixir.name} ${encounter.emberDropChance/100}%概率、${CFG.eraMaterials.aegisElixir.name} ${encounter.aegisDropChance/100}%概率，可重复挑战`}</div>`;
      h+=`<div style="font-size:10px;color:#888;margin-bottom:8px">当前库存 ${stock}${bonusStock} · 挑战威胁等级 ${kill}；等级越高，敌人越强，使用远征编队，战损按实际结算</div>`;
        h+=`<button class="btn btn-go" style="width:100%" onclick="openMaterialDomain('${key}')" ${formCnt()>0?'':'disabled'}>挑战${esc(domain.name)}</button>`;
        if(!domain.noCleanser)h+=`<button class="btn btn-ghost btn-xs" onclick="useDomainCleanserFromUI('${key}')" ${S.items.domainCleanser>0&&kill>=200?'':'disabled'}>镇域净化剂 ${S.items.domainCleanser} · 警戒 -100</button>`;
        h+='</div>';
      }
    }
    if(scienceUnlocked(CFG.starBeast.needScience)){
      const c=CFG.starBeast,alert=S.killValues.starBeast,calms=dailyCount('starBeastCalm');
      h+=`<div class="card"><h3>${pix('wild_wyrm','card-pix')}星界兽域</h3>`;
      h+=`<div style="font-size:11px;color:#aaa;margin-bottom:6px">九阶星兽每日各可击败一次，每胜得星辉原石、幻相石、圣环核石，用于星辉圣阵。当前警戒 ${alert}；每满1000警戒强化星兽。战损按实际结算。</div>`;
      h+=`<button class="btn btn-ghost btn-xs" onclick="calmStarBeastFromUI()" ${calms<c.freeCalmsPerDay&&alert>0?'':'disabled'}>镇静警戒 -${c.calmAmount} · 今日 ${Math.max(0,c.freeCalmsPerDay-calms)}/${c.freeCalmsPerDay}</button>`;
      for(const t of c.tiers){
        const key='starBeast'+t.tier,done=dailyCount(key)>0,e=materialDomainEncounter(key);
        h+=`<button class="btn btn-go btn-xs" style="margin:5px 4px 0 0" onclick="openMaterialDomain('${key}')" ${done||formCnt()===0?'disabled':''}>${t.tier}阶星兽 · 三材各 ×${e.reward.starOriginStone}${done?' · 今日已胜':''}</button>`;
      }
      h+='</div>';
    }
    if(scienceUnlocked('sci_astral_lord')){
      const choices=Object.entries(CFG.units).filter(([key,cfg])=>!cfg.enemyOnly&&ownedUnitCount(key)>0);
      const options=choices.map(([key,cfg])=>{const rank=S.soulRanks[key]||{rank:0,stars:0};
        return `<option value="${key}">${esc(cfg.name)} · ${rank.rank}阶 ${rank.stars}星 · 下步 ${soulRankCost(key)}铭石</option>`}).join('');
      h+=`<div class="card"><h3>${pix('mage_space','card-pix')}英魂升阶</h3>`;
      h+=`<div style="font-size:11px;color:#aaa;margin-bottom:5px">英魂铭石 ${S.items.soulStone} · 每阶先升满10星，再升下一阶，最高5阶。每阶基础攻击 +50%、基础生命 +100%；每星基础生命 +10%。铭石来自英魂遗境或60级边贸行兑换。</div>`;
      h+=`<div style="display:flex;gap:5px;flex-wrap:wrap"><select id="soul-rank-unit" aria-label="英魂升阶兵种" style="flex:1;min-width:150px">${options}</select><button class="btn btn-go btn-xs" onclick="upgradeSoulRankFromUI()" ${choices.length?'':'disabled'}>升星／升阶</button></div></div>`;
    }
    if(scienceUnlocked('sci_nuclear_age')){
      const a=S.awakening.star_trooper,cost=awakeningTrialCost(),fruit=S.items.trialFruit;
      const deployed=['front','mid','back'].some(row=>S.formation[row].some(u=>u.type==='star_trooper'&&u.count>0));
      h+=`<div class="card"><h3>${pix('star_trooper','card-pix')}圣域试炼 · 星际先遣兵</h3>`;
      h+=`<div style="font-size:11px;color:#aaa;margin-bottom:5px">觉醒 ${a.level}/20阶 · 星辉 ${a.stars} · 全军基础攻击与生命每星 +0.2%</div>`;
      h+=`<div style="font-size:10px;color:#888;margin-bottom:8px">圣域异果 ${fruit} · 每次试炼消耗 ${cost}（当前阶数×10＋首个出战兵团人数）；胜利升1阶，战败仍消耗异果</div>`;
      for(const [mode,trial] of Object.entries(CFG.awakening.trials))h+=`<button class="btn btn-go btn-xs" onclick="openAwakeningTrialFromUI('${mode}')" ${deployed&&fruit>=cost&&a.level<20?'':'disabled'}>${trial.name}试炼</button> `;
      h+='</div>';
    }
  } else {
    // 驻军
    const g=S.garrison||{};
    const form=S._garrisonForm||{front:[],mid:[],back:[]};
    const rowNames={front:'前排',mid:'中排',back:'后排'};
    const rowCls={front:'r1',mid:'r2',back:'r3'};
    h+=`<div class="card"><h3>${pix('army','card-pix')}驻军阵容</h3>`;
    h+='<div style="font-size:10px;color:#e8b86a;margin-bottom:7px">近战兵只在前排主动攻击；中后排待前排倒下推进后才可出手。</div>';
    for(const row of['front','mid','back']){
      const slots=rowSlots(row);
      h+=`<div class="form-row ${rowCls[row]||''}"><div class="ftitle">${rowNames[row]} (${(form[row]||[]).length}/${slots}格)</div>`;
      for(let i=0;i<slots;i++){
        const u=form[row]?.[i];
        if(u){
          const uc=CFG.units[u.type];
          h+=`<span class="form-slot filled" onclick="openFormModal('garrison','${row}',${i})">
            ${pix(uc.icon,'sm')}<span style="font-size:10px;color:#e0e0e0">${uc.name}</span>
            <span class="qty-ctrl" style="margin-top:2px" onclick="event.stopPropagation()">
              <button onpointerdown="startLongPress('garrison','${row}',${i},-1)" onpointerup="stopLongPress()" onpointerleave="stopLongPress()">-</button>
              <span>${u.count}</span>
              <button onpointerdown="startLongPress('garrison','${row}',${i},1)" onpointerup="stopLongPress()" onpointerleave="stopLongPress()">+</button>
            </span>
            <div style="display:flex;gap:3px;margin-top:2px" onclick="event.stopPropagation()">
              <button class="btn btn-xs btn-ghost" onclick="fillFormMax('garrison','${row}',${i})" style="font-size:9px">MAX</button>
              <button class="btn btn-xs btn-ghost" onclick="removeFormSlot('garrison','${row}',${i})" style="font-size:9px;color:#e06060">✕</button>
            </div>
          </span>`;
        } else {
          h+=`<span class="form-slot" onclick="openFormModal('garrison','${row}',${i})"><span class="form-empty">+ 编入</span></span>`;
        }
      }
      h+=`</div>`;
    }
    h+=`<div style="display:flex;gap:6px;margin-top:8px">`;
    h+=`<button class="btn btn-ghost btn-sm" onclick="useLastFormation('garrison')">${pix('check','mini')}使用上次阵容</button>`;
    h+=`<button class="btn btn-ghost btn-sm" onclick="clrForm('garrison')" style="color:#e06060">${pix('reset','mini')}清空驻军</button>`;
    h+=`</div>`;
    h+=`</div>`;

    // 驻军状态与操作
    h+=`<div class="card"><h3>${pix('army','card-pix')}驻军状态</h3>`;
    h+=`<div style="font-size:11px;color:#888;margin-bottom:4px">驻军功勋: <span style="color:#c0a060">${S.merit||0}</span> · 驻军人数: ${garrisonTotal()}</div>`;
    const gsText=typeof garrisonStatusText==='function'?garrisonStatusText(garrisonTotal()>0):'巡逻中';
    h+=`<div style="font-size:11px;color:#aaa;margin-bottom:8px">状态: ${gsText}</div>`;
    h+=`<button class="btn btn-ghost btn-sm" onclick="triggerGarrisonInvasion()">${pix('battle','mini')}测试触发入侵</button>`;
    h+=`</div>`;

    // 驻军日志
    h+=`<div class="card"><h3>${pix('log','card-pix')}最近驻军事件</h3>`;
    h+=`<div style="max-height:120px;overflow-y:auto;font-size:11px;line-height:1.8">`;
    const gl=[...(S.garrisonLog||[])].reverse().slice(0,6);
    if(!gl.length)h+=`<span style="color:#666">暂无驻军事件</span>`;
    else for(const e of gl)h+=`<span style="color:#555">[${e.time}]</span> ${e.msg}<br>`;
    h+=`</div></div>`;
  }

  h+=`</div>`;
  return h;
}
let _techEssenceOpen=false;
function setTechEssenceOpen(open){_techEssenceOpen=!!open;}
function rTechFull(){
  const boss=bossDefeatedCount();
  let h=`<div style="padding:4px 0">`;

  // 兵种图谱先显示兵种；库存保留完整明细，需要时展开。
  const essenceKinds=Object.keys(CFG.essences||{}).filter(key=>(S.essence?.[key]||0)>0).length;
  h+=`<details id="tech-essence-inventory" class="card tech-essence-inventory" ${_techEssenceOpen?'open':''} ontoggle="if(this.isConnected)setTechEssenceOpen(this.open)">
    <summary>${pix('tech','card-pix')}<span>精魄库存</span><small>已持有 ${essenceKinds} 类</small></summary>`;
  h+=`<div style="font-size:10px;color:#888;margin-bottom:6px">主线Boss概率掉落，外域军屯村寨与工造军镇按胜次轮换获得；用于解锁T2/T3兵种</div>`;
  h+=`<div style="display:flex;flex-wrap:wrap;gap:2px;padding:4px 0">`;
  let hasEssence=false;
  for(const[ek,ei] of Object.entries(CFG.essences||{})){
    const cnt=S.essence[ek]||0;
    hasEssence=hasEssence||cnt>0;
    h+=`<span style="display:inline-flex;align-items:center;gap:3px;margin:2px 8px 2px 0;font-size:11px;color:#aab">
      ${pix(ei.icon||ek,'mini')} ${ei.name}: <span style="color:${cnt>0?'#f0d060':'#555'}">${cnt}</span></span>`;
  }
  if(!hasEssence)h+=`<span style="font-size:10px;color:#555">暂无精魄，可挑战主线Boss或拓境外域</span>`;
  h+=`</div>`;
  h+=`<div style="font-size:10px;color:#888;margin-top:4px">击败Boss: ${boss} | 科技点: <span style="color:#f0d060">${Math.floor(S.res.tech||0)}</span> | 战功: <span style="color:#c0a060">${S.merit||0}</span></div>`;
  h+=`</details>`;

  // 资源科技（切片5 · S2 长阶梯 · 对齐放置时代发展科技 45xxxx：纯科技门）
  // 注意：此块必须在 ui.js 的 rTech 内（technology.js 的 rTech 被本文件覆盖，不生效）
  h+=`<div class="card"><h3>${pix('academy','card-pix')}资源科技</h3>`;
  h+=`<div style="font-size:10px;color:#888;margin-bottom:6px">研究消耗科技点${(CFG.tech&&CFG.tech.sciencesNoMerit)?'（战功豁免）':' + 战功'}；煤链研究开放对应岗位，工坊和专仓提供增效、扩容</div>`;
  for(const[id,sc] of Object.entries((typeof activeSciences==='function')?activeSciences():(CFG.sciences||{}))){
    const done=S.sciences.includes(id);
    if((sc.legacyOnly||sc.storageMode&&sc.storageMode!==S.storageMode||sc.currencyMode&&sc.currencyMode!==S.currencyRecipeMode)&&!done)continue;
    const needs=typeof scienceNeedIds==='function'?scienceNeedIds(id,sc):(sc.need||[]);
    const pre=needs.some(p=>!S.sciences.includes(p));
    if(pre&&!done)continue;
    const meritEff=(CFG.tech&&CFG.tech.sciencesNoMerit)?0:(sc.cost.merit||0);
    const resourceCost=Object.entries(sc.cost).filter(([rk])=>rk!=='merit');
    const can=resourceCost.every(([rk,n])=>(S.res[rk]||0)>=n)&&(S.merit||0)>=meritEff&&!pre;
    const techCap=resCap('tech'),techCapShort=done?0:Math.max(0,(sc.cost.tech||0)-techCap);
    h+=`<div class="tech-science-row${done?' is-researched':''}">
      <div class="tech-science-head">
        <div class="tech-science-title"><strong>${esc(sc.name)}</strong><span>${done?'已研究':pre?'待前置':can?'可研究':'条件未达'}</span></div>
        ${done?`<span class="tech-science-done">✔ 已研究</span>`:`<button class="btn btn-go btn-xs" ${can?'':'disabled'} onclick="researchScience('${id}')">研究</button>`}
      </div>
      ${sc.desc?`<div class="tech-science-desc">${esc(sc.desc)}</div>`:''}
      <div class="tech-science-cost">费用：${resourceCost.map(([rk,n])=>`${esc(CFG.res[rk]?.name||rk)} ${n}`).join(' · ')} · 战功 ${meritEff}${needs.length?` · 前置「${needs.map(p=>esc(sciName(p))).join('、')}」`:''}</div>
      ${techCapShort?`<div class="tech-science-limit">知识仓上限 ${techCap}，本笔还差 ${techCapShort}</div>`:''}
    </div>`;
  }
  h+=`</div>`;

  if(scienceUnlocked(CFG.steamMilitary.needScience)){
    const stars=S.steamMilitaryStars,field=steamMilitaryFieldSize(),nextField=steamMilitaryFieldSize(stars+1);
    const need=CFG.steamMilitary.firstStarFieldNeed+CFG.steamMilitary.fieldNeedPerStar*stars;
    const deployed=Math.max(militaryFormationCount(S.formation),militaryFormationCount(S._garrisonForm));
    const canUp=stars<CFG.steamMilitary.maxStars&&field>=need&&nextField>=deployed&&nextField>=0;
    h+=`<div class="card"><h3>${pix('army','card-pix')}军团整编 · ${stars}/${CFG.steamMilitary.maxStars}星</h3>`;
    h+=`<div class="tech-detail-intro">蒸汽军制：每星使出战攻击与生命 +10%；军队规模按每五级递增的代价缩减。已训练士兵保留在兵池。</div>`;
    h+=`<div class="tech-detail-row"><div class="tech-detail-head"><strong>当前加成 +${stars*10}%</strong><span class="tech-detail-state">规模 ${field} 人</span></div>`;
    h+=`<div class="tech-detail-cost">${stars<CFG.steamMilitary.maxStars?`下一星需当前规模 ≥${need}；升级后规模 ${nextField}；远征／驻军当前最大编入 ${deployed}`:'已达50星'}</div></div>`;
    h+=`<button class="btn btn-go btn-xs" onclick="steamMilitaryStarStep(1)" ${canUp?'':'disabled'}>升1星</button> `;
    h+=`<button class="btn btn-ghost btn-xs" onclick="steamMilitaryStarStep(-1)" ${stars>0?'':'disabled'}>降1星</button></div>`;
  }

  const scholar=CFG.scholarMastery,scholarCost=scholarMasteryCost(),scholarDone=S.scholarMasteryLv>=scholar.maxLevel;
  const scholarReady=scienceUnlocked(scholar.needScience)&&scholarCost&&Object.entries(scholarCost).every(([rk,n])=>Number.isFinite(S.res[rk])&&S.res[rk]>=n);
  if(scienceUnlocked(scholar.needScience)||S.scholarMasteryLv>0){
  h+=`<div class="card"><h3>${pix('academy','card-pix')}${scholar.name} · Lv${S.scholarMasteryLv}/${scholar.maxLevel}</h3>`;
  h+=`<div class="tech-detail-intro">需工坊技术；每级使学者产出增加5%，第6级起另需${esc(resourceDisplayName('medal'))}</div>`;
  h+=`<div class="tech-detail-row"><div class="tech-detail-head"><strong>学者产出</strong><span class="tech-detail-state">+${Math.round(S.scholarMasteryLv*scholar.perLevel*100)}%</span></div>`;
  h+=`<div class="tech-detail-cost">${scholarDone?'已满级':`下级费用：${Object.entries(scholarCost).map(([rk,n])=>`${esc(resourceDisplayName(rk))} ${n}`).join(' · ')}`}</div>`;
  h+=`<div class="tech-detail-actions"><button class="btn btn-go btn-xs" ${scholarReady?'':'disabled'} onclick="upgradeScholarMastery()">提升</button></div></div></div>`;
  }

  const steelMastery=CFG.steelMastery,steelCost=steelMasteryCost(),steelDone=S.steelMasteryLv>=steelMastery.maxLevel;
  const steelReady=scienceUnlocked(steelMastery.needScience)&&steelCost&&Object.entries(steelCost).every(([rk,n])=>Number.isFinite(S.res[rk])&&S.res[rk]>=n);
  if(scienceUnlocked(steelMastery.needScience)||S.steelMasteryLv>0){
  h+=`<div class="card"><h3>${pix('steel','card-pix')}${steelMastery.name} · Lv${S.steelMasteryLv}/${steelMastery.maxLevel}</h3>`;
  h+=`<div class="tech-detail-intro">需冶钢技术；每级使冶钢工产出增加5%，第6级起另需${esc(resourceDisplayName('medal'))}</div>`;
  h+=`<div class="tech-detail-row"><div class="tech-detail-head"><strong>冶钢产出</strong><span class="tech-detail-state">+${Math.round(S.steelMasteryLv*steelMastery.perLevel*100)}%</span></div>`;
  h+=`<div class="tech-detail-cost">${steelDone?'已满级':`下级费用：${Object.entries(steelCost).map(([rk,n])=>`${esc(resourceDisplayName(rk))} ${n}`).join(' · ')}`}</div>`;
  h+=`<div class="tech-detail-actions"><button class="btn btn-go btn-xs" ${steelReady?'':'disabled'} onclick="upgradeSteelMastery()">提升</button></div></div></div>`;
  }

  const visibleWeapons=Object.entries(CFG.weaponForge).filter(([key,cfg])=>{
    const w=S.weaponForge[key];
    return w.researched||w.level>0||w.progress>0||w.equipped||
      (scienceUnlocked(cfg.needScience)&&(!cfg.needWeapon||S.weaponForge[cfg.needWeapon]?.researched));
  });
  if(visibleWeapons.length){
  h+=`<div class="card"><h3>${pix('army','card-pix')}军备研发与锻造</h3>`;
  h+=`<div class="tech-detail-intro">先研发，再逐次投入材料；累计20次制成首件。装备后增加对应兵种攻击或防御，不增加兵员。</div>`;
  for(const[key,cfg]of visibleWeapons){
    const w=S.weaponForge[key],steps=weaponForgeSteps(key),researchReady=scienceUnlocked(cfg.needScience)&&(!cfg.needWeapon||S.weaponForge[cfg.needWeapon]?.researched)&&Object.entries(cfg.researchCost).every(([rk,n])=>Number.isFinite(S.res[rk])&&S.res[rk]>=n);
    const stepCost=weaponForgeStepCost(key),forgeReady=scienceUnlocked(cfg.needScience)&&w.researched&&stepCost&&canAffordWeaponCost(stepCost);
    const isArmor=cfg.stat==='def',bonus=w.level>0?(isArmor?cfg.initialDef+(w.level-1)*cfg.perLevelDef:cfg.initialAtk+(w.level-1)*cfg.perLevelAtk):0;
    h+=`<div class="tech-detail-row"><div class="tech-detail-head"><strong>${esc(cfg.name)}</strong><span class="tech-detail-state">Lv${w.level}/${cfg.maxLevel}${w.equipped?' · 已装备':''}</span></div>`;
    h+=`<div class="tech-detail-desc">${w.level>0?(isArmor?'防御+':'攻击+')+bonus:'尚未制成'} · 需${esc(sciName(cfg.needScience))}${cfg.needWeapon?'与'+esc(CFG.weaponForge[cfg.needWeapon].name)+'研发':''}</div>`;
    h+=`<div class="tech-detail-cost">${w.researched?(w.level>=cfg.maxLevel?'已满级':`锻造 ${w.progress}/${steps} · 每次 ${Object.entries(stepCost).map(([rk,n])=>`${esc(CFG.res[rk]?.name||CFG.eraMaterials[rk]?.name||rk)} ${n}`).join(' · ')}`):`研发费用：${Object.entries(cfg.researchCost).map(([rk,n])=>`${esc(resourceDisplayName(rk))} ${n}`).join(' · ')}`}</div>`;
    if(cfg.skill){const skills={sweep:'蒸汽扫射：敌军超过50人时改为攻击前排，并可能降低防御',bombard:'迫击轰击：首次攻击命中时覆盖前排',rapid:'电磁连射：命中后追加5次32%伤害',snipe:'精准狙击：首次攻击若命中，追加130%穿甲伤害并削弱目标防御',energy:'能源护甲：首次出手前按入场生命增加本场最大生命',nano:'纳米重构：首次出手前将入场防御转为本场攻击',starFighter:'星界战机：首次攻击改为135%伤害并削弱目标防御；入场生命提高效果',starMissile:'星陨飞弹：敌军入场超过1000人且生命高于一半时，首次攻击追加无视防御伤害'};h+=`<div class="tech-detail-desc">${skills[cfg.skill]}</div>`}
    h+=`<div class="tech-detail-actions">`;
    if(!w.researched)h+=`<button class="btn btn-go btn-xs" ${researchReady?'':'disabled'} onclick="researchWeapon('${key}')">研发</button>`;
    else{
      h+=`<button class="btn btn-go btn-xs" ${forgeReady?'':'disabled'} onclick="forgeWeapon('${key}')">投入一次</button>`;
      if(w.level>0)h+=`<button class="btn btn-ghost btn-xs" onclick="setWeaponEquipped('${key}',${!w.equipped})">${w.equipped?'卸下':'装备'}</button>`;
    }
    h+=`</div></div>`;
  }
  h+=`</div>`;
  }

  const quantumCfg=CFG.quantumArmament;
  if(scienceUnlocked(quantumCfg.needScience)||Object.values(S.quantumArmament||{}).some(levels=>levels.atk>0||levels.hp>0)){
    h+=`<div class="card"><h3>${pix('army','card-pix')}星界圣痕兵装</h3>`;
    h+=`<div class="tech-detail-intro">逐兵种强化攻击与单兵生命，每级各增加基础属性 5%；远征与驻军共用。每次投入钢与星辉原石，兵员数量不变。</div>`;
    for(const uk of quantumCfg.units){
      const state=S.quantumArmament[uk];
      if(!scienceUnlocked(CFG.armsUp[uk].needScience)&&state.atk===0&&state.hp===0)continue;
      h+=`<div class="tech-detail-row"><div class="tech-detail-head"><strong>${esc(CFG.units[uk].name)}</strong><span class="tech-detail-state">攻击 ${state.atk}/${quantumCfg.maxLevel} · 生命 ${state.hp}/${quantumCfg.maxLevel}</span></div>`;
      for(const stat of ['atk','hp']){
        const level=state[stat],cost=quantumArmamentCost(uk,stat),ready=cost&&scienceUnlocked(quantumCfg.needScience)&&Number.isFinite(S.res.steel)&&S.res.steel>=cost.steel&&Number.isFinite(S.items.starOriginStone)&&S.items.starOriginStone>=cost.starOriginStone;
        const bonus=quantumArmamentBonus(uk,stat);
        h+=`<div class="tech-detail-cost">${stat==='atk'?'攻击':'单兵生命'} +${bonus.toFixed(2)} · ${cost?`下级：钢 ${cost.steel}、星辉原石 ${cost.starOriginStone}`:'已满级'} <button class="btn btn-go btn-xs" ${ready?'':'disabled'} onclick="upgradeQuantumArmament('${uk}','${stat}')">强化</button></div>`;
      }
      h+=`</div>`;
    }
    h+=`</div>`;
  }

  const armsKeys=Object.keys(CFG.armsUp);
  const armsMilestoneText=Object.entries(CFG.armsUpMilestones||{}).map(([stat,m])=>
    `${stat==='atk'?'攻击':stat==='hp'?'生命':'防御'}每${m.everyStars}星追加基础属性${Math.round(m.basePct*100)}%`).join('；');
  for(const uk of armsKeys){
    const cfg=CFG.armsUp[uk];
    const unlocked=scienceUnlocked(cfg.needScience),stock=S.res[cfg.material];
    if(!unlocked&&!Object.values(S.armsUp[uk]||{}).some(state=>state.stars>0||state.progress>0))continue;
    h+=`<div class="card"><h3>${pix('army','card-pix')}${esc(cfg.name)}</h3>`;
    h+=`<div class="tech-detail-intro">需${esc(sciName(cfg.needScience))}；攻击、生命、防御分别投入。每 ${cfg.stepsPerStar} 次升一星，进度与战斗兵力分开保存。${esc(armsMilestoneText)}</div>`;
    for(const [stat,sc] of Object.entries(cfg.stats)){
      const state=S.armsUp[uk][stat],remaining=cfg.stepsPerStar-state.progress;
      const single=armsUpCost(uk,stat),fill=armsUpCost(uk,stat,remaining);
      const batch=armsUpPayableBatch(uk,stat);
      const batchQuote=batch>1?armsUpCost(uk,stat,batch):null;
      const singlePayable=single.ok&&Number.isFinite(stock)&&stock>=single.cost&&stock-(stock-single.cost)===single.cost;
      const rawBonus=armsUpBonus(uk,stat),bonus=stat==='hp'?rawBonus.toFixed(2):rawBonus;
      h+=`<div class="tech-detail-row"><div class="tech-detail-head"><strong>${esc(sc.name)}</strong><span class="tech-detail-state">${state.stars}星 · ${state.progress}/${cfg.stepsPerStar}</span></div>`;
      h+=`<div class="tech-detail-desc">当前${stat==='atk'?'攻击':stat==='hp'?'单兵生命':'防御'} +${bonus}</div>`;
      h+=single.ok?`<div class="tech-detail-cost">每次 ${esc(resourceDisplayName(cfg.material))} ${single.cost} · 补满本星 ${fill.ok?fill.cost:'暂不可用'}</div>`:`<div class="tech-detail-cost">投入费用超出可精确支付范围</div>`;
      h+=`<div class="tech-detail-actions"><button class="btn btn-go btn-xs" ${unlocked&&singlePayable?'':'disabled'} onclick="investArmsUp('${uk}','${stat}')">投入一次</button>`;
      if(unlocked&&batch>1&&batchQuote?.ok&&stock-(stock-batchQuote.cost)===batchQuote.cost)h+=`<button class="btn btn-ghost btn-xs" onclick="investArmsUp('${uk}','${stat}',${batch})">${batch===remaining?'补满本星':'投入'+batch+'次'}</button>`;
      h+=`</div></div>`;
    }
    h+=`</div>`;
  }

  const mastery=CFG.storageMastery,masteryCost=storageMasteryCost(),masteryDone=S.storageMasteryLv>=mastery.maxLevel;
  const masteryReady=scienceUnlocked(mastery.needScience)&&!masteryDone&&Object.entries(masteryCost).every(([rk,n])=>(S.res[rk]||0)>=n);
  if(scienceUnlocked(mastery.needScience)||S.storageMasteryLv>0){
  h+=`<div class="card"><h3>${pix('library','card-pix')}储存精通 · Lv${S.storageMasteryLv}/${mastery.maxLevel}</h3>`;
  h+=`<div class="tech-detail-intro">需工坊技术；每级使木、石、粮、知识与金属仓容增加10%，钱币与地契不变</div>`;
  h+=`<div class="tech-detail-row"><div class="tech-detail-head"><strong>仓容加成</strong><span class="tech-detail-state">+${Math.round(S.storageMasteryLv*mastery.perLevel*100)}%</span></div>`;
  h+=`<div class="tech-detail-cost">${masteryDone?'已满级':`下级费用：${Object.entries(masteryCost).map(([rk,n])=>`${esc(CFG.res[rk]?.name||rk)} ${n}`).join(' · ')}`}</div>`;
  h+=`<div class="tech-detail-actions"><button class="btn btn-go btn-xs" ${masteryReady?'':'disabled'} onclick="upgradeStorageMastery()">提升</button></div></div></div>`;
  }

  const steamStorage=Object.entries(CFG.eraStorage).filter(([key,cfg])=>
    key.startsWith('steam')&&(scienceUnlocked(cfg.needScience)||(S.eraStorage[key]||0)>0));
  if(steamStorage.length){
  h+=`<div class="card"><h3>${pix('institute','card-pix')}蒸汽仓储科技</h3>`;
  const crystalName=CFG.eraMaterials.godCrystal.name;
  h+=`<div class="tech-detail-intro">需蒸汽时代；基础、金属、知识分别每级扩容10%，各自封顶100级。${crystalName}库存 ${S.items.godCrystal}</div>`;
  for(const[key,cfg]of steamStorage){
    const level=S.eraStorage[key],cost=eraStorageCost(key),ready=scienceUnlocked(cfg.needScience)&&cost&&(S.res.tech||0)>=cost.tech&&(S.items.godCrystal||0)>=(cost.godCrystal||0);
    h+=`<div class="tech-detail-row"><div class="tech-detail-head"><strong>${esc(cfg.name)}</strong><span class="tech-detail-state">Lv${level}/${cfg.maxLevel}</span></div><div class="tech-detail-desc">当前仓容 +${level*10}%</div><div class="tech-detail-cost">${cost?`下级费用：科技点 ${cost.tech}${cost.godCrystal?` · ${esc(crystalName)} ${cost.godCrystal}`:''}`:'已满级'}</div><div class="tech-detail-actions"><button class="btn btn-go btn-xs" ${ready?'':'disabled'} onclick="upgradeEraStorage('${key}')">提升</button></div></div>`;
  }
  h+=`<div class="tech-detail-intro">第6级起需要${esc(crystalName)}；合金时代研究「${esc(sciName(CFG.godDomain.needScience))}」后可在远征页重复探索机巧遗迹获取。</div></div>`;
  }

  const electricStorage=Object.entries(CFG.eraStorage).filter(([key,cfg])=>
    key.startsWith('electric')&&(scienceUnlocked(cfg.needScience)||(S.eraStorage[key]||0)>0));
  if(electricStorage.length){
  h+=`<div class="card"><h3>${pix('institute','card-pix')}电力仓储与生产科技</h3>`;
  h+=`<div class="tech-detail-intro">需电力时代；基础、金属、知识仓容及非货币岗位产出分别每级+10%，各封顶100级。${esc(CFG.eraMaterials.guardianStone.name)} ${S.items.guardianStone} · ${esc(CFG.eraMaterials.phantomFlower.name)} ${S.items.phantomFlower}</div>`;
  for(const[key,cfg]of electricStorage){
    const level=S.eraStorage[key],cost=eraStorageCost(key),material=cfg.lateMaterial,materialName=CFG.eraMaterials[material].name;
    const ready=scienceUnlocked(cfg.needScience)&&cost&&(S.res.tech||0)>=cost.tech&&(S.items[material]||0)>=(cost[material]||0);
    h+=`<div class="tech-detail-row"><div class="tech-detail-head"><strong>${esc(cfg.name)}</strong><span class="tech-detail-state">Lv${level}/${cfg.maxLevel}</span></div><div class="tech-detail-desc">当前加成 +${level*10}%</div><div class="tech-detail-cost">${cost?`下级费用：科技点 ${cost.tech}${cost[material]?` · ${esc(materialName)} ${cost[material]}`:''}`:'已满级'}</div><div class="tech-detail-actions"><button class="btn btn-go btn-xs" ${ready?'':'disabled'} onclick="upgradeEraStorage('${key}')">提升</button></div></div>`;
  }
  h+=`<div class="tech-detail-intro">第6级起分别需要${esc(CFG.eraMaterials.guardianStone.name)}或${esc(CFG.eraMaterials.phantomFlower.name)}；研究电力时代后可在远征页挑战${esc(CFG.godDomains.guardianStone.name)}／${esc(CFG.godDomains.phantomFlower.name)}获取。</div></div>`;
  }

  const nuclearStorage=Object.entries(CFG.eraStorage).filter(([key,cfg])=>
    key.startsWith('nuclear')&&(scienceUnlocked(cfg.needScience)||(S.eraStorage[key]||0)>0));
  if(nuclearStorage.length){
    h+=`<div class="card"><h3>${pix('institute','card-pix')}星核仓储与生产科技</h3>`;
    h+=`<div class="tech-detail-intro">基础、金属、知识仓容及非货币岗位产出分别每级+10%，各封顶100级；第6级起需对应材料。</div>`;
    for(const[key,cfg]of nuclearStorage){
      const level=S.eraStorage[key],cost=eraStorageCost(key),material=cfg.lateMaterial,materialName=CFG.eraMaterials[material].name;
      const ready=scienceUnlocked(cfg.needScience)&&cost&&(S.res.tech||0)>=cost.tech&&(S.items[material]||0)>=(cost[material]||0);
      h+=`<div class="tech-detail-row"><div class="tech-detail-head"><strong>${esc(cfg.name)}</strong><span class="tech-detail-state">Lv${level}/${cfg.maxLevel}</span></div><div class="tech-detail-desc">当前加成 +${level*10}%</div><div class="tech-detail-cost">${cost?`下级费用：科技点 ${cost.tech}${cost[material]?` · ${esc(materialName)} ${cost[material]}`:''}`:'已满级'}</div><div class="tech-detail-actions"><button class="btn btn-go btn-xs" ${ready?'':'disabled'} onclick="upgradeEraStorage('${key}')">提升</button></div></div>`;
    }
    h+=`<div class="tech-detail-intro">${esc(CFG.eraMaterials.revivalLeaf.name)}可在远征页挑战${esc(CFG.godDomains.revivalLeaf.name)}获得。</div></div>`;
  }

  const starSlots=S.starArray?.[CFG.starArray.unit]?.slots||[];
  const starOpened=starSlots.filter(slot=>slot.open).length;
  if(scienceUnlocked(CFG.starArray.needScience)||starOpened){
    const c=CFG.starArray,aw=S.awakening?.[c.unit]||{level:0,stars:0};
    const active=scienceUnlocked(c.needScience)&&aw.level===c.awakeningLevel&&aw.stars>=c.starScale[0][0];
    const next=starSlots.findIndex(slot=>!slot.open),busy=S.battleActive||S.offline?.populationFoodRule==='legacy-pending';
    h+=`<div class="card"><h3>${pix('institute','card-pix')}星辉圣阵</h3>`;
    h+=`<div class="tech-detail-intro">${starOpened}/${c.slots} 槽已开 · 秘典知识仓上限 +${starArrayKnowledgePercent()}% · 星际先遣兵觉醒 ${aw.level}/${c.awakeningLevel} 阶、${aw.stars}/${c.starScale[0][0]} 星${active?'':'后生效'}。</div>`;
    h+=`<div class="tech-detail-intro">${esc(CFG.eraMaterials.sacredRingCore.name)} ${S.items.sacredRingCore} · ${esc(CFG.eraMaterials.illusionStone.name)} ${S.items.illusionStone} · ${esc(CFG.eraMaterials.starOriginStone.name)} ${S.items.starOriginStone}。三种星石均来自星界兽域胜利；每个槽先开槽，再定向刻印知识属性，最高 10 级。</div>`;
    for(let i=0;i<starSlots.length;i++){
      const slot=starSlots[i];
      if(!slot.open&&i!==next)continue;
      const action=!slot.open?'open':slot.type==='unbound'?'attune':slot.level<c.maxLevel?'upgrade':null;
      const cost=action?starArraySlotCost(action,i):null;
      const ready=!!cost&&!busy&&scienceUnlocked(c.needScience)&&Number.isSafeInteger(S.items[cost.item])&&S.items[cost.item]>=cost.amount;
      const gain=slot.open&&slot.type==='knowledgeCap'?(4+2*Math.floor(i/3))*slot.level:0;
      const label=action==='open'?'开槽':action==='attune'?'刻印知识':action==='upgrade'?'升级':'已满级';
      const callback=action==='open'?`openStarArraySlot(${i})`:action==='attune'?`attuneStarArrayKnowledgeSlot(${i})`:`upgradeStarArraySlot(${i},${slot.level})`;
      h+=`<div class="tech-detail-row"><div class="tech-detail-head"><strong>第${i+1}槽</strong><span class="tech-detail-state">${!slot.open?'未开放':slot.type==='unbound'?'待刻印':`知识 Lv${slot.level}/${c.maxLevel}`}</span></div>`;
      h+=`<div class="tech-detail-desc">${gain?`秘典知识仓基础属性 ${gain}% · 觉醒后按星数折算`:'当前不增加知识仓容量'}</div>`;
      h+=`<div class="tech-detail-cost">${cost?`${esc(CFG.eraMaterials[cost.item].name)} ${cost.amount}`:'已满级'}</div>`;
      if(action)h+=`<div class="tech-detail-actions"><button class="btn btn-go btn-xs" ${ready?'':'disabled'} onclick="${callback}">${label}</button></div>`;
      h+=`</div>`;
    }
    h+=`</div>`;
  }

  const quantumStorage=Object.entries(CFG.eraStorage).filter(([key,cfg])=>
    key.startsWith('quantum')&&(scienceUnlocked(cfg.needScience)||(S.eraStorage[key]||0)>0));
  if(quantumStorage.length){
    h+=`<div class="card"><h3>${pix('institute','card-pix')}星界仓储与生产科技</h3>`;
    h+=`<div class="tech-detail-intro">基础、金属、知识仓容及非货币岗位产出分别每级+10%，各封顶100级；第6级起需对应圣域材料。</div>`;
    for(const[key,cfg]of quantumStorage){
      const level=S.eraStorage[key],cost=eraStorageCost(key),material=cfg.lateMaterial,materialName=CFG.eraMaterials[material].name;
      const ready=scienceUnlocked(cfg.needScience)&&cost&&(S.res.tech||0)>=cost.tech&&(S.items[material]||0)>=(cost[material]||0);
      h+=`<div class="tech-detail-row"><div class="tech-detail-head"><strong>${esc(cfg.name)}</strong><span class="tech-detail-state">Lv${level}/${cfg.maxLevel}</span></div><div class="tech-detail-desc">当前加成 +${level*10}%</div><div class="tech-detail-cost">${cost?`下级费用：科技点 ${cost.tech}${cost[material]?` · ${esc(materialName)} ${cost[material]}`:''}`:'已满级'}</div><div class="tech-detail-actions"><button class="btn btn-go btn-xs" ${ready?'':'disabled'} onclick="upgradeEraStorage('${key}')">提升</button></div></div>`;
    }
    h+=`<div class="tech-detail-intro">材料仍由现有机巧遗迹、重装防卫机、复苏圣域和光学拟态机战斗获得。</div></div>`;
  }

  // 兵谱 — 总收纳
  if(!S._techFold)S._techFold={};
  const compFolded=S._techFold._compendium===true;
  const treeOrder=['infantry','archer','cavalry','mage'];
  const treeNames={infantry:'步兵线',archer:'弓兵线',cavalry:'骑兵线',mage:'法师线'};

  h+=`<div class="branch-header" onclick="S._techFold._compendium=!S._techFold._compendium;updateUI()">
    <span class="branch-arrow${compFolded?'':' open'}">▶</span>
    <span class="branch-icon">${pix('army','md')}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:bold;color:#e0d070;letter-spacing:1px">兵谱</div>
      <div style="font-size:9px;color:#5a6078;margin-top:2px">点击${compFolded?'展开':'折叠'} · 已解锁与当前可研究分支</div>
    </div>
  </div>`;
  h+=`<div class="branch-body${compFolded?' folded':' expanded'}" style="margin-bottom:8px">`;

  function renderUnitTreeNode(tree,rootKey,lineKey,key,parentKey,depth){
    const node=tree[key];
    if(!node)return'';
    const isRoot=key===rootKey;
    const parent=parentKey?tree[parentKey]:null;
    const research=isRoot?node.unlock:parent?.branches?.find(branch=>branch.to===key);
    const owned=(isRoot&&!node.unlock)||S.upgradedUnits[key]===true;
    const parentReady=isRoot||(parentKey===rootKey&&!parent?.unlock)||S.upgradedUnits[parentKey]===true;
    const techNeed=research?.needTech||0,meritNeed=research?.needMerit||0;
    const essenceNeed=research?.needEssence;
    const cost=research?.cost||{};
    const resourcesReady=['wood','stone','food'].every(rk=>(S.res[rk]||0)>=(cost[rk]||0));
    const essenceReady=!essenceNeed||(S.essence[essenceNeed.type]||0)>=essenceNeed.count;
    const buildingKey=Object.keys(CFG.buildings).find(bk=>CFG.buildings[bk].trains===lineKey);
    const building=buildingKey?CFG.buildings[buildingKey]:null;
    const buildingState=buildingKey?bldSt(buildingKey):null;
    const buildingReady=!!(building&&buildingState.lv>0&&(buildingState.tier??0)>=node.tier&&
      (!building.needScience||scienceUnlocked(building.needScience))&&
      !buildingProgressLock(buildingKey));
    const unitScience=CFG.units[key]?.needScience;
    const unitScienceReady=!unitScience||scienceUnlocked(unitScience);
    const levelReady=!checkTierLevel(node.tier);
    const rootGateReady=!isRoot||!node.unlock||buildingReady&&unitScienceReady&&levelReady;
    const visible=owned||(isRoot?rootGateReady:parentReady&&buildingReady&&unitScienceReady&&levelReady);
    const children=(node.branches||[]).map(branch=>renderUnitTreeNode(tree,rootKey,lineKey,branch.to,key,depth+1)).join('');
    if(!visible)return children;
    const canResearch=!owned&&!!research&&parentReady&&resourcesReady&&essenceReady
      &&(S.res.tech||0)>=techNeed&&(S.merit||0)>=meritNeed&&buildingReady&&unitScienceReady&&levelReady&&rootGateReady;
    const state=owned?(isRoot&&!node.unlock?'初始兵种':'已研究'):
      !parentReady?'待前置':canResearch?'可研究':'条件未达';
    const prereq=parentKey?`前置：${esc(parent?.name||parentKey)}`:
      node.unlock?'前置：解锁本线入口':'基础兵种';
    const costParts=Object.entries(cost).filter(([,amount])=>amount>0)
      .map(([rk,amount])=>`${esc(CFG.res[rk]?.name||rk)} ${Math.floor(S.res[rk]||0)}/${amount}`);
    if(techNeed)costParts.push(`科技点 ${Math.floor(S.res.tech||0)}/${techNeed}`);
    if(meritNeed)costParts.push(`战功 ${Math.floor(S.merit||0)}/${meritNeed}`);
    if(essenceNeed)costParts.push(`${esc(CFG.essences?.[essenceNeed.type]?.name||essenceNeed.type)} ${Math.floor(S.essence[essenceNeed.type]||0)}/${essenceNeed.count}`);
    const extraLock=!owned&&parentReady&&!levelReady?` · ${esc(checkTierLevel(node.tier))}`:
      !owned&&parentReady&&!buildingReady?` · 需${esc(CFG.buildings[buildingKey].name)}达到T${node.tier}`:'';
    let r=`<div class="tech-unit-node${owned?' is-owned':''}" data-unit="${key}" style="--unit-depth:${Math.min(depth*8,24)}px">
      <div class="tech-unit-main">
        ${unitPortrait(key,'tech')}
        <div class="tech-unit-info"><strong>${esc(node.name)}</strong><span class="tech-unit-state">T${node.tier} · ${state}</span>
          <div class="tech-unit-prereq">${prereq}${extraLock}</div></div>
        ${canResearch?`<button class="btn btn-go btn-sm" onclick="${isRoot?`unlockUnitRoot('${key}')`:`upgradeUnit('${parentKey}','${key}')`}">研究</button>`:''}
      </div>
      ${research?`<div class="tech-unit-cost"><span class="tech-unit-cost-label">费用：</span><div class="tech-unit-cost-list">${costParts.map(part=>`<span>${part}</span>`).join('')}</div></div>`:''}
    </div>`;
    return r+children;
  }

  for(const treeKey of treeOrder){
    const treeCfg=CFG.unitUpgrades[treeKey];
    if(!treeCfg||!treeCfg.tree)continue;
    const tree=treeCfg.tree;
    const rootKey=Object.keys(tree).find(k=>tree[k].tier===0)||Object.keys(tree)[0];
    const treeHtml=renderUnitTreeNode(tree,rootKey,treeKey,rootKey,null,0);
    if(!treeHtml)continue;
    const folded=S._techFold[treeKey]===true;

    h+=`<div class="branch-header" style="margin:4px 0;padding:8px 12px" onclick="S._techFold['${treeKey}']=!S._techFold['${treeKey}'];updateUI()">
      <span class="branch-arrow${folded?'':' open'}">▶</span>
      <span class="branch-icon">${unitPortrait(rootKey,'mini')}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:bold;color:#c0c8e0;letter-spacing:1px">${treeNames[treeKey]||treeCfg.name}</div>
        <div style="font-size:9px;color:#5a6078;margin-top:2px">点击${folded?'展开':'折叠'}</div>
      </div>
    </div>`;
    h+=`<div class="branch-body${folded?' folded':' expanded'}" style="margin-bottom:4px">`;

    h+=treeHtml;
    h+=`</div>`;
  }
  h+=`</div>`;
  h+=`</div>`;
  return h;
}
let _techFullOpen=false;
let _techShowAll=false;
let _techCategory='science';
const TECH_CATEGORIES={science:'科研',units:'兵种',arms:'军备',mastery:'精通',storage:'仓储'};
function techActionCategory(call){
  if(call.startsWith('researchScience('))return'science';
  if(call.startsWith('unlockUnitRoot(')||call.startsWith('upgradeUnit('))return'units';
  if(call.startsWith('researchWeapon(')||call.startsWith('forgeWeapon(')||call.startsWith('investArmsUp(')||call.startsWith('setWeaponEquipped('))return'arms';
  if(call.startsWith('upgradeQuantumArmament(')||call.startsWith('steamMilitaryStarStep('))return'arms';
  if(call.startsWith('upgradeScholarMastery(')||call.startsWith('upgradeSteelMastery('))return'mastery';
  if(call.startsWith('upgradeStorageMastery(')||call.startsWith('upgradeEraStorage('))return'storage';
  if(call.startsWith('openStarArraySlot(')||call.startsWith('attuneStarArrayKnowledgeSlot(')||call.startsWith('upgradeStarArraySlot('))return'storage';
  return null;
}
function techActionTitle(button,category){
  const row=button.closest('.tech-science-row,.tech-unit-node,.tech-detail-row,div[style*="border-bottom"],div[style*="border-top"]')||button.parentElement?.parentElement;
  const strong=row?.querySelector('strong');
  const armId=/^investArmsUp\('([^']+)'/.exec(button.getAttribute('onclick')||'')?.[1];
  if(armId&&CFG.armsUp[armId])return `${CFG.armsUp[armId].name} · ${strong?.textContent.trim()||'精炼'}`;
  if(strong)return strong.textContent.trim();
  if(category==='units'){
    const parent=button.parentElement;
    const name=[...(parent?.querySelectorAll('span')||[])].map(span=>span.textContent.trim()).find(text=>text&&text!=='→');
    if(name)return name;
  }
  return button.closest('.card')?.querySelector('h3')?.textContent.trim()||TECH_CATEGORIES[category];
}
function techActionMeta(button,title,category){
  const call=button.getAttribute('onclick')||'';
  const unitNode=button.closest('.tech-unit-node');
  if(unitNode)return `${unitNode.querySelector('.tech-unit-prereq')?.textContent.trim()||''} · ${unitNode.querySelector('.tech-unit-cost')?.textContent.trim()||''}`;
  const scienceId=/^researchScience\('([^']+)'\)/.exec(call)?.[1];
  if(scienceId){
    const science=activeSciences()[scienceId];
    if(science){
      const needs=scienceNeedIds(scienceId,science).map(sciName);
      const costs=Object.entries(science.cost||{}).filter(([key])=>key!=='merit'||!CFG.tech?.sciencesNoMerit)
        .map(([key,value])=>`${key==='merit'?'战功':resourceDisplayName(key)} ${value}`);
      return `${science.desc||''}${needs.length?' · 前置：'+needs.join('、'):''}${costs.length?' · 费用：'+costs.join('、'):''} · 进度：未研究`;
    }
  }
  const row=button.closest('.tech-detail-row,div[style*="border-bottom"],div[style*="border-top"]')||button.closest('.card')||button.parentElement;
  const copy=row.cloneNode(true);
  copy.querySelectorAll('button,.pix-icon').forEach(node=>node.remove());
  const summary=copy.textContent.replace(/\s+/g,' ').trim().replace(title,'').trim();
  return summary.slice(0,220)||`${TECH_CATEGORIES[category]} · 查看完整图谱了解前置、费用与进度`;
}
function fullTechCategory(node){
  if(node.classList.contains('tech-essence-inventory'))return'units';
  if(node.classList.contains('branch-header')||node.classList.contains('branch-body'))return'units';
  const heading=node.querySelector('h3')?.textContent.trim()||'';
  if(heading.includes('精魄'))return'units';
  if(heading.includes('资源科技'))return'science';
  if(heading.includes('军备')||heading.includes('圣痕兵装')||heading.includes('军团整编')||Object.values(CFG.armsUp||{}).some(item=>heading.includes(item.name)))return'arms';
  if([CFG.scholarMastery?.name,CFG.steelMastery?.name].some(name=>name&&heading.includes(name)))return'mastery';
  if(heading.includes('储存')||heading.includes('仓储')||heading.includes('扩容')||heading.includes('星辉圣阵'))return'storage';
  return'science';
}
function techActionPresentation(button,title,category){
  const call=button.getAttribute('onclick')||'';
  const scienceId=/^researchScience\('([^']+)'\)/.exec(call)?.[1];
  if(scienceId){
    const science=activeSciences()[scienceId];
    if(science)return {description:science.desc||'',costs:Object.entries(science.cost||{})
      .filter(([key])=>key!=='merit'||!CFG.tech?.sciencesNoMerit)
      .map(([key,value])=>`${key==='merit'?'战功':resourceDisplayName(key)} ${compactUiNumber(value)}`)};
  }
  const row=button.closest('.tech-unit-node,.tech-detail-row')||button.parentElement;
  const chips=[...(row.querySelectorAll('.tech-unit-cost-list span')||[])].map(item=>item.textContent.trim());
  const fee=button.closest('.tech-detail-cost')||row.querySelector('.tech-unit-cost,.tech-detail-cost');
  const feeCopy=fee?.cloneNode(true);
  feeCopy?.querySelectorAll('button').forEach(node=>node.remove());
  return {state:row.querySelector('.tech-detail-state')?.textContent.trim()||'',
    description:row.querySelector('.tech-unit-prereq,.tech-detail-desc')?.textContent.trim()||'',
    costs:chips.length?chips:[feeCopy?.textContent.trim()||techActionMeta(button,title,category)]};
}
function setTechCategory(category){
  if(!TECH_CATEGORIES[category])return;
  _techCategory=category;
  const full=document.querySelector('.tech-full');
  if(full)full.dataset.category=category;
  for(const button of document.querySelectorAll('.tech-tree-nav button')){
    const active=button.dataset.category===category;
    button.classList.toggle('btn-go',active);button.classList.toggle('btn-ghost',!active);
    button.setAttribute('aria-pressed',String(active));
  }
}
function setTechFullOpen(open){_techFullOpen=!!open;}
function toggleTechActionList(){_techShowAll=!_techShowAll;updateUI();}
function rTech(){
  const full=rTechFull();
  const fragment=document.createElement('div');fragment.innerHTML=full;
  const content=fragment.firstElementChild;
  const actions=[];
  for(const button of content.querySelectorAll('button[onclick]')){
    const call=button.getAttribute('onclick')||'';
    const category=techActionCategory(call);
    if(!category||button.disabled||!button.classList.contains('btn-go'))continue;
    const title=techActionTitle(button,category);
    actions.push({category,title,...techActionPresentation(button,title,category),html:button.outerHTML,
      unitKey:button.closest('.tech-unit-node')?.dataset.unit||null});
  }
  const visibleCategories=new Set();
  for(const child of content.children){
    child.dataset.techCategory=fullTechCategory(child);
    visibleCategories.add(child.dataset.techCategory);
  }
  if(!visibleCategories.has(_techCategory))_techCategory='science';
  const visibleCategoryLabels=Object.entries(TECH_CATEGORIES)
    .filter(([category])=>visibleCategories.has(category)).map(([,label])=>label).join(' · ');
  const near=[];
  for(const [id,science] of Object.entries(activeSciences())){
    if(S.sciences.includes(id)||science.legacyOnly||science.storageMode&&science.storageMode!==S.storageMode||science.currencyMode&&science.currencyMode!==S.currencyRecipeMode)continue;
    const needs=scienceNeedIds(id,science);
    if(needs.some(need=>!S.sciences.includes(need)))continue;
    const cost=Object.entries(science.cost).filter(([key])=>key!=='merit');
    const meritCost=CFG.tech?.sciencesNoMerit?0:science.cost.merit||0;
    const affordable=cost.every(([key,amount])=>(S.res[key]||0)>=amount)&&(S.merit||0)>=meritCost;
    if(!affordable){
      const missing=cost.filter(([key,amount])=>(S.res[key]||0)<amount)
        .map(([key,amount])=>`${resourceDisplayName(key)} ${compactUiNumber(Math.ceil(amount-(S.res[key]||0)))}`);
      if((S.merit||0)<meritCost)missing.push(`战功 ${compactUiNumber(Math.ceil(meritCost-(S.merit||0)))}`);
      near.push({name:science.name,cost:cost.map(([key,amount])=>`${resourceDisplayName(key)} ${compactUiNumber(amount)}`),missing,id,techCost:science.cost.tech||0});
    }
  }
  near.sort((a,b)=>(activeSciences()[a.id].cost.tech||0)-(activeSciences()[b.id].cost.tech||0));
  let h=`<section id="tech-overview" class="tech-overview-head"><div class="ui-page-kicker">研究中心</div><h2>研究与成长</h2><p>先完成可用研究，再查看下一步条件</p>
    <div class="tech-overview-stats"><span>科技点 <strong>${compactUiNumber(S.res.tech||0)}</strong></span><span>战功 <strong>${compactUiNumber(S.merit||0)}</strong></span><span>可操作 <strong>${actions.length}</strong></span></div>
  </section>`;
  h+=`<div class="ui-section-heading"><h3>现在可以做</h3><span class="ui-count-badge">${actions.length}项</span></div>`;
  if(actions.length){
    const queues=Object.keys(TECH_CATEGORIES).map(category=>actions.filter(action=>action.category===category));
    const short=[];
    while(short.length<8&&queues.some(queue=>queue.length))for(const queue of queues){
      if(short.length>=8)break;if(queue.length)short.push(queue.shift());
    }
    const visible=_techShowAll?actions:short;
    for(const [category,label] of Object.entries(TECH_CATEGORIES)){
      const group=visible.filter(action=>action.category===category);if(!group.length)continue;
      h+=`<section class="tech-action-group" aria-label="${label}可操作研究"><div class="tech-group-heading"><span>${label}</span><small>${actions.filter(action=>action.category===category).length}项可用</small></div>`;
      for(const action of group)h+=`<article class="tech-action-card"><div class="tech-action-main"><div class="tech-action-copy"><h3 class="tech-action-title">${esc(action.title)}</h3><span class="tech-ready-label">条件已满足</span></div>${action.html}</div>${action.description?`<p class="tech-action-description">${esc(action.description)}</p>`:''}<div class="tech-action-costs"><span class="tech-cost-label">费用 / 进度</span><div class="ui-cost-list">${action.state?`<span class="tech-current-state">${esc(action.state)}</span>`:''}${action.costs.map(cost=>`<span>${esc(cost)}</span>`).join('')}</div></div></article>`;
      h+='</section>';
    }
    if(actions.length>8)h+=`<button class="btn btn-ghost btn-sm" type="button" onclick="toggleTechActionList()">${_techShowAll?'收起':'查看全部 '+actions.length+' 项可操作研究'}</button>`;
  }else h+=`<div class="card">当前没有可以直接执行的研究；查看下一步条件或完整图谱。</div>`;
  if(near.length){
    h+=`<div class="ui-section-heading"><h3>下一步研究</h3><span class="ui-count-badge">筹备中</span></div>`;
    for(const next of near.slice(0,3)){
      const current=Math.min(Math.max(0,Math.floor(S.res.tech||0)),next.techCost);
      const percent=next.techCost?Math.round(current/next.techCost*100):100;
      h+=`<article class="tech-action-card tech-near-card"><div class="tech-near-head"><h3 class="tech-action-title">${esc(next.name)}</h3><span>待筹备</span></div><div class="ui-cost-list">${next.cost.map(cost=>`<span>${esc(cost)}</span>`).join('')}${CFG.tech?.sciencesNoMerit?'':`<span>战功 ${compactUiNumber(activeSciences()[next.id].cost.merit||0)}</span>`}</div><div class="tech-missing">还缺：${esc(next.missing.join(' · '))}</div>${next.techCost?`<div class="tech-preparation"><span>科技点筹备 ${compactUiNumber(current)} / ${compactUiNumber(next.techCost)}</span><strong>${percent}%</strong></div><div class="prog-wrap" role="progressbar" aria-label="${esc(next.name)}科技点筹备" aria-valuemin="0" aria-valuemax="${next.techCost}" aria-valuenow="${current}"><div class="prog-fill" style="width:${percent}%"></div></div>`:''}</article>`;
    }
  }
  h+=`<details class="tech-deep-dive" id="tech-full" ${_techFullOpen?'open':''} ontoggle="if(this.isConnected)setTechFullOpen(this.open)">
    <summary id="tech-tree-toggle"><span>完整图谱</span><small>${visibleCategoryLabels}</small></summary>
    <div class="tech-tree-nav" aria-label="图谱分类">`;
  for(const [category,label] of Object.entries(TECH_CATEGORIES)){
    if(!visibleCategories.has(category))continue;
    h+=`<button type="button" data-category="${category}" aria-pressed="${_techCategory===category}" class="btn btn-sm ${_techCategory===category?'btn-go':'btn-ghost'}" onclick="setTechCategory('${category}')">${label}</button>`;
  }
  h+=`</div><div class="tech-full" data-category="${_techCategory}">${content.innerHTML}</div></details>`;
  return h;
}
// ==================== 设置弹窗 ====================
function formatGameTime(ticks){
  const totalSec=Math.floor(ticks*(CFG.tickMs||1000)/1000);
  const h=Math.floor(totalSec/3600),m=Math.floor((totalSec%3600)/60);
  return `${h}时${String(m).padStart(2,'0')}分`;
}
function openSettings(){
  let h=`<h3>${pix('build','card-pix')}设置</h3>`;
  h+=`<div class="settings-time"><span class="label">游戏时间</span>${formatGameTime(S.tick||0)}</div>`;
  h+=`<div class="card settings-theme"><h3>界面外观</h3><p class="desc">夜间可切换为深色界面，选择会保存在本机。</p><button type="button" class="btn btn-ghost" id="settings-theme-toggle" aria-pressed="false" onclick="toggleVisualTheme()">切换为夜间界面</button></div>`;
  if(saveProtected()){
    h+=`<div class="card" style="border-color:#7a3040"><h3 style="color:#e06060">存档保护模式</h3>
      <div style="font-size:10px;color:#c09090;margin:4px 0">${esc(saveProtectReason())}</div>
      <div style="font-size:9px;color:#888;margin-bottom:6px">游戏运行在只读状态：一切自动保存已被阻止，主档原文不会被改动。可导出异常原文用于检查，或在下方恢复有效备份。</div>
      <button class="btn btn-ghost btn-xs" onclick="settingsShowExport(true)">导出主档原文</button>
      <button class="btn btn-ghost btn-xs" onclick="settingsShowExport('premigration')">导出迁移前原文（如有）</button></div>`;
  }
  h+=`<div class="card"><h3>存档管理</h3>
    <div class="train-custom" style="gap:4px">
      <button class="btn btn-ghost btn-xs" onclick="settingsShowExport(false)">导出当前存档</button>
      <button class="btn btn-ghost btn-xs" onclick="settingsShowImport()">导入存档</button>
      <button class="btn btn-ghost btn-xs" onclick="settingsShowRestore()">恢复备份</button>
    </div>
    <div id="save-mgmt-body" style="margin-top:6px"></div></div>`;
  h+=`<div class="card"><h3>激活码</h3>
    <div class="train-custom" style="margin:4px 0">
      <input id="activation-code" type="text" value="" style="width:220px" placeholder="请输入激活码">
      <button class="btn btn-go btn-xs" onclick="checkActivationCode('activation-code')">确认</button>
    </div></div>`;
  h+=`<div class="card" style="text-align:center">
    <button class="btn btn-danger btn-sm" onclick="if(confirm('重置将永久删除：主档、备份×2、覆盖前副本，不可恢复（仅本游戏数据，不波及浏览器其它站点）。确定？')){settingsDoReset()}">重置存档</button>
  </div>`;
  h+=`<button class="btn btn-ghost btn-sm" style="width:100%" onclick="closeSettings()">关闭</button>`;
  document.getElementById('settings-content').innerHTML=h;
  updateVisualThemeControls();
  document.getElementById('settings-modal').classList.add('active');
}
function updateVisualThemeControls(){
  const dark=window.VisualTheme?.get()==='dark';
  for(const id of ['utility-theme','settings-theme-toggle']){
    const button=document.getElementById(id);
    if(!button)continue;
    button.textContent=dark?'切换为日间界面':'切换为夜间界面';
    button.setAttribute('aria-pressed',String(dark));
  }
}
function toggleVisualTheme(){
  window.VisualTheme?.toggle();
  updateVisualThemeControls();
}
// ==================== 存档管理 UI 接线（逻辑在 math.js 存档子系统，此处仅渲染与调用）====================
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
// 重置=定向删除本游戏 4 个 key；部分删除失败时不重载不谎报（IE-001-R1 §4.4）
function settingsDoReset(){
  const r=resetAllSaves();
  if(r.ok){toast('已重置，重新加载…');setTimeout(()=>location.reload(),300);}
  else{toast('部分存档键删除失败：'+r.failed.join('、')+'（未重载）');}
}
function settingsShowExport(rawOnly){
  const el=document.getElementById('save-mgmt-body');if(!el)return;
  const t=rawOnly==='premigration'?readRawKey(PRE_MIGRATION_KEY).text:rawOnly?exportMasterRawText():exportCurrentSaveText();
  el.innerHTML=`<textarea id="save-out" class="save-textarea" readonly rows="5" onclick="this.select()"></textarea><div class="save-help">点选文本框全选后手动复制（不依赖剪贴板授权）</div>`;
  const ta=document.getElementById('save-out');if(ta)ta.value=(t==null)?(rawOnly==='premigration'?'(无可读的迁移前原文)':'(主档不可读)'):t;
}
let _pendingImportText=null;
function settingsShowImport(){
  _pendingImportText=null;
  const el=document.getElementById('save-mgmt-body');if(!el)return;
  el.innerHTML=`<textarea id="save-in" class="save-textarea" rows="4" placeholder="粘贴存档 JSON"></textarea>
    <button class="btn btn-go btn-xs" style="margin-top:4px" onclick="settingsImportCheck()">校验并预览</button><div id="import-preview"></div>`;
}
function settingsImportCheck(){
  const ta=document.getElementById('save-in'),pv=document.getElementById('import-preview');if(!ta||!pv)return;
  _pendingImportText=null;
  const r=inspectSaveText(ta.value);
  if(!r.ok){pv.innerHTML=`<div style="font-size:10px;color:#e06060;margin-top:4px">✗ ${esc(r.reason)}</div>`;return}
  _pendingImportText=r.text;
  const s=r.summary;
  pv.innerHTML=`<div style="font-size:10px;color:#7ed0ff;margin-top:4px">✓ 校验通过 v${s.version} · 人口 ${s.population}/${s.capacity} · 聚落 村${s.settlements.village}/镇${s.settlements.smallTown}/城${s.settlements.city}${s.legacyBonus?` · 历史容量保底 +${s.legacyBonus}`:''} · 通关 ${s.levelsDefeated} 关 · 战功 ${s.merit} · 后备 ${s.poolTotal}（编队 ${s.formTotal}）</div>
    <div style="font-size:9px;color:#888;margin-top:2px">确认后将：当前主档 → 覆盖前副本+有效备份 → 被导入档替换并重载游戏。</div>
    <button class="btn btn-danger btn-xs" style="margin-top:4px" onclick="settingsImportCommit()">确认覆盖导入</button>`;
}
function settingsImportCommit(){
  if(!_pendingImportText)return;
  const r=commitSaveData(_pendingImportText);
  if(!r.ok){_pendingImportText=null;const pv=document.getElementById('import-preview');if(pv)pv.innerHTML=`<div style="font-size:10px;color:#e06060;margin-top:4px">✗ ${esc(r.reason)}（原主档未被改动）</div>`;return}
  _pendingImportText=null;toast('导入成功，重新加载…');setTimeout(()=>location.reload(),300);
}
function settingsShowRestore(){
  const el=document.getElementById('save-mgmt-body');if(!el)return;
  const bs=backupSlotSummaries(),good=bs.filter(b=>b.valid);
  if(!good.length){el.innerHTML=`<div style="font-size:10px;color:#888">暂无可恢复的有效备份${bs.some(b=>b.exists&&!b.valid)?'（存在备份槽但内容无效）':''}</div>`;return}
  el.innerHTML=good.map(b=>`<div class="train-custom" style="margin:3px 0"><span style="flex:1;font-size:10px;color:#c0c8e0">备份 ${b.slot} · 人口 ${b.summary.population}/${b.summary.capacity} · 村${b.summary.settlements.village}/镇${b.summary.settlements.smallTown}/城${b.summary.settlements.city} · 通关 ${b.summary.levelsDefeated} 关 · ${b.summary.ts?new Date(b.summary.ts).toLocaleString():'未知时间'}</span><button class="btn btn-ghost btn-xs" onclick="settingsRestoreCommit(${b.slot})">恢复</button></div>`).join('');
}
function settingsRestoreCommit(slot){
  if(!confirm('恢复备份 '+slot+'？当前主档将先保存为覆盖前副本。'))return;
  const b=backupSlotSummaries().find(x=>x.slot===slot);
  if(!b||!b.valid||!b.text){toast('该备份无效或已不存在');return}
  const r=restoreBackupByText(b.text);
  if(!r.ok){toast(r.reason);return}
  toast('恢复成功，重新加载…');setTimeout(()=>location.reload(),300);
}
function closeSettings(){
  document.getElementById('settings-modal').classList.remove('active');
}
document.getElementById('settings-modal').addEventListener('click',function(e){
  if(e.target===this) closeSettings();
});

// ==================== 日志界面 ====================
function rLog(){
  let h=`<div style="padding:4px 0"><div class="card"><h3>${pix('log','card-pix')}事件日志</h3><div style="max-height:500px;overflow-y:auto;font-size:11px;line-height:1.8">`;
  const l=[...S.log].reverse();
  if(!l.length)h+=`<div style="color:#666">暂无</div>`;
  else for(const e of l)h+=`<span style="color:#555">[${e.time}]</span> ${e.msg}<br>`;
  h+=`</div></div></div>`;return h;
}

// ==================== 工具函数（日志、Toast） ====================
function addLog(msg){S.log.push({time:new Date().toLocaleTimeString(),msg});if(S.log.length>200)S.log.splice(0,S.log.length-200)}
function toast(msg){const e=document.createElement('div');e.className='toast';e.textContent=msg;document.body.appendChild(e);setTimeout(()=>e.remove(),2000)}

// ==================== 长按加速 ====================
let _lpTimer=null,_lpWhich=null,_lpRow=null,_lpIdx=null,_lpDir=null;
function startLongPress(which,row,idx,dir){
  _lpWhich=which;_lpRow=row;_lpIdx=idx;_lpDir=dir;
  adjForm(which,row,idx,dir);
  _lpTimer=setTimeout(()=>{
    _lpTimer=setInterval(()=>{adjForm(which,row,idx,dir);},80);
  },400);
}
function stopLongPress(){
  if(_lpTimer){clearTimeout(_lpTimer);clearInterval(_lpTimer);_lpTimer=null;}
  _lpWhich=_lpRow=_lpIdx=_lpDir=null;
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
    S.page=b.dataset.page;
    document.getElementById('utility-menu').hidden=true;
    document.getElementById('utility-toggle').setAttribute('aria-expanded','false');
    updateUI();document.getElementById('main').scrollTop=0;
  });
});
document.getElementById('resources-toggle').addEventListener('click',e=>{
  const bar=document.getElementById('topbar');
  const open=bar.classList.toggle('expanded');
  e.currentTarget.setAttribute('aria-expanded',String(open));
  e.currentTarget.setAttribute('aria-label',open?'收起资源':'展开全部资源');
});
document.getElementById('utility-toggle').addEventListener('click',e=>{
  const menu=document.getElementById('utility-menu');
  menu.hidden=!menu.hidden;
  e.currentTarget.setAttribute('aria-expanded',String(!menu.hidden));
});
document.getElementById('utility-log').addEventListener('click',()=>{
  document.getElementById('utility-menu').hidden=true;
  document.getElementById('utility-toggle').setAttribute('aria-expanded','false');
  S.page='log';updateUI();document.getElementById('main').scrollTop=0;
});
document.getElementById('utility-theme').addEventListener('click',toggleVisualTheme);
document.getElementById('utility-settings').addEventListener('click',()=>{
  document.getElementById('utility-menu').hidden=true;
  document.getElementById('utility-toggle').setAttribute('aria-expanded','false');
  openSettings();
});
updateVisualThemeControls();

// ==================== init ====================
injectPixelIcons();
load();
syncBattleSpeedButtons();
settleOffline();   // 切片11：启动加载成功后结算一次离线收益（幂等：同 ts 只结一次）
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) settleOffline(); });  // 回前台再结算一次
if(S.defeated.length<CFG.enemies.length&&S.selEnemy===null)S.selEnemy=S.defeated.length;
if(S.selEnemy===null)S.selEnemy=CFG.enemies.length-1;
updateUI();
if(!saveProtected())setInterval(tick,CFG.tickMs);
addLog('欢迎！');
