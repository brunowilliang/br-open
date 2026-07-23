import { importPKCS8, SignJWT } from "jose";
import { readFileSync } from "node:fs";

const privateKeyRaw = readFileSync(
  "/Users/brunogarcia/Documents/Dev/projects/secrets/br-open/AuthKey_S4688A8T3H.p8",
  "utf8"
);
const privateKey = privateKeyRaw.replace(/\\n/g, "\n").trim();
const key = await importPKCS8(privateKey, "ES256");
const now = Math.floor(Date.now() / 1000);
const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: "S4688A8T3H" })
  .setIssuer("8W92MDLX9N")
  .setSubject("com.brunogarcia.bropen.auth")
  .setAudience("https://appleid.apple.com")
  .setIssuedAt(now)
  .setExpirationTime(now + 180 * 24 * 60 * 60)
  .sign(key);
process.stdout.write(jwt);
