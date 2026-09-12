/**
 * Compare client-side navigation (card click) with a direct load of the same
 * auction detail URL, to isolate whether the detail component renders at all
 * after an in-app navigation.
 */
export default async function run(page) {
  await page.goto('http://localhost:3112/login');
  await page.getByLabel(/Email address/).fill('bidder@bidforge.test');
  await page.getByLabel(/Password/).fill('Password123');
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await page.waitForURL(/marketplace/, { timeout: 15000 });
  await page.waitForSelector('app-auction-card', { timeout: 15000 });

  // --- client-side navigation via the card CTA -------------------------
  const card = page
    .locator('app-auction-card')
    .filter({ has: page.locator('.badge', { hasText: 'Active' }) })
    .first();
  await card.locator('a.btn').first().click();
  await page.waitForTimeout(3000);

  const viaClick = {
    url: page.url(),
    bodyChars: (await page.locator('body').innerText()).length,
    detailGrid: await page.locator('.auction-detail-grid').count(),
    asidePanel: await page.locator('aside.bid-panel').count(),
    pageTitle: await page
      .locator('.detail-title, .page-title')
      .first()
      .innerText()
      .catch(() => ''),
  };

  // --- direct load of the same route -----------------------------------
  await page.goto('http://localhost:3112/marketplace/auc_01');
  await page.waitForTimeout(3000);

  const direct = {
    url: page.url(),
    bodyChars: (await page.locator('body').innerText()).length,
    detailGrid: await page.locator('.auction-detail-grid').count(),
    asidePanel: await page.locator('aside.bid-panel').count(),
    pageTitle: await page
      .locator('.detail-title, .page-title')
      .first()
      .innerText()
      .catch(() => ''),
  };

  return { viaClick, direct };
}
