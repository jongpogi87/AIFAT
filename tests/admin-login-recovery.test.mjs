import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { before, after, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import {
  NEUTRAL_PASSWORD_RESET_MESSAGE,
  requestAdminPasswordReset,
  loginAdmin,
} from "../lib/admin/admin-service.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const rulesPath = new URL("../firestore.rules", import.meta.url);
const rulesContent = await readFile(rulesPath, "utf8");

const TEST_PROJECT_ID = "aifat-admin-recovery-test";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST
  ? process.env.FIRESTORE_EMULATOR_HOST.split(":")[0]
  : "127.0.0.1";
const EMULATOR_PORT = process.env.FIRESTORE_EMULATOR_HOST
  ? Number(process.env.FIRESTORE_EMULATOR_HOST.split(":")[1])
  : 8080;

let testEnv;
let vite;

before(async () => {
  vite = await createServer({
    appType: "custom",
    configFile: false,
    root,
    resolve: {
      alias: {
        "@": root,
        "next/navigation": path.resolve(root, "lib/router.tsx"),
        "next/link": path.resolve(root, "lib/router.tsx"),
      },
    },
    server: { middlewareMode: true },
  });

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
  if (vite) {
    await vite.close();
  }
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      // Super admin profile
      await setDoc(doc(db, "adminProfiles", "super_admin_1"), {
        email: "superadmin@example.invalid",
        role: "SUPER_ADMIN",
        enabled: true,
        displayName: "Super Admin",
      });
      // Ordinary admin profile
      await setDoc(doc(db, "adminProfiles", "admin_ordinary"), {
        email: "ordinaryadmin@example.invalid",
        role: "ADMIN",
        enabled: true,
        displayName: "Ordinary Admin",
      });
      // Disabled admin profile
      await setDoc(doc(db, "adminProfiles", "disabled_admin"), {
        email: "disabled@example.invalid",
        role: "ADMIN",
        enabled: false,
        displayName: "Disabled Admin",
      });
      // Closed batch
      await setDoc(doc(db, "batches", "t-online-am"), {
        batchId: "t-online-am",
        status: "CLOSED",
        enabled: true,
        capacity: 25,
      });
      // Global settings
      await setDoc(doc(db, "systemSettings", "global"), {
        registrationEnabled: false,
      });
    });
  }
});

// 1. Static UI and Markup tests
test("UI: /admin/login displays Administrative Email instead of username", async () => {
  const mod = await vite.ssrLoadModule("/app/admin/login/page.tsx");
  const AdminLoginPage = mod.default;
  const html = renderToStaticMarkup(React.createElement(AdminLoginPage));

  // Must contain Administrative Email
  assert.match(html, /Administrative Email/);
  // Must NOT contain Administrative Username
  assert.doesNotMatch(html, /Administrative Username/);
  // Must specify type="email"
  assert.match(html, /type="email"/);
  // Must specify email autocomplete
  assert.match(html, /autocomplete="email"/i);
  // Must specify placeholder "Enter administrative email"
  assert.match(html, /placeholder="Enter administrative email"/);
  // Must NOT have old placeholder
  assert.doesNotMatch(html, /placeholder="Enter username"/);
});

test("UI: /admin/login displays Forgot password? action and preserves TSS branding", async () => {
  const mod = await vite.ssrLoadModule("/app/admin/login/page.tsx");
  const AdminLoginPage = mod.default;
  const html = renderToStaticMarkup(React.createElement(AdminLoginPage));

  // Forgot password action present
  assert.match(html, /Forgot password\?/);

  // TSS / Signal Regiment visual design preserved
  assert.match(html, /The Signal School/);
  assert.match(html, /Signal Regiment, Philippine Army/);
  assert.match(html, /AIFAT Training Administration Portal/);
  assert.match(html, /Restricted Official Access/);
  assert.match(html, /Authenticate &amp; Enter|Authenticate & Enter/);
});

// 2. Client-side form & input validation tests
test("Validation: invalid email rejected for password reset", async () => {
  await assert.rejects(
    async () => {
      await requestAdminPasswordReset("");
    },
    { message: "Please enter a valid administrative email address." }
  );

  await assert.rejects(
    async () => {
      await requestAdminPasswordReset("invalid-email");
    },
    { message: "Please enter a valid administrative email address." }
  );

  await assert.rejects(
    async () => {
      await requestAdminPasswordReset("notanemail@");
    },
    { message: "Please enter a valid administrative email address." }
  );
});

test("Validation: email and password required for admin login", async () => {
  await assert.rejects(
    async () => {
      await loginAdmin("", "somepassword");
    },
    { message: "Administrative email is required." }
  );

  await assert.rejects(
    async () => {
      await loginAdmin("admin@example.invalid", "");
    },
    { message: "Password is required." }
  );
});

// 3. Password reset neutral message & anti-enumeration tests
test("Password Recovery: returns neutral success message without revealing account existence", async () => {
  // Even for non-existent emails, returns neutral success message
  const result = await requestAdminPasswordReset("nonexistent.user@example.invalid");
  assert.equal(result.success, true);
  assert.equal(
    result.message,
    "If this email is associated with an administrator account, password reset instructions have been sent."
  );
  assert.equal(result.message, NEUTRAL_PASSWORD_RESET_MESSAGE);
});

// 4. Security & authorization rules tests
test("Security: authenticated user without admin profile CANNOT access admin collections", async () => {
  // User authenticated as standard non-admin UID
  const nonAdminDb = testEnv.authenticatedContext("unauthorized_user_123").firestore();

  // Attempt to read adminProfiles
  await assertFails(getDoc(doc(nonAdminDb, "adminProfiles", "super_admin_1")));

  // Attempt to read learners
  await assertFails(getDoc(doc(nonAdminDb, "learners", "learner_123")));

  // Attempt to update batches
  await assertFails(
    updateDoc(doc(nonAdminDb, "batches", "t-online-am"), {
      capacity: 100,
    })
  );

  // Attempt to modify system settings
  await assertFails(
    updateDoc(doc(nonAdminDb, "systemSettings", "global"), {
      registrationEnabled: true,
    })
  );
});

test("Security: authenticated user with disabled admin profile CANNOT access admin collections", async () => {
  const disabledAdminDb = testEnv.authenticatedContext("disabled_admin").firestore();

  // Attempt to update batches
  await assertFails(
    updateDoc(doc(disabledAdminDb, "batches", "t-online-am"), {
      capacity: 50,
    })
  );

  // Attempt to modify system settings
  await assertFails(
    updateDoc(doc(disabledAdminDb, "systemSettings", "global"), {
      registrationEnabled: true,
    })
  );
});

test("Security: existing SUPER_ADMIN remains authorized for admin operations", async () => {
  const superAdminDb = testEnv.authenticatedContext("super_admin_1").firestore();

  // Permitted read on batches
  await assertSucceeds(getDoc(doc(superAdminDb, "batches", "t-online-am")));

  // Permitted update on batch capacity
  await assertSucceeds(
    updateDoc(doc(superAdminDb, "batches", "t-online-am"), {
      capacity: 35,
    })
  );

  // Prohibited: Client write to adminProfiles even as super_admin
  await assertFails(
    updateDoc(doc(superAdminDb, "adminProfiles", "super_admin_1"), {
      displayName: "Tampered Name",
    })
  );
});
