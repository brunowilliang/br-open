export function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum < minimum) {
    return minimum;
  }

  return Math.min(Math.max(value, minimum), maximum);
}

export function clampToNonNegativeInt(value: number): number {
  return Math.max(0, Math.trunc(value));
}
