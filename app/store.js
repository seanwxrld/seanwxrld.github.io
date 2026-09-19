import { auth, db, call } from "./firebase.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { cleanCart, escapeHtml as e, money, safeUrl } from "./core.js";
const KEY = "sean-cart-v1";
let items = [];
try {
  items = cleanCart(JSON.parse(localStorage.getItem(KEY) || "[]"));
} catch {}
let products = new Map(),
  catalogLoaded = false,
  cartUser = null;
let sync = Promise.resolve();
let revision = 0;
const META = KEY + "-sync";
function syncMeta(value) {
  try {
    localStorage.setItem(META, JSON.stringify(value));
  } catch {}
}
function readMeta() {
  try {
    return JSON.parse(localStorage.getItem(META) || "{}");
  } catch {
    return {};
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
  document
    .querySelectorAll("[data-cart-count]")
    .forEach(
      (el) => (el.textContent = items.reduce((n, l) => n + l.quantity, 0)),
    );
  if (cartUser) {
    const uid = cartUser;
    const copy = structuredClone(items);
    const version = ++revision;
    syncMeta({ owner: uid, dirty: true });
    sync = sync
      .catch(() => {})
      .then(async () => {
        if (auth.currentUser?.uid === uid) {
          await call("saveCart", { items: copy });
          if (version === revision) syncMeta({ owner: uid, dirty: false });
        }
      })
      .catch(() => {
        const el = document.querySelector("#cart-sync");
        if (el)
          el.textContent =
            "Saved on this device. Account sync is unavailable; try again later.";
      });
  }
}
onAuthStateChanged(auth, async (user) => {
  cartUser = null;
  if (!user) return;
  try {
    const s = await getDoc(doc(db, "member_carts", user.uid));
    if (auth.currentUser?.uid !== user.uid) return;
    const remote = cleanCart(s.data()?.items || []);
    const meta = readMeta();
    if (s.exists() && meta.owner === user.uid && !meta.dirty) {
      items = remote; // The account cart wins over an older clean copy on this device.
    } else {
      const merged = new Map(
        remote.map((l) => [`${l.productId}:${l.option}`, l]),
      );
      for (const l of items) merged.set(`${l.productId}:${l.option}`, l);
      items = cleanCart([...merged.values()]);
    }
    cartUser = user.uid;
    save();
    renderCart();
  } catch {
    const el = document.querySelector("#cart-sync");
    if (el)
      el.textContent =
        "Could not load your account cart. Your local cart is still available.";
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === KEY) {
    try {
      items = cleanCart(JSON.parse(event.newValue || "[]"));
    } catch {
      items = [];
    }
    save();
    renderCart();
  }
});
function card(p) {
  return `<article class="premium-item"><a class="premium-art" href="/shop/product/?id=${encodeURIComponent(p.id)}"><img src="${e(safeUrl(p.image))}" alt="${e(p.name)}" loading="lazy"><span class="object-index">${e(p.category.toUpperCase())}</span></a><div class="item-heading"><h3><a href="/shop/product/?id=${encodeURIComponent(p.id)}">${e(p.name)}</a></h3><span>${money(p.priceCents)}</span></div><p>${e(p.description)}</p><div class="item-bottom"><span>${stockLabel(p)}</span><a href="/shop/product/?id=${encodeURIComponent(p.id)}">View item ↗</a></div></article>`;
}
function stockLabel(p) {
  return (
    {
      available: p.stock === 0 ? "Sold out" : "Available",
      requests: "Availability requests open",
      soldout: "Sold out",
      hidden: "Unavailable",
    }[p.status] || "Unavailable"
  );
}
const existing = {
  "/shop/SeanLayeredShirt/": "layered-shirt",
  "/shop/SeanRetoShirt/": "retro-shirt",
  "/shop/CD/": "avenue-cd",
};
const currentId =
  new URLSearchParams(location.search).get("id") || existing[location.pathname];
function renderCatalog() {
  const category = location.pathname.includes("/merch/")
    ? "apparel"
    : location.pathname.includes("/music/")
      ? "music"
      : null;
  document.querySelectorAll(".premium-grid").forEach((grid) => {
    const list = [...products.values()].filter(
      (p) => (!category || p.category === category) && p.id !== currentId,
    );
    grid.innerHTML = list.length
      ? list.map(card).join("")
      : '<p class="dynamic-message">No items in this collection just yet.</p>';
    const count = grid
      .closest(".store-collection")
      ?.querySelector(".collection-heading > span");
    if (count)
      count.textContent = `${String(list.length).padStart(2, "0")} OBJECTS`;
  });
  if (!currentId) {
    if (location.pathname === "/shop/product/") {
      const panel = document.querySelector(".store-product-panel");
      if (panel)
        panel.innerHTML =
          '<h1>Choose your piece.</h1><a href="/shop/">Explore the collection ↗</a>';
    }
    return;
  }
  const panel = document.querySelector(".store-product-panel");
  if (!panel) return;
  const p = products.get(currentId);
  if (!p) {
    panel.innerHTML =
      '<p class="eyebrow">THE COLLECTION</p><h1>Item unavailable.</h1><p>This piece is no longer listed.</p><a href="/shop/">Explore the store ↗</a>';
    return;
  }
  const img = document.querySelector(".store-product-image img");
  if (img) {
    img.src = safeUrl(p.image);
    img.alt = p.name;
  }
  panel.innerHTML = `<p class="eyebrow">OFFICIAL COLLECTION</p><h1 id="product-title">${e(p.name)}</h1><p class="store-item-meta">${e(p.category)} · ${stockLabel(p)}</p><strong class="store-price">${money(p.priceCents)}</strong><p class="lead">${e(p.description)}</p><form class="cart-controls"><label>Option<select name="option">${p.options.map((o) => `<option>${e(o)}</option>`).join("")}</select></label><label>Quantity<input name="quantity" type="number" min="1" max="20" value="1" required></label><button class="solid" ${p.status === "soldout" || (p.status === "available" && p.stock === 0) ? "disabled" : ""}>ADD TO REQUEST CART ↗</button><p role="status"></p></form><p class="request-note">A request is not a confirmed order. Availability and shipping are confirmed personally. Prices in USD.</p><a href="/cart/">View your cart ↗</a>`;
  panel.querySelector("form").onsubmit = (event) => {
    event.preventDefault();
    const f = event.currentTarget;
    const data = new FormData(f);
    const option = data.get("option");
    const quantity = Number(data.get("quantity"));
    const current = items.find(
      (l) => l.productId === p.id && l.option === option,
    );
    if ((current?.quantity || 0) + quantity > 20) {
      f.querySelector("[role=status]").textContent =
        "Maximum 20 of each option per request.";
      return;
    }
    if (items.length >= 20 && !current) {
      f.querySelector("[role=status]").textContent =
        "Your cart holds up to 20 different options.";
      return;
    }
    items = cleanCart([...items, { productId: p.id, option, quantity }]);
    save();
    f.querySelector("[role=status]").textContent =
      "Added to your cart. Keep exploring or view your cart.";
  };
}
function renderCart() {
  const list = document.querySelector("#cart-items");
  if (!list) return;
  const submit = document.querySelector("#checkout button[type=submit]");
  if (!catalogLoaded) {
    list.innerHTML = "<p>Loading current availability…</p>";
    submit.disabled = true;
    return;
  }
  let total = 0;
  let invalid = false;
  list.innerHTML = items.length
    ? items
        .map((l, i) => {
          const p = products.get(l.productId);
          const valid =
            p &&
            ["available", "requests"].includes(p.status) &&
            p.options.includes(l.option);
          if (!valid) invalid = true;
          if (p) total += p.priceCents * l.quantity;
          return `<div class="line-item"><div><strong>${e(p?.name || "Unavailable item")}</strong><p class="muted">${e(l.option)} · ${p ? money(p.priceCents) : "Remove to continue"}${!valid ? " · Unavailable" : ""}</p></div><label>Qty<input data-qty="${i}" type="number" min="1" max="20" value="${l.quantity}"></label><button data-remove="${i}" type="button">Remove</button></div>`;
        })
        .join("")
    : '<div class="empty">Your cart is waiting for a little something.<br><a href="/shop/">Explore the collection ↗</a></div>';
  document.querySelector("#cart-total").textContent = money(total);
  submit.disabled = !items.length || invalid;
  list.querySelectorAll("[data-qty]").forEach(
    (input) =>
      (input.onchange = () => {
        const q = Number(input.value);
        if (!Number.isInteger(q) || q < 1 || q > 20) {
          input.reportValidity();
          return;
        }
        items[Number(input.dataset.qty)].quantity = q;
        save();
        renderCart();
      }),
  );
  list.querySelectorAll("[data-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        items.splice(Number(b.dataset.remove), 1);
        save();
        renderCart();
      }),
  );
}
let requestId = crypto.randomUUID();
document
  .querySelector("#checkout")
  ?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity() || !items.length) return;
    const button = form.querySelector("button[type=submit]");
    const status = form.querySelector("[role=status]");
    button.disabled = true;
    status.textContent = "Sending your request…";
    const data = Object.fromEntries(new FormData(form));
    try {
      const result = await call("submitCart", { ...data, items, requestId });
      items = [];
      save();
      renderCart();
      form.reset();
      status.textContent = `Request received. Reference ${result.id.slice(0, 10).toUpperCase()}. Item total: ${money(result.totalCents)}. We’ll contact you to confirm availability and shipping.`;
      requestId = crypto.randomUUID();
    } catch (err) {
      status.textContent =
        err.message?.replace("Firebase: ", "") ||
        "Could not send. Your cart is saved; please try again.";
      status.dataset.error = "true";
      button.disabled = false;
    }
  });
// Product pages stay non-submittable when the catalogue cannot be verified.
onSnapshot(
  query(collection(db, "products"), where("status", "!=", "hidden")),
  (snapshot) => {
    products = new Map(
      snapshot.docs.map((s) => [s.id, { id: s.id, ...s.data() }]),
    );
    catalogLoaded = true;
    renderCatalog();
    renderCart();
  },
  () => {
    document.querySelectorAll(".cart-controls").forEach((f) => {
      f.innerHTML =
        '<p role="status">The store is temporarily unavailable. Please try again shortly.</p>';
    });
    document
      .querySelectorAll("[data-catalog-status]")
      .forEach(
        (el) =>
          (el.textContent =
            "Could not load current products. Please refresh to try again."),
      );
    const el = document.querySelector("#cart-items");
    if (el)
      el.textContent =
        "Could not check availability. Your cart is saved; refresh to try again.";
  },
);
save();
renderCart();
