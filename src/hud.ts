type Panel = "settings" | "training" | "history" | "missions" | "room";
/** Reuses existing game controls; drawers never resize or move the board. */
export class ArenaHUD {
  readonly drawer: HTMLElement;
  private panels = new Map<Panel, HTMLElement>();
  private trigger: HTMLButtonElement | null = null;
  constructor() {
    const get = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
    const stage = get("#stage"), aside = get("aside");
    this.drawer = aside;
    aside.id = "arena-drawer";
    const children = [...aside.children];
    aside.replaceChildren();
    aside.hidden = true;
    aside.setAttribute("aria-label", "เมนูสนามประลอง");
    aside.innerHTML = '<div class="drawer-head"><h2 id="drawer-title"></h2><button id="drawer-close" aria-label="ปิดเมนู">✕</button></div>';
    const info = document.createElement("section");
    info.className = "hud-info";
    info.innerHTML = '<div class="hud-players"></div>';
    const players = info.firstElementChild!;
    for (const id of ["black-player", "white-player"]) players.append(children.find((el) => el.id === id)!);
    for (const id of ["status", "result", "xp-reward"]) info.append(children.find((el) => el.id === id)!);
    stage.append(info);
    stage.append(children.find((el) => el.id === "notice")!);
    const groups: Record<Panel, string[]> = {
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
    dock.innerHTML = '<div class="hud-actions"></div><div class="hud-menus"><button data-hud-open="settings">⚙ ตั้งค่า</button><button data-hud-open="training">✦ ฝึก</button><button data-hud-open="missions">☆ ภารกิจ</button><button data-hud-open="history">≡ บันทึก</button><button data-hud-open="room">⌘ โหมด</button></div>';
    const actions = dock.firstElementChild!;
    actions.append(children.find((el) => el.id === "local-actions")!);
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
    actions.append(children.find((el) => el.id === "resign")!);
    stage.append(dock);
    stage.append(aside);
    dock.querySelectorAll<HTMLButtonElement>("[data-hud-open]").forEach((button) => {
      button.setAttribute("aria-controls", "arena-drawer"); button.setAttribute("aria-expanded", "false");
      button.onclick = () => {
        if (!aside.hidden && aside.dataset.panel === button.dataset.hudOpen) this.close();
        else this.open(button.dataset.hudOpen as Panel);
      };
    });
    get("#drawer-close").onclick = () => this.close();
    board.addEventListener("toggle", () => { if (board.open) this.close(); });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        if (!aside.hidden) { event.preventDefault(); this.close(); }
        else if (board.open) board.open = false;
      }
    });
    this.syncSound();
  }
  open(name: Panel) {
    const titles = { settings: "ภาพและเสียง", training: "สนามฝึก", history: "บันทึกการประลอง", missions: "ภารกิจและสถานการณ์", room: "โหมดและห้องออนไลน์" };
    for (const [key, panel] of this.panels) panel.hidden = key !== name;
    this.drawer.hidden = false; this.drawer.dataset.panel = name;
    this.drawer.scrollTop = 0;
    this.drawer.querySelector("#drawer-title")!.textContent = titles[name];
    document.querySelectorAll<HTMLButtonElement>("[data-hud-open]").forEach((button) => button.setAttribute("aria-expanded", String(button.dataset.hudOpen === name)));
    this.trigger = document.querySelector(`[data-hud-open="${name}"]`);
    this.drawer.querySelector<HTMLButtonElement>("#drawer-close")!.focus({ preventScroll: true });
  }
  close() {
    this.drawer.hidden = true;
    document.querySelectorAll<HTMLButtonElement>("[data-hud-open]").forEach((button) => button.setAttribute("aria-expanded", "false"));
    this.trigger?.focus({ preventScroll: true });
  }
  syncSound() {
    const enabled = document.querySelector<HTMLInputElement>("#sound")!.checked;
    const button = document.querySelector<HTMLButtonElement>("#hud-mute")!;
    button.textContent = enabled ? "♫" : "♪";
    button.setAttribute("aria-pressed", String(enabled));
    button.title = enabled ? "ปิดเสียง" : "เปิดเสียง";
  }
}
