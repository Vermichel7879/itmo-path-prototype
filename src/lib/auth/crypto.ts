import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { compare, hash } from "bcryptjs";

const BCRYPT_COST = 12;

export function requireAdminSecuritySecret(environment = process.env) {
  const value = environment.ADMIN_SECURITY_SECRET ?? environment.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("ADMIN_SECURITY_SECRET must contain at least 32 characters");
  }
  return value;
}

export async function hashAdminPassword(password: string) {
  return hash(password, BCRYPT_COST);
}

export async function verifyAdminPassword(password: string, digest: string) {
  return compare(password, digest);
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function hmacThrottleKey(value: string, secret: string) {
  return createHmac("sha256", secret)
    .update(value.trim().toLocaleLowerCase("ru-RU"), "utf8")
    .digest("hex");
}

export function safeTokenEquals(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
