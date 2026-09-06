import { cookies } from "next/headers";
import { handler, json } from "@/lib/api";
import { getEnv } from "@/lib/env";

export const POST = handler(async () => {
  cookies().delete(getEnv().SESSION_COOKIE_NAME);
  return json({ ok: true });
});
