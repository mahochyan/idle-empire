'use strict';
// Run: node tests/visual/browser_smoke.js
// Real Edge/CDP smoke with an isolated profile and local HTTP origin for WebGL textures.
// In-memory battle formation is only a presentation fixture, not a reachability claim.
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const root=path.resolve(__dirname,'../..');
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(file=>fs.existsSync(file));
if(!edge){console.error('NO_BROWSER: Microsoft Edge 未安装');process.exit(2);}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary'};
const missing=new Set();
const server=http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch(_){res.writeHead(400).end();return;}
  const relative=pathname.replace(/^\/+/, '')||'index.html';
  const file=path.resolve(root,relative);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){if(pathname!=='/favicon.ico')missing.add(pathname);res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
  });
});

const tempRoot=fs.realpathSync(os.tmpdir());
const profile=fs.mkdtempSync(path.join(tempRoot,'visual-cdp-'));
if(!path.resolve(profile).startsWith(tempRoot+path.sep))throw Error('profile path outside temp');
const screenshotDir=fs.mkdtempSync(path.join(tempRoot,'visual-smoke-shots-'));
const screenshots=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const checks=[],exceptions=[];
const pending=new Map();
let browser,ws,nextId=0,spawnError;
function check(name,ok,detail){checks.push({name,ok:!!ok,detail:ok?undefined:detail});}
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method));},60000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evalJs(expression){
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function ready(){
  for(let i=0;i<80;i++){
    try{if(await evalJs("document.readyState==='complete'&&Array.isArray(window.APP_SCRIPTS)&&typeof updateUI==='function'&&typeof HD2D==='object'"))return true;}catch(_){}
    await sleep(100);
  }
  return false;
}
async function waitForProtocol(protocol){
  for(let i=0;i<80;i++){
    try{if(await evalJs(`location.protocol===${JSON.stringify(protocol)}&&document.readyState==='complete'&&typeof HD2D==='object'`))return true;}catch(_){}
    await sleep(100);
  }
  return false;
}
async function setView(width,height=800){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
  await sleep(120);
}
async function layout(){
  return evalJs(`(()=>{
    const ids=['phone','topbar','main','navbar'];
    const overflow={document:document.documentElement.scrollWidth>innerWidth+1,
      body:document.body.scrollWidth>innerWidth+1};
    for(const id of ids){const el=document.getElementById(id);overflow[id]=!!el&&el.scrollWidth>el.clientWidth+1;}
    const smallTargets=[...document.querySelectorAll('#topbar button,#navbar button,#main button,#main summary,#main input,#main select')]
      .filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')
      .map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,id:el.id,
        className:typeof el.className==='string'?el.className:'',text:(el.textContent||'').trim().slice(0,28),
        width:r.width,height:r.height};})
      .filter(item=>item.width<48||item.height<48);
    const main=document.getElementById('main'),right=main.getBoundingClientRect().right;
    const overflowers=overflow.main?[...main.querySelectorAll('*')].filter(el=>{
      const r=el.getBoundingClientRect();return r.width>0&&r.right>right+1;
    }).slice(0,12).map(el=>({tag:el.tagName,className:el.className,
      text:(el.textContent||'').trim().slice(0,32),right:el.getBoundingClientRect().right})):[];
    return {width:innerWidth,overflow,smallTargets,overflowers,nav:[...document.querySelectorAll('#navbar .nav-btn')].map(el=>({
      page:el.dataset.page,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}))};
  })()`);
}
async function clickNav(page){
  return evalJs(`(()=>{const el=document.querySelector('#navbar .nav-btn[data-page="${page}"]');if(!el)return false;el.click();return S.page==='${page}'&&el.classList.contains('on');})()`);
}
async function awaitPage(){await sleep(180);}
async function shot(name){
  const result=await send('Page.captureScreenshot',{format:'png'});
  const file=path.join(screenshotDir,name+'.png');
  fs.writeFileSync(file,Buffer.from(result.data,'base64'));
  screenshots.push(file);
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const pageUrl=`http://127.0.0.1:${server.address().port}/index.html`;
  const cdpPort=26500+Math.floor(Math.random()*1000);
  browser=spawn(edge,[
    '--headless=new','--no-first-run','--disable-extensions','--no-sandbox',
    '--disable-background-networking','--disable-component-update','--disable-sync',
    '--enable-unsafe-swiftshader','--remote-debugging-port='+cdpPort,
    '--user-data-dir='+profile,pageUrl
  ],{stdio:'ignore',windowsHide:true});
  browser.on('error',error=>{spawnError=error;});
  let targets;
  for(let i=0;i<40;i++){
    await sleep(500);
    if(spawnError)throw spawnError;
    try{targets=await(await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
      if(targets.some(target=>target.type==='page'))break;}catch(_){}
  }
  const page=targets?.find(target=>target.type==='page'&&target.url===pageUrl)||targets?.find(target=>target.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=message=>{
    const data=JSON.parse(message.data);
    if(data.id&&pending.has(data.id)){
      const item=pending.get(data.id);pending.delete(data.id);clearTimeout(item.timer);
      data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result);
    }
    if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
  };
  await send('Runtime.enable');await send('Page.enable');
  await setView(390);await send('Page.reload',{ignoreCache:true});
  check('HTTP 页面及原脚本链已加载',await ready());
  check('游戏脚本依赖顺序保持原样',await evalJs("APP_SCRIPTS.join(',')==='config.js,levels.js,sprites.js,math.js,garrison.js,technology.js,ui.js'"));
  check('五个底部入口顺序正确',await evalJs("[...document.querySelectorAll('#navbar .nav-btn')].map(x=>x.dataset.page).join(',')==='home,build,tech,barracks,fight'"));
  const daylight=await evalJs(`(()=>{
    const el=document.getElementById('phone');
    const rgb=getComputedStyle(el).backgroundColor.match(/\\d+/g)?.slice(0,3).map(Number)||[];
    return {rgb,brightness:rgb.length===3?rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722:0};
  })()`);
  check('手机主体采用明亮日间配色',daylight.brightness>180,daylight);

  const resource=await evalJs(`(()=>{
    const btn=document.getElementById('resources-toggle'),bar=document.getElementById('topbar');
    const core=['wood','stone','food'].every(id=>{const el=document.getElementById('res-'+id)?.closest('.top-res');return !!el&&getComputedStyle(el).display!=='none';});
    const closed=btn.getAttribute('aria-expanded')==='false'&&getComputedStyle(document.getElementById('res-tech').closest('.top-res')).display==='none';
    btn.click();const opened=bar.classList.contains('expanded')&&btn.getAttribute('aria-expanded')==='true'&&getComputedStyle(document.getElementById('res-tech').closest('.top-res')).display!=='none';
    btn.click();return {core,closed,opened,closedAgain:btn.getAttribute('aria-expanded')==='false'};
  })()`);
  check('木石粮常驻，其他资源可展开再收起',Object.values(resource).every(Boolean),resource);
  const utility=await evalJs(`(()=>{
    const btn=document.getElementById('utility-toggle'),menu=document.getElementById('utility-menu');
    btn.click();const open=!menu.hidden&&btn.getAttribute('aria-expanded')==='true'&&!!document.getElementById('utility-settings');
    btn.click();return {open,closed:menu.hidden&&btn.getAttribute('aria-expanded')==='false'};
  })()`);
  check('日志与设置在更多菜单中',utility.open&&utility.closed,utility);

  const themeSwitch=await evalJs(`(()=>{
    const button=document.getElementById('utility-theme');
    const before=localStorage.getItem('rts_save');
    button.click();
    return {theme:VisualTheme.get(),root:document.documentElement.dataset.theme,
      saved:localStorage.getItem('idle_empire_visual_theme'),
      pressed:button.getAttribute('aria-pressed'),
      saveUntouched:localStorage.getItem('rts_save')===before,
      color:document.querySelector('meta[name="theme-color"]')?.content};
  })()`);
  check('更多菜单手动开启夜间界面且独立记忆，不改主存档',
    themeSwitch.theme==='dark'&&themeSwitch.root==='dark'&&themeSwitch.saved==='dark'&&
    themeSwitch.pressed==='true'&&themeSwitch.saveUntouched&&themeSwitch.color==='#17232b',themeSwitch);
  for(const width of [320,360,390,430]){
    await setView(width);
    for(const pageName of ['home','build','tech','barracks','fight']){
      await clickNav(pageName);await awaitPage();
      const night=await evalJs(`(()=>{
        const phone=getComputedStyle(document.getElementById('phone'));
        const top=getComputedStyle(document.getElementById('topbar'));
        const nav=getComputedStyle(document.getElementById('navbar'));
        const rgb=value=>value.match(/\\d+/g)?.slice(0,3).map(Number)||[];
        const light=value=>{const c=rgb(value);return c.length===3?c[0]*.2126+c[1]*.7152+c[2]*.0722:255;};
        return {theme:VisualTheme.get(),phone:light(phone.backgroundColor),
          top:light(top.backgroundColor),nav:light(nav.backgroundColor)};
      })()`);
      const view=await layout();
      check(`${width}px ${pageName} 夜间界面深色且无横向溢出`,
        night.theme==='dark'&&night.phone<100&&night.top<100&&night.nav<100&&
        Object.values(view.overflow).every(value=>value===false),{night,overflow:view.overflow});
      if(width===390&&['home','build','tech','fight'].includes(pageName))await shot(`390-dark-${pageName}`);
      if(width===390&&pageName==='tech'){
        const darkScience=await evalJs(`(()=>{
          const full=document.getElementById('tech-full');full.open=true;
          document.querySelector('.tech-tree-nav button[data-category="science"]')?.click();
          full.scrollIntoView({block:'start'});
          const row=document.querySelector('.tech-science-row');
          return {count:document.querySelectorAll('.tech-science-row').length,
            background:row?getComputedStyle(row).backgroundColor:null,
            textSize:row?parseFloat(getComputedStyle(row.querySelector('.tech-science-cost')).fontSize):0,
            disabledOpacity:row?.querySelector('button:disabled')?
              getComputedStyle(row.querySelector('button:disabled')).opacity:null};
        })()`);
        check('390px 夜间当前科研使用深色卡片且费用文字至少12px',
          darkScience.count>=1&&darkScience.background==='rgb(41, 56, 58)'&&
          darkScience.textSize>=12&&darkScience.disabledOpacity==='1',
          darkScience);
        await shot('390-dark-tech-tree-science');
        await evalJs(`(()=>{document.getElementById('tech-full').open=false;})()`);
      }
    }
  }
  await send('Page.reload',{ignoreCache:true});
  check('刷新后仍为夜间界面',await ready()&&await evalJs(`VisualTheme.get()==='dark'&&
    document.documentElement.dataset.theme==='dark'&&document.getElementById('utility-theme').getAttribute('aria-pressed')==='true'`));
  const settingsTheme=await evalJs(`(()=>{
    openSettings();const control=document.getElementById('settings-theme-toggle');
    const before=control?.getAttribute('aria-pressed');control?.click();
    const result={before,after:control?.getAttribute('aria-pressed'),theme:VisualTheme.get(),
      saved:localStorage.getItem('idle_empire_visual_theme')};
    closeSettings();return result;
  })()`);
  check('设置中可手动恢复日间界面并记住选择',settingsTheme.before==='true'&&
    settingsTheme.after==='false'&&settingsTheme.theme==='light'&&settingsTheme.saved==='light',settingsTheme);

  const saveTextareas=await evalJs(`(()=>{
    openSettings();settingsShowExport(false);
    const checkArea=id=>{const el=document.getElementById(id);if(!el)return null;
      const style=getComputedStyle(el),rgb=style.backgroundColor.match(/\\d+/g)?.slice(0,3).map(Number)||[];
      return {background:style.backgroundColor,
        brightness:rgb.length===3?rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722:0,
        fontSize:parseFloat(style.fontSize),height:el.getBoundingClientRect().height};};
    const exported=checkArea('save-out');settingsShowImport();const imported=checkArea('save-in');
    closeSettings();return {exported,imported};
  })()`);
  check('存档导入导出文本框使用明亮可读样式',
    !!saveTextareas.exported&&!!saveTextareas.imported&&
    [saveTextareas.exported,saveTextareas.imported].every(area=>
      area.brightness>180&&area.fontSize>=12&&area.height>=100),saveTextareas);

  for(const width of [320,360,390,430]){
    await setView(width);
    for(const pageName of ['home','build','tech','barracks','fight']){
      const clicked=await clickNav(pageName);await awaitPage();
      const view=await layout();
      check(`${width}px ${pageName} 导航和横向布局`,clicked&&view.width===width&&
        Object.values(view.overflow).every(value=>value===false)&&
        view.nav.every(item=>item.width>=48&&item.height>=48),view);
      check(`${width}px ${pageName} 可见控件至少 48px`,view.smallTargets.length===0,view.smallTargets);
      if([320,390,430].includes(width)){
        await sleep(220);await shot(`${width}-${pageName}`);
      }
    }
  }

  await setView(390);await clickNav('barracks');
  const armyPortraits=await evalJs(`(async()=>{
    const expected=['bronze_guard','iron_spearman','silver_heavy','gold_cavalry',
      'alloy_special','armored_trooper','electro_trooper','star_trooper'];
    const images=expected.map(id=>{const host=document.createElement('div');host.innerHTML=unitPortrait(id,'mini');const image=host.querySelector('img');image.loading='eager';return image});
    const sources=images.map(image=>image.getAttribute('src'));
    const failed=[];
    for(const image of images){try{await image.decode();}catch(_){failed.push(image.getAttribute('src'));}}
    return {expected,sources,failed,visibleLocked:document.querySelectorAll('.barracks-branch-header').length};
  })()`);
  check('八个时代兵种立绘可解码，未解锁时军队页隐藏分支',
    armyPortraits.expected.every(id=>armyPortraits.sources.includes('./assets/art/units/hires/'+id+'.png'))&&
    armyPortraits.failed.length===0&&armyPortraits.visibleLocked===0,armyPortraits);
  const armyFormation=await evalJs(`(()=>{
    window.__armyVisualPrevious={formation:S.formation,garrison:S._garrisonForm,tab:S._barracksTab};
    S.formation={front:[{type:'infantry',count:10,id:901}],mid:[],back:[]};
    S._garrisonForm={front:[{type:'bronze_guard',count:8,id:902}],mid:[],back:[]};
    S._barracksTab='formation';updateUI();
    const tags=[...document.querySelectorAll('.army-formation-unit')];
    const bright=tags.map(el=>{const rgb=getComputedStyle(el).backgroundColor.match(/\\d+/g)?.slice(0,3).map(Number)||[];
      return rgb.length===3?rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722:0;});
    return {tags:tags.length,bright,sources:tags.map(el=>el.querySelector('img')?.getAttribute('src'))};
  })()`);
  check('军队编队标签采用浅色背景和兵种立绘',armyFormation.tags===2&&
    armyFormation.bright.every(value=>value>180)&&
    armyFormation.sources.includes('./assets/art/units/hires/infantry.png')&&
    armyFormation.sources.includes('./assets/art/units/hires/bronze_guard.png'),armyFormation);
  await shot('390-army-formation');
  await evalJs(`(()=>{const previous=window.__armyVisualPrevious;
    S.formation=previous.formation;S._garrisonForm=previous.garrison;S._barracksTab=previous.tab;
    delete window.__armyVisualPrevious;updateUI();})()`);

  await setView(390);
  await clickNav('build');
  const build=await evalJs(`(()=>{
    const input=document.getElementById('build-search');
    const visible=()=>[...document.querySelectorAll('.build-entry')].filter(el=>!el.hidden);
    const before=visible().length,total=document.querySelectorAll('.build-entry').length;
    if(!input)return {input:false,before,total};
    input.value='仓库';input.dispatchEvent(new Event('input',{bubbles:true}));
    const rows=visible().map(el=>el.textContent);
    const filtered=rows.length>0&&rows.length<total&&rows.every(text=>text.includes('仓库'));
    input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));
    const tabs=[...document.querySelectorAll('.build-filters button')];
    tabs.find(el=>el.textContent.includes('经济'))?.click();
    const categoryRows=visible();
    const category=categoryRows.length>0&&categoryRows.every(el=>el.dataset.category==='economy');
    [...document.querySelectorAll('.build-filters button')].find(el=>el.textContent.includes('可处理'))?.click();
    return {input:true,before,total,filtered,restored:visible().length===before,
      filters:tabs.length,category};
  })()`);
  check('建筑搜索缩小结果且清空后恢复',build.input&&build.before>0&&build.filtered&&build.restored,build);
  check('建筑类别仅显示对应建筑',build.filters>=4&&build.category,build);

  await setView(320);await clickNav('build');
  const detailOpen=await evalJs(`(()=>{
    for(let id=1;id<300;id++)clearInterval(id);
    const details=[...document.querySelectorAll('.build-entry:not([hidden]) details')][0];
    if(details){details.open=true;details.closest('.build-entry').scrollIntoView({block:'start'});}
    return !!details&&details.open;
  })()`);
  check('320px 建筑详情可展开',detailOpen);
  await shot('320-build-detail');

  await setView(390);
  await clickNav('tech');
  const tech=await evalJs(`(()=>{
    const overview=document.getElementById('tech-overview');
    const toggle=document.getElementById('tech-tree-toggle');
    const before=!!overview&&!!toggle;
    if(toggle)toggle.click();
    const detail=document.getElementById('tech-full');
    const groups=[...document.querySelectorAll('.tech-tree-nav button')];
    const unit=groups.find(el=>el.dataset.category==='units');if(unit)unit.click();
    return {before,tree:!!detail&&detail.open,groups:groups.map(el=>el.dataset.category),
      category:document.querySelector('.tech-full')?.dataset.category};
  })()`);
  check('新档科技概览只显示科研和初始兵种分组',tech.before&&tech.tree&&
    tech.groups.join(',')==='science,units'&&tech.category==='units',tech);
  const techPortraits=await evalJs(`(async()=>{
    const expected=[...new Set(Object.values(CFG.unitUpgrades)
      .flatMap(line=>Object.keys(line.tree||{})))].sort();
    const nodes=[...document.querySelectorAll('.tech-full .tech-unit-node[data-unit]')];
    const actual=nodes.map(node=>node.dataset.unit).sort();
    const wrongSource=nodes.filter(node=>{
      const id=node.dataset.unit;
      return node.querySelector('img.unit-portrait-tech')?.getAttribute('src')!==
        './assets/art/units/hires/'+id+'.png';
    }).map(node=>node.dataset.unit);
    const images=await Promise.all(expected.map(id=>new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>resolve({id,ok:image.naturalWidth>0&&image.naturalHeight>0});
      image.onerror=()=>resolve({id,ok:false});
      image.src='./assets/art/units/hires/'+id+'.png';
    })));
    return {expected,actual,wrongSource,failedImages:images.filter(image=>!image.ok).map(image=>image.id)};
  })()`);
  check('新档兵谱只显示初始步弓节点且各自引用精确立绘',techPortraits.expected.length===26&&
    techPortraits.actual.join(',')==='archer,infantry'&&
    techPortraits.wrongSource.length===0,techPortraits);
  check('科技树26张立绘在浏览器中均能解码',techPortraits.failedImages.length===0,
    techPortraits.failedImages);
  for(const category of ['science','units','arms','mastery','storage']){
    await evalJs(`(()=>{const button=document.querySelector('.tech-tree-nav button[data-category="${category}"]');
      button?.click();document.getElementById('tech-full')?.scrollIntoView({block:'start'});return !!button;})()`);
    await sleep(130);await shot(`390-tech-tree-${category}`);
  }
  await setView(320);
  await evalJs(`(()=>{document.querySelector('.tech-tree-nav button[data-category="science"]')?.click();
    document.getElementById('tech-full')?.scrollIntoView({block:'start'});})()`);
  const narrowScience=await evalJs(`(()=>{
    const rows=[...document.querySelectorAll('.tech-full .tech-science-row')];
    const visible=rows.filter(row=>row.getClientRects().length);
    const main=document.getElementById('main');
    return {count:visible.length,
      categoryButtons:[...document.querySelectorAll('.tech-tree-nav button')].map(button=>({
        category:button.dataset.category,pressed:button.getAttribute('aria-pressed'),
        disabled:button.disabled,opacity:getComputedStyle(button).opacity,
        background:getComputedStyle(button).backgroundColor})),
      smallText:visible.filter(row=>['.tech-science-desc','.tech-science-cost'].some(selector=>{
        const el=row.querySelector(selector);return !!el&&parseFloat(getComputedStyle(el).fontSize)<12;
      })).length,
      smallButtons:visible.filter(row=>{const button=row.querySelector('button');
        if(!button)return false;const box=button.getBoundingClientRect();return box.width<48||box.height<48;
      }).length,
      fadedButtons:visible.filter(row=>{const button=row.querySelector('button:disabled');
        return !!button&&getComputedStyle(button).opacity!=='1';}).length,
      overflow:main.scrollWidth>main.clientWidth+1||
        visible.some(row=>row.getBoundingClientRect().right>main.getBoundingClientRect().right+1)};
  })()`);
  check('320px 当前资源科技文字至少12px、研究按钮至少48px且无溢出',
    narrowScience.count>=1&&narrowScience.smallText===0&&narrowScience.smallButtons===0&&
    narrowScience.fadedButtons===0&&
    !narrowScience.overflow&&
    narrowScience.categoryButtons.filter(button=>button.pressed==='true').map(button=>button.category).join(',')==='science',
    narrowScience);
  await shot('320-tech-tree-science');
  const freshHidden=await evalJs(`(()=>({categories:[...document.querySelectorAll('.tech-tree-nav button')].map(button=>button.dataset.category),
    details:document.querySelectorAll('.tech-full .tech-detail-row').length}))()`);
  check('新档未解锁军备、精通、仓储分类直接隐藏',
    freshHidden.categories.join(',')==='science,units'&&freshHidden.details===0,freshHidden);
  const unlockedCategories=await evalJs(`(()=>{
    window.__visualSciencePrior=S.sciences.slice();
    const needs=[...Object.values(CFG.weaponForge).map(cfg=>cfg.needScience),
      ...Object.values(CFG.armsUp).map(cfg=>cfg.needScience),
      ...Object.values(CFG.eraStorage).map(cfg=>cfg.needScience),
      CFG.storageMastery.needScience,CFG.scholarMastery.needScience,CFG.steelMastery.needScience];
    S.sciences=[...new Set([...S.sciences,...needs.filter(Boolean)])];
    updateUI();setTechFullOpen(true);
    return [...document.querySelectorAll('.tech-tree-nav button')].map(button=>button.dataset.category);
  })()`);
  check('研究对应前置后军备、精通、仓储分类出现',
    ['science','units','arms','mastery','storage'].every(category=>unlockedCategories.includes(category)),
    unlockedCategories);
  for(const category of ['arms','mastery','storage']){
    await evalJs(`(()=>{document.querySelector('.tech-tree-nav button[data-category="${category}"]')?.click();
      document.getElementById('tech-full')?.scrollIntoView({block:'start'});})()`);
    const detail=await evalJs(`(()=>{
      const main=document.getElementById('main');
      const rows=[...document.querySelectorAll('.tech-full .tech-detail-row')]
        .filter(row=>row.getClientRects().length);
      const text=rows.flatMap(row=>[...row.querySelectorAll('.tech-detail-desc,.tech-detail-cost')]);
      const buttons=rows.flatMap(row=>[...row.querySelectorAll('button')]);
      return {rows:rows.length,buttons:buttons.length,
        tinyText:text.filter(el=>parseFloat(getComputedStyle(el).fontSize)<12).length,
        tinyButtons:buttons.filter(el=>{const box=el.getBoundingClientRect();
          return box.width<48||box.height<48;}).length,
        missingActions:buttons.filter(el=>!el.getAttribute('onclick')).length,
        overflow:main.scrollWidth>main.clientWidth+1||rows.some(row=>
          row.getBoundingClientRect().right>main.getBoundingClientRect().right+1)};
    })()`);
    check(`320px ${category==='arms'?'军备':category==='mastery'?'精通':'仓储'}分层信息、费用与操作可读可触达`,
      detail.rows>=(category==='mastery'?2:3)&&detail.buttons>=(category==='mastery'?2:3)&&detail.tinyText===0&&
      detail.tinyButtons===0&&detail.missingActions===0&&!detail.overflow,detail);
    await shot(`320-tech-tree-${category}`);
  }
  await evalJs('toggleVisualTheme()');
  for(const category of ['arms','mastery','storage']){
    const darkDetail=await evalJs(`(()=>{
      document.querySelector('.tech-tree-nav button[data-category="${category}"]')?.click();
      const main=document.getElementById('main');
      const rows=[...document.querySelectorAll('.tech-full .tech-detail-row')]
        .filter(row=>row.getClientRects().length);
      const disabled=rows.flatMap(row=>[...row.querySelectorAll('button:disabled')]);
      return {theme:VisualTheme.get(),rows:rows.length,disabled:disabled.length,
        faded:disabled.filter(button=>getComputedStyle(button).opacity!=='1').length,
        overflow:main.scrollWidth>main.clientWidth+1};
    })()`);
    check(`320px 夜间${category==='arms'?'军备':category==='mastery'?'精通':'仓储'}禁用按钮仍可读`,
      darkDetail.theme==='dark'&&darkDetail.rows>0&&darkDetail.disabled>0&&
      darkDetail.faded===0&&!darkDetail.overflow,darkDetail);
  }
  await evalJs('toggleVisualTheme()');
  await evalJs(`(()=>{S.sciences=window.__visualSciencePrior;delete window.__visualSciencePrior;
    updateUI();setTechFullOpen(true);})()`);
  await evalJs(`(()=>{document.querySelector('.tech-tree-nav button[data-category="units"]')?.click();
    document.getElementById('tech-full')?.scrollIntoView({block:'start'});})()`);
  const narrowTree=await layout();
  check('320px 完整兵种科技树无横向溢出且控件可触达',
    Object.values(narrowTree.overflow).every(value=>value===false)&&narrowTree.smallTargets.length===0,
    narrowTree);
  await shot('320-tech-tree-units');

  await setView(390);await clickNav('home');await sleep(700);
  const town=await evalJs(`(()=>{
    const map=document.querySelector('.town-map'),spots=[...document.querySelectorAll('.town-hotspot')];
    const expanded=document.querySelector('.town-expand-button');
    const height=map?.getBoundingClientRect().height||0;
    const quality=HD2D.status().town;
    if(expanded)expanded.click();
    const open=!!document.querySelector('.town-map-card.is-expanded');
    if(expanded)expanded.click();
    return {height,hotspots:spots.length,smallTargets:spots.filter(el=>el.getBoundingClientRect().height<44).length,
      expand:!!expanded&&open&&!document.querySelector('.town-map-card.is-expanded'),
      workerLabel:document.querySelector('.town-art-state')?.textContent.startsWith('工人：'),
      renderer:quality.mounted,canvas:!!document.querySelector('#town-scene canvas'),
      fallback:!!document.querySelector('#town-scene .town-map')};
  })()`);
  check('主城地图尺寸、工人数标签、展开与文字入口',town.height>=180&&town.height<=230&&town.hotspots>=5&&town.smallTargets===0&&town.expand&&town.workerLabel,town);
  check('主城 WebGL 或二维回退可用',town.renderer?town.canvas:town.fallback,town);
  const townEras=['base','sci_bronze_age','sci_iron_age','sci_silver_age','sci_gold_age',
    'sci_alloy_age','sci_steam_age','sci_electric_age','sci_nuclear_age'];
  for(const era of townEras){
    const chosen=await evalJs(`(()=>{
      const saved=S.sciences;
      try{
        S.sciences=saved.filter(id=>!TOWN_ERA_SCIENCES.includes(id));
        if(${JSON.stringify(era)}!=='base')S.sciences.push(${JSON.stringify(era)});
        const snapshot=townVisualSnapshot(),html=renderTownMapOverview();
        return {snapshotEra:snapshot.era,mapEra:html.match(/data-era="([^"]+)"/)?.[1]||'',
          imagePath:html.includes('town-'+${JSON.stringify(era)}+'.png')};
      }finally{S.sciences=saved;}
    })()`);
    check(`主城 ${era} 科技状态选择对应美术`,chosen.snapshotEra===era&&chosen.mapEra===era&&chosen.imagePath,chosen);
    const decoded=await evalJs(`(async()=>{
      const img=new Image();img.src='./assets/art/scene/town-${era}.png';
      try{await img.decode();return {ok:img.naturalWidth>0,width:img.naturalWidth,height:img.naturalHeight};}
      catch(e){return {ok:false,reason:String(e)};}
    })()`);
    check(`主城 ${era} 美术文件在浏览器中可解码`,decoded.ok,decoded);
  }
  if(town.renderer){
    for(const era of townEras){
      await evalJs(`HD2D.updateTown({...townVisualSnapshot(),era:'${era}'})`);
      let switched=false;
      for(let i=0;i<35;i++){
        switched=await evalJs(`(()=>{const state=HD2D.status().town;
          return state.artworkEra==='${era}'&&state.reliefLayers===6;})()`);
        if(switched)break;
        await sleep(100);
      }
      check(`WebGL 主城切换并展示 ${era} 美术与六层浮雕`,switched,await evalJs('HD2D.status().town'));
      if(switched){await sleep(70);await shot(`390-town-${era}`);}
    }
    await evalJs('HD2D.updateTown(townVisualSnapshot())');
    const townFixture=await evalJs(`(()=>{
      const snapshot=townVisualSnapshot();
      window.__townReliefFixture={...snapshot,
        workers:{wood:17,stone:6,food:1},
        buildings:{...snapshot.buildings,barracks:{lv:1,state:'upgrading'}},
        garrison:{active:true,phase:'warning'}};
      return HD2D.updateTown(window.__townReliefFixture);
    })()`);
    check('主城浮雕状态样本能更新',townFixture);
    for(const width of [320,360,390,430]){
      await setView(width);
      const scene=await evalJs(`(()=>{
        HD2D.updateTown(window.__townReliefFixture);
        document.querySelector('.town-art-state').textContent='工人：木 17 · 石 6 · 粮 1 · 巡防警戒';
        const map=document.querySelector('.town-map');
        return {status:HD2D.status().town,rect:map.getBoundingClientRect().toJSON(),
          textVisible:getComputedStyle(document.querySelector('.town-art-state')).visibility==='visible',
          workerLabel:document.querySelector('.town-art-state').textContent.startsWith('工人：'),
          overflow:document.documentElement.scrollWidth>innerWidth+1};
      })()`);
      check(`${width}px 九时代主城浮雕、工人、驻军及状态条同屏`,
        scene.status.artworkReady&&scene.status.reliefLayers===6&&
        scene.status.visibleWorkers===6&&scene.status.visibleGuards===1&&
        scene.textVisible&&scene.workerLabel&&
        !scene.overflow&&scene.rect.height>=180&&scene.rect.height<=230,scene);
      await sleep(130);await shot(`${width}-town-relief-workers-guard`);
    }
    await setView(390);
    await evalJs(`(()=>{
      document.querySelector('.town-expand-button').click();
      HD2D.updateTown({...window.__townReliefFixture,expanded:true});
    })()`);
    await sleep(160);await shot('390-town-relief-expanded-before-pan');
    const drag=await evalJs(`(()=>{
      const r=document.querySelector('#town-scene canvas').getBoundingClientRect();
      return {x:r.left+r.width*0.50,y:r.top+r.height*0.60};
    })()`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:drag.x,y:drag.y,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:drag.x+80,y:drag.y+18,button:'left',buttons:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:drag.x+80,y:drag.y+18,button:'left',clickCount:1});
    const parallax=await evalJs('HD2D.status().town.reliefParallaxPx');
    check('展开主城拖动后六个原画浮雕层产生受限视差',parallax>0.5&&parallax<8,parallax);
    await sleep(120);await shot('390-town-relief-expanded-after-pan');
    await evalJs(`(()=>{
      document.querySelector('.town-expand-button').click();
      HD2D.updateTown(townVisualSnapshot());
      document.querySelector('.town-art-state').textContent='工人：木 0 · 石 0 · 粮 0 · 无驻军';
    })()`);
    check('收起主城后相机回正并清除视差',
      await evalJs('HD2D.status().town.reliefParallaxPx===0'));
    const techPoint=await evalJs(`(()=>{
      const r=document.querySelector('.town-art-tech').getBoundingClientRect();
      return {x:r.left+r.width/2,y:r.top+r.height/2};
    })()`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:techPoint.x,y:techPoint.y,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:techPoint.x,y:techPoint.y,button:'left',clickCount:1});
    const techTap=await evalJs(`(()=>({page:S.page,status:HD2D.status().town,
      canvas:document.querySelector('#town-scene canvas')?.getBoundingClientRect().toJSON()}))()`);
    check('WebGL 地标热区点击仍能打开科技页',techTap.page==='tech',
      {...techTap,techPoint});
    await clickNav('home');await sleep(180);
  }
  const hotspot=await evalJs(`(()=>{
    const button=[...document.querySelectorAll('.town-hotspot')].find(el=>/科技|学院/.test(el.textContent));
    if(!button)return {found:false};
    button.click();return {found:true,page:S.page};
  })()`);
  check('地图地标能导航到科技',hotspot.found&&hotspot.page==='tech',hotspot);

  const battle=await evalJs(`(()=>{
    S.formation={front:[{type:'infantry',count:10,id:98765}],mid:[],back:[]};
    S.selEnemy=0;CFG.battleStepDelay=60000;S.battleSpeed=1;
    openBattle();
    return {active:S.battleActive,visible:document.getElementById('battle-screen').classList.contains('active'),
      cards:document.querySelectorAll('#battle-field .unit-box').length};
  })()`);
  await sleep(700);
  const battleView=await evalJs(`(()=>{
    const screen=document.getElementById('battle-screen');
    const state=HD2D.status().battle;
    const rect=id=>{const el=document.getElementById(id);if(!el)return null;const r=el.getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,width:r.width,height:r.height,cssHeight:getComputedStyle(el).height};};
    const canvas=document.querySelector('#battle-scene canvas');
    const cr=canvas?.getBoundingClientRect();
    return {mounted:state.mounted,reason:state.reason,canvas:!!document.querySelector('#battle-scene canvas'),
      fallback:document.querySelectorAll('#battle-field .unit-box').length>0,
      overflow:screen.scrollWidth>screen.clientWidth+1,
      logClosed:!screen.classList.contains('log-open'),
      geometry:{screen:rect('battle-screen'),top:rect('battle-top'),stage:rect('battle-stage'),
        scene:rect('battle-scene'),canvas:cr?{top:cr.top,bottom:cr.bottom,width:cr.width,height:cr.height,
          drawingWidth:canvas.width,drawingHeight:canvas.height}:null}};
  })()`);
  check('战斗视觉层启动且保留 DOM 信息卡',battle.active&&battle.visible&&battle.cards>0&&
    (battleView.mounted?battleView.canvas:battleView.fallback)&&!battleView.overflow&&battleView.logClosed,
    {battle,battleView});
  if(battleView.mounted){
    const sparse=await evalJs(`(()=>{
      const stage=document.getElementById('battle-stage').getBoundingClientRect();
      const units=HD2D.status().battle.layout;
      const centers=units.map(unit=>(unit.badgeRect.top+unit.badgeRect.bottom)/2);
      return {count:units.length,enemies:units.filter(unit=>unit.side==='enemies').length,
        allies:units.filter(unit=>unit.side==='allies').length,
        portraitsReady:units.every(unit=>unit.portraitReady),
        stageHeight:stage.height,top:Math.min(...centers),bottom:Math.max(...centers),
        bloodLineGaps:units.map(unit=>({id:unit.id,
          gap:unit.spriteRect.top+(unit.spriteRect.bottom-unit.spriteRect.top)*
            unit.portraitTopFraction-(unit.badgeRect.top+unit.badgeRect.bottom)/2})),
        facing:units.map(unit=>({side:unit.side,facing:unit.facing})),
        outOfBounds:units.filter(unit=>{const r=unit.badgeRect;
          return r.left<0||r.top<0||r.right>stage.width||r.bottom>stage.height;
        }).map(unit=>unit.id),
        clippedSprites:units.filter(unit=>{const r=unit.spriteRect;
          return r.left<-1||r.top<-1||r.right>stage.width+1||r.bottom>stage.height+1;
        }).map(unit=>({id:unit.id,side:unit.side,rect:unit.spriteRect}))};
    })()`);
    // The reviewed 1v2 screenshot spans about one third of the stage. Keep
    // the upper bound below 35% to catch the old excessive vertical spread.
    check('稀疏 1v2 前后分层且全部角色入镜',sparse.count===3&&
      sparse.enemies===2&&sparse.allies===1&&
      sparse.portraitsReady&&
      sparse.bottom-sparse.top>=sparse.stageHeight*0.23&&
      sparse.bottom-sparse.top<=sparse.stageHeight*0.35&&
      sparse.top>=sparse.stageHeight*0.10&&sparse.bottom<=sparse.stageHeight*0.75&&
      sparse.bloodLineGaps.every(unit=>unit.gap>=-4&&unit.gap<=-2)&&
      sparse.outOfBounds.length===0&&sparse.clippedSprites.length===0&&
      sparse.facing.every(unit=>unit.facing===(unit.side==='enemies'?'right':'left')),sparse);
  }
  for(const width of [320,360,390,430]){
    await setView(width);await sleep(200);
    const hud=await evalJs(`(()=>{
      const enemy=document.querySelector('#battle-hud .battle-hud-side.enemy');
      const ally=document.querySelector('#battle-hud .battle-hud-side.ally');
      const units=battleVisualSnapshot();
      const count=side=>side.reduce((n,unit)=>n+unit.count,0);
      const controls=[...document.querySelectorAll('#battle-speed .btn-speed'),
        document.getElementById('battle-log-toggle'),
        ...document.querySelectorAll('#battle-top button[onclick*="fleeBattle"]')]
        .filter(el=>el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
      const sizes=controls.map(el=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height,left:r.left,right:r.right};});
      const er=enemy?.getBoundingClientRect(),ar=ally?.getBoundingClientRect();
      return {enemyLeft:!!er&&!!ar&&er.right<ar.left,
        enemyData:!!enemy&&enemy.textContent.includes(units.enemies.length+'团')&&
          enemy.textContent.includes(count(units.enemies)+'人'),
        allyData:!!ally&&ally.textContent.includes(units.allies.length+'团')&&
          ally.textContent.includes(count(units.allies)+'人'),
        controls:sizes,reachable:sizes.length===5&&sizes.every(r=>r.w>=48&&r.h>=48&&r.left>=0&&r.right<=innerWidth)};
    })()`);
    check(`${width}px 战场敌左我右与 HUD 数据、触控尺寸一致`,hud.enemyLeft&&hud.enemyData&&hud.allyData&&hud.reachable,hud);
    const bars=await evalJs(`(()=>{
      const elements=[...document.querySelectorAll('#battle-hud .battle-hud-bar')];
      const fills=[...document.querySelectorAll('#battle-hud .battle-hud-bar i')];
      const fallback=document.querySelector('#battle-field .unit-hpbar');
      const fallbackFill=document.querySelector('#battle-field .unit-hpfill');
      const red=el=>{const value=getComputedStyle(el).backgroundColor.match(/\\d+/g)?.slice(0,3).map(Number)||[];
        return value.length===3&&value[0]===137&&
          value[1]===0&&value[2]===18;};
      return {hudHeights:elements.map(el=>el.getBoundingClientRect().height),
        hudRed:fills.every(red),fallbackHeight:fallback?.getBoundingClientRect().height,
        fallbackRed:!!fallbackFill&&red(fallbackFill)};
    })()`);
    check(`${width}px 战斗 HUD 与二维回退均为细红血线`,
      bars.hudHeights.length===2&&bars.hudHeights.every(height=>height<=3.5)&&
      bars.hudRed&&bars.fallbackHeight<=3.5&&bars.fallbackRed,bars);
    if(width===390){
      const darkBattle=await evalJs(`(()=>{
        toggleVisualTheme();
        const bars=[...document.querySelectorAll('#battle-hud .battle-hud-bar')];
        const fills=[...document.querySelectorAll('#battle-hud .battle-hud-bar i')];
        const canvas=document.querySelector('#battle-scene canvas');
        return {theme:VisualTheme.get(),heights:bars.map(el=>el.getBoundingClientRect().height),
          fillColors:fills.map(el=>getComputedStyle(el).backgroundColor),
          trackColors:bars.map(el=>getComputedStyle(el).backgroundColor),
          fallbackArt:getComputedStyle(document.getElementById('battle-stage')).backgroundImage.includes('battle-night.png'),
          canvasClear:!canvas||getComputedStyle(canvas).filter==='none'};
      })()`);
      await sleep(260);
      const nightArtwork=await evalJs("HD2D.status().battle.artworkTheme");
      check('390px 夜间战斗使用夜景，角色保持清晰且血线纤细',
        darkBattle.theme==='dark'&&darkBattle.heights.every(height=>height<=3.5)&&
        darkBattle.fillColors.every(color=>color==='rgb(137, 0, 18)')&&
        darkBattle.trackColors.every(color=>color==='rgb(47, 17, 23)')&&
        darkBattle.fallbackArt&&darkBattle.canvasClear&&
        (!battleView.mounted||nightArtwork==='dark'),{...darkBattle,nightArtwork});
      await shot('390-dark-battle');
      await evalJs('toggleVisualTheme()');
    }
    const spriteBounds=await evalJs(`(()=>{
      const r=document.getElementById('battle-stage').getBoundingClientRect();
      return HD2D.status().battle.layout.map(unit=>({id:unit.id,side:unit.side,facing:unit.facing,
        rect:unit.spriteRect,clipped:unit.spriteRect.left<-1||unit.spriteRect.top<-1||
          unit.spriteRect.right>r.width+1||unit.spriteRect.bottom>r.height+1}));
    })()`);
    if(battleView.mounted)check(`${width}px 稀疏角色投影完整入镜`,
      spriteBounds.length===3&&spriteBounds.every(unit=>!unit.clipped&&
        unit.facing===(unit.side==='enemies'?'right':'left')),spriteBounds);
    await shot(`${width}-battle`);
  }
  for(const height of [568,667]){
    await setView(320,height);await sleep(200);
    const shortView=await evalJs(`(()=>{
      const screen=document.getElementById('battle-screen');
      const stage=document.getElementById('battle-stage').getBoundingClientRect();
      const hud=document.getElementById('battle-hud').getBoundingClientRect();
      return {height:innerHeight,overflow:screen.scrollWidth>screen.clientWidth+1,
        stageHeight:stage.height,stageBottom:stage.bottom,hudTop:hud.top,hudBottom:hud.bottom};
    })()`);
    check(`320×${height} 短屏战场与 HUD 均在视口内`,shortView.height===height&&!shortView.overflow&&
      shortView.stageHeight>=280&&shortView.stageBottom<=shortView.hudTop+1&&shortView.hudBottom<=height+1,shortView);
    const shortSprites=await evalJs(`(()=>{
      const r=document.getElementById('battle-stage').getBoundingClientRect();
      return HD2D.status().battle.layout.map(unit=>({id:unit.id,side:unit.side,
        rect:unit.spriteRect,clipped:unit.spriteRect.left<-1||unit.spriteRect.top<-1||
          unit.spriteRect.right>r.width+1||unit.spriteRect.bottom>r.height+1}));
    })()`);
    if(battleView.mounted)check(`320×${height} 短屏角色投影完整入镜`,
      shortSprites.length===3&&shortSprites.every(unit=>!unit.clipped),shortSprites);
    await shot(`320x${height}-battle`);
  }
  // Medium formations need enough space for large enemy portraits. This fixture
  // deliberately puts six front-row beasts against six different human squads;
  // it stays outside the live B state and tests the renderer's overflow lanes.
  await setView(360,800);
  const mediumMounted=await evalJs(`(()=>{
    const allyTypes=['infantry','bronze_guard','star_trooper',
      'cavalry_iron','alloy_special','iron_spearman'];
    const enemyTypes=['wild_boar','wild_bull','wild_tiger',
      'wild_snake','wild_turtle','wild_wyrm'];
    const make=(type,i,side)=>({type,row:CFG.units[type].row,
      id:(side==='allies'?71000:72000)+i,count:12,hp:120,maxHp:120,
      icon:CFG.units[type].icon});
    HD2D.disposeBattle();
    window.__mediumTypes=new Map([...allyTypes.map((type,i)=>[71000+i,type]),
      ...enemyTypes.map((type,i)=>[72000+i,type])]);
    window.__mediumVisualFixture={epoch:battleEpoch+4500,round:0,speed:1,
      stage:'medium-visual-fixture',
      allies:allyTypes.map((type,i)=>make(type,i,'allies')),
      enemies:enemyTypes.map((type,i)=>make(type,i,'enemies'))};
    const hud=document.getElementById('battle-hud');
    window.__mediumVisualPreviousHud=hud.innerHTML;
    hud.querySelector('.enemy .battle-hud-line span').textContent='6团 · 72人';
    hud.querySelector('.ally .battle-hud-line span').textContent='6团 · 72人';
    return HD2D.mountBattle(document.getElementById('battle-scene'),
      window.__mediumVisualFixture,{});
  })()`);
  for(const [width,height] of [[320,568],[360,800],[390,844],[430,932]]){
    await setView(width,height);await sleep(650);
    const medium=await evalJs(`(async()=>{
      const scene=document.getElementById('battle-scene');
      const units=HD2D.status().battle.layout;
      const types=[...new Set(units.map(unit=>window.__mediumTypes.get(unit.id)))];
      const alpha=new Map(await Promise.all(types.map(async type=>{
        const image=new Image();image.src='./assets/art/units/hires/'+type+'.png';
        await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;
        canvas.height=image.naturalHeight;
        const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
        const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
        for(let y=0;y<canvas.height;y+=2)for(let x=0;x<canvas.width;x+=2){
          if(rgba[(y*canvas.width+x)*4+3]>32){
            left=Math.min(left,x);top=Math.min(top,y);
            right=Math.max(right,x);bottom=Math.max(bottom,y);
          }
        }
        return [type,{left:left/canvas.width,top:top/canvas.height,
          right:(right+2)/canvas.width,bottom:(bottom+2)/canvas.height}];
      })));
      const contentRect=unit=>{
        const box=alpha.get(window.__mediumTypes.get(unit.id)),rect=unit.spriteRect;
        const left=unit.side==='allies'?1-box.right:box.left;
        const right=unit.side==='allies'?1-box.left:box.right;
        return {left:rect.left+(rect.right-rect.left)*left,
          right:rect.left+(rect.right-rect.left)*right,
          top:rect.top+(rect.bottom-rect.top)*box.top,
          bottom:rect.top+(rect.bottom-rect.top)*box.bottom};
      };
      const inside=rect=>Object.values(rect).every(Number.isFinite)&&
        rect.left>=-1&&rect.top>=-1&&rect.right<=scene.clientWidth+1&&
        rect.bottom<=scene.clientHeight+1;
      const gaps=units.map(unit=>({id:unit.id,ready:unit.portraitReady,
        gap:unit.spriteRect.top+(unit.spriteRect.bottom-unit.spriteRect.top)*
          unit.portraitTopFraction-(unit.badgeRect.top+unit.badgeRect.bottom)/2}));
      const clipped=units.filter(unit=>!inside(unit.badgeRect)||
        !inside(contentRect(unit))).map(unit=>({id:unit.id,type:window.__mediumTypes.get(unit.id),
          badge:unit.badgeRect,content:contentRect(unit)}));
      const overlaps=[];
      for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
        const a=contentRect(units[i]),b=contentRect(units[j]);
        const area=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*
          Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
        const smaller=Math.min((a.right-a.left)*(a.bottom-a.top),
          (b.right-b.left)*(b.bottom-b.top));
        if(area>0&&smaller>0)overlaps.push({ids:[units[i].id,units[j].id],
          types:[window.__mediumTypes.get(units[i].id),window.__mediumTypes.get(units[j].id)],
          sameSide:units[i].side===units[j].side,ratio:+(area/smaller).toFixed(3)});
      }
      overlaps.sort((a,b)=>b.ratio-a.ratio);
      return {count:units.length,sceneWidth:scene.clientWidth,sceneHeight:scene.clientHeight,
        uniqueSlots:new Set(units.map(unit=>unit.side+':'+unit.slotRow+':'+unit.slotColumn)).size,
        gaps,clipped,maxSameSideOverlap:overlaps.find(item=>item.sameSide)?.ratio||0,
        maxOpposingOverlap:overlaps.find(item=>!item.sameSide)?.ratio||0,
        worstOverlaps:overlaps.slice(0,6)};
    })()`);
    check(`${width}px 六对六宽体混编立绘可见且血线贴近头顶`,
      mediumMounted&&medium.count===12&&medium.uniqueSlots===12&&
      medium.clipped.length===0&&medium.gaps.every(unit=>unit.ready&&
        unit.gap>=-4&&unit.gap<=-2)&&medium.maxSameSideOverlap<=0.15&&
      medium.maxOpposingOverlap<=0.15,medium);
    await shot(`${width}-battle-medium-6v6`);
  }
  const mediumAfterLoss=await evalJs(`(()=>{
    const before=HD2D.status().battle.layout;
    const fixture=window.__mediumVisualFixture;
    const kept=fixture.allies.slice(1).concat(fixture.enemies.slice(1));
    const original=new Map(before.map(unit=>[unit.side+':'+unit.id,unit]));
    const updated=HD2D.updateBattle({...fixture,round:1,
      allies:fixture.allies.slice(1),enemies:fixture.enemies.slice(1)});
    const after=HD2D.status().battle.layout;
    const moved=after.filter(unit=>{
      const prior=original.get(unit.side+':'+unit.id);
      return !prior||unit.slotRow!==prior.slotRow||
        unit.slotColumn!==prior.slotColumn||unit.x!==prior.x||unit.z!==prior.z;
    }).map(unit=>unit.id);
    return {updated,remaining:after.length,moved,
      kept:kept.map(unit=>unit.id),actual:after.map(unit=>unit.id)};
  })()`);
  check('六对六减员后剩余十团保留原视觉槽位',mediumAfterLoss.updated&&
    mediumAfterLoss.remaining===10&&mediumAfterLoss.moved.length===0&&
    mediumAfterLoss.kept.every(id=>mediumAfterLoss.actual.includes(id)),mediumAfterLoss);
  await evalJs(`(()=>{
    document.getElementById('battle-hud').innerHTML=window.__mediumVisualPreviousHud;
    delete window.__mediumVisualPreviousHud;
  })()`);
  // Use the real 12-squad stage-29 enemy roster and a legal 4/4/4 ally formation.
  // This exercises presentation only; the live B state and battle timer are untouched.
  const fullStart=await evalJs(`(()=>{
    const allyTypes=[
      'infantry','spearman','cavalry','infantry_shield',
      'archer','mage','archer_crossbow','spearman',
      'mage','archer','infantry','cavalry'
    ];
    const rows=['front','mid','back'];
    const make=(type,row,id,count)=>({type,row,id,count,hp:100,maxHp:100,
      icon:CFG.units[type]?.icon||type});
    const allies=allyTypes.map((type,i)=>make(type,rows[Math.floor(i/4)],10000+i,20+i));
    let enemyId=20000;
    const enemies=Object.entries(CFG.enemies[28].units).flatMap(([type,counts])=>
      counts.map(count=>make(type,CFG.units[type].row,enemyId++,count)));
    window.__fullVisualFixture={epoch:battleEpoch+5000,round:0,speed:1,stage:'campaign',allies,enemies};
    const hud=document.getElementById('battle-hud');
    window.__fullVisualPreviousHud=hud.innerHTML;
    hud.querySelector('.enemy .battle-hud-line span').textContent=
      enemies.length+'团 · '+enemies.reduce((n,u)=>n+u.count,0)+'人';
    hud.querySelector('.ally .battle-hud-line span').textContent=
      allies.length+'团 · '+allies.reduce((n,u)=>n+u.count,0)+'人';
    HD2D.disposeBattle();
    const mounted=HD2D.mountBattle(document.getElementById('battle-scene'),window.__fullVisualFixture,{});
    document.getElementById('battle-screen').classList.toggle('hd2d-active',mounted);
    return {mounted,allies:allies.length,enemies:enemies.length};
  })()`);
  check('真实满编样本为双方各12团且场景可启动',fullStart.mounted&&
    fullStart.allies===12&&fullStart.enemies===12,fullStart);
  for(const [width,height] of [[320,568],[360,800],[390,844],[430,932]]){
    await setView(width,height);await sleep(500);
    const fullView=await evalJs(`(()=>{
      const stage=document.getElementById('battle-stage').getBoundingClientRect();
      const scene=document.getElementById('battle-scene');
      const status=HD2D.status().battle;
      return {mounted:status.mounted,overflow:document.getElementById('battle-screen').scrollWidth>innerWidth+1,
        stageBottom:stage.bottom,stageHeight:stage.height,artworkReady:status.artworkReady,
        sceneWidth:scene.clientWidth,sceneHeight:scene.clientHeight,
        visibleUnits:status.visibleUnits,hiddenUnits:status.hiddenUnits,layout:status.layout};
    })()`);
    check(`${width}×${height} 满编战场可见且不横向溢出`,fullView.mounted&&
      !fullView.overflow&&fullView.stageHeight>280&&fullView.stageBottom<=height,fullView);
    const units=fullView.layout;
    const compactActions=units.filter(unit=>unit.side==='allies'&&
      ['infantry','archer','archer_crossbow'].includes(unit.type));
    check(`${width}×${height} 满编高清动作使用 256px 单帧贴图`,
      compactActions.length>=3&&compactActions.every(unit=>
        unit.portraitActionsReady&&unit.portraitActionCellPx===256),
      compactActions.map(unit=>({id:unit.id,ready:unit.portraitActionsReady,
        cellPx:unit.portraitActionCellPx})));
    const slotKeys=units.map(unit=>`${unit.side}:${unit.slotRow}:${unit.slotColumn}`);
    check(`${width}×${height} 双方24团各占独立槽位`,units.length===24&&
      fullView.visibleUnits.allies===12&&fullView.visibleUnits.enemies===12&&
      fullView.hiddenUnits.allies===0&&fullView.hiddenUnits.enemies===0&&
      new Set(slotKeys).size===24&&
      ['allies','enemies'].every(side=>['front','mid','back'].every(row=>
        units.filter(unit=>unit.side===side&&unit.slotRow===row).length===4)),
      {visibleUnits:fullView.visibleUnits,hiddenUnits:fullView.hiddenUnits,slotKeys});
    const badgeGaps=units.map(unit=>({id:unit.id,ready:unit.portraitReady,
      gap:unit.spriteRect.top+(unit.spriteRect.bottom-unit.spriteRect.top)*
        unit.portraitTopFraction-(unit.badgeRect.top+unit.badgeRect.bottom)/2}));
    check(`${width}×${height} 满编血线贴近立绘可见顶部`,
      badgeGaps.length===24&&badgeGaps.every(unit=>unit.ready&&
        unit.gap>=-3&&unit.gap<=-1),badgeGaps);
    const outOfBounds=units.filter(unit=>{
      const r=unit.badgeRect;
      return !Object.values(r).every(Number.isFinite)||r.left<0||r.top<0||
        r.right>fullView.sceneWidth||r.bottom>fullView.sceneHeight;
    }).map(unit=>({id:unit.id,side:unit.side,rect:unit.badgeRect}));
    const overlaps=[];
    for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
      const a=units[i].badgeRect,b=units[j].badgeRect;
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>0.5&&
        Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>0.5){
        overlaps.push([units[i].id,units[j].id]);
      }
    }
    check(`${width}×${height} 人数徽标均在战场内且互不遮挡`,
      outOfBounds.length===0&&overlaps.length===0,
      {sceneWidth:fullView.sceneWidth,sceneHeight:fullView.sceneHeight,outOfBounds,overlaps});
    await shot(`${width}x${height}-battle-full-12v12`);
    if(width===320||width===390){
      await evalJs('toggleVisualTheme()');
      let artwork='';
      for(let attempt=0;attempt<10;attempt++){
        await sleep(100);
        artwork=await evalJs('HD2D.status().battle.artworkTheme');
        if(artwork==='dark')break;
      }
      check(`${width}px 满编夜战背景切换完成`,artwork==='dark',{artwork});
      await shot(`${width}x${height}-dark-battle-full-12v12`);
      await evalJs('toggleVisualTheme()');
    }
  }
  await setView(320,568);await sleep(200);
  const afterLoss=await evalJs(`(()=>{
    const before=HD2D.status().battle.layout;
    const fixture=window.__fullVisualFixture;
    const removedIds=[fixture.allies[0].id,fixture.enemies[0].id];
    const updated=HD2D.updateBattle({...fixture,
      allies:fixture.allies.slice(1),enemies:fixture.enemies.slice(1)});
    const state=HD2D.status().battle;
    const original=new Map(before.map(unit=>[unit.side+':'+unit.id,unit]));
    const shifted=state.layout.filter(unit=>{
      const previous=original.get(unit.side+':'+unit.id);
      return !previous||previous.slotRow!==unit.slotRow||
        previous.slotColumn!==unit.slotColumn||previous.x!==unit.x||previous.z!==unit.z||
        Math.abs(previous.badgeRect.left-unit.badgeRect.left)>0.5||
        Math.abs(previous.badgeRect.top-unit.badgeRect.top)>0.5;
    }).map(unit=>({id:unit.id,side:unit.side,slotRow:unit.slotRow,slotColumn:unit.slotColumn}));
    return {updated,visibleUnits:state.visibleUnits,hiddenUnits:state.hiddenUnits,
      removedIds,remainingIds:state.layout.map(unit=>unit.id),shifted};
  })()`);
  check('满编双方各减一团后其余22团保持原槽位与画面坐标',afterLoss.updated&&
    afterLoss.visibleUnits.allies===11&&afterLoss.visibleUnits.enemies===11&&
    afterLoss.hiddenUnits.allies===0&&afterLoss.hiddenUnits.enemies===0&&
    afterLoss.removedIds.every(id=>!afterLoss.remainingIds.includes(id))&&
    afterLoss.shifted.length===0,afterLoss);
  await shot('320x568-battle-full-after-loss');
  // Wide mounts, weapons and beasts reveal collisions hidden by narrow base infantry.
  // This is a renderer-only 4/4/4 fixture; it never enters the live battle state.
  const wideStart=await evalJs(`(()=>{
    const allyTypes=['cavalry_iron','cavalry_dragon','alloy_special','infantry_bloodrose',
      'archer_t1','archer_assassin','mage_space','gold_cavalry',
      'cavalry_wind','cavalry_teutonic','bronze_guard','iron_spearman'];
    const enemyTypes=['wild_bull','wild_boar','wild_wyrm','guardian_god',
      'wild_tiger','wild_turtle','cavalry_iron','cavalry_dragon',
      'alloy_special','slaughter_god','phantom_god','god_crystal_guard'];
    const valid=[...allyTypes,...enemyTypes].every(type=>!!CFG.units[type]);
    const rows=['front','mid','back'];
    const make=(type,i,base)=>({type,row:rows[Math.floor(i/4)],id:base+i,
      count:12,hp:120,maxHp:120,icon:CFG.units[type]?.icon||type});
    const allies=allyTypes.map((type,i)=>make(type,i,34000));
    const enemies=enemyTypes.map((type,i)=>make(type,i,35000));
    HD2D.disposeBattle();
    const mounted=HD2D.mountBattle(document.getElementById('battle-scene'),
      {epoch:battleEpoch+6000,round:0,speed:1,stage:'wide-visual-check',allies,enemies},{});
    window.__wideVisualTypes=new Map([...allies,...enemies].map(unit=>[unit.id,unit.type]));
    return {valid,mounted,allyTypes,enemyTypes};
  })()`);
  check('宽体混编视觉样本的24个单位 ID 均在当前 CFG 中',
    wideStart.valid&&wideStart.mounted,wideStart);
  for(const [width,height] of [[320,568],[390,844]]){
    await setView(width,height);await sleep(650);
    const wideView=await evalJs(`(async()=>{
      const stage=document.getElementById('battle-scene');
      const layout=HD2D.status().battle.layout;
      const slots=layout.map(unit=>unit.side+':'+unit.slotRow+':'+unit.slotColumn);
      const inside=(rect)=>Object.values(rect).every(Number.isFinite)&&
        rect.left>=-1&&rect.top>=-1&&rect.right<=stage.clientWidth+1&&
        rect.bottom<=stage.clientHeight+1;
      const badgeClipped=layout.filter(unit=>!inside(unit.badgeRect)).map(unit=>unit.id);
      const spriteClipped=layout.filter(unit=>!inside(unit.spriteRect)).map(unit=>unit.id);
      const badgeOverlap=[];
      for(let i=0;i<layout.length;i++)for(let j=i+1;j<layout.length;j++){
        const a=layout[i].badgeRect,b=layout[j].badgeRect;
        if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>0.5&&
          Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>0.5)
          badgeOverlap.push([layout[i].id,layout[j].id]);
      }
      const types=[...new Set(layout.map(unit=>window.__wideVisualTypes.get(unit.id)))];
      const alpha=new Map(await Promise.all(types.map(async type=>{
        const image=new Image();image.src='./assets/art/units/hires/'+type+'.png';
        await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;
        canvas.height=image.naturalHeight;
        const context=canvas.getContext('2d');context.drawImage(image,0,0);
        const rgba=context.getImageData(0,0,canvas.width,canvas.height).data;
        let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
        for(let y=0;y<canvas.height;y+=2)for(let x=0;x<canvas.width;x+=2){
          if(rgba[(y*canvas.width+x)*4+3]>32){
            left=Math.min(left,x);top=Math.min(top,y);
            right=Math.max(right,x);bottom=Math.max(bottom,y);
          }
        }
        return [type,{left:left/canvas.width,top:top/canvas.height,
          right:(right+2)/canvas.width,bottom:(bottom+2)/canvas.height}];
      })));
      const contentRect=unit=>{
        const box=alpha.get(window.__wideVisualTypes.get(unit.id)),rect=unit.spriteRect;
        const flip=unit.side==='allies';
        const left=flip?1-box.right:box.left,right=flip?1-box.left:box.right;
        return {left:rect.left+(rect.right-rect.left)*left,
          right:rect.left+(rect.right-rect.left)*right,
          top:rect.top+(rect.bottom-rect.top)*box.top,
          bottom:rect.top+(rect.bottom-rect.top)*box.bottom};
      };
      const alphaOverlaps=[];
      for(let i=0;i<layout.length;i++)for(let j=i+1;j<layout.length;j++){
        if(layout[i].side!==layout[j].side||layout[i].slotRow!==layout[j].slotRow)continue;
        const a=contentRect(layout[i]),b=contentRect(layout[j]);
        const area=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*
          Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
        const smaller=Math.min((a.right-a.left)*(a.bottom-a.top),
          (b.right-b.left)*(b.bottom-b.top));
        const ratio=smaller>0?area/smaller:0;
        if(ratio>0)alphaOverlaps.push({ids:[layout[i].id,layout[j].id],
          types:[window.__wideVisualTypes.get(layout[i].id),
            window.__wideVisualTypes.get(layout[j].id)],ratio:+ratio.toFixed(3)});
      }
      alphaOverlaps.sort((a,b)=>b.ratio-a.ratio);
      return {width:stage.clientWidth,height:stage.clientHeight,
        mounted:HD2D.status().battle.mounted,
        visible:HD2D.status().battle.visibleUnits,
        hidden:HD2D.status().battle.hiddenUnits,
        count:layout.length,uniqueSlots:new Set(slots).size,
        badgeClipped,spriteClipped,badgeOverlap,
        maxSameRowAlphaOverlap:alphaOverlaps[0]?.ratio||0,
        worstAlphaOverlaps:alphaOverlaps.slice(0,6)};
    })()`);
    check(`${width}×${height} 宽体混编24槽、徽标和角色投影均完整`,
      wideStart.mounted&&wideView.mounted&&wideView.count===24&&
      wideView.visible.allies===12&&wideView.visible.enemies===12&&
      wideView.hidden.allies===0&&wideView.hidden.enemies===0&&
      wideView.uniqueSlots===24&&wideView.badgeClipped.length===0&&
      wideView.spriteClipped.length===0&&wideView.badgeOverlap.length===0,wideView);
    check(`${width}×${height} 宽体混编同行 alpha 内容遮挡不超过30%`,
      wideView.maxSameRowAlphaOverlap<=0.30,
      {max:wideView.maxSameRowAlphaOverlap,worst:wideView.worstAlphaOverlaps});
    await shot(`${width}x${height}-battle-wide-12v12`);
  }
  const unitVfxProfiles=await evalJs(`(()=>{
    const ids=Object.keys(CFG.units),fields=['style','accent','halo','trail','impact','impactShape','rank'];
    const profiles=window.UNIT_VFX_PROFILES||{};
    const invalid=ids.filter(id=>{
      const profile=profiles[id];
      return !profile||fields.some(field=>!Object.hasOwn(profile,field))||
        !['style','trail','impact','impactShape'].every(field=>
          typeof profile[field]==='string'&&profile[field].length>0)||
        !['accent','halo'].every(field=>
          typeof profile[field]==='number'||typeof profile[field]==='string')||
        !Number.isInteger(profile.rank)||profile.rank<1||profile.rank>5;
    });
    const signatures=ids.map(id=>JSON.stringify(fields.map(field=>profiles[id]?.[field])));
    const chains=[
      ['infantry','infantry_t1','infantry_shield','infantry_fortress'],
      ['archer','archer_t1','archer_crossbow','archer_genoese'],
      ['cavalry_t1','cavalry_wind','cavalry_dragon'],
      ['mage_t1','mage_time','mage_chrono']
    ].map(ids=>({ids,ranks:ids.map(id=>profiles[id]?.rank)}));
    const era=['bronze_guard','iron_spearman','silver_heavy','gold_cavalry',
      'alloy_special','armored_trooper','electro_trooper','star_trooper'];
    return {count:ids.length,invalid,unique:new Set(signatures).size,
      chains,era:era.map(id=>({id,rank:profiles[id]?.rank})),
      beastStyles:['wild_boar','wild_bull','wild_snake','wild_tiger','wild_turtle','wild_wyrm']
        .map(id=>({id,style:profiles[id]?.style}))};
  })()`);
  const expectedUnitCount=await evalJs('Object.keys(CFG.units).length');
  check(`全部${expectedUnitCount}个兵种含七字段专属攻击特效配置`,
    unitVfxProfiles.count===expectedUnitCount&&unitVfxProfiles.invalid.length===0&&
    unitVfxProfiles.unique===expectedUnitCount,
    {count:unitVfxProfiles.count,invalid:unitVfxProfiles.invalid,unique:unitVfxProfiles.unique});
  check('科技四条兵种线的攻击特效等级随升级递进',
    unitVfxProfiles.chains.every(chain=>chain.ranks.every((rank,index)=>
      Number.isInteger(rank)&&(index===0||rank>chain.ranks[index-1]))),
    unitVfxProfiles.chains);
  check('青铜到星际兵种特效等级不倒退且首尾有升级',
    unitVfxProfiles.era.every((entry,index,list)=>
      Number.isInteger(entry.rank)&&(index===0||entry.rank>=list[index-1].rank))&&
    unitVfxProfiles.era.at(-1).rank>unitVfxProfiles.era[0].rank,
    unitVfxProfiles.era);
  check('六种野兽使用兽系攻击轮廓',
    unitVfxProfiles.beastStyles.every(item=>item.style==='beastbite'),
    unitVfxProfiles.beastStyles);
  const uniqueVfxPixels=await evalJs(`(async()=>{
    const ids=Object.keys(CFG.units),images=await Promise.all(ids.map(async id=>{
      const image=new Image();image.src='./assets/art/vfx/units/'+id+'.png';
      try{await image.decode();return {id,image};}catch(_){return {id,image:null};}
    }));
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
    const signatures=[];
    for(const {id,image} of images){
      if(!image){signatures.push({id,decoded:false});continue;}
      canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      context.clearRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,0,0);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
      let opaque=0;
      for(let index=3;index<pixels.length;index+=4)if(pixels[index]>32)opaque++;
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',pixels));
      const sha=[...digest].map(byte=>byte.toString(16).padStart(2,'0')).join('');
      signatures.push({id,decoded:true,width:canvas.width,height:canvas.height,opaque,sha});
    }
    const duplicates=signatures.filter((entry,index)=>entry.sha&&
      signatures.findIndex(other=>other.sha===entry.sha)!==index).map(entry=>entry.id);
    return {count:signatures.length,decoded:signatures.filter(entry=>entry.decoded).length,
      unique:new Set(signatures.map(entry=>entry.sha).filter(Boolean)).size,duplicates,
      tooSparse:signatures.filter(entry=>entry.decoded&&entry.opaque<400).map(entry=>
        ({id:entry.id,opaque:entry.opaque,width:entry.width,height:entry.height}))};
  })()`);
  check(`${expectedUnitCount}张专属攻击PNG均能解码、非空且实际像素内容不重复`,
    uniqueVfxPixels.count===expectedUnitCount&&uniqueVfxPixels.decoded===expectedUnitCount&&
    uniqueVfxPixels.unique===expectedUnitCount&&uniqueVfxPixels.duplicates.length===0&&
    uniqueVfxPixels.tooSparse.length===0,uniqueVfxPixels);
  const enemyPortraits=await evalJs(`(()=>{
    const ids=Object.entries(CFG.units).filter(([,unit])=>unit.enemyOnly).map(([id])=>id);
    const make=(type,row,id)=>({type,row,id,count:10,hp:100,maxHp:100,icon:CFG.units[type].icon});
    const allies=[make('infantry','front',31000)];
    const requested=[];
    const original=THREE.TextureLoader.prototype.load;
    THREE.TextureLoader.prototype.load=function(url,...args){requested.push(url);return original.call(this,url,...args);};
    let mounted=true,visible=0,hidden=0;
    const fallback=[],effects=[];
    try{
      for(let offset=0;offset<ids.length;offset+=12){
        const group=ids.slice(offset,offset+12);
        const enemies=group.map((type,i)=>make(type,
          ['front','mid','back'][Math.floor(i/4)],30000+offset+i));
        HD2D.disposeBattle();
        const epoch=battleEpoch+5001+offset;
        mounted=HD2D.mountBattle(document.getElementById('battle-scene'),
          {epoch,round:0,speed:1,stage:'visual-check',allies,enemies},{})&&mounted;
        visible+=HD2D.status().battle.visibleUnits.enemies;
        hidden+=HD2D.status().battle.hiddenUnits.enemies;
        for(let i=0;i<group.length;i++){
          const id=group[i];
          if(renderBattleUnit(enemies[i],'enemy').includes('/assets/art/units/hires/'+id+'.png'))
            fallback.push(id);
          const played=HD2D.playBattle({epoch,type:'attack',sourceId:enemies[i].id,
            targetId:31000,sourceSide:'enemies',targetSide:'allies',durationMs:1200});
          effects.push({id,played,style:HD2D.status().battle.effectStyles.at(-1)});
        }
      }
    }finally{THREE.TextureLoader.prototype.load=original;}
    const loaded=ids.filter(id=>requested.some(url=>url.endsWith('/assets/art/units/hires/'+id+'.png')));
    return {ids,mounted,visible,hidden,loaded,fallback,effects};
  })()`);
  check('全部敌方专属角色均使用独立高清立绘，三维与二维映射一致',
    enemyPortraits.ids.length>0&&enemyPortraits.mounted&&
    enemyPortraits.visible===enemyPortraits.ids.length&&enemyPortraits.hidden===0&&
    enemyPortraits.loaded.length===enemyPortraits.ids.length&&
    enemyPortraits.fallback.length===enemyPortraits.ids.length,enemyPortraits);
  const expectedEnemyEffects={god_crystal_guard:'magebolt',phantom_god:'magebolt',
    soul_wraith:'swordqi',
    guardian_god:'thrust',slaughter_god:'swordqi',revival_god:'magebolt',
    silence_god:'magebolt',trial_guard_easy:'thrust',
    trial_guard_perfect:'magebolt',trial_guard_extreme:'swordqi',
    wild_boar:'beastbite',wild_bull:'beastbite',
    wild_snake:'beastbite',wild_tiger:'beastbite',wild_turtle:'beastbite',wild_wyrm:'beastbite'};
  check('全部敌方专属角色攻击特效符合各自兵种轮廓',
    enemyPortraits.effects.length===enemyPortraits.ids.length&&
    enemyPortraits.effects.every(item=>item.played&&item.style===expectedEnemyEffects[item.id]),
    enemyPortraits.effects);
  const decodedEnemyPortraits=await evalJs(`Promise.all(
    Object.entries(CFG.units).filter(([,unit])=>unit.enemyOnly).map(([id])=>id).map(id=>
      new Promise(resolve=>{const image=new Image();image.onload=()=>resolve({id,width:image.naturalWidth,height:image.naturalHeight});
        image.onerror=()=>resolve({id,width:0,height:0});image.src='./assets/art/units/hires/'+id+'.png';}))
  )`);
  check('全部敌方专属高清立绘在浏览器中解码',
    decodedEnemyPortraits.length===enemyPortraits.ids.length&&
    decodedEnemyPortraits.every(item=>item.width===512&&item.height===512),decodedEnemyPortraits);
  const beastSparseStart=await evalJs(`(()=>{
    HD2D.disposeBattle();
    const make=(type,row,id)=>({type,row,id,count:10,hp:100,maxHp:100,icon:CFG.units[type].icon});
    return HD2D.mountBattle(document.getElementById('battle-scene'),
      {epoch:battleEpoch+5002,round:0,speed:1,stage:'visual-check',
        allies:[make('infantry','front',33000)],
        enemies:[make('wild_boar','front',33001),make('wild_snake','back',33002)]},{});
  })()`);
  await setView(390,844);await sleep(650);
  const beastSparse=await evalJs(`(async()=>{
    const scene=document.getElementById('battle-scene');
    const layout=HD2D.status().battle.layout;
    const ally=layout.find(unit=>unit.id===33000),boar=layout.find(unit=>unit.id===33001),
      snake=layout.find(unit=>unit.id===33002);
    const inside=layout.every(unit=>unit.spriteRect.left>=-1&&unit.spriteRect.top>=-1&&
      unit.spriteRect.right<=scene.clientWidth+1&&unit.spriteRect.bottom<=scene.clientHeight+1);
    async function visibleHorizontalSpan(type,mirrored){
      const image=new Image();image.src='./assets/art/units/hires/'+type+'.png';await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);
      const rgba=context.getImageData(0,0,canvas.width,canvas.height).data;
      let left=canvas.width,right=-1;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
        if(rgba[(y*canvas.width+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x);}
      }
      return mirrored?{left:(canvas.width-1-right)/canvas.width,right:(canvas.width-left)/canvas.width}:
        {left:left/canvas.width,right:(right+1)/canvas.width};
    }
    const [allySpan,boarSpan]=await Promise.all([
      visibleHorizontalSpan('infantry',true),visibleHorizontalSpan('wild_boar',false)]);
    const contentRect=(rect,span)=>({left:rect.left+(rect.right-rect.left)*span.left,
      right:rect.left+(rect.right-rect.left)*span.right});
    const allyContent=contentRect(ally.spriteRect,allySpan),boarContent=contentRect(boar.spriteRect,boarSpan);
    const overlap=Math.max(0,Math.min(allyContent.right,boarContent.right)-
      Math.max(allyContent.left,boarContent.left));
    return {count:layout.length,inside,overlap,
      enemyFollowers:[boar.followersVisible,snake.followersVisible],
      allowance:Math.min(allyContent.right-allyContent.left,
        boarContent.right-boarContent.left)*0.10,
      boarWidth:boar.spriteRect.right-boar.spriteRect.left,
      fronts:{ally:allyContent,boar:boarContent},
      snake:snake?.spriteRect};
  })()`);
  check('390×844 野兽稀疏战斗保持角色入镜且野猪不挤压我方',
    beastSparseStart&&beastSparse.count===3&&beastSparse.inside&&
    beastSparse.enemyFollowers.every(count=>count===0)&&
    beastSparse.overlap<=beastSparse.allowance,beastSparse);
  await shot('390x844-battle-enemy-beasts-sparse');
  const beastAttackStarted=await evalJs(`HD2D.playBattle({epoch:battleEpoch+5002,type:'attack',
    sourceId:33001,targetId:33000,sourceSide:'enemies',targetSide:'allies',durationMs:900})`);
  await sleep(300);
  const beastAttackWidth=await evalJs(`(()=>{const boar=HD2D.status().battle.layout.find(unit=>unit.id===33001);
    return boar.spriteRect.right-boar.spriteRect.left;})()`);
  check('野兽攻击动作沿用稀疏场景尺寸，不瞬间放大',beastAttackStarted&&
    beastAttackWidth<=beastSparse.boarWidth*1.13,
    {idle:beastSparse.boarWidth,attack:beastAttackWidth});
  await shot('390x844-battle-enemy-beasts-attack');
  const beastFullStart=await evalJs(`(()=>{
    const ids=Object.entries(CFG.units).filter(([,unit])=>unit.enemyOnly).map(([id])=>id);
    const types=[...ids,ids[0]].slice(0,12);
    const enemies=types.map((type,i)=>({type,row:['front','mid','back'][Math.floor(i/4)],
      id:32000+i,count:12,hp:120,maxHp:120,icon:CFG.units[type].icon}));
    HD2D.disposeBattle();
    return HD2D.mountBattle(document.getElementById('battle-scene'),
      {epoch:battleEpoch+5003,round:0,speed:1,stage:'visual-check',
        allies:window.__fullVisualFixture.allies,enemies},{});
  })()`);
  await setView(390,844);await sleep(700);
  const beastFull=await evalJs(`(()=>{
    const scene=document.getElementById('battle-scene');
    const state=HD2D.status().battle;
    const badges=state.layout.map(unit=>unit.badgeRect);
    const clipped=state.layout.filter(unit=>unit.badgeRect.left<0||unit.badgeRect.top<0||
      unit.badgeRect.right>scene.clientWidth||unit.badgeRect.bottom>scene.clientHeight)
      .map(unit=>unit.id);
    const overlaps=[];
    for(let i=0;i<badges.length;i++)for(let j=i+1;j<badges.length;j++){
      const a=badges[i],b=badges[j];
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>0.5&&
        Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>0.5)overlaps.push([i,j]);
    }
    return {visible:state.visibleUnits,hidden:state.hiddenUnits,clipped,overlaps,
      spriteClipped:state.layout.filter(unit=>unit.spriteRect.left<-1||unit.spriteRect.top<-1||
        unit.spriteRect.right>scene.clientWidth+1||unit.spriteRect.bottom>scene.clientHeight+1)
        .map(unit=>unit.id)};
  })()`);
  check('390×844 敌方野兽与机兵混编满编战场无隐藏、越界或徽标重叠',
    beastFullStart&&beastFull.visible.allies===12&&beastFull.visible.enemies===12&&
    beastFull.hidden.allies===0&&beastFull.hidden.enemies===0&&
    beastFull.clipped.length===0&&beastFull.overlaps.length===0&&beastFull.spriteClipped.length===0,
    beastFull);
  await shot('390x844-battle-enemy-only-full-12v12');
  const renderedUnitVfx=[];
  const vfxMounts=[];
  for(let offset=0;offset<unitVfxProfiles.count;offset+=12){
    const batch=await evalJs(`(async()=>{
      const ids=Object.keys(CFG.units).slice(${offset},${offset}+12);
      const epoch=battleEpoch+5400+${offset};
      const allies=ids.map((type,index)=>({type,row:['front','mid','back'][Math.floor(index/4)],
        id:42000+${offset}+index,count:12,hp:120,maxHp:120,icon:CFG.units[type].icon}));
      const target={type:'infantry',row:'front',id:59000+${offset},count:12,hp:120,maxHp:120,
        icon:CFG.units.infantry.icon};
      HD2D.disposeBattle();
      const mounted=HD2D.mountBattle(document.getElementById('battle-scene'),
        {epoch,round:0,speed:1,stage:'vfx-check',allies,enemies:[target]},{});
      const accepted=[],seen=new Map();
      for(const unit of allies){
        // The first event may finish while its texture uploads on a busy GPU.
        // Replay once after warmup and still require a live, decoded effect.
        for(let replay=0;replay<2&&!seen.has(unit.type);replay++){
          const played=HD2D.playBattle({epoch,type:'attack',sourceId:unit.id,
            targetId:target.id,sourceSide:'allies',targetSide:'enemies',durationMs:1200});
          if(replay===0)accepted.push(played);
          for(let attempt=0;attempt<24&&!seen.has(unit.type);attempt++){
            await new Promise(resolve=>setTimeout(resolve,30));
            const effect=(HD2D.status().battle.effectDetails||[]).find(item=>
              item.type==='attack'&&item.unitType===unit.type&&item.visible&&item.assetReady);
            if(effect)seen.set(unit.type,effect);
          }
        }
      }
      const finalEffects=HD2D.status().battle.effectDetails||[];
      return {mounted,accepted,ids,hidden:document.hidden,
        missingDetails:ids.filter(id=>!seen.has(id)).map(id=>({id,
          effect:finalEffects.find(effect=>effect.unitType===id)||null})),
        seen:ids.map(id=>({id,
        profileStyle:window.UNIT_VFX_PROFILES?.[id]?.style,
        profileRank:window.UNIT_VFX_PROFILES?.[id]?.rank,...seen.get(id)}))};
    })()`);
    vfxMounts.push({offset,mounted:batch.mounted,accepted:batch.accepted,
      hidden:batch.hidden,missing:batch.missingDetails});
    renderedUnitVfx.push(...batch.seen);
  }
  check(`${expectedUnitCount}个兵种在真实WebGL场景中都有可见、可解码的专属攻击贴图`,
    vfxMounts.length===Math.ceil(expectedUnitCount/12)&&vfxMounts.every(batch=>
      batch.mounted&&batch.accepted.every(Boolean)&&batch.missing.length===0)&&
    renderedUnitVfx.length===expectedUnitCount&&renderedUnitVfx.every(effect=>
      effect.type==='attack'&&effect.unitType===effect.id&&effect.visible&&effect.assetReady&&
      typeof effect.mainAsset==='string'&&
      effect.mainAsset.endsWith('/'+effect.id+'.png')&&
      effect.style===effect.profileStyle&&effect.rank===effect.profileRank),
    {mounts:vfxMounts,missing:renderedUnitVfx.filter(effect=>!effect.assetReady||
      !effect.visible||!effect.mainAsset?.endsWith('/'+effect.id+'.png'))});
  const vfxOrnaments=Array.from({length:5},(_,index)=>{
    const rank=index+1,counts=renderedUnitVfx.filter(effect=>effect.rank===rank)
      .map(effect=>effect.ornaments);
    return {rank,count:counts.length,min:Math.min(...counts),max:Math.max(...counts),
      average:counts.reduce((total,value)=>total+value,0)/counts.length};
  });
  check('低级到高级攻击特效的真实装饰层数递增',
    vfxOrnaments.every((entry,index)=>entry.count>0&&Number.isFinite(entry.average)&&
      (index===0||entry.average>vfxOrnaments[index-1].average)),vfxOrnaments);
  const eventProbe=await evalJs(`(async()=>{
    const epoch=battleEpoch+5500;
    const source={type:'mage_time',row:'back',id:61001,count:10,hp:100,maxHp:100,
      icon:CFG.units.mage_time.icon};
    const target={type:'wild_boar',row:'front',id:61002,count:10,hp:100,maxHp:100,
      icon:CFG.units.wild_boar.icon};
    HD2D.disposeBattle();
    const mounted=HD2D.mountBattle(document.getElementById('battle-scene'),
      {epoch,round:0,speed:1,stage:'vfx-check',allies:[source],enemies:[target]},{});
    const fire=()=>({
      attack:HD2D.playBattle({epoch,type:'attack',sourceId:source.id,targetId:target.id,
        sourceSide:'allies',targetSide:'enemies',durationMs:1200}),
      hit:HD2D.playBattle({epoch,type:'hit',sourceId:source.id,targetId:target.id,
        sourceSide:'allies',targetSide:'enemies',durationMs:1200})
    });
    let before,played={attack:false,hit:false};
    // A freshly mounted WebGL scene uploads both textures asynchronously.
    // Replay after that warmup if a busy renderer consumed the first window.
    for(let replay=0;replay<3;replay++){
      const current=fire();
      played.attack||=current.attack;played.hit||=current.hit;
      for(let attempt=0;attempt<20;attempt++){
        await new Promise(resolve=>setTimeout(resolve,25));
        before=HD2D.status().battle;
        if(['attack','hit'].every(type=>before.effectDetails?.some(effect=>
          effect.type===type&&effect.visible&&effect.assetReady)))break;
      }
      if(['attack','hit'].every(type=>before.effectDetails?.some(effect=>
        effect.type===type&&effect.visible&&effect.assetReady)))break;
    }
    const stale=HD2D.playBattle({epoch:epoch-1,type:'attack',sourceId:source.id,
      targetId:target.id,sourceSide:'allies',targetSide:'enemies',durationMs:650});
    const after=HD2D.status().battle;
    return {mounted,attack:played.attack,hit:played.hit,stale,
      hidden:document.hidden,effects:before.effectDetails||[],
      beforeCount:before.activeEffects,afterCount:after.activeEffects,
      beforeEvent:before.lastAcceptedEvent,afterEvent:after.lastAcceptedEvent};
  })()`);
  check('攻击与命中连续出现，命中沿用攻击者的专属视觉而非统一骑兵斩击',
    eventProbe.mounted&&eventProbe.attack&&eventProbe.hit&&
    ['attack','hit'].every(type=>eventProbe.effects.some(effect=>
      effect.type===type&&effect.unitType==='mage_time'&&
      effect.style==='magebolt'&&effect.style!=='cavslash'&&
      effect.visible&&effect.assetReady)),eventProbe);
  check('旧 battleEpoch 的视觉事件被拒绝且不改变当前特效',
    eventProbe.stale===false&&eventProbe.afterCount===eventProbe.beforeCount&&
    JSON.stringify(eventProbe.afterEvent)===JSON.stringify(eventProbe.beforeEvent)&&
    eventProbe.afterEvent?.type==='hit'&&eventProbe.afterEvent?.unitType==='mage_time',eventProbe);
  const speedVfx=[];
  for(const [speed,durationMs] of [[1,600],[2,300],[4,150]]){
    speedVfx.push(await evalJs(`(async()=>{
      const epoch=battleEpoch+5600+${speed};
      const source={type:'archer_longbow',row:'back',id:62001,count:10,hp:100,maxHp:100,
        icon:CFG.units.archer_longbow.icon};
      const target={type:'wild_boar',row:'front',id:62002,count:10,hp:100,maxHp:100,
        icon:CFG.units.wild_boar.icon};
      HD2D.disposeBattle();
      const mounted=HD2D.mountBattle(document.getElementById('battle-scene'),
        {epoch,round:0,speed:${speed},stage:'vfx-speed-check',allies:[source],enemies:[target]},{});
      // Preload this unit's PNG in the same renderer before probing the 4x short window.
      HD2D.playBattle({epoch,type:'attack',sourceId:source.id,targetId:target.id,
        sourceSide:'allies',targetSide:'enemies',durationMs:1200});
      for(let attempt=0;attempt<24;attempt++){
        await new Promise(resolve=>setTimeout(resolve,20));
        if(HD2D.status().battle.effectDetails?.at(-1)?.assetReady)break;
      }
      const accepted=HD2D.playBattle({epoch,type:'attack',sourceId:source.id,targetId:target.id,
        sourceSide:'allies',targetSide:'enemies',durationMs:${durationMs}});
      let seen=null;
      for(let attempt=0;attempt<8&&!seen;attempt++){
        await new Promise(resolve=>setTimeout(resolve,12));
        const effect=HD2D.status().battle.effectDetails?.at(-1);
        if(effect?.type==='attack'&&effect.unitType==='archer_longbow'&&
          effect.visible&&effect.assetReady)seen=effect;
      }
      return {speed:${speed},durationMs:${durationMs},mounted,accepted,seen};
    })()`));
  }
  check('1倍、2倍、4倍速度下攻击贴图都曾真实可见',
    speedVfx.every(item=>item.mounted&&item.accepted&&item.seen?.visible&&
      item.seen?.assetReady&&item.seen?.unitType==='archer_longbow'),speedVfx);
  await setView(390,844);
  const cinematicVfx=await evalJs(`(async()=>{
    const epoch=battleEpoch+5700;
    const make=(type,id)=>({type,row:'front',id,count:12,hp:120,maxHp:120,
      icon:CFG.units[type].icon});
    HD2D.disposeBattle();
    const mounted=HD2D.mountBattle(document.getElementById('battle-scene'),
      {epoch,round:0,speed:1,stage:'vfx-capture',
        allies:[make('star_trooper',63001)],enemies:[make('wild_bull',63002)]},{});
    for(let attempt=0;attempt<50;attempt++){
      if(HD2D.status().battle.layout.every(unit=>unit.portraitReady))break;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    const attack=HD2D.playBattle({epoch,type:'attack',sourceId:63001,targetId:63002,
      sourceSide:'allies',targetSide:'enemies',durationMs:1200});
    return {epoch,mounted,attack,portraits:HD2D.status().battle.layout.every(unit=>unit.portraitReady)};
  })()`);
  const starTravel=await evalJs(`(async()=>{
    let effect;
    for(let replay=0;replay<3;replay++){
      if(replay)HD2D.playBattle({epoch:${cinematicVfx.epoch},type:'attack',
        sourceId:63001,targetId:63002,sourceSide:'allies',targetSide:'enemies',
        durationMs:1200});
      for(let attempt=0;attempt<22;attempt++){
        await new Promise(resolve=>setTimeout(resolve,25));
        const effects=HD2D.status().battle.effectDetails||[];
        effect=effects.find(item=>item.type==='attack'&&
          item.unitType==='star_trooper'&&item.phase==='travel'&&
          item.visible&&item.assetReady);
        if(effect)break;
      }
      if(effect)break;
    }
    return effect||null;
  })()`);
  check('高级兵种攻击中段有可见专属轨迹与多层拖尾',
    cinematicVfx.mounted&&cinematicVfx.portraits&&cinematicVfx.attack&&starTravel?.visible&&
    starTravel?.assetReady&&starTravel?.ornaments>=4&&starTravel?.phase==='travel',starTravel);
  await shot('390-vfx-star-travel');
  const starHit=await evalJs(`HD2D.playBattle({epoch:${cinematicVfx.epoch},type:'hit',
    sourceId:63001,targetId:63002,sourceSide:'allies',targetSide:'enemies',durationMs:300})`);
  await sleep(85);
  const starImpact=await evalJs(`HD2D.status().battle.effectDetails.find(effect=>
    effect.type==='hit'&&effect.unitType==='star_trooper')`);
  check('高级兵种命中有独立可见光效',starHit&&starImpact?.visible&&
    starImpact?.assetReady&&starImpact?.phase==='impact',starImpact);
  await shot('390-vfx-star-impact');
  await setView(360,800);await sleep(150);
  const sparseBadgeGap=await evalJs(`(async()=>{
    // Measure idle portrait anchors in a fresh scene. The preceding attack
    // and hit deliberately change the sprite pose and its head position.
    const epoch=battleEpoch+5701;
    const make=(type,id)=>({type,row:'front',id,count:12,hp:120,maxHp:120,
      icon:CFG.units[type].icon});
    HD2D.disposeBattle();
    HD2D.mountBattle(document.getElementById('battle-scene'),
      {epoch,round:0,speed:1,stage:'badge-anchor-check',
        allies:[make('star_trooper',63001)],enemies:[make('wild_bull',63002)]},{});
    for(let attempt=0;attempt<50;attempt++){
      if(HD2D.status().battle.layout.every(unit=>unit.portraitReady))break;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    const scene=document.getElementById('battle-scene');
    const layout=HD2D.status().battle.layout;
    const types=new Map([[63001,'star_trooper'],[63002,'wild_bull']]);
    return Promise.all(layout.map(async unit=>{
      const image=new Image();image.src='./assets/art/units/hires/'+types.get(unit.id)+'.png';
      await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;
      canvas.height=image.naturalHeight;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
      let solidTop=canvas.height;
      for(let y=0;y<canvas.height&&solidTop===canvas.height;y++){
        let opaque=0;
        for(let x=Math.floor(canvas.width/3);x<Math.ceil(canvas.width*2/3);x++)
          if(pixels[(y*canvas.width+x)*4+3]>=96)opaque++;
        if(opaque>=Math.ceil(canvas.width/45))solidTop=y;
      }
      const artTop=unit.spriteRect.top+(unit.spriteRect.bottom-unit.spriteRect.top)*solidTop/canvas.height;
      const lineY=(unit.badgeRect.top+unit.badgeRect.bottom)/2;
      return {id:unit.id,side:unit.side,gap:artTop-lineY,
        inside:unit.badgeRect.top>=0&&unit.badgeRect.bottom<=scene.clientHeight};
    }));
  })()`);
  // The boar's horn rises well above its mane. The line belongs at the mane,
  // while the armoured unit has no such tall foreground silhouette.
  check('360×800 稀疏高阶与野兽血条贴近头部且完整入镜',
    sparseBadgeGap.length===2&&sparseBadgeGap.every(item=>item.inside&&
      (item.side==='enemies'?item.gap>=-18&&item.gap<=-10:
        item.gap>=-8&&item.gap<=0)),
    sparseBadgeGap);
  await shot('360x800-vfx-star-badges');
  for(const [width,height] of [[320,568],[390,844]]){
    await setView(width,height);
    const spear=await evalJs(`(async()=>{
      const epoch=battleEpoch+5800+${width};
      const make=(type,id)=>({type,row:'front',id,count:12,hp:120,maxHp:120,
        icon:CFG.units[type].icon});
      HD2D.disposeBattle();
      const mounted=HD2D.mountBattle(document.getElementById('battle-scene'),
        {epoch,round:0,speed:1,stage:'spear-badge-check',
          allies:[make('iron_spearman',65001)],enemies:[make('wild_boar',65002)]},{});
      for(let attempt=0;attempt<50;attempt++){
        if(HD2D.status().battle.layout.every(unit=>unit.portraitReady))break;
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      const unit=HD2D.status().battle.layout.find(item=>item.id===65001);
      const image=new Image();image.src='./assets/art/units/hires/iron_spearman.png';
      await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;
      canvas.height=image.naturalHeight;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
      let tip=canvas.height,helmet=canvas.height;
      for(let y=0;y<canvas.height;y++){
        let centerOpaque=0;
        for(let x=0;x<canvas.width;x++){
          if(pixels[(y*canvas.width+x)*4+3]<96)continue;
          tip=Math.min(tip,y);
          if(x>=Math.floor(canvas.width/3)&&x<Math.ceil(canvas.width*2/3))centerOpaque++;
        }
        if(helmet===canvas.height&&centerOpaque>=Math.ceil(canvas.width/45))helmet=y;
      }
      const px=fraction=>unit.spriteRect.top+
        (unit.spriteRect.bottom-unit.spriteRect.top)*fraction;
      const line=(unit.badgeRect.top+unit.badgeRect.bottom)/2;
      const scene=document.getElementById('battle-scene');
      return {mounted,ready:unit.portraitReady,
        headGap:px(helmet/canvas.height)-line,tipDistance:line-px(tip/canvas.height),
        inside:unit.badgeRect.top>=0&&unit.badgeRect.bottom<=scene.clientHeight};
    })()`);
    check(`${width}px 长枪兵血线贴头而不是枪尖`,spear.mounted&&spear.ready&&
      spear.headGap>=-10&&spear.headGap<=0&&spear.tipDistance>12&&spear.inside,spear);
    await shot(`${width}-spear-head-badge`);
  }
  await setView(390,844);
  const humbleVfx=await evalJs(`(async()=>{
    const epoch=battleEpoch+5701;
    const make=(type,id)=>({type,row:'front',id,count:12,hp:120,maxHp:120,
      icon:CFG.units[type].icon});
    HD2D.disposeBattle();
    const mounted=HD2D.mountBattle(document.getElementById('battle-scene'),
      {epoch,round:0,speed:1,stage:'vfx-capture',
        allies:[make('infantry',64001)],enemies:[make('wild_boar',64002)]},{});
    for(let attempt=0;attempt<50;attempt++){
      if(HD2D.status().battle.layout.every(unit=>unit.portraitReady))break;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    const attack=HD2D.playBattle({epoch,type:'attack',sourceId:64001,targetId:64002,
      sourceSide:'allies',targetSide:'enemies',durationMs:900});
    return {mounted,attack,portraits:HD2D.status().battle.layout.every(unit=>unit.portraitReady)};
  })()`);
  await sleep(410);
  const infantryTravel=await evalJs(`HD2D.status().battle.effectDetails.find(effect=>
    effect.type==='attack'&&effect.unitType==='infantry')`);
  check('初级兵种轨迹可见，面积与装饰层均少于高级兵种',humbleVfx.mounted&&humbleVfx.portraits&&
    humbleVfx.attack&&infantryTravel?.visible&&infantryTravel?.assetReady&&
    infantryTravel?.ornaments<starTravel?.ornaments&&
    infantryTravel?.mainWidth<starTravel?.mainWidth*0.75&&
    infantryTravel?.glowOpacity<starTravel?.glowOpacity,
    {infantry:infantryTravel,star:starTravel});
  await shot('390-vfx-infantry-travel');
  await evalJs(`(()=>{
    HD2D.disposeBattle();
    document.getElementById('battle-screen').classList.remove('hd2d-active');
    document.getElementById('battle-hud').innerHTML=window.__fullVisualPreviousHud;
    updateBattleVisual();
    delete window.__fullVisualFixture;
    delete window.__fullVisualPreviousHud;
    return true;
  })()`);
  const fallbackUnitVfx=await evalJs(`(()=>{
    const screen=document.getElementById('battle-screen'),layer=document.getElementById('battle-vfx-layer');
    const actor=document.createElement('div'),target=document.createElement('div');
    actor.style.cssText='position:fixed;left:270px;top:340px;width:32px;height:32px';
    target.style.cssText='position:fixed;left:65px;top:340px;width:32px;height:32px';
    document.body.append(actor,target);screen.classList.remove('hd2d-active');
    spawnVFX(actor,target,'infantry');
    const low=layer.querySelector('[data-unit-vfx="infantry"]');
    spawnVFX(actor,target,'star_trooper');
    const high=layer.querySelector('[data-unit-vfx="star_trooper"]');
    const result={lowAsset:low?.style.backgroundImage||'',highAsset:high?.style.backgroundImage||'',
      lowRank:low?.dataset.rank,highRank:high?.dataset.rank,
      lowWidth:low?.offsetWidth||0,highWidth:high?.offsetWidth||0,
      animating:!!low?.getAnimations().length&&!!high?.getAnimations().length};
    low?.remove();high?.remove();actor.remove();target.remove();updateBattleVisual();
    return result;
  })()`);
  check('无WebGL的二维回退也播放兵种专属贴图并按等级控制尺寸',
    fallbackUnitVfx.lowAsset.includes('/vfx/units/infantry.png')&&
    fallbackUnitVfx.highAsset.includes('/vfx/units/star_trooper.png')&&
    fallbackUnitVfx.lowRank==='1'&&fallbackUnitVfx.highRank==='5'&&
    fallbackUnitVfx.lowWidth<fallbackUnitVfx.highWidth&&fallbackUnitVfx.animating,
    fallbackUnitVfx);
  await sleep(180);
  await setView(390);
  const battleControls=await evalJs(`(()=>{
    const toggle=document.getElementById('battle-log-toggle'),screen=document.getElementById('battle-screen');
    toggle.click();const logOpen=screen.classList.contains('log-open')&&toggle.getAttribute('aria-expanded')==='true';
    toggle.click();const logClosed=!screen.classList.contains('log-open');
    const speed=document.querySelector('#battle-speed [data-spd="4"]');
    speed.click();return {logOpen,logClosed,speed:S.battleSpeed===4};
  })()`);
  check('战斗日志可展开收起且倍速入口生效',Object.values(battleControls).every(Boolean),battleControls);
  if(battleView.mounted){
    await evalJs(`(()=>{
      const canvas=document.querySelector('#battle-scene canvas');
      canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
      return true;
    })()`);
    await sleep(160);
    const lost=await evalJs(`(()=>{
      const field=document.getElementById('battle-field');
      const stage=document.getElementById('battle-stage');
      const cards=[...field.querySelectorAll('.unit-box')];
      const cardSizes=cards.map(card=>{const r=card.getBoundingClientRect();return {width:r.width,height:r.height};});
      const backgroundImage=getComputedStyle(stage).backgroundImage;
      return {active:S.battleActive,mounted:HD2D.status().battle.mounted,
        fallback:!document.getElementById('battle-screen').classList.contains('hd2d-active')&&
          cards.length>0,
        readable:cardSizes.every(r=>r.width>=60&&r.height>=60)&&backgroundImage.includes('battle-daylight.png'),
        cardSizes,backgroundImage,
        scrollable:field.scrollHeight<=field.clientHeight+1||
          ['auto','scroll'].includes(getComputedStyle(field).overflowY)};
    })()`);
    check('WebGL 上下文丢失后仍在同一场战斗并显示可滚动的二维回退',
      lost.active&&!lost.mounted&&lost.fallback&&lost.readable&&lost.scrollable,lost);
    await sleep(120);await shot('390-battle-fallback');
  }
  await evalJs("fleeBattle();'ok'");
  check('撤退后战斗渲染层释放',await evalJs("!S.battleActive&&!HD2D.status().battle.mounted"));

  // Battle logic must remain identical when the real HD-2D renderer is disabled.
  // Stop this isolated page's background tick so the saved document differs only by ts.
  const paritySetup=await evalJs(`(()=>{
    for(let id=1;id<300;id++)clearInterval(id);
    S.formation={front:[{type:'infantry',count:10,id:333}],mid:[],back:[]};
    S.selEnemy=0;S.page='fight';S.tick=100;
    updateUI();
    window.__visualBattleBaseline=JSON.parse(JSON.stringify(serializeSave()));
    window.__visualOriginalMount=HD2D.mountBattle;
    window.__visualOriginalPlay=HD2D.playBattle;
    HD2D.playBattle=function(event){
      const accepted=window.__visualOriginalPlay(event);
      if(accepted){
        const battle=HD2D.status().battle;
        window.__visualEvents?.push({type:event.type,epoch:event.epoch,
          sourceId:event.sourceId,targetId:event.targetId,
          last:battle.lastAcceptedEvent,
          effect:battle.effectDetails?.at(-1)});
      }
      return accepted;
    };
    window.__visualOriginalRandom=Math.random;
    return {count:S.formation.front[0].count,stage:CFG.enemies[0].id};
  })()`);
  async function runParityBattle(useHd2d){
    const started=await evalJs(`(()=>{
      applySaveToS(JSON.parse(JSON.stringify(window.__visualBattleBaseline)));
      S.selEnemy=0;S.page='fight';S.battleActive=false;S.battleEncounter=null;
      let seed=314159265,calls=0;
       Math.random=()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
       window.__visualRngCalls=()=>calls;
       window.__visualEvents=[];
       HD2D.mountBattle=${useHd2d?'window.__visualOriginalMount':'()=>false'};
      CFG.battleStepDelay=1;CFG.battleRoundDelay=1;S.battleSpeed=4;
      updateUI();openBattle();
      return {active:S.battleActive,mounted:HD2D.status().battle.mounted,rngAtOpen:calls};
    })()`);
    let settled=false;
    for(let attempt=0;attempt<120;attempt++){
      await sleep(100);
      settled=await evalJs('B.settled===true&&S.battleActive===false');
      if(settled)break;
    }
    const outcome=await evalJs(`(()=>{
      const documentSave=JSON.parse(localStorage.getItem('rts_save'));
      delete documentSave.ts;delete documentSave.tick;
      const current=Object.values(S.formation).flat().reduce((count,u)=>count+u.count,0);
      const initial=window.__visualBattleBaseline;
      const rewards={};
      for(const key of Object.keys(S.res)){
        const delta=S.res[key]-(initial.res[key]||0);
        if(delta)rewards[key]=delta;
      }
      return {result:document.getElementById('battle-result').className,
        losses:10-current,rewards,merit:S.merit-initial.merit,defeated:[...S.defeated],
        saveText:JSON.stringify(documentSave),rngCalls:window.__visualRngCalls(),
        visualEvents:window.__visualEvents||[]};
    })()`);
    return {started,settled,outcome};
  }
  const hd2dRun=await runParityBattle(true);
  check('固定种子战斗确实启用三维场景并完成结算',hd2dRun.started.active&&hd2dRun.started.mounted&&hd2dRun.settled&&
    hd2dRun.outcome.result==='win'&&hd2dRun.outcome.merit>0,{started:hd2dRun.started,settled:hd2dRun.settled,
      result:hd2dRun.outcome.result,merit:hd2dRun.outcome.merit});
  const realVisualEvents=hd2dRun.outcome.visualEvents;
  const realAttackHit=realVisualEvents.some((event,index)=>event.type==='hit'&&
    event.last?.type==='hit'&&event.effect?.type==='hit'&&
    event.effect?.unitType==='infantry'&&event.effect?.style==='swordqi'&&
    realVisualEvents.slice(0,index).some(previous=>previous.type==='attack'&&
      previous.sourceId===event.sourceId&&previous.epoch===event.epoch&&
      previous.effect?.unitType==='infantry'&&previous.effect?.style==='swordqi'));
  check('固定种子真实战斗按攻击再命中顺序发出专属视觉事件',realAttackHit,
    realVisualEvents.slice(0,12));
  await sleep(120);await shot('390-battle-victory');
  await evalJs("exitBattle();'ok'");
  const fallbackRun=await runParityBattle(false);
  check('同一固定种子战斗在强制二维回退下完成结算',fallbackRun.started.active&&!fallbackRun.started.mounted&&fallbackRun.settled,
    {started:fallbackRun.started,settled:fallbackRun.settled});
  check('三维与二维战损、奖励和存档正文完全一致',
    hd2dRun.outcome.losses===fallbackRun.outcome.losses&&
    JSON.stringify(hd2dRun.outcome.rewards)===JSON.stringify(fallbackRun.outcome.rewards)&&
    hd2dRun.outcome.merit===fallbackRun.outcome.merit&&
    hd2dRun.outcome.saveText===fallbackRun.outcome.saveText,
    {hd2d:{losses:hd2dRun.outcome.losses,rewards:hd2dRun.outcome.rewards,merit:hd2dRun.outcome.merit,
      rngAtOpen:hd2dRun.started.rngAtOpen,rngCalls:hd2dRun.outcome.rngCalls},
      fallback:{losses:fallbackRun.outcome.losses,rewards:fallbackRun.outcome.rewards,merit:fallbackRun.outcome.merit,
        rngAtOpen:fallbackRun.started.rngAtOpen,rngCalls:fallbackRun.outcome.rngCalls},
      saveEqual:hd2dRun.outcome.saveText===fallbackRun.outcome.saveText});
  await evalJs("CFG.battleStepDelay=60000;CFG.battleRoundDelay=60000;'ok'");
  const retried=await evalJs("(()=>{const epoch=battleEpoch;retryBattle();return {epoch,active:S.battleActive}})()");
  await sleep(300);
  const retryState=await evalJs("({active:S.battleActive,epoch:battleEpoch,settled:B.settled})");
  check('结算后重试创建新战斗且旧结算不复用',!retried.active&&retryState.active&&
    retryState.epoch>retried.epoch&&!retryState.settled,{retried,retryState});
  await evalJs("fleeBattle();HD2D.mountBattle=window.__visualOriginalMount;HD2D.playBattle=window.__visualOriginalPlay;Math.random=window.__visualOriginalRandom;'ok'");

  // Direct file opening remains a supported 2D fallback path.
  const fileUrl=pathToFileURL(path.join(root,'index.html')).href;
  await send('Page.navigate',{url:fileUrl});
  check('file:// 页面可加载',await waitForProtocol('file:'));await sleep(300);
  const fileView=await evalJs(`(()=>({protocol:location.protocol,renderer:HD2D.status().town,
    fallback:!!document.querySelector('#town-scene .town-map'),canvas:!!document.querySelector('#town-scene canvas')}))()`);
  check('file:// 使用二维地图回退',fileView.protocol==='file:'&&!fileView.renderer.mounted&&fileView.fallback&&!fileView.canvas,fileView);
  await shot('file-town-base');
  await setView(320,568);await sleep(160);await shot('file-town-base-320');
  await evalJs("document.querySelector('.town-expand-button')?.click();'ok'");
  await sleep(400);
  const fileExpanded=await evalJs(`(()=>{
    const map=document.querySelector('#town-scene .town-map'),bounds=map.getBoundingClientRect();
    const sites=[...map.querySelectorAll('.town-art-site')].map(site=>{
      const box=site.getBoundingClientRect();return {site:site.className,
        inside:box.left>=bounds.left-1&&box.right<=bounds.right+1&&
          box.top>=bounds.top-1&&box.bottom<=bounds.bottom+1,
        left:box.left,top:box.top,right:box.right,bottom:box.bottom};
    });
    return {expanded:!!map.closest('.town-map-card.is-expanded'),inside:sites.every(site=>site.inside),
      bounds:{left:bounds.left,top:bounds.top,right:bounds.right,bottom:bounds.bottom},sites,
      backgroundSize:getComputedStyle(map).backgroundSize};
  })()`);
  check('二维回退展开后完整城镇图和地标仍可见',fileExpanded.expanded&&fileExpanded.inside&&
    fileExpanded.backgroundSize.startsWith('contain'),fileExpanded);
  await shot('file-town-expanded-320');
  await evalJs("document.querySelector('.town-expand-button')?.click();'ok'");
  await sleep(100);
  const fileTown=await evalJs(`(()=>{
    const map=document.querySelector('#town-scene .town-map');
    const sites=[...map.querySelectorAll('.town-art-site')];
    const mapBox=map.getBoundingClientRect(),rects=sites.map(site=>site.getBoundingClientRect());
    const clickable=sites.every(site=>{const box=site.getBoundingClientRect(),style=getComputedStyle(site);
      return box.width>=48&&box.height>=48&&style.visibility==='visible';});
    const inside=rects.every(box=>box.left>=mapBox.left-1&&box.right<=mapBox.right+1&&
      box.top>=mapBox.top-1&&box.bottom<=mapBox.bottom+1);
    const separated=rects.every((box,i)=>rects.every((other,j)=>i===j||
      box.right<=other.left||other.right<=box.left||box.bottom<=other.top||other.bottom<=box.top));
    const era=map.dataset.era,background=getComputedStyle(map).backgroundImage;
    map.querySelector('.town-art-tech')?.click();
    return {era,background,sites:sites.length,clickable,inside,separated,page:S.page};
  })()`);
  check('二维回退采用当前时代城镇图并保留七处 48px 地标入口',
    fileTown.era==='base'&&fileTown.background.includes('town-base.png')&&
    fileTown.sites===7&&fileTown.clickable&&fileTown.inside&&fileTown.separated&&fileTown.page==='tech',fileTown);
  check('HTTP 场景资产无 404',missing.size===0,[...missing]);
  check('浏览器没有未捕获异常',exceptions.length===0,exceptions.slice(0,4));
  const failed=checks.filter(item=>!item.ok);
  console.log(JSON.stringify({checks,passed:checks.length-failed.length,failed:failed.length,
    battleGeometry:battleView.geometry,screenshots,
    environment:'Node '+process.version+' + Edge headless CDP, emulated CSS viewports; not an Android device performance test'},null,2));
  process.exitCode=failed.length?1:0;
})().catch(error=>{console.error('VISUAL_BROWSER_ERROR',error?.stack||error);process.exitCode=2;}).finally(async()=>{
  try{ws?.close();}catch(_){}
  if(browser?.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await new Promise(resolve=>server.close(resolve));
  await sleep(250);
  try{if(path.resolve(profile).startsWith(tempRoot+path.sep)&&fs.existsSync(profile))
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:250});}
  catch(error){console.error('PROFILE_CLEANUP_FAILED',error.message);}
  process.exit(process.exitCode||0);
});
