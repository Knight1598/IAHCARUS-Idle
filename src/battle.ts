import type { Color, Move } from "chess.js";

export type BattleKind = "mission" | "first-blood" | "recapture" | "queen-fallen" | "comeback" | "endgame" | "capture-streak";
export interface BattleMoment {
  kind: BattleKind;
  title: string;
  description: string;
  color: Color;
  ply: number;
}
const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function balance(fen: string) {
  let score = 0;
  for (const char of fen.split(" ")[0])
    if (values[char.toLowerCase()] !== undefined)
      score += (char === char.toUpperCase() ? 1 : -1) * values[char.toLowerCase()];
  return score;
}
function majorPieces(fen: string) { return (fen.split(" ")[0].match(/[nbrq]/gi) || []).length; }

export function matchStory(history: Move[]) {
  const moments: BattleMoment[] = [];
  const missions: Record<Color, { check: boolean; capture: boolean; castle: boolean }> = {
    w: { check: false, capture: false, castle: false },
    b: { check: false, capture: false, castle: false },
  };
  const streak: Record<Color, number> = { w: 0, b: 0 };
  let hadCapture = false;
  let enteredEndgame = false;
  for (let index = 0; index < history.length; index++) {
    const move = history[index];
    const side = move.color === "w" ? "ฝ่ายขาว" : "ฝ่ายดำ";
    const add = (kind: BattleKind, title: string, description: string) =>
      moments.push({ kind, title, description, color: move.color, ply: index + 1 });
    const mission = missions[move.color];
    const beforeStars = Object.values(mission).filter(Boolean).length;
    mission.check ||= /[+#]/.test(move.san);
    mission.capture ||= !!move.captured && values[move.captured] >= 3;
    mission.castle ||= /[kq]/.test(move.flags);
    const stars = Object.values(mission).filter(Boolean).length - beforeStars;
    if (stars) add("mission", "MISSION CLEAR", `${side}สำเร็จภารกิจ · +${stars} ดาว`);
    streak[move.color] = move.captured ? streak[move.color] + 1 : 0;
    if (move.captured && !hadCapture) {
      add("first-blood", "FIRST BLOOD", `${side}เปิดศึกด้วยการกินหมากแรก`);
      hadCapture = true;
    }
    const previous = history[index - 1];
    if (move.captured && previous?.captured && previous.color !== move.color && previous.to === move.to)
      add("recapture", "COUNTER STRIKE", `${side}กินคืนทันทีที่ ${move.to.toUpperCase()}`);
    if (streak[move.color] === 2)
      add("capture-streak", "HUNTING STREAK", `${side}กินหมากในสองตาของตัวเองติดต่อกัน`);
    if (move.captured === "q")
      add("queen-fallen", "QUEEN FALLEN", `${side}โค่นควีนคู่แข่ง · แนวรบเปลี่ยนแล้ว`);
    const sign = move.color === "w" ? 1 : -1;
    if (balance(move.before) * sign <= -1 && balance(move.after) * sign >= 1)
      add("comeback", "TURNING POINT", `${side}พลิกจากเสียเปรียบมาได้เปรียบด้านกำลังหมาก`);
    if (!enteredEndgame && majorPieces(move.before) > 4 && majorPieces(move.after) <= 4) {
      add("endgame", "FINAL PHASE", "หมากใหญ่เหลือน้อย · ทุกตาในช่วงท้ายมีความหมาย");
      enteredEndgame = true;
    }
  }
  return { moments, missions };
}

export function latestMoment(moments: BattleMoment[], ply: number) {
  const priority: Record<BattleKind, number> = {
    mission: 0, "endgame": 1, "first-blood": 2, "capture-streak": 3,
    recapture: 4, "queen-fallen": 5, comeback: 6,
  };
  return moments.filter((moment) => moment.ply === ply)
    .sort((a, b) => priority[a.kind] - priority[b.kind]).at(-1);
}
