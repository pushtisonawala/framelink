import { z } from "zod";

/**
 * Central, validated access to environment variables.
 * Throws early (at import time on the server) if something required is missing.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("event-photos"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ISSUER: z.string().default("framelink"),
  SESSION_COOKIE_NAME: z.string().default("framelink_session"),
  GALLERY_COOKIE_PREFIX: z.string().default("framelink_gallery_"),

  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  MAX_UPLOAD_MB: z.coerce.number().positive().default(25),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().positive().default(3600),
  GALLERY_SESSION_TTL_SECONDS: z.coerce.number().positive().default(7200),
  PIN_MAX_ATTEMPTS: z.coerce.number().positive().default(10),
  PIN_ATTEMPT_WINDOW_SECONDS: z.coerce.number().positive().default(900),
});

type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  // Treat empty-string env vars as unset. Hosting platforms (Vercel included)
  // can surface a declared-but-blank variable as "", which would otherwise
  // fail validation instead of falling back to the schema default.
  const raw = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  const parsed = serverSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables:\n${issues}\n\n` +
        "Copy .env.example to .env and fill in the values.",
    );
  }
  cached = parsed.data;
  return cached;
}

/** Public config safe to expose to the browser. */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
};
