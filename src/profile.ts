import type { Color, Square } from "chess.js";
import { isArena, type ArenaId } from "./arenas.ts";
import { readEconomy, type Economy } from "../shared/economy.js";

export const skins = {
  classic: { name: "Royal Origin", label: "ราชันต้นกำเนิด", level: 1, rarity: "มาตรฐาน", tier: 1, effect: "origin", description: "เกราะราชสำนักและคมพลังงาน เน้นจังหวะโจมตีที่ชัดเจน", white: [0xe4edf4, 0x39d9e8], black: [0x222937, 0xae70ff], glow: "#39d9e8" },
  ember: { name: "Ember Knights", label: "อัศวินเพลิง", level: 1, rarity: "หายาก", tier: 2, effect: "ember", description: "นักรบเตาหลอม อาวุธเพลิงและสะเก็ดไฟตามรอยโจมตี", white: [0xffead0, 0xffae42], black: [0x342229, 0xff654f], glow: "#ffae42" },
  frost: { name: "Frost Guard", label: "ผู้พิทักษ์เหมันต์", level: 1, rarity: "หายาก", tier: 2, effect: "frost", description: "ผู้พิทักษ์น้ำแข็ง เกราะผลึกและรอยแตกที่เย็นจัด", white: [0xe1f5ff, 0x78d9ff], black: [0x1b2b43, 0x699eff], glow: "#78d9ff" },
  astral: { name: "Astral Order", label: "ภาคีดวงดาว", level: 2, rarity: "มหากาพย์", tier: 3, effect: "astral", description: "อวตารอวกาศ วงโคจรดวงดาวและรอยแยกมิติ", white: [0xf2e5ff, 0xe2a0ff], black: [0x2b2240, 0xb389ff], glow: "#e2a0ff" },
  royal: { name: "Golden Sovereign", label: "ราชันทองคำ", level: 4, rarity: "ตำนาน", tier: 4, effect: "royal", description: "อวตารจักรพรรดิ อาวุธพิพากษาและตราราชันหลายชั้น", white: [0xffefd3, 0xf4c66d], black: [0x233731, 0x78e6b2], glow: "#f4c66d" },
  storm: { name: "Storm Circuit", label: "วงจรสายฟ้า", level: 2, rarity: "หายาก", tier: 2, effect: "storm", description: "เกราะครีบตัวนำ ออร่าซิกแซกและคมสายฟ้าแตกแขนง", white: [0xe1fff3, 0x61ffc4], black: [0x162e36, 0x45efd5], glow: "#61ffc4" },
  void: { name: "Void Reaper", label: "ผู้เก็บเกี่ยวสุญญากาศ", level: 6, rarity: "ตำนาน", tier: 4, effect: "void", description: "วงแหวนคราส อาวุธวงแหวนนอกมิติและแรงยุบตัวเข้าศูนย์กลาง", white: [0xe3dcff, 0x9c76ff], black: [0x151021, 0xdd63cb], glow: "#9c76ff" },
  prism: { name: "Prism Ascendant", label: "ผู้ตื่นรู้แห่งปริซึม", level: 8, rarity: "มายาธิค", tier: 5, effect: "prism", description: "มงกุฎผลึกสามชั้น ออร่าหักเหแสงและคมปริซึมแยกแนว", white: [0xf2ffff, 0x9df5ff], black: [0x25253c, 0xffa2e9], glow: "#9df5ff" },
  nova: {name:"Nova Vanguard",label:"กองทัพสุริยะ",level:3,rarity:"มหากาพย์",tier:3,effect:"storm",description:"ครีบสุริยะ ออร่าวงแหวนดาวและระเบิดโนวาตอนสังหาร",white:[0xfff3d0,0xffcc51],black:[0x372631,0xff794d],glow:"#ffcc51"},
  phantom: {name:"Phantom Veil",label:"กองทัพม่านวิญญาณ",level:5,rarity:"ตำนาน",tier:4,effect:"void",description:"ม่านเรขาคณิต วงจันทร์เสี้ยวและประตูวิญญาณยุบเป้าหมาย",white:[0xe0fff3,0x78ffd7],black:[0x122d31,0x81e4cc],glow:"#78ffd7"},
  dragon: {name:"Crimson Wyrm",label:"กองทัพมังกรชาด",level:7,rarity:"มายาธิค",tier:5,effect:"ember",description:"เขาและปีกมังกร เกราะเพลิงชาดและคมเขี้ยวสังหาร",white:[0xffe1d8,0xff6969],black:[0x351b2a,0xff557e],glow:"#ff6969"},
} as const;
export type SkinId = keyof typeof skins;
export interface Profile {
  version: 1;
  xp: number;
  matches: number;
  wins: number;
  skin: SkinId;
  arena: ArenaId;
  /** Each physical piece keeps the square where it began the match as its slot. */
  loadouts: Record<Color, Partial<Record<Square, SkinId>>>;
  claimed: string[];
  economy: Economy;
}
export function levelProgress(xp: number) {
  const level = Math.floor(xp / 200) + 1;
  const title = level >= 4 ? "ราชัน" : level >= 3 ? "อัศวิน" : level >= 2 ? "ผู้พิทักษ์" : "นักรบฝึกหัด";
  return { level, current: xp % 200, next: 200, title };
}
export function isSkinUnlocked(profile: Profile, skin: SkinId) {
  return levelProgress(profile.xp).level >= skins[skin].level || !!profile.economy?.owned.includes(skin);
}
export function validSquare(value: unknown): value is Square {
  return typeof value === "string" && /^[a-h][1-8]$/.test(value);
}
export function pieceSkin(profile: Profile, color: Color, origin: Square): SkinId {
  return profile.loadouts[color][origin] ?? profile.skin;
}
function requireSkin(profile: Profile, skin: SkinId) {
  if (!Object.hasOwn(skins, skin)) throw Error("Unknown skin");
  if (!isSkinUnlocked(profile, skin)) throw Error("Skin is locked");
}
export function equipPiece(profile: Profile, color: Color, origin: Square, skin: SkinId): Profile {
  if ((color !== "w" && color !== "b") || !validSquare(origin)) throw Error("Invalid piece slot");
  requireSkin(profile, skin);
  return { ...profile, loadouts: { ...profile.loadouts, [color]: { ...profile.loadouts[color], [origin]: skin } } };
}
/** An army preset explicitly replaces all individual assignments. */
export function equipArmy(profile: Profile, skin: SkinId): Profile {
  requireSkin(profile, skin);
  return { ...profile, skin, loadouts: { w: {}, b: {} } };
}
export function readProfile(value: string | null): Profile {
  let raw;
  try { raw = JSON.parse(value || "null"); } catch {}
  const integer = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 10000000) : 0;
  const profile: Profile = {
    version: 1, xp: integer(raw?.xp), matches: integer(raw?.matches), wins: integer(raw?.wins), skin: "classic", arena: isArena(raw?.arena) ? raw.arena : "citadel", loadouts: { w: {}, b: {} }, economy: readEconomy(raw?.economy),
    claimed: Array.isArray(raw?.claimed) ? [...new Set<string>(raw.claimed.filter((id: unknown) => typeof id === "string" && id.length <= 100))] : [],
  };
  if (raw?.skin && Object.hasOwn(skins, raw.skin) && isSkinUnlocked(profile, raw.skin)) profile.skin = raw.skin;
  for (const color of ["w", "b"] as const) {
    const saved = raw?.loadouts?.[color];
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) continue;
    for (const [origin, skin] of Object.entries(saved)) {
      if (validSquare(origin) && typeof skin === "string" && Object.hasOwn(skins, skin) && isSkinUnlocked(profile, skin as SkinId)) {
        profile.loadouts[color][origin] = skin as SkinId;
      }
    }
  }
  return profile;
}
export function matchXP(winner: Color | null, color: Color, depth: number, stars: number) {
  const base = winner === color ? [80, 110, 150][Math.max(0, Math.min(2, depth - 1))] : winner === null ? 35 : 20;
  return base + Math.max(0, Math.min(3, stars)) * 20;
}
export function claimXP(profile: Profile, id: string, amount: number, win = false, match = false) {
  if (profile.claimed.includes(id)) return { profile, added: false, unlocked: [] as SkinId[] };
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 300) throw Error("Invalid XP reward");
  const next: Profile = { ...profile, xp: profile.xp + amount, matches: profile.matches + Number(match), wins: profile.wins + Number(win), claimed: [...profile.claimed, id] };
  const unlocked = (Object.keys(skins) as SkinId[]).filter((skin) => !isSkinUnlocked(profile, skin) && isSkinUnlocked(next, skin));
  return { profile: next, added: true, unlocked };
}
