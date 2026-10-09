import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { skins, levelProgress, isSkinUnlocked, pieceSkin, type Profile, type SkinId } from "./profile";
import { initialArmySlots, avatarNames, skillNames, pieceNames } from "./cosmetics";
import { training } from "./training";
import { trials, rivals } from "./progression";
import { arenas, arenaIds, type ArenaId } from "./arenas";
import { dailyChallenge, dailyProgress, utcDay } from "./daily";
import { skillBudget, skillCosts, skillSpend, skillPieces, botDraft, botBan, enemyOf, type SkillChoice, type SkillBan } from './duel-draft';
import { ultimates, alternateUltimates, readSpecialConfig, type SpecialConfig } from "./special";
import { icon, geometricPiece, logo } from "./design";
import { modeDefinitions, draftBudget, draftCosts, defaultDraft, validateDraft, variantInitialFen, encodeChallenge, decodeChallenge, type VariantId } from "./variants";
import { economicModes, economicDefinition, isEconomicMode, type EconomicMode } from "../shared/economy.js";
import { treasuryHTML, type EconomyAction } from "./economy-ui";
import "./lobby.css";
import "./special.css";
import "./royal-ui.css";

export type TitleMode = "bot" | "local" | "training" | "campaign" | "online" | "daily" | "special" | VariantId | EconomicMode;
export interface LaunchSettings { mode: TitleMode; side: "w" | "b"; depth: string; skin: SkinId; training: string; trial?: string; day?: string; special?: SpecialConfig; opponent?: "bot" | "local"; variant?: { seed: number; draft?: PieceSymbol[]; round?: number } }
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
  showcase?: () => void;
  economy?: (action: EconomyAction) => string;
}
type MenuView = "title" | "menu" | "mode" | "setup" | "skills" | "army" | "arena" | "armory" | "settings" | "treasury";
const journey: MenuView[] = ["mode", "setup", "skills", "army", "arena"];
const glyphs = Object.fromEntries((["p", "n", "b", "r", "q", "k"] as PieceSymbol[]).map((piece) => [piece, geometricPiece(piece, "w")])) as Record<PieceSymbol, string>;
type ModeCategory = "duel" | "arena" | "tactics" | "economy";
const variantIds: VariantId[] = ["draft", "score", "control", "mirror", "rush", "chaos"];
const isVariant = (mode: TitleMode): mode is VariantId => variantIds.includes(mode as VariantId);
const variantFor = (mode: TitleMode): VariantId | undefined => {
  const base = economicDefinition(mode)?.base || mode;
  return variantIds.includes(base as VariantId) ? base as VariantId : undefined;
};
const categoryFor = (mode: TitleMode): ModeCategory => isEconomicMode(mode) ? "economy" : ["daily", "campaign", "training", "rush"].includes(mode) ? "tactics" : isVariant(mode) ? "arena" : "duel";
const rivalCards = Object.entries(rivals).map(([depth, rival]) => ({ ...rival, depth, icon: geometricPiece((["n", "r", "q"] as PieceSymbol[])[Number(depth) - 1], "b") }));

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
  private economyMessage = "เลือกเปิดผนึกหรือหลอมสกินที่ต้องการ";
  private economyBusyUntil = 0;
  private category: ModeCategory = "duel";
  private seed = this.freshSeed();
  private special = readSpecialConfig();
  private draftSide:Color="w";
  private draftPhase:"ban"|"loadout"|"reveal"="ban";
  private draft: PieceSymbol[] = [...defaultDraft];

  constructor(host: HTMLElement, offline: boolean, private callbacks: TitleCallbacks) {
    this.root = document.createElement("section");
    this.root.id = "title-screen";
    this.root.setAttribute("aria-label", "เมนูเกม Special Chess");
    this.root.innerHTML = `
      <header class="lobby-top"><div class="lobby-brand"><span>${icon("knight")}</span><div><strong>SPECIAL CHESS</strong><small>อ่านเกมให้ขาด · ชนะด้วยฝีมือ</small></div></div><span class="lobby-edition">${offline ? "TACTICAL ARENA" : "THE ROYAL DUEL"}</span><div class="commander-card"><div class="commander-emblem">${icon("profile")}</div><div><small id="commander-level"></small><strong id="commander-rank"></strong></div><span id="commander-record"></span></div></header>
      <div class="lobby-layout">
        <section class="lobby-showcase" aria-label="กองทัพสามมิติ"><div class="lobby-hero"><small>COMMAND THE BOARD</small><h1>ทุกหมาก มีจังหวะ</h1><p>วางแผนให้เฉียบคม · ปล่อยพลังให้สุดขีด</p></div>
          <div id="lobby-preview" class="skin-preview" data-skin="classic"><div class="preview-fallback" aria-hidden="true">${geometricPiece("n", "w")}</div></div>
          <div class="lobby-avatar"><span id="preview-piece-glyph">${geometricPiece("n", "w")}</span><div><small id="skin-preview-label"></small><strong id="skin-preview-name"></strong><span id="preview-skill"></span></div><button id="preview-attack" title="ทดลองท่าโจมตีและเสียง">${icon("play")} ทดลองท่าและเสียง</button></div>
          <div class="lobby-collection"><div class="collection-heading"><strong>ชุดกองทัพ</strong><span>เลือกชุดทั้งกองทัพ หรือแต่งแยกในคลังแสง</span></div><div class="skin-options">${Object.entries(skins).map(([id, skin]) => `<button data-skin-option="${id}" style="--skin-glow:${skin.glow}" title="ใช้ ${skin.name} กับทั้งกองทัพ"><i></i><span><strong>${skin.name}</strong><small>${skin.rarity} · เอฟเฟกต์ ${skin.tier}/5</small></span><em></em></button>`).join("")}</div></div>
        </section>
        <section class="lobby-command"><nav class="lobby-tabs" aria-label="เมนูค่าย"><button id="lobby-battle-tab" class="active" aria-pressed="true">${icon("duel")} เข้าสู่ศึก</button><button id="lobby-armory-tab" aria-pressed="false">${icon("armory")} คลังแสง</button></nav>
          <div class="lobby-scroll">
            <section id="lobby-battle"><div class="lobby-section-title"><small>CHOOSE YOUR BATTLE</small><h2>เลือกสนามประลอง</h2></div><div class="title-modes">
              <button data-title-mode="special"><strong>Special Duel</strong><small>เลือก 12 สกิล · ตั้งชาร์จ/ใช้ซ้ำ · 3 รูปแบบกระดาน</small></button>
              <button data-title-mode="bot"><strong>ศึกแม่ทัพ</strong><small>ดวลกับบอต 3 ระดับ · วางแผนแล้วปะทะ</small></button>
              <button data-title-mode="campaign"><strong>โจทย์ยุทธวิธี</strong><small>ช่วยคิง · ขู่สองตัว · รุกฆาต</small></button>
              <button data-title-mode="local"><strong>ศึกสองกองทัพ</strong><small>ประลองกับเพื่อนบนเครื่องเดียว</small></button>
              <button data-title-mode="training"><strong>ฝึกยุทธวิธี</strong><small>โจทย์ต่อสู้ · ฝึกจังหวะสังหาร</small></button>
              ${offline ? "" : '<button data-title-mode="online"><strong>ดวลออนไลน์</strong><small>เปิดห้องท้าดวลกับเพื่อน</small></button>'}</div>
              <div class="arena-picker"><div class="lobby-section-title"><h3>โลกแห่งการประลอง</h3><small>8 สนาม · เอฟเฟกต์เฉพาะสนาม</small></div><div class="arena-options">${arenaIds.map((id) => `<button data-arena-option="${id}" style="--arena-glow:${arenas[id].color}" aria-pressed="false"><span>${icon(id)}</span><strong>${arenas[id].name}</strong></button>`).join("")}</div><p id="arena-description"></p></div>
              <div id="launch-bot"><div class="lobby-section-title"><h3>คู่ปรับของคุณ</h3></div><div class="rival-options">${rivalCards.map((rival) => `<button data-rival-depth="${rival.depth}" data-rival-skin="${rival.skin}"><span>${rival.icon}</span><div><strong>${rival.name}</strong><small>${rival.title}</small><em>${rival.description}</em></div><b>${["ฝึกหัด", "ท้าทาย", "เชี่ยวชาญ"][Number(rival.depth) - 1]}</b></button>`).join("")}</div><div class="launch-options"><label id="launch-side-choice">กองทัพที่คุณบัญชาการ<select id="launch-side"><option value="w">ฝ่ายขาว · เปิดศึกก่อน</option><option value="b">ฝ่ายดำ · ตอบโต้</option></select></label><label id="launch-depth-choice">ระดับคู่ปรับ<select id="launch-depth"><option value="1">อิกนิส · ง่าย</option><option value="2">เซเลน · ปานกลาง</option><option value="3">อัสตรา · ยาก</option></select></label></div></div>
              <label id="launch-training" hidden>ภารกิจฝึก<select id="launch-scenario">${Object.entries(training).map(([key, value]) => `<option value="${key}">${value.name}</option>`).join("")}</select></label><label id="launch-campaign" hidden>เลือกโจทย์หมากรุก<select id="launch-trial">${Object.entries(trials).map(([key, trial]) => `<option value="${key}">${trial.name}</option>`).join("")}</select></label><p id="title-mode-note" class="lobby-mode-note"></p>
            </section>
            <section id="lobby-armory" hidden><div class="lobby-section-title"><small>BUILD YOUR ARMY</small><h2>ทุกตัวเลือกชุดของตัวเองได้</h2><p>เลือกหมาก แล้วสวมอวตารและท่าสังหารที่ชอบ</p></div><div class="armory-sides"><button data-armory-side="w" class="active">กองทัพขาว</button><button data-armory-side="b">กองทัพดำ</button></div><div class="piece-slots">${(["w", "b"] as Color[]).flatMap((color) => initialArmySlots(color).map((slot) => `<button data-piece-origin="${slot.origin}" data-piece-color="${color}" data-piece-type="${slot.type}" title="${pieceNames[slot.type]} ${slot.origin}" aria-label="${pieceNames[slot.type]} ${slot.origin}"><span>${glyphs[slot.type]}</span><small>${slot.origin}</small><i></i></button>`)).join("")}</div><div class="armory-detail"><span id="armory-glyph">${geometricPiece("n", "w")}</span><div><small id="armory-slot"></small><strong id="armory-avatar"></strong><span id="armory-skill"></span></div></div><div class="piece-skin-options">${Object.entries(skins).map(([id, skin]) => `<button data-piece-skin-option="${id}" style="--skin-glow:${skin.glow}"><span class="piece-skin-avatar">${geometricPiece("n", "w")}</span><div><strong>${skin.name}</strong><small class="piece-skill-name"></small><span class="piece-skin-rarity">${skin.rarity} · เอฟเฟกต์ ${skin.tier}/5</span><small class="skin-effect-description">${skin.description}</small></div><em></em></button>`).join("")}</div><p class="armory-rule-note">ความหายากเพิ่มรายละเอียดอวตารและเอฟเฟกต์ ทุกชุดใช้กติกาหมากรุกเดียวกัน</p></section>
          </div>
          <footer class="lobby-launch"><div class="xp-line"><span>แต้มสะสมปลดล็อกสกิน</span><span id="title-xp"></span></div><progress id="title-xp-bar" max="200" value="0"></progress><div class="title-start"><button id="launch-start" class="primary">${icon("duel")} เข้าสู่ศึก</button><button id="launch-resume" hidden>เล่นศึกที่บันทึกไว้ต่อ</button></div><span class="lobby-save-note">กองทัพและความก้าวหน้าบันทึกในเครื่องนี้</span></footer>
        </section>
      </div>`;
    this.composeFlow();
    for (const [id, target] of [["army-skin-filter", ".skin-options"], ["piece-skin-filter", ".piece-skin-options"]]) {
      const label = document.createElement("label"); label.className = "skin-filter";
      label.innerHTML = `ดูชุดสกิน<select id="${id}"><option value="all">ทุกชุด · 8 สกิน</option><option value="owned">ปลดล็อกแล้ว</option><option value="2">หายาก</option><option value="3">มหากาพย์</option><option value="4">ตำนาน</option><option value="5">มายาธิค</option></select>`;
      this.get(target).before(label);
      label.querySelector("select")!.onchange = () => this.renderSkins();
    }
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
    this.get<HTMLSelectElement>("#launch-depth").onchange = () => { this.renderRivals(); this.updateBrief(); };
    this.get<HTMLSelectElement>("#launch-trial").onchange = () => this.setMode(this.selected);
    this.get<HTMLSelectElement>("#launch-scenario").onchange = () => this.setMode(this.selected);
    this.get<HTMLSelectElement>("#launch-side").onchange = () => {
      if (!this.armory) {
        this.color = this.get<HTMLSelectElement>("#launch-side").value as Color;
        this.origin = this.color === "w" ? "b1" : "b8";
        this.piece = "n";
        this.draftSide=this.color; this.draftPhase="ban"; this.renderSpecial();
        this.renderSkins();
        this.renderVariant();
        this.preview();
      }
    };
    this.root.querySelectorAll<HTMLButtonElement>("[data-rival-depth]").forEach((button) => button.onclick = () => {
      this.get<HTMLSelectElement>("#launch-depth").value = button.dataset.rivalDepth!;
      this.renderRivals(); this.updateBrief();
    });
    this.get<HTMLButtonElement>("#preview-attack").onclick = () => callbacks.audition?.(this.piece, this.previewSkin());
    this.get<HTMLButtonElement>("#launch-start").onclick = () => {
      if(this.selected==="special"&&this.special.drafted&&this.draftPhase!=="reveal") {this.go("skills");return;}
      if (variantFor(this.selected) === "draft" && !validateDraft(this.draft).valid) { this.go("setup"); this.renderVariant(); return; }
      callbacks.start({
        mode: this.selected, skin: this.skin,
        side: this.get<HTMLSelectElement>("#launch-side").value as "w" | "b",
        depth: this.get<HTMLSelectElement>("#launch-depth").value,
        training: this.get<HTMLSelectElement>("#launch-scenario").value,
        trial: this.get<HTMLSelectElement>("#launch-trial").value,
        day: this.selected === "daily" ? this.dailyDay : undefined,
        opponent: this.get<HTMLSelectElement>("#special-opponent").value as "bot" | "local",
        special: this.selected === "special" ? this.special : undefined,
        variant: variantFor(this.selected) ? { seed: this.seed, ...(variantFor(this.selected) === "draft" ? { draft: [...this.draft] } : {}) } : undefined,
      });
    };
    this.get<HTMLButtonElement>("#launch-resume").onclick = () => callbacks.resume(this.skin);
    this.get<HTMLButtonElement>("#title-enter").onclick = () => this.go("menu");
    this.get<HTMLButtonElement>("#open-showcase").onclick = () => callbacks.showcase?.();
    this.get<HTMLButtonElement>("#daily-enter").onclick = () => this.chooseMode("daily");
    this.get<HTMLSelectElement>("#special-opponent").onchange = () => this.setMode(this.selected);
    this.root.querySelectorAll<HTMLButtonElement>("[data-mode-category]").forEach((button) => button.onclick = () => {
      this.category = button.dataset.modeCategory as ModeCategory;
      if (categoryFor(this.selected) !== this.category) {
        const first = this.root.querySelector<HTMLButtonElement>(`[data-mode-group="${this.category}"]`)!;
        this.setMode(first.dataset.titleMode as TitleMode);
      } else this.renderCategories();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-draft-add]").forEach((button) => button.onclick = () => {
      const next = [...this.draft, button.dataset.draftAdd as PieceSymbol];
      const result = validateDraft(next);
      if (!result.valid && next.length >= 3) { this.get("#draft-error").textContent = result.error || "เพิ่มหมากไม่ได้"; return; }
      this.draft = next; this.renderVariant();
    });
    this.get<HTMLButtonElement>("#draft-reset").onclick = () => { this.draft = [...defaultDraft]; this.renderVariant(); };
    this.get<HTMLInputElement>("#variant-seed").onchange = () => {
      const input = this.get<HTMLInputElement>("#variant-seed"), value = Number(input.value);
      if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
        input.value = String(this.seed); this.get("#variant-status").textContent = "ใช้เลขจำนวนเต็มตั้งแต่ 0 ถึง 4294967295"; return;
      }
      this.seed = value; this.renderVariant();
    };
    this.get<HTMLButtonElement>("#variant-random").onclick = () => { this.seed = this.freshSeed(); this.renderVariant(); };
    this.get<HTMLButtonElement>("#variant-copy").onclick = async () => {
      if (this.selected === "draft" && !validateDraft(this.draft).valid) return;
      this.updateChallengeCode(true);
      const field = this.get<HTMLTextAreaElement>("#variant-code");
      try {
        await navigator.clipboard.writeText(field.value); this.get("#variant-status").textContent = "คัดลอกรหัสแล้ว · ส่งให้เพื่อนเปิดกติกาเดียวกันได้";
      } catch {
        field.focus(); field.select(); this.get("#variant-status").textContent = "เลือกรหัสไว้แล้ว · กดคัดลอกจากเมนูของอุปกรณ์";
      }
    };
    this.get<HTMLButtonElement>("#variant-import").onclick = () => {
      const challenge = decodeChallenge(this.get<HTMLTextAreaElement>("#variant-code").value);
      if (!challenge) { this.get("#variant-status").textContent = "รหัสไม่ถูกต้องหรือไม่รองรับเวอร์ชันนี้"; return; }
      this.seed = challenge.seed;
      if (challenge.draft) this.draft = [...challenge.draft];
      else if (challenge.mode === "draft") this.draft = [...defaultDraft];
      if (challenge.arena && Object.hasOwn(arenas, challenge.arena)) callbacks.selectArena?.(challenge.arena as ArenaId);
      this.chooseMode(challenge.mode); this.get("#variant-status").textContent = "โหลดรหัสแล้ว · เลือกคู่แข่งและเริ่มได้เลย";
    };
    this.root.querySelectorAll<HTMLButtonElement>("[data-rule-skill]").forEach(button => button.onclick = () => {
      this.pickDraftSkill(button.dataset.rulePiece as PieceSymbol,button.dataset.ruleSkill as SkillChoice);
    });
    for (const id of ["formation", "charges", "reusable", "seed", "format", "events"]) this.get<HTMLSelectElement>(`#special-${id}`).onchange = () => {
      this.special = readSpecialConfig({ ...this.special, formation: this.get<HTMLSelectElement>("#special-formation").value,
        drafted:this.get<HTMLSelectElement>("#special-format").value==="draft", fieldEvents:this.get<HTMLSelectElement>("#special-events").value==="live", charges: Number(this.get<HTMLSelectElement>("#special-charges").value), reusable: this.get<HTMLSelectElement>("#special-reusable").value === "repeat", seed: Number(this.get<HTMLInputElement>("#special-seed").value) });
      this.draftPhase="ban"; this.renderSpecial(); this.updateBrief();
    };
    this.get<HTMLButtonElement>("#flow-back").onclick = () => this.back();
    this.get<HTMLButtonElement>("#flow-next").onclick = () => {
      if(this.view==="skills"&&this.special.drafted&&this.draftPhase!=="reveal")return;
      if (this.view === "setup" && variantFor(this.selected) === "draft" && !validateDraft(this.draft).valid) return;
      if (this.view === "mode") this.chooseMode(this.selected);
      else this.go(this.view === "setup" && this.selected !== "special" ? "army" : journey[Math.min(journey.length - 1, journey.indexOf(this.view) + 1)]);
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
    const modes = this.get(".title-modes"), bot = this.get("#launch-bot"), choices = this.get(".launch-options"); choices.id = "launch-choices";
    const trainingChoice = this.get("#launch-training"), campaign = this.get("#launch-campaign");
    const note = this.get("#title-mode-note"), collection = this.get(".lobby-collection");
    const arena = this.get(".arena-picker"), armory = this.get("#lobby-armory");
    const start = this.get("#launch-start"), resume = this.get("#launch-resume");
    const customize = this.get("#lobby-armory-tab");
    this.root.innerHTML = `<div class="menu-world"></div><div class="menu-shade"></div>
      <header class="game-menu-top"><button id="flow-back" aria-label="ย้อนกลับ">${icon("arrow-left")} <span>ย้อนกลับ</span></button><span class="game-wordmark">${logo()}</span><div class="menu-commander"></div></header>
      <main class="game-menu-content"><section class="menu-page title-cover" data-menu-view="title"><small>TACTICAL BOARD COMBAT</small><div class="title-logo">${logo("hero")}</div><p>คิดให้เฉียบ · เดินให้เด็ด · ปะทะให้เดือด</p><button id="title-enter" class="primary">เริ่มดวล <span>${icon("arrow-right")}</span></button><small class="start-prompt">กด Enter หรือแตะเพื่อเริ่ม</small></section>
      <section class="menu-page" data-menu-view="menu" hidden><small>YOUR NEXT MOVE</small><h1>ทุกตาเดิน<br><em>เปลี่ยนเกมได้</em></h1><nav class="main-game-menu" aria-label="เมนูหลัก"><div id="resume-slot"></div><button id="lobby-battle-tab">เข้าสู่ศึก <span>${icon("arrow-right")}</span></button><button data-menu-go="armory">คลังแสง <span>${icon("armory")}</span></button><button id="open-showcase">ห้องทดลองการต่อสู้ <span>${icon("duel")}</span></button><button data-menu-go="settings">ตั้งค่า <span>${icon("settings")}</span></button><button data-menu-go="help">วิธีเล่น <span>${icon("help")}</span></button></nav><div id="menu-progress"></div></section>
      <section class="menu-page" data-menu-view="mode" hidden><small>01 / CHOOSE YOUR BATTLE</small><h1>เลือกกติกา</h1><p>กระดานเดียว หลายวิธีตัดสินชัยชนะ</p><nav id="mode-categories" class="mode-categories" aria-label="ประเภทโหมด"><button data-mode-category="duel" aria-pressed="true">${icon("duel")} ดวลหมาก</button><button data-mode-category="arena" aria-pressed="false">${icon("draft")} อารีนา</button><button data-mode-category="tactics" aria-pressed="false">${icon("puzzle")} ท้าฝีมือ</button></nav><div id="mode-slot"></div></section>
      <section class="menu-page" data-menu-view="setup" hidden><small>02 / PREPARE FOR BATTLE</small><h1 id="setup-heading">เตรียมศึก</h1><div id="setup-slot"></div></section>
      <section class="menu-page" data-menu-view="skills" hidden><small>03 / SKILL LOADOUT</small><h1>เลือกทางพลิกเกม</h1><p>กำหนดสกิลให้หมากทั้ง 6 ชนิด · ทั้งสองฝ่ายใช้ชุดกติกาเดียวกัน</p><div id="skills-slot"></div></section>
      <section class="menu-page" data-menu-view="army" hidden><small>04 / YOUR ARMY</small><h1>กองทัพของคุณ</h1><p>เลือกชุดกองทัพ หรือแต่งอวตารให้หมากแต่ละตัว</p><div id="army-slot"></div></section>
      <section class="menu-page" data-menu-view="arena" hidden><small>05 / ENTER THE ARENA</small><h1>เลือกโลกแห่งศึก</h1><div id="arena-slot"></div><div id="battle-brief" class="battle-brief"></div></section>
      <section class="menu-page" data-menu-view="armory" hidden><small>THE ARMORY</small><h1>สร้างเอกลักษณ์</h1><div id="armory-slot-content"></div></section>
      <section class="menu-page" data-menu-view="settings" hidden><small>YOUR EXPERIENCE</small><h1>ภาพและเสียง</h1><div id="title-settings-slot"></div></section></main>
      <div class="menu-avatar-slot"></div><footer class="game-menu-bottom"><nav class="journey-steps" aria-label="ขั้นตอนเตรียมศึก">${["โหมด", "กติกา", "สกิล", "สกิน", "สนาม"].map((label, index) => `<button data-journey-step="${index}"><i>${index + 1}</i>${label}</button>`).join("")}</nav><div class="menu-continue"><button id="flow-next" class="primary">ต่อไป ${icon("arrow-right")}</button></div></footer>`;
    const treasuryButton = document.createElement("button"); treasuryButton.dataset.menuGo = "treasury";
    treasuryButton.innerHTML = `คลังสมบัติและสุ่มสกิน <span>${icon("astral")}</span>`;
    this.get(".main-game-menu").append(treasuryButton);
    const treasury = document.createElement("section"); treasury.className = "menu-page"; treasury.dataset.menuView = "treasury"; treasury.hidden = true;
    treasury.innerHTML = '<small>THE ASTRAL TREASURY</small><h1>สร้างคลังของคุณ</h1><div id="treasury-content"></div>';
    this.get(".game-menu-content").append(treasury);
    const economicTab = document.createElement("button"); economicTab.dataset.modeCategory = "economy"; economicTab.setAttribute("aria-pressed", "false");
    economicTab.innerHTML = `${icon("citadel")} เศรษฐกิจ`; this.get("#mode-categories").append(economicTab);
    this.get(".menu-world").append(preview); this.get(".menu-avatar-slot").append(avatar);
    this.get(".menu-commander").append(commander); this.get("#mode-slot").append(modes);
    this.get("#setup-slot").append(bot, choices, trainingChoice, campaign, note);
    this.get("#army-slot").append(collection, customize); this.get("#arena-slot").append(arena);
    this.get("#armory-slot-content").append(armory); armory.hidden = false;
    this.get(".menu-continue").append(start); this.get("#resume-slot").append(resume);
    progress.querySelector(".title-start")?.remove(); progress.querySelector(".lobby-save-note")?.remove();
    this.get("#armory-slot-content").append(progress);
    customize.innerHTML = `${icon("armory")} แต่งหมากรายตัว`; start.innerHTML = `เข้าสู่สนาม ${icon("arrow-right")}`;
    const dailyMode = document.createElement("button");
    dailyMode.dataset.titleMode = "daily";
    dailyMode.innerHTML = '<strong>ศึกประจำวัน</strong><small>โจทย์หมากรุกหมุนเวียน · ท้าฝีมือวันละกระดาน</small>';
    modes.prepend(dailyMode);
    const specialBrief = document.createElement("section"); specialBrief.id = "special-brief"; specialBrief.hidden = true;
    specialBrief.innerHTML = `<div class="special-heading"><span>${icon("ultimate")}</span><div><small>FREESTYLE SPECIAL DUEL</small><h2>สร้างกติกาศึกของคุณ</h2></div></div><p>เลือกกระดาน พลัง และการใช้ซ้ำ ก่อนจัดชุดสกิลในขั้นตอนถัดไป</p><div class="special-rule-controls"><label>ชุดสกิล<select id="special-format"><option value="shared">Freestyle · ชุดร่วมทั้งสองฝ่าย</option><option value="draft">Duel Draft · เลือก–แบนแยกฝ่าย</option></select></label><label>อีเวนท์สนาม<select id="special-events"><option value="quiet">สนามสงบ</option><option value="live">สนามมีชีวิต · พยากรณ์ 2 รอบ</option></select></label><label>กระดานเริ่มต้น<select id="special-formation"><option value="standard">เต็มกระดาน · 32 หมาก</option><option value="skirmish">ศึกย่อย · ทีมเล็กสุ่มเท่ากัน</option><option value="draft">ทีมผสม · ควีน เรือ ม้า บิชอป</option></select></label><label>ชาร์จต่อฝ่าย<select id="special-charges">${[0,1,3,5,9].map(n => `<option value="${n}" ${n === 3 ? "selected" : ""}>${n === 0 ? "ปิดอัลติ" : `${n} ครั้ง`}</option>`).join("")}</select></label><label>ข้อจำกัดต่อหมาก<select id="special-reusable"><option value="once">ตัวละ 1 ครั้ง · วางแผนทรัพยากร</option><option value="repeat">ใช้ซ้ำได้ · จนชาร์จฝ่ายนี้หมด</option></select></label><label>รหัสกระดานทีมเล็ก<input id="special-seed" type="number" min="0" max="4294967295" step="1" value="1"></label></div><small>ทุกการใช้กินหนึ่งตา · คิงต้องปลอดภัย · สกินและความหายากไม่เพิ่มสิทธิ์เดิน · ค่าเข้าฟรี</small>`;
    this.get("#setup-slot").prepend(specialBrief);
    this.get("#skills-slot").innerHTML = `<div class="skill-loadout-grid">${Object.entries(ultimates).map(([piece, skill]) => `<article class="skill-loadout-card" style="--skill-color:#${skill.color.toString(16)}"><header>${glyphs[piece as PieceSymbol]}<strong>${pieceNames[piece as PieceSymbol]}</strong></header>${(["signature", "alternate"] as const).map(choice => { const item = choice === "signature" ? skill : alternateUltimates[piece as PieceSymbol]; return `<button data-rule-piece="${piece}" data-rule-skill="${choice}" aria-pressed="${choice === "signature"}"><small>${item.name}</small><strong>${item.label}</strong><span>${item.description}</span></button>`; }).join("")}<button data-rule-off="${piece}" hidden><strong>ไม่ติดตั้งอัลติ</strong><span>0 แต้ม · ใช้การเดินปกติ</span></button></article>`).join("")}</div><p id="skill-summary" class="battle-brief"></p>`;
    const draftPanel=document.createElement("section");draftPanel.id="duel-draft-panel";draftPanel.hidden=true;
    draftPanel.innerHTML=`<small>PICK / BAN / REVEAL</small><h2 id="draft-phase-label"></h2><div class="draft-team-tabs"><button data-draft-side="w">ฝ่ายขาว</button><button data-draft-side="b">ฝ่ายดำ</button></div><label id="draft-ban-label">แบนสกิลฝ่ายตรงข้าม<select id="draft-ban"><option value="">เลือกหนึ่งสกิล</option>${skillPieces.flatMap(p=>['signature','alternate'].map(choice=>`<option value="${p}:${choice}">${pieceNames[p]} · ${(choice==='signature'?ultimates:alternateUltimates)[p].label}</option>`)).join('')}</select></label><p id="draft-team-budget"></p><div id="draft-reveal"></div><button id="draft-phase-confirm" class="primary">ยืนยันการแบน</button><p>ฝ่ายละ 12 แต้ม · แบนฝ่ายตรงข้ามหนึ่งสกิล · ปิดอัลติบางชนิดเพื่อประหยัดงบได้ · ทุกชุดเปิดเผยก่อนเริ่มศึก</p>`;
    this.get("#skills-slot").prepend(draftPanel);
    this.root.querySelectorAll<HTMLButtonElement>('[data-draft-side]').forEach(button=>button.onclick=()=>{this.draftSide=button.dataset.draftSide as Color;this.renderSpecial();});
    this.get<HTMLSelectElement>('#draft-ban').onchange=()=>{
      const ban=this.get<HTMLSelectElement>('#draft-ban').value as SkillBan;
      this.special=readSpecialConfig({...this.special,bans:{...this.special.bans,[this.draftSide]:ban}});this.draftPhase='ban';this.renderSpecial();
    };
    this.get<HTMLButtonElement>('#draft-phase-confirm').onclick=()=>{this.draftPhase=this.draftPhase==='ban'?'loadout':this.draftPhase==='loadout'?'reveal':'loadout';this.renderSpecial();this.updateBrief();};
    this.root.querySelectorAll<HTMLButtonElement>('[data-rule-off]').forEach(button=>button.onclick=()=>this.pickDraftSkill(button.dataset.ruleOff as PieceSymbol,'off'));
    const dailyCard = document.createElement("button");
    dailyCard.id = "daily-enter";
    dailyCard.innerHTML = `<span class="daily-emblem" aria-hidden="true">${icon("challenge")}</span><span><small>DAILY TACTICS</small><strong id="daily-name"></strong><span id="daily-reward"></span></span><b aria-hidden="true">${icon("arrow-right")}</b>`;
    this.get(".main-game-menu").after(dailyCard);
    const brief = document.createElement("div"); brief.id = "daily-brief"; brief.hidden = true;
    brief.innerHTML = `<div class="daily-portal" aria-hidden="true">${icon("puzzle")}</div><h2 id="daily-title"></h2><p id="daily-story"></p><div class="daily-facts"><span id="daily-budget"></span><span id="daily-streak"></span><span id="daily-prize"></span></div><small>โจทย์เปลี่ยนทุกวัน 07:00 น. เวลาไทย (00:00 UTC)<br>เล่นซ้ำได้ · รางวัลรับครั้งเดียวต่อวัน</small>`;
    this.get("#setup-slot").prepend(brief);
    for (const mode of modeDefinitions) {
      const button = document.createElement("button"); button.dataset.titleMode = mode.id;
      button.innerHTML = `<strong>${mode.name}</strong><small>${mode.description}</small>`; modes.append(button);
    }
    for (const mode of economicModes) {
      const button = document.createElement("button"); button.dataset.titleMode = mode.id;
      button.innerHTML = `<strong>${mode.name}</strong><small>${mode.description} · ค่าเข้า ${mode.entry}</small>`; modes.append(button);
    }
    const contractBrief = document.createElement("section"); contractBrief.id = "contract-brief"; contractBrief.className = "contract-brief"; contractBrief.hidden = true;
    this.get("#setup-slot").prepend(contractBrief);
    modes.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      const mode = button.dataset.titleMode as TitleMode; button.dataset.modeGroup = categoryFor(mode);
      const mark = document.createElement("span"); mark.className = "mode-emblem";
      mark.innerHTML = icon(mode === "special" ? "ultimate" : mode === "bot" || mode === "local" ? "duel" : mode === "daily" ? "challenge" : mode === "training" || mode === "campaign" || mode === "rush" ? "puzzle" : mode);
      mark.setAttribute("aria-hidden", "true"); button.prepend(mark);
    });
    this.get("#lobby-battle-tab").innerHTML = `<span class="menu-battle-icon" aria-hidden="true">${icon("duel")}</span><span><strong>เข้าสู่ศึก</strong><small>อ่านกระดาน วางหมาก ตัดสินด้วยฝีมือ</small></span><b aria-hidden="true">${icon("arrow-right")}</b>`;
    const opponent = document.createElement("section"); opponent.id = "opponent-choice"; opponent.hidden = true;
    opponent.innerHTML = '<label>คู่แข่ง<select id="special-opponent"><option value="bot">ดวลกับบอต · 3 ระดับ</option><option value="local">สองคนบนเครื่องเดียว</option></select></label>';
    this.get("#setup-slot").prepend(opponent);
    const variant = document.createElement("section"); variant.id = "variant-brief"; variant.hidden = true;
    variant.innerHTML = `<header class="variant-heading"><span id="variant-emblem" aria-hidden="true"></span><div><small id="variant-label"></small><h2 id="variant-name"></h2></div></header><p id="variant-description"></p><div id="variant-rules" class="variant-rule-grid"></div><div id="variant-position-preview" class="variant-position-preview" hidden></div>
      <div id="draft-builder" hidden><div class="draft-budget-line"><strong>จัดทัพ · งบเท่ากัน</strong><span id="draft-budget"></span></div><progress id="draft-budget-bar" max="${draftBudget}" value="0"></progress><p>คิง 1 ตัว · เลือกหมากอื่น 2–8 ตัว · ทีมคู่แข่งใช้งบเท่ากับทีมคุณ</p><div class="draft-shop">${(["p", "n", "b", "r", "q"] as PieceSymbol[]).map((piece) => `<button data-draft-add="${piece}" title="เพิ่ม${pieceNames[piece]}">${geometricPiece(piece, "w")}<strong>${pieceNames[piece]}</strong><small>${draftCosts[piece]} แต้ม</small><span>${icon("plus")}</span></button>`).join("")}</div><div id="draft-roster" class="draft-roster" aria-label="หมากในทีม"></div><p id="draft-error" role="status"></p><button id="draft-reset">${icon("reset")} ใช้ทีมแนะนำ</button></div>
      <div class="variant-share-field"><label>รหัสกระดาน <small>ใช้เลขเดิมเพื่อเล่นเงื่อนไขเดียวกัน</small><input id="variant-seed" type="number" min="0" max="4294967295" step="1" inputmode="numeric"></label><button id="variant-random">${icon("shuffle")} สุ่มใหม่</button></div><label class="variant-code-label">รหัสท้าดวล <small>แชร์กติกา ทีม และสนามให้เพื่อนได้</small><textarea id="variant-code" maxlength="512" rows="2" spellcheck="false" aria-label="รหัสท้าดวล"></textarea></label><div class="variant-share-actions"><button id="variant-copy">${icon("copy")} คัดลอกรหัส</button><button id="variant-import">${icon("arrow-right")} ใช้รหัสนี้</button></div><p id="variant-status" role="status" aria-live="polite"></p>`;
    this.get("#setup-slot").prepend(variant);
    this.renderCategories();
    const facets = document.createElement("div"); facets.className = "menu-facets"; facets.setAttribute("aria-hidden", "true");
    facets.innerHTML = '<i></i><i></i><i></i>';
    this.root.prepend(facets);
    this.root.dataset.menuView = "title";
  }
  private pickDraftSkill(piece:PieceSymbol,choice:SkillChoice) {
    if(this.special.drafted) {
      if(this.draftPhase!=='loadout'||this.draftReadOnly())return;
      const team={...this.special.teams![this.draftSide],[piece]:choice};
      if(this.special.bans?.[enemyOf(this.draftSide)]===`${piece}:${choice}`||skillSpend(team)>skillBudget)return;
      this.special=readSpecialConfig({...this.special,teams:{...this.special.teams!,[this.draftSide]:team}});
    } else if(choice!=='off') this.special={...this.special,skills:{...this.special.skills,[piece]:choice}};
    this.renderSpecial();this.updateBrief();
  }
  private draftReadOnly() {return this.get<HTMLSelectElement>('#special-opponent').value==='bot'&&this.draftSide!==this.get<HTMLSelectElement>('#launch-side').value;}
  private renderSpecial() {
    const owner=this.get<HTMLSelectElement>('#launch-side').value as Color, enemy=enemyOf(owner);
    if(this.special.drafted&&this.get<HTMLSelectElement>('#special-opponent').value==='bot') {
      const bans={...this.special.bans,[enemy]:botBan(this.special.seed^17)};
      this.special=readSpecialConfig({...this.special,bans,teams:{...this.special.teams!,[enemy]:botDraft(this.special.seed,bans[owner])}});
    }
    this.get<HTMLSelectElement>('#special-format').value=this.special.drafted?'draft':'shared';
    this.get<HTMLSelectElement>('#special-events').value=this.special.fieldEvents?'live':'quiet';
    this.get<HTMLSelectElement>('#special-formation').value=this.special.formation;
    this.get<HTMLSelectElement>('#special-charges').value=String(this.special.charges);
    this.get<HTMLSelectElement>('#special-reusable').value=this.special.reusable?'repeat':'once';
    this.get<HTMLInputElement>('#special-seed').value=String(this.special.seed);
    const team=this.special.teams![this.draftSide],ban=this.special.bans?.[enemyOf(this.draftSide)];
    this.root.querySelectorAll<HTMLButtonElement>('[data-rule-skill],[data-rule-off]').forEach(button=>{
      const piece=(button.dataset.rulePiece||button.dataset.ruleOff) as PieceSymbol,choice=(button.dataset.ruleSkill||'off') as SkillChoice;
      const selected=(this.special.drafted?team[piece]:this.special.skills[piece])===choice;
      button.hidden=choice==='off'&&!this.special.drafted;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
      button.disabled=this.special.charges===0||!!this.special.drafted&&(this.draftPhase!=='loadout'||this.draftReadOnly()||ban===`${piece}:${choice}`||skillSpend({...team,[piece]:choice})>skillBudget);
      if(choice!=='off')button.querySelector('small')!.textContent=`${(choice==='signature'?ultimates:alternateUltimates)[piece].name}${this.special.drafted?` · ${skillCosts[piece][choice]} แต้ม${ban===`${piece}:${choice}`?' · ถูกแบน':''}`:''}`;
    });
    this.get('.skill-loadout-grid').hidden=!!this.special.drafted&&this.draftPhase!=='loadout';
    this.get('#duel-draft-panel').hidden=!this.special.drafted;
    this.get('#draft-phase-label').textContent=this.draftPhase==='ban'?'01 · เลือกสกิลที่คู่แข่งใช้ไม่ได้':this.draftPhase==='loadout'?'02 · จัดชุดสกิลภายในงบ':'03 · เปิดเผยสองกองทัพ';
    this.get<HTMLSelectElement>('#draft-ban').value=this.special.bans?.[this.draftSide]||'';
    this.get<HTMLSelectElement>('#draft-ban').disabled=this.draftPhase!=='ban'||this.draftReadOnly();
    this.get('#draft-team-budget').textContent=`${this.draftSide==='w'?'ฝ่ายขาว':'ฝ่ายดำ'} · ${skillSpend(team)} / ${skillBudget} แต้ม${this.draftReadOnly()?' · บอตจัดชุดเอง':''}`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-draft-side]').forEach(b=>{b.classList.toggle('active',b.dataset.draftSide===this.draftSide);b.setAttribute('aria-pressed',String(b.dataset.draftSide===this.draftSide));});
    const confirm=this.get<HTMLButtonElement>('#draft-phase-confirm');confirm.disabled=this.draftPhase==='ban'&&(!this.special.bans?.w||!this.special.bans?.b);
    confirm.textContent=this.draftPhase==='ban'?'ยืนยันการแบน → จัดชุด':this.draftPhase==='loadout'?'เปิดเผยสองกองทัพ':'กลับไปแก้ชุดสกิล';
    const reveal=this.get('#draft-reveal');reveal.hidden=this.draftPhase!=='reveal';
    reveal.innerHTML=(['w','b'] as Color[]).map(color=>`<article><strong>${color==='w'?'ฝ่ายขาว':'ฝ่ายดำ'} · ${skillSpend(this.special.teams![color])}/12</strong>${skillPieces.map(p=>`<span>${pieceNames[p]} · ${this.special.teams![color][p]==='off'?'ไม่ติดตั้ง':(this.special.teams![color][p]==='alternate'?alternateUltimates:ultimates)[p].label}</span>`).join('')}</article>`).join('');
    this.get('#skill-summary').textContent=this.special.charges===0?'ปิดอัลติ · ใช้การเดินปกติ':`ฝ่ายละ ${this.special.charges} ชาร์จ · ${this.special.reusable?'ใช้ซ้ำได้':'ตัวละหนึ่งครั้ง'} · ${this.special.drafted?'ชุดสกิลแยกฝ่าย':'ชุดสกิลร่วม'}`;
    if(this.view==='skills')this.get<HTMLButtonElement>('#flow-next').disabled=!!this.special.drafted&&this.draftPhase!=='reveal';
  }
  private freshSeed() { const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); return bytes[0] || 1; }
  private renderCategories() {
    this.root.querySelectorAll<HTMLButtonElement>("[data-mode-category]").forEach((button) => {
      const active = button.dataset.modeCategory === this.category;
      button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-title-mode]").forEach((button) => { button.hidden = button.dataset.modeGroup !== this.category; });
  }
  private updateChallengeCode(force = false) {
    if (!isVariant(this.selected)) return;
    const field = this.get<HTMLTextAreaElement>("#variant-code");
    if (this.selected === "draft" && !validateDraft(this.draft).valid) {
      if (document.activeElement !== field) field.value = "";
      return;
    }
    if (force || document.activeElement !== field) field.value = encodeChallenge({ mode: this.selected, seed: this.seed, ...(this.selected === "draft" ? { draft: [...this.draft] } : {}), ...(this.profile ? { arena: this.profile.arena } : {}) });
  }
  private renderVariant() {
    const mode = variantFor(this.selected);
    if (!mode) { this.get<HTMLButtonElement>("#flow-next").disabled = this.view==="skills"&&!!this.special.drafted&&this.draftPhase!=="reveal"; return; }
    const definition = modeDefinitions.find((definition) => definition.id === mode)!;
    this.get("#variant-emblem").innerHTML = icon(mode === "rush" ? "puzzle" : mode);
    this.get("#variant-label").textContent = definition.label;
    this.get("#variant-name").textContent = definition.name;
    this.get("#variant-description").textContent = definition.description;
    this.get("#variant-rules").innerHTML = definition.rules.map((rule, index) => `<div><span>${String(index + 1).padStart(2, "0")}</span><p>${rule}</p></div>`).join("");
    const boardPreview = this.get("#variant-position-preview"), showPreview = mode === "mirror" || mode === "draft" && validateDraft(this.draft).valid;
    boardPreview.hidden = !showPreview;
    if (showPreview) {
      const color = this.get<HTMLSelectElement>("#launch-side").value as Color;
      const board = new Chess(variantInitialFen(mode, { seed: this.seed, draft: mode === "draft" ? [...this.draft] : undefined, draftColor: color })).board();
      boardPreview.innerHTML = `<div class="variant-board-label"><strong>กองทัพที่จะลงสนาม</strong><small>${mode === "mirror" ? "รอบสองใช้ตำแหน่งเดิมและสลับสี" : `ทีมของคุณ: ฝ่าย${color === "w" ? "ขาว" : "ดำ"} · คู่แข่งจัดทีมด้วยงบเดียวกัน`}</small></div><div class="variant-mini-board" role="img" aria-label="ตำแหน่งหมากก่อนเริ่มเกม">${board.flatMap((row, rank) => row.map((piece, file) => `<span class="variant-mini-cell ${(rank + file) % 2 ? "dark" : "light"}" title="${"abcdefgh"[file]}${8 - rank}${piece ? ` ${pieceNames[piece.type]} ฝ่าย${piece.color === "w" ? "ขาว" : "ดำ"}` : ""}">${piece ? geometricPiece(piece.type, piece.color) : ""}</span>`)).join("")}</div>`;
    }
    this.get("#draft-builder").hidden = mode !== "draft";
    this.get<HTMLButtonElement>("#variant-copy").disabled = mode === "draft" && !validateDraft(this.draft).valid;
    const seedField = this.get<HTMLInputElement>("#variant-seed");
    if (document.activeElement !== seedField) seedField.value = String(this.seed);
    if (mode === "draft") {
      const validation = validateDraft(this.draft);
      this.get("#draft-budget").textContent = `${validation.cost} / ${draftBudget} แต้ม`;
      this.get<HTMLProgressElement>("#draft-budget-bar").value = validation.cost;
      this.get("#draft-error").textContent = validation.error || `${this.draft.length - 1} / 8 หมาก · คิงไม่คิดแต้ม · แตะหมากในทีมเพื่อนำออก`;
      const roster = this.get("#draft-roster"), rosterKey = this.draft.join("");
      // A seed field's blur must not replace the button receiving that same pointer click.
      if (roster.dataset.roster !== rosterKey) {
        roster.dataset.roster = rosterKey;
        roster.innerHTML = this.draft.map((piece, index) => piece === "k" ? `<span class="draft-king" title="คิงจำเป็นสำหรับทุกทีม">${geometricPiece(piece, "w")}<small>คิง</small></span>` : `<button data-draft-remove="${index}" aria-label="นำ${pieceNames[piece]}ออกจากทีม">${geometricPiece(piece, "w")}<small>${pieceNames[piece]}</small><i>${icon("minus")}</i></button>`).join("");
        this.root.querySelectorAll<HTMLButtonElement>("[data-draft-remove]").forEach((button) => button.onclick = () => {
          this.draft.splice(Number(button.dataset.draftRemove), 1); this.renderVariant();
        });
      }
      this.root.querySelectorAll<HTMLButtonElement>("[data-draft-add]").forEach((button) => { const next = [...this.draft, button.dataset.draftAdd as PieceSymbol]; button.disabled = next.length >= 3 && !validateDraft(next).valid; });
      this.get<HTMLButtonElement>("#flow-next").disabled = this.view === "setup" && !validation.valid;
    } else this.get<HTMLButtonElement>("#flow-next").disabled = false;
    for (const selector of [".variant-code-label", ".variant-share-actions", "#variant-status"]) this.get(selector).hidden = isEconomicMode(this.selected);
    this.updateChallengeCode();
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
    this.go(this.view === "army" && this.selected !== "special" ? "setup" : this.view === "armory" ? this.armoryReturn : this.view === "settings" || this.view === "treasury" ? "menu" :
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
    this.get("#flow-next").innerHTML = `${view === "setup" ? this.selected === "special" ? "เลือกสกิล" : "จัดกองทัพ" : view === "skills" ? "เลือกสกิน" : view === "army" ? "เลือกสนาม" : "เตรียมศึก"} ${icon("arrow-right")}`;
    this.root.querySelectorAll<HTMLButtonElement>("[data-journey-step]").forEach((button) => {
      const index = Number(button.dataset.journeyStep); button.disabled = index >= step; button.hidden = index === 2 && this.selected !== "special";
      button.querySelector("i")!.textContent = String(this.selected !== "special" && index > 2 ? index : index + 1);
      button.classList.toggle("current", index === step); button.classList.toggle("complete", index < step);
      button.setAttribute("aria-current", index === step ? "step" : "false");
    });
    if (!this.armory) { this.color = this.get<HTMLSelectElement>("#launch-side").value as Color; this.origin = this.color === "w" ? "b1" : "b8"; this.piece = "n"; }
    this.get('[data-menu-view="army"] > small').textContent = `${this.selected === "special" ? "04" : "03"} / YOUR ARMY`;
    this.get('[data-menu-view="arena"] > small').textContent = `${this.selected === "special" ? "05" : "04"} / ENTER THE ARENA`;
    this.renderSpecial(); this.renderSkins(); this.updateBrief(); this.renderVariant(); this.preview();
    this.renderTreasury();
    const current = this.get<HTMLElement>(`[data-menu-view="${view}"]`);
    current.classList.remove("menu-enter"); void current.offsetWidth; current.classList.add("menu-enter");
    [...current.querySelectorAll<HTMLElement>("button:not(:disabled), select")].find((el) => el.getClientRects().length)?.focus({ preventScroll: true });
  }
  private updateBrief() {
    if (!this.profile) return;
    const modeNames = { ...Object.fromEntries([...modeDefinitions, ...economicModes].map((mode) => [mode.id, mode.name])), bot: "ศึกแม่ทัพ", local: "ศึกสองกองทัพ", training: "สนามฝึก", campaign: "โจทย์ยุทธวิธี", online: "ดวลออนไลน์", daily: "ศึกประจำวัน", special: "Special Duel" } as Record<TitleMode, string>;
    this.get("#setup-heading").textContent = modeNames[this.selected];
    const opponent = (isVariant(this.selected) || this.selected === "special") ? `${modeNames[this.selected]} · ${this.selected === "rush" ? "เล่นคนเดียว" : this.get<HTMLSelectElement>("#special-opponent").value === "bot" ? "บอต " + ["ง่าย", "ปานกลาง", "ยาก"][Number(this.get<HTMLSelectElement>("#launch-depth").value) - 1] : "สองคน"}` : this.selected === "daily" ? dailyChallenge(this.dailyDay).title : this.selected === "bot" ? rivals[Number(this.get<HTMLSelectElement>("#launch-depth").value) as 1 | 2 | 3].name : modeNames[this.selected];
    this.get("#battle-brief").textContent = `${opponent} · ${skins[this.skin].name} · ${arenas[this.profile.arena].name}${this.selected === "special" ? ` · ${this.special.charges} ชาร์จ · ${this.special.drafted ? `DRAFT ขาว ${skillSpend(this.special.teams!.w)}/12 · ดำ ${skillSpend(this.special.teams!.b)}/12` : `${Object.values(this.special.skills).filter(s => s === "alternate").length} สกิลทางเลือก`}${this.special.fieldEvents ? " · อีเวนท์สนาม" : ""} · ${({standard:"เต็มกระดาน",skirmish:"ศึกย่อย",draft:"ทีมผสม"})[this.special.formation]}` : ""}`;
    this.updateChallengeCode();
    const contract = economicDefinition(this.selected), brief = this.get("#contract-brief");
    brief.hidden = !contract;
    if (contract) {
      brief.innerHTML = `<div class="contract-fee"><strong>${contract.label} · ค่าเข้า ${contract.entry}</strong><span>เครดิตของคุณ ${this.profile.economy.credits}</span></div><p>${contract.rules}</p><small>หักเมื่อเข้าสนาม · แพ้/ออกไม่คืนค่าเข้า · เริ่มใหม่คิดค่าเข้าใหม่ · รับเงินครั้งเดียวเมื่อจบรอบ · หลังรับเงินย้อนตาไม่ได้</small>`;
      if (this.view === "arena") this.get<HTMLButtonElement>("#launch-start").disabled = this.profile.economy.credits < contract.entry;
    }
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
    this.selected = mode; this.category = categoryFor(mode); this.renderCategories();
    this.root.querySelectorAll<HTMLButtonElement>("[data-title-mode]").forEach((button) => {
      const active = button.dataset.titleMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const contract = economicDefinition(mode), economyBot = !!contract && contract.base !== "rush";
    const flexible = mode === "special" || isVariant(mode) && mode !== "rush";
    this.get("#launch-bot").hidden = mode !== "bot" && !economyBot && !(flexible && this.get<HTMLSelectElement>("#special-opponent").value === "bot");
    this.get("#opponent-choice").hidden = !flexible;
    this.get("#launch-choices").hidden = mode !== "bot" && !flexible && !economyBot;
    this.get("#launch-depth-choice").hidden = mode !== "bot" && !economyBot && !(flexible && this.get<HTMLSelectElement>("#special-opponent").value === "bot");
    this.get("#variant-brief").hidden = !variantFor(mode);
    this.renderVariant();
    this.get("#special-brief").hidden = mode !== "special";
    this.get("#launch-training").hidden = mode !== "training";
    this.get("#launch-campaign").hidden = mode !== "campaign";
    this.get("#daily-brief").hidden = mode !== "daily";
    this.refreshDaily();
    const trial = trials[this.get<HTMLSelectElement>("#launch-trial").value as keyof typeof trials];
    const scenario = training[this.get<HTMLSelectElement>("#launch-scenario").value as keyof typeof training];
    this.get("#title-mode-note").textContent = mode === "bot" ? "หมากรุกเต็มกระดาน · คู่แข่งสามระดับ · ท่าปะทะเฉพาะหมาก" : mode === "campaign" ? `${trial?.story || "เรื่องราวสั้นและเป้าหมายเฉพาะ"} · รางวัลเมื่อผ่านครั้งแรก` : mode === "training" ? `${scenario?.hint || "ฝึกยุทธวิธี"} · ผ่านครั้งแรก รับ 40 XP` : mode === "online" ? "ห้องท้าดวลส่วนตัว · ฝ่ายละ 5 นาที · รับ XP เมื่อศึกจบ" : "เลือกกองทัพทั้งสองฝั่ง แล้วผลัดกันบัญชาการบนเครื่องเดียว";
    if (mode === "special") this.get("#title-mode-note").textContent = "เลือกหมาก กดอัลติ ดูเป้าการเดิน แล้วยืนยัน · กดยกเลิกได้ก่อนใช้จริง";
    if (mode === "daily") this.get("#title-mode-note").textContent = dailyChallenge(this.dailyDay).trial.hint;
    if (isVariant(mode)) this.get("#title-mode-note").textContent = mode === "rush" ? "แก้โจทย์ต่อเนื่องก่อนหมดเวลา · เล่นชุดเดิมเพื่อเทียบสถิติได้" : "ตั้งกติกา เลือกกองทัพและสนาม แล้วเริ่มดวล · สกินเปลี่ยนภาพเท่านั้น";
    if (contract) this.get("#title-mode-note").textContent = `${contract.description} · ${contract.base === "rush" ? "เล่นคนเดียว" : "ดวลกับบอต 3 ระดับ"}`;
    this.renderSpecial(); this.updateBrief();
  }
  private refreshDaily() {
    const daily = dailyChallenge(this.dailyDay), progress = dailyProgress(this.profile?.claimed || [], this.dailyDay);
    this.get("#daily-name").textContent = daily.title;
    this.get("#daily-reward").textContent = `${progress.done ? "สำเร็จแล้ววันนี้" : daily.trial.objective === "mate" ? "รุกฆาต" : daily.trial.objective === "rescue" ? "ช่วยคิงจากการรุก" : "ขู่สองเป้าหมาย"} · ${daily.trial.maxMoves} ตาของคุณ`;
    this.get("#daily-enter").classList.toggle("completed", progress.done);
    this.get("#daily-title").textContent = daily.title;
    this.get("#daily-story").textContent = daily.trial.story;
    this.get("#daily-budget").textContent = `${daily.trial.maxMoves} ตาของคุณ`;
    this.get("#daily-streak").textContent = `ต่อเนื่อง ${progress.streak} วัน`;
    this.get("#daily-prize").textContent = progress.done ? "รับรางวัลแล้ว" : `+${progress.reward} XP`;
  }
  private renderSkins() {
    if (!this.profile) return;
    this.root.querySelectorAll<HTMLButtonElement>("[data-skin-option]").forEach((button) => {
      const id = button.dataset.skinOption as SkinId;
      const filter = this.get<HTMLSelectElement>("#army-skin-filter").value;
      button.hidden = filter === "owned" ? !isSkinUnlocked(this.profile!, id) : filter !== "all" && skins[id].tier !== Number(filter);
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
    this.get("#preview-piece-glyph").innerHTML = glyphs[this.piece];
    this.get("#armory-glyph").innerHTML = glyphs[this.piece];
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
      const filter = this.get<HTMLSelectElement>("#piece-skin-filter").value;
      button.hidden = filter === "owned" ? !unlocked : filter !== "all" && skins[assigned].tier !== Number(filter);
      button.classList.toggle("selected", id === assigned);
      button.setAttribute("aria-pressed", String(id === assigned));
      button.querySelector("strong")!.textContent = avatarNames[assigned][this.piece];
      button.querySelector(".piece-skill-name")!.textContent = skillNames[assigned][this.piece];
      button.querySelector(".piece-skin-avatar")!.innerHTML = glyphs[this.piece];
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
    this.get("#commander-level").textContent = "TACTICAL CHESS";
    this.get("#commander-rank").textContent = "พร้อมดวลบนกระดาน";
    this.get("#commander-record").textContent = `${profile.wins} ชนะ · ${profile.matches} ศึก · ${profile.economy.credits} เครดิต`;
    this.get("#title-xp").textContent = `${progress.current} / ${progress.next} XP`;
    this.get<HTMLProgressElement>("#title-xp-bar").value = progress.current;
    this.renderSkins();
    this.refreshDaily();
    this.updateBrief();
    this.renderTreasury();
    if (!this.root.hidden) this.preview();
  }
  private renderTreasury() {
    if (!this.profile || this.view !== "treasury") return;
    const host = this.get("#treasury-content"), busy = performance.now() < this.economyBusyUntil;
    host.innerHTML = treasuryHTML(this.profile, this.economyMessage, busy);
    host.querySelectorAll<HTMLButtonElement>("[data-economy-action]").forEach(button => button.onclick = () => {
      if (performance.now() < this.economyBusyUntil) return;
      const action = button.dataset.economyAction === "forge" ? { type: "forge" as const, skin: button.dataset.forgeSkin as SkinId } : { type: button.dataset.economyAction as "pull" | "daily" };
      this.economyBusyUntil = performance.now() + 500;
      this.economyMessage = this.callbacks.economy?.(action) || "ยังไม่พร้อมใช้งาน";
      this.renderTreasury();
      setTimeout(() => { this.renderTreasury(); this.get<HTMLButtonElement>(`[data-economy-action="${action.type}"]`)?.focus({ preventScroll: true }); }, 510);
    });
  }
  show(profile: Profile, settings: { mode: TitleMode; side: string; depth: string; resume: boolean; training?: string; trial?: string; view?: "title" | "menu"; special?: SpecialConfig; variant?: { seed: number; draft?: PieceSymbol[]; round?: number }; opponent?: "bot" | "local" }) {
    this.get<HTMLSelectElement>("#launch-side").value = settings.side;
    this.get<HTMLSelectElement>("#launch-depth").value = settings.depth;
    this.get<HTMLSelectElement>("#launch-scenario").value = settings.training || "pawn";
    if (settings.trial) this.get<HTMLSelectElement>("#launch-trial").value = settings.trial;
    if (settings.variant) {
      if (Number.isInteger(settings.variant.seed) && settings.variant.seed >= 0 && settings.variant.seed <= 0xffffffff) this.seed = settings.variant.seed;
      if (settings.variant.draft && validateDraft(settings.variant.draft).valid) this.draft = [...settings.variant.draft];
    }
    if (settings.opponent) this.get<HTMLSelectElement>("#special-opponent").value = settings.opponent;
    this.setMode(settings.mode);
    this.get("#launch-resume").hidden = !settings.resume;
    this.get("#launch-resume").textContent = settings.mode === "online" ? "กลับเข้าห้องออนไลน์ · เวลาเดินต่อ" : "เล่นศึกที่บันทึกไว้ต่อ";
    this.color = settings.side === "b" ? "b" : "w";
    this.origin = this.color === "w" ? "b1" : "b8";
    this.piece = "n";
    this.special = readSpecialConfig(settings.special); this.draftPhase="ban";this.draftSide=this.color; this.renderSpecial();
    this.refresh(profile);
    this.renderRivals();
    this.root.hidden = false;
    this.go(settings.view || "title");
  }
  hide() { this.root.hidden = true; this.callbacks.settings?.(null); this.previewKey = ""; this.callbacks.preview?.(null, this.color); }
}
