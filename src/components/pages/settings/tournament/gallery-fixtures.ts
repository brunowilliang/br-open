import type {
  TournamentEntryWithPlayers,
  TournamentMatch,
} from "@convex/domains/tournament/contract";

/** Papel e fase da célula da vitrine (o vocabulário das telas reais). */
export type GalleryRole = "guest" | "organizer" | "player";
export type GalleryPhase =
  | "cancelled"
  | "closed"
  | "finished"
  | "ongoing"
  | "open";

export const GALLERY_DAY_MS = 24 * 60 * 60 * 1000;

/** Datas RELATIVAS ao relógio: a célula continua certa em qualquer semana. */
export function galleryDayMs(offsetDays: number): number {
  return Date.now() + offsetDays * GALLERY_DAY_MS;
}

export function galleryMatchDate(offsetDays: number): string {
  const date = new Date(galleryDayMs(offsetDays));
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

export const GALLERY_COURT = {
  availability: {
    fri: [],
    mon: [],
    sat: [],
    sun: [],
    thu: [],
    tue: [],
    wed: [],
  },
  id: "gallery-court-1",
  name: "Quadra 1",
};

export type GalleryPlayer = {
  fullName: string;
  nickname: string;
  playerProfileId: string;
  username: string;
};

export const GALLERY_PLAYERS = {
  ana: {
    fullName: "Ana Paula Ribeiro",
    nickname: "ana.ribeiro",
    playerProfileId: "gallery-player-ana",
    username: "ana.ribeiro",
  },
  camila: {
    fullName: "Camila Ferraz",
    nickname: "camila.ferraz",
    playerProfileId: "gallery-player-camila",
    username: "camila.ferraz",
  },
  carlos: {
    fullName: "Carlos Eduardo Pires",
    nickname: "carlos.pires",
    playerProfileId: "gallery-player-carlos",
    username: "carlos.pires",
  },
  diego: {
    fullName: "Diego Nakamura Alves",
    nickname: "diego.nakamura",
    playerProfileId: "gallery-player-diego",
    username: "diego.nakamura",
  },
  gustavo: {
    fullName: "Gustavo Lima",
    nickname: "gustavo.lima",
    playerProfileId: "gallery-player-gustavo",
    username: "gustavo.lima",
  },
  juliana: {
    fullName: "Juliana Prado",
    nickname: "juliana.prado",
    playerProfileId: "gallery-player-juliana",
    username: "juliana.prado",
  },
  marina: {
    fullName: "Marina Costa",
    nickname: "marina.costa",
    playerProfileId: "gallery-player-marina",
    username: "marina.costa",
  },
  pedro: {
    fullName: "Pedro Almeida",
    nickname: "pedro.almeida",
    playerProfileId: "gallery-player-pedro",
    username: "pedro.almeida",
  },
  rafael: {
    fullName: "Rafael de Souza Lima",
    nickname: "rafael.lima",
    playerProfileId: "gallery-player-rafael",
    username: "rafael.lima",
  },
} satisfies Record<string, GalleryPlayer>;

export function buildGalleryEntry(input: {
  categoryKey: "feminino" | "masculino" | "misto";
  cellId: string;
  key: string;
  playerA: GalleryPlayer;
  playerB: null | GalleryPlayer;
  status: TournamentEntryWithPlayers["status"];
}): TournamentEntryWithPlayers {
  const { categoryKey, cellId, key, playerA, playerB, status } = input;

  return {
    categoryId: `${cellId}-cat-${categoryKey}`,
    createdAt: galleryDayMs(-25),
    createdByUserId: null,
    id: `${cellId}-entry-${key}`,
    partnerUserId: null,
    playerA: { avatarUrl: null, ...playerA },
    playerAId: playerA.playerProfileId,
    playerB: playerB ? { avatarUrl: null, ...playerB } : null,
    playerBId: playerB?.playerProfileId ?? null,
    status,
    updatedAt: galleryDayMs(-1),
  };
}

export function buildGalleryMatch(input: {
  categoryKey: "feminino" | "masculino" | "misto";
  cellId: string;
  courtId: null | string;
  endMinute: null | number;
  entryAId: null | string;
  entryBId: null | string;
  key: string;
  matchDate: null | string;
  round: number;
  score: null | TournamentMatch["score"];
  startMinute: null | number;
  status: TournamentMatch["status"];
  winnerEntryId: null | string;
}): TournamentMatch {
  const { categoryKey, cellId, key, ...rest } = input;

  return {
    categoryId: `${cellId}-cat-${categoryKey}`,
    createdAt: galleryDayMs(-25),
    id: `${cellId}-match-${key}`,
    rowVersion: 1,
    scheduledById: null,
    slotInRound: 0,
    updatedAt: galleryDayMs(-1),
    walkover: false,
    ...rest,
  };
}
