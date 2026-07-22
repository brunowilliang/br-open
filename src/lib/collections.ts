type SelectableOption = { label: string; value: string };

export function getSelectedOption<T extends SelectableOption>(
  options: readonly T[],
  value: null | string | undefined
): T | undefined {
  return options.find((option) => option.value === value);
}
