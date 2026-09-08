import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { clientAuth, clientDb } from "../firebase/client.ts";
import type { BatchRecord, SystemSettingsRecord } from "../repositories/types.ts";

export interface AdminProfile {
  uid: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN";
  enabled: boolean;
  displayName?: string;
}

export interface AdminLearnerRecord {
  id: string;
  learnerId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  contactNumber: string;
  sex?: string;
  birthdate?: string;
  age?: number;
  address?: string;
  employmentStatus?: string;
  educationalAttainment?: string;
  learnerClassification?: string;
  createdAt?: string;
}

/**
 * Sign in admin user using Firebase Client Auth.
 */
export async function loginAdmin(email: string, pass: string): Promise<AdminProfile> {
  const cred = await signInWithEmailAndPassword(clientAuth, email.trim(), pass);
  const profile = await getAdminProfile(cred.user.uid);
  if (!profile || !profile.enabled) {
    await signOut(clientAuth);
    throw new Error("Admin profile is disabled or not found.");
  }
  return profile;
}

/**
 * Sign out current admin user.
 */
export async function logoutAdmin(): Promise<void> {
  await signOut(clientAuth);
}

/**
 * Retrieves the admin profile for a given UID from Firestore adminProfiles/{uid}.
 */
export async function getAdminProfile(uid: string): Promise<AdminProfile | null> {
  try {
    const snap = await getDoc(doc(clientDb, "adminProfiles", uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid: snap.id,
      email: data.email || "",
      role: data.role || "ADMIN",
      enabled: data.enabled === true,
      displayName: data.displayName || "",
    };
  } catch (err) {
    console.error("fetch_admin_profile_error", err);
    return null;
  }
}

/**
 * Listens to authentication state and verifies active admin profile.
 */
export function subscribeAdminAuth(
  callback: (profile: AdminProfile | null, loading: boolean) => void
): () => void {
  return onAuthStateChanged(clientAuth, async (user: User | null) => {
    if (!user) {
      callback(null, false);
      return;
    }
    const profile = await getAdminProfile(user.uid);
    callback(profile, false);
  });
}

/**
 * Fetches all batches from Firestore.
 */
export async function getAdminBatches(): Promise<BatchRecord[]> {
  const snap = await getDocs(collection(clientDb, "batches"));
  return snap.docs.map((d) => ({ batchId: d.id, ...d.data() } as BatchRecord));
}

/**
 * Updates an existing batch document in Firestore.
 */
export async function updateAdminBatch(
  batchId: string,
  updates: Partial<BatchRecord>
): Promise<void> {
  const batchRef = doc(clientDb, "batches", batchId);
  await updateDoc(batchRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Fetches learners with optional search and limit.
 */
export async function getAdminLearners(options: {
  limit?: number;
  batchId?: string;
} = {}): Promise<AdminLearnerRecord[]> {
  let q = query(collection(clientDb, "learners"));
  if (options.batchId) {
    q = query(q, where("batchId", "==", options.batchId));
  }
  if (options.limit) {
    q = query(q, firestoreLimit(options.limit));
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, learnerId: d.id, ...d.data() } as AdminLearnerRecord));
}

/**
 * Updates a learner record in Firestore.
 */
export async function updateAdminLearner(
  learnerId: string,
  updates: Partial<AdminLearnerRecord>
): Promise<void> {
  const learnerRef = doc(clientDb, "learners", learnerId);
  await updateDoc(learnerRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Fetches global system settings from Firestore.
 */
export async function getAdminSystemSettings(): Promise<SystemSettingsRecord> {
  const snap = await getDoc(doc(clientDb, "systemSettings", "global"));
  if (!snap.exists()) {
    return {
      registrationEnabled: false,
      maintenanceNotice: null,
      updatedAt: new Date().toISOString(),
    } as any;
  }
  return snap.data() as SystemSettingsRecord;
}

/**
 * Updates global system settings in Firestore.
 */
export async function updateAdminSystemSettings(
  updates: Partial<SystemSettingsRecord>
): Promise<void> {
  const settingsRef = doc(clientDb, "systemSettings", "global");
  await updateDoc(settingsRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Exports learner roster data to CSV.
 */
export async function exportLearnersCsv(): Promise<string> {
  const learners = await getAdminLearners();
  const headers = [
    "Learner ID",
    "Full Name",
    "Email",
    "Contact Number",
    "Sex",
    "Birthdate",
    "Age",
    "Address",
    "Employment Status",
    "Educational Attainment",
    "Registration Date",
  ];
  const rows = learners.map((l) => [
    `"${l.learnerId || l.id}"`,
    `"${l.fullName || ""}"`,
    `"${l.email || ""}"`,
    `"${l.contactNumber || ""}"`,
    `"${l.sex || ""}"`,
    `"${l.birthdate || ""}"`,
    `"${l.age ?? ""}"`,
    `"${l.address || ""}"`,
    `"${l.employmentStatus || ""}"`,
    `"${l.educationalAttainment || ""}"`,
    `"${l.createdAt || ""}"`,
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
