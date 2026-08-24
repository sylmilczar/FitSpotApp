import type { APIRoute } from "astro";
import { createClass } from "@/lib/classes.mutation.handler";
import { MANAGER_CLASSES_ROUTE } from "@/lib/routing";
import { createClient } from "@/lib/supabase";
import type { CreateClassInput } from "@/types";

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

  const form = await context.request.formData();
  const getText = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  const capacity = Number(form.get("capacity"));
  const input: CreateClassInput = {
    name: getText("className"),
    description: getText("description"),
    capacity,
    startsAt: getText("startsAt"),
    isRecurring: form.get("isRecurring") === "on",
    repeatUntil: getText("repeatUntil"),
  };

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return resultRedirect("CONFIG_ERROR");
  }

  const result = await createClass(supabase, input);
  if (!result.ok) {
    return resultRedirect(result.code);
  }

  return resultRedirect(input.isRecurring ? "SERIES_CREATED" : "CREATED");
};
