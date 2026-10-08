import type { Color, PieceSymbol, Square } from "chess.js";
import { skins, levelProgress, isSkinUnlocked, pieceSkin, type Profile, type SkinId } from "./profile";
import { initialArmySlots, avatarNames, skillNames, pieceNames } from "./cosmetics";
import { training } from "./training";
import { trials, rivals } from "./progression";
import { arenas, arenaIds, type ArenaId } from "./arenas";
import { dailyChallenge, dailyProgress, utcDay } from "./daily";
import "./lobby.css";
import "./royal-ui.css";

export type TitleMode = "bot" | "local" | "training" | "campaign" | "online" | "daily";
export interface LaunchSettings { mode: TitleMode; side: "w" | "b"; depth: string; skin: SkinId; training: string; trial?: string; day?: string }
interface TitleCallbacks {
  start: (settings: LaunchSettings) => void;
  resume: (skin: SkinId) => void;
  selectSkin: (skin: SkinId) => void;
  selectArena?: (arena: ArenaId) => void;
  selectPiece?: (color: Color, origin: Square, skin: SkinId) => void;
  preview?: (host: HTMLElement | null, color: Color, origin?: Square) => void;
  audition?: (piece: PieceSymbol, skin: SkinId) => void;
  settings?: (host: HTMLElement | null) => void;
  help?: () => void;
}
type MenuView = "title" | "menu" | "mode" | "setup" | "army" | "arena" | "armory" | "settings";
const journey: MenuView[] = ["mode", "setup", "army", "arena"];
const glyphs: Record<PieceSymbol, string> = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
const rivalCards = Object.entries(rivals).map(([depth, rival]) => ({ ...rival, depth, icon: ["♞", "♜", "♛"][Number(depth) - 1] }));

export class TitleScreen {
  readonly root: HTMLElement;
  private selected: TitleMode = "bot";
  private skin: SkinId = "classic";
  private profile: Profile | undefined;
  private armory = false;
  private color: Color = "w";
  private origin: Square = "b1";
  private piece: PieceSymbol = "n";
  private view: MenuView = "title";
  private armoryReturn: MenuView = "menu";
  private previewKey = "";
  private dailyDay = utcDay();

  constructor(host: HTMLElement, offline: boolean, private callbacks: TitleCallbacks) {
    this.root = document.createElement("section");
    this.root.id = "title-screen";
    this.root.setAttribute("aria-label", "ค่ายบัญชาการ Special Chess");
    this.root.innerHTML = `
      <header class="lobby-top"><div class="lobby-brand"><span>♞</span><div><strong>SPECIAL CHESS</strong><small>กองทัพของคุณ · ตำนานของคุณ</small></div></div><span class="lobby-edition">${offline ? "SOLO CHRONICLES" : "THE ROYAL DUEL"}</span><div class="commander-card"><div class="commander-emblem">♔</div><div><small id="commander-level"></small><strong id="commander-rank"></strong></div><span id="commander-record"></span></div></header>
      <div class="lobby-layout">
        <section class="lobby-showcase" aria-label="กองทัพสามมิติ"><div class="lobby-hero"><small>COMMAND YOUR LEGEND</small><h1>ทุกหมาก มีตำนาน</h1><p>วางแผนให้เฉียบคม · ปล่อยพลังให้สุดขีด</p></div>
          <div id="lobby-preview" class="skin-preview" data-skin="classic"><div class="preview-fallback" aria-hidden="true">♞</div></div>
          <div class="lobby-avatar"><span id="preview-piece-glyph">♞</span><div><small id="skin-preview-label"></small><strong id="skin-preview-name"></strong><span id="preview-skill"></span></div><button id="preview-attack" title="ทดลองท่าโจมตีและเสียง">▶ ทดลองท่าและเสียง</button></div>
          <div class="lobby-collection"><div class="collection-heading"><strong>ชุดกองทัพ</strong><span>เลือกชุดทั้งกองทัพ หรือแต่งแยกในคลังแสง</span></div><div class="skin-options">${Object.entries(skins).map(([id, skin]) => `<button data-skin-option="${id}" style="--skin-glow:${skin.glow}" title="ใช้ ${skin.name} กับทั้งกองทัพ"><i></i><span><strong>${skin.name}</strong><small>${skin.rarity}</small></span><em></em></button>`).join("")}</div></div>
        </section>
        <section class="lobby-command"><nav class="lobby-tabs" aria-label="เมนูค่าย"><button id="lobby-battle-tab" class="active" aria-pressed="true">⚔ เข้าสู่ศึก</button><button id="lobby-armory-tab" aria-pressed="false">✦ คลังแสง</button></nav>
          <div class="lobby-scroll">
            <section id="lobby-battle"><div class="lobby-section-title"><small>CHOOSE YOUR BATTLE</small><h2>เลือกสนามประลอง</h2></div><div class="title-modes">
              <button data-title-mode="bot"><strong>⚔ ศึกแม่ทัพ</strong><small>คู่ปรับ 3 ระดับ · เลเวลและรางวัล</small></button>
              <button data-title-mode="campaign"><strong>✧ บันทึกสงคราม</strong><small>ภารกิจสั้น · ฝ่าวงล้อมและปราบบอส</small></button>
              <button data-title-mode="local"><strong>♟ ศึกสองกองทัพ</strong><small>ประลองกับเพื่อนบนเครื่องเดียว</small></button>
              <button data-title-mode="training"><strong>✦ ฝึกยุทธวิธี</strong><small>โจทย์ต่อสู้ · ฝึกจังหวะสังหาร</small></button>
              ${offline ? "" : '<button data-title-mode="online"><strong>⌘ ดวลออนไลน์</strong><small>เปิดห้องท้าดวลกับเพื่อน</small></button>'}</div>
              <div class="arena-picker"><div class="lobby-section-title"><h3>โลกแห่งการประลอง</h3><small>8 สนาม · เอฟเฟกต์เฉพาะสนาม</small></div><div class="arena-options">${arenaIds.map((id) => `<button data-arena-option="${id}" style="--arena-glow:${arenas[id].color}" aria-pressed="false"><span>${arenas[id].icon}</span><strong>${arenas[id].name}</strong></button>`).join("")}</div><p id="arena-description"></p></div>
              <div id="launch-bot"><div class="lobby-section-title"><h3>คู่ปรับของคุณ</h3></div><div class="rival-options">${rivalCards.map((rival) => `<button data-rival-depth="${rival.depth}" data-rival-skin="${rival.skin}"><span>${rival.icon}</span><div><strong>${rival.name}</strong><small>${rival.title}</small><em>${rival.description}</em></div><b>${["ฝึกหัด", "ท้าทาย", "เชี่ยวชาญ"][Number(rival.depth) - 1]}</b></button>`).join("")}</div><div class="launch-options"><label>กองทัพที่คุณบัญชาการ<select id="launch-side"><option value="w">ฝ่ายขาว · เปิดศึกก่อน</option><option value="b">ฝ่ายดำ · ตอบโต้</option></select></label><label>ระดับคู่ปรับ<select id="launch-depth"><option value="1">อิกนิส · ง่าย</option><option value="2">เซเลน · ปานกลาง</option><option value="3">อัสตรา · ยาก</option></select></label></div></div>
              <label id="launch-training" hidden>ภารกิจฝึก<select id="launch-scenario">${Object.entries(training).map(([key, value]) => `<option value="${key}">${value.name}</option>`).join("")}</select></label><label id="launch-campaign" hidden>เลือกบทสงคราม<select id="launch-trial">${Object.entries(trials).map(([key, trial]) => `<option value="${key}">${trial.name}</option>`).join("")}</select></label><p id="title-mode-note" class="lobby-mode-note"></p>
            </section>
            <section id="lobby-armory" hidden><div class="lobby-section-title"><small>BUILD YOUR ARMY</small><h2>ทุกตัวเลือกชุดของตัวเองได้</h2><p>เลือกหมาก แล้วสวมอวตารและท่าสังหารที่ชอบ</p></div><div class="armory-sides"><button data-armory-side="w" class="active">กองทัพขาว</button><button data-armory-side="b">กองทัพดำ</button></div><div class="piece-slots">${(["w", "b"] as Color[]).flatMap((color) => initialArmySlots(color).map((slot) => `<button data-piece-origin="${slot.origin}" data-piece-color="${color}" data-piece-type="${slot.type}" title="${pieceNames[slot.type]} ${slot.origin}" aria-label="${pieceNames[slot.type]} ${slot.origin}"><span>${glyphs[slot.type]}</span><small>${slot.origin}</small><i></i></button>`)).join("")}</div><div class="armory-detail"><span id="armory-glyph">♞</span><div><small id="armory-slot"></small><strong id="armory-avatar"></strong><span id="armory-skill"></span></div></div><div class="piece-skin-options">${Object.entries(skins).map(([id, skin]) => `<button data-piece-skin-option="${id}" style="--skin-glow:${skin.glow}"><span class="piece-skin-avatar">♞</span><div><strong>${skin.name}</strong><small class="piece-skill-name"></small><span class="piece-skin-rarity">${skin.rarity}</span></div><em></em></button>`).join("")}</div><p class="armory-rule-note">ความหายากเพิ่มรายละเอียดอวตารและเอฟเฟกต์ ทุกชุดใช้กติกาหมากรุกเดียวกัน</p></section>
          </div>
          <footer class="lobby-launch"><div class="xp-line"><span>ความก้าวหน้าแม่ทัพ</span><span id="title-xp"></span></div><progress id="title-xp-bar" max="200" value="0"></progress><div class="title-start"><button id="launch-start" class="primary">⚔ เข้าสู่ศึก</button><button id="launch-resume" hidden>เล่นศึกที่บันทึกไว้ต่อ</button></div><span class="lobby-save-note">กองทัพและความก้าวหน้าบันทึกในเครื่องนี้</span></footer>
        </section>
      </div>`;
    this.composeFlow();
    host.prepend(this.root);
    this.root.querySelectorAll<HTMLButtonElement>("[data-arena-option]").forEach((button) => button.onclick = () => {
      callbacks.selectArena?.(button.dataset.arenaOption as ArenaId);
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-title-mode]").forEach((button) => button.onclick = () => {
      this.chooseMode(button.dataset.titleMode as TitleMode);
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-skin-option]").forEach((button) => button.onclick = () => {
      const skin = button.dataset.skinOption as SkinId;
      if (!this.profile || !isSkinUnlocked(this.profile, skin)) return;
      this.skin = skin;
      callbacks.selectSkin(skin);
      this.renderSkins();
      this.preview();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-piece-skin-option]").forEach((button) => button.onclick = () => {
      const skin = button.dataset.pieceSkinOption as SkinId;
      if (!this.profile || !isSkinUnlocked(this.profile, skin)) return;
      callbacks.selectPiece?.(this.color, this.origin, skin);
      this.renderSkins();
      this.preview();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-piece-origin]").forEach((button) => button.onclick = () => {
      this.origin = button.dataset.pieceOrigin as Square;
      this.piece = button.dataset.pieceType as PieceSymbol;
      this.renderSkins();
      this.preview();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-armory-side]").forEach((button) => button.onclick = () => {
      this.color = button.dataset.armorySide as Color;
      this.origin = this.color === "w" ? "b1" : "b8";
      this.piece = "n";
      this.renderSkins();
      this.preview();
    });
    this.get<HTMLButtonElement>("#lobby-battle-tab").onclick = () => this.go("mode");
    this.get<HTMLButtonElement>("#lobby-armory-tab").onclick = () => this.openArmory();
    this.get<HTMLSelectElement>("#launch-depth").onchange = () => this.renderRivals();
    this.get<HTMLSelectElement>("#launch-trial").onchange = () => this.setMode(this.selected);
    this.get<HTMLSelectElement>("#launch-scenario").onchange = () => this.setMode(this.selected);
    this.get<HTMLSelectElement>("#launch-side").onchange = () => {
      if (!this.armory) {
        this.color = this.get<HTMLSelectElement>("#launch-side").value as Color;
        this.origin = this.color === "w" ? "b1" : "b8";
        this.piece = "n";
        this.renderSkins();
        this.preview();
      }
    };
    this.root.querySelectorAll<HTMLButtonElement>("[data-rival-depth]").forEach((button) => button.onclick = () => {
      this.get<HTMLSelectElement>("#launch-depth").value = button.dataset.rivalDepth!;
      this.renderRivals();
    });
    this.get<HTMLButtonElement>("#preview-attack").onclick = () => callbacks.audition?.(this.piece, this.previewSkin());
    this.get<HTMLButtonElement>("#launch-start").onclick = () => callbacks.start({
      mode: this.selected, skin: this.skin,
      side: this.get<HTMLSelectElement>("#launch-side").value as "w" | "b",
      depth: this.get<HTMLSelectElement>("#launch-depth").value,
      training: this.get<HTMLSelectElement>("#launch-scenario").value,
      trial: this.get<HTMLSelectElement>("#launch-trial").value,
      day: this.selected === "daily" ? this.dailyDay : undefined,
    });
    this.get<HTMLButtonElement>("#launch-resume").onclick = () => callbacks.resume(this.skin);
    this.get<HTMLButtonElement>("#title-enter").onclick = () => this.go("menu");
    this.get<HTMLButtonElement>("#daily-enter").onclick = () => this.chooseMode("daily");
    this.get<HTMLButtonElement>("#flow-back").onclick = () => this.back();
    this.get<HTMLButtonElement>("#flow-next").onclick = () => {
      if (this.view === "mode") this.chooseMode(this.selected);
      else this.go(journey[Math.min(3, journey.indexOf(this.view) + 1)]);
    };
    this.root.querySelectorAll<HTMLButtonElement>("[data-menu-go]").forEach((button) => button.onclick = () => {
      if (button.dataset.menuGo === "armory") this.openArmory();
      else if (button.dataset.menuGo === "help") callbacks.help?.();
      else this.go(button.dataset.menuGo as MenuView);
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-journey-step]").forEach((button) => button.onclick = () => {
      const index = Number(button.dataset.journeyStep);
      if (index < journey.indexOf(this.view)) this.go(journey[index]);
    });
    document.addEventListener("keydown", (event) => {
      if (this.root.hidden || document.querySelector("dialog[open]")) return;
      if (event.key === "Escape" && this.view !== "title") { event.preventDefault(); this.back(); }
      else if (event.key === "Enter" && this.view === "title") { event.preventDefault(); this.go("menu"); }
    });
  }

  /** Keep one live army preview and expose one decision at a time. */
  private composeFlow() {
    const preview = this.get("#lobby-preview"), avatar = this.get(".lobby-avatar");
    const commander = this.get(".commander-card"), progress = this.get(".lobby-launch");
    const modes = this.get(".title-modes"), bot = this.get("#launch-bot");
    const trainingChoice = this.get("#launch-training"), campaign = this.get("#launch-campaign");
    const note = this.get("#title-mode-note"), collection = this.get(".lobby-collection");
    const arena = this.get(".arena-picker"), armory = this.get("#lobby-armory");
    const start = this.get("#launch-start"), resume = this.get("#launch-resume");
    const customize = this.get("#lobby-armory-tab");
    this.root.innerHTML = `<div class="menu-world"></div><div class="menu-shade"></div>
      <header class="game-menu-top"><button id="flow-back" aria-label="ย้อนกลับ">← <span>ย้อนกลับ</span></button><span class="game-wordmark">♞ SPECIAL CHESS</span><div class="menu-commander"></div></header>
      <main class="game-menu-content"><section class="menu-page title-cover" data-menu-view="title"><small>THE ROYAL CHRONICLES</small><h1>SPECIAL<br><em>CHESS</em></h1><p>ทุกหมากมีตำนาน · ทุกศึกมีเรื่องราว</p><button id="title-enter" class="primary">เริ่มตำนาน <span>→</span></button><small class="start-prompt">กด Enter หรือแตะเพื่อเริ่ม</small></section>
      <section class="menu-page" data-menu-view="menu" hidden><small>YOUR LEGEND CONTINUES</small><h1>บัญชาการ<br><em>ตำนานของคุณ</em></h1><nav class="main-game-menu" aria-label="เมนูหลัก"><div id="resume-slot"></div><button id="lobby-battle-tab">เข้าสู่ศึก <span>→</span></button><button data-menu-go="armory">คลังแสง <span>✦</span></button><button data-menu-go="settings">ตั้งค่า <span>⚙</span></button><button data-menu-go="help">วิธีเล่น <span>?</span></button></nav><div id="menu-progress"></div></section>
      <section class="menu-page" data-menu-view="mode" hidden><small>01 / CHOOSE YOUR BATTLE</small><h1>เลือกเส้นทาง</h1><p>วันนี้กองทัพของคุณจะสร้างตำนานแบบไหน?</p><div id="mode-slot"></div></section>
      <section class="menu-page" data-menu-view="setup" hidden><small>02 / PREPARE FOR BATTLE</small><h1 id="setup-heading">เตรียมศึก</h1><div id="setup-slot"></div></section>
      <section class="menu-page" data-menu-view="army" hidden><small>03 / YOUR ARMY</small><h1>กองทัพของคุณ</h1><p>เลือกชุดกองทัพ หรือแต่งอวตารให้หมากแต่ละตัว</p><div id="army-slot"></div></section>
      <section class="menu-page" data-menu-view="arena" hidden><small>04 / ENTER THE ARENA</small><h1>เลือกโลกแห่งศึก</h1><div id="arena-slot"></div><div id="battle-brief" class="battle-brief"></div></section>
      <section class="menu-page" data-menu-view="armory" hidden><small>THE ARMORY</small><h1>สร้างเอกลักษณ์</h1><div id="armory-slot-content"></div></section>
      <section class="menu-page" data-menu-view="settings" hidden><small>YOUR EXPERIENCE</small><h1>ภาพและเสียง</h1><div id="title-settings-slot"></div></section></main>
      <div class="menu-avatar-slot"></div><footer class="game-menu-bottom"><nav class="journey-steps" aria-label="ขั้นตอนเตรียมศึก">${["โหมด", "เตรียมศึก", "กองทัพ", "สนาม"].map((label, index) => `<button data-journey-step="${index}"><i>${index + 1}</i>${label}</button>`).join("")}</nav><div class="menu-continue"><button id="flow-next" class="primary">ต่อไป →</button></div></footer>`;
    this.get(".menu-world").append(preview); this.get(".menu-avatar-slot").append(avatar);
    this.get(".menu-commander").append(commander); this.get("#mode-slot").append(modes);
    this.get("#setup-slot").append(bot, trainingChoice, campaign, note);
    this.get("#army-slot").append(collection, customize); this.get("#arena-slot").append(arena);
    this.get("#armory-slot-content").append(armory); armory.hidden = false;
    this.get(".menu-continue").append(start); this.get("#resume-slot").append(resume);
    progress.querySelector(".title-start")?.remove(); progress.querySelector(".lobby-save-note")?.remove();
    this.get("#menu-progress").append(progress);
    customize.textContent = "✦ แต่งหมากรายตัว"; start.textContent = "เข้าสู่สนาม →";
    const dailyMode = document.createElement("button");
    dailyMode.dataset.titleMode = "daily";
    dailyMode.innerHTML = '<strong>◈ ศึกประจำวัน</strong><small>โจทย์ใหม่ · รางวัลต่อเนื่อง · รับสูงสุด 120 XP</small>';
    modes.prepend(dailyMode);
    const dailyCard = document.createElement("button");
    dailyCard.id = "daily-enter";
    dailyCard.innerHTML = '<span class="daily-emblem" aria-hidden="true">◈</span><span><small>DAILY RIFT</small><strong id="daily-name"></strong><span id="daily-reward"></span></span><b aria-hidden="true">→</b>';
    this.get(".main-game-menu").before(dailyCard);
    const brief = document.createElement("div"); brief.id = "daily-brief"; brief.hidden = true;
    brief.innerHTML = '<div class="daily-portal" aria-hidden="true">♛</div><h2 id="daily-title"></h2><p id="daily-story"></p><div class="daily-facts"><span id="daily-budget"></span><span id="daily-streak"></span><span id="daily-prize"></span></div><small>โจทย์เปลี่ยนทุกวัน 07:00 น. เวลาไทย (00:00 UTC)<br>เล่นซ้ำได้ · รางวัลรับครั้งเดียวต่อวัน</small>';
    this.get("#setup-slot").prepend(brief);
    const accents = ["◈", "⚔", "✧", "♟", "✦", "⌘"];
    modes.querySelectorAll<HTMLButtonElement>("button").forEach((button, index) => {
      const mark = document.createElement("span"); mark.className = "mode-emblem"; mark.textContent = accents[index]; mark.setAttribute("aria-hidden", "true"); button.prepend(mark);
      const label = button.querySelector("strong")!;
      label.textContent = label.textContent!.replace(/^\S+\s/, "");
    });
    this.get("#lobby-battle-tab").innerHTML = '<span class="menu-battle-icon" aria-hidden="true">⚔</span><span><strong>เข้าสู่ศึก</strong><small>บัญชาการกองทัพ สร้างตำนานของคุณ</small></span><b aria-hidden="true">→</b>';
    const facets = document.createElement("div"); facets.className = "menu-facets"; facets.setAttribute("aria-hidden", "true");
    facets.innerHTML = '<i></i><i></i><i></i>';
    this.root.prepend(facets);
    this.root.dataset.menuView = "title";
  }
  private openArmory() { this.armoryReturn = this.view; this.go("armory"); }
  private chooseMode(mode: TitleMode) {
    if (mode === "daily") {
      this.dailyDay = utcDay();
      const daily = dailyChallenge(this.dailyDay);
      this.get<HTMLSelectElement>("#launch-side").value = daily.trial.side;
      this.callbacks.selectArena?.(daily.arena);
    }
    this.setMode(mode); this.go("setup");
  }
  private back() {
    const index = journey.indexOf(this.view);
    this.go(this.view === "armory" ? this.armoryReturn : this.view === "settings" ? "menu" :
      index > 0 ? journey[index - 1] : index === 0 ? "menu" : "title");
  }
  private go(view: MenuView) {
    if (view === "menu") { this.dailyDay = utcDay(); this.refreshDaily(); }
    this.callbacks.settings?.(view === "settings" ? this.get("#title-settings-slot") : null);
    this.view = view; this.root.dataset.menuView = view; this.armory = view === "armory";
    this.root.querySelectorAll<HTMLElement>("[data-menu-view]").forEach((page) => { page.hidden = page.dataset.menuView !== view; page.scrollTop = 0; });
    this.get("#flow-back").hidden = view === "title";
    const step = journey.indexOf(view);
    this.get(".game-menu-bottom").hidden = step < 0;
    this.get("#flow-next").hidden = view === "arena";
    this.get<HTMLButtonElement>("#launch-start").hidden = view !== "arena";
    this.get<HTMLButtonElement>("#launch-start").disabled = view !== "arena";
    this.get("#flow-next").textContent = view === "setup" ? "จัดกองทัพ →" : view === "army" ? "เลือกสนาม →" : "เตรียมศึก →";
    this.root.querySelectorAll<HTMLButtonElement>("[data-journey-step]").forEach((button) => {
      const index = Number(button.dataset.journeyStep); button.disabled = index >= step;
      button.classList.toggle("current", index === step); button.classList.toggle("complete", index < step);
      button.setAttribute("aria-current", index === step ? "step" : "false");
    });
    if (!this.armory) { this.color = this.get<HTMLSelectElement>("#launch-side").value as Color; this.origin = this.color === "w" ? "b1" : "b8"; this.piece = "n"; }
    this.renderSkins(); this.updateBrief(); this.preview();
    const current = this.get<HTMLElement>(`[data-menu-view="${view}"]`);
    current.classList.remove("menu-enter"); void current.offsetWidth; current.classList.add("menu-enter");
    [...current.querySelectorAll<HTMLElement>("button:not(:disabled), select")].find((el) => el.getClientRects().length)?.focus({ preventScroll: true });
  }
  private updateBrief() {
    if (!this.profile) return;
    const modeNames = { bot: "ศึกแม่ทัพ", local: "ศึกสองกองทัพ", training: "สนามฝึก", campaign: "บันทึกสงคราม", online: "ดวลออนไลน์", daily: "ศึกประจำวัน" };
    this.get("#setup-heading").textContent = modeNames[this.selected];
    const opponent = this.selected === "daily" ? dailyChallenge(this.dailyDay).title : this.selected === "bot" ? rivals[Number(this.get<HTMLSelectElement>("#launch-depth").value) as 1 | 2 | 3].name : modeNames[this.selected];
    this.get("#battle-brief").textContent = `${opponent} · ${skins[this.skin].name} · ${arenas[this.profile.arena].name}`;
  }
  private get<T extends HTMLElement = HTMLElement>(selector: string) { return this.root.querySelector<T>(selector)!; }
  private previewSkin() { return this.profile && this.armory ? pieceSkin(this.profile, this.color, this.origin) : this.skin; }
  private preview() {
    const key = JSON.stringify([this.skin, this.profile?.arena, this.profile?.loadouts, this.color, this.armory ? this.origin : "army"]);
    if (key === this.previewKey) return;
    this.previewKey = key;
    this.callbacks.preview?.(this.get("#lobby-preview"), this.color, this.armory ? this.origin : undefined);
  }
  private renderRivals() {
    const depth = this.get<HTMLSelectElement>("#launch-depth").value;
    this.root.querySelectorAll<HTMLButtonElement>("[data-rival-depth]").forEach((button) => {
      const active = button.dataset.rivalDepth === depth;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  private setMode(mode: TitleMode) {
    this.selected = mode;
    this.root.querySelectorAll<HTMLButtonElement>("[data-title-mode]").forEach((button) => {
      const active = button.dataset.titleMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    this.get("#launch-bot").hidden = mode !== "bot";
    this.get("#launch-training").hidden = mode !== "training";
    this.get("#launch-campaign").hidden = mode !== "campaign";
    this.get("#daily-brief").hidden = mode !== "daily";
    this.refreshDaily();
    const trial = trials[this.get<HTMLSelectElement>("#launch-trial").value as keyof typeof trials];
    const scenario = training[this.get<HTMLSelectElement>("#launch-scenario").value as keyof typeof training];
    this.get("#title-mode-note").textContent = mode === "bot" ? "เอาชนะแม่ทัพและทำภารกิจ รับ XP ปลดล็อกอวตารใหม่" : mode === "campaign" ? `${trial?.story || "เรื่องราวสั้นและเป้าหมายเฉพาะ"} · รางวัลเมื่อผ่านครั้งแรก` : mode === "training" ? `${scenario?.hint || "ฝึกยุทธวิธี"} · ผ่านครั้งแรก รับ 40 XP` : mode === "online" ? "ห้องท้าดวลส่วนตัว · ฝ่ายละ 5 นาที · รับ XP เมื่อศึกจบ" : "เลือกกองทัพทั้งสองฝั่ง แล้วผลัดกันบัญชาการบนเครื่องเดียว";
    if (mode === "daily") this.get("#title-mode-note").textContent = dailyChallenge(this.dailyDay).trial.hint;
  }
  private refreshDaily() {
    const daily = dailyChallenge(this.dailyDay), progress = dailyProgress(this.profile?.claimed || [], this.dailyDay);
    this.get("#daily-name").textContent = daily.title;
    this.get("#daily-reward").textContent = `${progress.done ? "✓ สำเร็จแล้ววันนี้" : `+${progress.reward} XP`} · ต่อเนื่อง ${progress.streak} วัน`;
    this.get("#daily-enter").classList.toggle("completed", progress.done);
    this.get("#daily-title").textContent = daily.title;
    this.get("#daily-story").textContent = daily.trial.story;
    this.get("#daily-budget").textContent = `${daily.trial.maxMoves} ตาของคุณ`;
    this.get("#daily-streak").textContent = `ต่อเนื่อง ${progress.streak} วัน`;
    this.get("#daily-prize").textContent = progress.done ? "✓ รับรางวัลแล้ว" : `+${progress.reward} XP`;
  }
  private renderSkins() {
    if (!this.profile) return;
    this.root.querySelectorAll<HTMLButtonElement>("[data-skin-option]").forEach((button) => {
      const id = button.dataset.skinOption as SkinId;
      const unlocked = isSkinUnlocked(this.profile!, id);
      button.disabled = !unlocked;
      button.classList.toggle("selected", id === this.skin);
      button.setAttribute("aria-pressed", String(id === this.skin));
      button.querySelector("em")!.textContent = unlocked ? "สวมทั้งกองทัพ" : `Lv.${skins[id].level}`;
    });
    const id = this.previewSkin(), skin = skins[id];
    const preview = this.get(".skin-preview");
    preview.dataset.skin = id;
    preview.style.setProperty("--skin-glow", skin.glow);
    this.get("#skin-preview-name").textContent = this.armory ? avatarNames[id][this.piece] : skin.name;
    this.get("#skin-preview-label").textContent = this.armory ? `${pieceNames[this.piece]} ${this.origin} · ${skin.rarity}` : skin.label;
    this.get("#preview-skill").textContent = `${skillNames[id][this.piece]} · ${skin.rarity}`;
    this.get("#preview-piece-glyph").textContent = glyphs[this.piece];
    this.get("#armory-glyph").textContent = glyphs[this.piece];
    this.get("#armory-slot").textContent = `${this.color === "w" ? "ฝ่ายขาว" : "ฝ่ายดำ"} · ${pieceNames[this.piece]} ${this.origin}`;
    this.get("#armory-avatar").textContent = avatarNames[id][this.piece];
    this.get("#armory-skill").textContent = skillNames[id][this.piece];
    this.root.querySelectorAll<HTMLButtonElement>("[data-armory-side]").forEach((button) => {
      button.classList.toggle("active", button.dataset.armorySide === this.color);
      button.setAttribute("aria-pressed", String(button.dataset.armorySide === this.color));
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-piece-origin]").forEach((button) => {
      const color = button.dataset.pieceColor as Color, origin = button.dataset.pieceOrigin as Square;
      button.hidden = color !== this.color;
      const chosen = color === this.color && origin === this.origin;
      button.classList.toggle("selected", chosen);
      button.setAttribute("aria-pressed", String(chosen));
      const assigned = pieceSkin(this.profile!, color, origin);
      button.style.setProperty("--slot-glow", skins[assigned].glow);
      button.title = `${pieceNames[button.dataset.pieceType as PieceSymbol]} ${origin} · ${skins[assigned].name}`;
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-piece-skin-option]").forEach((button) => {
      const assigned = button.dataset.pieceSkinOption as SkinId, unlocked = isSkinUnlocked(this.profile!, assigned);
      button.disabled = !unlocked;
      button.classList.toggle("selected", id === assigned);
      button.setAttribute("aria-pressed", String(id === assigned));
      button.querySelector("strong")!.textContent = avatarNames[assigned][this.piece];
      button.querySelector(".piece-skill-name")!.textContent = skillNames[assigned][this.piece];
      button.querySelector(".piece-skin-avatar")!.textContent = glyphs[this.piece];
      button.querySelector("em")!.textContent = unlocked ? id === assigned ? "สวมอยู่" : "สวมชุด" : `Lv.${skins[assigned].level}`;
    });
  }
  refresh(profile: Profile) {
    this.profile = profile;
    this.skin = profile.skin;
    this.root.querySelectorAll<HTMLButtonElement>("[data-arena-option]").forEach((button) => {
      const active = button.dataset.arenaOption === profile.arena;
      button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
    });
    this.get("#arena-description").textContent = arenas[profile.arena].description;
    const progress = levelProgress(profile.xp);
    this.get("#commander-level").textContent = `LEVEL ${progress.level}`;
    this.get("#commander-rank").textContent = progress.title;
    this.get("#commander-record").textContent = `${profile.wins} ชนะ · ${profile.matches} ศึก`;
    this.get("#title-xp").textContent = `${progress.current} / ${progress.next} XP`;
    this.get<HTMLProgressElement>("#title-xp-bar").value = progress.current;
    this.renderSkins();
    this.refreshDaily();
    this.updateBrief();
    if (!this.root.hidden) this.preview();
  }
  show(profile: Profile, settings: { mode: TitleMode; side: string; depth: string; resume: boolean; training?: string; trial?: string; view?: "title" | "menu" }) {
    this.get<HTMLSelectElement>("#launch-side").value = settings.side;
    this.get<HTMLSelectElement>("#launch-depth").value = settings.depth;
    this.get<HTMLSelectElement>("#launch-scenario").value = settings.training || "pawn";
    if (settings.trial) this.get<HTMLSelectElement>("#launch-trial").value = settings.trial;
    this.setMode(settings.mode);
    this.get("#launch-resume").hidden = !settings.resume;
    this.get("#launch-resume").textContent = settings.mode === "online" ? "กลับเข้าห้องออนไลน์ · เวลาเดินต่อ" : "เล่นศึกที่บันทึกไว้ต่อ";
    this.color = settings.side === "b" ? "b" : "w";
    this.origin = this.color === "w" ? "b1" : "b8";
    this.piece = "n";
    this.refresh(profile);
    this.renderRivals();
    this.root.hidden = false;
    this.go(settings.view || "title");
  }
  hide() { this.root.hidden = true; this.callbacks.settings?.(null); this.previewKey = ""; this.callbacks.preview?.(null, this.color); }
}
