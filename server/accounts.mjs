import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes, randomUUID, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
const SESSION_COOKIE = "iahcarus_session";
const SESSION_LIFETIME = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
const skins = new Set(["classic", "ember", "frost", "astral", "royal"]);
const arenas = new Set(["citadel", "ember", "frost", "astral", "storm", "grove", "reactor", "eclipse"]);
const has = (object, key) => Object.hasOwn(object, key);
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const digest = (token) => createHash("sha256").update(token).digest("hex");

class AccountError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const invalid = (message) => { throw new AccountError(400, "INVALID_INPUT", message); };

function username(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_]{3,24}$/.test(value))
    invalid("ชื่อผู้ใช้ต้องมี 3–24 ตัว ใช้ตัวอักษรอังกฤษ ตัวเลข หรือขีดล่าง");
  return value;
}
function password(value) {
  if (typeof value !== "string" || [...value].length < 10 || [...value].length > 128 || Buffer.byteLength(value) > 512)
    invalid("รหัสผ่านต้องมี 10–128 ตัวอักษร");
  return value;
}
export function accountCharacter(value) {
  if (!record(value) || typeof value.name !== "string") invalid("กรุณาสร้างตัวละครก่อนสมัคร");
  const name = value.name.normalize("NFC").trim();
  if ([...name].length < 2 || [...name].length > 24 || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(name))
    invalid("ชื่อตัวละครต้องมี 2–24 ตัวอักษร");
  if (!["crown", "wing", "blade", "prism"].includes(value.crest) ||
      !["cyan", "violet", "amber", "rose"].includes(value.accent) ||
      !["sentinel", "striker", "oracle"].includes(value.silhouette)) invalid("รูปแบบตัวละครไม่ถูกต้อง");
  return { name, crest: value.crest, accent: value.accent, silhouette: value.silhouette };
}

/** Browser-owned cosmetic save backup, never a trusted competitive rating or economy. */
export function cosmeticProgression(value) {
  if (!record(value) || value.version !== 1) invalid("ข้อมูลโปรไฟล์ไม่ถูกต้อง");
  const integer = (key) => {
    const n = value[key];
    if (!Number.isSafeInteger(n) || n < 0 || n > 10_000_000) invalid("ข้อมูลโปรไฟล์ไม่ถูกต้อง");
    return n;
  };
  const xp = integer("xp"), matches = integer("matches"), wins = integer("wins");
  if (wins > matches || !skins.has(value.skin) || !arenas.has(value.arena)) invalid("ข้อมูลโปรไฟล์ไม่ถูกต้อง");
  if (!record(value.loadouts) || !Array.isArray(value.claimed) || value.claimed.length > 1000) invalid("ข้อมูลโปรไฟล์ไม่ถูกต้อง");
  const loadouts = { w: {}, b: {} };
  for (const color of ["w", "b"]) {
    if (!record(value.loadouts[color]) || Object.keys(value.loadouts[color]).length > 64) invalid("ข้อมูลชุดหมากไม่ถูกต้อง");
    for (const [square, skin] of Object.entries(value.loadouts[color])) {
      if (!/^[a-h][1-8]$/.test(square) || !skins.has(skin)) invalid("ข้อมูลชุดหมากไม่ถูกต้อง");
      loadouts[color][square] = skin;
    }
  }
  if (value.claimed.some((id) => typeof id !== "string" || id.length > 100)) invalid("ข้อมูลรางวัลไม่ถูกต้อง");
  return { version: 1, xp, matches, wins, skin: value.skin, arena: value.arena, loadouts, claimed: [...new Set(value.claimed)] };
}

async function jsonBody(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || ""))
    throw new AccountError(415, "JSON_REQUIRED", "คำสั่งนี้ต้องส่งข้อมูล JSON");
  // Drain a rejected body without destroying the socket, so the caller receives the 413 response.
  const chunks = await new Promise((resolveBody, rejectBody) => {
    const parts = [];
    let size = 0, rejected = false;
    req.on("data", (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > 128 * 1024) {
        rejected = true;
        parts.length = 0;
        rejectBody(new AccountError(413, "BODY_TOO_LARGE", "ข้อมูลมีขนาดใหญ่เกินไป"));
      } else parts.push(chunk);
    });
    req.on("end", () => { if (!rejected) resolveBody(parts); });
    req.on("error", rejectBody);
    req.on("aborted", () => rejectBody(new AccountError(400, "INCOMPLETE_BODY", "ส่งข้อมูลไม่ครบถ้วน")));
  });
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!record(value)) throw Error();
    return value;
  } catch {
    invalid("ข้อมูล JSON ไม่ถูกต้อง");
  }
}

/** Same-origin account API. Passwords and session tokens are never stored in plaintext. */
export function createAccountAPI(options = {}) {
  const databasePath = options.databasePath ?? process.env.ACCOUNT_DB_PATH ?? resolve("data", "accounts.sqlite");
  const now = options.now ?? Date.now;
  const secure = options.secureCookies ?? (process.env.ACCOUNT_COOKIE_SECURE === "true" ||
    (process.env.ACCOUNT_COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production"));
  const originOption = options.publicOrigin ?? process.env.ACCOUNT_PUBLIC_ORIGIN;
  let publicOrigin;
  if (originOption) {
    const parsed = new URL(originOption);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash)
      throw Error("ACCOUNT_PUBLIC_ORIGIN must be an HTTP(S) origin without a path");
    publicOrigin = parsed.origin;
  }
  if (databasePath !== ":memory:") mkdirSync(dirname(resolve(databasePath)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath);
  if (databasePath !== ":memory:") chmodSync(databasePath, 0o600);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      username_key TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      character_json TEXT NOT NULL,
      progression_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account_sessions (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS account_session_expiry ON account_sessions(expires_at);
  `);
  const findUsername = db.prepare("SELECT * FROM accounts WHERE username_key = ?");
  const insertAccount = db.prepare(`INSERT INTO accounts
    (id, username, username_key, password_salt, password_hash, character_json, progression_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertSession = db.prepare("INSERT INTO account_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)");
  const removeSession = db.prepare("DELETE FROM account_sessions WHERE token_hash = ?");
  const findSession = db.prepare(`SELECT a.*, s.expires_at FROM account_sessions s
    JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?`);
  const updateProfile = db.prepare("UPDATE accounts SET character_json = ?, progression_json = ?, updated_at = ? WHERE id = ?");
  const expireSessions = db.prepare("DELETE FROM account_sessions WHERE expires_at <= ?");
  const dummySalt = randomBytes(16).toString("hex");
  const dummyHash = scryptSync(randomBytes(32), dummySalt, 64, PASSWORD_OPTIONS);
  const limits = new Map();
  let passwordJobs = 0, lastPrune = 0;

  function send(res, status, data, cookie) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    });
    res.end(JSON.stringify({ available: true, ...data }));
  }
  function cookie(token, lifetime = SESSION_LIFETIME) {
    return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(lifetime / 1000))}${secure ? "; Secure" : ""}`;
  }
  function requestToken(req) {
    const raw = req.headers.cookie;
    if (typeof raw !== "string" || raw.length > 4096) return null;
    const match = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(SESSION_COOKIE + "="));
    const token = match?.slice(SESSION_COOKIE.length + 1);
    return typeof token === "string" && /^[a-f0-9]{64}$/.test(token) ? token : null;
  }
  function session(req) {
    const token = requestToken(req);
    if (!token) return null;
    const row = findSession.get(digest(token));
    if (!row) return null;
    if (row.expires_at <= now()) { removeSession.run(digest(token)); return null; }
    return row;
  }
  function user(row) {
    return row ? {
      id: row.id, username: row.username, character: JSON.parse(row.character_json),
      progression: row.progression_json ? JSON.parse(row.progression_json) : null,
    } : null;
  }
  function sameOrigin(req) {
    let expected = publicOrigin;
    if (!expected) {
      try { expected = new URL(`${req.socket.encrypted ? "https" : "http"}://${req.headers.host}`).origin; }
      catch { throw new AccountError(403, "ORIGIN_REJECTED", "คำสั่งต้องมาจากเกมบนเว็บไซต์เดียวกัน"); }
    }
    if (req.headers.origin !== expected || ["cross-site", "same-site"].includes(req.headers["sec-fetch-site"]))
      throw new AccountError(403, "ORIGIN_REJECTED", "คำสั่งต้องมาจากเกมบนเว็บไซต์เดียวกัน");
  }
  function limit(req, name) {
    const time = now();
    if (time - lastPrune > 60_000) {
      for (const [key, value] of limits) if (value.until <= time) limits.delete(key);
      expireSessions.run(time);
      lastPrune = time;
    }
    // X-Forwarded-For is deliberately not trusted. Apply the host's edge rate limit as well.
    const ip = req.socket.remoteAddress || "unknown";
    const keys = [[`ip:${ip}`, 60], [`pair:${ip}:${name.toLowerCase()}`, 10]];
    for (const [key, maximum] of keys) {
      const old = limits.get(key);
      const value = old && old.until > time ? old : { attempts: 0, until: time + 15 * 60_000 };
      if (value.attempts >= maximum || limits.size > 10_000)
        throw new AccountError(429, "TOO_MANY_ATTEMPTS", "ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอ 15 นาที");
      value.attempts++;
      limits.set(key, value);
    }
  }
  async function passwordKey(secret, salt) {
    if (passwordJobs >= 4) throw new AccountError(503, "AUTH_BUSY", "ระบบบัญชีกำลังทำงาน กรุณาลองอีกครั้ง");
    passwordJobs++;
    try { return await derive(secret, salt, 64, PASSWORD_OPTIONS); }
    finally { passwordJobs--; }
  }
  function newSession(req, accountId) {
    const previous = requestToken(req);
    if (previous) removeSession.run(digest(previous));
    const token = randomBytes(32).toString("hex");
    insertSession.run(digest(token), accountId, now() + SESSION_LIFETIME);
    return cookie(token);
  }

  async function handle(req, res) {
    let path;
    try { path = new URL(req.url, "http://localhost").pathname; } catch { return false; }
    if (!path.startsWith("/api/account/")) return false;
    try {
      if (path === "/api/account/me" && req.method === "GET") {
        const row = session(req);
        send(res, 200, { user: user(row) }, !row && requestToken(req) ? cookie("", 0) : undefined);
        return true;
      }
      const methods = {
        "/api/account/register": "POST", "/api/account/login": "POST",
        "/api/account/logout": "POST", "/api/account/profile": "PUT",
      };
      if (!has(methods, path)) throw new AccountError(404, "NOT_FOUND", "ไม่พบคำสั่งนี้");
      if (req.method !== methods[path]) throw new AccountError(405, "METHOD_NOT_ALLOWED", "วิธีส่งคำสั่งไม่ถูกต้อง");
      sameOrigin(req);
      const body = await jsonBody(req);
      if (path === "/api/account/logout") {
        const token = requestToken(req);
        if (token) removeSession.run(digest(token));
        send(res, 200, { user: null }, cookie("", 0));
        return true;
      }
      if (path === "/api/account/profile") {
        const row = session(req);
        if (!row) throw new AccountError(401, "AUTH_REQUIRED", "กรุณาเข้าสู่ระบบก่อนบันทึกโปรไฟล์");
        if (!has(body, "character") && !has(body, "progression")) invalid("ไม่มีข้อมูลโปรไฟล์ที่จะบันทึก");
        const character = has(body, "character") ? accountCharacter(body.character) : JSON.parse(row.character_json);
        const progression = has(body, "progression") ? cosmeticProgression(body.progression) : row.progression_json ? JSON.parse(row.progression_json) : null;
        updateProfile.run(JSON.stringify(character), progression ? JSON.stringify(progression) : null, now(), row.id);
        send(res, 200, { user: { id: row.id, username: row.username, character, progression } });
        return true;
      }
      const name = username(body.username), secret = password(body.password);
      limit(req, name);
      if (path === "/api/account/register") {
        const character = accountCharacter(body.character);
        const progression = has(body, "progression") ? cosmeticProgression(body.progression) : null;
        if (findUsername.get(name.toLowerCase())) throw new AccountError(409, "USERNAME_TAKEN", "ชื่อผู้ใช้นี้ถูกใช้แล้ว");
        const salt = randomBytes(16).toString("hex");
        const hash = (await passwordKey(secret, salt)).toString("hex");
        const id = randomUUID();
        try { insertAccount.run(id, name, name.toLowerCase(), salt, hash, JSON.stringify(character), progression ? JSON.stringify(progression) : null, now(), now()); }
        catch (error) {
          if (error.code === "ERR_SQLITE_ERROR" && findUsername.get(name.toLowerCase()))
            throw new AccountError(409, "USERNAME_TAKEN", "ชื่อผู้ใช้นี้ถูกใช้แล้ว");
          throw error;
        }
        send(res, 201, { user: { id, username: name, character, progression } }, newSession(req, id));
        return true;
      }
      const row = findUsername.get(name.toLowerCase());
      const hash = await passwordKey(secret, row?.password_salt || dummySalt);
      const expected = row ? Buffer.from(row.password_hash, "hex") : dummyHash;
      if (!timingSafeEqual(hash, expected) || !row)
        throw new AccountError(401, "INVALID_CREDENTIALS", "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      send(res, 200, { user: user(row) }, newSession(req, row.id));
      return true;
    } catch (error) {
      const safe = error instanceof AccountError;
      send(res, safe ? error.status : 500, {
        error: safe ? error.code : "ACCOUNT_ERROR",
        message: safe ? error.message : "ระบบบัญชีไม่สามารถทำงานได้ กรุณาลองอีกครั้ง",
      });
      return true;
    }
  }
  function identity(req) {
    // A WebSocket opened by another website must not inherit an account name via its cookie.
    try { sameOrigin(req); } catch { return null; }
    const row = session(req);
    return row ? { name: JSON.parse(row.character_json).name, username: row.username } : null;
  }
  return { handle, identity, close: () => db.close(), databasePath };
}
