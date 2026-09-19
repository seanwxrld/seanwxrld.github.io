import { spawn } from "node:child_process";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const server = spawn("python", ["-m", "http.server", "8765"], {
  stdio: "ignore",
});
process.on("exit", () => server.kill());
for (let i = 0; i < 50; i++) {
  try {
    await fetch("http://127.0.0.1:8765/admin/");
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 100));
  }
}
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const fixture = await fs.readFile("tests/fixtures/firebase.js", "utf8");
  await context.route("**/www.gstatic.com/firebasejs/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'export * from "/__firebase.js";',
    }),
  );
  await context.route("**/__firebase.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: fixture }),
  );
  await context.route("**/www.googletagmanager.com/**", (route) =>
    route.abort(),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (window !== window.top) return;
    localStorage.setItem("seanmosikili-release-popup-dismissed", "true");
    sessionStorage.setItem("seanmosikili-store-access", "granted");
  });
  await page.goto("http://127.0.0.1:8765/shop/SeanLayeredShirt/");
  await page.getByRole("button", { name: "ADD TO REQUEST CART" }).waitFor();
  await page.locator("select[name=option]").selectOption("M");
  await page.locator("input[name=quantity]").fill("2");
  await page.getByRole("button", { name: "ADD TO REQUEST CART" }).click();
  assert.match(
    await page.locator(".cart-controls [role=status]").textContent(),
    /Added/,
  );
  await page.goto("http://127.0.0.1:8765/shop/CD/");
  await page.getByRole("button", { name: "ADD TO REQUEST CART" }).click();
  await page.goto("http://127.0.0.1:8765/cart/");
  await page.locator(".line-item").first().waitFor();
  assert.equal(await page.locator(".line-item").count(), 2);
  assert.equal(await page.locator("#cart-total").textContent(), "$68.00");
  await page.reload();
  await page.locator(".line-item").first().waitFor();
  assert.equal(await page.locator(".line-item").count(), 2);
  await page.locator("[name=name]").fill("Test Customer");
  await page.locator("[name=email]").fill("test@example.test");
  await page.locator("[name=shippingAddress]").fill("Example address");
  await page.evaluate(() => (window.__fixture.fail = "submitCart"));
  await page.getByRole("button", { name: "Send my request" }).click();
  await page.waitForFunction(() =>
    document
      .querySelector("#checkout [role=status]")
      .textContent.includes("unavailable"),
  );
  assert.equal(await page.locator(".line-item").count(), 2);
  await page.evaluate(() => (window.__fixture.fail = null));
  await page.getByRole("button", { name: "Send my request" }).click();
  await page.waitForFunction(() =>
    document
      .querySelector("#checkout [role=status]")
      .textContent.includes("Request received"),
  );
  assert.equal(await page.locator(".line-item").count(), 0);
  console.log(
    "PASS cart: options, multiple products, persistence, totals, failure preservation, successful submission",
  );
  await page.goto("http://127.0.0.1:8765/admin/");
  await page.locator("#dashboard").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector("#metric-products").textContent === "3",
  );
  await fs.mkdir("playwright-results", { recursive: true });
  await page.screenshot({
    path: "playwright-results/backstage-desktop.png",
    fullPage: true,
  });
  await page.locator("[data-view=products]").click();
  await page.getByRole("button", { name: "Add product +" }).click();
  const f = page.locator("#product-form");
  await f.locator("[name=name]").fill("New limited edition");
  await f
    .locator("[name=description]")
    .fill("A new piece from the world of SĒAN.");
  await f.locator("[name=price]").fill("15.50");
  await f.locator("[name=image]").fill("/assets/LAYERED_SHIRT.PNG");
  await f.getByRole("button", { name: "Save product" }).click();
  await page.getByRole("heading", { name: "New limited edition" }).waitFor();
  await page.locator('[data-edit-product="new-product"]').click();
  await f.locator("[name=status]").selectOption("soldout");
  await f.getByRole("button", { name: "Save product" }).click();
  await page.waitForFunction(
    () => window.__fixture.data.products["new-product"].status === "soldout",
  );
  await page.locator("[data-view=requests]").click();
  await page.locator("#request-list [data-request]").first().click();
  await page.locator("#detail-status").selectOption("reviewing");
  await page.locator("#save-request").click();
  await page.waitForFunction(
    () => window.__fixture.data.shop_requests.one.status === "reviewing",
  );
  await page.locator("[data-close=request-dialog]").click();
  console.log(
    "PASS dashboard: role gate, live collections, create/edit product, stock status, request status",
  );
  await page.locator("[data-view=newsletter]").click();
  const mail = page.locator("#newsletter-form");
  await mail.locator("[name=subject]").fill("A little something for you.");
  await mail.locator("[name=heading]").fill("Welcome to my world.");
  await mail
    .locator("[name=body]")
    .fill("Hey Swarm,\nSomething new is on its way.");
  await mail.getByRole("button", { name: "Save draft" }).click();
  await page.waitForFunction(
    () => window.__fixture.data.campaigns["new-campaign"]?.status === "draft",
  );
  const before = await page.evaluate(
    () =>
      window.__fixture.calls.filter(
        (c) => c.name === "testCampaign" || c.name === "queueCampaign",
      ).length,
  );
  assert.equal(before, 0);
  await page.screenshot({
    path: "playwright-results/newsletter-desktop.png",
    fullPage: true,
  });
  await mail.locator("summary").click();
  await mail
    .locator("[name=html]")
    .fill(
      "<script>parent.__xss=true</script><h1>Custom preview</h1>{{unsubscribe_url}}",
    );
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  console.log(
    "PASS newsletter: draft persistence, preview isolation, no automatic sending",
  );
  await page.locator("[data-view=overview]").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "playwright-results/backstage-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.locator("#signout").click();
  await page.locator("#login").waitFor({ state: "visible" });
  assert.equal(await page.locator("#request-detail").textContent(), "");
  await page.evaluate(() => window.__fixture.setUser("member"));
  await page.waitForFunction(() =>
    document
      .querySelector("#access-status")
      .textContent.includes("doesn’t have backstage access"),
  );
  assert.equal(await page.locator("#dashboard").isVisible(), false);
  await page.goto("http://127.0.0.1:8765/account/");
  await page.locator("#auth-form [name=email]").fill("member@example.test");
  await page.locator("#auth-form [name=password]").fill("example-password");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.locator("#member").waitFor({ state: "visible" });
  await page.waitForFunction(() =>
    document
      .querySelector("#member-requests")
      .textContent.includes("SĒAN Layered Shirt"),
  );
  await page.goto("http://127.0.0.1:8765/contact/");
  const contact = page.locator("[data-contact-form]");
  await contact.locator("[name=name]").fill("Sample contact");
  await contact.locator("[name=email]").fill("sample@example.test");
  await contact.locator("[name=interest]").selectOption("Booking");
  await contact
    .locator("[name=message]")
    .fill("A sample request for the test.");
  await contact.getByRole("button", { name: "SEND MESSAGE" }).click();
  await page.waitForFunction(() =>
    window.__fixture.calls.some((c) => c.name === "submitContact"),
  );
  assert.equal(
    await page.evaluate(
      () =>
        window.__fixture.calls.filter((c) => c.name === "submitContact").length,
    ),
    1,
  );
  console.log(
    "PASS non-admin UI denial, member signup/history, contact form integration",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS mobile layout, sign-out clears private detail, no JS errors",
  );
} finally {
  await browser.close();
  server.kill();
}
