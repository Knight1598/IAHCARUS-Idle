/** Original vector geometry shared by every game screen. No icon fonts or remote assets. */
type Piece = "p" | "n" | "b" | "r" | "q" | "k";
const pieceNames: Record<Piece, string> = { p: "เบี้ย", n: "ม้า", b: "บิชอป", r: "รุก", q: "ควีน", k: "คิง" };
const piecePaths: Record<Piece, string> = {
  p: '<path class="piece-solid" d="M24 5 31 12 28 20 31 33 35 37 35 42 13 42 13 37 17 33 20 20 17 12Z"/><path d="M17 12h14M20 20h8M17 33h14M13 37h22"/><path class="piece-inlay" d="m24 9 3 4-3 4-3-4Z"/>',
  n: '<path class="piece-solid" d="m15 42-1-6 5-8-6-1-3-6L24 7l9-3-1 9 6 12-5 11 4 6Z"/><path d="m24 7 5 8-10 5-4 7m4 1 10-6 3 14M14 36h19"/><path class="piece-inlay" d="m25 15 3-1-1 3-3 1Z"/>',
  b: '<path class="piece-solid" d="m24 4 9 11-2 8-5 5 3 7 7 3v4H12v-4l7-3 3-7-5-5-2-8Z"/><path d="m27 9-6 11m-4 3h14m-12 12h10m-17 3h24"/><path class="piece-inlay" d="m24 25 3 3-3 3-3-3Z"/>',
  r: '<path class="piece-solid" d="M10 6h8v6h4V6h4v6h4V6h8v13l-6 5v12l4 3v3H12v-3l4-3V24l-6-5Z"/><path d="M10 19h28M16 24h16M16 36h16M12 39h24"/><path class="piece-inlay" d="m24 25 3 4-3 4-3-4Z"/>',
  q: '<path class="piece-solid" d="m10 9 9 9 5-14 5 14 9-9-5 16-5 5 3 6 6 3v3H11v-3l6-3 3-6-5-5Z"/><path d="M15 25h18M20 30h8M17 36h14M11 39h26"/><path class="piece-inlay" d="m24 17 3 5-3 5-3-5Z"/>',
  k: '<path class="piece-solid" d="M21 4h6v5h5v5h-5v7l6 5-4 9 7 4v3H12v-3l7-4-4-9 6-5v-7h-5V9h5Z"/><path d="M21 21h6M15 26h18M19 35h10M12 39h24"/><path class="piece-inlay" d="m24 25 3 4-3 4-3-4Z"/>',
};
const iconPaths: Record<string, string> = {
  "arrow-right": '<path d="M8 24h30M26 12l12 12-12 12"/><path class="icon-faint" d="M8 18v12"/>',
  "arrow-left": '<path d="M40 24H10m12-12L10 24l12 12"/><path class="icon-faint" d="M40 18v12"/>',
  "arrow-down": '<path d="M24 7v29M12 24l12 12 12-12M10 41h28"/>',
  "arrow-up": '<path d="M24 41V12M12 24l12-12 12 12M10 6h28"/>',
  plus: '<path d="M24 9v30M9 24h30"/><path class="icon-faint" d="M15 5H5v10m28-10h10v10M5 33v10h10m18 0h10V33"/>',
  minus: '<path d="M9 24h30"/><path class="icon-faint" d="M15 5H5v10m28-10h10v10M5 33v10h10m18 0h10V33"/>',
  shuffle: '<path d="M5 12h8l22 24h8M5 36h8l22-24h8m-7-7 7 7-7 7m0 10 7 7-7 7"/>',
  close: '<path d="m14 14 20 20m0-20L14 34"/><path class="icon-faint" d="M17 6H6v11m25-11h11v11M6 31v11h11m14 0h11V31"/>',
  menu: '<path d="M8 12h32M8 24h25M8 36h32"/><path class="icon-faint" d="m38 21 3 3-3 3"/>',
  duel: '<path d="m9 5 19 19-4 4L5 9Zm34 4L24 28l-4-4L39 5ZM14 26l8 8m4-20 8 8M8 40l11-11m21 11L29 29"/><path d="m5 38 5 5m28-38 5 5"/>',
  ultimate: '<path class="icon-solid" d="m27 4-17 24h12l-1 16 17-24H26Z"/><path class="icon-faint" d="M9 12 5 19m34 17 4-7"/>',
  armory: '<path d="m24 4 15 8v15L24 43 9 27V12Zm0 9v21M16 22h16"/><path class="icon-faint" d="m14 9 10 7 10-7M9 27l15 7 15-7"/>',
  shield: '<path d="m24 4 16 7-3 20-13 13L11 31 8 11Z"/><path d="m15 24 7 7 12-15"/>',
  settings: '<path d="m19 5-2 7-7 1-5 11 5 11 7 1 2 7h10l2-7 7-1 5-11-5-11-7-1-2-7Z"/><path d="m24 15 8 4v10l-8 4-8-4V19Z"/>',
  challenge: '<path d="m24 4 17 10v20L24 44 7 34V14ZM24 14v12m0 7v1"/><path class="icon-faint" d="m7 14 17 10 17-10M7 34l17-8 17 8"/>',
  star: '<path class="icon-solid" d="m24 5 5 12 14 1-11 9 3 15-11-8-11 8 3-15-11-9 14-1Z"/>',
  "star-outline": '<path d="m24 5 5 12 14 1-11 9 3 15-11-8-11 8 3-15-11-9 14-1Z"/>',
  diamond: '<path class="icon-solid" d="m24 5 15 19-15 19L9 24Z"/><path class="icon-faint" d="m24 13 8 11-8 11-8-11Z"/>',
  crystal: '<path d="M14 5h20l9 19-19 19L5 24Zm0 0 10 38L34 5M5 24h38"/>',
  help: '<path d="m9 14 8-8h14l8 8v5l-15 9v4m0 6v2"/><path class="icon-faint" d="M4 24v13l8 7h24l8-7V24"/>',
  check: '<path d="m10 24 10 10L39 13"/><path class="icon-faint" d="M36 6H13l-7 7v22l7 7h23l6-7V24"/>',
  profile: '<path d="m24 5 9 6v11l-9 6-9-6V11Zm-14 38v-8l14-7 14 7v8Z"/><path class="icon-faint" d="m17 14 7 4 7-4M10 35l14 7 14-7"/>',
  lock: '<path d="M13 21V11l6-6h10l6 6v10m-27 0h32v21H8Zm16 9v5"/>',
  edit: '<path d="m31 5 12 12-23 23-14 2 2-14Zm-4 4 12 12M8 28l12 12"/>',
  online: '<path d="m24 4 16 9v22l-16 9-16-9V13ZM8 13l16 11 16-11M8 35l16-11 16 11M24 4v40"/>',
  mirror: '<path d="M24 4v40M7 10h10v28H7Zm24 0h10v28H31Z"/><path class="icon-faint" d="m3 24 8-8m0 16-8-8m42 0-8-8m0 16 8-8"/>',
  draft: '<path d="M7 6h23v30H7Zm11 6h23v30H18"/><path d="m23 23 6-5 6 5-2 8h-8Z"/>',
  score: '<path d="M8 35h7V24H8Zm12 0h8V15h-8Zm14 0h7V6h-7ZM5 42h38"/><path class="icon-faint" d="m7 16 13-9 8 3 11-8"/>',
  control: '<path d="M5 5h13v13H5Zm25 0h13v13H30ZM5 30h13v13H5Zm25 0h13v13H30ZM24 13l11 11-11 11-11-11Z"/>',
  puzzle: '<path d="M6 6h15v8l6 4 6-4V6h9v15h-8l-4 6 4 6h8v9H27v-8l-6-4-6 4v8H6V27h8l4-6-4-6H6Z"/>',
  chaos: '<path d="m24 4 16 9-6 7 10 4-11 10-3 9-10-8-12 2 3-12-7-7 16-5Z"/><path d="m24 13 6 8-5 7-9-4Z"/>',
  history: '<path d="M12 7h28v34H12Zm7 10h14m-14 8h14m-14 8h8M6 12v25"/>',
  rotate: '<path d="M9 24 4 14l12 1M5 15l9-9h21l9 10v18l-10 9H16L6 33m26 0 8 1-3 9"/>',
  undo: '<path d="M19 8 7 20l12 12M7 20h25l8 8v12"/>',
  target: '<path d="M14 5H5v9m29-9h9v9M5 34v9h9m20 0h9v-9M24 14l10 10-10 10-10-10Z"/><path d="M24 6v8m18 10h-8M24 42v-8M6 24h8"/>',
  play: '<path class="icon-solid" d="m15 8 25 16-25 16Z"/><path class="icon-faint" d="M7 8v32"/>',
  pause: '<path d="M13 7h7v34h-7Zm15 0h7v34h-7Z"/>',
  audio: '<path d="M7 18h8L27 8v32L15 30H7Zm27-2 5 8-5 8m4-22 8 14-8 14"/>',
  "audio-off": '<path d="M7 18h8L27 8v32L15 30H7Zm7-14 30 40m-11-26 10 12m0-12L33 30"/>',
  copy: '<path d="M16 14h25v29H16Zm-9 20H5V5h25v2"/>',
  flame: '<path d="m26 4 2 14 10-6 4 18-8 12H15L6 30l5-13 5 8Z"/><path d="m25 22-7 10 3 7h8l4-8Z"/>',
  frost: '<path d="M24 3v42M6 13l36 22M6 35l36-22M16 6l8 7 8-7M16 42l8-7 8 7M7 22l9-3-2-9m27 16-9 3 2 9M7 26l9 3-2 9m27-16-9-3 2-9"/>',
  grove: '<path d="m24 4 16 11-8 12 8 10H8l8-10-8-12ZM24 16v28m0-17 10-7M24 31l-10-8"/>',
  eclipse: '<path d="m24 4 15 8 5 12-5 12-15 8-15-8-5-12 5-12Z"/><path class="icon-solid" d="m25 10 5 8-3 13-10 6-7-9 2-12Z"/>',
};
const aliases: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king", crown: "king", logo: "knight", account: "profile", training: "target", special: "ultimate", daily: "challenge", campaign: "puzzle", bot: "duel", local: "duel", citadel: "rook", ember: "flame", astral: "crystal", storm: "ultimate", reactor: "online", arena: "control", download: "arrow-down", reset: "rotate" };
const pieceIds: Record<string, Piece> = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };
function safeClass(value: string) { return value.replace(/[^\w\s-]/g, ""); }
export function geometricPiece(piece: string, color: "w" | "b" = "w", className = "") {
  const kind = (pieceIds[piece] || piece) as Piece;
  const path = piecePaths[kind] || piecePaths.p;
  return `<svg class="iah-icon iah-piece ${safeClass(className)}" data-piece="${piecePaths[kind] ? kind : "p"}" data-color="${color === "b" ? "b" : "w"}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${pieceNames[kind] || pieceNames.p}"><title>${pieceNames[kind] || pieceNames.p}</title>${path}</svg>`;
}
export function icon(name: string, className = "") {
  const id = aliases[name] || name;
  if (pieceIds[id]) return geometricPiece(pieceIds[id], "w", className);
  const path = iconPaths[id] || iconPaths.diamond;
  return `<svg class="iah-icon ${safeClass(className)}" data-icon="${Object.hasOwn(iconPaths, id) ? id : "diamond"}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${path}</svg>`;
}
const alphabet: Record<string, string> = {
  I: "M4 3h20M14 3v30M4 33h20", A: "M3 33 14 3 25 33M7 23h14", H: "M3 3v30M25 3v30M3 18h22", C: "M25 3H9L3 9v18l6 6h16", R: "M3 33V3h16l6 6v7l-6 5H3m12 0 12 12", U: "M3 3v24l6 6h10l6-6V3", S: "M25 3H9L3 9v4l6 5h10l6 5v4l-6 6H3",
};
/** Hand drawn angular wordmark and winged crown, the game brand. */
export function logo(style: "compact" | "hero" = "compact") {
  const letters = [..."IAHCARUS"].map((letter, i) => `<path d="${alphabet[letter]}" transform="translate(${136 + i * 37} 43) scale(1.05 1.42)"/>`).join("");
  return `<svg class="iah-logo iah-logo--${style}" viewBox="0 0 442 126" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="IAHCARUS Special Chess"><title>IAHCARUS Special Chess</title><g class="logo-frame"><path d="M59 3 110 33v60l-51 30L8 93V33Z"/><path d="M59 12 102 37v52l-43 25L16 89V37Z"/></g><g class="logo-wings"><path d="m51 68-7-28-29-8 12 23 19 11-30-6 13 18 24 5Z"/><path d="m67 68 7-28 29-8-12 23-19 11 30-6-13 18-24 5Z"/></g><path class="logo-core" d="m59 25 10 20-3 28-7 15-7-15-3-28Z"/><path class="logo-crown" d="m43 71 16 10 16-10-6 25H49Z"/><g class="logo-word">${letters}</g><path class="logo-rule" d="M137 99h78m10 0h15m10 0h153"/></svg>`;
}
const legacy: Record<string, { name: string; piece?: Piece; color?: "w" | "b" }> = {
  "♔": { name: "king", piece: "k", color: "w" }, "♚": { name: "king", piece: "k", color: "b" }, "♕": { name: "queen", piece: "q", color: "w" }, "♛": { name: "queen", piece: "q", color: "b" }, "♖": { name: "rook", piece: "r", color: "w" }, "♜": { name: "rook", piece: "r", color: "b" }, "♗": { name: "bishop", piece: "b", color: "w" }, "♝": { name: "bishop", piece: "b", color: "b" }, "♘": { name: "knight", piece: "n", color: "w" }, "♞": { name: "knight", piece: "n", color: "b" }, "♙": { name: "pawn", piece: "p", color: "w" }, "♟": { name: "pawn", piece: "p", color: "b" },
  "⚔": { name: "duel" }, "⚡": { name: "ultimate" }, "ϟ": { name: "ultimate" }, "✦": { name: "crystal" }, "✧": { name: "crystal" }, "◈": { name: "challenge" }, "◆": { name: "diamond" }, "★": { name: "star" }, "☆": { name: "star-outline" }, "✓": { name: "check" }, "✔": { name: "check" }, "⚙": { name: "settings" }, "⌘": { name: "online" }, "◎": { name: "target" }, "◉": { name: "eclipse" }, "♨": { name: "flame" }, "❄": { name: "frost" }, "❋": { name: "grove" }, "☰": { name: "menu" }, "≡": { name: "history" }, "▶": { name: "play" }, "◀": { name: "arrow-left" }, "↻": { name: "rotate" }, "↺": { name: "undo" }, "⟲": { name: "undo" }, "←": { name: "arrow-left" }, "→": { name: "arrow-right" }, "↑": { name: "arrow-up" }, "↓": { name: "arrow-down" }, "✕": { name: "close" }, "×": { name: "close" }, "♫": { name: "audio" }, "♪": { name: "audio-off" }, "🎮": { name: "duel" }, "🏆": { name: "king" }, "🔥": { name: "flame" }, "✨": { name: "crystal" }, "🔒": { name: "lock" }, "🎯": { name: "target" }, "💎": { name: "crystal" }, "🔊": { name: "audio" }, "🔇": { name: "audio-off" },
};
const legacyPattern = new RegExp(`[${Object.keys(legacy).join("")}]\\uFE0F?`, "gu");
const genericEmoji = /[\u{1F300}-\u{1FAFF}]\uFE0F?/gu;
const excluded = "svg,script,style,textarea,pre,code,[data-design-plain]";
function replaceNode(node: Text) {
  const parent = node.parentElement;
  if (!parent || parent.closest(excluded)) return;
  const value = node.nodeValue || "";
  legacyPattern.lastIndex = 0;
  genericEmoji.lastIndex = 0;
  if (!legacyPattern.test(value) && !genericEmoji.test(value)) return;
  legacyPattern.lastIndex = 0;
  if (parent.closest("option,select,title")) {
    node.nodeValue = value.replace(legacyPattern, "").replace(genericEmoji, "").replace(/^\s+/, "");
    return;
  }
  const matches = [...value.matchAll(new RegExp(`${legacyPattern.source}|${genericEmoji.source}`, "gu"))];
  const doc = parent.ownerDocument;
  const fragment = doc.createDocumentFragment();
  let start = 0;
  for (const match of matches) {
    fragment.append(doc.createTextNode(value.slice(start, match.index)));
    const glyph = match[0].replace(/\uFE0F/g, "");
    const entry = legacy[glyph];
    const template = doc.createElement("template");
    template.innerHTML = entry?.piece ? geometricPiece(entry.piece, entry.color) : icon(entry?.name || "diamond");
    fragment.append(template.content);
    start = (match.index || 0) + match[0].length;
  }
  fragment.append(doc.createTextNode(value.slice(start)));
  node.replaceWith(fragment);
}
export function replaceLegacySymbols(root: ParentNode = document) {
  const doc = root instanceof Document ? root : (root as Node).ownerDocument || document;
  const walker = doc.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  for (const text of nodes) replaceNode(text);
}
const installed = new WeakSet<Document>();
/** Lightweight delegated feedback. Static ornaments leave rendering budget for the board. */
export function installDesign(root: ParentNode = document) {
  const doc = root instanceof Document ? root : (root as Node).ownerDocument || document;
  replaceLegacySymbols(root);
  for (const wordmark of root.querySelectorAll<HTMLElement>(".game-wordmark,.brand-mark,.lobby-brand > span")) {
    if (!wordmark.querySelector(".iah-logo")) wordmark.innerHTML = logo();
  }
  for (const title of root.querySelectorAll<HTMLElement>(".title-cover")) {
    if (!title.querySelector(".iah-logo--hero")) title.querySelector("h1")?.insertAdjacentHTML("beforebegin", logo("hero"));
  }
  doc.documentElement.dataset.gameTheme = "geometric";
  if (installed.has(doc)) return;
  installed.add(doc);
  let queued = false;
  const pending = new Set<Node>();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.target instanceof Element && record.target.closest(excluded)) continue;
      if (record.type === "characterData") pending.add(record.target);
      else for (const added of record.addedNodes) {
        if (added instanceof Element && added.matches("svg,.iah-tap")) continue;
        pending.add(added);
      }
    }
    if (queued || !pending.size) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      const nodes = [...pending];
      pending.clear();
      for (const node of nodes) {
        if (!node.isConnected) continue;
        if (node instanceof Text) replaceNode(node);
        else if (node instanceof Element) replaceLegacySymbols(node);
      }
    });
  });
  observer.observe(doc.body, { childList: true, characterData: true, subtree: true });
  const reduced = () => doc.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pulse = (button: HTMLElement, x = .5, y = .5) => {
    if (button.matches(":disabled,[aria-disabled='true']") || reduced()) return;
    const ring = doc.createElement("i");
    ring.className = "iah-tap";
    ring.setAttribute("aria-hidden", "true");
    ring.style.setProperty("--tap-x", `${Math.round(x * 100)}%`);
    ring.style.setProperty("--tap-y", `${Math.round(y * 100)}%`);
    button.append(ring);
    ring.addEventListener("animationend", () => ring.remove(), { once: true });
    doc.defaultView?.setTimeout(() => ring.remove(), 450);
  };
  doc.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("button,summary,[data-game-button]") : null;
    if (!target || target.closest("#flat-board")) return;
    const rect = target.getBoundingClientRect();
    target.classList.add("iah-pressed");
    pulse(target, (event.clientX - rect.left) / Math.max(1, rect.width), (event.clientY - rect.top) / Math.max(1, rect.height));
  }, { passive: true });
  const release = () => { for (const button of doc.querySelectorAll(".iah-pressed")) button.classList.remove("iah-pressed"); };
  doc.addEventListener("pointerup", release, { passive: true });
  doc.addEventListener("pointercancel", release, { passive: true });
  doc.defaultView?.addEventListener("blur", release);
  doc.addEventListener("keydown", (event) => {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>("button,summary,[data-game-button]") : null;
    if (button && !button.closest("#flat-board")) pulse(button);
  });
}
