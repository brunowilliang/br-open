import { z } from "zod";
import { enumField, requiredString } from "../../utils/contract.zod";

const playerGenderOptions = ["Feminino", "Masculino"] as const;

const phoneSchema = z
  .string()
  .trim()
  .nullish()
  .refine((value) => {
    if (!value) {
      return true;
    }

    const digits = value.replace(/\D/g, "");

    return digits.length === 10 || digits.length === 11;
  }, "Informe um telefone válido.")
  .transform((value) => value || undefined);

const playerAvatarStorageIdSchema = z
  .string()
  .min(1, "Imagem inválida.")
  .nullable();

const playerProfileFields = {
  fullName: requiredString("Informe o nome completo.").pipe(
    z.string().min(2, "Informe o nome completo.")
  ),
  gender: enumField(playerGenderOptions, "Selecione o gênero."),
  nickname: requiredString("Informe o apelido.").pipe(
    z.string().min(2, "Informe o apelido.")
  ),
  phone: phoneSchema,
};

export const upsertPlayerProfileSchema = z.object({
  ...playerProfileFields,
  avatarStorageId: playerAvatarStorageIdSchema,
});

export const playerProfileSchema = z.object({
  avatarStorageId: playerAvatarStorageIdSchema,
  avatarUrl: z.string().nullable().optional(),
  fullName: z.string().min(1),
  gender: enumField(playerGenderOptions, "Selecione o gênero.")
    .nullable()
    .optional(),
  nickname: z.string().min(1),
  phone: z.string().nullable().optional(),
});

export function collectReplacedPlayerAvatarStorageIds(input: {
  next: { avatarStorageId?: null | string };
  previous?: { avatarStorageId?: null | string } | null;
}) {
  const previousAvatarStorageId = input.previous?.avatarStorageId ?? null;
  const nextAvatarStorageId = input.next.avatarStorageId ?? null;

  if (
    !previousAvatarStorageId ||
    previousAvatarStorageId === nextAvatarStorageId
  ) {
    return [];
  }

  return [previousAvatarStorageId];
}
