import { auth, db, call } from "./firebase.js";
import {
  onAuthStateChanged,
  sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { wireAuth, logOut } from "./auth.js";
import { escapeHtml as e, money } from "./core.js";
wireAuth(document.querySelector("#auth-form"), { signup: true });
let stop;
onAuthStateChanged(auth, (user) => {
  stop?.();
  document.querySelector("#signed-out").hidden = !!user;
  document.querySelector("#member").hidden = !user;
  const list = document.querySelector("#member-requests");
  list.innerHTML = "";
  if (!user) return;
  document.querySelector("#member-email").textContent = user.email;
  document.querySelector("#verify").hidden = user.emailVerified;
  list.textContent = "Loading your requests…";
  stop = onSnapshot(
    query(collection(db, "shop_requests"), where("userId", "==", user.uid)),
    (snapshot) => {
      const rows = snapshot.docs
        .map((s) => ({ id: s.id, ...s.data() }))
        .sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
        );
      list.innerHTML = rows.length
        ? rows
            .map(
              (r) =>
                `<article><p class="eyebrow">${e(r.id.slice(0, 10).toUpperCase())} / ${e(r.status)}</p><p>${(r.items || []).map((l) => `${e(l.name)} · ${e(l.option)} × ${l.quantity}`).join("<br>")}</p><p class="muted">${money(r.totalCents)} · shipping confirmed separately</p><hr></article>`,
            )
            .join("")
        : '<p class="muted">No requests yet. Find your next piece in the store.</p>';
    },
    () =>
      (list.textContent =
        "Could not load your requests. Please try again later."),
  );
});
document.querySelector("#signout").onclick = async () => {
  localStorage.removeItem("sean-cart-v1");
  localStorage.removeItem("sean-cart-v1-sync");
  await logOut();
  location.reload();
};
const status = document.querySelector("#member-status");
async function preferences(subscribed) {
  status.textContent = "Saving…";
  try {
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    await call("memberNewsletter", { subscribed });
    status.textContent = subscribed
      ? "You’re subscribed."
      : "You’re unsubscribed.";
  } catch (err) {
    status.textContent = err.message || "Unable to update preferences.";
  }
}
document.querySelector("#opt-in").onclick = () => preferences(true);
document.querySelector("#opt-out").onclick = () => preferences(false);
document.querySelector("#verify").onclick = async () => {
  try {
    await sendEmailVerification(auth.currentUser);
    status.textContent = "Verification email sent. Check your inbox.";
  } catch {
    status.textContent = "Could not send verification. Try again later.";
  }
};
