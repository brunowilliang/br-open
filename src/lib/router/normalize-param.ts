export function normalizeRouteParam(
  value: null | string | string[] | undefined
): null | string {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}
