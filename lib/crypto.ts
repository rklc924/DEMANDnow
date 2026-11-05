import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// AES-256-GCM for secrets stored in the database (mailbox OAuth tokens).
// Key: ENCRYPTION_KEY (any long random string). Values are prefixed "enc:" so older plain values still read.

const key = () => createHash("sha256").update(process.env.ENCRYPTION_KEY ?? process.env.SESSION_SECRET ?? "dev-only-secret-change-me").digest();

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `enc:${Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url")}`;
}

export function decrypt(value: string | undefined): string | undefined {
  if (!value || !value.startsWith("enc:")) return value;
  const raw = Buffer.from(value.slice(4), "base64url");
  const d = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}
