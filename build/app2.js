/* =====================================================================
   Part 2: state, persistence, UI
   ===================================================================== */

/* ---------- persisted state ---------- */
const LS_KEY='hueharbor.settings.v1', LS_LISTS='hueharbor.lists.v1';
const DEFAULTS={theme:(matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light',mode:'generate',view:'single',layout:'grid',color:'#2f6fed',type:'Complementary',libKind:'mood',libMood:'Powerful',libSci:'Complementary',libColor:80,curList:0,cur:0,page:0,bg:null};
let S=Object.assign({},DEFAULTS);
try{Object.assign(S,JSON.parse(localStorage.getItem(LS_KEY)||'{}'));}catch(e){}
/* Repair anything odd in stored settings (edited by hand, older versions, corrupted storage) */
if(!ALL_TYPES.includes(S.type))S.type=DEFAULTS.type;
S.color=normHex(String(S.color||''))||DEFAULTS.color;
S.bg=S.bg&&normHex(String(S.bg))?normHex(String(S.bg)):null;
const pickEnum=(k,allowed)=>{if(!allowed.includes(S[k]))S[k]=DEFAULTS[k];};
pickEnum('theme',['light','dark']);pickEnum('mode',['generate','library','lists']);pickEnum('view',['single','multi']);pickEnum('layout',['grid','rows']);pickEnum('libKind',['mood','sci','color']);
pickEnum('libMood',MOODS);pickEnum('libSci',SCI);
for(const k of ['curList','cur','page','libColor']){S[k]=Number.isInteger(S[k])&&S[k]>=0?S[k]:DEFAULTS[k];}
if(!PAL_BY_ID.has(S.libColor))S.libColor=DEFAULTS.libColor;
function save(){try{localStorage.setItem(LS_KEY,JSON.stringify(S));}catch(e){}}

/* custom lists: [{name, items:[{name,colors,anchor,note}]}] */
let LISTS=null;
try{LISTS=JSON.parse(localStorage.getItem(LS_LISTS));}catch(e){}
/* Normalise one stored/imported palette item; returns null if it is unusable */
function cleanItem(it){if(!it||!Array.isArray(it.colors)||it.colors.length<2||it.colors.length>12||!it.colors.every(c=>normHex(String(c))))return null;return{type:String(it.type||'imported').slice(0,30),colors:it.colors.map(c=>normHex(String(c))),anchor:Number.isInteger(it.anchor)?it.anchor:-1,name:(typeof it.name==='string'&&it.name.trim()?it.name.trim():'Palette').slice(0,60),note:typeof it.note==='string'?it.note.slice(0,80):'',setId:Number.isInteger(it.setId)?it.setId:undefined};}
/* Normalise one stored/imported list (name + items); returns null if it is not a list */
function cleanList(l){if(!l||typeof l!=='object'||!Array.isArray(l.items))return null;return{name:cleanName(typeof l.name==='string'?l.name:''),items:l.items.map(cleanItem).filter(Boolean)};}
if(Array.isArray(LISTS))LISTS=LISTS.map(cleanList).filter(Boolean).slice(0,30);
if(!Array.isArray(LISTS)||!LISTS.length){
  const starter=[1870,2146,2141,2120,2118,2119,2122,2114,3038,3036,3039,3119,3096,3103,3109,2132,2317,1026].map(id=>setToPal(SETS[id-1]));
  LISTS=[{name:'Classic favorites',items:starter}];
}
function saveLists(){try{localStorage.setItem(LS_LISTS,JSON.stringify(LISTS));}catch(e){toast('Could not save lists (storage full?)');}}
function setToPal(s){return{type:'classic',colors:s.hexes.slice(),anchor:-1,name:'Set #'+s.id,note:[s.mood>=0?MOODS[s.mood]:null,s.sci>=0?SCI[s.sci]:null].filter(Boolean).join(' · ')||'by colour only',setId:s.id,id:'set|'+s.id};}
function curList(){S.curList=clamp(S.curList,0,LISTS.length-1);return LISTS[S.curList];}
function palKey(p){return p.colors.join();}
function inCurList(p){return curList().items.some(x=>palKey(x)===palKey(p));}
function toggleInList(p){const l=curList();const i=l.items.findIndex(x=>palKey(x)===palKey(p));if(i>=0){l.items.splice(i,1);toast('Removed from “'+l.name+'”');}else{l.items.push({type:p.type,colors:p.colors.slice(),anchor:p.anchor,name:p.name,note:p.note,setId:p.setId});toast('Saved to “'+l.name+'”');}saveLists();render();}

/* ---------- toast ---------- */
let toastT;function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),1600);}
async function copyText(txt,label){try{await navigator.clipboard.writeText(txt);toast((label||'Copied')+' ✓');}catch(e){const ta=h('textarea',{style:'position:fixed;opacity:0'},txt);document.body.append(ta);ta.select();try{document.execCommand('copy');toast((label||'Copied')+' ✓');}catch(e2){toast('Copy failed');}ta.remove();}}

/* ---------- formatting ---------- */
function fmt(hex){const[r,g,b]=hexToRgb(hex),[hh,s,l]=rgbToHsl(r,g,b),[c,m,y,k]=rgbToCmyk(r,g,b),[L,C,H]=rgbToOklch(r,g,b);return{hex:hex.toUpperCase(),rgb:`rgb(${r}, ${g}, ${b})`,hsl:`hsl(${Math.round(hh)}, ${Math.round(s)}%, ${Math.round(l)}%)`,cmyk:`${Math.round(c)}, ${Math.round(m)}, ${Math.round(y)}, ${Math.round(k)}`,oklch:`oklch(${(L*100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`};}
function cssVars(p){return`:root {\n${p.colors.map((c,i)=>`  --color-${i+1}: ${c};`).join('\n')}\n}`;}
function palJson(p){return JSON.stringify({name:p.name,type:p.type,colors:p.colors,anchor:p.anchor>=0?p.colors[p.anchor]:null},null,2);}

/* ---------- palette file export (.ase / .gpl), generated client-side ---------- */
function slugify(s){s=String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);return s||'palette';}
function downloadBlob(blob,filename){const a=h('a',{href:URL.createObjectURL(blob),download:filename});document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
/* Adobe Swatch Exchange, binary ASEF v1.0. groups = [{name, colors:[hex…]}] → one 0xC001/0xC002 group per palette,
   each colour an RGB float entry (big-endian float32 0–1, UTF-16BE null-terminated name, colour type 0 = Global). */
function makeASE(groups,colorType){
  colorType=colorType===undefined?0:colorType;
  const chunks=[];let total=12,blocks=0;
  const u16=v=>{const b=new Uint8Array(2);b[0]=(v>>8)&255;b[1]=v&255;return b;};
  const u32=v=>{const b=new Uint8Array(4);b[0]=(v>>>24)&255;b[1]=(v>>>16)&255;b[2]=(v>>>8)&255;b[3]=v&255;return b;};
  const f32=v=>{const b=new Uint8Array(4);new DataView(b.buffer).setFloat32(0,v,false);return b;};
  const str=s=>{s=String(s).slice(0,255);const b=new Uint8Array(2+s.length*2+2);b[0]=((s.length+1)>>8)&255;b[1]=(s.length+1)&255;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);b[2+i*2]=(c>>8)&255;b[3+i*2]=c&255;}return b;};// uint16 char count incl. terminator + UTF-16BE + 0x0000
  const block=(type,parts)=>{const len=parts.reduce((n,p)=>n+p.length,0);chunks.push(u16(type),u32(len),...parts);total+=6+len;blocks++;};
  for(const g of groups){
    block(0xC001,[str(g.name)]);
    for(const hex of g.colors){const[r,gg,b]=hexToRgb(hex);block(0x0001,[str(hex.toUpperCase()),new Uint8Array([0x52,0x47,0x42,0x20]),f32(r/255),f32(gg/255),f32(b/255),u16(colorType)]);}
    block(0xC002,[]);
  }
  const out=new Uint8Array(total);out.set([0x41,0x53,0x45,0x46],0);out.set(u16(1),4);out.set(u16(0),6);out.set(u32(blocks),8);
  let o=12;for(const c of chunks){out.set(c,o);o+=c.length;}
  return new Blob([out],{type:'application/octet-stream'});
}
/* GIMP palette text format (also read by Inkscape and Krita). groups as above; one "# name" comment per palette. */
function makeGPL(title,groups){
  const cols=Math.max(1,...groups.map(g=>g.colors.length));
  const lines=['GIMP Palette','Name: '+String(title).replace(/[\r\n]+/g,' ').slice(0,80),'Columns: '+Math.min(cols,16),'# Exported from Hue Harbor'];
  groups.forEach(g=>{lines.push('# '+String(g.name).replace(/[\r\n]+/g,' '));g.colors.forEach(hex=>{const[r,gg,b]=hexToRgb(hex);lines.push(String(r).padStart(3,' ')+' '+String(gg).padStart(3,' ')+' '+String(b).padStart(3,' ')+'\t'+hex.toUpperCase());});});
  return new Blob([lines.join('\n')+'\n'],{type:'text/plain;charset=utf-8'});
}
function palGroup(p,i){return{name:p.name+(p.note?' ('+p.note+')':'')+(i!==undefined?' #'+(i+1):''),colors:p.colors};}
function exportPalette(p,kind){
  const g=[palGroup(p)];const base=slugify(p.name)+'-'+p.colors.map(c=>c.slice(1)).join('-').slice(0,40);
  if(kind==='ase')downloadBlob(makeASE(g),base+'.ase');else downloadBlob(makeGPL(p.name,g),base+'.gpl');
  toast('Downloaded '+base+'.'+kind);
}
function exportMany(title,items,slug,kind){
  if(!items.length)return toast('Nothing to export');
  const groups=items.map((p,i)=>palGroup(p,i));
  if(kind==='ase')downloadBlob(makeASE(groups),slug+'.ase');else downloadBlob(makeGPL(title,groups),slug+'.gpl');
  toast(`Downloaded ${slug}.${kind} (${items.length} palette${items.length===1?'':'s'})`);
}
function exportCollection(kind){
  const col=collection();let slug,title;
  if(S.mode==='generate'){slug=slugify(S.type)+'-'+S.color.slice(1).toLowerCase();title=S.type+' palettes for '+S.color.toUpperCase();}
  else if(S.mode==='library'){slug='classic-'+slugify(col.title.replace(/^Classic library · /,''));title=col.title;}
  else{slug=slugify(curList().name);title='List: '+curList().name;}
  exportMany(title,col.items,slug,kind);
}

/* ---------- collection for the current mode ---------- */
const genCache=new Map();
function getGenerated(){const k=S.type+'|'+S.color;if(!genCache.has(k)){if(genCache.size>60)genCache.clear();genCache.set(k,generate(S.type,S.color));}return genCache.get(k);}
function librarySets(){
  if(S.libKind==='mood')return SETS_BY_MOOD[Math.max(0,MOODS.indexOf(S.libMood))];
  if(S.libKind==='sci')return SETS_BY_SCI[Math.max(0,SCI.indexOf(S.libSci))];
  return setsByColor(S.libColor);
}
const libCache=new Map();
function collection(){
  if(S.mode==='generate'){const items=getGenerated();return{items,title:S.type,sub:`${items.length} palette${items.length===1?'':'s'} containing ${S.color.toUpperCase()}`,info:S.type};}
  if(S.mode==='library'){
    const k=S.libKind+'|'+S.libMood+'|'+S.libSci+'|'+S.libColor;
    if(!libCache.has(k))libCache.set(k,librarySets().map(setToPal));
    const items=libCache.get(k);
    const label=S.libKind==='mood'?S.libMood:S.libKind==='sci'?S.libSci:(PAL_BY_ID.get(S.libColor)||{}).label;
    return{items,title:'Classic library · '+label,sub:`${items.length} recovered set${items.length===1?'':'s'}`,info:S.libKind==='color'?null:label};
  }
  const l=curList();return{items:l.items,title:'List · '+l.name,sub:`${l.items.length} saved palette${l.items.length===1?'':'s'}`,info:null};
}
function pageSize(){return S.mode==='library'?12:24;}

/* ---------- rendering ---------- */
function swatchButton(hex,i,p,big){
  const b=h('button',{type:'button',class:'sw',style:'background:'+hex,'aria-label':`Colour ${i+1}: ${hex.toUpperCase()}${i===p.anchor?' (your colour)':''}`,title:hex.toUpperCase()});
  b.append(h('span',{class:'tag'},hex.toUpperCase()));
  if(i===p.anchor)b.append(h('span',{class:'pin',title:'Your colour'}));
  b.addEventListener('click',ev=>showSwatchPop(ev,hex,p,i));
  return b;
}
function paletteCard(p,big,idx){
  const card=h('article',{class:'pal'+(big?' big':''),'data-idx':idx});
  const strip=h('div',{class:'strip'},p.colors.map((c,i)=>swatchButton(c,i,p,big)));
  const saved=inCurList(p);
  const acts=h('div',{class:'acts'},
    h('button',{type:'button',title:'Copy hex list',onclick:()=>copyText(p.colors.join(', '),'Hex list copied')},'HEX'),
    h('button',{type:'button',title:'Copy CSS custom properties',onclick:()=>copyText(cssVars(p),'CSS copied')},'CSS'),
    h('button',{type:'button',title:'Copy JSON',onclick:()=>copyText(palJson(p),'JSON copied')},'JSON'),
    h('button',{type:'button',title:'Download as Adobe Swatch Exchange (.ase) for Photoshop / Illustrator',onclick:()=>exportPalette(p,'ase')},'.ase'),
    h('button',{type:'button',title:'Download as GIMP palette (.gpl) for GIMP / Inkscape / Krita',onclick:()=>exportPalette(p,'gpl')},'.gpl'),
    h('button',{type:'button',title:'Magnified preview',onclick:()=>openMagnify(idx)},'Magnify'),
    h('button',{type:'button',title:'Preview this palette on sample designs and photos',onclick:()=>openPreview(idx)},'Preview'),
    h('button',{type:'button',class:saved?'on':'','aria-pressed':saved?'true':'false',title:saved?'Remove from current list':'Save to current list',onclick:()=>toggleInList(p)},saved?'★ Saved':'☆ Save')
  );
  const nm=h('span',{class:'name'},p.name,p.note?h('small',null,p.note):null);
  card.append(strip,h('div',{class:'foot'},nm,acts));
  if(!big)card.addEventListener('dblclick',ev=>{if(ev.target.closest('button')&&!ev.target.classList.contains('sw'))return;S.cur=idx;S.view='single';save();render();});
  return card;
}
function render(){
  const col=collection();const items=col.items;const stage=$('#stage'),pager=$('#pager');
  $('#title').firstChild.textContent=col.title+' ';
  $('#subtitle').textContent=col.sub;
  $('#infoBtn').classList.toggle('hidden',!col.info||!INFO[col.info]);
  $$('#viewSeg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===S.view)));
  $('#layoutSeg').classList.toggle('hidden',S.view!=='multi');
  $$('#layoutSeg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layout===S.layout)));
  stage.innerHTML='';pager.innerHTML='';
  if(!items.length){stage.append(h('div',{class:'empty'},S.mode==='lists'?'This list is empty. Use ☆ Save on any palette to add it here.':'Nothing to show.'));return;}
  if(S.view==='single'){
    S.cur=clamp(S.cur,0,items.length-1);
    stage.className='single';
    stage.append(paletteCard(items[S.cur],true,S.cur));
    pager.append(
      h('button',{type:'button',class:'btn',onclick:()=>step(-1),disabled:S.cur===0?'':null},'‹ Back'),
      h('button',{type:'button',class:'counter',style:'border:0;background:none;cursor:pointer',title:'Jump to a palette number',onclick:jumpTo},`${S.cur+1} of ${items.length}`),
      h('button',{type:'button',class:'btn',onclick:()=>step(1),disabled:S.cur===items.length-1?'':null},'Forward ›')
    );
  }else{
    const ps=pageSize(),pages=Math.ceil(items.length/ps);S.page=clamp(S.page,0,pages-1);
    stage.className=S.layout==='grid'?'grid':'rows';
    const a=S.page*ps,b=Math.min(items.length,a+ps);
    for(let i=a;i<b;i++)stage.append(paletteCard(items[i],false,i));
    if(pages>1||S.mode==='library')pager.append(
      h('button',{type:'button',class:'btn',onclick:()=>{S.page--;save();render();},disabled:S.page===0?'':null},'‹ Back'),
      h('span',{class:'counter'},`${a+1}–${b} of ${items.length}`),
      h('button',{type:'button',class:'btn',onclick:()=>{S.page++;save();render();},disabled:S.page>=pages-1?'':null},'Forward ›')
    );
  }
  save();
}
function step(d){const n=collection().items.length;if(!n)return;if(S.view==='single'){S.cur=clamp(S.cur+d,0,n-1);}else{S.page=clamp(S.page+d,0,Math.ceil(n/pageSize())-1);}save();render();}
function jumpTo(){const n=collection().items.length;const v=prompt(`Go to palette (1–${n}):`,String(S.cur+1));const k=parseInt(v,10);if(k>=1&&k<=n){S.cur=k-1;save();render();}}

/* ---------- popovers ---------- */
function closePops(){$('#popLayer').innerHTML='';}
function placePop(pop,x,y){document.body.append(pop);const r=pop.getBoundingClientRect();let L=Math.min(x+8,innerWidth-r.width-8),T=y+10;if(T+r.height>innerHeight-8)T=Math.max(8,y-r.height-10);pop.style.left=Math.max(8,L)+'px';pop.style.top=T+'px';$('#popLayer').append(pop);const f=pop.querySelector('button,input');if(f)f.focus({preventScroll:true});}
function showSwatchPop(ev,hex,p,i){
  closePops();const f=fmt(hex);const nb=nearestBase(hex);
  const row=(k,v,copyV)=>[h('span',{class:'k'},k),h('span',{class:'v'},v),h('button',{type:'button',onclick:()=>copyText(copyV||v,k+' copied')},'Copy')];
  const pop=h('div',{class:'pop',role:'dialog','aria-label':'Colour values'},
    h('div',{class:'head'},h('div',{class:'sw',style:'background:'+hex}),h('div',{class:'ttl'},f.hex,h('small',null,i===p.anchor?'Your colour':`Colour ${i+1} of ${p.colors.length}`))),
    h('div',{class:'kv'},...row('HEX',f.hex),...row('RGB',f.rgb),...row('HSL',f.hsl),...row('CMYK ≈',f.cmyk,`cmyk(${f.cmyk})`),...row('OKLCH',f.oklch),
      h('span',{class:'k'},'Classic'),h('span',{class:'v',title:'Nearest of the 152 recovered base colours (ΔE ≈ '+nb.dist.toFixed(3)+')'},`#${nb.color.id} ${nb.color.label} · ink ≈ ${nb.color.dic}`),h('span',{class:'sw',style:'width:20px;height:20px;border-radius:5px;border:1px solid var(--border);background:'+nb.color.hex})),
    h('div',{class:'contrast-note',style:'margin-top:6px'},'CMYK is a naive RGB→CMYK estimate, not a press profile.'),
    h('div',{class:'foot'},
      h('button',{type:'button',class:'btn small',onclick:()=>{closePops();setColor(hex,true);if(S.mode!=='generate')setMode('generate');}},'Use as my colour'),
      h('button',{type:'button',class:'btn small',onclick:()=>{closePops();S.libKind='color';S.libColor=nb.color.id;S.page=0;S.cur=0;setMode('library');}},'Classic sets with this'),
      h('button',{type:'button',class:'btn small',onclick:closePops},'Close'))
  );
  placePop(pop,ev.clientX,ev.clientY);
}
function showInfoPop(ev){
  closePops();const key=collection().info;if(!key||!INFO[key])return;
  const pop=h('div',{class:'pop info-pop',role:'dialog'},h('h4',null,key),h('p',null,INFO[key]),h('div',{class:'foot'},h('button',{type:'button',class:'btn small',onclick:closePops},'Close')));
  const r=ev.currentTarget.getBoundingClientRect();placePop(pop,r.left,r.bottom);
}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.pop')&&!e.target.closest('.sw')&&!e.target.closest('#infoBtn')&&!e.target.closest('#bgBtn'))closePops();});

/* ---------- modals ---------- */
/* Modals: one at a time; focus moves in on open, is kept inside with Tab / Shift+Tab, and returns to the opener on close */
let modalOpener=null;
const FOCUSABLE='button:not([disabled]),[href],input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function openModal(box){
  closePops();const layer=$('#modalLayer');
  if(!layer.children.length&&document.activeElement&&document.activeElement!==document.body)modalOpener=document.activeElement;
  const m=h('div',{class:'modal',role:'dialog','aria-modal':'true'},box);
  m.addEventListener('pointerdown',e=>{if(e.target===m)closeModal();});
  m.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const f=[...box.querySelectorAll(FOCUSABLE)].filter(el=>el.offsetParent!==null);if(!f.length)return;const first=f[0],last=f[f.length-1];if(e.shiftKey&&(document.activeElement===first||!box.contains(document.activeElement))){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}});
  layer.innerHTML='';layer.append(m);const b=box.querySelector(FOCUSABLE);if(b)b.focus();
}
function closeModal(){const layer=$('#modalLayer');if(!layer.children.length)return;layer.innerHTML='';if(modalOpener&&document.contains(modalOpener)){try{modalOpener.focus();}catch(e){}}modalOpener=null;}

/* magnified pattern view */
/* Pattern order: bars (horizontal, vertical, then diagonal stripes at 45°), then thin repeating stripes.
   'Vertical bars' is the pattern that used to be called 'Diagonal' (it always drew one vertical bar per colour). */
const MAG_PATTERNS=['Panels','Nested','Horizontal bars','Vertical bars','Diagonal','Vertical stripes'];
const MAG_BG=['#ffffff','#d9d9d9','#4a4a4a','#000000'];
let mag={idx:0,pattern:0,bg:0,rot:0};
function openMagnify(idx){mag.idx=idx;mag.rot=0;renderMagnify();}
function renderMagnify(){
  const items=collection().items;mag.idx=clamp(mag.idx,0,items.length-1);const p=items[mag.idx];
  const cols=p.colors.map((_,i)=>p.colors[(i+mag.rot)%p.colors.length]);const n=cols.length;
  const stage=h('div',{class:'mag-stage',style:'background:'+MAG_BG[mag.bg]});
  const rotate=()=>{mag.rot=(mag.rot+1)%n;renderMagnify();};
  const cell=(style,c)=>h('div',{class:'cell',style:style+';background:'+c,'data-c':c,title:'Click to rotate colours',onclick:rotate});
  mag.pattern=((mag.pattern|0)%MAG_PATTERNS.length+MAG_PATTERNS.length)%MAG_PATTERNS.length;const pat=MAG_PATTERNS[mag.pattern];
  if(pat==='Panels'){const w=100/n;cols.forEach((c,i)=>stage.append(cell(`left:${i*w+1}%;top:4%;width:${w-2}%;height:92%`,c)));}
  else if(pat==='Nested'){cols.forEach((c,i)=>{const inset=i*(44/n);stage.append(cell(`left:${inset}%;top:${inset}%;right:${inset}%;bottom:${inset}%`,c));});}
  else if(pat==='Horizontal bars'){const hh=100/n;cols.forEach((c,i)=>stage.append(cell(`left:0;top:${i*hh}%;width:100%;height:${hh}%`,c)));}
  else if(pat==='Vertical stripes'){const reps=4;for(let r=0;r<reps;r++)cols.forEach((c,i)=>{const w=100/(n*reps);stage.append(cell(`left:${(r*n+i)*w}%;top:0;width:${w}%;height:100%`,c));});}
  else if(pat==='Vertical bars'){const w=100/n;cols.forEach((c,i)=>stage.append(cell(`left:${i*w}%;top:0;width:${w}%;height:100%`,c)));}
  else{// Diagonal: 45° stripes cycling through every colour; drawn as SVG parallelograms so the edges are sharp
    const W=56,H=3000,parts=[];for(let i=0,x=-H;x<H+W;x+=W,i++)parts.push(`<polygon points="${x},0 ${x+W},0 ${x+W-H},${H} ${x-H},${H}" fill="${cols[i%n]}" data-c="${cols[i%n]}"/>`);
    stage.append(h('div',{class:'cell diag',style:'left:0;top:0;width:100%;height:100%',title:'Click to rotate colours',onclick:rotate,html:`<svg width="100%" height="100%" aria-hidden="true">${parts.join('')}</svg>`}));
  }
  stage.append(h('div',{class:'sample'},h('span',{class:'light'},'Sample text'),h('span',{class:'dark'},'Sample text'),h('small',{style:'color:'+textOn(MAG_BG[mag.bg])},`${p.name} · palette ${mag.idx+1} of ${items.length}`)));
  const box=h('div',{class:'box'},
    h('button',{type:'button',class:'btn small close',onclick:closeModal},'Close ✕'),
    h('h2',null,'Magnified preview'),
    stage,
    h('div',{class:'mag-tools'},
      h('button',{type:'button',class:'btn small',onclick:()=>{mag.idx--;renderMagnify();},disabled:mag.idx===0?'':null},'‹ Prev'),
      h('span',{class:'counter'},`${mag.idx+1} of ${items.length}`),
      h('button',{type:'button',class:'btn small',onclick:()=>{mag.idx++;renderMagnify();},disabled:mag.idx>=items.length-1?'':null},'Next ›'),
      h('span',{style:'flex:1'}),
      h('button',{type:'button',class:'btn small',onclick:()=>{mag.pattern=(mag.pattern+1)%MAG_PATTERNS.length;renderMagnify();}},'Pattern: '+pat),
      h('button',{type:'button',class:'btn small',onclick:()=>{mag.bg=(mag.bg+1)%MAG_BG.length;renderMagnify();}},'Background'),
      h('button',{type:'button',class:'btn small',onclick:()=>{mag.rot=(mag.rot+1)%n;renderMagnify();}},'Rotate'),
      h('button',{type:'button',class:'btn small',onclick:()=>copyText(cols.join(', '),'Hex list copied')},'Copy HEX'),
      h('button',{type:'button',class:'btn small',onclick:()=>openPreview(mag.idx)},'Preview'),
      h('button',{type:'button',class:'btn small'+(inCurList(p)?' primary':''),onclick:()=>{toggleInList(p);renderMagnify();}},inCurList(p)?'★ Saved':'☆ Save')
    ),
    h('div',{class:'row',style:'margin-top:10px;gap:6px'},...cols.map(c=>h('span',{class:'contrast-note',style:'font-family:var(--mono)'},h('span',{style:'display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-right:4px;border:1px solid var(--border);background:'+c}),c.toUpperCase())))
  );
  openModal(box);magUpdateSample();
}
/* Second overlay line: pick white or near-black by the worst-case contrast against the colours actually under the text
   (sampled from the rendered cells, so it follows the pattern, Rotate, Background and the palette). */
function magUpdateSample(){
  const st=$('.mag-stage'),sm=st&&st.querySelector('.sample small');if(!sm)return;
  const rg=document.createRange();rg.selectNodeContents(sm);const r=rg.getBoundingClientRect();
  const under=new Set();
  if(r.width){for(let i=0;i<=10;i++){const x=r.left+1+(r.width-2)*i/10;for(const y of[r.top+2,(r.top+r.bottom)/2,r.bottom-2]){const e=document.elementsFromPoint(x,y).find(el=>el.dataset&&el.dataset.c&&st.contains(el));under.add(e?e.dataset.c:MAG_BG[mag.bg]);}}}
  if(!under.size)under.add(MAG_BG[mag.bg]);
  const[best,ratio]=['#ffffff','#111111'].map(c=>[c,Math.min(...[...under].map(u=>contrast(c,u)))]).sort((a,b)=>b[1]-a[1])[0];
  sm.style.color=best;sm.classList.toggle('on-dark',best==='#ffffff');sm.classList.toggle('on-light',best!=='#ffffff');sm.classList.toggle('on-mixed',ratio<3);
}
window.addEventListener('resize',()=>{if($('.mag-stage'))magUpdateSample();});

/* help / about */
function openHelp(){
  const box=h('div',{class:'box narrow'},
    h('button',{type:'button',class:'btn small close',onclick:closeModal},'Close ✕'),
    h('h2',null,'Hue Harbor — help'),
    h('p',null,'A color-palette browser that starts from any color you choose. Everything runs in this one file, offline; your lists and settings are kept in this browser only.'),
    h('h3',null,'Generate'),
    h('ul',null,h('li',null,'Pick a color with the square and hue bar, type HEX / RGB / HSL, use the eyedropper (browsers that support it) or the system dialog.'),h('li',null,'Choose a palette type. Mood types are built from the recovered 1990s color sets, re-tuned so your exact color is a member; theory and modern types are computed from color-wheel rules in HSL or the perceptual OKLCH space.'),h('li',null,'The ring-dot marks your color inside each palette.'),h('li',null,'The ',h('b',null,'Background'),' button in the top bar changes the page background behind the palettes to any colour (quick picks, a colour dial or a hex code); text on the page re-tints itself for contrast and Reset restores the theme default.'),h('li',null,h('b',null,'Single'),' shows one palette at a time (',h('kbd',null,'←'),' ',h('kbd',null,'→'),' or Back / Forward; click the counter to jump). ',h('b',null,'All'),' shows every palette as a grid or one per row; double-click a card to open it in Single view.')),
    h('h3',null,'Classic library'),
    h('p',null,'Browse the 3,400 recovered sets, 12 per page, by mood, theory scheme or one of the 152 base colors. Each set lists which scheme(s) it belonged to.'),
    h('h3',null,'Swatches & copying'),
    h('p',null,'Click any swatch for HEX, RGB, HSL, OKLCH, an estimated CMYK and the nearest classic base color (with its ink-number estimate). Use HEX / CSS / JSON on a card to copy the whole palette, or .ase / .gpl to download it as a swatch file (Adobe Swatch Exchange or GIMP palette). “All → .ase / .gpl” in the toolbar exports every palette shown for the current type and color. Magnify shows the palette in several layout patterns with sample text; click any area to rotate the colors. Preview applies the palette to original sample designs — a website, a poster, an interior, an outfit and a dashboard — with automatic colour roles (text picked for WCAG contrast, missing roles derived in OKLCH), Shuffle roles, a light/dark base, and a Your photo tab that recolours a sample scene or a photo you load (gradient map, posterize, duotone; the image never leaves your browser) with PNG download.'),
    h('h3',null,'My lists'),
    h('p',null,'Up to 30 custom lists. ☆ Save adds a palette to the current list; export / import as JSON to move them between browsers. Export .ase / .gpl writes the whole list as one swatch file for Photoshop / Illustrator (.ase) or GIMP / Inkscape / Krita (.gpl).'),
    h('h3',null,'Keyboard'),
    h('p',null,h('kbd',null,'←'),' / ',h('kbd',null,'→'),' previous / next · ',h('kbd',null,'Esc'),' close popups · arrow keys inside the color square nudge saturation / value.'),
    h('h3',null,'About'),
    h('p',null,'Hue Harbor is an independent, clean-room tribute to a 1990s interactive color-harmony guide. The numeric color data (152 base colors and 3,400 curated sets) was recovered from the abandoned original; no code, artwork, names or text from it were reused. CMYK values are naive estimates. Everything else here is new work.')
  );
  openModal(box);
}

/* ---------- colour picker ---------- */
const picker={h:210,s:80,v:90};
const svCanvas=$('#svCanvas'),svCtx=svCanvas.getContext('2d');
function drawSV(){const w=svCanvas.width,hh=svCanvas.height;svCtx.fillStyle=rgbToHex(...hsvToRgb(picker.h,100,100));svCtx.fillRect(0,0,w,hh);let g=svCtx.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');svCtx.fillStyle=g;svCtx.fillRect(0,0,w,hh);g=svCtx.createLinearGradient(0,0,0,hh);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,1)');svCtx.fillStyle=g;svCtx.fillRect(0,0,w,hh);}
function updatePickerUI(){
  drawSV();const th=$('#svThumb');th.style.left=picker.s+'%';th.style.top=(100-picker.v)+'%';th.style.background=S.color;
  $('#hueSlider').value=Math.round(picker.h);
  const f=fmt(S.color);$('#prevSwatch').style.background=S.color;
  const nb=nearestBase(S.color);$('#prevMeta').textContent=`${f.oklch} · classic ≈ #${nb.color.id} ${nb.color.label}`;
  if(document.activeElement!==$('#hexIn'))$('#hexIn').value=f.hex;
  if(document.activeElement!==$('#rgbIn'))$('#rgbIn').value=f.rgb.replace(/rgb\(|\)/g,'');
  if(document.activeElement!==$('#hslIn'))$('#hslIn').value=f.hsl.replace(/hsl\(|\)/g,'');
  $('#nativeColor').value=S.color;
}
let genTimer=null;
function setColor(hex,fromOutside){
  hex=normHex(hex);if(!hex)return;S.color=hex;
  if(fromOutside){const[hh,s,v]=rgbToHsv(...hexToRgb(hex));if(s>0.5&&v>0.5)picker.h=hh;picker.s=s;picker.v=v;}
  updatePickerUI();S.cur=0;S.page=0;save();
  clearTimeout(genTimer);genTimer=setTimeout(()=>{if(S.mode==='generate')render();},40);
}
function colorFromPicker(){S.color=rgbToHex(...hsvToRgb(picker.h,picker.s,picker.v));setColor(S.color,false);}
(function initPicker(){
  const box=$('#svBox');
  const fromEvent=e=>{const r=box.getBoundingClientRect();picker.s=clamp((e.clientX-r.left)/r.width*100,0,100);picker.v=clamp(100-(e.clientY-r.top)/r.height*100,0,100);colorFromPicker();};
  let drag=false;
  box.addEventListener('pointerdown',e=>{drag=true;box.setPointerCapture(e.pointerId);fromEvent(e);});
  // Firefox does not always deliver pointerup when the button is released outside the window, even with capture:
  // treat a move with no buttons pressed, loss of capture, or window blur as the end of the drag.
  box.addEventListener('pointermove',e=>{if(!drag)return;if(e.buttons===0){drag=false;return;}fromEvent(e);});
  const stop=()=>{drag=false;};
  box.addEventListener('pointerup',stop);box.addEventListener('pointercancel',stop);box.addEventListener('lostpointercapture',stop);window.addEventListener('blur',stop);
  box.addEventListener('keydown',e=>{const d=e.shiftKey?10:2;let used=true;switch(e.key){case'ArrowLeft':picker.s=clamp(picker.s-d,0,100);break;case'ArrowRight':picker.s=clamp(picker.s+d,0,100);break;case'ArrowUp':picker.v=clamp(picker.v+d,0,100);break;case'ArrowDown':picker.v=clamp(picker.v-d,0,100);break;default:used=false;}if(used){e.preventDefault();e.stopPropagation();colorFromPicker();}});
  $('#hueSlider').addEventListener('input',e=>{picker.h=+e.target.value;colorFromPicker();});
  $('#hueSlider').addEventListener('keydown',e=>e.stopPropagation());
  $('#nativeColor').addEventListener('input',e=>setColor(e.target.value,true));
  const parseField=(id,fn)=>{const el=$('#'+id);const go=()=>{const hex=fn(el.value);if(hex){setColor(hex,true);el.style.borderColor='';}else el.style.borderColor='var(--danger)';};el.addEventListener('change',go);el.addEventListener('keydown',e=>{if(e.key==='Enter'){go();el.blur();}e.stopPropagation();});};
  parseField('hexIn',v=>normHex(v.trim()));
  parseField('rgbIn',v=>{const m=v.match(/-?\d+(\.\d+)?/g);if(!m||m.length<3)return null;return rgbToHex(clamp(+m[0],0,255),clamp(+m[1],0,255),clamp(+m[2],0,255));});
  parseField('hslIn',v=>{const m=v.match(/-?\d+(\.\d+)?/g);if(!m||m.length<3)return null;return hsl(+m[0],clamp(+m[1],0,100),clamp(+m[2],0,100));});
  const eye=$('#eyeBtn');
  if(window.EyeDropper){eye.addEventListener('click',async()=>{try{const r=await new EyeDropper().open();setColor(r.sRGBHex,true);}catch(e){}});}
  else{eye.disabled=true;eye.title='The EyeDropper API is not available in this browser (Chrome/Edge on desktop support it).';}
  const quick=['#d7263d','#f46036','#f7b32b','#2e933c','#0ead69','#1b998b','#2f6fed','#3f37c9','#7b2cbf','#c9184a','#8d6e63','#495057'];
  $('#quickChips').append(...quick.map(c=>h('button',{type:'button',class:'chip',style:'background:'+c,'aria-label':'Use '+c,title:c,onclick:()=>setColor(c,true)})));
})();

/* ---------- type list ---------- */
function buildTypeList(){
  const wrap=$('#typeGroups');wrap.innerHTML='';
  for(const g of TYPE_GROUPS){
    const list=h('div',{class:'typelist',role:'group','aria-label':g.name});
    g.items.forEach((t,i)=>{list.append(h('button',{type:'button','aria-pressed':String(S.type===t),onclick:()=>{S.type=t;S.cur=0;S.page=0;save();buildTypeList();render();}},t));if(g.sepAfter.includes(i))list.append(h('hr'));});
    wrap.append(h('div',{class:'typegroup'},h('h3',null,g.name),list));
  }
}

/* ---------- library filters ---------- */
function buildLibrary(){
  const ms=$('#libMood'),ss=$('#libSci');ms.innerHTML='';ss.innerHTML='';
  MOODS.forEach(m=>ms.append(h('option',{value:m,selected:m===S.libMood?'':null},m)));
  SCI.forEach(m=>ss.append(h('option',{value:m,selected:m===S.libSci?'':null},m)));
  ms.addEventListener('change',()=>{S.libMood=ms.value;S.page=0;S.cur=0;save();render();});
  ss.addEventListener('change',()=>{S.libSci=ss.value;S.page=0;S.cur=0;save();render();});
  $$('#libKind button').forEach(b=>b.addEventListener('click',()=>{S.libKind=b.dataset.kind;S.page=0;S.cur=0;save();syncLibKind();render();}));
  const grid=$('#baseGrid');grid.innerHTML='';
  for(let row=1;row<=10;row++)for(let col=0;col<16;col++){
    const p=PALETTE.find(x=>x.row===row&&x.col===col);
    if(!p){grid.append(h('span',{class:'blank'}));continue;}
    grid.append(h('button',{type:'button',style:'background:'+p.hex,title:`#${p.id} ${p.label} (${p.hex})`,'aria-label':`${p.label}`,'aria-pressed':String(p.id===S.libColor),onclick:()=>{S.libColor=p.id;S.page=0;S.cur=0;save();syncLibKind();render();}}));
  }
  grid.append(h('button',{type:'button',style:'background:#000',title:'#255 Black','aria-label':'Black','aria-pressed':String(S.libColor===255),onclick:()=>{S.libColor=255;S.page=0;S.cur=0;save();syncLibKind();render();}}));
  $('#nearestBaseBtn').addEventListener('click',()=>{S.libColor=nearestBase(S.color).color.id;S.page=0;S.cur=0;save();syncLibKind();render();});
  syncLibKind();
}
function syncLibKind(){
  $$('#libKind button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===S.libKind)));
  $('#libMoodWrap').classList.toggle('hidden',S.libKind!=='mood');
  $('#libSciWrap').classList.toggle('hidden',S.libKind!=='sci');
  $('#libColorWrap').classList.toggle('hidden',S.libKind!=='color');
  $$('#baseGrid button').forEach(b=>{const id=b.title.match(/#(\d+)/);b.setAttribute('aria-pressed',String(id&&+id[1]===S.libColor));});
  const p=PAL_BY_ID.get(S.libColor);$('#baseGridName').textContent=p?`Selected: #${p.id} ${p.label} · ${p.hex.toUpperCase()} · ink ≈ ${p.dic}`:'';
  $('#libMood').value=S.libMood;$('#libSci').value=S.libSci;
}

/* ---------- lists UI ---------- */
function cleanName(n){n=(n||'').replace(/[^A-Za-z0-9 \-_]/g,'').trim().slice(0,30);return n||'Untitled';}
function uniqueName(n,skip){let base=n,i=2;while(LISTS.some((l,ix)=>ix!==skip&&l.name.toLowerCase()===n.toLowerCase()))n=base+' '+i++;return n;}
function buildListUI(){
  const sel=$('#listSelect');sel.innerHTML='';LISTS.forEach((l,i)=>sel.append(h('option',{value:i,selected:i===S.curList?'':null},`${l.name} (${l.items.length})`)));
  $('#listNew').disabled=LISTS.length>=30;$('#listImport').disabled=LISTS.length>=30;$('#listDelete').disabled=LISTS.length<=1;
}
(function initLists(){
  $('#listSelect').addEventListener('change',e=>{S.curList=+e.target.value;S.cur=0;S.page=0;save();render();});
  $('#listNew').addEventListener('click',()=>{if(LISTS.length>=30)return toast('Limit of 30 lists reached');const n=prompt('Name for the new list:','Untitled');if(n===null)return;LISTS.push({name:uniqueName(cleanName(n)),items:[]});S.curList=LISTS.length-1;saveLists();save();buildListUI();render();});
  $('#listRename').addEventListener('click',()=>{const l=curList();const n=prompt('Rename list:',l.name);if(n===null)return;l.name=uniqueName(cleanName(n),S.curList);saveLists();buildListUI();render();});
  $('#listDelete').addEventListener('click',()=>{if(LISTS.length<=1)return toast('Keep at least one list');const l=curList();if(!confirm(`Delete list “${l.name}” (${l.items.length} palettes)?`))return;LISTS.splice(S.curList,1);S.curList=0;saveLists();save();buildListUI();render();});
  $('#listExport').addEventListener('click',()=>{const l=curList();const blob=new Blob([JSON.stringify({app:'Hue Harbor',version:1,lists:[l]},null,2)],{type:'application/json'});const a=h('a',{href:URL.createObjectURL(blob),download:l.name.replace(/\s+/g,'_')+'.json'});document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);toast('Exported “'+l.name+'”');});
  $('#listImport').addEventListener('click',()=>$('#listImportFile').click());
  $('#listExportAse').addEventListener('click',()=>{const l=curList();exportMany('List: '+l.name,l.items,slugify(l.name),'ase');});
  $('#listExportGpl').addEventListener('click',()=>{const l=curList();exportMany('List: '+l.name,l.items,slugify(l.name),'gpl');});
  $('#exportAllAse').addEventListener('click',()=>exportCollection('ase'));
  $('#exportAllGpl').addEventListener('click',()=>exportCollection('gpl'));
  $('#listImportFile').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(f.size>5e6)return toast('That file is too large to be a Hue Harbor list');try{const j=JSON.parse(await f.text());const arr=Array.isArray(j)?j:Array.isArray(j.lists)?j.lists:[j];let added=0;for(const raw of arr){if(LISTS.length>=30){toast('Limit of 30 lists reached — some lists were not imported');break;}const l=cleanList(raw);if(!l)continue;l.name=uniqueName(l.name);LISTS.push(l);added++;}if(!added)return toast('No lists found in that file');S.curList=LISTS.length-1;saveLists();save();buildListUI();render();toast(`Imported ${added} list${added===1?'':'s'}`);}catch(err){toast('Could not read that file as JSON');}});
})();

/* ---------- modes, views, theme ---------- */
function setMode(m){S.mode=m;S.cur=0;S.page=0;save();applyMode();render();}
function applyMode(){
  $$('nav.modes button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===S.mode)));
  $('#pickerCard').classList.toggle('hidden',S.mode!=='generate');
  $('#typeCard').classList.toggle('hidden',S.mode!=='generate');
  $('#libCard').classList.toggle('hidden',S.mode!=='library');
  $('#listCard').classList.toggle('hidden',S.mode!=='lists');
  if(S.mode==='lists')buildListUI();
}
$$('nav.modes button').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$$('#viewSeg button').forEach(b=>b.addEventListener('click',()=>{S.view=b.dataset.view;if(S.view==='multi')S.page=Math.floor(S.cur/pageSize());save();render();}));
$$('#layoutSeg button').forEach(b=>b.addEventListener('click',()=>{S.layout=b.dataset.layout;save();render();}));
function applyTheme(){document.documentElement.setAttribute('data-theme',S.theme);$('#themeBtn').textContent=S.theme==='dark'?'☀':'☾';applyBg();}
$('#themeBtn').addEventListener('click',()=>{S.theme=S.theme==='dark'?'light':'dark';save();applyTheme();});

/* ---------- page background colour ----------
   S.bg = null (theme default) or a hex. Overrides --bg, --text and --muted on <html> so text that sits
   directly on the page background stays readable; cards/panels keep their own surface colours. */
const BG_QUICK=['#ffffff','#d4d0c8','#bfbfbf','#808080','#000000'];
function mixHex(a,b,t){const A=hexToRgb(a),B=hexToRgb(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');}
function applyBg(){
  const root=document.documentElement.style;
  if(!S.bg){['--bg','--page-text','--page-muted'].forEach(v=>root.removeProperty(v));}
  else{
    const dark=contrast(S.bg,'#000000')<contrast(S.bg,'#ffffff');// pick the foreground with the higher WCAG contrast
    root.setProperty('--bg',S.bg);
    // muted text: soften the foreground toward the background only as far as WCAG AA (4.5:1) allows
    let fg=dark?'#f4f5f7':'#15171b';if(contrast(fg,S.bg)<7)fg=dark?'#ffffff':'#000000';// mid-tones: use pure black/white for maximum contrast
    root.setProperty('--page-text',fg);
    let t=dark?.3:.4,muted=mixHex(fg,S.bg,t);
    while(t>0&&contrast(muted,S.bg)<4.6){t-=.05;muted=mixHex(fg,S.bg,t);}
    root.setProperty('--page-muted',muted);
  }
  const sw=$('#bgSwatch');if(sw)sw.style.background=S.bg||'';
  $$('.bg-pop .bgchip').forEach(c=>c.setAttribute('aria-pressed',String((c.dataset.bg||'')===(S.bg||''))));
  const pop=$('.bg-pop');if(pop){const cur=S.bg||getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();pop.querySelector('input[type=color]').value=cur;const t=pop.querySelector('input[type=text]');if(document.activeElement!==t)t.value=cur.toUpperCase();}
}
function setBg(hex){S.bg=hex?normHex(hex):null;save();applyBg();}
function showBgPop(ev){
  if($('.bg-pop')){closePops();return;}
  closePops();
  const cur=S.bg||getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const color=h('input',{type:'color',value:cur,'aria-label':'Pick a background colour',oninput:e=>setBg(e.target.value)});
  const text=h('input',{type:'text',value:cur.toUpperCase(),spellcheck:'false',maxlength:'7',placeholder:'#RRGGBB','aria-label':'Background hex',oninput:e=>{const v=normHex(e.target.value);if(v)setBg(v);},onkeydown:e=>{if(e.key==='Enter'){const v=normHex(e.target.value);if(v){setBg(v);closePops();}else toast('Enter a hex colour like #D4D0C8');}}});
  const chips=h('div',{class:'bgchips'},
    ...BG_QUICK.map(c=>h('button',{type:'button',class:'bgchip','data-bg':c,title:'Set background to '+c.toUpperCase(),onclick:()=>setBg(c)},h('span',{class:'dot',style:'background:'+c}),c.toUpperCase())),
    h('button',{type:'button',class:'bgchip reset','data-bg':'',title:'Restore the theme default',onclick:()=>setBg(null)},'Reset'));
  const pop=h('div',{class:'pop bg-pop',role:'dialog','aria-label':'Page background colour'},
    h('div',{class:'head'},h('div',{class:'ttl'},'Page background',h('small',null,'Behind the palettes · text adapts for contrast'))),
    h('div',{class:'row'},color,text),chips,
    h('p',{class:'contrast-note hint'},'Cards keep their own surface colour. Reset returns to the '+S.theme+' theme default.'));
  const r=ev.currentTarget.getBoundingClientRect();placePop(pop,r.left-8,r.bottom);applyBg();
}
$('#bgBtn').addEventListener('click',showBgPop);
$('#helpBtn').addEventListener('click',openHelp);
$('#infoBtn').addEventListener('click',showInfoPop);
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closePops();closeModal();return;}
  const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable))return;
  if($('#modalLayer').children.length){if($('.pv-box')){if(e.key==='ArrowLeft')pvStep(-1);else if(e.key==='ArrowRight')pvStep(1);}else if($('.mag-stage')){if(e.key==='ArrowLeft'){mag.idx--;renderMagnify();}else if(e.key==='ArrowRight'){mag.idx++;renderMagnify();}}return;}
  if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}else if(e.key==='ArrowRight'){e.preventDefault();step(1);}
});

/* ---------- boot ---------- */
applyTheme();
buildTypeList();
buildLibrary();
buildListUI();
applyMode();
setColor(S.color,true);
render();
