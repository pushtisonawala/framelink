import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

let client: SupabaseClient | null = null;

/**
 * Server-side Supabase client using the service-role key.
 * NEVER import this into a client component — it has full storage access.
 */
export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const env = getEnv();
  client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function storageBucket() {
  return getEnv().SUPABASE_STORAGE_BUCKET;
}

/** Ensure the private storage bucket exists (idempotent). Used by the seed script. */
export async function ensureBucket(): Promise<void> {
  const bucket = storageBucket();
  const admin = supabaseAdmin();
  const { data } = await admin.storage.getBucket(bucket);
  if (data) return;
  const { error } = await admin.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: `${getEnv().MAX_UPLOAD_MB}MB`,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"],
  });
  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
}

export interface UploadResult {
  key: string;
}

/** Upload a binary object to the private bucket. */
export async function putObject(
  key: string,
  body: Buffer | Uint8Array | ArrayBuffer,
  contentType: string,
): Promise<UploadResult> {
  const admin = supabaseAdmin();
  const { error } = await admin.storage.from(storageBucket()).upload(key, body, {
    contentType,
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw error;
  return { key };
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const admin = supabaseAdmin();
  const { error } = await admin.storage.from(storageBucket()).remove(keys);
  if (error) throw error;
}

/**
 * Create a time-limited signed URL for a private object.
 * `download` forces a Content-Disposition: attachment response.
 */
export async function signedUrl(
  key: string,
  opts?: { expiresIn?: number; download?: string | boolean },
): Promise<string> {
  const admin = supabaseAdmin();
  const expiresIn = opts?.expiresIn ?? getEnv().SIGNED_URL_TTL_SECONDS;
  const { data, error } = await admin.storage
    .from(storageBucket())
    .createSignedUrl(key, expiresIn, opts?.download ? { download: opts.download } : undefined);
  if (error || !data) throw error ?? new Error("Failed to sign URL");
  return data.signedUrl;
}

/** Batch sign many keys; returns a map of key -> url (missing keys are skipped). */
export async function signedUrls(
  keys: string[],
  expiresIn?: number,
): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const admin = supabaseAdmin();
  const ttl = expiresIn ?? getEnv().SIGNED_URL_TTL_SECONDS;
  const { data, error } = await admin.storage
    .from(storageBucket())
    .createSignedUrls(keys, ttl);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) out[item.path] = item.signedUrl;
  }
  return out;
}
