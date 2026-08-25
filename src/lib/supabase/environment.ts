import { z } from "zod";

const supabaseAdminEnvironmentSchema = z.object({
  SUPABASE_URL: z
    .url()
    .refine((value) => value.startsWith("https://"), {
      message: "SUPABASE_URL must use HTTPS",
    })
    .refine((value) => {
      const url = new URL(value);
      return (
        (url.pathname === "" || url.pathname === "/") &&
        url.search === "" &&
        url.hash === ""
      );
    }, {
      message: "SUPABASE_URL must be the root Project URL",
    }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export function requireSupabaseAdminEnvironment(
  environment: Record<string, string | undefined> = process.env,
) {
  const parsed = supabaseAdminEnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    throw new Error("SUPABASE_ADMIN_ENV_MISSING");
  }
  return parsed.data;
}
