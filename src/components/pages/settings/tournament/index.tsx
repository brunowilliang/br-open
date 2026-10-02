import type { PendingItem } from "@convex/domains/pendings/contract";
import {
  buildOrganizerAgreementPendings,
  buildOrganizerEntryPendings,
  buildPlayerMatchAgreementPendings,
} from "@convex/domains/tournament/pendings-rules";
import type {
  PlayerMatch,
  TournamentDiscovery,
  TournamentEntryWithPlayers,
  TournamentMatch,
} from "@convex/domains/tournament/contract";
import {
  Calendar03Icon,
  HierarchySquare01Icon,
  MoreVerticalIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Menu, Separator } from "heroui-native";
import { useState } from "react";

import { Page } from "@/components/core/page";
import { GuestOverview } from "@/components/pages/tournaments/guest-overview";
import { OrganizerOverview } from "@/components/pages/tournaments/organizer-overview";
import { PlayerOverview } from "@/components/pages/tournaments/player-overview";
import { HugeIcons } from "@/components/ui/huge-icons";
import {
  JoinFooter,
  type JoinFooterCategory,
  type JoinFooterPartnerOption,
} from "@/components/ui/join-footer";
import { useCRPC } from "@/lib/convex/crpc";
import { formatCurrencyCents } from "@/lib/format/currency";
import { buildCategoryTypeLabel } from "@/lib/tournaments/category-editor-derived";
import {
  buildTournamentDetailsAccess,
  buildTournamentDetailsRole,
} from "@/lib/tournaments/tournament-details-derived";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";
import { TournamentBanner } from "../../tournaments/tournament-banner";
import {
  buildGalleryEntry,
  buildGalleryMatch,
  GALLERY_COURT,
  GALLERY_PLAYERS,
  galleryDayMs,
  galleryMatchDate,
  type GalleryPhase,
  type GalleryRole,
} from "./gallery-fixtures";
import {
  GalleryBracketScreen,
  GalleryEntriesScreen,
  GalleryScheduleScreen,
  type GalleryScreenCell,
  type GalleryScreenName,
} from "./gallery-screens";

/**
 * Vitrine da casa do torneio: o menu troca PAPEL e STATUS e a tela remonta as
 * peças reais com dado de fachada; o mesmo menu abre as telas de Chaveamento,
 * Agenda e Inscrições como stack (mock populado, voltar no header). Este
 * torneio não existe no servidor: as consultas que as peças abrem por conta
 * própria erram contra o id de exemplo e caem no estado de erro que cada uma
 * já trata.
 */

type GalleryView = {
  phase: GalleryPhase;
  role: GalleryRole;
};

const GALLERY_ROLE_ORDER: readonly GalleryRole[] = [
  "guest",
  "player",
  "organizer",
];

const GALLERY_PHASE_ORDER: readonly GalleryPhase[] = [
  "open",
  "closed",
  "ongoing",
  "finished",
  "cancelled",
];

const GALLERY_ROLE_LABELS: Record<GalleryRole, string> = {
  guest: "Visitante",
  organizer: "Organizador",
  player: "Jogador",
};

const GALLERY_PHASE_LABELS: Record<GalleryPhase, string> = {
  cancelled: "Cancelado",
  closed: "Inscrições encerradas",
  finished: "Encerrado",
  ongoing: "Em andamento",
  open: "Inscrições abertas",
};

function isGalleryRole(value: unknown): value is GalleryRole {
  return value === "guest" || value === "organizer" || value === "player";
}

function isGalleryPhase(value: unknown): value is GalleryPhase {
  return (
    value === "cancelled" ||
    value === "closed" ||
    value === "finished" ||
    value === "ongoing" ||
    value === "open"
  );
}

function formatGalleryProposalLabel(input: {
  courtName: string;
  matchDate: string;
  startMinute: number;
}): string {
  const [, month, day] = input.matchDate.split("-");
  const hours = `${Math.floor(input.startMinute / 60)}`.padStart(2, "0");
  const minutes = `${input.startMinute % 60}`.padStart(2, "0");

  return `${day}/${month} às ${hours}:${minutes}, na ${input.courtName}`;
}

const GALLERY_PHASE_FACTS: Record<
  GalleryPhase,
  {
    bracketReleased: boolean;
    deadlineOffsetDays: number;
    endOffsetDays: number;
    startOffsetDays: number;
    status: TournamentDiscovery["status"];
  }
> = {
  cancelled: {
    bracketReleased: true,
    deadlineOffsetDays: -15,
    endOffsetDays: -4,
    startOffsetDays: -5,
    status: "cancelled",
  },
  closed: {
    bracketReleased: false,
    deadlineOffsetDays: -3,
    endOffsetDays: 4,
    startOffsetDays: 3,
    status: "published",
  },
  finished: {
    bracketReleased: true,
    deadlineOffsetDays: -20,
    endOffsetDays: -9,
    startOffsetDays: -10,
    status: "finished",
  },
  ongoing: {
    bracketReleased: true,
    deadlineOffsetDays: -6,
    endOffsetDays: 1,
    startOffsetDays: -1,
    status: "ongoing",
  },
  open: {
    bracketReleased: false,
    deadlineOffsetDays: 10,
    endOffsetDays: 13,
    startOffsetDays: 12,
    status: "published",
  },
};

function buildGalleryEntries(input: {
  cellId: string;
  phase: GalleryPhase;
}): TournamentEntryWithPlayers[] {
  const { cellId, phase } = input;
  const hasBracket =
    phase === "cancelled" || phase === "finished" || phase === "ongoing";
  const anaDiegoStatus: TournamentEntryWithPlayers["status"] =
    phase === "open"
      ? "pending_approval"
      : phase === "closed"
        ? "awaiting_payment"
        : "active";

  const entries = [
    buildGalleryEntry({
      categoryKey: "misto",
      cellId,
      key: "ana-diego",
      playerA: GALLERY_PLAYERS.ana,
      playerB: GALLERY_PLAYERS.diego,
      status: anaDiegoStatus,
    }),
    buildGalleryEntry({
      categoryKey: "misto",
      cellId,
      key: "marina-rafael",
      playerA: GALLERY_PLAYERS.marina,
      playerB: GALLERY_PLAYERS.rafael,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "masculino",
      cellId,
      key: "carlos",
      playerA: GALLERY_PLAYERS.carlos,
      playerB: null,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "masculino",
      cellId,
      key: "pedro",
      playerA: GALLERY_PLAYERS.pedro,
      playerB: null,
      status: "active",
    }),
  ];

  if (hasBracket) {
    entries.push(
      buildGalleryEntry({
        categoryKey: "feminino",
        cellId,
        key: "ana-fem",
        playerA: GALLERY_PLAYERS.ana,
        playerB: null,
        status: "active",
      }),
      buildGalleryEntry({
        categoryKey: "feminino",
        cellId,
        key: "camila-fem",
        playerA: GALLERY_PLAYERS.camila,
        playerB: null,
        status: "active",
      })
    );
  }

  return entries;
}

function buildGalleryMatches(input: {
  cellId: string;
  phase: GalleryPhase;
}): TournamentMatch[] {
  const { cellId, phase } = input;

  if (phase === "open" || phase === "closed") {
    return [];
  }

  const courtId = GALLERY_COURT.id;
  const entryId = (key: string) => `${cellId}-entry-${key}`;
  const mistoEntryIds = {
    entryAId: entryId("ana-diego"),
    entryBId: entryId("marina-rafael"),
  };
  const femEntryIds = {
    entryAId: entryId("ana-fem"),
    entryBId: entryId("camila-fem"),
  };
  const mascEntryIds = {
    entryAId: entryId("carlos"),
    entryBId: entryId("pedro"),
  };

  if (phase === "ongoing") {
    return [
      buildGalleryMatch({
        ...mistoEntryIds,
        categoryKey: "misto",
        cellId,
        courtId,
        endMinute: 600,
        key: "misto",
        matchDate: galleryMatchDate(0),
        round: 1,
        score: null,
        startMinute: 540,
        status: "scheduled",
        winnerEntryId: null,
      }),
      buildGalleryMatch({
        ...femEntryIds,
        categoryKey: "feminino",
        cellId,
        courtId: null,
        endMinute: null,
        key: "fem",
        matchDate: null,
        round: 1,
        score: null,
        startMinute: null,
        status: "pending",
        winnerEntryId: null,
      }),
      buildGalleryMatch({
        ...mascEntryIds,
        categoryKey: "masculino",
        cellId,
        courtId,
        endMinute: 600,
        key: "masc",
        matchDate: galleryMatchDate(-1),
        round: 1,
        score: {
          sets: [
            { aGames: 6, bGames: 4, kind: "set" },
            { aGames: 6, bGames: 3, kind: "set" },
          ],
          winnerEntryId: entryId("carlos"),
        },
        startMinute: 540,
        status: "finished",
        winnerEntryId: entryId("carlos"),
      }),
      // Finais esperando os vencedores das semis: os lados a definir as deixam
      // fora da fila do jogador; a chave com duas rodadas é quem nomeia o estágio.
      buildGalleryMatch({
        categoryKey: "misto",
        cellId,
        courtId: null,
        endMinute: null,
        entryAId: null,
        entryBId: null,
        key: "misto-final",
        matchDate: null,
        round: 2,
        score: null,
        startMinute: null,
        status: "pending",
        winnerEntryId: null,
      }),
      buildGalleryMatch({
        categoryKey: "feminino",
        cellId,
        courtId: null,
        endMinute: null,
        entryAId: null,
        entryBId: null,
        key: "fem-final",
        matchDate: null,
        round: 2,
        score: null,
        startMinute: null,
        status: "pending",
        winnerEntryId: null,
      }),
      buildGalleryMatch({
        categoryKey: "masculino",
        cellId,
        courtId: null,
        endMinute: null,
        entryAId: null,
        entryBId: null,
        key: "masc-final",
        matchDate: null,
        round: 2,
        score: null,
        startMinute: null,
        status: "pending",
        winnerEntryId: null,
      }),
    ];
  }

  if (phase === "finished") {
    return [
      buildGalleryMatch({
        ...mistoEntryIds,
        categoryKey: "misto",
        cellId,
        courtId,
        endMinute: 600,
        key: "misto",
        matchDate: galleryMatchDate(-9),
        round: 1,
        score: {
          sets: [
            { aGames: 6, bGames: 3, kind: "set" },
            { aGames: 6, bGames: 4, kind: "set" },
          ],
          winnerEntryId: entryId("ana-diego"),
        },
        startMinute: 540,
        status: "finished",
        winnerEntryId: entryId("ana-diego"),
      }),
      buildGalleryMatch({
        ...femEntryIds,
        categoryKey: "feminino",
        cellId,
        courtId,
        endMinute: 540,
        key: "fem",
        matchDate: galleryMatchDate(-9),
        round: 1,
        score: {
          sets: [
            { aGames: 5, bGames: 7, kind: "set" },
            { aGames: 4, bGames: 6, kind: "set" },
          ],
          winnerEntryId: entryId("camila-fem"),
        },
        startMinute: 480,
        status: "finished",
        winnerEntryId: entryId("camila-fem"),
      }),
      buildGalleryMatch({
        ...mascEntryIds,
        categoryKey: "masculino",
        cellId,
        courtId,
        endMinute: 600,
        key: "masc",
        matchDate: galleryMatchDate(-10),
        round: 1,
        score: {
          sets: [
            { aGames: 6, bGames: 4, kind: "set" },
            { aGames: 6, bGames: 2, kind: "set" },
          ],
          winnerEntryId: entryId("carlos"),
        },
        startMinute: 540,
        status: "finished",
        winnerEntryId: entryId("carlos"),
      }),
    ];
  }

  // Cancelado no meio: um confronto do viewer sem data e um já jogado.
  return [
    buildGalleryMatch({
      ...mistoEntryIds,
      categoryKey: "misto",
      cellId,
      courtId: null,
      endMinute: null,
      key: "misto",
      matchDate: null,
      round: 1,
      score: null,
      startMinute: null,
      status: "pending",
      winnerEntryId: null,
    }),
    buildGalleryMatch({
      ...femEntryIds,
      categoryKey: "feminino",
      cellId,
      courtId: null,
      endMinute: null,
      key: "fem",
      matchDate: null,
      round: 1,
      score: null,
      startMinute: null,
      status: "pending",
      winnerEntryId: null,
    }),
    buildGalleryMatch({
      ...mascEntryIds,
      categoryKey: "masculino",
      cellId,
      courtId,
      endMinute: 600,
      key: "masc",
      matchDate: galleryMatchDate(-6),
      round: 1,
      score: {
        sets: [
          { aGames: 6, bGames: 4, kind: "set" },
          { aGames: 6, bGames: 2, kind: "set" },
        ],
        winnerEntryId: entryId("carlos"),
      },
      startMinute: 540,
      status: "finished",
      winnerEntryId: entryId("carlos"),
    }),
  ];
}

const GALLERY_FEM_PROPOSAL_START_MINUTE = 480;

// A MESMA proposta para o card do painel e para a pendência: coerência vem da
// fonte única, não de dois literais iguais.
const GALLERY_FEM_PROPOSAL = {
  courtId: GALLERY_COURT.id,
  endMinute: GALLERY_FEM_PROPOSAL_START_MINUTE + 60,
  matchDate: galleryMatchDate(3),
  startMinute: GALLERY_FEM_PROPOSAL_START_MINUTE,
};

function buildGalleryPlayerMatches(input: {
  cellId: string;
  matches: TournamentMatch[];
  phase: GalleryPhase;
}): PlayerMatch[] {
  const { cellId, matches, phase } = input;

  if (phase !== "ongoing") {
    return [];
  }

  const misto = matches.find((match) => match.id === `${cellId}-match-misto`);
  const fem = matches.find((match) => match.id === `${cellId}-match-fem`);

  if (!(fem && misto)) {
    return [];
  }

  const idleChannel = {
    agreedAt: null,
    proposal: null,
    proposedAt: null,
    proposedByMe: false,
    proposedBySide: null,
    state: "idle" as const,
  };

  return [
    {
      agreements: {
        matchId: misto.id,
        schedule: {
          agreedAt: galleryDayMs(-1),
          proposal: {
            courtId: GALLERY_COURT.id,
            endMinute: 600,
            matchDate: galleryMatchDate(0),
            startMinute: 540,
          },
          proposedAt: galleryDayMs(-2),
          proposedByMe: true,
          proposedBySide: "a",
          state: "agreed",
        },
        score: { ...idleChannel },
      },
      match: misto,
      mySide: "a",
      totalRounds: 2,
    },
    {
      agreements: {
        matchId: fem.id,
        schedule: {
          agreedAt: null,
          proposal: { ...GALLERY_FEM_PROPOSAL },
          proposedAt: galleryDayMs(-1),
          proposedByMe: false,
          proposedBySide: "b",
          state: "negotiating",
        },
        score: { ...idleChannel },
      },
      match: fem,
      mySide: "a",
      totalRounds: 2,
    },
  ];
}

function buildGalleryPendings(input: {
  cellId: string;
  matches: TournamentMatch[];
  phase: GalleryPhase;
  role: GalleryRole;
  tournament: TournamentDiscovery;
}): PendingItem[] {
  const { cellId, matches, phase, role, tournament } = input;

  if (role === "guest") {
    return [];
  }

  if (role === "player") {
    if (phase === "ongoing") {
      const fem = matches.find((match) => match.id === `${cellId}-match-fem`);

      if (!fem) {
        return [];
      }

      return buildPlayerMatchAgreementPendings({
        matches: [
          {
            channel: "schedule",
            matchId: fem.id,
            opponentName: "Camila Ferraz",
            proposalLabel: formatGalleryProposalLabel({
              courtName: GALLERY_COURT.name,
              matchDate: GALLERY_FEM_PROPOSAL.matchDate,
              startMinute: GALLERY_FEM_PROPOSAL.startMinute,
            }),
            proposedAt: galleryDayMs(-1),
            proposerName: "Camila Ferraz",
            reopened: false,
            tournamentId: cellId,
            tournamentName: tournament.name,
          },
        ],
      });
    }

    return [];
  }

  if (phase === "open" || phase === "closed") {
    return buildOrganizerEntryPendings({
      tournaments: [
        {
          awaitingApprovalCount: 1,
          awaitingPaymentCount: phase === "closed" ? 1 : 0,
          awaitingPaymentFeeCents: phase === "closed" ? 4000 : 0,
          registrationDeadlineAtMs: tournament.registrationDeadlineAt,
          tournamentId: cellId,
          tournamentName: tournament.name,
        },
      ],
    });
  }

  if (phase === "ongoing") {
    const fem = matches.find((match) => match.id === `${cellId}-match-fem`);

    if (!fem) {
      return [];
    }

    return buildOrganizerAgreementPendings({
      tournaments: [
        {
          proposals: [
            {
              channel: "schedule",
              matchId: fem.id,
              proposedAt: galleryDayMs(-1),
            },
          ],
          stalledMatchCount: 1,
          tournamentId: cellId,
          tournamentName: tournament.name,
        },
      ],
    });
  }

  return [];
}

const GALLERY_VACANCY_LABELS: Record<string, string> = {
  feminino: "0/8 vagas",
  masculino: "2/16 vagas",
  misto: "1/8 vagas",
};

function buildGalleryJoinCategories(input: {
  categories: TournamentDiscovery["categories"];
  role: GalleryRole;
}): JoinFooterCategory[] {
  const { categories, role } = input;

  const toItem = (
    key: string,
    options?: {
      ineligibleReason?: string;
      isFull?: boolean;
      vacancyLabel?: string;
    }
  ) => {
    const category = categories.find((item) => item.id.endsWith(`-cat-${key}`));

    if (!category) {
      return null;
    }

    const ineligibleReason = options?.ineligibleReason;

    return {
      displayName: category.name,
      id: category.id,
      ineligibleReason: ineligibleReason ?? null,
      isFull: options?.isFull ?? false,
      isIneligible: Boolean(ineligibleReason),
      modality: category.modality,
      priceLabel: formatCurrencyCents(category.entryFeeCents),
      typeLabel: buildCategoryTypeLabel(category.modality, category.gender),
      vacancyLabel:
        options?.vacancyLabel ?? GALLERY_VACANCY_LABELS[key] ?? null,
    } satisfies JoinFooterCategory;
  };

  // O jogador vê os DOIS estados no seletor: Misto com vaga (livre), Feminino
  // lotado e Masculino inelegível com o motivo.
  const items =
    role === "player"
      ? [
          toItem("misto"),
          toItem("feminino", { isFull: true, vacancyLabel: "8/8 vagas" }),
          toItem("masculino", { ineligibleReason: "Homens" }),
        ]
      : [toItem("misto"), toItem("masculino"), toItem("feminino")];

  return items.filter((item) => item !== null);
}

const GALLERY_JOIN_PARTNER_OPTIONS: JoinFooterPartnerOption[] = [
  { fullName: "Diego Nakamura Alves", username: "diego.nakamura" },
  { fullName: "Gustavo Lima", username: "gustavo.lima" },
  { fullName: "Marina Costa", username: "marina.costa" },
  { fullName: "Rafael de Souza Lima", username: "rafael.lima" },
  { fullName: "Camila Ferraz", username: "camila.ferraz" },
];

function buildGalleryCategories(input: {
  cellId: string;
  viewerIsPlayer: boolean;
}) {
  const { cellId, viewerIsPlayer } = input;

  return [
    {
      entryFeeCents: 4000,
      gender: "mixed",
      id: `${cellId}-cat-misto`,
      maxEntries: 8,
      modality: "doubles",
      name: "Misto",
      tournamentId: cellId,
      viewerEligible: viewerIsPlayer ? true : null,
      viewerIneligibleReason: null,
    },
    {
      entryFeeCents: 3000,
      gender: "male",
      id: `${cellId}-cat-masculino`,
      maxEntries: 16,
      modality: "singles",
      name: "Masculino",
      tournamentId: cellId,
      viewerEligible: viewerIsPlayer ? false : null,
      viewerIneligibleReason: viewerIsPlayer ? "Homens" : null,
    },
    {
      entryFeeCents: 3000,
      gender: "female",
      id: `${cellId}-cat-feminino`,
      maxEntries: 8,
      modality: "singles",
      name: "Feminino",
      tournamentId: cellId,
      viewerEligible: viewerIsPlayer ? true : null,
      viewerIneligibleReason: null,
    },
  ] satisfies TournamentDiscovery["categories"];
}

function buildGalleryViewerEntryIds(input: {
  cellId: string;
  phase: GalleryPhase;
  role: GalleryRole;
}): string[] {
  const { cellId, phase, role } = input;

  if (role !== "player") {
    return [];
  }

  const viewerEntryIds = [`${cellId}-entry-ana-diego`];

  if (phase === "cancelled" || phase === "finished" || phase === "ongoing") {
    viewerEntryIds.push(`${cellId}-entry-ana-fem`);
  }

  return viewerEntryIds;
}

function buildGalleryTournament(input: {
  cellId: string;
  entries: TournamentEntryWithPlayers[];
  phase: GalleryPhase;
  role: GalleryRole;
  viewerEntryIds: string[];
}): TournamentDiscovery {
  const { cellId, entries, phase, role, viewerEntryIds } = input;
  const facts = GALLERY_PHASE_FACTS[phase];

  return {
    activeEntryCount: entries.filter((entry) => entry.status === "active")
      .length,
    allowMultipleEntriesPerType: true,
    approvalMode: "manual",
    avatarStorageId: null,
    avatarUrl: null,
    bracketReleaseAt: facts.bracketReleased
      ? null
      : galleryDayMs(facts.startOffsetDays - 1),
    bracketReleased: facts.bracketReleased,
    categories: buildGalleryCategories({
      cellId,
      viewerIsPlayer: role === "player",
    }),
    city: "São Paulo",
    courts: [GALLERY_COURT],
    coverStorageId: null,
    coverUrl: null,
    createdAt: galleryDayMs(-30),
    description:
      "Encontros de primavera do clube: duplas mistas, simples masculino e feminino.",
    endDate: galleryDayMs(facts.endOffsetDays),
    id: cellId,
    isTournamentOrganizer: role === "organizer",
    locationNotes: null,
    matchConfig: {
      bestOfSets: 3,
      defaultDurationMinutes: 60,
      gamesPerSet: 6,
      hasTieBreak: true,
      scoringMode: "advantage",
      setMustWinByTwoGames: true,
      tieBreakMustWinByTwo: true,
      tieBreakPoints: 7,
    },
    name: "Torneio de Primavera do Clube",
    registrationDeadlineAt: galleryDayMs(facts.deadlineOffsetDays),
    startDate: galleryDayMs(facts.startOffsetDays),
    state: "SP",
    status: facts.status,
    updatedAt: galleryDayMs(-1),
    viewerEntryIds,
    visibility: "public",
  };
}

type GalleryCell = {
  canOpenBracket: boolean;
  canOpenSchedule: boolean;
  entries: TournamentEntryWithPlayers[];
  id: string;
  joinCategories: JoinFooterCategory[];
  matches: TournamentMatch[];
  pendings: PendingItem[];
  phase: GalleryPhase;
  playerMatches: PlayerMatch[];
  role: GalleryRole;
  showJoinFooter: boolean;
  tournament: TournamentDiscovery;
};

function buildGalleryCell(input: GalleryView): GalleryCell {
  const { phase, role } = input;
  const id = `gallery-${role}-${phase}`;
  const entries = buildGalleryEntries({ cellId: id, phase });
  const matches = buildGalleryMatches({ cellId: id, phase });
  const viewerEntryIds = buildGalleryViewerEntryIds({
    cellId: id,
    phase,
    role,
  });
  const tournament = buildGalleryTournament({
    cellId: id,
    entries,
    phase,
    role,
    viewerEntryIds,
  });
  const playerMatches = buildGalleryPlayerMatches({
    cellId: id,
    matches,
    phase,
  });
  const pendings = buildGalleryPendings({
    cellId: id,
    matches,
    phase,
    role,
    tournament,
  });
  const detailsRole = buildTournamentDetailsRole({
    isTournamentOrganizer: role === "organizer",
    viewerEntryIds,
  });
  // O MESMO acesso do app: Chave e Agenda a partir da divulgação (ou sempre,
  // para o organizador); Inscrições sempre.
  const access = buildTournamentDetailsAccess({
    bracketReleased: tournament.bracketReleased,
    role: detailsRole,
  });

  return {
    canOpenBracket: access.canOpenBracket,
    canOpenSchedule: access.canOpenSchedule,
    entries,
    id,
    joinCategories: buildGalleryJoinCategories({
      categories: tournament.categories,
      role,
    }),
    matches,
    pendings,
    phase,
    playerMatches,
    role,
    showJoinFooter: phase === "open" && role !== "organizer",
    tournament,
  };
}

/**
 * Um bucket por célula (id de fachada) e a porta do acerto semeada no cache:
 * as peças reais leem daqui, como leem do servidor na casa de verdade.
 */
function seedGalleryCells(input: {
  listMyMatchesQueryKey: (tournamentId: string) => QueryKey;
  queryClient: QueryClient;
}) {
  for (const role of GALLERY_ROLE_ORDER) {
    for (const phase of GALLERY_PHASE_ORDER) {
      const cell = buildGalleryCell({ phase, role });
      const bucket$ = getTournamentDetailsBucket$(cell.id);

      bucket$.actions.hydrateDiscovery(cell.tournament, Date.now());
      bucket$.actions.hydrateEntries(cell.entries);
      bucket$.actions.hydrateMatches(cell.matches);
      bucket$.actions.hydratePendings({
        items: cell.pendings,
        status: "ready",
      });
      // A célula é o "servidor" da vitrine: os estados de carregamento fecham
      // aqui, senão um `entriesLoading` preso esconde os KPIs do jogador.
      bucket$.actions.setEntriesLoading(false);
      bucket$.actions.setMatchesLoading(false);

      if (cell.role === "player") {
        input.queryClient.setQueryData(
          input.listMyMatchesQueryKey(cell.id),
          cell.playerMatches
        );
      }
    }
  }
}

/**
 * Menu da tela: os grupos Papel e Status trocam a página inteira e o bloco
 * Telas abre os mocks de Chaveamento/Agenda/Inscrições como stack, com o
 * MESMO acesso por célula do app (Chave/Agenda a partir da divulgação;
 * Inscrições sempre).
 */
function GalleryScreenMenu(props: {
  canOpenBracket: boolean;
  canOpenSchedule: boolean;
  onPhaseChange: (phase: GalleryPhase) => void;
  onRoleChange: (role: GalleryRole) => void;
  onScreenChange: (screen: GalleryScreenName) => void;
  phase: GalleryPhase;
  role: GalleryRole;
}) {
  const {
    canOpenBracket,
    canOpenSchedule,
    onPhaseChange,
    onRoleChange,
    onScreenChange,
    phase,
    role,
  } = props;

  return (
    <Menu>
      <Menu.Trigger asChild>
        <Button isIconOnly size="sm" variant="secondary">
          <HugeIcons icon={MoreVerticalIcon} />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Overlay className="bg-backdrop" />
        <Menu.Content presentation="popover" width={240}>
          <Menu.Label>Papel</Menu.Label>
          <Menu.Group
            onSelectionChange={(keys) => {
              const [nextRole] = [...keys];

              if (isGalleryRole(nextRole)) {
                onRoleChange(nextRole);
              }
            }}
            selectedKeys={new Set([role])}
            selectionMode="single"
          >
            {GALLERY_ROLE_ORDER.map((value) => (
              <Menu.Item id={value} key={value}>
                <Menu.ItemIndicator />
                <Menu.ItemTitle>{GALLERY_ROLE_LABELS[value]}</Menu.ItemTitle>
              </Menu.Item>
            ))}
          </Menu.Group>

          <Separator className="mx-2 my-2 opacity-75" />
          <Menu.Label>Status do torneio</Menu.Label>
          <Menu.Group
            onSelectionChange={(keys) => {
              const [nextPhase] = [...keys];

              if (isGalleryPhase(nextPhase)) {
                onPhaseChange(nextPhase);
              }
            }}
            selectedKeys={new Set([phase])}
            selectionMode="single"
          >
            {GALLERY_PHASE_ORDER.map((value) => (
              <Menu.Item id={value} key={value}>
                <Menu.ItemIndicator />
                <Menu.ItemTitle>{GALLERY_PHASE_LABELS[value]}</Menu.ItemTitle>
              </Menu.Item>
            ))}
          </Menu.Group>

          <Separator className="mx-2 my-2 opacity-75" />
          <Menu.Label>Telas</Menu.Label>
          {canOpenBracket ? (
            <Menu.Item
              onPress={() => {
                onScreenChange("bracket");
              }}
            >
              <Menu.ItemTitle>Chaveamento</Menu.ItemTitle>
              <HugeIcons icon={HierarchySquare01Icon} />
            </Menu.Item>
          ) : null}
          {canOpenSchedule ? (
            <Menu.Item
              onPress={() => {
                onScreenChange("schedule");
              }}
            >
              <Menu.ItemTitle>Agenda</Menu.ItemTitle>
              <HugeIcons icon={Calendar03Icon} />
            </Menu.Item>
          ) : null}
          <Menu.Item
            onPress={() => {
              onScreenChange("entries");
            }}
          >
            <Menu.ItemTitle>Inscrições</Menu.ItemTitle>
            <HugeIcons icon={UserMultipleIcon} />
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}

/** Casa do torneio na tela inteira, com a composição real; a troca de papel e
 * status e a abertura das telas vivem no menu, e o resto da tela é vitrine sem
 * ação real. */
export function TournamentVariantsSection() {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  // Semente em RENDER, antes dos filhos montarem: o bucket e o cache da porta
  // do acerto têm de estar prontos quando os hooks reais da casa lerem (com o
  // dado fresco no cache, `staleTime` infinito + `refetchOnMount` desligado
  // seguram a busca contra o id de fachada).
  useState(() => {
    seedGalleryCells({
      listMyMatchesQueryKey: (tournamentId) =>
        crpc.tournament.agreements.listMyMatches.staticQueryOptions({
          tournamentId,
        }).queryKey,
      queryClient,
    });

    return null;
  });
  const [view, setView] = useState<GalleryView>({
    phase: "open",
    role: "guest",
  });
  const [screen, setScreen] = useState<null | GalleryScreenName>(null);
  const cell = buildGalleryCell(view);

  if (screen !== null) {
    const screenCell: GalleryScreenCell = {
      categories: cell.tournament.categories,
      cellId: cell.id,
      courts: cell.tournament.courts,
      role: cell.role,
    };
    const closeScreen = () => {
      setScreen(null);
    };

    if (screen === "bracket") {
      return <GalleryBracketScreen cell={screenCell} onBack={closeScreen} />;
    }

    if (screen === "schedule") {
      return <GalleryScheduleScreen cell={screenCell} onBack={closeScreen} />;
    }

    return <GalleryEntriesScreen cell={screenCell} onBack={closeScreen} />;
  }

  return (
    <Page>
      <Page.Header overlay>
        <Page.Header.Left>
          <Page.Header.BackButton variant="secondary" />
        </Page.Header.Left>
        <Page.Header.Center />
        <Page.Header.Right>
          <GalleryScreenMenu
            canOpenBracket={cell.canOpenBracket}
            canOpenSchedule={cell.canOpenSchedule}
            onPhaseChange={(phase) => {
              setView((previous) => ({ ...previous, phase }));
            }}
            onRoleChange={(role) => {
              setView((previous) => ({ ...previous, role }));
            }}
            onScreenChange={setScreen}
            phase={view.phase}
            role={view.role}
          />
        </Page.Header.Right>
      </Page.Header>

      <Page.ScrollView
        contentContainerClassName="grow pb-safe-offset-4"
        key={cell.id}
      >
        <TournamentBanner tournament={cell.tournament} />
        {cell.role === "guest" && (
          <GuestOverview tournament={cell.tournament} />
        )}
        {cell.role === "player" && (
          <PlayerOverview tournament={cell.tournament} />
        )}
        {cell.role === "organizer" && (
          <OrganizerOverview tournamentId={cell.id} />
        )}
      </Page.ScrollView>

      {/* Rodapé de inscrição como o JoinBlock real monta: vitrine local, sem
          mutation (o fluxo de create/charge/checkout não entra aqui). */}
      {cell.showJoinFooter ? (
        <JoinFooter
          actionLabel={
            cell.role === "player" ? "Nova inscrição" : "Inscrever-se"
          }
          categories={cell.joinCategories}
          confirmLabel="Inscrever-se"
          description="Selecione a sua categoria"
          footerClassName="pb-safe-offset-4"
          partnerOptions={GALLERY_JOIN_PARTNER_OPTIONS}
          price={{
            amount: formatCurrencyCents(3000),
            prefix: "a partir de",
            suffix: "/jogador",
          }}
          title="Inscreva-se"
        />
      ) : null}
    </Page>
  );
}
