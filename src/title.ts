import type { Color, PieceSymbol, Square } from "chess.js";
import { skins, levelProgress, isSkinUnlocked, pieceSkin, type Profile, type SkinId } from "./profile";
import { initialArmySlots, avatarNames, skillNames, pieceNames } from "./cosmetics";
import { training } from "./training";
import { trials, rivals } from "./progression";
import { arenas, arenaIds, type ArenaId } from "./arenas";
import "./lobby.css";

export type TitleMode = "bot" | "local" | "training" | "campaign" | "online";
export interface LaunchSettings { mode: TitleMode; side: "w" | "b"; depth: string; skin: SkinId; training: string; trial?: string }
interface TitleCallbacks {
  start: (settings: LaunchSettings) => void;
  resume: (skin: SkinId) => void;
  selectSkin: (skin: SkinId) => void;
  selectArena?: (arena: ArenaId) => void;
  selectPiece?: (color: Color, origin: Square, skin: SkinId) => void;
  preview?: (host: HTMLElement | null, color: Color, origin?: Square) => void;
  audition?: (piece: PieceSymbol, skin: SkinId) => void;
}
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
    host.prepend(this.root);
    this.root.querySelectorAll<HTMLButtonElement>("[data-arena-option]").forEach((button) => button.onclick = () => {
      callbacks.selectArena?.(button.dataset.arenaOption as ArenaId);
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-title-mode]").forEach((button) => button.onclick = () => this.setMode(button.dataset.titleMode as TitleMode));
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
    this.get<HTMLButtonElement>("#lobby-battle-tab").onclick = () => this.setArmory(false);
    this.get<HTMLButtonElement>("#lobby-armory-tab").onclick = () => this.setArmory(true);
    this.get<HTMLSelectElement>("#launch-depth").onchange = () => this.renderRivals();
    this.get<HTMLSelectElement>("#launch-trial").onchange = () => this.setMode(this.selected);
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
    });
    this.get<HTMLButtonElement>("#launch-resume").onclick = () => callbacks.resume(this.skin);
  }

  private get<T extends HTMLElement = HTMLElement>(selector: string) { return this.root.querySelector<T>(selector)!; }
  private previewSkin() { return this.profile && this.armory ? pieceSkin(this.profile, this.color, this.origin) : this.skin; }
  private preview() { this.callbacks.preview?.(this.get("#lobby-preview"), this.color, this.armory ? this.origin : undefined); }
  private setArmory(value: boolean) {
    this.armory = value;
    if (!value) {
      this.color = this.get<HTMLSelectElement>("#launch-side").value as Color;
      this.origin = this.color === "w" ? "b1" : "b8";
      this.piece = "n";
    }
    this.get("#lobby-armory").hidden = !value;
    this.get("#lobby-battle").hidden = value;
    for (const [id, active] of [["#lobby-armory-tab", value], ["#lobby-battle-tab", !value]] as const) {
      this.get(id).classList.toggle("active", active);
      this.get(id).setAttribute("aria-pressed", String(active));
    }
    this.renderSkins();
    this.preview();
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
    const trial = trials[this.get<HTMLSelectElement>("#launch-trial").value as keyof typeof trials];
    this.get("#title-mode-note").textContent = mode === "bot" ? "เอาชนะแม่ทัพและทำภารกิจ รับ XP ปลดล็อกอวตารใหม่" : mode === "campaign" ? `${trial?.story || "เรื่องราวสั้นและเป้าหมายเฉพาะ"} · รางวัลเมื่อผ่านครั้งแรก` : mode === "training" ? "ผ่านภารกิจครั้งแรก รับ 40 XP แล้วนำทักษะไปใช้ในศึกจริง" : mode === "online" ? "ห้องท้าดวลส่วนตัว · ฝ่ายละ 5 นาที · รับ XP เมื่อศึกจบ" : "เลือกกองทัพทั้งสองฝั่ง แล้วผลัดกันบัญชาการบนเครื่องเดียว";
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
  }
  show(profile: Profile, settings: { mode: TitleMode; side: string; depth: string; resume: boolean; training?: string; trial?: string }) {
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
    this.preview();
  }
  hide() { this.root.hidden = true; this.callbacks.preview?.(null, this.color); }
}
