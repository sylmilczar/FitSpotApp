import type { APIRoute } from "astro";
import { createReservation } from "@/lib/booking.handler";
import { AUTH_SIGNIN_ROUTE, CLASSES_ROUTE, getSafeReturnTo } from "@/lib/routing";
import { createClient } from "@/lib/supabase";
import type { ReservationActionResultCode } from "@/types";
import { z } from "zod";

const uuidLikeRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const reserveSchema = z.object({
  classId: z.string().regex(uuidLikeRegex),
  returnTo: z.string().optional(),
});

function getClassDetailsPath(classId: string): string {
  return `/classes/${classId}`;
}

function withReserveResult(path: string, resultCode: ReservationActionResultCode): string {
  const url = new URL(path, "http://localhost");
  url.searchParams.set("reserveResult", resultCode);
  return `${url.pathname}${url.search}`;
}

function withReturnTo(path: string): string {
  return `${AUTH_SIGNIN_ROUTE}?returnTo=${encodeURIComponent(path)}`;
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();

  const parsed = reserveSchema.safeParse({
    classId: form.get("classId"),
    returnTo: form.get("returnTo") ?? undefined,
  });

  const fallbackPath = parsed.success ? getClassDetailsPath(parsed.data.classId) : CLASSES_ROUTE;
  const safeReturnTo = parsed.success ? (getSafeReturnTo(parsed.data.returnTo ?? null) ?? fallbackPath) : fallbackPath;

  if (!parsed.success) {
    return context.redirect(withReserveResult(safeReturnTo, "UNKNOWN"));
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect(withReturnTo(safeReturnTo));
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(withReserveResult(safeReturnTo, "UNKNOWN"));
  }

  const bookingResult = await createReservation(supabase, user.id, parsed.data.classId);

  if (bookingResult.ok) {
    return context.redirect(withReserveResult(safeReturnTo, "RESERVED"));
  }

  return context.redirect(withReserveResult(safeReturnTo, bookingResult.code));
};
