/* =========================================================
   Game data: fish, zones, upgrades, items, events
   ========================================================= */
(function(){
const D = window.DATA = {};

/* ---------- Fish ----------
   shape chars: T=tail  B=body  H=head  F=fin  S=snout/sword  L=lure  .=empty
   body: fish | round | eel | shark | deep
   pat : none | stripes | bands | spots | lateral | scales | gold
   z   : [minZone, maxZone]
*/
D.FISH = [
  // ★1
  { id:'anchovy',  name:'ปลากะตัก',      en:'Anchovy',      star:1, val:6,   z:[0,2], shape:['TH'],    body:'fish', pat:'lateral',
    col:{o:'#141826',d:'#3d5a78',b:'#7c9cb8',l:'#d6e2ea',f:'#6d8aa6',fd:'#465f7a',p:'#2c3f57'} },
  { id:'sardine',  name:'ปลาซาร์ดีน',    en:'Sardine',      star:1, val:9,   z:[0,2], shape:['TBH'],   body:'fish', pat:'spots',
    col:{o:'#141826',d:'#2f5f86',b:'#8fb3c9',l:'#e8eef0',f:'#7896ad',fd:'#4a6680',p:'#1f3d59'} },
  { id:'mackerel', name:'ปลาทู',         en:'Mackerel',     star:1, val:11,  z:[0,3], shape:['TBH'],   body:'fish', pat:'stripes',
    col:{o:'#131a1c',d:'#2c6a5e',b:'#6fae96',l:'#e4ece2',f:'#5d8c7c',fd:'#3a5f54',p:'#18403a'} },
  { id:'needle',   name:'ปลากระทุงเหว',  en:'Needlefish',   star:1, val:13,  z:[0,3], shape:['TBBS'],  body:'eel',  pat:'lateral',
    col:{o:'#121a20',d:'#3a7a8c',b:'#8cc6cf',l:'#e6f4f2',f:'#5f9aa6',fd:'#3d6b78',p:'#20505e'} },
  // ★2
  { id:'clown',    name:'ปลาการ์ตูน',     en:'Clownfish',    star:2, val:22,  z:[0,3], shape:['TBH'],   body:'deep', pat:'bands',
    col:{o:'#1c0f0c',d:'#c04a12',b:'#f2802a',l:'#ffb45a',f:'#e86a1e',fd:'#a63c0e',p:'#fbf4ea'} },
  { id:'puffer',   name:'ปลาปักเป้า',     en:'Pufferfish',   star:2, val:26,  z:[0,3], shape:['TBH','TBH'], body:'round', pat:'spots',
    col:{o:'#1d1a10',d:'#8a7a3a',b:'#d4bf6a',l:'#f6ecc4',f:'#b8a050',fd:'#7a6830',p:'#5a4a1e'} },
  { id:'snapper',  name:'ปลากะพงแดง',    en:'Red Snapper',  star:2, val:32,  z:[1,4], shape:['.F.','TBH','TBH'], body:'deep', pat:'scales',
    col:{o:'#200c10',d:'#9a2834',b:'#e05a5a',l:'#f6b0a0',f:'#c84048',fd:'#8a2430',p:'#b03a44'} },
  { id:'squidfish',name:'ปลาสลิดหิน',    en:'Damselfish',   star:2, val:24,  z:[0,3], shape:['.F.','TBH'], body:'deep', pat:'none',
    col:{o:'#0d1426',d:'#1f4fb0',b:'#3a86ea',l:'#9ad0ff',f:'#f2c230',fd:'#c09018',p:'#1a3a80'} },
  // ★3
  { id:'kingmack', name:'ปลาอินทรี',      en:'King Mackerel',star:3, val:48,  z:[1,4], shape:['TBBBH'], body:'fish', pat:'stripes',
    col:{o:'#11161e',d:'#33506e',b:'#8aa4bc',l:'#e8eef2',f:'#5a7590',fd:'#3a4f66',p:'#2a405a'} },
  { id:'parrot',   name:'ปลานกแก้ว',      en:'Parrotfish',   star:3, val:58,  z:[1,4], shape:['.FF.','TBBH','TBBH'], body:'deep', pat:'scales',
    col:{o:'#0c1a1a',d:'#1d8a7a',b:'#3fd0b0',l:'#b6f2d8',f:'#e85aa0',fd:'#a83a74',p:'#2aa890'} },
  { id:'moray',    name:'ปลาไหลมอเรย์',   en:'Moray Eel',    star:3, val:52,  z:[1,4], shape:['TBBBBH'], body:'eel', pat:'spots',
    col:{o:'#0f1408',d:'#4a5a1c',b:'#8a9a3a',l:'#c8d07a',f:'#6a7a2a',fd:'#3e4a14',p:'#2a3410'} },
  { id:'grouper',  name:'ปลาเก๋า',        en:'Grouper',      star:3, val:62,  z:[2,4], shape:['TBBH','TBBH'], body:'deep', pat:'spots',
    col:{o:'#1a120c',d:'#6a4a2a',b:'#a8784a',l:'#e2c49a',f:'#8a5e36',fd:'#5a3c1e',p:'#3e2a16'} },
  // ★4
  { id:'sword',    name:'ปลากระโทงดาบ',   en:'Swordfish',    star:4, val:95,  z:[2,4], shape:['..F...','TBBBHS'], body:'shark', pat:'none',
    col:{o:'#0c1020',d:'#26305a',b:'#5a6aa8',l:'#c8d0ea',f:'#3a4682',fd:'#222a56',p:'#1a2048'} },
  { id:'angler',   name:'ปลาตกเบ็ด',      en:'Anglerfish',   star:4, val:110, z:[3,4], shape:['..L','TBH','TBH'], body:'round', pat:'spots',
    col:{o:'#08060c',d:'#2a1e34',b:'#4a3a5a',l:'#7a6a86',f:'#3a2c48',fd:'#20162a',p:'#1a1222',gl:'#9affd8'} },
  { id:'tuna',     name:'ปลาทูน่าครีบน้ำเงิน', en:'Bluefin Tuna', star:4, val:120, z:[2,4], shape:['.FF.','TBBH','TBBH','..F.'], body:'fish', pat:'lateral',
    col:{o:'#0a1020',d:'#1a2c5a',b:'#3c5a9a',l:'#dce4f0',f:'#f2c63a',fd:'#b08a1a',p:'#9ab0d0'} },
  // ★5
  { id:'shark',    name:'ฉลามขาว',        en:'Great White',  star:5, val:210, z:[3,4], shape:['...F..','TBBBBH','TBBBBH'], body:'shark', pat:'none',
    col:{o:'#0e1216',d:'#4a5662',b:'#8696a4',l:'#eef0f0',f:'#5e6c78',fd:'#3a4650',p:'#2a343e'} },
  { id:'oarfish',  name:'พญานาคทะเล',     en:'Oarfish',      star:5, val:230, z:[3,4], shape:['FFFFFF.','TBBBBBH'], body:'eel', pat:'spots',
    col:{o:'#10101a',d:'#8a90a8',b:'#d4d8e8',l:'#f8f8ff',f:'#e8304a',fd:'#a01c30',p:'#6a7088'} },
  { id:'koi',      name:'ปลาทองราชันย์',  en:'Golden King',  star:5, val:260, z:[2,4], shape:['.F.','TBH','TBH'], body:'deep', pat:'gold',
    col:{o:'#2a1606',d:'#c07a10',b:'#f2b830',l:'#fff0a0',f:'#ffd860',fd:'#d09a20',p:'#fff6d0',gl:'#fff3a0'} },
  { id:'coela',    name:'ซีลาแคนท์',      en:'Coelacanth',   star:5, val:240, z:[3,4], shape:['.FF.','TBBH','TBBH','.FF.'], body:'fish', pat:'spots',
    col:{o:'#0a0e18',d:'#1e2c4e',b:'#34508a',l:'#6a86b8',f:'#2a3e6e',fd:'#18264a',p:'#d8e4f6'} },
];
D.FISH_BY_ID = {};
D.FISH.forEach(f => D.FISH_BY_ID[f.id] = f);

/* ---------- Quiz rules per star ---------- */
D.STAR_RULES = {
  1:{ n:1, sec:16, pen:0.22, type:'tf' },
  2:{ n:1, sec:15, pen:0.28, type:'mix' },
  3:{ n:2, sec:22, pen:0.30, type:'mc12' },
  4:{ n:3, sec:28, pen:0.34, type:'mc23' },
  5:{ n:4, sec:33, pen:0.38, type:'mc3' },
};

/* ---------- Zones ---------- */
D.ZONES = [
  { id:0, name:'อ่าวชายฝั่ง',      en:'Shallow Bay',  boat:0, drain:0.30, ev:[30,45], dmg:1.0, starW:[68,26,6,0,0],   mul:1.00, theme:'bay'   },
  { id:1, name:'แนวปะการัง',       en:'Coral Reef',   boat:1, drain:0.50, ev:[26,40], dmg:1.2, starW:[38,38,20,4,0],  mul:1.15, theme:'reef'  },
  { id:2, name:'ทะเลร้าง',         en:'Ruined Sea',   boat:2, drain:0.75, ev:[22,36], dmg:1.45, starW:[16,32,32,16,4], mul:1.30, theme:'ruins' },
  { id:3, name:'ร่องลึกรัตติกาล',  en:'Night Trench', boat:3, drain:1.05, ev:[20,32], dmg:1.7, starW:[4,18,34,30,14], mul:1.50, theme:'night' },
  { id:4, name:'มหาสมุทรพายุคลั่ง', en:'Storm Abyss',  boat:4, drain:1.40, ev:[16,28], dmg:2.0, starW:[0,8,30,36,26],  mul:1.80, theme:'storm' },
];

/* ---------- Upgrades ---------- */
D.UPGRADES = [
  { id:'hp',      name:'พลังชีวิต',   icon:'heart', max:5, cost:[40,85,150,240,360],  desc:l=>`HP สูงสุด +25 (ตอนนี้ ${100+25*l})` },
  { id:'storage', name:'กระเป๋า',     icon:'bag',   max:6, cost:[30,70,125,200,300,450], desc:l=>`เพิ่มช่องเก็บปลา (ตอนนี้ ${D.STORAGE[l]} ช่อง)` },
  { id:'rod',     name:'คันเบ็ด',     icon:'rod',   max:4, cost:[50,110,200,330],     desc:l=>`เกจหนีของปลาลดช้าลง (−${l*12}%)` },
  { id:'line',    name:'สายเบ็ด',     icon:'spool', max:4, cost:[45,100,180,300],     desc:l=>`ตอบผิดเกจลดน้อยลง (−${l*15}%)` },
  { id:'book',    name:'ตำราปราชญ์',  icon:'book',  max:3, cost:[160,320,520],        desc:l=>`ลดจำนวนข้อที่ต้องตอบของปลา 3★ ขึ้นไป (−${l} ข้อ)` },
  { id:'boat',    name:'เรือ',        icon:'boat',  max:4, cost:[80,190,360,620],     desc:l=>`ปลดล็อกทะเลที่ไกลขึ้น (ไปได้ถึงโซน ${l+1})` },
];
D.STORAGE = [20, 28, 37, 47, 58, 72, 88];

/* ---------- Items ---------- */
D.ITEMS = [
  { id:'bandage',  name:'ผ้าพันแผล',   icon:'bandage',  price:12, heal:30, cures:[],                     desc:'ฟื้นฟู 30 HP' },
  { id:'can',      name:'ปลากระป๋อง',  icon:'can',      price:28, heal:70, cures:[],                     desc:'ฟื้นฟู 70 HP' },
  { id:'tea',      name:'ชาขิงร้อน',   icon:'tea',      price:18, heal:12, cures:['cold'],               desc:'+12 HP และแก้หมอกเยือกแข็ง' },
  { id:'raincoat', name:'เสื้อกันฝน',  icon:'raincoat', price:20, heal:0,  cures:['storm'],              desc:'ป้องกันพายุฝน' },
  { id:'flare',    name:'พลุไฟ',       icon:'flare',    price:32, heal:0,  cures:['shark','jelly','kraken'], desc:'ไล่สัตว์ร้ายทุกชนิด' },
];
D.ITEM_BY_ID = {};
D.ITEMS.forEach(i => D.ITEM_BY_ID[i.id] = i);
D.ITEM_MAX = 9;

/* ---------- Sea events ---------- */
D.EVENTS = [
  { id:'storm',  name:'พายุฝนกระหน่ำ!',   tip:'ใช้ เสื้อกันฝน', minZone:0, dur:16, drain:1.6 },
  { id:'cold',   name:'หมอกเยือกแข็ง!',   tip:'ดื่ม ชาขิงร้อน', minZone:0, dur:18, drain:1.1 },
  { id:'shark',  name:'ฉลามวนรอบเรือ!',   tip:'จุด พลุไฟ ไล่ก่อนโดนงับ!', minZone:1, dur:7, hit:28 },
  { id:'jelly',  name:'ฝูงแมงกะพรุนไฟ!',  tip:'ช็อตเป็นระยะ — จุด พลุไฟ', minZone:2, dur:13, tick:3, tickDmg:7 },
  { id:'kraken', name:'หนวดปีศาจโผล่!',   tip:'จุด พลุไฟ ด่วน!', minZone:3, dur:8, hit:48 },
];
})();
