import type { APIRoute } from "astro";
import { deleteClass } from "@/lib/classes.mutation.handler";
import { MANAGER_CLASSES_ROUTE } from "@/lib/routing";
import { createClient } from "@/lib/supabase";

function resultRedirect(code: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `${MANAGER_CLASSES_ROUTE}?result=${encodeURIComponent(code)}` },
  });
}

export const POST: APIRoute = async (context) => {
  if (!context.locals.user || (context.locals.role !== "manager" && context.locals.role !== "admin")) {
    return context.redirect("/classes");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return resultRedirect("CONFIG_ERROR");
  }

  const result = await deleteClass(supabase, context.params.id ?? "");
  return result.ok ? resultRedirect("DELETED") : resultRedirect(result.code);
};
