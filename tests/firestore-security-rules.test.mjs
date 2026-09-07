import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { before, after, beforeEach } from "node:test";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
} from "firebase/firestore";

const rulesPath = new URL("../firestore.rules", import.meta.url);
const rulesContent = await readFile(rulesPath, "utf8");

const TEST_PROJECT_ID = "aifat-emulator-rules-test";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ? process.env.FIRESTORE_EMULATOR_HOST.split(":")[0] : "127.0.0.1";
const EMULATOR_PORT = process.env.FIRESTORE_EMULATOR_HOST ? Number(process.env.FIRESTORE_EMULATOR_HOST.split(":")[1]) : 8080;

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: {
      rules: rulesContent,
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
    // Seed test fixtures using security-rules-disabled privileged context
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      // 1. Super Admin Profile
      await setDoc(doc(db, "adminProfiles", "super_admin_1"), {
        email: "superadmin@example.invalid",
        role: "SUPER_ADMIN",
        enabled: true,
        displayName: "Super Admin",
      });
      // 2. Ordinary Admin Profile
      await setDoc(doc(db, "adminProfiles", "admin_ordinary"), {
        email: "ordinaryadmin@example.invalid",
        role: "ADMIN",
        enabled: true,
        displayName: "Ordinary Admin",
      });
      // 3. Disabled Admin Profile
      await setDoc(doc(db, "adminProfiles", "disabled_admin"), {
        email: "disabled@example.invalid",
        role: "ADMIN",
        enabled: false,
        displayName: "Disabled Admin",
      });
      // 4. Sample batch
      await setDoc(doc(db, "batches", "t-online-am"), {
        batchId: "t-online-am",
        status: "CLOSED",
        enabled: true,
        capacity: 25,
      });
      // 5. Sample settings
      await setDoc(doc(db, "systemSettings", "global"), {
        registrationEnabled: false,
      });
    });
  }
});

test("Rules Static: firestore.rules specifies allow write: if false for adminProfiles", () => {
  assert.match(rulesContent, /match \/adminProfiles\/\{uid\} \{[\s\S]*?allow write:\s*if false;/);
  assert.doesNotMatch(rulesContent, /match \/adminProfiles\/\{uid\} \{[\s\S]*?allow write:\s*if isAdmin\(\);/);
});

test("Rules Emulator 1: Unauthenticated client cannot read or write adminProfiles", async () => {
  const unauthedDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(unauthedDb, "adminProfiles", "admin_ordinary")));
  await assertFails(setDoc(doc(unauthedDb, "adminProfiles", "new_attacker"), { role: "SUPER_ADMIN" }));
});

test("Rules Emulator 2: Ordinary authenticated non-admin cannot read another user's profile", async () => {
  const userDb = testEnv.authenticatedContext("learner_user_123").firestore();
  await assertFails(getDoc(doc(userDb, "adminProfiles", "admin_ordinary")));
});

test("Rules Emulator 3: Authenticated user may read its own profile document", async () => {
  const userDb = testEnv.authenticatedContext("learner_user_123").firestore();
  // Under the rule: allow read: if isAuthenticated() && (request.auth.uid == uid || isAdmin());
  await assertSucceeds(getDoc(doc(userDb, "adminProfiles", "learner_user_123")));
});

test("Rules Emulator 4: Active ADMIN may read required admin profiles", async () => {
  const adminDb = testEnv.authenticatedContext("admin_ordinary").firestore();
  await assertSucceeds(getDoc(doc(adminDb, "adminProfiles", "admin_ordinary")));
  await assertSucceeds(getDoc(doc(adminDb, "adminProfiles", "super_admin_1")));
});

test("Rules Emulator 5: Active ADMIN create is strictly DENIED", async () => {
  const adminDb = testEnv.authenticatedContext("admin_ordinary").firestore();
  await assertFails(setDoc(doc(adminDb, "adminProfiles", "new_admin_doc"), {
    email: "newadmin@example.invalid",
    role: "ADMIN",
    enabled: true,
  }));
});

test("Rules Emulator 6: Active ADMIN update is strictly DENIED", async () => {
  const adminDb = testEnv.authenticatedContext("admin_ordinary").firestore();
  await assertFails(updateDoc(doc(adminDb, "adminProfiles", "admin_ordinary"), {
    displayName: "Modified Admin",
  }));
});

test("Rules Emulator 7: Active ADMIN delete is strictly DENIED", async () => {
  const adminDb = testEnv.authenticatedContext("admin_ordinary").firestore();
  await assertFails(deleteDoc(doc(adminDb, "adminProfiles", "disabled_admin")));
});

test("Rules Emulator 8: Active ADMIN self-promotion to SUPER_ADMIN is strictly DENIED", async () => {
  const adminDb = testEnv.authenticatedContext("admin_ordinary").firestore();
  await assertFails(setDoc(doc(adminDb, "adminProfiles", "admin_ordinary"), {
    role: "SUPER_ADMIN",
  }, { merge: true }));
});

test("Rules Emulator 9: Active ADMIN modification of another administrator is strictly DENIED", async () => {
  const adminDb = testEnv.authenticatedContext("admin_ordinary").firestore();
  await assertFails(setDoc(doc(adminDb, "adminProfiles", "super_admin_1"), {
    role: "ADMIN",
    enabled: false,
  }, { merge: true }));
});

test("Rules Emulator 10: SUPER_ADMIN direct client create/update/delete is strictly DENIED (server-mediated only)", async () => {
  const superAdminDb = testEnv.authenticatedContext("super_admin_1").firestore();
  // Create
  await assertFails(setDoc(doc(superAdminDb, "adminProfiles", "another_admin"), { role: "ADMIN", enabled: true }));
  // Update
  await assertFails(updateDoc(doc(superAdminDb, "adminProfiles", "admin_ordinary"), { enabled: false }));
  // Delete
  await assertFails(deleteDoc(doc(superAdminDb, "adminProfiles", "disabled_admin")));
});

test("Rules Emulator 11: Existing protected collections continue enforcing their rules", async () => {
  const unauthedDb = testEnv.unauthenticatedContext().firestore();
  const userDb = testEnv.authenticatedContext("learner_user_123").firestore();
  const adminDb = testEnv.authenticatedContext("admin_ordinary").firestore();

  // Batches: Public read allowed, write requires admin
  await assertSucceeds(getDoc(doc(unauthedDb, "batches", "t-online-am")));
  await assertFails(updateDoc(doc(unauthedDb, "batches", "t-online-am"), { capacity: 50 }));
  await assertFails(updateDoc(doc(userDb, "batches", "t-online-am"), { capacity: 50 }));
  await assertSucceeds(updateDoc(doc(adminDb, "batches", "t-online-am"), { capacity: 50 }));

  // Learners: Client read/write denied for non-admin, allowed for admin
  await assertFails(getDoc(doc(unauthedDb, "learners", "l1")));
  await assertFails(setDoc(doc(unauthedDb, "learners", "l1"), { fullName: "Test" }));
  await assertFails(getDoc(doc(userDb, "learners", "l1")));
  await assertFails(setDoc(doc(userDb, "learners", "l1"), { fullName: "Test" }));
  await assertSucceeds(setDoc(doc(adminDb, "learners", "l1"), { fullName: "Test" }));
  await assertSucceeds(getDoc(doc(adminDb, "learners", "l1")));

  // Registrations: Client read/write denied for non-admin, allowed for admin
  await assertFails(getDoc(doc(unauthedDb, "registrations", "r1")));
  await assertFails(setDoc(doc(userDb, "registrations", "r1"), { batchId: "t-online-am" }));
  await assertSucceeds(setDoc(doc(adminDb, "registrations", "r1"), { batchId: "t-online-am" }));

  // Duplicates & Counters: Server-only (all client access denied)
  await assertFails(getDoc(doc(adminDb, "duplicates", "d1")));
  await assertFails(setDoc(doc(adminDb, "duplicates", "d1"), { exists: true }));
  await assertFails(getDoc(doc(adminDb, "counters", "c1")));
  await assertFails(setDoc(doc(adminDb, "counters", "c1"), { seq: 1 }));

  // Audit Logs: Admin read-only, all client writes denied
  await assertFails(getDoc(doc(userDb, "auditLogs", "log1")));
  await assertFails(setDoc(doc(adminDb, "auditLogs", "log1"), { action: "TEST" }));
  await assertSucceeds(getDoc(doc(adminDb, "auditLogs", "log1")));
});
