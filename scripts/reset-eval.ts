/**
 * Put the eval licence and the eval brand's credits back as seeded (demo/judges), e.g. after a wiring
 * check or before an eval run. Only the eval brand and its licence; never the judge accounts.
 *
 *   pnpm reset:eval
 */
import { existsSync } from "node:fs";
import { resetEvalLicence } from "@/lib/server/demo";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

resetEvalLicence().then(
  (r) => console.log(`eval licence: renders ${r.renders} → 0; eval brand credits ${r.credits} → ${r.restoredCredits}`),
  (e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
