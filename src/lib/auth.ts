import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomInt } from "crypto";
import { getEnv } from "./env";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export interface SessionClaims {
  sub: string; // user id
  email: string;
  role: "ADMIN" | "TEAM_MEMBER";
  name: string;
}

export async function signSession(claims: SessionClaims, expiresIn = "7d"): Promise<string> {
  const env = getEnv();
  return new SignJWT({ email: claims.email, role: claims.role, name: claims.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(env.JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const env = getEnv();
    const { payload } = await jwtVerify(token, secretKey(), { issuer: env.JWT_ISSUER });
    if (!payload.sub || !payload.role) return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      role: payload.role as SessionClaims["role"],
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}

export interface GalleryClaims {
  gid: string; // gallery id
  slug: string;
}

export async function signGalleryAccess(claims: GalleryClaims): Promise<string> {
  const env = getEnv();
  return new SignJWT({ slug: claims.slug, scope: "gallery" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.gid)
    .setIssuer(env.JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${env.GALLERY_SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyGalleryAccess(
  token: string,
  slug: string,
): Promise<GalleryClaims | null> {
  try {
    const env = getEnv();
    const { payload } = await jwtVerify(token, secretKey(), { issuer: env.JWT_ISSUER });
    if (payload.scope !== "gallery" || payload.slug !== slug || !payload.sub) return null;
    return { gid: payload.sub, slug };
  } catch {
    return null;
  }
}

/** Cryptographically-strong numeric PIN (default 6 digits). */
export function generatePin(length = 6): string {
  let pin = "";
  for (let i = 0; i < length; i++) pin += randomInt(0, 10).toString();
  return pin;
}

/** One-time password for team members added by an admin. */
export function generateTempPassword(): string {
  // 10 chars, url-safe, mixed — no ambiguous characters.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[randomInt(0, alphabet.length)];
  return out;
}

export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${ip}::${getEnv().JWT_SECRET.slice(0, 16)}`)
    .digest("hex");
}
