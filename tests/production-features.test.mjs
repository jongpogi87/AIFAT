import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  hashPassword,
  verifyPassword,
  generateSalt,
  createSessionToken,
  verifySessionToken,
} from "../lib/auth.ts";
import { isDeliveryModeAuthorized, AORS, BATCHES } from "../lib/batches.ts";
import { generateReferenceNumber } from "../lib/reference.ts";
import { DEFAULT_OPERATIONAL_CONFIG } from "../lib/config.ts";
import {
  calculateAge,
  TESDA_EDUCATIONAL_ATTAINMENTS,
  TESDA_CIVIL_STATUSES,
  TESDA_EMPLOYMENT_STATUSES,
  TESDA_EMPLOYMENT_TYPES,
  TESDA_LEARNER_CLASSIFICATIONS,
  TESDA_SCHOLARSHIP_PACKAGES,
  DEFAULT_COURSE_QUALIFICATION,
} from "../lib/tesda.ts";

test("Admin Auth: password hashing, salt uniqueness, and verification", async () => {
  const salt1 = generateSalt();
  const salt2 = generateSalt();
  assert.notEqual(salt1, salt2);

  const password = "EphemeralTestPassword-Alpha-99!";
  const hash1 = await hashPassword(password, salt1);
  const hash2 = await hashPassword(password, salt2);

  // Different salts must yield different hashes
  assert.notEqual(hash1, hash2);

  // Correct password verification
  assert.equal(await verifyPassword(password, hash1, salt1), true);
  // Incorrect password verification must fail
  assert.equal(await verifyPassword("EphemeralTestPassword-Beta-00!", hash1, salt1), false);
  // Wrong salt must fail
  assert.equal(await verifyPassword(password, hash1, salt2), false);
});

test("Admin Auth: HMAC-signed session token creation, verification, and tamper resistance", async () => {
  const payload = {
    userId: 1,
    username: "admin",
    email: "dev-admin@example.invalid",
    role: "SUPER_ADMIN",
  };

  const token = await createSessionToken(payload, 3600);
  assert.ok(token.includes("."));

  // Valid session retrieval
  const session = await verifySessionToken(token);
  assert.ok(session);
  assert.equal(session.username, "admin");
  assert.equal(session.role, "SUPER_ADMIN");

  // Tampered payload must fail
  const [payloadPart, sigPart] = token.split(".");
  const tamperedPayload = Buffer.from(JSON.stringify({ ...payload, role: "HACKER" })).toString("base64url");
  const tamperedToken = `${tamperedPayload}.${sigPart}`;
  const tamperedSession = await verifySessionToken(tamperedToken);
  assert.equal(tamperedSession, null);

  // Expired session must fail
  const expiredToken = await createSessionToken(payload, -10);
  const expiredSession = await verifySessionToken(expiredToken);
  assert.equal(expiredSession, null);
});

test("Institutional Rules: 1ID through 11ID are strictly Online-only; NCR authorizes F2F and Online", () => {
  const regionalCodes = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];

  for (const code of regionalCodes) {
    // Online mode must be authorized
    assert.equal(isDeliveryModeAuthorized(code, "Online"), true, `${code} must allow Online`);
    // Face-to-Face must be strictly unauthorized
    assert.equal(isDeliveryModeAuthorized(code, "Face-to-Face"), false, `${code} must NOT allow Face-to-Face`);
  }

  // NCR (T) must allow BOTH Online and Face-to-Face
  assert.equal(isDeliveryModeAuthorized("T", "Online"), true);
  assert.equal(isDeliveryModeAuthorized("T", "Face-to-Face"), true);
});

test("Batch Catalog Consistency: no Face-to-Face batches exist for non-NCR AORs", () => {
  for (const b of BATCHES) {
    if (b.deliveryMode === "Face-to-Face") {
      assert.equal(b.aorCode, "T", `Batch ${b.batchId} has Face-to-Face but is not NCR AOR!`);
    }
  }
});

test("Reference Number Generation: format adherence, sequence padding, and uniqueness", () => {
  // Test sequential generation
  const ref1 = generateReferenceNumber({ aorCode: "A", year: 2026, sequenceNumber: 1 });
  assert.equal(ref1, "AIFAT-2026-A-0001");

  const ref42 = generateReferenceNumber({ aorCode: "T", year: 2026, sequenceNumber: 42 });
  assert.equal(ref42, "AIFAT-2026-T-0042");

  // Collision safety: 200 sequential calls must be 100% unique
  const refs = new Set();
  for (let i = 1; i <= 200; i++) {
    const r = generateReferenceNumber({ aorCode: "E", year: 2026, sequenceNumber: i });
    assert.equal(refs.has(r), false, `Duplicate reference number detected: ${r}`);
    refs.add(r);
  }
  assert.equal(refs.size, 200);
});

test("Operational Configuration: preserves pending placeholders and no fake contacts", () => {
  assert.match(DEFAULT_OPERATIONAL_CONFIG.contactNumber, /Pending Official TSS Announcement/);
  assert.match(DEFAULT_OPERATIONAL_CONFIG.emailAddress, /Pending Official TSS Announcement/);
  assert.match(DEFAULT_OPERATIONAL_CONFIG.officeName, /The Signal School/);
  assert.ok(DEFAULT_OPERATIONAL_CONFIG.dataRetentionPolicy.length > 20);
});

test("TESDA MIS 03-01: calculateAge independently computes correct age from birthdate", () => {
  const refDate = new Date("2026-09-07T00:00:00Z");

  // Birthday has passed this year
  const age1 = calculateAge("1995-05-15", refDate);
  assert.equal(age1, 31);

  // Birthday is later this year
  const age2 = calculateAge("1995-12-25", refDate);
  assert.equal(age2, 30);

  // Birthday is today
  const age3 = calculateAge("2000-09-07", refDate);
  assert.equal(age3, 26);

  // Invalid date returns null
  assert.equal(calculateAge("invalid-date", refDate), null);
  assert.equal(calculateAge("", refDate), null);
});

test("TESDA MIS 03-01: Profile options align with official form enumerations", () => {
  // 13 Educational Attainment tiers
  assert.equal(TESDA_EDUCATIONAL_ATTAINMENTS.length, 13);
  assert.ok(TESDA_EDUCATIONAL_ATTAINMENTS.includes("College Graduate"));
  assert.ok(TESDA_EDUCATIONAL_ATTAINMENTS.includes("Junior High (K-12)"));

  // 5 Civil Status options
  assert.equal(TESDA_CIVIL_STATUSES.length, 5);
  assert.ok(TESDA_CIVIL_STATUSES.includes("Single"));
  assert.ok(TESDA_CIVIL_STATUSES.includes("Married"));

  // 4 Employment Status options
  assert.equal(TESDA_EMPLOYMENT_STATUSES.length, 4);
  assert.ok(TESDA_EMPLOYMENT_STATUSES.includes("Wage-Employed"));
  assert.ok(TESDA_EMPLOYMENT_STATUSES.includes("Underemployed"));

  // 8 Employment Types
  assert.equal(TESDA_EMPLOYMENT_TYPES.length, 8);
  assert.ok(TESDA_EMPLOYMENT_TYPES.includes("Permanent"));
  assert.ok(TESDA_EMPLOYMENT_TYPES.includes("Job Order"));

  // 24 Learner Classifications (23 official categories + Others)
  assert.equal(TESDA_LEARNER_CLASSIFICATIONS.length, 24);
  assert.ok(TESDA_LEARNER_CLASSIFICATIONS.includes("Industry Workers"));
  assert.ok(TESDA_LEARNER_CLASSIFICATIONS.includes("Uniformed Personnel"));
  assert.ok(TESDA_LEARNER_CLASSIFICATIONS.includes("Others (Please Specify)"));

  // Scholarship Packages
  assert.ok(TESDA_SCHOLARSHIP_PACKAGES.includes("TWSP"));
  assert.ok(TESDA_SCHOLARSHIP_PACKAGES.includes("PESFA"));

  // Default course
  assert.equal(
    DEFAULT_COURSE_QUALIFICATION,
    "Artificial Intelligence Fundamentals and Applications In-House Training (AIFAT)"
  );
});

test("Public Learner Portal: official form title and MIS 03-01 ver 2021 compliance", async () => {
  const pageSrc = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  // Official form title
  assert.match(pageSrc, /Registration Form — Learner(?:'|&apos;)s Profile/);
  assert.match(pageSrc, /Technical Education and Skills Development Authority \(TESDA MIS 03-01, ver\. 2021\)/);

  // Submit button label
  assert.match(pageSrc, /Submit Registration/);

  // Section navigation anchors
  assert.match(pageSrc, /sec-learner-profile/);
  assert.match(pageSrc, /sec-personal-info/);
  assert.match(pageSrc, /sec-classification/);
  assert.match(pageSrc, /sec-scholarship/);
  assert.match(pageSrc, /sec-consent/);
});

test("Public Learner Portal: neutral address placeholders with no location-specific examples", async () => {
  const pageSrc = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  // Prohibited specific place placeholders
  assert.doesNotMatch(pageSrc, /placeholder="[^"]*Kalayaan/i);
  assert.doesNotMatch(pageSrc, /placeholder="[^"]*Fort Bonifacio/i);
  assert.doesNotMatch(pageSrc, /placeholder="[^"]*Taguig City/i);
  assert.doesNotMatch(pageSrc, /placeholder="[^"]*Metro Manila/i);
  assert.doesNotMatch(pageSrc, /placeholder="[^"]*NCR/i);

  // Expected neutral placeholders
  assert.match(pageSrc, /placeholder="House\/Building No\., Street"/);
  assert.match(pageSrc, /placeholder="Enter barangay"/);
  assert.match(pageSrc, /placeholder="Enter city or municipality"/);
  assert.match(pageSrc, /placeholder="Enter province"/);
  assert.match(pageSrc, /placeholder="Enter or select region"/);
});

test("Public Learner Portal: consent and certification defaults and validation", async () => {
  const pageSrc = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const apiSrc = await readFile(new URL("../app/api/register/route.ts", import.meta.url), "utf8");

  // In page.tsx: emptyDraft consent is null (neither Agree nor Disagree selected)
  assert.match(pageSrc, /consent:\s*null/);
  // applicantCertified is false by default
  assert.match(pageSrc, /applicantCertified:\s*false/);

  // In page.tsx: Disagree explanatory warning box
  assert.match(pageSrc, /Consent Required for Registration/);
  assert.match(pageSrc, /cannot be processed or registered without the necessary consent/);

  // In route.ts: exact required rejection string for missing/declined consent
  assert.match(apiSrc, /The required personal information cannot be processed without the necessary privacy consent\./);

  // In route.ts: certification check
  assert.match(apiSrc, /You must certify that the information provided is true and correct\./);
});

test("Public Learner Portal: privacy notice and certification text compliance", async () => {
  const pageSrc = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  // Controlled wording for TESDA certification opportunity
  assert.match(pageSrc, /TESDA certification opportunity, subject to applicable requirements/);
  assert.doesNotMatch(pageSrc, /guarantee TESDA certification/i);

  // Applicant certification text
  assert.match(pageSrc, /Registration Form - Learner(?:'|&apos;)s Profile \(TESDA MIS 03-01\)/);
});

test("Public Learner Portal: configuration-driven footer and Administration Portal link", async () => {
  const pageSrc = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  // Footer uses DEFAULT_OPERATIONAL_CONFIG
  assert.match(pageSrc, /DEFAULT_OPERATIONAL_CONFIG\.officeName/);
  assert.match(pageSrc, /DEFAULT_OPERATIONAL_CONFIG\.officeAddress/);

  // Link renamed to Administration Portal
  assert.match(pageSrc, /Administration Portal/);
  assert.doesNotMatch(pageSrc, />\s*Staff Portal\s*</);
});
