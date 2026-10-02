// Optional real-browser regression suite. Uses fixtures; never production data.
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
    await fetch("http://127.0.0.1:8765/");
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 100));
  }
}
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
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
  await context.route("**/datastudio.google.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "Preview report" }),
  );
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.addInitScript(() =>
    localStorage.setItem("seanmosikili-cookie-consent", "declined"),
  );
  await page.goto("http://127.0.0.1:8765/");
  assert.equal(await page.locator("#site-navigation a").count(), 4);
  assert.equal(await page.locator(".menu-button").isVisible(), false);
  await fs.mkdir("playwright-results", { recursive: true });
  await page.screenshot({
    path: "playwright-results/world-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/", "/releases/", "/tour/", "/gallery/", "/shop/"]) {
    await page.goto("http://127.0.0.1:8765" + route);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
      route + " overflows",
    );
    assert.equal(await page.locator("#site-navigation").isVisible(), false);
    await page.getByRole("button", { name: "Open navigation" }).click();
    assert.equal(
      await page
        .getByRole("link", { name: "Releases", exact: true })
        .isVisible(),
      true,
    );
    await page.keyboard.press("Escape");
    await page.screenshot({
      path:
        "playwright-results/" +
        (route.replaceAll("/", "") || "home") +
        "-mobile.png",
      fullPage: true,
    });
  }
  await page.goto("http://127.0.0.1:8765/tour/");
  assert.equal(
    await page
      .locator(".tour-intro h1 span")
      .evaluate((el) => getComputedStyle(el).color),
    "rgb(182, 9, 5)",
  );
  await page.goto("http://127.0.0.1:8765/admin/");
  await page.locator("#dashboard").waitFor({ state: "visible" });
  await page.screenshot({
    path: "playwright-results/backstage-mobile.png",
    fullPage: true,
  });
  await page.locator("[data-view=content]").click();
  await page.locator("[data-content-section=tour]").click();
  await page.locator("[data-edit-entry=sonic-lab-01]").click();
  await page.locator("#entry-form [name=date]").fill("2026-11-07");
  await page.getByRole("button", { name: "Save date", exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__fixture.data.site_content.tour?.content.items[0].date ===
      "2026-11-07",
  );
  await page.locator("#back-workspace").click();
  await page.locator("[data-view=products]").click();
  await page.locator("[data-edit-product=retro-shirt]").click();
  await page.locator("#product-form [name=price]").fill("35");
  await page.locator("#product-form [type=submit]").click();
  await page.waitForFunction(
    () => window.__fixture.data.products["retro-shirt"].priceCents === 3500,
  );
  await page.evaluate(() => window.__fixture.setUser("member"));
  assert.equal(await page.locator("#dashboard").isVisible(), false);
  assert.deepEqual(errors, []);
  console.log(
    "PASS responsive navigation, red Tour accents, content publishing, product editing and access isolation",
  );
} finally {
  await browser.close();
  server.kill();
}
