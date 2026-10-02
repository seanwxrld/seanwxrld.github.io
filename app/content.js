import { defaults } from "./content-data.js";
import {
  clone,
  sectionNames,
  renderHome,
  renderReleases,
  renderTour,
  renderVisuals,
  structuredData,
  contentUrl,
  validateSection,
  dateLabel,
} from "./content-model.js";
import { escapeHtml as e } from "./core.js";
const data = clone(defaults);
const path = location.pathname;
const renderers = {
  home: renderHome,
  releases: renderReleases,
  tour: renderTour,
  visuals: renderVisuals,
};
const rendered = new WeakMap();
function render() {
  const announcement = data.releases.items.find(
    (r) => r.id === data.home.announcementRelease && r.status !== "hidden",
  );
  document
    .querySelectorAll("[data-announcement-title]")
    .forEach(
      (el) => (el.textContent = announcement?.title || "The next chapter."),
    );
  document
    .querySelectorAll("[data-announcement-date]")
    .forEach(
      (el) =>
        (el.textContent = announcement
          ? announcement.status === "upcoming"
            ? "Coming " + dateLabel(announcement.date)
            : "Out now"
          : "Join Swarm for the next announcement."),
    );
  for (const el of document.querySelectorAll("[data-content-view]")) {
    const renderer = renderers[el.dataset.contentView];
    if (renderer) {
      const html = renderer(data);
      if (rendered.get(el) !== html) {
        el.innerHTML = html;
        rendered.set(el, html);
      }
    }
  }
  document.querySelectorAll("[data-copy]").forEach((el) => {
    const [group, key] = el.dataset.copy.split(".");
    if (data[group]?.[key] !== undefined) el.textContent = data[group][key];
  });
  document.querySelectorAll("[data-about-body]").forEach((el) => {
    el.innerHTML = data.pages.aboutBody
      .split(/\n\s*\n/)
      .map((p) => `<p class="lead">${e(p)}</p>`)
      .join("");
  });
  document.querySelectorAll("[data-social-links]").forEach((el) => {
    el.innerHTML = data.settings.socials
      .filter((s) => contentUrl(s.url))
      .map(
        (s) =>
          `<a href="${e(contentUrl(s.url))}" target="_blank" rel="noopener noreferrer">${e(s.label)}</a>`,
      )
      .join("");
  });
  document
    .querySelectorAll("[data-artist-name]")
    .forEach((el) => (el.textContent = data.settings.artistName));
  let schema = document.querySelector("#site-schema");
  if (!schema) {
    schema = document.createElement("script");
    schema.type = "application/ld+json";
    schema.id = "site-schema";
    document.head.append(schema);
  }
  schema.textContent = JSON.stringify(structuredData(data, path));
  if (path === "/")
    document
      .querySelector("meta[name=description]")
      ?.setAttribute("content", data.settings.description);
  const pageNames = {
    "/": "Official Site",
    "/releases/": "Releases",
    "/tour/": "Tour",
    "/gallery/": "Visuals",
    "/about/": "About",
    "/shop/": "Store",
    "/swarm/": "Swarm",
    "/contact/": "Contact",
  };
  if (pageNames[path]) {
    document.title = `${data.settings.artistName} · ${pageNames[path]}`;
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute("content", document.title);
  }
}
// The HTML already contains the same content for search engines and network failures.
render();
async function connect() {
  const [{ db }, { collection, onSnapshot }] = await Promise.all([
    import("./firebase.js"),
    import("https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js"),
  ]);
  onSnapshot(
    collection(db, "site_content"),
    (snapshot) => {
      const fresh = clone(defaults);
      for (const doc of snapshot.docs) {
        if (!sectionNames.includes(doc.id)) continue;
        try {
          fresh[doc.id] = validateSection(doc.id, {
            ...fresh[doc.id],
            ...doc.data().content,
          });
        } catch {
          /* Keep the last bundled section if a document is invalid. */
        }
      }
      Object.assign(data, fresh);
      render();
    },
    () => {
      /* Static content remains available if Firestore is offline. */
    },
  );
}
connect().catch(() => {});
