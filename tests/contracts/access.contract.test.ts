import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { callContractRpc, createAdminClient } from "./support/local-supabase";
import { fixtureClasses, fixtureUsers, resetDomainFixtures, signInFixtureUser } from "./support/fixtures";

describe("authorization contracts", () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let manager: SupabaseClient;

  beforeAll(async () => {
    [clientA, clientB, manager] = await Promise.all([
      signInFixtureUser(fixtureUsers.clientA),
      signInFixtureUser(fixtureUsers.clientB),
      signInFixtureUser(fixtureUsers.manager),
    ]);
  });

  beforeEach(async () => {
    await resetDomainFixtures();
  });

  it("lets a client observe only their own reservations while a manager sees all", async () => {
    const admin = createAdminClient();
    const { error: insertError } = await admin.from("reservations").insert([
      { class_id: fixtureClasses.open, user_id: fixtureUsers.clientA.id, status: "confirmed" },
      { class_id: fixtureClasses.open, user_id: fixtureUsers.clientB.id, status: "confirmed" },
    ]);
    expect(insertError).toBeNull();

    const [{ data: rowsA }, { data: rowsB }, { data: managerRows }] = await Promise.all([
      clientA.from("reservations").select("user_id"),
      clientB.from("reservations").select("user_id"),
      manager.from("reservations").select("user_id"),
    ]);

    expect(rowsA).toEqual([{ user_id: fixtureUsers.clientA.id }]);
    expect(rowsB).toEqual([{ user_id: fixtureUsers.clientB.id }]);
    expect(managerRows).toHaveLength(2);
  });

  it("prevents a client from updating a class", async () => {
    const { data, error } = await clientA
      .from("classes")
      .update({ name: "Client write" })
      .eq("id", fixtureClasses.open)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: storedClass } = await createAdminClient()
      .from("classes")
      .select("name")
      .eq("id", fixtureClasses.open)
      .single();
    expect(storedClass?.name).toBe("Contract Open Class");
  });

  it("rejects a client calling the manager update RPC", async () => {
    const { data: currentClass } = await createAdminClient()
      .from("classes")
      .select("starts_at")
      .eq("id", fixtureClasses.open)
      .single<{ starts_at: string }>();

    const { error } = await callContractRpc(clientA, "update_manager_class", {
      p_class_id: fixtureClasses.open,
      p_name: "Forbidden update",
      p_description: null,
      p_capacity: 2,
      p_starts_at: currentClass?.starts_at ?? "",
      p_apply_to_series: false,
    });

    expect(error?.message).toContain("FORBIDDEN");
  });

  it("allows a manager to perform a safe direct class update", async () => {
    const { data, error } = await manager
      .from("classes")
      .update({ name: "Manager update" })
      .eq("id", fixtureClasses.open)
      .select("name")
      .single();

    expect(error).toBeNull();
    expect(data?.name).toBe("Manager update");
  });
});
