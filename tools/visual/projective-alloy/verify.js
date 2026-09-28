'use strict';
// Browser-side structural and pixel checks; no game state or art files change.
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
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '');
  const file=path.resolve(root,relative);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);
  });
});
function dump(url,profile){
  return new Promise((resolve,reject)=>{
    const args=[`--user-data-dir=${profile}`,'--headless=new','--no-first-run',
      '--disable-extensions','--use-angle=swiftshader','--enable-unsafe-swiftshader',
      '--virtual-time-budget=8500','--window-size=1050,550','--dump-dom',url];
    const child=spawn(edge,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});
    let output='',error='';
    child.stdout.on('data',data=>output+=data.toString());
    child.stderr.on('data',data=>error+=data.toString());
    const timeout=setTimeout(()=>child.kill(),30000);
    child.on('error',reject);
    child.on('close',code=>{
      clearTimeout(timeout);
      try{cleanProfile(profile);}catch(cleanError){return reject(cleanError);}
      const match=output.match(/data-metrics="([^"]+)"/);
      if(code!==0||!match)return reject(Error(`Edge dump failed: exit ${code} ${error.slice(-500)} ${output.slice(-500)}`));
      resolve(JSON.parse(decodeURIComponent(match[1])));
    });
  });
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/tools/visual/projective-alloy/index.html`;
  const results=[];
  for(const yaw of [-8,0,8]){
    const profile=makeProfile();
    results.push(await dump(`${base}?yaw=${yaw}`,profile));
  }
  const center=results[1];
  const [a,b]=center.roofNormals;
  const roofDot=a.reduce((sum,v,i)=>sum+v*b[i],0);
  const checks={
    allAnglesLoaded:results.every(item=>item.closedShells>=50&&item.triangles>500),
    actualDepth:center.depthRange[1]-center.depthRange[0]>70,
    differentRoofNormals:Math.abs(roofDot)<.95,
    batchedForMobile:center.meshBatches<=7&&center.drawCalls<=9,
    generatedTexturesMapped:results.every(item=>item.generatedFaces>=35),
    originalOutsidePreserved:center.pixelDifference.outside<1.5,
    movingLightChangesPixels:center.domeLightDifference>.15,
    visualDefaultMeasured:Number.isFinite(center.pixelDifference.roi)
  };
  const report={variant:'alloy-projective',checks,roofDot,
    artReview:'candidate-only: 8-degree silhouette and roof seams need repaint',
    results:results.map(item=>({
    yaw:item.yaw,triangles:item.triangles,closedShells:item.closedShells,
    generatedFaces:item.generatedFaces,
    meshBatches:item.meshBatches,drawCalls:item.drawCalls,
    depthRange:item.depthRange,pixelDifference:item.pixelDifference,
    lightDifference:item.lightDifference,domeLightDifference:item.domeLightDifference
  }))};
  fs.writeFileSync(path.join(__dirname,'metrics.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  process.exitCode=Object.values(checks).every(Boolean)?0:2;
})().catch(error=>{console.error(error);process.exitCode=2;})
  .finally(()=>{server.close();try{fs.rmdirSync(profileRoot);}catch(_){}});
