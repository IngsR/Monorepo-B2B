/**
 * Inspect the auction detail page structure.
 *
 * Reports the detail body in full plus whether the bid panel and its form
 * controls are present anywhere in the DOM.
 */
export default async function run(page) {
  await page.goto('http://localhost:3110/login');
  await page.getByLabel(/Email address/).fill('bidder@bidforge.test');
  await page.getByLabel(/Password/).fill('Password123');
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await page.waitForURL(/marketplace/, { timeout: 15000 });

  await page.goto('http://localhost:3110/marketplace/auc_01');
  await page.waitForTimeout(2500);

  const body = await page.locator('body').innerText();

  return {
    url: page.url(),
    // Does the panel itself exist, regardless of where it sits?
    asideCount: await page.locator('aside.bid-panel').count(),
    bidPanelTag: await page.locator('app-bid-panel').count(),
    panelInfo: await page.evaluate(() => {
      const panel = document.querySelector('app-bid-panel');
      const aside = document.querySelector('aside.bid-panel');
      return {
        hasAppBidPanel: !!panel,
        hasAsideBidPanel: !!aside,
        asideText: aside ? aside.innerText.slice(0, 400) : null,
      };
    }),
    inputCount: await page.locator('input#bid-amount').count(),
    submitButtons: await page.locator('app-bid-panel button[type=submit]').count(),
    // Is the panel in the accessibility tree at all?
    headings: await page.locator('h1, h2').allInnerTexts(),
    detailTail: body.slice(1200),
  };
}
