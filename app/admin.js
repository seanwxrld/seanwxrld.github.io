import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { wireAuth, logOut } from "./auth.js";
import { escapeHtml as e, money, safeUrl, newsletterHtml } from "./core.js";
const $ = (s) => document.querySelector(s);
let state = {
  shop_requests: [],
  products: [],
  newsletter_signups: [],
  newsletter_members: [],
  contact_messages: [],
  campaigns: [],
};
let listeners = [],
  generation = 0,
  campaignId = null;
wireAuth($("#auth-form"));
$("#signout").onclick = () => logOut();
$("#login-signout").onclick = () => logOut();
function message(value, error = false) {
  $("#global-status").textContent = value;
  $("#global-status").dataset.error = error;
}
async function action(fn) {
  try {
    await fn();
  } catch (err) {
    message(err.message || "Something went wrong. Please try again.", true);
  }
}
function view(name) {
  document
    .querySelectorAll("[data-panel]")
    .forEach((el) => (el.hidden = el.dataset.panel !== name));
  document
    .querySelectorAll("[data-view]")
    .forEach((el) =>
      el.setAttribute(
        "aria-current",
        el.dataset.view === name ? "page" : "false",
      ),
    );
}
document
  .querySelectorAll("[data-view]")
  .forEach((b) => (b.onclick = () => view(b.dataset.view)));
document
  .querySelectorAll("[data-go]")
  .forEach((b) => (b.onclick = () => view(b.dataset.go)));
document
  .querySelectorAll("[data-close]")
  .forEach(
    (b) => (b.onclick = () => document.getElementById(b.dataset.close).close()),
  );
onAuthStateChanged(auth, async (user) => {
  const current = ++generation;
  listeners.forEach((stop) => stop());
  listeners = [];
  state = {
    shop_requests: [],
    products: [],
    newsletter_signups: [],
    newsletter_members: [],
    contact_messages: [],
    campaigns: [],
  };
  renderAll();
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  $("#request-detail").innerHTML = "";
  $("#product-form").reset();
  $("#newsletter-form").reset();
  campaignId = null;
  preview();
  $("#dashboard").hidden = true;
  $("#login").hidden = false;
  $("#login-signout").hidden = !user;
  $("#access-status").textContent = "";
  if (!user) return;
  try {
    const token = await user.getIdTokenResult(true);
    if (current !== generation) return;
    if (!token.claims.admin) {
      $("#access-status").textContent =
        "This account doesn’t have backstage access. Ask the site owner to enable your admin role.";
      return;
    }
    $("#dashboard").hidden = false;
    $("#login").hidden = true;
    for (const name of Object.keys(state))
      listeners.push(
        onSnapshot(
          collection(db, name),
          (snapshot) => {
            if (current !== generation) return;
            state[name] = snapshot.docs
              .map((s) => ({ id: s.id, ...s.data() }))
              .sort(
                (a, b) =>
                  (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
              );
            renderAll();
          },
          () =>
            message(
              `Unable to load ${name.replaceAll("_", " ")}. Check the connection and Firebase permissions.`,
              true,
            ),
        ),
      );
  } catch {
    if (current === generation)
      $("#access-status").textContent =
        "Unable to check admin access. Please sign out and try again.";
  }
});
const empty = (text) => `<div class="empty">${e(text)}</div>`;
function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}
function requestTable(rows) {
  return rows.length
    ? table(
        ["Customer", "Selection", "Status", ""],
        rows.map(
          (r) =>
            `<tr><td><strong>${e(r.name)}</strong><br><span class="muted">${e(r.email)}</span></td><td>${e(r.items?.map((l) => `${l.name} × ${l.quantity}`).join(", ") || r.item || "Product request")}<br><span class="muted">${r.totalCents != null ? money(r.totalCents) : e(r.price || "")}</span></td><td><span class="pill">${e(r.status || "pending")}</span></td><td><button data-request="${e(r.id)}">Open ↗</button></td></tr>`,
        ),
      )
    : empty("No requests here yet.");
}
function wireRequests() {
  document
    .querySelectorAll("[data-request]")
    .forEach((b) => (b.onclick = () => openRequest(b.dataset.request)));
}
function openRequest(key) {
  const r = state.shop_requests.find((r) => r.id === key);
  if (!r) return;
  $("#request-detail").innerHTML =
    `<p class="eyebrow">${e(key.slice(0, 10).toUpperCase())}</p><h3>${e(r.name)}</h3><p>${e(r.email)}</p><div class="receipt">${e(r.items?.map((l) => `${l.name} / ${l.option} × ${l.quantity} — ${money(l.priceCents * l.quantity)}`).join("\n") || `${r.item || ""} / ${r.size || ""} × ${r.quantity || 1}`)}</div><h3>Shipping address</h3><p class="pre">${e(r.shippingAddress)}</p><h3>Notes</h3><p class="pre">${e(r.notes || "No notes.")}</p><label>Status<select id="detail-status">${["pending", "reviewing", "confirmed", "completed", "cancelled"].map((s) => `<option ${s === (r.status || "pending") ? "selected" : ""}>${s}</option>`).join("")}</select></label><p class="fine-print">Status changes do not send an email or deduct stock. Contact the customer and adjust stock when needed.</p><button class="solid" id="save-request">Save status</button><p class="status" id="request-status" role="status"></p>`;
  $("#save-request").onclick = async () => {
    const b = $("#save-request");
    b.disabled = true;
    try {
      await updateDoc(doc(db, "shop_requests", key), {
        status: $("#detail-status").value,
        updatedAt: serverTimestamp(),
      });
      $("#request-status").textContent = "Status saved.";
    } catch (err) {
      $("#request-status").textContent = err.message;
    } finally {
      b.disabled = false;
    }
  };
  $("#request-dialog").showModal();
}
function renderRequests() {
  const term = $("#request-search").value.toLowerCase();
  const filter = $("#request-filter").value;
  const rows = state.shop_requests.filter(
    (r) =>
      (!filter || (r.status || "pending") === filter) &&
      JSON.stringify(r).toLowerCase().includes(term),
  );
  $("#request-list").innerHTML = requestTable(rows);
  $("#recent-requests").innerHTML = requestTable(
    state.shop_requests.slice(0, 5),
  );
  wireRequests();
}
$("#request-search").oninput = renderRequests;
$("#request-filter").onchange = renderRequests;
function renderProducts() {
  const rows = state.products;
  $("#product-list").innerHTML = rows.length
    ? rows
        .map(
          (p) =>
            `<article class="product-card"><img src="${e(safeUrl(p.image))}" alt="${e(p.name)}"><div class="copy"><div class="row spread"><span class="eyebrow">${e(p.category)}</span><span class="pill">${e(p.status)}</span></div><h3>${e(p.name)}</h3><p class="muted">${money(p.priceCents)} · ${p.stock === null ? "Stock untracked" : `${p.stock} in stock`}</p><button data-edit-product="${e(p.id)}">Edit piece ↗</button></div></article>`,
        )
        .join("")
    : empty(
        "Your collection will appear here. Add your first product or run the initial catalogue import.",
      );
  document
    .querySelectorAll("[data-edit-product]")
    .forEach((b) => (b.onclick = () => editProduct(b.dataset.editProduct)));
}
function editProduct(key) {
  const f = $("#product-form");
  f.reset();
  f.querySelector("[role=status]").textContent = "";
  const p = state.products.find((p) => p.id === key);
  $("#product-dialog-title").textContent = p
    ? "Edit your piece."
    : "Add a piece.";
  if (p) {
    for (const [k, v] of Object.entries(p))
      if (f.elements.namedItem(k))
        f.elements.namedItem(k).value = Array.isArray(v)
          ? v.join(", ")
          : (v ?? "");
    f.elements.price.value = (p.priceCents / 100).toFixed(2);
  } else f.elements.id.value = "";
  $("#product-dialog").showModal();
}
$("#add-product").onclick = () => editProduct();
$("#product-form").onsubmit = async (event) => {
  event.preventDefault();
  const f = event.currentTarget;
  if (!f.reportValidity()) return;
  const button = f.querySelector("[type=submit]");
  const status = f.querySelector("[role=status]");
  button.disabled = true;
  status.textContent = "Saving…";
  try {
    const d = Object.fromEntries(new FormData(f));
    const payload = {
      name: d.name,
      description: d.description,
      image: d.image,
      category: d.category,
      priceCents: Math.round(Number(d.price) * 100),
      options: d.options
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      status: d.status,
      stock: d.stock === "" ? null : Number(d.stock),
      updatedAt: serverTimestamp(),
    };
    if (d.id) await setDoc(doc(db, "products", d.id), payload, { merge: true });
    else await addDoc(collection(db, "products"), payload);
    $("#product-dialog").close();
    message("Product saved. The store will update automatically.");
  } catch (err) {
    status.textContent = err.message;
  } finally {
    button.disabled = false;
  }
};
$("#product-image").onchange = () => {
  $("#product-form [role=status]").textContent =
    "Image upload is disabled in the free setup. Use an existing /assets/ path or an HTTPS image URL.";
  $("#product-image").value = "";
};
function renderContacts() {
  const term = $("#contact-search").value.toLowerCase();
  const rows = [...state.newsletter_signups, ...state.newsletter_members].filter((c) =>
    `${c.email} ${c.interest}`.toLowerCase().includes(term),
  );
  $("#subscriber-list").innerHTML = rows.length
    ? table(
        ["Email", "Interest / source", "Newsletter status", ""],
        rows.map(
          (c) =>
            `<tr><td>${e(c.email)}</td><td>${e(c.interest || "—")}<br><span class="muted">${e(c.source)}</span></td><td>${e(c.status || "legacy · consent review")}</td><td>${c.status === "unsubscribed" ? "" : `<button data-suppress="${e(c.id)}">Unsubscribe</button>`}</td></tr>`,
        ),
      )
    : empty("No matching sign-ups.");
  document.querySelectorAll("[data-suppress]").forEach(
    (b) =>
      (b.onclick = () =>
        action(async () => {
          const c = state.newsletter_signups.find(
            (c) => c.id === b.dataset.suppress,
          );
          if (confirm(`Unsubscribe ${c.email} from future newsletters?`))
            await updateDoc(
              doc(db, state.newsletter_members.some((x) => x.id === c.id) ? "newsletter_members" : "newsletter_signups", c.id),
              { status: "unsubscribed", consent: false, updatedAt: serverTimestamp() },
            );
        })),
  );
  const messages = state.contact_messages.filter((c) =>
    `${c.name} ${c.email} ${c.message}`.toLowerCase().includes(term),
  );
  $("#message-list").innerHTML = messages.length
    ? table(
        ["From", "Message", "Status", ""],
        messages.map(
          (c) =>
            `<tr><td><strong>${e(c.name)}</strong><br>${e(c.email)}</td><td><strong>${e(c.interest)}</strong><p class="pre">${e(c.message)}</p></td><td>${e(c.status)}</td><td><button data-handle="${e(c.id)}">${c.status === "handled" ? "Reopen" : "Mark handled"}</button></td></tr>`,
        ),
      )
    : empty("No matching messages.");
  document.querySelectorAll("[data-handle]").forEach(
    (b) =>
      (b.onclick = () =>
        action(async () => {
          const c = state.contact_messages.find(
            (c) => c.id === b.dataset.handle,
          );
          await updateDoc(doc(db, "contact_messages", c.id), {
            status: c.status === "handled" ? "new" : "handled",
            updatedAt: serverTimestamp(),
          });
        })),
  );
}
$("#contact-search").oninput = renderContacts;
function download(name, body, type) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("#export-contacts").onclick = () => {
  const cell = (v) =>
    '"' +
    String(v || "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const rows = [
    ["Email", "Interest", "Source", "Status"],
    ...[...state.newsletter_signups, ...state.newsletter_members].map((c) => [
      c.email,
      c.interest,
      c.source,
      c.status || "legacy",
    ]),
  ];
  download(
    "swarm-subscribers.csv",
    "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
};
const draft = () => Object.fromEntries(new FormData($("#newsletter-form")));
function preview() {
  const d = draft();
  const html = d.html || newsletterHtml(d);
  $("#email-preview").srcdoc =
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src https: data:; style-src 'unsafe-inline';\">" +
    html;
}
$("#newsletter-form").oninput = preview;
preview();
async function saveDraft() {
  if (!$("#newsletter-form").reportValidity())
    throw new Error("Complete your subject, headline and message.");
  const data = { ...draft(), status: "draft", updatedAt: serverTimestamp() };
  if (campaignId) {
    await setDoc(doc(db, "campaigns", campaignId), data, { merge: true });
  } else {
    const ref = await addDoc(collection(db, "campaigns"), {
      ...data,
      createdAt: serverTimestamp(),
    });
    campaignId = ref.id;
  }
  $("#email-status").textContent = "Draft saved.";
  return campaignId;
}
$("#newsletter-form").onsubmit = async (event) => {
  event.preventDefault();
  const b = event.currentTarget.querySelector("[type=submit]");
  b.disabled = true;
  try {
    await saveDraft();
  } catch (err) {
    $("#email-status").textContent = err.message;
  } finally {
    b.disabled = false;
  }
};
$("#download-html").onclick = () => {
  const d = draft();
  download(
    "sean-newsletter.html",
    d.html || newsletterHtml(d, "{{unsubscribe_url}}"),
    "text/html",
  );
  $("#email-status").textContent =
    "HTML exported. Your sending service must replace {{unsubscribe_url}} with a recipient unsubscribe link.";
};
$("#test-email").onclick = () => {
  $("#email-status").textContent =
    "Email sending is disabled in the free setup. Export the HTML and send it with your preferred email service.";
};
$("#queue-email").onclick = () => {
  $("#email-status").textContent =
    "Scheduled sending needs a server/email provider and is disabled in the free setup. Your draft and HTML export still work.";
};
$("#new-draft").onclick = () => {
  if (!confirm("Start a new draft? Unsaved edits will be cleared.")) return;
  campaignId = null;
  $("#newsletter-form").reset();
  $("#email-status").textContent = "New draft.";
  preview();
};
function renderCampaigns() {
  const rows = state.campaigns;
  $("#campaign-list").innerHTML = rows.length
    ? table(
        ["Subject", "Status", "Progress", ""],
        rows.map(
          (c) =>
            `<tr><td>${e(c.subject)}${c.error ? `<p class="danger">${e(c.error)}</p>` : ""}</td><td>${e(c.status)}</td><td>${c.sent || 0} accepted by email service<br><span class="muted">${c.skipped || 0} skipped</span></td><td>${c.status === "draft" ? `<button data-draft="${e(c.id)}">Edit draft</button>` : ""}${c.status === "queued" ? `<button data-cancel="${e(c.id)}">Cancel remaining sends</button>` : ""}</td></tr>`,
        ),
      )
    : empty("Your first note starts here. Save a draft above.");
  document.querySelectorAll("[data-draft]").forEach(
    (b) =>
      (b.onclick = () => {
        const c = state.campaigns.find((c) => c.id === b.dataset.draft);
        campaignId = c.id;
        for (const [k, v] of Object.entries(c))
          if ($("#newsletter-form").elements.namedItem(k))
            $("#newsletter-form").elements.namedItem(k).value = v;
        preview();
        $("#newsletter-form").scrollIntoView({ behavior: "smooth" });
      }),
  );
  document.querySelectorAll("[data-cancel]").forEach(
    (b) =>
      (b.onclick = () =>
        action(async () => {
          if (
            confirm(
              "Cancel remaining sends? Emails already sent cannot be recalled.",
            )
          )
            await updateDoc(doc(db, "campaigns", b.dataset.cancel), {
              status: "cancelled",
              updatedAt: serverTimestamp(),
            });
        })),
  );
}
function renderAll() {
  $("#metric-requests").textContent = state.shop_requests.filter(
    (r) => !r.status || r.status === "pending",
  ).length;
  $("#metric-people").textContent = state.newsletter_signups.length;
  $("#metric-products").textContent = state.products.length;
  renderRequests();
  renderProducts();
  renderContacts();
  renderCampaigns();
}
