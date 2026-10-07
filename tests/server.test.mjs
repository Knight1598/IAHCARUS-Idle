import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { WebSocket } from "ws";
async function start(t, clock = "300000") {
  const child = spawn(process.execPath, ["server/index.mjs"], {
    env: { ...process.env, PORT: "0", CHESS_CLOCK_MS: clock },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let err = "";
  child.stderr.on("data", (d) => (err += d));
  t.after(() => child.kill());
  const port = await new Promise((res, rej) => {
    const timer = setTimeout(
      () => rej(Error("server startup timed out " + err)),
      5000,
    );
    child.stdout.on("data", (d) => {
      const m = String(d).match(/port (\d+)/);
      if (m) {
        clearTimeout(timer);
        res(Number(m[1]));
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      rej(Error("server exited " + code + " " + err));
    });
  });
  return {
    port,
    connect: async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      const messages = [],
        waiters = [];
      ws.on("message", (raw) => {
        const m = JSON.parse(raw);
        messages.push(m);
        for (const w of [...waiters])
          if (w.predicate(m)) {
            clearTimeout(w.timer);
            waiters.splice(waiters.indexOf(w), 1);
            w.resolve(m);
          }
      });
      await once(ws, "open");
      t.after(() => ws.close());
      return {
        ws,
        send: (m) => ws.send(JSON.stringify(m)),
        wait: (predicate) => {
          const existing = messages.find(predicate);
          if (existing) return Promise.resolve(existing);
          return new Promise((resolve, reject) => {
            const timer = setTimeout(
              () =>
                reject(Error("message timeout: " + JSON.stringify(messages))),
              4000,
            );
            waiters.push({ predicate, resolve, timer });
          });
        },
      };
    },
  };
}
test("server owns rooms, legal turns, reconnect, history and resignation", async (t) => {
  const s = await start(t);
  assert.equal(
    (await (await fetch(`http://127.0.0.1:${s.port}/health`)).json()).ok,
    true,
  );
  const a = await s.connect();
  a.send({ type: "create" });
  const session = await a.wait((m) => m.type === "session");
  const code = session.code;
  a.send({ type: "move", from: "e2", to: "e4", revision: 0 });
  assert.match((await a.wait((m) => m.type === "error")).message, /รอผู้เล่น/);
  const b = await s.connect();
  b.send({ type: "join", code });
  const initial = await b.wait((m) => m.type === "state" && m.started);
  assert.equal(initial.color, "b");
  b.send({ type: "move", from: "e7", to: "e5", revision: initial.revision });
  assert.match(
    (await b.wait((m) => m.type === "error")).message,
    /ยังไม่ใช่ตา/,
  );
  a.send({ type: "move", from: "e2", to: "e5", revision: initial.revision });
  assert.match(
    (await a.wait((m) => m.type === "error" && m.message.includes("กติกา")))
      .message,
    /กติกา/,
  );
  a.send({ type: "move", from: "e2", to: "e4", revision: initial.revision });
  const moved = await b.wait(
    (m) => m.type === "state" && m.history.length === 1,
  );
  assert.deepEqual(moved.history, ["e4"]);
  b.send({ type: "move", from: "e7", to: "e5", revision: initial.revision });
  await b.wait((m) => m.type === "error" && m.message.includes("กระดาน"));
  b.send({ type: "move", from: "e7", to: "e5", revision: moved.revision });
  await a.wait((m) => m.type === "state" && m.history.length === 2);
  a.ws.close();
  await once(a.ws, "close");
  const resumed = await s.connect();
  resumed.send({ type: "resume", code, token: session.token });
  const restored = await resumed.wait((m) => m.type === "state");
  assert.deepEqual(restored.history, ["e4", "e5"]);
  assert.equal(restored.color, "w");
  const intruder = await s.connect();
  intruder.send({ type: "resume", code, token: "invalid" });
  await intruder.wait((m) => m.type === "error");
  intruder.send({ type: "join", code });
  await intruder.wait((m) => m.type === "error" && m.message.includes("ครบ"));
  resumed.send({ type: "resign" });
  const ended = await b.wait((m) => m.type === "state" && m.result);
  assert.deepEqual(ended.result, { winner: "b", reason: "resign" });
});
test("server declares timeout independent of visual animations", async (t) => {
  const s = await start(t, "100");
  const a = await s.connect();
  a.send({ type: "create" });
  const { code } = await a.wait((m) => m.type === "session");
  const b = await s.connect();
  b.send({ type: "join", code });
  const ended = await b.wait((m) => m.type === "state" && m.result);
  assert.deepEqual(ended.result, { winner: "b", reason: "timeout" });
  assert.equal(ended.clocks.w, 0);
});

test('online checkmate stops further moves and matches both clients', async t => {
  const s = await start(t);
  const a = await s.connect();
  a.send({ type: 'create' });
  const { code } = await a.wait(m => m.type === 'session');
  const b = await s.connect();
  b.send({ type: 'join', code });
  let snapshot = await a.wait(m => m.type === 'state' && m.started);
  const moves = [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']];
  for (let i=0;i<moves.length;i++) {
    const actor = i % 2 ? b : a;
    actor.send({ type:'move', from:moves[i][0], to:moves[i][1], revision:snapshot.revision });
    snapshot = await a.wait(m => m.type === 'state' && m.history.length === i+1);
  }
  assert.deepEqual(snapshot.result, { winner:'b', reason:'checkmate' });
  const other = await b.wait(m => m.type === 'state' && m.result);
  assert.equal(other.fen, snapshot.fen);
  a.send({ type:'move', from:'e2', to:'e4', revision:snapshot.revision });
  assert.match((await a.wait(m => m.type === 'error')).message, /เกมจบ/);
});
