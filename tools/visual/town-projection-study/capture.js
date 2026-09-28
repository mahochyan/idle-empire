'use strict';
// Read-only browser screenshot capture of the isolated projection study.
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(fs.existsSync);
if(!edge)throw Error('Microsoft Edge is required');
const out=path.join(root,'hd2d-previews','qa-town-projection-comparison-360x200.png');
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png','.css':'text/css'};
const server=http.createServer((req,res)=>{
  const raw=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '');
  const file=path.resolve(root,raw);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);
  });
});
server.listen(0,'127.0.0.1',async()=>{
  const url=`http://127.0.0.1:${server.address().port}/tools/visual/town-projection-study/comparison.html`;
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'town-projection-edge-'));
  const args=[`--user-data-dir=${profile}`,'--headless=new','--disable-extensions','--no-first-run',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars',
    '--virtual-time-budget=6000','--window-size=1130,235',`--screenshot=${out}`,url];
  const child=spawn(edge,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});
  let error=''; child.stderr.on('data',data=>{error+=data.toString();});
  const timeout=setTimeout(()=>child.kill(),30000);
  child.on('close',code=>{
    clearTimeout(timeout); server.close();
    const ok=fs.existsSync(out)&&fs.statSync(out).size>10000;
    console.log(JSON.stringify({exit:code,ok,bytes:ok?fs.statSync(out).size:0,path:out,stderr:error.slice(-800)},null,2));
    process.exitCode=ok?0:2;
  });
});
