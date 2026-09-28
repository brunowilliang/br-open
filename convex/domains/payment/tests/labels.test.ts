import { describe, expect, it } from "bun:test";
import { formatCentsBRL } from "../labels";

describe("rotulo de dinheiro", () => {
  it("formata centavos em reais no padrao do app", () => {
    expect(formatCentsBRL(12_000)).toBe("R$ 120,00");
    expect(formatCentsBRL(9050)).toBe("R$ 90,50");
    expect(formatCentsBRL(95)).toBe("R$ 0,95");
    expect(formatCentsBRL(0)).toBe("R$ 0,00");
  });
});
