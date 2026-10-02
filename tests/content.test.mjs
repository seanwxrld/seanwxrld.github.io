import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { defaults } from "../app/content-data.js";
import {
  clone,
  renderHome,
  renderReleases,
  renderTour,
  structuredData,
  validateSection,
  contentUrl,
  youtubeId,
} from "../app/content-model.js";

test("old album feature is retired; Monaco and the dated Deluxe announcement remain", () => {
  const home = renderHome(defaults);
  assert.match(home, /MONACO/);
  assert.match(home, /30\.10/);
  assert.match(home, /Deluxe/);
  assert.doesNotMatch(home, /home-tracklist|debut album|pre-save waitlist/);
  const catalog = renderReleases(defaults);
  assert.match(catalog, /id="monaco"/);
  assert.match(catalog, /id="lost-lovers-avenue"/);
  assert.match(catalog, /Coming 30 October 2026/);
});
test("schema retains artist identity and connects catalogue and events", () => {
  const schema = structuredData(defaults, "/releases/")["@graph"];
  const artist = schema.find((x) => x["@type"] === "MusicGroup");
  assert.equal(artist.name, "SĒAN MOSIKILI");
  assert.ok(artist.sameAs.some((x) => x.includes("spotify.com/artist/")));
  const deluxe = schema.find((x) => x.name === "LOST LOVER'S AVENUE (Deluxe)");
  assert.equal(deluxe.datePublished, "2026-10-30");
  assert.equal(deluxe.byArtist["@id"], artist["@id"]);
  assert.ok(schema.some((x) => x.name === "FRAGILE EXHIBITION"));
  const events = structuredData(defaults, "/tour/")["@graph"].filter(
    (x) => x["@type"] === "MusicEvent",
  );
  assert.equal(events.length, 2);
});
test("tour separates past shows and preserves cancellations", () => {
  const data = clone(defaults);
  data.tour.items[1].status = "cancelled";
  const html = renderTour(data, "2026-10-05");
  assert.match(html, /Past performances \/ 1/);
  assert.match(html, /Cancelled/);
  assert.match(html, /datetime="2026-10-03"/);
  assert.match(html, /id="sonic-lab-02"/);
});
test("unsafe URLs, invalid dates and duplicate IDs cannot be published", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "http://example.com",
    "//evil.example",
    "/\\evil.example",
  ])
    assert.equal(contentUrl(url), "");
  assert.equal(contentUrl("/assets/art.png"), "/assets/art.png");
  const data = clone(defaults.tour);
  data.items[0].date = "2026-02-30";
  assert.throws(() => validateSection("tour", data));
  data.items[0].date = "2026-10-03";
  data.items[1].id = data.items[0].id;
  assert.throws(() => validateSection("tour", data));
  assert.equal(youtubeId("https://evil.example/watch?v=Pyn5b6m_Fac"), "");
});
test("all public page headers expose four links and preserve About outside navigation", () => {
  const paths = [
    "index.html",
    "releases/index.html",
    "tour/index.html",
    "gallery/index.html",
    "about/index.html",
    "shop/index.html",
    "account/index.html",
    "cart/index.html",
  ];
  for (const path of paths) {
    const text = fs.readFileSync(path, "utf8");
    const nav = text.match(
      /<nav[^>]*id="site-navigation"[^>]*>([\s\S]*?)<\/nav>/,
    )[1];
    assert.equal((nav.match(/<a /g) || []).length, 4, path);
    assert.doesNotMatch(nav, /about\//);
    const schema = JSON.parse(
      text.match(/id="site-schema">([\s\S]*?)<\/script>/)[1],
    );
    assert.equal(schema["@context"], "https://schema.org");
  }
  assert.ok(fs.existsSync("about/index.html"));
  assert.doesNotMatch(fs.readFileSync("script.js", "utf8"), /release-popup/);
});
