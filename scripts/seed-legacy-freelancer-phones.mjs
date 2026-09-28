/** Seed legacy freelancer phone numbers into current profiles.
 * Default is dry-run. Writes require --live; production also requires
 * --confirm-prod. Matching is legacy email -> Clerk user ID -> profile.clerkId.
 *
 * Examples:
 *   node scripts/seed-legacy-freelancer-phones.mjs --env=dev
 *   node scripts/seed-legacy-freelancer-phones.mjs --env=prod
 *   node scripts/seed-legacy-freelancer-phones.mjs --env=prod --live --confirm-prod
 *   node scripts/seed-legacy-freelancer-phones.mjs --env=prod --live --confirm-prod --overwrite
 */
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { createClerkClient } from "@clerk/backend";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const args = new Set(process.argv.slice(2));
const envArg = process.argv.find((arg) => arg.startsWith("--env="));
const environment = envArg?.split("=", 2)[1] ?? "dev";
const live = args.has("--live");
const overwrite = args.has("--overwrite");
if (!["dev", "prod"].includes(environment)) throw new Error("--env must be dev or prod");
if (environment === "prod" && live && !args.has("--confirm-prod")) throw new Error("Production writes require --confirm-prod");

function env(name) {
  return process.env[`${name}_${environment.toUpperCase()}`] ?? process.env[name];
}
const legacyUri = env("MONGODB_URI_LEGACY");
const currentUri = env("MONGODB_URI");
const clerkKey = env("CLERK_SECRET_KEY");
if (!legacyUri) throw new Error("Missing MONGODB_URI_LEGACY or environment-specific variant");
if (!currentUri) throw new Error("Missing MONGODB_URI or environment-specific variant");
if (!clerkKey) throw new Error("Missing CLERK_SECRET_KEY or environment-specific variant");

const legacyDbName = env("LEGACY_DB_NAME") ?? new URL(legacyUri).pathname.slice(1);
const currentDbName = env("CURRENT_DB_NAME") ?? new URL(currentUri).pathname.slice(1);
if (!legacyDbName || !currentDbName) throw new Error("Set LEGACY_DB_NAME and CURRENT_DB_NAME");

const normalizeEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits.length > 10 ? digits.slice(-10) : "";
}

async function run() {
  console.log(`Legacy freelancer phone seed: ${environment} / ${live ? "LIVE" : "DRY RUN"}`);
  if (!live) console.log("No writes will be made. Add --live after reviewing the report.");
  const legacyClient = new MongoClient(legacyUri);
  const currentClient = new MongoClient(currentUri);
  const clerk = createClerkClient({ secretKey: clerkKey });
  try {
    await Promise.all([legacyClient.connect(), currentClient.connect()]);
    const legacy = legacyClient.db(legacyDbName).collection("freelancers");
    const users = currentClient.db(currentDbName).collection("users");
    const profiles = currentClient.db(currentDbName).collection("profiles");
    // Build the map from current Mongo users, then resolve each known Clerk ID.
    // This mirrors /admin/users and avoids relying on Clerk's emailAddress
    // filter, which may not return users for this Clerk instance.
    const currentCandidates = await users
      .find({ role: "teacher_candidate" }, { projection: { clerkId: 1 } })
      .toArray();
    const clerkIdByEmail = new Map();
    for (const currentUser of currentCandidates) {
      try {
        const clerkUser = await clerk.users.getUser(currentUser.clerkId);
        const primary = clerkUser.emailAddresses.find(
          (entry) => entry.id === clerkUser.primaryEmailAddressId,
        );
        const email = normalizeEmail(
          primary?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress,
        );
        if (email) clerkIdByEmail.set(email, clerkUser.id);
      } catch (error) {
        console.warn(`[WARN] Could not load Clerk user ${currentUser.clerkId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log(`Current candidate users indexed by email: ${clerkIdByEmail.size}`);
    const counts = { scanned: 0, updated: 0, alreadySet: 0, noEmail: 0, noPhone: 0, noClerk: 0, noProfile: 0, failed: 0 };
    for await (const freelancer of legacy.find({}).sort({ _id: 1 })) {
      counts.scanned++;
      const email = normalizeEmail(freelancer.email);
      const phone = normalizePhone(freelancer.phone ?? freelancer.phoneNumber ?? freelancer.whatsappNumber);
      if (!email) { counts.noEmail++; console.log(`[SKIP] legacy record has no email`); continue; }
      if (!phone) { counts.noPhone++; console.log(`[SKIP] ${email}: no valid phone`); continue; }
      try {
        const clerkId = clerkIdByEmail.get(email);
        if (!clerkId) { counts.noClerk++; console.log(`[SKIP] ${email}: no current candidate Clerk user`); continue; }
        const profile = await profiles.findOne({ clerkId }, { projection: { phone: 1 } });
        if (!profile) { counts.noProfile++; console.log(`[SKIP] ${email}: no profile for ${clerkId}`); continue; }
        if (profile.phone && !overwrite) { counts.alreadySet++; console.log(`[KEEP] ${email}: phone already set`); continue; }
        if (live) await profiles.updateOne({ clerkId }, { $set: { phone } });
        counts.updated++;
        console.log(`[${live ? "UPDATE" : "DRY RUN"}] ${email} -> ${clerkId}: ${phone}`);
      } catch (error) {
        counts.failed++;
        console.error(`[FAIL] ${email}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log("Summary:", counts);
  } finally {
    await Promise.allSettled([legacyClient.close(), currentClient.close()]);
  }
}
run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
