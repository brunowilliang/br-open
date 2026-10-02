import type { TournamentGender } from "../tournament/contract";

// Dado puro do cenario de EXCLUSAO de conta: `functions/seed.ts` escreve no
// banco; a regua que le esse estado vive em `domains/account/*`.

export const ACCOUNT_DELETION_SEED_ORGANIZATION_NAME = "Arena Cenário Exclusão";
export const ACCOUNT_DELETION_SEED_HOUSE_NAME = "Casa do Cenário Exclusão";
export const ACCOUNT_DELETION_SEED_SLUG_PREFIX = "seed-account-deletion";

/** Genero do PERFIL do alvo: rotulo, como no contrato de perfil. */
export const ACCOUNT_DELETION_SEED_VIEWER_GENDER = "Masculino";

export type AccountDeletionSeedCategory = {
  /** Enum do contrato de categoria (`male|female|mixed`), nunca o rotulo. */
  gender: TournamentGender;
  modality: string;
  name: string;
};

export const ACCOUNT_DELETION_SEED_CATEGORIES = {
  doubles: {
    gender: "male",
    modality: "doubles",
    name: "Duplas Masculinas",
  },
  singles: {
    gender: "male",
    modality: "singles",
    name: "Simples Masculino",
  },
} as const satisfies Record<string, AccountDeletionSeedCategory>;

/**
 * Uma peca por classe da regua: `blocker` (torneio a concluir), `draft`
 * (rascunho sem inscricao), `openPix` (PIX aberto a cancelar), `invite`
 * (convite a morrer), `pendingMatch` (W.O. no confirm), `history` (historico
 * jogado vira rotulo) e `refund` (pagamento pago a estornar).
 */
export const ACCOUNT_DELETION_SEED_TOURNAMENTS = {
  blocker: { name: "Exclusão: Torneio a concluir", status: "ongoing" },
  draft: { name: "Exclusão: Rascunho sem inscrição", status: "draft" },
  history: { name: "Exclusão: Histórico jogado", status: "finished" },
  invite: {
    entryFeeCents: 0,
    name: "Exclusão: Convite enviado",
    status: "published",
  },
  openPix: {
    entryFeeCents: 5000,
    name: "Exclusão: PIX em aberto",
    status: "published",
  },
  pendingMatch: { name: "Exclusão: Jogo pendente", status: "ongoing" },
  refund: {
    entryFeeCents: 3000,
    name: "Exclusão: Estorno pendente",
    status: "published",
  },
} as const;

/** Validade do PIX plantado: o cancelamento da exclusao so pega PENDING vivo. */
export const ACCOUNT_DELETION_SEED_PIX_TTL_MS = 24 * 60 * 60 * 1000;
