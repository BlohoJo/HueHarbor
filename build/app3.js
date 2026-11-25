/* =====================================================================
   Part 3: Preview — a palette applied to sample designs and photos
   All scenes are original inline SVG drawn here; the photo scene is a canvas.
   ===================================================================== */

const PV_SCENES=[['web','Website'],['poster','Poster'],['room','Interior'],['outfit','Outfit'],['dash','Dashboard'],['product','Products'],['pack','Packaging'],['sign','Signage'],['text','Text'],['photo','Your photo']];
const PV_EFFECTS=[['gradient','Gradient map'],['poster','Posterize'],['duo','Duotone']];
let pv={idx:0,scene:0,shuffle:0,base:null,effect:'gradient',duoA:0,duoB:1,intensity:1,src:null,fullSrc:null,full:null,srcName:'sample',busy:false,raf:0,
  precise:false,exact:{web:true,poster:true,room:true,outfit:true,dash:true,product:true,pack:true,sign:true,text:true},productSet:0,font:'system',editText:false,txt:null};

/* ---------- colour helpers ---------- */
function pvShift(hex,dL,cMul){const[l,c,hh]=hexToOklch(hex);return oklchToHex(clamp(l+dL,0,1),c*(cMul===undefined?1:cMul),hh);}
function pvL(hex){return hexToOklch(hex)[0];}
/* Assign colour roles (normal mode). shuffle cycles 2n variants: n "soft" (derived neutral background) + n "bold" (a palette colour drives the background).
   Light/Dark (base) must change every variant: in the bold half the palette colour is used as-is when its lightness suits the base,
   otherwise the base's lightness is applied to that colour's hue so the scene still flips between light and dark. */
function pvRoles(colors,shuffle,base){
  const n=colors.length,k=((shuffle%(2*n))+2*n)%(2*n),dark=base==='dark';
  const rot=colors.map((_,i)=>colors[(i+k)%n]);
  const byL=[...rot].sort((a,b)=>pvL(a)-pvL(b));
  let bg,surface,bold=k>=n;
  if(bold){
    const c0=rot[0],[l,c,hh]=hexToOklch(c0);
    bg=(dark?l<.5:l>=.5)?c0:oklchToHex(dark?.24:.92,Math.min(c,dark?.09:.07),hh);
    surface=pvShift(bg,pvL(bg)>.5?-.07:.09,.9);
  }else{
    const ref=dark?byL[0]:byL[n-1];const[l,c,hh]=hexToOklch(ref);
    bg=dark?(l<.27?ref:oklchToHex(.19,Math.min(c,.05),hh)):(l>.9?ref:oklchToHex(.962,Math.min(c,.03),hh));
    surface=dark?oklchToHex(Math.min(pvL(bg)+.07,1),Math.min(c,.06),hh):oklchToHex(.992,Math.min(c,.015),hh);
  }
  // text: a palette colour if it reaches 7:1, else a derived near-black / near-white in the background's hue
  const cands=rot.filter(c=>c!==bg).sort((a,b)=>contrast(b,bg)-contrast(a,bg));
  let text;if(cands.length&&contrast(cands[0],bg)>=7)text=cands[0];
  else{const[l,c,hh]=hexToOklch(bg);const opts=[oklchToHex(.2,Math.min(c,.04),hh),oklchToHex(.975,Math.min(c,.02),hh),'#000000','#ffffff'];text=opts.find(o=>contrast(o,bg)>=4.5)||opts.sort((a,b)=>contrast(b,bg)-contrast(a,bg))[0];}
  const chrom=rot.filter(c=>c!==bg&&c!==text);
  const fix=c=>contrast(c,bg)<1.6?pvShift(c,pvL(bg)>.5?-.3:.3):c;// keep buttons visible on their background
  let primary=fix(chrom[0]||rot[0]);
  let accent=chrom[1]?fix(chrom[1]):(()=>{const[l,c,hh]=hexToOklch(primary);return oklchToHex(clamp(l+(l>.5?-.18:.18),0,1),Math.max(c,.08),hh+40);})();
  const secondary=chrom[2]?fix(chrom[2]):pvShift(accent,pvL(accent)>.5?-.2:.2);
  const tertiary=chrom[3]?fix(chrom[3]):pvShift(primary,pvL(primary)>.5?-.22:.22,.8);
  return pvFinish({bg,surface,text,primary,accent,secondary,tertiary,all:rot,bold,dark,exact:[]});
}
/* Derived helpers shared by both role modes: muted text, floor shade, on-colour text, readable accent/primary text */
function pvFinish(R){
  const{bg,text,primary,accent,secondary,dark}=R;
  let t=.42,muted=mixHex(text,bg,t);while(t>0&&contrast(muted,bg)<4.5){t-=.06;muted=mixHex(text,bg,t);}
  const on=c=>R.exact.length?pvOnExact(c,R,false):textOn(c);
  return Object.assign(R,{muted,floor:dark?pvShift(bg,.06,.9):pvShift(bg,-.08,1.4),onPrimary:on(primary),onAccent:on(accent),onSecondary:on(secondary),accentText:contrast(accent,bg)>=3?accent:text,primaryText:contrast(primary,bg)>=3?primary:text});
}
/* The palette colour that reads best on `c` (used for button labels in Precise mode so every visible colour stays exact) */
function pvOnExact(c,R,strict){const b=[...R.exact].sort((a,b)=>contrast(b,c)-contrast(a,c))[0];return b&&(strict||contrast(b,c)>=3)?b:textOn(c);}

/* ---------- Precise mode: every palette colour appears with its exact value ----------
   Order: background = k-th colour from the dark end (Dark base) or the light end (Light base); text = the remaining colour with the
   highest contrast on it; then surface (closest in lightness to the background, so text stays readable on cards), primary, accent, extras.
   shuffle cycles 2n variants: n backgrounds × 2 orders for the remaining roles. */
function pvExactOrder(colors,shuffle,base){
  const n=colors.length,k=((shuffle%(2*n))+2*n)%(2*n),dark=base==='dark';
  const asc=[...colors].sort((a,b)=>pvL(a)-pvL(b)),seq=dark?asc:[...asc].reverse();
  const bg=seq[k%n];let rest=seq.filter(c=>c!==bg);if(k>=n)rest.reverse();
  const text=rest.length?[...rest].sort((a,b)=>contrast(b,bg)-contrast(a,bg))[0]:bg;rest=rest.filter(c=>c!==text);
  let surface=null;if(rest.length>=2){surface=[...rest].sort((a,b)=>Math.abs(pvL(a)-pvL(bg))-Math.abs(pvL(b)-pvL(bg)))[0];rest=rest.filter(c=>c!==surface);}
  const[primary=null,accent=null,...extras]=rest;
  return{bg,text,surface,primary,accent,extras,dark,n,k};
}
/* Precise roles for the existing (5+ role) layouts: palette colours fill background, text, primary, accent, surface in that order of
   importance; roles the palette cannot fill are derived from the palette in keeping with its type/rule (pvDeriveExtra). */
function pvPreciseRoles(p,shuffle,base){
  const colors=p.colors,o=pvExactOrder(colors,shuffle,base),bg=o.bg,text=o.text;
  const want=[];const need=k=>{want.push(k);};
  let primary=o.primary,accent=o.accent,surface=o.surface;
  // with 4 colours the fourth is more useful as the accent than as a surface
  if(colors.length===4){accent=surface;surface=null;}
  if(colors.length===3){primary=o.primary;}
  if(!primary)need('primary');if(!accent)need('accent');
  const extra=pvDeriveExtra(p,[bg,text,primary,accent].filter(Boolean),want.length+2,o.dark);
  let e=0;if(!primary)primary=extra[e++];if(!accent)accent=extra[e++];
  const secondary=o.extras[0]||extra[e++],tertiary=o.extras[1]||extra[e++];
  if(!surface)surface=pvShift(bg,pvL(bg)>.5?-.045:.06,.95);
  return pvFinish({bg,surface,text,primary,accent,secondary,tertiary,all:colors,bold:false,dark:o.dark,exact:colors.slice(),extras:o.extras.slice(2)});
}
/* Extra colours "in the spirit of" a palette. Hue-based schemes get hues that fill the largest gaps on the wheel at the palette's own
   lightness/chroma; monochrome and tone schemes get lightness steps of the anchor hue; mood, template and classic-set palettes
   (and anything else) get lightness variations of their own colours, so the family stays recognisable. */
const PV_HUE_SCHEMES=['Complementary','Split Complementary','Clash','Compound','Rectangle (Double Complementary)','Tetradic (Square)','Triadic','Primary','Secondary','Tertiary','Perceptual Triad','Perceptual Complement','Distinct','Accented Analogous','Analogous','Similar','Perceptual Analogous','Pastel','Neon / Vivid','Muted / Dusty','High Contrast (WCAG)'];
const PV_MONO_SCHEMES=['Monochromatic','Shades','Tints','Tones','Achromatic','Neutral'];
function pvDeriveExtra(p,used,count,dark){
  const cols=p.colors,lch=cols.map(hexToOklch),out=[];
  const midL=lch.map(x=>x[0]).sort((a,b)=>a-b)[lch.length>>1],midC=lch.map(x=>x[1]).sort((a,b)=>a-b)[lch.length>>1];
  const L=clamp(dark?Math.max(midL,.58):Math.min(Math.max(midL,.35),.62),.3,.75);// readable on the chosen background
  const type=p.type||'';const anchor=cols[p.anchor>=0&&p.anchor<cols.length?p.anchor:0];const[aL,aC,aH]=hexToOklch(anchor);
  if(PV_MONO_SCHEMES.includes(type)){
    const steps=[-.22,.22,-.38,.38,-.12,.12];for(const d of steps){if(out.length>=count)break;out.push(oklchToHex(clamp(aL+d,.2,.85),type==='Tones'?aC*.5:aC,aH));}
  }else if(PV_HUE_SCHEMES.includes(type)&&lch.some(x=>x[1]>.03)){
    const hues=lch.filter(x=>x[1]>.03).map(x=>x[2]).sort((a,b)=>a-b);
    const gaps=hues.map((hh,i)=>{const nx=hues[(i+1)%hues.length]+(i===hues.length-1?360:0);return[nx-hh,(hh+nx)/2%360];}).sort((a,b)=>b[0]-a[0]);
    const near=['Analogous','Similar','Perceptual Analogous','Accented Analogous'].includes(type);
    const cand=near?[aH+22,aH-22,aH+44,aH-44]:gaps.map(g=>g[1]).concat(gaps.map(g=>g[1]+30));
    for(const hh of cand){if(out.length>=count)break;out.push(oklchToHex(L,Math.max(midC,.06),(hh+360)%360));}
  }
  let i=0;while(out.length<count){const[l,c,hh]=lch[i%lch.length];const d=(i<lch.length?1:-1)*(dark?.22:-.22);out.push(oklchToHex(clamp(l+d,.2,.88),c,hh));i++;if(i>lch.length*2+2)break;}
  // never return a colour that is already used (or a duplicate); nudge instead
  const seen=new Set(used.map(c=>c.toLowerCase()));
  return out.map(c=>{let hx=c,tries=0;while(seen.has(hx.toLowerCase())&&tries<6){hx=pvShift(hx,.05*(tries%2?-1:1)*(tries+1));tries++;}seen.add(hx.toLowerCase());return hx;});
}
/* Exact-count roles: nothing derived. 2 = background + text; 3 = + primary; 4 = + surface; 5 = + accent; more = extras. */
function pvExactRoles(colors,shuffle,base){
  const o=pvExactOrder(colors,shuffle,base),n=colors.length;
  let{bg,text,surface,primary,accent,extras}=o;
  if(n===4){/* fourth colour: surface for cards */ }
  const X={bg,text,primary:primary||text,surface:surface||bg,accent:accent||primary||text,extras,n,all:colors,dark:o.dark,exact:colors.slice()};
  X.has={surface:!!surface,primary:!!primary,accent:!!accent};
  X.on=c=>pvOnExact(c,X,true);
  // text set in the primary/accent colour falls back to the text colour when it would not read on the background (shapes still show the exact colour)
  X.pt=contrast(X.primary,bg)>=3?X.primary:text;X.at=contrast(X.accent,bg)>=3?X.accent:text;
  X.roles=[['Background',bg],['Text',text]];if(primary)X.roles.splice(1,0,['Primary',primary]);if(surface)X.roles.splice(1,0,['Surface',surface]);if(accent)X.roles.splice(X.roles.length-1,0,['Accent',accent]);
  extras.forEach((c,i)=>X.roles.splice(X.roles.length-1,0,['Colour '+(i+6),c]));
  return X;
}

/* ---------- scenes (original SVG) ---------- */
const PV_F='font-family="system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"';
function pvSvg(inner){return`<svg viewBox="0 0 800 500" width="100%" height="100%" ${PV_F} role="img">${inner}</svg>`;}
/* ---------- Products scene: four flat products on a 2 × 2 grid of cards ----------
   One drawing routine shared by the normal layout and the exact-count layouts; only the colour map differs, so the
   geometry is identical in every mode. C = {bg, card, stroke, label, hp, tum, watch, pad, shoe, bag, phone, mug, lamp, chair, vase, pillow} (see pvProductMap). */
const PV_PRODUCT_SETS=[['tech','Tech','Headphones, tumbler, smartwatch and controller'],['everyday','Everyday','Sneaker, backpack, phone case and coffee mug'],['home','Home','Table lamp, armchair, vase and throw pillow']];
const PV_PRODUCT_CARDS=[[[16,16,'HEADPHONES'],[408,16,'TUMBLER'],[16,258,'SMARTWATCH'],[408,258,'CONTROLLER']],
  [[16,16,'SNEAKER'],[408,16,'BACKPACK'],[16,258,'PHONE CASE'],[408,258,'COFFEE MUG']],
  [[16,16,'TABLE LAMP'],[408,16,'ARMCHAIR'],[16,258,'VASE'],[408,258,'THROW PILLOW']]];
function pvProductSvg(C){
  const set=PV_PRODUCT_SETS[pv.productSet]?pv.productSet:0;
  const card=(x,y)=>`<rect x="${x}" y="${y}" width="376" height="226" rx="16" fill="${C.card||'none'}"${C.stroke?` stroke="${C.stroke}" stroke-width="2"`:''}/>`;
  const label=(x,y,t)=>`<text x="${x+18}" y="${y+30}" font-size="12" font-weight="800" letter-spacing="2" fill="${C.label}">${t}</text>`;
  const headphones=(cx,cy)=>{const c=C.hp,arc=`M${cx-84} ${cy+22} C${cx-84} ${cy-96} ${cx+84} ${cy-96} ${cx+84} ${cy+22}`;
    return`<path d="${arc}" fill="none" stroke="${c.band}" stroke-width="18" stroke-linecap="round"/><path d="${arc}" fill="none" stroke="${c.yoke}" stroke-width="5" stroke-linecap="round"/>
<rect x="${cx-94}" y="${cy+4}" width="20" height="30" rx="6" fill="${c.yoke}"/><rect x="${cx+74}" y="${cy+4}" width="20" height="30" rx="6" fill="${c.yoke}"/>
<ellipse cx="${cx-84}" cy="${cy+44}" rx="40" ry="46" fill="${c.cup}"/><ellipse cx="${cx+84}" cy="${cy+44}" rx="40" ry="46" fill="${c.cup}"/>
<ellipse cx="${cx-84}" cy="${cy+44}" rx="26" ry="32" fill="${c.pad}"/><ellipse cx="${cx+84}" cy="${cy+44}" rx="26" ry="32" fill="${c.pad}"/>`;};
  const tumbler=(cx,cy)=>{const c=C.tum;
    return`<path d="M${cx-46} ${cy-56} h92 v124 a16 16 0 0 1 -16 16 h-60 a16 16 0 0 1 -16 -16 z" fill="${c.body}"/>
<rect x="${cx-52}" y="${cy-84}" width="104" height="32" rx="9" fill="${c.lid}"/><rect x="${cx-22}" y="${cy-100}" width="44" height="20" rx="7" fill="${c.lid}"/>
<rect x="${cx-46}" y="${cy+2}" width="92" height="38" fill="${c.band}"/>
<path d="M${cx-46} ${cy+62} h92 v6 a16 16 0 0 1 -16 16 h-60 a16 16 0 0 1 -16 -16 z" fill="${c.base}"/>`;};
  const watch=(cx,cy)=>{const c=C.watch;
    return`<rect x="${cx-30}" y="${cy-98}" width="60" height="196" rx="16" fill="${c.band}"/>
<rect x="${cx-54}" y="${cy-62}" width="108" height="124" rx="26" fill="${c.case}"/><rect x="${cx-42}" y="${cy-50}" width="84" height="100" rx="18" fill="${c.screen}"/>
<rect x="${cx+54}" y="${cy-26}" width="10" height="26" rx="3" fill="${c.crown}"/><rect x="${cx+54}" y="${cy+8}" width="8" height="18" rx="3" fill="${c.crown}"/>
<circle cx="${cx}" cy="${cy-8}" r="24" fill="none" stroke="${c.ring}" stroke-width="7" stroke-dasharray="112 40" transform="rotate(-90 ${cx} ${cy-8})"/>
<text x="${cx}" y="${cy+36}" text-anchor="middle" font-size="14" font-weight="700" fill="${c.time}">10:09</text>`;};
  const controller=(cx,cy)=>{const c=C.pad;
    return`<path d="M${cx-96} ${cy-44} h192 a34 34 0 0 1 34 34 l16 72 a30 30 0 0 1 -56 14 l-28 -20 h-124 l-28 20 a30 30 0 0 1 -56 -14 l16 -72 a34 34 0 0 1 34 -34 z" fill="${c.body}"/>
<circle cx="${cx-62}" cy="${cy-6}" r="19" fill="${c.stick}"/><circle cx="${cx-62}" cy="${cy-6}" r="11" fill="${c.stickTop}"/>
<rect x="${cx-34}" y="${cy+6}" width="16" height="40" rx="3" fill="${c.dpad}"/><rect x="${cx-46}" y="${cy+18}" width="40" height="16" rx="3" fill="${c.dpad}"/>
<circle cx="${cx+62}" cy="${cy-24}" r="8" fill="${c.btnA}"/><circle cx="${cx+62}" cy="${cy+12}" r="8" fill="${c.btnB}"/><circle cx="${cx+44}" cy="${cy-6}" r="8" fill="${c.btnB}"/><circle cx="${cx+80}" cy="${cy-6}" r="8" fill="${c.btnA}"/>
<circle cx="${cx+26}" cy="${cy+26}" r="19" fill="${c.stick}"/><circle cx="${cx+26}" cy="${cy+26}" r="11" fill="${c.stickTop}"/>
<rect x="${cx-14}" y="${cy-14}" width="10" height="6" rx="3" fill="${c.dpad}"/><rect x="${cx+4}" y="${cy-14}" width="10" height="6" rx="3" fill="${c.dpad}"/>`;};
  /* second set: everyday objects (original shapes, no logos) */
  const sneaker=(cx,cy)=>{const c=C.shoe;
    return`<path d="M${cx-100} ${cy+34} h200 a12 12 0 0 1 0 24 h-188 a12 12 0 0 1 -12 -12 z" fill="${c.sole}"/>
<path d="M${cx-100} ${cy+22} h196 a10 10 0 0 1 4 12 h-200 z" fill="${c.mid}"/>
<path d="M${cx-100} ${cy+22} c0 -26 6 -50 24 -62 c20 -14 44 -10 62 2 c22 14 40 34 70 40 c18 4 34 10 40 20 z" fill="${c.upper}"/>
<path d="M${cx-18} ${cy-28} c18 14 36 30 66 36 c10 2 20 5 26 9 l-30 5 c-30 -6 -50 -22 -70 -38 z" fill="${c.stripe}"/>
<path d="M${cx-62} ${cy-22} l28 14 M${cx-56} ${cy-8} l26 12 M${cx-50} ${cy+6} l24 10" stroke="${c.lace}" stroke-width="5" stroke-linecap="round" fill="none"/>
<path d="M${cx-82} ${cy+22} v-24 a18 18 0 0 1 18 -18" stroke="${c.lace}" stroke-width="4" fill="none" stroke-linecap="round"/>`;};
  const backpack=(cx,cy)=>{const c=C.bag;
    return`<rect x="${cx-70}" y="${cy-52}" width="28" height="140" rx="10" fill="${c.strap}"/><rect x="${cx+42}" y="${cy-52}" width="28" height="140" rx="10" fill="${c.strap}"/>
<path d="M${cx-24} ${cy-96} a24 24 0 0 1 48 0" stroke="${c.strap}" stroke-width="10" fill="none" stroke-linecap="round"/>
<rect x="${cx-62}" y="${cy-84}" width="124" height="172" rx="30" fill="${c.body}"/>
<rect x="${cx-46}" y="${cy+8}" width="92" height="66" rx="16" fill="${c.pocket}"/>
<path d="M${cx-46} ${cy+28} h92" stroke="${c.zip}" stroke-width="4"/><circle cx="${cx+22}" cy="${cy+28}" r="5" fill="${c.zip}"/>
<path d="M${cx-40} ${cy-42} h80" stroke="${c.zip}" stroke-width="4" stroke-linecap="round"/><circle cx="${cx-10}" cy="${cy-42}" r="5" fill="${c.zip}"/>`;};
  const phone=(cx,cy)=>{const c=C.phone;
    return`<rect x="${cx-54}" y="${cy-102}" width="108" height="204" rx="22" fill="${c.case}"/>
<rect x="${cx+54}" y="${cy-56}" width="6" height="22" rx="2" fill="${c.button}"/><rect x="${cx+54}" y="${cy-26}" width="6" height="34" rx="2" fill="${c.button}"/>
<rect x="${cx-42}" y="${cy-90}" width="50" height="60" rx="14" fill="${c.bump}"/>
<circle cx="${cx-27}" cy="${cy-74}" r="8" fill="${c.lens}"/><circle cx="${cx-7}" cy="${cy-74}" r="8" fill="${c.lens}"/><circle cx="${cx-27}" cy="${cy-48}" r="8" fill="${c.lens}"/><circle cx="${cx-7}" cy="${cy-48}" r="4" fill="${c.button}"/>
<path d="M${cx-30} ${cy+50} h60" stroke="${c.button}" stroke-width="4" stroke-linecap="round"/>`;};
  const mug=(cx,cy)=>{const c=C.mug;
    return`<ellipse cx="${cx-6}" cy="${cy+78}" rx="96" ry="14" fill="${c.saucer}"/>
<path d="M${cx+44} ${cy-14} h18 a30 30 0 0 1 0 60 h-18" stroke="${c.handle}" stroke-width="14" fill="none" stroke-linecap="round"/>
<path d="M${cx-62} ${cy-40} h112 v88 a22 22 0 0 1 -22 22 h-68 a22 22 0 0 1 -22 -22 z" fill="${c.body}"/>
<rect x="${cx-62}" y="${cy-40}" width="112" height="18" fill="${c.band}"/>
<path d="M${cx-32} ${cy-56} c-8 -12 8 -20 0 -34 M${cx-6} ${cy-56} c-8 -12 8 -20 0 -34 M${cx+20} ${cy-56} c-8 -12 8 -20 0 -34" stroke="${c.steam}" stroke-width="4" fill="none" stroke-linecap="round"/>`;};
  /* third set: home goods */
  const lamp=(cx,cy)=>{const c=C.lamp;
    return`<ellipse cx="${cx}" cy="${cy+84}" rx="60" ry="14" fill="${c.base}"/><rect x="${cx-30}" y="${cy+66}" width="60" height="18" rx="6" fill="${c.base}"/>
<rect x="${cx-7}" y="${cy-12}" width="14" height="84" fill="${c.stem}"/>
<ellipse cx="${cx}" cy="${cy-2}" rx="56" ry="16" fill="${c.glow}"/>
<path d="M${cx-50} ${cy-78} h100 l34 72 h-168 z" fill="${c.shade}"/>
<rect x="${cx-86}" y="${cy-12}" width="172" height="8" rx="3" fill="${c.band}"/>
<rect x="${cx-10}" y="${cy-90}" width="20" height="12" rx="4" fill="${c.base}"/>`;};
  const armchair=(cx,cy)=>{const c=C.chair;
    return`<rect x="${cx-80}" y="${cy+58}" width="14" height="32" rx="3" fill="${c.leg}"/><rect x="${cx+66}" y="${cy+58}" width="14" height="32" rx="3" fill="${c.leg}"/>
<rect x="${cx-70}" y="${cy-80}" width="140" height="120" rx="24" fill="${c.back}"/>
<rect x="${cx-40}" y="${cy-56}" width="80" height="50" rx="12" fill="${c.cushion}"/>
<rect x="${cx-84}" y="${cy+10}" width="168" height="50" rx="14" fill="${c.seat}"/>
<rect x="${cx-106}" y="${cy-22}" width="34" height="86" rx="15" fill="${c.arm}"/><rect x="${cx+72}" y="${cy-22}" width="34" height="86" rx="15" fill="${c.arm}"/>`;};
  const vase=(cx,cy)=>{const c=C.vase;
    return`<path d="M${cx-2} ${cy-56} c-6 -22 4 -38 -2 -60 M${cx+4} ${cy-56} c8 -16 22 -26 40 -30" stroke="${c.stem}" stroke-width="4" fill="none" stroke-linecap="round"/>
<ellipse cx="${cx+46}" cy="${cy-88}" rx="15" ry="7" fill="${c.leaf}" transform="rotate(-28 ${cx+46} ${cy-88})"/><ellipse cx="${cx-14}" cy="${cy-100}" rx="13" ry="7" fill="${c.leaf}" transform="rotate(60 ${cx-14} ${cy-100})"/>
<rect x="${cx-20}" y="${cy-60}" width="40" height="32" rx="6" fill="${c.neck}"/><rect x="${cx-28}" y="${cy-68}" width="56" height="12" rx="5" fill="${c.neck}"/>
<path d="M${cx-20} ${cy-30} c-66 14 -66 106 0 122 h40 c66 -16 66 -108 0 -122 z" fill="${c.body}"/>
<rect x="${cx-52}" y="${cy+18}" width="104" height="12" fill="${c.band}"/>`;};
  const pillow=(cx,cy)=>{const c=C.pillow,d=`M${cx-90} ${cy-72} q90 -14 180 0 q14 72 0 144 q-90 14 -180 0 q-14 -72 0 -144 z`;
    return`<path d="${d}" fill="${c.body}"/><path d="${d}" fill="none" stroke="${c.piping}" stroke-width="5" stroke-linejoin="round"/>
<path d="M${cx} ${cy-38} l38 38 l-38 38 l-38 -38 z" fill="${c.pattern}"/>
<path d="M${cx-58} ${cy-14} l14 14 l-14 14 l-14 -14 z M${cx+58} ${cy-14} l14 14 l-14 14 l-14 -14 z" fill="${c.pattern}"/>
<circle cx="${cx}" cy="${cy}" r="7" fill="${c.button}"/>`;};
  const draw=[[headphones,tumbler,watch,controller],[sneaker,backpack,phone,mug],[lamp,armchair,vase,pillow]][set];
  const dy=[[118,122,122,110],[116,118,118,112],[120,120,124,118]][set];
  return pvSvg(`<rect width="800" height="500" fill="${C.bg}"/>`+PV_PRODUCT_CARDS[set].map(([x,y,t],i)=>card(x,y)+label(x,y,t)+draw[i](x+188,y+dy[i])).join(''));
}
/* Colour map for the normal (and Precise-with-derived-roles) layout */
function pvProductMap(R){
  // large bodies take the first of these colours that stands out from the card (derived secondary/tertiary can sit close to it)
  const vis=(...c)=>c.find(x=>contrast(x,R.surface)>=1.8)||c.sort((a,b)=>contrast(b,R.surface)-contrast(a,R.surface))[0];
  const body=vis(R.tertiary,R.secondary,R.primary,R.accent),band=vis(R.secondary,R.tertiary,R.accent,R.primary);
  return{bg:R.bg,card:R.surface,stroke:null,label:R.exact.length?pvOnExact(R.surface,R,false):contrast(R.muted,R.surface)>=4.5?R.muted:R.text,
    hp:{cup:R.primary,band:R.text,yoke:R.accent,pad:R.surface},
    tum:{body:R.accent,lid:R.text,band:R.primary,base:band},
    watch:{case:R.text,band,crown:R.accent,screen:R.bg,ring:R.primary,time:R.text},
    pad:{body,dpad:R.text,btnA:R.accent,btnB:R.primary,stick:R.text,stickTop:band===body?R.primary:band},
    shoe:{upper:R.primary,sole:R.text,mid:R.surface,lace:R.surface,stripe:R.accent},
    bag:{body:body,pocket:R.accent,strap:R.text,zip:R.text},
    phone:{case:R.accent,bump:R.text,lens:R.surface,button:R.primary},
    mug:{body:R.primary,handle:R.text,band:R.accent,steam:R.text,saucer:band},
    lamp:{shade:R.primary,base:R.text,stem:R.text,band:R.accent,glow:band},
    chair:{back:body,seat:R.primary,arm:body,leg:R.text,cushion:R.accent},
    vase:{body:R.accent,neck:R.text,band:R.primary,stem:R.text,leaf:R.primary},
    pillow:{body:R.primary,piping:R.text,pattern:R.accent,button:R.text}};
}
/* Exact-count colour maps: 2 = background + text; 3 = + primary; 4 = + surface (cards); 5 = + accent */
const PV_PRODUCT_EXACT={
  2(X){const{bg,text:T}=X;return{bg,card:null,stroke:T,label:T,
    hp:{cup:T,band:T,yoke:bg,pad:bg},tum:{body:T,lid:T,band:bg,base:T},
    watch:{case:T,band:T,crown:T,screen:bg,ring:T,time:T},pad:{body:T,dpad:bg,btnA:bg,btnB:bg,stick:bg,stickTop:T},
    shoe:{upper:T,sole:T,mid:bg,lace:bg,stripe:bg},bag:{body:T,pocket:bg,strap:T,zip:T},
    phone:{case:T,bump:bg,lens:T,button:bg},mug:{body:T,handle:T,band:bg,steam:T,saucer:T},
    lamp:{shade:T,base:T,stem:T,band:bg,glow:bg},chair:{back:T,seat:T,arm:T,leg:T,cushion:bg},
    vase:{body:T,neck:T,band:bg,stem:T,leaf:T},pillow:{body:T,piping:T,pattern:bg,button:T}};},
  3(X){const{bg,text:T,primary:P}=X;return{bg,card:null,stroke:T,label:T,
    hp:{cup:P,band:T,yoke:P,pad:bg},tum:{body:P,lid:T,band:T,base:T},
    watch:{case:T,band:P,crown:T,screen:bg,ring:P,time:T},pad:{body:P,dpad:T,btnA:T,btnB:T,stick:T,stickTop:P},
    shoe:{upper:P,sole:T,mid:bg,lace:T,stripe:T},bag:{body:P,pocket:T,strap:T,zip:bg},
    phone:{case:P,bump:T,lens:bg,button:T},mug:{body:P,handle:T,band:T,steam:T,saucer:T},
    lamp:{shade:P,base:T,stem:T,band:T,glow:bg},chair:{back:P,seat:T,arm:P,leg:T,cushion:T},
    vase:{body:P,neck:T,band:T,stem:T,leaf:P},pillow:{body:P,piping:T,pattern:T,button:bg}};},
  4(X){const{bg,text:T,primary:P,surface:S}=X;return{bg,card:S,stroke:null,label:X.on(S),
    hp:{cup:P,band:T,yoke:bg,pad:S},tum:{body:P,lid:T,band:bg,base:T},
    watch:{case:T,band:P,crown:bg,screen:bg,ring:P,time:T},pad:{body:P,dpad:T,btnA:bg,btnB:T,stick:T,stickTop:S},
    shoe:{upper:P,sole:T,mid:bg,lace:bg,stripe:T},bag:{body:P,pocket:T,strap:T,zip:S},
    phone:{case:P,bump:T,lens:S,button:bg},mug:{body:P,handle:T,band:T,steam:T,saucer:bg},
    lamp:{shade:P,base:T,stem:T,band:bg,glow:bg},chair:{back:P,seat:T,arm:P,leg:T,cushion:S},
    vase:{body:P,neck:T,band:bg,stem:T,leaf:P},pillow:{body:P,piping:T,pattern:S,button:bg}};},
  5(X){const{bg,text:T,primary:P,surface:S,accent:A}=X;return{bg,card:S,stroke:null,label:X.on(S),
    hp:{cup:P,band:T,yoke:A,pad:S},tum:{body:A,lid:T,band:P,base:bg},
    watch:{case:T,band:P,crown:A,screen:bg,ring:A,time:T},pad:{body:P,dpad:T,btnA:A,btnB:bg,stick:T,stickTop:A},
    shoe:{upper:P,sole:T,mid:bg,lace:S,stripe:A},bag:{body:P,pocket:A,strap:T,zip:S},
    phone:{case:A,bump:T,lens:S,button:P},mug:{body:P,handle:T,band:A,steam:T,saucer:bg},
    lamp:{shade:P,base:T,stem:T,band:A,glow:bg},chair:{back:P,seat:A,arm:P,leg:T,cushion:S},
    vase:{body:A,neck:T,band:P,stem:T,leaf:P},pillow:{body:P,piping:T,pattern:A,button:S}};}
};

/* ---------- Packaging scene: four flat packages on the same 2 × 2 grid of cards ----------
   Same scheme as Products: one drawing routine, geometry identical in every mode, only the colour map differs.
   C = {bg, card, stroke, label, cereal, can, shbag, jar} (see pvPackMap / PV_PACK_EXACT). Abstract shapes only — no brands or logos. */
const PV_PACK_CARDS=[[16,16,'CEREAL BOX'],[408,16,'SODA CAN'],[16,258,'SHOPPING BAG'],[408,258,'LABEL JAR']];
function pvPackSvg(C){
  const card=(x,y)=>`<rect x="${x}" y="${y}" width="376" height="226" rx="16" fill="${C.card||'none'}"${C.stroke?` stroke="${C.stroke}" stroke-width="2"`:''}/>`;
  const label=(x,y,t)=>`<text x="${x+18}" y="${y+30}" font-size="12" font-weight="800" letter-spacing="2" fill="${C.label}">${t}</text>`;
  const cereal=(cx,cy)=>{const c=C.cereal;
    return`<path d="M${cx-60} ${cy-70} l-26 -18 v164 l26 18 z" fill="${c.side}"/>
<path d="M${cx-60} ${cy-70} l-26 -18 h130 l26 18 z" fill="${c.flap}"/>
<rect x="${cx-60}" y="${cy-70}" width="130" height="164" fill="${c.front}"/>
<path d="M${cx-60} ${cy-30} h130 v30 h-130 z" fill="${c.banner}"/>
<circle cx="${cx+42}" cy="${cy+50}" r="20" fill="${c.badge}"/>
<rect x="${cx-46}" y="${cy+18}" width="62" height="8" rx="4" fill="${c.lines}"/><rect x="${cx-46}" y="${cy+36}" width="48" height="8" rx="4" fill="${c.lines}"/><rect x="${cx-46}" y="${cy+54}" width="56" height="8" rx="4" fill="${c.lines}"/>
<rect x="${cx-46}" y="${cy-58}" width="40" height="12" rx="6" fill="${c.lines}"/>`;};
  const can=(cx,cy)=>{const c=C.can;
    return`<ellipse cx="${cx}" cy="${cy+82}" rx="44" ry="10" fill="${c.lid}"/>
<path d="M${cx-44} ${cy-74} h88 v156 a44 10 0 0 1 -88 0 z" fill="${c.body}"/>
<path d="M${cx-44} ${cy-6} c22 -20 44 20 88 -4 v36 c-44 24 -66 -16 -88 4 z" fill="${c.band}"/>
<circle cx="${cx}" cy="${cy-38}" r="16" fill="${c.logo}"/>
<path d="M${cx-44} ${cy-74} a44 12 0 0 1 88 0 a44 12 0 0 1 -88 0 z" fill="${c.lid}"/>
<rect x="${cx-4}" y="${cy-86}" width="18" height="7" rx="3.5" fill="${c.ring}"/><circle cx="${cx+10}" cy="${cy-78}" r="5" fill="none" stroke="${c.ring}" stroke-width="3"/>`;};
  const shbag=(cx,cy)=>{const c=C.shbag;
    return`<path d="M${cx-36} ${cy-38} c0 -52 72 -52 72 0" stroke="${c.rope}" stroke-width="6" fill="none" stroke-linecap="round"/>
<path d="M${cx-50} ${cy-38} c0 -52 72 -52 72 0" stroke="${c.rope}" stroke-width="6" fill="none" stroke-linecap="round"/>
<path d="M${cx-76} ${cy-40} h152 l10 130 h-172 z" fill="${c.body}"/>
<path d="M${cx-76} ${cy-40} h18 l-10 130 h-18 z" fill="${c.side}"/>
<rect x="${cx-30}" y="${cy+6}" width="64" height="48" rx="6" fill="${c.tag}"/>
<circle cx="${cx+2}" cy="${cy+24}" r="10" fill="${c.logo}"/><rect x="${cx-16}" y="${cy+40}" width="36" height="6" rx="3" fill="${c.logo}"/>`;};
  const jar=(cx,cy)=>{const c=C.jar;
    return`<rect x="${cx-50}" y="${cy-88}" width="100" height="34" rx="9" fill="${c.lid}"/>
<rect x="${cx-56}" y="${cy-54}" width="112" height="142" rx="20" fill="${c.glass}"/>
<rect x="${cx-56}" y="${cy-12}" width="112" height="64" fill="${c.label}"/>
<rect x="${cx-56}" y="${cy-12}" width="112" height="8" fill="${c.accent}"/><rect x="${cx-56}" y="${cy+44}" width="112" height="8" fill="${c.accent}"/>
<ellipse cx="${cx}" cy="${cy+20}" rx="28" ry="16" fill="${c.accent}"/>
<rect x="${cx-44}" y="${cy-44}" width="9" height="24" rx="4.5" fill="${c.shine}"/><rect x="${cx-44}" y="${cy+60}" width="9" height="18" rx="4.5" fill="${c.shine}"/>`;};
  const draw=[cereal,can,shbag,jar],dy=[124,124,122,124];
  return pvSvg(`<rect width="800" height="500" fill="${C.bg}"/>`+PV_PACK_CARDS.map(([x,y,t],i)=>card(x,y)+label(x,y,t)+draw[i](x+188,y+dy[i])).join(''));
}
/* Colour map for the normal (and Precise-with-derived-roles) layout */
function pvPackMap(R){
  const vis=(...c)=>c.find(x=>contrast(x,R.surface)>=1.8)||c.sort((a,b)=>contrast(b,R.surface)-contrast(a,R.surface))[0];
  const body=vis(R.tertiary,R.secondary,R.primary,R.accent),band=vis(R.secondary,R.tertiary,R.accent,R.primary);
  return{bg:R.bg,card:R.surface,stroke:null,label:R.exact.length?pvOnExact(R.surface,R,false):contrast(R.muted,R.surface)>=4.5?R.muted:R.text,
    cereal:{front:R.primary,side:R.text,flap:band,banner:R.accent,badge:R.text,lines:R.surface},
    can:{body:R.accent,lid:R.text,band:R.primary,ring:R.surface,logo:R.surface},
    shbag:{body,side:R.text,rope:R.text,tag:R.surface,logo:R.accent},
    jar:{glass:band,lid:R.text,label:R.surface,accent:R.primary,shine:R.surface}};
}
/* Exact-count colour maps: 2 = background + text; 3 = + primary; 4 = + surface (cards); 5 = + accent */
const PV_PACK_EXACT={
  2(X){const{bg,text:T}=X;return{bg,card:null,stroke:T,label:T,
    cereal:{front:T,side:T,flap:T,banner:bg,badge:bg,lines:bg},can:{body:T,lid:T,band:bg,ring:bg,logo:bg},
    shbag:{body:T,side:T,rope:T,tag:bg,logo:T},jar:{glass:T,lid:T,label:bg,accent:T,shine:bg}};},
  3(X){const{bg,text:T,primary:P}=X;return{bg,card:null,stroke:T,label:T,
    cereal:{front:P,side:T,flap:T,banner:T,badge:bg,lines:bg},can:{body:P,lid:T,band:T,ring:bg,logo:bg},
    shbag:{body:P,side:T,rope:T,tag:T,logo:bg},jar:{glass:P,lid:T,label:T,accent:bg,shine:bg}};},
  4(X){const{bg,text:T,primary:P,surface:S}=X;return{bg,card:S,stroke:null,label:X.on(S),
    cereal:{front:P,side:T,flap:T,banner:bg,badge:S,lines:S},can:{body:P,lid:T,band:bg,ring:S,logo:S},
    shbag:{body:P,side:T,rope:T,tag:S,logo:bg},jar:{glass:P,lid:T,label:S,accent:bg,shine:S}};},
  5(X){const{bg,text:T,primary:P,surface:S,accent:A}=X;return{bg,card:S,stroke:null,label:X.on(S),
    cereal:{front:P,side:T,flap:T,banner:A,badge:S,lines:S},can:{body:A,lid:T,band:P,ring:S,logo:S},
    shbag:{body:P,side:T,rope:T,tag:S,logo:A},jar:{glass:A,lid:T,label:S,accent:P,shine:S}};}
};

/* ---------- Signage scene: four flat signs on the same 2 × 2 grid of cards ----------
   Same scheme as Products and Packaging: one drawing routine, geometry identical in every mode, only the colour map differs.
   C = {bg, card, stroke, label, store, bill, menu, banner} (see pvSignMap / PV_SIGN_EXACT). Invented names only ("Harbor Café") — no brands. */
const PV_SIGN_CARDS=[[16,16,'STOREFRONT SIGN'],[408,16,'BILLBOARD'],[16,258,'MENU BOARD'],[408,258,'HANGING BANNER']];
function pvSignSvg(C){
  const card=(x,y)=>`<rect x="${x}" y="${y}" width="376" height="226" rx="16" fill="${C.card||'none'}"${C.stroke?` stroke="${C.stroke}" stroke-width="2"`:''}/>`;
  const label=(x,y,t)=>`<text x="${x+18}" y="${y+30}" font-size="12" font-weight="800" letter-spacing="2" fill="${C.label}">${t}</text>`;
  const store=(cx,cy)=>{const c=C.store;
    return`<rect x="${cx-150}" y="${cy-60}" width="10" height="150" fill="${c.post}"/><rect x="${cx+140}" y="${cy-60}" width="10" height="150" fill="${c.post}"/>
<rect x="${cx-160}" y="${cy-78}" width="320" height="56" rx="6" fill="${c.fascia}"/>
<text x="${cx}" y="${cy-41}" font-size="26" font-weight="800" text-anchor="middle" fill="${c.text}">Harbor Café</text>
<rect x="${cx-160}" y="${cy-24}" width="320" height="5" fill="${c.trim}"/>
${[0,1,2,3,4,5,6,7].map(i=>`<rect x="${cx-160+i*40}" y="${cy-19}" width="40" height="40" fill="${i%2?c.awningB:c.awningA}"/><circle cx="${cx-140+i*40}" cy="${cy+21}" r="20" fill="${i%2?c.awningB:c.awningA}"/>`).join('')}
<rect x="${cx-120}" y="${cy+52}" width="240" height="38" rx="4" fill="${c.trim}"/><rect x="${cx-110}" y="${cy+60}" width="100" height="22" rx="3" fill="${c.fascia}"/><rect x="${cx+10}" y="${cy+60}" width="100" height="22" rx="3" fill="${c.fascia}"/>`;};
  const bill=(cx,cy)=>{const c=C.bill;
    return`<rect x="${cx-20}" y="${cy+40}" width="12" height="52" fill="${c.leg}"/><rect x="${cx+8}" y="${cy+40}" width="12" height="52" fill="${c.leg}"/>
<rect x="${cx-100}" y="${cy-86}" width="200" height="6" rx="3" fill="${c.frame}"/>
<rect x="${cx-160}" y="${cy-80}" width="320" height="124" rx="6" fill="${c.frame}"/>
<rect x="${cx-152}" y="${cy-72}" width="304" height="108" fill="${c.panel}"/>
<circle cx="${cx-112}" cy="${cy-18}" r="24" fill="${c.logo}"/>
<text x="${cx-76}" y="${cy-20}" font-size="22" font-weight="800" fill="${c.text}">Fresh colour daily</text>
<rect x="${cx-76}" y="${cy-4}" width="150" height="8" rx="4" fill="${c.sub}"/><rect x="${cx-76}" y="${cy+12}" width="110" height="8" rx="4" fill="${c.sub}"/>`;};
  const menu=(cx,cy)=>{const c=C.menu;
    return`<rect x="${cx-100}" y="${cy-86}" width="200" height="176" rx="8" fill="${c.frame}"/>
<rect x="${cx-90}" y="${cy-76}" width="180" height="156" fill="${c.board}"/>
<text x="${cx}" y="${cy-44}" font-size="20" font-weight="800" text-anchor="middle" fill="${c.head}">Today's menu</text>
<rect x="${cx-70}" y="${cy-32}" width="140" height="3" fill="${c.line}"/>
${[0,1,2,3].map(i=>`<rect x="${cx-70}" y="${cy-14+i*26}" width="${[84,66,92,72][i]}" height="8" rx="4" fill="${c.line}"/><circle cx="${cx+60}" cy="${cy-10+i*26}" r="6" fill="${c.price}"/>`).join('')}`;};
  const banner=(cx,cy)=>{const c=C.banner;
    return`<rect x="${cx-120}" y="${cy-86}" width="240" height="8" rx="4" fill="${c.pole}"/><circle cx="${cx-120}" cy="${cy-82}" r="7" fill="${c.pole}"/><circle cx="${cx+120}" cy="${cy-82}" r="7" fill="${c.pole}"/>
<rect x="${cx-52}" y="${cy-80}" width="4" height="26" fill="${c.cord}"/><rect x="${cx+48}" y="${cy-80}" width="4" height="26" fill="${c.cord}"/>
<path d="M${cx-70} ${cy-56} h140 v124 l-70 -24 l-70 24 z" fill="${c.cloth}"/>
<rect x="${cx-70}" y="${cy-56}" width="140" height="8" fill="${c.fringe}"/>
<circle cx="${cx}" cy="${cy-18}" r="20" fill="${c.medal}"/>
<text x="${cx}" y="${cy+28}" font-size="18" font-weight="800" text-anchor="middle" fill="${c.text}">Colour week</text>`;};
  const draw=[store,bill,menu,banner],dy=[124,124,124,124];
  return pvSvg(`<rect width="800" height="500" fill="${C.bg}"/>`+PV_SIGN_CARDS.map(([x,y,t],i)=>card(x,y)+label(x,y,t)+draw[i](x+188,y+dy[i])).join(''));
}
/* Colour map for the normal (and Precise-with-derived-roles) layout; sign copy is always set in a colour that reads on its face */
function pvSignMap(R){
  const vis=(...c)=>c.find(x=>contrast(x,R.surface)>=1.8)||c.sort((a,b)=>contrast(b,R.surface)-contrast(a,R.surface))[0];
  const body=vis(R.tertiary,R.secondary,R.primary,R.accent),band=vis(R.secondary,R.tertiary,R.accent,R.primary);
  const on=c=>R.exact.length?pvOnExact(c,R,false):textOn(c);
  return{bg:R.bg,card:R.surface,stroke:null,label:R.exact.length?pvOnExact(R.surface,R,false):contrast(R.muted,R.surface)>=4.5?R.muted:R.text,
    store:{fascia:R.primary,text:R.onPrimary,trim:R.text,post:R.text,awningA:R.accent,awningB:R.surface},
    bill:{panel:body,frame:R.text,text:on(body),sub:on(body),logo:band===body?R.primary:band,leg:R.text},
    menu:{board:R.text,frame:band,head:on(R.text),line:on(R.text),price:R.accent},
    banner:{pole:R.text,cord:R.text,cloth:R.accent,text:R.onAccent,fringe:R.primary,medal:R.surface}};
}
/* Exact-count colour maps: 2 = background + text; 3 = + primary; 4 = + surface (cards); 5 = + accent.
   Copy sits only on the background, text or surface colour so it always reads (the same pairs the card labels use). */
const PV_SIGN_EXACT={
  2(X){const{bg,text:T}=X;return{bg,card:null,stroke:T,label:T,
    store:{fascia:T,text:bg,trim:T,post:T,awningA:T,awningB:bg},bill:{panel:bg,frame:T,text:T,sub:T,logo:T,leg:T},
    menu:{board:T,frame:T,head:bg,line:bg,price:bg},banner:{pole:T,cord:T,cloth:T,text:bg,fringe:bg,medal:bg}};},
  3(X){const{bg,text:T,primary:P}=X;return{bg,card:null,stroke:T,label:T,
    store:{fascia:T,text:bg,trim:T,post:T,awningA:P,awningB:bg},bill:{panel:bg,frame:T,text:T,sub:P,logo:P,leg:T},
    menu:{board:T,frame:P,head:bg,line:bg,price:P},banner:{pole:T,cord:T,cloth:bg,text:T,fringe:P,medal:P}};},
  4(X){const{bg,text:T,primary:P,surface:S}=X;const oS=X.on(S);return{bg,card:S,stroke:null,label:oS,
    store:{fascia:T,text:bg,trim:T,post:T,awningA:P,awningB:S},bill:{panel:bg,frame:T,text:T,sub:P,logo:P,leg:T},
    menu:{board:T,frame:P,head:bg,line:bg,price:P},banner:{pole:T,cord:T,cloth:bg,text:T,fringe:P,medal:P}};},
  5(X){const{bg,text:T,primary:P,surface:S,accent:A}=X;const oS=X.on(S);return{bg,card:S,stroke:null,label:oS,
    store:{fascia:T,text:bg,trim:T,post:T,awningA:A,awningB:P},bill:{panel:bg,frame:T,text:T,sub:P,logo:A,leg:T},
    menu:{board:T,frame:P,head:bg,line:bg,price:A},banner:{pole:T,cord:T,cloth:bg,text:T,fringe:P,medal:A}};}
};

const PV_SCENE_FN={
  web(R){
    const card=(x,c,t)=>`<rect x="${x}" y="362" width="208" height="112" rx="14" fill="${R.surface}"/><circle cx="${x+30}" cy="392" r="15" fill="${c}"/><text x="${x+56}" y="397" font-size="14" font-weight="700" fill="${R.text}">${t}</text><rect x="${x+20}" y="418" width="150" height="7" rx="3.5" fill="${R.muted}" opacity=".55"/><rect x="${x+20}" y="433" width="120" height="7" rx="3.5" fill="${R.muted}" opacity=".55"/><rect x="${x+20}" y="448" width="135" height="7" rx="3.5" fill="${R.muted}" opacity=".55"/>`;
    return pvSvg(`<rect width="800" height="500" fill="${R.bg}"/>
<rect width="800" height="58" fill="${R.surface}"/><circle cx="42" cy="29" r="12" fill="${R.primary}"/><circle cx="48" cy="25" r="5" fill="${R.accent}"/>
<text x="62" y="35" font-size="17" font-weight="800" fill="${R.text}">Harbor</text>
<text x="470" y="34" font-size="13" font-weight="600" fill="${R.muted}">Product</text><text x="540" y="34" font-size="13" font-weight="600" fill="${R.muted}">Pricing</text><text x="604" y="34" font-size="13" font-weight="600" fill="${R.muted}">Journal</text>
<rect x="676" y="16" width="86" height="27" rx="13.5" fill="${R.primary}"/><text x="719" y="34" font-size="12.5" font-weight="700" text-anchor="middle" fill="${R.onPrimary}">Sign up</text>
<text x="48" y="150" font-size="40" font-weight="800" fill="${R.text}" letter-spacing="-1">Design with</text><text x="48" y="196" font-size="40" font-weight="800" fill="${R.primaryText}" letter-spacing="-1">confident colour.</text>
<text x="48" y="230" font-size="14.5" fill="${R.muted}">Palettes tuned for interfaces, print and spaces —</text><text x="48" y="252" font-size="14.5" fill="${R.muted}">previewed live, exported in one click.</text>
<rect x="48" y="282" width="138" height="42" rx="21" fill="${R.primary}"/><text x="117" y="309" font-size="14" font-weight="700" text-anchor="middle" fill="${R.onPrimary}">Get started</text>
<rect x="198" y="282" width="128" height="42" rx="21" fill="none" stroke="${R.accentText}" stroke-width="2"/><text x="262" y="309" font-size="14" font-weight="700" text-anchor="middle" fill="${R.accentText}">See demo</text>
<rect x="438" y="88" width="314" height="246" rx="20" fill="${R.surface}"/>
<circle cx="548" cy="196" r="74" fill="${R.accent}"/><rect x="598" y="126" width="124" height="160" rx="16" fill="${R.primary}" opacity=".95"/>
<rect x="470" y="272" width="104" height="40" rx="10" fill="${R.secondary}"/><circle cx="700" cy="300" r="14" fill="${R.tertiary}"/><circle cx="662" cy="120" r="9" fill="${R.tertiary}"/>
<path d="M470 150 q40 -40 80 0 t80 0" fill="none" stroke="${R.tertiary}" stroke-width="5" stroke-linecap="round" opacity=".9"/>
${card(48,R.primary,'Generate')}${card(296,R.accent,'Preview')}${card(544,R.secondary,'Export')}`);
  },
  poster(R){
    const dots=[];for(let y=0;y<9;y++)for(let x=0;x<5;x++)dots.push(`<circle cx="${52+x*22}" cy="${330+y*17}" r="4" fill="${R.onPrimary}" opacity=".55"/>`);
    return pvSvg(`<rect width="800" height="500" fill="${R.bg}"/>
<polygon points="0,0 330,0 250,500 0,500" fill="${R.primary}"/>
<circle cx="610" cy="120" r="118" fill="${R.accent}"/><circle cx="660" cy="150" r="118" fill="${R.secondary}" opacity=".85"/>
<rect x="560" y="430" width="200" height="18" fill="${R.tertiary}"/><rect x="620" y="456" width="140" height="18" fill="${R.secondary}"/><rect x="680" y="482" width="80" height="18" fill="${R.accent}"/>
<text x="56" y="60" font-size="12" font-weight="700" letter-spacing="4" fill="${R.onPrimary}">LIGHTHOUSE HALL</text>
<text transform="translate(92 290) rotate(-90)" font-size="46" font-weight="900" fill="${R.onPrimary}" letter-spacing="-1" opacity=".92">VOL. 07</text>
${dots.join('')}
<text x="330" y="190" font-size="78" font-weight="900" fill="${R.text}" letter-spacing="-3">COLOUR</text>
<text x="330" y="262" font-size="78" font-weight="900" fill="${R.text}" letter-spacing="-3">HARMONY</text>
<text x="330" y="334" font-size="78" font-weight="900" fill="${R.primaryText}" letter-spacing="-3">WEEK</text>
<text x="334" y="380" font-size="17" font-weight="800" letter-spacing="3" fill="${R.text}">12 – 18 MAY</text>
<text x="334" y="406" font-size="13" fill="${R.muted}">Talks · workshops · open studios</text>
<text x="334" y="426" font-size="13" fill="${R.muted}">Doors 18:00 · Free entry</text>`);
  },
  room(R){
    const leaf=(x,y,r,c)=>`<ellipse cx="${x}" cy="${y}" rx="14" ry="34" transform="rotate(${r} ${x} ${y})" fill="${c}"/>`;
    return pvSvg(`<defs><radialGradient id="pvGlow"><stop offset="0" stop-color="${R.accent}" stop-opacity=".55"/><stop offset="1" stop-color="${R.accent}" stop-opacity="0"/></radialGradient></defs>
<rect width="800" height="500" fill="${R.bg}"/><rect y="338" width="800" height="162" fill="${R.floor}"/><rect y="334" width="800" height="7" fill="${R.surface}" opacity=".7"/>
<rect x="560" y="58" width="180" height="176" rx="6" fill="${R.surface}" stroke="${R.muted}" stroke-opacity=".35" stroke-width="5"/>
<rect x="648" y="58" width="4" height="176" fill="${R.muted}" opacity=".35"/><rect x="560" y="144" width="180" height="4" fill="${R.muted}" opacity=".35"/>
<circle cx="700" cy="110" r="22" fill="${R.tertiary}" opacity=".9"/>
<rect x="118" y="66" width="214" height="150" rx="3" fill="${R.surface}" stroke="${R.text}" stroke-width="5"/>
<circle cx="190" cy="140" r="42" fill="${R.primary}"/><rect x="226" y="98" width="70" height="90" rx="8" fill="${R.accent}" opacity=".95"/><polygon points="150,200 215,200 182,160" fill="${R.secondary}"/>
<circle cx="693" cy="200" r="120" fill="url(#pvGlow)"/>
<path d="M655 236 L731 236 L716 170 L670 170 Z" fill="${R.surface}" stroke="${R.muted}" stroke-opacity=".25" stroke-width="2"/><rect x="690" y="236" width="6" height="124" fill="${R.text}"/><ellipse cx="693" cy="362" rx="30" ry="7" fill="${R.text}"/>
<ellipse cx="400" cy="436" rx="310" ry="54" fill="${R.primary}"/><ellipse cx="400" cy="436" rx="258" ry="38" fill="none" stroke="${R.surface}" stroke-width="4" stroke-dasharray="14 10" opacity=".85"/>
<rect x="206" y="214" width="388" height="78" rx="22" fill="${pvShift(R.accent,-.06)}"/>
<rect x="188" y="248" width="48" height="116" rx="18" fill="${pvShift(R.accent,-.09)}"/><rect x="564" y="248" width="48" height="116" rx="18" fill="${pvShift(R.accent,-.09)}"/>
<rect x="226" y="276" width="348" height="84" rx="16" fill="${R.accent}"/>
<rect x="236" y="286" width="164" height="60" rx="10" fill="${pvShift(R.accent,.05)}"/><rect x="408" y="286" width="156" height="60" rx="10" fill="${pvShift(R.accent,.05)}"/>
<rect x="250" y="232" width="62" height="62" rx="12" transform="rotate(-7 281 263)" fill="${R.secondary}"/><rect x="490" y="232" width="62" height="62" rx="12" transform="rotate(6 521 263)" fill="${R.tertiary}"/>
<rect x="220" y="362" width="12" height="14" fill="${R.text}"/><rect x="568" y="362" width="12" height="14" fill="${R.text}"/>
<rect x="56" y="296" width="60" height="66" rx="7" fill="${R.secondary}"/><rect x="50" y="290" width="72" height="14" rx="4" fill="${pvShift(R.secondary,-.08)}"/>
${leaf(86,250,0,R.tertiary)}${leaf(60,262,-35,R.primary)}${leaf(112,262,35,R.primary)}${leaf(74,232,-15,pvShift(R.tertiary,-.08))}${leaf(100,230,18,pvShift(R.tertiary,-.08))}
<text x="400" y="488" font-size="11" text-anchor="middle" fill="${R.muted}" opacity=".8">LIVING ROOM · ${R.all.length} COLOURS</text>`);
  },
  outfit(R){
    const skin=mixHex(R.text,R.bg,.62),coatD=pvShift(R.accent,-.07);
    const chip=(y,c,t)=>`<rect x="600" y="${y}" width="34" height="34" rx="9" fill="${c}"/><text x="646" y="${y+22}" font-size="13" font-weight="600" fill="${R.text}">${t}</text>`;
    return pvSvg(`<rect width="800" height="500" fill="${R.bg}"/><circle cx="340" cy="262" r="196" fill="${R.surface}"/>
<text x="64" y="88" font-size="12" font-weight="800" letter-spacing="3" fill="${R.muted}">LOOK 03</text><text x="64" y="118" font-size="24" font-weight="800" fill="${R.text}">Layered</text><text x="64" y="146" font-size="24" font-weight="800" fill="${R.primaryText}">tones</text>
<rect x="64" y="166" width="46" height="4" rx="2" fill="${R.accent}"/>
<ellipse cx="312" cy="470" rx="40" ry="11" fill="${R.text}"/><ellipse cx="372" cy="470" rx="40" ry="11" fill="${R.text}"/>
<path d="M292 290 L300 462 L336 462 L342 330 L348 462 L384 462 L392 290 Z" fill="${R.secondary}"/>
<path d="M292 290 L300 462 L336 462 L342 330 Z" fill="${pvShift(R.secondary,-.04)}"/>
<rect x="286" y="282" width="112" height="12" rx="4" fill="${R.text}"/><rect x="334" y="280" width="16" height="16" rx="3" fill="${R.tertiary}"/>
<path d="M318 150 L342 164 L366 150 L380 176 L380 290 L304 290 L304 176 Z" fill="${R.primary}"/>
<path d="M272 160 L318 150 L342 172 L366 150 L412 160 L404 350 L372 350 L376 300 L308 300 L312 350 L280 350 Z" fill="${R.accent}"/>
<path d="M318 150 L342 196 L330 300 L308 300 L304 176 Z" fill="${coatD}"/><path d="M366 150 L342 196 L354 300 L376 300 L380 176 Z" fill="${coatD}"/>
<path d="M272 160 L300 158 L292 320 L258 318 Z" fill="${R.accent}"/><path d="M412 160 L384 158 L392 320 L426 318 Z" fill="${R.accent}"/>
<circle cx="274" cy="326" r="14" fill="${skin}"/><circle cx="410" cy="326" r="14" fill="${skin}"/>
<path d="M300 142 q42 44 84 0 l10 16 q-52 34 -104 0 z" fill="${R.tertiary}"/>
<rect x="328" y="112" width="28" height="30" fill="${skin}"/><circle cx="342" cy="92" r="34" fill="${skin}"/>
<path d="M308 86 q34 -40 68 0 q6 -34 -34 -40 q-40 6 -34 40 z" fill="${R.text}"/>
<path d="M410 330 q40 20 44 70" fill="none" stroke="${R.text}" stroke-width="3"/><rect x="430" y="396" width="66" height="50" rx="10" fill="${R.tertiary}"/><rect x="430" y="408" width="66" height="5" fill="${R.text}" opacity=".35"/><circle cx="463" cy="428" r="4" fill="${R.text}"/>
${chip(176,R.tertiary,'Scarf & bag')}${chip(222,R.accent,'Coat')}${chip(268,R.primary,'Top')}${chip(314,R.secondary,'Trousers')}${chip(360,R.text,'Shoes & belt')}`);
  },
  dash(R){
    const pal=[R.primary,R.accent,R.secondary,R.tertiary,R.text];
    const vals=[46,72,58,90,64,80,52,96,70,84];
    const bars=vals.map((v,i)=>`<rect x="${226+i*33}" y="${300-v*1.0}" width="20" height="${v}" rx="5" fill="${pal[i%4]}"/>`).join('');
    const seg=[34,26,20,12,8];let acc=0;const C=2*Math.PI*44;
    const donut=seg.map((s,i)=>{const d=`<circle cx="665" cy="246" r="44" fill="none" stroke="${pal[i%pal.length]}" stroke-width="18" stroke-dasharray="${C*s/100-3} ${C-C*s/100+3}" stroke-dashoffset="${-C*acc/100}" transform="rotate(-90 665 246)"/>`;acc+=s;return d;}).join('');
    const pts=[0,.18,.12,.35,.3,.55,.48,.7,.62,.86,.78,1].map((t,i)=>[228+i*47,452-t*88]);
    const line=pts.map(p=>p.join(',')).join(' ');
    const pts2=[.1,.2,.28,.26,.4,.42,.5,.58,.56,.7,.72,.8].map((t,i)=>[228+i*47,452-t*88]).map(p=>p.join(',')).join(' ');
    const nav=['Overview','Audience','Revenue','Reports','Settings'].map((t,i)=>`<rect x="14" y="${88+i*40}" width="142" height="30" rx="8" fill="${i===0?R.primary:'none'}" opacity="${i===0?.18:1}"/><text x="30" y="${108+i*40}" font-size="13" font-weight="${i===0?700:600}" fill="${i===0?R.primaryText:R.muted}">${t}</text>`).join('');
    const kpi=(x,l,v,d,c)=>`<rect x="${x}" y="74" width="172" height="80" rx="12" fill="${R.surface}"/><text x="${x+16}" y="98" font-size="11.5" font-weight="600" fill="${R.muted}">${l}</text><text x="${x+16}" y="130" font-size="26" font-weight="800" fill="${R.text}">${v}</text><rect x="${x+118}" y="112" width="40" height="20" rx="10" fill="${c}"/><text x="${x+138}" y="126" font-size="11" font-weight="700" text-anchor="middle" fill="${textOn(c)}">${d}</text>`;
    return pvSvg(`<rect width="800" height="500" fill="${R.bg}"/><rect width="170" height="500" fill="${R.surface}"/>
<circle cx="34" cy="38" r="13" fill="${R.primary}"/><text x="54" y="43" font-size="16" font-weight="800" fill="${R.text}">Harbor</text>${nav}
<text x="200" y="50" font-size="22" font-weight="800" fill="${R.text}">Overview</text><text x="752" y="48" font-size="12.5" text-anchor="end" fill="${R.muted}">Last 30 days ▾</text>
${kpi(200,'VISITORS','48.2k','+12%',R.accent)}${kpi(390,'REVENUE','$96.4k','+8%',R.secondary)}${kpi(580,'RETENTION','72%','+3%',R.tertiary)}
<rect x="200" y="170" width="364" height="152" rx="12" fill="${R.surface}"/><text x="216" y="194" font-size="13" font-weight="700" fill="${R.text}">Sessions by week</text>
<line x1="216" y1="300" x2="548" y2="300" stroke="${R.muted}" stroke-opacity=".3"/><line x1="216" y1="255" x2="548" y2="255" stroke="${R.muted}" stroke-opacity=".18"/><line x1="216" y1="210" x2="548" y2="210" stroke="${R.muted}" stroke-opacity=".18"/>${bars}
<rect x="580" y="170" width="172" height="152" rx="12" fill="${R.surface}"/><text x="596" y="194" font-size="13" font-weight="700" fill="${R.text}">Channels</text>${donut}<text x="665" y="252" font-size="18" font-weight="800" text-anchor="middle" fill="${R.text}">68%</text>
<rect x="200" y="338" width="552" height="138" rx="12" fill="${R.surface}"/><text x="216" y="362" font-size="13" font-weight="700" fill="${R.text}">Growth</text>
<circle cx="616" cy="358" r="5" fill="${R.primary}"/><text x="626" y="362" font-size="11" fill="${R.muted}">This year</text><circle cx="694" cy="358" r="5" fill="${R.accent}"/><text x="704" y="362" font-size="11" fill="${R.muted}">Last year</text>
<polygon points="228,452 ${line} 745,452" fill="${R.primary}" opacity=".16"/><polyline points="${line}" fill="none" stroke="${R.primary}" stroke-width="3" stroke-linejoin="round"/><polyline points="${pts2}" fill="none" stroke="${R.accent}" stroke-width="2.5" stroke-dasharray="6 5"/>
${pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${R.surface}" stroke="${R.primary}" stroke-width="2.5"/>`).join('')}`);
  },
  product(R){return pvProductSvg(pvProductMap(R));},
  pack(R){return pvPackSvg(pvPackMap(R));},
  sign(R){return pvSignSvg(pvSignMap(R));}
};

/* ---------- exact-count scenes (Precise mode + "Use exact number of colours") ----------
   One layout per preview type and colour count (2, 3, 4, 5). Only the palette's own colours are drawn — no tints, shades or opacity —
   so every colour on screen is an exact palette value. Palettes with more than five colours use the five-colour layout plus a strip. */
const PV_EXACT_FN={
  web:{
    2(X){const{bg,text:T}=X,on=X.on(T);
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/>
<text x="48" y="44" font-size="17" font-weight="800" fill="${T}">Harbor</text><text x="560" y="44" font-size="13" font-weight="600" fill="${T}">Product · Pricing · Journal</text>
<rect x="48" y="62" width="704" height="2" fill="${T}"/>
<text x="48" y="170" font-size="52" font-weight="800" fill="${T}" letter-spacing="-1.5">Two colours,</text><text x="48" y="228" font-size="52" font-weight="800" fill="${T}" letter-spacing="-1.5">one clear voice.</text>
<text x="48" y="272" font-size="15" fill="${T}">A background and a foreground are all a page needs.</text>
<rect x="48" y="304" width="150" height="44" rx="22" fill="${T}"/><text x="123" y="332" font-size="14" font-weight="700" text-anchor="middle" fill="${on}">Get started</text>
<rect x="212" y="304" width="130" height="44" rx="22" fill="none" stroke="${T}" stroke-width="2"/><text x="277" y="332" font-size="14" font-weight="700" text-anchor="middle" fill="${T}">See demo</text>
<rect x="520" y="110" width="232" height="232" rx="24" fill="${T}"/><circle cx="636" cy="226" r="70" fill="${bg}"/><rect x="606" y="196" width="60" height="60" rx="12" fill="${T}"/>
<rect x="48" y="392" width="216" height="72" rx="12" fill="none" stroke="${T}" stroke-width="2"/><rect x="292" y="392" width="216" height="72" rx="12" fill="none" stroke="${T}" stroke-width="2"/><rect x="536" y="392" width="216" height="72" rx="12" fill="none" stroke="${T}" stroke-width="2"/>
<text x="68" y="422" font-size="14" font-weight="700" fill="${T}">Generate</text><text x="312" y="422" font-size="14" font-weight="700" fill="${T}">Preview</text><text x="556" y="422" font-size="14" font-weight="700" fill="${T}">Export</text>
<rect x="68" y="436" width="130" height="6" rx="3" fill="${T}"/><rect x="312" y="436" width="130" height="6" rx="3" fill="${T}"/><rect x="556" y="436" width="130" height="6" rx="3" fill="${T}"/>`);},
    3(X){const{bg,text:T,primary:P}=X,onP=X.on(P);
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><rect width="800" height="64" fill="${P}"/>
<circle cx="46" cy="32" r="13" fill="${onP}"/><text x="68" y="38" font-size="17" font-weight="800" fill="${onP}">Harbor</text><text x="540" y="37" font-size="13" font-weight="600" fill="${onP}">Product · Pricing · Journal</text>
<text x="48" y="170" font-size="46" font-weight="800" fill="${T}" letter-spacing="-1.5">Design with</text><text x="48" y="222" font-size="46" font-weight="800" fill="${X.pt}" letter-spacing="-1.5">confident colour.</text>
<text x="48" y="262" font-size="15" fill="${T}">Background, text and one primary that does the talking.</text>
<rect x="48" y="294" width="150" height="44" rx="22" fill="${P}"/><text x="123" y="322" font-size="14" font-weight="700" text-anchor="middle" fill="${onP}">Get started</text>
<rect x="212" y="294" width="130" height="44" rx="22" fill="none" stroke="${T}" stroke-width="2"/><text x="277" y="322" font-size="14" font-weight="700" text-anchor="middle" fill="${T}">See demo</text>
<rect x="470" y="100" width="282" height="236" rx="24" fill="${P}"/><circle cx="590" cy="200" r="72" fill="${bg}"/><rect x="640" y="160" width="84" height="120" rx="14" fill="${T}"/><circle cx="520" cy="290" r="18" fill="${T}"/>
<rect x="48" y="382" width="216" height="84" rx="14" fill="${P}"/><rect x="292" y="382" width="216" height="84" rx="14" fill="none" stroke="${T}" stroke-width="2"/><rect x="536" y="382" width="216" height="84" rx="14" fill="${T}"/>
<text x="68" y="414" font-size="14" font-weight="700" fill="${onP}">Generate</text><text x="312" y="414" font-size="14" font-weight="700" fill="${T}">Preview</text><text x="556" y="414" font-size="14" font-weight="700" fill="${X.on(T)}">Export</text>
<rect x="68" y="430" width="120" height="6" rx="3" fill="${onP}"/><rect x="312" y="430" width="120" height="6" rx="3" fill="${T}"/><rect x="556" y="430" width="120" height="6" rx="3" fill="${X.on(T)}"/>`);},
    4(X){const{bg,text:T,primary:P,surface:S}=X,onP=X.on(P),oS=X.on(S);
      const card=(x,t)=>`<rect x="${x}" y="372" width="208" height="100" rx="14" fill="${S}"/><circle cx="${x+30}" cy="402" r="14" fill="${P}"/><text x="${x+54}" y="407" font-size="14" font-weight="700" fill="${oS}">${t}</text><rect x="${x+20}" y="430" width="150" height="7" rx="3.5" fill="${oS}"/><rect x="${x+20}" y="446" width="110" height="7" rx="3.5" fill="${oS}"/>`;
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><rect width="800" height="60" fill="${S}"/>
<circle cx="44" cy="30" r="13" fill="${P}"/><text x="66" y="36" font-size="17" font-weight="800" fill="${oS}">Harbor</text><text x="656" y="35" font-size="13" font-weight="600" text-anchor="end" fill="${oS}">Product · Pricing · Journal</text>
<rect x="672" y="16" width="90" height="28" rx="14" fill="${P}"/><text x="717" y="35" font-size="12.5" font-weight="700" text-anchor="middle" fill="${onP}">Sign up</text>
<text x="48" y="156" font-size="42" font-weight="800" fill="${T}" letter-spacing="-1.5">Design with</text><text x="48" y="204" font-size="42" font-weight="800" fill="${X.pt}" letter-spacing="-1.5">confident colour.</text>
<text x="48" y="240" font-size="14.5" fill="${T}">Background, surface, primary and text — four roles.</text>
<rect x="48" y="270" width="142" height="42" rx="21" fill="${P}"/><text x="119" y="297" font-size="14" font-weight="700" text-anchor="middle" fill="${onP}">Get started</text>
<rect x="204" y="270" width="128" height="42" rx="21" fill="none" stroke="${T}" stroke-width="2"/><text x="268" y="297" font-size="14" font-weight="700" text-anchor="middle" fill="${T}">See demo</text>
<rect x="438" y="92" width="314" height="246" rx="20" fill="${S}"/><circle cx="548" cy="200" r="74" fill="${P}"/><rect x="598" y="130" width="124" height="160" rx="16" fill="${T}"/><rect x="470" y="276" width="104" height="40" rx="10" fill="${bg}"/>
${card(48,'Generate')}${card(296,'Preview')}${card(544,'Export')}`);},
    5(X){const{bg,text:T,primary:P,surface:S,accent:A}=X,onP=X.on(P),onA=X.on(A),oS=X.on(S);
      const card=(x,c,t)=>`<rect x="${x}" y="372" width="208" height="100" rx="14" fill="${S}"/><circle cx="${x+30}" cy="402" r="14" fill="${c}"/><text x="${x+54}" y="407" font-size="14" font-weight="700" fill="${oS}">${t}</text><rect x="${x+20}" y="430" width="150" height="7" rx="3.5" fill="${oS}"/><rect x="${x+20}" y="446" width="110" height="7" rx="3.5" fill="${oS}"/>`;
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><rect width="800" height="60" fill="${S}"/>
<circle cx="44" cy="30" r="13" fill="${P}"/><circle cx="51" cy="25" r="6" fill="${A}"/><text x="66" y="36" font-size="17" font-weight="800" fill="${oS}">Harbor</text><text x="656" y="35" font-size="13" font-weight="600" text-anchor="end" fill="${oS}">Product · Pricing · Journal</text>
<rect x="672" y="16" width="90" height="28" rx="14" fill="${P}"/><text x="717" y="35" font-size="12.5" font-weight="700" text-anchor="middle" fill="${onP}">Sign up</text>
<text x="48" y="156" font-size="42" font-weight="800" fill="${T}" letter-spacing="-1.5">Design with</text><text x="48" y="204" font-size="42" font-weight="800" fill="${X.pt}" letter-spacing="-1.5">confident colour.</text>
<text x="48" y="240" font-size="14.5" fill="${T}">Five colours, each exactly as it is in the palette.</text>
<rect x="48" y="270" width="142" height="42" rx="21" fill="${P}"/><text x="119" y="297" font-size="14" font-weight="700" text-anchor="middle" fill="${onP}">Get started</text>
<rect x="204" y="270" width="128" height="42" rx="21" fill="${A}"/><text x="268" y="297" font-size="14" font-weight="700" text-anchor="middle" fill="${onA}">See demo</text>
<rect x="438" y="92" width="314" height="246" rx="20" fill="${S}"/><circle cx="548" cy="200" r="74" fill="${A}"/><rect x="598" y="130" width="124" height="160" rx="16" fill="${P}"/><rect x="470" y="276" width="104" height="40" rx="10" fill="${T}"/><circle cx="700" cy="304" r="14" fill="${bg}"/>
${card(48,P,'Generate')}${card(296,A,'Preview')}${card(544,T,'Export')}`);}
  },
  poster:{
    2(X){const{bg,text:T}=X,on=X.on(T);
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><polygon points="0,0 300,0 230,500 0,500" fill="${T}"/>
<text x="46" y="60" font-size="12" font-weight="700" letter-spacing="4" fill="${on}">LIGHTHOUSE HALL</text>
<text transform="translate(96 300) rotate(-90)" font-size="54" font-weight="900" fill="${on}" letter-spacing="-1">VOL. 07</text>
<text x="320" y="190" font-size="84" font-weight="900" fill="${T}" letter-spacing="-3">COLOUR</text><text x="320" y="268" font-size="84" font-weight="900" fill="${T}" letter-spacing="-3">HARMONY</text>
<rect x="324" y="296" width="300" height="70" fill="${T}"/><text x="338" y="350" font-size="60" font-weight="900" fill="${bg}" letter-spacing="-2">WEEK</text>
<text x="324" y="410" font-size="17" font-weight="800" letter-spacing="3" fill="${T}">12 – 18 MAY · DOORS 18:00</text><text x="324" y="436" font-size="13" fill="${T}">Talks · workshops · open studios · free entry</text>
<circle cx="700" cy="110" r="60" fill="${T}"/><circle cx="700" cy="110" r="30" fill="${bg}"/>`);},
    3(X){const{bg,text:T,primary:P}=X,onP=X.on(P);
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><polygon points="0,0 330,0 250,500 0,500" fill="${P}"/>
<text x="56" y="60" font-size="12" font-weight="700" letter-spacing="4" fill="${onP}">LIGHTHOUSE HALL</text>
<text transform="translate(92 290) rotate(-90)" font-size="46" font-weight="900" fill="${onP}" letter-spacing="-1">VOL. 07</text>
<circle cx="640" cy="120" r="110" fill="${T}"/><circle cx="640" cy="120" r="56" fill="${P}"/>
<text x="330" y="236" font-size="78" font-weight="900" fill="${T}" letter-spacing="-3">COLOUR</text><text x="330" y="308" font-size="78" font-weight="900" fill="${T}" letter-spacing="-3">HARMONY</text><text x="330" y="380" font-size="78" font-weight="900" fill="${X.pt}" letter-spacing="-3">WEEK</text>
<text x="334" y="420" font-size="17" font-weight="800" letter-spacing="3" fill="${T}">12 – 18 MAY</text><text x="334" y="446" font-size="13" fill="${T}">Talks · workshops · open studios · Doors 18:00 · Free entry</text>
<rect x="560" y="462" width="200" height="18" fill="${P}"/><rect x="640" y="462" width="120" height="18" fill="${T}"/>`);},
    4(X){const{bg,text:T,primary:P,surface:S}=X,onP=X.on(P);
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><rect x="0" y="0" width="800" height="150" fill="${S}"/><polygon points="0,0 330,0 250,500 0,500" fill="${P}"/>
<text x="56" y="60" font-size="12" font-weight="700" letter-spacing="4" fill="${onP}">LIGHTHOUSE HALL</text>
<text transform="translate(92 290) rotate(-90)" font-size="46" font-weight="900" fill="${onP}" letter-spacing="-1">VOL. 07</text>
<circle cx="620" cy="110" r="100" fill="${T}"/><circle cx="660" cy="150" r="100" fill="${P}"/>
<text x="330" y="236" font-size="78" font-weight="900" fill="${T}" letter-spacing="-3">COLOUR</text><text x="330" y="308" font-size="78" font-weight="900" fill="${T}" letter-spacing="-3">HARMONY</text><text x="330" y="380" font-size="78" font-weight="900" fill="${X.pt}" letter-spacing="-3">WEEK</text>
<rect x="330" y="398" width="430" height="70" fill="${S}"/><text x="344" y="428" font-size="17" font-weight="800" letter-spacing="3" fill="${X.on(S)}">12 – 18 MAY</text><text x="344" y="452" font-size="13" fill="${X.on(S)}">Talks · workshops · open studios · Doors 18:00 · Free entry</text>`);},
    5(X){const{bg,text:T,primary:P,surface:S,accent:A}=X,onP=X.on(P);
      const dots=[];for(let y=0;y<9;y++)for(let x=0;x<5;x++)dots.push(`<circle cx="${52+x*22}" cy="${330+y*17}" r="4" fill="${onP}"/>`);
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><polygon points="0,0 330,0 250,500 0,500" fill="${P}"/>
<circle cx="610" cy="120" r="118" fill="${A}"/><circle cx="660" cy="150" r="118" fill="${S}"/><circle cx="660" cy="150" r="52" fill="${T}"/>
<rect x="560" y="430" width="200" height="18" fill="${T}"/><rect x="620" y="456" width="140" height="18" fill="${S}"/><rect x="680" y="482" width="80" height="18" fill="${A}"/>
<text x="56" y="60" font-size="12" font-weight="700" letter-spacing="4" fill="${onP}">LIGHTHOUSE HALL</text>
<text transform="translate(92 290) rotate(-90)" font-size="46" font-weight="900" fill="${onP}" letter-spacing="-1">VOL. 07</text>${dots.join('')}
<text x="330" y="236" font-size="78" font-weight="900" fill="${T}" letter-spacing="-3">COLOUR</text><text x="330" y="308" font-size="78" font-weight="900" fill="${T}" letter-spacing="-3">HARMONY</text><text x="330" y="380" font-size="78" font-weight="900" fill="${X.at}" letter-spacing="-3">WEEK</text>
<text x="334" y="420" font-size="17" font-weight="800" letter-spacing="3" fill="${T}">12 – 18 MAY</text><text x="334" y="446" font-size="13" fill="${T}">Talks · workshops · open studios · Doors 18:00 · Free entry</text>`);}
  },
  room:{
    2(X){const{bg,text:T}=X;
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><rect y="340" width="800" height="6" fill="${T}"/>
<rect x="118" y="66" width="214" height="150" rx="3" fill="none" stroke="${T}" stroke-width="6"/><circle cx="190" cy="140" r="42" fill="${T}"/><polygon points="230,200 310,200 270,130" fill="${T}"/>
<rect x="560" y="58" width="180" height="176" rx="6" fill="none" stroke="${T}" stroke-width="6"/><rect x="648" y="58" width="4" height="176" fill="${T}"/><rect x="560" y="144" width="180" height="4" fill="${T}"/>
<path d="M655 236 L731 236 L716 170 L670 170 Z" fill="${T}"/><rect x="690" y="236" width="6" height="124" fill="${T}"/><ellipse cx="693" cy="362" rx="30" ry="7" fill="${T}"/>
<rect x="206" y="214" width="388" height="78" rx="22" fill="${T}"/><rect x="188" y="248" width="48" height="116" rx="18" fill="${T}"/><rect x="564" y="248" width="48" height="116" rx="18" fill="${T}"/><rect x="226" y="276" width="348" height="84" rx="16" fill="${T}"/>
<rect x="240" y="288" width="156" height="58" rx="10" fill="${bg}"/><rect x="404" y="288" width="156" height="58" rx="10" fill="${bg}"/>
<ellipse cx="400" cy="436" rx="300" ry="50" fill="none" stroke="${T}" stroke-width="6"/>
<rect x="56" y="296" width="60" height="66" rx="7" fill="${T}"/><rect x="50" y="290" width="72" height="14" rx="4" fill="${T}"/>
<ellipse cx="86" cy="250" rx="14" ry="34" fill="${T}"/><ellipse cx="60" cy="262" rx="14" ry="34" transform="rotate(-35 60 262)" fill="${T}"/><ellipse cx="112" cy="262" rx="14" ry="34" transform="rotate(35 112 262)" fill="${T}"/>`);},
    3(X){const{bg,text:T,primary:P}=X;
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><rect y="340" width="800" height="160" fill="${P}"/>
<rect x="118" y="66" width="214" height="150" rx="3" fill="${P}" stroke="${T}" stroke-width="5"/><circle cx="190" cy="140" r="42" fill="${T}"/><polygon points="230,200 310,200 270,130" fill="${bg}"/>
<rect x="560" y="58" width="180" height="176" rx="6" fill="${P}" stroke="${T}" stroke-width="5"/><rect x="648" y="58" width="4" height="176" fill="${T}"/><rect x="560" y="144" width="180" height="4" fill="${T}"/>
<path d="M655 236 L731 236 L716 170 L670 170 Z" fill="${T}"/><rect x="690" y="236" width="6" height="124" fill="${T}"/><ellipse cx="693" cy="362" rx="30" ry="7" fill="${T}"/>
<ellipse cx="400" cy="440" rx="310" ry="48" fill="${bg}"/>
<rect x="206" y="214" width="388" height="78" rx="22" fill="${T}"/><rect x="188" y="248" width="48" height="116" rx="18" fill="${T}"/><rect x="564" y="248" width="48" height="116" rx="18" fill="${T}"/><rect x="226" y="276" width="348" height="84" rx="16" fill="${T}"/>
<rect x="240" y="288" width="156" height="58" rx="10" fill="${P}"/><rect x="404" y="288" width="156" height="58" rx="10" fill="${P}"/>
<rect x="250" y="232" width="62" height="62" rx="12" transform="rotate(-7 281 263)" fill="${bg}"/><rect x="490" y="232" width="62" height="62" rx="12" transform="rotate(6 521 263)" fill="${P}"/>
<rect x="56" y="296" width="60" height="66" rx="7" fill="${T}"/><rect x="50" y="290" width="72" height="14" rx="4" fill="${P}"/>
<ellipse cx="86" cy="250" rx="14" ry="34" fill="${P}"/><ellipse cx="60" cy="262" rx="14" ry="34" transform="rotate(-35 60 262)" fill="${T}"/><ellipse cx="112" cy="262" rx="14" ry="34" transform="rotate(35 112 262)" fill="${T}"/>`);},
    4(X){const{bg,text:T,primary:P,surface:S}=X;
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><rect y="338" width="800" height="162" fill="${S}"/><rect y="334" width="800" height="6" fill="${T}"/>
<rect x="118" y="66" width="214" height="150" rx="3" fill="${S}" stroke="${T}" stroke-width="5"/><circle cx="190" cy="140" r="42" fill="${P}"/><polygon points="230,200 310,200 270,130" fill="${T}"/>
<rect x="560" y="58" width="180" height="176" rx="6" fill="${S}" stroke="${T}" stroke-width="5"/><rect x="648" y="58" width="4" height="176" fill="${T}"/><rect x="560" y="144" width="180" height="4" fill="${T}"/><circle cx="700" cy="110" r="22" fill="${P}"/>
<path d="M655 236 L731 236 L716 170 L670 170 Z" fill="${S}" stroke="${T}" stroke-width="2"/><rect x="690" y="236" width="6" height="124" fill="${T}"/><ellipse cx="693" cy="362" rx="30" ry="7" fill="${T}"/>
<ellipse cx="400" cy="436" rx="310" ry="54" fill="${P}"/><ellipse cx="400" cy="436" rx="258" ry="38" fill="none" stroke="${S}" stroke-width="4" stroke-dasharray="14 10"/>
<rect x="206" y="214" width="388" height="78" rx="22" fill="${P}"/><rect x="188" y="248" width="48" height="116" rx="18" fill="${P}"/><rect x="564" y="248" width="48" height="116" rx="18" fill="${P}"/><rect x="226" y="276" width="348" height="84" rx="16" fill="${P}"/>
<rect x="240" y="288" width="156" height="58" rx="10" fill="${S}"/><rect x="404" y="288" width="156" height="58" rx="10" fill="${S}"/>
<rect x="250" y="232" width="62" height="62" rx="12" transform="rotate(-7 281 263)" fill="${T}"/><rect x="490" y="232" width="62" height="62" rx="12" transform="rotate(6 521 263)" fill="${bg}"/>
<rect x="220" y="362" width="12" height="14" fill="${T}"/><rect x="568" y="362" width="12" height="14" fill="${T}"/>
<rect x="56" y="296" width="60" height="66" rx="7" fill="${T}"/><rect x="50" y="290" width="72" height="14" rx="4" fill="${P}"/>
<ellipse cx="86" cy="250" rx="14" ry="34" fill="${P}"/><ellipse cx="60" cy="262" rx="14" ry="34" transform="rotate(-35 60 262)" fill="${T}"/><ellipse cx="112" cy="262" rx="14" ry="34" transform="rotate(35 112 262)" fill="${T}"/>`);},
    5(X){const{bg,text:T,primary:P,surface:S,accent:A}=X;
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><rect y="338" width="800" height="162" fill="${S}"/><rect y="334" width="800" height="6" fill="${T}"/>
<rect x="118" y="66" width="214" height="150" rx="3" fill="${S}" stroke="${T}" stroke-width="5"/><circle cx="190" cy="140" r="42" fill="${P}"/><rect x="226" y="98" width="70" height="90" rx="8" fill="${A}"/><polygon points="150,200 215,200 182,160" fill="${T}"/>
<rect x="560" y="58" width="180" height="176" rx="6" fill="${S}" stroke="${T}" stroke-width="5"/><rect x="648" y="58" width="4" height="176" fill="${T}"/><rect x="560" y="144" width="180" height="4" fill="${T}"/><circle cx="700" cy="110" r="22" fill="${A}"/>
<path d="M655 236 L731 236 L716 170 L670 170 Z" fill="${S}" stroke="${T}" stroke-width="2"/><rect x="690" y="236" width="6" height="124" fill="${T}"/><ellipse cx="693" cy="362" rx="30" ry="7" fill="${T}"/>
<ellipse cx="400" cy="436" rx="310" ry="54" fill="${P}"/><ellipse cx="400" cy="436" rx="258" ry="38" fill="none" stroke="${S}" stroke-width="4" stroke-dasharray="14 10"/>
<rect x="206" y="214" width="388" height="78" rx="22" fill="${A}"/><rect x="188" y="248" width="48" height="116" rx="18" fill="${A}"/><rect x="564" y="248" width="48" height="116" rx="18" fill="${A}"/><rect x="226" y="276" width="348" height="84" rx="16" fill="${A}"/>
<rect x="240" y="288" width="156" height="58" rx="10" fill="${S}"/><rect x="404" y="288" width="156" height="58" rx="10" fill="${S}"/>
<rect x="250" y="232" width="62" height="62" rx="12" transform="rotate(-7 281 263)" fill="${P}"/><rect x="490" y="232" width="62" height="62" rx="12" transform="rotate(6 521 263)" fill="${T}"/>
<rect x="220" y="362" width="12" height="14" fill="${T}"/><rect x="568" y="362" width="12" height="14" fill="${T}"/>
<rect x="56" y="296" width="60" height="66" rx="7" fill="${P}"/><rect x="50" y="290" width="72" height="14" rx="4" fill="${T}"/>
<ellipse cx="86" cy="250" rx="14" ry="34" fill="${A}"/><ellipse cx="60" cy="262" rx="14" ry="34" transform="rotate(-35 60 262)" fill="${P}"/><ellipse cx="112" cy="262" rx="14" ry="34" transform="rotate(35 112 262)" fill="${P}"/>`);}
  },
  outfit:{
    2(X){const{bg,text:T}=X;
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/>
<text x="64" y="88" font-size="12" font-weight="800" letter-spacing="3" fill="${T}">LOOK 03</text><text x="64" y="124" font-size="30" font-weight="800" fill="${T}">Monotone</text><text x="64" y="158" font-size="30" font-weight="800" fill="${T}">layers</text><rect x="64" y="176" width="60" height="4" fill="${T}"/>
<circle cx="400" cy="262" r="200" fill="none" stroke="${T}" stroke-width="6"/>
<ellipse cx="372" cy="470" rx="40" ry="11" fill="${T}"/><ellipse cx="432" cy="470" rx="40" ry="11" fill="${T}"/>
<path d="M352 290 L360 462 L396 462 L402 330 L408 462 L444 462 L452 290 Z" fill="${T}"/>
<path d="M332 160 L378 150 L402 172 L426 150 L472 160 L464 350 L432 350 L436 300 L368 300 L372 350 L340 350 Z" fill="${T}"/>
<path d="M378 150 L402 196 L390 300 L368 300 L364 176 Z" fill="${bg}"/><path d="M426 150 L402 196 L414 300 L436 300 L440 176 Z" fill="${bg}"/>
<path d="M332 160 L360 158 L352 320 L318 318 Z" fill="${T}"/><path d="M472 160 L444 158 L452 320 L486 318 Z" fill="${T}"/>
<circle cx="334" cy="326" r="14" fill="${bg}" stroke="${T}" stroke-width="4"/><circle cx="470" cy="326" r="14" fill="${bg}" stroke="${T}" stroke-width="4"/>
<rect x="388" y="112" width="28" height="30" fill="${bg}" stroke="${T}" stroke-width="4"/><circle cx="402" cy="92" r="34" fill="${bg}" stroke="${T}" stroke-width="4"/><path d="M368 86 q34 -40 68 0 q6 -34 -34 -40 q-40 6 -34 40 z" fill="${T}"/>
<text x="600" y="190" font-size="13" font-weight="600" fill="${T}">Coat · Trousers</text><text x="600" y="220" font-size="13" font-weight="600" fill="${T}">Top · Shoes</text><rect x="600" y="240" width="140" height="34" rx="9" fill="${T}"/><rect x="600" y="286" width="140" height="34" rx="9" fill="none" stroke="${T}" stroke-width="3"/>`);},
    3(X){const{bg,text:T,primary:P}=X;
      const chip=(y,c,t)=>`<rect x="600" y="${y}" width="34" height="34" rx="9" fill="${c}"/><text x="646" y="${y+22}" font-size="13" font-weight="600" fill="${T}">${t}</text>`;
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/>
<text x="64" y="88" font-size="12" font-weight="800" letter-spacing="3" fill="${T}">LOOK 03</text><text x="64" y="124" font-size="30" font-weight="800" fill="${T}">Layered</text><text x="64" y="158" font-size="30" font-weight="800" fill="${X.pt}">tones</text><rect x="64" y="176" width="60" height="4" fill="${P}"/>
<circle cx="400" cy="262" r="196" fill="${P}"/>
<ellipse cx="372" cy="470" rx="40" ry="11" fill="${T}"/><ellipse cx="432" cy="470" rx="40" ry="11" fill="${T}"/>
<path d="M352 290 L360 462 L396 462 L402 330 L408 462 L444 462 L452 290 Z" fill="${T}"/>
<path d="M378 150 L402 164 L426 150 L440 176 L440 290 L364 290 L364 176 Z" fill="${bg}"/>
<path d="M332 160 L378 150 L402 172 L426 150 L472 160 L464 350 L432 350 L436 300 L368 300 L372 350 L340 350 Z" fill="${T}"/>
<path d="M378 150 L402 196 L390 300 L368 300 L364 176 Z" fill="${bg}"/><path d="M426 150 L402 196 L414 300 L436 300 L440 176 Z" fill="${bg}"/>
<path d="M332 160 L360 158 L352 320 L318 318 Z" fill="${T}"/><path d="M472 160 L444 158 L452 320 L486 318 Z" fill="${T}"/>
<circle cx="334" cy="326" r="14" fill="${bg}"/><circle cx="470" cy="326" r="14" fill="${bg}"/>
<path d="M360 142 q42 44 84 0 l10 16 q-52 34 -104 0 z" fill="${bg}"/><rect x="388" y="112" width="28" height="30" fill="${bg}"/><circle cx="402" cy="92" r="34" fill="${bg}"/><path d="M368 86 q34 -40 68 0 q6 -34 -34 -40 q-40 6 -34 40 z" fill="${T}"/>
${chip(190,T,'Coat & trousers')}${chip(236,bg,'Top & scarf')}${chip(282,P,'Backdrop')}`);},
    4(X){const{bg,text:T,primary:P,surface:S}=X;
      const chip=(y,c,t)=>`<rect x="600" y="${y}" width="34" height="34" rx="9" fill="${c}"/><text x="646" y="${y+22}" font-size="13" font-weight="600" fill="${T}">${t}</text>`;
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><circle cx="400" cy="262" r="196" fill="${S}"/>
<text x="64" y="88" font-size="12" font-weight="800" letter-spacing="3" fill="${T}">LOOK 03</text><text x="64" y="124" font-size="30" font-weight="800" fill="${T}">Layered</text><text x="64" y="158" font-size="30" font-weight="800" fill="${X.pt}">tones</text><rect x="64" y="176" width="60" height="4" fill="${P}"/>
<ellipse cx="372" cy="470" rx="40" ry="11" fill="${T}"/><ellipse cx="432" cy="470" rx="40" ry="11" fill="${T}"/>
<path d="M352 290 L360 462 L396 462 L402 330 L408 462 L444 462 L452 290 Z" fill="${T}"/><rect x="346" y="282" width="112" height="12" rx="4" fill="${P}"/>
<path d="M378 150 L402 164 L426 150 L440 176 L440 290 L364 290 L364 176 Z" fill="${bg}"/>
<path d="M332 160 L378 150 L402 172 L426 150 L472 160 L464 350 L432 350 L436 300 L368 300 L372 350 L340 350 Z" fill="${P}"/>
<path d="M378 150 L402 196 L390 300 L368 300 L364 176 Z" fill="${T}"/><path d="M426 150 L402 196 L414 300 L436 300 L440 176 Z" fill="${T}"/>
<path d="M332 160 L360 158 L352 320 L318 318 Z" fill="${P}"/><path d="M472 160 L444 158 L452 320 L486 318 Z" fill="${P}"/>
<circle cx="334" cy="326" r="14" fill="${S}"/><circle cx="470" cy="326" r="14" fill="${S}"/>
<path d="M360 142 q42 44 84 0 l10 16 q-52 34 -104 0 z" fill="${bg}"/><rect x="388" y="112" width="28" height="30" fill="${S}"/><circle cx="402" cy="92" r="34" fill="${S}"/><path d="M368 86 q34 -40 68 0 q6 -34 -34 -40 q-40 6 -34 40 z" fill="${T}"/>
<rect x="490" y="396" width="66" height="50" rx="10" fill="${P}"/><rect x="490" y="408" width="66" height="5" fill="${T}"/>
${chip(190,P,'Coat & bag')}${chip(236,T,'Trousers & shoes')}${chip(282,bg,'Top & scarf')}${chip(328,S,'Backdrop')}`);},
    5(X){const{bg,text:T,primary:P,surface:S,accent:A}=X;
      const chip=(y,c,t)=>`<rect x="600" y="${y}" width="34" height="34" rx="9" fill="${c}"/><text x="646" y="${y+22}" font-size="13" font-weight="600" fill="${T}">${t}</text>`;
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><circle cx="400" cy="262" r="196" fill="${S}"/>
<text x="64" y="88" font-size="12" font-weight="800" letter-spacing="3" fill="${T}">LOOK 03</text><text x="64" y="124" font-size="30" font-weight="800" fill="${T}">Layered</text><text x="64" y="158" font-size="30" font-weight="800" fill="${X.pt}">tones</text><rect x="64" y="176" width="60" height="4" fill="${A}"/>
<ellipse cx="372" cy="470" rx="40" ry="11" fill="${T}"/><ellipse cx="432" cy="470" rx="40" ry="11" fill="${T}"/>
<path d="M352 290 L360 462 L396 462 L402 330 L408 462 L444 462 L452 290 Z" fill="${A}"/><rect x="346" y="282" width="112" height="12" rx="4" fill="${T}"/>
<path d="M378 150 L402 164 L426 150 L440 176 L440 290 L364 290 L364 176 Z" fill="${P}"/>
<path d="M332 160 L378 150 L402 172 L426 150 L472 160 L464 350 L432 350 L436 300 L368 300 L372 350 L340 350 Z" fill="${T}"/>
<path d="M378 150 L402 196 L390 300 L368 300 L364 176 Z" fill="${S}"/><path d="M426 150 L402 196 L414 300 L436 300 L440 176 Z" fill="${S}"/>
<path d="M332 160 L360 158 L352 320 L318 318 Z" fill="${T}"/><path d="M472 160 L444 158 L452 320 L486 318 Z" fill="${T}"/>
<circle cx="334" cy="326" r="14" fill="${bg}"/><circle cx="470" cy="326" r="14" fill="${bg}"/>
<path d="M360 142 q42 44 84 0 l10 16 q-52 34 -104 0 z" fill="${A}"/><rect x="388" y="112" width="28" height="30" fill="${bg}"/><circle cx="402" cy="92" r="34" fill="${bg}"/><path d="M368 86 q34 -40 68 0 q6 -34 -34 -40 q-40 6 -34 40 z" fill="${T}"/>
<rect x="490" y="396" width="66" height="50" rx="10" fill="${P}"/><rect x="490" y="408" width="66" height="5" fill="${T}"/>
${chip(176,A,'Scarf & trousers')}${chip(222,T,'Coat & shoes')}${chip(268,P,'Top & bag')}${chip(314,S,'Lining & backdrop')}${chip(360,bg,'Skin & wall')}`);}
  },
  dash:{
    2(X){const{bg,text:T}=X;
      const vals=[46,72,58,90,64,80,52,96,70,84];const bars=vals.map((v,i)=>`<rect x="${226+i*33}" y="${300-v}" width="20" height="${v}" rx="5" fill="${T}"/>`).join('');
      const pts=[0,.18,.12,.35,.3,.55,.48,.7,.62,.86,.78,1].map((t,i)=>[228+i*47,452-t*88]).map(p=>p.join(',')).join(' ');
      const nav=['Overview','Audience','Revenue','Reports','Settings'].map((t,i)=>`<rect x="14" y="${88+i*40}" width="142" height="30" rx="8" fill="${i===0?T:'none'}"/><text x="30" y="${108+i*40}" font-size="13" font-weight="700" fill="${i===0?bg:T}">${t}</text>`).join('');
      const kpi=(x,l,v)=>`<rect x="${x}" y="74" width="172" height="80" rx="12" fill="none" stroke="${T}" stroke-width="2"/><text x="${x+16}" y="98" font-size="11.5" font-weight="600" fill="${T}">${l}</text><text x="${x+16}" y="130" font-size="26" font-weight="800" fill="${T}">${v}</text>`;
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><rect x="170" width="2" height="500" fill="${T}"/>
<circle cx="34" cy="38" r="13" fill="${T}"/><text x="54" y="43" font-size="16" font-weight="800" fill="${T}">Harbor</text>${nav}
<text x="200" y="50" font-size="22" font-weight="800" fill="${T}">Overview</text><text x="752" y="48" font-size="12.5" text-anchor="end" fill="${T}">Last 30 days ▾</text>
${kpi(200,'VISITORS','48.2k')}${kpi(390,'REVENUE','$96.4k')}${kpi(580,'RETENTION','72%')}
<rect x="200" y="170" width="364" height="152" rx="12" fill="none" stroke="${T}" stroke-width="2"/><text x="216" y="194" font-size="13" font-weight="700" fill="${T}">Sessions by week</text>${bars}
<rect x="580" y="170" width="172" height="152" rx="12" fill="none" stroke="${T}" stroke-width="2"/><text x="596" y="194" font-size="13" font-weight="700" fill="${T}">Channels</text><circle cx="665" cy="250" r="44" fill="none" stroke="${T}" stroke-width="18" stroke-dasharray="190 300" transform="rotate(-90 665 250)"/>
<rect x="200" y="338" width="552" height="138" rx="12" fill="none" stroke="${T}" stroke-width="2"/><text x="216" y="362" font-size="13" font-weight="700" fill="${T}">Growth</text><polyline points="${pts}" fill="none" stroke="${T}" stroke-width="3" stroke-linejoin="round"/>`);},
    3(X){const{bg,text:T,primary:P}=X,onP=X.on(P);
      const vals=[46,72,58,90,64,80,52,96,70,84];const bars=vals.map((v,i)=>`<rect x="${226+i*33}" y="${300-v}" width="20" height="${v}" rx="5" fill="${i%2?T:P}"/>`).join('');
      const pts=[0,.18,.12,.35,.3,.55,.48,.7,.62,.86,.78,1].map((t,i)=>[228+i*47,452-t*88]).map(p=>p.join(',')).join(' ');
      const nav=['Overview','Audience','Revenue','Reports','Settings'].map((t,i)=>`<rect x="14" y="${88+i*40}" width="142" height="30" rx="8" fill="${i===0?bg:'none'}"/><text x="30" y="${108+i*40}" font-size="13" font-weight="700" fill="${i===0?T:onP}">${t}</text>`).join('');
      const kpi=(x,l,v)=>`<rect x="${x}" y="74" width="172" height="80" rx="12" fill="none" stroke="${T}" stroke-width="2"/><text x="${x+16}" y="98" font-size="11.5" font-weight="600" fill="${T}">${l}</text><text x="${x+16}" y="130" font-size="26" font-weight="800" fill="${T}">${v}</text><rect x="${x+118}" y="112" width="40" height="20" rx="10" fill="${P}"/>`;
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><rect width="170" height="500" fill="${P}"/>
<circle cx="34" cy="38" r="13" fill="${onP}"/><text x="54" y="43" font-size="16" font-weight="800" fill="${onP}">Harbor</text>${nav}
<text x="200" y="50" font-size="22" font-weight="800" fill="${T}">Overview</text><text x="752" y="48" font-size="12.5" text-anchor="end" fill="${T}">Last 30 days ▾</text>
${kpi(200,'VISITORS','48.2k')}${kpi(390,'REVENUE','$96.4k')}${kpi(580,'RETENTION','72%')}
<rect x="200" y="170" width="364" height="152" rx="12" fill="none" stroke="${T}" stroke-width="2"/><text x="216" y="194" font-size="13" font-weight="700" fill="${T}">Sessions by week</text>${bars}
<rect x="580" y="170" width="172" height="152" rx="12" fill="none" stroke="${T}" stroke-width="2"/><text x="596" y="194" font-size="13" font-weight="700" fill="${T}">Channels</text><circle cx="665" cy="250" r="44" fill="none" stroke="${P}" stroke-width="18"/><circle cx="665" cy="250" r="44" fill="none" stroke="${T}" stroke-width="18" stroke-dasharray="110 300" transform="rotate(-90 665 250)"/>
<rect x="200" y="338" width="552" height="138" rx="12" fill="none" stroke="${T}" stroke-width="2"/><text x="216" y="362" font-size="13" font-weight="700" fill="${T}">Growth</text><polyline points="${pts}" fill="none" stroke="${P}" stroke-width="4" stroke-linejoin="round"/>`);},
    4(X){const{bg,text:T,primary:P,surface:S}=X,onP=X.on(P),oS=X.on(S);
      const vals=[46,72,58,90,64,80,52,96,70,84];const bars=vals.map((v,i)=>`<rect x="${226+i*33}" y="${300-v}" width="20" height="${v}" rx="5" fill="${i%2?T:P}"/>`).join('');
      const pts=[0,.18,.12,.35,.3,.55,.48,.7,.62,.86,.78,1].map((t,i)=>[228+i*47,452-t*88]).map(p=>p.join(',')).join(' ');
      const nav=['Overview','Audience','Revenue','Reports','Settings'].map((t,i)=>`<rect x="14" y="${88+i*40}" width="142" height="30" rx="8" fill="${i===0?P:'none'}"/><text x="30" y="${108+i*40}" font-size="13" font-weight="700" fill="${i===0?onP:oS}">${t}</text>`).join('');
      const kpi=(x,l,v)=>`<rect x="${x}" y="74" width="172" height="80" rx="12" fill="${S}"/><text x="${x+16}" y="98" font-size="11.5" font-weight="600" fill="${oS}">${l}</text><text x="${x+16}" y="130" font-size="26" font-weight="800" fill="${oS}">${v}</text><rect x="${x+118}" y="112" width="40" height="20" rx="10" fill="${P}"/>`;
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><rect width="170" height="500" fill="${S}"/>
<circle cx="34" cy="38" r="13" fill="${P}"/><text x="54" y="43" font-size="16" font-weight="800" fill="${oS}">Harbor</text>${nav}
<text x="200" y="50" font-size="22" font-weight="800" fill="${T}">Overview</text><text x="752" y="48" font-size="12.5" text-anchor="end" fill="${T}">Last 30 days ▾</text>
${kpi(200,'VISITORS','48.2k')}${kpi(390,'REVENUE','$96.4k')}${kpi(580,'RETENTION','72%')}
<rect x="200" y="170" width="364" height="152" rx="12" fill="${S}"/><text x="216" y="194" font-size="13" font-weight="700" fill="${oS}">Sessions by week</text>${bars}
<rect x="580" y="170" width="172" height="152" rx="12" fill="${S}"/><text x="596" y="194" font-size="13" font-weight="700" fill="${oS}">Channels</text><circle cx="665" cy="250" r="44" fill="none" stroke="${T}" stroke-width="18"/><circle cx="665" cy="250" r="44" fill="none" stroke="${P}" stroke-width="18" stroke-dasharray="150 300" transform="rotate(-90 665 250)"/>
<rect x="200" y="338" width="552" height="138" rx="12" fill="${S}"/><text x="216" y="362" font-size="13" font-weight="700" fill="${oS}">Growth</text><polyline points="${pts}" fill="none" stroke="${P}" stroke-width="4" stroke-linejoin="round"/>`);},
    5(X){const{bg,text:T,primary:P,surface:S,accent:A}=X,onP=X.on(P),onA=X.on(A),oS=X.on(S);
      const pal=[P,A,T];const vals=[46,72,58,90,64,80,52,96,70,84];const bars=vals.map((v,i)=>`<rect x="${226+i*33}" y="${300-v}" width="20" height="${v}" rx="5" fill="${pal[i%3]}"/>`).join('');
      const pts=[0,.18,.12,.35,.3,.55,.48,.7,.62,.86,.78,1].map((t,i)=>[228+i*47,452-t*88]).map(p=>p.join(',')).join(' ');
      const pts2=[.1,.2,.28,.26,.4,.42,.5,.58,.56,.7,.72,.8].map((t,i)=>[228+i*47,452-t*88]).map(p=>p.join(',')).join(' ');
      const nav=['Overview','Audience','Revenue','Reports','Settings'].map((t,i)=>`<rect x="14" y="${88+i*40}" width="142" height="30" rx="8" fill="${i===0?P:'none'}"/><text x="30" y="${108+i*40}" font-size="13" font-weight="700" fill="${i===0?onP:oS}">${t}</text>`).join('');
      const kpi=(x,l,v,d,c,oc)=>`<rect x="${x}" y="74" width="172" height="80" rx="12" fill="${S}"/><text x="${x+16}" y="98" font-size="11.5" font-weight="600" fill="${oS}">${l}</text><text x="${x+16}" y="130" font-size="26" font-weight="800" fill="${oS}">${v}</text><rect x="${x+118}" y="112" width="40" height="20" rx="10" fill="${c}"/><text x="${x+138}" y="126" font-size="11" font-weight="700" text-anchor="middle" fill="${oc}">${d}</text>`;
      return pvSvg(`<rect width="800" height="500" fill="${bg}"/><rect width="170" height="500" fill="${S}"/>
<circle cx="34" cy="38" r="13" fill="${P}"/><text x="54" y="43" font-size="16" font-weight="800" fill="${oS}">Harbor</text>${nav}
<text x="200" y="50" font-size="22" font-weight="800" fill="${T}">Overview</text><text x="752" y="48" font-size="12.5" text-anchor="end" fill="${T}">Last 30 days ▾</text>
${kpi(200,'VISITORS','48.2k','+12%',A,onA)}${kpi(390,'REVENUE','$96.4k','+8%',P,onP)}${kpi(580,'RETENTION','72%','+3%',T,X.on(T))}
<rect x="200" y="170" width="364" height="152" rx="12" fill="${S}"/><text x="216" y="194" font-size="13" font-weight="700" fill="${oS}">Sessions by week</text>${bars}
<rect x="580" y="170" width="172" height="152" rx="12" fill="${S}"/><text x="596" y="194" font-size="13" font-weight="700" fill="${oS}">Channels</text><circle cx="665" cy="250" r="44" fill="none" stroke="${T}" stroke-width="18"/><circle cx="665" cy="250" r="44" fill="none" stroke="${A}" stroke-width="18" stroke-dasharray="180 300" transform="rotate(-90 665 250)"/><circle cx="665" cy="250" r="44" fill="none" stroke="${P}" stroke-width="18" stroke-dasharray="100 300" transform="rotate(-90 665 250)"/>
<rect x="200" y="338" width="552" height="138" rx="12" fill="${S}"/><text x="216" y="362" font-size="13" font-weight="700" fill="${oS}">Growth</text>
<circle cx="616" cy="358" r="5" fill="${P}"/><text x="626" y="362" font-size="11" fill="${oS}">This year</text><circle cx="694" cy="358" r="5" fill="${A}"/><text x="704" y="362" font-size="11" fill="${oS}">Last year</text>
<polyline points="${pts}" fill="none" stroke="${P}" stroke-width="3" stroke-linejoin="round"/><polyline points="${pts2}" fill="none" stroke="${A}" stroke-width="2.5" stroke-dasharray="6 5"/>`);}
  },
  product:{2:X=>pvProductSvg(PV_PRODUCT_EXACT[2](X)),3:X=>pvProductSvg(PV_PRODUCT_EXACT[3](X)),4:X=>pvProductSvg(PV_PRODUCT_EXACT[4](X)),5:X=>pvProductSvg(PV_PRODUCT_EXACT[5](X))},
  pack:{2:X=>pvPackSvg(PV_PACK_EXACT[2](X)),3:X=>pvPackSvg(PV_PACK_EXACT[3](X)),4:X=>pvPackSvg(PV_PACK_EXACT[4](X)),5:X=>pvPackSvg(PV_PACK_EXACT[5](X))},
  sign:{2:X=>pvSignSvg(PV_SIGN_EXACT[2](X)),3:X=>pvSignSvg(PV_SIGN_EXACT[3](X)),4:X=>pvSignSvg(PV_SIGN_EXACT[4](X)),5:X=>pvSignSvg(PV_SIGN_EXACT[5](X))}
};
/* Draw an exact-count scene; palettes with more than five colours get the five-colour layout plus a strip of all colours */
function pvExactScene(sid,X){
  const n=Math.min(Math.max(X.n,2),5);let svg=PV_EXACT_FN[sid][n](X);
  if(X.n>5)svg=pvAddStrip(svg,X.all);
  return svg;
}
/* A full-width strip of exact swatches along the bottom edge (used when a layout cannot place every colour) */
function pvAddStrip(svg,colors){
  const w=800/colors.length;const strip=colors.map((c,i)=>`<rect x="${i*w}" y="452" width="${w+.5}" height="48" fill="${c}"/>`).join('');
  return svg.replace('</svg>',strip+'</svg>');
}

/* ---------- Text scene (HTML, so the embedded fonts and editable copy work) ---------- */
const PV_TEXT_DEFAULT={display:'Colour with confidence',heading:'Every palette tells a story',sub:'Set the tone before you set the type',body:'Good colour does quiet work: it groups what belongs together, points at what matters and gives a page its temperature. Try the same words in a serif, a mono or a script and watch the palette change character with them.',caption:'Caption · Hue Harbor sample text, edit it to taste',link:'Read the full guide →'};
const PV_TEXT_FIELDS=[['display','Display heading'],['heading','Heading'],['sub','Subheading'],['body','Body'],['caption','Caption'],['link','Link']];
const pvFontsLoaded=new Set();
function pvFontById(id){return PV_FONTS.find(f=>f.id===id)||null;}
/* Decode a font from its base64 the first time it is chosen and register it with the document */
function pvEnsureFont(id){
  const f=pvFontById(id);if(!f||pvFontsLoaded.has(id))return;pvFontsLoaded.add(id);
  try{const bin=atob(f.data),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
    const face=new FontFace(f.family,buf.buffer,{style:'normal',weight:'400'});face.load().then(ff=>document.fonts.add(ff)).catch(()=>{pvFontsLoaded.delete(id);toast('Could not load '+f.family);});
  }catch(e){pvFontsLoaded.delete(id);}
}
function pvFontStack(){const f=pvFontById(pv.font);return f?`"${f.family}",system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`:'system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';}
/* Levels for the Text scene. Normal and Precise-with-derived-roles: six levels over Background, Surface, Primary, Accent, Text.
   Exact-count: 2 colours = one heading; 3 = + subheading; 4 = + body on a surface panel; 5 = + caption and link in the accent. */
function pvTextLevels(R,exactCount){
  if(!pv.txt)pv.txt=Object.assign({},PV_TEXT_DEFAULT);const t=pv.txt;
  if(!exactCount)return{bg:R.bg,panel:R.surface,levels:[
    {k:'display',c:R.exact.length?R.primary:R.primaryText,role:'Primary'},{k:'heading',c:R.text,role:'Text'},{k:'sub',c:R.exact.length?R.accent:R.accentText,role:'Accent'},
    {k:'body',c:R.text,role:'Text',panel:true},{k:'caption',c:R.exact.length?R.text:R.muted,role:R.exact.length?'Text':'Muted (derived)',panel:true},{k:'link',c:R.exact.length?R.accent:R.accentText,role:'Accent',panel:true}],text:t};
  const X=R,n=X.n,lv=[{k:'display',c:X.text,role:'Text'}];
  if(n>=3)lv.push({k:'sub',c:X.pt,role:X.pt===X.primary?'Primary':'Text'});
  if(n>=4)lv.push({k:'body',c:X.text,role:'Text',panel:true});
  if(n>=5){lv.push({k:'caption',c:X.accent,role:'Accent',panel:n>=4});lv.push({k:'link',c:X.accent,role:'Accent',panel:n>=4});}
  return{bg:X.bg,panel:n>=4?X.surface:null,levels:lv,text:t,extras:X.extras||[]};
}
const PV_TEXT_STYLE={display:'font-size:clamp(28px,5.2cqw,54px);font-weight:700;line-height:1.05;letter-spacing:-.02em;margin:0 0 .25em',heading:'font-size:clamp(20px,3cqw,30px);font-weight:600;line-height:1.2;margin:0 0 .35em',sub:'font-size:clamp(16px,2.2cqw,22px);font-weight:400;line-height:1.3;margin:0 0 .9em',body:'font-size:clamp(14px,1.7cqw,17px);line-height:1.55;margin:0 0 .8em;max-width:62ch',caption:'font-size:clamp(11px,1.3cqw,13px);letter-spacing:.04em;text-transform:uppercase;margin:0 0 .5em',link:'font-size:clamp(14px,1.7cqw,17px);font-weight:600;text-decoration:underline;text-underline-offset:.15em;margin:0'};
function pvTextScene(R,exactCount){
  const L=pvTextLevels(R,exactCount),ff=pvFontStack();
  const onPanel=c=>{if(!L.panel||contrast(c,L.panel)>=3)return c;return R.exact&&R.exact.length?pvOnExact(L.panel,R,true):textOn(L.panel);};
  L.levels.forEach(lv=>{if(lv.panel)lv.c=onPanel(lv.c);});
  const el=(lv)=>h(lv.k==='display'?'h1':lv.k==='heading'?'h2':lv.k==='sub'?'h3':'p',{class:'pv-tx-'+lv.k,style:`${PV_TEXT_STYLE[lv.k]};color:${lv.c};font-family:${ff}`,title:`${lv.role}: ${lv.c.toUpperCase()}`},L.text[lv.k]||PV_TEXT_DEFAULT[lv.k]);
  const top=L.levels.filter(l=>!l.panel).map(el),inPanel=L.levels.filter(l=>l.panel).map(el);
  const inner=h('div',{class:'pv-text-in'},...top,inPanel.length?h('div',{class:'pv-text-panel',style:'background:'+(L.panel||L.bg)+(L.panel?'':';padding:0')},...inPanel):null);
  const wrap=h('div',{class:'pv-text',style:'background:'+L.bg},inner);
  // Precise modes: any palette colour the levels could not place is shown as an exact swatch strip
  const shown=new Set([L.bg,L.panel,...L.levels.map(l=>l.c)].filter(Boolean).map(c=>c.toLowerCase()));
  const rest=(R.exact||[]).filter(c=>!shown.has(c.toLowerCase()));
  if(rest.length)wrap.append(h('div',{class:'pv-text-strip',role:'img','aria-label':'Remaining palette colours'},...rest.map(c=>h('i',{style:'background:'+c,title:c.toUpperCase()}))));
  return wrap;
}
/* Copy-to-clipboard swatches for the dialog subtitle: an <img> whose alt text is the hex, inside a real button */
function pvSwatch(c){
  const hex=c.toUpperCase();const src=`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><rect width="18" height="18" rx="4" fill="${hex}"/></svg>`)}`;
  const b=h('button',{type:'button',class:'pv-sw',title:'Copy '+hex,'aria-label':'Copy '+hex+' to clipboard','data-hex':hex},h('img',{src,alt:hex,width:'18',height:'18',draggable:'false'}));
  b.addEventListener('click',async()=>{await copyText(hex,hex+' copied');b.classList.add('copied');setTimeout(()=>b.classList.remove('copied'),900);});
  return b;
}

/* ---------- photo scene ---------- */
const PV_W=800,PV_H=500,PV_MAX=4096; /* preview box; export longest side cap */
/* Procedural "photo": a lakeside at dusk, drawn with gradients and seeded noise (no embedded image) */
function pvSamplePhoto(){
  const c=document.createElement('canvas');c.width=PV_W;c.height=PV_H;const g=c.getContext('2d',{willReadFrequently:true});const r=rng(20260521);
  let sky=g.createLinearGradient(0,0,0,300);sky.addColorStop(0,'#1a2a55');sky.addColorStop(.45,'#5a5f9e');sky.addColorStop(.8,'#e9956a');sky.addColorStop(1,'#ffd9a0');g.fillStyle=sky;g.fillRect(0,0,PV_W,300);
  const sun=g.createRadialGradient(560,250,10,560,250,170);sun.addColorStop(0,'rgba(255,240,200,.95)');sun.addColorStop(.18,'rgba(255,210,140,.7)');sun.addColorStop(1,'rgba(255,180,120,0)');g.fillStyle=sun;g.fillRect(0,0,PV_W,300);
  g.fillStyle='#ffe9b8';g.beginPath();g.arc(560,250,38,0,Math.PI*2);g.fill();
  for(let i=0;i<9;i++){const x=r()*PV_W,y=40+r()*140,w=80+r()*140;const cl=g.createRadialGradient(x,y,2,x,y,w);cl.addColorStop(0,'rgba(255,230,220,.55)');cl.addColorStop(1,'rgba(255,230,220,0)');g.fillStyle=cl;g.beginPath();g.ellipse(x,y,w,w*.28,0,0,Math.PI*2);g.fill();}
  const ridge=(base,amp,col,step)=>{g.fillStyle=col;g.beginPath();g.moveTo(0,PV_H);let y=base;for(let x=0;x<=PV_W;x+=step){y+=(r()-.5)*amp;y=clamp(y,base-amp*3,base+amp*3);g.lineTo(x,y);}g.lineTo(PV_W,PV_H);g.closePath();g.fill();};
  ridge(190,18,'#6d6f9c',24);ridge(230,14,'#4a4b78',18);ridge(265,10,'#2d2e52',14);
  const lake=g.createLinearGradient(0,300,0,PV_H);lake.addColorStop(0,'#f0b57e');lake.addColorStop(.3,'#8b7aa0');lake.addColorStop(1,'#1c2446');g.fillStyle=lake;g.fillRect(0,300,PV_W,200);
  for(let i=0;i<140;i++){const y=302+r()*190,x=r()*PV_W,w=20+r()*120;g.fillStyle=`rgba(255,235,200,${.05+r()*.18*(1-(y-300)/220)})`;g.fillRect(x,y,w,1.5);}
  const refl=g.createLinearGradient(0,300,0,420);refl.addColorStop(0,'rgba(255,220,160,.55)');refl.addColorStop(1,'rgba(255,220,160,0)');g.fillStyle=refl;g.fillRect(520,300,80,120);
  g.fillStyle='#141a33';g.beginPath();g.moveTo(0,PV_H);g.lineTo(0,400);for(let x=0;x<=260;x+=6)g.lineTo(x,405+Math.sin(x/9)*6+r()*6);g.lineTo(260,PV_H);g.fill();
  const tree=(x,y,hh,w)=>{g.fillStyle='#0f1430';for(let k=0;k<4;k++){const ty=y-hh*k/4;g.beginPath();g.moveTo(x,ty-hh/3);g.lineTo(x-w*(1-k*.18),ty);g.lineTo(x+w*(1-k*.18),ty);g.closePath();g.fill();}g.fillRect(x-3,y-4,6,22);};
  tree(60,420,120,34);tree(130,440,150,42);tree(200,428,110,30);tree(740,430,140,40);tree(690,445,100,28);
  g.fillStyle='#0f1430';g.beginPath();g.moveTo(640,440);g.lineTo(800,440);g.lineTo(800,PV_H);g.lineTo(640,PV_H);g.fill();
  g.fillStyle='#2a2f4a';g.beginPath();g.ellipse(430,415,46,8,0,0,Math.PI*2);g.fill();g.fillStyle='#1b1f3a';g.beginPath();g.moveTo(392,414);g.lineTo(468,414);g.lineTo(458,402);g.lineTo(402,402);g.closePath();g.fill();g.fillRect(428,380,3,24);g.fillStyle='#f6c28b';g.beginPath();g.moveTo(431,380);g.lineTo(431,402);g.lineTo(416,400);g.closePath();g.fill();
  const vig=g.createRadialGradient(400,250,220,400,250,520);vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(10,8,30,.55)');g.fillStyle=vig;g.fillRect(0,0,PV_W,PV_H);
  return g.getImageData(0,0,PV_W,PV_H);
}
/* Loading: decode off the main thread when possible (createImageBitmap), fall back to an <img> from an object URL.
   The preview works on a copy fitted into PV_W×PV_H; the full-resolution pixels are only read for Download PNG. */
function pvLoadImage(file){
  if(file.type&&!file.type.startsWith('image/'))return toast('Please choose an image file');
  const name=slugify(file.name.replace(/\.[^.]+$/,''))||'photo';
  const done=im=>{
    const iw=im.width||im.naturalWidth,ih=im.height||im.naturalHeight;if(!iw||!ih)return toast('Could not read that image');
    const s=Math.min(PV_W/iw,PV_H/ih),w=Math.max(1,Math.round(iw*s)),hh=Math.max(1,Math.round(ih*s));
    const c=document.createElement('canvas');c.width=w;c.height=hh;const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingQuality='high';g.drawImage(im,0,0,w,hh);
    pvDropPhoto();pv.src=g.getImageData(0,0,w,hh);pv.fullSrc={img:im,w:iw,h:ih};pv.srcName=name;pv.intensity=1;
    toast('Photo loaded (stays in your browser)');renderPreview();
  };
  const viaUrl=()=>{const url=URL.createObjectURL(file);const im=new Image();im.onload=()=>{URL.revokeObjectURL(url);done(im);};im.onerror=()=>{URL.revokeObjectURL(url);toast('Could not read that image');};im.src=url;};
  if(typeof createImageBitmap==='function')createImageBitmap(file).then(done,viaUrl);else viaUrl();
}
/* Forget the loaded photo and free its decoded bitmap */
function pvDropPhoto(){if(pv.fullSrc&&pv.fullSrc.img&&typeof pv.fullSrc.img.close==='function')pv.fullSrc.img.close();pv.src=null;pv.fullSrc=null;pv.full=null;}
/* Full-resolution pixels of the loaded photo (longest side capped at PV_MAX), read lazily and cached */
function pvFullData(){
  if(pv.full)return pv.full;if(!pv.fullSrc)return pvSource();
  const {img,w,h:hh}=pv.fullSrc,s=Math.min(1,PV_MAX/Math.max(w,hh)),fw=Math.max(1,Math.round(w*s)),fh=Math.max(1,Math.round(hh*s));
  const c=document.createElement('canvas');c.width=fw;c.height=fh;const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingQuality='high';g.drawImage(img,0,0,fw,fh);
  return pv.full=g.getImageData(0,0,fw,fh);
}
function pvSource(){if(!pv.src)pv.src=pvSamplePhoto();return pv.src;}
/* Packed RGBA pixel in this platform's byte order, so Uint32Array stores write r,g,b,255 */
const PV_LE=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
function pvPack(r,g,b){return PV_LE?(255<<24|b<<16|g<<8|r)>>>0:(r<<24|g<<16|b<<8|255)>>>0;}
/* 256-entry packed-pixel ramp that interpolates through `stops` (hex) in OKLab; cached per stop list */
const pvRampCache=new Map();
function pvRamp(stops){
  const key=stops.join();if(pvRampCache.has(key))return pvRampCache.get(key);
  const labs=stops.map(hx=>rgbToOklab(...hexToRgb(hx)));const lut=new Uint32Array(256);
  for(let i=0;i<256;i++){const t=i/255*(labs.length-1),k=Math.min(Math.floor(t),labs.length-2),f=t-k;const a=labs[k],b=labs[k+1];const rgb=oklabToRgbRaw(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f).map(unlin);lut[i]=pvPack(rgb[0],rgb[1],rgb[2]);}
  if(pvRampCache.size>64)pvRampCache.clear();pvRampCache.set(key,lut);return lut;
}
/* OKLab of every 5-bit-per-channel RGB cell (bucket centres): 32768×3 floats, built once */
let pvGridLab=null;
function pvGrid(){
  if(pvGridLab)return pvGridLab;const g=new Float32Array(32768*3);
  for(let r=0;r<32;r++)for(let gg=0;gg<32;gg++)for(let b=0;b<32;b++){const lab=rgbToOklab(r*8+4,gg*8+4,b*8+4),i=(r<<10|gg<<5|b)*3;g[i]=lab[0];g[i+1]=lab[1];g[i+2]=lab[2];}
  return pvGridLab=g;
}
/* Posterize table for a palette: nearest palette colour (OKLab) for each of the 32768 RGB cells; cached per palette */
const pvLutCache=new Map();
function pvPosterLut(colors){
  const key=colors.join();if(pvLutCache.has(key))return pvLutCache.get(key);
  const grid=pvGrid(),n=colors.length,L=new Float32Array(n),A=new Float32Array(n),B=new Float32Array(n),pal32=new Uint32Array(n);
  colors.forEach((hx,i)=>{const rgb=hexToRgb(hx),lab=rgbToOklab(...rgb);L[i]=lab[0];A[i]=lab[1];B[i]=lab[2];pal32[i]=pvPack(...rgb);});
  const lut=new Uint8Array(32768);
  for(let c=0,j=0;c<32768;c++,j+=3){const l=grid[j],a=grid[j+1],b=grid[j+2];let best=0,bd=Infinity;for(let q=0;q<n;q++){const dl=l-L[q],da=a-A[q],db=b-B[q],d=dl*dl+da*da+db*db;if(d<bd){bd=d;best=q;}}lut[c]=best;}
  const res={lut,pal32};if(pvLutCache.size>64)pvLutCache.clear();pvLutCache.set(key,res);return res;
}
/* Pure pixel kernel — no outside references, because its source is also serialised into the export Worker.
   src: RGBA bytes; opt: {mode:'poster'|'ramp', lut, pal32, ramp32, light (optional cache), k: 0..256 intensity}
   Returns {out, light}. */
function pvKernel(src,opt){
  const n=src.length>>2,out=new Uint8ClampedArray(src.length),LE=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
  const s32=new Uint32Array(src.buffer,src.byteOffset,n),o32=new Uint32Array(out.buffer);let light=opt.light||null;
  if(opt.mode==='poster'){
    const lut=opt.lut,pal=opt.pal32;
    if(LE)for(let p=0;p<n;p++){const v=s32[p];o32[p]=pal[lut[(v&0xF8)<<7|(v>>6)&0x3E0|(v>>19)&31]];}
    else for(let p=0;p<n;p++){const v=s32[p];o32[p]=pal[lut[(v>>>27)<<10|(v>>19&31)<<5|(v>>11&31)]];}
  }else{
    if(!light){ // OKLab lightness per pixel, 0..255 (cached by the caller per source image)
      light=new Uint8ClampedArray(n);const LIN=new Float32Array(256);for(let i=0;i<256;i++){const c=i/255;LIN[i]=c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);}
      for(let p=0,i=0;p<n;p++,i+=4){const R=LIN[src[i]],G=LIN[src[i+1]],B=LIN[src[i+2]];const l=Math.cbrt(.4122214708*R+.5363325363*G+.0514459929*B),m=Math.cbrt(.2119034982*R+.6806995451*G+.1073969566*B),s=Math.cbrt(.0883024619*R+.2817188376*G+.6299787005*B);light[p]=(.2104542553*l+.793617785*m-.0040720468*s)*255;}
    }
    const ramp=opt.ramp32;for(let p=0;p<n;p++)o32[p]=ramp[light[p]];
  }
  const k=opt.k;
  if(k<256)for(let i=0;i<src.length;i+=4){const r=src[i],g=src[i+1],b=src[i+2];out[i]=r+((out[i]-r)*k>>8);out[i+1]=g+((out[i+1]-g)*k>>8);out[i+2]=b+((out[i+2]-b)*k>>8);}
  return {out,light};
}
/* Kernel options for the current effect; `key` identifies the effect result for caching */
function pvOpts(colors){
  if(pv.effect==='poster'){const t=pvPosterLut(colors);return{mode:'poster',lut:t.lut,pal32:t.pal32,key:'p|'+colors.join()};}
  const stops=pv.effect==='gradient'?[...colors].sort((a,b)=>pvL(a)-pvL(b)):[colors[pv.duoA%colors.length],colors[pv.duoB%colors.length]];
  return{mode:'ramp',ramp32:pvRamp(stops),key:'r|'+stops.join()};
}
/* Preview render: the full-strength effect is cached per source+effect+palette, so intensity changes are only a blend */
function pvRenderPhoto(canvas,colors){
  const src=pvSource(),opt=pvOpts(colors);
  if(!src._fx||src._fx.key!==opt.key){opt.light=src._light||null;opt.k=256;const r=pvKernel(src.data,opt);src._light=r.light;src._fx={key:opt.key,out:r.out};}
  const eff=src._fx.out,k=Math.round(pv.intensity*256),img=src._img||(src._img=new ImageData(src.width,src.height)),o=img.data,s=src.data;
  if(k>=256)o.set(eff);else for(let i=0;i<o.length;i+=4){const r=s[i],g=s[i+1],b=s[i+2];o[i]=r+((eff[i]-r)*k>>8);o[i+1]=g+((eff[i+1]-g)*k>>8);o[i+2]=b+((eff[i+2]-b)*k>>8);o[i+3]=255;}
  canvas.getContext('2d').putImageData(img,0,0);
}
/* Coalesce slider input into one render per animation frame */
function pvQueueRender(colors){if(pv.raf)return;pv.raf=requestAnimationFrame(()=>{pv.raf=0;const cv=$('.pv-stage canvas');if(cv)pvRenderPhoto(cv,colors);});}
/* Full-resolution export: pixels processed (and, where OffscreenCanvas exists, PNG-encoded) in an inline Worker; main-thread fallback */
let pvWorkerUrl=null;
function pvWorkerSrc(){return pvKernel.toString()+`
self.onmessage=e=>{const d=e.data;try{const r=pvKernel(d.src,d);
  const raw=()=>postMessage({out:r.out},[r.out.buffer]);
  if(typeof OffscreenCanvas==='function'){const oc=new OffscreenCanvas(d.w,d.h);oc.getContext('2d').putImageData(new ImageData(r.out,d.w,d.h),0,0);oc.convertToBlob({type:'image/png'}).then(b=>postMessage({blob:b}),raw);}
  else raw();}catch(err){postMessage({error:String(err)});}};`;}
function pvDownload(){
  if(pv.busy)return;const p=collection().items[pv.idx];if(!p)return;const name=`${pv.srcName}-${pv.effect}-${slugify(p.name)}.png`;
  const full=pvFullData(),w=full.width,hh=full.height,opt=pvOpts(p.colors);opt.k=Math.round(pv.intensity*256);opt.w=w;opt.h=hh;delete opt.key;
  pv.busy=true;const btn=$('#pvDownload');if(btn){btn.disabled=true;btn.textContent='Preparing…';}
  const finish=blob=>{pv.busy=false;const b2=$('#pvDownload');if(b2){b2.disabled=false;b2.textContent='Download PNG';}if(blob){downloadBlob(blob,name);toast(`Downloaded ${name} (${w}×${hh})`);}else toast('Could not create the PNG');};
  const encode=out=>{const c=document.createElement('canvas');c.width=w;c.height=hh;c.getContext('2d').putImageData(new ImageData(out,w,hh),0,0);c.toBlob(finish,'image/png');};
  const onMain=()=>{pv.exportVia='main';try{encode(pvKernel(full.data,opt).out);}catch(e){finish(null);}};
  let wk=null;try{if(typeof Worker==='function'){if(!pvWorkerUrl)pvWorkerUrl=URL.createObjectURL(new Blob([pvWorkerSrc()],{type:'text/javascript'}));wk=new Worker(pvWorkerUrl);}}catch(e){wk=null;}
  if(!wk)return onMain();
  let settled=false;const fail=()=>{if(settled)return;settled=true;clearTimeout(guard);wk.terminate();onMain();};
  const guard=setTimeout(fail,60000);wk.onerror=fail;
  wk.onmessage=e=>{if(settled)return;settled=true;clearTimeout(guard);wk.terminate();const d=e.data;pv.exportVia=d.blob?'worker+offscreen':'worker';if(d.blob)finish(d.blob);else if(d.out)encode(new Uint8ClampedArray(d.out.buffer||d.out));else fail();};
  const src=full.data.slice();wk.postMessage({mode:opt.mode,lut:opt.lut,pal32:opt.pal32,ramp32:opt.ramp32,k:opt.k,w,h:hh,src},[src.buffer]);
}

/* ---------- modal ---------- */
function openPreview(idx,scene){pv.idx=idx;pv.shuffle=0;pv.base=S.theme;if(scene!==undefined)pv.scene=scene;renderPreview();}
function pvStep(d){const n=collection().items.length;pv.idx=clamp(pv.idx+d,0,n-1);renderPreview();}
/* Roles for the current palette: normal, Precise with derived extras, or Precise exact-count */
function pvCurrentRoles(p,sid){
  const base=pv.base||S.theme;
  if(!pv.precise||sid==='photo')return{mode:'normal',R:pvRoles(p.colors,pv.shuffle,base)};
  if(pv.exact[sid])return{mode:'exact',R:pvExactRoles(p.colors,pv.shuffle,base)};
  return{mode:'precise',R:pvPreciseRoles(p,pv.shuffle,base)};
}
function renderPreview(){
  const items=collection().items;if(!items.length)return;pv.idx=clamp(pv.idx,0,items.length-1);const p=items[pv.idx];
  const[sid,slabel]=PV_SCENES[pv.scene];const{mode,R}=pvCurrentRoles(p,sid);const exactCount=mode==='exact';
  const prevBox=$('.pv-box');const keepScroll=prevBox?prevBox.scrollTop:0;
  const stage=h('div',{class:'pv-stage','data-scene':sid,'data-mode':mode});
  if(sid==='photo'){const ps=pvSource();const cv=h('canvas',{width:ps.width,height:ps.height,'aria-label':'Photo with palette effect'});cv.getContext('2d',{willReadFrequently:true});stage.append(cv);pvRenderPhoto(cv,p.colors);}
  else if(sid==='text'){pvEnsureFont(pv.font);stage.append(pvTextScene(R,exactCount));}
  else if(exactCount)stage.innerHTML=pvExactScene(sid,R);
  else{let svg=PV_SCENE_FN[sid](R);if(mode==='precise'){const low=svg.toLowerCase();if(p.colors.some(c=>!low.includes(c.toLowerCase())))svg=pvAddStrip(svg,p.colors);}stage.innerHTML=svg;}
  const tabs=h('div',{class:'pv-tabs',role:'tablist'},...PV_SCENES.map(([id,label],i)=>h('button',{type:'button',role:'tab','data-scene':id,'aria-selected':String(i===pv.scene),onclick:()=>{pv.scene=i;renderPreview();}},label)));
  const roleChip=(name,c)=>h('span',{class:'pv-role','data-role':name,'data-hex':c.toUpperCase(),title:`${name}: ${c.toUpperCase()}`},h('i',{style:'background:'+c}),name,pv.precise?h('code',null,c.toUpperCase()):null);
  const check=(id,label,on,title,fn)=>h('label',{class:'pv-check',title},h('input',{type:'checkbox',id,checked:on?'':null,onchange:e=>{fn(e.target.checked);renderPreview();}}),label);
  let tools,tools2=null;
  if(sid==='photo'){
    const sw=(which)=>h('span',{class:'pv-duo'},...p.colors.map((c,i)=>h('button',{type:'button',class:'pv-dot','aria-pressed':String((which==='A'?pv.duoA:pv.duoB)%p.colors.length===i),style:'background:'+c,title:(which==='A'?'Shadows: ':'Highlights: ')+c.toUpperCase(),onclick:()=>{if(which==='A')pv.duoA=i;else pv.duoB=i;renderPreview();}})));
    const file=h('input',{type:'file',accept:'image/*',class:'hidden',id:'pvFile',onchange:e=>{const f=e.target.files[0];e.target.value='';if(f)pvLoadImage(f);}});
    tools=h('div',{class:'pv-tools'},
      h('div',{class:'seg',role:'group','aria-label':'Effect'},...PV_EFFECTS.map(([id,l])=>h('button',{type:'button','data-effect':id,'aria-pressed':String(pv.effect===id),onclick:()=>{pv.effect=id;renderPreview();}},l))),
      pv.effect==='duo'?h('span',{class:'pv-duowrap'},h('small',null,'Shadows'),sw('A'),h('small',null,'Highlights'),sw('B')):null,
      h('label',{class:'pv-range'},'Intensity ',h('input',{type:'range',min:0,max:100,value:Math.round(pv.intensity*100),'aria-label':'Effect intensity',oninput:e=>{pv.intensity=+e.target.value/100;const pc=$('.pv-pct');if(pc)pc.textContent=e.target.value+'%';pvQueueRender(p.colors);}}),h('span',{class:'pv-pct'},Math.round(pv.intensity*100)+'%')),
      h('span',{style:'flex:1'}),
      file,h('button',{type:'button',class:'btn small',id:'pvLoad',onclick:()=>file.click()},'Load photo…'),
      pv.srcName!=='sample'?h('button',{type:'button',class:'btn small',onclick:()=>{pvDropPhoto();pv.srcName='sample';renderPreview();}},'Use sample'):null,
      h('button',{type:'button',class:'btn small primary',id:'pvDownload',disabled:pv.busy?'':null,onclick:pvDownload},pv.busy?'Preparing…':'Download PNG'));
  }else{
    let chips=exactCount?R.roles.map(([nm,c])=>roleChip(nm,c)):[roleChip('Background',R.bg),roleChip('Surface',R.surface),roleChip('Primary',R.primary),roleChip('Accent',R.accent),roleChip('Text',R.text)];
    if(mode==='precise'){const used=new Set([R.bg,R.surface,R.primary,R.accent,R.text].map(c=>c.toLowerCase()));let k=6;
      p.colors.forEach(c=>{if(used.has(c.toLowerCase()))return;used.add(c.toLowerCase());chips.push(roleChip(c===R.secondary?'Secondary':c===R.tertiary?'Tertiary':'Colour '+(k++),c));});}
    tools=h('div',{class:'pv-tools'},
      h('div',{class:'pv-roles'},...chips),
      h('span',{style:'flex:1'}),
      check('pvPrecise','Precise',pv.precise,'Show every palette colour with its exact value',v=>{pv.precise=v;}),
      pv.precise?check('pvExact','Use exact number of colours',!!pv.exact[sid],`A layout made for ${p.colors.length}-colour palettes in the ${slabel} preview; off = the standard layout with the missing roles derived from the palette`,v=>{pv.exact[sid]=v;}):null,
      sid==='product'?h('div',{class:'seg pv-set',role:'group','aria-label':'Product set'},...PV_PRODUCT_SETS.map(([id,l,tip],i)=>h('button',{type:'button','data-set':id,'aria-pressed':String(pv.productSet===i),title:tip,onclick:()=>{pv.productSet=i;renderPreview();}},l))):null,
      h('button',{type:'button',class:'btn small',id:'pvShuffle',title:pv.precise?'Cycle which palette colour takes which role':'Cycle through role assignments',onclick:()=>{pv.shuffle++;renderPreview();}},'⇄ Shuffle roles'),
      h('div',{class:'seg',role:'group','aria-label':'Base'},h('button',{type:'button','data-base':'light','aria-pressed':String(!R.dark),onclick:()=>{pv.base='light';renderPreview();}},'Light'),h('button',{type:'button','data-base':'dark','aria-pressed':String(!!R.dark),onclick:()=>{pv.base='dark';renderPreview();}},'Dark')));
    if(sid==='text'){
      const groups=[...new Set(PV_FONTS.map(f=>f.cat))];
      const sel=h('select',{id:'pvFont','aria-label':'Font',onchange:e=>{pv.font=e.target.value;renderPreview();}},
        h('option',{value:'system',selected:pv.font==='system'?'':null},'System default'),
        ...groups.map(g=>h('optgroup',{label:g},...PV_FONTS.filter(f=>f.cat===g).map(f=>h('option',{value:f.id,selected:pv.font===f.id?'':null},f.family)))));
      const fnt=pvFontById(pv.font);if(!pv.txt)pv.txt=Object.assign({},PV_TEXT_DEFAULT);
      const shown=pvTextLevels(R,exactCount).levels.map(l=>l.k);
      const fields=PV_TEXT_FIELDS.filter(([k])=>shown.includes(k)).map(([k,label])=>h('label',{class:'pv-field'},label,k==='body'?h('textarea',{rows:3,'data-field':k,oninput:e=>{pv.txt[k]=e.target.value;pvUpdateText(k);}},pv.txt[k]):h('input',{type:'text','data-field':k,value:pv.txt[k],oninput:e=>{pv.txt[k]=e.target.value;pvUpdateText(k);}})));
      tools2=h('div',{class:'pv-tools pv-tools-text'},
        h('label',{class:'pv-fontpick'},'Font ',sel),
        fnt?h('small',{class:'pv-fontinfo'},fnt.cat+' · see FONTS_NOTICE.md for designer and license'):h('small',{class:'pv-fontinfo'},'Your browser\u2019s default sans-serif'),
        h('span',{style:'flex:1'}),
        h('button',{type:'button',class:'btn small',id:'pvEditText','aria-expanded':String(!!pv.editText),onclick:()=>{pv.editText=!pv.editText;renderPreview();}},pv.editText?'Done editing':'Edit text…'),
        h('button',{type:'button',class:'btn small',id:'pvResetText',title:'Restore the sample text',onclick:()=>{pv.txt=Object.assign({},PV_TEXT_DEFAULT);renderPreview();}},'Reset text'),
        pv.editText?h('div',{class:'pv-fields'},...fields):null);
    }
  }
  const hint=sid==='photo'?'Effects run locally on a copy of the image; nothing is uploaded. Gradient map orders the palette by lightness; Posterize snaps each pixel to the nearest palette colour in OKLab; Duotone maps shadows → highlights between two colours. Download PNG renders your photo at full resolution (longest side up to 4096 px).'
    :exactCount?`Precise, exact count: a ${Math.min(p.colors.length,5)}-colour ${slabel} layout drawn only with the palette's own colours — nothing is tinted, shaded or faded. Shuffle roles changes which colour takes which role; Light/Dark picks backgrounds from the dark or the light end of the palette.${p.colors.length>5?' Colours beyond the fifth appear in the strip along the bottom.':''}`
    :pv.precise?'Precise: the palette colours fill Background, Text, Primary, Accent and Surface (in that order) with their exact values; roles the palette cannot fill are derived in keeping with its type or rule. Light/Dark picks backgrounds from the dark or the light end of the palette.'
    :'Roles are assigned automatically: text is chosen for WCAG contrast against its background, and missing roles are derived as OKLCH tints or shades. ← → step through palettes, Esc closes.';
  const box=h('div',{class:'box pv-box'},
    h('div',{class:'pv-head'},
      h('div',null,h('h2',null,'Preview'),h('div',{class:'pv-sub'},p.name,p.note?' · '+p.note:'',' · ',h('span',{class:'pv-swatches',role:'group','aria-label':'Palette colours, click to copy'},...p.colors.map(pvSwatch)))),
      h('span',{style:'flex:1'}),
      h('button',{type:'button',class:'btn small',id:'pvPrev',onclick:()=>pvStep(-1),disabled:pv.idx===0?'':null},'‹ Prev'),
      h('span',{class:'counter'},`${pv.idx+1} of ${items.length}`),
      h('button',{type:'button',class:'btn small',id:'pvNext',onclick:()=>pvStep(1),disabled:pv.idx>=items.length-1?'':null},'Next ›'),
      h('button',{type:'button',class:'btn small',onclick:()=>{toggleInList(p);renderPreview();}},inCurList(p)?'★ Saved':'☆ Save'),
      h('button',{type:'button',class:'btn small close',onclick:closeModal,'aria-label':'Close preview'},'Close ✕')),
    tabs,stage,tools,tools2,
    h('p',{class:'contrast-note',style:'margin:8px 0 0'},hint));
  const active=document.activeElement,keepField=active&&active.dataset?active.dataset.field:null;
  openModal(box);const nb=$('.pv-box');if(nb)nb.scrollTop=keepScroll;
  if(keepField){const f=nb.querySelector(`[data-field="${keepField}"]`);if(f){f.focus();try{f.setSelectionRange(f.value.length,f.value.length);}catch(e){}}}
}
/* Live update of one text level while typing (no full re-render, so the field keeps focus and caret) */
function pvUpdateText(k){const el=$('.pv-stage .pv-tx-'+k);if(el)el.textContent=pv.txt[k]||PV_TEXT_DEFAULT[k];}
