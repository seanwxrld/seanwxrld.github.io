import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
export function wireAuth(form, { signup = false } = {}) {
  const status = form.querySelector("[role=status]");
  const run = async (fn) => {
    const buttons = form.querySelectorAll("button");
    buttons.forEach((b) => (b.disabled = true));
    status.textContent = "Please wait…";
    try {
      await fn();
    } catch (e) {
      status.textContent =
        {
          "auth/invalid-credential": "Email or password is incorrect.",
          "auth/email-already-in-use":
            "This email already has an account. Try signing in.",
          "auth/weak-password": "Choose a stronger password.",
          "auth/operation-not-allowed":
            "Account sign-in has not been enabled yet.",
          "auth/too-many-requests":
            "Too many attempts. Please try again later.",
        }[e.code] || "Unable to sign in. Check your details and connection.";
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    run(async () => {
      const data = new FormData(form);
      await signInWithEmailAndPassword(
        auth,
        data.get("email"),
        data.get("password"),
      );
      status.textContent = "Signed in.";
    });
  });
  form.querySelector("[data-reset]")?.addEventListener("click", () =>
    run(async () => {
      const email = form.elements.email;
      if (!email.reportValidity()) return;
      await sendPasswordResetEmail(auth, email.value);
      status.textContent =
        "If an account exists, you’ll receive a password-reset email.";
    }),
  );
  if (signup)
    form.querySelector("[data-signup]").addEventListener("click", () => {
      if (!form.reportValidity()) return;
      run(async () => {
        const d = new FormData(form);
        const result = await createUserWithEmailAndPassword(
          auth,
          d.get("email"),
          d.get("password"),
        );
        await sendEmailVerification(result.user);
        status.textContent =
          "Account created. Check your inbox to verify your email.";
      });
    });
}
export const logOut = () => signOut(auth);
