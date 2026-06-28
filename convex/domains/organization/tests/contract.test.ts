import { describe, expect, it } from "bun:test";

import {
  activateOrganizationSchema,
  collectReplacedLogoStorageIds,
  isPhysicalOrganizationType,
  organizationMetadataSchema,
  upsertOrganizationSchema,
} from "../contract";

const validActivation = {
  acceptedTerms: {
    acceptedAt: "2026-06-28T12:00:00.000Z",
    userId: "user_123",
    version: "1.0.0",
  },
  contactEmail: "contato@bropen.com",
  name: "Clube BR Open",
  organizerType: "clube" as const,
  phone: "11999999999",
};

const fullAddress = {
  cep: "01001000",
  city: "São Paulo",
  district: "Sé",
  number: "100",
  state: "SP",
  street: "Praça da Sé",
};

describe("organization metadata schema", () => {
  it("parses empty metadata for legacy organizations", () => {
    expect(organizationMetadataSchema.parse({})).toEqual({});
  });

  it("parses null metadata as empty", () => {
    expect(organizationMetadataSchema.parse(null)).toEqual({});
  });

  it("parses metadata with optional fields", () => {
    const parsed = organizationMetadataSchema.parse({
      description: "Clube de tênis",
      organizerType: "clube",
      sports: ["tenis", "beach_tennis"],
      website: "https://bropen.com",
    });

    expect(parsed).toMatchObject({
      description: "Clube de tênis",
      organizerType: "clube",
    });
  });
});

describe("physical organizer type", () => {
  it("classifies physical types", () => {
    expect(isPhysicalOrganizationType("academia")).toBe(true);
    expect(isPhysicalOrganizationType("clube")).toBe(true);
    expect(isPhysicalOrganizationType("centro_de_treinamento")).toBe(true);
    expect(isPhysicalOrganizationType("escola")).toBe(true);
    expect(isPhysicalOrganizationType("condominio")).toBe(true);
  });

  it("rejects non-physical types", () => {
    expect(isPhysicalOrganizationType("liga")).toBe(false);
    expect(isPhysicalOrganizationType("federacao")).toBe(false);
    expect(isPhysicalOrganizationType("confederacao")).toBe(false);
    expect(isPhysicalOrganizationType("outro")).toBe(false);
    expect(isPhysicalOrganizationType("particular")).toBe(false);
  });
});

describe("activate organization schema", () => {
  it("accepts a non-physical type without address", () => {
    const parsed = activateOrganizationSchema.parse({
      ...validActivation,
      organizerType: "liga",
    });

    expect(parsed.organizerType).toBe("liga");
    expect(parsed.address).toBeUndefined();
  });

  it("accepts a physical type with a full address", () => {
    const parsed = activateOrganizationSchema.parse({
      ...validActivation,
      address: fullAddress,
      organizerType: "clube",
    });

    expect(parsed.address).toMatchObject({ cep: "01001000" });
  });

  it("rejects a physical type without an address", () => {
    const result = activateOrganizationSchema.safeParse({
      ...validActivation,
      organizerType: "clube",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-physical type that includes an address", () => {
    const result = activateOrganizationSchema.safeParse({
      ...validActivation,
      address: fullAddress,
      organizerType: "liga",
    });

    expect(result.success).toBe(false);
  });

  it("rejects activation without accepted terms", () => {
    const { acceptedTerms, ...withoutTerms } = validActivation;

    const result = activateOrganizationSchema.safeParse(withoutTerms);

    expect(result.success).toBe(false);
  });

  it("accepts optional logo and sports on activation", () => {
    const parsed = activateOrganizationSchema.parse({
      ...validActivation,
      logoStorageId: "kg123",
      organizerType: "liga",
      sports: ["tenis"],
    });

    expect(parsed.logoStorageId).toBe("kg123");
    expect(parsed.sports).toEqual(["tenis"]);
  });
});

const validContact = {
  contactEmail: "contato@bropen.com",
  phone: "11999999999",
};

describe("upsert organization schema", () => {
  it("does not accept accepted terms on edit", () => {
    const result = upsertOrganizationSchema.safeParse({
      acceptedTerms: { acceptedAt: "x", userId: "y", version: "1" },
      name: "Clube",
      organizerType: "clube",
      ...validContact,
    });

    expect(result.success).toBe(false);
  });

  it("switching from physical to non-physical drops address via refinement", () => {
    const result = upsertOrganizationSchema.safeParse({
      address: fullAddress,
      name: "Liga",
      organizerType: "liga",
      ...validContact,
    });

    expect(result.success).toBe(false);
  });

  it("accepts an edit with description, website, contactEmail", () => {
    const parsed = upsertOrganizationSchema.parse({
      description: "Bio",
      name: "Clube",
      organizerType: "clube",
      address: fullAddress,
      website: "https://bropen.com",
      ...validContact,
    });

    expect(parsed.description).toBe("Bio");
  });

  it("rejects 'outro' type without organizerTypeLabel", () => {
    const result = upsertOrganizationSchema.safeParse({
      name: "Minha Org",
      organizerType: "outro",
      ...validContact,
    });

    expect(result.success).toBe(false);
  });

  it("accepts 'outro' type with organizerTypeLabel", () => {
    const parsed = upsertOrganizationSchema.parse({
      name: "Minha Org",
      organizerType: "outro",
      organizerTypeLabel: "Associação de bairro",
      ...validContact,
    });

    expect(parsed.organizerType).toBe("outro");
    expect(parsed.organizerTypeLabel).toBe("Associação de bairro");
  });

  it("rejects sports containing 'outro' without sportsLabel", () => {
    const result = upsertOrganizationSchema.safeParse({
      name: "Minha Org",
      organizerType: "liga",
      sports: ["tenis", "outro"],
      ...validContact,
    });

    expect(result.success).toBe(false);
  });

  it("accepts sports containing 'outro' with sportsLabel", () => {
    const parsed = upsertOrganizationSchema.parse({
      name: "Minha Org",
      organizerType: "liga",
      sports: ["tenis", "outro"],
      sportsLabel: "Frescobol",
      ...validContact,
    });

    expect(parsed.sports).toEqual(["tenis", "outro"]);
    expect(parsed.sportsLabel).toBe("Frescobol");
  });
});

describe("replaced logo storage ids", () => {
  it("collects the previous logo when it changes", () => {
    expect(
      collectReplacedLogoStorageIds({
        next: { logoStorageId: "new-logo" },
        previous: { logoStorageId: "old-logo" },
      })
    ).toEqual(["old-logo"]);
  });

  it("does not collect null or unchanged logos", () => {
    expect(
      collectReplacedLogoStorageIds({
        next: { logoStorageId: "same" },
        previous: { logoStorageId: "same" },
      })
    ).toEqual([]);

    expect(
      collectReplacedLogoStorageIds({
        next: { logoStorageId: "new" },
        previous: { logoStorageId: null },
      })
    ).toEqual([]);
  });
});
