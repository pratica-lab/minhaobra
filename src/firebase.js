import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  projectId: "minha-obra-bd",
  appId: "1:364025766803:web:95c30f7dfa083b5ed6be66",
  storageBucket: "minha-obra-bd.firebasestorage.app",
  apiKey: "AIzaSyBrEpv-yMfy14pcnNURK9hIyGQw-Chi4Wg",
  authDomain: "minha-obra-bd.firebaseapp.com",
  messagingSenderId: "364025766803"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
export const storage = getStorage(app);
