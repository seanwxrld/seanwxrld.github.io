export function text(value, name, max = 200, optional = false) {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (!optional && !value.trim())
  )
    throw new Error(`Please check ${name}.`);
  return value.trim();
}
export function email(value) {
  const result = text(value, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw new Error("Please enter a valid email.");
  return result;
}
export function product(value) {
  const p = {
    name: text(value.name, "product name", 120),
    description: text(value.description, "description", 2000),
    image: text(value.image, "image URL", 1000),
    category: value.category,
    priceCents: value.priceCents,
    status: value.status,
    stock: value.stock,
    options: value.options,
  };
  if (!/^https:\/\//.test(p.image) && !/^\/assets\//.test(p.image))
    throw new Error("Use an HTTPS image URL or /assets/ path.");
  if (
    !["apparel", "music"].includes(p.category) ||
    !["available", "requests", "soldout", "hidden"].includes(p.status)
  )
    throw new Error("Invalid product settings.");
  if (
    !Number.isInteger(p.priceCents) ||
    p.priceCents < 0 ||
    p.priceCents > 10000000
  )
    throw new Error("Invalid price.");
  if (
    p.stock !== null &&
    (!Number.isInteger(p.stock) || p.stock < 0 || p.stock > 1000000)
  )
    throw new Error("Invalid stock quantity.");
  if (!Array.isArray(p.options) || !p.options.length || p.options.length > 20)
    throw new Error("Add at least one option.");
  p.options = [...new Set(p.options.map((x) => text(x, "option", 40)))];
  return p;
}
export function quote(lines, products) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 20)
    throw new Error("Your cart must have 1–20 lines.");
  const quantities = new Map();
  const items = lines.map((l) => {
    if (
      !l ||
      !Number.isInteger(l.quantity) ||
      l.quantity < 1 ||
      l.quantity > 20
    )
      throw new Error("Quantity must be 1–20.");
    const p = products.get(l.productId);
    if (!p || !["available", "requests"].includes(p.status))
      throw new Error(
        "An item is no longer accepting requests. Please update your cart.",
      );
    if (!p.options.includes(l.option))
      throw new Error(`Choose a valid option for ${p.name}.`);
    quantities.set(
      l.productId,
      (quantities.get(l.productId) || 0) + l.quantity,
    );
    if (
      p.status === "available" &&
      p.stock !== null &&
      quantities.get(l.productId) > p.stock
    )
      throw new Error(`Only ${p.stock} available for ${p.name}.`);
    return {
      productId: l.productId,
      name: p.name,
      option: l.option,
      quantity: l.quantity,
      priceCents: p.priceCents,
    };
  });
  return {
    items,
    totalCents: items.reduce((n, l) => n + l.priceCents * l.quantity, 0),
    currency: "USD",
  };
}
