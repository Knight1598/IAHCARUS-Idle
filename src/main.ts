import "./style.css";
import {
  Chess,
  type Square,
  type PieceSymbol,
  type Move,
  type Color,
} from "chess.js";
import { ChessScene, type GraphicsQuality } from "./scene";
import { TitleScreen, type LaunchSettings } from "./title";
import { economicDefinition, isEconomicMode, enterContract, settleContract, contractAmount, claimCredits, dailyCredits, rollSkin, forgeSkin, type Contract } from "../shared/economy.js";
import type { EconomyAction } from "./economy-ui";
import { arenas, arenaOptions, isArena, type ArenaId } from "./arenas";
import { SpaceAudio, type MusicState, type SoundPhase } from "./sound";
import { readAudioPreferences, installAudioControls } from "./audio-controls";
import "./audio-controls.css";
import { CombatShowcase, type ShowcaseSettings } from "./showcase";
import type { CombatCue } from "./combat-profiles";
import { clampCaptureDuration } from "./combat";
import { ArenaHUD } from "./hud";
import { readProfile, claimXP, matchXP, levelProgress, skins, isSkinUnlocked, equipArmy, equipPiece, type SkinId, type Profile } from "./profile";
import { appearanceMap, avatarNames, skillNames, scenarioLoadout } from "./cosmetics";
import { rivals, trials, evaluateTrial, battleMVP } from "./progression";
import { dailyChallenge, dailyProgress, utcDay, validDailyDay } from "./daily";
import { previewMove, type MovePreview } from "./tactics";
import { BattlePresentation } from "./presentation";
import type { ArmyCosmetics } from "../shared/cosmetics.js";
import { matchStory, latestMoment } from "./battle";
import { matchMaterial, type CinematicScope } from "./gameplay";
import { SpecialChess, ultimates, readSpecialConfig, type UltimateMove } from "./special";
import { VariantChess, createVariant, variantInitialFen, modeDefinitions, rushPuzzle, type VariantId } from "./variants";
import { newModeSession, readModeSession, mirrorScore, type ModeSession } from "./mode-session";
import { installPlayer, type PlayerManager } from "./player";
import { installDesign, geometricPiece } from "./design";
import "./mode-ui.css";
import "./design.css";
import BotWorker from "./bot.ts?worker&inline";
const OFFLINE = __OFFLINE__;
const saveKey = OFFLINE ? "special-chess-offline-game" : "special-chess-local";
const difficultyKey = OFFLINE
  ? "special-chess-offline-difficulty"
  : "special-chess-difficulty";
import { training } from "./training";
import { analyzeMove, kingSquare, type MoveEvent } from "../shared/events.js";

type Mode = "local" | "bot" | "online";
type Result = { winner: "w" | "b" | null; reason: string } | null;
interface State {
  type: "state";
  code: string;
  color: "w" | "b";
  fen: string;
  history: string[];
  latest: null | {
    before: string;
    from: Square;
    to: Square;
    promotion?: PieceSymbol;
    san: string;
  };
  clocks: { w: number; b: number };
  started: boolean;
  result: Result;
  connected: { w: boolean; b: boolean };
  players?: { w: { name: string; username?: string } | null; b: { name: string; username?: string } | null };
  revision: number;
  cosmetics?: { w: ArmyCosmetics; b: ArmyCosmetics };
}
const symbols = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
const names = {
  p: "เบี้ย",
  n: "ม้า",
  b: "บิชอป",
  r: "รุก",
  q: "ควีน",
  k: "คิง",
};
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
$("#app").innerHTML =
  `<div id="game-shell" hidden><header><a class="brand" href="#"><span class="brand-mark">♞</span><span>SPECIAL CHESS<small>PROCEDURAL 3D ARENA</small></span></a><div class="header-actions"><button id="title-return">หน้าหลัก</button><span id="player-level" class="tag">Lv.1</span><span class="tag">PURE CODE</span><button id="help" class="icon" aria-label="วิธีเล่น">?</button></div></header><div class="layout"><main id="stage" aria-label="กระดานหมากรุกสามมิติ"><div class="arena-top"><span id="mode-tag">LOCAL DUEL</span><span id="arena-name"></span><span id="connection"></span></div><div id="event" aria-live="polite"><strong></strong><span></span></div><div id="battle-toast" role="status"><small>ARENA EVENT</small><strong></strong><span></span></div><div id="cinema-top" class="cinema-bar"></div><div id="cinema-bottom" class="cinema-bar"></div><div class="arena-bottom"><span id="hint">เลือกหมากเพื่อเริ่มการประลอง</span><div><button id="view" class="icon" title="กลับมุมกล้อง" aria-label="กลับมุมกล้อง">◎</button><button id="flip" class="icon" title="สลับมุม" aria-label="สลับมุม">↻</button><button id="skip">ข้ามฉาก</button></div></div></main><aside><section class="match-head"><small>THE ROYAL DUEL</small><h1>ศึกหมากราชัน</h1><p>หมากรุกคลาสสิก · ทุกตาคือฉากต่อสู้</p></section><div class="player" id="black-player"><span class="avatar black">♚</span><div><strong>ฝ่ายดำ</strong><small id="black-label">ผู้เล่น 2</small></div><span class="clock" id="black-clock">—</span></div><div id="status" role="status"></div><div class="player" id="white-player"><span class="avatar white">♔</span><div><strong>ฝ่ายขาว</strong><small id="white-label">ผู้เล่น 1</small></div><span class="clock" id="white-clock">—</span></div><div id="result" hidden></div><div id="xp-reward" role="status" hidden></div><div class="tabs" role="group" aria-label="โหมดเกม"><button data-mode="bot">เล่นกับบอต</button><button data-mode="local" class="active">สองคน</button><button data-mode="online">ออนไลน์</button></div><section id="online-panel" hidden><p class="muted">ห้องส่วนตัว · ฝ่ายละ 5 นาที</p><div class="button-row"><button id="create" class="primary">สร้างห้อง</button><button id="leave" hidden>ออกจากห้อง</button></div><form id="join-form"><input id="room-code" aria-label="รหัสห้อง" placeholder="รหัสห้อง 6 ตัว" maxlength="6" autocomplete="off" pattern="[A-Fa-f0-9]{6}" required><button id="join" type="submit">เข้าร่วม</button></form><div id="room-info" hidden><span>รหัสห้อง <strong id="code"></strong></span><button id="copy">คัดลอกลิงก์</button></div></section><div class="button-row" id="local-actions"><button id="reset" class="primary">เกมใหม่</button><button id="undo">ย้อนตา</button><select id="difficulty" aria-label="ระดับบอต" hidden><option value="1">ง่าย</option><option value="2" selected>ปานกลาง</option><option value="3">ยาก</option></select></div><label id="side-control" hidden>ฝ่ายของคุณ<select id="human-side" aria-label="ฝ่ายของคุณ"><option value="w">ฝ่ายขาว · เดินก่อน</option><option value="b">ฝ่ายดำ · เดินทีหลัง</option></select><small>เปลี่ยนฝ่ายจะเริ่มเกมใหม่</small></label><section class="material-panel" aria-label="หมากที่กินและคะแนนกำลัง"><div><span>ขาวกิน</span><span id="white-captured">—</span><strong id="white-material"></strong></div><div><span>ดำกิน</span><span id="black-captured">—</span><strong id="black-material"></strong></div></section><section id="missions" class="missions"><div class="section-title"><h2 id="mission-title">ภารกิจในแมตช์</h2><strong id="mission-stars">☆ ☆ ☆</strong></div><p class="muted">เป้าหมายเสริม · เก็บดาวระหว่างการประลอง</p><div id="mission-list"></div></section><details id="battle-log-panel"><summary>อีเวนท์ในแมตช์</summary><div id="battle-log"></div></details><button id="resign" hidden>ยอมแพ้</button><div id="notice" role="status"></div><section class="settings"><label class="setting-select" for="arena-select">สนามประลอง<select id="arena-select">${arenaOptions()}</select></label><label class="setting-select" for="graphics-quality">กราฟิก<select id="graphics-quality"><option value="auto">อัตโนมัติ · ปรับตามความลื่น</option><option value="low">ลื่นที่สุด · ลดเงาและความละเอียด</option><option value="high">ภาพคมชัด</option></select></label><label><input type="checkbox" id="battle-events" checked> อีเวนท์และภารกิจระหว่างเล่น</label><label><input type="checkbox" id="cinematic" checked> คัตซีนและกล้องพิเศษ</label><label class="setting-select" for="cinematic-scope">จังหวะคัตซีน<select id="cinematic-scope"><option value="key">เฉพาะจังหวะสำคัญ</option><option value="all">ทุกท่าสเปเชียล</option></select></label><label><input type="checkbox" id="reduced"> ลดเอฟเฟกต์</label><label><input type="checkbox" id="sound"> เสียงอวกาศ · ไซไฟอนิเมะ</label><label class="setting-select" for="sound-volume">ระดับเสียงเอฟเฟกต์<input id="sound-volume" type="range" min="0" max="100" value="35" aria-label="ระดับเสียงเอฟเฟกต์"></label></section><details id="board-details"><summary>กระดาน 2D / เล่นด้วยคีย์บอร์ด</summary><div id="flat-board" role="group" aria-label="กระดานหมากรุกสองมิติ"></div></details><details id="training-panel"><summary>สนามฝึกท่าสเปเชียล</summary><select id="training-select" aria-label="เลือกท่าฝึก"><option value="">เลือกฉากเพื่อทดลอง</option>${Object.entries(
    training,
  )
    .map(([key, t]) => `<option value="${key}">${t.name}</option>`)
    .join(
      "",
    )}</select><p id="training-hint" class="muted"></p></details><section class="history"><div class="section-title"><h2>บันทึกการประลอง</h2><button id="export" class="text-button">PGN ↓</button></div><div id="moves"></div></section><footer>โมเดล แสง และพลังทั้งหมดสร้างจากโค้ด<br>เลือก Special Duel เพื่อใช้อัลติเปลี่ยนทางเดิน</footer></aside></div></div><dialog id="promotion"><small>ASCENSION</small><h2>เลือกหมากเพื่อเลื่อนขั้น</h2><div class="promotion-options">${(["q", "r", "b", "n"] as const).map((p) => `<button data-piece="${p}"><span>${symbols.w[p]}</span>${names[p]}</button>`).join("")}</div><button id="cancel-promotion" class="text-button">ยกเลิก</button></dialog><dialog id="help-dialog"><small>HOW TO PLAY</small><h2>ทุกตาคือการตัดสินใจ</h2><p>เลือกหมากของฝ่ายที่ถึงตา แล้วเลือกช่องเรืองแสงเพื่อเดิน สีชมพูคือช่องกินหมาก</p><p>ลากเพื่อหมุนกระดาน เลื่อนเพื่อซูม หรือใช้กระดาน 2D ด้วยคีย์บอร์ด</p><p>โหมดปกติใช้กติกาหมากรุกมาตรฐาน ส่วน Special Duel มีอัลติเปลี่ยนทางเดินฝ่ายละ 3 ครั้ง คิงไม่ถูกกิน และรุกฆาตต้องไม่มีทางหนีรวมอัลติ คัตซีนข้ามได้เสมอ</p><p>ออนไลน์: สร้างห้องแล้วส่งลิงก์ให้เพื่อน ฝ่ายละ 5 นาที เวลาเดินตามเซิร์ฟเวอร์ รวมเวลาคัตซีน หากรีเฟรชจะกลับเข้าห้องจากเบราว์เซอร์เดิม</p><p>เล่นกับบอต: เลือกเล่นขาวหรือดำได้ เปลี่ยนฝ่ายจะเริ่มเกมใหม่ ย้อนตาจะกลับไปก่อนตาของคุณ ปรับระดับได้ก่อนตาถัดไป</p><button id="close-help" class="primary">เข้าใจแล้ว</button></dialog>`;
const hud = new ArenaHUD();
$("#stage").insertAdjacentHTML("beforeend", `<section id="ultimate-hud" aria-label="อัลติ Special Duel" hidden>
  <div class="ultimate-meter"><small>ULTIMATE RESERVE</small><div><span>ขาว <b id="ultimate-white"></b></span><span>ดำ <b id="ultimate-black"></b></span></div></div>
  <button id="ultimate-arm" disabled aria-pressed="false"><i aria-hidden="true">ϟ</i><span><strong>เลือกหมากเพื่อใช้อัลติ</strong><small>ฝ่ายละ 3 ครั้ง · ตัวละ 1 ครั้ง</small></span></button>
  <button id="ultimate-confirm" class="primary" hidden>ยืนยันอัลติ</button>
  <button id="ultimate-help" class="text-button">ดูสกิล / แนวโจมตีศัตรู</button></section>
  <dialog id="ultimate-guide"><small>SPECIAL DUEL / READ THE BATTLE</small><h2>อ่านสกิล ก่อนตัดสินใจ</h2><p>ใช้แทนการเดินหนึ่งตา · ตัวละ 1 ครั้ง · ฝ่ายละ 3 ครั้ง<br>หลังเดินขู่ตามรูปหมากเดิม · คิงต้องปลอดภัย</p>
  <div class="ultimate-catalog">${Object.entries(ultimates).map(([piece, skill]) => `<article style="--ultimate-color:#${skill.color.toString(16)}"><i>${symbols.w[piece as PieceSymbol]}</i><div><small>${skill.name}</small><strong>${skill.label}</strong><p>${skill.description}</p></div></article>`).join("")}</div>
  <label>สำรวจอัลติฝ่ายตรงข้าม<select id="ultimate-enemy"><option value="">เลือกหมากเพื่อดูแนวเดินที่เป็นไปได้</option></select></label><p id="ultimate-enemy-note">ยังไม่ใช่การรุกจริง · คู่แข่งต้องใช้สิทธิ์อัลติเพื่อเดินตามแนวนี้</p><button id="ultimate-guide-close" class="primary">กลับกระดาน</button></dialog>`);
let menuOpen = true;
let matchPaused = false;
let eventTimer: ReturnType<typeof setTimeout> | undefined;
function newMatchId() { return globalThis.crypto?.randomUUID?.() || `match-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
let matchId = newMatchId();
let hasSavedLocalGame = false;
let activeTraining: keyof typeof training | null = null;
let activeTrial: keyof typeof trials | null = null;
let activeDaily: string | null = null;
function activeTrialDefinition() { return activeDaily ? dailyChallenge(activeDaily).trial : trials[activeTrial!]; }
let presentation: BattlePresentation | undefined;
let resultPresentationKey = "";
let visualReplay = false;
let armoryAudition = false;
let auditionTimer: ReturnType<typeof setTimeout> | undefined;
let matchReward: { amount: number; message: string } | null = null;
let humanColor: Color = "w";
let initialFen = new Chess().fen();
let specialDuel = false;
let specialConfig = readSpecialConfig();
let activeVariant: ModeSession | null = null;
let activeContract: Contract | null = null;
let player: PlayerManager | undefined;
let rushStamp = performance.now();
$("#stage").insertAdjacentHTML("beforeend", `<section id="variant-hud" hidden aria-label="กติกาโหมดปัจจุบัน"><div><small id="variant-title"></small><strong id="variant-progress"></strong></div><p id="variant-forecast"></p><button id="variant-next" hidden>โจทย์ถัดไป</button></section>`);
$("#stage").insertAdjacentHTML("beforeend", '<section id="economy-hud" class="economy-hud" hidden aria-label="สัญญาและเครดิต"></section>');
let ultimateTarget: Square | null = null;
let game = new Chess(),
  mode: Mode = OFFLINE ? "bot" : "local",
  selected: Square | null = null,
  pending: { from: Square; to: Square } | null = null,
  lastMove: { from: Square; to: Square } | undefined;
let scene: ChessScene | undefined;
try {
  scene = new ChessScene($("#stage"));
  scene.setPaused(true);
} catch {
  $("#stage").classList.add("no-webgl");
  $("#stage").insertAdjacentHTML(
    "afterbegin",
    '<div class="fallback">เครื่องนี้เปิด 3D ไม่ได้ ใช้กระดาน 2D ด้านข้างเล่นได้</div>',
  );
  $("#board-details").setAttribute("open", "");
}
let localResult: Result = null;
let worker: Worker | undefined;
let botTimer: ReturnType<typeof setTimeout> | undefined;
let botJobFen: string | undefined;
let botReply:
  | { fen: string; move: { from: Square; to: Square; promotion?: PieceSymbol; ultimate?: boolean; portal?: boolean } }
  | undefined;
let noticeTimer: ReturnType<typeof setTimeout>;
let battleTimer: ReturnType<typeof setTimeout> | undefined;
let cachedStoryKey = "";
let cachedStory = matchStory([]);
function story() {
  const key = `${initialFen}|${game.fen()}|${game.history().join(" ")}`;
  if (key !== cachedStoryKey) {
    cachedStory = matchStory(game.history({ verbose: true }));
    cachedStoryKey = key;
  }
  return cachedStory;
}
function clearBattleToast() {
  clearTimeout(battleTimer);
  $("#battle-toast").classList.remove("visible");
  delete $("#stage").dataset.battleMoment;
}
let ws: WebSocket | undefined,
  state: State | null = null,
  session: { code: string; color: "w" | "b"; token: string } | null = null,
  reconnectTimer: ReturnType<typeof setTimeout> | undefined,
  serverStamp = Date.now(),
  requestPending = false;
let audio: AudioContext | undefined;
let spaceAudio: SpaceAudio | undefined;
let showcaseActive = false;
let showcase: CombatShowcase | undefined;
let showcaseSettings: ShowcaseSettings | undefined;
function stopSounds() { spaceAudio?.cancelEffects(); }
const storage = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};
const audioPreferences = readAudioPreferences(storage.get("special-chess-audio-mix"));
function saveAudioMix() { storage.set("special-chess-audio-mix", JSON.stringify(audioPreferences)); }
function syncMusic() {
  if (!spaceAudio || showcaseActive) return;
  spaceAudio.setPaused(document.hidden || matchPaused);
  if (document.hidden || matchPaused) return;
  const result = mode === "online" ? state?.result : localResult;
  const owner = mode === "online" ? session?.color : mode === "bot" || activeTrial || activeVariant?.id === "rush" ? humanColor : undefined;
  let music: MusicState = menuOpen ? "menu" : "normal";
  if (!menuOpen) {
    if ((scene?.animation?.move as UltimateMove | undefined)?.ultimate) music = "ultimate";
    else if (scene?.animation?.move.captured) music = "capture";
    else if (result || game.isGameOver()) {
      const winner = result?.winner ?? (game.isCheckmate() ? game.turn() === "w" ? "b" : "w" : null);
      music = winner ? !owner || winner === owner ? "victory" : "defeat" : "mate";
    } else if (activeTraining && game.history({ verbose: true }).some(move => move.from === training[activeTraining!].from && move.to === training[activeTraining!].to)) music = "victory";
    else if (game.isCheck()) music = "check";
    else if (selected && game instanceof SpecialChess && game.armed) music = "ultimate";
    else if (story().moments.at(-1)?.ply === game.history().length && ["queen-fallen", "comeback", "endgame"].includes(story().moments.at(-1)?.kind || "")) music = "threat";
  }
  spaceAudio.setMusicState(music);
}
let profile = readProfile(storage.get("special-chess-profile"));
function saveProfile() { storage.set("special-chess-profile", JSON.stringify(profile)); }
function changeEconomy(action: EconomyAction) {
  try {
    const unlocked = (Object.keys(skins) as SkinId[]).filter(skin => isSkinUnlocked(profile, skin));
    let message = "";
    if (action.type === "pull") {
      const random = () => { const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); return bytes[0] / 4294967296; };
      const reward = rollSkin(profile.economy, unlocked, random);
      profile = { ...profile, economy: reward.wallet };
      message = `${skins[reward.skin].name} · ${reward.duplicate ? `สกินซ้ำ +${reward.shards} เศษพลังงาน` : "สกินใหม่ · สวมให้หมากได้ในคลังแสง"}${reward.guaranteed ? " · รางวัลการันตี" : ""}`;
    } else if (action.type === "daily") {
      const reward = dailyCredits(profile.economy, utcDay()); profile = { ...profile, economy: reward.wallet };
      message = reward.added ? "รับเสบียง +100 เครดิตแล้ว" : "รับเสบียงวันนี้แล้ว";
    } else {
      profile = { ...profile, economy: forgeSkin(profile.economy, action.skin, unlocked) };
      message = `หลอม ${skins[action.skin].name} สำเร็จ · สวมได้ในคลังแสง`;
    }
    saveProfile(); title.refresh(profile);
    if (action.type !== "daily") { try { soundEngine()?.playEvent("promotion"); } catch { /* The completed transaction does not depend on audio. */ } }
    return message;
  } catch (error) { return error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ"; }
}
function reserveContract(id: string) {
  if (!activeContract) return true;
  try {
    const payment = enterContract(profile.economy, id, activeContract.mode);
    profile = { ...profile, economy: payment.wallet }; activeContract = { ...activeContract, id }; saveProfile(); return true;
  } catch (error) { notice(error instanceof Error ? error.message : "เครดิตไม่พอ"); return false; }
}
function contractMetrics() {
  const values: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const capturedValue = game.history({ verbose: true }).filter(move => move.color === humanColor).reduce((sum, move) => sum + (move.captured ? values[move.captured] : 0), 0);
  const scores = game instanceof VariantChess ? game.progress().scores : { w: 0, b: 0 };
  const spent = activeVariant?.options.draft?.reduce((sum, piece) => sum + values[piece], 0) ?? 24;
  return { won: true, draw: false, capturedValue, controlScore: scores[humanColor], unusedBudget: 24 - spent,
    solved: (activeVariant?.rushSolved || 0) + Number(activeContract?.mode === "payday" && localResult?.winner === humanColor) };
}
function checkContractReward() {
  if (!activeContract) return;
  if (!profile.economy.claimed.includes(`entry:${activeContract.mode}:${activeContract.id}`)) { activeContract = null; return; }
  const definition = economicDefinition(activeContract.mode)!;
  let result = localResult;
  if (activeContract.mode === "payday") {
    if (!activeVariant || !rushSessionFinished()) return;
  } else if (!result && game.isGameOver()) result = { winner: game.isCheckmate() ? game.turn() === "w" ? "b" : "w" : null, reason: "game" };
  if (!result) return;
  const reward = settleContract(profile.economy, activeContract.id, activeContract.mode, { ...contractMetrics(), won: result.winner === humanColor, draw: result.winner === null });
  if (!reward.added) return;
  profile = { ...profile, economy: reward.wallet }; saveProfile();
  const message = `${definition.name} · รับ ${reward.amount} เครดิต`;
  matchReward = { amount: matchReward?.amount || 0, message: `${matchReward?.message ? matchReward.message + " · " : ""}${message}` };
  saveLocal();
}
function selectSkin(skin: SkinId) {
  if (!isSkinUnlocked(profile, skin)) return;
  profile = equipArmy(profile, skin);
  saveProfile();
}
function selectPiece(color: Color, origin: Square, skin: SkinId) {
  profile = equipPiece(profile, color, origin, skin);
  saveProfile();
}
function armyAppearances(history = game.history({ verbose: true }), fen = initialFen) {
  const owner = mode === "bot" ? humanColor : undefined;
  let appearanceProfile: Profile = activeTrial || activeTraining ? scenarioLoadout(profile, fen) : profile;
  if (mode === "online" && state?.cosmetics) {
    const setup = new Chess(fen);
    const loadouts: Profile["loadouts"] = { w: {}, b: {} };
    for (const piece of setup.board().flat()) {
      if (!piece) continue;
      const army = state.cosmetics[piece.color];
      loadouts[piece.color][piece.square] = army.loadout[piece.square] || army.skin;
    }
    appearanceProfile = { ...profile, skin: "classic", loadouts };
  }
  const map = appearanceMap(fen, history, appearanceProfile, owner);
  if (mode === "bot") {
    const position = new Chess(fen);
    if (history.length) position.load(history.at(-1)!.after);
    const rival = currentRival();
    for (const piece of position.board().flat()) if (piece && piece.color !== humanColor) map[piece.square] = rival.skin;
  }
  return map;
}
function currentRival() {
  return activeTrial ? rivals[activeTrial === "rescue" ? 1 : activeTrial === "fork" ? 2 : 3]
    : rivals[Number($<HTMLSelectElement>("#difficulty").value) as 1 | 2 | 3] || rivals[2];
}
function renderGameBoard() {
  scene?.setAppearances(armyAppearances());
  scene?.renderBoard(game);
}
function resetPresentation() {
  resultPresentationKey = "";
  visualReplay = false;
  presentation?.clear();
}
function grantReward(id: string, amount: number, win = false, match = false) {
  const reward = claimXP(profile, id, amount, win, match);
  if (!reward.added) return;
  profile = reward.profile;
  if (!activeContract) {
    const credits = claimCredits(profile.economy, `reward:${id}`, Math.min(250, amount), "รางวัลจากการเล่น");
    profile = { ...profile, economy: credits.wallet };
  }
  saveProfile();
  matchReward = { amount, message: `+${amount} XP${!activeContract ? ` · +${Math.min(250, amount)} เครดิต` : ""} · เลเวล ${levelProgress(profile.xp).level}${reward.unlocked.length ? " · ปลดล็อก " + reward.unlocked.map((skin) => skins[skin].name).join(", ") : ""}` };
  if (mode !== "online") saveLocal();
}
function checkRewards() {
  let rewardVisible = false;
  const stars = (color: Color) => Object.values(story().missions[color]).filter(Boolean).length;
  if (activeVariant && game instanceof VariantChess) {
    const outcome = game.outcome();
    localResult = outcome ? { winner: outcome.winner, reason: outcome.label } : null;
    if (outcome && mode === "bot" && (activeVariant.id !== "mirror" || activeVariant.options.round === 2)) {
      rewardVisible = true;
      const scores = activeVariant.id === "mirror" ? mirrorScore(activeVariant, outcome.winner, humanColor) : null;
      const won = scores ? scores[activeVariant.firstColor] > scores[activeVariant.firstColor === "w" ? "b" : "w"] : outcome.winner === humanColor;
      grantReward(matchId, won ? 80 : 20, won, true);
    }
  } else if (activeVariant?.id === "rush") {
    const last = game.history({ verbose: true }).at(-1);
    localResult = activeVariant.rushRemaining <= 0 ? { winner: null, reason: "หมดเวลา Puzzle Rush" }
      : last ? { winner: game.isCheckmate() ? humanColor : humanColor === "w" ? "b" : "w", reason: game.isCheckmate() ? "แก้โจทย์สำเร็จ" : "ยังไม่ใช่รุกฆาตในหนึ่งตา" } : null;
  } else if (activeTrial) {
    const trial = activeTrialDefinition();
    const outcome = evaluateTrial(trial, game);
    if (outcome !== "active") {
      localResult = { winner: outcome === "won" ? trial.side : trial.side === "w" ? "b" : "w", reason: "objective" };
      if (outcome === "won") {
        rewardVisible = true;
        if (activeDaily) grantReward(`daily:${activeDaily}`, dailyProgress(profile.claimed, activeDaily).reward);
        else grantReward("trial:" + activeTrial, activeTrial === "boss" ? 100 : activeTrial === "fork" ? 80 : 60);
      }
    } else localResult = null;
  } else if (activeTraining) {
    const target = training[activeTraining];
    const last = game.history({ verbose: true }).at(-1);
    if (last?.from === target.from && last.to === target.to) {
      rewardVisible = true;
      grantReward("training:" + activeTraining, 40);
    }
  } else if (mode === "bot" && initialFen === new Chess().fen() && game.isGameOver()) {
    rewardVisible = true;
    const winner = game.isCheckmate() ? game.turn() === "w" ? "b" : "w" : null;
    grantReward(matchId, matchXP(winner, humanColor, Number($<HTMLSelectElement>("#difficulty").value), stars(humanColor)), winner === humanColor, true);
  } else if (mode === "online" && session && state?.result && game.history().length >= 4) {
    rewardVisible = true;
    grantReward("room:" + session.code, matchXP(state.result.winner, session.color, 2, stars(session.color)), state.result.winner === session.color, true);
  }
  checkContractReward();
  if (activeContract) rewardVisible = !!matchReward;
  const economyHUD = $("#economy-hud"); economyHUD.hidden = !activeContract;
  if (activeContract) {
    const definition = economicDefinition(activeContract.mode)!;
    const metrics = contractMetrics(), potential = contractAmount(activeContract.mode, metrics);
    const goal = activeContract.mode === "bounty" ? `ค่าหัว ${metrics.capturedValue} แต้ม` : activeContract.mode === "vault" ? `ยึดคลัง ${metrics.controlScore}/5` : activeContract.mode === "broker" ? `ประหยัด ${Math.max(0, Math.min(12, metrics.unusedBudget))} แต้ม` : activeContract.mode === "payday" ? `แก้ได้ ${metrics.solved} ข้อ` : `เดิมพัน ${definition.entry}`;
    economyHUD.innerHTML = `<strong>${definition.name} · ${profile.economy.credits} เครดิต</strong><span>${profile.economy.claimed.includes(`contract:${activeContract.id}`) ? "ปิดสัญญาและรับเงินแล้ว" : `${goal} · ${activeContract.mode === "payday" ? "จบรอบรับ" : "ชนะรับ"} ${potential}`}</span>`;
  }
  $("#player-level").textContent = `Lv.${levelProgress(profile.xp).level}`;
  $("#xp-reward").hidden = !matchReward || !rewardVisible;
  $("#xp-reward").textContent = matchReward?.message || "";
}
function notice(message: string) {
  $("#notice").textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => ($("#notice").textContent = ""), 6000);
}
function stopBot() {
  clearTimeout(botTimer);
  botTimer = undefined;
  botJobFen = undefined;
  botReply = undefined;
  worker?.terminate();
  worker = undefined;
}
function clearSelection() {
  selected = null;
  pending = null;
  ultimateTarget = null;
  if (game instanceof SpecialChess) game.armed = null;
  $("#promotion").hasAttribute("open") &&
    $<HTMLDialogElement>("#promotion").close();
  scene?.select(game, null, lastMove);
}
function isBusy() {
  return !!scene?.animation || !!worker;
}
function canPlay() {
  if (menuOpen || matchPaused || isBusy() || game.isGameOver() || localResult) return false;
  if (mode === "bot" && game.turn() !== humanColor) return false;
  if (mode === "online")
    return (
      !!state?.started &&
      !state.result &&
      session?.color === game.turn() &&
      ws?.readyState === WebSocket.OPEN
    );
  return true;
}
function resultText(result: Result) {
  if (!result) return "";
  const reason =
    (
      {
        checkmate: "รุกฆาต",
        draw: "เสมอ",
        timeout: "หมดเวลา",
        resign: "ยอมแพ้",
        objective: "ภารกิจจบแล้ว",
      } as Record<string, string>
    )[result.reason] || result.reason;
  return result.winner
    ? `ฝ่าย${result.winner === "w" ? "ขาว" : "ดำ"}ชนะ · ${reason}`
    : `เกมเสมอ · ${reason}`;
}
function updateUI() {
  checkRewards();
  const result = mode === "online" ? state?.result : localResult;
  const turn = game.turn();
  $("#status").textContent = matchPaused ? "พักการประลอง" : result
    ? resultText(result)
    : game.isCheckmate()
      ? `รุกฆาต · ฝ่าย${turn === "w" ? "ดำ" : "ขาว"}ชนะ`
      : game.isDraw()
        ? "เกมเสมอ"
        : mode === "online" && !state?.started
          ? "รอเพื่อนเข้าร่วม"
          : `ตาฝ่าย${turn === "w" ? "ขาว" : "ดำ"}${game.isCheck() ? " · รุก!" : ""}${mode === "bot" && turn !== humanColor ? " · กำลังคิด" : ""}`;
  $("#white-player").classList.toggle(
    "current",
    turn === "w" && !game.isGameOver() && !result,
  );
  $("#black-player").classList.toggle(
    "current",
    turn === "b" && !game.isGameOver() && !result,
  );
  $("#result").hidden = !(result || game.isGameOver());
  $("#result").textContent = result
    ? resultText(result)
    : game.isCheckmate()
      ? "ราชันถูกล้อม · การประลองสิ้นสุด"
      : "การประลองจบด้วยผลเสมอ";
  $("#white-label").textContent =
    mode === "online"
      ? (session?.color === "w" ? "คุณ" : "คู่แข่ง") +
        (state?.connected.w ? " · เชื่อมต่อ" : " · หลุด")
      : mode === "bot"
        ? humanColor === "w"
          ? "คุณ"
          : "บอต · " + $<HTMLSelectElement>("#difficulty").selectedOptions[0].textContent
        : (specialDuel || activeVariant) && humanColor === "b" ? "ผู้เล่น 2" : "ผู้เล่น 1";
  $("#black-label").textContent =
    mode === "online"
      ? (session?.color === "b" ? "คุณ" : "คู่แข่ง") +
        (state?.connected.b ? " · เชื่อมต่อ" : " · ยังไม่เชื่อมต่อ")
      : mode === "bot"
        ? humanColor === "b"
          ? "คุณ"
          : "บอต · " + $<HTMLSelectElement>("#difficulty").selectedOptions[0].textContent
        : (specialDuel || activeVariant) && humanColor === "b" ? "ผู้เล่น 1" : "ผู้เล่น 2";
  $("#connection").textContent =
    mode === "online"
      ? ws?.readyState === 1
        ? "● เชื่อมต่อแล้ว"
        : "○ กำลังเชื่อมต่อ"
      : "OFFLINE READY";
  $("#mode-tag").textContent =
    activeVariant ? modeDefinitions.find(definition => definition.id === activeVariant!.id)!.name.toUpperCase() : specialDuel ? "SPECIAL DUEL · ULTIMATE ARENA" : activeDaily ? "DAILY RIFT" : activeTrial ? "TACTICAL CHAPTER" : mode === "bot"
      ? "SOLO CHALLENGE"
      : mode === "online"
        ? "ONLINE DUEL"
        : "LOCAL DUEL";
  $("#hint").textContent = selected
    ? `${names[game.get(selected)!.type]} · ${selected.toUpperCase()} — เลือกช่องปลายทาง`
    : mode === "online" && !state?.started
      ? "ส่งรหัสห้องให้เพื่อนเพื่อเริ่ม"
      : activeTrial ? activeTrialDefinition().hint : "แตะหมาก · ลากหมุน · เลื่อนซูม";
  if (mode === "bot") {
    const rival = currentRival();
    $(`#${humanColor === "w" ? "black" : "white"}-label`).textContent = `${rival.name} · ${rival.title}`;
  }
  if (player?.hasIdentity && mode !== "online") {
    const owner = mode === "bot" || activeVariant ? humanColor : "w";
    $(`#${owner === "w" ? "white" : "black"}-label`).textContent = player.displayName;
  }
  if (mode === "online" && state?.players) for (const color of ["w", "b"] as const) {
    const name = state.players[color]?.name;
    if (name) $(`#${color === "w" ? "white" : "black"}-label`).textContent = `${name}${state.connected[color] ? " · เชื่อมต่อ" : " · หลุด"}`;
  }
  $("#training-panel").hidden = mode === "online";
  $('[data-hud-open="training"]').hidden = mode === "online";
  $(".pause-caption").textContent = mode === "online"
    ? "แมตช์ออนไลน์ยังดำเนินต่อ · นาฬิกาจะไม่หยุด" : "พักวางแผน แล้วกลับไปสร้างตำนาน";
  $("#online-panel").hidden = mode !== "online";
  $("#local-actions").hidden = mode === "online";
  $("#undo").hidden = mode === "online";
  $("#resign").hidden = mode !== "online" || !state?.started || !!state.result;
  $("#difficulty").hidden = mode !== "bot" || !!activeTrial;
  $("#side-control").hidden = mode !== "bot" || !!activeTrial || !!activeContract || activeVariant?.id === "mirror";
  $("#reset").textContent = activeTrial ? "เริ่มบทใหม่" : "เกมใหม่";
  $<HTMLSelectElement>("#human-side").value = humanColor;
  const contractSettled = !!activeContract && profile.economy.claimed.includes(`contract:${activeContract.id}`);
  $<HTMLButtonElement>("#undo").disabled = contractSettled || (
    mode === "bot"
      ? !game.history({ verbose: true }).some((move) => move.color === humanColor)
      : !game.history().length);
  $("#undo").title = contractSettled ? "สัญญารับเงินแล้ว · เริ่มรอบใหม่" : "ย้อนตา";
  const { captured, balance } = matchMaterial(game);
  for (const color of ["w", "b"] as const) {
    const label = color === "w" ? "white" : "black";
    const enemy = color === "w" ? "b" : "w";
    $(`#${label}-captured`).innerHTML = captured[color].map((piece) => geometricPiece(piece, enemy)).join("") || "—";
    $(`#${label}-captured`).setAttribute("aria-label", captured[color].map((piece) => names[piece]).join(", ") || "ยังไม่ได้กินหมาก");
    const lead = (color === "w" ? 1 : -1) * balance;
    $(`#${label}-material`).textContent = lead > 0 ? `+${lead}` : "";
  }
  $("#room-info").hidden = !session;
  $("#leave").hidden = !session;
  $("#create").hidden = !!session;
  $<HTMLFormElement>("#join-form").hidden = !!session;
  if (session) $("#code").textContent = session.code;
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-mode]"))
    b.classList.toggle("active", b.dataset.mode === mode);
  const h = game.history();
  $("#moves").innerHTML = h.length
    ? h
        .map(
          (s, i) =>
            `${i % 2 === 0 ? `<span class="move-number">${Math.floor(i / 2) + 1}.</span>` : ""}<span class="san${i === h.length - 1 ? " latest" : ""}">${s}</span>`,
        )
        .join("")
    : '<p class="muted">การเดินแรกเริ่มเรื่องราวของคุณ</p>';
  $("#moves").scrollTop = $("#moves").scrollHeight;
  updateBattleUI();
  updateFlatBoard();
  updateSpecialHUD();
  updateVariantHUD();
  updateTactics();
  updateClocks();
  const replayControl = document.querySelector<HTMLButtonElement>("#replay-capture");
  if (replayControl) replayControl.disabled = !game.history({ verbose: true }).some((move) => move.captured) || isBusy() || mode === "online" && !state?.result;
  updatePresentation();
  syncMusic();
}
function updatePresentation() {
  if (!presentation || menuOpen || scene?.animation || visualReplay || armoryAudition) return;
  const result = mode === "online" ? state?.result : localResult;
  const trainingWon = activeTraining && game.history({ verbose: true }).some((move) => move.from === training[activeTraining!].from && move.to === training[activeTraining!].to);
  if (!result && !game.isGameOver() && !trainingWon) return;
  const key = `${matchId}:${game.fen()}:${result?.reason || ""}`;
  if (resultPresentationKey === key) return;
  resultPresentationKey = key;
  const owner = mode === "online" ? session?.color : mode === "bot" || activeTrial || activeVariant?.id === "rush" ? humanColor : undefined;
  const winner = result?.winner ?? (game.isCheckmate() ? game.turn() === "w" ? "b" : "w" : null);
  const mvp = battleMVP(initialFen, game.history({ verbose: true }), owner, activeVariant && game instanceof VariantChess ? () => createVariant(activeVariant!.id, activeVariant!.options, initialFen) : game instanceof SpecialChess ? () => new SpecialChess(initialFen,undefined,specialConfig) : undefined);
  const mvpSkin = mvp ? armyAppearances([])[mvp.origin] || profile.skin : profile.skin;
  const titleText = activeVariant?.id === "rush" ? activeVariant.rushRemaining <= 0 ? "Puzzle Rush จบแล้ว" : winner === humanColor ? "อ่านเกมได้เฉียบคม" : "ลองโจทย์ถัดไป" : activeDaily ? winner === humanColor ? "พิชิตศึกประจำวัน" : "ราชันรอการแก้มือ" : trainingWon ? "ฝึกสำเร็จ" : activeTrial ? winner === humanColor ? "ภารกิจสำเร็จ" : "ลองวางแผนใหม่" : winner === null ? "ศึกเสมอ" : owner ? winner === owner ? "ชัยชนะของกองทัพคุณ" : "ราชันรอการกลับมา" : `ชัยชนะฝ่าย${winner === "w" ? "ขาว" : "ดำ"}`;
  presentation.showResult({
    title: titleText,
    subtitle: activeContract && profile.economy.claimed.includes(`contract:${activeContract.id}`) ? matchReward?.message || "ปิดสัญญาแล้ว" : activeVariant ? variantResultSubtitle(winner) : activeDaily ? `${dailyChallenge(activeDaily).title} · ต่อเนื่อง ${dailyProgress(profile.claimed, activeDaily).streak} วัน` : activeTrial ? activeTrialDefinition().name : result ? resultText(result) : game.isCheckmate() ? "รุกฆาต · ราชันคู่แข่งพ่ายแพ้" : trainingWon ? "ลองท่าอื่นในสนามฝึก หรือเข้าสู่ศึกจริง" : "ทุกตาสร้างเรื่องราวของกองทัพ",
    xp: matchReward?.amount || 0,
    mvp: mvp ? `${avatarNames[mvpSkin][mvp.piece]} · ${mvp.origin.toUpperCase()} · สังหาร ${mvp.kills} ตัว` : undefined,
    unlocks: matchReward?.message.includes("ปลดล็อก") ? [matchReward.message.split("ปลดล็อก ")[1]] : [],
    replay: game.history({ verbose: true }).some((move) => !!move.captured),
    rematch: specialDuel || !!activeVariant && !["rush", "mirror"].includes(activeVariant.id),
    continueLabel: activeVariant?.id === "mirror" ? activeVariant.options.round === 1 ? "รอบ 2 · สลับสี" : "เริ่มศึกกระจกใหม่" : activeVariant?.id === "rush" ? rushSessionFinished() ? "เริ่ม Puzzle Rush ใหม่" : "โจทย์ถัดไป" : activeDaily ? winner === humanColor ? "กลับค่าย · ดูศึกประจำวัน" : "ลองศึกนี้อีกครั้ง" : mode === "online" ? "กลับค่าย" : activeTrial && winner !== humanColor ? "ลองบทนี้อีกครั้ง" : activeTrial ? "บทถัดไป" : trainingWon ? "ฝึกท่าถัดไป" : "ประลองอีกครั้ง",
  });
  scene?.celebrate(trainingWon ? game.history({ verbose: true }).at(-1)?.color || null : winner, mvp?.square);
  soundEngine()?.playEvent(trainingWon || winner === owner || !owner && winner ? "victory" : winner === null ? "mission" : "defeat");
}
function updateBattleUI() {
  const enabled = $<HTMLInputElement>("#battle-events").checked;
  $("#missions").hidden = !enabled && !activeTrial;
  $("#missions p").textContent = activeTrial ? "เป้าหมายของบท · จำนวนตานับเฉพาะฝ่ายของคุณ" : "เป้าหมายเสริม · เก็บดาวระหว่างการประลอง";
  $("#battle-log-panel").hidden = !enabled;
  const color = mode === "bot" ? humanColor : mode === "online" ? session?.color || "w" : game.turn();
  const data = story();
  const missions = data.missions[color];
  $("#mission-title").textContent = `ภารกิจฝ่าย${color === "w" ? "ขาว" : "ดำ"}`;
  const count = Object.values(missions).filter(Boolean).length;
  $("#mission-stars").textContent = "★ ".repeat(count) + "☆ ".repeat(3 - count);
  $("#mission-stars").setAttribute("aria-label", `สำเร็จ ${count} จาก 3 ภารกิจ`);
  $("#mission-list").innerHTML = ([
    ["check", "รุกคิงคู่แข่งหนึ่งครั้ง"],
    ["capture", "กินม้า บิชอป รุก หรือควีน"],
    ["castle", "เข้าป้อมปกป้องคิง"],
  ] as const).map(([key, label]) => `<div class="mission ${missions[key] ? "complete" : ""}"><span>${missions[key] ? "★" : "☆"}</span>${label}</div>`).join("");
  if (activeTrial) {
    const trial = activeTrialDefinition();
    const outcome = evaluateTrial(trial, game);
    const used = game.history({ verbose: true }).filter((move) => move.color === trial.side).length;
    $("#mission-title").textContent = activeDaily ? dailyChallenge(activeDaily).title : trial.name;
    $("#mission-stars").textContent = `${used} / ${trial.maxMoves} ตา`;
    $("#mission-list").innerHTML = `<div class="mission ${outcome === "won" ? "complete" : ""}"><span>${outcome === "won" ? "★" : "☆"}</span>${trial.hint}</div>`;
  }
  $("#objective-peek").hidden = !!activeVariant || !enabled && !activeTrial;
  $("#objective-label").textContent = activeDaily ? "ศึกประจำวัน" : activeTrial ? activeTrialDefinition().name : "ภารกิจกองทัพ";
  $("#objective-progress").textContent = activeTrial ? $("#mission-stars").textContent : `${count} / 3 เป้าหมาย · แตะดูรายละเอียด`;
  $("#objective-peek").classList.toggle("quest-complete", activeTrial ? evaluateTrial(activeTrialDefinition(), game) === "won" : count === 3);
  $("#battle-log").innerHTML = data.moments.length ? data.moments.slice(-8).reverse().map((moment) =>
    `<div data-battle-kind="${moment.kind}"><strong>${moment.title}</strong><small>${moment.description}</small></div>`).join("")
    : '<p class="muted">อีเวนท์จะเกิดตามจังหวะของการต่อสู้</p>';
}
function updateFlatBoard() {
  const focused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement.dataset.square
      : undefined;
  const moves = selected ? game.moves({ square: selected, verbose: true }) : [];
  const legal = moves.map(m => m.to);
  const field=game instanceof SpecialChess?game.field:null;
  const fieldEvent=field?.active||field?.forecast;
  const captures = moves.filter(m => m.captured).map(m => m.to);
  const checkedKing = game.isCheck() ? kingSquare(game, game.turn()) : null;
  const flipped = scene?.flipped ?? ((mode === "bot" || !!activeVariant || specialDuel) && humanColor === "b");
  const order = flipped
    ? [1, 2, 3, 4, 5, 6, 7, 8]
    : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = flipped ? "hgfedcba" : "abcdefgh";
  let html = "";
  for (const rank of order)
    for (const file of files) {
      const s = (file + rank) as Square,
        p = game.get(s);
      html += `<button data-square="${s}" class="square ${(file.charCodeAt(0) + rank) % 2 ? "dark" : "light"} ${fieldEvent?.squares.includes(s) ? `field-square field-${fieldEvent.kind} ${field?.active?"field-active":"field-warning"}` : ""} ${selected === s ? "selected" : ""} ${legal.includes(s) ? "legal" : ""} ${captures.includes(s) ? "capture" : ""} ${activeVariant?.id === "control" && ["d4", "e4", "d5", "e5"].includes(s) ? "control-square" : ""} ${s === lastMove?.from || s === lastMove?.to ? "last" : ""} ${s === checkedKing ? "checked" : ""} ${p?.color === "w" ? "white-piece" : "black-piece"}" aria-label="${s}${p ? " " + (p.color === "w" ? "ขาว" : "ดำ") + " " + names[p.type] : ""}${legal.includes(s) ? captures.includes(s) ? " กินหมากได้" : " เดินได้" : ""}"><span>${p ? geometricPiece(p.type, p.color) : ""}</span><small>${s}</small></button>`;
    }
  $("#flat-board").innerHTML = html;
  if (focused)
    document
      .querySelector<HTMLButtonElement>(`[data-square="${focused}"]`)
      ?.focus({ preventScroll: true });
}
function updateTactics(target: MovePreview | null = null) {
  const panel = $("#tactical-readout");
  const piece = selected && game.get(selected);
  panel.hidden = !piece || !canPlay();
  document.querySelectorAll("#flat-board .preview").forEach(el => el.classList.remove("preview"));
  if (!piece || !selected) return;
  const options = new Set(game.moves({ square: selected, verbose: true }).map(m => m.to)).size;
  panel.querySelector("strong")!.textContent = `${symbols[piece.color][piece.type]} ${names[piece.type]} ${selected.toUpperCase()} · ${options} ทางเดิน`;
  panel.classList.toggle("ultimate-preview", game instanceof SpecialChess && !!game.armed);
  panel.dataset.tone = target?.mate || target?.check ? "check" : target?.controlled ? "danger" : target?.captured ? "capture" : "move";
  panel.querySelector("span")!.textContent = target
    ? `${target.castle ? "เข้าป้อม" : target.captured ? "กิน" + names[target.captured] : target.ultimate ? "อัลติ" : target.piece === "n" ? "กระโดด" : "เดิน"} → ${target.to.toUpperCase()}${target.promotion ? " · ตัวอย่างเลื่อนขั้นเป็น" + names[target.promotion] : ""}${target.mate ? " · รุกฆาต" : target.check ? " · รุกคิง" : ""}${target.controlled && !target.mate ? " · อยู่ในแนวคุมคู่แข่ง" : ""}`
    : game instanceof SpecialChess && game.armed ? "เป้าม่วง = อัลติ · เลือกปลายทางแล้วกดยืนยัน" : "จุดเขียว = เดิน · กรอบชมพู = กินหมาก";
  if (target) document.querySelector(`[data-square="${target.to}"]`)?.classList.add("preview");
}
function rushSessionFinished() {
  return !!activeVariant && (activeVariant.rushRemaining <= 0 || activeVariant.rushFailures + (localResult && localResult.winner !== humanColor ? 1 : 0) >= 3);
}
function variantResultSubtitle(winner: Color | null) {
  if (!activeVariant) return "";
  if (activeVariant.id === "mirror") {
    const scores = mirrorScore(activeVariant, winner, humanColor);
    const first = scores[activeVariant.firstColor], second = scores[activeVariant.firstColor === "w" ? "b" : "w"];
    return `รอบ ${activeVariant.options.round || 1} / 2 · ผู้เล่น 1 ${first} : ${second} ผู้เล่น 2${activeVariant.options.round === 2 ? first === second ? " · รวมสองรอบเสมอ" : first > second ? " · ผู้เล่น 1 ชนะชุดดวล" : " · ผู้เล่น 2 ชนะชุดดวล" : " · รอบถัดไปสลับสี บนตำแหน่งเดิม"}`;
  }
  if (activeVariant.id === "rush") return `แก้สำเร็จ ${activeVariant.rushSolved + (localResult?.winner === humanColor ? 1 : 0)} ข้อ · พลาด ${Math.min(3, activeVariant.rushFailures + (localResult && localResult.winner !== humanColor && activeVariant.rushRemaining > 0 ? 1 : 0))} / 3 · ${Math.ceil(activeVariant.rushRemaining / 1000)} วินาที`;
  const progress = game instanceof VariantChess ? game.progress() : null;
  return `${localResult ? resultText(localResult) : ""}${progress && ["control", "score"].includes(activeVariant.id) ? ` · ขาว ${progress.scores.w} : ${progress.scores.b} ดำ` : ""}`;
}
function updateVariantHUD() {
  const panel = $("#variant-hud");
  panel.hidden = !activeVariant;
  $("#stage").dataset.variant = activeVariant?.id || "";
  $("#variant-next").hidden = true;
  if (!activeVariant) return;
  const definition = modeDefinitions.find(definition => definition.id === activeVariant!.id)!;
  $("#variant-title").textContent = definition.name;
  let progress = "", forecast = "";
  if (activeVariant.id === "rush") {
    const seconds = Math.ceil(activeVariant.rushRemaining / 1000);
    progress = `${activeVariant.rushSolved} สำเร็จ · ${activeVariant.rushFailures} / 3 พลาด · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    forecast = `โจทย์ ${activeVariant.rushIndex + 1} · สถิติ ${Number(storage.get("special-chess-rush-best")) || 0} · รุกฆาตในหนึ่งตา`;
    $("#variant-next").hidden = !localResult;
    $("#variant-next").textContent = rushSessionFinished() ? "เริ่ม Rush ใหม่" : "โจทย์ถัดไป";
  } else if (game instanceof VariantChess) {
    const state = game.progress();
    progress = activeVariant.id === "score" ? `ขาว ${state.scores.w} : ${state.scores.b} ดำ · ตา ${Math.max(state.turns.w, state.turns.b)} / 12`
      : activeVariant.id === "control" ? `ขาว ${state.scores.w} : ${state.scores.b} ดำ · เป้าหมาย 5`
      : activeVariant.id === "mirror" ? `รอบ ${activeVariant.options.round || 1} / 2 · ผู้เล่น 1 ${activeVariant.mirrorWins[activeVariant.firstColor]} : ${activeVariant.mirrorWins[activeVariant.firstColor === "w" ? "b" : "w"]} ผู้เล่น 2`
      : activeVariant.id === "chaos" ? state.phaseLabel : `ทีมขาว ${game.board().flat().filter(p => p?.color === "w").length} ตัว · ทีมดำ ${game.board().flat().filter(p => p?.color === "b").length} ตัว`;
    forecast = activeVariant.id === "chaos" ? `รอบถัดไป: ${state.forecastLabel} · เปลี่ยนหลังฝ่ายดำเดิน`
      : activeVariant.id === "control" ? "จบรอบบน D4 / E4 / D5 / E5 ได้ฝ่ายละ 1 แต้ม"
      : activeVariant.id === "score" ? "เบี้ย 1 · ม้า/บิชอป 3 · เรือ 5 · ควีน 9 · รุกฆาตชนะทันที"
      : activeVariant.id === "mirror" ? "ชุดหมากเดียวกัน · รอบสองสลับสี · รุกฆาตชนะรอบ"
      : "งบเท่ากัน · จัดกองทัพขาวก่อนเริ่ม · ไม่มีการเข้าป้อม";
  }
  $("#variant-progress").textContent = progress;
  $("#variant-forecast").textContent = forecast;
}
function startVariantBoard(preserveSession = false) {
  if (!activeVariant) return;
  const nextId = newMatchId();
  if (!preserveSession && !reserveContract(nextId)) return;
  if (!preserveSession) activeVariant = newModeSession(activeVariant.id, activeVariant.options, humanColor);
  resetPresentation(); stopBot(); scene?.cancel(); clearBattleToast(); scene?.resetPacing();
  matchId = nextId; matchReward = null; activeTraining = null; activeTrial = null; activeDaily = null; specialDuel = false;
  localResult = null; lastMove = undefined; clearSelection();
  if (activeVariant.id === "rush") {
    const puzzle = rushPuzzle(activeVariant.options.seed, activeVariant.rushIndex);
    game = new Chess(puzzle.fen); humanColor = puzzle.side; mode = "local";
  } else {
    if (activeVariant.id === "draft") activeVariant.options.draftColor = humanColor;
    game = createVariant(activeVariant.id, activeVariant.options);
  }
  initialFen = game.fen(); rushStamp = performance.now();
  renderGameBoard(); scene?.resetView(humanColor === "b");
  saveLocal(); updateUI(); scheduleBot();
}
function advanceVariant() {
  if (!activeVariant || !localResult) return;
  if (activeVariant.id === "mirror" && activeVariant.options.round !== 2) {
    activeVariant.mirrorWins = mirrorScore(activeVariant, localResult.winner, humanColor);
    activeVariant.options.round = 2;
    humanColor = humanColor === "w" ? "b" : "w";
    startVariantBoard(true);
  } else if (activeVariant.id === "rush" && !rushSessionFinished()) {
    if (localResult.winner === humanColor) activeVariant.rushSolved++;
    else activeVariant.rushFailures++;
    activeVariant.rushIndex++;
    startVariantBoard(true);
  } else if (activeVariant.id === "rush" && rushSessionFinished()) {
    if (localResult.winner === humanColor) activeVariant.rushSolved++;
    const bestKey = "special-chess-rush-best";
    const best = Number(storage.get(bestKey)) || 0;
    if (activeVariant.rushSolved > best) storage.set(bestKey, String(activeVariant.rushSolved));
    startVariantBoard();
  } else startVariantBoard();
}
$("#variant-next").onclick = advanceVariant;
function updateSpecialHUD() {
  let fieldPanel=document.querySelector<HTMLElement>("#field-hud");
  if(!fieldPanel){fieldPanel=document.createElement("div");fieldPanel.id="field-hud";fieldPanel.setAttribute("role","status");$("#stage").append(fieldPanel);}
  const field=game instanceof SpecialChess?game.field:null;fieldPanel.hidden=!field;
  if(field){fieldPanel.dataset.kind=(field.active||field.forecast).kind;fieldPanel.dataset.state=field.active?"active":"warning";
    const event=field.active||field.forecast;
    fieldPanel.innerHTML=`<small>${field.active?"FIELD ACTIVE":"FIELD FORECAST"} · รอบ ${field.round+1}</small><strong>${event.label}</strong><span>${event.squares.join(" ↔ ").toUpperCase()} · ${field.active?`เหลือ ${field.endsIn} รอบ`:`เริ่มใน ${field.startsIn} รอบ`}</span><details><summary>กติกาสนาม</summary><p>${event.description}</p>${field.active?`<p>ถัดไป ${field.forecast.label} · ${field.forecast.squares.join(" / ").toUpperCase()} · อีก ${field.startsIn} รอบ</p>`:""}</details>`;}
  const panel = $("#ultimate-hud");
  panel.hidden = !(game instanceof SpecialChess);
  $("#stage").classList.toggle("special-duel", game instanceof SpecialChess);
  $("#flat-board").classList.toggle("ultimate-armed", game instanceof SpecialChess && !!game.armed);
  if (!(game instanceof SpecialChess)) return;
  const reserves = game.remaining;
  for (const [color, selector] of [["w", "#ultimate-white"], ["b", "#ultimate-black"]] as const) {
    $(selector).innerHTML = Array.from({ length: game.config.charges }, (_, i) => `<i class="${i < reserves[color] ? "charged" : "spent"}">◆</i>`).join("");
    $(selector).setAttribute("aria-label", `เหลือ ${reserves[color]} จาก ${game.config.charges} ครั้ง`);
  }
  const arm = $<HTMLButtonElement>("#ultimate-arm"), piece = selected && game.get(selected);
  const ready = !!selected && game.available(selected);
  arm.disabled = !canPlay() || !ready || !!selected && game.ultimateMoves(selected).length === 0;
  arm.setAttribute("aria-pressed", String(!!game.armed));
  arm.classList.toggle("armed", !!game.armed);
  if (piece) {
    arm.style.setProperty("--ultimate-color", `#${game.skill(piece.type,piece.color).color.toString(16)}`);
    arm.querySelector("strong")!.textContent = game.armed ? "ยกเลิกอัลติ" : game.skill(piece.type,piece.color).label;
    arm.querySelector("small")!.textContent = !ready ? reserves[piece.color] === 0 ? "พลังฝ่ายนี้หมดแล้ว" : game.choice(piece.type,piece.color)==="off" ? "ไม่ได้ติดตั้งสกิลในชุดนี้" : "หมากตัวนี้ใช้อัลติแล้ว" : arm.disabled ? "ยังไม่มีช่องอัลติที่เดินได้" : game.skill(piece.type,piece.color).description;
  } else {
    arm.querySelector("strong")!.textContent = "เลือกหมากเพื่อใช้อัลติ";
    arm.querySelector("small")!.textContent = `ฝ่ายละ ${game.config.charges} ครั้ง · ${game.config.reusable ? "หมากใช้ซ้ำได้" : "ตัวละ 1 ครั้ง"}`;
  }
  const confirm = $<HTMLButtonElement>("#ultimate-confirm");
  confirm.hidden = !ultimateTarget || !game.armed;
  confirm.disabled = !canPlay();
  confirm.textContent = `ยืนยันอัลติ → ${ultimateTarget?.toUpperCase() || ""}`;
}
$("#ultimate-arm").onclick = () => {
  if (!(game instanceof SpecialChess) || !selected || !canPlay()) return;
  game.armed = game.armed ? null : selected; ultimateTarget = null;
  scene?.select(game, selected, lastMove); updateUI();
  if (game.armed) soundEngine()?.play(game.get(selected)!.type, "charge", 0.3, false, 0, armyAppearances()[selected] || profile.skin, true);
};
$("#ultimate-confirm").onclick = () => {
  if (!(game instanceof SpecialChess) || !selected || !ultimateTarget || !canPlay()) return;
  const options = game.ultimateMoves(selected).filter(m => m.to === ultimateTarget);
  if (options.some(m => m.promotion)) { pending = { from: selected, to: ultimateTarget }; $<HTMLDialogElement>("#promotion").showModal(); }
  else commitMove(selected, ultimateTarget, "q", true);
};
function enemyUltimateBoard() {
  if (!(game instanceof SpecialChess)) return null;
  const parts = game.fen().split(" "); parts[1] = game.turn() === "w" ? "b" : "w"; parts[3] = "-";
  return new SpecialChess(parts.join(" "), game.snapshot());
}
$("#ultimate-help").onclick = () => {
  if (!(game instanceof SpecialChess) || isBusy()) return;
  $("#ultimate-guide > p").textContent = `ฝ่ายละ ${game.config.charges} ชาร์จ · ${game.config.reusable ? "หมากใช้ซ้ำได้" : "ตัวละหนึ่งครั้ง"} · ใช้แทนการเดินหนึ่งตา · คิงต้องปลอดภัย`;
  $("#ultimate-guide .ultimate-catalog").innerHTML = (["p","n","b","r","q","k"] as PieceSymbol[]).map(piece => {
    const skill = (game as SpecialChess).skill(piece);
    return `<article style="--ultimate-color:#${skill.color.toString(16)}"><i>${symbols.w[piece]}</i><div><small>${skill.name}</small><strong>${skill.label}</strong><p>${skill.description}</p></div></article>`;
  }).join("");
  const enemy = enemyUltimateBoard()!;
  const select = $<HTMLSelectElement>("#ultimate-enemy");
  select.innerHTML = '<option value="">เลือกหมากเพื่อดูแนวเดินที่เป็นไปได้</option>' + enemy.board().flat().filter(p => p && p.color === enemy.turn()).map(p => `<option value="${p!.square}" ${!enemy.available(p!.square) ? "disabled" : ""}>${symbols[p!.color][p!.type]} ${names[p!.type]} ${p!.square.toUpperCase()}${!enemy.available(p!.square) ? " · อัลติใช้ไม่ได้แล้ว" : ""}</option>`).join("");
  clearSelection(); updateUI();
  matchPaused = true; stopBot(); scene?.setPaused(true); spaceAudio?.setPaused(true);
  $<HTMLDialogElement>("#ultimate-guide").showModal();
};
$("#ultimate-enemy").onchange = () => {
  const enemy = enemyUltimateBoard(), square = $<HTMLSelectElement>("#ultimate-enemy").value as Square;
  const moves = square && enemy ? enemy.ultimateMoves(square) : [];
  scene?.showUltimateThreats([...new Set(moves.map(m => m.to))]);
  $("#ultimate-enemy-note").textContent = square && enemy ? `${enemy.skill(enemy.get(square)!.type).label} · ${[...new Set(moves.map(m => m.to))].join(" · ").toUpperCase() || "ยังไม่มีทางเดินที่ปลอดภัย"} — แนวที่เดินได้จากตำแหน่งปัจจุบัน; หลังคุณเดินอาจเปลี่ยนไป` : "ยังไม่ใช่การรุกจริง · คู่แข่งต้องใช้สิทธิ์อัลติเพื่อเดินตามแนวนี้";
};
$("#ultimate-guide-close").onclick = () => $<HTMLDialogElement>("#ultimate-guide").close();
$("#ultimate-guide").addEventListener("close", () => {
  scene?.showUltimateThreats([]); matchPaused = false; scene?.setPaused(false); updateUI(); scheduleBot();
});
function previewSquare(square: Square | null) {
  if (!canPlay() || !selected) return;
  if (scene) scene.previewTarget(square);
  else updateTactics(square ? previewMove(game, selected, square) : null);
}
for (const event of ["mouseover", "focusin"]) $("#flat-board").addEventListener(event, e => {
  const square = (e.target as HTMLElement).closest<HTMLElement>("[data-square]")?.dataset.square as Square | undefined;
  previewSquare(square || null);
});
for (const event of ["mouseleave", "focusout"]) $("#flat-board").addEventListener(event, () => previewSquare(null));
$("#flat-board").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-square]",
  );
  if (b) pick(b.dataset.square as Square);
});
function pick(square: Square) {
  if (!canPlay()) {
    if (scene?.animation) notice("ข้ามฉากเพื่อเดินต่อได้");
    else if (game.isGameOver() || localResult) notice("เกมจบแล้ว กดเกมใหม่หรือย้อนตาเพื่อเล่นต่อ");
    else if (mode === "bot") notice("รอบอตเดินก่อน แล้วเลือกหมากของคุณ");
    else notice("รอถึงตาของคุณก่อน");
    return;
  }
  audio?.resume().catch(() => {});
  if (selected) {
    const available = game
      .moves({ square: selected, verbose: true })
      .filter((m) => m.to === square);
    if (available.length) {
      if (game instanceof SpecialChess && game.armed) {
        ultimateTarget = square;
        updateSpecialHUD(); previewSquare(square); return;
      }
      if (available.some((m) => m.promotion)) {
        pending = { from: selected, to: square };
        $<HTMLDialogElement>("#promotion").showModal();
      } else submitMove(selected, square);
      return;
    }
  }
  if (selected === square) {
    clearSelection();
  } else if (game.get(square)?.color === game.turn()) {
    if (game instanceof SpecialChess) game.armed = null;
    ultimateTarget = null;
    selected = square;
    scene?.select(game, square, lastMove);
    soundEngine()?.play(game.get(square)!.type, "lock", 0.08, false, (square.charCodeAt(0) - 100.5) / 5, armyAppearances()[square] || profile.skin);
  } else if (selected) {
    notice(game.isCheck()
      ? "คิงกำลังถูกรุก ต้องหลบ ขวาง หรือกินหมากที่รุก เลือกช่องเรืองแสง"
      : "ช่องนี้เดินไม่ได้: ตรวจรูปเดิน หมากที่ขวาง และความปลอดภัยของคิง เลือกช่องเรืองแสง");
  } else if (game.get(square)) {
    notice("เลือกหมากของฝ่ายที่ถึงตาก่อน");
  }
  updateUI();
}
function soundEngine() {
  // Audio is created only by the explicit sound control, never by bots or timers.
  if (!$<HTMLInputElement>("#sound").checked || !spaceAudio) return;
  return spaceAudio;
}
function enableSound() {
  try {
    const AudioConstructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audio ||= new AudioConstructor();
    void audio.resume();
    spaceAudio ||= new SpaceAudio(audio);
    for (const [bus, value] of Object.entries(audioPreferences.levels)) spaceAudio.setBusVolume(bus as keyof typeof audioPreferences.levels, value);
    spaceAudio.setMuted(audioPreferences.muted);
    spaceAudio.setAmbiencePreset(profile.arena);
    spaceAudio.setPaused(false);
    if (showcaseActive) spaceAudio.setMusicState("menu"); else syncMusic();
    showcase?.refreshAudio();
  } catch { notice("อุปกรณ์นี้เปิดเสียงไม่ได้"); }
}
function soundPan(move: Move) { return (move.to.charCodeAt(0) - 100.5) / 5; }
function playSound(move: Move, _event: MoveEvent) {
  stopSounds();
  const engine = soundEngine();
  if (!engine) return;
  syncMusic();
  if (move.captured && scene && !scene.reduced) {
    const animation = scene?.animation;
    if (animation) {
      void engine.prepareCombat(move.piece, animation.skin, animation.duration, !!(move as UltimateMove).ultimate);
      if (animation.defenderProfile) void engine.prepareCombat(move.captured, animation.defenderProfile.skin, animation.duration);
    }
    return;
  }
  engine.play(move.piece, "lock", 0.08, !!move.captured, soundPan(move), scene?.animation?.skin || profile.skin);
  if (!scene?.reduced) engine.play(move.piece, "charge",
    (scene?.animation?.duration || 780) * (scene?.animation?.dramatic ? 0.3 : 0.22) / 1000,
    !!move.captured, soundPan(move), scene?.animation?.skin || profile.skin, !!(move as UltimateMove).ultimate);
}
function dashSound(move: Move, _event: MoveEvent) {
  if (move.captured && scene && !scene.reduced) return;
  if (!scene?.reduced) soundEngine()?.play(move.piece, "dash", 0.3, !!move.captured, soundPan(move), scene?.animation?.skin || profile.skin, !!(move as UltimateMove).ultimate);
}
function impactSound(move: Move, event: MoveEvent) {
  if (!move.captured || !scene || scene.reduced) soundEngine()?.play(move.piece, "impact", 0.3, !!move.captured, soundPan(move), scene?.animation?.skin || profile.skin, !!(move as UltimateMove).ultimate);
  if (["check", "double-check", "discovered-check"].includes(event.kind)) {
    const king = kingSquare(game, game.turn());
    soundEngine()?.play("k", "check", 0.3, false, soundPan(move), king ? armyAppearances()[king] || profile.skin : profile.skin);
  }
  if (!["move", "capture", "check"].includes(event.kind)) soundEngine()?.playEvent(event.kind, soundPan(move));
  else if (event.story && $<HTMLInputElement>("#battle-events").checked) soundEngine()?.playEvent(event.story, soundPan(move));
}
function deathSound(move: Move, _event: MoveEvent) {
  if (move.captured && scene && !scene.reduced) return;
  if (move.captured) soundEngine()?.play(move.captured, "death", 0.4, true, soundPan(move), scene?.animation?.defenderProfile?.skin || profile.skin);
}
function attackEvent(before: Chess, after: Chess, move: Move, skin?: SkinId) {
  const event = analyzeMove(before, after, move);
  if ((move as UltimateMove).ultimate) {
    event.title = (game instanceof SpecialChess ? game.skill(move.piece,move.color) : { name: "ULTIMATE", label: "อัลติ" }).name;
    event.subtitle = `${(game instanceof SpecialChess ? game.skill(move.piece,move.color) : { name: "ULTIMATE", label: "อัลติ" }).label} · ${event.kind === "mate" ? "รุกฆาต" : event.kind.includes("check") ? "รุกคิง" : "ULTIMATE RELEASE"}`;
  } else if ((move as Move & { chaos?: boolean }).chaos) {
    event.title = "WIND BREAK"; event.subtitle = "เปลี่ยนแนวเดิน · พลิกแผนด้วยลมสนาม";
  } else if (event.kind === "capture") {
    const theme = skin || armyAppearances(game.history({ verbose: true }).slice(0, -1))[move.from] || profile.skin;
    event.title = skillNames[theme][move.piece];
    event.subtitle = `${avatarNames[theme][move.piece]} · ${skins[theme].rarity}`;
  }
  return event;
}
function animate(before: Chess, move: Move) {
  clearTimeout(noticeTimer);
  $("#notice").textContent = "";
  clearTimeout(eventTimer);
  eventTimer = setTimeout(() => $("#event").classList.remove("visible"), 1600);
  lastMove = { from: move.from, to: move.to };
  clearSelection();
  const ev = attackEvent(before, game, move);
  const moment = latestMoment(story().moments, game.history().length);
  if ($<HTMLInputElement>("#battle-events").checked && moment) {
    clearBattleToast();
    $("#battle-toast strong").textContent = moment.title;
    $("#battle-toast span").textContent = moment.description;
    $("#battle-toast").classList.add("visible");
    $("#stage").dataset.battleMoment = moment.kind;
    battleTimer = setTimeout(clearBattleToast, 2200);
    ev.story = moment.kind;
    if (["recapture", "queen-fallen", "comeback", "capture-streak"].includes(moment.kind) &&
      !["mate", "check", "double-check", "discovered-check", "rescue", "promotion"].includes(ev.kind)) {
      ev.title = moment.title;
      ev.subtitle = moment.description;
    }
  }
  $("#event strong").textContent = ev.title;
  $("#event span").textContent = ev.subtitle;
  $("#event").classList.toggle("visible", !!ev.title);
  scene?.setAppearances(armyAppearances(game.history({ verbose: true }).slice(0, -1)), armyAppearances());
  scene?.play(before, game, move, ev);
  $("#stage").classList.toggle("cinematic", !!scene?.animation?.dramatic);
  playSound(move, ev);
  updateUI();
  if (!scene) { impactSound(move, ev); deathSound(move, ev); finishAnimation(); }
  else scheduleBot();
}
function finishAnimation() {
  if (showcaseActive) { showcase?.setPlaying(false); soundEngine()?.setMusicState("menu"); return; }
  if (armoryAudition) { armoryAudition = false; restorePreview(); return; }
  if (visualReplay) { visualReplay = false; renderGameBoard(); }
  clearTimeout(eventTimer);
  $("#event").classList.remove("visible");
  $("#stage").classList.remove("cinematic");
  scene?.select(game, null, lastMove);
  updateUI();
  // Let finish/reset/settings handlers complete before starting another animation.
  queueMicrotask(scheduleBot);
}
if (scene) {
  scene.onPick = pick;
  scene.onPreview = updateTactics;
  scene.onFinish = finishAnimation;
  scene.onImpact = impactSound;
  scene.onDeath = deathSound;
  scene.onDash = dashSound;
  scene.onCancel = stopSounds;
  scene.onAnticipation=()=>soundEngine()?.anticipateImpact();
  scene.onCombatCue = (move, _event, cue, actor, skin) => {
    const piece = actor === "defender" ? move.captured || move.piece : move.piece;
    const speed = (scene!.animation?.duration || 2600) / 2600;
    soundEngine()?.playCombatCue(piece, skin, cue, (cue === "charge" ? .53 : cue === "finisher" ? .33 : .3) * speed,
      actor === "defender" ? -soundPan(move) : soundPan(move), !!(move as UltimateMove).ultimate);
  };
}
function submitMove(from: Square, to: Square, promotion: PieceSymbol = "q") {
  if (!canPlay()) return;
  if (mode === "online") {
    send({ type: "move", from, to, promotion, revision: state?.revision });
    clearSelection();
    return;
  }
  commitMove(from, to, promotion);
}
function commitMove(from: Square, to: Square, promotion: PieceSymbol = "q", ultimate = false, portal = false) {
  const before = game instanceof VariantChess || game instanceof SpecialChess ? game.clone() : new Chess(game.fen());
  let move;
  try {
    move = game.move({ from, to, promotion, ...(ultimate ? { ultimate: true } : {}), ...(portal ? { portal:true } : {}) });
  } catch {
    notice("เดินผิดกติกา");
    return;
  }
  saveLocal();
  animate(before, move);
}
function applyBotReply() {
  if (!botReply || scene?.animation) return;
  const reply = botReply;
  botReply = undefined;
  if (mode === "bot" && game.turn() !== humanColor && game.fen() === reply.fen)
    commitMove(reply.move.from, reply.move.to, reply.move.promotion, reply.move.ultimate, reply.move.portal);
}
function scheduleBot() {
  if (menuOpen || matchPaused || mode !== "bot" || game.turn() === humanColor || game.isGameOver() || localResult) {
    stopBot();
    return;
  }
  const fen = game.fen();
  if (botJobFen === fen) {
    applyBotReply();
    return;
  }
  stopBot();
  botJobFen = fen;
  // Think during the player's animation; apply only after the board is ready.
  botTimer = setTimeout(() => {
    botTimer = undefined;
    const taskWorker = new BotWorker();
    worker = taskWorker;
    taskWorker.onmessage = (e) => {
      if (worker !== taskWorker || botJobFen !== fen) return;
      taskWorker.terminate();
      worker = undefined;
      if (mode === "bot" && game.fen() === fen && e.data) {
        botReply = { fen, move: e.data };
        applyBotReply();
      }
      updateUI();
    };
    taskWorker.onerror = () => {
      if (worker !== taskWorker) return;
      stopBot();
      notice("บอตคิดไม่สำเร็จ ลองปรับระดับหรือเริ่มใหม่");
      updateUI();
    };
    taskWorker.postMessage({ fen, variant: game instanceof VariantChess ? { id: game.id, options: game.options, snapshot: game.snapshot() } : undefined, special: game instanceof SpecialChess ? game.snapshot() : undefined, depth: activeTrial ? 2 : Number($<HTMLSelectElement>("#difficulty").value) });
  }, 80);
}
function saveLocal() {
  if (mode !== "online") {
    storage.set(
      saveKey,
      JSON.stringify({ mode, specialDuel, specialConfig, activeVariant, activeContract, humanColor, initialFen, history: game.history(), matchId, activeTraining, activeTrial, activeDaily, matchReward }),
    );
    hasSavedLocalGame = true;
  }
}
function newLocal() {
  if (activeVariant) { startVariantBoard(); return; }
  const nextId = newMatchId(); if (!reserveContract(nextId)) return;
  matchId = nextId;
  activeTraining = null;
  activeTrial = null; activeDaily = null;
  resetPresentation();
  matchReward = null;
  clearBattleToast();
  scene?.resetPacing();
  clearTimeout(noticeTimer);
  $("#notice").textContent = "";
  initialFen = new Chess().fen();
  $<HTMLSelectElement>("#training-select").value = "";
  $("#training-hint").textContent = "";
  stopBot();
  scene?.cancel();
  if (specialDuel && specialConfig.formation !== "standard") initialFen = variantInitialFen(specialConfig.formation === "skirmish" ? "mirror" : "draft", { seed: specialConfig.seed });
  game = specialDuel ? new SpecialChess(initialFen, undefined, specialConfig) : new Chess();
  localResult = null;
  lastMove = undefined;
  clearSelection();
  renderGameBoard();
  $("#event").classList.remove("visible");
  $("#stage").classList.remove("cinematic");
  scene?.resetView((mode === "bot" || (specialDuel || !!activeVariant) && mode === "local") && humanColor === "b");
  saveLocal();
  updateUI();
  scheduleBot();
}
function disconnect() {
  if (OFFLINE) return;
  clearTimeout(reconnectTimer);
  const socket = ws;
  ws = undefined;
  if (socket) {
    socket.onclose = null;
    socket.close();
  }
  session = null;
  state = null;
  requestPending = false;
  storage.remove("special-chess-session");
}
function setMode(next: Mode) {
  if (OFFLINE && next === "online") return;
  if (mode === next && !specialDuel && !activeVariant) return;
  specialDuel = false; activeVariant = null; activeContract = null;
  disconnect();
  mode = next;
  matchPaused = !hud.drawer.hidden && next !== "online";
  scene?.setPaused(matchPaused);
  newLocal();
  if (!OFFLINE && next === "online") { connect(); hud.open("room"); }
}
function send(data: unknown) {
  if (ws?.readyState !== WebSocket.OPEN) {
    notice("ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    return false;
  }
  ws.send(JSON.stringify(data));
  return true;
}
function connect() {
  if (OFFLINE) return;
  if (mode !== "online") return;
  clearTimeout(reconnectTimer);
  if (ws) {
    ws.onclose = null;
    ws.close();
  }
  const socket = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
  );
  ws = socket;
  socket.onopen = () => {
    requestPending = false;
    if (session)
      send({ type: "resume", code: session.code, token: session.token });
    updateUI();
  };
  socket.onmessage = (e) => {
    if (ws !== socket) return;
    try {
      const m = JSON.parse(e.data);
      if (m.type === "error") {
        requestPending = false;
        notice(m.message);
        if (
          m.message.includes("กลับเข้าห้อง") ||
          m.message.includes("ไม่พบห้อง")
        ) {
          session = null;
          state = null;
          storage.remove("special-chess-session");
        }
        updateUI();
        return;
      }
      if (m.type === "session") {
        session = { code: m.code, color: m.color, token: m.token };
        storage.set("special-chess-session", JSON.stringify(session));
        requestPending = false;
        scene?.resetView(m.color === "b");
        updateUI();
        return;
      }
      if (m.type === "state") receiveState(m);
      if (m.type === "left") {
        disconnect();
        setMode("local");
      }
    } catch {
      notice("รับข้อมูลจากเซิร์ฟเวอร์ไม่สำเร็จ");
    }
  };
  socket.onclose = (e) => {
    if (ws !== socket || mode !== "online") return;
    requestPending = false;
    updateUI();
    if (e.code === 4001) {
      disconnect();
      notice("ห้องนี้เปิดจากหน้าต่างอื่นแล้ว");
      updateUI();
      return;
    }
    reconnectTimer = setTimeout(connect, 2000);
  };
  socket.onerror = () =>
    notice("เชื่อมต่อออนไลน์ไม่ได้ ตรวจว่าเซิร์ฟเวอร์กำลังทำงาน");
  updateUI();
}
function receiveState(next: State) {
  const changed = !state || next.revision !== state.revision;
  const presenceChanged = !state || next.started !== state.started ||
    next.connected.w !== state.connected.w || next.connected.b !== state.connected.b;
  state = next;
  serverStamp = Date.now();
  if (changed) {
    initialFen = new Chess().fen();
    activeTraining = null; activeVariant = null; activeContract = null; specialDuel = false;
    activeTrial = null; activeDaily = null;
    resetPresentation();
    matchReward = null;
    stopBot();
    scene?.cancel();
    clearSelection();
    const rebuilt = new Chess();
    for (const m of next.history) rebuilt.move(m);
    game = rebuilt;
    localResult = null;
    if (next.latest) {
      const before = new Chess(next.latest.before);
      const move = before.move({
        from: next.latest.from,
        to: next.latest.to,
        promotion: next.latest.promotion || "q",
      });
      const beforeGame = new Chess(next.latest.before);
      animate(beforeGame, move);
    } else {
      lastMove = undefined;
      renderGameBoard();
      $("#event").classList.remove("visible");
      $("#stage").classList.remove("cinematic");
    }
  }
  // Clock snapshots should not rebuild/focus the accessible board every second.
  if (changed || presenceChanged) updateUI();
  else updateClocks();
}
function updateClocks() {
  for (const color of ["w", "b"] as const) {
    let ms = state?.clocks[color] || 0;
    if (
      mode === "online" &&
      state?.started &&
      !state.result &&
      game.turn() === color &&
      ws?.readyState === 1
    )
      ms = Math.max(0, ms - (Date.now() - serverStamp));
    $(`#${color === "w" ? "white" : "black"}-clock`).textContent =
      mode === "online" && state
        ? `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`
        : "—";
  }
}
if (!OFFLINE) setInterval(updateClocks, 200);
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-mode]"))
  b.onclick = () => setMode(b.dataset.mode as Mode);
$("#reset").onclick = () => {
  hud.close();
  if (activeTrial) { launchTrial(activeTrial, activeDaily); return; }
  if (OFFLINE && activeTraining) mode = "bot";
  newLocal();
};
$("#undo").onclick = () => {
  if (mode === "online") return;
  if (activeContract && profile.economy.claimed.includes(`contract:${activeContract.id}`)) { notice("สัญญานี้รับเงินแล้ว · เริ่มรอบใหม่เพื่อเล่นต่อ"); return; }
  resetPresentation();
  clearBattleToast();
  scene?.resetPacing();
  stopBot();
  scene?.cancel();
  const wasHumanTurn = game.turn() === humanColor;
  game.undo();
  if (mode === "bot" && wasHumanTurn && game.history().length) game.undo();
  localResult = null;
  lastMove = undefined;
  clearSelection();
  renderGameBoard();
  $("#event").classList.remove("visible");
  $("#stage").classList.remove("cinematic");
  saveLocal();
  updateUI();
  scheduleBot();
};
$("#view").onclick = () => {
  scene?.finish();
  scene?.resetView(scene.flipped);
};
$("#flip").onclick = () => {
  scene?.finish();
  scene?.resetView(!scene.flipped);
  updateFlatBoard();
  updateSpecialHUD();
};
$("#skip").onclick = () => scene?.skip();
$("#promotion")
  .querySelectorAll<HTMLButtonElement>("[data-piece]")
  .forEach(
    (b) =>
      (b.onclick = () => {
        const p = pending;
        pending = null;
        $<HTMLDialogElement>("#promotion").close();
        if (p) submitMove(p.from, p.to, b.dataset.piece as PieceSymbol);
      }),
  );
$("#promotion").addEventListener("cancel", () => {
  pending = null;
});
$("#cancel-promotion").onclick = () => {
  pending = null;
  $<HTMLDialogElement>("#promotion").close();
};
$("#create").onclick = () => {
  if (!requestPending && send({ type: "create", cosmetics: { skin: profile.skin, loadout: profile.loadouts.w } })) requestPending = true;
};
$("#join-form").onsubmit = (e) => {
  e.preventDefault();
  const code = $<HTMLInputElement>("#room-code").value.trim().toUpperCase();
  if (
    /^[A-F0-9]{6}$/.test(code) &&
    !requestPending &&
    send({ type: "join", code, cosmetics: { skin: profile.skin, loadout: profile.loadouts.b } })
  )
    requestPending = true;
};
$("#leave").onclick = () => {
  if (state?.started && !state.result) send({ type: "resign" });
  send({ type: "leave" });
  disconnect();
  mode = "local";
  newLocal();
};
$("#resign").onclick = () => send({ type: "resign" });
$("#copy").onclick = async () => {
  if (!session) return;
  const url = new URL(location.href);
  url.searchParams.set("room", session.code);
  try {
    await navigator.clipboard.writeText(url.href);
    notice("คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย");
  } catch {
    notice(`รหัสห้อง: ${session.code}`);
  }
};
$("#help").onclick = () => $<HTMLDialogElement>("#help-dialog").showModal();
$("#close-help").onclick = () => $<HTMLDialogElement>("#help-dialog").close();
$("#training-select").onchange = () => {
  const key = $<HTMLSelectElement>("#training-select")
    .value as keyof typeof training;
  const t = training[key];
  if (!t) return;
  clearBattleToast();
  scene?.resetPacing();
  if (mode !== "local") setMode("local");
  stopBot();
  specialDuel = false; activeVariant = null; activeContract = null; game = new Chess(t.fen);
  initialFen = t.fen;
  activeTraining = key;
  activeTrial = null; activeDaily = null;
  resetPresentation();
  matchReward = null;
  localResult = null;
  lastMove = undefined;
  clearSelection();
  renderGameBoard();
  $("#event").classList.remove("visible");
  $("#stage").classList.remove("cinematic");
  $<HTMLSelectElement>("#training-select").value = key;
  $("#training-hint").textContent = t.hint;
  scene?.resetView(false);
  saveLocal();
  updateUI();
  notice(t.hint);
};
$("#export").onclick = () => {
  const blob = new Blob([game.pgn()], { type: "application/x-chess-pgn" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "special-chess.pgn";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$<HTMLInputElement>("#reduced").checked = scene?.reduced || false;
for (const key of ["cinematic", "reduced", "sound", "battle-events"]) {
  const input = $<HTMLInputElement>("#" + key);
  const saved = storage.get("special-chess-" + key);
  if (saved !== null) input.checked = saved === "true";
  if (key === "sound") input.checked = false;
  input.onchange = () => {
    storage.set("special-chess-" + key, String(input.checked));
    if (scene && (key === "cinematic" || key === "reduced")) {
      scene.finish();
      scene.cinematic = $<HTMLInputElement>("#cinematic").checked;
      scene.reduced = $<HTMLInputElement>("#reduced").checked;
    }
    if (key === "battle-events") {
      clearBattleToast();
      updateBattleUI();
    }
    if (key === "reduced") { renderGameBoard(); scene?.select(game, selected, lastMove); }
    if (key === "sound") hud.syncSound();
    if (key === "sound" && !input.checked) { spaceAudio?.cancel(); showcase?.refreshAudio(); }
    if (key === "sound" && input.checked) enableSound();
  };
}
if (scene) {
  scene.cinematic = $<HTMLInputElement>("#cinematic").checked;
  scene.reduced = $<HTMLInputElement>("#reduced").checked;
}
try {
  const saved = JSON.parse(storage.get(saveKey) || "null");
  if (
    saved &&
    ["local", "bot"].includes(saved.mode) &&
    Array.isArray(saved.history)
  ) {
    activeVariant = readModeSession(saved.activeVariant);
    specialDuel = !activeVariant && saved.specialDuel === true;
    specialConfig = readSpecialConfig(saved.specialConfig);
    game = activeVariant && activeVariant.id !== "rush" ? createVariant(activeVariant.id, activeVariant.options, saved.initialFen)
      : specialDuel ? new SpecialChess(saved.initialFen || new Chess().fen(), undefined, specialConfig) : new Chess(saved.initialFen || new Chess().fen());
    initialFen = game.fen();
    for (const m of saved.history) game.move(m);
    mode = saved.mode;
    humanColor = saved.humanColor === "b" ? "b" : "w";
    if (typeof saved.matchId === "string" && saved.matchId.length <= 100) matchId = saved.matchId;
    if (saved.activeContract && isEconomicMode(saved.activeContract.mode) && typeof saved.activeContract.id === "string" && saved.activeContract.id.length <= 100 && profile.economy.claimed.includes(`entry:${saved.activeContract.mode}:${saved.activeContract.id}`)) {
      const base = economicDefinition(saved.activeContract.mode)!.base;
      if ((base === "bot" && mode === "bot" && !activeVariant && initialFen === new Chess().fen()) || (base !== "bot" && activeVariant?.id === base && (base === "rush" || mode === "bot"))) activeContract = { id: saved.activeContract.id, mode: saved.activeContract.mode };
    }
    const scenario = Object.entries(training).find(([, value]) => value.fen === initialFen)?.[0];
    activeTraining = !activeVariant ? (scenario as keyof typeof training) || null : null;
    if (activeTraining) {
      $<HTMLSelectElement>("#training-select").value = activeTraining;
      $("#training-hint").textContent = training[activeTraining].hint;
    }
    if (!activeVariant && typeof saved.activeTrial === "string" && Object.hasOwn(trials, saved.activeTrial)) {
      const key = saved.activeTrial as keyof typeof trials;
      const daily = validDailyDay(saved.activeDaily) ? dailyChallenge(saved.activeDaily) : null;
      const trial = daily?.trial || trials[key];
      if (trial.fen === initialFen && (saved.activeDaily == null || daily) && (!daily || daily.base === key)) { activeTrial = key; activeDaily = daily?.day || null; activeTraining = null; humanColor = trial.side; }
    }
    if (saved.matchReward && typeof saved.matchReward.message === "string" && Number.isSafeInteger(saved.matchReward.amount)) matchReward = saved.matchReward;
    hasSavedLocalGame = true;
  }
} catch {
  specialDuel = false; activeVariant = null; activeContract = null; game = new Chess();
  initialFen = game.fen(); activeTraining = null; activeTrial = null; activeDaily = null;
}
const invite = OFFLINE
  ? null
  : new URLSearchParams(location.search).get("room");
if (!OFFLINE)
  try {
    const saved = JSON.parse(storage.get("special-chess-session") || "null");
    if (
      saved &&
      /^[A-F0-9]{6}$/.test(saved.code) &&
      typeof saved.token === "string" &&
      (!invite || invite === saved.code)
    ) {
      session = saved;
      mode = "online";
    }
  } catch {}
if (invite) {
  mode = "online";
  $<HTMLInputElement>("#room-code").value = invite.toUpperCase();
}
if (OFFLINE) {
  document.body.classList.add("offline-edition");
  $(".brand small").textContent = "OFFLINE BOT EDITION";
  $(".match-head p").textContent = "เล่นได้โดยไม่ใช้อินเทอร์เน็ต · บอต 3 ระดับ";
  $(".tabs").hidden = true;
  $('[data-hud-open="room"]').hidden = true;
  $("#connection").textContent = "OFFLINE";
  $("#help-dialog").querySelectorAll("p")[3].remove();
}
const savedDifficulty = storage.get(difficultyKey);
if (savedDifficulty && ["1", "2", "3"].includes(savedDifficulty))
  $<HTMLSelectElement>("#difficulty").value = savedDifficulty;
$<HTMLSelectElement>("#difficulty").onchange = () => {
  storage.set(difficultyKey, $<HTMLSelectElement>("#difficulty").value);
  if (mode === "bot") { scene?.finish(); renderGameBoard(); }
  if (mode === "bot" && game.turn() !== humanColor) {
    stopBot();
    scheduleBot();
  }
  updateUI();
};
$<HTMLSelectElement>("#human-side").onchange = () => {
  if (activeContract) { $<HTMLSelectElement>("#human-side").value = humanColor; notice("เลือกฝ่ายก่อนเปิดสัญญาใหม่ · สัญญาปัจจุบันใช้ฝ่ายเดิม"); return; }
  humanColor = $<HTMLSelectElement>("#human-side").value === "b" ? "b" : "w";
  newLocal();
};
hud.syncSound();
const volumeInput = $<HTMLInputElement>("#sound-volume");
const savedVolume = Number(storage.get("special-chess-sound-volume") ?? 35);
volumeInput.value = String(Number.isFinite(savedVolume) ? Math.max(0, Math.min(100, savedVolume)) : 35);
volumeInput.oninput = () => {
  spaceAudio?.setVolume(Number(volumeInput.value) / 100);
  storage.set("special-chess-sound-volume", volumeInput.value);
  audioPreferences.levels.master = Number(volumeInput.value) / 100; saveAudioMix();
};
audioPreferences.levels.master = Number(volumeInput.value) / 100;
volumeInput.closest("label")!.firstChild!.textContent = "ระดับเสียงรวม";
volumeInput.setAttribute("aria-label", "ระดับเสียงรวม");
installAudioControls($(".settings"), audioPreferences, (bus, value) => {
  if (bus === "mute") { audioPreferences.muted = !!value; spaceAudio?.setMuted(!!value); }
  else { audioPreferences.levels[bus] = Number(value); spaceAudio?.setBusVolume(bus, Number(value)); }
  saveAudioMix();
});
$(".settings").insertAdjacentHTML("beforeend", `<label class="setting-select" for="capture-duration">ความยาวฉากต่อสู้<select id="capture-duration"><option value="2000">กระชับ · 2 วินาที</option><option value="2600">เต็มจังหวะ · 2.6 วินาที</option><option value="3000">ชมท่า · 3 วินาที</option></select></label>`);
const captureDurationInput = $<HTMLSelectElement>("#capture-duration");
captureDurationInput.value = String(clampCaptureDuration(Number(storage.get("special-chess-capture-duration") || 2600)));
if (!captureDurationInput.value) captureDurationInput.value = "2600";
if (scene) scene.captureDuration = Number(captureDurationInput.value);
captureDurationInput.onchange = () => {
  scene?.finish(); if (scene) scene.captureDuration = Number(captureDurationInput.value);
  storage.set("special-chess-capture-duration", captureDurationInput.value);
};
const scopeInput = $<HTMLSelectElement>("#cinematic-scope");
scopeInput.value = storage.get("special-chess-cinematic-scope") === "all" ? "all" : "key";
scopeInput.onchange = () => {
  if (scene) {
    scene.finish();
    scene.cinematicScope = scopeInput.value as CinematicScope;
  }
  storage.set("special-chess-cinematic-scope", scopeInput.value);
};
if (scene) scene.cinematicScope = scopeInput.value as CinematicScope;
const graphicsInput = $<HTMLSelectElement>("#graphics-quality");
const savedGraphics = storage.get("special-chess-graphics-quality");
graphicsInput.value = savedGraphics === "low" || savedGraphics === "high" ? savedGraphics : "auto";
graphicsInput.onchange = () => {
  scene?.setQuality(graphicsInput.value as GraphicsQuality);
  storage.set("special-chess-graphics-quality", graphicsInput.value);
};
scene?.setQuality(graphicsInput.value as GraphicsQuality);
const arenaInput = $<HTMLSelectElement>("#arena-select");
function selectArena(id: ArenaId) {
  scene?.finish();
  profile = { ...profile, arena: id }; saveProfile();
  arenaInput.value = id;
  $("#arena-name").textContent = arenas[id].name;
  scene?.setArena(id);
  spaceAudio?.setAmbiencePreset(id);
}
arenaInput.value = profile.arena;
arenaInput.onchange = () => {
  if (!isArena(arenaInput.value)) return;
  selectArena(arenaInput.value); title.refresh(profile);
};
$("#arena-name").textContent = arenas[profile.arena].name;
scene?.setArena(profile.arena);
scene?.setSkin(profile.skin);
renderGameBoard();
scene?.resetView((mode === "bot" || (specialDuel || !!activeVariant) && mode === "local") && humanColor === "b");
updateUI();
const title = new TitleScreen($("#app"), OFFLINE, {
  economy: changeEconomy,
  showcase: openShowcase,
  settings: (host) => hud.attachSettings(host),
  help: () => $<HTMLDialogElement>("#help-dialog").showModal(),
  selectSkin: (skin) => { selectSkin(skin); title.refresh(profile); },
  selectPiece: (color, origin, skin) => { selectPiece(color, origin, skin); title.refresh(profile); },
  selectArena: (id) => { selectArena(id); title.refresh(profile); },
  preview: previewArmy,
  audition: auditionSkill,
  start: launchGame,
  resume: (skin) => {
    if (profile.skin !== skin) selectSkin(skin);
    enterBoard();
    scene?.setSkin(profile.skin);
    renderGameBoard();
    updateUI();
    if (mode === "online") { connect(); hud.open("room"); } else scheduleBot();
  },
});
presentation = new BattlePresentation($("#stage"), {
  continue: () => {
    resetPresentation();
    if (activeVariant) { advanceVariant(); return; }
    if (mode === "online") { openTitle(); return; }
    if (activeDaily) {
      if (localResult?.winner === humanColor) openTitle();
      else launchTrial(activeTrial!, activeDaily);
      return;
    }
    if (activeTrial) {
      const keys = Object.keys(trials) as (keyof typeof trials)[];
      const next = localResult?.winner === humanColor ? keys[(keys.indexOf(activeTrial) + 1) % keys.length] : activeTrial;
      launchTrial(next);
    } else if (activeTraining) {
      const keys = Object.keys(training) as (keyof typeof training)[];
      $<HTMLSelectElement>("#training-select").value = keys[(keys.indexOf(activeTraining) + 1) % keys.length];
      $("#training-select").dispatchEvent(new Event("change"));
    } else newLocal();
  },
  home: openTitle,
  replay: replayLastCapture,
  rematch: () => {
    if (activeContract && profile.economy.credits < economicDefinition(activeContract.mode)!.entry) { notice("เครดิตไม่พอสำหรับสัญญารอบใหม่"); return; }
    humanColor = humanColor === "w" ? "b" : "w";
    $<HTMLSelectElement>("#human-side").value = humanColor;
    newLocal();
  },
});
const replayButton = document.createElement("button");
replayButton.id = "replay-capture";
replayButton.textContent = "↺ ดูฉากสังหารล่าสุด";
replayButton.onclick = replayLastCapture;
$(".history").prepend(replayButton);
let previewHost: HTMLElement | null = null;
let previewColor: Color = "w";
let previewOrigin: Square | undefined;
function previewArmy(host: HTMLElement | null, color: Color, origin?: Square) {
  clearTimeout(auditionTimer);
  armoryAudition = false;
  stopSounds();
  scene?.cancel();
  previewHost = host; previewColor = color; previewOrigin = origin;
  scene?.setShowcase(host);
  if (host) restorePreview();
}
function restorePreview() {
  if (!previewHost) return;
  const army = new Chess();
  scene?.setSkin(profile.skin);
  scene?.setAppearances(appearanceMap(army.fen(), [], profile));
  scene?.renderBoard(army);
  scene?.resetView(previewColor === "b");
  scene?.showcasePiece(previewOrigin || null);
}
function openShowcase() {
  if (!menuOpen || !scene) return;
  clearTimeout(auditionTimer); armoryAudition = false;
  scene.cancel(); stopSounds();
  showcaseActive = true;
  showcase ||= new CombatShowcase($("#app"), {
    play: playShowcase,
    stop: () => {
      scene?.skip(); stopSounds();
      if (showcase?.root.dataset.panel === "audio") spaceAudio?.cancel();
      showcase?.setPlaying(false);
    },
    close: closeShowcase,
    enableSound: () => {
      const input = $<HTMLInputElement>("#sound"); input.checked = true; input.dispatchEvent(new Event("change"));
    },
    soundEnabled: () => !!soundEngine(),
    sound: ({ piece, skin, cue }) => {
      const engine = soundEngine(); if (!engine) return;
      engine.cancelCinematic();
      if (["draw", "charge", "release", "clash", "counter", "finisher", "impact", "armor", "disintegrate"].includes(cue))
        engine.auditionCombatCue(piece, skin, cue as CombatCue, 0);
      else engine.auditionPiece(piece, skin, cue as SoundPhase, 0);
    },
    music: state => soundEngine()?.setMusicState(state),
    event: event => soundEngine()?.playEvent(event),
  });
  title.root.hidden = true;
  showcase.show(); scene.setShowcase(showcase.previewHost); scene.showcasePiece(null);
  showcaseSettings = showcase.selection;
  renderShowcase(showcaseSettings);
  soundEngine()?.setMusicState("menu");
}
function showcaseBoards(settings: ShowcaseSettings) {
  // A presentation fixture; these boards are never assigned to the active game.
  // The king preview may fall visually, while real chess always ends by mate.
  const before = new Chess(); before.clear();
  before.put({ type: settings.attacker, color: "w" }, "c4");
  before.put({ type: settings.defender, color: "b" }, "e5");
  const after = new Chess(); after.clear(); after.put({ type: settings.attacker, color: "w" }, "e5");
  return { before, after };
}
function renderShowcase(settings: ShowcaseSettings) {
  if (!scene) return;
  const { before } = showcaseBoards(settings);
  scene.setArena(settings.arena);
  soundEngine()?.setAmbiencePreset(settings.arena);
  scene.setAppearances({ c4: settings.attackerSkin, e5: settings.defenderSkin });
  scene.renderBoard(before); scene.resetView(false);
}
function playShowcase(settings: ShowcaseSettings) {
  if (!scene || !showcaseActive) return;
  scene.cancel(); stopSounds(); showcaseSettings = settings;
  const { before, after } = showcaseBoards(settings);
  // Reuse a real Move's methods/shape, changing only this disposable visual fixture.
  const sample = new Chess(training.knight.fen).move({ from: training.knight.from, to: training.knight.to });
  const move = { ...sample, from: "c4", to: "e5", piece: settings.attacker, captured: settings.defender,
    before: before.fen(), after: after.fen(), flags: "c", san: `${settings.attacker.toUpperCase()}xe5` } as Move;
  const event: MoveEvent = { kind: "capture", title: skillNames[settings.attackerSkin][settings.attacker],
    subtitle: "COMBAT SHOWCASE", capturedSquare: "e5", checkers: [], targets: [] };
  scene.setArena(settings.arena); scene.setAppearances({ c4: settings.attackerSkin, e5: settings.defenderSkin }, { e5: settings.attackerSkin });
  soundEngine()?.setAmbiencePreset(settings.arena);
  scene.resetPacing(); scene.play(before, after, move, event); showcase?.setPlaying(true);
  soundEngine()?.setMusicState("capture");
  playSound(move, event);
}
function closeShowcase() {
  if (!showcaseActive) return;
  scene?.cancel(); stopSounds(); showcase?.hide(); showcaseActive = false;
  title.root.hidden = false;
  scene?.setShowcase(previewHost || null); scene?.setArena(profile.arena);
  soundEngine()?.setAmbiencePreset(profile.arena);
  if (previewHost) restorePreview(); else renderGameBoard();
  syncMusic(); document.querySelector<HTMLButtonElement>("#open-showcase")?.focus();
}
function auditionSkill(piece: PieceSymbol, skin: SkinId) {
  if (!scene || !previewHost || !isSkinUnlocked(profile, skin)) return;
  clearTimeout(auditionTimer);
  scene.cancel();
  const key = ({ p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" } as const)[piece];
  const sample = training[key];
  const before = new Chess(sample.fen), after = new Chess(sample.fen);
  const move = after.move({ from: sample.from, to: sample.to });
  const event = attackEvent(before, after, move, skin);
  scene.setAppearances({ [move.from]: skin }, { [move.to]: skin });
  scene.resetPacing(); scene.showcasePiece(null);
  armoryAudition = true;
  // The explicit audition gesture also unlocks browser audio.
  const sound = $<HTMLInputElement>("#sound");
  sound.checked = true; sound.dispatchEvent(new Event("change"));
  scene.play(before, after, move, event);
  playSound(move, event);
  auditionTimer = setTimeout(() => {
    if (armoryAudition) scene?.finish();
  }, (scene.animation?.duration || 1400) + 100);
}
function replayLastCapture() {
  if (menuOpen || isBusy() || mode === "online" && !state?.result) return;
  const history = game.history({ verbose: true });
  let index = history.length - 1;
  while (index >= 0 && !history[index].captured) index--;
  if (index < 0) { notice("ยังไม่มีฉากสังหารในศึกนี้"); return; }
  const move = history[index];
  const after = game instanceof VariantChess && activeVariant ? createVariant(activeVariant.id, activeVariant.options, initialFen) : game instanceof SpecialChess ? new SpecialChess(initialFen, undefined, specialConfig) : new Chess(move.before);
  if (after instanceof SpecialChess || after instanceof VariantChess) for (const prior of history.slice(0, index)) after.move(prior);
  const before = after instanceof VariantChess ? after.clone() : new Chess(after.fen());
  const replayMove = after.move(move);
  presentation?.clear();
  resultPresentationKey = "";
  visualReplay = true;
  scene?.setAppearances(armyAppearances(history.slice(0, index)), armyAppearances(history.slice(0, index + 1)));
  const event = attackEvent(before, after, replayMove, armyAppearances(history.slice(0, index))[move.from]);
  scene?.play(before, after, replayMove, event);
  playSound(replayMove, event);
  if (!scene) { visualReplay = false; updateUI(); }
}
function launchTrial(key: keyof typeof trials, day: string | null = null) {
  const daily = day ? dailyChallenge(day) : null;
  const trial = daily?.trial || trials[key];
  resetPresentation(); stopBot(); scene?.cancel(); clearBattleToast();
  matchId = newMatchId(); matchReward = null; activeTraining = null; activeTrial = key; activeDaily = day;
  specialDuel = false; activeVariant = null; activeContract = null; game = new Chess(trial.fen); initialFen = trial.fen; mode = "bot"; humanColor = trial.side;
  $<HTMLSelectElement>("#difficulty").value = "2";
  localResult = null; lastMove = undefined; clearSelection();
  renderGameBoard(); scene?.resetView(humanColor === "b");
  $("#training-hint").textContent = trial.hint;
  saveLocal(); updateUI(); notice(trial.hint);
  presentation?.showIntro({ opponent: trial.name, title: trial.story, player: "กองทัพของคุณ" });
  soundEngine()?.playEvent("intro"); scheduleBot();
}
function enterBoard() {
  menuOpen = false;
  matchPaused = false;
  document.body.classList.add("arena-playing");
  hud.close();
  title.hide();
  $("#game-shell").hidden = false;
  scene?.setPaused(false);
  scrollTo(0, 0);
}
function launchGame(settings: LaunchSettings) {
  const contract = economicDefinition(settings.mode);
  if (contract && profile.economy.credits < contract.entry) { notice("เครดิตไม่พอ · รับเสบียงหรือเล่นโหมดฟรีเพื่อสะสมเครดิต"); return; }
  activeContract = contract ? { mode: contract.id, id: "pending" } : null;
  if (profile.skin !== settings.skin) selectSkin(settings.skin);
  stopBot();
  disconnect();
  humanColor = settings.side;
  $<HTMLSelectElement>("#difficulty").value = settings.depth;
  storage.set(difficultyKey, settings.depth);
  scene?.setSkin(profile.skin);
  specialDuel = settings.mode === "special";
  specialConfig = readSpecialConfig(settings.special);
  const variantId = modeDefinitions.find(definition => definition.id === (contract?.base || settings.mode))?.id;
  activeVariant = variantId ? newModeSession(variantId, settings.variant || { seed: Date.now() >>> 0 }, humanColor) : null;
  mode = contract ? contract.base === "rush" ? "local" : "bot" : variantId ? variantId === "rush" ? "local" : settings.opponent || "bot" : settings.mode === "special" ? settings.opponent || "bot" : settings.mode === "training" ? "local" : (settings.mode === "campaign" || settings.mode === "daily") ? "bot" : settings.mode as Mode;
  enterBoard();
  if (settings.mode === "daily") {
    const daily = dailyChallenge(settings.day || utcDay()); launchTrial(daily.base, daily.day); return;
  }
  if (settings.mode === "campaign") { launchTrial((settings.trial || "rescue") as keyof typeof trials); return; }
  newLocal();
  if (settings.mode === "training") {
    $("#training-panel").setAttribute("open", "");
    $<HTMLSelectElement>("#training-select").value = settings.training;
    $("#training-select").dispatchEvent(new Event("change"));
  }
  if (mode === "online") { connect(); hud.open("room"); }
  else if (mode === "bot") {
    const rival = rivals[Number(settings.depth) as 1 | 2 | 3] || rivals[2];
    presentation?.showIntro({ opponent: rival.name, title: rival.title, player: "กองทัพของคุณ" });
    soundEngine()?.playEvent("intro");
  }
}
function openTitle() {
  if (mode === "online" && state?.started && !state.result) {
    notice("แมตช์ออนไลน์กำลังแข่งอยู่ จบเกมหรือยอมแพ้ก่อนกลับหน้าหลัก");
    return;
  }
  scene?.finish();
  resetPresentation();
  stopBot();
  stopSounds();
  clearSelection();
  clearBattleToast();
  menuOpen = true;
  matchPaused = false;
  clearTimeout(eventTimer);
  document.body.classList.remove("arena-playing");
  hud.close();
  scene?.setPaused(true);
  $("#game-shell").hidden = true;
  title.show(profile, {
    view: "menu",
    mode: activeContract?.mode || activeVariant?.id || (mode === "online" && !OFFLINE ? "online" : specialDuel ? "special" : activeDaily ? "daily" : activeTrial ? "campaign" : activeTraining ? "training" : mode),
    special: specialConfig, variant: activeVariant?.options, opponent: mode === "local" ? "local" : "bot",
    side: humanColor,
    depth: $<HTMLSelectElement>("#difficulty").value,
    resume: mode === "online" ? !!session : hasSavedLocalGame,
    training: activeTraining || "pawn",
    trial: activeTrial || "rescue",
  });
  syncMusic();
  scrollTo(0, 0);
}
$("#title-return").onclick = openTitle;
hud.onPauseChange = (paused) => {
  if (menuOpen) return;
  matchPaused = paused && mode !== "online";
  if (matchPaused) { stopBot(); stopSounds(); scene?.setPaused(true); }
  else { scene?.setPaused(false); scheduleBot(); }
  updateUI();
};
document.addEventListener("visibilitychange", () => {
  spaceAudio?.setPaused(document.hidden || matchPaused);
  if (document.hidden) { stopBot(); scene?.setPaused(true, true); }
  else { scene?.setPaused(menuOpen || matchPaused); if (!showcaseActive) syncMusic(); scheduleBot(); }
});
title.show(profile, { special: specialConfig, variant: activeVariant?.options, opponent: mode === "local" ? "local" : "bot", mode: activeContract?.mode || activeVariant?.id || (mode === "online" && !OFFLINE ? "online" : specialDuel ? "special" : activeDaily ? "daily" : activeTrial ? "campaign" : activeTraining ? "training" : hasSavedLocalGame ? mode : "bot"), side: humanColor, depth: $<HTMLSelectElement>("#difficulty").value, resume: mode === "online" ? !!session : hasSavedLocalGame, training: activeTraining || "pawn", trial: activeTrial || "rescue" });

installDesign();
player = installPlayer({ offline: OFFLINE,
  onIdentity: () => { if (!menuOpen) updateUI(); },
  getProgression: () => profile,
  applyProgression: (raw) => { profile = readProfile(JSON.stringify(raw)); saveProfile(); title.refresh(profile); updateUI(); },
});
setInterval(() => {
  const now = performance.now(), elapsed = Math.max(0, now - rushStamp);
  rushStamp = now;
  if (!activeVariant || activeVariant.id !== "rush" || menuOpen || matchPaused || document.hidden || localResult || visualReplay) return;
  activeVariant.rushRemaining = Math.max(0, activeVariant.rushRemaining - elapsed);
  if (activeVariant.rushRemaining <= 0) { clearSelection(); updateUI(); }
  else updateVariantHUD();
  saveLocal();
}, 250);
document.addEventListener("visibilitychange", () => { rushStamp = performance.now(); });
