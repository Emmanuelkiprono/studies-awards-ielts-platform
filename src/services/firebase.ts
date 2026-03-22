import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import type { Messaging } from "firebase/messaging";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

const firebaseEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingFirebaseEnvVars = Object.entries({
  VITE_FIREBASE_API_KEY: firebaseEnv.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseEnv.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebaseEnv.projectId,
  VITE_FIREBASE_STORAGE_BUCKET: firebaseEnv.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: firebaseEnv.messagingSenderId,
  VITE_FIREBASE_APP_ID: firebaseEnv.appId,
})
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingFirebaseEnvVars.length > 0) {
  console.warn(
    `[Firebase] Missing Vite environment variables: ${missingFirebaseEnvVars.join(
      ", "
    )}. Auth and Firestore will not work correctly until they are set.`
  );
}

const firebaseConfig = {
  apiKey: firebaseEnv.apiKey ?? "",
  authDomain: firebaseEnv.authDomain ?? "",
  projectId: firebaseEnv.projectId ?? "",
  storageBucket: firebaseEnv.storageBucket ?? "",
  messagingSenderId: firebaseEnv.messagingSenderId ?? "",
  appId: firebaseEnv.appId ?? "",
};

const app = initializeApp(firebaseConfig);

let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);
export const storage = getStorage(app);

export let messaging: Messaging | null = null;
try {
  if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator) {
    messaging = getMessaging(app);
  }
} catch (e) {
  console.warn("Firebase Messaging not supported in this environment.");
}

export const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "dummy-key-to-prevent-crash" });
