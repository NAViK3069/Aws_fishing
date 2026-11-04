/* =========================================================
   AWS Fishing — main game logic
   ========================================================= */
(function(){
const G=GFX, S=SCENE, I=INV, D=DATA, A=AUDIO;
const $=id=>document.getElementById(id);
const stage=$('stage'), cv=$('cv'), ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
const fxc=$('fx').getContext('2d'); fxc.imageSmoothingEnabled=false; // top layer above DOM panels (dragged / flying fish)
const SAVE_KEY='awsfishing.save.v1';
const C=G.CELL;
const PEND={x:236,y:110};
const rand=(a,b)=>a+Math.random()*(b-a);

const st = window.ST = {
  scene:'title', theme:'dock', zoneIdx:0,
  coins:40, hp:100, upg:{hp:0,storage:0,rod:0,line:0,book:0,boat:0}, items:{bandage:2,tea:0,can:0,raincoat:0,flare:0},
  inv:new I.Inventory(), pending:null, drag:null, selected:null,
  fishing:null, event:null, nextEvent:30, shake:0, flash:0, redFlash:0, rodAng:-0.85, rodBend:0,
  stats:{caught:0,correct:0,wrong:0,earned:0,dex:{}}, trans:null, fade:0, quiz:null, casts:0,
};
const maxHp=()=>100+25*st.upg.hp;

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */
function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify({ coins:st.coins, upg:st.upg, items:st.items, stats:st.stats, casts:st.casts,
  pieces:st.inv.pieces.map(p=>({f:p.f,rot:p.rot,gx:p.gx,gy:p.gy,v:p.v})) })); }catch(e){} }
function load(){ try{ const raw=localStorage.getItem(SAVE_KEY); if(!raw) return false; const s=JSON.parse(raw);
  st.coins=s.coins|0; Object.assign(st.upg,s.upg||{}); Object.assign(st.items,s.items||{}); Object.assign(st.stats,s.stats||{}); st.stats.dex=st.stats.dex||{}; st.casts=s.casts||0;
  st.inv=new I.Inventory(); st.inv.setLevel(st.upg.storage);
  (s.pieces||[]).forEach(p=>{ if(D.FISH_BY_ID[p.f] && st.inv.canPlace(p,p.gx,p.gy,p.rot)) st.inv.add(p); });
  st.hp=maxHp(); return true; }catch(e){ return false; } }
function hasSave(){ try{ return !!localStorage.getItem(SAVE_KEY); }catch(e){ return false; } }

/* ------------------------------------------------------------------ */
/* Layout / scaling (auto-rotates on portrait phones)                  */
/* ------------------------------------------------------------------ */
let rotated=false;
function fit(){
  const w=window.innerWidth, h=window.innerHeight;
  rotated = h>w*1.1;
  if(rotated){ const s=Math.min(h/960, w/540); stage.style.transform=`translate(-50%,-50%) rotate(90deg) scale(${s})`; }
  else { const s=Math.min(w/960, h/540); stage.style.transform=`translate(-50%,-50%) scale(${s})`; }
}
window.addEventListener('resize',fit); window.addEventListener('orientationchange',()=>setTimeout(fit,200)); fit();
function toLogical(e){
  const r=cv.getBoundingClientRect();
  if(rotated) return { x:(e.clientY-r.top)/r.height*480, y:(1-(e.clientX-r.left)/r.width)*270 };
  return { x:(e.clientX-r.left)/r.width*480, y:(e.clientY-r.top)/r.height*270 };
}

/* ------------------------------------------------------------------ */
/* DOM helpers                                                          */
/* ------------------------------------------------------------------ */
function buildFrames(){
  const f=G.canvas(24,24), c=f.ctx;
  for(let y=0;y<24;y++) for(let x=0;x<24;x++){ const e=Math.min(x,y,23-x,23-y); let col;
    if(e===0) col='#0e0a08'; else if(e===1) col='#7a5a3c'; else if(e<6) col=((x*3+y)%7===0)?'#3e2a1c':'#56392a'; else if(e===6) col='#2a1c12'; else if(e===7) col='#120c08'; else col= G.dith(x,y,0.5)?'#21170f':'#1d140d';
    G.px(c,x,y,col); }
  [[3,3],[20,3],[3,20],[20,20]].forEach(([x,y])=>{ G.px(c,x,y,'#c8b8a0'); G.px(c,x+1,y+1,'#1a1410'); });
  document.documentElement.style.setProperty('--frame',`url(${f.toDataURL()})`);
}
function setIcons(root){ (root||document).querySelectorAll('img[data-icon]').forEach(img=>{ img.src=G.iconURL(img.dataset.icon,3); }); }
function toast(msg,cls,dur){ const d=document.createElement('div'); d.className='toast '+(cls||''); d.innerHTML=msg; $('toasts').appendChild(d);
  if(dur) d.style.animation=`toastIn .2s steps(3),toastOut .3s ${dur}s forwards`; setTimeout(()=>d.remove(), ((dur||1.9)+0.4)*1000);
  while($('toasts').children.length>4) $('toasts').firstChild.remove(); }
function floatText(txt,lx,ly,col){ const d=document.createElement('div'); d.className='float'; d.textContent=txt; d.style.left=(lx*2)+'px'; d.style.top=(ly*2)+'px'; d.style.color=col||'#fff'; $('floats').appendChild(d); setTimeout(()=>d.remove(),1200); }
function stars(n){ return '★'.repeat(n); }
const vib=(ms)=>{ try{ navigator.vibrate&&navigator.vibrate(ms); }catch(e){} };

/* ------------------------------------------------------------------ */
/* HUD                                                                  */
/* ------------------------------------------------------------------ */
let hudCache={};
function updateHud(){
  const hp=Math.max(0,Math.ceil(st.hp)), mh=maxHp();
  if(hudCache.hp!==hp||hudCache.mh!==mh){ hudCache.hp=hp; hudCache.mh=mh; $('hpFill').style.width=(hp/mh*100)+'%'; $('hpText').textContent=hp; }
  if(hudCache.coins!==st.coins){ hudCache.coins=st.coins; $('coins').textContent=st.coins; refreshDock(); }
  const low = st.scene==='sea' && st.hp/mh<0.25; stage.classList.toggle('low',low);
  if(st.scene==='dock'){ const v=st.inv.value(); if(hudCache.sv!==v){ hudCache.sv=v; $('sellVal').textContent=v?`(${v})`:''; $('btnSellAll').disabled=!v; } }
  // event banner
  if(st.event){ $('evBar').style.width=(st.event.left/st.event.dur*100)+'%'; }
}
function drawPortrait(t){ const p=$('portrait'), c=p.getContext('2d'); c.imageSmoothingEnabled=false; c.fillStyle='#14121a'; c.fillRect(0,0,24,28);
  const hurt=st.redFlash>0; S.drawCat(c,4,7+Math.round(Math.sin(t*2)*0.6),(t%4)<0.12); if(hurt){ c.globalCompositeOperation='source-atop'; c.fillStyle='rgba(255,40,40,.5)'; c.fillRect(0,0,24,28); c.globalCompositeOperation='source-over'; } }

/* ------------------------------------------------------------------ */
/* Dock: shop + upgrades                                                */
/* ------------------------------------------------------------------ */
function buildDock(){
  const si=$('shopItems'); si.innerHTML='';
  D.ITEMS.forEach(it=>{ const d=document.createElement('div'); d.className='shopItem'; d.title=`${it.name} — ${it.desc}`;
    d.innerHTML=`<span class="cnt" data-cnt="${it.id}"></span><img src="${G.iconURL(it.icon,3)}" alt=""><span class="nm">${it.name}</span><span class="pr">${it.price}</span>`;
    d.addEventListener('click',()=>buyItem(it)); d.addEventListener('pointerenter',()=>showTip(`<b>${it.name}</b> — ${it.desc} · <span class="st">${it.price} G</span>`)); d.addEventListener('pointerleave',hideTip);
    si.appendChild(d); });
  const ul=$('upgList'); ul.innerHTML='';
  D.UPGRADES.forEach(u=>{ const d=document.createElement('div'); d.className='upg'; d.dataset.id=u.id;
    d.innerHTML=`<img src="${G.iconURL(u.icon,3)}" alt=""><div><div class="un">${u.name}</div><div class="pips"></div></div><div class="uc"></div>`;
    d.addEventListener('click',()=>buyUpgrade(u)); d.addEventListener('pointerenter',()=>showTip(`<b>${u.name}</b> — ${u.desc(st.upg[u.id])}`)); d.addEventListener('pointerleave',hideTip);
    ul.appendChild(d); });
  refreshDock();
}
function refreshDock(){
  document.querySelectorAll('[data-cnt]').forEach(el=>{ const n=st.items[el.dataset.cnt]||0; el.textContent=n?('x'+n):''; });
  document.querySelectorAll('.upg').forEach(el=>{ const u=D.UPGRADES.find(x=>x.id===el.dataset.id), l=st.upg[u.id];
    el.querySelector('.pips').innerHTML=Array.from({length:u.max},(_,i)=>`<i class="${i<l?'on':''}"></i>`).join('');
    const uc=el.querySelector('.uc'); if(l>=u.max){ uc.textContent='MAX'; uc.className='uc max'; } else { uc.innerHTML=`<img src="${G.iconURL('coin',2)}" style="width:14px;height:14px;vertical-align:-2px"> ${u.cost[l]}`; uc.className='uc'; }
    el.classList.toggle('cant', l<u.max && st.coins<u.cost[l]); });
  buildItemBar();
}
function buyItem(it){ A.init();
  if((st.items[it.id]||0)>=D.ITEM_MAX){ toast('ถือได้สูงสุด '+D.ITEM_MAX+' ชิ้น','bad'); A.sfx('deny'); return; }
  if(st.coins<it.price){ toast('เหรียญไม่พอ!','bad'); A.sfx('deny'); return; }
  st.coins-=it.price; st.items[it.id]=(st.items[it.id]||0)+1; A.sfx('buy'); toast(`ซื้อ ${it.name}`,'good'); refreshDock(); save(); }
function buyUpgrade(u){ A.init(); const l=st.upg[u.id];
  if(l>=u.max){ toast('อัปเกรดสูงสุดแล้ว'); return; }
  if(st.coins<u.cost[l]){ toast('เหรียญไม่พอ!','bad'); A.sfx('deny'); return; }
  st.coins-=u.cost[l]; st.upg[u.id]++; A.sfx('levelup');
  if(u.id==='storage') st.inv.setLevel(st.upg.storage);
  if(u.id==='hp') st.hp=maxHp();
  toast(`${u.name} → Lv.${st.upg[u.id]}`,'gold'); showTip(`<b>${u.name}</b> — ${u.desc(st.upg[u.id])}`); refreshDock(); save(); }
function showTip(html){ const t=$('tip'); t.innerHTML=html; t.style.display='block'; }
function hideTip(){ $('tip').style.display='none'; }

/* ------------------------------------------------------------------ */
/* Sea: item bar                                                        */
/* ------------------------------------------------------------------ */
function buildItemBar(){ const bar=$('itemBar'); bar.innerHTML='';
  D.ITEMS.forEach(it=>{ const n=st.items[it.id]||0; const d=document.createElement('div'); d.className='itm'+(n?'':' zero'); d.dataset.id=it.id; d.title=`${it.name} — ${it.desc}`;
    d.innerHTML=`<img src="${G.iconURL(it.icon,3)}" alt=""><b>${n}</b>`; d.addEventListener('pointerdown',e=>{ e.stopPropagation(); useItem(it); }); bar.appendChild(d); });
  markNeeded(); }
function markNeeded(){ document.querySelectorAll('.itm').forEach(el=>{ const it=D.ITEM_BY_ID[el.dataset.id]; el.classList.toggle('need', !!(st.event && it.cures.includes(st.event.id) && (st.items[it.id]||0)>0)); }); }
function useItem(it){ A.init(); if(st.scene!=='sea') return;
  if(!(st.items[it.id]>0)){ toast(`ไม่มี ${it.name} — ซื้อได้ที่ท่าเรือ`,'bad'); A.sfx('deny'); return; }
  const cures = st.event && it.cures.includes(st.event.id);
  if(!cures && (!it.heal || st.hp>=maxHp())){ toast(it.heal?'HP เต็มแล้ว':'ยังไม่จำเป็นต้องใช้ตอนนี้','bad'); A.sfx('deny'); return; }
  st.items[it.id]--;
  if(it.heal){ const h=Math.min(it.heal, maxHp()-st.hp); st.hp+=h; if(h>0){ floatText('+'+Math.round(h),330,150,'#9af09a'); A.sfx('heal'); } }
  if(cures){ const ev=st.event; endEvent(true);
    if(it.id==='flare'){ A.sfx('flare'); st.flash=0.6; for(let i=0;i<30;i++) S.addP({x:st.boatPos.x+20,y:st.boatPos.y-30,vx:rand(-60,60),vy:rand(-90,-20),g:80,life:1.2,max:1.2,col:i%2?'#ffe066':'#ff7a3a',fade:true}); }
    toast(`${it.name}: ${ev.def.name.replace('!','')} หายไปแล้ว`,'good'); }
  buildItemBar(); save(); }

/* ------------------------------------------------------------------ */
/* Scenes & transitions                                                 */
/* ------------------------------------------------------------------ */
function setSceneClass(){ hideTip(); stage.classList.remove('scene-dock','scene-sea','scene-title'); stage.classList.add('scene-'+st.scene);
  const dz=$('dropZone'); const sell=st.scene==='dock'; dz.classList.toggle('sell',sell); $('dropIcon').src=G.iconURL(sell?'coin':'trash',3); $('dropTxt').textContent=sell?'ลากมาขาย':'ลากมาทิ้ง'; dz.style.display=st.scene==='title'?'none':'flex'; }
function transition(mid,dur){ st.trans={t:0,dur:dur||0.45,mid,phase:'out'}; }
function goDock(reason){
  st.scene='dock'; st.theme='dock'; st.fishing=null; st.event=null; st.rodAng=-1.35; st.rodBend=0; S.waveAmp=1; A.setStorm(false);
  if(st.pending){ if(!st.inv.autoPlace(st.pending)) toast('ปลาที่ยังไม่ได้เก็บหลุดหายไป','bad'); st.pending=null; }
  st.hp=maxHp(); setSceneClass(); $('eventBanner').classList.remove('on'); refreshDock(); save();
  if(reason==='extract') toast('กลับถึงท่าเรือ — พักจน HP เต็ม','good');
}
function goSea(zi){
  const z=D.ZONES[zi]; st.zoneIdx=zi; st.scene='sea'; st.theme=z.theme; st.event=null; st.nextEvent=rand(z.ev[0],z.ev[1])*0.8;
  st.fishing={state:'idle',power:0,dir:1}; st.rodAng=-0.85; S.waveAmp = z.theme==='storm'?2:1; A.setStorm(z.theme==='storm');
  setSceneClass(); buildItemBar();
  $('zoneTitle').innerHTML=`${z.name} <span style="color:#f6c040">${'★'.repeat(Math.min(5,zi+1))}</span><small>${z.en} · HP −${z.drain}/วิ</small>`;
  $('hint').style.opacity = st.casts<6 ? 1 : 0;
  toast(z.name,'big',2.2); A.sfx('sail');
}

/* ------------------------------------------------------------------ */
/* Map / zone select                                                    */
/* ------------------------------------------------------------------ */
function openMap(){
  const list=$('zoneList'); list.innerHTML='';
  D.ZONES.forEach((z,i)=>{ const locked=st.upg.boat<z.boat; const row=document.createElement('div'); row.className='zone'+(locked?' locked':'');
    const th=G.canvas(96,54); const L=S.theme(z.theme); th.ctx.drawImage(L.sky,0,0,480,148,0,0,96,30); th.ctx.drawImage(L.far,0,0,480,148,0,0,96,30); th.ctx.drawImage(L.sea,0,0,480,54,0,30,96,11); th.ctx.drawImage(L.under,0,0,480,70,0,40,96,14);
    const sw=z.starW, tot=sw.reduce((a,b)=>a+b,0);
    const chance=sw.map((w,k)=>w?`<span>${k+1}★ ${Math.round(w/tot*100)}%</span>`:'').join('');
    row.innerHTML=`<div></div><div><div class="zn">${z.name}<small>${z.en}</small></div><div class="zs">${chance}<span class="d">HP −${z.drain}/วิ</span><span>ราคา ×${z.mul}</span></div></div><div></div>`;
    row.children[0].appendChild(th);
    const b=document.createElement('button'); b.className='btn '+(locked?'':'go'); b.innerHTML= locked?`🔒 เรือ Lv.${z.boat}`:'ออกเรือ ▶'; b.disabled=locked;
    b.addEventListener('click',()=>{ A.sfx('click'); closeModal('mapModal'); transition(()=>goSea(i),0.6); });
    row.children[2].appendChild(b); list.appendChild(row); });
  openModal('mapModal');
}
function openModal(id){ $(id).classList.add('on'); }
function closeModal(id){ $(id).classList.remove('on'); }
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{ A.sfx('click'); closeModal(b.dataset.close); }));

function message(title,body,btns){ $('msgTitle').innerHTML=title; $('msgBody').innerHTML=body; const bb=$('msgBtns'); bb.innerHTML='';
  btns.forEach(([label,cls,fn])=>{ const b=document.createElement('button'); b.className='btn '+(cls||''); b.innerHTML=label; b.addEventListener('click',()=>{ A.sfx('click'); closeModal('msgModal'); fn&&fn(); }); bb.appendChild(b); });
  openModal('msgModal'); }
function howTo(){ message('วิธีเล่น',`<ul>
  <li><b>ออกเรือ</b> เลือกน่านน้ำ — ยิ่งไกล ปลายิ่งหายาก ราคาดี แต่คำถามยากและอันตรายขึ้น</li>
  <li><b>กดค้าง</b> เพื่อเหวี่ยงเบ็ด ปล่อยเมื่อแรงพอดี แล้ว<b>แตะ</b>ทันทีเมื่อทุ่นจม <span style="color:#ff6a4a">!</span></li>
  <li>ปลาติดเบ็ดแล้วต้อง<b>ตอบคำถาม</b>ก่อน <b>เกจแรงดิ้นหนี</b> หมด — ตอบผิดเกจจะลดฮวบ</li>
  <li>ปลา ★1 = ถูก/ผิด · ★2+ = 4 ตัวเลือก · ★3+ ต้องตอบถูกหลายข้อ</li>
  <li>ลากปลาใส่<b>กระเป๋า</b>ด้านซ้าย หมุนด้วย คลิกขวา / ปุ่ม R / แตะที่ปลา (มือถือ: แตะนิ้วที่สองระหว่างลาก)</li>
  <li>กลางทะเล <b>HP ลดลงตลอดเวลา</b> และมีอีเวนต์อันตราย ใช้ไอเท็มเอาตัวรอด แล้ว<b>กลับท่าเรือ</b>ก่อน HP หมด — ถ้าหมดสติ ปลาทั้งหมดจะหาย!</li>
  <li>ขายปลาที่ท่าเรือ แล้วอัปเกรด HP กระเป๋า คันเบ็ด สายเบ็ด ตำรา และเรือ</li></ul>`,[['เข้าใจแล้ว','go']]); }

/* ------------------------------------------------------------------ */
/* Fishing                                                              */
/* ------------------------------------------------------------------ */
function rollFish(power){
  const zi=st.zoneIdx, z=D.ZONES[zi]; const w=z.starW.slice(); const tot=w.reduce((a,b)=>a+b,0); let r=Math.random()*tot, star=1;
  for(let i=0;i<5;i++){ if(r<w[i]){ star=i+1; break; } r-=w[i]; }
  if(star<5 && w[star]>0 && Math.random()<power*0.18) star++; // perfect cast bonus
  for(let s=star;s>=1;s--){ let pool=D.FISH.filter(f=>f.star===s && f.z[0]<=zi && f.z[1]>=zi); if(!pool.length) pool=D.FISH.filter(f=>f.star===s); if(pool.length) return pool[Math.floor(Math.random()*pool.length)]; }
  return D.FISH[0];
}
function startCharge(){ const f=st.fishing; if(!f||f.state!=='idle') return;
  if(st.pending){ toast('เก็บปลาใส่กระเป๋า หรือทิ้งก่อนนะ','bad'); A.sfx('deny'); return; }
  f.state='charge'; f.power=0; f.dir=1; }
function releaseCast(){ const f=st.fishing; if(!f||f.state!=='charge') return; const tip=st.rodTip||{x:400,y:150};
  const tx=Math.min(472, tip.x+14+f.power*40); const T=0.6; const vy=-70; const g=2*(S.WATER - tip.y - vy*T)/(T*T);
  f.bob={air:true,x:tip.x,y:tip.y,vx:(tx-tip.x)/T,vy,g}; f.state='cast'; f.castPow=f.power; A.sfx('cast'); st.casts++;
  if(st.casts>=6) $('hint').style.opacity=0; }
function hook(){ const f=st.fishing; if(f.state==='bite'){ f.state='quiz'; A.sfx('reel'); vib(40); startQuiz(f.fish); }
  else if(f.state==='wait'){ f.state='idle'; f.bob=null; f.approach=null; A.sfx('click'); } }
function updateFishing(dt,t){
  const f=st.fishing; if(!f) return;
  const baseAng=-0.85;
  switch(f.state){
    case 'idle': st.rodAng+=(baseAng-st.rodAng)*Math.min(1,dt*6); st.rodBend=0; f.biteDip=0; break;
    case 'charge': f.power+=dt*1.25*f.dir; if(f.power>=1){f.power=1;f.dir=-1;} if(f.power<=0){f.power=0;f.dir=1;} st.rodAng=baseAng-f.power*1.35; break;
    case 'cast': { st.rodAng+=(-0.45-st.rodAng)*Math.min(1,dt*14); const b=f.bob; b.vy+=b.g*dt; b.x+=b.vx*dt; b.y+=b.vy*dt;
      if(b.vy>0 && b.y>=S.waveY(b.x|0,t)){ b.air=false; f.state='wait'; f.timer=rand(2.2,5.2)*(1-f.castPow*0.3); A.sfx('splash');
        for(let i=0;i<12;i++) S.addP({x:b.x,y:b.y,vx:rand(-30,30),vy:rand(-60,-20),g:160,life:0.6,max:0.6,col:'#e8f0f4'}); }
      break; }
    case 'wait': st.rodAng+=(-0.55-st.rodAng)*Math.min(1,dt*4); f.timer-=dt; f.biteDip=Math.round(Math.sin(t*3)*0.6);
      if(f.timer<1.8 && !f.fish){ f.fish=rollFish(f.castPow||0); f.approach={id:f.fish.id, x:(f.bob.x-90), y:S.WATER+40}; }
      if(f.timer<=0){ f.state='bite'; f.timer=1.25+st.upg.rod*0.1; A.sfx('bite'); vib(80); for(let i=0;i<8;i++) S.addP({x:f.bob.x,y:S.WATER,vx:rand(-25,25),vy:rand(-50,-15),g:150,life:0.5,max:0.5,col:'#ffffff'}); }
      break;
    case 'bite': f.biteDip=3+Math.round(Math.sin(t*28)*2); st.rodBend=3+Math.sin(t*30)*2; f.timer-=dt;
      if(f.timer<=0){ toast('ช้าไป! ปลาหลุดเบ็ด','bad'); A.sfx('escape'); resetLine(); }
      break;
    case 'quiz': f.biteDip=2+Math.round(Math.sin(t*20)*2); st.rodBend=4+Math.sin(t*24)*2.5; st.rodAng+=(-0.35-st.rodAng)*Math.min(1,dt*4); break;
    case 'reel': { f.fly.t+=dt/0.8; const k=Math.min(1,f.fly.t); const sx=f.fly.sx, sy=f.fly.sy; f.fly.x=sx+(PEND.x-sx)*k; f.fly.y=sy+(PEND.y-sy)*k - Math.sin(k*Math.PI)*60; st.rodAng+=(-1.6-st.rodAng)*Math.min(1,dt*8); st.rodBend=0;
      if(Math.random()<0.6) S.addP({x:f.fly.x,y:f.fly.y,vx:rand(-10,10),vy:rand(-10,10),life:0.5,max:0.5,col:'#fff6c0',fade:true});
      if(k>=1){ st.pending=f.piece; f.state='idle'; f.bob=null; f.piece=null; f.fly=null; } break; }
  }
}
function resetLine(){ const f=st.fishing; if(!f) return; f.state='idle'; f.bob=null; f.fish=null; f.approach=null; f.biteDip=0; st.rodBend=0; }

/* ------------------------------------------------------------------ */
/* Quiz                                                                 */
/* ------------------------------------------------------------------ */
const recentQ=[];
function pickQuestion(star){
  const rule=D.STAR_RULES[star]; let wantTF=false, lv=[1];
  switch(rule.type){ case 'tf': wantTF=true; break; case 'mix': wantTF=Math.random()<0.5; lv=[1]; break; case 'mc12': lv=Math.random()<0.4?[1]:[2]; break; case 'mc23': lv=Math.random()<0.5?[2]:[3]; break; case 'mc3': lv=Math.random()<0.8?[3]:[2]; break; }
  let pool=QUESTIONS.map((q,i)=>({q,i})).filter(o=> wantTF ? o.q.tf!==undefined : (o.q.c && lv.includes(o.q.lv)));
  let fresh=pool.filter(o=>!recentQ.includes(o.i)); if(!fresh.length) fresh=pool;
  const pick=fresh[Math.floor(Math.random()*fresh.length)]; recentQ.push(pick.i); if(recentQ.length>40) recentQ.shift(); return pick.q;
}
function startQuiz(fish){
  const rule=D.STAR_RULES[fish.star]; let n=rule.n; if(fish.star>=3) n=Math.max(Math.ceil(rule.n/2), rule.n-st.upg.book);
  st.quiz={fish, n, got:0, gauge:1, drain:(1/rule.sec)*(1-0.12*st.upg.rod), pen:rule.pen*(1-0.15*st.upg.line), locked:false, q:null, done:false};
  $('qTitle').textContent='ปลาติดเบ็ด!'; $('qStars').textContent=stars(fish.star); $('qStars').style.color=I.STAR_COL[fish.star];
  drawQuizFish(fish,true); openModal('quiz'); nextQuestion();
}
function drawQuizFish(fish,sil){ const c=$('qFish').getContext('2d'); c.imageSmoothingEnabled=false; c.clearRect(0,0,96,64);
  const img = sil ? G.fishTint(fish.id,'#0a0810') : G.fish(fish.id); const fit=Math.min(88/img.width,58/img.height); const sc=fit>=2?2:(fit>=1?1:fit);
  const w=img.width*sc, h=img.height*sc; c.drawImage(img,Math.round((96-w)/2),Math.round((64-h)/2),Math.round(w),Math.round(h));
  if(sil){ c.fillStyle='#ffe070'; c.font='bold 20px "Pixelify Sans"'; c.textAlign='center'; c.fillText('?',48,40); } }
function nextQuestion(){
  const Q=st.quiz; Q.q=pickQuestion(Q.fish.star); Q.locked=false; const q=Q.q;
  $('qText').textContent=q.q; $('qExp').innerHTML=''; $('qProg').textContent='ตอบถูก '+'●'.repeat(Q.got)+'○'.repeat(Q.n-Q.got);
  const box=$('qAns'); box.innerHTML='';
  if(q.tf!==undefined){ box.className='qans tf'; Q.opts=[{t:'✔ ถูก',ok:q.tf===true,cls:'t'},{t:'✘ ผิด',ok:q.tf===false,cls:'f'}]; }
  else { box.className='qans'; const o=q.c.map((t,i)=>({t,ok:i===0})); for(let i=o.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [o[i],o[j]]=[o[j],o[i]]; } Q.opts=o; }
  Q.opts.forEach((o,i)=>{ const b=document.createElement('button'); b.className='ans '+(o.cls||''); b.innerHTML=(q.tf===undefined?`<span class="k">${'ABCD'[i]}</span>`:'')+escapeHtml(o.t); b.addEventListener('click',()=>answer(i)); box.appendChild(b); o.el=b; });
}
function escapeHtml(s){ return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function answer(i){ const Q=st.quiz; if(!Q||Q.locked||Q.done) return; Q.locked=true; const o=Q.opts[i];
  Q.opts.forEach(x=>{ if(x.ok) x.el.classList.add('right'); else if(x!==o) x.el.classList.add('dim'); });
  let delay;
  if(o.ok){ Q.got++; st.stats.correct++; Q.gauge=Math.min(1,Q.gauge+0.12); A.sfx('correct'); $('qExp').innerHTML=`<b>ถูกต้อง!</b> ${escapeHtml(Q.q.e||'')}`; delay=1400; }
  else { o.el.classList.add('wrong'); st.stats.wrong++; Q.gauge-=Q.pen; A.sfx('wrong'); vib(120); $('quiz').querySelector('.qbox').classList.remove('shake'); void $('quiz').offsetWidth; $('quiz').querySelector('.qbox').classList.add('shake');
    $('qExp').innerHTML=`<b class="no">ผิด!</b> ${escapeHtml(Q.q.e||'')}`; delay=2600; }
  $('qProg').textContent='ตอบถูก '+'●'.repeat(Q.got)+'○'.repeat(Q.n-Q.got);
  $('qExp').innerHTML+=`<span class="cont">แตะเพื่อไปต่อ</span>`;
  const go=()=>{ if(Q.adv || st.quiz!==Q) return; Q.adv=true; clearTimeout(Q.timer); $('quiz').removeEventListener('pointerdown',skip);
    if(Q.gauge<=0) quizFail(); else if(Q.got>=Q.n) quizWin(); else { Q.adv=false; nextQuestion(); } };
  const skip=(e)=>{ if(e.target.closest('.ans')) return; go(); };
  Q.adv=false; Q.timer=setTimeout(go,delay); setTimeout(()=>$('quiz').addEventListener('pointerdown',skip),250);
  save();
}
function updateQuiz(dt){ const Q=st.quiz; if(!Q||Q.done) return;
  if(!Q.locked){ Q.gauge-=Q.drain*dt; if(Q.gauge<=0){ Q.gauge=0; Q.locked=true; quizFail(); } else if(Q.gauge<0.25 && Math.floor(Q.gauge*40)!==Q.lastTick){ Q.lastTick=Math.floor(Q.gauge*40); A.sfx('tick'); } }
  const g=Math.max(0,Q.gauge); const el=$('qGauge'); el.style.width=`calc(${g*100}% - 6px)`; el.className=g<0.3?'low':(g<0.6?'mid':'');
  const fi=$('qFishIcon'); fi.style.left=`calc(${g*100}% - 6px)`; fi.style.marginTop=(Math.sin(performance.now()/((g<0.3)?40:90))*3)+'px'; }
function quizFail(){ const Q=st.quiz; Q.done=true; A.sfx('escape'); $('qText').innerHTML='<div class="qreveal">ปลาดิ้นหลุดไปแล้ว...<small>ลองใหม่อีกครั้ง!</small></div>'; $('qAns').innerHTML='';
  setTimeout(()=>{ closeModal('quiz'); st.quiz=null; resetLine(); toast(`${stars(Q.fish.star)} ปลาหนีไปได้`,'bad'); },1300); }
function quizWin(){ const Q=st.quiz; Q.done=true; const fish=Q.fish; A.sfx('catch'); vib([40,40,80]);
  const z=D.ZONES[st.zoneIdx]; const v=Math.round(fish.val*z.mul*rand(0.9,1.15));
  drawQuizFish(fish,false); $('qTitle').textContent='จับได้แล้ว!';
  $('qText').innerHTML=`<div class="qreveal">${fish.name} <span style="color:${I.STAR_COL[fish.star]}">${stars(fish.star)}</span><small>${fish.en} · มูลค่า ${v} G</small></div>`; $('qAns').innerHTML=''; $('qExp').innerHTML='';
  st.stats.caught++; st.stats.dex[fish.id]=(st.stats.dex[fish.id]||0)+1; const isNew=st.stats.dex[fish.id]===1;
  setTimeout(()=>{ closeModal('quiz'); st.quiz=null; const f=st.fishing; if(!f) return;
    f.piece={f:fish.id,rot:0,v,gx:0,gy:0}; f.state='reel'; f.approach=null; f.fly={t:0,sx:f.bob?f.bob.x:400,sy:S.WATER,x:0,y:0};
    if(isNew) toast('✦ ปลาชนิดใหม่! บันทึกลงสมุดปลา','gold'); save(); },1500); }

/* ------------------------------------------------------------------ */
/* Sea events & HP                                                      */
/* ------------------------------------------------------------------ */
function startEvent(){ const z=D.ZONES[st.zoneIdx]; const pool=D.EVENTS.filter(e=>e.minZone<=st.zoneIdx); const def=pool[Math.floor(Math.random()*pool.length)];
  st.event={id:def.id,def,left:def.dur,dur:def.dur,tick:def.tick||0};
  $('evName').textContent=def.name; $('evTip').textContent=def.tip; const b=$('eventBanner'); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  A.sfx('alarm'); vib([60,60,60]);
  if(def.id==='storm'){ S.waveAmp=2; A.setStorm(true); }
  markNeeded(); }
function endEvent(cured){ const e=st.event; if(!e) return; st.event=null; $('eventBanner').classList.remove('on');
  const z=D.ZONES[st.zoneIdx]; st.nextEvent=rand(z.ev[0],z.ev[1]);
  if(e.id==='storm' && z.theme!=='storm'){ S.waveAmp=1; A.setStorm(false); }
  if(!cured){ if(e.def.hit){ hurt(e.def.hit*z.dmg); toast(e.id==='shark'?'ฉลามงับเรือ!':'หนวดปีศาจฟาดเรือ!','bad'); } else toast(e.id==='storm'?'พายุสงบลงแล้ว':(e.id==='cold'?'หมอกจางหายไป':'ฝูงแมงกะพรุนว่ายจากไป')); }
  markNeeded(); }
function hurt(n){ st.hp-=n; st.redFlash=0.55; st.shake=4; A.sfx('hurt'); vib(150); floatText('-'+Math.round(n),75,248,'#ff6a5a'); }
function updateSea(dt,t){
  const z=D.ZONES[st.zoneIdx]; let drain=z.drain;
  if(st.event){ const e=st.event; e.left-=dt; if(e.def.drain) drain+=e.def.drain*z.dmg;
    if(e.def.tick){ e.tick-=dt; if(e.tick<=0){ e.tick=e.def.tick; hurt(e.def.tickDmg*z.dmg); st.flash=0.35; } }
    if(e.id==='shark' && e.left<1.2 && !e.warned){ e.warned=true; A.sfx('alarm'); }
    if(e.left<=0) endEvent(false); }
  else if(!st.quiz){ st.nextEvent-=dt; if(st.nextEvent<=0) startEvent(); }
  if(st.quiz) drain*=0.5;
  st.hp-=drain*dt;
  // lightning
  const stormy = st.theme==='storm' || (st.event&&st.event.id==='storm');
  if(stormy && Math.random()<dt*0.12){ st.flash=0.9; setTimeout(()=>A.sfx('thunder'),300+Math.random()*600); }
  // low hp beep
  if(st.hp/maxHp()<0.25){ st.lowBeep=(st.lowBeep||0)-dt; if(st.lowBeep<=0){ st.lowBeep=2.2; A.sfx('deny'); } }
  if(st.hp<=0){ st.hp=0; die(); }
}
function die(){ if(st.dying) return; st.dying=true; const n=st.inv.pieces.length+(st.pending?1:0), val=st.inv.value()+(st.pending?st.pending.v:0);
  A.sfx('death'); closeModal('quiz'); st.quiz=null; st.fishing=null; st.event=null; $('eventBanner').classList.remove('on');
  message('หมดสติกลางทะเล...',`<div class="c">ชาวประมงช่วยลากคุณกลับมาที่ท่าเรือ<br>แต่ปลาในกระเป๋า <b>${n} ตัว</b> (มูลค่า <b style="color:#ffd860">${val} G</b>) สูญหายทั้งหมด<br><br><small style="color:#a8987a">เคล็ดลับ: ซื้อไอเท็มฟื้น HP และกลับท่าเรือก่อน HP หมด</small></div>`,
    [['ฟื้นที่ท่าเรือ','go',()=>{ st.inv.pieces=[]; st.pending=null; transition(()=>{ st.dying=false; goDock(); },0.6); }]]); }

/* ------------------------------------------------------------------ */
/* Dex                                                                  */
/* ------------------------------------------------------------------ */
function openDex(){ const g=$('dexGrid'); g.innerHTML=''; let got=0;
  D.FISH.forEach(f=>{ const n=st.stats.dex[f.id]||0; if(n) got++; const d=document.createElement('div'); d.className='dx';
    const c=G.canvas(112,64); const img=n?G.fish(f.id):G.fishTint(f.id,'#1a1418'); const sc=Math.min(1,104/img.width,60/img.height); c.ctx.drawImage(img,Math.round((112-img.width*sc)/2),Math.round((64-img.height*sc)/2),Math.round(img.width*sc),Math.round(img.height*sc));
    d.appendChild(c); d.insertAdjacentHTML('beforeend',`<div>${n?f.name:'???'}</div><div class="s" style="color:${I.STAR_COL[f.star]}">${stars(f.star)}</div><div class="n">${n?('จับได้ '+n+' ตัว · '+f.val+'G'):'ยังไม่พบ'}</div>`); g.appendChild(d); });
  $('dexCount').textContent=`(${got}/${D.FISH.length})`; openModal('dexModal'); }

/* ------------------------------------------------------------------ */
/* Input: drag & drop fish, casting                                     */
/* ------------------------------------------------------------------ */
const pointers=new Set();
function anyModal(){ return document.querySelector('.modal.on') || st.scene==='title' || st.trans; }
function pendingRect(){ if(!st.pending) return null; const m=G.mask(st.pending.f,st.pending.rot); const x=Math.round(PEND.x-m.w*C/2), y=Math.round(PEND.y-m.h*C/2); return {x,y,m}; }
function hitPiece(m,x,y,lx,ly){ const c=Math.floor((lx-x)/C), r=Math.floor((ly-y)/C); return m.cells.some(([a,b])=>a===c&&b===r); }
function inDrop(lx,ly){ return lx>=218&&lx<=326&&ly>=210&&ly<=256; }
function rotateDrag(){ const d=st.drag; if(!d) return; d.piece.rot=(d.piece.rot+1)%4; const m=G.mask(d.piece.f,d.piece.rot); d.ox=m.w*C/2; d.oy=m.h*C/2; A.sfx('rotate'); updateDragTarget(); }
function updateDragTarget(){ const d=st.drag; const tx=d.x-d.ox, ty=d.y-d.oy; const m=G.mask(d.piece.f,d.piece.rot);
  const gx=Math.round((tx-I.GX)/C), gy=Math.round((ty-I.GY)/C);
  if(tx+m.w*C>I.GX && tx<I.GX+I.COLS*C && ty+m.h*C>I.GY && ty<I.GY+I.ROWS*C){ d.gx=gx; d.gy=gy; d.ok=st.inv.canPlace(d.piece,gx,gy,d.piece.rot,d.from==='grid'?d.piece:null); } else { d.gx=null; d.ok=false; }
  $('dropZone').classList.toggle('hot', d.gx==null && inDrop(d.x,d.y)); }
function selectPiece(p){ st.selected=p; if(p){ const f=D.FISH_BY_ID[p.f]; showTip(`<b>${f.name}</b> <span class="st" style="color:${I.STAR_COL[f.star]}">${stars(f.star)}</span> · ${p.v} G`); } else hideTip(); }

cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{
  A.init(); pointers.add(e.pointerId);
  if(anyModal()) return;
  const {x:lx,y:ly}=toLogical(e);
  if(st.drag && st.drag.active){ if(pointers.size>1||e.button===2) rotateDrag(); return; }
  if(e.button===2){ // right-click rotate in place
    const cell=I.cellAt(lx,ly); const p=cell&&st.inv.pieceAt(cell.c,cell.r); if(p) rotateInPlace(p); return; }
  cv.setPointerCapture(e.pointerId);
  const pr=pendingRect();
  if(pr && hitPiece(pr.m,pr.x,pr.y,lx,ly)){ st.drag={piece:st.pending,from:'pending',ox:lx-pr.x,oy:ly-pr.y,x:lx,y:ly,sx:lx,sy:ly,active:false,pid:e.pointerId}; return; }
  const cell=I.cellAt(lx,ly);
  if(cell){ const p=st.inv.pieceAt(cell.c,cell.r); if(p){ st.drag={piece:p,from:'grid',ox:lx-(I.GX+p.gx*C),oy:ly-(I.GY+p.gy*C),x:lx,y:ly,sx:lx,sy:ly,active:false,orig:{gx:p.gx,gy:p.gy,rot:p.rot},pid:e.pointerId}; return; } }
  if(I.inPanel(lx,ly)){ selectPiece(null); return; }
  selectPiece(null);
  if(st.scene==='sea' && st.fishing){ const f=st.fishing; if(f.state==='idle'){ startCharge(); st.chargePid=e.pointerId; } else hook(); }
});
cv.addEventListener('pointermove',e=>{ const d=st.drag; if(!d||d.pid!==e.pointerId) return; const {x,y}=toLogical(e); d.x=x; d.y=y;
  if(!d.active && Math.hypot(x-d.sx,y-d.sy)>3){ d.active=true; A.sfx('pick'); selectPiece(d.piece); }
  if(d.active) updateDragTarget(); });
function endPointer(e){ pointers.delete(e.pointerId);
  if(st.chargePid===e.pointerId){ st.chargePid=null; releaseCast(); }
  const d=st.drag; if(!d||d.pid!==e.pointerId) return; st.drag=null; $('dropZone').classList.remove('hot');
  if(!d.active){ // tap
    if(d.from==='pending'){ if(st.inv.autoPlace(st.pending)){ st.pending=null; A.sfx('place'); save(); } else { toast('กระเป๋าเต็ม! ลากไปทิ้งหรือจัดใหม่','bad'); A.sfx('deny'); } }
    else { if(st.selected===d.piece) rotateInPlace(d.piece); selectPiece(d.piece); }
    return; }
  if(d.gx!=null && d.ok){ d.piece.gx=d.gx; d.piece.gy=d.gy; if(d.from==='pending'){ st.inv.add(d.piece); st.pending=null; } A.sfx('place'); save(); return; }
  if(inDrop(d.x,d.y)){ if(st.scene==='dock'){ sellPiece(d.piece,d.from); } else { trashPiece(d.piece,d.from); } return; }
  // revert
  if(d.from==='grid'){ Object.assign(d.piece,d.orig); } else { d.piece.rot=d.piece.rot; }
  A.sfx('deny');
}
cv.addEventListener('pointerup',endPointer); cv.addEventListener('pointercancel',endPointer);
function rotateInPlace(p){ const m0=G.mask(p.f,p.rot);
  for(let k=1;k<4;k++){ const r=(p.rot+k)%4, m=G.mask(p.f,r); const cx=p.gx+m0.w/2, cy=p.gy+m0.h/2;
    const cands=[[p.gx,p.gy],[Math.round(cx-m.w/2),Math.round(cy-m.h/2)],[p.gx-1,p.gy],[p.gx,p.gy-1],[p.gx-1,p.gy-1],[p.gx+1,p.gy],[p.gx,p.gy+1]];
    for(const [gx,gy] of cands) if(st.inv.canPlace(p,gx,gy,r,p)){ p.rot=r; p.gx=gx; p.gy=gy; A.sfx('rotate'); save(); return true; } }
  A.sfx('deny'); toast('ไม่มีที่ว่างให้หมุน','bad'); return false; }
function sellPiece(p,from){ if(from==='grid') st.inv.remove(p); else st.pending=null; st.coins+=p.v; st.stats.earned+=p.v; A.sfx('coin'); floatText('+'+p.v+' G',272,206,'#ffd860'); selectPiece(null); save(); }
function trashPiece(p,from){ if(from==='grid') st.inv.remove(p); else st.pending=null; A.sfx('trash'); toast(`ทิ้ง ${D.FISH_BY_ID[p.f].name} แล้ว`); selectPiece(null); save(); }
function sellAll(){ const v=st.inv.value(); if(!v) return; const n=st.inv.pieces.length; st.inv.pieces=[]; st.coins+=v; st.stats.earned+=v; A.sfx('coin'); setTimeout(()=>A.sfx('coin'),120);
  floatText('+'+v+' G',272,190,'#ffd860'); toast(`ขายปลา ${n} ตัว ได้ ${v} G`,'gold'); for(let i=0;i<20;i++) S.addP({x:280,y:150,vx:rand(-50,50),vy:rand(-90,-30),g:180,life:1,max:1,col:i%2?'#ffd860':'#fff2b0'}); selectPiece(null); save(); }

window.addEventListener('keydown',e=>{
  if(e.repeat) return; A.init();
  if(st.quiz && !st.quiz.locked){ const k=e.key.toLowerCase(); const map={'1':0,'2':1,'3':2,'4':3,a:0,b:1,c:2,d:3,t:0,f:1}; if(map[k]!==undefined && map[k]<st.quiz.opts.length){ answer(map[k]); return; } }
  if(e.key==='r'||e.key==='R'){ if(st.drag&&st.drag.active) rotateDrag(); else if(st.selected) rotateInPlace(st.selected); }
  if(e.code==='Space' && !anyModal() && st.scene==='sea' && st.fishing){ e.preventDefault(); const f=st.fishing; if(f.state==='idle'){ startCharge(); st.spaceCharge=true; } else hook(); }
});
window.addEventListener('keyup',e=>{ if(e.code==='Space' && st.spaceCharge){ st.spaceCharge=false; releaseCast(); } });

/* buttons */
$('btnSail').addEventListener('click',()=>{ A.init(); A.sfx('click'); openMap(); });
$('btnExtract').addEventListener('click',()=>{ A.init(); A.sfx('click'); if(st.quiz) return; transition(()=>goDock('extract'),0.6); });
$('btnSellAll').addEventListener('click',()=>{ A.init(); sellAll(); });
$('btnDex').addEventListener('click',()=>{ A.init(); A.sfx('click'); openDex(); });
$('btnHelp').addEventListener('click',()=>{ A.init(); A.sfx('click'); howTo(); });
$('btnHow').addEventListener('click',()=>{ A.init(); A.sfx('click'); howTo(); });
$('vol').addEventListener('input',e=>{ A.init(); A.setVolume(+e.target.value); try{ localStorage.setItem('awsfishing.vol',e.target.value);}catch(_){} });
$('btnFull').addEventListener('click',()=>{ A.init(); const el=document.documentElement; if(!document.fullscreenElement){ (el.requestFullscreen||el.webkitRequestFullscreen||(()=>{})).call(el); try{ screen.orientation.lock('landscape').catch(()=>{}); }catch(e){} } else document.exitFullscreen&&document.exitFullscreen(); });
$('btnNew').addEventListener('click',()=>{ A.init(); A.sfx('click');
  const start=()=>{ try{ localStorage.removeItem(SAVE_KEY);}catch(e){} st.coins=40; st.upg={hp:0,storage:0,rod:0,line:0,book:0,boat:0}; st.items={bandage:2,tea:0,can:0,raincoat:0,flare:0}; st.stats={caught:0,correct:0,wrong:0,earned:0,dex:{}}; st.casts=0; st.inv=new I.Inventory(); st.pending=null;
    $('title').classList.remove('on'); transition(()=>{ goDock(); setTimeout(howTo,300); },0.5); };
  if(hasSave()) message('เริ่มเกมใหม่?','<div class="c">ข้อมูลที่บันทึกไว้จะถูกลบทั้งหมด</div>',[['ยกเลิก',''],['เริ่มใหม่','back',start]]); else start(); });
$('btnContinue').addEventListener('click',()=>{ A.init(); A.sfx('click'); load(); $('title').classList.remove('on'); transition(()=>goDock(),0.5); });
document.addEventListener('pointerdown',()=>A.init(),{once:true});
document.addEventListener('touchmove',e=>{ if(e.target.closest && e.target.closest('#dexGrid')) return; e.preventDefault(); },{passive:false});

/* ------------------------------------------------------------------ */
/* Main loop                                                            */
/* ------------------------------------------------------------------ */
let last=performance.now(), T=0;
function update(dt){
  st.shake=Math.max(0,st.shake-dt*10); st.flash=Math.max(0,st.flash-dt*2.5); st.redFlash=Math.max(0,st.redFlash-dt*1.6);
  if(st.trans){ const tr=st.trans; tr.t+=dt; if(tr.phase==='out'){ st.fade=Math.min(1,tr.t/tr.dur); if(tr.t>=tr.dur){ tr.mid&&tr.mid(); tr.phase='in'; tr.t=0; } } else { st.fade=Math.max(0,1-tr.t/tr.dur); if(tr.t>=tr.dur){ st.trans=null; st.fade=0; } } }
  if(st.scene==='sea' && !st.dying){ updateFishing(dt,T); updateQuiz(dt); if(!st.trans || st.trans.phase==='in') updateSea(dt,T); }
  updateHud();
}
function render(dt){
  S.render(ctx,st,T,dt);
  fxc.clearRect(0,0,480,270);
  const f=st.fishing;
  if(st.scene==='sea' && f && st.boatPos){ const bp=st.boatPos;
    if(f.state==='charge'){ const x=bp.x+34, y=bp.y-50; G.rect(ctx,x-1,y-1,34,7,'#0e0a08'); G.rect(ctx,x,y,32,5,'#2a2024'); const w=Math.round(30*f.power); G.rect(ctx,x+1,y+1,w,3, f.power>0.85?'#ffe066':(f.power>0.5?'#8ae06a':'#5ab0e8')); G.rect(ctx,x+1,y+1,w,1,'#ffffff'); }
    if(f.state==='bite'){ const x=bp.x+46, y=bp.y-44+Math.round(Math.sin(T*20)*2); G.rect(ctx,x-1,y-1,6,12,'#0e0a08'); G.rect(ctx,x,y,4,7,'#ffd23a'); G.rect(ctx,x,y+8,4,2,'#ffd23a'); G.rect(ctx,x,y,1,7,'#fff6c0'); }
    if(f.state==='reel' && f.fly){ const p=f.piece; const m=G.mask(p.f,0); G.drawFish(fxc,p.f,0,f.fly.x-m.w*C/2,f.fly.y-m.h*C/2); }
  }
  if(st.scene!=='title') I.draw(ctx,st,T);
  // pending fish
  const pl=$('pendLabel');
  if(st.pending && !(st.drag&&st.drag.active&&st.drag.from==='pending')){ const pr=pendingRect(); const bob=Math.round(Math.sin(T*2.5)*2);
    ctx.globalAlpha=0.25+Math.sin(T*3)*0.1; ctx.fillStyle='#fff3c0'; ctx.beginPath(); ctx.ellipse(PEND.x,PEND.y+bob,pr.m.w*C/2+8,pr.m.h*C/2+8,0,0,7); ctx.fill(); ctx.globalAlpha=1;
    I.drawFloating(ctx,st.pending,pr.x,pr.y+bob,T,false);
    pl.style.display='block'; pl.style.left=(PEND.x*2)+'px'; pl.style.top=((pr.y+pr.m.h*C+10)*2)+'px'; }
  else pl.style.display='none';
  // dragged
  const d=st.drag; if(d&&d.active){ I.drawFloating(fxc,d.piece,Math.round(d.x-d.ox),Math.round(d.y-d.oy),T,true); }
  S.fade(ctx,st.fade);
  drawPortrait(T);
}
// debug/test helper: advance the simulation manually (used for automated testing)
window.__step=function(n,dt){ dt=dt||1/60; for(let i=0;i<(n||1);i++){ T+=dt; update(dt); } render(dt); };
function frame(now){ const dt=Math.min(0.05,(now-last)/1000); last=now; T+=dt; try{ update(dt); render(dt); }catch(err){ console.error(err); } requestAnimationFrame(frame); }

/* ------------------------------------------------------------------ */
/* Boot                                                                 */
/* ------------------------------------------------------------------ */
buildFrames(); setIcons(); buildDock();
try{ const l=document.createElement('link'); l.rel='icon'; l.href=G.spriteCanvas(G.ICONS.rod.r,G.ICONS.rod.p,4).toDataURL(); document.head.appendChild(l); }catch(e){}
try{ const v=localStorage.getItem('awsfishing.vol'); if(v!==null){ $('vol').value=v; A.vol=+v; } }catch(e){}
st.inv.setLevel(0); st.hp=maxHp();
setSceneClass(); stage.classList.add('scene-title');
$('btnContinue').style.display = hasSave()?'':'none';
$('title').classList.add('on');
['shopPanel','upgPanel'].forEach(id=>$(id).addEventListener('pointerleave',hideTip));
requestAnimationFrame(frame);
})();
