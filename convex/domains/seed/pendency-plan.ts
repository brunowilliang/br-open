import type {
  TournamentGender,
  TournamentModality,
} from "../tournament/contract";

// Dado puro do cenario de pendencias que faz a home mostrar os dois escopos:
// `functions/seed.ts` escreve no banco, as regras de leitura vivem no registry.

export type PendencySeedMembershipStatus =
  | "active"
  | "payment_due"
  | "pending"
  | "suspended";

export type PendencySeedLeague = {
  city: string;
  /** Liga com penalidade por inatividade (o caso warning que vira danger). */
  hasInactivityPenalty: boolean;
  inactivityPenaltyDays: number | null;
  /** O schema da liga exige o TIPO junto dos dias, quando a penalidade liga. */
  inactivityPenaltyType: "drop_one_position" | "move_to_ranking_end" | null;
  key: string;
  monthlyPriceCents: number;
  name: string;
  /** Dias ate o vencimento ja pago; so a liga do "a vencer" tem ciclo. */
  paidDaysUntilDue: number | null;
  pendingRequests: number;
  reminderDaysBefore: number;
  state: string;
  /** Status da membership DO USUARIO ALVO — decide a pendencia de mensalidade. */
  viewerMembershipStatus: PendencySeedMembershipStatus;
};

/** Dias desde a ultima partida da liga com penalidade (warning, nao danger). */
export const PENDENCY_SEED_LAST_MATCH_DAYS_AGO = 13;

/**
 * Status DIFERENTES por variante e status e por (liga, jogador): cada variante
 * tem a sua liga. Todas pagas — liga gratuita nao tem ciclo de cobranca.
 */
export const PENDENCY_SEED_LEAGUES: readonly PendencySeedLeague[] = [
  {
    city: "Águas de São Pedro",
    hasInactivityPenalty: false,
    inactivityPenaltyDays: null,
    inactivityPenaltyType: null,
    key: "payment-due",
    monthlyPriceCents: 4500,
    name: "Circuito das Águas",
    paidDaysUntilDue: null,
    pendingRequests: 3,
    reminderDaysBefore: 5,
    state: "SP",
    viewerMembershipStatus: "payment_due",
  },
  {
    city: "São José dos Campos",
    hasInactivityPenalty: true,
    inactivityPenaltyDays: 15,
    inactivityPenaltyType: "drop_one_position",
    key: "due-soon",
    monthlyPriceCents: 3900,
    name: "Copa do Vale",
    paidDaysUntilDue: 2,
    pendingRequests: 0,
    reminderDaysBefore: 5,
    state: "SP",
    viewerMembershipStatus: "active",
  },
  {
    city: "Campos do Jordão",
    hasInactivityPenalty: false,
    inactivityPenaltyDays: null,
    inactivityPenaltyType: null,
    key: "suspended",
    monthlyPriceCents: 2900,
    name: "Liga Serrana",
    paidDaysUntilDue: null,
    pendingRequests: 0,
    reminderDaysBefore: 7,
    state: "SP",
    viewerMembershipStatus: "suspended",
  },
];

export const PENDENCY_SEED_ORGANIZATION_NAME = "Arena Beira-Rio";

export type PendencySeedEntry = {
  /** Indice em `seedPlayers` do outro lado (parceiro, convidante ou inscrito). */
  counterpartIndex: number | null;
  entryFeeCents: number;
  gender: TournamentGender;
  key: string;
  modality: TournamentModality;
  status: "awaiting_payment" | "pending_approval" | "pending_partner";
  /** Lado do USUARIO ALVO (A cria/paga, B responde ao convite) ou null. */
  viewerSide: "A" | "B" | null;
};

export type PendencySeedTournament = {
  city: string;
  entries: readonly PendencySeedEntry[];
  key: string;
  name: string;
  registrationDeadlineDays: number;
  startDateDays: number;
  state: string;
};

/**
 * Duas copas do organizador: uma leva as inscricoes DO usuario (pagamento,
 * convite enviado, aprovacao) e as de OUTROS jogadores; a outra existe para o
 * convite RECEBIDO, que exige o usuario no lado B de uma dupla.
 */
export const PENDENCY_SEED_TOURNAMENTS: readonly PendencySeedTournament[] = [
  {
    city: "São Paulo",
    entries: [
      {
        counterpartIndex: 9,
        entryFeeCents: 3500,
        gender: "mixed",
        key: "entry-awaiting-payment",
        modality: "doubles",
        status: "awaiting_payment",
        viewerSide: "A",
      },
      {
        counterpartIndex: 3,
        entryFeeCents: 3000,
        gender: "male",
        key: "entry-invite-sent",
        modality: "doubles",
        status: "pending_partner",
        viewerSide: "A",
      },
      {
        counterpartIndex: null,
        entryFeeCents: 2500,
        gender: "male",
        key: "entry-awaiting-approval",
        modality: "singles",
        status: "pending_approval",
        viewerSide: "A",
      },
      {
        counterpartIndex: 17,
        entryFeeCents: 2000,
        gender: "female",
        key: "org-entry-approval-1",
        modality: "singles",
        status: "pending_approval",
        viewerSide: null,
      },
      {
        counterpartIndex: 19,
        entryFeeCents: 2000,
        gender: "female",
        key: "org-entry-approval-2",
        modality: "singles",
        status: "pending_approval",
        viewerSide: null,
      },
    ],
    key: "copa-beira-rio",
    name: "Copa Beira-Rio",
    registrationDeadlineDays: 6,
    startDateDays: 10,
    state: "SP",
  },
  {
    city: "Santos",
    entries: [
      {
        counterpartIndex: 16,
        entryFeeCents: 3200,
        gender: "mixed",
        key: "entry-invite-received",
        modality: "doubles",
        status: "pending_partner",
        viewerSide: "B",
      },
    ],
    key: "torneio-do-vale",
    name: "Torneio do Vale",
    registrationDeadlineDays: 8,
    startDateDays: 12,
    state: "SP",
  },
];

export function buildPendencyChargeCorrelationId(input: {
  key: string;
  membershipId: string;
}) {
  return `seed-pendency-${input.key}-${input.membershipId}`;
}

// O seletor do app ativa a PRIMEIRA organizacao da lista, e o cenario acima vive
// numa organizacao PROPRIA: esta cobertura ACRESCENTA dado de teste na
// organizacao que o alvo ja gerencia, sem alterar nada dela.

export const PENDENCY_SEED_PRIMARY_ORGANIZATION_LIMIT = 3;

export const PENDENCY_SEED_PRIMARY_JOIN_REQUEST_LIMIT = 2;

/**
 * O alvo e o TOTAL no torneio (nao um flag): repetir o plantio nao acumula e alvo
 * ja alcancado por dado real nao e duplicado. Dois "aguardando pagamento" de
 * proposito — com contagem 1 um item ja dispensado nao volta.
 */
export const PENDENCY_SEED_PRIMARY_ENTRY_TARGETS = [
  { status: "awaiting_payment", target: 2 },
  { status: "pending_approval", target: 1 },
] as const;

/** Torneio do alvo que ainda aceita inscricao (o mesmo filtro do derivador). */
export const PENDENCY_SEED_PRIMARY_TOURNAMENT_STATUSES = [
  "published",
  "drawn",
  "ongoing",
] as const;

/**
 * `updatedAt`/`createdAt` desc com o id como desempate, sem ele o alvo mudaria
 * entre execucoes e o plantio acumularia dado.
 */
export function comparePendencyTargetRecency(input: {
  left: { id: string; recencyMs: number };
  right: { id: string; recencyMs: number };
}): number {
  if (input.left.recencyMs !== input.right.recencyMs) {
    return input.right.recencyMs - input.left.recencyMs;
  }

  return input.left.id < input.right.id ? -1 : 1;
}

/** Genero do PERFIL que a categoria pede (o produto proibe o par errado). */
export const PENDENCY_SEED_PROFILE_GENDER = {
  female: "Feminino",
  male: "Masculino",
} as const;

export type PendencySeedProfileGender =
  (typeof PENDENCY_SEED_PROFILE_GENDER)[keyof typeof PENDENCY_SEED_PROFILE_GENDER];

/**
 * O alvo tambem OCUPA as inscricoes dele: o genero dele entra no par exigido.
 */
export const PENDENCY_SEED_VIEWER_GENDER: PendencySeedProfileGender =
  PENDENCY_SEED_PROFILE_GENDER.male;

/**
 * Dupla feminina/masculina pede dois perfis daquele genero e a mista um de cada;
 * sem o par completo devolve vazio — nunca planta entrada que o produto recusaria.
 */
export function selectFreePendencyEntryProfiles<T extends string>(input: {
  candidates: readonly { gender: null | string; profileId: T }[];
  gender: TournamentGender;
  modality: TournamentModality;
  occupied: readonly string[];
}): T[] {
  const occupied = new Set(input.occupied);
  const free = input.candidates.filter(
    (candidate) => !occupied.has(candidate.profileId)
  );
  const { gender, modality } = input;

  if (gender === "mixed") {
    if (modality === "singles") {
      const [single] = free;

      return single ? [single.profileId] : [];
    }

    const [first, second] = [
      free.find(
        (candidate) => candidate.gender === PENDENCY_SEED_PROFILE_GENDER.male
      ),
      free.find(
        (candidate) => candidate.gender === PENDENCY_SEED_PROFILE_GENDER.female
      ),
    ];

    return first && second ? [first.profileId, second.profileId] : [];
  }

  const matching = free.filter(
    (candidate) => candidate.gender === PENDENCY_SEED_PROFILE_GENDER[gender]
  );

  if (modality === "singles") {
    const [single] = matching;

    return single ? [single.profileId] : [];
  }

  const pair = matching.slice(0, 2);

  return pair.length === 2 ? pair.map((candidate) => candidate.profileId) : [];
}
