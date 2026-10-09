import "./lobby.css";

export interface ResultPresentation {
  title: string;
  subtitle?: string;
  xp?: number;
  mvp?: string;
  unlocks?: string[];
  replay?: boolean;
  continueLabel?: string;
  rematch?: boolean;
  rematchLabel?: string;
}
export class BattlePresentation {
  readonly root: HTMLElement;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(host: HTMLElement, private callbacks: { continue: () => void; home: () => void; replay?: () => void; rematch?: () => void }) {
    this.root = document.createElement("section");
    this.root.className = "battle-presentation";
    this.root.setAttribute("aria-label", "เปิดศึกและผลการแข่งขัน");
    host.append(this.root);
  }
  showIntro({ opponent, title, player }: { opponent: string; title?: string; player?: string }) {
    this.clear();
    const box = document.createElement("div");
    box.className = "battle-intro";
    box.innerHTML = '<small>THE ROYAL DUEL</small><strong></strong><span></span><button>เริ่มศึกทันที</button>';
    box.querySelector("strong")!.textContent = `${player || "กองทัพของคุณ"}  VS  ${opponent}`;
    box.querySelector("span")!.textContent = title || "ทุกการเดินคือจุดเริ่มต้นของตำนาน";
    box.querySelector("button")!.onclick = () => this.clear();
    this.root.append(box);
    this.timer = setTimeout(() => this.clear(), 900);
  }
  showResult(result: ResultPresentation) {
    this.clear();
    const box = document.createElement("div");
    box.className = "battle-result";
    box.innerHTML = '<button class="battle-result-close" title="ปิดผลศึก" aria-label="ปิดผลศึก">×</button><small>BATTLE CHRONICLE</small><h2></h2><p></p><div class="battle-result-xp"></div><div class="battle-result-mvp"></div><div class="battle-result-unlocks"></div><div class="battle-result-actions"><button class="primary" data-result="continue">ศึกถัดไป</button><button data-result="home">กลับค่าย</button><button data-result="replay">ชมท่าสุดท้าย</button></div>';
    box.querySelector("h2")!.textContent = result.title;
    box.querySelector("p")!.textContent = result.subtitle || "บันทึกผลงานของกองทัพและกลับมาแข็งแกร่งกว่าเดิม";
    const xp = box.querySelector<HTMLElement>(".battle-result-xp")!;
    xp.textContent = `+${result.xp || 0} XP`; xp.hidden = !result.xp;
    const mvp = box.querySelector<HTMLElement>(".battle-result-mvp")!;
    mvp.textContent = `หมากเด่นประจำศึก · ${result.mvp || ""}`; mvp.hidden = !result.mvp;
    const unlocks = box.querySelector<HTMLElement>(".battle-result-unlocks")!;
    unlocks.textContent = `ปลดล็อก · ${(result.unlocks || []).join(" · ")}`; unlocks.hidden = !result.unlocks?.length;
    box.querySelector<HTMLButtonElement>(".battle-result-close")!.onclick = () => this.clear();
    const next = box.querySelector<HTMLButtonElement>('[data-result="continue"]')!;
    next.textContent = result.continueLabel || "ศึกถัดไป";
    next.onclick = () => { this.clear(); this.callbacks.continue(); };
    box.querySelector<HTMLButtonElement>('[data-result="home"]')!.onclick = () => { this.clear(); this.callbacks.home(); };
    const replay = box.querySelector<HTMLButtonElement>('[data-result="replay"]')!;
    replay.hidden = !this.callbacks.replay || result.replay === false;
    replay.onclick = () => { this.clear(); this.callbacks.replay?.(); };
    if (result.rematch && this.callbacks.rematch) {
      const rematch = document.createElement("button"); rematch.dataset.result = "rematch"; rematch.textContent = result.rematchLabel || "รีแมตช์ · สลับสี";
      rematch.onclick = () => { this.clear(); this.callbacks.rematch?.(); };
      box.querySelector(".battle-result-actions")!.append(rematch);
    }
    this.root.append(box);
  }
  clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.root.replaceChildren();
  }
}
