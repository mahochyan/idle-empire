// Build one editable SVG and one 256px transparent attack texture per CFG unit.
// The painted core comes from a per-ID imagegen master when one exists in
// source/generated/vfx/units, otherwise from the shared style master. The SVG
// adds each unit's motion trail, impact mark and rank-dependent sparks.
// Install @resvg/resvg-js as a development tool, then set VFX_RESVG_MODULE to
// its absolute module directory before running this script.
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const sourceDir=dirname(fileURLToPath(import.meta.url));
const artRoot=resolve(sourceDir,'../..');
const profilePath=join(artRoot,'vfx/unit-vfx-profiles.json');
const svgDir=join(sourceDir,'units');
const runtimePngDir=join(artRoot,'vfx/units');
const candidateOption=process.argv.find(argument=>argument.startsWith('--candidate-dir='));
const candidatePath=candidateOption?.slice('--candidate-dir='.length);
if(candidateOption&&!candidatePath)throw new Error('--candidate-dir requires a directory');
const pngDir=candidatePath?resolve(candidatePath):runtimePngDir;
if(candidatePath&&pngDir===runtimePngDir)throw new Error('Candidate directory must differ from runtime VFX directory');
if(!candidatePath)mkdirSync(svgDir,{recursive:true});
mkdirSync(pngDir,{recursive:true});
const profiles=JSON.parse(readFileSync(profilePath,'utf8'));
const idsOption=process.argv.find(argument=>argument.startsWith('--ids='));
const selectedIds=idsOption?new Set(idsOption.slice('--ids='.length).split(',').filter(Boolean)):null;
if(selectedIds){
  if(!selectedIds.size)throw new Error('--ids requires at least one unit ID');
  for(const id of selectedIds)if(!Object.hasOwn(profiles,id))throw new Error('Unknown unit ID: '+id);
}
const entries=Object.entries(profiles).filter(([id])=>!selectedIds||selectedIds.has(id));
const expectedStyles=new Set(['swordqi','arrow','thrust','cavslash','magebolt','beastbite']);
const validHex=/^#[0-9a-fA-F]{6}$/;
const require=createRequire(import.meta.url);
let Resvg;
try{({Resvg}=require(process.env.VFX_RESVG_MODULE||'@resvg/resvg-js'));}
catch(error){throw new Error('Install @resvg/resvg-js as a development tool and set VFX_RESVG_MODULE to its absolute module directory: '+error.message);}

const line=(points,color,width=3,opacity=.84)=>`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="square" stroke-linejoin="miter" opacity="${opacity}"/>`;
const href=(style)=>'../../../vfx/hires/'+style+'.png';
const masterVariants={iron_spearman:'iron_spearman-master-v3.png'};
const masterName=(id)=>masterVariants[id]||id+'-master.png';
const unitMaster=(id)=>join(artRoot,'source/generated/vfx/units',masterName(id));
const unitHref=(id)=>'../../generated/vfx/units/'+masterName(id);
const image=(style,x=0,y=0,w=256,h=256,opacity=1,transform='')=>`<image href="${href(style)}" xlink:href="${href(style)}" x="${x}" y="${y}" width="${w}" height="${h}" opacity="${opacity}"${transform?` transform="${transform}"`:''}/>`;
function baseArt(p,id){
  const style=p.style,trail=p.trail;
  const scale=.75+p.rank*.05;
  const inset=(128*(1-scale)).toFixed(2);
  if(existsSync(unitMaster(id))){
    const path=unitHref(id);
    // This silver arrow is intentionally pale; a narrow ink underlay keeps
    // its shaft and point legible over the bright battlefield at 64px.
    const underlay=id==='archer_silverbow'
      ?'<g data-mobile-contrast="silverbow" fill="none" stroke="#416279" stroke-width="5" stroke-linecap="square" stroke-linejoin="miter" opacity=".85"><path d="M35 132 L200 130 L237 128"/><path d="M204 115 L240 128 L204 143"/></g>'
      :'';
    const contrastLine=id==='archer_silverbow'
      ?'<g fill="none" stroke="#416279" stroke-width="4.5" stroke-linecap="square" stroke-linejoin="miter" opacity=".9"><path d="M46 129 Q128 132 214 128"/><path d="M207 120 L233 128 L207 136"/></g>'
      :'';
    return `<g data-unit="${id}" data-art-source="per-id" transform="translate(${inset} ${inset}) scale(${scale.toFixed(2)})">${underlay}<image href="${path}" xlink:href="${path}" x="0" y="0" width="256" height="256" preserveAspectRatio="xMidYMid meet"/>${contrastLine}</g>`;
  }
  const layers=[];
  if(trail==='charge'&&(style==='cavslash'||style==='beastbite'))layers.push(image('dust',4,81,218,176,.82));
  if(trail==='spiral'&&style==='magebolt')layers.push(image('impact-magic',53,52,143,143,.42));
  if(trail==='pulse'&&(style==='swordqi'||style==='thrust'||style==='beastbite'||style==='magebolt'))layers.push(image('impact-magic',49,44,158,158,.33));
  if(trail==='double_arc'&&style==='swordqi')layers.push(image(style,26,19,208,208,.62));
  if(trail==='double_arc'&&style==='cavslash')layers.push(image(style,-14,25,216,216,.58));
  if(trail==='fan'&&(style==='arrow'||style==='magebolt')){
    layers.push(image(style,16,-23,224,224,.61,'rotate(-9 128 128)'));
    layers.push(image(style,16,24,224,224,.61,'rotate(9 128 128)'));
  }
  if(trail==='forked'&&(style==='arrow'||style==='magebolt')){
    layers.push(image(style,8,-16,226,226,.56,'rotate(-10 128 128)'));
    layers.push(image(style,8,17,226,226,.56,'rotate(10 128 128)'));
  }
  if(trail==='piercing'&&(style==='arrow'||style==='thrust'))layers.push(image(style,-29,19,238,238,.58));
  if(trail==='zigzag'&&(style==='swordqi'||style==='magebolt'||style==='beastbite'))layers.push(image(style,-26,16,216,216,.48,'rotate(-9 128 128)'));
  if(trail==='arc'&&style==='arrow')layers.push(image(style,-13,24,225,225,.46,'rotate(-9 128 128)'));
  const mainOpacity={wild_snake:.46,wild_tiger:.53,wild_turtle:.48,wild_wyrm:.62}[id]??1;
  layers.push(image(style,0,0,256,256,mainOpacity));
  return `<g data-unit="${id}" data-art-source="shared-style" transform="translate(${inset} ${inset}) scale(${scale.toFixed(2)})">${layers.join('')}</g>`;
}
function trailArt(trail,a,h){
  const common=`<g shape-rendering="crispEdges">`;
  switch(trail){
    case 'straight': return common+line('24,171 56,167 85,153 125,147 174,135',a,3)+line('40,182 81,170 117,156 159,150',h,2,.68)+'</g>';
    case 'arc': return common+`<path d="M31 192 Q101 151 175 65" fill="none" stroke="${a}" stroke-width="3" opacity=".78"/><path d="M50 198 Q118 155 184 81" fill="none" stroke="${h}" stroke-width="2" opacity=".68"/></g>`;
    case 'double_arc': return common+`<path d="M26 188 Q96 137 187 62 M43 207 Q127 171 210 82" fill="none" stroke="${a}" stroke-width="3" opacity=".78"/><path d="M29 201 Q112 148 187 76" fill="none" stroke="${h}" stroke-width="2" opacity=".75"/></g>`;
    case 'pulse': return common+`<circle cx="150" cy="124" r="67" fill="none" stroke="${a}" stroke-width="3" stroke-dasharray="27 12 14 19" opacity=".70"/><circle cx="150" cy="124" r="53" fill="none" stroke="${h}" stroke-width="2" stroke-dasharray="14 10 23 12" opacity=".75"/></g>`;
    case 'piercing': return common+line('25,148 99,148 99,143 166,143 197,135',a,4)+line('35,158 122,158 122,153 180,153',h,2,.75)+'</g>';
    case 'fan': return common+line('34,173 98,139 176,120',a,2)+line('37,185 106,161 178,149',a,2)+line('42,197 109,184 174,177',h,2)+'</g>';
    case 'zigzag': return common+line('31,179 68,145 61,134 112,139 122,119 182,112',a,4)+line('46,195 83,164 92,171 128,151 160,158',h,2,.75)+'</g>';
    case 'forked': return common+line('28,175 87,153 139,148 194,123',a,3)+line('85,153 112,122 156,118',h,2)+line('139,148 164,178 202,173',h,2,.75)+'</g>';
    case 'charge': return common+line('20,190 73,171 103,166 132,146 176,139',a,5)+line('24,208 61,192 105,188',h,3,.8)+`<rect x="53" y="209" width="8" height="5" fill="${a}" opacity=".8"/><rect x="70" y="219" width="6" height="5" fill="${h}" opacity=".7"/></g>`;
    case 'spiral': return common+`<path d="M39 163 C67 90 165 66 195 122 C216 159 167 196 130 168 C105 151 121 122 147 127" fill="none" stroke="${a}" stroke-width="3" opacity=".76"/><path d="M48 176 C83 99 168 81 184 126" fill="none" stroke="${h}" stroke-width="2" opacity=".7"/></g>`;
    default: throw new Error('Unknown trail: '+trail);
  }
}
function markArt(shape,a,h){
  const x=190,y=127;
  const diamond=`<path d="M${x} ${y-11} L${x+11} ${y} L${x} ${y+11} L${x-11} ${y} Z" fill="none" stroke="${a}" stroke-width="3"/>`;
  switch(shape){
    case 'cut': return `<g shape-rendering="crispEdges" opacity=".8">${line('181,110 198,127',h,3)}${line('188,105 205,122',a,3)}</g>`;
    case 'shield': return `<g shape-rendering="crispEdges" opacity=".8">${diamond}${line('190,120 190,134',h,2)}${line('184,127 196,127',h,2)}</g>`;
    case 'pierce': return `<g shape-rendering="crispEdges" opacity=".83"><path d="M179 119 L205 127 L179 135 L186 127 Z" fill="${a}" stroke="${h}" stroke-width="2"/></g>`;
    case 'burst': return `<g shape-rendering="crispEdges" opacity=".84">${diamond}<rect x="188" y="114" width="4" height="26" fill="${h}"/><rect x="177" y="125" width="26" height="4" fill="${h}"/></g>`;
    case 'crush': return `<g shape-rendering="crispEdges" opacity=".83"><rect x="181" y="118" width="18" height="18" fill="none" stroke="${a}" stroke-width="3"/><rect x="186" y="123" width="8" height="8" fill="${h}"/></g>`;
    case 'shock': return `<g shape-rendering="crispEdges" opacity=".85">${line('182,111 194,123 187,124 199,141',a,4)}${line('178,130 187,130 182,139',h,2)}</g>`;
    case 'rune': return `<g shape-rendering="crispEdges" opacity=".82"><circle cx="${x}" cy="${y}" r="13" fill="none" stroke="${a}" stroke-width="3" stroke-dasharray="14 5 7 6"/><rect x="188" y="121" width="4" height="12" fill="${h}"/></g>`;
    case 'venom': return `<g shape-rendering="crispEdges" opacity=".85"><path d="M183 115 L188 125 L178 125 Z M196 120 L202 133 L190 133 Z" fill="${a}" stroke="${h}" stroke-width="2"/></g>`;
    case 'claw': return `<g shape-rendering="crispEdges" opacity=".82">${line('179,112 190,128',a,3)}${line('186,108 197,124',h,3)}${line('193,105 205,121',a,3)}</g>`;
    case 'bite': return `<g shape-rendering="crispEdges" opacity=".84"><path d="M178 116 L183 127 L188 116 M191 137 L196 126 L201 137" fill="none" stroke="${h}" stroke-width="3"/>${diamond}</g>`;
    default: throw new Error('Unknown impact shape: '+shape);
  }
}
function hashId(id){let h=2166136261;for(const c of id){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;}
function sparkArt(id,p){
  let seed=hashId(id),out='';
  const count=3+p.rank*2;
  for(let i=0;i<count;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const x=28+(seed%191);
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const y=32+(seed%188);
    const size=(i%4===0?5:3);
    const color=i%3===0?p.halo:p.accent;
    out+=`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${color}" opacity="${i%2===0?.86:.68}"/>`;
  }
  return `<g shape-rendering="crispEdges">${out}</g>`;
}
function rankAuraArt(p){
  if(p.rank<3)return '';
  const a=p.accent,h=p.halo;
  const size=54+(p.rank-3)*14;
  let out=`<circle cx="128" cy="128" r="${size}" fill="none" stroke="${a}" stroke-width="${p.rank===5?5:3}" stroke-dasharray="${p.rank===5?'22 8 11 7':'14 12 7 17'}" opacity="${p.rank===5?.53:.30}"/>`;
  if(p.rank>=4)out+=`<circle cx="128" cy="128" r="${size-12}" fill="none" stroke="${h}" stroke-width="3" stroke-dasharray="10 17 19 13" opacity=".45"/>`;
  if(p.rank===5)out+=`<path d="M128 17 V41 M128 215 V239 M17 128 H41 M215 128 H239" fill="none" stroke="${a}" stroke-width="5" opacity=".65"/>`;
  return `<g shape-rendering="crispEdges">${out}</g>`;
}
function clockTicks(cx,cy,r,color,count=12,width=4){
  let out='';
  for(let i=0;i<count;i++){
    const angle=i*Math.PI*2/count;
    const x1=Math.round(cx+Math.cos(angle)*(r-10));
    const y1=Math.round(cy+Math.sin(angle)*(r-10));
    const x2=Math.round(cx+Math.cos(angle)*r);
    const y2=Math.round(cy+Math.sin(angle)*r);
    out+=`<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
  }
  return out;
}
function starPath(cx,cy,outer,inner,points=5){
  let d='';
  for(let i=0;i<points*2;i++){
    const angle=-Math.PI/2+i*Math.PI/points;
    const r=i%2?inner:outer;
    d+=(i?' L':'M')+Math.round(cx+Math.cos(angle)*r)+' '+Math.round(cy+Math.sin(angle)*r);
  }
  return d+' Z';
}
function unitSignatureArt(id,p){
  const a=p.accent,h=p.halo;
  const emphasis=id.startsWith('wild_')||id.startsWith('mage_')?'.88':
    ['cavalry_dragon','electro_trooper','star_trooper','god_crystal_guard','phantom_god','guardian_god','slaughter_god'].includes(id)?'.84':'.70';
  const g=(art)=>`<g data-signature="${id}" opacity="${emphasis}" shape-rendering="crispEdges" stroke-linejoin="miter" stroke-linecap="square">${art}</g>`;
  switch(id){
    case 'infantry': return g(`<path d="M81 184 L122 126 M105 190 L139 147" fill="none" stroke="${h}" stroke-width="5" opacity=".7"/>`);
    case 'infantry_t1': return g(`<path d="M77 178 L135 111 M103 179 L151 126" fill="none" stroke="${a}" stroke-width="6" opacity=".76"/>`);
    case 'infantry_shield': return g(`<path d="M76 66 L125 76 L176 66 L172 142 L126 190 L79 142 Z" fill="none" stroke="#86C6BD" stroke-width="8"/><path d="M126 82 V171" stroke="${h}" stroke-width="4"/>`);
    case 'infantry_spear': return g(`<path d="M99 112 L171 112 L200 128 L171 144 L99 144 L128 128 Z" fill="none" stroke="#EBC08F" stroke-width="7"/><path d="M78 128 H195" stroke="${h}" stroke-width="4"/>`);
    case 'infantry_sword': return g(`<path d="M83 83 L157 165 M158 79 L79 163" fill="none" stroke="#D69C8F" stroke-width="7"/><path d="M91 90 L160 167" fill="none" stroke="${h}" stroke-width="3"/>`);
    case 'infantry_fortress': return g(`<path d="M69 162 V81 H90 V98 H110 V81 H133 V98 H153 V81 H174 V162 Z" fill="none" stroke="#70B9C5" stroke-width="8"/><path d="M89 151 H154" fill="none" stroke="${h}" stroke-width="4"/>`);
    case 'infantry_ironrose': return g(`<path d="M125 65 Q150 73 154 97 Q184 103 169 132 Q180 157 145 172 Q115 189 94 157 Q63 152 78 119 Q72 91 105 93 Z" fill="none" stroke="#B99BBB" stroke-width="7"/><path d="M126 83 Q151 125 119 166" fill="none" stroke="${h}" stroke-width="4"/>`);
    case 'infantry_bloodrose': return g(`<path d="M128 63 Q166 75 162 111 Q186 138 153 163 Q131 188 101 164 Q66 143 90 110 Q91 76 128 63 Z" fill="none" stroke="#D97488" stroke-width="8"/><path d="M98 122 Q130 92 153 123 Q147 152 116 151" fill="none" stroke="${h}" stroke-width="4"/>`);
    case 'archer': return g(`<path d="M72 173 Q134 105 174 117" fill="none" stroke="#C5CF83" stroke-width="5" opacity=".8"/>`);
    case 'archer_t1': return g(`<path d="M61 159 L115 110 M65 177 L119 134 M68 195 L122 160" fill="none" stroke="#B9D99F" stroke-width="5" opacity=".76"/>`);
    case 'archer_silverbow': return g(`<path d="M78 72 Q44 127 86 183 M92 71 Q58 127 100 182" fill="none" stroke="#9ECADD" stroke-width="7"/><path d="M79 126 L105 126" stroke="${h}" stroke-width="3"/>`);
    case 'archer_crossbow': return g(`<path d="M75 114 H143 M108 81 V148" fill="none" stroke="#D8B57D" stroke-width="8"/><path d="M77 126 Q106 93 143 126" fill="none" stroke="${h}" stroke-width="4"/>`);
    case 'archer_assassin': return g(`<path d="M75 78 L155 163 M154 76 L74 161" fill="none" stroke="#95BBB1" stroke-width="6"/><path d="M87 87 L148 155" fill="none" stroke="${h}" stroke-width="2"/>`);
    case 'archer_longbow': return g(`<path d="M87 57 Q38 129 91 204 M91 57 Q108 129 91 204" fill="none" stroke="#95BADC" stroke-width="6"/><path d="M88 62 V199" fill="none" stroke="${h}" stroke-width="3"/>`);
    case 'archer_genoese': return g(`<path d="M77 85 L149 126 L77 168 M68 126 H157" fill="none" stroke="#C7A77D" stroke-width="8"/><path d="M83 91 L148 126 L83 162" fill="none" stroke="${h}" stroke-width="3"/>`);
    case 'archer_shadowblade': return g(`<path d="M60 176 L153 77 M97 190 L193 96" fill="none" stroke="#9F9FCB" stroke-width="8" opacity=".82"/><path d="M73 173 L155 85" fill="none" stroke="${h}" stroke-width="3"/>`);
    case 'cavalry_t1': return g(`<path d="M74 190 Q120 172 154 181 M88 203 Q142 187 185 196" fill="none" stroke="#C6AB80" stroke-width="7" opacity=".7"/>`);
    case 'cavalry_wind': return g(`<path d="M54 99 Q97 71 131 99 Q156 121 186 93 M56 158 Q106 128 146 153" fill="none" stroke="#8BC8BC" stroke-width="8"/><path d="M63 112 Q109 89 153 120" fill="none" stroke="${h}" stroke-width="3"/>`);
    case 'cavalry_iron': return g(`<path d="M72 145 Q87 99 127 100 Q166 99 181 145 L155 173 L154 147 Q128 119 98 147 L98 173 Z" fill="none" stroke="#93ACC5" stroke-width="8"/><rect x="123" y="104" width="9" height="13" fill="${h}"/>`);
    case 'cavalry_teutonic': return g(`<path d="M123 52 H140 V105 H190 V122 H140 V176 H123 V122 H73 V105 H123 Z" fill="none" stroke="#D9C58E" stroke-width="7" opacity=".84"/>`);
    case 'spearman': return g(`<path d="M70 128 H162 L187 128 M170 112 L193 128 L170 144" fill="none" stroke="#D7C08D" stroke-width="5" opacity=".75"/>`);
    case 'bronze_guard': return g(`<path d="M80 89 L127 65 L174 89 L166 153 L127 186 L88 153 Z" fill="none" stroke="#BB966C" stroke-width="7"/><path d="M127 70 V175" stroke="${h}" stroke-width="3"/>`);
    case 'iron_spearman': return g(`<path d="M79 127 H174 M158 107 L197 127 L158 147" fill="none" stroke="#83A6B1" stroke-width="8"/><path d="M82 119 H158" stroke="${h}" stroke-width="3"/>`);
    case 'silver_heavy': return g(`<path d="M72 72 H185 V157 L129 190 L72 157 Z" fill="none" stroke="#B7CDD5" stroke-width="8"/><path d="M92 93 H165 M129 79 V180" fill="none" stroke="${h}" stroke-width="4"/>`);
    case 'gold_cavalry': return g(`<circle cx="128" cy="121" r="72" fill="none" stroke="#E9C675" stroke-width="7" stroke-dasharray="20 14"/><path d="M128 33 V59 M128 185 V211 M42 121 H69 M187 121 H214" fill="none" stroke="${h}" stroke-width="6"/>`);
    case 'alloy_special': return g(`<circle cx="124" cy="128" r="56" fill="none" stroke="#A9C7C8" stroke-width="7" stroke-dasharray="17 10 8 10"/><circle cx="124" cy="128" r="27" fill="none" stroke="${h}" stroke-width="4"/>`);
    case 'armored_trooper': return g(`<path d="M73 73 H111 M73 73 V108 M182 73 H145 M182 73 V108 M73 183 H111 M73 183 V147 M182 183 H145 M182 183 V147" fill="none" stroke="#C4AA88" stroke-width="7"/><circle cx="128" cy="128" r="23" fill="none" stroke="${h}" stroke-width="4"/>`);
    case 'mage_t1': return g(`<path d="M89 89 L101 77 L113 89 L101 101 Z M80 176 L90 166 L100 176 L90 186 Z" fill="none" stroke="${a}" stroke-width="4" opacity=".84"/>`);
    case 'mage_time': return g(`<circle cx="122" cy="126" r="65" fill="none" stroke="#5CBAC6" stroke-width="7" opacity=".9"/>${clockTicks(122,126,65,h,12,4)}<path d="M122 126 L122 87 M122 126 L154 139" fill="none" stroke="${h}" stroke-width="6"/><rect x="116" y="120" width="12" height="12" fill="#5CBAC6"/>`);
    case 'mage_space': return g(`<path d="M117 36 L186 81 L170 193 L101 220 L47 156 L59 77 Z" fill="none" stroke="#A58DD9" stroke-width="8" opacity=".94"/><path d="M117 36 L101 220 M59 77 L170 193 M186 81 L47 156" fill="none" stroke="${h}" stroke-width="4" opacity=".86"/><path d="M82 97 L117 111 L94 154 L70 138 Z" fill="#BDABEB" opacity=".42"/>`);
    case 'mage_chrono': return g(`<circle cx="126" cy="128" r="74" fill="none" stroke="#5FD7DD" stroke-width="7" stroke-dasharray="24 7 16 7"/><circle cx="126" cy="128" r="49" fill="none" stroke="${h}" stroke-width="5" stroke-dasharray="12 6 9 7"/>${clockTicks(126,128,74,'#77E8EA',16,4)}<path d="M126 128 L126 82 M126 128 L162 100" stroke="#E8FFFF" stroke-width="6"/>`);
    case 'mage_merlin': return g(`<path d="${starPath(126,128,75,27,5)}" fill="none" stroke="#C3A8E7" stroke-width="7" opacity=".9"/><path d="${starPath(126,128,54,18,5)}" fill="none" stroke="${h}" stroke-width="4"/><circle cx="126" cy="128" r="16" fill="none" stroke="#EAD7FF" stroke-width="5"/>`);
    case 'cavalry_dragon': return g(`<path d="M41 182 Q64 134 92 165 Q75 112 112 82 Q103 132 131 142 Q146 104 173 69 Q170 129 195 145" fill="none" stroke="#F18768" stroke-width="8" opacity=".88"/><path d="M46 175 Q83 140 105 176 M139 147 Q164 107 183 102" fill="none" stroke="#FFE0A4" stroke-width="4"/>`);
    case 'electro_trooper': return g(`<path d="M85 52 L110 85 L91 91 L132 132 M172 53 L149 91 L170 94 L130 129 M79 186 L106 156 L87 154 L130 128" fill="none" stroke="#8DD5F2" stroke-width="8"/><path d="M93 61 L112 87 M164 61 L147 90" fill="none" stroke="#F4FDFF" stroke-width="3"/>`);
    case 'star_trooper': return g(`<path d="${starPath(128,127,77,36,6)}" fill="none" stroke="#A9DED3" stroke-width="7" opacity=".86"/><path d="${starPath(128,127,52,24,6)}" fill="none" stroke="${h}" stroke-width="4"/><circle cx="128" cy="127" r="12" fill="#E9FFF6" opacity=".55"/>`);
    case 'god_crystal_guard': return g(`<path d="M126 37 L181 77 L181 171 L126 213 L71 171 L71 77 Z" fill="none" stroke="#85C7CE" stroke-width="7"/><path d="M126 37 L126 213 M71 77 L181 171 M181 77 L71 171" fill="none" stroke="${h}" stroke-width="3" opacity=".8"/>`);
    case 'phantom_god': return g(`<path d="M59 65 H96 M59 65 V101 M199 66 H162 M199 66 V101 M59 190 H96 M59 190 V154 M199 190 H162 M199 190 V154" fill="none" stroke="#B89EE8" stroke-width="7" opacity=".9"/><path d="M73 83 L173 174 M91 188 L183 96" fill="none" stroke="${h}" stroke-width="3" stroke-dasharray="11 13"/>`);
    case 'guardian_god': return g(`<path d="M128 44 L196 80 L186 166 L128 212 L70 166 L60 80 Z" fill="none" stroke="#E4CCA0" stroke-width="8"/><path d="M128 64 V186 M87 122 H169" fill="none" stroke="${h}" stroke-width="5"/>`);
    case 'slaughter_god': return g(`<circle cx="127" cy="127" r="70" fill="none" stroke="#E6A493" stroke-width="6" stroke-dasharray="44 12 26 12"/><circle cx="127" cy="127" r="27" fill="none" stroke="${h}" stroke-width="4"/><path d="M127 34 V76 M127 178 V221 M35 127 H77 M178 127 H221" fill="none" stroke="#F0B2A0" stroke-width="6"/>`);
    case 'wild_boar': return g(`<path d="M70 132 Q95 190 160 170 Q133 171 106 142 M96 111 Q141 173 201 135" fill="none" stroke="#F6DFB6" stroke-width="10" opacity=".95"/>`);
    case 'wild_bull': return g(`<path d="M48 81 Q58 129 111 137 M208 81 Q199 129 145 137" fill="none" stroke="#FFF0CD" stroke-width="13"/><path d="M53 179 Q128 225 205 179" fill="none" stroke="#E8C178" stroke-width="8"/>`);
    case 'wild_snake': return g(`<path d="M33 174 C79 106 117 192 157 111 S213 91 222 53" fill="none" stroke="#4C9E69" stroke-width="13"/><path d="M33 174 C79 106 117 192 157 111 S213 91 222 53" fill="none" stroke="#C9F2A4" stroke-width="5"/><path d="M71 49 Q86 76 71 83 Q56 76 71 49 M191 184 Q204 204 191 211 Q178 204 191 184" fill="#7BCA85" stroke="#E9FFD4" stroke-width="3"/>`);
    case 'wild_tiger': return g(`<path d="M54 196 L146 63 M87 212 L176 82 M124 218 L206 103" fill="none" stroke="#4D93C5" stroke-width="13"/><path d="M58 191 L143 67 M91 207 L174 87 M128 214 L202 107" fill="none" stroke="#D7F5FF" stroke-width="5"/>`);
    case 'wild_turtle': return g(`<path d="M128 41 L191 76 L205 145 L165 204 L91 204 L51 145 L65 76 Z" fill="none" stroke="#5C9986" stroke-width="11"/><path d="M128 41 L128 205 M65 76 L165 204 M191 76 L91 204 M51 145 H205" fill="none" stroke="#D4EAC7" stroke-width="5" opacity=".88"/>`);
    case 'wild_wyrm': return g(`<path d="M39 189 L70 150 L87 163 L105 107 L120 132 L151 72 L169 117 L204 49 L187 153 L220 135" fill="none" stroke="#3F9089" stroke-width="15"/><path d="M44 189 L72 153 L89 166 L106 113 L121 137 L152 78 L170 121 L202 56" fill="none" stroke="#BEE8C6" stroke-width="6"/>`);
    default: return '';
  }
}
const paths=new Set();
for(const [id,p] of entries){
  if(!/^[a-z0-9_]+$/.test(id))throw new Error('Invalid unit ID: '+id);
  if(!expectedStyles.has(p.style)||!validHex.test(p.accent)||!validHex.test(p.halo)||!Number.isInteger(p.rank)||p.rank<1||p.rank>5)throw new Error('Invalid profile: '+id);
  const basePath=join(artRoot,'vfx/hires',p.style+'.png');
  if(!existsSync(basePath))throw new Error('Missing base art: '+basePath);
  const hasUnitMaster=existsSync(unitMaster(id));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="256" height="256" viewBox="0 0 256 256">\n`+
    `<!-- ${id}: ${hasUnitMaster?'per-ID':'shared '+p.style} painted core + ${p.trail} trail + ${p.impactShape} mark + rank ${p.rank} -->\n`+
    rankAuraArt(p)+'\n'+`<g opacity="${(p.rank*.19).toFixed(2)}">${trailArt(p.trail,p.accent,p.halo)}</g>`+'\n'+
    baseArt(p,id)+'\n'+(hasUnitMaster?'':unitSignatureArt(id,p))+'\n'+markArt(p.impactShape,p.accent,p.halo)+'\n'+sparkArt(id,p)+'\n</svg>\n';
  const svgPath=join(svgDir,id+'.svg'),pngPath=join(pngDir,id+'.png');
  if(paths.has(pngPath))throw new Error('Duplicate output: '+pngPath);
  paths.add(pngPath);
  if(!candidatePath)writeFileSync(svgPath,svg);
  let renderSvg=svg;
  for(const artStyle of new Set([p.style,'dust','impact-magic'])){
    const asset=join(artRoot,'vfx/hires',artStyle+'.png');
    if(!existsSync(asset))throw new Error('Missing extra art: '+asset);
    renderSvg=renderSvg.replaceAll(href(artStyle),'data:image/png;base64,'+readFileSync(asset).toString('base64'));
  }
  if(hasUnitMaster)renderSvg=renderSvg.replaceAll(unitHref(id),'data:image/png;base64,'+readFileSync(unitMaster(id)).toString('base64'));
  const image=new Resvg(renderSvg,{fitTo:{mode:'width',value:256}}).render().asPng();
  writeFileSync(pngPath,image);
  if(image.readUInt32BE(16)!==256||image.readUInt32BE(20)!==256)throw new Error('Wrong PNG size: '+pngPath);
}
if(paths.size!==entries.length)throw new Error('Expected '+entries.length+' unit VFX, got '+paths.size);
console.log(candidatePath
  ?`Generated ${paths.size} transparent 256x256 candidate unit VFX PNGs in ${pngDir}.`
  :`Generated ${paths.size} unique transparent 256x256 unit VFX PNGs and editable SVGs.`);
