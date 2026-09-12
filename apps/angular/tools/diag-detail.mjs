/** Diagnose why the auction detail route renders nothing. */
export default async function run(page, ui) {
  await page.goto('http://localhost:3110/login');
  await page.getByLabel(/Email address/).fill('bidder@bidforge.test');
  await page.getByLabel(/Password/).fill('Password123');
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await page.waitForURL(/marketplace/, { timeout: 15000 });

  await page.goto('http://localhost:3110/marketplace/auc_01');
  await page.waitForTimeout(3000);

  const body = await page.locator('body').innerText();
  const html = await page
    .locator('app-root')
    .innerHTML()
    .catch(() => '(no app-root)');

  return {
    url: page.url(),
    bodyChars: body.length,
    body: body.slice(0, 500),
    appRootHtml: html.slice(0, 700),
  };
}
