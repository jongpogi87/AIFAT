import assert from "node:assert/strict";

const BASE_URL = "http://localhost:5173";

async function main() {
  console.log("=== VERIFYING AIFAT LOCAL DESKTOP PREVIEW ===");

  // 1. Landing Page Load
  console.log("\n1. Testing Landing Page (GET /)...");
  const homeRes = await fetch(`${BASE_URL}/`);
  assert.equal(homeRes.status, 200, `Landing page status should be 200, got ${homeRes.status}`);
  const homeHtml = await homeRes.text();
  assert.ok(homeHtml.includes("Artificial Intelligence Fundamentals"), "Page should contain AIFAT title");
  assert.ok(homeHtml.includes("The Signal School"), "Page should contain The Signal School");
  console.log("   ✓ Landing page loaded successfully (HTTP 200)");

  // 2. Batches and AOR Rules Verification
  console.log("\n2. Testing AOR and Batch Rules via in-memory repository...");
  const { BATCHES, isDeliveryModeAuthorized } = await import("../lib/batches.ts");

  // Confirm 1ID has Online AM and Online PM only
  const oneIdBatches = BATCHES.filter(b => b.aorCode === "A");
  console.log(`   1ID AOR Batches (${oneIdBatches.length}):`, oneIdBatches.map(b => `${b.deliveryMode} ${b.session}`).join(", "));
  assert.equal(oneIdBatches.length, 2);
  assert.ok(oneIdBatches.every(b => b.deliveryMode === "Online"));
  assert.equal(isDeliveryModeAuthorized("A", "Online"), true);
  assert.equal(isDeliveryModeAuthorized("A", "Face-to-Face"), false);
  console.log("   ✓ 1ID AOR: Online AM / Online PM only (Face-to-Face rejected)");

  // Confirm NCR has Online AM, Online PM, Face-to-Face AM, Face-to-Face PM
  const ncrBatches = BATCHES.filter(b => b.aorCode === "T");
  console.log(`   NCR AOR Batches (${ncrBatches.length}):`, ncrBatches.map(b => `${b.deliveryMode} ${b.session}`).join(", "));
  assert.equal(ncrBatches.length, 4);
  assert.ok(ncrBatches.some(b => b.deliveryMode === "Online" && b.session === "AM"));
  assert.ok(ncrBatches.some(b => b.deliveryMode === "Online" && b.session === "PM"));
  assert.ok(ncrBatches.some(b => b.deliveryMode === "Face-to-Face" && b.session === "AM"));
  assert.ok(ncrBatches.some(b => b.deliveryMode === "Face-to-Face" && b.session === "PM"));
  assert.equal(isDeliveryModeAuthorized("T", "Online"), true);
  assert.equal(isDeliveryModeAuthorized("T", "Face-to-Face"), true);
  console.log("   ✓ NCR AOR: Online AM / Online PM / Face-to-Face AM / Face-to-Face PM all authorized");

  // 3. Submit TEST Registration
  console.log("\n3. Testing Registration Submission (POST /api/register)...");
  const testLearner = {
    aor: "T",
    batchId: "t-online-am",
    lastName: "DELA CRUZ",
    firstName: "JUAN",
    middleName: "PROTACIO",
    extensionName: "",
    street: "123 KATIPUNAN AVE",
    barangay: "LOYOLA HEIGHTS",
    district: "3RD DISTRICT",
    cityMunicipality: "QUEZON CITY",
    province: "METRO MANILA",
    region: "NATIONAL CAPITAL REGION (NCR)",
    email: `juan.delacruz.${Date.now()}@example.invalid`,
    contactNumber: "09171234567",
    nationality: "Filipino",
    sex: "Male",
    civilStatus: "Single",
    employmentStatus: "Wage-Employed",
    employmentType: "Permanent",
    birthdate: "1995-06-15",
    age: 31,
    birthCity: "QUEZON CITY",
    birthProvince: "METRO MANILA",
    birthRegion: "NATIONAL CAPITAL REGION (NCR)",
    educationalAttainment: "College Graduate",
    parentGuardianName: "MARIA DELA CRUZ",
    parentGuardianAddress: "123 KATIPUNAN AVE, QUEZON CITY",
    learnerClassification: "Uniformed Personnel",
    courseQualification: "Artificial Intelligence Fundamentals and Applications In-House Training (AIFAT)",
    consent: true,
    applicantCertified: true,
  };

  const regRes = await fetch(`${BASE_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testLearner),
  });

  assert.equal(regRes.status, 201, `Registration should succeed with 201, got ${regRes.status}`);
  const regData = await regRes.json();
  console.log("   Registration response:", regData);
  const ref = regData.registration?.referenceNumber;
  assert.ok(ref, "Registration should return referenceNumber");
  assert.ok(ref.startsWith("AIFAT-2026-T-"), `Reference number should start with AIFAT-2026-T-, got ${ref}`);
  console.log(`   ✓ Registration submitted successfully! Assigned Reference Number: ${ref}`);

  // 4. Verify Registration Verification Page / Public Endpoint
  console.log(`\n4. Testing Confirmation / Verification (/api/verify/${ref})...`);
  const verifyRes = await fetch(`${BASE_URL}/api/verify/${ref}`);
  assert.equal(verifyRes.status, 200);
  const verifyData = await verifyRes.json();
  console.log("   Verification details:", {
    referenceNumber: verifyData.referenceNumber,
    registrationStatus: verifyData.registrationStatus,
    batch: verifyData.batch?.classDesignation,
    maskedLearner: verifyData.maskedLearnerName,
  });
  assert.equal(verifyData.registrationStatus, "CONFIRMED");
  console.log("   ✓ Confirmation & verification endpoint functional!");

  // 5. Test Admin Login with Dev Credentials
  console.log("\n5. Testing Local Admin Authentication (POST /api/admin/auth/login)...");
  const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "dev-admin-local" }),
  });

  assert.equal(loginRes.status, 200, `Login should return 200, got ${loginRes.status}`);
  const loginData = await loginRes.json();
  console.log("   Admin login response:", loginData);
  assert.ok(loginData.success, "Admin login should succeed");
  assert.equal(loginData.user.role, "SUPER_ADMIN");

  const setCookie = loginRes.headers.get("set-cookie");
  assert.ok(setCookie, "Login should return session cookie");
  const cookieMatch = setCookie.match(/aifat_admin_session=[^;]+/);
  assert.ok(cookieMatch, "Session cookie aifat_admin_session should be present");
  const sessionCookie = cookieMatch[0];
  console.log("   ✓ Local dev admin authenticated successfully as SUPER_ADMIN!");

  // 6. Test Admin Protected Dashboard Endpoints
  console.log("\n6. Testing Admin Protected Endpoints with Session Cookie...");

  // A. Admin Session Check
  const meRes = await fetch(`${BASE_URL}/api/admin/auth/me`, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.authenticated, true);
  console.log("   ✓ /api/admin/auth/me reports authenticated: true");

  // B. Admin Batches
  const adminBatchesRes = await fetch(`${BASE_URL}/api/admin/batches`, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(adminBatchesRes.status, 200);
  const adminBatchesData = await adminBatchesRes.json();
  assert.ok(Array.isArray(adminBatchesData.batches));
  const tBatch = adminBatchesData.batches.find(b => b.batchId === "t-online-am");
  console.log("   Enrolled count for t-online-am:", tBatch?.enrolled);
  assert.ok(tBatch?.enrolled >= 1, "Enrolled count in batch t-online-am should reflect registered learners");
  console.log(`   ✓ /api/admin/batches loaded ${adminBatchesData.batches.length} batches with enrolled counts!`);

  // C. Admin Learners
  const adminLearnersRes = await fetch(`${BASE_URL}/api/admin/learners`, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(adminLearnersRes.status, 200);
  const adminLearnersData = await adminLearnersRes.json();
  assert.ok(Array.isArray(adminLearnersData.learners));
  assert.ok(adminLearnersData.learners.some(l => l.referenceNumber === ref));
  console.log(`   ✓ /api/admin/learners loaded registrations, containing ${ref}!`);

  // 7. Verify Admin Page Load (GET /admin)
  console.log("\n7. Testing Admin Dashboard Page (GET /admin)...");
  const adminPageRes = await fetch(`${BASE_URL}/admin`, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(adminPageRes.status, 200);
  const adminPageHtml = await adminPageRes.text();
  assert.ok(adminPageHtml.includes("Training Administration") || adminPageHtml.includes("AIFAT") || adminPageHtml.includes("Dashboard") || adminPageHtml.includes("The Signal School"));
  console.log("   ✓ /admin dashboard page loaded successfully (HTTP 200)!");

  console.log("\n=== ALL LOCAL DESKTOP PREVIEW VERIFICATIONS PASSED ===");
}

main().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
