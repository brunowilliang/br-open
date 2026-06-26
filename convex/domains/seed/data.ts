export const defaultSeedRuleConfig = {
  hasInactivityPenalty: false,
  lossBehavior: "stay_put" as const,
  matchConfig: {
    bestOfSets: 3,
    defaultDurationMinutes: 90,
    finalSetGamesPerSet: 6,
    finalSetHasTieBreak: true,
    finalSetMode: "same_as_previous" as const,
    finalSetMustWinByTwoGames: true,
    finalSetScoringMode: "advantage" as const,
    finalSetSuperTieBreakMustWinByTwo: true,
    finalSetSuperTieBreakPoints: 10,
    finalSetTieBreakAtGamesAll: 6,
    finalSetTieBreakMustWinByTwo: true,
    finalSetTieBreakPoints: 7,
    gamesPerSet: 6,
    hasTieBreak: true,
    scoringMode: "advantage" as const,
    setMustWinByTwoGames: true,
    tieBreakAtGamesAll: 6,
    tieBreakMustWinByTwo: true,
    tieBreakPoints: 7,
  },
  maxActiveChallengesPerPlayer: { enabled: true, value: 1 } as const,
  maxChallengeDistance: { enabled: true, value: 4 } as const,
  maxChallengesPerMonth: { enabled: true, value: 4 } as const,
  newPlayerPlacement: "end_of_ranking" as const,
  responseDeadlineHours: { enabled: true, value: 48 } as const,
  scheduleVisibility: "public" as const,
  walkoverBehavior: "automatic_loss" as const,
  winBehavior: "take_opponent_position" as const,
};

export const seedPlayers = [
  {
    emailLocalPart: "player-01",
    fullName: "Bruno Willian Garcia",
    gender: "Masculino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
    nickname: "Bruninho",
  },
  {
    emailLocalPart: "player-02",
    fullName: "Matheus Oliveira",
    gender: "Masculino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
    nickname: "Teteu",
  },
  {
    emailLocalPart: "player-03",
    fullName: "Joao Pedro Costa",
    gender: "Masculino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
    nickname: "JP",
  },
  {
    emailLocalPart: "player-04",
    fullName: "Lucas Almeida",
    gender: "Masculino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
    nickname: "Luquinhas",
  },
  {
    emailLocalPart: "player-05",
    fullName: "Pedro Henrique",
    gender: "Masculino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
    nickname: "Pedrinho",
  },
  {
    emailLocalPart: "player-06",
    fullName: "Caio Martins",
    gender: "Masculino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
    nickname: "Caio",
  },
  {
    emailLocalPart: "player-07",
    fullName: "Guilherme Costa",
    gender: "Masculino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
    nickname: "Gui",
  },
  {
    emailLocalPart: "player-08",
    fullName: "Rafael Souza",
    gender: "Masculino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
    nickname: "Rafa",
  },
  {
    emailLocalPart: "player-09",
    fullName: "Larissa Gomes",
    gender: "Feminino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
    nickname: "Lari",
  },
  {
    emailLocalPart: "player-10",
    fullName: "Camila Rocha",
    gender: "Feminino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
    nickname: "Cami",
  },
  {
    emailLocalPart: "player-11",
    fullName: "Mariana Silva",
    gender: "Feminino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
    nickname: "Mari",
  },
  {
    emailLocalPart: "player-12",
    fullName: "Fernanda Lima",
    gender: "Feminino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
    nickname: "Nanda",
  },
  {
    emailLocalPart: "player-13",
    fullName: "Thiago Pereira",
    gender: "Masculino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
    nickname: "Thi",
  },
  {
    emailLocalPart: "player-14",
    fullName: "Ricardo Mendes",
    gender: "Masculino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
    nickname: "Rick",
  },
  {
    emailLocalPart: "player-15",
    fullName: "André Castro",
    gender: "Masculino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
    nickname: "Deco",
  },
  {
    emailLocalPart: "player-16",
    fullName: "Renato Faria",
    gender: "Masculino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
    nickname: "Renan",
  },
  {
    emailLocalPart: "player-17",
    fullName: "Aline Barros",
    gender: "Feminino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
    nickname: "Ali",
  },
  {
    emailLocalPart: "player-18",
    fullName: "Patrícia Moura",
    gender: "Feminino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
    nickname: "Paty",
  },
  {
    emailLocalPart: "player-19",
    fullName: "Débora Freitas",
    gender: "Feminino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
    nickname: "Debs",
  },
  {
    emailLocalPart: "player-20",
    fullName: "Juliana Teixeira",
    gender: "Feminino" as const,
    image:
      "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
    nickname: "Ju",
  },
] as const;

export const seedLeagueTemplates = [
  {
    categories: ["Todas", "A", "B"],
    city: "São Paulo",
    description: "Liga pública com ranking pronto e solicitações pendentes.",
    name: "Liga Paulistana",
    state: "SP",
    visibility: "public" as const,
  },
  {
    categories: ["Feminino", "Misto"],
    city: "Campinas",
    description: "Liga pública para testar entrada aprovada e pendente.",
    name: "Liga Campineira",
    state: "SP",
    visibility: "public" as const,
  },
  {
    categories: ["35+", "40+"],
    city: "Rio de Janeiro",
    description: "Liga pública com cenário de solicitação rejeitada.",
    name: "Liga Noturna",
    state: "RJ",
    visibility: "public" as const,
  },
  {
    categories: ["Iniciante", "Intermediário", "Avançado"],
    city: "Belo Horizonte",
    description: "Liga aberta para testar descoberta e novos pedidos.",
    name: "Ranking de Sábado",
    state: "MG",
    visibility: "public" as const,
  },
] as const;
