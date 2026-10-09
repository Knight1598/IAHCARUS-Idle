import { Chess, SQUARES, type Color, type Move, type PieceSymbol, type Square } from "chess.js";

import { normalizeTeam, validBan, type SkillChoice, type SkillTeam, type SkillBan } from './duel-draft.ts';
import { fieldState } from './field-events.ts';

export const ultimates: Record<PieceSymbol, { name: string; label: string; description: string; color: number }> = {
  n: { name: "PHANTOM CHARGE", label: "พุ่งเงาราชินี", description: "เดินหรือกินแบบควีน · เส้นทางต้องโล่ง", color: 0xa78bfa },
  b: { name: "CROSS BREAK", label: "ฉีกแนวรุก", description: "เดินหรือกินแนวตรงได้ 1–2 ช่อง", color: 0x68e8ff },
  r: { name: "SIEGE SHIFT", label: "หักมุมทะลวง", description: "เดินหรือกินแนวทแยงได้ 1–2 ช่อง", color: 0xffaf68 },
  q: { name: "ROYAL LEAP", label: "กระโดดราชินี", description: "เดินหรือกินแบบม้า · กระโดดข้ามหมากได้", color: 0xff81d0 },
  p: { name: "LAST STAND", label: "แทงสวน", description: "กินหมากตรงหน้า 1 ช่อง · เลื่อนขั้นได้", color: 0x77efb7 },
  k: { name: "EMERGENCY DASH", label: "ราชันหลบฉุกเฉิน", description: "เดินแนวตรง 2 ช่อง · ทางโล่งและปลอดภัยทุกช่อง", color: 0xffdb77 },
};
export const alternateUltimates: typeof ultimates = {
  n: { name: "DIAGONAL BLINK", label: "ก้าวเงาทแยง", description: "กระโดดทแยง 2 ช่อง · ข้ามหมากได้", color: 0xa78bfa },
  b: { name: "ORACLE LEAP", label: "ก้าวผู้ทำนาย", description: "กระโดดแบบม้า · เดินหรือกินได้", color: 0x68e8ff },
  r: { name: "FORTRESS LEAP", label: "ปราการกระโดด", description: "กระโดดแบบม้า · เดินหรือกินได้", color: 0xffaf68 },
  q: { name: "PHASE STEP", label: "ราชินีทะลุมิติ", description: "กระโดดแนวตรง 2 ช่อง · ข้ามหมากได้", color: 0xff81d0 },
  p: { name: "FLANK STRIKE", label: "เบี้ยตีปีก", description: "เดินหรือกินด้านข้าง 1 ช่อง", color: 0x77efb7 },
  k: { name: "DIAGONAL RETREAT", label: "ราชันถอยทแยง", description: "เดินทแยง 2 ช่อง · ทางโล่งและปลอดภัยทุกช่อง", color: 0xffdb77 },
};
export interface SpecialConfig {
  charges: number; reusable: boolean; formation: "standard" | "skirmish" | "draft"; seed: number;
  skills: Partial<Record<PieceSymbol, "signature" | "alternate">>;
  drafted?: boolean; fieldEvents?: boolean;
  teams?: Record<Color,SkillTeam>; bans?: Partial<Record<Color,SkillBan>>;
}
/** Only validated rule choices are stored; old saves retain the original duel. */
export function readSpecialConfig(raw?: unknown): SpecialConfig {
  const value = raw && typeof raw === "object" ? raw as Partial<SpecialConfig> : {};
  const bans = { ...(validBan(value.bans?.w) ? {w:value.bans!.w} : {}), ...(validBan(value.bans?.b) ? {b:value.bans!.b} : {}) };
  return { drafted:value.drafted===true, fieldEvents:value.fieldEvents===true, bans,
    teams:{w:normalizeTeam(value.teams?.w,bans.b),b:normalizeTeam(value.teams?.b,bans.w)}, charges: [0,1,3,5,9].includes(value.charges!) ? value.charges! : 3, reusable: value.reusable === true,
    formation: value.formation === "skirmish" || value.formation === "draft" ? value.formation : "standard",
    seed: Number.isSafeInteger(value.seed) && value.seed! >= 0 && value.seed! <= 4294967295 ? value.seed! : 1,
    skills: Object.fromEntries((["p","n","b","r","q","k"] as PieceSymbol[]).map(piece => [piece, value.skills?.[piece] === "alternate" ? "alternate" : "signature"])) };
}
export type UltimateMove = Move & { ultimate?: boolean; portal?: boolean };
export type Action = { from: string; to: string; promotion?: string; ultimate?: boolean; portal?: boolean };
type Resources = { remaining: Record<Color, number>; used: string[]; origins: Record<string, string>; config?: SpecialConfig; plies?: number };
type Entry = { move: UltimateMove; resources: Resources };
const opposite = (color: Color): Color => color === "w" ? "b" : "w";
const xy = (square: Square) => [square.charCodeAt(0) - 97, Number(square[1]) - 1];
const squareAt = (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8 ? `${"abcdefgh"[x]}${y + 1}` as Square : null;

/** Separate rules engine: Chess remains unchanged for standard/offline/online matches.
 * Ultimates change one move, not the piece's permanent attack pattern. Check is
 * determined by ordinary attacks; mate also considers legal ultimate escapes.
 */
export class SpecialChess extends Chess {
  armed: Square | null = null;
  private resources: Resources;
  private entries: Entry[] = [];
  private start: string;
  constructor(fen?: string, resources?: Resources, config?: SpecialConfig) {
    super(fen);
    this.start = this.fen();
    this.resources = resources ? structuredClone(resources) : {
      remaining: { w: readSpecialConfig(config).charges, b: readSpecialConfig(config).charges }, used: [], plies:0, config: readSpecialConfig(config),
      origins: Object.fromEntries(this.board().flat().filter(p => p !== null).map(p => [p.square, `${p.color}:${p.square}`])),
    };
    this.resources.config = readSpecialConfig(this.resources.config);
    this.resources.plies = Number.isSafeInteger(this.resources.plies) && this.resources.plies! >= 0 ? this.resources.plies : 0;
  }
  get config() { return this.resources.config!; }
  choice(piece:PieceSymbol,color:Color=this.turn()):SkillChoice { return this.config.drafted ? this.config.teams![color][piece] : this.config.skills[piece] || 'signature'; }
  skill(piece:PieceSymbol,color:Color=this.turn()) { return this.choice(piece,color)==='off' ? {name:'NO ULTIMATE',label:'ไม่ติดตั้งอัลติ',description:'ใช้การเดินปกติ · ประหยัดงบสกิล',color:0x8296ad} : this.choice(piece,color)==='alternate'?alternateUltimates[piece]:ultimates[piece]; }
  get field() { return this.config.fieldEvents ? fieldState(this.resources.plies!,this.config.seed) : null; }
  get remaining() { return { ...this.resources.remaining }; }
  snapshot() { return structuredClone(this.resources); }
  clone() { return new SpecialChess(this.fen(), this.resources); }
  available(square: Square) {
    const p = this.get(square), id = this.resources.origins[square];
    return !!p && p.color === this.turn() && this.choice(p.type,p.color)!=="off" && this.resources.remaining[p.color] > 0 && !!id && (this.config.reusable || !this.resources.used.includes(id));
  }
  spent(square: Square) { return !this.config.reusable && this.resources.used.includes(this.resources.origins[square]); }
  ultimateMoves(from?: Square): UltimateMove[] {
    const moves: UltimateMove[] = [];
    for (const source of from ? [from] : SQUARES) {
      if (!this.available(source)) continue;
      const piece = this.get(source)!;
      const [x, y] = xy(source);
      const alternate = this.choice(piece.type,piece.color) === "alternate";
      const vectors = alternate ? piece.type === "n" ? [[2,2],[2,-2],[-2,2],[-2,-2]]
        : piece.type === "b" || piece.type === "r" ? [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]
        : piece.type === "q" ? [[2,0],[-2,0],[0,2],[0,-2]]
        : piece.type === "p" ? [[1,0],[-1,0]] : [[1,1],[1,-1],[-1,1],[-1,-1]]
        : piece.type === "n" ? [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
        : piece.type === "b" || piece.type === "k" ? [[1,0],[-1,0],[0,1],[0,-1]]
        : piece.type === "r" ? [[1,1],[1,-1],[-1,1],[-1,-1]]
        : piece.type === "q" ? [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]
        : [[0, piece.color === "w" ? 1 : -1]];
      for (const [dx, dy] of vectors) {
        const limit = alternate ? piece.type === "k" ? 2 : 1 : piece.type === "n" ? 7 : ["b", "r", "k"].includes(piece.type) ? 2 : 1;
        for (let step = 1; step <= limit; step++) {
          const to = squareAt(x + dx * step, y + dy * step);
          if (!to) break;
          const victim = this.get(to);
          if (victim?.color === piece.color || victim?.type === "k") break;
          if (piece.type === "k") {
            if (victim) break;
            const transit = new Chess(this.fen()); transit.remove(source);
            if (transit.isAttacked(to, opposite(piece.color))) break;
            if (step !== 2) continue;
          }
          if (piece.type !== "p" || alternate || victim) {
            const promotions: (PieceSymbol | undefined)[] = piece.type === "p" && ["1", "8"].includes(to[1]) ? ["q", "r", "b", "n"] : [undefined];
            for (const promotion of promotions) {
              const probe = new Chess(this.fen());
              probe.remove(source); probe.remove(to); probe.put({ color: piece.color, type: promotion || piece.type }, to);
              const king = probe.board().flat().find(p => p?.color === piece.color && p.type === "k")!;
              if (probe.isAttacked(king.square, opposite(piece.color))) continue;
              const parts = probe.fen().split(" "), beforeParts = this.fen().split(" ");
              parts[1] = opposite(piece.color); parts[3] = "-";
              parts[4] = piece.type === "p" || victim ? "0" : String(Number(beforeParts[4]) + 1);
              parts[5] = String(Number(beforeParts[5]) + (piece.color === "b" ? 1 : 0));
              // put/remove already remove rights when a king/rook leaves home or a home rook is captured.
              const after = parts.join(" ");
              const check = new Chess(after).isCheck();
              moves.push({ from: source, to, piece: piece.type, color: piece.color, captured: victim?.type, promotion,
                ultimate: true, flags: `u${victim ? "c" : ""}${promotion ? "p" : ""}`,
                san: `U:${piece.type.toUpperCase()}${source}${victim ? "x" : "-"}${to}${promotion ? "=" + promotion.toUpperCase() : ""}${check ? "+" : ""}`,
                lan: source + to + (promotion || ""), before: this.fen(), after,
                isCapture: () => !!victim, isPromotion: () => !!promotion, isEnPassant: () => false,
                isKingsideCastle: () => false, isQueensideCastle: () => false, isBigPawn: () => false,
              });
            }
          }
          if (victim) break;
        }
      }
    }
    return moves;
  }
  portalMoves(from?:Square):UltimateMove[] {
    const active=this.field?.active;if(active?.kind!=='portal')return [];
    const moves:UltimateMove[]=[];
    for(const source of from?[from]:active.squares) {
      if(!active.squares.includes(source))continue;
      const piece=this.get(source);if(!piece||piece.color!==this.turn()||piece.type==='k')continue;
      const to=active.squares.find(s=>s!==source)!;const victim=this.get(to);
      if(victim?.color===piece.color||victim?.type==='k')continue;
      const probe=new Chess(this.fen());probe.remove(source);probe.remove(to);probe.put({type:piece.type,color:piece.color},to);
      const king=probe.board().flat().find(p=>p?.type==='k'&&p.color===piece.color)!;
      if(probe.isAttacked(king.square,opposite(piece.color)))continue;
      const parts=probe.fen().split(' '),before=this.fen().split(' ');parts[1]=opposite(piece.color);parts[3]='-';
      parts[4]=piece.type==='p'||victim?'0':String(Number(before[4])+1);parts[5]=String(Number(before[5])+(piece.color==='b'?1:0));
      const after=parts.join(' ');
      moves.push({from:source,to,piece:piece.type,color:piece.color,captured:victim?.type,portal:true,flags:`t${victim?'c':''}`,san:`P:${piece.type.toUpperCase()}${source}${victim?'x':'-'}${to}`,lan:source+to,before:this.fen(),after,
        isCapture:()=>!!victim,isPromotion:()=>false,isEnPassant:()=>false,isKingsideCastle:()=>false,isQueensideCastle:()=>false,isBigPawn:()=>false});
    }return moves;
  }
  override moves: Chess["moves"] = ((options: { square?: Square; piece?: PieceSymbol; verbose?: boolean } = {}) => {
    const moves = this.armed && options.square === this.armed ? this.ultimateMoves(this.armed) : [...new Chess(this.fen()).moves({ ...options, verbose: true }), ...this.portalMoves(options.square)];
    const filtered = options.piece ? moves.filter(m => m.piece === options.piece) : moves;
    return options.verbose ? filtered : filtered.map(m => m.san);
  }) as Chess["moves"];
  legalActions() { return [...new Chess(this.fen()).moves({ verbose: true }), ...this.ultimateMoves(), ...this.portalMoves()]; }
  override move(input: Parameters<Chess["move"]>[0] | Action, options?: Parameters<Chess["move"]>[1]): UltimateMove {
    let move: UltimateMove;
    if (typeof input === 'string' && input.startsWith('P:') || input && typeof input==='object' && (input as Action).portal) {
      const found=this.portalMoves().find(m=>typeof input==='string'?m.san===input.replace(/[+#]$/,''):m.from===input.from&&m.to===input.to);
      if(!found)throw new Error('Invalid portal move');move=found;
    } else if (typeof input === "string" && input.startsWith("U:")) {
      const found = this.ultimateMoves().find(m => m.san.replace(/[+#]$/, "") === input.replace(/[+#]$/, ""));
      if (!found) throw new Error("Invalid ultimate"); move = found;
    } else if (input && typeof input === "object" && ((input as Action).ultimate || this.armed === input.from)) {
      const found = this.ultimateMoves(input.from as Square).find(m => m.to === input.to && m.promotion === (input.promotion && ["1", "8"].includes(input.to[1]) && this.get(input.from as Square)?.type === "p" ? input.promotion : undefined));
      if (!found) throw new Error("Invalid ultimate"); move = found;
    } else {
      try { move=new Chess(this.fen()).move(input,options); }
      catch(error) {const portal=typeof input==='object'&&input?this.portalMoves(input.from as Square).find(m=>m.to===input.to):undefined;if(!portal)throw error;move=portal;}
    }
    const resources = this.snapshot();
    const activeField = this.field?.active;
    const origin = this.resources.origins[move.from];
    if (move.ultimate) { this.resources.remaining[move.color]--; this.resources.used.push(origin); }
    const captured = move.flags.includes("e") ? `${move.to[0]}${move.from[1]}` : move.to;
    delete this.resources.origins[captured]; delete this.resources.origins[move.from]; this.resources.origins[move.to] = origin;
    if (move.flags.includes("k") || move.flags.includes("q")) {
      const rank = move.from[1], from = `${move.flags.includes("k") ? "h" : "a"}${rank}`, to = `${move.flags.includes("k") ? "f" : "d"}${rank}`;
      this.resources.origins[to] = this.resources.origins[from]; delete this.resources.origins[from];
    }
    super.load(move.after); this.armed = null;
    this.resources.plies!++;
    if(activeField?.kind==='charge'&&this.resources.plies!%2===0)for(const color of ['w','b'] as Color[])
      if(activeField.squares.some(square=>this.get(square)?.color===color))this.resources.remaining[color]=Math.min(this.config.charges,this.resources.remaining[color]+1);
    // Standard chess might report mate where this variant still has an ultimate escape.
    move.san = move.san.replace(/[+#]$/, "") + (this.isCheck() ? this.isCheckmate() ? "#" : "+" : "");
    this.entries.push({ move, resources });
    return move;
  }
  override undo() {
    const entry = this.entries.pop(); if (!entry) return null;
    super.load(entry.move.before); this.resources = entry.resources; this.armed = null; return entry.move;
  }
  override history: Chess["history"] = ((options?: { verbose?: boolean }) => options?.verbose ? this.entries.map(e => e.move) : this.entries.map(e => e.move.san)) as Chess["history"];
  override isCheckmate() { return new Chess(this.fen()).isCheckmate() && this.ultimateMoves().length === 0 && this.portalMoves().length === 0; }
  override isStalemate() { return new Chess(this.fen()).isStalemate() && this.ultimateMoves().length === 0 && this.portalMoves().length === 0; }
  override isThreefoldRepetition() {
    const key = (fen: string, r: Resources) => `${fen.split(" ").slice(0,4).join(" ")}|${r.remaining.w},${r.remaining.b}|${r.config?.fieldEvents ? (r.plies||0)%48 : 0}|${Object.keys(r.origins).sort().filter(s => r.remaining[r.origins[s][0] as Color] > 0 && (r.config?.reusable || !r.used.includes(r.origins[s]))).join(",")}`;
    const current = key(this.fen(), this.resources);
    return this.entries.filter(e => key(e.move.before, e.resources) === current).length >= 2;
  }
  override isInsufficientMaterial() {
    // Minor-piece ultimates can break ordinary insufficient-material assumptions.
    const minor = this.board().flat().filter(p => p && p.type !== "k");
    return minor.length === 0 || super.isInsufficientMaterial() && minor.every(p => !p || this.choice(p.type,p.color)==='off' || ((!this.config.fieldEvents || this.config.charges===0) && this.resources.remaining[p.color] === 0) || this.spent(p.square));
  }
  override isDraw() { return this.isStalemate() || this.isInsufficientMaterial() || this.isThreefoldRepetition() || this.isDrawByFiftyMoves(); }
  override isGameOver() { return this.isCheckmate() || this.isDraw(); }
  override pgn() {
    return `[Variant "Special Duel"]\n[SetUp "1"]\n[FEN "${this.start}"]\n\n${this.entries.map((e, i) => `${e.move.color === "w" ? `${e.move.before.split(" ")[5]}. ` : i === 0 ? `${e.move.before.split(" ")[5]}... ` : ""}${e.move.san}`).join(" ")} *`;
  }
}
