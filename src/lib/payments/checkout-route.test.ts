import { describe, expect, it } from "bun:test";

import {
  buildNewChargeCheckoutHref,
  NEW_CHARGE_PARAM,
  parseCheckoutRoute,
} from "./checkout-route";

describe("parseCheckoutRoute", () => {
  it("trata id real como cobrança existente (deep link do hub)", () => {
    expect(
      parseCheckoutRoute({ chargeId: "qd790k1jtqtsecx4qwvv6vp8yn8f4sbj" })
    ).toEqual({
      chargeId: "qd790k1jtqtsecx4qwvv6vp8yn8f4sbj",
      kind: "charge",
    });
  });

  it("trata o sentinela com source como criação", () => {
    expect(
      parseCheckoutRoute({
        chargeId: NEW_CHARGE_PARAM,
        sourceId: "rd7fjba2n8d6rxnbb60yymk1z18f502h",
        sourceType: "tournament_entry",
      })
    ).toEqual({
      kind: "create",
      sourceId: "rd7fjba2n8d6rxnbb60yymk1z18f502h",
      sourceType: "tournament_entry",
    });
  });

  it("não cria nada sem o source (link sem cobrança e sem inscrição)", () => {
    expect(parseCheckoutRoute({ chargeId: NEW_CHARGE_PARAM })).toEqual({
      kind: "invalid",
    });
    expect(
      parseCheckoutRoute({ chargeId: NEW_CHARGE_PARAM, sourceId: "rd7" })
    ).toEqual({ kind: "invalid" });
  });

  it("aceita os params em lista, como o expo-router entrega", () => {
    expect(
      parseCheckoutRoute({
        chargeId: [NEW_CHARGE_PARAM],
        sourceId: ["rd7fjba2"],
        sourceType: ["tournament_entry"],
      })
    ).toEqual({
      kind: "create",
      sourceId: "rd7fjba2",
      sourceType: "tournament_entry",
    });
  });

  it("sem chargeId não há rota de cobrança", () => {
    expect(parseCheckoutRoute({ sourceId: "rd7fjba2" })).toEqual({
      kind: "invalid",
    });
  });
});

describe("buildNewChargeCheckoutHref", () => {
  it("leva o source na rota da cobrança que ainda não existe", () => {
    expect(
      buildNewChargeCheckoutHref({
        sourceId: "rd7fjba2",
        sourceType: "tournament_entry",
      })
    ).toEqual({
      params: {
        chargeId: NEW_CHARGE_PARAM,
        sourceId: "rd7fjba2",
        sourceType: "tournament_entry",
      },
      pathname: "/checkout/[chargeId]",
    });
  });
});
