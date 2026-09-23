import {
  PLAYER_GENDER_FEMALE,
  PLAYER_GENDER_MALE,
  type TournamentGender,
} from "../tournament/contract";

// Dado puro do plantio de duplas que faz o organizador conferir o fluxo no app:
// `functions/seed.ts` escreve no banco, a escolha dos pares vive aqui.

export type DoublesSeedProfile = {
  emailLocalPart: string;
  fullName: string;
  gender: typeof PLAYER_GENDER_MALE | typeof PLAYER_GENDER_FEMALE;
  image: string;
  nickname: string;
  /** O convite de dupla e por username: perfil sem ele nao acha nem e achado. */
  username: string;
};

export const DOUBLES_SEED_TOURNAMENT = {
  city: "São Paulo",
  name: "SEED · Torneio de Duplas",
  registrationDeadlineDays: 14,
  startDateDays: 21,
  state: "SP",
} as const;

/** So as duas categorias do pedido: sem misto e sem simples. */
export const DOUBLES_SEED_CATEGORIES = [
  { gender: "male" },
  { gender: "female" },
] as const;

/** Inscricao gratuita: o fluxo de duplas nao passa por checkout. */
export const DOUBLES_SEED_ENTRY_FEE_CENTS = 0;

export const DOUBLES_SEED_MAX_ENTRIES = 16;

/** Duplas CONFIRMADAS por categoria, mais uma com o convite ainda pendente. */
export const DOUBLES_SEED_ACTIVE_PAIRS = 3;
export const DOUBLES_SEED_INVITE_PAIRS = 1;

const AVATAR_BLUE =
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg";
const AVATAR_GREEN =
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg";

/**
 * Elenco PROPRIO do plantio: os `seedPlayers` ja tem vaga ocupada nos cenarios
 * anteriores, e o par de cada categoria precisa de perfil do genero exato.
 */
export const DOUBLES_SEED_PROFILES: readonly DoublesSeedProfile[] = [
  {
    emailLocalPart: "doubles-m-01",
    fullName: "Rafael Salles",
    gender: PLAYER_GENDER_MALE,
    image: AVATAR_BLUE,
    nickname: "Rafa",
    username: "rafaelsalles",
  },
  {
    emailLocalPart: "doubles-m-02",
    fullName: "Diego Barros",
    gender: PLAYER_GENDER_MALE,
    image: AVATAR_GREEN,
    nickname: "Dieguinho",
    username: "diegobarros",
  },
  {
    emailLocalPart: "doubles-m-03",
    fullName: "Bruno Tavares",
    gender: PLAYER_GENDER_MALE,
    image: AVATAR_BLUE,
    nickname: "Brunao",
    username: "brunotavares",
  },
  {
    emailLocalPart: "doubles-m-04",
    fullName: "Vitor Hugo Menezes",
    gender: PLAYER_GENDER_MALE,
    image: AVATAR_GREEN,
    nickname: "Vitu",
    username: "vitormenezes",
  },
  {
    emailLocalPart: "doubles-m-05",
    fullName: "Leandro Pacini",
    gender: PLAYER_GENDER_MALE,
    image: AVATAR_BLUE,
    nickname: "Leo",
    username: "leandropacini",
  },
  {
    emailLocalPart: "doubles-m-06",
    fullName: "Marcelo Vidigal",
    gender: PLAYER_GENDER_MALE,
    image: AVATAR_GREEN,
    nickname: "Marcelinho",
    username: "marcelovidigal",
  },
  {
    emailLocalPart: "doubles-m-07",
    fullName: "Gustavo Pires",
    gender: PLAYER_GENDER_MALE,
    image: AVATAR_BLUE,
    nickname: "Gugu",
    username: "gustavopires",
  },
  {
    emailLocalPart: "doubles-m-08",
    fullName: "Henrique Sales",
    gender: PLAYER_GENDER_MALE,
    image: AVATAR_GREEN,
    nickname: "Rique",
    username: "henriquesales",
  },
  {
    emailLocalPart: "doubles-m-09",
    fullName: "Fabio Camargo",
    gender: PLAYER_GENDER_MALE,
    image: AVATAR_BLUE,
    nickname: "Fabinho",
    username: "fabiocamargo",
  },
  {
    emailLocalPart: "doubles-m-10",
    fullName: "Sergio Bastos",
    gender: PLAYER_GENDER_MALE,
    image: AVATAR_GREEN,
    nickname: "Serginho",
    username: "sergiobastos",
  },
  {
    emailLocalPart: "doubles-f-01",
    fullName: "Amanda Ribeiro",
    gender: PLAYER_GENDER_FEMALE,
    image: AVATAR_GREEN,
    nickname: "Mandy",
    username: "amandaribeiro",
  },
  {
    emailLocalPart: "doubles-f-02",
    fullName: "Beatriz Lopes",
    gender: PLAYER_GENDER_FEMALE,
    image: AVATAR_BLUE,
    nickname: "Bia",
    username: "beatrizlopes",
  },
  {
    emailLocalPart: "doubles-f-03",
    fullName: "Clarice Nunes",
    gender: PLAYER_GENDER_FEMALE,
    image: AVATAR_GREEN,
    nickname: "Cacau",
    username: "claricenunes",
  },
  {
    emailLocalPart: "doubles-f-04",
    fullName: "Daniela Freitas",
    gender: PLAYER_GENDER_FEMALE,
    image: AVATAR_BLUE,
    nickname: "Dani",
    username: "danielafreitas",
  },
  {
    emailLocalPart: "doubles-f-05",
    fullName: "Elisa Monteiro",
    gender: PLAYER_GENDER_FEMALE,
    image: AVATAR_GREEN,
    nickname: "Lili",
    username: "elisamonteiro",
  },
  {
    emailLocalPart: "doubles-f-06",
    fullName: "Fernanda Aguiar",
    gender: PLAYER_GENDER_FEMALE,
    image: AVATAR_BLUE,
    nickname: "Fefa",
    username: "fernandaaguiar",
  },
  {
    emailLocalPart: "doubles-f-07",
    fullName: "Gabriela Prado",
    gender: PLAYER_GENDER_FEMALE,
    image: AVATAR_GREEN,
    nickname: "Gabi",
    username: "gabrielaprado",
  },
  {
    emailLocalPart: "doubles-f-08",
    fullName: "Helena Vasques",
    gender: PLAYER_GENDER_FEMALE,
    image: AVATAR_BLUE,
    nickname: "Leninha",
    username: "helenavasques",
  },
  {
    emailLocalPart: "doubles-f-09",
    fullName: "Isabela Rocha",
    gender: PLAYER_GENDER_FEMALE,
    image: AVATAR_GREEN,
    nickname: "Bela",
    username: "isabelarocha",
  },
  {
    emailLocalPart: "doubles-f-10",
    fullName: "Juliana Terra",
    gender: PLAYER_GENDER_FEMALE,
    image: AVATAR_BLUE,
    nickname: "Ju",
    username: "julianaterra",
  },
];

/** Genero do PERFIL que a categoria pede; `mixed` nao tem par de elenco aqui. */
const PROFILE_GENDER_BY_CATEGORY: Record<
  string,
  DoublesSeedProfile["gender"] | undefined
> = {
  female: PLAYER_GENDER_FEMALE,
  male: PLAYER_GENDER_MALE,
};

/**
 * Pares do genero da categoria com vagas livres, sem repetir perfil (nem dentro
 * do proprio lote). Devolve menos pares que o pedido quando o elenco livre
 * acaba: melhor menos duplas do que uma dupla que o create recusaria.
 */
export function selectDoublesSeedPairs<T extends string>(input: {
  candidates: readonly { gender: null | string; profileId: T }[];
  gender: TournamentGender;
  occupied: readonly string[];
  pairCount: number;
}): T[][] {
  const required = PROFILE_GENDER_BY_CATEGORY[input.gender];

  if (!required || input.pairCount < 1) {
    return [];
  }

  const occupied = new Set(input.occupied);
  const free = input.candidates.filter(
    (candidate) =>
      candidate.gender === required && !occupied.has(candidate.profileId)
  );
  const pairs: T[][] = [];

  for (let index = 0; index + 1 < free.length; index += 2) {
    if (pairs.length >= input.pairCount) {
      break;
    }

    pairs.push([free[index]!.profileId, free[index + 1]!.profileId]);
  }

  return pairs;
}
