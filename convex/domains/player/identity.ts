const PLAYER_NAME_FALLBACK = "Jogador";
const PLAYER_IDENTIFIER_LENGTH = 4;
const PLAYER_IDENTIFIER_MOD = 10 ** PLAYER_IDENTIFIER_LENGTH;

function buildPlayerIdentifier(userId: string) {
  let hash = 0;

  for (const character of userId) {
    hash = (hash * 31 + character.charCodeAt(0)) % PLAYER_IDENTIFIER_MOD;
  }

  return String(hash).padStart(PLAYER_IDENTIFIER_LENGTH, "0");
}

export function buildPlayerDisplayName(input: {
  name?: null | string;
  userId?: null | string;
}) {
  const trimmedName = input.name?.trim();

  if (trimmedName) {
    return trimmedName;
  }

  const trimmedUserId = input.userId?.trim();

  if (!trimmedUserId) {
    return PLAYER_NAME_FALLBACK;
  }

  return `${PLAYER_NAME_FALLBACK}#${buildPlayerIdentifier(trimmedUserId)}`;
}

/**
 * Nome humano de um PERFIL para copy que nomeia a pessoa (ex.: o convite de
 * dupla do torneio). Cadeia dos moldes vivos do app: `fullName` (o nome que o
 * card do torneio mostra) -> `nickname` -> nome da conta do usuário ->
 * `Jogador#NNNN` (`buildPlayerDisplayName`, o fallback que o app já exibe).
 *
 * NUNCA devolve vazio: quem nomeia a pessoa numa frase não pode receber "" e
 * ficar sem pendência nem com frase quebrada.
 */
export function buildPlayerProfileDisplayName(input: {
  fullName?: null | string;
  name?: null | string;
  nickname?: null | string;
  userId?: null | string;
}) {
  return buildPlayerDisplayName({
    name:
      input.fullName?.trim() || input.nickname?.trim() || input.name?.trim(),
    userId: input.userId,
  });
}
