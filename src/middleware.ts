import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import type { AppRole } from "@/types";

const PROTECTED_ROUTES = ["/dashboard"];
const ADMIN_ROUTES = ["/admin"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;

    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      context.locals.role = profileError ? null : (profile.role as AppRole);
    } else {
      context.locals.role = null;
    }
  } else {
    context.locals.user = null;
    context.locals.role = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  if (ADMIN_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
    if (context.locals.role !== "admin" && context.locals.role !== "manager") {
      return context.redirect("/dashboard");
    }
  }

  return next();
});
