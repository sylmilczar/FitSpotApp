import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createReservation } from "@/lib/booking.handler";

function createSupabaseStub(result: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result);

  return {
    client: { rpc } as unknown as SupabaseClient,
    rpc,
  };
}

describe("createReservation", () => {
  it("returns success and passes the authenticated user and class identifiers to the RPC", async () => {
    const { client, rpc } = createSupabaseStub({ data: { ok: true }, error: null });

    await expect(createReservation(client, "user-id", "class-id")).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("create_reservation", {
      p_user_id: "user-id",
      p_class_id: "class-id",
    });
  });

  it.each(["CLASS_FULL", "ALREADY_RESERVED", "CLASS_STARTED", "CLASS_CANCELLED"] as const)(
    "maps the %s RPC error to a stable booking failure",
    async (code) => {
      const { client } = createSupabaseStub({ data: null, error: { message: `Reservation failed: ${code}` } });

      await expect(createReservation(client, "user-id", "class-id")).resolves.toEqual({
        ok: false,
        code,
        message: `Reservation failed: ${code}`,
      });
    },
  );

  it("matches guardrail codes case-insensitively", async () => {
    const { client } = createSupabaseStub({ data: null, error: { message: "class_full" } });

    await expect(createReservation(client, "user-id", "class-id")).resolves.toMatchObject({
      ok: false,
      code: "CLASS_FULL",
    });
  });

  it("maps an unknown RPC error to UNKNOWN without hiding its message", async () => {
    const { client } = createSupabaseStub({ data: null, error: { message: "Connection unavailable" } });

    await expect(createReservation(client, "user-id", "class-id")).resolves.toEqual({
      ok: false,
      code: "UNKNOWN",
      message: "Connection unavailable",
    });
  });

  it.each([{ ok: false }, {}, null])("rejects malformed success payload %#", async (data) => {
    const { client } = createSupabaseStub({ data, error: null });

    await expect(createReservation(client, "user-id", "class-id")).resolves.toEqual({
      ok: false,
      code: "UNKNOWN",
      message: "Unexpected create_reservation RPC result",
    });
  });
});
