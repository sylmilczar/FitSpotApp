import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingContractResult, BookingGuardrailCode } from "@/types";

const GUARDRAIL_CODES: BookingGuardrailCode[] = ["CLASS_FULL", "ALREADY_RESERVED", "CLASS_STARTED"];

function extractGuardrailCode(message: string): BookingGuardrailCode | "UNKNOWN" {
  const upper = message.toUpperCase();
  const match = GUARDRAIL_CODES.find((code) => upper.includes(code));
  return match ?? "UNKNOWN";
}

function isSuccessPayload(value: unknown): value is { ok: true } {
  return typeof value === "object" && value !== null && "ok" in value && (value as { ok?: unknown }).ok === true;
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
