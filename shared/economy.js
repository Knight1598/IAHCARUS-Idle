// Browser-owned play credits. Account storage backs these up; it does not verify them.
export const economicModes = [
  { id: "bounty", name: "Bounty Hunt", label: "ล่าค่าหัว", base: "score", entry: 40, prize: 160, description: "แลกหมากให้คุ้มใน 12 ตา · ค่าหัวตามหมากที่กิน", rules: "ชนะรับ 160 + มูลค่าหมากที่กิน × 6 (รวมสูงสุด 360) · เสมอคืนค่าเข้า · แพ้เสียค่าเข้า" },
  { id: "vault", name: "Vault Control", label: "ยึดคลังพลังงาน", base: "control", entry: 60, prize: 200, description: "ครองจุดกลางเพื่อยึดคลัง · แตะ 5 แต้มคว้ารางวัล", rules: "ชนะรับ 200 + แต้มยึดพื้นที่ × 20 (รวมสูงสุด 300) · เสมอคืนค่าเข้า · แพ้เสียค่าเข้า" },
  { id: "broker", name: "Broker Draft", label: "จัดทัพลงทุน", base: "draft", entry: 80, prize: 260, description: "จัดทีมในงบ 24 แต้ม · ทีมเล็กชนะได้โบนัสประหยัด", rules: "ชนะรับ 260 + งบที่เหลือ × 10 (โบนัสสูงสุด 120) · คู่แข่งใช้งบเท่ากัน · เสมอคืนค่าเข้า" },
  { id: "stakes", name: "Royal Stakes", label: "ดวลเดิมพันสูง", base: "bot", entry: 150, prize: 450, description: "ดวลหมากรุกเต็มกระดาน · เสี่ยงเครดิตเพื่อรางวัลก้อนใหญ่", rules: "ชนะรับ 450 · เสมอคืน 150 · แพ้หรือออกจากสัญญาเสียค่าเข้า · เล่นกับบอต" },
  { id: "payday", name: "Puzzle Payday", label: "แก้โจทย์หาเงิน", base: "rush", entry: 0, prize: 25, description: "รุกฆาตหนึ่งตาใน 3 นาที · พลาดได้ไม่เกิน 3 ครั้ง", rules: "เมื่อรอบจบ รับ 25 ต่อข้อที่แก้ได้ (สูงสุด 500) · เข้าฟรี · รับเงินครั้งเดียวต่อรอบ" },
];
export const skinPool = [
  { skin: "ember", chance: 32, shards: 20 }, { skin: "frost", chance: 32, shards: 20 },
  { skin: "astral", chance: 26, shards: 35 }, { skin: "royal", chance: 10, shards: 80 },
];
export const pullCost = 150;
export const pityLimit = 8;
export const forgeCosts = { ember: 60, frost: 60, astral: 120, royal: 240 };
export const isEconomicMode = id => economicModes.some(mode => mode.id === id);
export const economicDefinition = id => economicModes.find(mode => mode.id === id);
const skinIds = ["classic", ...skinPool.map(item => item.skin)];
const integer = (value, fallback = 0) => Number.isSafeInteger(value) && value >= 0 ? Math.min(10000000, value) : fallback;
const validId = id => typeof id === "string" && id.length > 0 && id.length <= 120;
export function readEconomy(raw) {
  const existing = raw && typeof raw === "object" && !Array.isArray(raw);
  return { version: 1, credits: existing ? integer(raw.credits) : 750, shards: integer(raw?.shards),
    pulls: integer(raw?.pulls), pity: Math.min(pityLimit - 1, integer(raw?.pity)),
    owned: Array.isArray(raw?.owned) ? [...new Set(raw.owned.filter(id => skinIds.includes(id)))] : [],
    claimed: Array.isArray(raw?.claimed) ? [...new Set(raw.claimed.filter(validId))] : [],
    log: Array.isArray(raw?.log) ? raw.log.filter(item => item && validId(item.id) && typeof item.label === "string" && item.label.length <= 160 && Number.isSafeInteger(item.delta) && Math.abs(item.delta) <= 10000000).slice(-40).map(item => ({ id: item.id, label: item.label, delta: item.delta })) : [],
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
  if (mode === "payday") amount = bounded(result.solved, 20) * 25;
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
    wallet: { ...payment.wallet, pulls: wallet.pulls + 1, pity: reward.skin === "royal" ? 0 : wallet.pity + 1,
      shards: Math.min(10000000, wallet.shards + (duplicate ? reward.shards : 0)), owned: [...new Set([...wallet.owned, reward.skin])] } };
}
export function forgeSkin(wallet, skin, unlocked = []) {
  const cost = forgeCosts[skin];
  if (!cost || wallet.shards < cost) throw Error("เศษพลังงานไม่พอ");
  if (wallet.owned.includes(skin) || unlocked.includes(skin)) throw Error("มีสกินนี้แล้ว");
  return { ...wallet, shards: wallet.shards - cost, owned: [...wallet.owned, skin],
    log: [...wallet.log, { id: `forge:${skin}`, delta: 0, label: `หลอมสกิน ${skin} · ใช้ ${cost} เศษพลังงาน` }].slice(-40) };
}
