/* =========================================================
   Pixel-art toolkit + procedural sprites
   ========================================================= */
(function(){
const G = window.GFX = {};

G.canvas = function(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.imageSmoothingEnabled=false; c.ctx=x; return c; };

const BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
G.bayer = (x,y)=> (BAYER[((y&3)<<2)|(x&3)]+0.5)/16;
G.dith = (x,y,t)=> G.bayer(x,y) < t;

G.rgb = function(h){ h=h.replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join(''); const n=parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; };
G.hex = (r,g,b)=> '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
G.mix = function(a,b,t){ const A=G.rgb(a),B=G.rgb(b); return G.hex(A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t, A[2]+(B[2]-A[2])*t); };

G.rect = (c,x,y,w,h,col)=>{ c.fillStyle=col; c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); };
G.px = (c,x,y,col)=>{ c.fillStyle=col; c.fillRect(Math.round(x),Math.round(y),1,1); };
G.line = function(c,x0,y0,x1,y1,col){
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  c.fillStyle=col; const dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1; let e=dx+dy;
  for(let i=0;i<2000;i++){ c.fillRect(x0,y0,1,1); if(x0===x1&&y0===y1) break; const e2=2*e; if(e2>=dy){e+=dy;x0+=sx;} if(e2<=dx){e+=dx;y0+=sy;} }
};
G.sprite = function(c,rows,pal,x,y,flip){
  for(let r=0;r<rows.length;r++){ const row=rows[r];
    for(let i=0;i<row.length;i++){ const ch=row[i]; if(ch==='.'||ch===' ') continue; const col=pal[ch]; if(!col) continue;
      c.fillStyle=col; c.fillRect(Math.round(x)+(flip?row.length-1-i:i), Math.round(y)+r, 1,1); } }
};
G.spriteCanvas = function(rows,pal,scale){ scale=scale||1; const w=rows[0].length,h=rows.length; const cv=G.canvas(w*scale,h*scale);
  if(scale===1){ G.sprite(cv.ctx,rows,pal,0,0); return cv; }
  const t=G.canvas(w,h); G.sprite(t.ctx,rows,pal,0,0); cv.ctx.drawImage(t,0,0,w*scale,h*scale); return cv; };

/* gradient with ordered dithering between palette stops; stops = [{p,c}] or array of colours (even) */
G.ditherGrad = function(ctx,x,y,w,h,cols,opt){
  opt=opt||{}; const n=cols.length-1;
  const img=ctx.getImageData(x,y,w,h), d=img.data; const rgbs=cols.map(G.rgb);
  for(let j=0;j<h;j++){
    let p = j/(h-1||1); if(opt.curve) p=opt.curve(p);
    const fp=p*n, i0=Math.min(n-1,Math.floor(fp)), f=fp-i0;
    for(let i=0;i<w;i++){
      const pick = G.dith(i+x,j+y,f) ? rgbs[i0+1] : rgbs[i0];
      const k=(j*w+i)*4; d[k]=pick[0]; d[k+1]=pick[1]; d[k+2]=pick[2]; d[k+3]=255;
    }
  }
  ctx.putImageData(img,x,y);
};

/* --------- seeded random + periodic value noise --------- */
G.rng = function(seed){ let s=seed>>>0||1; return ()=>{ s^=s<<13; s>>>=0; s^=s>>17; s^=s<<5; s>>>=0; return s/4294967296; }; };
G.hash = (x,y,s)=>{ let h=(x*374761393 + y*668265263 + (s||0)*2147483647)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967296; };
G.noise = function(x,y,period,seed){
  const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
  const P=period||1e9; const w=(a)=>((a%P)+P)%P;
  const s=(t)=>t*t*(3-2*t);
  const a=G.hash(w(xi),yi,seed), b=G.hash(w(xi+1),yi,seed), c=G.hash(w(xi),yi+1,seed), d=G.hash(w(xi+1),yi+1,seed);
  const u=s(xf), v=s(yf); return a+(b-a)*u + (c-a)*v + (a-b-c+d)*u*v;
};
G.fbm = function(x,y,period,seed,oct){ let sum=0,amp=0.5,f=1,norm=0; for(let o=0;o<(oct||4);o++){ sum+=amp*G.noise(x*f,y*f,period*f,seed+o*17); norm+=amp; amp*=0.5; f*=2; } return sum/norm; };

/* --------- tiny bitmap font for in-world signs (5x7) --------- */
const FONT = {
  S:['01111','10000','10000','01110','00001','00001','11110'],
  H:['10001','10001','10001','11111','10001','10001','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'],
  P:['11110','10001','10001','11110','10000','10000','10000'],
  B:['11110','10001','10001','11110','10001','10001','11110'],
  A:['01110','10001','10001','11111','10001','10001','10001'],
  I:['11111','00100','00100','00100','00100','00100','11111'],
  T:['11111','00100','00100','00100','00100','00100','00100'],
  W:['10001','10001','10001','10101','10101','10101','01010'],
  F:['11111','10000','10000','11110','10000','10000','10000'],
  N:['10001','11001','10101','10011','10001','10001','10001'],
  E:['11111','10000','10000','11110','10000','10000','11111'],
  R:['11110','10001','10001','11110','10100','10010','10001'],
  K:['10001','10010','10100','11000','10100','10010','10001'],
};
G.text = function(c,str,x,y,col,scale){ scale=scale||1; c.fillStyle=col; let cx=x;
  for(const ch of str){ const g=FONT[ch]; if(g){ for(let r=0;r<7;r++) for(let i=0;i<5;i++) if(g[r][i]==='1') c.fillRect(cx+i*scale,y+r*scale,scale,scale); } cx+=6*scale; } };
G.textWidth = (str,scale)=> str.length*6*(scale||1)-(scale||1);

/* ======================================================
   SPRITES (hand-authored)
   ====================================================== */
G.PAL_CAT = { k:'#1a1420', g:'#9a98a8', G:'#6c6a7c', w:'#f2ead8', e:'#14101a', p:'#e88a96', y:'#f0b83a', Y:'#b8782a', o:'#ffdd70', b:'#3a2a2a', h:'#e8a830', H:'#a86c1e', s:'#cfc8b8' };
G.CAT = [
  "....kk.....kk....",
  "...kGgk...kgGk...",
  "...kgpgkkkgpgk...",
  "..kggggggggggggk.",
  "..kggwwgggggwwgk.",
  ".kgggwekgggwekgk.",
  ".kgggwwggpggwwgk.",
  ".kgggggwwwwwggk..",
  "..kgggwkwwkwgk...",
  "...kkgggggggkk...",
  "..kyykkkkkkkyyk..",
  ".kyyyyyyoyyyyyyk.",
  ".kyYyyyyyyyyyYyk.",
  "kyyYyyyyoyyyyYyyk",
  "kgkYyyyyyyyyyYkgk",
  ".kkYyyyyoyyyyYkk.",
  "..kYYYYYYYYYYYk..",
  "..kbbbbk.kbbbbk..",
  "..kkkkk...kkkkk..",
];
G.CAT_HAT = [ // sou'wester hat overlay (sits on head, ears poke through)
  ".................",
  ".................",
  ".......kkk.......",
  "....kkkhhhkkk....",
  "..kkhhhhhhhhhkk..",
  "kkHHHHHHHHHHHHHkk",
];

G.PAL_FROG = { k:'#14120e', g:'#6a9a4a', G:'#456e34', l:'#b8d088', w:'#f4f0dc', e:'#14120e', h:'#3a5a7a', H:'#243a52', p:'#6a3a22', r:'#e85a3a', s:'#d8d4c8' };
G.FROG = [
  "......kkkkkk......",
  ".....khhhhhhk.....",
  "....khhhhhhhhk....",
  "..kkHHHHHHHHHHkk..",
  "..kwwkggggggkwwk..",
  ".kwweKgggggggKewwk".replace(/K/g,'k'),
  ".kgwwggggggggwwgk.",
  "kgggggggggggggggk.",
  "kgGggggggggggGggk.",
  "kgllllllllllllgkpk",
  "kgkkkkkkkkkkkkgkpk",
  ".kgllllllllllgk.k.",
  "..kggggggggggk....",
  ".kGggrrrrrrggGk...",
  ".kGGgrrrrrrgGGk...",
  ".kkkkkkkkkkkkkk...",
];

/* ---------- 12x12 icons ---------- */
const IC = {};
IC.bandage = {p:{k:'#1a1418',w:'#f4eee0',g:'#b8b0a0',r:'#d83a4a'}, r:[
"....kkkk....","..kkwwwwkk..",".kwwwwwwwwk.",".kwwwrrwwwk.","kwwwwrrwwwwk","kwwrrrrrrwwk",
"kwwrrrrrrwwk","kwwwwrrwwwwk",".kwwwrrwwwk.",".kgwwwwwwgk.","..kkggggkk..","....kkkk...."]};
IC.can = {p:{k:'#141820',s:'#d8dce6',S:'#8a90a0',b:'#2f6ad0',B:'#1e4490',y:'#f2c43a'}, r:[
"............","..kkkkkkkk..",".kssssssssk.",".kSSSSSSSSk.",".kbbbbbbbbk.",".kbyybbbbBk.",
".kbyyyyybBk.",".kbbyybbbBk.",".kbbbbbbbBk.",".kSSSSSSSSk.",".kssssssssk.","..kkkkkkkk.."]};
IC.tea = {p:{k:'#1a1214',r:'#d8503a',R:'#9a3022',t:'#8a5222',s:'#d8d4cc'}, r:[
"..s...s.....","...s...s....","..s...s.....","kkkkkkkkk...","kttttttttkk.","krrrrrrrk.k.",
"kRrrrrrrk.k.","kRrrrrrrkkk.","kRRrrrrrk...",".kRRRRRk....","..kkkkk.....","............"]};
IC.raincoat = {p:{k:'#1c1408',y:'#f2c23a',Y:'#b8862a',o:'#fff0a0'}, r:[
"...kkkkkk...","..kyyyyyyk..",".kyyykkyyyk.","kyyyk..kyyyk","kyyyykkyyyyk","kyYyyyyyyYyk",
"kyYyyoyyyYyk","kkYyyyyyyYkk","..kyyoyyyk..","..kyyyyyyk..","..kYyoyyYk..","..kkkkkkkk.."]};
IC.flare = {p:{k:'#1a0e0e',r:'#e83a3a',R:'#9a1e22',w:'#f4e8d8',y:'#ffe066',o:'#ff9a2a'}, r:[
"........y.y.",".......yoy..","........y.y.",".......kk...","......krrk..",".....krrRk..",
"....krrRk...","...kwwRk....","..krrRk.....",".krrRk......",".kRRk.......","..kk........"]};
IC.heart = {p:{k:'#1a0c10',r:'#e23a50',R:'#a01e34',w:'#ffc8c8'}, r:[
"............",".kkk....kkk.","krrrk..krrrk","krwrrkkrrrrk","krwrrrrrrrRk","krrrrrrrrrRk",
".krrrrrrrRk.","..krrrrrRk..","...krrrRk...","....krRk....",".....kk.....","............"]};
IC.bag = {p:{k:'#1a120c',b:'#9a6a3a',B:'#6a4422',y:'#f2c23a',l:'#c08a50'}, r:[
"....kkkk....","...kB..Bk...","..kkkkkkkk..",".kllllllllk.",".kbBBBBBBbk.",".kbbbbbbbbk.",
".kbbkkkkbbk.",".kbbkyykbbk.",".kbbkkkkbbk.",".kbbbbbbbbk.",".kBBBBBBBBk.","..kkkkkkkk.."]};
IC.rod = {p:{k:'#140e0a',b:'#a8743a',B:'#6a4422',w:'#f4eee0',g:'#9aa0aa',G:'#5a606a',r:'#e23a3a'}, r:[
"..........kw",".........kbk","........kbkw","........kbkw",".......kbk.w","......kbk..w",
".....kbk...w","....kBk....r","..kkBk......",".kgGGk......",".kgkGk......","..kkk......."]};
IC.spool = {p:{k:'#141418',w:'#c89a5a',W:'#8a6430',c:'#5ad0e0',C:'#2a8aa0'}, r:[
"..kkkkkkkk..","..kwwwwwwk..","...kccCck...","...kcCcck...","...kccCck...","...kcCcck...",
"...kccCck...","...kcCcck...","...kccCck...","..kWWWWWWk..","..kkkkkkkk..","............"]};
IC.book = {p:{k:'#160e1a',p:'#7a3aa8',P:'#4e2270',y:'#f2c23a',w:'#efe6d0'}, r:[
"............",".kkkkkkkkk..",".kpppppppkk.",".kpyyyyypkwk",".kpppppppkwk",".kpyyypppkwk",
".kpppppppkwk",".kPpppppPkwk",".kPPPPPPPkwk",".kkkkkkkkkwk","..kwwwwwwwwk","...kkkkkkkk."]};
IC.boat = {p:{k:'#140e0a',b:'#9a6a3a',B:'#6a4422',r:'#e23a3a',w:'#bfe4f0',W:'#5aa0c8',m:'#c8b090'}, r:[
"......k.....","......krr...","......krrr..","......krr...","......k.....","......k.....",
"kkkkkkkkkkkk","kmmmmmmmmmmk",".kbBbbbbbBk.","..kbbbbbbk..","wwwkkkkkkwww",".WW.WW.WW.WW"]};
IC.coin = {p:{k:'#2a1806',y:'#f2c23a',Y:'#b07a1a',w:'#fff2b0'}, r:[
"...kkkkk....","..kyyyyyk...",".kywwyyyYk..",".kywyyyyYk..",".kyyyYyyYk..",".kyyyYyyYk..",
".kyyyyyyYk..",".kyyyyyYYk..","..kYYYYYk...","...kkkkk....","............","............"]};
IC.trash = {p:{k:'#0e0e12',g:'#6a6e7a',G:'#3e424c',l:'#9aa0ac'}, r:[
"....kkkk....","...kllllk...","kkkkkkkkkkkk","kllllllllllk","kkkkkkkkkkkk",".kgGgGgGgGk.",
".kgGgGgGgGk.",".kgGgGgGgGk.",".kgGgGgGgGk.",".kgGgGgGgGk.",".kGGGGGGGGk.","..kkkkkkkk.."]};
IC.map = {p:{k:'#1a1208',m:'#e6d2a0',M:'#b89a60',r:'#d83a3a',b:'#5a8ac0'}, r:[
"............","kkkkkkkkkkkk","kmmMmmmMmmmk","kmbbMmmMmrmk","kmbMbmmMrmrk","kmmMmmmMmrmk",
"kmmMmbbMmmmk","kmmMbbmMmmmk","kmmMmmmMbmmk","kmmMmmmMmbmk","kkkkkkkkkkkk","............"]};
IC.dex = {p:{k:'#120e0a',b:'#2a6a8a',B:'#1a4058',w:'#efe6d0',f:'#f29a3a'}, r:[
"............",".kkkkkkkkkk.",".kbbbbbbbbk.",".kbwwwwwwbk.",".kbwfffwwbk.",".kbffffffbk.",
".kbwfffwwbk.",".kbwwwwwwbk.",".kbbbbbbbbk.",".kBBBBBBBBk.",".kkkkkkkkkk.","............"]};
IC.anchor = {p:{k:'#101216',g:'#b8c0cc',G:'#6a7280'}, r:[
".....kk.....","....kggk....","....kggk....",".....kk.....","...kkggkk...","....kggk....",
".....gg.....","k....gg....k","kg...gg...gk",".kg..gg..gk.","..kggggggk..","...kkkkkk..."]};
G.ICONS = IC;
G.iconCache = {};
G.icon = function(name){ if(!G.iconCache[name]){ const d=IC[name]; G.iconCache[name]=G.spriteCanvas(d.r,d.p,1);} return G.iconCache[name]; };
G.iconURL = function(name,scale){ const key=name+'@'+(scale||1); if(!G.iconCache[key]){ const d=IC[name]; G.iconCache[key]=G.spriteCanvas(d.r,d.p,scale||1).toDataURL(); } return G.iconCache[key]; };

/* ======================================================
   FISH sprite generator
   ====================================================== */
const CELL = G.CELL = 16;
const fishCache = {}, silCache = {}, glowCache = {};
function profile(type,u){
  switch(type){
    case 'round': { const e=Math.sqrt(Math.max(0,1-Math.pow((u-0.54)/0.5,2))); return Math.max(e, u<0.12?0.32:0); }
    case 'eel':   { if(u<0.08) return 0.35+u*4; if(u>0.86) return Math.sqrt(Math.max(0,1-Math.pow((u-0.86)/0.16,2)))*0.72; return 0.72; }
    case 'shark': { if(u<0.6) return 0.3+0.7*Math.sin(u/0.6*Math.PI/2); return Math.pow(Math.max(0,1-(u-0.6)/0.42),0.62); }
    case 'deep':  { if(u<0.4) return 0.42+0.58*Math.sin(u/0.4*Math.PI/2); return Math.sqrt(Math.max(0,1-Math.pow((u-0.4)/0.62,2))); }
    default:      { if(u<0.55) return 0.36+0.64*Math.sin(u/0.55*Math.PI/2); return Math.sqrt(Math.max(0,1-Math.pow((u-0.55)/0.47,2))); }
  }
}
function genFish(def){
  const rows=def.shape, R=rows.length, Cn=rows[0].length, W=Cn*CELL, H=R*CELL;
  const cell=(c,r)=> (r>=0&&r<R&&c>=0&&c<Cn)? rows[r][c] : '.';
  const buf=new Uint8Array(W*H); // 0 empty,1 outline,2 dark,3 base,4 light,5 fin,6 finDark,7 pattern,8 eyeW,9 eyeK,10 glow
  const set=(x,y,v)=>{ if(x<0||y<0||x>=W||y>=H) return; if(cell(Math.floor(x/CELL),Math.floor(y/CELL))==='.') return; buf[y*W+x]=v; };
  const get=(x,y)=> (x<0||y<0||x>=W||y>=H)?0:buf[y*W+x];
  let bx0=99,bx1=-1,by0=99,by1=-1, tx0=99;
  for(let r=0;r<R;r++) for(let c=0;c<Cn;c++){ const ch=cell(c,r);
    if(ch==='B'||ch==='H'){ bx0=Math.min(bx0,c); bx1=Math.max(bx1,c); by0=Math.min(by0,r); by1=Math.max(by1,r); }
    if(ch==='T') tx0=Math.min(tx0,c); }
  const X0=bx0*CELL+1, X1=(bx1+1)*CELL-1, Y0=by0*CELL, Y1=(by1+1)*CELL;
  const cy=(Y0+Y1)/2, maxH=(Y1-Y0)/2-1.5, BW=X1-X0;
  const half=(x)=> profile(def.body, (x+0.5-X0)/BW)*maxH;
  const rnd=G.rng(def.id.length*977+def.val*13);

  // --- fins (draw first, body overlays) ---
  for(let r=0;r<R;r++){ let c=0; while(c<Cn){ if(cell(c,r)!=='F'){c++;continue;} let c2=c; while(c2+1<Cn&&cell(c2+1,r)==='F') c2++;
      const fx0=c*CELL, fw=(c2-c+1)*CELL, above = r<by0;
      const long = fw>=4*CELL;
      for(let lx=0;lx<fw;lx++){ const t=lx/(fw-1);
        let h = long ? 0.42+0.16*Math.sin(lx/2.6)+0.1*Math.sin(t*Math.PI)
                     : (t<0.22? 0.35+0.65*(t/0.22) : Math.max(0.08, 1-Math.pow((t-0.22)/0.78,0.8)));
        if(!above) h*=0.8;
        const x=fx0+lx, ray=((lx+(above?0:1))%3===0)?6:5;
        if(above){ const top=Math.round((r+1)*CELL - h*(CELL-3)); for(let y=top;y<Math.ceil(cy);y++) set(x,y,y===top?6:ray); }
        else { const bot=Math.round(r*CELL + h*(CELL-3)); for(let y=Math.floor(cy);y<bot;y++) set(x,y,y===bot-1?6:ray); } }
      c=c2+1; } }
  // --- tail ---
  if(tx0<99){ const Tx0=tx0*CELL+1, Tx1=X0+3; let ty0=99,ty1=-1; for(let r=0;r<R;r++) if(cell(tx0,r)==='T'){ty0=Math.min(ty0,r);ty1=Math.max(ty1,r);}
    const tH=((ty1+1)*CELL-ty0*CELL)/2-1.5;
    for(let x=Tx0;x<Tx1;x++){ const v=(Tx1-x)/(Tx1-Tx0); const spread=(0.22+0.78*Math.pow(v,0.9))*tH;
      for(let y=Math.floor(cy-spread);y<=Math.ceil(cy+spread);y++){ const dy=Math.abs(y+0.5-cy); if(dy>spread) continue;
        if(v>0.6 && dy < (v-0.6)/0.4*spread*0.55) continue;
        set(x,y, ((x+Math.round(dy))%3===0)?6:5); } } }
  // --- snout / sword ---
  for(let r=0;r<R;r++) for(let c=0;c<Cn;c++) if(cell(c,r)==='S'){ const sx0=X1-4, sx1=(c+1)*CELL-1;
    for(let x=sx0;x<=sx1;x++){ const t=(x-sx0)/(sx1-sx0); const th = t<0.6?2:1; for(let k=0;k<th;k++) set(x,Math.round(cy)-1+k, k===0?4:2); } }
  // --- body ---
  for(let x=X0;x<X1;x++){ const hh=half(x); if(hh<=0.3) continue; const u=(x+0.5-X0)/BW;
    for(let y=Math.floor(cy-hh-1);y<=Math.ceil(cy+hh+1);y++){ const dy=y+0.5-cy; if(Math.abs(dy)>hh) continue;
      const rel=(dy+hh)/(2*hh); let v=3;
      if(rel<0.22 || (rel<0.36 && G.dith(x,y,(0.36-rel)/0.14))) v=2;
      else if(rel>0.74 || (rel>0.62 && G.dith(x,y,(rel-0.62)/0.12))) v=4;
      switch(def.pat){
        case 'stripes': if(rel<0.62 && ((x-X0)%6)<2 && u>0.12 && u<0.82) v=7; break;
        case 'bands': { const bands=[[0.18,0.27],[0.48,0.58],[0.8,0.86]]; for(const b of bands){ if(u>=b[0]&&u<=b[1]) v=7; else if(Math.abs(u-b[0])<0.035||Math.abs(u-b[1])<0.035) v=1; } break; }
        case 'spots': if(rel<0.72 && G.hash(x,y,def.val)<0.13 && u<0.84) v=7; break;
        case 'lateral': if(Math.abs(dy-hh*0.1)<0.6 && u>0.1 && u<0.82) v=7; break;
        case 'scales': if(v===3 && ((x+(y%2)*2)%4===0) && (y%2===0)) v=2; break;
        case 'gold': if(G.hash(x,y,7)<0.07) v=10; else if(v===3 && ((x+y)%5===0)) v=4; break;
      }
      set(x,y,v); } }
  // gill line
  const gx=X0+Math.round(BW*0.7); { const gh=half(gx)*0.55; for(let y=Math.round(cy-gh);y<=Math.round(cy+gh);y++){ if(get(gx,y)>=2&&get(gx,y)<=4) set(gx+(Math.abs(y-cy)>gh*0.5?1:0),y,2); } }
  // lure
  for(let r=0;r<R;r++) for(let c=0;c<Cn;c++) if(cell(c,r)==='L'){ const sx=X1-5, sy=Math.round(cy-half(X1-5))+1, ex=c*CELL+8, ey=r*CELL+6;
    for(let i=0;i<=20;i++){ const t=i/20; const x=Math.round(sx+(ex-sx)*t + Math.sin(t*Math.PI)*-5), y=Math.round(sy+(ey-sy)*t - Math.sin(t*Math.PI)*3); set(x,y,6); }
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if(Math.abs(dx)+Math.abs(dy)<2) set(ex+dx,ey+dy,10); }
  // clip to mask (done in set) — outline
  const out=buf.slice();
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ if(buf[y*W+x]) continue; if(cell(Math.floor(x/CELL),Math.floor(y/CELL))==='.') continue;
    if(get(x-1,y)||get(x+1,y)||get(x,y-1)||get(x,y+1)) out[y*W+x]=1; }
  // rim light: body pixels just under outline on the front half
  for(let y=1;y<H;y++) for(let x=X0;x<X1;x++){ const v=out[y*W+x]; if((v===2) && out[(y-1)*W+x]===1 && (x-X0)/BW>0.35 && (x-X0)/BW<0.92) out[y*W+x]=4; }
  // eye
  const es = maxH>10?3:2; const ex = X1 - Math.max(3, Math.round(BW*0.13)) - es; const ey = Math.round(cy - half(ex)*0.42) - (es>2?1:0);
  if(def.body==='shark'){ out[ey*W+ex+1]=9; out[ey*W+ex+2]=9; }
  else { for(let j=0;j<es;j++) for(let i=0;i<es;i++) out[(ey+j)*W+ex+i]=8; out[(ey+(es>2?1:0))*W+ex+es-1]=9; if(es>2) out[(ey+1)*W+ex+es-2]=9; }
  // mouth
  const my=Math.round(cy+maxH*0.18); for(let x=X1-3;x<X1;x++){ if(out[my*W+x]>=2&&out[my*W+x]<=4){ out[my*W+x]=1; break; } }

  const col=def.col; const pal=[null,col.o,col.d,col.b,col.l,col.f,col.fd,col.p,'#f4f0e0','#101018',col.gl||'#fff6b0'];
  const cv=G.canvas(W,H), x=cv.ctx, img=x.createImageData(W,H), d=img.data;
  const rgb=pal.map(c=>c?G.rgb(c):null);
  for(let i=0;i<W*H;i++){ const v=out[i]; if(!v) continue; const c=rgb[v]; d[i*4]=c[0]; d[i*4+1]=c[1]; d[i*4+2]=c[2]; d[i*4+3]=255; }
  x.putImageData(img,0,0);
  return cv;
}
G.fish = function(id){ if(!fishCache[id]) fishCache[id]=genFish(DATA.FISH_BY_ID[id]); return fishCache[id]; };
G.fishTint = function(id,color,cache){ cache=cache||silCache; const key=id+color; if(!cache[key]){ const s=G.fish(id); const c=G.canvas(s.width,s.height); c.ctx.drawImage(s,0,0); c.ctx.globalCompositeOperation='source-in'; c.ctx.fillStyle=color; c.ctx.fillRect(0,0,s.width,s.height); cache[key]=c; } return cache[key]; };

/* shape mask with rotation */
const maskCache={};
G.mask = function(id,rot){ const key=id+rot; if(maskCache[key]) return maskCache[key];
  const rows=DATA.FISH_BY_ID[id].shape, R=rows.length, C=rows[0].length; let cells=[];
  for(let r=0;r<R;r++) for(let c=0;c<C;c++) if(rows[r][c]!=='.') cells.push([c,r]);
  let w=C,h=R;
  for(let k=0;k<rot;k++){ cells=cells.map(([c,r])=>[h-1-r,c]); const t=w; w=h; h=t; }
  return maskCache[key]={w,h,cells};
};
/* draw a fish piece; x,y = top-left of its rotated bounding box */
G.drawFish = function(ctx,id,rot,x,y,img){ const s=img||G.fish(id); const w=s.width,h=s.height; const rw=rot%2?h:w, rh=rot%2?w:h;
  ctx.save(); ctx.translate(Math.round(x)+rw/2, Math.round(y)+rh/2); ctx.rotate(rot*Math.PI/2); ctx.drawImage(s,-w/2,-h/2); ctx.restore(); };
})();
