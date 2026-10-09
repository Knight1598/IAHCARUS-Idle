import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { Chess } from "chess.js";
import { readProfile } from "../src/profile.ts";
import { readEconomy, enterContract, economicModes } from "../shared/economy.js";
import { newModeSession } from "../src/mode-session.ts";
import { enterMenu, enterGame, chooseMode, launchPrepared, returnToMenu, openPanel } from "./enter-game.mjs";

const html = readFileSync("offline/Special-Chess-Offline.html", "utf8"), url = "http://localhost:31871/economy";
const browser = await chromium.launch({ ...(existsSync("/usr/bin/chromium") ? { executablePath: "/usr/bin/chromium" } : {}), args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
const errors = [], external = [];
async function fixture(profile = readProfile(null), save = null) {
  const context = await browser.newContext({ offline: true, viewport: { width: 1100, height: 850 } });
  const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (!request.url().startsWith(url) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) external.push(request.url()); });
  await page.route(url, route => route.fulfill({ contentType: "text/html", body: html }));
  await page.addInitScript(({ profile, save }) => {
    if (!localStorage.getItem("economy-test-initialized")) {
      localStorage.setItem("special-chess-profile", JSON.stringify(profile));
      localStorage.setItem("special-chess-graphics-quality", "low");
      localStorage.setItem("special-chess-reduced", "true");
      if (save) localStorage.setItem("special-chess-offline-game", JSON.stringify(save));
      localStorage.setItem("economy-test-initialized", "true");
    }
    const native = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = array => array instanceof Uint32Array ? (array.fill(Math.floor(.64 * 4294967296)), array) : native(array);
  }, { profile, save });
  await page.goto(url); await enterMenu(page);
  return { page, context };
}
const wallet = page => page.evaluate(() => JSON.parse(localStorage.getItem("special-chess-profile")).economy);
try {
  if (process.env.ECONOMY_TEST_PHASE !== "settlement") {
  const profile = readProfile(null); profile.economy.shards = 120;
  const { page, context } = await fixture(profile);
  await page.locator('[data-menu-go="treasury"]').click();
  assert.equal(await page.locator("#wallet-credits").innerText(), "750");
  await page.locator("#daily-credits").click();
  assert.equal((await wallet(page)).credits, 850);
  await page.waitForTimeout(550);
  await page.locator("#skin-pull").click(); await page.waitForTimeout(550);
  assert.equal((await wallet(page)).credits, 700); assert.ok((await wallet(page)).owned.includes("royal"));
  assert.match(await page.locator("#economy-status").innerText(), /สกินใหม่/);
  await page.locator("#skin-pull").click(); await page.waitForTimeout(550);
  assert.equal((await wallet(page)).shards, 200); assert.match(await page.locator("#economy-status").innerText(), /สกินซ้ำ/);
  await page.locator('[data-forge-skin="astral"]').click(); await page.waitForTimeout(550);
  assert.equal((await wallet(page)).shards, 80); assert.ok((await wallet(page)).owned.includes("astral"));
  assert.equal(await page.locator('[data-forge-skin="astral"]').isDisabled(), true);
  mkdirSync("test-results", { recursive: true });
  for (const viewport of [{ width:1100, height:850 },{ width:390,height:844 },{ width:844,height:390 },{width:320,height:568}]) {
    await page.setViewportSize(viewport);
    await page.locator('.menu-page[data-menu-view="treasury"]').evaluate(panel => panel.scrollTop = 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1), false);
    await page.screenshot({ path: `test-results/treasury-${viewport.width}.png` });
  }
  await page.setViewportSize({width:1100,height:850});
  await page.reload(); await enterMenu(page); await page.locator('[data-menu-go="treasury"]').click();
  assert.equal((await wallet(page)).credits, 550); assert.equal(await page.locator("#daily-credits").isDisabled(), true);
  await page.keyboard.press("Escape"); await page.locator('[data-menu-go="armory"]').click();
  await page.locator('[data-piece-origin="b1"]').click(); await page.locator('[data-piece-skin-option="royal"]').click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("special-chess-profile")).loadouts.w.b1), "royal");
  console.log("PASS: real treasury pull, duplicate shards, forge, daily dedup, independent equip, persistence and responsive theme");
  for (const mode of economicModes) {
    await chooseMode(page, mode.id);
    assert.equal(await page.locator("#contract-brief").isVisible(), true);
    assert.match(await page.locator("#contract-brief").innerText(), new RegExp(`ค่าเข้า ${mode.entry}`));
    if (mode.id === "broker") assert.equal(await page.locator("#draft-builder").isVisible(), true);
    const before = (await wallet(page)).credits;
    await launchPrepared(page);
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem("special-chess-offline-game")));
    assert.equal(save.activeContract.mode, mode.id);
    assert.equal(save.mode, mode.id === "payday" ? "local" : "bot");
    assert.equal((await wallet(page)).credits, before - mode.entry);
    await page.evaluate(() => {
      const select = document.querySelector("#human-side"); select.value = select.value === "w" ? "b" : "w"; select.dispatchEvent(new Event("change"));
    });
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("special-chess-offline-game")).humanColor), save.humanColor, "an active contract cannot change ownership");
    assert.equal((await wallet(page)).credits, before - mode.entry);
    assert.equal(await page.locator("#economy-hud").isVisible(), true);
    await returnToMenu(page); await page.reload(); await enterMenu(page);
    assert.equal((await wallet(page)).credits, before - mode.entry, "resume never charges twice");
    await enterGame(page); await returnToMenu(page);
  }
  console.log("PASS: all five economic modes launch real boards, enforce fees, show rules and resume without charging twice");
  await context.close();
  }
  for (const definition of economicModes) {
    const initialFen = definition.base === "bot" ? new Chess().fen() : "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1";
    const id = `settle-${definition.id}`, profile = readProfile(null);
    profile.economy = enterContract(readEconomy(), id, definition.id).wallet;
    const history = definition.base === "bot" ? ["f3","e5","g4","Qh4#"] : definition.base === "rush" ? [] : ["Qg7#"];
    const variant = definition.base === "bot" ? null : newModeSession(definition.base, { seed:1, draft:["k","q","p"] }, "w");
    if (definition.base === "rush") { variant.rushSolved = 4; variant.rushRemaining = 0; }
    const save = { mode:definition.base === "rush" ? "local" : "bot", activeVariant:variant, activeContract:{id,mode:definition.id}, humanColor:definition.base === "bot" ? "b" : "w", initialFen, history, matchId:id };
    const { page, context } = await fixture(profile, save);
    const amount = { bounty:160,vault:200,broker:380,stakes:450,payday:100 }[definition.id];
    const expected = 750 - definition.entry + amount;
    assert.equal((await wallet(page)).credits, expected, `${definition.id} must pay from the actual completed match`);
    await page.reload(); await enterMenu(page);
    assert.equal((await wallet(page)).credits, expected, "completed-match reload must not duplicate payout");
    await enterGame(page);
    assert.equal(await page.locator("#undo").isDisabled(), true);
    // Also exercise the handler guard independently of the disabled button.
    await page.evaluate(() => document.querySelector("#undo").onclick(new Event("click")));
    assert.equal((await wallet(page)).credits, expected);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("special-chess-offline-game")).history.length), history.length);
    await context.close();
  }
  console.log("PASS: five real outcome settlements, Puzzle run payout, post-settlement undo guard and reload dedup");
  const poor = readProfile(null); poor.economy.credits = 0;
  const last = await fixture(poor); await chooseMode(last.page, "stakes");
  while (await last.page.locator("#title-screen").getAttribute("data-menu-view") !== "arena") await last.page.locator("#flow-next").click();
  assert.equal(await last.page.locator("#launch-start").isDisabled(), true);
  assert.equal(await last.page.evaluate(() => localStorage.getItem("special-chess-offline-game")), null);
  await last.context.close();
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log("PASS: insufficient balance cannot launch or overwrite a save; packaged game needs no network");
} finally { await browser.close(); }
