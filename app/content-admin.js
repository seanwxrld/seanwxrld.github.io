import { db } from "./firebase.js";
import {
  collection,
  onSnapshot,
  doc,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { defaults } from "./content-data.js";
import { clone, validateSection, contentUrl } from "./content-model.js";
import { escapeHtml as e } from "./core.js";

const $ = (s) => document.querySelector(s);
const names = {
  home: "Homepage",
  releases: "Releases",
  tour: "Tour & dates",
  visuals: "Visuals",
  shop: "Store page",
  pages: "About, Contact & Swarm",
  settings: "Artist & social links",
};
const field = (name, label, type = "text", extra = {}) => ({
  name,
  label,
  type,
  ...extra,
});
const pageFields = {
  home: [
    field("eyebrow", "Small heading"),
    field("heading", "Main title", "textarea"),
    field("intro", "Introduction", "textarea"),
    field("image", "Artist photograph", "image"),
    field("imageCaption", "Photo caption"),
    field("featuredRelease", "Featured release", "release"),
    field("showAnnouncement", "Show the release announcement", "checkbox"),
    field("announcementRelease", "Announcement release", "release"),
    field("newsletterTitle", "Newsletter heading"),
    field("newsletterText", "Newsletter invitation", "textarea"),
  ],
  releases: [
    field("title", "Page title"),
    field("intro", "Introduction", "textarea"),
  ],
  tour: [
    field("title", "Main heading"),
    field("accentTitle", "Red heading"),
    field("intro", "Introduction", "textarea"),
    field("series", "Series / tour name"),
    field("subtitle", "Series subtitle"),
    field("description", "Series description", "textarea"),
    field("poster", "Tour poster", "image"),
    field("posterCaption", "Poster caption"),
    field("ticketNote", "Ticket information", "textarea"),
    field("requestUrl", "Request your city link", "url"),
    field("emptyText", "Message when no dates are announced", "textarea"),
  ],
  visuals: [
    field("title", "Page title"),
    field("intro", "Introduction", "textarea"),
  ],
  shop: [
    field("title", "Store title"),
    field("intro", "Introduction", "textarea"),
    field("serviceTitle", "Request section heading"),
    field("serviceText", "Request section text", "textarea"),
  ],
  pages: [
    field("aboutTitle", "About / title"),
    field("aboutBody", "About / biography", "textarea", { rows: 12 }),
    field("contactTitle", "Contact / title"),
    field("contactIntro", "Contact / introduction", "textarea"),
    field("contactNote", "Contact / enquiry guidance", "textarea"),
    field("swarmTitle", "Swarm / title"),
    field("swarmIntro", "Swarm / introduction", "textarea"),
    field("swarmBenefits", "Swarm / benefits", "textarea"),
  ],
  settings: [
    field("artistName", "Artist name"),
    field("description", "Search description", "textarea"),
    field("artistImage", "Artist image", "image"),
    field("genres", "Genres (separate with commas)"),
    field("location", "Based in"),
    field("socials", "Social and streaming links", "socials"),
  ],
};
const entries = {
  releases: [
    field("title", "Release title", "text", { required: true }),
    field("kind", "Format", "select", {
      options: ["single", "ep", "album", "bundle", "mixtape"],
    }),
    field("status", "Visibility / release status", "select", {
      options: ["released", "upcoming", "archive", "hidden"],
    }),
    field("date", "Release date", "date"),
    field("image", "Cover artwork", "image"),
    field("description", "Release note", "textarea"),
    field("link", "Listening or pre-save link", "url"),
    field("linkLabel", "Link label"),
    field("tracks", "Tracklist (one track per line)", "textarea"),
    field("credits", "Credits", "textarea"),
    field("order", "Display order", "number", { min: 0, max: 999 }),
  ],
  tour: [
    field("title", "Performance name", "text", { required: true }),
    field("date", "Date", "date", { required: true }),
    field("time", "Start time (optional)", "time"),
    field("timezone", "Time zone"),
    field("venue", "Venue / platform"),
    field("city", "City"),
    field("online", "Online performance", "checkbox"),
    field("link", "Ticket / event link", "url"),
    field("status", "Status", "select", {
      options: ["scheduled", "soldout", "cancelled", "hidden"],
    }),
  ],
  visuals: [
    field("title", "Title", "text", { required: true }),
    field("kind", "Type (video, teaser, photograph…)"),
    field("description", "Caption", "textarea"),
    field("url", "YouTube or viewing link", "url"),
    field("image", "Image (for photographs / external videos)", "image"),
    field("status", "Visibility", "select", {
      options: ["published", "hidden"],
    }),
    field("order", "Display order", "number", { min: 0, max: 999 }),
  ],
};
let documents = {},
  section = "",
  base = null,
  revision = 0,
  entryId = null,
  dirty = false,
  saving = false,
  stop = null,
  assets = [],
  ready = false;
const status = (msg, error = false) => {
  $("#content-status").textContent = msg;
  $("#content-status").dataset.error = error;
};
const markDirty = (value) => {
  dirty = value;
  $("#content-unsaved").hidden = !value;
};
export const contentHasChanges = () => dirty;
export const canLeaveContent = () =>
  !dirty || confirm("Discard your unsaved changes?");
export function resetContentEditor() {
  showMenu();
}
function fieldHtml(f, data) {
  let value = data[f.name] ?? "",
    control;
  const attr = `name="${f.name}" ${f.required ? "required" : ""}`;
  if (f.type === "checkbox")
    return `<label class="check"><input ${attr} type="checkbox" ${value ? "checked" : ""}>${e(f.label)}</label>`;
  if (f.type === "select" || f.type === "release") {
    const options =
      f.type === "release"
        ? (documents.releases?.content || defaults.releases).items.map((r) => ({
            value: r.id,
            label: r.title,
          }))
        : f.options.map((v) => ({
            value: v,
            label:
              {
                soldout: "Sold out",
                hidden: "Hidden from public pages",
                archive: "Archive",
                upcoming: "Coming soon",
                released: "Out now",
                ep: "EP",
              }[v] || v[0].toUpperCase() + v.slice(1),
          }));
    control = `<select ${attr}>${options.map((o) => `<option value="${e(o.value)}" ${o.value === value ? "selected" : ""}>${e(o.label)}</option>`).join("")}</select>`;
  } else if (["textarea", "socials"].includes(f.type)) {
    if (f.type === "socials")
      value = (value || []).map((x) => `${x.label} | ${x.url}`).join("\n");
    control = `<textarea ${attr} rows="${f.rows || 4}" maxlength="${f.name === "aboutBody" ? 40000 : 8000}">${e(value)}</textarea>${f.type === "socials" ? "<small>One per line: Instagram | https://instagram.com/yourname</small>" : ""}`;
  } else {
    control = `<input ${attr} type="${f.type === "image" ? "text" : f.type}" value="${e(value)}" ${f.type === "number" ? `min="${f.min}" max="${f.max}" step="1"` : 'maxlength="2000"'}>`;
    if (f.type === "image")
      control += `<select data-asset-for="${f.name}" aria-label="Choose existing artwork for ${e(f.label)}"><option value="">Choose existing artwork…</option>${assets.map((a) => `<option value="${e(a.url)}">${e(a.label)}</option>`).join("")}</select><small>Choose an existing image or paste an HTTPS image link. Leave blank for a type-only cover.</small>`;
  }
  return `<label>${e(f.label)}${control}</label>`;
}
function wireForm(form, specs) {
  form.oninput = () => markDirty(true);
  form.onchange = () => markDirty(true);
  form.querySelectorAll("[data-asset-for]").forEach(
    (select) =>
      (select.onchange = () => {
        if (select.value) {
          form.elements.namedItem(select.dataset.assetFor).value = select.value;
          markDirty(true);
        }
      }),
  );
  return () => {
    const payload = {};
    for (const f of specs) {
      const input = form.elements.namedItem(f.name);
      payload[f.name] =
        f.type === "checkbox"
          ? input.checked
          : f.type === "number"
            ? Number(input.value)
            : input.value.trim();
      if (f.type === "socials")
        payload[f.name] = input.value
          .split("\n")
          .filter((x) => x.trim())
          .map((line) => {
            const parts = line.split("|");
            if (parts.length !== 2 || !contentUrl(parts[1].trim()))
              throw new Error("Use one Label | HTTPS link per line.");
            return { label: parts[0].trim(), url: parts[1].trim() };
          });
    }
    return payload;
  };
}
function current() {
  return (
    documents[section] || { content: clone(defaults[section]), revision: 0 }
  );
}
function takeSnapshot() {
  const d = current();
  base = clone(d.content);
  revision = d.revision || 0;
  markDirty(false);
}
function showMenu() {
  section = "";
  base = null;
  entryId = null;
  markDirty(false);
  $("#content-menu").hidden = false;
  $("#content-editor").hidden = true;
  status("");
}
export function openContentSection(name) {
  if (!ready) {
    status("Connecting to your content…");
    return;
  }
  if (!canLeaveContent()) return;
  section = name;
  takeSnapshot();
  renderSection();
}
function renderSection() {
  $("#content-menu").hidden = true;
  $("#content-editor").hidden = false;
  $("#content-heading").textContent = names[section];
  $("#content-back").textContent = "← Website";
  $("#content-back").onclick = () => {
    if (canLeaveContent()) showMenu();
  };
  const hasItems = !!entries[section];
  $("#content-body").innerHTML =
    `${hasItems ? `<div class="row spread content-list-head"><p class="muted">${base.items.length} entries. Tap one to edit.</p><button id="add-content-entry" class="solid">Add ${section === "tour" ? "date" : section === "visuals" ? "visual" : "release"} +</button></div><div class="content-list">${base.items.map((r) => `<button class="content-row" data-edit-entry="${e(r.id)}"><span><strong>${e(r.title)}</strong><small>${e(r.date || r.kind || "")} · ${e(r.status)}</small></span><span>↗</span></button>`).join("") || '<p class="empty">Your next chapter starts here. Add the first entry.</p>'}</div><details class="page-options"><summary>Page title, images & introduction <span>+</span></summary>` : ""}<form id="section-form" class="content-form">${pageFields[section].map((f) => fieldHtml(f, base)).join("")}<div class="save-bar"><span>Changes appear on the website when saved.</span><button class="solid" type="submit">Save page changes</button></div></form>${hasItems ? "</details>" : ""}`;
  const form = $("#section-form"),
    read = wireForm(form, pageFields[section]);
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    try {
      await save({ ...base, ...read() }, form);
      if (!dirty) renderSection();
    } catch (err) {
      status(err.message, true);
    }
  };
  $("#add-content-entry")?.addEventListener("click", () => editEntry());
  document
    .querySelectorAll("[data-edit-entry]")
    .forEach((b) => (b.onclick = () => editEntry(b.dataset.editEntry)));
}
function editEntry(id) {
  if (!canLeaveContent()) return;
  markDirty(false);
  entryId = id || null;
  const record =
    base.items.find((x) => x.id === id) ||
    (section === "tour"
      ? { timezone: "Africa/Johannesburg", online: false, status: "scheduled" }
      : section === "releases"
        ? { kind: "single", status: "upcoming", order: base.items.length + 1 }
        : { status: "published", order: base.items.length + 1 });
  $("#content-heading").textContent = id
    ? "Edit " +
      (section === "tour"
        ? "performance"
        : section === "visuals"
          ? "visual"
          : "release")
    : "Add " +
      (section === "tour"
        ? "performance"
        : section === "visuals"
          ? "visual"
          : "release");
  $("#content-back").textContent = `← ${names[section]}`;
  $("#content-back").onclick = () => {
    if (canLeaveContent()) {
      markDirty(false);
      renderSection();
    }
  };
  $("#content-body").innerHTML =
    `<form id="entry-form" class="content-form">${entries[section].map((f) => fieldHtml(f, record)).join("")}<p class="fine-print">Hidden entries stay in Backstage and are excluded from the public website.</p><div class="save-bar"><span>Save to update the website.</span><button class="solid" type="submit">Save ${section === "tour" ? "date" : section === "visuals" ? "visual" : "release"}</button></div></form>`;
  const form = $("#entry-form"),
    read = wireForm(form, entries[section]);
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    try {
      const value = {
        ...record,
        ...read(),
        id: entryId || `entry-${crypto.randomUUID().slice(0, 12)}`,
      };
      const next = clone(base);
      const i = next.items.findIndex((x) => x.id === value.id);
      if (i < 0) next.items.push(value);
      else next.items[i] = value;
      await save(next, form);
      if (!dirty) renderSection();
    } catch (err) {
      status(err.message, true);
    }
  };
  $("#content-heading").scrollIntoView({ block: "start" });
}
async function save(content, form) {
  if (saving) return;
  validateSection(section, content);
  saving = true;
  const group = section,
    expected = revision;
  const button = form.querySelector("[type=submit]");
  button.disabled = true;
  status("Saving…");
  try {
    const publicContent = clone(content);
    if (publicContent.items)
      publicContent.items = publicContent.items.filter(
        (r) => r.status !== "hidden",
      );
    await runTransaction(db, async (tx) => {
      const ref = doc(db, "site_content_private", group),
        snap = await tx.get(ref);
      if ((snap.exists() ? snap.data().revision : 0) !== expected)
        throw new Error(
          "This section changed on another device. Your edits are still here. Copy any unsaved text, then reload the section before saving.",
        );
      const metadata = { revision: expected + 1, updatedAt: serverTimestamp() };
      tx.set(ref, { content, ...metadata });
      tx.set(doc(db, "site_content", group), {
        content: publicContent,
        ...metadata,
      });
    });
    base = clone(content);
    revision = expected + 1;
    documents[group] = { content: clone(content), revision };
    markDirty(false);
    status("Saved. Your website is up to date.");
  } catch (err) {
    if (err.code === "permission-denied")
      err.message =
        "Content saving needs the new Firebase content rules published once. Your edits are still here.";
    status(
      err.message || "Could not save. Check your connection and try again.",
      true,
    );
    throw err;
  } finally {
    saving = false;
    button.disabled = false;
  }
}
export function startContentAdmin() {
  stopContentAdmin();
  $("#content-menu").innerHTML = Object.entries(names)
    .map(
      ([id, name], i) =>
        `<button class="workspace-choice" data-content-section="${id}" disabled><span>${String(i + 1).padStart(2, "0")}</span><strong>${e(name)}</strong><span>↗</span></button>`,
    )
    .join("");
  document
    .querySelectorAll("[data-content-section]")
    .forEach(
      (b) => (b.onclick = () => openContentSection(b.dataset.contentSection)),
    );
  showMenu();
  status("Connecting to your content…");
  fetch("/data/assets.json")
    .then((r) => r.json())
    .then((a) => (assets = a))
    .catch(() => {});
  stop = onSnapshot(
    collection(db, "site_content_private"),
    (snap) => {
      documents = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
      ready = true;
      document
        .querySelectorAll("[data-content-section]")
        .forEach((b) => (b.disabled = false));
      if (!section) status("Choose a page to edit.");
    },
    () => {
      ready = false;
      status(
        "Website editing is waiting for its Firebase content rules. Products and the rest of Backstage still work. Publish the included content rules once to enable these editors.",
        true,
      );
    },
  );
}
export function stopContentAdmin() {
  stop?.();
  stop = null;
  ready = false;
  documents = {};
  section = "";
  base = null;
  markDirty(false);
  $("#content-body").innerHTML = "";
}
window.addEventListener("beforeunload", (ev) => {
  if (dirty) {
    ev.preventDefault();
    ev.returnValue = "";
  }
});
