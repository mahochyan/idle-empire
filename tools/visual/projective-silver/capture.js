'use strict';
// Save actual-size comparisons; this is a development-only browser capture.
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
if(!edge)throw Error('Microsoft Edge required for this verification');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.png':'image/png'};
const server=http.createServer((req,res)=>{
  let relative;
  try{relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '');}
  catch(_){res.writeHead(400).end();return;}
  const file=path.resolve(root,relative);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);
  });
});
function capture(port,page,name,width,height){
  return new Promise((resolve,reject)=>{
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'projective-silver-shot-'));
    const output=path.join(root,'hd2d-previews',name);
    const url=`http://127.0.0.1:${port}/tools/visual/projective-silver/${page}`;
    const args=[`--user-data-dir=${profile}`,'--headless=new','--no-first-run',
      '--disable-extensions','--use-angle=swiftshader','--enable-unsafe-swiftshader',
      '--hide-scrollbars','--virtual-time-budget=8500',`--window-size=${width},${height}`,
      `--screenshot=${output}`,url];
    const child=spawn(edge,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});
    let error='';child.stderr.on('data',data=>error+=data.toString());
    const timer=setTimeout(()=>child.kill(),30000);
    child.on('error',reject);
    child.on('close',code=>{
      clearTimeout(timer);
      if(code!==0||!fs.existsSync(output)||fs.statSync(output).size<15000){
        reject(Error(`capture ${name}: exit ${code}; ${error.slice(-500)}`));return;
      }
      resolve({path:output,bytes:fs.statSync(output).size});
    });
  });
}
server.listen(0,'127.0.0.1',async()=>{
  try{
    const port=server.address().port;
    const results=await Promise.all([
      capture(port,'comparison.html','qa-projective-silver-360x200.png',1500,250),
      capture(port,'geometry.html','qa-projective-silver-geometry-360x200.png',1140,250),
      capture(port,'comparison-phone.html','qa-projective-silver-320-390.png',1650,540)
    ]);
    console.log(JSON.stringify(results,null,2));
  }catch(error){console.error(error);process.exitCode=2;}
  finally{server.close();}
});
