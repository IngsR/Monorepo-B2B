/**
 * Inspect the /my-bids route and the below-minimum validation path.
 */
export default async function run(page) {
  await page.goto('http://localhost:3120/login');
  await page.getByLabel(/Email address/).fill('bidder@bidforge.test');
  await page.getByLabel(/Password/).fill('Password123');
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await page.waitForURL(/marketplace/, { timeout: 15000 });

  // 1. What does /my-bids actually render?
  await page.goto('http://localhost:3120/my-bids');
  await page.waitForTimeout(3500);

  const myBids = {
    url: page.url(),
    bodyChars: (await page.locator('body').innerText()).length,
    bodyStart: (await page.locator('body').innerText()).slice(0, 400),
    appRootHead: (
      await page
        .locator('app-root')
        .innerHTML()
        .catch(() => '')
    ).slice(0, 300),
  };

  // 2. Does the bid form show an error for a below-minimum amount?
  await page.goto('http://localhost:3120/marketplace/auc_01');
  await page.waitForSelector('aside.bid-panel', { timeout: 15000 });
  await page.waitForTimeout(1200);

  const input = page.locator('input#bid-amount');
  const before = await input.inputValue();

  await input.click();
  await input.fill('1');
  await input.press('Tab');
  await page.waitForTimeout(600);

  const afterFill = {
    value: await input.inputValue(),
    formErrors: await page.locator('aside.bid-panel .form-error').allInnerTexts(),
    submitDisabled: await page.locator('aside.bid-panel button[type=submit]').first().isDisabled(),
    ariaInvalid: await input.getAttribute('aria-invalid'),
    inputClasses: await input.getAttribute('class'),
  };

  return { myBids, bidPrefill: before, afterFill };
}
