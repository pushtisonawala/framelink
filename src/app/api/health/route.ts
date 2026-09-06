import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Liveness + DB connectivity probe for the platform / uptime monitors.
 * Also reports which required env vars are PRESENT (names only, never values)
 * so a misconfigured deployment can be diagnosed without shell access.
 */
const REQUIRED = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JWT_SECRET",
  "NEXT_PUBLIC_APP_URL",
] as const;

export async function GET() {
  const env: Record<string, boolean> = {};
  for (const key of REQUIRED) env[key] = Boolean(process.env[key]?.trim());
  const jwtOk = (process.env.JWT_SECRET?.length ?? 0) >= 32;
  const envComplete = REQUIRED.every((k) => env[k]) && jwtOk;

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: envComplete ? "ok" : "misconfigured",
      db: "up",
      env,
      jwtSecretLongEnough: jwtOk,
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        db: "down",
        env,
        jwtSecretLongEnough: jwtOk,
        time: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
