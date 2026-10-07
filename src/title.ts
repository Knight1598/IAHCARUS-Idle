import { skins, levelProgress, isSkinUnlocked, type Profile, type SkinId } from "./profile";
import { training } from "./training";
export type TitleMode = "bot" | "local" | "training" | "online";
export interface LaunchSettings { mode: TitleMode; side: "w" | "b"; depth: string; skin: SkinId; training: string }
export class TitleScreen {
  readonly root: HTMLElement;
  private selected: TitleMode = "bot";
  private skin: SkinId = "classic";
  private profile: Profile | undefined;
  constructor(host: HTMLElement, offline: boolean, callbacks: {
    start: (settings: LaunchSettings) => void;
    resume: (skin: SkinId) => void;
    selectSkin: (skin: SkinId) => void;
  }) {
    this.root = document.createElement("section");
    this.root.id = "title-screen";
    this.root.setAttribute("aria-label", "หน้าหลัก Special Chess");
    this.root.innerHTML = `
      <div class="title-top"><span class="title-logo">♞ SPECIAL CHESS</span><span class="title-edition">${offline ? "OFFLINE ADVENTURE" : "THE ROYAL DUEL"}</span></div>
      <div class="title-layout"><section class="title-hero"><small>CHESS · RPG · ARENA</small><h1>ทุกหมาก<br>มีตำนาน</h1><p>เลือกกองทัพ เข้าประลอง และเติบโตเป็นราชัน<br>ท่าสเปเชียลและอีเวนท์รออยู่บนกระดาน</p>
      <div class="skin-preview" data-skin="classic" aria-hidden="true"><div class="preview-halo"></div><div class="preview-pawn"><i class="pawn-head"></i><i class="pawn-neck"></i><i class="pawn-base"></i></div><div class="preview-pedestal"></div><span>PROCEDURAL ARMORY</span></div>
      <div class="hero-skin"><small>YOUR ARMY</small><strong id="skin-preview-name"></strong><span id="skin-preview-label"></span></div></section>
      <section class="title-panel"><div class="commander-card"><div class="commander-emblem">♔</div><div><small id="commander-level"></small><strong id="commander-rank"></strong></div><span id="commander-record"></span></div><div class="xp-line"><span>ประสบการณ์</span><span id="title-xp"></span></div><progress id="title-xp-bar" max="200" value="0"></progress>
      <h2><span>01</span> เลือกการผจญภัย</h2><div class="title-modes">
      <button data-title-mode="bot"><strong>⚔ ศึกบอต</strong><small>คู่ต่อสู้ 3 ระดับ · รับ XP</small></button>
      <button data-title-mode="local"><strong>♟ ประลองสองคน</strong><small>ผลัดกันเดินบนเครื่องเดียว</small></button>
      <button data-title-mode="training"><strong>✦ สนามฝึก</strong><small>ฝึกท่าสเปเชียล · รับ XP ครั้งแรก</small></button>
      ${offline ? "" : '<button data-title-mode="online"><strong>⌘ ประลองออนไลน์</strong><small>สร้างห้องหรือเข้าร่วมกับเพื่อน</small></button>'}</div>
      <div id="launch-bot" class="launch-options"><label>ฝ่ายของคุณ<select id="launch-side"><option value="w">ฝ่ายขาว · เดินก่อน</option><option value="b">ฝ่ายดำ · เดินทีหลัง</option></select></label><label>ระดับศัตรู<select id="launch-depth"><option value="1">ง่าย</option><option value="2" selected>ปานกลาง</option><option value="3">ยาก</option></select></label></div>
      <label id="launch-training" hidden>เลือกฉากฝึก<select id="launch-scenario">${Object.entries(training).map(([key, value]) => `<option value="${key}">${value.name}</option>`).join("")}</select></label>
      <h2><span>02</span> เลือกชุดหมาก</h2><div class="skin-options">${Object.entries(skins).map(([id, skin]) => `<button data-skin-option="${id}" style="--skin-glow:${skin.glow}"><i></i><span><strong>${skin.name}</strong><small>${skin.label}</small></span><em></em></button>`).join("")}</div>
      <p id="title-mode-note" class="muted"></p><div class="title-start"><button id="launch-start" class="primary">เริ่มเกมใหม่</button><button id="launch-resume" hidden>เล่นเกมที่บันทึกไว้ต่อ</button></div><p class="title-save-note">โปรไฟล์ เลเวล และสกินบันทึกไว้ในเบราว์เซอร์นี้</p></section></div>`;
    host.prepend(this.root);
    this.root.querySelectorAll<HTMLButtonElement>("[data-title-mode]").forEach((button) => button.onclick = () => this.setMode(button.dataset.titleMode as TitleMode));
    this.root.querySelectorAll<HTMLButtonElement>("[data-skin-option]").forEach((button) => button.onclick = () => {
      const skin = button.dataset.skinOption as SkinId;
      if (!this.profile || !isSkinUnlocked(this.profile, skin)) return;
      this.skin = skin;
      callbacks.selectSkin(skin);
      this.renderSkins();
    });
    this.get<HTMLButtonElement>("#launch-start").onclick = () => callbacks.start({
      mode: this.selected, skin: this.skin,
      side: this.get<HTMLSelectElement>("#launch-side").value as "w" | "b",
      depth: this.get<HTMLSelectElement>("#launch-depth").value,
      training: this.get<HTMLSelectElement>("#launch-scenario").value,
    });
    this.get<HTMLButtonElement>("#launch-resume").onclick = () => callbacks.resume(this.skin);
  }
  private get<T extends HTMLElement = HTMLElement>(selector: string) { return this.root.querySelector<T>(selector)!; }
  private setMode(mode: TitleMode) {
    this.selected = mode;
    this.root.querySelectorAll<HTMLButtonElement>("[data-title-mode]").forEach((button) => {
      const active = button.dataset.titleMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    this.get("#launch-bot").hidden = mode !== "bot";
    this.get("#launch-training").hidden = mode !== "training";
    this.get("#title-mode-note").textContent = mode === "bot" ? "จบศึกและทำภารกิจเพื่อรับ XP ปลดล็อกชุดหมากใหม่" : mode === "training" ? "ผ่านท่าฝึกครั้งแรก รับ 40 XP ต่อฉาก" : mode === "online" ? "ห้องส่วนตัว · ฝ่ายละ 5 นาที · รับ XP เมื่อแข่งจบ" : "สนามประลองแบบผลัดกันเล่นบนเครื่องเดียว";
  }
  private renderSkins() {
    if (!this.profile) return;
    this.root.querySelectorAll<HTMLButtonElement>("[data-skin-option]").forEach((button) => {
      const id = button.dataset.skinOption as SkinId;
      const unlocked = isSkinUnlocked(this.profile!, id);
      button.disabled = !unlocked;
      button.classList.toggle("selected", id === this.skin);
      button.setAttribute("aria-pressed", String(id === this.skin));
      button.querySelector("em")!.textContent = unlocked ? id === this.skin ? "เลือกแล้ว" : "พร้อมใช้" : `Lv.${skins[id].level}`;
    });
    const skin = skins[this.skin];
    const preview = this.get(".skin-preview");
    preview.dataset.skin = this.skin;
    preview.style.setProperty("--skin-glow", skin.glow);
    this.get("#skin-preview-name").textContent = skin.name;
    this.get("#skin-preview-label").textContent = skin.label;
  }
  show(profile: Profile, settings: { mode: TitleMode; side: string; depth: string; resume: boolean; training?: string }) {
    this.profile = profile;
    this.skin = profile.skin;
    this.setMode(settings.mode);
    this.get<HTMLSelectElement>("#launch-side").value = settings.side;
    this.get<HTMLSelectElement>("#launch-depth").value = settings.depth;
    this.get<HTMLSelectElement>("#launch-scenario").value = settings.training || "pawn";
    this.get("#launch-resume").hidden = !settings.resume;
    this.get("#launch-resume").textContent = settings.mode === "online" ? "กลับเข้าห้องออนไลน์ · เวลาเดินต่อ" : "เล่นเกมที่บันทึกไว้ต่อ";
    const progress = levelProgress(profile.xp);
    this.get("#commander-level").textContent = `LEVEL ${progress.level}`;
    this.get("#commander-rank").textContent = progress.title;
    this.get("#commander-record").textContent = `${profile.wins} ชนะ · ${profile.matches} แมตช์`;
    this.get("#title-xp").textContent = `${progress.current} / ${progress.next} XP`;
    this.get<HTMLProgressElement>("#title-xp-bar").value = progress.current;
    this.renderSkins();
    this.root.hidden = false;
  }
}
