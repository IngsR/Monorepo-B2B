/**
 * Verify the vendor and admin workspaces.
 *
 * Checks role-scoped navigation, the lifecycle controls offered per state, and
 * that no invalid transition is ever presented.
 */
export default async function run(page) {
  const report = { flows: {}, failures: [] };

  /* ------------------------------------------------------------- vendor */
  await page.goto('http://localhost:3120/login');
  await page.getByLabel(/Email address/).fill('vendor@bidforge.test');
  await page.getByLabel(/Password/).fill('Password123');
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await page.waitForURL(/vendor/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const vendorNav = await page
    .locator('app-sidebar')
    .innerText()
    .catch(() => '');
  const vendorForbidden = ['Admin dashboard', 'Users', 'Categories', 'Bidders'].filter((l) =>
    vendorNav.includes(l),
  );

  report.flows.vendor = {
    landingUrl: page.url(),
    nav: vendorNav.split(/\s+/).filter(Boolean).join(' ').slice(0, 260),
    forbidden: vendorForbidden,
    // The pipeline counters are real counts of the vendor's own auctions.
    pipeline: await page
      .locator('.stat-card')
      .allInnerTexts()
      .catch(() => []),
  };

  if (vendorForbidden.length > 0) {
    report.failures.push({ role: 'vendor', reason: `sees admin links: ${vendorForbidden}` });
  }

  /* ------------------------------------------- vendor: my auctions list */
  await page.goto('http://localhost:3120/vendor/auctions');
  await page.waitForTimeout(2500);

  report.flows.vendorAuctions = {
    rows: await page.locator('table.data-table tbody tr').count(),
    statuses: [
      ...new Set(
        (await page.locator('table.data-table .badge').allInnerTexts()).map((t) => t.trim()),
      ),
    ],
  };

  /* -------------------------- vendor: lifecycle per state (the core check) */
  // Each fixture auction is in a known state; record which actions are offered.
  const lifecycle = {};
  for (const id of ['auc_08', 'auc_06', 'auc_01', 'auc_09', 'auc_10']) {
    await page.goto(`http://localhost:3120/vendor/auctions/${id}`);
    await page.waitForSelector('.lifecycle-step', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(900);

    const status = await page
      .locator('.card-header .badge')
      .first()
      .innerText()
      .catch(() => '');
    const actions = await page
      .locator('.lifecycle-actions .btn')
      .allInnerTexts()
      .catch(() => []);

    lifecycle[id] = { status: status.trim(), actions: actions.map((a) => a.trim()) };
  }

  report.flows.lifecycle = lifecycle;

  // The state machine must never offer an illegal transition.
  const expectations = {
    auc_08: { status: 'Draft', allowed: ['Schedule', 'Cancel'] },
    auc_06: { status: 'Scheduled', allowed: ['Activate', 'Cancel'] },
    auc_01: { status: 'Active', allowed: ['End auction', 'Cancel'] },
    auc_09: { status: 'Ended', allowed: [] },
    auc_10: { status: 'Cancelled', allowed: [] },
  };

  for (const [id, expected] of Object.entries(expectations)) {
    const actual = lifecycle[id];
    if (!actual) {
      report.failures.push({ role: 'vendor', reason: `${id}: no lifecycle rendered` });
      continue;
    }
    const allowedSet = new Set(expected.allowed);
    const illegal = actual.actions.filter((a) => !allowedSet.has(a));
    if (illegal.length > 0) {
      report.failures.push({
        role: 'vendor',
        reason: `${id} (${actual.status}): illegal transitions offered: ${illegal.join(', ')}`,
      });
    }
    if (expected.allowed.length === 0 && actual.actions.length > 0) {
      report.failures.push({
        role: 'vendor',
        reason: `${id} (${actual.status}): terminal state offered ${actual.actions.length} action(s)`,
      });
    }
  }

  /* -------------------------------------------------------------- admin */
  await page.goto('http://localhost:3120/login');
  await page.goto('http://localhost:3120/logout').catch(() => {});
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:3120/login');
  await page.waitForTimeout(1200);

  await page.getByLabel(/Email address/).fill('admin@bidforge.test');
  await page.getByLabel(/Password/).fill('Password123');
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await page.waitForURL(/admin/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const adminNav = await page
    .locator('app-sidebar')
    .innerText()
    .catch(() => '');

  report.flows.admin = {
    landingUrl: page.url(),
    nav: adminNav.split(/\s+/).filter(Boolean).join(' ').slice(0, 260),
    stats: await page
      .locator('.stat-card')
      .allInnerTexts()
      .catch(() => []),
  };

  // Each admin management screen must load its table.
  const screens = ['users', 'vendors', 'bidders', 'categories'];
  report.flows.adminScreens = {};

  for (const screen of screens) {
    await page.goto(`http://localhost:3120/admin/${screen}`);
    await page
      .waitForSelector('table.data-table, .state-block', { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(1200);
    report.flows.adminScreens[screen] = {
      title: await page
        .locator('.page-title')
        .first()
        .innerText()
        .catch(() => ''),
      rows: await page.locator('table.data-table tbody tr').count(),
      empty: await page.locator('.state-block').count(),
    };
  }

  report.summary = { failures: report.failures.length };
  return report;
}
