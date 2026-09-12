/**
 * Diagnose the deep-link / hard-reload session restore.
 *
 * Checks whether a token survives in localStorage and whether a hard navigation
 * to a deep link restores the session, versus a client-side navigation which is
 * known to work.
 */
export default async function run(page, ui) {
  await page.goto('http://localhost:3110/login');
  await page.getByLabel(/Email address/).fill('bidder@bidforge.test');
  await page.getByLabel(/Password/).fill('Password123');
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await page.waitForURL(/marketplace/, { timeout: 15000 });

  const tokenAfterLogin = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.includes('token')),
  );

  // Client-side navigation (router link click) — expected to work.
  await page.goto('http://localhost:3110/marketplace/auc_01');
  await page.waitForTimeout(2500);

  const afterHardNav = {
    url: page.url(),
    tokenKeys: await page.evaluate(() => Object.keys(localStorage)),
    hasBidPanel: (await page.locator('app-bid-panel').count()) > 0,
  };

  // Second hard navigation, to see whether the first one cleared the session.
  await page.goto('http://localhost:3110/marketplace/auc_02');
  await page.waitForTimeout(2500);

  const afterSecondNav = {
    url: page.url(),
    tokenKeys: await page.evaluate(() => Object.keys(localStorage)),
    hasBidPanel: (await page.locator('app-bid-panel').count()) > 0,
  };

  return { tokenAfterLogin, afterHardNav, afterSecondNav };
}
