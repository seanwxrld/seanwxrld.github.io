import fs from "node:fs/promises";
import path from "node:path";
import { defaults } from "../app/content-data.js";
import {
  renderHome,
  renderReleases,
  renderTour,
  renderVisuals,
  structuredData,
} from "../app/content-model.js";
import { escapeHtml as e } from "../app/core.js";
const renderers = {
  home: renderHome,
  releases: renderReleases,
  tour: renderTour,
  visuals: renderVisuals,
};
async function walk(dir = ".") {
  const files = [];
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    if (
      [
        "node_modules",
        ".git",
        "docs",
        "tests",
        "admin",
        "playwright-results",
      ].includes(item.name)
    )
      continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...(await walk(full)));
    else if (item.name.endsWith(".html")) files.push(full);
  }
  return files;
}
for (const file of await walk()) {
  let html = await fs.readFile(file, "utf8");
  const route = file === "index.html" ? "/" : "/" + path.dirname(file) + "/";
  for (const [name, render] of Object.entries(renderers)) {
    html = html.replace(
      new RegExp(
        `<!-- content:${name}:start -->[\\s\\S]*?<!-- content:${name}:end -->`,
      ),
      `<!-- content:${name}:start --><div data-content-view="${name}">${render(defaults)}</div><!-- content:${name}:end -->`,
    );
  }
  const json = JSON.stringify(structuredData(defaults, route)).replaceAll(
    "<",
    "\\u003c",
  );
  html = html.replace(
    /<!-- schema:start -->[\s\S]*?<!-- schema:end -->/,
    `<!-- schema:start --><script type="application/ld+json" id="site-schema">${json}</script><!-- schema:end -->`,
  );
  html = html.replace(
    /(<([a-z0-9]+)[^>]*data-copy="([^."]+)\.([^".]+)"[^>]*>)[\s\S]*?(<\/\2>)/g,
    (_, start, tag, group, key, end) =>
      start + e(defaults[group]?.[key] || "") + end,
  );
  await fs.writeFile(file, html);
}
console.log("Static content and structured data refreshed.");
