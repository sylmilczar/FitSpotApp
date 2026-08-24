import type { APIRoute } from "astro";
import { updateClass } from "@/lib/classes.mutation.handler";
import { MANAGER_CLASSES_ROUTE } from "@/lib/routing";
import { createClient } from "@/lib/supabase";
import type { UpdateClassInput } from "@/types";

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

  const classId = context.params.id ?? "";
  const form = await context.request.formData();
  const getText = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  const input: UpdateClassInput = {
    name: getText("className"),
    description: getText("description"),
    capacity: Number(form.get("capacity")),
    startsAt: getText("startsAt"),
    applyToSeries: form.get("applyToSeries") === "on",
  };

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return resultRedirect("CONFIG_ERROR");
  }

  const result = await updateClass(supabase, classId, input);
  return result.ok ? resultRedirect("UPDATED") : resultRedirect(result.code);
};
