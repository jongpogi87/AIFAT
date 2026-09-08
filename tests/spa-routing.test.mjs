import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { matchRoute } from "../lib/router-match.ts";

const routes = [
  { pattern: "/", name: "Home" },
  { pattern: "/admin", name: "AdminDashboard" },
  { pattern: "/admin/login", name: "AdminLogin" },
  { pattern: "/admin/batches", name: "AdminBatches" },
  { pattern: "/admin/learners", name: "AdminLearners" },
  { pattern: "/admin/reports", name: "AdminReports" },
  { pattern: "/admin/settings", name: "AdminSettings" },
  { pattern: "/verify/:ref", name: "Verify" },
  { pattern: "/verify/:reference", name: "VerifyRef" },
];

test("Router: matches root path /", () => {
  const result = matchRoute("/", "/");
  assert.equal(result.match, true);
  assert.deepEqual(result.params, {});
});

test("Router: matches /admin/login", () => {
  const result = matchRoute("/admin/login", "/admin/login");
  assert.equal(result.match, true);
});

test("Router: matches /admin", () => {
  const result = matchRoute("/admin", "/admin");
  assert.equal(result.match, true);
});

test("Router: matches /admin/batches", () => {
  const result = matchRoute("/admin/batches", "/admin/batches");
  assert.equal(result.match, true);
});

test("Router: matches /admin/learners", () => {
  const result = matchRoute("/admin/learners", "/admin/learners");
  assert.equal(result.match, true);
});

test("Router: matches /admin/reports", () => {
  const result = matchRoute("/admin/reports", "/admin/reports");
  assert.equal(result.match, true);
});

test("Router: matches /admin/settings", () => {
  const result = matchRoute("/admin/settings", "/admin/settings");
  assert.equal(result.match, true);
});

test("Router: matches /verify/:ref and extracts reference number param", () => {
  const result = matchRoute("/verify/:ref", "/verify/AIFAT-2026-T-7K2M");
  assert.equal(result.match, true);
  assert.equal(result.params.ref, "AIFAT-2026-T-7K2M");
});

test("Router: does not false-match unmatched routes", () => {
  assert.equal(matchRoute("/admin", "/admin/login").match, false);
  assert.equal(matchRoute("/admin/batches", "/admin").match, false);
  assert.equal(matchRoute("/", "/verify/123").match, false);
});

test("Static Build Verification: dist/index.html exists and is valid HTML", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /The Signal School/);
  assert.match(html, /<script type="module"/);
});

test("Firebase Hosting Config: rewrites all routes to /index.html for SPA", async () => {
  const raw = await readFile(new URL("../firebase.json", import.meta.url), "utf8");
  const config = JSON.parse(raw);
  assert.equal(config.hosting.public, "dist");
  assert.deepEqual(config.hosting.rewrites, [
    {
      source: "**",
      destination: "/index.html",
    },
  ]);
});
