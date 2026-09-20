import { Clock02Icon, UserGroup02Icon } from "@hugeicons/core-free-icons";
import { useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  RegistrationFooter,
  type RegistrationFooterCategory,
} from "@/components/ui/registration-footer";
import { findComponentGalleryEntry } from "@/lib/dev/component-registry";
import { formatCurrencyCents } from "@/lib/format/currency";

/**
 * Moldura de variante na galeria: título curto e estável (numeração pra
 * aprovação: "KPI 1 · normal") + conteúdo. Mesmo título de seção leve
 * dos textos do app (molde schedule.tsx:162-164).
 */
function VariantSection(props: { children: ReactNode; title: string }) {
  return (
    <View className="gap-1">
      <Text color="muted" variant="description" weight="medium">
        {props.title}
      </Text>
      {props.children}
    </View>
  );
}

/**
 * Galeria de variantes do KPI (IBX-0072): SOMENTE variantes do `KpiCard`
 * (ui/kpi-card.tsx) com as props que ele já tem — as composições de texto
 * solto saíram da galeria por ordem do usuário (o molde texto-simples dos
 * dashboards já está aprovado e frozen). Zero estilo novo.
 */
function KpiVariantsSection() {
  return (
    <View className="gap-6">
      <VariantSection title="KPI 1 · normal">
        <KpiCard label="Ocupação" value="18 ativos" />
      </VariantSection>

      <VariantSection title="KPI 2 · com descrição">
        <KpiCard
          description="de 24 vagas"
          icon={UserGroup02Icon}
          label="Ocupação"
          value="18 ativos"
        />
      </VariantSection>

      <VariantSection title="KPI 3 · com erro">
        <KpiCard icon={Clock02Icon} label="Em atraso" tint="danger" value="3" />
      </VariantSection>

      <VariantSection title="KPI 4 · com diálogo">
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

/**
 * Galeria de papéis do texto (IBX-0073): cada papel do app com um exemplo
 * real de conteúdo, via props do componente (`core/text.tsx`) — ZERO estilo
 * na mão. `align` é a única dimensão nova (classes já existentes); a
 * migração dos usos de tela é decisão pendente do usuário.
 */
function TextVariantsSection() {
  return (
    <View className="gap-6">
      <VariantSection title="Texto 1 · título de tela">
        <Text variant="title">Configurações</Text>
      </VariantSection>

      <VariantSection title="Texto 2 · heading de seção">
        <Text variant="heading">Aviso importante</Text>
      </VariantSection>

      <VariantSection title="Texto 3 · corpo">
        <Text>
          Sua inscrição foi confirmada. Os horários das partidas aparecem na
          agenda da competição.
        </Text>
      </VariantSection>

      <VariantSection title="Texto 4 · descrição (secundário apagado)">
        <Text color="muted" variant="description">
          Push e central de notificações.
        </Text>
      </VariantSection>

      <VariantSection title="Texto 5 · rótulo concentrado">
        <Text variant="label">Modo de uso</Text>
      </VariantSection>

      <VariantSection title="Texto 6 · display">
        <Text variant="display">42</Text>
      </VariantSection>

      <VariantSection title="Texto 7 · valor de preço">
        <Text size="3xl" weight="semibold">
          {formatCurrencyCents(123_456)}
        </Text>
      </VariantSection>

      <VariantSection title="Texto 8 · ênfases semânticas">
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

      <VariantSection title="Texto 9 · alinhamento centralizado (novo)">
        <Text align="center" color="muted" variant="description">
          Nenhum resultado encontrado.
        </Text>
      </VariantSection>
    </View>
  );
}

/**
 * Galeria do rodapé flutuante de inscrição (IBX-0074). ROUND 5 (esclarecimento
 * do usuário): as variantes são MODOS DE USO, não estados de chip — liga =
 * clique direto na ação (o painel nem abre); torneio = clique EXPANDE o painel
 * pra selecionar categoria (com duplas pra exercitar o campo de parceiro);
 * lotada = desabilitada. O chip de vagas é detalhe da variante de liga. O
 * rodapé é absoluto (Page.Footer): cada caixa h-28 ancora a instância no
 * próprio pai (RUL-0008). O CTA não tem ação aqui: o wiring é da página.
 */
function RegistrationFooterVariantsSection() {
  const tournamentCategories = [
    {
      displayName: "Masculino",
      id: "singles",
      modality: "singles",
      priceLabel: formatCurrencyCents(4000),
      vacancyLabel: "8 vagas",
    },
    {
      displayName: "Misto",
      id: "doubles",
      modality: "doubles",
      priceLabel: formatCurrencyCents(4000),
      vacancyLabel: "4 vagas",
    },
    {
      displayName: "Feminino",
      id: "feminino-singles",
      isFull: true,
      modality: "singles",
      priceLabel: formatCurrencyCents(4000),
    },
  ] satisfies RegistrationFooterCategory[];

  return (
    <View className="flex-1 justify-end gap-6">
      <VariantSection title="Inscrição 1 · liga (clique direto)">
        <View className="h-28">
          <RegistrationFooter
            actionLabel="Solicitar entrada"
            availabilityLabel="3 vagas disponíveis"
            price={{
              amount: formatCurrencyCents(4000),
              suffix: "/mês",
            }}
            title="Preço"
          />
        </View>
      </VariantSection>

      <VariantSection title="Inscrição 2 · torneio (abre o painel)">
        <View className="h-28">
          <RegistrationFooter
            actionLabel="Pagar R$ 40,00"
            categories={tournamentCategories}
            description="Escolha a categoria e confirme sua inscrição."
            price={{ amount: formatCurrencyCents(4000) }}
            title="Inscreva-se"
          />
        </View>
      </VariantSection>

      <VariantSection title="Inscrição 3 · lotada (desabilitada)">
        <View className="h-28">
          <RegistrationFooter
            actionLabel="Solicitar entrada"
            isActionDisabled
            price={{
              amount: formatCurrencyCents(4000),
              suffix: "/mês",
            }}
            title="Preço"
          />
        </View>
      </VariantSection>
    </View>
  );
}

/**
 * Tela de variantes de um componente da galeria (rota dinâmica no padrão
 * settings/leagues/[mode]). DEV ONLY: mesmo gate `EXPO_PUBLIC_IS_DEV` da
 * entrada e do checkout — usuário final não chega aqui nem por deep link.
 */
export default function ComponentVariantsRoute() {
  const { component } = useLocalSearchParams<{ component: string }>();
  const entry = findComponentGalleryEntry(component);

  if (process.env.EXPO_PUBLIC_IS_DEV !== "true") {
    return null;
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          {entry ? (
            <>
              <Page.Header.SubTitle>Componentes</Page.Header.SubTitle>
              <Page.Header.Title>{entry.title}</Page.Header.Title>
            </>
          ) : (
            <Page.Header.Title>Componentes</Page.Header.Title>
          )}
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>
      <Page.ScrollView contentContainerClassName="gap-6 px-4 pb-safe-offset-4">
        {entry ? (
          entry.id === "kpi" ? (
            <KpiVariantsSection />
          ) : entry.id === "text" ? (
            <TextVariantsSection />
          ) : entry.id === "registration-footer" ? (
            <RegistrationFooterVariantsSection />
          ) : null
        ) : (
          <EmptyState
            description="Escolha um componente na listagem de Componentes."
            title="Componente não encontrado"
          />
        )}
      </Page.ScrollView>
    </Page>
  );
}
