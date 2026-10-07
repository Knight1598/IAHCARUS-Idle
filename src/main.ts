import "./style.css";
import { Chess, type Square, type PieceSymbol, type Move } from "chess.js";
import { ChessScene } from "./scene";
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
  `<header><a class="brand" href="#"><span class="brand-mark">♞</span><span>SPECIAL CHESS<small>PROCEDURAL 3D ARENA</small></span></a><div class="header-actions"><span class="tag">PURE CODE</span><button id="help" class="icon" aria-label="วิธีเล่น">?</button></div></header><div class="layout"><main id="stage" aria-label="กระดานหมากรุกสามมิติ"><div class="arena-top"><span id="mode-tag">LOCAL DUEL</span><span id="connection"></span></div><div id="event" aria-live="polite"><strong></strong><span></span></div><div id="cinema-top" class="cinema-bar"></div><div id="cinema-bottom" class="cinema-bar"></div><div class="arena-bottom"><span id="hint">เลือกหมากเพื่อเริ่มการประลอง</span><div><button id="view" class="icon" title="กลับมุมกล้อง" aria-label="กลับมุมกล้อง">◎</button><button id="flip" class="icon" title="สลับมุม" aria-label="สลับมุม">↻</button><button id="skip">ข้ามฉาก</button></div></div></main><aside><section class="match-head"><small>THE ROYAL DUEL</small><h1>ศึกหมากราชัน</h1><p>หมากรุกคลาสสิก · ทุกตาคือฉากต่อสู้</p></section><div class="player" id="black-player"><span class="avatar black">♚</span><div><strong>ฝ่ายดำ</strong><small id="black-label">ผู้เล่น 2</small></div><span class="clock" id="black-clock">—</span></div><div id="status" role="status"></div><div class="player" id="white-player"><span class="avatar white">♔</span><div><strong>ฝ่ายขาว</strong><small id="white-label">ผู้เล่น 1</small></div><span class="clock" id="white-clock">—</span></div><div id="result" hidden></div><div class="tabs" role="group" aria-label="โหมดเกม"><button data-mode="bot">เล่นกับบอต</button><button data-mode="local" class="active">สองคน</button><button data-mode="online">ออนไลน์</button></div><section id="online-panel" hidden><p class="muted">ห้องส่วนตัว · ฝ่ายละ 5 นาที</p><div class="button-row"><button id="create" class="primary">สร้างห้อง</button><button id="leave" hidden>ออกจากห้อง</button></div><form id="join-form"><input id="room-code" aria-label="รหัสห้อง" placeholder="รหัสห้อง 6 ตัว" maxlength="6" autocomplete="off" pattern="[A-Fa-f0-9]{6}" required><button id="join" type="submit">เข้าร่วม</button></form><div id="room-info" hidden><span>รหัสห้อง <strong id="code"></strong></span><button id="copy">คัดลอกลิงก์</button></div></section><div class="button-row" id="local-actions"><button id="reset" class="primary">เกมใหม่</button><button id="undo">ย้อนตา</button><select id="difficulty" aria-label="ระดับบอต" hidden><option value="1">ง่าย</option><option value="2" selected>ปานกลาง</option><option value="3">ยาก</option></select></div><button id="resign" hidden>ยอมแพ้</button><div id="notice" role="status"></div><section class="settings"><label><input type="checkbox" id="cinematic" checked> คัตซีนและกล้องพิเศษ</label><label><input type="checkbox" id="reduced"> ลดเอฟเฟกต์</label><label><input type="checkbox" id="sound"> เสียงสังเคราะห์</label></section><details id="board-details"><summary>กระดาน 2D / เล่นด้วยคีย์บอร์ด</summary><div id="flat-board" role="group" aria-label="กระดานหมากรุกสองมิติ"></div></details><details id="training-panel"><summary>สนามฝึกท่าสเปเชียล</summary><select id="training-select" aria-label="เลือกท่าฝึก"><option value="">เลือกฉากเพื่อทดลอง</option>${Object.entries(
    training,
  )
    .map(([key, t]) => `<option value="${key}">${t.name}</option>`)
    .join(
      "",
    )}</select><p id="training-hint" class="muted"></p></details><section class="history"><div class="section-title"><h2>บันทึกการประลอง</h2><button id="export" class="text-button">PGN ↓</button></div><div id="moves"></div></section><footer>โมเดล แสง และพลังทั้งหมดสร้างจากโค้ด<br>ไม่มีการเปลี่ยนความสามารถของหมาก</footer></aside></div><dialog id="promotion"><small>ASCENSION</small><h2>เลือกหมากเพื่อเลื่อนขั้น</h2><div class="promotion-options">${(["q", "r", "b", "n"] as const).map((p) => `<button data-piece="${p}"><span>${symbols.w[p]}</span>${names[p]}</button>`).join("")}</div><button id="cancel-promotion" class="text-button">ยกเลิก</button></dialog><dialog id="help-dialog"><small>HOW TO PLAY</small><h2>ทุกตาคือการตัดสินใจ</h2><p>เลือกหมากของฝ่ายที่ถึงตา แล้วเลือกช่องเรืองแสงเพื่อเดิน สีชมพูคือช่องกินหมาก</p><p>ลากเพื่อหมุนกระดาน เลื่อนเพื่อซูม หรือใช้กระดาน 2D ด้วยคีย์บอร์ด</p><p>กติกาหมากรุกมาตรฐาน: คิงจะไม่ถูกกิน เกมจบเมื่อรุกฆาต ท่าสเปเชียลเป็นภาพประกอบการเดิน และข้ามได้เสมอ</p><p>ออนไลน์: สร้างห้องแล้วส่งลิงก์ให้เพื่อน ฝ่ายละ 5 นาที เวลาเดินตามเซิร์ฟเวอร์ รวมเวลาคัตซีน หากรีเฟรชจะกลับเข้าห้องจากเบราว์เซอร์เดิม</p><p>เล่นกับบอต: คุณเป็นฝ่ายขาว บอตเป็นฝ่ายดำ ปรับระดับได้ก่อนตาถัดไป</p><button id="close-help" class="primary">เข้าใจแล้ว</button></dialog>`;
let initialFen = new Chess().fen();
let game = new Chess(),
  mode: Mode = OFFLINE ? "bot" : "local",
  selected: Square | null = null,
  pending: { from: Square; to: Square } | null = null,
  lastMove: { from: Square; to: Square } | undefined;
let scene: ChessScene | undefined;
try {
  scene = new ChessScene($("#stage"));
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
let noticeTimer: ReturnType<typeof setTimeout>;
let ws: WebSocket | undefined,
  state: State | null = null,
  session: { code: string; color: "w" | "b"; token: string } | null = null,
  reconnectTimer: ReturnType<typeof setTimeout> | undefined,
  serverStamp = Date.now(),
  requestPending = false;
let audio: AudioContext | undefined;
const activeSounds = new Set<AudioScheduledSourceNode>();
function stopSounds() {
  for (const source of activeSounds) {
    try {
      source.stop();
    } catch {}
  }
  activeSounds.clear();
}
function trackSound(source: AudioScheduledSourceNode) {
  activeSounds.add(source);
  source.onended = () => activeSounds.delete(source);
}
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
function notice(message: string) {
  $("#notice").textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => ($("#notice").textContent = ""), 6000);
}
function stopBot() {
  clearTimeout(botTimer);
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
  if (isBusy() || game.isGameOver() || localResult) return false;
  if (mode === "bot" && game.turn() === "b") return false;
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
          : `ตาฝ่าย${turn === "w" ? "ขาว" : "ดำ"}${game.isCheck() ? " · รุก!" : ""}${mode === "bot" && turn === "b" ? " · กำลังคิด" : ""}`;
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
        ? "คุณ"
        : "ผู้เล่น 1";
  $("#black-label").textContent =
    mode === "online"
      ? (session?.color === "b" ? "คุณ" : "คู่แข่ง") +
        (state?.connected.b ? " · เชื่อมต่อ" : " · ยังไม่เชื่อมต่อ")
      : mode === "bot"
        ? "บอต · " +
          $<HTMLSelectElement>("#difficulty").selectedOptions[0].textContent
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
  updateFlatBoard();
  updateClocks();
}
function updateFlatBoard() {
  const focused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement.dataset.square
      : undefined;
  const legal = selected
    ? game.moves({ square: selected, verbose: true }).map((m) => m.to)
    : [];
  const order = scene?.flipped
    ? [1, 2, 3, 4, 5, 6, 7, 8]
    : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = scene?.flipped ? "hgfedcba" : "abcdefgh";
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
  if (game.get(square)?.color === game.turn()) {
    selected = square;
    scene?.select(game, square, lastMove);
  } else {
    selected = null;
    scene?.select(game, null, lastMove);
  }
  updateUI();
}
function playSound(move: Move, event: MoveEvent) {
  stopSounds();
  if (!$<HTMLInputElement>("#sound").checked) return;
  try {
    audio ||= new AudioContext();
    void audio.resume();
    const now = audio.currentTime;
    if (scene?.cinematic && !scene.reduced && event.kind !== "move") {
      const charge = audio.createOscillator(),
        gain = audio.createGain();
      charge.type = "triangle";
      charge.frequency.setValueAtTime(70, now);
      charge.frequency.exponentialRampToValueAtTime(720, now + 0.75);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.83);
      charge.connect(gain).connect(audio.destination);
      trackSound(charge);
      charge.start(now);
      charge.stop(now + 0.85);
      return;
    }
    for (let i = 0; i < (event.kind === "move" ? 1 : 3); i++) {
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.type = move.piece === "r" ? "sawtooth" : "sine";
      const base = move.captured ? 100 : 260;
      o.frequency.setValueAtTime(base + i * 140, now + i * 0.09);
      o.frequency.exponentialRampToValueAtTime(50, now + i * 0.09 + 0.3);
      g.gain.setValueAtTime(0, now + i * 0.09);
      g.gain.linearRampToValueAtTime(0.06, now + i * 0.09 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.3);
      o.connect(g).connect(audio.destination);
      trackSound(o);
      o.start(now + i * 0.09);
      o.stop(now + i * 0.09 + 0.31);
    }
  } catch {}
}
function impactSound(move: Move, event: MoveEvent) {
  if (!move.captured && event.kind === "move") return;
  if (!$<HTMLInputElement>("#sound").checked || !audio || scene?.reduced)
    return;
  try {
    const now = audio.currentTime;
    const low = audio.createOscillator(),
      gain = audio.createGain();
    low.frequency.setValueAtTime(135, now);
    low.frequency.exponentialRampToValueAtTime(32, now + 0.38);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    low.connect(gain).connect(audio.destination);
    trackSound(low);
    low.start(now);
    low.stop(now + 0.46);
    const buffer = audio.createBuffer(
        1,
        Math.floor(audio.sampleRate * 0.18),
        audio.sampleRate,
      ),
      samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++)
      samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
    const noise = audio.createBufferSource(),
      volume = audio.createGain(),
      filter = audio.createBiquadFilter();
    noise.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = 1600;
    volume.gain.value = 0.055;
    noise.connect(filter).connect(volume).connect(audio.destination);
    trackSound(noise);
    noise.start(now);
  } catch {}
}
function animate(before: Chess, move: Move) {
  lastMove = { from: move.from, to: move.to };
  clearSelection();
  const ev = analyzeMove(before, game, move);
  $("#event strong").textContent = ev.title;
  $("#event span").textContent = ev.subtitle;
  $("#event").classList.toggle("visible", !!ev.title);
  $("#stage").classList.toggle(
    "cinematic",
    !!ev.title && !!scene?.cinematic && !scene.reduced,
  );
  scene?.play(before, game, move, ev);
  playSound(move, ev);
  updateUI();
  if (!scene) finishAnimation();
}
function finishAnimation() {
  $("#event").classList.remove("visible");
  $("#stage").classList.remove("cinematic");
  scene?.select(game, null, lastMove);
  updateUI();
  scheduleBot();
}
if (scene) {
  scene.onPick = pick;
  scene.onFinish = finishAnimation;
  scene.onImpact = impactSound;
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
function scheduleBot() {
  stopBot();
  if (mode !== "bot" || game.turn() !== "b" || game.isGameOver() || localResult)
    return;
  botTimer = setTimeout(() => {
    const fen = game.fen();
    worker = new BotWorker();
    worker.onmessage = (e) => {
      worker?.terminate();
      worker = undefined;
      if (mode === "bot" && game.fen() === fen && e.data)
        commitMove(e.data.from, e.data.to, e.data.promotion);
    };
    worker.onerror = () => {
      stopBot();
      notice("บอตคิดไม่สำเร็จ ลองปรับระดับหรือเริ่มใหม่");
    };
    worker.postMessage({
      fen,
      depth: Number($<HTMLSelectElement>("#difficulty").value),
    });
    updateUI();
  }, 250);
}
function saveLocal() {
  if (mode !== "online")
    storage.set(
      saveKey,
      JSON.stringify({ mode, initialFen, history: game.history() }),
    );
}
function newLocal() {
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
  saveLocal();
  updateUI();
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
  if (!OFFLINE && next === "online") connect();
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
  state = next;
  serverStamp = Date.now();
  if (changed) {
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
  updateUI();
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
  if (OFFLINE) mode = "bot";
  newLocal();
};
$("#undo").onclick = () => {
  if (mode === "online") return;
  stopBot();
  scene?.cancel();
  const wasBlack = game.turn() === "b";
  game.undo();
  if (mode === "bot" && !wasBlack && game.history().length) game.undo();
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
  if (mode !== "local") setMode("local");
  stopBot();
  game = new Chess(t.fen);
  initialFen = t.fen;
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
for (const key of ["cinematic", "reduced", "sound"]) {
  const input = $<HTMLInputElement>("#" + key);
  const saved = storage.get("special-chess-" + key);
  if (saved !== null) input.checked = saved === "true";
  input.onchange = () => {
    storage.set("special-chess-" + key, String(input.checked));
    if (scene) {
      scene.finish();
      scene.cinematic = $<HTMLInputElement>("#cinematic").checked;
      scene.reduced = $<HTMLInputElement>("#reduced").checked;
    }
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
  $("#connection").textContent = "OFFLINE";
  $("#help-dialog").querySelectorAll("p")[3].remove();
}
const savedDifficulty = storage.get(difficultyKey);
if (savedDifficulty && ["1", "2", "3"].includes(savedDifficulty))
  $<HTMLSelectElement>("#difficulty").value = savedDifficulty;
$<HTMLSelectElement>("#difficulty").onchange = () => {
  storage.set(difficultyKey, $<HTMLSelectElement>("#difficulty").value);
  if (mode === "bot" && game.turn() === "b") scheduleBot();
  updateUI();
};
scene?.renderBoard(game);
updateUI();
if (!OFFLINE && mode === "online") connect();
else scheduleBot();
