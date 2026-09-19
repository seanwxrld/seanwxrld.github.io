import { db } from "./firebase.js";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

document
  .querySelectorAll("[data-subscribe-form],[data-contact-form]")
  .forEach((form) => {
    const contact = form.hasAttribute("data-contact-form");
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
        if (!contact && data.consent !== "on")
          throw new Error("Please agree to receive email updates.");

        if (contact) {
          await addDoc(collection(db, "contact_messages"), {
            name: String(data.name || "").trim().slice(0, 120),
            email: String(data.email || "").trim().toLowerCase().slice(0, 320),
            interest: String(data.interest || "").trim().slice(0, 100),
            message: String(data.message || "").trim().slice(0, 5000),
            status: "new",
            createdAt: serverTimestamp(),
          });
        } else {
          await addDoc(collection(db, "newsletter_signups"), {
            email: String(data.email || "").trim().toLowerCase().slice(0, 320),
            interest: String(data.interest || "").trim().slice(0, 200),
            source: String(form.dataset.source || "website").slice(0, 100),
            consent: true,
            status: "subscribed",
            createdAt: serverTimestamp(),
          });
        }

        form.reset();
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
