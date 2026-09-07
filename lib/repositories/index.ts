import {
  FirestoreBatchRepository,
  FirestoreRegistrationRepository,
  FirestoreSettingsRepository,
  FirestoreAuditRepository,
} from "./firestore";
import {
  LegacyD1BatchRepository,
  LegacyD1RegistrationRepository,
  LegacyD1SettingsRepository,
  LegacyD1AuditRepository,
} from "./legacy-d1";
import {
  MemoryBatchRepository,
  MemoryRegistrationRepository,
  MemorySettingsRepository,
  MemoryAuditRepository,
} from "./memory";
import type {
  BatchRepository,
  RegistrationRepository,
  SettingsRepository,
  AuditRepository,
} from "./types";

export * from "./types";

let activeBatchRepo: BatchRepository | null = null;
let activeRegistrationRepo: RegistrationRepository | null = null;
let activeSettingsRepo: SettingsRepository | null = null;
let activeAuditRepo: AuditRepository | null = null;

export function getBatchRepository(): BatchRepository {
  if (!activeBatchRepo) {
    const backend = (process.env.DATA_BACKEND || (process.env.NODE_ENV === "production" ? "firestore" : "memory")).toLowerCase();
    if (backend === "legacy-d1") {
      activeBatchRepo = new LegacyD1BatchRepository();
    } else if (backend === "memory") {
      activeBatchRepo = new MemoryBatchRepository();
    } else {
      activeBatchRepo = new FirestoreBatchRepository();
    }
  }
  return activeBatchRepo;
}

export function getRegistrationRepository(): RegistrationRepository {
  if (!activeRegistrationRepo) {
    const backend = (process.env.DATA_BACKEND || (process.env.NODE_ENV === "production" ? "firestore" : "memory")).toLowerCase();
    if (backend === "legacy-d1") {
      activeRegistrationRepo = new LegacyD1RegistrationRepository();
    } else if (backend === "memory") {
      const batchRepo = getBatchRepository() as MemoryBatchRepository;
      activeRegistrationRepo = new MemoryRegistrationRepository(batchRepo);
    } else {
      activeRegistrationRepo = new FirestoreRegistrationRepository();
    }
  }
  return activeRegistrationRepo;
}

export function getSettingsRepository(): SettingsRepository {
  if (!activeSettingsRepo) {
    const backend = (process.env.DATA_BACKEND || (process.env.NODE_ENV === "production" ? "firestore" : "memory")).toLowerCase();
    if (backend === "legacy-d1") {
      activeSettingsRepo = new LegacyD1SettingsRepository();
    } else if (backend === "memory") {
      activeSettingsRepo = new MemorySettingsRepository();
    } else {
      activeSettingsRepo = new FirestoreSettingsRepository();
    }
  }
  return activeSettingsRepo;
}

export function getAuditRepository(): AuditRepository {
  if (!activeAuditRepo) {
    const backend = (process.env.DATA_BACKEND || (process.env.NODE_ENV === "production" ? "firestore" : "memory")).toLowerCase();
    if (backend === "legacy-d1") {
      activeAuditRepo = new LegacyD1AuditRepository();
    } else if (backend === "memory") {
      activeAuditRepo = new MemoryAuditRepository();
    } else {
      activeAuditRepo = new FirestoreAuditRepository();
    }
  }
  return activeAuditRepo;
}

/**
 * Allows overriding repositories in tests (e.g. injecting isolated memory instances)
 */
export function setRepositories(repos: {
  batchRepo?: BatchRepository | null;
  registrationRepo?: RegistrationRepository | null;
  settingsRepo?: SettingsRepository | null;
  auditRepo?: AuditRepository | null;
}) {
  if (repos.batchRepo !== undefined) activeBatchRepo = repos.batchRepo;
  if (repos.registrationRepo !== undefined) activeRegistrationRepo = repos.registrationRepo;
  if (repos.settingsRepo !== undefined) activeSettingsRepo = repos.settingsRepo;
  if (repos.auditRepo !== undefined) activeAuditRepo = repos.auditRepo;
}
