import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ClassAttendeeItem, ClassMutationResult, ClassStatus, CreateClassInput, UpdateClassInput } from "@/types";

const classPayloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  capacity: z.number().int().min(1),
  startsAt: z.string().min(1),
});

const uuidLikeRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(uuidLikeRegex);

interface DateNormalizationSuccess {
  ok: true;
  startsAtUtc: string;
}

interface DateNormalizationFailure {
  ok: false;
  code: "INVALID_FORMAT" | "PAST_DATE";
  message: string;
}

export type DateNormalizationResult = DateNormalizationSuccess | DateNormalizationFailure;

interface RecurringSeriesSuccess {
  ok: true;
  startsAtUtcList: string[];
}

interface RecurringSeriesFailure {
  ok: false;
  code:
    | "INVALID_FORMAT"
    | "REPEAT_UNTIL_REQUIRED"
    | "REPEAT_UNTIL_INVALID"
    | "REPEAT_UNTIL_BEFORE_START"
    | "TOO_MANY_OCCURRENCES";
  message: string;
}

type RecurringSeriesResult = RecurringSeriesSuccess | RecurringSeriesFailure;

export interface ManagerClassItem {
  id: string;
  seriesId: string | null;
  name: string;
  description: string | null;
  capacity: number;
  startsAt: string;
  status: ClassStatus;
  confirmedReservationsCount: number;
  reservationCount: number;
  isSeriesSummary?: boolean;
  seriesWeekdayLabel?: string;
  seriesTimeLabel?: string;
  seriesRangeLabel?: string;
  seriesOccurrencesCount?: number;
  hasFutureOccurrences?: boolean;
  seriesNextClassLabel?: string;
  seriesNextConfirmedLabel?: string;
}

interface ClassRow {
  id: string;
  class_series_id: string | null;
  name: string;
  description: string | null;
  capacity: number;
  starts_at: string;
  status: ClassStatus;
}

interface ClassStartsAtRow {
  class_series_id: string | null;
  starts_at: string;
}

interface ClassSeriesMemberRow {
  id: string;
  starts_at: string;
}

const MAX_RECURRING_OCCURRENCES = 104;

interface ReservationCountRow {
  class_id: string;
  status: "confirmed" | "cancelled";
}

interface AttendeeRow {
  reservation_id: string;
  user_id: string;
  user_email: string;
  status: "confirmed" | "cancelled";
  created_at: string;
}

const attendeeRowSchema = z.object({
  reservation_id: z.string(),
  user_id: z.string(),
  user_email: z.string(),
  status: z.enum(["confirmed", "cancelled"]),
  created_at: z.string(),
});

const attendeeRpcResponseSchema = z.object({
  data: z.unknown(),
  error: z.object({ message: z.string() }).nullable(),
});

const managerUpdateRpcResponseSchema = z.object({
  data: z.unknown(),
  error: z.object({ message: z.string() }).nullable(),
});

const managerUpdateCodes = [
  "CAPACITY_BELOW_RESERVATIONS",
  "STARTS_AT_LOCKED",
  "NOT_RECURRING",
  "SERIES_START_CHANGE_UNSUPPORTED",
] as const;

function extractManagerUpdateCode(message: string): (typeof managerUpdateCodes)[number] | null {
  const upperMessage = message.toUpperCase();
  return managerUpdateCodes.find((code) => upperMessage.includes(code)) ?? null;
}

function failure(code: string, message: string): ClassMutationResult {
  return { ok: false, code, message };
}

function databaseFailure(error: { message: string } | null, fallback: string): ClassMutationResult {
  return failure("DATABASE_ERROR", error?.message ?? fallback);
}

export function normalizeLocalDateTime(localValue: string): DateNormalizationResult {
  const trimmedValue = localValue.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(trimmedValue);

  if (!match) {
    return {
      ok: false,
      code: "INVALID_FORMAT",
      message: "Enter a valid class date and time.",
    };
  }

  const localDate = new Date(trimmedValue);
  const [, year, month, day, hours, minutes] = match;

  if (
    Number.isNaN(localDate.getTime()) ||
    localDate.getFullYear() !== Number(year) ||
    localDate.getMonth() + 1 !== Number(month) ||
    localDate.getDate() !== Number(day) ||
    localDate.getHours() !== Number(hours) ||
    localDate.getMinutes() !== Number(minutes)
  ) {
    return {
      ok: false,
      code: "INVALID_FORMAT",
      message: "Enter a valid class date and time.",
    };
  }

  const startsAtUtc = localDate.toISOString();

  if (localDate.getTime() <= Date.now()) {
    return {
      ok: false,
      code: "PAST_DATE",
      message: "Class must start in the future.",
    };
  }

  return { ok: true, startsAtUtc };
}

function normalizeClassPayload(input: CreateClassInput):
  | {
      ok: true;
      data: {
        name: string;
        description: string | null;
        capacity: number;
        starts_at: string;
      };
      startsAtLocal: string;
    }
  | { ok: false; result: ClassMutationResult } {
  const parsed = classPayloadSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      result: failure("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid class details."),
    };
  }

  const dateResult = normalizeLocalDateTime(parsed.data.startsAt);

  if (!dateResult.ok) {
    return { ok: false, result: failure(dateResult.code, dateResult.message) };
  }

  return {
    ok: true,
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      capacity: parsed.data.capacity,
      starts_at: dateResult.startsAtUtc,
    },
    startsAtLocal: parsed.data.startsAt.trim(),
  };
}

function buildRecurringWeeklySeries(localStartsAt: string, repeatUntil: string | undefined): RecurringSeriesResult {
  const trimmedRepeatUntil = (repeatUntil ?? "").trim();

  if (!trimmedRepeatUntil) {
    return {
      ok: false,
      code: "REPEAT_UNTIL_REQUIRED",
      message: "Select an end date for recurring classes.",
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedRepeatUntil)) {
    return {
      ok: false,
      code: "REPEAT_UNTIL_INVALID",
      message: "Enter a valid recurring end date.",
    };
  }

  const startLocal = new Date(localStartsAt);
  if (Number.isNaN(startLocal.getTime())) {
    return {
      ok: false,
      code: "INVALID_FORMAT",
      message: "Enter a valid class date and time.",
    };
  }

  const repeatUntilInclusive = new Date(`${trimmedRepeatUntil}T23:59:59`);
  if (Number.isNaN(repeatUntilInclusive.getTime())) {
    return {
      ok: false,
      code: "REPEAT_UNTIL_INVALID",
      message: "Enter a valid recurring end date.",
    };
  }

  if (repeatUntilInclusive.getTime() < startLocal.getTime()) {
    return {
      ok: false,
      code: "REPEAT_UNTIL_BEFORE_START",
      message: "Recurring end date must be on or after the first class date.",
    };
  }

  const startsAtUtcList: string[] = [];
  const cursor = new Date(startLocal);

  while (cursor.getTime() <= repeatUntilInclusive.getTime()) {
    startsAtUtcList.push(cursor.toISOString());

    if (startsAtUtcList.length > MAX_RECURRING_OCCURRENCES) {
      return {
        ok: false,
        code: "TOO_MANY_OCCURRENCES",
        message: `Recurring setup is too long. Please keep it under ${MAX_RECURRING_OCCURRENCES} occurrences.`,
      };
    }

    cursor.setDate(cursor.getDate() + 7);
  }

  return { ok: true, startsAtUtcList };
}

async function getReservationRows(
  supabase: SupabaseClient,
  classId: string,
): Promise<{ ok: true; rows: ReservationCountRow[] } | { ok: false; result: ClassMutationResult }> {
  const { data, error } = await supabase.from("reservations").select("class_id, status").eq("class_id", classId);

  if (error) {
    return { ok: false, result: databaseFailure(error, "Could not load class reservations.") };
  }

  return { ok: true, rows: data };
}

export async function createClass(supabase: SupabaseClient, input: CreateClassInput): Promise<ClassMutationResult> {
  const normalized = normalizeClassPayload(input);

  if (!normalized.ok) {
    return normalized.result;
  }

  const isRecurring = input.isRecurring === true;

  if (isRecurring) {
    const series = buildRecurringWeeklySeries(normalized.startsAtLocal, input.repeatUntil);

    if (!series.ok) {
      return failure(series.code, series.message);
    }

    const repeatUntilDate = (input.repeatUntil ?? "").trim();
    const { data: seriesRow, error: seriesError } = await supabase
      .from("class_series")
      .insert({
        name: normalized.data.name,
        description: normalized.data.description,
        capacity: normalized.data.capacity,
        starts_from: series.startsAtUtcList[0],
        repeat_until: repeatUntilDate,
      })
      .select("id")
      .single();

    if (seriesError) {
      return databaseFailure(seriesError, "Could not create class series.");
    }

    const rows = series.startsAtUtcList.map((startsAtUtc) => ({
      class_series_id: seriesRow.id as string,
      name: normalized.data.name,
      description: normalized.data.description,
      capacity: normalized.data.capacity,
      starts_at: startsAtUtc,
    }));

    const { error } = await supabase.from("classes").insert(rows);

    if (error) {
      return databaseFailure(error, "Could not create recurring classes.");
    }

    return { ok: true };
  }

  const { data, error } = await supabase.from("classes").insert(normalized.data).select("id").single();

  if (error) {
    return databaseFailure(error, "Could not create class.");
  }

  return { ok: true, classId: data.id as string };
}

export async function updateClass(
  supabase: SupabaseClient,
  classId: string,
  input: UpdateClassInput,
): Promise<ClassMutationResult> {
  if (!uuidSchema.safeParse(classId).success) {
    return failure("VALIDATION_ERROR", "Invalid class identifier.");
  }

  const normalized = normalizeClassPayload(input);

  if (!normalized.ok) {
    return normalized.result;
  }

  let rpcResponse: z.infer<typeof managerUpdateRpcResponseSchema>;

  try {
    rpcResponse = managerUpdateRpcResponseSchema.parse(
      await supabase.rpc("update_manager_class", {
        p_class_id: classId,
        p_name: normalized.data.name,
        p_description: normalized.data.description,
        p_capacity: normalized.data.capacity,
        p_starts_at: normalized.data.starts_at,
        p_apply_to_series: input.applyToSeries === true,
      }),
    );
  } catch {
    return failure("DATABASE_ERROR", "Unexpected update_manager_class RPC result");
  }

  const { data, error } = rpcResponse;

  if (error) {
    const code = extractManagerUpdateCode(error.message);
    return code ? failure(code, error.message) : databaseFailure(error, "Could not update class.");
  }

  return typeof data === "object" && data !== null && "ok" in data && data.ok === true
    ? { ok: true }
    : failure("DATABASE_ERROR", "Unexpected update_manager_class RPC result");
}

export async function deleteClass(supabase: SupabaseClient, classId: string): Promise<ClassMutationResult> {
  if (!uuidSchema.safeParse(classId).success) {
    return failure("VALIDATION_ERROR", "Invalid class identifier.");
  }

  const reservationResult = await getReservationRows(supabase, classId);

  if (!reservationResult.ok) {
    return reservationResult.result;
  }

  if (reservationResult.rows.length > 0) {
    return failure("HAS_RESERVATIONS", "This class has reservation history and can only be cancelled.");
  }

  const { error } = await supabase.from("classes").delete().eq("id", classId);

  if (error) {
    return databaseFailure(error, "Could not delete class.");
  }

  return { ok: true };
}

export async function cancelClass(supabase: SupabaseClient, classId: string): Promise<ClassMutationResult> {
  if (!uuidSchema.safeParse(classId).success) {
    return failure("VALIDATION_ERROR", "Invalid class identifier.");
  }

  const { error } = await supabase.from("classes").update({ status: "cancelled" }).eq("id", classId);

  if (error) {
    return databaseFailure(error, "Could not cancel class.");
  }

  return { ok: true };
}

export async function stopSeriesFromClass(supabase: SupabaseClient, classId: string): Promise<ClassMutationResult> {
  if (!uuidSchema.safeParse(classId).success) {
    return failure("VALIDATION_ERROR", "Invalid class identifier.");
  }

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("starts_at, class_series_id")
    .eq("id", classId)
    .single<ClassStartsAtRow>();

  if (classError) {
    return databaseFailure(classError, "Could not load class details.");
  }

  if (!classRow.class_series_id) {
    return failure("NOT_RECURRING", "This class is not part of a recurring series.");
  }

  const { error: seriesError } = await supabase
    .from("class_series")
    .update({
      is_active: false,
      disabled_from: classRow.starts_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", classRow.class_series_id);

  if (seriesError) {
    return databaseFailure(seriesError, "Could not disable recurring series.");
  }

  const { error: cancelFutureError } = await supabase
    .from("classes")
    .update({ status: "cancelled" })
    .eq("class_series_id", classRow.class_series_id)
    .gte("starts_at", classRow.starts_at)
    .eq("status", "scheduled");

  if (cancelFutureError) {
    return databaseFailure(cancelFutureError, "Could not cancel future recurring classes.");
  }

  return { ok: true };
}

export async function stopSeriesFromDate(
  supabase: SupabaseClient,
  classId: string,
  stopFromDate: string,
): Promise<ClassMutationResult> {
  if (!uuidSchema.safeParse(classId).success) {
    return failure("VALIDATION_ERROR", "Invalid class identifier.");
  }

  const trimmedStopFromDate = stopFromDate.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedStopFromDate)) {
    return failure("SERIES_STOP_DATE_INVALID", "Enter a valid date to stop this recurring series.");
  }

  const localStopFrom = new Date(`${trimmedStopFromDate}T00:00:00`);

  if (Number.isNaN(localStopFrom.getTime())) {
    return failure("SERIES_STOP_DATE_INVALID", "Enter a valid date to stop this recurring series.");
  }

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("starts_at, class_series_id")
    .eq("id", classId)
    .single<ClassStartsAtRow>();

  if (classError) {
    return databaseFailure(classError, "Could not load class details.");
  }

  if (!classRow.class_series_id) {
    return failure("NOT_RECURRING", "This class is not part of a recurring series.");
  }

  const { data: firstTargetClass, error: firstTargetClassError } = await supabase
    .from("classes")
    .select("starts_at")
    .eq("class_series_id", classRow.class_series_id)
    .gte("starts_at", localStopFrom.toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .single<{ starts_at: string }>();

  if (firstTargetClassError) {
    return failure("SERIES_STOP_DATE_OUT_OF_RANGE", "No recurring classes exist on or after the selected date.");
  }

  const effectiveStopFrom = firstTargetClass.starts_at;

  const { error: seriesError } = await supabase
    .from("class_series")
    .update({
      is_active: false,
      disabled_from: effectiveStopFrom,
      updated_at: new Date().toISOString(),
    })
    .eq("id", classRow.class_series_id);

  if (seriesError) {
    return databaseFailure(seriesError, "Could not disable recurring series.");
  }

  const { error: cancelFutureError } = await supabase
    .from("classes")
    .update({ status: "cancelled" })
    .eq("class_series_id", classRow.class_series_id)
    .gte("starts_at", effectiveStopFrom)
    .eq("status", "scheduled");

  if (cancelFutureError) {
    return databaseFailure(cancelFutureError, "Could not cancel future recurring classes.");
  }

  return { ok: true };
}

export async function listManagerClasses(
  supabase: SupabaseClient,
): Promise<{ ok: true; data: ManagerClassItem[] } | { ok: false; code: string; message: string }> {
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, class_series_id, name, description, capacity, starts_at, status")
    .order("starts_at", { ascending: true });

  if (classesError) {
    return { ok: false, code: "DATABASE_ERROR", message: classesError.message };
  }

  const { data: reservations, error: reservationsError } = await supabase
    .from("reservations")
    .select("class_id, status");

  if (reservationsError) {
    return { ok: false, code: "DATABASE_ERROR", message: reservationsError.message };
  }

  const reservationRows: ReservationCountRow[] = reservations;
  const reservationCounts = new Map<string, { total: number; confirmed: number }>();

  for (const reservation of reservationRows) {
    const current = reservationCounts.get(reservation.class_id) ?? { total: 0, confirmed: 0 };
    current.total += 1;
    if (reservation.status === "confirmed") {
      current.confirmed += 1;
    }
    reservationCounts.set(reservation.class_id, current);
  }

  return {
    ok: true,
    data: classes.map((classItem: ClassRow) => {
      const counts = reservationCounts.get(classItem.id) ?? { total: 0, confirmed: 0 };
      return {
        id: classItem.id,
        seriesId: classItem.class_series_id,
        name: classItem.name,
        description: classItem.description,
        capacity: classItem.capacity,
        startsAt: classItem.starts_at,
        status: classItem.status,
        confirmedReservationsCount: counts.confirmed,
        reservationCount: counts.total,
      };
    }),
  };
}

export async function getClassAttendees(
  supabase: SupabaseClient,
  classId: string,
): Promise<{ ok: true; data: ClassAttendeeItem[] } | { ok: false; code: string; message: string }> {
  if (!uuidSchema.safeParse(classId).success) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Invalid class identifier." };
  }

  const { data: selectedClass, error: selectedClassError } = await supabase
    .from("classes")
    .select("id, class_series_id, starts_at")
    .eq("id", classId)
    .single<ClassSeriesMemberRow & { class_series_id: string | null }>();

  if (selectedClassError) {
    return { ok: false, code: "DATABASE_ERROR", message: selectedClassError.message };
  }

  let classMembers: ClassSeriesMemberRow[] = [
    {
      id: selectedClass.id,
      starts_at: selectedClass.starts_at,
    },
  ];

  if (selectedClass.class_series_id) {
    const { data: seriesMembers, error: seriesMembersError } = await supabase
      .from("classes")
      .select("id, starts_at")
      .eq("class_series_id", selectedClass.class_series_id)
      .order("starts_at", { ascending: true });

    if (seriesMembersError) {
      return { ok: false, code: "DATABASE_ERROR", message: seriesMembersError.message };
    }

    classMembers = seriesMembers;
  }

  let attendeesPerClass: ClassAttendeeItem[][];

  try {
    attendeesPerClass = await Promise.all(
      classMembers.map(async (member) => {
        const rpcResponse = attendeeRpcResponseSchema.parse(
          await supabase.rpc("get_class_attendees", { p_class_id: member.id }),
        );
        const { data, error } = rpcResponse;

        if (error) {
          throw new Error(error.message);
        }

        const attendeeRows = attendeeRowSchema.array().parse(data);

        return attendeeRows.map((row: AttendeeRow) => ({
          reservationId: row.reservation_id,
          classId: member.id,
          classStartsAt: member.starts_at,
          userId: row.user_id,
          userEmail: row.user_email,
          status: row.status,
          createdAt: row.created_at,
        }));
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load class attendees.";
    return { ok: false, code: "DATABASE_ERROR", message };
  }

  return {
    ok: true,
    data: attendeesPerClass.flat(),
  };
}
