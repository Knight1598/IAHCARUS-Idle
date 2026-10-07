export async function enterGame(page, mode) {
  await page.locator("#title-screen").waitFor({ state: "visible" });
  if (mode) await page.locator(`[data-title-mode="${mode}"]`).click();
  const resume = page.locator("#launch-resume");
  if (!mode && await resume.isVisible()) await resume.click();
  else await page.locator("#launch-start").click();
  await page.waitForSelector("#stage canvas");
}
export async function openPanel(page, name) {
  const drawer = page.locator("#arena-drawer");
  if (!await drawer.isVisible() || await drawer.getAttribute("data-panel") !== name)
    await page.locator(`[data-hud-open="${name}"]`).click();
}
export async function closePanel(page) {
  if (await page.locator("#arena-drawer").isVisible()) await page.locator("#drawer-close").click();
}
