import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import {
  AUTH_SIGNIN_ROUTE,
  AUTH_SIGNUP_ROUTE,
  CLASSES_ROUTE,
  MANAGER_ROUTE,
  getPostLoginDestination,
} from "@/lib/routing";
import type { AppRole } from "@/types";

const PRIVILEGED_ROUTES = ["/admin", MANAGER_ROUTE];
const AUTH_PAGES = [AUTH_SIGNIN_ROUTE, AUTH_SIGNUP_ROUTE];

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

  if (AUTH_PAGES.some((route) => context.url.pathname.startsWith(route))) {
    if (context.locals.user) {
      const returnTo = context.url.searchParams.get("returnTo");
      return context.redirect(getPostLoginDestination(returnTo));
    }
  }

  if (PRIVILEGED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect(AUTH_SIGNIN_ROUTE);
    }
    if (context.locals.role !== "admin" && context.locals.role !== "manager") {
      return context.redirect(CLASSES_ROUTE);
    }
  }

  return next();
});
