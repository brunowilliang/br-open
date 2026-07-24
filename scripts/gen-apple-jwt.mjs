import { importPKCS8, SignJWT } from "jose";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve paths relative to the repo root so the script is portable (works on
// any machine/CI, not just a specific developer's absolute home path).
const repoRoot = resolve(fileURLToPath(import.meta.url), "..", "..");

// Apple credentials can be overridden via env; defaults match the br-open app.
const keyId = process.env.APPLE_KEY_ID ?? "S4688A8T3H";
const teamId = process.env.APPLE_TEAM_ID ?? "8W92MDLX9N";
const clientId = process.env.APPLE_CLIENT_ID ?? "com.brunogarcia.bropen.auth";

// Read the .p8 from the local Secrets/ bundle (gitignored), or an explicit path.
const p8Path =
  process.env.APPLE_AUTH_KEY_PATH ??
  resolve(repoRoot, "Secrets", `AuthKey_${keyId}.p8`);

const privateKeyRaw = readFileSync(p8Path, "utf8");
const privateKey = privateKeyRaw.replace(/\\n/g, "\n").trim();
const key = await importPKCS8(privateKey, "ES256");
const now = Math.floor(Date.now() / 1000);
const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: keyId })
  .setIssuer(teamId)
  .setSubject(clientId)
  .setAudience("https://appleid.apple.com")
  .setIssuedAt(now)
  .setExpirationTime(now + 180 * 24 * 60 * 60)
  .sign(key);
process.stdout.write(jwt);
