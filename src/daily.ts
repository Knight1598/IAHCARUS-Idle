import { Chess, type Color } from "chess.js";
import { trials, type Trial } from "./progression.ts";
import { arenaIds } from "./arenas.ts";

const dayMs = 86400000;
export function utcDay(now = new Date()) { return now.toISOString().slice(0, 10); }
export function validDailyDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
const templates: { base: keyof typeof trials; title: string; trial: Trial }[] = [
  { base: "rescue", title: "โล่สุดท้ายของราชัน", trial: trials.rescue },
  { base: "fork", title: "นักล่าสองจักรวาล", trial: trials.fork },
  { base: "boss", title: "หนึ่งตาปิดตำนาน", trial: { name: "หนึ่งตาปิดตำนาน", story: "ราชันศัตรูเหลือทางหนีสุดท้าย จงปิดผนึกสนามด้วยควีน", fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", side: "w", maxMoves: 1, objective: "mate", hint: "หาท่ารุกที่ควบคุมช่องหนีทั้งหมดด้วยควีน" } },
  { base: "boss", title: "ประสานพลังราชัน", trial: trials.boss },
];
/** File reflection and color/rank inversion preserve legal movement, including pawns. */
function variant(trial: Trial, mirror: boolean, invert: boolean): Trial {
  const board: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const piece of new Chess(trial.fen).board().flat()) {
    if (!piece) continue;
    const file = piece.square.charCodeAt(0) - 97, rank = 8 - Number(piece.square[1]);
    const color: Color = invert ? piece.color === "w" ? "b" : "w" : piece.color;
    board[invert ? 7 - rank : rank][mirror ? 7 - file : file] = color === "w" ? piece.type.toUpperCase() : piece.type;
  }
  const placement = board.map((row) => {
    let empty = 0, result = "";
    for (const piece of row) {
      if (!piece) empty++;
      else { if (empty) result += empty; empty = 0; result += piece; }
    }
    return result + (empty || "");
  }).join("/");
  const side = invert ? trial.side === "w" ? "b" : "w" : trial.side;
  const hint = trial.objective === "rescue" ? "ราชันของคุณถูกม้ารุก หาหมากที่กินผู้โจมตีได้"
    : trial.objective === "fork" ? "หาช่องที่ม้าขู่ทั้งควีนและเรือพร้อมกัน"
      : trial.maxMoves === 1 ? "หาท่ารุกที่ควบคุมช่องหนีทั้งหมดด้วยควีน" : "ใช้ควีนคุมทางหนี และให้คิงช่วยปกป้องช่องสังหาร";
  return { ...trial, side, hint, fen: `${placement} ${side} - - 0 1` };
}
export function dailyChallenge(day = utcDay()) {
  if (!validDailyDay(day)) throw Error("Invalid daily date");
  const ordinal = Math.floor(Date.parse(day + "T00:00:00Z") / dayMs);
  const seed = ((ordinal % 16) + 16) % 16;
  const template = templates[seed % templates.length];
  return { day, id: `daily:${day}`, base: template.base, title: template.title,
    arena: arenaIds[((ordinal % arenaIds.length) + arenaIds.length) % arenaIds.length],
    trial: variant(template.trial, !!(seed & 4), !!(seed & 8)) };
}
function previousDay(day: string) { return utcDay(new Date(Date.parse(day + "T00:00:00Z") - dayMs)); }
/** Claims are the source of truth: retries, undo and reload cannot advance a streak. */
export function dailyProgress(claimed: string[], day = utcDay()) {
  if (!validDailyDay(day)) throw Error("Invalid daily date");
  const days = new Set(claimed.filter((id) => id.startsWith("daily:") && validDailyDay(id.slice(6))).map((id) => id.slice(6)));
  const done = days.has(day);
  let cursor = previousDay(day), preceding = 0;
  while (days.has(cursor) && preceding < days.size) { preceding++; cursor = previousDay(cursor); }
  return { done, streak: done ? preceding + 1 : preceding, reward: 80 + Math.min(preceding, 4) * 10, completed: days.size };
}
