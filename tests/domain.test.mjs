import test from "node:test";
import assert from "node:assert/strict";
import { quote, product, email } from "../functions/domain.js";
import { cleanCart, newsletterHtml, safeUrl } from "../app/core.js";
const p = {
  name: "Shirt",
  priceCents: 3000,
  status: "available",
  stock: 3,
  options: ["S", "M"],
};
test("quote uses catalogue prices, not client totals", () => {
  const q = quote(
    [{ productId: "shirt", option: "M", quantity: 2, priceCents: 1 }],
    new Map([["shirt", p]]),
  );
  assert.equal(q.totalCents, 6000);
  assert.equal(q.items[0].priceCents, 3000);
});
test("stock checks aggregate quantities across options", () =>
  assert.throws(
    () =>
      quote(
        [
          { productId: "shirt", option: "S", quantity: 2 },
          { productId: "shirt", option: "M", quantity: 2 },
        ],
        new Map([["shirt", p]]),
      ),
    /Only 3/,
  ));
test("sold out, missing, invalid options and fractional quantities reject", () => {
  for (const lines of [
    [{ productId: "missing", option: "M", quantity: 1 }],
    [{ productId: "shirt", option: "XL", quantity: 1 }],
    [{ productId: "shirt", option: "M", quantity: 1.5 }],
  ])
    assert.throws(() => quote(lines, new Map([["shirt", p]])));
  assert.throws(() =>
    quote(
      [{ productId: "shirt", option: "M", quantity: 1 }],
      new Map([["shirt", { ...p, status: "soldout" }]]),
    ),
  );
});
test("availability requests accept unconfirmed zero stock", () =>
  assert.equal(
    quote(
      [{ productId: "shirt", option: "M", quantity: 1 }],
      new Map([["shirt", { ...p, status: "requests", stock: 0 }]]),
    ).totalCents,
    3000,
  ));
test("corrupted stored carts are sanitized and duplicates bounded", () => {
  assert.deepEqual(cleanCart({}), []);
  assert.deepEqual(
    cleanCart([null, { productId: "bad/id", option: "x", quantity: 1 }]),
    [],
  );
  assert.equal(
    cleanCart([
      { productId: "shirt", option: "M", quantity: 15 },
      { productId: "shirt", option: "M", quantity: 10 },
    ])[0].quantity,
    20,
  );
});
test("product validation rejects malformed settings", () => {
  assert.throws(() =>
    product({
      ...p,
      description: "x",
      category: "apparel",
      image: "javascript:alert(1)",
    }),
  );
  assert.equal(email(" A@EXAMPLE.COM "), "a@example.com");
  assert.throws(() => email("a@"));
});
test("email escapes text, excludes unsafe links, includes unsubscribe", () => {
  const h = newsletterHtml(
    {
      subject: "Test",
      heading: "<script>alert(1)</script>",
      body: "Hello & bye",
      image: "javascript:alert(1)",
      link: "javascript:alert(1)",
    },
    "https://example.com/unsub",
  );
  assert.ok(!h.includes("<script>"));
  assert.ok(!h.includes("javascript:"));
  assert.ok(h.includes("https://example.com/unsub"));
  assert.ok(h.includes("Hello &amp; bye"));
  assert.equal(safeUrl("javascript:alert(1)"), "");
});
