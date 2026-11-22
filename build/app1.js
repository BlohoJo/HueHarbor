/* =====================================================================
   Hue Harbor — single-file color palette browser
   Part 1: color math, data, palette generators
   ===================================================================== */
'use strict';

/* ---------- small utils ---------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const mod=(a,n)=>((a%n)+n)%n;
const r1=v=>Math.round(v*10)/10;
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const $=(s,el=document)=>el.querySelector(s);
const $$=(s,el=document)=>Array.from(el.querySelectorAll(s));
function h(tag,attrs,...kids){const e=document.createElement(tag);if(attrs)for(const k in attrs){const v=attrs[k];if(k==='class')e.className=v;else if(k==='style')e.style.cssText=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='html')e.innerHTML=v;else if(v!==null&&v!==undefined)e.setAttribute(k,v);}for(const k of kids.flat()){if(k===null||k===undefined||k===false)continue;e.append(k.nodeType?k:document.createTextNode(k));}return e;}

/* ---------- color conversions ---------- */
function hexToRgb(hex){hex=hex.replace('#','').trim();if(hex.length===3)hex=hex.split('').map(c=>c+c).join('');if(!/^[0-9a-f]{6}$/i.test(hex))return null;const n=parseInt(hex,16);return[n>>16&255,n>>8&255,n&255];}
function rgbToHex(r,g,b){return'#'+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');}
function rgbToHsl(r,g,b){r/=255;g/=255;b/=255;const M=Math.max(r,g,b),m=Math.min(r,g,b);let hh=0,s=0;const l=(M+m)/2;if(M!==m){const d=M-m;s=l>.5?d/(2-M-m):d/(M+m);switch(M){case r:hh=(g-b)/d+(g<b?6:0);break;case g:hh=(b-r)/d+2;break;default:hh=(r-g)/d+4;}hh*=60;}return[hh,s*100,l*100];}
function hslToRgb(hh,s,l){hh=mod(hh,360)/360;s=clamp(s,0,100)/100;l=clamp(l,0,100)/100;if(s===0){const v=l*255;return[v,v,v];}const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;const f=t=>{t=mod(t,1);if(t<1/6)return p+(q-p)*6*t;if(t<.5)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};return[f(hh+1/3)*255,f(hh)*255,f(hh-1/3)*255];}
function rgbToHsv(r,g,b){r/=255;g/=255;b/=255;const M=Math.max(r,g,b),m=Math.min(r,g,b),d=M-m;let hh=0;if(d){switch(M){case r:hh=(g-b)/d+(g<b?6:0);break;case g:hh=(b-r)/d+2;break;default:hh=(r-g)/d+4;}hh*=60;}return[hh,M?d/M*100:0,M*100];}
function hsvToRgb(hh,s,v){hh=mod(hh,360)/60;s/=100;v/=100;const i=Math.floor(hh),f=hh-i,p=v*(1-s),q=v*(1-s*f),t=v*(1-s*(1-f));let r,g,b;switch(i%6){case 0:r=v;g=t;b=p;break;case 1:r=q;g=v;b=p;break;case 2:r=p;g=v;b=t;break;case 3:r=p;g=q;b=v;break;case 4:r=t;g=p;b=v;break;default:r=v;g=p;b=q;}return[r*255,g*255,b*255];}
function rgbToCmyk(r,g,b){r/=255;g/=255;b/=255;const k=1-Math.max(r,g,b);if(k>=1)return[0,0,0,100];return[(1-r-k)/(1-k)*100,(1-g-k)/(1-k)*100,(1-b-k)/(1-k)*100,k*100];}
const hsl=(hh,s,l)=>rgbToHex(...hslToRgb(hh,s,l));

/* sRGB <-> OKLab / OKLCH */
const lin=c=>{c/=255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);};
const unlin=c=>{c=clamp(c,0,1);return 255*(c<=.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-.055);};
function rgbToOklab(r,g,b){const R=lin(r),G=lin(g),B=lin(b);const l=Math.cbrt(.4122214708*R+.5363325363*G+.0514459929*B),m=Math.cbrt(.2119034982*R+.6806995451*G+.1073969566*B),s=Math.cbrt(.0883024619*R+.2817188376*G+.6299787005*B);return[.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];}
function oklabToRgbRaw(L,a,b){const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;return[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];}
function rgbToOklch(r,g,b){const[L,a,bb]=rgbToOklab(r,g,b);return[L,Math.hypot(a,bb),mod(Math.atan2(bb,a)*180/Math.PI,360)];}
function inGamut(lr){return lr.every(v=>v>=-0.0005&&v<=1.0005);}
/* OKLCH -> hex, reducing chroma until the color fits in sRGB */
function oklchToHex(L,C,H){L=clamp(L,0,1);C=Math.max(0,C);const rad=H*Math.PI/180;let lo=0,hi=C,best=null;for(let i=0;i<18;i++){const c=(lo+hi)/2;const lr=oklabToRgbRaw(L,c*Math.cos(rad),c*Math.sin(rad));if(inGamut(lr)){best=lr;lo=c;}else hi=c;}if(!best)best=oklabToRgbRaw(L,0,0);return rgbToHex(...best.map(unlin));}
function hexToOklch(hex){return rgbToOklch(...hexToRgb(hex));}
function labDist(h1,h2){const a=rgbToOklab(...hexToRgb(h1)),b=rgbToOklab(...hexToRgb(h2));return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}
function luminance(hex){const[r,g,b]=hexToRgb(hex);return .2126*lin(r)+.7152*lin(g)+.0722*lin(b);}
function contrast(h1,h2){const a=luminance(h1),b=luminance(h2);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
function textOn(hex){return contrast(hex,'#111111')>=contrast(hex,'#ffffff')?'#111111':'#ffffff';}
function normHex(hex){const rgb=hexToRgb(hex);return rgb?rgbToHex(...rgb):null;}
function mixHex(h1,h2,t){const a=hexToRgb(h1),b=hexToRgb(h2);return rgbToHex(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t);}

/* ---------- recovered classic data ---------- */
// DATA_PLACEHOLDER
const PALETTE=RAW_PALETTE.map(([id,dic,label,hex])=>({id,dic,label,hex:'#'+hex,row:id===255?11:Math.floor(id/16),col:id===255?16:id%16}));
const PAL_BY_ID=new Map(PALETTE.map(p=>[p.id,p]));
const MOODS=["Powerful","Rich","Romantic","Vital","Earthy","Friendly","Soft","Welcoming","Moving","Elegant","Trendy","Fresh","Traditional","Refreshing","Tropical","Classic","Dependable","Calm","Regal","Magical","Nostalgic","Energetic","Subdued","Professional"];
const MOOD_GROUPS=[[0,10],[10,15],[15,23],[23,24]];
const SCI=["Achromatic","Analogous","Clash","Complementary","Distinct","Monochromatic","Neutral","Similar","Split Complementary","Primary","Secondary","Tertiary"];
const SETS=RAW_SETS.split(';').map((s,i)=>{const ids=s.split(',').map(Number);const mi=RAW_MOOD.charCodeAt(i)-65,si=RAW_SCI.charCodeAt(i)-97;return{id:i+1,ids,hexes:ids.map(x=>PAL_BY_ID.get(x).hex),mood:mi>=0&&mi<24?mi:-1,sci:si>=0&&si<12?si:-1};});
const SETS_BY_MOOD=MOODS.map((_,i)=>SETS.filter(s=>s.mood===i));
const SETS_BY_SCI=SCI.map((_,i)=>SETS.filter(s=>s.sci===i));
function setsByColor(id){return SETS.filter(s=>s.ids.includes(id));}
function nearestBase(hex){let best=null,bd=1e9;for(const p of PALETTE){const d=labDist(hex,p.hex);if(d<bd){bd=d;best=p;}}return{color:best,dist:bd};}

/* ---------- palette type catalogue ---------- */
const MODERN=["Triadic","Tetradic (Square)","Rectangle (Double Complementary)","Accented Analogous","Compound","Shades","Tints","Tones","Perceptual Analogous","Perceptual Triad","Perceptual Complement","Pastel","Neon / Vivid","Muted / Dusty","High Contrast (WCAG)"];
const TYPE_GROUPS=[
  {name:'Mood',items:MOODS,sepAfter:[9,14,22]},
  {name:'Classic theory',items:SCI,sepAfter:[8]},
  {name:'Modern',items:MODERN,sepAfter:[4,7,10]}
];
const ALL_TYPES=[...MOODS,...SCI,...MODERN];

const INFO={
 Powerful:"Anchored on saturated red: bold, assertive, high-contrast combinations that demand attention.",
 Rich:"A strong hue next to its darkened complement — burgundy, forest green, gold. Suggests wealth and drama.",
 Romantic:"Pink and other lightened hues such as lavender and peach. Gentle, tender, soft-edged.",
 Vital:"Vermilion and red-orange, often sparked by turquoise. Energetic and youthful.",
 Earthy:"Terra-cotta and warm, dark analogous tones. Natural, grounded, Southwestern.",
 Friendly:"Orange and its neighbors. Open, informal and inviting.",
 Soft:"Low-contrast light tints centred on peach, sometimes with violet and green tints. Relaxing.",
 Welcoming:"Amber, saffron and creamy yellow-orange tints. Cordial and festive.",
 Moving:"Primary yellow in high contrast, for example against violet. Brightness and motion.",
 Elegant:"Only the palest tints — cream, eggshell, linen. Understated and refined.",
 Trendy:"Chartreuse / yellow-green used as an accent, often against magenta. Offbeat and current.",
 Fresh:"Green with small red accents or sky blue. Outdoors, clean, healthy.",
 Traditional:"Grayed or deepened blue with burgundy, tan, hunter green, gold and black. Conservative and stable.",
 Refreshing:"Teal and blue-green cooled against red-orange. Crisp yet calm.",
 Tropical:"Turquoise with the lightest blue-green tints and a touch of red-orange. Serene.",
 Classic:"Intense royal blue, frequently with its split complements red-orange and yellow-orange. Authority and trust.",
 Dependable:"Navy blue, optionally accented with red and gold. Reliable and authoritative.",
 Calm:"Grayed or lightened blues with accents of similar value. Restful.",
 Regal:"Blue-violet, the darkest hue, set against yellow-orange. Royal and imposing.",
 Magical:"Violet with orange and green, or with chartreuse and yellow-orange. Whimsical and surprising.",
 Nostalgic:"Lavender among other pastels. Dreamy, Victorian.",
 Energetic:"Fuchsia / magenta, often with chartreuse. Exuberant.",
 Subdued:"Mauve and other grayed tints and shades. Low contrast; benefits from one spark of complement.",
 Professional:"Grays and tonal blacks, optionally with a single vivid accent. Sober and practical.",
 Achromatic:"Built from neutrals only — black, white and grays — optionally around one hue.",
 Analogous:"Neighbouring hues on the wheel in any of their tints or shades.",
 Clash:"A hue combined with the hue just to one side of its complement.",
 Complementary:"Hues directly opposite each other on the wheel.",
 Distinct:"Three clearly contrasting hues plus one colour that deliberately stands apart (four colours).",
 Monochromatic:"One hue with its own tints, tones and shades.",
 Neutral:"A hue dulled by mixing in its complement or black.",
 Similar:"Adjacent hues balanced by alternating pale and bright members.",
 "Split Complementary":"A hue plus the two hues flanking its complement (three colours).",
 Primary:"Red, yellow and blue together, with your colour standing in for the primary nearest to it.",
 Secondary:"Orange, green and violet together, anchored on your colour.",
 Tertiary:"One of the two triads of tertiary hues (red-orange / yellow-green / blue-violet, or blue-green / yellow-orange / red-violet).",
 Triadic:"Three hues evenly spaced 120° apart. Balanced and lively.",
 "Tetradic (Square)":"Four hues 90° apart — two complementary pairs forming a square.",
 "Rectangle (Double Complementary)":"Two complementary pairs that are 60° apart, forming a rectangle on the wheel.",
 "Accented Analogous":"Three neighbouring hues plus the complement of the middle one as an accent.",
 Compound:"Your hue and a near neighbour, each paired with a near-complement. A softened tetrad.",
 Shades:"Your colour stepping down toward black.",
 Tints:"Your colour stepping up toward white.",
 Tones:"Your colour desaturated step by step toward gray.",
 "Perceptual Analogous":"Neighbouring hues computed in the perceptual OKLCH space, so lightness and chroma stay visually equal.",
 "Perceptual Triad":"Three hues 120° apart in OKLCH, with matching perceived lightness and chroma.",
 "Perceptual Complement":"The opposite hue in OKLCH, with lightness ramps. Often differs from the RGB complement.",
 Pastel:"Companions pushed to high lightness and low chroma around your colour.",
 "Neon / Vivid":"Companions at the maximum chroma sRGB can show.",
 "Muted / Dusty":"Low-chroma, mid-lightness companions with a vintage feel.",
 "High Contrast (WCAG)":"Partners that reach WCAG AA (4.5:1) or AAA (7:1) text contrast against your colour, plus a high-contrast accent."
};

/* ---------- generator helpers ---------- */
function palObj(type,colors,anchor,note,variant){return{type,colors,anchor,note:note||'',name:type+(variant?' · '+variant:'')};}
function dedupe(list,max){const seen=new Set(),out=[];for(const p of list){const k=p.colors.join();if(seen.has(k))continue;seen.add(k);out.push(p);if(out.length>=max)break;}return out;}
function withAnchorExact(colors,anchorIdx,hex){colors[anchorIdx]=hex;return colors;}

/* Build palettes from HSL "recipes": array of [dh, S, L] with null meaning "keep user value". Anchor = user colour. */
function fromRecipe(base,recipe,anchorPos,type,note,variant){
  const[H,S,L]=base.hsl;
  const cols=recipe.map(([dh,s,l])=>hsl(H+dh,s===null?S:s,l===null?L:l));
  const pos=clamp(anchorPos,0,cols.length);
  cols.splice(pos,0,base.hex);
  return palObj(type,cols,pos,note,variant);
}
const lt=(L,d)=>clamp(L+d,6,96);
function sBright(S){return clamp(Math.max(S,55),0,100);}

/* ----- classic theory & modern schemes (HSL wheel unless noted) ----- */
function theoryPalettes(type,base){
  const[H,S,L]=base.hsl;const out=[];const R=rng(hashStr(type+base.hex));
  const push=(recipe,pos,variant,note)=>out.push(fromRecipe(base,recipe,pos,type,note,variant));
  const spreadSets=(angles,label)=>{ // helper making several lightness arrangements of a hue set
    push(angles.map(a=>[a,null,null]),0,label+' · flat');
    push(angles.map((a,i)=>[a,null,lt(L,i%2?14:-14)]),1,label+' · alternating');
    push(angles.map((a,i)=>[a,sBright(S),lt(L,(i-(angles.length-1)/2)*12)]),Math.floor(angles.length/2),label+' · graded');
    push(angles.map(a=>[a,clamp(S*.7,0,100),lt(L,18)]),0,label+' · lighter');
    push(angles.map(a=>[a,null,lt(L,-18)]),angles.length,label+' · deeper');
  };
  switch(type){
    case 'Complementary':{
      push([[180,null,null]],0,'pair');
      push([[180,null,null]],1,'pair · reversed');
      push([[180,null,lt(L,-20)],[180,null,lt(L,20)]],0,'shade & tint');
      push([[0,null,lt(L,25)],[180,null,null]],0,'with own tint');
      push([[0,null,lt(L,-22)],[180,null,null],[180,null,lt(L,22)]],0,'four');
      push([[180,sBright(S),null],[0,0,92]],0,'with white');
      push([[180,null,null],[0,0,12]],0,'with black');
      push([[0,clamp(S*.5,0,100),lt(L,30)],[180,null,null],[180,clamp(S*.5,0,100),lt(L,30)],[0,0,50]],0,'five');
      push([[180,null,lt(L,-10)],[0,null,lt(L,15)]],0,'offset');
      push([[175,null,null],[185,null,lt(L,-15)]],0,'near pair');
      push([[180,clamp(S*.6,0,100),lt(L,10)]],0,'softened');
      push([[180,100,50],[0,0,95],[0,0,20]],0,'poster');
      break;}
    case 'Analogous':
      spreadSets([-30,30],'±30');
      spreadSets([30,60],'ahead');
      spreadSets([-60,-30],'behind');
      push([[-45,null,null],[-15,null,null],[15,null,null],[45,null,null]],2,'wide 5');
      push([[-20,null,lt(L,15)],[20,null,lt(L,-15)]],0,'tight');
      push([[-30,null,null],[30,null,null],[0,0,94]],0,'with white');
      break;
    case 'Split Complementary':
      spreadSets([150,210],'150/210');
      push([[160,null,null],[200,null,null]],0,'narrow 160/200');
      push([[140,null,null],[220,null,null]],0,'wide 140/220');
      push([[150,null,lt(L,-18)],[210,null,lt(L,18)],[0,null,lt(L,25)]],0,'four');
      push([[150,sBright(S),50],[210,sBright(S),50],[0,0,92],[0,0,16]],0,'poster');
      push([[150,null,null],[210,null,null],[180,clamp(S*.4,0,100),lt(L,10)]],0,'with complement tone');
      break;
    case 'Clash':
      push([[150,null,null]],0,'−30 from complement');
      push([[210,null,null]],0,'+30 from complement');
      push([[150,null,lt(L,-15)]],1,'deep · reversed');
      push([[210,null,lt(L,15)]],1,'light · reversed');
      push([[150,null,null],[0,null,lt(L,22)]],0,'with own tint');
      push([[210,null,null],[0,null,lt(L,-22)]],0,'with own shade');
      push([[150,null,null],[210,null,lt(L,15)]],0,'both sides');
      push([[140,sBright(S),null]],0,'140');
      push([[220,sBright(S),null]],0,'220');
      push([[150,null,null],[0,0,94]],0,'with white');
      push([[210,null,null],[0,0,14]],0,'with black');
      push([[150,clamp(S*.6,0,100),lt(L,10)],[150,null,lt(L,-20)]],0,'two tones');
      break;
    case 'Monochromatic':
      push([[0,null,lt(L,20)],[0,null,lt(L,-20)]],1,'±20');
      push([[0,null,lt(L,15)],[0,null,lt(L,30)]],0,'lighter steps');
      push([[0,null,lt(L,-15)],[0,null,lt(L,-30)]],0,'darker steps');
      push([[0,null,lt(L,-25)],[0,null,lt(L,-12)],[0,null,lt(L,12)],[0,null,lt(L,25)]],2,'five ramp');
      push([[0,clamp(S*.5,0,100),null],[0,clamp(S*.2,0,100),null]],0,'saturation ramp');
      push([[0,null,lt(L,25)]],0,'tint pair');
      push([[0,null,lt(L,-25)]],0,'shade pair');
      push([[0,clamp(S*.4,0,100),lt(L,30)],[0,null,lt(L,-30)]],1,'pale & deep');
      push([[0,null,lt(L,35)],[0,null,lt(L,-35)]],1,'wide');
      push([[0,clamp(S*.3,0,100),lt(L,-10)],[0,null,lt(L,18)]],0,'tone & tint');
      push([[0,null,lt(L,10)],[0,null,lt(L,20)],[0,null,lt(L,30)]],0,'four ascending');
      push([[0,null,lt(L,-10)],[0,null,lt(L,-20)],[0,null,lt(L,-30)]],0,'four descending');
      break;
    case 'Achromatic':
      push([[0,0,10]],0,'with black');
      push([[0,0,95]],0,'with white');
      push([[0,0,50]],0,'with mid gray');
      push([[0,0,10],[0,0,95]],0,'black & white');
      push([[0,0,25],[0,0,60],[0,0,92]],0,'gray ramp');
      push([[0,0,80],[0,0,30]],1,'between grays');
      push([[0,0,lt(L,-30)],[0,0,lt(L,30)]],1,'value-matched grays');
      push([[0,0,15],[0,0,40],[0,0,70],[0,0,95]],0,'full ramp');
      push([[0,0,88]],1,'on light gray');
      push([[0,0,20]],1,'on charcoal');
      push([[0,0,97],[0,0,5]],1,'poster');
      push([[0,0,35],[0,0,75]],0,'two grays');
      break;
    case 'Neutral':{
      const comp=hsl(H+180,S,L);
      const dull=t=>mixHex(base.hex,comp,t), dark=t=>mixHex(base.hex,'#000000',t);
      const P=(cols,pos,v,note)=>{cols.splice(pos,0,base.hex);out.push(palObj(type,cols,pos,note,v));};
      P([dull(.3)],0,'dulled 30%');
      P([dull(.5)],0,'dulled 50%');
      P([dark(.35)],0,'darkened');
      P([dull(.3),dull(.55)],0,'two dulls');
      P([dull(.4),dark(.4)],0,'dull & dark');
      P([dull(.25),mixHex(dull(.25),'#ffffff',.4)],0,'dull & pale');
      P([dark(.3),dark(.55)],0,'two darks');
      P([dull(.45),mixHex(dull(.45),'#000000',.4)],1,'reversed');
      P([dull(.35),mixHex(base.hex,'#ffffff',.5)],0,'with tint');
      P([dull(.5),dark(.3),mixHex(dull(.5),'#ffffff',.5)],0,'four');
      P([mixHex(comp,'#000000',.3)],0,'dark complement');
      P([dull(.6),'#2a2a2a'],0,'with charcoal');
      break;}
    case 'Similar':
      push([[-20,100,52],[20,clamp(S*.6,0,100),84]],1,'bright & pale');
      push([[-20,clamp(S*.6,0,100),84],[20,100,52]],1,'pale & bright');
      push([[25,100,50]],0,'bright neighbour');
      push([[-25,clamp(S*.6,0,100),85]],0,'pale neighbour');
      push([[15,100,48],[30,clamp(S*.5,0,100),86]],0,'ascending');
      push([[-15,clamp(S*.5,0,100),86],[-30,100,48]],0,'descending');
      push([[-30,100,50],[-15,50,88],[15,100,50],[30,50,88]],2,'five');
      push([[20,100,45],[20,40,88]],0,'same hue pair');
      push([[-20,90,55],[0,40,90]],0,'with own pale');
      push([[30,100,50],[-30,45,86]],1,'spread');
      break;
    case 'Distinct':
      push([[120,null,null],[240,null,null],[0,0,12]],0,'triad + black');
      push([[120,null,null],[240,null,null],[0,0,94]],0,'triad + white');
      push([[90,null,null],[180,null,null],[0,0,50]],0,'90/180 + gray');
      push([[150,null,null],[210,null,null],[0,0,92]],0,'split + white');
      push([[120,null,lt(L,10)],[240,null,lt(L,-10)],[0,8,80]],0,'triad + warm gray');
      push([[90,null,null],[270,null,null],[0,0,15]],0,'90/270 + black');
      push([[120,null,null],[240,null,null],[60,15,90]],1,'triad + cream');
      push([[180,null,null],[60,null,null],[0,0,30]],0,'60/180 + charcoal');
      push([[135,null,null],[225,null,null],[0,0,96]],2,'split-ish + white');
      push([[120,sBright(S),50],[240,sBright(S),50],[0,0,10]],0,'vivid + black');
      break;
    case 'Primary': case 'Secondary': case 'Tertiary':{
      const triads=type==='Primary'?[[0,60,240]]:type==='Secondary'?[[30,120,270]]:[[15,90,255],[45,180,300]];
      let best=null;for(const tri of triads)for(const hh of tri){const d=Math.abs(mod(H-hh+180,360)-180);if(!best||d<best.d)best={d,tri,hh};}
      const others=best.tri.filter(x=>x!==best.hh);
      const abs=(hh,s,l)=>hsl(hh,s,l);
      const P=(cols,pos,v)=>{cols.splice(pos,0,base.hex);out.push(palObj(type,cols,pos,'',v));};
      const sat=sBright(S);
      P(others.map(x=>abs(x,sat,50)),0,'pure');
      P(others.map(x=>abs(x,sat,L)),0,'value-matched');
      P(others.map((x,i)=>abs(x,sat,i?lt(L,15):lt(L,-15))),1,'graded');
      P(others.map(x=>abs(x,clamp(S*.7,0,100),lt(L,20))),0,'lighter');
      P(others.map(x=>abs(x,sat,lt(L,-18))),2,'deeper');
      P([...others.map(x=>abs(x,sat,50)),'#f3f3f3'],0,'with white');
      P([...others.map(x=>abs(x,sat,50)),'#161616'],0,'with black');
      P([abs(others[0],sat,50)],0,'pair A');
      P([abs(others[1],sat,50)],0,'pair B');
      P([...others.map(x=>abs(x,sat,L)),abs(best.hh,clamp(S*.4,0,100),88)],0,'with own pale');
      P([abs(others[0],sat,lt(L,-10)),abs(others[1],clamp(S*.6,0,100),lt(L,22))],0,'mixed');
      break;}
    case 'Triadic':
      spreadSets([120,240],'120°');
      push([[120,null,null],[240,null,null],[0,0,95]],0,'with white');
      push([[120,null,null],[240,null,null],[0,0,12]],0,'with black');
      push([[110,null,null],[250,null,null]],0,'slightly open');
      push([[120,clamp(S*.5,0,100),lt(L,25)],[240,clamp(S*.5,0,100),lt(L,25)]],0,'soft partners');
      push([[120,null,null]],0,'two of three A');
      push([[240,null,null]],0,'two of three B');
      break;
    case 'Tetradic (Square)':
      spreadSets([90,180,270],'square');
      push([[90,null,null],[180,null,null],[270,null,null],[0,0,94]],0,'with white');
      push([[90,clamp(S*.6,0,100),lt(L,20)],[180,null,null],[270,clamp(S*.6,0,100),lt(L,-20)]],0,'soft diagonals');
      push([[180,null,null],[90,null,lt(L,15)]],0,'three of four');
      break;
    case 'Rectangle (Double Complementary)':
      spreadSets([60,180,240],'+60');
      spreadSets([-60,180,120],'−60');
      push([[60,null,null],[180,null,null],[240,null,null],[0,0,14]],0,'with black');
      break;
    case 'Accented Analogous':
      spreadSets([-30,30,180],'±30 + complement');
      push([[-20,null,null],[20,null,null],[180,sBright(S),50]],1,'tight + vivid accent');
      push([[30,null,null],[60,null,null],[210,null,null]],0,'ahead + accent');
      push([[-30,null,null],[30,null,null],[180,null,null],[0,0,94]],1,'with white');
      push([[-30,clamp(S*.6,0,100),lt(L,18)],[30,clamp(S*.6,0,100),lt(L,18)],[180,sBright(S),lt(L,-5)]],0,'soft + punch');
      break;
    case 'Compound':
      spreadSets([30,180,210],'+30');
      spreadSets([-30,180,150],'−30');
      push([[30,null,lt(L,15)],[180,null,null],[210,null,lt(L,-15)],[0,0,92]],0,'with white');
      break;
    case 'Shades':{
      const sh=t=>mixHex(base.hex,'#000000',t);
      const P=(cols,pos,v)=>{cols.splice(pos,0,base.hex);out.push(palObj(type,cols,pos,'',v));};
      P([sh(.25),sh(.5)],0,'two steps');P([sh(.2),sh(.4),sh(.6)],0,'three steps');P([sh(.15),sh(.3),sh(.45),sh(.6)],0,'four steps');
      P([sh(.4)],0,'pair');P([sh(.7)],0,'deep pair');P([sh(.3),sh(.6),sh(.85)],0,'to near-black');
      P([sh(.5)],1,'reversed');P([sh(.2),sh(.6)],1,'centred');P([sh(.1),sh(.2),sh(.3)],0,'subtle');P([sh(.35),sh(.7),'#0e0e0e'],0,'with black');
      break;}
    case 'Tints':{
      const ti=t=>mixHex(base.hex,'#ffffff',t);
      const P=(cols,pos,v)=>{cols.splice(pos,0,base.hex);out.push(palObj(type,cols,pos,'',v));};
      P([ti(.25),ti(.5)],0,'two steps');P([ti(.2),ti(.4),ti(.6)],0,'three steps');P([ti(.15),ti(.3),ti(.45),ti(.6)],0,'four steps');
      P([ti(.4)],0,'pair');P([ti(.75)],0,'pale pair');P([ti(.3),ti(.6),ti(.88)],0,'to near-white');
      P([ti(.5)],1,'reversed');P([ti(.2),ti(.6)],1,'centred');P([ti(.1),ti(.2),ti(.3)],0,'subtle');P([ti(.35),ti(.7),'#f7f7f7'],0,'with white');
      break;}
    case 'Tones':{
      const gray=hsl(H,0,L);const to=t=>mixHex(base.hex,gray,t);
      const P=(cols,pos,v)=>{cols.splice(pos,0,base.hex);out.push(palObj(type,cols,pos,'',v));};
      P([to(.3),to(.6)],0,'two steps');P([to(.25),to(.5),to(.75)],0,'three steps');P([to(.2),to(.4),to(.6),to(.8)],0,'four steps');
      P([to(.5)],0,'pair');P([to(.85)],0,'near-gray pair');P([to(.4),gray],0,'with gray');
      P([to(.5)],1,'reversed');P([to(.3),mixHex(to(.3),'#000',.3)],0,'tone & dark tone');P([to(.3),mixHex(to(.3),'#fff',.3)],0,'tone & light tone');P([to(.5),to(.8),gray],1,'centred');
      break;}
    case 'Perceptual Analogous': case 'Perceptual Triad': case 'Perceptual Complement':{
      const[Lk,Ck,Hk]=base.oklch;const ang=type==='Perceptual Analogous'?[[-30,30],[30,60],[-60,-30],[-20,20],[-45,-15,15,45]]:type==='Perceptual Triad'?[[120,240],[115,245],[120],[240]]:[[180],[175,185],[180,180],[180,180,180],[180,180,180,180],[170],[190]];
      const C=Math.max(Ck,.04);
      const P=(cols,pos,v)=>{cols.splice(pos,0,base.hex);out.push(palObj(type,cols,pos,'',v));};
      for(const a of ang){
        const lab=a.join('/');
        if(type==='Perceptual Complement'&&a.length>1){ // lightness ramps on the complement
          P(a.map((d,i)=>oklchToHex(clamp(Lk+(i-(a.length-1)/2)*.18,.1,.95),C,Hk+d)),0,lab+'° ramp');
          continue;
        }
        P(a.map(d=>oklchToHex(Lk,C,Hk+d)),0,lab+'° · equal L/C');
        P(a.map((d,i)=>oklchToHex(clamp(Lk+(i%2?.12:-.12),.1,.95),C,Hk+d)),1,lab+'° · alternating L');
        P(a.map(d=>oklchToHex(clamp(Lk+.15,.1,.95),C*.7,Hk+d)),0,lab+'° · lighter');
        P(a.map(d=>oklchToHex(clamp(Lk-.15,.1,.95),C,Hk+d)),a.length,lab+'° · deeper');
      }
      break;}
    case 'Pastel': case 'Neon / Vivid': case 'Muted / Dusty':{
      const[Lk,Ck,Hk]=base.oklch;
      const style=type==='Pastel'?{L:.87,C:.07}:type==='Neon / Vivid'?{L:.72,C:.32}:{L:.6,C:.05};
      const P=(cols,pos,v)=>{cols.splice(pos,0,base.hex);out.push(palObj(type,cols,pos,'',v));};
      const sets=[[180],[-30,30],[120,240],[30,60],[-60,-30],[90,180,270],[150,210],[180,0],[-30,30,180],[60,120]];
      for(const a of sets){
        const jitter=(R()-.5)*.06;
        P(a.map((d,i)=>oklchToHex(clamp(style.L+jitter+(i%2?.04:-.04),.1,.96),style.C,Hk+d)),0,a.join('/')+'°');
      }
      P([oklchToHex(style.L,style.C,Hk),oklchToHex(style.L+ (type==='Pastel'?.06:-.1),style.C,Hk+180)],0,'own hue + complement');
      P([oklchToHex(style.L,style.C,Hk+15),oklchToHex(style.L,style.C,Hk-15),oklchToHex(clamp(style.L+.05,0,.97),style.C*.6,Hk+180)],1,'near hues + soft accent');
      break;}
    case 'High Contrast (WCAG)':{
      const[Lk,Ck,Hk]=base.oklch;
      const P=(cols,pos,v,note)=>{cols.splice(pos,0,base.hex);out.push(palObj(type,cols,pos,note,v));};
      // find same-hue / other-hue partners reaching a target contrast
      const find=(hue,c,target,dir)=>{for(let i=0;i<=40;i++){const Lt=dir>0?Math.min(.99,Lk+i*.02):Math.max(.0,Lk-i*.02);const hx=oklchToHex(Lt,c,hue);if(contrast(hx,base.hex)>=target)return hx;}return dir>0?'#ffffff':'#000000';};
      const dirUp=Lk<.55?1:-1;
      const cand=[['same hue',Hk,Math.min(Ck,.12)],['complement',Hk+180,.12],['neutral',Hk,.01],['analogous',Hk+40,.12]];
      for(const[lab,hue,c]of cand){
        const aa=find(hue,c,4.5,dirUp),aaa=find(hue,c,7,dirUp);
        P([aa],0,lab+' · AA',`contrast ${contrast(aa,base.hex).toFixed(2)}:1`);
        P([aaa],0,lab+' · AAA',`contrast ${contrast(aaa,base.hex).toFixed(2)}:1`);
        P([aa,find(hue,c,4.5,-dirUp)],1,lab+' · both directions',`${contrast(aa,base.hex).toFixed(2)}:1 / ${contrast(find(hue,c,4.5,-dirUp),base.hex).toFixed(2)}:1`);
      }
      const bw=contrast(base.hex,'#000')>contrast(base.hex,'#fff')?'#000000':'#ffffff';
      P([bw],0,'black or white',`contrast ${contrast(bw,base.hex).toFixed(2)}:1`);
      P([bw,oklchToHex(dirUp>0?.85:.35,.18,Hk+180)],0,'with accent',`text ${contrast(bw,base.hex).toFixed(2)}:1`);
      break;}
  }
  return out;
}

/* ----- mood generators: templates from the classic sets + mood rules ----- */
const MOOD_RULES={ // central hue (HSL degrees) and seed partners [dh, S, L]
 Powerful:{h:0,seeds:[[[0,0,8]],[[60,100,55]],[[0,0,96],[0,0,8]],[[0,100,45],[0,0,10]],[[200,70,20]],[[45,100,50],[0,0,6]]]},
 Rich:{h:345,seeds:[[[150,60,22],[45,80,45]],[[150,55,22]],[[45,85,42],[0,0,8]],[[170,50,25],[45,75,40],[0,0,10]],[[-20,70,25],[40,80,48]]]},
 Romantic:{h:340,seeds:[[[-70,45,82],[20,80,82]],[[-80,45,85]],[[30,80,84],[60,70,90]],[[-100,40,86],[20,70,84],[0,0,97]],[[-50,40,80]]]},
 Vital:{h:12,seeds:[[[165,70,45]],[[165,70,45],[0,0,98]],[[20,100,60],[165,60,50]],[[180,60,40],[40,100,55]],[[160,65,50],[0,0,12]]]},
 Earthy:{h:18,seeds:[[[20,60,30],[40,50,45]],[[-10,60,25]],[[30,45,40],[90,30,35]],[[15,55,30],[45,45,55],[60,25,75]],[[-5,50,22],[35,60,50],[150,25,35]]]},
 Friendly:{h:28,seeds:[[[-20,100,55],[20,100,55]],[[30,100,60]],[[-25,95,60],[25,95,60],[45,90,88]],[[20,100,55],[200,60,55]],[[-15,100,50],[60,70,85]]]},
 Soft:{h:25,seeds:[[[0,70,86],[-40,50,88]],[[50,60,90]],[[-30,50,88],[230,40,88]],[[0,60,88],[120,40,88],[270,40,90]],[[30,60,90],[0,0,96]]]},
 Welcoming:{h:38,seeds:[[[0,100,50],[0,80,86]],[[-10,100,55]],[[10,90,88],[0,0,97]],[[0,100,50],[20,80,88],[0,0,12]],[[-15,100,60],[30,60,90]]]},
 Moving:{h:55,seeds:[[[215,70,40]],[[215,70,40],[0,0,98]],[[220,65,45],[0,100,50]],[[-55,100,50],[215,70,40]],[[200,80,45],[0,0,10]]]},
 Elegant:{h:45,seeds:[[[0,45,92],[0,30,96]],[[20,40,94]],[[0,30,94],[200,25,94]],[[0,40,93],[-20,35,95],[0,0,98]],[[0,25,95],[0,0,40]]]},
 Trendy:{h:80,seeds:[[[220,100,45]],[[220,100,45],[0,0,10]],[[240,90,50],[200,90,55]],[[220,100,45],[0,0,96]],[[-30,100,50],[220,85,45],[0,0,15]]]},
 Fresh:{h:120,seeds:[[[240,100,50]],[[80,60,55],[0,0,98]],[[-10,50,45],[240,90,50]],[[80,70,60],[10,60,50],[0,0,97]],[[-20,50,40],[20,60,70]]]},
 Traditional:{h:215,seeds:[[[125,80,25],[-180,45,45]],[[130,70,25],[-75,50,30]],[[-180,50,40],[-75,60,28],[0,0,10]],[[-75,50,25],[-170,70,45]],[[-80,50,28],[-180,50,45],[125,60,30],[0,0,12]]]},
 Refreshing:{h:180,seeds:[[[-165,90,55]],[[-165,85,55],[0,0,98]],[[20,60,50],[-165,90,55]],[[-170,80,60],[0,30,90]],[[-20,60,55],[-165,85,55],[0,0,14]]]},
 Tropical:{h:172,seeds:[[[0,45,86],[-160,90,58]],[[0,50,88]],[[-160,90,58],[0,0,98]],[[10,40,90],[-5,60,70],[-160,85,58]],[[0,55,80],[-150,80,60]]]},
 Classic:{h:222,seeds:[[[-210,90,52],[-180,100,55]],[[-210,90,52]],[[-180,100,55],[0,0,98]],[[-210,85,52],[-180,100,55],[0,0,12]],[[-190,80,55]]]},
 Dependable:{h:220,seeds:[[[0,70,25]],[[-220,80,48],[-175,80,50]],[[-220,75,45],[0,0,97]],[[-175,80,50],[0,0,12]],[[0,60,25],[-175,85,50],[-220,80,48],[0,0,96]]]},
 Calm:{h:210,seeds:[[[0,25,75],[0,30,55]],[[-10,20,70]],[[10,25,60],[0,0,90]],[[0,20,70],[60,15,70],[0,0,94]],[[-20,30,65],[20,30,80]]]},
 Regal:{h:255,seeds:[[[-215,100,52]],[[-215,100,52],[0,0,10]],[[-220,90,55],[-200,80,80]],[[-215,100,52],[0,0,97]],[[-20,60,30],[-215,95,55]]]},
 Magical:{h:275,seeds:[[[-245,100,55],[-155,70,45]],[[-195,100,50],[-235,100,55]],[[-245,100,55]],[[-155,70,45],[0,0,10]],[[-195,90,50],[-235,95,55],[0,0,97]]]},
 Nostalgic:{h:270,seeds:[[[70,60,85],[-90,60,85]],[[60,50,88]],[[-120,40,88],[-30,50,86]],[[80,55,88],[-60,45,86],[0,0,97]],[[-150,40,90],[60,50,86]]]},
 Energetic:{h:310,seeds:[[[130,100,50]],[[130,100,50],[0,0,10]],[[140,100,55],[-60,100,55]],[[130,95,50],[0,0,97]],[[-20,90,45],[135,95,50],[0,0,12]]]},
 Subdued:{h:330,seeds:[[[0,20,60],[0,25,40]],[[-10,20,70]],[[10,20,50],[0,0,88]],[[0,20,60],[180,25,55]],[[-15,15,75],[15,25,45],[0,0,92]]]},
 Professional:{h:220,seeds:[[[0,0,25],[0,0,60]],[[0,0,15],[0,0,85]],[[0,5,30],[0,0,70],[-220,100,50]],[[0,0,20],[0,0,50],[0,0,88]],[[0,10,30],[0,0,92]]]}
};

function moodPalettes(mood,base){
  const out=[];const sets=SETS_BY_MOOD[MOODS.indexOf(mood)];
  const[uL,uC,uH]=base.oklch;
  // --- templates: shift each classic set so the colour nearest the user colour becomes the user colour
  const scored=[];
  for(const s of sets){
    let ai=0,ad=1e9;s.hexes.forEach((hx,i)=>{const d=labDist(hx,base.hex);if(d<ad){ad=d;ai=i;}});
    scored.push({s,ai,ad});
  }
  scored.sort((a,b)=>a.ad-b.ad);
  for(const{s,ai,ad}of scored){
    const a=hexToOklch(s.hexes[ai]);
    const dL=uL-a[0],dh=uH-a[2],cr=a[1]>.02?clamp(uC/a[1],.35,2.5):1;
    const cols=s.hexes.map((hx,i)=>{
      if(i===ai)return base.hex;
      const[L,C,H]=hexToOklch(hx);
      const chroma=C<.02?C:clamp(C*cr,0,.37);
      const hue=C<.02?H:H+dh;
      return oklchToHex(clamp(L+dL*.8,.06,.97),chroma,hue);
    });
    out.push(palObj(mood,cols,ai,`from classic set #${s.id}`,`template #${s.id}`));
  }
  const templates=dedupe(out,14);
  // --- generative rules
  const rule=MOOD_RULES[mood];const gen=[];const R=rng(hashStr(mood+base.hex));
  const[H,S,L]=base.hsl;
  rule.seeds.forEach((seed,i)=>{
    const cols=seed.map(([dh,s,l])=>hsl(rule.h+dh+(R()-.5)*10,clamp(s+(R()-.5)*8,0,100),clamp(l+(R()-.5)*6,3,98)));
    const pos=i%2?cols.length:0;cols.splice(pos,0,base.hex);
    gen.push(palObj(mood,cols,pos,'mood rule',`rule ${i+1}`));
    // a second variant that pulls partners toward the user's hue family
    const cols2=seed.map(([dh,s,l])=>hsl(H+dh*.5+(R()-.5)*10,clamp(s*.9+(R()-.5)*8,0,100),clamp(l+(R()-.5)*6,3,98)));
    cols2.splice(0,0,base.hex);
    gen.push(palObj(mood,cols2,0,'mood rule, hue-shifted',`rule ${i+1}b`));
  });
  // interleave template-based and rule-based palettes for a varied browse order
  const mixed=[];const n=Math.max(templates.length,gen.length);for(let i=0;i<n;i++){if(templates[i])mixed.push(templates[i]);if(gen[i])mixed.push(gen[i]);}
  return dedupe(mixed,24);
}

function generate(type,hex){
  const rgb=hexToRgb(hex);const base={hex,rgb,hsl:rgbToHsl(...rgb),oklch:rgbToOklch(...rgb)};
  const list=MOODS.includes(type)?moodPalettes(type,base):theoryPalettes(type,base);
  const res=dedupe(list,24);
  res.forEach((p,i)=>{p.id=type+'|'+hex+'|'+i;p.index=i;});
  return res;
}
