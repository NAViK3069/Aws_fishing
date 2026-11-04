/* =========================================================
   World rendering: skies, seas, dock, boat, weather, events
   ========================================================= */
(function(){
const G = window.GFX;
const S = window.SCENE = {};
const W = 480, H = 270;
const HORIZON = S.HORIZON = 148;
const WATER = S.WATER = 196;
S.W=W; S.H=H;

const THEMES = S.THEMES = {
  dock:  { sky:['#191523','#2a2133','#433041','#64424c','#8e5a56','#bd7c60','#e6a671'], cloud:['#261d2c','#433041','#6e4a52','#a46e64','#d89a78'],
           sun:{x:300,y:132,r:13,c:'#ffe2a8',g:'#f0a46c'}, far:'harbor', farCol:['#6a4652','#432f3e'], sea:['#e8b07a','#c0806a','#8a5a5c','#5a3c4a'],
           under:['#2b2132','#1a1420','#0e0b12'], hi:'#ffd8a8', birds:true, lighthouse:{x:452,y:118} },
  bay:   { sky:['#1b1726','#2c2336','#45324a','#6c4656','#a0605c','#d48a64','#f2b878'], cloud:['#2a2030','#46344a','#7a5058','#b47868','#e8a880'],
           sun:{x:262,y:136,r:15,c:'#fff0c0',g:'#f6a868'}, far:'islands', farCol:['#7a4e5a','#4a3444'], sea:['#f4c088','#d08a6a','#94605e','#5e3e4c'],
           under:['#2c2234','#1a1422','#0d0a12'], hi:'#ffe0b0', birds:true, lighthouse:{x:418,y:122} },
  reef:  { sky:['#2d5b92','#3e72a8','#5690be','#74aecc','#9ccad8','#c8e2e0','#e8f2e6'], cloud:['#9ab8d0','#bcd4e4','#dceaf2','#f6fafa'],
           sun:{x:396,y:34,r:10,c:'#fffbe8',g:'#fff2b8'}, far:'palms', farCol:['#5aa4a4','#2f7070'], sea:['#a8eadc','#66cac4','#34a2ae','#1e7a8e'],
           under:['#1d7280','#0f4a56','#082c36'], hi:'#f4fff8', birds:true, rays:true },
  ruins: { sky:['#26252b','#333238','#433f42','#575250','#6e6860','#887f72','#a09482'], cloud:['#2a282c','#3e3a3a','#544e4a','#6e665c','#887e6e'],
           far:'ruins', farCol:['#5e5952','#3e3b38'], sea:['#958b7a','#746c60','#524c46','#383432'], under:['#25242a','#17161c','#0c0b10'], hi:'#d4cab8', mist:true },
  night: { sky:['#04050c','#080a18','#0e1128','#151a38','#1e2448','#2a3158'], cloud:['#0b0d22','#141836','#20264a','#30386a'],
           moon:{x:338,y:44,r:9,c:'#eef0ff',g:'#7c8cd0'}, stars:true, far:'rocks', farCol:['#1e2444','#0e1126'], sea:['#56609e','#363e7c','#20265a','#13173c'],
           under:['#0a0c1e','#05060f','#020308'], hi:'#cdd8ff', biolum:true },
  storm: { sky:['#080b0b','#0f1514','#17201d','#212d28','#2d3d35','#3b4e42','#4a5e4e'], cloud:['#0a0e0d','#141b18','#1f2a25','#2c3a33','#3c4c42'],
           far:'waves', farCol:['#2a3832','#18221d'], sea:['#566a58','#3c4c40','#28342c','#18201c'], under:['#0c1410','#070d0a','#030605'], hi:'#b4d4ac', rain:true, lightning:true },
};

/* ------------------------------------------------------------------ */
/* Background layers (pre-rendered per theme)                          */
/* ------------------------------------------------------------------ */
const cache = {};
function buildTheme(name){
  const T = THEMES[name]; const L = {};
  // sky
  L.sky = G.canvas(W, HORIZON+2); const sc=L.sky.ctx;
  G.ditherGrad(sc,0,0,W,HORIZON+2,T.sky);
  if(T.stars){ const r=G.rng(7); for(let i=0;i<140;i++){ const x=Math.floor(r()*W), y=Math.floor(r()*HORIZON*0.8); G.px(sc,x,y, r()<0.2?'#ffffff':(r()<0.5?'#8a94c8':'#4a5288')); } }
  const orb = T.sun||T.moon;
  if(orb){ // dithered glow + disc
    const img=sc.getImageData(0,0,W,HORIZON+2), d=img.data, gc=G.rgb(orb.g), cc=G.rgb(orb.c);
    for(let y=0;y<HORIZON+2;y++) for(let x=0;x<W;x++){ const dx=x-orb.x, dy=(y-orb.y)*1.15, dist=Math.sqrt(dx*dx+dy*dy);
      const k=(y*W+x)*4; let pick=null;
      if(dist<orb.r) pick = (T.moon && (G.hash(x,y,3)<0.12 || (dx>2&&dy<-1&&dist>orb.r-3))) ? G.rgb(G.mix(orb.c,orb.g,0.4)) : cc;
      else if(dist<orb.r*3.2){ const t=1-(dist-orb.r)/(orb.r*2.2); if(G.dith(x,y,t*0.8)) pick=[ (d[k]+gc[0])/2,(d[k+1]+gc[1])/2,(d[k+2]+gc[2])/2 ]; }
      if(pick){ d[k]=pick[0]; d[k+1]=pick[1]; d[k+2]=pick[2]; } }
    sc.putImageData(img,0,0);
  }
  // clouds (two scrolling layers, horizontally tileable)
  L.cloudHi = cloudLayer(960, 112, T.cloud, 11, 0.50, 64, 22, false);
  L.cloudLo = cloudLayer(960, 56, T.cloud, 23, 0.47, 40, 12, true);
  // far silhouettes
  L.far = G.canvas(W, HORIZON+2); drawFar(L.far.ctx, T);
  // distant sea surface
  L.sea = G.canvas(W, WATER-HORIZON+6); const zc=L.sea.ctx;
  G.ditherGrad(zc,0,0,W,WATER-HORIZON+6,T.sea,{curve:p=>Math.pow(p,0.8)});
  const r=G.rng(name.length*31);
  for(let i=0;i<220;i++){ const y=Math.floor(Math.pow(r(),1.4)*(WATER-HORIZON)); const len=2+Math.floor(r()*(4+y*0.25)); const x=Math.floor(r()*W);
    const col = r()<0.5? G.mix(T.sea[0],T.hi,0.4) : G.mix(T.sea[Math.min(3,1+Math.floor(y/14))],'#000000',0.18); G.rect(zc,x,y,len,1,col); }
  if(orb){ for(let y=0;y<WATER-HORIZON;y+=2){ const w=Math.max(1,Math.round(orb.r*1.4 - y*0.1 + r()*6)); G.rect(zc, orb.x - w/2 + (r()-0.5)*4, y, w, 1, G.mix(orb.c,T.sea[0],0.25+r()*0.3)); } }
  // underwater
  L.under = G.canvas(W, H-WATER+12); const uc=L.under.ctx; G.ditherGrad(uc,0,0,W,H-WATER+12,T.under,{curve:p=>Math.pow(p,0.7)});
  if(T.rays){ uc.globalAlpha=0.12; for(let i=0;i<9;i++){ const x0=20+i*58; uc.fillStyle='#bff6ff'; uc.beginPath(); uc.moveTo(x0,0); uc.lineTo(x0+12,0); uc.lineTo(x0-26,H); uc.lineTo(x0-44,H); uc.fill(); } uc.globalAlpha=1; }
  return L;
}
function cloudLayer(w,h,cols,seed,th,sx,sy,low){
  const cv=G.canvas(w,h), c=cv.ctx, img=c.createImageData(w,h), d=img.data; const rgbs=cols.map(G.rgb); const n=cols.length;
  const period=w/sx;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    let v=G.fbm(x/sx, y/sy, period, seed, 5);
    const fall = low ? Math.sin((y/h)*Math.PI) : (1-Math.pow(y/h,1.6)*0.9);
    v = v*fall + (low?0.05:0.08);
    if(v<th) continue;
    // shade: darker underside, lighter top
    const v2=G.fbm(x/sx, (y-3)/sy, period, seed, 5)*fall + (low?0.05:0.08);
    let t = Math.min(1, (v-th)/0.22); let lit = (v2 - v) * 6; t = Math.max(0, Math.min(1, 0.35 + lit*0.6 + (1-y/h)*0.25 - t*0.2));
    const fi=t*(n-1); const i0=Math.min(n-2,Math.floor(fi)); const pick=G.dith(x,y,fi-i0)?rgbs[i0+1]:rgbs[i0];
    if(v<th+0.02 && !G.dith(x,y,0.5)) continue;
    const k=(y*w+x)*4; d[k]=pick[0]; d[k+1]=pick[1]; d[k+2]=pick[2]; d[k+3]=255;
  }
  c.putImageData(img,0,0); return cv;
}
function drawFar(c,T){
  const [c1,c2]=T.farCol; const r=G.rng(T.far.length*101+3);
  const base=HORIZON+1;
  const ridge=(col,amp,freq,off,seed)=>{ for(let x=0;x<W;x++){ const h=Math.round(G.fbm(x*freq+off,seed,1e9,seed,4)*amp); G.rect(c,x,base-h,1,h+1,col);} };
  if(T.far==='islands'){
    ridge(c1,20,0.012,0,5); // far hills
    for(let x=0;x<W;x++){ const h=Math.max(0,Math.round(Math.sin((x-60)/90*Math.PI)*16 + G.noise(x*0.08,1)*4)); if(x>60&&x<150) G.rect(c,x,base-h,1,h,c2); }
    for(let x=0;x<W;x++){ const h=Math.max(0,Math.round(Math.sin((x-360)/110*Math.PI)*22 + G.noise(x*0.1,2)*4)); if(x>360&&x<470) G.rect(c,x,base-h,1,h,c2); }
    lighthouse(c, T.lighthouse.x, base-20, c2, T);
  } else if(T.far==='harbor'){
    ridge(c1,26,0.01,3,9);
    // houses on the hill
    let x=168; while(x<470){ const w=8+Math.floor(r()*10), h=8+Math.floor(r()*12); const top=base-6-h-Math.round(G.fbm(x*0.01+3,9,1e9,9,4)*14);
      G.rect(c,x,top,w,base-top,c2); for(let i=0;i<=w/2;i++) G.rect(c,x+i,top-i*0.8,w-i*2,1,c2);
      for(let k=0;k<3;k++) if(r()<0.5) G.rect(c,x+2+Math.floor(r()*(w-4)),top+3+Math.floor(r()*(h-5)),1,2, r()<0.6?'#ffcf7a':'#e88a4a');
      x+=w+Math.floor(r()*4); }
    // crane
    G.rect(c,190,base-46,2,46,c2); G.rect(c,176,base-46,40,2,c2); G.line(c,191,base-46,212,base-40,c2); G.rect(c,212,base-40,1,10,c2);
    lighthouse(c, T.lighthouse.x, base-22, c2, T);
  } else if(T.far==='palms'){
    ridge(c1,10,0.02,7,13);
    const isl=(cx,w,h)=>{ for(let x=cx-w;x<cx+w;x++){ const t=(x-cx)/w; const hh=Math.round(Math.sqrt(Math.max(0,1-t*t))*h); G.rect(c,x,base-hh,1,hh,c2);} };
    isl(110,40,9); isl(390,55,12); isl(250,18,5);
    const palm=(x,y,h)=>{ for(let i=0;i<h;i++) G.rect(c,x+Math.round(Math.sin(i/h*1.2)*3),y-i,2,1,c2); const tx=x+3, ty=y-h;
      [[-7,2],[-5,-2],[0,-3],[5,-2],[7,2],[3,3],[-3,3]].forEach(([dx,dy])=>G.line(c,tx,ty,tx+dx,ty+dy,c2)); };
    palm(100,base-8,16); palm(118,base-7,12); palm(380,base-11,20); palm(402,base-10,15); palm(370,base-9,11);
  } else if(T.far==='ruins'){
    ridge(c1,12,0.015,1,21);
    let x=150; while(x<480){ const w=10+Math.floor(r()*18), h=18+Math.floor(r()*44); const col = r()<0.5?c1:c2;
      for(let i=0;i<w;i++){ const broken = Math.round(G.noise((x+i)*0.4,5)*6*(r()<0.3?1:0.3)); G.rect(c,x+i,base-h+broken,1,h-broken,col); }
      for(let wy=base-h+5; wy<base-4; wy+=5) for(let wx=x+2; wx<x+w-2; wx+=4) if(r()<0.35) G.rect(c,wx,wy,2,2, r()<0.1?'#c8a050':G.mix(col,'#000000',0.35));
      x+=w+Math.floor(r()*10)-2; }
    // leaning tower + shipwreck
    for(let i=0;i<60;i++) G.rect(c,214+Math.round(i*0.25),base-i,9,1,c2);
    for(let x2=20;x2<120;x2++){ const t=(x2-20)/100; const h=Math.round(Math.sin(t*Math.PI)*8 + (t>0.7?(t-0.7)*30:0)); G.rect(c,x2,base-h,1,h,c2); }
    G.rect(c,60,base-30,2,24,c2); G.line(c,61,base-30,40,base-14,c2);
  } else if(T.far==='rocks'){
    ridge(c1,16,0.02,4,31);
    const spire=(x,h,w)=>{ for(let i=0;i<w;i++){ const t=Math.abs(i-w/2)/(w/2); const hh=Math.round(h*(1-t)*(0.7+0.3*G.noise(i*0.7,x))); G.rect(c,x+i,base-hh,1,hh,c2);} };
    spire(40,40,18); spire(70,22,12); spire(190,54,16); spire(330,30,14); spire(420,62,22); spire(455,28,12);
    for(let i=0;i<14;i++) G.px(c,190+Math.floor(r()*16),base-Math.floor(r()*40),'#3a4278');
  } else if(T.far==='waves'){
    for(let x=0;x<W;x++){ const h=Math.round(8+Math.sin(x*0.03)*6+Math.sin(x*0.071+1)*4+G.noise(x*0.1,3)*5); G.rect(c,x,base-h,1,h,c1); }
    for(let x=0;x<W;x++){ const h=Math.round(4+Math.abs(Math.sin(x*0.05+2))*7+G.noise(x*0.2,4)*3); G.rect(c,x,base-h,1,h,c2); if(G.hash(x,1)<0.15) G.px(c,x,base-h,'#6a8070'); }
    // distant maelstrom column
    for(let y=0;y<HORIZON;y++){ const w=Math.round(4+Math.pow(1-y/HORIZON,2)*0+ (y/HORIZON)*14); G.rect(c,330-w/2+Math.sin(y*0.2)*2,y,w,1, G.mix(c1,'#000000',0.2)); }
  }
}
function lighthouse(c,x,y,col,T){
  G.rect(c,x-3,y-28,7,30,col); G.rect(c,x-4,y-30,9,2,col); G.rect(c,x-3,y-36,7,6,col); G.rect(c,x-2,y-38,5,2,col);
  G.rect(c,x-1,y-34,3,3,'#ffe8a0');
  for(let i=0;i<3;i++) G.rect(c,x-3,y-24+i*8,7,2,G.mix(col,'#000000',0.25));
}
S.theme = function(name){ if(!cache[name]) cache[name]=buildTheme(name); return cache[name]; };

/* ------------------------------------------------------------------ */
/* Dock structures (static)                                            */
/* ------------------------------------------------------------------ */
const DECK = S.DECK = 164;
let dockCv=null;
S.HUT = {x0:226,x1:338};
function buildDock(){
  const cv=G.canvas(W,H), c=cv.ctx; const r=G.rng(42);
  const wood=['#5a3a28','#4c3020','#64422c'], dark='#24160e', light='#8a6040';
  // posts (go into water)
  for(let x=158;x<W;x+=30){ G.rect(c,x,DECK+4,5,H-DECK,'#3a2618'); G.rect(c,x,DECK+4,1,H-DECK,'#4e3422'); G.rect(c,x+4,DECK+4,1,H-DECK,dark);
    for(let y=WATER-8;y<WATER+2;y++) if(G.hash(x,y)<0.5) G.px(c,x+1+Math.floor(G.hash(y,x)*3),y,'#3a4a32'); }
  // cross braces
  for(let x=158;x<W-30;x+=30){ G.line(c,x+4,DECK+8,x+30,WATER-6,'#2e1e14'); G.line(c,x+30,DECK+8,x+4,WATER-6,'#2e1e14'); }
  // deck
  G.rect(c,150,DECK-2,W-150,8,'#5e3e2a');
  for(let x=150;x<W;x++){ const p=Math.floor((x-150)/9); G.px(c,x,DECK-2, (x-150)%9===0?dark:light); G.rect(c,x,DECK-1,1,4,(x-150)%9===0?dark:wood[p%3]); }
  G.rect(c,150,DECK+3,W-150,3,'#2e1e14'); G.rect(c,150,DECK+6,W-150,1,dark);
  for(let x=154;x<W;x+=9) G.px(c,x,DECK+1,'#9a8a7a');
  // back rail
  for(let x=152;x<W;x+=22){ G.rect(c,x,DECK-18,3,16,'#4a3020'); G.px(c,x,DECK-18,light); }
  for(let x=152;x<W;x++){ const sag=Math.round(Math.sin(((x-152)%22)/22*Math.PI)*3); G.px(c,x,DECK-15+sag,'#b8a070'); }

  const {x0,x1}=S.HUT, top=98;
  // wall planks
  for(let x=x0;x<x1;x++){ const p=Math.floor((x-x0)/7); for(let y=top;y<DECK-2;y++){ let col=wood[p%3];
      if((x-x0)%7===0) col=dark; else if(y>DECK-14 && G.dith(x,y,(y-(DECK-14))/14)) col='#3a2618';
      if(G.hash(x,y,9)<0.02) col='#3a2416'; G.px(c,x,y,col);} }
  for(let x=x0+3;x<x1;x+=7){ G.px(c,x,top+4,'#a89a88'); G.px(c,x,DECK-8,'#a89a88'); }
  G.rect(c,x0-2,top-6,3,DECK-top+4,'#2e1c12'); G.rect(c,x1-1,top-6,3,DECK-top+4,'#2e1c12');
  // roof (corrugated tin)
  const rx0=x0-10, rx1=x1+10;
  for(let x=rx0;x<rx1;x++){ const t=(x-rx0)/(rx1-rx0); const yT=Math.round(86+t*2), yB=101;
    for(let y=yT;y<yB;y++){ let col=['#7c5c4a','#5e4436','#94705a'][(x)%3];
      const rust=G.fbm(x*0.08,y*0.2,1e9,5,3); if(rust>0.58) col=G.dith(x,y,(rust-0.58)*5)?'#a8582a':'#7a3e1e';
      if(y===yT) col='#b89a80'; G.px(c,x,y,col);} G.px(c,x,yB,'#1a100a'); }
  // awning
  for(let x=rx0+2;x<rx1-2;x++){ const stripe=Math.floor((x-rx0)/6)%2; const sc=Math.floor((x-rx0)%6); const drop=Math.round(Math.sin(sc/6*Math.PI)*2);
    for(let y=102;y<108+drop;y++) G.px(c,x,y, stripe?'#e8d8b8':'#c0383a'); G.px(c,x,108+drop, stripe?'#9a8a70':'#7a1e22'); }
  // window
  const wx0=262, wx1=306, wy0=113, wy1=142;
  G.rect(c,wx0-2,wy0-2,wx1-wx0+4,wy1-wy0+4,'#2a1a10');
  G.ditherGrad(c,wx0,wy0,wx1-wx0,wy1-wy0,['#6a4426','#4a2e1a','#2a1a10']);
  G.sprite(c,G.FROG,G.PAL_FROG,276,122);
  // lamp inside
  G.rect(c,wx1-8,wy0+2,1,4,'#1a100a'); G.rect(c,wx1-10,wy0+6,5,3,'#ffd27a');
  // counter with goods
  G.rect(c,wx0-4,wy1,wx1-wx0+8,4,'#7a5236'); G.rect(c,wx0-4,wy1,wx1-wx0+8,1,'#a8784a'); G.rect(c,wx0-4,wy1+4,wx1-wx0+8,1,dark);
  [['#5ab0d0',2,6],['#d8503a',3,5],['#e8c44a',2,4],['#7ac06a',3,6],['#c8c0b0',4,3]].forEach(([col,w,h],i)=>{ const bx=wx0+2+i*9; G.rect(c,bx,wy1-h,w,h,col); G.px(c,bx,wy1-h,'#ffffff'); G.rect(c,bx,wy1-h-1,w,1,'#2a1a10'); });
  // door
  G.rect(c,312,116,20,DECK-118,'#2e1e14'); for(let x=314;x<330;x+=4) G.rect(c,x,118,3,DECK-120,'#4a3020'); G.rect(c,327,138,2,2,'#e8c44a');
  // life ring
  for(let a=0;a<64;a++){ const ang=a/64*Math.PI*2; const col=(Math.floor(a/8)%2)?'#f2ece0':'#d83a3a';
    for(let rr=4;rr<=6;rr++) G.px(c,240+Math.round(Math.cos(ang)*rr),128+Math.round(Math.sin(ang)*rr),col); }
  // dried fish string
  G.line(c,x0+2,110,x0+24,112,'#b8a070');
  for(let i=0;i<3;i++){ const fx=x0+5+i*7; G.rect(c,fx,111,1,3,'#b8a070'); G.rect(c,fx-1,114,3,6,'#8a7a6a'); G.px(c,fx,120,'#6a5a4a'); G.px(c,fx-1,121,'#6a5a4a'); G.px(c,fx+1,121,'#6a5a4a'); }
  // sign board + ropes
  G.line(c,256,82,252,96,'#b8a070'); G.line(c,312,82,316,96,'#b8a070');
  G.rect(c,246,56,76,28,'#1e140e'); G.rect(c,247,57,74,26,'#3a2618'); G.rect(c,249,59,70,22,'#160e0a');
  for(let i=0;i<4;i++){ G.px(c,248+i*24,57,'#8a7a6a'); }
  // bunting
  for(let x=rx0;x<rx1;x++){ const t=(x-rx0)/(rx1-rx0); const y=Math.round(80+Math.sin(t*Math.PI)*5); G.px(c,x,y,'#3a2a20');
    if((x-rx0)%8===2){ const col=['#e86a8a','#f2a03a','#7ac0a0','#e8d860'][Math.floor((x-rx0)/8)%4]; for(let k=0;k<4;k++) G.rect(c,x+Math.floor(k/2),y+1+k,3-k,1,col); } }
  // barrel & crates & bollard
  const barrel=(x,y)=>{ for(let i=0;i<14;i++){ const b=Math.round(Math.sin(i/13*Math.PI)*2); G.rect(c,x-b+1,y+i,12+b*2-2,1, i===2||i===11?'#2a1a10':(i<7?'#7a5232':'#6a4428')); } G.rect(c,x+1,y,10,1,'#9a6a40'); };
  barrel(342,DECK-16); barrel(354,DECK-14);
  const crate=(x,y,s)=>{ G.rect(c,x,y,s,s,'#8a6a3a'); G.rect(c,x,y,s,1,'#b08a52'); G.rect(c,x,y+s-1,s,1,'#4a3418'); G.rect(c,x,y,1,s,'#4a3418'); G.rect(c,x+s-1,y,1,s,'#4a3418'); G.line(c,x+1,y+1,x+s-2,y+s-2,'#5a4220'); };
  crate(196,DECK-14,12); crate(208,DECK-12,10); crate(200,DECK-24,10);
  G.rect(c,218,DECK-8,6,7,'#2a2a30'); G.rect(c,217,DECK-9,8,2,'#4a4a52');
  // lamp post
  G.rect(c,186,108,2,DECK-110,'#1e1612'); G.rect(c,183,104,8,2,'#1e1612'); G.rect(c,184,106,6,6,'#2a2018'); G.rect(c,185,107,4,4,'#ffd27a');
  // hanging buoys under deck
  [[176,'#d83a3a'],[268,'#e8e0d0'],[362,'#d83a3a'],[422,'#e8c44a']].forEach(([bx,col])=>{ G.rect(c,bx,DECK+6,1,8,'#b8a070'); G.rect(c,bx-2,DECK+14,5,6,col); G.rect(c,bx-2,DECK+14,1,6,G.mix(col,'#000000',0.4)); G.rect(c,bx-2,DECK+16,5,1,'#f2ece0'); });
  return cv;
}

/* ------------------------------------------------------------------ */
/* Boat + cat                                                          */
/* ------------------------------------------------------------------ */
const BW = 78;
let boatCv=null;
function buildBoat(){
  const cv=G.canvas(BW+2,40), c=cv.ctx; const y=20;
  const top=i=>{ const u=i/(BW-1); return y - (u>0.8?Math.pow((u-0.8)/0.2,2)*7:0) - (u<0.08?(0.08-u)/0.08*2:0); };
  const bot=i=>{ const u=i/(BW-1); return y + 15*Math.sqrt(Math.max(0,1-Math.pow((u-0.46)/0.54,4))); };
  for(let i=0;i<BW;i++){ const t=Math.round(top(i)), b=Math.round(bot(i));
    for(let yy=t;yy<=b;yy++){ const k=yy-t; let col;
      if(k<2) col = k===0?'#c8945a':'#a0703e';
      else { const band=Math.floor((yy-y)/4); col = ((yy-y)%4===3)?'#3a2214':(band%2?'#6a4024':'#7a4c2a'); if(yy>y+9) col=G.mix(col,'#2a3a30',0.35); }
      if(G.hash(i,yy,4)<0.03) col='#4a2a18'; G.px(c,i+1,yy,col); }
    G.px(c,i+1,t-1,'#1a100a'); G.px(c,i+1,b+1,'#1a100a'); }
  for(let i=0;i<BW;i+=9){ G.px(c,i+3,Math.round(top(i))+3,'#c8b8a0'); }
  // ends outline
  G.rect(c,0,Math.round(top(0))-1,1,Math.round(bot(0)-top(0))+2,'#1a100a');
  // ribs
  for(let i=6;i<BW-6;i+=14) G.rect(c,i+1,Math.round(top(i))+2,1,6,'#4a2a18');
  return cv;
}
S.boatTop = (i)=>{ const u=i/(BW-1); return - (u>0.8?Math.pow((u-0.8)/0.2,2)*7:0); };

function drawCat(c,x,y,blink){
  G.sprite(c,G.CAT,G.PAL_CAT,x,y);
  G.sprite(c,G.CAT_HAT,G.PAL_CAT,x,y-2);
  if(blink){ G.rect(c,x+5,y+5,2,2,'#9a98a8'); G.rect(c,x+11,y+5,2,2,'#9a98a8'); G.rect(c,x+5,y+6,2,1,'#14101a'); G.rect(c,x+11,y+6,2,1,'#14101a'); }
}
S.drawCat = drawCat;

/* ------------------------------------------------------------------ */
/* Per-frame world render                                              */
/* ------------------------------------------------------------------ */
S.waveAmp = 1;
S.waveY = function(x,t){ return WATER + Math.round(Math.sin(x*0.045+t*1.3)*1.4*S.waveAmp + Math.sin(x*0.11-t*2.2)*0.8 + (S.waveAmp>1.5?Math.sin(x*0.02+t*0.9)*2.4:0)); };

const particles = S.particles = [];
S.addP = function(p){ particles.push(Object.assign({life:1,max:1,vx:0,vy:0,g:0,col:'#fff',size:1},p)); };
const shadows=[]; let shadowTheme=null;

S.render = function(c, st, t, dt){
  const T = THEMES[st.theme]; const L = S.theme(st.theme);
  const shake = st.shake>0 ? Math.round((Math.random()-0.5)*st.shake*2) : 0;
  c.save(); c.translate(shake, Math.round((Math.random()-0.5)*(st.shake||0)));
  // sky + clouds + far
  c.drawImage(L.sky,0,0);
  const o1=Math.floor(t*2.5)%960, o2=Math.floor(t*6)%960;
  c.drawImage(L.cloudHi,-o1,0); c.drawImage(L.cloudHi,960-o1,0);
  c.drawImage(L.far,0,0);
  if(T.lighthouse){ const lx=T.lighthouse.x, ly=HORIZON+1-20-34; const a=Math.sin(t*0.9); c.globalAlpha=0.18*Math.max(0,Math.abs(a));
    c.fillStyle='#ffe8a0'; c.beginPath(); c.moveTo(lx,ly); c.lineTo(lx+a*120,ly-10); c.lineTo(lx+a*120,ly+10); c.fill(); c.globalAlpha=1;
    if(Math.sin(t*1.8)>0.6) G.rect(c,lx-2,ly-1,5,3,'#fff6c8'); }
  c.drawImage(L.cloudLo,-o2,HORIZON-52); c.drawImage(L.cloudLo,960-o2,HORIZON-52);
  // birds
  if(T.birds){ for(let i=0;i<4;i++){ const bx=((t*(10+i*3)+i*137)%600)-60, by=40+i*14+Math.sin(t*0.7+i)*6; const f=Math.floor(t*4+i)%2;
      const col=G.mix(T.sky[1],'#000000',0.4); if(f){ G.px(c,bx,by,col); G.px(c,bx-1,by-1,col); G.px(c,bx+1,by-1,col); G.px(c,bx-2,by-1,col); G.px(c,bx+2,by-1,col);} else { G.px(c,bx,by,col); G.px(c,bx-1,by,col); G.px(c,bx+1,by,col); G.px(c,bx-2,by+1,col); G.px(c,bx+2,by+1,col);} } }
  // distant sea + glitter
  c.drawImage(L.sea,0,HORIZON);
  for(let i=0;i<40;i++){ const sx=Math.floor(G.hash(i,Math.floor(t*3+i*0.37),1)*W), sy=HORIZON+2+Math.floor(G.hash(i,7)*(WATER-HORIZON-4)); if(G.hash(i,Math.floor(t*5))<0.5) G.px(c,sx,sy,T.hi); }
  c.drawImage(L.under,0,WATER+4,W,H-WATER-4,0,WATER+4,W,H-WATER-4);

  if(T.mist){ c.globalAlpha=0.16; for(let i=0;i<3;i++){ const y=HORIZON-20+i*14, ox=(t*(4+i*2))%480; c.fillStyle='#b8b0a0'; c.fillRect(-ox,y,480,6); c.fillRect(480-ox,y,480,6);} c.globalAlpha=1; }
  if(st.theme==='dock'){ if(!dockCv) dockCv=buildDock(); c.drawImage(dockCv,0,0); drawDockAnim(c,t); }

  // event: kraken tentacles behind boat
  if(st.event && st.event.id==='kraken') drawKraken(c,st,t,true);
  // boat
  drawBoatGroup(c,st,t);
  // water cross-section
  c.globalAlpha=0.9;
  for(let x=0;x<W;x++){ const wy=S.waveY(x,t); c.drawImage(L.under,x,0,1,H-wy,x,wy,1,H-wy); }
  c.globalAlpha=1;
  for(let x=0;x<W;x++){ const wy=S.waveY(x,t); G.px(c,x,wy,T.hi); if(G.hash(x,Math.floor(t*2))<0.08) G.px(c,x,wy-1,T.hi); G.px(c,x,wy+1,G.mix(T.hi,T.under[0],0.55)); }
  // underwater
  if(st.theme==='dock'){ c.globalAlpha=0.35; for(let x=158;x<W;x+=30){ c.fillStyle='#000000'; c.fillRect(x,WATER+2,5,H-WATER);} c.globalAlpha=1; }
  drawShadows(c,st,t,dt,T);
  if(st.fishing) drawUnderLine(c,st,t,T);
  if(T.biolum){ for(let i=0;i<26;i++){ const bx=(G.hash(i,3)*W + Math.sin(t*0.3+i)*10)|0, by=(WATER+8+G.hash(i,5)*(H-WATER-10) + Math.sin(t*0.5+i*2)*4)|0; if(Math.sin(t*2+i*1.7)>0.2) G.px(c,bx,by,i%3?'#5af0d0':'#8ab0ff'); } }
  // bubbles
  if(Math.random()<dt*2) S.addP({x:Math.random()*W, y:H, vy:-12-Math.random()*10, life:4, max:4, col:G.mix(T.hi,T.under[0],0.5), type:'bubble'});
  if(st.event && st.event.id==='kraken') drawKraken(c,st,t,false);
  if(st.event && st.event.id==='shark') drawShark(c,st,t);
  if(st.event && st.event.id==='jelly') drawJelly(c,st,t);
  // particles
  for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.life-=dt; if(p.life<=0){particles.splice(i,1);continue;}
    p.vy+=p.g*dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
    if(p.type==='bubble'){ p.x+=Math.sin(t*3+p.y*0.1)*0.2; if(p.y<S.waveY(p.x|0,t)+2){particles.splice(i,1);continue;} }
    c.globalAlpha = p.fade? Math.max(0,p.life/p.max) : 1; G.rect(c,p.x,p.y,p.size,p.size,p.col); c.globalAlpha=1; }
  // weather overlays
  const raining = T.rain || (st.event && st.event.id==='storm');
  if(raining){ c.fillStyle='rgba(12,18,24,0.28)'; c.fillRect(0,0,W,H);
    c.fillStyle= st.theme==='storm' ? '#8aa49a' : '#a8b8c8'; c.globalAlpha=0.55;
    for(let i=0;i<120;i++){ const rx=(G.hash(i,1)*W*1.2 + t*-90 + i*13)%(W*1.2), ry=((G.hash(i,2)*H) + t*320)%H; const x=((rx%W)+W)%W; c.fillRect(x|0,ry|0,1,5); c.fillRect((x-1)|0,(ry+5)|0,1,2);} c.globalAlpha=1; }
  if(st.event && st.event.id==='cold'){ c.fillStyle='rgba(170,200,240,0.16)'; c.fillRect(0,0,W,H);
    c.fillStyle='#eef4ff'; for(let i=0;i<70;i++){ const x=((G.hash(i,9)*W + Math.sin(t+i)*12 - t*8)%W+W)%W, y=(G.hash(i,8)*H + t*(14+G.hash(i,4)*10))%H; c.fillRect(x|0,y|0,1,1);}
    c.globalAlpha=0.12; for(let i=0;i<4;i++){ const y=HORIZON-10+i*22, ox=(t*(6+i*3))%480; c.fillStyle='#dfeaff'; c.fillRect(-ox,y,480,10); c.fillRect(480-ox,y,480,10);} c.globalAlpha=1; }
  if(st.flash>0){ c.fillStyle=`rgba(235,245,255,${Math.min(0.85,st.flash)})`; c.fillRect(0,0,W,H); }
  if(st.redFlash>0){ c.fillStyle=`rgba(200,20,30,${Math.min(0.5,st.redFlash)})`; c.fillRect(0,0,W,H); }
  c.restore();
};

function drawDockAnim(c,t){
  // neon sign
  const on = !(Math.sin(t*13)>0.93 && Math.sin(t*3.1)>0.4);
  const tx=262, ty=63;
  if(on){ c.globalAlpha=0.22; G.text(c,'SHOP',tx-1,ty,'#ffe066',2); G.text(c,'SHOP',tx+1,ty,'#ffe066',2); G.text(c,'SHOP',tx,ty-1,'#ffe066',2); G.text(c,'SHOP',tx,ty+1,'#ffe066',2); c.globalAlpha=1; }
  G.text(c,'SHOP',tx,ty, on?'#fff08a':'#6a5a2a',2);
  if(on){ G.text(c,'SHOP',tx,ty,'#fff08a',2); c.fillStyle='#fffbe0'; for(let i=0;i<4;i++) c.fillRect(tx+i*12+1,ty+1,1,1); }
  // lamp glows
  const glow=(x,y,r,col,a)=>{ c.globalAlpha=a; c.fillStyle=col; for(let k=r;k>0;k-=2){ c.globalAlpha=a*(1-k/r)*0.6; c.beginPath(); c.arc(x,y,k,0,7); c.fill(); } c.globalAlpha=1; };
  const fl=0.85+Math.sin(t*7)*0.05+Math.sin(t*17)*0.04;
  glow(187,109,16,'#ffc870',0.5*fl); glow(298,120,14,'#ffc870',0.35*fl);
  // pipe smoke
  if(Math.random()<0.06) S.addP({x:294, y:131, vx:-2+Math.random()*2, vy:-6, life:2.4, max:2.4, col:'#cfc8bc', fade:true});
}

function drawBoatGroup(c,st,t){
  if(!boatCv) boatCv=buildBoat();
  const bx = st.theme==='dock' ? 170 : 296;
  const bob = Math.round(Math.sin(t*1.6)*1.2*S.waveAmp);
  const by = WATER - 26 + bob; // canvas top
  const deckY = by+20;
  st.boatPos = {x:bx, y:deckY};
  // mast + lantern + flag at stern
  G.rect(c,bx+7,deckY-38,2,38,'#3a2416'); G.px(c,bx+7,deckY-38,'#6a4a2a');
  const fw=Math.floor(t*5)%3; const flagRows=[[6,5,4,3,2],[6,6,5,3,2],[5,5,4,4,2]][fw];
  flagRows.forEach((w,i)=>G.rect(c,bx+9,deckY-38+i,w,1, i%2?'#e8e0d0':'#d83a3a'));
  G.rect(c,bx+9,deckY-30,6,1,'#3a2416'); G.rect(c,bx+13,deckY-29,1,2,'#3a2416');
  G.rect(c,bx+11,deckY-27,5,6,'#2a1a10'); G.rect(c,bx+12,deckY-26,3,4,'#ffd27a');
  c.globalAlpha=0.18+Math.sin(t*6)*0.03; c.fillStyle='#ffc870'; c.beginPath(); c.arc(bx+13,deckY-24,9,0,7); c.fill(); c.globalAlpha=1;
  // cargo
  G.rect(c,bx+14,deckY-8,11,8,'#8a6a3a'); G.rect(c,bx+14,deckY-8,11,1,'#b08a52'); G.rect(c,bx+14,deckY-1,11,1,'#4a3418'); G.line(c,bx+15,deckY-7,bx+24,deckY-2,'#5a4220');
  G.rect(c,bx+26,deckY-6,7,6,'#5a6a7a'); G.rect(c,bx+26,deckY-6,7,1,'#8a9aaa'); // bucket
  if(st.inv && st.inv.pieces.length){ G.px(c,bx+28,deckY-7,'#9ab0c8'); G.px(c,bx+30,deckY-8,'#e8a040'); }
  for(let i=0;i<4;i++) G.rect(c,bx+3+i,deckY-3+(i%2),1,2,'#b8a070'); // rope
  // cat
  const cx=bx+40, cy=deckY-19;
  const blink = (t%4)<0.12;
  drawCat(c,cx,cy,blink);
  // rod
  const paw={x:cx+15,y:cy+13};
  let ang = st.rodAng!=null ? st.rodAng : -0.85;
  const len=34; const tip={x:paw.x+Math.cos(ang)*len, y:paw.y+Math.sin(ang)*len};
  if(st.rodBend){ tip.y += st.rodBend; }
  st.rodTip=tip;
  G.line(c,paw.x,paw.y+1,tip.x,tip.y+1,'#2a1a10'); G.line(c,paw.x,paw.y,tip.x,tip.y,'#a8743a');
  G.rect(c,paw.x-1,paw.y-1,3,3,'#9aa0aa'); G.px(c,paw.x,paw.y,'#5a606a');
  // hull (covers feet)
  c.drawImage(boatCv,bx-1,by);
  // line above water
  if(st.fishing){ const f=st.fishing;
    if(f.bob){ const b=f.bob;
      if(b.air){ G.px(c,b.x,b.y,'#f2ece0'); lineSag(c,tip,b,2); }
      else { const wy=S.waveY(b.x|0,t)+(f.biteDip||0); b.y=wy; lineSag(c,tip,{x:b.x,y:wy-2},5);
        G.rect(c,b.x-1,wy-4,3,2,'#e23a3a'); G.rect(c,b.x-1,wy-2,3,2,'#f2ece0'); G.px(c,b.x,wy-5,'#1a1418'); }
    } }
  // dock: rod upright idle line hanging
}
function lineSag(c,a,b,sag){ c.fillStyle='rgba(232,226,210,0.75)'; let px=null,py=null; for(let i=0;i<=24;i++){ const k=i/24; const x=a.x+(b.x-a.x)*k, y=a.y+(b.y-a.y)*k+Math.sin(k*Math.PI)*sag; if(px!==null) G.line(c,px,py,x,y,'rgba(232,226,210,0.75)'); px=x;py=y; } }
function drawUnderLine(c,st,t,T){ const f=st.fishing; if(!f.bob||f.bob.air) return; const b=f.bob; const wy=S.waveY(b.x|0,t)+(f.biteDip||0);
  const hy=Math.min(H-8, wy+26+Math.sin(t*1.5)*2); c.globalAlpha=0.5; G.line(c,b.x,wy,b.x+Math.sin(t)*1,hy,'#c8c0b0'); c.globalAlpha=1;
  G.px(c,b.x,hy,'#c8c0b0'); G.px(c,b.x+1,hy+1,'#c8c0b0'); G.px(c,b.x+1,hy+2,'#c8c0b0'); G.px(c,b.x,hy+3,'#c8c0b0'); G.px(c,b.x-1,hy+2,'#c8c0b0');
  f.hook={x:b.x,y:hy}; }

/* fish shadows swimming below */
function drawShadows(c,st,t,dt,T){
  if(shadowTheme!==st.theme){ shadows.length=0; shadowTheme=st.theme; const pool=DATA.FISH.filter(f=>f.z[0]<=st.zoneIdx&&f.z[1]>=st.zoneIdx);
    for(let i=0;i<6;i++){ const f=pool[Math.floor(Math.random()*pool.length)]||DATA.FISH[0]; shadows.push({id:f.id,x:Math.random()*W,y:WATER+18+Math.random()*(H-WATER-40),v:(6+Math.random()*10)*(Math.random()<0.5?-1:1)}); } }
  const col=G.mix(T.under[2],'#000000',0.3);
  for(const s of shadows){ s.x+=s.v*dt; if(s.x<-80) s.x=W+40; if(s.x>W+80) s.x=-60; const img=G.fishTint(s.id,col);
    c.globalAlpha=0.55; const yy=Math.round(s.y+Math.sin(t+s.x*0.02)*2);
    if(s.v<0){ c.save(); c.translate(Math.round(s.x)+img.width,yy); c.scale(-1,1); c.drawImage(img,0,0); c.restore(); } else c.drawImage(img,Math.round(s.x),yy);
    c.globalAlpha=1; }
  // approaching fish to hook
  const f=st.fishing; if(f && f.approach && f.hook){ const a=f.approach; const img=G.fishTint(a.id,col); a.x += (f.hook.x - img.width - a.x)*Math.min(1,dt*1.5); a.y += (f.hook.y - img.height/2 - a.y)*Math.min(1,dt*1.5);
    c.globalAlpha=0.75; c.drawImage(img,Math.round(a.x+(f.state==='bite'?Math.sin(t*40)*1.5:0)),Math.round(a.y)); c.globalAlpha=1; }
}

/* ------------------ event creatures ------------------ */
function drawShark(c,st,t){ const e=st.event; const p=1-e.left/e.dur; const bp=st.boatPos||{x:296,y:WATER-6};
  if(e.left<1.0) return;
  const r=95-p*55; const ang=t*1.4; const fx=Math.round(bp.x+40+Math.cos(ang)*r); const wy=S.waveY(fx,t); const dir=-Math.sin(ang)>0?1:-1;
  const H2=14; for(let i=0;i<H2;i++){ const w=Math.max(1,Math.round((H2-i)*0.85)); const lean=Math.round(i*0.45)*dir; const x0=dir>0?fx+lean-Math.round(w*0.3):fx+lean-Math.round(w*0.7);
    G.rect(c,x0,wy-i,w,1,'#3c4854'); G.px(c,dir>0?x0:x0+w-1,wy-i,'#6a7884'); G.px(c,dir>0?x0+w-1:x0,wy-i,'#1a2028'); }
  c.globalAlpha=0.35; G.rect(c,fx-18,wy+3,36,6,'#05080a'); G.rect(c,fx-12,wy+9,22,3,'#05080a'); c.globalAlpha=1;
  if(Math.random()<0.5) S.addP({x:fx-dir*6,y:wy,vx:-dir*rand2(10,30),vy:-12,g:70,life:0.45,max:0.45,col:'#e8f0f0'}); }
function rand2(a,b){ return a+Math.random()*(b-a); }
function drawJelly(c,st,t){ const bp=st.boatPos||{x:296,y:WATER-6}; for(let i=0;i<7;i++){ const x=bp.x-40+i*28+Math.sin(t+i)*6, y=WATER+20+((i*23+t*-8)%50+50)%50;
    const pulse=Math.sin(t*4+i)>0; const col=i%2?'#7af0ff':'#ff7ad8';
    c.globalAlpha=0.85; G.rect(c,x-3,y,7,3,col); G.rect(c,x-2,y-1,5,1,col); if(pulse){G.rect(c,x-4,y+1,9,2,col);} c.globalAlpha=0.55;
    for(let k=0;k<3;k++) for(let j=0;j<6;j++) G.px(c,x-2+k*2+Math.round(Math.sin(t*3+j+k)),y+3+j,col); c.globalAlpha=1; } }
function drawKraken(c,st,t,back){ const e=st.event; const p=Math.min(1,(1-e.left/e.dur)*1.4); const bp=st.boatPos||{x:296,y:WATER-6};
  const tents = back? [[-26,0.8],[96,1.1]] : [[-8,1],[82,0.9]];
  tents.forEach(([dx,sc],k)=>{ const baseX=bp.x+dx, h=Math.round((20+40*p)*sc);
    for(let i=0;i<h;i++){ const tt=i/h; const x=baseX+Math.sin(tt*4+t*2+k)*6*tt*(dx<40?-1:1); const w=Math.max(2,Math.round((1-tt)*11)); const y=WATER+10-i;
      G.rect(c,Math.round(x-w/2),y,w,1, back?'#3a1840':'#6a2a6a'); G.px(c,Math.round(x-w/2),y,'#1a0a1e'); G.px(c,Math.round(x+w/2)-1,y,back?'#5a2a62':'#9a4a9a'); if(i%4===0&&w>3){ G.px(c,Math.round(x)-1,y,'#f0a0e0'); G.px(c,Math.round(x)+1,y,'#f0a0e0'); } } }); }

/* ------------------ transitions ------------------ */
const fadePats=[];
S.fade = function(c,v){ if(v<=0) return; if(!fadePats.length){ for(let l=0;l<=16;l++){ const p=G.canvas(4,4); for(let y=0;y<4;y++) for(let x=0;x<4;x++) if(G.bayer(x,y)<l/16) G.px(p.ctx,x,y,'#07060a'); fadePats.push(c.createPattern(p,'repeat')); } }
  c.fillStyle=fadePats[Math.max(0,Math.min(16,Math.round(v*16)))]; c.fillRect(0,0,W,H); };
})();
