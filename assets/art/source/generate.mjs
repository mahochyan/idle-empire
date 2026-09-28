// 放置帝国原创像素角色源文件。无需第三方依赖：node assets/art/source/generate.mjs
// 每幅角色以 32×32 像素绘制，透明背景；输出 PNG、SVG 和四套四帧动作图。
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';

const sourceDir=dirname(fileURLToPath(import.meta.url));
const root=join(sourceDir,'..');
const outDir=join(root,'units');
const svgDir=join(sourceDir,'units');
const buildingDir=join(root,'buildings');
const buildingSvgDir=join(sourceDir,'buildings');
const mapDir=join(root,'map');
const vfxDir=join(root,'vfx');
const vfxSvgDir=join(sourceDir,'vfx');
mkdirSync(outDir,{recursive:true});
mkdirSync(svgDir,{recursive:true});
mkdirSync(buildingDir,{recursive:true});
mkdirSync(buildingSvgDir,{recursive:true});
mkdirSync(mapDir,{recursive:true});
mkdirSync(vfxDir,{recursive:true});
mkdirSync(vfxSvgDir,{recursive:true});

const C={
  ink:'#263743', shade:'#425767', steel:'#8da5ae', shine:'#d9e8df',
  cream:'#fff0ca', skin:'#e9b88d', skinShade:'#b98260',
  hair:'#79543c', gold:'#dbad58', goldHi:'#ffe3a1',
  red:'#bf6654', redHi:'#e89071', green:'#52866a', greenHi:'#88bd86',
  blue:'#557c9e', blueHi:'#8eb6c6', teal:'#55b6aa', tealHi:'#a1dfc7',
  purple:'#826a99', purpleHi:'#b9a1ce', leather:'#8a613f',
  leatherHi:'#bd8c5a', dark:'#304b59', white:'#f7eedb',
  sandLight:'#ead6ad',shadow:'#6c7c76',
};
const rects=[];
const R=(x,y,w,h,c)=>{if(w>0&&h>0)rects.push([x,y,w,h,c]);};
const px=(x,y,c)=>R(x,y,1,1,c);
const badge=(x,y,c)=>{R(x,y,4,4,C.ink);R(x+1,y+1,2,2,c);};

function face(hair=C.hair,helm='hair'){
  R(12,5,9,10,C.ink);R(13,6,7,8,C.skin);
  R(13,11,7,3,C.skinShade);R(13,10,7,2,C.skin);
  px(19,9,C.ink);
  if(helm==='hair'){R(11,4,11,4,C.ink);R(12,5,9,3,hair);R(11,7,3,5,hair);}
  if(helm==='cap'){R(11,3,11,5,C.ink);R(12,4,9,3,hair);R(10,7,13,2,hair);}
  if(helm==='hood'){R(10,3,13,13,C.ink);R(11,4,11,9,hair);R(13,7,8,7,C.skin);R(10,12,3,7,hair);}
  if(helm==='helmet'){R(10,3,13,9,C.ink);R(11,4,11,5,hair);R(11,8,11,2,C.steel);R(12,10,2,5,C.ink);R(14,11,1,4,C.steel);}
  if(helm==='plume'){R(10,3,13,9,C.ink);R(11,4,11,5,hair);R(11,8,11,2,C.steel);R(12,10,2,5,C.ink);R(13,0,6,4,C.ink);R(14,1,4,3,C.red);}
  if(helm==='crown'){R(10,4,13,7,C.ink);R(11,5,11,5,hair);R(11,2,3,4,C.gold);R(16,1,3,5,C.gold);R(20,2,3,4,C.gold);}
}
function torso(main,light,trim=C.gold,{long=false,armour=false,crest=false}={}){
  R(9,13,15,long?15:12,C.ink);R(10,14,13,long?13:10,main);
  R(10,14,4,3,light);R(14,15,5,4,light);
  if(armour){R(11,16,10,6,C.steel);R(12,17,8,3,light);R(15,15,3,9,trim);}
  else {R(15,15,3,10,trim);R(10,22,13,2,C.ink);}
  if(long){R(8,25,17,5,C.ink);R(9,25,15,3,main);R(11,27,11,2,light);}
  if(crest)badge(14,17,trim);
  R(7,15,4,9,C.ink);R(8,16,3,7,main);R(22,15,4,9,C.ink);R(23,16,2,7,main);
  R(7,21,4,3,C.skinShade);R(23,21,3,3,C.skin);
  if(!long){R(11,24,5,6,C.ink);R(12,25,3,4,main);R(18,24,5,6,C.ink);R(19,25,3,4,main);}
  R(9,29,8,2,C.ink);R(17,29,8,2,C.ink);
}
function sword({great=false,flame=false}={}){
  const x=great?25:26,y=great?4:8;
  R(x,y,3,great?20:16,C.ink);R(x+1,y+1,1,great?17:13,flame?C.redHi:C.shine);
  R(x-3,y+16,9,2,C.ink);R(x-2,y+16,7,1,C.gold);
  R(x,y+18,3,8,C.leather);R(x+1,y+18,1,6,C.gold);
  if(flame){R(x-1,y+2,1,7,C.red);R(x+3,y+5,1,6,C.goldHi);}
}
function spear(c=C.steel){
  R(27,1,2,28,C.ink);R(28,7,1,21,C.leatherHi);
  R(26,1,4,7,C.ink);R(27,1,2,5,c);R(28,0,1,3,C.shine);
}
function shield(c=C.steel,{huge=false,emblem=false}={}){
  const x=huge?2:3,y=huge?13:16,w=huge?11:9,h=huge?16:12;
  R(x,y,w,h,C.ink);R(x+1,y+1,w-2,h-3,c);R(x+2,y+2,w-4,3,C.shine);
  R(x+3,y+h-2,w-6,2,C.ink);R(x+Math.floor(w/2)-1,y+3,2,h-7,C.gold);
  if(emblem)badge(x+3,y+6,C.red);
}
function bow({cross=false,long=false,silver=false}={}){
  const c=silver?C.shine:C.leatherHi;
  if(cross){R(21,13,10,2,C.ink);R(22,13,8,1,c);R(24,11,3,9,C.leather);R(20,11,2,5,C.ink);R(29,11,2,5,C.ink);R(21,17,9,1,C.shine);}
  else {const top=long?2:5;R(27,top,2,26-top,C.ink);R(26,top+1,2,5,c);R(29,top+5,1,14,c);R(26,23,2,5,c);R(24,9,1,12,C.cream);R(21,16,8,1,C.ink);R(26,14,4,3,C.shine);}
}
function knives(){R(3,13,3,13,C.ink);R(4,12,1,11,C.shine);R(5,21,4,2,C.gold);R(26,12,3,13,C.ink);R(27,11,1,11,C.shine);R(24,22,5,2,C.gold);}
function staff(c=C.tealHi,{orb=false}={}){R(27,6,2,24,C.ink);R(28,12,1,17,C.leatherHi);R(25,3,6,7,C.ink);R(26,4,4,5,c);if(orb){R(24,2,8,2,c);R(27,0,2,13,C.shine);}}
function rifle(c=C.steel){R(21,15,11,4,C.ink);R(22,16,9,2,c);R(24,19,3,6,C.leather);R(27,14,3,2,C.shine);}
function rose(x,y,c){R(x+1,y,3,4,C.ink);R(x,y+1,5,2,c);R(x+2,y+1,2,2,C.redHi);R(x+2,y+4,1,4,C.green);}
function hourglass(){R(26,3,5,2,C.gold);R(27,5,3,4,C.goldHi);R(28,9,1,4,C.cream);R(27,13,3,4,C.goldHi);R(26,17,5,2,C.gold);}

const humans={
  boss:{main:C.red,light:C.goldHi,helm:'crown',weapon:'flameSword',trim:C.gold,armour:true},
  enemy:{main:C.dark,light:C.red,helm:'helmet',weapon:'sword',trim:C.gold,armour:true},
  infantry:{main:C.leather,light:C.leatherHi,helm:'cap',weapon:'spear',trim:C.green},
  infantry_t0:{main:C.leather,light:C.leatherHi,helm:'cap',weapon:'spear',trim:C.green},
  infantry_t1:{main:C.blue,light:C.blueHi,helm:'helmet',weapon:'sword',trim:C.gold},
  infantry_shield:{main:C.blue,light:C.blueHi,helm:'helmet',weapon:'shield',trim:C.gold,armour:true},
  infantry_spear:{main:C.green,light:C.greenHi,helm:'plume',weapon:'spear',trim:C.gold,armour:true},
  infantry_sword:{main:C.red,light:C.redHi,helm:'helmet',weapon:'great',trim:C.gold,armour:true},
  infantry_fortress:{main:C.dark,light:C.steel,helm:'plume',weapon:'hugeShield',trim:C.gold,armour:true},
  infantry_ironrose:{main:C.green,light:C.greenHi,helm:'plume',weapon:'roseSpear',trim:C.red,armour:true},
  infantry_bloodrose:{main:C.red,light:C.redHi,helm:'plume',weapon:'flameSword',trim:C.gold,armour:true},
  spearman:{main:C.leather,light:C.greenHi,helm:'helmet',weapon:'spear',trim:C.steel},
  bronze_guard:{main:C.leather,light:C.gold,helm:'helmet',weapon:'bronzeShield',trim:C.gold,armour:true},
  iron_spearman:{main:C.dark,light:C.steel,helm:'plume',weapon:'spear',trim:C.shine,armour:true},
  silver_heavy:{main:C.steel,light:C.shine,helm:'helmet',weapon:'hugeShield',trim:C.blue,armour:true},
  alloy_special:{main:C.dark,light:C.teal,helm:'helmet',weapon:'rifle',trim:C.tealHi,armour:true},
  armored_trooper:{main:C.leather,light:C.steel,helm:'helmet',weapon:'steam',trim:C.gold,armour:true},
  electro_trooper:{main:C.blue,light:C.tealHi,helm:'helmet',weapon:'electro',trim:C.teal,armour:true},
  star_trooper:{main:C.white,light:C.blueHi,helm:'star',weapon:'starGun',trim:C.teal,armour:true},
  quantum_trooper:{main:C.dark,light:C.shine,helm:'star',weapon:'starGun',trim:C.blueHi,armour:true},
  archer:{main:C.green,light:C.greenHi,helm:'hood',weapon:'bow',trim:C.gold},
  archer_t0:{main:C.green,light:C.greenHi,helm:'hood',weapon:'bow',trim:C.gold},
  archer_t1:{main:C.green,light:C.tealHi,helm:'cap',weapon:'bow',trim:C.gold},
  archer_silverbow:{main:C.blue,light:C.blueHi,helm:'hood',weapon:'silverBow',trim:C.shine},
  archer_crossbow:{main:C.leather,light:C.steel,helm:'helmet',weapon:'crossbow',trim:C.gold,armour:true},
  archer_assassin:{main:C.purple,light:C.purpleHi,helm:'hood',weapon:'knives',trim:C.red},
  archer_longbow:{main:C.green,light:C.goldHi,helm:'cap',weapon:'longBow',trim:C.gold},
  archer_genoese:{main:C.blue,light:C.steel,helm:'helmet',weapon:'crossbow',trim:C.gold,armour:true},
  archer_shadowblade:{main:C.dark,light:C.purple,helm:'hood',weapon:'knives',trim:C.teal},
};
function drawHuman(s){
  torso(s.main,s.light,s.trim,{armour:s.armour,crest:s.armour});
  face(s.helm==='cap'?C.goldHi:s.main,s.helm==='star'?'helmet':s.helm);
  if(s.helm==='star'){R(12,7,9,6,C.shine);R(13,8,7,4,C.blueHi);R(15,10,4,2,C.ink);}
  if(s.weapon==='spear'||s.weapon==='roseSpear')spear(s.weapon==='roseSpear'?C.redHi:C.steel);
  if(s.weapon==='sword'||s.weapon==='flameSword')sword({flame:s.weapon==='flameSword'});
  if(s.weapon==='great')sword({great:true});
  if(s.weapon==='shield'||s.weapon==='bronzeShield'||s.weapon==='hugeShield'){
    shield(s.weapon==='bronzeShield'?C.gold:s.weapon==='hugeShield'?C.steel:C.blueHi,{huge:s.weapon==='hugeShield',emblem:true});
    if(s.weapon!=='hugeShield')sword();
  }
  if(s.weapon==='bow'||s.weapon==='longBow'||s.weapon==='silverBow')bow({long:s.weapon==='longBow',silver:s.weapon==='silverBow'});
  if(s.weapon==='crossbow')bow({cross:true});
  if(s.weapon==='knives')knives();
  if(['rifle','steam','electro','starGun'].includes(s.weapon)){
    rifle(s.weapon==='starGun'?C.tealHi:s.weapon==='electro'?C.blueHi:C.steel);
    if(s.weapon==='steam'){R(5,12,5,12,C.ink);R(6,13,3,9,C.gold);R(4,10,2,7,C.steel);R(4,7,4,3,C.shine);}
    if(s.weapon==='electro'){R(26,11,3,3,C.tealHi);R(28,8,2,3,C.shine);R(29,12,3,2,C.tealHi);}
    if(s.weapon==='starGun'){R(9,7,3,4,C.ink);R(10,8,2,3,C.tealHi);}
  }
  if(s.weapon==='roseSpear'||s.weapon==='flameSword')rose(6,14,s.weapon==='roseSpear'?C.red:C.redHi);
}

const riders={
  cavalry:{coat:C.leather,bright:C.gold,horse:C.leather,armor:C.steel,weapon:'lance'},
  cavalry_t1:{coat:C.blue,bright:C.gold,horse:C.leather,armor:C.steel,weapon:'lance'},
  cavalry_wind:{coat:C.green,bright:C.tealHi,horse:C.leather,armor:C.greenHi,weapon:'crossbow'},
  cavalry_iron:{coat:C.dark,bright:C.shine,horse:C.steel,armor:C.steel,weapon:'lance'},
  cavalry_dragon:{coat:C.red,bright:C.goldHi,horse:C.red,armor:C.gold,weapon:'flame'},
  cavalry_teutonic:{coat:C.white,bright:C.gold,horse:C.dark,armor:C.shine,weapon:'banner'},
  gold_cavalry:{coat:C.gold,bright:C.goldHi,horse:C.leather,armor:C.gold,weapon:'lance'},
};
function drawRider(s){
  // Horse silhouette, lowered nose, distinct bridle and two visible legs.
  R(5,19,21,8,C.ink);R(6,20,19,6,s.horse);R(22,16,7,7,C.ink);R(23,17,5,5,s.horse);
  R(26,21,4,2,C.skinShade);px(27,18,C.ink);R(4,17,4,6,C.ink);
  R(7,26,4,5,C.ink);R(8,26,2,4,s.horse);R(20,26,4,5,C.ink);R(21,26,2,4,s.horse);
  R(7,21,16,3,s.armor);R(9,24,10,1,s.bright);
  R(11,8,11,13,C.ink);R(12,9,9,11,s.coat);R(13,11,7,4,s.bright);
  R(13,5,8,6,C.ink);R(14,6,6,5,C.skin);px(19,8,C.ink);
  R(12,3,10,4,C.ink);R(13,4,8,3,s.armor);
  R(20,11,4,6,C.ink);R(21,12,3,5,s.coat);
  if(s.weapon==='crossbow')bow({cross:true});
  if(s.weapon==='flame'){spear(C.goldHi);R(25,0,3,5,C.redHi);R(28,2,3,3,C.goldHi);}
  if(s.weapon==='lance')spear(s.armor);
  if(s.weapon==='banner'){spear(C.shine);R(19,1,9,5,C.ink);R(20,2,7,3,C.white);badge(21,2,C.red);}
}

const mages={
  mage:{robe:C.purple,light:C.purpleHi,orb:C.tealHi,hat:'hood',motif:'diamond'},
  mage_t1:{robe:C.blue,light:C.blueHi,orb:C.tealHi,hat:'cap',motif:'diamond'},
  mage_time:{robe:C.gold,light:C.goldHi,orb:C.cream,hat:'hood',motif:'hourglass'},
  mage_space:{robe:C.purple,light:C.blueHi,orb:C.tealHi,hat:'hood',motif:'portal'},
  arcane_mage:{robe:C.dark,light:C.purpleHi,orb:C.tealHi,hat:'wizard',motif:'rune'},
  mage_chrono:{robe:C.white,light:C.goldHi,orb:C.gold,hat:'crown',motif:'eye'},
  mage_merlin:{robe:C.blue,light:C.white,orb:C.blueHi,hat:'wizard',motif:'star'},
};
function drawMage(s){
  torso(s.robe,s.light,C.gold,{long:true});
  face(C.hair,s.hat==='wizard'?'hair':s.hat);
  if(s.hat==='wizard'){R(10,3,14,4,C.ink);R(11,4,12,2,s.robe);R(13,0,7,5,C.ink);R(14,1,5,4,s.robe);R(17,2,2,2,C.goldHi);}
  staff(s.orb,{orb:s.motif==='eye'});
  if(s.motif==='hourglass')hourglass();
  if(s.motif==='portal'){R(25,1,7,3,C.purpleHi);R(24,7,3,8,C.teal);R(29,8,3,7,C.blueHi);}
  if(s.motif==='eye'){R(13,16,8,5,C.ink);R(14,17,6,3,C.goldHi);R(16,17,2,3,C.blue);}
  if(s.motif==='star'){R(3,6,5,2,C.goldHi);R(5,4,2,6,C.goldHi);R(14,18,5,2,C.white);}
  if(s.motif==='rune'){R(3,5,7,2,C.tealHi);R(5,3,2,7,C.tealHi);R(13,18,7,5,C.ink);R(14,19,5,3,C.purpleHi);R(16,19,1,3,C.tealHi);}
  if(s.motif==='diamond'){R(14,18,4,4,C.teal);R(15,19,2,2,C.tealHi);}
}

function drawMech(kind){
  if(kind==='revival_god'){
    // The self-renewing idol keeps a separate ivory-and-leaf silhouette.
    R(10,1,13,3,C.ink);R(11,2,11,1,C.goldHi);
    R(6,4,4,3,C.ink);R(7,5,3,1,C.gold);
    R(22,4,4,3,C.ink);R(22,5,3,1,C.gold);
    R(11,5,11,10,C.ink);R(12,6,9,8,C.white);
    R(13,9,7,2,C.ink);R(14,9,5,1,C.greenHi);
    R(15,3,3,5,C.ink);R(16,4,1,3,C.greenHi);
    R(7,14,19,12,C.ink);R(8,15,17,10,C.white);
    R(8,16,4,4,C.gold);R(21,16,4,4,C.gold);
    R(12,17,9,7,C.gold);R(13,18,7,5,C.green);
    R(15,18,3,5,C.greenHi);R(16,19,1,3,C.cream);
    R(3,15,6,12,C.ink);R(4,16,4,9,C.white);
    R(24,15,6,12,C.ink);R(25,16,4,9,C.white);
    R(2,23,7,4,C.ink);R(3,23,5,3,C.greenHi);
    R(24,23,7,4,C.ink);R(25,23,5,3,C.greenHi);
    R(9,24,6,7,C.ink);R(10,25,4,5,C.white);
    R(18,24,6,7,C.ink);R(19,25,4,5,C.white);
    R(9,28,6,2,C.gold);R(18,28,6,2,C.gold);
    R(4,13,4,3,C.green);R(5,12,2,5,C.greenHi);
    R(25,12,4,3,C.green);R(26,11,2,5,C.greenHi);
    return;
  }
  const body=kind==='god_crystal_guard'?C.blue:kind==='phantom_god'?C.teal:kind==='guardian_god'?C.steel:C.dark;
  const shine=kind==='slaughter_god'?C.redHi:C.tealHi;
  R(10,4,13,11,C.ink);R(11,5,11,9,body);R(13,8,7,3,shine);
  R(7,14,19,12,C.ink);R(8,15,17,10,body);R(12,17,9,6,C.ink);R(13,18,7,4,shine);
  R(3,15,6,12,C.ink);R(4,16,4,9,body);R(24,15,6,12,C.ink);R(25,16,4,9,body);
  R(9,24,6,7,C.ink);R(10,25,4,5,body);R(18,24,6,7,C.ink);R(19,25,4,5,body);
  if(kind==='god_crystal_guard'){R(13,1,7,4,C.ink);R(14,2,5,2,C.tealHi);shield(C.teal,{huge:true});}
  if(kind==='phantom_god'){R(2,12,5,7,C.tealHi);R(25,10,6,5,C.tealHi);R(12,4,9,2,C.shine);}
  if(kind==='guardian_god'){shield(C.steel,{huge:true});R(23,11,9,4,C.ink);R(24,12,7,2,C.gold);}
  if(kind==='slaughter_god'){R(3,11,8,4,C.ink);R(4,12,6,2,C.red);rifle(C.redHi);R(12,2,9,3,C.red);}
}
function drawDivine(kind){
  if(kind==='soul_wraith'){
    const ink='#262940',armor='#b9afc2',ghost='#6f8fdb',light='#b8e1f3',shade='#4b4d7d';
    R(11,3,12,11,ink);R(12,4,10,9,armor);R(13,8,8,4,ghost);R(14,9,2,1,light);R(19,9,2,1,light);
    R(9,1,5,5,ink);R(10,2,3,3,armor);R(21,1,5,5,ink);R(22,2,3,3,armor);
    R(8,14,17,13,ink);R(9,15,15,11,shade);R(11,16,11,8,armor);R(14,18,5,5,ghost);R(16,19,1,3,light);
    R(5,15,5,11,ink);R(6,16,3,9,armor);R(24,15,5,11,ink);R(25,16,3,9,armor);
    R(7,25,8,5,ink);R(8,26,6,3,ghost);R(18,25,8,5,ink);R(19,26,6,3,ghost);
    R(3,20,4,9,ghost);R(2,25,3,5,light);R(26,20,3,10,ghost);R(28,25,3,5,light);
    R(27,3,3,23,ink);R(28,4,1,20,light);R(24,1,7,4,ghost);R(25,0,5,2,light);
    return;
  }
  if(kind==='silence_god'){
    const deep='#34375f',indigo='#555c91',lilac='#9c9ed0',ivory='#f3ead8',mute='#191d39';
    // Broken mute halo, sealed eyes and an ivory silence sigil.
    R(9,1,14,2,mute);R(11,0,10,2,ivory);
    R(7,3,4,3,mute);R(8,4,2,1,lilac);
    R(22,3,4,3,mute);R(23,4,2,1,lilac);
    R(11,5,11,10,mute);R(12,6,9,8,indigo);
    R(13,8,7,5,ivory);R(13,9,7,2,mute);R(15,11,3,1,lilac);
    R(7,14,19,14,mute);R(8,15,17,12,deep);
    R(10,15,13,3,indigo);R(12,18,9,8,indigo);
    R(14,17,5,8,ivory);R(15,18,3,2,lilac);
    R(16,20,1,4,mute);R(14,22,5,1,mute);
    R(4,16,5,11,mute);R(5,17,3,8,indigo);R(4,24,5,2,ivory);
    R(24,16,5,11,mute);R(25,17,3,8,indigo);R(24,24,5,2,ivory);
    R(9,26,15,4,mute);R(10,26,13,3,indigo);R(10,29,5,2,mute);R(18,29,5,2,mute);
    R(2,12,3,2,lilac);R(27,12,3,2,lilac);
    return;
  }
  if(kind==='trial_guard_easy'){
    const bronze='#8b6044',bright='#ca9861',gold='#f6d08b',ivory='#f6ecdb',turquoise='#4bbcaf',ink='#3b4145';
    // Compact bronze sentry: sun seal, buckler and a short turquoise spear.
    R(11,4,12,9,ink);R(12,5,10,7,bronze);R(13,9,8,4,ivory);
    R(13,3,8,3,bright);R(16,1,2,4,turquoise);px(19,10,ink);
    R(8,14,17,13,ink);R(9,15,15,11,bronze);R(11,16,11,4,ivory);
    R(13,19,7,6,bright);R(16,18,2,8,turquoise);
    R(14,20,6,2,gold);R(16,19,2,5,turquoise);
    R(6,15,5,10,ink);R(7,16,3,8,bright);
    R(23,15,5,10,ink);R(24,16,3,8,bright);
    R(2,17,8,11,ink);R(3,18,6,9,bright);R(4,20,4,5,ivory);
    R(5,21,2,3,turquoise);R(4,25,4,1,gold);
    R(27,6,2,22,ink);R(28,10,1,17,bronze);
    R(26,3,4,6,ink);R(27,4,2,4,turquoise);R(28,2,1,4,ivory);
    R(10,26,6,5,ink);R(11,27,4,3,bronze);
    R(18,26,6,5,ink);R(19,27,4,3,bronze);
    R(11,29,5,2,gold);R(19,29,5,2,gold);
    return;
  }
  if(kind==='trial_guard_perfect'){
    const ink='#37475e',silver='#a9bac9',glint='#eef5ee',cyan='#6ed7de',violet='#8e79bc',dark='#647696';
    // Mirror guard: split reflection on the breastplate and crescent blade.
    R(11,4,12,9,ink);R(12,5,10,7,silver);R(14,9,7,4,glint);
    R(13,3,8,3,glint);R(16,1,2,5,cyan);R(18,9,2,2,violet);
    R(8,14,17,13,ink);R(9,15,15,11,dark);R(11,15,11,3,silver);
    R(12,18,9,7,silver);R(13,19,3,5,cyan);R(17,19,3,5,violet);
    R(16,18,1,7,glint);R(6,15,5,10,ink);R(7,16,3,8,silver);
    R(23,15,5,10,ink);R(24,16,3,8,silver);
    R(2,14,9,14,ink);R(3,15,7,11,silver);R(4,17,5,7,glint);
    R(4,17,2,6,cyan);R(7,21,2,3,violet);R(5,25,4,1,dark);
    R(28,9,2,20,ink);R(29,14,1,14,violet);
    R(25,5,5,3,ink);R(26,6,5,2,glint);
    R(23,7,3,7,ink);R(24,8,2,5,cyan);
    R(26,13,5,2,glint);R(27,12,4,1,cyan);
    R(10,26,6,5,ink);R(11,27,4,3,silver);
    R(18,26,6,5,ink);R(19,27,4,3,silver);
    R(11,29,5,2,cyan);R(19,29,5,2,violet);
    return;
  }
  if(kind==='trial_guard_extreme'){
    const ink='#221f2b',bronze='#674638',edge='#b37954',crimson='#bc3a48',fire='#ee6c59',ivory='#f3debc';
    // Horned asura with four arm plates and twin opposed short blades.
    R(10,4,13,10,ink);R(11,5,11,8,bronze);
    R(8,1,4,7,ink);R(9,1,2,5,edge);
    R(22,1,4,7,ink);R(23,1,2,5,edge);
    R(12,8,9,4,ink);R(13,9,3,2,fire);R(18,9,3,2,fire);
    R(8,14,17,13,ink);R(9,15,15,11,bronze);
    R(10,15,13,3,edge);R(12,18,9,8,ink);
    R(14,18,5,7,crimson);R(15,19,3,5,fire);
    R(4,14,7,7,ink);R(5,15,5,5,bronze);
    R(22,14,7,7,ink);R(23,15,5,5,bronze);
    R(5,21,5,6,ink);R(6,22,3,4,edge);
    R(24,21,5,6,ink);R(25,22,3,4,edge);
    R(2,7,3,18,ink);R(3,8,1,14,ivory);
    R(1,6,5,3,crimson);R(2,5,3,2,fire);
    R(27,8,3,18,ink);R(28,9,1,14,ivory);
    R(26,7,5,3,crimson);R(27,6,3,2,fire);
    R(9,26,7,5,ink);R(10,27,5,3,bronze);
    R(18,26,7,5,ink);R(19,27,5,3,bronze);
    R(9,29,7,2,edge);R(18,29,7,2,edge);
    R(1,16,2,3,crimson);R(29,16,2,3,crimson);
  }
}
function drawBeast(kind){
  if(kind==='wild_snake'){R(4,23,22,5,C.ink);R(5,24,20,3,C.green);R(14,17,10,8,C.ink);R(15,18,8,6,C.greenHi);R(20,9,8,10,C.ink);R(21,10,6,8,C.green);R(25,8,5,5,C.ink);R(26,9,4,3,C.greenHi);px(27,10,C.goldHi);R(27,15,4,1,C.red);return;}
  if(kind==='wild_turtle'){R(5,18,23,10,C.ink);R(7,19,18,7,C.green);R(10,9,16,14,C.ink);R(11,10,14,12,C.greenHi);R(13,12,4,8,C.green);R(18,11,4,8,C.green);R(24,18,7,6,C.ink);R(25,19,5,4,C.greenHi);px(28,20,C.ink);R(7,27,5,4,C.ink);R(20,27,5,4,C.ink);return;}
  if(kind==='wild_wyrm'){R(4,23,18,5,C.ink);R(5,24,16,3,C.blue);R(13,18,13,8,C.ink);R(14,19,11,6,C.teal);R(20,9,9,12,C.ink);R(21,10,7,10,C.blueHi);R(25,6,5,8,C.ink);R(26,7,3,6,C.tealHi);R(17,8,4,11,C.shine);R(5,27,5,3,C.ink);R(15,27,5,3,C.ink);px(27,11,C.ink);return;}
  const bull=kind==='wild_bull',tiger=kind==='wild_tiger';
  const fur=tiger?C.gold:bull?C.leather:C.leatherHi;
  R(6,16,21,11,C.ink);R(7,17,19,9,fur);R(10,12,15,9,C.ink);R(11,13,13,7,tiger?C.goldHi:fur);
  R(21,11,9,11,C.ink);R(22,12,7,9,fur);R(25,20,6,3,C.ink);R(26,21,4,1,C.skin);
  R(8,25,4,6,C.ink);R(20,25,4,6,C.ink);
  R(7,11,5,5,C.ink);R(21,8,4,6,C.ink);
  if(bull){R(19,5,4,10,C.cream);R(27,5,4,10,C.cream);R(13,17,5,4,C.leatherHi);}
  if(tiger){R(9,17,3,9,C.ink);R(16,15,3,10,C.ink);R(22,15,3,8,C.ink);R(23,9,3,5,C.goldHi);}
  if(kind==='wild_boar'){R(28,19,4,3,C.cream);R(11,12,3,4,C.leather);}
  px(26,15,C.ink);
}
function drawDummy(){
  R(14,4,4,26,C.ink);R(15,5,2,24,C.leather);
  R(7,8,18,19,C.ink);R(8,9,16,17,C.leatherHi);
  R(10,11,12,13,C.cream);R(12,13,8,9,C.red);
  R(14,15,4,5,C.cream);R(11,26,10,3,C.ink);
  R(8,29,16,2,C.leather);
}

const specs={...humans,...riders,...mages,
  dummy:{type:'dummy'},
  god_crystal_guard:{type:'mech'},phantom_god:{type:'mech'},guardian_god:{type:'mech'},revival_god:{type:'mech'},slaughter_god:{type:'mech'},
  silence_god:{type:'divine'},trial_guard_easy:{type:'divine'},
  trial_guard_perfect:{type:'divine'},trial_guard_extreme:{type:'divine'},soul_wraith:{type:'divine'},
  wild_boar:{type:'beast'},wild_bull:{type:'beast'},wild_snake:{type:'beast'},
  wild_tiger:{type:'beast'},wild_turtle:{type:'beast'},wild_wyrm:{type:'beast'}};
const onlyUnitsFlag=process.argv.indexOf('--only-units');
const onlyUnits=onlyUnitsFlag<0?null:new Set((process.argv[onlyUnitsFlag+1]||'').split(',').filter(Boolean));
if(onlyUnits){
  if(!onlyUnits.size||[...onlyUnits].some(key=>!Object.hasOwn(specs,key)))
    throw Error('--only-units requires a comma-separated list of existing unit IDs');
}

function crc32(bytes){
  let crc=-1;
  for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^(-(crc&1)&0xedb88320);}
  return (crc^(-1))>>>0;
}
function chunk(type,data){
  const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);
  len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));
  return Buffer.concat([len,t,data,crc]);
}
function png(pixels,w,h){
  const rows=Buffer.alloc(h*(w*4+1));let p=0;
  for(let y=0;y<h;y++){rows[p++]=0;for(let x=0;x<w;x++){const c=pixels[y*w+x]||[0,0,0,0];for(let i=0;i<4;i++)rows[p++]=c[i];}}
  const header=Buffer.alloc(13);header.writeUInt32BE(w,0);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
function color(hex){
  if(hex.length===4)hex='#'+hex.slice(1).split('').map(c=>c+c).join('');
  return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),255];
}
function raster(source,w=32,h=32,offset=0){
  const data=Array.from({length:w*h},()=>[0,0,0,0]);
  for(const [x,y,rw,rh,c] of source){
    const rgba=color(c);
    for(let yy=Math.max(0,y);yy<Math.min(32,y+rh);yy++)for(let xx=Math.max(0,x);xx<Math.min(32,x+rw);xx++)data[yy*w+xx+offset]=rgba;
  }
  return data;
}
const transparent=()=>[0,0,0,0];
const emptyFrame=()=>Array.from({length:32*32},transparent);
function setAt(frame,x,y,rgba){if(x>=0&&x<32&&y>=0&&y<32)frame[y*32+x]=rgba;}
function paint(frame,x,y,w,h,hex){
  const rgba=color(hex);
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)setAt(frame,xx,yy,rgba);
}
function projectFrame(base,{dx=0,dy=0,upperOnly=false,angle=0,hit=false,fade=1}={}){
  const frame=emptyFrame(),rad=angle*Math.PI/180;
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const pixel=base[y*32+x];
    if(pixel[3]===0)continue;
    let tx=x+dx,ty=y+dy;
    if(upperOnly&&y>=24){tx=x;ty=y;}
    if(angle){const ox=x-6,oy=y-21;tx=Math.round(6+ox*Math.cos(rad)-oy*Math.sin(rad));ty=Math.round(21+ox*Math.sin(rad)+oy*Math.cos(rad));}
    const rgba=hit?[Math.min(255,Math.round(pixel[0]*.52+125)),Math.round(pixel[1]*.45),Math.round(pixel[2]*.45),pixel[3]]:[...pixel];
    rgba[3]=Math.round(rgba[3]*fade);
    setAt(frame,tx,ty,rgba);
  }
  return frame;
}
function attackAccent(frame,key,phase){
  if(phase<1||phase>2)return;
  if(key==='silence_god'){
    paint(frame,25,10,3,12,'#9c9ed0');paint(frame,27,12,3,8,'#f3ead8');
    paint(frame,23,15,2,3,'#555c91');return;
  }
  if(key==='trial_guard_easy'){
    paint(frame,26,9,5,3,'#4bbcaf');paint(frame,27,12,3,3,'#f6d08b');return;
  }
  if(key==='trial_guard_perfect'){
    paint(frame,25,5,5,2,'#6ed7de');paint(frame,23,8,3,9,'#eef5ee');
    paint(frame,28,15,3,2,'#8e79bc');return;
  }
  if(key==='trial_guard_extreme'){
    for(let i=0;i<8;i++){
      paint(frame,1+i,8+i,2,2,'#ee6c59');
      paint(frame,29-i,8+i,2,2,'#bc3a48');
    }
    return;
  }
  const rider=Object.hasOwn(riders,key),mage=Object.hasOwn(mages,key);
  const archer=key.startsWith('archer'),beast=key.startsWith('wild_');
  const mech=['god_crystal_guard','phantom_god','guardian_god','revival_god','slaughter_god'].includes(key);
  const c=mage?C.purpleHi:mech?C.tealHi:archer?C.goldHi:rider?C.gold:C.shine;
  if(mage){paint(frame,25,8,5,5,c);paint(frame,27,10,2,2,C.white);paint(frame,23,11,2,2,C.tealHi);}
  else if(archer){paint(frame,23,13,8,2,C.ink);paint(frame,24,13,6,1,c);paint(frame,28,11,3,6,C.white);}
  else if(beast){paint(frame,24,14,8,3,c);paint(frame,27,12,3,8,C.goldHi);}
  else {for(let i=0;i<10;i++)paint(frame,21+i,7+i,2,2,c);paint(frame,27,8,4,2,C.white);}
  if(rider||beast){paint(frame,3,27,4,2,C.sandLight);paint(frame,7,29,5,1,C.cream);}
}
function animationFrame(base,key,action,frame){
  if(action==='idle'){
    return projectFrame(base,frame===1?{dy:-1,upperOnly:true}:frame===2?{dx:1,upperOnly:true}:frame===3?{dx:-1,dy:-1,upperOnly:true}:{});
  }
  if(action==='attack'){
    const pose=projectFrame(base,frame===1?{dx:1,dy:-1}:frame===2?{dx:3,dy:-1}:frame===3?{dx:1}:{});attackAccent(pose,key,frame);return pose;
  }
  if(action==='hit'){
    const pose=projectFrame(base,frame===1?{dx:-2,dy:1,hit:true}:frame===2?{dx:-3,dy:2,hit:true}:frame===3?{dx:-1,hit:true,fade:.82}:{});
    if(frame===1||frame===2){paint(pose,20,5,3,5,C.redHi);paint(pose,18,7,7,2,C.cream);}
    return pose;
  }
  const pose=projectFrame(base,frame===1?{angle:17}:frame===2?{angle:45,hit:true}:frame===3?{angle:75,fade:.78}:{});
  if(frame===3)paint(pose,5,30,23,1,C.shadow);
  return pose;
}
function animationSheet(source,key,action){
  const base=raster(source),width=128,cells=Array.from({length:width*32},transparent);
  for(let f=0;f<4;f++){
    const frame=animationFrame(base,key,action,f);
    for(let y=0;y<32;y++)for(let x=0;x<32;x++)cells[y*width+f*32+x]=frame[y*32+x];
  }
  return png(cells,width,32);
}
function pngScale(source,scale){
  const input=raster(source),size=32*scale;
  const cells=Array.from({length:size*size},()=>[0,0,0,0]);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)cells[y*size+x]=input[Math.floor(y/scale)*32+Math.floor(x/scale)];
  return png(cells,size,size);
}

// Building silhouettes are grouped by purpose, then given an individual
// landmark: e.g. granary silo, mint press, library shelves, mine headframe.
const buildings={
  town_hall:{kind:'hall',wall:C.cream,roof:C.red,detail:C.gold},
  lumber_mill:{kind:'workshop',wall:C.leatherHi,roof:C.green,detail:C.leather},
  lumber_yard:{kind:'workshop',wall:C.leatherHi,roof:C.green,detail:C.leather},
  quarry:{kind:'mine',wall:C.steel,roof:C.blue,detail:C.cream},
  quarry_yard:{kind:'mine',wall:C.steel,roof:C.blue,detail:C.cream},
  farm:{kind:'farm',wall:C.cream,roof:C.red,detail:C.gold},
  farm_yard:{kind:'farm',wall:C.cream,roof:C.red,detail:C.gold},
  barracks:{kind:'camp',wall:C.cream,roof:C.red,detail:C.gold},
  watch_tower:{kind:'tower',wall:C.leatherHi,roof:C.red,detail:C.gold},
  arrow_tower:{kind:'tower',wall:C.steel,roof:C.blue,detail:C.shine},
  infantry_camp:{kind:'camp',wall:C.leatherHi,roof:C.blue,detail:C.steel},
  archer_range:{kind:'camp',wall:C.cream,roof:C.green,detail:C.leather},
  stable:{kind:'stable',wall:C.leatherHi,roof:C.red,detail:C.gold},
  mage_tower:{kind:'tower',wall:C.purpleHi,roof:C.purple,detail:C.tealHi},
  academy:{kind:'hall',wall:C.cream,roof:C.blue,detail:C.teal},
  library:{kind:'hall',wall:C.leatherHi,roof:C.red,detail:C.gold},
  institute:{kind:'hall',wall:C.shine,roof:C.blue,detail:C.tealHi},
  warehouse:{kind:'store',wall:C.leatherHi,roof:C.blue,detail:C.gold},
  stone_store:{kind:'store',wall:C.steel,roof:C.blue,detail:C.shine},
  large_granary:{kind:'silo',wall:C.leatherHi,roof:C.gold,detail:C.cream},
  coal_mine:{kind:'mine',wall:C.dark,roof:C.steel,detail:C.ink},
  mine:{kind:'mine',wall:C.leatherHi,roof:C.gold,detail:C.leather},
  copper_furnace:{kind:'furnace',wall:C.leather,roof:C.red,detail:C.goldHi},
  smelter:{kind:'furnace',wall:C.steel,roof:C.blue,detail:C.goldHi},
  coal_store:{kind:'store',wall:C.dark,roof:C.steel,detail:C.ink},
  copper_store:{kind:'store',wall:C.leather,roof:C.red,detail:C.gold},
  iron_store:{kind:'store',wall:C.steel,roof:C.dark,detail:C.shine},
  silver_store:{kind:'store',wall:C.shine,roof:C.blue,detail:C.white},
  gold_store:{kind:'store',wall:C.gold,roof:C.leather,detail:C.goldHi},
  steel_store:{kind:'store',wall:C.blue,roof:C.dark,detail:C.shine},
  silver_refinery:{kind:'furnace',wall:C.shine,roof:C.blue,detail:C.white},
  gold_refinery:{kind:'furnace',wall:C.gold,roof:C.leather,detail:C.goldHi},
  steel_refinery:{kind:'furnace',wall:C.blue,roof:C.dark,detail:C.shine},
  mint:{kind:'mint',wall:C.cream,roof:C.gold,detail:C.goldHi},
  market:{kind:'market',wall:C.cream,roof:C.red,detail:C.gold},
  bronze_workshop:{kind:'workshop',wall:C.leatherHi,roof:C.red,detail:C.gold},
  iron_forge:{kind:'workshop',wall:C.steel,roof:C.dark,detail:C.shine},
  silver_armory:{kind:'armory',wall:C.shine,roof:C.blue,detail:C.white},
  gold_armory:{kind:'armory',wall:C.gold,roof:C.leather,detail:C.goldHi},
  alloy_armory:{kind:'armory',wall:C.blue,roof:C.teal,detail:C.shine},
  steam_armory:{kind:'armory',wall:C.steel,roof:C.leather,detail:C.gold},
  electric_armory:{kind:'armory',wall:C.blue,roof:C.dark,detail:C.tealHi},
};
function drawBuilding(key,s){
  R(2,28,28,2,C.ink);R(4,27,24,2,C.leatherHi);
  if(s.kind==='tower'){
    R(10,6,13,23,C.ink);R(11,7,11,21,s.wall);
    R(8,5,17,4,C.ink);R(9,6,15,2,s.roof);
    for(const x of [9,15,21])R(x,2,3,5,C.ink);
    R(14,18,5,10,C.ink);R(15,19,3,9,C.dark);
    R(12,11,3,4,C.ink);R(18,11,3,4,C.ink);
    R(25,3,2,13,C.ink);R(26,4,1,10,C.gold);R(27,4,4,4,s.roof);
    if(key==='mage_tower'){R(14,0,4,5,s.detail);badge(15,12,s.detail);}
    return;
  }
  if(s.kind==='mine'){
    R(3,19,26,10,C.ink);R(4,20,24,8,s.wall);
    R(8,16,17,7,s.roof);R(11,22,11,7,C.ink);R(12,23,9,6,C.dark);
    R(7,7,3,15,C.ink);R(23,7,3,15,C.ink);R(7,6,19,3,C.leather);
    R(13,7,4,9,C.ink);R(14,9,2,5,s.detail);
    if(key==='coal_mine'){R(3,25,5,4,C.ink);R(25,25,4,4,C.ink);}
    if(key==='mine'){R(23,18,5,4,C.gold);R(5,21,4,3,C.goldHi);}
    return;
  }
  if(s.kind==='silo'){
    R(6,11,20,18,C.ink);R(7,12,18,16,s.wall);
    R(8,7,16,6,C.ink);R(9,8,14,5,s.roof);
    R(14,2,4,8,C.ink);R(15,3,2,6,s.detail);
    R(12,19,8,10,C.ink);R(13,20,6,8,C.leather);
    R(9,16,14,2,s.detail);return;
  }
  if(s.kind==='market'){
    R(3,9,26,6,C.ink);R(4,10,24,4,s.roof);
    for(const x of [5,11,17,23])R(x,10,4,4,C.cream);
    R(5,15,3,13,C.leather);R(24,15,3,13,C.leather);
    R(8,20,16,8,C.ink);R(9,21,14,6,s.wall);
    R(11,19,10,4,s.detail);R(12,16,3,4,C.gold);R(18,16,3,4,C.green);
    return;
  }
  if(s.kind==='farm'){
    R(4,20,24,9,C.ink);R(5,21,22,7,s.wall);
    R(11,9,18,5,C.ink);R(12,10,16,3,s.roof);R(13,14,13,7,s.wall);
    R(17,21,6,8,C.ink);R(18,22,4,6,C.leather);
    for(const x of [5,9,13]){R(x,14,2,12,C.green);R(x-1,13,4,3,C.goldHi);}
    return;
  }
  if(s.kind==='camp'){
    R(4,17,24,11,C.ink);R(5,18,22,9,s.wall);
    R(9,10,15,9,C.ink);R(10,11,13,7,s.roof);
    R(15,18,5,10,C.ink);R(16,19,3,9,C.dark);
    R(4,5,2,16,C.ink);R(5,6,1,14,C.leather);R(6,6,7,5,s.roof);
    if(key==='archer_range')bow({long:true});
    if(key==='infantry_camp'){R(26,5,2,17,C.steel);R(25,6,4,3,C.shine);}
    return;
  }
  if(s.kind==='stable'){
    R(3,16,26,13,C.ink);R(4,17,24,11,s.wall);
    R(5,10,22,8,C.ink);R(6,11,20,6,s.roof);
    R(11,20,10,9,C.ink);R(12,21,8,8,C.leather);
    R(23,20,3,4,C.ink);R(7,21,3,4,C.ink);
    R(16,19,5,3,C.goldHi);return;
  }
  if(s.kind==='furnace'||s.kind==='workshop'||s.kind==='armory'){
    R(4,15,24,14,C.ink);R(5,16,22,12,s.wall);
    R(7,11,18,6,C.ink);R(8,12,16,4,s.roof);
    R(21,3,5,15,C.ink);R(22,4,3,13,s.roof);R(21,2,6,3,C.shine);
    R(11,21,10,8,C.ink);R(12,22,8,7,C.dark);
    if(s.kind==='furnace'){R(13,20,6,6,s.detail);R(14,23,4,5,C.goldHi);}
    if(s.kind==='workshop'){R(5,20,7,3,s.detail);R(6,23,4,4,C.leather);}
    if(s.kind==='armory'){R(11,19,10,3,s.detail);R(15,5,3,12,C.steel);R(13,10,7,2,C.shine);}
    if(key==='electric_armory'){R(24,6,4,3,C.tealHi);R(27,4,2,5,C.shine);}
    if(key==='steam_armory'){R(25,4,3,4,C.cream);R(27,1,3,3,C.shine);}
    return;
  }
  // Hall, stores, and mint keep a common civic roofline but distinct fronts.
  R(4,13,24,16,C.ink);R(5,14,22,14,s.wall);
  R(3,10,26,5,C.ink);R(4,11,24,3,s.roof);
  R(7,7,18,5,C.ink);R(8,8,16,3,s.roof);
  if(s.kind==='hall'){
    R(13,19,7,10,C.ink);R(14,20,5,8,C.leather);
    R(7,17,4,6,C.ink);R(22,17,4,6,C.ink);
    R(8,18,2,4,s.detail);R(23,18,2,4,s.detail);
    if(key==='town_hall'){R(14,2,5,8,C.ink);R(15,3,3,6,C.cream);R(16,4,1,3,C.gold);}
    if(key==='academy'){R(14,2,5,7,s.detail);R(15,0,3,5,C.shine);}
    if(key==='library'){R(11,18,3,7,C.red);R(18,18,3,7,C.blue);}
    if(key==='institute'){R(15,3,3,7,C.tealHi);R(13,4,7,2,C.shine);}
  }else if(s.kind==='mint'){
    R(11,19,10,10,C.ink);R(12,20,8,8,C.gold);
    R(15,21,2,6,C.goldHi);R(13,23,6,2,C.goldHi);
    R(23,5,3,7,C.ink);R(24,6,1,6,C.goldHi);
  }else {
    R(10,19,12,10,C.ink);R(11,20,10,8,C.leather);
    R(13,22,6,4,s.detail);R(6,18,4,5,C.ink);R(7,19,2,3,s.detail);
    R(23,18,4,5,C.ink);R(24,19,2,3,s.detail);
    if(key==='warehouse'){R(13,3,5,7,C.gold);}
  }
}
function drawVfx(key){
  if(key==='swordqi'){
    for(let i=0;i<21;i++){R(3+i,26-i,3,2,C.ink);R(4+i,25-i,2,1,C.shine);}
    R(21,4,6,3,C.tealHi);R(24,2,5,2,C.cream);R(1,26,5,3,C.blueHi);
  }
  if(key==='arrow'){
    R(2,14,23,3,C.ink);R(3,15,20,1,C.leatherHi);
    R(22,11,8,9,C.ink);R(24,13,6,5,C.goldHi);
    R(4,10,3,4,C.white);R(5,17,3,4,C.white);
  }
  if(key==='thrust'){
    R(2,15,21,3,C.ink);R(3,16,19,1,C.leatherHi);
    R(19,11,11,11,C.ink);R(21,13,10,7,C.shine);
    R(25,14,6,5,C.cream);R(4,10,9,2,C.goldHi);R(3,21,7,2,C.goldHi);
  }
  if(key==='cavslash'){
    for(let i=0;i<17;i++){R(5+i,7+i,3,2,C.ink);R(6+i,6+i,2,2,C.tealHi);}
    R(5,5,8,3,C.white);R(19,23,8,4,C.blueHi);R(25,25,5,2,C.cream);
  }
  if(key==='magebolt'){
    R(7,12,18,12,C.ink);R(8,13,16,10,C.purple);
    R(11,15,10,6,C.purpleHi);R(14,17,5,3,C.white);
    R(4,16,4,3,C.tealHi);R(24,14,6,3,C.tealHi);
    R(15,7,3,6,C.tealHi);R(16,23,3,6,C.tealHi);
  }
}
const manifest={version:2,license:'Original project art',logicalSize:[32,32],
  animationFrames:4,animations:{idle:{frames:4,frameDurationMs:300,loop:true},
    attack:{frames:4,frameDurationMs:90,loop:false},
    hit:{frames:4,frameDurationMs:100,loop:false},
    death:{frames:4,frameDurationMs:150,loop:false}},sprites:{}};
const atlasSources={};
for(const [key,spec] of Object.entries(specs)){
  if(onlyUnits&&!onlyUnits.has(key))continue;
  rects.length=0;
  if(spec.type==='mech')drawMech(key);
  else if(spec.type==='divine')drawDivine(key);
  else if(spec.type==='beast')drawBeast(key);
  else if(spec.type==='dummy')drawDummy();
  else if(Object.hasOwn(riders,key))drawRider(spec);
  else if(Object.hasOwn(mages,key))drawMage(spec);
  else drawHuman(spec);
  const art=rects.map(r=>[...r]);
  atlasSources['unit:'+key]=art;
  writeFileSync(join(outDir,key+'.png'),png(raster(art),32,32));
  for(const action of Object.keys(manifest.animations))
    writeFileSync(join(outDir,key+'-'+action+'.png'),animationSheet(art,key,action));
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges">'+art.map(([x,y,w,h,c])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('')+'</svg>';
  writeFileSync(join(svgDir,key+'.svg'),svg);
  manifest.sprites[key]={png:'units/'+key+'.png',
    idleSheet:'units/'+key+'-idle.png',attackSheet:'units/'+key+'-attack.png',
    hitSheet:'units/'+key+'-hit.png',deathSheet:'units/'+key+'-death.png',
    source:'source/units/'+key+'.svg',category:spec.type|| (Object.hasOwn(riders,key)?'rider':Object.hasOwn(mages,key)?'mage':'humanoid')};
}
if(onlyUnits){
  console.log('Generated only '+[...onlyUnits].join(', '));
  process.exit(0);
}
manifest.buildings={};
for(const [key,spec] of Object.entries(buildings)){
  rects.length=0;drawBuilding(key,spec);
  const art=rects.map(r=>[...r]);
  atlasSources['building:'+key]=art;
  writeFileSync(join(buildingDir,key+'.png'),png(raster(art),32,32));
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges">'+art.map(([x,y,w,h,c])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('')+'</svg>';
  writeFileSync(join(buildingSvgDir,key+'.svg'),svg);
  manifest.buildings[key]={png:'buildings/'+key+'.png',source:'source/buildings/'+key+'.svg',category:spec.kind};
  if(['town_hall','lumber_yard','quarry_yard','farm_yard','watch_tower','arrow_tower','mine','smelter','mint','market','academy','barracks'].includes(key)){
    writeFileSync(join(mapDir,key+'.png'),pngScale(art,2));
    manifest.buildings[key].mapPng='map/'+key+'.png';
  }
}
manifest.vfx={};
for(const key of ['swordqi','arrow','thrust','cavslash','magebolt']){
  rects.length=0;drawVfx(key);
  const art=rects.map(r=>[...r]);
  writeFileSync(join(vfxDir,key+'.png'),png(raster(art),32,32));
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges">'+art.map(([x,y,w,h,c])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('')+'</svg>';
  writeFileSync(join(vfxSvgDir,key+'.svg'),svg);
  manifest.vfx[key]={png:'vfx/'+key+'.png',source:'source/vfx/'+key+'.svg'};
}
// Daytime terrain tile for the DOM fallback and WebGL scene.
const terrain=Array.from({length:64*64},()=>color('#b9ce91'));
for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  const id=y*64+x;
  const road=Math.abs((y-35)-(x-32)*0.16)<10;
  const n=(x*73+y*97+x*y*13)%23;
  terrain[id]=color(road?(n<5?'#d5bd91':n<12?'#decaa2':'#ead7b1'):(n<5?'#9dbb80':n<12?'#b4ca8a':'#c3d69a'));
}
writeFileSync(join(mapDir,'terrain.png'),png(terrain,64,64));
manifest.terrain={png:'map/terrain.png',size:[64,64]};
// Original sunlit battle horizon: layered ruins, hazy hills, flags and
// granular sand. The foreground remains in 3D; this billboard sits behind it.
const backW=256,backH=96,backdrop=Array.from({length:backW*backH},transparent);
const backSet=(x,y,hex)=>{if(x>=0&&x<backW&&y>=0&&y<backH)backdrop[y*backW+x]=color(hex);};
const backRect=(x,y,w,h,hex)=>{
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)backSet(xx,yy,hex);
};
for(let y=0;y<backH;y++)for(let x=0;x<backW;x++){
  const noise=(x*97+y*131+x*y*7)%31;
  let r=205+Math.round(y*.28),g=220+Math.round(y*.13),b=216-Math.round(y*.22);
  if(y>55){r=226;g=218;b=186;}
  if(y>74){r=215;g=193;b=146;}
  if(noise<4){r+=3;g+=2;b+=1;}
  const sun=Math.max(0,1-Math.hypot((x-155)/105,(y-20)/60));
  r=Math.min(255,Math.round(r+sun*17));g=Math.min(255,Math.round(g+sun*12));b=Math.min(255,Math.round(b+sun*8));
  backdrop[y*backW+x]=[r,g,b,255];
}
for(let x=0;x<backW;x++){
  const ridge=55+Math.round(4*Math.sin(x*.07)+3*Math.sin(x*.16));
  for(let y=ridge;y<72;y++)backSet(x,y,(x*11+y*3)%7===0?'#aab3a4':'#b4bba8');
}
// Far town: irregular low roofs, bell towers and warm windows.
for(const [x,w,h] of [[8,13,13],[24,17,20],[43,11,11],[59,21,16],[84,14,23],[102,19,13],[124,15,19],
  [144,11,12],[164,20,21],[189,15,13],[208,19,17],[233,14,11]]){
  backRect(x,68-h,w,h,'#a8aaa0');backRect(x+2,65-h,w-4,3,'#929e97');
  if(h>18){backRect(x+Math.floor(w/2)-2,62-h,4,7,'#97a49d');}
  for(let yy=70-h;yy<65;yy+=6)for(let xx=x+3;xx<x+w-2;xx+=6)backRect(xx,yy,2,2,'#d2c29e');
}
// Atmospheric veil softens the city while preserving the pixel forms.
for(let y=62;y<76;y++)for(let x=0;x<backW;x++){
  const p=backdrop[y*backW+x],veil=(y-62)/27;
  backdrop[y*backW+x]=[
    Math.round(p[0]*(1-veil)+227*veil),
    Math.round(p[1]*(1-veil)+218*veil),
    Math.round(p[2]*(1-veil)+189*veil),255];
}
for(let x=0;x<backW;x++){
  const dune=77+Math.round(5*Math.sin(x*.033)+2*Math.sin(x*.13));
  for(let y=dune;y<backH;y++){
    const n=(x*37+y*53)%19;
    backSet(x,y,n<3?'#bea170':n<9?'#cfb47f':'#ddc28c');
  }
}
for(const [x,y,w,h] of [[4,77,20,5],[19,80,10,8],[217,72,29,10],[226,79,24,11],[198,84,20,4]]){
  backRect(x,y,w,h,'#9f9475');backRect(x+2,y+1,w-4,2,'#c2b38c');
}
for(const [x,y] of [[43,80],[58,77],[115,82],[137,79],[181,81],[204,76]]){
  backRect(x,y,2,8,'#5f6f58');backRect(x-4,y+3,11,3,'#728965');backRect(x-2,y,6,3,'#879971');
}
for(const [x,c] of [[36,'#b86453'],[182,'#668b9c']]){
  backRect(x,47,2,34,'#544f42');backRect(x+2,48,10,5,c);backRect(x+8,51,4,3,c);
}
for(let i=0;i<55;i++){
  const x=(i*73+17)%backW,y=82+(i*11)%13;
  backRect(x,y,2+(i%3),1,i%2?'#efe0ae':'#af956d');
}
writeFileSync(join(mapDir,'battle-backdrop.png'),png(backdrop,backW,backH));
manifest.battleBackdrop={png:'map/battle-backdrop.png',size:[backW,backH],style:'sunlit desert frontier'};
manifest.modelManifest='models/manifest.json';
// Image-generation masters and their optimized runtime files are maintained
// separately; record them here so rebuilding pixel assets preserves cataloging.
manifest.primaryUiAtlas={
  png:'ui/primary-atlas.png',size:[1774,887],grid:[4,2],
  order:['home','build','tech','army','battle','wood','stone','food'],
  sourceNotes:'source/generated/PROMPTS.md',runtimeStyle:'../../visual.css'
};
manifest.sceneTextures={
  town:{png:'scene/town-daylight.png',size:[1024,525],
    master:'source/generated/town-daylight-master.png',masterSize:[1751,898]},
  battle:{png:'scene/battle-daylight.png',size:[768,1152],
    master:'source/generated/battle-daylight-master.png',masterSize:[1024,1536]},
  battleNight:{png:'scene/battle-night.png',size:[768,1152],
    master:'source/generated/battle-night-master.png',masterSize:[1024,1536]}
};
manifest.sceneOptimizer='scene/optimize.py';
manifest.highResUnitStills=Object.fromEntries(
  ['infantry','archer','cavalry','spearman','mage','enemy'].map(key=>[
    key,{png:`units/hires/${key}.png`,size:[512,512],
      master:`source/generated/units/${key}-master.png`,masterSize:[1254,1254]}
  ])
);
manifest.highResOptimizer='units/hires/optimize.ps1';
manifest.highResPromptNotes='source/generated/units/PROMPTS.md';
// Runtime UI icons are authored directly in sprites.js. Export a compact
// PNG atlas for renderer use without adding a build tool to the game itself.
const spriteJs=readFileSync(join(root,'..','..','sprites.js'),'utf8');
const uiSprites=runInNewContext(spriteJs+'\nPIX_SPRITES');
for(const [key,art] of Object.entries(uiSprites))atlasSources['ui:'+key]=art;
const atlasKeys=Object.keys(atlasSources).sort();
const columns=16,rows=Math.ceil(atlasKeys.length/columns);
const atlasWidth=columns*32,atlasHeight=rows*32;
const atlasPixels=Array.from({length:atlasWidth*atlasHeight},()=>[0,0,0,0]);
manifest.atlas={png:'atlas.png',tileSize:[32,32],size:[atlasWidth,atlasHeight],entries:{}};
atlasKeys.forEach((key,i)=>{
  const [col,row]=[i%columns,Math.floor(i/columns)];
  const pixels=raster(atlasSources[key]);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++)atlasPixels[(row*32+y)*atlasWidth+col*32+x]=pixels[y*32+x];
  manifest.atlas.entries[key]=[col*32,row*32,32,32];
});
writeFileSync(join(root,'atlas.png'),png(atlasPixels,atlasWidth,atlasHeight));
writeFileSync(join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const gallery=(title,items,path)=>`<section><h2>${title} <small>${items.length}</small></h2><div class="gallery">${items.map(key=>`<figure><img src="${path}/${key}.png" alt=""><figcaption>${key}</figcaption></figure>`).join('')}</div></section>`;
const actionSamples=['idle','attack','hit','death'].map(a=>`<figure><img src="units/infantry_sword-${a}.png" alt=""><figcaption>infantry_sword · ${a} · 4 frames</figcaption></figure>`).join('');
const preview=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>放置帝国 · 原创美术图鉴</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f5ecd8;color:#263743;font:14px/1.5 system-ui,sans-serif}header{padding:24px clamp(16px,5vw,60px);background:#e7d7b8;border-bottom:4px solid #9b8061}h1{margin:0;font-size:26px}p{margin:6px 0 0}main{max-width:1200px;margin:auto;padding:0 20px 40px}h2{font-size:20px;margin:30px 0 10px;border-bottom:2px solid #cfba99;padding-bottom:6px}small{color:#647b82}.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(116px,1fr));gap:10px}figure{margin:0;background:#fffaf0;border:1px solid #ccb99d;border-radius:8px;min-width:0;text-align:center;padding:10px 4px}img{width:72px;height:72px;object-fit:contain;image-rendering:pixelated}figcaption{font:11px/1.3 ui-monospace,monospace;overflow-wrap:anywhere;margin-top:8px}.sample{display:flex;flex-wrap:wrap;gap:12px}.sample figure{width:min(100%,536px)}.sample img{width:min(100%,512px);height:auto}.backdrop{width:min(100%,768px);height:auto;image-rendering:pixelated;border:2px solid #ab9270;border-radius:4px}</style>
<header><h1>放置帝国 · 原创美术图鉴</h1><p>32px 像素角色与建筑 / 明亮日间基调 / 可编辑 SVG 和 GLB 模型源</p></header><main>
<section><h2>战斗远景与动作样本</h2><img class="backdrop" src="map/battle-backdrop.png" alt="明亮沙地战斗远景"><div class="sample">${actionSamples}</div></section>
${gallery('角色、敌人与野兽',Object.keys(specs),'units')}
${gallery('建筑与地标',Object.keys(buildings),'buildings')}
${gallery('战斗特效',Object.keys(manifest.vfx),'vfx')}
</main></html>`;
writeFileSync(join(root,'preview.html'),preview);
console.log(`Generated ${Object.keys(specs).length} characters, ${Object.keys(buildings).length} buildings and ${atlasKeys.length} atlas tiles.`);
