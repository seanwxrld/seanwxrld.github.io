import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({
  credential: applicationDefault(),
  projectId: "sean-mosikili-official-website",
});
const db = getFirestore();
const sizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
const products = [
  {
    id: "layered-shirt",
    name: "SĒAN Layered Shirt",
    description:
      "100% cotton. Unisex. A layered silhouette for your everyday world.",
    image: "/assets/LAYERED_SHIRT.PNG",
    category: "apparel",
    priceCents: 3000,
    options: sizes,
  },
  {
    id: "retro-shirt",
    name: "SĒAN Retro Shirt",
    description:
      "100% cotton. Unisex. A retro signature, made for the collection.",
    image: "/assets/RETRO_SHIRT.PNG",
    category: "apparel",
    priceCents: 3000,
    options: sizes,
  },
  {
    id: "avenue-cd",
    name: "LOST LOVER’S AVENUE CD",
    description:
      "The physical edition, including a bonus track. Keep the sound.",
    image: "/assets/CD's.PNG",
    category: "music",
    priceCents: 800,
    options: ["CD"],
  },
];
for (const { id, ...p } of products) {
  const ref = db.doc(`products/${id}`);
  await db.runTransaction(async (tx) => {
    if (!(await tx.get(ref)).exists)
      tx.create(ref, { ...p, status: "requests", stock: 0 });
  });
}
console.log("Initial catalogue ready. Existing products were not overwritten.");
