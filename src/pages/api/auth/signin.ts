import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { z } from "zod";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

function getSignInValidationMessage(error: z.ZodError): string {
  const firstIssue = error.issues[0];

  if (firstIssue.path[0] === "email") {
    return "Enter a valid email address.";
  }

  if (firstIssue.path[0] === "password") {
    return "Password is required.";
  }

  return "Please check your sign in details and try again.";
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const parsed = signInSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });

  if (!parsed.success) {
    const message = getSignInValidationMessage(parsed.error);
    return context.redirect(`/auth/signin?error=${encodeURIComponent(message)}`);
  }

  const { email, password } = parsed.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/dashboard");
};
