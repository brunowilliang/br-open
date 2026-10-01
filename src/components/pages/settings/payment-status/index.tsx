import type { PaymentChargeStatus } from "@convex/domains/payment/contract";
import { View } from "react-native";

import { VariantSection } from "@/components/pages/settings/shared";
import { CheckoutStatusCard } from "@/components/ui/checkout-status-card";
import { buildCheckoutChargeView } from "@/lib/payments/checkout-view";

const galleryCheckoutStatusCases: {
  note: string;
  status: PaymentChargeStatus;
  title: string;
}[] = [
  {
    note: "Webhook confirma o pagamento e a inscrição entra na chave; o checkout fecha neste cartão.",
    status: "PAID",
    title: "Estado 1 | pagamento confirmado",
  },
  {
    note: "O prazo do PIX venceu sem pagamento e a vaga não ficou reservada; o cartão oferece gerar um novo código.",
    status: "EXPIRED",
    title: "Estado 2 | PIX expirado",
  },
  {
    note: "O jogador cancelou pelo próprio PIX: a inscrição é encerrada junto (a vaga volta) e a cobrança morre no provedor.",
    status: "CANCELED",
    title: "Estado 3 | PIX cancelado",
  },
  {
    note: "Dinheiro devolvido (capacidade cheia ou cancelamento do torneio).",
    status: "REFUNDED",
    title: "Estado 4 | pagamento reembolsado",
  },
  {
    note: "PIX não aprovado pelo provedor. Nenhum caminho do app escreve este estado hoje; o cartão existe no mesmo molde.",
    status: "FAILED",
    title: "Estado 5 | pagamento não concluído",
  },
];

export function CheckoutStatusVariantsSection() {
  return (
    <View className="gap-6">
      {galleryCheckoutStatusCases.map((item) => {
        const view = buildCheckoutChargeView({ chargeStatus: item.status });

        return (
          <VariantSection key={item.status} note={item.note} title={item.title}>
            {view ? (
              <CheckoutStatusCard onAction={() => undefined} view={view} />
            ) : null}
          </VariantSection>
        );
      })}
    </View>
  );
}
