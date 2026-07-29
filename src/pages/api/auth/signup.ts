import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { z } from "zod";

const signUpSchema = z
  .object({
    email: z.email(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const parsed = signUpSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid signup payload";
    return context.redirect(`/auth/signup?error=${encodeURIComponent(message)}`);
  }

  const { email, password } = parsed.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/auth/confirm-email");
};
