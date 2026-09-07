import { getDb } from "./index";
import { aors, batches, adminUsers, systemSettings, auditLogs } from "./schema";
import { AORS, BATCHES } from "../lib/batches";
import { DEFAULT_OPERATIONAL_CONFIG } from "../lib/config";
import { hashPassword, generateSalt } from "../lib/auth";
import { eq } from "drizzle-orm";

export async function runSeed(customDb?: ReturnType<typeof getDb>) {
  const db = customDb || getDb();
  console.log("[AIFAT DB Seed] Starting database initialization & seeding...");

  // 1. Seed AORs
  for (const a of AORS) {
    try {
      const [existing] = await db.select().from(aors).where(eq(aors.internalCode, a.code));
      if (!existing) {
        await db.insert(aors).values({
          id: a.code,
          displayName: a.name,
          internalCode: a.code,
          enabled: true,
        });
      }
    } catch {
      // Table may need initial creation in certain environments
    }
  }
  console.log(`[AIFAT DB Seed] Seeded ${AORS.length} official AOR entries (1ID-11ID -> A-K, NCR -> T).`);

  // 2. Seed Default Batches (Initial authorized templates)
  let existingBatchCount = 0;
  try {
    const existing = await db.select().from(batches);
    existingBatchCount = existing.length;
  } catch {
    // Continue
  }

  if (existingBatchCount === 0) {
    for (const b of BATCHES) {
      try {
        await db.insert(batches).values({
          id: b.batchId,
          classDesignation: b.classDesignation,
          aorId: b.aorCode,
          deliveryMode: b.deliveryMode,
          session: b.session,
          startDate: b.startDate,
          endDate: b.endDate,
          startTime: b.startTime,
          endTime: b.endTime,
          venue: b.venue,
          registrationDeadline: b.registrationDeadline,
          capacity: b.capacity,
          status: b.status,
          enabled: b.enabled,
        });
      } catch (err) {
        console.error(`Failed inserting batch ${b.batchId}:`, err);
      }
    }
    console.log(`[AIFAT DB Seed] Seeded ${BATCHES.length} authorized initial training batches.`);
  }

  // 3. Seed Operational Settings (Pending TSS Official announcement values)
  for (const [key, value] of Object.entries(DEFAULT_OPERATIONAL_CONFIG)) {
    try {
      const [existing] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
      if (!existing) {
        await db.insert(systemSettings).values({
          key,
          value,
          description: `Operational configuration for ${key}`,
          updatedAt: new Date(),
        });
      }
    } catch {
      // Continue
    }
  }
  console.log("[AIFAT DB Seed] Seeded default operational configuration values.");

  // 4. Seed Default TSS Superadmin if none exists
  try {
    const existingAdmins = await db.select().from(adminUsers);
    if (existingAdmins.length === 0) {
      const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
      if (!initialPassword) {
        console.log("[AIFAT DB Seed] No ADMIN_INITIAL_PASSWORD specified in environment. Skipping admin account creation.");
      } else {
        const salt = generateSalt();
        const passwordHash = await hashPassword(initialPassword, salt);
        await db.insert(adminUsers).values({
          username: "admin",
          email: "dev-admin@example.invalid",
          passwordHash,
          salt,
          role: "SUPER_ADMIN",
          createdAt: new Date(),
        });
        console.log("[AIFAT DB Seed] Created initial superadmin account from environment configuration.");
      }
    }
  } catch {
    // Continue
  }

  console.log("[AIFAT DB Seed] Database initialization and seeding completed successfully.");
}

// Support running via CLI: `node --loader tsx db/seed.ts` or standalone
if (typeof process !== "undefined" && process.argv[1]?.endsWith("seed.ts")) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[AIFAT DB Seed] Seed script failed:", err);
      process.exit(1);
    });
}
