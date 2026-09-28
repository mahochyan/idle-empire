'use strict';
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
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '');
  const file=path.resolve(root,relative);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);
  });
});
function edgeCall(url,args,timeoutMs=45000){
  return new Promise((resolve,reject)=>{
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'projective-iron-'));
    const child=spawn(edge,[`--user-data-dir=${profile}`,'--headless=new','--disable-extensions',
      '--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader',
      '--hide-scrollbars','--virtual-time-budget=11000',...args,url],
    {stdio:['ignore','pipe','pipe'],windowsHide:true});
    let output='',error='';
    child.stdout.on('data',data=>output+=data.toString());
    child.stderr.on('data',data=>error+=data.toString());
    const timeout=setTimeout(()=>child.kill(),timeoutMs);
    child.on('error',reject);
    child.on('close',code=>{
      clearTimeout(timeout);
      if(code!==0)return reject(Error('Edge exit '+code+' '+error.slice(-500)));
      resolve(output);
    });
  });
}
async function capture(port,page,name,width,height){
  const output=path.join(root,'hd2d-previews',name);
  await edgeCall(`http://127.0.0.1:${port}/tools/visual/projective-iron/${page}`,
    [`--window-size=${width},${height}`,`--screenshot=${output}`]);
  if(!fs.existsSync(output)||fs.statSync(output).size<20000)throw Error('Screenshot missing '+name);
  return {path:output,bytes:fs.statSync(output).size};
}
async function metrics(port,yaw){
  const output=await edgeCall(`http://127.0.0.1:${port}/tools/visual/projective-iron/index.html?yaw=${yaw}`,
    ['--window-size=1050,550','--dump-dom']);
  const match=output.match(/data-metrics="([^"]+)"/);
  if(!match)throw Error('Prototype metrics missing '+yaw+' '+output.slice(-400));
  return JSON.parse(decodeURIComponent(match[1]));
}
server.listen(0,'127.0.0.1',async()=>{
  try{
    const port=server.address().port;
    const results=[];
    results.push(await capture(port,'comparison.html','qa-projective-iron-320-360-390.png',1600,730));
    results.push(await capture(port,'geometry.html','qa-projective-iron-clay-360x200.png',1490,260));
    const samples=[];
    for(const yaw of [-8,0,8])samples.push(await metrics(port,yaw));
    const center=samples[1];
    const [a,b]=center.roofNormals;
    const dot=a.reduce((sum,v,i)=>sum+v*b[i],0);
    const checks={
      allAnglesLoaded:samples.every(item=>item.closedShells>=30&&item.triangles>=200),
      actualDepth:center.depthRange[1]-center.depthRange[0]>65,
      differentRoofNormals:Math.abs(dot)<.95,
      batchedForMobile:center.meshBatches<=6&&center.drawCalls<=8,
      originalOutsidePreserved:center.pixelDifference.outside<1.5,
      movingLightChangesPixels:center.lightDifference>.10,
      visualDefaultMeasured:Number.isFinite(center.pixelDifference.roi)
    };
    const report={checks,roofNormalDot:dot,samples:samples.map(item=>({
      yaw:item.yaw,triangles:item.triangles,closedShells:item.closedShells,
      depthRange:item.depthRange,meshBatches:item.meshBatches,drawCalls:item.drawCalls,
      pixelDifference:item.pixelDifference,lightDifference:item.lightDifference
    }))};
    fs.writeFileSync(path.join(__dirname,'qa-metrics.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({screenshots:results,...report},null,2));
    process.exitCode=Object.values(checks).every(Boolean)?0:2;
  }catch(error){console.error(error);process.exitCode=2;}
  finally{server.close();}
});
