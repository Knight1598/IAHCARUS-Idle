import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";

const directory = mkdtempSync(join(tmpdir(), "special-chess-player-"));
const child = spawn(process.execPath, ["server/index.mjs"], {
  env: { ...process.env, PORT: "0", ACCOUNT_DB_PATH: join(directory, "accounts.sqlite"), ACCOUNT_COOKIE_SECURE: "false", ACCOUNT_PUBLIC_ORIGIN: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
try {
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("account test server startup timed out")), 5000);
    child.stdout.on("data", bytes => { const match = String(bytes).match(/port (\d+)/); if (match) { clearTimeout(timer); resolve(Number(match[1])); } });
    child.once("error", reject);
    child.once("exit", code => { clearTimeout(timer); reject(Error(`account server exited ${code}`)); });
  });
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH || existsSync("/usr/bin/chromium") ? { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" } : {}),
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  mkdirSync("test-results", { recursive: true });
  const errors = [], offline = await browser.newContext({ offline: true, viewport: { width: 1200, height: 850 } });
  await offline.addInitScript(() => localStorage.setItem("special-chess-graphics-quality", "low"));
  const page = await offline.newPage(); page.on("pageerror", error => errors.push(error.message));
  let accountRequests = 0;
  page.on("request", request => { if (request.url().includes("/api/account/")) accountRequests++; });
  const url = "http://localhost:31473/player-test";
  await page.route(url, route => route.fulfill({ contentType: "text/html", body: readFileSync("offline/Special-Chess-Offline.html", "utf8") }));
  await page.goto(url); await page.locator("#player-create-title").click();
  assert.equal(await page.locator('[data-player-tab="account"]').isVisible(), false);
  assert.match(await page.locator("#player-storage-note").innerText(), /GitHub Pages/);
  assert.equal(await page.locator("[data-player-silhouette]").count(), 3);
  assert.equal(await page.locator("[data-player-crest]").count(), 4);
  assert.equal(await page.locator("[data-player-accent]").count(), 4);
  await page.locator("#player-name").fill("A<svg/onload=1>");
  await page.locator('[data-player-silhouette="oracle"]').click();
  await page.locator('[data-player-crest="prism"]').click();
  await page.locator('[data-player-accent="violet"]').click();
  assert.equal(await page.locator("#player-preview-name").innerText(), "A<svg/onload=1>");
  assert.equal(await page.locator("#player-preview-name svg").count(), 0);
  assert.match(await page.locator("#player-portrait svg").getAttribute("style"), /ae92ff/);
  assert.equal(await page.evaluate(() => localStorage.getItem("special-chess-player-v1")), null);
  await page.locator("#player-save").click();
  const character = await page.evaluate(() => JSON.parse(localStorage.getItem("special-chess-player-v1")));
  assert.deepEqual(character, { name: "A<svg/onload=1>", silhouette: "oracle", crest: "prism", accent: "violet" });
  assert.equal(await page.locator("#player-entry strong").innerText(), character.name);
  assert.equal(await page.locator("#player-entry span svg").count(), 0);
  await page.locator("#player-close").click(); await page.reload(); await page.locator("#player-entry").click();
  assert.equal(await page.locator("#player-profile-card strong").first().innerText(), character.name);
  await page.locator("#player-edit").click();
  await page.locator("#player-name").fill("Arc Sentinel");
  await page.locator('[data-player-silhouette="sentinel"]').click();
  await page.locator('[data-player-crest="wing"]').click();
  await page.locator('[data-player-accent="cyan"]').click();
  for (const viewport of [{ width: 1200, height: 850 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const bounds = await page.locator("#player-dialog").boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-results/player-character-${viewport.width}.png` });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator(".player-window").evaluate(node => getComputedStyle(node).animationName), "none");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#player-dialog").getAttribute("open"), null);
  assert.equal(accountRequests, 0, "offline identity must not request a server");
  await offline.close();
  console.log("PASS: original geometric character creation, live choices, safe text, local persistence, mobile layouts and reduced motion without any account request offline");

  const online = await browser.newContext({ viewport: { width: 1200, height: 850 } });
  await online.addInitScript(() => localStorage.setItem("special-chess-graphics-quality", "low"));
  const accountPage = await online.newPage(); accountPage.on("pageerror", error => errors.push(error.message));
  const base = `http://127.0.0.1:${port}`;
  await accountPage.goto(base); await accountPage.locator("#player-create-title").click();
  await accountPage.locator("#player-name").fill("Arc Sentinel");
  await accountPage.locator("#player-save").click();
  await accountPage.locator('[data-player-tab="account"]').waitFor({ state: "visible" });
  await accountPage.locator('[data-player-tab="account"]').click();
  await accountPage.locator("#player-username").fill("Arc_Player");
  await accountPage.locator("#player-password").fill("short");
  await accountPage.locator("#player-auth-submit").click();
  assert.match(await accountPage.locator("#player-status").innerText(), /10–128/);
  await accountPage.locator("#player-password").fill("Geometric-Duel-2026");
  await accountPage.locator("#player-auth-submit").click();
  await accountPage.waitForFunction(() => document.querySelector("#player-profile-card")?.textContent.includes("@Arc_Player"));
  assert.equal(await accountPage.locator("#player-password").inputValue(), "");
  const cookies = await online.cookies();
  assert.ok(cookies.some(cookie => cookie.httpOnly), "session must use HttpOnly cookie");
  assert.equal(await accountPage.evaluate(() => document.cookie), "");
  assert.equal(await accountPage.evaluate(() => JSON.stringify(localStorage).includes("Geometric-Duel-2026")), false);
  assert.equal(await accountPage.locator("#player-cloud-load").isEnabled(), true, "explicit registration copy stores progression");
  console.log("PASS: registration validation, real HttpOnly account session and explicit local profile copy");
  await accountPage.locator("#player-edit").click();
  await accountPage.locator("#player-name").fill("Neon Oracle");
  await accountPage.locator('[data-player-silhouette="oracle"]').click();
  await accountPage.locator('[data-player-accent="rose"]').click();
  await accountPage.locator("#player-save").click();
  await accountPage.waitForFunction(() => document.querySelector("#player-status")?.textContent.includes("บันทึกตัวละครลงบัญชีแล้ว"));
  await accountPage.locator("#player-close").click(); await accountPage.reload(); await accountPage.locator("#player-entry").click();
  await accountPage.waitForFunction(() => document.querySelector("#player-entry strong")?.textContent === "Neon Oracle");
  const saved = await accountPage.evaluate(async () => (await fetch("/api/account/me")).json());
  assert.equal(saved.user.character.silhouette, "oracle"); assert.equal(saved.user.character.accent, "rose");
  const backup = { version: 1, xp: 200, matches: 7, wins: 3, skin: "ember", arena: "citadel", loadouts: { w: {}, b: {} }, claimed: ["player-backup-test"] };
  await accountPage.evaluate(async progression => {
    const response = await fetch("/api/account/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ progression }) });
    if (!response.ok) throw Error(`profile backup failed ${response.status}`);
  }, backup);
  await accountPage.locator("#player-close").click(); await accountPage.reload(); await accountPage.locator("#player-entry").click();
  await accountPage.waitForFunction(() => !document.querySelector("#player-cloud-load").disabled);
  assert.equal(await accountPage.evaluate(() => JSON.parse(localStorage.getItem("special-chess-profile") || "{}").xp || 0), 0, "account restore must not silently replace local progress");
  await accountPage.locator("#player-cloud-load").click();
  assert.equal(await accountPage.evaluate(() => JSON.parse(localStorage.getItem("special-chess-profile")).xp), 200);
  assert.match(await accountPage.locator("#player-profile-card").innerText(), /200/);
  await accountPage.locator("#player-cloud-save").click();
  await accountPage.waitForFunction(() => document.querySelector("#player-status")?.textContent.includes("บันทึกสกินและสถิติลงบัญชีแล้ว"));
  await accountPage.locator("#player-logout").click();
  await accountPage.waitForFunction(() => document.querySelector("#player-entry strong")?.textContent === "Arc Sentinel");
  await accountPage.locator('[data-player-tab="account"]').click();
  await accountPage.locator('[data-player-auth="login"]').click();
  await accountPage.locator("#player-username").fill("Arc_Player");
  await accountPage.locator("#player-password").fill("Incorrect-Password");
  await accountPage.locator("#player-auth-submit").click();
  await accountPage.waitForFunction(() => document.querySelector("#player-status")?.classList.contains("error"));
  assert.match(await accountPage.locator("#player-status").innerText(), /ไม่ถูกต้อง/);
  await accountPage.locator("#player-password").fill("Geometric-Duel-2026");
  await accountPage.locator("#player-auth-submit").click();
  await accountPage.waitForFunction(() => document.querySelector("#player-entry strong")?.textContent === "Neon Oracle");
  assert.equal(await accountPage.evaluate(() => JSON.parse(localStorage.getItem("special-chess-profile")).xp), 200);
  await accountPage.screenshot({ path: "test-results/player-account-profile.png" });
  await online.close();
  const secondDevice = await browser.newContext();
  await secondDevice.addInitScript(() => localStorage.setItem("special-chess-graphics-quality", "low"));
  const second = await secondDevice.newPage(); second.on("pageerror", error => errors.push(error.message));
  await second.goto(base); await second.locator("#player-create-title").click();
  await second.locator('[data-player-tab="account"]').waitFor({ state: "visible" }); await second.locator('[data-player-tab="account"]').click();
  await second.locator('[data-player-auth="login"]').click();
  await second.locator("#player-username").fill("arc_player"); await second.locator("#player-password").fill("Geometric-Duel-2026");
  await second.locator("#player-auth-submit").click();
  await second.waitForFunction(() => document.querySelector("#player-entry strong")?.textContent === "Neon Oracle");
  assert.equal(await second.evaluate(() => JSON.parse(localStorage.getItem("special-chess-profile") || "{}").xp || 0), 0);
  await second.locator("#player-cloud-load").click();
  assert.equal(await second.evaluate(() => JSON.parse(localStorage.getItem("special-chess-profile")).xp), 200);
  await secondDevice.close();
  assert.deepEqual(errors, []);
  console.log("PASS: real register/login with validation, HttpOnly sessions, persistent characters, explicit cloud progression copy/save/load, guest restoration on logout and independent-browser login without automatic local replacement");
} finally {
  await browser?.close(); child.kill();
  await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once("exit", resolve); });
  rmSync(directory, { recursive: true, force: true });
}
