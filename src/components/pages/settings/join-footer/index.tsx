import { View } from "react-native";

import { VariantSection } from "@/components/pages/settings/shared";
import {
  JoinFooter,
  type JoinFooterCategory,
  type JoinFooterPartnerOption,
} from "@/components/ui/join-footer";
import { formatCurrencyCents } from "@/lib/format/currency";
import { buildCategoryTypeLabel } from "@/lib/tournaments/category-editor-derived";

/**
 * O rodapé é absoluto (Page.Footer): cada caixa h-28 ancora a instância no pai
 * direto.
 */
const galleryPartnerOptions: JoinFooterPartnerOption[] = [
  { fullName: "Gustavo Lima", username: "gustavo.lima" },
  { fullName: "Marina Costa", username: "marina.costa" },
  { fullName: "Pedro Almeida", username: "pedro.almeida" },
  { fullName: "Rafael Souza", username: "rafa.souza" },
  { fullName: "Camila Ferraz", username: "camila.ferraz" },
];

export function JoinFooterVariantsSection() {
  const tournamentCategories = [
    {
      displayName: "Masculino",
      id: "singles",
      modality: "singles",
      priceLabel: formatCurrencyCents(4000),
      typeLabel: buildCategoryTypeLabel("singles", "male"),
      vacancyLabel: "8 vagas",
    },
    {
      displayName: "Misto",
      id: "doubles",
      modality: "doubles",
      priceLabel: formatCurrencyCents(4000),
      typeLabel: buildCategoryTypeLabel("doubles", "mixed"),
      vacancyLabel: "4 vagas",
    },
    {
      displayName: "Feminino",
      id: "feminino-singles",
      isFull: true,
      modality: "singles",
      priceLabel: formatCurrencyCents(4000),
      typeLabel: buildCategoryTypeLabel("singles", "female"),
    },
  ] satisfies JoinFooterCategory[];

  return (
    <View className="flex-1 justify-end gap-6">
      <VariantSection title="Inscrição 1 | liga (clique direto)">
        <View className="h-28">
          <JoinFooter
            actionLabel="Solicitar entrada"
            availabilityLabel="3 vagas disponíveis"
            footerClassName="pb-safe-offset-3"
            price={{
              amount: formatCurrencyCents(4000),
              prefix: "a partir de",
              suffix: "/mês",
            }}
            title="Preço"
          />
        </View>
      </VariantSection>

      <VariantSection title="Inscrição 2 | torneio (abre o painel)">
        <View className="h-28">
          <JoinFooter
            actionLabel="Pagar R$ 40,00"
            categories={tournamentCategories}
            description="Escolha a categoria e confirme sua inscrição."
            footerClassName="pb-safe-offset-3"
            partnerOptions={galleryPartnerOptions}
            price={{
              amount: formatCurrencyCents(4000),
              prefix: "a partir de",
            }}
            title="Inscreva-se"
          />
        </View>
      </VariantSection>

      <VariantSection title="Inscrição 3 | lotada (desabilitada)">
        <View className="h-28">
          <JoinFooter
            actionLabel="Solicitar entrada"
            footerClassName="pb-safe-offset-3"
            isActionDisabled
            price={{
              amount: formatCurrencyCents(4000),
              prefix: "a partir de",
              suffix: "/mês",
            }}
            title="Preço"
          />
        </View>
      </VariantSection>
    </View>
  );
}
