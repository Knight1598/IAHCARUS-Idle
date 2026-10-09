export const duelRules = {
  standard: { name: "หมากรุกคลาสสิก", description: "รุกฆาตเพื่อชนะ · กติกาหมากรุกปกติ" },
  threeCheck: { name: "รุกสามครั้ง", description: "รุกคู่แข่งครบ 3 ครั้ง หรือรุกฆาตเพื่อชนะ" },
  kingHill: { name: "ราชันยึดศูนย์กลาง", description: "พาคิงเข้าช่อง d4 / e4 / d5 / e5 อย่างปลอดภัย หรือรุกฆาต" },
  firstCapture: { name: "ศึกชิงหมากแรก", description: "กินหมากคู่แข่งตัวแรก หรือรุกฆาตเพื่อชนะ" },
};
export const duelMinutes = [1, 3, 5, 10, 15, 30];
export const duelIncrements = [0, 2, 3, 5, 10];
export const duelArenas = ['citadel','ember','frost','astral','storm','grove','reactor','eclipse'];
export function roomSettings(raw = {}, current = { rule:'standard', baseMs:300000, increment:0, arena:'citadel', allowDraw:true }) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('การตั้งค่าห้องไม่ถูกต้อง');
  const next = { ...current };
  for (const key of Object.keys(raw)) {
    const value = raw[key];
    if (key === 'rule' && typeof value === 'string' && Object.hasOwn(duelRules,value)) next.rule=value;
    else if (key === 'baseMs' && duelMinutes.some(m=>m*60000===value)) next.baseMs=value;
    else if (key === 'increment' && duelIncrements.includes(value)) next.increment=value;
    else if (key === 'arena' && duelArenas.includes(value)) next.arena=value;
    else if (key === 'allowDraw' && typeof value === 'boolean') next.allowDraw=value;
    else throw Error('ตัวเลือกกติกาหรือเวลาไม่ถูกต้อง');
  }
  return next;
}
export function duelOutcome(game, rule, move, checks) {
  if (game.isCheck()) checks[move.color]++;
  if (rule==='threeCheck' && checks[move.color]>=3) return {winner:move.color,reason:'threeCheck'};
  if (rule==='firstCapture' && move.captured) return {winner:move.color,reason:'firstCapture'};
  if (rule==='kingHill' && ['d4','e4','d5','e5'].some(s=>game.get(s)?.type==='k' && game.get(s)?.color===move.color)) return {winner:move.color,reason:'kingHill'};
  if (game.isCheckmate()) return {winner:move.color,reason:'checkmate'};
  if (game.isDraw()) return {winner:null,reason:'draw'};
  return null;
}
