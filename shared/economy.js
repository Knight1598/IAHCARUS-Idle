import {presentationCatalog} from './presentation.js';
// Browser-owned play credits. Account storage backs these up; it does not verify them.
export const economicModes = [
  { id: "open", name: "Open Arena", label: "สนามเปิดหาเครดิต", base: "bot", entry: 0, prize: 500, description: "เข้าฟรี · เลือกฝ่ายและบอต · เล่นเต็มกระดานเพื่อสะสมเครดิต", rules: "ชนะรับ 500 เครดิต · เสมอรับ 180 เมื่อเดินรวมอย่างน้อย 24 ตา · แพ้รับ 80 เมื่อเดินรวมอย่างน้อย 24 ตา · ออกก่อนจบไม่ได้รางวัล · ไม่มีพรีเมียมจากการเล่น" },
  { id: "bounty", name: "Bounty Hunt", label: "ล่าค่าหัว", base: "score", entry: 40, prize: 160, description: "แลกหมากให้คุ้มใน 12 ตา · ค่าหัวตามหมากที่กิน", rules: "ชนะรับ 160 + มูลค่าหมากที่กิน × 6 (รวมสูงสุด 360) · เสมอคืนค่าเข้า · แพ้เสียค่าเข้า" },
  { id: "vault", name: "Vault Control", label: "ยึดคลังพลังงาน", base: "control", entry: 60, prize: 200, description: "ครองจุดกลางเพื่อยึดคลัง · แตะ 5 แต้มคว้ารางวัล", rules: "ชนะรับ 200 + แต้มยึดพื้นที่ × 20 (รวมสูงสุด 300) · เสมอคืนค่าเข้า · แพ้เสียค่าเข้า" },
  { id: "broker", name: "Broker Draft", label: "จัดทัพลงทุน", base: "draft", entry: 80, prize: 260, description: "จัดทีมในงบ 24 แต้ม · ทีมเล็กชนะได้โบนัสประหยัด", rules: "ชนะรับ 260 + งบที่เหลือ × 10 (โบนัสสูงสุด 120) · คู่แข่งใช้งบเท่ากัน · เสมอคืนค่าเข้า" },
  { id: "stakes", name: "Royal Stakes", label: "ดวลเดิมพันสูง", base: "bot", entry: 150, prize: 450, description: "ดวลหมากรุกเต็มกระดาน · เสี่ยงเครดิตเพื่อรางวัลก้อนใหญ่", rules: "ชนะรับ 450 · เสมอคืน 150 · แพ้หรือออกจากสัญญาเสียค่าเข้า · เล่นกับบอต" },
  { id: "payday", name: "Puzzle Payday", label: "แก้โจทย์หาเงิน", base: "rush", entry: 0, prize: 25, description: "รุกฆาตหนึ่งตาใน 3 นาที · พลาดได้ไม่เกิน 3 ครั้ง", rules: "เมื่อรอบจบ รับ 25 ต่อข้อที่แก้ได้ (สูงสุด 500) · เข้าฟรี · รับเงินครั้งเดียวต่อรอบ" },
];
export const skinPool = [
  { skin: "ember", chance: 22, shards: 20 }, { skin: "frost", chance: 22, shards: 20 },
  { skin: "astral", chance: 16, shards: 35 }, { skin: "royal", chance: 8, shards: 80 },
  { skin: "storm", chance: 20, shards: 20 }, { skin: "void", chance: 8, shards: 80 }, { skin: "prism", chance: 4, shards: 120 },
];
export const pullCost = 150;
export const pityLimit = 8;
export const forgeCosts = { ember: 60, frost: 60, astral: 120, royal: 240, storm: 60, void: 240, prism: 360 };
export const isEconomicMode = id => economicModes.some(mode => mode.id === id);
export const economicDefinition = id => economicModes.find(mode => mode.id === id);
const skinIds = ["classic", "nova", "phantom", "dragon", ...skinPool.map(item => item.skin)];
const integer = (value, fallback = 0) => Number.isSafeInteger(value) && value >= 0 ? Math.min(10000000, value) : fallback;
const validId = id => typeof id === "string" && id.length > 0 && id.length <= 120;
export function readEconomy(raw) {
  const existing = raw && typeof raw === "object" && !Array.isArray(raw);
  return { version: 2, premium: integer(raw?.premium), credits: existing ? integer(raw.credits) : 750, shards: integer(raw?.shards),
    inventory: Array.isArray(raw?.inventory) ? [...new Set(raw.inventory.filter(id=>presentationCatalog.some(item=>item.id===id)))] : [],
    equipped: Object.fromEntries(['dimension','finisher','frame','board','skill'].flatMap(kind=>{
      const id=raw?.equipped?.[kind],item=presentationCatalog.find(item=>item.id===id&&item.kind===kind);
      return item&&Array.isArray(raw?.inventory)&&raw.inventory.includes(id)?[[kind,id]]:[];
    })),
    bannerPity: Object.fromEntries(['collection','combat','arena','army'].map(id=>[id, {legend:Math.min(19,integer(raw?.bannerPity?.[id]?.legend)), rare:Math.min(9,integer(raw?.bannerPity?.[id]?.rare))}])),
    lootHistory: Array.isArray(raw?.lootHistory)?raw.lootHistory.filter(v=>v&&validId(v.id)&&['collection','combat','arena','army'].includes(v.banner)&&shopCatalog.some(item=>item.id===v.product&&(item.cosmetic||item.kind==='skin'))&&['common','rare','epic','legendary'].includes(v.rarity)).slice(-60).map(v=>({id:v.id,banner:v.banner,product:v.product,rarity:v.rarity,duplicate:v.duplicate===true,shards:integer(v.shards),guaranteed:v.guaranteed===true})):[],
    pulls: integer(raw?.pulls), pity: Math.min(pityLimit - 1, integer(raw?.pity)),
    owned: Array.isArray(raw?.owned) ? [...new Set(raw.owned.filter(id => skinIds.includes(id)))] : [],
    claimed: Array.isArray(raw?.claimed) ? [...new Set(raw.claimed.filter(validId))] : [],
    log: Array.isArray(raw?.log) ? raw.log.filter(item => item && validId(item.id) && typeof item.label === "string" && item.label.length <= 160 && Number.isSafeInteger(item.delta) && Math.abs(item.delta) <= 10000000).slice(-40).map(item => ({ id: item.id, label: item.label, delta: item.delta, ...(item.currency === "premium" ? { currency: "premium" } : {}) })) : [],
  };
}
function transaction(wallet, id, delta, label, claim = true) {
  if (!validId(id)) throw Error("รหัสรายการไม่ถูกต้อง");
  if (claim && wallet.claimed.includes(id)) return { wallet, added: false, amount: 0 };
  if (!Number.isSafeInteger(delta) || wallet.credits + delta < 0) throw Error("เครดิตไม่พอ");
  const credits = Math.min(10000000, wallet.credits + delta), amount = credits - wallet.credits;
  return { added: true, amount, wallet: { ...wallet, credits, claimed: claim ? [...wallet.claimed, id] : wallet.claimed,
    log: [...wallet.log, { id, delta: amount, label }].slice(-40) } };
}
export function claimCredits(wallet, id, amount, label) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000) throw Error("รางวัลไม่ถูกต้อง");
  return transaction(wallet, id, amount, label);
}
export function dailyCredits(wallet, day) {
  const parsed = new Date(day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) throw Error("วันที่ไม่ถูกต้อง");
  return claimCredits(wallet, `login:${day}`, 100, "เสบียงประจำวัน");
}
export function enterContract(wallet, id, mode) {
  const definition = economicDefinition(mode);
  if (!definition) throw Error("สัญญาไม่ถูกต้อง");
  return transaction(wallet, `entry:${mode}:${id}`, -definition.entry, `ค่าเข้า ${definition.name}`);
}
export function settleContract(wallet, id, mode, result) {
  const definition = economicDefinition(mode);
  if (!definition || !wallet.claimed.includes(`entry:${mode}:${id}`)) throw Error("ยังไม่ได้เปิดสัญญานี้");
  return claimCredits(wallet, `contract:${id}`, contractAmount(mode, result), `ปิดสัญญา ${definition.name}`);
}
export function contractAmount(mode, result) {
  const definition = economicDefinition(mode);
  if (!definition) throw Error("สัญญาไม่ถูกต้อง");
  const bounded = (value, max) => Math.min(max, integer(value));
  let amount = result.draw ? definition.entry : 0;
  if (mode === "open") amount = result.won ? 500 : bounded(result.plies, 10000) >= 24 ? result.draw ? 180 : 80 : 0;
  else if (mode === "payday") amount = bounded(result.solved, 20) * 25;
  else if (result.won) amount = definition.prize + (mode === "bounty" ? bounded(result.capturedValue, 100) * 6
    : mode === "vault" ? bounded(result.controlScore, 5) * 20
      : mode === "broker" ? bounded(result.unusedBudget, 12) * 10 : 0);
  if (mode === "bounty") amount = Math.min(360, amount);
  return amount;
}
export function rollSkin(wallet, unlocked = [], random = Math.random) {
  if (wallet.credits < pullCost) throw Error("ต้องมีอย่างน้อย 150 เครดิต");
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw Error("ค่าการสุ่มไม่ถูกต้อง");
  const guaranteed = wallet.pity >= pityLimit - 1;
  let cumulative = 0;
  const reward = guaranteed ? skinPool[3] : skinPool.find(item => (cumulative += item.chance) > value * 100);
  const duplicate = wallet.owned.includes(reward.skin) || unlocked.includes(reward.skin);
  const payment = transaction(wallet, `pull:${wallet.pulls + 1}`, -pullCost, `เปิดผนึก ${reward.skin}${duplicate ? " · สกินซ้ำ" : " · สกินใหม่"}`, false);
  return { skin: reward.skin, duplicate, shards: duplicate ? reward.shards : 0, guaranteed,
    wallet: { ...payment.wallet, pulls: wallet.pulls + 1, pity: ["royal", "void", "prism"].includes(reward.skin) ? 0 : wallet.pity + 1,
      shards: Math.min(10000000, wallet.shards + (duplicate ? reward.shards : 0)), owned: [...new Set([...wallet.owned, reward.skin])] } };
}
export function forgeSkin(wallet, skin, unlocked = []) {
  const cost = forgeCosts[skin];
  if (!cost || wallet.shards < cost) throw Error("เศษพลังงานไม่พอ");
  if (wallet.owned.includes(skin) || unlocked.includes(skin)) throw Error("มีสกินนี้แล้ว");
  return { ...wallet, shards: wallet.shards - cost, owned: [...wallet.owned, skin],
    log: [...wallet.log, { id: `forge:${skin}`, delta: 0, label: `หลอมสกิน ${skin} · ใช้ ${cost} เศษพลังงาน` }].slice(-40) };
}

// Trial shop: balances are local saves, not real-money entitlements.
export const shopCatalog = [
  ...presentationCatalog,
  ...[["nova",1200,"credits"],["phantom",220,"premium"],["dragon",280,"premium"]].map(([skin,price,currency])=>({id:`skin-${skin}`,kind:"skin",skin,price,currency,shards:0,credits:0})),
  ...[["nova",1500,"credits",70],["phantom",270,"premium",100],["dragon",350,"premium",120]].map(([skin,price,currency,shards])=>({id:`bundle-${skin}`,kind:"bundle",skin,price,currency,shards,credits:0})),
  ...[ ["ember",350,"credits"], ["frost",350,"credits"], ["storm",500,"credits"], ["astral",900,"credits"], ["royal",180,"premium"], ["void",220,"premium"], ["prism",300,"premium"] ].map(([skin,price,currency])=>({id:`skin-${skin}`,kind:"skin",skin,price,currency,shards:0,credits:0})),
  ...[ ["ember",500,"credits",30], ["frost",500,"credits",30], ["storm",700,"credits",40], ["astral",1200,"credits",60], ["royal",230,"premium",100], ["void",270,"premium",100], ["prism",350,"premium",120] ].map(([skin,price,currency,shards])=>({id:`bundle-${skin}`,kind:"bundle",skin,price,currency,shards,credits:0})),
  {id:"shards-small",kind:"supplies",label:"เศษพลังงาน 30",price:250,currency:"credits",shards:30,credits:0},
  {id:"shards-large",kind:"supplies",label:"เศษพลังงาน 100",price:700,currency:"credits",shards:100,credits:0},
  {id:"credits-small",kind:"supplies",label:"เครดิต 1,000",price:50,currency:"premium",shards:0,credits:1000},
  {id:"credits-large",kind:"supplies",label:"เครดิต 3,000",price:120,currency:"premium",shards:0,credits:3000},
];
export function trialPremium(wallet) {
  const id="trial:premium-v1";
  if(wallet.claimed.includes(id))return {wallet,added:false,amount:0};
  const premium=Math.min(10000000,wallet.premium+300);
  return {added:true,amount:premium-wallet.premium,wallet:{...wallet,premium,claimed:[...wallet.claimed,id],log:[...wallet.log,{id,label:"พรีเมียมทดลองครั้งเดียว",delta:premium-wallet.premium,currency:"premium"}].slice(-40)}};
}
export function buyShopItem(wallet,id,unlocked=[]) {
  const item=shopCatalog.find(item=>item.id===id);
  if(!item)throw Error("ไม่พบสินค้า");
  if(item.cosmetic&&wallet.inventory.includes(item.id))throw Error("มีสินค้านี้แล้ว");
  if(item.skin&&(wallet.owned.includes(item.skin)||unlocked.includes(item.skin)))throw Error("มีสกินนี้แล้ว");
  if(wallet[item.currency]<item.price)throw Error(item.currency==="premium"?"พรีเมียมไม่พอ":"เครดิตไม่พอ");
  if(wallet.shards+item.shards>10000000||wallet.credits+item.credits>10000000)throw Error("ยอดเงินหรือวัสดุถึงขีดจำกัดแล้ว");
  const label=item.label||`${item.kind==='bundle'?'ชุดธีม':'สกิน'} ${item.skin}`;
  const log=[...wallet.log,{id:`shop:${id}`,label,delta:-item.price,...(item.currency==='premium'?{currency:'premium'}:{})}];
  if(item.credits)log.push({id:`supply:${id}`,label:"เครดิตจากแพ็กเสบียง",delta:item.credits});
  return {...wallet,inventory:item.cosmetic?[...wallet.inventory,item.id]:wallet.inventory,[item.currency]:wallet[item.currency]-item.price,credits:wallet.credits-(item.currency==='credits'?item.price:0)+item.credits,shards:wallet.shards+item.shards,owned:item.skin?[...wallet.owned,item.skin]:wallet.owned,log:log.slice(-40)};
}

export function equipShopItem(wallet,id) {
  const item=presentationCatalog.find(item=>item.id===id);
  if(!item||!wallet.inventory.includes(id))throw Error('ยังไม่มีสินค้านี้');
  const equipped={...wallet.equipped};
  if(equipped[item.kind]===id)delete equipped[item.kind];else equipped[item.kind]=id;
  return {...wallet,equipped};
}

// Collection capsules use play credits only. Each banner retains its own guarantees.
export const gachaBanners = [
 {id:'collection',label:'คลังจักรวาล',description:'ทุกสกินและเครื่องแต่งทั้งห้าประเภท',kinds:['skin','dimension','finisher','frame','board','skill']},
 {id:'combat',label:'คลังยุทธศิลป์',description:'เอฟเฟกต์สกิลและสังหาร',kinds:['skill','finisher']},
 {id:'arena',label:'คลังสนาม',description:'กระดานและมิติต่อสู้',kinds:['board','dimension']},
 {id:'army',label:'คลังกองทัพ',description:'สกินกองทัพทั้ง 10 แบบ',kinds:['skin']},
];
export const capsuleCost=120;
export const rarityRates={common:55,rare:30,epic:12,legendary:3};
export const duplicateShards={common:15,rare:35,epic:80,legendary:160};
export const cosmeticForgeCosts={common:60,rare:140,epic:320,legendary:640};
const skinRarities={ember:'rare',frost:'rare',storm:'rare',astral:'epic',nova:'epic',phantom:'legendary',royal:'legendary',void:'legendary',prism:'legendary',dragon:'legendary'};
export function lootRarity(item){return item.rarity||skinRarities[item.skin]||'common';}
export function bannerPool(id){
 const banner=gachaBanners.find(v=>v.id===id);if(!banner)throw Error('ตู้สุ่มไม่ถูกต้อง');
 return shopCatalog.filter(v=>banner.kinds.includes(v.kind)&&(v.cosmetic||v.kind==='skin'));
}
export function bannerOdds(id,wallet){
 const pool=bannerPool(id),pity=wallet?.bannerPity?.[id]||{legend:0,rare:0};
 const allowed=Object.keys(rarityRates).filter(r=>pool.some(v=>lootRarity(v)===r)&&(pity.legend>=19?r==='legendary':pity.rare>=9?r!=='common':true));
 const total=allowed.reduce((sum,r)=>sum+rarityRates[r],0);
 return pool.map(item=>({product:item.id,rarity:lootRarity(item),chance:allowed.includes(lootRarity(item))?rarityRates[lootRarity(item)]/total*100/pool.filter(v=>lootRarity(v)===lootRarity(item)).length:0}));
}
export function rollCapsules(wallet,banner,count=1,unlocked=[],random=Math.random){
 if(count!==1&&count!==10)throw Error('เปิดได้ครั้งละ 1 หรือ 10 ชิ้น');
 bannerPool(banner);if(wallet.credits<capsuleCost*count)throw Error(`ต้องมี ${capsuleCost*count} เครดิต`);
 let next=readEconomy(wallet);const rewards=[];
 for(let i=0;i<count;i++){
  const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw Error('ค่าการสุ่มไม่ถูกต้อง');
  const odds=bannerOdds(banner,next);let cumulative=0;
  const selected=odds.find(v=>(cumulative+=v.chance)>value*100)||odds.findLast(v=>v.chance>0);
  const item=shopCatalog.find(v=>v.id===selected.product),pity=next.bannerPity[banner];
  const duplicate=item.cosmetic?next.inventory.includes(item.id):next.owned.includes(item.skin)||unlocked.includes(item.skin);
  const shards=duplicate?Math.min(duplicateShards[selected.rarity],10000000-next.shards):0;
  const reward={id:`capsule:${next.pulls+1}`,banner,product:item.id,rarity:selected.rarity,duplicate,shards,guaranteed:pity.legend>=19||pity.rare>=9};
  next={...next,credits:next.credits-capsuleCost,pulls:next.pulls+1,shards:next.shards+shards,
   inventory:item.cosmetic?[...new Set([...next.inventory,item.id])]:next.inventory,
   owned:item.skin?[...new Set([...next.owned,item.skin])]:next.owned,
   bannerPity:{...next.bannerPity,[banner]:{legend:selected.rarity==='legendary'?0:pity.legend+1,rare:selected.rarity==='common'?pity.rare+1:0}},
   lootHistory:[...next.lootHistory,reward].slice(-60),
   log:[...next.log,{id:reward.id,label:`${item.label||item.skin}${duplicate?' · ของซ้ำ':''}`,delta:-capsuleCost}].slice(-40)};
  rewards.push(reward);
 }
 return {wallet:next,rewards};
}
export function forgeCosmetic(wallet,id){
 const item=presentationCatalog.find(v=>v.id===id);if(!item)throw Error('เลือกเครื่องแต่งที่หลอมได้');
 if(wallet.inventory.includes(id))throw Error('มีสินค้านี้แล้ว');
 const cost=cosmeticForgeCosts[item.rarity];if(wallet.shards<cost)throw Error('เศษพลังงานไม่พอ');
 return {...wallet,shards:wallet.shards-cost,inventory:[...wallet.inventory,id],log:[...wallet.log,{id:`forge:${id}`,label:`หลอม ${item.label} · ${cost} เศษ`,delta:0}].slice(-40)};
}
