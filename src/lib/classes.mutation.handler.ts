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

export interface ManagerClassItem {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  startsAt: string;
  status: ClassStatus;
  confirmedReservationsCount: number;
  reservationCount: number;
}

interface ClassRow {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  starts_at: string;
  status: ClassStatus;
}

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

function failure(code: string, message: string): ClassMutationResult {
  return { ok: false, code, message };
}

function databaseFailure(error: { message: string } | null, fallback: string): ClassMutationResult {
  return failure("DATABASE_ERROR", error?.message ?? fallback);
}

export function normalizeLocalDateTime(localValue: string): DateNormalizationResult {
  const trimmedValue = localValue.trim();

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmedValue)) {
    return {
      ok: false,
      code: "INVALID_FORMAT",
      message: "Enter a valid class date and time.",
    };
  }

  const localDate = new Date(trimmedValue);

  if (Number.isNaN(localDate.getTime())) {
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

function normalizeClassPayload(
  input: CreateClassInput,
):
  | { ok: true; data: { name: string; description: string | null; capacity: number; starts_at: string } }
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
  };
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

  const reservationResult = await getReservationRows(supabase, classId);

  if (!reservationResult.ok) {
    return reservationResult.result;
  }

  const confirmedCount = reservationResult.rows.filter((row) => row.status === "confirmed").length;

  if (normalized.data.capacity < confirmedCount) {
    return failure("CAPACITY_BELOW_RESERVATIONS", "Capacity cannot be lower than confirmed reservations.");
  }

  const { error } = await supabase.from("classes").update(normalized.data).eq("id", classId);

  if (error) {
    return databaseFailure(error, "Could not update class.");
  }

  return { ok: true };
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

export async function listManagerClasses(
  supabase: SupabaseClient,
): Promise<{ ok: true; data: ManagerClassItem[] } | { ok: false; code: string; message: string }> {
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name, description, capacity, starts_at, status")
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

  const rpcResponse = attendeeRpcResponseSchema.parse(
    await supabase.rpc("get_class_attendees", { p_class_id: classId }),
  );
  const { data, error } = rpcResponse;

  if (error) {
    return { ok: false, code: "DATABASE_ERROR", message: error.message };
  }

  const attendeeRows = attendeeRowSchema.array().parse(data);

  return {
    ok: true,
    data: attendeeRows.map((row: AttendeeRow) => ({
      reservationId: row.reservation_id,
      userId: row.user_id,
      userEmail: row.user_email,
      status: row.status,
      createdAt: row.created_at,
    })),
  };
}
