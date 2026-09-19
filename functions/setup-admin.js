// Run locally with Application Default Credentials. Never put credentials in the repository.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
const [uid] = process.argv.slice(2);
if (!uid)
  throw new Error("Usage: node functions/setup-admin.js FIREBASE_AUTH_UID");
initializeApp({
  credential: applicationDefault(),
  projectId: "sean-mosikili-official-website",
});
const user = await getAuth().getUser(uid);
await getAuth().setCustomUserClaims(uid, { ...user.customClaims, admin: true });
console.log(
  "Admin role granted. Sign out and sign back in to refresh the token.",
);
