import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
const config = {
  apiKey: "AIzaSyCg8ESTI4q5NSlzG_pm_5wZPNEdSqQR4kU",
  authDomain: "sean-mosikili-official-website.firebaseapp.com",
  projectId: "sean-mosikili-official-website",
  storageBucket: "sean-mosikili-official-website.firebasestorage.app",
  messagingSenderId: "553905440133",
  appId: "1:553905440133:web:9ee90d720f3d45dce270ec",
};
export const app = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);
