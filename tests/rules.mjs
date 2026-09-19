import test from "node:test";
import fs from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
const env = await initializeTestEnvironment({
  projectId: "demo-sean-backstage",
  firestore: { rules: fs.readFileSync("firestore.rules", "utf8") },
});
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, "products/public"), { status: "available" });
  await setDoc(doc(db, "products/private"), { status: "hidden" });
  await setDoc(doc(db, "shop_requests/one"), { userId: "alice" });
  await setDoc(doc(db, "newsletter_signups/one"), {
    email: "private@example.com",
  });
});
const guest = env.unauthenticatedContext().firestore(),
  alice = env.authenticatedContext("alice").firestore(),
  bob = env.authenticatedContext("bob").firestore(),
  admin = env.authenticatedContext("owner", { admin: true }).firestore();
test("private contacts require admin role", async () => {
  await assertFails(getDoc(doc(guest, "newsletter_signups/one")));
  await assertFails(getDoc(doc(alice, "newsletter_signups/one")));
  await assertSucceeds(getDoc(doc(admin, "newsletter_signups/one")));
});
test("members only read their own requests", async () => {
  await assertSucceeds(getDoc(doc(alice, "shop_requests/one")));
  await assertFails(getDoc(doc(bob, "shop_requests/one")));
  await assertFails(getDoc(doc(guest, "shop_requests/one")));
  await assertSucceeds(
    getDocs(
      query(collection(alice, "shop_requests"), where("userId", "==", "alice")),
    ),
  );
});
test("public catalogue excludes hidden products", async () => {
  await assertSucceeds(getDoc(doc(guest, "products/public")));
  await assertFails(getDoc(doc(guest, "products/private")));
  await assertSucceeds(
    getDocs(
      query(collection(guest, "products"), where("status", "!=", "hidden")),
    ),
  );
});
test("direct writes cannot bypass callable validation or grant admin", async () => {
  for (const db of [guest, alice, admin]) {
    await assertFails(setDoc(doc(db, "products/public"), { priceCents: 1 }));
    await assertFails(
      setDoc(doc(db, "shop_requests/forged"), { userId: "alice" }),
    );
  }
  await assertFails(setDoc(doc(alice, "users/alice"), { admin: true }));
  await assertFails(setDoc(doc(alice, "campaigns/spam"), { status: "queued" }));
});
test.after(() => env.cleanup());
