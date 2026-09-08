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
  deleteDoc,
  collection,
  runTransaction,
} from "firebase/firestore";

const rulesPath = new URL("../firestore.rules", import.meta.url);
const rulesContent = await readFile(rulesPath, "utf8");

const TEST_PROJECT_ID = "aifat-spark-security-proof";
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
    // Seed fixtures with security rules disabled
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      // Admin Profiles
      await setDoc(doc(db, "adminProfiles", "super_admin_1"), {
        email: "superadmin@example.invalid",
        role: "SUPER_ADMIN",
        enabled: true,
        displayName: "Super Admin",
      });
      await setDoc(doc(db, "adminProfiles", "admin_ordinary"), {
        email: "ordinaryadmin@example.invalid",
        role: "ADMIN",
        enabled: true,
        displayName: "Ordinary Admin",
      });

      // Global switch (default enabled for test setups, toggled in specific tests)
      await setDoc(doc(db, "systemSettings", "global"), {
        registrationEnabled: true,
      });

      // Standard open batch (capacity 25, 0 registered)
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

      // CLOSED batch
      await setDoc(doc(db, "batches", "t-closed-batch"), {
        batchId: "t-closed-batch",
        classDesignation: "AIFAT Class T02-2026",
        aorCode: "T",
        aorName: "NCR AOR",
        deliveryMode: "Online",
        session: "PM",
        status: "CLOSED",
        enabled: true,
        capacity: 25,
        registeredCount: 0,
        registrationDeadline: null,
      });

      // Disabled batch
      await setDoc(doc(db, "batches", "t-disabled-batch"), {
        batchId: "t-disabled-batch",
        classDesignation: "AIFAT Class T03-2026",
        aorCode: "T",
        aorName: "NCR AOR",
        deliveryMode: "Face-to-Face",
        session: "AM",
        status: "OPEN",
        enabled: false,
        capacity: 25,
        registeredCount: 0,
        registrationDeadline: null,
      });

      // Expired deadline batch (yesterday)
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      await setDoc(doc(db, "batches", "t-expired-batch"), {
        batchId: "t-expired-batch",
        classDesignation: "AIFAT Class T04-2026",
        aorCode: "T",
        aorName: "NCR AOR",
        deliveryMode: "Face-to-Face",
        session: "PM",
        status: "OPEN",
        enabled: true,
        capacity: 25,
        registeredCount: 0,
        registrationDeadline: yesterday,
      });

      // Batch with 24 seats filled (1 seat left)
      await setDoc(doc(db, "batches", "t-nearly-full"), {
        batchId: "t-nearly-full",
        classDesignation: "AIFAT Class T01-2026",
        aorCode: "T",
        aorName: "NCR AOR",
        deliveryMode: "Online",
        session: "AM",
        status: "NEARLY FULL",
        enabled: true,
        capacity: 25,
        registeredCount: 24,
        registrationDeadline: null,
      });

      // Batch already completely full (25 of 25 seats filled)
      await setDoc(doc(db, "batches", "t-full-batch"), {
        batchId: "t-full-batch",
        classDesignation: "AIFAT Class T02-2026",
        aorCode: "T",
        aorName: "NCR AOR",
        deliveryMode: "Online",
        session: "PM",
        status: "FULL",
        enabled: true,
        capacity: 25,
        registeredCount: 25,
        registrationDeadline: null,
      });
    });
  }
});

// Helper to execute atomic registration
async function executeAtomicRegistration(db, authUid, options = {}) {
  const batchId = options.batchId || "t-online-am";
  const regId = options.regId || `reg_${Math.random().toString(36).slice(2, 10)}`;
  const learnerId = options.learnerId || `learner_${Math.random().toString(36).slice(2, 10)}`;
  const dupKey = options.dupKey || `dup_${Math.random().toString(36).slice(2, 10)}`;
  const refNumber = options.refNumber || `AIFAT-2026-T-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  return await runTransaction(db, async (transaction) => {
    const batchRef = doc(db, "batches", batchId);
    const batchSnap = await transaction.get(batchRef);
    if (!batchSnap.exists()) throw new Error("Batch does not exist");
    const bData = batchSnap.data();

    const currentCount = bData.registeredCount || 0;
    const capacity = bData.capacity || 25;
    const nextCount = currentCount + 1;
    const isFull = nextCount >= capacity;

    transaction.update(batchRef, {
      registeredCount: nextCount,
      lastRegistrationId: regId,
      ...(isFull ? { status: "FULL" } : {}),
    });

    const dupRef = doc(db, "duplicates", dupKey);
    transaction.set(dupRef, {
      duplicateKey: dupKey,
      registrationId: regId,
      batchId,
      userId: authUid,
      createdAt: now,
    });

    const learnerRef = doc(db, "learners", learnerId);
    transaction.set(learnerRef, {
      learnerId,
      registrationId: regId,
      userId: authUid,
      fullName: options.fullName || "Juan Dela Cruz",
      email: options.email || "juan@example.invalid",
      createdAt: now,
    });

    const regRef = doc(db, "registrations", regId);
    transaction.set(regRef, {
      id: regId,
      referenceNumber: refNumber,
      learnerId,
      batchId,
      aorCode: "T",
      duplicateKey: dupKey,
      status: "CONFIRMED",
      trainingYear: 2026,
      createdAt: now,
      userId: authUid,
    });

    const verifRef = doc(db, "verifications", refNumber);
    transaction.set(verifRef, {
      referenceNumber: refNumber,
      batchId,
      classDesignation: bData.classDesignation || "AIFAT Class T01-2026",
      aorName: bData.aorName || "NCR AOR",
      deliveryMode: bData.deliveryMode || "Online",
      session: bData.session || "AM",
      trainingYear: 2026,
      status: "CONFIRMED",
      createdAt: now,
    });

    return { regId, refNumber, learnerId, dupKey };
  });
}

// 1. registration blocked while global switch false
test("1. Abuse Test: Registration blocked while global switch false", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "systemSettings", "global"), {
      registrationEnabled: false,
    });
  });
  const learnerDb = testEnv.authenticatedContext("anon_learner_1").firestore();
  await assertFails(executeAtomicRegistration(learnerDb, "anon_learner_1"));
});

// 2. registration blocked for CLOSED batch
test("2. Abuse Test: Registration blocked for CLOSED batch", async () => {
  const learnerDb = testEnv.authenticatedContext("anon_learner_2").firestore();
  await assertFails(executeAtomicRegistration(learnerDb, "anon_learner_2", { batchId: "t-closed-batch" }));
});

// 3. registration blocked for disabled batch
test("3. Abuse Test: Registration blocked for disabled batch", async () => {
  const learnerDb = testEnv.authenticatedContext("anon_learner_3").firestore();
  await assertFails(executeAtomicRegistration(learnerDb, "anon_learner_3", { batchId: "t-disabled-batch" }));
});

// 4. registration blocked after deadline
test("4. Abuse Test: Registration blocked after deadline", async () => {
  const learnerDb = testEnv.authenticatedContext("anon_learner_4").firestore();
  await assertFails(executeAtomicRegistration(learnerDb, "anon_learner_4", { batchId: "t-expired-batch" }));
});

// 5. 25th learner succeeds
test("5. Abuse Test: 25th learner succeeds on batch with 24 seats filled", async () => {
  const learnerDb = testEnv.authenticatedContext("anon_learner_25").firestore();
  await assertSucceeds(executeAtomicRegistration(learnerDb, "anon_learner_25", { batchId: "t-nearly-full" }));

  // Verify batch reached capacity and FULL status
  let batchData;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snap = await getDoc(doc(context.firestore(), "batches", "t-nearly-full"));
    batchData = snap.data();
  });
  assert.equal(batchData.registeredCount, 25);
  assert.equal(batchData.status, "FULL");
});

// 6. 26th learner fails
test("6. Abuse Test: 26th learner fails on full batch", async () => {
  const learnerDb = testEnv.authenticatedContext("anon_learner_26").firestore();
  await assertFails(executeAtomicRegistration(learnerDb, "anon_learner_26", { batchId: "t-full-batch" }));
});

// 7. simultaneous final-seat attempts result in only one successful seat allocation
test("7. Abuse Test: Simultaneous final-seat attempts result in exactly one successful seat allocation", async () => {
  const learner1Db = testEnv.authenticatedContext("race_learner_1").firestore();
  const learner2Db = testEnv.authenticatedContext("race_learner_2").firestore();

  const results = await Promise.allSettled([
    executeAtomicRegistration(learner1Db, "race_learner_1", { batchId: "t-nearly-full" }),
    executeAtomicRegistration(learner2Db, "race_learner_2", { batchId: "t-nearly-full" }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  assert.equal(fulfilled.length, 1, "Exactly one learner must succeed in race condition");
  assert.equal(rejected.length, 1, "The competing learner must be rejected");

  let batchData;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snap = await getDoc(doc(context.firestore(), "batches", "t-nearly-full"));
    batchData = snap.data();
  });
  assert.equal(batchData.registeredCount, 25, "Registered count must not exceed capacity 25");
});

// 8. duplicate registration fails (Write-Once Lock verification)
test("8. Abuse Test: Duplicate registration with identical duplicateKey fails atomically", async () => {
  const learner1Db = testEnv.authenticatedContext("anon_learner_dup1").firestore();
  const dupKey = "dup_hash_user_alpha_t_online_am";

  // First registration succeeds
  await assertSucceeds(executeAtomicRegistration(learner1Db, "anon_learner_dup1", { dupKey }));

  // Second registration with the same duplicateKey (even from different user/device) fails
  const learner2Db = testEnv.authenticatedContext("anon_learner_dup2").firestore();
  await assertFails(executeAtomicRegistration(learner2Db, "anon_learner_dup2", { dupKey }));
});

// 9. forged batch increment fails (client tries to increment batch without registration)
test("9. Abuse Test: Forged batch increment directly without atomic registration fails", async () => {
  const attackerDb = testEnv.authenticatedContext("attacker_1").firestore();
  await assertFails(
    updateDoc(doc(attackerDb, "batches", "t-online-am"), {
      registeredCount: 1,
      lastRegistrationId: "fake_nonexistent_reg",
    })
  );
});

// 10. forged registration without seat allocation fails
test("10. Abuse Test: Forged registration creation without batch seat allocation fails", async () => {
  const attackerDb = testEnv.authenticatedContext("attacker_2").firestore();
  await assertFails(
    setDoc(doc(attackerDb, "registrations", "forged_reg_1"), {
      id: "forged_reg_1",
      referenceNumber: "AIFAT-2026-T-9999",
      learnerId: "learner_fake",
      batchId: "t-online-am",
      aorCode: "T",
      duplicateKey: "fake_dup",
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      userId: "attacker_2",
    })
  );
});

// 11. forged learner/profile creation fails
test("11. Abuse Test: Forged learner profile creation without registration fails", async () => {
  const attackerDb = testEnv.authenticatedContext("attacker_3").firestore();
  await assertFails(
    setDoc(doc(attackerDb, "learners", "forged_learner_1"), {
      learnerId: "forged_learner_1",
      registrationId: "fake_reg",
      userId: "attacker_3",
      fullName: "Forged Profile",
      email: "forged@example.invalid",
      createdAt: new Date().toISOString(),
    })
  );
});

// 12. forged duplicate lock fails
test("12. Abuse Test: Forged duplicate lock document creation without registration fails", async () => {
  const attackerDb = testEnv.authenticatedContext("attacker_4").firestore();
  await assertFails(
    setDoc(doc(attackerDb, "duplicates", "forged_dup_1"), {
      duplicateKey: "forged_dup_1",
      registrationId: "fake_reg",
      batchId: "t-online-am",
      userId: "attacker_4",
      createdAt: new Date().toISOString(),
    })
  );
});

// 13. forged public verification fails
test("13. Abuse Test: Forged public verification creation without registration fails", async () => {
  const attackerDb = testEnv.authenticatedContext("attacker_5").firestore();
  await assertFails(
    setDoc(doc(attackerDb, "verifications", "AIFAT-2026-T-9999"), {
      referenceNumber: "AIFAT-2026-T-9999",
      registrationId: "fake_reg",
      batchId: "t-online-am",
      classDesignation: "AIFAT Class T01-2026",
      aorName: "NCR AOR",
      deliveryMode: "Online",
      session: "AM",
      initials: "F. P.",
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
    })
  );
});

// 14. learner A cannot read learner B's PII
test("14. Abuse Test: Learner A cannot read learner B's PII", async () => {
  const learnerADb = testEnv.authenticatedContext("learner_A").firestore();
  const learnerBDb = testEnv.authenticatedContext("learner_B").firestore();

  const regB = await executeAtomicRegistration(learnerBDb, "learner_B", {
    fullName: "Private Learner B",
    email: "learner_b@example.invalid",
  });

  // Learner B can read their own learner profile
  await assertSucceeds(getDoc(doc(learnerBDb, "learners", regB.learnerId)));

  // Learner A CANNOT read Learner B's learner profile
  await assertFails(getDoc(doc(learnerADb, "learners", regB.learnerId)));
});

// 15. unauthenticated client cannot read learner PII
test("15. Abuse Test: Unauthenticated client cannot read learner PII", async () => {
  const learnerDb = testEnv.authenticatedContext("learner_X").firestore();
  const reg = await executeAtomicRegistration(learnerDb, "learner_X");

  const unauthedDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(unauthedDb, "learners", reg.learnerId)));
});

// 16. anonymous learner cannot enumerate private registrations
test("16. Abuse Test: Anonymous learner cannot enumerate private registrations", async () => {
  const learnerDb = testEnv.authenticatedContext("learner_anon").firestore();
  // Attempting full collection scan
  await assertFails(getDocs(collection(learnerDb, "registrations")));
  // Attempting full duplicates scan
  await assertFails(getDocs(collection(learnerDb, "duplicates")));
  // Attempting direct read of duplicate lock (privacy property)
  await assertFails(getDoc(doc(learnerDb, "duplicates", "any_dup_key")));
});

// 17. anonymous learner cannot modify batch metadata
test("17. Abuse Test: Anonymous learner cannot modify batch metadata (name, dates, venue)", async () => {
  const learnerDb = testEnv.authenticatedContext("learner_tamper").firestore();
  await assertFails(
    updateDoc(doc(learnerDb, "batches", "t-online-am"), {
      venue: "Hacked Venue",
    })
  );
  await assertFails(
    updateDoc(doc(learnerDb, "batches", "t-online-am"), {
      classDesignation: "Hacked Class",
    })
  );
});

// 18. anonymous learner cannot change capacity/status/AOR/class
test("18. Abuse Test: Anonymous learner cannot change capacity, status, or AOR", async () => {
  const learnerDb = testEnv.authenticatedContext("learner_tamper").firestore();
  await assertFails(
    updateDoc(doc(learnerDb, "batches", "t-online-am"), {
      capacity: 100,
    })
  );
  await assertFails(
    updateDoc(doc(learnerDb, "batches", "t-online-am"), {
      status: "CLOSED",
    })
  );
  await assertFails(
    updateDoc(doc(learnerDb, "batches", "t-online-am"), {
      aorCode: "K",
    })
  );
});

// 19. ADMIN cannot modify adminProfiles
test("19. Abuse Test: Active ADMIN cannot modify adminProfiles", async () => {
  const adminDb = testEnv.authenticatedContext("admin_ordinary").firestore();
  await assertFails(
    updateDoc(doc(adminDb, "adminProfiles", "admin_ordinary"), {
      displayName: "Modified Ordinary Admin",
    })
  );
  await assertFails(
    setDoc(doc(adminDb, "adminProfiles", "new_admin_attempt"), {
      role: "ADMIN",
      enabled: true,
    })
  );
});

// 20. SUPER_ADMIN client cannot modify adminProfiles
test("20. Abuse Test: Active SUPER_ADMIN client cannot modify adminProfiles directly", async () => {
  const superAdminDb = testEnv.authenticatedContext("super_admin_1").firestore();
  await assertFails(
    updateDoc(doc(superAdminDb, "adminProfiles", "super_admin_1"), {
      displayName: "Modified Super Admin",
    })
  );
  await assertFails(
    deleteDoc(doc(superAdminDb, "adminProfiles", "admin_ordinary"))
  );
});

// 21. authorized admin can perform only the administrative operations explicitly permitted
test("21. Abuse Test: Authorized admin can perform only explicitly permitted operations", async () => {
  const adminDb = testEnv.authenticatedContext("admin_ordinary").firestore();

  // Permitted: Read batches, update batch capacity/status, read registrations, read learners, read audit logs
  await assertSucceeds(getDoc(doc(adminDb, "batches", "t-online-am")));
  await assertSucceeds(updateDoc(doc(adminDb, "batches", "t-online-am"), { capacity: 30 }));
  await assertSucceeds(updateDoc(doc(adminDb, "systemSettings", "global"), { registrationEnabled: true }));

  // Prohibited: Client write to auditLogs
  await assertFails(setDoc(doc(adminDb, "auditLogs", "client_forged_log"), { action: "HACK" }));
  // Prohibited: Client write to adminProfiles
  await assertFails(setDoc(doc(adminDb, "adminProfiles", "super_admin_1"), { role: "ADMIN" }, { merge: true }));
  // Prohibited: Client write to counters
  await assertFails(setDoc(doc(adminDb, "counters", "c1"), { seq: 999 }));
});

// 22. Fabricated AOR code on registration is rejected by rules
test("22. Abuse Test: Fabricated AOR code on registration fails authoritative batch match", async () => {
  const learnerDb = testEnv.authenticatedContext("anon_forger_aor").firestore();
  // Batch is t-online-am (NCR, AOR code 'T'). Attempting with forged AOR code 'B'
  await assertFails(
    runTransaction(learnerDb, async (transaction) => {
      const regId = "reg_forged_aor";
      const refNumber = "AIFAT-2026-B-9999";
      const dupKey = "dup_forged_aor";
      const now = new Date().toISOString();

      const batchRef = doc(learnerDb, "batches", "t-online-am");
      transaction.update(batchRef, {
        registeredCount: 1,
        lastRegistrationId: regId,
      });

      const dupRef = doc(learnerDb, "duplicates", dupKey);
      transaction.set(dupRef, {
        duplicateKey: dupKey,
        registrationId: regId,
        batchId: "t-online-am",
        userId: "anon_forger_aor",
        createdAt: now,
      });

      const learnerRef = doc(learnerDb, "learners", "learner_forged_aor");
      transaction.set(learnerRef, {
        learnerId: "learner_forged_aor",
        registrationId: regId,
        userId: "anon_forger_aor",
        fullName: "Test Learner",
        email: "test@example.invalid",
        createdAt: now,
      });

      const regRef = doc(learnerDb, "registrations", regId);
      transaction.set(regRef, {
        id: regId,
        referenceNumber: refNumber,
        learnerId: "learner_forged_aor",
        batchId: "t-online-am",
        aorCode: "B", // FORGERY: authoritative batch has "T"
        duplicateKey: dupKey,
        status: "CONFIRMED",
        trainingYear: 2026,
        createdAt: now,
        userId: "anon_forger_aor",
      });

      const verifRef = doc(learnerDb, "verifications", refNumber);
      transaction.set(verifRef, {
        referenceNumber: refNumber,
        batchId: "t-online-am",
        classDesignation: "AIFAT Class T01-2026",
        aorName: "NCR AOR",
        deliveryMode: "Online",
        session: "AM",
        trainingYear: 2026,
        status: "CONFIRMED",
        createdAt: now,
      });
    })
  );
});

// 23. Fabricated authoritative fields on verification record fail
test("23. Abuse Test: Fabricated fields on verification record fail authoritative batch match", async () => {
  const learnerDb = testEnv.authenticatedContext("anon_forger_verif").firestore();

  // Attempt A: Forged deliveryMode ("Face-to-Face" instead of "Online")
  await assertFails(
    setDoc(doc(learnerDb, "verifications", "AIFAT-2026-T-FRG1"), {
      referenceNumber: "AIFAT-2026-T-FRG1",
      batchId: "t-online-am",
      classDesignation: "AIFAT Class T01-2026",
      aorName: "NCR AOR",
      deliveryMode: "Face-to-Face", // FORGERY
      session: "AM",
      trainingYear: 2026,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
    })
  );

  // Attempt B: Forged trainingYear (2024 instead of 2026)
  await assertFails(
    setDoc(doc(learnerDb, "verifications", "AIFAT-2026-T-FRG2"), {
      referenceNumber: "AIFAT-2026-T-FRG2",
      batchId: "t-online-am",
      classDesignation: "AIFAT Class T01-2026",
      aorName: "NCR AOR",
      deliveryMode: "Online",
      session: "AM",
      trainingYear: 2024, // FORGERY
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
    })
  );

  // Attempt C: Forged status ("PENDING" instead of "CONFIRMED")
  await assertFails(
    setDoc(doc(learnerDb, "verifications", "AIFAT-2026-T-FRG3"), {
      referenceNumber: "AIFAT-2026-T-FRG3",
      batchId: "t-online-am",
      classDesignation: "AIFAT Class T01-2026",
      aorName: "NCR AOR",
      deliveryMode: "Online",
      session: "AM",
      trainingYear: 2026,
      status: "PENDING", // FORGERY
      createdAt: new Date().toISOString(),
    })
  );
});

// 24. Public verification record cannot expose learner initials, registrationId, or PII
test("24. Abuse Test: Verification record rejects documents containing initials or registration document IDs", async () => {
  const learnerDb = testEnv.authenticatedContext("anon_pii_probe").firestore();

  // Attempt to write verification record with initials
  await assertFails(
    setDoc(doc(learnerDb, "verifications", "AIFAT-2026-T-LEAK1"), {
      referenceNumber: "AIFAT-2026-T-LEAK1",
      batchId: "t-online-am",
      classDesignation: "AIFAT Class T01-2026",
      aorName: "NCR AOR",
      deliveryMode: "Online",
      session: "AM",
      trainingYear: 2026,
      status: "CONFIRMED",
      initials: "J. D.", // PROHIBITED KEY: Privacy minimization prohibits initials
      createdAt: new Date().toISOString(),
    })
  );

  // Attempt to write verification record with registrationId
  await assertFails(
    setDoc(doc(learnerDb, "verifications", "AIFAT-2026-T-LEAK2"), {
      referenceNumber: "AIFAT-2026-T-LEAK2",
      batchId: "t-online-am",
      classDesignation: "AIFAT Class T01-2026",
      aorName: "NCR AOR",
      deliveryMode: "Online",
      session: "AM",
      trainingYear: 2026,
      status: "CONFIRMED",
      registrationId: "reg_private_123", // PROHIBITED KEY: Privacy minimization prohibits reg ID
      createdAt: new Date().toISOString(),
    })
  );
});

