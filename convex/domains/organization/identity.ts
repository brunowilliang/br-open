import type { OrganizationMetadata } from "./contract";

const ORG_NAME_FALLBACK = "Organização";

export function buildOrganizationDisplayName(input: { name?: null | string }) {
  const trimmedName = input.name?.trim();

  if (trimmedName) {
    return trimmedName;
  }

  return ORG_NAME_FALLBACK;
}

export function parseOrganizationMetadata(raw: unknown): OrganizationMetadata {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  return raw as OrganizationMetadata;
}
