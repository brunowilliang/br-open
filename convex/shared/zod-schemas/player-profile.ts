import { z } from "zod";

const PlayerGenderOptions = ["Feminino", "Masculino"] as const;

const BrazilStateOptions = [
  { label: "Acre", value: "AC" },
  { label: "Alagoas", value: "AL" },
  { label: "Amapá", value: "AP" },
  { label: "Amazonas", value: "AM" },
  { label: "Bahia", value: "BA" },
  { label: "Ceará", value: "CE" },
  { label: "Distrito Federal", value: "DF" },
  { label: "Espírito Santo", value: "ES" },
  { label: "Goiás", value: "GO" },
  { label: "Maranhão", value: "MA" },
  { label: "Mato Grosso", value: "MT" },
  { label: "Mato Grosso do Sul", value: "MS" },
  { label: "Minas Gerais", value: "MG" },
  { label: "Pará", value: "PA" },
  { label: "Paraíba", value: "PB" },
  { label: "Paraná", value: "PR" },
  { label: "Pernambuco", value: "PE" },
  { label: "Piauí", value: "PI" },
  { label: "Rio de Janeiro", value: "RJ" },
  { label: "Rio Grande do Norte", value: "RN" },
  { label: "Rio Grande do Sul", value: "RS" },
  { label: "Rondônia", value: "RO" },
  { label: "Roraima", value: "RR" },
  { label: "Santa Catarina", value: "SC" },
  { label: "São Paulo", value: "SP" },
  { label: "Sergipe", value: "SE" },
  { label: "Tocantins", value: "TO" },
] as const;

const PlayerCountry = "Brasil";

const digitCount = (length: number, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, "").length === length, message);

export const PlayerProfileSchema = z.object({
  address: z.string().trim().min(5, "Informe o endereço."),
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Use o formato DD/MM/AAAA."),
  city: z.string().trim().min(2, "Informe a cidade."),
  country: z.literal(PlayerCountry, "O país deve ser Brasil."),
  cpf: digitCount(11, "Informe um CPF válido."),
  fullName: z.string().trim().min(2, "Informe o nome completo."),
  gender: z.enum(PlayerGenderOptions, "Selecione o gênero."),
  nickname: z.string().trim().min(2, "Informe o apelido."),
  phone: z
    .string()
    .trim()
    .refine((value) => {
      const digits = value.replace(/\D/g, "");

      return digits.length === 10 || digits.length === 11;
    }, "Informe um telefone válido."),
  state: z.enum(
    BrazilStateOptions.map((state) => state.value),
    "Selecione o estado."
  ),
  zipCode: digitCount(8, "Informe um CEP válido."),
});
