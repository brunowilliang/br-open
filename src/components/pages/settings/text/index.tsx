import { View } from "react-native";

import { Text } from "@/components/core/text";
import { VariantSection } from "@/components/pages/settings/shared";
import { formatCurrencyCents } from "@/lib/format/currency";

export function TextVariantsSection() {
  return (
    <View className="gap-6">
      <VariantSection title="Texto 1 | título de tela">
        <Text variant="title">Configurações</Text>
      </VariantSection>

      <VariantSection title="Texto 2 | heading de seção">
        <Text variant="heading">Aviso importante</Text>
      </VariantSection>

      <VariantSection title="Texto 3 | corpo">
        <Text>
          Sua inscrição foi confirmada. Os horários das partidas aparecem na
          agenda da competição.
        </Text>
      </VariantSection>

      <VariantSection title="Texto 4 | descrição (secundário apagado)">
        <Text color="muted" variant="description">
          Push e central de notificações.
        </Text>
      </VariantSection>

      <VariantSection title="Texto 5 | rótulo concentrado">
        <Text variant="label">Modo de uso</Text>
      </VariantSection>

      <VariantSection title="Texto 6 | display">
        <Text variant="display">42</Text>
      </VariantSection>

      <VariantSection title="Texto 7 | valor de preço">
        <Text size="3xl" weight="semibold">
          {formatCurrencyCents(123_456)}
        </Text>
      </VariantSection>

      <VariantSection title="Texto 8 | ênfases semânticas">
        <View className="gap-1">
          <Text color="danger" variant="description">
            Cobrança expirada.
          </Text>
          <Text color="warning" variant="description">
            Faltam 3 dias para o vencimento.
          </Text>
          <Text color="success" variant="description">
            Pagamento confirmado.
          </Text>
          <Text color="accent" variant="description">
            Disponível na sua liga.
          </Text>
        </View>
      </VariantSection>

      <VariantSection title="Texto 9 | alinhamento centralizado (novo)">
        <Text align="center" color="muted" variant="description">
          Nenhum resultado encontrado.
        </Text>
      </VariantSection>
    </View>
  );
}
