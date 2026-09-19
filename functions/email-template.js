export const escapeHtml = (v = "") =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export const safeUrl = (value, relative = true) => {
  try {
    const u = new URL(value, "https://seanwxrld.com");
    return u.protocol === "https:" &&
      (relative || String(value).startsWith("https://"))
      ? u.href
      : "";
  } catch {
    return "";
  }
};
export const cleanCart = (value) => {
  if (!Array.isArray(value)) return [];
  const lines = new Map();
  for (const l of value.slice(0, 50)) {
    if (
      !l ||
      typeof l.productId !== "string" ||
      !/^[a-z0-9-]{1,80}$/.test(l.productId) ||
      typeof l.option !== "string" ||
      l.option.length > 40 ||
      !Number.isInteger(l.quantity) ||
      l.quantity < 1
    )
      continue;
    const key = `${l.productId}:${l.option}`;
    lines.set(key, {
      productId: l.productId,
      option: l.option,
      quantity: Math.min(20, (lines.get(key)?.quantity || 0) + l.quantity),
    });
  }
  return [...lines.values()].slice(0, 20);
};
export function newsletterHtml(
  d,
  unsubscribe = "https://seanwxrld.com/account/",
) {
  const e = escapeHtml;
  const image = safeUrl(d.image || "", false);
  const link = safeUrl(d.link || "https://seanwxrld.com");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(d.subject)}</title></head><body style="margin:0;background:#f7f5f1;color:#171717;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${e(d.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" style="width:100%;max-width:600px" cellspacing="0" cellpadding="0"><tr><td style="padding:24px 0;border-bottom:1px solid #d8d3ca;font-size:18px;font-weight:bold;letter-spacing:2px">SĒAN MOSIKILI</td></tr><tr><td style="padding:32px 0 12px;color:#79543b;font-size:12px;letter-spacing:3px">NOTES FROM MY WORLD / SWARM</td></tr>${image ? `<tr><td><img src="${e(image)}" alt="${e(d.heading)}" width="600" style="width:100%;height:auto;display:block"></td></tr>` : ""}<tr><td><h1 style="font-size:40px;line-height:1.1;letter-spacing:-1px">${e(d.heading)}</h1><p style="font-size:16px;line-height:1.8">${e(d.body).replace(/\n/g, "<br>")}</p></td></tr>${link ? `<tr><td style="padding:20px 0 40px"><a href="${e(link)}" style="display:inline-block;padding:16px 24px;background:#79543b;color:#fff;text-decoration:none;font-size:13px">${e(d.button || "EXPLORE THE WORLD")} ↗</a></td></tr>` : ""}<tr><td style="border-top:1px solid #d8d3ca;padding:24px 0;color:#69645e;font-size:12px;line-height:1.8">SĒAN MOSIKILI · seanwxrld.com<br>You received this because you signed up for updates.<br><a href="${e(unsubscribe)}" style="color:#79543b">Unsubscribe</a></td></tr></table></td></tr></table></body></html>`;
}
