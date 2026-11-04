/* =========================================================
   Procedural audio (WebAudio) — SFX, ocean ambience, music
   ========================================================= */
(function(){
const A = window.AUDIO = { vol:0.6, ready:false };
let ac, master, sfxBus, musBus, ambGain, noiseBuf, musTimer, nextNote=0, step=0;

A.init = function(){
  if(A.ready) { if(ac.state==='suspended') ac.resume(); return; }
  try{ ac = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
  master = ac.createGain(); master.gain.value = A.vol; master.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  musBus = ac.createGain(); musBus.gain.value = 0.32; musBus.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate*2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  A.ready = true;
  startAmbience(); startMusic();
};
A.setVolume = function(v){ A.vol=v; if(master) master.gain.setTargetAtTime(v, ac.currentTime, 0.05); };

function env(g,t,a,d,peak){ g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(peak,t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+a+d); }
function tone(type,f0,f1,dur,vol,t,dest){ t=t||ac.currentTime; const o=ac.createOscillator(), g=ac.createGain(); o.type=type; o.frequency.setValueAtTime(f0,t); if(f1) o.frequency.exponentialRampToValueAtTime(f1,t+dur); env(g,t,0.005,dur,vol); o.connect(g); g.connect(dest||sfxBus); o.start(t); o.stop(t+dur+0.05); }
function noise(dur,vol,freq,q,type,t,f1){ t=t||ac.currentTime; const s=ac.createBufferSource(); s.buffer=noiseBuf; const f=ac.createBiquadFilter(); f.type=type||'lowpass'; f.frequency.setValueAtTime(freq,t); if(f1) f.frequency.exponentialRampToValueAtTime(f1,t+dur); f.Q.value=q||1; const g=ac.createGain(); env(g,t,0.01,dur,vol); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t+dur+0.1); }

A.sfx = function(name){
  if(!A.ready) return; const t=ac.currentTime;
  switch(name){
    case 'click': tone('square',880,660,0.04,0.08); break;
    case 'hover': tone('square',1200,null,0.02,0.03); break;
    case 'cast': noise(0.35,0.25,600,2,'bandpass',t,2400); tone('triangle',300,900,0.25,0.06); break;
    case 'splash': noise(0.45,0.5,1800,0.8,'lowpass',t,300); tone('sine',220,90,0.2,0.15); break;
    case 'bite': tone('square',660,null,0.07,0.15); tone('square',990,null,0.09,0.15,t+0.09); break;
    case 'reel': for(let i=0;i<6;i++) tone('square',400+i*60,null,0.03,0.05,t+i*0.05); break;
    case 'correct': [523,659,784,1047].forEach((f,i)=>tone('square',f,null,0.1,0.11,t+i*0.07)); break;
    case 'wrong': tone('sawtooth',220,110,0.35,0.14); tone('square',180,90,0.3,0.08,t+0.05); break;
    case 'catch': [392,523,659,784,1047,1319].forEach((f,i)=>tone('square',f,null,0.12,0.1,t+i*0.08)); tone('triangle',1568,null,0.5,0.1,t+0.5); break;
    case 'escape': tone('triangle',700,120,0.6,0.15); noise(0.4,0.3,1200,1,'lowpass',t+0.1,300); break;
    case 'coin': tone('square',988,null,0.06,0.1); tone('square',1319,null,0.16,0.1,t+0.06); break;
    case 'buy': tone('square',660,null,0.06,0.1); tone('square',880,null,0.06,0.1,t+0.06); tone('square',1320,null,0.14,0.1,t+0.12); break;
    case 'deny': tone('square',200,null,0.08,0.1); tone('square',150,null,0.12,0.1,t+0.09); break;
    case 'place': tone('triangle',180,120,0.08,0.2); noise(0.06,0.15,900,1); break;
    case 'pick': tone('triangle',300,500,0.06,0.12); break;
    case 'rotate': tone('square',500,700,0.05,0.07); break;
    case 'trash': noise(0.25,0.3,500,1,'lowpass',t,150); tone('sine',160,60,0.2,0.2); break;
    case 'hurt': noise(0.2,0.45,900,1,'lowpass',t,120); tone('square',140,70,0.18,0.14); break;
    case 'heal': [440,554,659,880].forEach((f,i)=>tone('triangle',f,null,0.12,0.1,t+i*0.06)); break;
    case 'thunder': noise(2.2,0.7,400,0.7,'lowpass',t,60); break;
    case 'alarm': for(let i=0;i<3;i++){ tone('square',880,null,0.08,0.09,t+i*0.18); tone('square',660,null,0.08,0.09,t+i*0.18+0.09);} break;
    case 'flare': noise(0.8,0.35,3000,0.5,'highpass',t,800); tone('sawtooth',200,1200,0.4,0.06); break;
    case 'tick': tone('square',1400,null,0.02,0.04); break;
    case 'sail': noise(1.2,0.25,500,1,'lowpass',t,1500); tone('triangle',196,null,0.3,0.08,t); tone('triangle',262,null,0.4,0.08,t+0.25); break;
    case 'death': [392,349,311,262,196].forEach((f,i)=>tone('triangle',f,null,0.25,0.12,t+i*0.18)); break;
    case 'levelup': [523,659,784,1047,784,1047,1319].forEach((f,i)=>tone('square',f,null,0.08,0.09,t+i*0.06)); break;
  }
};

function startAmbience(){
  const s=ac.createBufferSource(); s.buffer=noiseBuf; s.loop=true;
  const f=ac.createBiquadFilter(); f.type='lowpass'; f.frequency.value=500;
  ambGain=ac.createGain(); ambGain.gain.value=0.06;
  const lfo=ac.createOscillator(), lg=ac.createGain(); lfo.frequency.value=0.12; lg.gain.value=0.04; lfo.connect(lg); lg.connect(ambGain.gain); lfo.start();
  const lfo2=ac.createOscillator(), lg2=ac.createGain(); lfo2.frequency.value=0.07; lg2.gain.value=250; lfo2.connect(lg2); lg2.connect(f.frequency); lfo2.start();
  s.connect(f); f.connect(ambGain); ambGain.connect(master); s.start();
}
A.setStorm = function(on){ if(ambGain) ambGain.gain.setTargetAtTime(on?0.16:0.06, ac.currentTime, 0.8); };

/* gentle melancholic sea-shanty-ish loop */
const ROOT = { A:220, F:174.61, C:130.81*2, G:196, D:146.83*2, E:164.81 };
const PROG = [['A',[0,3,7]],['F',[0,4,7]],['C',[0,4,7]],['G',[0,4,7]],['A',[0,3,7]],['F',[0,4,7]],['D',[0,3,7]],['E',[0,4,7]]];
const MEL = [12,null,15,null,19,17,15,null, 12,null,16,null,19,null,17,16, 12,null,16,19,24,null,19,16, 14,null,17,null,19,null,null,null,
             12,null,15,17,19,null,17,15, 12,null,16,null,12,null,9,null, 10,null,14,null,17,null,15,14, 11,null,14,null,16,null,null,null];
function semis(f,s){ return f*Math.pow(2,s/12); }
function startMusic(){
  const bpm=76, sp=60/bpm/2; nextNote=ac.currentTime+0.3;
  musTimer=setInterval(()=>{
    while(nextNote < ac.currentTime+0.4){
      const bar=Math.floor(step/8)%8, [rn,ch]=PROG[bar], root=ROOT[rn];
      if(step%8===0){ ch.forEach(s=>{ const o=ac.createOscillator(), g=ac.createGain(); o.type='triangle'; o.frequency.value=semis(root/2,s); g.gain.setValueAtTime(0.0001,nextNote); g.gain.linearRampToValueAtTime(0.05,nextNote+0.4); g.gain.linearRampToValueAtTime(0.0001,nextNote+sp*8); o.connect(g); g.connect(musBus); o.start(nextNote); o.stop(nextNote+sp*8+0.1); });
        tone('sine',root/4,null,sp*6,0.12,nextNote,musBus); }
      if(step%2===1){ const s=ch[(step>>1)%3]; tone('triangle',semis(root,s+12),null,0.18,0.025,nextNote,musBus); }
      const m=MEL[step%64]; if(m!==null && m!==undefined) tone('square',semis(220,m-12+12),null,sp*1.6,0.022,nextNote,musBus);
      nextNote+=sp; step++;
    }
  },100);
}
})();
