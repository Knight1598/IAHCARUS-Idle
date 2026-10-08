export async function enterMenu(page) {
  await page.locator("#title-screen").waitFor({ state: "visible" });
  if (await page.locator("#title-screen").getAttribute("data-menu-view") === "title") await page.locator("#title-enter").click();
  while (await page.locator("#title-screen").getAttribute("data-menu-view") !== "menu") await page.locator("#flow-back").click();
}
export async function chooseMode(page, mode) {
  await enterMenu(page);
  await page.locator("#lobby-battle-tab").click();
  await page.locator(`[data-title-mode="${mode}"]`).click();
}
export async function launchPrepared(page) {
  while (await page.locator("#title-screen").getAttribute("data-menu-view") !== "arena") await page.locator("#flow-next").click();
  await page.locator("#launch-start").click();
  await page.waitForSelector("#stage canvas");
}
export async function enterGame(page, mode) {
  if (mode) await chooseMode(page, mode);
  else {
    await enterMenu(page);
    if (await page.locator("#launch-resume").isVisible()) {
      await page.locator("#launch-resume").click();
      await page.waitForSelector("#stage canvas"); return;
    }
    await page.locator("#lobby-battle-tab").click();
  }
  await launchPrepared(page);
}
export async function openPanel(page, name) {
  const drawer = page.locator("#arena-drawer");
  if (await drawer.isVisible() && await drawer.getAttribute("data-panel") === name) return;
  if (!await drawer.isVisible()) await page.locator("#pause-game").click();
  else if (await drawer.getAttribute("data-panel") !== "pause") await page.locator("#drawer-back").click();
  if (name !== "pause") await page.locator(`[data-hud-open="${name}"]`).click();
}
export async function closePanel(page) {
  if (await page.locator("#arena-drawer").isVisible()) await page.locator("#drawer-close").click();
}
export async function returnToMenu(page) {
  await openPanel(page, "pause"); await page.locator("#title-return").click();
}
export async function resetGame(page) {
  await openPanel(page, "pause"); await page.locator("#reset").click();
}
export async function setDifficulty(page, depth) {
  await openPanel(page, "pause"); await page.locator("#difficulty").selectOption(depth); await closePanel(page);
}
export async function equipArmySkin(page, skin) {
  await chooseMode(page, "bot"); await page.locator("#flow-next").click();
  await page.locator(`[data-skin-option="${skin}"]`).click(); await enterMenu(page);
}
