export function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) {
    return email;
  }
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  const masked =
    local.length > 1
      ? `${local[0]}${"*".repeat(Math.max(2, local.length - 1))}`
      : local;
  return `${masked}${domain}`;
}
