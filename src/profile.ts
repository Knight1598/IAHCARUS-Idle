import type { Color } from "chess.js";

export const skins = {
  classic: { name: "Royal Origin", label: "ราชันต้นกำเนิด", level: 1, white: [0xe4edf4, 0x39d9e8], black: [0x222937, 0xae70ff], glow: "#39d9e8" },
  ember: { name: "Ember Knights", label: "อัศวินเพลิง", level: 1, white: [0xffead0, 0xffae42], black: [0x342229, 0xff654f], glow: "#ffae42" },
  frost: { name: "Frost Guard", label: "ผู้พิทักษ์เหมันต์", level: 1, white: [0xe1f5ff, 0x78d9ff], black: [0x1b2b43, 0x699eff], glow: "#78d9ff" },
  astral: { name: "Astral Order", label: "ภาคีดวงดาว", level: 2, white: [0xf2e5ff, 0xe2a0ff], black: [0x2b2240, 0xb389ff], glow: "#e2a0ff" },
  royal: { name: "Golden Sovereign", label: "ราชันทองคำ", level: 4, white: [0xffefd3, 0xf4c66d], black: [0x233731, 0x78e6b2], glow: "#f4c66d" },
} as const;
export type SkinId = keyof typeof skins;
export interface Profile {
  version: 1;
  xp: number;
  matches: number;
  wins: number;
  skin: SkinId;
  claimed: string[];
}
export function levelProgress(xp: number) {
  const level = Math.floor(xp / 200) + 1;
  const title = level >= 4 ? "ราชัน" : level >= 3 ? "อัศวิน" : level >= 2 ? "ผู้พิทักษ์" : "นักรบฝึกหัด";
  return { level, current: xp % 200, next: 200, title };
}
export function isSkinUnlocked(profile: Profile, skin: SkinId) {
  return levelProgress(profile.xp).level >= skins[skin].level;
}
export function readProfile(value: string | null): Profile {
  let raw;
  try { raw = JSON.parse(value || "null"); } catch {}
  const integer = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 10000000) : 0;
  const profile: Profile = {
    version: 1, xp: integer(raw?.xp), matches: integer(raw?.matches), wins: integer(raw?.wins), skin: "classic",
    claimed: Array.isArray(raw?.claimed) ? [...new Set<string>(raw.claimed.filter((id: unknown) => typeof id === "string" && id.length <= 100))] : [],
  };
  if (raw?.skin && Object.hasOwn(skins, raw.skin) && isSkinUnlocked(profile, raw.skin)) profile.skin = raw.skin;
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
