import { skins, isSkinUnlocked, type Profile, type SkinId } from "./profile";
import { skinPool, pullCost, pityLimit, forgeCosts } from "../shared/economy.js";
import { icon, geometricPiece } from "./design";
import { utcDay } from "./daily";
import "./economy.css";
export type EconomyAction = { type: "pull" } | { type: "daily" } | { type: "forge"; skin: SkinId };
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
export function treasuryHTML(profile: Profile, message = "เลือกเปิดผนึกหรือหลอมสกินที่ต้องการ", busy = false) {
  const wallet = profile.economy;
  return `<div class="wallet-balances"><article><span class="currency-mark">${icon("citadel")}</span><div><small>เครดิต</small><strong id="wallet-credits">${wallet.credits.toLocaleString("en-US")}</strong></div></article><article><span class="currency-mark violet">${icon("astral")}</span><div><small>เศษพลังงาน</small><strong id="wallet-shards">${wallet.shards.toLocaleString("en-US")}</strong></div></article></div>
    <p class="economy-note">เงินสำหรับเล่นในเกม · เริ่มต้น 750 เครดิต · ได้จากการเล่นและเสบียงประจำวัน · เซฟในเครื่องนี้</p>
    <section class="seal-chamber ${busy ? "revealing" : ""}"><div class="seal-art" aria-hidden="true"><i></i><i></i><span>${geometricPiece("q", "w")}</span></div><div><small>ASTRAL RELIQUARY</small><h2>ผนึกกองทัพดวงดาว</h2><p>สุ่มชุดกองทัพที่ใช้ได้กับหมากทุกตัว<br>สกินซ้ำเปลี่ยนเป็นเศษพลังงาน</p><button id="skin-pull" data-economy-action="pull" class="primary" ${busy || wallet.credits < pullCost ? "disabled" : ""}>${icon("shuffle")} เปิดผนึก · ${pullCost} เครดิต</button><p id="skin-pity">อีก ${pityLimit - wallet.pity} ครั้งรับ Golden Sovereign แน่นอน · ได้ตำนานแล้วนับใหม่</p></div></section>
    <p id="economy-status" class="economy-status" role="status" aria-live="polite">${escape(message)}</p>
    <div class="skin-odds">${skinPool.map(item => `<span style="--skin-glow:${skins[item.skin].glow}"><i></i><strong>${skins[item.skin].name}</strong><small>${wallet.pity >= pityLimit - 1 ? item.skin === "royal" ? 100 : 0 : item.chance}% · ซ้ำ +${item.shards} เศษ</small></span>`).join("")}</div>
    <button id="daily-credits" data-economy-action="daily" ${wallet.claimed.includes(`login:${utcDay()}`) || busy ? "disabled" : ""}>${icon("challenge")} ${wallet.claimed.includes(`login:${utcDay()}`) ? "รับเสบียงวันนี้แล้ว" : "รับเสบียงประจำวัน +100 เครดิต"}</button>
    <section class="forge"><small>CHOOSE YOUR LEGACY</small><h2>หลอมสกินที่เลือกเอง</h2><div>${skinPool.map(item => `<button data-economy-action="forge" data-forge-skin="${item.skin}" style="--skin-glow:${skins[item.skin].glow}" ${busy || isSkinUnlocked(profile, item.skin) || wallet.shards < forgeCosts[item.skin]! ? "disabled" : ""}><span>${geometricPiece("n", "w")}</span><strong>${skins[item.skin].name}</strong><small>${isSkinUnlocked(profile, item.skin) ? "มีสกินแล้ว" : `${forgeCosts[item.skin]} เศษพลังงาน`}</small></button>`).join("")}</div></section>
    <section class="wallet-history"><h2>รายการล่าสุด</h2>${wallet.log.slice(-8).reverse().map(item => `<div><span>${escape(item.label)}</span><strong>${item.delta > 0 ? "+" : ""}${item.delta} เครดิต</strong></div>`).join("") || "<p>เริ่มเล่นเพื่อสร้างเรื่องราวของคลังคุณ</p>"}</section>`;
}
