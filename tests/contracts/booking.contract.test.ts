import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { callContractRpc, createAdminClient, createAnonymousClient } from "./support/local-supabase";
import {
  countReservations,
  fixtureClasses,
  fixtureUsers,
  resetDomainFixtures,
  signInFixtureUser,
} from "./support/fixtures";

describe("create_reservation contract", () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;

  beforeAll(async () => {
    [clientA, clientB] = await Promise.all([
      signInFixtureUser(fixtureUsers.clientA),
      signInFixtureUser(fixtureUsers.clientB),
    ]);
  });

  beforeEach(async () => {
    await resetDomainFixtures();
  });

  it("creates exactly one confirmed reservation for an eligible class", async () => {
    const { data, error } = await callContractRpc(clientA, "create_reservation", {
      p_user_id: fixtureUsers.clientA.id,
      p_class_id: fixtureClasses.open,
    });

    expect(error).toBeNull();
    expect(data).toEqual({ ok: true });
    await expect(countReservations(fixtureClasses.open)).resolves.toBe(1);
  });

  it("rejects a duplicate without creating a second row", async () => {
    await callContractRpc(clientA, "create_reservation", {
      p_user_id: fixtureUsers.clientA.id,
      p_class_id: fixtureClasses.open,
    });

    const { error } = await callContractRpc(clientA, "create_reservation", {
      p_user_id: fixtureUsers.clientA.id,
      p_class_id: fixtureClasses.open,
    });

    expect(error?.message).toContain("ALREADY_RESERVED");
    await expect(countReservations(fixtureClasses.open)).resolves.toBe(1);
  });

  it("rejects a full class without creating another row", async () => {
    await callContractRpc(clientB, "create_reservation", {
      p_user_id: fixtureUsers.clientB.id,
      p_class_id: fixtureClasses.full,
    });

    const { error } = await callContractRpc(clientA, "create_reservation", {
      p_user_id: fixtureUsers.clientA.id,
      p_class_id: fixtureClasses.full,
    });

    expect(error?.message).toContain("CLASS_FULL");
    await expect(countReservations(fixtureClasses.full)).resolves.toBe(1);
  });

  it.each([
    ["started", fixtureClasses.started, "CLASS_STARTED"],
    ["cancelled", fixtureClasses.cancelled, "CLASS_CANCELLED"],
  ])("rejects a %s class without persistence", async (_state, classId, code) => {
    const { error } = await callContractRpc(clientA, "create_reservation", {
      p_user_id: fixtureUsers.clientA.id,
      p_class_id: classId,
    });

    expect(error?.message).toContain(code);
    await expect(countReservations(classId)).resolves.toBe(0);
  });

  it("rejects anonymous execution without persistence", async () => {
    const { error } = await callContractRpc(createAnonymousClient(), "create_reservation", {
      p_user_id: fixtureUsers.clientA.id,
      p_class_id: fixtureClasses.open,
    });

    expect(error).not.toBeNull();
    await expect(countReservations(fixtureClasses.open)).resolves.toBe(0);
  });

  it("rejects a mismatched reservation owner without persistence", async () => {
    const { error } = await callContractRpc(clientA, "create_reservation", {
      p_user_id: fixtureUsers.clientB.id,
      p_class_id: fixtureClasses.open,
    });

    expect(error?.message).toContain("FORBIDDEN");
    await expect(countReservations(fixtureClasses.open)).resolves.toBe(0);
  });

  it("allows only one winner when two users race for the final spot", async () => {
    const admin = createAdminClient();
    const { error: capacityError } = await admin.from("classes").update({ capacity: 1 }).eq("id", fixtureClasses.open);
    expect(capacityError).toBeNull();

    const results = await Promise.all([
      callContractRpc(clientA, "create_reservation", {
        p_user_id: fixtureUsers.clientA.id,
        p_class_id: fixtureClasses.open,
      }),
      callContractRpc(clientB, "create_reservation", {
        p_user_id: fixtureUsers.clientB.id,
        p_class_id: fixtureClasses.open,
      }),
    ]);

    expect(results.filter(({ error }) => error === null)).toHaveLength(1);
    expect(results.filter(({ error }) => error?.message.includes("CLASS_FULL"))).toHaveLength(1);
    await expect(countReservations(fixtureClasses.open)).resolves.toBe(1);
  });
});
