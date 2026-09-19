import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret, defineString } from "firebase-functions/params";
import {
  createHash,
  createHmac,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { text, email, product, quote } from "./domain.js";
import { cleanCart, newsletterHtml, escapeHtml } from "./email-template.js";
initializeApp();
const db = getFirestore();
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const UNSUBSCRIBE_SECRET = defineSecret("UNSUBSCRIBE_SECRET");
const MAIL_FROM = defineString("MAIL_FROM", { default: "" });
const MAIL_ADDRESS = defineString("MAIL_ADDRESS", { default: "" });
const PROJECT = process.env.GCLOUD_PROJECT || "sean-mosikili-official-website";
const hash = (s) => createHash("sha256").update(s).digest("hex");
const stamp = () => FieldValue.serverTimestamp();
const id = (v) => {
  if (typeof v !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(v))
    throw new HttpsError("invalid-argument", "Invalid identifier.");
  return v;
};
function admin(r) {
  if (!r.auth?.token.admin)
    throw new HttpsError(
      "permission-denied",
      "This account does not have backstage access.",
    );
}
const wrap = (fn) => async (r) => {
  try {
    return await fn(r);
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    if (e.constructor === Error)
      throw new HttpsError("invalid-argument", e.message);
    console.error("Operation failed", e.code);
    throw new HttpsError("internal", "Unable to save. Please try again.");
  }
};
// An IP/account limit protects guest endpoints without putting personal details in document IDs.
async function throttle(r, action, limit = 15) {
  const ref = db.doc(
    `rate_limits/${hash(`${action}:${r.auth?.uid || r.rawRequest.ip || "unknown"}:${Math.floor(Date.now() / 3600000)}`)}`,
  );
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if ((s.data()?.count || 0) >= limit)
      throw new HttpsError(
        "resource-exhausted",
        "Too many requests. Please try again later.",
      );
    tx.set(ref, {
      count: (s.data()?.count || 0) + 1,
      expiresAt: Timestamp.fromMillis(Date.now() + 7200000),
    });
  });
}
export const saveProduct = onCall(
  wrap(async (r) => {
    admin(r);
    const data = product(r.data.product);
    const key = r.data.id ? id(r.data.id) : randomUUID();
    await db
      .doc(`products/${key}`)
      .set({ ...data, updatedAt: stamp() }, { merge: true });
    return { id: key };
  }),
);
export const saveCart = onCall(
  wrap(async (r) => {
    if (!r.auth) throw new HttpsError("unauthenticated", "Please sign in.");
    await throttle(r, "cart", 300);
    const lines = cleanCart(r.data.items);
    await db
      .doc(`member_carts/${r.auth.uid}`)
      .set({ items: lines, updatedAt: stamp() });
    return { items: lines };
  }),
);
export const submitCart = onCall(
  wrap(async (r) => {
    await throttle(r, "request");
    const key = id(r.data.requestId);
    const customer = {
      name: text(r.data.name, "name", 120),
      email: email(r.data.email),
      shippingAddress: text(r.data.shippingAddress, "shipping address", 1500),
      notes: text(r.data.notes || "", "notes", 2000, true),
    };
    const userId = r.auth?.uid || null;
    const ownerKey = hash(`${userId || customer.email}:${key}`);
    const ref = db.doc(`shop_requests/${ownerKey}`);
    return db.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists)
        return { id: ownerKey, totalCents: existing.data().totalCents };
      if (
        !Array.isArray(r.data.items) ||
        !r.data.items.length ||
        r.data.items.length > 20
      )
        throw new Error("Your cart must have 1–20 lines.");
      const keys = [...new Set(r.data.items.map((l) => id(l.productId)))];
      const snapshots = await tx.getAll(
        ...keys.map((k) => db.doc(`products/${k}`)),
      );
      const quoted = quote(
        r.data.items,
        new Map(snapshots.filter((s) => s.exists).map((s) => [s.id, s.data()])),
      );
      tx.create(ref, {
        ...customer,
        ...quoted,
        userId,
        status: "pending",
        createdAt: stamp(),
      });
      if (userId)
        tx.set(db.doc(`member_carts/${userId}`), {
          items: [],
          updatedAt: stamp(),
        });
      // Requests do not reserve stock or take payment. Stock is adjusted when the owner confirms fulfilment.
      return { id: ownerKey, totalCents: quoted.totalCents };
    });
  }),
);
export const updateRequest = onCall(
  wrap(async (r) => {
    admin(r);
    if (
      !["pending", "reviewing", "confirmed", "completed", "cancelled"].includes(
        r.data.status,
      )
    )
      throw new Error("Invalid status.");
    await db
      .doc(`shop_requests/${id(r.data.id)}`)
      .update({ status: r.data.status, updatedAt: stamp() });
    return { ok: true };
  }),
);
export const submitContact = onCall(
  wrap(async (r) => {
    await throttle(r, "contact");
    const data = {
      name: text(r.data.name, "name", 120),
      email: email(r.data.email),
      interest: text(r.data.interest, "interest", 100),
      message: text(r.data.message, "message", 5000),
      status: "new",
      createdAt: stamp(),
    };
    const ref = db.doc(
      `contact_messages/${hash(`${data.email}:${id(r.data.requestId)}`)}`,
    );
    await db.runTransaction(async (tx) => {
      const s = await tx.get(ref);
      if (!s.exists) tx.create(ref, data);
    });
    return { ok: true };
  }),
);
export const updateContact = onCall(
  wrap(async (r) => {
    admin(r);
    if (!["new", "handled"].includes(r.data.status))
      throw new Error("Invalid status.");
    await db
      .doc(`contact_messages/${id(r.data.id)}`)
      .update({ status: r.data.status });
    return { ok: true };
  }),
);
export const subscribe = onCall(
  wrap(async (r) => {
    await throttle(r, "subscribe", 10);
    if (r.data.consent !== true)
      throw new Error("Please agree to receive email updates.");
    const address = email(r.data.email);
    const key = hash(address);
    // Public resubmissions cannot reverse an unsubscribe. A verified member can opt back in.
    await db.runTransaction(async (tx) => {
      const ref = db.doc(`newsletter_signups/${key}`);
      const suppressed = await tx.get(db.doc(`suppressions/${key}`));
      const current = await tx.get(ref);
      if (suppressed.exists) return;
      tx.set(
        ref,
        {
          email: address,
          interest: text(r.data.interest || "", "interest", 200, true),
          source: text(r.data.source || "website", "source", 100),
          consent: true,
          status: "subscribed",
          createdAt: current.data()?.createdAt || stamp(),
          updatedAt: stamp(),
        },
        { merge: true },
      );
    });
    return { ok: true };
  }),
);
export const suppressSubscriber = onCall(
  wrap(async (r) => {
    admin(r);
    const address = email(r.data.email);
    await suppress(address);
    return { ok: true };
  }),
);
async function suppress(address) {
  const key = hash(address);
  const batch = db.batch();
  batch.set(db.doc(`suppressions/${key}`), { createdAt: stamp() });
  batch.set(
    db.doc(`newsletter_signups/${key}`),
    { email: address, status: "unsubscribed", updatedAt: stamp() },
    { merge: true },
  );
  await batch.commit();
}
export const memberNewsletter = onCall(
  wrap(async (r) => {
    if (!r.auth?.token.email_verified)
      throw new HttpsError(
        "permission-denied",
        "Verify your email before changing newsletter preferences.",
      );
    const address = email(r.auth.token.email);
    if (r.data.subscribed === true) {
      const batch = db.batch();
      batch.delete(db.doc(`suppressions/${hash(address)}`));
      batch.set(
        db.doc(`newsletter_signups/${hash(address)}`),
        {
          email: address,
          consent: true,
          status: "subscribed",
          source: "member",
          createdAt: stamp(),
        },
        { merge: true },
      );
      await batch.commit();
    } else await suppress(address);
    return { ok: true };
  }),
);
function draft(data) {
  const result = {};
  for (const [key, max] of Object.entries({
    subject: 150,
    preheader: 200,
    heading: 200,
    body: 15000,
    image: 1000,
    link: 1000,
    button: 80,
    html: 80000,
  }))
    result[key] = text(
      data[key] || "",
      key,
      max,
      !["subject", "heading", "body"].includes(key),
    );
  if (result.html && !result.html.includes("{{unsubscribe_url}}"))
    throw new Error("Custom HTML must include {{unsubscribe_url}}.");
  return result;
}
export const saveCampaign = onCall(
  wrap(async (r) => {
    admin(r);
    const key = r.data.id ? id(r.data.id) : randomUUID();
    const d = draft(r.data.draft);
    await db.runTransaction(async (tx) => {
      const ref = db.doc(`campaigns/${key}`);
      const s = await tx.get(ref);
      if (s.exists && s.data().status !== "draft")
        throw new Error("Only drafts can be edited. Create a new campaign.");
      tx.set(ref, {
        ...d,
        status: "draft",
        updatedAt: stamp(),
        createdAt: s.data()?.createdAt || stamp(),
      });
    });
    return { id: key };
  }),
);
function unsubscribeUrl(address) {
  const payload = Buffer.from(address).toString("base64url");
  const sig = createHmac("sha256", UNSUBSCRIBE_SECRET.value())
    .update(payload)
    .digest("hex");
  return `https://us-central1-${PROJECT}.cloudfunctions.net/unsubscribe?p=${payload}&s=${sig}`;
}
function render(d, address) {
  const url = unsubscribeUrl(address);
  const body = d.html
    ? d.html.replaceAll("{{unsubscribe_url}}", escapeHtml(url))
    : newsletterHtml(d, url);
  return (
    body +
    `<p style="font:12px Arial;color:#69645e;text-align:center">${escapeHtml(MAIL_ADDRESS.value())}</p>`
  );
}
async function sendMail(d, address, key) {
  if (!MAIL_FROM.value() || !MAIL_ADDRESS.value() || !RESEND_API_KEY.value())
    throw new Error("Email sender is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY.value()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      from: MAIL_FROM.value(),
      to: [address],
      subject: d.subject,
      html: render(d, address),
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl(address)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`Email service returned ${response.status}.`);
  return (await response.json()).id;
}
export const testCampaign = onCall(
  { secrets: [RESEND_API_KEY, UNSUBSCRIBE_SECRET] },
  wrap(async (r) => {
    admin(r);
    if (!r.auth.token.email_verified)
      throw new Error("Verify your admin email first.");
    await throttle(r, "test-email", 20);
    const d = draft(r.data.draft);
    await sendMail(
      { ...d, subject: `[TEST] ${d.subject}` },
      email(r.auth.token.email),
      `test-${randomUUID()}`,
    );
    return { ok: true };
  }),
);
export const queueCampaign = onCall(
  wrap(async (r) => {
    admin(r);
    if (!MAIL_FROM.value() || !MAIL_ADDRESS.value())
      throw new Error(
        "Configure the email sender and postal address before queuing a newsletter.",
      );
    const ref = db.doc(`campaigns/${id(r.data.id)}`);
    const when = r.data.scheduledAt
      ? Date.parse(r.data.scheduledAt)
      : Date.now();
    if (!Number.isFinite(when) || when < Date.now() - 60000)
      throw new Error("Choose a future send time.");
    await db.runTransaction(async (tx) => {
      const s = await tx.get(ref);
      if (!s.exists || s.data().status !== "draft")
        throw new Error("This campaign has already been queued.");
      tx.update(ref, {
        status: "queued",
        scheduledAt: Timestamp.fromMillis(when),
        cursor: "",
        sent: 0,
        failed: 0,
        skipped: 0,
        updatedAt: stamp(),
      });
    });
    return { ok: true };
  }),
);
export const cancelCampaign = onCall(
  wrap(async (r) => {
    admin(r);
    const ref = db.doc(`campaigns/${id(r.data.id)}`);
    await ref.update({ status: "cancelled", updatedAt: stamp() });
    return { ok: true };
  }),
);
// One worker and a database lease avoid concurrent sends. Provider idempotency handles crash retries.
export const deliverCampaigns = onSchedule(
  {
    schedule: "every 1 minutes",
    timeoutSeconds: 120,
    maxInstances: 1,
    secrets: [RESEND_API_KEY, UNSUBSCRIBE_SECRET],
  },
  async () => {
    if (!MAIL_FROM.value() || !MAIL_ADDRESS.value()) return;
    const queued = await db
      .collection("campaigns")
      .where("status", "==", "queued")
      .get();
    const candidates = queued.docs
      .filter((s) => s.data().scheduledAt.toMillis() <= Date.now())
      .sort(
        (a, b) =>
          a.data().scheduledAt.toMillis() - b.data().scheduledAt.toMillis(),
      );
    const entry = candidates[0];
    if (!entry) return;
    const leased = await db.runTransaction(async (tx) => {
      const s = await tx.get(entry.ref);
      if (
        s.data().status !== "queued" ||
        (s.data().leaseUntil?.toMillis() || 0) > Date.now()
      )
        return false;
      tx.update(entry.ref, {
        leaseUntil: Timestamp.fromMillis(Date.now() + 180000),
      });
      return true;
    });
    if (!leased) return;
    try {
      const d = (await entry.ref.get()).data();
      let query = db
        .collection("newsletter_signups")
        .orderBy("__name__")
        .limit(30);
      if (d.cursor) query = query.startAfter(d.cursor);
      const contacts = await query.get();
      for (const contact of contacts.docs) {
        if ((await entry.ref.get()).data().status !== "queued") return;
        const c = contact.data();
        let address;
        try {
          address = email(c.email);
        } catch {
          await entry.ref.update({
            cursor: contact.id,
            skipped: FieldValue.increment(1),
          });
          continue;
        }
        const key = hash(address);
        const receipt = entry.ref.collection("deliveries").doc(key);
        const previous = await receipt.get();
        const suppressed = await db.doc(`suppressions/${key}`).get();
        // Legacy records are visible but excluded until their consent is explicitly verified/migrated.
        if (
          c.consent !== true ||
          c.status !== "subscribed" ||
          suppressed.exists ||
          previous.data()?.state === "sent"
        ) {
          await entry.ref.update({
            cursor: contact.id,
            skipped: FieldValue.increment(1),
          });
          continue;
        }
        const firstAttempt =
          previous.data()?.firstAttempt?.toMillis() || Date.now();
        if (Date.now() - firstAttempt > 23 * 3600000) {
          await entry.ref.update({
            status: "needs_review",
            error:
              "Delivery retry window expired; inspect receipts before resending.",
          });
          return;
        }
        if (!previous.exists)
          await receipt.set({
            state: "sending",
            firstAttempt: Timestamp.fromMillis(firstAttempt),
          });
        try {
          const providerId = await sendMail(
            d,
            address,
            `campaign-${entry.id}-${key}`,
          );
          await receipt.set(
            { state: "sent", providerId, sentAt: stamp() },
            { merge: true },
          );
          await entry.ref.update({
            cursor: contact.id,
            sent: FieldValue.increment(1),
            error: FieldValue.delete(),
          });
        } catch (e) {
          await receipt.set(
            { state: "retry", lastError: e.message },
            { merge: true },
          );
          await entry.ref.update({ error: e.message });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      if (contacts.size < 30)
        await db.runTransaction(async (tx) => {
          const current = await tx.get(entry.ref);
          if (current.data().status === "queued")
            tx.update(entry.ref, { status: "sent", completedAt: stamp() });
        });
    } finally {
      await entry.ref.update({ leaseUntil: Timestamp.fromMillis(0) });
    }
  },
);
export const unsubscribe = onRequest(
  { secrets: [UNSUBSCRIBE_SECRET] },
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    const p = String(req.query.p || "");
    const s = String(req.query.s || "");
    const expected = createHmac("sha256", UNSUBSCRIBE_SECRET.value())
      .update(p)
      .digest("hex");
    if (
      !/^[a-f0-9]{64}$/.test(s) ||
      !timingSafeEqual(Buffer.from(s), Buffer.from(expected))
    ) {
      res.status(400).send("Invalid unsubscribe link.");
      return;
    }
    let address;
    try {
      address = email(Buffer.from(p, "base64url").toString());
    } catch {
      res.status(400).send("Invalid link.");
      return;
    }
    if (req.method === "POST") {
      await suppress(address);
      res.send(
        "<h1>You’re unsubscribed.</h1><p>You won’t receive future newsletters.</p>",
      );
      return;
    }
    if (req.method !== "GET") {
      res.status(405).send("Method not allowed");
      return;
    }
    // A GET confirmation prevents email scanners from silently unsubscribing recipients.
    res.send(
      '<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#f7f5f1;color:#171717;font-family:Arial;padding:48px"><h1>Leave the mailing list?</h1><form method="post"><button style="padding:16px;background:#79543b;color:white;border:0">Unsubscribe</button></form></body>',
    );
  },
);
