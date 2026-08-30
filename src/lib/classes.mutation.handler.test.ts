import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClass, normalizeLocalDateTime, updateClass } from "@/lib/classes.mutation.handler";
import type { CreateClassInput, UpdateClassInput } from "@/types";

const CLASS_ID = "11111111-1111-1111-1111-111111111111";
const SERIES_CLASS_ID = "22222222-2222-2222-2222-222222222222";
const FUTURE_START = "2026-09-10T12:00";

function asSupabaseClient(from: ReturnType<typeof vi.fn>): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}

function createNoWriteClient() {
  const from = vi.fn();

  return { client: asSupabaseClient(from), from };
}

interface UpdateClientOptions {
  reservationsByClass?: Record<string, ("confirmed" | "cancelled")[]>;
  classRow?: { starts_at: string; class_series_id: string | null };
  seriesClasses?: { id: string; starts_at: string }[];
}

function createUpdateClient(options: UpdateClientOptions = {}) {
  const reservationsByClass = options.reservationsByClass ?? {};
  const classRow = options.classRow ?? {
    starts_at: new Date(FUTURE_START).toISOString(),
    class_series_id: null,
  };
  const seriesClasses = options.seriesClasses ?? [];
  const update = vi.fn((payload: unknown) => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
    in: vi.fn().mockResolvedValue({ error: null }),
    payload,
  }));
  const from = vi.fn((table: string) => {
    if (table === "reservations") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn((_column: string, classId: string) =>
            Promise.resolve({
              data: (reservationsByClass[classId] ?? []).map((status) => ({ class_id: classId, status })),
              error: null,
            }),
          ),
        })),
      };
    }

    return {
      select: vi.fn((columns: string) => ({
        eq: vi.fn(() => {
          if (columns === "starts_at, class_series_id") {
            return { single: vi.fn().mockResolvedValue({ data: classRow, error: null }) };
          }

          return {
            gte: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: seriesClasses, error: null }),
            })),
          };
        }),
      })),
      update,
    };
  });

  return { client: asSupabaseClient(from), from, update };
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
    const { client, update } = createUpdateClient({
      reservationsByClass: { [CLASS_ID]: ["confirmed", "confirmed", "cancelled"] },
    });

    await expect(updateClass(client, CLASS_ID, { ...validUpdateInput, capacity: 1 })).resolves.toMatchObject({
      ok: false,
      code: "CAPACITY_BELOW_RESERVATIONS",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a start-time change with confirmed reservations without writing", async () => {
    const { client, update } = createUpdateClient({
      reservationsByClass: { [CLASS_ID]: ["confirmed"] },
    });

    await expect(
      updateClass(client, CLASS_ID, { ...validUpdateInput, startsAt: "2026-09-10T13:00" }),
    ).resolves.toMatchObject({ ok: false, code: "STARTS_AT_LOCKED" });
    expect(update).not.toHaveBeenCalled();
  });

  it("allows an unchanged start time when reservations exist", async () => {
    const { client, update } = createUpdateClient({
      reservationsByClass: { [CLASS_ID]: ["confirmed"] },
    });

    await expect(updateClass(client, CLASS_ID, validUpdateInput)).resolves.toEqual({ ok: true });
    expect(update).toHaveBeenCalledOnce();
  });

  it("rejects applying a series update to a standalone class without writing", async () => {
    const { client, update } = createUpdateClient();

    await expect(updateClass(client, CLASS_ID, { ...validUpdateInput, applyToSeries: true })).resolves.toMatchObject({
      ok: false,
      code: "NOT_RECURRING",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a capacity conflict in any series member without writing", async () => {
    const { client, update } = createUpdateClient({
      classRow: {
        starts_at: new Date(FUTURE_START).toISOString(),
        class_series_id: "series-id",
      },
      seriesClasses: [
        { id: CLASS_ID, starts_at: new Date(FUTURE_START).toISOString() },
        { id: SERIES_CLASS_ID, starts_at: new Date("2026-09-17T12:00").toISOString() },
      ],
      reservationsByClass: {
        [CLASS_ID]: [],
        [SERIES_CLASS_ID]: ["confirmed", "confirmed", "confirmed"],
      },
    });

    await expect(
      updateClass(client, CLASS_ID, { ...validUpdateInput, capacity: 2, applyToSeries: true }),
    ).resolves.toMatchObject({ ok: false, code: "CAPACITY_BELOW_RESERVATIONS" });
    expect(update).not.toHaveBeenCalled();
  });
});
