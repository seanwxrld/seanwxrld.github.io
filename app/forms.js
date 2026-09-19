import { call } from "./firebase.js";
document
  .querySelectorAll("[data-subscribe-form],[data-contact-form]")
  .forEach((form) => {
    const contact = form.hasAttribute("data-contact-form");
    let requestId = crypto.randomUUID();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector("[type=submit]");
      const status = form.querySelector("[data-form-status]");
      const label = button.textContent;
      button.disabled = true;
      status.textContent = "Sending…";
      try {
        const data = Object.fromEntries(new FormData(form));
        await call(contact ? "submitContact" : "subscribe", {
          ...data,
          requestId,
          source: form.dataset.source || "website",
          consent: data.consent === "on",
        });
        form.reset();
        requestId = crypto.randomUUID();
        status.textContent = contact
          ? "Your message is in. We’ll be in touch."
          : "Thank you for signing up <3.";
        status.dataset.statusType = "success";
      } catch (e) {
        status.textContent =
          e.message || "Could not send. Please try again shortly.";
        status.dataset.statusType = "error";
      } finally {
        button.disabled = false;
        button.textContent = label;
      }
    });
  });
