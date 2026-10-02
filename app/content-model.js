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
  const h = data.home;
  const releases = ordered(data.releases.items);
  const feature = releases.find((r) => r.id === h.featuredRelease);
  const announcement = releases.find((r) => r.id === h.announcementRelease);
  const nextShow = [...data.tour.items]
    .filter((x) => x.status !== "hidden" && x.status !== "cancelled")
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return `<section class="world-opening"><div class="index-line"><span>THE OFFICIAL WEBSITE</span><span>${e(h.eyebrow)}</span></div><div class="world-title"><h1>${e(h.heading).replaceAll("\n", "<br> ")}</h1><span class="edition-mark" aria-hidden="true">SM<br>©26</span></div><div class="world-intro"><p>${e(h.intro)}</p><a href="#current" class="text-link">Explore the world <span>↓</span></a></div></section>
  <section id="current" class="current-world"><figure class="artist-frame">${image(h.image, data.settings.artistName, "", true)}<figcaption><span>01 / PORTRAIT</span><span>${e(h.imageCaption)}</span></figcaption></figure><div class="current-notes">${feature ? `<article class="now-playing"><div class="index-line"><span>ON REPEAT</span><span>${e(kindLabel(feature.kind))}</span></div><h2>${e(feature.title)}</h2><p>${e(feature.description)}</p>${link(feature.link, feature.linkLabel || "Explore release")}<a class="record-index" href="/releases/#${e(feature.id)}">View release notes ↗</a></article>` : ""}${h.showAnnouncement && announcement ? `<article class="announcement"><p class="eyebrow">NEXT CHAPTER / ${e(releaseStatus(announcement))}</p><h2>${e(announcement.title)}</h2><div class="announcement-foot"><span class="release-day">${announcement.date ? e(announcement.date.slice(8, 10) + "." + announcement.date.slice(5, 7)) : "SOON"}</span><a class="text-link" href="/releases/#${e(announcement.id)}">The details ↗</a></div></article>` : ""}</div></section>
  <section class="world-directory" aria-label="Explore"><a href="/tour/"><span class="eyebrow">02 / IN PERSON & ONLINE</span><h2>SEE YOU LIVE.</h2><p>${nextShow ? e(data.tour.series) : "The next moment."}</p><span aria-hidden="true">↗</span></a><a href="/gallery/"><span class="eyebrow">03 / THE MOVING IMAGE</span><h2>IN FRAME.</h2><p>Watch the world unfold.</p><span aria-hidden="true">↗</span></a><a href="/shop/"><span class="eyebrow">04 / OBJECTS TO KEEP</span><h2>THE STORE.</h2><p>A piece of the world.</p><span aria-hidden="true">↗</span></a></section>`;
}

export function renderReleases(data) {
  const releases = ordered(data.releases.items);
  return `<section class="archive-heading"><div class="index-line"><span>AUDIO / THE CATALOGUE</span><span>${String(releases.length).padStart(2, "0")} RECORDS</span></div><h1>${e(data.releases.title)}</h1><p>${e(data.releases.intro)}</p></section><section class="record-grid" aria-label="Music releases">${releases
    .map(
      (r, i) =>
        `<article class="record-entry ${r.status === "upcoming" ? "record-upcoming" : ""}" id="${e(r.id)}"><div class="record-art">${r.image ? image(r.image, `${r.title} cover art`) : `<div class="record-placeholder"><span>FORTHCOMING</span><strong>${r.date ? e(r.date.slice(8, 10) + "." + r.date.slice(5, 7)) : "SOON"}</strong><span>${e(r.date.slice(0, 4))}</span></div>`}<span class="record-number">${String(i + 1).padStart(2, "0")}</span></div>${r.id === "genie" ? '<span id="dopamine-high"></span>' : ""}<div class="record-meta"><span>${e(kindLabel(r.kind))}</span><span>${e(releaseStatus(r))}</span></div><h2>${e(r.title)}</h2><p>${e(r.description)}</p>${link(r.link, r.linkLabel || "Listen now")}${
          r.tracks || r.credits
            ? `<details class="record-details"><summary>Tracklist & credits <span>+</span></summary>${
                r.tracks
                  ? `<ol>${lines(r.tracks)
                      .map((t) => `<li>${e(t)}</li>`)
                      .join("")}</ol>`
                  : ""
              }${r.credits ? `<p>${e(r.credits)}</p>` : ""}</details>`
            : ""
        }</article>`,
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
  return `<section class="archive-heading"><div class="index-line"><span>VIDEO / STILLS / MOMENTS</span><span>THE VISUAL ARCHIVE</span></div><h1>${e(data.visuals.title)}</h1><p>${e(data.visuals.intro)}</p></section><section class="visual-archive">${ordered(
    data.visuals.items,
  )
    .map(
      (v, i) =>
        `<article class="visual-entry"><div class="visual-screen">${youtubeId(v.url) ? `<iframe src="https://www.youtube-nocookie.com/embed/${youtubeId(v.url)}?rel=0" title="${e(v.title)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>` : image(v.image, v.title)}</div><div class="visual-caption"><span class="eyebrow">${String(i + 1).padStart(2, "0")} / ${e(v.kind)}</span><h2>${e(v.title)}</h2><p>${e(v.description)}</p>${link(v.url, "Watch")}</div></article>`,
    )
    .join("")}</section>`;
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
