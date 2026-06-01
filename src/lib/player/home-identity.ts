const PLAYER_NAME_FALLBACK = "Jogador";
const PLAYER_IDENTIFIER_LENGTH = 4;
const PLAYER_IDENTIFIER_MOD = 10 ** PLAYER_IDENTIFIER_LENGTH;

type GetHomePlayerDisplayNameInput = {
  playerFullName?: null | string;
  userId?: null | string;
};

function buildPlayerIdentifier(userId: string) {
  let hash = 0;

  for (const character of userId) {
    hash = (hash * 31 + character.charCodeAt(0)) % PLAYER_IDENTIFIER_MOD;
  }

  return String(hash).padStart(PLAYER_IDENTIFIER_LENGTH, "0");
}

export function getHomePlayerDisplayName(input: GetHomePlayerDisplayNameInput) {
  const trimmedName = input.playerFullName?.trim();

  if (trimmedName) {
    return trimmedName;
  }

  const trimmedUserId = input.userId?.trim();

  if (!trimmedUserId) {
    return PLAYER_NAME_FALLBACK;
  }

  return `${PLAYER_NAME_FALLBACK}#${buildPlayerIdentifier(trimmedUserId)}`;
}
