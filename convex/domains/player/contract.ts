import { z } from "zod";
import { enumField, requiredString } from "../../utils/contract.zod";

const playerGenderOptions = ["Feminino", "Masculino"] as const;

const phoneSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => {
    if (!value) {
      return true;
    }

    const digits = value.replace(/\D/g, "");

    return digits.length === 10 || digits.length === 11;
  }, "Informe um telefone válido.")
  .transform((value) => value || undefined);

export const playerProfileSchema = z.object({
  fullName: requiredString("Informe o nome completo.").pipe(
    z.string().min(2, "Informe o nome completo.")
  ),
  nickname: requiredString("Informe o apelido.").pipe(
    z.string().min(2, "Informe o apelido.")
  ),
  gender: enumField(playerGenderOptions, "Selecione o gênero."),
  phone: phoneSchema,
});
