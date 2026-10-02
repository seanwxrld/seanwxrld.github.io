import { escapeHtml as e } from "./core.js";

export const sectionNames = [
  "home",
  "releases",
  "tour",
  "visuals",
  "shop",
  "pages",
  "settings",
];
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const lines = (value = "") =>
  String(value)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
export function contentUrl(value = "") {
  if (!value) return "";
  if (/^\/(?!\/)/.test(value) && !value.includes("\\")) return value;
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}
export const absolute = (value) =>
  value
    ? new URL(contentUrl(value) || "/", "https://seanwxrld.com").href
    : undefined;
export function dateLabel(value, compact = false) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(+date)
    ? ""
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: compact ? "short" : "long",
        year: "numeric",
        timeZone: "UTC",
      });
}
export const ordered = (items) =>
  [...items]
    .filter((x) => x.status !== "hidden")
    .sort((a, b) => (a.order || 0) - (b.order || 0));
export function youtubeId(value = "") {
  try {
    const u = new URL(value);
    const id =
      u.hostname === "youtu.be"
        ? u.pathname.slice(1)
        : /^(www\.)?youtube\.com$/.test(u.hostname)
          ? u.searchParams.get("v") || u.pathname.split("/").pop()
          : "";
    return /^[\w-]{11}$/.test(id || "") ? id : "";
  } catch {
    return "";
  }
}
export function validateSection(name, data) {
  if (
    !sectionNames.includes(name) ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  )
    throw new Error("Choose a valid section.");
  if (new TextEncoder().encode(JSON.stringify(data)).length > 700000)
    throw new Error(
      "This section is too large. Use image links instead of embedded files.",
    );
  for (const [key, value] of Object.entries(data)) {
    if (
      typeof value === "string" &&
      value.length > (key === "aboutBody" ? 40000 : 8000)
    )
      throw new Error(`${key} is too long.`);
  }
  if (data.items) {
    if (!Array.isArray(data.items) || data.items.length > 150)
      throw new Error("A section can contain up to 150 entries.");
    const ids = new Set();
    for (const item of data.items) {
      if (!/^[a-z0-9-]{1,80}$/.test(item.id || "") || ids.has(item.id))
        throw new Error("Each entry needs a unique reference.");
      ids.add(item.id);
      if (!item.title?.trim()) throw new Error("Give every entry a title.");
      if (
        item.date &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
          new Date(`${item.date}T12:00:00Z`).toISOString().slice(0, 10) !==
            item.date)
      )
        throw new Error("Choose a valid date.");
      if (name === "tour" && !item.date)
        throw new Error("Every performance needs a date.");
      if (item.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))
        throw new Error("Choose a valid start time.");
      if (item.timezone) {
        try {
          new Intl.DateTimeFormat("en", { timeZone: item.timezone });
        } catch {
          throw new Error(
            "Use a valid time zone, such as Africa/Johannesburg.",
          );
        }
      }
      if (
        name === "releases" &&
        !["released", "upcoming", "archive", "hidden"].includes(item.status)
      )
        throw new Error("Choose a release status.");
      if (
        name === "tour" &&
        !["scheduled", "soldout", "cancelled", "hidden"].includes(item.status)
      )
        throw new Error("Choose an event status.");
    }
  }
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [key, val] of Object.entries(value)) {
      if (
        typeof val === "string" &&
        /^(url|link|image|poster|artistImage|requestUrl)$/.test(key) &&
        val &&
        !contentUrl(val)
      )
        throw new Error("Use an HTTPS link or an /assets/ path.");
      if (val && typeof val === "object") visit(val);
    }
  };
  visit(data);
  return data;
}
const image = (url, alt, cls = "", eager = false) =>
  contentUrl(url)
    ? `<img class="${cls}" src="${e(contentUrl(url))}" alt="${e(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
    : "";
const link = (url, text, cls = "text-link") =>
  contentUrl(url)
    ? `<a class="${cls}" href="${e(contentUrl(url))}">${e(text)} <span aria-hidden="true">↗</span></a>`
    : "";
const kindLabel = (kind) =>
  ({
    single: "Single",
    ep: "EP",
    album: "Album",
    bundle: "Single bundle",
    mixtape: "Mixtape",
  })[kind] || "Release";
const releaseStatus = (r) =>
  r.status === "upcoming"
    ? `Coming ${dateLabel(r.date)}`
    : r.status === "archive"
      ? "From the archive"
      : "Out now";

export function renderHome(data) {
  const releases = ordered(data.releases.items);
  const feature =
    releases.find((r) => r.id === data.home.featuredRelease) ||
    releases.find((r) => r.status === "released") ||
    releases[0];
  if (!feature)
    return `<section class="home-feature"><h1>Music</h1><a class="listen-button" href="/releases/">View releases</a></section>`;
  return `<section class="home-feature" aria-label="Featured release">
    ${image(feature.image, `${feature.title} cover art`, "home-cover-art", true)}
    <div class="home-release-copy"><h1>${e(feature.title)}</h1>
    <p class="home-release-status">${e(releaseStatus(feature))}</p>
    ${contentUrl(feature.link) ? `<a class="listen-button" href="${e(contentUrl(feature.link))}">${e(feature.linkLabel || "Listen now")}</a>` : `<a class="listen-button" href="/releases/#${e(feature.id)}">View release</a>`}</div>
  </section>`;
}

export function renderReleases(data) {
  const releases = ordered(data.releases.items);
  return `<section class="archive-heading"><h1>${e(data.releases.title)}</h1>${data.releases.intro ? `<p>${e(data.releases.intro)}</p>` : ""}</section><section class="record-grid" aria-label="Music releases">${releases
    .map(
      (
        r,
      ) => `<article class="record-entry ${r.status === "upcoming" ? "record-upcoming" : ""}" id="${e(r.id)}">
      <div class="record-art">${r.image ? image(r.image, `${r.title} cover art`) : `<div class="record-placeholder"><span>Coming</span><strong>${r.date ? e(r.date.slice(8, 10) + "." + r.date.slice(5, 7)) : "Soon"}</strong><span>${e((r.date || "").slice(0, 4))}</span></div>`}</div>
      ${r.id === "genie" ? '<span id="dopamine-high"></span>' : ""}
      <h2>${e(r.title)}</h2><p class="record-status">${e(kindLabel(r.kind))} · ${e(releaseStatus(r))}</p>
      ${link(r.link, r.linkLabel || "Listen now")}
      ${
        r.description || r.tracks || r.credits
          ? `<details class="record-details"><summary>Details <span>+</span></summary>${r.description ? `<p>${e(r.description)}</p>` : ""}${
              r.tracks
                ? `<ol>${lines(r.tracks)
                    .map((t) => `<li>${e(t)}</li>`)
                    .join("")}</ol>`
                : ""
            }${r.credits ? `<p>${e(r.credits)}</p>` : ""}</details>`
          : ""
      }
    </article>`,
    )
    .join("")}</section>`;
}

export function renderTour(
  data,
  today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Johannesburg",
  }),
) {
  const t = data.tour;
  const items = [...t.items]
    .filter((x) => x.status !== "hidden")
    .sort((a, b) => a.date.localeCompare(b.date));
  const dates = (list) =>
    list
      .map(
        (x) =>
          `<li class="tour-date" id="${e(x.id)}"><time datetime="${e(x.date)}"><span class="tour-day">${e(x.date.slice(8, 10))}</span><span>${e(dateLabel(x.date, true).slice(3))}</span></time><div class="tour-date-info"><h3>${e(x.title)}</h3><p>${e([x.venue, x.city, x.time ? `${x.time} (${x.timezone})` : ""].filter(Boolean).join(" · "))}</p></div>${x.status === "cancelled" ? '<span class="tour-state">Cancelled</span>' : x.status === "soldout" ? '<span class="tour-state">Sold out</span>' : link(x.link, x.date < today ? "Details" : "Tickets", "tour-online")}</li>`,
      )
      .join("");
  const future = items.filter((x) => x.date >= today),
    past = items.filter((x) => x.date < today).reverse();
  return `<section class="tour-intro"><div class="index-line"><span>TOUR & LIVE SESSIONS</span><span>THE LIVE ARCHIVE</span></div><h1>${e(t.title)} <span>${e(t.accentTitle)}</span></h1><div class="tour-intro-bottom"><p>${e(t.intro)}</p><a class="text-link" href="#tour-dates">Explore the dates ↓</a></div></section><section class="tour-feature"><figure class="tour-poster">${image(t.poster, t.posterCaption, "", true)}<figcaption>${e(t.posterCaption)}</figcaption></figure><div class="tour-program" id="tour-dates"><p class="tour-label"><span class="tour-dot"></span> Upcoming performances</p><h2>${e(t.series)}<br><span>${e(t.subtitle)}</span></h2><p class="tour-description">${e(t.description)}</p>${future.length ? `<ol class="tour-dates">${dates(future)}</ol>` : `<p class="tour-empty">${e(t.emptyText)}</p>`}<p class="tour-details-note">${e(t.ticketNote)}</p><a class="tour-link" href="/swarm/">Get live updates ↗</a></div></section>${past.length ? `<section class="past-shows"><details><summary>Past performances / ${past.length} <span>+</span></summary><ol class="tour-dates">${dates(past)}</ol></details></section>` : ""}<section class="tour-request"><div><p class="tour-label">THE NEXT STOP COULD BE YOURS</p><h2>YOUR CITY.<br>OUR NEXT STAGE.</h2><p>Tell us where you want to see ${e(data.settings.artistName)} live.</p></div>${link(t.requestUrl, "Request your city", "tour-request-button")}</section>`;
}

export function renderVisuals(data) {
  return `<section class="archive-heading"><h1>${e(data.visuals.title)}</h1>${data.visuals.intro ? `<p>${e(data.visuals.intro)}</p>` : ""}</section><section class="visual-archive">${ordered(
    data.visuals.items,
  )
    .map(
      (v) =>
        `<article class="visual-entry"><div class="visual-screen">${youtubeId(v.url) ? `<iframe src="https://www.youtube-nocookie.com/embed/${youtubeId(v.url)}?rel=0" title="${e(v.title)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>` : image(v.image, v.title)}</div><div class="visual-caption"><h2>${e(v.title)}</h2><p>${e(v.description || v.kind)}</p>${!youtubeId(v.url) ? link(v.url, "View") : ""}</div></article>`,
    )
    .join("")}</section>`;
}

export function renderFooter(data) {
  const socials = data.settings.socials
    .filter((s) => contentUrl(s.url))
    .map(
      (s) =>
        `<a href="${e(contentUrl(s.url))}" target="_blank" rel="noopener noreferrer">${e(s.label)}</a>`,
    )
    .join("");
  return `<footer class="footer"><div class="footer-inner">
    <nav class="footer-site-links" aria-label="Information"><a href="/swarm/">Join Swarm</a><a href="/contact/">Contact</a><a href="/account/">My account</a></nav>
    <nav class="footer-links" data-social-links aria-label="Social and music links">${socials}</nav>
    <div class="footer-bottom"><p>© 2026 <span data-artist-name>${e(data.settings.artistName)}</span></p><nav class="footer-legal" aria-label="Legal"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></nav></div>
  </div></footer>`;
}

export function structuredData(data, path = "/") {
  const s = data.settings,
    origin = "https://seanwxrld.com";
  const artistId = `${origin}/#artist`;
  const releases = ordered(data.releases.items);
  const artist = {
    "@type": "MusicGroup",
    "@id": artistId,
    name: s.artistName,
    alternateName: "SĒAN",
    url: origin,
    image: absolute(s.artistImage),
    description: s.description,
    genre: s.genres
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    foundingLocation: { "@type": "Place", name: s.location },
    sameAs: s.socials.map((x) => contentUrl(x.url)).filter(Boolean),
    album: releases
      .filter((x) => x.kind !== "single")
      .map((x) => ({ "@id": `${origin}/releases/#${x.id}` })),
    track: releases
      .filter((x) => x.kind === "single")
      .map((x) => ({ "@id": `${origin}/releases/#${x.id}` })),
  };
  const graph = [
    artist,
    {
      "@type": "WebSite",
      "@id": `${origin}/#website`,
      url: origin,
      name: s.artistName,
      publisher: { "@id": artistId },
    },
    {
      "@type":
        path === "/about/"
          ? "AboutPage"
          : path === "/releases/"
            ? "CollectionPage"
            : "WebPage",
      "@id": origin + path,
      url: origin + path,
      isPartOf: { "@id": `${origin}/#website` },
      about: { "@id": artistId },
    },
  ];
  if (path === "/" || path === "/releases/")
    for (const r of releases) {
      const tracks = lines(r.tracks);
      graph.push({
        "@type": r.kind === "single" ? "MusicRecording" : "MusicAlbum",
        "@id": `${origin}/releases/#${r.id}`,
        name: r.title,
        url: `${origin}/releases/#${r.id}`,
        byArtist: { "@id": artistId },
        image: absolute(r.image),
        description: r.description,
        ...(r.date ? { datePublished: r.date } : {}),
        ...(r.link ? { sameAs: absolute(r.link) } : {}),
        ...(tracks.length
          ? {
              numTracks: tracks.length,
              track: tracks.map((name, i) => ({
                "@type": "MusicRecording",
                name,
                position: i + 1,
                byArtist: { "@id": artistId },
              })),
            }
          : {}),
      });
    }
  if (path === "/tour/")
    for (const t of data.tour.items.filter((x) => x.status !== "hidden"))
      graph.push({
        "@type": "MusicEvent",
        "@id": `${origin}/tour/#${t.id}`,
        name: t.title,
        startDate: t.date,
        eventStatus:
          t.status === "cancelled"
            ? "https://schema.org/EventCancelled"
            : "https://schema.org/EventScheduled",
        eventAttendanceMode: t.online
          ? "https://schema.org/OnlineEventAttendanceMode"
          : "https://schema.org/OfflineEventAttendanceMode",
        location: t.online
          ? {
              "@type": "VirtualLocation",
              url: absolute(t.link) || origin + "/tour/",
            }
          : { "@type": "Place", name: t.venue, address: t.city },
        performer: { "@id": artistId },
        url: absolute(t.link) || origin + "/tour/",
        image: absolute(data.tour.poster),
      });
  return { "@context": "https://schema.org", "@graph": graph };
}
