import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const registrations = sqliteTable("registrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  referenceNumber: text("reference_number").notNull(),
  fullName: text("full_name").notNull(), rank: text("rank").notNull(), unit: text("unit").notNull(),
  email: text("email").notNull(), contactNumber: text("contact_number").notNull(),
  serviceCategory: text("service_category").notNull(), aor: text("aor").notNull(), batchId: text("batch_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [uniqueIndex("registrations_reference_number_unique").on(table.referenceNumber), uniqueIndex("registrations_email_batch_unique").on(table.email, table.batchId)]);
