import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import type { Profile, SkinId } from "./profile";

export const pieceNames: Record<PieceSymbol, string> = {
  p: "เบี้ย", n: "ม้า", b: "บิชอป", r: "เรือ", q: "ควีน", k: "คิง",
};

/** Cosmetic avatars retain each chess archetype's silhouette and legal moves. */
export const avatarNames: Record<SkinId, Record<PieceSymbol, string>> = {
  classic: { p: "ทหารราชสำนัก", n: "อัศวินเงา", b: "ผู้พิพากษาแสง", r: "ปราการเหล็ก", q: "ราชินีคมดาบ", k: "ราชันผู้บัญชาการ" },
  ember: { p: "พลหอกเตาหลอม", n: "อัศวินเถ้าถ่าน", b: "จอมเวทสุริยะ", r: "ป้อมปืนภูเขาไฟ", q: "ราชินีอัคคี", k: "ราชันมังกรเพลิง" },
  frost: { p: "พลหอกเหมันต์", n: "อัศวินพายุหิมะ", b: "ผู้ทำนายผลึก", r: "ปราการธารน้ำแข็ง", q: "ราชินีเกล็ดหิมะ", k: "ราชันเยือกแข็ง" },
  astral: { p: "ผู้เดินทางดวงดาว", n: "นักล่ารอยแยก", b: "จอมเวทจักรวาล", r: "ป้อมแรงโน้มถ่วง", q: "จักรพรรดินีดารา", k: "ราชันสุริยุปราคา" },
  royal: { p: "องครักษ์ทองคำ", n: "อัศวินคำพิพากษา", b: "มหาปราชญ์ราชสำนัก", r: "ป้อมจักรพรรดิ", q: "ราชินีบัลลังก์สวรรค์", k: "จักรพรรดินิรันดร์" },
  storm: { p: "พลหอกสายฟ้า", n: "นักฟันอัสนี", b: "ผู้ควบคุมวงจร", r: "ป้อมเทสลา", q: "ราชินีพายุประจุ", k: "ราชันสายฟ้า" },
  void: { p: "ผู้ล่าดวงวิญญาณ", n: "อัศวินคราส", b: "จอมเวทสุญญากาศ", r: "ป้อมหลุมดำ", q: "ราชินีรัตติกาล", k: "ราชันจุดสิ้นสุด" },
  prism: { p: "พลหอกแสงเจ็ดสี", n: "อัศวินปริซึม", b: "ผู้ทำนายแสง", r: "ปราการหักเห", q: "ราชินีผลึกสวรรค์", k: "ราชันแสงนิรันดร์" },
};

export const skillNames: Record<SkinId, Record<PieceSymbol, string>> = {
  classic: { p: "หอกทะลวงเกราะ", n: "พุ่งทะลวงเงา", b: "ลำแสงพิพากษา", r: "ปืนใหญ่ปราการ", q: "คมดาบล้อมสังหาร", k: "ดาบราชัน" },
  ember: { p: "หอกเพลิงทะลวง", n: "รอยฟันเถ้าถ่าน", b: "ลำแสงสุริยะ", r: "ปืนใหญ่ลาวา", q: "พายุดาบอัคคี", k: "พิพากษามังกรเพลิง" },
  frost: { p: "หอกผลึกน้ำแข็ง", n: "รอยฟันเหมันต์", b: "ลำแสงศูนย์สัมบูรณ์", r: "ปืนใหญ่ธารน้ำแข็ง", q: "คุกดาบผลึก", k: "พิพากษาเยือกแข็ง" },
  astral: { p: "หอกดาวตก", n: "ผ่ารอยแยกมิติ", b: "ลำแสงจักรวาล", r: "ปืนใหญ่แรงโน้มถ่วง", q: "วงโคจรดาบดารา", k: "พิพากษาสุริยุปราคา" },
  royal: { p: "หอกองครักษ์สวรรค์", n: "ผ่าตราคำพิพากษา", b: "ลำแสงมหาปราชญ์", r: "ปืนใหญ่จักรพรรดิ", q: "พันธนาการบัลลังก์", k: "คำพิพากษานิรันดร์" },
  storm: { p: "หอกประจุอัสนี", n: "ฟันสายฟ้าแตกแขนง", b: "ลำแสงวงจร", r: "ปืนเทสลา", q: "พายุคมอิเล็กตรอน", k: "พิพากษาสายฟ้า" },
  void: { p: "หอกทะลุสุญญากาศ", n: "ผ่าคราสยุบมิติ", b: "บีมจุดสิ้นสุด", r: "ปืนหลุมดำ", q: "พายุดาบรัตติกาล", k: "พิพากษาศูนย์สัมบูรณ์" },
  prism: { p: "หอกปริซึมทะลวง", n: "รอยฟันแยกแสง", b: "บีมสเปกตรัม", r: "ปืนใหญ่หักเห", q: "พายุผลึกเจ็ดสี", k: "พิพากษาแสงนิรันดร์" },
};

/** Canonical slots are origin squares, so the two knights or eight pawns can differ. */
export function initialArmySlots(color: Color): { origin: Square; type: PieceSymbol }[] {
  const backRank = color === "w" ? "1" : "8";
  const pawnRank = color === "w" ? "2" : "7";
  const backTypes: PieceSymbol[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  return [
    ...Array.from("abcdefgh", (file, index) => ({ origin: `${file}${backRank}` as Square, type: backTypes[index] })),
    ...Array.from("abcdefgh", (file) => ({ origin: `${file}${pawnRank}` as Square, type: "p" as PieceSymbol })),
  ];
}

/** Place the player's equipped archetypes into a short chapter's custom board.
 * A knight deployed at c3 borrows a knight slot, rather than a rook's skin just
 * because the chapter's queen happens to begin at a1. Profile data is untouched.
 */
export function scenarioLoadout(profile: Profile, fen: string): Profile {
  const loadouts: Profile["loadouts"] = { w: {}, b: {} };
  const pieces = new Chess(fen).board().flat().filter(piece => !!piece);
  for (const color of ["w", "b"] as const) {
    const slots = initialArmySlots(color), used = new Set<Square>();
    const army = pieces.filter(piece => piece.color === color);
    const canonical = new Map<Square, Square>();
    // Reserve matching original slots before filling displaced classes.
    for (const piece of army) {
      const slot = slots.find(slot => slot.origin === piece.square && slot.type === piece.type);
      if (slot) { canonical.set(piece.square, slot.origin); used.add(slot.origin); }
    }
    for (const piece of army) {
      const original = canonical.get(piece.square) || slots.find(slot => slot.type === piece.type && !used.has(slot.origin))?.origin;
      if (original) used.add(original);
      const explicit = !slots.some(slot => slot.origin === piece.square) ? profile.loadouts[color][piece.square] : undefined;
      loadouts[color][piece.square] = explicit || (original && profile.loadouts[color][original]) || profile.skin;
    }
  }
  return { ...profile, loadouts };
}

/**
 * Rebuild appearances from the initial position and history, including undo.
 * An origin slot belongs to a physical piece, never to a destination square.
 * With an owner supplied, only that owner's loadout is used; opponents use classic.
 * Custom FEN positions use their own origin squares and the same fallback skin.
 */
export function appearanceMap(initialFen: string, moves: Move[], profile: Profile, owner?: Color): Record<string, SkinId> {
  const game = new Chess(initialFen);
  const appearances: Record<string, SkinId> = {};
  for (const row of game.board()) {
    for (const piece of row) {
      if (piece) appearances[piece.square] = owner && piece.color !== owner ? "classic" : profile.loadouts[piece.color][piece.square] ?? profile.skin;
    }
  }
  for (const historical of moves) {
    const move = historical;
    const skin = appearances[move.from];
    const capturedSquare = move.flags.includes("e") ? `${move.to[0]}${move.from[1]}` : move.to;
    delete appearances[capturedSquare];
    delete appearances[move.from];
    appearances[move.to] = skin;
    if (move.flags.includes("k") || move.flags.includes("q")) {
      const rank = move.color === "w" ? "1" : "8";
      const rookFrom = `${move.flags.includes("k") ? "h" : "a"}${rank}`;
      const rookTo = `${move.flags.includes("k") ? "f" : "d"}${rank}`;
      appearances[rookTo] = appearances[rookFrom];
      delete appearances[rookFrom];
    }
  }
  return appearances;
}
