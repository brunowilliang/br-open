import { Clock02Icon, UserGroup02Icon } from "@hugeicons/core-free-icons";
import { View } from "react-native";

import { VariantSection } from "@/components/pages/settings/shared";
import { KpiCard } from "@/components/ui/kpi-card";

export function KpiVariantsSection() {
  return (
    <View className="gap-6">
      <VariantSection title="KPI 1 | normal">
        <KpiCard label="Ocupação" value="18 ativos" />
      </VariantSection>

      <VariantSection title="KPI 2 | com descrição">
        <KpiCard
          description="de 24 vagas"
          icon={UserGroup02Icon}
          label="Ocupação"
          value="18 ativos"
        />
      </VariantSection>

      <VariantSection title="KPI 3 | com erro">
        <KpiCard icon={Clock02Icon} label="Em atraso" tint="danger" value="3" />
      </VariantSection>

      <VariantSection title="KPI 4 | com diálogo">
        {/* InfoDialog INTERNO do KpiCard (prop `info` -> InfoTrigger +        */}
        {/* InfoDialog no próprio componente, ui/kpi-card.tsx). */}
        <KpiCard
          description="de 24 vagas"
          info={{
            description:
              "A ocupação conta apenas os membros ativos da liga hoje.",
            title: "Ocupação",
          }}
          label="Ocupação"
          value="18 ativos"
        />
      </VariantSection>
    </View>
  );
}
