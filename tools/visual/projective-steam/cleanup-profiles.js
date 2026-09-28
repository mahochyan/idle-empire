'use strict';
// Remove only browser profiles created by this isolated art study. Run after
// Edge captures have exited. Never enumerate a general cache for deletion.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const profileRoots=[os.tmpdir(),path.join(root,'hd2d-previews')];
const pattern=/^projective-steam-(?:edge|verify)-[A-Za-z0-9]+$/;
for(const candidateRoot of profileRoots){
  const verifiedRoot=fs.realpathSync(candidateRoot);
  for(const item of fs.readdirSync(verifiedRoot,{withFileTypes:true})){
    if(!item.isDirectory()||!pattern.test(item.name))continue;
    const target=fs.realpathSync(path.join(verifiedRoot,item.name));
    if(!target.startsWith(verifiedRoot+path.sep)){
      throw Error('Profile path escaped target directory: '+target);
    }
    fs.rmSync(target,{recursive:true,force:true,maxRetries:6,retryDelay:250});
    console.log('Removed owned Edge profile '+target);
  }
}
