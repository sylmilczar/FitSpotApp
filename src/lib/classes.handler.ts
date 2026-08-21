import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "astro:env/server";
import type { ClassDetailsView, ClassListItem, ClassStatus } from "@/types";

type ListUpcomingClassesResult = { ok: true; data: ClassListItem[] } | { ok: false; message: string };

type ClassDetailsResult =
  { ok: true; data: ClassDetailsView } | { ok: false; reason: "not_found" | "query_failed"; message: string };

interface ClassAvailabilityRow {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  starts_at: string;
  confirmed_reservations_count: number;
  available_spots: number;
  is_full: boolean;
  status: ClassStatus;
}

interface RpcError {
  message: string;
}

interface RpcResult<T> {
  data: T | null;
  error: RpcError | null;
}

function isRpcResult<T>(value: unknown): value is RpcResult<T> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "data" in value && "error" in value;
}

function createPublicReadClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return null;
  }

  return createSupabaseClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function mapClassRow(row: ClassAvailabilityRow): ClassListItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    capacity: row.capacity,
    startsAt: row.starts_at,
    confirmedReservationsCount: row.confirmed_reservations_count,
    availableSpots: Math.max(row.available_spots, 0),
    isFull: row.is_full,
    isStarted: new Date(row.starts_at).getTime() <= Date.now(),
    status: row.status,
  };
}

export async function listUpcomingClasses(): Promise<ListUpcomingClassesResult> {
  const supabase = createPublicReadClient();

  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured",
    };
  }

  const rpcResponse: unknown = await supabase.rpc("list_upcoming_classes_with_availability");

  if (!isRpcResult<ClassAvailabilityRow[]>(rpcResponse)) {
    return {
      ok: false,
      message: "Unexpected classes query result",
    };
  }

  const { data, error } = rpcResponse;

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  const rows = data ?? [];

  return {
    ok: true,
    data: rows.map(mapClassRow),
  };
}

export async function getClassDetailsById(id: string): Promise<ClassDetailsResult> {
  const supabase = createPublicReadClient();

  if (!supabase) {
    return {
      ok: false,
      reason: "query_failed",
      message: "Supabase is not configured",
    };
  }

  const rpcResponse: unknown = await supabase.rpc("get_class_details_with_availability", {
    p_class_id: id,
  });

  if (!isRpcResult<ClassAvailabilityRow[]>(rpcResponse)) {
    return {
      ok: false,
      reason: "query_failed",
      message: "Unexpected class details query result",
    };
  }

  const { data, error } = rpcResponse;

  if (error) {
    return {
      ok: false,
      reason: "query_failed",
      message: error.message,
    };
  }

  const row = data?.[0];

  if (!row) {
    return {
      ok: false,
      reason: "not_found",
      message: "Class not found",
    };
  }

  return {
    ok: true,
    data: mapClassRow(row),
  };
}
