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
  getDocs,
  setDoc,
  updateDoc,
  collection,
  runTransaction,
} from "firebase/firestore";
import { generateReferenceNumber } from "../lib/reference.ts";
import { toInitials, sha256Hex } from "../lib/registration/spark-registration.ts";

const rulesPath = new URL("../firestore.rules", import.meta.url);
const rulesContent = await readFile(rulesPath, "utf8");

const TEST_PROJECT_ID = "aifat-spark-client-integration";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST
  ? process.env.FIRESTORE_EMULATOR_HOST.split(":")[0]
  : "127.0.0.1";
const EMULATOR_PORT = process.env.FIRESTORE_EMULATOR_HOST
  ? Number(process.env.FIRESTORE_EMULATOR_HOST.split(":")[1])
  : 8080;

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

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // Admin profiles
      await setDoc(doc(db, "adminProfiles", "super_admin_1"), {
        email: "superadmin@example.invalid",
        role: "SUPER_ADMIN",
        enabled: true,
        displayName: "Super Admin",
      });
      await setDoc(doc(db, "adminProfiles", "admin_1"), {
        email: "admin1@example.invalid",
        role: "ADMIN",
        enabled: true,
        displayName: "Admin One",
      });

      // Global system settings
      await setDoc(doc(db, "systemSettings", "global"), {
        registrationEnabled: true,
      });

      // Batches
      await setDoc(doc(db, "batches", "t-online-am"), {
        batchId: "t-online-am",
        classDesignation: "AIFAT Class T01-2026",
        aorCode: "T",
        aorName: "NCR AOR",
        deliveryMode: "Online",
        session: "AM",
        status: "OPEN",
        enabled: true,
        capacity: 25,
        registeredCount: 0,
        registrationDeadline: null,
      });

      await setDoc(doc(db, "batches", "t-nearly-full"), {
        batchId: "t-nearly-full",
        classDesignation: "AIFAT Class T02-2026",
        aorCode: "T",
        aorName: "NCR AOR",
        deliveryMode: "Online",
        session: "PM",
        status: "NEARLY FULL",
        enabled: true,
        capacity: 25,
        registeredCount: 24,
        registrationDeadline: null,
      });

      await setDoc(doc(db, "batches", "t-full"), {
        batchId: "t-full",
        classDesignation: "AIFAT Class T03-2026",
        aorCode: "T",
        aorName: "NCR AOR",
        deliveryMode: "Face-to-Face",
        session: "AM",
        status: "FULL",
        enabled: true,
        capacity: 25,
        registeredCount: 25,
        registrationDeadline: null,
      });

      await setDoc(doc(db, "batches", "t-closed"), {
        batchId: "t-closed",
        classDesignation: "AIFAT Class T04-2026",
        aorCode: "T",
        aorName: "NCR AOR",
        deliveryMode: "Face-to-Face",
        session: "PM",
        status: "CLOSED",
        enabled: true,
        capacity: 25,
        registeredCount: 0,
        registrationDeadline: null,
      });
    });
  }
});

// Helper to simulate atomic client transaction with anonymous auth context
async function executeSparkTransaction(clientDb, authUid, batchId, email, fullName, aorCode) {
  const learnerId = `learner_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const registrationId = `reg_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const referenceNumber = generateReferenceNumber({ aorCode, year: 2026 });
  const dupKey = await sha256Hex(`${batchId.trim().toLowerCase()}:${email.trim().toLowerCase()}`);
  const now = new Date().toISOString();
  const initials = toInitials(fullName);

  return runTransaction(clientDb, async (transaction) => {
    const batchRef = doc(clientDb, "batches", batchId);
    const batchSnap = await transaction.get(batchRef);

    if (!batchSnap.exists()) {
      throw new Error("Batch not found");
    }
    const batchData = batchSnap.data();
    if (!batchData.enabled || batchData.status === "CLOSED" || !["OPEN", "NEARLY FULL"].includes(batchData.status)) {
      throw new Error("Batch not open");
    }
    const currentCount = Number(batchData.registeredCount) || 0;
    const capacity = Number(batchData.capacity) || 25;
    if (currentCount >= capacity) {
      throw new Error("Batch is full");
    }

    const newCount = currentCount + 1;
    transaction.update(batchRef, {
      registeredCount: newCount,
      lastRegistrationId: registrationId,
      ...(newCount >= capacity ? { status: "FULL" } : {}),
    });

    // Write-once duplicate lock (NO transaction.get)
    const dupRef = doc(clientDb, "duplicates", dupKey);
    transaction.set(dupRef, {
      duplicateKey: dupKey,
      registrationId,
      batchId,
      userId: authUid,
      createdAt: now,
    });

    // Protected learner record
    const learnerRef = doc(clientDb, "learners", learnerId);
    transaction.set(learnerRef, {
      learnerId,
      registrationId,
      userId: authUid,
      fullName,
      email: email.trim().toLowerCase(),
      contactNumber: "09171234567",
      address: "123 Camp Aguinaldo, Quezon City",
      nationality: "Filipino",
      sex: "Male",
      civilStatus: "Single",
      birthdate: "2000-01-01",
      employmentStatus: "Wage-Employed",
      educationalAttainment: "College Graduate",
      learnerClassification: "Others",
      courseQualification: "AI Foundation and Applications Training",
      createdAt: now,
    });

    // Private registration record
    const regRef = doc(clientDb, "registrations", registrationId);
    transaction.set(regRef, {
      id: registrationId,
      referenceNumber,
      learnerId,
      batchId,
      aorCode,
      duplicateKey: dupKey,
      status: "CONFIRMED",
      trainingYear: 2026,
      createdAt: now,
      userId: authUid,
    });

    // Public verification record (NO initials, NO registrationId)
    const verifRef = doc(clientDb, "verifications", referenceNumber);
    transaction.set(verifRef, {
      referenceNumber,
      batchId,
      classDesignation: batchData.classDesignation,
      aorName: batchData.aorName,
      deliveryMode: batchData.deliveryMode,
      session: batchData.session,
      trainingYear: 2026,
      status: "CONFIRMED",
      createdAt: now,
    });

    return { referenceNumber, learnerId, registrationId, dupKey, newCount };
  });
}

test("Integration 1: Successful registration creates learner, registration, duplicate lock, verification, and updates seat count", async () => {
  const learnerContext = testEnv.authenticatedContext("anon_learner_1");
  const db = learnerContext.firestore();

  const result = await assertSucceeds(
    executeSparkTransaction(db, "anon_learner_1", "t-online-am", "jdelacruz@example.invalid", "Juan Dela Cruz", "T")
  );

  assert.ok(result.referenceNumber.startsWith("AIFAT-2026-T-"));
  assert.equal(result.newCount, 1);

  // Read verification record as unauthenticated public user
  const unauthContext = testEnv.unauthenticatedContext();
  const unauthDb = unauthContext.firestore();
  const verifSnap = await getDoc(doc(unauthDb, "verifications", result.referenceNumber));
  assert.ok(verifSnap.exists());
  const verifData = verifSnap.data();

  // Authoritative non-sensitive fields present
  assert.equal(verifData.referenceNumber, result.referenceNumber);
  assert.equal(verifData.classDesignation, "AIFAT Class T01-2026");
  assert.equal(verifData.aorName, "NCR AOR");
  assert.equal(verifData.deliveryMode, "Online");
  assert.equal(verifData.session, "AM");
  assert.equal(verifData.trainingYear, 2026);
  assert.equal(verifData.status, "CONFIRMED");

  // Privacy minimization: learner initials, names, IDs strictly absent
  assert.equal(verifData.initials, undefined);
  assert.equal(verifData.registrationId, undefined);
  assert.equal(verifData.learnerId, undefined);
  assert.equal(verifData.email, undefined);
  assert.equal(verifData.contactNumber, undefined);
  assert.equal(verifData.address, undefined);
  assert.equal(verifData.birthdate, undefined);
  assert.equal(verifData.duplicateKey, undefined);
  assert.equal(verifData.userId, undefined);
});

test("Integration 2: Duplicate registration with identical batch and email fails atomically without seat increment", async () => {
  const learner1 = testEnv.authenticatedContext("anon_learner_1");
  const db1 = learner1.firestore();

  // First registration succeeds
  await assertSucceeds(
    executeSparkTransaction(db1, "anon_learner_1", "t-online-am", "duplicate.test@example.invalid", "Maria Santos", "T")
  );

  // Second registration by same or another user with same email + batch fails
  const learner2 = testEnv.authenticatedContext("anon_learner_2");
  const db2 = learner2.firestore();

  await assertFails(
    executeSparkTransaction(db2, "anon_learner_2", "t-online-am", "duplicate.test@example.invalid", "Maria Santos", "T")
  );

  // Verify registeredCount remained at 1
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  const batchSnap = await getDoc(doc(unauthDb, "batches", "t-online-am"));
  assert.equal(batchSnap.data().registeredCount, 1);
});

test("Integration 3: Registration on a full batch is rejected by client check and by security rules", async () => {
  const learner = testEnv.authenticatedContext("anon_learner_full");
  const db = learner.firestore();

  // A: Normal transaction rejects at client level
  await assert.rejects(
    () => executeSparkTransaction(db, "anon_learner_full", "t-full", "learner.full@example.invalid", "Full Tester", "T"),
    /Batch not open|Batch is full/
  );

  // B: Bypassed client (direct rule violation) is denied by Firestore Security Rules
  await assertFails(
    updateDoc(doc(db, "batches", "t-full"), {
      registeredCount: 26,
    })
  );
});

test("Integration 4: Registration on a closed batch is rejected by client check and by security rules", async () => {
  const learner = testEnv.authenticatedContext("anon_learner_closed");
  const db = learner.firestore();

  // A: Normal transaction rejects at client level
  await assert.rejects(
    () => executeSparkTransaction(db, "anon_learner_closed", "t-closed", "learner.closed@example.invalid", "Closed Tester", "T"),
    /Batch not open/
  );

  // B: Bypassed client (direct rule violation) is denied by Firestore Security Rules
  await assertFails(
    updateDoc(doc(db, "batches", "t-closed"), {
      registeredCount: 1,
    })
  );
});

test("Integration 5: 25th seat registration succeeds and marks batch FULL", async () => {
  const learner = testEnv.authenticatedContext("anon_learner_25");
  const db = learner.firestore();

  const result = await assertSucceeds(
    executeSparkTransaction(db, "anon_learner_25", "t-nearly-full", "seat25@example.invalid", "Seat Twentyfive", "T")
  );
  assert.equal(result.newCount, 25);

  const unauthDb = testEnv.unauthenticatedContext().firestore();
  const batchSnap = await getDoc(doc(unauthDb, "batches", "t-nearly-full"));
  assert.equal(batchSnap.data().registeredCount, 25);
  assert.equal(batchSnap.data().status, "FULL");
});

test("Integration 6: Other anonymous users cannot read protected learner PII", async () => {
  const learner1 = testEnv.authenticatedContext("anon_user_owner");
  const db1 = learner1.firestore();

  const result = await assertSucceeds(
    executeSparkTransaction(db1, "anon_user_owner", "t-online-am", "pii.owner@example.invalid", "PII Protected", "T")
  );

  // Owner can read their own learner record
  const ownerSnap = await assertSucceeds(getDoc(doc(db1, "learners", result.learnerId)));
  assert.ok(ownerSnap.exists());
  assert.equal(ownerSnap.data().email, "pii.owner@example.invalid");

  // Another anonymous user CANNOT read it
  const otherUser = testEnv.authenticatedContext("anon_user_attacker");
  const dbOther = otherUser.firestore();
  await assertFails(getDoc(doc(dbOther, "learners", result.learnerId)));

  // Unauthenticated client CANNOT read it
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(unauthDb, "learners", result.learnerId)));
});

test("Integration 7: Admin context can inspect learners and update batches, but cannot modify adminProfiles", async () => {
  const adminContext = testEnv.authenticatedContext("admin_1");
  const adminDb = adminContext.firestore();

  // Admin can read all batches
  const batchesSnap = await assertSucceeds(getDocs(collection(adminDb, "batches")));
  assert.ok(batchesSnap.size >= 4);

  // Admin can update batch status
  await assertSucceeds(
    updateDoc(doc(adminDb, "batches", "t-online-am"), {
      status: "NEARLY FULL",
    })
  );

  // Admin CANNOT modify adminProfiles
  await assertFails(
    setDoc(doc(adminDb, "adminProfiles", "new_admin_attempt"), {
      email: "injected@example.invalid",
      role: "ADMIN",
      enabled: true,
    })
  );

  await assertFails(
    updateDoc(doc(adminDb, "adminProfiles", "admin_1"), {
      role: "SUPER_ADMIN",
    })
  );
});

test("Integration 8: Crockford Base32 reference generation format check", () => {
  const ref1 = generateReferenceNumber({ aorCode: "T", year: 2026 });
  const ref2 = generateReferenceNumber({ aorCode: "A", year: 2026 });

  assert.match(ref1, /^AIFAT-2026-T-[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.match(ref2, /^AIFAT-2026-A-[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.notEqual(ref1, ref2);
});

test("Integration 9: Malicious client attempting to forge verification fields (fabricated delivery mode or year) fails", async () => {
  const learner = testEnv.authenticatedContext("anon_forger_1");
  const db = learner.firestore();

  // Attempt to write verification record with forged deliveryMode ("Face-to-Face" when batch is "Online")
  await assertFails(
    setDoc(doc(db, "verifications", "AIFAT-2026-T-FORG"), {
      referenceNumber: "AIFAT-2026-T-FORG",
      batchId: "t-online-am",
      classDesignation: "AIFAT Class T01-2026",
      aorName: "NCR AOR",
      deliveryMode: "Face-to-Face", // FORGERY: batch is Online
      session: "AM",
      trainingYear: 2026,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
    })
  );

  // Attempt to write verification record with forged year (2025 instead of 2026)
  await assertFails(
    setDoc(doc(db, "verifications", "AIFAT-2026-T-FOR2"), {
      referenceNumber: "AIFAT-2026-T-FOR2",
      batchId: "t-online-am",
      classDesignation: "AIFAT Class T01-2026",
      aorName: "NCR AOR",
      deliveryMode: "Online",
      session: "AM",
      trainingYear: 2025, // FORGERY: must be 2026
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
    })
  );
});

test("Integration 10: Malicious client attempting to forge AOR on registration fails", async () => {
  const learner = testEnv.authenticatedContext("anon_forger_2");
  const db = learner.firestore();

  // Registration on t-online-am (NCR, aorCode: "T") with forged aorCode "A"
  await assertFails(
    executeSparkTransaction(db, "anon_forger_2", "t-online-am", "forger@example.invalid", "Forger Test", "A")
  );
});

