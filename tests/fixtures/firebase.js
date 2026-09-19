// Browser tests only. Never loaded by production pages.
const owner = {
  uid: "owner",
  email: "owner@example.test",
  emailVerified: true,
  getIdTokenResult: async () => ({ claims: { admin: true } }),
  getIdToken: async () => "",
  reload: async () => {},
};
const member = {
  ...owner,
  uid: "member",
  email: "member@example.test",
  getIdTokenResult: async () => ({ claims: {} }),
};
const auth = {
  currentUser: location.pathname.startsWith("/admin") ? owner : null,
};
const stamp = { seconds: 1700000000 };
const data = {
  products: {
    "layered-shirt": {
      name: "SĒAN Layered Shirt",
      description: "100% cotton. Unisex. Layered silhouette.",
      image: "/assets/LAYERED_SHIRT.PNG",
      category: "apparel",
      priceCents: 3000,
      status: "requests",
      stock: 0,
      options: ["XS", "S", "M", "L", "XL"],
    },
    "retro-shirt": {
      name: "SĒAN Retro Shirt",
      description: "100% cotton. A retro signature.",
      image: "/assets/RETRO_SHIRT.PNG",
      category: "apparel",
      priceCents: 3000,
      status: "available",
      stock: 10,
      options: ["S", "M", "L"],
    },
    "avenue-cd": {
      name: "LOST LOVER’S AVENUE CD",
      description: "The physical edition, including a bonus track.",
      image: "/assets/CD's.PNG",
      category: "music",
      priceCents: 800,
      status: "requests",
      stock: 0,
      options: ["CD"],
    },
  },
  shop_requests: {
    one: {
      name: "Preview customer",
      email: "customer@example.test",
      status: "pending",
      items: [
        {
          name: "SĒAN Layered Shirt",
          option: "M",
          quantity: 1,
          priceCents: 3000,
        },
      ],
      totalCents: 3000,
      shippingAddress: "Example address",
      createdAt: stamp,
      userId: "member",
    },
  },
  newsletter_signups: {
    one: {
      email: "subscriber@example.test",
      interest: "Music",
      source: "swarm",
      consent: true,
      status: "subscribed",
      createdAt: stamp,
    },
  },
  contact_messages: {
    one: {
      name: "Preview contact",
      email: "hello@example.test",
      interest: "Booking",
      message: "A sample enquiry for browser testing.",
      status: "new",
      createdAt: stamp,
    },
  },
  campaigns: {},
  member_carts: {},
};
window.__fixture = { data, calls: [], auth };
const watchers = [];
export const initializeApp = () => ({});
export const getApps = () => [];
export const getApp = () => ({});
export const getAuth = () => auth;
export const getFirestore = () => ({});
export const getFunctions = () => ({});
export const getStorage = () => ({});
export const collection = (_, name) => ({ name });
export const doc = (_, name, id) => ({ name, id });
export const where = (field, op, value) => ({ field, op, value });
export const query = (ref, ...filters) => ({ ...ref, filters });
const snap = (id, row) => ({ id, data: () => row, exists: () => !!row });
export const getDoc = async (r) => snap(r.id, data[r.name]?.[r.id]);
function snapshot(r) {
  let rows = Object.entries(data[r.name] || {});
  for (const f of r.filters || [])
    rows = rows.filter(([, v]) =>
      f.op === "!=" ? v[f.field] !== f.value : v[f.field] === f.value,
    );
  return { docs: rows.map(([id, v]) => snap(id, v)) };
}
export const onSnapshot = (r, cb) => {
  const w = { r, cb };
  watchers.push(w);
  queueMicrotask(() => cb(snapshot(r)));
  return () => watchers.splice(watchers.indexOf(w), 1);
};
const authListeners = [];
export const onAuthStateChanged = (_, cb) => {
  authListeners.push(cb);
  queueMicrotask(() => cb(auth.currentUser));
  return () => {};
};
export const signInWithEmailAndPassword = async () => {
  auth.currentUser = member;
  authListeners.forEach((cb) => cb(member));
};
export const createUserWithEmailAndPassword = async () => {
  await signInWithEmailAndPassword();
  return { user: member };
};
export const sendPasswordResetEmail = async () => {};
export const sendEmailVerification = async () => {};
export const signOut = async () => {
  auth.currentUser = null;
  authListeners.forEach((cb) => cb(null));
};
export const ref = (_, path) => ({ path });
export const uploadBytes = async () => {};
export const getDownloadURL = async () => "https://example.test/product.png";
export const httpsCallable = (_, name) => async (payload) => {
  window.__fixture.calls.push({ name, payload });
  if (window.__fixture.fail === name)
    throw new Error("Test service unavailable");
  let result = { ok: true };
  if (name === "saveProduct") {
    const id = payload.id || "new-product";
    data.products[id] = payload.product;
    result = { id };
  }
  if (name === "saveCart")
    data.member_carts[auth.currentUser.uid] = { items: payload.items };
  if (name === "submitCart") {
    result = {
      id: "test-request-123",
      totalCents: payload.items.reduce(
        (n, l) => n + data.products[l.productId].priceCents * l.quantity,
        0,
      ),
    };
  }
  if (name === "updateRequest")
    data.shop_requests[payload.id].status = payload.status;
  if (name === "saveCampaign") {
    const id = payload.id || "new-campaign";
    data.campaigns[id] = { ...payload.draft, status: "draft" };
    result = { id };
  }
  if (name === "queueCampaign") data.campaigns[payload.id].status = "queued";
  if (name === "updateContact")
    data.contact_messages[payload.id].status = payload.status;
  watchers.forEach((w) => w.cb(snapshot(w.r)));
  return { data: result };
};

window.__fixture.setUser = (role) => {
  auth.currentUser =
    role === "admin" ? owner : role === "member" ? member : null;
  authListeners.forEach((cb) => cb(auth.currentUser));
};
