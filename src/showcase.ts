import type { PieceSymbol } from "chess.js";
import { skins, type SkinId } from "./profile";
import { arenas, arenaIds, type ArenaId } from "./arenas";
import { pieceNames } from "./cosmetics";
import { combatProfile } from "./combat-profiles";
import { icon, geometricPiece, logo } from "./design";
import type { MusicState } from "./sound";
import "./showcase.css";

export interface ShowcaseSettings {
  attacker: PieceSymbol;
  defender: PieceSymbol;
  attackerSkin: SkinId;
  defenderSkin: SkinId;
  arena: ArenaId;
}
export interface ShowcaseCallbacks {
  play: (settings: ShowcaseSettings) => void;
  stop: () => void;
  close: () => void;
  sound: (settings: { piece: PieceSymbol; skin: SkinId; cue: string; comparison: "A" | "B" }) => void;
  music: (state: MusicState) => void;
  event: (event: string) => void;
  enableSound: () => void;
  soundEnabled: () => boolean;
}
const pieces: PieceSymbol[] = ["p", "n", "b", "r", "q", "k"];
const skinIds = Object.keys(skins) as SkinId[];
const pieceRoles: Record<PieceSymbol, string> = {
  p: "หอกพลาสมา · แทงต่อเนื่อง", n: "ดาบมิติ · วาร์ปเข้าฟัน", b: "วงเวท · ลำแสงอาคม",
  r: "เกราะหนัก · ปืนพลังงาน", q: "คริสตัล · พายุเวท", k: "ดาบราชัน · โล่ดวงดาว",
};
const motionNames: Record<string, string> = {
  "spear-combo": "แทงหอกพลาสมาต่อเนื่อง", "warp-slash": "พุ่งผ่านมิติแล้วฟันข้ามมุม",
  "seal-beam": "ชาร์จตราเวทแล้วปล่อยลำแสง", "siege-cannon": "ตั้งโล่แล้วกระหน่ำปืนพลังงาน",
  "crystal-storm": "โคจรคริสตัลแล้วถล่มพายุเวท", "astral-cleave": "ยกดาบดวงดาวแล้วฟันพิพากษา",
};
const styleNames: Record<string, string> = {
  disciplined: "แม่นยำและสง่างาม", explosive: "แรงระเบิดและสะเก็ดเพลิง", precise: "จังหวะคมและผลึกแตก",
  phase: "หายตัวผ่านรอยแยกมิติ", ceremonial: "ท่วงท่าราชันและคลื่นพิพากษา",
};
const audioCues: { id: string; label: string; note: string }[] = [
  { id: "move", label: "เดินหมาก", note: "เสียงประจำคลาสระหว่างเคลื่อนที่" },
  { id: "lock", label: "ล็อกเป้า", note: "จับจังหวะก่อนเข้าปะทะ" },
  { id: "draw", label: "ชักอาวุธ", note: "รายละเอียดคมอาวุธและเกราะ" },
  { id: "charge", label: "ชาร์จพลัง", note: "แรงกดดันค่อย ๆ เพิ่มขึ้น" },
  { id: "dash", label: "พุ่งเข้าหา", note: "มิติของการเคลื่อนที่รวดเร็ว" },
  { id: "release", label: "ปล่อยพลัง", note: "เสียงโจมตีแรกของคัตซีน" },
  { id: "clash", label: "ปะทะโล่", note: "อาวุธกระทบแนวป้องกัน" },
  { id: "counter", label: "สวนกลับ", note: "จังหวะตอบโต้ของผู้ป้องกัน" },
  { id: "finisher", label: "ท่าสังหาร", note: "ปลดปล่อยการโจมตีตัดสิน" },
  { id: "impact", label: "กระแทก", note: "แรงกระแทก ช่วงเนื้อเสียง และหางเสียง" },
  { id: "armor", label: "เกราะสะท้อน", note: "การสั่นพ้องหลังถูกโจมตี" },
  { id: "disintegrate", label: "สลายพลัง", note: "พลังงานแตกกระจายหลังพ่ายแพ้" },
  { id: "death", label: "พ่ายแพ้", note: "จังหวะจบชีวิตของหมาก" },
  { id: "check", label: "ถูกรุก", note: "สัญญาณเตือนเฉพาะคลาส" },
];
const musicStates: { id: MusicState; label: string }[] = [
  { id: "menu", label: "หน้าไตเติล · จักรวาลลึกลับ" }, { id: "normal", label: "ระหว่างดวล · แรงกดดันสงบ" },
  { id: "threat", label: "ถูกคุกคาม · เริ่มตึงเครียด" }, { id: "check", label: "ถูกรุก · เร่งความตึงเครียด" },
  { id: "capture", label: "คัตซีน · เปิดพื้นที่ให้เสียงปะทะ" }, { id: "ultimate", label: "อัลติ · ปลดปล่อยพลัง" },
  { id: "mate", label: "รุกฆาต · ปิดฉาก" }, { id: "victory", label: "ชัยชนะ · แสงแห่งราชัน" },
  { id: "defeat", label: "พ่ายแพ้ · ความเงียบหลังศึก" },
];
const soundEvents: { id: string; label: string }[] = [
  { id: "check", label: "รุก" }, { id: "fork", label: "หมายหัวสองตัว" }, { id: "mate", label: "รุกฆาต" },
  { id: "double-check", label: "รุกร่วมสองตัว" }, { id: "discovered-check", label: "เปิดแนวรุก" },
  { id: "promotion", label: "เลื่อนขั้นเบี้ย" }, { id: "rescue", label: "ช่วยคิง" }, { id: "escape", label: "หลบหนี" },
  { id: "block", label: "ปิดแนวโจมตี" }, { id: "castle", label: "เข้าป้อม" }, { id: "en-passant", label: "กินผ่าน" },
  { id: "first-blood", label: "สังหารแรก" }, { id: "recapture", label: "กินคืน" }, { id: "queen-fallen", label: "ควีนล้ม" },
  { id: "comeback", label: "พลิกสถานการณ์" }, { id: "capture-streak", label: "สังหารต่อเนื่อง" },
  { id: "endgame", label: "เข้าสู่ท้ายเกม" }, { id: "mission", label: "เป้าหมายสำเร็จ" }, { id: "intro", label: "เปิดศึก" },
  { id: "victory", label: "ชนะ" }, { id: "defeat", label: "แพ้" }, { id: "ui", label: "ปุ่มและเมนู" },
];
const phaseCards = [
  { time: "0.0–0.4", label: "เผชิญหน้า", note: "กล้องเข้าประลอง" },
  { time: "0.4–1.0", label: "เปิดฉาก", note: "ท่าประจำคลาสและสกิน" },
  { time: "1.0–1.5", label: "ตอบโต้", note: "ปัด รับ หรือหลบ" },
  { time: "1.5–2.1", label: "ตัดสิน", note: "ปะทะและสะบัดแรงส่ง" },
  { time: "2.1–2.6", label: "สลายพลัง", note: "คืนมุมมองกระดาน" },
];

/** Presentation-only playground. The caller retains scene, audio and match ownership. */
export class CombatShowcase {
  readonly root: HTMLElement;
  readonly previewHost: HTMLElement;
  private panel: "combat" | "audio" = "combat";
  private settings: ShowcaseSettings = { attacker: "n", defender: "r", attackerSkin: "astral", defenderSkin: "frost", arena: "citadel" };
  private audioPiece: PieceSymbol = "n";
  private cue = "release";
  private skinA: SkinId = "classic";
  private skinB: SkinId = "astral";
  private playing = false;
  private previousFocus: HTMLElement | null = null;
  private readonly onKey = (event: KeyboardEvent) => {
    if (this.root.hidden) return;
    if (event.key === "Tab") {
      const controls = [...this.root.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter(control => control.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (first && (event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last || !this.root.contains(document.activeElement))) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      return;
    }
    if (event.key !== "Escape") return;
    if (document.querySelector("dialog[open]")) return;
    event.preventDefault();
    if (this.playing) { this.callbacks.stop(); this.setPlaying(false); }
    else this.close();
  };

  constructor(host: HTMLElement, private readonly callbacks: ShowcaseCallbacks) {
    this.root = document.createElement("section");
    this.root.id = "combat-showcase"; this.root.hidden = true; this.root.dataset.panel = this.panel;
    this.root.setAttribute("role", "dialog"); this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", "ห้องทดลองการปะทะและเสียง");
    this.root.innerHTML = `<header class="showcase-header"><div class="showcase-wordmark">${logo()}</div><div class="showcase-title"><small>THE COMBAT ATELIER</small><h1>ห้องทดลองปะทะ</h1></div><button id="showcase-close" aria-label="ปิดห้องทดลอง">${icon("close")}<span>กลับเมนู</span></button></header>
      <nav class="showcase-tabs" aria-label="ห้องทดลอง"><button data-showcase-tab="combat" class="active" aria-pressed="true">${icon("duel")} การต่อสู้</button><button data-showcase-tab="audio" aria-pressed="false">${icon("audio")} เสียงและบรรยากาศ</button><button id="showcase-enable-sound">${icon("audio-off")}<span>เปิดเสียงเพื่อฟัง</span></button></nav>
      <div class="showcase-body"><section class="showcase-stage" aria-label="เวทีทดลองสามมิติ"><div id="showcase-preview"></div><div class="showcase-stage-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="showcase-versus"><span id="showcase-attacker-title"></span><span class="showcase-versus-mark" aria-hidden="true">${icon("duel")}</span><span id="showcase-defender-title"></span></div><div class="showcase-stage-note"><span id="showcase-status" role="status" aria-live="polite">เลือกคู่ต่อสู้แล้วเริ่มทดลอง</span><small>การทดลองไม่เปลี่ยนศึกที่บันทึกไว้</small></div></section>
      <div class="showcase-control-zone"><section class="showcase-controls" data-showcase-panel="combat"><div class="showcase-panel-heading"><small>01 / SELECT YOUR FIGHTERS</small><h2>คู่ปะทะของคุณ</h2></div>${this.fighterControls("attacker", "ฝ่ายโจมตี", "w")}${this.fighterControls("defender", "ฝ่ายป้องกัน", "b")}<label class="showcase-select-label">สนามทดลอง<select id="showcase-arena">${arenaIds.map(id => `<option value="${id}">${arenas[id].name}</option>`).join("")}</select></label><button id="showcase-swap">${icon("shuffle")} สลับฝ่าย</button></section>
      <aside class="showcase-aside" data-showcase-panel="combat"><div class="showcase-panel-heading"><small>02 / THE CLASH</small><h2>หนึ่งการปะทะ ห้าจังหวะ</h2></div><div id="showcase-identity"></div><ol class="showcase-phases">${phaseCards.map((phase, index) => `<li><i>${String(index + 1).padStart(2, "0")}</i><div><strong>${phase.label}</strong><span>${phase.note}</span></div><small>${phase.time}s</small></li>`).join("")}</ol><p class="showcase-rule">ผู้โจมตีชนะในฉากทดลอง · เปลี่ยนคลาสและสกินเพื่อดูท่าเปิด การรับ และท่าสังหาร</p></aside>
      <section class="showcase-controls" data-showcase-panel="audio" hidden><div class="showcase-panel-heading"><small>01 / LISTEN TO THE DETAILS</small><h2>เสียงประจำหมาก</h2></div><div class="showcase-piece-grid" aria-label="คลาสเสียง">${pieces.map(piece => `<button data-audio-piece="${piece}" aria-pressed="${piece === this.audioPiece}" class="${piece === this.audioPiece ? "active" : ""}">${geometricPiece(piece)}<span>${pieceNames[piece]}</span></button>`).join("")}</div><label class="showcase-select-label">จังหวะเสียง<select id="showcase-cue">${audioCues.map(cue => `<option value="${cue.id}">${cue.label}</option>`).join("")}</select></label><p id="showcase-cue-note" class="showcase-rule"></p><div class="showcase-comparison"><label><span>A</span><select id="showcase-skin-a" aria-label="สกินเสียง A">${this.skinOptions(this.skinA)}</select></label><button id="showcase-listen-a" data-audio-requires="true">${icon("play")} ฟัง A</button><label><span>B</span><select id="showcase-skin-b" aria-label="สกินเสียง B">${this.skinOptions(this.skinB)}</select></label><button id="showcase-listen-b" data-audio-requires="true">${icon("play")} ฟัง B</button></div><p class="showcase-rule">เทียบจังหวะเสียงเดียวกันระหว่างสองสกิน · ฟังเนื้อเสียงและหางเสียงก่อนสลับชุด</p></section>
      <aside class="showcase-aside" data-showcase-panel="audio" hidden><div class="showcase-panel-heading"><small>02 / THE COSMIC SOUNDSCAPE</small><h2>อีเวนท์และดนตรี</h2></div><label class="showcase-select-label">สถานการณ์บนกระดาน<select id="showcase-event">${soundEvents.map(event => `<option value="${event.id}">${event.label}</option>`).join("")}</select></label><button id="showcase-listen-event" data-audio-requires="true">${icon("play")} ฟังเสียงอีเวนท์</button><label class="showcase-select-label">บรรยากาศและดนตรี<select id="showcase-music">${musicStates.map(state => `<option value="${state.id}">${state.label}</option>`).join("")}</select></label><button id="showcase-listen-music" data-audio-requires="true">${icon("audio")} ฟังบรรยากาศ</button><button id="showcase-audio-stop" data-audio-requires="true">${icon("pause")} หยุดการฟัง</button><div class="showcase-listening-note">${icon("audio")}<p>เสียงเริ่มเมื่อคุณกดเปิดเสียง · เพลงเปลี่ยนอารมณ์ตามสถานการณ์ และเว้นพื้นที่ให้เสียงปะทะ</p></div></aside></div></div>
      <footer class="showcase-footer"><div><small id="showcase-footer-label">COMBAT SHOWCASE</small><span id="showcase-footer-note">6 คลาส · 5 สกิน · 8 สนาม</span></div><div class="showcase-footer-actions"><button id="showcase-stop">${icon("pause")} ข้ามฉาก</button><button id="showcase-play" class="primary">${icon("play")} เริ่มปะทะ</button></div></footer>`;
    this.previewHost = this.get("#showcase-preview"); host.append(this.root);
    this.root.querySelectorAll<HTMLButtonElement>("[data-showcase-tab]").forEach(button => button.onclick = () => this.switchPanel(button.dataset.showcaseTab as "combat" | "audio"));
    this.root.querySelectorAll<HTMLButtonElement>("[data-showcase-piece]").forEach(button => button.onclick = () => {
      const role = button.dataset.showcaseRole as "attacker" | "defender";
      this.settings[role] = button.dataset.showcasePiece as PieceSymbol; this.refreshFighters();
    });
    this.get<HTMLSelectElement>("#showcase-attacker-skin").onchange = () => { this.settings.attackerSkin = this.get<HTMLSelectElement>("#showcase-attacker-skin").value as SkinId; this.refreshFighters(); };
    this.get<HTMLSelectElement>("#showcase-defender-skin").onchange = () => { this.settings.defenderSkin = this.get<HTMLSelectElement>("#showcase-defender-skin").value as SkinId; this.refreshFighters(); };
    this.get<HTMLSelectElement>("#showcase-arena").onchange = () => { this.settings.arena = this.get<HTMLSelectElement>("#showcase-arena").value as ArenaId; this.refreshFighters(); };
    this.get<HTMLButtonElement>("#showcase-swap").onclick = () => {
      this.settings = { ...this.settings, attacker: this.settings.defender, defender: this.settings.attacker, attackerSkin: this.settings.defenderSkin, defenderSkin: this.settings.attackerSkin };
      this.get<HTMLSelectElement>("#showcase-attacker-skin").value = this.settings.attackerSkin;
      this.get<HTMLSelectElement>("#showcase-defender-skin").value = this.settings.defenderSkin; this.refreshFighters();
    };
    this.get<HTMLButtonElement>("#showcase-play").onclick = () => { if (!this.playing) this.callbacks.play({ ...this.settings }); };
    this.get<HTMLButtonElement>("#showcase-stop").onclick = () => { this.callbacks.stop(); this.setPlaying(false); };
    this.get<HTMLButtonElement>("#showcase-close").onclick = () => this.close();
    this.get<HTMLButtonElement>("#showcase-enable-sound").onclick = () => { this.callbacks.enableSound(); this.refreshAudio(); };
    this.root.querySelectorAll<HTMLButtonElement>("[data-audio-piece]").forEach(button => button.onclick = () => {
      this.audioPiece = button.dataset.audioPiece as PieceSymbol;
      this.root.querySelectorAll<HTMLButtonElement>("[data-audio-piece]").forEach(item => { const selected = item === button; item.classList.toggle("active", selected); item.setAttribute("aria-pressed", String(selected)); });
    });
    this.get<HTMLSelectElement>("#showcase-cue").value = this.cue;
    this.get<HTMLSelectElement>("#showcase-cue").onchange = () => { this.cue = this.get<HTMLSelectElement>("#showcase-cue").value; this.refreshCue(); };
    this.get<HTMLSelectElement>("#showcase-skin-a").onchange = () => { this.skinA = this.get<HTMLSelectElement>("#showcase-skin-a").value as SkinId; };
    this.get<HTMLSelectElement>("#showcase-skin-b").onchange = () => { this.skinB = this.get<HTMLSelectElement>("#showcase-skin-b").value as SkinId; };
    this.get<HTMLButtonElement>("#showcase-listen-a").onclick = () => this.listen("A");
    this.get<HTMLButtonElement>("#showcase-listen-b").onclick = () => this.listen("B");
    this.get<HTMLButtonElement>("#showcase-listen-event").onclick = () => {
      if (!this.callbacks.soundEnabled()) return;
      const event = this.get<HTMLSelectElement>("#showcase-event").value; this.callbacks.event(event);
      this.get("#showcase-status").textContent = `กำลังฟัง: ${soundEvents.find(item => item.id === event)!.label}`;
    };
    this.get<HTMLButtonElement>("#showcase-listen-music").onclick = () => {
      if (!this.callbacks.soundEnabled()) return;
      const state = this.get<HTMLSelectElement>("#showcase-music").value as MusicState; this.callbacks.music(state);
      this.get("#showcase-status").textContent = `กำลังฟัง: ${musicStates.find(item => item.id === state)!.label}`;
    };
    this.get<HTMLButtonElement>("#showcase-audio-stop").onclick = () => { this.callbacks.stop(); this.get("#showcase-status").textContent = "หยุดการฟังแล้ว"; };
    document.addEventListener("keydown", this.onKey);
    this.refreshFighters(); this.refreshCue(); this.refreshAudio(); this.setPlaying(false);
  }
  private get<T extends HTMLElement = HTMLElement>(selector: string) { return this.root.querySelector<T>(selector)!; }
  private skinOptions(selected: SkinId) { return skinIds.map(id => `<option value="${id}"${id === selected ? " selected" : ""}>${skins[id].name}</option>`).join(""); }
  private fighterControls(role: "attacker" | "defender", label: string, color: "w" | "b") {
    return `<section class="showcase-fighter" data-fighter="${role}"><div class="showcase-fighter-label"><span>${icon(role === "attacker" ? "duel" : "shield")}</span><strong>${label}</strong></div><div class="showcase-piece-grid" aria-label="${label}">${pieces.map(piece => `<button data-showcase-role="${role}" data-showcase-piece="${piece}" aria-pressed="${piece === this.settings[role]}">${geometricPiece(piece, color)}<span>${pieceNames[piece]}</span></button>`).join("")}</div><label class="showcase-select-label">สกิน<select id="showcase-${role}-skin">${this.skinOptions(role === "attacker" ? this.settings.attackerSkin : this.settings.defenderSkin)}</select></label><p id="showcase-${role}-role" class="showcase-fighter-role"></p></section>`;
  }
  private refreshFighters() {
    for (const role of ["attacker", "defender"] as const) {
      const piece = this.settings[role], skin = role === "attacker" ? this.settings.attackerSkin : this.settings.defenderSkin;
      this.root.querySelectorAll<HTMLButtonElement>(`[data-showcase-role="${role}"]`).forEach(button => {
        const active = button.dataset.showcasePiece === piece; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
      });
      this.get(`#showcase-${role}-role`).textContent = pieceRoles[piece];
      this.get(`#showcase-${role}-title`).innerHTML = `${geometricPiece(piece, role === "attacker" ? "w" : "b")}<span><strong>${pieceNames[piece]}</strong><small>${skins[skin].name}</small></span>`;
    }
    const profile = combatProfile(this.settings.attacker, this.settings.attackerSkin);
    this.get("#showcase-identity").innerHTML = `<div class="showcase-signature">${icon(profile.vfx.signature === "crown" ? "king" : profile.vfx.signature === "cannon" ? "rook" : "ultimate")}<div><small>ท่าเฉพาะตัว</small><strong>${motionNames[profile.motion.opening]}</strong><span>${styleNames[profile.motion.skinStyle]}</span></div></div>`;
    this.root.style.setProperty("--showcase-attacker", skins[this.settings.attackerSkin].glow);
    this.root.style.setProperty("--showcase-defender", skins[this.settings.defenderSkin].glow);
  }
  private refreshCue() { this.get("#showcase-cue-note").textContent = audioCues.find(cue => cue.id === this.cue)?.note || ""; }
  private listen(comparison: "A" | "B") {
    if (!this.callbacks.soundEnabled()) return;
    const skin = comparison === "A" ? this.skinA : this.skinB;
    this.callbacks.sound({ piece: this.audioPiece, skin, cue: this.cue, comparison });
    this.get("#showcase-status").textContent = `${comparison}: ${pieceNames[this.audioPiece]} · ${skins[skin].name} · ${audioCues.find(cue => cue.id === this.cue)!.label}`;
  }
  private switchPanel(panel: "combat" | "audio") {
    if (this.panel === panel) return;
    this.callbacks.stop(); this.setPlaying(false); this.panel = panel; this.root.dataset.panel = panel;
    this.root.querySelectorAll<HTMLElement>("[data-showcase-panel]").forEach(section => { section.hidden = section.dataset.showcasePanel !== panel; });
    this.root.querySelectorAll<HTMLButtonElement>("[data-showcase-tab]").forEach(button => { const active = button.dataset.showcaseTab === panel; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); });
    this.get("#showcase-play").hidden = panel !== "combat"; this.get("#showcase-stop").hidden = panel !== "combat";
    this.get("#showcase-footer-label").textContent = panel === "combat" ? "COMBAT SHOWCASE" : "AUDIO SHOWCASE";
    this.get("#showcase-footer-note").textContent = panel === "combat" ? "6 คลาส · 5 สกิน · 8 สนาม" : "เทียบเสียง A/B · อีเวนท์ · ดนตรี 9 บรรยากาศ";
    this.get("#showcase-status").textContent = panel === "combat" ? "เลือกคู่ต่อสู้แล้วเริ่มทดลอง" : "เลือกคลาส จังหวะเสียง และสกินเพื่อฟังเทียบ";
    this.refreshAudio();
  }
  /** Scene completion and Skip share this hook; no timers emulate scene completion. */
  setPlaying(playing: boolean) {
    this.playing = playing; this.root.classList.toggle("is-playing", playing);
    this.get<HTMLButtonElement>("#showcase-play").disabled = playing;
    this.get<HTMLButtonElement>("#showcase-stop").disabled = !playing;
    this.root.querySelectorAll<HTMLButtonElement | HTMLSelectElement>("[data-showcase-piece], #showcase-attacker-skin, #showcase-defender-skin, #showcase-arena, #showcase-swap").forEach(control => { control.disabled = playing; });
    if (this.panel === "combat") this.get("#showcase-status").textContent = playing ? "กำลังปะทะ · กดข้ามฉากได้ทันที" : "เลือกคู่ต่อสู้แล้วเริ่มทดลอง";
  }
  /** Refresh after the caller finishes enabling or muting its one AudioContext. */
  refreshAudio() {
    const enabled = this.callbacks.soundEnabled(); this.root.dataset.sound = enabled ? "on" : "off";
    const button = this.get<HTMLButtonElement>("#showcase-enable-sound"); button.disabled = enabled;
    button.innerHTML = `${icon(enabled ? "audio" : "audio-off")}<span>${enabled ? "เปิดเสียงแล้ว" : "เปิดเสียงเพื่อฟัง"}</span>`;
    this.root.querySelectorAll<HTMLButtonElement>("[data-audio-requires]").forEach(control => { control.disabled = !enabled; });
  }
  get selection(): ShowcaseSettings { return { ...this.settings }; }
  private close() { this.hide(); this.callbacks.close(); }
  show() {
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.root.hidden = false; this.refreshAudio(); this.refreshFighters(); this.setPlaying(false);
    this.get<HTMLButtonElement>("#showcase-close").focus({ preventScroll: true });
  }
  hide() { this.callbacks.stop(); this.root.hidden = true; this.setPlaying(false); if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true }); }
  dispose() { this.callbacks.stop(); document.removeEventListener("keydown", this.onKey); this.root.remove(); }
}
