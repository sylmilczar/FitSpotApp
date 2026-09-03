import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createAnonymousClient } from "./local-supabase";

export const fixtureUsers = {
  clientA: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    email: "contract-client-a@example.com",
    password: "contract-password-a",
    role: "client",
  },
  clientB: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email: "contract-client-b@example.com",
    password: "contract-password-b",
    role: "client",
  },
  manager: {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    email: "contract-manager@example.com",
    password: "contract-password-manager",
    role: "manager",
  },
  admin: {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    email: "contract-admin@example.com",
    password: "contract-password-admin",
    role: "admin",
  },
} as const;

export const fixtureClasses = {
  open: "11111111-1111-4111-8111-111111111111",
  full: "22222222-2222-4222-8222-222222222222",
  started: "33333333-3333-4333-8333-333333333333",
  cancelled: "44444444-4444-4444-8444-444444444444",
  seriesFirst: "55555555-5555-4555-8555-555555555555",
  seriesSecond: "66666666-6666-4666-8666-666666666666",
} as const;

export async function createFixtureUsers(): Promise<void> {
  const admin = createAdminClient();
  const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    throw new Error(`Could not list local users: ${listError.message}`);
  }

  for (const user of Object.values(fixtureUsers)) {
    if (!existingUsers.users.some((existingUser) => existingUser.email === user.email)) {
      const { error } = await admin.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (error) {
        throw new Error(`Could not create ${user.email}: ${error.message}`);
      }
    }

    const { error: roleError } = await admin.from("profiles").update({ role: user.role }).eq("user_id", user.id);
    if (roleError) {
      throw new Error(`Could not assign ${user.role} to ${user.email}: ${roleError.message}`);
    }
  }
}

export async function signInFixtureUser(
  user: (typeof fixtureUsers)[keyof typeof fixtureUsers],
): Promise<SupabaseClient> {
  const client = createAnonymousClient();
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });

  if (error) {
    throw new Error(`Could not sign in ${user.email}: ${error.message}`);
  }

  return client;
}

export async function resetDomainFixtures(): Promise<void> {
  const admin = createAdminClient();
  const { error: reservationsError } = await admin.from("reservations").delete().not("id", "is", null);
  if (reservationsError) {
    throw new Error(`Could not reset reservations: ${reservationsError.message}`);
  }

  const { error: classesError } = await admin.from("classes").delete().not("id", "is", null);
  if (classesError) {
    throw new Error(`Could not reset classes: ${classesError.message}`);
  }

  const { error: seriesError } = await admin.from("class_series").delete().not("id", "is", null);
  if (seriesError) {
    throw new Error(`Could not reset class series: ${seriesError.message}`);
  }

  const now = Date.now();
  const { error: insertError } = await admin.from("classes").insert([
    {
      id: fixtureClasses.open,
      name: "Contract Open Class",
      capacity: 2,
      starts_at: new Date(now + 86_400_000).toISOString(),
      status: "scheduled",
    },
    {
      id: fixtureClasses.full,
      name: "Contract Full Class",
      capacity: 1,
      starts_at: new Date(now + 172_800_000).toISOString(),
      status: "scheduled",
    },
    {
      id: fixtureClasses.started,
      name: "Contract Started Class",
      capacity: 2,
      starts_at: new Date(now - 3_600_000).toISOString(),
      status: "scheduled",
    },
    {
      id: fixtureClasses.cancelled,
      name: "Contract Cancelled Class",
      capacity: 2,
      starts_at: new Date(now + 259_200_000).toISOString(),
      status: "cancelled",
    },
  ]);

  if (insertError) {
    throw new Error(`Could not reset classes: ${insertError.message}`);
  }
}

export async function countReservations(classId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId);

  if (error) {
    throw new Error(`Could not count reservations: ${error.message}`);
  }

  return count ?? 0;
}
