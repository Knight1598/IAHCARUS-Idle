export const attacks = {
  p: "BRAVE STRIKE",
  n: "PHANTOM CHARGE",
  b: "PRISM JUDGMENT",
  r: "SIEGE BREAKER",
  q: "ROYAL ECLIPSE",
  k: "SOVEREIGN’S VERDICT",
};
export function kingSquare(game, color) {
  return game
    .board()
    .flat()
    .find((p) => p?.type === "k" && p.color === color)?.square;
}
export function analyzeMove(before, after, move) {
  const enemy = move.color === "w" ? "b" : "w";
  const king = kingSquare(after, enemy);
  const checkers = king ? after.attackers(king, move.color) : [];
  const ownKing = kingSquare(before, move.color);
  const oldCheckers = ownKing ? before.attackers(ownKing, enemy) : [];
  const capturedSquare = move.flags.includes("e")
    ? move.to[0] + move.from[1]
    : move.to;
  const threatened = after
    .board()
    .flat()
    .filter(
      (p) =>
        p &&
        p.color === enemy &&
        after.attackers(p.square, move.color).includes(move.to),
    )
    .map((p) => p.square);
  let kind = "move";
  if (after.isCheckmate()) kind = "mate";
  else if (checkers.length > 1) kind = "double-check";
  else if (checkers.length && !checkers.includes(move.to))
    kind = "discovered-check";
  else if (checkers.length) kind = "check";
  else if (move.captured && oldCheckers.includes(capturedSquare))
    kind = "rescue";
  else if (oldCheckers.length) kind = move.piece === "k" ? "escape" : "block";
  else if (move.promotion) kind = "promotion";
  else if (move.flags.includes("k") || move.flags.includes("q"))
    kind = "castle";
  else if (threatened.length >= 2) kind = "fork";
  else if (move.flags.includes("e")) kind = "en-passant";
  else if (move.captured) kind = "capture";
  const labels = {
    mate: ["CHECKMATE", "รุกฆาต · ไม่มีทางหนี"],
    "double-check": ["DOUBLE CHECK", "รุกสองทาง"],
    "discovered-check": ["REVEALED STRIKE", "เปิดแนวรุก"],
    check: ["CHECK", "ราชันถูกคุกคาม"],
    rescue: ["ROYAL RESCUE", "เข้าสกัดเพื่อปกป้องราชัน"],
    escape: ["ROYAL ESCAPE", "ราชันหลบแนวโจมตี"],
    block: ["ROYAL SHIELD", "ขวางแนวรุก"],
    promotion: ["ASCENSION", "เลื่อนขั้นหมาก"],
    castle: ["ROYAL GUARD", "เข้าป้อม"],
    fork: ["DOUBLE THREAT", "ขู่หลายตัว"],
    "en-passant": ["GHOST STRIKE", "กินผ่าน"],
    capture: [attacks[move.piece], "ท่าสเปเชียล"],
    move: ["", ""],
  };
  return {
    kind,
    title: labels[kind][0],
    subtitle: labels[kind][1],
    targets: checkers.length && king ? [king] : threatened,
    checkers,
    capturedSquare,
  };
}
