import { observable } from "@legendapp/state";

/** Folga entre a barra flutuante e a base da tela (`bottom-safe-offset-3`). */
export const FLOATING_TAB_BAR_BOTTOM_GAP = 12;

/** Altura MEDIDA da barra flutuante de navegação, em pt: ela é irmã da tela, não
 * filha dela, então quem precisa descontá-la do layout lê daqui. 0 = ainda não
 * medida (vale só a safe area + a folga). */
export const floatingTabBarHeight$ = observable(0);

function normalizeLayoutValue(value: number) {
  return Math.ceil(Math.max(value, 0));
}

/** Espaço que a barra ocupa na base (altura + folga + safe area), em pt: é o
 * mesmo número que as telas consomem via `pb-floating-tab-bar-*`. */
export function getFloatingTabBarSpacing(input: {
  bottomInset: number;
  height: number;
}) {
  return (
    normalizeLayoutValue(input.height) +
    normalizeLayoutValue(input.bottomInset) +
    FLOATING_TAB_BAR_BOTTOM_GAP
  );
}
