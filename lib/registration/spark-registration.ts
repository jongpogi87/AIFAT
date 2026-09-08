import {
  doc,
  runTransaction,
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { clientAuth, clientDb } from "../firebase/client.ts";
import { generateReferenceNumber } from "../reference.ts";
import { calculateAge, DEFAULT_COURSE_QUALIFICATION } from "../tesda.ts";
import type { Batch } from "../batches.ts";

export interface LearnerDraft {
  // 1. Learner Profile
  lastName: string;
  firstName: string;
  middleName: string;
  extensionName: string;
  street: string;
  barangay: string;
  district: string;
  cityMunicipality: string;
  province: string;
  region: string;
  email: string;
  contactNumber: string;
  nationality: string;

  // 2. Personal Information
  sex: string;
  civilStatus: string;
  birthdate: string;
  birthCity: string;
  birthProvince: string;
  birthRegion: string;

  // 3. Employment Before Training
  employmentStatus: string;
  employmentType: string;

  // 4. Educational Attainment
  educationalAttainment: string;

  // 5. Parent / Guardian (optional)
  parentGuardianName: string;
  parentGuardianAddress: string;

  // 6. Learner Classification
  learnerClassification: string;
  classificationOthers: string;

  // 8. Scholarship Information
  isScholar: boolean;
  scholarshipPackage: string;
  scholarshipPackageOthers: string;

  // 9. Privacy Consent & Certification
  consent: boolean | null;
  applicantCertified: boolean;
}

export interface RegistrationResult {
  referenceNumber: string;
  fullName: string;
  email: string;
  contactNumber: string;
  aor: string;
  batchId: string;
  classDesignation: string;
  deliveryMode: string;
  session: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  courseQualification: string;
  registrationStatus: string;
}

/**
 * Universal browser / node SHA-256 hex digest generator.
 */
export async function sha256Hex(message: string): Promise<string> {
  const normalized = message.trim().toLowerCase();
  if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
    const msgBuffer = new TextEncoder().encode(normalized);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback for Node.js test environments
  try {
    const { createHash } = await import("crypto");
    return createHash("sha256").update(normalized).digest("hex");
  } catch (err) {
    throw new Error("SHA-256 digest is unavailable in this environment.");
  }
}

/**
 * Generates learner initials to minimize public exposure in verification records.
 */
export function toInitials(fullName: string): string {
  const parts = fullName
    .replace(/[^a-zA-Z\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "L. N.";
  return parts.map((p) => p[0].toUpperCase() + ".").join(" ");
}

/**
 * Generates a standard UUID v4.
 */
function generateUuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return "id_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Executes a client-direct Spark registration transaction.
 *
 * Enforces:
 * - Anonymous Authentication
 * - Phase 9B Reciprocal Atomic Invariants
 * - Write-Once Duplicate Lock (zero client reads of /duplicates)
 * - Complete TESDA MIS 03-01 Learner Profile storage in protected /learners
 * - Public verification record creation with minimal non-sensitive data in /verifications
 */
export async function registerLearnerSpark(input: {
  batch: Batch;
  draft: LearnerDraft;
}): Promise<RegistrationResult> {
  const { batch, draft } = input;

  // 1. Ensure Anonymous Authentication
  let currentUser = clientAuth.currentUser;
  if (!currentUser) {
    const cred = await signInAnonymously(clientAuth);
    currentUser = cred.user;
  }
  const authUid = currentUser.uid;

  // 2. Prepare Identifiers & Hashes
  const now = new Date().toISOString();
  const year = 2026;
  const learnerId = `learner_${generateUuid()}`;
  const registrationId = `reg_${generateUuid()}`;
  const referenceNumber = generateReferenceNumber({
    aorCode: batch.aorCode,
    year,
  });

  const normalizedEmail = draft.email.trim().toLowerCase();
  const dupKey = await sha256Hex(`${batch.batchId.trim().toLowerCase()}:${normalizedEmail}`);

  const fullName = `${draft.firstName.trim()} ${draft.middleName ? draft.middleName.trim() + " " : ""}${draft.lastName.trim()}${draft.extensionName ? " " + draft.extensionName.trim() : ""}`.trim();
  const initials = toInitials(fullName);
  const calculatedAge = calculateAge(draft.birthdate) ?? 18;

  try {
    const result = await runTransaction(clientDb, async (transaction) => {
      // Step A: Read authoritative batch document
      const batchRef = doc(clientDb, "batches", batch.batchId);
      const batchSnap = await transaction.get(batchRef);

      if (!batchSnap.exists()) {
        throw new Error("The selected training class was not found.");
      }

      const batchData = batchSnap.data();

      // Verify availability
      if (!batchData.enabled) {
        throw new Error("This training batch is currently unavailable.");
      }

      if (batchData.status === "CLOSED" || !["OPEN", "NEARLY FULL"].includes(batchData.status)) {
        throw new Error("Registration for this batch is closed.");
      }

      if (batchData.registrationDeadline && Date.now() > Date.parse(batchData.registrationDeadline)) {
        throw new Error("The registration period for this batch has ended.");
      }

      const currentCount = Number(batchData.registeredCount) || 0;
      const capacity = Number(batchData.capacity) || 25;

      if (currentCount >= capacity) {
        throw new Error("This batch is already full. Please select another available batch.");
      }

      const newCount = currentCount + 1;
      const isFull = newCount >= capacity;

      // Step B: Batch seat allocation
      transaction.update(batchRef, {
        registeredCount: newCount,
        lastRegistrationId: registrationId,
        ...(isFull ? { status: "FULL" } : {}),
      });

      // Step C: Write-Once Duplicate Lock (NO client getDoc)
      // If doc exists, evaluated as update, blocked by security rule
      const dupRef = doc(clientDb, "duplicates", dupKey);
      transaction.set(dupRef, {
        duplicateKey: dupKey,
        registrationId,
        batchId: batch.batchId,
        userId: authUid,
        createdAt: now,
      });

      // Step D: Protected TESDA MIS 03-01 Learner Profile (Protected)
      const learnerRef = doc(clientDb, "learners", learnerId);
      transaction.set(learnerRef, {
        learnerId,
        registrationId,
        userId: authUid,
        fullName,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        middleName: draft.middleName.trim() || "",
        extensionName: draft.extensionName.trim() || "",
        email: normalizedEmail,
        contactNumber: draft.contactNumber.trim(),
        mobileNumber: draft.contactNumber.trim(),
        street: draft.street.trim(),
        barangay: draft.barangay.trim(),
        district: draft.district.trim() || "",
        cityMunicipality: draft.cityMunicipality.trim(),
        province: draft.province.trim(),
        region: draft.region.trim(),
        address: `${draft.street.trim()}, ${draft.barangay.trim()}, ${draft.cityMunicipality.trim()}, ${draft.province.trim()}`,
        nationality: draft.nationality.trim() || "Filipino",
        sex: draft.sex,
        civilStatus: draft.civilStatus,
        birthdate: draft.birthdate,
        age: calculatedAge,
        birthCity: draft.birthCity.trim(),
        birthProvince: draft.birthProvince.trim(),
        birthRegion: draft.birthRegion.trim(),
        employmentStatus: draft.employmentStatus,
        employmentType: draft.employmentType || "None",
        educationalAttainment: draft.educationalAttainment,
        parentGuardianName: draft.parentGuardianName.trim() || "",
        parentGuardianAddress: draft.parentGuardianAddress.trim() || "",
        learnerClassification: draft.learnerClassification,
        classificationOthers: draft.classificationOthers.trim() || "",
        isScholar: draft.isScholar || false,
        scholarshipPackage: draft.scholarshipPackage || "",
        scholarshipPackageOthers: draft.scholarshipPackageOthers.trim() || "",
        consent: draft.consent === true,
        applicantCertified: draft.applicantCertified === true,
        courseQualification: DEFAULT_COURSE_QUALIFICATION,
        createdAt: now,
      });

      // Step E: Private Registration Record (Protected)
      const regRef = doc(clientDb, "registrations", registrationId);
      transaction.set(regRef, {
        id: registrationId,
        referenceNumber,
        learnerId,
        batchId: batch.batchId,
        aorCode: batch.aorCode,
        duplicateKey: dupKey,
        status: "CONFIRMED",
        trainingYear: 2026,
        createdAt: now,
        userId: authUid,
      });

      // Step F: Public Verification Record (Minimal Non-Sensitive Data Only - NO PII, NO Initials, NO Registration ID)
      const verifRef = doc(clientDb, "verifications", referenceNumber);
      transaction.set(verifRef, {
        referenceNumber,
        batchId: batch.batchId,
        classDesignation: batchData.classDesignation || batch.classDesignation,
        aorName: batchData.aorName || batch.aorName,
        deliveryMode: batchData.deliveryMode || batch.deliveryMode,
        session: batchData.session || batch.session,
        trainingYear: 2026,
        status: "CONFIRMED",
        createdAt: now,
      });

      return {
        referenceNumber,
        fullName,
        email: normalizedEmail,
        contactNumber: draft.contactNumber.trim(),
        aor: batch.aorName,
        batchId: batch.batchId,
        classDesignation: batchData.classDesignation || batch.classDesignation,
        deliveryMode: batchData.deliveryMode || batch.deliveryMode,
        session: batchData.session || batch.session,
        startDate: batch.startDate,
        endDate: batch.endDate,
        startTime: batch.startTime,
        endTime: batch.endTime,
        venue: batch.venue,
        courseQualification: DEFAULT_COURSE_QUALIFICATION,
        registrationStatus: "CONFIRMED",
      };
    });

    return result;
  } catch (err: any) {
    console.error("spark_registration_error", err);
    // Map Firestore rule permission errors to institutional user feedback
    const msg = String(err?.message || err);
    if (msg.includes("PERMISSION_DENIED") || msg.includes("permission-denied")) {
      // In Phase 9B: permission-denied during set on duplicates indicates duplicate registration
      throw new Error(
        "You have already registered for this batch. Multiple registrations for the same training batch are strictly prohibited."
      );
    }
    throw err;
  }
}
