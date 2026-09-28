'use strict';
// Captures the isolated WebGL art study at the actual 360 x 200 map size.
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const profileRoot=path.resolve(__dirname,'.edge-temp');
fs.mkdirSync(profileRoot,{recursive:true});
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
    const url=`http://127.0.0.1:${port}/tools/visual/projective-bronze/${page}`;
    const out=path.join(root,'hd2d-previews',name);
    const profile=fs.mkdtempSync(path.join(profileRoot,'edge-'));
    const args=[`--user-data-dir=${profile}`,'--headless=new','--disable-extensions',
      '--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader',
      '--hide-scrollbars','--virtual-time-budget=8500',`--window-size=${width},${height}`,
      `--screenshot=${out}`,url];
    const child=spawn(edge,args,{stdio:['ignore','pipe','pipe'],windowsHide:true,
      env:{...process.env,TEMP:profileRoot,TMP:profileRoot}});
    let error='';child.stderr.on('data',data=>error+=data.toString());
    const timeout=setTimeout(()=>child.kill(),30000);
    child.on('error',reject);
    child.on('close',code=>setTimeout(()=>{
      clearTimeout(timeout);
      try{
        if(!path.resolve(profile).startsWith(profileRoot+path.sep))throw Error('Unsafe profile path');
        fs.rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:250});
      }catch(cleanupError){console.error('PROFILE_CLEANUP_FAILED',cleanupError.message);}
      const ok=code===0&&fs.existsSync(out)&&fs.statSync(out).size>15000;
      if(!ok)return reject(Error(`capture ${name}: exit ${code}; ${error.slice(-500)}`));
      resolve({path:out,bytes:fs.statSync(out).size});
    },250));
  });
}
server.listen(0,'127.0.0.1',async()=>{
  try{
    const port=server.address().port;
    const results=await Promise.all([
      capture(port,'comparison.html','qa-projective-bronze-360x200.png',1500),
      capture(port,'comparison-phone.html','qa-projective-bronze-320-390.png',1600,500),
      capture(port,'geometry.html','qa-projective-bronze-geometry-360x200.png',1500)
    ]);
    console.log(JSON.stringify(results,null,2));
  }catch(error){console.error(error);process.exitCode=2;}
  finally{server.close();}
});
