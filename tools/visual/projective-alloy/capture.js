'use strict';
// Captures the isolated WebGL art study at the actual 360 x 200 map size.
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const profileRoot=path.resolve(__dirname,'.edge-profiles');
fs.mkdirSync(profileRoot,{recursive:true});
function makeProfile(){return fs.mkdtempSync(path.join(profileRoot,'edge-'));}
function cleanProfile(profile){
  const base=fs.realpathSync(profileRoot)+path.sep;
  const target=fs.realpathSync(profile);
  if(!target.startsWith(base))throw Error('Refusing to remove profile outside alloy QA');
  fs.rmSync(target,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(fs.existsSync);
if(!edge)throw Error('Microsoft Edge is required');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
const server=http.createServer((req,res)=>{
  let relative;
  try{relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '');}
  catch(_){res.writeHead(400).end();return;}
  const file=path.resolve(root,relative);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);
  });
});
function capture(port,page,name,width,height=250){
  return new Promise((resolve,reject)=>{
  const url=`http://127.0.0.1:${port}/tools/visual/projective-alloy/${page}`;
    const out=path.join(root,'hd2d-previews',name);
    const profile=makeProfile();
    const args=[`--user-data-dir=${profile}`,'--headless=new','--disable-extensions',
      '--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader',
      '--hide-scrollbars','--virtual-time-budget=8500',`--window-size=${width},${height}`,
      `--screenshot=${out}`,url];
    const child=spawn(edge,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});
    let error='';child.stderr.on('data',data=>error+=data.toString());
    const timeout=setTimeout(()=>child.kill(),30000);
    child.on('error',reject);
    child.on('close',code=>{
      clearTimeout(timeout);
      try{cleanProfile(profile);}catch(error){return reject(error);}
      const ok=code===0&&fs.existsSync(out)&&fs.statSync(out).size>15000;
      if(!ok)return reject(Error(`capture ${name}: exit ${code}; ${error.slice(-500)}`));
      resolve({path:out,bytes:fs.statSync(out).size});
    });
  });
}
server.listen(0,'127.0.0.1',async()=>{
  try{
    const port=server.address().port;
    const results=await Promise.all([
      capture(port,'comparison.html','qa-projective-alloy-360x200.png',1500),
      capture(port,'comparison-phone.html','qa-projective-alloy-320-390.png',1600,500),
      capture(port,'geometry.html','qa-projective-alloy-geometry-360x200.png',1500),
      capture(port,'detail.html','qa-projective-alloy-detail-1to1.png',1280,330)
    ]);
    console.log(JSON.stringify(results,null,2));
  }catch(error){console.error(error);process.exitCode=2;}
  finally{server.close();try{fs.rmdirSync(profileRoot);}catch(_){}}
});
