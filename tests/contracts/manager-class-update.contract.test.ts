import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { callContractRpc, createAdminClient } from "./support/local-supabase";
import { fixtureClasses, fixtureUsers, resetDomainFixtures, signInFixtureUser } from "./support/fixtures";

const SERIES_ID = "77777777-7777-4777-8777-777777777777";

describe("update_manager_class contract", () => {
  let manager: SupabaseClient;
  let adminUser: SupabaseClient;

  beforeAll(async () => {
    [manager, adminUser] = await Promise.all([
      signInFixtureUser(fixtureUsers.manager),
      signInFixtureUser(fixtureUsers.admin),
    ]);
  });

  beforeEach(async () => {
    await resetDomainFixtures();
  });

  async function currentStart(classId: string): Promise<string> {
    const { data, error } = await createAdminClient().from("classes").select("starts_at").eq("id", classId).single();
    if (error) throw new Error(error.message);
    return data.starts_at as string;
  }

  async function updateClass(
    client: SupabaseClient,
    classId: string,
    overrides: Partial<{
      name: string;
      description: string | null;
      capacity: number;
      startsAt: string;
      applyToSeries: boolean;
    }> = {},
  ) {
    return callContractRpc(client, "update_manager_class", {
      p_class_id: classId,
      p_name: overrides.name ?? "Updated class",
      p_description: overrides.description ?? null,
      p_capacity: overrides.capacity ?? 2,
      p_starts_at: overrides.startsAt ?? (await currentStart(classId)),
      p_apply_to_series: overrides.applyToSeries ?? false,
    });
  }

  async function insertConfirmedReservations(classId: string): Promise<void> {
    const { error } = await createAdminClient()
      .from("reservations")
      .insert([
        { class_id: classId, user_id: fixtureUsers.clientA.id, status: "confirmed" },
        { class_id: classId, user_id: fixtureUsers.clientB.id, status: "confirmed" },
      ]);
    if (error) throw new Error(error.message);
  }

  async function createSeries(): Promise<void> {
    const admin = createAdminClient();
    const firstStart = new Date(Date.now() + 86_400_000).toISOString();
    const secondStart = new Date(Date.now() + 691_200_000).toISOString();
    const { error: seriesError } = await admin.from("class_series").insert({
      id: SERIES_ID,
      name: "Contract Series",
      capacity: 2,
      starts_from: firstStart,
      repeat_until: secondStart.slice(0, 10),
    });
    if (seriesError) throw new Error(seriesError.message);

    const { error: classesError } = await admin.from("classes").insert([
      {
        id: fixtureClasses.seriesFirst,
        class_series_id: SERIES_ID,
        name: "Series First",
        capacity: 2,
        starts_at: firstStart,
        status: "scheduled",
      },
      {
        id: fixtureClasses.seriesSecond,
        class_series_id: SERIES_ID,
        name: "Series Second",
        capacity: 2,
        starts_at: secondStart,
        status: "scheduled",
      },
    ]);
    if (classesError) throw new Error(classesError.message);
  }

  it("allows manager and admin identities to persist safe single updates", async () => {
    const managerResult = await updateClass(manager, fixtureClasses.open, { name: "Manager-safe" });
    expect(managerResult.error).toBeNull();

    const adminResult = await updateClass(adminUser, fixtureClasses.full, { name: "Admin-safe", capacity: 1 });
    expect(adminResult.error).toBeNull();

    const { data } = await createAdminClient()
      .from("classes")
      .select("id, name")
      .in("id", [fixtureClasses.open, fixtureClasses.full]);
    expect(data).toEqual(
      expect.arrayContaining([
        { id: fixtureClasses.open, name: "Manager-safe" },
        { id: fixtureClasses.full, name: "Admin-safe" },
      ]),
    );
  });

  it("rejects unsafe capacity and time changes without mutating the class", async () => {
    await insertConfirmedReservations(fixtureClasses.open);
    const originalStart = await currentStart(fixtureClasses.open);

    const capacityResult = await updateClass(manager, fixtureClasses.open, { capacity: 1 });
    expect(capacityResult.error?.message).toContain("CAPACITY_BELOW_RESERVATIONS");

    const timeResult = await updateClass(manager, fixtureClasses.open, {
      startsAt: new Date(Date.now() + 172_800_000).toISOString(),
    });
    expect(timeResult.error?.message).toContain("STARTS_AT_LOCKED");

    const { data } = await createAdminClient()
      .from("classes")
      .select("capacity, starts_at")
      .eq("id", fixtureClasses.open)
      .single();
    expect(data).toEqual({ capacity: 2, starts_at: originalStart });
  });

  it("blocks unsafe direct table updates", async () => {
    await insertConfirmedReservations(fixtureClasses.open);

    const { error: capacityError } = await manager
      .from("classes")
      .update({ capacity: 1 })
      .eq("id", fixtureClasses.open);
    expect(capacityError?.message).toContain("CAPACITY_BELOW_RESERVATIONS");

    const { error: timeError } = await manager
      .from("classes")
      .update({ starts_at: new Date(Date.now() + 172_800_000).toISOString() })
      .eq("id", fixtureClasses.open);
    expect(timeError?.message).toContain("STARTS_AT_LOCKED");
  });

  it("updates all following series classes atomically when safe", async () => {
    await createSeries();

    const result = await updateClass(manager, fixtureClasses.seriesFirst, {
      name: "Updated series",
      capacity: 3,
      applyToSeries: true,
    });
    expect(result.error).toBeNull();

    const { data } = await createAdminClient()
      .from("classes")
      .select("name, capacity")
      .eq("class_series_id", SERIES_ID);
    expect(data).toEqual([
      { name: "Updated series", capacity: 3 },
      { name: "Updated series", capacity: 3 },
    ]);
  });

  it("rolls back the full series update when any member conflicts", async () => {
    await createSeries();
    await insertConfirmedReservations(fixtureClasses.seriesSecond);

    const result = await updateClass(manager, fixtureClasses.seriesFirst, {
      name: "Must not persist",
      capacity: 1,
      applyToSeries: true,
    });
    expect(result.error?.message).toContain("CAPACITY_BELOW_RESERVATIONS");

    const { data } = await createAdminClient()
      .from("classes")
      .select("id, name, capacity")
      .eq("class_series_id", SERIES_ID)
      .order("starts_at");
    expect(data).toEqual([
      { id: fixtureClasses.seriesFirst, name: "Series First", capacity: 2 },
      { id: fixtureClasses.seriesSecond, name: "Series Second", capacity: 2 },
    ]);
  });
});
