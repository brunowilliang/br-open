import { describe, expect, it } from "bun:test";

import { seedPlayers } from "../data";
import {
  comparePendencyTargetRecency,
  PENDENCY_SEED_PRIMARY_ENTRY_TARGETS,
  PENDENCY_SEED_TOURNAMENTS,
  PENDENCY_SEED_VIEWER_GENDER,
  type PendencySeedEntry,
  type PendencySeedProfileGender,
  selectFreePendencyEntryProfiles,
} from "../pendency-plan";

/** Categoria como o seed a monta: o indice unico e por (modalidade, genero). */
function categoryKeyOf(entry: PendencySeedEntry) {
  return `${entry.modality}-${entry.gender}`;
}

/** Ocupantes que a entrada RESERVA na categoria (o convite de dupla reserva os dois). */
function occupantsOf(entry: PendencySeedEntry) {
  if (entry.viewerSide === null) {
    return [`seed:${entry.counterpartIndex}`];
  }

  return entry.modality === "singles"
    ? ["viewer"]
    : ["viewer", `seed:${entry.counterpartIndex}`];
}

const EXPECTED_CATEGORY_OCCUPANTS: Record<string, Record<string, string[]>> = {
  "copa-beira-rio": {
    "doubles-male": ["viewer", "seed:3"],
    "doubles-mixed": ["viewer", "seed:9"],
    "singles-female": ["seed:17", "seed:19"],
    "singles-male": ["viewer"],
  },
  "torneio-do-vale": {
    "doubles-mixed": ["viewer", "seed:16"],
  },
};

/** Par de generos que a categoria aceita, na ordem alfabetica do teste. */
const EXPECTED_OCCUPANT_GENDERS: Record<
  string,
  (PendencySeedProfileGender | null)[]
> = {
  "doubles-female": ["Feminino", "Feminino"],
  "doubles-male": ["Masculino", "Masculino"],
  "doubles-mixed": ["Feminino", "Masculino"],
  "singles-female": ["Feminino"],
  "singles-male": ["Masculino"],
};

const PROFILE_GENDER_BY_INDEX = seedPlayers.map((player) => player.gender);

describe("seed: cenario de pendencias", () => {
  it("cada torneio tem as categorias do cenario e nenhum perfil em duas", () => {
    for (const tournament of PENDENCY_SEED_TOURNAMENTS) {
      const occupantsByCategory: Record<string, string[]> = {};

      for (const entry of tournament.entries) {
        const categoryKey = categoryKeyOf(entry);
        occupantsByCategory[categoryKey] = [
          ...(occupantsByCategory[categoryKey] ?? []),
          ...occupantsOf(entry),
        ];
      }

      expect(occupantsByCategory).toEqual(
        EXPECTED_CATEGORY_OCCUPANTS[tournament.key]
      );
    }
  });

  it("o genero do ocupante casa com o genero que a categoria declara", () => {
    for (const tournament of PENDENCY_SEED_TOURNAMENTS) {
      for (const entry of tournament.entries) {
        const counterpartGender =
          entry.counterpartIndex === null
            ? null
            : PROFILE_GENDER_BY_INDEX[entry.counterpartIndex]!;
        const occupantGenders = occupantsOf(entry)
          .map((occupant) =>
            occupant === "viewer"
              ? PENDENCY_SEED_VIEWER_GENDER
              : counterpartGender
          )
          .sort();

        expect(occupantGenders).toEqual(
          EXPECTED_OCCUPANT_GENDERS[categoryKeyOf(entry)]
        );
      }
    }
  });

  it("entrada de dupla sempre tem os dois lados e entrada de outro e simples", () => {
    for (const tournament of PENDENCY_SEED_TOURNAMENTS) {
      for (const entry of tournament.entries) {
        if (entry.modality === "doubles") {
          expect(entry.counterpartIndex).not.toBeNull();
        }

        if (entry.viewerSide === null) {
          expect(entry.modality).toBe("singles");
          expect(entry.counterpartIndex).not.toBeNull();
        }

        if (entry.viewerSide === "B") {
          // Convite recebido so existe em dupla: quem convidou e o lado A.
          expect(entry.modality).toBe("doubles");
        }
      }
    }
  });
});

describe("seed: plantio na organizacao que o alvo ja usa", () => {
  it("desempata o alvo por id quando o instante e o mesmo", () => {
    const sorted = [
      { id: "b", recencyMs: 10 },
      { id: "a", recencyMs: 10 },
      { id: "c", recencyMs: 20 },
    ].sort((left, right) => comparePendencyTargetRecency({ left, right }));

    expect(sorted.map((row) => row.id)).toEqual(["c", "a", "b"]);
  });

  it("planta os dois status de inscricao que a organizacao deriva", () => {
    // O "aguardando pagamento" tem alvo 2 de proposito: com contagem 1 o item
    // congelado pela dispensa nao volta (o recibo guarda count/severity/prazo).
    expect(PENDENCY_SEED_PRIMARY_ENTRY_TARGETS).toEqual([
      { status: "awaiting_payment", target: 2 },
      { status: "pending_approval", target: 1 },
    ]);
  });

  it("planta o par respeitando o genero da categoria", () => {
    const candidates = [
      { gender: "Masculino", profileId: "p1" },
      { gender: "Feminino", profileId: "p2" },
      { gender: "Feminino", profileId: "p3" },
    ];

    expect(
      selectFreePendencyEntryProfiles({
        candidates,
        gender: "female",
        modality: "doubles",
        occupied: [],
      })
    ).toEqual(["p2", "p3"]);
    expect(
      selectFreePendencyEntryProfiles({
        candidates,
        gender: "mixed",
        modality: "doubles",
        occupied: [],
      })
    ).toEqual(["p1", "p2"]);
    // Sem o par completo o plantio para: o produto recusaria essa inscricao.
    expect(
      selectFreePendencyEntryProfiles({
        candidates,
        gender: "male",
        modality: "doubles",
        occupied: [],
      })
    ).toEqual([]);
    expect(
      selectFreePendencyEntryProfiles({
        candidates,
        gender: "mixed",
        modality: "singles",
        occupied: ["p1"],
      })
    ).toEqual(["p2"]);
  });
});
