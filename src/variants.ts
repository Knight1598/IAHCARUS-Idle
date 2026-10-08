import { Chess, SQUARES, type Color, type Move, type PieceSymbol, type Square } from "chess.js";

export type VariantId = "draft" | "score" | "control" | "mirror" | "rush" | "chaos";
export type VariantOptions = { seed: number; draft?: PieceSymbol[]; draftColor?: Color; round?: number };
export type VariantMove = Move & { chaos?: boolean };
export type VariantAction = { from: string; to: string; promotion?: string; chaos?: boolean };
export type VariantOutcome = { winner: Color | null; reason: string; label: string };
export const modeDefinitions: { id: VariantId; name: string; label: string; description: string; rules: string[] }[] = [
  { id: "draft", name: "Draft Arena", label: "จัดทัพก่อนดวล", description: "สร้างทีมในงบเท่ากัน แล้ววัดแผนบนกระดาน", rules: ["งบสูงสุด 24 แต้ม · คิง 1 ตัวเสมอ", "คู่แข่งใช้งบเท่าที่คุณใช้ · ไม่มีการเข้าป้อม", "รุกฆาตชนะ · สกินไม่เพิ่มค่าพลัง"] },
  { id: "score", name: "Score Clash", label: "ศึกชิงแต้ม", description: "ฝ่ายละ 12 ตา ใครแลกหมากได้คุ้มกว่าชนะ", rules: ["กินเบี้ย 1 · ม้า/บิชอป 3 · เรือ 5 · ควีน 9", "เล่นฝ่ายละ 12 ตาแล้วตัดสินแต้ม", "รุกฆาตชนะทันที · แต้มเท่ากันเสมอ"] },
  { id: "control", name: "Control Arena", label: "ยึดใจกลาง", description: "ครองพื้นที่กลางกระดานให้ได้ 5 แต้ม", rules: ["จุดยึด d4 · e4 · d5 · e5", "จบทุกรอบครบสองฝ่าย: มีหมากบนจุดยึดได้ 1 แต้ม", "แตะ 5 แต้มชนะ · ทั้งคู่ถึงพร้อมกันเสมอ · รุกฆาตชนะทันที"] },
  { id: "mirror", name: "Mirror Duel", label: "ศึกกระจก", description: "กองทัพเล็กชุดเดียวกัน สองรอบสลับสี", rules: ["ชุดหมากสุ่มด้วยรหัสเดียวกัน · ทั้งสองฝ่ายเหมือนกัน", "เล่นสองรอบบนตำแหน่งเดิมแล้วสลับสี", "ชนะได้ 1 แต้ม · เสมอครึ่งแต้ม · รวมคะแนนสองรอบ"] },
  { id: "rush", name: "Puzzle Rush", label: "แก้โจทย์ต่อเนื่อง", description: "โจทย์รุกฆาตหนึ่งตา แข่งกับเวลาและสถิติ", rules: ["หาตารุกฆาตในหนึ่งตา · ใช้การเดินปกติ", "โจทย์ถูกเรียงด้วยรหัสเดียวกันเพื่อท้าเพื่อน", "เลือกผิดข้ามโจทย์ · เวลาตัดสินรอบรวม"] },
  { id: "chaos", name: "Chaos Arena", label: "กระดานแปรผัน", description: "อ่านพยากรณ์ลมและใช้ทางเดินพิเศษพลิกเกม", rules: ["ทุกรอบครบสองฝ่ายเปลี่ยนเฟส · พยากรณ์ล่วงหน้าหนึ่งรอบ", "ลมม้า: ม้าเดิน/กินทแยง 1 ช่องได้เพิ่ม", "ลมบิชอป: บิชอปเดิน/กินแนวตรง 1 ช่องได้เพิ่ม", "ลมเปลี่ยนการเดินเฉพาะตานั้น · การรุกใช้แนวโจมตีปกติ · ห้ามเปิดคิงให้ถูกโจมตี"] },
];
export const draftBudget = 24;
export const draftCosts: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const defaultDraft: PieceSymbol[] = ["k", "q", "r", "n", "b", "p", "p", "p", "p"];
export const controlSquares: Square[] = ["d4", "e4", "d5", "e5"];
const opponent = (color: Color): Color => color === "w" ? "b" : "w";
const seed32 = (seed: number) => Number.isSafeInteger(seed) ? seed >>> 0 : 1;
function random(seed: number) {
  let state = seed32(seed) ^ 0x9e3779b9;
  state = Math.imul(state ^ state >>> 16, 0x85ebca6b);
  state = Math.imul(state ^ state >>> 13, 0xc2b2ae35);
  state = (state ^ state >>> 16) || 1;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
export function draftCost(roster: PieceSymbol[]) { return roster.reduce((sum, piece) => sum + (draftCosts[piece] ?? 1000), 0); }
export function validateDraft(roster: PieceSymbol[]) {
  const cost = Array.isArray(roster) ? draftCost(roster) : 1000;
  const counts = (piece: PieceSymbol) => roster.filter(p => p === piece).length;
  const error = !Array.isArray(roster) || roster.some(p => !Object.hasOwn(draftCosts, p)) ? "ชนิดหมากไม่ถูกต้อง"
    : counts("k") !== 1 ? "ต้องมีคิงหนึ่งตัว"
      : roster.length < 3 || roster.length > 9 ? "เลือกหมากอื่น 2–8 ตัว"
        : cost > draftBudget ? "งบเกิน 24 แต้ม"
          : counts("q") > 1 || counts("r") > 2 || counts("n") > 4 || counts("b") > 4 || counts("p") > 6 ? "จำนวนหมากชนิดนี้เกินขีดจำกัด" : undefined;
  return { valid: !error, error, cost };
}
function enemyDraft(seed: number, budget: number): PieceSymbol[] {
  const candidates: PieceSymbol[][] = [];
  for (let q = 0; q <= 1; q++) for (let r = 0; r <= 2; r++) for (let n = 0; n <= 4; n++) for (let b = 0; b <= 4; b++) for (let p = 0; p <= 6; p++) {
    if (q + r + n + b + p > 8 || q + r + n + b + p < 2 || q * 9 + r * 5 + (n + b) * 3 + p !== budget) continue;
    candidates.push(["k", ...Array(q).fill("q"), ...Array(r).fill("r"), ...Array(n).fill("n"), ...Array(b).fill("b"), ...Array(p).fill("p")]);
  }
  if (!candidates.length) throw new Error("No legal opposing draft for budget");
  return candidates[Math.floor(random(seed ^ 0x3d8b714f)() * candidates.length)];
}
function fenFromPieces(pieces: { type: PieceSymbol; color: Color; square: Square }[], turn: Color = "w") {
  const rows: string[][] = Array.from({ length: 8 }, () => Array(8).fill(""));
  for (const p of pieces) rows[8 - Number(p.square[1])][p.square.charCodeAt(0) - 97] = p.color === "w" ? p.type.toUpperCase() : p.type;
  const placement = rows.map(row => {
    let run = 0, value = "";
    for (const p of row) { if (!p) run++; else { if (run) value += run; run = 0; value += p; } }
    return value + (run || "");
  }).join("/");
  return `${placement} ${turn} - - 0 1`;
}
function draftFen(white: PieceSymbol[], black: PieceSymbol[]) {
  const pieces: { type: PieceSymbol; color: Color; square: Square }[] = [];
  for (const color of ["w", "b"] as Color[]) {
    const roster = color === "w" ? white : black, back = color === "w" ? "1" : "8", front = color === "w" ? "2" : "7";
    pieces.push({ type: "k", color, square: `e${back}` as Square });
    const majorSquares = [..."abcd fgh".replace(" ", "")].map(file => `${file}${back}` as Square).concat([`d${front}` as Square]);
    const major = roster.filter(p => p !== "k" && p !== "p");
    major.forEach((type, i) => pieces.push({ type, color, square: majorSquares[i] }));
    const pawnFiles = ["a", "h", "b", "g", "c", "f"];
    roster.filter(p => p === "p").forEach((type, i) => pieces.push({ type, color, square: `${pawnFiles[i]}${front}` as Square }));
  }
  return fenFromPieces(pieces);
}
function mirrorFen(seed: number) {
  const rng = random(seed), kinds: PieceSymbol[] = ["n", "b", "r", "q"];
  const left = kinds[Math.floor(rng() * kinds.length)], right = kinds[Math.floor(rng() * kinds.length)];
  const pieces: { type: PieceSymbol; color: Color; square: Square }[] = [];
  for (const color of ["w", "b"] as Color[]) {
    const back = color === "w" ? "1" : "8", front = color === "w" ? "2" : "7";
    pieces.push({ type: "k", color, square: `e${back}` as Square }, { type: left, color, square: `b${back}` as Square }, { type: right, color, square: `g${back}` as Square });
    for (const file of ["b", "d", "e", "g"]) pieces.push({ type: "p", color, square: `${file}${front}` as Square });
  }
  return fenFromPieces(pieces);
}
export type RushPuzzle = { fen: string; side: Color; index: number; title: string; hint: string };
const rushTemplates = [
  "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
  "6k1/5ppp/8/8/8/8/6PP/4R1K1 w - - 0 1",
  "k7/1pp5/1QK5/8/8/8/8/8 w - - 0 1",
  "7k/6pp/5NK1/8/8/8/8/7R w - - 0 1",
];
export function rushPuzzle(seed: number, index = 0): RushPuzzle {
  const rng = random(seed32(seed) ^ Math.imul(index + 1, 0x9e3779b1)), template = rushTemplates[Math.floor(rng() * rushTemplates.length)];
  const mirror = rng() >= 0.5, invert = rng() >= 0.5;
  const pieces = new Chess(template).board().flat().filter(p => p !== null).map(p => ({
    type: p.type, color: (invert ? opponent(p.color) : p.color),
    square: `${"abcdefgh"[mirror ? 7 - (p.square.charCodeAt(0) - 97) : p.square.charCodeAt(0) - 97]}${invert ? 9 - Number(p.square[1]) : p.square[1]}` as Square,
  }));
  const side: Color = invert ? "b" : "w";
  return { fen: fenFromPieces(pieces, side), side, index, title: `PUZZLE ${index + 1}`, hint: "รุกฆาตในหนึ่งตา · ทุกช่องหนีต้องถูกควบคุม" };
}
export function variantInitialFen(id: VariantId, options: VariantOptions) {
  if (id === "draft") {
    const roster = options.draft || defaultDraft, validation = validateDraft(roster);
    if (!validation.valid) throw new Error(validation.error);
    const enemy = enemyDraft(options.seed, validation.cost);
    return options.draftColor === "b" ? draftFen(enemy, roster) : draftFen(roster, enemy);
  }
  if (id === "mirror") return mirrorFen(options.seed);
  if (id === "rush") return rushPuzzle(options.seed, options.round || 0).fen;
  return new Chess().fen();
}

type Counters = { scores: Record<Color, number>; turns: Record<Color, number> };
type VariantEntry = { move: VariantMove; before: Counters };
export type VariantSnapshot = { id: VariantId; options: VariantOptions; fen: string; initialFen: string; counters: Counters; history: { move: Omit<VariantMove, "isCapture" | "isPromotion" | "isEnPassant" | "isKingsideCastle" | "isQueensideCastle" | "isBigPawn">; before: Counters }[] };
export type VariantProgress = Counters & { target: number; turnLimit: number; round: number; phase: string; phaseLabel: string; forecast: string; forecastLabel: string; control: Square[] };
const phases = ["calm", "knight", "bishop"] as const;
const phaseLabels = { calm: "สนามสงบ · เดินปกติ", knight: "ลมม้า · ทแยง 1 ช่อง", bishop: "ลมบิชอป · แนวตรง 1 ช่อง" };
/** Independent board variants. Extra Chaos movement is a one-turn action;
 * king danger continues to use the normal attack patterns, like Special Duel. */
export class VariantChess extends Chess {
  readonly variant: VariantId;
  readonly options: VariantOptions;
  get id() { return this.variant; }
  private initial: string;
  private counters: Counters = { scores: { w: 0, b: 0 }, turns: { w: 0, b: 0 } };
  private entries: VariantEntry[] = [];
  constructor(id: VariantId, options: VariantOptions, fen?: string, snapshot?: VariantSnapshot) {
    super(fen || variantInitialFen(id, options));
    this.variant = id; this.options = { ...options, seed: seed32(options.seed), draft: options.draft ? [...options.draft] : undefined };
    this.initial = snapshot?.initialFen || this.fen();
    if (snapshot) {
      if (snapshot.id !== id || snapshot.fen !== this.fen()) throw new Error("Variant snapshot does not match position");
      this.counters = structuredClone(snapshot.counters);
      this.entries = snapshot.history.map(entry => ({ before: structuredClone(entry.before), move: this.hydrate(entry.move) }));
    }
  }
  private hydrate(raw: VariantSnapshot["history"][number]["move"]): VariantMove {
    return { ...raw, isCapture: () => !!raw.captured, isPromotion: () => !!raw.promotion, isEnPassant: () => raw.flags.includes("e"), isKingsideCastle: () => raw.flags.includes("k"), isQueensideCastle: () => raw.flags.includes("q"), isBigPawn: () => raw.flags.includes("b") };
  }
  snapshot(): VariantSnapshot {
    return { id: this.variant, options: structuredClone(this.options), fen: this.fen(), initialFen: this.initial, counters: structuredClone(this.counters), history: this.entries.map(entry => {
      const { isCapture: _a, isPromotion: _b, isEnPassant: _c, isKingsideCastle: _d, isQueensideCastle: _e, isBigPawn: _f, ...move } = entry.move;
      return { move, before: structuredClone(entry.before) };
    }) };
  }
  clone() { return new VariantChess(this.variant, this.options, this.fen(), this.snapshot()); }
  progress(): VariantProgress {
    const round = Math.min(this.counters.turns.w, this.counters.turns.b), phase = phases[round % 3], forecast = phases[(round + 1) % 3];
    return { ...structuredClone(this.counters), target: this.variant === "control" ? 5 : 0, turnLimit: this.variant === "score" ? 12 : 0, round: round + 1, phase, phaseLabel: phaseLabels[phase], forecast, forecastLabel: phaseLabels[forecast], control: this.variant === "control" ? [...controlSquares] : [] };
  }
  chaosMoves(from?: Square): VariantMove[] {
    if (this.variant !== "chaos") return [];
    const phase = this.progress().phase, type = phase === "knight" ? "n" : phase === "bishop" ? "b" : null;
    if (!type) return [];
    const vectors = type === "n" ? [[1,1],[-1,1],[1,-1],[-1,-1]] : [[1,0],[-1,0],[0,1],[0,-1]], moves: VariantMove[] = [];
    for (const source of from ? [from] : SQUARES) {
      const piece = this.get(source);
      if (!piece || piece.color !== this.turn() || piece.type !== type) continue;
      for (const [dx, dy] of vectors) {
        const x = source.charCodeAt(0) - 97 + dx, y = Number(source[1]) + dy;
        if (x < 0 || x > 7 || y < 1 || y > 8) continue;
        const to = `${"abcdefgh"[x]}${y}` as Square, victim = this.get(to);
        if (victim?.color === piece.color || victim?.type === "k") continue;
        const probe = new Chess(this.fen()); probe.remove(source); probe.remove(to); probe.put(piece, to);
        const king = probe.board().flat().find(p => p?.type === "k" && p.color === piece.color)!;
        if (probe.isAttacked(king.square, opponent(piece.color))) continue;
        const parts = probe.fen().split(" "), before = this.fen().split(" ");
        parts[1] = opponent(piece.color); parts[3] = "-"; parts[4] = victim ? "0" : String(Number(before[4]) + 1); parts[5] = String(Number(before[5]) + (piece.color === "b" ? 1 : 0));
        moves.push(this.hydrate({ color: piece.color, piece: type, from: source, to, captured: victim?.type, flags: `v${victim ? "c" : ""}`, san: `C:${type.toUpperCase()}${source}${victim ? "x" : "-"}${to}`, lan: source + to, before: this.fen(), after: parts.join(" "), chaos: true }));
      }
    }
    return moves;
  }
  override moves: Chess["moves"] = ((options: { square?: Square; piece?: PieceSymbol; verbose?: boolean } = {}) => {
    const moves = [...new Chess(this.fen()).moves({ ...options, verbose: true }), ...this.chaosMoves(options.square)].filter(m => !options.piece || m.piece === options.piece);
    return options.verbose ? moves : moves.map(m => m.san);
  }) as Chess["moves"];
  legalActions() { return this.moves({ verbose: true }) as VariantMove[]; }
  override move(input: Parameters<Chess["move"]>[0] | VariantAction, options?: Parameters<Chess["move"]>[1]): VariantMove {
    if (this.isGameOver()) throw new Error("Variant game is already over");
    let move: VariantMove | undefined;
    if (typeof input === "string" && input.startsWith("C:")) move = this.chaosMoves().find(m => m.san.replace(/[+#]$/, "") === input.replace(/[+#]$/, ""));
    else if (typeof input === "object" && input && (input as VariantAction).chaos) move = this.chaosMoves(input.from as Square).find(m => m.to === input.to);
    else {
      try { move = new Chess(this.fen()).move(input, options); }
      catch (error) {
        if (typeof input !== "object" || !input) throw error;
        move = this.chaosMoves(input.from as Square).find(m => m.to === input.to);
        if (!move) throw error;
      }
    }
    if (!move) throw new Error("Invalid Chaos action");
    const before = structuredClone(this.counters);
    this.counters.turns[move.color]++;
    if (this.variant === "score" && move.captured) this.counters.scores[move.color] += draftCosts[move.captured];
    super.load(move.after);
    if (this.variant === "control" && this.counters.turns.w === this.counters.turns.b) {
      const occupied = new Set(controlSquares.map(square => this.get(square)?.color).filter(Boolean));
      for (const color of ["w", "b"] as Color[]) if (occupied.has(color)) this.counters.scores[color]++;
    }
    move.san = move.san.replace(/[+#]$/, "") + (this.isCheck() ? this.isCheckmate() ? "#" : "+" : "");
    this.entries.push({ move, before });
    return move;
  }
  override undo() {
    const entry = this.entries.pop(); if (!entry) return null;
    super.load(entry.move.before); this.counters = entry.before; return entry.move;
  }
  override history: Chess["history"] = ((options?: { verbose?: boolean }) => options?.verbose ? this.entries.map(e => e.move) : this.entries.map(e => e.move.san)) as Chess["history"];
  override isCheckmate() { return this.isCheck() && this.legalActions().length === 0; }
  override isStalemate() { return !this.isCheck() && this.legalActions().length === 0; }
  override isThreefoldRepetition() {
    const position = (fen: string, counters: Counters) => `${fen.split(" ").slice(0,4).join(" ")}${this.variant === "chaos" ? `|${Math.min(counters.turns.w, counters.turns.b) % 3}` : ""}${this.variant === "control" ? `|${counters.scores.w},${counters.scores.b}` : ""}`;
    const current = position(this.fen(), this.counters);
    return this.entries.filter(entry => position(entry.move.before, entry.before) === current).length >= 2;
  }
  override isInsufficientMaterial() {
    // Center control can win with kings alone; moving winds can enable minor-piece mates.
    return this.variant === "control" ? false : this.variant === "chaos" ? this.board().flat().every(p => !p || p.type === "k") : new Chess(this.fen()).isInsufficientMaterial();
  }
  override isDraw() { return this.isStalemate() || this.isInsufficientMaterial() || this.isThreefoldRepetition() || this.isDrawByFiftyMoves(); }
  outcome(): VariantOutcome | null {
    if (this.isCheckmate()) return { winner: opponent(this.turn()), reason: "checkmate", label: "รุกฆาต" };
    const scores = this.counters.scores;
    if (this.variant === "score" && this.counters.turns.w >= 12 && this.counters.turns.b >= 12 || this.variant === "control" && Math.max(scores.w, scores.b) >= 5) {
      return { winner: scores.w === scores.b ? null : scores.w > scores.b ? "w" : "b", reason: this.variant === "score" ? "score-limit" : "control-target", label: this.variant === "score" ? "ครบฝ่ายละ 12 ตา" : "ยึดใจกลางครบ 5 แต้ม" };
    }
    if (this.isDraw()) return { winner: null, reason: "draw", label: this.isStalemate() ? "ไม่มีตาเดิน" : this.isThreefoldRepetition() ? "ตำแหน่งซ้ำสามครั้ง" : this.isDrawByFiftyMoves() ? "กฎ 50 ตา" : "กำลังหมากไม่เพียงพอ" };
    return null;
  }
  override isGameOver() { return this.outcome() !== null; }
  override pgn() {
    const definition = modeDefinitions.find(mode => mode.id === this.variant)!;
    return `[Variant "${definition.name}"]\n[SetUp "1"]\n[FEN "${this.initial}"]\n[Seed "${this.options.seed}"]\n\n${this.entries.map((entry, i) => `${entry.move.color === "w" ? `${entry.move.before.split(" ")[5]}. ` : i === 0 ? `${entry.move.before.split(" ")[5]}... ` : ""}${entry.move.san}`).join(" ")} *`;
  }
}
export function createVariant(id: VariantId, options: VariantOptions, fen?: string, snapshot?: VariantSnapshot) { return new VariantChess(id, options, fen, snapshot); }

export type Challenge = { mode: VariantId; seed: number; draft?: PieceSymbol[]; arena?: string };
const hash = (text: string) => { let value = 2166136261; for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return (value >>> 0).toString(36); };
export function encodeChallenge(challenge: Challenge) {
  if (!modeDefinitions.some(mode => mode.id === challenge.mode) || !Number.isSafeInteger(challenge.seed) || challenge.seed < 0 || challenge.seed > 0xffffffff || challenge.draft && !validateDraft(challenge.draft).valid || challenge.arena && !/^[a-z][a-z0-9-]{0,40}$/.test(challenge.arena)) throw new Error("Invalid challenge");
  const json = JSON.stringify([challenge.mode, challenge.seed, challenge.draft?.join("") || "", challenge.arena || ""]);
  const payload = [...json].map(char => char.charCodeAt(0).toString(36).padStart(2, "0")).join("");
  return `SC1-${payload}-${hash(payload)}`;
}
export function decodeChallenge(text: string): Challenge | null {
  if (typeof text !== "string" || text.length > 512) return null;
  const match = /^SC1-([a-z0-9]+)-([a-z0-9]+)$/i.exec(text.trim());
  if (!match || match[1].length % 2 || hash(match[1]) !== match[2]) return null;
  try {
    const json = match[1].match(/../g)!.map(pair => String.fromCharCode(parseInt(pair, 36))).join("");
    const [mode, seed, roster, arena] = JSON.parse(json);
    if (!modeDefinitions.some(definition => definition.id === mode) || !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || typeof roster !== "string" || typeof arena !== "string" || arena && !/^[a-z][a-z0-9-]{0,40}$/.test(arena)) return null;
    const draft = roster ? roster.split("") as PieceSymbol[] : undefined;
    if (draft && !validateDraft(draft).valid) return null;
    return { mode, seed, draft, arena: arena || undefined };
  } catch { return null; }
}
