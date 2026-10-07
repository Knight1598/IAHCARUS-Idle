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
import { SpaceAudio } from "./sound";
import { ArenaHUD } from "./hud";
import { readProfile, claimXP, matchXP, levelProgress, skins, isSkinUnlocked, type SkinId } from "./profile";
import { matchStory, latestMoment } from "./battle";
import { matchMaterial, type CinematicScope } from "./gameplay";
import BotWorker from "./bot.ts?worker&inline";
const OFFLINE = __OFFLINE__;
const saveKey = OFFLINE ? "special-chess-offline-game" : "special-chess-local";
const difficultyKey = OFFLINE
  ? "special-chess-offline-difficulty"
  : "special-chess-difficulty";
import { training } from "./training";
import { analyzeMove, type MoveEvent } from "../shared/events.js";

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
  revision: number;
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
  `<div id="game-shell" hidden><header><a class="brand" href="#"><span class="brand-mark">♞</span><span>SPECIAL CHESS<small>PROCEDURAL 3D ARENA</small></span></a><div class="header-actions"><button id="title-return">หน้าหลัก</button><span id="player-level" class="tag">Lv.1</span><span class="tag">PURE CODE</span><button id="help" class="icon" aria-label="วิธีเล่น">?</button></div></header><div class="layout"><main id="stage" aria-label="กระดานหมากรุกสามมิติ"><div class="arena-top"><span id="mode-tag">LOCAL DUEL</span><span id="connection"></span></div><div id="event" aria-live="polite"><strong></strong><span></span></div><div id="battle-toast" role="status"><small>ARENA EVENT</small><strong></strong><span></span></div><div id="cinema-top" class="cinema-bar"></div><div id="cinema-bottom" class="cinema-bar"></div><div class="arena-bottom"><span id="hint">เลือกหมากเพื่อเริ่มการประลอง</span><div><button id="view" class="icon" title="กลับมุมกล้อง" aria-label="กลับมุมกล้อง">◎</button><button id="flip" class="icon" title="สลับมุม" aria-label="สลับมุม">↻</button><button id="skip">ข้ามฉาก</button></div></div></main><aside><section class="match-head"><small>THE ROYAL DUEL</small><h1>ศึกหมากราชัน</h1><p>หมากรุกคลาสสิก · ทุกตาคือฉากต่อสู้</p></section><div class="player" id="black-player"><span class="avatar black">♚</span><div><strong>ฝ่ายดำ</strong><small id="black-label">ผู้เล่น 2</small></div><span class="clock" id="black-clock">—</span></div><div id="status" role="status"></div><div class="player" id="white-player"><span class="avatar white">♔</span><div><strong>ฝ่ายขาว</strong><small id="white-label">ผู้เล่น 1</small></div><span class="clock" id="white-clock">—</span></div><div id="result" hidden></div><div id="xp-reward" role="status" hidden></div><div class="tabs" role="group" aria-label="โหมดเกม"><button data-mode="bot">เล่นกับบอต</button><button data-mode="local" class="active">สองคน</button><button data-mode="online">ออนไลน์</button></div><section id="online-panel" hidden><p class="muted">ห้องส่วนตัว · ฝ่ายละ 5 นาที</p><div class="button-row"><button id="create" class="primary">สร้างห้อง</button><button id="leave" hidden>ออกจากห้อง</button></div><form id="join-form"><input id="room-code" aria-label="รหัสห้อง" placeholder="รหัสห้อง 6 ตัว" maxlength="6" autocomplete="off" pattern="[A-Fa-f0-9]{6}" required><button id="join" type="submit">เข้าร่วม</button></form><div id="room-info" hidden><span>รหัสห้อง <strong id="code"></strong></span><button id="copy">คัดลอกลิงก์</button></div></section><div class="button-row" id="local-actions"><button id="reset" class="primary">เกมใหม่</button><button id="undo">ย้อนตา</button><select id="difficulty" aria-label="ระดับบอต" hidden><option value="1">ง่าย</option><option value="2" selected>ปานกลาง</option><option value="3">ยาก</option></select></div><label id="side-control" hidden>ฝ่ายของคุณ<select id="human-side" aria-label="ฝ่ายของคุณ"><option value="w">ฝ่ายขาว · เดินก่อน</option><option value="b">ฝ่ายดำ · เดินทีหลัง</option></select><small>เปลี่ยนฝ่ายจะเริ่มเกมใหม่</small></label><section class="material-panel" aria-label="หมากที่กินและคะแนนกำลัง"><div><span>ขาวกิน</span><span id="white-captured">—</span><strong id="white-material"></strong></div><div><span>ดำกิน</span><span id="black-captured">—</span><strong id="black-material"></strong></div></section><section id="missions" class="missions"><div class="section-title"><h2 id="mission-title">ภารกิจในแมตช์</h2><strong id="mission-stars">☆ ☆ ☆</strong></div><p class="muted">เป้าหมายเสริม · เก็บดาวระหว่างการประลอง</p><div id="mission-list"></div></section><details id="battle-log-panel"><summary>อีเวนท์ในแมตช์</summary><div id="battle-log"></div></details><button id="resign" hidden>ยอมแพ้</button><div id="notice" role="status"></div><section class="settings"><label class="setting-select" for="graphics-quality">กราฟิก<select id="graphics-quality"><option value="auto">อัตโนมัติ · ปรับตามความลื่น</option><option value="low">ลื่นที่สุด · ลดเงาและความละเอียด</option><option value="high">ภาพคมชัด</option></select></label><label><input type="checkbox" id="battle-events" checked> อีเวนท์และภารกิจระหว่างเล่น</label><label><input type="checkbox" id="cinematic" checked> คัตซีนและกล้องพิเศษ</label><label class="setting-select" for="cinematic-scope">จังหวะคัตซีน<select id="cinematic-scope"><option value="key">เฉพาะจังหวะสำคัญ</option><option value="all">ทุกท่าสเปเชียล</option></select></label><label><input type="checkbox" id="reduced"> ลดเอฟเฟกต์</label><label><input type="checkbox" id="sound"> เสียงอวกาศ · ไซไฟอนิเมะ</label><label class="setting-select" for="sound-volume">ระดับเสียงเอฟเฟกต์<input id="sound-volume" type="range" min="0" max="100" value="35" aria-label="ระดับเสียงเอฟเฟกต์"></label></section><details id="board-details"><summary>กระดาน 2D / เล่นด้วยคีย์บอร์ด</summary><div id="flat-board" role="group" aria-label="กระดานหมากรุกสองมิติ"></div></details><details id="training-panel"><summary>สนามฝึกท่าสเปเชียล</summary><select id="training-select" aria-label="เลือกท่าฝึก"><option value="">เลือกฉากเพื่อทดลอง</option>${Object.entries(
    training,
  )
    .map(([key, t]) => `<option value="${key}">${t.name}</option>`)
    .join(
      "",
    )}</select><p id="training-hint" class="muted"></p></details><section class="history"><div class="section-title"><h2>บันทึกการประลอง</h2><button id="export" class="text-button">PGN ↓</button></div><div id="moves"></div></section><footer>โมเดล แสง และพลังทั้งหมดสร้างจากโค้ด<br>ไม่มีการเปลี่ยนความสามารถของหมาก</footer></aside></div></div><dialog id="promotion"><small>ASCENSION</small><h2>เลือกหมากเพื่อเลื่อนขั้น</h2><div class="promotion-options">${(["q", "r", "b", "n"] as const).map((p) => `<button data-piece="${p}"><span>${symbols.w[p]}</span>${names[p]}</button>`).join("")}</div><button id="cancel-promotion" class="text-button">ยกเลิก</button></dialog><dialog id="help-dialog"><small>HOW TO PLAY</small><h2>ทุกตาคือการตัดสินใจ</h2><p>เลือกหมากของฝ่ายที่ถึงตา แล้วเลือกช่องเรืองแสงเพื่อเดิน สีชมพูคือช่องกินหมาก</p><p>ลากเพื่อหมุนกระดาน เลื่อนเพื่อซูม หรือใช้กระดาน 2D ด้วยคีย์บอร์ด</p><p>กติกาหมากรุกมาตรฐาน: คิงจะไม่ถูกกิน เกมจบเมื่อรุกฆาต ท่าสเปเชียลเป็นภาพประกอบการเดิน และข้ามได้เสมอ</p><p>ออนไลน์: สร้างห้องแล้วส่งลิงก์ให้เพื่อน ฝ่ายละ 5 นาที เวลาเดินตามเซิร์ฟเวอร์ รวมเวลาคัตซีน หากรีเฟรชจะกลับเข้าห้องจากเบราว์เซอร์เดิม</p><p>เล่นกับบอต: เลือกเล่นขาวหรือดำได้ เปลี่ยนฝ่ายจะเริ่มเกมใหม่ ย้อนตาจะกลับไปก่อนตาของคุณ ปรับระดับได้ก่อนตาถัดไป</p><button id="close-help" class="primary">เข้าใจแล้ว</button></dialog>`;
const hud = new ArenaHUD();
let menuOpen = true;
let eventTimer: ReturnType<typeof setTimeout> | undefined;
function newMatchId() { return globalThis.crypto?.randomUUID?.() || `match-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
let matchId = newMatchId();
let hasSavedLocalGame = false;
let activeTraining: keyof typeof training | null = null;
let matchReward: { amount: number; message: string } | null = null;
let humanColor: Color = "w";
let initialFen = new Chess().fen();
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
  | { fen: string; move: { from: Square; to: Square; promotion?: PieceSymbol } }
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
function stopSounds() { spaceAudio?.cancel(); }
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
let profile = readProfile(storage.get("special-chess-profile"));
function saveProfile() { storage.set("special-chess-profile", JSON.stringify(profile)); }
function selectSkin(skin: SkinId) {
  if (!isSkinUnlocked(profile, skin)) return;
  profile = { ...profile, skin };
  saveProfile();
}
function grantReward(id: string, amount: number, win = false, match = false) {
  const reward = claimXP(profile, id, amount, win, match);
  if (!reward.added) return;
  profile = reward.profile;
  saveProfile();
  matchReward = { amount, message: `+${amount} XP · เลเวล ${levelProgress(profile.xp).level}${reward.unlocked.length ? " · ปลดล็อก " + reward.unlocked.map((skin) => skins[skin].name).join(", ") : ""}` };
  if (mode !== "online") saveLocal();
}
function checkRewards() {
  let rewardVisible = false;
  const stars = (color: Color) => Object.values(story().missions[color]).filter(Boolean).length;
  if (activeTraining) {
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
  $("#promotion").hasAttribute("open") &&
    $<HTMLDialogElement>("#promotion").close();
  scene?.select(game, null, lastMove);
}
function isBusy() {
  return !!scene?.animation || !!worker;
}
function canPlay() {
  if (menuOpen || isBusy() || game.isGameOver() || localResult) return false;
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
  $("#status").textContent = result
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
        : "ผู้เล่น 1";
  $("#black-label").textContent =
    mode === "online"
      ? (session?.color === "b" ? "คุณ" : "คู่แข่ง") +
        (state?.connected.b ? " · เชื่อมต่อ" : " · ยังไม่เชื่อมต่อ")
      : mode === "bot"
        ? humanColor === "b"
          ? "คุณ"
          : "บอต · " + $<HTMLSelectElement>("#difficulty").selectedOptions[0].textContent
        : "ผู้เล่น 2";
  $("#connection").textContent =
    mode === "online"
      ? ws?.readyState === 1
        ? "● เชื่อมต่อแล้ว"
        : "○ กำลังเชื่อมต่อ"
      : "OFFLINE READY";
  $("#mode-tag").textContent =
    mode === "bot"
      ? "SOLO CHALLENGE"
      : mode === "online"
        ? "ONLINE DUEL"
        : "LOCAL DUEL";
  $("#hint").textContent = selected
    ? `${names[game.get(selected)!.type]} · ${selected.toUpperCase()} — เลือกช่องปลายทาง`
    : mode === "online" && !state?.started
      ? "ส่งรหัสห้องให้เพื่อนเพื่อเริ่ม"
      : "แตะหมาก · ลากหมุน · เลื่อนซูม";
  $("#training-panel").hidden = mode === "online";
  $("#online-panel").hidden = mode !== "online";
  $("#local-actions").hidden = mode === "online";
  $("#resign").hidden = mode !== "online" || !state?.started || !!state.result;
  $("#difficulty").hidden = mode !== "bot";
  $("#side-control").hidden = mode !== "bot";
  $<HTMLSelectElement>("#human-side").value = humanColor;
  $<HTMLButtonElement>("#undo").disabled =
    mode === "bot"
      ? !game.history({ verbose: true }).some((move) => move.color === humanColor)
      : !game.history().length;
  const { captured, balance } = matchMaterial(game);
  for (const color of ["w", "b"] as const) {
    const label = color === "w" ? "white" : "black";
    const enemy = color === "w" ? "b" : "w";
    $(`#${label}-captured`).textContent = captured[color].map((piece) => symbols[enemy][piece]).join(" ") || "—";
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
  updateClocks();
}
function updateBattleUI() {
  const enabled = $<HTMLInputElement>("#battle-events").checked;
  $("#missions").hidden = !enabled;
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
  $("#battle-log").innerHTML = data.moments.length ? data.moments.slice(-8).reverse().map((moment) =>
    `<div data-battle-kind="${moment.kind}"><strong>${moment.title}</strong><small>${moment.description}</small></div>`).join("")
    : '<p class="muted">อีเวนท์จะเกิดตามจังหวะของการต่อสู้</p>';
}
function updateFlatBoard() {
  const focused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement.dataset.square
      : undefined;
  const legal = selected
    ? game.moves({ square: selected, verbose: true }).map((m) => m.to)
    : [];
  const flipped = scene?.flipped ?? (mode === "bot" && humanColor === "b");
  const order = flipped
    ? [1, 2, 3, 4, 5, 6, 7, 8]
    : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = flipped ? "hgfedcba" : "abcdefgh";
  let html = "";
  for (const rank of order)
    for (const file of files) {
      const s = (file + rank) as Square,
        p = game.get(s);
      html += `<button data-square="${s}" class="square ${(file.charCodeAt(0) + rank) % 2 ? "dark" : "light"} ${selected === s ? "selected" : ""} ${legal.includes(s) ? "legal" : ""} ${p?.color === "w" ? "white-piece" : "black-piece"}" aria-label="${s}${p ? " " + (p.color === "w" ? "ขาว" : "ดำ") + " " + names[p.type] : ""}${legal.includes(s) ? " เดินได้" : ""}"><span>${p ? symbols[p.color][p.type] : ""}</span><small>${s}</small></button>`;
    }
  $("#flat-board").innerHTML = html;
  if (focused)
    document
      .querySelector<HTMLButtonElement>(`[data-square="${focused}"]`)
      ?.focus({ preventScroll: true });
}
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
    selected = square;
    scene?.select(game, square, lastMove);
    soundEngine()?.play(game.get(square)!.type, "lock", 0.08, false, (square.charCodeAt(0) - 100.5) / 5);
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
  if (!$<HTMLInputElement>("#sound").checked) return;
  try {
    audio ||= new AudioContext();
    void audio.resume();
    spaceAudio ||= new SpaceAudio(audio);
    spaceAudio.setVolume(Number($<HTMLInputElement>("#sound-volume").value) / 100);
    return spaceAudio;
  } catch { return undefined; }
}
function soundPan(move: Move) { return (move.to.charCodeAt(0) - 100.5) / 5; }
function playSound(move: Move, _event: MoveEvent) {
  stopSounds();
  const engine = soundEngine();
  if (!engine) return;
  engine.play(move.piece, "lock", 0.08, !!move.captured, soundPan(move));
  if (!scene?.reduced) engine.play(move.piece, "charge",
    (scene?.animation?.duration || 780) * (scene?.animation?.dramatic ? 0.3 : 0.22) / 1000,
    !!move.captured, soundPan(move));
}
function dashSound(move: Move, _event: MoveEvent) {
  if (!scene?.reduced) soundEngine()?.play(move.piece, "dash", 0.3, !!move.captured, soundPan(move));
}
function impactSound(move: Move, _event: MoveEvent) {
  soundEngine()?.play(move.piece, "impact", 0.3, !!move.captured, soundPan(move));
}
function animate(before: Chess, move: Move) {
  clearTimeout(noticeTimer);
  $("#notice").textContent = "";
  clearTimeout(eventTimer);
  eventTimer = setTimeout(() => $("#event").classList.remove("visible"), 1600);
  lastMove = { from: move.from, to: move.to };
  clearSelection();
  const ev = analyzeMove(before, game, move);
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
  scene?.play(before, game, move, ev);
  $("#stage").classList.toggle("cinematic", !!scene?.animation?.dramatic);
  playSound(move, ev);
  updateUI();
  if (!scene) finishAnimation();
  else scheduleBot();
}
function finishAnimation() {
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
  scene.onFinish = finishAnimation;
  scene.onImpact = impactSound;
  scene.onDash = dashSound;
  scene.onCancel = stopSounds;
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
function commitMove(from: Square, to: Square, promotion: PieceSymbol = "q") {
  const before = new Chess(game.fen());
  let move;
  try {
    move = game.move({ from, to, promotion });
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
    commitMove(reply.move.from, reply.move.to, reply.move.promotion);
}
function scheduleBot() {
  if (menuOpen || mode !== "bot" || game.turn() === humanColor || game.isGameOver() || localResult) {
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
    taskWorker.postMessage({ fen, depth: Number($<HTMLSelectElement>("#difficulty").value) });
  }, 80);
}
function saveLocal() {
  if (mode !== "online") {
    storage.set(
      saveKey,
      JSON.stringify({ mode, humanColor, initialFen, history: game.history(), matchId, activeTraining, matchReward }),
    );
    hasSavedLocalGame = true;
  }
}
function newLocal() {
  matchId = newMatchId();
  activeTraining = null;
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
  game = new Chess();
  localResult = null;
  lastMove = undefined;
  clearSelection();
  scene?.renderBoard(game);
  $("#event").classList.remove("visible");
  $("#stage").classList.remove("cinematic");
  scene?.resetView(mode === "bot" && humanColor === "b");
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
  if (mode === next) return;
  disconnect();
  mode = next;
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
    activeTraining = null;
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
      scene?.renderBoard(game);
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
  if (OFFLINE && activeTraining) mode = "bot";
  newLocal();
};
$("#undo").onclick = () => {
  if (mode === "online") return;
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
  scene?.renderBoard(game);
  $("#event").classList.remove("visible");
  $("#stage").classList.remove("cinematic");
  saveLocal();
  updateUI();
  scheduleBot();
};
$("#view").onclick = () => {
  scene?.finish();
  scene?.resetView();
};
$("#flip").onclick = () => {
  scene?.finish();
  scene?.resetView(!scene.flipped);
  updateFlatBoard();
};
$("#skip").onclick = () => scene?.finish();
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
  if (!requestPending && send({ type: "create" })) requestPending = true;
};
$("#join-form").onsubmit = (e) => {
  e.preventDefault();
  const code = $<HTMLInputElement>("#room-code").value.trim().toUpperCase();
  if (
    /^[A-F0-9]{6}$/.test(code) &&
    !requestPending &&
    send({ type: "join", code })
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
  game = new Chess(t.fen);
  initialFen = t.fen;
  activeTraining = key;
  matchReward = null;
  localResult = null;
  lastMove = undefined;
  clearSelection();
  scene?.renderBoard(game);
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
    if (key === "reduced") { scene?.renderBoard(game); scene?.select(game, selected, lastMove); }
    if (key === "sound") hud.syncSound();
    if (key === "sound" && !input.checked) stopSounds();
    if (key === "sound" && input.checked) {
      try {
        audio ||= new AudioContext();
        void audio.resume();
      } catch {
        notice("อุปกรณ์นี้เปิดเสียงไม่ได้");
      }
    }
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
    game = new Chess(saved.initialFen || new Chess().fen());
    initialFen = game.fen();
    for (const m of saved.history) game.move(m);
    mode = saved.mode;
    humanColor = saved.humanColor === "b" ? "b" : "w";
    if (typeof saved.matchId === "string" && saved.matchId.length <= 100) matchId = saved.matchId;
    const scenario = Object.entries(training).find(([, value]) => value.fen === initialFen)?.[0];
    activeTraining = (scenario as keyof typeof training) || null;
    if (activeTraining) {
      $<HTMLSelectElement>("#training-select").value = activeTraining;
      $("#training-hint").textContent = training[activeTraining].hint;
    }
    if (saved.matchReward && typeof saved.matchReward.message === "string" && Number.isSafeInteger(saved.matchReward.amount)) matchReward = saved.matchReward;
    hasSavedLocalGame = true;
  }
} catch {
  game = new Chess();
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
  if (mode === "bot" && game.turn() !== humanColor) {
    stopBot();
    scheduleBot();
  }
  updateUI();
};
$<HTMLSelectElement>("#human-side").onchange = () => {
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
scene?.setSkin(profile.skin);
scene?.renderBoard(game);
scene?.resetView(mode === "bot" && humanColor === "b");
updateUI();
const title = new TitleScreen($("#app"), OFFLINE, {
  selectSkin,
  start: launchGame,
  resume: (skin) => {
    selectSkin(skin);
    enterBoard();
    scene?.setSkin(profile.skin);
    scene?.renderBoard(game);
    updateUI();
    if (mode === "online") { connect(); hud.open("room"); } else scheduleBot();
  },
});
function enterBoard() {
  menuOpen = false;
  document.body.classList.add("arena-playing");
  hud.close();
  title.root.hidden = true;
  $("#game-shell").hidden = false;
  scene?.setPaused(false);
  scrollTo(0, 0);
}
function launchGame(settings: LaunchSettings) {
  selectSkin(settings.skin);
  stopBot();
  disconnect();
  humanColor = settings.side;
  $<HTMLSelectElement>("#difficulty").value = settings.depth;
  storage.set(difficultyKey, settings.depth);
  scene?.setSkin(profile.skin);
  mode = settings.mode === "training" ? "local" : settings.mode;
  enterBoard();
  newLocal();
  if (settings.mode === "training") {
    $("#training-panel").setAttribute("open", "");
    $<HTMLSelectElement>("#training-select").value = settings.training;
    $("#training-select").dispatchEvent(new Event("change"));
  }
  if (mode === "online") { connect(); hud.open("room"); }
}
function openTitle() {
  if (mode === "online" && state?.started && !state.result) {
    notice("แมตช์ออนไลน์กำลังแข่งอยู่ จบเกมหรือยอมแพ้ก่อนกลับหน้าหลัก");
    return;
  }
  scene?.finish();
  stopBot();
  stopSounds();
  clearSelection();
  clearBattleToast();
  menuOpen = true;
  clearTimeout(eventTimer);
  document.body.classList.remove("arena-playing");
  hud.close();
  scene?.setPaused(true);
  $("#game-shell").hidden = true;
  title.show(profile, {
    mode: mode === "online" && !OFFLINE ? "online" : activeTraining ? "training" : mode,
    side: humanColor,
    depth: $<HTMLSelectElement>("#difficulty").value,
    resume: mode === "online" ? !!session : hasSavedLocalGame,
    training: activeTraining || "pawn",
  });
  title.root.querySelector<HTMLButtonElement>("#launch-start")?.focus({ preventScroll: true });
  scrollTo(0, 0);
}
$("#title-return").onclick = openTitle;
title.show(profile, { mode: mode === "online" && !OFFLINE ? "online" : activeTraining ? "training" : hasSavedLocalGame ? mode : "bot", side: humanColor, depth: $<HTMLSelectElement>("#difficulty").value, resume: mode === "online" ? !!session : hasSavedLocalGame, training: activeTraining || "pawn" });
