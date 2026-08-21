import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingContractResult, BookingGuardrailCode, UpcomingReservationItem } from "@/types";

const GUARDRAIL_CODES: BookingGuardrailCode[] = ["CLASS_FULL", "ALREADY_RESERVED", "CLASS_STARTED", "CLASS_CANCELLED"];

function extractGuardrailCode(message: string): BookingGuardrailCode | "UNKNOWN" {
  const upper = message.toUpperCase();
  const match = GUARDRAIL_CODES.find((code) => upper.includes(code));
  return match ?? "UNKNOWN";
}

function isSuccessPayload(value: unknown): value is { ok: true } {
  return typeof value === "object" && value !== null && "ok" in value && (value as { ok?: unknown }).ok === true;
}

interface UpcomingReservationRow {
  reservation_id: string;
  class_id: string;
  class_name: string;
  class_description: string | null;
  starts_at: string;
  class_status: "scheduled" | "cancelled";
  capacity: number;
  confirmed_reservations_count: number;
  available_spots: number;
  status: "confirmed";
}

interface RpcError {
  message: string;
}

interface RpcResult<T> {
  data: T | null;
  error: RpcError | null;
}

type UpcomingReservationsResult = { ok: true; data: UpcomingReservationItem[] } | { ok: false; message: string };

function isRpcResult<T>(value: unknown): value is RpcResult<T> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "data" in value && "error" in value;
}

function mapUpcomingReservationRow(row: UpcomingReservationRow): UpcomingReservationItem {
  return {
    reservationId: row.reservation_id,
    classId: row.class_id,
    className: row.class_name,
    classDescription: row.class_description,
    startsAt: row.starts_at,
    classStatus: row.class_status,
    capacity: row.capacity,
    confirmedReservationsCount: row.confirmed_reservations_count,
    availableSpots: Math.max(row.available_spots, 0),
    status: row.status,
  };
}

export async function createReservation(
  supabase: SupabaseClient,
  userId: string,
  classId: string,
): Promise<BookingContractResult> {
  const rpcResult = await supabase.rpc("create_reservation", {
    p_user_id: userId,
    p_class_id: classId,
  });

  const error = rpcResult.error;
  const data: unknown = rpcResult.data;

  if (error) {
    return {
      ok: false,
      code: extractGuardrailCode(error.message),
      message: error.message,
    };
  }

  if (isSuccessPayload(data)) {
    return { ok: true };
  }

  return {
    ok: false,
    code: "UNKNOWN",
    message: "Unexpected create_reservation RPC result",
  };
}

export async function getUserUpcomingReservations(
  supabase: SupabaseClient,
  userId: string,
): Promise<UpcomingReservationsResult> {
  const rpcResponse: unknown = await supabase.rpc("get_user_upcoming_reservations", {
    p_user_id: userId,
  });

  if (!isRpcResult<UpcomingReservationRow[]>(rpcResponse)) {
    return {
      ok: false,
      message: "Unexpected get_user_upcoming_reservations RPC result",
    };
  }

  const { data, error } = rpcResponse;

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  return {
    ok: true,
    data: (data ?? []).map(mapUpcomingReservationRow),
  };
}
