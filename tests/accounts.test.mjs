import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { WebSocket } from "ws";
import { createAccountAPI } from "../server/accounts.mjs";

const character = { name: "ผู้พิทักษ์", crest: "crown", accent: "cyan", silhouette: "sentinel" };
const progression = {
  version: 1, xp: 630, matches: 8, wins: 5, skin: "royal", arena: "eclipse",
  loadouts: { w: { a1: "frost", b1: "astral" }, b: { h8: "ember" } }, claimed: ["match-a", "daily-b"],
};
const password = "Strong test password 42!";
const cookieFrom = (response) => response.headers.get("set-cookie")?.split(";")[0];

async function host(t, options = {}) {
  const directory = options.directory ?? await mkdtemp(join(tmpdir(), "iahcarus-accounts-"));
  const api = createAccountAPI({ databasePath: join(directory, "accounts.sqlite"), ...options });
  const server = createServer(async (req, res) => {
    if (!await api.handle(req, res)) { res.writeHead(404); res.end(); }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await new Promise((resolve) => { server.close(resolve); server.closeIdleConnections(); });
    api.close();
  }
  t.after(close);
  if (!options.directory) t.after(() => rm(directory, { recursive: true, force: true }));
  async function request(path, { method = "GET", body, cookie, headers = {} } = {}) {
    const response = await fetch(origin + "/api/account/" + path, {
      method,
      headers: {
        ...(method === "GET" ? {} : { Origin: origin, "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}), ...headers,
      },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    return { response, status: response.status, body: await response.json(), cookie: cookieFrom(response) };
  }
  async function register(name = "PlayerOne", fields = {}) {
    return request("register", { method: "POST", body: { username: name, password, character, ...fields } });
  }
  return { request, register, directory, close, origin };
}

test("real account registration creates a durable salted password and opaque HttpOnly session", async (t) => {
  const h = await host(t);
  assert.deepEqual((await h.request("me")).body, { available: true, user: null });
  const a = await h.register();
  assert.equal(a.status, 201);
  assert.equal(a.body.user.username, "PlayerOne");
  assert.deepEqual(a.body.user.character, character);
  assert.equal(a.body.user.progression, null);
  assert.deepEqual(Object.keys(a.body.user).sort(), ["character", "id", "progression", "username"]);
  assert.match(a.response.headers.get("set-cookie"), /HttpOnly; SameSite=Strict; Max-Age=604800/);
  assert.doesNotMatch(a.response.headers.get("set-cookie"), /Secure/);
  assert.equal(a.response.headers.get("cache-control"), "no-store");
  assert.equal((await h.request("me", { cookie: a.cookie })).body.user.id, a.body.user.id);
  const db = new DatabaseSync(join(h.directory, "accounts.sqlite"));
  const account = db.prepare("SELECT * FROM accounts").get();
  assert.notEqual(account.password_hash, password);
  assert.match(account.password_salt, /^[a-f0-9]{32}$/);
  assert.match(account.password_hash, /^[a-f0-9]{128}$/);
  const session = db.prepare("SELECT token_hash FROM account_sessions").get();
  assert.match(session.token_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(session.token_hash, a.cookie.split("=")[1]);
  db.close();
  assert.equal((await readFile(join(h.directory, "accounts.sqlite"))).includes(Buffer.from(password)), false);
});

test("username uniqueness is case insensitive and authentication errors do not expose account existence", async (t) => {
  const h = await host(t);
  await h.register();
  const duplicate = await h.register("pLaYeRoNe");
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error, "USERNAME_TAKEN");
  const wrong = await h.request("login", { method: "POST", body: { username: "PlayerOne", password: "incorrect password" } });
  const absent = await h.request("login", { method: "POST", body: { username: "NobodyHere", password: "incorrect password" } });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.body, absent.body);
  assert.equal(wrong.cookie, undefined);
  const valid = await h.request("login", { method: "POST", body: { username: "playerone", password } });
  assert.equal(valid.status, 200);
  assert.equal(valid.body.user.username, "PlayerOne");
});

test("registration optionally copies an explicitly selected cosmetic save atomically", async (t) => {
  const h = await host(t);
  const malformed = await h.register("CopyProfile", { progression: { ...progression, xp: -1 } });
  assert.equal(malformed.status, 400);
  const account = await h.register("CopyProfile", { progression });
  assert.equal(account.status, 201, "invalid profile must not create a partial account");
  assert.deepEqual(account.body.user.progression, progression);
  const me = await h.request("me", { cookie: account.cookie });
  assert.deepEqual(me.body.user.progression, progression);
});

test("login rotates the current session and logout revokes it on the server", async (t) => {
  const h = await host(t);
  const initial = await h.register();
  const next = await h.request("login", { method: "POST", body: { username: "PlayerOne", password }, cookie: initial.cookie });
  assert.notEqual(next.cookie, initial.cookie);
  assert.equal((await h.request("me", { cookie: initial.cookie })).body.user, null);
  assert.equal((await h.request("me", { cookie: next.cookie })).body.user.username, "PlayerOne");
  const logout = await h.request("logout", { method: "POST", body: {}, cookie: next.cookie });
  assert.equal(logout.status, 200);
  assert.match(logout.response.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await h.request("me", { cookie: next.cookie })).body.user, null);
  assert.equal((await h.request("profile", { method: "PUT", body: { character }, cookie: next.cookie })).status, 401);
});

test("character and cosmetic save persist across server restart with multiuser isolation", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "iahcarus-account-restart-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = await host(t, { directory });
  const a = await first.register("CommanderA");
  const b = await first.register("CommanderB");
  const changed = { name: "Oracle", crest: "prism", accent: "violet", silhouette: "oracle" };
  const save = await first.request("profile", { method: "PUT", cookie: a.cookie, body: { character: changed, progression, id: b.body.user.id } });
  assert.equal(save.status, 200);
  assert.equal(save.body.user.id, a.body.user.id);
  assert.deepEqual(save.body.user.progression, progression);
  assert.deepEqual((await first.request("me", { cookie: b.cookie })).body.user.character, character);
  assert.equal((await first.request("me", { cookie: b.cookie })).body.user.progression, null);
  await first.close();
  const second = await host(t, { directory });
  const restored = await second.request("me", { cookie: a.cookie });
  assert.equal(restored.body.user.id, a.body.user.id);
  assert.deepEqual(restored.body.user.character, changed);
  assert.deepEqual(restored.body.user.progression, progression);
  assert.deepEqual((await second.request("me", { cookie: b.cookie })).body.user.character, character);
  const login = await second.request("login", { method: "POST", body: { username: "Commandera", password } });
  assert.equal(login.status, 200);
  assert.deepEqual(login.body.user.progression, progression);
});

test("CSRF origin checks and JSON requirement reject browser form and cross-origin writes", async (t) => {
  const h = await host(t);
  const account = await h.register();
  for (const headers of [{ Origin: "https://attacker.example" }, { Origin: "null" }, { Origin: "" }, { "Sec-Fetch-Site": "cross-site" }]) {
    const rejected = await h.request("profile", { method: "PUT", body: { character: { ...character, name: "Attacker" } }, cookie: account.cookie, headers });
    assert.equal(rejected.status, 403);
    assert.equal(rejected.body.error, "ORIGIN_REJECTED");
  }
  const form = await h.request("login", { method: "POST", body: "username=PlayerOne", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  assert.equal(form.status, 415);
  assert.deepEqual((await h.request("me", { cookie: account.cookie })).body.user.character, character);
});

test("production HTTPS origin and Secure cookie are explicit without trusting forwarded headers", async (t) => {
  const h = await host(t, { secureCookies: true, publicOrigin: "https://game.example" });
  const rejected = await h.register();
  assert.equal(rejected.status, 403);
  const accepted = await h.request("register", { method: "POST", headers: { Origin: "https://game.example" }, body: { username: "PlayerOne", password, character } });
  assert.equal(accepted.status, 201);
  assert.match(accepted.response.headers.get("set-cookie"), /; Secure$/);
});

test("expired sessions lose authentication even before database cleanup", async (t) => {
  let now = 1_800_000_000_000;
  const h = await host(t, { now: () => now });
  const account = await h.register();
  now += 7 * 24 * 60 * 60 * 1000 + 1;
  const expired = await h.request("me", { cookie: account.cookie });
  assert.equal(expired.body.user, null);
  assert.match(expired.response.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await h.request("profile", { method: "PUT", cookie: account.cookie, body: { character } })).status, 401);
});

test("bounded validation rejects malformed names passwords characters and JSON", async (t) => {
  const h = await host(t);
  for (const fields of [
    { username: "a" }, { username: "../../outside" }, { password: "short" }, { password: "x".repeat(129) },
    { character: { ...character, name: "a" } }, { character: { ...character, name: "x".repeat(25) } },
    { character: { ...character, silhouette: "admin" } }, { character: { ...character, accent: "constructor" } },
  ]) assert.equal((await h.register("PlayerOne", fields)).status, 400);
  assert.equal((await h.request("register", { method: "POST", body: "not json" })).status, 400);
  assert.equal((await h.request("register", { method: "POST", body: "[]" })).status, 400);
  const oversized = await h.request("register", { method: "POST", body: JSON.stringify({ username: "LargeBody", password, character, extra: "x".repeat(128 * 1024) }) });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.body.error, "BODY_TOO_LARGE");
  assert.equal((await h.request("me")).status, 200, "rejected bodies must not disable the API");
  const accepted = await h.register("GoodPlayer", { character: { ...character, name: "  เจ้ากระดาน  " } });
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.user.character.name, "เจ้ากระดาน");
});

test("profile validates bounded cosmetic fields and discards untrusted extra properties", async (t) => {
  const h = await host(t);
  const account = await h.register();
  for (const bad of [
    { ...progression, xp: -1 }, { ...progression, xp: 10_000_001 }, { ...progression, wins: 9 },
    { ...progression, skin: "administrator" }, { ...progression, loadouts: { w: { z9: "classic" }, b: {} } },
    { ...progression, claimed: Array(1001).fill("a") },
  ]) assert.equal((await h.request("profile", { method: "PUT", cookie: account.cookie, body: { progression: bad } })).status, 400);
  const result = await h.request("profile", { method: "PUT", cookie: account.cookie, body: { progression: { ...progression, password, admin: true }, character: { ...character, admin: true } } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.user.progression, progression);
  assert.deepEqual(result.body.user.character, character);
  assert.equal(JSON.stringify(result.body).includes(password), false);
});

test("authentication attempts are rate limited per IP and username", async (t) => {
  const h = await host(t);
  for (let i = 0; i < 10; i++) {
    const failed = await h.request("login", { method: "POST", body: { username: "RateLimited", password } });
    assert.equal(failed.status, 401);
  }
  const limited = await h.request("login", { method: "POST", body: { username: "RateLimited", password } });
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error, "TOO_MANY_ATTEMPTS");
});

test("production account routes supply authenticated PvP names and preserve them through reconnect", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "iahcarus-account-server-"));
  const child = spawn(process.execPath, ["server/index.mjs"], {
    env: { ...process.env, PORT: "0", ACCOUNT_DB_PATH: join(directory, "accounts.sqlite"), NODE_ENV: "test", ACCOUNT_COOKIE_SECURE: "false", ACCOUNT_PUBLIC_ORIGIN: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (data) => { stderr += data; });
  t.after(async () => {
    child.kill();
    if (child.exitCode === null && child.signalCode === null) await once(child, "exit");
    await rm(directory, { recursive: true, force: true });
  });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Account server startup timed out: " + stderr)), 5000);
    child.stdout.on("data", (data) => {
      const match = String(data).match(/port (\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    child.on("exit", (code) => { clearTimeout(timer); reject(Error("Server exited " + code + " " + stderr)); });
  });
  const origin = `http://127.0.0.1:${port}`;
  assert.equal((await (await fetch(origin + "/health")).json()).ok, true);
  assert.deepEqual(await (await fetch(origin + "/api/account/me")).json(), { available: true, user: null });
  const registered = await fetch(origin + "/api/account/register", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "ProductionPlayer", password, character }),
  });
  assert.equal(registered.status, 201);
  const registeredUser = (await registered.json()).user;
  assert.equal(registeredUser.username, "ProductionPlayer");
  const me = await fetch(origin + "/api/account/me", { headers: { Cookie: cookieFrom(registered) } });
  assert.equal((await me.json()).user.username, "ProductionPlayer");
  async function connect(cookie, originHeader = origin) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: { Origin: originHeader, ...(cookie ? { Cookie: cookie } : {}) },
    });
    const messages = [], waiters = [];
    ws.on("error", () => {});
    ws.on("message", (raw) => {
      const value = JSON.parse(raw.toString()); messages.push(value);
      for (const waiter of [...waiters]) if (waiter.predicate(value)) {
        clearTimeout(waiter.timeout); waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(value);
      }
    });
    await once(ws, "open");
    t.after(() => ws.close());
    return {
      ws, send: (message) => ws.send(JSON.stringify(message)),
      wait: (predicate) => {
        const value = messages.find(predicate);
        if (value) return Promise.resolve(value);
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(Error("Room state timed out")), 3000);
          waiters.push({ predicate, timeout, resolve });
        });
      },
    };
  }
  const authenticated = await connect(cookieFrom(registered));
  authenticated.send({ type: "create", identity: { name: "Spoofed", username: "Administrator" }, name: "Spoofed" });
  const room = await authenticated.wait((value) => value.type === "session");
  const initial = await authenticated.wait((value) => value.type === "state");
  assert.deepEqual(initial.players, { w: { name: character.name, username: "ProductionPlayer" }, b: null });
  assert.equal(JSON.stringify(initial).includes(registeredUser.id), false);
  assert.equal(JSON.stringify(initial).includes(cookieFrom(registered).split("=")[1]), false);
  const guest = await connect();
  guest.send({ type: "join", code: room.code, identity: { name: "Spoofed Guest" }, name: "Spoofed Guest" });
  const joined = await guest.wait((value) => value.type === "state" && value.started);
  assert.deepEqual(joined.players, initial.players);
  const renamed = await fetch(origin + "/api/account/profile", {
    method: "PUT", headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookieFrom(registered) },
    body: JSON.stringify({ character: { ...character, name: "New Character" } }),
  });
  assert.equal(renamed.status, 200);
  authenticated.ws.close();
  await once(authenticated.ws, "close");
  const resumed = await connect(cookieFrom(registered));
  resumed.send({ type: "resume", code: room.code, token: room.token, name: "Spoofed Resume" });
  const restored = await resumed.wait((value) => value.type === "state");
  assert.deepEqual(restored.players, initial.players, "a reconnect preserves the room's original public names");
  const crossSite = await connect(cookieFrom(registered), "https://attacker.example");
  crossSite.send({ type: "create" });
  assert.deepEqual((await crossSite.wait((value) => value.type === "state")).players, { w: null, b: null });
});
