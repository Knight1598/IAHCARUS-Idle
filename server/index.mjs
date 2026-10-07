import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { randomBytes } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { Chess } from "chess.js";
import { normalizeCosmetics } from "../shared/cosmetics.js";

const root = resolve("dist");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"ok":true}');
    return;
  }
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    let path = resolve(root, "." + pathname);
    if (!path.startsWith(root + "/") && path !== root) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (path === root) path = resolve(root, "index.html");
    if (!(await stat(path)).isFile()) throw Error();
    const data = await readFile(path);
    res.writeHead(200, {
      "Content-Type": mime[extname(path)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found. Run npm run build first.");
  }
});
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 4096 });
const clockMs = Math.max(
  100,
  Math.min(3600000, Number(process.env.CHESS_CLOCK_MS) || 300000),
);
const rooms = new Map();
const peers = new WeakMap();
const send = (ws, data) => {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
};
const clocks = (room) => {
  const c = { ...room.clocks };
  if (room.started && !room.result)
    c[room.game.turn()] = Math.max(
      0,
      c[room.game.turn()] - (Date.now() - room.since),
    );
  return c;
};
function snapshot(room, ws, latest = null) {
  send(ws, {
    type: "state",
    code: room.code,
    color: peers.get(ws)?.color,
    fen: room.game.fen(),
    history: room.game.history(),
    latest,
    clocks: clocks(room),
    started: room.started,
    result: room.result,
    connected: {
      w: room.players.w?.ws?.readyState === 1,
      b: room.players.b?.ws?.readyState === 1,
    },
    cosmetics: {
      w: room.players.w?.cosmetics || normalizeCosmetics(null, "w"),
      b: room.players.b?.cosmetics || normalizeCosmetics(null, "b"),
    },
    revision: room.revision,
  });
}
function broadcast(room, latest = null) {
  for (const p of Object.values(room.players))
    if (p) snapshot(room, p.ws, latest);
}
function settle(room) {
  if (!room.started || room.result) return;
  const color = room.game.turn();
  room.clocks = clocks(room);
  room.since = Date.now();
  if (room.clocks[color] <= 0) {
    room.result = { winner: color === "w" ? "b" : "w", reason: "timeout" };
    room.revision++;
  }
}
function detach(ws) {
  const peer = peers.get(ws);
  if (peer) {
    const room = rooms.get(peer.code);
    if (room?.players[peer.color]?.ws === ws) {
      room.players[peer.color].ws = null;
      room.touched = Date.now();
      broadcast(room);
    }
    peers.delete(ws);
  }
}
wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
  let count = 0,
    last = Date.now();
  ws.on("message", (raw) => {
    if (Date.now() - last > 1000) {
      last = Date.now();
      count = 0;
    }
    if (++count > 30) {
      send(ws, { type: "error", message: "ส่งคำสั่งเร็วเกินไป" });
      return;
    }
    try {
      const m = JSON.parse(raw.toString());
      if (m.type === "create" || m.type === "join" || m.type === "resume") {
        if (peers.has(ws)) throw Error("ออกจากห้องก่อนสร้างหรือเข้าห้องใหม่");
        let room, color, token;
        if (m.type === "create") {
          if (rooms.size >= 1000) throw Error("ห้องเต็ม กรุณาลองใหม่ภายหลัง");
          let code;
          do {
            code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
          } while (rooms.has(code));
          room = {
            code,
            game: new Chess(),
            players: { w: null, b: null },
            clocks: { w: clockMs, b: clockMs },
            since: Date.now(),
            started: false,
            result: null,
            revision: 0,
            touched: Date.now(),
          };
          rooms.set(code, room);
          color = "w";
        } else {
          room = rooms.get(String(m.code).toUpperCase());
          if (!room) throw Error("ไม่พบห้องนี้ หรือห้องหมดอายุแล้ว");
          if (m.type === "resume") {
            color = ["w", "b"].find((c) => room.players[c]?.token === m.token);
            if (!color) throw Error("ไม่สามารถกลับเข้าห้องได้");
            const old = room.players[color].ws;
            if (old && old !== ws) {
              peers.delete(old);
              old.close(4001, "Session replaced");
            }
            token = room.players[color].token;
          } else {
            if (room.players.b) throw Error("ห้องนี้มีผู้เล่นครบแล้ว");
            color = "b";
          }
        }
        token ||= randomBytes(24).toString("hex");
        const cosmetics = m.type === "resume"
          ? room.players[color].cosmetics
          : normalizeCosmetics(m.cosmetics, color);
        room.players[color] = { ws, token, cosmetics };
        peers.set(ws, { code: room.code, color });
        room.touched = Date.now();
        if (room.players.w && room.players.b && !room.started) {
          room.started = true;
          room.since = Date.now();
          room.revision++;
        }
        settle(room);
        send(ws, { type: "session", code: room.code, color, token });
        broadcast(room);
        return;
      }
      const peer = peers.get(ws);
      const room = peer && rooms.get(peer.code);
      if (!room) throw Error("ยังไม่ได้เข้าห้อง");
      if (m.type === "leave") {
        detach(ws);
        send(ws, { type: "left" });
        return;
      }
      settle(room);
      room.touched = Date.now();
      if (m.type === "sync") {
        snapshot(room, ws);
        return;
      }
      if (room.result) {
        broadcast(room);
        throw Error("เกมจบแล้ว");
      }
      if (!room.started) throw Error("รอผู้เล่นอีกฝ่าย");
      if (m.type === "resign") {
        room.result = {
          winner: peer.color === "w" ? "b" : "w",
          reason: "resign",
        };
        room.revision++;
        broadcast(room);
        return;
      }
      if (m.type === "move") {
        if (peer.color !== room.game.turn()) throw Error("ยังไม่ใช่ตาของคุณ");
        if (m.revision !== room.revision) {
          snapshot(room, ws);
          throw Error("กระดานเปลี่ยนแล้ว กรุณาเดินใหม่");
        }
        if (
          !/^[a-h][1-8]$/.test(m.from) ||
          !/^[a-h][1-8]$/.test(m.to) ||
          !["q", "r", "b", "n"].includes(m.promotion || "q")
        )
          throw Error("รูปแบบการเดินไม่ถูกต้อง");
        const before = room.game.fen();
        let move;
        try {
          move = room.game.move({
            from: m.from,
            to: m.to,
            promotion: m.promotion || "q",
          });
        } catch {
          throw Error("เดินผิดกติกา");
        }
        room.since = Date.now();
        room.revision++;
        if (room.game.isCheckmate())
          room.result = { winner: peer.color, reason: "checkmate" };
        else if (room.game.isDraw())
          room.result = { winner: null, reason: "draw" };
        broadcast(room, {
          before,
          from: move.from,
          to: move.to,
          promotion: move.promotion,
          san: move.san,
        });
        return;
      }
      throw Error("ไม่รองรับคำสั่งนี้");
    } catch (e) {
      send(ws, {
        type: "error",
        message: e instanceof Error ? e.message : "คำสั่งไม่ถูกต้อง",
      });
    }
  });
  ws.on("close", () => detach(ws));
  ws.on("error", () => {});
});
setInterval(() => {
  for (const room of rooms.values()) {
    settle(room);
    broadcast(room);
    if (
      !Object.values(room.players).some((p) => p?.ws?.readyState === 1) &&
      Date.now() - room.touched > 3600000
    )
      rooms.delete(room.code);
  }
}, 1000).unref();
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000).unref();
const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () =>
  console.log(
    `Special Chess server listening on port ${server.address().port}`,
  ),
);
