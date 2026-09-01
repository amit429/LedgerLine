/**
 * Creates the reviewer demo account shown on the sign-in screen. Run once
 * per Supabase project:
 *
 *   npx tsx scripts/seed-demo-user.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set
 * (e.g. in .env.local, loaded via `npx dotenv -e .env.local -- npx tsx
 * scripts/seed-demo-user.ts`).
 */
import { createAdminClient } from "../lib/supabase/admin";

const DEMO_EMAIL = "reviewer@ledgerline.app";
const DEMO_PASSWORD = "sample-run-2025";

async function main() {
  const admin = createAdminClient();

  const { data: existing } = await admin.auth.admin.listUsers();
  const alreadyExists = existing?.users.some((u) => u.email === DEMO_EMAIL);

  if (alreadyExists) {
    console.log(`Demo user ${DEMO_EMAIL} already exists — nothing to do.`);
    return;
  }

  const { error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });

  if (error) {
    throw error;
  }

  console.log(`Created demo user ${DEMO_EMAIL}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
