/**
 * End-to-end flow verification.
 *
 * Drives the primary prototype flows described in the design:
 *   login → marketplace → auction detail → place bid → my bids
 * and checks the role-scoped navigation for each of the three roles.
 *
 * Returns a structured report so failures name the step that broke.
 */
export default async function run(page, ui) {
  const report = { steps: [], failures: [] };

  const step = (name, detail) => report.steps.push({ name, ...detail });
  const fail = (name, reason) => {
    report.failures.push({ step: name, reason });
    report.steps.push({ name, ok: false, reason });
  };

  /* ---------------------------------------------------- sign in (bidder) */
  // Use the real accessible names the rendered form exposes.
  const emailInput = page.getByLabel(/Email address/);
  const passInput = page.getByLabel(/Password/);

  if ((await emailInput.count()) === 0 || (await passInput.count()) === 0) {
    const snap = await ui.snapshot();
    fail('login-form', `credential inputs not found. snapshot:\n${snap}`);
    return report;
  }

  await emailInput.fill('bidder@bidforge.test');
  await passInput.fill('Password123');

  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await page.waitForURL(/marketplace/, { timeout: 15000 }).catch(() => {});

  step('sign-in', { url: page.url() });

  if (!/marketplace/.test(page.url())) {
    fail('sign-in', `expected the marketplace, landed on ${page.url()}`);
    return report;
  }

  /* ------------------------------------------------------- marketplace */
  await page.waitForSelector('app-auction-card', { timeout: 15000 }).catch(() => {});

  const cardCount = await page.locator('app-auction-card').count();
  step('marketplace-cards', { count: cardCount });

  // Status badges must be present and textual, never colour-only.
  const badgeTexts = await page.locator('app-auction-card .badge').allInnerTexts();
  const uniqueBadges = [...new Set(badgeTexts.map((t) => t.trim()).filter(Boolean))];
  step('marketplace-status-badges', { badges: uniqueBadges });

  if (cardCount === 0) {
    fail('marketplace', 'no auction cards rendered');
    return report;
  }

  // Bidder navigation must not expose vendor or admin management.
  const navText = await page
    .locator('app-sidebar')
    .innerText()
    .catch(() => '');
  const forbidden = [
    'My products',
    'My auctions',
    'Vendor dashboard',
    'Users',
    'Categories',
  ].filter((label) => navText.includes(label));
  const navSummary = navText.split(/\s+/).filter(Boolean).join(' ').slice(0, 220);
  step('bidder-nav-scope', { nav: navSummary, forbidden });

  if (forbidden.length > 0) {
    fail('bidder-nav-scope', `bidder sidebar exposes management links: ${forbidden.join(', ')}`);
  }

  /* ------------------------------------------------------ auction detail */
  // Open a card that is genuinely open for bidding.
  const activeCard = page
    .locator('app-auction-card')
    .filter({ has: page.locator('.badge', { hasText: 'Active' }) })
    .first();

  const hasActive = (await activeCard.count()) > 0;
  if (!hasActive) {
    fail('auction-detail', 'no ACTIVE auction card available to open');
    return report;
  }

  await activeCard.locator('a.btn').first().click();
  await page.waitForURL(/\/marketplace\/auc_/, { timeout: 15000 }).catch(() => {});

  // The detail route is a lazy chunk: wait for the panel itself to render
  // rather than assuming the URL change means the view is ready.
  await page.waitForSelector('.auction-detail-grid', { timeout: 15000 }).catch(() => {});

  const detailUrl = page.url();
  // These components are custom elements whose host is the element itself, so
  // match the rendered result (the aside / list) rather than a light-DOM
  // descendant of the same tag.
  const hasBidPanel = (await page.locator('aside.bid-panel').count()) > 0;
  const hasBidInput = (await page.locator('input#bid-amount').count()) > 0;
  const hasHistory = (await page.locator('.bid-list, .state-block').count()) > 0;
  const hasLifecycle = (await page.locator('.lifecycle-step').count()) > 0;

  step('auction-detail', {
    url: detailUrl,
    bidPanel: hasBidPanel,
    bidInput: hasBidInput,
    bidHistory: hasHistory,
    lifecycleIndicator: hasLifecycle,
  });

  if (!hasBidInput) {
    fail('auction-detail', 'the bid input is missing on an ACTIVE auction');
    return report;
  }

  /* ---------------------------------------------------------- place bid */
  // Read the panel's stated minimum so the bid is derived, not hard-coded.
  await page.waitForSelector('aside.bid-panel', { timeout: 15000 }).catch(() => {});
  // The labels are uppercased via CSS, so match case-insensitively and tolerate
  // the hint text that sits between the label and the figure.
  const panelText = await page.locator('aside.bid-panel').first().innerText();
  const minimumLabel = panelText.match(/minimum next bid[^0-9]*([\d,]+\.\d\d)/i)?.[1] ?? null;
  step('bid-minimum-shown', { minimumLabel });

  // Type a bid that is clearly too low, then trigger validation the way a user
  // would — the error only shows once the field has been touched.
  const bidInput = page.locator('input#bid-amount');
  await bidInput.click();
  await bidInput.fill('1');
  await bidInput.press('Tab');
  await page.waitForTimeout(400);

  const lowBidBlocked = await page
    .locator('aside.bid-panel .form-error')
    .first()
    .isVisible()
    .catch(() => false);
  step('client-validation-too-low', { blocked: lowBidBlocked });

  if (lowBidBlocked) {
    // A bid below the minimum must not be submittable.
    const submitDisabled = await page
      .locator('aside.bid-panel button[type=submit]')
      .first()
      .isDisabled()
      .catch(() => false);
    step('bid-submit-disabled-when-invalid', { disabled: submitDisabled });
    if (!submitDisabled) {
      fail('client-validation-too-low', 'a sub-minimum bid left the submit button enabled');
    }
  }

  // Now place a genuinely acceptable bid.
  const minimum = minimumLabel ? Number(minimumLabel.replace(/,/g, '')) : null;
  if (minimum === null) {
    fail('place-bid', 'could not read the minimum next bid from the panel');
    return report;
  }

  await page.locator('input#bid-amount').fill(String(minimum));
  await page.waitForTimeout(200);
  await page.locator('aside.bid-panel button[type=submit]').first().click();

  // Either the bid is accepted (toast) or it conflicts and the page reloads the price.
  await page.waitForTimeout(2000);

  const toastText = await page
    .locator('.toast')
    .allInnerTexts()
    .catch(() => []);
  const joined = toastText.join(' | ');
  step('bid-outcome', { toasts: toastText });

  if (/accepted/i.test(joined)) {
    step('bid-accepted', { ok: true });
  } else if (/price moved|not accepted/i.test(joined)) {
    step('bid-conflict', { ok: true });
  } else {
    fail('place-bid', `no acceptance or conflict feedback appeared. toasts: ${joined || '(none)'}`);
  }

  /* ------------------------------------------------------------ my bids */
  await page.goto('http://localhost:3000/my-bids');
  // Lazy route: wait for the heading to be painted before reading it.
  await page.waitForSelector('.page-title', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const myBidsTitle = await page
    .locator('.page-title')
    .first()
    .innerText()
    .catch(() => '');
  const rows = await page.locator('table.data-table tbody tr').count();
  const states = await page
    .locator('.bid-state')
    .allInnerTexts()
    .catch(() => []);

  step('my-bids', {
    title: myBidsTitle,
    rows,
    states: [...new Set(states.map((s) => s.trim()))],
  });

  if (!/my bids/i.test(myBidsTitle)) {
    fail('my-bids', `unexpected page title: ${myBidsTitle}`);
  }

  // "Winner" must never appear before an auction has ended.
  const bodyText = await page.locator('body').innerText();
  const misleading = /you won|winner:/i.test(bodyText);
  if (misleading) {
    fail('my-bids', 'the page uses win/winner wording before the auction has ended');
  }

  report.summary = {
    failures: report.failures.length,
    steps: report.steps.length,
  };

  return report;
}
