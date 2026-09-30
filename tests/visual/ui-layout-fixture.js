/* Development-only presentation data. Not referenced by the player's index. */
(()=>{
  for(const id of window.uiReviewTimers.ids)clearInterval(id);
  window.setInterval=window.uiReviewTimers.original;
  const mode=new URLSearchParams(location.search).get('state')||'initial';
  // Reset presentation fields so earlier UI action checks cannot leak into a fixture.
  S.res=Object.fromEntries(Object.keys(CFG.res).map(key=>[key,0]));
  Object.assign(S.res,{wood:300,stone:300,food:300,deed:30});
  S.buildings={};S.sciences=[];S.defeated=[];S.merit=0;S._buildTab='ready';
  S.metalRecipeMode='coal';S.currencyRecipeMode='copper';S.storageMode='aligned';
  S.settlements={village:0,smallTown:0,city:1};
  S.population={current:CFG.pop.initial,growthClock:0,legacyBonus:0};
  for(const key of Object.keys(S.popAlloc))S.popAlloc[key]=CFG.pop.initialAlloc[key]||0;
  S.offline.pendingReport=null;
  // These states exercise layout extremes, and do not claim gameplay reachability.
  if(mode==='advanced'||mode==='missing'){
    S.defeated=Array.from({length:100},(_,i)=>i);
    S.sciences=Object.keys(activeSciences());
    S.settlements={village:120,smallTown:10,city:5};
    S.population.current=60;
    S.res=Object.fromEntries(Object.keys(CFG.res).map(key=>[key,12345678]));
    S.res.wood=123456789;S.res.food=8000;
    S.items=Object.fromEntries(Object.keys(S.items).map(key=>[key,12345678]));
    S.essence=Object.fromEntries(Object.keys(CFG.essences||{}).map(key=>[key,12345678]));
    for(const key of Object.keys(CFG.buildings))S.buildings[key]={lv:1,state:'idle',tier:0,timer:0,timerEnd:0};
    S.buildings.lumber_mill.lv=2;
    S.buildings.quarry={lv:1,state:'upgrading',tier:0,timer:12,timerEnd:30};
    for(const key of Object.keys(S.popAlloc))S.popAlloc[key]=0;
    Object.assign(S.popAlloc,{wood:10,stone:8,food:5,tech:3,coal:2,copper:2,iron:1});
    S.merit=12345678;
    if(mode==='missing'){
      let entry=Object.entries(activeSciences()).reverse().find(([,science])=>
        !science.legacyOnly&&(!science.storageMode||science.storageMode===S.storageMode)&&
        (!science.currencyMode||science.currencyMode===S.currencyRecipeMode)&&science.cost?.wood>0&&science.cost?.tech>0);
      // Current sciences use only knowledge. A fixture cost exercises the renderer's
      // supported multi-resource case without changing the player's configuration.
      if(!entry){entry=Object.entries(activeSciences()).reverse().find(([,science])=>
        !science.legacyOnly&&!science.storageMode&&!science.currencyMode&&science.cost?.tech>0);
        if(entry)entry[1].cost={...entry[1].cost,wood:100};}
      if(entry){S.sciences=S.sciences.filter(id=>id!==entry[0]);S.res.tech=entry[1].cost.tech;}
      S.res.wood=0;S.res.stone=0;
    }
  }else if(mode==='ready'){
    S.res.tech=5000;S.population.current=4;
  }else if(mode==='fractional'){
    S.sciences=[];S.res.tech=99.5;
  }else if(mode==='legacy'){
    S.currencyRecipeMode='legacy';S.population.current=4;
    S.sciences=Object.keys(activeSciences());
    S.buildings.mint={lv:1,state:'idle',tier:0,timer:0,timerEnd:0};
    S.popAlloc.coin=1;
  }
  S.page='home';
  const stable=()=>JSON.stringify({res:S.res,popAlloc:S.popAlloc,population:S.population,
    buildings:S.buildings,sciences:S.sciences,merit:S.merit,items:S.items});
  const before=stable();
  rHome();rBuild();rTech();
  const output=document.createElement('output');output.id='ui-fixture-status';output.hidden=true;
  output.textContent=JSON.stringify({mode,renderPreservesState:before===stable(),
    hasWebGL:!!window.HD2D,missingCase:mode==='missing'});
  document.body.appendChild(output);
  updateUI();
  // Exercise actual periodic UI rebuilding without advancing the fixture's economy.
  setInterval(updateUI,1000);
})();
