import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { randomBytes } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { Chess } from "chess.js";
import { SpecialChess } from "../src/special.ts";
import { normalizeTeam } from "../src/duel-draft.ts";
import { roomSettings, duelOutcome } from "../shared/duel-room.js";
import { normalizeCosmetics } from "../shared/cosmetics.js";
import { createAccountAPI } from "./accounts.mjs";

const root = resolve("dist");
const guestOnly=process.env.GUEST_DUEL_ONLY==="true";
const accounts = guestOnly ? {handle:async()=>false,identity:()=>null,close:()=>{}} : createAccountAPI();
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  if (await accounts.handle(req, res)) return;
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
server.on("close", () => accounts.close());
const allowedOrigins=new Set((process.env.DUEL_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean));
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 4096,
  verifyClient:({origin,req})=>{
    // Without a configured list, retain the existing same-host development route.
    if(allowedOrigins.size)return allowedOrigins.has(origin);
    if(process.env.NODE_ENV!=="production")return true;
    return !origin||origin===`http://${req.headers.host}`||origin===`https://${req.headers.host}`;
  }
});
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
    ready:{w:!!room.players.w?.ready,b:!!room.players.b?.ready},
    protocol:3,
    rule:room.settings.rule,
    settings:room.settings,
    settingsRevision:room.settingsRevision,
    host:['w','b'].find(c=>room.players[c]?.token===room.hostToken)||null,
    checks:room.checks,
    drawOffer:room.drawOffer,
    rematch:room.rematch,
    teams: {w:room.players.w?.skills||normalizeTeam(null),b:room.players.b?.skills||normalizeTeam(null)},
    resources:room.game instanceof SpecialChess?room.game.snapshot():null,
    series:room.series,
    seats:{w:room.players.w?.seat||null,b:room.players.b?.seat||null},
    signals:room.signals,
    result: room.result,
    connected: {
      w: room.players.w?.ws?.readyState === 1,
      b: room.players.b?.ws?.readyState === 1,
    },
    cosmetics: {
      w: room.players.w?.cosmetics || normalizeCosmetics(null, "w"),
      b: room.players.b?.cosmetics || normalizeCosmetics(null, "b"),
    },
    players: {
      w: room.players.w?.identity || null,
      b: room.players.b?.identity || null,
    },
    revision: room.revision,
  });
}
function scoreRound(room) {
  if(!room.result||room.roundScored)return;
  room.roundScored=true;
  const seat=room.result.winner&&room.players[room.result.winner]?.seat;
  if(seat)room.series.score[seat]++;
  const target=room.settings.bestOf===3?2:1;
  room.series.winner=['A','B'].find(s=>room.series.score[s]>=target)||null;
  room.series.locked=room.settings.bestOf===3&&!room.series.winner;
}
function startGame(room) {
  room.game=room.settings.rule==='special'?new SpecialChess(undefined,undefined,{charges:room.settings.charges,reusable:room.settings.reusable,drafted:true,teams:{w:room.players.w.skills,b:room.players.b.skills},skills:{},formation:'standard',seed:1}):new Chess();
}
function flipArmy(army,color) {
  return normalizeCosmetics({skin:army.skin,loadout:Object.fromEntries(Object.entries(army.loadout).map(([s,id])=>[s[0]+(9-Number(s[1])),id]))},color);
}
function broadcast(room, latest = null) {
  scoreRound(room);
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
      if(!room.started)room.players[peer.color].ready=false;
      room.touched = Date.now();
      broadcast(room);
    }
    peers.delete(ws);
  }
}
wss.on("connection", (ws, req) => {
  const accountIdentity = accounts.identity(req);
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
            settings:roomSettings(m.settings||{}, {rule:'standard',baseMs:clockMs,increment:0,arena:'citadel',allowDraw:true}),
            settingsRevision:0,
            hostToken:null,
            signals:[],
            roundScored:false,
            series:{round:1,score:{A:0,B:0},winner:null,locked:false},
            checks:{w:0,b:0},
            drawOffer:null,
            rematch:{w:false,b:false},
            players: { w: null, b: null },
            clocks: { w: clockMs, b: clockMs },
            since: Date.now(),
            started: false,
            result: null,
            revision: 0,
            touched: Date.now(),
          };
          room.clocks={w:room.settings.baseMs,b:room.settings.baseMs};
          if(m.side!==undefined&&!['w','b','random'].includes(m.side))throw Error('ฝ่ายที่เลือกไม่ถูกต้อง');
          color=m.side==='random'?(randomBytes(1)[0]%2?'w':'b'):(m.side||'w');
          rooms.set(code, room);
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
            if (room.started || room.players.w && room.players.b) throw Error("ห้องนี้มีผู้เล่นครบแล้ว");
            color = !room.players.w ? "w" : "b";
          }
        }
        token ||= randomBytes(24).toString("hex");
        room.hostToken ||= token;
        const cosmetics = m.type === "resume"
          ? room.players[color].cosmetics
          : normalizeCosmetics(m.armies?.[color] || m.cosmetics, color);
        const identity = m.type === "resume" ? room.players[color].identity : accountIdentity;
        const seat=m.type==='resume'?room.players[color].seat:m.type==='create'?'A':(['w','b'].some(c=>room.players[c]?.seat==='A')?'B':'A');
        const skills=m.type==='resume'?room.players[color].skills:normalizeTeam(m.skills);
        room.players[color] = { ws, token, cosmetics, identity, seat, skills, ready:m.type==="resume"&&room.started ? !!room.players[color]?.ready : false };
        peers.set(ws, { code: room.code, color });
        room.touched = Date.now();
        settle(room);
        send(ws, { type: "session", code: room.code, color, token });
        broadcast(room);
        return;
      }
      const peer = peers.get(ws);
      const room = peer && rooms.get(peer.code);
      if (!room) throw Error("ยังไม่ได้เข้าห้อง");
      if (m.type === "leave") {
        settle(room);
        if(room.started&&!room.result){room.result={winner:peer.color==='w'?'b':'w',reason:'resign'};room.revision++;}
        if(!room.started){
          const departing=room.players[peer.color];room.players[peer.color]=null;peers.delete(ws);
          if(room.series.round>1||room.series.score.A||room.series.score.B)room.series={round:1,score:{A:0,B:0},winner:null,locked:false};
          if(room.hostToken===departing.token)room.hostToken=room.players[peer.color==='w'?'b':'w']?.token||null;
          for(const p of Object.values(room.players))if(p)p.ready=false;
          room.settingsRevision++;room.revision++;room.touched=Date.now();broadcast(room);
          if(!room.players.w&&!room.players.b)rooms.delete(room.code);
        }
        else detach(ws);
        send(ws, { type: "left" });
        return;
      }
      settle(room);
      room.touched = Date.now();
      if (m.type === "sync") {
        snapshot(room, ws);
        return;
      }
      if(m.type==='rematch') {
        if(!room.result)throw Error('เกมยังไม่จบ');
        scoreRound(room);
        if(typeof m.ready!=='boolean')throw Error('คำขอเล่นใหม่ไม่ถูกต้อง');
        room.rematch[peer.color]=m.ready;
        if(['w','b'].every(c=>room.rematch[c]&&room.players[c]?.ws?.readyState===WebSocket.OPEN)){
          if(room.settings.swapSides) {
            [room.players.w,room.players.b]=[room.players.b,room.players.w];
            for(const c of ['w','b']) {const p=room.players[c];p.cosmetics=flipArmy(p.cosmetics,c);peers.set(p.ws,{code:room.code,color:c});send(p.ws,{type:'session',code:room.code,color:c,token:p.token});}
          }
          if(room.series.winner)room.series={round:1,score:{A:0,B:0},winner:null,locked:false};
          else room.series.round++;
          room.roundScored=false;room.signals=[];
          room.game=new Chess();room.clocks={w:room.settings.baseMs,b:room.settings.baseMs};room.since=Date.now();
          room.started=false;room.result=null;room.checks={w:0,b:0};room.drawOffer=null;room.rematch={w:false,b:false};
          for(const p of Object.values(room.players))if(p)p.ready=false;
          room.settingsRevision++;room.revision++;
        }
        broadcast(room);return;
      }
      if (room.result) {
        broadcast(room);
        throw Error("เกมจบแล้ว");
      }
      if(m.type==='configure'||m.type==='equip'||m.type==='skills') {
        if(room.started)throw Error('แก้ไขได้เฉพาะก่อนเริ่มประลอง');
        if(m.settingsRevision!==room.settingsRevision){snapshot(room,ws);throw Error('การตั้งค่าห้องเปลี่ยนแล้ว ลองใหม่อีกครั้ง');}
        if(m.type==='configure') {
          if(room.players[peer.color].token!==room.hostToken)throw Error('เฉพาะเจ้าของห้องเท่านั้นที่ตั้งกติกาได้');
          if(room.series.locked)throw Error('กติกาซีรีส์ล็อกจนกว่าจะได้ผู้ชนะ');
          room.settings=roomSettings(m.settings,room.settings);
          room.clocks={w:room.settings.baseMs,b:room.settings.baseMs};
        } else if(m.type==='skills')room.players[peer.color].skills=normalizeTeam(m.skills);
        else room.players[peer.color].cosmetics=normalizeCosmetics(m.cosmetics,peer.color);
        for(const p of Object.values(room.players))if(p)p.ready=false;
        room.settingsRevision++;room.revision++;broadcast(room);return;
      }
      if(m.type==='ready') {
        if(room.started)throw Error('การประลองเริ่มแล้ว');
        if(typeof m.ready!=='boolean')throw Error('สถานะพร้อมไม่ถูกต้อง');
        if(m.settingsRevision!==undefined&&m.settingsRevision!==room.settingsRevision){snapshot(room,ws);throw Error('กติกาหรือสกินเปลี่ยนแล้ว กรุณายืนยันพร้อมอีกครั้ง');}
        room.players[peer.color].ready=m.ready;
        if(['w','b'].every(c=>room.players[c]?.ready&&room.players[c]?.ws?.readyState===WebSocket.OPEN)){
          startGame(room);room.started=true;room.since=Date.now();room.revision++;
        }
        broadcast(room);return;
      }
      if (!room.started) throw Error("รอผู้เล่นอีกฝ่ายและยืนยันพร้อมทั้งคู่");
      if(m.type==='signal') {
        if(!['wellPlayed','niceMove','thinking','rematch','goodLuck'].includes(m.signal))throw Error('สัญญาณไม่ถูกต้อง');
        const p=room.players[peer.color];if(Date.now()-(p.lastSignal||0)<5000)throw Error('รอ 5 วินาทีก่อนส่งสัญญาณถัดไป');
        p.lastSignal=Date.now();room.signals.push({id:randomBytes(6).toString('hex'),color:peer.color,signal:m.signal});room.signals=room.signals.slice(-5);broadcast(room);return;
      }
      if(m.type==='draw') {
        if(!room.settings.allowDraw)throw Error('ห้องนี้ปิดการเสนอเสมอ');
        if(!['offer','accept','decline','cancel'].includes(m.action))throw Error('คำขอเสมอไม่ถูกต้อง');
        if(m.action==='offer') {
          if(room.drawOffer&&room.drawOffer!==peer.color)throw Error('อีกฝ่ายเสนอเสมออยู่แล้ว');
          room.drawOffer=peer.color;
        } else if(m.action==='accept') {
          if(!room.drawOffer||room.drawOffer===peer.color)throw Error('ไม่มีข้อเสนอจากคู่แข่ง');
          room.result={winner:null,reason:'agreement'};room.drawOffer=null;room.revision++;
        } else {
          if(!room.drawOffer || (m.action==='cancel')!==(room.drawOffer===peer.color))throw Error('ไม่มีข้อเสนอที่จัดการได้');
          room.drawOffer=null;
        }
        broadcast(room);return;
      }
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
        if(m.ultimate!==undefined&&typeof m.ultimate!=="boolean")throw Error("สกิลไม่ถูกต้อง");
        if(m.ultimate&&!(room.game instanceof SpecialChess))throw Error("ห้องนี้ไม่ได้เปิดอัลติเมท");
        const beforeResources=room.game instanceof SpecialChess?room.game.snapshot():null;
        const before = room.game.fen();
        let move;
        try {
          move = room.game.move({
            from: m.from,
            to: m.to,
            promotion: m.promotion || "q",
            ...(m.ultimate===true?{ultimate:true}:{}),
          });
        } catch {
          throw Error("เดินผิดกติกา");
        }
        room.clocks[peer.color]=Math.min(7200000,room.clocks[peer.color]+room.settings.increment*1000);
        room.since = Date.now();
        room.drawOffer=null;
        room.revision++;
        room.result=duelOutcome(room.game,room.settings.rule,move,room.checks);
        broadcast(room, {
          before,
          beforeResources,
          ultimate:!!move.ultimate,
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
