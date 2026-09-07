import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const config = await readFile(new URL("../lib/batches.ts", import.meta.url), "utf8");
const api = await readFile(new URL("../app/api/register/route.ts", import.meta.url), "utf8");

test("public copy uses the approved provider wording", () => {
  assert.match(page, /In collaboration with a TESDA-accredited training provider\./);
  assert.doesNotMatch(page, /BrandBoss/i);
  assert.doesNotMatch(page, /Signal School is TESDA accredited/i);
});

test("uses learner-facing AOR names and internal A through K plus T mapping", () => {
  for (let n=1;n<=11;n++) assert.match(config, new RegExp(`name:"${n}ID AOR"`));
  assert.match(config, /name:"NCR AOR",code:"T"/);
});

test("face-to-face batches are generated only for internal NCR code T", () => {
  assert.match(config, /code==="T"/);
  assert.match(api, /batch\.aorCode !== aor/);
});

test("server validates contact, status, deadline, capacity, and duplicates", () => {
  for (const term of ["contact number","not open","registration deadline","already full","UNIQUE constraint"]) {
    assert.match(api, new RegExp(term,"i"));
  }
});
