const NAME_PARTS_SPLIT_REGEX = /\s+/;

export function getGreetingLabel(now = new Date()): string {
  const hour = now.getHours();

  if (hour < 12) {
    return "Bom dia";
  }

  if (hour < 18) {
    return "Boa tarde";
  }

  return "Boa noite";
}

export function getUserInitials(
  name?: null | string,
  fallback?: null | string
): string {
  const normalizedName = name?.trim();

  if (normalizedName) {
    return normalizedName
      .split(NAME_PARTS_SPLIT_REGEX)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  return (fallback ?? "?").slice(0, 2).toUpperCase();
}
