import { icon } from './design';
type Panel = "pause" | "settings" | "training" | "history" | "missions" | "room";
/** Reuses existing game controls; drawers never resize or move the board. */
export class ArenaHUD {
  readonly drawer: HTMLElement;
  private panels = new Map<Panel, HTMLElement>();
  private trigger: HTMLButtonElement | null = null;
  onPauseChange?: (paused: boolean) => void;
  private settingsHome: HTMLElement;
  private backdrop: HTMLButtonElement;
  constructor() {
    const get = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
    const stage = get("#stage"), aside = get("aside");
    this.drawer = aside;
    aside.id = "arena-drawer";
    const children = [...aside.children];
    aside.replaceChildren();
    aside.hidden = true;
    aside.setAttribute("aria-label", "เมนูสนามประลอง");
    aside.setAttribute("role", "dialog");
    aside.setAttribute("aria-modal", "true");
    aside.innerHTML = '<div class="drawer-head"><button id="drawer-back" aria-label="กลับเมนูพักเกม">←</button><h2 id="drawer-title"></h2><button id="drawer-close" aria-label="ปิดเมนู">✕</button></div>';
    const info = document.createElement("section");
    info.className = "hud-info";
    info.innerHTML = '<div class="hud-players"></div>';
    const players = info.firstElementChild!;
    for (const id of ["black-player", "white-player"]) players.append(children.find((el) => el.id === id)!);
    for (const id of ["status", "result", "xp-reward"]) info.append(children.find((el) => el.id === id)!);
    stage.append(info);
    const objective = document.createElement("button");
    objective.id = "objective-peek";
    objective.innerHTML = '<span aria-hidden="true">◈</span><span><strong id="objective-label"></strong><small id="objective-progress"></small></span><b aria-hidden="true">→</b>';
    objective.setAttribute("aria-label", "ติดตามเป้าหมายและภารกิจ");
    objective.setAttribute("aria-controls", "arena-drawer");
    objective.setAttribute("aria-expanded", "false");
    objective.onclick = () => this.open("missions", objective);
    stage.querySelector(".arena-bottom")!.append(objective);
    const readout = document.createElement("section");
    readout.id = "tactical-readout"; readout.hidden = true;
    readout.setAttribute("aria-label", "อ่านกระดานและพรีวิวการเดิน");
    readout.innerHTML = `<div class="tactical-head"><strong></strong><button id="tactics-expand" type="button" aria-expanded="false" aria-controls="tactical-detail" aria-label="ขยายข้อมูลอ่านกระดาน">${icon('target')}</button></div><span class="tactical-move"></span><small id="tactical-options"></small><div id="tactical-detail" hidden><p id="tactical-controls"></p><p id="tactical-support"></p><p id="tactical-check" hidden></p><small id="tactical-scope"></small><button class="game-help-trigger" data-help-title="อ่านแนวคุม ก่อนเลือกตาเดิน" data-help-body="หมากที่คุมช่องคำนวณจากรูปเดินปกติ รวมหมากที่ถูกตรึงอยู่ด้วย จึงไม่ใช่การรับประกันว่าจะกินได้จริง หรือว่าช่องที่ไม่มีผู้คุมจะปลอดภัย ในโหมดพิเศษต้องอ่านสกิลและอีเวนท์สนามประกอบ แนวเดินที่เรืองแสงคือทางที่กติกาอนุญาต ณ ตานี้" aria-label="คำอธิบายการอ่านกระดาน">${icon('help')}</button></div>`;
    const intel = document.createElement('section');
    intel.id = 'arena-intel'; intel.setAttribute('aria-label', 'ข้อมูลวางแผนข้างกระดาน');
    intel.append(readout); stage.append(intel);
    readout.querySelector<HTMLButtonElement>('#tactics-expand')!.onclick = () => {
      const button = readout.querySelector<HTMLButtonElement>('#tactics-expand')!;
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-label', expanded ? 'ย่อข้อมูลอ่านกระดาน' : 'ขยายข้อมูลอ่านกระดาน');
      readout.querySelector<HTMLElement>('#tactical-detail')!.hidden = !expanded;
    };
    stage.append(children.find((el) => el.id === "notice")!);
    const groups: Record<Panel, string[]> = {
      pause: [],
      settings: [".settings", "#side-control"], training: ["#training-panel"],
      history: [".history"], missions: [".material-panel", "#missions", "#battle-log-panel"],
      room: [".tabs", "#online-panel", ".match-head", "footer"],
    };
    for (const [name, selectors] of Object.entries(groups)) {
      const panel = document.createElement("section"); panel.dataset.hudPanel = name; panel.hidden = true;
      for (const selector of selectors) panel.append(children.find((el) => el.matches(selector))!);
      aside.append(panel); this.panels.set(name as Panel, panel);
    }
    const dock = document.createElement("nav");
    dock.id = "hud-dock"; dock.setAttribute("aria-label", "เครื่องมือสนามประลอง");
    dock.innerHTML = '<div class="hud-actions"></div><button id="pause-game" aria-label="เมนูพักเกม" aria-controls="arena-drawer" aria-expanded="false">☰ <span>เมนู</span></button>';
    const actions = dock.firstElementChild!;
    const undo = children.find((el) => el.id === "local-actions")!.querySelector<HTMLButtonElement>("#undo")!;
    undo.textContent = "↶"; undo.title = "ย้อนตา"; undo.setAttribute("aria-label", "ย้อนตา");
    actions.append(undo);
    for (const id of ["view", "flip", "skip"]) actions.append(get("#" + id));
    const board = children.find((el) => el.id === "board-details") as HTMLDetailsElement;
    board.querySelector("summary")!.textContent = "2D";
    board.querySelector("summary")!.setAttribute("aria-label", "เปิดหรือปิดกระดาน 2D");
    actions.append(board);
    const mute = document.createElement("button"); mute.id = "hud-mute"; mute.setAttribute("aria-label", "เปิดหรือปิดเสียง");
    mute.onclick = () => {
      const input = get<HTMLInputElement>("#sound"); input.checked = !input.checked;
      input.dispatchEvent(new Event("change")); this.syncSound();
    };
    actions.append(mute);
    const pause = this.panels.get("pause")!;
    pause.innerHTML = '<p class="pause-caption">พักวางแผน แล้วกลับไปสร้างตำนาน</p><button id="pause-resume" class="primary">กลับสู่การประลอง →</button><nav class="pause-menu"><button data-hud-open="missions">☆ ภารกิจและสถานการณ์</button><button data-hud-open="history">≡ บันทึกการเดิน</button><button data-hud-open="settings">⚙ ภาพและเสียง</button><button data-hud-open="training">✦ สนามฝึก</button><button data-hud-open="room">⌘ ห้องออนไลน์</button></nav><div class="pause-match-actions"></div>';
    const matchActions = pause.querySelector(".pause-match-actions")!;
    matchActions.append(children.find((el) => el.id === "local-actions")!, children.find((el) => el.id === "resign")!);
    const home = get("#title-return"); home.textContent = "กลับเมนูหลัก";
    const help = get("#help"); help.textContent = "วิธีเล่น"; help.classList.remove("icon");
    matchActions.append(home, help);
    this.settingsHome = this.panels.get("settings")!;
    this.backdrop = document.createElement("button");
    this.backdrop.id = "pause-backdrop"; this.backdrop.hidden = true; this.backdrop.tabIndex = -1;
    this.backdrop.setAttribute("aria-label", "กลับสู่เกม"); this.backdrop.onclick = () => this.close();
    stage.append(this.backdrop);
    stage.append(dock);
    stage.append(aside);
    aside.querySelectorAll<HTMLButtonElement>("[data-hud-open]").forEach((button) => {
      button.setAttribute("aria-controls", "arena-drawer"); button.setAttribute("aria-expanded", "false");
      button.onclick = () => {
        if (!aside.hidden && aside.dataset.panel === button.dataset.hudOpen) this.close();
        else this.open(button.dataset.hudOpen as Panel);
      };
    });
    get("#drawer-close").onclick = () => this.close();
    get("#drawer-back").onclick = () => this.open("pause");
    get("#pause-game").onclick = () => aside.hidden ? this.open("pause") : this.close();
    get("#pause-resume").onclick = () => this.close();
    board.addEventListener("toggle", () => { if (board.open) this.close(); });
    document.addEventListener("keydown", (event) => {
      if (get("#game-shell").hidden || document.querySelector("dialog[open]")) return;
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        if (!aside.hidden) { event.preventDefault(); this.close(); }
        else if (document.querySelector<HTMLButtonElement>(".battle-result-close")) {
          event.preventDefault(); document.querySelector<HTMLButtonElement>(".battle-result-close")!.click();
        }
        else if (board.open) board.open = false;
        else { event.preventDefault(); this.open("pause"); }
      }
      if (event.key === "Tab" && !aside.hidden) {
        const items = [...aside.querySelectorAll<HTMLElement>('button:not(:disabled), select, input, summary')].filter((el) => el.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    this.syncSound();
  }
  open(name: Panel, trigger?: HTMLButtonElement) {
    const titles = { pause: "พักการประลอง", settings: "ภาพและเสียง", training: "สนามฝึก", history: "บันทึกการประลอง", missions: "ภารกิจและสถานการณ์", room: "ห้องออนไลน์" };
    if (this.drawer.hidden) this.onPauseChange?.(true);
    for (const [key, panel] of this.panels) panel.hidden = key !== name;
    this.drawer.hidden = false; this.drawer.dataset.panel = name;
    this.backdrop.hidden = false;
    this.drawer.querySelector<HTMLElement>("#drawer-back")!.hidden = name === "pause";
    this.drawer.scrollTop = 0;
    this.drawer.querySelector("#drawer-title")!.textContent = titles[name];
    document.querySelectorAll<HTMLButtonElement>("[data-hud-open]").forEach((button) => button.setAttribute("aria-expanded", String(button.dataset.hudOpen === name)));
    this.trigger = trigger || document.querySelector("#pause-game");
    document.querySelector("#pause-game")!.setAttribute("aria-expanded", "true");
    document.querySelector("#objective-peek")!.setAttribute("aria-expanded", String(name === "missions"));
    this.drawer.querySelector<HTMLButtonElement>(name === "pause" ? "#pause-resume" : "#drawer-close")!.focus({ preventScroll: true });
  }
  close() {
    const wasOpen = !this.drawer.hidden;
    this.drawer.hidden = true;
    this.backdrop.hidden = true;
    if (wasOpen) this.onPauseChange?.(false);
    document.querySelectorAll<HTMLButtonElement>("[data-hud-open]").forEach((button) => button.setAttribute("aria-expanded", "false"));
    this.trigger?.focus({ preventScroll: true });
    this.trigger?.setAttribute("aria-expanded", "false");
    document.querySelector("#pause-game")!.setAttribute("aria-expanded", "false");
    document.querySelector("#objective-peek")!.setAttribute("aria-expanded", "false");
  }
  attachSettings(host: HTMLElement | null) {
    (host || this.settingsHome).prepend(document.querySelector(".settings")!);
  }
  syncSound() {
    const enabled = document.querySelector<HTMLInputElement>("#sound")!.checked;
    const button = document.querySelector<HTMLButtonElement>("#hud-mute")!;
    button.textContent = enabled ? "♫" : "♪";
    button.setAttribute("aria-pressed", String(enabled));
    button.title = enabled ? "ปิดเสียง" : "เปิดเสียง";
  }
}
