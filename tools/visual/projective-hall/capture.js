'use strict';
// Captures the isolated WebGL art study at the actual 360 x 200 map size.
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const edgeMaskTrial=process.argv.includes('--edge');
const phone=process.argv.includes('--phone');
const refine=process.argv.includes('--refine')||edgeMaskTrial;
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
    const url=`http://127.0.0.1:${port}/tools/visual/projective-hall/${page}`;
    const out=path.join(root,'hd2d-previews',name);
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'projective-hall-edge-'));
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
      const ok=code===0&&fs.existsSync(out)&&fs.statSync(out).size>15000;
      if(!ok)return reject(Error(`capture ${name}: exit ${code}; ${error.slice(-500)}`));
      resolve({path:out,bytes:fs.statSync(out).size});
    });
  });
}
server.listen(0,'127.0.0.1',async()=>{
  try{
    const port=server.address().port;
    const results=phone?[await capture(port,'comparison-phone.html',
      'qa-projective-hall-edge-320-390.png',1650,540)]:await Promise.all([
      capture(port,edgeMaskTrial?'comparison-edge.html':refine?'comparison-refined.html':'comparison.html',
        edgeMaskTrial?'qa-projective-hall-edge-360x200.png':refine?'qa-projective-hall-refined-360x200.png':'qa-projective-hall-textured-360x200.png',1500),
      capture(port,edgeMaskTrial?'geometry-edge.html':refine?'geometry-refined.html':'geometry.html',
        edgeMaskTrial?'qa-projective-hall-edge-geometry-360x200.png':refine?'qa-projective-hall-refined-geometry-360x200.png':'qa-projective-hall-textured-geometry-360x200.png',1140)
    ]);
    console.log(JSON.stringify(results,null,2));
  }catch(error){console.error(error);process.exitCode=2;}
  finally{server.close();}
});
