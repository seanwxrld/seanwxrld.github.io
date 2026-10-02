import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { defaults } from "../app/content-data.js";

async function app(route, entry) {
  const html = await fs.readFile(
    route === "/" ? "index.html" : route.slice(1) + "index.html",
    "utf8",
  );
  const dom = new JSDOM(html, {
    url: "https://seanwxrld.com" + route,
    runScripts: "outside-only",
  });
  const w = dom.window;
  w.confirm = () => true;
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  w.fetch = async (url) => ({
    json: async () => JSON.parse(await fs.readFile("." + url, "utf8")),
  });
  const context = dom.getInternalVMContext(),
    cache = new Map();
  async function load(file) {
    if (cache.has(file)) return cache.get(file);
    const pending = (async () => {
      const source = await fs.readFile(file, "utf8");
      const m = new vm.SourceTextModule(source, {
        context,
        identifier: path.resolve(file),
        importModuleDynamically: async (spec, parent) => {
          const dep = await resolve(spec, parent);
          if (dep.status === "unlinked") await dep.link(resolve);
          if (dep.status === "linked") await dep.evaluate();
          return dep;
        },
      });
      return m;
    })();
    cache.set(file, pending);
    return pending;
  }
  async function resolve(spec, parent) {
    return load(
      spec.startsWith("https://www.gstatic.com/")
        ? "tests/fixtures/firebase.js"
        : path.relative(
            process.cwd(),
            path.resolve(path.dirname(parent.identifier), spec),
          ),
    );
  }
  const mod = await load(entry);
  await mod.link(resolve);
  await mod.evaluate();
  const settle = () => new Promise((r) => setTimeout(r, 30));
  await settle();
  const $ = (s) => w.document.querySelector(s),
    click = (s) => $(s).click(),
    fill = (s, value) => {
      const el = $(s);
      el.value = value;
      el.dispatchEvent(new w.Event("input", { bubbles: true }));
    },
    submit = async (s) => {
      $(s).dispatchEvent(
        new w.Event("submit", { bubbles: true, cancelable: true }),
      );
      await settle();
    };
  return { w, $, click, fill, submit, settle, close: () => w.close() };
}
test("admin opens one workspace and saves a real date through the content transaction", async () => {
  const a = await app("/admin/", "app/admin.js");
  try {
    assert.equal(a.$("#dashboard").hidden, false);
    a.click("[data-view=content]");
    a.click("[data-content-section=tour]");
    a.click('[data-edit-entry="sonic-lab-01"]');
    a.fill("#entry-form [name=date]", "2026-11-07");
    a.fill("#entry-form [name=venue]", "New stage");
    await a.submit("#entry-form");
    assert.match(a.$("#content-status").textContent, /Saved/);
    const d = a.w.__fixture.data;
    assert.equal(d.site_content.tour.content.items[0].date, "2026-11-07");
    assert.equal(d.site_content_private.tour.revision, 1);
    assert.equal(d.site_content.tour.content.items[0].venue, "New stage");
    assert.match(a.$("#content-status").textContent, /Saved/);
    a.click("#back-workspace");
    assert.equal(a.$("[data-panel=content]").hidden, true);
    assert.equal(a.$("[data-panel=overview]").hidden, false);
  } finally {
    a.close();
  }
});
test("hidden releases remain private and an edit conflict does not overwrite another device", async () => {
  const a = await app("/admin/", "app/admin.js");
  try {
    a.click("[data-view=content]");
    a.click("[data-content-section=releases]");
    a.click('[data-edit-entry="monaco"]');
    a.fill("#entry-form [name=status]", "hidden");
    await a.submit("#entry-form");
    assert.match(a.$("#content-status").textContent, /Saved/);
    assert.ok(
      a.w.__fixture.data.site_content_private.releases.content.items.some(
        (x) => x.id === "monaco",
      ),
    );
    assert.ok(
      !a.w.__fixture.data.site_content.releases.content.items.some(
        (x) => x.id === "monaco",
      ),
    );
    a.click('[data-edit-entry="monaco"]');
    a.fill("#entry-form [name=title]", "Unsaved title");
    a.w.__fixture.data.site_content_private.releases.revision = 8;
    await a.submit("#entry-form");
    assert.match(a.$("#content-status").textContent, /another device/);
    assert.equal(a.$("#entry-form [name=title]").value, "Unsaved title");
    assert.equal(
      a.w.__fixture.data.site_content_private.releases.content.items[0].title,
      "MONACO",
    );
  } finally {
    a.close();
  }
});
test("failed saves retain input and sign-out clears private editors", async () => {
  const a = await app("/admin/", "app/admin.js");
  try {
    a.click("[data-view=content]");
    a.click("[data-content-section=home]");
    a.fill("#section-form [name=intro]", "A new introduction");
    a.w.__fixture.fail = "transaction";
    await a.submit("#section-form");
    assert.equal(a.$("#section-form [name=intro]").value, "A new introduction");
    assert.match(a.$("#content-status").textContent, /unavailable/);
    assert.equal(a.$("#content-unsaved").hidden, false);
    a.w.__fixture.setUser("member");
    await a.settle();
    assert.equal(a.$("#dashboard").hidden, true);
    assert.equal(a.$("#content-body").textContent, "");
  } finally {
    a.close();
  }
});
test("existing product editing, requests and newsletter drafts remain functional", async () => {
  const a = await app("/admin/", "app/admin.js");
  try {
    a.click("[data-view=products]");
    a.click('[data-edit-product="retro-shirt"]');
    a.fill("#product-form [name=price]", "35");
    await a.submit("#product-form");
    assert.equal(
      a.w.__fixture.data.products["retro-shirt"].priceCents,
      3500,
      a.$("#product-form [role=status]").textContent +
        " / " +
        Array.from(a.$("#product-form").elements)
          .filter((e) => e.validity && !e.validity.valid)
          .map((e) => e.name + ":" + e.validationMessage)
          .join(","),
    );
    a.click("#back-workspace");
    a.click("[data-view=requests]");
    a.click("#request-list [data-request]");
    a.fill("#detail-status", "confirmed");
    a.click("#save-request");
    await a.settle();
    assert.equal(a.w.__fixture.data.shop_requests.one.status, "confirmed");
    a.click("[data-close=request-dialog]");
    a.click("#back-workspace");
    a.click("[data-view=newsletter]");
    a.fill("#newsletter-form [name=subject]", "Test draft");
    a.fill("#newsletter-form [name=heading]", "A new chapter");
    a.fill("#newsletter-form [name=body]", "Draft only.");
    await a.submit("#newsletter-form");
    assert.equal(
      Object.values(a.w.__fixture.data.campaigns)[0].subject,
      "Test draft",
    );
  } finally {
    a.close();
  }
});
test("a public content update changes the page and schema together", async () => {
  const a = await app("/releases/", "app/content.js");
  try {
    await a.settle();
    const content = JSON.parse(JSON.stringify(defaults.releases));
    content.items.find((x) => x.id === "monaco").title =
      "Updated release title";
    a.w.__fixture.publishContent("releases", content);
    await a.settle();
    assert.equal(a.$("#monaco h2").textContent, "Updated release title");
    const schema = JSON.parse(a.$("#site-schema").textContent);
    assert.ok(schema["@graph"].some((x) => x.name === "Updated release title"));
  } finally {
    a.close();
  }
});
