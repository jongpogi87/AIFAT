import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";

function getEnv(key: string, fallback = ""): string {
  try {
    // Vite environment
    if (typeof import.meta !== "undefined" && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
  } catch {}
  try {
    // Node environment
    if (typeof process !== "undefined" && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch {}
  return fallback;
}

const firebaseConfig = {
  apiKey: getEnv("NEXT_PUBLIC_FIREBASE_API_KEY", getEnv("VITE_FIREBASE_API_KEY", "demo-aifat-api-key")),
  authDomain: getEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", getEnv("VITE_FIREBASE_AUTH_DOMAIN", "aifat-portal.firebaseapp.com")),
  projectId: getEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", getEnv("VITE_FIREBASE_PROJECT_ID", getEnv("FIREBASE_PROJECT_ID", "demo-aifat-portal"))),
  storageBucket: getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", getEnv("VITE_FIREBASE_STORAGE_BUCKET", "aifat-portal.appspot.com")),
  messagingSenderId: getEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "1234567890")),
  appId: getEnv("NEXT_PUBLIC_FIREBASE_APP_ID", getEnv("VITE_FIREBASE_APP_ID", "1:1234567890:web:abcdef123456")),
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const clientAuth: Auth = getAuth(app);
export const clientDb: Firestore = getFirestore(app);

// Connect to emulators if configured in development or testing
const authEmulatorHost = getEnv(
  "FIREBASE_AUTH_EMULATOR_HOST",
  getEnv("NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST", getEnv("VITE_FIREBASE_AUTH_EMULATOR_HOST"))
);
const firestoreEmulatorHost = getEnv(
  "FIRESTORE_EMULATOR_HOST",
  getEnv("NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST", getEnv("VITE_FIRESTORE_EMULATOR_HOST"))
);

if (authEmulatorHost) {
  try {
    const cleanHost = authEmulatorHost.startsWith("http") ? authEmulatorHost : `http://${authEmulatorHost}`;
    connectAuthEmulator(clientAuth, cleanHost, { disableWarnings: true });
  } catch {}
}
if (firestoreEmulatorHost) {
  try {
    const [host, port] = firestoreEmulatorHost.replace(/^https?:\/\//, "").split(":");
    connectFirestoreEmulator(clientDb, host, Number(port) || 8080);
  } catch {}
}

export default app;
