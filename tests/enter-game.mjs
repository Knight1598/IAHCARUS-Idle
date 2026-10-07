export async function enterGame(page, mode) {
  await page.locator("#title-screen").waitFor({ state: "visible" });
  if (mode) await page.locator(`[data-title-mode="${mode}"]`).click();
  const resume = page.locator("#launch-resume");
  if (!mode && await resume.isVisible()) await resume.click();
  else await page.locator("#launch-start").click();
  await page.waitForSelector("#stage canvas");
}
