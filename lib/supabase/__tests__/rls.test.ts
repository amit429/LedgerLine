import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../admin";

/**
 * Proves RLS fails closed, not just that policies exist. Requires a live
 * Supabase project — set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * and SUPABASE_SERVICE_ROLE_KEY (e.g. via `.env.local`, loaded with
 * `npx dotenv -e .env.local -- npm test`) to run it. Skipped otherwise so
 * `npm test` stays green with no credentials configured.
 */
const hasSupabaseCreds =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!hasSupabaseCreds)("Row Level Security", () => {
  const suffix = Date.now();
  const userAEmail = `rls-test-a-${suffix}@example.com`;
  const userBEmail = `rls-test-b-${suffix}@example.com`;
  const password = "rls-test-password-please-ignore";

  // Created lazily inside beforeAll (not at describe-body scope) so this
  // module never throws on import when Supabase env vars are unset — the
  // describe.skipIf above also skips beforeAll/afterAll, but only if
  // nothing at the describe body's top level runs eagerly first.
  let admin: ReturnType<typeof createAdminClient>;
  let userAId: string;
  let userBId: string;
  let batchId: string;

  beforeAll(async () => {
    admin = createAdminClient();
    const { data: userA, error: errA } = await admin.auth.admin.createUser({
      email: userAEmail,
      password,
      email_confirm: true,
    });
    if (errA || !userA.user) throw errA ?? new Error("failed to create user A");
    userAId = userA.user.id;

    const { data: userB, error: errB } = await admin.auth.admin.createUser({
      email: userBEmail,
      password,
      email_confirm: true,
    });
    if (errB || !userB.user) throw errB ?? new Error("failed to create user B");
    userBId = userB.user.id;

    const { data: batch, error: batchError } = await admin
      .from("import_batches")
      .insert({
        user_id: userAId,
        label: "rls-test",
        orders_filename: "orders.csv",
        payments_filename: "payments.csv",
      })
      .select("id")
      .single();
    if (batchError || !batch) throw batchError ?? new Error("failed to seed batch");
    batchId = batch.id;
  });

  afterAll(async () => {
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });

  it("blocks a signed-in user from reading another user's batch", async () => {
    const asUserB = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error: signInError } = await asUserB.auth.signInWithPassword({
      email: userBEmail,
      password,
    });
    expect(signInError).toBeNull();

    const { data, error } = await asUserB
      .from("import_batches")
      .select("id")
      .eq("id", batchId);

    // RLS makes the row invisible rather than raising an error — the read
    // succeeds but returns nothing, which is the fail-closed behavior we
    // want (an error would leak that the row exists at all).
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("lets the owning user read their own batch", async () => {
    const asUserA = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error: signInError } = await asUserA.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    expect(signInError).toBeNull();

    const { data, error } = await asUserA
      .from("import_batches")
      .select("id")
      .eq("id", batchId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
