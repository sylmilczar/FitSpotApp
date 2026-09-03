import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClass, normalizeLocalDateTime, updateClass } from "@/lib/classes.mutation.handler";
import type { CreateClassInput, UpdateClassInput } from "@/types";

const CLASS_ID = "11111111-1111-1111-1111-111111111111";
const FUTURE_START = "2026-09-10T12:00";

function asSupabaseClient(from: ReturnType<typeof vi.fn>): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}

function createNoWriteClient() {
  const from = vi.fn();

  return { client: asSupabaseClient(from), from };
}

function createUpdateClient(
  result: { data: unknown; error: { message: string } | null } = { data: { ok: true }, error: null },
) {
  const rpc = vi.fn().mockResolvedValue(result);

  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

const validCreateInput: CreateClassInput = {
  name: "Mobility",
  description: "A focused session",
  capacity: 12,
  startsAt: FUTURE_START,
};

const validUpdateInput: UpdateClassInput = {
  name: "Mobility",
  description: "A focused session",
  capacity: 12,
  startsAt: FUTURE_START,
};

describe("normalizeLocalDateTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["2026-08-31", "31/08/2026 12:00", "", "not-a-date"])(
    "rejects malformed local date-time value %j",
    (value) => {
      expect(normalizeLocalDateTime(value)).toMatchObject({ ok: false, code: "INVALID_FORMAT" });
    },
  );

  it("rejects an impossible calendar date", () => {
    expect(normalizeLocalDateTime("2026-02-30T12:00")).toMatchObject({ ok: false, code: "INVALID_FORMAT" });
  });

  it("rejects an exact-now value", () => {
    expect(normalizeLocalDateTime("2026-08-30T10:00")).toMatchObject({ ok: false, code: "PAST_DATE" });
  });

  it("rejects a past value", () => {
    expect(normalizeLocalDateTime("2026-08-30T09:59")).toMatchObject({ ok: false, code: "PAST_DATE" });
  });

  it("trims and converts a valid future local value to UTC", () => {
    const value = "2026-08-31T12:30";

    expect(normalizeLocalDateTime(`  ${value}  `)).toEqual({
      ok: true,
      startsAtUtc: new Date(value).toISOString(),
    });
  });
});

describe("createClass validation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["blank name", { ...validCreateInput, name: "   " }],
    ["long name", { ...validCreateInput, name: "x".repeat(121) }],
    ["long description", { ...validCreateInput, description: "x".repeat(2001) }],
    ["zero capacity", { ...validCreateInput, capacity: 0 }],
    ["fractional capacity", { ...validCreateInput, capacity: 1.5 }],
    ["not-a-number capacity", { ...validCreateInput, capacity: Number.NaN }],
  ])("rejects %s before persistence", async (_caseName, input) => {
    const { client, from } = createNoWriteClient();

    await expect(createClass(client, input)).resolves.toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    ["missing end date", undefined, "REPEAT_UNTIL_REQUIRED"],
    ["invalid end date", "10/09/2026", "REPEAT_UNTIL_INVALID"],
    ["end before start", "2026-09-01", "REPEAT_UNTIL_BEFORE_START"],
    ["more than 104 occurrences", "2028-09-10", "TOO_MANY_OCCURRENCES"],
  ])("rejects recurring setup with %s before persistence", async (_caseName, repeatUntil, code) => {
    const { client, from } = createNoWriteClient();

    await expect(createClass(client, { ...validCreateInput, isRecurring: true, repeatUntil })).resolves.toMatchObject({
      ok: false,
      code,
    });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("updateClass guardrails", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects capacity below confirmed reservations without writing", async () => {
    const { client } = createUpdateClient({
      data: null,
      error: { message: "CAPACITY_BELOW_RESERVATIONS" },
    });

    await expect(updateClass(client, CLASS_ID, { ...validUpdateInput, capacity: 1 })).resolves.toMatchObject({
      ok: false,
      code: "CAPACITY_BELOW_RESERVATIONS",
    });
  });

  it("rejects a start-time change with confirmed reservations without writing", async () => {
    const { client } = createUpdateClient({
      data: null,
      error: { message: "STARTS_AT_LOCKED" },
    });

    await expect(
      updateClass(client, CLASS_ID, { ...validUpdateInput, startsAt: "2026-09-10T13:00" }),
    ).resolves.toMatchObject({ ok: false, code: "STARTS_AT_LOCKED" });
  });

  it("allows an unchanged start time when reservations exist", async () => {
    const { client, rpc } = createUpdateClient();

    await expect(updateClass(client, CLASS_ID, validUpdateInput)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("update_manager_class", {
      p_class_id: CLASS_ID,
      p_name: validUpdateInput.name,
      p_description: validUpdateInput.description,
      p_capacity: validUpdateInput.capacity,
      p_starts_at: new Date(FUTURE_START).toISOString(),
      p_apply_to_series: false,
    });
  });

  it("rejects applying a series update to a standalone class without writing", async () => {
    const { client } = createUpdateClient({ data: null, error: { message: "NOT_RECURRING" } });

    await expect(updateClass(client, CLASS_ID, { ...validUpdateInput, applyToSeries: true })).resolves.toMatchObject({
      ok: false,
      code: "NOT_RECURRING",
    });
  });

  it("rejects a capacity conflict in any series member without writing", async () => {
    const { client } = createUpdateClient({
      data: null,
      error: { message: "CAPACITY_BELOW_RESERVATIONS" },
    });

    await expect(
      updateClass(client, CLASS_ID, { ...validUpdateInput, capacity: 2, applyToSeries: true }),
    ).resolves.toMatchObject({ ok: false, code: "CAPACITY_BELOW_RESERVATIONS" });
  });
});
