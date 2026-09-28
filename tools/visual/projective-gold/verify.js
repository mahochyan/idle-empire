'use strict';
// Browser-side structural and pixel checks; no game state or art files change.
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
    const child=spawn(edge,args,{stdio:['ignore','pipe','pipe'],windowsHide:true,
      env:{...process.env,TEMP:profileRoot,TMP:profileRoot}});
    let output='',error='';
    child.stdout.on('data',data=>output+=data.toString());
    child.stderr.on('data',data=>error+=data.toString());
    const timeout=setTimeout(()=>child.kill(),30000);
    child.on('error',reject);
    child.on('close',code=>{
      clearTimeout(timeout);
      const match=output.match(/data-metrics="([^"]+)"/);
      if(code!==0||!match)return reject(Error(`Edge dump failed: exit ${code} ${error.slice(-500)} ${output.slice(-500)}`));
      resolve(JSON.parse(decodeURIComponent(match[1])));
    });
  });
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/tools/visual/projective-gold/index.html`;
  const results=[];
  for(const yaw of [-8,0,8]){
    const profile=fs.mkdtempSync(path.join(profileRoot,'verify-'));
    try{results.push(await dump(`${base}?yaw=${yaw}`,profile));}
    finally{
      await new Promise(resolve=>setTimeout(resolve,250));
      if(!path.resolve(profile).startsWith(profileRoot+path.sep))throw Error('Unsafe profile path');
      try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:250});}
      catch(error){console.error('PROFILE_CLEANUP_FAILED',error.message);}
    }
  }
  const center=results[1];
  const [a,b]=center.roofNormals;
  const roofDot=a.reduce((sum,v,i)=>sum+v*b[i],0);
  const checks={
    allAnglesLoaded:results.every(item=>item.closedShells>=20&&item.triangles>300),
    actualDepth:center.depthRange[1]-center.depthRange[0]>70,
    differentRoofNormals:Math.abs(roofDot)<.95,
    batchedForMobile:center.meshBatches<=6&&center.drawCalls<=8,
    generatedTexturesMapped:results.every(item=>item.generatedFaces>=12),
    originalOutsidePreserved:center.pixelDifference.outside<1.5,
    movingLightChangesPixels:center.domeLightDifference>.15,
    visualDefaultMeasured:Number.isFinite(center.pixelDifference.roi)
  };
  console.log(JSON.stringify({variant:'gold-projective',checks,roofDot,results:results.map(item=>({
    yaw:item.yaw,triangles:item.triangles,closedShells:item.closedShells,
    generatedFaces:item.generatedFaces,
    meshBatches:item.meshBatches,drawCalls:item.drawCalls,
    depthRange:item.depthRange,pixelDifference:item.pixelDifference,
    lightDifference:item.lightDifference,domeLightDifference:item.domeLightDifference
  }))},null,2));
  process.exitCode=Object.values(checks).every(Boolean)?0:2;
})().catch(error=>{console.error(error);process.exitCode=2;})
  .finally(()=>server.close());
