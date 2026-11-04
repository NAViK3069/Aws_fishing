/* =========================================================
   Inventory grid (polyomino fish packing) + panel rendering
   ========================================================= */
(function(){
const G = window.GFX;
const I = window.INV = {};
const C = G.CELL;
I.COLS=8; I.ROWS=11; I.GX=16; I.GY=34;
I.STAR_COL = {1:'#a8aeb8',2:'#6ad06a',3:'#5aa8f0',4:'#c070f0',5:'#f6c040'};

// unlock order: grows as a blob from the centre
const ORDER=[]; (function(){ const cells=[]; for(let r=0;r<I.ROWS;r++) for(let c=0;c<I.COLS;c++){ const dx=(c-3.5), dy=(r-5)/1.3; cells.push({c,r,d:dx*dx+dy*dy+G.hash(c,r,5)*0.9}); }
  cells.sort((a,b)=>a.d-b.d); cells.forEach(o=>ORDER.push([o.c,o.r])); })();

class Inventory{
  constructor(){ this.pieces=[]; this.open=new Set(); this.uid=1; this.setLevel(0); }
  setLevel(l){ const n=DATA.STORAGE[Math.min(l,DATA.STORAGE.length-1)]; this.open=new Set(ORDER.slice(0,n).map(([c,r])=>r*I.COLS+c)); }
  isOpen(c,r){ return c>=0&&r>=0&&c<I.COLS&&r<I.ROWS&&this.open.has(r*I.COLS+c); }
  occMap(ignore){ const m=new Map(); for(const p of this.pieces){ if(p===ignore) continue; for(const [c,r] of G.mask(p.f,p.rot).cells) m.set((p.gy+r)*I.COLS+(p.gx+c),p); } return m; }
  canPlace(p,gx,gy,rot,ignore){ const occ=this.occMap(ignore); for(const [c,r] of G.mask(p.f,rot).cells){ const cc=gx+c, rr=gy+r; if(!this.isOpen(cc,rr)||occ.has(rr*I.COLS+cc)) return false; } return true; }
  pieceAt(c,r){ return this.occMap().get(r*I.COLS+c)||null; }
  add(p){ if(!p.uid) p.uid=this.uid++; if(!this.pieces.includes(p)) this.pieces.push(p); }
  remove(p){ const i=this.pieces.indexOf(p); if(i>=0) this.pieces.splice(i,1); }
  autoPlace(p){ for(let rot=0;rot<4;rot++){ const m=G.mask(p.f,rot); for(let gy=0;gy<=I.ROWS-m.h;gy++) for(let gx=0;gx<=I.COLS-m.w;gx++) if(this.canPlace(p,gx,gy,rot)){ p.gx=gx;p.gy=gy;p.rot=rot; this.add(p); return true; } } return false; }
  usedCells(){ let n=0; for(const p of this.pieces) n+=G.mask(p.f,p.rot).cells.length; return n; }
  value(){ return this.pieces.reduce((s,p)=>s+p.v,0); }
}
I.Inventory = Inventory;

I.cellAt = function(lx,ly){ const c=Math.floor((lx-I.GX)/C), r=Math.floor((ly-I.GY)/C); if(c<0||r<0||c>=I.COLS||r>=I.ROWS) return null; return {c,r}; };
I.inPanel = (lx,ly)=> lx>=4 && lx<158 && ly>=4 && ly<266;

/* ---------------- panel art (static) ---------------- */
let frameCv=null;
function plate(c,x,y,w,h){ G.rect(c,x,y,w,h,'#0e0c10'); G.rect(c,x+1,y+1,w-2,h-2,'#4a4650'); G.rect(c,x+2,y+2,w-4,h-4,'#35323a'); G.rect(c,x+2,y+2,w-4,1,'#5e5a64'); G.rect(c,x+2,y+h-3,w-4,1,'#242128');
  [[x+3,y+3],[x+w-4,y+3],[x+3,y+h-4],[x+w-4,y+h-4]].forEach(([a,b])=>{ G.px(c,a,b,'#8a8692'); }); }
I.plate = plate;
function woodFrame(c,x,y,w,h){
  G.rect(c,x,y,w,h,'#0e0a08');
  for(let yy=y+1;yy<y+h-1;yy++) for(let xx=x+1;xx<x+w-1;xx++){ const edge=Math.min(xx-x,yy-y,x+w-1-xx,y+h-1-yy); if(edge>7) continue;
    let col = ((xx+yy*3)%11===0)?'#3a2618':(edge<2?'#6a4a32':'#523826'); if(edge===1) col='#7a5a3c'; if(edge===7) col='#1a120c'; if(G.hash(xx,yy,2)<0.04) col='#3e2a1c'; G.px(c,xx,yy,col); }
  [[x+4,y+4],[x+w-5,y+4],[x+4,y+h-5],[x+w-5,y+h-5]].forEach(([a,b])=>{ G.rect(c,a-1,b-1,3,3,'#1a1410'); G.px(c,a,b,'#b8a890'); });
}
function buildFrame(){
  const cv=G.canvas(160,270), c=cv.ctx;
  // header plates
  plate(c,6,5,92,18); plate(c,100,5,54,18);
  // grid frame
  woodFrame(c,6,25,148,202);
  G.rect(c,I.GX-2,I.GY-2,I.COLS*C+4,I.ROWS*C+4,'#060508');
  // bottom plates
  plate(c,6,230,58,34); plate(c,66,230,30,34); plate(c,98,230,56,34);
  G.rect(c,69,233,24,28,'#14121a');
  G.rect(c,102,240,48,14,'#120a0c');
  return cv;
}

/* ---------------- per-frame draw ---------------- */
I.draw = function(c, st, t){
  if(!frameCv) frameCv=buildFrame();
  c.drawImage(frameCv,0,0);
  const inv=st.inv; const occ=inv.occMap(st.drag&&st.drag.piece);
  for(let r=0;r<I.ROWS;r++) for(let col=0;col<I.COLS;col++){
    const x=I.GX+col*C, y=I.GY+r*C;
    if(inv.isOpen(col,r)){
      const p=occ.get(r*I.COLS+col);
      G.rect(c,x,y,C,C,'#17151b');
      G.rect(c,x+1,y+1,C-2,C-2, p? G.mix('#2c2a31',I.STAR_COL[DATA.FISH_BY_ID[p.f].star],0.16) : '#2c2a31');
      G.rect(c,x+1,y+1,C-2,1,'#3a3840'); G.rect(c,x+1,y+1,1,C-2,'#36343c'); G.rect(c,x+1,y+C-2,C-2,1,'#232127');
    } else {
      G.rect(c,x,y,C,C,'#0a090c'); G.rect(c,x+1,y+1,C-2,C-2,'#0f0e12');
    }
  }
  // drop preview
  const d=st.drag;
  if(d && d.active){ const m=G.mask(d.piece.f,d.piece.rot); const gx=d.gx, gy=d.gy; if(gx!=null){ const ok=d.ok;
      for(const [cc,rr] of m.cells){ const X=gx+cc, Y=gy+rr; if(X<0||Y<0||X>=I.COLS||Y>=I.ROWS) continue; c.globalAlpha=0.45; G.rect(c,I.GX+X*C+1,I.GY+Y*C+1,C-2,C-2, ok?'#5af07a':'#f05a5a'); c.globalAlpha=1; } } }
  // pieces
  for(const p of inv.pieces){ if(d&&d.piece===p&&d.active) continue; const x=I.GX+p.gx*C, y=I.GY+p.gy*C;
    const def=DATA.FISH_BY_ID[p.f]; if(def.star>=4) glow(c,p,x,y,t,def);
    G.drawFish(c,p.f,p.rot,x,y);
    if(st.selected===p){ const m=G.mask(p.f,p.rot); c.globalAlpha=0.5+Math.sin(t*8)*0.3; for(const [cc,rr] of m.cells){ const X=x+cc*C, Y=y+rr*C; c.strokeStyle='#ffe066'; c.lineWidth=1; c.strokeRect(X+0.5,Y+0.5,C-1,C-1);} c.globalAlpha=1; } }
  // fill indicator
  const used=inv.usedCells(), total=inv.open.size;
  G.rect(c,I.GX,I.GY+I.ROWS*C+3,I.COLS*C,2,'#1a1418'); G.rect(c,I.GX,I.GY+I.ROWS*C+3,Math.round(I.COLS*C*used/total),2, used/total>0.85?'#e85a4a':'#7ac06a');
};
function glow(c,p,x,y,t,def){ const col=def.star===5?'#ffe070':'#d890ff'; const img=G.fishTint(p.f,col,glowCache); c.globalAlpha=0.35+Math.sin(t*3+p.uid)*0.2;
  G.drawFish(c,p.f,p.rot,x-1,y,img); G.drawFish(c,p.f,p.rot,x+1,y,img); G.drawFish(c,p.f,p.rot,x,y-1,img); G.drawFish(c,p.f,p.rot,x,y+1,img); c.globalAlpha=1; }
const glowCache={};
I.glow = glow;

I.drawFloating = function(c,p,x,y,t,lift){ const def=DATA.FISH_BY_ID[p.f]; const m=G.mask(p.f,p.rot);
  if(lift){ c.globalAlpha=0.35; G.drawFish(c,p.f,p.rot,x+3,y+4,G.fishTint(p.f,'#000000')); c.globalAlpha=1; }
  if(def.star>=3) glow(c,p,x,y,t,def);
  G.drawFish(c,p.f,p.rot,x,y); return m; };
})();
