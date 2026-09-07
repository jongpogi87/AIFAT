import { initializeApp, getApps, getApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

if (typeof window !== "undefined") {
  throw new Error("Firebase Admin SDK can only be imported in server-side modules.");
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-aifat-portal";

/**
 * Initializes and returns the singleton Firebase Admin App.
 * Uses Application Default Credentials (ADC) or App Hosting runtime credentials in production.
 * Automatically respects FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST when set.
 */
export function getAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0 && apps[0]) {
    return apps[0];
  }

  // In App Hosting / Google Cloud, initializeApp without params uses ADC
  return initializeApp({
    projectId,
  });
}

export function getAdminDb(): Firestore {
  const app = getAdminApp();
  const db = getFirestore(app);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {}
  return db;
}

export function getAdminAuth(): Auth {
  const app = getAdminApp();
  return getAuth(app);
}
