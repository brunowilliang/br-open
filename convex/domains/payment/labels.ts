/** Valor em reais para copy de usuario: "R$ 120,00". */
export function formatCentsBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}
