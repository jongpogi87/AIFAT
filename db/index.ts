import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let cfEnv: any = null;
try {
  const mod = "cloudflare:workers";
  // @ts-ignore
  const workers = await import(/* @vite-ignore */ mod);
  cfEnv = workers.env;
} catch {
  // Not in Cloudflare Workers environment (e.g. Node.js local dev or test suite)
}

export function getDb() {
  const env = cfEnv;
  if (!env?.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
